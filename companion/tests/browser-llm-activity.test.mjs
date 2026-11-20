// MOCK_ONLY. Exercise the actual client with fake DOM, fetch and devices.
// No browser, network, model, microphone, audio output or native calls run.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { setImmediate as flush } from 'node:timers/promises';

const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const panelIds = ['modelActivityStatus', 'modelActivityIdentity', 'modelActivityMetrics',
  'modelActivityError', 'modelActivityLog', 'modelActivityUpdated', 'modelActivityConnection'];

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function state(language = {}, models = {}) {
  return { classification: 'MOCK_ONLY', clockMs: 1000, commandPreviewContext: 'fixture-context',
    settings: { version: 1, micMuted: false, speechMuted: false, quiet: false,
      pilots: ['alpha', 'bravo', 'charlie'].map(id => ({ id, mode: 'ADVISORY', callsign: null, voice: null })) },
    control: { recommendations: [], armed: false, capabilities: [], pending: [], ledger: [], nativeCalls: 0 },
    radio: { playing: null }, last: null, integration: { game: 'NOT_BUILT' },
    localModels: { language: { state: 'STOPPED', modelId: 'fixture-model', threads: 4,
      verification: 'NOT_PERFORMED', ownedPid: null, ownedProcessStopped: true,
      activeGeneration: false, lastError: null, log: '', lastGenerationTimings: null,
      lastGenerationFinishReason: null, ...language },
    speech: { state: 'STOPPED' }, starting: false, stopping: false, cleanupPending: false,
    error: null, previewDeadlineMs: 4000, ...models } };
}

async function fixture(initial = state()) {
  const elements = new Map(), calls = [], timers = new Map(), queue = [];
  const deviceCalls = []; let server = initial, nextTimer = 0, clock = 10000;
  class Element {
    constructor(tag = 'div') {
      this.tagName = tag; this.children = []; this.value = ''; this.textContent = '';
      this.checked = false; this.disabled = false; this.listeners = {}; this.dataset = {};
    }
    set id(value) { this._id = value; elements.set(value, this); }
    get id() { return this._id; }
    set innerHTML(_) { throw new Error('Untrusted status must never be parsed as HTML.'); }
    append(...nodes) { this.children.push(...nodes); }
    replaceChildren(...nodes) { this.children = nodes; }
    addEventListener(name, handler) { this.listeners[name] = handler; }
    setAttribute(name, value) { this[name] = value; }
  }
  const get = id => {
    if (!elements.has(id)) { const element = new Element(); element.id = id; }
    return elements.get(id);
  };
  const response = (data, ok = true) => ({ ok, json: async () => structuredClone(data) });
  const fetch = async (url, options = {}) => {
    calls.push({ url, options });
    if (url !== '/api/state' || options.method !== 'GET')
      throw new Error(`Unexpected request from read-only activity view: ${url}`);
    return queue.length ? queue.shift().promise : response(server);
  };
  class ClockDate extends Date { static now() { return clock; } }
  const recorder = { active: false, blocked: false, cleanupPending: false,
    start: () => deviceCalls.push('microphone.start'),
    release: () => deviceCalls.push('microphone.release'), cancel: () => deviceCalls.push('microphone.cancel') };
  const context = vm.createContext({
    document: { getElementById: get, createElement: tag => new Element(tag), addEventListener() {} },
    window: { addEventListener() {} }, location: { hash: '#synthetic-process-session' },
    structuredClone, AbortController, fetch, Date: ClockDate,
    MW5Microphone: { createRecorder: () => recorder, supported: () => true },
    Audio: class { constructor() { deviceCalls.push('Audio'); } },
    URL: { createObjectURL() { deviceCalls.push('objectURL'); }, revokeObjectURL() {} },
    setTimeout(callback, ms) { const id = ++nextTimer; timers.set(id, { callback, ms }); return id; },
    clearTimeout: id => timers.delete(id),
  });
  get('speaker').value = 'alpha'; get('exchangePartner').value = 'bravo';
  vm.runInContext(source, context, { filename: 'companion/public/app.js' }); await flush();
  return { get, calls, deviceCalls, timers, response,
    text: id => get(id).textContent,
    panel: () => panelIds.map(id => get(id).textContent).join('\n'),
    render(data) { context.fixtureState = data; return vm.runInContext('render(fixtureState)', context); },
    api: () => vm.runInContext('api()', context),
    queue(pending) { queue.push(pending); },
    setServer(data) { server = data; },
    at(value) { clock = value; },
    async tick() {
      for (const [id, timer] of [...timers]) { timers.delete(id); timer.callback(); }
      await flush();
    },
  };
}

