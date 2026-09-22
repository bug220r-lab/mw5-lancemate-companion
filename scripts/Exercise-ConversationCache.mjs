// One explicit cache experiment. Import/check starts no worker; prior receipts stay immutable.
import { readFile, open, writeFile, statfs } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createLocalLanguageModel, messagesFor } from '../companion/local-language-model.mjs';
import { validateGroundingCases, waitForStartup } from './Exercise-ConversationGrounding.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GiB = 1024 ** 3;
const fixtureRelative = 'synthetic/conversation-grounding-cases.json';
const receiptRelative = 'research/QWEN4B_PROMPT_CACHE_DIAGNOSTIC.json';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');

export function prepareCacheDiagnostic(args, fixture) {
  if (args.length !== 1 || !['--check', '--run'].includes(args[0])) throw Error('INVALID_ARGUMENTS');
  // This calibration is independent of all holdout requests, facts, histories and identities.
  const primer = { persona: { id: 'calibration' }, request: { text: 'Say OK.' }, facts: [], history: [] };
  return { action: args[0], primer, primerMessages: messagesFor(primer), cases: validateGroundingCases(fixture) };
}

async function main(args) {
  const fixtureBytes = await readFile(path.join(root, fixtureRelative));
  const plan = prepareCacheDiagnostic(args, JSON.parse(fixtureBytes));
  if (plan.action === '--check') {
    console.log(JSON.stringify({ status: 'PREPARED_NOT_EXECUTED', cases: plan.cases.length, primer: plan.primer,
      receipt: receiptRelative, workersStarted: 0, resourceAdmission: 'NOT_CHECKED' })); return;
  }
  const receiptPath = path.join(root, receiptRelative);
  const reservation = await open(receiptPath, 'wx'); await reservation.close();
  const engine = createLocalLanguageModel({ modelId: 'qwen4b', threads: 4, processingBatch: 'compact',
    weightRepacking: false, promptCaching: true });
  const began = performance.now(), abort = new AbortController();
  let stopPromise = null, resourceTimer, deadlineTimer, haltReason = null;
  const report = {
    schemaVersion: 1, recordedAt: new Date().toISOString(), status: 'PREFLIGHT',
    classification: 'LOCAL_CPU_CACHE_DIAGNOSTIC_SYNTHETIC_PROMPTS', fixtureSha256: sha(fixtureBytes),
    fixture: JSON.parse(fixtureBytes), sources: {}, modelId: 'qwen4b', primer: null, samples: [],
    settings: { cachePrompt: true, processingBatch: 'compact', weightRepacking: false,
      logicalBatchTokens: 128, physicalBatchTokens: 64, threads: 4, contextTokens: 2048,
      maxOutputTokens: 64, maxOutputChars: 256, temperature: .7, topP: .8, topK: 20, fixedSeed: false,
      perOperationDeadlineMs: 10000, totalWorkBudgetMs: 233000, cleanupBudgetMs: 7000,
      initialRamRequirementBytes: 5 * GiB, minimumRamBytes: 2 * GiB, workingDiskReserveBytes: 10 * GiB,
      resourceSampleIntervalMs: 250, simultaneousModels: 1, nativeSlots: 1, targetFirstSpokenMs: 4000,
      secondaryCacheLimitMiB: 8192, secondaryCacheLimitBasis: 'PINNED_SOURCE_DEFAULT_NOT_MEASURED_ALLOCATION' },
    minimumAvailableRamBytes: os.freemem(), defaultModelChanged: false, defaultCachingChanged: false,
    downloads: false, gameExecution: false, audioGenerated: false, microphoneCapture: false, speakerPlayback: false,
    independentSemanticReview: 'NOT_PERFORMED', gameAcceptance: 'NOT_PERFORMED',
    limitations: ['Primer output is discarded and never included in any case history.',
      'Each case still sends its full unchanged prompt. Cache counts are native runtime reports, not independently measured tokens.',
      'Startup and primer are reported separately and included in total time; warm text is not cold-start or spoken latency.',
      'Single stochastic diagnostic, no controlled speed comparison or acceptance claim.',
      'RAM sampling is reactive and cannot guarantee uninterrupted reserve. No game workload is running.']
  };
  const save = () => writeFile(receiptPath, JSON.stringify(report, null, 2) + '\n');
  const stopOnce = () => stopPromise ??= engine.stop();
  const halt = reason => { if (haltReason) return; haltReason = reason; abort.abort(reason); void stopOnce().catch(() => {}); };
  const sampleMemory = () => {
    const bytes = os.freemem(); report.minimumAvailableRamBytes = Math.min(report.minimumAvailableRamBytes, bytes);
    if (bytes < 2 * GiB) halt('RAM_RESERVE_LOST');
  };
  const interrupted = () => halt('SUPERVISOR_INTERRUPTED');
  process.on('SIGINT', interrupted); process.on('SIGTERM', interrupted);
  deadlineTimer = setTimeout(() => halt('GLOBAL_TIME_LIMIT'), Math.max(1, 233000 - (performance.now() - began)));

  async function perform(sample, context) {
    sampleMemory(); if (haltReason) throw Error(haltReason);
    sample.status = 'RUNNING';
    const started = performance.now(), timeout = AbortSignal.timeout(10000);
    const signal = AbortSignal.any([abort.signal, timeout]);
    try {
      sample.output = await engine.generate(context, { signal });
      if (signal.aborted) throw Error('DIAGNOSTIC_CANCELLED');
      sample.status = 'TEXT_COMPLETE_DIAGNOSTIC_ONLY';
    } catch (error) {
      sample.status = 'FAILED'; sample.error = error.message;
      halt(timeout.aborted ? 'OPERATION_DEADLINE' : haltReason ?? 'OPERATION_FAILED'); throw error;
    } finally {
      sample.elapsedMs = performance.now() - started;
      const state = engine.status();
      sample.nativeTimings = sample.status === 'TEXT_COMPLETE_DIAGNOSTIC_ONLY' ? state.lastGenerationTimings ?? null : null;
      sample.cacheObservation = sample.nativeTimings === null ? 'UNKNOWN' :
        sample.nativeTimings.cache_n > 0 ? 'NATIVE_REPORTED_PREFIX_REUSE' : 'NATIVE_REPORTED_NO_PREFIX_REUSE';
      sample.runtimeLog = state.log; await save();
    }
  }

  try {
    await save();
    const disk = await statfs(root); report.initialFreeDiskBytes = disk.bavail * disk.bsize;
    report.initialAvailableRamBytes = os.freemem();
    if (report.initialFreeDiskBytes < 10 * GiB) throw Error('DISK_RESERVE_INSUFFICIENT');
    if (report.initialAvailableRamBytes < 5 * GiB) throw Error('INITIAL_RAM_INSUFFICIENT');
    for (const rel of ['scripts/Exercise-ConversationCache.mjs', 'scripts/Exercise-ConversationGrounding.mjs',
      'companion/local-language-model.mjs', 'companion/personas.json', 'companion/models.lock.json',
      'companion/llama-runtime-pins.json']) report.sources[rel] = sha(await readFile(path.join(root, rel)));
    resourceTimer = setInterval(sampleMemory, 250); sampleMemory(); if (haltReason) throw Error(haltReason);
    const startAt = performance.now(); await waitForStartup(engine.start(), abort.signal);
    report.startupMs = performance.now() - startAt; if (haltReason) throw Error(haltReason);
    report.runtime = engine.status();
    if (report.runtime.verification !== 'PINNED_FILES_VERIFIED') throw Error('PINS_NOT_VERIFIED');
    if (report.runtime.settings.promptCaching !== true) throw Error('CACHE_CONFIGURATION_NOT_CONFIRMED');
    report.status = 'PRIMING';
    report.primer = { status: 'NOT_PERFORMED', messages: plan.primerMessages, output: null,
      purpose: 'DISCARDED_CALIBRATION_ONLY', semanticReview: 'NOT_APPLICABLE', dispatched: false, played: false };
    await save(); await perform(report.primer, plan.primer);
    report.status = 'RUNNING';
    for (const c of plan.cases) {
      const sample = { id: c.specification.id, status: 'NOT_PERFORMED', messages: c.messages, output: null,
        semanticReview: 'NOT_PERFORMED', dispatched: false, played: false };
      report.samples.push(sample); await perform(sample, c.context);
    }
    report.status = 'COMPLETE_PENDING_SEMANTIC_REVIEW';
  } catch (error) { report.status = 'INCOMPLETE'; report.error = error.message; }
  finally {
    clearInterval(resourceTimer); clearTimeout(deadlineTimer); abort.abort();
    let cleanupTimer;
    try {
      await Promise.race([stopOnce(), new Promise((_, reject) => {
        cleanupTimer = setTimeout(() => reject(Error('CLEANUP_DEADLINE')), 7000);
      })]);
    } catch (error) { report.status = 'OWNED_PROCESS_STOP_UNCONFIRMED'; report.stopError = error.message; }
    finally { clearTimeout(cleanupTimer); }
    const final = engine.status(); report.finalRuntime = final; report.ownedProcessStopped = final.ownedProcessStopped;
    if (!final.ownedProcessStopped) report.status = 'OWNED_PROCESS_STOP_UNCONFIRMED';
    report.haltReason = haltReason;
    report.notPerformed = plan.cases.filter(c => !report.samples.some(s =>
      s.id === c.specification.id && s.status !== 'NOT_PERFORMED')).map(c => c.specification.id);
    report.totalElapsedMs = performance.now() - began; report.completedAt = new Date().toISOString();
    try { await save(); console.log(JSON.stringify({ status: report.status,
      completed: report.samples.filter(s => s.status === 'TEXT_COMPLETE_DIAGNOSTIC_ONLY').length,
      expected: plan.cases.length, haltReason, ownedProcessStopped: report.ownedProcessStopped, receipt: receiptRelative })); }
    finally { process.removeListener('SIGINT', interrupted); process.removeListener('SIGTERM', interrupted); }
  }
  if (report.status !== 'COMPLETE_PENDING_SEMANTIC_REVIEW') process.exitCode = 1;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url)
  main(process.argv.slice(2)).catch(error => {
    console.error(error.code === 'EEXIST' ? 'RECEIPT_EXISTS; no worker started and prior evidence preserved.' : error.message);
    process.exitCode = 1;
  });
