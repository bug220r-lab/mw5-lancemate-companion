// Independent loopback/workbench integration tests. No game, audio or native calls.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { createWorkbench, startServer } from '../server.mjs';
import { baseline } from '../../synthetic/tactical-cases.mjs';

async function fixture(t, { server = false } = {}) {
  const prefix = path.join(os.tmpdir(), 'mw5-server-review-');
  const directory = await mkdtemp(prefix);
  const settingsPath = path.join(directory, 'settings.json');
  let running;
  t.after(async () => {
    if (running) { const closed = running.close(); running.server.closeAllConnections(); await closed; }
    const target = path.resolve(directory), parent = path.resolve(os.tmpdir());
    assert.equal(path.dirname(target), parent);
    assert.ok(path.basename(target).startsWith('mw5-server-review-'));
    await rm(target, { recursive: true, force: true });
  });
  if (server) running = await startServer({ port: 0, settingsPath });
  return { directory, settingsPath, running, workbench: await createWorkbench({ settingsPath }) };
}

function request(running, { route = '/api/state', method = 'GET', token = running.token,
  origin = running.origin, host, body, contentType = 'application/json' } = {}) {
  return new Promise((resolve, reject) => {
    const headers = { ...(token === null ? {} : { Authorization: `Bearer ${token}` }),
      ...(origin === null ? {} : { Origin: origin }), ...(host === undefined ? {} : { Host: host }) };
    if (body !== undefined) { headers['Content-Type'] = contentType; headers['Content-Length'] = Buffer.byteLength(body); }
    const req = http.request(new URL(route, running.origin), { method, headers, agent: false }, res => {
      const chunks = []; res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => { const text = Buffer.concat(chunks).toString('utf8');
        resolve({ status: res.statusCode, headers: res.headers, text,
          data: res.headers['content-type']?.startsWith('application/json') ? JSON.parse(text) : null }); });
    });
    req.on('error', reject); req.end(body);
  });
}
const action = (r, value, options = {}) => request(r, { route: '/api/action', method: 'POST', body: JSON.stringify(value), ...options });
const byId = (s, id) => s.control.recommendations.find(r => r.actorId === id);
function frame(provenance = 'MOCK_ONLY') {
  const snapshot = baseline();
  return { schemaVersion: 1, kind: 'observation', adapterId: 'server_review_fixture', provenance,
    session: snapshot.session, sequence: snapshot.sequence, observedAtMs: snapshot.observedAtMs, snapshot };
}

test('public routes load with restrictive headers and no session token in their content', async t => {
  const { running } = await fixture(t, { server: true });
  assert.equal(running.server.address().address, '127.0.0.1');
  for (const [route, mime] of [['/', 'text/html'], ['/app.js', 'text/javascript'], ['/styles.css', 'text/css']]) {
    const response = await request(running, { route, token: null, origin: null });
    assert.equal(response.status, 200); assert.ok(response.headers['content-type'].startsWith(mime));
    assert.equal(response.headers['cache-control'], 'no-store');
    assert.equal(response.headers['x-content-type-options'], 'nosniff');
    assert.match(response.headers['content-security-policy'], /frame-ancestors 'none'/);
    assert.equal(response.text.includes(running.token), false);
  }
  const page = (await request(running, { route: '/' })).text;
  assert.match(page, /No game commands/); assert.match(page, /preview never executes/);
  const js = (await request(running, { route: '/app.js' })).text;
  assert.match(js, /textContent/); assert.doesNotMatch(js, /\.innerHTML\s*=/);
  assert.match(js, /TACTICAL.*unavailable/); assert.match(js, /DIRECT.*unavailable/);
  assert.equal((await request(running, { route: '/personas.json' })).status, 404);
  assert.equal((await request(running, { route: '/local/settings.json' })).status, 404);
});

