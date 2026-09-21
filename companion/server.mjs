// Local offline workbench. This process has no game/editor/native/audio adapter.
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

const directory = path.dirname(fileURLToPath(import.meta.url));
const profiles = JSON.parse(await readFile(path.join(directory, 'personas.json'), 'utf8'));
const MAX_BODY = 256 * 1024;
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
  languageModel = null, speechEngine = null, realNow = () => Date.now(), readAudioFile = readFile } = {}) {
  let settings = defaults(), settingsStatus = 'DEFAULTS';
  try { settings = validateSettings(JSON.parse(await readFile(settingsPath, 'utf8'))); settingsStatus = 'LOADED'; }
  catch (error) { if (error.code !== 'ENOENT') settingsStatus = 'INVALID_SETTINGS_IGNORED'; }
  let clock = 1000, sequence = 0, epoch = 0, snapshot = null, last = null;
  let control = new ControlSession(), radio = createRadioDirector({ personas: radioProfiles, now: () => clock });
  const language = languageModel ?? createLocalLanguageModel();
  const speech = speechEngine ?? createLocalSpeech();
  let previewDeadlineMs = 4000;
  const newConversation = () => createConversationCoordinator({ generate: (context, options) => language.generate(context, options), now: realNow, timeoutMs: previewDeadlineMs });
  let conversation = newConversation();
  let modelError = null, modelStart = null, modelEpoch = 0, reply = null, audioJob = null, disposed = false;
  const stopAudio = reason => {
    if (audioJob) audioJob.abort.abort(reason);
    audioJob = null; radio.interrupt(reason);
  };
  function cancelConversation(reason) { conversation.cancelAll(reason); reply = null; stopAudio(reason); }
  function audioCurrent() {
    const actor = snapshot?.lancemates.find(a => a.id === reply?.speakerId);
    return reply?.status === 'GENERATED' && reply.session === snapshot?.session && actor?.aiOwned === true &&
      actor.alive === true && actor.pawnId === reply.pawnId && actor.generation === reply.generation &&
      reply.expiresAtMs > realNow() && snapshot.phase === 'active' && !settings.speechMuted;
  }
  const state = () => ({ classification: snapshot ? 'MOCK_ONLY' : 'DISCONNECTED',
    clockMs: clock, settings: clone(settings), settingsStatus, profiles: clone(profiles),
    control: control.getState(), radio: radio.getState(), last: clone(last),
    localModels: { language: language.status(), speech: speech.getState(), error: modelError,
      starting: !!modelStart, previewDeadlineMs, firstSpokenTargetMs: 4000, timingAcceptance: 'NOT_ESTABLISHED',
      reply: clone(reply), audio: audioJob ? { id: audioJob.id, status: audioJob.status,
        voiceId: audioJob.voiceId, error: audioJob.error, classification: 'LOCAL_AUDIO_PREVIEW_NOT_GAMEPLAY' } : null },
    integration: { game: 'NOT_BUILT', microphone: 'NOT_CONNECTED', synthesis: speech.getState().state,
      conversation: language.status().state, directPiloting: 'NOT_BUILT', observedGameplayTests: 'NOT_PERFORMED' } });
  function bindings() { return snapshot.lancemates.map((a, index) => ({ id: a.id, pawnId: a.pawnId,
    generation: a.generation, alive: a.alive, aiOwned: a.aiOwned, slot: index + 1 })); }
  function ingest() {
    snapshot.sequence = ++sequence; snapshot.observedAtMs = clock; snapshot.nowMs = clock;
    snapshot.targets.forEach(t => { t.observedAtMs = clock; });
    return control.ingest({ schemaVersion: 1, kind: 'observation', adapterId: 'offline_workbench',
      provenance: 'MOCK_ONLY', session: snapshot.session, sequence, observedAtMs: clock, snapshot: clone(snapshot) });
  }
  function newDemo() {
    cancelConversation('MISSION_CHANGED');
    clock = 1000; sequence = 0; snapshot = baseline(); snapshot.session = `demo_${++epoch}`;
    snapshot.lancemates = ids.map((id, index) => ({ ...clone(snapshot.lancemates[0]), id,
      pawnId: `pawn${index + 1}`, controllerId: `controller${index + 1}`,
      weaponRangeM: [{ min: 0, max: 180 }, { min: 100, max: 700 }, { min: 0, max: 400 }][index] }));
    snapshot.lancemates[0].distanceToLeaderM = 700;
    control = new ControlSession({ mode: 'MOCK_ONLY', now: () => clock });
    radio = createRadioDirector({ personas: radioProfiles, now: () => clock }); radio.startMission(snapshot.session, bindings());
    conversation.startMission(snapshot.session, bindings().map((b, i) => ({ ...b, profileId: profiles.profiles[i].id })));
    conversation.setGates({ paused: false, speechMuted: settings.speechMuted, quiet: settings.quiet });
    radio.setGates(radioGates(settings)); return ingest();
  }
  async function act(input) {
    if (disposed) throw new Error('WORKBENCH_CLOSED');
    if (!input || typeof input.type !== 'string') throw new Error('INVALID_ACTION');
    if (input.type === 'preview_timing') {
      if (typeof input.allowSlow !== 'boolean') throw new Error('INVALID_PREVIEW_TIMING');
      cancelConversation('PREVIEW_TIMING_CHANGED'); conversation.dispose();
      previewDeadlineMs = input.allowSlow ? 10000 : 4000; conversation = newConversation();
      if (snapshot) conversation.startMission(snapshot.session, bindings().map((b,i) => ({ ...b, profileId: profiles.profiles[i].id })));
      conversation.setGates({ paused: snapshot?.phase === 'paused', speechMuted: settings.speechMuted, quiet: settings.quiet });
      last = { status: input.allowSlow ? 'SLOW_OFFLINE_AUDITION' : 'STRICT_OFFLINE_PREVIEW',
        firstSpokenTargetMs: 4000, timingAcceptance: 'NOT_ESTABLISHED', nativeCalls: 0 };
    } else if (input.type === 'models_start') {
      if (!modelStart) {
        modelError = null;
        const epoch = ++modelEpoch;
        modelStart = (async () => {
          try {
            await language.start();
            if (epoch !== modelEpoch) return;
            if (speech.getState().restartRequired) await speech.restart(); else await speech.start();
          } catch (error) { modelError = error.code || error.message; }
          finally { modelStart = null; }
        })();
      }
      last = { status: 'STARTING_LOCAL_MODELS', gameConnected: false };
    } else if (input.type === 'models_stop') {
      ++modelEpoch;
      cancelConversation('MODELS_STOPPED');
      const stopped = await Promise.allSettled([Promise.resolve().then(() => language.stop()),
        Promise.resolve().then(() => speech.stop('USER_STOP'))]);
      const failed = stopped.filter(result => result.status === 'rejected');
      modelError = failed.length ? 'LOCAL_MODEL_STOP_UNCONFIRMED' : null;
      last = { status: failed.length ? 'LOCAL_MODEL_STOP_UNCONFIRMED' : 'LOCAL_MODELS_STOPPED', nativeCalls: 0 };
    } else if (input.type === 'interrupt') {
      cancelConversation('USER_INTERRUPTED'); last = { status: 'SPEECH_INTERRUPTED', nativeCalls: 0 };
    } else if (input.type === 'demo') last = newDemo();
    else if (input.type === 'settings') {
      const next = validateSettings(input.settings);
      await mkdir(path.dirname(settingsPath), { recursive: true });
      await writeFile(`${settingsPath}.tmp`, JSON.stringify(next, null, 2) + '\n', { mode: 0o600 });
      await rename(`${settingsPath}.tmp`, settingsPath);
      settings = next; settingsStatus = 'SAVED'; radio.setGates(radioGates(settings));
      conversation.setGates({ speechMuted: settings.speechMuted, quiet: settings.quiet });
      if (settings.speechMuted) cancelConversation('SPEECH_MUTED');
      // Preferences never grant control. Changing modes requires explicit rearming of the mock.
      control.disarm('SETTINGS_CHANGED'); last = { status: 'SETTINGS_SAVED', nativeCalls: 0 };
    } else if (input.type === 'replay') {
      if (!Array.isArray(input.frames) || input.frames.length > 128) throw new Error('REPLAY_FRAME_LIMIT');
      last = replayFrames(input.frames, { allowSynthetic: input.allowSynthetic === true });
    } else if (input.type === 'disarm') last = control.disarm();
    else {
      if (!snapshot) throw new Error('START_SYNTHETIC_DEMO_FIRST');
      if (input.type === 'converse') {
        if (language.status().state !== 'READY') throw new Error('LOCAL_LANGUAGE_MODEL_NOT_READY');
        const b = bindings().find(b => b.id === input.actorId); if (!b) throw new Error('INVALID_RECIPIENT');
        if (reply?.status === 'GENERATING') throw new Error('CONVERSATION_BUSY');
        stopAudio('NEW_REQUEST');
        const id = randomUUID(), request = { id, session: snapshot.session, speakerId: b.id, pawnId: b.pawnId,
          generation: b.generation, priority: 'answer', text: input.text, facts: [], expiresAtMs: realNow() + 10000 };
        reply = { ...request, status: 'GENERATING', classification: 'OFFLINE_CONVERSATION_PREVIEW' };
        conversation.request(request).then(result => { if (reply?.id === id) reply = result; })
          .catch(() => { if (reply?.id === id) reply = { id, status: 'FAILED', reason: 'CONVERSATION_FAILED' }; });
        last = { status: 'GENERATING', id, factSource: 'NO_LIVE_MISSION_FACTS', nativeCalls: 0 };
      } else if (input.type === 'synthesize_reply') {
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
          a.aiOwned = false; a.generation += 1;
          conversation.updateBinding({ ...bindings().find(b => b.id === a.id), profileId: profiles.profiles[ids.indexOf(a.id)].id });
          if (reply?.speakerId === a.id) { reply = null; stopAudio('POSSESSION'); }
          radio.observe({ id: `possession_${sequence}`, session: snapshot.session, observedAtMs: clock,
            kind: 'binding', binding: bindings().find(b => b.id === a.id) });
        } else if (input.event === 'pause') { snapshot.phase = 'paused'; radio.setGates({ paused: true });
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
  async function dispose() { disposed = true; ++modelEpoch; cancelConversation('WORKBENCH_CLOSED'); conversation.dispose();
    const stopped = await Promise.allSettled([Promise.resolve().then(() => language.stop()),
      Promise.resolve().then(() => speech.stop('WORKBENCH_CLOSED'))]);
    modelError = stopped.some(result => result.status === 'rejected') ? 'LOCAL_MODEL_STOP_UNCONFIRMED' : null;
    return { status: modelError || 'LOCAL_MODELS_STOPPED' }; }
  return { state, act, readAudio, dispose };
}

export async function startServer({ port = 0, settingsPath } = {}) {
  const workbench = await createWorkbench({ settingsPath });
  const token = randomBytes(32).toString('hex'); let origin = null;
  const files = new Map([['/', ['index.html', 'text/html']], ['/app.js', ['app.js', 'text/javascript']],
    ['/styles.css', ['styles.css', 'text/css']]]);
  const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer', 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; media-src 'self' blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'" };
  let busy = false;
  const server = http.createServer(async (req, res) => {
    function send(status, body, contentType = 'application/json') {
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
      if (supplied.length !== token.length || !timingSafeEqual(Buffer.from(supplied), Buffer.from(token)))
        return send(401, { error: 'SESSION_TOKEN_REQUIRED' });
      if (req.method === 'GET' && url.pathname === '/api/state') return send(200, workbench.state());
      if (req.method === 'GET' && /^\/api\/audio\/[a-f0-9-]{36}$/.test(url.pathname)) {
        const bytes = await workbench.readAudio(url.pathname.split('/').at(-1));
        res.writeHead(200, { ...headers, 'Content-Type': 'audio/wav' }); return res.end(bytes);
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
