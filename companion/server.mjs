// Local offline workbench. Explicit local speech previews never grant game control.
import http from 'node:http';
import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { ControlSession } from './control.mjs';
import { replayFrames } from './observation.mjs';
import { createRadioDirector, parseSpokenCommand } from './radio.mjs';
import { baseline } from '../synthetic/tactical-cases.mjs';
import { createConversationCoordinator } from './conversation.mjs';
import { createLocalLanguageModel } from './local-language-model.mjs';
import { createLocalSpeech, LOCAL_SPEECH_VOICES } from './local-speech.mjs';
import { prepareMissionSpeech, revalidateMissionSpeech } from './mission-speech.mjs';
import { createLocalRecognition } from './local-recognition.mjs';
import { createSpeechInput } from './speech-input.mjs';
import { createWorkbenchResources } from './workbench-resources.mjs';

const directory = path.dirname(fileURLToPath(import.meta.url));
const profiles = JSON.parse(await readFile(path.join(directory, 'personas.json'), 'utf8'));
const MAX_BODY = 256 * 1024;
const MAX_WAV = 44 + 15000 * 32;
const clone = x => structuredClone(x);
const ids = ['alpha', 'bravo', 'charlie'];
const radioProfiles = profiles.profiles.map((profile, index) => ({ ...profile, id: ids[index] }));
const radioGates = settings => ({ micMuted: settings.micMuted, speechMuted: settings.speechMuted, quiet: settings.quiet });
const defaults = () => ({ version: 1, micMuted: false, speechMuted: false, quiet: false,
  pilots: ids.map((id, index) => ({ id, profile: profiles.profiles[index].id,
    callsign: null, voice: null, mode: 'ADVISORY' })) });

export function validateSettings(input) {
  if (!input || input.version !== 1 || !['micMuted', 'speechMuted', 'quiet'].every(k => typeof input[k] === 'boolean') ||
      !Array.isArray(input.pilots) || input.pilots.length !== 3) throw new Error('INVALID_SETTINGS');
  const pilots = ids.map((id, index) => {
    const p = input.pilots[index];
    if (!p || p.id !== id || p.profile !== defaults().pilots[index].profile ||
        !['NATIVE', 'ADVISORY'].includes(p.mode) ||
        !['callsign', 'voice'].every(k => p[k] === null || (typeof p[k] === 'string' && p[k].length <= 64 &&
          !/[\x00-\x1f\x7f]/.test(p[k])))) throw new Error('INVALID_PILOT_SETTINGS');
    return { id, profile: p.profile, callsign: p.callsign?.trim() || null, voice: p.voice?.trim() || null, mode: p.mode };
  });
  return { version: 1, micMuted: input.micMuted, speechMuted: input.speechMuted, quiet: input.quiet, pilots };
}

