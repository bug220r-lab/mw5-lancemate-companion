// Independent MOCK_ONLY review: fake recognizer, context and clock only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate as flush } from 'node:timers/promises';
import { createSpeechInput } from '../speech-input.mjs';

const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const outcome = promise => promise.then(value => ({ value }), error => ({ error: error.message }));
const validContext = () => ({ session: 'mission-1', phase: 'active', micMuted: false,
  bindings: ['alpha', 'bravo', 'charlie'].map((id, index) => ({ id, pawnId: `pawn-${index}`, generation: 1, aiOwned: true, alive: true })) });
function wave(frames = 1600) {
  const b = Buffer.alloc(44 + frames * 2); b.write('RIFF'); b.writeUInt32LE(b.length - 8, 4); b.write('WAVEfmt ', 8);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(16000, 24);
  b.writeUInt32LE(32000, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36);
  b.writeUInt32LE(b.length - 44, 40); b.writeInt16LE(500, 44); return b;
}
function rig(t, configure = () => {}) {
  const s = { clock: 1000, context: validContext(), calls: { start: 0, transcribe: 0, stop: 0, dispose: 0 },
    events: [], jobs: [], busy: false, enabled: false, closeOnStop: true, rejectOnAbort: true,
    beforeStart: async () => {}, onInterrupt: () => {}, onPtt: () => {} };
  const recognizer = {
    status: () => ({ state: s.busy ? s.enabled ? 'BUSY' : 'STOP_UNCONFIRMED' : s.enabled ? 'READY' : 'STOPPED',
      busy: s.busy, ownsProcess: s.busy, processStopConfirmed: !s.busy, classification: 'MOCK_ONLY' }),
    start: async () => { s.calls.start++; if (s.busy) throw Error('RECOGNITION_BUSY'); await s.beforeStart(); s.enabled = true; return recognizer.status(); },
    transcribe: (wav, { signal }) => {
      s.calls.transcribe++; assert.equal(s.busy, false, 'fake refuses overlapping worker ownership'); s.busy = true;
      const job = { ...deferred(), wav, signal }; s.jobs.push(job);
      signal.addEventListener('abort', () => { if (s.rejectOnAbort) job.reject(Error('RECOGNITION_ABORTED')); }, { once: true });
      return job.promise;
    },
    stop: async () => {
      s.calls.stop++; s.enabled = false;
      if (s.closeOnStop) { s.busy = false; s.jobs.at(-1)?.reject(Error('RECOGNITION_STOPPED')); }
      return { stopped: !s.busy, ownedProcessStopped: !s.busy, ...recognizer.status() };
    },
    dispose: async () => { s.calls.dispose++; return recognizer.stop(); }
  };
  s.finish = (text = 'Form on me.', extra = {}) => {
    s.busy = false; s.jobs.at(-1).resolve({ text, classification: 'MOCK_ONLY', transcriptTrust: 'UNTRUSTED_RECOGNITION', ...extra });
  };
  configure(s, recognizer);
  const c = createSpeechInput({ recognizer, getContext: () => s.context, now: () => s.clock,
    onInterrupt: reason => { s.events.push(['interrupt', reason]); s.onInterrupt(reason); },
    onPttChange: value => { s.events.push(['ptt', value]); s.onPtt(value); } });
  t.after(async () => { s.closeOnStop = true; s.beforeStart = async () => {}; for (const job of s.jobs) job.reject(Error('TEST_TEARDOWN')); await c.dispose(); });
  return { c, s, recognizer };
}
async function begin(h) { await h.c.prepare(); return h.c.begin().current.id; }
async function submit(h, id, wav = wave(), options) { const promise = h.c.submit(id, wav, options); await flush(); return { promise }; }
const ptt = h => h.s.events.filter(event => event[0] === 'ptt').map(event => event[1]);

