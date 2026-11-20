import assert from 'node:assert/strict';
import test from 'node:test';
import { prepareMissionSpeech, revalidateMissionSpeech } from '../mission-speech.mjs';

const request = { id: 'speech1', session: 'mission1', speakerId: 'alpha', pawnId: 'pawn1',
  generation: 1, query: 'action_status', actionId: 'action1' };
const submitted = { id: 'report1', session: 'mission1', actorId: 'alpha', pawnId: 'pawn1',
  generation: 1, actionId: 'action1', action: 'regroup', stage: 'SUBMITTED', source: 'DISPATCH_RECEIPT',
  classification: 'MOCK_ONLY', observedAtMs: 900, expiresAtMs: 5000 };
const rejected = { ...submitted, id: 'report2', stage: 'REJECTED', source: 'DISPATCH_REJECTION' };
const alpha = { id: 'alpha', pawnId: 'pawn1', generation: 1, aiOwned: true, alive: true };
const bravo = { ...alpha, id: 'bravo', pawnId: 'pawn2' };
const context = (overrides = {}) => ({ session: 'mission1', nowMs: 1000, phase: 'active',
  bindings: [alpha, bravo], reports: [submitted], ...overrides });
const invalid = { status: 'REJECTED', reason: 'INVALID_DATA', liveEligible: false, dispatchable: false };

test('a named report cannot fill a missing array index and hide a contradictory report at preparation', () => {
  const reports = [, submitted]; reports.hidden = rejected;
  assert.deepEqual(prepareMissionSpeech(request, context({ reports })), invalid);
});

test('a named contradictory report cannot disappear when revalidating an existing valid receipt', () => {
  const prepared = prepareMissionSpeech(request, context());
  assert.equal(prepared.status, 'PREPARED');
  const reports = [, submitted]; reports.hidden = rejected;
  assert.deepEqual(revalidateMissionSpeech(prepared, context({ nowMs: 1001, reports })), invalid);
});

test('a named binding cannot fill a missing index and make speaker lookup throw', () => {
  const prepared = prepareMissionSpeech(request, context());
  const bindings = [, alpha]; bindings.hidden = bravo;
  const malformed = context({ bindings });
  assert.deepEqual(prepareMissionSpeech(request, malformed), invalid);
  assert.deepEqual(revalidateMissionSpeech(prepared, malformed), invalid);
});

test('a sparse array cannot replace the method used to validate its reports', () => {
  const prepared = prepareMissionSpeech(request, context());
  const reports = [, submitted]; reports.every = 'invalid method';
  const malformed = context({ reports });
  assert.deepEqual(prepareMissionSpeech(request, malformed), invalid);
  assert.deepEqual(revalidateMissionSpeech(prepared, malformed), invalid);
});

test('an index accessor is rejected without invocation', () => {
  const prepared = prepareMissionSpeech(request, context());
  let reads = 0;
  const reports = [submitted];
  Object.defineProperty(reports, '0', { enumerable: true, get() { reads++; return submitted; } });
  assert.deepEqual(prepareMissionSpeech(request, context({ reports })), invalid);
  assert.deepEqual(revalidateMissionSpeech(prepared, context({ reports })), invalid);
  assert.equal(reads, 0);
});

test('dense ordinary arrays preserve authored wording and reject conflicting reports', () => {
  const prepared = prepareMissionSpeech(request, context());
  assert.equal(prepared.status, 'PREPARED');
  assert.match(prepared.text, /Simulation: .*submitted.*unconfirmed/);
  assert.equal(prepared.dispatchable, false);
  assert.equal(revalidateMissionSpeech(prepared, context({ nowMs: 1001 })).status, 'VALID');
  const conflict = context({ reports: [submitted, rejected] });
  assert.equal(prepareMissionSpeech(request, conflict).reason, 'CONFLICTING_REPORTS');
  assert.equal(revalidateMissionSpeech(prepared, conflict).reason, 'CONFLICTING_REPORTS');
});
