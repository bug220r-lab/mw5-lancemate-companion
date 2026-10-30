// Read-only preparation checks. No process, model, listener, device or download.
import path from 'node:path';
import { open, lstat, realpath, statfs, readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import bootstrap from './runtime-bootstrap-pins.json' with { type: 'json' };
import models from './models.lock.json' with { type: 'json' };
import llama from './llama-runtime-pins.json' with { type: 'json' };
import whisper from './whisper-runtime-pins.json' with { type: 'json' };
import kokoro from './kokoro.lock.json' with { type: 'json' };
import { SOURCE_ROOT, RUNTIME_ROOT, RUNTIME_CONFIGURED, requireRuntimeConfiguration, resolveRuntimeRoot, verifyRuntimeDirectory, runtimeInventoryPath } from './runtime-paths.mjs';

const GiB = 1024 ** 3;
const same = (a, b) => process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
const fail = code => { throw Object.assign(new Error(code), { code }); };
export function runtimePreparationFiles() {
  return [
    { path: 'node/node.exe', bytes: bootstrap.node.bytes, sha256: bootstrap.node.sha256 },
    ...bootstrap.python.files.map(p => ({ path: `python/${p.name}`, bytes: p.bytes, sha256: p.sha256 })),
    ...models.artifacts.filter(p => ['qwen1_7b', 'whisper-base-en', 'llama-cpu', 'whisper-cpu'].includes(p.id))
      .map(p => ({ path: `models/${p.name}`, bytes: p.bytes, sha256: p.sha256 })),
    ...llama.files.map(p => ({ path: `runtimes/llama-cpu-b11065/${p.name}`, bytes: p.bytes, sha256: p.sha256 })),
    ...whisper.files.map(p => ({ path: `runtimes/whisper-cpu-b5130/Release/${p.name}`, bytes: p.bytes, sha256: p.sha256 })),
    ...kokoro.assets.map(p => ({ path: `tts/${p.file}`, bytes: p.size, sha256: p.sha256 })),
  ];
}

export async function verifyPinnedRuntimeFile(root, pin) {
  if (!pin || typeof pin.path !== 'string' || pin.path.split(/[\\/]/).some(p => !p || p === '.' || p === '..') ||
      path.isAbsolute(pin.path) || !Number.isSafeInteger(pin.bytes) || pin.bytes < 0 || !/^[a-f0-9]{64}$/.test(pin.sha256 ?? ''))
    fail('INVALID_RUNTIME_PIN');
  const file = path.resolve(root, pin.path), relative = path.relative(root, file);
  if (relative.startsWith('..') || path.isAbsolute(relative)) fail('INVALID_RUNTIME_PIN');
  const before = await lstat(file);
  if (!before.isFile() || before.isSymbolicLink() || before.size !== pin.bytes || !same(await realpath(file), file))
    fail('RUNTIME_FILE_REJECTED');
  const handle = await open(file, 'r');
  try {
    const opened = await handle.stat();
    const identity = s => `${s.dev}/${s.ino}/${s.size}/${s.mtimeMs}`;
    if (!opened.isFile() || identity(opened) !== identity(before)) fail('RUNTIME_FILE_CHANGED');
    const hash = createHash('sha256'), buffer = Buffer.alloc(Math.min(pin.bytes + 1, 1024 * 1024)); let count = 0;
    for (;;) {
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, count);
      if (!bytesRead) break;
      count += bytesRead; if (count > pin.bytes) fail('RUNTIME_FILE_CHANGED');
      hash.update(buffer.subarray(0, bytesRead));
    }
    const after = await lstat(file);
    if (count !== pin.bytes || identity(await handle.stat()) !== identity(opened) || identity(after) !== identity(before) ||
        after.isSymbolicLink() || !same(await realpath(file), file)) fail('RUNTIME_FILE_CHANGED');
    if (hash.digest('hex') !== pin.sha256) fail('RUNTIME_HASH_MISMATCH');
    return { path: pin.path, bytes: pin.bytes, status: 'PINNED_FILE_VERIFIED' };
  } finally { await handle.close(); }
}