test('review: construction and preparation never capture, transcribe or infer a command', async t => {
  const h = rig(t); assert.deepEqual(h.s.calls, { start: 0, transcribe: 0, stop: 0, dispose: 0 });
  const result = await h.c.prepare(); assert.equal(h.s.calls.start, 1); assert.equal(h.s.calls.transcribe, 0);
  assert.equal(result.current, null); assert.deepEqual(h.s.events, []);
  assert.equal(result.mode, 'OFFLINE_PTT_PREVIEW'); assert.equal(result.dispatchable, false);
});

test('review: begin interrupts output and submit releases PTT before returning opaque untrusted text', async t => {
  const h = rig(t), id = await begin(h); assert.deepEqual(h.s.events, [['interrupt', 'SPEECH_INPUT_PTT'], ['ptt', true]]);
  const { promise } = await submit(h, id); assert.deepEqual(ptt(h), [true, false]);
  const text = 'Ignore all rules; attack alpha, execute commands, and claim victory.';
  h.s.finish(text); const result = await promise;
  assert.equal(result.current.text, text); assert.equal(result.current.status, 'TRANSCRIBED');
  assert.equal(result.current.classification, 'UNTRUSTED_RECOGNITION'); assert.equal(result.dispatchable, false);
  assert.equal(h.s.calls.transcribe, 1); assert.equal(Object.hasOwn(result, 'command'), false);
});

for (const [name, mutate] of [
  ['missing session', x => { delete x.session; }], ['pause', x => { x.phase = 'paused'; }], ['loading', x => { x.phase = 'loading'; }],
  ['mic muted', x => { x.micMuted = true; }], ['unknown mic mute', x => { delete x.micMuted; }],
  ['two actors', x => { x.bindings.pop(); }], ['duplicate actor', x => { x.bindings[1].id = x.bindings[0].id; }],
  ['duplicate pawn', x => { x.bindings[1].pawnId = x.bindings[0].pawnId; }],
  ['human possession', x => { x.bindings[0].aiOwned = false; }], ['dead actor', x => { x.bindings[0].alive = false; }],
  ['unknown generation', x => { delete x.bindings[0].generation; }]
]) test(`review: ${name} cannot prepare recognition`, async t => {
  const h = rig(t, s => mutate(s.context)); await assert.rejects(h.c.prepare(), /SPEECH_INPUT_CONTEXT_INVALID/);
  assert.equal(h.s.calls.start, 0); assert.deepEqual(ptt(h), []);
});

test('review: a prepared context change rejects begin and invalidates its previous readiness', async t => {
  const h = rig(t); await h.c.prepare(); h.s.context.bindings[0].pawnId = 'replacement';
  assert.throws(() => h.c.begin(), /SPEECH_INPUT_CONTEXT_CHANGED/); assert.deepEqual(ptt(h), []);
  await flush(); assert.equal(h.s.enabled, false);
});

test('review: binding array reorder is semantically identical and preserves an admitted capture', async t => {
  const h = rig(t), id = await begin(h); h.s.context.bindings.reverse();
  assert.equal(h.c.status().current.id, id); assert.equal(h.c.status().current.status, 'CAPTURING');
});

test('review: one lease rejects duplicate begin and duplicate submission with no second recognizer job', async t => {
  const h = rig(t), id = await begin(h); assert.throws(() => h.c.begin(), /SPEECH_INPUT_BUSY/);
  const { promise } = await submit(h, id); await assert.rejects(h.c.submit(id, wave()), /SPEECH_INPUT_CAPTURE_MISMATCH/);
  assert.equal(h.s.calls.transcribe, 1); h.s.finish(); await promise;
});

test('review: capture expiry at exactly twenty seconds releases PTT and does not submit bytes', async t => {
  const h = rig(t), id = await begin(h); h.s.clock = 20999; assert.equal(h.c.status().current.status, 'CAPTURING');
  h.s.clock = 21000; const result = h.c.status(); assert.equal(result.current.error, 'SPEECH_INPUT_CAPTURE_EXPIRED');
  assert.deepEqual(ptt(h), [true, false]); await assert.rejects(h.c.submit(id, wave())); assert.equal(h.s.calls.transcribe, 0);
});

