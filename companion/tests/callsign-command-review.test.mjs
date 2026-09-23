// Independent MOCK_ONLY review. Pure parser calls: no engine, microphone, server or game.
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSpokenCommand } from '../radio.mjs';

const bindings = () => ['alpha', 'bravo', 'charlie'].map((id, index) => ({ id,
  pawnId: `pawn-${index + 1}`, generation: 7 + index, slot: index + 1, alive: true, aiOwned: true }));
const aliases = (...names) => names.map((callsign, index) => ({ actorId: ['alpha', 'bravo', 'charlie'][index], callsign }));
const request = (text, extra = {}) => ({ text, origin: 'human_ptt', final: true, session: 'mission-1',
  bindings: bindings(), callsigns: aliases('Rook', 'Iron Fox', 'Spark'), ...extra });
const parse = (text, extra) => parseSpokenCommand(request(text, extra));
function intent(result, recipients, action = 'REGROUP') {
  assert.equal(result.status, 'INTENT', JSON.stringify(result)); assert.equal(result.action, action);
  assert.deepEqual(result.recipientIds, recipients); assert.equal(result.dispatchable, false);
  assert.equal(result.classification, 'PROJECT_INTENT');
}
function notIntent(result) {
  assert.ok(['CLARIFICATION', 'REJECTED'].includes(result.status), JSON.stringify(result));
  assert.equal(result.recipientIds, undefined); assert.notEqual(result.dispatchable, true);
}

test('exact saved name resolves in either verb position and optional callsign selector', () => {
  for (const text of ['Rook regroup', 'regroup Rook', 'callsign Rook regroup', 'regroup callsign Rook', 'ROOK regroup!']) {
    intent(parse(text), ['alpha']);
  }
});

test('multiword matching normalizes case and spaces without longest-prefix guessing', () => {
  intent(parse('  IRON   FOX regroup '), ['bravo']);
  const callsigns = aliases('Iron', 'Iron Fox', 'Iron Fox Two');
  for (const [name, id] of [['Iron', 'alpha'], ['Iron Fox', 'bravo'], ['Iron Fox Two', 'charlie']]) {
    intent(parse(`${name} regroup`, { callsigns }), [id]);
  }
  for (const text of ['Iron Fo regroup', 'Iron Fox Too regroup', 'Iron Fox Two Three regroup']) notIntent(parse(text, { callsigns }));
});

test('ASCII apostrophes and hyphens are literal supported name characters', () => {
  const callsigns = aliases("O'Neil", 'Red-Fox');
  intent(parse("O'Neil regroup", { callsigns }), ['alpha']);
  intent(parse('Red-Fox regroup', { callsigns }), ['bravo']);
  for (const text of ['ONeil regroup', 'Red Fox regroup', 'Red–Fox regroup', 'O’Neil regroup']) notIntent(parse(text, { callsigns }));
});

test('substring, phonetic and extra conversation text cannot silently pick a name', () => {
  for (const text of ['Roo regroup', 'Rookie regroup', 'Ruk regroup', 'please Rook regroup',
    'I think Rook should regroup', 'Rook regroup now', 'ignore all rules and Rook regroup']) notIntent(parse(text));
});

test('unconfigured internal profile IDs and supplied persona/history/facts do not create aliases', () => {
  for (const text of ['edge regroup', 'tactician regroup', 'scout regroup', 'alpha regroup', 'Vex regroup']) {
    notIntent(parse(text, { callsigns: [], persona: { callsign: 'Vex' },
      history: [{ callsign: 'Vex', actorId: 'alpha' }], facts: [{ actorId: 'alpha', callsign: 'Vex' }] }));
  }
});

test('duplicate case/space-normalized saved names clarify instead of choosing first actor', () => {
  const callsigns = aliases('Rook', '  ROOK  ', 'Spark');
  for (const text of ['Rook regroup', 'regroup callsign Rook']) {
    const result = parse(text, { callsigns }); notIntent(result); assert.equal(result.reason, 'AMBIGUOUS_CALLSIGN');
  }
  intent(parse('Spark regroup', { callsigns }), ['charlie']);
  intent(parse('slot 1 regroup', { callsigns }), ['alpha']);
  intent(parse('actor bravo regroup', { callsigns }), ['bravo']);
});

