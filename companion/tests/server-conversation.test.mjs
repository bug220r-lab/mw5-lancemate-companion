// Independent integration review using injected promises and byte buffers only.
// No inference, child processes, microphone, speakers, HTTP or game execution.
import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate as flush } from 'node:timers/promises';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createWorkbench } from '../server.mjs';

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function wave(fill = 0) {
  const bytes = Buffer.alloc(46, fill);
  bytes.write('RIFF', 0); bytes.writeUInt32LE(38, 4); bytes.write('WAVE', 8);
  bytes.write('fmt ', 12); bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20);
  bytes.writeUInt16LE(1, 22); bytes.writeUInt32LE(24000, 24); bytes.writeUInt32LE(48000, 28);
  bytes.writeUInt16LE(2, 32); bytes.writeUInt16LE(16, 34); bytes.write('data', 36); bytes.writeUInt32LE(2, 40);
  return bytes;
}

async function fixture(t, { languageStart = null, speechStart = null } = {}) {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'mw5-conversation-review-'));
  let clock = 10000;
  const generations = [], syntheses = [], reads = [];
  const language = { current: 'READY', starts: 0, stops: 0,
    status() { return { state: this.current, classification: 'INJECTED_FAKE', nativeCalls: 0 }; },
    async start() { this.starts++; this.current = 'STARTING'; if (languageStart) await languageStart.promise; this.current = 'READY'; return this.status(); },
    async stop() { this.stops++; this.current = 'STOPPED'; },
    generate(context, { signal }) { const d = deferred(); generations.push({ ...d, context, signal }); return d.promise; } };
  const speech = { current: 'READY', starts: 0, stops: 0, restarts: 0,
    getState() { return { state: this.current, restartRequired: false, classification: 'INJECTED_FAKE' }; },
    async start() { this.starts++; this.current = 'STARTING'; if (speechStart) await speechStart.promise; this.current = 'READY'; return this.getState(); },
    async restart() { this.restarts++; return this.start(); },
    async stop() { this.stops++; this.current = 'STOPPED'; },
    synthesize(input, { signal }) { const d = deferred(); syntheses.push({ ...d, input, signal }); return d.promise; } };
  const workbench = await createWorkbench({ settingsPath: path.join(temp, 'settings.json'),
    languageModel: language, speechEngine: speech, realNow: () => clock,
    resourcePolicy: { async admit() {}, startWatch() {}, stopWatch() {},
      status: () => ({ monitoring: false, sampling: false, admissionPending: false, cleanupPending: false }) },
    readAudioFile: file => { const d = deferred(); reads.push({ ...d, file }); return d.promise; } });
  t.after(async () => {
    for (const d of [...generations, ...syntheses]) d.resolve(d.input ? { wavPath: 'mock-wave-path' } : 'discarded');
    for (const d of reads) d.resolve(Buffer.from('discarded'));
    languageStart?.resolve(); speechStart?.resolve();
    await flush(); await workbench.dispose();
    const target = path.resolve(temp), parent = path.resolve(os.tmpdir());
    assert.equal(path.dirname(target), parent);
    assert.ok(path.basename(target).startsWith('mw5-conversation-review-'));
    await rm(target, { recursive: true, force: true });
  });
  await workbench.act({ type: 'demo' });
  const converse = async (actorId = 'alpha', text = 'Radio check?') => {
    await workbench.act({ type: 'converse', actorId, text }); await flush();
    return generations.at(-1);
  };
  const reply = async (actorId = 'alpha', text = 'Standing by.') => {
    const generation = await converse(actorId); generation.resolve(text); await flush();
    assert.equal(workbench.state().localModels.reply.status, 'GENERATED');
    return workbench.state().localModels.reply;
  };
  const audio = async (actorId = 'alpha') => {
    await reply(actorId); await workbench.act({ type: 'synthesize_reply' }); await flush();
    const synthesis = syntheses.at(-1); synthesis.resolve({ wavPath: `mock-wave-${syntheses.length}` }); await flush();
    assert.equal(workbench.state().localModels.audio.status, 'READY');
    return workbench.state().localModels.audio.id;
  };
  return { w: workbench, language, speech, generations, syntheses, reads, converse, reply, audio,
    at: value => { clock = value; }, now: () => clock };
}

