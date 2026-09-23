// MOCK_ONLY: synthetic identities/events and in-memory radio; no audio/game/model.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRadioDirector } from '../radio.mjs';

const initial = () => ['edge', 'tactician', 'scout'].map((id, index) => ({ id, pawnId: `pawn-${index + 1}`,
  generation: 1, slot: index + 1, alive: true, aiOwned: true }));
function fixture() {
  let now = 1000, ordinal = 0;
  const radio = createRadioDirector({ now: () => now });
  assert.equal(radio.startMission('mission', initial()).status, 'STARTED');
  const line = (lineId, speakerId = 'edge', fields = {}) => ({ lineId, session: 'mission', speakerId,
    pawnId: initial().find(b => b.id === speakerId).pawnId, generation: 1, priority: 'answer',
    text: 'Synthetic line.', createdAtMs: now, expiresAtMs: 5000, factIds: [], ...fields });
  const update = (binding = {}, event = {}) => radio.observe({ id: `event-${ordinal++}`, session: 'mission',
    kind: 'binding', observedAtMs: now, binding: { ...initial()[0], ...binding }, ...event });
  const invalid = (data = {}, event = {}) => radio.observe({ id: `event-${ordinal++}`, session: 'mission',
    kind: 'bindingInvalidated', observedAtMs: now, data: { speakerId: 'edge', pawnId: 'pawn-1', generation: 1, ...data }, ...event });
  const queue = (id, actor = 'edge', fields) => assert.equal(radio.enqueue(line(id, actor, fields)).status, 'QUEUED');
  return { radio, line, queue, update, invalid, at: value => { now = value; } };
}

for (const [name, fields, reason] of [
  ['possession', { aiOwned: false }, 'GENERATION_MUST_ADVANCE'],
  ['death', { alive: false }, 'GENERATION_MUST_ADVANCE'],
  ['unknown ownership', { aiOwned: null }, 'INVALID_BINDING_UPDATE'],
  ['unknown life', { alive: undefined }, 'INVALID_BINDING_UPDATE']
]) test(`fresh same-generation ${name} rejects its update but immediately cancels queued and playing actor speech`, () => {
  const f = fixture(); f.queue('playing'); assert.equal(f.radio.next().lineId, 'playing');
  f.queue('queued'); f.queue('sentinel', 'scout'); f.at(1100);
  assert.deepEqual(f.update(fields), { status: 'REJECTED', reason });
  const state = f.radio.getState(); assert.equal(state.playing, null);
  assert.deepEqual(state.queue.map(l => l.lineId), ['sentinel']);
  const old = state.bindings.find(b => b.id === 'edge');
  assert.equal(old.invalidated, true); assert.equal(old.alive, true); assert.equal(old.aiOwned, true);
  assert.equal(old.generation, 1); assert.equal(old.pawnId, 'pawn-1'); // No rejected data was installed.
  assert.equal(f.radio.enqueue(f.line('late')).reason, 'BINDING_INVALID');
  assert.equal(f.update().reason, 'GENERATION_MUST_ADVANCE');
  assert.equal(f.radio.next().lineId, 'sentinel'); assert.equal(f.radio.complete('sentinel').status, 'COMPLETED');
  assert.equal(f.radio.complete('playing').reason, 'NOT_PLAYING'); assert.equal(f.radio.next(), null);
});

test('a greater unknown generation raises an internal floor that caller fields or lower generations cannot erase', () => {
  const f = fixture(); f.queue('old'); f.at(1100);
  assert.equal(f.update({ aiOwned: null, generation: 5 }).reason, 'INVALID_BINDING_UPDATE');
  f.at(1200);
  for (const generation of [1, 2, 4]) {
    assert.equal(f.update({ generation, invalidated: false, revokedGeneration: 0 }).reason, 'INVALID_BINDING_UPDATE');
    assert.equal(f.radio.enqueue(f.line('below-' + generation, 'edge', { generation })).reason, 'BINDING_INVALID');
  }
  assert.equal(f.update({ generation: 5 }).reason, 'GENERATION_MUST_ADVANCE');
  assert.equal(f.update({ generation: 6 }, { observedAtMs: 1050 }).reason, 'STALE_BINDING_UPDATE');
  assert.equal(f.update({ generation: 6 }).status, 'OBSERVED');
  f.queue('new', 'edge', { generation: 6 }); assert.equal(f.radio.next().lineId, 'new');
  assert.equal(f.radio.getState().queue.some(l => l.lineId === 'old'), false);
});

