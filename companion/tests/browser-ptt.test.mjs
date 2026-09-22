// MOCK_ONLY browser integration: actual app + recorder in a VM with fake DOM,
// media, HTTP and timers. No permission prompt, native recognition or playback.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { setImmediate as flush } from 'node:timers/promises';
const appSource = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
const recorderSource = await readFile(new URL('../public/microphone.js', import.meta.url), 'utf8');
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
function state() {
  return { classification: 'MOCK_ONLY', clockMs: 1000,
    settings: { micMuted: false, speechMuted: false, quiet: false, pilots: ['alpha', 'bravo', 'charlie'].map(id => ({ id, mode: 'ADVISORY', callsign: null, voice: null })) },
    control: { recommendations: [], armed: false, capabilities: [], pending: [], ledger: [] }, radio: { playing: null },
    localModels: { language: { state: 'STOPPED' }, speech: { state: 'STOPPED' }, starting: false, reply: null, audio: null },
    speechInput: { mode: 'OFFLINE_PTT_PREVIEW', dispatchable: false, preparing: false, engine: { state: 'READY' }, current: null }, integration: {} };
}
async function fixture({ permission, reserve } = {}) {
  const elements = new Map(), events = [], actions = [], uploads = [], streams = [], contexts = [], nodes = [], listeners = new Map(), timers = new Map();
  let server = state(), clock = 10000, captureSequence = 0, timerSequence = 0;
  class Element {
    constructor(tag = 'div') { this.tagName = tag; this.children = []; this.value = ''; this.textContent = ''; this.checked = false; this.disabled = false; this.listeners = new Map(); }
    set id(value) { this._id = value; elements.set(value, this); } get id() { return this._id; }
    append(...items) { this.children.push(...items); } replaceChildren(...items) { this.children = items; }
    addEventListener(name, fn) { if (!this.listeners.has(name)) this.listeners.set(name, []); this.listeners.get(name).push(fn); }
    focus() { this.focused = true; } setPointerCapture() {}
    dispatch(name, data = {}) { const event = { preventDefault() {}, button: 0, pointerId: 7, ...data }; for (const fn of this.listeners.get(name) ?? []) fn(event); }
  }
  const get = id => { if (!elements.has(id)) { const e = new Element(); e.id = id; } return elements.get(id); };
  const response = data => ({ ok: true, json: async () => structuredClone(data) });
  const fetch = (url, options = {}) => {
    events.push(`fetch:${url}`);
    if (url === '/api/state') return Promise.resolve(response(server));
    if (url === '/api/action') {
      const action = JSON.parse(options.body); actions.push(action);
      if (action.type === 'ptt_begin') {
        server.speechInput.current = { id: `capture-${++captureSequence}`, session: 'mock-mission', status: 'CAPTURING', expiresAtMs: 30000, classification: 'UNTRUSTED_RECOGNITION' };
        if (reserve) { reserve.snapshot = structuredClone(server); return reserve.promise; }
      }
      if (action.type === 'ptt_cancel' && server.speechInput.current?.id === action.captureId) server.speechInput.current.status = 'CANCELLED';
      return Promise.resolve(response(server));
    }
    if (url.startsWith('/api/recognition/')) {
      const job = deferred(); uploads.push({ url, options, ...job }); server.speechInput.current.status = 'TRANSCRIBING'; return job.promise;
    }
    throw new Error('Unexpected mock request');
  };
  const mediaDevices = { getUserMedia: () => {
    events.push('microphone-request');
    const track = { stops: 0, stop() { this.stops++; }, addEventListener() {} }, stream = { getTracks: () => [track], track }; streams.push(stream);
    return permission ? permission.promise : Promise.resolve(stream);
  } };
  const graph = () => ({ connect() {}, disconnect() {} });
  class AudioContext {
    constructor() { this.sampleRate = 48000; this.closed = 0; this.destination = {}; this.audioWorklet = { addModule: async () => {} }; contexts.push(this); }
    createMediaStreamSource() { return graph(); } createGain() { return { ...graph(), gain: { value: 1 } }; }
    async resume() {} async close() { this.closed++; }
  }
  class AudioWorkletNode { constructor() { Object.assign(this, graph()); this.port = { close() {} }; nodes.push(this); } }
  class ClockDate extends Date { static now() { return clock; } }
  const context = vm.createContext({ document: { getElementById: get, createElement: tag => new Element(tag), hidden: false,
    addEventListener(name, fn) { const key = `document:${name}`; if (!listeners.has(key)) listeners.set(key, []); listeners.get(key).push(fn); } },
    window: { addEventListener(name, fn) { if (!listeners.has(name)) listeners.set(name, []); listeners.get(name).push(fn); } },
    location: { hash: '#fixture' }, navigator: { mediaDevices }, AudioContext, AudioWorkletNode,
    fetch, structuredClone, AbortController, Date: ClockDate, Int16Array, ArrayBuffer, DataView,
    URL: { revokeObjectURL() {} }, setTimeout(fn, delay) { const id = ++timerSequence; timers.set(id, { fn, delay }); return id; }, clearTimeout(id) { timers.delete(id); } });
  vm.runInContext(recorderSource, context); vm.runInContext(appSource, context); await flush();
  const render = value => { context.testState = value; vm.runInContext('render(testState)', context); };
  const api = action => { context.testAction = action; return vm.runInContext('api(testAction)', context); };
  const begin = async () => { get('ptt').dispatch('pointerdown'); await flush(); };
  const pcm = (count = 2048) => {
    while (count > 0 && nodes.at(-1)?.port.onmessage) { const length = Math.min(count, 256); count -= length; nodes.at(-1).port.onmessage({ data: { type: 'pcm', samples: new Int16Array(length) } }); }
  };
  const release = async () => { get('ptt').dispatch('pointerup'); await flush(); };
  const emit = name => { for (const fn of listeners.get(name) ?? []) fn(); };
  return { get, context, render, api, begin, pcm, release, emit, streams, contexts, nodes, actions, uploads, events, timers, response,
    state: () => structuredClone(server), setServer: value => { server = structuredClone(value); }, at: value => { clock = value; } };
}
test('initial UI and prepare action never request microphone or run command/LLM', async () => {
  const r = await fixture(); assert.equal(r.streams.length, 0); await r.get('recognitionPrepare').onclick();
  assert.deepEqual(r.actions, [{ type: 'recognition_prepare' }]); assert.equal(r.streams.length, 0); assert.equal(r.uploads.length, 0);
});
test('hold reserves before permission, silences playback first, and release uploads authenticated canonical WAV once', async () => {
  const r = await fixture(); r.context.captureEvents = r.events;
  vm.runInContext("playback = { controller: new AbortController(), audio: { pause() { captureEvents.push('playback-paused'); } } }", r.context);
  await r.begin(); assert.equal(r.streams.length, 1); assert.equal(r.actions[0].type, 'ptt_begin');
  assert.ok(r.events.indexOf('playback-paused') < r.events.indexOf('microphone-request'));
  r.pcm(); await r.release(); assert.ok(r.streams[0].track.stops > 0); assert.ok(r.contexts[0].closed > 0);
  assert.equal(r.uploads.length, 1); const upload = r.uploads[0];
  assert.equal(upload.url, '/api/recognition/capture-1'); assert.equal(upload.options.method, 'POST');
  assert.equal(upload.options.headers.Authorization, 'Bearer fixture'); assert.equal(upload.options.headers['Content-Type'], 'audio/wav');
  assert.equal(Buffer.from(upload.options.body).toString('ascii', 0, 4), 'RIFF');
  assert.deepEqual(r.actions, [{ type: 'ptt_begin' }]); r.get('pttCancel').onclick();
});
test('late permission after pointer release stops tracks and cannot upload', async () => {
  const permission = deferred(), r = await fixture({ permission }); await r.begin(); await r.release();
  permission.resolve(r.streams[0]); await flush(); assert.ok(r.streams[0].track.stops > 0);
  assert.equal(r.contexts.length, 0); assert.equal(r.uploads.length, 0);
  assert.deepEqual(r.actions.at(-1), { type: 'ptt_cancel', captureId: 'capture-1' });
});
test('release before reservation arrives cancels the exact late reservation without requesting permission', async () => {
  const reserve = deferred(), r = await fixture({ reserve }); await r.begin(); await r.release();
  reserve.resolve(r.response(reserve.snapshot)); await flush(); assert.equal(r.streams.length, 0); assert.equal(r.uploads.length, 0);
  assert.deepEqual(r.actions.at(-1), { type: 'ptt_cancel', captureId: 'capture-1' });
});
const lifecycleActions = [
  ['reset', { type: 'demo' }], ['pause', { type: 'step', event: 'pause', actorId: 'alpha' }],
  ['possession', { type: 'step', event: 'possession', actorId: 'alpha' }], ['interrupt', { type: 'interrupt' }],
  ['stop engines', { type: 'models_stop' }], ['stop recognition', { type: 'recognition_stop' }],
];
for (const [label, action] of lifecycleActions) {
  test(`${label} immediately closes microphone capture and scopes server cancellation`, async () => {
    const r = await fixture(); await r.begin(); r.pcm(); const pending = r.api(action);
    assert.ok(r.streams[0].track.stops > 0); assert.ok(r.contexts[0].closed > 0); await pending;
    assert.equal(r.uploads.length, 0); assert.ok(r.actions.some(a => a.type === 'ptt_cancel' && a.captureId === 'capture-1'));
  });
}
for (const label of ['blur', 'pagehide', 'hidden page', 'control blur', 'pointercancel', 'lostpointercapture', 'mute']) {
  test(`${label} releases microphone without waiting for preference save or HTTP`, async () => {
    const r = await fixture(); await r.begin(); r.pcm();
    if (label === 'mute') { r.get('micMuted').checked = true; r.get('micMuted').dispatch('change'); }
    else if (label === 'hidden page') { r.context.document.hidden = true; r.emit('document:visibilitychange'); }
    else if (label === 'control blur') r.get('ptt').dispatch('blur');
    else if (label.includes('pointer')) r.get('ptt').dispatch(label);
    else r.emit(label);
    assert.ok(r.streams[0].track.stops > 0); assert.ok(r.contexts[0].closed > 0); assert.equal(r.uploads.length, 0);
    assert.ok(r.actions.every(action => action.type !== 'settings')); await flush();
  });
}
for (const label of ['session', 'cancelled', 'different capture', 'muted', 'expiry']) {
  test(`fresh server ${label} invalidation stops active capture`, async () => {
    const r = await fixture(); await r.begin(); const fresh = r.state();
    if (label === 'session') fresh.speechInput.current.session = 'new-mission';
    if (label === 'cancelled') fresh.speechInput.current.status = 'CANCELLED';
    if (label === 'different capture') fresh.speechInput.current.id = 'new-capture';
    if (label === 'muted') fresh.settings.micMuted = true;
    if (label === 'expiry') fresh.speechInput.current.expiresAtMs = 10000;
    r.setServer(fresh); r.render(fresh); assert.ok(r.streams[0].track.stops > 0); assert.equal(r.uploads.length, 0);
    assert.deepEqual(r.actions.at(-1), { type: 'ptt_cancel', captureId: 'capture-1' });
  });
}
test('cancel while upload is pending aborts only that request and ignores its late transcript', async () => {
  const r = await fixture(); await r.begin(); r.pcm(); await r.release(); const upload = r.uploads[0];
  const stale = r.state(); stale.speechInput.current.status = 'TRANSCRIBED'; stale.speechInput.current.text = 'stale recognised command';
  r.get('pttCancel').onclick(); await flush(); assert.equal(upload.options.signal.aborted, true);
  upload.resolve(r.response(stale)); await flush(); assert.equal(r.get('recognizedText').textContent, 'No current transcript.');
  assert.ok(r.actions.every(a => !['command', 'converse', 'queue'].includes(a.type)));
});
test('transcription is shown as text; copy only fills typed input and only manual Parse submits a command', async () => {
  const r = await fixture(); await r.begin(); r.pcm(); await r.release();
  const result = r.state(); result.speechInput.current.status = 'TRANSCRIBED'; result.speechInput.current.text = '<b>regroup slot 1</b>';
  result.speechInput.current.expiresAtMs = 15000; r.setServer(result); r.uploads[0].resolve(r.response(result)); await flush(); await flush();
  assert.equal(r.get('recognizedText').textContent, '<b>regroup slot 1</b>');
  const before = r.actions.length; r.get('copyTranscript').onclick(); assert.equal(r.actions.length, before);
  assert.equal(r.get('transcript').value, '<b>regroup slot 1</b>'); assert.equal(r.get('transcript').focused, true);
  r.get('command').onsubmit({ preventDefault() {} }); await flush();
  assert.deepEqual(r.actions.at(-1), { type: 'command', text: '<b>regroup slot 1</b>' });
  assert.ok(r.actions.every(a => !['converse', 'synthesize_reply', 'queue'].includes(a.type)));
});
test('expired transcript cannot be copied and is removed on render', async () => {
  const r = await fixture(), shown = r.state(); shown.speechInput.current = { id: 'capture-1', session: 'mock-mission', status: 'TRANSCRIBED', text: 'regroup slot 1', expiresAtMs: 12000 };
  r.render(shown); assert.equal(r.get('copyTranscript').disabled, false); r.at(12000); r.get('copyTranscript').onclick();
  assert.equal(r.get('transcript').value, ''); r.render(shown); assert.equal(r.get('copyTranscript').disabled, true);
  assert.equal(r.get('recognizedText').textContent, 'No current transcript.');
});
test('keyboard hold ignores repeats, release transcribes once, and passive clicks never record', async () => {
  const r = await fixture(); r.get('ptt').dispatch('click'); assert.equal(r.streams.length, 0);
  r.get('ptt').dispatch('keydown', { key: ' ', repeat: false }); await flush();
  r.get('ptt').dispatch('keydown', { key: ' ', repeat: true }); assert.equal(r.streams.length, 1);
  r.pcm(); r.get('ptt').dispatch('keyup', { key: ' ' }); await flush(); assert.equal(r.uploads.length, 1);
  r.get('pttCancel').onclick();
});
test('audio playback cannot begin while a capture is held', async () => {
  const r = await fixture(); await r.begin(); const before = r.events.length; await r.get('listen').onclick();
  assert.equal(r.events.length, before); r.get('pttCancel').onclick();
});
test('prepare and hold are disabled while disconnected, locally muted, or cleanup is pending', async () => {
  const r = await fixture();
  for (const label of ['disconnected', 'muted', 'pendingRecognition', 'stopping', 'cleanupPending']) {
    const fresh = state(); if (label === 'disconnected') fresh.classification = 'DISCONNECTED';
    else if (label === 'muted') fresh.settings.micMuted = true; else fresh.speechInput[label] = true;
    r.render(fresh); assert.equal(r.get('ptt').disabled, true); assert.equal(r.get('recognitionPrepare').disabled, true);
  }
});
test('unconfirmed track shutdown attempts context cleanup, blocks further captures and displays the limitation', async () => {
  const r = await fixture(); await r.begin(); r.pcm(); r.streams[0].track.stop = () => { throw new Error('Synthetic stop failure'); };
  await r.release(); assert.ok(r.contexts[0].closed > 0); assert.equal(r.uploads.length, 0);
  assert.equal(r.get('ptt').disabled, true); assert.match(r.get('recognitionStatus').textContent, /shutdown unconfirmed/);
  await r.begin(); assert.equal(r.streams.length, 1);
});
