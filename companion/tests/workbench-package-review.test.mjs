// Independent OFFLINE_WORKBENCH_ONLY packaging review; synthetic temporary trees only.
// No app/model/native runtime, network, editor, game, browser or audio is executed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, readdir, lstat, realpath, rm, rename, symlink } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { buildWorkbenchPackage, verifyWorkbenchPackage, WORKBENCH_PACKAGE_FILES } from '../../scripts/Package-Workbench.mjs';

const workspace = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const manifestName = 'WORKBENCH_MANIFEST.json';
const contains = (base, candidate) => {
  const relative = path.relative(base, candidate);
  return relative !== '' && !relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative);
};
async function fixture(t) {
  const base = await mkdtemp(path.join(os.tmpdir(), 'mw5-workbench-review-'));
  const realBase = await realpath(base), tempBase = await realpath(os.tmpdir());
  assert.ok(contains(tempBase, realBase));
  t.after(async () => {
    // Delete only this exact test directory after verifying its resolved containment.
    assert.equal(await realpath(base), realBase); assert.ok(contains(tempBase, realBase));
    assert.equal((await lstat(base)).isSymbolicLink(), false);
    await rm(base, { recursive: true, force: true });
  });
  const sourceRoot = path.join(base, 'source'), outputDir = path.join(base, 'package');
  await mkdir(sourceRoot);
  for (const f of WORKBENCH_PACKAGE_FILES) {
    const destination = path.join(sourceRoot, f.source);
    assert.ok(contains(sourceRoot, destination)); await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, await readFile(path.join(workspace, f.source)));
  }
  return { base, sourceRoot, outputDir };
}
async function inventory(directory, prefix = '') {
  const names = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const name = prefix + entry.name;
    assert.equal(entry.isSymbolicLink(), false);
    if (entry.isDirectory()) names.push(...await inventory(path.join(directory, entry.name), name + '/'));
    else { assert.equal(entry.isFile(), true); names.push(name); }
  }
  return names.sort();
}
async function manifest(directory) { return JSON.parse(await readFile(path.join(directory, manifestName), 'utf8')); }
async function replaceManifest(directory, value) { await writeFile(path.join(directory, manifestName), JSON.stringify(value, null, 2) + '\n'); }

test('package review: fixed source-only inventory excludes models, settings, evidence and unrelated files', async t => {
  const f = await fixture(t);
  for (const name of ['companion/local/settings.json', 'companion/local/models/private.gguf', 'companion/local/recording.wav',
    'research/private-evidence.json', '.git/config', 'unrelated.txt']) {
    const file = path.join(f.sourceRoot, name); await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, 'PRIVATE_SENTINEL_NOT_FOR_PACKAGE');
  }
  assert.equal((await buildWorkbenchPackage(f)).status, 'BUILT');
  const result = await verifyWorkbenchPackage(f.outputDir); assert.equal(result.status, 'VERIFIED');
  const m = await manifest(f.outputDir);
  assert.equal(m.classification, 'OFFLINE_WORKBENCH_ONLY'); assert.equal(m.modelsIncluded, false);
  assert.equal(m.nodeRequirement.major, 24); assert.equal(m.files.length, 29);
  assert.deepEqual(await inventory(f.outputDir), [...WORKBENCH_PACKAGE_FILES.map(f => f.path), manifestName].sort());
  for (const row of m.files) {
    const bytes = await readFile(path.join(f.outputDir, row.path));
    assert.equal(row.bytes, bytes.length); assert.equal(row.sha256, hash(bytes));
    assert.equal(bytes.includes(Buffer.from('PRIVATE_SENTINEL_NOT_FOR_PACKAGE')), false);
  }
  assert.equal(m.totalBytes, m.files.reduce((n, f) => n + f.bytes, 0));
  assert.equal(m.files.some(f => f.path === 'companion/models.lock.json'), true);
  assert.equal(m.files.some(f => f.path === 'companion/kokoro.lock.json'), true);
  assert.equal(m.files.some(f => f.path === 'scripts/Kokoro-Worker.py'), true);
});

test('package review: an existing output tree is never overwritten or treated as a successful new backup', async t => {
  const f = await fixture(t); await mkdir(f.outputDir); await writeFile(path.join(f.outputDir, 'sentinel'), 'KEEP');
  await assert.rejects(buildWorkbenchPackage(f));
  assert.deepEqual(await readdir(f.outputDir), ['sentinel']); assert.equal(await readFile(path.join(f.outputDir, 'sentinel'), 'utf8'), 'KEEP');
  const other = path.join(f.base, 'existing-file'); await writeFile(other, 'KEEP_FILE');
  await assert.rejects(buildWorkbenchPackage({ ...f, outputDir: other })); assert.equal(await readFile(other, 'utf8'), 'KEEP_FILE');
});

