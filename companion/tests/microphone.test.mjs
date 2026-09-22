// MOCK_ONLY: execute shipped browser recorder/worklet with fake media objects.
// No browser permission, real microphone, native engine or audio playback.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { setImmediate as flush } from 'node:timers/promises';

const source = await readFile(new URL('../public/microphone.js', import.meta.url), 'utf8');
const workletSource = await readFile(new URL('../public/microphone-worklet.js', import.meta.url), 'utf8');
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
function fixture({ permission, module, resume, sampleRate = 48000, unsupported = false } = {}) {
  const tracks = [{ stops: 0, handlers: {}, stop() { this.stops++; }, addEventListener(name, fn) { this.handlers[name] = fn; } }];
  const stream = { getTracks: () => tracks }, requests = [], contexts = [], nodes = [], statuses = [], errors = [], cancellations = [], audios = [], timers = new Map();
  let clock = 10000, timerId = 0;
  class ClockDate extends Date { static now() { return clock; } }
  const connection = () => ({ connects: [], disconnects: 0, connect(target) { this.connects.push(target); }, disconnect() { this.disconnects++; } });
  class AudioContext {
    constructor() { this.sampleRate = sampleRate; this.closed = 0; this.resumes = 0; this.destination = {}; this.audioWorklet = { addModule: async path => { this.module = path; if (module) await module.promise; } }; contexts.push(this); }
    createMediaStreamSource(value) { this.stream = value; return this.source = connection(); }
    createGain() { this.gain = connection(); this.gain.gain = { value: 1 }; return this.gain; }
    async resume() { this.resumes++; if (resume) await resume.promise; }
    async close() { this.closed++; }
  }
  class AudioWorkletNode {
    constructor(context, name, options) {
      Object.assign(this, connection()); this.context = context; this.name = name; this.options = options;
      this.port = { closed: 0, close() { this.closed++; } }; nodes.push(this);
    }
  }
  const context = vm.createContext({ navigator: { mediaDevices: { getUserMedia: options => { requests.push(options); return permission ? permission.promise : Promise.resolve(stream); } } },
    AudioContext: unsupported ? undefined : AudioContext, AudioWorkletNode, Int16Array, ArrayBuffer, DataView,
    Date: ClockDate, setTimeout(fn, delay) { const id = ++timerId; timers.set(id, { fn, delay }); return id; }, clearTimeout(id) { timers.delete(id); } });
  vm.runInContext(source, context);
  const recorder = context.MW5Microphone.createRecorder({ onStatus: status => statuses.push(status), onAudio: (id, wav) => audios.push({ id, wav }),
    onError: message => errors.push(message), onCancel: (id, reason) => cancellations.push({ id, reason }) });
  const begin = (expiresAtMs = 30000) => recorder.start({ id: 'capture-one', expiresAtMs });
  const pcm = (count, { limit = false, value = 500 } = {}) => {
    while (count > 0 && nodes.at(-1)?.port.onmessage) {
      const length = Math.min(count, 256); count -= length;
      nodes.at(-1).port.onmessage({ data: { type: 'pcm', samples: new Int16Array(length).fill(value), limit: !count && limit } });
    }
  };
  return { recorder, begin, pcm, requests, tracks, stream, contexts, nodes, statuses, errors, cancellations, audios, timers, at: value => { clock = value; } };
}
function assertReleased(r) {
  assert.ok(r.tracks.every(t => t.stops > 0));
  assert.ok(r.contexts.every(c => c.closed > 0));
  assert.equal(r.recorder.active, false); assert.equal(r.timers.size, 0);
  assert.ok(r.nodes.every(n => n.port.closed === 1 && n.disconnects === 1));
}
test('import and recorder construction never request microphone permission', () => {
  const r = fixture(); assert.equal(r.requests.length, 0); assert.equal(r.contexts.length, 0); assert.equal(r.recorder.active, false);
});
test('explicit capture emits canonical little-endian mono 16k PCM WAV and releases all resources', async () => {
  const r = fixture(); assert.equal(await r.begin(), true); assert.equal(r.requests.length, 1);
  assert.equal(r.contexts[0].module, '/microphone-worklet.js'); assert.equal(r.contexts[0].gain.gain.value, 0);
  assert.equal(r.nodes[0].name, 'mw5-ptt-pcm'); r.pcm(1600, { value: -2345 }); r.recorder.release(); assertReleased(r);
  assert.equal(r.audios.length, 1); const wav = Buffer.from(r.audios[0].wav);
  assert.equal(wav.length, 3244); assert.equal(wav.toString('ascii', 0, 4), 'RIFF'); assert.equal(wav.readUInt32LE(4), wav.length - 8);
  assert.equal(wav.toString('ascii', 8, 16), 'WAVEfmt '); assert.equal(wav.readUInt32LE(16), 16);
  assert.equal(wav.readUInt16LE(20), 1); assert.equal(wav.readUInt16LE(22), 1); assert.equal(wav.readUInt32LE(24), 16000);
  assert.equal(wav.readUInt32LE(28), 32000); assert.equal(wav.readUInt16LE(32), 2); assert.equal(wav.readUInt16LE(34), 16);
  assert.equal(wav.toString('ascii', 36, 40), 'data'); assert.equal(wav.readUInt32LE(40), 3200); assert.equal(wav.readInt16LE(44), -2345);
});
for (const stop of ['release', 'cancel']) {
  test(`${stop} while permission pending stops late tracks without making an AudioContext or uploading`, async () => {
    const permission = deferred(), r = fixture({ permission }), pending = r.begin();
    r.recorder[stop](); permission.resolve(r.stream); assert.equal(await pending, false);
    assert.equal(r.contexts.length, 0); assert.equal(r.audios.length, 0); assertReleased(r);
  });
}
test('cancel while worklet module is pending releases context and late module cannot start capture', async () => {
  const module = deferred(), r = fixture({ module }), pending = r.begin(); await flush();
  r.recorder.cancel(); assertReleased(r); module.resolve(); assert.equal(await pending, false);
  assert.equal(r.nodes.length, 0); assert.equal(r.audios.length, 0);
});
test('cancel while context resume is pending disconnects the graph and cannot revive it', async () => {
  const resume = deferred(), r = fixture({ resume }), pending = r.begin(); await flush();
  r.recorder.cancel(); assertReleased(r); resume.resolve(); assert.equal(await pending, false); assert.equal(r.audios.length, 0);
});
test('permission denial reports failure and clears lease without uploading', async () => {
  const permission = deferred(), r = fixture({ permission }), pending = r.begin(); permission.reject(new Error('Permission denied'));
  assert.equal(await pending, false); assert.equal(r.errors[0], 'Permission denied'); assert.equal(r.audios.length, 0); assert.equal(r.timers.size, 0);
});
test('a permission prompt that outlives the lease is cancelled even before resolution', async () => {
  const permission = deferred(), r = fixture({ permission }), pending = r.begin();
  [...r.timers.values()][0].fn(); permission.resolve(r.stream); assert.equal(await pending, false); assertReleased(r);
  assert.equal(r.contexts.length, 0); assert.equal(r.audios.length, 0);
});
test('clock expiry at permission resolution, PCM delivery, or release fails closed', async () => {
  const permission = deferred(), r = fixture({ permission }), pending = r.begin(); r.at(30000); permission.resolve(r.stream);
  assert.equal(await pending, false); assert.equal(r.audios.length, 0); assertReleased(r);
  for (const action of ['delivery', 'release']) {
    const fixture2 = fixture(); await fixture2.begin(); fixture2.pcm(1600); fixture2.at(30000);
    if (action === 'delivery') fixture2.pcm(1); else fixture2.recorder.release();
    assert.equal(fixture2.audios.length, 0); assertReleased(fixture2);
  }
});
test('under 100ms audio is rejected after cleanup', async () => {
  const r = fixture(); await r.begin(); r.pcm(1599); r.recorder.release(); assertReleased(r);
  assert.equal(r.audios.length, 0); assert.match(r.errors[0], /0.1 seconds/);
});
test('sample limit auto releases at exactly 480044 bytes, ignoring additional late worklet messages', async () => {
  const r = fixture(); await r.begin(); const late = r.nodes[0].port.onmessage;
  r.pcm(240000 + 256); assertReleased(r); assert.equal(r.audios.length, 1); assert.equal(r.audios[0].wav.byteLength, 480044);
  late({ data: { type: 'pcm', samples: new Int16Array(256) } }); assert.equal(r.audios.length, 1);
});
test('15-second wall timer releases valid partial audio and ends recording even if delivery stalls', async () => {
  const r = fixture(); await r.begin(); r.pcm(2000); [...r.timers.values()].find(t => t.delay === 15000).fn();
  assertReleased(r); assert.equal(r.audios.length, 1); assert.equal(r.audios[0].wav.byteLength, 4044);
});
test('cancel discards recorded bytes and stale worklet messages', async () => {
  const r = fixture(); await r.begin(); r.pcm(1600); const late = r.nodes[0].port.onmessage;
  r.recorder.cancel(); late({ data: { type: 'pcm', samples: new Int16Array(256) } }); r.recorder.release();
  assertReleased(r); assert.equal(r.audios.length, 0); assert.equal(r.cancellations.length, 1);
});
test('disconnected track and processor failure both stop capture', async () => {
  for (const event of ['track', 'processor']) {
    const r = fixture(); await r.begin(); r.pcm(1600);
    if (event === 'track') r.tracks[0].handlers.ended(); else r.nodes[0].onprocessorerror();
    assertReleased(r); assert.equal(r.audios.length, 0);
  }
});
test('unsupported sample rate and invalid oversized worklet block cannot upload', async () => {
  const r = fixture({ sampleRate: 8000 }); await r.begin(); assertReleased(r); assert.equal(r.audios.length, 0);
  const other = fixture(); await other.begin(); other.nodes[0].port.onmessage({ data: { type: 'pcm', samples: new Int16Array(1000) } });
  assertReleased(other); assert.equal(other.audios.length, 0);
});
test('unsupported browser never requests microphone', async () => {
  const r = fixture({ unsupported: true }); assert.equal(await r.begin(), false); assert.equal(r.requests.length, 0); assert.equal(r.cancellations.length, 1);
});
test('second start while recording cannot allocate another permission request or buffer', async () => {
  const r = fixture(); await r.begin(); assert.equal(await r.begin(), false); assert.equal(r.requests.length, 1); r.recorder.cancel(); assertReleased(r);
});

