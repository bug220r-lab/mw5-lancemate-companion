// Independent MOCK_ONLY radio-state review. No audio, model, native API or game.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRadioDirector } from '../radio.mjs';

const ids = ['edge', 'tactician', 'scout'];
const initial = () => ids.map((id, i) => ({ id, pawnId: `pawn-${i + 1}`, generation: 1, slot: i + 1, alive: true, aiOwned: true }));
function rig() {
  let now = 1000, serial = 0;
  const radio = createRadioDirector({ now: () => now });
  assert.equal(radio.startMission('mission-review', initial()).status, 'STARTED');
  assert.equal(radio.observe({ id: 'fact', session: 'mission-review', kind: 'fact', verified: true,
    observedAtMs: now, expiresAtMs: now + 30000, data: { contact: 'synthetic' } }).status, 'OBSERVED');
  const line = (lineId, speakerId = 'edge', extra = {}) => {
    const b = initial().find(b => b.id === speakerId);
    return { lineId, session: 'mission-review', speakerId, pawnId: b.pawnId, generation: b.generation,
      priority: 'answer', text: 'Synthetic line.', createdAtMs: now, expiresAtMs: now + 30000, factIds: [], ...extra };
  };
  const event = (changes = {}, extra = {}) => ({ id: `event-${++serial}`, session: 'mission-review',
    kind: 'binding', observedAtMs: now, binding: { ...initial()[0], ...changes }, ...extra });
  const enqueue = (...args) => assert.equal(radio.enqueue(line(...args)).status, 'QUEUED');
  const exchange = (turn, extra = {}) => ({ priority: 'tactical', factIds: ['fact'], exchangeId: 'exchange', exchangeTurn: turn, ...extra });
  return { radio, line, event, enqueue, exchange, at: value => { now = value; } };
}
function unavailable(r, speakerId = 'edge', identity = {}) {
  const state = r.radio.getState();
  assert.notEqual(state.playing?.speakerId, speakerId);
  assert.ok(state.queue.every(l => l.speakerId !== speakerId));
  assert.equal(r.radio.enqueue(r.line('after-revocation', speakerId, identity)).reason, 'BINDING_INVALID');
}

test('radio binding review: fresh same-generation possession cancels active and queued speech for each pilot only', () => {
  for (const speakerId of ids) {
    const r = rig(), other = ids.find(id => id !== speakerId), b = initial().find(b => b.id === speakerId);
    r.enqueue('active', speakerId); assert.equal(r.radio.next().lineId, 'active');
    r.enqueue('queued', speakerId); r.enqueue('sentinel', other); r.at(1100);
    r.radio.observe(r.event({ ...b, aiOwned: false })); unavailable(r, speakerId);
    assert.equal(r.radio.complete('active').reason, 'NOT_PLAYING');
    assert.equal(r.radio.next().lineId, 'sentinel');
  }
});

test('radio binding review: unknown ownership or liveness revokes eligibility without granting malformed state', () => {
  for (const change of [{ aiOwned: null }, { aiOwned: undefined }, { alive: null }, { alive: 'true' }, { aiOwned: 1 }]) {
    const r = rig(); r.enqueue('active'); r.radio.next(); r.enqueue('queued'); r.enqueue('sentinel', 'scout'); r.at(1100);
    assert.equal(r.radio.observe(r.event(change)).status, 'REJECTED'); unavailable(r);
    assert.equal(r.radio.getState().bindings.find(b => b.id === 'edge').invalidated, true);
    assert.equal(r.radio.next().lineId, 'sentinel');
  }
});

test('radio binding review: recovery cannot reuse the revoked generation or resurrect discarded lines', () => {
  const r = rig(); r.enqueue('old'); r.at(1100); r.radio.observe(r.event({ aiOwned: null })); unavailable(r);
  r.at(1200); assert.equal(r.radio.observe(r.event()).status, 'REJECTED');
  assert.equal(r.radio.observe(r.event({ generation: 2 })).status, 'OBSERVED');
  assert.equal(r.radio.next(), null); r.enqueue('new', 'edge', { generation: 2 });
  assert.equal(r.radio.next().lineId, 'new');
});

test('radio binding review: a higher-generation denied observation creates a floor and freshness barrier', () => {
  const r = rig(); r.enqueue('old'); r.at(1200); r.radio.observe(r.event({ generation: 5, aiOwned: null }));
  for (const generation of [1, 2, 5]) {
    r.at(1300); assert.equal(r.radio.observe(r.event({ generation })).status, 'REJECTED');
  }
  assert.equal(r.radio.observe(r.event({ generation: 6 }, { observedAtMs: 1199 })).status, 'REJECTED');
  assert.equal(r.radio.next(), null);
  assert.equal(r.radio.observe(r.event({ generation: 6 })).status, 'OBSERVED');
  r.enqueue('new', 'edge', { generation: 6 }); assert.equal(r.radio.next().lineId, 'new');
});

test('radio binding review: older, stale, future and foreign updates cannot silence a newer active identity', () => {
  const mutations = [e => { e.binding.generation = 1; }, e => { e.binding.pawnId = 'pawn-1'; },
    e => { e.binding.id = 'unknown'; }, e => { e.session = 'other-mission'; },
    e => { e.observedAtMs = 1099; }, e => { e.observedAtMs = 1201; }];
  for (const mutate of mutations) {
    const r = rig(); r.at(1100); assert.equal(r.radio.observe(r.event({ pawnId: 'replacement', generation: 2 })).status, 'OBSERVED');
    r.enqueue('current', 'edge', { pawnId: 'replacement', generation: 2 }); r.radio.next();
    r.enqueue('current-queued', 'edge', { pawnId: 'replacement', generation: 2 }); r.at(1200);
    const e = r.event({ pawnId: 'replacement', generation: 2, aiOwned: null }); mutate(e);
    assert.equal(r.radio.observe(e).status, 'REJECTED');
    assert.equal(r.radio.getState().playing.lineId, 'current');
    assert.equal(r.radio.complete('current').status, 'COMPLETED'); assert.equal(r.radio.next().lineId, 'current-queued');
  }
});

