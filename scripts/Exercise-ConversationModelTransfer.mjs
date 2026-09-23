// Explicit candidate diagnostic; import and --check start no worker or receipt.
// Supervisor logic adapted from Exercise-ConversationRelativeFacts.mjs without editing it.
import { readFile, open, statfs } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createLocalLanguageModel, smollmMessagesFor } from '../companion/local-language-model.mjs';
import { projectSpeakerObservations } from '../companion/speaker-observations.mjs';
import { prepareRelativeFactsDiagnostic, readFrozenRelativeFactsFixture } from './Exercise-ConversationRelativeFacts.mjs';
import { waitForStartup } from './Exercise-ConversationGrounding.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GiB = 1024 ** 3;
export const MODEL_TRANSFER_FIXTURE = 'synthetic/conversation-model-transfer-cases.json';
export const MODEL_TRANSFER_FIXTURE_SHA256 = '4f042b99c4ea8690425c7476347088cb31e5aca3fe45a4ba5ef1b966ebd5e0dd';
export const MODEL_TRANSFER_RECEIPT = 'research/SMOLLM3_MODEL_TRANSFER_DIAGNOSTIC.json';
export const MODEL_TRANSFER_PREDECESSOR = 'research/QWEN17B_SEPARATED_REQUEST_DIAGNOSTIC.json';
export const MODEL_TRANSFER_PREDECESSOR_SHA256 = 'b76aee167224bcd9cfd199ece83bd2a07ef02ec71cd60445c2df41a1712ec5ea';
export const MODEL_TRANSFER_WARMUP_RECEIPT = 'research/SMOLLM3_WARMUP_DIAGNOSTIC.json';
export const MODEL_TRANSFER_WARMUP_PREDECESSOR_SHA256 = 'ffd7341cf63f55d4994c3ddecc06eba5421f1c19e014c2365d0236928f5959ff';
const oldRunnerSha256 = 'fd3ae7557d85ee733244c6759a178c2595791283ae4ce55e73e36103592de663';
const oldRunnerCommit = 'afb5c7c1cc5f9552622e8f3770363098f39d71cd';
const setupPath = 'research/SMOLLM3_SETUP.json', metadataPath = 'research/SMOLLM3_METADATA.json';
const candidate = Object.freeze({ id: 'smollm3_3b', name: 'SmolLM3-Q4_K_M.gguf',
  version: '4965cb60b150737b68a0408c36aeefb65078f894', bytes: 1915305312,
  sha256: '8334b850b7bd46238c16b0c550df2138f0889bf433809008cc17a8b05761863e' });
const regressionFixture = 'synthetic/conversation-relative-facts-cases.json';
const options = Object.freeze({ modelId: 'smollm3_3b', threads: 4, processingBatch: 'compact', weightRepacking: false,
  promptCaching: true, experimentalSpeakerRelativeFacts: true, experimentalSpeakerBriefing: true, experimentalSeparateRequest: true });
const budgets = Object.freeze({ operationMs: 10000, workMs: 233000, cleanupMs: 7000, sampleMs: 250 });
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const freeze = x => { if (x && typeof x === 'object') { Object.values(x).forEach(freeze); Object.freeze(x); } return x; };
const isWarmup = action => action === '--run-warmup-002' || action === '--check-warmup-002';
function receiptPathFor(action) {
  if (action === '--run') return MODEL_TRANSFER_RECEIPT;
  if (action === '--run-warmup-002') return MODEL_TRANSFER_WARMUP_RECEIPT;
  throw Error('INVALID_RUN_SELECTOR');
}

