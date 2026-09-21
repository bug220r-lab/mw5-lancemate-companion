// Independent synthetic integration review. Injected engines cannot start a model.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createWorkbench } from '../server.mjs';

async function fixture(t, demo = true) {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'mw5-mission-speech-review-'));
  let clock = 10000;
  const calls = { starts: 0, generations: 0, syntheses: 0, reads: 0 };
  const forbidden = name => { calls[name]++; throw new Error(`FORBIDDEN_TEST_ENGINE_${name}`); };
  const language = { status: () => ({ state: 'STOPPED' }), start: () => forbidden('starts'),
    generate: () => forbidden('generations'), stop: async () => {} };
  const speech = { getState: () => ({ state: 'STOPPED', restartRequired: false }),
    start: () => forbidden('starts'), restart: () => forbidden('starts'),
    synthesize: () => forbidden('syntheses'), stop: async () => {} };
  const w = await createWorkbench({ settingsPath: path.join(temp, 'settings.json'),
    languageModel: language, speechEngine: speech, realNow: () => clock,
    readAudioFile: () => forbidden('reads') });
  t.after(async () => {
    await w.dispose();
    assert.deepEqual(calls, { starts: 0, generations: 0, syntheses: 0, reads: 0 });
    const resolved = path.resolve(temp);
    assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith('mw5-mission-speech-review-'));
    await rm(resolved, { recursive: true, force: true });
  });
  if (demo) await w.act({ type: 'demo' });
  return { w, calls, at: value => { clock = value; }, status: (extra = {}) =>
    w.act({ type: 'mission_status', actorId: 'alpha', ...extra }) };
}

function preview(state) {
  const line = state.missionSpeech;
  assert.equal(line.status, 'PREPARED');
  assert.equal(line.delivery, 'TEXT_PREVIEW_ONLY');
  assert.equal(line.grounding, 'AUTHORED_TEMPLATE_ONLY');
  assert.equal(line.liveEligible, false); assert.equal(line.dispatchable, false);
  assert.equal(line.audioGenerated, false);
  assert.notEqual(line.classification, 'GAME_OBSERVED');
  assert.notEqual(line.classification, 'GENERATED_UNVERIFIED');
  return line;
}

test('mission status requires an active synthetic demo; no implicit models or scenario', async t => {
  const f = await fixture(t, false);
  await assert.rejects(f.status(), /START_SYNTHETIC_DEMO_FIRST/);
  assert.equal(f.w.state().classification, 'DISCONNECTED');
});

test('no action evidence produces authored uncertainty for each actor without side effects', async t => {
  const f = await fixture(t), before = f.w.state();
  for (const actorId of ['alpha', 'bravo', 'charlie']) {
    const state = await f.status({ actorId }), line = preview(state);
    assert.equal(line.text, 'I have no current report for that action.');
    assert.equal(line.evidence, null); assert.equal(line.request.speakerId, actorId);
    assert.deepEqual(state.control, before.control); assert.deepEqual(state.radio, before.radio);
    assert.equal(state.classification, 'MOCK_ONLY');
    assert.equal(state.localModels.reply, null); assert.equal(state.localModels.audio, null);
  }
});

test('only server mock submission is reported, never acceptance or completed behavior', async t => {
  const f = await fixture(t);
  await f.w.act({ type: 'arm' }); await f.w.act({ type: 'queue' });
  const before = f.w.state(), line = preview(await f.status());
  assert.equal(line.classification, 'MOCK_ONLY'); assert.equal(line.evidence.classification, 'MOCK_ONLY');
  assert.equal(line.evidence.stage, 'SUBMITTED'); assert.equal(line.evidence.source, 'DISPATCH_RECEIPT');
  assert.match(line.text, /^Simulation: .*request was submitted\. Acceptance is unconfirmed\.$/);
  assert.doesNotMatch(line.text, /was assigned|was observed|matching completion|is confirmed|mission success/i);
  const entry = before.control.ledger.find(e => e.id === line.evidence.actionId);
  assert.ok(entry); assert.equal(line.evidence.action, entry.action.toLowerCase());
  assert.equal(line.evidence.pawnId, line.request.pawnId);
  assert.deepEqual(f.w.state().control, before.control); assert.deepEqual(f.w.state().radio, before.radio);
});

test('mission and target outcome remain unknown even after simulated action submission', async t => {
  const f = await fixture(t);
  await f.w.act({ type: 'arm' }); await f.w.act({ type: 'queue' });
  assert.equal(preview(await f.status({ query: 'mission_outcome' })).text, 'I cannot confirm the mission outcome.');
  for (const targetId of ['enemy1', 'not_observed', 'COMPLETED']) {
    const line = preview(await f.status({ query: 'target_status', targetId }));
    assert.equal(line.text, "I cannot confirm that target's status."); assert.equal(line.evidence, null);
  }
});