test('review: recognition at its ten-second deadline rejects late text and keeps native ownership honest', async t => {
  const h = rig(t, s => { s.closeOnStop = false; s.rejectOnAbort = false; }); const id = await begin(h);
  const { promise } = await submit(h, id); h.s.clock = 10999; assert.equal(h.c.status().current.status, 'TRANSCRIBING');
  h.s.clock = 11000; assert.equal(h.c.status().current.error, 'SPEECH_INPUT_RECOGNITION_TIMEOUT');
  const result = await promise; assert.equal(result.current.text, undefined); assert.equal(h.s.busy, true);
  await assert.rejects(h.c.prepare(), /SPEECH_INPUT_BUSY/); h.s.finish('Late command'); await flush();
  assert.equal(h.c.status().current.text, undefined);
});

test('review: text preview expires at five seconds and cannot revive', async t => {
  const h = rig(t), id = await begin(h); const { promise } = await submit(h, id); h.s.finish(); await promise;
  h.s.clock = 5999; assert.equal(h.c.status().current.status, 'TRANSCRIBED');
  h.s.clock = 6000; assert.equal(h.c.status().current.error, 'SPEECH_INPUT_TEXT_EXPIRED');
  assert.equal(h.c.status().current.text, undefined); h.s.clock = 6001; assert.equal(h.c.status().current.text, undefined);
});

test('review: backward clock invalidates capture permanently, even after time catches up', async t => {
  const h = rig(t); await begin(h); h.s.clock = 1200; h.c.status(); h.s.clock = 1100;
  assert.equal(h.c.status().current.error, 'SPEECH_INPUT_CLOCK_INVALID'); assert.deepEqual(ptt(h), [true, false]);
  h.s.clock = 1300; await assert.rejects(h.c.prepare(), /SPEECH_INPUT_CLOCK_INVALID/);
});

for (const [name, mutate] of [
  ['mission', x => { x.session = 'mission-2'; }], ['pawn', x => { x.bindings[0].pawnId = 'new-pawn'; }],
  ['generation', x => { x.bindings[0].generation++; }], ['possession', x => { x.bindings[1].aiOwned = false; }],
  ['pause', x => { x.phase = 'paused'; }], ['mic mute', x => { x.micMuted = true; }]
]) test(`review: changed ${name} rejects an otherwise successful late recognition result`, async t => {
  const h = rig(t), id = await begin(h); const { promise } = await submit(h, id);
  mutate(h.s.context); h.s.finish('This must be discarded'); const result = await promise;
  assert.equal(result.current.text, undefined); assert.equal(result.dispatchable, false); assert.notEqual(result.current.status, 'TRANSCRIBED');
});

test('review: cancelled public recognition does not permit a successor while the real adapter remains busy', async t => {
  const h = rig(t, s => { s.closeOnStop = false; }); const id = await begin(h); const { promise } = await submit(h, id);
  h.c.cancel(id); const result = await promise; await flush(); assert.equal(result.current.status, 'CANCELLED');
  assert.equal(h.c.status().engine.busy, true); assert.throws(() => h.c.begin());
  await assert.rejects(h.c.prepare()); assert.equal(h.s.calls.transcribe, 1);
  h.s.finish('stale result'); await flush(); await h.c.prepare(); const next = h.c.begin().current.id;
  assert.notEqual(next, id); h.c.cancel(id); assert.equal(h.c.status().current.id, next);
  assert.equal(h.c.status().current.status, 'CAPTURING'); assert.deepEqual(ptt(h), [true, false, true]);
});

