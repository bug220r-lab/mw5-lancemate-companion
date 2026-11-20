// Injected clock, mock timers and inert deferred generators only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate as flush } from 'node:timers/promises';
import { createConversationCoordinator } from '../conversation.mjs';

const bindings = () => ['alpha', 'bravo', 'charlie'].map((id, index) => ({ id,
  profileId: ['edge', 'tactician', 'scout'][index], pawnId: `pawn-${index + 1}`,
  generation: 1, aiOwned: true, alive: true }));
const invalid = { status: 'REJECTED', reason: 'INVALID_BINDINGS', classification: 'PROJECT_ONLY', dispatchable: false };
function malformed(key = 'bravo') {
  const dense = bindings(), input = [dense[0], , dense[2]];
  input[key] = dense[1];
  return input;
}
function attempt(coordinator, input) {
  // Keep state assertions observable even on the pre-fix synchronous exception.
  try { return coordinator.startMission('proposed-mission', input); }
  catch (error) { return { status: 'THREW', message: error.message }; }
}
function fixture(t) {
  const calls = [];
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const coordinator = createConversationCoordinator({ now: () => 1000,
    generate: (context, { signal }) => new Promise(resolve => calls.push({ context, signal, resolve })) });
  assert.equal(coordinator.startMission('current-mission', bindings()).status, 'STARTED');
  t.after(async () => {
    coordinator.dispose();
    for (const call of calls) call.resolve('Discarded.');
    await flush();
  });
  const request = (id, session = 'current-mission') => coordinator.request({ id, session, speakerId: 'alpha',
    pawnId: 'pawn-1', generation: 1, priority: 'answer', text: 'Radio check.', facts: [], expiresAtMs: 5000 });
  return { coordinator, calls, request };
}

for (const key of ['bravo', '01', '-0', '1e0']) {
  test(`a binding hole plus named ${key} entry returns INVALID_BINDINGS`, t => {
    const r = fixture(t);
    assert.deepEqual(attempt(r.coordinator, malformed(key)), invalid);
  });
}

test('invalid mission admission preserves current history, active work, queued work and request IDs', async t => {
  const r = fixture(t);
  const history = r.request('history'); await flush();
  r.calls[0].resolve('Existing history.'); assert.equal((await history).status, 'GENERATED'); await flush();
  const active = r.request('active'), queued = r.request('queued'); await flush();
  let activeSettled = false, queuedSettled = false;
  void active.then(() => { activeSettled = true; });
  void queued.then(() => { queuedSettled = true; });
  const before = r.coordinator.getState();
  attempt(r.coordinator, malformed()); await flush();
  assert.equal(r.calls[1].signal.aborted, false, 'Invalid replacement must not cancel the current generator.');
  assert.equal(activeSettled, false); assert.equal(queuedSettled, false);
  assert.deepEqual(r.coordinator.getState(), before);
  assert.equal((await r.request('history')).reason, 'DUPLICATE_REQUEST');
  r.calls[1].resolve('Current work.'); assert.equal((await active).status, 'GENERATED'); await flush();
  assert.equal(r.calls.length, 3); assert.equal(r.calls[2].context.request.id, 'queued');
  r.calls[2].resolve('Queued work.'); assert.equal((await queued).status, 'GENERATED');
  assert.deepEqual(r.coordinator.getState().histories.alpha.map(turn => turn.responseText),
    ['Existing history.', 'Current work.', 'Queued work.']);
});

test('invalid binding arrays do not consume the proposed mission ID', t => {
  const r = fixture(t);
  attempt(r.coordinator, malformed());
  assert.deepEqual(r.coordinator.startMission('proposed-mission', bindings()),
    { status: 'STARTED', session: 'proposed-mission' });
});

test('missing own entries and binding accessors are rejected without invoking getters', t => {
  const r = fixture(t), dense = bindings(); let reads = 0;
  const sparse = [dense[0], , dense[2]];
  assert.deepEqual(attempt(r.coordinator, sparse), invalid);
  Object.defineProperty(sparse, '1', { enumerable: true, get() { reads++; return dense[1]; } });
  assert.deepEqual(attempt(r.coordinator, sparse), invalid);
  assert.equal(reads, 0);
  assert.equal(r.coordinator.getState().session, 'current-mission');
});

test('a dense valid transition resets history and retains the occupied generator slot until settlement', async t => {
  const r = fixture(t);
  const history = r.request('history'); await flush();
  r.calls[0].resolve('Old history.'); await history; await flush();
  const old = r.request('reused'); await flush();
  assert.deepEqual(r.coordinator.startMission('proposed-mission', bindings()),
    { status: 'STARTED', session: 'proposed-mission' });
  assert.equal((await old).reason, 'MISSION_CHANGED'); assert.equal(r.calls[1].signal.aborted, true);
  assert.deepEqual(r.coordinator.getState().histories.alpha, []);
  const next = r.request('reused', 'proposed-mission'); await flush();
  assert.equal(r.calls.length, 2, 'A cancelled but unsettled generator still owns the only slot.');
  assert.equal(r.coordinator.getState().active.cancelled, true);
  r.calls[1].resolve('Stale text.'); await flush();
  assert.equal(r.calls.length, 3); assert.equal(r.calls[2].context.session, 'proposed-mission');
  assert.deepEqual(r.calls[2].context.history, []);
  r.calls[2].resolve('New mission.'); assert.equal((await next).status, 'GENERATED');
  assert.deepEqual(r.coordinator.getState().histories.alpha.map(turn => turn.responseText), ['New mission.']);
});
