// Only in-memory observations, mock sinks and authored status previews.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ControlSession } from '../control.mjs';
import { prepareMissionSpeech } from '../mission-speech.mjs';
import { baseline } from '../../synthetic/tactical-cases.mjs';

function rig({ uncertain = false, session = 'mission1', actorId = 'alpha' } = {}) {
  let clock = 1000;
  const sent = [];
  const control = new ControlSession({ mode: 'MOCK_ONLY', now: () => clock,
    mockSink: intent => {
      sent.push(intent);
      if (uncertain && sent.length === 1) throw new Error('possible mock effect');
    } });
  function observe(sequence) {
    const snapshot = baseline();
    snapshot.session = session;
    snapshot.sequence = sequence;
    snapshot.nowMs = snapshot.observedAtMs = snapshot.targets[0].observedAtMs = clock;
    snapshot.lancemates[0].id = actorId;
    assert.equal(control.ingest({ schemaVersion: 1, kind: 'observation', provenance: 'MOCK_ONLY',
      adapterId: 'instance_identity_fixture', session, sequence, observedAtMs: clock, snapshot }).ok, true);
    assert.equal(control.armSimulation([actorId]).armed, true);
  }
  function submit() {
    assert.equal(control.queueRecommendations().queued.length, 1);
    const [result] = control.drainSimulation();
    return result;
  }
  function receipt() {
    const {id, session, actorId, binding} = sent[0];
    return {id, session, actorId, binding, classification: 'MOCK_ONLY', stage: 'COMPLETED',
      observedAtMs: clock, evidence: 'synthetic completion from its originating instance'};
  }
  return {control, sent, observe, submit, receipt, advance: delta => { clock += delta; }};
}

test('a completion from another instance cannot resolve a matching uncertain submission', () => {
  const prior = rig(), replacement = rig({ uncertain: true });
  prior.observe(1);
  replacement.observe(1);
  assert.equal(prior.submit().status, 'SIMULATED_SUBMISSION');
  assert.equal(replacement.submit().status, 'UNCONFIRMED');
  const stale = prior.receipt(), local = replacement.receipt();
  assert.deepEqual({...stale, id: null}, {...local, id: null}, 'only the opaque intent ID distinguishes the receipts');
  const before = replacement.control.getState();
  assert.deepEqual(replacement.control.observeSimulatedResult(stale),
    {status: 'REJECTED', reason: 'UNCORRELATED_EVIDENCE'});
  assert.deepEqual(replacement.control.getState(), before);

  replacement.advance(2000);
  replacement.observe(2);
  const blocked = replacement.control.queueRecommendations();
  assert.equal(blocked.queued.length, 0);
  assert.equal(blocked.rejected[0].reason, 'UNCONFIRMED_PRIOR_ACTION');
  assert.deepEqual(replacement.control.drainSimulation(), []);
  assert.equal(replacement.sent.length, 1);

  assert.equal(replacement.control.observeSimulatedResult(local).recorded, true);
  assert.equal(replacement.submit().status, 'SIMULATED_SUBMISSION');
  assert.equal(replacement.sent.length, 2);
});

test('one instance still deduplicates queued intent and retains its dispatch cooldown', () => {
  const r = rig();
  r.observe(1);
  const [pending] = r.control.queueRecommendations().queued;
  assert.deepEqual(r.control.queueRecommendations().rejected, [{id: pending.id, reason: 'DUPLICATE'}]);
  r.control.disarm();
  assert.equal(r.control.armSimulation(['alpha']).armed, true);
  assert.equal(r.control.queueRecommendations().queued[0].id, pending.id);
  assert.equal(r.control.drainSimulation()[0].id, pending.id);
  assert.equal(r.control.observeSimulatedResult(r.receipt()).recorded, true);

  r.advance(1999);
  r.observe(2);
  assert.equal(r.control.queueRecommendations().rejected[0].reason, 'ACTION_RATE_LIMIT');
  r.advance(1);
  assert.equal(r.submit().status, 'SIMULATED_SUBMISSION');
  assert.notEqual(r.sent[0].id, r.sent[1].id);
});

test('a ledger ID for maximum-width legal identities stays usable in authored action status', () => {
  const session = 's'.repeat(64), actorId = 'a'.repeat(64);
  const r = rig({session, actorId});
  r.observe(Number.MAX_SAFE_INTEGER);
  assert.equal(r.submit().status, 'SIMULATED_SUBMISSION');
  const [entry] = r.control.getState().ledger;
  const actionId = entry.id;
  const binding = {id: actorId, pawnId: 'pawn1', generation: 1, aiOwned: true, alive: true};
  const report = {id: `report_${actorId}`, session, actorId, pawnId: binding.pawnId, generation: 1,
    actionId, action: 'focus', stage: 'SUBMITTED', source: 'DISPATCH_RECEIPT', classification: 'MOCK_ONLY',
    observedAtMs: 1000, expiresAtMs: 6000};
  const line = prepareMissionSpeech({id: 'status_request', session, speakerId: actorId, pawnId: binding.pawnId,
    generation: 1, query: 'action_status', actionId},
    {session, nowMs: 1000, phase: 'active', bindings: [binding], reports: [report]});
  assert.equal(line.status, 'PREPARED');
  assert.equal(line.evidence.actionId, actionId);
  assert.equal(line.dispatchable, false);
  assert.match(line.text, /Acceptance is unconfirmed/);
});
