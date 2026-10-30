// Project result admission only. All commands, observations and outcomes are MOCK_ONLY.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ControlSession } from '../control.mjs';
import { baseline } from '../../synthetic/tactical-cases.mjs';

function rig({ uncertain = false, humanHold = false } = {}) {
  let clock = 1000;
  const control = new ControlSession({ mode: 'MOCK_ONLY', now: () => clock,
    mockSink: () => { if (uncertain) throw new Error('unknown fixture outcome'); } });
  function frame(sequence = 1, hold = false) {
    const snapshot = baseline(); snapshot.sequence = sequence;
    snapshot.nowMs = snapshot.observedAtMs = clock; snapshot.targets[0].observedAtMs = clock;
    if (hold) snapshot.lancemates[0].manual = {
      observable: true, revision: 1, orderId: 'human_hold', status: 'active', persistent: true };
    return { schemaVersion: 1, kind: 'observation', provenance: 'MOCK_ONLY', adapterId: 'result_admission_fixture',
      session: snapshot.session, sequence, observedAtMs: clock, snapshot };
  }
  assert.equal(control.ingest(frame()).ok, true);
  assert.equal(control.armSimulation(['alpha']).armed, true);
  assert.equal(control.queueRecommendations().queued.length, 1);
  control.drainSimulation();
  const entry = control.getState().ledger[0];
  if (humanHold) { clock++; assert.equal(control.ingest(frame(2, true)).ok, true); }
  const event = (changes = {}) => ({ id: entry.id, session: entry.session, actorId: entry.actorId,
    binding: entry.binding, classification: 'MOCK_ONLY', stage: 'ASSIGNED', observedAtMs: clock,
    evidence: 'correlated fixture assignment', ...changes });
  return { control, event, frame, tick: delta => { clock += delta; } };
}

function rejectsWithoutMutation(r, event) {
  const before = r.control.getState(); let result;
  assert.doesNotThrow(() => { result = r.control.observeSimulatedResult(event); });
  assert.equal(result.status, 'REJECTED');
  assert.deepEqual(r.control.getState(), before);
  assert.equal(r.control.getState().nativeCalls, 0);
}

test('result field accessors are rejected without executing them or changing held state', () => {
  for (const key of ['classification', 'stage', 'id', 'session', 'actorId', 'binding', 'observedAtMs', 'evidence']) {
    const r = rig({ uncertain: true, humanHold: true }); let calls = 0;
    const event = r.event();
    Object.defineProperty(event, key, { enumerable: true, get() { calls++; throw new Error('GETTER_EXECUTED'); } });
    rejectsWithoutMutation(r, event);
    assert.equal(calls, 0, key);
  }
});

test('extension accessors, nonenumerable fields and executable hooks cannot be admitted', () => {
  for (const make of [
    (event, called) => Object.assign(event, { extra: Object.defineProperty({}, 'value', {
      enumerable: true, get: called }) }),
    event => Object.defineProperty(event, 'hidden', { value: 'not JSON', enumerable: false }),
    (event, called) => Object.assign(event, { toJSON: called }),
    (event, called) => Object.assign(event, { extra: { toString: called, [Symbol.toPrimitive]: called } })
  ]) {
    const r = rig(); let calls = 0;
    rejectsWithoutMutation(r, make(r.event(), () => { calls++; throw new Error('HOOK_EXECUTED'); }));
    assert.equal(calls, 0);
  }
});

test('outer, nested and revoked proxies are rejected without invoking their traps', () => {
  for (const location of ['outer', 'nested', 'revoked']) {
    const r = rig(); let traps = 0;
    const trap = () => { traps++; throw new Error('PROXY_TRAP_EXECUTED'); };
    const handler = { get: trap, getPrototypeOf: trap, ownKeys: trap, getOwnPropertyDescriptor: trap };
    let event;
    if (location === 'outer') event = new Proxy(r.event(), handler);
    else if (location === 'nested') event = r.event({ extra: new Proxy({}, handler) });
    else { const revocable = Proxy.revocable(r.event(), handler); revocable.revoke(); event = revocable.proxy; }
    rejectsWithoutMutation(r, event);
    assert.equal(traps, 0);
  }
});

test('nonplain result records and nested instances are rejected without coercion', () => {
  class ResultInstance {}
  for (const make of [event => Object.assign(new ResultInstance(), event),
    event => Object.assign(Object.create({ inherited: true }), event),
    event => Object.assign(new Date(0), event), event => ({ ...event, extra: new Map() }),
    event => ({ ...event, extra: Object.assign(new Number(1), { toJSON() { throw new Error('HOOK'); } }) })]) {
    const r = rig(); rejectsWithoutMutation(r, make(r.event()));
  }
});

