// Execute the actual client script in Node VM with fake DOM/fetch/Audio.
// This tests lifecycle logic, not browser layout, audio output or usability.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { setImmediate as flush } from 'node:timers/promises';

const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
function state({ audioId = 'audio1', replyId = 'reply1', session = 'mission1', playing = false } = {}) {
  return { classification: 'MOCK_ONLY', clockMs: 1000,
    settings: { version: 1, micMuted: false, speechMuted: false, quiet: false,
      pilots: ['alpha', 'bravo', 'charlie'].map((id, i) => ({ id, profile: ['edge', 'tactician', 'scout'][i], mode: 'ADVISORY', callsign: null, voice: null })) },
    control: { recommendations: [], armed: false, capabilities: [], pending: [], ledger: [], nativeCalls: 0 },
    radio: { playing: playing ? { lineId: audioId, speakerId: 'alpha', text: 'Generated preview' } : null },
    localModels: { language: { state: 'READY' }, speech: { state: 'READY' }, starting: false, error: null,
      reply: { id: replyId, session, speakerId: 'alpha', pawnId: 'pawn1', generation: 1,
        status: 'GENERATED', text: 'A generated line.', expiresAtMs: 20000 },
      audio: { id: audioId, status: playing ? 'DELIVERED_FOR_USER_PLAYBACK' : 'READY', voiceId: 'af_bella' } },
    last: null, integration: { game: 'NOT_BUILT' } };
}

async function fixture() {
  const elements = new Map(), calls = [], actions = [], audioFetches = [], audios = [], urls = [], revoked = [], listeners = {};
  const stateQueue = []; let server = state(), clock = 10000, audioPlay = null;
  class Element {
    constructor(tag = 'div') { this.tagName = tag; this.children = []; this.value = ''; this.textContent = ''; this.checked = false; this.disabled = false; this.listeners = {}; }
    set id(value) { this._id = value; elements.set(value, this); }
    get id() { return this._id; }
    append(...nodes) { this.children.push(...nodes); }
    replaceChildren(...nodes) { this.children = nodes; }
    addEventListener(name, handler) { this.listeners[name] = handler; }
  }
  const get = id => { if (!elements.has(id)) { const e = new Element(); e.id = id; } return elements.get(id); };
  const jsonResponse = data => ({ ok: true, json: async () => structuredClone(data) });
  const fetch = (url, options = {}) => {
    const call = { url, options }; calls.push(call);
    if (url.startsWith('/api/audio/')) { const d = deferred(); audioFetches.push({ ...call, ...d }); return d.promise; }
    if (url === '/api/action') { actions.push(JSON.parse(options.body)); return Promise.resolve(jsonResponse(server)); }
    if (url === '/api/state') return stateQueue.length ? stateQueue.shift().promise : Promise.resolve(jsonResponse(server));
    throw new Error('Unexpected mocked URL');
  };
  class Audio {
    constructor(url) { this.url = url; this.playCalls = 0; this.pauses = 0; audios.push(this); }
    async play() { this.playCalls++; if (audioPlay) await audioPlay.promise; }
    pause() { this.pauses++; }
  }
  class ClockDate extends Date { static now() { return clock; } }
  const context = vm.createContext({ document: { getElementById: get, createElement: tag => new Element(tag) },
    window: { addEventListener: (name, handler) => { listeners[name] = handler; } },
    location: { hash: '#synthetic-process-session' }, structuredClone, AbortController, fetch, Audio, Date: ClockDate,
    URL: { createObjectURL(blob) { const url = `blob:synthetic-${urls.length + 1}`; urls.push({ url, blob }); return url; }, revokeObjectURL(url) { revoked.push(url); } },
    setTimeout: () => 1, clearTimeout: () => {} });
  vm.runInContext(source, context, { filename: 'companion/public/app.js' }); await flush();
  const api = action => { context.reviewAction = action; return vm.runInContext('api(reviewAction)', context); };
  const render = data => { context.reviewState = data; return vm.runInContext('render(reviewState)', context); };
  const listen = () => get('listen').onclick();
  const begin = async () => { const pending = listen(); await flush(); return { pending, request: audioFetches.at(-1) }; };
  const completeAudio = async (job, data = state({ playing: true })) => {
    server = structuredClone(data); job.request.resolve({ ok: true, blob: async () => ({ type: 'audio/wav', synthetic: true }) });
    await job.pending; await flush();
  };
  return { get, calls, actions, audioFetches, audios, urls, revoked, listeners, api, render, listen, begin, completeAudio,
    setServer: value => { server = structuredClone(value); }, queueState: d => { stateQueue.push(d); },
    at: value => { clock = value; }, deferPlay: d => { audioPlay = d; }, jsonResponse };
}

