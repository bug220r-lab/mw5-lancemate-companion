// MOCK_ONLY: actual host with injected inert engines. No listener/model/audio device.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createWorkbench } from '../server.mjs';

const flush = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve=a; reject=b; }); return { promise,resolve,reject }; };
async function rig(t, { generation, synthesis, read } = {}) {
  let wall=10000, modelState='READY', speechState='READY';
  const calls={ generation:[], synthesis:[], starts:0 }, wav=Buffer.alloc(44);
  wav.write('RIFF'); wav.write('WAVE',8);
  const directory=await mkdtemp(path.join(os.tmpdir(),'mw5-exchange-'));
  const host=await createWorkbench({settingsPath:path.join(directory,'settings.json'),realNow:()=>wall,
    languageModel:{status:()=>({state:modelState}),start(){calls.starts++;throw Error('FORBIDDEN');},
      generate(context,options){calls.generation.push(context);return generation?.(context,options)??Promise.resolve('Offline radio check. Ready.');},
      async stop(){modelState='STOPPED';}},
    speechEngine:{getState:()=>({state:speechState}),start(){calls.starts++;throw Error('FORBIDDEN');},
      synthesize(request,options){calls.synthesis.push(request);return synthesis?.(request,options)??Promise.resolve({wavPath:'INJECTED_WAV'});},
      async stop(){speechState='STOPPED';}},
    recognitionEngine:{status:()=>({state:'STOPPED',ownsProcess:false,processStopConfirmed:true}),
      start(){calls.starts++;throw Error('FORBIDDEN');},transcribe(){throw Error('FORBIDDEN');},async stop(){},async dispose(){}},
    resourcePolicy:{status:()=>({}),admit(){throw Error('FORBIDDEN');},startWatch(){throw Error('FORBIDDEN');},stopWatch(){}},
    readAudioFile:read??(async()=>wav)});
  t.after(async()=>{await host.dispose();assert.equal(calls.starts,0);const p=path.resolve(directory);
    assert.equal(path.dirname(p),path.resolve(os.tmpdir()));assert.ok(path.basename(p).startsWith('mw5-exchange-'));await rm(p,{recursive:true,force:true});});
  await host.act({type:'demo'});
  const begin=async()=>{await host.act({type:'exchange_preview',actorIds:['alpha','bravo']});await flush();return host.state();};
  const voice=async()=>{await host.act({type:'synthesize_reply'});await flush();return host.state().localModels.audio.id;};
  const deliver=async()=>{const id=await voice(),receipt=await host.readAudioDelivery(id);assert.equal(receipt.delivered(),true);return {id,receipt};};
  const ack=(d,type='playback_complete')=>host.act({type,lineId:d.id,receipt:d.receipt.receipt});
  return {host,calls,begin,voice,deliver,ack,setWall:value=>{wall=value;}};
}

test('two generated turns require complete byte delivery and distinct current ended receipts',async t=>{
  const r=await rig(t),before=r.host.state().control;
  const first=await r.begin();assert.equal(first.localModels.reply.exchangeTurn,0);
  assert.equal(first.localModels.reply.classification,'GENERATED_UNVERIFIED');
  assert.equal(first.localModels.exchange.classification,'OFFLINE_EXCHANGE_PREVIEW');
  assert.deepEqual(r.calls.generation[0].facts[0].data,{classification:'MOCK_ONLY',gameConnected:false,exercise:'two-pilot offline radio check'});
  const id=await r.voice(),receipt=await r.host.readAudioDelivery(id),d={id,receipt};
  assert.equal(r.host.state().localModels.audio.status,'AWAITING_DELIVERY');
  await assert.rejects(r.ack(d),/CURRENT_PLAYBACK_RECEIPT_REQUIRED/);
  assert.equal(r.calls.generation.length,1);assert.equal(receipt.delivered(),true);
  assert.ok(!JSON.stringify(r.host.state()).includes(receipt.receipt));
  await r.ack(d);await flush();
  assert.equal(r.calls.generation.length,2);assert.equal(r.host.state().localModels.reply.exchangeTurn,1);
  assert.equal(r.host.state().localModels.reply.speakerId,'bravo');
  await assert.rejects(r.ack(d),/CURRENT_PLAYBACK_RECEIPT_REQUIRED/);
  const second=await r.deliver();await r.ack(second);
  assert.equal(r.host.state().localModels.exchange.status,'COMPLETED');
  assert.equal(r.calls.generation.length,2);assert.equal(r.calls.synthesis.length,2);
  assert.deepEqual(r.host.state().control,before);assert.equal(r.host.state().control.nativeCalls,0);
});

test('wrong receipts, line IDs, raw reads and the text-complete action cannot advance an exchange',async t=>{
  const r=await rig(t);await r.begin();const id=await r.voice();
  await assert.rejects(r.host.readAudio(id),/EXCHANGE_DELIVERY_RECEIPT_REQUIRED/);
  const receipt=await r.host.readAudioDelivery(id);receipt.delivered();
  for(const input of [{type:'playback_complete',lineId:id,receipt:'wrong'},
    {type:'playback_complete',lineId:'wrong',receipt:receipt.receipt},
    {type:'radio_complete',lineId:id}]) await assert.rejects(r.host.act(input),/CURRENT_PLAYBACK_RECEIPT_REQUIRED/);
  assert.equal(r.calls.generation.length,1);assert.equal(r.host.state().localModels.reply.exchangeTurn,0);
});

