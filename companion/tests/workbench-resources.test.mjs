// Injected resource/lifecycle tests only: no native workers, devices or services.
import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate as turn } from 'node:timers/promises';
import { createWorkbenchResources, WORKBENCH_RESOURCE_POLICY as P } from '../workbench-resources.mjs';
import { createWorkbench } from '../server.mjs';

const GiB = 1024 ** 3;
function deferred() { let resolve, reject; const promise = new Promise((a,b) => { resolve=a; reject=b; }); return {promise,resolve,reject}; }
async function flush() { await turn(); await turn(); }
function clock() {
  let at=0; const jobs=new Map();
  return { now:()=>at, setTimeout(fn,ms) { const key={unref(){}}; jobs.set(key,{fn,at:at+ms}); return key; },
    clearTimeout:key=>jobs.delete(key), get count(){return jobs.size;},
    async advance(ms) { const end=at+ms; let count=0;
      for (;;) { const next=[...jobs].filter(([,j])=>j.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];
        if (!next) break; if (++count>100) throw Error('TIMER_LOOP');
        jobs.delete(next[0]); at=next[1].at; next[1].fn(); await flush(); }
      at=end; await flush(); }
  };
}
function policy(extra={}) { const time=clock(); let ramCalls=0,diskCalls=0;
  const r=createWorkbenchResources({ ...time, freemem:()=>{ramCalls++;return 6*GiB;},
    statfs:async()=>{diskCalls++;return {bavail:20*GiB,bsize:1};}, ...extra });
  return {r,time,get ramCalls(){return ramCalls;},get diskCalls(){return diskCalls;}};
}

