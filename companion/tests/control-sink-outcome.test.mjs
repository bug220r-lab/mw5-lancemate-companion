// An invoked mock sink can fail after an effect. No native calls or real evidence.
import test from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { ControlSession } from '../control.mjs';
import { baseline } from '../../synthetic/tactical-cases.mjs';

function rig(mockSink, options = {}) {
  let clock = 1000;
  const control = new ControlSession({ mode: 'MOCK_ONLY', now: () => clock, mockSink, ...options });
  function frame(sequence = 1, mutate = () => {}) {
    const snapshot = baseline(); snapshot.sequence = sequence;
    snapshot.nowMs = snapshot.observedAtMs = clock; snapshot.targets[0].observedAtMs = clock;
    mutate(snapshot, snapshot.lancemates[0]);
    return { schemaVersion: 1, kind: 'observation', provenance: 'MOCK_ONLY', adapterId: 'sink_outcome_fixture',
      session: snapshot.session, sequence, observedAtMs: clock, snapshot };
  }
  function submit() {
    assert.equal(control.ingest(frame()).ok, true);
    assert.equal(control.armSimulation(['alpha']).armed, true);
    assert.equal(control.queueRecommendations().queued.length, 1);
    return control.drainSimulation()[0];
  }
  function reobserve(sequence, delta = 2100, mutate = () => {}) {
    clock += delta;
    const observation = frame(sequence, mutate);
    assert.equal(control.ingest(observation).ok, true);
    assert.equal(control.armSimulation([observation.snapshot.lancemates[0].id]).armed, true);
    return control.queueRecommendations();
  }
  return { control, frame, submit, reobserve, tick: delta => { clock += delta; },
    setTime: value => { clock = value; }, now: () => clock };
}

function evidence(r, changes = {}) {
  const entry = r.control.getState().ledger[0];
  return { id: entry.id, session: entry.session, actorId: entry.actorId, binding: entry.binding,
    classification: 'MOCK_ONLY', stage: 'COMPLETED', observedAtMs: r.now(),
    evidence: 'correlated fixture outcome', ...changes };
}

test('sink effect followed by throw cannot be retried through a fresh sequence and rearm', () => {
  const effects = [];
  const r = rig(intent => { effects.push(intent); throw new Error('after possible effect'); });
  const result = r.submit();
  assert.equal(r.control.getState().armed, false);
  const retry = r.reobserve(2);
  assert.equal(retry.queued.length, 0);
  assert.equal(retry.rejected[0].reason, 'UNCONFIRMED_PRIOR_ACTION');
  assert.equal(r.control.drainSimulation().length, 0);
  assert.equal(effects.length, 1);
  assert.equal(result.status, 'UNCONFIRMED');
  assert.equal(result.reason, 'SINK_FAILURE');
  assert.equal(result.nativeAcceptance, 'NOT_PERFORMED');
  assert.deepEqual(r.control.getState().ledger[0].stages.map(s => s.stage), ['SUBMITTED']);
  assert.equal(r.control.getState().ledger[0].stages[0].evidence, 'SIMULATED_SINK_OUTCOME_UNKNOWN');
});

test('unsupported thenable is never assimilated and cannot reopen a possibly effected attempt', async () => {
  const effects = []; let calls = 0; let thenCalls = 0;
  const r = rig(intent => { calls++; effects.push(intent); return {
    then(resolve) { thenCalls++; resolve('settled'); } }; });
  const result = r.submit();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(effects.length, 1);
  const retry = r.reobserve(2);
  assert.equal(retry.queued.length, 0);
  assert.equal(retry.rejected[0].reason, 'UNCONFIRMED_PRIOR_ACTION');
  assert.equal(thenCalls, 0);
  assert.equal(calls, 1);
  assert.equal(result.status, 'UNCONFIRMED');
  assert.equal(r.control.getState().ledger[0].stages.at(-1).stage, 'SUBMITTED');
});

test('an actual rejected Promise is handled while its unsupported outcome stays unconfirmed', async () => {
  let calls = 0;
  const r = rig(() => { calls++; return Promise.reject(new Error('async fixture failure')); });
  const result = r.submit();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(r.reobserve(2).queued.length, 0);
  assert.equal(calls, 1);
  assert.equal(result.status, 'UNCONFIRMED');
  assert.equal(result.nativeAcceptance, 'NOT_PERFORMED');
});