export async function verifyRuntimeInventory(root) {
  const file = path.join(root, 'runtimes/runtime-files.json'), stat = await lstat(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 1024 * 1024 || !same(await realpath(file), file))
    fail('RUNTIME_INVENTORY_REJECTED');
  const handle = await open(file, 'r');
  let bytes;
  try {
    const buffer = Buffer.alloc(1024 * 1024 + 1), read = await handle.read(buffer, 0, buffer.length, 0);
    if (read.bytesRead !== stat.size) fail('RUNTIME_INVENTORY_REJECTED');
    bytes = buffer.subarray(0, read.bytesRead);
  } finally { await handle.close(); }
  const manifest = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^\uFEFF/, ''));
  const expected = new Map([
    ...llama.files.map(p => [`runtimes/llama-cpu-b11065/${p.name}`, { ...p, artifact: 'llama-cpu' }]),
    ...whisper.files.map(p => [`runtimes/whisper-cpu-b5130/Release/${p.name}`, { ...p, artifact: 'whisper-cpu' }]),
  ]);
  if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.files) || manifest.files.length !== expected.size)
    fail('RUNTIME_INVENTORY_PIN_MISMATCH');
  const seen = new Set();
  for (const entry of manifest.files) {
    const target = runtimeInventoryPath(entry.path, root), relative = path.relative(root, target).split(path.sep).join('/');
    const pin = expected.get(relative);
    if (!pin || seen.has(relative) || pin.artifact !== entry.artifact || pin.bytes !== entry.bytes || pin.sha256 !== entry.sha256)
      fail('RUNTIME_INVENTORY_PIN_MISMATCH');
    seen.add(relative);
  }
  return { status: 'SOURCE_PINNED_INVENTORY_VERIFIED', files: seen.size };
}

export async function verifyPinnedVenvInventory(root, pin) {
  if (!pin || pin.path !== 'tts/manifests/venv-files.json' || !Number.isInteger(pin.fileCount) ||
      pin.fileCount < 1 || pin.fileCount > 30000 || pin.bytes > 16 * 1024 * 1024) fail('VENV_SOURCE_PIN_INVALID');
  await verifyPinnedRuntimeFile(root, pin);
  const bytes = await readFile(path.join(root, pin.path));
  if (bytes.length !== pin.bytes || createHash('sha256').update(bytes).digest('hex') !== pin.sha256) fail('VENV_INVENTORY_CHANGED');
  const inventory = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  if (inventory.schemaVersion !== 1 || !Array.isArray(inventory.files) || inventory.files.length !== pin.fileCount)
    fail('VENV_INVENTORY_REJECTED');
  const expected = new Map(), directories = new Set(['tts/venv']);
  for (const file of inventory.files) {
    if (typeof file.path !== 'string' || !file.path.startsWith('tts/venv/') || file.path.includes('\\') ||
        file.path.split('/').some(p => !p || p === '.' || p === '..') || expected.has(file.path.toLowerCase()))
      fail('VENV_INVENTORY_REJECTED');
    expected.set(file.path.toLowerCase(), file);
    let directory = path.posix.dirname(file.path);
    while (directory !== 'tts/venv') { directories.add(directory); directory = path.posix.dirname(directory); }
  }
  const seen = new Set(); let count = 0;
  await verifyRuntimeDirectory(path.join(root, 'tts/venv'));
  async function visit(relative) {
    for (const entry of await readdir(path.join(root, relative), { withFileTypes: true })) {
      if (++count > expected.size + directories.size + 32 || entry.isSymbolicLink()) fail('VENV_UNEXPECTED_ENTRY');
      const name = relative + '/' + entry.name;
      if (entry.isDirectory()) {
        // Empty pip/venv-created directories carry no executable content.
        const directory = path.join(root, name), stat = await lstat(directory);
        if (!stat.isDirectory() || stat.isSymbolicLink() || !same(await realpath(directory), directory)) fail('VENV_UNEXPECTED_ENTRY');
        await visit(name);
      } else {
        if (!entry.isFile() || !expected.has(name.toLowerCase()) || seen.has(name.toLowerCase())) fail('VENV_UNEXPECTED_ENTRY');
        seen.add(name.toLowerCase());
      }
    }
  }
  await visit('tts/venv');
  if (seen.size !== expected.size) fail('VENV_FILE_MISSING');
  for (const file of inventory.files) await verifyPinnedRuntimeFile(root, file);
  return { status: 'SOURCE_BOUND_VENV_FILES_VERIFIED', files: seen.size };
}

