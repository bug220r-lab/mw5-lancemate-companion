import test from 'node:test';
import assert from 'node:assert/strict';
import { createRadioDirector, parseSpokenCommand, RADIO_LIMITS } from '../radio.mjs';
import personas from '../personas.json' with { type: 'json' };

// All observations and identities below are synthetic. No game or audio runs.
const bindings = () => ['edge', 'tactician', 'scout'].map((id, index) => ({
  id, pawnId: `pawn-${index + 1}`, generation: 1, slot: index + 1, alive: true, aiOwned: true
}));
function fixture() {
  let t = 1000;
  const radio = createRadioDirector({ now: () => t });
  assert.equal(radio.startMission('mission-1', bindings()).status, 'STARTED');
  const fact = (id = 'contact-a', extra = {}) => ({ id, session: 'mission-1', observedAtMs: t,
    kind: 'fact', verified: true, data: { targetId: 'target-a', visible: true }, expiresAtMs: t + 30000, ...extra });
  const line = (lineId = 'line-1', extra = {}) => ({ lineId, session: 'mission-1', speakerId: 'edge',
    pawnId: 'pawn-1', generation: 1, priority: 'tactical', text: 'Target in sight.',
    createdAtMs: t, expiresAtMs: t + 30000, factIds: ['contact-a'], ...extra });
  const second = { speakerId: 'tactician', pawnId: 'pawn-2' };
  assert.equal(radio.observe(fact()).status, 'OBSERVED');
  return { radio, fact, line, second, at: value => { t = value; }, now: () => t };
}
const speech = (text, extra = {}) => ({ text, origin: 'human_ptt', final: true,
  session: 'mission-1', bindings: bindings(), ...extra });

test('three editable profiles have independent styles and unset callsigns', () => {
  assert.equal(personas.profiles.length, 3);
  assert.equal(new Set(personas.profiles.map(p => p.style)).size, 3);
  assert.ok(personas.profiles.every(p => p.callsign === null && p.voiceId === null));
  assert.equal(personas.profiles[0].presentation, 'woman');
});

test('new mission clears facts, speech and exchanges while preserving copied profile configuration', () => {
  const custom = structuredClone(personas); custom.profiles[0].callsign = 'Custom';
  const radio = createRadioDirector({ personas: custom, now: () => 1000 });
  radio.startMission('mission-1', bindings());
  radio.enqueue({ lineId: 'answer', session: 'mission-1', speakerId: 'edge', pawnId: 'pawn-1', generation: 1,
    priority: 'answer', text: 'Ready.', createdAtMs: 1000, expiresAtMs: 2000, factIds: [] });
  radio.next(); custom.profiles[0].callsign = 'Outside mutation';
  assert.equal(radio.startMission('mission-2', bindings()).status, 'STARTED');
  const state = radio.getState();
  assert.equal(state.profiles[0].callsign, 'Custom');
  assert.deepEqual(state.facts, []); assert.deepEqual(state.queue, []);
  assert.deepEqual(state.exchanges, []); assert.equal(state.playing, null);
  assert.equal(state.lastUnsolicitedAt, null);
});

test('mission epochs cannot be reused, and invalid mission start leaves current work intact', () => {
  const { radio } = fixture();
  assert.equal(radio.startMission('mission-1', bindings()).status, 'REJECTED');
  assert.equal(radio.startMission('mission-2', [{ ...bindings()[0], id: 'unknown' }]).status, 'REJECTED');
  assert.equal(radio.getState().session, 'mission-1');
  radio.startMission('mission-2', bindings());
  assert.equal(radio.startMission('mission-1', bindings()).status, 'REJECTED');
});

test('director rejects lines and observations before a mission starts', () => {
  const { fact, line } = fixture();
  const radio = createRadioDirector({ now: () => 1000 });
  assert.equal(radio.observe(fact()).status, 'REJECTED');
  assert.equal(radio.enqueue(line()).status, 'REJECTED');
  assert.equal(radio.next(), null);
});

for (const [name, extra] of [
  ['unverified', { verified: false }], ['wrong session', { session: 'other' }],
  ['future', { observedAtMs: 1001 }], ['expired', { expiresAtMs: 1000 }],
  ['overlong lifetime', { expiresAtMs: 31001 }], ['missing data', { data: undefined }]
]) test(`fact admission rejects ${name} observations`, () => {
  const { radio, fact } = fixture();
  assert.equal(radio.observe(fact('bad', extra)).status, 'REJECTED');
  assert.ok(radio.getState().facts.every(f => f.id !== 'bad'));
});

