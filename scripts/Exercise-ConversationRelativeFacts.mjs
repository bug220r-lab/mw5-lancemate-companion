// Explicit text-only relative-fact diagnostic. Import and --check start no worker.
import { readFile, open, statfs } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createConversationCoordinator } from '../companion/conversation.mjs';
import { createLocalLanguageModel, messagesFor } from '../companion/local-language-model.mjs';
import { projectSpeakerObservations } from '../companion/speaker-observations.mjs';
import personas from '../companion/personas.json' with { type: 'json' };
import { waitForStartup } from './Exercise-ConversationGrounding.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GiB = 1024 ** 3;
export const RELATIVE_FACTS_FIXTURE_SHA256 = 'ec7106cd5a0518489cd46dcea24ef8f0ab6facfbff5c31f4f8b5716a889f9108';
export const RELATIVE_FACTS_RECEIPT = 'research/QWEN4B_RELATIVE_FACTS_DIAGNOSTIC.json';
export const RELATIVE_FACTS_ATTEMPT_002_RECEIPT = 'research/QWEN4B_RELATIVE_FACTS_ATTEMPT_002.json';
export const RELATIVE_FACTS_PREDECESSOR_SHA256 = 'a4970f273317987ec2ab807dc4a23c3c362cadc6cea81a10b375094b84902771';
export const RELATIVE_FACTS_QWEN17B_RECEIPT = 'research/QWEN17B_RELATIVE_FACTS_DIAGNOSTIC.json';
export const RELATIVE_FACTS_QWEN17B_PREDECESSOR_SHA256 = 'e227f94995bab1c44a3296c50202c995e36c9b25d2302f0cd1d05bd6266fb67b';
export const BRIEFING_RECEIPT = 'research/QWEN17B_BRIEFING_DIAGNOSTIC.json';
export const BRIEFING_PREDECESSOR_SHA256 = '456ae004e7497fe9d90a574b218a1da2c47d26b4546c87d21c5133f9d26137a3';
const secondAttemptAction = '--run-attempt-002';
const qwen17bAction = '--run-qwen17b';
const briefingAction = '--run-briefing-qwen17b';
const fixtureRelative = 'synthetic/conversation-relative-facts-cases.json';
const options = Object.freeze({ modelId: 'qwen4b', threads: 4, processingBatch: 'compact', weightRepacking: false,
  promptCaching: true, experimentalSpeakerRelativeFacts: true });
const budgets = Object.freeze({ operationMs: 10000, workMs: 233000, cleanupMs: 7000, sampleMs: 250 });
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const freeze = x => { if (x && typeof x === 'object') { Object.values(x).forEach(freeze); Object.freeze(x); } return x; };

export function readFrozenRelativeFactsFixture(bytes) {
  if (hash(bytes) !== RELATIVE_FACTS_FIXTURE_SHA256) throw Error('FROZEN_FIXTURE_CHANGED');
  return JSON.parse(bytes.toString('utf8'));
}

export function readRelativeFactsPredecessor(bytes) {
  if (hash(bytes) !== RELATIVE_FACTS_PREDECESSOR_SHA256) throw Error('PREDECESSOR_EVIDENCE_CHANGED');
  const prior = JSON.parse(bytes.toString('utf8'));
  if (prior.status !== 'INCOMPLETE' || prior.error !== 'INITIAL_RAM_INSUFFICIENT' ||
      prior.primer.status !== 'NOT_PERFORMED' || prior.primer.output !== null || prior.samples.length !== 18 ||
      prior.samples.some(s => s.status !== 'NOT_PERFORMED' || s.output !== null) || prior.notPerformed.length !== 18 ||
      prior.finalRuntime.state !== 'NOT_STARTED' || prior.finalRuntime.ownedPid !== null || !prior.finalRuntime.ownedProcessStopped)
    throw Error('PREDECESSOR_NOT_ADMISSION_REFUSAL');
  return { path: RELATIVE_FACTS_RECEIPT, sha256: RELATIVE_FACTS_PREDECESSOR_SHA256 };
}

async function secondAttempt() {
  return { id: '002', receiptPath: RELATIVE_FACTS_ATTEMPT_002_RECEIPT,
    predecessor: readRelativeFactsPredecessor(await readFile(path.join(root, RELATIVE_FACTS_RECEIPT))) };
}

