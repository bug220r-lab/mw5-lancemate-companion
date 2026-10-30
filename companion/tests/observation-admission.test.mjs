// Malformed programmatic observations must not leave an old simulated intent dispatchable.
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateObservation, replayFrames } from '../observation.mjs';
import { ControlSession } from '../control.mjs';
import { baseline } from '../../synthetic/tactical-cases.mjs';

function frame(sequence = 1, atMs = 1000, mutate = () => {}) {
  const snapshot = baseline(); snapshot.sequence = sequence;
  snapshot.nowMs = snapshot.observedAtMs = atMs; snapshot.targets[0].observedAtMs = atMs;
  mutate(snapshot, snapshot.lancemates[0]);
  return { schemaVersion: 1, kind: 'observation', provenance: 'MOCK_ONLY', adapterId: 'admission_fixture',
    session: snapshot.session, sequence, observedAtMs: atMs, snapshot };
}
function disguisedSparse(value) {
  const array = Array(2); array[1] = value; array.extra = value;
  assert.equal(array.length, Object.keys(array).length); return array;
}
const malformedMembers = (sequence = 2, atMs = 1100) => frame(sequence, atMs, snapshot => {
  snapshot.lancemates = disguisedSparse(snapshot.lancemates[0]);
});
function rejected(input, options = {}) {
  let result;
  assert.doesNotThrow(() => { result = validateObservation(input, { nowMs: 1100, allowSynthetic: true, ...options }); });
  assert.equal(result.ok, false); assert.equal(result.snapshot, null);
  assert.deepEqual(result.errors, ['MALFORMED_RECORD']); return result;
}
function rig() {
  let clock = 1000; const sent = [];
  const control = new ControlSession({ mode: 'MOCK_ONLY', now: () => clock, mockSink: intent => sent.push(intent) });
  return { control, sent, setTime: value => { clock = value; } };
}

test('sparse member inventory plus a named extra rejects without normalization throwing', () => {
  rejected(malformedMembers());
});

test('a malformed new observation disarms and discards an old queued intent before it can drain', () => {
  const r = rig(); assert.equal(r.control.ingest(frame()).ok, true);
  assert.equal(r.control.armSimulation(['alpha']).armed, true);
  assert.equal(r.control.queueRecommendations().queued.length, 1);
  r.setTime(1100); let result;
  assert.doesNotThrow(() => { result = r.control.ingest(malformedMembers()); });
  assert.equal(result.ok, false); assert.deepEqual(result.errors, ['MALFORMED_RECORD']);
  const state = r.control.getState(); assert.equal(state.armed, false); assert.equal(state.pending.length, 0);
  assert.deepEqual(r.control.drainSimulation(), []); assert.equal(r.sent.length, 0);
  assert.equal(r.control.armSimulation(['alpha']).status, 'REJECTED');
  assert.equal(r.control.getState().nativeCalls, 0);
});

test('replay records the malformed frame as rejected and can resume from the last valid frame', () => {
  let result;
  assert.doesNotThrow(() => { result = replayFrames([frame(), malformedMembers(), frame(3, 1200)], { allowSynthetic: true }); });
  assert.deepEqual(result.results.map(r => r.accepted), [true, false, true]);
  assert.equal(result.results[1].decision, null);
  assert.deepEqual(result.errors, [{ index: 1, errors: ['MALFORMED_RECORD'] }]);
});

for (const field of ['targets', 'engagements', 'positions', 'capabilities']) {
  test(`sparse-plus-extra ${field} is rejected as data rather than normalized into a valid frame`, () => {
    const input = frame(2, 1100, (snapshot, actor) => {
      if (field === 'targets') snapshot.targets = disguisedSparse(snapshot.targets[0]);
      else if (field === 'positions') actor.positions = disguisedSparse({ id: 'safe_spot' });
      else actor[field] = disguisedSparse(actor[field][0]);
    });
    rejected(input);
  });
}

test('plain dense observations retain their original semantics and never mutate the input', () => {
  const input = frame(2, 1100); const before = structuredClone(input);
  const result = validateObservation(input, { nowMs: 1100, allowSynthetic: true });
  assert.equal(result.ok, true); assert.deepEqual(input, before);
  assert.equal(result.snapshot.lancemates[0].id, 'alpha');
});

test('custom and null array prototypes reject instead of being silently erased', () => {
  for (const prototype of [{}, null]) {
    const input = frame(2, 1100); Object.setPrototypeOf(input.snapshot.targets, prototype);
    rejected(input);
  }
});

test('noncanonical array index keys cannot offset a missing canonical index', () => {
  for (const key of ['01', '-1', '1.0']) {
    const input = frame(2, 1100); const array = Array(2);
    array[1] = input.snapshot.targets[0]; array[key] = input.snapshot.targets[0];
    input.snapshot.targets = array; rejected(input);
  }
});

