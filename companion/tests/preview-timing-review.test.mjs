// Independent MOCK_ONLY timing-transition review: injected promises and fake clocks only.
// A READY-reporting fake generator demonstrates coordinator ownership, not native overlap.
import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate as flush } from 'node:timers/promises';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createWorkbench } from '../server.mjs';
import { createConversationCoordinator } from '../conversation.mjs';

function deferred() { let resolve; const promise = new Promise(yes => { resolve = yes; }); return { promise, resolve }; }
const bindings = () => ['alpha', 'bravo', 'charlie'].map((id, i) => ({ id, pawnId: `pawn${i + 1}`,
  profileId: ['edge', 'tactician', 'scout'][i], generation: 1, aiOwned: true, alive: true }));

async function workbenchFixture(t, { automatic = false } = {}) {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'mw5-timing-review-'));
  let clock = 10000, languageState = 'READY', speechState = 'READY'; const calls = [];
  const language = { status: () => ({ state: languageState, ownsProcess: false }), async start() {},
    async stop() { languageState = 'STOPPED'; },
    generate(context, { signal }) { const d = deferred(); calls.push({ ...d, context, signal });
      if (automatic) d.resolve('Synthetic answer.'); return d.promise; } };
  const speech = { getState: () => ({ state: speechState, ownsProcess: false }), async start() {},
    async stop() { speechState = 'STOPPED'; }, async synthesize() { throw Error('SPEECH_NOT_EXPECTED'); } };
  const recognition = { async start() {}, async stop() {}, async dispose() {}, async transcribe() { throw Error('RECOGNITION_NOT_EXPECTED'); },
    status: () => ({ state: 'STOPPED', busy: false, ownsProcess: false, processStopConfirmed: true }) };
  const w = await createWorkbench({ settingsPath: path.join(temp, 'settings.json'), languageModel: language,
    speechEngine: speech, recognitionEngine: recognition, realNow: () => clock,
    resourcePolicy: { async admit() {}, startWatch() {}, stopWatch() {}, status: () => ({ cleanupPending: false }) } });
  t.after(async () => {
    calls.forEach(c => c.resolve('Discarded.')); await flush(); await w.dispose();
    const target = path.resolve(temp); assert.equal(path.dirname(target), path.resolve(os.tmpdir()));
    assert.ok(path.basename(target).startsWith('mw5-timing-review-')); await rm(target, { recursive: true, force: true });
  });
  await w.act({ type: 'demo' });
  const ask = async (actorId = 'alpha') => { await w.act({ type: 'converse', actorId, text: 'Check in.' }); await flush(); };
  const answer = async actorId => { await ask(actorId); calls.at(-1).resolve('Prior valid response.'); await flush(); };
  return { w, calls, ask, answer, at: value => { clock = value; } };
}

test('same timing selection cannot restore speech after a latched backward clock in the same mission', async t => {
  const r = await workbenchFixture(t, { automatic: true }); await r.ask();
  r.at(9000); await r.ask(); assert.equal(r.w.state().localModels.reply.reason, 'CLOCK_INVALID');
  const session = r.w.state().control.session;
  await r.w.act({ type: 'preview_timing', allowSlow: false }); await r.ask();
  assert.equal(r.w.state().localModels.reply.reason, 'CLOCK_INVALID');
  assert.equal(r.calls.length, 1); assert.equal(r.w.state().control.session, session);
});

test('timing changes retain the occupied coordinator slot when an injected generator ignores cancellation', async t => {
  const r = await workbenchFixture(t); await r.ask(); const old = r.calls[0];
  await r.w.act({ type: 'preview_timing', allowSlow: true });
  assert.equal(old.signal.aborted, true); assert.equal(r.w.state().localModels.reply, null);
  await r.ask(); assert.equal(r.calls.length, 1, 'A second generator cannot start until the first promise drains.');
  old.resolve('Obsolete request.'); await flush(); assert.equal(r.calls.length, 2);
  assert.equal(r.w.state().localModels.reply.status, 'GENERATING');
  r.calls[1].resolve('Current request.'); await flush(); assert.equal(r.w.state().localModels.reply.text, 'Current request.');
});

test('changing only timing preserves accepted dialogue history while cancelling the pending reply', async t => {
  const r = await workbenchFixture(t); await r.answer(); await r.ask(); const old = r.calls[1];
  await r.w.act({ type: 'preview_timing', allowSlow: true }); assert.equal(old.signal.aborted, true);
  old.resolve('Cancelled line.'); await flush(); await r.ask();
  assert.deepEqual(r.calls[2].context.history.map(h => h.responseText), ['Prior valid response.']);
});

test('timing changes do not reset separate tactical human holds or restore a possessed pilot', async t => {
  const r = await workbenchFixture(t); await r.w.act({ type: 'step', actorId: 'alpha', event: 'hold' });
  await r.w.act({ type: 'step', actorId: 'bravo', event: 'possession' }); const before = r.w.state().control;
  await r.w.act({ type: 'preview_timing', allowSlow: true }); assert.deepEqual(r.w.state().control, before);
  await r.ask('bravo'); assert.equal(r.w.state().localModels.reply.reason, 'BINDING_INVALID'); assert.equal(r.calls.length, 0);
  assert.equal(r.w.state().control.nativeCalls, 0);
});

