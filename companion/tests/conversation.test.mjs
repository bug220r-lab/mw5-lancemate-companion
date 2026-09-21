// Injected in-memory generators only: no model, process, network, audio or game.
import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate as flush } from 'node:timers/promises';
import { CONVERSATION_LIMITS, createConversationCoordinator } from '../conversation.mjs';

const bindings = () => ['alpha', 'bravo', 'charlie'].map((id, i) => ({ id,
  profileId: ['edge', 'tactician', 'scout'][i], pawnId: `pawn${i + 1}`, generation: 1, aiOwned: true, alive: true }));
function rig(t, { generate = async () => 'Standing by.', timeoutMs = 1000 } = {}) {
  let clock = 1000;
  const coordinator = createConversationCoordinator({ generate, now: () => clock, timeoutMs });
  assert.equal(coordinator.startMission('mission1', bindings()).status, 'STARTED');
  t.after(() => coordinator.dispose());
  const fact = (extra = {}) => ({ id: 'contact1', session: 'mission1', kind: 'fact', verified: true,
    observedAtMs: clock, expiresAtMs: clock + 5000, data: { targetId: 'enemy1', visible: true }, ...extra });
  const request = (id, extra = {}) => ({ id, session: 'mission1', speakerId: 'alpha', pawnId: 'pawn1',
    generation: 1, priority: 'answer', text: 'How are you doing?', facts: [], expiresAtMs: clock + 5000, ...extra });
  return { c: coordinator, fact, request, at: value => { clock = value; } };
}
function controlled() {
  const calls = [];
  return { calls, generate: (context, { signal }) => new Promise((resolve, reject) => calls.push({ context, signal, resolve, reject })) };
}

test('three explicit persona bindings are required and no generation happens before a valid request', async t => {
  let calls = 0; const c = createConversationCoordinator({ generate: async () => { calls++; return 'Ready.'; }, now: () => 1000 });
  t.after(() => c.dispose());
  assert.equal(c.startMission('m', bindings().slice(0, 2)).reason, 'INVALID_BINDINGS');
  const alias = bindings(); alias[1].pawnId = alias[0].pawnId;
  assert.equal(c.startMission('m', alias).reason, 'INVALID_BINDINGS');
  assert.equal(c.startMission('m', bindings()).status, 'STARTED');
  assert.deepEqual(c.getState().bindings.map(b => b.profileId), ['edge', 'tactician', 'scout']);
  assert.equal(c.startMission('m', bindings()).reason, 'NEW_SESSION_REQUIRED'); assert.equal(calls, 0);
  assert.throws(() => createConversationCoordinator({ generate: null }), /generator/);
});

test('one generator serializes all three pilots without mixing their histories', async t => {
  const g = controlled(), r = rig(t, { generate: g.generate });
  const a = r.c.request(r.request('a'));
  const b = r.c.request(r.request('b', { speakerId: 'bravo', pawnId: 'pawn2' }));
  const c = r.c.request(r.request('c', { speakerId: 'charlie', pawnId: 'pawn3' }));
  await flush(); assert.equal(g.calls.length, 1); assert.equal(g.calls[0].context.persona.id, 'edge');
  g.calls[0].resolve('Edgy answer.'); await a; await flush(); assert.equal(g.calls.length, 2);
  assert.equal(g.calls[1].context.persona.id, 'tactician'); assert.deepEqual(g.calls[1].context.history, []);
  g.calls[1].resolve('Measured answer.'); await b; await flush(); assert.equal(g.calls.length, 3);
  assert.equal(g.calls[2].context.persona.id, 'scout'); g.calls[2].resolve('Scout answer.'); await c;
  const h = r.c.getState().histories;
  assert.deepEqual(Object.values(h).map(x => x.length), [1, 1, 1]);
  assert.equal(h.alpha[0].responseText, 'Edgy answer.'); assert.equal(h.bravo[0].responseText, 'Measured answer.');
});

