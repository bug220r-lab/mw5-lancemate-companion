// Project-owned installer orchestration. No upstream repository script is run.
import fs from 'node:fs/promises';
import { statfsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const project = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const root = path.join(project, 'companion', 'local', 'tts');
const python = path.join(root, 'venv', 'Scripts', 'python.exe');
const CAP = 4 * 1024 ** 3, RESERVE = 10 * 1024 ** 3;
const MODEL_REVISION = '9871713c6a29032f914cee65b617e2b6b3323770';
const CODE_REVISION = '1c7bdd971d2e32981f0f2b92d1fe5b0051e21457';
const MISAKI_REVISION = 'e820629b96334db28227df37f280e4836d46fadb';
const flags = new Set(process.argv.slice(2));
const allowedHosts = new Set(['pypi.org', 'files.pythonhosted.org', 'download.pytorch.org',
  'download-r2.pytorch.org', 'github.com', 'raw.githubusercontent.com', 'huggingface.co']);
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
  console.log('Use --resolve to refresh resolution, --prepare to fetch/size locked assets, then --install to install only after the budget passes.');
  process.exit(0);
}
const report = JSON.parse(await fs.readFile(inside('manifests/resolve.json'), 'utf8'));
const wheels = report.install.map(item => {
  const url = item.download_info.url, name = decodeURIComponent(new URL(url).pathname.split('/').at(-1));
  const hash = item.download_info.archive_info.hashes?.sha256;
  if (!/^[A-Za-z0-9_.+-]+\.whl$/.test(name) || !/^[a-f0-9]{64}$/.test(hash || '')) throw Error('ONLY_HASHED_WHEELS_ALLOWED');
  if (/^(nvidia-|triton)/i.test(item.metadata.name)) throw Error('CUDA_DEPENDENCY_FORBIDDEN');
  return { package: item.metadata.name, version: item.metadata.version, url, sha256: hash,
    file: `wheels/${name}`, maxBytes: 250 * 1024 ** 2 };
});
if (wheels.find(w => w.package.toLowerCase() === 'torch')?.version !== '2.6.0+cpu') throw Error('CPU_TORCH_REQUIRED');
const spaCyWheel = { package: 'en-core-web-sm', version: '3.8.0',
  url: 'https://github.com/explosion/spacy-models/releases/download/en_core_web_sm-3.8.0/en_core_web_sm-3.8.0-py3-none-any.whl',
  file: 'wheels/en_core_web_sm-3.8.0-py3-none-any.whl', maxBytes: 16 * 1024 ** 2 };
let previous = {};
try { previous = JSON.parse(await fs.readFile(inside('manifests/assets.json'), 'utf8')); } catch {}
const known = new Map((previous.assets || []).map(a => [a.file, a]));
const assets = [];
for (const asset of [...wheels, spaCyWheel]) {
  const prior = known.get(asset.file);
  const item = await download(prior?.url === asset.url ? { ...asset, size: prior.size, sha256: prior.sha256 } : asset);
  assets.push(item); console.log(`WHEEL ${asset.package} ${item.bytes} bytes`);
  await json('manifests/assets.json', { classification: 'LOCAL_COMPONENT_SETUP', modelRevision: MODEL_REVISION, assets });
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
const hub = `https://huggingface.co/hexgrad/Kokoro-82M/resolve/${MODEL_REVISION}`;
const models = [
  { file: 'models/kokoro-v1_0.pth', url: `${hub}/kokoro-v1_0.pth`, size: 327212226, sha256: '496dba118d1a58f5f3db2efc88dbdc216e0483fc89fe6e47ee1f2c53f18ad1e4' },
  { file: 'models/af_heart.pt', url: `${hub}/voices/af_heart.pt`, size: 523425, sha256: '0ab5709b8ffab19bfd849cd11d98f75b60af7733253ad0d67b12382a102cb4ff' },
  { file: 'models/af_bella.pt', url: `${hub}/voices/af_bella.pt`, size: 523425, sha256: '8cb64e02fcc8de0327a8e13817e49c76c945ecf0052ceac97d3081480e8e48d6' },
  { file: 'models/am_adam.pt', url: `${hub}/voices/am_adam.pt`, size: 523420, sha256: 'ced7e284aba12472891be1da3ab34db84cc05cc02b5889535796dbf2d8b0cb34' },
  { file: 'models/config.json', url: `${hub}/config.json`, maxBytes: 65536 },
  { file: 'licenses/Kokoro-model-card.md', url: `${hub}/README.md`, maxBytes: 262144 },
  { file: 'licenses/Kokoro-Apache-2.0.txt', url: `https://raw.githubusercontent.com/hexgrad/kokoro/${CODE_REVISION}/LICENSE`, maxBytes: 65536 },
  { file: 'licenses/Misaki-license.txt', url: `https://raw.githubusercontent.com/hexgrad/misaki/${MISAKI_REVISION}/LICENSE`, maxBytes: 65536 }
];
for (const asset of models) {
  const prior = known.get(asset.file);
  const item = await download(prior?.url === asset.url ? { ...asset, size: prior.size, sha256: prior.sha256 } : asset);
  assets.push(item); console.log(`ASSET ${asset.file} ${item.bytes} bytes`);
  await json('manifests/assets.json', { classification: 'LOCAL_COMPONENT_SETUP', modelRevision: MODEL_REVISION, assets });
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
    pipCheck: check.trim(), disk: await budget(), capBytes: CAP, freeSpaceReserveBytes: RESERVE,
    gameExecution: false, microphoneCapture: false, audioPlayback: false, synthesisPerformed: false });
  console.log(check.trim());
}
