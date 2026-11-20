// In-memory MOCK_ONLY observations, injected clocks and synchronous fixture sinks.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ControlSession } from '../control.mjs';
import { baseline } from '../../synthetic/tactical-cases.mjs';

const rejected = { status: 'REJECTED', reason: 'UNCORRELATED_EVIDENCE' };
function fixture() {
  let clock = 1000, throwing = false, reads = 0;
  const sent = [];
  const control = new ControlSession({ mode: 'MOCK_ONLY', now: () => {
    reads++; if (throwing) throw new Error('injected clock failure'); return clock;
  }, mockSink: intent => {
    sent.push(intent); if (sent.length === 1) throw new Error('uncertain mock outcome');
  } });
  function frame(sequence) {
    const snapshot = baseline(); snapshot.sequence = sequence;
    snapshot.nowMs = snapshot.observedAtMs = snapshot.targets[0].observedAtMs = clock;
    return { schemaVersion: 1, kind: 'observation', provenance: 'MOCK_ONLY', adapterId: 'result_clock_fixture',
      session: snapshot.session, sequence, observedAtMs: clock, snapshot };
  }
  function observe(sequence) {
    assert.equal(control.ingest(frame(sequence)).ok, true);
    assert.equal(control.armSimulation(['alpha']).armed, true);
    return control.queueRecommendations();
  }
  assert.equal(observe(1).queued.length, 1);
  assert.equal(control.drainSimulation()[0].status, 'UNCONFIRMED');
  const { id, session, actorId, binding } = sent[0];
  const event = changes => ({ id, session, actorId, binding, classification: 'MOCK_ONLY', stage: 'COMPLETED',
    observedAtMs: 1000, evidence: 'correlated mock outcome', ...changes });
  return { control, sent, event, frame, observe, reads: () => reads,
    at: value => { clock = value; }, throwClock: value => { throwing = value; } };
}
function rejectWithoutMutation(r, event) {
  const before = r.control.getState(), reads = r.reads(); let result;
  assert.doesNotThrow(() => { result = r.control.observeSimulatedResult(event); });
  assert.deepEqual(result, rejected);
  assert.equal(r.reads() - reads, 1, 'Result admission samples the caller clock exactly once.');
  assert.deepEqual(r.control.getState(), before);
}

for (const [label, value] of [['NaN', NaN], ['Infinity', Infinity], ['undefined', undefined],
  ['numeric string', '1000'], ['nonnumeric string', 'not-a-clock'], ['fractional', 1000.5],
  ['unsafe integer', Number.MAX_SAFE_INTEGER + 1]]) {
  test(`${label} caller time cannot record a terminal result`, () => {
    const r = fixture(); r.at(value);
    rejectWithoutMutation(r, r.event());
  });
}

test('an invalid-clock outcome cannot clear uncertainty after the cooldown expires', () => {
  const r = fixture(); r.at(NaN);
  // The later queue check independently detects a forged terminal transition.
  r.control.observeSimulatedResult(r.event());
  r.at(3100);
  const retry = r.observe(2);
  assert.deepEqual(retry.queued, []);
  assert.equal(retry.rejected[0].reason, 'UNCONFIRMED_PRIOR_ACTION');
  assert.deepEqual(r.control.drainSimulation(), []); assert.equal(r.sent.length, 1);
});

test('a throwing caller clock rejects without escaping or changing state and recovers at the floor', () => {
  const r = fixture(); r.throwClock(true);
  rejectWithoutMutation(r, r.event());
  r.throwClock(false);
  assert.equal(r.control.observeSimulatedResult(r.event()).recorded, true);
});

test('regressing result reads cannot lower the shared floor and equality recovers', () => {
  const r = fixture(); r.at(2000);
  assert.equal(r.control.ingest(r.frame(2)).ok, true);
  for (const clock of [1500, 1999]) {
    r.at(clock); rejectWithoutMutation(r, r.event());
  }
  r.at(2000);
  assert.equal(r.control.observeSimulatedResult(r.event()).recorded, true);
});

test('a valid result clock alone advances the floor used by observation admission', () => {
  const r = fixture(); r.at(2000);
  const reads = r.reads();
  assert.equal(r.control.observeSimulatedResult(r.event({ stage: 'ASSIGNED' })).recorded, true);
  assert.equal(r.reads() - reads, 1);
  r.at(1500);
  const rollback = r.control.ingest(r.frame(2));
  assert.equal(rollback.ok, false); assert.deepEqual(rollback.errors, ['REGRESSING_CONTROL_CLOCK']);
  r.at(2000);
  assert.equal(r.control.observeSimulatedResult(r.event()).recorded, true);
});

test('future-result rejection preserves its valid clock floor without changing public state', () => {
  const r = fixture(); r.at(2000);
  rejectWithoutMutation(r, r.event({ observedAtMs: 2001 }));
  r.at(1500); rejectWithoutMutation(r, r.event());
  r.at(2000);
  assert.equal(r.control.observeSimulatedResult(r.event()).recorded, true);
});

test('invalid reads leave the original floor and normal 1999/2000 ms cooldown intact', () => {
  const r = fixture();
  for (const clock of [NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    r.at(clock); rejectWithoutMutation(r, r.event());
  }
  r.at(1000);
  assert.equal(r.control.observeSimulatedResult(r.event()).recorded, true);
  r.at(2999);
  const early = r.observe(2);
  assert.deepEqual(early.queued, []); assert.equal(early.rejected[0].reason, 'ACTION_RATE_LIMIT');
  r.at(3000);
  assert.equal(r.observe(3).queued.length, 1);
  assert.equal(r.control.drainSimulation()[0].status, 'SIMULATED_SUBMISSION');
  assert.equal(r.sent.length, 2);
});

test('detached classification, identity and safe event-time checks still precede clock sampling', () => {
  const r = fixture(); r.throwClock(true);
  const before = r.control.getState(), reads = r.reads();
  for (const changes of [{ classification: 'GAME_OBSERVED' }, { actorId: 'other' }, { observedAtMs: 1000.5 }])
    assert.equal(r.control.observeSimulatedResult(r.event(changes)).status, 'REJECTED');
  const accessor = r.event(); let getterCalls = 0;
  Object.defineProperty(accessor, 'evidence', { enumerable: true, get() { getterCalls++; return 'hidden'; } });
  assert.equal(r.control.observeSimulatedResult(accessor).reason, 'MALFORMED_RESULT');
  assert.equal(getterCalls, 0); assert.equal(r.reads(), reads);
  assert.deepEqual(r.control.getState(), before);
});
