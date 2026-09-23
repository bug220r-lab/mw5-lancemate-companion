// Independent MOCK_ONLY review: actual workbench and client, inert engines/DOM/fetch.
// No native process, microphone, playback, HTTP listener, editor or game is constructed.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { setImmediate as flush } from 'node:timers/promises';
import { createWorkbench } from '../server.mjs';

const deferred = () => { let resolve; const promise = new Promise(yes => { resolve = yes; }); return { promise, resolve }; };
const settings = () => ({ version: 1, micMuted: false, speechMuted: false, quiet: false,
  pilots: ['alpha', 'bravo', 'charlie'].map((id, i) => ({ id, profile: ['edge', 'tactician', 'scout'][i],
    callsign: ['Rook', 'Shade', null][i], voice: null, mode: 'ADVISORY' })) });
function wave() {
  const b = Buffer.alloc(6444); b.write('RIFF'); b.writeUInt32LE(6436, 4); b.write('WAVEfmt ', 8);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(16000, 24);
  b.writeUInt32LE(32000, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(6400, 40); return b;
}
async function fixture(t, { heldStart = false, heldTranscript = false } = {}) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'mw5-preview-review-')), settingsPath = path.join(dir, 'settings.json');
  await writeFile(settingsPath, JSON.stringify(settings()));
  const start = deferred(), transcript = deferred(); let state = 'STOPPED', busy = false, signal = null, starts = 0, calls = 0;
  const engine = {
    status: () => ({ state, busy, ownsProcess: false, processStopConfirmed: true, classification: 'MOCK_ONLY' }),
    async start() { starts++; if (heldStart) await start.promise; state = 'READY'; return this.status(); },
    async transcribe(_bytes, options) { calls++; signal = options.signal; busy = true;
      try { return { text: heldTranscript ? await transcript.promise : 'regroup Rook', classification: 'MOCK_ONLY' }; }
      finally { busy = false; } },
    async stop() { state = 'STOPPED'; return this.status(); }, async dispose() { state = 'DISPOSED'; return this.status(); }
  };
  const forbidden = () => { throw new Error('UNEXPECTED_GENERATION_OR_PLAYBACK'); };
  const w = await createWorkbench({ settingsPath, recognitionEngine: engine,
    languageModel: { status: () => ({ state: 'STOPPED' }), stop: async () => {}, generate: forbidden },
    speechEngine: { getState: () => ({ state: 'STOPPED' }), stop: async () => {}, synthesize: forbidden },
    realNow: () => 1000, readAudioFile: forbidden,
    resourcePolicy: { admit: forbidden, startWatch: forbidden, stopWatch() {}, status: () => ({}) } });
  t.after(async () => {
    start.resolve(); transcript.resolve('Discarded late result.'); await flush(); await flush(); await w.dispose();
    const resolved = path.resolve(dir); assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith('mw5-preview-review-')); await rm(resolved, { recursive: true, force: true });
  });
  await w.act({ type: 'demo' }); await flush();
  const rename = (actorId, callsign) => { const next = w.state().settings; next.pilots.find(p => p.id === actorId).callsign = callsign;
    return w.act({ type: 'settings', settings: next }); };
  const prepare = async () => { await w.act({ type: 'recognition_prepare' }); await flush(); await flush(); };
  const begin = async () => { await prepare(); return (await w.act({ type: 'ptt_begin' })).speechInput.current.id; };
  return { w, settingsPath, rename, begin, prepare, start, transcript,
    get signal() { return signal; }, get starts() { return starts; }, get calls() { return calls; } };
}
const parse = (w, text, extra = {}) => w.act({ type: 'command', text, ...extra });

test('saved callsigns route only a labeled typed preview; supplied alternate maps cannot change recipients', async t => {
  const r = await fixture(t), before = r.w.state().control;
  const s = await parse(r.w, 'regroup Rook', { callsigns: [{ actorId: 'bravo', callsign: 'Rook' }],
    bindings: [{ id: 'bravo', slot: 1 }], origin: 'native', dispatchable: true });
  assert.equal(s.last.status, 'INTENT'); assert.deepEqual(s.last.recipientIds, ['alpha']);
  assert.equal(s.last.previewContext, s.commandPreviewContext); assert.ok(s.commandPreviewContext.length > 0);
  assert.equal(s.last.inputSource, 'TYPED_TRANSCRIPT_FIXTURE'); assert.equal(s.last.classification, 'MOCK_ONLY');
  assert.equal(s.last.dispatchable, false); assert.deepEqual(s.control, before); assert.equal(r.calls, 0); assert.equal(r.starts, 0);
});

