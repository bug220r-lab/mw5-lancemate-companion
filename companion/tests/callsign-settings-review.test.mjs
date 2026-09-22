// Independent MOCK_ONLY callsign review. Injected promises and local fixture files.
// No model, microphone, speakers, browser, network, editor or game execution.
import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate as flush } from 'node:timers/promises';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createWorkbench } from '../server.mjs';
import { createConversationCoordinator } from '../conversation.mjs';
import { messagesFor } from '../local-language-model.mjs';

const actorIds = ['alpha', 'bravo', 'charlie'];
const profileIds = ['edge', 'tactician', 'scout'];
const dataOf = context => JSON.parse(messagesFor(context)[1].content.replace(/ \/no_think$/, ''));
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
const initialSettings = names => ({ version: 1, micMuted: false, speechMuted: false, quiet: false,
  pilots: actorIds.map((id, i) => ({ id, profile: profileIds[i], callsign: names[i], voice: null, mode: 'ADVISORY' })) });
function wave() { const bytes = Buffer.alloc(46); bytes.write('RIFF', 0); bytes.write('WAVE', 8); return bytes; }

async function fixture(t, { names = null } = {}) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'mw5-callsign-review-'));
  const settingsPath = path.join(directory, 'settings.json');
  if (names) await writeFile(settingsPath, JSON.stringify(initialSettings(names)));
  let clock = 10000;
  const generations = [], syntheses = [], reads = [];
  const language = { state: 'READY', status() { return { state: this.state, ownsProcess: false }; },
    async start() {}, async stop() { this.state = 'STOPPED'; },
    generate(context, { signal }) { const d = deferred(); generations.push({ ...d, context, signal }); return d.promise; } };
  const speech = { state: 'READY', getState() { return { state: this.state, ownsProcess: false }; },
    async start() {}, async restart() {}, async stop() { this.state = 'STOPPED'; },
    synthesize(input, { signal }) { const d = deferred(); syntheses.push({ ...d, input, signal }); return d.promise; } };
  const recognizer = { async start() {}, async transcribe() { throw new Error('NO_RECOGNITION_EXPECTED'); },
    async stop() {}, async dispose() {}, status() { return { state: 'STOPPED', busy: false, ownsProcess: false, processStopConfirmed: true }; } };
  const w = await createWorkbench({ settingsPath, languageModel: language, speechEngine: speech,
    recognitionEngine: recognizer, realNow: () => clock,
    resourcePolicy: { async admit() {}, startWatch() {}, stopWatch() {},
      status: () => ({ monitoring: false, sampling: false, admissionPending: false, cleanupPending: false }) },
    readAudioFile(file) { const d = deferred(); reads.push({ ...d, file }); return d.promise; } });
  t.after(async () => {
    for (const d of generations) d.resolve('Discarded fixture output.');
    for (const d of syntheses) d.resolve({ wavPath: 'fixture-wave' });
    for (const d of reads) d.resolve(wave());
    await flush(); await w.dispose();
    const resolved = path.resolve(directory);
    assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith('mw5-callsign-review-'));
    await rm(resolved, { recursive: true, force: true });
  });
  await w.act({ type: 'demo' });
  const converse = async (actorId = 'alpha', text = 'Who is speaking?') => {
    await w.act({ type: 'converse', actorId, text }); await flush(); return generations.at(-1);
  };
  const reply = async (actorId = 'alpha', text = 'Standing by.') => {
    const g = await converse(actorId); g.resolve(text); await flush();
    assert.equal(w.state().localModels.reply.status, 'GENERATED'); return w.state().localModels.reply;
  };
  const audio = async (actorId = 'alpha') => {
    await reply(actorId); await w.act({ type: 'synthesize_reply' }); await flush();
    syntheses.at(-1).resolve({ wavPath: 'fixture-wave' }); await flush();
    assert.equal(w.state().localModels.audio.status, 'READY'); return w.state().localModels.audio.id;
  };
  const save = async (names, mutate = () => {}) => {
    const settings = w.state().settings;
    if (names) names.forEach((value, i) => { settings.pilots[i].callsign = value; });
    mutate(settings); return w.act({ type: 'settings', settings });
  };
  return { w, settingsPath, generations, syntheses, reads, converse, reply, audio, save, at: value => { clock = value; } };
}

