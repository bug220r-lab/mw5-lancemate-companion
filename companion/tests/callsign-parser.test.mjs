import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCallsign, callsignRoutability } from '../callsigns.mjs';
import { parseSpokenCommand } from '../radio.mjs';

// MOCK_ONLY: project intentions, with no recognition engine, game adapter or dispatch.
const bindings = () => ['alpha', 'bravo', 'charlie'].map((id, i) => ({ id, pawnId: `pawn-${i + 1}`,
  generation: i + 7, slot: i + 1, alive: true, aiOwned: true }));
const names = () => [{ actorId: 'alpha', callsign: 'Rook' }, { actorId: 'bravo', callsign: 'Night Hawk' },
  { actorId: 'charlie', callsign: "O'Brien" }];
const parse = (text, extra = {}) => parseSpokenCommand({ text, origin: 'human_ptt', final: true,
  session: 'mock-mission', bindings: bindings(), callsigns: names(), ...extra });

test('normalization is bounded and exact, with explicit unset and no Unicode folding', () => {
  assert.equal(normalizeCallsign('  NIGHT   Hawk '), 'night hawk');
  assert.equal(normalizeCallsign(null), null); assert.equal(normalizeCallsign('   '), null);
  for (const value of [undefined, 7, {}, 'x'.repeat(65), 'Rook\n', 'Rook\x7f']) assert.throws(() => normalizeCallsign(value), /INVALID_CALLSIGN/);
  assert.equal(normalizeCallsign('Kite'), 'Kite'); assert.equal(normalizeCallsign('ÉCHO'), 'Écho');
  assert.equal(callsignRoutability('Écho').reason, 'UNSUPPORTED_CALLSIGN_CHARACTERS');
  assert.deepEqual(callsignRoutability(' Night Hawk '), { normalized: 'night hawk', routable: true, reason: null });
});

test('routability distinguishes display-only grammar and actor collisions without guessing', () => {
  for (const name of ['slot 2', 'actor alpha', 'regroup', 'Rook and Spark', 'all', 'hold-fast', "focus'fire"])
    assert.equal(callsignRoutability(name).reason, 'RESERVED_CALLSIGN', name);
  for (const name of ['Rook, Spark', 'Rook!', '2 Rook', 'Night--Hawk'])
    assert.equal(callsignRoutability(name).reason, 'UNSUPPORTED_CALLSIGN_CHARACTERS', name);
  assert.equal(callsignRoutability('ALPHA', { actorIds: ['alpha'] }).reason, 'ACTOR_ID_CALLSIGN_COLLISION');
  assert.equal(callsignRoutability(null).reason, 'CALLSIGN_UNSET');
  assert.equal(callsignRoutability('Rook', { actorIds: ['unknown', 'ids', 'are', 'too-many'] }).reason, 'INVALID_ACTOR_IDS');
});

test('configured names select exact actor/pawn/generation independently of array order', () => {
  const b = bindings().reverse(), map = names().reverse();
  const result = parse('  nIgHt   HaWk REGROUP! ', { bindings: b, callsigns: map });
  assert.equal(result.status, 'INTENT'); assert.equal(result.action, 'REGROUP');
  assert.deepEqual(result.recipientIds, ['bravo']); assert.deepEqual(result.bindings, [b[1]]);
  assert.equal(result.dispatchable, false); assert.equal(result.classification, 'PROJECT_INTENT');
});

test('front and back verbs, explicit callsign selector and mixed exact recipient lists work', () => {
  for (const text of ['regroup Rook', 'Rook regroup', 'regroup callsign Rook', 'callsign Rook regroup'])
    assert.deepEqual(parse(text).recipientIds, ['alpha'], text);
  assert.deepEqual(parse("regroup Rook and actor bravo, O'Brien").recipientIds, ['alpha', 'bravo', 'charlie']);
  assert.deepEqual(parse('release human hold Night Hawk').recipientIds, ['bravo']);
  assert.equal(parse('Night Hawk release').action, 'RELEASE_HUMAN_HOLD');
});

test('target and location prerequisites remain required for named selectors', () => {
  assert.equal(parse('focus Rook').reason, 'KNOWN_SELECTED_TARGET_REQUIRED');
  assert.equal(parse('focus Rook', { selectedTargetId: 'target-A' }).targetId, 'target-A');
  assert.equal(parse('reposition Night Hawk to location ridge').reason, 'KNOWN_NAMED_LOCATION_REQUIRED');
  const result = parse('reposition Night Hawk to location ridge', { locations: [{ id: 'Ridge' }] });
  assert.equal(result.locationId, 'Ridge'); assert.deepEqual(result.recipientIds, ['bravo']);
});