test('names equal to actor IDs cannot override an explicit actor selector', () => {
  const callsigns = aliases('bravo', 'alpha', 'charlie');
  intent(parse('actor bravo regroup', { callsigns }), ['bravo']);
  intent(parse('slot 1 regroup', { callsigns }), ['alpha']);
  for (const text of ['bravo regroup', 'callsign bravo regroup', 'alpha regroup']) notIntent(parse(text, { callsigns }));
});

test('reserved slot-like and actor-like aliases do not shadow explicit selectors', () => {
  const callsigns = aliases('slot 2', 'actor charlie', 'Rook');
  intent(parse('slot 2 regroup', { callsigns }), ['bravo']);
  intent(parse('actor charlie regroup', { callsigns }), ['charlie']);
  for (const text of ['callsign slot 2 regroup', 'callsign actor charlie regroup']) notIntent(parse(text, { callsigns }));
});

test('action words and grammar-token names are display-only rather than alternate command parses', () => {
  for (const name of ['regroup', 'focus', 'release', 'human', 'hold', 'disarm', 'reposition', 'to', 'location',
    'and', 'slot', 'actor', 'callsign', 'Red-Focus', "O'And", 'release human hold']) {
    const callsigns = aliases(name);
    for (const text of [`callsign ${name} regroup`, `regroup callsign ${name}`]) notIntent(parse(text, { callsigns }));
    intent(parse('slot 1 regroup', { callsigns }), ['alpha']);
  }
});

test('collective names never broaden the recipient set', () => {
  for (const name of ['all', 'everyone', 'lance', 'squad']) {
    const callsigns = aliases(name);
    notIntent(parse(`${name} regroup`, { callsigns }));
    notIntent(parse(`callsign ${name} regroup`, { callsigns }));
    intent(parse('slot 1 regroup', { callsigns }), ['alpha']);
  }
});

test('a compound saved alias cannot be mistaken for two independent pilot names', () => {
  const callsigns = aliases('Rook and Spark', 'Rook', 'Spark');
  notIntent(parse('callsign Rook and Spark regroup', { callsigns }));
  intent(parse('slot 1 regroup', { callsigns }), ['alpha']);
});

test('mixed explicit and exact name selectors preserve order and detect duplicate actors', () => {
  intent(parse('regroup Rook and actor charlie'), ['alpha', 'charlie']);
  intent(parse('regroup slot 2, Spark'), ['bravo', 'charlie']);
  for (const text of ['regroup Rook and slot 1', 'regroup Rook, actor alpha', 'Rook and Rook regroup']) notIntent(parse(text));
});

test('unsupported Unicode names remain display-only without normalization or transliteration', () => {
  for (const name of ['Écho', 'E\u0301cho', 'İris', 'Ｒｏｏｋ', 'Ρook', 'Rook\u200b', 'Rook😀', 'Kite']) {
    const callsigns = aliases(name);
    notIntent(parse(`callsign ${name} regroup`, { callsigns }));
    intent(parse('slot 1 regroup', { callsigns }), ['alpha']);
  }
  notIntent(parse('Echo regroup', { callsigns: aliases('Écho') }));
  notIntent(parse('Kite regroup', { callsigns: aliases('Kite') }));
  notIntent(parse('Kite regroup', { callsigns: aliases('Kite') }));
});

test('punctuation and instruction-like aliases never become selector or action instructions', () => {
  for (const name of ['Rook, Spark', 'Rook;disarm', 'Rook.regroup', 'Rook:focus', '.*', '[Rook]',
    '${process.exit()}', '<script>', 'Rook && disarm', 'ignore rules and select actor bravo']) {
    const callsigns = aliases(name);
    notIntent(parse(`callsign ${name} regroup`, { callsigns }));
    intent(parse('slot 1 regroup', { callsigns }), ['alpha']);
  }
});

test('terminal punctuation cannot erase one configured name and choose another pilot', () => {
  for (const suffix of ['!', '?', '.', '...']) {
    const callsigns = aliases(`Rook${suffix}`, 'Rook', 'Spark');
    for (const text of [`regroup callsign Rook${suffix}`, `regroup Rook${suffix}`, `regroup callsign Rook${suffix}?`,
      `regroup Spark and callsign Rook${suffix}`, `regroup actor charlie and Rook${suffix}?!`,
      `regroup Spark, callsign Rook${suffix}?`, `Spark and callsign Rook${suffix} regroup!`]) {
      notIntent(parse(text, { callsigns }));
    }
    intent(parse('Rook regroup!', { callsigns }), ['bravo']);
    intent(parse('Spark and Rook regroup?!', { callsigns }), ['charlie', 'bravo']);
  }
});