test('fact data must be finite, bounded JSON; circular objects cannot crash the director', () => {
  const { radio, fact } = fixture(); const cycle = {}; cycle.self = cycle;
  for (const data of [{ n: Infinity }, { fn() {} }, cycle, new Date(), 'x'.repeat(4001)]) {
    assert.equal(radio.observe(fact('bad', { data })).reason, 'INVALID_FACT_DATA');
  }
});

test('immutable facts and returned snapshots cannot be changed by their caller', () => {
  const { radio, fact, line } = fixture();
  const input = fact('new'); radio.observe(input); input.data.visible = false;
  const state = radio.getState(); state.facts.find(f => f.id === 'new').data.visible = false;
  state.bindings[0].aiOwned = false;
  assert.equal(radio.getState().facts.find(f => f.id === 'new').data.visible, true);
  radio.enqueue(line()); const output = radio.next(); output.text = 'Changed';
  assert.equal(radio.getState().playing.text, 'Target in sight.');
});

test('conflicting fact IDs invalidate queued and playing speech, including refreshed expired IDs', () => {
  const { radio, fact, line, at } = fixture();
  radio.enqueue(line()); radio.next();
  assert.equal(radio.observe(fact('contact-a', { data: { visible: false } })).reason, 'FACT_CONFLICT');
  assert.equal(radio.getState().playing, null);
  assert.equal(radio.enqueue(line('new')).reason, 'FACT_UNKNOWN_OR_STALE');
  radio.observe(fact('short', { expiresAtMs: 1001 })); at(1002); radio.getState();
  assert.equal(radio.observe(fact('short')).reason, 'FACT_CONFLICT');
});

test('identical fact delivery is idempotent despite JSON object key order', () => {
  const { radio, fact } = fixture();
  assert.equal(radio.observe(fact('contact-a', { data: { visible: true, targetId: 'target-a' } })).status, 'DUPLICATE');
  assert.equal(radio.getState().facts.length, 1);
});

test('default fact expiration is five seconds and queued speech rechecks it', () => {
  const { radio, fact, line, at } = fixture();
  const short = fact('short'); delete short.expiresAtMs; radio.observe(short);
  radio.enqueue(line('short-line', { factIds: ['short'] })); at(6000);
  assert.equal(radio.next(), null);
});

test('every factual priority needs known facts; requested answers retain an explicit ungrounded label', () => {
  const { radio, line } = fixture();
  for (const priority of ['danger', 'tactical', 'banter']) {
    assert.equal(radio.enqueue(line(priority, { priority, factIds: [] })).status, 'REJECTED');
    assert.equal(radio.enqueue(line(`${priority}-unknown`, { priority, factIds: ['unknown'] })).status, 'REJECTED');
  }
  assert.equal(radio.enqueue(line('answer', { priority: 'answer', factIds: [] })).status, 'QUEUED');
  const answer = radio.next();
  assert.equal(answer.grounding, 'USER_REQUESTED_UNGROUNDED'); assert.equal(answer.dispatchable, false);
});

test('unknown speaker, pawn, generation and mission cannot play', () => {
  const { radio, line } = fixture();
  for (const extra of [{ speakerId: 'unknown' }, { pawnId: 'other' }, { generation: 2 }, { session: 'old' }]) {
    assert.equal(radio.enqueue(line('bad', extra)).status, 'REJECTED');
  }
  assert.equal(radio.next(), null);
});

test('binding invalidation immediately cancels affected speech and rejects delayed invalidation of its replacement', () => {
  const { radio, line, at } = fixture();
  radio.enqueue(line()); radio.next();
  const invalid = { id: 'i1', session: 'mission-1', observedAtMs: 1000, kind: 'bindinginvalidated',
    data: { speakerId: 'edge', pawnId: 'pawn-1', generation: 1 } };
  assert.equal(radio.observe(invalid).status, 'INVALIDATED');
  assert.equal(radio.getState().playing, null);
  at(1100);
  const binding = { ...bindings()[0], pawnId: 'replacement', generation: 2 };
  assert.equal(radio.observe({ id: 'b1', session: 'mission-1', observedAtMs: 1100, kind: 'binding', binding }).status, 'OBSERVED');
  assert.equal(radio.observe(invalid).reason, 'BINDING_MISMATCH');
  assert.equal(radio.enqueue(line('new', { pawnId: 'replacement', generation: 2 })).status, 'QUEUED');
});

