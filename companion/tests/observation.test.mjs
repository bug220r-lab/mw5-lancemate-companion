import test from 'node:test';
import assert from 'node:assert/strict';
import { OBSERVATION_LIMITS, validateObservation, replayFrames } from '../observation.mjs';
import { baseline } from '../../synthetic/tactical-cases.mjs';

function frame(change) {
  const snapshot = baseline();
  const f = { schemaVersion: 1, kind: 'observation', provenance: 'MOCK_ONLY',
    adapterId: 'fixture-adapter', session: snapshot.session, sequence: snapshot.sequence,
    observedAtMs: snapshot.observedAtMs, snapshot };
  change?.(f, snapshot, snapshot.lancemates[0]);
  return f;
}
function next(f, change) {
  const g = structuredClone(f); g.sequence++;
  g.observedAtMs += 100; g.snapshot.sequence = g.sequence;
  g.snapshot.observedAtMs = g.observedAtMs;
  g.snapshot.targets?.forEach(t => { t.observedAtMs = g.observedAtMs; });
  change?.(g, g.snapshot, g.snapshot.lancemates[0]);
  return g;
}
const validate = (f, extra = {}) => validateObservation(f,
  { nowMs: f.observedAtMs, allowSynthetic: true, ...extra });
const manual = (a, status, { persistent = true, revision = 1, orderId = 'manual1' } = {}) => {
  a.manual = { observable: true, revision, orderId, status, persistent };
};
const reason = step => step.decision.recommendations[0].reason;
const action = step => step.decision.recommendations[0].action;
function freeze(x) {
  if (x && typeof x === 'object') { Object.values(x).forEach(freeze); Object.freeze(x); }
  return x;
}

test('synthetic records require explicit opt-in and game claims remain unvalidated', () => {
  assert.equal(validateObservation(frame(), { nowMs: 1000 }).ok, false);
  const game = frame(f => { f.provenance = 'GAME_OBSERVED'; });
  const r = validateObservation(game, { nowMs: 1000 });
  assert.equal(r.ok, true);
  assert.equal(r.classification, 'GAME_OBSERVED_UNVALIDATED');
  assert.equal(replayFrames([game]).classification, 'REAL_OBSERVATION_REPLAY_UNVALIDATED');
  assert.equal(replayFrames([game]).results[0].decision.recommendations[0].dispatchable, false);
});

test('provenance, kind, adapter and snapshot-envelope consistency are mandatory', () => {
  for (const mutate of [f => delete f.provenance, f => { f.provenance = 'verified'; },
    f => { f.kind = 'command'; }, f => { f.adapterId = ' '; },
    f => { f.snapshot.sequence++; }, f => { f.snapshot.session = 'other'; },
    f => { f.snapshot.observedAtMs++; }, f => { f.snapshot.schemaVersion = 2; }]) {
    const r = validate(frame(mutate));
    assert.equal(r.ok, false); assert.equal(r.snapshot, null);
  }
});

test('caller clock overrides a falsely fresh packet clock', () => {
  const f = frame((f, s) => { s.nowMs = 9_000_000; });
  assert.equal(validate(f, { nowMs: 1001 }).snapshot.nowMs, 1001);
  assert.equal(validate(f, { nowMs: 2001 }).snapshot, null);
  assert.equal(validate(f, { nowMs: 2000 }).ok, true);
  assert.equal(validate(f, { nowMs: 999 }).snapshot, null);
  assert.equal(validateObservation(f, { allowSynthetic: true }).ok, false);
});

test('duplicate member IDs and aliased pawn/controller identities are rejected', () => {
  const duplicate = frame((f, s, a) => { s.lancemates.push(structuredClone(a)); });
  assert.equal(validate(duplicate).snapshot, null);
  for (const alias of ['pawnId', 'controllerId']) {
    const f = frame((f, s, a) => s.lancemates.push({ ...structuredClone(a),
      id: 'bravo', pawnId: alias === 'pawnId' ? a.pawnId : 'pawn2',
      controllerId: alias === 'controllerId' ? a.controllerId : 'controller2' }));
    const r = validate(f);
    assert.equal(r.ok, false); assert.ok(r.errors.includes('ALIASED_MEMBER_IDENTITY'));
  }
});