test('generation is explicit, unverified dialogue never becomes a parsed or dispatched order', async t => {
  const r = await fixture(t);
  assert.equal(r.language.starts, 0); assert.equal(r.speech.starts, 0);
  assert.equal(r.generations.length, 0); assert.equal(r.syntheses.length, 0);
  const before = r.w.state().control;
  const result = await r.reply('alpha', 'focus slot 1');
  assert.equal(result.text, 'focus slot 1'); assert.equal(result.dispatchable, false);
  assert.equal(result.classification, 'GENERATED_UNVERIFIED'); assert.equal(result.grounding, 'NOT_VALIDATED');
  assert.deepEqual(result.sourceFactIds, []); assert.equal(Object.hasOwn(result, 'action'), false);
  assert.equal(r.w.state().control.nativeCalls, 0); assert.equal(r.w.state().control.armed, false);
  assert.deepEqual(r.w.state().control, before);
  assert.equal(r.syntheses.length, 0); assert.equal(r.w.state().radio.playing, null);
  assert.deepEqual(r.generations[0].context.facts, []);
});

for (const event of ['interrupt', 'reset', 'possession', 'pause']) {
  test(`${event} cancels a pending answer and ignored abort cannot republish it`, async t => {
    const r = await fixture(t), generation = await r.converse();
    if (event === 'interrupt') await r.w.act({ type: 'interrupt' });
    else if (event === 'reset') await r.w.act({ type: 'demo' });
    else await r.w.act({ type: 'step', actorId: 'alpha', event });
    assert.equal(generation.signal.aborted, true);
    generation.resolve('Old context must disappear.'); await flush();
    const state = r.w.state();
    assert.ok(!state.localModels.reply || state.localModels.reply.status !== 'GENERATED');
    assert.equal(state.localModels.audio, null); assert.equal(state.radio.playing, null);
    assert.equal(state.control.nativeCalls, 0);
  });
}

for (const event of ['interrupt', 'reset', 'possession', 'pause', 'mute']) {
  test(`${event} invalidates in-flight synthesis and rejects its late output`, async t => {
    const r = await fixture(t); await r.reply(); await r.w.act({ type: 'synthesize_reply' });
    const synthesis = r.syntheses.at(-1);
    if (event === 'interrupt') await r.w.act({ type: 'interrupt' });
    else if (event === 'reset') await r.w.act({ type: 'demo' });
    else if (event === 'mute') { const settings = r.w.state().settings; settings.speechMuted = true; await r.w.act({ type: 'settings', settings }); }
    else await r.w.act({ type: 'step', actorId: 'alpha', event });
    assert.equal(synthesis.signal.aborted, true);
    synthesis.resolve({ wavPath: 'late-wave' }); await flush();
    assert.equal(r.w.state().localModels.audio, null); assert.equal(r.reads.length, 0);
    assert.equal(r.w.state().radio.playing, null);
  });
}

test('reply expiry blocks synthesis and prepared audio fetch without refreshing the old reply', async t => {
  const r = await fixture(t); const reply = await r.reply(); r.at(reply.expiresAtMs);
  await assert.rejects(r.w.act({ type: 'synthesize_reply' }), /REPLY_STALE_OR_INELIGIBLE/);
  assert.equal(r.syntheses.length, 0);
  r.at(reply.expiresAtMs + 1); const audioId = await r.audio();
  r.at(r.w.state().localModels.reply.expiresAtMs);
  await assert.rejects(r.w.readAudio(audioId), /AUDIO_STALE_OR_UNAVAILABLE/);
  assert.equal(r.reads.length, 0); assert.equal(r.w.state().radio.playing, null);
});

