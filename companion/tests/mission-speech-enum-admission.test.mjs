import assert from 'node:assert/strict';
import test from 'node:test';
import { prepareMissionSpeech, revalidateMissionSpeech } from '../mission-speech.mjs';

const request = { id: 'speech1', session: 'mission1', speakerId: 'alpha', pawnId: 'pawn1',
  generation: 1, query: 'action_status', actionId: 'action1' };
const report = { id: 'report1', session: 'mission1', actorId: 'alpha', pawnId: 'pawn1',
  generation: 1, actionId: 'action1', action: 'regroup', stage: 'SUBMITTED', source: 'DISPATCH_RECEIPT',
  classification: 'MOCK_ONLY', observedAtMs: 900, expiresAtMs: 5000 };
const binding = { id: 'alpha', pawnId: 'pawn1', generation: 1, aiOwned: true, alive: true };
const context = (row = report, nowMs = 1000) => ({ session: 'mission1', nowMs, phase: 'active',
  bindings: [binding], reports: [row] });
const invalid = { status: 'REJECTED', reason: 'INVALID_CONTEXT', liveEligible: false, dispatchable: false };

for (const [field, value, label] of [
  ['action', ['regroup'], 'an array that coerces to a valid key'],
  ['stage', ['SUBMITTED'], 'an array that coerces to a valid key'],
  ['action', { toString: null }, 'a plain value whose key conversion throws'],
  ['stage', { toString: null }, 'a plain value whose key conversion throws'],
]) {
  test(`prepare rejects ${field} as ${label}`, () => {
    assert.deepEqual(prepareMissionSpeech(request, context({ ...report, [field]: value })), invalid);
  });
  test(`revalidate rejects ${field} as ${label}`, () => {
    const prepared = prepareMissionSpeech(request, context());
    assert.equal(prepared.status, 'PREPARED');
    assert.deepEqual(revalidateMissionSpeech(prepared, context({ ...report, [field]: value }, 1001)), invalid);
  });
}

test('valid primitive action and stage remain admissible with the same wording and evidence', () => {
  const prepared = prepareMissionSpeech(request, context());
  assert.equal(prepared.status, 'PREPARED');
  assert.equal(prepared.text, 'Simulation: My regroup request was submitted. Acceptance is unconfirmed.');
  assert.deepEqual(prepared.evidence, report);
  assert.deepEqual(revalidateMissionSpeech(prepared, context(report, 1001)), {
    status: 'VALID', liveEligible: false, dispatchable: false, classification: 'MOCK_ONLY',
  });
});