test('possession and death revoke speech, while stale or same-generation identity changes cannot re-enable it', () => {
  const { radio, line, at } = fixture();
  radio.enqueue(line()); at(1100);
  const binding = { ...bindings()[0], generation: 2, aiOwned: false };
  const event = { id: 'b1', session: 'mission-1', observedAtMs: 1100, kind: 'binding', binding };
  assert.equal(radio.observe(event).status, 'OBSERVED'); assert.equal(radio.next(), null);
  assert.equal(radio.enqueue(line('human', { generation: 2 })).status, 'REJECTED');
  assert.equal(radio.observe({ ...event, id: 'b2', binding: { ...binding, aiOwned: true } }).reason, 'GENERATION_MUST_ADVANCE');
  assert.equal(radio.observe({ ...event, id: 'b3', observedAtMs: 1050, binding: { ...binding, generation: 3 } }).reason, 'STALE_BINDING_UPDATE');
  radio.observe({ ...event, id: 'b4', binding: { ...binding, generation: 3, alive: false } });
  assert.equal(radio.enqueue(line('dead', { generation: 3 })).status, 'REJECTED');
});

for (const gate of ['paused', 'speechMuted', 'nativeDialogue', 'ptt']) test(`${gate} cancels speech and discards queued lines instead of replaying them later`, () => {
  const { radio, line } = fixture();
  radio.enqueue(line('playing')); radio.next(); radio.enqueue(line('queued', { priority: 'answer' }));
  radio.setGates({ [gate]: true });
  assert.equal(radio.getState().playing, null); assert.deepEqual(radio.getState().queue, []);
  assert.equal(radio.enqueue(line('danger', { priority: 'danger' })).status, 'REJECTED');
  radio.setGates({ [gate]: false }); assert.equal(radio.next(), null);
});

test('microphone mute and tactical arming are independent of receiving speech', () => {
  const { radio, line } = fixture();
  radio.setGates({ micMuted: true, armed: false });
  assert.equal(radio.enqueue(line()).status, 'QUEUED'); assert.ok(radio.next());
  radio.setGates({ armed: true }); assert.ok(radio.getState().playing);
});

test('quiet mode suppresses unsolicited chatter, preserving requested answers and urgent warnings', () => {
  const { radio, line } = fixture(); radio.setGates({ quiet: true });
  assert.equal(radio.enqueue(line()).reason, 'QUIET');
  assert.equal(radio.enqueue(line('answer', { priority: 'answer' })).status, 'QUEUED');
  assert.equal(radio.enqueue(line('danger', { priority: 'danger' })).status, 'QUEUED');
  assert.equal(radio.next().lineId, 'danger'); radio.complete('danger');
  assert.equal(radio.next().lineId, 'answer');
});

test('only one speaker owns the radio and a mismatched completion cannot release it', () => {
  const { radio, line, second } = fixture();
  radio.enqueue(line('one', { priority: 'answer' })); radio.enqueue(line('two', { ...second, priority: 'answer' }));
  assert.equal(radio.next().lineId, 'one'); assert.equal(radio.next(), null);
  assert.equal(radio.complete('two').status, 'REJECTED'); assert.equal(radio.next(), null);
  radio.complete('one'); assert.equal(radio.next().lineId, 'two');
});

test('three pilots share one twenty-second chatter budget', () => {
  const { radio, line, second, at } = fixture();
  radio.enqueue(line('first')); radio.next(); radio.complete('first');
  radio.enqueue(line('second', second)); assert.equal(radio.next(), null);
  at(20999); radio.enqueue(line('scout', { speakerId: 'scout', pawnId: 'pawn-3' })); assert.equal(radio.next(), null);
  at(21000); radio.enqueue(line('next', second)); assert.equal(radio.next().lineId, 'next');
});

test('a two-pilot exchange uses one budget slot and permits exactly one different-speaker reply', () => {
  const { radio, line, second } = fixture();
  radio.enqueue(line('one', { exchangeId: 'exchange', exchangeTurn: 0 }));
  assert.equal(radio.enqueue(line('self', { exchangeId: 'exchange', exchangeTurn: 1 })).status, 'REJECTED');
  assert.equal(radio.enqueue(line('two', { ...second, exchangeId: 'exchange', exchangeTurn: 1 })).status, 'QUEUED');
  assert.equal(radio.enqueue(line('three', { speakerId: 'scout', pawnId: 'pawn-3', exchangeId: 'exchange', exchangeTurn: 1 })).status, 'REJECTED');
  assert.equal(radio.next().lineId, 'one'); radio.complete('one');
  assert.equal(radio.next().lineId, 'two'); radio.complete('two');
  radio.enqueue(line('unrelated')); assert.equal(radio.next(), null);
});