test('one shared radio reservation excludes an authored preview and prevents duplicate audio fetches', async t => {
  const r = await fixture(t), audioId = await r.audio();
  await r.w.act({ type: 'radio', actorId: 'bravo' });
  const authored = r.w.state().radio.playing.lineId;
  await assert.rejects(r.w.readAudio(audioId), /RADIO_OCCUPIED/); assert.equal(r.reads.length, 0);
  await r.w.act({ type: 'radio_complete', lineId: authored });
  const pending = r.w.readAudio(audioId); await flush();
  assert.equal(r.reads.length, 1); assert.equal(r.w.state().radio.playing.lineId, audioId);
  await assert.rejects(r.w.readAudio(audioId), /RADIO_OCCUPIED|AUDIO_STALE_OR_UNAVAILABLE/);
  const expected = wave(); r.reads[0].resolve(expected);
  assert.deepEqual(await pending, expected);
  assert.equal(r.w.state().localModels.audio.status, 'DELIVERED_FOR_USER_PLAYBACK');
  await assert.rejects(r.w.readAudio(audioId), /AUDIO_STALE_OR_UNAVAILABLE/);
  assert.equal(r.reads.length, 1);
});

test('reply expiry during an asynchronous audio read discards bytes and releases its radio slot', async t => {
  const r = await fixture(t), id = await r.audio();
  const pending = r.w.readAudio(id); const rejected = assert.rejects(pending, /AUDIO_STALE_OR_UNAVAILABLE/); await flush();
  assert.equal(r.reads.length, 1); r.at(r.w.state().localModels.reply.expiresAtMs);
  r.reads[0].resolve(Buffer.from('expired wave')); await rejected;
  assert.equal(r.w.state().radio.playing, null);
  assert.notEqual(r.w.state().localModels.audio?.status, 'DELIVERED_FOR_USER_PLAYBACK');
});

for (const event of ['reset', 'possession', 'interrupt', 'mute']) {
  test(`${event} during asynchronous audio read rejects stale bytes after await`, async t => {
    const r = await fixture(t), id = await r.audio();
    const pending = r.w.readAudio(id); const rejected = assert.rejects(pending, /AUDIO_STALE_OR_UNAVAILABLE/); await flush();
    if (event === 'reset') await r.w.act({ type: 'demo' });
    else if (event === 'possession') await r.w.act({ type: 'step', actorId: 'alpha', event: 'possession' });
    else if (event === 'mute') { const settings = r.w.state().settings; settings.speechMuted = true; await r.w.act({ type: 'settings', settings }); }
    else await r.w.act({ type: 'interrupt' });
    r.reads[0].resolve(Buffer.from('stale bytes')); await rejected;
    assert.equal(r.w.state().localModels.audio, null); assert.equal(r.w.state().radio.playing, null);
  });
}

test('old audio read cannot complete or interrupt a newer mission audio reservation', async t => {
  const r = await fixture(t), oldId = await r.audio();
  const oldRead = r.w.readAudio(oldId); const oldRejected = assert.rejects(oldRead, /AUDIO_STALE_OR_UNAVAILABLE/); await flush();
  await r.w.act({ type: 'demo' });
  const freshId = await r.audio('bravo'), freshRead = r.w.readAudio(freshId); await flush();
  assert.equal(r.reads.length, 2); assert.equal(r.w.state().radio.playing.lineId, freshId);
  r.reads[0].resolve(Buffer.from('old wave')); await oldRejected;
  assert.equal(r.w.state().localModels.audio.id, freshId);
  assert.equal(r.w.state().radio.playing?.lineId, freshId);
  assert.notEqual(r.w.state().localModels.audio.status, 'DELIVERED_FOR_USER_PLAYBACK');
  const expected = wave(1); r.reads[1].resolve(expected); assert.deepEqual(await freshRead, expected);
});

test('failed audio read releases its reservation without preventing another pilot preview', async t => {
  const r = await fixture(t), id = await r.audio();
  const read = r.w.readAudio(id); const rejected = assert.rejects(read); await flush();
  r.reads[0].reject(new Error('synthetic read failure')); await rejected;
  assert.equal(r.w.state().radio.playing, null);
  await r.w.act({ type: 'radio', actorId: 'bravo' });
  assert.equal(r.w.state().radio.playing?.speakerId, 'bravo');
});

