// Project-owned bounded local conversion. No inference, download or activation.
import fs from 'node:fs/promises';
import { createReadStream, createWriteStream, statfsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { finished } from 'node:stream/promises';
import os from 'node:os';
import runtimePins from '../companion/llama-runtime-pins.json' with { type: 'json' };

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const models = path.join(root, 'companion/local/models');
const runtime = path.join(root, 'companion/local/runtimes/llama-cpu-b11065');
const executable = path.join(runtime, 'llama-quantize.exe');
const input = path.join(models, 'Qwen3-1.7B-Q8_0.gguf');
const output = path.join(models, 'Qwen3-1.7B-from-Q8_0-Q4_K_M.gguf');
const partial = output + '.partial';
const receiptPath = path.join(root, 'research/QWEN_REQUANTIZATION_RECEIPT.json');
const OUTPUT_CAP = 1.5 * 1024 ** 3, OVERHEAD = 64 * 1024 ** 2;
const ALLOCATION = OUTPUT_CAP + OVERHEAD, RESERVE = 10 * 1024 ** 3;
const TIME_LIMIT_MS = 10 * 60 * 1000, LOG_LIMIT = 8 * 1024 ** 2;
const INPUT_SHA = '061b54daade076b5d3362dac252678d17da8c68f07560be70818cace6590cb1a';
const ARCHIVE_SHA = '33f941a74b8db38e92690f5f151a770ef5a66481c07dabfe2e505b57e3546807';
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const runDirectory = path.join(root, 'companion/local/quantization', runId);
const logFile = path.join(runDirectory, 'quantizer.log');
const report = { schemaVersion: 1, classification: 'LOCAL_DERIVED_MODEL_CONVERSION_ONLY',
  runId, startedAt: new Date().toISOString(), status: 'PREFLIGHT',
  noDownloads: true, inferencePerformed: false, adapterChanged: false, modelEnabled: false,
  gameExecution: false, microphoneCapture: false, speakerPlayback: false,
  constraints: { outputCapBytes: OUTPUT_CAP, overheadBytes: OVERHEAD, allocationBytes: ALLOCATION,
    freeReserveBytes: RESERVE, timeLimitMs: TIME_LIMIT_MS, threads: 2, tensorRowBufferMiB: 256,
    guardPollingMs: 250, reserveSafetyMarginBytes: OVERHEAD },
  qualityAcceptance: 'NOT_PERFORMED', latencyAcceptance: 'NOT_PERFORMED', ownedProcessStopped: true };
let owned = null, stopped = false, stopReason = null, monitor = null, timer = null, log;
let rejectRunning = null, forceTimer = null, stopDeadline = null, ownsPartial = false;
let logBytes = 0, minimumFree = Infinity, minimumAvailableRam = os.freemem(), maximumOutput = 0;
const relative = f => path.relative(root, f).replaceAll('\\', '/');
async function sha(file) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}
function freeBytes() { const stats = statfsSync(models); return stats.bavail * stats.bsize; }
async function absent(file) {
  try { await fs.lstat(file); throw Error(`REFUSE_OVERWRITE: ${relative(file)}`); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
}
async function verify(file, expectedSize, expectedHash) {
  const stat = await fs.lstat(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== expectedSize) throw Error('PINNED_FILE_SIZE_OR_TYPE_MISMATCH');
  const canonical = await fs.realpath(file);
  if (canonical.toLowerCase() !== file.toLowerCase()) throw Error('PINNED_FILE_REPARSE_POINT');
  if (await sha(file) !== expectedHash) throw Error('PINNED_FILE_HASH_MISMATCH');
  return { file: relative(file), bytes: stat.size, sha256: expectedHash };
}
function halt(reason) {
  if (stopReason) return;
  stopReason = reason;
  if (owned && !stopped) {
    owned.kill();
    forceTimer = setTimeout(() => { if (!stopped) owned.kill('SIGKILL'); }, 1000);
    stopDeadline = setTimeout(() => { if (!stopped) rejectRunning?.(Error('PROCESS_STOP_UNCONFIRMED')); }, 3000);
  }
}
async function diskGuard() {
  minimumAvailableRam = Math.min(minimumAvailableRam, os.freemem());
  const free = freeBytes(); minimumFree = Math.min(minimumFree, free);
  const stat = await fs.stat(partial).catch(e => { if (e.code === 'ENOENT') return { size: 0 }; throw e; });
  maximumOutput = Math.max(maximumOutput, stat.size);
  if (free < RESERVE + OVERHEAD) halt('FREE_SPACE_RESERVE_GUARD');
  if (stat.size > OUTPUT_CAP || stat.size + logBytes > ALLOCATION) halt('ALLOCATION_GUARD');
}
try {
  await absent(output); await absent(partial); await absent(receiptPath);
  const canonicalModels = await fs.realpath(models);
  if (canonicalModels.toLowerCase() !== models.toLowerCase()) throw Error('MODEL_DIRECTORY_REPARSE_POINT');
  report.freeBytesBefore = freeBytes(); minimumFree = report.freeBytesBefore;
  if (report.freeBytesBefore < RESERVE + ALLOCATION) throw Error('INSUFFICIENT_RESERVED_SPACE');
  report.sourceScriptSha256 = await sha(fileURLToPath(import.meta.url));
  report.runtimePinsSha256 = await sha(path.join(root, 'companion/llama-runtime-pins.json'));
  report.input = await verify(input, 1834426016, INPUT_SHA);
  report.archive = await verify(path.join(models, 'llama-b11065-bin-win-cpu-x64.zip'), 18466663, ARCHIVE_SHA);
  if (runtimePins.archiveSha256 !== ARCHIVE_SHA) throw Error('RUNTIME_PIN_MANIFEST_MISMATCH');
  report.runtimeFiles = [];
  for (const file of runtimePins.files) report.runtimeFiles.push(await verify(path.join(runtime, file.name), file.bytes, file.sha256));
  const entries = await fs.readdir(runtime);
  if (entries.length !== runtimePins.files.length || entries.some(name => !runtimePins.files.some(f => f.name === name))) throw Error('RUNTIME_INVENTORY_MISMATCH');
  await fs.mkdir(runDirectory, { recursive: true });
  await fs.mkdir(path.join(runDirectory, 'tmp'));
  // Reserve ownership exclusively before the quantizer opens/truncates its file.
  const reservation = await fs.open(partial, 'wx'); await reservation.close(); ownsPartial = true;
  log = createWriteStream(logFile, { flags: 'wx' });
  const args = ['--allow-requantize', '--leave-output-tensor', '--max-buffer-size', '256', input, partial, 'Q4_K_M', '2'];
  report.arguments = args; report.executable = relative(executable); report.status = 'CONVERTING';
  report.conversionStartedAt = new Date().toISOString();
  const began = performance.now();
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^(LLAMA_ARG_|GGML_RPC|HF_|HTTPS?_PROXY|ALL_PROXY)/i.test(key)));
  env.TEMP = path.join(runDirectory, 'tmp'); env.TMP = env.TEMP;
  const outcome = await new Promise((resolve, reject) => {
    rejectRunning = reject;
    try { owned = spawn(executable, args, { cwd: runtime, windowsHide: true, shell: false, env, stdio: ['ignore', 'pipe', 'pipe'] }); }
    catch (error) { reject(error); return; }
    report.ownedPid = owned.pid ?? null; report.ownedProcessStopped = false;
    const append = chunk => {
      logBytes += chunk.length;
      if (logBytes > LOG_LIMIT) { halt('LOG_LIMIT'); return; }
      log.write(chunk);
    };
    owned.stdout.on('data', append); owned.stderr.on('data', append);
    owned.once('error', error => { stopReason ??= 'PROCESS_ERROR'; reject(error); });
    owned.once('close', (code, signal) => { stopped = true; report.ownedProcessStopped = true; resolve({ code, signal }); });
    log.once('error', () => halt('LOG_WRITE_ERROR'));
    let guardRunning = false;
    monitor = setInterval(() => {
      if (guardRunning) return;
      guardRunning = true; void diskGuard().catch(() => halt('DISK_GUARD_ERROR')).finally(() => { guardRunning = false; });
    }, 250);
    // Leave both the three-second halt grace and final closure check in budget.
    timer = setTimeout(() => halt('TIME_LIMIT'), TIME_LIMIT_MS - 6000);
  });
  clearInterval(monitor); clearTimeout(timer); clearTimeout(forceTimer); clearTimeout(stopDeadline); log.end(); await finished(log);
  report.conversionMs = performance.now() - began; report.exitCode = outcome.code; report.exitSignal = outcome.signal;
  await diskGuard();
  if (stopReason || outcome.code !== 0) throw Error(stopReason || 'QUANTIZER_NONZERO_EXIT');
  const info = await fs.stat(partial);
  if (info.size < 1024 ** 2 || info.size > OUTPUT_CAP) throw Error('CANDIDATE_SIZE_OUT_OF_BOUNDS');
  const handle = await fs.open(partial, 'r'); const header = Buffer.alloc(8);
  try { await handle.read(header, 0, 8, 0); } finally { await handle.close(); }
  if (header.toString('ascii', 0, 4) !== 'GGUF' || header.readUInt32LE(4) !== 3) throw Error('CANDIDATE_HEADER_INVALID');
  const outputHash = await sha(partial);
  // The source model remains byte-for-byte unchanged.
  await verify(input, report.input.bytes, INPUT_SHA);
  await absent(output); await fs.rename(partial, output);
  report.output = { file: relative(output), bytes: info.size, sha256: outputHash,
    origin: 'LOCALLY_REQUANTIZED_FROM_PINNED_Q8_0', quantization: 'Q4_K_M', ggufVersion: 3 };
  report.status = 'PASS_CONVERSION_ONLY_CANDIDATE_NOT_ENABLED';
} catch (error) {
  report.status = 'FAILED_CONVERSION_OR_PREFLIGHT'; report.error = String(error); halt('SUPERVISOR_FAILURE');
} finally {
  clearInterval(monitor); clearTimeout(timer); clearTimeout(forceTimer); clearTimeout(stopDeadline);
  if (owned && !stopped) {
    owned.kill('SIGKILL');
    await Promise.race([new Promise(resolve => owned.once('close', resolve)), new Promise(resolve => setTimeout(resolve, 3000))]);
    report.ownedProcessStopped = stopped;
  }
  if (!report.ownedProcessStopped) { report.status = 'PROCESS_STOP_UNCONFIRMED'; report.error = 'Owned process did not confirm closure.'; }
  if (log && !log.writableEnded) { log.end(); await finished(log).catch(() => {}); }
  report.stopReason = stopReason; report.minimumFreeBytesObserved = Number.isFinite(minimumFree) ? minimumFree : null;
  report.minimumAvailableRamBytesObserved = minimumAvailableRam;
  report.maximumPartialBytesObserved = maximumOutput; report.freeBytesAfter = freeBytes();
  report.completedAt = new Date().toISOString();
  if (report.status !== 'PASS_CONVERSION_ONLY_CANDIDATE_NOT_ENABLED' && report.ownedProcessStopped) {
    // Never recursively delete. Only the exact, newly owned unfinished filename.
    if (path.dirname(partial) === models && partial === output + '.partial' && ownsPartial) {
      await fs.unlink(partial).catch(error => { if (error.code !== 'ENOENT') report.partialCleanupError = error.code; });
    }
  }
  try { report.log = { file: relative(logFile), bytes: (await fs.stat(logFile)).size, sha256: await sha(logFile) }; } catch {}
  // A receipt from a previous run must never be overwritten.
  await fs.writeFile(receiptPath, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ status: report.status, output: report.output, error: report.error,
    ownedProcessStopped: report.ownedProcessStopped, receipt: relative(receiptPath) }));
}
if (report.status !== 'PASS_CONVERSION_ONLY_CANDIDATE_NOT_ENABLED') process.exitCode = 1;
