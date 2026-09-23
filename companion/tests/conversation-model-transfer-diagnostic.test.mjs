// MOCK_ONLY: the model, resource measurements and receipt writes are injected.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';
import { MODEL_TRANSFER_FIXTURE_SHA256, MODEL_TRANSFER_RECEIPT, MODEL_TRANSFER_PREDECESSOR_SHA256,
  readFrozenModelTransferFixture, readModelTransferPredecessor, prepareModelTransferDiagnostic,
  reserveModelTransferReceipt, executeModelTransferDiagnostic, readModelTransferInstallation } from '../../scripts/Exercise-ConversationModelTransfer.mjs';
import { smollmMessagesFor } from '../local-language-model.mjs';

const bytes = await readFile(new URL('../../synthetic/conversation-model-transfer-cases.json', import.meta.url));
const fixture = readFrozenModelTransferFixture(bytes), GiB = 1024 ** 3;
const plan = await prepareModelTransferDiagnostic(['--run'], fixture);
const evidence = { fixtureSha256: MODEL_TRANSFER_FIXTURE_SHA256, sources: { fixture: MODEL_TRANSFER_FIXTURE_SHA256 }, modelPins: [], runtimePins: [] };
const requiredOptions = { modelId: 'smollm3_3b', threads: 4, processingBatch: 'compact', weightRepacking: false,
  promptCaching: true, experimentalSpeakerRelativeFacts: true, experimentalSpeakerBriefing: true, experimentalSeparateRequest: true };
const settings = { host: '127.0.0.1', contextTokens: 2048, maxOutputTokens: 64, maxOutputChars: 256, gpuLayers: 0,
  processingBatch: 'compact', weightRepacking: false, promptCaching: true, experimentalSpeakerRelativeFacts: true,
  experimentalSpeakerBriefing: true, experimentalSeparateRequest: true,
  logicalBatchTokens: 128, physicalBatchTokens: 64, simultaneousModels: 1, thinking: false, webUI: false, mcpProxy: false };
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
function installationBytes() {
  const model = { id: 'smollm3_3b', name: 'SmolLM3-Q4_K_M.gguf', version: '4965cb60b150737b68a0408c36aeefb65078f894',
    bytes: 1915305312, sha256: '8334b850b7bd46238c16b0c550df2138f0889bf433809008cc17a8b05761863e' };
  const setup = { classification: 'LOCAL_COMPONENT_SETUP', status: 'VERIFIED_DOWNLOAD', artifact: { ...model } };
  const setupBytes = Buffer.from(JSON.stringify(setup)), template = 'Synthetic template, never executed.';
  const metadata = { classification: 'OBSERVED_LOCAL_FILE_METADATA_NOT_NATIVE_EXECUTION', nativeExecution: 'NOT_PERFORMED',
    model: { ...model }, version: 3, selected: { 'general.architecture': 'smollm3', 'tokenizer.chat_template': template },
    templateSha256: sha(template), setupReceiptSha256: sha(setupBytes) };
  return { setup, setupBytes, metadata, metadataBytes: Buffer.from(JSON.stringify(metadata)) };
}
function rig() {
  const calls = { reserve: 0, creates: 0, starts: 0, generates: [], stops: 0, closes: 0, saves: [] };
  let exists = false, stopped = true, ram = 6 * GiB, finish = null;
  const setFinish = value => { finish = value; };
  const engine = {
    async start() { calls.starts++; stopped = false; },
    async generate(context, { signal }) {
      calls.generates.push({ context, signal }); setFinish('stop'); return 'We won and completed your order.';
    },
    async stop() { calls.stops++; stopped = true; },
    status: () => ({ state: stopped ? 'STOPPED' : 'READY', modelId: 'smollm3_3b', threads: 4,
      ownedPid: stopped ? null : 7001, ownedProcessStopped: stopped, activeGeneration: false,
      verification: 'PINNED_FILES_VERIFIED', log: '', settings: { ...settings }, lastGenerationFinishReason: finish,
      lastGenerationTimings: finish ? { cache_n: 10, prompt_n: 20, predicted_n: 3, prompt_ms: 1, predicted_ms: 1 } : null })
  };
  const dependencies = {
    async reserveReceipt() {
      calls.reserve++; if (exists) throw Object.assign(Error('exists'), { code: 'EEXIST' }); exists = true;
      return { async save(report) { calls.saves.push(structuredClone(report)); }, async close() { calls.closes++; } };
    },
    createEngine(options) { calls.creates++; assert.deepEqual(options, requiredOptions); return engine; },
    availableRam: () => ram, availableDisk: async () => 20 * GiB,
    budgets: { operationMs: 100, workMs: 3000, cleanupMs: 100, sampleMs: 5 }
  };
  return { calls, engine, dependencies, setRam: value => { ram = value; }, setFinish };
}

