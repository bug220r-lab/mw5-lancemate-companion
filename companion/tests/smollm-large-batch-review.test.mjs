// Independent MOCK_ONLY review. No native worker, actual HTTP, model read, or receipt write.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLocalLanguageModel, smollmMessagesFor } from '../local-language-model.mjs';
import runtimePins from '../llama-runtime-pins.json' with { type: 'json' };
import { MODEL_TRANSFER_FIXTURE_SHA256, readFrozenModelTransferFixture, prepareModelTransferDiagnostic,
  executeModelTransferDiagnostic } from '../../scripts/Exercise-ConversationModelTransfer.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const prior = JSON.parse(await readFile(path.join(root, 'research/SMOLLM3_STATIC_PREFIX_DIAGNOSTIC.json')));
const fixture = readFrozenModelTransferFixture(await readFile(path.join(root, 'synthetic/conversation-model-transfer-cases.json')));
const plan = await prepareModelTransferDiagnostic(['--run-large-batch-004'], fixture);
const flags = { experimentalSpeakerRelativeFacts: true, experimentalSpeakerBriefing: true,
  experimentalSeparateRequest: true, experimentalStaticPrefix: true };
const opts = { modelId: 'smollm3_3b', threads: 4, processingBatch: 'large', weightRepacking: false, promptCaching: true, ...flags };
const lines = ['llama_context: n_batch       = 2048\n', 'llama_context: n_ubatch      = 512\n'];
const evidence = { fixtureSha256: MODEL_TRANSFER_FIXTURE_SHA256, sources: {}, modelPins: [], runtimePins: [] };
function confirmed() { return { status: 'CONFIRMED', source: 'OWNED_PROCESS_STARTUP_LOG', logicalBatchTokens: 2048,
  physicalBatchTokens: 512, logVerbosity: 4, lines: lines.map(s => s.trimEnd()), error: null }; }

function fakeAdapter(t, onHealth = child => child.stderr.write(lines.join('')), optionChanges = {}) {
  const selected = { id: 'smollm3_3b', name: 'SmolLM3-Q4_K_M.gguf', bytes: 1915305312,
    sha256: '8334b850b7bd46238c16b0c550df2138f0889bf433809008cc17a8b05761863e' };
  const archive = { id: 'llama-cpu', name: 'llama-b11065-bin-win-cpu-x64.zip', bytes: 18466663,
    sha256: '33f941a74b8db38e92690f5f151a770ef5a66481c07dabfe2e505b57e3546807' };
  const lock = { schemaVersion: 1, artifacts: [selected, archive] }, files = new Map();
  for (const item of lock.artifacts) files.set(path.join(root, 'companion/local/models', item.name), item);
  const inventory = { schemaVersion: 1, files: runtimePins.files.map(f => ({ artifact: 'llama-cpu',
    path: `companion/local/runtimes/llama-cpu-b11065/${f.name}`, bytes: f.bytes, sha256: f.sha256 })) };
  for (const f of inventory.files) files.set(path.resolve(root, f.path), f);
  let clock = 0;
  const calls = { children: [], requests: [], spawns: [], health: 0 };
  const io = {
    readFile: async file => JSON.stringify(file.endsWith('models.lock.json') ? lock : inventory),
    lstat: async file => ({ size: file.endsWith('.json') ? 1024 : files.get(file)?.bytes ?? 0, isFile: () => true, isSymbolicLink: () => false }),
    realpath: async file => file,
    readdir: async () => runtimePins.files.map(f => ({ name: f.name, isFile: () => true, isDirectory: () => false, isSymbolicLink: () => false })),
    hashFile: async file => files.get(file)?.sha256, reservePort: async () => 45678,
    now: () => clock, sleep: async ms => { clock += ms; }, randomBytes: n => Buffer.alloc(n, 0x17),
    spawn: (exe, args, options) => {
      calls.spawns.push({ exe, args, options });
      const child = new EventEmitter(); child.stdout = new PassThrough(); child.stderr = new PassThrough();
      child.pid = 9000 + calls.children.length; child.kill = () => { queueMicrotask(() => child.emit('exit', 0)); return true; };
      calls.children.push(child); return child;
    },
    fetch: async (url, options) => {
      if (url.endsWith('/health')) { calls.health++; onHealth(calls.children.at(-1), calls); return new Response('{}'); }
      calls.requests.push(JSON.parse(options.body));
      return new Response('data: ' + JSON.stringify({ choices: [{ delta: { content: 'Mock only.' }, finish_reason: 'stop' }] }) +
        '\n\ndata: [DONE]\n\n', { headers: { 'Content-Type': 'text/event-stream' } });
    }
  };
  const engine = createLocalLanguageModel({ ...opts, ...optionChanges }, io);
  t.after(() => engine.stop().catch(() => {})); return { engine, calls };
}

