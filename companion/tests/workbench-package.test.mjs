// MOCK_ONLY synthetic payload trees. No packaged app, model, browser or network runs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir, lstat, rm, symlink, rename } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { buildWorkbenchPackage, verifyWorkbenchPackage, WORKBENCH_PACKAGE_FILES,
  WORKBENCH_PACKAGE_MANIFEST, WORKBENCH_PACKAGE_LIMITS } from '../../scripts/Package-Workbench.mjs';

const digest = data => createHash('sha256').update(data).digest('hex');
async function fixture(t) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'mw5-workbench-package-test-'));
  t.after(async () => {
    const resolved = path.resolve(directory), rel = path.relative(path.resolve(os.tmpdir()), resolved);
    assert.ok(rel && !rel.startsWith('..') && !path.isAbsolute(rel));
    assert.ok(path.basename(resolved).startsWith('mw5-workbench-package-test-'));
    assert.equal((await lstat(resolved)).isSymbolicLink(), false);
    await rm(resolved, { recursive: true });
  });
  const sourceRoot = path.join(directory, 'source'); await mkdir(sourceRoot);
  const expected = new Map();
  for (const [index, mapping] of WORKBENCH_PACKAGE_FILES.entries()) {
    const file = path.join(sourceRoot, ...mapping.source.split('/')); await mkdir(path.dirname(file), { recursive: true });
    // Invalid executable text is intentional: packaging must only copy bytes.
    const bytes = Buffer.from(`SYNTHETIC-ONLY ${index} ${mapping.path}\nthrow new Error('DO_NOT_EXECUTE');\n`);
    await writeFile(file, bytes); expected.set(mapping.path, bytes);
  }
  return { directory, sourceRoot, expected, output: name => path.join(directory, name),
    build: name => buildWorkbenchPackage({ sourceRoot, outputDir: path.join(directory, name) }) };
}

test('fixed mapping is frozen, bounded and excludes local state, tests, raw research and arbitrary files', () => {
  assert.equal(WORKBENCH_PACKAGE_FILES.length, 32); assert.ok(Object.isFrozen(WORKBENCH_PACKAGE_FILES));
  assert.ok(WORKBENCH_PACKAGE_FILES.every(Object.isFrozen));
  assert.deepEqual(WORKBENCH_PACKAGE_FILES.find(f => f.path === 'README.md'), { source: 'design/WORKBENCH_PACKAGE_README.md', path: 'README.md' });
  const names = WORKBENCH_PACKAGE_FILES.map(f => f.path);
  assert.equal(new Set(names.map(n => n.toLowerCase())).size, 32);
  assert.deepEqual(names, [...names].sort());
  for (const name of ['companion/local/settings.json', 'companion/local/models/model.gguf', 'companion/tests/radio.test.mjs', '.git/config', 'research/report.json'])
    assert.equal(names.includes(name), false);
  assert.ok(names.includes('companion/models.lock.json')); assert.ok(names.includes('companion/kokoro.lock.json'));
  assert.ok(names.includes('scripts/Kokoro-Worker.py'));
});

