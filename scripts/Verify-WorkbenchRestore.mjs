// Actual restored-source smoke, not game/model/browser acceptance. No auto-run on import.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { syncBuiltinESMExports } from 'node:module';
import childProcess from 'node:child_process';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import tls from 'node:tls';
import dgram from 'node:dgram';
import workerThreads from 'node:worker_threads';
import { buildWorkbenchPackage, verifyWorkbenchPackage, WORKBENCH_PACKAGE_FILES } from './Package-Workbench.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const RESTORE_RECEIPT = 'research/WORKBENCH_RESTORE_VALIDATION.json';
const MANIFEST = 'WORKBENCH_MANIFEST.json';
const MAX_FILE = 4 * 1024 ** 2, MAX_TOTAL = 32 * 1024 ** 2, MAX_RECEIPT = 1024 ** 2;
const RESERVE_BYTES = 10 * 1024 ** 3;
const IDS = ['alpha', 'bravo', 'charlie'];
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const samePath = (a, b) => process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
const fault = code => Object.assign(new Error(code), { code });

export async function writeRestoreReceiptBytes(handle, bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 1 || bytes.length > MAX_RECEIPT) throw fault('RESTORE_RECEIPT_LIMIT');
  await handle.truncate(0);
  let offset = 0;
  while (offset < bytes.length) {
    const remaining = bytes.length - offset;
    const { bytesWritten } = await handle.write(bytes, offset, remaining, offset);
    if (!Number.isSafeInteger(bytesWritten) || bytesWritten < 1 || bytesWritten > remaining)
      throw fault('RESTORE_RECEIPT_WRITE_NO_VALID_PROGRESS');
    offset += bytesWritten;
  }
  await handle.sync();
}

export function parseRestoreArguments(args) {
  if (!Array.isArray(args) || args.length !== 1 || !['--check', '--run'].includes(args[0]))
    throw fault('USE_CHECK_OR_RUN_ONLY');
  return args[0];
}

export function assertRestoreRelativePath(value) {
  if (typeof value !== 'string' || value.length > 240 || value.includes('\\') ||
      value.split('/').some(part => !/^[A-Za-z0-9_.-]+$/.test(part) || part === '.' || part === '..' ||
        /[. ]$/.test(part) || /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part)))
    throw fault('UNSAFE_RESTORE_PATH');
  return value;
}

async function safePath(absolute, type, maxBytes = MAX_FILE) {
  const expected = path.resolve(absolute), info = await fs.lstat(expected);
  if (info.isSymbolicLink() || (type === 'directory' ? !info.isDirectory() : !info.isFile()) ||
      !samePath(await fs.realpath(expected), expected)) throw fault('RESTORE_PATH_LINK_OR_TYPE');
  if (type === 'file' && (!Number.isSafeInteger(info.size) || info.size > maxBytes)) throw fault('RESTORE_FILE_LIMIT');
  return info;
}
async function boundedRead(file, maxBytes = MAX_FILE) {
  const info = await safePath(file, 'file', maxBytes), bytes = await fs.readFile(file);
  if (bytes.length !== info.size || bytes.length > maxBytes) throw fault('RESTORE_FILE_CHANGED');
  return bytes;
}
async function ensureTmp() {
  await safePath(ROOT, 'directory');
  const directory = path.join(ROOT, 'tmp');
  try { await fs.mkdir(directory); } catch (error) { if (error.code !== 'EEXIST') throw error; }
  await safePath(directory, 'directory');
  return directory;
}
async function availableDisk() {
  const space = await fs.statfs(ROOT, { bigint: true });
  const available = space.bavail * space.bsize;
  if (available < BigInt(RESERVE_BYTES + MAX_TOTAL * 2)) throw fault('RESTORE_DISK_RESERVE');
  return Number(available);
}
async function originalSettingsFingerprint() {
  const file = path.join(ROOT, 'companion', 'local', 'settings.json');
  let bytes;
  try { bytes = await boundedRead(file, 64 * 1024); }
  catch (error) { if (error.code === 'ENOENT') return { exists: false }; throw error; }
  return { exists: true, bytes: bytes.length, sha256: hash(bytes) };
}