export function readRelativeFactsQwen17bPredecessor(bytes) {
  if (hash(bytes) !== RELATIVE_FACTS_QWEN17B_PREDECESSOR_SHA256) throw Error('QWEN17B_PREDECESSOR_EVIDENCE_CHANGED');
  const prior = JSON.parse(bytes.toString('utf8'));
  if (prior.status !== 'INCOMPLETE' || prior.haltReason !== 'OPERATION_DEADLINE' ||
      prior.primer.status !== 'TEXT_COMPLETE_DIAGNOSTIC_ONLY' || prior.samples.length !== 18 ||
      prior.samples[0].status !== 'FAILED' || prior.samples.slice(1).some(s => s.status !== 'NOT_PERFORMED') ||
      prior.notPerformed.length !== 17 || !prior.ownedProcessStopped || prior.finalRuntime.ownedPid !== null)
    throw Error('QWEN17B_PREDECESSOR_NOT_STOPPED_DIAGNOSTIC');
  return { path: RELATIVE_FACTS_ATTEMPT_002_RECEIPT, sha256: RELATIVE_FACTS_QWEN17B_PREDECESSOR_SHA256 };
}

async function qwen17bSubstitution() {
  return { id: 'QWEN17B_OFFICIAL_Q8', receiptPath: RELATIVE_FACTS_QWEN17B_RECEIPT,
    referenceModelId: 'qwen4b', modelId: 'qwen1_7b',
    predecessor: readRelativeFactsQwen17bPredecessor(await readFile(path.join(root, RELATIVE_FACTS_ATTEMPT_002_RECEIPT))) };
}

export function readBriefingPredecessor(bytes) {
  if (hash(bytes) !== BRIEFING_PREDECESSOR_SHA256) throw Error('BRIEFING_PREDECESSOR_EVIDENCE_CHANGED');
  const prior = JSON.parse(bytes.toString('utf8'));
  if (prior.status !== 'COMPLETE_PENDING_SEMANTIC_REVIEW' || prior.samples.length !== 18 ||
      prior.primer.status !== 'TEXT_COMPLETE_DIAGNOSTIC_ONLY' || prior.samples.some(s => s.status !== 'TEXT_COMPLETE_DIAGNOSTIC_ONLY') ||
      prior.notPerformed.length !== 0 || !prior.ownedProcessStopped || prior.finalRuntime.ownedPid !== null)
    throw Error('BRIEFING_PREDECESSOR_NOT_STOPPED_DIAGNOSTIC');
  return { path: RELATIVE_FACTS_QWEN17B_RECEIPT, sha256: BRIEFING_PREDECESSOR_SHA256 };
}

async function briefingPromptTreatment() {
  return { id: 'SPEAKER_FACT_BRIEFING_V1', revision: 1, receiptPath: BRIEFING_RECEIPT, modelId: 'qwen1_7b',
    changes: 'SYSTEM_INSTRUCTION_AND_FACT_REPRESENTATION',
    predecessor: readBriefingPredecessor(await readFile(path.join(root, RELATIVE_FACTS_QWEN17B_RECEIPT))),
    exposure: { regressionCount: 18, freshHoldoutCount: 0, originalHoldoutCount: 4, originalProvenanceRetained: true } };
}

function receiptFor(action) {
  if (action === '--run') return RELATIVE_FACTS_RECEIPT;
  if (action === secondAttemptAction) return RELATIVE_FACTS_ATTEMPT_002_RECEIPT;
  if (action === qwen17bAction) return RELATIVE_FACTS_QWEN17B_RECEIPT;
  if (action === briefingAction) return BRIEFING_RECEIPT;
  throw Error('INVALID_ATTEMPT');
}