export function readFrozenModelTransferFixture(bytes) {
  if (hash(bytes) !== MODEL_TRANSFER_FIXTURE_SHA256) throw Error('FROZEN_TRANSFER_FIXTURE_CHANGED');
  return JSON.parse(bytes.toString('utf8'));
}
export function readModelTransferPredecessor(bytes) {
  if (hash(bytes) !== MODEL_TRANSFER_PREDECESSOR_SHA256) throw Error('TRANSFER_PREDECESSOR_CHANGED');
  const prior = JSON.parse(bytes.toString('utf8'));
  if (prior.status !== 'INCOMPLETE' || prior.settings.modelId !== 'qwen1_7b' || prior.samples.length !== 18 ||
      prior.primer.status !== 'TEXT_COMPLETE_DIAGNOSTIC_ONLY' || prior.samples[9].error !== 'GENERATED_TEXT_TRUNCATED' ||
      prior.samples[9].output !== null || prior.samples[9].finishReason !== 'length' ||
      !prior.ownedProcessStopped || prior.finalRuntime.state !== 'STOPPED' || prior.finalRuntime.ownedPid !== null ||
      prior.finalRuntime.activeGeneration !== false) throw Error('TRANSFER_PREDECESSOR_NOT_STOPPED');
  return prior;
}
export function readModelTransferWarmupPredecessor(bytes) {
  if (hash(bytes) !== MODEL_TRANSFER_WARMUP_PREDECESSOR_SHA256) throw Error('WARMUP_PREDECESSOR_CHANGED');
  const prior = JSON.parse(bytes.toString('utf8'));
  if (prior.status !== 'INCOMPLETE' || prior.settings.modelId !== options.modelId || prior.runtime.state !== 'READY' ||
      prior.runtime.verification !== 'PINNED_FILES_VERIFIED' || prior.primer.status !== 'FAILED' ||
      prior.primer.output !== null || prior.primer.finishReason !== null || prior.haltReason !== 'OPERATION_DEADLINE' ||
      prior.samples.length !== 26 || prior.samples.some(s => s.status !== 'NOT_PERFORMED' || s.output !== null || s.finishReason !== null) ||
      !isDeepStrictEqual(prior.notPerformed, prior.samples.map(s => s.id)) || !prior.ownedProcessStopped ||
      prior.finalRuntime.state !== 'STOPPED' || prior.finalRuntime.ownedPid !== null || prior.finalRuntime.activeGeneration !== false ||
      prior.sources['scripts/Exercise-ConversationModelTransfer.mjs'] !== oldRunnerSha256)
    throw Error('WARMUP_PREDECESSOR_NOT_ELIGIBLE');
  return prior;
}
export function readModelTransferInstallation(setupBytes, metadataBytes) {
  const setup = JSON.parse(setupBytes.toString('utf8')), metadata = JSON.parse(metadataBytes.toString('utf8'));
  const matches = value => Object.entries(candidate).every(([key, expected]) => value?.[key] === expected);
  if (setup.status !== 'VERIFIED_DOWNLOAD' || setup.classification !== 'LOCAL_COMPONENT_SETUP' || !matches(setup.artifact))
    throw Error('CANDIDATE_SETUP_NOT_VERIFIED');
  const template = metadata.selected?.['tokenizer.chat_template'];
  if (metadata.classification !== 'OBSERVED_LOCAL_FILE_METADATA_NOT_NATIVE_EXECUTION' ||
      metadata.nativeExecution !== 'NOT_PERFORMED' || !matches(metadata.model) || metadata.version !== 3 ||
      metadata.selected?.['general.architecture'] !== 'smollm3' || typeof template !== 'string' || !template.trim() ||
      metadata.templateSha256 !== hash(template) || metadata.setupReceiptSha256 !== hash(setupBytes))
    throw Error('CANDIDATE_METADATA_NOT_VERIFIED');
  return freeze({ setup: { path: setupPath, sha256: hash(setupBytes), status: setup.status },
    metadata: { path: metadataPath, sha256: hash(metadataBytes), architecture: 'smollm3', ggufVersion: metadata.version,
      templateSha256: metadata.templateSha256 }, model: { ...candidate },
    meaning: 'Verified installation and metadata receipts; not native template or model acceptance.' });
}
async function readInstallation() {
  return readModelTransferInstallation(await readFile(path.join(root, setupPath)), await readFile(path.join(root, metadataPath)));
}
function inputRecord(originalContext, context) {
  const projection = projectSpeakerObservations({ schemaVersion: 1, classification: context.classification,
    speakerId: context.speakerId ?? null, facts: context.facts });
  const messages = smollmMessagesFor(context);
  return { originalContext: structuredClone(originalContext), context: structuredClone(context), projection, messages,
    messageCharacters: messages.reduce((n, m) => n + m.content.length, 0) };
}