export async function verifySpeechPreparation(runtimeRoot = requireRuntimeConfiguration()) {
  await verifyRuntimeDirectory(runtimeRoot);
  for (const relative of ['tts/tmp', 'tts/hf-cache', 'speech-output'])
    await verifyRuntimeDirectory(path.join(runtimeRoot, relative));
  const pins = bootstrap.ttsEnvironment;
  if (!pins || pins.status !== 'LOCKED_OFFLINE_ENVIRONMENT_PINNED') fail('TTS_ENVIRONMENT_NOT_PINNED');
  for (const pin of bootstrap.python.files)
    await verifyPinnedRuntimeFile(runtimeRoot, { path: `python/${pin.name}`, bytes: pin.bytes, sha256: pin.sha256 });
  await verifyPinnedRuntimeFile(runtimeRoot, { path: 'tts/venv/Scripts/python.exe', ...pins.interpreter });
  await verifyPinnedRuntimeFile(SOURCE_ROOT, { path: 'scripts/Kokoro-Worker.py', ...pins.worker });
  const inventory = await verifyPinnedVenvInventory(runtimeRoot, pins.inventory);
  const settings = new Map();
  for (const line of (await readFile(path.join(runtimeRoot, 'tts/venv/pyvenv.cfg'), 'utf8')).split(/\r?\n/).filter(Boolean)) {
    const match = line.match(/^([^=]+?) = (.*)$/);
    if (!match || settings.has(match[1])) fail('TTS_VENV_CONFIGURATION_REJECTED');
    settings.set(match[1], match[2]);
  }
  if (!same(settings.get('home') ?? '', path.join(runtimeRoot, 'python')) ||
      !same(settings.get('executable') ?? '', path.join(runtimeRoot, 'python/python.exe')) ||
      settings.get('include-system-site-packages') !== 'false' || settings.get('version') !== bootstrap.python.version)
    fail('TTS_VENV_CONFIGURATION_REJECTED');
  return { ...inventory, interpreter: 'PINNED', worker: 'PINNED', configuration: 'INDEPENDENT_RUNTIME', inference: 'NOT_PERFORMED' };
}

export async function inspectRuntimeReadiness({ runtimeRoot = RUNTIME_ROOT, configured = RUNTIME_CONFIGURED } = {}) {
  const report = { classification: 'STATIC_RUNTIME_READINESS_ONLY', runtimeRoot, configured,
    status: 'NOT_READY', files: [], issues: [], workersStarted: 0, inference: 'NOT_PERFORMED',
    abiExecution: 'NOT_PERFORMED', installation: 'NOT_PERFORMED', environmentAcceptance: 'NOT_PERFORMED' };
  if (!configured) { report.issues.push('RUNTIME_ROOT_NOT_CONFIGURED'); return report; }
  try { resolveRuntimeRoot(runtimeRoot); await verifyRuntimeDirectory(runtimeRoot); }
  catch (error) { report.issues.push(error.code ?? 'RUNTIME_ROOT_UNAVAILABLE'); return report; }
  const disk = await statfs(runtimeRoot);
  report.availableDiskBytes = Number(disk.bavail) * Number(disk.bsize);
  if (!Number.isSafeInteger(report.availableDiskBytes) || report.availableDiskBytes < 10 * GiB)
    report.issues.push('RUNTIME_DISK_RESERVE');
  for (const pin of runtimePreparationFiles()) {
    try { report.files.push(await verifyPinnedRuntimeFile(runtimeRoot, pin)); }
    catch (error) { report.files.push({ path: pin.path, status: error.code ?? 'RUNTIME_FILE_REJECTED' }); }
  }
  if (report.files.some(file => file.status !== 'PINNED_FILE_VERIFIED')) report.issues.push('RUNTIME_INPUTS_UNVERIFIED');
  try { report.runtimeInventory = await verifyRuntimeInventory(runtimeRoot); }
  catch (error) { report.issues.push(`RUNTIME_INVENTORY:${error.code ?? 'INVALID_JSON'}`); }
  for (const relative of ['tts/venv/Scripts/python.exe', 'tts/venv/pyvenv.cfg', 'tts/manifests/installed.json', 'tts/manifests/install-receipt.json']) {
    try {
      const file = path.join(runtimeRoot, relative), stat = await lstat(file);
      if (!stat.isFile() || stat.isSymbolicLink() || !same(await realpath(file), file)) fail('RUNTIME_FILE_REJECTED');
    } catch { report.issues.push(`ENVIRONMENT_MISSING_OR_REDIRECTED:${relative}`); }
  }
  if (!report.issues.length) {
    try {
      report.environmentVerification = await verifySpeechPreparation(runtimeRoot);
      report.status = 'PINNED_INPUTS_AND_ENVIRONMENT_FILES_VERIFIED';
    } catch (error) { report.issues.push(error.code ?? 'TTS_ENVIRONMENT_REJECTED'); }
  }
  // These checks do not repeat setup ABI checks or certify model/audio behavior.
  return report;
}
