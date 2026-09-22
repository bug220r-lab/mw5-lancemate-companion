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

async function fixture({ deferCommands = false } = {}) {
  const elements = new Map(), calls = [], actions = [], audioFetches = [], audios = [], urls = [], revoked = [], listeners = {};
  const commandRequests = [];
  const timers = new Map(); let nextTimer = 0;
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
    if (url === '/api/action') {
      const action = JSON.parse(options.body); actions.push(action);
      if (deferCommands && action.type === 'command') {
        const pending = deferred(); commandRequests.push({ action, ...pending }); return pending.promise;
      }
      return Promise.resolve(jsonResponse(server));
    }
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
    setTimeout: (callback, ms) => { const id = ++nextTimer; timers.set(id, { callback, ms }); return id; },
    clearTimeout: id => timers.delete(id) });
  vm.runInContext(source, context, { filename: 'companion/public/app.js' }); await flush();
  const api = action => { context.reviewAction = action; return vm.runInContext('api(reviewAction)', context); };
  const render = data => { context.reviewState = data; return vm.runInContext('render(reviewState)', context); };
  const listen = () => get('listen').onclick();
  const begin = async () => { const pending = listen(); await flush(); return { pending, request: audioFetches.at(-1) }; };
  const completeAudio = async (job, data = state({ playing: true })) => {
    server = structuredClone(data); job.request.resolve({ ok: true, blob: async () => ({ type: 'audio/wav', synthetic: true }) });
    await job.pending; await flush();
  };
  return { get, calls, actions, commandRequests, audioFetches, audios, urls, revoked, listeners, timers, api, render, listen, begin, completeAudio,
    setServer: value => { server = structuredClone(value); }, queueState: d => { stateQueue.push(d); },
    at: value => { clock = value; }, deferPlay: d => { audioPlay = d; }, jsonResponse };
}

test('loading and rendering a generated reply never automatically requests or plays audio', async () => {
  const r = await fixture(); r.render(state()); await flush();
  assert.equal(r.audioFetches.length, 0); assert.equal(r.audios.length, 0); assert.equal(r.actions.length, 0);
  assert.match(r.get('reply').textContent, /facts unverified/);
});

test('a running resource watchdog keeps status refreshed without starting or playing anything', async () => {
  const r = await fixture(), next = state(); next.localModels.resources = { monitoring: true, cleanupPending: false };
  r.setServer(next); r.render(next);
  const refresh = [...r.timers.values()].find(timer => timer.ms === 750);
  assert.ok(refresh, 'Server-side watchdog changes must become visible even when the engines are idle.');
  refresh.callback(); await flush();
  assert.equal(r.calls.at(-1).url, '/api/state');
  assert.equal(r.actions.length, 0); assert.equal(r.audios.length, 0);
});

for (const reason of ['starting', 'stopping', 'cleanupPending', 'resourceCleanup']) {
  test(`resident ${reason} blocks new work and cancels current playback`, async () => {
    const r = await fixture(), job = await r.begin(); await r.completeAudio(job);
    const next = state({ playing: true });
    if (reason === 'resourceCleanup') next.localModels.resources = { cleanupPending: true };
    else next.localModels[reason] = true;
    r.render(next);
    for (const id of ['modelsStart', 'askPilot', 'synthesize', 'listen']) assert.equal(r.get(id).disabled, true);
    assert.equal(r.audios[0].pauses, 1); assert.equal(r.revoked.length, 1);
    const requests = r.audioFetches.length; await r.listen();
    assert.equal(r.audioFetches.length, requests);
  });
}

test('pending engine cleanup in the final state check prevents late audio playback', async () => {
  const r = await fixture(), job = await r.begin(), next = state({ playing: true });
  next.localModels.cleanupPending = true;
  await r.completeAudio(job, next);
  assert.equal(r.audios.length, 0); assert.equal(r.urls.length, 0);
});