test('all binding and authority assertions fail closed', () => {
  for (const flag of ['member', 'reciprocalBinding', 'aiOwned', 'alive', 'configured', 'authority']) {
    assert.equal(validate(frame((f, s, a) => { a[flag] = null; })).ok, false, flag);
  }
  assert.equal(validate(frame((f, s) => { s.authority = null; })).ok, false);
  assert.equal(validate(frame((f, s, a) => { a.pawnId = s.leader.pawnId; })).ok, false);
  assert.equal(validate(frame((f, s, a) => { a.generation = 0; })).ok, false);
});

test('contradictory target and candidate records cannot supply the favorable duplicate', () => {
  const target = frame((f, s) => { s.targets.push({ ...s.targets[0], visibleToLance: false }); });
  const engagement = frame((f, s, a) => { a.engagements.push({ ...a.engagements[0], lineOfFireKnownClear: false }); });
  const position = frame((f, s, a) => { a.positions = [{ id: 'same', pathFeasible: true }, { id: 'same', pathFeasible: false }]; });
  for (const f of [target, engagement, position]) {
    assert.equal(validate(f).ok, false);
    assert.equal(action(replayFrames([f], { allowSynthetic: true }).results[0]), 'DEFER');
  }
});

test('binding changes need a new generation and policy reobservation', () => {
  const a = frame();
  const bad = next(a, (f, s, m) => { m.pawnId = 'replacement'; });
  assert.ok(validate(bad, { previousFrame: a }).errors.includes('INVALID_BINDING_GENERATION:alpha'));
  const b = next(a, (f, s, m) => { m.pawnId = 'replacement'; m.generation++; });
  const c = next(b);
  const replay = replayFrames([a, b, c], { allowSynthetic: true });
  assert.deepEqual(replay.results.map(action), ['FOCUS', 'DEFER', 'FOCUS']);
  assert.equal(reason(replay.results[1]), 'BINDING_CHANGED_REOBSERVE');
});

test('unknown tactical observations remain null instead of invented values', () => {
  const f = frame((f, s, a) => { delete a.healthFraction; delete a.heatFraction;
    delete a.ammoAvailable; delete a.safeRegroupKnown; delete a.engagements[0].lineOfFireKnownClear;
    a.positions = [{ id: 'position1' }]; s.targets[0].visibleToLance = null; });
  const r = validate(f); assert.equal(r.ok, true);
  const a = r.snapshot.lancemates[0];
  assert.equal(a.healthFraction, null); assert.equal(a.heatFraction, null);
  assert.equal(a.ammoAvailable, null); assert.equal(a.safeRegroupKnown, null);
  assert.equal(a.engagements[0].lineOfFireKnownClear, null);
  assert.equal(a.positions[0].pathFeasible, null);
  assert.equal(action(replayFrames([f], { allowSynthetic: true }).results[0]), 'DEFER');
});

test('replay uses historical recorded clocks, with no wall-clock freshness fiction', () => {
  const a = frame(); const b = next(a);
  const r = replayFrames([a, b], { allowSynthetic: true });
  assert.equal(r.errors.length, 0);
  assert.equal(r.results[0].decision.state.nowMs, 1000);
  assert.equal(r.results[1].decision.state.nowMs, 1100);
  const stale = next(b, f => { f.replayNowMs = f.observedAtMs + 1001; });
  assert.equal(replayFrames([a, b, stale], { allowSynthetic: true }).results[2].decision, null);
});

test('sequence, observation-time and replay-clock regressions do not advance policy state', () => {
  const a = frame(f => { f.replayNowMs = 1200; });
  const repeated = structuredClone(a);
  const clockBack = next(a, f => { f.replayNowMs = 1100; });
  const olderSample = next(a, (f, s) => { f.observedAtMs = s.observedAtMs = 999; f.replayNowMs = 1201; });
  const good = next(a, f => { f.replayNowMs = 1300; });
  const r = replayFrames([a, repeated, clockBack, olderSample, good], { allowSynthetic: true });
  assert.equal(r.results[1].decision, null); assert.equal(r.results[2].decision, null);
  assert.equal(r.results[3].decision, null); assert.equal(r.results[4].accepted, true);
  assert.equal(r.results[4].decision.state.sequence, 2);
});

test('a stale release cannot clear a persistent human hold', () => {
  const a = frame((f, s, m) => manual(m, 'active'));
  const stale = next(a, (f, s, m) => { manual(m, 'released'); f.replayNowMs = 9999; });
  const noOrder = next(stale, (f, s, m) => { delete f.replayNowMs;
    m.manual = { observable: true, revision: 1, orderId: null, status: 'none', persistent: false }; });
  const r = replayFrames([a, stale, noOrder], { allowSynthetic: true });
  assert.equal(reason(r.results[0]), 'HUMAN_ORDER_ACTIVE');
  assert.equal(r.results[1].decision, null);
  assert.equal(reason(r.results[2]), 'HUMAN_ORDER_NOT_RELEASED');
});