test('loaded callsigns reach the actual serialized speaker without replacing actor or personality identity', async t => {
  const r = await fixture(t, { names: [' Rook ', 'Anchor', 'Spark'] });
  for (const id of actorIds) await r.reply(id);
  assert.deepEqual(r.generations.map(g => dataOf(g.context).speaker), actorIds.map((actorId, i) => ({
    actorId, profileId: profileIds[i], callsign: ['Rook', 'Anchor', 'Spark'][i] })));
  assert.deepEqual(r.generations.map(g => g.context.persona.style), ['edgy-female', 'calm-tactician', 'energetic-scout']);
  assert.equal(r.w.state().control.nativeCalls, 0);
});

test('save, rename and unset update future prompts while discarding obsolete identity history', async t => {
  const r = await fixture(t);
  await r.save(['Rook', 'Anchor', 'Spark']); await r.reply('alpha', 'Rook reporting.');
  await r.save(['Vex', 'Anchor', 'Spark']); await r.reply();
  assert.equal(dataOf(r.generations.at(-1).context).speaker.callsign, 'Vex');
  assert.deepEqual(r.generations.at(-1).context.history, []);
  await r.save(['  ', 'Anchor', 'Spark']); await r.reply();
  assert.equal(dataOf(r.generations.at(-1).context).speaker.callsign, null);
  assert.deepEqual(r.generations.at(-1).context.history, []);
  assert.equal(JSON.parse(await readFile(r.settingsPath, 'utf8')).pilots[0].callsign, null);
});

test('renaming cancels old generation immediately and retains its sole worker slot until drained', async t => {
  const r = await fixture(t, { names: ['Rook', null, null] });
  const old = await r.converse(); await r.save(['Vex', null, null]);
  assert.equal(old.signal.aborted, true); assert.equal(r.w.state().localModels.reply, null);
  await r.w.act({ type: 'converse', actorId: 'alpha', text: 'Identify now.' }); await flush();
  assert.equal(r.generations.length, 1, 'Ignoring cancellation must not create a concurrent generator.');
  old.resolve('Rook from obsolete context.'); await flush();
  assert.equal(r.generations.length, 2); assert.equal(r.w.state().localModels.reply.status, 'GENERATING');
  assert.equal(dataOf(r.generations[1].context).speaker.callsign, 'Vex');
  assert.deepEqual(r.generations[1].context.history, []);
  r.generations[1].resolve('Vex here.'); await flush();
  assert.equal(r.w.state().localModels.reply.text, 'Vex here.');
});

test('same normalized callsign save preserves pending generation and prior conversation history', async t => {
  const r = await fixture(t, { names: ['Rook', null, null] });
  await r.reply('alpha', 'Prior valid line.'); const pending = await r.converse();
  await r.save([' Rook ', null, null]);
  assert.equal(pending.signal.aborted, false);
  assert.equal(r.w.state().localModels.reply.status, 'GENERATING');
  pending.resolve('Still current.'); await flush(); await r.reply();
  assert.deepEqual(r.generations.at(-1).context.history.map(h => h.responseText), ['Prior valid line.', 'Still current.']);
});

test('rename revokes before persistence yields and concurrent saves cannot reorder identity commits', async t => {
  const r = await fixture(t, { names: ['Rook', null, null] }), old = await r.converse();
  const first = r.save(['Vex', null, null]);
  assert.equal(old.signal.aborted, true, 'Revocation must precede the first disk await.');
  await assert.rejects(r.w.act({ type: 'converse', actorId: 'alpha', text: 'While saving.' }), /CALLSIGN_UPDATE_PENDING/);
  const second = r.save(['Other', null, null]);
  await assert.rejects(second, /SETTINGS_SAVE_PENDING/); await first;
  assert.equal(r.w.state().settings.pilots[0].callsign, 'Vex');
  assert.equal(JSON.parse(await readFile(r.settingsPath, 'utf8')).pilots[0].callsign, 'Vex');
});

test('changing another pilots callsign does not reset the current pilots pending answer', async t => {
  const r = await fixture(t, { names: ['Rook', null, null] }), old = await r.converse();
  await r.save(['Rook', 'Anchor', null]);
  assert.equal(old.signal.aborted, false); assert.equal(r.w.state().localModels.reply.status, 'GENERATING');
  old.resolve('Rook still speaking.'); await flush();
  assert.equal(r.w.state().localModels.reply.text, 'Rook still speaking.');
});

