import test from 'node:test';
import assert from 'node:assert/strict';
import { ControlSession } from '../control.mjs';
import { baseline } from '../../synthetic/tactical-cases.mjs';
function rig(options = {}) {
  let time = 1000; const sent = [];
  const control = new ControlSession({ mode: 'MOCK_ONLY', now: () => time, mockSink: x => sent.push(x), ...options });
  const frame = (fn = () => {}) => { const s = baseline(); s.nowMs = time; s.observedAtMs = time;
    s.targets[0].observedAtMs = time; fn(s); return { schemaVersion: 1, kind: 'observation', provenance: 'MOCK_ONLY',
      adapterId: 'fixture', session: s.session, sequence: s.sequence, observedAtMs: s.observedAtMs, snapshot: s }; };
  return { control, sent, frame, tick: n => { time += n; } };
}
test('default session is disconnected and cannot arm', () => {
  const c = new ControlSession(); assert.equal(c.armSimulation(['alpha']).status, 'REJECTED');
  assert.equal(c.getState().nativeAdapter, 'NOT_BUILT');
  assert.throws(() => new ControlSession({ mode: 'LIVE' }), /UNAVAILABLE/);
});
test('synthetic records cannot enter the default disconnected mode', () => {
  const r = rig(); const c = new ControlSession({ now: () => 1000 });
  assert.equal(c.ingest(r.frame()).ok, false); assert.equal(c.queueRecommendations().queued.length, 0);
});
test('only explicitly armed simulation submits; submission proves no acceptance', () => {
  const r = rig(); assert.equal(r.control.ingest(r.frame()).ok, true);
  assert.equal(r.control.queueRecommendations().queued.length, 0);
  r.control.armSimulation(['alpha']); assert.equal(r.control.queueRecommendations().queued.length, 1);
  const out = r.control.drainSimulation(); assert.equal(out[0].status, 'SIMULATED_SUBMISSION');
  assert.equal(out[0].nativeAcceptance, 'NOT_PERFORMED'); assert.equal(r.sent.length, 1);
  assert.equal(r.sent[0].dispatchable, false);
});
test('repeat recommendations do not repeat a simulated submission', () => {
  const r = rig(); r.control.ingest(r.frame()); r.control.armSimulation(['alpha']);
  r.control.queueRecommendations(); r.control.queueRecommendations(); r.control.drainSimulation();
  r.control.queueRecommendations(); r.control.drainSimulation(); assert.equal(r.sent.length, 1);
});
test('expired intent cannot reach simulated sink', () => {
  const r = rig(); r.control.ingest(r.frame()); r.control.armSimulation(['alpha']); r.control.queueRecommendations();
  r.tick(500); assert.equal(r.control.drainSimulation()[0].status, 'REJECTED'); assert.equal(r.sent.length, 0);
});
test('human order supersedes queued intent and cannot be cleared by missing order', () => {
  const r = rig(); r.control.ingest(r.frame()); r.control.armSimulation(['alpha']); r.control.queueRecommendations();
  r.tick(10); r.control.ingest(r.frame(s => { s.sequence = 2; s.lancemates[0].manual =
    { observable: true, revision: 1, status: 'active', persistent: true, orderId: 'hold' }; }));
  r.control.queueRecommendations(); r.control.drainSimulation(); assert.equal(r.sent.length, 0);
  r.tick(10); r.control.ingest(r.frame(s => { s.sequence = 3; s.lancemates[0].manual.revision = 1; }));
  assert.equal(r.control.getState().policyState.actors.alpha.heldHumanOrder.id, 'hold');
  assert.equal(r.control.queueRecommendations().queued.length, 0);
});
test('pause, possession and invalid authority discard queue', () => {
  for (const mutation of [s => s.phase = 'paused', s => s.lancemates[0].aiOwned = false, s => s.authority = null]) {
    const r = rig(); r.control.ingest(r.frame()); r.control.armSimulation(['alpha']); r.control.queueRecommendations();
    r.tick(10); r.control.ingest(r.frame(s => { s.sequence = 2; mutation(s); }));
    assert.equal(r.control.drainSimulation().length, 0); assert.equal(r.sent.length, 0);
    assert.equal(r.control.getState().armed, false);
  }
});
test('new mission retires old epoch; late old frames cannot reactivate it', () => {
  const r = rig(); r.control.ingest(r.frame()); r.tick(10);
  r.control.ingest(r.frame(s => s.session = 'mission2'));
  const late = r.control.ingest(r.frame(s => s.sequence = 3));
  assert(late.errors.includes('RETIRED_SESSION')); assert.equal(r.control.getState().session, 'mission2');
});
test('disarm discards work and does not synthesize native cancellation', () => {
  const r = rig(); r.control.ingest(r.frame()); r.control.armSimulation(['alpha']); r.control.queueRecommendations();
  assert.equal(r.control.disarm().discarded.length, 1); r.control.drainSimulation(); assert.equal(r.sent.length, 0);
});
test('sink failure disarms and cannot retry same command', () => {
  const r = rig({ mockSink: () => { throw new Error('failure'); } });
  r.control.ingest(r.frame()); r.control.armSimulation(['alpha']); r.control.queueRecommendations();
  assert.equal(r.control.drainSimulation()[0].reason, 'SINK_FAILURE');
  assert.equal(r.control.getState().armed, false); r.control.armSimulation(['alpha']);
  assert.equal(r.control.queueRecommendations().queued.length, 0);
});
test('evidence correlates command, session, recipient, binding and time', () => {
  const r = rig(); r.control.ingest(r.frame()); r.control.armSimulation(['alpha']); r.control.queueRecommendations();
  r.control.drainSimulation(); const entry = r.control.getState().ledger[0];
  const event = { ...entry, classification: 'MOCK_ONLY', stage: 'ASSIGNED', observedAtMs: 1000, evidence: 'fixture job' };
  assert.equal(r.control.observeSimulatedResult({ ...event, actorId: 'bravo' }).status, 'REJECTED');
  assert.equal(r.control.observeSimulatedResult({ ...event, classification: 'GAME_OBSERVED' }).status, 'REJECTED');
  assert.equal(r.control.observeSimulatedResult(event).recorded, true);
  assert.equal(r.control.getState().ledger[0].stages.length, 2);
});
test('readback cannot mutate internal state or forge recommendation', () => {
  const r = rig(); r.control.ingest(r.frame()); const s = r.control.getState();
  s.recommendations[0].targetId = 'forged'; s.capabilities[0].enabled = true;
  assert.notEqual(r.control.getState().recommendations[0].targetId, 'forged');
  assert(r.control.getState().capabilities.every(c => !c.enabled));
});
test('queue budget is bounded independently of recommendations', () => {
  const r = rig({ maxPending: 1 }); const f = r.frame(s => { const a = s.lancemates[0];
    s.lancemates.push({ ...structuredClone(a), id: 'bravo', pawnId: 'pawn2', controllerId: 'controller2' }); });
  r.control.ingest(f); r.control.armSimulation(['alpha', 'bravo']);
  const q = r.control.queueRecommendations(); assert.equal(q.queued.length, 1); assert(q.rejected.some(x => x.reason === 'QUEUE_FULL'));
});

