// Explicit model-free packaging only. Importing this module performs no I/O.
// It never executes payload code. Source/app restore execution is a separate test.
import { createHash } from 'node:crypto';
import { lstat, realpath, opendir, mkdir, open } from 'node:fs/promises';
import path from 'node:path';

export const WORKBENCH_PACKAGE_MANIFEST = 'WORKBENCH_MANIFEST.json';
export const WORKBENCH_PACKAGE_LIMITS = Object.freeze({ fileBytes: 1024 * 1024, totalBytes: 4 * 1024 * 1024,
  manifestBytes: 64 * 1024, inventoryEntries: 64, sourceDirectoryEntries: 1024 });
const classification = 'OFFLINE_WORKBENCH_ONLY';
const payload = [
  'START_COMPANION.cmd',
  'companion/benchmark.mjs', 'companion/callsigns.mjs', 'companion/control.mjs', 'companion/conversation.mjs',
  'companion/kokoro.lock.json', 'companion/llama-runtime-pins.json', 'companion/local-language-model.mjs',
  'companion/local-recognition.mjs', 'companion/local-speech.mjs', 'companion/mission-speech.mjs',
  'companion/models.lock.json', 'companion/observation.mjs', 'companion/personas.json', 'companion/radio.mjs',
  'companion/server.mjs', 'companion/speaker-observations.mjs', 'companion/speech-input.mjs',
  'companion/whisper-runtime-pins.json', 'companion/workbench-resources.mjs',
  'companion/runtime-paths.mjs', 'companion/runtime-readiness.mjs', 'companion/runtime-bootstrap-pins.json',
  'companion/public/app.js', 'companion/public/index.html', 'companion/public/microphone-worklet.js',
  'companion/public/microphone.js', 'companion/public/styles.css',
  'scripts/Kokoro-Worker.py', 'scripts/tactical-policy.mjs', 'synthetic/tactical-cases.mjs'
];
export const WORKBENCH_PACKAGE_FILES = Object.freeze([
  { source: 'design/WORKBENCH_PACKAGE_README.md', path: 'README.md' },
  ...payload.map(name => ({ source: name, path: name }))
].sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0).map(Object.freeze));
const expectedPaths = WORKBENCH_PACKAGE_FILES.map(f => f.path);
const expectedDirectories = new Set(expectedPaths.flatMap(name => {
  const parts = name.split('/'); return parts.slice(0, -1).map((_, i) => parts.slice(0, i + 1).join('/'));
}));
const fail = code => { throw new Error(code); };
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const samePath = (a, b) => process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
const keysAre = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const identity = stat => [stat.dev, stat.ino, stat.mode, stat.size, stat.mtimeNs, stat.ctimeNs].join(':');
function absolute(value) {
  if (typeof value !== 'string' || !value || value.length > 32767 || value.includes('\0') || !path.isAbsolute(value) ||
      value.startsWith('\\\\') || value.startsWith('//') ||
      value.split(/[\\/]/).includes('..')) fail('UNSAFE_PACKAGE_PATH');
  return path.resolve(value);
}
function within(root, relative) {
  if (typeof relative !== 'string' || !relative || !/^[A-Za-z0-9_.\/-]+$/.test(relative) || relative.includes('\\') ||
      path.posix.isAbsolute(relative) || relative.split('/').some(part => !part || part === '.' || part === '..')) fail('UNSAFE_PACKAGE_PATH');
  const file = path.resolve(root, ...relative.split('/')), rel = path.relative(root, file);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) fail('UNSAFE_PACKAGE_PATH');
  return file;
}
async function existingDirectory(directory) {
  const resolved = absolute(directory), parsed = path.parse(resolved);
  let current = parsed.root;
  for (const piece of ['', ...resolved.slice(parsed.root.length).split(path.sep).filter(Boolean)]) {
    if (piece) current = path.join(current, piece);
    const stat = await lstat(current, { bigint: true });
    if (stat.isSymbolicLink() || !stat.isDirectory()) fail('UNSAFE_PACKAGE_DIRECTORY');
  }
  if (!samePath(await realpath(resolved), resolved)) fail('UNSAFE_PACKAGE_DIRECTORY');
  return resolved;
}
async function payloadPath(root, relative) {
  const file = within(root, relative); await existingDirectory(path.dirname(file));
  const names = []; let count = 0;
  for await (const entry of await opendir(path.dirname(file))) {
    if (++count > WORKBENCH_PACKAGE_LIMITS.sourceDirectoryEntries) fail('SOURCE_DIRECTORY_LIMIT');
    if (entry.name.toLowerCase() === path.basename(file).toLowerCase()) names.push(entry.name);
  }
  if (names.length > 1 || (names.length === 1 && names[0] !== path.basename(file))) fail('PACKAGE_CASE_COLLISION');
  const stat = await lstat(file, { bigint: true });
  if (stat.isSymbolicLink() || !stat.isFile() || !samePath(await realpath(file), file)) fail('UNSAFE_PACKAGE_FILE');
  return { file, stat };
}
async function stableRead(root, relative, limit = WORKBENCH_PACKAGE_LIMITS.fileBytes) {
  const { file, stat: before } = await payloadPath(root, relative);
  if (before.size > BigInt(limit)) fail('PACKAGE_SIZE_LIMIT');
  const handle = await open(file, 'r');
  try {
    const opened = await handle.stat({ bigint: true });
    if (!opened.isFile() || identity(opened) !== identity(before)) fail('SOURCE_CHANGED');
    const bytes = Buffer.alloc(Number(opened.size)); let offset = 0;
    while (offset < bytes.length) {
      const result = await handle.read(bytes, offset, bytes.length - offset, offset);
      if (!result.bytesRead) fail('SOURCE_CHANGED'); offset += result.bytesRead;
    }
    const extra = await handle.read(Buffer.alloc(1), 0, 1, offset);
    const after = await handle.stat({ bigint: true });
    const final = await payloadPath(root, relative);
    if (extra.bytesRead || identity(opened) !== identity(after) || identity(after) !== identity(final.stat)) fail('SOURCE_CHANGED');
    return { bytes, fingerprint: identity(after), sha256: sha256(bytes) };
  } finally { await handle.close(); }
}
async function inventory(packageDir) {
  const files = [], seen = new Set(); let entries = 0;
  async function visit(relative = '') {
    const directory = relative ? within(packageDir, relative) : packageDir; await existingDirectory(directory);
    for await (const entry of await opendir(directory)) {
      if (++entries > WORKBENCH_PACKAGE_LIMITS.inventoryEntries) fail('PACKAGE_INVENTORY_LIMIT');
      const name = entry.name;
      const rel = relative ? `${relative}/${name}` : name;
      if (seen.has(rel.toLowerCase())) fail('PACKAGE_CASE_COLLISION'); seen.add(rel.toLowerCase());
      const file = within(packageDir, rel), stat = await lstat(file, { bigint: true });
      if (stat.isSymbolicLink()) fail('UNSAFE_PACKAGE_FILE');
      if (stat.isDirectory()) {
        if (!expectedDirectories.has(rel)) fail('UNEXPECTED_PACKAGE_ENTRY');
        await visit(rel);
      } else {
        if (!stat.isFile() || (!expectedPaths.includes(rel) && rel !== WORKBENCH_PACKAGE_MANIFEST)) fail('UNEXPECTED_PACKAGE_ENTRY');
        files.push(rel);
      }
    }
  }
  await visit(); return files.sort();
}
function manifestFor(files) {
  return { schemaVersion: 1, classification, nodeRequirement: { major: 24 }, modelsIncluded: false,
    totalBytes: files.reduce((n, f) => n + f.bytes, 0), files };
}
const manifestBytes = manifest => Buffer.from(JSON.stringify(manifest, null, 2) + '\n');
function validateManifest(manifest) {
  if (!keysAre(manifest, ['schemaVersion', 'classification', 'nodeRequirement', 'modelsIncluded', 'totalBytes', 'files']) ||
      manifest.schemaVersion !== 1 || manifest.classification !== classification || manifest.modelsIncluded !== false ||
      !keysAre(manifest.nodeRequirement, ['major']) || manifest.nodeRequirement.major !== 24 ||
      !Number.isSafeInteger(manifest.totalBytes) || manifest.totalBytes < 0 || manifest.totalBytes > WORKBENCH_PACKAGE_LIMITS.totalBytes ||
      !Array.isArray(manifest.files) || manifest.files.length !== expectedPaths.length) fail('INVALID_PACKAGE_MANIFEST');
  const seen = new Set(); let total = 0;
  for (let i = 0; i < manifest.files.length; i++) {
    const file = manifest.files[i];
    if (!keysAre(file, ['path', 'bytes', 'sha256']) || file.path !== expectedPaths[i] || seen.has(file.path.toLowerCase()) ||
        !Number.isSafeInteger(file.bytes) || file.bytes < 0 || file.bytes > WORKBENCH_PACKAGE_LIMITS.fileBytes ||
        typeof file.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(file.sha256)) fail('INVALID_PACKAGE_MANIFEST');
    seen.add(file.path.toLowerCase()); total += file.bytes;
  }
  if (total !== manifest.totalBytes) fail('INVALID_PACKAGE_MANIFEST');
}
async function writeNew(root, relative, bytes) {
  const file = within(root, relative); await existingDirectory(path.dirname(file));
  const handle = await open(file, 'wx');
  try { await handle.writeFile(bytes); await handle.sync(); } finally { await handle.close(); }
  await payloadPath(root, relative);
}