test('generator context and fact pack are deeply immutable detached evidence assertions', async t => {
  const g = controlled(), r = rig(t, { generate: g.generate });
  const f = r.fact(), input = r.request('one', { facts: [f] }); const pending = r.c.request(input);
  f.data.visible = false; input.text = 'mutated'; await flush();
  const context = g.calls[0].context;
  assert.equal(context.facts[0].data.visible, true); assert.equal(context.request.text, 'How are you doing?');
  assert.equal(context.facts[0].evidenceStatus, 'CALLER_ASSERTED_OBSERVATION');
  assert.equal(Object.hasOwn(context.facts[0], 'verified'), false);
  assert.throws(() => { context.facts[0].data.visible = false; }, TypeError);
  assert.throws(() => { context.persona.traits.push('new'); }, TypeError);
  assert.equal(context.limits.maxOutputTokens, 64); assert.equal(context.limits.maxOutputChars, 256);
  g.calls[0].resolve('I think the contact is still there.'); const result = await pending;
  assert.equal(result.classification, 'GENERATED_UNVERIFIED'); assert.equal(result.grounding, 'NOT_VALIDATED');
  assert.equal(result.requiresRadioGate, true); assert.equal(result.dispatchable, false);
  assert.equal(result.audioGenerated, false); assert.deepEqual(result.sourceFactIds, ['contact1']);
  assert.equal(Object.hasOwn(result, 'verified'), false); assert.equal(Object.hasOwn(result, 'facts'), false);
  assert.equal(Object.hasOwn(result, 'factIds'), false);
});

test('per-pilot history is bounded unverified dialogue and readback cannot mutate it', async t => {
  const seen = [], r = rig(t, { generate: async context => { seen.push(context); return `Line ${context.request.id}`; } });
  for (let n = 0; n < 10; n++) await r.c.request(r.request(`line${n}`));
  const state = r.c.getState(); assert.equal(state.histories.alpha.length, CONVERSATION_LIMITS.historyTurnsPerActor);
  assert.equal(state.histories.alpha[0].requestId, 'line4');
  assert.ok(state.histories.alpha.every(h => h.classification === 'GENERATED_UNVERIFIED' && h.delivery === 'NOT_PLAYED_BY_COORDINATOR'));
  assert.ok(seen.every(x => x.history.length <= 6)); assert.deepEqual(state.histories.bravo, []);
  state.histories.alpha[0].responseText = 'forged';
  assert.notEqual(r.c.getState().histories.alpha[0].responseText, 'forged');
});

test('mission reset cancels old context and waits for its ignored abort to settle before using generator', async t => {
  const g = controlled(), r = rig(t, { generate: g.generate });
  const old = r.c.request(r.request('same')); await flush();
  assert.equal(r.c.startMission('mission2', bindings()).status, 'STARTED');
  assert.equal((await old).reason, 'MISSION_CHANGED'); assert.equal(g.calls[0].signal.aborted, true);
  const fresh = r.c.request(r.request('same', { session: 'mission2' })); await flush();
  assert.equal(g.calls.length, 1); assert.equal(r.c.getState().active.cancelled, true);
  g.calls[0].resolve('Old mission must not be remembered.'); await flush();
  assert.equal(g.calls.length, 2); assert.equal(g.calls[1].context.session, 'mission2'); assert.deepEqual(g.calls[1].context.history, []);
  g.calls[1].resolve('New mission.'); await fresh;
  assert.equal(r.c.getState().histories.alpha.length, 1);
  assert.equal(r.c.getState().histories.alpha[0].responseText, 'New mission.');
});

test('binding changes cancel active and queued speech and clear only that actor context', async t => {
  const g = controlled(), r = rig(t, { generate: g.generate });
  const active = r.c.request(r.request('a')), queued = r.c.request(r.request('b')); await flush();
  const next = { ...bindings()[0], pawnId: 'newpawn', generation: 2 };
  assert.equal(r.c.updateBinding(next).status, 'UPDATED');
  assert.equal((await active).reason, 'BINDING_CHANGED'); assert.equal((await queued).reason, 'BINDING_CHANGED');
  g.calls[0].resolve('Wrong pawn'); await flush(); assert.deepEqual(r.c.getState().histories.alpha, []);
  assert.equal((await r.c.request(r.request('stale'))).reason, 'BINDING_INVALID');
  const fresh = r.c.request(r.request('fresh', { pawnId: 'newpawn', generation: 2 })); await flush();
  g.calls[1].resolve('New binding.'); assert.equal((await fresh).status, 'GENERATED');
});