function worklet(sampleRate) {
  let Processor; const messages = [];
  class AudioWorkletProcessor { constructor() { this.port = { postMessage(message) { messages.push(message); } }; } }
  vm.runInNewContext(workletSource, { AudioWorkletProcessor, sampleRate, registerProcessor(name, value) { assert.equal(name, 'mw5-ptt-pcm'); Processor = value; } });
  const processor = new Processor(); let offset = 0;
  const feed = (samples, channel = (index) => Math.sin(2 * Math.PI * 1000 * index / sampleRate), second = null) => {
    let alive = true;
    for (let start = 0; start < samples && alive; start += 128) {
      const count = Math.min(128, samples - start), first = Float32Array.from({ length: count }, (_, i) => channel(offset + i));
      const input = second ? [first, Float32Array.from({ length: count }, (_, i) => second(offset + i))] : [first];
      const output = [new Float32Array(count).fill(1)]; alive = processor.process([input], [output]);
      assert.ok(output[0].every(v => v === 0), 'No microphone audio goes to speakers'); offset += count;
    }
    return alive;
  };
  const pcm = () => messages.flatMap(m => Array.from(m.samples));
  return { processor, messages, feed, pcm };
}
for (const rate of [16000, 44100, 48000, 96000, 192000]) {
  test(`actual worklet resamples ${rate} Hz to bounded 16k PCM with low-pass anti-aliasing`, () => {
    const low = worklet(rate); low.feed(rate / 2);
    const samples = low.pcm().slice(200); const rms = values => Math.sqrt(values.reduce((sum, n) => sum + (n / 32768) ** 2, 0) / values.length);
    assert.ok(samples.length > 7500 && samples.length < 8000); assert.ok(rms(samples) > 0.65);
    assert.ok(low.processor.history.length <= 512); assert.ok(low.processor.taps.length <= 257);
    if (rate >= 44100) {
      const high = worklet(rate); high.feed(rate / 2, i => Math.sin(2 * Math.PI * 11000 * i / rate));
      assert.ok(rms(high.pcm().slice(200)) < 0.015, 'Out-of-band tone is suppressed before downsampling');
    }
  });
}
test('worklet averages channels and turns nonfinite values into silence', () => {
  const r = worklet(48000); r.feed(48000, () => 0.8, () => -0.8); assert.ok(r.pcm().every(n => n === 0));
  const invalid = worklet(48000); invalid.feed(10000, () => NaN); assert.ok(invalid.pcm().every(n => n === 0));
});
test('worklet stops at 15 seconds with exactly 240000 PCM samples and bounded message blocks', () => {
  const r = worklet(16000); assert.equal(r.feed(16000 * 16), false);
  assert.equal(r.pcm().length, 240000); assert.equal(r.messages.at(-1).limit, true);
  assert.ok(r.messages.every(message => message.samples.length <= 256));
});
