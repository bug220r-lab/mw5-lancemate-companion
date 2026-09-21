// Project-owned installer orchestration. No upstream repository script is run.
import fs from 'node:fs/promises';
import { statfsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import os from 'node:os';

const project = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const root = path.join(project, 'companion', 'local', 'tts');
const python = path.join(root, 'venv', 'Scripts', 'python.exe');
const CAP = 4 * 1024 ** 3, RESERVE = 10 * 1024 ** 3;
const MODEL_REVISION = '9871713c6a29032f914cee65b617e2b6b3323770';
const CODE_REVISION = '1c7bdd971d2e32981f0f2b92d1fe5b0051e21457';
const MISAKI_REVISION = 'e820629b96334db28227df37f280e4836d46fadb';
const flags = new Set(process.argv.slice(2));
if ([...flags].some(f => !['--resolve', '--prepare', '--install', '--check-lock'].includes(f)) ||
    (flags.has('--resolve') && flags.size > 1) || (flags.has('--check-lock') && flags.size > 1)) throw Error('INVALID_SETUP_FLAGS');
const allowedHosts = new Set(['pypi.org', 'files.pythonhosted.org', 'download.pytorch.org',
  'download-r2.pytorch.org', 'github.com', 'raw.githubusercontent.com', 'huggingface.co']);
// Source-controlled lock survives source-only backup. Local receipts and fresh
// resolver results may never silently replace these artifact identities.
const sourceLockPath = path.join(project, 'companion', 'kokoro.lock.json');
const sourceLockText = await fs.readFile(sourceLockPath, 'utf8');
const sourceLock = JSON.parse(sourceLockText);
const sourceLockSha256 = createHash('sha256').update(sourceLockText).digest('hex');
if (sourceLock.schemaVersion !== 1 || sourceLock.lockVersion !== 1 || sourceLock.modelRevision !== MODEL_REVISION ||
    sourceLock.codeRevision !== CODE_REVISION || sourceLock.misakiRevision !== MISAKI_REVISION ||
    sourceLock.target?.platform !== 'win32' || sourceLock.target?.architecture !== 'x64' || sourceLock.target?.pythonMinor !== '3.12' ||
    !Array.isArray(sourceLock.assets) || sourceLock.assets.length > 128) throw Error('INVALID_SOURCE_LOCK');
const lockedFiles = new Set(), lockedPackages = new Map();
for (const asset of sourceLock.assets) {
  const url = new URL(asset.url);
  if (url.protocol !== 'https:' || !allowedHosts.has(url.hostname) || url.username || url.password ||
      !/^(wheels|models|licenses)\/[A-Za-z0-9_.+-]+$/.test(asset.file) || lockedFiles.has(asset.file) ||
      !/^[a-f0-9]{64}$/.test(asset.sha256 || '') || !Number.isSafeInteger(asset.size) || asset.size <= 0 || asset.size > CAP ||
      (asset.maxBytes !== undefined && (!Number.isSafeInteger(asset.maxBytes) || asset.maxBytes < asset.size || asset.maxBytes > CAP))) throw Error('INVALID_SOURCE_ASSET');
  lockedFiles.add(asset.file);
  if (asset.package) {
    const name = asset.package.toLowerCase().replace(/[-_.]+/g, '-');
    if (!/^[a-z0-9-]+$/.test(name) || !/^[A-Za-z0-9_.+-]+$/.test(asset.version || '') ||
        !/^wheels\/.+\.whl$/.test(asset.file) || /^(nvidia-|triton)/i.test(name) || lockedPackages.has(name)) throw Error('INVALID_SOURCE_WHEEL');
    lockedPackages.set(name, asset.version);
  }
}
for (const [name, version] of Object.entries({ torch:'2.6.0+cpu', kokoro:'0.9.4', misaki:'0.9.4',
  transformers:'4.48.3', 'huggingface-hub':'0.28.1', spacy:'3.8.4', soundfile:'0.14.0', numpy:'2.2.2',
  'espeakng-loader':'0.2.4', typer:'0.15.1', 'typer-slim':'0.15.1', click:'8.1.8', 'en-core-web-sm':'3.8.0' })) {
  if (lockedPackages.get(name) !== version) throw Error('REQUIRED_SOURCE_PACKAGE_MISMATCH');
}
for (const name of ['models/kokoro-v1_0.pth','models/config.json','models/af_bella.pt','models/am_adam.pt','models/af_heart.pt',
  'licenses/Kokoro-model-card.md','licenses/Kokoro-Apache-2.0.txt','licenses/Misaki-license.txt']) {
  if (!lockedFiles.has(name)) throw Error('REQUIRED_SOURCE_ASSET_MISSING');
}
const lockReceipt = { sourceLockVersion: sourceLock.lockVersion, sourceLockSha256 };
if (flags.has('--check-lock')) {
  console.log(JSON.stringify({ status:'SOURCE_LOCK_VALID', ...lockReceipt, assets:sourceLock.assets.length,
    wheels:lockedPackages.size, target:sourceLock.target, downloads:false, installation:false, execution:false }));
  process.exit(0);
}
if (!flags.size) {
  console.log('Use --check-lock for read-only validation; --prepare and --install use companion/kokoro.lock.json. Optional --resolve writes a candidate local report only.');
  process.exit(0);
}
if (process.platform !== 'win32' || process.arch !== 'x64') throw Error('WINDOWS_X64_LOCK_ONLY');
function inside(relative) {
  const result = path.resolve(root, relative);
  if (!result.startsWith(`${root}${path.sep}`)) throw Error('OUTSIDE_TTS_ROOT');
  return result;
}
async function bytes(directory = root) {
  let total = 0;
  for (const item of await fs.readdir(directory, { withFileTypes: true })) {
    const name = path.join(directory, item.name);
    if (item.isSymbolicLink()) throw Error('REPARSE_POINT_NOT_ALLOWED');
    total += item.isDirectory() ? await bytes(name) : (await fs.stat(name)).size;
  }
  return total;
}
function freeBytes() { const s = statfsSync(root); return s.bavail * s.bsize; }
async function budget(additional = 0) {
  const used = await bytes(), free = freeBytes();
  if (used + additional > CAP || free - additional < RESERVE) throw Error(`DISK_BUDGET: used=${used} additional=${additional} free=${free}`);
  return { usedBytes: used, freeBytes: free, additionalBytes: additional };
}
async function json(relative, value) { await fs.writeFile(inside(relative), JSON.stringify(value, null, 2) + '\n'); }
async function sha(filename) { return createHash('sha256').update(await fs.readFile(filename)).digest('hex'); }
const childEnv = { ...process.env, TEMP: inside('tmp'), TMP: inside('tmp'), PIP_CACHE_DIR: inside('pip-cache'),
  PIP_DISABLE_PIP_VERSION_CHECK: '1', PYTHONDONTWRITEBYTECODE: '1', HF_HOME: inside('hf-cache'),
  HF_HUB_DISABLE_TELEMETRY: '1', HF_HUB_OFFLINE: '1', TRANSFORMERS_OFFLINE: '1' };
function runPython(args, capture = false) {
  const result = spawnSync(python, args, { cwd: project, env: childEnv, windowsHide: true,
    encoding: 'utf8', stdio: capture ? 'pipe' : 'inherit', maxBuffer: 8 * 1024 ** 2 });
  if (result.status !== 0) throw Error(`PYTHON_FAILED ${result.status}: ${result.stderr || result.error || ''}`);
  return result.stdout;
}
async function download(asset) {
  const url = new URL(asset.url);
  if (url.protocol !== 'https:' || !allowedHosts.has(url.hostname)) throw Error(`UNAPPROVED_ORIGIN: ${url.hostname}`);
  const file = inside(asset.file); await fs.mkdir(path.dirname(file), { recursive: true });
  try {
    const existing = await fs.stat(file);
    if (asset.sha256 && existing.size === asset.size && await sha(file) === asset.sha256) return { ...asset, bytes: existing.size, verified: true, reused: true };
    if (existing.size) throw Error(`EXISTING_UNVERIFIED_FILE: ${asset.file}`);
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const response = await fetch(asset.url, { signal: AbortSignal.timeout(180000) });
  if (!response.ok) throw Error(`HTTP_${response.status}: ${asset.url}`);
  const header = Number(response.headers.get('content-length'));
  // fetch transparently decompresses responses, so an encoded Content-Length
  // is not the size of the bytes written to disk. The pinned asset size wins;
  // otherwise use the bounded manifest allowance for encoded text responses.
  const encoded = response.headers.get('content-encoding');
  const ceiling = asset.size || (!encoded && Number.isFinite(header) && header > 0 ? header : asset.maxBytes);
  if (!ceiling || ceiling > (asset.maxBytes || CAP)) throw Error('UNKNOWN_OR_EXCESSIVE_DOWNLOAD_SIZE');
  await budget(ceiling);
  const part = `${file}.part`, handle = await fs.open(part, 'wx');
  const hash = createHash('sha256'); let received = 0, checked = 0;
  try {
    for await (const chunk of response.body) {
      received += chunk.length;
      if (received > ceiling) throw Error('DOWNLOAD_EXCEEDED_MANIFEST');
      if (received - checked >= 8 * 1024 ** 2) {
        if (freeBytes() < RESERVE + 8 * 1024 ** 2) throw Error('FREE_SPACE_RESERVE');
        checked = received;
      }
      hash.update(chunk); await handle.write(chunk);
    }
    const digest = hash.digest('hex');
    if (asset.size && received !== asset.size) throw Error('DOWNLOAD_SIZE_MISMATCH');
    if (asset.sha256 && digest !== asset.sha256) throw Error('DOWNLOAD_HASH_MISMATCH');
    await handle.close(); await fs.rename(part, file);
    return { ...asset, size: received, bytes: received, sha256: digest, verified: true,
      hashBasis: asset.sha256 ? 'PUBLISHER_OR_RESOLVER_SHA256' : 'RECORDED_FROM_PINNED_OFFICIAL_SOURCE' };
  } catch (error) { await handle.close().catch(() => {}); await fs.unlink(part).catch(() => {}); throw error; }
}

for (const folder of ['manifests', 'wheels', 'models', 'licenses', 'audio', 'logs', 'tmp', 'pip-cache', 'hf-cache']) {
  await fs.mkdir(inside(folder), { recursive: true });
}
if (flags.has('--resolve') || flags.has('--prepare') || flags.has('--install')) {
  try { await fs.access(python); } catch {
    await budget(64 * 1024 ** 2);
    const bundled = path.join(os.homedir(), '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'python', 'python.exe');
    await fs.access(bundled);
    const created = spawnSync(bundled, ['-I', '-m', 'venv', inside('venv')],
      { cwd: project, env: childEnv, windowsHide: true, encoding: 'utf8' });
    if (created.status !== 0) throw Error(`VENV_CREATION_FAILED: ${created.stderr || created.error}`);
  }
  const host = JSON.parse(runPython(['-I', '-c', 'import json,platform,struct; print(json.dumps({"minor":".".join(platform.python_version_tuple()[:2]),"bits":struct.calcsize("P")*8,"implementation":platform.python_implementation()}))'], true));
  if (host.minor !== '3.12' || host.bits !== 64 || host.implementation !== 'CPython') throw Error('CPYTHON_312_X64_REQUIRED');
}
if (flags.has('--resolve')) {
  // Resolver downloads wheel metadata/payloads to project TMP but does not install.
  await budget(512 * 1024 ** 2);
  runPython(['-m', 'pip', 'install', '--dry-run', '--ignore-installed', '--only-binary=:all:', '--no-cache-dir',
    '--report', inside('manifests/resolve.json'), '--index-url', 'https://pypi.org/simple',
    '--extra-index-url', 'https://download.pytorch.org/whl/cpu',
    'torch==2.6.0+cpu', 'kokoro==0.9.4', 'misaki[en]==0.9.4', 'transformers==4.48.3',
    'huggingface-hub==0.28.1', 'spacy==3.8.4', 'soundfile==0.14.0', 'numpy==2.2.2', 'espeakng-loader==0.2.4',
    // spaCy 3.8 imports Click directly. Later Typer releases remove that
    // transitive dependency, despite satisfying spaCy's declared range.
    'typer==0.15.1', 'typer-slim==0.15.1', 'click==8.1.8']);
}
if (!flags.has('--prepare') && !flags.has('--install')) {
  console.log('Candidate resolution saved locally. Default preparation/installation still uses the reviewed source lock; no source lock was changed.');
  process.exit(0);
}
const wheels = sourceLock.assets.filter(asset => asset.package);
const assets = [];
for (const asset of wheels) {
  const item = await download(asset);
  assets.push(item); console.log(`WHEEL ${asset.package} ${item.bytes} bytes`);
  await json('manifests/assets.json', { classification: 'LOCAL_COMPONENT_SETUP', modelRevision: MODEL_REVISION, ...lockReceipt, assets });
}
const zipScript = `import json,zipfile,pathlib,sys
root=pathlib.Path(sys.argv[1]); result=[]
for p in sorted((root/'wheels').glob('*.whl')):
 with zipfile.ZipFile(p) as z:
  entries=z.infolist()
  if any('..' in pathlib.PurePosixPath(i.filename).parts or pathlib.PurePosixPath(i.filename).is_absolute() for i in entries): raise ValueError('unsafe wheel entry')
  result.append({'file':p.name,'compressedBytes':p.stat().st_size,'expandedBytes':sum(i.file_size for i in entries)})
print(json.dumps(result))`;
const expanded = JSON.parse(runPython(['-c', zipScript, root], true));
const expandedBytes = expanded.reduce((sum, w) => sum + w.expandedBytes, 0);
const canonical = value => value.toLowerCase().replace(/[-_.]+/g, '-');
const installedNow = JSON.parse(runPython(['-m', 'pip', 'list', '--format=json'], true));
const installedVersions = new Map(installedNow.map(i => [canonical(i.name), i.version]));
const needed = assets.filter(a => a.package && installedVersions.get(canonical(a.package)) !== a.version);
const neededFiles = new Set(needed.map(a => path.basename(a.file)));
const neededExpandedBytes = expanded.filter(w => neededFiles.has(w.file)).reduce((sum, w) => sum + w.expandedBytes, 0);
const current = await bytes(), modelAllowance = Math.max(0, 350 * 1024 ** 2 - await bytes(inside('models'))), otherAllowance = 64 * 1024 ** 2;
const additional = 2 * neededExpandedBytes + modelAllowance + otherAllowance;
const estimate = { classification: 'PREINSTALL_MEASURED_ARCHIVES_CONSERVATIVE_ESTIMATE',
  createdAt: new Date().toISOString(), capBytes: CAP, freeSpaceReserveBytes: RESERVE,
  currentBytes: current, wheelExpandedBytes: expandedBytes, installationNeededExpandedBytes: neededExpandedBytes,
  installationNeededPackages: needed.map(a => `${a.package}==${a.version}`), installationStagingFactor: 2,
  modelAllowanceBytes: modelAllowance, otherAllowanceBytes: otherAllowance,
  projectedPeakBytes: current + additional, freeBytes: freeBytes(), wheels: expanded };
await json('manifests/budget.json', estimate);
await budget(additional);
console.log(`BUDGET_PASS estimated_peak=${estimate.projectedPeakBytes} cap=${CAP}`);
const models = sourceLock.assets.filter(asset => !asset.package);
for (const asset of models) {
  const item = await download(asset);
  assets.push(item); console.log(`ASSET ${asset.file} ${item.bytes} bytes`);
  await json('manifests/assets.json', { classification: 'LOCAL_COMPONENT_SETUP', modelRevision: MODEL_REVISION, ...lockReceipt, assets });
}
await fs.writeFile(inside('manifests/requirements.lock.txt'), assets.filter(a => a.package)
  .map(a => `${a.package}==${a.version} --hash=sha256:${a.sha256}`).join('\n') + '\n');
if (flags.has('--install')) {
  await budget(2 * neededExpandedBytes + otherAllowance);
  runPython(['-m', 'pip', 'install', '--no-index', '--no-deps', '--no-compile', '--no-cache-dir',
    '--require-hashes', '--find-links', inside('wheels'), '-r', inside('manifests/requirements.lock.txt')]);
  const check = runPython(['-m', 'pip', 'check'], true);
  const freeze = runPython(['-m', 'pip', 'list', '--format=json'], true);
  await fs.writeFile(inside('manifests/installed.json'), freeze);
  await json('manifests/install-receipt.json', { status: 'INSTALLED_CPU_COMPONENT', createdAt: new Date().toISOString(),
    ...lockReceipt,
    pipCheck: check.trim(), disk: await budget(), capBytes: CAP, freeSpaceReserveBytes: RESERVE,
    gameExecution: false, microphoneCapture: false, audioPlayback: false, synthesisPerformed: false });
  console.log(check.trim());
}
