// Independent adversarial review. All fixtures/sinks are in-memory MOCK_ONLY.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ControlSession } from '../control.mjs';
import { baseline } from '../../synthetic/tactical-cases.mjs';

function rig(options = {}) {
  let clock = 1000; const sent = [];
  const control = new ControlSession({ mode: 'MOCK_ONLY', now: () => clock,
    mockSink: intent => sent.push(intent), ...options });
  function observe(sequence, { session = 'mission1', mutate = () => {} } = {}) {
    const snapshot = baseline(); snapshot.sequence = sequence; snapshot.session = session;
    snapshot.nowMs = snapshot.observedAtMs = clock; snapshot.targets[0].observedAtMs = clock;
    mutate(snapshot, snapshot.lancemates[0]);
    return { schemaVersion: 1, kind: 'observation', provenance: 'MOCK_ONLY', adapterId: 'review',
      session, sequence, observedAtMs: clock, snapshot };
  }
  return { control, sent, observe, tick: () => { clock++; } };
}
const hold = (a, status = 'active') => { a.manual = {
  observable: true, revision: 1, orderId: 'human_hold', status, persistent: true }; };

test('review: malformed release cannot remove a previously observed human hold', () => {
  const r = rig(); r.control.ingest(r.observe(1, { mutate: (s, a) => hold(a) })); r.tick();
  const invalid = r.observe(2, { mutate: (s, a) => hold(a, 'released') }); delete invalid.provenance;
  assert.equal(r.control.ingest(invalid).ok, false); r.tick();
  const resumed = r.control.ingest(r.observe(3, { mutate: (s, a) => { a.manual.revision = 1; } }));
  assert.equal(resumed.recommendations[0].reason, 'HUMAN_ORDER_NOT_RELEASED');
  assert.equal(r.control.getState().policyState.actors.alpha.heldHumanOrder.id, 'human_hold');
  r.control.armSimulation(['alpha']); r.control.queueRecommendations(); r.control.drainSimulation();
  assert.equal(r.sent.length, 0);
});

test('review: paused active order latches and a rejected authority release cannot undo it', () => {
  const r = rig();
  r.control.ingest(r.observe(1, { mutate: (s, a) => { s.phase = 'paused'; hold(a); } })); r.tick();
  r.control.ingest(r.observe(2, { mutate: (s, a) => { s.authority = null; hold(a, 'released'); } })); r.tick();
  const x = r.control.ingest(r.observe(3, { mutate: (s, a) => { a.manual.revision = 1; } }));
  assert.equal(x.recommendations[0].reason, 'HUMAN_ORDER_NOT_RELEASED');
});

test('review: retired traffic cannot erase the current mission hold', () => {
  const r = rig(); r.control.ingest(r.observe(1)); r.tick();
  r.control.ingest(r.observe(1, { session: 'mission2', mutate: (s, a) => hold(a) })); r.tick();
  assert.equal(r.control.ingest(r.observe(2, { mutate: (s, a) => hold(a, 'released') })).ok, false); r.tick();
  const current = r.control.ingest(r.observe(2, { session: 'mission2', mutate: (s, a) => { a.manual.revision = 1; } }));
  assert.equal(current.recommendations[0].reason, 'HUMAN_ORDER_NOT_RELEASED');
  assert.equal(r.control.getState().session, 'mission2');
});

test('review: changed binding invalidates queued intent and requires another observation', () => {
  const r = rig(); r.control.ingest(r.observe(1)); r.control.armSimulation(['alpha']);
  r.control.queueRecommendations(); r.tick();
  const changed = r.control.ingest(r.observe(2, { mutate: (s, a) => { a.pawnId = 'replacement'; a.generation = 2; } }));
  assert.equal(changed.recommendations[0].reason, 'BINDING_CHANGED_REOBSERVE');
  assert.equal(r.control.drainSimulation().length, 0);
  assert.equal(r.control.queueRecommendations().queued.length, 0);
  assert.equal(r.sent.length, 0);
});

test('review: simulated submission never records assignment, movement or native acceptance', () => {
  const r = rig(); r.control.ingest(r.observe(1)); r.control.armSimulation(['alpha']); r.control.queueRecommendations();
  const results = r.control.drainSimulation(); const state = r.control.getState();
  assert.deepEqual(state.ledger[0].stages.map(s => s.stage), ['SUBMITTED']);
  assert.equal(results[0].nativeAcceptance, 'NOT_PERFORMED');
  assert.equal(state.nativeCalls, 0);
  assert.ok(state.capabilities.every(c => c.gameVerified === false && c.enabled === false));
});

test('review: synthetic result evidence cannot release human intent or become real evidence', () => {
  const r = rig(); r.control.ingest(r.observe(1)); r.control.armSimulation(['alpha']);
  r.control.queueRecommendations(); r.control.drainSimulation(); const entry = r.control.getState().ledger[0]; r.tick();
  r.control.ingest(r.observe(2, { mutate: (s, a) => hold(a) }));
  const evidence = { id: entry.id, session: entry.session, actorId: entry.actorId, binding: entry.binding,
    stage: 'ASSIGNED', observedAtMs: 1001, evidence: 'test observation', classification: 'MOCK_ONLY' };
  assert.equal(r.control.observeSimulatedResult({ ...evidence, classification: 'GAME_OBSERVED' }).status, 'REJECTED');
  assert.equal(r.control.observeSimulatedResult(evidence).recorded, true);
  assert.equal(r.control.getState().policyState.actors.alpha.heldHumanOrder.id, 'human_hold');
});

test('review: a game-labelled observation cannot enable the mock submission path', () => {
  const r = rig(); const f = r.observe(1); f.provenance = 'GAME_OBSERVED';
  assert.equal(r.control.ingest(f).classification, 'GAME_OBSERVED_UNVALIDATED');
  assert.equal(r.control.armSimulation(['alpha']).status, 'REJECTED');
  assert.equal(r.control.queueRecommendations().queued.length, 0);
});
