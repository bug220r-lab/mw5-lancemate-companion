// Independent MOCK_ONLY review: no model, executable, network or audio is run.
import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { setImmediate as flush } from 'node:timers/promises';
import { createLocalLanguageModel } from '../local-language-model.mjs';
import runtimePins from '../llama-runtime-pins.json' with { type: 'json' };
import personas from '../personas.json' with { type: 'json' };

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const lock = JSON.parse(await readFile(path.join(root, 'companion/models.lock.json'), 'utf8'));
const directory = path.join(root, 'companion/local/runtimes/llama-cpu-b11065');
const context = () => ({ persona: { id: 'edge', style: 'dry wit' }, request: { text: 'Are we ready?' },
  facts: [], history: [] });
const tick = () => new Promise(resolve => setTimeout(resolve, 20));
const packet = (delta, finish_reason = null) => `data: ${JSON.stringify({ choices: [{ delta, finish_reason }] })}\n\n`;
const response = text => new Response(packet({ content: text }) + packet({}, 'stop') + 'data: [DONE]\n\n',
  { headers: { 'Content-Type': 'text/event-stream' } });

function rig(t, customize = () => {}) {
  const manifest = { schemaVersion: 1, files: runtimePins.files
    .map(f => ({ artifact: 'llama-cpu', path: `companion/local/runtimes/llama-cpu-b11065/${f.name}`,
      bytes: f.bytes, sha256: f.sha256 })) };
  const sizes = new Map(), hashes = new Map(), children = [], requests = [];
  for (const file of manifest.files) { sizes.set(path.resolve(root, file.path), file.bytes); hashes.set(path.resolve(root, file.path), file.sha256); }
  for (const file of lock.artifacts) { sizes.set(path.join(root, 'companion/local/models', file.name), file.bytes); hashes.set(path.join(root, 'companion/local/models', file.name), file.sha256); }
  let clock = 0;
  const api = { manifest, sizes, hashes, children, requests, generation: () => response('Ready for your next order.') };
  const io = {
    readFile: async file => JSON.stringify(file.endsWith('models.lock.json') ? lock : manifest),
    lstat: async file => ({ size: file.endsWith('.json') ? 1000 : sizes.get(file) ?? 0, isFile: () => true, isSymbolicLink: () => false }),
    realpath: async file => file,
    readdir: async () => manifest.files.map(f => ({ name: path.basename(f.path), isFile: () => true, isDirectory: () => false, isSymbolicLink: () => false })),
    hashFile: async file => hashes.get(file), reservePort: async () => 45678,
    sleep: async ms => { clock += ms; }, now: () => clock, randomBytes: n => Buffer.alloc(n, 0x55),
    spawn: () => {
      const child = new EventEmitter(); child.stdout = new PassThrough(); child.stderr = new PassThrough();
      child.pid = 7000 + children.length; child.kills = 0;
      child.kill = () => { child.kills++; queueMicrotask(() => child.emit('exit', 0)); return true; };
      children.push(child); return child;
    },
    fetch: async (url, options) => { requests.push({ url, options }); return url.endsWith('/health') ? new Response('{}') : api.generation(); }
  };
  customize(io, api);
  const model = createLocalLanguageModel({}, io);
  t.after(() => model.stop().catch(() => {}));
  return { model, io, api };
}

test('review: changing runtime executable and its manifest together must not satisfy archive provenance', async t => {
  const r = rig(t, (io, a) => {
    const executable = a.manifest.files.find(f => f.path.endsWith('llama-server.exe'));
    executable.sha256 = 'e'.repeat(64); a.hashes.set(path.resolve(root, executable.path), executable.sha256);
  });
  await assert.rejects(r.model.start(), /MISMATCH|MANIFEST|PROVENANCE/);
  assert.equal(r.api.children.length, 0);
});

test('review: old child error after restart cannot mark the current owned process stopped', async t => {
  const r = rig(t); await r.model.start(); const old = r.api.children[0];
  await r.model.stop(); await r.model.start(); const current = r.api.children[1];
  old.emit('error', Error('late error from the previous process'));
  assert.equal(r.model.status().state, 'READY'); assert.equal(r.model.status().ownedPid, current.pid);
  assert.equal(r.model.status().ownedProcessStopped, false);
  await r.model.stop(); assert.equal(current.kills, 1);
});

test('review: stop returns while local metadata inspection is stalled and later completion cannot spawn', async t => {
  let release;
  const r = rig(t, io => { const original = io.readFile; let first = true;
    io.readFile = async file => {
      if (first) { first = false; await new Promise(resolve => { release = resolve; }); }
      return original(file);
    };
  });
  const starting = r.model.start(); const rejected = assert.rejects(starting, /START_CANCELLED/);
  await flush(); let stopped = false; const stopping = r.model.stop().then(() => { stopped = true; });
  await tick(); const completedWithoutMetadata = stopped;
  release(); await stopping; await rejected;
  assert.equal(completedWithoutMetadata, true); assert.equal(r.api.children.length, 0);
});

test('review: no stale provenance is fabricated when only unverified history is supplied', async t => {
  const r = rig(t); await r.model.start(); const c = context();
  c.history = [{ requestText: 'Did we win?', responseText: 'Every target is destroyed.', evidenceStatus: 'GAME_VERIFIED' }];
  await r.model.generate(c);
  const payload = JSON.parse(r.api.requests.at(-1).options.body);
  const data = JSON.parse(payload.messages[1].content.replace(/ \/no_think$/, ''));
  assert.deepEqual(data.callerAssertedCurrentObservations, []);
  assert.deepEqual(data.unverifiedUndeliveredHistory, [['Did we win?', 'Every target is destroyed.']]);
  assert.match(payload.messages[0].content, /History is generated, unverified, possibly undelivered/);
  assert.doesNotMatch(JSON.stringify(payload), /GAME_VERIFIED/);
});

