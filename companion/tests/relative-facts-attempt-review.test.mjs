// Independent attempt-selector review. Native engine and receipt writes are inert fakes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import {
  RELATIVE_FACTS_RECEIPT, RELATIVE_FACTS_ATTEMPT_002_RECEIPT, RELATIVE_FACTS_PREDECESSOR_SHA256,
  RELATIVE_FACTS_FIXTURE_SHA256, readFrozenRelativeFactsFixture, readRelativeFactsPredecessor,
  prepareRelativeFactsDiagnostic, reserveRelativeFactsReceipt, executeRelativeFactsDiagnostic
} from '../../scripts/Exercise-ConversationRelativeFacts.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const GiB = 1024 ** 3;
const fixture = readFrozenRelativeFactsFixture(await readFile(new URL('../../synthetic/conversation-relative-facts-cases.json', import.meta.url)));
const priorBytes = await readFile(new URL('../../research/QWEN4B_RELATIVE_FACTS_DIAGNOSTIC.json', import.meta.url));
const prior = JSON.parse(priorBytes);
const plan = await prepareRelativeFactsDiagnostic(['--run-attempt-002'], fixture);
const evidence = { fixtureSha256: RELATIVE_FACTS_FIXTURE_SHA256, sources: { review: 'MOCK_ONLY' }, modelPins: [], runtimePins: [] };
const runtimeSettings = { host: '127.0.0.1', contextTokens: 2048, maxOutputTokens: 64, maxOutputChars: 256,
  gpuLayers: 0, processingBatch: 'compact', weightRepacking: false, promptCaching: true,
  experimentalSpeakerRelativeFacts: true, logicalBatchTokens: 128, physicalBatchTokens: 64,
  simultaneousModels: 1, thinking: false, webUI: false, mcpProxy: false };

function rig({ ram = 6 * GiB, disk = 20 * GiB, refuse = false } = {}) {
  let stopped = true;
  const calls = { reserves: 0, creates: 0, starts: 0, generated: [], stops: 0, saves: [], closes: 0 };
  const engine = {
    async start() { calls.starts++; stopped = false; },
    async generate(context) { calls.generated.push(structuredClone(context)); return 'MOCK_ONLY response.'; },
    async stop() { calls.stops++; stopped = true; },
    status: () => ({ state: stopped ? 'STOPPED' : 'READY', ownedPid: stopped ? null : 1234,
      ownedProcessStopped: stopped, modelId: 'qwen4b', threads: 4, verification: 'PINNED_FILES_VERIFIED',
      settings: runtimeSettings, log: '', lastGenerationTimings: null })
  };
  const dependencies = {
    reserveReceipt: async () => { calls.reserves++; if (refuse) throw Object.assign(Error('Preserved existing receipt'), { code: 'EEXIST' });
      return { save: async report => { calls.saves.push(structuredClone(report)); }, close: async () => { calls.closes++; } }; },
    availableRam: () => ram, availableDisk: async () => disk,
    createEngine: options => { calls.creates++; assert.deepEqual(options, { modelId: 'qwen4b', threads: 4,
      processingBatch: 'compact', weightRepacking: false, promptCaching: true, experimentalSpeakerRelativeFacts: true }); return engine; }
  };
  return { calls, dependencies };
}

test('predecessor is exactly the unchanged real preflight refusal, with all requests unperformed', () => {
  assert.equal(RELATIVE_FACTS_PREDECESSOR_SHA256, 'a4970f273317987ec2ab807dc4a23c3c362cadc6cea81a10b375094b84902771');
  assert.equal(sha(priorBytes), RELATIVE_FACTS_PREDECESSOR_SHA256);
  assert.deepEqual(readRelativeFactsPredecessor(priorBytes), { path: RELATIVE_FACTS_RECEIPT, sha256: RELATIVE_FACTS_PREDECESSOR_SHA256 });
  assert.equal(prior.status, 'INCOMPLETE'); assert.equal(prior.error, 'INITIAL_RAM_INSUFFICIENT');
  assert.deepEqual(prior.finalRuntime, { state: 'NOT_STARTED', ownedPid: null, ownedProcessStopped: true });
  assert.equal(prior.primer.status, 'NOT_PERFORMED'); assert.equal(prior.primer.output, null);
  assert.equal(prior.samples.length, 18); assert.ok(prior.samples.every(s => s.status === 'NOT_PERFORMED' && s.output === null));
  for (const modified of [Buffer.concat([priorBytes, Buffer.from('\n')]), Buffer.from('{}'),
    Buffer.from(JSON.stringify({ ...prior, error: 'SOMETHING_ELSE' }))]) assert.throws(() => readRelativeFactsPredecessor(modified));
});

