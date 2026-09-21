// Local offline workbench. This process has no game/editor/native/audio adapter.
import http from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { ControlSession } from './control.mjs';
import { replayFrames } from './observation.mjs';
import { createRadioDirector, parseSpokenCommand } from './radio.mjs';
import { baseline } from '../synthetic/tactical-cases.mjs';

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

export async function createWorkbench({ settingsPath = path.join(directory, 'local', 'settings.json') } = {}) {
  let settings = defaults(), settingsStatus = 'DEFAULTS';
  try { settings = validateSettings(JSON.parse(await readFile(settingsPath, 'utf8'))); settingsStatus = 'LOADED'; }
  catch (error) { if (error.code !== 'ENOENT') settingsStatus = 'INVALID_SETTINGS_IGNORED'; }
  let clock = 1000, sequence = 0, epoch = 0, snapshot = null, last = null;
  let control = new ControlSession(), radio = createRadioDirector({ personas: radioProfiles, now: () => clock });
  const state = () => ({ classification: snapshot ? 'MOCK_ONLY' : 'DISCONNECTED',
    clockMs: clock, settings: clone(settings), settingsStatus, profiles: clone(profiles),
    control: control.getState(), radio: radio.getState(), last: clone(last),
    integration: { game: 'NOT_BUILT', microphone: 'NOT_INSTALLED', synthesis: 'NOT_INSTALLED',
      conversation: 'NOT_INSTALLED', directPiloting: 'NOT_BUILT', observedGameplayTests: 'NOT_PERFORMED' } });
  function bindings() { return snapshot.lancemates.map((a, index) => ({ id: a.id, pawnId: a.pawnId,
    generation: a.generation, alive: a.alive, aiOwned: a.aiOwned, slot: index + 1 })); }
  function ingest() {
    snapshot.sequence = ++sequence; snapshot.observedAtMs = clock; snapshot.nowMs = clock;
    snapshot.targets.forEach(t => { t.observedAtMs = clock; });
    return control.ingest({ schemaVersion: 1, kind: 'observation', adapterId: 'offline_workbench',
      provenance: 'MOCK_ONLY', session: snapshot.session, sequence, observedAtMs: clock, snapshot: clone(snapshot) });
  }
  function newDemo() {
    clock = 1000; sequence = 0; snapshot = baseline(); snapshot.session = `demo_${++epoch}`;
    snapshot.lancemates = ids.map((id, index) => ({ ...clone(snapshot.lancemates[0]), id,
      pawnId: `pawn${index + 1}`, controllerId: `controller${index + 1}`,
      weaponRangeM: [{ min: 0, max: 180 }, { min: 100, max: 700 }, { min: 0, max: 400 }][index] }));
    snapshot.lancemates[0].distanceToLeaderM = 700;
    control = new ControlSession({ mode: 'MOCK_ONLY', now: () => clock });
    radio = createRadioDirector({ personas: radioProfiles, now: () => clock }); radio.startMission(snapshot.session, bindings());
    radio.setGates(radioGates(settings)); return ingest();
  }
  async function act(input) {
    if (!input || typeof input.type !== 'string') throw new Error('INVALID_ACTION');
    if (input.type === 'demo') last = newDemo();
    else if (input.type === 'settings') {
      const next = validateSettings(input.settings);
      await mkdir(path.dirname(settingsPath), { recursive: true });
      await writeFile(`${settingsPath}.tmp`, JSON.stringify(next, null, 2) + '\n', { mode: 0o600 });
      await rename(`${settingsPath}.tmp`, settingsPath);
      settings = next; settingsStatus = 'SAVED'; radio.setGates(radioGates(settings));
      // Preferences never grant control. Changing modes requires explicit rearming of the mock.
      control.disarm('SETTINGS_CHANGED'); last = { status: 'SETTINGS_SAVED', nativeCalls: 0 };
    } else if (input.type === 'replay') {
      if (!Array.isArray(input.frames) || input.frames.length > 128) throw new Error('REPLAY_FRAME_LIMIT');
      last = replayFrames(input.frames, { allowSynthetic: input.allowSynthetic === true });
    } else if (input.type === 'disarm') last = control.disarm();
    else {
      if (!snapshot) throw new Error('START_SYNTHETIC_DEMO_FIRST');
      if (input.type === 'arm') last = control.armSimulation(settings.pilots.filter(p => p.mode === 'ADVISORY').map(p => p.id));
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
          radio.observe({ id: `possession_${sequence}`, session: snapshot.session, observedAtMs: clock,
            kind: 'binding', binding: bindings().find(b => b.id === a.id) });
        } else if (input.event === 'pause') { snapshot.phase = 'paused'; radio.setGates({ paused: true }); }
        else if (input.event === 'resume') { snapshot.phase = 'active'; radio.setGates({ paused: false }); }
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
  return { state, act };
}

export async function startServer({ port = 0, settingsPath } = {}) {
  const workbench = await createWorkbench({ settingsPath });
  const token = randomBytes(32).toString('hex'); let origin = null;
  const files = new Map([['/', ['index.html', 'text/html']], ['/app.js', ['app.js', 'text/javascript']],
    ['/styles.css', ['styles.css', 'text/css']]]);
  const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer', 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'" };
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
  return { server, origin, token, url: `${origin}/#${token}`, close: () => new Promise(resolve => server.close(resolve)) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const running = await startServer();
  console.log('MW5 Companion offline workbench. Native control and speech engines are unavailable.');
  console.log(running.url); console.log('Keep this terminal open. Ctrl+C stops the workbench.');
  if (process.argv.includes('--open')) {
    const { spawn } = await import('node:child_process');
    spawn('powershell.exe', ['-NoProfile', '-Command', `Start-Process '${running.url}'`],
      { windowsHide: true, stdio: 'ignore' }).on('error', () => console.log('Open the displayed URL in your browser.'));
  }
}
