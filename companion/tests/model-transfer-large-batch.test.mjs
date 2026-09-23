// MOCK_ONLY: fixed plan/receipt guards; no native model, file mutation or network.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { MODEL_TRANSFER_FIXTURE_SHA256, MODEL_TRANSFER_LARGE_BATCH_RECEIPT,
  readFrozenModelTransferFixture, readModelTransferLargeBatchPredecessor,
  prepareModelTransferDiagnostic, executeModelTransferDiagnostic, reserveModelTransferReceipt } from '../../scripts/Exercise-ConversationModelTransfer.mjs';

const fixture = readFrozenModelTransferFixture(await readFile(new URL('../../synthetic/conversation-model-transfer-cases.json', import.meta.url)));
const bytes = await readFile(new URL('../../research/SMOLLM3_STATIC_PREFIX_DIAGNOSTIC.json', import.meta.url));
const prior = readModelTransferLargeBatchPredecessor(bytes);
const plan = await prepareModelTransferDiagnostic(['--run-large-batch-004'], fixture);
const evidence = { fixtureSha256: MODEL_TRANSFER_FIXTURE_SHA256, sources: {}, modelPins: [], runtimePins: [] };
const GiB = 1024 ** 3;
function rig() {
  let stopped = true, finish = null, ram = 6 * GiB;
  const calls = { options: null, contexts: [], stops: 0, closes: 0 };
  const observation = { status: 'CONFIRMED', source: 'OWNED_PROCESS_STARTUP_LOG', logicalBatchTokens: 2048,
    physicalBatchTokens: 512, logVerbosity: 4, lines: [], error: null };
  const settings = { host: '127.0.0.1', contextTokens: 2048, maxOutputTokens: 64, maxOutputChars: 256, gpuLayers: 0,
    processingBatch: 'large', weightRepacking: false, promptCaching: true, experimentalSpeakerRelativeFacts: true,
    experimentalSpeakerBriefing: true, experimentalSeparateRequest: true, experimentalStaticPrefix: true,
    logicalBatchTokens: 2048, physicalBatchTokens: 512, nativeLogVerbosity: 4, simultaneousModels: 1,
    thinking: false, webUI: false, mcpProxy: false };
  const engine = { async start() { stopped = false; },
    async generate(context) { calls.contexts.push(context); finish = 'stop'; return 'Synthetic answer.'; },
    async stop() { calls.stops++; stopped = true; },
    status: () => ({ state: stopped ? 'STOPPED' : 'READY', modelId: 'smollm3_3b', threads: 4,
      verification: 'PINNED_FILES_VERIFIED', settings, nativeBatchObservation: observation,
      ownedPid: stopped ? null : 700, ownedProcessStopped: stopped, activeGeneration: false,
      lastGenerationFinishReason: finish, lastGenerationTimings: null, log: '' }) };
  const io = { reserveReceipt: async () => ({ async save() {}, async close() { calls.closes++; } }),
    createEngine: options => { calls.options = options; return engine; }, availableRam: () => ram,
    availableDisk: async () => 20 * GiB };
  return { calls, settings, observation, engine, io, setRam: n => { ram = n; } };
}

test('large-batch preparation preserves every prompt, input, criterion and current exposure from the exact baseline', async () => {
  const check = await prepareModelTransferDiagnostic(['--check-large-batch-004'], fixture);
  assert.equal(check.treatment.receiptPath, MODEL_TRANSFER_LARGE_BATCH_RECEIPT);
  assert.equal(plan.treatment.logicalBatchTokens, 2048); assert.equal(plan.treatment.physicalBatchTokens, 512);
  assert.equal(plan.treatment.nativeBatchConfirmationRequired, true);
  assert.deepEqual(plan.fixture, prior.fixture); assert.deepEqual(plan.regressionFixture, prior.regressionFixture);
  for (const key of ['originalContext', 'context', 'projection', 'messages', 'messageCharacters'])
    assert.deepEqual(plan.primer[key], prior.primer[key]);
  for (const [i, c] of plan.cases.entries()) {
    assert.equal(c.specification.id, prior.samples[i].id);
    for (const key of ['suite', 'originalContext', 'context', 'projection', 'capture', 'provenance', 'messages', 'messageCharacters'])
      assert.deepEqual(c[key], prior.samples[i][key]);
  }
  assert.equal(plan.treatment.initiallyUninvokedCount, 6);
  assert.equal(plan.treatment.previouslyInvokedTransferCount, 2);
  assert.equal(plan.treatment.historicalRegressionCount, 18);
  assert.throws(() => readModelTransferLargeBatchPredecessor(Buffer.concat([bytes, Buffer.from('\n')])), /PREDECESSOR_CHANGED/);
});