test('failed persistence cannot install an unsaved identity into settings or future prompts', async t => {
  const r = await fixture(t, { names: ['Rook', null, null] });
  await r.reply(); const before = await readFile(r.settingsPath, 'utf8');
  await mkdir(`${r.settingsPath}.tmp`); // Deterministic write failure in the disposable fixture only.
  await assert.rejects(r.save(['Unsaved', null, null]));
  assert.equal(await readFile(r.settingsPath, 'utf8'), before);
  assert.equal(r.w.state().settings.pilots[0].callsign, 'Rook');
  await r.reply(); assert.equal(dataOf(r.generations.at(-1).context).speaker.callsign, 'Rook');
});

test('rename revokes pending synthesis and late audio cannot return', async t => {
  const r = await fixture(t, { names: ['Rook', null, null] });
  await r.reply(); await r.w.act({ type: 'synthesize_reply' }); await flush();
  const old = r.syntheses[0]; await r.save([null, null, null]);
  assert.equal(old.signal.aborted, true); assert.equal(r.w.state().localModels.audio, null);
  old.resolve({ wavPath: 'obsolete-wave' }); await flush();
  assert.equal(r.w.state().localModels.audio, null); assert.equal(r.reads.length, 0);
  await assert.rejects(r.w.act({ type: 'synthesize_reply' }), /REPLY_STALE_OR_INELIGIBLE/);
});

test('rename rejects already-reading audio without letting its late failure interrupt successor audio', async t => {
  const r = await fixture(t, { names: ['Rook', null, null] });
  const oldId = await r.audio(), oldRead = r.w.readAudio(oldId);
  const oldRejected = assert.rejects(oldRead, /AUDIO_STALE_OR_UNAVAILABLE/); await flush();
  await r.save(['Vex', null, null]);
  assert.equal(r.w.state().radio.playing, null);
  const nextId = await r.audio('bravo'), nextRead = r.w.readAudio(nextId); await flush();
  r.reads[0].resolve(wave()); await oldRejected;
  assert.equal(r.w.state().radio.playing.lineId, nextId);
  r.reads[1].resolve(wave()); await nextRead;
  assert.equal(r.w.state().localModels.audio.status, 'DELIVERED_FOR_USER_PLAYBACK');
});

test('callsign saves preserve human hold state, native-call count and possession revocation', async t => {
  const r = await fixture(t);
  await r.w.act({ type: 'step', actorId: 'alpha', event: 'hold' });
  await r.w.act({ type: 'step', actorId: 'bravo', event: 'possession' });
  const before = r.w.state().control.policyState;
  await r.save(['Rook', 'Anchor', 'Spark']);
  assert.deepEqual(r.w.state().control.policyState, before);
  await r.w.act({ type: 'arm' }); await r.w.act({ type: 'queue' });
  assert.ok(r.w.state().control.ledger.every(entry => !['alpha', 'bravo'].includes(entry.actorId)));
  await r.w.act({ type: 'converse', actorId: 'bravo', text: 'Still unavailable?' }); await flush();
  assert.equal(r.w.state().localModels.reply.reason, 'BINDING_INVALID');
  assert.equal(r.generations.length, 0); assert.equal(r.w.state().control.nativeCalls, 0);
});

test('callsign save cannot clear a latched regressing conversation clock', async t => {
  const r = await fixture(t); await r.reply(); r.at(9000);
  await r.w.act({ type: 'converse', actorId: 'alpha', text: 'Clock check.' }); await flush();
  assert.equal(r.w.state().localModels.reply.reason, 'CLOCK_INVALID');
  r.at(11000); await r.save(['Rook', null, null]);
  await r.w.act({ type: 'converse', actorId: 'alpha', text: 'Clock still invalid.' }); await flush();
  assert.equal(r.w.state().localModels.reply.reason, 'CLOCK_INVALID');
  assert.equal(r.generations.length, 1);
});

test('rename during pause cannot grant speech, and resume uses the saved new identity', async t => {
  const r = await fixture(t); await r.w.act({ type: 'step', actorId: 'alpha', event: 'pause' });
  await r.save(['Rook', null, null]);
  await r.w.act({ type: 'converse', actorId: 'alpha', text: 'Paused check.' }); await flush();
  assert.equal(r.w.state().localModels.reply.reason, 'PAUSED'); assert.equal(r.generations.length, 0);
  await r.w.act({ type: 'step', actorId: 'alpha', event: 'resume' }); await r.reply();
  assert.equal(dataOf(r.generations[0].context).speaker.callsign, 'Rook');
});