test('unversioned possession invalidates speech and cannot return using the old generation', async t => {
  const r = rig(t);
  assert.equal(r.c.updateBinding({ ...bindings()[0], aiOwned: false }).reason, 'GENERATION_MUST_ADVANCE');
  assert.equal((await r.c.request(r.request('blocked'))).reason, 'BINDING_INVALID');
  assert.equal(r.c.updateBinding(bindings()[0]).reason, 'GENERATION_MUST_ADVANCE');
  assert.equal(r.c.updateBinding({ ...bindings()[0], generation: 2 }).status, 'UPDATED');
  assert.equal((await r.c.request(r.request('new', { generation: 2 }))).status, 'GENERATED');
});

for (const [gate, reason] of [['ptt', 'USER_SPEAKING'], ['paused', 'PAUSED'], ['speechMuted', 'SPEECH_MUTED'], ['nativeDialogue', 'NATIVE_DIALOGUE']]) {
  test(`${gate} cancels active/queued generation and reopening does not replay it`, async t => {
    const g = controlled(), r = rig(t, { generate: g.generate });
    const a = r.c.request(r.request('a')), b = r.c.request(r.request('b')); await flush();
    r.c.setGates({ [gate]: true }); assert.equal((await a).reason, reason); assert.equal((await b).reason, reason);
    assert.equal(g.calls[0].signal.aborted, true);
    assert.equal((await r.c.request(r.request('blocked'))).reason, reason);
    r.c.setGates({ [gate]: false }); g.calls[0].resolve('discarded'); await flush();
    assert.equal(g.calls.length, 1); assert.deepEqual(r.c.getState().histories.alpha, []);
  });
}

test('quiet suppresses unsolicited priorities while requested answers remain independent of control arming', async t => {
  const r = rig(t); r.c.setGates({ quiet: true });
  for (const priority of ['banter', 'tactical']) {
    assert.equal((await r.c.request(r.request(priority, { priority, facts: [r.fact()] }))).reason, 'QUIET');
  }
  assert.equal((await r.c.request(r.request('answer'))).status, 'GENERATED');
  assert.equal((await r.c.request(r.request('danger', { priority: 'danger', facts: [r.fact()] }))).status, 'GENERATED');
  assert.equal(r.c.setGates({ armed: false }).reason, 'INVALID_GATES');
  assert.equal(r.c.setGates({ disarmed: true }).reason, 'INVALID_GATES');
  assert.equal(r.c.getState().gates.quiet, true);
});

test('timeout aborts immediately but an ignoring generator cannot cause overlapping generation', async t => {
  const g = controlled(), r = rig(t, { generate: g.generate, timeoutMs: 15 });
  const one = r.c.request(r.request('one')); await flush();
  assert.equal((await one).reason, 'GENERATION_TIMEOUT'); assert.equal(g.calls[0].signal.aborted, true);
  const two = r.c.request(r.request('two'));
  assert.equal((await two).reason, 'QUEUE_TIMEOUT'); assert.equal(g.calls.length, 1);
  g.calls[0].resolve('too late'); await flush(); assert.deepEqual(r.c.getState().histories.alpha, []);
  const three = r.c.request(r.request('three')); await flush(); assert.equal(g.calls.length, 2);
  g.calls[1].resolve('Now ready.'); assert.equal((await three).status, 'GENERATED');
});

