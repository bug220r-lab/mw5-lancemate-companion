// Project-authored downloader. Only the exact hash-pinned allowlist is admitted.
// Downloads do not execute archives, models or upstream installer scripts.
import { readFile, mkdir, stat, statfs, rename, writeFile } from 'node:fs/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { Transform, Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { storagePreflight } from '../companion/benchmark.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const destination = path.join(root, 'companion', 'local', 'models');
const manifest = JSON.parse(await readFile(path.join(root, 'companion', 'models.lock.json'), 'utf8'));
const GiB = 1024 ** 3;
await mkdir(destination, { recursive: true });
const hashFile = async file => { const hash = createHash('sha256'); for await (const part of createReadStream(file)) hash.update(part); return hash.digest('hex'); };
const remaining = [], verified = [];
for (const item of manifest.artifacts) {
  if (!/^[A-Za-z0-9_.-]+$/.test(item.name) || !/^[a-f0-9]{64}$/.test(item.sha256) ||
      !Number.isSafeInteger(item.bytes) || item.bytes < 1 ||
      !['https://github.com/', 'https://huggingface.co/'].some(prefix => item.url.startsWith(prefix))) throw new Error('INVALID_LOCK');
  const file = path.join(destination, item.name);
  try {
    if ((await stat(file)).size !== item.bytes || await hashFile(file) !== item.sha256) throw new Error('EXISTING_ARTIFACT_MISMATCH');
    verified.push({ id: item.id, file: path.relative(root, file), sha256: item.sha256, bytes: item.bytes, status: 'VERIFIED_EXISTING' });
  } catch (error) { if (error.code === 'ENOENT') remaining.push(item); else throw error; }
}
const free = await statfs(destination), freeBytes = free.bavail * free.bsize;
// Upper-bound budgets, separate from the invariant 10 GiB working reserve:
// 1 GiB archive expansion + 1 GiB future cache + 4 GiB reserved for TTS dependencies.
const preflight = storagePreflight({ freeBytes, downloadsBytes: remaining.reduce((sum, item) => sum + item.bytes, 0),
  stagingBytes: GiB, cacheBytes: 5 * GiB });
const receipt = { schemaVersion: 1, startedAt: new Date().toISOString(), preflight,
  classification: 'LOCAL_COMPONENT_SETUP', artifacts: verified, execution: 'NOT_PERFORMED' };
await writeFile(path.join(destination, 'installation-receipt.json'), JSON.stringify(receipt, null, 2));
console.log(JSON.stringify({ preflight, remaining: remaining.map(i => ({ id: i.id, bytes: i.bytes })) }));
if (!preflight.ok) throw new Error('STORAGE_PREFLIGHT_FAILED');
for (const item of remaining) {
  const file = path.join(destination, item.name), partial = `${file}.partial`;
  const checkFree = await statfs(destination);
  if (checkFree.bavail * checkFree.bsize < item.bytes + 10 * GiB) throw new Error('WORKING_RESERVE_AT_RISK');
  console.log(`Downloading ${item.id} (${item.bytes} bytes)`);
  const response = await fetch(item.url, { signal: AbortSignal.timeout(20 * 60 * 1000) });
  if (!response.ok || !response.body) throw new Error(`DOWNLOAD_HTTP_${response.status}`);
  let bytes = 0; const digest = createHash('sha256');
  const limit = new Transform({ transform(chunk, encoding, done) {
    bytes += chunk.length; if (bytes > item.bytes) return done(new Error('DOWNLOAD_SIZE_EXCEEDED'));
    digest.update(chunk); done(null, chunk);
  } });
  await pipeline(Readable.fromWeb(response.body), limit, createWriteStream(partial, { flags: 'wx' }));
  if (bytes !== item.bytes || digest.digest('hex') !== item.sha256) throw new Error('DOWNLOAD_HASH_OR_SIZE_MISMATCH');
  await rename(partial, file);
  receipt.artifacts.push({ id: item.id, file: path.relative(root, file), sha256: item.sha256, bytes, status: 'VERIFIED_DOWNLOAD' });
  const license = await fetch(item.licenseUrl, { signal: AbortSignal.timeout(30000) });
  if (!license.ok) throw new Error(`LICENSE_HTTP_${license.status}`);
  const text = await license.text(); if (text.length > 100000) throw new Error('LICENSE_SIZE_LIMIT');
  const licenseFile = `${item.id}-LICENSE.txt`;
  await writeFile(path.join(destination, licenseFile), text);
  receipt.artifacts.at(-1).license = { file: licenseFile, sha256: createHash('sha256').update(text).digest('hex'), source: item.licenseUrl };
  await writeFile(path.join(destination, 'installation-receipt.json'), JSON.stringify(receipt, null, 2));
  console.log(`Verified ${item.id}`);
}
receipt.completedAt = new Date().toISOString();
receipt.freeBytesAfter = (await statfs(destination)).bavail * free.bsize;
await writeFile(path.join(destination, 'installation-receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
console.log('All locked artifacts verified. No upstream scripts or binaries executed.');
