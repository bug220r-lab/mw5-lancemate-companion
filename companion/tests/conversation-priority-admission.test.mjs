// Pure coordinator with an injected inert generator. No runtime or devices.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createConversationCoordinator } from '../conversation.mjs';

const bindings = ['alpha', 'bravo', 'charlie'].map((id, index) => ({ id,
  profileId: ['edge', 'tactician', 'scout'][index], pawnId: `pawn-${index + 1}`,
  generation: 1, aiOwned: true, alive: true }));
const invalid = { status: 'REJECTED', reason: 'INVALID_REQUEST', classification: 'PROJECT_ONLY', dispatchable: false };

function fixture(t) {
  const calls = [];
  const coordinator = createConversationCoordinator({ now: () => 1000,
    generate: async context => { calls.push(context.request.priority); return 'Standing by.'; } });
  t.after(() => coordinator.dispose());
  assert.equal(coordinator.startMission('mission', bindings).status, 'STARTED');
  assert.equal(coordinator.setGates({ quiet: true }).status, 'UPDATED');
  const facts = [{ id: 'synthetic-fact', session: 'mission', kind: 'fact', verified: true,
    observedAtMs: 1000, expiresAtMs: 4000, data: { actorId: 'alpha', heat: 'normal' } }];
  const request = (id, priority) => coordinator.request({ id, priority, session: 'mission', speakerId: 'alpha',
    pawnId: 'pawn-1', generation: 1, text: 'Radio check.', facts, expiresAtMs: 4000 });
  return { coordinator, calls, request };
}

test('a non-string banter priority cannot bypass quiet mode by coercing to an allowed key', async t => {
  const r = fixture(t);
  assert.deepEqual(await r.request('array-priority', ['banter']), invalid);
  assert.deepEqual(r.calls, []);
  assert.deepEqual(r.coordinator.getState().histories.alpha, []);
});

test('a non-coercible priority resolves as INVALID_REQUEST instead of throwing', async t => {
  const r = fixture(t);
  const result = await r.request('object-priority', { toString: null });
  assert.deepEqual(result, invalid);
  assert.deepEqual(r.calls, []);
});

test('quiet still withholds literal banter while allowing a literal requested answer', async t => {
  const r = fixture(t);
  assert.equal((await r.request('literal-banter', 'banter')).reason, 'QUIET');
  assert.deepEqual(r.calls, []);
  const answer = await r.request('literal-answer', 'answer');
  assert.equal(answer.status, 'GENERATED');
  assert.equal(answer.priority, 'answer');
  assert.deepEqual(r.calls, ['answer']);
});
