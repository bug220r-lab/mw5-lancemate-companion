// MOCK_ONLY. Execute the actual client in Node VM with fake DOM/fetch/Audio.
// No browser, devices, audio output, models, services or native game calls run.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { setImmediate as flush } from 'node:timers/promises';

const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
const receipt = '11111111-2222-4333-8444-555555555555';
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function state({ audioId = 'audio1', replyId = 'reply1', session = 'mission1',
  exchangeId = 'exchange1', turn = 0, playing = false, exchange = true,
  status = 'GENERATED', actorIds = ['alpha', 'bravo'] } = {}) {
  const speakerId = actorIds[turn] || actorIds[0];
  return { classification: 'MOCK_ONLY', clockMs: 1000,
    commandPreviewContext: `preview-${session}`,
    settings: { version: 1, micMuted: false, speechMuted: false, quiet: false,
      pilots: ['alpha', 'bravo', 'charlie'].map((id, i) => ({ id,
        profile: ['edge', 'tactician', 'scout'][i], mode: 'ADVISORY', callsign: null, voice: null })) },
    control: { recommendations: [], armed: false, capabilities: [], pending: [], ledger: [], nativeCalls: 0 },
    radio: { playing: playing ? { lineId: audioId, speakerId, pawnId: `pawn-${speakerId}`, generation: 1,
      text: 'Synthetic exchange preview',
      ...(exchange ? { exchangeId, exchangeTurn: turn } : {}) } : null },
    localModels: { language: { state: 'READY' }, speech: { state: 'READY' },
      starting: false, stopping: false, cleanupPending: false, error: null,
      ...(exchange ? { exchange: { id: exchangeId, status, turn, actorIds,
        classification: 'OFFLINE_EXCHANGE_PREVIEW' } } : {}),
      reply: { id: replyId, session, speakerId, pawnId: `pawn-${speakerId}`, generation: 1,
        status: 'GENERATED', text: 'A synthetic line.', expiresAtMs: 20000,
        ...(exchange ? { exchangeId, exchangeTurn: turn } : {}) },
      audio: { id: audioId, status: playing ? 'DELIVERED_FOR_USER_PLAYBACK' : 'READY', voiceId: 'af_bella' } },
    last: null, integration: { game: 'NOT_BUILT' } };
}