test('two new directories contain byte-identical model-free payloads and deterministic manifests', async t => {
  const f = await fixture(t);
  for (const name of ['companion/local/settings.json', 'companion/local/models/private.gguf', '.git/config', 'research/private.txt']) {
    const file = path.join(f.sourceRoot, name); await mkdir(path.dirname(file), { recursive: true }); await writeFile(file, 'SECRET_NOT_PACKAGED');
  }
  const a = await f.build('package-a'), b = await f.build('package-b');
  assert.equal(a.status, 'BUILT'); assert.equal(a.classification, 'OFFLINE_WORKBENCH_ONLY');
  assert.deepEqual(a.manifest, b.manifest); assert.equal(a.manifestSha256, b.manifestSha256);
  assert.deepEqual(a.manifest.nodeRequirement, { major: 24 }); assert.equal(a.manifest.modelsIncluded, false);
  assert.equal(a.manifest.totalBytes, [...f.expected.values()].reduce((n, bytes) => n + bytes.length, 0));
  for (const entry of a.manifest.files) {
    const bytes = await readFile(path.join(f.output('package-a'), entry.path));
    assert.deepEqual(bytes, f.expected.get(entry.path)); assert.equal(entry.bytes, bytes.length); assert.equal(entry.sha256, digest(bytes));
    assert.deepEqual(bytes, await readFile(path.join(f.output('package-b'), entry.path)));
  }
  const manifest = await readFile(path.join(f.output('package-a'), WORKBENCH_PACKAGE_MANIFEST));
  assert.equal(manifest.includes(Buffer.from(f.sourceRoot)), false); assert.equal(manifest.includes(Buffer.from('SECRET')), false);
  assert.deepEqual(manifest, await readFile(path.join(f.output('package-b'), WORKBENCH_PACKAGE_MANIFEST)));
  assert.equal((await verifyWorkbenchPackage(f.output('package-a'))).status, 'VERIFIED');
  assert.deepEqual((await readdir(f.output('package-a'))).sort(), ['README.md', 'START_COMPANION.cmd', 'WORKBENCH_MANIFEST.json', 'companion', 'scripts', 'synthetic'].sort());
});

test('existing destinations are never overwritten or reused, including an existing empty directory', async t => {
  const f = await fixture(t); await f.build('package');
  const before = await readFile(path.join(f.output('package'), WORKBENCH_PACKAGE_MANIFEST));
  await assert.rejects(f.build('package'), /PACKAGE_OUTPUT_EXISTS/);
  assert.deepEqual(await readFile(path.join(f.output('package'), WORKBENCH_PACKAGE_MANIFEST)), before);
  await mkdir(f.output('empty')); await assert.rejects(f.build('empty'), /PACKAGE_OUTPUT_EXISTS/);
  await writeFile(f.output('file'), 'preserve'); await assert.rejects(f.build('file'), /PACKAGE_OUTPUT_EXISTS/);
  assert.equal(await readFile(f.output('file'), 'utf8'), 'preserve');
});

test('pristine verification rejects tampered, missing and extra payloads or directories', async t => {
  const f = await fixture(t);
  await f.build('tampered'); const file = path.join(f.output('tampered'), 'README.md');
  const bytes = await readFile(file); bytes[0] ^= 1; await writeFile(file, bytes);
  await assert.rejects(verifyWorkbenchPackage(f.output('tampered')), /PACKAGE_PAYLOAD_MISMATCH/);
  await f.build('missing'); await rename(path.join(f.output('missing'), 'README.md'), f.output('saved-readme'));
  await assert.rejects(verifyWorkbenchPackage(f.output('missing')), /PACKAGE_INVENTORY_MISMATCH/);
  await f.build('extra'); await writeFile(path.join(f.output('extra'), 'private.txt'), 'extra');
  await assert.rejects(verifyWorkbenchPackage(f.output('extra')), /UNEXPECTED_PACKAGE_ENTRY/);
  await f.build('directory'); await mkdir(path.join(f.output('directory'), 'companion', 'local'));
  await assert.rejects(verifyWorkbenchPackage(f.output('directory')), /UNEXPECTED_PACKAGE_ENTRY/);
});