/** Deny reviewed app entrypoints; this is NOT an OS sandbox or network monitor. */
export function installRestoreOperationGuards() {
  const attempts = [], saved = [];
  function deny(object, key, label) {
    const descriptor = Object.getOwnPropertyDescriptor(object, key);
    if (!descriptor || typeof descriptor.value !== 'function') return;
    saved.push({ object, key, descriptor });
    Object.defineProperty(object, key, { ...descriptor, value: function () {
      if (attempts.length < 64) attempts.push(label);
      throw fault('FORBIDDEN_RESTORE_OPERATION');
    } });
  }
  function restore() {
    for (const item of saved.splice(0).reverse()) Object.defineProperty(item.object, item.key, item.descriptor);
    syncBuiltinESMExports();
  }
  try {
    for (const key of ['spawn', 'spawnSync', 'exec', 'execSync', 'execFile', 'execFileSync', 'fork']) deny(childProcess, key, `child_process.${key}`);
    for (const [object, label, keys] of [[http, 'http', ['request', 'get', 'createServer']],
      [https, 'https', ['request', 'get', 'createServer']], [net, 'net', ['connect', 'createConnection', 'createServer']],
      [tls, 'tls', ['connect', 'createServer']], [dgram, 'dgram', ['createSocket']], [workerThreads, 'worker_threads', ['Worker']]])
      for (const key of keys) deny(object, key, `${label}.${key}`);
    deny(net.Socket.prototype, 'connect', 'net.Socket.connect');
    deny(net.Server.prototype, 'listen', 'net.Server.listen');
    deny(globalThis, 'fetch', 'global.fetch');
    deny(globalThis, 'WebSocket', 'global.WebSocket');
    syncBuiltinESMExports();
  } catch (error) { restore(); throw error; }
  return { attempts, restore };
}

export async function readRestoreManifest(packageDir) {
  await safePath(packageDir, 'directory');
  const bytes = await boundedRead(path.join(packageDir, MANIFEST), 256 * 1024);
  const manifest = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  if (manifest.schemaVersion !== 1 || manifest.classification !== 'OFFLINE_WORKBENCH_ONLY' ||
      manifest.modelsIncluded !== false || manifest.nodeRequirement?.major !== 24 ||
      !Array.isArray(manifest.files) || manifest.files.length < 1 || manifest.files.length > 64)
    throw fault('INVALID_RESTORE_MANIFEST');
  const seen = new Set(); let total = 0;
  for (const file of manifest.files) {
    assertRestoreRelativePath(file.path);
    const key = file.path.toLowerCase();
    if (seen.has(key) || file.path === MANIFEST || !Number.isSafeInteger(file.bytes) || file.bytes < 0 ||
        file.bytes > MAX_FILE || !/^[a-f0-9]{64}$/.test(file.sha256)) throw fault('INVALID_RESTORE_MANIFEST_FILE');
    seen.add(key); total += file.bytes;
  }
  if (total > MAX_TOTAL || total !== manifest.totalBytes) throw fault('RESTORE_PAYLOAD_LIMIT');
  return { bytes, manifest, sha256: hash(bytes) };
}

// Static literal imports are reviewed alongside the real restored import below.
// This is not a general JavaScript parser or proof about arbitrary computed paths.
export async function verifyRestoreDependencyClosure(packageDir, manifest) {
  const files = new Set(manifest.files.map(item => item.path)), references = [];
  for (const item of manifest.files.filter(item => item.path.endsWith('.mjs'))) {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(await boundedRead(path.join(packageDir, item.path)));
    const imports = [...text.matchAll(/\b(?:import|export)\s+[^;]*?\bfrom\s*['"]([^'"]+)['"]/g)].map(match => match[1]);
    const dynamic = [...text.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g)].map(match => match[1]);
    if ([...text.matchAll(/\bimport\s*\(/g)].length !== dynamic.length) throw fault('COMPUTED_IMPORT_REQUIRES_REVIEW');
    for (const specifier of [...imports, ...dynamic]) {
      if (specifier.startsWith('node:')) continue;
      if (!specifier.startsWith('./') && !specifier.startsWith('../')) throw fault('EXTERNAL_IMPORT_REQUIRES_REVIEW');
      const target = path.posix.normalize(path.posix.join(path.posix.dirname(item.path), specifier));
      assertRestoreRelativePath(target);
      if (!files.has(target)) throw fault('MISSING_RESTORED_DEPENDENCY');
      references.push({ from: item.path, target });
    }
  }
  for (const required of ['companion/server.mjs', 'companion/personas.json', 'companion/llama-runtime-pins.json',
    'scripts/tactical-policy.mjs', 'synthetic/tactical-cases.mjs', 'START_COMPANION.cmd',
    'companion/public/index.html', 'companion/public/app.js', 'companion/public/styles.css',
    'companion/public/microphone.js', 'companion/public/microphone-worklet.js'])
    if (!files.has(required)) throw fault('MISSING_REQUIRED_WORKBENCH_FILE');
  return { status: 'PASS_LITERAL_IMPORT_CLOSURE', references,
    limitation: 'Literal module references and known public assets only; actual source restoration is exercised separately.' };
}

