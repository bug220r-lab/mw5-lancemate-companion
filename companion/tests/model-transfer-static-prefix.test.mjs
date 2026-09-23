// MOCK_ONLY: the injected engine performs no native inference or network access.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { MODEL_TRANSFER_FIXTURE_SHA256, MODEL_TRANSFER_STATIC_PREFIX_RECEIPT,
  readFrozenModelTransferFixture, readModelTransferStaticPrefixPredecessor,
  prepareModelTransferDiagnostic, executeModelTransferDiagnostic, reserveModelTransferReceipt } from '../../scripts/Exercise-ConversationModelTransfer.mjs';
import { smollmMessagesFor } from '../local-language-model.mjs';

const fixture = readFrozenModelTransferFixture(await readFile(new URL('../../synthetic/conversation-model-transfer-cases.json', import.meta.url)));
const priorBytes = await readFile(new URL('../../research/SMOLLM3_WARMUP_DIAGNOSTIC.json', import.meta.url));
const prior = readModelTransferStaticPrefixPredecessor(priorBytes);
const plan = await prepareModelTransferDiagnostic(['--run-static-prefix-003'], fixture);
const evidence = { fixtureSha256: MODEL_TRANSFER_FIXTURE_SHA256, sources: {}, modelPins: [], runtimePins: [] };
const GiB = 1024 ** 3;
function rig() {
  const calls = { options: [], contexts: [], stops: 0, reserves: 0, closes: 0 };
  let stopped = true, reason = null;
  const settings = { host: '127.0.0.1', contextTokens: 2048, maxOutputTokens: 64, maxOutputChars: 256, gpuLayers: 0,
    processingBatch: 'compact', weightRepacking: false, promptCaching: true, experimentalSpeakerRelativeFacts: true,
    experimentalSpeakerBriefing: true, experimentalSeparateRequest: true, experimentalStaticPrefix: true,
    logicalBatchTokens: 128, physicalBatchTokens: 64, simultaneousModels: 1, thinking: false, webUI: false, mcpProxy: false };
  const engine = { async start() { stopped = false; },
    async generate(context) { calls.contexts.push(structuredClone(context)); reason = 'stop'; return 'Synthetic response.'; },
    async stop() { calls.stops++; stopped = true; },
    status: () => ({ state: stopped ? 'STOPPED' : 'READY', modelId: 'smollm3_3b', threads: 4,
      verification: 'PINNED_FILES_VERIFIED', settings, ownedPid: stopped ? null : 712,
      ownedProcessStopped: stopped, activeGeneration: false, lastGenerationFinishReason: reason,
      lastGenerationTimings: null, log: '' }) };
  const dependencies = { async reserveReceipt() { calls.reserves++; return { async save() {}, async close() { calls.closes++; } }; },
    createEngine(options) { calls.options.push(structuredClone(options)); return engine; },
    availableRam: () => 6 * GiB, availableDisk: async () => 20 * GiB };
  return { calls, engine, dependencies, settings };
}

test('static layout preparation preserves all context and user messages and accurately records prior exposure', () => {
  assert.equal(plan.treatment.initiallyUninvokedCount, 6);
  assert.equal(plan.treatment.previouslyInvokedTransferCount, 2);
  assert.deepEqual(plan.fixture, prior.fixture); assert.deepEqual(plan.regressionFixture, prior.regressionFixture);
  for (const [current, previous] of [[plan.primer, prior.primer], ...plan.cases.map((c, i) => [c, prior.samples[i]])]) {
    for (const k of ['originalContext', 'context', 'projection']) assert.deepEqual(current[k], previous[k]);
    assert.deepEqual(current.messages.slice(1), previous.messages.slice(1));
    assert.notEqual(current.messages[0].content, previous.messages[0].content);
    assert.deepEqual(current.messages, smollmMessagesFor(current.context, { experimentalStaticPrefix: true }));
    assert.equal(current.messageCharacters, previous.messageCharacters + 1);
  }
  assert.deepEqual(plan.cases.map(c => c.specification.id), prior.samples.map(c => c.id));
  assert.deepEqual(plan.cases.slice(0, 2).map(c => c.suite), ['EXPOSED_TRANSFER', 'EXPOSED_TRANSFER']);
  assert.ok(plan.cases.slice(2, 8).every(c => c.suite === 'UNINVOKED_TRANSFER'));
  assert.ok(plan.cases.slice(8).every(c => c.suite === 'EXPOSED_REGRESSION'));
  assert.throws(() => readModelTransferStaticPrefixPredecessor(Buffer.concat([priorBytes, Buffer.from('\n')])), /PREDECESSOR_CHANGED/);
});

