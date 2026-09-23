// MOCK_ONLY: timer/resource/receipt experiments use an inert injected engine.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';
import { MODEL_TRANSFER_FIXTURE_SHA256, MODEL_TRANSFER_RECEIPT, MODEL_TRANSFER_WARMUP_RECEIPT,
  MODEL_TRANSFER_WARMUP_PREDECESSOR_SHA256, readFrozenModelTransferFixture, readModelTransferWarmupPredecessor,
  prepareModelTransferDiagnostic, reserveModelTransferReceipt, executeModelTransferDiagnostic } from '../../scripts/Exercise-ConversationModelTransfer.mjs';

const fixture = readFrozenModelTransferFixture(await readFile(new URL('../../synthetic/conversation-model-transfer-cases.json', import.meta.url)));
const previousBytes = await readFile(new URL('../../research/SMOLLM3_MODEL_TRANSFER_DIAGNOSTIC.json', import.meta.url));
const previous = readModelTransferWarmupPredecessor(previousBytes);
const plan = await prepareModelTransferDiagnostic(['--run-warmup-002'], fixture), GiB = 1024 ** 3;
const evidence = { fixtureSha256: MODEL_TRANSFER_FIXTURE_SHA256, sources: {}, modelPins: [], runtimePins: [] };
function rig() {
  const calls = { creates: 0, contexts: [], signals: [], stops: 0, closes: 0, reserves: 0 };
  let stopped = true, reason = null, ram = 6 * GiB;
  const settings = { host: '127.0.0.1', contextTokens: 2048, maxOutputTokens: 64, maxOutputChars: 256, gpuLayers: 0,
    processingBatch: 'compact', weightRepacking: false, promptCaching: true, experimentalSpeakerRelativeFacts: true,
    experimentalSpeakerBriefing: true, experimentalSeparateRequest: true, logicalBatchTokens: 128,
    physicalBatchTokens: 64, simultaneousModels: 1, thinking: false, webUI: false, mcpProxy: false };
  const engine = { async start() { stopped = false; },
    async generate(c, { signal }) { calls.contexts.push(c); calls.signals.push(signal); reason = 'stop'; return 'Synthetic free text.'; },
    async stop() { calls.stops++; stopped = true; },
    status: () => ({ state: stopped ? 'STOPPED' : 'READY', modelId: 'smollm3_3b', threads: 4,
      verification: 'PINNED_FILES_VERIFIED', settings, ownedPid: stopped ? null : 711, ownedProcessStopped: stopped,
      activeGeneration: false, lastGenerationFinishReason: reason, lastGenerationTimings: null, log: '' }) };
  const dependencies = { async reserveReceipt() { calls.reserves++; return { async save() {}, async close() { calls.closes++; } }; },
    createEngine(options) { calls.creates++; assert.equal(options.modelId, 'smollm3_3b'); return engine; },
    availableRam: () => ram, availableDisk: async () => 20 * GiB,
    budgets: { primerMs: 25, operationMs: 10, workMs: 1000, cleanupMs: 25, sampleMs: 2 } };
  return { calls, engine, dependencies, setRam: n => { ram = n; } };
}

test('warmup alternate is inert and preserves all original inputs, messages, fixtures and source provenance', async () => {
  const check = await prepareModelTransferDiagnostic(['--check-warmup-002'], fixture);
  assert.equal(check.treatment.receiptPath, MODEL_TRANSFER_WARMUP_RECEIPT);
  assert.equal(check.treatment.primerMs, 20000); assert.equal(check.treatment.responseMs, 10000);
  assert.deepEqual(check.fixture, previous.fixture); assert.deepEqual(check.regressionFixture, previous.regressionFixture);
  assert.equal(check.predecessor.path, MODEL_TRANSFER_RECEIPT); assert.equal(check.predecessor.sha256, MODEL_TRANSFER_WARMUP_PREDECESSOR_SHA256);
  assert.equal(check.predecessor.runnerSource.sha256, previous.sources['scripts/Exercise-ConversationModelTransfer.mjs']);
  assert.equal(check.predecessor.runnerSource.gitCommit, 'afb5c7c1cc5f9552622e8f3770363098f39d71cd');
  for (const key of ['originalContext', 'context', 'projection', 'messages', 'messageCharacters']) assert.deepEqual(check.primer[key], previous.primer[key]);
  for (const [i, c] of check.cases.entries()) {
    assert.equal(c.specification.id, previous.samples[i].id);
    for (const key of ['suite', 'originalContext', 'context', 'projection', 'capture', 'provenance', 'messages', 'messageCharacters'])
      assert.deepEqual(c[key], previous.samples[i][key]);
  }
  assert.equal(check.cases.filter(c => c.suite === 'FRESH_PREDECLARED_TRANSFER').length, 8);
  assert.equal(check.cases.filter(c => c.suite === 'EXPOSED_REGRESSION').length, 18);
  assert.throws(() => readModelTransferWarmupPredecessor(Buffer.concat([previousBytes, Buffer.from('\n')])), /WARMUP_PREDECESSOR_CHANGED/);
});