test('a cross-realm rejected Promise is handled without becoming a terminal rejection', async () => {
  let calls = 0;
  const r = rig(() => { calls++; return runInNewContext('Promise.reject(new Error("fixture rejection"))'); });
  const result = r.submit();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(r.reobserve(2).queued.length, 0);
  assert.equal(calls, 1);
  assert.equal(result.status, 'UNCONFIRMED');
  assert.equal(result.nativeAcceptance, 'NOT_PERFORMED');
});

test('native Promise rejection handling does not read its overridden then property', async () => {
  let getterCalls = 0;
  const r = rig(() => Object.defineProperty(Promise.reject(new Error('fixture rejection')), 'then', {
    get() { getterCalls++; throw new Error('must not inspect this override'); } }));
  assert.equal(r.submit().status, 'UNCONFIRMED');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(getterCalls, 0);
  assert.equal(r.reobserve(2).queued.length, 0);
});

test('a throwing then getter cannot turn a possibly effected invocation into a terminal rejection', () => {
  let calls = 0;
  const r = rig(() => { calls++; return Object.defineProperty({}, 'then', {
    get() { throw new Error('cannot inspect outcome'); } }); });
  r.submit();
  assert.equal(r.reobserve(2).queued.length, 0);
  assert.equal(calls, 1);
  assert.equal(r.control.getState().ledger[0].stages.at(-1).stage, 'SUBMITTED');
});

test('wrong, future and regressing result evidence cannot resolve the uncertain attempt', () => {
  const r = rig(() => { throw new Error('unknown outcome'); });
  r.submit();
  for (const changes of [{ actorId: 'bravo' }, { binding: 'other_binding' }, { session: 'other_session' },
    { classification: 'GAME_OBSERVED' }, { observedAtMs: 999 }, { observedAtMs: 1001 }]) {
    assert.equal(r.control.observeSimulatedResult(evidence(r, changes)).status, 'REJECTED');
  }
  assert.equal(r.reobserve(2).queued.length, 0);
  assert.equal(r.control.getState().ledger[0].stages.length, 1);
});

test('a correlated outcome can resolve uncertainty while preserving the dispatch cooldown', () => {
  let calls = 0;
  const r = rig(() => { if (++calls === 1) throw new Error('unknown outcome'); });
  r.submit();
  assert.equal(r.control.observeSimulatedResult(evidence(r, { stage: 'REJECTED' })).recorded, true);
  const early = r.reobserve(2, 1999);
  assert.equal(early.queued.length, 0);
  assert.equal(early.rejected[0].reason, 'ACTION_RATE_LIMIT');
  const boundary = r.reobserve(3, 1);
  assert.equal(boundary.queued.length, 1);
  assert.equal(r.control.drainSimulation()[0].status, 'SIMULATED_SUBMISSION');
  assert.equal(calls, 2);
});

test('correlated completion never releases an active human hold after uncertain submission', () => {
  const r = rig(() => { throw new Error('unknown outcome'); });
  r.submit(); r.tick(2100);
  assert.equal(r.control.ingest(r.frame(2, (s, actor) => { actor.manual = {
    observable: true, revision: 1, orderId: 'human_hold', status: 'active', persistent: true }; })).ok, true);
  assert.equal(r.control.observeSimulatedResult(evidence(r)).recorded, true);
  r.control.armSimulation(['alpha']);
  assert.equal(r.control.queueRecommendations().queued.length, 0);
  assert.equal(r.control.getState().policyState.actors.alpha.heldHumanOrder.id, 'human_hold');
});

test('mission rotation and explicit rearm cannot reset the recipient cooldown', () => {
  const effects = [];
  const r = rig(intent => effects.push(intent));
  r.submit();
  assert.equal(r.control.observeSimulatedResult(evidence(r)).recorded, true);
  const early = r.reobserve(1, 1, s => { s.session = 'mission2'; });
  assert.equal(early.queued.length, 0);
  assert.equal(early.rejected[0].reason, 'ACTION_RATE_LIMIT');
  const boundary = r.reobserve(2, 1999, s => { s.session = 'mission2'; });
  assert.equal(boundary.queued.length, 1);
  assert.equal(r.control.drainSimulation()[0].status, 'SIMULATED_SUBMISSION');
  assert.equal(effects.length, 2);
});

test('a replacement binding in a new mission shares its actor recipient cooldown', () => {
  const r = rig(() => {});
  r.submit();
  assert.equal(r.control.observeSimulatedResult(evidence(r)).recorded, true);
  const early = r.reobserve(1, 1, (s, actor) => {
    s.session = 'mission2'; actor.pawnId = 'replacement_pawn';
    actor.controllerId = 'replacement_controller'; actor.generation = 2;
  });
  assert.equal(early.queued.length, 0);
  assert.equal(early.rejected[0].reason, 'ACTION_RATE_LIMIT');
});

