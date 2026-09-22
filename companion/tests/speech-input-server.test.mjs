// Synthetic recognizer + real loopback HTTP. No microphone, model or game execution.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import { createWorkbench, startServer } from '../server.mjs';

const tick = () => new Promise(resolve => setImmediate(resolve));
function wave(ms = 200) {
  const data = ms * 32, b = Buffer.alloc(44 + data);
  b.write('RIFF'); b.writeUInt32LE(36 + data, 4); b.write('WAVEfmt ', 8);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(16000, 24); b.writeUInt32LE(32000, 28); b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(data, 40); return b;
}
function recognizer({ deferred = false } = {}) {
  let state = 'STOPPED', busy = false, calls = 0, settle;
  const status = () => ({ state, busy, ownsProcess: false, processStopConfirmed: true, classification: 'MOCK_ONLY' });
  return { status, get calls() { return calls; }, resolve(text = 'regroup slot 1') { settle?.(text); },
    async start() { state = 'READY'; return status(); },
    async stop() { state = 'STOPPED'; return status(); },
    async dispose() { state = 'DISPOSED'; return status(); },
    async transcribe(bytes, { signal } = {}) {
      calls++; busy = true;
      try {
        const text = deferred ? await new Promise((resolve, reject) => {
          settle = resolve;
          signal?.addEventListener('abort', () => reject(new Error('RECOGNITION_ABORTED')), { once: true });
        }) : 'regroup slot 1';
        return { schemaVersion: 1, text, transcriptTrust: 'UNTRUSTED_RECOGNITION', classification: 'MOCK_ONLY',
          mode: 'COLD_FILE_TRANSCRIPTION_ONLY', durationMs: (bytes.length - 44) / 32,
          commandExecution: false, microphoneCapture: false, speakerPlayback: false };
      } finally { busy = false; }
    } };
}
async function fixture(t, { server = false, deferred = false } = {}) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'mw5-ptt-server-'));
  const engine = recognizer({ deferred }); let clock = 1000;
  const options = { settingsPath: path.join(dir, 'settings.json'), recognitionEngine: engine, realNow: () => clock };
  const w = server ? await startServer(options) : await createWorkbench(options);
  t.after(async () => {
    if (server) { const closing = w.close(); w.server.closeAllConnections(); await closing; } else await w.dispose();
    assert.equal(path.dirname(path.resolve(dir)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(dir).startsWith('mw5-ptt-server-')); await rm(dir, { recursive: true, force: true });
  });
  return { w, engine, advance: ms => { clock += ms; } };
}
function request(w, { route = '/api/state', body, method = body === undefined ? 'GET' : 'POST',
  token = w.token, origin = w.origin, type = 'application/json', length } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(new URL(route, w.origin), { method, agent: false, headers: {
      ...(token === null ? {} : { Authorization: `Bearer ${token}` }), Origin: origin,
      ...(body === undefined ? {} : { 'Content-Type': type, 'Content-Length': length ?? Buffer.byteLength(body) }) } }, res => {
      const chunks = []; res.on('data', b => chunks.push(b)); res.on('end', () => {
        const text = Buffer.concat(chunks).toString(); resolve({ code: res.statusCode,
          headers: res.headers, data: res.headers['content-type'].startsWith('application/json') ? JSON.parse(text) : text });
      });
    }); req.on('error', reject); req.end(body);
  });
}
const action = (w, input) => request(w, { route: '/api/action', body: JSON.stringify(input) });
async function begin(w, server = false) {
  const act = server ? input => action(w, input) : input => w.act(input);
  await act({ type: 'demo' }); await tick();
  await act({ type: 'recognition_prepare' }); await tick(); await tick();
  const s = await act({ type: 'ptt_begin' }); return (server ? s.data : s).speechInput.current.id;
}

