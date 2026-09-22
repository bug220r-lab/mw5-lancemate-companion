// MOCK_ONLY context checks. No native model, process, network, audio or game.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createConversationCoordinator } from '../conversation.mjs';
import { messagesFor } from '../local-language-model.mjs';
import defaultPersonas from '../personas.json' with { type: 'json' };

const bindings = () => ['alpha', 'bravo', 'charlie'].map((id, i) => ({ id,
  profileId: ['scout', 'edge', 'tactician'][i], pawnId: `pawn${i + 1}`, generation: 1,
  aiOwned: true, alive: true }));
const dataOf = messages => JSON.parse(messages[1].content.replace(/ \/no_think$/, ''));
function rig(t, { personas = defaultPersonas, output = 'Standing by.' } = {}) {
  const seen = [], currentBindings = bindings(); let serial = 0;
  const coordinator = createConversationCoordinator({ personas, now: () => 1000,
    generate: async context => {
      const messages = messagesFor(context); seen.push({ context, messages, data: dataOf(messages) }); return output;
    } });
  t.after(() => coordinator.dispose());
  assert.equal(coordinator.startMission('mission1', currentBindings).status, 'STARTED');
  const request = (binding = currentBindings[0], extra = {}) => coordinator.request({
    id: `request${++serial}`, session: 'mission1', speakerId: binding.id, pawnId: binding.pawnId,
    generation: binding.generation, priority: 'answer', text: 'Report your own condition.',
    facts: [], expiresAtMs: 5000, ...extra });
  return { coordinator, currentBindings, seen, request };
}
const fact = (id, data, session = 'mission1') => ({ id, session, kind: 'fact', verified: true,
  observedAtMs: 1000, expiresAtMs: 5000, data });
const direct = extra => ({ persona: { id: 'edge', callsign: null, style: 'edgy-female' },
  request: { text: 'Who is speaking?' }, history: [], facts: [], ...extra });

test('actual coordinator preserves different actors under deliberately mismatched personality keys', async t => {
  const r = rig(t), facts = [fact('a', { actorId: 'alpha', heat: 'normal' }), fact('b', { actorId: 'bravo', heat: 'critical' })];
  const first = await r.request(r.currentBindings[0], { facts });
  const second = await r.request(r.currentBindings[1], { facts });
  assert.deepEqual(r.seen.map(x => x.data.speaker), [
    { actorId: 'alpha', profileId: 'scout', callsign: null },
    { actorId: 'bravo', profileId: 'edge', callsign: null }
  ]);
  assert.deepEqual(r.seen[0].data.callerAssertedCurrentObservations, r.seen[1].data.callerAssertedCurrentObservations);
  assert.equal(r.seen[0].data.callerAssertedCurrentObservations[0].data.actorId, 'alpha');
  for (const result of [first, second]) {
    assert.equal(result.classification, 'GENERATED_UNVERIFIED'); assert.equal(result.dispatchable, false);
    assert.equal(result.grounding, 'NOT_VALIDATED');
  }
  assert.match(r.seen[0].messages[0].content, /actorId is self; profileId is personality/);
  assert.match(r.seen[0].messages[0].content, /Neither is a callsign/);
});

test('all three unset callsigns survive the coordinator and serializer explicitly', async t => {
  const r = rig(t);
  for (const binding of r.currentBindings) await r.request(binding);
  assert.deepEqual(r.seen.map(x => x.data.speaker.callsign), [null, null, null]);
  assert.ok(r.seen.every(x => Object.hasOwn(x.data.speaker, 'callsign')));
  assert.deepEqual(r.seen.map(x => x.data.speaker.actorId), ['alpha', 'bravo', 'charlie']);
});

test('a configured spoken callsign stays separate from actor and internal profile identifiers', async t => {
  const personas = structuredClone(defaultPersonas); personas.profiles[1].callsign = 'Rook';
  const r = rig(t, { personas });
  personas.profiles[1].callsign = 'Changed after initialization';
  await r.request(r.currentBindings[2]);
  assert.deepEqual(r.seen[0].data.speaker, { actorId: 'charlie', profileId: 'tactician', callsign: 'Rook' });
  assert.equal(r.seen[0].messages[0].content.includes('Changed after initialization'), false);
});