test('API rejects missing/wrong tokens and unrelated Origin or Host even with valid token', async t => {
  const { running } = await fixture(t, { server: true });
  for (const token of [null, 'wrong', 'a'.repeat(64)]) {
    const r = await action(running, { type: 'demo' }, { token });
    assert.equal(r.status, 401); assert.equal(r.data.error, 'SESSION_TOKEN_REQUIRED');
  }
  for (const options of [{ origin: 'https://other.invalid' }, { origin: 'null' }, { host: 'evil.invalid' }, { host: 'localhost' }]) {
    const r = await action(running, { type: 'demo' }, options);
    assert.equal(r.status, 403); assert.equal(r.data.error, 'LOCAL_ORIGIN_REQUIRED');
  }
  const state = await request(running); assert.equal(state.status, 200);
  assert.equal(state.data.classification, 'DISCONNECTED');
  assert.equal((await request(running, { origin: null })).status, 200);
});

test('JSON/body bounds reject malformed and oversized requests without poisoning later requests', async t => {
  const { running } = await fixture(t, { server: true });
  const malformed = await request(running, { method: 'POST', route: '/api/action', body: '{' });
  assert.equal(malformed.status, 400); assert.equal(malformed.data.error, 'INVALID_JSON');
  const wrongType = await action(running, { type: 'demo' }, { contentType: 'text/plain' });
  assert.equal(wrongType.status, 415);
  const oversized = await request(running, { method: 'POST', route: '/api/action', body: ' '.repeat(256 * 1024 + 1) });
  assert.equal(oversized.status, 413); assert.equal(oversized.data.error, 'BODY_LIMIT');
  const later = await action(running, { type: 'demo' }); assert.equal(later.status, 200);
  assert.equal(later.data.classification, 'MOCK_ONLY');
});

test('replay frame limit and explicit synthetic permission are enforced without dispatch', async t => {
  const { running } = await fixture(t, { server: true });
  for (const frames of [{}, Array(129).fill(null)]) {
    const r = await action(running, { type: 'replay', frames });
    assert.equal(r.status, 400); assert.equal(r.data.error, 'REPLAY_FRAME_LIMIT');
  }
  let r = await action(running, { type: 'replay', frames: Array(128).fill(null) });
  assert.equal(r.status, 200); assert.equal(r.data.last.results.length, 128);
  r = await action(running, { type: 'replay', frames: [frame()] });
  assert.equal(r.data.last.results[0].accepted, false);
  r = await action(running, { type: 'replay', frames: [frame()], allowSynthetic: true });
  assert.equal(r.data.last.results[0].accepted, true); assert.equal(r.data.last.classification, 'MOCK_ONLY');
  assert.equal(r.data.classification, 'DISCONNECTED'); assert.equal(r.data.control.armed, false);
  assert.equal(r.data.control.ledger.length, 0); assert.equal(r.data.control.nativeCalls, 0);
  r = await action(running, { type: 'replay', frames: [frame('GAME_OBSERVED')] });
  assert.equal(r.data.last.classification, 'REAL_OBSERVATION_REPLAY_UNVALIDATED');
  assert.equal(r.data.control.armed, false); assert.equal(r.data.control.ledger.length, 0);
});