test('large-batch execution refuses changed messages, bounds, provenance or destination before reservation', async () => {
  let reserved = 0, constructed = 0;
  const io = { reserveReceipt: async () => { reserved++; }, createEngine: () => { constructed++; } };
  for (const mutate of [p => { p.cases[1].messages[1].content = 'Fewer facts'; },
    p => { p.treatment.physicalBatchTokens = 1024; }, p => { p.cases[0].suite = 'UNINVOKED_TRANSFER'; },
    p => { p.treatment.receiptPath = 'changed.json'; }, p => { p.predecessor.sha256 = '0'.repeat(64); }]) {
    const changed = structuredClone(plan); mutate(changed);
    await assert.rejects(executeModelTransferDiagnostic(changed, evidence, io), /INVALID_EXECUTION_PLAN/);
  }
  assert.equal(reserved, 0); assert.equal(constructed, 0);
  for (const args of [['--run-large-batch-005'], ['--run-large-batch-004', '--batch-size=4096']])
    await assert.rejects(prepareModelTransferDiagnostic(args, fixture), /INVALID_ARGUMENTS/);
});

test('large-batch receipt has one separate exclusive destination and existing evidence prevents worker construction', async () => {
  const opened = new Set();
  const fakeOpen = async (file, flags) => {
    assert.ok(file.replaceAll('\\', '/').endsWith('/' + MODEL_TRANSFER_LARGE_BATCH_RECEIPT)); assert.equal(flags, 'wx');
    if (opened.has(file)) throw Object.assign(Error('already exists'), { code: 'EEXIST' });
    opened.add(file); return { async close() {} };
  };
  await (await reserveModelTransferReceipt(fakeOpen, '--run-large-batch-004')).close();
  await assert.rejects(reserveModelTransferReceipt(fakeOpen, '--run-large-batch-004'), { code: 'EEXIST' });
  let constructed = 0;
  await assert.rejects(executeModelTransferDiagnostic(plan, evidence, {
    reserveReceipt: async () => { throw Object.assign(Error('already exists'), { code: 'EEXIST' }); },
    createEngine: () => { constructed++; }
  }), { code: 'EEXIST' });
  assert.equal(constructed, 0);
});

test('large-batch confirmed native settings permit exact unchanged inputs under original operational limits', async () => {
  const r = rig(), result = await executeModelTransferDiagnostic(plan, evidence, r.io);
  assert.equal(result.classification, 'MOCK_ONLY'); assert.equal(result.status, 'COMPLETE_PENDING_SEMANTIC_REVIEW');
  assert.equal(r.calls.options.processingBatch, 'large'); assert.equal(r.calls.options.weightRepacking, false);
  assert.equal(r.calls.options.threads, 4); assert.equal(r.calls.options.experimentalStaticPrefix, true);
  assert.equal(result.settings.logicalBatchTokens, 2048); assert.equal(result.settings.physicalBatchTokens, 512);
  assert.equal(result.settings.nativeLogVerbosity, 4); assert.equal(result.treatment.isolatedTimingComparison, false);
  for (const [key, value] of Object.entries({ primerMs: 20000, operationMs: 10000, workMs: 233000, cleanupMs: 7000,
    sampleMs: 250, initialRamRequirementBytes: 5 * GiB, minimumRamBytes: 2 * GiB, workingDiskReserveBytes: 10 * GiB }))
    assert.equal(result.settings[key], value);
  assert.deepEqual(r.calls.contexts, [plan.primer.context, ...plan.cases.map(c => c.context)]);
  assert.ok(result.samples.every(s => !s.dispatched && !s.played && s.semanticReview === 'NOT_PERFORMED'));
  assert.equal(result.ownedProcessStopped, true); assert.equal(r.calls.stops, 1); assert.equal(r.calls.closes, 1);
});

test('requested batch sizes alone never admit generation without current native confirmation', async () => {
  for (const mutate of [r => { const status = r.engine.status; r.engine.status = () => ({ ...status(), nativeBatchObservation: undefined }); },
    r => { r.observation.status = 'PENDING'; }, r => { r.observation.status = 'REJECTED'; },
    r => { r.observation.source = 'REQUESTED_SETTINGS'; }, r => { r.observation.logicalBatchTokens = 128; },
    r => { r.observation.physicalBatchTokens = 64; }, r => { r.observation.logVerbosity = 3; },
    r => { r.observation.error = 'NATIVE_BATCH_OBSERVATION_CONFLICT'; }]) {
    const r = rig(); mutate(r);
    const result = await executeModelTransferDiagnostic(plan, evidence, r.io);
    assert.equal(result.error, 'NATIVE_BATCH_NOT_CONFIRMED'); assert.equal(r.calls.contexts.length, 0);
    assert.equal(result.notPerformed.length, 26); assert.equal(result.ownedProcessStopped, true); assert.equal(r.calls.stops, 1);
  }
});

test('memory growth under larger batches cancels the first operation and preserves all evaluated cases as unperformed', async () => {
  const r = rig(); r.io.budgets = { primerMs: 100, operationMs: 50, workMs: 1000, cleanupMs: 100, sampleMs: 2 };
  r.engine.generate = context => { r.calls.contexts.push(context); r.setRam(GiB); return new Promise(() => {}); };
  const result = await executeModelTransferDiagnostic(plan, evidence, r.io);
  assert.equal(result.status, 'INCOMPLETE'); assert.equal(result.haltReason, 'RAM_RESERVE_LOST');
  assert.equal(result.primer.output, null); assert.equal(result.primer.finishReason, null);
  assert.equal(result.notPerformed.length, 26); assert.equal(r.calls.contexts.length, 1);
  assert.equal(result.ownedProcessStopped, true); assert.equal(r.calls.stops, 1);
});