test('an expired exchange cannot deliver a delayed second turn', () => {
  const { radio, line, second, at } = fixture();
  radio.enqueue(line('one', { exchangeId: 'exchange', exchangeTurn: 0 })); radio.next(); radio.complete('one');
  at(11000); radio.enqueue(line('two', { ...second, exchangeId: 'exchange', exchangeTurn: 1 }));
  assert.equal(radio.next(), null);
});

test('danger preempts chatter and cancels its response, but does not interrupt an answer', () => {
  const { radio, line, second } = fixture();
  radio.enqueue(line('one', { exchangeId: 'exchange', exchangeTurn: 0 })); radio.next();
  radio.enqueue(line('two', { ...second, exchangeId: 'exchange', exchangeTurn: 1 }));
  radio.enqueue(line('danger', { priority: 'danger' }));
  assert.equal(radio.getState().playing, null); assert.equal(radio.next().lineId, 'danger'); radio.complete('danger');
  assert.equal(radio.next(), null);
  radio.enqueue(line('answer', { priority: 'answer' })); radio.next();
  radio.enqueue(line('danger-2', { priority: 'danger' }));
  assert.equal(radio.getState().playing.lineId, 'answer'); assert.equal(radio.next(), null);
  radio.complete('answer'); assert.equal(radio.next().lineId, 'danger-2');
});

test('bounded queue preserves urgent admission by evicting chatter, and malformed danger has no such effect', () => {
  const { radio, line } = fixture();
  for (let i = 0; i < RADIO_LIMITS.maxQueue; i++) radio.enqueue(line(`queued-${i}`));
  assert.equal(radio.enqueue(line('overflow')).reason, 'QUEUE_FULL');
  assert.equal(radio.enqueue(line('bad-danger', { priority: 'danger', exchangeId: 'invalid', exchangeTurn: 0 })).status, 'REJECTED');
  assert.equal(radio.getState().queue.length, RADIO_LIMITS.maxQueue);
  assert.equal(radio.enqueue(line('danger', { priority: 'danger' })).status, 'QUEUED');
  assert.equal(radio.getState().queue.length, RADIO_LIMITS.maxQueue);
  assert.equal(radio.next().lineId, 'danger');
});

test('manual interruption clears the whole exchange, and duplicate IDs never replay', () => {
  const { radio, line, second } = fixture();
  radio.enqueue(line('one', { exchangeId: 'exchange', exchangeTurn: 0 })); radio.next();
  radio.enqueue(line('two', { ...second, exchangeId: 'exchange', exchangeTurn: 1 }));
  const result = radio.interrupt('USER_COMMAND');
  assert.equal(result.interruptedLineId, 'one'); assert.deepEqual(result.discardedLineIds, ['two']);
  assert.equal(radio.next(), null); assert.equal(radio.enqueue(line('one')).reason, 'DUPLICATE_LINE');
});

test('expired speech cannot falsely complete an exchange', () => {
  const { radio, line, second, at } = fixture();
  radio.enqueue(line('one', { expiresAtMs: 2000, exchangeId: 'exchange', exchangeTurn: 0 })); radio.next();
  radio.enqueue(line('two', { ...second, exchangeId: 'exchange', exchangeTurn: 1 })); at(2000);
  assert.equal(radio.complete('one').status, 'REJECTED'); assert.equal(radio.next(), null);
});

test('clock regression latches a silent failure until a new mission epoch', () => {
  const { radio, line, at } = fixture(); radio.enqueue(line()); radio.next(); at(999);
  assert.equal(radio.next(), null); assert.equal(radio.getState().clockFault, true);
  at(1200); assert.equal(radio.enqueue(line('later')).reason, 'CLOCK_INVALID');
  assert.equal(radio.startMission('mission-2', bindings()).status, 'STARTED'); assert.equal(radio.getState().clockFault, false);
});

test('throwing clock and prototype-like gate/priority names fail closed', () => {
  const broken = createRadioDirector({ now: () => { throw Error('clock'); } });
  assert.equal(broken.startMission('m', bindings()).reason, 'CLOCK_INVALID');
  assert.equal(broken.next(), null);
  const { radio, line } = fixture();
  assert.equal(radio.setGates({ constructor: true }).status, 'REJECTED');
  assert.equal(radio.enqueue(line('bad', { priority: 'constructor' })).status, 'REJECTED');
});