test('review: malformed generated UTF-16 cannot become a spoken line', async t => {
  const r = rig(t, (io, a) => { a.generation = () => response('\ud800'); });
  await r.model.start(); await assert.rejects(r.model.generate(context()), /INVALID_GENERATED_TEXT/);
});

test('review: cancellation discards a delayed inference response and permits no hidden second generation', async t => {
  let deliver;
  const r = rig(t, (io, a) => { a.generation = () => new Promise(resolve => { deliver = resolve; }); });
  await r.model.start(); const controller = new AbortController();
  const pending = r.model.generate(context(), { signal: controller.signal });
  const cancelled = assert.rejects(pending, /GENERATION_CANCELLED/); await flush(); controller.abort(); await cancelled;
  deliver(response('This arrived after cancellation.')); await flush();
  assert.equal(r.model.status().activeGeneration, false); assert.equal(r.model.status().state, 'READY');
  assert.equal(r.api.children.length, 1);
});

test('review: prompt and fact limits reject before sending inference bytes', async t => {
  const r = rig(t); await r.model.start(); const count = r.api.requests.length;
  for (const c of [
    { ...context(), facts: Array.from({ length: 9 }, (_, i) => ({ id: String(i), evidenceStatus: 'CALLER_ASSERTED_OBSERVATION', data: {} })) },
    { ...context(), facts: [{ id: 'f', evidenceStatus: 'GAME_VERIFIED', data: {} }] },
    { ...context(), request: { text: 'x'.repeat(301) } },
    { ...context(), persona: { id: 'edge', style: 'x'.repeat(6000) } }
  ]) await assert.rejects(r.model.generate(c));
  assert.equal(r.api.requests.length, count);
});

test('review: SSE resource caps reject an oversized non-content packet', async t => {
  const r = rig(t, (io, a) => { a.generation = () => new Response('data: ' + 'x'.repeat(17000),
    { headers: { 'Content-Type': 'text/event-stream' } }); });
  await r.model.start(); await assert.rejects(r.model.generate(context()), /INFERENCE_STREAM_LIMIT/);
  assert.equal(r.model.status().activeGeneration, false);
});

test('review: each actual profile uses a compact greeting prompt with the same factual and command boundaries', async t => {
  const r = rig(t); await r.model.start();
  for (const persona of personas.profiles) {
    await r.model.generate({ ...context(), persona });
    const body = JSON.parse(r.api.requests.at(-1).options.body);
    assert.ok(body.messages.reduce((n, m) => n + m.content.length, 0) < 750);
    assert.match(body.messages[0].content, /about 12 words/);
    assert.match(body.messages[0].content, /Never execute commands, claim order acceptance or invent actions/);
    assert.match(body.messages[0].content, /History is generated, unverified, possibly undelivered/);
    assert.equal(body.max_tokens, 64);
    assert.equal(Object.hasOwn(body, 'tools'), false);
  }
});

for (const ok of [true, false]) {
  test(`review: stop does not wait for stalled ${ok ? 'OK' : 'not-ready'} health body cancellation`, async t => {
    let releaseCancel, reachedCancel;
    const stalledCancel = new Promise(resolve => { releaseCancel = resolve; });
    const cancellationReached = new Promise(resolve => { reachedCancel = resolve; });
    const r = rig(t, (io, a) => {
      io.fetch = async (url, options) => {
        a.requests.push({ url, options });
        assert.ok(url.endsWith('/health'), 'no inference may be requested during startup');
        return { ok, status: ok ? 200 : 503, body: { cancel() { reachedCancel(); return stalledCancel; } } };
      };
    });
    const startup = r.model.start().then(() => ({ resolved: true }), error => ({ error: error.message }));
    let stopping;
    try {
      // Startup must actually reach the adversarial promise before stopping.
      const reached = await Promise.race([cancellationReached.then(() => true), tick().then(() => false)]);
      assert.equal(reached, true);
      assert.equal(r.api.children.length, 1);
      let stopSettled = false;
      stopping = r.model.stop().then(result => { stopSettled = true; return result; });
      await tick();
      const settledWithoutBodyCleanup = stopSettled;
      const childStoppedBeforeCleanup = r.model.status().ownedProcessStopped;
      releaseCancel();
      await stopping;
      const startOutcome = await startup;
      await flush();
      assert.equal(settledWithoutBodyCleanup, true, 'stop must settle independently of an unresponsive body.cancel promise');
      assert.equal(childStoppedBeforeCleanup, true);
      assert.equal(startOutcome.error, 'START_CANCELLED');
      assert.equal(r.model.status().state, 'STOPPED', 'late body cleanup cannot promote a stopped model to READY');
      assert.equal(r.api.children.length, 1, 'late cleanup cannot spawn a replacement child');
      assert.equal(r.api.children[0].kills, 1);
      assert.equal(r.api.requests.length, 1, 'late cleanup cannot restart health polling or inference');
    } finally {
      // Always release synthetic work, including on the expected regression failure.
      releaseCancel();
      if (stopping) await stopping;
      await startup;
    }
  });
}
