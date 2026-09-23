// Independent setup review. Tiny in-memory streams only; no model download/run.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { Readable, Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const moduleUrl=new URL('../../scripts/Install-SmollmCandidate.mjs',import.meta.url);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const lock=JSON.parse(await readFile(new URL('../models.lock.json',import.meta.url)));
let installer;

test('import has no network side effects and only explicit fixed CLI argument forms are admitted',async()=>{
  const saved=globalThis.fetch;let calls=0;
  globalThis.fetch=()=>{calls++;throw Error('NETWORK_FORBIDDEN_IN_REVIEW');};
  try{
    installer=await import(moduleUrl.href);
    assert.equal(calls,0);
    for(const args of [[],['--install'],['--download','--url','https://elsewhere.invalid/file'],['--check','extra'],null])
      await assert.rejects(installer.installCandidate(args),/INVALID_ARGUMENTS/);
    assert.equal(calls,0);
  }finally{globalThis.fetch=saved;}
});

test('candidate lock is tied to the immutable public artifact and each changed pin or duplicate is rejected',async()=>{
  installer??=await import(moduleUrl.href);
  const p=installer.SMOLLM_PIN;
  assert.equal(p.id,'smollm3_3b');assert.equal(p.version,'4965cb60b150737b68a0408c36aeefb65078f894');
  assert.equal(p.bytes,1915305312);assert.equal(p.sha256,'8334b850b7bd46238c16b0c550df2138f0889bf433809008cc17a8b05761863e');
  assert.equal(p.name,'SmolLM3-Q4_K_M.gguf');assert.equal(p.license,'Apache-2.0');
  const u=new URL(p.url);assert.equal(u.protocol,'https:');assert.equal(u.host,'huggingface.co');assert.equal(u.username,'');assert.equal(u.password,'');
  assert.equal(u.pathname,`/ggml-org/SmolLM3-3B-GGUF/resolve/${p.version}/${p.name}`);
  assert.equal(p.licenseDeclarationUrl,`https://huggingface.co/ggml-org/SmolLM3-3B-GGUF/raw/${p.version}/README.md`);
  assert.equal(p.licenseUrl,'https://www.apache.org/licenses/LICENSE-2.0.txt');assert.equal(Object.isFrozen(p),true);
  assert.equal(installer.checkCandidateLock(lock),p);
  for(const key of Object.keys(p)){
    const altered=structuredClone(lock),entry=altered.artifacts.find(a=>a.id===p.id);
    entry[key]=typeof entry[key]==='number'?entry[key]+1:entry[key]+'-changed';
    assert.throws(()=>installer.checkCandidateLock(altered),/CANDIDATE_PIN_MISMATCH/,key);
  }
  const duplicated=structuredClone(lock);duplicated.artifacts.push({...p});
  assert.throws(()=>installer.checkCandidateLock(duplicated),/CANDIDATE_PIN_MISMATCH/);
  assert.throws(()=>installer.checkCandidateLock({artifacts:[]}));assert.throws(()=>installer.checkCandidateLock(null));
});

test('adding the candidate preserves the Qwen and runtime pins recorded in earlier native receipts',async()=>{
  for(const name of ['QWEN17B_SEPARATED_REQUEST_DIAGNOSTIC.json','QWEN4B_RELATIVE_FACTS_ATTEMPT_002.json']){
    const historical=JSON.parse(await readFile(new URL(`../../research/${name}`,import.meta.url)));
    for(const p of historical.modelPins)assert.deepEqual(lock.artifacts.find(a=>a.id===p.id),p);
  }
});

test('storage admission counts two complete copies plus cache and the unchanged ten-GiB reserve',async()=>{
  installer??=await import(moduleUrl.href);
  const GiB=2**30,required=2*1915305312+2**20+10*GiB;
  const admitted=installer.candidateStoragePlan(required);assert.equal(admitted.ok,true);
  assert.equal(admitted.requiredBytes,required);assert.equal(admitted.remainingBytes,10*GiB);assert.equal(admitted.reserveBytes,10*GiB);
  assert.equal(installer.candidateStoragePlan(required-1).ok,false);
  assert.equal(installer.candidateStoragePlan(1915305312+10*GiB).ok,false);
  for(const bad of [undefined,null,NaN,Infinity,-1,1.2,Number.MAX_SAFE_INTEGER+1])assert.equal(installer.candidateStoragePlan(bad).ok,false);
});

async function transfer(parts,pin){
  installer??=await import(moduleUrl.href);
  const collected=[];
  const output=new Writable({write(chunk,_encoding,next){collected.push(Buffer.from(chunk));next();}});
  let error;try{await pipeline(Readable.from(parts),installer.pinTransform(pin),output);}catch(e){error=e;}
  return{error,bytes:Buffer.concat(collected)};
}

test('exact content remains byte-identical through arbitrary chunk boundaries',async()=>{
  const bytes=Buffer.from('tiny\0binary\xfffixture','latin1'),pin={bytes:bytes.length,sha256:hash(bytes)};
  for(const parts of [[bytes],[bytes.subarray(0,1),bytes.subarray(1,7),bytes.subarray(7)],Array.from(bytes,b=>Buffer.from([b]))]){
    const result=await transfer(parts,pin);assert.equal(result.error,undefined);assert.deepEqual(result.bytes,bytes);
  }
});

test('an oversized chunk is rejected before that chunk reaches the destination',async()=>{
  const allowed=Buffer.from('abcd'),pin={bytes:allowed.length,sha256:hash(allowed)};
  const result=await transfer([Buffer.from('ab'),Buffer.from('cdef')],pin);
  assert.equal(result.error?.message,'DOWNLOAD_SIZE_EXCEEDED');assert.deepEqual(result.bytes,Buffer.from('ab'));
});

test('short and same-size corrupted transfers cannot finish successfully',async()=>{
  const good=Buffer.from('verified-data'),pin={bytes:good.length,sha256:hash(good)};
  const short=await transfer([good.subarray(0,-1)],pin);
  assert.equal(short.error?.message,'DOWNLOAD_HASH_OR_SIZE_MISMATCH');
  const changed=Buffer.from(good);changed[3]^=1;
  assert.equal((await transfer([changed],pin)).error?.message,'DOWNLOAD_HASH_OR_SIZE_MISMATCH');
});

test('an upstream stream failure cannot be mistaken for a verified completed download',async()=>{
  installer??=await import(moduleUrl.href);
  async function* chunks(){yield Buffer.from('abc');throw Error('SIMULATED_STREAM_FAILURE');}
  const output=new Writable({write(_chunk,_encoding,next){next();}});
  await assert.rejects(pipeline(Readable.from(chunks()),installer.pinTransform({bytes:6,sha256:hash(Buffer.from('abcdef'))}),output),/SIMULATED_STREAM_FAILURE/);
});