test('model transfer preparation is inert, fixed-order, and distinguishes direct fresh contexts from captured regressions', async () => {
  const check = await prepareModelTransferDiagnostic(['--check'], fixture);
  assert.equal(check.action, '--check'); assert.equal(check.cases.length, 26);
  assert.deepEqual(check.cases.slice(0, 8).map(c => c.specification.id), fixture.cases.map(c => c.id));
  assert.ok(check.cases.slice(0, 8).every(c => c.suite === 'FRESH_PREDECLARED_TRANSFER' && c.capture.coordinatorCalls === 0));
  assert.ok(check.cases.slice(8).every(c => c.suite === 'EXPOSED_REGRESSION'));
  assert.equal(check.cases.slice(8).filter(c => c.capture.coordinatorCalls === 1).length, 10);
  for (const [i, c] of check.cases.entries()) {
    if (i < 8) { assert.deepEqual(c.context, fixture.cases[i].context); assert.deepEqual(c.originalContext, c.context); }
    assert.deepEqual(c.messages, smollmMessagesFor(c.context)); assert.equal(c.messages[2].content, c.context.request.text);
    assert.ok(c.messages[0].content.endsWith('\n/no_think')); assert.ok(Object.isFrozen(c.context));
  }
  assert.equal(Object.hasOwn(check.cases[5].context, 'speakerId'), false);
  assert.equal(check.predecessor.sha256, MODEL_TRANSFER_PREDECESSOR_SHA256);
});

test('model transfer criteria and capture placeholders never enter actual message inputs', () => {
  for (const c of plan.cases) {
    const input = JSON.stringify(c.messages);
    for (const criterion of [...c.specification.requiredMeaning, ...c.specification.forbiddenClaims, c.specification.rationale])
      assert.equal(input.includes(criterion), false, c.specification.id);
    assert.equal(input.includes('CAPTURE_ONLY_PLACEHOLDER'), false);
    assert.equal(Object.hasOwn(c.context, 'requiredMeaning'), false);
  }
  assert.deepEqual(plan.primer.context.facts, []); assert.deepEqual(plan.primer.context.history, []);
});

test('model transfer admission binds verified setup to exact model and linked architecture/template metadata', () => {
  const x = installationBytes(), result = readModelTransferInstallation(x.setupBytes, x.metadataBytes);
  assert.equal(result.setup.sha256, sha(x.setupBytes)); assert.equal(result.metadata.sha256, sha(x.metadataBytes));
  assert.equal(result.metadata.architecture, 'smollm3'); assert.equal(result.metadata.templateSha256, x.metadata.templateSha256);
  assert.equal(result.model.id, 'smollm3_3b'); assert.ok(Object.isFrozen(result));
  for (const alter of [s => { s.status = 'DOWNLOADING'; }, s => { s.artifact.sha256 = '0'.repeat(64); },
    s => { s.artifact.id = 'qwen1_7b'; }, s => { s.artifact.bytes++; }, s => { s.artifact.version = 'main'; },
    s => { s.artifact.name = 'Different.gguf'; }]) {
    const s = structuredClone(x.setup); alter(s);
    assert.throws(() => readModelTransferInstallation(Buffer.from(JSON.stringify(s)), x.metadataBytes), /CANDIDATE_SETUP_NOT_VERIFIED/);
  }
  for (const alter of [m => { m.model.sha256 = '0'.repeat(64); }, m => { m.selected['general.architecture'] = 'qwen3'; },
    m => { m.selected['tokenizer.chat_template'] += 'changed'; }, m => { m.selected['tokenizer.chat_template'] = ''; },
    m => { m.setupReceiptSha256 = '0'.repeat(64); }, m => { m.version = 2; }, m => { m.nativeExecution = 'PASS'; }]) {
    const m = structuredClone(x.metadata); alter(m);
    assert.throws(() => readModelTransferInstallation(x.setupBytes, Buffer.from(JSON.stringify(m))), /CANDIDATE_METADATA_NOT_VERIFIED/);
  }
  assert.throws(() => readModelTransferInstallation(Buffer.concat([x.setupBytes, Buffer.from('\n')]), x.metadataBytes), /CANDIDATE_METADATA_NOT_VERIFIED/);
});