test('construction and inactive status perform no reads or schedule work', async()=>{
  const f=policy(); assert.equal(f.r.status().monitoring,false); await f.time.advance(5000);
  assert.equal(f.ramCalls,0); assert.equal(f.diskCalls,0); assert.equal(f.time.count,0);
});
for (const [name,ram,disk,code] of [
  ['RAM below',5*GiB-1,10*GiB,'RESOURCE_ADMISSION_RAM'],
  ['disk below',5*GiB,10*GiB-1,'RESOURCE_ADMISSION_DISK'],
  ['exact thresholds',5*GiB,10*GiB,null],
  ['unknown RAM',NaN,10*GiB,'RESOURCE_READING_UNAVAILABLE'],
  ['negative RAM',-1,10*GiB,'RESOURCE_READING_UNAVAILABLE'],
  ['unknown disk',5*GiB,undefined,'RESOURCE_READING_UNAVAILABLE'],
]) test(`admission ${name}`,async()=>{
  const f=policy({freemem:()=>ram,statfs:async()=>({bavail:disk,bsize:1})});
  if(code) await assert.rejects(f.r.admit(),{code}); else assert.equal((await f.r.admit()).availableRamBytes,ram);
  assert.equal(f.r.status().cleanupPending,false); assert.equal(f.time.count,0);
});
test('admission samples RAM after disk has completed',async()=>{
  const disk=deferred(); let ram=6*GiB,reads=0;
  const f=policy({statfs:()=>disk.promise,freemem:()=>{reads++;return ram;}});
  const pending=f.r.admit(); await flush(); assert.equal(reads,0); ram=4*GiB;
  disk.resolve({bavail:20*GiB,bsize:1}); await assert.rejects(pending,{code:'RESOURCE_ADMISSION_RAM'});
});
test('cancelled admission settles without releasing pending disk ownership',async()=>{
  const disk=deferred(),f=policy({statfs:()=>disk.promise});
  const pending=f.r.admit(); const rejected=assert.rejects(pending,{code:'RESOURCE_ADMISSION_CANCELLED'});
  await flush(); f.r.stopWatch(); await rejected;
  assert.equal(f.r.status().cleanupPending,true);
  await assert.rejects(f.r.admit(),{code:'RESOURCE_CLEANUP_PENDING'});
  disk.resolve({bavail:20*GiB,bsize:1}); await flush();
  assert.equal(f.r.status().cleanupPending,false); assert.equal(f.r.status().lastSample,null);
});
test('timed out admission retains ownership until underlying read drains',async()=>{
  const disk=deferred(),f=policy({statfs:()=>disk.promise});
  const rejected=assert.rejects(f.r.admit(),{code:'RESOURCE_SAMPLE_TIMEOUT'}); await flush();
  await f.time.advance(P.sampleTimeoutMs); await rejected;
  assert.equal(f.r.status().cleanupPending,true); assert.equal(f.diskCalls,0);
  disk.resolve({bavail:20*GiB,bsize:1}); await flush(); assert.equal(f.r.status().cleanupPending,false);
});
test('healthy watchdog samples only RAM and is not cleanup',async()=>{
  const ram=deferred(); let reads=0; const f=policy({freemem:()=>{reads++;return reads===1?6*GiB:ram.promise;}});
  await f.r.admit(); const breaches=[]; f.r.startWatch(code=>breaches.push(code));
  await f.time.advance(250); assert.equal(f.r.status().sampling,true); assert.equal(f.r.status().cleanupPending,false);
  await f.time.advance(500); assert.equal(reads,2); assert.equal(f.diskCalls,1);
  ram.resolve(2*GiB); await flush(); assert.deepEqual(breaches,[]); f.r.stopWatch();
});
test('watchdog timeout breaches once, cannot overlap or restart over pending sample',async()=>{
  const ram=deferred(),f=policy({freemem:()=>ram.promise}),breaches=[];
  f.r.startWatch(code=>breaches.push(code)); await f.time.advance(250+P.sampleTimeoutMs);
  assert.deepEqual(breaches,['RESOURCE_SAMPLE_TIMEOUT']); assert.equal(f.r.status().cleanupPending,true);
  assert.throws(()=>f.r.startWatch(()=>{}),{code:'RESOURCE_CLEANUP_PENDING'});
  await f.time.advance(5000); assert.equal(breaches.length,1);
  ram.resolve(6*GiB); await flush(); assert.equal(f.r.status().cleanupPending,false);
});
test('unknown watchdog result fails closed and raw I/O exception is redacted',async()=>{
  const f=policy({freemem:()=>{throw Error('private detail');}}),breaches=[];
  f.r.startWatch(code=>breaches.push(code)); await f.time.advance(250);
  assert.deepEqual(breaches,['RESOURCE_READING_UNAVAILABLE']); assert.equal(JSON.stringify(f.r.status()).includes('private'),false);
});
test('watchdog stops without reading when all owned engines are inactive',async()=>{
  const f=policy(); f.r.startWatch(()=>assert.fail(),()=>false); await f.time.advance(250);
  assert.equal(f.r.status().monitoring,false); assert.equal(f.ramCalls,0); assert.equal(f.time.count,0);
});

