// MOCK_ONLY: real coordinator capture, but every model/receipt operation is inert.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { BRIEFING_RECEIPT, BRIEFING_PREDECESSOR_SHA256, RELATIVE_FACTS_FIXTURE_SHA256,
  RELATIVE_FACTS_QWEN17B_RECEIPT, readBriefingPredecessor, readFrozenRelativeFactsFixture,
  prepareRelativeFactsDiagnostic, executeRelativeFactsDiagnostic, reserveRelativeFactsReceipt }
  from '../../scripts/Exercise-ConversationRelativeFacts.mjs';
import { messagesFor } from '../local-language-model.mjs';

const fixture = readFrozenRelativeFactsFixture(await readFile(new URL('../../synthetic/conversation-relative-facts-cases.json', import.meta.url)));
const predecessorBytes = await readFile(new URL('../../research/QWEN17B_RELATIVE_FACTS_DIAGNOSTIC.json', import.meta.url));
const predecessor = JSON.parse(predecessorBytes), plan = await prepareRelativeFactsDiagnostic(['--run-briefing-qwen17b'], fixture);
const GiB = 1024 ** 3;
const evidence = { fixtureSha256: RELATIVE_FACTS_FIXTURE_SHA256, sources: {}, modelPins: predecessor.modelPins, runtimePins: predecessor.runtimePins };
const fakeBudgets = { operationMs: 200, workMs: 3000, cleanupMs: 100, sampleMs: 5 };
function rig({ ram = 6 * GiB, runtimeChange = () => {} } = {}) {
  let stopped = true, exists = false;
  const calls = { reserves: [], options: [], contexts: [], stops: 0, closes: 0, saves: [] };
  const engine = {
    async start() { stopped = false; },
    async generate(context) { calls.contexts.push(context); return 'Synthetic unverified output.'; },
    async stop() { stopped = true; calls.stops++; },
    status() {
      const value = { state: stopped ? 'STOPPED' : 'READY', modelId: 'qwen1_7b', threads: 4,
        verification: 'PINNED_FILES_VERIFIED', ownedPid: stopped ? null : 1234, ownedProcessStopped: stopped,
        settings: { ...predecessor.runtime.settings, experimentalSpeakerBriefing: true }, log: '',
        lastGenerationTimings: { cache_n: 0, prompt_n: 80, prompt_ms: 1, predicted_n: 5, predicted_ms: 1 } };
      runtimeChange(value); return value;
    }
  };
  const dependencies = {
    async reserveReceipt(action) {
      calls.reserves.push(action); if (exists) throw Object.assign(Error('exists'), { code: 'EEXIST' }); exists = true;
      return { async save(report) { calls.saves.push(structuredClone(report)); }, async close() { calls.closes++; } };
    },
    createEngine(options) { calls.options.push(structuredClone(options)); return engine; },
    availableRam: () => ram, availableDisk: async () => 20 * GiB, budgets: fakeBudgets
  };
  return { calls, dependencies };
}

test('briefing changes messages only; all original contexts, projections, criteria and case order remain exact', async () => {
  assert.deepEqual(plan.fixture, fixture); assert.equal(plan.cases.length, 18);
  assert.deepEqual(plan.cases.map(c => c.capture.coordinatorCalls), predecessor.samples.map(c => c.capture.coordinatorCalls));
  for (const [i, c] of plan.cases.entries()) {
    const old = predecessor.samples[i]; assert.equal(c.specification.id, old.id);
    for (const key of ['originalContext', 'context', 'projection', 'capture', 'provenance']) assert.deepEqual(c[key], old[key], `${i}:${key}`);
    assert.deepEqual(c.specification, fixture.cases[i].specification);
    assert.deepEqual(c.messages, messagesFor(c.context, { experimentalSpeakerRelativeFacts: true, experimentalSpeakerBriefing: true }));
    assert.notDeepEqual(c.messages, old.messages); assert.deepEqual(c.messages.map(m => m.role), ['system', 'user']);
    assert.equal(c.messageCharacters, c.messages.reduce((n, m) => n + m.content.length, 0));
    assert.ok(c.messageCharacters < 6010);
  }
  for (const key of ['originalContext', 'context', 'projection']) assert.deepEqual(plan.primer[key], predecessor.primer[key]);
  assert.deepEqual(plan.primer.messages, messagesFor(plan.primer.context, { experimentalSpeakerRelativeFacts: true, experimentalSpeakerBriefing: true }));
  const old = await prepareRelativeFactsDiagnostic(['--check'], fixture);
  assert.deepEqual(old.cases.map(c => c.messages), predecessor.samples.map(c => c.messages));
  assert.deepEqual(old.primer.messages, predecessor.primer.messages); assert.equal(Object.hasOwn(old, 'promptTreatment'), false);
});