export async function prepareModelTransferDiagnostic(args, fixture) {
  if (!Array.isArray(args) || args.length !== 1 || !['--check', '--run', '--check-warmup-002', '--run-warmup-002'].includes(args[0])) throw Error('INVALID_ARGUMENTS');
  const frozen = readFrozenModelTransferFixture(await readFile(path.join(root, MODEL_TRANSFER_FIXTURE)));
  if (!isDeepStrictEqual(fixture, frozen)) throw Error('FROZEN_TRANSFER_FIXTURE_CHANGED');
  const prior = readModelTransferPredecessor(await readFile(path.join(root, MODEL_TRANSFER_PREDECESSOR)));
  for (const source of frozen.preservedEvidence) {
    if (hash(await readFile(path.join(root, source.path))) !== source.sha256) throw Error('PRESERVED_EVIDENCE_CHANGED');
  }
  const old = await prepareRelativeFactsDiagnostic(['--run-separated-request-qwen17b'],
    readFrozenRelativeFactsFixture(await readFile(path.join(root, regressionFixture))));
  if (frozen.cases.length !== 8 || old.cases.length !== 18) throw Error('INVALID_CASE_COUNTS');
  const cases = frozen.cases.map(c => ({ suite: 'FRESH_PREDECLARED_TRANSFER', specification: structuredClone(c),
    provenance: { kind: 'NEW_PREDECLARED_HOLDOUT', source: MODEL_TRANSFER_FIXTURE, fixtureSha256: MODEL_TRANSFER_FIXTURE_SHA256 },
    capture: { mode: 'DIRECT_SYNTHETIC_ADAPTER_CONTEXT', coordinatorCalls: 0, bindingAuthority: 'SYNTHETIC_INPUT_ONLY',
      addedContextFields: [], otherContextFieldsUnchanged: true }, ...inputRecord(c.context, c.context) }));
  for (const [i, c] of old.cases.entries()) {
    for (const key of ['originalContext', 'context', 'projection', 'capture', 'provenance'])
      if (!isDeepStrictEqual(c[key], prior.samples[i][key])) throw Error('REGRESSION_CONTEXT_CHANGED');
    cases.push({ suite: 'EXPOSED_REGRESSION', specification: c.specification, provenance: c.provenance,
      capture: c.capture, ...inputRecord(c.originalContext, c.context) });
  }
  if (new Set(cases.map(c => c.specification.id)).size !== 26) throw Error('DUPLICATE_CASE_ID');
  for (const key of ['originalContext', 'context', 'projection'])
    if (!isDeepStrictEqual(old.primer[key], prior.primer[key])) throw Error('REGRESSION_PRIMER_CHANGED');
  const plan = { action: args[0], fixture: structuredClone(frozen), regressionFixture: old.fixture,
    predecessor: { path: MODEL_TRANSFER_PREDECESSOR, sha256: MODEL_TRANSFER_PREDECESSOR_SHA256 },
    treatment: { id: 'SMOLLM3_MODEL_TRANSFER_V1', modelId: options.modelId,
      changes: 'MODEL_FAMILY_AND_REQUIRED_NONTHINKING_TEMPLATE_CONTROLS', isolatedModelOnlyComparison: false,
      receiptPath: MODEL_TRANSFER_RECEIPT, freshCount: 8, exposedCount: 18, order: 'FRESH_8_THEN_EXPOSED_18',
      exposure: 'Fresh cases become exposed after their first model invocation; uninvoked cases remain NOT_PERFORMED.' },
    primer: inputRecord(old.primer.originalContext, old.primer.context), cases };
  if (isWarmup(args[0])) {
    const previous = readModelTransferWarmupPredecessor(await readFile(path.join(root, MODEL_TRANSFER_RECEIPT)));
    for (const key of ['fixture', 'regressionFixture'])
      if (!isDeepStrictEqual(plan[key], previous[key])) throw Error('WARMUP_INPUT_CHANGED');
    for (const key of ['originalContext', 'context', 'projection', 'messages', 'messageCharacters'])
      if (!isDeepStrictEqual(plan.primer[key], previous.primer[key])) throw Error('WARMUP_INPUT_CHANGED');
    for (const [i, c] of cases.entries()) {
      if (c.specification.id !== previous.samples[i].id) throw Error('WARMUP_INPUT_CHANGED');
      for (const key of ['suite', 'originalContext', 'context', 'projection', 'capture', 'provenance', 'messages', 'messageCharacters'])
        if (!isDeepStrictEqual(c[key], previous.samples[i][key])) throw Error('WARMUP_INPUT_CHANGED');
    }
    plan.predecessor = { path: MODEL_TRANSFER_RECEIPT, sha256: MODEL_TRANSFER_WARMUP_PREDECESSOR_SHA256,
      runnerSource: { path: 'scripts/Exercise-ConversationModelTransfer.mjs', sha256: oldRunnerSha256, gitCommit: oldRunnerCommit } };
    plan.treatment = { ...plan.treatment, id: 'SMOLLM3_WARMUP_002', receiptPath: MODEL_TRANSFER_WARMUP_RECEIPT,
      changes: 'PRIMER_DEADLINE_ONLY_10000_TO_20000', primerMs: 20000, responseMs: 10000 };
  }
  return freeze(plan);
}