test('a refused memory admission explains the requirement and permits a later explicit retry', async () => {
  const r = await fixture(), next = state();
  next.localModels.language.state = 'STOPPED'; next.localModels.speech.state = 'STOPPED';
  next.localModels.reply = null; next.localModels.audio = null;
  next.localModels.error = 'RESOURCE_ADMISSION_RAM';
  next.localModels.resources = { monitoring: false, cleanupPending: false };
  r.render(next);
  assert.match(r.get('modelStatus').textContent, /5 GiB/);
  assert.equal(r.get('modelsStart').disabled, false);
  assert.equal(r.get('askPilot').disabled, true);
  assert.equal(r.actions.length, 0);
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

function descendants(element) { return [element, ...element.children.flatMap(descendants)]; }

test('each Action status button requests only the exact pilot on its card', async () => {
  const r = await fixture();
  for (const [index, actorId] of ['alpha', 'bravo', 'charlie'].entries()) {
    const card = r.get('pilots').children[index];
    const buttons = descendants(card).filter(node => node.tagName === 'button' && node.textContent === 'Action status');
    assert.equal(buttons.length, 1); assert.equal(buttons[0].disabled, false);
    await buttons[0].onclick();
    assert.deepEqual(r.actions.at(-1), { type: 'mission_status', actorId });
  }
  assert.equal(r.actions.length, 3); assert.equal(r.audioFetches.length, 0); assert.equal(r.audios.length, 0);
});

test('authored Action status response is labeled text-only without invoking engines, generation or playback', async () => {
  const r = await fixture(), response = state();
  response.localModels.language.state = 'STOPPED'; response.localModels.speech.state = 'STOPPED';
  response.localModels.reply = null; response.localModels.audio = null;
  response.missionSpeech = { status: 'PREPARED', request: { speakerId: 'bravo' },
    text: 'Simulation: My regroup request was submitted. Acceptance is unconfirmed.',
    classification: 'MOCK_ONLY', liveEligible: false, dispatchable: false };
  r.setServer(response);
  const button = descendants(r.get('pilots').children[1]).find(node => node.textContent === 'Action status');
  await button.onclick();
  assert.equal(r.get('radio').textContent, `bravo: ${response.missionSpeech.text} (authored status; text only)`);
  assert.deepEqual(r.actions, [{ type: 'mission_status', actorId: 'bravo' }]);
  assert.equal(r.audioFetches.length, 0); assert.equal(r.audios.length, 0); assert.equal(r.urls.length, 0);
  assert.equal(r.get('reply').textContent, 'No generated reply.');
});

test('a fresh expired or absent status response removes the authored status on the next render', async () => {
  const r = await fixture();
  for (const replacement of [{ status: 'EXPIRED' }, { status: 'REJECTED', reason: 'LINE_EXPIRED_OR_INVALID' }, null, undefined]) {
    const shown = state(); shown.missionSpeech = { status: 'PREPARED', request: { speakerId: 'alpha' }, text: 'I have no current report for that action.' };
    r.render(shown); assert.match(r.get('radio').textContent, /authored status; text only/);
    const next = state(); if (replacement !== undefined) next.missionSpeech = replacement;
    r.setServer(next); await r.api();
    assert.equal(r.get('radio').textContent, 'No speaker.');
  }
  assert.equal(r.actions.length, 0); assert.equal(r.audioFetches.length, 0); assert.equal(r.audios.length, 0);
});

test('a poll carrying the prior parser result cannot impersonate a pending new command and invalidation rejects late results', async () => {
  const r = await fixture({ deferCommands: true });
  const parsed = (action, recipient) => ({ ...state(), last: { status: 'INTENT', action, recipientIds: [recipient],
    inputSource: 'TYPED_TRANSCRIPT_FIXTURE', classification: 'MOCK_ONLY', dispatchable: false } });
  const submit = async text => {
    r.get('transcript').value = text; r.get('transcript').listeners.input();
    r.get('command').onsubmit({ preventDefault() {} }); await flush();
    return r.commandRequests.at(-1);
  };
  const a = await submit('regroup slot 1');
  a.resolve(r.jsonResponse(parsed('REGROUP', 'alpha'))); await flush();
  assert.match(r.get('commandPreview').textContent, /regroup for alpha/);

  const b = await submit('focus slot 2');
  r.setServer(parsed('REGROUP', 'alpha')); await r.api();
  assert.doesNotMatch(r.get('commandPreview').textContent, /regroup for alpha|focus .*bravo/);
  b.resolve(r.jsonResponse(parsed('FOCUS', 'bravo'))); await flush();
  assert.match(r.get('commandPreview').textContent, /focus .*bravo/);
  assert.match(r.get('commandPreview').textContent, /Nothing was sent/);

  const edited = await submit('regroup slot 3');
  r.get('transcript').value = 'regroup slot 2'; r.get('transcript').listeners.input();
  edited.resolve(r.jsonResponse(parsed('REGROUP', 'charlie'))); await flush();
  assert.doesNotMatch(r.get('commandPreview').textContent, /regroup for charlie/);

  const reset = await submit('regroup slot 3');
  r.setServer(state()); await r.api({ type: 'demo' });
  reset.resolve(r.jsonResponse(parsed('REGROUP', 'charlie'))); await flush();
  assert.doesNotMatch(r.get('commandPreview').textContent, /regroup for charlie/);
  assert.equal(r.audioFetches.length, 0); assert.equal(r.audios.length, 0);
});
