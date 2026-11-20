// In-memory child, manifest, clock and HTTP-response fixtures only. No process or model runs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { setImmediate as immediate } from 'node:timers/promises';
import path from 'node:path';
import { createLocalLanguageModel } from '../local-language-model.mjs';
import runtimePins from '../llama-runtime-pins.json' with { type: 'json' };

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const lock = JSON.parse(await readFile(path.join(root, 'companion/models.lock.json'), 'utf8'));
const context = { persona: { id: 'edge' }, request: { text: 'What do you know?' }, facts: [], history: [] };
const deferred = () => { let resolve; const promise = new Promise(yes => { resolve = yes; }); return { promise, resolve }; };
const outcome = promise => promise.then(value => ({ value }), error => ({ error: error.message }));
async function drain() { await immediate(); await immediate(); }

function rig(t, customize = () => {}) {
  const manifest = { schemaVersion: 1, files: runtimePins.files.map(f => ({ artifact: 'llama-cpu',
    path: `companion/local/runtimes/llama-cpu-b11065/${f.name}`, bytes: f.bytes, sha256: f.sha256 })) };
  const sizes = new Map(), hashes = new Map(), children = [], sleeps = [];
  for (const file of manifest.files) { sizes.set(path.resolve(root, file.path), file.bytes); hashes.set(path.resolve(root, file.path), file.sha256); }
  for (const file of lock.artifacts) {
    const name = path.join(root, 'companion/local/models', file.name); sizes.set(name, file.bytes); hashes.set(name, file.sha256);
  }
  let clock = 0;
  const api = { children, sleeps, onSpawn() {}, generation: () => { throw Error('UNEXPECTED_INFERENCE'); } };
  const io = {
    readFile: async file => JSON.stringify(file.endsWith('models.lock.json') ? lock : manifest),
    lstat: async file => ({ size: file.endsWith('.json') ? 1024 : sizes.get(file) ?? 0, isFile: () => true, isSymbolicLink: () => false }),
    realpath: async file => file,
    readdir: async () => manifest.files.map(file => ({ name: path.basename(file.path), isFile: () => true, isDirectory: () => false, isSymbolicLink: () => false })),
    hashFile: async file => hashes.get(file), reservePort: async () => 45678,
    now: () => clock, sleep: async (ms, value, options) => { sleeps.push({ ms, signal: options?.signal }); clock += ms; },
    randomBytes: bytes => Buffer.alloc(bytes, 0x42),
    spawn() {
      const child = new EventEmitter(); child.stdout = new PassThrough(); child.stderr = new PassThrough();
      child.pid = 9100 + children.length; child.kills = [];
      child.kill = signal => { child.kills.push(signal ?? 'SIGTERM'); queueMicrotask(() => child.emit('exit', 0)); return true; };
      children.push(child); api.onSpawn(child, children.length - 1); return child;
    },
    fetch: async url => url.endsWith('/health') ? new Response('{}') : api.generation()
  };
  customize(io, api);
  const model = createLocalLanguageModel({}, io);
  t.after(async () => {
    for (const child of children) { child.emit('exit', 0); child.emit('close', 0); child.stdout.destroy(); child.stderr.destroy(); }
    await model.stop().catch(() => {});
  });
  return { model, io, ...api };
}
function failingKill(child) {
  child.kill = signal => {
    child.kills.push(signal ?? 'SIGTERM'); child.emit('error', Object.assign(Error('synthetic private failure'), { code: 'EPERM' })); return false;
  };
}

test('kill error without exit cannot confirm stop or admit a replacement', async t => {
  const r = rig(t); await r.model.start(); const child = r.children[0]; failingKill(child);
  assert.equal((await outcome(r.model.stop())).error, 'PROCESS_STOP_UNCONFIRMED');
  assert.equal(r.model.status().ownedProcessStopped, false); assert.equal(r.model.status().ownedPid, child.pid);
  await assert.rejects(r.model.start(), /OWNED_PROCESS_STILL_RUNNING/); assert.equal(r.children.length, 1);
  assert.deepEqual(child.kills, ['SIGTERM', 'SIGKILL']);
  child.emit('exit', 0); await r.model.stop(); assert.equal(r.model.status().ownedProcessStopped, true);
  await r.model.start(); assert.equal(r.children.length, 2);
});

