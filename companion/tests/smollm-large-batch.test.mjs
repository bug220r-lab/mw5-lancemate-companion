// MOCK_ONLY: injected files, child streams and HTTP; no native execution.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createLocalLanguageModel, smollmMessagesFor } from '../local-language-model.mjs';
import runtimePins from '../llama-runtime-pins.json' with { type: 'json' };

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const prior = JSON.parse(await readFile(path.join(root, 'research/SMOLLM3_STATIC_PREFIX_DIAGNOSTIC.json')));
const options = { modelId: 'smollm3_3b', threads: 4, processingBatch: 'large', weightRepacking: false,
  promptCaching: true, experimentalSpeakerRelativeFacts: true, experimentalSpeakerBriefing: true,
  experimentalSeparateRequest: true, experimentalStaticPrefix: true };
const batch = 'llama_context: n_batch              = 2048\n';
const ubatch = 'llama_context: n_ubatch              = 512\n';

function rig(t, { configuration = {}, onHealth = c => c.stderr.write(batch + ubatch), onGenerate } = {}) {
  const lock = { schemaVersion: 1, artifacts: prior.modelPins };
  const runtime = path.join(root, 'companion/local/runtimes/llama-cpu-b11065');
  const inventory = { schemaVersion: 1, files: runtimePins.files.map(f => ({ artifact: 'llama-cpu',
    path: 'companion/local/runtimes/llama-cpu-b11065/' + f.name, bytes: f.bytes, sha256: f.sha256 })) };
  const files = new Map();
  for (const a of lock.artifacts) files.set(path.join(root, 'companion/local/models', a.name), a);
  for (const a of runtimePins.files) files.set(path.join(runtime, a.name), a);
  const calls = { children: [], requests: [], spawns: [], kills: 0, health: 0 }; let time = 0;
  const io = { readFile: async f => JSON.stringify(f.endsWith('models.lock.json') ? lock : inventory),
    lstat: async f => ({ size: f.endsWith('.json') ? 1024 : files.get(f)?.bytes ?? 0, isFile: () => true, isSymbolicLink: () => false }),
    realpath: async f => f, hashFile: async f => files.get(f)?.sha256,
    readdir: async () => runtimePins.files.map(f => ({ name: f.name, isFile: () => true, isDirectory: () => false, isSymbolicLink: () => false })),
    reservePort: async () => 45678, now: () => time, sleep: async ms => { time += ms; }, randomBytes: n => Buffer.alloc(n, 12),
    spawn: (file, args, opts) => {
      const c = new EventEmitter(); c.stdout = new PassThrough(); c.stderr = new PassThrough(); c.pid = 9001 + calls.children.length;
      c.kill = () => { calls.kills++; queueMicrotask(() => c.emit('exit', 0)); return true; };
      calls.children.push(c); calls.spawns.push({ file, args, opts }); return c;
    },
    fetch: async (url, request) => {
      const c = calls.children.at(-1);
      if (url.endsWith('/health')) { calls.health++; onHealth(c, calls); return new Response('{}', { status: 200 }); }
      calls.requests.push(JSON.parse(request.body)); onGenerate?.(c, calls);
      return new Response('data: ' + JSON.stringify({ choices: [{ delta: { role: 'assistant', content: 'Synthetic answer.' }, finish_reason: 'stop' }] }) +
        '\n\ndata: [DONE]\n\n', { headers: { 'Content-Type': 'text/event-stream' } });
    } };
  const model = createLocalLanguageModel({ ...options, ...configuration }, io);
  t.after(() => model.stop().catch(() => {})); return { model, calls };
}

test('large batch requires the exact experimental Smol prerequisites before any I/O', () => {
  let calls = 0; const io = { readFile: async () => { calls++; }, spawn: () => { calls++; } };
  for (const modelId of ['qwen1_7b', 'qwen4b'])
    assert.throws(() => createLocalLanguageModel({ ...options, modelId }, io), /UNSUPPORTED_MODEL_CONFIGURATION/);
  for (const key of ['experimentalSpeakerRelativeFacts', 'experimentalSpeakerBriefing', 'experimentalSeparateRequest', 'experimentalStaticPrefix'])
    assert.throws(() => createLocalLanguageModel({ ...options, [key]: false }, io), /UNSUPPORTED_MODEL_CONFIGURATION/);
  for (const processingBatch of ['2048', 2048, true, null, {}, 'large '])
    assert.throws(() => createLocalLanguageModel({ ...options, processingBatch }, io), /UNSUPPORTED_MODEL_CONFIGURATION/);
  assert.equal(calls, 0);
});

