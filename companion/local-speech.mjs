// Optional local TTS lifecycle. No microphone, speaker, HTTP or game interface.
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID, createHash } from 'node:crypto';
import { RUNTIME_ROOT, requireRuntimeConfiguration } from './runtime-paths.mjs';
import { verifySpeechPreparation } from './runtime-readiness.mjs';

const project = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const root = path.join(RUNTIME_ROOT, 'tts');
export const SPEECH_OUTPUT_DIRECTORY = path.join(RUNTIME_ROOT, 'speech-output');
export const LOCAL_SPEECH_VOICES = Object.freeze(['af_bella', 'am_adam', 'af_heart']);
const fault = code => Object.assign(new Error(code), { code });
const finite = x => typeof x === 'number' && Number.isFinite(x) && x >= 0;

/** Explicit start/restart; one request, no queue. Abort kills the owned worker.
 * spawnProcess and verifyOutput are dependency seams for synthetic tests only.
 */
export function createLocalSpeech({ spawnProcess = spawn, startupTimeoutMs = 120000,
  synthesisTimeoutMs = 30000, verifyOutput = verifyWave } = {}) {
  if (typeof spawnProcess !== 'function' || typeof verifyOutput !== 'function' ||
      !Number.isInteger(startupTimeoutMs) || startupTimeoutMs < 1 || startupTimeoutMs > 180000 ||
      !Number.isInteger(synthesisTimeoutMs) || synthesisTimeoutMs < 1 || synthesisTimeoutMs > 120000) {
    throw new TypeError('INVALID_SPEECH_OPTIONS');
  }
  let state = 'NEW', child = null, pending = null, boot = null, ready = null, stderr = '', buffer = '';
  let restartRequired = false, stopPromise = null, restartPromise = null, epoch = 0, lifecycle = 0;

  function settlePending(error, value) {
    const job = pending; if (!job) return;
    pending = null; clearTimeout(job.timer); job.signal?.removeEventListener('abort', job.onAbort);
    if (error) job.reject(error); else job.resolve(value);
  }
  function settleBoot(error, value) {
    const start = boot; if (!start) return;
    boot = null; clearTimeout(start.timer);
    if (error) start.reject(error); else start.resolve(value);
  }
  async function cleanupInterrupted(id) {
    if (!id) return;
    for (const extension of ['.part', '.wav']) {
      await fs.unlink(path.join(SPEECH_OUTPUT_DIRECTORY, id + extension)).catch(error => {
        if (error.code !== 'ENOENT') stderr = `OUTPUT_CLEANUP_${error.code}`;
      });
    }
  }
  function stop(reason = 'STOPPED') {
    ++lifecycle;
    return stopOwned(reason);
  }
  function stopOwned(reason) {
    if (stopPromise) return stopPromise;
    restartRequired = true;
    const owned = child, interruptedId = pending?.id;
    ++epoch; state = 'STOPPING'; ready = null;
    settleBoot(fault(reason)); settlePending(fault(reason));
    stopPromise = (async () => {
      if (owned) {
        await new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(fault('WORKER_STOP_TIMEOUT')), 3000);
          owned.once('close', () => { clearTimeout(timer); resolve(); });
          owned.kill();
        });
      }
      if (child === owned) child = null;
      await cleanupInterrupted(interruptedId);
      state = 'STOPPED';
      return { status: 'STOPPED', reason, restartRequired: true };
    })().catch(error => { state = 'STOP_FAILED'; throw error; }).finally(() => { stopPromise = null; });
    return stopPromise;
  }
  function fail(reason) { void stop(reason).catch(() => {}); }
  async function message(msg, generation) {
    if (generation !== epoch) return;
    if (!msg || typeof msg !== 'object' || Array.isArray(msg)) return fail('INVALID_WORKER_MESSAGE');
    if (msg.type === 'ready' && state === 'STARTING' && boot) {
      if (msg.protocol !== 1 || msg.device !== 'cpu' || msg.microphoneCapture !== false || msg.speakerPlayback !== false ||
          !Array.isArray(msg.voices) || msg.voices.length !== 3 || !LOCAL_SPEECH_VOICES.every(v => msg.voices.includes(v))) {
        return fail('INVALID_WORKER_READY');
      }
      state = 'READY'; ready = structuredClone(msg); settleBoot(null, structuredClone(ready)); return;
    }
    if (msg.type === 'fatal') return fail('WORKER_FATAL');
    if (!pending || msg.id !== pending.id || state !== 'BUSY') return fail('UNEXPECTED_WORKER_RESPONSE');
    if (msg.type === 'error') {
      state = 'READY'; settlePending(fault('SYNTHESIS_FAILED')); return;
    }
    if (msg.type !== 'result' || msg.fileName !== `${pending.id}.wav` || msg.voiceId !== pending.voiceId ||
        !finite(msg.firstAudioMs) || !finite(msg.synthesisMs) || msg.firstAudioMs > msg.synthesisMs ||
        !finite(msg.audioDurationSeconds) || msg.audioDurationSeconds < .1 || msg.audioDurationSeconds > 60 ||
        msg.sampleRate !== 24000 || msg.channels !== 1 || !Number.isSafeInteger(msg.bytes) ||
        msg.bytes < 44 || msg.bytes > 3 * 1024 ** 2 || !/^[a-f0-9]{64}$/.test(msg.sha256 || '')) {
      return fail('INVALID_WORKER_RESULT');
    }
    const job = pending;
    try {
      const wavPath = path.join(SPEECH_OUTPUT_DIRECTORY, msg.fileName);
      await verifyOutput(wavPath, msg);
      if (generation !== epoch || pending !== job || job.signal?.aborted) return;
      state = 'READY'; settlePending(null, { ...msg, wavPath, classification: 'LOCAL_TTS_FILE_ONLY',
        microphoneCapture: false, speakerPlayback: false });
    } catch { if (generation === epoch) fail('OUTPUT_VERIFICATION_FAILED'); }
  }
  async function start() {
    if (spawnProcess === spawn) await verifySpeechPreparation(requireRuntimeConfiguration());
    if (state === 'READY' || state === 'BUSY') return structuredClone(ready);
    if (state === 'STARTING') return boot.promise;
    if (restartRequired || state !== 'NEW') throw fault('EXPLICIT_RESTART_REQUIRED');
    state = 'STARTING'; buffer = ''; stderr = ''; const generation = ++epoch;
    const env = { ...process.env, MW5_COMPANION_RUNTIME_ROOT: RUNTIME_ROOT, PYTHONNOUSERSITE: '1', PYTHONIOENCODING: 'utf-8',
      HF_HOME: path.join(root, 'hf-cache'), HF_HUB_OFFLINE: '1', TRANSFORMERS_OFFLINE: '1',
      HF_HUB_DISABLE_TELEMETRY: '1', CUDA_VISIBLE_DEVICES: '-1', OMP_NUM_THREADS: '2', MKL_NUM_THREADS: '2',
      TEMP: path.join(root, 'tmp'), TMP: path.join(root, 'tmp') };
    delete env.PYTHONPATH;
    let resolve, reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    boot = { promise, resolve, reject, timer: setTimeout(() => fail('STARTUP_TIMEOUT'), startupTimeoutMs) };
    try {
      const owned = spawnProcess(path.join(root, 'venv', 'Scripts', 'python.exe'),
        ['-I', '-B', path.join(project, 'scripts', 'Kokoro-Worker.py')],
        { cwd: project, env, windowsHide: true, shell: false, stdio: ['pipe', 'pipe', 'pipe'] });
      child = owned;
      owned.stdout.setEncoding('utf8'); owned.stderr.setEncoding('utf8');
      owned.stdout.on('data', chunk => {
        if (generation !== epoch) return;
        buffer += chunk;
        if (buffer.length > 65536) return fail('WORKER_OUTPUT_LIMIT');
        let end;
        while ((end = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, end); buffer = buffer.slice(end + 1);
          try { void message(JSON.parse(line), generation); } catch { fail('INVALID_WORKER_JSON'); }
        }
      });
      owned.stderr.on('data', chunk => { if (generation === epoch) stderr = (stderr + chunk).slice(-2048); });
      owned.stdin.on('error', () => { if (generation === epoch) fail('WORKER_INPUT_FAILED'); });
      owned.on('error', () => { if (generation === epoch) fail('WORKER_START_FAILED'); });
      owned.on('close', () => {
        if (generation !== epoch) return;
        child = null; fail('WORKER_EXITED');
      });
    } catch { fail('WORKER_START_FAILED'); }
    return promise;
  }
  function restart() {
    if (restartPromise) return restartPromise;
    const intent = ++lifecycle;
    restartPromise = (async () => {
      await stopOwned('RESTARTED');
      if (intent !== lifecycle) throw fault('RESTART_CANCELLED');
      restartRequired = false; state = 'NEW'; return start();
    })().finally(() => { restartPromise = null; });
    return restartPromise;
  }
  async function synthesize(request, { signal } = {}) {
    if (!request || Object.getPrototypeOf(request) !== Object.prototype ||
        Object.keys(request).sort().join(',') !== 'text,voiceId' || typeof request.text !== 'string' ||
        !request.text.trim() || request.text.length > 256 || !request.text.isWellFormed() || /[\u0000-\u001f\u007f]/u.test(request.text) ||
        !LOCAL_SPEECH_VOICES.includes(request.voiceId)) throw fault('INVALID_SPEECH_REQUEST');
    if (signal && (typeof signal.addEventListener !== 'function' || typeof signal.aborted !== 'boolean')) throw fault('INVALID_ABORT_SIGNAL');
    if (signal?.aborted) throw fault('ABORTED');
    if (state !== 'READY') throw fault(state === 'BUSY' ? 'SPEECH_BUSY' : 'SPEECH_NOT_READY');
    const id = randomUUID(); state = 'BUSY';
    return new Promise((resolve, reject) => {
      const onAbort = () => fail('ABORTED');
      pending = { id, voiceId: request.voiceId, resolve, reject, signal, onAbort,
        timer: setTimeout(() => fail('SYNTHESIS_TIMEOUT'), synthesisTimeoutMs) };
      signal?.addEventListener('abort', onAbort, { once: true });
      if (signal?.aborted) return onAbort();
      try { child.stdin.write(JSON.stringify({ id, text: request.text, voiceId: request.voiceId }) + '\n'); }
      catch { fail('WORKER_INPUT_FAILED'); }
    });
  }
  return Object.freeze({ start, restart, synthesize, stop,
    getState: () => ({ state, restartRequired, busy: !!pending, ready: ready && structuredClone(ready),
      stderrTail: stderr, microphoneCapture: false, speakerPlayback: false }) });
}