test('settings remain local to each workbench and survive its mission and audition changes', async t => {
  const first = await fixture(t, { names: ['Rook', null, null] });
  const second = await fixture(t, { names: ['Vex', null, null] });
  await first.reply(); await second.reply();
  assert.equal(dataOf(first.generations[0].context).speaker.callsign, 'Rook');
  assert.equal(dataOf(second.generations[0].context).speaker.callsign, 'Vex');
  await first.save(['Wraith', null, null]);
  await first.w.act({ type: 'preview_timing', allowSlow: true });
  await first.w.act({ type: 'demo' }); await first.reply(); await second.reply();
  assert.equal(dataOf(first.generations.at(-1).context).speaker.callsign, 'Wraith');
  assert.equal(dataOf(second.generations.at(-1).context).speaker.callsign, 'Vex');
});

test('same normalized name leaves prepared audio usable rather than needlessly invalidating it', async t => {
  const r = await fixture(t, { names: ['Rook', null, null] }), id = await r.audio();
  await r.save([' Rook ', null, null]);
  assert.equal(r.w.state().localModels.audio.id, id); assert.equal(r.w.state().localModels.audio.status, 'READY');
  const pending = r.w.readAudio(id); await flush(); r.reads[0].resolve(wave());
  assert.deepEqual(await pending, wave()); assert.equal(r.w.state().control.nativeCalls, 0);
});

function coordinatorFixture(t) {
  let clock = 1000;
  const calls = [], bindings = actorIds.map((id, i) => ({ id, profileId: profileIds[i], pawnId: `pawn${i + 1}`,
    generation: 1, aiOwned: true, alive: true }));
  const c = createConversationCoordinator({ now: () => clock, timeoutMs: 4000,
    generate(context, { signal }) { const d = deferred(); calls.push({ ...d, context, signal }); return d.promise; } });
  c.startMission('review1', bindings);
  t.after(async () => { c.dispose(); calls.forEach(call => call.resolve('Discarded.')); await flush(); });
  const request = (id, actor = 0, extra = {}) => c.request({ id, session: 'review1', speakerId: actorIds[actor],
    pawnId: bindings[actor].pawnId, generation: 1, priority: 'answer', text: 'Check in.', facts: [],
    expiresAtMs: clock + 5000, ...extra });
  const answer = async (id, actor = 0, extra = {}) => { const pending = request(id, actor, extra);
    await flush(); calls.at(-1).resolve('Valid previous response.'); await pending; await flush(); };
  return { c, calls, bindings, request, answer, at: value => { clock = value; } };
}

test('coordinator rename preserves consumed request IDs and retired session identities', async t => {
  const r = coordinatorFixture(t); await r.answer('already_consumed');
  r.c.updateCallsigns([{ profileId: 'edge', callsign: 'Rook' }]);
  assert.equal((await r.request('already_consumed')).reason, 'DUPLICATE_REQUEST');
  assert.equal(r.c.startMission('review2', r.bindings).status, 'STARTED');
  r.c.updateCallsigns([{ profileId: 'edge', callsign: null }]);
  assert.equal(r.c.startMission('review1', r.bindings).reason, 'NEW_SESSION_REQUIRED');
  assert.equal((await r.request('wrong_mission')).reason, 'SESSION_MISMATCH');
  assert.equal(r.calls.length, 1);
});

test('coordinator rename preserves unknown-ownership revocation generation and historical pawn claims', async t => {
  const r = coordinatorFixture(t);
  assert.equal(r.c.updateBinding({ ...r.bindings[0], aiOwned: null, generation: 7 }).reason, 'BINDING_STATE_UNKNOWN');
  r.c.updateCallsigns([{ profileId: 'edge', callsign: 'Rook' }]);
  assert.equal((await r.request('unknown_owner')).reason, 'BINDING_INVALID');
  for (const generation of [1, 7]) assert.equal(r.c.updateBinding({ ...r.bindings[0], generation }).reason, 'GENERATION_MUST_ADVANCE');
  assert.equal(r.c.updateBinding({ ...r.bindings[0], pawnId: 'replacement', generation: 8 }).status, 'UPDATED');
  r.c.updateCallsigns([{ profileId: 'edge', callsign: 'Vex' }]);
  assert.equal(r.c.updateBinding({ ...r.bindings[1], pawnId: 'pawn1', generation: 2 }).reason, 'BINDING_OWNER_CHANGED');
  await r.answer('fresh_authority', 0, { pawnId: 'replacement', generation: 8 });
  assert.equal(dataOf(r.calls[0].context).speaker.callsign, 'Vex');
});