function fakeRunner(observation = confirmed()) {
  let alive = false, finish = null;
  const calls = { generated: [], stopped: 0, options: null };
  const engine = {
    async start() { alive = true; },
    async generate(context) { calls.generated.push(context); finish = 'stop'; return 'Mock only.'; },
    async stop() { calls.stopped++; alive = false; },
    status: () => ({ state: alive ? 'READY' : 'STOPPED', modelId: 'smollm3_3b', threads: 4, verification: 'PINNED_FILES_VERIFIED',
      ownedPid: alive ? 77 : null, ownedProcessStopped: !alive, activeGeneration: false, log: '',
      lastGenerationFinishReason: finish, lastGenerationTimings: null, nativeBatchObservation: observation,
      settings: { host: '127.0.0.1', contextTokens: 2048, maxOutputTokens: 64, maxOutputChars: 256, gpuLayers: 0,
        ...opts, nativeLogVerbosity: 4, logicalBatchTokens: 2048, physicalBatchTokens: 512,
        simultaneousModels: 1, thinking: false, webUI: false, mcpProxy: false } })
  };
  const io = { createEngine: options => { calls.options = options; return engine; },
    reserveReceipt: async () => ({ async save() {}, async close() {} }),
    availableRam: () => 6 * 1024 ** 3, availableDisk: async () => 20 * 1024 ** 3 };
  return { engine, calls, io };
}

test('large-batch independent review: only the explicit Smol experimental path is admitted', () => {
  for (const change of [{ modelId: 'qwen4b' }, { modelId: 'qwen1_7b' }, ...Object.keys(flags).map(k => ({ [k]: false }))])
    assert.throws(() => createLocalLanguageModel({ ...opts, ...change }), /UNSUPPORTED_MODEL_CONFIGURATION/);
  for (const processingBatch of ['LARGE', '2048', 2048, {}, null])
    assert.throws(() => createLocalLanguageModel({ ...opts, processingBatch }), /UNSUPPORTED_MODEL_CONFIGURATION/);
  assert.equal(createLocalLanguageModel().status().settings.processingBatch, 'default');
});

test('large-batch independent review: explicit spawn arguments and actual payload match the recorded treatment', async t => {
  const r = fakeAdapter(t); await r.engine.start(); await r.engine.generate(plan.cases[1].context);
  const { args, options } = r.calls.spawns[0];
  for (const [flag, value] of [['-b', '2048'], ['-ub', '512'], ['-t', '4'], ['-tb', '4'], ['-ngl', '0'], ['--log-verbosity', '4']]) {
    assert.equal(args.filter(x => x === flag).length, 1); assert.equal(args[args.indexOf(flag) + 1], value);
  }
  assert.equal(args.filter(x => x === '--no-repack').length, 1); assert.equal(options.shell, false); assert.equal(options.windowsHide, true);
  assert.equal(r.engine.status().nativeBatchObservation.status, 'CONFIRMED');
  assert.equal(r.engine.status().nativeBatchObservation.source, 'OWNED_PROCESS_STARTUP_LOG');
  assert.deepEqual(r.calls.requests[0].messages, plan.cases[1].messages);
  assert.deepEqual({ ...r.calls.requests[0], messages: undefined }, { messages: undefined, max_tokens: 64, temperature: .7,
    top_p: .8, top_k: 20, stream: true, cache_prompt: true, chat_template_kwargs: { enable_thinking: false } });
  assert.equal(r.engine.status().classification, 'MOCK_ONLY');
});

test('large-batch independent review: complete fragmented native lines on separate streams are accepted', async t => {
  for (const prefix of ['', 'I ', '0.00.003.017 I ']) {
    const emitted = lines.map(s => prefix + s.replace('\n', '\r\n'));
    const r = fakeAdapter(t, child => {
      child.stderr.write(emitted[0].slice(0, 16)); child.stdout.write(emitted[1].slice(0, 12));
      child.stderr.write(emitted[0].slice(16)); child.stdout.write(emitted[1].slice(12));
    });
    await r.engine.start(); const observed = r.engine.status().nativeBatchObservation;
    assert.equal(observed.status, 'CONFIRMED'); assert.equal(observed.logicalBatchTokens, 2048);
    assert.equal(observed.physicalBatchTokens, 512); assert.equal(observed.lines.length, 2);
  }
});