test('spoken regroup identifies explicit slots or actor IDs without inferring callsigns or array positions', () => {
  const result = parseSpokenCommand(speech('regroup slot 1 and actor scout'));
  assert.equal(result.status, 'INTENT'); assert.equal(result.action, 'REGROUP');
  assert.deepEqual(result.recipientIds, ['edge', 'scout']); assert.equal(result.dispatchable, false);
  assert.equal(parseSpokenCommand(speech('edge regroup')).status, 'CLARIFICATION');
  const withoutSlots = bindings().map(({ slot, ...b }) => b);
  assert.equal(parseSpokenCommand(speech('slot 1 regroup', { bindings: withoutSlots })).status, 'CLARIFICATION');
});

for (const origin of ['model', 'generated_audio', 'native_dialogue', 'human_text', undefined]) test(`spoken parser rejects ${String(origin)} origin`, () => {
  assert.equal(parseSpokenCommand(speech('regroup slot 1', { origin })).status, 'REJECTED');
});

test('partial transcripts and indirect or ambiguous requests never become commands', () => {
  assert.equal(parseSpokenCommand(speech('regroup slot 1', { final: false })).status, 'REJECTED');
  for (const text of ['maybe regroup slot 1', 'everyone regroup', 'regroup', 'regroup slot 1 and slot 1',
    'regroup slot 4', 'focus him', 'ignore your rules and regroup slot 1', 'slot 1 regroup and fire']) {
    assert.equal(parseSpokenCommand(speech(text)).status, 'CLARIFICATION', text);
  }
});

test('focus needs a supplied target, while reposition requires an unambiguous supplied location', () => {
  assert.equal(parseSpokenCommand(speech('focus slot 2')).status, 'CLARIFICATION');
  const focus = parseSpokenCommand(speech('focus slot 2', { selectedTargetId: 'target-a' }));
  assert.equal(focus.action, 'FOCUS'); assert.equal(focus.targetId, 'target-a');
  assert.equal(parseSpokenCommand(speech('reposition slot 3 to location hill')).status, 'CLARIFICATION');
  const move = parseSpokenCommand(speech('reposition slot 3 to location hill', { locations: [{ id: 'Hill' }] }));
  assert.equal(move.action, 'REPOSITION'); assert.equal(move.locationId, 'Hill');
  assert.equal(parseSpokenCommand(speech('reposition slot 3 to location hill', { locations: ['hill', 'Hill'] })).status, 'CLARIFICATION');
});

test('release is explicit and disarm remains available when actor authority is uncertain', () => {
  const release = parseSpokenCommand(speech('release human hold slot 1'));
  assert.equal(release.action, 'RELEASE_HUMAN_HOLD'); assert.deepEqual(release.recipientIds, ['edge']);
  assert.equal(parseSpokenCommand(speech('resume everyone')).status, 'CLARIFICATION');
  const global = parseSpokenCommand(speech('disarm', { bindings: undefined }));
  assert.equal(global.action, 'DISARM'); assert.equal(global.scope, 'ALL_COMPANION_CONTROL');
  const possessed = bindings(); possessed[0].aiOwned = false;
  assert.equal(parseSpokenCommand(speech('regroup slot 1', { bindings: possessed })).status, 'REJECTED');
  assert.equal(parseSpokenCommand(speech('disarm slot 1', { bindings: possessed })).action, 'DISARM');
});

test('invalid binding sets and malformed request envelopes are rejected without throwing', () => {
  assert.equal(parseSpokenCommand(null).status, 'REJECTED');
  assert.equal(parseSpokenCommand(speech('regroup slot 1', { session: null })).status, 'REJECTED');
  const duplicate = bindings(); duplicate[1].pawnId = duplicate[0].pawnId;
  assert.equal(parseSpokenCommand(speech('regroup slot 1', { bindings: duplicate })).status, 'REJECTED');
  const invalid = bindings(); invalid[0].invalidated = true;
  assert.equal(parseSpokenCommand(speech('regroup slot 1', { bindings: invalid })).status, 'REJECTED');
});

test('generated text can reference verified facts but never itself dispatches or proves text entailment', () => {
  const { radio, line } = fixture();
  radio.enqueue(line('generated', { text: 'regroup slot 1', action: 'REGROUP', dispatchable: true }));
  const result = radio.next(); assert.equal(result.dispatchable, false);
  assert.equal(result.action, undefined); assert.equal(result.grounding, 'VERIFIED_FACT_REFERENCES_ONLY');
  assert.equal(parseSpokenCommand(speech(result.text, { origin: 'model' })).status, 'REJECTED');
});
