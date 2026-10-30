// Independent source review. Inert dependencies only; no listener/device/process.
import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate as flush } from 'node:timers/promises';
import { createWorkbench } from '../server.mjs';
import { fileURLToPath } from 'node:url';

const deferred = () => { let resolve, reject; const promise = new Promise((a,b)=>{resolve=a;reject=b;}); return {promise,resolve,reject}; };
const wave = () => { const b=Buffer.alloc(46); b.write('RIFF');b.writeUInt32LE(38,4);b.write('WAVE',8);b.write('fmt ',12);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(24000,24);b.writeUInt32LE(48000,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(2,40);return b; };
async function rig(t,{read}={}) {
  let wall=10000, language='READY', speech='READY', recognition='STOPPED';
  const generated=[], syntheses=[];
  const host=await createWorkbench({settingsPath:fileURLToPath(new URL('./does-not-exist-settings.json',import.meta.url)),
    realNow:()=>wall,
    languageModel:{status:()=>({state:language}), async stop(){language='STOPPED';},
      generate(c,o){generated.push({c,o});return Promise.resolve('Standing by.');}},
    speechEngine:{getState:()=>({state:speech}),async stop(){speech='STOPPED';},
      synthesize(c,o){syntheses.push({c,o});return Promise.resolve({wavPath:'INERT'});}},
    recognitionEngine:{status:()=>({state:recognition,busy:false,ownsProcess:false,processStopConfirmed:true}),
      async start(){recognition='READY';},async stop(){recognition='STOPPED';},async dispose(){recognition='DISPOSED';},
      transcribe(){throw Error('UNEXPECTED_TRANSCRIBE');}},
    resourcePolicy:{status:()=>({}),admit(){throw Error('UNEXPECTED_ADMIT');},startWatch(){throw Error('UNEXPECTED_WATCH');},stopWatch(){}},
    readAudioFile:read??(async()=>wave())});
  t.after(()=>host.dispose());await host.act({type:'demo'});
  const begin=async()=>{await host.act({type:'exchange_preview',actorIds:['alpha','bravo']});await flush();};
  const voice=async()=>{await host.act({type:'synthesize_reply'});await flush();return host.state().localModels.audio.id;};
  const deliver=async()=>{const id=await voice(),d=await host.readAudioDelivery(id);assert.equal(d.delivered(),true);return {id,d};};
  const ack=d=>host.act({type:'playback_complete',lineId:d.id,receipt:d.d.receipt});
  return {host,generated,syntheses,begin,voice,deliver,ack,at:x=>wall=x};
}

test('PTT capture cancels delivered first turn before any reply generation',async t=>{
  const r=await rig(t);await r.begin();const d=await r.deliver();
  await r.host.act({type:'recognition_prepare'});await flush();await r.host.act({type:'ptt_begin'});
  assert.equal(r.host.state().localModels.exchange.status,'CANCELLED');
  assert.equal(r.host.state().radio.playing,null);
  await assert.rejects(r.ack(d),/CURRENT_PLAYBACK_RECEIPT_REQUIRED/);assert.equal(r.generated.length,1);
});

test('model stop cancels current delivery and never makes its receipt current again',async t=>{
  const r=await rig(t);await r.begin();const d=await r.deliver();await r.host.act({type:'models_stop'});
  assert.equal(r.host.state().localModels.exchange.status,'CANCELLED');await assert.rejects(r.ack(d),/CURRENT_PLAYBACK_RECEIPT_REQUIRED/);
  assert.equal(r.generated.length,1);assert.equal(r.host.state().control.nativeCalls,0);
});

test('ten second exchange deadline is fixed even when second fact has time remaining',async t=>{
  const r=await rig(t);await r.begin();const d=await r.deliver();r.at(14999);await r.ack(d);await flush();
  const id=await r.voice();r.at(19998);const second=await r.host.readAudioDelivery(id);assert.equal(second.delivered(),true);
  r.at(20000);await assert.rejects(r.host.act({type:'playback_complete',lineId:id,receipt:second.receipt}),/EXCHANGE_PLAYBACK_STALE|CURRENT_PLAYBACK_RECEIPT_REQUIRED/);
  assert.equal(r.host.state().localModels.exchange.status,'CANCELLED');assert.equal(r.generated.length,2);
});

test('expiry observed by delivery finish cannot revive after a backwards wall clock',async t=>{
  const r=await rig(t);await r.begin();const id=await r.voice(),d=await r.host.readAudioDelivery(id);
  r.at(20000);assert.equal(d.delivered(),false);r.at(10001);assert.equal(d.delivered(),false);
  await assert.rejects(r.host.act({type:'playback_complete',lineId:id,receipt:d.receipt}),/CURRENT_PLAYBACK_RECEIPT_REQUIRED/);
  assert.equal(r.host.state().localModels.exchange.status,'CANCELLED');assert.equal(r.generated.length,1);
});

test('old transport callbacks cannot cancel or complete a replacement exchange',async t=>{
  const r=await rig(t);await r.begin();const id=await r.voice(),old=await r.host.readAudioDelivery(id);
  await r.host.act({type:'demo'});await r.begin();const fresh=await r.deliver();old.failed();assert.equal(old.delivered(),false);
  await assert.rejects(r.host.act({type:'playback_complete',lineId:id,receipt:old.receipt}),/CURRENT_PLAYBACK_RECEIPT_REQUIRED/);
  await r.ack(fresh);await flush();assert.equal(r.host.state().localModels.reply.exchangeTurn,1);assert.equal(r.generated.length,3);
});

test('mission change at the nested audio-read promise boundary rejects stale bytes',async t=>{
  const read=deferred(),r=await rig(t,{read:()=>read.promise});await r.begin();const id=await r.voice();
  const result=r.host.readAudioDelivery(id);await flush();
  // Registered after readAudioBytes has awaited the buffer. It runs after its
  // validation but before the outer readAudioDelivery continuation.
  read.promise.then(()=>r.host.act({type:'demo'}));read.resolve(wave());
  await assert.rejects(result,/AUDIO_STALE_OR_UNAVAILABLE/);
  assert.equal(r.host.state().localModels.exchange,null);
});