test('large-batch independent review: missing, cross-stream fragments, partial, overlong and lookalike lines cannot supply proof', async t => {
  const writers = [() => {}, child => child.stderr.write(lines[0]),
    child => { child.stderr.write(lines[0]); child.stdout.write(lines[1].trimEnd()); },
    child => { child.stdout.write('llama_context: n_batch'); child.stderr.write('       = 2048\n' + lines[1]); },
    child => child.stderr.write('user: ' + lines[0] + 'user: ' + lines[1]),
    child => child.stderr.write(lines[0].replace('2048', '2048.0') + lines[1]),
    child => child.stderr.write(lines[0].replace('\n', ' extra\n') + lines[1]),
    child => child.stderr.write('\u001b[0m' + lines[0] + lines[1]),
    child => child.stderr.write('x'.repeat(5000) + lines[0] + lines[1])];
  for (const write of writers) {
    const r = fakeAdapter(t, write);
    await assert.rejects(r.engine.start(), /NATIVE_BATCH_OBSERVATION_MISSING/);
    assert.equal(r.engine.status().nativeBatchObservation.status, 'REJECTED');
    assert.equal(r.engine.status().ownedProcessStopped, true); assert.equal(r.calls.requests.length, 0);
    assert.equal(r.calls.health, 1, 'missing evidence is not swallowed and retried by the health exception handler');
    await assert.rejects(r.engine.generate(plan.primer.context), /MODEL_NOT_READY/);
  }
});

test('large-batch independent review: mismatched and repeated native values fail before inference', async t => {
  for (const [text, code] of [[lines[0].replace('2048', '128') + lines[1], 'MISMATCH'],
    [lines[0] + lines[1].replace('512', '64'), 'MISMATCH'], [lines.join('') + lines[0], 'CONFLICT'],
    [lines.join('') + lines[1].replace('512', '64'), 'CONFLICT']]) {
    const r = fakeAdapter(t, child => child.stderr.write(text));
    await assert.rejects(r.engine.start(), new RegExp('NATIVE_BATCH_OBSERVATION_' + code));
    assert.equal(r.engine.status().ownedProcessStopped, true); assert.equal(r.calls.requests.length, 0);
  }
});

test('large-batch independent review: startup proof freezes before generated logs and cannot be mutated by callers', async t => {
  const r = fakeAdapter(t); await r.engine.start(); const initial = r.engine.status().nativeBatchObservation;
  r.calls.children[0].stderr.write(lines[0].replace('2048', '999') + lines[1]);
  assert.deepEqual(r.engine.status().nativeBatchObservation, initial);
  initial.logicalBatchTokens = 1; initial.lines.length = 0;
  assert.equal(r.engine.status().nativeBatchObservation.logicalBatchTokens, 2048);
  assert.equal(r.engine.status().nativeBatchObservation.lines.length, 2);
  await r.engine.generate(plan.primer.context); assert.equal(r.calls.requests.length, 1);
});

test('large-batch independent review: restart clears evidence and cannot inherit old child emissions', async t => {
  const r = fakeAdapter(t, (child, calls) => {
    if (calls.children.length === 1) child.stderr.write(lines.join(''));
    else calls.children[0].stderr.write(lines.join(''));
  });
  await r.engine.start(); await r.engine.stop();
  await assert.rejects(r.engine.start(), /NATIVE_BATCH_OBSERVATION_MISSING/);
  assert.equal(r.calls.spawns.length, 2); assert.equal(r.engine.status().nativeBatchObservation.logicalBatchTokens, null);
  assert.equal(r.engine.status().nativeBatchObservation.physicalBatchTokens, null); assert.equal(r.engine.status().ownedProcessStopped, true);
});

test('large-batch independent review: compact mode has no new instrumentation or evidence dependency', async t => {
  const r = fakeAdapter(t, () => {}, { processingBatch: 'compact' }); await r.engine.start();
  assert.equal(r.calls.spawns[0].args.includes('--log-verbosity'), false);
  assert.equal(Object.hasOwn(r.engine.status(), 'nativeBatchObservation'), false);
  await r.engine.generate(plan.primer.context); assert.equal(r.calls.requests.length, 1);
});