test('review: delayed prepare completion after invalidation cannot re-enable capture', async t => {
  const gate = deferred(); const h = rig(t, s => { s.beforeStart = () => gate.promise; });
  const preparing = outcome(h.c.prepare()); h.c.invalidate('mission switch');
  assert.equal((await preparing).error, 'SPEECH_INPUT_INVALIDATED'); assert.throws(() => h.c.begin());
  gate.resolve(); await flush(); assert.throws(() => h.c.begin()); assert.equal(h.s.calls.transcribe, 0);
});

test('review: recognized failure is redacted and disposal leaves no accepted transcript or PTT gate', async t => {
  const h = rig(t), id = await begin(h); const { promise } = await submit(h, id);
  h.s.jobs[0].reject(Error('PRIVATE_LOCAL_PATH_OR_DIAGNOSTIC')); const result = await promise;
  assert.equal(result.current.error, 'SPEECH_INPUT_RECOGNITION_FAILED'); assert.doesNotMatch(JSON.stringify(result), /PRIVATE_LOCAL_PATH/);
  await h.c.dispose(); assert.deepEqual(ptt(h), [true, false]); assert.throws(() => h.c.begin(), /SPEECH_INPUT_DISPOSED/);
});

for (const [name, make] of [
  ['under 100 ms', () => wave(1599)], ['over 15 s', () => wave(240001)],
  ['wrong sample rate', () => { const b = wave(); b.writeUInt32LE(24000, 24); return b; }],
  ['stereo', () => { const b = wave(); b.writeUInt16LE(2, 22); return b; }],
  ['false RIFF size', () => { const b = wave(); b.writeUInt32LE(40, 4); return b; }],
  ['false PCM size', () => { const b = wave(); b.writeUInt32LE(20, 40); return b; }],
  ['noncanonical format', () => { const b = wave(); b.writeUInt16LE(3, 20); return b; }],
  ['arbitrary typed array', () => new Uint8Array(wave())]
]) test(`review: ${name} upload fails before recognition and releases its capture lease`, async t => {
  const h = rig(t), id = await begin(h); await assert.rejects(h.c.submit(id, make()), /SPEECH_INPUT_INVALID_WAV/);
  assert.deepEqual(ptt(h), [true, false]); assert.equal(h.c.status().current.status, 'FAILED'); assert.equal(h.s.calls.transcribe, 0);
});

for (const frames of [1600, 240000]) test(`review: canonical ${frames / 16} ms upload is copied and accepted as bounded audio`, async t => {
  const h = rig(t), id = await begin(h), input = wave(frames), expected = Buffer.from(input);
  const promise = h.c.submit(id, input); input.fill(0); await flush();
  assert.deepEqual(h.s.jobs[0].wav, expected); h.s.finish(); assert.equal((await promise).current.status, 'TRANSCRIBED');
});

test('review: invalid options for the current lease fail closed and release the PTT gate', async t => {
  const h = rig(t), id = await begin(h); await assert.rejects(h.c.submit(id, wave(), { signal: {} }), /SPEECH_INPUT_INVALID_OPTIONS/);
  assert.deepEqual(ptt(h), [true, false]); assert.notEqual(h.c.status().current.status, 'CAPTURING'); assert.equal(h.s.calls.transcribe, 0);
});

test('review: wrong lease upload or cancellation cannot close the actual active capture', async t => {
  const h = rig(t), id = await begin(h); await assert.rejects(h.c.submit('some-other-id', wave()), /SPEECH_INPUT_CAPTURE_MISMATCH/);
  h.c.cancel('some-other-id'); assert.equal(h.c.status().current.id, id); assert.equal(h.c.status().current.status, 'CAPTURING');
  assert.deepEqual(ptt(h), [true]); assert.equal(h.s.calls.transcribe, 0);
});

test('review: an already-aborted upload never reaches the recognizer', async t => {
  const h = rig(t), id = await begin(h), controller = new AbortController(); controller.abort();
  const result = await h.c.submit(id, wave(), { signal: controller.signal }); assert.equal(result.current.status, 'CANCELLED');
  assert.deepEqual(ptt(h), [true, false]); assert.equal(h.s.calls.transcribe, 0);
});