test('failed kill cannot be followed by replacement even after stop publicly settles', async t => {
  const r = rig(t); await r.model.start(); const child = r.children[0]; failingKill(child);
  const stopped = await outcome(r.model.stop()), restarted = await outcome(r.model.start());
  assert.equal(r.children.length, 1, `stop=${JSON.stringify(stopped)}; restart=${JSON.stringify(restarted)}; original PID=${child.pid} emitted no exit or close`);
  assert.equal(stopped.error, 'PROCESS_STOP_UNCONFIRMED'); assert.equal(restarted.error, 'OWNED_PROCESS_STILL_RUNNING');
});

test('current child errors invalidate readiness without releasing its lifetime', async t => {
  const r = rig(t); await r.model.start(); const child = r.children[0]; child.kill = () => false;
  child.emit('error', Error('synthetic current child error'));
  assert.equal(r.model.status().state, 'FAILED'); assert.equal(r.model.status().lastError, 'LOCAL_PROCESS_ERROR');
  assert.equal(r.model.status().ownedProcessStopped, false); assert.equal(r.model.status().ownedPid, child.pid);
  await assert.rejects(r.model.generate(context), /MODEL_NOT_READY/);
  await assert.rejects(r.model.start(), /OWNED_PROCESS_STILL_RUNNING/);
  await assert.rejects(r.model.stop(), /PROCESS_STOP_UNCONFIRMED/);
  child.emit('close', 0); await r.model.stop(); assert.equal(r.model.status().state, 'STOPPED');
});

test('repeated current and terminal child errors are harmless and never fake closure', async t => {
  const r = rig(t); await r.model.start(); const child = r.children[0]; child.kill = () => false;
  assert.doesNotThrow(() => { for (let i = 0; i < 10; i++) child.emit('error', Error('repeated synthetic error')); });
  assert.equal(r.model.status().ownedProcessStopped, false);
  child.emit('exit', 7); child.emit('close', 7);
  assert.doesNotThrow(() => { child.emit('error', Error('after exit')); child.emit('error', Error('after close')); });
  await r.model.stop(); assert.equal(r.model.status().state, 'STOPPED');
});

test('asynchronous no-PID spawn error closes without exit and permits explicit recovery', async t => {
  const r = rig(t, (io, api) => { api.onSpawn = (child, index) => {
    if (index !== 0) return; delete child.pid;
    queueMicrotask(() => { child.emit('error', Error('synthetic spawn failure')); child.emit('close', -1); });
  }; });
  await assert.rejects(r.model.start(), /LOCAL_PROCESS_START_FAILED/);
  assert.equal(r.model.status().ownedProcessStopped, true); assert.equal(r.children.length, 1);
  await r.model.stop(); await r.model.start(); assert.equal(r.children.length, 2);
});

test('no-PID error alone retains unconfirmed startup ownership until close', async t => {
  const r = rig(t, (io, api) => { api.onSpawn = (child, index) => {
    if (index !== 0) return; delete child.pid; child.kill = () => false;
    queueMicrotask(() => child.emit('error', Error('synthetic no-PID failure')));
  }; });
  await assert.rejects(r.model.start(), /PROCESS_STOP_UNCONFIRMED/);
  assert.equal(r.model.status().ownedProcessStopped, false); assert.equal(r.model.status().ownedPid, null);
  await assert.rejects(r.model.start(), /OWNED_PROCESS_STILL_RUNNING/);
  r.children[0].emit('close', -1); await r.model.stop(); await r.model.start(); assert.equal(r.children.length, 2);
});

test('stale predecessor errors, exit and close cannot change successor ownership', async t => {
  const r = rig(t); await r.model.start(); const old = r.children[0]; await r.model.stop(); await r.model.start();
  const current = r.children[1];
  assert.doesNotThrow(() => { old.emit('error', Error('stale error')); old.emit('error', Error('second stale error')); old.emit('exit', 9); old.emit('close', 9); });
  assert.equal(r.model.status().state, 'READY'); assert.equal(r.model.status().ownedPid, current.pid);
  assert.equal(r.model.status().ownedProcessStopped, false); assert.equal(current.kills.length, 0);
});