export async function reserveModelTransferReceipt(openFile = open, action = '--run') {
  const handle = await openFile(path.join(root, receiptPathFor(action)), 'wx');
  return { async save(report) {
    const bytes = Buffer.from(JSON.stringify(report, null, 2) + '\n');
    for (let offset = 0; offset < bytes.length;) {
      const written = await handle.write(bytes, offset, bytes.length - offset, offset);
      if (written.bytesWritten < 1) throw Error('RECEIPT_WRITE_FAILED'); offset += written.bytesWritten;
    }
    await handle.truncate(bytes.length); await handle.sync();
  }, close: () => handle.close() };
}

// Code-only test dependencies produce MOCK_ONLY receipts, never native evidence.
export async function executeModelTransferDiagnostic(plan, evidence, testDependencies = null) {
  if (!['--run', '--run-warmup-002'].includes(plan?.action) || evidence?.fixtureSha256 !== MODEL_TRANSFER_FIXTURE_SHA256) throw Error('INVALID_EXECUTION_PLAN');
  // Repeat immutable predecessor/fixture checks and all context construction before reservation.
  const expected = await prepareModelTransferDiagnostic([plan.action], plan.fixture);
  if (!isDeepStrictEqual(plan, expected)) throw Error('INVALID_EXECUTION_PLAN');
  // Real execution requires the recorded, linked setup/metadata evidence again before wx.
  // Injected dependencies are always MOCK_ONLY and cannot create native evidence.
  if (!testDependencies && !isDeepStrictEqual(evidence.installation, await readInstallation())) throw Error('INSTALLATION_EVIDENCE_CHANGED');
  const io = { reserveReceipt: () => reserveModelTransferReceipt(open, plan.action), createEngine: createLocalLanguageModel,
    availableRam: () => os.freemem(), availableDisk: async () => { const s = await statfs(root); return s.bavail * s.bsize; },
    now: () => performance.now(), ...(testDependencies ?? {}) };
  const caps = { ...budgets, primerMs: isWarmup(plan.action) ? 20000 : budgets.operationMs };
  const limits = { ...caps, ...(testDependencies?.budgets ?? {}) };
  // Existing default-run tests shorten operationMs for both phases; native defaults stay 10s each.
  if (!isWarmup(plan.action) && !Object.hasOwn(testDependencies?.budgets ?? {}, 'primerMs')) limits.primerMs = limits.operationMs;
  if (Object.entries(limits).some(([key, value]) => !Object.hasOwn(caps, key) || !Number.isInteger(value) || value < 1 || value > caps[key])) throw Error('INVALID_TEST_BUDGET');
  const receipt = await io.reserveReceipt(); // Exclusive reservation always precedes engine construction.
  const began = io.now(), abort = new AbortController();
  let engine = null, stopPromise = null, resourceTimer, deadlineTimer, haltReason = null;
  const report = { schemaVersion: 1, recordedAt: new Date().toISOString(), status: 'PREFLIGHT',
    classification: testDependencies ? 'MOCK_ONLY' : 'LOCAL_CPU_MODEL_TRANSFER_DIAGNOSTIC_SYNTHETIC_CONTEXTS',
    treatment: plan.treatment, predecessor: plan.predecessor, fixtureSha256: evidence.fixtureSha256,
    fixture: plan.fixture, regressionFixture: plan.regressionFixture, sources: evidence.sources,
    modelPins: evidence.modelPins, runtimePins: evidence.runtimePins, installation: evidence.installation ?? null,
    settings: { ...options, ...limits,
      contextTokens: 2048, maxOutputTokens: 64, maxOutputChars: 256, logicalBatchTokens: 128, physicalBatchTokens: 64,
      temperature: .7, topP: .8, topK: 20, fixedSeed: false, nativeSlots: 1,
      initialRamRequirementBytes: 5 * GiB, minimumRamBytes: 2 * GiB, workingDiskReserveBytes: 10 * GiB },
    primer: { ...plan.primer, configuredBudgetMs: limits.primerMs, status: 'NOT_PERFORMED', output: null, finishReason: null, nativeTimings: null,
      purpose: 'DISCARDED_CALIBRATION_ONLY', semanticReview: 'NOT_APPLICABLE', dispatched: false, played: false },
    samples: plan.cases.map(c => ({ id: c.specification.id, suite: c.suite, provenance: c.provenance, capture: c.capture,
      originalContext: c.originalContext, context: c.context, projection: c.projection, messages: c.messages,
      messageCharacters: c.messageCharacters, configuredBudgetMs: limits.operationMs, status: 'NOT_PERFORMED', output: null, finishReason: null,
      nativeTimings: null, semanticReview: 'NOT_PERFORMED', dispatched: false, played: false })),
    minimumAvailableRamBytes: null, independentSemanticReview: 'NOT_PERFORMED', gameAcceptance: 'NOT_PERFORMED',
    downloads: false, gameExecution: false, editorExecution: false, audioGenerated: false, microphoneCapture: false,
    speakerPlayback: false, defaultModelChanged: false, defaultCachingChanged: false, defaultProjectionChanged: false,
    limitations: ['Eight new direct synthetic contexts precede eighteen exposed regressions; never call the combined suite a fresh holdout.',
      'Fresh context bindings are supplied synthetic inputs. Ten old contexts use inert coordinator capture; neither proves native identity or freshness.',
      'Each context is independent. No actual response or inert capture placeholder enters a later prompt. Supplied unverified histories remain.',
      'Case criteria remain in receipt fixtures, never model inputs. No automatic semantic pass is assigned.',
      'One stochastic response per case is not reliability, causal improvement, gameplay evidence or full conversation acceptance.',
      'Startup and discarded primer are separate costs; completed text is not first spoken audio.',
      'Finish reason is retained only when adapter-confirmed: stop for returned text; length for a rejected complete stream. Failed output stays null.',
      'Resource sampling and cleanup deadlines are reactive, not OS-enforced memory or process guarantees.'] };
  const save = () => receipt.save(report);
  const stopOnce = () => engine ? stopPromise ??= Promise.resolve().then(() => engine.stop()) : Promise.resolve();
  const halt = reason => { if (haltReason) return; haltReason = reason; abort.abort(reason); void stopOnce().catch(() => {}); };
  const sampleMemory = () => {
    let bytes; try { bytes = io.availableRam(); } catch { halt('RAM_MEASUREMENT_FAILED'); return; }
    if (!Number.isFinite(bytes) || bytes < 0) { halt('RAM_MEASUREMENT_FAILED'); return; }
    report.minimumAvailableRamBytes = Math.min(report.minimumAvailableRamBytes ?? bytes, bytes);
    if (bytes < 2 * GiB) halt('RAM_RESERVE_LOST');
  };
  const interrupted = () => halt('SUPERVISOR_INTERRUPTED');
  process.on('SIGINT', interrupted); process.on('SIGTERM', interrupted);
  deadlineTimer = setTimeout(() => halt('GLOBAL_TIME_LIMIT'), limits.workMs);
  async function perform(sample) {
    sampleMemory(); if (haltReason) throw Error(haltReason);
    await save(); // Invocation has not occurred while a checkpoint can yield to cancellation.
    sampleMemory(); if (haltReason) throw Error(haltReason);
    const beganOperation = io.now(), timeout = AbortSignal.timeout(sample.configuredBudgetMs);
    const signal = AbortSignal.any([abort.signal, timeout]);
    if (signal.aborted) throw Error('DIAGNOSTIC_CANCELLED');
    const captureCompletion = reason => {
      const state = engine.status(); if (state.lastGenerationFinishReason !== reason) return false;
      sample.finishReason = reason; sample.nativeTimings = state.lastGenerationTimings ? { ...state.lastGenerationTimings } : null; return true;
    };
    try {
      sample.status = 'RUNNING'; // No await between this transition and generation invocation.
      sample.output = await waitForStartup(engine.generate(sample.context, { signal }), signal);
      if (signal.aborted) throw Error('DIAGNOSTIC_CANCELLED');
      if (!captureCompletion('stop')) throw Error('COMPLETION_NOT_CONFIRMED');
      if (typeof sample.output !== 'string' || !sample.output.trim() || sample.output.length > 256) throw Error('INVALID_GENERATED_TEXT');
      sample.status = 'TEXT_COMPLETE_DIAGNOSTIC_ONLY';
    } catch (error) {
      sample.output = null; sample.status = 'FAILED'; sample.error = error.message;
      sample.finishReason = null; sample.nativeTimings = null;
      if (!signal.aborted && error.message === 'GENERATED_TEXT_TRUNCATED') captureCompletion('length');
      const phaseDeadline = isWarmup(plan.action) ? sample === report.primer ? 'PRIMER_DEADLINE' : 'RESPONSE_DEADLINE' : 'OPERATION_DEADLINE';
      halt(timeout.aborted ? phaseDeadline : haltReason ?? 'OPERATION_FAILED'); throw error;
    } finally { sample.elapsedMs = io.now() - beganOperation; sample.runtimeLog = engine.status().log; await save(); }
  }
  try {
    await save();
    report.initialFreeDiskBytes = await io.availableDisk(); report.initialAvailableRamBytes = io.availableRam();
    if (!Number.isFinite(report.initialFreeDiskBytes) || report.initialFreeDiskBytes < 10 * GiB) throw Error('DISK_RESERVE_INSUFFICIENT');
    if (!Number.isFinite(report.initialAvailableRamBytes) || report.initialAvailableRamBytes < 5 * GiB) throw Error('INITIAL_RAM_INSUFFICIENT');
    sampleMemory(); if (haltReason) throw Error(haltReason);
    engine = io.createEngine(options); resourceTimer = setInterval(sampleMemory, limits.sampleMs);
    const startAt = io.now(); await waitForStartup(engine.start(), abort.signal);
    report.startupMs = io.now() - startAt; if (haltReason) throw Error(haltReason);
    report.runtime = engine.status();
    if (report.runtime.verification !== 'PINNED_FILES_VERIFIED') throw Error('PINS_NOT_VERIFIED');
    if (report.runtime.modelId !== options.modelId || report.runtime.threads !== options.threads ||
        Object.entries({ host: '127.0.0.1', contextTokens: 2048, maxOutputTokens: 64, maxOutputChars: 256, gpuLayers: 0,
          processingBatch: 'compact', weightRepacking: false, promptCaching: true, experimentalSpeakerRelativeFacts: true,
          experimentalSpeakerBriefing: true, experimentalSeparateRequest: true,
          logicalBatchTokens: 128, physicalBatchTokens: 64, simultaneousModels: 1, thinking: false, webUI: false, mcpProxy: false })
          .some(([key, value]) => report.runtime.settings?.[key] !== value)) throw Error('CONFIGURATION_NOT_CONFIRMED');
    report.status = 'PRIMING'; await perform(report.primer); report.status = 'RUNNING';
    for (const sample of report.samples) await perform(sample);
    report.status = 'COMPLETE_PENDING_SEMANTIC_REVIEW';
  } catch (error) { report.status = 'INCOMPLETE'; report.error = error.message; }
  finally {
    clearInterval(resourceTimer); clearTimeout(deadlineTimer); abort.abort();
    let cleanupTimer;
    try { await Promise.race([stopOnce(), new Promise((_, reject) => {
      cleanupTimer = setTimeout(() => reject(Error('CLEANUP_DEADLINE')), limits.cleanupMs);
    })]); }
    catch (error) { report.status = 'OWNED_PROCESS_STOP_UNCONFIRMED'; report.stopError = error.message; }
    finally { clearTimeout(cleanupTimer); }
    report.finalRuntime = engine ? engine.status() : { state: 'NOT_STARTED', ownedPid: null, ownedProcessStopped: true };
    report.ownedProcessStopped = report.finalRuntime.ownedProcessStopped === true;
    if (!report.ownedProcessStopped) report.status = 'OWNED_PROCESS_STOP_UNCONFIRMED';
    report.haltReason = haltReason;
    report.notPerformed = report.samples.filter(s => s.status === 'NOT_PERFORMED').map(s => s.id);
    report.totalElapsedMs = io.now() - began; report.completedAt = new Date().toISOString();
    try { await save(); }
    finally { process.removeListener('SIGINT', interrupted); process.removeListener('SIGTERM', interrupted); await receipt.close(); }
  }
  return report;
}

