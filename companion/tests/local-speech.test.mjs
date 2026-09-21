import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough, Writable } from 'node:stream';
import { createLocalSpeech, LOCAL_SPEECH_VOICES, SPEECH_OUTPUT_DIRECTORY } from '../local-speech.mjs';
import path from 'node:path';

function harness(options = {}) {
  const children = [], spawnCalls = [], verified = [];
  function spawnProcess(...args) {
    spawnCalls.push(args);
    const child = new EventEmitter(); child.stdout = new PassThrough(); child.stderr = new PassThrough();
    child.requests = []; child.kills = 0;
    child.stdin = new Writable({ write(chunk, encoding, callback) { child.requests.push(JSON.parse(chunk.toString())); callback(); } });
    child.kill = () => { child.kills++; setImmediate(() => child.emit('close', 0)); return true; };
    child.send = value => child.stdout.write(JSON.stringify(value) + '\n');
    children.push(child); return child;
  }
  const speech = createLocalSpeech({ spawnProcess,
    verifyOutput: async (file, msg) => { verified.push([file, msg]); }, ...options });
  const ready = child => child.send({ type: 'ready', protocol: 1, device: 'cpu', voices: [...LOCAL_SPEECH_VOICES],
    microphoneCapture: false, speakerPlayback: false, startupMs: 1, versions: {} });
  async function start() { const pending = speech.start(); ready(children.at(-1)); await pending; }
  const result = (child, patch = {}) => {
    const request = child.requests.at(-1);
    child.send({ type: 'result', id: request.id, fileName: request.id + '.wav', voiceId: request.voiceId,
      firstAudioMs: 50, synthesisMs: 55, audioDurationSeconds: 1, sampleRate: 24000, channels: 1,
      bytes: 48044, sha256: 'a'.repeat(64), ...patch });
  };
  return { speech, children, spawnCalls, verified, start, ready, result };
}
const request = { text: 'Radio check.', voiceId: 'af_bella' };

