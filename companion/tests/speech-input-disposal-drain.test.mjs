import assert from 'node:assert/strict';
import test from 'node:test';
import { setImmediate as flush } from 'node:timers/promises';
import { createSpeechInput } from '../speech-input.mjs';

function fixture(t, { holdStart = false, holdStop = false } = {}) {
  const start = Promise.withResolvers(), stop = Promise.withResolvers(), recognition = Promise.withResolvers();
  const disposals = [], calls = { start: 0, stop: 0, transcribe: 0 };
  let state = 'STOPPED', ownsProcess = false;
  const context = { session: 'mock-mission', phase: 'active', micMuted: false,
    bindings: ['alpha', 'bravo', 'charlie'].map(id => ({ id, pawnId: `pawn-${id}`, generation: 1,
      aiOwned: true, alive: true })) };
  const recognizer = {
    async start() {
      calls.start++; state = 'STARTING';
      if (holdStart) await start.promise;
      state = 'READY';
    },
    transcribe() { calls.transcribe++; return recognition.promise; },
    async stop() {
      calls.stop++;
      if (holdStop) await stop.promise;
      state = 'STOPPED';
    },
    dispose() {
      const work = Promise.withResolvers();
      disposals.push(work);
      return work.promise;
    },
    status() { return { state, busy: state === 'STARTING', ownsProcess, processStopConfirmed: !ownsProcess }; },
  };
  t.after(() => { start.resolve(); stop.resolve(); recognition.resolve({ text: 'test teardown' });
    for (const wait of disposals) wait.resolve(); });
  return { input: createSpeechInput({ recognizer, getContext: () => context, now: () => 1000 }),
    calls, start, stop, recognition, disposals, reportOwnership: value => { ownsProcess = value; } };
}

function syntheticWav() {
  const b = Buffer.alloc(3244);
  b.write('RIFF'); b.writeUInt32LE(b.length - 8, 4); b.write('WAVEfmt ', 8);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(16000, 24);
  b.writeUInt32LE(32000, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36);
  b.writeUInt32LE(b.length - 44, 40);
  return b;
}

for (const rejects of [false, true]) test(`a cancelled start that later ${rejects ? 'rejects' : 'resolves'} drains before adapter disposal`, async t => {
  const f = fixture(t, { holdStart: true });
  const cancelled = assert.rejects(f.input.prepare(), { code: 'SPEECH_INPUT_DISPOSED' });
  const first = await f.input.dispose();
  await cancelled;
  assert.equal(first.preparing, true);
  assert.equal(first.cleanupPending, true);
  assert.equal(first.shutdownComplete, false);
  assert.equal(f.disposals.length, 0);

  if (rejects) f.start.reject(new Error('PRIVATE_PREFLIGHT_ERROR'));
  else f.start.resolve();
  await flush();
  assert.equal(f.input.status().preparing, false);
  assert.equal(f.input.status().engine.state, 'STOPPED');
  assert.equal(f.input.status().shutdownComplete, false, 'stopped is not positive evidence of disposal');
  assert.equal(f.disposals.length, 1, 'disposal is scheduled when the cancelled start drains');
  assert.equal(f.input.status().cleanupPending, true);
  f.disposals[0].resolve();
  await flush();
  assert.equal(f.input.status().cleanupPending, false);
  assert.equal(f.input.status().shutdownComplete, true);
});

test('a stop that outlasts the bounded caller still admits disposal when it settles', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = fixture(t, { holdStop: true });
  const first = f.input.dispose();
  await flush();
  t.mock.timers.tick(3000);
  const timedOut = await first;
  assert.equal(timedOut.shutdownComplete, false);
  assert.equal(timedOut.stopping, true);
  assert.equal(f.disposals.length, 0);

  f.stop.resolve();
  await flush();
  assert.equal(f.input.status().stopping, false);
  assert.equal(f.input.status().shutdownComplete, false);
  assert.equal(f.disposals.length, 1);
  f.disposals[0].resolve();
  await flush();
  assert.equal(f.input.status().shutdownComplete, true);
  assert.equal(f.calls.stop, 1);
});

test('public cancellation does not release pending recognition ownership or publish late text during disposal', async t => {
  const f = fixture(t);
  await f.input.prepare();
  const lease = f.input.begin().current.id;
  const submitted = f.input.submit(lease, syntheticWav());
  const closing = await f.input.dispose();
  assert.equal((await submitted).current.status, 'CANCELLED');
  assert.equal(closing.pendingRecognition, true);
  assert.equal(closing.shutdownComplete, false);
  assert.equal(f.calls.transcribe, 1);
  assert.equal(f.disposals.length, 0);

  f.recognition.resolve({ text: 'late text must stay discarded' });
  await flush();
  assert.equal(f.input.status().current.text, undefined);
  assert.equal(f.input.status().pendingRecognition, false);
  assert.equal(f.input.status().shutdownComplete, false);
  assert.equal(f.disposals.length, 1);
  f.disposals[0].resolve();
  await flush();
  assert.equal(f.input.status().shutdownComplete, true);
});

test('concurrent and repeated public disposal share one stop and one successful adapter disposal', async t => {
  const f = fixture(t);
  const first = f.input.dispose(), concurrent = f.input.dispose();
  await flush();
  assert.equal(f.calls.stop, 1);
  assert.equal(f.disposals.length, 1);
  assert.equal(f.input.status().cleanupPending, true);
  f.disposals[0].resolve();
  assert.equal((await first).shutdownComplete, true);
  assert.equal((await concurrent).shutdownComplete, true);
  assert.equal(f.input.invalidate('late invalidation').shutdownComplete, true);
  assert.equal(f.input.cancel('old lease').shutdownComplete, true);
  const later = f.input.dispose();
  await flush();
  assert.equal(f.calls.stop, 1);
  assert.equal(f.disposals.length, 1);
  assert.equal((await later).shutdownComplete, true);
});

test('adapter rejection cannot certify shutdown or auto-retry; an explicit retry still needs stop proof', async t => {
  const f = fixture(t);
  const first = f.input.dispose();
  await flush();
  f.disposals[0].reject(new Error('PRIVATE_DISPOSAL_ERROR'));
  const failed = await first;
  assert.equal(failed.shutdownComplete, false);
  assert.equal(failed.cleanupPending, false);
  assert.doesNotMatch(JSON.stringify(failed), /PRIVATE_DISPOSAL_ERROR/);
  await flush();
  assert.equal(f.disposals.length, 1);

  f.reportOwnership(true);
  const retry = f.input.dispose();
  await flush();
  assert.equal(f.disposals.length, 2, 'only the explicit request retries the failed disposal');
  f.disposals[1].resolve();
  assert.equal((await retry).shutdownComplete, false, 'successful disposal call is not process-stop evidence');
  f.reportOwnership(false);
  assert.equal(f.input.status().shutdownComplete, true);
  assert.equal(f.calls.stop, 1);
});
