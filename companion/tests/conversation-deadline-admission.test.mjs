// Injected clock, mock timers and inert deferred generators only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate as flush } from 'node:timers/promises';
import { createConversationCoordinator } from '../conversation.mjs';

const bindings = ['alpha', 'bravo', 'charlie'].map((id, index) => ({ id,
  profileId: ['edge', 'tactician', 'scout'][index], pawnId: `pawn-${index + 1}`,
  generation: 1, aiOwned: true, alive: true }));

function fixture(t) {
  let clock = 1000;
  const calls = [];
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const coordinator = createConversationCoordinator({ now: () => clock, timeoutMs: 100,
    generate: (context, { signal }) => new Promise(resolve => calls.push({ context, signal, resolve })) });
  assert.equal(coordinator.startMission('mission', bindings).status, 'STARTED');
  t.after(async () => {
    coordinator.dispose();
    for (const call of calls) call.resolve('Discarded.');
    await flush();
  });
  const request = id => coordinator.request({ id, session: 'mission', speakerId: 'alpha',
    pawnId: 'pawn-1', generation: 1, priority: 'answer', text: 'Radio check.', facts: [], expiresAtMs: 5000 });
  return { coordinator, request, calls, at: value => { clock = value; } };
}

test('completion at the deadline is cancelled even before its timer callback runs', async t => {
  const r = fixture(t);
  const result = r.request('boundary');
  await flush();
  assert.equal(r.calls.length, 1);
  r.at(1100);
  r.calls[0].resolve('Late text.');
  const outcome = await result;
  assert.equal(outcome.status, 'CANCELLED');
  assert.equal(outcome.reason, 'GENERATION_TIMEOUT');
  assert.equal(r.calls[0].signal.aborted, true);
  assert.deepEqual(r.coordinator.getState().histories.alpha, []);
});

test('a queued request at its deadline cannot take a released slot before its timer fires', async t => {
  const r = fixture(t);
  const first = r.request('doing-work');
  const pending = r.request('waiting');
  await flush();
  assert.equal(r.calls.length, 1);
  r.coordinator.cancel('doing-work');
  assert.equal((await first).reason, 'USER_CANCELLED');
  r.at(1100);
  await flush();
  assert.equal(r.calls.length, 1, 'Cancellation did not release the unsettled generator.');
  r.calls[0].resolve('Old generator settles.');
  await flush();
  assert.equal(r.calls.length, 1, 'An expired queued request must never call generate.');
  const outcome = await pending;
  assert.equal(outcome.status, 'CANCELLED');
  assert.equal(outcome.reason, 'QUEUE_TIMEOUT');
  assert.deepEqual(r.coordinator.getState().histories.alpha, []);
});

test('the clock is rechecked after reserving a slot and before invoking the generator', async t => {
  const r = fixture(t);
  const result = r.request('before-invocation');
  assert.equal(r.calls.length, 0);
  r.at(1100);
  await flush();
  assert.equal(r.calls.length, 0);
  const outcome = await result;
  assert.equal(outcome.status, 'CANCELLED');
  assert.equal(outcome.reason, 'QUEUE_TIMEOUT');
  assert.deepEqual(r.coordinator.getState().histories.alpha, []);
});

test('completion just before the configured deadline keeps the original generated result', async t => {
  const r = fixture(t);
  const result = r.request('on-time');
  await flush();
  assert.equal(r.calls.length, 1);
  r.at(1099);
  r.calls[0].resolve('On time.');
  const outcome = await result;
  assert.equal(outcome.status, 'GENERATED');
  assert.equal(outcome.createdAtMs, 1099);
  assert.equal(outcome.expiresAtMs, 5000, 'The generation deadline is not a delivery deadline.');
  assert.equal(outcome.dispatchable, false);
  assert.deepEqual(r.coordinator.getState().histories.alpha.map(turn => turn.responseText), ['On time.']);
});