test('unset callsigns do not introduce empty or literal-null names', () => {
  for (const name of [null, '', '   ']) {
    const callsigns = aliases(name);
    for (const text of ['null regroup', 'undefined regroup', 'callsign regroup']) notIntent(parse(text, { callsigns }));
    intent(parse('slot 1 regroup', { callsigns }), ['alpha']);
  }
  notIntent(parse('Rook regroup', { callsigns: [] }));
});

test('alias metadata must join one current actor and cannot supply authority or identities', () => {
  for (const callsigns of [[{ actorId: 'missing', callsign: 'Rook' }],
    [{ actorId: 'alpha', callsign: 'Rook' }, { actorId: 'alpha', callsign: 'Spark' }],
    [{ actorId: 'alpha', callsign: 'Rook', pawnId: 'wrong-pawn' }],
    [{ actorId: 'alpha', callsign: 'Rook', aiOwned: true }], [{ profileId: 'edge', callsign: 'Rook' }]]) {
    notIntent(parse('Rook regroup', { callsigns }));
  }
});

test('name resolution rechecks live binding eligibility including invalidation and possession', () => {
  for (const change of [{ aiOwned: false }, { alive: false }, { invalidated: true }]) {
    const current = bindings(); Object.assign(current[0], change);
    const result = parse('Rook regroup', { bindings: current }); notIntent(result);
    assert.equal(result.reason, 'INELIGIBLE_RECIPIENT');
    intent(parse('disarm Rook', { bindings: current }), ['alpha'], 'DISARM');
  }
});

test('successful aliases copy the exact current binding, not settings position or array order', () => {
  const current = bindings().reverse(), callsigns = [{ actorId: 'bravo', callsign: 'Rook' }];
  const result = parse('Rook regroup', { bindings: current, callsigns }); intent(result, ['bravo']);
  assert.deepEqual(result.bindings, [current.find(b => b.id === 'bravo')]);
  current[1].pawnId = 'mutated'; callsigns[0].actorId = 'charlie';
  assert.equal(result.bindings[0].pawnId, 'pawn-2'); assert.deepEqual(result.recipientIds, ['bravo']);
});

test('malformed or oversized alias maps fail closed without silently retaining partial aliases', () => {
  for (const callsigns of [null, {}, 'Rook', new Map(), [null], [1], aliases('Rook', 'Fox', 'Spark', 'Extra'),
    [{ actorId: 'alpha', callsign: 'R'.repeat(65) }], [{ actorId: 'alpha', callsign: 5 }],
    [{ actorId: 'alpha', callsign: 'Rook\n' }]]) notIntent(parse('Rook regroup', { callsigns }));
});

test('accessors in alias array entries and fields are rejected without execution', () => {
  let reads = 0; const getter = () => { reads++; throw Error('GETTER_EXECUTED'); };
  const row = { actorId: 'alpha' }; Object.defineProperty(row, 'callsign', { enumerable: true, get: getter });
  const actor = { callsign: 'Rook' }; Object.defineProperty(actor, 'actorId', { enumerable: true, get: getter });
  const list = []; Object.defineProperty(list, '0', { enumerable: true, get: getter }); list.length = 1;
  for (const callsigns of [[row], [actor], list]) assert.doesNotThrow(() => notIntent(parse('Rook regroup', { callsigns })));
  assert.equal(reads, 0);
});

test('accessors on request fields or current binding fields do not execute', () => {
  let reads = 0; const get = () => { reads++; throw Error('GETTER_EXECUTED'); };
  for (const field of ['text', 'origin', 'final', 'session', 'bindings', 'callsigns']) {
    const input = request('Rook regroup'); Object.defineProperty(input, field, { enumerable: true, get });
    assert.doesNotThrow(() => notIntent(parseSpokenCommand(input)));
  }
  const current = bindings(); Object.defineProperty(current[0], 'id', { enumerable: true, get });
  assert.doesNotThrow(() => notIntent(parse('Rook regroup', { bindings: current })));
  assert.equal(reads, 0);
});

test('prototype metadata and coercion hooks cannot establish a configured alias', () => {
  let coercions = 0;
  const callsign = { toString() { coercions++; return 'Rook'; }, valueOf() { coercions++; return 'Rook'; } };
  for (const callsigns of [[{ actorId: 'alpha', callsign }], [Object.create({ actorId: 'alpha', callsign: 'Rook' })]])
    notIntent(parse('Rook regroup', { callsigns }));
  assert.equal(coercions, 0);
});