test('large-batch independent review: all twenty-seven messages, evidence and exposure labels match the immutable predecessor', () => {
  assert.equal(plan.predecessor.sha256, 'e0f5c52fd4be5c5d1d9baa91b93145bea567438969fc7791a394472f0d3bacb7');
  for (const [current, old] of [[plan.primer, prior.primer], ...plan.cases.map((c, i) => [c, prior.samples[i]])]) {
    for (const key of ['originalContext', 'context', 'projection', 'messages', 'messageCharacters']) assert.deepEqual(current[key], old[key]);
    assert.deepEqual(current.messages, smollmMessagesFor(current.context, { experimentalStaticPrefix: true }));
  }
  assert.deepEqual(plan.cases.map(c => c.suite), [...Array(2).fill('EXPOSED_TRANSFER'), ...Array(6).fill('UNINVOKED_TRANSFER'),
    ...Array(18).fill('EXPOSED_REGRESSION')]);
  for (const c of plan.cases) for (const criterion of [...c.specification.requiredMeaning, ...c.specification.forbiddenClaims])
    assert.equal(JSON.stringify(c.messages).includes(criterion), false);
});

test('large-batch independent review: runner refuses intended settings without matching native proof and cleans up once', async () => {
  for (const observation of [undefined, { ...confirmed(), status: 'PENDING' }, { ...confirmed(), status: 'REJECTED' },
    { ...confirmed(), source: 'REQUESTED_SETTINGS' }, { ...confirmed(), logicalBatchTokens: 128 },
    { ...confirmed(), physicalBatchTokens: 64 }, { ...confirmed(), logVerbosity: 3 }, { ...confirmed(), error: 'CONFLICT' }]) {
    const r = fakeRunner(observation); if (observation === undefined) {
      const status = r.engine.status; r.engine.status = () => { const s = status(); delete s.nativeBatchObservation; return s; };
    }
    const report = await executeModelTransferDiagnostic(plan, evidence, r.io);
    assert.equal(report.status, 'INCOMPLETE'); assert.equal(report.error, 'NATIVE_BATCH_NOT_CONFIRMED');
    assert.equal(r.calls.generated.length, 0); assert.equal(r.calls.stopped, 1); assert.equal(report.ownedProcessStopped, true);
    assert.equal(report.primer.output, null); assert.equal(report.notPerformed.length, 26);
  }
});

test('large-batch independent review: accepted fake run preserves all limits and does not grant semantic acceptance', async () => {
  const r = fakeRunner(); const report = await executeModelTransferDiagnostic(plan, evidence, r.io);
  assert.deepEqual(r.calls.options, opts); assert.equal(report.classification, 'MOCK_ONLY');
  assert.equal(report.status, 'COMPLETE_PENDING_SEMANTIC_REVIEW'); assert.equal(report.independentSemanticReview, 'NOT_PERFORMED');
  assert.equal(r.calls.generated.length, 27); assert.equal(r.calls.stopped, 1);
  assert.equal(report.primer.configuredBudgetMs, 20000); assert.ok(report.samples.every(s => s.configuredBudgetMs === 10000));
  for (const [key, expected] of Object.entries({ workMs: 233000, cleanupMs: 7000, sampleMs: 250,
    initialRamRequirementBytes: 5 * 1024 ** 3, minimumRamBytes: 2 * 1024 ** 3, workingDiskReserveBytes: 10 * 1024 ** 3 }))
    assert.equal(report.settings[key], expected);
  assert.ok(report.limitations.some(s => s.includes('logging also differs')));
});

test('large-batch independent review: valid native proof cannot relax the fixed runner configuration', async () => {
  for (const alter of [s => { s.threads = 2; }, s => { s.settings.weightRepacking = true; },
    s => { s.settings.promptCaching = false; }, s => { s.settings.processingBatch = 'default'; },
    s => { s.settings.nativeLogVerbosity = 3; }]) {
    const r = fakeRunner(), status = r.engine.status;
    r.engine.status = () => { const s = status(); alter(s); return s; };
    const report = await executeModelTransferDiagnostic(plan, evidence, r.io);
    assert.equal(report.error, 'CONFIGURATION_NOT_CONFIRMED'); assert.equal(r.calls.generated.length, 0);
    assert.equal(report.ownedProcessStopped, true); assert.equal(r.calls.stopped, 1);
  }
});