test('rename revokes an active capture synchronously and blocks all three admissions until save settles', async t => {
  const r = await fixture(t), id = await r.begin(), prior = r.w.state().commandPreviewContext;
  const saved = r.rename('bravo', 'Echo');
  assert.equal(r.w.state().speechInput.current.status, 'CANCELLED'); assert.equal(r.w.state().radio.gates.ptt, false);
  assert.notEqual(r.w.state().commandPreviewContext, prior);
  const checks = ['command', 'recognition_prepare', 'ptt_begin'].map(type => assert.rejects(r.w.act({ type, text: 'regroup Rook' }), /CALLSIGN_UPDATE_PENDING/));
  await Promise.all(checks); await saved;
  await assert.rejects(r.w.submitRecognition(id, wave()), /SPEECH_INPUT_CAPTURE_MISMATCH/);
  assert.equal(r.calls, 0); assert.equal(r.starts, 1); assert.equal(r.w.state().control.nativeCalls, 0);
});

test('rename during recognizer preparation cannot turn a late start into a usable capture', async t => {
  const r = await fixture(t, { heldStart: true }); await r.prepare();
  assert.equal(r.w.state().speechInput.preparing, true); await r.rename('alpha', 'Echo');
  r.start.resolve(); await flush(); await flush();
  await assert.rejects(r.w.act({ type: 'ptt_begin' })); assert.equal(r.w.state().speechInput.current, null); assert.equal(r.calls, 0);
});

test('rename cancels transcription publicly while retaining ignored-abort ownership until settlement', async t => {
  const r = await fixture(t, { heldTranscript: true }), id = await r.begin();
  const upload = r.w.submitRecognition(id, wave()); await flush(); assert.equal(r.calls, 1);
  const saved = r.rename('alpha', 'Echo'); assert.equal(r.signal.aborted, true);
  assert.equal((await upload).speechInput.current.status, 'CANCELLED'); await saved;
  assert.equal(r.w.state().speechInput.pendingRecognition, true);
  r.transcript.resolve('regroup Rook'); await flush(); await flush();
  assert.equal(r.w.state().speechInput.current.text, undefined); assert.equal(r.w.state().speechInput.pendingRecognition, false);
  assert.equal(r.w.state().control.ledger.length, 0);
});

test('completed recognition requires manual typed parse and rename permanently removes its old text', async t => {
  const r = await fixture(t), id = await r.begin(), before = r.w.state().control;
  const transcribed = await r.w.submitRecognition(id, wave());
  assert.equal(transcribed.speechInput.current.text, 'regroup Rook'); assert.equal(transcribed.speechInput.dispatchable, false);
  assert.notEqual(transcribed.last.inputSource, 'TYPED_TRANSCRIPT_FIXTURE'); assert.deepEqual(transcribed.control, before);
  const old = (await parse(r.w, 'regroup Rook')).last, saved = r.rename('bravo', 'Echo');
  assert.equal(r.w.state().speechInput.current.text, undefined); await saved;
  assert.notEqual(r.w.state().commandPreviewContext, old.previewContext);
  assert.equal(r.w.state().speechInput.current.status, 'CANCELLED'); assert.equal(r.w.state().control.nativeCalls, 0);
});

test('failed name persistence keeps the old alias but cannot resurrect its cancelled transcript', async t => {
  const r = await fixture(t), id = await r.begin(); await r.w.submitRecognition(id, wave());
  const before = await readFile(r.settingsPath, 'utf8'); await mkdir(`${r.settingsPath}.tmp`);
  const saving = r.rename('alpha', 'Echo'); assert.equal(r.w.state().speechInput.current.text, undefined);
  await assert.rejects(saving); assert.equal(r.w.state().settings.pilots[0].callsign, 'Rook');
  assert.equal(await readFile(r.settingsPath, 'utf8'), before); assert.equal(r.w.state().speechInput.current.status, 'CANCELLED');
  assert.deepEqual((await parse(r.w, 'regroup Rook')).last.recipientIds, ['alpha']);
  assert.notEqual((await parse(r.w, 'regroup Echo')).last.status, 'INTENT'); assert.equal(r.w.state().control.nativeCalls, 0);
});

