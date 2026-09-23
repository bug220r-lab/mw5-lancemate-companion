// Independent MOCK_ONLY review of the fixed second attempt. No native workers or file writes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';
import { MODEL_TRANSFER_FIXTURE_SHA256, readFrozenModelTransferFixture, prepareModelTransferDiagnostic,
  reserveModelTransferReceipt, executeModelTransferDiagnostic } from '../../scripts/Exercise-ConversationModelTransfer.mjs';

const fixture = readFrozenModelTransferFixture(await readFile(new URL('../../synthetic/conversation-model-transfer-cases.json', import.meta.url)));
const plan = await prepareModelTransferDiagnostic(['--run-warmup-002'], fixture);
const GiB = 1024 ** 3;
const evidence = { fixtureSha256: MODEL_TRANSFER_FIXTURE_SHA256, sources: {}, modelPins: [], runtimePins: [] };
const settings = { host: '127.0.0.1', contextTokens: 2048, maxOutputTokens: 64, maxOutputChars: 256, gpuLayers: 0,
  processingBatch: 'compact', weightRepacking: false, promptCaching: true, experimentalSpeakerRelativeFacts: true,
  experimentalSpeakerBriefing: true, experimentalSeparateRequest: true, logicalBatchTokens: 128,
  physicalBatchTokens: 64, simultaneousModels: 1, thinking: false, webUI: false, mcpProxy: false };
function rig() {
  let alive = false, finish = null;
  const calls = { reserved: 0, starts: 0, contexts: [], stops: 0, closes: 0 };
  const engine = {
    async start() { calls.starts++; alive = true; },
    async generate(context) { calls.contexts.push(context); finish = 'stop'; return 'Mock ready.'; },
    async stop() { calls.stops++; alive = false; },
    status: () => ({ state: alive ? 'READY' : 'STOPPED', modelId: 'smollm3_3b', threads: 4,
      verification: 'PINNED_FILES_VERIFIED', ownedPid: alive ? 7654 : null, ownedProcessStopped: !alive,
      activeGeneration: false, settings: { ...settings }, log: '', lastGenerationFinishReason: finish,
      lastGenerationTimings: finish ? { predicted_n: 3 } : null })
  };
  const io = {
    async reserveReceipt() { calls.reserved++; return { async save() {}, async close() { calls.closes++; } }; },
    createEngine: () => engine, availableRam: () => 6 * GiB, availableDisk: async () => 20 * GiB,
    budgets: { primerMs: 500, operationMs: 25, workMs: 2000, cleanupMs: 50, sampleMs: 5 }
  };
  return { calls, engine, io };
}

test('warmup review: only attempt metadata changes; all twenty-seven input records equal the first receipt', async () => {
  const prior = JSON.parse(await readFile(new URL('../../research/SMOLLM3_MODEL_TRANSFER_DIAGNOSTIC.json', import.meta.url)));
  const old = await prepareModelTransferDiagnostic(['--run'], fixture);
  assert.equal(plan.cases.length, 26); assert.deepEqual(plan.primer, old.primer);
  for (const key of ['originalContext', 'context', 'projection', 'messages', 'messageCharacters'])
    assert.deepEqual(plan.primer[key], prior.primer[key]);
  for (let i = 0; i < 26; i++) {
    assert.deepEqual(plan.cases[i], old.cases[i]);
    for (const key of ['originalContext', 'context', 'projection', 'capture', 'provenance', 'messages', 'messageCharacters'])
      assert.deepEqual(plan.cases[i][key], prior.samples[i][key]);
  }
  assert.ok(prior.samples.every(s => s.status === 'NOT_PERFORMED' && s.output === null));
  assert.equal(prior.primer.status, 'FAILED'); assert.equal(prior.primer.finishReason, null);
});

