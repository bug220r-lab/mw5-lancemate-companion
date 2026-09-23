// Preparation/guard checks only. Never builds or imports an actual restored app.
import test from 'node:test';
import assert from 'node:assert/strict';
import childProcess, { spawn as namedSpawn } from 'node:child_process';
import http from 'node:http';
import net from 'node:net';
import workerThreads from 'node:worker_threads';
import { lstat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseRestoreArguments, assertRestoreRelativePath, installRestoreOperationGuards,
  verifyWorkbenchRestore, writeRestoreReceiptBytes, RESTORE_RECEIPT } from '../../scripts/Verify-WorkbenchRestore.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
async function identity(file) {
  try { const stat = await lstat(file); return { size: stat.size, mtime: stat.mtimeMs, ino: stat.ino }; }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

test('restore CLI admits only fixed plan/run selectors', () => {
  assert.equal(parseRestoreArguments(['--check']), '--check');
  assert.equal(parseRestoreArguments(['--run']), '--run');
  for (const args of [[], ['--run', '--force'], ['--run', 'C:\\target'], ['--run-attempt-2'], '--run', null])
    assert.throws(() => parseRestoreArguments(args), /USE_CHECK_OR_RUN_ONLY/);
});

test('restore receipt paths reject escape, alternate separators, streams and Windows aliases', () => {
  assert.equal(assertRestoreRelativePath('companion/local/settings.json'), 'companion/local/settings.json');
  for (const value of ['', '../outside', '/outside', 'a//b', 'a/../b', 'C:/outside', 'a\\b',
    'a:stream', 'a/CON.txt', 'a/nul', 'a/file.', 'a/file ', null])
    assert.throws(() => assertRestoreRelativePath(value), /UNSAFE_RESTORE_PATH/);
});

test('restore guards deny actual known process, network, listener and worker entrypoints before work', () => {
  const originals = { spawn: childProcess.spawn, request: http.request, create: net.createServer,
    fetch: globalThis.fetch, worker: workerThreads.Worker };
  const guard = installRestoreOperationGuards();
  try {
    assert.throws(() => namedSpawn('this-must-never-be-executed'), /FORBIDDEN_RESTORE_OPERATION/);
    assert.throws(() => http.request('http://127.0.0.1:1'), /FORBIDDEN_RESTORE_OPERATION/);
    assert.throws(() => net.createServer(), /FORBIDDEN_RESTORE_OPERATION/);
    assert.throws(() => globalThis.fetch('https://example.invalid/'), /FORBIDDEN_RESTORE_OPERATION/);
    assert.throws(() => new workerThreads.Worker('this-must-never-be-loaded'), /FORBIDDEN_RESTORE_OPERATION/);
    assert.deepEqual(guard.attempts, ['child_process.spawn', 'http.request', 'net.createServer', 'global.fetch', 'worker_threads.Worker']);
  } finally { guard.restore(); }
  assert.equal(childProcess.spawn, originals.spawn); assert.equal(namedSpawn, originals.spawn);
  assert.equal(http.request, originals.request); assert.equal(net.createServer, originals.create);
  assert.equal(globalThis.fetch, originals.fetch); assert.equal(workerThreads.Worker, originals.worker);
});

test('restore guard cleanup restores original entrypoints after a thrown smoke assertion', () => {
  const original = childProcess.execFile, guard = installRestoreOperationGuards();
  assert.throws(() => {
    try { throw new Error('SYNTHETIC_RESTORE_FAILURE'); }
    finally { guard.restore(); }
  }, /SYNTHETIC_RESTORE_FAILURE/);
  assert.equal(childProcess.execFile, original); assert.deepEqual(guard.attempts, []);
  guard.restore(); assert.equal(childProcess.execFile, original);
});

test('restore receipt writer completes partial writes with explicit buffer and file offsets before sync', async () => {
  const bytes = Buffer.from('{"complete":true}\n'), output = Buffer.alloc(bytes.length), calls = [];
  let synced = false;
  const handle = {
    async truncate(length) { calls.push(['truncate', length]); },
    async write(buffer, offset, length, position) {
      assert.equal(buffer, bytes); assert.equal(position, offset); assert.equal(length, bytes.length - offset);
      const bytesWritten = Math.min(3, length);
      buffer.copy(output, position, offset, offset + bytesWritten);
      calls.push(['write', offset, length, position, bytesWritten]); return { bytesWritten };
    },
    async sync() { assert.deepEqual(output, bytes); synced = true; calls.push(['sync']); }
  };
  await writeRestoreReceiptBytes(handle, bytes);
  assert.equal(synced, true); assert.deepEqual(calls[0], ['truncate', 0]);
  assert.ok(calls.filter(item => item[0] === 'write').length > 1);
  assert.deepEqual(calls.at(-1), ['sync']);
});

test('restore receipt writer refuses stalled or impossible progress without looping or claiming sync', async () => {
  for (const bytesWritten of [0, -1, 0.5, 99, undefined]) {
    let writes = 0, synced = false;
    const handle = { async truncate() {}, async write() { writes++; return { bytesWritten }; }, async sync() { synced = true; } };
    await assert.rejects(writeRestoreReceiptBytes(handle, Buffer.from('{}\n')), /RESTORE_RECEIPT_WRITE_NO_VALID_PROGRESS/);
    assert.equal(writes, 1); assert.equal(synced, false);
  }
});

test('plan-only preparation pins the full source allowlist without reserving a native or restore receipt', async () => {
  const file = path.join(root, RESTORE_RECEIPT), before = await identity(file);
  const result = await verifyWorkbenchRestore(['--check']);
  assert.equal(result.status, 'PLAN_ONLY_NOT_RUN'); assert.equal(result.writesPerformed, false);
  assert.equal(result.diskAndReceiptAvailability, 'NOT_CHECKED_UNTIL_RUN');
  assert.equal(result.originalSettingsAccess, 'HASH_ONLY_ON_RUN_NO_CONTENT_LOGGING');
  assert.equal(result.models, 'NOT_PERFORMED'); assert.equal(result.nativeOrGame, 'NOT_PERFORMED');
  assert.equal(result.browser, 'NOT_PERFORMED'); assert.equal(result.http, 'NOT_PERFORMED');
  for (const expected of ['companion/server.mjs', 'companion/personas.json', 'scripts/tactical-policy.mjs',
    'synthetic/tactical-cases.mjs', 'scripts/Kokoro-Worker.py', 'design/WORKBENCH_PACKAGE_README.md'])
    assert.ok(result.sources.some(item => item.file === expected && /^[a-f0-9]{64}$/.test(item.sha256)));
  assert.ok(result.sources.every(item => !item.file.includes('companion/local/')));
  assert.equal(result.sources.length, 31);
  assert.deepEqual(await identity(file), before);
});