test('cyclic records and arrays cannot change result evidence or a human hold', () => {
  for (const cyclicArray of [false, true]) {
    const r = rig({ uncertain: true, humanHold: true }); const event = r.event();
    if (cyclicArray) { const array = []; array.push(array); event.extra = array; }
    else event.extra = { back: event };
    rejectsWithoutMutation(r, event);
  }
});

test('evidence longer than its retained 256 units is rejected before trimming or truncation', () => {
  for (const evidence of ['x'.repeat(257), ' '.repeat(1000000) + 'x']) {
    const r = rig(); rejectsWithoutMutation(r, r.event({ evidence }));
  }
  const r = rig(); const evidence = 'x'.repeat(256);
  assert.equal(r.control.observeSimulatedResult(r.event({ evidence })).recorded, true);
  assert.equal(r.control.getState().ledger[0].stages.at(-1).evidence, evidence);
});

test('oversized extension strings, deep nesting and wide containers are rejected without partial acceptance', () => {
  const deep = {}; let cursor = deep;
  for (let i = 0; i < 40; i++) { cursor.next = {}; cursor = cursor.next; }
  for (const extra of ['x'.repeat(100000), deep, Object.fromEntries(Array.from({ length: 1000 }, (_, i) => [i, i])),
    Array.from({ length: 1000 }, (_, i) => i), Array.from({ length: 20 }, () => Array(20).fill(null))]) {
    const r = rig(); rejectsWithoutMutation(r, r.event({ extra }));
  }
});

test('symbol keys, dangerous keys, sparse arrays and extended arrays are rejected', () => {
  const sparse = []; sparse.length = 2; sparse[1] = 'value';
  const extended = ['value']; extended.extra = 'value';
  for (const make of [event => Object.assign(event, { [Symbol('hidden')]: 'value' }),
    event => Object.assign(event, { extra: JSON.parse('{"__proto__":{"polluted":true}}') }),
    event => Object.assign(event, { extra: sparse }), event => Object.assign(event, { extra: extended })]) {
    const r = rig(); rejectsWithoutMutation(r, make(r.event()));
  }
});

test('a named array property cannot compensate for a missing dense index', () => {
  const r = rig({ uncertain: true, humanHold: true });
  const extra = []; extra.length = 2; extra[1] = 'value'; extra.foo = 'named property';
  rejectsWithoutMutation(r, r.event({ extra }));
});

test('non-JSON values and malformed top-level records reject without throwing', () => {
  for (const event of [undefined, null, true, 1, 'result', [], () => {}, Symbol('result')]) {
    const r = rig(); rejectsWithoutMutation(r, event);
  }
  for (const extra of [undefined, NaN, Infinity, 1n, () => {}]) {
    const r = rig(); rejectsWithoutMutation(r, r.event({ extra }));
  }
});

test('detached plain and null-prototype data preserve valid stage progression and correlation', () => {
  const r = rig({ uncertain: true, humanHold: true });
  const assigned = Object.assign(Object.create(null), r.event({ extra: { annotation: ['plain', null, false, 0] } }));
  const original = structuredClone(assigned);
  assert.equal(r.control.observeSimulatedResult(assigned).recorded, true);
  assert.deepEqual(structuredClone(assigned), original);
  assigned.evidence = 'changed after admission';
  assert.equal(r.control.getState().ledger[0].stages.at(-1).evidence, original.evidence);
  assert.equal(r.control.observeSimulatedResult(r.event({ stage: 'BEHAVIOR_OBSERVED' })).recorded, true);
  assert.equal(r.control.observeSimulatedResult(r.event({ stage: 'COMPLETED' })).recorded, true);
  assert.equal(r.control.getState().policyState.actors.alpha.heldHumanOrder.id, 'human_hold');
  assert.equal(r.control.observeSimulatedResult(r.event({ stage: 'ASSIGNED' })).status, 'REJECTED');
  assert.equal(r.control.getState().nativeCalls, 0);
});

test('well-formed ledger-derived payloads and ordinary correlation rejection stay compatible', () => {
  const r = rig(); const entry = r.control.getState().ledger[0];
  assert.equal(r.control.observeSimulatedResult({ ...entry, ...r.event() }).recorded, true);
  for (const changes of [{ actorId: 'bravo' }, { binding: 'different' }, { session: 'different' },
    { classification: 'GAME_OBSERVED' }, { observedAtMs: 999 }, { observedAtMs: 1001 }, { evidence: '   ' }]) {
    rejectsWithoutMutation(r, r.event({ ...changes, stage: 'COMPLETED' }));
  }
});