function coordinatorFixture(t, timeoutMs = 1000) {
  let clock = 1000; const calls = [];
  const c = createConversationCoordinator({ timeoutMs, now: () => clock,
    generate(context, { signal }) { const d = deferred(); calls.push({ ...d, context, signal }); return d.promise; } });
  c.startMission('mission1', bindings());
  t.after(async () => { c.dispose(); calls.forEach(call => call.resolve('Discarded.')); await flush(); });
  const request = (id, extra = {}) => c.request({ id, session: 'mission1', speakerId: 'alpha', pawnId: 'pawn1',
    generation: 1, priority: 'answer', text: 'Check in.', facts: [], expiresAtMs: clock + 5000, ...extra });
  const answer = async id => { const pending = request(id); await flush(); calls.at(-1).resolve('Accepted earlier line.'); await pending; await flush(); };
  return { c, calls, request, answer, at: value => { clock = value; } };
}

test('in-place timing update preserves consumed request IDs and retired missions', async t => {
  const r = coordinatorFixture(t); await r.answer('spent'); r.c.setTimeoutMs(2000);
  assert.equal((await r.request('spent')).reason, 'DUPLICATE_REQUEST');
  r.c.startMission('mission2', bindings()); r.c.setTimeoutMs(1000);
  assert.equal(r.c.startMission('mission1', bindings()).reason, 'NEW_SESSION_REQUIRED');
  assert.equal((await r.request('retired')).reason, 'SESSION_MISMATCH'); assert.equal(r.calls.length, 1);
});

test('in-place timing update preserves revoked identity generations and historical pawn ownership', async t => {
  const r = coordinatorFixture(t), first = bindings()[0];
  r.c.updateBinding({ ...first, aiOwned: null, generation: 6 }); r.c.setTimeoutMs(2000);
  assert.equal((await r.request('revoked')).reason, 'BINDING_INVALID');
  assert.equal(r.c.updateBinding({ ...first, generation: 6 }).reason, 'GENERATION_MUST_ADVANCE');
  assert.equal(r.c.updateBinding({ ...first, pawnId: 'replacement', generation: 7 }).status, 'UPDATED');
  r.c.setTimeoutMs(1000);
  assert.equal(r.c.updateBinding({ ...bindings()[1], pawnId: 'pawn1', generation: 2 }).reason, 'BINDING_OWNER_CHANGED');
  assert.equal(r.calls.length, 0);
});

test('same-value coordinator timing selection cancels work but preserves histories, gates and occupied slot', async t => {
  const r = coordinatorFixture(t); await r.answer('history'); const pending = r.request('pending'); await flush();
  r.c.setGates({ quiet: true }); const before = r.c.getState(); r.c.setTimeoutMs(1000);
  assert.equal((await pending).status, 'CANCELLED'); assert.equal(r.calls[1].signal.aborted, true);
  const after = r.c.getState(); assert.deepEqual(after.histories, before.histories); assert.deepEqual(after.gates, before.gates);
  assert.deepEqual(after.bindings, before.bindings); assert.equal(after.rememberedRequestIds, before.rememberedRequestIds);
  assert.equal(after.active.id, 'pending'); assert.equal(after.active.cancelled, true);
  const next = r.request('successor'); await flush(); assert.equal(r.calls.length, 2);
  r.calls[1].resolve('Discarded old output.'); await flush(); assert.equal(r.calls.length, 3);
  r.calls[2].resolve('Successor.'); assert.equal((await next).status, 'GENERATED');
});

test('invalid or disposed timeout updates neither coerce values nor cancel valid work', async t => {
  const r = coordinatorFixture(t); const pending = r.request('valid'); await flush(); let conversions = 0;
  const hostile = { valueOf() { conversions++; return 10; }, toString() { conversions++; return '10'; } };
  const before = r.c.getState();
  for (const value of [0, 10001, 1.5, null, '10', NaN, Infinity, hostile]) assert.equal(r.c.setTimeoutMs(value).status, 'REJECTED');
  assert.equal(conversions, 0); assert.equal(r.calls[0].signal.aborted, false); assert.deepEqual(r.c.getState(), before);
  r.calls[0].resolve('Still valid.'); assert.equal((await pending).status, 'GENERATED'); await flush();
  r.c.dispose(); assert.equal(r.c.setTimeoutMs(10).status, 'REJECTED'); assert.equal(r.c.getState().disposed, true);
});

test('new requests use the updated timeout and the old promise cannot renew its deadline', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const r = coordinatorFixture(t, 4), old = r.request('old'); await flush();
  r.c.setTimeoutMs(10); assert.equal((await old).status, 'CANCELLED'); r.calls[0].resolve('Obsolete.'); await flush();
  const slow = r.request('slow'); await flush(); t.mock.timers.tick(9); await flush();
  assert.equal(r.calls[1].signal.aborted, false); t.mock.timers.tick(1); await flush();
  assert.equal((await slow).reason, 'GENERATION_TIMEOUT'); r.calls[1].resolve('Late.'); await flush();
  r.c.setTimeoutMs(4); const fast = r.request('fast'); await flush(); t.mock.timers.tick(3); await flush();
  assert.equal(r.calls[2].signal.aborted, false); t.mock.timers.tick(1); await flush();
  assert.equal((await fast).reason, 'GENERATION_TIMEOUT'); assert.equal(r.c.getState().timeoutMs, 4);
});