test('same trimmed saved name preserves both an active capture and a pending transcription', async t => {
  const r = await fixture(t, { heldTranscript: true }), id = await r.begin(), before = r.w.state().commandPreviewContext;
  await r.rename('alpha', '  Rook  '); assert.equal(r.w.state().speechInput.current.status, 'CAPTURING');
  assert.equal(r.w.state().radio.gates.ptt, true); assert.equal(r.w.state().commandPreviewContext, before);
  const upload = r.w.submitRecognition(id, wave()); await flush(); await r.rename('alpha', 'Rook ');
  assert.equal(r.signal.aborted, false); r.transcript.resolve('regroup Rook');
  assert.equal((await upload).speechInput.current.text, 'regroup Rook'); assert.equal(r.calls, 1);
});

for (const [oldName, nextName] of [['Rook', 'rook'], ['Red Fox', 'Red  Fox']]) {
  test(`saved name change ${JSON.stringify(oldName)} to ${JSON.stringify(nextName)} invalidates despite equivalent parser normalization`, async t => {
    const r = await fixture(t); await r.rename('alpha', oldName); const id = await r.begin();
    await r.rename('alpha', nextName); assert.equal(r.w.state().speechInput.current.status, 'CANCELLED');
    await assert.rejects(r.w.submitRecognition(id, wave())); assert.equal(r.calls, 0);
  });
}

test('reassigning a name changes only a fresh preview and context tracks pause, possession and mission reset', async t => {
  const r = await fixture(t), old = await parse(r.w, 'regroup Rook');
  const next = r.w.state().settings; next.pilots[0].callsign = 'Shade'; next.pilots[1].callsign = 'Rook';
  await r.w.act({ type: 'settings', settings: next }); const fresh = await parse(r.w, 'regroup Rook');
  assert.deepEqual(old.last.recipientIds, ['alpha']); assert.deepEqual(fresh.last.recipientIds, ['bravo']);
  assert.notEqual(old.last.previewContext, fresh.last.previewContext);
  let context = fresh.commandPreviewContext;
  for (const action of [{ type: 'step', event: 'pause', actorId: 'alpha' }, { type: 'step', event: 'resume', actorId: 'alpha' },
    { type: 'step', event: 'possession', actorId: 'bravo' }, { type: 'demo' }]) {
    const result = await r.w.act(action); assert.notEqual(result.commandPreviewContext, context); context = result.commandPreviewContext;
  }
  assert.equal(r.w.state().control.nativeCalls, 0);
});

const appSource = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
function browserState(context = 'saved-context') {
  return { classification: 'MOCK_ONLY', clockMs: 1000, commandPreviewContext: context, settings: settings(),
    control: { recommendations: [], armed: false, capabilities: [], pending: [], ledger: [], nativeCalls: 0 },
    radio: { playing: null }, localModels: { language: { state: 'STOPPED' }, speech: { state: 'STOPPED' }, reply: null, audio: null },
    speechInput: { mode: 'OFFLINE_PTT_PREVIEW', dispatchable: false, engine: { state: 'READY' },
      current: { id: 'capture-old', session: 'mission', status: 'TRANSCRIBED', expiresAtMs: 30000, text: 'regroup Rook' } },
    last: null, integration: {} };
}
async function browserFixture() {
  const elements = new Map(), actions = [], requests = [], listeners = {}, timers = new Map(); let timer = 0, server = browserState();
  class Element {
    constructor() { this.children = []; this.listeners = {}; this.value = ''; this.textContent = ''; this.checked = false; this.disabled = false; }
    set id(value) { this._id = value; elements.set(value, this); } get id() { return this._id; }
    append(...items) { this.children.push(...items); } replaceChildren(...items) { this.children = items; }
    addEventListener(name, fn) { this.listeners[name] = fn; } focus() {}
  }
  const get = id => { if (!elements.has(id)) { const el = new Element(); el.id = id; } return elements.get(id); };
  const response = (data, ok = true) => ({ ok, json: async () => structuredClone(data) });
  const recorder = { active: false, blocked: false, cleanupPending: false, cancels: 0,
    cancel() { this.cancels++; this.active = false; }, start() { throw new Error('NO_DEVICE_ALLOWED'); } };
  class Clock extends Date { static now() { return 10000; } }
  const sandbox = vm.createContext({ document: { getElementById: get, createElement: () => new Element() },
    window: { addEventListener: (name, fn) => { listeners[name] = fn; } }, location: { hash: '#mock' },
    MW5Microphone: { createRecorder: () => recorder, supported: () => true }, Date: Clock, structuredClone, AbortController,
    Audio: class { constructor() { throw new Error('NO_PLAYBACK_ALLOWED'); } }, URL: {},
    setTimeout: (fn, ms) => { const id = ++timer; timers.set(id, { fn, ms }); return id; }, clearTimeout: id => timers.delete(id),
    fetch: (url, options = {}) => {
      if (url === '/api/state') return Promise.resolve(response(server));
      if (url !== '/api/action') throw new Error('NO_AUDIO_OR_NETWORK_ALLOWED');
      const action = JSON.parse(options.body); actions.push(action); const d = deferred(); requests.push({ action, ...d }); return d.promise;
    } });
  vm.runInContext(appSource, sandbox); await flush();
  return { get, actions, requests, recorder, response, setServer(value) { server = structuredClone(value); },
    render(value) { sandbox.testState = value; vm.runInContext('render(testState)', sandbox); },
    api(action) { sandbox.testAction = action; return vm.runInContext('api(testAction)', sandbox); } };
}

