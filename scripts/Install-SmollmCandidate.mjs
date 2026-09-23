// Fixed candidate data transfer only. Imports and --check never download or execute.
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { lstat, realpath, readFile, open, statfs, link } from 'node:fs/promises';
import { Transform, Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { storagePreflight } from '../companion/benchmark.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const models = path.join(root, 'companion/local/models');
const GiB = 1024 ** 3;
export const SMOLLM_PIN = Object.freeze({ id: 'smollm3_3b', version: '4965cb60b150737b68a0408c36aeefb65078f894',
  name: 'SmolLM3-Q4_K_M.gguf', bytes: 1915305312,
  sha256: '8334b850b7bd46238c16b0c550df2138f0889bf433809008cc17a8b05761863e',
  url: 'https://huggingface.co/ggml-org/SmolLM3-3B-GGUF/resolve/4965cb60b150737b68a0408c36aeefb65078f894/SmolLM3-Q4_K_M.gguf',
  license: 'Apache-2.0', licenseUrl: 'https://www.apache.org/licenses/LICENSE-2.0.txt',
  licenseDeclarationUrl: 'https://huggingface.co/ggml-org/SmolLM3-3B-GGUF/raw/4965cb60b150737b68a0408c36aeefb65078f894/README.md' });
export const SMOLLM_SETUP_RECEIPT = 'research/SMOLLM3_SETUP.json';
const licensePin = { bytes: 11358, sha256: 'cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30' };
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
export function checkCandidateLock(lock) {
  const matches = lock?.artifacts?.filter(x => x.id === SMOLLM_PIN.id);
  if (matches?.length !== 1 || Object.entries(SMOLLM_PIN).some(([k,v]) => matches[0][k] !== v)) throw Error('CANDIDATE_PIN_MISMATCH');
  return SMOLLM_PIN;
}
export function candidateStoragePlan(freeBytes) {
  // Conservative two-copy budget even though final publication uses a hard link.
  return storagePreflight({ freeBytes, downloadsBytes: SMOLLM_PIN.bytes,
    stagingBytes: SMOLLM_PIN.bytes, cacheBytes: 1024 ** 2, reserveBytes: 10 * GiB });
}
export function pinTransform(pin) {
  let bytes = 0; const digest = createHash('sha256');
  return new Transform({ transform(chunk, encoding, done) {
    bytes += chunk.length;
    if (bytes > pin.bytes) return done(Error('DOWNLOAD_SIZE_EXCEEDED'));
    digest.update(chunk); done(null, chunk);
  }, flush(done) {
    done(bytes === pin.bytes && digest.digest('hex') === pin.sha256 ? null : Error('DOWNLOAD_HASH_OR_SIZE_MISMATCH'));
  } });
}
async function containedDirectory(dir) {
  const resolvedRoot = await realpath(root);
  let at = root;
  for (const part of path.relative(root, dir).split(path.sep)) {
    at = path.join(at, part); const s = await lstat(at);
    if (s.isSymbolicLink() || !s.isDirectory()) throw Error('UNSAFE_SETUP_DIRECTORY');
  }
  if (await realpath(dir) !== path.join(resolvedRoot, path.relative(root, dir))) throw Error('UNSAFE_SETUP_DIRECTORY');
}
async function absent(file) {
  try { await lstat(file); throw Error('SETUP_FILE_ALREADY_EXISTS'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
}
async function freeBytes() { const s = await statfs(models); return s.bavail * s.bsize; }
async function verifyFile(file, pin) {
  const s = await lstat(file); if (!s.isFile() || s.isSymbolicLink() || s.size !== pin.bytes) throw Error('LOCAL_FILE_MISMATCH');
  const digest = createHash('sha256'); for await (const chunk of createReadStream(file)) digest.update(chunk);
  if (digest.digest('hex') !== pin.sha256) throw Error('LOCAL_FILE_MISMATCH');
}
export async function installCandidate(args) {
  if (!Array.isArray(args) || args.length !== 1 || !['--check', '--download'].includes(args[0])) throw Error('INVALID_ARGUMENTS');
  const lockBytes = await readFile(path.join(root, 'companion/models.lock.json'));
  checkCandidateLock(JSON.parse(lockBytes));
  await containedDirectory(models); await containedDirectory(path.join(root, 'research'));
  const target = path.join(models, SMOLLM_PIN.name), partial = target + '.candidate-partial';
  const licenseFile = path.join(models, 'smollm3_3b-LICENSE.txt');
  for (const f of [target, partial, licenseFile, path.join(root, SMOLLM_SETUP_RECEIPT)]) await absent(f);
  const free = await freeBytes(), preflight = candidateStoragePlan(free);
  const report = { schemaVersion: 1, classification: 'LOCAL_COMPONENT_SETUP', startedAt: new Date().toISOString(),
    status: preflight.ok ? 'PREPARED_NOT_DOWNLOADED' : 'STORAGE_REFUSED', initialFreeBytes: free, preflight,
    artifact: SMOLLM_PIN, lockSha256: sha(lockBytes), licensePin, downloads: false,
    licenseDownloadAttempted: false, modelDownloadAttempted: false, execution: 'NOT_PERFORMED',
    defaultModelChanged: false, gameExecution: false, editorExecution: false, priorReceiptsChanged: false };
  if (args[0] === '--check') return report;
  // Exclusive reservation precedes network or files; a completed/failed attempt is not overwritten.
  const receipt = await open(path.join(root, SMOLLM_SETUP_RECEIPT), 'wx');
  const save = async () => { const b = Buffer.from(JSON.stringify(report, null, 2) + '\n');
    await receipt.write(b, 0, b.length, 0); await receipt.truncate(b.length); await receipt.sync(); };
  try {
    await save(); if (!preflight.ok) throw Error('STORAGE_PREFLIGHT_FAILED');
    // Fetch/pin the license first. No credentials, cookies, paid endpoint or package installer.
    report.status = 'DOWNLOADING_LICENSE'; report.downloads = true; report.licenseDownloadAttempted = true; await save();
    const license = await fetch(SMOLLM_PIN.licenseUrl, { signal: AbortSignal.timeout(30000), credentials: 'omit' });
    if (!license.ok || !license.body) throw Error('LICENSE_HTTP_FAILURE');
    await pipeline(Readable.fromWeb(license.body), pinTransform(licensePin), createWriteStream(licenseFile, { flags: 'wx' }));
    report.license = { path: path.relative(root, licenseFile), ...licensePin };
    const atTransfer = await freeBytes();
    if (!candidateStoragePlan(atTransfer).ok) throw Error('WORKING_RESERVE_AT_RISK');
    report.status = 'DOWNLOADING_MODEL'; report.modelDownloadAttempted = true; await save();
    const response = await fetch(SMOLLM_PIN.url, { signal: AbortSignal.timeout(20 * 60 * 1000), credentials: 'omit' });
    if (!response.ok || !response.body) throw Error('DOWNLOAD_HTTP_FAILURE');
    let sampled = 0, transferred = 0;
    const reserve = new Transform({ transform(chunk, encoding, done) {
      transferred += chunk.length;
      if (transferred - sampled < 16 * 1024 ** 2) { done(null, chunk); return; }
      sampled = transferred;
      freeBytes().then(n => done(n < 10 * GiB ? Error('WORKING_RESERVE_LOST') : null, chunk), done);
    } });
    await pipeline(Readable.fromWeb(response.body), pinTransform(SMOLLM_PIN), reserve, createWriteStream(partial, { flags: 'wx' }));
    await verifyFile(partial, SMOLLM_PIN);
    // link() fails on an existing target. Retain the verified staging hard link;
    // it shares the same bytes on NTFS and no unrelated file is deleted or moved.
    await link(partial, target); await verifyFile(target, SMOLLM_PIN);
    report.status = 'VERIFIED_DOWNLOAD'; report.file = path.relative(root, target);
    report.stagingPath = path.relative(root, partial); report.stagingSharesSameFileData = true;
    report.finalFreeBytes = await freeBytes();
    if (report.finalFreeBytes < 10 * GiB) throw Error('WORKING_RESERVE_LOST');
  } catch (error) { report.status = 'FAILED'; report.error = error.message; }
  finally { report.completedAt = new Date().toISOString(); try { await save(); } finally { await receipt.close(); } }
  return report;
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url)
  installCandidate(process.argv.slice(2)).then(r => { console.log(JSON.stringify(r));
    if (!['PREPARED_NOT_DOWNLOADED', 'VERIFIED_DOWNLOAD'].includes(r.status)) process.exitCode = 1;
  }).catch(e => { console.error(e.message); process.exitCode = 1; });