test('unset, partial, approximate and absent names never imply recipients', () => {
  for (const text of ['regroup Night', 'regroup Hawk', 'regroup Rookie', 'regroup Rock', 'regroup Rook please'])
    assert.equal(parse(text).reason, 'UNKNOWN_CALLSIGN', text);
  assert.equal(parse('regroup Rook', { callsigns: [{ actorId: 'alpha', callsign: null }] }).reason, 'UNKNOWN_CALLSIGN');
  assert.equal(parse('Rook regroup', { callsigns: undefined }).reason, 'AMBIGUOUS_RECIPIENT');
  assert.deepEqual(parse('regroup slot 1', { callsigns: undefined }).recipientIds, ['alpha']);
  const decorated = bindings(); decorated[0].callsign = 'Frost';
  assert.equal(parse('Frost regroup', { bindings: decorated, callsigns: undefined, facts: [{ callsign: 'Frost' }], persona: { callsign: 'Frost' } }).reason, 'AMBIGUOUS_RECIPIENT');
});

test('duplicate case/space-normalized names clarify only when selected', () => {
  const callsigns = [{ actorId: 'alpha', callsign: ' Night Hawk ' }, { actorId: 'bravo', callsign: 'NIGHT   HAWK' }];
  assert.equal(parse('Night Hawk regroup', { callsigns }).reason, 'AMBIGUOUS_CALLSIGN');
  assert.deepEqual(parse('regroup slot 1', { callsigns }).recipientIds, ['alpha']);
  assert.deepEqual(parse('actor bravo regroup', { callsigns }).recipientIds, ['bravo']);
});

test('explicit selectors retain their meaning despite colliding saved display names', () => {
  const callsigns = [{ actorId: 'alpha', callsign: 'slot 2' }, { actorId: 'bravo', callsign: 'actor charlie' }];
  assert.deepEqual(parse('regroup slot 2', { callsigns }).recipientIds, ['bravo']);
  assert.deepEqual(parse('regroup actor charlie', { callsigns }).recipientIds, ['charlie']);
  assert.equal(parse('regroup callsign slot 2', { callsigns }).reason, 'RESERVED_CALLSIGN');
  assert.equal(parse('regroup callsign actor charlie', { callsigns }).reason, 'RESERVED_CALLSIGN');
});

test('compound configured names cannot silently become multiple recipients', () => {
  const callsigns = [{ actorId: 'alpha', callsign: 'Rook' }, { actorId: 'bravo', callsign: 'Spark' },
    { actorId: 'charlie', callsign: 'Rook and Spark' }];
  assert.equal(parse('regroup Rook and Spark', { callsigns }).reason, 'RESERVED_CALLSIGN');
  assert.equal(parse('regroup callsign Rook and Spark', { callsigns }).reason, 'RESERVED_CALLSIGN');
  callsigns[2].callsign = 'Rook, Spark';
  assert.equal(parse('regroup Rook, Spark', { callsigns }).reason, 'UNSUPPORTED_CALLSIGN_CHARACTERS');
  assert.deepEqual(parse('regroup slot 1 and slot 2', { callsigns }).recipientIds, ['alpha', 'bravo']);
});

test('repeating one actor through different selector forms is rejected', () => {
  for (const text of ['regroup Rook and slot 1', 'regroup callsign Rook and actor alpha', 'regroup Rook and Rook'])
    assert.equal(parse(text).reason, 'UNKNOWN_OR_DUPLICATE_RECIPIENT');
});

test('terminal sentence punctuation cannot erase another configured pilot name', () => {
  for (const suffix of ['!', '?', '.', '...', '!?']) {
    const callsigns = [{ actorId: 'alpha', callsign: `Rook${suffix}` }, { actorId: 'bravo', callsign: 'Rook' }];
    for (const ending of ['', '?', '!?']) {
      assert.equal(parse(`regroup callsign Rook${suffix}${ending}`, { callsigns }).reason, 'UNSUPPORTED_CALLSIGN_CHARACTERS');
      assert.equal(parse(`regroup Rook${suffix}${ending}`, { callsigns }).reason, 'UNSUPPORTED_CALLSIGN_CHARACTERS');
    }
    assert.deepEqual(parse('Rook regroup!', { callsigns }).recipientIds, ['bravo']);
    assert.deepEqual(parse('regroup slot 2!', { callsigns }).recipientIds, ['bravo']);
  }
});

