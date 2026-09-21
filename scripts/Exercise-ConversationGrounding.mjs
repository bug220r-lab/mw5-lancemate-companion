// Explicit, text-only component experiment. Imports start no worker.
import { readFile, open, writeFile, statfs } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createLocalLanguageModel, messagesFor } from '../companion/local-language-model.mjs';
import personas from '../companion/personas.json' with { type: 'json' };

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixturePath = path.join(root, 'synthetic/conversation-grounding-cases.json');
const GiB = 1024 ** 3;
const sha = bytes => createHash('sha256').update(bytes).digest('hex');

export function waitForStartup(pending, signal) {
  return new Promise((resolve, reject) => {
    const cleanup = () => signal.removeEventListener('abort', cancelled);
    const cancelled = () => { cleanup(); reject(Error('STARTUP_INTERRUPTED')); };
    signal.addEventListener('abort', cancelled, { once: true });
    // Keep both resolution handlers attached even after cancellation, so a
    // late adapter failure is handled without granting a second startup.
    Promise.resolve(pending).then(value => { cleanup(); resolve(value); }, error => { cleanup(); reject(error); });
    if (signal.aborted) cancelled();
  });
}

export function validateGroundingCases(fixture) {
  if (fixture?.schemaVersion !== 1 || fixture.classification !== 'MOCK_ONLY' || !Array.isArray(fixture.cases) ||
      fixture.cases.length !== 12 || new Set(fixture.cases.map(c => c?.id)).size !== 12) throw Error('INVALID_FIXTURE');
  return fixture.cases.map(c => {
    if (!c || typeof c.id !== 'string' || !/^[a-z0-9-]{1,64}$/.test(c.id) ||
        !['edge','tactician','scout'].includes(c.persona) ||
        !['requiredMeaning','forbiddenClaims'].every(k => Array.isArray(c[k]) && c[k].length > 0 &&
          c[k].every(v => typeof v === 'string' && v.trim())) || typeof c.rationale !== 'string' || !c.rationale.trim()) throw Error('INVALID_CASE');
    const context = { persona: personas.profiles.find(p => p.id === c.persona),
      request: { text: c.request }, facts: c.facts, history: c.history };
    // The actual adapter validates the prompt structure and length.
    const messages = messagesFor(context);
    return { specification: structuredClone(c), context, messages };
  });
}