test('constructing is inert; explicit start uses hidden isolated Python pipes and no shell', async t => {
  const h = harness(); t.after(() => h.speech.stop());
  assert.equal(h.children.length, 0); assert.equal(h.speech.getState().state, 'NEW');
  await h.start();
  const [file, args, options] = h.spawnCalls[0];
  assert.ok(file.endsWith(path.join('venv', 'Scripts', 'python.exe')));
  assert.deepEqual(args.slice(0, 2), ['-I', '-B']);
  assert.deepEqual(options.stdio, ['pipe', 'pipe', 'pipe']);
  assert.equal(options.windowsHide, true); assert.equal(options.shell, false);
  assert.equal(options.env.HF_HUB_OFFLINE, '1'); assert.equal(options.env.PYTHONPATH, undefined);
});
test('all three fixed voices produce file-only results from one persistent worker', async t => {
  const h = harness(); t.after(() => h.speech.stop()); await h.start();
  for (const voiceId of LOCAL_SPEECH_VOICES) {
    const promise = h.speech.synthesize({ ...request, voiceId }); h.result(h.children[0]);
    const output = await promise;
    assert.equal(output.voiceId, voiceId); assert.equal(path.dirname(output.wavPath), SPEECH_OUTPUT_DIRECTORY);
    assert.equal(output.speakerPlayback, false); assert.equal(output.classification, 'LOCAL_TTS_FILE_ONLY');
  }
  assert.equal(h.children.length, 1); assert.equal(h.verified.length, 3);
});
test('synthesis before explicit readiness cannot spawn or queue work', async () => {
  const h = harness(); await assert.rejects(h.speech.synthesize(request), /SPEECH_NOT_READY/);
  assert.equal(h.children.length, 0);
});
test('simultaneous synthesis is rejected, preserving the active request', async t => {
  const h = harness(); t.after(() => h.speech.stop()); await h.start();
  const first = h.speech.synthesize(request);
  await assert.rejects(h.speech.synthesize(request), /SPEECH_BUSY/);
  assert.equal(h.children[0].requests.length, 1); h.result(h.children[0]); await first;
});
for (const [label, invalid] of Object.entries({ empty: { ...request, text: ' ' }, oversized: { ...request, text: 'x'.repeat(257) },
  newline: { ...request, text: 'x\ny' }, nul: { ...request, text: 'x\0y' }, malformedUnicode: { ...request, text: '\ud800' },
  unknownVoice: { ...request, voiceId: '../models/unknown' }, arbitraryPath: { ...request, wavPath: 'C:\\outside.wav' },
  extraCommand: { ...request, command: 'play' } })) {
  test(`request rejected without writing: ${label}`, async t => {
    const h = harness(); t.after(() => h.speech.stop()); await h.start();
    await assert.rejects(h.speech.synthesize(invalid), /INVALID_SPEECH_REQUEST/);
    assert.equal(h.children[0].requests.length, 0);
  });
}
test('256 character text is allowed without arbitrary request IDs', async t => {
  const h = harness(); t.after(() => h.speech.stop()); await h.start();
  const pending = h.speech.synthesize({ ...request, text: 'x'.repeat(256) });
  assert.equal(h.children[0].requests[0].text.length, 256);
  assert.match(h.children[0].requests[0].id, /^[a-f0-9-]{36}$/); h.result(h.children[0]); await pending;
});
test('abort kills owned worker, clears request and requires explicit restart', async t => {
  const h = harness(); t.after(() => h.speech.stop()); await h.start();
  const controller = new AbortController();
  const pending = h.speech.synthesize(request, { signal: controller.signal });
  const failure = assert.rejects(pending, /ABORTED/); controller.abort(); await failure; await h.speech.stop();
  assert.equal(h.children[0].kills, 1); assert.equal(h.speech.getState().busy, false);
  await assert.rejects(h.speech.start(), /EXPLICIT_RESTART_REQUIRED/);
  const restarting = h.speech.restart();
  await new Promise(setImmediate); h.ready(h.children.at(-1)); await restarting;
  assert.equal(h.children.length, 2); assert.equal(h.speech.getState().state, 'READY');
});
test('pre-aborted request never writes to worker', async t => {
  const h = harness(); t.after(() => h.speech.stop()); await h.start();
  const controller = new AbortController(); controller.abort();
  await assert.rejects(h.speech.synthesize(request, { signal: controller.signal }), /ABORTED/);
  assert.equal(h.children[0].requests.length, 0);
});
test('stop is idempotent, kills once and rejects active request', async () => {
  const h = harness(); await h.start(); const pending = h.speech.synthesize(request);
  const failure = assert.rejects(pending, /STOPPED/);
  await Promise.all([h.speech.stop(), h.speech.stop()]); await failure;
  assert.equal(h.children[0].kills, 1);
  await h.speech.stop(); assert.equal(h.children[0].kills, 1);
});
test('startup timeout kills owned child instead of reporting readiness', async () => {
  const h = harness({ startupTimeoutMs: 5 });
  await assert.rejects(h.speech.start(), /STARTUP_TIMEOUT/); await h.speech.stop();
  assert.equal(h.children[0].kills, 1); assert.equal(h.speech.getState().restartRequired, true);
});
test('generation timeout kills child and rejects work', async t => {
  const h = harness({ synthesisTimeoutMs: 5 }); t.after(() => h.speech.stop()); await h.start();
  await assert.rejects(h.speech.synthesize(request), /SYNTHESIS_TIMEOUT/);
  await h.speech.stop(); assert.equal(h.children[0].kills, 1);
});
test('unknown result identity fails closed', async t => {
  const h = harness(); t.after(() => h.speech.stop()); await h.start();
  const pending = h.speech.synthesize(request); const failure = assert.rejects(pending, /UNEXPECTED_WORKER_RESPONSE/);
  h.result(h.children[0], { id: 'different' }); await failure;
});
test('returned arbitrary WAV path fails before output verification', async t => {
  const h = harness(); t.after(() => h.speech.stop()); await h.start();
  const pending = h.speech.synthesize(request); const failure = assert.rejects(pending, /INVALID_WORKER_RESULT/);
  h.result(h.children[0], { fileName: '../other.wav' }); await failure; assert.equal(h.verified.length, 0);
});
test('output hash/file verification failure is not synthesis success', async t => {
  const h = harness({ verifyOutput: async () => { throw Error('mismatch'); } }); t.after(() => h.speech.stop()); await h.start();
  const pending = h.speech.synthesize(request); const failure = assert.rejects(pending, /OUTPUT_VERIFICATION_FAILED/);
  h.result(h.children[0]); await failure;
});
test('aborting during file verification cannot return a late accepted result', async t => {
  let release; const h = harness({ verifyOutput: () => new Promise(resolve => { release = resolve; }) });
  t.after(() => h.speech.stop()); await h.start(); const controller = new AbortController();
  const pending = h.speech.synthesize(request, { signal: controller.signal });
  const failure = assert.rejects(pending, /ABORTED/); h.result(h.children[0]);
  controller.abort(); release(); await failure; await h.speech.stop();
  assert.equal(h.speech.getState().state, 'STOPPED');
});
test('worker-reported synthesis error rejects one request without fabricating a WAV', async t => {
  const h = harness(); t.after(() => h.speech.stop()); await h.start();
  const pending = h.speech.synthesize(request); const failure = assert.rejects(pending, /SYNTHESIS_FAILED/);
  h.children[0].send({ type: 'error', id: h.children[0].requests[0].id, error: 'failed' }); await failure;
  assert.equal(h.speech.getState().state, 'READY'); assert.equal(h.verified.length, 0);
});
test('invalid JSON output kills worker and cannot enter ready state', async () => {
  const h = harness(); const pending = h.speech.start(); const failure = assert.rejects(pending, /INVALID_WORKER_JSON/);
  h.children[0].stdout.write('not json\n'); await failure; await h.speech.stop();
});
test('oversized protocol output is bounded and fatal', async () => {
  const h = harness(); const pending = h.speech.start(); const failure = assert.rejects(pending, /WORKER_OUTPUT_LIMIT/);
  h.children[0].stdout.write('x'.repeat(65537)); await failure; await h.speech.stop();
});
test('unexpected process exit rejects active work and requires restart', async t => {
  const h = harness(); t.after(() => h.speech.stop()); await h.start();
  const pending = h.speech.synthesize(request); const failure = assert.rejects(pending, /WORKER_EXITED/);
  h.children[0].emit('close', 1); await failure;
  assert.equal(h.speech.getState().restartRequired, true);
});
test('late old-worker messages cannot affect a new worker', async t => {
  const h = harness(); t.after(() => h.speech.stop()); await h.start(); const old = h.children[0];
  const restarting = h.speech.restart(); await new Promise(setImmediate); await new Promise(setImmediate);
  h.ready(h.children.at(-1)); await restarting;
  old.send({ type: 'fatal', error: 'late' }); old.emit('close', 1);
  assert.equal(h.speech.getState().state, 'READY'); assert.equal(h.children[1].kills, 0);
});
test('concurrent explicit restarts share one new worker', async t => {
  const h = harness(); t.after(() => h.speech.stop()); await h.start();
  const a = h.speech.restart(), b = h.speech.restart();
  await new Promise(setImmediate); await new Promise(setImmediate);
  assert.equal(h.children.length, 2); h.ready(h.children[1]); await Promise.all([a, b]);
  assert.equal(h.children[0].kills, 1); assert.equal(h.speech.getState().state, 'READY');
});
test('stop during restart prevents a delayed new worker from appearing', async () => {
  const h = harness(); await h.start();
  const restarting = h.speech.restart(); const failure = assert.rejects(restarting, /RESTART_CANCELLED/);
  await h.speech.stop(); await failure;
  assert.equal(h.children.length, 1); assert.equal(h.speech.getState().state, 'STOPPED');
});
