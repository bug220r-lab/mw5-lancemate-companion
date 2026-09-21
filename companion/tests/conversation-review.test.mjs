// Independent unknown-authority regression cases. Injected promises only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate as flush } from 'node:timers/promises';
import { createConversationCoordinator } from '../conversation.mjs';

const bindings = () => ['alpha', 'bravo', 'charlie'].map((id, index) => ({ id,
  profileId: ['edge', 'tactician', 'scout'][index], pawnId: `pawn${index + 1}`,
  generation: 1, aiOwned: true, alive: true }));

function fixture(t) {
  const calls = [];
  const coordinator = createConversationCoordinator({ now: () => 1000, timeoutMs: 1000,
    generate: (context, { signal }) => new Promise(resolve => calls.push({ context, signal, resolve })) });
  coordinator.startMission('review_mission', bindings());
  t.after(async () => { coordinator.dispose(); for (const call of calls) call.resolve('discarded'); await flush(); });
  const request = (id, speakerId = 'alpha', generation = 1) => ({ id, session: 'review_mission',
    speakerId, pawnId: bindings().find(b => b.id === speakerId).pawnId, generation,
    priority: 'answer', text: 'Radio check.', facts: [], expiresAtMs: 5000 });
  return { c: coordinator, calls, request };
}

for (const field of ['aiOwned', 'alive']) {
  for (const [label, value] of [['null', null], ['missing', undefined], ['unknown string', 'UNKNOWN']]) {
    test(`${field} becoming ${label} revokes pending speech until a strictly newer known binding`, async t => {
      const r = fixture(t), old = r.c.request(r.request('old'));
      const other = r.c.request(r.request('other', 'bravo')); await flush();
      const update = { ...bindings()[0], [field]: value }; if (label === 'missing') delete update[field];
      assert.equal(r.c.updateBinding(update).status, 'REJECTED');
      assert.equal(r.calls[0].signal.aborted, true, 'Loss of current ownership/liveness certainty must revoke generation.');
      assert.equal((await old).status, 'CANCELLED');
      assert.equal((await r.c.request(r.request('stillunknown'))).status, 'REJECTED');
      assert.equal(r.c.updateBinding(bindings()[0]).status, 'REJECTED', 'Old generation cannot restore revoked certainty.');
      r.calls[0].resolve('Stale alpha answer'); await flush();
      assert.equal(r.calls.length, 2); assert.equal(r.calls[1].context.speakerId, 'bravo');
      r.calls[1].resolve('Bravo remains eligible.'); assert.equal((await other).status, 'GENERATED'); await flush();
      assert.deepEqual(r.c.getState().histories.alpha, []);
      assert.equal(r.c.updateBinding({ ...bindings()[0], generation: 2 }).status, 'UPDATED');
      const fresh = r.c.request(r.request('fresh', 'alpha', 2)); await flush();
      r.calls[2].resolve('Fresh binding.'); assert.equal((await fresh).status, 'GENERATED');
      assert.equal(r.c.getState().histories.alpha.length, 1);
    });
  }
}

test('malformed binding accessors never execute during conservative invalidation', async t => {
  const r = fixture(t); let reads = 0;
  const update = { ...bindings()[0] };
  Object.defineProperty(update, 'aiOwned', { enumerable: true, get() { reads++; return null; } });
  assert.equal(r.c.updateBinding(update).status, 'REJECTED');
  assert.equal(reads, 0);
  assert.equal(r.c.getState().bindings.find(b => b.id === 'bravo').aiOwned, true);
});