test('large mode observes post-clamping sizes before readiness and preserves all 27 prepared messages', async t => {
  const r = rig(t); assert.equal(r.model.status().nativeBatchObservation.status, 'PENDING');
  const status = await r.model.start(), args = r.calls.spawns[0].args;
  assert.deepEqual(args.slice(args.indexOf('-b'), args.indexOf('-b') + 6), ['-b', '2048', '-ub', '512', '--log-verbosity', '4']);
  assert.ok(args.includes('--no-repack')); assert.equal(args[args.indexOf('-ngl') + 1], '0');
  assert.equal(r.calls.spawns[0].opts.windowsHide, true); assert.equal(r.calls.spawns[0].opts.shell, false);
  assert.deepEqual(status.nativeBatchObservation, { status: 'CONFIRMED', source: 'OWNED_PROCESS_STARTUP_LOG',
    logicalBatchTokens: 2048, physicalBatchTokens: 512, logVerbosity: 4, lines: [batch.trimEnd(), ubatch.trimEnd()], error: null });
  assert.equal(status.classification, 'MOCK_ONLY'); assert.equal(status.settings.nativeLogVerbosity, 4);
  assert.equal(status.settings.logicalBatchTokens, 2048); assert.equal(status.settings.physicalBatchTokens, 512);
  for (const record of [prior.primer, ...prior.samples]) {
    await r.model.generate(record.context);
    const body = r.calls.requests.at(-1);
    assert.deepEqual(body.messages, record.messages);
    assert.deepEqual(body.messages, smollmMessagesFor(record.context, { experimentalStaticPrefix: true }));
    assert.deepEqual({ ...body, messages: undefined }, { messages: undefined, max_tokens: 64, temperature: .7, top_p: .8,
      top_k: 20, stream: true, cache_prompt: true, chat_template_kwargs: { enable_thinking: false } });
  }
  status.nativeBatchObservation.lines.push('forged'); status.nativeBatchObservation.logicalBatchTokens = 1;
  assert.equal(r.model.status().nativeBatchObservation.lines.length, 2);
  assert.equal(r.model.status().nativeBatchObservation.logicalBatchTokens, 2048);
  await r.model.stop(); assert.equal(r.model.status().ownedProcessStopped, true);
});

test('old default and compact arguments/status remain free of experimental observation and trace verbosity', async t => {
  for (const processingBatch of ['default', 'compact']) {
    const r = rig(t, { configuration: { processingBatch }, onHealth: () => {} });
    await r.model.start(); const args = r.calls.spawns[0].args, status = r.model.status();
    assert.equal(args.includes('--log-verbosity'), false); assert.equal(Object.hasOwn(status, 'nativeBatchObservation'), false);
    assert.equal(Object.hasOwn(status.settings, 'nativeLogVerbosity'), false);
    if (processingBatch === 'default') assert.equal(args.includes('-b'), false);
    else assert.deepEqual(args.slice(args.indexOf('-b'), args.indexOf('-b') + 4), ['-b', '128', '-ub', '64']);
    await r.model.stop();
  }
});

test('separately fragmented streams accept only complete source-wrapped lines', async t => {
  const expected = ['0.01.023.456 I ' + batch.trimEnd(), 'I ' + ubatch.trimEnd()];
  const r = rig(t, { onHealth: c => {
    c.stdout.write(expected[0].slice(0, 27)); c.stderr.write(expected[1].slice(0, 15));
    c.stdout.write(expected[0].slice(27) + '\r'); c.stderr.write(expected[1].slice(15) + '\n'); c.stdout.write('\n');
  } });
  await r.model.start(); assert.equal(r.model.status().nativeBatchObservation.status, 'CONFIRMED');
  assert.deepEqual(r.model.status().nativeBatchObservation.lines, [expected[1], expected[0]]);
});

