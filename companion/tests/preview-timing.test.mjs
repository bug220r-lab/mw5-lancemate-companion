// MOCK_ONLY. Inert generators and fake time; no native worker, audio or game.
import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate as flush } from 'node:timers/promises';
import { randomUUID } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { createConversationCoordinator } from '../conversation.mjs';
import { createWorkbench } from '../server.mjs';

const bindings = () => ['alpha', 'bravo', 'charlie'].map((id, i) => ({ id,
  profileId: ['edge', 'tactician', 'scout'][i], pawnId: `pawn${i}`, generation: 1, alive: true, aiOwned: true }));
const request = (id, extra = {}) => ({ id, session: 'mission1', speakerId: 'alpha', pawnId: 'pawn0',
  generation: 1, priority: 'answer', text: 'Check in.', facts: [], expiresAtMs: 11000, ...extra });

function coordinator(t) {
  let clock = 1000; const calls = [];
  const c = createConversationCoordinator({ timeoutMs: 4000, now: () => clock,
    generate: (context, { signal }) => new Promise(resolve => { calls.push({ context, signal, resolve }); }) });
  c.startMission('mission1', bindings());
  t.after(async () => { c.dispose(); calls.forEach(p => p.resolve('Discarded.')); await flush(); });
  return { c, calls, at: value => { clock = value; } };
}

test('every valid timing selection cancels pending work but retains the occupied generator slot until it settles', async t => {
  const r = coordinator(t), old = r.c.request(request('old'));
  const queued = r.c.request(request('queued', { speakerId: 'bravo', pawnId: 'pawn1' })); await flush();
  assert.equal(r.calls.length, 1); assert.equal(r.c.setTimeoutMs(4000).status, 'UPDATED');
  assert.equal((await old).reason, 'PREVIEW_TIMING_CHANGED'); assert.equal((await queued).reason, 'PREVIEW_TIMING_CHANGED');
  assert.equal(r.calls[0].signal.aborted, true); assert.equal(r.c.getState().active.cancelled, true);
  const fresh = r.c.request(request('fresh'));
  await flush(); assert.equal(r.calls.length, 1, 'A cancelled but unresolved generator still owns the slot.');
  r.calls[0].resolve('Late cancelled answer.'); await flush(); assert.equal(r.calls.length, 2);
  assert.deepEqual(r.calls[1].context.history, []); r.calls[1].resolve('New answer.');
  assert.equal((await fresh).status, 'GENERATED');
  assert.deepEqual(r.c.getState().histories.alpha.map(h => h.requestId), ['fresh']);
});

test('changing timeout keeps completed unverified history, request IDs and used session IDs', async t => {
  const r = coordinator(t), completed = r.c.request(request('completed')); await flush();
  r.calls[0].resolve('A previous generated line.'); await completed; await flush();
  const before = r.c.getState(); r.c.setTimeoutMs(10000); const after = r.c.getState();
  assert.equal(after.timeoutMs, 10000); assert.deepEqual(after.histories, before.histories);
  assert.deepEqual(after.bindings, before.bindings); assert.deepEqual(after.gates, before.gates);
  assert.equal(after.rememberedRequestIds, 1); assert.equal(after.histories.alpha[0].classification, 'GENERATED_UNVERIFIED');
  assert.equal((await r.c.request(request('completed'))).reason, 'DUPLICATE_REQUEST');
  assert.equal(r.c.startMission('mission1', bindings()).reason, 'NEW_SESSION_REQUIRED');
  const next = r.c.request(request('next')); await flush();
  assert.deepEqual(r.calls[1].context.history, before.histories.alpha); r.calls[1].resolve('Next line.'); await next;
});

test('timing changes cannot clear a latched clock fault even after time catches up', async t => {
  const r = coordinator(t); r.at(900);
  assert.equal((await r.c.request(request('clock-fault'))).reason, 'CLOCK_INVALID');
  for (const value of [4000, 10000, 1]) {
    assert.equal(r.c.setTimeoutMs(value).status, 'UPDATED');
    assert.equal((await r.c.request(request(`still-faulted-${value}`))).reason, 'CLOCK_INVALID');
    assert.equal(r.c.getState().clockFault, true);
  }
  r.at(1200); assert.equal((await r.c.request(request('clock-caught-up'))).reason, 'CLOCK_INVALID');
  assert.equal(r.calls.length, 0);
});

