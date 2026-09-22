// Optional cold, file-only ASR. Import/start never launch a native process.
// This project interface supplies untrusted text, never commands or game inputs.
import fs from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';

const PROJECT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRATCH = path.join(PROJECT, 'companion', 'local', 'recognition-tmp');
const RUNTIME = path.join(PROJECT, 'companion', 'local', 'runtimes', 'whisper-cpu-b5130', 'Release');
const GiB = 1024 ** 3, MAX_TRANSCRIPT_BYTES = 4096, MAX_NATIVE_BYTES = 131072;
const PINNED_INVENTORY_SHA256 = '7bc2ffa17febb5ed6439cc285756cfe08fdb2a30852b4dd07e0010eae7500d7a';
const PINNED_ARTIFACTS = Object.freeze({
  'whisper-base-en': { name: 'ggml-base.en.bin', bytes: 147964211,
    sha256: 'a03779c86df3323075f5e796cb2ce5029f00ec8869eee3fdfb897afe36c6d002',
    version: '5359861c739e955e79d9a303bcbc70fb988958b1' },
  'whisper-cpu': { name: 'whisper-bin-x64.zip', bytes: 8573270,
    sha256: 'f9ec6c52a2e949b62ab51fa21d0d497958f9e41c3010c157c4e42932d5316f3c', version: 'b5130' }
});
const fault = code => Object.assign(new Error(code), { code });
const samePath = (a, b) => process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
const contained = file => { const rel = path.relative(PROJECT, file); return rel && !rel.startsWith('..') && !path.isAbsolute(rel); };
const ownOptions = (value, keys) => value && Object.getPrototypeOf(value) === Object.prototype &&
  Reflect.ownKeys(value).every(key => typeof key === 'string' && keys.includes(key) &&
    Object.hasOwn(Object.getOwnPropertyDescriptor(value, key), 'value'));
async function hashFile(file, expectedBytes, guard) {
  const handle = await fs.open(file, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    guard(); const stat = await handle.stat(); guard();
    if (!stat.isFile() || stat.size !== expectedBytes) throw fault('RECOGNITION_PIN_MISMATCH');
    const hash = createHash('sha256'), chunk = Buffer.alloc(1024 * 1024); let offset = 0;
    for (;;) {
      const { bytesRead } = await handle.read(chunk, 0, chunk.length, offset); guard();
      if (!bytesRead) break; offset += bytesRead;
      if (offset > expectedBytes) throw fault('RECOGNITION_PIN_MISMATCH');
      hash.update(chunk.subarray(0, bytesRead));
    }
    if (offset !== expectedBytes) throw fault('RECOGNITION_PIN_MISMATCH');
    return hash.digest('hex');
  } finally { await handle.close(); }
}
const defaults = {
  ...fs, hashFile, spawn, freemem: () => os.freemem(), now: () => performance.now(),
};

/** Strict canonical WAV only: 44-byte header, PCM16 mono 16 kHz, 0.1–15 s.
 * A private copy is taken before asynchronous work; caller mutation cannot change it.
 */
function admitWave(wav) {
  if (!Buffer.isBuffer(wav) || wav.length < 3244 || wav.length > 480044) throw fault('INVALID_RECOGNITION_WAV');
  wav = Buffer.from(wav);
  if (wav.toString('ascii', 0, 4) !== 'RIFF' || wav.readUInt32LE(4) !== wav.length - 8 ||
      wav.toString('ascii', 8, 12) !== 'WAVE' || wav.toString('ascii', 12, 16) !== 'fmt ' ||
      wav.readUInt32LE(16) !== 16 || wav.readUInt16LE(20) !== 1 || wav.readUInt16LE(22) !== 1 ||
      wav.readUInt32LE(24) !== 16000 || wav.readUInt32LE(28) !== 32000 ||
      wav.readUInt16LE(32) !== 2 || wav.readUInt16LE(34) !== 16 ||
      wav.toString('ascii', 36, 40) !== 'data' || wav.readUInt32LE(40) !== wav.length - 44 ||
      (wav.length - 44) % 2) throw fault('INVALID_RECOGNITION_WAV');
  return wav;
}