// Re-read the immutable source fixture before accepting an in-memory plan. This
// validates the exact case copies without granting metadata any model authority.
export async function prepareRelativeFactsDiagnostic(args, fixture) {
  if (!Array.isArray(args) || args.length !== 1 || !['--check', '--run', secondAttemptAction, qwen17bAction, briefingAction].includes(args[0])) throw Error('INVALID_ARGUMENTS');
  const attempt = args[0] === secondAttemptAction ? await secondAttempt() : null;
  const modelSubstitution = args[0] === qwen17bAction ? await qwen17bSubstitution() : null;
  const promptTreatment = args[0] === briefingAction ? await briefingPromptTreatment() : null;
  const frozen = readFrozenRelativeFactsFixture(await readFile(path.join(root, fixtureRelative)));
  if (!isDeepStrictEqual(fixture, frozen)) throw Error('FROZEN_FIXTURE_CHANGED');
  const f = structuredClone(fixture), sourceFixtures = {};
  for (const [key, source] of Object.entries(f.sources)) {
    const bytes = await readFile(path.join(root, source.path));
    if (hash(bytes) !== source.sha256) throw Error('REGRESSION_SOURCE_CHANGED');
    sourceFixtures[key] = JSON.parse(bytes);
    if (!isDeepStrictEqual(sourceFixtures[key].reviewProtocol, source.reviewProtocol)) throw Error('REGRESSION_CRITERIA_CHANGED');
  }
  for (const prior of f.priorNativeEvidence) {
    const bytes = await readFile(path.join(root, prior.path));
    if (hash(bytes) !== prior.sha256 || !isDeepStrictEqual(JSON.parse(bytes).sources, prior.sources) ||
        hash(await readFile(path.join(root, prior.reviewPath))) !== prior.reviewSha256) throw Error('PRIOR_EVIDENCE_CHANGED');
  }
  const cases = [];
  for (const [index, row] of f.cases.entries()) {
    const c = row.specification, input = row.inputProtocol, origin = row.provenance;
    if (origin.sourceKey) {
      const original = sourceFixtures[origin.sourceKey]?.cases[Number(origin.jsonPointer.split('/').at(-1))];
      if (!isDeepStrictEqual(c, original) || hash(JSON.stringify(c)) !== origin.caseObjectSha256) throw Error('REGRESSION_CASE_CHANGED');
    }
    const profiles = structuredClone(personas);
    profiles.profiles.find(p => p.id === input.persona).callsign = input.callsignOverride;
    let originalContext, captures = 0;
    if (input.mode === 'COORDINATOR_CAPTURE') {
      const bindings = f.bindingSets[input.bindingSet], binding = bindings.find(b => b.id === input.speakerId);
      if (!binding || binding.profileId !== input.persona || c.history.length !== 0) throw Error('FIXTURE_BINDING_MISMATCH');
      const session = 'relative_fact_case_' + (index + 1);
      const coordinator = createConversationCoordinator({ personas: profiles, now: () => 1000,
        generate: async actual => { captures++; originalContext = actual; return 'CAPTURE_ONLY_PLACEHOLDER'; } });
      try {
        if (coordinator.startMission(session, bindings).status !== 'STARTED') throw Error('CAPTURE_BINDINGS_REJECTED');
        const result = await coordinator.request({ id: c.id, session, speakerId: binding.id, pawnId: binding.pawnId,
          generation: binding.generation, priority: 'answer', text: c.request, expiresAtMs: 5000,
          facts: c.facts.map(x => ({ id: x.id, session, kind: 'fact', verified: true,
            observedAtMs: 1000, expiresAtMs: 5000, data: x.data })) });
        if (result.status !== 'GENERATED' || captures !== 1 || originalContext?.speakerId !== binding.id ||
            originalContext.persona.id !== binding.profileId || originalContext.history.length !== 0 ||
            originalContext.facts.some(x => x.evidenceStatus !== 'CALLER_ASSERTED_OBSERVATION' || Object.hasOwn(x, 'verified')) ||
            !isDeepStrictEqual(originalContext.facts.map(x => ({ id: x.id, data: x.data })),
              c.facts.map(x => ({ id: x.id, data: x.data })))) throw Error('CAPTURE_CONTEXT_MISMATCH');
      } finally { coordinator.dispose(); }
    } else {
      if (input.mode !== 'UNBOUND_ADAPTER_SMOKE' || input.bindingSet !== null || input.speakerId !== null) throw Error('UNBOUND_CASE_HAS_BINDING');
      originalContext = { persona: profiles.profiles.find(p => p.id === input.persona),
        request: { text: c.request }, facts: c.facts, history: c.history };
    }
    const prepared = prepareProjection(originalContext, Boolean(promptTreatment));
    cases.push({ provenance: origin, specification: c, capture: { mode: input.mode, coordinatorCalls: captures,
      syntheticClockMs: input.mode === 'COORDINATOR_CAPTURE' ? 1000 : null, placeholderInMeasuredHistory: false,
      addedContextFields: ['classification'], otherContextFieldsUnchanged: true }, ...prepared });
  }
  if (cases.length !== 18 || cases.filter(c => c.capture.coordinatorCalls === 1).length !== 10 ||
      cases.filter(c => c.provenance.kind === 'NEW_PREDECLARED_HOLDOUT').length !== 4) throw Error('INVALID_CAPTURE_COUNTS');
  const primer = prepareProjection({ persona: { id: 'calibration', callsign: null }, request: { text: 'Say OK.' }, facts: [], history: [] }, Boolean(promptTreatment));
  return freeze({ action: args[0], ...(attempt ? { attempt } : {}), ...(modelSubstitution ? { modelSubstitution } : {}),
    ...(promptTreatment ? { promptTreatment } : {}), fixture: f, primer, cases });
}