async function main(args) {
  const fixtureBytes = await readFile(path.join(root, MODEL_TRANSFER_FIXTURE));
  const plan = await prepareModelTransferDiagnostic(args, readFrozenModelTransferFixture(fixtureBytes));
  if (plan.action === '--check' || plan.action === '--check-warmup-002') {
    console.log(JSON.stringify({ status: 'PREPARED_NOT_EXECUTED', fresh: 8, exposed: 18, total: plan.cases.length,
      order: plan.treatment.order, fixtureSha256: hash(fixtureBytes), predecessor: plan.predecessor,
      workersStarted: 0, receiptReserved: false, receipt: plan.treatment.receiptPath, resourceAdmission: 'NOT_CHECKED',
      primerBudgetMs: isWarmup(plan.action) ? 20000 : 10000, responseBudgetMs: 10000,
      primerMessageCharacters: plan.primer.messageCharacters,
      messageCharacters: plan.cases.map(c => ({ id: c.specification.id, suite: c.suite, characters: c.messageCharacters })) })); return;
  }
  const sources = {};
  for (const rel of ['scripts/Exercise-ConversationModelTransfer.mjs', 'scripts/Exercise-ConversationRelativeFacts.mjs',
    'scripts/Exercise-ConversationGrounding.mjs', 'companion/local-language-model.mjs', 'companion/speaker-observations.mjs',
    'companion/conversation.mjs', 'companion/personas.json', 'companion/models.lock.json', 'companion/llama-runtime-pins.json',
    MODEL_TRANSFER_FIXTURE, regressionFixture, MODEL_TRANSFER_PREDECESSOR,
    'companion/tests/conversation-model-transfer-diagnostic.test.mjs', 'research/LOCAL_CONVERSATION_MODEL_CANDIDATE.md',
    'research/CONVERSATION_MODEL_TRANSFER_EVALUATION.md', 'design/LOCAL_MODEL_TRANSFER_EXPERIMENT.md',
    'scripts/Install-SmollmCandidate.mjs', 'scripts/Inspect-SmollmMetadata.mjs', setupPath, metadataPath,
    'research/SMOLLM3_METADATA_ASSESSMENT.md',
    'companion/tests/smollm-model.test.mjs', 'companion/tests/smollm-setup.test.mjs',
    'companion/tests/model-transfer-review.test.mjs', 'research/SMOLLM3_TRANSFER_RUNNER_REVIEW.md'])
    sources[rel] = hash(await readFile(path.join(root, rel)));
  if (isWarmup(plan.action)) for (const rel of [MODEL_TRANSFER_RECEIPT, 'design/SMOLLM3_WARMUP_EXPERIMENT.md',
    'research/SMOLLM3_WARMUP_RUNNER_REVIEW.md', 'companion/tests/model-transfer-warmup.test.mjs',
    'companion/tests/model-transfer-warmup-review.test.mjs'])
    sources[rel] = hash(await readFile(path.join(root, rel)));
  const installation = await readInstallation();
  if (sources[setupPath] !== installation.setup.sha256 || sources[metadataPath] !== installation.metadata.sha256)
    throw Error('INSTALLATION_EVIDENCE_CHANGED');
  const lock = JSON.parse(await readFile(path.join(root, 'companion/models.lock.json')));
  const modelPins = lock.artifacts.filter(a => ['smollm3_3b', 'llama-cpu'].includes(a.id));
  if (modelPins.length !== 2 || !modelPins.some(a => Object.entries(candidate).every(([key, value]) => a[key] === value)))
    throw Error('CANDIDATE_PIN_MISSING');
  const evidence = { fixtureSha256: hash(fixtureBytes), sources, modelPins, installation,
    runtimePins: JSON.parse(await readFile(path.join(root, 'companion/llama-runtime-pins.json'))) };
  const report = await executeModelTransferDiagnostic(plan, evidence);
  console.log(JSON.stringify({ status: report.status,
    freshCompleted: report.samples.filter(s => s.suite === 'FRESH_PREDECLARED_TRANSFER' && s.status === 'TEXT_COMPLETE_DIAGNOSTIC_ONLY').length,
    exposedCompleted: report.samples.filter(s => s.suite === 'EXPOSED_REGRESSION' && s.status === 'TEXT_COMPLETE_DIAGNOSTIC_ONLY').length,
    expectedFresh: 8, expectedExposed: 18, haltReason: report.haltReason, ownedProcessStopped: report.ownedProcessStopped, receipt: plan.treatment.receiptPath }));
  if (report.status !== 'COMPLETE_PENDING_SEMANTIC_REVIEW') process.exitCode = 1;
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url)
  main(process.argv.slice(2)).catch(error => {
    console.error(error.code === 'EEXIST' ? 'RECEIPT_EXISTS; no worker started and prior evidence preserved.' : error.message); process.exitCode = 1;
  });
