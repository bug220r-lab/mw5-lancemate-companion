import test from 'node:test';
import assert from 'node:assert/strict';
import { ControlSession } from '../control.mjs';
import { baseline } from '../../synthetic/tactical-cases.mjs';

function rig() {
  let clock = 1000, clockReads = 0;
  const sent = [];
  const control = new ControlSession({ mode: 'MOCK_ONLY', now: () => { clockReads++; return clock; },
    mockSink: intent => sent.push(intent) });
  const frame = (sequence, change = () => {}) => {
    const snapshot = baseline();
    snapshot.sequence = sequence;
    snapshot.nowMs = snapshot.observedAtMs = snapshot.targets[0].observedAtMs = clock;
    change(snapshot, snapshot.lancemates[0]);
    return { schemaVersion: 1, kind: 'observation', provenance: 'MOCK_ONLY',
      adapterId: 'dispatch-context-fixture', session: snapshot.session, sequence, observedAtMs: clock, snapshot };
  };
  const ingest = (sequence, change) => {
    const result = control.ingest(frame(sequence, change));
    assert.equal(result.ok, true);
    return result;
  };
  return { control, frame, ingest, sent, clockReads: () => clockReads, advance: ms => { clock += ms; } };
}

const focusOn = {
  target: snapshot => { snapshot.targets[0].observedAtMs = 1; },
  engagement: (_, actor) => { actor.engagements[0].observedAtMs = 1; },
};
for (const [name, change] of Object.entries(focusOn)) {
  test(`stale ${name} evidence blocks FOCUS while the intent and observation envelope are still fresh`, () => {
    const r = rig();
    r.ingest(1, change);
    assert.equal(r.control.armSimulation(['alpha']).armed, true);
    assert.equal(r.control.queueRecommendations().queued[0].action, 'FOCUS');
    r.advance(2);
    assert.equal(r.control.drainSimulation()[0].reason, 'STALE_TACTICAL_EVIDENCE');
    assert.deepEqual(r.sent, []);
    assert.deepEqual(r.control.getState().ledger, []);
    r.ingest(2);
    assert.equal(r.control.queueRecommendations().queued.length, 1);
    assert.equal(r.control.drainSimulation()[0].status, 'SIMULATED_SUBMISSION');
  });
}

test('a stale path blocks a retreat before the mock sink even without a target', () => {
  const r = rig();
  r.ingest(1, (snapshot, actor) => {
    snapshot.targets = [];
    actor.healthFraction = 0.1;
    actor.positions = [{ id: 'shelter', pathFeasible: true, occupied: false, saferThanCurrent: true, observedAtMs: 1 }];
  });
  assert.equal(r.control.armSimulation(['alpha']).armed, true);
  assert.equal(r.control.queueRecommendations().queued[0].action, 'REPOSITION');
  r.advance(2);
  assert.equal(r.control.drainSimulation()[0].reason, 'STALE_TACTICAL_EVIDENCE');
  assert.deepEqual(r.sent, []);
});

test('exactly 1000 ms old distinct evidence is accepted, while stale evidence also blocks queueing', () => {
  const edge = rig();
  edge.ingest(1, focusOn.engagement);
  assert.equal(edge.control.armSimulation(['alpha']).armed, true);
  edge.advance(1);
  assert.equal(edge.control.queueRecommendations().queued[0].action, 'FOCUS');
  assert.equal(edge.control.drainSimulation()[0].status, 'SIMULATED_SUBMISSION');

  const stale = rig();
  stale.ingest(1, focusOn.engagement);
  assert.equal(stale.control.armSimulation(['alpha']).armed, true);
  stale.advance(2);
  const result = stale.control.queueRecommendations();
  assert.deepEqual(result.queued, []);
  assert.equal(result.rejected[0].reason, 'STALE_TACTICAL_EVIDENCE');
});

test('a backwards clock cannot revive a snapshot already rejected as stale', () => {
  const r = rig();
  r.ingest(1, focusOn.target);
  assert.equal(r.control.armSimulation(['alpha']).armed, true);
  assert.equal(r.control.queueRecommendations().queued.length, 1);
  r.advance(2);
  assert.equal(r.control.drainSimulation()[0].reason, 'STALE_TACTICAL_EVIDENCE');
  r.advance(-1);
  assert.equal(r.control.queueRecommendations().reason, 'EXPIRED_OR_INVALID_CLOCK');
  assert.deepEqual(r.control.drainSimulation(), []);
  assert.deepEqual(r.sent, []);
});