/**
 * start(): pinned installation + 10 GiB disk / 3 GiB RAM preflight, no process.
 * transcribe(buffer,{signal}): one cold whisper-cli child, no queue.
 * stop()/dispose(): bounded wait; unconfirmed operations retain the busy slot.
 * No microphone, speaker, HTTP listener, download, or command interpretation.
 * The second argument is a trusted code-only I/O seam for MOCK_ONLY tests.
 */
export function createLocalRecognition(options = {}, testIo = {}) {
  if (!ownOptions(options, ['requestTimeoutMs', 'stopTimeoutMs'])) throw fault('INVALID_RECOGNITION_OPTIONS');
  const { requestTimeoutMs = 30000, stopTimeoutMs = 3000 } = options;
  if (!Number.isInteger(requestTimeoutMs) || requestTimeoutMs < 1 || requestTimeoutMs > 120000 ||
      !Number.isInteger(stopTimeoutMs) || stopTimeoutMs < 1 || stopTimeoutMs > 10000 ||
      !ownOptions(testIo, Object.keys(defaults))) throw fault('INVALID_RECOGNITION_OPTIONS');
  for (const value of Object.values(testIo)) if (typeof value !== 'function') throw fault('INVALID_RECOGNITION_OPTIONS');
  const io = { ...defaults, ...testIo }, mock = Object.keys(testIo).length > 0;
  let enabled = false, disposed = false, epoch = 0, boot = null, job = null;
  let verification = 'NOT_PERFORMED', lastError = null, cleanupBlocked = false, stopUnconfirmed = false;
  let resourceSnapshot = null;

  // lstat detects symlinks/junctions; realpath detects redirected ancestors. Check
  // every component before reads/writes/deletes, including the workspace itself.
  async function checked(file, kind, guard = () => {}) {
    file = path.resolve(file);
    if (!samePath(file, PROJECT) && !contained(file)) throw fault('RECOGNITION_PATH_REJECTED');
    const components = [PROJECT];
    const parts = path.relative(PROJECT, file).split(path.sep).filter(Boolean);
    for (const part of parts) components.push(path.join(components.at(-1), part));
    for (let index = 0; index < components.length; index++) {
      const item = components[index]; guard(); const stat = await io.lstat(item); guard();
      if (stat.isSymbolicLink() || !samePath(await io.realpath(item), item)) throw fault('RECOGNITION_PATH_REJECTED');
      guard();
      if (index < components.length - 1 || kind === 'directory') {
        if (!stat.isDirectory()) throw fault('RECOGNITION_PATH_REJECTED');
      } else if (kind === 'file' && !stat.isFile()) throw fault('RECOGNITION_PATH_REJECTED');
    }
    return file;
  }
  async function readBounded(file, max, guard = () => {}) {
    await checked(file, 'file', guard); guard();
    const handle = await io.open(file, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    try {
      guard(); const stat = await handle.stat(); guard();
      if (!stat.isFile() || !Number.isSafeInteger(stat.size) || stat.size < 0 || stat.size > max)
        throw fault('RECOGNITION_FILE_REJECTED');
      const buffer = Buffer.alloc(stat.size + 1);
      let offset = 0;
      while (offset < buffer.length) {
        const { bytesRead } = await handle.read(buffer, offset, buffer.length - offset, offset); guard();
        if (!bytesRead) break; offset += bytesRead;
      }
      if (offset !== stat.size) throw fault('RECOGNITION_FILE_REJECTED');
      await checked(file, 'file', guard); return buffer.subarray(0, offset);
    } finally { await handle.close(); }
  }
  async function hashPinned(file, pin, guard) {
    await checked(file, 'file', guard);
    const stat = await io.lstat(file); guard();
    if (stat.size !== pin.bytes || await io.hashFile(file, pin.bytes, guard) !== pin.sha256)
      throw fault('RECOGNITION_PIN_MISMATCH');
    guard(); await checked(file, 'file', guard);
  }
  async function installation(guard) {
    const decode = bytes => JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^\uFEFF/, ''));
    const lock = decode(await readBounded(path.join(PROJECT, 'companion', 'models.lock.json'), 1048576, guard));
    const inventoryBytes = await readBounded(path.join(PROJECT, 'companion', 'whisper-runtime-pins.json'), 1048576, guard);
    // Bind the mutable local inventory to the source-reviewed release inventory.
    if (createHash('sha256').update(inventoryBytes).digest('hex') !== PINNED_INVENTORY_SHA256)
      throw fault('RECOGNITION_PIN_MISMATCH');
    const pins = decode(inventoryBytes);
    if (lock.schemaVersion !== 1 || !Array.isArray(lock.artifacts)) throw fault('RECOGNITION_PIN_MISMATCH');
    const models = lock.artifacts.filter(x => x.id === 'whisper-base-en');
    const archives = lock.artifacts.filter(x => x.id === 'whisper-cpu');
    if (models.length !== 1 || archives.length !== 1) throw fault('RECOGNITION_PIN_MISMATCH');
    const model = models[0], archive = archives[0];
    for (const pin of [model, archive]) {
      const expected = PINNED_ARTIFACTS[pin.id];
      if (Object.keys(expected).some(key => pin[key] !== expected[key])) throw fault('RECOGNITION_PIN_MISMATCH');
    }
    if (model.name !== 'ggml-base.en.bin' || archive.name !== 'whisper-bin-x64.zip' || archive.version !== 'b5130' ||
        pins.schemaVersion !== 1 || pins.artifact !== 'whisper-cpu' || pins.version !== 'b5130' ||
        pins.archiveSha256 !== archive.sha256 || pins.archiveBytes !== archive.bytes || pins.source !== archive.url ||
        !Array.isArray(pins.files) || pins.files.length !== 40) throw fault('RECOGNITION_PIN_MISMATCH');
    const validPin = p => Number.isSafeInteger(p.bytes) && p.bytes > 0 && /^[a-f0-9]{64}$/.test(p.sha256 ?? '');
    if (!validPin(model) || !validPin(archive)) throw fault('RECOGNITION_PIN_MISMATCH');
    const names = new Set();
    for (const pin of pins.files) {
      if (!/^[a-zA-Z0-9_-]+\.(dll|exe)$/i.test(pin.name ?? '') || !validPin(pin) ||
          pin.archiveEntry !== 'Release/' + pin.name || names.has(pin.name.toLowerCase()))
        throw fault('RECOGNITION_PIN_MISMATCH');
      names.add(pin.name.toLowerCase());
    }
    if (!names.has('whisper-cli.exe')) throw fault('RECOGNITION_PIN_MISMATCH');
    await checked(RUNTIME, 'directory', guard);
    const entries = await io.readdir(RUNTIME, { withFileTypes: true }); guard();
    if (entries.length !== names.size || entries.some(e => !e.isFile() || e.isSymbolicLink() || !names.has(e.name.toLowerCase())))
      throw fault('RECOGNITION_RUNTIME_INVENTORY_MISMATCH');
    for (const pin of [model, archive]) await hashPinned(path.join(PROJECT, 'companion', 'local', 'models', pin.name), pin, guard);
    for (const pin of pins.files) await hashPinned(path.join(RUNTIME, pin.name), pin, guard);
    return { model: path.join(PROJECT, 'companion', 'local', 'models', model.name), runtime: path.join(RUNTIME, 'whisper-cli.exe') };
  }
  async function resources(guard) {
    const disk = await io.statfs(PROJECT); guard(); const availableRamBytes = io.freemem();
    const availableDiskBytes = Number(disk.bavail) * Number(disk.bsize);
    resourceSnapshot = { availableDiskBytes, availableRamBytes, continuousReserveGuaranteed: false };
    if (!Number.isFinite(availableDiskBytes) || availableDiskBytes < 10 * GiB) throw fault('RECOGNITION_DISK_RESERVE');
    if (!Number.isFinite(availableRamBytes) || availableRamBytes < 3 * GiB) throw fault('RECOGNITION_RAM_RESERVE');
  }
  async function makeScratch(guard) {
    for (const dir of [path.join(PROJECT, 'companion'), path.join(PROJECT, 'companion', 'local'), SCRATCH]) {
      await checked(path.dirname(dir), 'directory', guard); guard();
      try { await io.mkdir(dir); } catch (error) { if (error.code !== 'EEXIST') throw error; }
      await checked(dir, 'directory', guard);
    }
    guard(); const dir = await io.mkdtemp(path.join(SCRATCH, 'asr-'));
    if (!samePath(path.dirname(dir), SCRATCH) || !/^asr-[A-Za-z0-9_-]+$/.test(path.basename(dir)))
      throw fault('RECOGNITION_PATH_REJECTED');
    // Caller records the returned directory before a later cancellation guard.
    return dir;
  }
  async function cleanup(work) {
    if (!work.dir) return;
    await checked(work.dir, 'directory');
    const entries = await io.readdir(work.dir, { withFileTypes: true });
    if (entries.some(e => !['input.wav', 'transcript.txt'].includes(e.name) || !e.isFile() || e.isSymbolicLink()))
      throw fault('RECOGNITION_CLEANUP_FAILED');
    for (const entry of entries) {
      const file = path.join(work.dir, entry.name); await checked(file, 'file');
      await io.unlink(file);
    }
    await checked(work.dir, 'directory'); await io.rmdir(work.dir); work.dir = null;
  }
  function status() {
    const busy = !!job || !!boot;
    const state = cleanupBlocked ? 'CLEANUP_FAILED' : stopUnconfirmed && busy ? 'STOP_UNCONFIRMED' :
      job ? job.cancelCode ? 'STOPPING' : 'BUSY' : boot ? enabled ? 'STARTING' : 'STOPPING' :
      disposed ? 'DISPOSED' : enabled ? 'READY' : 'STOPPED';
    return { state, busy, mode: 'COLD_FILE_TRANSCRIPTION_ONLY', classification: mock ? 'MOCK_ONLY' : 'LOCAL_ASR_UNVERIFIED_TEXT',
      transcriptTrust: 'UNTRUSTED_RECOGNITION', verification, lastError,
      ownsProcess: !!job?.child && !job.closed, processStopConfirmed: !job?.child || job.closed,
      cleanupPending: !!job?.dir, cleanupBlocked, resourceSnapshot: resourceSnapshot && { ...resourceSnapshot },
      microphoneCapture: false, speakerPlayback: false, commandExecution: false, gameTests: 'NOT_PERFORMED',
      settings: { modelId: 'whisper-base-en', runtimeVersion: 'b5130', cpuThreads: 4, gpu: false,
        requestTimeoutMs, stopTimeoutMs, maxAudioMs: 15000, maxTranscriptBytes: MAX_TRANSCRIPT_BYTES } };
  }
  function start() {
    if (disposed) return Promise.reject(fault('RECOGNITION_DISPOSED'));
    if (cleanupBlocked) return Promise.reject(fault('RECOGNITION_CLEANUP_FAILED'));
    if (job) return Promise.reject(fault('RECOGNITION_BUSY'));
    if (boot) return enabled ? boot.promise : Promise.reject(fault('RECOGNITION_BUSY'));
    if (enabled) return Promise.resolve(status());
    enabled = true; stopUnconfirmed = false; lastError = null; const generation = ++epoch;
    const record = { settled: false, cancelCode: null };
    const guard = () => { if (epoch !== generation || !enabled || disposed) throw fault(record.cancelCode ?? 'RECOGNITION_STOPPED'); };
    record.promise = new Promise((resolve, reject) => { record.resolve = resolve; record.reject = reject; });
    boot = record;
    record.timer = setTimeout(() => {
      if (boot !== record || record.settled) return;
      enabled = false; ++epoch; lastError = record.cancelCode = 'RECOGNITION_TIMEOUT';
      record.settled = true; record.reject(fault(lastError));
    }, requestTimeoutMs);
    void (async () => {
      try {
        await resources(guard); await installation(guard); guard();
        verification = mock ? 'MOCK_VERIFIED' : 'PINNED_FILES_VERIFIED';
      } catch (error) {
        enabled = false; lastError = safeCode(error);
        if (!record.settled) { record.settled = true; record.reject(fault(lastError)); }
      } finally { clearTimeout(record.timer); if (boot === record) boot = null; }
      if (!record.settled) { record.settled = true; record.resolve(status()); }
    })();
    return record.promise;
  }
  // Errors never include native output, paths, caller text or injected error messages.
  function safeCode(error) {
    const code = error?.code;
    return ['RECOGNITION_PATH_REJECTED', 'RECOGNITION_FILE_REJECTED', 'RECOGNITION_PIN_MISMATCH',
      'RECOGNITION_RUNTIME_INVENTORY_MISMATCH', 'RECOGNITION_DISK_RESERVE', 'RECOGNITION_RAM_RESERVE',
      'RECOGNITION_CLEANUP_FAILED', 'RECOGNITION_STOPPED', 'RECOGNITION_PROCESS_FAILED',
      'RECOGNITION_NATIVE_OUTPUT_LIMIT', 'RECOGNITION_OUTPUT_REJECTED', 'RECOGNITION_ABORTED',
      'RECOGNITION_TIMEOUT'].includes(code) ? code : 'RECOGNITION_IO_FAILED';
  }
  function settle(work, error, value) {
    if (work.settled) return; work.settled = true;
    clearTimeout(work.timer); work.signal?.removeEventListener('abort', work.onAbort);
    if (error) work.reject(error); else work.resolve(value);
  }
  function terminate(work) {
    if (!work.child || work.closed || work.killAttempted) return;
    work.killAttempted = true;
    try { work.killAccepted = work.child.kill(); } catch { work.killAccepted = false; }
  }
  function cancel(work, code) {
    if (job !== work) return;
    if (!work.cancelCode) work.cancelCode = code;
    enabled = false; lastError = work.cancelCode;
    settle(work, fault(work.cancelCode)); terminate(work);
  }
  async function run(work, wav) {
    const guard = () => { if (work.cancelCode || job !== work || disposed) throw fault(work.cancelCode ?? 'RECOGNITION_STOPPED'); };
    try {
      await resources(guard); const verified = await installation(guard); guard();
      work.dir = await makeScratch(guard); guard(); await checked(work.dir, 'directory', guard);
      const input = path.join(work.dir, 'input.wav'), prefix = path.join(work.dir, 'transcript');
      await io.writeFile(input, wav, { flag: 'wx', mode: 0o600 }); guard();
      await checked(input, 'file', guard); await checked(verified.runtime, 'file', guard);
      await checked(verified.model, 'file', guard); await resources(guard); guard();
      const env = { ...process.env, OMP_NUM_THREADS: '4', MKL_NUM_THREADS: '4', CUDA_VISIBLE_DEVICES: '-1' };
      const args = ['--model', verified.model, '--file', input, '--threads', '4', '--language', 'en',
        '--no-gpu', '--output-txt', '--output-file', prefix];
      const child = io.spawn(verified.runtime, args, { cwd: RUNTIME, windowsHide: true, shell: false,
        stdio: ['ignore', 'pipe', 'pipe'], env }); work.child = child;
      const closed = new Promise(resolve => {
        child.once('close', (code, signal) => { work.closed = true; work.exitCode = code; work.exitSignal = signal; resolve(); });
        child.on('error', () => { if (job === work && !work.closed) cancel(work, 'RECOGNITION_PROCESS_FAILED'); });
      });
      for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => {
        if (job !== work || work.closed) return;
        work.nativeBytes += Buffer.byteLength(chunk);
        if (work.nativeBytes > MAX_NATIVE_BYTES) cancel(work, 'RECOGNITION_NATIVE_OUTPUT_LIMIT');
      });
      for (const stream of [child.stdout, child.stderr]) stream.on('error', () => {
        if (job === work && !work.closed) cancel(work, 'RECOGNITION_PROCESS_FAILED');
      });
      if (work.cancelCode) terminate(work);
      await closed; guard();
      if (work.exitCode !== 0 || work.exitSignal) throw fault('RECOGNITION_PROCESS_FAILED');
      const raw = await readBounded(prefix + '.txt', MAX_TRANSCRIPT_BYTES, guard); guard();
      let text;
      try { text = new TextDecoder('utf-8', { fatal: true }).decode(raw).trim(); }
      catch { throw fault('RECOGNITION_OUTPUT_REJECTED'); }
      if (!text || text.length > 2048 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(text))
        throw fault('RECOGNITION_OUTPUT_REJECTED');
      work.result = { schemaVersion: 1, text, transcriptTrust: 'UNTRUSTED_RECOGNITION',
        classification: mock ? 'MOCK_ONLY' : 'LOCAL_ASR_UNVERIFIED_TEXT', mode: 'COLD_FILE_TRANSCRIPTION_ONLY',
        durationMs: (wav.length - 44) / 32, elapsedMs: Math.max(0, io.now() - work.startedAt),
        commandExecution: false, microphoneCapture: false, speakerPlayback: false };
    } catch (error) { cancel(work, safeCode(error)); }
    finally {
      // run only reaches here after close, or before a child exists. If a seam or
      // unusual spawn contract throws after returning a child, retain ownership.
      if (work.child && !work.closed) { stopUnconfirmed = true; return; }
      try { await cleanup(work); }
      catch { cleanupBlocked = true; enabled = false; lastError = 'RECOGNITION_CLEANUP_FAILED'; settle(work, fault(lastError)); }
      if (!work.cancelCode && !cleanupBlocked) settle(work, null, work.result);
      if (job === work) job = null;
      stopUnconfirmed = false; work.doneResolve();
    }
  }
  async function transcribe(wav, requestOptions = {}) {
    if (!ownOptions(requestOptions, ['signal'])) throw fault('INVALID_RECOGNITION_OPTIONS');
    const { signal } = requestOptions;
    if (signal !== undefined && !(signal instanceof AbortSignal)) throw fault('INVALID_ABORT_SIGNAL');
    if (signal?.aborted) throw fault('RECOGNITION_ABORTED');
    const admitted = admitWave(wav);
    if (disposed) throw fault('RECOGNITION_DISPOSED');
    if (job || boot) throw fault('RECOGNITION_BUSY');
    if (!enabled || cleanupBlocked) throw fault('RECOGNITION_NOT_READY');
    const work = { startedAt: io.now(), child: null, closed: false, dir: null, nativeBytes: 0, signal,
      cancelCode: null, settled: false, result: null, killAttempted: false };
    work.promise = new Promise((resolve, reject) => { work.resolve = resolve; work.reject = reject; });
    work.done = new Promise(resolve => { work.doneResolve = resolve; }); job = work;
    work.onAbort = () => cancel(work, 'RECOGNITION_ABORTED');
    work.timer = setTimeout(() => cancel(work, 'RECOGNITION_TIMEOUT'), requestTimeoutMs);
    signal?.addEventListener('abort', work.onAbort, { once: true });
    if (signal?.aborted) work.onAbort();
    void run(work, admitted); return work.promise;
  }
  async function stop() {
    enabled = false; ++epoch;
    // Settle callers promptly, but keep boot occupied until the underlying I/O
    // drains. A late hash/read completion cannot start a process or release twice.
    if (boot && !boot.settled) {
      clearTimeout(boot.timer); boot.cancelCode = 'RECOGNITION_STOPPED'; boot.settled = true;
      boot.reject(fault('RECOGNITION_STOPPED'));
    }
    const work = job;
    if (work) {
      cancel(work, 'RECOGNITION_STOPPED');
      let timer;
      await Promise.race([work.done, new Promise(resolve => { timer = setTimeout(resolve, stopTimeoutMs); })]);
      clearTimeout(timer);
      if (job === work) stopUnconfirmed = true;
    }
    return { ...status(), stopped: !job && !boot, ownedProcessStopped: !job?.child || job.closed,
      pendingPreflight: !!boot, cleanupComplete: !job && !cleanupBlocked };
  }
  async function dispose() { disposed = true; return stop(); }
  return Object.freeze({ start, transcribe, stop, dispose, status });
}