test('activity panel is part of the existing Voice Lab with unique accessible static nodes', () => {
  for (const id of panelIds) assert.equal((html.match(new RegExp(`id="${id}"`, 'g')) || []).length, 1, id);
  assert.match(html, /Last reported model activity/i);
  assert.match(html, /aria-(?:labelledby|live)/);
});

test('opening the panel shows stopped state and does not start any work', async () => {
  const r = await fixture();
  assert.match(r.text('modelActivityStatus'), /stopped/i);
  assert.match(r.text('modelActivityIdentity'), /fixture-model/);
  assert.match(r.text('modelActivityIdentity'), /4/);
  assert.match(r.text('modelActivityIdentity'), /NOT_PERFORMED/);
  assert.match(r.text('modelActivityConnection'), /fresh|updated|connected|current/i);
  assert.ok(r.text('modelActivityUpdated').length > 0);
  assert.equal(r.calls.length, 1); assert.equal(r.calls[0].url, '/api/state');
  assert.deepEqual(r.deviceCalls, []);
});

test('startup, readiness, generation, shutdown and cleanup remain distinct reported states', async () => {
  const r = await fixture();
  for (const [data, expected] of [
    [state({ state: 'VERIFYING' }, { starting: true }), /start|verif/i],
    [state({ state: 'READY', ownedPid: 9876, ownedProcessStopped: false }), /ready/i],
    [state({ state: 'READY', activeGeneration: true }), /generat/i],
    [state({ state: 'STOPPING' }, { stopping: true }), /stop/i],
    [state({ state: 'FAILED' }, { cleanupPending: true }), /cleanup/i],
  ]) {
    r.render(data); assert.match(r.text('modelActivityStatus'), expected);
  }
  r.render(state({ state: 'READY', ownedPid: 9876, ownedProcessStopped: false }));
  assert.match(r.text('modelActivityIdentity'), /9876/);
  assert.match(r.text('modelActivityIdentity'), /pid|process/i);
  assert.deepEqual(r.deviceCalls, []);
  assert.equal(r.calls.length, 1);
});

test('failure and unconfirmed cleanup expose both lifecycle and error without implying replacement', async () => {
  const r = await fixture(state({ state: 'FAILED', lastError: 'PROCESS_STOP_UNCONFIRMED',
    ownedPid: 9876, ownedProcessStopped: false }, { cleanupPending: true, error: 'LOCAL_MODEL_STOP_UNCONFIRMED' }));
  assert.match(r.text('modelActivityStatus'), /cleanup|fail|unconfirmed/i);
  assert.match(r.text('modelActivityError'), /PROCESS_STOP_UNCONFIRMED|shutdown|unconfirmed/i);
  assert.match(r.text('modelActivityIdentity'), /9876/);
  assert.equal(r.get('modelsStart').disabled, true);
  assert.deepEqual(r.deviceCalls, []);
});

test('terminal timing numbers are labeled as last reported generation rather than live progress', async () => {
  const r = await fixture(state({ state: 'READY', lastGenerationFinishReason: 'stop',
    lastGenerationTimings: { cache_n: 123, prompt_n: 27, prompt_ms: 51.5, predicted_n: 19, predicted_ms: 219.5 } }));
  const metrics = r.text('modelActivityMetrics');
  assert.match(metrics, /last|previous|reported/i);
  for (const value of ['123', '27', '51.5', '19', '219.5']) assert.ok(metrics.includes(value), value);
  assert.match(metrics, /cache/i); assert.match(metrics, /prompt/i); assert.match(metrics, /output|predict/i);
  assert.match(metrics, /ms/); assert.match(metrics, /stop|complete/i);
  assert.doesNotMatch(metrics, /\d\s*%|time remaining|eta\b/i);
});