test('valid higher-generation negative bindings stay accepted and recovery requires a further generation', () => {
  const f = fixture(); f.queue('old'); f.at(1100);
  assert.equal(f.update({ generation: 2, aiOwned: false }).status, 'OBSERVED'); assert.equal(f.radio.next(), null);
  assert.equal(f.radio.getState().bindings[0].aiOwned, false);
  assert.equal(f.update({ generation: 2 }).reason, 'GENERATION_MUST_ADVANCE');
  assert.equal(f.update({ generation: 3 }).status, 'OBSERVED');
  f.queue('recovered', 'edge', { generation: 3 }); assert.equal(f.radio.next().lineId, 'recovered');
});

test('stale, future, older-generation and foreign references cannot invalidate a valid replacement', () => {
  const cases = [
    [{ aiOwned: null, pawnId: 'new-pawn', generation: 3 }, { observedAtMs: 1050 }],
    [{ aiOwned: false, pawnId: 'new-pawn', generation: 3 }, { observedAtMs: 1201 }],
    [{ aiOwned: false, pawnId: 'new-pawn', generation: 2 }, {}],
    [{ aiOwned: null, pawnId: 'pawn-1', generation: 5 }, {}],
    [{ aiOwned: null, pawnId: null, generation: 5 }, {}],
    [{ aiOwned: false, pawnId: 'new-pawn', generation: 3 }, { session: 'foreign' }],
    [{ id: 'unknown', pawnId: 'new-pawn', aiOwned: null, generation: 5 }, {}],
    [{ aiOwned: null, pawnId: 'new-pawn', generation: null }, {}]
  ];
  for (const [binding, event] of cases) {
    const f = fixture(); f.at(1100); assert.equal(f.update({ pawnId: 'new-pawn', generation: 3 }).status, 'OBSERVED');
    f.queue('valid', 'edge', { pawnId: 'new-pawn', generation: 3 }); f.radio.next(); f.at(1200);
    assert.equal(f.update(binding, event).status, 'REJECTED');
    assert.equal(f.radio.getState().playing.lineId, 'valid');
    assert.notEqual(f.radio.getState().bindings[0].invalidated, true);
  }
});

test('explicit invalidation respects fresh per-actor timestamps and cannot act on replaced identity', () => {
  const f = fixture(); f.at(1100); assert.equal(f.update().status, 'OBSERVED');
  f.queue('valid'); f.radio.next(); f.at(1200);
  assert.equal(f.invalid({}, { observedAtMs: 1050 }).reason, 'STALE_BINDING_UPDATE');
  assert.equal(f.radio.getState().playing.lineId, 'valid');
  assert.equal(f.invalid().status, 'INVALIDATED'); assert.equal(f.radio.getState().playing, null);
  assert.equal(f.update().reason, 'GENERATION_MUST_ADVANCE');
  f.at(1300); assert.equal(f.update({ pawnId: 'replacement', generation: 2 }).status, 'OBSERVED');
  f.queue('replacement', 'edge', { pawnId: 'replacement', generation: 2 }); f.radio.next();
  assert.equal(f.invalid().reason, 'BINDING_MISMATCH');
  assert.equal(f.radio.getState().playing.lineId, 'replacement');
});