async function inventory(directory, prefix = '', directories = [], budget = { entries: 0 }) {
  const result = [];
  for (const item of (await fs.readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    if (++budget.entries > 128) throw fault('RESTORE_INVENTORY_LIMIT');
    const relative = prefix ? `${prefix}/${item.name}` : item.name;
    assertRestoreRelativePath(relative);
    const absolute = path.join(directory, item.name);
    if (item.isDirectory()) { await safePath(absolute, 'directory'); directories.push(relative);
      result.push(...await inventory(absolute, relative, directories, budget)); }
    else { await safePath(absolute, 'file'); result.push(relative); }
    if (result.length > 128) throw fault('RESTORE_INVENTORY_LIMIT');
  }
  return result;
}
async function verifyPayloadAfterSmoke(packageDir, before, extraFiles) {
  const directories = [], actual = (await inventory(packageDir, '', directories)).sort();
  const expected = [...before.manifest.files.map(item => item.path), MANIFEST, ...extraFiles].sort();
  assert.deepEqual(actual, expected);
  const expectedDirectories = [...new Set(expected.flatMap(file => {
    const pieces = file.split('/'); return pieces.slice(0, -1).map((_, i) => pieces.slice(0, i + 1).join('/'));
  }))].sort();
  assert.deepEqual(directories.sort(), expectedDirectories);
  assert.deepEqual(await boundedRead(path.join(packageDir, MANIFEST)), before.bytes);
  for (const item of before.manifest.files) {
    const bytes = await boundedRead(path.join(packageDir, item.path));
    assert.equal(bytes.length, item.bytes); assert.equal(hash(bytes), item.sha256);
  }
  return { status: 'PASS', payloadFilesUnchanged: before.manifest.files.length, onlyAddedFiles: extraFiles };
}

function assertNoEngines(state) {
  assert.equal(state.control.nativeCalls, 0);
  assert.equal(state.control.nativeAdapter, 'NOT_BUILT');
  assert.equal(state.integration.game, 'NOT_BUILT'); assert.equal(state.integration.directPiloting, 'NOT_BUILT');
  assert.equal(state.localModels.language.state, 'STOPPED');
  assert.equal(state.localModels.language.ownedPid, null);
  assert.equal(state.localModels.language.activeGeneration, false);
  assert.ok(['NEW', 'STOPPED'].includes(state.localModels.speech.state));
  assert.equal(state.localModels.speech.busy, false);
  assert.equal(state.localModels.starting, false); assert.equal(state.localModels.cleanupPending, false);
  assert.equal(state.localModels.reply, null); assert.equal(state.localModels.audio, null);
  assert.ok(['STOPPED', 'DISPOSED'].includes(state.speechInput.engine.state));
  assert.equal(state.speechInput.engine.ownsProcess, false); assert.equal(state.speechInput.engine.busy, false);
  assert.equal(state.speechInput.current, null); assert.equal(state.speechInput.dispatchable, false);
  assert.ok(state.control.recommendations.every(r => r.dispatchable === false));
}
function briefState(state) {
  assertNoEngines(state);
  return { classification: state.classification, mode: state.control.mode, armed: state.control.armed,
    session: state.control.session, settingsStatus: state.settingsStatus,
    bindings: state.radio.bindings.map(({ id, pawnId, generation, aiOwned, alive }) => ({ id, pawnId, generation, aiOwned, alive })),
    recommendations: state.control.recommendations.map(({ actorId, action, reason }) => ({ actorId, action, reason })),
    ledger: state.control.ledger.map(({ actorId, binding, action, stages }) => ({ actorId, binding, action, stages })),
    languageState: state.localModels.language.state, speechState: state.localModels.speech.state,
    recognitionState: state.speechInput.engine.state, nativeCalls: state.control.nativeCalls };
}

async function smokeRestoredWorkbench(packageDir, record) {
  const settingsPath = path.join(packageDir, 'companion', 'local', 'settings.json');
  try { await fs.lstat(path.dirname(settingsPath)); throw fault('RESTORE_LOCAL_TREE_ALREADY_EXISTS'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const guards = installRestoreOperationGuards(); let workbench = null;
  record.status = 'RUNNING';
  record.guards = { scope: 'Known reviewed process/network entrypoints, including ESM named imports; not an OS sandbox or comprehensive monitor.', attempts: guards.attempts };
  record.steps = []; record.disposals = [];
  const check = (name, state) => { record.steps.push({ name, status: 'OBSERVED_STATE', state: briefState(state) }); return state; };
  try {
    const restored = await import(pathToFileURL(path.join(packageDir, 'companion', 'server.mjs')).href);
    assert.equal(typeof restored.createWorkbench, 'function');
    workbench = await restored.createWorkbench({ settingsPath });
    let state = check('pristine disconnected defaults', workbench.state());
    assert.equal(state.classification, 'DISCONNECTED'); assert.equal(state.control.armed, false);
    assert.equal(state.settingsStatus, 'DEFAULTS'); assert.equal(state.control.ledger.length, 0);
    assert.deepEqual(state.settings.pilots.map(p => p.id), IDS);
    state = check('synthetic mission, distinct actor bindings', await workbench.act({ type: 'demo' }));
    assert.equal(state.classification, 'MOCK_ONLY'); assert.equal(state.control.armed, false);
    assert.deepEqual(state.radio.bindings.map(b => b.id), IDS);
    assert.equal(new Set(state.radio.bindings.map(b => b.pawnId)).size, 3);
    assert.ok(state.radio.bindings.every(b => b.aiOwned === true && b.alive === true));
    state = check('unarmed recommendations cannot submit', await workbench.act({ type: 'queue' }));
    assert.equal(state.control.ledger.length, 0);
    state = check('explicit simulation arming', await workbench.act({ type: 'arm' }));
    assert.equal(state.control.armed, true);
    state = check('mock submissions retain submission-only evidence', await workbench.act({ type: 'queue' }));
    assert.ok(state.control.ledger.length > 0);
    assert.ok(state.control.ledger.every(item => item.classification === 'MOCK_ONLY' &&
      item.stages.length === 1 && item.stages[0].stage === 'SUBMITTED'));
    await workbench.act({ type: 'demo' }); await workbench.act({ type: 'arm' });
    state = check('persistent human hold affects selected actor', await workbench.act({ type: 'step', actorId: 'alpha', event: 'hold' }));
    const held = structuredClone(state.control.policyState.actors.alpha.heldHumanOrder);
    assert.equal(held.persistent, true);
    assert.equal(state.control.recommendations.find(r => r.actorId === 'alpha').reason, 'HUMAN_ORDER_ACTIVE');
    state = check('held actor excluded from mock submissions', await workbench.act({ type: 'queue' }));
    assert.ok(state.control.ledger.every(item => item.actorId !== 'alpha'));
    state = check('pause disarms and preserves human hold', await workbench.act({ type: 'step', actorId: 'alpha', event: 'pause' }));
    assert.equal(state.control.armed, false); assert.deepEqual(state.control.policyState.actors.alpha.heldHumanOrder, held);
    state = check('resume does not release human hold', await workbench.act({ type: 'step', actorId: 'alpha', event: 'resume' }));
    assert.deepEqual(state.control.policyState.actors.alpha.heldHumanOrder, held);
    state = check('explicit release clears matching hold', await workbench.act({ type: 'step', actorId: 'alpha', event: 'release' }));
    assert.equal(state.control.policyState.actors.alpha.heldHumanOrder, null);
    await workbench.act({ type: 'arm' });
    state = check('released recipient becomes mock eligible', await workbench.act({ type: 'queue' }));
    assert.ok(state.control.ledger.some(item => item.actorId === 'alpha'));
    const beforePossession = state.control.ledger.length;
    state = check('possession revokes control', await workbench.act({ type: 'step', actorId: 'bravo', event: 'possession' }));
    assert.equal(state.control.armed, false); assert.equal(state.radio.bindings.find(b => b.id === 'bravo').aiOwned, false);
    state = check('possessed mission cannot add mock submissions', await workbench.act({ type: 'queue' }));
    assert.equal(state.control.ledger.length, beforePossession);
    const preferences = structuredClone(state.settings);
    preferences.micMuted = true; preferences.speechMuted = true; preferences.quiet = true;
    preferences.pilots[0].callsign = 'Restore Check';
    state = check('preferences saved only inside restored copy', await workbench.act({ type: 'settings', settings: preferences }));
    assert.equal(state.settingsStatus, 'SAVED'); assert.deepEqual(state.settings, preferences);
    const disposed = await workbench.dispose(); record.disposals.push(disposed); workbench = null;
    assert.equal(disposed.status, 'LOCAL_MODELS_STOPPED');
    workbench = await restored.createWorkbench({ settingsPath });
    state = check('preferences reload while mission resets', workbench.state());
    assert.equal(state.settingsStatus, 'LOADED'); assert.deepEqual(state.settings, preferences);
    assert.equal(state.classification, 'DISCONNECTED'); assert.equal(state.control.armed, false); assert.equal(state.control.ledger.length, 0);
    const savedBytes = await boundedRead(settingsPath, 16384);
    record.settings = { relativePath: 'companion/local/settings.json', bytes: savedBytes.length,
      sha256: hash(savedBytes), originalSettingsWritten: false };
  } finally {
    try {
      if (workbench) { const disposed = await workbench.dispose(); record.disposals.push(disposed); assert.equal(disposed.status, 'LOCAL_MODELS_STOPPED'); }
    } finally { guards.restore(); record.guards.restored = true; }
  }
  assert.deepEqual(guards.attempts, []);
  for (const step of record.steps) step.status = 'PASS';
  record.status = 'PASS_ACTUAL_RESTORED_SOURCE_MOCK_ONLY';
}

export async function verifyWorkbenchRestore(args) {
  const action = parseRestoreArguments(args);
  if (Number(process.versions.node.split('.')[0]) !== 24) throw fault('NODE_24_REQUIRED');
  await safePath(ROOT, 'directory'); await safePath(path.join(ROOT, 'research'), 'directory');
  const sourceFiles = [...new Set(['scripts/Verify-WorkbenchRestore.mjs', 'scripts/Package-Workbench.mjs',
    ...WORKBENCH_PACKAGE_FILES.map(item => item.source)])].sort();
  const sources = [];
  for (const file of sourceFiles) { const bytes = await boundedRead(path.join(ROOT, file)); sources.push({ file, bytes: bytes.length, sha256: hash(bytes) }); }
  const plan = { classification: 'OFFLINE_WORKBENCH_ONLY', action, receipt: RESTORE_RECEIPT,
    outputParent: 'tmp/', packageCopies: 2, directoryPolicy: 'Exclusive new run directory; no deletion or reuse',
    originalSettingsAccess: 'HASH_ONLY_ON_RUN_NO_CONTENT_LOGGING', models: 'NOT_PERFORMED', browser: 'NOT_PERFORMED', http: 'NOT_PERFORMED',
    nativeOrGame: 'NOT_PERFORMED', sources };
  if (action === '--check') return { ...plan, status: 'PLAN_ONLY_NOT_RUN', writesPerformed: false,
    sourceFilesRead: sources.length, diskAndReceiptAvailability: 'NOT_CHECKED_UNTIL_RUN' };
  const handle = await fs.open(path.join(ROOT, RESTORE_RECEIPT), 'wx', 0o600);
  const receipt = { schemaVersion: 1, recordedAt: new Date().toISOString(), ...plan, status: 'INCOMPLETE',
    runtime: { nodeVersion: process.version, platform: process.platform, architecture: process.arch, executable: process.execPath },
    packages: [], smoke: { status: 'NOT_PERFORMED' }, failure: null,
    limitations: ['This is a source-only offline workbench restore, not a mod, native adapter or final release.',
      'No browser/HTTP/Explorer, model, recognition, speech or gameplay acceptance was performed.',
      'Operation guards instrument known reviewed entrypoints, not an OS sandbox or comprehensive network monitor.',
      'The two copies share the same filesystem and are not independent disaster-recovery backups.',
      'Package payloads are deterministic; the evidence receipt intentionally records local paths and times.'] };
  async function save() {
    const bytes = Buffer.from(JSON.stringify(receipt, null, 2) + '\n');
    await writeRestoreReceiptBytes(handle, bytes);
  }
  try {
    await save(); receipt.originalSettings = { verification: 'PENDING', before: await originalSettingsFingerprint() };
    receipt.freeDiskBytes = await availableDisk();
    const parent = await ensureTmp(), runDirectory = path.join(parent, `workbench-restore-${randomUUID()}`);
    await fs.mkdir(runDirectory); await safePath(runDirectory, 'directory');
    receipt.outputDirectory = path.relative(ROOT, runDirectory).split(path.sep).join('/'); await save();
    const copies = [];
    for (const name of ['package-a', 'package-b']) {
      const directory = path.join(runDirectory, name);
      const built = await buildWorkbenchPackage({ sourceRoot: ROOT, outputDir: directory });
      assert.equal(built.status, 'BUILT');
      const verified = await verifyWorkbenchPackage(directory); assert.equal(verified.status, 'VERIFIED');
      const before = await readRestoreManifest(directory);
      assert.equal(before.sha256, verified.manifestSha256);
      for (const file of before.manifest.files) {
        const mapped = WORKBENCH_PACKAGE_FILES.find(item => item.path === file.path);
        assert.ok(mapped);
        const source = sources.find(item => item.file === mapped.source);
        assert.equal(file.sha256, source.sha256); assert.equal(file.bytes, source.bytes);
      }
      const closure = await verifyRestoreDependencyClosure(directory, before.manifest);
      copies.push({ directory, before });
      receipt.packages.push({ path: `${receipt.outputDirectory}/${name}`, manifestSha256: before.sha256,
        fileCount: before.manifest.files.length, totalBytes: before.manifest.totalBytes,
        files: before.manifest.files, dependencyClosure: closure });
      await save();
    }
    assert.deepEqual(copies[0].before.bytes, copies[1].before.bytes);
    for (const file of copies[0].before.manifest.files)
      assert.deepEqual(await boundedRead(path.join(copies[0].directory, file.path)), await boundedRead(path.join(copies[1].directory, file.path)));
    receipt.reproducibility = { status: 'PASS_BYTE_IDENTICAL_PAYLOADS_AND_MANIFESTS', independentBuilds: 2 };
    await save();
    await smokeRestoredWorkbench(copies[0].directory, receipt.smoke);
    receipt.payloadAfterSmoke = await verifyPayloadAfterSmoke(copies[0].directory, copies[0].before, ['companion/local/settings.json']);
    assert.equal((await verifyWorkbenchPackage(copies[1].directory)).status, 'VERIFIED');
    receipt.pristineCopyAfterSmoke = await verifyPayloadAfterSmoke(copies[1].directory, copies[1].before, []);
    for (const source of sources) assert.equal(hash(await boundedRead(path.join(ROOT, source.file))), source.sha256);
    receipt.status = 'PASS_OFFLINE_WORKBENCH_RESTORE_ONLY';
  } catch (error) {
    receipt.failure = { code: error.code || 'RESTORE_ASSERTION_FAILED', message: String(error.message).slice(0, 1500) };
    if (receipt.smoke.status !== 'NOT_PERFORMED') receipt.smoke.status = 'FAILED';
  } finally {
    if (receipt.originalSettings) {
      try {
        receipt.originalSettings.after = await originalSettingsFingerprint();
        assert.deepEqual(receipt.originalSettings.after, receipt.originalSettings.before);
        receipt.originalSettings.verification = 'UNCHANGED_HASH_OR_ABSENCE';
      } catch (error) {
        receipt.originalSettings.verification = 'NOT_CONFIRMED_UNCHANGED'; receipt.status = 'INCOMPLETE';
        receipt.failure ??= { code: error.code || 'ORIGINAL_SETTINGS_CHANGED', message: 'Original-settings hash-only verification did not pass.' };
      }
    }
    receipt.completedAt = new Date().toISOString();
    try { await save(); } finally { await handle.close(); }
  }
  return receipt;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await verifyWorkbenchRestore(process.argv.slice(2));
    console.log(JSON.stringify({ status: result.status, receipt: result.receipt, outputDirectory: result.outputDirectory,
      packageCopies: result.packageCopies, failure: result.failure ?? null }));
    if (!['PLAN_ONLY_NOT_RUN', 'PASS_OFFLINE_WORKBENCH_RESTORE_ONLY'].includes(result.status)) process.exitCode = 1;
  } catch (error) { console.error(JSON.stringify({ status: 'REFUSED', error: error.code || error.message })); process.exitCode = 1; }
}