test('loading and rendering a generated reply never automatically requests or plays audio', async () => {
  const r = await fixture(); r.render(state()); await flush();
  assert.equal(r.audioFetches.length, 0); assert.equal(r.audios.length, 0); assert.equal(r.actions.length, 0);
  assert.match(r.get('reply').textContent, /facts unverified/);
});

test('an explicit listen fetches fresh state before one playback and releases on natural end', async () => {
  const r = await fixture(), job = await r.begin(); await r.completeAudio(job);
  assert.equal(r.audios.length, 1); assert.equal(r.audios[0].playCalls, 1);
  assert.equal(r.calls.at(-1).url, '/api/state'); assert.equal(r.urls.length, 1);
  r.audios[0].onended(); await flush();
  assert.deepEqual(r.actions.at(-1), { type: 'radio_complete', lineId: 'audio1' });
  assert.deepEqual(r.revoked, [r.urls[0].url]);
});

const cancellations = [
  ['interrupt', { type: 'interrupt' }], ['reset', { type: 'demo' }], ['stop engines', { type: 'models_stop' }],
  ['new question', { type: 'converse', actorId: 'bravo', text: 'New question.' }], ['new synthesis', { type: 'synthesize_reply' }],
  ['pause', { type: 'step', actorId: 'alpha', event: 'pause' }], ['possession', { type: 'step', actorId: 'alpha', event: 'possession' }],
  ['speech mute', { type: 'settings', settings: { speechMuted: true } }], ['radio completion', { type: 'radio_complete', lineId: 'audio1' }],
  ['preview timing change', { type: 'preview_timing', allowSlow: true }],
];
for (const [label, action] of cancellations) {
  test(`${label} during delayed audio fetch blocks late playback even if fetch ignores abort`, async () => {
    const r = await fixture(), job = await r.begin(); await r.api(action);
    assert.equal(job.request.options.signal.aborted, true);
    await r.completeAudio(job);
    assert.equal(r.audios.length, 0); assert.equal(r.urls.length, 0);
    assert.deepEqual(r.actions, [action]);
  });
}

test('interrupt while response.blob is pending discards the late blob without creating Audio', async () => {
  const r = await fixture(), blob = deferred(), job = await r.begin();
  job.request.resolve({ ok: true, blob: () => blob.promise }); await flush();
  await r.api({ type: 'interrupt' }); blob.resolve({ synthetic: true }); await job.pending;
  assert.equal(r.audios.length, 0); assert.equal(r.urls.length, 0);
});

test('reset during the final fresh-state request cannot start the old audio', async () => {
  const r = await fixture(), fresh = deferred(), job = await r.begin(); r.queueState(fresh);
  job.request.resolve({ ok: true, blob: async () => ({ synthetic: true }) }); await flush();
  await r.api({ type: 'demo' }); fresh.resolve(r.jsonResponse(state({ playing: true }))); await job.pending;
  assert.equal(r.audios.length, 0); assert.equal(r.urls.length, 0);
});