async function main(args) {
  if (!['--run','--check'].includes(args[0]) || args.length > 2 || (args.length === 2 && !['--compact-batch','--compact-no-repack'].includes(args[1]))) {
    console.log('Use --check or --run, optionally with --compact-batch or --compact-no-repack. Nothing started.');
    return;
  }
  const fixtureBytes = await readFile(fixturePath);
  const cases = validateGroundingCases(JSON.parse(fixtureBytes));
  if (args[0] === '--check') { console.log(JSON.stringify({ status: 'VALID_FIXTURE', cases: cases.length, workersStarted: 0 })); return; }
  // Existing receipts are immutable experiments. Refusal occurs before engine construction/start.
  const compact = args.length === 2, weightRepacking = args[1] !== '--compact-no-repack';
  const receiptPath = path.join(root, 'research', !weightRepacking ? 'QWEN4B_GROUNDING_NOREPACK_DIAGNOSTIC.json' :
    compact ? 'QWEN4B_GROUNDING_COMPACT_DIAGNOSTIC.json' : 'QWEN4B_GROUNDING_DIAGNOSTIC.json');
  const ownedReceipt = await open(receiptPath, 'wx'); await ownedReceipt.close();
  const engine = createLocalLanguageModel({ modelId: 'qwen4b', threads: 4, processingBatch: compact ? 'compact' : 'default', weightRepacking });
  const abort = new AbortController(), began = performance.now();
  let stopPromise = null, resourceTimer, deadlineTimer, haltReason = null;
  const report = { schemaVersion: 1, classification: 'LOCAL_CPU_DIAGNOSTIC_SYNTHETIC_PROMPTS',
    recordedAt: new Date().toISOString(), status: 'PREFLIGHT', fixtureSha256: sha(fixtureBytes),
    fixture: JSON.parse(fixtureBytes), sources: {}, modelId: 'qwen4b', samples: [],
    settings: { perCaseDeadlineMs: 10000, totalWorkBudgetMs: 233000, cleanupBudgetMs: 7000,
      minimumRamBytes: 2 * GiB, workingDiskReserveBytes: 10 * GiB, simultaneousModels: 1,
      processingBatch: compact ? 'compact' : 'default', weightRepacking, logicalBatchTokens: compact ? 128 : 2048, physicalBatchTokens: compact ? 64 : 512,
      targetFirstSpokenMs: 4000, temperature: .7, topP: .8, topK: 20, fixedSeed: false, cachePrompt: false },
    minimumAvailableRamBytes: os.freemem(), defaultModelChanged: false, candidateEnabled: false,
    downloads: false, gameExecution: false, audioGenerated: false, microphoneCapture: false, speakerPlayback: false,
    nativeCalls: 0, independentSemanticReview: 'NOT_PERFORMED', gameAcceptance: 'NOT_PERFORMED' };
  const save = () => writeFile(receiptPath, JSON.stringify(report, null, 2) + '\n');
  const stopOnce = () => stopPromise ??= engine.stop();
  const halt = reason => {
    if (haltReason) return;
    haltReason = reason; abort.abort(reason); void stopOnce().catch(() => {});
  };
  const sampleMemory = () => {
    const bytes = os.freemem(); report.minimumAvailableRamBytes = Math.min(report.minimumAvailableRamBytes, bytes);
    if (bytes < 2 * GiB) halt('RAM_RESERVE_LOST');
  };
  const interrupted = () => halt('SUPERVISOR_INTERRUPTED');
  process.on('SIGINT', interrupted); process.on('SIGTERM', interrupted);
  deadlineTimer = setTimeout(() => halt('GLOBAL_TIME_LIMIT'), Math.max(1, 233000 - (performance.now() - began)));
  try {
    await save();
    const disk = await statfs(root); report.initialFreeDiskBytes = disk.bavail * disk.bsize;
    if (report.initialFreeDiskBytes < 10 * GiB) throw Error('DISK_RESERVE_INSUFFICIENT');
    // Conservative preflight for the already installed 2.5GB model plus runtime/KV overhead.
    if (os.freemem() < 5 * GiB) throw Error('INITIAL_RAM_INSUFFICIENT');
    for (const rel of ['scripts/Exercise-ConversationGrounding.mjs', 'companion/local-language-model.mjs',
      'companion/personas.json', 'companion/models.lock.json', 'companion/llama-runtime-pins.json']) report.sources[rel] = sha(await readFile(path.join(root, rel)));
    resourceTimer = setInterval(sampleMemory, 250); sampleMemory();
    if (haltReason) throw Error(haltReason);
    const startAt = performance.now(); await waitForStartup(engine.start(), abort.signal); report.startupMs = performance.now() - startAt;
    if (haltReason) throw Error(haltReason);
    report.runtime = engine.status();
    if (report.runtime.verification !== 'PINNED_FILES_VERIFIED') throw Error('PINS_NOT_VERIFIED');
    report.status = 'RUNNING'; await save();
    for (const { specification, context, messages } of cases) {
      sampleMemory(); if (haltReason) throw Error(haltReason);
      const sample = { id: specification.id, messages, status: 'RUNNING', output: null,
        semanticReview: 'NOT_PERFORMED', dispatched: false, played: false };
      report.samples.push(sample); const started = performance.now();
      const timeout = AbortSignal.timeout(10000), signal = AbortSignal.any([abort.signal, timeout]);
      try {
        sample.output = await engine.generate(context, { signal });
        if (signal.aborted) throw Error('DIAGNOSTIC_CANCELLED');
        sample.status = 'TEXT_COMPLETE_DIAGNOSTIC_ONLY';
      } catch (error) {
        sample.status = 'FAILED'; sample.error = error.message;
        halt(timeout.aborted ? 'CASE_DEADLINE' : haltReason ?? 'CASE_FAILED');
        throw error;
      } finally { sample.elapsedMs = performance.now() - started; await save(); }
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
    const final = engine.status(); report.ownedProcessStopped = final.ownedProcessStopped;
    if (!final.ownedProcessStopped) report.status = 'OWNED_PROCESS_STOP_UNCONFIRMED';
    report.finalRuntime = final; report.haltReason = haltReason;
    report.notPerformed = cases.filter(c => !report.samples.some(s => s.id === c.specification.id)).map(c => c.specification.id);
    report.totalElapsedMs = performance.now() - began; report.completedAt = new Date().toISOString();
    try {
      await save();
      console.log(JSON.stringify({ status: report.status, completed: report.samples.filter(s => s.status === 'TEXT_COMPLETE_DIAGNOSTIC_ONLY').length,
        expected: cases.length, haltReason, ownedProcessStopped: report.ownedProcessStopped, receipt: path.relative(root, receiptPath) }));
    } finally { process.removeListener('SIGINT', interrupted); process.removeListener('SIGTERM', interrupted); }
  }
  if (report.status !== 'COMPLETE_PENDING_SEMANTIC_REVIEW') process.exitCode = 1;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url)
  main(process.argv.slice(2)).catch(error => { console.error(error.code === 'EEXIST' ? 'RECEIPT_EXISTS; no worker started and prior evidence preserved.' : error.message); process.exitCode = 1; });
