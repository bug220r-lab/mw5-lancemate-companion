// Independent MOCK_ONLY browser ownership/numerical checks. No microphone used.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { setImmediate as flush } from 'node:timers/promises';

const recorderSource = await readFile(new URL('../public/microphone.js', import.meta.url), 'utf8');
const processorSource = await readFile(new URL('../public/microphone-worklet.js', import.meta.url), 'utf8');
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
function rig({ trackThrows = false, portThrows = false, closeRejects = false, closeGate = null, permissionGate = null } = {}) {
  const result = { trackStops: [0,0], contexts: [], nodes: [], cancels: [], errors: [], audio: [] };
  const tracks = result.trackStops.map((_, index) => ({ readyState: 'live', handlers: {},
    stop() { result.trackStops[index]++; if (index === 0 && trackThrows) throw new Error('simulated track cleanup failure'); this.readyState = 'ended'; },
    addEventListener(event, callback) { this.handlers[event] = callback; }, removeEventListener(event) { delete this.handlers[event]; } }));
  const stream = { getTracks: () => tracks };
  const graphNode = () => ({ disconnected: false, connect() {}, disconnect() { this.disconnected = true; } });
  class AudioContext {
    constructor() { this.sampleRate = 48000; this.audioWorklet = { addModule: async () => {} }; this.destination = {}; this.closed = 0; result.contexts.push(this); }
    createMediaStreamSource() { return graphNode(); }
    createGain() { return { ...graphNode(), gain: { value: 1 } }; }
    resume() { return Promise.resolve(); }
    close() { this.closed++; return closeGate ? closeGate.promise : closeRejects ? Promise.reject(new Error('simulated asynchronous close failure')) : Promise.resolve(); }
  }
  class AudioWorkletNode {
    constructor() { Object.assign(this, graphNode()); this.port = { close() { if (portThrows) throw new Error('simulated port cleanup failure'); } }; result.nodes.push(this); }
  }
  const timers = new Map(); let timer = 0;
  const context = vm.createContext({ navigator: { mediaDevices: { getUserMedia: () => permissionGate ? permissionGate.promise : Promise.resolve(stream) } },
    AudioContext, AudioWorkletNode, Date: { now: () => 1000 }, Int16Array, ArrayBuffer, DataView,
    setTimeout(fn, ms) { timers.set(++timer, { fn,ms }); return timer; }, clearTimeout(id) { timers.delete(id); } });
  vm.runInContext(recorderSource, context);
  const recorder = context.MW5Microphone.createRecorder({ onCancel: (...args) => result.cancels.push(args),
    onError: text => result.errors.push(text), onAudio: (...args) => result.audio.push(args) });
  return { ...result, recorder, tracks, stream, timers,
    start: () => recorder.start({ id:'capture1', expiresAtMs: 21000 }),
    pcm(n) { while (n > 0) { const count = Math.min(256,n); n -= count;
      result.nodes.at(-1).port.onmessage({ data: { type:'pcm', samples:new Int16Array(count) } }); } } };
}

test('review: one failing track stop cannot prevent cleanup attempts on the other track and audio context', async () => {
  const r = rig({ trackThrows:true }); await r.start();
  assert.doesNotThrow(() => r.recorder.cancel());
  assert.ok(r.trackStops[1] > 0, 'second independently owned track must still be stopped');
  assert.ok(r.contexts[0].closed > 0, 'audio context cleanup must still be attempted');
  assert.equal(r.audio.length, 0);
  assert.equal(await r.start(), false, 'uncertain cleanup cannot open a replacement capture');
});

test('review: a failed MessagePort close cannot bypass closing the audio context', async () => {
  const r = rig({ portThrows:true }); await r.start(); r.pcm(2000);
  assert.doesNotThrow(() => r.recorder.release());
  assert.ok(r.contexts[0].closed > 0); assert.ok(r.trackStops.every(n => n > 0));
  assert.equal(r.audio.length, 0, 'uncertain release cannot upload audio');
  assert.equal(await r.start(), false);
});

test('review: an asynchronous context close rejection remains unconfirmed and blocks replacement capture', async () => {
  const r = rig({ closeRejects:true }); await r.start(); r.recorder.cancel(); await flush();
  assert.ok(r.contexts[0].closed > 0); assert.equal(await r.start(), false); assert.equal(r.audio.length,0);
});

test('review: an unresolved context close retains cleanup ownership and prevents overlapping contexts', async () => {
  const gate = deferred(), r = rig({ closeGate:gate }); await r.start(); r.pcm(2000); r.recorder.release();
  assert.equal(r.audio.length,1, 'stopped and disconnected audio may be uploaded without restarting capture');
  assert.equal(r.recorder.cleanupPending,true);
  assert.equal(await r.start(),false); assert.equal(r.contexts.length,1);
  gate.resolve(); await flush(); assert.equal(r.recorder.cleanupPending,false);
  assert.equal(await r.start(),true); assert.equal(r.contexts.length,2); r.recorder.cancel(); await flush();
});

test('review: permission arriving after release never creates an audio context, and every returned track is stopped', async () => {
  const gate = deferred(), r = rig({ permissionGate:gate }); const starting = r.start(); r.recorder.release();
  gate.resolve(r.stream); assert.equal(await starting, false);
  assert.ok(r.trackStops.every(n => n === 1)); assert.equal(r.contexts.length, 0); assert.equal(r.audio.length, 0);
});

test('review: a stale ended callback cannot cancel a replacement microphone capture', async () => {
  const r = rig(); await r.start(); const oldEnded = r.tracks[0].handlers.ended;
  r.recorder.cancel(); await flush(); await r.start(); const before = r.cancels.length; oldEnded();
  assert.equal(r.recorder.active, true); assert.equal(r.cancels.length, before); r.recorder.cancel();
});

test('review: output stays silent and worklet queued payload is bounded even when the main thread never consumes it', () => {
  let Processor; const messages = [];
  class Base { constructor() { this.port = { postMessage: message => messages.push(message) }; } }
  vm.runInNewContext(processorSource, { AudioWorkletProcessor:Base, sampleRate:192000,
    registerProcessor: (_name,ctor) => { Processor = ctor; } });
  const p = new Processor(); let alive = true;
  for (let n = 0; n < 192000 * 16 / 128 && alive; n++) {
    const channels = [new Float32Array(128).fill(.8), new Float32Array(128).fill(-.2)];
    const output = [[new Float32Array(128).fill(1)]]; alive = p.process([channels], output);
    assert.ok(output[0][0].every(value => value === 0));
  }
  assert.equal(alive, false); assert.equal(messages.reduce((sum,m) => sum + m.samples.length,0), 240000);
  assert.ok(messages.length <= 30000); assert.ok(messages.every(m => m.samples.length <= 256));
  assert.equal(p.history.length,512);
});

test('review: every completed process quantum is delivered, including the tail of exactly 100 ms at 16 kHz', () => {
  let Processor; const messages = [];
  class Base { constructor() { this.port = { postMessage: message => messages.push(message) }; } }
  vm.runInNewContext(processorSource, { AudioWorkletProcessor:Base, sampleRate:16000,
    registerProcessor: (_name,ctor) => { Processor = ctor; } });
  const p = new Processor();
  for (let offset = 0; offset < 1600; offset += 128) {
    const count = Math.min(128,1600 - offset);
    p.process([[new Float32Array(count).fill(.4)]], [[new Float32Array(count)]]);
  }
  assert.equal(messages.reduce((sum,m) => sum + m.samples.length,0),1600);
});
