// Explicit text-only identity diagnostic. Imports and --check start no native worker.
import { readFile, open, statfs } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createConversationCoordinator } from '../companion/conversation.mjs';
import { createLocalLanguageModel, messagesFor } from '../companion/local-language-model.mjs';
import personas from '../companion/personas.json' with { type: 'json' };
import { waitForStartup } from './Exercise-ConversationGrounding.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GiB = 1024 ** 3;
export const IDENTITY_FIXTURE_SHA256 = '4ffda0d912a22828bd34a3fbc91b616a60d9b1b510b89576b70bf2f1c01385b1';
export const IDENTITY_RECEIPT = 'research/QWEN4B_IDENTITY_DIAGNOSTIC.json';
const fixtureRelative = 'synthetic/conversation-identity-cases.json';
const options = Object.freeze({ modelId: 'qwen4b', threads: 4, processingBatch: 'compact', weightRepacking: false, promptCaching: true });
const budgets = Object.freeze({ operationMs: 10000, workMs: 233000, cleanupMs: 7000, sampleMs: 250 });
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const freeze = x => { if (x && typeof x === 'object') { Object.values(x).forEach(freeze); Object.freeze(x); } return x; };

export function readFrozenIdentityFixture(bytes) {
  if (hash(bytes) !== IDENTITY_FIXTURE_SHA256) throw Error('FROZEN_FIXTURE_CHANGED');
  return JSON.parse(bytes.toString('utf8'));
}

export async function prepareIdentityDiagnostic(args, fixture) {
  if (!Array.isArray(args) || args.length !== 1 || !['--check', '--run'].includes(args[0])) throw Error('INVALID_ARGUMENTS');
  const f = structuredClone(fixture);
  if (f?.schemaVersion !== 1 || f.classification !== 'MOCK_ONLY' || f.expectedCaseCount !== 8 ||
      !Array.isArray(f.cases) || f.cases.length !== 8 || new Set(f.cases.map(c => c?.id)).size !== 8) throw Error('INVALID_FIXTURE');
  const cases = [];
  for (const [index, c] of f.cases.entries()) {
    if (!c || !/^[a-z0-9-]{1,64}$/.test(c.id) || !['COORDINATOR_CAPTURE', 'UNBOUND_ADAPTER_SMOKE'].includes(c.mode) ||
        !['edge', 'tactician', 'scout'].includes(c.persona) || !Array.isArray(c.history) || c.history.length !== 0 ||
        !Array.isArray(c.facts) || c.facts.length > 8 || c.facts.some(x => !x || typeof x.id !== 'string' ||
          x.evidenceStatus !== 'CALLER_ASSERTED_OBSERVATION' || x.data === undefined) ||
        !['requiredMeaning', 'forbiddenClaims'].every(k => Array.isArray(c[k]) && c[k].length &&
          c[k].every(x => typeof x === 'string' && x.trim())) || typeof c.rationale !== 'string' || !c.rationale.trim() ||
        !Object.hasOwn(c, 'callsignOverride') || (c.callsignOverride !== null &&
          (typeof c.callsignOverride !== 'string' || !c.callsignOverride.trim()))) throw Error('INVALID_CASE');
    const profiles = structuredClone(personas);
    profiles.profiles.find(p => p.id === c.persona).callsign = c.callsignOverride;
    let context, captures = 0;
    if (c.mode === 'COORDINATOR_CAPTURE') {
      const bindings = f.bindingSets?.[c.bindingSet], binding = bindings?.find(b => b.id === c.speakerId);
      if (!binding || binding.profileId !== c.persona) throw Error('FIXTURE_BINDING_MISMATCH');
      const session = `identity_case_${index + 1}`;
      const coordinator = createConversationCoordinator({ personas: profiles, now: () => 1000,
        generate: async actual => { captures++; context = actual; return 'CAPTURE_ONLY_PLACEHOLDER'; } });
      try {
        if (coordinator.startMission(session, bindings).status !== 'STARTED') throw Error('CAPTURE_BINDINGS_REJECTED');
        const result = await coordinator.request({ id: c.id, session, speakerId: binding.id, pawnId: binding.pawnId,
          generation: binding.generation, priority: 'answer', text: c.request, expiresAtMs: 5000,
          facts: c.facts.map(x => ({ id: x.id, session, kind: 'fact', verified: true,
            observedAtMs: 1000, expiresAtMs: 5000, data: x.data })) });
        if (result.status !== 'GENERATED' || captures !== 1 || context?.speakerId !== binding.id ||
            context.persona.id !== binding.profileId || context.history.length !== 0 ||
            context.facts.some(x => x.evidenceStatus !== 'CALLER_ASSERTED_OBSERVATION' || Object.hasOwn(x, 'verified')) ||
            JSON.stringify(context.facts.map(x => ({ id: x.id, data: x.data }))) !==
              JSON.stringify(c.facts.map(x => ({ id: x.id, data: x.data })))) throw Error('CAPTURE_CONTEXT_MISMATCH');
      } finally { coordinator.dispose(); }
    } else {
      if (c.bindingSet !== null || c.speakerId !== null) throw Error('UNBOUND_CASE_HAS_BINDING');
      context = { persona: profiles.profiles.find(p => p.id === c.persona),
        request: { text: c.request }, facts: c.facts, history: [] };
    }
    cases.push({ specification: c, capture: { mode: c.mode, coordinatorCalls: captures,
      syntheticClockMs: c.mode === 'COORDINATOR_CAPTURE' ? 1000 : null, placeholderInMeasuredHistory: false },
      context, messages: messagesFor(context) });
  }
  if (cases.filter(c => c.capture.coordinatorCalls === 1).length !== 7) throw Error('INVALID_CAPTURE_COUNTS');
  const primer = { persona: { id: 'calibration', callsign: null }, request: { text: 'Say OK.' }, facts: [], history: [] };
  return freeze({ action: args[0], fixture: f, primer, primerMessages: messagesFor(primer), cases });
}