test('fixed attempt metadata cannot redirect the original receipt and contexts exactly reconstruct predecessor', async () => {
  assert.equal(RELATIVE_FACTS_ATTEMPT_002_RECEIPT, 'research/QWEN4B_RELATIVE_FACTS_ATTEMPT_002.json');
  assert.notEqual(RELATIVE_FACTS_RECEIPT, RELATIVE_FACTS_ATTEMPT_002_RECEIPT);
  assert.deepEqual(plan.attempt, { id: '002', receiptPath: RELATIVE_FACTS_ATTEMPT_002_RECEIPT,
    predecessor: { path: RELATIVE_FACTS_RECEIPT, sha256: RELATIVE_FACTS_PREDECESSOR_SHA256 } });
  assert.ok(Object.isFrozen(plan.attempt) && Object.isFrozen(plan.attempt.predecessor));
  assert.deepEqual(plan.fixture, prior.fixture);
  assert.equal(plan.cases.length, 18); assert.equal(plan.cases.filter(c => c.capture.coordinatorCalls === 1).length, 10);
  assert.equal(plan.cases.filter(c => c.provenance.kind === 'NEW_PREDECLARED_HOLDOUT').length, 4);
  for (const [i, c] of plan.cases.entries()) {
    assert.equal(c.specification.id, prior.samples[i].id);
    for (const key of ['provenance', 'capture', 'originalContext', 'context', 'projection', 'messages', 'messageCharacters'])
      assert.deepEqual(c[key], prior.samples[i][key], `${c.specification.id}: ${key}`);
    const text = JSON.stringify(c.messages);
    for (const expected of [...c.specification.requiredMeaning, ...c.specification.forbiddenClaims]) assert.equal(text.includes(expected), false);
  }
  for (const key of ['originalContext', 'context', 'projection', 'messages', 'messageCharacters'])
    assert.deepEqual(plan.primer[key], prior.primer[key], `primer: ${key}`);
  const original = await prepareRelativeFactsDiagnostic(['--run'], fixture), checked = await prepareRelativeFactsDiagnostic(['--check'], fixture);
  assert.deepEqual(original.cases, plan.cases); assert.deepEqual(checked.cases, plan.cases);
  assert.equal(original.attempt, undefined); assert.equal(checked.attempt, undefined);
});

test('CLI accepts no arbitrary attempt number, output location, dependency injection or relaxed gate', async () => {
  for (const args of [['--run-attempt-001'], ['--run-attempt-003'], ['--run-attempt-002', '--output', 'elsewhere.json'],
    ['--run-attempt-002', '--mock'], ['--run-attempt-002', '--ram', '0'], ['--run-attempt-002', '--run'],
    ['--run-attempt-002=elsewhere.json'], ['--run-attempt-002', '--threads', '1']])
    await assert.rejects(prepareRelativeFactsDiagnostic(args, fixture), /INVALID_ARGUMENTS/);
});

test('forged execution metadata is refused before reservation or engine construction', async () => {
  const changedPlans = [
    p => { p.attempt.receiptPath = RELATIVE_FACTS_RECEIPT; },
    p => { p.attempt.receiptPath = '../outside.json'; },
    p => { p.attempt.predecessor.sha256 = '0'.repeat(64); },
    p => { p.attempt.predecessor.path = 'other.json'; },
    p => { p.attempt.id = '003'; },
    p => { delete p.attempt; },
    p => { p.action = '--run'; }
  ];
  for (const change of changedPlans) {
    const candidate = structuredClone(plan); change(candidate); const r = rig();
    await assert.rejects(executeRelativeFactsDiagnostic(candidate, evidence, r.dependencies));
    assert.equal(r.calls.reserves, 0); assert.equal(r.calls.creates, 0);
  }
});