export async function createWorkbench({ settingsPath = path.join(directory, 'local', 'settings.json'),
  languageModel = null, speechEngine = null, recognitionEngine = null,
  realNow = () => Date.now(), readAudioFile = readFile, resourcePolicy = null, residentStopTimeoutMs = 6000 } = {}) {
  if (!Number.isInteger(residentStopTimeoutMs) || residentStopTimeoutMs < 1 || residentStopTimeoutMs > 10000)
    throw new Error('INVALID_RESIDENT_STOP_TIMEOUT');
  let settings = defaults(), settingsStatus = 'DEFAULTS';
  try { settings = validateSettings(JSON.parse(await readFile(settingsPath, 'utf8'))); settingsStatus = 'LOADED'; }
  catch (error) { if (error.code !== 'ENOENT') settingsStatus = 'INVALID_SETTINGS_IGNORED'; }
  let clock = 1000, sequence = 0, epoch = 0, snapshot = null, last = null;
  let control = new ControlSession(), radio = createRadioDirector({ personas: radioProfiles, now: () => clock });
  const language = languageModel ?? createLocalLanguageModel();
  const speech = speechEngine ?? createLocalSpeech();
  const resources = resourcePolicy ?? createWorkbenchResources();
  if (!['admit', 'startWatch', 'stopWatch', 'status'].every(k => typeof resources[k] === 'function'))
    throw new Error('INVALID_RESOURCE_POLICY');
  let previewDeadlineMs = 4000;
  const newConversation = () => createConversationCoordinator({
    personas: profiles.profiles.map(profile => ({ ...profile,
      callsign: settings.pilots.find(p => p.profile === profile.id).callsign })),
    generate: (context, options) => language.generate(context, options), now: realNow, timeoutMs: previewDeadlineMs });
  const conversation = newConversation();
  let settingsSaving = false, pendingCallsignActors = new Set();
  let modelError = null, modelStart = null, modelEpoch = 0, reply = null, audioJob = null, disposed = false;
  let modelStop = null, modelAbort = null, stopUnconfirmed = false;
  let missionSpeech = null;
  function statusContext() {
    const entries = control.getState().ledger;
    // Only the server-owned MOCK ledger is mapped. Arbitrary HTTP reports,
    // generated dialogue and radio verified:true flags never enter this path.
    const reports = snapshot.lancemates.flatMap(actor => {
      const entry = entries.findLast(e => e.actorId === actor.id);
      const stage = entry?.stages.at(-1);
      if (!stage || entry.classification !== 'MOCK_ONLY' || entry.binding !== `${actor.controllerId}:${actor.pawnId}:${actor.generation}`) return [];
      return [{ id: `report_${actor.id}`, session: entry.session, actorId: actor.id, pawnId: actor.pawnId,
        generation: actor.generation, actionId: entry.id, action: entry.action.toLowerCase(), stage: stage.stage,
        source: { SUBMITTED: 'DISPATCH_RECEIPT', ASSIGNED: 'NATIVE_ASSIGNMENT', BEHAVIOR_OBSERVED: 'INDEPENDENT_OBSERVATION',
          COMPLETED: 'MATCHED_COMPLETION', REJECTED: 'DISPATCH_REJECTION' }[stage.stage], classification: 'MOCK_ONLY',
        observedAtMs: stage.observedAtMs, expiresAtMs: stage.observedAtMs + 5000 }];
    });
    return { session: snapshot.session, nowMs: clock, phase: snapshot.phase, reports,
      bindings: snapshot.lancemates.map(({ id,pawnId,generation,aiOwned,alive }) => ({ id,pawnId,generation,aiOwned,alive })) };
  }
  function statusPreview() {
    if (!missionSpeech || !snapshot) return null;
    const at = realNow();
    const result = Number.isFinite(at) && at >= missionSpeech.wallLastObservedMs && at < missionSpeech.wallExpiresAtMs && !disposed
      ? revalidateMissionSpeech(missionSpeech.line, statusContext()) : { status: 'REJECTED', reason: 'WALL_CLOCK_EXPIRED_OR_INVALID' };
    if (result.status !== 'VALID') { missionSpeech = null; return { status: 'EXPIRED', reason: result.reason }; }
    missionSpeech.wallLastObservedMs = at;
    return { ...clone(missionSpeech.line), delivery: 'TEXT_PREVIEW_ONLY', wallExpiresAtMs: missionSpeech.wallExpiresAtMs };
  }
  const stopAudio = reason => {
    if (audioJob) audioJob.abort.abort(reason);
    audioJob = null; radio.interrupt(reason);
  };
  function cancelConversation(reason) { conversation.cancelAll(reason); reply = null; stopAudio(reason); }
  const speechInput = createSpeechInput({ recognizer: recognitionEngine ?? createLocalRecognition({ requestTimeoutMs: 10000 }),
    getContext: () => disposed || !snapshot ? null : { session: snapshot.session, phase: snapshot.phase,
      micMuted: settings.micMuted, bindings: bindings() }, now: realNow,
    onInterrupt: reason => { missionSpeech = null; cancelConversation(reason); },
    onPttChange: ptt => radio.setGates({ ptt }) });
  const resourcePending = () => resources.status().cleanupPending === true;
  const residentPending = () => !!modelStart || !!modelStop || stopUnconfirmed || resourcePending();
  function residentActive() {
    const owned = value => value.ownedPid != null || !!value.ownedProcess || value.ownsProcess === true ||
      value.ownedProcessStopped === false || value.processStopConfirmed === false ||
      !['NEW', 'STOPPED', 'FAILED', 'DISPOSED'].includes(value.state);
    return !!modelStart || owned(language.status()) || owned(speech.getState());
  }
  function stoppedResult() {
    return { status: residentPending() ? 'LOCAL_MODEL_STOP_UNCONFIRMED' : 'LOCAL_MODELS_STOPPED' };
  }
  function engineStopped(value) {
    return value.state === 'STOPPED' && value.ownedProcessStopped !== false && value.processStopConfirmed !== false &&
      value.ownsProcess !== true && !value.ownedProcess && value.ownedPid == null &&
      value.activeGeneration !== true && value.busy !== true;
  }
  function stopResidents(reason, preserveError = false) {
    ++modelEpoch; modelAbort?.abort(); resources.stopWatch();
    speechInput.invalidate(reason); cancelConversation(reason);
    if (modelStop) return modelStop.public;
    const owned = {}; modelStop = owned;
    const drained = Promise.allSettled([Promise.resolve().then(() => language.stop()),
      Promise.resolve().then(() => speech.stop(reason))]).then(results => {
      stopUnconfirmed = results.some(result => result.status === 'rejected') ||
        !engineStopped(language.status()) || !engineStopped(speech.getState());
      if (!preserveError) modelError = stopUnconfirmed ? 'LOCAL_MODEL_STOP_UNCONFIRMED' : null;
    }).catch(() => { stopUnconfirmed = true; modelError = 'LOCAL_MODEL_STOP_UNCONFIRMED'; })
      .finally(() => { if (modelStop === owned) modelStop = null; });
    let deadline;
    owned.public = Promise.race([drained, new Promise(resolve => {
      deadline = setTimeout(resolve, residentStopTimeoutMs);
    })]).then(() => stoppedResult()).finally(() => clearTimeout(deadline));
    return owned.public;
  }
  function resourceBreach(epoch, code) {
    if (epoch !== modelEpoch || disposed) return;
    modelError = code;
    void stopResidents(code, true);
  }
  function startResidents() {
    if (modelStart && !modelStop && !stopUnconfirmed && !resourcePending() && modelAbort?.signal.aborted === false) return true;
    if (modelStart || modelStop || stopUnconfirmed || resourcePending()) throw new Error('LOCAL_MODEL_CLEANUP_PENDING');
    const policyState = resources.status();
    if (language.status().state === 'READY' && speech.getState().state === 'READY' && policyState.monitoring === true) return false;
    if (policyState.sampling || policyState.admissionPending) throw new Error('LOCAL_MODEL_CLEANUP_PENDING');
    resources.stopWatch(); speechInput.invalidate('MODELS_STARTING'); cancelConversation('MODELS_STARTING');
    modelError = null;
    const epoch = ++modelEpoch, controller = new AbortController(); modelAbort = controller;
    const owned = {}; modelStart = owned;
    owned.done = (async () => {
      try {
        await resources.admit({ signal: controller.signal });
        if (epoch !== modelEpoch || disposed) return;
        resources.startWatch(code => resourceBreach(epoch, code), residentActive);
        await language.start();
        if (epoch !== modelEpoch || disposed) { await stopResidents('STALE_MODEL_START', true); return; }
        await resources.admit({ signal: controller.signal });
        if (epoch !== modelEpoch || disposed) return;
        if (speech.getState().restartRequired) await speech.restart(); else await speech.start();
        if (epoch !== modelEpoch || disposed) await stopResidents('STALE_MODEL_START', true);
      } catch (error) {
        if (epoch === modelEpoch && !disposed) {
          modelError = /^[A-Z_]+$/.test(error?.code || error?.message || '') ? (error.code || error.message) : 'LOCAL_MODEL_START_FAILED';
          await stopResidents(modelError, true);
        }
      } finally {
        if (modelStart === owned) modelStart = null;
        if (modelAbort === controller) modelAbort = null;
      }
    })();
    return true;
  }
  function audioCurrent() {
    speechInput.status();
    const actor = snapshot?.lancemates.find(a => a.id === reply?.speakerId);
    return !disposed && !residentPending() && !pendingCallsignActors.has(reply?.speakerId) && reply?.status === 'GENERATED' && reply.session === snapshot?.session && actor?.aiOwned === true &&
      actor.alive === true && actor.pawnId === reply.pawnId && actor.generation === reply.generation &&
      reply.expiresAtMs > realNow() && snapshot.phase === 'active' && !settings.speechMuted && !radio.getState().gates.ptt;
  }
  const state = () => {
    // Validate the capture lease before taking the radio snapshot: validation can release PTT.
    const inputState = speechInput.status();
    return ({ classification: snapshot ? 'MOCK_ONLY' : 'DISCONNECTED',
    clockMs: clock, settings: clone(settings), settingsStatus, profiles: clone(profiles),
    control: control.getState(), radio: radio.getState(), last: clone(last), missionSpeech: statusPreview(),
    localModels: { language: language.status(), speech: speech.getState(), error: modelError,
      resources: resources.status(), stopping: !!modelStop, cleanupPending: !!modelStop || stopUnconfirmed || resourcePending() || (!!modelStart && modelAbort?.signal.aborted === true),
      starting: !!modelStart, previewDeadlineMs, firstSpokenTargetMs: 4000, timingAcceptance: 'NOT_ESTABLISHED',
      reply: clone(reply), audio: audioJob ? { id: audioJob.id, status: audioJob.status,
        voiceId: audioJob.voiceId, error: audioJob.error, classification: 'LOCAL_AUDIO_PREVIEW_NOT_GAMEPLAY' } : null },
    speechInput: inputState,
    integration: { game: 'NOT_BUILT', microphone: 'EXPLICIT_BROWSER_PREVIEW_ONLY', synthesis: speech.getState().state,
      conversation: language.status().state, directPiloting: 'NOT_BUILT', observedGameplayTests: 'NOT_PERFORMED' } });
  };
  function bindings() { return snapshot.lancemates.map((a, index) => ({ id: a.id, pawnId: a.pawnId,
    generation: a.generation, alive: a.alive, aiOwned: a.aiOwned, slot: index + 1 })); }
  function conversationBindings() { return bindings().map(b => ({ ...b,
    profileId: settings.pilots.find(p => p.id === b.id).profile })); }
  function ingest() {
    snapshot.sequence = ++sequence; snapshot.observedAtMs = clock; snapshot.nowMs = clock;
    snapshot.targets.forEach(t => { t.observedAtMs = clock; });
    return control.ingest({ schemaVersion: 1, kind: 'observation', adapterId: 'offline_workbench',
      provenance: 'MOCK_ONLY', session: snapshot.session, sequence, observedAtMs: clock, snapshot: clone(snapshot) });
  }
  function newDemo() {
    speechInput.invalidate('MISSION_CHANGED');
    missionSpeech = null;
    cancelConversation('MISSION_CHANGED');
    clock = 1000; sequence = 0; snapshot = baseline(); snapshot.session = `demo_${++epoch}`;
    snapshot.lancemates = ids.map((id, index) => ({ ...clone(snapshot.lancemates[0]), id,
      pawnId: `pawn${index + 1}`, controllerId: `controller${index + 1}`,
      weaponRangeM: [{ min: 0, max: 180 }, { min: 100, max: 700 }, { min: 0, max: 400 }][index] }));
    snapshot.lancemates[0].distanceToLeaderM = 700;
    control = new ControlSession({ mode: 'MOCK_ONLY', now: () => clock });
    radio = createRadioDirector({ personas: radioProfiles, now: () => clock }); radio.startMission(snapshot.session, bindings());
    conversation.startMission(snapshot.session, conversationBindings());
    conversation.setGates({ paused: false, speechMuted: settings.speechMuted, quiet: settings.quiet });
    radio.setGates(radioGates(settings)); return ingest();
  }
  async function act(input) {
    if (disposed) throw new Error('WORKBENCH_CLOSED');
    if (!input || typeof input.type !== 'string') throw new Error('INVALID_ACTION');
    speechInput.status();
    if (['step','queue','arm','disarm','interrupt'].includes(input.type)) missionSpeech = null;
    if (input.type === 'recognition_prepare') {
      // Preflight is asynchronous; it must never prevent a cancellation action.
      void speechInput.prepare().catch(() => {});
      last = { status: 'RECOGNITION_PREFLIGHT_REQUESTED', dispatchable: false, nativeCalls: 0 };
    } else if (input.type === 'ptt_begin') {
      speechInput.begin();
      last = { status: 'MICROPHONE_CAPTURE_GRANTED', dispatchable: false, nativeCalls: 0 };
    } else if (input.type === 'ptt_cancel') {
      if (typeof input.captureId !== 'string') throw new Error('CAPTURE_ID_REQUIRED');
      speechInput.cancel(input.captureId, 'USER_CANCELLED');
      last = { status: 'CAPTURE_CANCEL_REQUESTED', dispatchable: false, nativeCalls: 0 };
    } else if (input.type === 'recognition_stop') {
      speechInput.invalidate('USER_STOP');
      last = { status: 'RECOGNITION_STOP_REQUESTED', dispatchable: false, nativeCalls: 0 };
    } else if (input.type === 'preview_timing') {
      if (typeof input.allowSlow !== 'boolean') throw new Error('INVALID_PREVIEW_TIMING');
      const updated = conversation.setTimeoutMs(input.allowSlow ? 10000 : 4000);
      if (updated.status !== 'UPDATED') throw new Error(updated.reason);
      cancelConversation('PREVIEW_TIMING_CHANGED'); previewDeadlineMs = updated.timeoutMs;
      last = { status: input.allowSlow ? 'SLOW_OFFLINE_AUDITION' : 'STRICT_OFFLINE_PREVIEW',
        firstSpokenTargetMs: 4000, timingAcceptance: 'NOT_ESTABLISHED', nativeCalls: 0 };
    } else if (input.type === 'models_start') {
      const started = startResidents();
      last = { status: started ? 'STARTING_LOCAL_MODELS' : 'LOCAL_MODELS_READY', gameConnected: false };
    } else if (input.type === 'models_stop') {
      last = { ...await stopResidents('MODELS_STOPPED'), nativeCalls: 0 };
    } else if (input.type === 'interrupt') {
      speechInput.invalidate('USER_INTERRUPTED');
      cancelConversation('USER_INTERRUPTED'); last = { status: 'SPEECH_INTERRUPTED', nativeCalls: 0 };
    } else if (input.type === 'demo') last = newDemo();
    else if (input.type === 'settings') {
      if (settingsSaving) throw new Error('SETTINGS_SAVE_PENDING');
      const next = validateSettings(input.settings);
      settingsSaving = true;
      pendingCallsignActors = new Set(next.pilots.filter(p =>
        p.callsign !== settings.pilots.find(old => old.id === p.id).callsign).map(p => p.id));
      // Invalidate before any persistence await. Unsaved names never enter a
      // prompt, and old speaker work cannot become eligible during the write.
      if (pendingCallsignActors.has(reply?.speakerId)) {
        conversation.cancel(reply.id); reply = null; stopAudio('CALLSIGN_CHANGED');
      }
      try {
        if (next.micMuted) speechInput.invalidate('MICROPHONE_MUTED');
        await mkdir(path.dirname(settingsPath), { recursive: true });
        await writeFile(`${settingsPath}.tmp`, JSON.stringify(next, null, 2) + '\n', { mode: 0o600 });
        await rename(`${settingsPath}.tmp`, settingsPath);
        settings = next; settingsStatus = 'SAVED'; radio.setGates(radioGates(settings));
        conversation.updateCallsigns(settings.pilots.map(p => ({ profileId: p.profile, callsign: p.callsign })));
        conversation.setGates({ speechMuted: settings.speechMuted, quiet: settings.quiet });
        if (settings.speechMuted) cancelConversation('SPEECH_MUTED');
        // Preferences never grant control. Changing modes requires explicit rearming of the mock.
        control.disarm('SETTINGS_CHANGED'); last = { status: 'SETTINGS_SAVED', nativeCalls: 0 };
      } finally { settingsSaving = false; pendingCallsignActors = new Set(); }
    } else if (input.type === 'replay') {
      if (!Array.isArray(input.frames) || input.frames.length > 128) throw new Error('REPLAY_FRAME_LIMIT');
      last = replayFrames(input.frames, { allowSynthetic: input.allowSynthetic === true });
    } else if (input.type === 'disarm') last = control.disarm();
    else {
      if (!snapshot) throw new Error('START_SYNTHETIC_DEMO_FIRST');
      if (input.type === 'mission_status') {
        if (Object.keys(input).some(k => !['type','actorId','query','targetId'].includes(k))) throw new Error('INVALID_STATUS_REQUEST');
        const actor = snapshot.lancemates.find(a => a.id === input.actorId);
        if (!actor) throw new Error('INVALID_RECIPIENT');
        const context = statusContext(), report = context.reports.find(r => r.actorId === actor.id);
        const query = input.query ?? 'action_status';
        const request = { id: randomUUID(), session: snapshot.session, speakerId: actor.id, pawnId: actor.pawnId,
          generation: actor.generation, query, ...(query === 'action_status' ? { actionId: report?.actionId ?? 'unobserved_action' } : {}),
          ...(Object.hasOwn(input, 'targetId') ? { targetId: input.targetId } : {}) };
        const line = prepareMissionSpeech(request, context), at = realNow();
        if (line.status !== 'PREPARED') throw new Error(line.reason);
        if (!Number.isFinite(at) || at < 0) throw new Error('INVALID_CLOCK');
        missionSpeech = { line, wallCreatedAtMs: at, wallLastObservedMs: at, wallExpiresAtMs: at + 5000 };
        last = { status: 'AUTHORED_STATUS_PREVIEW', classification: line.classification, nativeCalls: 0,
          audioGenerated: false, conversationAcceptance: 'NOT_ESTABLISHED' };
      } else if (input.type === 'converse') {
        if (residentPending()) throw new Error('LOCAL_MODEL_CLEANUP_PENDING');
        if (radio.getState().gates.ptt) throw new Error('USER_SPEAKING');
        if (language.status().state !== 'READY') throw new Error('LOCAL_LANGUAGE_MODEL_NOT_READY');
        const b = bindings().find(b => b.id === input.actorId); if (!b) throw new Error('INVALID_RECIPIENT');
        if (pendingCallsignActors.has(b.id)) throw new Error('CALLSIGN_UPDATE_PENDING');
        if (reply?.status === 'GENERATING') throw new Error('CONVERSATION_BUSY');
        stopAudio('NEW_REQUEST');
        const id = randomUUID(), request = { id, session: snapshot.session, speakerId: b.id, pawnId: b.pawnId,
          generation: b.generation, priority: 'answer', text: input.text, facts: [], expiresAtMs: realNow() + 10000 };
        reply = { ...request, status: 'GENERATING', classification: 'OFFLINE_CONVERSATION_PREVIEW' };
        conversation.request(request).then(result => { if (reply?.id === id) reply = result; })
          .catch(() => { if (reply?.id === id) reply = { id, status: 'FAILED', reason: 'CONVERSATION_FAILED' }; });
        last = { status: 'GENERATING', id, factSource: 'NO_LIVE_MISSION_FACTS', nativeCalls: 0 };
      } else if (input.type === 'synthesize_reply') {
        if (residentPending()) throw new Error('LOCAL_MODEL_CLEANUP_PENDING');
        if (!audioCurrent()) throw new Error('REPLY_STALE_OR_INELIGIBLE');
        if (speech.getState().state !== 'READY') throw new Error('LOCAL_SPEECH_NOT_READY');
        if (audioJob?.status === 'SYNTHESIZING') throw new Error('SPEECH_BUSY');
        const index = ids.indexOf(reply.speakerId), configured = settings.pilots[index].voice;
        const voiceId = LOCAL_SPEECH_VOICES.includes(configured) ? configured : LOCAL_SPEECH_VOICES[index];
        const id = randomUUID(), resultId = reply.id;
        const job = { id, replyId: resultId, voiceId, status: 'SYNTHESIZING', abort: new AbortController() };
        audioJob = job;
        speech.synthesize({ text: reply.text, voiceId }, { signal: job.abort.signal }).then(result => {
          if (audioJob !== job || reply?.id !== resultId || !audioCurrent()) { if (audioJob === job) { job.status = 'EXPIRED'; } return; }
          job.status = 'READY'; job.wavPath = result.wavPath;
        }).catch(error => { if (audioJob === job) { job.status = 'FAILED'; job.error = error.code || error.message; } });
        last = { status: 'SYNTHESIZING_LOCAL_PREVIEW', id, nativeCalls: 0 };
      } else if (input.type === 'arm') last = control.armSimulation(settings.pilots.filter(p => p.mode === 'ADVISORY').map(p => p.id));
      else if (input.type === 'queue') last = { queue: control.queueRecommendations(), results: control.drainSimulation() };
      else if (input.type === 'command') last = { ...parseSpokenCommand({ text: input.text,
        origin: 'human_ptt', final: true, session: snapshot.session, bindings: bindings(),
        selectedTargetId: 'enemy1' }), classification: 'MOCK_ONLY', inputSource: 'TYPED_TRANSCRIPT_FIXTURE',
        dispatchable: false, note: 'Parser preview only. No microphone, human order or game action was produced.' };
      else if (input.type === 'step') {
        const a = snapshot.lancemates.find(actor => actor.id === input.actorId);
        if (!a) throw new Error('INVALID_RECIPIENT'); clock += 100;
        if (input.event === 'hold') a.manual = { observable: true, revision: a.manual.revision + 1,
          orderId: `human_${a.id}_${sequence}`, status: 'active', persistent: true };
        else if (input.event === 'release') { a.manual = { ...a.manual, revision: a.manual.revision + 1, status: 'released' }; }
        else if (input.event === 'possession') {
          speechInput.invalidate('POSSESSION');
          a.aiOwned = false; a.generation += 1;
          conversation.updateBinding(conversationBindings().find(b => b.id === a.id));
          if (reply?.speakerId === a.id) { reply = null; stopAudio('POSSESSION'); }
          radio.observe({ id: `possession_${sequence}`, session: snapshot.session, observedAtMs: clock,
            kind: 'binding', binding: bindings().find(b => b.id === a.id) });
        } else if (input.event === 'pause') { speechInput.invalidate('PAUSED'); snapshot.phase = 'paused'; radio.setGates({ paused: true });
          conversation.setGates({ paused: true }); cancelConversation('PAUSED'); }
        else if (input.event === 'resume') { snapshot.phase = 'active'; radio.setGates({ paused: false }); conversation.setGates({ paused: false }); }
        else if (input.event === 'damage') a.healthFraction = 0.2;
        else throw new Error('INVALID_DEMO_EVENT');
        last = ingest();
      } else if (input.type === 'radio') {
        const b = bindings().find(b => b.id === input.actorId); if (!b) throw new Error('INVALID_RECIPIENT');
        const lineId = `line_${sequence}_${clock}`;
        last = radio.enqueue({ lineId, session: snapshot.session, speakerId: b.id, pawnId: b.pawnId,
          generation: b.generation, priority: 'answer', text: 'Radio check. Ready when you are.',
          createdAtMs: clock, expiresAtMs: clock + 5000, factIds: [] });
        if (last.status === 'QUEUED') last = { ...last, textPreview: radio.next(), audioGenerated: false,
          classification: 'MOCK_ONLY', source: 'AUTHORED_TEST_LINE' };
        clock += 1;
      } else if (input.type === 'radio_complete') {
        last = radio.complete(input.lineId);
        if (last.status === 'COMPLETED') last = { ...last, textPreview: radio.next(),
          audioGenerated: false, classification: 'MOCK_ONLY' };
      }
      else throw new Error('UNSUPPORTED_ACTION');
    }
    return state();
  }
  async function readAudio(id) {
    if (disposed) throw new Error('WORKBENCH_CLOSED');
    if (!audioJob || audioJob.id !== id || audioJob.status !== 'READY' || !audioCurrent()) throw new Error('AUDIO_STALE_OR_UNAVAILABLE');
    if (radio.getState().playing) throw new Error('RADIO_OCCUPIED');
    const job = audioJob, r = reply, result = radio.enqueue({ lineId: audioJob.id, session: r.session, speakerId: r.speakerId,
      pawnId: r.pawnId, generation: r.generation, priority: 'answer', text: r.text,
      createdAtMs: clock, expiresAtMs: clock + 5000, factIds: [] });
    if (result.status !== 'QUEUED' || radio.next()?.lineId !== audioJob.id) throw new Error('RADIO_REJECTED');
    job.status = 'DELIVERING';
    try {
      const bytes = await readAudioFile(job.wavPath);
      if (job !== audioJob || reply?.id !== r.id || !audioCurrent() || radio.getState().playing?.lineId !== job.id)
        throw new Error('AUDIO_STALE_OR_UNAVAILABLE');
      if (bytes.length > 4 * 1024 * 1024 || bytes.toString('ascii',0,4) !== 'RIFF' || bytes.toString('ascii',8,12) !== 'WAVE')
        throw new Error('INVALID_AUDIO_FILE');
      job.status = 'DELIVERED_FOR_USER_PLAYBACK'; return bytes;
    } catch (error) {
      if (radio.getState().playing?.lineId === job.id) radio.interrupt('AUDIO_READ_FAILED');
      if (audioJob === job) { job.status = 'FAILED'; job.error = error.message; }
      throw error;
    }
  }
  async function submitRecognition(id, bytes, options) {
    if (disposed) throw new Error('WORKBENCH_CLOSED');
    await speechInput.submit(id, bytes, options);
    return state();
  }
  function cancelRecognition(id, reason) { speechInput.cancel(id, reason); }
  async function dispose() { disposed = true; conversation.dispose();
    const stopped = await Promise.allSettled([stopResidents('WORKBENCH_CLOSED'), speechInput.dispose()]);
    const recognitionStopped = speechInput.status().shutdownComplete === true;
    modelError = stopped.some(result => result.status === 'rejected') || residentPending() || !recognitionStopped ? 'LOCAL_MODEL_STOP_UNCONFIRMED' : null;
    return { status: modelError || 'LOCAL_MODELS_STOPPED' }; }
  return { state, act, readAudio, submitRecognition, cancelRecognition, dispose };
}

