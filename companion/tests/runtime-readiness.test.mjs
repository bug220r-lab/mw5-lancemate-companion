// Read-only runtime verification and temporary fixture files; no workers/inference.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import { mkdtemp, writeFile, rm, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { SOURCE_ROOT, resolveRuntimeRoot, verifyRuntimeDirectory, runtimeInventoryPath } from '../runtime-paths.mjs';
import { runtimePreparationFiles, verifyPinnedRuntimeFile, inspectRuntimeReadiness, verifyRuntimeInventory, verifyPinnedVenvInventory } from '../runtime-readiness.mjs';
import llama from '../llama-runtime-pins.json' with { type: 'json' };
import whisper from '../whisper-runtime-pins.json' with { type: 'json' };
import { createLocalRecognition } from '../local-recognition.mjs';
import { createResidentRecognition } from '../resident-recognition.mjs';

const candidate = path.resolve(os.tmpdir(), 'mw5-configured-runtime');
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
test('operator root is explicit, local and separate from source and preserved caches', () => {
  assert.equal(resolveRuntimeRoot(candidate), candidate);
  assert.equal(resolveRuntimeRoot(undefined), path.join(SOURCE_ROOT, 'companion/local'));
  for (const value of ['', 'relative', ` ${candidate}`, '\\\\MSI\\ProjectLibrary\\runtime', '//MSI/runtime',
    path.parse(candidate).root, SOURCE_ROOT, path.join(SOURCE_ROOT, 'runtime'), path.dirname(SOURCE_ROOT),
    path.join(os.tmpdir(), 'LibraryCache', 'runtime'), path.join(os.tmpdir(), '.handoff', 'runtime'),
    path.join(os.tmpdir(), 'codex-runtimes', 'runtime')])
    assert.throws(() => resolveRuntimeRoot(value), /RUNTIME_ROOT_/);
});

test('historical inventory paths map into the selected root without traversal', () => {
  assert.equal(runtimeInventoryPath('companion\\local\\runtimes\\llama-cpu-b11065\\llama-server.exe', candidate),
    path.join(candidate, 'runtimes/llama-cpu-b11065/llama-server.exe'));
  for (const value of ['models/file', '../outside', 'companion/local/../secret', 'companion/local//file',
    'companion/local/./file', '/companion/local/file', 'companion/local/'])
    assert.throws(() => runtimeInventoryPath(value, candidate), /RUNTIME_INVENTORY_PATH_INVALID/);
});

test('redirected root or ancestor rejects before a file operation', async () => {
  const directory = path.join(candidate, 'nested');
  const io = { lstat: async () => ({ isDirectory: () => true, isSymbolicLink: () => false }), realpath: async p => p };
  assert.equal(await verifyRuntimeDirectory(directory, io), directory);
  await assert.rejects(verifyRuntimeDirectory(directory, { ...io,
    realpath: async p => p === candidate ? path.join(os.tmpdir(), 'elsewhere') : p }), /RUNTIME_ROOT_REDIRECTED/);
  await assert.rejects(verifyRuntimeDirectory(directory, { ...io,
    lstat: async p => ({ isDirectory: () => true, isSymbolicLink: () => p === directory }) }), /RUNTIME_ROOT_REDIRECTED/);
});

test('source-reviewed preparation set keeps complete native inventories and exact pins', () => {
  const pins = runtimePreparationFiles();
  assert.equal(new Set(pins.map(p => p.path.toLowerCase())).size, pins.length);
  assert.equal(pins.filter(p => p.path.startsWith('runtimes/whisper-cpu-b5130/Release/')).length, 40);
  assert.ok(pins.some(p => p.path === 'models/Qwen3-1.7B-Q8_0.gguf'));
  assert.ok(pins.some(p => p.path === 'tts/models/kokoro-v1_0.pth'));
  assert.ok(pins.every(p => Number.isSafeInteger(p.bytes) && p.bytes > 0 && /^[a-f0-9]{64}$/.test(p.sha256)));
});