test('manifest path traversal, duplicate paths, false classification and noncanonical duplicate keys are rejected', async t => {
  const f = await fixture(t); let index = 0;
  for (const mutate of [
    m => { m.files[0].path = '../escape'; },
    m => { m.files[1].path = m.files[0].path; },
    m => { m.files[0].path = m.files[0].path.toLowerCase(); },
    m => { m.classification = 'GAME_VERIFIED'; },
    m => { m.nodeRequirement.major = 18; },
    m => { m.totalBytes++; }
  ]) {
    const name = 'manifest-' + index++, result = await f.build(name); mutate(result.manifest);
    await writeFile(path.join(f.output(name), WORKBENCH_PACKAGE_MANIFEST), JSON.stringify(result.manifest, null, 2) + '\n');
    await assert.rejects(verifyWorkbenchPackage(f.output(name)), /INVALID_PACKAGE_MANIFEST/);
  }
  await f.build('duplicate-key'); const file = path.join(f.output('duplicate-key'), WORKBENCH_PACKAGE_MANIFEST);
  await writeFile(file, (await readFile(file, 'utf8')).replace('{', '{"schemaVersion":1,'));
  await assert.rejects(verifyWorkbenchPackage(f.output('duplicate-key')), /INVALID_PACKAGE_MANIFEST/);
});

test('source change after snapshot rejects before output reservation rather than mixing versions', async t => {
  const f = await fixture(t); let invoked = 0;
  await assert.rejects(buildWorkbenchPackage({ sourceRoot: f.sourceRoot, outputDir: f.output('drift') }, {
    afterSnapshot: async () => {
      invoked++; const file = path.join(f.sourceRoot, 'companion', 'radio.mjs');
      const bytes = await readFile(file); bytes[0] ^= 1; await writeFile(file, bytes);
    }
  }), /SOURCE_CHANGED/);
  assert.equal(invoked, 1); await assert.rejects(lstat(f.output('drift')), { code: 'ENOENT' });
});

test('missing and oversized sources fail without creating a package', async t => {
  const f = await fixture(t), readme = path.join(f.sourceRoot, 'design', 'WORKBENCH_PACKAGE_README.md');
  await rename(readme, f.output('saved-source')); await assert.rejects(f.build('missing-source'), { code: 'ENOENT' });
  await assert.rejects(lstat(f.output('missing-source')), { code: 'ENOENT' });
  await writeFile(readme, Buffer.alloc(WORKBENCH_PACKAGE_LIMITS.fileBytes + 1));
  await assert.rejects(f.build('oversized'), /PACKAGE_SIZE_LIMIT/); await assert.rejects(lstat(f.output('oversized')), { code: 'ENOENT' });
});

test('source and destination directory links cannot redirect package reads or writes', async t => {
  const f = await fixture(t), link = f.output('source-link');
  await symlink(f.sourceRoot, link, process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(buildWorkbenchPackage({ sourceRoot: link, outputDir: f.output('linked-source') }), /UNSAFE_PACKAGE_DIRECTORY/);
  await assert.rejects(buildWorkbenchPackage({ sourceRoot: f.sourceRoot, outputDir: path.join(link, 'redirected') }), /UNSAFE_PACKAGE_DIRECTORY/);
  await assert.rejects(lstat(path.join(f.sourceRoot, 'redirected')), { code: 'ENOENT' });
});

test('traversal spelling and unapproved test hooks reject without filesystem mutation', async t => {
  const f = await fixture(t);
  const traversal = f.output('nested') + path.sep + '..' + path.sep + 'escaped';
  await assert.rejects(buildWorkbenchPackage({ sourceRoot: f.sourceRoot, outputDir: traversal }), /UNSAFE_PACKAGE_PATH/);
  for (const sourceRoot of ['\\\\not-a-real-host\\share\\source', '//not-a-real-host/share/source'])
    await assert.rejects(buildWorkbenchPackage({ sourceRoot, outputDir: f.output('remote') }), /UNSAFE_PACKAGE_PATH/);
  await assert.rejects(buildWorkbenchPackage({ sourceRoot: f.sourceRoot, outputDir: f.output('hooks') }, { beforeWrite: () => {} }), /INVALID_PACKAGE_TEST_HOOK/);
  await assert.rejects(lstat(f.output('escaped')), { code: 'ENOENT' }); await assert.rejects(lstat(f.output('hooks')), { code: 'ENOENT' });
});