test('predecessor evidence and fixed prompt metadata identify exposed regressions without rewriting historical provenance', () => {
  assert.deepEqual(readBriefingPredecessor(predecessorBytes), { path: RELATIVE_FACTS_QWEN17B_RECEIPT, sha256: BRIEFING_PREDECESSOR_SHA256 });
  assert.throws(() => readBriefingPredecessor(Buffer.concat([predecessorBytes, Buffer.from('\n')])), /BRIEFING_PREDECESSOR_EVIDENCE_CHANGED/);
  assert.equal(plan.promptTreatment.id, 'SPEAKER_FACT_BRIEFING_V1'); assert.equal(plan.promptTreatment.revision, 1);
  assert.equal(plan.promptTreatment.receiptPath, BRIEFING_RECEIPT); assert.equal(plan.promptTreatment.modelId, 'qwen1_7b');
  assert.deepEqual(plan.promptTreatment.exposure, { regressionCount: 18, freshHoldoutCount: 0, originalHoldoutCount: 4, originalProvenanceRetained: true });
  assert.equal(plan.cases.filter(c => c.provenance.kind === 'NEW_PREDECLARED_HOLDOUT').length, 4);
  for (const c of plan.cases) {
    const prompt = JSON.stringify(c.messages);
    for (const key of ['requiredMeaning', 'forbiddenClaims', 'promptTreatment', 'originalHoldoutCount']) assert.equal(prompt.includes(key), false);
  }
});

test('briefing CLI has no output/model/prompt/deadline/retry tuning interface', async () => {
  for (const args of [['--run-briefing-qwen4b'], ['--run-briefing-qwen17b', '--output', 'elsewhere'],
    ['--run-briefing-qwen17b', '--model', 'qwen4b'], ['--run-briefing-qwen17b', '--timeout', '60000'],
    ['--run-briefing-qwen17b', '--retry'], ['--run-briefing-qwen17b', '--prompt', 'expected answer']])
    await assert.rejects(prepareRelativeFactsDiagnostic(args, fixture), /INVALID_ARGUMENTS/);
});

test('briefing reservation exclusively creates its fixed path and preserves an existing result', async () => {
  let exists = false, opens = 0;
  const fakeOpen = async (file, flags) => {
    opens++; assert.equal(flags, 'wx'); assert.ok(file.replaceAll('\\', '/').endsWith('/' + BRIEFING_RECEIPT));
    if (exists) throw Object.assign(Error('exists'), { code: 'EEXIST' }); exists = true;
    return { async close() {} };
  };
  await assert.rejects(reserveRelativeFactsReceipt(fakeOpen, 'research/another-briefing.json'), /INVALID_ATTEMPT/); assert.equal(opens, 0);
  await (await reserveRelativeFactsReceipt(fakeOpen, '--run-briefing-qwen17b')).close();
  await assert.rejects(reserveRelativeFactsReceipt(fakeOpen, '--run-briefing-qwen17b'), { code: 'EEXIST' });
});

