// Pure supplied-data projection/serialization. No model factory or lifecycle calls.
import test from 'node:test';
import assert from 'node:assert/strict';
import { projectSpeakerObservations } from '../speaker-observations.mjs';
import { messagesFor } from '../local-language-model.mjs';

const fact = (id, data) => ({ id, evidenceStatus: 'CALLER_ASSERTED_OBSERVATION', data });
const context = (facts, history = []) => ({ classification: 'MOCK_ONLY', speakerId: 'scout',
  persona: { id: 'profile', style: 'calm' }, request: { text: 'How is your heat?' }, facts, history });
const own = heat => ({ actorId: 'scout', heat });
const other = { actorId: 'edge', heat: 'high' };
const project = facts => projectSpeakerObservations({ schemaVersion: 1, classification: 'MOCK_ONLY',
  speakerId: 'scout', facts });
const relative = { experimentalSpeakerRelativeFacts: true };
const briefing = { ...relative, experimentalSpeakerBriefing: true };
const userData = messages => JSON.parse(messages[1].content.slice(0, -' /no_think'.length));

function paddedHole(first, last, extension, key = 'contrary') {
  const rows = [first];
  rows[2] = last;
  rows[key] = extension;
  return rows;
}

test('a sparse pilots array with a named contrary reading is rejected before projection', () => {
  const pilots = paddedHole(own('low'), other, own('critical'));
  assert.throws(() => project([fact('heat', { pilots })]), /INVALID_SPEAKER_OBSERVATIONS/);
});

test('a sparse outer facts array with a hidden fact still fails closed', () => {
  const facts = paddedHole(fact('initial', own('low')), fact('other', other), fact('contrary', own('critical')));
  assert.throws(() => project(facts), /INVALID_SPEAKER_OBSERVATIONS/);
});

test('raw model input does not serialize a sparse extension array without its contrary property', () => {
  const rawReadings = paddedHole('reported normal', 'another reading', 'unsupported contrary evidence');
  assert.throws(() => messagesFor(context([fact('raw', { rawReadings })])), /INVALID_CONTEXT/);
});

test('prompt history does not discard a named record that replaces an own index', () => {
  const entry = responseText => ({ requestText: 'Previous question', responseText });
  const history = paddedHole(entry('first response'), entry('third response'), entry('otherwise lost'));
  assert.throws(() => messagesFor(context([], history)), /INVALID_CONTEXT/);
});

for (const [name, options] of [['relative', relative], ['briefing', briefing]]) {
  test(`${name} prompt rejects a sparse pilots array rather than hiding a contrary reading`, () => {
    const pilots = paddedHole(own('low'), other, own('critical'));
    assert.throws(() => messagesFor(context([fact('heat', { pilots })]), options), /INVALID_CONTEXT/);
  });
}

test('numeric-looking noncanonical property names cannot substitute for a missing index', () => {
  for (const key of ['01', '-0', '1e0']) {
    const pilots = paddedHole(own('low'), other, own('critical'), key);
    const facts = [fact('heat', { pilots })];
    assert.throws(() => project(facts), /INVALID_SPEAKER_OBSERVATIONS/);
    assert.throws(() => messagesFor(context(facts)), /INVALID_CONTEXT/);
  }
});

test('own element accessors and inherited hole fillers are rejected without either getter running', () => {
  let reads = 0;
  const descriptor = { enumerable: true, get() { reads++; return own('critical'); } };
  const accessor = [own('low'), other];
  Object.defineProperty(accessor, '1', descriptor);
  const inherited = paddedHole(own('low'), other, own('critical'));
  Object.setPrototypeOf(inherited, Object.create(Array.prototype, { '1': descriptor }));
  for (const pilots of [accessor, inherited]) {
    const facts = [fact('heat', { pilots })];
    assert.throws(() => project(facts), /INVALID_SPEAKER_OBSERVATIONS/);
    assert.throws(() => messagesFor(context(facts)), /INVALID_CONTEXT/);
  }
  assert.equal(reads, 0);
});

test('dense arrays keep both conflicting values, exact source pointers and ordinary serialization', () => {
  const facts = [fact('heat', { pilots: [own('low'), other, own('critical')] })];
  const result = project(facts);
  assert.deepEqual(result.prompt.own, [{ metric: 'heat', status: 'CONFLICT', reports: [
    { value: 'low', refs: ['s0'] }, { value: 'critical', refs: ['s2'] },
  ] }]);
  assert.deepEqual(result.audit.sources.map(source => source.pointer), [
    '/data/pilots/0/heat', '/data/pilots/1/heat', '/data/pilots/2/heat',
  ]);
  assert.deepEqual(result.audit.facts, facts);
  const history = [{ requestText: 'Previous question', responseText: 'Unverified reply.' }];
  const supplied = context(facts, history);
  const raw = userData(messagesFor(supplied));
  assert.deepEqual(raw.callerAssertedCurrentObservations, facts.map(({ id, data }) => ({ id, data })));
  assert.deepEqual(raw.unverifiedUndeliveredHistory, [['Previous question', 'Unverified reply.']]);
  assert.deepEqual(userData(messagesFor(supplied, relative)).callerAssertedCurrentObservations, result.prompt);
  assert.match(messagesFor(supplied, briefing)[1].content,
    /Your heat: unresolved because of conflicting reports\. Parsed reports: low \[s0\]; critical \[s2\]\. No report is selected\./);
});
