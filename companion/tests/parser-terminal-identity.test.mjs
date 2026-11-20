// Supplied command text only. No recognizer, device, dispatch, or native adapter.
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSpokenCommand } from '../radio.mjs';
import { scoreCommandTranscriptCorpus } from '../command-transcript-evaluation.mjs';

const actorAmbiguity = { status: 'CLARIFICATION', reason: 'AMBIGUOUS_ACTOR_PUNCTUATION' };
const locationAmbiguity = { status: 'CLARIFICATION', reason: 'AMBIGUOUS_LOCATION_PUNCTUATION' };
const binding = (id, slot, change = {}) => ({ id, pawnId: `pawn-${slot}`, generation: slot - 1,
  alive: true, aiOwned: true, slot, ...change });
const actors = () => [binding('Alpha', 1), binding('ALPHA.', 2), binding('Bravo', 3)];
const request = (text, extra = {}) => ({ text, origin: 'human_ptt', final: true,
  session: 'terminal-identity-fixture', bindings: actors(), ...extra });
const parse = (text, extra) => parseSpokenCommand(request(text, extra));

test('trailing period cannot silently select a different shorter actor ID', () => {
  assert.deepEqual(parse('Regroup actor alpha.'), actorAmbiguity);
  assert.deepEqual(parse('Focus actor ALPHA.!?', { selectedTargetId: 'enemy' }), actorAmbiguity);
});

test('the terminal actor of a mixed recipient list can still be ambiguous', () => {
  assert.deepEqual(parse('regroup slot 3 and actor Alpha..?!'), actorAmbiguity);
  assert.deepEqual(parse('release human hold slot 3, actor alpha.'), actorAmbiguity);
  assert.deepEqual(parse('regroup Rook and actor alpha.', {
    callsigns: [{ actorId: 'Bravo', callsign: 'Rook' }],
  }), actorAmbiguity);
});

test('any leading-period interpretation can name a competing exact actor', () => {
  const bindings = [binding('Alpha', 1), binding('aLpHa..', 2), binding('Bravo', 3)];
  assert.deepEqual(parse('regroup actor ALPHA...?!', { bindings }), actorAmbiguity);
});

test('a known dotted actor is an ambiguity even if that pawn is ineligible', () => {
  const bindings = [binding('Alpha', 1), binding('ALPHA.', 2, {
    alive: false, aiOwned: false, invalidated: true,
  })];
  assert.deepEqual(parse('regroup actor alpha.', { bindings }), actorAmbiguity);
  assert.deepEqual(parse('disarm actor alpha.', { bindings }), actorAmbiguity);
});

test('back-verb and nonterminal dotted actor IDs retain their exact binding', () => {
  for (const [text, ids] of [['actor alpha. regroup!', ['ALPHA.']],
    ['regroup actor alpha. and slot 3.', ['ALPHA.', 'Bravo']]]) {
    const result = parse(text);
    assert.equal(result.status, 'INTENT');
    assert.deepEqual(result.recipientIds, ids);
    assert.deepEqual(result.bindings[0], actors()[1]);
    assert.equal(result.dispatchable, false);
  }
});

test('ordinary sentence punctuation survives when no leading-period identity competes', () => {
  for (const [text, extra] of [['REGROUP ACTOR alpha.!?', { bindings: [binding('Alpha', 1)] }],
    ['regroup actor alpha?!'], ['regroup actor alpha!?.'], ['regroup slot 1.']]) {
    const result = parse(text, extra);
    assert.equal(result.status, 'INTENT');
    assert.deepEqual(result.recipientIds, ['Alpha']);
    assert.deepEqual(result.bindings[0], binding('Alpha', 1));
  }
  assert.equal(parse('Disarm.').scope, 'ALL_COMPANION_CONTROL');
});

test('terminal punctuation cannot select a different known shorter location', () => {
  assert.deepEqual(parse('reposition slot 1 to location RIDGE.', {
    locations: ['Ridge', 'RIDGE.'],
  }), locationAmbiguity);
  assert.deepEqual(parse('reposition Rook to location ridge...!?', {
    callsigns: [{ actorId: 'Alpha', callsign: 'Rook' }], locations: [{ id: 'Ridge' }, { id: 'rIdGe..' }],
  }), locationAmbiguity);
});

test('location control keeps ordinary punctuation and exact returned identifier', () => {
  for (const [text, locations] of [['reposition slot 1 to location ridge.!?', ['Ridge']],
    ['reposition slot 1 to location ridge!?', ['Ridge', 'RIDGE.']],
    ['reposition slot 1 to location ridge!?.', ['Ridge', 'RIDGE.']]]) {
    const result = parse(text, { locations });
    assert.equal(result.status, 'INTENT');
    assert.equal(result.action, 'REPOSITION');
    assert.equal(result.locationId, 'Ridge');
    assert.deepEqual(result.recipientIds, ['Alpha']);
  }
});

test('the supplied-transcript scorer keeps both ambiguities in its exact clarification denominator', () => {
  const cases = [[request('regroup actor alpha.'), actorAmbiguity],
    [request('reposition slot 1 to location ridge.!?', { locations: ['Ridge', 'Ridge.'] }), locationAmbiguity]]
    .map(([request, expected], index) => ({ id: `punctuation-${index}`, sourceKind: 'SYNTHETIC',
      sourceRef: 'synthetic:terminal-id', annotationRef: 'synthetic:predeclared', ambiguous: true, request, expected }));
  const score = scoreCommandTranscriptCorpus(JSON.stringify({ schemaVersion: 1, cases }));
  assert.equal(score.summary.cases, 2);
  assert.equal(score.summary.commands.count, 0);
  assert.equal(score.summary.clarifications.count, 2);
  assert.equal(score.summary.clarifications.matched, 2);
  assert.equal(score.summary.unexpectedIntentsProduced, 0);
  assert.equal(score.summary.ambiguousIntentsProduced, 0);
  assert.deepEqual(score.results.map(row => row.actual), [actorAmbiguity, locationAmbiguity]);
  assert.equal(score.execution.dispatch, 'NOT_PERFORMED');
});