async function workbench(t,{languageStart=null,speechStart=null,resource=null,languageStop=null}={}) {
  const language={current:'NEW',starts:0,stops:0,status(){return {state:this.current};},
    async start(){this.starts++;this.current='STARTING';if(languageStart)await languageStart.promise;this.current='READY';},
    async stop(){this.stops++;if(languageStop)await languageStop.promise;this.current='STOPPED';},generate:async()=> 'Ready.'};
  const speech={current:'NEW',starts:0,stops:0,getState(){return {state:this.current,restartRequired:false};},
    async start(){this.starts++;this.current='STARTING';if(speechStart)await speechStart.promise;this.current='READY';},
    async stop(){this.stops++;this.current='STOPPED';},synthesize:async()=>({wavPath:'FAKE'})};
  const f=resource??policy();
  const w=await createWorkbench({settingsPath:'companion/local/nonexistent-resource-test-settings.json',
    languageModel:language,speechEngine:speech,resourcePolicy:f.r,residentStopTimeoutMs:20});
  t.after(async()=>{languageStart?.resolve();speechStart?.resolve();languageStop?.resolve();await flush();await w.dispose();f.r.stopWatch();});
  return {w,language,speech,...f};
}
test('second-engine low admission reaps the first engine without starting speech',async t=>{
  let samples=0;const f=await workbench(t,{resource:policy({freemem:()=>++samples===1?6*GiB:4*GiB})});
  await f.w.act({type:'models_start'}); await flush();
  assert.equal(f.language.starts,1); assert.equal(f.speech.starts,0); assert.equal(f.language.current,'STOPPED');
  assert.equal(f.w.state().localModels.error,'RESOURCE_ADMISSION_RAM'); assert.equal(f.r.status().monitoring,false);
});
test('stop during pending admission is responsive, rejects replacement and discards late result',async t=>{
  const disk=deferred(),f=await workbench(t,{resource:policy({statfs:()=>disk.promise})});
  await f.w.act({type:'models_start'}); await flush(); await f.w.act({type:'models_stop'});
  assert.equal(f.w.state().localModels.cleanupPending,true); assert.equal(f.language.starts,0);
  await assert.rejects(f.w.act({type:'models_start'}),/LOCAL_MODEL_CLEANUP_PENDING/);
  disk.resolve({bavail:20*GiB,bsize:1}); await flush();
  assert.equal(f.language.starts,0); assert.equal(f.w.state().localModels.cleanupPending,false);
});
test('late startup after stop is reaped and never starts the second engine',async t=>{
  const start=deferred(),f=await workbench(t,{languageStart:start});
  await f.w.act({type:'models_start'});await flush();assert.equal(f.language.starts,1);
  await f.w.act({type:'models_stop'});await assert.rejects(f.w.act({type:'models_start'}),/LOCAL_MODEL_CLEANUP_PENDING/);
  start.resolve();await flush();assert.equal(f.language.current,'STOPPED');assert.equal(f.speech.starts,0);
  assert.ok(f.language.stops>=2);assert.equal(f.w.state().localModels.cleanupPending,false);
});
test('duplicate Start during healthy startup retains one owner and stop still cancels it',async t=>{
  const start=deferred(),resource=policy(),f=await workbench(t,{languageStart:start,resource});
  await f.w.act({type:'models_start'});await flush();
  const duplicate=await f.w.act({type:'models_start'});
  assert.equal(duplicate.last.status,'STARTING_LOCAL_MODELS');assert.equal(f.language.starts,1);
  assert.equal(resource.diskCalls,1);assert.equal(f.speech.starts,0);
  await f.w.act({type:'models_stop'});
  await assert.rejects(f.w.act({type:'models_start'}),/LOCAL_MODEL_CLEANUP_PENDING/);
  start.resolve();await flush();assert.equal(f.speech.starts,0);assert.equal(f.language.current,'STOPPED');
});
test('bounded public stop retains pending engine ownership until actual stop settles',async t=>{
  const stop=deferred(),f=await workbench(t,{languageStop:stop});
  await f.w.act({type:'models_start'});await flush();const result=await f.w.act({type:'models_stop'});
  assert.equal(result.last.status,'LOCAL_MODEL_STOP_UNCONFIRMED');assert.equal(result.localModels.stopping,true);
  await assert.rejects(f.w.act({type:'models_start'}),/LOCAL_MODEL_CLEANUP_PENDING/);
  stop.resolve();await flush();assert.equal(f.w.state().localModels.stopping,false);
});
test('a second completed Start keeps the watchdog effective',async t=>{
  let ram=6*GiB;const f=await workbench(t,{resource:policy({freemem:()=>ram})});
  await f.w.act({type:'models_start'});await flush();await f.w.act({type:'models_start'});
  assert.equal(f.language.starts,1);assert.equal(f.speech.starts,1);
  ram=2*GiB-1;await f.time.advance(250);
  assert.equal(f.language.current,'STOPPED');assert.equal(f.speech.current,'STOPPED');
  assert.equal(f.w.state().localModels.error,'RESOURCE_RAM_RESERVE_LOST');
});
test('watchdog retains failed-engine ownership until closure is confirmed',async t=>{
  let ram=6*GiB;const f=await workbench(t,{resource:policy({freemem:()=>ram})});
  await f.w.act({type:'models_start'});await flush();
  f.language.current='FAILED';f.speech.current='FAILED';
  f.language.status=()=>({state:f.language.current,ownedPid:77,ownedProcessStopped:false});
  ram=2*GiB-1;await f.time.advance(250);
  assert.equal(f.w.state().localModels.error,'RESOURCE_RAM_RESERVE_LOST');
  assert.equal(f.w.state().localModels.cleanupPending,true);assert.ok(f.language.stops>0);
  f.language.status=()=>({state:f.language.current});
});