const oldFacts = (snapshot, actor) => {
  focusOn.target(snapshot);
  focusOn.engagement(snapshot, actor);
};
for (const stage of ['queue', 'drain']) {
  test(`a newer envelope cannot revive old facts after the ${stage} clock advances and rolls back`, () => {
    const r = rig();
    r.ingest(1, oldFacts);
    assert.equal(r.control.armSimulation(['alpha']).armed, true);
    if (stage === 'drain') assert.equal(r.control.queueRecommendations().queued.length, 1);
    r.advance(2);
    const rejected = stage === 'queue' ? r.control.queueRecommendations().rejected : r.control.drainSimulation();
    assert.equal(rejected[0].reason, 'STALE_TACTICAL_EVIDENCE');
    r.advance(-1);
    const rollback = r.control.ingest(r.frame(2, oldFacts));
    r.control.queueRecommendations();
    r.control.drainSimulation();
    assert.deepEqual(r.sent, []);
    assert.equal(rollback.ok, false);
    assert(rollback.errors.includes('REGRESSING_CONTROL_CLOCK'));
    assert.equal(r.control.getState().armed, false);
    r.advance(1);
    const stale = r.control.ingest(r.frame(2, oldFacts));
    assert.equal(stale.ok, false);
    assert(stale.errors.some(error => error.startsWith('INVALID_TARGET_EVIDENCE_TIME')));
    r.ingest(3);
    assert.deepEqual(r.control.queueRecommendations().queued, []);
    assert.equal(r.control.armSimulation(['alpha']).armed, true);
    assert.equal(r.control.queueRecommendations().queued.length, 1);
    assert.equal(r.control.drainSimulation()[0].status, 'SIMULATED_SUBMISSION');
    assert.equal(r.sent.length, 1);
  });
}

test('ingest samples its clock once for observation admission and audit', () => {
  const r = rig();
  for (const sequence of [1, 2]) {
    r.advance(1);
    const before = r.clockReads();
    r.ingest(sequence);
    assert.equal(r.clockReads() - before, 1);
    assert.equal(r.control.getState().audit.at(-1).atMs, 1000 + sequence);
  }
});

test('the old arm cannot follow a recipient to a replacement pawn', () => {
  const r = rig();
  r.ingest(1);
  assert.equal(r.control.armSimulation(['alpha']).armed, true);
  assert.equal(r.control.queueRecommendations().queued.length, 1);
  const replace = (_, actor) => { actor.pawnId = 'replacement'; actor.generation = 2; };
  r.advance(1);
  assert.equal(r.ingest(2, replace).recommendations[0].reason, 'BINDING_CHANGED_REOBSERVE');
  assert.deepEqual(r.control.drainSimulation(), []);
  r.advance(1);
  assert.equal(r.ingest(3, replace).recommendations[0].action, 'FOCUS');
  assert.equal(r.control.getState().armed, false);
  assert.deepEqual(r.control.queueRecommendations().queued, []);
  assert.equal(r.control.armSimulation(['alpha']).armed, true);
  assert.equal(r.control.queueRecommendations().queued.length, 1);
  assert.equal(r.control.drainSimulation()[0].status, 'SIMULATED_SUBMISSION');
  assert.equal(r.sent[0].binding, 'controller1:replacement:2');
});

test('a changed human order revision revokes arm even when the order has already ended', () => {
  const r = rig();
  r.ingest(1);
  assert.equal(r.control.armSimulation(['alpha']).armed, true);
  assert.equal(r.control.queueRecommendations().queued.length, 1);
  r.advance(1);
  assert.equal(r.ingest(2, (_, actor) => {
    actor.manual = { observable: true, revision: 1, orderId: 'ended', status: 'completed', persistent: false };
  }).recommendations[0].action, 'FOCUS');
  assert.equal(r.control.getState().armed, false);
  assert.deepEqual(r.control.queueRecommendations().queued, []);
  assert.deepEqual(r.control.drainSimulation(), []);
  assert.deepEqual(r.sent, []);
});

test('a missing armed recipient cannot regain permission by returning with the same binding', () => {
  const r = rig();
  const addBravo = (snapshot, actor) => {
    snapshot.lancemates.push({ ...structuredClone(actor), id: 'bravo', pawnId: 'pawn2', controllerId: 'controller2' });
  };
  r.ingest(1, addBravo);
  assert.equal(r.control.armSimulation(['bravo']).armed, true);
  assert.equal(r.control.queueRecommendations().queued.length, 1);
  r.advance(1);
  r.ingest(2);
  r.advance(1);
  r.ingest(3, addBravo);
  assert.equal(r.control.getState().armed, false);
  assert.deepEqual(r.control.queueRecommendations().queued, []);
  assert.deepEqual(r.control.drainSimulation(), []);
  assert.deepEqual(r.sent, []);
});

test('switching the armed set away and back cannot bring back a queued intent', () => {
  const r = rig();
  r.ingest(1, (snapshot, actor) => {
    snapshot.lancemates.push({ ...structuredClone(actor), id: 'bravo', pawnId: 'pawn2', controllerId: 'controller2' });
  });
  assert.equal(r.control.armSimulation(['alpha']).armed, true);
  const original = r.control.queueRecommendations().queued[0];
  assert.equal(original.actorId, 'alpha');
  assert.equal(r.control.armSimulation(['bravo']).armed, true);
  assert.equal(r.control.armSimulation(['alpha']).armed, true);
  r.control.drainSimulation();
  assert.deepEqual(r.sent, []);
  assert.deepEqual(r.control.getState().ledger, []);

  assert.equal(r.control.queueRecommendations().queued.length, 1);
  assert.equal(r.control.drainSimulation()[0].status, 'SIMULATED_SUBMISSION');
  assert.equal(r.sent[0].actorId, 'alpha');
});