test('model transfer preserves the exact predecessor and rejects fixture or runtime-plan tampering before reservation', async () => {
  const priorBytes = await readFile(new URL('../../research/QWEN17B_SEPARATED_REQUEST_DIAGNOSTIC.json', import.meta.url));
  const prior = readModelTransferPredecessor(priorBytes);
  assert.throws(() => readModelTransferPredecessor(Buffer.concat([priorBytes, Buffer.from('\n')])), /TRANSFER_PREDECESSOR_CHANGED/);
  assert.throws(() => readFrozenModelTransferFixture(Buffer.concat([bytes, Buffer.from('\n')])), /FROZEN_TRANSFER_FIXTURE_CHANGED/);
  for (const [i, c] of plan.cases.slice(8).entries())
    for (const key of ['context', 'originalContext', 'projection', 'capture', 'provenance']) assert.deepEqual(c[key], prior.samples[i][key]);
  const r = rig();
  for (const alter of [p => { p.treatment.receiptPath = 'elsewhere'; }, p => { p.cases.reverse(); },
    p => { p.cases[0].messages[2].content = 'Invented question'; }, p => { p.fixture.cases[0].requiredMeaning = ['Relaxed']; },
    p => { p.predecessor.sha256 = '0'.repeat(64); }]) {
    const forged = structuredClone(plan); alter(forged);
    await assert.rejects(executeModelTransferDiagnostic(forged, evidence, r.dependencies));
  }
  assert.equal(r.calls.reserve, 0); assert.equal(r.calls.creates, 0);
});

test('model transfer CLI cannot select arbitrary output, model, retries or budgets', async () => {
  for (const args of [[], ['--run', '--run'], ['--check', '--run'], ['--run-attempt-002'], ['--output', 'x'],
    ['--model', 'qwen1_7b'], ['--run', '--threads', '8'], ['--run', '--deadline', '999999']])
    await assert.rejects(prepareModelTransferDiagnostic(args, fixture), /INVALID_ARGUMENTS/);
  await assert.rejects(executeModelTransferDiagnostic(await prepareModelTransferDiagnostic(['--check'], fixture), evidence, rig().dependencies), /INVALID_EXECUTION_PLAN/);
});

test('model transfer receipt uses exactly one fixed exclusive wx path and cannot overwrite it', async () => {
  let exists = false, opens = 0;
  const openFile = async (file, flags) => {
    opens++; assert.ok(file.replaceAll('\\', '/').endsWith('/' + MODEL_TRANSFER_RECEIPT)); assert.equal(flags, 'wx');
    if (exists) throw Object.assign(Error('exists'), { code: 'EEXIST' }); exists = true; return { async close() {} };
  };
  await (await reserveModelTransferReceipt(openFile)).close();
  await assert.rejects(reserveModelTransferReceipt(openFile), { code: 'EEXIST' }); assert.equal(opens, 2);
  const r = rig(); r.dependencies.reserveReceipt = async () => { throw Object.assign(Error('exists'), { code: 'EEXIST' }); };
  await assert.rejects(executeModelTransferDiagnostic(plan, evidence, r.dependencies), { code: 'EEXIST' });
  assert.equal(r.calls.creates, 0); assert.equal(r.calls.starts, 0);
});

