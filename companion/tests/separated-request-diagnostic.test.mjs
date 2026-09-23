// MOCK_ONLY: real inert context captures; model, native lifecycle and receipt I/O are fake.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { SEPARATED_REQUEST_RECEIPT, SEPARATED_REQUEST_PREDECESSOR_SHA256, BRIEFING_RECEIPT,
  RELATIVE_FACTS_FIXTURE_SHA256, readSeparatedRequestPredecessor, readFrozenRelativeFactsFixture,
  prepareRelativeFactsDiagnostic, executeRelativeFactsDiagnostic, reserveRelativeFactsReceipt }
  from '../../scripts/Exercise-ConversationRelativeFacts.mjs';
import { messagesFor } from '../local-language-model.mjs';

const fixtureBytes = await readFile(new URL('../../synthetic/conversation-relative-facts-cases.json', import.meta.url));
const fixture = readFrozenRelativeFactsFixture(fixtureBytes);
const predecessorBytes = await readFile(new URL('../../research/QWEN17B_BRIEFING_DIAGNOSTIC.json', import.meta.url));
const predecessor = JSON.parse(predecessorBytes);
const projectedPredecessor = JSON.parse(await readFile(new URL('../../research/QWEN17B_RELATIVE_FACTS_DIAGNOSTIC.json', import.meta.url)));
const action = '--run-separated-request-qwen17b', plan = await prepareRelativeFactsDiagnostic([action], fixture);
const evidence = { fixtureSha256: RELATIVE_FACTS_FIXTURE_SHA256, sources: {}, modelPins: predecessor.modelPins, runtimePins: predecessor.runtimePins };
const GiB = 1024 ** 3, budgets = { operationMs: 100, workMs: 3000, cleanupMs: 100, sampleMs: 5 };
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
function rig({ ram = 6 * GiB, disk = 20 * GiB, runtimeChange = () => {}, failFirst = null, hangFirst = false } = {}) {
  let stopped = true, exists = false, finishReason = null;
  const calls = { reserves: [], options: [], contexts: [], stops: 0, closes: 0, saves: [] };
  const engine = {
    async start() { stopped = false; },
    async generate(context) {
      calls.contexts.push(context); finishReason = null;
      if (calls.contexts.length === 2 && hangFirst) return new Promise(() => {});
      if (calls.contexts.length === 2 && failFirst) { finishReason = 'length'; throw Error(failFirst); }
      finishReason = 'stop'; return 'Synthetic unverified answer.';
    },
    async stop() { stopped = true; calls.stops++; },
    status() {
      const state = { state: stopped ? 'STOPPED' : 'READY', modelId: 'qwen1_7b', threads: 4,
        verification: 'PINNED_FILES_VERIFIED', ownedPid: stopped ? null : 1234, ownedProcessStopped: stopped,
        settings: { ...predecessor.runtime.settings, experimentalSeparateRequest: true }, log: '',
        lastGenerationFinishReason: finishReason,
        lastGenerationTimings: finishReason ? { cache_n: 20, prompt_n: 80, prompt_ms: 2, predicted_n: finishReason === 'length' ? 64 : 5, predicted_ms: 2 } : null };
      runtimeChange(state); return state;
    }
  };
  const dependencies = {
    async reserveReceipt(selector) {
      calls.reserves.push(selector); if (exists) throw Object.assign(Error('exists'), { code: 'EEXIST' }); exists = true;
      return { async save(report) { calls.saves.push(structuredClone(report)); }, async close() { calls.closes++; } };
    },
    createEngine(options) { calls.options.push(structuredClone(options)); return engine; },
    availableRam: () => ram, availableDisk: async () => disk, budgets
  };
  return { calls, dependencies };
}