test('static layout execution enables only the new model option and preserves fixed native limits', async () => {
  const r = rig(), result = await executeModelTransferDiagnostic(plan, evidence, r.dependencies);
  assert.equal(result.status, 'COMPLETE_PENDING_SEMANTIC_REVIEW'); assert.equal(result.classification, 'MOCK_ONLY');
  assert.equal(r.calls.options.length, 1); assert.equal(r.calls.options[0].experimentalStaticPrefix, true);
  assert.equal(result.settings.primerMs, 20000); assert.equal(result.settings.operationMs, 10000);
  assert.equal(result.settings.workMs, 233000); assert.equal(result.settings.cleanupMs, 7000);
  assert.equal(result.settings.sampleMs, 250); assert.equal(result.settings.initialRamRequirementBytes, 5 * GiB);
  assert.equal(result.settings.minimumRamBytes, 2 * GiB); assert.equal(result.settings.workingDiskReserveBytes, 10 * GiB);
  assert.deepEqual(r.calls.contexts, [plan.primer.context, ...plan.cases.map(c => c.context)]);
  assert.ok(result.samples.every(s => s.semanticReview === 'NOT_PERFORMED' && !s.dispatched && !s.played));
  assert.equal(r.calls.stops, 1); assert.equal(r.calls.closes, 1); assert.equal(result.ownedProcessStopped, true);
});

test('unconfirmed native layout option refuses all generation and shuts down the owned worker', async () => {
  const r = rig(); delete r.settings.experimentalStaticPrefix;
  const result = await executeModelTransferDiagnostic(plan, evidence, r.dependencies);
  assert.equal(result.error, 'CONFIGURATION_NOT_CONFIRMED'); assert.equal(r.calls.contexts.length, 0);
  assert.equal(result.notPerformed.length, 26); assert.equal(result.ownedProcessStopped, true);
});

test('static selector exclusively reserves a separate receipt and refuses preexisting evidence before engine creation', async () => {
  let actual;
  await (await reserveModelTransferReceipt(async (file, flag) => {
    actual = file.replaceAll('\\', '/'); assert.equal(flag, 'wx'); return { async close() {} };
  }, '--run-static-prefix-003')).close();
  assert.ok(actual.endsWith('/' + MODEL_TRANSFER_STATIC_PREFIX_RECEIPT));
  const r = rig(); r.dependencies.reserveReceipt = async () => { throw Object.assign(Error('exists'), { code: 'EEXIST' }); };
  await assert.rejects(executeModelTransferDiagnostic(plan, evidence, r.dependencies), { code: 'EEXIST' });
  assert.equal(r.calls.options.length, 0);
  await assert.rejects(reserveModelTransferReceipt(undefined, '--check-static-prefix-003'), /INVALID_RUN_SELECTOR/);
});

test('mutated inputs, criteria, exposure or path fail before any reservation', async () => {
  const r = rig();
  for (const change of [p => { p.cases[0].messages[1].content = 'omitted facts'; },
    p => { p.cases[0].specification.requiredMeaning = []; }, p => { p.cases[0].suite = 'UNINVOKED_TRANSFER'; },
    p => { p.treatment.receiptPath = 'elsewhere.json'; }, p => { p.predecessor.sha256 = '0'.repeat(64); }]) {
    const changed = structuredClone(plan); change(changed);
    await assert.rejects(executeModelTransferDiagnostic(changed, evidence, r.dependencies), /INVALID_EXECUTION_PLAN/);
  }
  assert.equal(r.calls.reserves, 0);
  for (const args of [['--run-static-prefix-004'], ['--run-static-prefix-003', '--operation-ms=20000']])
    await assert.rejects(prepareModelTransferDiagnostic(args, fixture), /INVALID_ARGUMENTS/);
});

test('a static-layout response deadline cannot reuse primer completion metadata or invoke later cases', async () => {
  const r = rig(), generate = r.engine.generate;
  r.dependencies.budgets = { primerMs: 100, operationMs: 20, workMs: 1000, cleanupMs: 100, sampleMs: 5 };
  r.engine.generate = (context, opts) => {
    if (!r.calls.contexts.length) return generate(context, opts);
    r.calls.contexts.push(context); return new Promise(() => {});
  };
  const result = await executeModelTransferDiagnostic(plan, evidence, r.dependencies);
  assert.equal(result.primer.status, 'TEXT_COMPLETE_DIAGNOSTIC_ONLY');
  assert.equal(result.haltReason, 'RESPONSE_DEADLINE'); assert.equal(result.samples[0].status, 'FAILED');
  assert.equal(result.samples[0].output, null); assert.equal(result.samples[0].finishReason, null);
  assert.equal(result.samples[0].nativeTimings, null); assert.equal(result.notPerformed.length, 25);
  assert.equal(r.calls.contexts.length, 2); assert.equal(r.calls.stops, 1); assert.equal(result.ownedProcessStopped, true);
});
