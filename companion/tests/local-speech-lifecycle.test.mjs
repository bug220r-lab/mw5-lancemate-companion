// Synthetic lifetime/cleanup checks only. No worker, listener, model or audio runs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough, Writable } from 'node:stream';
import fs from 'node:fs/promises';
import path from 'node:path';
import { setImmediate as immediate } from 'node:timers/promises';
import { createLocalSpeech, LOCAL_SPEECH_VOICES, SPEECH_OUTPUT_DIRECTORY } from '../local-speech.mjs';
import { createWorkbench } from '../server.mjs';

const request = { text: 'Synthetic lifecycle fixture.', voiceId: 'af_bella' };
async function drain() { await immediate(); await immediate(); }
function harness(t, { kill = () => true, unlink = async () => {}, verifyOutput = async () => {} } = {}) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const children = [], removed = [];
  t.mock.method(fs, 'unlink', async file => {
    assert.equal(path.dirname(file), SPEECH_OUTPUT_DIRECTORY);
    assert.match(path.basename(file), /^[a-f0-9-]{36}\.(?:part|wav)$/);
    removed.push(file); return unlink(file);
  });
  const speech = createLocalSpeech({ verifyOutput, spawnProcess() {
    const child = new EventEmitter(); child.stdout = new PassThrough(); child.stderr = new PassThrough();
    child.requests = []; child.kills = 0;
    child.stdin = new Writable({ write(chunk, encoding, done) { child.requests.push(JSON.parse(chunk)); done(); } });
    child.kill = () => { child.kills++; return kill(child); };
    child.send = msg => child.stdout.write(JSON.stringify(msg) + '\n');
    child.close = () => child.emit('close', 0);
    children.push(child); return child;
  } });
  function ready(child = children.at(-1)) {
    child.send({ type: 'ready', protocol: 1, device: 'cpu', voices: [...LOCAL_SPEECH_VOICES],
      microphoneCapture: false, speakerPlayback: false });
  }
  async function start() { const boot = speech.start(); ready(); await boot; return children.at(-1); }
  t.after(() => { for (const child of children) { child.close(); child.stdout.destroy(); child.stderr.destroy(); child.stdin.destroy(); } });
  return { speech, children, removed, ready, start };
}
async function deadline(t, work) {
  const result = work.then(value => ({ value }), error => ({ error }));
  await drain(); t.mock.timers.tick(3000); await drain(); return result;
}

test('late close after stop timeout permits explicit stop and exactly one replacement', async t => {
  const h = harness(t), old = await h.start();
  assert.equal((await deadline(t, h.speech.stop())).error?.code, 'WORKER_STOP_TIMEOUT');
  assert.equal(h.speech.getState().state, 'STOP_FAILED');
  await assert.rejects(h.speech.start(), /EXPLICIT_RESTART_REQUIRED/);
  assert.equal(old.kills, 1); assert.equal(old.listenerCount('close'), 1);
  old.close(); assert.equal(h.speech.getState().state, 'STOP_FAILED');
  const recovered = await deadline(t, h.speech.stop());
  assert.equal(recovered.error, undefined); assert.equal(recovered.value.status, 'STOPPED');
  assert.equal(old.kills, 1); assert.equal(h.children.length, 1);
  const restarting = h.speech.restart(); await drain(); h.ready(); await restarting;
  assert.equal(h.children.length, 2); assert.equal(h.speech.getState().state, 'READY');
  old.close(); old.send({ type: 'fatal' }); old.emit('error', Error('late old error'));
  assert.equal(h.speech.getState().state, 'READY'); assert.equal(h.children[1].kills, 0);
  h.children[1].close(); await drain();
});

for (const behavior of ['false', 'throw']) test(`kill ${behavior} never proves closure or allows replacement`, async t => {
  const h = harness(t, { kill() { if (behavior === 'throw') throw Error('synthetic kill error'); return false; } });
  const child = await h.start();
  assert.equal((await deadline(t, h.speech.stop())).error?.code, 'WORKER_STOP_TIMEOUT');
  assert.equal((await deadline(t, h.speech.restart())).error?.code, 'WORKER_STOP_TIMEOUT');
  assert.equal(h.children.length, 1); assert.equal(child.kills, 1);
  assert.equal(child.listenerCount('close'), 1);
  child.close(); assert.equal((await deadline(t, h.speech.stop())).error, undefined);
});