async function reserveReceipt() {
  // One owner keeps the exclusively created handle; refused reruns never open for writing.
  const handle = await open(path.join(root, IDENTITY_RECEIPT), 'wx');
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
export async function executeIdentityDiagnostic(plan, evidence, testDependencies = null) {
  if (plan?.action !== '--run' || evidence?.fixtureSha256 !== IDENTITY_FIXTURE_SHA256) throw Error('INVALID_EXECUTION_PLAN');
  const io = { reserveReceipt, createEngine: createLocalLanguageModel, availableRam: () => os.freemem(),
    availableDisk: async () => { const s = await statfs(root); return s.bavail * s.bsize; }, now: () => performance.now(),
    ...(testDependencies ?? {}) };
  const limits = { ...budgets, ...(testDependencies?.budgets ?? {}) };
  if (Object.entries(limits).some(([key, value]) => !Object.hasOwn(budgets, key) || !Number.isInteger(value) || value < 1 || value > budgets[key])) throw Error('INVALID_TEST_BUDGET');
  const receipt = await io.reserveReceipt(); // No engine is constructed if a receipt already exists.
  const began = io.now(), abort = new AbortController();
  let engine = null, stopPromise = null, resourceTimer, deadlineTimer, haltReason = null;
  const report = { schemaVersion: 1, recordedAt: new Date().toISOString(), status: 'PREFLIGHT',
    classification: testDependencies ? 'MOCK_ONLY' : 'LOCAL_CPU_IDENTITY_DIAGNOSTIC_SYNTHETIC_CONTEXTS',
    fixtureSha256: evidence.fixtureSha256, fixture: plan.fixture, sources: evidence.sources,
    modelPins: evidence.modelPins, runtimePins: evidence.runtimePins, settings: { ...options, ...limits,
      contextTokens: 2048, maxOutputTokens: 64, maxOutputChars: 256, logicalBatchTokens: 128, physicalBatchTokens: 64,
      temperature: .7, topP: .8, topK: 20, fixedSeed: false, nativeSlots: 1,
      initialRamRequirementBytes: 5 * GiB, minimumRamBytes: 2 * GiB, workingDiskReserveBytes: 10 * GiB },
    primer: { status: 'NOT_PERFORMED', context: plan.primer, messages: plan.primerMessages, output: null, finishReason: null, nativeTimings: null,
      purpose: 'DISCARDED_CALIBRATION_ONLY', semanticReview: 'NOT_APPLICABLE', dispatched: false, played: false },
    samples: plan.cases.map(c => ({ id: c.specification.id, capture: c.capture, context: c.context,
      messages: c.messages, status: 'NOT_PERFORMED', output: null, finishReason: null, nativeTimings: null, semanticReview: 'NOT_PERFORMED', dispatched: false, played: false })),
    minimumAvailableRamBytes: null, independentSemanticReview: 'NOT_PERFORMED', gameAcceptance: 'NOT_PERFORMED',
    downloads: false, gameExecution: false, editorExecution: false, audioGenerated: false, microphoneCapture: false,
    speakerPlayback: false, defaultModelChanged: false, defaultCachingChanged: false,
    limitations: ['Synthetic capture clock is fixed; this is not live freshness or actor verification.',
      'Coordinator capture uses an inert placeholder; neither it nor previous model outputs enter measured histories.',
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
    engine = io.createEngine(options); resourceTimer = setInterval(sampleMemory, limits.sampleMs);
    const startAt = io.now(); await waitForStartup(engine.start(), abort.signal);
    report.startupMs = io.now() - startAt; if (haltReason) throw Error(haltReason);
    report.runtime = engine.status();
    if (report.runtime.verification !== 'PINNED_FILES_VERIFIED') throw Error('PINS_NOT_VERIFIED');
    if (report.runtime.settings?.promptCaching !== true || report.runtime.settings?.processingBatch !== 'compact' ||
        report.runtime.settings?.weightRepacking !== false) throw Error('CONFIGURATION_NOT_CONFIRMED');
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
  const plan = await prepareIdentityDiagnostic(args, readFrozenIdentityFixture(fixtureBytes));
  if (plan.action === '--check') {
    console.log(JSON.stringify({ status: 'PREPARED_NOT_EXECUTED', cases: plan.cases.length,
      coordinatorCaptures: plan.cases.filter(c => c.capture.coordinatorCalls === 1).length,
      fixtureSha256: hash(fixtureBytes), workersStarted: 0, receipt: IDENTITY_RECEIPT, resourceAdmission: 'NOT_CHECKED' })); return;
  }
  const sources = {};
  for (const rel of ['scripts/Exercise-ConversationIdentity.mjs', 'scripts/Exercise-ConversationGrounding.mjs',
    'companion/local-language-model.mjs', 'companion/conversation.mjs', 'companion/personas.json',
    'companion/models.lock.json', 'companion/llama-runtime-pins.json', 'research/CONVERSATION_IDENTITY_EVALUATION.md'])
    sources[rel] = hash(await readFile(path.join(root, rel)));
  const lock = JSON.parse(await readFile(path.join(root, 'companion/models.lock.json')));
  const evidence = { fixtureSha256: hash(fixtureBytes), sources,
    modelPins: lock.artifacts.filter(a => ['qwen4b', 'llama-cpu'].includes(a.id)),
    runtimePins: JSON.parse(await readFile(path.join(root, 'companion/llama-runtime-pins.json'))) };
  const report = await executeIdentityDiagnostic(plan, evidence);
  console.log(JSON.stringify({ status: report.status, completed: report.samples.filter(s => s.status === 'TEXT_COMPLETE_DIAGNOSTIC_ONLY').length,
    expected: plan.cases.length, haltReason: report.haltReason, ownedProcessStopped: report.ownedProcessStopped, receipt: IDENTITY_RECEIPT }));
  if (report.status !== 'COMPLETE_PENDING_SEMANTIC_REVIEW') process.exitCode = 1;
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url)
  main(process.argv.slice(2)).catch(error => {
    console.error(error.code === 'EEXIST' ? 'RECEIPT_EXISTS; no worker started and prior evidence preserved.' : error.message);
    process.exitCode = 1;
  });