export async function startServer({ port = 0, settingsPath, recognitionEngine = null, realNow = () => Date.now() } = {}) {
  const workbench = await createWorkbench({ settingsPath, recognitionEngine, realNow });
  const token = randomBytes(32).toString('hex'); let origin = null;
  const files = new Map([['/', ['index.html', 'text/html']], ['/app.js', ['app.js', 'text/javascript']],
    ['/microphone.js', ['microphone.js', 'text/javascript']], ['/microphone-worklet.js', ['microphone-worklet.js', 'text/javascript']],
    ['/styles.css', ['styles.css', 'text/css']]]);
  const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
    'Permissions-Policy': 'camera=(), microphone=(self)',
    'Referrer-Policy': 'no-referrer', 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; media-src 'self' blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'" };
  let busy = false, uploading = null;
  const server = http.createServer(async (req, res) => {
    function send(status, body, contentType = 'application/json') {
      if (res.destroyed || res.writableEnded) return;
      res.writeHead(status, { ...headers, 'Content-Type': `${contentType}; charset=utf-8` });
      res.end(contentType === 'application/json' ? JSON.stringify(body) : body);
    }
    try {
      if (!origin || req.headers.host !== new URL(origin).host ||
          (req.headers.origin && req.headers.origin !== origin)) return send(403, { error: 'LOCAL_ORIGIN_REQUIRED' });
      const url = new URL(req.url, origin);
      if (req.method === 'GET' && files.has(url.pathname)) {
        const [file, mime] = files.get(url.pathname); return send(200, await readFile(path.join(directory, 'public', file), 'utf8'), mime);
      }
      const supplied = req.headers.authorization?.replace(/^Bearer /, '') || '';
      if (Buffer.byteLength(supplied) !== Buffer.byteLength(token) || !timingSafeEqual(Buffer.from(supplied), Buffer.from(token)))
        return send(401, { error: 'SESSION_TOKEN_REQUIRED' });
      if (req.method === 'GET' && url.pathname === '/api/state') return send(200, workbench.state());
      if (req.method === 'GET' && /^\/api\/audio\/[a-f0-9-]{36}$/.test(url.pathname)) {
        const bytes = await workbench.readAudio(url.pathname.split('/').at(-1));
        res.writeHead(200, { ...headers, 'Content-Type': 'audio/wav' }); return res.end(bytes);
      }
      if (req.method === 'POST' && /^\/api\/recognition\/[a-f0-9-]{36}$/.test(url.pathname)) {
        if (req.headers['content-type'] !== 'audio/wav') return send(415, { error: 'WAV_REQUIRED' });
        const id = url.pathname.split('/').at(-1), current = workbench.state().speechInput.current;
        if (!current || current.id !== id || current.status !== 'CAPTURING') return send(409, { error: 'CAPTURE_NOT_CURRENT' });
        if (uploading) return send(409, { error: 'RECOGNITION_UPLOAD_BUSY' });
        if (req.headers['content-length'] && (!/^\d+$/.test(req.headers['content-length']) || Number(req.headers['content-length']) > MAX_WAV)) {
          workbench.cancelRecognition(id, 'UPLOAD_LIMIT'); return send(413, { error: 'WAV_LIMIT' });
        }
        const owner = {}; uploading = owner;
        const abort = new AbortController();
        const cancelled = () => { abort.abort(); workbench.cancelRecognition(id, 'UPLOAD_DISCONNECTED'); };
        const responseClosed = () => { if (!res.writableEnded) cancelled(); };
        req.once('aborted', cancelled); res.once('close', responseClosed);
        try {
          const chunks = []; let size = 0;
          for await (const chunk of req) {
            size += chunk.length;
            if (size > MAX_WAV) { workbench.cancelRecognition(id, 'UPLOAD_LIMIT'); return send(413, { error: 'WAV_LIMIT' }); }
            chunks.push(chunk);
          }
          if (abort.signal.aborted) throw new Error('UPLOAD_DISCONNECTED');
          return send(200, await workbench.submitRecognition(id, Buffer.concat(chunks), { signal: abort.signal }));
        } catch (error) {
          workbench.cancelRecognition(id, 'UPLOAD_FAILED'); throw error;
        } finally {
          req.off('aborted', cancelled); res.off('close', responseClosed);
          if (uploading === owner) uploading = null;
        }
      }
      if (req.method !== 'POST' || url.pathname !== '/api/action') return send(404, { error: 'NOT_FOUND' });
      if (req.headers['content-type'] !== 'application/json') return send(415, { error: 'JSON_REQUIRED' });
      if (busy) return send(409, { error: 'ACTION_IN_PROGRESS' });
      busy = true;
      try {
        const chunks = []; let size = 0;
        for await (const chunk of req) { size += chunk.length; if (size > MAX_BODY) return send(413, { error: 'BODY_LIMIT' }); chunks.push(chunk); }
        const input = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        return send(200, await workbench.act(input));
      } finally { busy = false; }
    } catch (error) { send(400, { error: error instanceof SyntaxError ? 'INVALID_JSON' :
      /^[A-Z_]+$/.test(error.message) ? error.message : 'REQUEST_FAILED' }); }
  });
  server.requestTimeout = 5000; server.headersTimeout = 5000;
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  origin = `http://127.0.0.1:${server.address().port}`;
  return { server, origin, token, url: `${origin}/#${token}`, close: async () => {
    const result = await workbench.dispose(); await new Promise(resolve => server.close(resolve)); return result; } };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const running = await startServer();
  console.log('MW5 Companion offline workbench. Native control unavailable; local models require explicit startup.');
  console.log(running.url); console.log('Keep this terminal open. Ctrl+C stops the workbench.');
  if (process.argv.includes('--open')) {
    const { spawn } = await import('node:child_process');
    spawn('powershell.exe', ['-NoProfile', '-Command', `Start-Process '${running.url}'`],
      { windowsHide: true, stdio: 'ignore' }).on('error', () => console.log('Open the displayed URL in your browser.'));
  }
  let closing = false;
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => {
    if (closing) return; closing = true; const result = await running.close();
    if (result.status !== 'LOCAL_MODELS_STOPPED') console.error(result.status);
    process.exit(result.status === 'LOCAL_MODELS_STOPPED' ? 0 : 1);
  });
}