test('malformed session getters never execute before validation', () => {
  const r = rig(); let calls = 0; const f = r.frame();
  Object.defineProperty(f, 'session', { enumerable: true, get() { calls++; throw new Error('EXECUTED'); } });
  assert.equal(r.control.ingest(f).ok, false); assert.equal(calls, 0);
});

test('fresh sequences cannot retry an unconfirmed prior action', () => {
  const r = rig(); r.control.ingest(r.frame()); r.control.armSimulation(['alpha']);
  r.control.queueRecommendations(); r.control.drainSimulation(); r.tick(2100);
  r.control.ingest(r.frame(s => s.sequence = 2));
  assert.equal(r.control.queueRecommendations().queued.length, 0); assert.equal(r.sent.length, 1);
});

test('bounded history rejects new IDs without forgetting earlier evidence', () => {
  const r = rig({ maxRemembered: 1 }); r.control.ingest(r.frame()); r.control.armSimulation(['alpha']);
  r.control.queueRecommendations(); r.control.drainSimulation(); const entry = r.control.getState().ledger[0];
  r.control.observeSimulatedResult({ ...entry, stage: 'COMPLETED', observedAtMs: 1000, evidence: 'fixture completion' });
  r.tick(2100); r.control.ingest(r.frame(s => s.sequence = 2)); const output = r.control.queueRecommendations();
  assert.equal(output.queued.length, 0); assert(output.rejected.some(x => x.reason === 'HISTORY_FULL'));
  assert.equal(r.control.getState().ledger.length, 1);
});

test('bounded mission history stops accepting new missions without reviving retired ones', () => {
  const r = rig({ maxSessions: 1 }); r.control.ingest(r.frame()); r.tick(1);
  r.control.ingest(r.frame(s => s.session = 'mission2')); r.tick(1);
  assert(r.control.ingest(r.frame(s => s.session = 'mission3')).errors.includes('SESSION_HISTORY_FULL_RESTART_REQUIRED'));
  assert.equal(r.control.getState().armed, false);
  assert(r.control.ingest(r.frame()).errors.includes('RETIRED_SESSION'));
  assert.equal(r.control.getState().recommendations.length, 0);
});