test('cancellation and request ID dedup prevent retrying the same admitted request', async t => {
  const g = controlled(), r = rig(t, { generate: g.generate });
  const one = r.c.request(r.request('one')); await flush();
  assert.equal(r.c.cancel('one').status, 'CANCELLED'); assert.equal((await one).reason, 'USER_CANCELLED');
  assert.equal((await r.c.request(r.request('one'))).reason, 'DUPLICATE_REQUEST');
  assert.equal(r.c.cancel('missing').reason, 'NOT_PENDING');
  g.calls[0].resolve('ignore'); await flush(); assert.deepEqual(r.c.getState().histories.alpha, []);
});

test('only bounded plain generated text is accepted; fake facts/tools and errors cannot escape', async t => {
  let output = null; const r = rig(t, { generate: async () => { if (output instanceof Error) throw output; return output; } });
  const invalid = [null, undefined, { text: 'Killed it.', verified: true, tools: ['fire'] }, ' ', 'x'.repeat(257), 'bad\0text', '\u202Eevil', new Error('private details')];
  for (let i = 0; i < invalid.length; i++) {
    output = invalid[i]; const result = await r.c.request(r.request(`bad${i}`));
    assert.equal(result.status, 'REJECTED'); assert.equal(result.dispatchable, false);
    assert.equal(JSON.stringify(result).includes('private details'), false);
  }
  output = 'regroup slot 1'; const opaque = await r.c.request(r.request('textcommand'));
  assert.equal(opaque.text, 'regroup slot 1'); assert.equal(opaque.dispatchable, false);
  assert.equal(Object.hasOwn(opaque, 'action'), false); assert.equal(r.c.getState().nativeCalls, 0);
  assert.equal(r.c.getState().histories.alpha.length, 1);
});

test('queued priority is stable and a single active generator is never bypassed', async t => {
  const g = controlled(), r = rig(t, { generate: g.generate });
  const requests = [r.c.request(r.request('active'))]; await flush();
  for (const priority of ['banter', 'tactical', 'answer', 'danger']) requests.push(r.c.request(r.request(priority, { priority, facts: [r.fact()] })));
  assert.equal(g.calls.length, 1);
  for (let i = 0; i < 5; i++) { g.calls[i].resolve('Ready.'); await flush(); }
  await Promise.all(requests);
  assert.deepEqual(g.calls.map(c => c.context.request.id), ['active', 'danger', 'answer', 'tactical', 'banter']);
});

test('danger cancels active banter but must wait for cooperative generator termination', async t => {
  const g = controlled(), r = rig(t, { generate: g.generate });
  const banter = r.c.request(r.request('banter', { priority: 'banter', facts: [r.fact()] })); await flush();
  const danger = r.c.request(r.request('danger', { priority: 'danger', facts: [r.fact()] }));
  assert.equal((await banter).reason, 'URGENT_PREEMPTION'); assert.equal(g.calls[0].signal.aborted, true);
  await flush(); assert.equal(g.calls.length, 1); g.calls[0].resolve('old banter'); await flush();
  assert.equal(g.calls[1].context.request.id, 'danger'); g.calls[1].resolve('Check that contact.');
  assert.equal((await danger).classification, 'GENERATED_UNVERIFIED');
});

test('fact pack rejects unsupported provenance, duplicate IDs, staleness and inconsistent time', async t => {
  let calls = 0; const r = rig(t, { generate: async () => { calls++; return 'line'; } });
  const invalid = [r.fact({ verified: false }), r.fact({ session: 'other' }), r.fact({ observedAtMs: 1001 }),
    r.fact({ expiresAtMs: 999 }), r.fact({ expiresAtMs: 6001 }), r.fact({ classification: 'GENERATED_UNVERIFIED' }),
    r.fact({ source: 'GENERATED' }), r.fact({ data: 'x'.repeat(1025) })];
  for (let i = 0; i < invalid.length; i++) assert.equal((await r.c.request(r.request(`bad${i}`, { facts: [invalid[i]] }))).status, 'REJECTED');
  assert.equal((await r.c.request(r.request('duplicate', { facts: [r.fact(), r.fact()] }))).status, 'REJECTED');
  assert.equal((await r.c.request(r.request('tactical', { priority: 'tactical' }))).reason, 'FACTS_REQUIRED');
  assert.equal(calls, 0);
});