test('model transfer refuses initial RAM or disk loss before constructing a model', async () => {
  for (const [key, value, expected] of [['availableRam', 4 * GiB, 'INITIAL_RAM_INSUFFICIENT'],
    ['availableDisk', 9 * GiB, 'DISK_RESERVE_INSUFFICIENT'], ['availableRam', NaN, 'INITIAL_RAM_INSUFFICIENT']]) {
    const r = rig(); r.dependencies[key] = () => value;
    const report = await executeModelTransferDiagnostic(plan, evidence, r.dependencies);
    assert.equal(report.error, expected); assert.equal(report.classification, 'MOCK_ONLY'); assert.equal(report.notPerformed.length, 26);
    assert.equal(report.primer.status, 'NOT_PERFORMED'); assert.equal(report.finalRuntime.state, 'NOT_STARTED');
    assert.equal(r.calls.creates, 0); assert.equal(r.calls.closes, 1);
  }
});

test('model transfer records free text without giving known-bad mocked answers semantic acceptance', async () => {
  const r = rig(), report = await executeModelTransferDiagnostic(plan, evidence, r.dependencies);
  assert.equal(report.status, 'COMPLETE_PENDING_SEMANTIC_REVIEW'); assert.equal(report.classification, 'MOCK_ONLY');
  assert.equal(report.independentSemanticReview, 'NOT_PERFORMED'); assert.equal(report.gameAcceptance, 'NOT_PERFORMED');
  assert.deepEqual(r.calls.generates.map(c => c.context), [plan.primer.context, ...plan.cases.map(c => c.context)]);
  assert.ok(report.samples.every(s => s.status === 'TEXT_COMPLETE_DIAGNOSTIC_ONLY' && s.semanticReview === 'NOT_PERFORMED' &&
    s.output === 'We won and completed your order.' && s.finishReason === 'stop' && !s.played && !s.dispatched));
  assert.equal(report.notPerformed.length, 0); assert.equal(r.calls.stops, 1); assert.equal(r.calls.closes, 1); assert.equal(report.ownedProcessStopped, true);
  assert.equal(report.settings.modelId, 'smollm3_3b'); assert.equal(report.settings.initialRamRequirementBytes, 5 * GiB);
  await assert.rejects(executeModelTransferDiagnostic(plan, evidence, r.dependencies), { code: 'EEXIST' }); assert.equal(r.calls.creates, 1);
});

test('model transfer stops on truncation with null failed output and confirmed length metadata only', async () => {
  const r = rig(), generate = r.engine.generate;
  r.engine.generate = async (c, o) => {
    if (r.calls.generates.length === 2) { r.calls.generates.push({ context: c, signal: o.signal }); r.setFinish('length'); throw Error('GENERATED_TEXT_TRUNCATED'); }
    return generate(c, o);
  };
  const report = await executeModelTransferDiagnostic(plan, evidence, r.dependencies);
  assert.equal(report.status, 'INCOMPLETE'); assert.equal(report.samples[0].status, 'TEXT_COMPLETE_DIAGNOSTIC_ONLY');
  assert.equal(report.samples[1].status, 'FAILED'); assert.equal(report.samples[1].output, null); assert.equal(report.samples[1].finishReason, 'length');
  assert.ok(report.samples[1].nativeTimings); assert.equal(report.notPerformed.length, 24); assert.equal(r.calls.generates.length, 3);
  assert.equal(r.calls.stops, 1); assert.ok(report.samples.slice(2).every(s => s.status === 'NOT_PERFORMED' && s.output === null));
});

test('model transfer does not borrow stale stop metadata for generic failure or missing completion reason', async () => {
  for (const mode of ['throw', 'no-reason']) {
    const r = rig(), generate = r.engine.generate;
    r.engine.generate = async (c, o) => {
      if (!r.calls.generates.length) return generate(c, o);
      r.calls.generates.push({ context: c, signal: o.signal });
      if (mode === 'throw') throw Error('UNSUPPORTED_GENERATED_PAYLOAD');
      r.setFinish(null); return 'An unconfirmed answer';
    };
    const report = await executeModelTransferDiagnostic(plan, evidence, r.dependencies);
    assert.equal(report.samples[0].status, 'FAILED'); assert.equal(report.samples[0].output, null);
    assert.equal(report.samples[0].finishReason, null); assert.equal(report.samples[0].nativeTimings, null);
    assert.equal(report.notPerformed.length, 25);
  }
});