test('radio binding review: delayed explicit invalidation cannot override a newer same-identity observation', () => {
  const r = rig(); r.at(1200); assert.equal(r.radio.observe(r.event()).status, 'OBSERVED');
  r.enqueue('current'); r.radio.next(); r.at(1300);
  const stale = { id: 'explicit-old', session: 'mission-review', observedAtMs: 1199, kind: 'bindingInvalidated',
    data: { speakerId: 'edge', pawnId: 'pawn-1', generation: 1 } };
  assert.equal(r.radio.observe(stale).status, 'REJECTED'); assert.equal(r.radio.getState().playing.lineId, 'current');
  assert.equal(r.radio.observe({ ...stale, id: 'explicit-current', observedAtMs: 1300 }).status, 'INVALIDATED'); unavailable(r);
  r.at(1400); assert.equal(r.radio.observe(r.event()).status, 'REJECTED');
});

test('radio binding review: invalidating a queued exchange participant preserves unrelated active speech', () => {
  const r = rig(); r.enqueue('sentinel', 'scout'); r.radio.next();
  r.enqueue('opener', 'edge', r.exchange(0)); r.enqueue('reply', 'tactician', r.exchange(1)); r.at(1100);
  r.radio.observe(r.event({ aiOwned: false }));
  assert.equal(r.radio.getState().playing.lineId, 'sentinel');
  assert.deepEqual(r.radio.getState().queue, []);
  assert.equal(r.radio.complete('sentinel').status, 'COMPLETED'); assert.equal(r.radio.next(), null);
});

test('radio binding review: revoking the queued replier cancels the linked active opener, preserving an independent answer', () => {
  const r = rig(); r.enqueue('opener', 'edge', r.exchange(0)); r.radio.next();
  r.enqueue('reply', 'tactician', r.exchange(1)); r.enqueue('sentinel', 'scout'); r.at(1100);
  r.radio.observe(r.event({ ...initial()[1], aiOwned: null }));
  assert.equal(r.radio.getState().playing, null); assert.equal(r.radio.getState().exchanges[0].cancelled, true);
  assert.equal(r.radio.next().lineId, 'sentinel'); r.radio.complete('sentinel'); assert.equal(r.radio.next(), null);
});

test('radio binding review: completed opener revocation cancels a pending or already playing reply', () => {
  for (const playingReply of [false, true]) {
    const r = rig(); r.enqueue('opener', 'edge', r.exchange(0)); r.radio.next(); r.radio.complete('opener');
    r.enqueue('reply', 'tactician', r.exchange(1)); if (playingReply) assert.equal(r.radio.next().lineId, 'reply');
    r.enqueue('sentinel', 'scout'); r.at(1100); r.radio.observe(r.event({ alive: false }));
    assert.equal(r.radio.getState().playing, null); assert.equal(r.radio.getState().exchanges[0].cancelled, true);
    assert.equal(r.radio.next().lineId, 'sentinel'); r.radio.complete('sentinel'); assert.equal(r.radio.next(), null);
  }
});

test('radio binding review: returned state cannot erase revocation or restore a cancelled exchange', () => {
  const r = rig(); r.enqueue('opener', 'edge', r.exchange(0)); r.enqueue('reply', 'tactician', r.exchange(1));
  r.radio.observe(r.event({ aiOwned: false }));
  const snapshot = r.radio.getState(); snapshot.bindings[0].invalidated = false;
  snapshot.bindings[0].aiOwned = true; snapshot.exchanges[0].cancelled = false;
  assert.equal(r.radio.getState().bindings[0].invalidated, true); assert.equal(r.radio.next(), null);
});

test('radio binding review: malformed duplicate-slot denial revokes without installing a colliding identity', () => {
  const r = rig(); r.enqueue('current'); r.radio.next(); r.at(1100);
  assert.equal(r.radio.observe(r.event({ generation: 2, aiOwned: false, slot: 2 })).reason, 'DUPLICATE_BINDING');
  unavailable(r); const bindings = r.radio.getState().bindings;
  assert.equal(bindings.find(b => b.id === 'edge').slot, 1); assert.equal(bindings.find(b => b.id === 'tactician').slot, 2);
  assert.equal(r.radio.observe(r.event({ generation: 2 })).status, 'REJECTED');
  assert.equal(r.radio.observe(r.event({ generation: 3 })).status, 'OBSERVED');
  r.enqueue('new', 'edge', { generation: 3 }); assert.equal(r.radio.next().lineId, 'new');
});

test('radio binding review: accessed binding getters never run or supply revocation authority', () => {
  for (const key of ['binding', 'id', 'pawnId', 'generation', 'alive', 'aiOwned', 'invalidated']) {
    const r = rig(); r.enqueue('current'); r.radio.next(); let reads = 0;
    const e = r.event({ aiOwned: false }); const target = key === 'binding' ? e : e.binding;
    Object.defineProperty(target, key, { enumerable: true, get() { reads++; throw Error('SIDE_EFFECT_MUST_NOT_RUN'); } });
    assert.equal(r.radio.observe(e).status, 'REJECTED'); assert.equal(reads, 0);
    assert.equal(r.radio.getState().playing.lineId, 'current');
  }
});