async function fixture({ initial = state() } = {}) {
  const elements = new Map(), calls = [], actions = [], audioFetches = [], audios = [];
  const urls = [], revoked = [], listeners = {}, timers = new Map(), stateQueue = [];
  let server = structuredClone(initial), clock = 10000, playBehavior = null, nextTimer = 0;
  class Element {
    constructor(tag = 'div') {
      this.tagName = tag; this.children = []; this.value = ''; this.textContent = '';
      this.checked = false; this.disabled = false; this.listeners = {};
    }
    set id(value) { this._id = value; elements.set(value, this); }
    get id() { return this._id; }
    append(...nodes) { this.children.push(...nodes); }
    replaceChildren(...nodes) { this.children = nodes; }
    addEventListener(name, handler) { this.listeners[name] = handler; }
  }
  const get = id => {
    if (!elements.has(id)) { const element = new Element(); element.id = id; }
    return elements.get(id);
  };
  const jsonResponse = data => ({ ok: true, json: async () => structuredClone(data),
    headers: { get: () => null } });
  const fetch = (url, options = {}) => {
    const call = { url, options }; calls.push(call);
    if (url.startsWith('/api/audio/')) {
      const pending = deferred(); audioFetches.push({ ...call, ...pending }); return pending.promise;
    }
    if (url === '/api/action') {
      actions.push(JSON.parse(options.body)); return Promise.resolve(jsonResponse(server));
    }
    if (url === '/api/state')
      return stateQueue.length ? stateQueue.shift().promise : Promise.resolve(jsonResponse(server));
    throw new Error(`Unexpected mocked URL ${url}`);
  };
  class Audio {
    constructor(url) { this.url = url; this.playCalls = 0; this.pauses = 0; audios.push(this); }
    async play() { this.playCalls++; if (playBehavior) await playBehavior(); }
    pause() { this.pauses++; }
  }
  class ClockDate extends Date { static now() { return clock; } }
  const context = vm.createContext({
    document: { getElementById: get, createElement: tag => new Element(tag) },
    window: { addEventListener: (name, handler) => { listeners[name] = handler; } },
    location: { hash: '#synthetic-process-session' }, structuredClone, AbortController,
    fetch, Audio, Date: ClockDate,
    URL: { createObjectURL(blob) { const url = `blob:synthetic-${urls.length + 1}`;
      urls.push({ url, blob }); return url; }, revokeObjectURL(url) { revoked.push(url); } },
    setTimeout(callback, ms) { const id = ++nextTimer; timers.set(id, { callback, ms }); return id; },
    clearTimeout: id => timers.delete(id),
  });
  // The fake DOM has no HTML parser; mirror the real selects' initial values.
  get('speaker').value = 'alpha'; get('exchangePartner').value = 'bravo';
  vm.runInContext(source, context, { filename: 'companion/public/app.js' }); await flush();
  const api = action => { context.reviewAction = action; return vm.runInContext('api(reviewAction)', context); };
  const render = data => { context.reviewState = data; return vm.runInContext('render(reviewState)', context); };
  const listen = () => get('listen').onclick();
  const begin = async () => {
    const count = audioFetches.length, pending = listen(); await flush();
    assert.equal(audioFetches.length, count + 1, 'An explicit eligible listen must request one audio file.');
    return { pending, request: audioFetches.at(-1) };
  };
  const audioResponse = ({ secret = receipt, blob = async () => ({ type: 'audio/wav', synthetic: true }), ok = true } = {}) => ({
    ok, blob, json: async () => ({ error: 'Synthetic audio fetch failure' }),
    headers: { get: name => name.toLowerCase() === 'x-mw5-playback-receipt' ? secret : null },
  });
  const deliver = async (job, data = state({ playing: true }), response = audioResponse()) => {
    server = structuredClone(data); job.request.resolve(response); await job.pending; await flush();
  };
  const displayedText = () => {
    const seen = new Set();
    const visit = element => {
      if (!element || seen.has(element)) return '';
      seen.add(element);
      return [element.textContent, element.value, element.innerHTML,
        ...element.children.map(visit)].filter(value => typeof value === 'string').join('\n');
    };
    return [...elements.values()].map(visit).join('\n');
  };
  return { get, actions, calls, audioFetches, audios, urls, revoked, listeners, timers,
    api, render, listen, begin, deliver, audioResponse, jsonResponse, displayedText,
    setServer: value => { server = structuredClone(value); },
    queueState: pending => { stateQueue.push(pending); },
    at: value => { clock = value; },
    playWith: value => { playBehavior = value; },
    tickTimers: async () => {
      for (const [id, timer] of [...timers]) { timers.delete(id); timer.callback(); }
      await flush();
    },
  };
}

function assertNoAdvance(r) {
  assert.ok(r.actions.every(action => !['playback_complete', 'radio_complete'].includes(action.type)),
    'An unsuccessful or stale exchange cannot acknowledge completion.');
}
function assertOnlyFailure(r, id = 'audio1') {
  assert.deepEqual(r.actions, [{ type: 'playback_failed', lineId: id, receipt }]);
  assertNoAdvance(r);
}

test('exchange preview is an explicit actor-pair request without synthesis or playback', async () => {
  const r = await fixture({ initial: state({ exchange: false }) });
  assert.equal(typeof r.get('previewExchange').onclick, 'function');
  r.get('speaker').value = 'alpha'; r.get('exchangePartner').value = 'bravo';
  await r.get('previewExchange').onclick(); await flush();
  assert.deepEqual(r.actions, [{ type: 'exchange_preview', actorIds: ['alpha', 'bravo'] }]);
  assert.equal(r.audioFetches.length, 0); assert.equal(r.audios.length, 0);
});

test('primary selection chooses a distinct partner and a scripted duplicate pair cannot submit', async () => {
  const r = await fixture({ initial: state({ exchange: false }) });
  r.get('speaker').value = 'bravo'; r.get('speaker').onchange();
  assert.equal(r.get('exchangePartner').value, 'alpha');
  assert.equal(r.get('previewExchange').disabled, false);
  r.get('exchangePartner').value = 'bravo';
  await r.get('previewExchange').onclick(); await flush();
  assert.deepEqual(r.actions, []);
  assert.equal(r.get('exchangePartner').value, 'bravo', 'A direct duplicate request must be refused without silently changing its recipient.');
  assert.equal(r.audioFetches.length, 0);
});