test('concurrent stops share termination and recover only after genuine late exit', async t => {
  const r = rig(t); await r.model.start(); const child = r.children[0]; failingKill(child);
  const stopped = await Promise.all([outcome(r.model.stop()), outcome(r.model.stop())]);
  assert.deepEqual(stopped.map(result => result.error), ['PROCESS_STOP_UNCONFIRMED', 'PROCESS_STOP_UNCONFIRMED']);
  assert.deepEqual(child.kills, ['SIGTERM', 'SIGKILL']); assert.equal(r.model.status().ownedProcessStopped, false);
  await assert.rejects(r.model.start(), /OWNED_PROCESS_STILL_RUNNING/);
  child.emit('exit', 0); await r.model.stop(); assert.equal(r.model.status().state, 'STOPPED');
});

test('synchronous close-only termination confirms only the matching child', async t => {
  const r = rig(t); await r.model.start(); const child = r.children[0];
  child.kill = () => { child.kills.push('SIGTERM'); child.emit('close', 0); return true; };
  await r.model.stop(); assert.equal(r.model.status().state, 'STOPPED');
  assert.equal(r.model.status().ownedProcessStopped, true); assert.equal(child.kills.length, 1);
  await r.model.start(); assert.equal(r.children.length, 2);
});

test('repeated timed-out stop attempts detach their exit waiters and deadline signals', async t => {
  const r = rig(t); await r.model.start(); const child = r.children[0];
  child.kill = signal => { child.kills.push(signal ?? 'SIGTERM'); return false; };
  for (let i = 0; i < 20; i++) {
    await assert.rejects(r.model.stop(), /PROCESS_STOP_UNCONFIRMED/);
    assert.equal(child.listenerCount('exit'), 1); assert.equal(child.listenerCount('close'), 1);
    assert.equal(child.listenerCount('error'), 1); assert.equal(r.model.status().ownedProcessStopped, false);
  }
  assert.equal(r.sleeps.length, 40); assert.deepEqual(r.sleeps.map(s => s.ms), Array.from({ length: 40 }, (_, i) => i % 2 ? 3000 : 2000));
  assert.ok(r.sleeps.every(s => s.signal instanceof AbortSignal && s.signal.aborted));
  child.emit('exit', 0); await r.model.stop(); assert.equal(r.model.status().state, 'STOPPED');
});

test('error during generation aborts the request while retaining original process ownership', async t => {
  const waiting = deferred(), r = rig(t, (io, api) => { api.generation = () => waiting.promise; });
  await r.model.start(); const pending = outcome(r.model.generate(context)); await drain();
  r.children[0].emit('error', Error('synthetic generation error'));
  assert.equal((await pending).error, 'GENERATION_CANCELLED');
  assert.equal(r.model.status().state, 'FAILED'); assert.equal(r.model.status().ownedProcessStopped, false);
  assert.equal(r.model.status().lastGenerationFinishReason, null); assert.equal(r.model.status().lastGenerationTimings, null);
  waiting.resolve(new Response());
});

test('error during awaited reader cleanup rejects completed text and terminal diagnostics', async t => {
  const cleanup = deferred(), reached = deferred();
  const terminal = { cache_n: 1, prompt_n: 2, prompt_ms: 3, predicted_n: 4, predicted_ms: 5 };
  const wire = `data: ${JSON.stringify({ choices: [{ delta: { content: 'Synthetic fixture.' }, finish_reason: 'stop' }], timings: terminal })}\n\ndata: [DONE]\n\n`;
  const r = rig(t, (io, api) => {
    const originalSleep = io.sleep;
    io.sleep = (ms, ...args) => ms === 500 ? cleanup.promise : originalSleep(ms, ...args);
    api.generation = () => ({ ok: true, headers: new Map([['content-type', 'text/event-stream']]), body: { getReader() {
      return { async read() { return { value: new TextEncoder().encode(wire), done: false }; }, cancel() { reached.resolve(); return cleanup.promise; } };
    } } });
  });
  await r.model.start(); const pending = outcome(r.model.generate(context)); await reached.promise;
  r.children[0].emit('error', Error('synthetic cleanup-crossing failure')); cleanup.resolve();
  assert.equal((await pending).error, 'GENERATION_CANCELLED');
  assert.equal(r.model.status().state, 'FAILED'); assert.equal(r.model.status().ownedProcessStopped, false);
  assert.equal(r.model.status().lastGenerationTimings, null); assert.equal(r.model.status().lastGenerationFinishReason, null);
});
