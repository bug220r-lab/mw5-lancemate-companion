// Synthetic binary metadata only. No model, process, network or file mutation.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { inspectMetadata } from '../../scripts/Inspect-SmollmMetadata.mjs';
const u32 = n => { const b = Buffer.alloc(4); b.writeUInt32LE(n); return b; };
const u64 = n => { const b = Buffer.alloc(8); b.writeBigUInt64LE(BigInt(n)); return b; };
const str = s => { const b = Buffer.from(s); return Buffer.concat([u64(b.length), b]); };
const fields = [['general.architecture', 'smollm3'], ['general.name','tiny fixture'], ['tokenizer.chat_template','{{ messages }} /no_think']];
const binary = (rows = fields) => Buffer.concat([Buffer.from('GGUF'),u32(3),u64(1),u64(rows.length),
  ...rows.map(([k,v]) => Buffer.concat([str(k),u32(8),str(v)]))]);
test('bounded metadata extraction retains exact template and hashes its actual text', () => {
  const b = binary(), r = inspectMetadata(b);
  assert.equal(r.version,3); assert.equal(r.tensors,1); assert.equal(r.keys,3); assert.equal(r.metadataEnd,b.length);
  assert.equal(r.selected['tokenizer.chat_template'],fields[2][1]);
  assert.equal(r.templateSha256,createHash('sha256').update(fields[2][1]).digest('hex'));
});
test('partial metadata never becomes a valid template or inferred identity', () => {
  const b = binary(); for (const n of [0,3,20,b.length-1]) assert.throws(() => inspectMetadata(b.subarray(0,n)), /METADATA_BOUND/);
});
test('wrong architecture and missing template refuse rather than treating arbitrary bytes as a candidate', () => {
  assert.throws(() => inspectMetadata(binary([['general.architecture','llama'],fields[2]])), /METADATA_IDENTITY/);
  assert.throws(() => inspectMetadata(binary(fields.slice(0,2))), /METADATA_IDENTITY/);
});
test('duplicate selected keys and unsupported header versions refuse ambiguous interpretation', () => {
  assert.throws(() => inspectMetadata(binary([...fields,fields[2]])), /DUPLICATE_METADATA/);
  const b = binary(); b.writeUInt32LE(2,4); assert.throws(() => inspectMetadata(b), /HEADER_BOUND/);
});