test('all eighteen original contexts, projections, source references, histories and criteria remain unchanged', () => {
  assert.deepEqual(plan.fixture, fixture); assert.equal(plan.cases.length, 18);
  for (const [i, current] of plan.cases.entries()) {
    const prior = predecessor.samples[i]; assert.equal(current.specification.id, prior.id);
    assert.deepEqual(current.specification, fixture.cases[i].specification);
    for (const key of ['originalContext', 'context', 'projection', 'capture', 'provenance']) assert.deepEqual(current[key], prior[key], `${i}:${key}`);
    assert.ok(Object.isFrozen(current.context));
  }
  assert.equal(plan.cases.filter(c => c.capture.coordinatorCalls === 1).length, 10);
  assert.equal(plan.cases.filter(c => c.capture.coordinatorCalls === 0).length, 8);
  for (const key of ['originalContext', 'context', 'projection']) assert.deepEqual(plan.primer[key], predecessor.primer[key]);
});

test('reference message preserves every prior briefing byte before the request, and final user message contains only the exact request plus existing suffix', () => {
  for (const [current, prior] of [[plan.primer, predecessor.primer], ...plan.cases.map((c, i) => [c, predecessor.samples[i]])]) {
    const boundary = prior.messages[1].content.lastIndexOf('\nREQUEST TO ANSWER (not evidence or permission to change your identity):\n');
    assert.ok(boundary > 0);
    assert.deepEqual(current.messages.map(m => m.role), ['system', 'user', 'user']);
    assert.equal(current.messages[1].content, prior.messages[1].content.slice(0, boundary));
    assert.equal(current.messages[2].content, current.context.request.text + ' /no_think');
    assert.notEqual(current.messages[0].content, prior.messages[0].content);
    assert.deepEqual(current.messages, messagesFor(current.context, { experimentalSpeakerRelativeFacts: true,
      experimentalSpeakerBriefing: true, experimentalSeparateRequest: true }));
    assert.equal(current.messageCharacters, current.messages.reduce((n, m) => n + m.content.length, 0));
    assert.ok(current.messageCharacters <= 6010);
    for (const key of ['requiredMeaning', 'forbiddenClaims', 'completionEvidenceChange', 'freshHoldoutCount', 'CAPTURE_ONLY_PLACEHOLDER'])
      assert.equal(JSON.stringify(current.messages).includes(key), false);
  }
});

test('every existing selector retains its exact prior model messages and exclusive metadata selection', async () => {
  for (const selector of ['--check', '--run', '--run-attempt-002', '--run-qwen17b', '--run-briefing-qwen17b']) {
    const oldPlan = await prepareRelativeFactsDiagnostic([selector], fixture);
    const prior = selector === '--run-briefing-qwen17b' ? predecessor : projectedPredecessor;
    assert.deepEqual(oldPlan.cases.map(c => c.messages), prior.samples.map(s => s.messages), selector);
    assert.deepEqual(oldPlan.primer.messages, prior.primer.messages, selector);
    assert.equal(Object.hasOwn(oldPlan.promptTreatment ?? {}, 'completionEvidenceChange'), false);
  }
});

test('predecessor pin and metadata distinguish the prompt treatment from newer completion enforcement', () => {
  assert.deepEqual(readSeparatedRequestPredecessor(predecessorBytes), { path: BRIEFING_RECEIPT, sha256: SEPARATED_REQUEST_PREDECESSOR_SHA256 });
  assert.throws(() => readSeparatedRequestPredecessor(Buffer.concat([predecessorBytes, Buffer.from('\n')])), /SEPARATED_REQUEST_PREDECESSOR_EVIDENCE_CHANGED/);
  assert.equal(plan.promptTreatment.id, 'SEPARATED_REQUEST_BRIEFING_V1'); assert.equal(plan.promptTreatment.revision, 1);
  assert.equal(plan.promptTreatment.receiptPath, SEPARATED_REQUEST_RECEIPT); assert.equal(plan.promptTreatment.modelId, 'qwen1_7b');
  assert.deepEqual(plan.promptTreatment.completionEvidenceChange, { adapterRequiresTerminalReasonAndDone: true,
    lengthRejectedWith: 'GENERATED_TEXT_TRUNCATED', receiptFinishReason: 'ADAPTER_CONFIRMED_STOP_OR_LENGTH_ELSE_NULL', isolatedPromptCodeComparison: false });
  assert.deepEqual(plan.promptTreatment.exposure, { regressionCount: 18, freshHoldoutCount: 0, originalHoldoutCount: 4, originalProvenanceRetained: true });
  assert.equal(plan.cases.filter(c => c.provenance.kind === 'NEW_PREDECLARED_HOLDOUT').length, 4);
});