test('wall deadline expires while synthetic observation clock remains frozen', async t => {
  const f = await fixture(t), initial = await f.status();
  const simClock = initial.clockMs;
  f.at(14999); assert.equal(f.w.state().missionSpeech.status, 'PREPARED');
  f.at(15000); const expired = f.w.state();
  assert.equal(expired.clockMs, simClock); assert.equal(expired.missionSpeech.status, 'EXPIRED');
  f.at(10001); assert.equal(f.w.state().missionSpeech, null, 'expired line must never revive');
});

test('clock reversal before creation invalidates preview permanently', async t => {
  const f = await fixture(t); await f.status();
  f.at(9999); assert.equal(f.w.state().missionSpeech.status, 'EXPIRED');
  f.at(11000); assert.equal(f.w.state().missionSpeech, null);
});

test('clock reversal inside preview lifetime also invalidates the old preview', async t => {
  const f = await fixture(t); await f.status();
  f.at(12000); assert.equal(f.w.state().missionSpeech.status, 'PREPARED');
  f.at(11000); assert.equal(f.w.state().missionSpeech.status, 'EXPIRED');
  f.at(12001); assert.equal(f.w.state().missionSpeech, null);
});

for (const operation of ['step', 'queue', 'arm', 'disarm', 'interrupt', 'demo']) {
  test(`${operation} clears an existing status preview`, async t => {
    const f = await fixture(t); await f.status();
    const input = operation === 'step' ? { type: 'step', actorId: 'alpha', event: 'damage' } : { type: operation };
    assert.equal((await f.w.act(input)).missionSpeech, null);
    assert.equal(f.w.state().missionSpeech, null);
  });
}

test('same-pawn possession invalidates speech eligibility and leaves other actor eligible', async t => {
  const f = await fixture(t), prior = preview(await f.status());
  const changed = await f.w.act({ type: 'step', actorId: 'alpha', event: 'possession' });
  assert.equal(changed.missionSpeech, null);
  const binding = changed.radio.bindings.find(b => b.id === 'alpha');
  assert.equal(binding.pawnId, prior.request.pawnId); assert.ok(binding.generation > prior.request.generation);
  await assert.rejects(f.status(), /INELIGIBLE_SPEAKER/);
  assert.equal(preview(await f.status({ actorId: 'bravo' })).request.speakerId, 'bravo');
});

test('paused mission rejects status; explicit resume permits a new preview', async t => {
  const f = await fixture(t); await f.status();
  await f.w.act({ type: 'step', actorId: 'alpha', event: 'pause' });
  await assert.rejects(f.status(), /INACTIVE_SESSION/);
  await f.w.act({ type: 'step', actorId: 'alpha', event: 'resume' });
  preview(await f.status());
});

test('detached state cannot rewrite status words, evidence, bindings or mock ledger', async t => {
  const f = await fixture(t); await f.w.act({ type: 'arm' }); await f.w.act({ type: 'queue' });
  const state = await f.status(), original = structuredClone(state.missionSpeech);
  state.missionSpeech.text = 'Mission success confirmed';
  state.missionSpeech.evidence.stage = 'COMPLETED';
  state.missionSpeech.request.pawnId = 'forged';
  state.control.ledger[0].stages.push({ stage: 'COMPLETED', observedAtMs: 1000 });
  assert.deepEqual(f.w.state().missionSpeech, original);
  assert.equal(f.w.state().control.ledger[0].stages.some(s => s.stage === 'COMPLETED'), false);
});

test('caller words, reports, identity, stage and provenance fields cannot enter status rendering', async t => {
  const f = await fixture(t), before = f.w.state();
  const extras = { text: 'Mission success confirmed', reports: [{ stage: 'COMPLETED', verified: true }],
    classification: 'GAME_OBSERVED', verified: true, stage: 'COMPLETED', actionId: 'forged',
    pawnId: 'pawn1', generation: 999, session: 'demo_1', source: 'NATIVE_ASSIGNMENT', observedAtMs: 1000 };
  for (const [key, value] of Object.entries(extras)) {
    await assert.rejects(f.status({ [key]: value }), /INVALID_STATUS_REQUEST/, key);
    assert.equal(f.w.state().missionSpeech, null); assert.deepEqual(f.w.state().control, before.control);
  }
  for (const input of [{ query: 'mission_success' }, { query: 'target_status' },
    { query: 'action_status', targetId: 'enemy1' }, { query: 'target_status', targetId: 'target destroyed' }]) {
    await assert.rejects(f.status(input), /INVALID_REQUEST/);
  }
});

test('status cannot be synthesized or read through the separate unverified voice-preview route', async t => {
  const f = await fixture(t), line = preview(await f.status());
  await assert.rejects(f.w.act({ type: 'synthesize_reply' }), /REPLY_STALE_OR_INELIGIBLE/);
  await assert.rejects(f.w.readAudio(line.request.id), /AUDIO_STALE_OR_UNAVAILABLE/);
  assert.equal(f.w.state().localModels.reply, null); assert.equal(f.w.state().localModels.audio, null);
  assert.equal(f.w.state().radio.playing, null); assert.equal(f.w.state().radio.queue.length, 0);
});