test('rendering exchange status does not automatically generate, synthesize or listen', async () => {
  const r = await fixture(); r.render(state()); await flush();
  assert.ok(r.get('exchangeStatus').textContent.length > 0);
  assert.deepEqual(r.actions, []); assert.equal(r.audioFetches.length, 0); assert.equal(r.audios.length, 0);
});

test('only eligible natural end after successful play sends the private exchange receipt once', async () => {
  const r = await fixture(), job = await r.begin(); await r.deliver(job);
  assert.equal(r.audios.length, 1); assert.equal(r.audios[0].playCalls, 1);
  assert.deepEqual(r.actions, [], 'Fetching or starting audio must not acknowledge a completed turn.');
  const next = state({ turn: 1, audioId: 'audio2', replyId: 'reply2' });
  next.localModels.audio = null; r.setServer(next);
  const audio = r.audios[0]; audio.onended(); await flush();
  assert.deepEqual(r.actions, [{ type: 'playback_complete', lineId: 'audio1', receipt }]);
  audio.onended(); audio.onerror(); await flush();
  await r.tickTimers();
  assert.equal(r.actions.length, 1); assert.equal(r.audioFetches.length, 1);
  assert.equal(r.audios.length, 1); assert.deepEqual(r.revoked, [r.urls[0].url]);
  assert.doesNotMatch(r.displayedText(), new RegExp(receipt));
});

test('the second explicit turn completes only its own receipt without automatically generating or playing more', async () => {
  const initial = state({ turn: 1, audioId: 'audio2', replyId: 'reply2' });
  const r = await fixture({ initial }), job = await r.begin();
  await r.deliver(job, state({ turn: 1, audioId: 'audio2', replyId: 'reply2', playing: true }));
  r.setServer(state({ turn: 1, audioId: 'audio2', replyId: 'reply2', status: 'COMPLETED' }));
  r.audios[0].onended(); await flush(); await r.tickTimers();
  assert.deepEqual(r.actions, [{ type: 'playback_complete', lineId: 'audio2', receipt }]);
  assert.equal(r.audioFetches.length, 1); assert.equal(r.audios.length, 1);
});

test('generic completion is disabled and its handler refuses an exchange reservation', async () => {
  const r = await fixture({ initial: state({ playing: true }) });
  assert.equal(r.get('complete').disabled, true);
  await r.get('complete').onclick(); await flush();
  assert.deepEqual(r.actions, []);
});

test('exchange receipt remains private through loading, playback and failure', async () => {
  const r = await fixture(), job = await r.begin(); await r.deliver(job);
  assert.doesNotMatch(r.displayedText(), new RegExp(receipt));
  r.audios[0].onerror(); await flush();
  assertOnlyFailure(r); assert.doesNotMatch(r.displayedText(), new RegExp(receipt));
});

test('audio error reports failure rather than completing an exchange', async () => {
  const r = await fixture(), job = await r.begin(); await r.deliver(job);
  r.audios[0].onerror(); await flush();
  assertOnlyFailure(r); assert.equal(r.revoked.length, 1);
});

test('rejected play reports failure and a late ended event cannot advance', async () => {
  const r = await fixture(); r.playWith(async () => { throw new Error('Synthetic play rejection'); });
  const job = await r.begin(); await r.deliver(job);
  assertOnlyFailure(r); r.audios[0].onended(); await flush(); assertOnlyFailure(r);
});

test('a blob failure reports only the receipt-bound exchange failure', async () => {
  const r = await fixture(), job = await r.begin();
  await r.deliver(job, state({ playing: true }), r.audioResponse({ blob: async () => { throw new Error('Synthetic blob failure'); } }));
  assertOnlyFailure(r); assert.equal(r.audios.length, 0); assert.equal(r.urls.length, 0);
});

test('a failed fetch without a receipt cannot send a completion or failure receipt', async () => {
  const r = await fixture(), job = await r.begin();
  job.request.reject(new Error('Synthetic fetch failure')); await job.pending; await flush();
  assert.deepEqual(r.actions, []); assertNoAdvance(r); assert.equal(r.audios.length, 0);
});