test('revoking a queued actor preserves an unrelated playing teammate and its queued answer', () => {
  const f = fixture(); f.queue('sentinel-playing', 'scout'); f.radio.next();
  f.queue('affected'); f.queue('sentinel-queued', 'tactician'); f.at(1100);
  assert.equal(f.update({ aiOwned: null }).status, 'REJECTED');
  const state = f.radio.getState(); assert.equal(state.playing.lineId, 'sentinel-playing');
  assert.deepEqual(state.queue.map(l => l.lineId), ['sentinel-queued']);
  f.radio.complete('sentinel-playing'); assert.equal(f.radio.next().lineId, 'sentinel-queued');
});

function exchangeFixture() {
  const f = fixture();
  assert.equal(f.radio.observe({ id: 'fact', session: 'mission', observedAtMs: 1000, kind: 'fact',
    verified: true, data: { synthetic: true }, expiresAtMs: 5000 }).status, 'OBSERVED');
  const exchange = { priority: 'banter', factIds: ['fact'], exchangeId: 'exchange' };
  f.queue('opener', 'edge', { ...exchange, exchangeTurn: 0 });
  f.queue('reply', 'tactician', { ...exchange, exchangeTurn: 1 });
  return { ...f, exchange };
}

test('revoking a completed exchange opener cancels its queued or playing reply and blocks later continuation', () => {
  for (const replyPlaying of [false, true]) {
    const f = exchangeFixture(); assert.equal(f.radio.next().lineId, 'opener'); f.radio.complete('opener');
    if (replyPlaying) assert.equal(f.radio.next().lineId, 'reply');
    f.queue('sentinel', 'scout'); f.at(1100); f.update({ aiOwned: null });
    assert.equal(f.radio.getState().playing, null); assert.equal(f.radio.getState().exchanges[0].cancelled, true);
    assert.equal(f.radio.next().lineId, 'sentinel'); f.radio.complete('sentinel'); assert.equal(f.radio.next(), null);
    assert.equal(f.radio.enqueue(f.line('late-reply', 'scout', { ...f.exchange, exchangeTurn: 1 })).reason, 'EXCHANGE_INVALID_REPLY');
  }
});

test('revoking a queued exchange reply also cancels the linked opener without clearing unrelated speech', () => {
  const f = exchangeFixture(); assert.equal(f.radio.next().lineId, 'opener'); f.queue('sentinel', 'scout'); f.at(1100);
  assert.equal(f.update({ ...initial()[1], alive: null }).reason, 'INVALID_BINDING_UPDATE');
  assert.equal(f.radio.getState().playing, null); assert.equal(f.radio.getState().exchanges[0].cancelled, true);
  assert.equal(f.radio.next().lineId, 'sentinel'); f.radio.complete('sentinel'); assert.equal(f.radio.next(), null);
});

test('new deny-only identity reads reject accessors without invoking them or guessing a binding', () => {
  for (const key of ['id', 'pawnId', 'generation', 'alive', 'aiOwned']) {
    const f = fixture(); f.queue('valid'); f.radio.next(); f.at(1100);
    let getterCalls = 0; const b = initial()[0];
    Object.defineProperty(b, key, { enumerable: true, get() { getterCalls++; return null; } });
    assert.equal(f.update({}, { binding: b }).reason, 'INVALID_BINDING_UPDATE'); assert.equal(getterCalls, 0);
    assert.equal(f.radio.getState().playing.lineId, 'valid');
  }
});

test('an explicitly new mission clears the old denial floor but reused sessions cannot reset it', () => {
  const f = fixture(); f.at(1100); f.update({ generation: 8, aiOwned: null });
  assert.equal(f.radio.startMission('mission', initial()).reason, 'NEW_SESSION_REQUIRED');
  assert.equal(f.update({ generation: 2 }).reason, 'INVALID_BINDING_UPDATE');
  assert.equal(f.radio.startMission('new-mission', initial()).status, 'STARTED');
  assert.equal(f.radio.enqueue(f.line('new-mission-line', 'edge', { session: 'new-mission' })).status, 'QUEUED');
  assert.equal(f.radio.next().lineId, 'new-mission-line');
});