test('fresh active human orders latch while paused; rejected release cannot clear them', () => {
  const paused = frame((f, s, m) => { s.phase = 'paused'; manual(m, 'active'); });
  const rejectedRelease = next(paused, (f, s, m) => { s.phase = 'active'; s.authority = null; manual(m, 'released'); });
  const resumed = next(rejectedRelease, (f, s, m) => { s.authority = true;
    m.manual = { observable: true, revision: 1, orderId: null, status: 'none', persistent: false }; });
  const release = next(resumed, (f, s, m) => manual(m, 'released'));
  const r = replayFrames([paused, rejectedRelease, resumed, release], { allowSynthetic: true });
  assert.deepEqual(r.results.map(action), ['DEFER', 'DEFER', 'DEFER', 'FOCUS']);
  assert.equal(reason(r.results[2]), 'HUMAN_ORDER_NOT_RELEASED');
});

test('holds survive member absence and persistent completion', () => {
  const a = frame((f, s, m) => manual(m, 'active'));
  const absent = next(a, (f, s, m) => { m.id = 'bravo'; m.pawnId = 'pawn2'; m.controllerId = 'controller2';
    m.manual = baseline().lancemates[0].manual; });
  const returned = next(a, (f, s, m) => { f.sequence = s.sequence = 3; f.observedAtMs = s.observedAtMs = 1200;
    manual(m, 'completed'); });
  const r = replayFrames([a, absent, returned], { allowSynthetic: true });
  assert.equal(reason(r.results[2]), 'HUMAN_ORDER_NOT_RELEASED');
});

test('new session resets mission holds but a retired session cannot be replayed', () => {
  const a = frame((f, s, m) => manual(m, 'active'));
  const b = frame((f, s) => { f.session = s.session = 'mission2'; });
  const retired = next(a);
  const r = replayFrames([a, b, retired], { allowSynthetic: true });
  assert.equal(action(r.results[1]), 'FOCUS');
  assert.equal(r.results[2].decision, null);
  assert.ok(r.errors[0].errors.includes('RETIRED_SESSION_REPLAY'));
});

test('changing adapter/provenance within a session rejects continuity', () => {
  const a = frame();
  for (const mutate of [f => { f.adapterId = 'replacement'; }, f => { f.provenance = 'GAME_OBSERVED'; }]) {
    const r = validate(next(a, mutate), { previousFrame: a });
    assert.equal(r.snapshot, null); assert.ok(r.errors.includes('OBSERVATION_STREAM_CHANGED'));
  }
});

test('hidden observations cannot influence tactical outcomes', () => {
  const a = frame((f, s) => { s.targets[0].knownToLance = false; });
  const b = structuredClone(a); b.snapshot.targets[0].threat = 0;
  b.snapshot.targets[0].hiddenPosition = { x: 500000, y: -99999, z: 20 };
  const x = replayFrames([a], { allowSynthetic: true });
  const y = replayFrames([b], { allowSynthetic: true });
  assert.deepEqual(x.results[0].decision, y.results[0].decision);
  assert.equal(action(x.results[0]), 'MAINTAIN');
});

test('validation and replay do not mutate frozen inputs and return detached snapshots', () => {
  const a = freeze(frame()); const before = structuredClone(a);
  const r = validate(a); r.snapshot.lancemates[0].healthFraction = 0;
  const output = replayFrames(freeze([a]), { allowSynthetic: true });
  assert.equal(output.results[0].decision.recommendations[0].action, 'FOCUS');
  assert.deepEqual(a, before);
});

test('malformed/cyclic/executable records reject without running accessors or throwing', () => {
  let reads = 0;
  const getter = frame(); Object.defineProperty(getter, 'exploit', { enumerable: true, get() { reads++; return true; } });
  const cycle = frame(); cycle.loop = cycle;
  const nonfinite = frame((f, s, a) => { a.healthFraction = NaN; });
  const malformed = [null, 42, [], {}, cycle, getter, nonfinite, frame(f => { f.extra = () => 1; })];
  for (const f of malformed) assert.equal(validateObservation(f, { nowMs: 1000, allowSynthetic: true }).ok, false);
  assert.equal(reads, 0);
  const r = replayFrames(malformed, { allowSynthetic: true });
  assert.equal(r.errors.length, malformed.length); assert.equal(reads, 0);
  assert.equal(replayFrames(null).errors[0].errors[0], 'INVALID_FRAME_LIST');
});