test('disarm and rearm in the current mission preserve the recipient cooldown', () => {
  const r = rig(() => {});
  r.submit();
  assert.equal(r.control.observeSimulatedResult(evidence(r)).recorded, true);
  r.control.disarm();
  const early = r.reobserve(2, 1);
  assert.equal(early.queued.length, 0);
  assert.equal(early.rejected[0].reason, 'ACTION_RATE_LIMIT');
});

test('cooldown history fails closed at capacity without evicting an unexpired recipient', () => {
  const r = rig(() => {}, { maxRemembered: 1 });
  r.submit();
  assert.equal(r.control.observeSimulatedResult(evidence(r)).recorded, true);
  const full = r.reobserve(1, 1, (s, actor) => { s.session = 'mission2'; actor.id = 'bravo'; });
  assert.equal(full.queued.length, 0);
  assert.equal(full.rejected[0].reason, 'COOLDOWN_HISTORY_FULL');
  const stillProtected = r.reobserve(1, 1, s => { s.session = 'mission3'; });
  assert.equal(stillProtected.queued.length, 0);
  assert.equal(stillProtected.rejected[0].reason, 'ACTION_RATE_LIMIT');
  const expired = r.reobserve(1, 1998, (s, actor) => { s.session = 'mission4'; actor.id = 'bravo'; });
  assert.equal(expired.queued.length, 1);
  r.control.drainSimulation();
  const rebound = r.reobserve(1, 1, s => { s.session = 'mission5'; });
  assert.equal(rebound.queued.length, 0);
  assert.equal(rebound.rejected[0].reason, 'COOLDOWN_HISTORY_FULL');
});

test('invalid and regressing clocks cannot prune protected cooldown history', () => {
  for (const invalidClock of [NaN, Infinity, 999]) {
    const r = rig(() => {}, { maxRemembered: 1 });
    r.submit();
    assert.equal(r.control.observeSimulatedResult(evidence(r)).recorded, true);
    r.setTime(invalidClock);
    assert.equal(r.control.queueRecommendations().queued.length, 0);
    r.setTime(1000);
    const full = r.reobserve(1, 1, (s, actor) => { s.session = 'mission2'; actor.id = 'bravo'; });
    assert.equal(full.queued.length, 0);
    assert.equal(full.rejected[0].reason, 'COOLDOWN_HISTORY_FULL');
  }
});

test('a fresh epoch and different recipient cannot hide a clock before the latest dispatch', () => {
  for (const pruneExpiredHistory of [false, true]) {
    const effects = [];
    const r = rig(intent => effects.push(intent));
    r.submit();
    assert.equal(r.control.observeSimulatedResult(evidence(r)).recorded, true);
    if (pruneExpiredHistory) {
      assert.equal(r.reobserve(2, 4000).queued.length, 1);
      r.control.disarm(); // Pruning and queue receipt are not another dispatch.
    }
    r.setTime(999);
    const observation = r.frame(1, (s, actor) => { s.session = 'mission2'; actor.id = 'bravo'; });
    assert.equal(r.control.ingest(observation).ok, true);
    assert.equal(r.control.armSimulation(['bravo']).armed, true);
    const invalidClock = r.control.queueRecommendations();
    assert.equal(invalidClock.queued.length, 0);
    assert.equal(invalidClock.rejected[0].reason, 'EXPIRED_OR_INVALID_CLOCK');
    assert.equal(r.control.drainSimulation().length, 0);
    assert.equal(effects.length, 1);
  }
});

test('an uncertain invocation charges cooldown from the captured time before the sink runs', () => {
  let calls = 0;
  const r = rig(() => { if (++calls === 1) { r.tick(500); throw new Error('possible effect'); } });
  r.submit();
  assert.equal(r.control.getState().ledger[0].stages[0].observedAtMs, 1000);
  assert.equal(r.control.observeSimulatedResult(evidence(r, { stage: 'REJECTED' })).recorded, true);
  const early = r.reobserve(1, 1499, s => { s.session = 'mission2'; });
  assert.equal(early.queued.length, 0);
  assert.equal(early.rejected[0].reason, 'ACTION_RATE_LIMIT');
  const boundary = r.reobserve(2, 1, s => { s.session = 'mission2'; });
  assert.equal(boundary.queued.length, 1);
  assert.equal(r.control.drainSimulation()[0].status, 'SIMULATED_SUBMISSION');
  assert.equal(calls, 2);
});