test('length completion is identified as truncated and cannot look like a complete reply', async () => {
  const r = await fixture(state({ state: 'READY', lastGenerationFinishReason: 'length',
    lastGenerationTimings: { cache_n: 0, prompt_n: 3, prompt_ms: 0, predicted_n: 64, predicted_ms: 60000 } }));
  assert.match(r.text('modelActivityMetrics'), /length|truncat|limit/i);
  assert.doesNotMatch(r.text('modelActivityMetrics'), /successful|fully complete/i);
});

test('generation without terminal timing data does not fabricate counters or progress', async () => {
  const r = await fixture(state({ state: 'READY', activeGeneration: true }));
  assert.match(r.text('modelActivityStatus'), /generat/i);
  assert.match(r.text('modelActivityMetrics'), /unavailable|not reported|no .*timing|no .*generation/i);
  assert.doesNotMatch(r.text('modelActivityMetrics'), /\d\s*%|NaN|Infinity|0\s*(?:tokens|ms)/i);
});

test('malformed timing objects never display impossible numeric metrics', async () => {
  const r = await fixture();
  for (const timings of [null, [], { cache_n: -1, prompt_n: 2, prompt_ms: 3, predicted_n: 4, predicted_ms: 5 },
    { cache_n: 2048, prompt_n: 1, prompt_ms: 3, predicted_n: 4, predicted_ms: 5 },
    { cache_n: 1, prompt_n: 2, prompt_ms: NaN, predicted_n: 4, predicted_ms: 5 },
    { cache_n: 1, prompt_n: 2, prompt_ms: 3, predicted_n: 65, predicted_ms: Infinity },
    { cache_n: 1, prompt_n: 2, prompt_ms: 3, predicted_n: '4', predicted_ms: 5 }]) {
    r.render(state({ lastGenerationTimings: timings, lastGenerationFinishReason: 'stop' }));
    assert.match(r.text('modelActivityMetrics'), /unavailable|not reported|no .*timing|no .*generation/i);
    assert.doesNotMatch(r.text('modelActivityMetrics'), /NaN|Infinity|-1|2048|65/);
  }
});

test('log and error content remain literal text and terminal controls cannot spoof the display', async () => {
  const hostile = '<img src=x onerror="startModel()">\u001b[31mFAILED\u001b[0m\u0000\rprogress';
  const r = await fixture(state({ log: hostile, lastError: '<script>run()</script>' }));
  assert.match(r.text('modelActivityLog'), /<img src=x/);
  assert.match(r.text('modelActivityLog'), /FAILED/);
  assert.doesNotMatch(r.text('modelActivityLog'), /[\u0000-\u0008\u000b-\u001f\u007f]/);
  assert.match(r.text('modelActivityError'), /<script>run\(\)<\/script>/);
  assert.deepEqual(r.deviceCalls, []);
});

test('oversized logs are bounded and leave the newest diagnostic tail visible', async () => {
  const r = await fixture(state({ log: `${'old-entry\n'.repeat(2500)}NEWEST-TAIL` }));
  assert.ok(r.text('modelActivityLog').length <= 8400);
  assert.match(r.text('modelActivityLog'), /NEWEST-TAIL/);
  r.render(state({ log: '' }));
  assert.doesNotMatch(r.text('modelActivityLog'), /NEWEST-TAIL/);
});

test('failed polling preserves last reported data and marks it stale until a fresh result arrives', async () => {
  const r = await fixture(state({ state: 'READY', ownedPid: 9876, log: 'prior observation' }));
  const failed = deferred(); r.queue(failed);
  const pending = r.api(); failed.reject(new Error('Synthetic disconnected state')); await pending;
  assert.match(r.text('modelActivityConnection'), /stale|unavailable|failed/i);
  assert.match(r.text('modelActivityLog'), /prior observation/);
  r.at(20000); r.setServer(state({ state: 'STOPPED', log: 'fresh observation' }));
  await r.api();
  assert.match(r.text('modelActivityConnection'), /fresh|updated|connected|current/i);
  assert.match(r.text('modelActivityStatus'), /stopped/i);
  assert.equal(r.text('modelActivityLog'), 'fresh observation');
});