test('failed or incomplete delivery never authorizes completion',async t=>{
  const r=await rig(t);await r.begin();const id=await r.voice(),receipt=await r.host.readAudioDelivery(id);
  receipt.failed();assert.equal(receipt.delivered(),false);
  await assert.rejects(r.ack({id,receipt}),/CURRENT_PLAYBACK_RECEIPT_REQUIRED/);
  assert.equal(r.host.state().localModels.exchange.status,'CANCELLED');assert.equal(r.calls.generation.length,1);
});

test('playback error cancels rather than marking the first turn complete',async t=>{
  const r=await rig(t);await r.begin();const d=await r.deliver();await r.ack(d,'playback_failed');
  assert.equal(r.host.state().localModels.exchange.status,'CANCELLED');assert.equal(r.host.state().radio.playing,null);
  await assert.rejects(r.ack(d),/CURRENT_PLAYBACK_RECEIPT_REQUIRED/);assert.equal(r.calls.generation.length,1);
});

test('late generation and synthesis cannot revive a cancelled exchange',async t=>{
  for(const stage of ['generation','synthesis']){
    const pending=deferred(),r=await rig(t,{[stage]:()=>pending.promise});
    await r.begin();if(stage==='synthesis')await r.host.act({type:'synthesize_reply'});
    await r.host.act({type:'interrupt'});pending.resolve(stage==='generation'?'late line':{wavPath:'LATE'});await flush();
    assert.equal(r.host.state().localModels.exchange.status,'CANCELLED');
    assert.equal(r.host.state().localModels.reply,null);assert.equal(r.host.state().localModels.audio,null);
    assert.equal(r.calls.generation.length,1);
  }
});

test('either participant possession, human command, pause, rename, quiet or speech mute cancels the pair',async t=>{
  for(const action of ['possession','hold','release','pause','rename','quiet','speechMuted']){
    const r=await rig(t);await r.begin();const d=await r.deliver();
    if(['possession','hold','release','pause'].includes(action))await r.host.act({type:'step',actorId:'bravo',event:action});
    else {const settings=r.host.state().settings;if(action==='rename')settings.pilots[1].callsign='Rook';else settings[action]=true;
      await r.host.act({type:'settings',settings});}
    assert.equal(r.host.state().localModels.exchange.status,'CANCELLED',action);
    await assert.rejects(r.ack(d),/CURRENT_PLAYBACK_RECEIPT_REQUIRED/);assert.equal(r.calls.generation.length,1);
  }
});

test('mission reset invalidates old bytes, receipts and pending generation',async t=>{
  const r=await rig(t);await r.begin();const d=await r.deliver();await r.host.act({type:'demo'});
  await assert.rejects(r.ack(d),/CURRENT_PLAYBACK_RECEIPT_REQUIRED/);
  assert.equal(r.host.state().localModels.exchange,null);assert.equal(r.host.state().radio.playing,null);
});

test('fact expiry and regressing wall time remain invalid with a stationary synthetic clock',async t=>{
  for(const scenario of ['expiry','regression']){
    const r=await rig(t);await r.begin();const d=await r.deliver();
    r.setWall(scenario==='expiry'?15001:9999);
    await assert.rejects(r.ack(d),/EXCHANGE_PLAYBACK_STALE|CURRENT_PLAYBACK_RECEIPT_REQUIRED/);
    r.setWall(10001);assert.equal(r.host.state().localModels.exchange.status,'CANCELLED');
    await assert.rejects(r.ack(d),/CURRENT_PLAYBACK_RECEIPT_REQUIRED/);assert.equal(r.calls.generation.length,1);
    assert.equal(r.host.state().clockMs,1000);
  }
});

test('the existing single squad budget uses elapsed wall time across exchange attempts',async t=>{
  const r=await rig(t);await r.begin();await r.ack(await r.deliver());await flush();await r.ack(await r.deliver());
  r.setWall(29999);await r.begin();const early=await r.voice();await assert.rejects(r.host.readAudioDelivery(early),/RADIO_REJECTED/);
  r.setWall(30000);await r.begin();const allowed=await r.deliver();assert.ok(allowed.receipt.receipt);
  assert.equal(r.host.state().clockMs,1000);assert.equal(r.host.state().control.nativeCalls,0);
});

test('fact/clock loss during WAV reading and synthesis failure never release the reply',async t=>{
  for(const stage of ['read','synthesis']){
    const pending=deferred(),r=await rig(t,{[stage]:()=>pending.promise});await r.begin();
    if(stage==='synthesis'){await r.host.act({type:'synthesize_reply'});pending.reject(Error('injected'));await flush();}
    else {const id=await r.voice(),reading=r.host.readAudioDelivery(id);r.setWall(15001);const wav=Buffer.alloc(44);wav.write('RIFF');wav.write('WAVE',8);pending.resolve(wav);
      await assert.rejects(reading,/AUDIO_STALE_OR_UNAVAILABLE/);}
    assert.equal(r.host.state().localModels.exchange.status,'CANCELLED');assert.equal(r.calls.generation.length,1);
  }
});

test('caller facts, arbitrary prompts and repeated participants are not exchange inputs',async t=>{
  const r=await rig(t);
  for(const extra of [{facts:[{verified:true}]},{text:'invent a mission event'},{actorIds:['alpha','alpha']}])
    await assert.rejects(r.host.act({type:'exchange_preview',actorIds:['alpha','bravo'],...extra}),/TWO_EXCHANGE_PARTICIPANTS_REQUIRED/);
  assert.equal(r.calls.generation.length,0);
});