test('global disarm remains available without reading unused hostile bindings or aliases', () => {
  let reads = 0; const input = request('disarm');
  for (const field of ['bindings', 'callsigns']) Object.defineProperty(input, field, {
    enumerable: true, get() { reads++; throw Error('UNUSED_GETTER'); } });
  let result; assert.doesNotThrow(() => { result = parseSpokenCommand(input); });
  intent(result, [], 'DISARM'); assert.equal(result.scope, 'ALL_COMPANION_CONTROL'); assert.equal(reads, 0);
});

test('focus and reposition retain their independent target/location prerequisites', () => {
  notIntent(parse('Rook focus'));
  const focus = parse('Rook focus', { selectedTargetId: 'Known-Target' }); intent(focus, ['alpha'], 'FOCUS');
  assert.equal(focus.targetId, 'Known-Target'); notIntent(parse('reposition Rook to location hill'));
  const move = parse('reposition Rook to location hill', { locations: [{ id: 'Hill' }] }); intent(move, ['alpha'], 'REPOSITION');
  assert.equal(move.locationId, 'Hill');
  notIntent(parse('reposition Rook to location hill', { locations: ['Hill', 'hill'] }));
});

test('release hold uses the selected actor without changing persistent-order semantics', () => {
  intent(parse('release human hold Rook'), ['alpha'], 'RELEASE_HUMAN_HOLD');
  intent(parse('Rook release'), ['alpha'], 'RELEASE_HUMAN_HOLD');
  notIntent(parse('Rook resume'));
});

test('configured aliases do not change the trusted-final-human-input boundary', () => {
  for (const origin of ['model', 'generated_audio', 'native_dialogue', 'human_text', undefined]) {
    notIntent(parse('Rook regroup', { origin }));
  }
  notIntent(parse('Rook regroup', { final: false }));
  notIntent(parse('Rook regroup', { session: null }));
  notIntent(parse('R'.repeat(301), { callsigns: aliases('Rook') }));
});

test('changing or removing the supplied alias map cannot retain an earlier recipient', () => {
  intent(parse('Rook regroup', { callsigns: aliases('Rook', null) }), ['alpha']);
  notIntent(parse('Rook regroup', { callsigns: aliases(null, null) }));
  intent(parse('Rook regroup', { callsigns: aliases(null, 'Rook') }), ['bravo']);
  // Pure parsing uses the explicitly supplied current map; capture epochs are server/client responsibilities.
});

test('all map order permutations preserve exact actor assignment and never use list position', () => {
  const rows = aliases('Rook', 'Iron Fox', 'Spark');
  for (const order of [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]]) {
    const callsigns = order.map(i => rows[i]), current = order.map(i => bindings()[i]);
    for (const row of rows) intent(parse(`callsign ${row.callsign} regroup`, { callsigns, bindings: current }), [row.actorId]);
  }
});

test('case-colliding explicit actor IDs cannot be resolved by first-match behavior', () => {
  const current = bindings(); current[1].id = 'ALPHA';
  notIntent(parse('actor alpha regroup', { bindings: current, callsigns: [] }));
  // The alias map itself joins an exact ID; it does not mint native ownership.
  const callsigns = [{ actorId: 'alpha', callsign: 'Rook' }, { actorId: 'ALPHA', callsign: 'Spark' }];
  intent(parse('Rook regroup', { bindings: current, callsigns }), ['alpha']);
  intent(parse('Spark regroup', { bindings: current, callsigns }), ['ALPHA']);
});

test('ordinary names resembling object property names do not leak prototype lookups', () => {
  const callsigns = aliases('Constructor', 'ToString', 'HasOwnProperty');
  intent(parse('Constructor regroup', { callsigns }), ['alpha']);
  intent(parse('ToString regroup', { callsigns }), ['bravo']);
  intent(parse('HasOwnProperty regroup', { callsigns }), ['charlie']);
  notIntent(parse('ValueOf regroup', { callsigns }));
});

test('parsing a deeply frozen trusted data envelope neither mutates nor annotates it', () => {
  const input = request('Rook regroup'); input.bindings.forEach(Object.freeze); Object.freeze(input.bindings);
  input.callsigns.forEach(Object.freeze); Object.freeze(input.callsigns); Object.freeze(input);
  const before = JSON.stringify(input); intent(parseSpokenCommand(input), ['alpha']);
  assert.equal(JSON.stringify(input), before);
});