test('invalid alias maps fail atomically instead of using an apparently valid first row', () => {
  const bad = [null, {}, new Array(2), Array(4).fill(names()[0]), [{ actorId: 'missing', callsign: 'Ghost' }],
    [names()[0], { actorId: 'alpha', callsign: 'Spark' }], [{ actorId: 'alpha', callsign: {}, extra: true }],
    [{ actorId: 'alpha', callsign: 'Rook', profileId: 'edge' }]];
  for (const callsigns of bad) assert.equal(parse('regroup Rook', { callsigns }).reason, 'INVALID_CALLSIGNS');
});

test('read metadata accessors are rejected without invoking them', () => {
  let reads = 0; const getter = { get() { reads++; throw Error('must not execute'); }, enumerable: true };
  const row = { actorId: 'alpha' }; Object.defineProperty(row, 'callsign', getter);
  assert.equal(parse('regroup Rook', { callsigns: [row] }).reason, 'INVALID_CALLSIGNS');
  const rows = names(); Object.defineProperty(rows, '0', getter);
  assert.equal(parse('regroup Rook', { callsigns: rows }).reason, 'INVALID_CALLSIGNS');
  const b = bindings(); Object.defineProperty(b[0], 'id', getter);
  assert.equal(parse('regroup Rook', { bindings: b }).reason, 'INVALID_CONTEXT');
  const input = { origin: 'human_ptt', final: true, session: 'mock' }; Object.defineProperty(input, 'text', getter);
  assert.equal(parseSpokenCommand(input).reason, 'INVALID_CONTEXT');
  const options = {}; Object.defineProperty(options, 'actorIds', getter);
  assert.equal(callsignRoutability('Rook', options).reason, 'INVALID_ACTOR_IDS');
  assert.equal(reads, 0);
});

test('global disarm ignores hostile unused metadata while human trust remains mandatory', () => {
  let reads = 0; const input = { text: 'DISARM!', origin: 'human_ptt', final: true, session: 'mock' };
  for (const key of ['bindings', 'callsigns', 'locations', 'selectedTargetId']) Object.defineProperty(input, key, { get() { reads++; throw Error('unused'); } });
  const result = parseSpokenCommand(input);
  assert.equal(result.action, 'DISARM'); assert.equal(result.scope, 'ALL_COMPANION_CONTROL'); assert.equal(reads, 0);
  for (const origin of ['model', 'generated_audio', 'human_text']) assert.equal(parse('regroup Rook', { origin }).reason, 'TRUSTED_FINAL_HUMAN_PTT_REQUIRED');
  assert.equal(parse('regroup Rook', { final: false }).reason, 'TRUSTED_FINAL_HUMAN_PTT_REQUIRED');
});

test('named recipients still require alive, AI-owned, noninvalidated current binding', () => {
  for (const change of [{ alive: false }, { aiOwned: false }, { invalidated: true }]) {
    const b = bindings(); Object.assign(b[0], change);
    assert.equal(parse('regroup Rook', { bindings: b }).reason, 'INELIGIBLE_RECIPIENT');
    assert.deepEqual(parse('disarm Rook', { bindings: b }).recipientIds, ['alpha']);
  }
});

test('ASCII actor IDs that collide under case matching retain exact alias joins', () => {
  const b = bindings(); b[1].id = 'ALPHA';
  const callsigns = [{ actorId: 'alpha', callsign: 'Rook' }, { actorId: 'ALPHA', callsign: 'Spark' }];
  assert.equal(parse('regroup actor alpha', { bindings: b, callsigns }).reason, 'UNKNOWN_OR_DUPLICATE_RECIPIENT');
  assert.deepEqual(parse('regroup Spark', { bindings: b, callsigns }).recipientIds, ['ALPHA']);
});

test('input names and binding arrays remain untouched and returned bindings are independent', () => {
  const input = { text: 'regroup Rook', origin: 'human_ptt', final: true, session: 'mock', bindings: bindings(), callsigns: names() };
  const before = structuredClone(input), result = parseSpokenCommand(input);
  result.bindings[0].pawnId = 'changed';
  assert.deepEqual(input, before);
});