function prepareProjection(originalContext, briefing = false) {
  if (Object.hasOwn(originalContext, 'classification')) throw Error('CAPTURE_ALREADY_CLASSIFIED');
  const context = { ...structuredClone(originalContext), classification: 'MOCK_ONLY' };
  const { classification, ...rest } = context;
  if (classification !== 'MOCK_ONLY' || !isDeepStrictEqual(rest, originalContext)) throw Error('CAPTURE_FIELDS_CHANGED');
  const projection = projectSpeakerObservations({ schemaVersion: 1, classification,
    speakerId: context.speakerId ?? null, facts: context.facts });
  const projectedMessages = messagesFor(context, { experimentalSpeakerRelativeFacts: true });
  const user = JSON.parse(projectedMessages[1].content.slice(0, -' /no_think'.length));
  if (!isDeepStrictEqual(user.callerAssertedCurrentObservations, projection.prompt)) throw Error('SERIALIZED_PROJECTION_MISMATCH');
  const messages = briefing ? messagesFor(context, { experimentalSpeakerRelativeFacts: true, experimentalSpeakerBriefing: true }) : projectedMessages;
  return { originalContext, context, projection, messages, messageCharacters: messages.reduce((n, m) => n + m.content.length, 0) };
}

export async function reserveRelativeFactsReceipt(openFile = open, action = '--run') {
  // One owner keeps the exclusively created handle; refused reruns never open for writing.
  const handle = await openFile(path.join(root, receiptFor(action)), 'wx');
  return {
    async save(report) {
      const bytes = Buffer.from(JSON.stringify(report, null, 2) + '\n');
      for (let offset = 0; offset < bytes.length;) {
        const written = await handle.write(bytes, offset, bytes.length - offset, offset);
        if (written.bytesWritten < 1) throw Error('RECEIPT_WRITE_FAILED');
        offset += written.bytesWritten;
      }
      await handle.truncate(bytes.length); await handle.sync();
    },
    close: () => handle.close()
  };
}