test('model transfer operation timeout cancels and stops the owned engine without invoking later cases', async () => {
  const r = rig(); r.dependencies.budgets.operationMs = 15;
  r.engine.generate = (context, { signal }) => { r.calls.generates.push({ context, signal }); return new Promise(() => {}); };
  const report = await executeModelTransferDiagnostic(plan, evidence, r.dependencies);
  assert.equal(report.haltReason, 'OPERATION_DEADLINE'); assert.equal(report.primer.status, 'FAILED'); assert.equal(report.primer.output, null);
  assert.equal(report.primer.finishReason, null); assert.equal(report.notPerformed.length, 26);
  assert.equal(r.calls.generates[0].signal.aborted, true); assert.equal(r.calls.stops, 1); assert.equal(report.ownedProcessStopped, true);
});

test('model transfer resource loss during pre-generation checkpoint leaves the case NOT_PERFORMED', async () => {
  const r = rig(), reserve = r.dependencies.reserveReceipt;
  r.dependencies.reserveReceipt = async () => { const receipt = await reserve(); return { ...receipt, async save(report) {
    await receipt.save(report); if (r.calls.saves.length === 4) { r.setRam(GiB); await sleep(10); }
  } }; };
  const report = await executeModelTransferDiagnostic(plan, evidence, r.dependencies);
  assert.equal(report.haltReason, 'RAM_RESERVE_LOST'); assert.equal(report.primer.status, 'TEXT_COMPLETE_DIAGNOSTIC_ONLY');
  assert.equal(report.samples[0].status, 'NOT_PERFORMED'); assert.equal(report.notPerformed.length, 26); assert.equal(r.calls.generates.length, 1);
});

test('model transfer global deadline during checkpoint never labels an uninvoked primer as a failed generation', async () => {
  const r = rig(); r.dependencies.budgets.workMs = 10; const reserve = r.dependencies.reserveReceipt;
  r.dependencies.reserveReceipt = async () => { const receipt = await reserve(); return { ...receipt, async save(report) {
    await receipt.save(report); if (r.calls.saves.length === 2) await sleep(25);
  } }; };
  const report = await executeModelTransferDiagnostic(plan, evidence, r.dependencies);
  assert.equal(report.haltReason, 'GLOBAL_TIME_LIMIT'); assert.equal(report.primer.status, 'NOT_PERFORMED');
  assert.equal(r.calls.generates.length, 0); assert.equal(report.notPerformed.length, 26); assert.equal(r.calls.stops, 1);
});

test('model transfer refuses mismatched effective model or flags before primer generation', async () => {
  for (const mutate of [s => { s.modelId = 'qwen1_7b'; }, s => { s.settings.experimentalSeparateRequest = false; },
    s => { s.settings.gpuLayers = 1; }, s => { s.verification = 'UNKNOWN'; }]) {
    const r = rig(), status = r.engine.status; r.engine.status = () => { const s = status(); mutate(s); return s; };
    const report = await executeModelTransferDiagnostic(plan, evidence, r.dependencies);
    assert.match(report.error, /CONFIGURATION_NOT_CONFIRMED|PINS_NOT_VERIFIED/); assert.equal(r.calls.generates.length, 0);
    assert.equal(report.notPerformed.length, 26); assert.equal(r.calls.stops, 1);
  }
});

test('model transfer reports unconfirmed cleanup rather than success and closes its receipt', async () => {
  const r = rig(); r.dependencies.budgets.cleanupMs = 10;
  r.engine.stop = () => { r.calls.stops++; return new Promise(() => {}); };
  const report = await executeModelTransferDiagnostic(plan, evidence, r.dependencies);
  assert.equal(report.status, 'OWNED_PROCESS_STOP_UNCONFIRMED'); assert.equal(report.stopError, 'CLEANUP_DEADLINE');
  assert.equal(report.ownedProcessStopped, false); assert.equal(r.calls.stops, 1); assert.equal(r.calls.closes, 1);
});

test('model transfer injected test budgets cannot increase native work or resource sampling limits', async () => {
  for (const budgets of [{ operationMs: 10001 }, { workMs: 233001 }, { cleanupMs: 7001 }, { sampleMs: 251 }, { unexpected: 1 }]) {
    const r = rig(); r.dependencies.budgets = budgets;
    await assert.rejects(executeModelTransferDiagnostic(plan, evidence, r.dependencies), /INVALID_TEST_BUDGET/);
    assert.equal(r.calls.reserve, 0); assert.equal(r.calls.creates, 0);
  }
});