test('an unsuccessful HTTP response without a receipt cannot acknowledge exchange playback', async () => {
  const r = await fixture(), job = await r.begin();
  await r.deliver(job, state({ playing: true }), r.audioResponse({ secret: null, ok: false }));
  assert.deepEqual(r.actions, []); assert.equal(r.audios.length, 0); assert.equal(r.urls.length, 0);
});

test('an exchange response without its private receipt cannot begin playback', async () => {
  const r = await fixture(), job = await r.begin();
  await r.deliver(job, state({ playing: true }), r.audioResponse({ secret: null }));
  assert.deepEqual(r.actions, []); assert.equal(r.audios.length, 0); assert.equal(r.urls.length, 0);
});

test('fresh-state request failure reports failure using the captured receipt', async () => {
  const r = await fixture(), fresh = deferred(), job = await r.begin(); r.queueState(fresh);
  job.request.resolve(r.audioResponse()); await flush();
  fresh.reject(new Error('Synthetic state failure')); await job.pending; await flush();
  assertOnlyFailure(r); assert.equal(r.audios.length, 0);
});

for (const changed of ['missing exchange', 'exchange identity', 'exchange turn', 'cancelled exchange',
  'generating exchange', 'completed exchange', 'exchange actors', 'exchange classification',
  'reply exchange identity', 'reply exchange turn', 'reply speaker', 'reply pawn', 'reply generation',
  'undelivered audio', 'radio reservation', 'radio exchange identity', 'radio exchange turn',
  'radio speaker', 'radio pawn', 'radio generation', 'speech mute']) {
  test(`fresh ${changed} denies exchange playback after bytes arrive`, async () => {
    const r = await fixture(), job = await r.begin(), next = state({ playing: true });
    if (changed === 'missing exchange') delete next.localModels.exchange;
    if (changed === 'exchange identity') next.localModels.exchange.id = 'other-exchange';
    if (changed === 'exchange turn') next.localModels.exchange.turn = 1;
    if (changed === 'cancelled exchange') next.localModels.exchange.status = 'CANCELLED';
    if (changed === 'generating exchange') next.localModels.exchange.status = 'GENERATING';
    if (changed === 'completed exchange') next.localModels.exchange.status = 'COMPLETED';
    if (changed === 'exchange actors') next.localModels.exchange.actorIds = ['alpha', 'charlie'];
    if (changed === 'exchange classification') next.localModels.exchange.classification = 'GAME_OBSERVED';
    if (changed === 'reply exchange identity') next.localModels.reply.exchangeId = 'other-exchange';
    if (changed === 'reply exchange turn') next.localModels.reply.exchangeTurn = 1;
    if (changed === 'reply speaker') next.localModels.reply.speakerId = 'bravo';
    if (changed === 'reply pawn') next.localModels.reply.pawnId = 'replacement-pawn';
    if (changed === 'reply generation') next.localModels.reply.generation = 2;
    if (changed === 'undelivered audio') next.localModels.audio.status = 'AWAITING_DELIVERY';
    if (changed === 'radio reservation') next.radio.playing.lineId = 'other-audio';
    if (changed === 'radio exchange identity') next.radio.playing.exchangeId = 'other-exchange';
    if (changed === 'radio exchange turn') next.radio.playing.exchangeTurn = 1;
    if (changed === 'radio speaker') next.radio.playing.speakerId = 'bravo';
    if (changed === 'radio pawn') next.radio.playing.pawnId = 'replacement-pawn';
    if (changed === 'radio generation') next.radio.playing.generation = 2;
    if (changed === 'speech mute') next.settings.speechMuted = true;
    await r.deliver(job, next);
    assertOnlyFailure(r); assert.equal(r.audios.length, 0); assert.equal(r.urls.length, 0);
  });
}