test('exclusive selector-specific reservation preserves predecessor and refuses reuse without writing', async () => {
  const contents = new Map([[RELATIVE_FACTS_RECEIPT, Buffer.from(priorBytes)]]), events = [];
  const fakeOpen = async (file, mode) => {
    const normalized = file.replaceAll('\\', '/');
    const key = [RELATIVE_FACTS_RECEIPT, RELATIVE_FACTS_ATTEMPT_002_RECEIPT].find(p => normalized.endsWith('/' + p));
    assert.ok(key); assert.equal(mode, 'wx'); events.push({ key, mode });
    if (contents.has(key)) throw Object.assign(Error('Exists'), { code: 'EEXIST' });
    contents.set(key, Buffer.alloc(0));
    return { async write(bytes, offset, length, position) {
      const size = Math.min(23, length), prior = contents.get(key), next = Buffer.alloc(Math.max(prior.length, position + size));
      prior.copy(next); bytes.copy(next, position, offset, offset + size); contents.set(key, next); return { bytesWritten: size }; },
      async truncate(length) { contents.set(key, contents.get(key).subarray(0, length)); }, async sync() {}, async close() {} };
  };
  await assert.rejects(reserveRelativeFactsReceipt(fakeOpen), { code: 'EEXIST' });
  const newReceipt = await reserveRelativeFactsReceipt(fakeOpen, '--run-attempt-002');
  await newReceipt.save({ classification: 'MOCK_ONLY', note: 'fake checkpoint' }); await newReceipt.close();
  const frozenNew = Buffer.from(contents.get(RELATIVE_FACTS_ATTEMPT_002_RECEIPT));
  await assert.rejects(reserveRelativeFactsReceipt(fakeOpen, '--run-attempt-002'), { code: 'EEXIST' });
  const count = events.length;
  for (const action of ['--run-attempt-003', '../outside.json', '--check']) await assert.rejects(reserveRelativeFactsReceipt(fakeOpen, action));
  assert.equal(events.length, count); assert.deepEqual(contents.get(RELATIVE_FACTS_RECEIPT), priorBytes);
  assert.deepEqual(contents.get(RELATIVE_FACTS_ATTEMPT_002_RECEIPT), frozenNew);
});

for (const [label, config, error] of [['RAM', { ram: 5 * GiB - 1 }, 'INITIAL_RAM_INSUFFICIENT'],
  ['disk', { disk: 10 * GiB - 1 }, 'DISK_RESERVE_INSUFFICIENT']]) {
  test(`attempt 002 retains exact ${label} gate and records all unperformed without constructing a worker`, async () => {
    const r = rig(config), report = await executeRelativeFactsDiagnostic(plan, evidence, r.dependencies);
    assert.equal(report.classification, 'MOCK_ONLY'); assert.equal(report.error, error); assert.equal(report.status, 'INCOMPLETE');
    assert.deepEqual(report.attempt, plan.attempt); assert.equal(report.primer.status, 'NOT_PERFORMED');
    assert.ok(report.samples.every(s => s.status === 'NOT_PERFORMED' && s.output === null)); assert.equal(report.notPerformed.length, 18);
    assert.equal(r.calls.creates, 0); assert.equal(r.calls.starts, 0); assert.equal(r.calls.stops, 0); assert.equal(r.calls.closes, 1);
    assert.equal(report.settings.initialRamRequirementBytes, 5 * GiB); assert.equal(report.settings.workingDiskReserveBytes, 10 * GiB);
    assert.equal(report.settings.minimumRamBytes, 2 * GiB);
  });
}

test('existing attempt receipt blocks all fake engine construction and cannot alter saved evidence', async () => {
  const r = rig({ refuse: true }); await assert.rejects(executeRelativeFactsDiagnostic(plan, evidence, r.dependencies), { code: 'EEXIST' });
  assert.equal(r.calls.reserves, 1); assert.equal(r.calls.creates, 0); assert.deepEqual(r.calls.saves, []);
});

test('successful injected attempt remains MOCK_ONLY and retains exact gates, deadlines, contexts and one owned stop', async () => {
  const r = rig(), report = await executeRelativeFactsDiagnostic(plan, evidence, r.dependencies);
  assert.equal(report.classification, 'MOCK_ONLY'); assert.equal(report.status, 'COMPLETE_PENDING_SEMANTIC_REVIEW');
  assert.deepEqual(report.attempt, plan.attempt); assert.deepEqual(r.calls.generated, [plan.primer.context, ...plan.cases.map(c => c.context)]);
  for (const [key, value] of Object.entries({ operationMs: 10000, workMs: 233000, cleanupMs: 7000, sampleMs: 250,
    threads: 4, contextTokens: 2048, maxOutputTokens: 64, maxOutputChars: 256, logicalBatchTokens: 128, physicalBatchTokens: 64,
    promptCaching: true, experimentalSpeakerRelativeFacts: true, minimumRamBytes: 2 * GiB,
    initialRamRequirementBytes: 5 * GiB, workingDiskReserveBytes: 10 * GiB })) assert.equal(report.settings[key], value, key);
  assert.equal(r.calls.creates, 1); assert.equal(r.calls.starts, 1); assert.equal(r.calls.stops, 1); assert.equal(r.calls.closes, 1);
  assert.equal(report.independentSemanticReview, 'NOT_PERFORMED'); assert.equal(report.gameAcceptance, 'NOT_PERFORMED');
  assert.equal(report.ownedProcessStopped, true); assert.ok(report.samples.every(s => s.dispatched === false && s.played === false));
});
