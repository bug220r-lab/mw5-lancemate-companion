// Bounded GGUF metadata inspection, never model execution.
import { open, readFile, lstat, writeFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { SMOLLM_PIN } from './Install-SmollmCandidate.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
export function inspectMetadata(b) {
  let p = 0;
  function advance(size) { if (!Number.isSafeInteger(size) || size < 0 || p + size > b.length) throw Error('METADATA_BOUND'); const at = p; p += size; return at; }
  function u32() { return b.readUInt32LE(advance(4)); }
  function u64() { const x = b.readBigUInt64LE(advance(8)); if (x > BigInt(Number.MAX_SAFE_INTEGER)) throw Error('COUNT_BOUND'); return Number(x); }
  function str(keep) { const size = u64(), at = advance(size); return keep ? b.toString('utf8', at, at + size) : undefined; }
  function value(type, keep = false, depth = 0) {
    if (depth > 2) throw Error('ARRAY_DEPTH_BOUND');
    if (type === 8) return str(keep);
    if (type === 9) { const t = u32(), count = u64(); if (count > 1000000) throw Error('ARRAY_BOUND'); for (let i = 0; i < count; i++) value(t, false, depth + 1); return; }
    const size = { 0:1, 1:1, 2:2, 3:2, 4:4, 5:4, 6:4, 7:1, 10:8, 11:8, 12:8 }[type];
    if (!size) throw Error('UNSUPPORTED_TYPE'); advance(size);
  }
  const magicAt = advance(4);
  if (b.toString('ascii', magicAt, magicAt + 4) !== 'GGUF') throw Error('MAGIC');
  const version = u32(), tensors = u64(), keys = u64();
  if (version !== 3 || keys > 1000) throw Error('HEADER_BOUND');
  const selected = {}, wanted = new Set(['general.architecture', 'general.name', 'tokenizer.chat_template']);
  for (let i = 0; i < keys; i++) {
    const key = str(true), type = u32(), v = value(type, wanted.has(key));
    if (wanted.has(key)) { if (Object.hasOwn(selected, key)) throw Error('DUPLICATE_METADATA'); selected[key] = v; }
  }
  if (selected['general.architecture'] !== 'smollm3' || typeof selected['tokenizer.chat_template'] !== 'string') throw Error('METADATA_IDENTITY');
  return { version, tensors, keys, metadataEnd: p, selected, templateSha256: hash(selected['tokenizer.chat_template']) };
}
export async function main(args) {
  if (args.length) throw Error('INVALID_ARGUMENTS');
  const setupBytes = await readFile(path.join(root, 'research/SMOLLM3_SETUP.json'));
  const setup = JSON.parse(setupBytes);
  if (setup.status !== 'VERIFIED_DOWNLOAD' || setup.artifact.sha256 !== SMOLLM_PIN.sha256) throw Error('SETUP_NOT_VERIFIED');
  const file = path.join(root, 'companion/local/models', SMOLLM_PIN.name), s = await lstat(file);
  if (!s.isFile() || s.isSymbolicLink() || s.size !== SMOLLM_PIN.bytes) throw Error('MODEL_FILE_MISMATCH');
  const digest = createHash('sha256'); for await (const part of createReadStream(file)) digest.update(part);
  if (digest.digest('hex') !== SMOLLM_PIN.sha256) throw Error('MODEL_FILE_MISMATCH');
  const f = await open(file, 'r'), b = Buffer.alloc(32 * 1024 ** 2);
  let n; try { n = (await f.read(b, 0, b.length, 0)).bytesRead; } finally { await f.close(); }
  const report = { classification: 'OBSERVED_LOCAL_FILE_METADATA_NOT_NATIVE_EXECUTION', recordedAt: new Date().toISOString(),
    model: SMOLLM_PIN, setupReceiptSha256: hash(setupBytes), ...inspectMetadata(b.subarray(0, n)), nativeExecution: 'NOT_PERFORMED' };
  await writeFile(path.join(root, 'research/SMOLLM3_METADATA.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify(report));
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url)
  main(process.argv.slice(2)).catch(e => { console.error(e.message); process.exitCode = 1; });