test('settings persist validated preferences only and reopening resets all mission state', async t => {
  const { directory, settingsPath, workbench } = await fixture(t);
  await workbench.act({ type: 'demo' }); await workbench.act({ type: 'arm' });
  await workbench.act({ type: 'queue' }); await workbench.act({ type: 'step', actorId: 'alpha', event: 'hold' });
  const settings = workbench.state().settings;
  settings.pilots[0].callsign = '  Razor  '; settings.pilots[1].mode = 'NATIVE';
  settings.pilots[0].missionFacts = ['MUST_NOT_PERSIST'];
  settings.policyState = { secretMissionFact: 'MUST_NOT_PERSIST' }; settings.armed = true;
  settings.micMuted = true; settings.quiet = true;
  const saved = await workbench.act({ type: 'settings', settings });
  assert.equal(saved.control.armed, false); assert.equal(saved.settings.pilots[0].callsign, 'Razor');
  const text = await readFile(settingsPath, 'utf8'), persisted = JSON.parse(text);
  assert.deepEqual(persisted, saved.settings); assert.equal(text.includes('MUST_NOT_PERSIST'), false);
  assert.deepEqual(await readdir(directory), ['settings.json']);
  const reopened = (await createWorkbench({ settingsPath })).state();
  assert.equal(reopened.settingsStatus, 'LOADED'); assert.equal(reopened.classification, 'DISCONNECTED');
  assert.equal(reopened.control.armed, false); assert.equal(reopened.control.ledger.length, 0);
  assert.equal(reopened.radio.session, null); assert.equal(reopened.radio.playing, null); assert.equal(reopened.last, null);
});

test('invalid settings never replace the last valid file and unsupported control modes cannot persist', async t => {
  const { settingsPath, workbench } = await fixture(t);
  const settings = workbench.state().settings; await workbench.act({ type: 'settings', settings });
  const before = await readFile(settingsPath, 'utf8');
  for (const mutate of [s => s.pilots[0].mode = 'DIRECT', s => s.micMuted = 'yes',
    s => s.pilots[0].callsign = 'bad\u0000name', s => s.pilots.reverse(), s => s.pilots[1].voice = 'x'.repeat(65)]) {
    const invalid = structuredClone(settings); mutate(invalid);
    await assert.rejects(workbench.act({ type: 'settings', settings: invalid }), /INVALID_/);
    assert.equal(await readFile(settingsPath, 'utf8'), before);
  }
  await writeFile(settingsPath, '{broken');
  const reopened = (await createWorkbench({ settingsPath })).state();
  assert.equal(reopened.settingsStatus, 'INVALID_SETTINGS_IGNORED');
  assert.equal(reopened.classification, 'DISCONNECTED'); assert.equal(reopened.control.armed, false);
});

test('simulation requires explicit arming and respects disabled pilots and reset/disarm', async t => {
  const { workbench } = await fixture(t);
  await assert.rejects(workbench.act({ type: 'arm' }), /START_SYNTHETIC_DEMO_FIRST/);
  let state = await workbench.act({ type: 'demo' }); assert.equal(state.control.armed, false);
  state = await workbench.act({ type: 'queue' }); assert.equal(state.control.ledger.length, 0);
  const settings = state.settings; settings.pilots[1].mode = 'NATIVE';
  await workbench.act({ type: 'settings', settings }); await workbench.act({ type: 'arm' });
  state = await workbench.act({ type: 'queue' }); assert.ok(state.control.ledger.length > 0);
  assert.ok(state.control.ledger.every(entry => entry.actorId !== 'bravo'));
  assert.ok(state.control.ledger.every(entry => entry.stages.length === 1 && entry.stages[0].stage === 'SUBMITTED'));
  assert.equal(state.control.nativeCalls, 0);
  const count = state.control.ledger.length; await workbench.act({ type: 'disarm' });
  state = await workbench.act({ type: 'queue' }); assert.equal(state.control.ledger.length, count);
  state = await workbench.act({ type: 'demo' }); assert.equal(state.control.armed, false); assert.equal(state.control.ledger.length, 0);
});

test('typed parser previews never release holds, disarm, queue or dispatch any action', async t => {
  const { workbench } = await fixture(t);
  await workbench.act({ type: 'demo' }); await workbench.act({ type: 'step', actorId: 'alpha', event: 'hold' });
  await workbench.act({ type: 'arm' }); const before = workbench.state().control;
  for (const text of ['release slot 1', 'disarm', 'regroup slot 2', 'focus actor charlie', 'fly away']) {
    const state = await workbench.act({ type: 'command', text });
    assert.equal(state.last.dispatchable, false); assert.equal(state.last.classification, 'MOCK_ONLY');
    assert.equal(state.last.inputSource, 'TYPED_TRANSCRIPT_FIXTURE');
    assert.deepEqual(state.control, before);
  }
});