test('pinned bytes pass, same-size tampering and size drift fail', async t => {
  const folder = await mkdtemp(path.join(os.tmpdir(), 'mw5-runtime-readiness-'));
  t.after(async () => {
    assert.equal(path.dirname(path.resolve(folder)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(folder).startsWith('mw5-runtime-readiness-'));
    await rm(folder, { recursive: true });
  });
  const bytes = Buffer.from('reviewed fixture'), pin = { path: 'runtime.bin', bytes: bytes.length, sha256: digest(bytes) };
  await writeFile(path.join(folder, pin.path), bytes);
  assert.equal((await verifyPinnedRuntimeFile(folder, pin)).status, 'PINNED_FILE_VERIFIED');
  await writeFile(path.join(folder, pin.path), Buffer.alloc(bytes.length, 1));
  await assert.rejects(verifyPinnedRuntimeFile(folder, pin), /RUNTIME_HASH_MISMATCH/);
  await writeFile(path.join(folder, pin.path), 'short');
  await assert.rejects(verifyPinnedRuntimeFile(folder, pin), /RUNTIME_FILE_REJECTED/);
  await assert.rejects(verifyPinnedRuntimeFile(folder, { ...pin, path: '../escape' }), /INVALID_RUNTIME_PIN/);
});

test('missing/unconfigured runtime reports incomplete without inventing setup or worker acceptance', async () => {
  const missing = await inspectRuntimeReadiness({ runtimeRoot: path.join(candidate, 'absent'), configured: true });
  assert.equal(missing.status, 'NOT_READY'); assert.equal(missing.workersStarted, 0);
  assert.equal(missing.inference, 'NOT_PERFORMED'); assert.equal(missing.abiExecution, 'NOT_PERFORMED');
  const absent = await inspectRuntimeReadiness({ configured: false });
  assert.deepEqual(absent.issues, ['RUNTIME_ROOT_NOT_CONFIGURED']); assert.deepEqual(absent.files, []);
});

test('request-level ASR options cannot supply runtime or interpreter paths', () => {
  for (const options of [{ runtimeRoot: candidate }, { python: 'unreviewed.exe' }]) {
    assert.throws(() => createLocalRecognition(options), /INVALID_RECOGNITION_OPTIONS/);
    assert.throws(() => createResidentRecognition(options), /INVALID_RECOGNITION_OPTIONS/);
  }
});

test('required runtime inventory rejects absent metadata and forged runtime entries', async t => {
  const folder = await mkdtemp(path.join(os.tmpdir(), 'mw5-runtime-inventory-'));
  t.after(async () => { assert.equal(path.dirname(folder), path.resolve(os.tmpdir())); await rm(folder, { recursive: true }); });
  await assert.rejects(verifyRuntimeInventory(folder), { code: 'ENOENT' });
  await mkdir(path.join(folder, 'runtimes'));
  const manifest = { schemaVersion: 1, files: [
    ...llama.files.map(p => ({ artifact: 'llama-cpu', path: `companion/local/runtimes/llama-cpu-b11065/${p.name}`, bytes: p.bytes, sha256: p.sha256 })),
    ...whisper.files.map(p => ({ artifact: 'whisper-cpu', path: `companion/local/runtimes/whisper-cpu-b5130/Release/${p.name}`, bytes: p.bytes, sha256: p.sha256 })),
  ] };
  const file = path.join(folder, 'runtimes/runtime-files.json');
  await writeFile(file, JSON.stringify(manifest));
  assert.equal((await verifyRuntimeInventory(folder)).files, 91);
  manifest.files[0].sha256 = '0'.repeat(64); await writeFile(file, JSON.stringify(manifest));
  await assert.rejects(verifyRuntimeInventory(folder), /RUNTIME_INVENTORY_PIN_MISMATCH/);
});

test('source-bound venv inventory admits exact zero-byte files and rejects extra code or changed bytes', async t => {
  const folder = await mkdtemp(path.join(os.tmpdir(), 'mw5-venv-inventory-'));
  t.after(async () => { assert.equal(path.dirname(folder), path.resolve(os.tmpdir())); await rm(folder, { recursive: true }); });
  await mkdir(path.join(folder, 'tts/venv/Lib'), { recursive: true });
  await mkdir(path.join(folder, 'tts/manifests'));
  const files = [{ path: 'tts/venv/Lib/empty.py', bytes: 0, sha256: digest('') },
    { path: 'tts/venv/Lib/fixture.py', bytes: 4, sha256: digest('pass') }];
  await writeFile(path.join(folder, files[0].path), ''); await writeFile(path.join(folder, files[1].path), 'pass');
  const bytes = Buffer.from(JSON.stringify({ schemaVersion: 1, files }));
  const pin = { path: 'tts/manifests/venv-files.json', bytes: bytes.length, sha256: digest(bytes), fileCount: 2 };
  await writeFile(path.join(folder, pin.path), bytes);
  assert.equal((await verifyPinnedVenvInventory(folder, pin)).files, 2);
  const extra = path.join(folder, 'tts/venv/Lib/unreviewed.pth'); await writeFile(extra, 'import something');
  await assert.rejects(verifyPinnedVenvInventory(folder, pin), /VENV_UNEXPECTED_ENTRY/); await rm(extra);
  await writeFile(path.join(folder, files[1].path), 'evil');
  await assert.rejects(verifyPinnedVenvInventory(folder, pin), /RUNTIME_HASH_MISMATCH/);
});