test('generation rechecks fact/deadline freshness and never refreshes old claims', async t => {
  const g = controlled(), r = rig(t, { generate: g.generate });
  const one = r.c.request(r.request('one', { facts: [r.fact({ expiresAtMs: 1100 })] })); await flush();
  r.at(1100); g.calls[0].resolve('stale assertion'); assert.equal((await one).reason, 'FACT_STALE');
  const two = r.c.request(r.request('two', { expiresAtMs: 2000, facts: [r.fact({ expiresAtMs: 1600 })] })); await flush();
  r.at(1200); g.calls[1].resolve('Uncertain contact.'); const result = await two;
  assert.equal(result.createdAtMs, 1200); assert.equal(result.expiresAtMs, 1600);
  assert.equal(result.grounding, 'NOT_VALIDATED');
});

test('bounded queue, mission history and identity claims never silently evict dedup guards', async t => {
  const g = controlled(), r = rig(t, { generate: g.generate });
  const jobs = [r.c.request(r.request('active'))]; await flush();
  for (let i = 0; i < CONVERSATION_LIMITS.queuedRequests; i++) jobs.push(r.c.request(r.request(`q${i}`)));
  assert.equal((await r.c.request(r.request('overflow'))).reason, 'QUEUE_FULL');
  r.c.cancelAll(); await Promise.all(jobs); g.calls[0].resolve('discard'); await flush();
  assert.equal((await r.c.request(r.request('q0'))).reason, 'DUPLICATE_REQUEST');
  assert.equal(r.c.updateBinding({ ...bindings()[1], pawnId: 'pawn1', generation: 2 }).reason, 'BINDING_OWNER_CHANGED');
  assert.equal(r.c.updateBinding({ ...bindings()[0], profileId: 'scout', generation: 2 }).reason, 'BINDING_OWNER_CHANGED');
  for (let i = 2; i <= CONVERSATION_LIMITS.sessions; i++) assert.equal(r.c.startMission(`mission${i}`, bindings()).status, 'STARTED');
  assert.equal(r.c.startMission('overcapacity', bindings()).reason, 'SESSION_CAPACITY');
});

test('malformed/accessor data cannot execute during admission and regressing clock cancels work', async t => {
  const g = controlled(), r = rig(t, { generate: g.generate }); let reads = 0;
  const dangerous = r.request('accessor'); Object.defineProperty(dangerous, 'text', { enumerable: true, get() { reads++; return 'attack'; } });
  assert.equal((await r.c.request(dangerous)).reason, 'INVALID_REQUEST'); assert.equal(reads, 0);
  const cyclic = r.request('cyclic'); cyclic.loop = cyclic;
  assert.equal((await r.c.request(cyclic)).reason, 'INVALID_REQUEST');
  const good = r.c.request(r.request('good')); await flush(); r.at(999); r.c.getState();
  assert.equal((await good).reason, 'CLOCK_INVALID'); assert.equal(g.calls[0].signal.aborted, true);
  r.at(1001); assert.equal((await r.c.request(r.request('later'))).reason, 'CLOCK_INVALID');
  g.calls[0].resolve('ignored'); await flush();
  assert.equal(r.c.startMission('mission2', bindings()).status, 'STARTED'); assert.equal(r.c.getState().clockFault, false);
});

test('dispose cancels outstanding work and permanently blocks new generation', async t => {
  const g = controlled(), r = rig(t, { generate: g.generate });
  const pending = r.c.request(r.request('one')); await flush();
  r.c.dispose(); assert.equal((await pending).reason, 'DISPOSED');
  assert.equal((await r.c.request(r.request('two'))).reason, 'DISPOSED');
  assert.equal(r.c.startMission('new', bindings()).reason, 'DISPOSED');
  g.calls[0].resolve('late'); await flush(); assert.deepEqual(r.c.getState().histories, {});
});