test('warmup receipt uses a distinct fixed wx destination and invalid selectors cannot select a path', async () => {
  const opened = new Set(), paths = [];
  const fakeOpen = async (file, flags) => {
    assert.equal(flags, 'wx'); paths.push(file.replaceAll('\\', '/'));
    if (opened.has(file)) throw Object.assign(Error('already exists'), { code: 'EEXIST' });
    opened.add(file); return { async close() {} };
  };
  await (await reserveModelTransferReceipt(fakeOpen)).close();
  await (await reserveModelTransferReceipt(fakeOpen, '--run-warmup-002')).close();
  assert.ok(paths[0].endsWith('/' + MODEL_TRANSFER_RECEIPT)); assert.ok(paths[1].endsWith('/' + MODEL_TRANSFER_WARMUP_RECEIPT));
  await assert.rejects(reserveModelTransferReceipt(fakeOpen, '--run-warmup-002'), { code: 'EEXIST' });
  for (const selector of ['--run-warmup-003', '--check-warmup-002', '../elsewhere.json'])
    await assert.rejects(reserveModelTransferReceipt(fakeOpen, selector), /INVALID_RUN_SELECTOR/);
  for (const args of [['--run-warmup-002', '--run'], ['--run-warmup-003'], ['--run-warmup-002', '--primer-ms=30000']])
    await assert.rejects(prepareModelTransferDiagnostic(args, fixture), /INVALID_ARGUMENTS/);
  const r = rig(); r.dependencies.reserveReceipt = async () => { throw Object.assign(Error('already exists'), { code: 'EEXIST' }); };
  await assert.rejects(executeModelTransferDiagnostic(plan, evidence, r.dependencies), { code: 'EEXIST' }); assert.equal(r.calls.creates, 0);
});

test('warmup effective settings retain fixed native bounds and reject any enlarged injected deadline', async () => {
  for (const [action, expectedPrimer] of [['--run', 10000], ['--run-warmup-002', 20000]]) {
    const r = rig(); delete r.dependencies.budgets;
    const result = await executeModelTransferDiagnostic(await prepareModelTransferDiagnostic([action], fixture), evidence, r.dependencies);
    assert.equal(result.settings.primerMs, expectedPrimer); assert.equal(result.primer.configuredBudgetMs, expectedPrimer);
    assert.equal(result.settings.operationMs, 10000); assert.ok(result.samples.every(s => s.configuredBudgetMs === 10000));
    assert.equal(result.settings.workMs, 233000); assert.equal(result.settings.cleanupMs, 7000); assert.equal(result.settings.sampleMs, 250);
    assert.equal(result.settings.initialRamRequirementBytes, 5 * GiB); assert.equal(result.settings.minimumRamBytes, 2 * GiB);
    assert.equal(result.settings.workingDiskReserveBytes, 10 * GiB); assert.equal(result.classification, 'MOCK_ONLY');
  }
  for (const budgets of [{ primerMs: 20001 }, { operationMs: 10001 }, { workMs: 233001 }, { cleanupMs: 7001 }]) {
    const r = rig(); r.dependencies.budgets = budgets;
    await assert.rejects(executeModelTransferDiagnostic(plan, evidence, r.dependencies), /INVALID_TEST_BUDGET/);
    assert.equal(r.calls.reserves, 0);
  }
});