/** Code-only test hook, not CLI/request data. Ordinary builds execute no callbacks or payload. */
export async function buildWorkbenchPackage({ sourceRoot, outputDir }, testHooks = null) {
  if (testHooks !== null && (!keysAre(testHooks, ['afterSnapshot']) || typeof testHooks.afterSnapshot !== 'function')) fail('INVALID_PACKAGE_TEST_HOOK');
  sourceRoot = await existingDirectory(sourceRoot); outputDir = absolute(outputDir);
  await existingDirectory(path.dirname(outputDir));
  try { await lstat(outputDir); fail('PACKAGE_OUTPUT_EXISTS'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const records = []; let total = 0;
  for (const mapping of WORKBENCH_PACKAGE_FILES) {
    const read = await stableRead(sourceRoot, mapping.source); total += read.bytes.length;
    if (total > WORKBENCH_PACKAGE_LIMITS.totalBytes) fail('PACKAGE_SIZE_LIMIT');
    records.push({ ...mapping, ...read });
  }
  const recheckSource = async () => {
    await existingDirectory(sourceRoot);
    for (const record of records) {
      const current = await stableRead(sourceRoot, record.source);
      if (current.fingerprint !== record.fingerprint || current.sha256 !== record.sha256) fail('SOURCE_CHANGED');
    }
  };
  if (testHooks) await testHooks.afterSnapshot();
  await recheckSource(); await existingDirectory(path.dirname(outputDir));
  try { await mkdir(outputDir); } catch (error) { if (error.code === 'EEXIST') fail('PACKAGE_OUTPUT_EXISTS'); throw error; }
  await existingDirectory(outputDir);
  for (const directory of [...expectedDirectories].sort((a, b) => a.split('/').length - b.split('/').length || (a < b ? -1 : 1))) {
    await mkdir(within(outputDir, directory)); await existingDirectory(within(outputDir, directory));
  }
  for (const record of records) await writeNew(outputDir, record.path, record.bytes);
  await recheckSource();
  const manifest = manifestFor(records.map(r => ({ path: r.path, bytes: r.bytes.length, sha256: r.sha256 })));
  const bytes = manifestBytes(manifest); if (bytes.length > WORKBENCH_PACKAGE_LIMITS.manifestBytes) fail('PACKAGE_SIZE_LIMIT');
  await writeNew(outputDir, WORKBENCH_PACKAGE_MANIFEST, bytes);
  const verified = await verifyWorkbenchPackage(outputDir);
  return { ...verified, status: 'BUILT', ...(testHooks ? { injectedTestHook: true } : {}) };
}

/** Pristine integrity check. Local settings created after launch are intentionally extra. */
export async function verifyWorkbenchPackage(packageDir) {
  packageDir = await existingDirectory(packageDir);
  const before = await inventory(packageDir);
  if (JSON.stringify(before) !== JSON.stringify([...expectedPaths, WORKBENCH_PACKAGE_MANIFEST].sort())) fail('PACKAGE_INVENTORY_MISMATCH');
  const receipt = await stableRead(packageDir, WORKBENCH_PACKAGE_MANIFEST, WORKBENCH_PACKAGE_LIMITS.manifestBytes);
  let manifest;
  try { manifest = JSON.parse(receipt.bytes.toString('utf8')); } catch { fail('INVALID_PACKAGE_MANIFEST'); }
  validateManifest(manifest);
  // Canonical bytes reject duplicate JSON keys and hidden/noncanonical metadata.
  if (!receipt.bytes.equals(manifestBytes(manifest))) fail('INVALID_PACKAGE_MANIFEST');
  const reads = [];
  for (const entry of manifest.files) {
    const current = await stableRead(packageDir, entry.path);
    if (current.bytes.length !== entry.bytes || current.sha256 !== entry.sha256) fail('PACKAGE_PAYLOAD_MISMATCH');
    reads.push({ path: entry.path, fingerprint: current.fingerprint, sha256: current.sha256 });
  }
  for (const entry of reads) {
    const current = await stableRead(packageDir, entry.path);
    if (current.fingerprint !== entry.fingerprint || current.sha256 !== entry.sha256) fail('PACKAGE_CHANGED_DURING_VERIFICATION');
  }
  const after = await inventory(packageDir), finalManifest = await stableRead(packageDir, WORKBENCH_PACKAGE_MANIFEST, WORKBENCH_PACKAGE_LIMITS.manifestBytes);
  if (JSON.stringify(before) !== JSON.stringify(after) || finalManifest.fingerprint !== receipt.fingerprint || !finalManifest.bytes.equals(receipt.bytes))
    fail('PACKAGE_CHANGED_DURING_VERIFICATION');
  return { status: 'VERIFIED', classification, manifest, manifestSha256: receipt.sha256 };
}