test('a late stale success cannot replace a newer model observation', async () => {
  const r = await fixture();
  const old = deferred(), fresh = deferred(); r.queue(old); r.queue(fresh);
  const oldRequest = r.api(), newRequest = r.api();
  fresh.resolve(r.response(state({ state: 'READY', ownedPid: 7654, log: 'new observation' })));
  await newRequest;
  old.resolve(r.response(state({ state: 'FAILED', ownedPid: 1234, log: 'obsolete observation' })));
  await oldRequest;
  assert.match(r.text('modelActivityLog'), /new observation/);
  assert.doesNotMatch(r.panel(), /obsolete observation|1234/);
});

test('a late failed request cannot mark a newer successful observation stale', async () => {
  const r = await fixture();
  const old = deferred(), fresh = deferred(); r.queue(old); r.queue(fresh);
  const oldRequest = r.api(), newRequest = r.api();
  fresh.resolve(r.response(state({ state: 'READY', log: 'current observation' })));
  await newRequest; old.reject(new Error('obsolete failure')); await oldRequest;
  assert.match(r.text('modelActivityConnection'), /fresh|updated|connected|current/i);
  assert.doesNotMatch(r.text('modelActivityConnection'), /stale|unavailable|failed/i);
});

test('automatic observation refresh remains GET-only and never triggers model or device actions', async () => {
  const r = await fixture(state({ state: 'READY', activeGeneration: true }, { resources: { monitoring: true } }));
  assert.ok(r.timers.size > 0);
  await r.tick(); await r.tick();
  assert.ok(r.calls.length >= 3);
  assert.ok(r.calls.every(call => call.url === '/api/state' && call.options.method === 'GET' && call.options.body === undefined));
  assert.deepEqual(r.deviceCalls, []);
});

test('the actual refresh button requests only fresh state without starting models or devices', async () => {
  const r = await fixture(state({ log: 'before refresh' }));
  assert.equal(typeof r.get('modelActivityRefresh').onclick, 'function');
  r.setServer(state({ state: 'READY', log: 'after explicit refresh' }));
  await r.get('modelActivityRefresh').onclick(); await flush();
  assert.equal(r.text('modelActivityLog'), 'after explicit refresh');
  assert.equal(r.calls.length, 2);
  assert.ok(r.calls.every(call => call.url === '/api/state' && call.options.method === 'GET' && call.options.body === undefined));
  assert.deepEqual(r.deviceCalls, []);
});

test('a failed active-state poll schedules read-only recovery without another user action', async () => {
  const r = await fixture(state({ state: 'READY', activeGeneration: true, log: 'prior active report' }));
  const failed = deferred(); r.queue(failed);
  const oldTimestamp = r.text('modelActivityUpdated');
  r.at(20000); failed.reject(new Error('Synthetic temporary state failure'));
  await r.tick();
  assert.match(r.text('modelActivityConnection'), /stale|unavailable|failed/i);
  assert.equal(r.text('modelActivityLog'), 'prior active report');
  assert.equal(r.text('modelActivityUpdated'), oldTimestamp);
  assert.equal(r.timers.size, 1, 'A failed observation must keep one recovery timer.');
  r.setServer(state({ state: 'READY', activeGeneration: true, log: 'recovered automatically' }));
  await r.tick();
  assert.match(r.text('modelActivityConnection'), /fresh|updated|connected|current/i);
  assert.equal(r.text('modelActivityLog'), 'recovered automatically');
  assert.notEqual(r.text('modelActivityUpdated'), oldTimestamp);
  assert.equal(r.calls.length, 3);
  assert.ok(r.calls.every(call => call.url === '/api/state' && call.options.method === 'GET' && call.options.body === undefined));
  assert.deepEqual(r.deviceCalls, []);
});

test('reported active generation refreshes even when resource monitoring is absent', async () => {
  const r = await fixture(state({ state: 'READY', activeGeneration: true }));
  assert.equal(r.timers.size, 1);
  await r.tick();
  assert.equal(r.calls.length, 2);
  assert.equal(r.timers.size, 1);
  assert.deepEqual(r.deviceCalls, []);
});