test('stopped model startup cannot start the speech engine after language startup resolves', async t => {
  const start = deferred(), r = await fixture(t, { languageStart: start });
  r.language.current = 'STOPPED'; r.speech.current = 'STOPPED';
  await r.w.act({ type: 'models_start' }); await r.w.act({ type: 'models_start' });
  assert.equal(r.language.starts, 1);
  const stopping = r.w.act({ type: 'models_stop' }); await flush(); start.resolve();
  await stopping; await flush();
  assert.equal(r.speech.starts, 0); assert.equal(r.speech.restarts, 0);
  assert.equal(r.w.state().localModels.starting, false); assert.equal(r.w.state().localModels.reply, null);
});

test('workbench disposal suppresses pending model startup continuation', async t => {
  const start = deferred(), r = await fixture(t, { languageStart: start });
  r.language.current = 'STOPPED'; r.speech.current = 'STOPPED';
  await r.w.act({ type: 'models_start' }); const disposing = r.w.dispose(); await flush(); start.resolve();
  await disposing; await flush();
  assert.equal(r.speech.starts, 0); assert.equal(r.speech.restarts, 0);
});

test('quiet, microphone mute and disarming do not become speech mute or control permission', async t => {
  const r = await fixture(t); const settings = r.w.state().settings;
  settings.quiet = true; settings.micMuted = true; await r.w.act({ type: 'settings', settings });
  await r.w.act({ type: 'disarm' }); const id = await r.audio('charlie');
  const pending = r.w.readAudio(id); await flush(); const expected = wave(); r.reads[0].resolve(expected);
  assert.deepEqual(await pending, expected);
  const state = r.w.state(); assert.equal(state.control.armed, false); assert.equal(state.control.nativeCalls, 0);
  assert.equal(state.radio.gates.quiet, true); assert.equal(state.radio.gates.micMuted, true);
  assert.equal(state.radio.gates.speechMuted, false);
});

test('audio delivery revalidates its radio reservation after an asynchronous read', async t => {
  const r = await fixture(t), id = await r.audio();
  const pending = r.w.readAudio(id); const rejected = assert.rejects(pending, /AUDIO_STALE_OR_UNAVAILABLE|RADIO_REJECTED|RADIO_RESERVATION_LOST/); await flush();
  await r.w.act({ type: 'radio', actorId: 'bravo' });
  await r.w.act({ type: 'radio_complete', lineId: id });
  const nextLine = r.w.state().radio.playing;
  assert.equal(nextLine.speakerId, 'bravo');
  r.reads[0].resolve(wave()); await rejected;
  assert.equal(r.w.state().radio.playing?.lineId, nextLine.lineId);
  assert.notEqual(r.w.state().localModels.audio?.status, 'DELIVERED_FOR_USER_PLAYBACK');
});

test('failed model termination must not be reported as confirmed stopped', async t => {
  const r = await fixture(t);
  r.language.stop = async () => { r.language.current = 'FAILED'; throw new Error('PROCESS_STOP_UNCONFIRMED'); };
  const state = await r.w.act({ type: 'models_stop' });
  assert.notEqual(state.last.status, 'LOCAL_MODELS_STOPPED');
  assert.ok(state.localModels.error);
});

test('disposed workbench cannot start new language or speech workers', async t => {
  const r = await fixture(t); await r.w.dispose();
  let rejected = false;
  try { const result = await r.w.act({ type: 'models_start' }); rejected = result.last?.status === 'REJECTED'; }
  catch { rejected = true; }
  await flush(); assert.equal(rejected, true);
  assert.equal(r.language.starts, 0); assert.equal(r.speech.starts, 0);
});