test('package review: a destination created during snapshot work remains owned by its creator', async t => {
  const f = await fixture(t); let collided = false;
  await assert.rejects(buildWorkbenchPackage(f, { afterSnapshot: async () => {
    collided = true; await mkdir(f.outputDir); await writeFile(path.join(f.outputDir, 'sentinel'), 'KEEP_RACE_WINNER');
  } }));
  assert.equal(collided, true); assert.deepEqual(await readdir(f.outputDir), ['sentinel']);
  assert.equal(await readFile(path.join(f.outputDir, 'sentinel'), 'utf8'), 'KEEP_RACE_WINNER');
});

test('package review: same-size changed bytes, a missing payload, and an unexpected file all fail verification', async t => {
  const f = await fixture(t); await buildWorkbenchPackage(f);
  const item = (await manifest(f.outputDir)).files.find(row => row.path === 'companion/server.mjs');
  const target = path.join(f.outputDir, item.path), original = await readFile(target), altered = Buffer.from(original);
  altered[0] ^= 1; await writeFile(target, altered); await assert.rejects(verifyWorkbenchPackage(f.outputDir));
  await writeFile(target, original); await rm(target); await assert.rejects(verifyWorkbenchPackage(f.outputDir));
  await writeFile(target, original); await writeFile(path.join(f.outputDir, 'unexpected.txt'), 'extra');
  await assert.rejects(verifyWorkbenchPackage(f.outputDir));
});

test('package review: manifest path aliases, duplicates and unsupported classification cannot redefine the payload', async t => {
  const f = await fixture(t); await buildWorkbenchPackage(f); const original = await manifest(f.outputDir);
  const mutations = [m => { m.files[1].path = m.files[0].path; }, m => { m.files[0].path = '../outside.txt'; },
    m => { m.files[0].path = 'C:/outside.txt'; }, m => { m.files[0].path = '/outside.txt'; },
    m => { m.files.find(row => row.path.includes('/')).path = 'companion\\server.mjs'; },
    m => { m.files[0].path = m.files[0].path.toUpperCase(); }, m => { m.files[0].bytes = -1; },
    m => { m.modelsIncluded = true; }, m => { m.classification = 'M8_COMPLETE'; }];
  for (const mutate of mutations) {
    const changed = structuredClone(original); mutate(changed); await replaceManifest(f.outputDir, changed);
    await assert.rejects(verifyWorkbenchPackage(f.outputDir));
  }
  await replaceManifest(f.outputDir, original); assert.equal((await verifyWorkbenchPackage(f.outputDir)).status, 'VERIFIED');
});

test('package review: a missing allowlisted source fails without disturbing an existing sibling backup', async t => {
  const f = await fixture(t); const prior = path.join(f.base, 'prior'); await mkdir(prior); await writeFile(path.join(prior, 'sentinel'), 'KEEP');
  await rm(path.join(f.sourceRoot, 'companion/server.mjs'));
  await assert.rejects(buildWorkbenchPackage(f)); assert.equal(await readFile(path.join(prior, 'sentinel'), 'utf8'), 'KEEP');
  await assert.rejects(verifyWorkbenchPackage(f.outputDir));
});

test('package review: source drift after snapshot refuses success and cannot produce a verified package', async t => {
  const f = await fixture(t); let changed = false;
  await assert.rejects(buildWorkbenchPackage(f, { afterSnapshot: async () => {
    changed = true; const target = path.join(f.sourceRoot, 'companion/server.mjs');
    const bytes = await readFile(target); bytes[0] ^= 1; await writeFile(target, bytes);
  } }));
  assert.equal(changed, true); await assert.rejects(verifyWorkbenchPackage(f.outputDir));
});

test('package review: a junction in the source or copied payload is rejected before following it as regular content', async t => {
  const f = await fixture(t), moved = path.join(f.base, 'moved-source-companion'), sourceCompanion = path.join(f.sourceRoot, 'companion');
  assert.ok(contains(f.base, sourceCompanion)); assert.ok(contains(f.base, moved));
  await rename(sourceCompanion, moved); await symlink(moved, sourceCompanion, 'junction');
  await assert.rejects(buildWorkbenchPackage(f));
  const g = await fixture(t); await buildWorkbenchPackage(g);
  const copied = path.join(g.outputDir, 'companion'), movedCopy = path.join(g.base, 'moved-copy-companion');
  assert.ok(contains(g.base, copied)); assert.ok(contains(g.base, movedCopy));
  await rename(copied, movedCopy); await symlink(movedCopy, copied, 'junction');
  await assert.rejects(verifyWorkbenchPackage(g.outputDir));
});

test('package review: payload and manifest size limits fail closed without accepting oversized data', async t => {
  const f = await fixture(t); await writeFile(path.join(f.sourceRoot, 'companion/server.mjs'), Buffer.alloc(1024 * 1024 + 1));
  await assert.rejects(buildWorkbenchPackage(f));
  const g = await fixture(t); await buildWorkbenchPackage(g);
  await writeFile(path.join(g.outputDir, manifestName), Buffer.alloc(65537, 0x20));
  await assert.rejects(verifyWorkbenchPackage(g.outputDir));
});
