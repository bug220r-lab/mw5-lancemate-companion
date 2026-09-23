// Independent MOCK_ONLY actual adapter -> coordinator/workbench -> speech gate.
// Native inventory/process/fetch, speech and recognition are all inert doubles.
import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { setImmediate as flush } from 'node:timers/promises';
import { createLocalLanguageModel } from '../local-language-model.mjs';
import { createWorkbench } from '../server.mjs';
import runtimePins from '../llama-runtime-pins.json' with { type: 'json' };

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const lock=JSON.parse(await readFile(path.join(root,'companion/models.lock.json'),'utf8'));
const deferred=()=>{let resolve;const promise=new Promise(yes=>{resolve=yes;});return{promise,resolve};};
const packet=(text,finish_reason=null)=>`data: ${JSON.stringify({choices:[{delta:text===null?{}:{content:text},finish_reason}]})}\n\n`;
const done='data: [DONE]\n\n';
const complete=text=>[packet(text),packet(null,'stop'),done];
function response(parts,{cleanup=null,pendingRead=null,onCancel=()=>{}}={}) {
  let index=0;
  return {ok:true,headers:new Headers({'content-type':'text/event-stream'}),body:{getReader:()=>({
    read:async()=>index<parts.length?{done:false,value:new TextEncoder().encode(parts[index++])}:
      pendingRead?pendingRead.promise:{done:true},
    cancel:()=>{onCancel();pendingRead?.resolve({done:true});return cleanup?.promise??Promise.resolve();}
  })}};
}
const wave=()=>{const b=Buffer.alloc(46);b.write('RIFF');b.writeUInt32LE(38,4);b.write('WAVEfmt ',8);
  b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(24000,24);
  b.writeUInt32LE(48000,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(2,40);return b;};

async function fixture(t,{cleanup=null}={}) {
  const inventory={schemaVersion:1,files:runtimePins.files.map(f=>({artifact:'llama-cpu',
    path:`companion/local/runtimes/llama-cpu-b11065/${f.name}`,bytes:f.bytes,sha256:f.sha256}))};
  const stats=new Map(),hashes=new Map();
  for(const f of lock.artifacts){const p=path.join(root,'companion/local/models',f.name);stats.set(p,f.bytes);hashes.set(p,f.sha256);}
  for(const f of inventory.files){const p=path.resolve(root,f.path);stats.set(p,f.bytes);hashes.set(p,f.sha256);}
  const responses=[],payloads=[],generations=[],syntheses=[],audioReads=[],children=[];
  let clock=0;
  const io={
    readFile:async file=>JSON.stringify(file.endsWith('models.lock.json')?lock:inventory),
    lstat:async file=>({size:file.endsWith('.json')?1024:stats.get(file)??0,isFile:()=>true,isSymbolicLink:()=>false}),
    realpath:async file=>file,readdir:async()=>runtimePins.files.map(f=>({name:f.name,isFile:()=>true,isDirectory:()=>false,isSymbolicLink:()=>false})),
    hashFile:async file=>hashes.get(file),reservePort:async()=>45678,randomBytes:n=>Buffer.alloc(n,0x23),now:()=>clock,
    sleep:async ms=>{clock+=ms;if(ms===500&&cleanup)await cleanup.promise;},
    spawn:()=>{const child=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();child.pid=9876;
      child.kill=()=>{queueMicrotask(()=>child.emit('exit',0));return true;};children.push(child);return child;},
    fetch:async(url,options)=>{if(url.endsWith('/health'))return new Response('{}');
      payloads.push(JSON.parse(options.body));assert.ok(responses.length,'every inference response is explicitly mocked');return responses.shift();}
  };
  const model=createLocalLanguageModel({},io);
  // Transparent outcome tap. All serialization/SSE/validation still runs in the real adapter.
  const tapped={...model,generate:async(context,options)=>{const call={context,signal:options.signal};generations.push(call);
    try{call.output=await model.generate(context,options);return call.output;}catch(e){call.error=e.message;throw e;}finally{call.settled=true;}}};
  const speech={state:'READY',getState(){return{state:this.state,classification:'MOCK_ONLY',ownedProcessStopped:true};},
    async stop(){this.state='STOPPED';},synthesize:async(input,options)=>{syntheses.push({input,signal:options.signal});return{wavPath:'inert-wave'};}};
  const forbidden=()=>{throw Error('UNEXPECTED_RECOGNITION_OR_RESOURCE_START');};
  const recognition={status:()=>({state:'STOPPED',busy:false,ownsProcess:false,processStopConfirmed:true}),start:forbidden,
    transcribe:forbidden,stop:async()=>{},dispose:async()=>{}};
  const w=await createWorkbench({settingsPath:path.join(root,'synthetic',`absent-completion-settings-${randomUUID()}.json`),
    languageModel:tapped,speechEngine:speech,recognitionEngine:recognition,realNow:()=>1000,
    resourcePolicy:{admit:forbidden,startWatch:forbidden,stopWatch(){},status:()=>({})},
    readAudioFile:async file=>{audioReads.push(file);return wave();}});
  t.after(async()=>{cleanup?.resolve();await flush();await w.dispose();await model.stop();
    assert.equal(model.status().ownedProcessStopped,true);assert.equal(model.status().ownedPid,null);});
  await model.start();await w.act({type:'demo'});
  const ask=async text=>{await w.act({type:'converse',actorId:'alpha',text:text??'Radio check?'});await flush();await flush();};
  const history=()=>JSON.parse(payloads.at(-1).messages[1].content.replace(/ \/no_think$/,'')).unverifiedUndeliveredHistory;
  return{w,model,responses,payloads,generations,syntheses,audioReads,children,ask,history};
}
async function assertNoSpeech(r) {
  assert.notEqual(r.w.state().localModels.reply?.status,'GENERATED');
  assert.equal(r.w.state().localModels.audio,null);assert.equal(r.w.state().radio.playing,null);
  assert.deepEqual(r.w.state().radio.queue,[]);assert.equal(r.syntheses.length,0);assert.equal(r.audioReads.length,0);
  await assert.rejects(r.w.act({type:'synthesize_reply'}),/REPLY_STALE_OR_INELIGIBLE/);
  await assert.rejects(r.w.readAudio('no-audio'),/AUDIO_STALE_OR_UNAVAILABLE/);
  assert.equal(r.w.state().control.nativeCalls,0);
}

for(const [name,parts,error] of [
  ['token-limited text',[packet('This partial answer must not survive.'),packet(null,'length'),done],'GENERATED_TEXT_TRUNCATED'],
  ['DONE without a finish reason',[packet('This apparently whole sentence is not verified complete.'),done],'INCOMPLETE_GENERATED_TEXT'],
  ['stop followed by EOF without DONE',[packet('Stopped but unfinished transport.'),packet(null,'stop')],'INCOMPLETE_GENERATED_TEXT']
]) test(`${name} never reaches history, synthesis or radio, and a subsequent genuine completion works`,async t=>{
  const r=await fixture(t);r.responses.push(response(parts));await r.ask();
  assert.equal(r.generations[0].error,error);assert.equal(r.generations[0].output,undefined);
  assert.equal(r.w.state().localModels.reply.status,'REJECTED');assert.equal(r.w.state().localModels.reply.reason,'GENERATOR_FAILED');
  await assertNoSpeech(r);
  r.responses.push(response(complete('Standing by.')));await r.ask('Fresh radio check?');
  assert.deepEqual(r.history(),[]);assert.deepEqual(r.generations[1].context.history,[]);
  assert.equal(r.w.state().localModels.reply.status,'GENERATED');assert.equal(r.w.state().localModels.reply.text,'Standing by.');
  assert.equal(r.syntheses.length,0);assert.equal(r.w.state().radio.playing,null);
  await r.w.act({type:'synthesize_reply'});await flush();assert.equal(r.syntheses.length,1);
  assert.equal(r.syntheses[0].input.text,'Standing by.');
  const id=r.w.state().localModels.audio.id;await r.w.readAudio(id);
  assert.equal(r.w.state().radio.playing.lineId,id);assert.equal(r.audioReads.length,1);
  assert.equal(r.w.state().control.nativeCalls,0);
});

test('stop plus DONE enters generated history and only explicit synthesis/read grants the mock radio reservation',async t=>{
  const r=await fixture(t);r.responses.push(response(complete('Standing by.')));await r.ask();
  const reply=r.w.state().localModels.reply;assert.equal(reply.status,'GENERATED');assert.equal(reply.dispatchable,false);
  assert.equal(reply.classification,'GENERATED_UNVERIFIED');assert.equal(r.syntheses.length,0);assert.equal(r.w.state().radio.playing,null);
  await r.w.act({type:'synthesize_reply'});await flush();assert.equal(r.syntheses.length,1);assert.equal(r.w.state().radio.playing,null);
  const id=r.w.state().localModels.audio.id;assert.deepEqual(await r.w.readAudio(id),wave());assert.equal(r.w.state().radio.playing.lineId,id);
  r.responses.push(response(complete('Ready.')));await r.ask('Still there?');
  assert.deepEqual(r.history(),[['Radio check?','Standing by.']]);
  assert.equal(r.generations[1].context.history[0].classification,'GENERATED_UNVERIFIED');
  assert.equal(r.w.state().control.nativeCalls,0);assert.equal(r.children.length,1);
});

test('a still-open partial stream cannot publish and cancellation discards it before the next request',async t=>{
  const r=await fixture(t),pendingRead=deferred();let cancelled=0;
  r.responses.push(response([packet('A partial answer')],{pendingRead,onCancel:()=>{cancelled++;}}));await r.ask();
  assert.equal(r.w.state().localModels.reply.status,'GENERATING');assert.equal(r.generations[0].settled,undefined);
  await assertNoSpeech(r);await r.w.act({type:'interrupt'});await flush();await flush();
  assert.equal(cancelled,1);assert.equal(r.generations[0].error,'GENERATION_CANCELLED');assert.equal(r.generations[0].signal.aborted,true);
  assert.equal(r.w.state().localModels.reply,null);await assertNoSpeech(r);
  r.responses.push(response(complete('Recovered.')));await r.ask();assert.deepEqual(r.history(),[]);
});

test('cancellation during awaited reader cleanup overrides valid terminal text and retains the occupied slot until settlement',async t=>{
  const cleanup=deferred(),r=await fixture(t,{cleanup});let cancelled=0;
  r.responses.push(response(complete('Too late to publish.'),{cleanup,onCancel:()=>{cancelled++;}}));await r.ask();
  assert.equal(cancelled,1);assert.equal(r.model.status().activeGeneration,true);assert.equal(r.generations[0].settled,undefined);
  assert.equal(r.w.state().localModels.reply.status,'GENERATING');await assertNoSpeech(r);
  await r.w.act({type:'interrupt'});assert.equal(r.generations[0].signal.aborted,true);
  await assert.rejects(r.w.act({type:'converse',actorId:'alpha',text:'Cannot overlap.'}),/LOCAL_LANGUAGE_MODEL_NOT_READY/);
  assert.equal(r.payloads.length,1);cleanup.resolve();await flush();await flush();
  assert.equal(r.generations[0].error,'GENERATION_CANCELLED');assert.equal(r.generations[0].output,undefined);
  assert.equal(r.model.status().activeGeneration,false);assert.equal(r.model.status().lastGenerationTimings,null);
  assert.equal(r.w.state().localModels.reply,null);await assertNoSpeech(r);
  r.responses.push(response(complete('Recovered.')));await r.ask();assert.deepEqual(r.history(),[]);
});
