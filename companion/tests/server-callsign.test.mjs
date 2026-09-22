// MOCK_ONLY. Actual workbench/coordinator/serializer with injected deferred engines.
// No native inference, HTTP, microphone, audio device, editor or game.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { setImmediate as flush } from 'node:timers/promises';
import os from 'node:os';
import path from 'node:path';
import { createWorkbench } from '../server.mjs';
import { messagesFor } from '../local-language-model.mjs';
import { createConversationCoordinator } from '../conversation.mjs';
import personas from '../personas.json' with { type: 'json' };

function deferred() { let resolve; const promise = new Promise(yes => { resolve = yes; }); return { promise, resolve }; }
const baseSettings = () => ({ version: 1, micMuted: false, speechMuted: false, quiet: false,
  pilots: ['alpha', 'bravo', 'charlie'].map((id, i) => ({ id, profile: ['edge', 'tactician', 'scout'][i],
    callsign: null, voice: null, mode: 'ADVISORY' })) });
const speaker = context => JSON.parse(messagesFor(context)[1].content.replace(/ \/no_think$/, '')).speaker;

async function fixture(t, saved = null) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'mw5-callsign-'));
  const settingsPath = path.join(directory, 'settings.json'), generations = [], syntheses = [], reads = [];
  if (saved) await writeFile(settingsPath, JSON.stringify(saved));
  const language = { state: 'READY', status() { return { state: this.state, classification: 'MOCK_ONLY' }; },
    async stop() { this.state = 'STOPPED'; },
    generate(context, { signal }) { const pending = deferred(); generations.push({ ...pending, context, signal }); return pending.promise; } };
  const speech = { state: 'READY', getState() { return { state: this.state, classification: 'MOCK_ONLY' }; },
    async stop() { this.state = 'STOPPED'; },
    synthesize(input, { signal }) { const pending = deferred(); syntheses.push({ ...pending, input, signal }); return pending.promise; } };
  const w = await createWorkbench({ settingsPath, languageModel: language, speechEngine: speech, realNow: () => 1000,
    resourcePolicy: { async admit() {}, startWatch() {}, stopWatch() {}, status: () => ({}) },
    readAudioFile: () => { const pending = deferred(); reads.push(pending); return pending.promise; } });
  t.after(async () => {
    generations.forEach(p => p.resolve('Discarded.')); syntheses.forEach(p => p.resolve({ wavPath: 'mock.wav' }));
    reads.forEach(p => p.resolve(Buffer.from('Discarded'))); await flush(); await w.dispose();
    const target = path.resolve(directory);
    assert.equal(path.dirname(target), path.resolve(os.tmpdir())); assert.ok(path.basename(target).startsWith('mw5-callsign-'));
    await rm(target, { recursive: true, force: true });
  });
  await w.act({ type: 'demo' });
  const ask = async (actorId = 'alpha') => { await w.act({ type: 'converse', actorId, text: 'Radio check?' }); await flush(); return generations.at(-1); };
  const answer = async actorId => { const p = await ask(actorId); p.resolve('Mock answer.'); await flush(); return p; };
  const rename = (actorId, callsign) => { const settings = w.state().settings; settings.pilots.find(p => p.id === actorId).callsign = callsign;
    return w.act({ type: 'settings', settings }); };
  return { w, directory, settingsPath, generations, syntheses, reads, ask, answer, rename };
}

test('persisted names reach selected actor/profile context, including names resembling other internal IDs', async t => {
  const settings = baseSettings(); settings.pilots[0].callsign = 'tactician'; settings.pilots[1].callsign = 'alpha';
  const before = structuredClone(personas), r = await fixture(t, settings);
  assert.equal(r.w.state().settingsStatus, 'LOADED');
  const expected = [
    { actorId: 'alpha', profileId: 'edge', callsign: 'tactician' },
    { actorId: 'bravo', profileId: 'tactician', callsign: 'alpha' },
    { actorId: 'charlie', profileId: 'scout', callsign: null }
  ];
  for (const value of expected) {
    const generated = await r.answer(value.actorId); assert.deepEqual(speaker(generated.context), value);
    assert.deepEqual(generated.context.facts, []);
  }
  assert.deepEqual(personas, before); assert.equal(r.w.state().control.nativeCalls, 0);
});

for (const callsign of ['Rook', null]) {
  test(`changing a pending speaker name to ${callsign} cancels before disk awaits and never relabels late output`, async t => {
    const settings = baseSettings(); settings.pilots[0].callsign = 'Old name';
    const r = await fixture(t, settings); await r.answer(); const old = await r.ask();
    assert.equal(old.context.history.length, 1);
    const saved = r.rename('alpha', callsign);
    assert.equal(old.signal.aborted, true); assert.equal(r.w.state().localModels.reply, null);
    await assert.rejects(r.ask(), /CALLSIGN_UPDATE_PENDING/);
    await saved; old.resolve('Old name speaking.'); await flush();
    assert.equal(r.w.state().localModels.reply, null);
    const fresh = await r.answer(); assert.equal(speaker(fresh.context).callsign, callsign);
    assert.deepEqual(fresh.context.history, []); assert.equal(old.context.persona.callsign, 'Old name');
  });
}

test('a name edit preserves unrelated history and pending work, and normalized same-name saves preserve the active answer', async t => {
  const r = await fixture(t); await r.rename('bravo', 'Rook'); await r.answer('bravo'); const pending = await r.ask('bravo');
  await r.rename('alpha', 'Echo'); assert.equal(pending.signal.aborted, false);
  await r.rename('bravo', '  Rook  '); assert.equal(pending.signal.aborted, false);
  pending.resolve('Unchanged identity.'); await flush();
  assert.equal(r.w.state().localModels.reply.text, 'Unchanged identity.');
  const fresh = await r.answer('bravo'); assert.equal(fresh.context.history.length, 2);
  assert.equal(speaker(fresh.context).callsign, 'Rook');
});

