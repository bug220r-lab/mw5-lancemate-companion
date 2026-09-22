// Explicit smoke of the local file-ASR adapter using one existing synthetic clip.
// No download, microphone, playback, listener, game access or automatic commands.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createLocalRecognition } from '../companion/local-recognition.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const receiptFile = path.join(root, 'research/LOCAL_RECOGNITION_COMPONENT_SMOKE.json');
const clipFile = 'companion/local/whisper-benchmark/2026-09-21T05-14-05-115Z/VA-001-16k.wav';
const clipSha = '2107ecb69e0dedd465f4fc478430693fff78a8b59d2918e176d32d127a7856d4';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const normalize = text => text.toLowerCase().replace(/[^a-z\s]/g, '').trim().replace(/\s+/g, ' ');

async function main(args) {
  if (args.length === 0) {
    console.log('Use --check for read-only preflight, or --run for one explicit synthetic file-transcription smoke.');
    return;
  }
  if (args.length !== 1 || !['--check', '--run'].includes(args[0])) throw new Error('INVALID_ARGUMENTS');
  const run = args[0] === '--run';
  if (run) {
    try { await fs.access(receiptFile); throw new Error('RECEIPT_ALREADY_EXISTS'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  const absoluteClip = path.resolve(root, clipFile);
  if ((await fs.realpath(absoluteClip)).toLowerCase() !== absoluteClip.toLowerCase()) throw new Error('INPUT_PATH_LINK');
  const input = await fs.readFile(absoluteClip);
  if (hash(input) !== clipSha) throw new Error('INPUT_HASH_MISMATCH');
  const engine = createLocalRecognition();
  const report = {
    schemaVersion: 1, startedAt: new Date().toISOString(),
    classification: 'LOCAL_COMPONENT_SMOKE_SYNTHETIC_INPUT', mode: 'COLD_FILE_TRANSCRIPTION_ONLY',
    status: 'PREFLIGHT', nativeInference: 'NOT_PERFORMED',
    clip: { file: clipFile, sha256: clipSha, referenceText: 'Heard you.', durationSeconds: 1.6595 },
    microphoneCapture: false, speakerPlayback: false, listenerStarted: false,
    gameTests: 'NOT_PERFORMED', uiIntegration: 'NOT_PERFORMED', humanRecognitionAcceptance: 'NOT_PERFORMED',
    paidApiCalls: 0, networkCalls: 0,
    limits: ['One existing synthetic clip is only an adapter smoke, not a recognition benchmark.',
      'The 1.5-second end-to-end transcription requirement is unchanged and unaccepted.',
      'No transcript is parsed as a command, trusted as human input, or sent to the game.',
      'RAM sampling is reactive; it cannot guarantee uninterrupted reserve.'],
    availableRamAtStart: os.freemem(), minSampledAvailableRam: os.freemem(), sourceHashes: []
  };
  for (const file of ['companion/local-recognition.mjs', 'companion/models.lock.json',
    'companion/whisper-runtime-pins.json', 'scripts/Exercise-LocalRecognition.mjs']) {
    report.sourceHashes.push({ file, sha256: hash(await fs.readFile(path.join(root, file))) });
  }
  let timer = null;
  const controller = new AbortController();
  try {
    report.preflight = await engine.start();
    if (run) {
      timer = setInterval(() => {
        const free = os.freemem();
        report.minSampledAvailableRam = Math.min(report.minSampledAvailableRam, free);
        if (free < 2 * 1024 ** 3) { report.resourceAbort = 'RAM_RESERVE_LOST'; controller.abort(); }
      }, 250);
      report.nativeInference = 'REQUESTED';
      report.result = await engine.transcribe(input, { signal: controller.signal });
      report.nativeInference = 'PERFORMED_CPU_ONLY';
      report.referenceMatched = normalize(report.result.text) === 'heard you';
      report.status = report.referenceMatched ? 'PASS_ADAPTER_SMOKE_ONLY' : 'TRANSCRIPT_MISMATCH';
    } else report.status = 'PREFLIGHT_PASS_NO_INFERENCE';
  } catch (error) {
    report.status = 'FAILED_OR_BLOCKED';
    report.error = /^[A-Z0-9_]{1,96}$/.test(error.code || '') ? error.code : 'LOCAL_RECOGNITION_FAILED';
  } finally {
    if (timer !== null) clearInterval(timer);
    try { report.disposal = await engine.dispose(); }
    catch { report.status = 'FAILED_OR_BLOCKED'; report.disposal = { status: 'UNCONFIRMED' }; }
    report.finalState = engine.status();
    report.completedAt = new Date().toISOString();
    report.availableRamAtEnd = os.freemem();
    if (run) await fs.writeFile(receiptFile, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  }
  console.log(JSON.stringify({ status: report.status, error: report.error,
    nativeInference: report.nativeInference, referenceMatched: report.referenceMatched,
    elapsedMs: report.result?.elapsedMs, disposal: report.disposal,
    receipt: run ? 'research/LOCAL_RECOGNITION_COMPONENT_SMOKE.json' : null }));
  if (!report.status.startsWith('PASS_') && !report.status.startsWith('PREFLIGHT_PASS')) process.exitCode = 1;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main(process.argv.slice(2));
}