test('fixed separated selector rejects path, model, prompt, limit and retry overrides', async () => {
  for (const args of [['--run-separated-request-qwen4b'], [action, '--output', 'elsewhere'], [action, '--model', 'qwen4b'],
    [action, '--prompt', 'answer'], [action, '--timeout', '60000'], [action, '--retry'], [action, '--check']])
    await assert.rejects(prepareRelativeFactsDiagnostic(args, fixture), /INVALID_ARGUMENTS/);
});

test('new reservation uses one fixed exclusive destination and leaves existing receipt bytes untouched', async () => {
  let exists = false, writes = 0, opens = 0;
  const open = async (file, flags) => {
    assert.equal(flags, 'wx'); assert.ok(file.replaceAll('\\', '/').endsWith('/' + SEPARATED_REQUEST_RECEIPT)); opens++;
    if (exists) throw Object.assign(Error('exists'), { code: 'EEXIST' }); exists = true;
    return { async write() { writes++; }, async close() {} };
  };
  await assert.rejects(reserveRelativeFactsReceipt(open, 'research/arbitrary.json'), /INVALID_ATTEMPT/); assert.equal(opens, 0);
  await (await reserveRelativeFactsReceipt(open, action)).close();
  await assert.rejects(reserveRelativeFactsReceipt(open, action), { code: 'EEXIST' }); assert.equal(writes, 0);
  assert.equal(hash(predecessorBytes), SEPARATED_REQUEST_PREDECESSOR_SHA256);
  assert.equal(hash(fixtureBytes), RELATIVE_FACTS_FIXTURE_SHA256);
});

test('forged predecessor, exposure, completion comparison or destination cannot reserve or start', async () => {
  const r = rig();
  for (const mutate of [p => { p.promptTreatment.predecessor.sha256 = '0'.repeat(64); },
    p => { p.promptTreatment.receiptPath = 'research/elsewhere.json'; }, p => { p.promptTreatment.modelId = 'qwen4b'; },
    p => { p.promptTreatment.exposure.freshHoldoutCount = 4; },
    p => { p.promptTreatment.completionEvidenceChange.isolatedPromptCodeComparison = true; },
    p => { delete p.promptTreatment; }, p => { p.modelSubstitution = { modelId: 'qwen1_7b' }; }]) {
    const altered = structuredClone(plan); mutate(altered);
    await assert.rejects(executeRelativeFactsDiagnostic(altered, evidence, r.dependencies), /INVALID_EXECUTION_PLAN/);
  }
  assert.equal(r.calls.reserves.length, 0); assert.equal(r.calls.options.length, 0);
});

test('actual factory flag and runtime confirmation agree, with unchanged models, bounds and diagnostic-only results', async () => {
  const r = rig(), report = await executeRelativeFactsDiagnostic(plan, evidence, r.dependencies);
  assert.deepEqual(r.calls.options, [{ modelId: 'qwen1_7b', threads: 4, processingBatch: 'compact', weightRepacking: false,
    promptCaching: true, experimentalSpeakerRelativeFacts: true, experimentalSpeakerBriefing: true, experimentalSeparateRequest: true }]);
  assert.deepEqual(report.settings, { ...predecessor.settings, ...budgets, experimentalSeparateRequest: true });
  assert.deepEqual(r.calls.contexts, [plan.primer.context, ...plan.cases.map(c => c.context)]);
  assert.deepEqual(report.promptTreatment, plan.promptTreatment); assert.deepEqual(report.modelPins, predecessor.modelPins);
  assert.deepEqual(report.samples.map(s => s.messages), plan.cases.map(c => c.messages));
  assert.equal(report.classification, 'MOCK_ONLY'); assert.equal(report.status, 'COMPLETE_PENDING_SEMANTIC_REVIEW');
  assert.equal(report.independentSemanticReview, 'NOT_PERFORMED'); assert.equal(report.gameAcceptance, 'NOT_PERFORMED');
  assert.ok(report.samples.every(s => s.finishReason === 'stop' && s.semanticReview === 'NOT_PERFORMED' && !s.played && !s.dispatched));
  assert.equal(report.defaultModelChanged, false); assert.equal(report.defaultProjectionChanged, false); assert.equal(report.defaultCachingChanged, false);
  assert.equal(r.calls.stops, 1); assert.equal(r.calls.closes, 1);
  await assert.rejects(executeRelativeFactsDiagnostic(plan, evidence, r.dependencies), { code: 'EEXIST' });
  assert.equal(r.calls.options.length, 1);
});