test('proxy envelopes, nested proxies and proxy arrays reject without invoking any caller traps', () => {
  for (const location of ['envelope', 'binding', 'array']) {
    let traps = 0; const input = frame(2, 1100);
    const handlers = { getPrototypeOf() { traps++; throw new Error('EXECUTED'); },
      ownKeys() { traps++; throw new Error('EXECUTED'); }, get() { traps++; throw new Error('EXECUTED'); } };
    let candidate = input;
    if (location === 'envelope') candidate = new Proxy(input, handlers);
    else if (location === 'array') input.snapshot.targets = new Proxy(input.snapshot.targets, handlers);
    else input.snapshot.lancemates[0] = new Proxy(input.snapshot.lancemates[0], handlers);
    rejected(candidate); assert.equal(traps, 0);
  }
});

test('revoked proxy data rejects without escaping the public validation seam', () => {
  const input = frame(2, 1100); const proxy = Proxy.revocable(input.snapshot.targets, {}); proxy.revoke();
  input.snapshot.targets = proxy.proxy; rejected(input);
});

test('proxy previous-frame and continuity options reject before invoking caller traps', () => {
  const previous = frame(); const valid = validateObservation(previous, { nowMs: 1000, allowSynthetic: true });
  for (const option of ['previousFrame', 'continuity']) {
    let traps = 0; const target = option === 'previousFrame' ? previous : valid.nextContinuity;
    const proxy = new Proxy(target, { getPrototypeOf() { traps++; throw new Error('EXECUTED'); },
      ownKeys() { traps++; throw new Error('EXECUTED'); } });
    rejected(frame(2, 1100), { [option]: proxy }); assert.equal(traps, 0);
  }
});

test('a nested array-index getter never runs and still discards the armed pending intent', () => {
  const r = rig(); assert.equal(r.control.ingest(frame()).ok, true);
  r.control.armSimulation(['alpha']); assert.equal(r.control.queueRecommendations().queued.length, 1);
  const input = frame(2, 1100); let reads = 0;
  Object.defineProperty(input.snapshot.targets, '0', { enumerable: true, get() { reads++; throw new Error('EXECUTED'); } });
  r.setTime(1100); let result;
  assert.doesNotThrow(() => { result = r.control.ingest(input); });
  assert.deepEqual(result.errors, ['MALFORMED_RECORD']); assert.equal(reads, 0);
  assert.equal(r.control.getState().armed, false); assert.equal(r.control.getState().pending.length, 0);
  assert.deepEqual(r.control.drainSimulation(), []); assert.equal(r.sent.length, 0);
});

test('malformed data preserves supplied continuity and cannot release a previously observed human hold', () => {
  const held = frame(1, 1000, (snapshot, actor) => { actor.manual = {
    observable: true, revision: 1, status: 'active', persistent: true, orderId: 'human_hold' }; });
  const initial = validateObservation(held, { nowMs: 1000, allowSynthetic: true });
  const continuityBefore = structuredClone(initial.nextContinuity);
  const bad = rejected(malformedMembers(), { previousFrame: held, continuity: initial.nextContinuity });
  assert.deepEqual(bad.nextContinuity, continuityBefore); assert.deepEqual(initial.nextContinuity, continuityBefore);
  const r = rig(); assert.equal(r.control.ingest(held).ok, true);
  const before = r.control.getState().policyState.actors.alpha.heldHumanOrder;
  r.setTime(1100); assert.doesNotThrow(() => r.control.ingest(malformedMembers()));
  assert.deepEqual(r.control.getState().policyState.actors.alpha.heldHumanOrder, before);
  r.setTime(1200); assert.equal(r.control.ingest(frame(3, 1200, (snapshot, actor) => { actor.manual.revision = 1; })).ok, true);
  r.control.armSimulation(['alpha']); assert.equal(r.control.queueRecommendations().queued.length, 0);
  assert.deepEqual(r.control.getState().policyState.actors.alpha.heldHumanOrder, before);
});

test('a malformed frame cannot erase the continuity floor established by observed human possession', () => {
  const r = rig(); assert.equal(r.control.ingest(frame()).ok, true); r.setTime(1100);
  const possessed = r.control.ingest(frame(2, 1100, (snapshot, actor) => { actor.aiOwned = false; actor.generation = 2; }));
  assert.equal(possessed.ok, false); r.setTime(1200);
  assert.doesNotThrow(() => r.control.ingest(malformedMembers(3, 1200)));
  r.setTime(1300); const stale = r.control.ingest(frame(4, 1300, (snapshot, actor) => { actor.generation = 2; }));
  assert.equal(stale.ok, false); assert(stale.errors.includes('OWNERSHIP_GENERATION_NOT_ADVANCED:alpha'));
  assert.equal(r.control.getState().armed, false); assert.equal(r.sent.length, 0);
});
