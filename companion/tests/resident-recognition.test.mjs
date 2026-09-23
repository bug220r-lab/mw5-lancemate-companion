import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough, Writable } from 'node:stream';
import { createResidentRecognition } from '../resident-recognition.mjs';

const tick=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};};
function wave(frames=1600){
  const b=Buffer.alloc(44+frames*2);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);
  b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(16000,24);
  b.writeUInt32LE(32000,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(frames*2,40);return b;
}
function harness(options={},extra={}){
  const children=[];let memory=6*1024**3,clock=10,preflightCalls=0;
  const engine=createResidentRecognition({startupTimeoutMs:200,requestTimeoutMs:200,stopTimeoutMs:20,resourceIntervalMs:100,...options},{
    preflight:async()=>{preflightCalls++;return{python:'MOCK_PYTHON',worker:'MOCK_WORKER'};},
    freemem:()=>memory,now:()=>clock,
    spawn:(file,args,opts)=>{
      const c=new EventEmitter();c.pid=100+children.length;c.stdout=new PassThrough();c.stderr=new PassThrough();c.requests=[];
      c.stdin=new Writable({write(data,enc,done){c.requests.push(JSON.parse(data.toString()));done();},final(done){queueMicrotask(()=>c.emit('close',0,null));done();}});
      c.kill=()=>{c.kills++;queueMicrotask(()=>c.emit('close',null,'SIGTERM'));return true;};c.kills=0;
      c.send=m=>c.stdout.write(JSON.stringify(m)+'\n');c.launch={file,args,opts};children.push(c);return c;
    },...extra});
  async function ready(){const p=engine.start();await tick();const c=children.at(-1);c.send({v:1,type:'ready',mode:'RESIDENT_PIPE_TRANSCRIPTION_ONLY',nativeVersion:'mock-1'});await p;return c;}
  return{engine,children,ready,setMemory:n=>{memory=n;},setClock:n=>{clock=n;},preflights:()=>preflightCalls};
}
test('resident construction and status are inert',()=>{
  const h=harness();assert.equal(h.children.length,0);assert.equal(h.preflights(),0);assert.equal(h.engine.status().state,'STOPPED');
});
test('source factory rejects configurable process or model paths',()=>{
  for(const option of [{python:'x'},{worker:'x'},{model:'x'},{startupTimeoutMs:0},{requestTimeoutMs:30001}])
    assert.throws(()=>createResidentRecognition(option),{code:'INVALID_RECOGNITION_OPTIONS'});
});
test('one retained child handles two transcripts without authority or capture',async()=>{
  const h=harness();const c=await h.ready();
  for(const text of ['Heard you.','Withdrawal understood.']){
    const p=h.engine.transcribe(wave());const req=c.requests.at(-1);h.setClock(20);c.send({v:1,type:'result',id:req.id,text});
    const r=await p;assert.equal(r.text,text);assert.equal(r.mode,'RESIDENT_PIPE_TRANSCRIPTION_ONLY');
    assert.equal(r.transcriptTrust,'UNTRUSTED_RECOGNITION');assert.equal(r.classification,'MOCK_ONLY');
    assert.equal(r.commandExecution,false);assert.equal(r.microphoneCapture,false);assert.equal(r.speakerPlayback,false);
  }
  assert.equal(h.children.length,1);assert.equal(c.requests[1].id,c.requests[0].id+1);
  assert.equal((await h.engine.dispose()).ownedProcessStopped,true);
});
test('worker launch uses private pipes, isolated interpreter and hidden no-shell process',async()=>{
  const h=harness();const c=await h.ready();assert.deepEqual(c.launch.args,['-I','-S','-u','MOCK_WORKER','--serve']);
  assert.deepEqual(c.launch.opts.stdio,['pipe','pipe','pipe']);assert.equal(c.launch.opts.shell,false);assert.equal(c.launch.opts.windowsHide,true);
  assert.equal(c.launch.opts.env.CUDA_VISIBLE_DEVICES,'-1');await h.engine.dispose();
});
test('duplicate starts share startup and do not spawn another child',async()=>{
  const h=harness();const a=h.engine.start(),b=h.engine.start();assert.equal(a,b);await tick();
  h.children[0].send({v:1,type:'ready',mode:'RESIDENT_PIPE_TRANSCRIPTION_ONLY',nativeVersion:'mock'});await a;
  await h.engine.start();assert.equal(h.children.length,1);await h.engine.dispose();
});
test('wrong response recipient stops the exact worker and rejects transcript',async()=>{
  const h=harness();const c=await h.ready(),p=h.engine.transcribe(wave());const rejected=assert.rejects(p,{code:'RESIDENT_PROTOCOL'});
  c.send({v:1,type:'result',id:999,text:'success'});await rejected;await tick();assert.equal(c.kills,1);assert.equal(h.engine.status().state,'STOPPED');
});
test('input copy cannot be changed by caller after submission',async()=>{
  const h=harness(),c=await h.ready(),input=wave();input.writeInt16LE(1234,44);const p=h.engine.transcribe(input);input.fill(0);
  const req=c.requests[0];assert.equal(Buffer.from(req.wav,'base64').readInt16LE(44),1234);
  c.send({v:1,type:'result',id:req.id,text:'heard'});await p;await h.engine.dispose();
});
test('invalid WAVs never reach the child',async()=>{
  const h=harness(),c=await h.ready();
  for(const b of [Buffer.alloc(10),wave(1),wave(240001),Buffer.from(wave())]){
    if(b.length===3244)b.writeUInt32LE(44100,24);
    await assert.rejects(h.engine.transcribe(b),{code:'INVALID_RECOGNITION_WAV'});
  }
  assert.equal(c.requests.length,0);await h.engine.dispose();
});
test('simultaneous requests are refused rather than queued',async()=>{
  const h=harness(),c=await h.ready(),first=h.engine.transcribe(wave());
  await assert.rejects(h.engine.transcribe(wave()),{code:'RECOGNITION_BUSY'});assert.equal(c.requests.length,1);
  c.send({v:1,type:'result',id:c.requests[0].id,text:'one'});await first;await h.engine.dispose();
});
test('abort rejects immediately and requires a new explicit startup',async()=>{
  const h=harness(),c=await h.ready(),controller=new AbortController(),p=h.engine.transcribe(wave(),{signal:controller.signal});
  const rejected=assert.rejects(p,{code:'RECOGNITION_ABORTED'});controller.abort();await rejected;await tick();
  assert.equal(c.kills,1);await assert.rejects(h.engine.transcribe(wave()),{code:'RECOGNITION_NOT_READY'});
});
test('preflight stop settles startup but prevents replacement until work drains',async()=>{
  const d=deferred(),h=harness({}, {preflight:()=>d.promise}),p=h.engine.start();const rejected=assert.rejects(p,{code:'RECOGNITION_STOPPED'});
  const stopped=await h.engine.stop();await rejected;assert.equal(stopped.stopped,false);assert.equal(stopped.pendingPreflight,true);
  await assert.rejects(h.engine.start(),{code:'RECOGNITION_BUSY'});d.resolve({python:'x',worker:'y'});await tick();
  assert.equal(h.children.length,0);assert.equal(h.engine.status().state,'STOPPED');await h.engine.dispose();
});
test('startup timeout does not release pending preflight ownership',async()=>{
  const d=deferred(),h=harness({startupTimeoutMs:10},{preflight:()=>d.promise});
  await assert.rejects(h.engine.start(),{code:'RESIDENT_START_TIMEOUT'});assert.equal(h.engine.status().pendingPreflight,true);
  await assert.rejects(h.engine.start(),{code:'RECOGNITION_BUSY'});d.resolve({python:'x',worker:'y'});await tick();assert.equal(h.children.length,0);
});
test('resident resource loss stops the child and pending work',async()=>{
  const h=harness({resourceIntervalMs:5}),c=await h.ready(),p=h.engine.transcribe(wave());const rejected=assert.rejects(p,{code:'RESIDENT_RAM_RESERVE'});
  h.setMemory(1024**3);await rejected;await tick();assert.equal(c.kills,1);assert.equal(h.engine.status().ownsProcess,false);
});
test('bad process response and native output never appear in public failure',async()=>{
  const h=harness(),c=await h.ready(),p=h.engine.transcribe(wave());const rejected=assert.rejects(p,error=>error.code==='RESIDENT_PROTOCOL'&&!error.message.includes('PRIVATE'));
  c.stdout.write('PRIVATE invalid JSON\n');await rejected;await tick();assert.equal(h.engine.status().lastError,'RESIDENT_PROTOCOL');
});
test('disposal blocks all future startup',async()=>{
  const h=harness();await h.ready();assert.equal((await h.engine.dispose()).stopped,true);
  await assert.rejects(h.engine.start(),{code:'RECOGNITION_DISPOSED'});assert.equal(h.children.length,1);
});
