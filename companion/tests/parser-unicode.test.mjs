// MOCK_ONLY: pure parser fixtures. No recognition, server, native adapter or dispatch.
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSpokenCommand } from '../radio.mjs';

const bindings = () => ['kite', 'bravo', 'charlie'].map((id, index) => ({ id,
  pawnId: `pawn-${index + 1}`, generation: index + 1, slot: index + 1,
  alive: true, aiOwned: true }));
const request = (text, extra = {}) => ({ text, origin: 'human_ptt', final: true,
  session: 'unicode-parser-fixture', bindings: bindings(), ...extra });
const maps = [
  ['omitted callsign map', {}],
  ['undefined callsign map', { callsigns: undefined }],
  ['empty callsign map', { callsigns: [] }]
];
function intent(result, action, recipientIds) {
  assert.equal(result.status, 'INTENT', JSON.stringify(result));
  assert.equal(result.action, action); assert.deepEqual(result.recipientIds, recipientIds);
  assert.equal(result.classification, 'PROJECT_INTENT'); assert.equal(result.dispatchable, false);
}

for (const [label, map] of maps) {
  test(`unsupported Unicode actor spelling cannot select ASCII identity with ${label}`, () => {
    // U+212A lowercases to ASCII k under JavaScript Unicode case conversion.
    for (const text of ['regroup actor \u212Aite', 'actor \u212Aite regroup', 'focus actor \u212Aite']) {
      const result = parseSpokenCommand(request(text, { ...map, selectedTargetId: 'hostile-1' }));
      assert.ok(['CLARIFICATION', 'REJECTED'].includes(result.status), JSON.stringify(result));
      assert.equal(result.recipientIds, undefined); assert.notEqual(result.dispatchable, true);
    }
  });

  test(`ordinary ASCII actor case matching works with ${label}`, () => {
    for (const text of ['REGROUP ACTOR KITE', 'actor KiTe regroup!'])
      intent(parseSpokenCommand(request(text, map)), 'REGROUP', ['kite']);
  });
}

test('explicit actor matching returns the exact configured ASCII identity and binding', () => {
  const current = bindings(); current[0].id = 'Kite-01';
  const result = parseSpokenCommand(request('regroup actor KITE-01', { bindings: current }));
  intent(result, 'REGROUP', ['Kite-01']); assert.deepEqual(result.bindings, [current[0]]);
  result.bindings[0].pawnId = 'mutated'; assert.equal(current[0].pawnId, 'pawn-1');
});

test('ASCII slot and release grammar remain available without a callsign map', () => {
  intent(parseSpokenCommand(request('REGROUP SLOT 1 AND SLOT 3!')), 'REGROUP', ['kite', 'charlie']);
  intent(parseSpokenCommand(request('RELEASE HUMAN HOLD SLOT 2')), 'RELEASE_HUMAN_HOLD', ['bravo']);
});

test('global ASCII disarm does not access unused hostile context fields', () => {
  let reads = 0;
  const input = { text: '  DISARM!  ', origin: 'human_ptt', final: true, session: 'unicode-parser-fixture' };
  for (const key of ['bindings', 'callsigns', 'locations', 'selectedTargetId']) {
    Object.defineProperty(input, key, { enumerable: true, get() {
      reads++; throw new Error('UNUSED_CONTEXT_ACCESSED');
    } });
  }
  let result; assert.doesNotThrow(() => { result = parseSpokenCommand(input); });
  intent(result, 'DISARM', []); assert.equal(result.scope, 'ALL_COMPANION_CONTROL');
  assert.equal(reads, 0);
});