test('VM: changed saved context blocks an old command response, while its own current response remains a nondispatching preview', async () => {
  const r = await browserFixture(); r.get('transcript').value = 'regroup Rook';
  const old = r.get('command').onsubmit({ preventDefault() {} }); await flush();
  const changed = browserState('new-context'); changed.settings.pilots[0].callsign = 'Echo'; r.setServer(changed); await r.api();
  const oldResult = browserState(); oldResult.last = { status: 'INTENT', action: 'REGROUP', recipientIds: ['alpha'],
    inputSource: 'TYPED_TRANSCRIPT_FIXTURE', previewContext: 'saved-context' };
  r.requests[0].resolve(r.response(oldResult)); await old;
  assert.doesNotMatch(r.get('commandPreview').textContent, /for alpha/);
  r.get('transcript').value = 'regroup slot 2'; const fresh = r.get('command').onsubmit({ preventDefault() {} }); await flush();
  changed.last = { status: 'INTENT', action: 'REGROUP', recipientIds: ['bravo'],
    inputSource: 'TYPED_TRANSCRIPT_FIXTURE', previewContext: 'new-context' };
  r.requests[1].resolve(r.response(changed)); await fresh;
  assert.match(r.get('commandPreview').textContent, /Preview only: regroup for bravo.*Nothing was sent/);
  assert.deepEqual(r.actions.map(a => a.type), ['command', 'command']);
});

test('VM: rename immediately suppresses ready transcript through an older poll and failed save; a genuinely new capture may be copied', async () => {
  const r = await browserFixture(); assert.equal(r.get('copyTranscript').disabled, false);
  const next = settings(); next.pilots[0].callsign = 'Echo';
  const saved = r.api({ type: 'settings', settings: next });
  assert.equal(r.get('copyTranscript').disabled, true); assert.equal(r.recorder.cancels, 1);
  await r.api(); r.get('copyTranscript').onclick(); assert.equal(r.get('transcript').value, '');
  assert.equal(r.get('copyTranscript').disabled, true);
  r.requests[0].resolve(r.response({ error: 'MOCK_SAVE_FAILED' }, false)); await saved; await r.api();
  assert.equal(r.get('copyTranscript').disabled, true); assert.equal(r.get('recognizedText').textContent, 'No current transcript.');
  const fresh = browserState(); fresh.speechInput.current.id = 'capture-new'; fresh.speechInput.current.text = 'regroup slot 2'; r.render(fresh);
  assert.equal(r.get('copyTranscript').disabled, false); r.get('copyTranscript').onclick();
  assert.equal(r.get('transcript').value, 'regroup slot 2'); assert.deepEqual(r.actions.map(a => a.type), ['settings']);
});

test('VM: saving the same trimmed name preserves ready text and does not cancel the recorder', async () => {
  const r = await browserFixture(), next = settings(); next.pilots[0].callsign = ' Rook ';
  const saved = r.api({ type: 'settings', settings: next }); assert.equal(r.recorder.cancels, 0);
  assert.equal(r.get('copyTranscript').disabled, false); r.requests[0].resolve(r.response(browserState())); await saved;
  r.get('copyTranscript').onclick(); assert.equal(r.get('transcript').value, 'regroup Rook');
  assert.deepEqual(r.actions.map(a => a.type), ['settings']);
});