for (const changed of ['radio reservation', 'reply', 'mission', 'expiry', 'speech mute']) {
  test(`fresh ${changed} change denies playback after bytes arrived`, async () => {
    const r = await fixture(), job = await r.begin(), fresh = state({ playing: true });
    if (changed === 'radio reservation') fresh.radio.playing.lineId = 'other-line';
    if (changed === 'reply') fresh.localModels.reply.id = 'new-reply';
    if (changed === 'mission') fresh.localModels.reply.session = 'new-mission';
    if (changed === 'expiry') fresh.localModels.reply.expiresAtMs = 10000;
    if (changed === 'speech mute') fresh.settings.speechMuted = true;
    await r.completeAudio(job, fresh);
    assert.equal(r.audios.length, 0); assert.equal(r.urls.length, 0);
    assert.ok(r.actions.every(action => action.type !== 'interrupt'), 'Automatic stale-job cleanup must not interrupt unrelated server work.');
    for (const action of r.actions) assert.deepEqual(action, { type: 'radio_complete', lineId: 'audio1' });
  });
}

test('an old fetch error cannot interrupt a newer successfully playing job', async () => {
  const r = await fixture(), old = await r.begin(); await r.api({ type: 'interrupt' });
  const newState = state({ audioId: 'audio2', replyId: 'reply2' }); r.setServer(newState); r.render(newState);
  const fresh = await r.begin(); await r.completeAudio(fresh, state({ audioId: 'audio2', replyId: 'reply2', playing: true }));
  const before = r.actions.length, active = r.audios[0];
  old.request.reject(new Error('Old synthetic fetch failed.')); await old.pending; await flush();
  assert.equal(r.actions.length, before); assert.equal(active.pauses, 0);
  assert.equal(active.playCalls, 1); assert.equal(r.get('error').textContent, '');
});

test('late old ended/error events cannot complete or interrupt a new job', async () => {
  const r = await fixture(), old = await r.begin(); await r.completeAudio(old); const oldAudio = r.audios[0];
  await r.api({ type: 'interrupt' });
  const next = state({ audioId: 'audio2', replyId: 'reply2' }); r.setServer(next); r.render(next);
  const fresh = await r.begin(); await r.completeAudio(fresh, state({ audioId: 'audio2', replyId: 'reply2', playing: true }));
  const before = r.actions.length; oldAudio.onended(); oldAudio.onerror(); await flush();
  assert.equal(r.actions.length, before); assert.equal(r.audios[1].pauses, 0);
});

test('playback failure releases only its captured line, even if server state advanced unseen', async () => {
  const r = await fixture(), job = await r.begin(); await r.completeAudio(job);
  r.setServer(state({ audioId: 'audio2', replyId: 'reply2', playing: true }));
  r.audios[0].onerror(); await flush();
  assert.deepEqual(r.actions.at(-1), { type: 'radio_complete', lineId: 'audio1' });
  assert.ok(r.actions.every(action => action.type !== 'interrupt'));
});

test('interrupt during pending play pauses Audio and cannot revive it when play resolves', async () => {
  const r = await fixture(), play = deferred(); r.deferPlay(play); const job = await r.begin();
  r.setServer(state({ playing: true })); job.request.resolve({ ok: true, blob: async () => ({ synthetic: true }) }); await flush();
  assert.equal(r.audios.length, 1); await r.api({ type: 'interrupt' }); play.resolve(); await job.pending;
  assert.ok(r.audios[0].pauses >= 1); assert.equal(r.audios[0].playCalls, 1);
});

test('render invalidation and pagehide revoke an existing playback resource', async () => {
  const r = await fixture(), job = await r.begin(); await r.completeAudio(job);
  r.render(state({ audioId: 'new-audio', replyId: 'new-reply' }));
  assert.ok(r.audios[0].pauses >= 1); assert.deepEqual(r.revoked, [r.urls[0].url]);
  r.listeners.pagehide(); assert.deepEqual(r.revoked, [r.urls[0].url]);
});

test('out-of-order state responses cannot restore older mission/reply UI', async () => {
  const r = await fixture(), old = deferred(); r.queueState(old);
  const oldRequest = r.api(); await flush();
  const fresh = state({ replyId: 'new-reply', session: 'new-mission' }); fresh.localModels.reply.text = 'Fresh reply'; r.setServer(fresh);
  await r.api(); old.resolve(r.jsonResponse(state())); await oldRequest;
  assert.match(r.get('reply').textContent, /Fresh reply/); assert.doesNotMatch(r.get('reply').textContent, /A generated line/);
});