test('all replay outputs remain non-dispatchable irrespective of asserted provenance', () => {
  for (const provenance of ['MOCK_ONLY', 'GAME_OBSERVED']) {
    const a = frame(f => { f.provenance = provenance; });
    const b = next(a, (f, s, m) => { m.healthFraction = 0.1; });
    const r = replayFrames([a, b], { allowSynthetic: true });
    for (const step of r.results) for (const recommendation of step.decision.recommendations)
      assert.equal(recommendation.dispatchable, false);
  }
});

test('continuity is detached and rejected bindings cannot replace accepted watermarks', () => {
  const a = frame((f, s, m) => { m.generation = 5; });
  const first = validate(a); const history = freeze(first.nextContinuity);
  const bad = next(a, (f, s, m) => { m.generation = 1; m.pawnId = 'wrong'; });
  const rejected = validate(bad, { previousFrame: a, continuity: history });
  assert.equal(rejected.ok, false); assert.deepEqual(rejected.nextContinuity, history);
  rejected.nextContinuity.actors[0].generation = 123;
  assert.equal(history.actors[0].generation, 5);
  const repeat = validate(next(bad), { previousFrame: bad, continuity: history });
  assert.equal(repeat.ok, false); assert.ok(repeat.errors.includes('INVALID_BINDING_GENERATION:alpha'));
  const good = next(bad, (f, s, m) => { m.generation = 6; m.pawnId = 'replacement'; });
  const accepted = validate(good, { previousFrame: bad, continuity: history });
  assert.equal(accepted.ok, true); assert.equal(accepted.nextContinuity.actors[0].generation, 6);
  assert.equal(history.actors[0].generation, 5);
});

test('either historical pawn or controller ownership blocks a renamed logical member', () => {
  const a = frame(); const history = validate(a).nextContinuity;
  for (const alias of ['pawnId', 'controllerId']) {
    const b = next(a, (f, s, m) => { m.id = 'bravo'; m.generation = 10;
      if (alias === 'pawnId') m.controllerId = 'controller2'; else m.pawnId = 'pawn2'; });
    const r = validate(b, { previousFrame: a, continuity: history });
    assert.equal(r.ok, false); assert.ok(r.errors.includes('BINDING_OWNER_CHANGED:bravo'));
    assert.deepEqual(r.nextContinuity, history);
  }
});

test('binding history fills a finite budget and fails closed without erasing old claims', () => {
  let prior = null, history = null, last;
  for (let n = 1; n <= OBSERVATION_LIMITS.bindingClaimsPerKind; n++) {
    const f = frame((f, s, m) => { f.sequence = s.sequence = n; m.generation = n; m.pawnId = `pawn_${n}`; });
    last = validate(f, { previousFrame: prior, continuity: history });
    assert.equal(last.ok, true); prior = f; history = last.nextContinuity;
  }
  const full = freeze(history);
  const extra = next(prior, (f, s, m) => { m.generation++; m.pawnId = 'over_capacity'; });
  const rejected = validate(extra, { previousFrame: prior, continuity: full });
  assert.equal(rejected.ok, false); assert.ok(rejected.errors.includes('CONTINUITY_CAPACITY'));
  assert.deepEqual(rejected.nextContinuity, full);
  assert.equal(full.pawnClaims[0].bindingId, 'pawn_1');
  const replacementMission = frame((f, s) => { f.session = s.session = 'fresh_mission'; });
  const reset = validate(replacementMission, { previousFrame: prior, continuity: full });
  assert.equal(reset.ok, true); assert.equal(reset.nextContinuity.pawnClaims.length, 1);
});

test('malformed continuity rejects safely and supplied unknown derived time is not refreshed', () => {
  const a = frame(); let reads = 0;
  const history = validate(a).nextContinuity;
  const invalid = structuredClone(history); invalid.pawnClaims[0].actorId = 'unknown';
  assert.equal(validate(a, { continuity: invalid }).snapshot, null);
  Object.defineProperty(history, 'extra', { enumerable: true, get() { reads++; return true; } });
  assert.equal(validate(a, { continuity: history }).snapshot, null); assert.equal(reads, 0);
  const unknown = frame((f, s, m) => { m.engagements[0].observedAtMs = null; });
  const r = validate(unknown); assert.equal(r.ok, false);
  assert.equal(r.snapshot.lancemates[0].engagements[0].observedAtMs, null);
});