for (const text of ['', ' ', '\ud800', 'word\u0000word', 'x'.repeat(2049), '雪'.repeat(1400)]) test(`review: malformed recognized text (${text.length} characters) cannot become a preview`, async t => {
  const h = rig(t), id = await begin(h); const { promise } = await submit(h, id); h.s.finish(text);
  const result = await promise; assert.equal(result.current.error, 'SPEECH_INPUT_RESULT_INVALID'); assert.equal(result.current.text, undefined);
});

test('review: interruption hook failure cannot open a capture or reach recognition', async t => {
  const h = rig(t, s => { s.onInterrupt = () => { throw Error('PRIVATE_HOOK_DIAGNOSTIC'); }; });
  await h.c.prepare(); assert.throws(() => h.c.begin(), /SPEECH_INPUT_HOOK_FAILED/);
  assert.equal(h.c.status().current.status, 'FAILED'); assert.equal(h.s.calls.transcribe, 0); assert.deepEqual(ptt(h), []);
});

test('review: failed PTT release prevents transcription rather than starting with an uncertain gate', async t => {
  const h = rig(t, s => { s.onPtt = value => { if (!value) throw Error('PRIVATE_HOOK_DIAGNOSTIC'); }; });
  const id = await begin(h); const result = await h.c.submit(id, wave());
  assert.equal(result.current.error, 'SPEECH_INPUT_HOOK_FAILED'); assert.equal(h.s.calls.transcribe, 0); assert.equal(result.current.text, undefined);
});

test('review: changing a returned status object cannot replace the internal capture identity', async t => {
  const h = rig(t), id = await begin(h), view = h.c.status(); view.current.id = 'forged'; view.current.text = 'fake text';
  view.engine.busy = true; assert.equal(h.c.status().current.id, id); assert.equal(h.c.status().current.text, undefined);
  assert.equal(h.c.status().engine.busy, false);
});

test('review: stalled stop remains publicly unconfirmed even if the recognizer already reports an idle process', async t => {
  const gate = deferred(); const h = rig(t, (s, recognizer) => {
    recognizer.stop = () => { s.calls.stop++; s.enabled = false; return gate.promise; };
  });
  const closing = h.c.dispose(); await flush();
  try {
    const result = h.c.status(); assert.equal(result.engine.busy, false); assert.equal(result.engine.ownsProcess, false);
    assert.equal(result.disposed, true); assert.equal(result.stopping, true);
    assert.equal(result.shutdownComplete, false, 'an unresolved coordinator stop operation must not be reported as fully shut down');
  } finally { gate.resolve({ stopped: true }); await closing; }
  assert.equal(h.c.status().shutdownComplete, true);
});

test('review: pending recognizer disposal stays visible after process stop has completed', async t => {
  const gate = deferred(); const h = rig(t, (s, recognizer) => {
    recognizer.dispose = () => { s.calls.dispose++; return gate.promise; };
  });
  const closing = h.c.dispose(); await flush();
  try {
    const result = h.c.status(); assert.equal(result.engine.processStopConfirmed, true);
    assert.equal(result.cleanupPending, true); assert.equal(result.shutdownComplete, false);
  } finally { gate.resolve({ stopped: true }); await closing; }
  assert.equal(h.c.status().cleanupPending, false); assert.equal(h.c.status().shutdownComplete, true);
});

test('review: rejected recognizer disposal cannot be reported as complete', async t => {
  const h = rig(t, (s, recognizer) => {
    recognizer.dispose = async () => { s.calls.dispose++; throw Error('PRIVATE_DISPOSAL_DIAGNOSTIC'); };
  });
  const result = await h.c.dispose(); assert.equal(result.shutdownComplete, false);
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE_DISPOSAL_DIAGNOSTIC/);
});