test('coordinator rename cannot clear clock, pause, or dispose floors', async t => {
  const r = coordinatorFixture(t); r.c.setGates({ paused: true });
  r.c.updateCallsigns([{ profileId: 'edge', callsign: 'Rook' }]);
  assert.equal((await r.request('paused')).reason, 'PAUSED');
  r.c.setGates({ paused: false }); r.at(900);
  assert.equal((await r.request('backward')).reason, 'CLOCK_INVALID');
  r.at(2000); r.c.updateCallsigns([{ profileId: 'edge', callsign: 'Vex' }]);
  assert.equal((await r.request('latched')).reason, 'CLOCK_INVALID');
  assert.equal(r.c.getState().clockFault, true);
  r.c.dispose(); assert.equal(r.c.updateCallsigns([{ profileId: 'edge', callsign: null }]).status, 'REJECTED');
  assert.equal((await r.request('disposed')).reason, 'DISPOSED'); assert.equal(r.calls.length, 0);
});

test('selective rename preserves unaffected actor history and queued work while old generator drains', async t => {
  const r = coordinatorFixture(t); await r.answer('bravo_history', 1);
  const old = r.request('old_alpha'), other = r.request('queued_bravo', 1); await flush();
  r.c.updateCallsigns([{ profileId: 'edge', callsign: 'Rook' }]);
  assert.equal((await old).status, 'CANCELLED'); assert.equal(r.calls[1].signal.aborted, true);
  const next = r.request('fresh_alpha'); await flush(); assert.equal(r.calls.length, 2);
  r.calls[1].resolve('Obsolete alpha.'); await flush();
  assert.equal(r.calls[2].context.speakerId, 'bravo'); assert.equal(r.calls[2].context.history.length, 1);
  r.calls[2].resolve('Bravo unaffected.'); assert.equal((await other).status, 'GENERATED'); await flush();
  assert.equal(r.calls[3].context.speakerId, 'alpha'); assert.equal(dataOf(r.calls[3].context).speaker.callsign, 'Rook');
  assert.deepEqual(r.calls[3].context.history, []); r.calls[3].resolve('New alpha.');
  assert.equal((await next).status, 'GENERATED');
});

test('invalid callsign batches are atomic and cannot invoke accessor payloads', async t => {
  const r = coordinatorFixture(t);
  r.c.updateCallsigns([{ profileId: 'edge', callsign: 'Rook' }]);
  const old = r.request('pending_valid'); await flush();
  let reads = 0;
  const accessor = { profileId: 'edge' };
  Object.defineProperty(accessor, 'callsign', { enumerable: true, get() { reads++; return 'Unsafe'; } });
  const invalid = [[], [{ profileId: 'edge', callsign: 'Vex' }, { profileId: 'unknown', callsign: 'Other' }],
    [{ profileId: 'edge', callsign: 'Vex' }, { profileId: 'edge', callsign: 'Other' }],
    [{ profileId: 'edge', callsign: 'Vex', aiOwned: true }], [accessor],
    [{ profileId: 'edge', callsign: 'Bad\nName' }], [{ profileId: 'edge', callsign: 'x'.repeat(65) }]];
  for (const batch of invalid) assert.equal(r.c.updateCallsigns(batch).status, 'REJECTED');
  assert.equal(reads, 0); assert.equal(r.calls[0].signal.aborted, false);
  assert.equal(dataOf(r.calls[0].context).speaker.callsign, 'Rook');
  r.calls[0].resolve('Still Rook.'); assert.equal((await old).status, 'GENERATED'); await flush();
  await r.answer('still_valid'); assert.equal(dataOf(r.calls[1].context).speaker.callsign, 'Rook');
});

test('updating caller-owned names cannot mutate saved profile through a retained reference', async t => {
  const r = coordinatorFixture(t), update = [{ profileId: 'edge', callsign: 'Rook' }];
  r.c.updateCallsigns(update); update[0].callsign = 'Mutated'; update.push({ profileId: 'tactician', callsign: 'Changed' });
  await r.answer('snapshot'); assert.equal(dataOf(r.calls[0].context).speaker.callsign, 'Rook');
  await r.answer('unaffected', 1); assert.equal(dataOf(r.calls[1].context).speaker.callsign, null);
});