// Test substitutions are code-only, never CLI/request data; resulting receipts say MOCK_ONLY.
export async function executeRelativeFactsDiagnostic(plan, evidence, testDependencies = null) {
  if (!['--run', secondAttemptAction, qwen17bAction, briefingAction].includes(plan?.action) || evidence?.fixtureSha256 !== RELATIVE_FACTS_FIXTURE_SHA256) throw Error('INVALID_EXECUTION_PLAN');
  const attempt = plan.action === secondAttemptAction ? await secondAttempt() : null;
  if (attempt ? !isDeepStrictEqual(plan.attempt, attempt) : Object.hasOwn(plan, 'attempt')) throw Error('INVALID_EXECUTION_PLAN');
  const modelSubstitution = plan.action === qwen17bAction ? await qwen17bSubstitution() : null;
  if (modelSubstitution ? !isDeepStrictEqual(plan.modelSubstitution, modelSubstitution) : Object.hasOwn(plan, 'modelSubstitution')) throw Error('INVALID_EXECUTION_PLAN');
  const promptTreatment = plan.action === briefingAction ? await briefingPromptTreatment() : null;
  if (promptTreatment ? !isDeepStrictEqual(plan.promptTreatment, promptTreatment) : Object.hasOwn(plan, 'promptTreatment')) throw Error('INVALID_EXECUTION_PLAN');
  const engineOptions = promptTreatment ? Object.freeze({ ...options, modelId: 'qwen1_7b', experimentalSpeakerBriefing: true }) :
    modelSubstitution ? Object.freeze({ ...options, modelId: 'qwen1_7b' }) : options;
  const io = { reserveReceipt: action => reserveRelativeFactsReceipt(open, action), createEngine: createLocalLanguageModel, availableRam: () => os.freemem(),
    availableDisk: async () => { const s = await statfs(root); return s.bavail * s.bsize; }, now: () => performance.now(),
    ...(testDependencies ?? {}) };
  const limits = { ...budgets, ...(testDependencies?.budgets ?? {}) };
  if (Object.entries(limits).some(([key, value]) => !Object.hasOwn(budgets, key) || !Number.isInteger(value) || value < 1 || value > budgets[key])) throw Error('INVALID_TEST_BUDGET');
  const receipt = await io.reserveReceipt(plan.action); // No engine is constructed if a receipt already exists.
  const began = io.now(), abort = new AbortController();
  let engine = null, stopPromise = null, resourceTimer, deadlineTimer, haltReason = null;
  const report = { schemaVersion: 1, recordedAt: new Date().toISOString(), status: 'PREFLIGHT',
    ...(attempt ? { attempt } : {}),
    ...(modelSubstitution ? { modelSubstitution } : {}),
    ...(promptTreatment ? { promptTreatment } : {}),
    classification: testDependencies ? 'MOCK_ONLY' : 'LOCAL_CPU_RELATIVE_FACTS_DIAGNOSTIC_SYNTHETIC_CONTEXTS',
    fixtureSha256: evidence.fixtureSha256, fixture: plan.fixture, sources: evidence.sources,
    modelPins: evidence.modelPins, runtimePins: evidence.runtimePins, settings: { ...engineOptions, ...limits,
      contextTokens: 2048, maxOutputTokens: 64, maxOutputChars: 256, logicalBatchTokens: 128, physicalBatchTokens: 64,
      temperature: .7, topP: .8, topK: 20, fixedSeed: false, nativeSlots: 1,
      initialRamRequirementBytes: 5 * GiB, minimumRamBytes: 2 * GiB, workingDiskReserveBytes: 10 * GiB },
    primer: { status: 'NOT_PERFORMED', ...plan.primer, output: null, finishReason: null, nativeTimings: null,
      purpose: 'DISCARDED_CALIBRATION_ONLY', semanticReview: 'NOT_APPLICABLE', dispatched: false, played: false },
    samples: plan.cases.map(c => ({ id: c.specification.id, provenance: c.provenance, capture: c.capture,
      originalContext: c.originalContext, context: c.context, projection: c.projection, messages: c.messages, messageCharacters: c.messageCharacters, status: 'NOT_PERFORMED', output: null, finishReason: null, nativeTimings: null, semanticReview: 'NOT_PERFORMED', dispatched: false, played: false })),
    minimumAvailableRamBytes: null, independentSemanticReview: 'NOT_PERFORMED', gameAcceptance: 'NOT_PERFORMED',
    downloads: false, gameExecution: false, editorExecution: false, audioGenerated: false, microphoneCapture: false,
    speakerPlayback: false, defaultModelChanged: false, defaultCachingChanged: false, defaultProjectionChanged: false,
    limitations: ['Synthetic capture clock is fixed; this is not live freshness or actor verification.',
      'Coordinator capture uses an inert placeholder; it and actual diagnostic answers never enter other contexts. Two older regressions retain their supplied unverified histories.',
      promptTreatment ? 'All eighteen cases are previously exposed regressions. The four original holdout provenance records are preserved, but no case is a fresh holdout in this prompt treatment.' :
        'Fourteen cases are known regressions; only four are newly specified holdouts, not a statistical acceptance set.',
      'The experimental projection is enabled only for explicit MOCK_ONLY contexts; it does not authenticate facts or enable a workbench capability.',
      'Expectations remain in the receipt fixture, never in model contexts/messages.',
      'A single stochastic response per case is not reliability, causal improvement or full conversation acceptance.',
      'Startup and primer are separate costs; complete text is not first spoken audio.',
      'finishReason records only the adapter-confirmed terminal finish_reason: stop for returned text or length for a rejected complete stream. Missing, invalid or cancelled completion metadata remains null; stop is not semantic acceptance.',
      'Resource sampling and shutdown deadlines are reactive, not OS-level memory or termination guarantees.'] };
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
    await save(); // Still unperformed while checkpoint I/O can yield to a stop guard.
    sampleMemory(); if (haltReason) throw Error(haltReason);
    const beganOperation = io.now(), timeout = AbortSignal.timeout(limits.operationMs);
    const signal = AbortSignal.any([abort.signal, timeout]);
    if (signal.aborted) throw Error('DIAGNOSTIC_CANCELLED');
    const captureCompletion = expectedReason => {
      const state = engine.status();
      if (state.lastGenerationFinishReason !== expectedReason) return;
      sample.finishReason = expectedReason;
      sample.nativeTimings = state.lastGenerationTimings ? { ...state.lastGenerationTimings } : null;
    };
    try {
      sample.status = 'RUNNING'; // No asynchronous gap before the actual invocation.
      sample.output = await waitForStartup(engine.generate(sample.context, { signal }), signal);
      if (signal.aborted) throw Error('DIAGNOSTIC_CANCELLED');
      captureCompletion('stop');
      sample.status = 'TEXT_COMPLETE_DIAGNOSTIC_ONLY';
    } catch (error) {
      sample.output = null; sample.status = 'FAILED'; sample.error = error.message;
      if (!signal.aborted && error.message === 'GENERATED_TEXT_TRUNCATED') captureCompletion('length');
      halt(timeout.aborted ? 'OPERATION_DEADLINE' : haltReason ?? 'OPERATION_FAILED'); throw error;
    } finally {
      sample.elapsedMs = io.now() - beganOperation;
      const state = engine.status(); sample.runtimeLog = state.log;
      await save();
    }
  }
  try {
    await save();
    report.initialFreeDiskBytes = await io.availableDisk(); report.initialAvailableRamBytes = io.availableRam();
    if (!Number.isFinite(report.initialFreeDiskBytes) || report.initialFreeDiskBytes < 10 * GiB) throw Error('DISK_RESERVE_INSUFFICIENT');
    if (!Number.isFinite(report.initialAvailableRamBytes) || report.initialAvailableRamBytes < 5 * GiB) throw Error('INITIAL_RAM_INSUFFICIENT');
    sampleMemory(); if (haltReason) throw Error(haltReason);
    engine = io.createEngine(engineOptions); resourceTimer = setInterval(sampleMemory, limits.sampleMs);
    const startAt = io.now(); await waitForStartup(engine.start(), abort.signal);
    report.startupMs = io.now() - startAt; if (haltReason) throw Error(haltReason);
    report.runtime = engine.status();
    if (report.runtime.verification !== 'PINNED_FILES_VERIFIED') throw Error('PINS_NOT_VERIFIED');
    if (report.runtime.modelId !== engineOptions.modelId || report.runtime.threads !== engineOptions.threads ||
        Object.entries({ host: '127.0.0.1', contextTokens: 2048, maxOutputTokens: 64, maxOutputChars: 256, gpuLayers: 0,
          processingBatch: 'compact', weightRepacking: false, promptCaching: true, experimentalSpeakerRelativeFacts: true,
          ...(promptTreatment ? { experimentalSpeakerBriefing: true } : {}),
          logicalBatchTokens: 128, physicalBatchTokens: 64, simultaneousModels: 1, thinking: false, webUI: false, mcpProxy: false })
          .some(([key, value]) => report.runtime.settings?.[key] !== value)) throw Error('CONFIGURATION_NOT_CONFIRMED');
    report.status = 'PRIMING'; await perform(report.primer);
    report.status = 'RUNNING';
    for (const sample of report.samples) await perform(sample);
    report.status = 'COMPLETE_PENDING_SEMANTIC_REVIEW';
  } catch (error) { report.status = 'INCOMPLETE'; report.error = error.message; }
  finally {
    clearInterval(resourceTimer); clearTimeout(deadlineTimer); abort.abort();
    let cleanupTimer;
    try {
      await Promise.race([stopOnce(), new Promise((_, reject) => {
        cleanupTimer = setTimeout(() => reject(Error('CLEANUP_DEADLINE')), limits.cleanupMs);
      })]);
    } catch (error) { report.status = 'OWNED_PROCESS_STOP_UNCONFIRMED'; report.stopError = error.message; }
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
  const fixtureBytes = await readFile(path.join(root, fixtureRelative));
  const plan = await prepareRelativeFactsDiagnostic(args, readFrozenRelativeFactsFixture(fixtureBytes));
  if (plan.action === '--check') {
    console.log(JSON.stringify({ status: 'PREPARED_NOT_EXECUTED', cases: plan.cases.length,
      coordinatorCaptures: plan.cases.filter(c => c.capture.coordinatorCalls === 1).length,
      unboundContexts: plan.cases.filter(c => c.capture.coordinatorCalls === 0).length,
      fixtureSha256: hash(fixtureBytes), workersStarted: 0, receiptReserved: false, receipt: RELATIVE_FACTS_RECEIPT, resourceAdmission: 'NOT_CHECKED',
      primerMessageCharacters: plan.primer.messageCharacters,
      messageCharacters: plan.cases.map(c => ({ id: c.specification.id, characters: c.messageCharacters })) })); return;
  }
  const sources = {};
  for (const rel of ['scripts/Exercise-ConversationRelativeFacts.mjs', 'scripts/Exercise-ConversationIdentity.mjs',
    'scripts/Exercise-ConversationGrounding.mjs', 'companion/speaker-observations.mjs', 'companion/local-language-model.mjs',
    'companion/conversation.mjs', 'companion/personas.json', 'companion/models.lock.json', 'companion/llama-runtime-pins.json',
    'companion/tests/conversation-relative-facts-diagnostic.test.mjs', 'synthetic/conversation-relative-facts-cases.json',
    'synthetic/conversation-identity-cases.json', 'synthetic/conversation-grounding-cases.json',
    'design/SPEAKER_RELATIVE_OBSERVATIONS.md', 'research/SPEAKER_OBSERVATION_REVIEW.md',
    'research/CONVERSATION_RELATIVE_FACTS_EVALUATION.md', 'research/CONVERSATION_IDENTITY_EVALUATION.md',
    'research/QWEN4B_IDENTITY_RESULT_REVIEW.md', 'research/QWEN4B_PROMPT_CACHE_RESULT_REVIEW.md',
    ...(plan.action === secondAttemptAction ? ['companion/tests/relative-facts-attempt-review.test.mjs',
      'research/RELATIVE_FACTS_ATTEMPT_002_PREPARATION.md'] : []),
    ...(plan.action === qwen17bAction ? ['companion/tests/relative-facts-fallback-review.test.mjs',
      'research/RELATIVE_FACTS_FALLBACK_PREPARATION.md'] : []),
    ...(plan.action === briefingAction ? ['companion/tests/briefing-diagnostic.test.mjs',
      'companion/tests/speaker-briefing.test.mjs', 'companion/tests/local-language-model.test.mjs',
      'companion/tests/speaker-briefing-review.test.mjs',
      'design/SPEAKER_FACT_BRIEFING.md', 'research/SPEAKER_BRIEFING_REVIEW.md',
      'research/CONVERSATION_BRIEFING_EVALUATION.md'] : [])])
    sources[rel] = hash(await readFile(path.join(root, rel)));
  const lock = JSON.parse(await readFile(path.join(root, 'companion/models.lock.json')));
  const evidence = { fixtureSha256: hash(fixtureBytes), sources,
    modelPins: lock.artifacts.filter(a => [[qwen17bAction, briefingAction].includes(plan.action) ? 'qwen1_7b' : 'qwen4b', 'llama-cpu'].includes(a.id)),
    runtimePins: JSON.parse(await readFile(path.join(root, 'companion/llama-runtime-pins.json'))) };
  const report = await executeRelativeFactsDiagnostic(plan, evidence);
  console.log(JSON.stringify({ status: report.status, completed: report.samples.filter(s => s.status === 'TEXT_COMPLETE_DIAGNOSTIC_ONLY').length,
    expected: plan.cases.length, haltReason: report.haltReason, ownedProcessStopped: report.ownedProcessStopped, receipt: receiptFor(plan.action) }));
  if (report.status !== 'COMPLETE_PENDING_SEMANTIC_REVIEW') process.exitCode = 1;
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url)
  main(process.argv.slice(2)).catch(error => {
    console.error(error.code === 'EEXIST' ? 'RECEIPT_EXISTS; no worker started and prior evidence preserved.' : error.message);
    process.exitCode = 1;
  });