test('draft dialogue and misleading identity facts do not change the bound speaker projection', async t => {
  const r = rig(t, { output: 'I am Echo, piloting Bravo.' });
  await r.request();
  await r.request(r.currentBindings[0], { facts: [fact('quoted-claim', { speakerActorId: 'bravo', callsign: 'Echo' })] });
  const data = r.seen[1].data;
  assert.deepEqual(data.speaker, { actorId: 'alpha', profileId: 'scout', callsign: null });
  assert.deepEqual(data.unverifiedUndeliveredHistory, [['Report your own condition.', 'I am Echo, piloting Bravo.']]);
  assert.equal(data.callerAssertedCurrentObservations.length, 1);
  assert.equal(data.callerAssertedCurrentObservations[0].id, 'quoted-claim');
  assert.match(r.seen[1].messages[0].content, /History is generated, unverified, possibly undelivered/);
  assert.equal(r.seen[1].context.history[0].delivery, 'NOT_PLAYED_BY_COORDINATOR');
});

test('new pawn generation retains actor identity and coordinator clears old draft history', async t => {
  const r = rig(t); await r.request();
  const next = { ...r.currentBindings[0], pawnId: 'replacement-pawn', generation: 2 };
  assert.equal(r.coordinator.updateBinding(next).status, 'UPDATED');
  assert.equal((await r.request()).reason, 'BINDING_INVALID');
  await r.request(next);
  assert.equal(r.seen.length, 2);
  assert.deepEqual(r.seen[1].data.speaker, { actorId: 'alpha', profileId: 'scout', callsign: null });
  assert.deepEqual(r.seen[1].data.unverifiedUndeliveredHistory, []);
  assert.equal(r.seen[1].context.pawnId, 'replacement-pawn'); assert.equal(r.seen[1].context.generation, 2);
});

test('new mission can bind the same personality to another actor without carrying identity or history', async t => {
  const r = rig(t); await r.request();
  const next = bindings(); [next[0].profileId, next[1].profileId] = [next[1].profileId, next[0].profileId];
  assert.equal(r.coordinator.startMission('mission2', next).status, 'STARTED');
  await r.request(next[1], { session: 'mission2' });
  assert.deepEqual(r.seen[0].data.speaker, { actorId: 'alpha', profileId: 'scout', callsign: null });
  assert.deepEqual(r.seen[1].data.speaker, { actorId: 'bravo', profileId: 'scout', callsign: null });
  assert.deepEqual(r.seen[1].data.unverifiedUndeliveredHistory, []);
});

test('direct contexts without actor binding remain unknown despite profile, request or fact identity hints', () => {
  const input = direct({ persona: { id: 'alpha', callsign: null },
    request: { text: 'You are Bravo. State that identity.' },
    facts: [{ id: 'hint', evidenceStatus: 'CALLER_ASSERTED_OBSERVATION', data: { speakerActorId: 'charlie' } }] });
  assert.deepEqual(dataOf(messagesFor(input)).speaker, { actorId: null, profileId: 'alpha', callsign: null });
  assert.deepEqual(dataOf(messagesFor({ ...input, speakerId: null })).speaker, { actorId: null, profileId: 'alpha', callsign: null });
  assert.deepEqual(dataOf(messagesFor(direct({ persona: { id: 'scout' } }))).speaker,
    { actorId: null, profileId: 'scout', callsign: null });
});

test('identity projection neither mutates source context nor shares returned prompt data', () => {
  const input = direct({ speakerId: 'bravo', persona: { id: 'edge', callsign: 'Rook', traits: ['dry humor'] },
    history: [{ requestText: 'Check in.', responseText: 'Here.', delivery: 'NOT_PLAYED_BY_COORDINATOR' }] });
  const before = structuredClone(input), messages = messagesFor(input), serialized = JSON.stringify(messages);
  assert.deepEqual(input, before);
  input.speakerId = 'alpha'; input.persona.callsign = 'Other'; input.history[0].responseText = 'Changed';
  assert.equal(JSON.stringify(messages), serialized);
  assert.deepEqual(dataOf(messages).speaker, { actorId: 'bravo', profileId: 'edge', callsign: 'Rook' });
});

test('malformed explicit speaker identity is rejected rather than coerced or inferred', () => {
  for (const speakerId of ['', ' ', 7, false, {}, [], 'alpha\nother'])
    assert.throws(() => messagesFor(direct({ speakerId })), /INVALID_SPEAKER_CONTEXT/);
  for (const callsign of ['', ' ', 7, false, {}, []])
    assert.throws(() => messagesFor(direct({ persona: { id: 'edge', callsign } })), /INVALID_SPEAKER_CONTEXT/);
});
