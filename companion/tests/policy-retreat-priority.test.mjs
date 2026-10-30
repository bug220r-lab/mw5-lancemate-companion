// MOCK_ONLY: supplied geometry and observations; no game, transport or dispatch.
import test from 'node:test';
import assert from 'node:assert/strict';
import { decideSquad, LIMITS } from '../../scripts/tactical-policy.mjs';
import { baseline } from '../../synthetic/tactical-cases.mjs';
import { validateObservation } from '../observation.mjs';

const byActor = output => Object.fromEntries(output.recommendations.map(row => [row.actorId, row]));
const own = output => assert.ok(output.recommendations.every(row => row.dispatchable === false));
function contested() {
  const s = baseline(), template = s.lancemates[0];
  s.lancemates = ['alpha', 'bravo', 'charlie'].map((id, index) => ({ ...structuredClone(template), id,
    pawnId: `pawn${index + 1}`, controllerId: `controller${index + 1}` }));
  s.lancemates[0].weaponRangeM.max = 150;
  s.lancemates[0].positions = [{ id: 'only_safe_spot', pathFeasible: true, occupied: false,
    saferThanCurrent: false, targetId: 'enemy1', distanceToTargetM: 100, lineOfFireKnownClear: true }];
  s.lancemates[1].healthFraction = .2; s.lancemates[1].safeRegroupKnown = false;
  s.lancemates[1].positions = [{ ...s.lancemates[0].positions[0], saferThanCurrent: true }];
  s.lancemates[2].heatFraction = .95; return s;
}
function validated(s) {
  const admitted = validateObservation({ schemaVersion: 1, kind: 'observation', adapterId: 'offline_workbench',
    provenance: 'MOCK_ONLY', session: s.session, sequence: s.sequence,
    observedAtMs: s.observedAtMs, snapshot: s }, { nowMs: s.nowMs, allowSynthetic: true });
  assert.equal(admitted.ok, true, JSON.stringify(admitted.errors)); return admitted.snapshot;
}
function advance(s) {
  const next = structuredClone(s); next.sequence++; next.observedAtMs += 100; next.nowMs = next.observedAtMs;
  next.targets.forEach(target => { target.observedAtMs = next.observedAtMs; }); return next;
}
function freeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}

test('a verified critical retreat gets a contested location before an offensive range move', () => {
  const output = decideSquad(validated(contested())), rows = byActor(output);
  assert.equal(rows.bravo.action, 'REPOSITION'); assert.equal(rows.bravo.reason, 'PROTECT_DAMAGED_MECH');
  assert.equal(rows.bravo.positionId, 'only_safe_spot');
  assert.equal(rows.alpha.action, 'MAINTAIN'); assert.equal(rows.alpha.positionId, undefined);
  assert.equal(rows.charlie.reason, 'ALLOW_NATIVE_COOLING'); own(output);
  assert.deepEqual(output.recommendations.map(row => row.actorId), ['alpha', 'bravo', 'charlie']);
});

test('all caller member permutations preserve the critical reservation and public identity order', () => {
  const snapshot = contested(), expected = decideSquad(validated(snapshot));
  for (const permutation of [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]]) {
    const input = structuredClone(snapshot); input.lancemates = permutation.map(index => input.lancemates[index]);
    const actual = decideSquad(validated(input));
    assert.deepEqual(actual.recommendations, expected.recommendations);
    assert.equal(byActor(actual).bravo.positionId, 'only_safe_spot'); own(actual);
  }
});

test('critical ties retain stable actor identity priority rather than caller order or new severity scores', () => {
  const snapshot = contested(); snapshot.lancemates[0].healthFraction = .2;
  snapshot.lancemates[0].safeRegroupKnown = false;
  snapshot.lancemates[0].positions[0].saferThanCurrent = true;
  for (const order of [[0, 1, 2], [1, 0, 2], [2, 1, 0]]) {
    const input = structuredClone(snapshot); input.lancemates = order.map(index => input.lancemates[index]);
    const output = decideSquad(validated(input)), rows = byActor(output);
    assert.equal(rows.alpha.reason, 'PROTECT_DAMAGED_MECH'); assert.equal(rows.alpha.positionId, 'only_safe_spot');
    assert.equal(rows.bravo.action, 'MAINTAIN'); assert.equal(rows.bravo.reason, 'NO_VERIFIED_SAFE_RETREAT');
    assert.deepEqual(output.recommendations.map(row => row.actorId), ['alpha', 'bravo', 'charlie']); own(output);
  }
});

test('the existing critical-health boundary controls priority without broadening it', () => {
  for (const health of [0, LIMITS.criticalHealth]) {
    const snapshot = contested(); snapshot.lancemates[1].healthFraction = health;
    assert.equal(byActor(decideSquad(validated(snapshot))).bravo.reason, 'PROTECT_DAMAGED_MECH');
  }
  const healthy = contested(); healthy.lancemates[1].healthFraction = LIMITS.criticalHealth + .000001;
  const output = decideSquad(validated(healthy));
  assert.equal(byActor(output).alpha.reason, 'REACH_USEFUL_WEAPON_RANGE');
  assert.equal(byActor(output).alpha.positionId, 'only_safe_spot');
  assert.notEqual(byActor(output).bravo.reason, 'PROTECT_DAMAGED_MECH');
});