test('import and workbench launch leave recognition inert and game control disconnected', async t => {
  const { w, engine } = await fixture(t);
  assert.equal(w.state().speechInput.engine.state, 'STOPPED'); assert.equal(engine.calls, 0);
  assert.equal(w.state().classification, 'DISCONNECTED'); assert.equal(w.state().control.nativeCalls, 0);
  await assert.rejects(w.act({ type: 'ptt_begin' }));
});

test('PTT interrupts radio, blocks new playback and yields only an untrusted nondispatchable preview', async t => {
  const { w, engine } = await fixture(t); await begin(w);
  let s = w.state(); const id = s.speechInput.current.id, before = s.control;
  assert.equal(s.radio.gates.ptt, true);
  s = await w.act({ type: 'radio', actorId: 'alpha' }); assert.equal(s.last.reason, 'USER_SPEAKING');
  await assert.rejects(w.act({ type: 'converse', actorId: 'alpha', text: 'hello' }), /USER_SPEAKING/);
  s = await w.submitRecognition(id, wave());
  assert.equal(s.speechInput.current.status, 'TRANSCRIBED'); assert.equal(s.speechInput.current.text, 'regroup slot 1');
  assert.equal(s.speechInput.dispatchable, false); assert.equal(s.speechInput.current.classification, 'UNTRUSTED_RECOGNITION');
  assert.equal(s.radio.gates.ptt, false); assert.deepEqual(s.control, before); assert.equal(engine.calls, 1);
});

for (const lifecycle of ['pause', 'possession', 'demo', 'interrupt', 'mute']) {
  test(`${lifecycle} revokes a capture and prevents its bytes reaching recognition`, async t => {
    const { w, engine } = await fixture(t); const id = await begin(w);
    if (lifecycle === 'pause' || lifecycle === 'possession') await w.act({ type: 'step', actorId: 'bravo', event: lifecycle });
    else if (lifecycle === 'mute') { const settings = w.state().settings; settings.micMuted = true; await w.act({ type: 'settings', settings }); }
    else await w.act({ type: lifecycle });
    await assert.rejects(w.submitRecognition(id, wave()));
    assert.equal(w.state().radio.gates.ptt, false); assert.equal(engine.calls, 0);
    assert.equal(w.state().control.nativeCalls, 0);
  });
}

test('expired grant releases radio and rejected result never enters the command ledger', async t => {
  const { w, engine, advance } = await fixture(t); const id = await begin(w);
  advance(20000); assert.equal(w.state().radio.gates.ptt, false);
  await assert.rejects(w.submitRecognition(id, wave())); assert.equal(engine.calls, 0);
  assert.equal(w.state().control.ledger.length, 0);
});

test('recognition routes require same-origin bearer auth, current grant and exact WAV type', async t => {
  const { w, engine } = await fixture(t, { server: true }); const id = await begin(w, true);
  const route = `/api/recognition/${id}`;
  for (const [options, expected] of [[{ token: null }, 401], [{ token: 'ä'.repeat(64) }, 401],
    [{ origin: 'https://elsewhere.invalid' }, 403], [{ type: 'application/octet-stream' }, 415]]) {
    assert.equal((await request(w, { route, body: wave(), type: 'audio/wav', ...options })).code, expected);
  }
  assert.equal(engine.calls, 0);
  const good = await request(w, { route, body: wave(), type: 'audio/wav' });
  assert.equal(good.code, 200); assert.equal(good.data.speechInput.current.status, 'TRANSCRIBED');
  assert.equal(good.data.control.nativeCalls, 0);
  assert.equal((await request(w, { route, body: wave(), type: 'audio/wav' })).code, 409);
  assert.equal(engine.calls, 1);
});

test('oversized HTTP WAV revokes its grant before inference, without poisoning subsequent requests', async t => {
  const { w, engine } = await fixture(t, { server: true }); const id = await begin(w, true);
  const bad = await request(w, { route: `/api/recognition/${id}`, body: Buffer.alloc(480045), type: 'audio/wav' });
  assert.equal(bad.code, 413); assert.equal(engine.calls, 0);
  assert.equal((await request(w)).data.radio.gates.ptt, false);
  const next = await begin(w, true); assert.notEqual(next, id);
  assert.equal((await request(w, { route: `/api/recognition/${next}`, body: wave(), type: 'audio/wav' })).code, 200);
});