async function verifyWave(file, result) {
  const dir = await fs.realpath(SPEECH_OUTPUT_DIRECTORY);
  if (dir.toLowerCase() !== SPEECH_OUTPUT_DIRECTORY.toLowerCase()) throw fault('OUTPUT_DIRECTORY_LINK');
  const info = await fs.lstat(file);
  if (!info.isFile() || info.isSymbolicLink() || info.size !== result.bytes) throw fault('OUTPUT_FILE_INVALID');
  const data = await fs.readFile(file);
  if (data.length !== result.bytes || data.length < 44 || data.toString('ascii', 0, 4) !== 'RIFF' ||
      data.readUInt32LE(4) !== data.length - 8 || data.toString('ascii', 8, 12) !== 'WAVE' ||
      createHash('sha256').update(data).digest('hex') !== result.sha256) throw fault('OUTPUT_CONTENT_INVALID');
  // Hash agreement establishes which bytes the worker wrote, not their format.
  // Parse the bounded RIFF container and independently verify its PCM metadata.
  let offset = 12, format = null, audioBytes = null;
  while (offset + 8 <= data.length) {
    const tag = data.toString('ascii', offset, offset + 4), size = data.readUInt32LE(offset + 4);
    const start = offset + 8, end = start + size;
    if (end > data.length) throw fault('OUTPUT_CONTENT_INVALID');
    if (tag === 'fmt ') {
      if (format !== null || size < 16) throw fault('OUTPUT_CONTENT_INVALID');
      format = { encoding: data.readUInt16LE(start), channels: data.readUInt16LE(start + 2),
        sampleRate: data.readUInt32LE(start + 4), byteRate: data.readUInt32LE(start + 8),
        blockAlign: data.readUInt16LE(start + 12), bits: data.readUInt16LE(start + 14) };
    } else if (tag === 'data') {
      if (audioBytes !== null) throw fault('OUTPUT_CONTENT_INVALID');
      audioBytes = size;
    }
    offset = end + (size % 2);
  }
  if (offset !== data.length || !format || audioBytes === null || format.encoding !== 1 ||
      format.channels !== 1 || format.channels !== result.channels || format.sampleRate !== 24000 ||
      format.sampleRate !== result.sampleRate || format.bits !== 16 || format.blockAlign !== 2 ||
      format.byteRate !== 48000 || audioBytes % 2 !== 0) throw fault('OUTPUT_CONTENT_INVALID');
  const seconds = audioBytes / 2 / 24000;
  if (seconds < .1 || seconds > 60 || Math.abs(seconds - result.audioDurationSeconds) > 1 / 24000 + 1e-9)
    throw fault('OUTPUT_CONTENT_INVALID');
}
