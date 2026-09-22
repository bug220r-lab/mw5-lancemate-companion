// MOCK_ONLY PTT lifecycle tests. No recording, recognition binary or game runs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate as flush } from 'node:timers/promises';
import { createSpeechInput } from '../speech-input.mjs';

const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
function wav(ms = 200) {
  const b = Buffer.alloc(44 + ms * 32); b.write('RIFF', 0); b.writeUInt32LE(b.length - 8, 4); b.write('WAVEfmt ', 8);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(16000, 24);
  b.writeUInt32LE(32000, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(b.length - 44, 40); return b;
}
function rig(t, configure = () => {}) {
  const calls = { starts: 0, stops: 0, disposes: 0, transcribes: [], ptt: [], interrupts: [] };
  let clock = 1000, state = 'STOPPED', busy = false;
  const api = {
    context: { session: 'demo1', phase: 'active', micMuted: false, bindings: ['alpha','bravo','charlie'].map((id,index) =>
      ({ id, pawnId: `pawn${index}`, generation: 1, aiOwned: true, alive: true })) },
    calls, pending: null, honorStop: true,
    setTime: value => { clock = value; }, time: () => clock,
    setEngine: (next, pending = false) => { state = next; busy = pending; },
    complete(text = 'Attack that target.') { state = 'READY'; busy = false; api.pending.resolve({ text }); },
    fail(message = 'private path C:/secret') { state = 'STOPPED'; busy = false; api.pending.reject(new Error(message)); }
  };
  const recognizer = {
    status: () => ({ state, busy, ownsProcess: busy, processStopConfirmed: !busy, classification: 'MOCK_ONLY' }),
    start: async () => { calls.starts++; state = 'READY'; return recognizer.status(); },
    transcribe: (buffer, options) => { calls.transcribes.push({ buffer, options }); state = 'BUSY'; busy = true;
      api.pending = deferred(); return api.pending.promise; },
    stop: async () => { calls.stops++; if (api.honorStop) { state = 'STOPPED'; busy = false;
      api.pending?.reject(new Error('mock stop')); } return recognizer.status(); },
    dispose: async () => { calls.disposes++; state = 'DISPOSED'; return recognizer.status(); }
  };
  const options = { recognizer, getContext: () => api.context, now: () => clock,
    onInterrupt: reason => calls.interrupts.push(reason), onPttChange: value => calls.ptt.push(value) };
  configure(options, api, recognizer);
  const coordinator = createSpeechInput(options);
  t.after(async () => { api.honorStop = true; api.pending?.reject(new Error('test cleanup')); await coordinator.dispose(); });
  return { coordinator, recognizer, api, calls };
}
async function drain() { await flush(); await flush(); }

test('construction does not call hooks or recognition and explicit prepare is required', async t => {
  const r = rig(t); assert.deepEqual(r.calls, { starts:0, stops:0, disposes:0, transcribes:[], ptt:[], interrupts:[] });
  assert.throws(() => r.coordinator.begin(), /SPEECH_INPUT_NOT_PREPARED/);
  const state = await r.coordinator.prepare(); assert.equal(state.engine.state, 'READY'); assert.equal(r.calls.starts, 1);
  assert.equal(state.dispatchable, false); assert.equal(state.mode, 'OFFLINE_PTT_PREVIEW'); assert.equal(state.current, null);
});

test('prepare is shared while pending, and begin reserves one UUID capture plus radio interrupt', async t => {
  const gate = deferred(); const r = rig(t, (_o, a, engine) => { engine.start = async () => { a.calls.starts++; await gate.promise; a.setEngine('READY'); }; });
  const first = r.coordinator.prepare(), second = r.coordinator.prepare(); assert.equal(first, second);
  assert.throws(() => r.coordinator.begin(), /SPEECH_INPUT_BUSY/); gate.resolve(); await first;
  const state = r.coordinator.begin(); assert.match(state.current.id, /^[a-f0-9-]{36}$/);
  assert.equal(state.current.expiresAtMs, 21000); assert.equal(state.current.status, 'CAPTURING');
  assert.deepEqual(r.calls.ptt, [true]); assert.deepEqual(r.calls.interrupts, ['SPEECH_INPUT_PTT']);
  assert.throws(() => r.coordinator.begin(), /SPEECH_INPUT_BUSY/);
});

test('asynchronous prepare errors stay redacted in status and successful preparation clears them', async t => {
  let fail = true;
  const r = rig(t, (_o,a,engine) => { engine.start = async () => {
    if (fail) throw new Error('private credential path'); a.setEngine('READY');
  }; });
  await assert.rejects(r.coordinator.prepare(), /SPEECH_INPUT_PREPARE_FAILED/); await drain();
  assert.equal(r.coordinator.status().lastError, 'SPEECH_INPUT_PREPARE_FAILED');
  assert.equal(JSON.stringify(r.coordinator.status()).includes('credential'), false);
  fail = false; await r.coordinator.prepare(); assert.equal(r.coordinator.status().lastError, null);
  r.coordinator.invalidate(); await drain(); r.api.context.micMuted = true;
  await assert.rejects(r.coordinator.prepare(), /SPEECH_INPUT_CONTEXT_INVALID/);
  assert.equal(r.coordinator.status().lastError, 'SPEECH_INPUT_CONTEXT_INVALID');
});

test('upload releases radio PTT, snapshots WAV, and returns untrusted text with a five-second lifetime', async t => {
  const r = rig(t); await r.coordinator.prepare(); const capture = r.coordinator.begin().current;
  const input = wav(), expected = Buffer.from(input); const pending = r.coordinator.submit(capture.id, input); input.fill(255);
  assert.deepEqual(r.calls.ptt, [true, false]); assert.equal(r.calls.transcribes.length, 1);
  assert.deepEqual(r.calls.transcribes[0].buffer, expected); assert.equal(r.coordinator.status().current.status, 'TRANSCRIBING');
  r.api.setTime(2200); r.api.complete('  Form on me.  '); const result = await pending;
  assert.equal(result.current.text, 'Form on me.'); assert.equal(result.current.classification, 'UNTRUSTED_RECOGNITION');
  assert.equal(result.current.expiresAtMs, 7200); assert.equal(result.dispatchable, false);
  result.current.text = 'changed'; assert.equal(r.coordinator.status().current.text, 'Form on me.');
});

test('duplicate submissions and another capture ID cannot consume or release the admitted request', async t => {
  const r = rig(t); await r.coordinator.prepare(); const capture = r.coordinator.begin().current;
  await assert.rejects(r.coordinator.submit('wrong-id', wav()), /SPEECH_INPUT_CAPTURE_MISMATCH/);
  assert.deepEqual(r.calls.ptt, [true]); const pending = r.coordinator.submit(capture.id, wav());
  await assert.rejects(r.coordinator.submit(capture.id, wav()), /SPEECH_INPUT_CAPTURE_MISMATCH/);
  assert.equal(r.calls.transcribes.length, 1); r.api.complete(); await pending;
});

test('invalid WAV or request options cancel only the matching capture and release PTT', async t => {
  for (const [wave, options, code] of [[Buffer.alloc(4), {}, /SPEECH_INPUT_INVALID_WAV/], [wav(), { path:'outside' }, /SPEECH_INPUT_INVALID_OPTIONS/],
    [wav(), { signal:{} }, /SPEECH_INPUT_INVALID_OPTIONS/]]) {
    const r = rig(t); await r.coordinator.prepare(); const id = r.coordinator.begin().current.id;
    await assert.rejects(r.coordinator.submit('wrong', wave, options), code.source.includes('INVALID_OPTIONS') ? code : /CAPTURE_MISMATCH/);
    assert.equal(r.coordinator.status().current.status, 'CAPTURING');
    await assert.rejects(r.coordinator.submit(id, wave, options), code);
    assert.equal(r.coordinator.status().current.status, 'FAILED'); assert.deepEqual(r.calls.ptt, [true, false]); assert.equal(r.calls.transcribes.length, 0);
  }
});

test('context requires active, unmuted and three distinct living AI bindings', async t => {
  for (const change of [a => { a.context = null; }, a => { a.context.phase = 'paused'; }, a => { a.context.micMuted = true; },
    a => { a.context.bindings.pop(); }, a => { a.context.bindings[1].id = a.context.bindings[0].id; },
    a => { a.context.bindings[2].pawnId = a.context.bindings[0].pawnId; }, a => { a.context.bindings[1].aiOwned = false; },
    a => { a.context.bindings[0].alive = false; }, a => { a.context.bindings[0].generation = NaN; }]) {
    const r = rig(t, (_o,a) => change(a)); await assert.rejects(r.coordinator.prepare(), /SPEECH_INPUT_CONTEXT_INVALID/);
    assert.equal(r.calls.starts, 0); assert.equal(r.calls.transcribes.length, 0);
  }
});

test('context changes invalidate prepared state and every current lease before late recognition can return', async t => {
  for (const change of [a => { a.context.session = 'demo2'; }, a => { a.context.bindings[1].generation++; },
    a => { a.context.bindings[0].pawnId = 'newPawn'; }, a => { a.context.bindings[2].aiOwned = false; },
    a => { a.context.micMuted = true; }, a => { a.context.phase = 'loading'; }]) {
    const r = rig(t); await r.coordinator.prepare(); const id = r.coordinator.begin().current.id;
    r.api.honorStop = false; const pending = r.coordinator.submit(id, wav()); change(r.api);
    const invalid = r.coordinator.status(); assert.equal(invalid.current.status, 'CANCELLED');
    const result = await pending; assert.equal(result.current.text, undefined); r.api.complete('stale private text'); await drain();
    assert.equal(r.coordinator.status().current.text, undefined);
  }
});

test('binding order is normalized but actor identity and generation remain pinned', async t => {
  const r = rig(t); await r.coordinator.prepare(); const id = r.coordinator.begin().current.id;
  r.api.context.bindings.reverse(); assert.equal(r.coordinator.status().current.status, 'CAPTURING');
  const pending = r.coordinator.submit(id, wav()); r.api.complete(); const out = await pending; assert.equal(out.current.status, 'TRANSCRIBED');
});

test('lease deadlines are enforced at exact boundaries without assuming transcript validity', async t => {
  const r = rig(t); await r.coordinator.prepare(); r.coordinator.begin(); r.api.setTime(21000);
  assert.equal(r.coordinator.status().current.error, 'SPEECH_INPUT_CAPTURE_EXPIRED'); assert.deepEqual(r.calls.ptt, [true,false]);
  await drain(); await r.coordinator.prepare(); const id = r.coordinator.begin().current.id;
  r.api.honorStop = false; const pending = r.coordinator.submit(id, wav()); r.api.setTime(31000);
  assert.equal(r.coordinator.status().current.error, 'SPEECH_INPUT_RECOGNITION_TIMEOUT'); await pending;
  r.api.complete('late'); await drain(); await r.coordinator.prepare(); const newer = r.coordinator.begin().current.id;
  const text = r.coordinator.submit(newer, wav()); r.api.complete(); await text; r.api.setTime(36000);
  const expired = r.coordinator.status(); assert.equal(expired.current.error, 'SPEECH_INPUT_TEXT_EXPIRED'); assert.equal(expired.current.text, undefined);
});

test('backwards clock permanently invalidates even if it later catches up', async t => {
  const r = rig(t); await r.coordinator.prepare(); r.coordinator.begin(); r.api.setTime(999);
  assert.equal(r.coordinator.status().current.error, 'SPEECH_INPUT_CLOCK_INVALID'); r.api.setTime(50000);
  await assert.rejects(r.coordinator.prepare(), /SPEECH_INPUT_CLOCK_INVALID/); assert.equal(r.calls.transcribes.length, 0);
});

test('cancel settles submitted preview promptly while ignored cancellation still blocks new work', async t => {
  const r = rig(t); await r.coordinator.prepare(); const id = r.coordinator.begin().current.id;
  r.api.honorStop = false; const pending = r.coordinator.submit(id, wav()); r.coordinator.cancel(id, 'private reason');
  assert.equal((await pending).current.error, 'SPEECH_INPUT_CANCELLED'); await drain();
  assert.equal(r.coordinator.status().engine.busy, true); await assert.rejects(r.coordinator.prepare(), /SPEECH_INPUT_BUSY/);
  r.api.complete('discard'); await drain(); await r.coordinator.prepare(); const next = r.coordinator.begin().current.id;
  r.coordinator.cancel(id); assert.equal(r.coordinator.status().current.id, next); assert.equal(r.coordinator.status().current.status, 'CAPTURING');
});

test('invalidate cancels a pending prepare without permitting late readiness', async t => {
  const gate = deferred(); const r = rig(t, (_o,a,engine) => { engine.start = async () => { await gate.promise; a.setEngine('READY'); }; });
  const preparing = r.coordinator.prepare(); const rejected = assert.rejects(preparing, /SPEECH_INPUT_INVALIDATED/);
  r.coordinator.invalidate('caller secret'); await rejected;
  assert.equal(r.coordinator.status().preparing, true); await assert.rejects(r.coordinator.prepare(), /SPEECH_INPUT_INVALIDATED/);
  gate.resolve(); await drain(); assert.throws(() => r.coordinator.begin(), /SPEECH_INPUT_NOT_PREPARED/);
});

test('abort signal suppresses the result and recognizer errors are redacted', async t => {
  const r = rig(t); await r.coordinator.prepare(); const id = r.coordinator.begin().current.id;
  const controller = new AbortController(); const pending = r.coordinator.submit(id, wav(), { signal:controller.signal });
  controller.abort(); assert.equal((await pending).current.error, 'SPEECH_INPUT_ABORTED'); await drain();
  await r.coordinator.prepare(); const next = r.coordinator.begin().current.id; const failed = r.coordinator.submit(next, wav());
  r.api.fail('C:/private/credential'); const result = await failed;
  assert.equal(result.current.error, 'SPEECH_INPUT_RECOGNITION_FAILED'); assert.equal(JSON.stringify(result).includes('credential'), false);
});

test('empty, overlong, ill-formed and control-bearing recognizer results never become preview text', async t => {
  for (const text of ['', '  ', 'x'.repeat(2049), '\ud800', 'ok\u0000bad', null]) {
    const r = rig(t); await r.coordinator.prepare(); const id = r.coordinator.begin().current.id;
    const pending = r.coordinator.submit(id, wav()); r.api.complete(text); const result = await pending;
    assert.equal(result.current.status, 'FAILED'); assert.equal(result.current.text, undefined); assert.equal(result.current.error, 'SPEECH_INPUT_RESULT_INVALID');
  }
});

test('interrupt or PTT hook failure fails closed without passing audio into recognition', async t => {
  for (const hook of ['onInterrupt','onPttChange']) {
    const r = rig(t, o => { o[hook] = () => { throw new Error('private hook details'); }; });
    await r.coordinator.prepare(); assert.throws(() => r.coordinator.begin(), /SPEECH_INPUT_HOOK_FAILED/);
    assert.equal(r.coordinator.status().current.status, 'FAILED'); assert.equal(r.calls.transcribes.length, 0);
  }
});

test('asynchronous radio hooks are rejected and their promise failures are handled', async t => {
  const r = rig(t, o => { o.onPttChange = async () => { throw new Error('private asynchronous failure'); }; });
  await r.coordinator.prepare(); assert.throws(() => r.coordinator.begin(), /SPEECH_INPUT_HOOK_FAILED/);
  await drain(); assert.equal(r.coordinator.status().current.status, 'FAILED'); assert.equal(r.calls.transcribes.length, 0);
});

test('dispose cancels current work and prevents future capture or prepare', async t => {
  const r = rig(t); await r.coordinator.prepare(); r.coordinator.begin(); const state = await r.coordinator.dispose();
  assert.equal(state.shutdownComplete, true); assert.equal(state.cleanupPending, false);
  assert.equal(state.current.error, 'SPEECH_INPUT_DISPOSED'); assert.deepEqual(r.calls.ptt, [true,false]);
  await assert.rejects(r.coordinator.prepare(), /SPEECH_INPUT_DISPOSED/); assert.throws(() => r.coordinator.begin(), /SPEECH_INPUT_DISPOSED/);
});