test('invalid deadline values neither cancel existing work nor mutate the selected timeout or history', async t => {
  const r = coordinator(t), active = r.c.request(request('pending')); await flush();
  let conversionCalls = 0; const object = { valueOf() { conversionCalls++; return 5000; } };
  for (const value of [null, undefined, true, false, 0, -1, 1.5, 10001, NaN, Infinity, '1000', 1000n, object, Symbol('timeout')]) {
    assert.equal(r.c.setTimeoutMs(value).reason, 'INVALID_TIMEOUT');
    assert.equal(r.c.getState().timeoutMs, 4000); assert.equal(r.calls[0].signal.aborted, false);
  }
  assert.equal(conversionCalls, 0); r.calls[0].resolve('Still current.'); assert.equal((await active).status, 'GENERATED');
  const before = r.c.getState().timeoutMs; r.c.dispose(); assert.equal(r.c.setTimeoutMs(10000).reason, 'DISPOSED');
  assert.equal(r.c.getState().timeoutMs, before);
});

for (const [label, expiry, factExpiry, expectedMs] of [
  ['selected deadline', 11000, null, 10000], ['request expiry', 1600, null, 600], ['fact expiry', 11000, 1750, 750]
]) {
  test(`newly admitted work uses the new deadline bounded by ${label}`, async t => {
    t.mock.timers.enable({ apis: ['setTimeout'] }); const r = coordinator(t); r.c.setTimeoutMs(10000);
    const facts = factExpiry === null ? [] : [{ id: 'fact', session: 'mission1', kind: 'fact', verified: true,
      observedAtMs: 1000, expiresAtMs: factExpiry, data: { status: 'unknown' } }];
    const pending = r.c.request(request('future', { expiresAtMs: expiry, facts })); await flush();
    t.mock.timers.tick(expectedMs - 1); assert.equal(r.calls[0].signal.aborted, false);
    t.mock.timers.tick(1); assert.equal(r.calls[0].signal.aborted, true);
    assert.equal((await pending).reason, 'GENERATION_TIMEOUT'); assert.equal(r.c.getState().active.cancelled, true);
  });
}

async function workbench(t) {
  let clock = 10000; const calls = [];
  const language = { state: 'READY', status() { return { state: this.state, classification: 'MOCK_ONLY' }; },
    async stop() { this.state = 'STOPPED'; }, generate(context, { signal }) {
      return new Promise(resolve => { calls.push({ context, signal, resolve }); }); } };
  const speech = { state: 'READY', getState() { return { state: this.state }; }, async stop() { this.state = 'STOPPED'; } };
  const w = await createWorkbench({ settingsPath: path.join(os.tmpdir(), `absent-mw5-preview-${randomUUID()}`, 'settings.json'),
    languageModel: language, speechEngine: speech, realNow: () => clock,
    resourcePolicy: { async admit() {}, startWatch() {}, stopWatch() {}, status: () => ({}) } });
  t.after(async () => { calls.forEach(p => p.resolve('Discarded.')); await flush(); await w.dispose(); });
  await w.act({ type: 'demo' });
  const ask = async actorId => { await w.act({ type: 'converse', actorId, text: 'Radio check?' }); await flush(); };
  return { w, calls, ask, at: value => { clock = value; } };
}

test('actual workbench same-mode timing action cannot recover a failed clock within the same mission', async t => {
  const r = await workbench(t); await r.w.act({ type: 'step', actorId: 'bravo', event: 'hold' });
  await r.ask('alpha'); r.calls[0].resolve('Initial answer.'); await flush();
  r.at(9000); await r.ask('alpha'); assert.equal(r.w.state().localModels.reply.reason, 'CLOCK_INVALID');
  const before = r.w.state().control; assert.ok(before.policyState.actors.bravo.heldHumanOrder);
  await r.w.act({ type: 'preview_timing', allowSlow: false }); await r.ask('alpha');
  assert.equal(r.w.state().localModels.reply.reason, 'CLOCK_INVALID'); assert.equal(r.calls.length, 1);
  assert.deepEqual(r.w.state().control, before); assert.equal(r.w.state().localModels.previewDeadlineMs, 4000);
  assert.equal(r.w.state().control.nativeCalls, 0);
});

test('actual workbench timing action cannot replace the old abort-ignoring generator owner', async t => {
  const r = await workbench(t); await r.ask('alpha');
  await r.w.act({ type: 'preview_timing', allowSlow: true }); assert.equal(r.calls[0].signal.aborted, true);
  await r.ask('bravo'); assert.equal(r.calls.length, 1);
  r.calls[0].resolve('Old cancelled text.'); await flush(); assert.equal(r.calls.length, 2);
  assert.equal(r.calls[1].context.speakerId, 'bravo'); r.calls[1].resolve('Current text.'); await flush();
  assert.equal(r.w.state().localModels.reply.text, 'Current text.');
  assert.equal(r.w.state().localModels.previewDeadlineMs, 10000);
  assert.equal(r.w.state().localModels.firstSpokenTargetMs, 4000);
  assert.equal(r.w.state().localModels.timingAcceptance, 'NOT_ESTABLISHED');
});