test('a transcription upload does not lock out stop or a mission reset', async t => {
  const { w, engine } = await fixture(t, { server: true, deferred: true }); const id = await begin(w, true);
  const pending = request(w, { route: `/api/recognition/${id}`, body: wave(), type: 'audio/wav' });
  for (let i = 0; i < 20 && !engine.calls; i++) await tick();
  assert.equal(engine.calls, 1);
  assert.equal((await action(w, { type: 'ptt_cancel', captureId: id })).code, 200);
  const outcome = await pending;
  assert.equal(outcome.code, 200); assert.equal(outcome.data.speechInput.current.status, 'CANCELLED');
  assert.equal((await action(w, { type: 'demo' })).code, 200);
  engine.resolve('must not replace cancelled result'); await tick();
  assert.notEqual((await request(w)).data.speechInput.current?.status, 'TRANSCRIBED');
});

test('client disconnect cancels its active transcription and never publishes the late text', async t => {
  const { w, engine } = await fixture(t, { server: true, deferred: true }); const id = await begin(w, true);
  const bytes = wave();
  const req = http.request(new URL(`/api/recognition/${id}`, w.origin), { method: 'POST', agent: false,
    headers: { Authorization: `Bearer ${w.token}`, Origin: w.origin, 'Content-Type': 'audio/wav', 'Content-Length': bytes.length } });
  req.on('error', () => {}); req.end(bytes);
  for (let i = 0; i < 50 && !engine.calls; i++) await tick();
  assert.equal(engine.calls, 1); req.destroy();
  let state;
  for (let i = 0; i < 20; i++) { state = (await request(w)).data; if (state.speechInput.current.status === 'CANCELLED') break; }
  assert.equal(state.speechInput.current.status, 'CANCELLED');
  engine.resolve('late focus slot 2'); await tick();
  state = (await request(w)).data;
  assert.equal(state.speechInput.current.text, undefined); assert.equal(state.control.nativeCalls, 0);
});

test('a displayed transcript expires and an old scoped cancel cannot stop a new capture', async t => {
  const { w, advance } = await fixture(t); const first = await begin(w);
  await w.submitRecognition(first, wave()); advance(5000);
  assert.equal(w.state().speechInput.current.text, undefined); await tick(); await tick();
  await w.act({ type: 'recognition_prepare' }); await tick(); await tick();
  const next = (await w.act({ type: 'ptt_begin' })).speechInput.current.id;
  const s = await w.act({ type: 'ptt_cancel', captureId: first });
  assert.equal(s.speechInput.current.id, next); assert.equal(s.speechInput.current.status, 'CAPTURING');
  assert.equal(s.radio.gates.ptt, true);
});

test('shutdown reports unresolved coordinator ownership even if the engine reports no process', async t => {
  const { w, engine } = await fixture(t); await begin(w);
  let release;
  const held = new Promise(resolve => { release = resolve; });
  engine.stop = () => held;
  try {
    const closed = await w.dispose();
    assert.equal(closed.status, 'LOCAL_MODEL_STOP_UNCONFIRMED');
    assert.equal(w.state().speechInput.shutdownComplete, false);
  } finally { release(); await tick(); await tick(); }
});

test('served recorder/worklet are local and microphone policy excludes unrelated frames', async t => {
  const { w } = await fixture(t, { server: true });
  for (const route of ['/microphone.js', '/microphone-worklet.js']) {
    const r = await request(w, { route, token: null }); assert.equal(r.code, 200);
    assert.equal(r.headers['permissions-policy'], 'camera=(), microphone=(self)');
    assert.equal(r.data.includes(w.token), false);
  }
});