test('synchronous close clears the deadline and concurrent stops share ownership', async t => {
  const h = harness(t, { kill(child) { child.close(); return true; } }); await h.start();
  const first = h.speech.stop(), second = h.speech.stop(); assert.equal(first, second);
  await Promise.all([first, second]); assert.equal(h.children[0].kills, 1);
  t.mock.timers.tick(10000); await drain(); assert.equal(h.speech.getState().state, 'STOPPED');
  await h.speech.stop(); assert.equal(h.children[0].kills, 1);
});

test('forty stop timeouts retain one close listener, no active deadline and one kill attempt', async t => {
  const h = harness(t), child = await h.start(), active = new Set();
  const schedule = globalThis.setTimeout, clear = globalThis.clearTimeout;
  t.mock.method(globalThis, 'setTimeout', (callback, delay, ...args) => {
    const timer = schedule(() => { active.delete(timer); callback(...args); }, delay);
    active.add(timer); return timer;
  });
  t.mock.method(globalThis, 'clearTimeout', timer => { active.delete(timer); return clear(timer); });
  for (let attempt = 0; attempt < 40; attempt++) {
    assert.equal((await deadline(t, h.speech.stop())).error?.code, 'WORKER_STOP_TIMEOUT');
    assert.equal(active.size, 0); assert.equal(child.listenerCount('close'), 1); assert.equal(child.kills, 1);
  }
  child.close(); await h.speech.stop();
  assert.equal(h.speech.getState().state, 'STOPPED'); assert.equal(active.size, 0);
});

test('interrupted output ownership survives timeout and cleans only after late closure', async t => {
  const h = harness(t), child = await h.start();
  const pending = h.speech.synthesize(request), rejected = assert.rejects(pending, /STOPPED/);
  const id = child.requests[0].id;
  assert.equal((await deadline(t, h.speech.stop())).error?.code, 'WORKER_STOP_TIMEOUT'); await rejected;
  assert.deepEqual(h.removed, []);
  child.close(); await drain(); assert.deepEqual(h.removed, []);
  assert.equal((await deadline(t, h.speech.stop())).error, undefined);
  assert.deepEqual(h.removed.map(file => path.basename(file)), [id + '.part', id + '.wav']);
  await h.speech.stop(); assert.equal(h.removed.length, 2);
});

test('abort during output verification retains late-close cleanup and isolates old verifier completion', async t => {
  let finishVerification;
  const verification = new Promise(resolve => { finishVerification = resolve; });
  const h = harness(t, { verifyOutput: () => verification }), child = await h.start();
  const controller = new AbortController(), pending = h.speech.synthesize(request, { signal: controller.signal });
  const rejected = assert.rejects(pending, /ABORTED/), id = child.requests[0].id;
  child.send({ type: 'result', id, fileName: id + '.wav', voiceId: request.voiceId,
    firstAudioMs: 5, synthesisMs: 10, audioDurationSeconds: 1, sampleRate: 24000, channels: 1,
    bytes: 48044, sha256: 'a'.repeat(64) });
  await drain(); controller.abort(); await rejected;
  assert.equal((await deadline(t, h.speech.stop())).error?.code, 'WORKER_STOP_TIMEOUT');
  assert.deepEqual(h.removed, []); child.close(); await h.speech.stop();
  assert.deepEqual(h.removed.map(file => path.basename(file)), [id + '.part', id + '.wav']);
  const restarting = h.speech.restart(); await drain(); h.ready(); await restarting;
  finishVerification(); await drain();
  assert.equal(h.speech.getState().state, 'READY'); assert.equal(h.speech.getState().busy, false);
  assert.equal(h.children.length, 2); assert.equal(h.children[1].kills, 0);
  h.children[1].close(); await drain();
});