test('rename aborts pending synthesis and unset rejects bytes arriving after an audio read began', async t => {
  const r = await fixture(t); await r.answer(); await r.w.act({ type: 'synthesize_reply' });
  const synthesis = r.syntheses[0], saving = r.rename('alpha', 'Rook');
  assert.equal(synthesis.signal.aborted, true); await saving;
  synthesis.resolve({ wavPath: 'old.wav' }); await flush(); assert.equal(r.w.state().localModels.audio, null);
  await r.answer(); await r.w.act({ type: 'synthesize_reply' }); r.syntheses[1].resolve({ wavPath: 'renamed.wav' }); await flush();
  const id = r.w.state().localModels.audio.id, pending = r.w.readAudio(id);
  const rejected = assert.rejects(pending, /AUDIO_STALE_OR_UNAVAILABLE/); await flush();
  const unset = r.rename('alpha', null); assert.equal(r.w.state().radio.playing, null);
  await unset; r.reads[0].resolve(Buffer.from('Old name audio')); await rejected;
  assert.equal(r.w.state().localModels.audio, null); assert.equal(r.w.state().control.nativeCalls, 0);
});

test('failed persistence cancels the old preview but cannot install an unsaved name', async t => {
  const settings = baseSettings(); settings.pilots[0].callsign = 'Saved'; const r = await fixture(t, settings);
  const original = await readFile(r.settingsPath, 'utf8'), pending = await r.ask();
  await mkdir(`${r.settingsPath}.tmp`);
  await assert.rejects(r.rename('alpha', 'Unsaved')); assert.equal(pending.signal.aborted, true);
  pending.resolve('Discard this cancelled answer.'); await flush();
  assert.equal(r.w.state().settings.pilots[0].callsign, 'Saved');
  assert.equal(await readFile(r.settingsPath, 'utf8'), original);
  assert.equal(speaker((await r.answer()).context).callsign, 'Saved');
});

test('name writes serialize admission, preserve human hold/possession and retain existing settings disarm semantics', async t => {
  const r = await fixture(t); await r.w.act({ type: 'arm' }); assert.equal(r.w.state().control.armed, true);
  await r.rename('charlie', 'Scout'); assert.equal(r.w.state().control.armed, false);
  await r.w.act({ type: 'step', actorId: 'bravo', event: 'hold' });
  await r.w.act({ type: 'step', actorId: 'alpha', event: 'possession' });
  const before = r.w.state();
  assert.ok(before.control.policyState.actors.bravo.heldHumanOrder);
  const saving = r.rename('bravo', 'Rook'); await assert.rejects(r.rename('charlie', 'Echo'), /SETTINGS_SAVE_PENDING/); await saving;
  const after = r.w.state(); assert.equal(after.clockMs, before.clockMs);
  assert.equal(after.control.armed, false); assert.deepEqual(after.control.policyState, before.control.policyState);
  assert.deepEqual(after.control.ledger, before.control.ledger); assert.deepEqual(after.radio.bindings, before.radio.bindings);
  const n = r.generations.length; await r.ask('alpha');
  assert.equal(r.generations.length, n); assert.equal(r.w.state().localModels.reply.reason, 'BINDING_INVALID');
  await r.w.act({ type: 'preview_timing', allowSlow: true });
  assert.equal(speaker((await r.answer('bravo')).context).callsign, 'Rook');
});

test('coordinator callsign update preserves occupied slot and clears only affected crossed-profile history', async t => {
  const pending = [], bindings = ['alpha', 'bravo', 'charlie'].map((id, i) => ({ id,
    profileId: ['scout', 'edge', 'tactician'][i], pawnId: `pawn${i}`, generation: 1, aiOwned: true, alive: true }));
  const c = createConversationCoordinator({ now: () => 1000, generate: (context, { signal }) => {
    const d = deferred(); pending.push({ ...d, context, signal }); return d.promise;
  } });
  t.after(() => { c.dispose(); pending.forEach(p => p.resolve('Cleanup.')); });
  c.startMission('mission1', bindings);
  const ask = (id, actor = bindings[0]) => c.request({ id, session: 'mission1', speakerId: actor.id,
    pawnId: actor.pawnId, generation: 1, priority: 'answer', text: 'Check in.', facts: [], expiresAtMs: 5000 });
  const first = ask('first'); await flush(); pending[0].resolve('Old name.'); await first; await flush();
  const old = ask('pending'); await flush();
  assert.deepEqual(c.updateCallsigns([{ profileId: 'scout', callsign: 'Rook' }]).changedProfileIds, ['scout']);
  assert.equal((await old).status, 'CANCELLED'); assert.equal(pending[1].signal.aborted, true);
  const fresh = ask('fresh'); await flush(); assert.equal(pending.length, 2, 'Ignored abort retains the single generator slot.');
  pending[1].resolve('Late old output.'); await flush(); assert.equal(pending.length, 3);
  assert.deepEqual(speaker(pending[2].context), { actorId: 'alpha', profileId: 'scout', callsign: 'Rook' });
  assert.deepEqual(pending[2].context.history, []); pending[2].resolve('Fresh name.'); await fresh;
  assert.equal(c.getState().rememberedRequestIds, 3); assert.equal(c.startMission('mission1', bindings).reason, 'NEW_SESSION_REQUIRED');
});