test('warmup 25ms primer may exceed the separate 10ms response deadline but the first slow response fails', async () => {
  const r = rig(), generate = r.engine.generate;
  r.engine.generate = async (context, options) => {
    if (!r.calls.contexts.length) { await sleep(14); return generate(context, options); }
    r.calls.contexts.push(context); r.calls.signals.push(options.signal); return new Promise(() => {});
  };
  const result = await executeModelTransferDiagnostic(plan, evidence, r.dependencies);
  assert.equal(result.primer.status, 'TEXT_COMPLETE_DIAGNOSTIC_ONLY'); assert.equal(result.primer.configuredBudgetMs, 25);
  assert.ok(result.primer.elapsedMs >= 10); assert.equal(result.samples[0].configuredBudgetMs, 10);
  assert.equal(result.haltReason, 'RESPONSE_DEADLINE'); assert.equal(result.samples[0].status, 'FAILED');
  assert.equal(result.samples[0].output, null); assert.equal(result.samples[0].finishReason, null);
  assert.equal(result.notPerformed.length, 25); assert.equal(r.calls.contexts.length, 2); assert.equal(r.calls.stops, 1);
});

test('a completed primer timer cannot abort an independently timed later response', async () => {
  const r = rig(), generate = r.engine.generate; r.dependencies.budgets.operationMs = 100;
  r.engine.generate = async (context, options) => {
    if (r.calls.contexts.length === 1) {
      const primerSignal = r.calls.signals[0];
      if (!primerSignal.aborted) await new Promise(resolve => primerSignal.addEventListener('abort', resolve, { once: true }));
      assert.equal(options.signal.aborted, false);
    }
    return generate(context, options);
  };
  const result = await executeModelTransferDiagnostic(plan, evidence, r.dependencies);
  assert.equal(result.status, 'COMPLETE_PENDING_SEMANTIC_REVIEW'); assert.equal(result.haltReason, null);
  assert.equal(result.samples.length, 26); assert.equal(result.notPerformed.length, 0); assert.equal(r.calls.contexts.length, 27);
  assert.ok(result.samples.every(s => s.semanticReview === 'NOT_PERFORMED'));
});

test('a warmup timeout leaves every evaluation case uninvoked and retains no completion metadata', async () => {
  const r = rig(); r.engine.generate = (context, { signal }) => {
    r.calls.contexts.push(context); r.calls.signals.push(signal); return new Promise(() => {});
  };
  const result = await executeModelTransferDiagnostic(plan, evidence, r.dependencies);
  assert.equal(result.haltReason, 'PRIMER_DEADLINE'); assert.equal(result.primer.status, 'FAILED');
  assert.equal(result.primer.output, null); assert.equal(result.primer.finishReason, null); assert.equal(result.primer.nativeTimings, null);
  assert.equal(result.notPerformed.length, 26); assert.equal(r.calls.contexts.length, 1); assert.equal(r.calls.stops, 1);
  assert.equal(result.ownedProcessStopped, true); assert.equal(r.calls.closes, 1);
});

test('warmup keeps resource and cleanup failure accounting rather than promoting a longer timer to success', async () => {
  const r = rig(); r.dependencies.budgets.primerMs = 100;
  r.engine.generate = (context, { signal }) => { r.calls.contexts.push(context); r.calls.signals.push(signal); r.setRam(GiB); return new Promise(() => {}); };
  r.engine.stop = async () => { r.calls.stops++; throw Error('STOP_NOT_CONFIRMED'); };
  const result = await executeModelTransferDiagnostic(plan, evidence, r.dependencies);
  assert.equal(result.haltReason, 'RAM_RESERVE_LOST'); assert.equal(result.status, 'OWNED_PROCESS_STOP_UNCONFIRMED');
  assert.equal(result.stopError, 'STOP_NOT_CONFIRMED'); assert.equal(result.primer.output, null);
  assert.equal(result.notPerformed.length, 26); assert.equal(r.calls.closes, 1); assert.equal(r.calls.stops, 1);
});

test('warmup plan and predecessor cannot be redirected or changed between preparation and reservation', async () => {
  const r = rig();
  for (const mutate of [p => { p.treatment.receiptPath = MODEL_TRANSFER_RECEIPT; }, p => { p.treatment.primerMs = 30000; },
    p => { p.predecessor.sha256 = '0'.repeat(64); }, p => { p.primer.messages[2].content = 'Different'; },
    p => { p.cases.reverse(); }, p => { p.action = '--run'; }]) {
    const modified = structuredClone(plan); mutate(modified);
    await assert.rejects(executeModelTransferDiagnostic(modified, evidence, r.dependencies), /INVALID_EXECUTION_PLAN/);
  }
  assert.equal(r.calls.reserves, 0); assert.equal(r.calls.creates, 0);
});