test('warmup review: longer primer succeeds without extending the next measured response deadline', async () => {
  const r = rig(), generate = r.engine.generate;
  r.engine.generate = async (context, options) => {
    if (!r.calls.contexts.length) { await sleep(55); return generate(context, options); }
    r.calls.contexts.push(context); return new Promise(() => {});
  };
  const report = await executeModelTransferDiagnostic(plan, evidence, r.io);
  assert.equal(report.primer.status, 'TEXT_COMPLETE_DIAGNOSTIC_ONLY');
  assert.equal(report.primer.configuredBudgetMs, 500); assert.ok(report.primer.elapsedMs > 25);
  assert.equal(report.samples[0].configuredBudgetMs, 25); assert.equal(report.samples[0].status, 'FAILED');
  assert.equal(report.haltReason, 'RESPONSE_DEADLINE'); assert.equal(report.samples[0].output, null);
  assert.equal(report.samples[0].finishReason, null); assert.equal(report.samples[0].nativeTimings, null);
  assert.equal(report.notPerformed.length, 25); assert.equal(r.calls.contexts.length, 2);
  assert.equal(r.calls.stops, 1); assert.equal(r.calls.closes, 1); assert.equal(report.ownedProcessStopped, true);
});

test('warmup review: failed extended primer records its phase and leaves all cases uninvoked', async () => {
  const r = rig(); r.io.budgets.primerMs = 15;
  r.engine.generate = (context, { signal }) => { r.calls.contexts.push({ context, signal }); return new Promise(() => {}); };
  const report = await executeModelTransferDiagnostic(plan, evidence, r.io);
  assert.equal(report.haltReason, 'PRIMER_DEADLINE'); assert.equal(report.primer.status, 'FAILED');
  assert.equal(report.primer.configuredBudgetMs, 15); assert.equal(report.primer.output, null);
  assert.equal(report.primer.finishReason, null); assert.equal(report.primer.nativeTimings, null);
  assert.ok(report.samples.every(s => s.status === 'NOT_PERFORMED' && s.output === null));
  assert.equal(report.notPerformed.length, 26); assert.equal(r.calls.contexts.length, 1);
  assert.equal(r.calls.contexts[0].signal.aborted, true); assert.equal(r.calls.stops, 1);
});

test('warmup review: receipt selector maps only fixed paths and never overwrites the predecessor', async () => {
  const paths = [], reserved = new Set();
  const open = async (file, mode) => {
    assert.equal(mode, 'wx'); const normalized = file.replaceAll('\\', '/'); paths.push(normalized);
    if (reserved.has(normalized)) throw Object.assign(Error('exists'), { code: 'EEXIST' });
    reserved.add(normalized); return { async close() {} };
  };
  await (await reserveModelTransferReceipt(open, '--run')).close();
  await (await reserveModelTransferReceipt(open, '--run-warmup-002')).close();
  assert.ok(paths[0].endsWith('/research/SMOLLM3_MODEL_TRANSFER_DIAGNOSTIC.json'));
  assert.ok(paths[1].endsWith('/research/SMOLLM3_WARMUP_DIAGNOSTIC.json'));
  await assert.rejects(reserveModelTransferReceipt(open, '--run-warmup-002'), { code: 'EEXIST' });
  const before = paths.length;
  await assert.rejects(reserveModelTransferReceipt(open, 'research/arbitrary.json'));
  assert.equal(paths.length, before);
});

test('warmup review: no CLI or forged plan can silently increase a measured-case allowance', async () => {
  for (const args of [['--run-warmup-002', '--response-ms', '20000'], ['--run-warmup-003'], ['--run-warmup-002', '--run']])
    await assert.rejects(prepareModelTransferDiagnostic(args, fixture), /INVALID_ARGUMENTS/);
  const r = rig(); r.io.budgets.operationMs = 10001;
  await assert.rejects(executeModelTransferDiagnostic(plan, evidence, r.io), /INVALID_TEST_BUDGET/);
  assert.equal(r.calls.reserved, 0); assert.equal(r.calls.starts, 0);
  const forged = structuredClone(plan); forged.primer.context.request.text = 'Replace the original primer';
  r.io.budgets.operationMs = 25;
  await assert.rejects(executeModelTransferDiagnostic(forged, evidence, r.io), /INVALID_EXECUTION_PLAN/);
  assert.equal(r.calls.reserved, 0); assert.equal(r.calls.starts, 0);
});