test('human hold, pause, and possession have immediate control and radio effects', async t => {
  const { workbench } = await fixture(t); await workbench.act({ type: 'demo' });
  await workbench.act({ type: 'arm' });
  let state = await workbench.act({ type: 'step', event: 'hold', actorId: 'alpha' });
  assert.equal(byId(state, 'alpha').action, 'MAINTAIN');
  state = await workbench.act({ type: 'queue' }); assert.ok(state.control.ledger.every(x => x.actorId !== 'alpha'));
  state = await workbench.act({ type: 'radio', actorId: 'bravo' }); assert.equal(state.radio.playing.speakerId, 'bravo');
  state = await workbench.act({ type: 'step', event: 'pause', actorId: 'alpha' });
  assert.equal(state.control.armed, false); assert.equal(state.radio.playing, null);
  state = await workbench.act({ type: 'radio', actorId: 'bravo' }); assert.equal(state.last.reason, 'PAUSED');
  await workbench.act({ type: 'step', event: 'resume', actorId: 'alpha' });
  await workbench.act({ type: 'radio', actorId: 'bravo' });
  state = await workbench.act({ type: 'step', event: 'possession', actorId: 'bravo' });
  assert.equal(state.radio.playing, null); assert.equal(state.control.armed, false);
  state = await workbench.act({ type: 'radio', actorId: 'bravo' }); assert.equal(state.last.reason, 'BINDING_INVALID');
});

test('saved radio mute gates apply to playing lines and remain active after mission reset', async t => {
  const { workbench } = await fixture(t); await workbench.act({ type: 'demo' });
  let state = await workbench.act({ type: 'radio', actorId: 'alpha' }); assert.ok(state.radio.playing);
  const settings = state.settings; settings.speechMuted = true; settings.micMuted = true; settings.quiet = true;
  state = await workbench.act({ type: 'settings', settings });
  assert.equal(state.radio.gates.speechMuted, true); assert.equal(state.radio.playing, null);
  state = await workbench.act({ type: 'radio', actorId: 'alpha' }); assert.equal(state.last.reason, 'SPEECH_MUTED');
  state = await workbench.act({ type: 'demo' }); assert.equal(state.radio.gates.speechMuted, true);
  assert.equal(state.radio.gates.quiet, true); assert.equal(state.radio.gates.micMuted, true);
  settings.speechMuted = false; state = await workbench.act({ type: 'settings', settings });
  state = await workbench.act({ type: 'radio', actorId: 'alpha' });
  assert.ok(state.radio.playing); assert.equal(state.last.audioGenerated, false);
  assert.equal(state.last.source, 'AUTHORED_TEST_LINE'); assert.equal(state.control.armed, false);
});

test('finishing a text preview advances an already queued speaker without adding a new line', async t => {
  const { workbench } = await fixture(t); await workbench.act({ type: 'demo' });
  let state = await workbench.act({ type: 'radio', actorId: 'alpha' }); const alphaLine = state.radio.playing.lineId;
  state = await workbench.act({ type: 'radio', actorId: 'bravo' });
  assert.equal(state.radio.playing.speakerId, 'alpha'); assert.equal(state.radio.queue.length, 1);
  const bravoLine = state.radio.queue[0].lineId;
  state = await workbench.act({ type: 'radio_complete', lineId: alphaLine });
  assert.equal(state.radio.playing?.lineId, bravoLine); assert.equal(state.radio.playing?.speakerId, 'bravo');
  assert.equal(state.radio.queue.length, 0); assert.equal(state.control.nativeCalls, 0);
  state = await workbench.act({ type: 'radio_complete', lineId: bravoLine }); assert.equal(state.radio.playing, null);
});