test('missing, mismatched and duplicate startup evidence fail before generation and stop the owned child', async t => {
  const cases = [
    { log: '', code: 'MISSING' }, { log: batch, code: 'MISSING' },
    { log: batch.replace('2048', '128') + ubatch, code: 'MISMATCH' },
    { log: batch + ubatch.replace('512', '64'), code: 'MISMATCH' },
    { log: batch + ubatch + batch, code: 'CONFLICT' },
    { log: batch + batch.replace('2048', '128') + ubatch, code: 'CONFLICT' }
  ];
  for (const entry of cases) {
    const r = rig(t, { onHealth: c => c.stderr.write(entry.log) });
    await assert.rejects(r.model.start(), new RegExp('NATIVE_BATCH_OBSERVATION_' + entry.code));
    const status = r.model.status(); assert.equal(status.state, 'FAILED'); assert.equal(status.ownedProcessStopped, true);
    assert.equal(status.nativeBatchObservation.status, 'REJECTED'); assert.equal(r.calls.health, 1);
    await assert.rejects(r.model.generate(prior.primer.context), /MODEL_NOT_READY/); assert.equal(r.calls.requests.length, 0);
  }
});

test('non-source wrappers, cross-stream fragments and overlong candidate lines cannot establish adoption', async t => {
  const writers = [
    c => c.stderr.write('request: ' + batch + ubatch),
    c => c.stderr.write(batch.trimEnd() + ' extra\n' + ubatch),
    c => { c.stdout.write(batch.slice(0, 22)); c.stderr.write(batch.slice(22) + ubatch); },
    c => c.stderr.write('x'.repeat(4097) + batch + ubatch),
    c => c.stderr.write(batch.replace('2048', '2048.0') + ubatch),
    c => c.stderr.write(batch + ubatch.trimEnd())
  ];
  for (const onHealth of writers) {
    const r = rig(t, { onHealth }); await assert.rejects(r.model.start(), /NATIVE_BATCH_OBSERVATION_MISSING/);
    assert.equal(r.calls.requests.length, 0); assert.equal(r.model.status().ownedProcessStopped, true);
  }
});

test('bounded observation survives unrelated log-tail eviction and ignores post-readiness lines', async t => {
  const r = rig(t, { onHealth: c => {
    c.stderr.write('x'.repeat(6000) + '\n'); c.stderr.write(batch + ubatch); c.stderr.write('Unrelated native log.\n'.repeat(1000));
  }, onGenerate: c => c.stderr.write(batch.replace('2048', '16') + ubatch) });
  await r.model.start(); const before = r.model.status().nativeBatchObservation;
  assert.equal(r.model.status().log.includes('n_batch'), false); assert.ok(r.model.status().log.length <= 8192);
  await r.model.generate(prior.primer.context); assert.deepEqual(r.model.status().nativeBatchObservation, before);
});

test('restart clears observation and late prior-child output cannot supply missing sizes', async t => {
  let starts = 0;
  const r = rig(t, { onHealth: (c, calls) => {
    starts++;
    if (starts === 1) c.stderr.write(batch + ubatch);
    else { calls.children[0].stderr.write(batch + ubatch); c.stderr.write(batch); }
  } });
  await r.model.start(); assert.equal(r.model.status().nativeBatchObservation.status, 'CONFIRMED'); await r.model.stop();
  await assert.rejects(r.model.start(), /NATIVE_BATCH_OBSERVATION_MISSING/);
  const status = r.model.status(); assert.equal(status.nativeBatchObservation.physicalBatchTokens, null);
  assert.deepEqual(status.nativeBatchObservation.lines, [batch.trimEnd()]); assert.equal(status.ownedProcessStopped, true);
  assert.equal(r.calls.requests.length, 0);
});

test('a corrected new owned startup can recover after a rejected observation without inheriting its error', async t => {
  let starts = 0;
  const r = rig(t, { onHealth: c => { starts++; c.stderr.write(starts === 1 ? batch.replace('2048', '128') : batch + ubatch); } });
  await assert.rejects(r.model.start(), /NATIVE_BATCH_OBSERVATION_MISMATCH/);
  await r.model.start(); assert.equal(r.model.status().nativeBatchObservation.status, 'CONFIRMED');
  assert.equal(r.model.status().nativeBatchObservation.error, null); assert.equal(r.model.status().lastError, null);
  await r.model.generate(prior.primer.context); assert.equal(r.calls.requests.length, 1);
});