test('forged prompt metadata is rejected before reservation or any engine construction', async () => {
  const r = rig();
  for (const mutate of [p => { p.promptTreatment.revision = 2; }, p => { p.promptTreatment.receiptPath = 'research/elsewhere.json'; },
    p => { p.promptTreatment.predecessor.sha256 = '0'.repeat(64); }, p => { p.promptTreatment.exposure.freshHoldoutCount = 4; },
    p => { delete p.promptTreatment; }, p => { p.modelSubstitution = { modelId: 'qwen4b' }; }]) {
    const bad = structuredClone(plan); mutate(bad);
    await assert.rejects(executeRelativeFactsDiagnostic(bad, evidence, r.dependencies), /INVALID_EXECUTION_PLAN/);
  }
  assert.equal(r.calls.reserves.length, 0); assert.equal(r.calls.options.length, 0);
});

test('actual factory flag, passed contexts, report and limits agree on the sole prompt treatment', async () => {
  const r = rig(), report = await executeRelativeFactsDiagnostic(plan, evidence, r.dependencies);
  assert.deepEqual(r.calls.options, [{ modelId: 'qwen1_7b', threads: 4, processingBatch: 'compact', weightRepacking: false,
    promptCaching: true, experimentalSpeakerRelativeFacts: true, experimentalSpeakerBriefing: true }]);
  assert.deepEqual(r.calls.contexts, [plan.primer.context, ...plan.cases.map(c => c.context)]);
  assert.deepEqual(report.settings, { ...predecessor.settings, ...fakeBudgets, experimentalSpeakerBriefing: true });
  assert.deepEqual(report.promptTreatment, plan.promptTreatment); assert.deepEqual(report.modelPins, predecessor.modelPins);
  assert.equal(report.classification, 'MOCK_ONLY'); assert.equal(report.status, 'COMPLETE_PENDING_SEMANTIC_REVIEW');
  assert.ok(report.limitations.some(s => s.includes('All eighteen cases are previously exposed regressions')));
  assert.deepEqual(report.samples.map(s => s.messages), plan.cases.map(c => c.messages));
  assert.ok(report.samples.every(s => s.semanticReview === 'NOT_PERFORMED' && !s.dispatched && !s.played));
  assert.equal(report.defaultProjectionChanged, false); assert.equal(report.defaultModelChanged, false);
  assert.equal(r.calls.stops, 1); assert.equal(r.calls.closes, 1);
  await assert.rejects(executeRelativeFactsDiagnostic(plan, evidence, r.dependencies), { code: 'EEXIST' });
  assert.equal(r.calls.options.length, 1);
});

for (const [name, runtimeChange] of [['missing flag', s => { delete s.settings.experimentalSpeakerBriefing; }],
  ['disabled flag', s => { s.settings.experimentalSpeakerBriefing = false; }], ['wrong model', s => { s.modelId = 'qwen4b'; }]])
  test(`briefing ${name} stops before any generation`, async () => {
    const r = rig({ runtimeChange }), report = await executeRelativeFactsDiagnostic(plan, evidence, r.dependencies);
    assert.equal(report.error, 'CONFIGURATION_NOT_CONFIRMED'); assert.equal(r.calls.contexts.length, 0);
    assert.equal(report.notPerformed.length, 18); assert.equal(r.calls.stops, 1);
  });

test('unchanged RAM gate leaves briefing entirely unperformed without constructing a worker', async () => {
  const r = rig({ ram: 4 * GiB }), report = await executeRelativeFactsDiagnostic(plan, evidence, r.dependencies);
  assert.equal(report.error, 'INITIAL_RAM_INSUFFICIENT'); assert.equal(report.primer.status, 'NOT_PERFORMED');
  assert.equal(report.notPerformed.length, 18); assert.equal(r.calls.options.length, 0);
  assert.deepEqual(report.promptTreatment, plan.promptTreatment);
});