test('preview deadline defaults to four seconds and slow audition explicitly changes only the preview limit', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const r = await fixture(t);
  assert.equal(r.w.state().localModels.previewDeadlineMs, 4000);
  assert.equal(r.w.state().localModels.firstSpokenTargetMs, 4000);
  const strict = await r.converse(); t.mock.timers.tick(3999);
  assert.equal(strict.signal.aborted, false); t.mock.timers.tick(1); await flush();
  assert.equal(strict.signal.aborted, true); assert.equal(r.w.state().localModels.reply.reason, 'GENERATION_TIMEOUT');
  strict.resolve('discard'); await flush();
  const slower = await r.w.act({ type: 'preview_timing', allowSlow: true });
  assert.equal(slower.localModels.previewDeadlineMs, 10000);
  assert.equal(slower.localModels.firstSpokenTargetMs, 4000);
  assert.equal(slower.localModels.timingAcceptance, 'NOT_ESTABLISHED');
  const slow = await r.converse(); t.mock.timers.tick(4001); assert.equal(slow.signal.aborted, false);
  t.mock.timers.tick(5999); await flush(); assert.equal(slow.signal.aborted, true);
  assert.equal(r.w.state().localModels.reply.reason, 'GENERATION_TIMEOUT');
});

test('preview timing rejects nonbooleans without changing mode or cancelling a valid pending request', async t => {
  const r = await fixture(t), active = await r.converse();
  for (const allowSlow of [null, 0, 1, 'true', {}, undefined]) {
    await assert.rejects(r.w.act({ type: 'preview_timing', allowSlow }), /INVALID_PREVIEW_TIMING/);
    assert.equal(r.w.state().localModels.previewDeadlineMs, 4000);
    assert.equal(active.signal.aborted, false);
  }
  active.resolve('Valid request survives invalid settings.'); await flush();
  assert.equal(r.w.state().localModels.reply.status, 'GENERATED');
});

test('timing changes cancel old generation and synthesis and reset persona conversation history', async t => {
  const r = await fixture(t); await r.reply('alpha', 'Previous dialogue.');
  const old = await r.converse(); assert.equal(old.context.history.length, 1);
  const before = r.w.state().control; await r.w.act({ type: 'preview_timing', allowSlow: true });
  assert.equal(old.signal.aborted, true); assert.equal(r.w.state().localModels.reply, null);
  assert.deepEqual(r.w.state().control, before);
  old.resolve('Must never return.'); await flush(); assert.equal(r.w.state().localModels.reply, null);
  const fresh = await r.converse(); assert.deepEqual(fresh.context.history, []);
  fresh.resolve('New dialogue.'); await flush(); await r.w.act({ type: 'synthesize_reply' });
  const synthesis = r.syntheses.at(-1);
  await r.w.act({ type: 'preview_timing', allowSlow: false }); assert.equal(synthesis.signal.aborted, true);
  synthesis.resolve({ wavPath: 'old-timing-wave' }); await flush();
  assert.equal(r.w.state().localModels.audio, null); assert.equal(r.w.state().localModels.reply, null);
  assert.equal(r.w.state().localModels.previewDeadlineMs, 4000);
});

test('changing timing preserves possessed identity, pause, mute, quiet and tactical human hold state', async t => {
  const r = await fixture(t); const settings = r.w.state().settings;
  settings.quiet = true; settings.speechMuted = true; await r.w.act({ type: 'settings', settings });
  await r.w.act({ type: 'step', actorId: 'bravo', event: 'hold' });
  await r.w.act({ type: 'step', actorId: 'alpha', event: 'possession' });
  await r.w.act({ type: 'step', actorId: 'bravo', event: 'pause' });
  const before = r.w.state(); const after = await r.w.act({ type: 'preview_timing', allowSlow: true });
  assert.deepEqual(after.control, before.control); assert.deepEqual(after.radio.bindings, before.radio.bindings);
  assert.equal(after.radio.gates.paused, true); assert.equal(after.radio.gates.speechMuted, true); assert.equal(after.radio.gates.quiet, true);
  await r.w.act({ type: 'converse', actorId: 'alpha', text: 'Should remain ineligible.' }); await flush();
  assert.equal(r.w.state().localModels.reply.status, 'REJECTED');
  assert.equal(r.w.state().localModels.reply.reason, 'BINDING_INVALID'); assert.equal(r.generations.length, 0);
  await r.w.act({ type: 'converse', actorId: 'bravo', text: 'Still paused.' }); await flush();
  assert.equal(r.w.state().localModels.reply.reason, 'PAUSED'); assert.equal(r.generations.length, 0);
});