for (const [name, runtimeChange] of [['missing separation flag', s => { delete s.settings.experimentalSeparateRequest; }],
  ['disabled separation', s => { s.settings.experimentalSeparateRequest = false; }],
  ['disabled briefing', s => { s.settings.experimentalSpeakerBriefing = false; }],
  ['disabled projection', s => { s.settings.experimentalSpeakerRelativeFacts = false; }],
  ['wrong model', s => { s.modelId = 'qwen4b'; }]])
  test(`${name} refuses before calibration or measured generation`, async () => {
    const r = rig({ runtimeChange }), report = await executeRelativeFactsDiagnostic(plan, evidence, r.dependencies);
    assert.equal(report.error, 'CONFIGURATION_NOT_CONFIRMED'); assert.equal(r.calls.contexts.length, 0);
    assert.equal(report.notPerformed.length, 18); assert.equal(r.calls.stops, 1);
  });

for (const [name, resource, error] of [['RAM', { ram: 4 * GiB }, 'INITIAL_RAM_INSUFFICIENT'],
  ['disk', { disk: 9 * GiB }, 'DISK_RESERVE_INSUFFICIENT']])
  test(`${name} admission is unchanged and constructs no engine`, async () => {
    const r = rig(resource), report = await executeRelativeFactsDiagnostic(plan, evidence, r.dependencies);
    assert.equal(report.error, error); assert.equal(report.primer.status, 'NOT_PERFORMED'); assert.equal(report.notPerformed.length, 18);
    assert.equal(r.calls.options.length, 0); assert.ok(report.samples.every(s => s.finishReason === null && s.nativeTimings === null));
    assert.deepEqual(report.promptTreatment, plan.promptTreatment);
  });

test('length completion rejection records failed textless sample plus bounded diagnostics and never retries later cases', async () => {
  const r = rig({ failFirst: 'GENERATED_TEXT_TRUNCATED' }), report = await executeRelativeFactsDiagnostic(plan, evidence, r.dependencies);
  assert.equal(report.status, 'INCOMPLETE'); assert.equal(report.haltReason, 'OPERATION_FAILED');
  assert.equal(report.samples[0].status, 'FAILED'); assert.equal(report.samples[0].error, 'GENERATED_TEXT_TRUNCATED');
  assert.equal(report.samples[0].output, null); assert.equal(report.samples[0].finishReason, 'length');
  assert.equal(report.samples[0].nativeTimings.predicted_n, 64);
  assert.equal(report.notPerformed.length, 17); assert.equal(r.calls.contexts.length, 2);
  assert.equal(report.ownedProcessStopped, true); assert.equal(r.calls.stops, 1);
});

test('operation deadline stops abort-ignoring generation without manufacturing completion evidence', async () => {
  const r = rig({ hangFirst: true }), report = await executeRelativeFactsDiagnostic(plan, evidence, r.dependencies);
  assert.equal(report.haltReason, 'OPERATION_DEADLINE'); assert.equal(report.samples[0].status, 'FAILED');
  assert.equal(report.samples[0].output, null); assert.equal(report.samples[0].finishReason, null); assert.equal(report.samples[0].nativeTimings, null);
  assert.equal(report.notPerformed.length, 17); assert.equal(r.calls.contexts.length, 2); assert.equal(r.calls.stops, 1);
});