test('cleanup failures retain exact failed paths and block restart until explicit retry succeeds', async t => {
  let blocked = true;
  const h = harness(t, { kill(child) { child.close(); return true; }, async unlink(file) {
    if (blocked && file.endsWith('.part')) throw Object.assign(Error('synthetic access failure'), { code: 'EACCES' });
    if (file.endsWith('.wav')) throw Object.assign(Error('synthetic absence'), { code: 'ENOENT' });
  } });
  const child = await h.start(), pending = h.speech.synthesize(request);
  const rejected = assert.rejects(pending, /STOPPED/), id = child.requests[0].id;
  await assert.rejects(h.speech.stop(), /OUTPUT_CLEANUP_FAILED/); await rejected;
  assert.equal(h.speech.getState().state, 'STOP_FAILED');
  await assert.rejects(h.speech.restart(), /OUTPUT_CLEANUP_FAILED/);
  assert.equal(h.children.length, 1); assert.equal(child.kills, 1);
  blocked = false; await h.speech.stop(); assert.equal(h.speech.getState().state, 'STOPPED');
  assert.deepEqual(h.removed.map(file => path.basename(file)), [id + '.part', id + '.wav', id + '.part', id + '.part']);
});

test('spontaneous close rejects pending work and retains failed cleanup for recovery', async t => {
  let blocked = true;
  const h = harness(t, { async unlink() { if (blocked) throw Object.assign(Error('synthetic busy'), { code: 'EBUSY' }); } });
  const child = await h.start(), pending = h.speech.synthesize(request), rejected = assert.rejects(pending, /WORKER_EXITED/);
  child.close(); await rejected; await drain();
  assert.equal(h.speech.getState().state, 'STOP_FAILED'); assert.equal(child.kills, 0);
  blocked = false; await h.speech.stop(); assert.equal(h.speech.getState().state, 'STOPPED');
  assert.equal(child.kills, 0); assert.equal(h.removed.length, 4);
});

test('models_stop can recover after the original speech worker closes late', async t => {
  const h = harness(t); let languageState = 'STOPPED', monitoring = false;
  const language = { status: () => ({ state: languageState, ownedProcessStopped: languageState === 'STOPPED' }),
    async start() { languageState = 'READY'; }, async stop() { languageState = 'STOPPED'; },
    async generate() { throw Error('UNEXPECTED_GENERATION'); } };
  const recognition = { status: () => ({ state: 'STOPPED', busy: false, ownsProcess: false, processStopConfirmed: true }),
    async stop() {}, async dispose() {}, async start() { throw Error('UNEXPECTED_RECOGNITION'); },
    async transcribe() { throw Error('UNEXPECTED_TRANSCRIPTION'); } };
  const policy = { async admit() {}, startWatch() { monitoring = true; }, stopWatch() { monitoring = false; },
    status: () => ({ monitoring, cleanupPending: false, sampling: false, admissionPending: false }) };
  const w = await createWorkbench({ settingsPath: path.join(SPEECH_OUTPUT_DIRECTORY, 'absent-lifetime-settings.json'),
    languageModel: language, speechEngine: h.speech, recognitionEngine: recognition, resourcePolicy: policy });
  await w.act({ type: 'models_start' }); await drain(); h.ready(); await drain();
  const first = await deadline(t, w.act({ type: 'models_stop' }));
  assert.equal(first.error, undefined); assert.equal(first.value.last.status, 'LOCAL_MODEL_STOP_UNCONFIRMED');
  assert.equal(first.value.localModels.cleanupPending, true);
  await assert.rejects(w.act({ type: 'models_start' }), /LOCAL_MODEL_CLEANUP_PENDING/);
  h.children[0].close(); await drain();
  const second = await deadline(t, w.act({ type: 'models_stop' }));
  assert.equal(second.error, undefined); assert.equal(second.value.last.status, 'LOCAL_MODELS_STOPPED');
  assert.equal(second.value.localModels.cleanupPending, false); assert.equal(second.value.localModels.error, null);
  await w.act({ type: 'models_start' }); await drain(); h.ready(); await drain();
  assert.equal(h.children.length, 2); assert.equal(w.state().localModels.speech.state, 'READY');
  h.children[1].close(); await drain(); await w.dispose();
});