for (const changed of ['GENERATING', 'COMPLETED', 'CANCELLED', 'missing reply exchange', 'malformed turn']) {
  test(`initial ${changed} exchange state cannot request audio`, async () => {
    const initial = state();
    if (['GENERATING', 'COMPLETED', 'CANCELLED'].includes(changed)) initial.localModels.exchange.status = changed;
    if (changed === 'missing reply exchange') delete initial.localModels.reply.exchangeId;
    if (changed === 'malformed turn') initial.localModels.reply.exchangeTurn = 2;
    const r = await fixture({ initial }); await r.listen(); await flush();
    assert.equal(r.audioFetches.length, 0); assert.deepEqual(r.actions, []); assert.equal(r.audios.length, 0);
  });
}

test('ended before the play promise succeeds cannot advance an exchange', async () => {
  const r = await fixture(), playing = deferred(); r.playWith(() => playing.promise);
  const job = await r.begin(); r.setServer(state({ playing: true }));
  job.request.resolve(r.audioResponse()); await flush();
  assert.equal(r.audios.length, 1); r.audios[0].onended(); await flush(); assertNoAdvance(r);
  playing.resolve(); await job.pending; await flush();
  assertNoAdvance(r);
});

for (const action of [{ type: 'interrupt' }, { type: 'demo' }, { type: 'models_stop' },
  { type: 'step', actorId: 'alpha', event: 'pause' },
  { type: 'step', actorId: 'alpha', event: 'hold' },
  { type: 'step', actorId: 'bravo', event: 'release' }]) {
  test(`${action.type}${action.event ? ` ${action.event}` : ''} cancels a delayed exchange blob without late acknowledgements`, async () => {
    const r = await fixture(), blob = deferred(), job = await r.begin();
    job.request.resolve(r.audioResponse({ blob: () => blob.promise })); await flush();
    await r.api(action); blob.resolve({ synthetic: true }); await job.pending; await flush();
    assert.deepEqual(r.actions, [action]); assertNoAdvance(r);
    assert.equal(r.audios.length, 0); assert.equal(r.urls.length, 0);
  });
}

test('cancelled old audio callbacks cannot acknowledge a newer exchange turn', async () => {
  const r = await fixture(), first = await r.begin(); await r.deliver(first);
  const stale = r.audios[0]; await r.api({ type: 'interrupt' });
  const next = state({ audioId: 'audio2', replyId: 'reply2', exchangeId: 'exchange2' });
  r.setServer(next); r.render(next); const second = await r.begin();
  await r.deliver(second, state({ audioId: 'audio2', replyId: 'reply2', exchangeId: 'exchange2', playing: true }));
  const before = r.actions.length; stale.onended(); stale.onerror(); await flush();
  assert.equal(r.actions.length, before); assert.equal(r.audios[1].pauses, 0); assertNoAdvance(r);
});

test('rendered exchange cancellation revokes active audio and stale ended cannot advance', async () => {
  const r = await fixture(), job = await r.begin(); await r.deliver(job);
  const audio = r.audios[0], next = state({ playing: true, status: 'CANCELLED' });
  r.render(next); audio.onended(); await flush();
  assert.ok(audio.pauses >= 1); assertNoAdvance(r);
});

test('the scheduled exchange poll observes host expiry and revokes playback without late acknowledgements', async () => {
  const r = await fixture(), job = await r.begin(); await r.deliver(job);
  const audio = r.audios[0], stateReads = r.calls.filter(call => call.url === '/api/state').length;
  assert.ok([...r.timers.values()].some(timer => timer.ms === 750),
    'An active GENERATED exchange must keep a real client poll scheduled while its audio plays.');
  const expired = state({ status: 'CANCELLED' });
  expired.localModels.audio.status = 'EXPIRED';
  r.at(expired.localModels.reply.expiresAtMs + 1);
  r.setServer(expired); await r.tickTimers();
  assert.equal(r.calls.filter(call => call.url === '/api/state').length, stateReads + 1);
  assert.equal(r.calls.at(-1).url, '/api/state'); assert.equal(r.calls.at(-1).options.method, 'GET');
  assert.ok(audio.pauses >= 1); assert.deepEqual(r.revoked, [r.urls[0].url]);
  assert.equal(r.audios.length, 1); assert.deepEqual(r.actions, []); assert.equal(r.timers.size, 0);
  audio.onended(); audio.onerror(); await flush();
  assert.deepEqual(r.actions, [], 'Expired host state must make both old callbacks inert, including failure acknowledgements.');
});