for (const [label, change, expectedAction, expectedReason] of [
  ['active human order', actor => { actor.manual = { observable: true, revision: 1,
    orderId: 'human-bravo', status: 'active', persistent: true }; }, 'MAINTAIN', 'HUMAN_ORDER_ACTIVE'],
  ['unobserved human orders', actor => { actor.manual.observable = false; }, 'DEFER', 'UNKNOWN_MANUAL_ORDER'],
  ['human possession', actor => { actor.aiOwned = false; }, 'DEFER', 'INVALID_OR_HUMAN_BINDING'],
  ['unknown individual authority', actor => { actor.authority = null; }, 'DEFER', 'INVALID_OR_HUMAN_BINDING'],
  ['missing reposition capability', actor => { actor.capabilities = ['focus', 'regroup']; }, 'MAINTAIN', 'NO_VERIFIED_SAFE_RETREAT'],
  ['unknown retreat path', actor => { actor.positions[0].pathFeasible = null; }, 'MAINTAIN', 'NO_VERIFIED_SAFE_RETREAT'],
  ['occupied retreat', actor => { actor.positions[0].occupied = true; }, 'MAINTAIN', 'NO_VERIFIED_SAFE_RETREAT'],
  ['no safer-location evidence', actor => { actor.positions[0].saferThanCurrent = false; }, 'MAINTAIN', 'NO_VERIFIED_SAFE_RETREAT'],
  ['incomplete tactical observation', actor => { actor.heatFraction = null; }, 'DEFER', 'INCOMPLETE_TACTICAL_OBSERVATION'],
  ['contradictory candidate records', actor => { actor.positions.push({ ...actor.positions[0] }); }, 'DEFER', 'AMBIGUOUS_TACTICAL_OBSERVATION']
]) test(`critical actor cannot reserve ahead of a healthy actor with ${label}`, () => {
  const snapshot = contested(); change(snapshot.lancemates[1]);
  const output = decideSquad(snapshot), rows = byActor(output);
  assert.equal(rows.bravo.action, expectedAction); assert.equal(rows.bravo.reason, expectedReason);
  assert.equal(rows.bravo.positionId, undefined);
  assert.equal(rows.alpha.action, 'REPOSITION'); assert.equal(rows.alpha.positionId, 'only_safe_spot'); own(output);
});

test('changed critical binding must be reobserved before it can claim a retreat', () => {
  const first = contested(); first.lancemates[1].healthFraction = 1;
  const prior = decideSquad(validated(first));
  const changed = advance(contested()); changed.lancemates[1].pawnId = 'replacement-bravo';
  changed.lancemates[1].generation = 2;
  const blocked = decideSquad(changed, prior.state), rows = byActor(blocked);
  assert.equal(rows.bravo.reason, 'BINDING_CHANGED_REOBSERVE');
  assert.equal(rows.alpha.positionId, 'only_safe_spot');
  const fresh = decideSquad(advance(changed), blocked.state);
  assert.equal(byActor(fresh).bravo.reason, 'PROTECT_DAMAGED_MECH');
  assert.equal(byActor(fresh).bravo.positionId, 'only_safe_spot'); own(fresh);
});

test('an unresolved retained human hold wins until matching explicit release', () => {
  const first = contested(); first.lancemates[1].manual = { observable: true, revision: 1,
    orderId: 'held-bravo', status: 'active', persistent: true };
  const prior = decideSquad(first), next = advance(contested()); next.lancemates[1].manual.revision = 1;
  const held = decideSquad(next, prior.state);
  assert.equal(byActor(held).bravo.reason, 'HUMAN_ORDER_NOT_RELEASED');
  assert.equal(byActor(held).alpha.positionId, 'only_safe_spot');
  const released = advance(next); released.lancemates[1].manual = { observable: true, revision: 2,
    orderId: 'held-bravo', status: 'released', persistent: true };
  const output = decideSquad(released, held.state);
  assert.equal(byActor(output).bravo.reason, 'PROTECT_DAMAGED_MECH');
  assert.equal(byActor(output).bravo.positionId, 'only_safe_spot'); own(output);
});

test('reservation priority keeps frozen caller input and prior state unchanged', () => {
  const snapshot = freeze(contested()), before = JSON.stringify(snapshot);
  const first = decideSquad(snapshot), prior = freeze(first.state), priorBytes = JSON.stringify(prior);
  const next = freeze(advance(snapshot));
  const output = decideSquad(next, prior);
  assert.deepEqual(output, decideSquad(next, prior));
  assert.equal(JSON.stringify(snapshot), before); assert.equal(JSON.stringify(prior), priorBytes);
  assert.equal(byActor(output).bravo.positionId, 'only_safe_spot');
  assert.equal(new Set(output.recommendations.filter(row => row.action === 'REPOSITION').map(row => row.positionId)).size, 1);
  own(output);
});
