// MOCK_ONLY capture/lifecycle checks. Native engine and all receipt I/O are replaced.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { IDENTITY_FIXTURE_SHA256, readFrozenIdentityFixture, prepareIdentityDiagnostic,
  executeIdentityDiagnostic } from '../../scripts/Exercise-ConversationIdentity.mjs';
import { messagesFor } from '../local-language-model.mjs';

const bytes = await readFile(new URL('../../synthetic/conversation-identity-cases.json', import.meta.url));
const fixture = readFrozenIdentityFixture(bytes), GiB = 1024 ** 3;
const plan = await prepareIdentityDiagnostic(['--run'], fixture);
const evidence = { fixtureSha256: IDENTITY_FIXTURE_SHA256, sources: { fixture: IDENTITY_FIXTURE_SHA256 }, modelPins: [], runtimePins: [] };
function rig(overrides = {}) {
  const calls = { reserve: 0, creates: 0, starts: 0, generates: [], stops: 0, closes: 0, saves: [] };
  let stopped = true, ram = 6 * GiB, exists = false;
  const engine = {
    async start() { calls.starts++; stopped = false; },
    async generate(context) { calls.generates.push(context); return calls.generates.length === 1 ? 'OK.' : 'Synthetic unverified answer.'; },
    async stop() { calls.stops++; stopped = true; },
    status: () => ({ state: stopped ? 'STOPPED' : 'READY', ownedPid: stopped ? null : 1234,
      ownedProcessStopped: stopped, activeGeneration: false, verification: 'PINNED_FILES_VERIFIED', log: '',
      settings: { processingBatch: 'compact', weightRepacking: false, promptCaching: true },
      lastGenerationTimings: { cache_n: 20, prompt_n: 30, predicted_n: 5, prompt_ms: 10, predicted_ms: 10 } })
  };
  const dependencies = {
    async reserveReceipt() {
      calls.reserve++; if (exists) throw Object.assign(Error('exists'), { code: 'EEXIST' }); exists = true;
      return { async save(report) { calls.saves.push(structuredClone(report)); }, async close() { calls.closes++; } };
    },
    createEngine(options) { calls.creates++; assert.deepEqual(options, { modelId: 'qwen4b', threads: 4,
      processingBatch: 'compact', weightRepacking: false, promptCaching: true }); return engine; },
    availableRam: () => ram, availableDisk: async () => 20 * GiB,
    budgets: { operationMs: 30, workMs: 500, cleanupMs: 30, sampleMs: 5 },
    ...overrides
  };
  return { calls, engine, dependencies, setRam: value => { ram = value; } };
}

test('fixed fixture bytes reject even whitespace changes before capture or native startup', () => {
  assert.equal(fixture.expectedCaseCount, 8);
  assert.throws(() => readFrozenIdentityFixture(Buffer.concat([bytes, Buffer.from('\n')])), /FROZEN_FIXTURE_CHANGED/);
});

test('--check prepares seven real coordinator captures and one unbound context without changing source data', async () => {
  const before = structuredClone(fixture), prepared = await prepareIdentityDiagnostic(['--check'], fixture);
  assert.equal(prepared.action, '--check'); assert.deepEqual(fixture, before); assert.equal(prepared.cases.length, 8);
  assert.deepEqual(prepared.cases.map(c => c.capture.coordinatorCalls), [1, 1, 1, 1, 1, 1, 1, 0]);
  for (const c of prepared.cases) {
    assert.ok(Object.isFrozen(c.context)); assert.deepEqual(c.context.history, []);
    assert.deepEqual(c.messages, messagesFor(c.context));
    assert.equal(JSON.stringify(c.messages).includes('CAPTURE_ONLY_PLACEHOLDER'), false);
    assert.equal(Object.hasOwn(c.context, 'requiredMeaning'), false); assert.equal(Object.hasOwn(c.context, 'forbiddenClaims'), false);
    for (const expected of [...c.specification.requiredMeaning, ...c.specification.forbiddenClaims])
      assert.equal(JSON.stringify(c.messages).includes(expected), false);
    assert.equal(Object.hasOwn(c.context, 'rationale'), false);
    assert.deepEqual(c.context.facts.map(x => ({ id: x.id, data: x.data })), c.specification.facts.map(x => ({ id: x.id, data: x.data })));
    assert.ok(c.context.facts.every(x => x.evidenceStatus === 'CALLER_ASSERTED_OBSERVATION' && !Object.hasOwn(x, 'verified')));
  }
  const first = prepared.cases[0].context, second = prepared.cases[1].context;
  assert.equal(first.speakerId, 'scout'); assert.equal(first.persona.id, 'edge');
  assert.equal(second.speakerId, 'edge'); assert.equal(second.persona.id, 'tactician');
  assert.deepEqual(first.facts.map(x => x.data), second.facts.map(x => x.data));
  assert.equal(prepared.cases[5].context.persona.callsign, 'Rook');
  assert.ok(prepared.cases.filter((_, i) => i !== 5).every(c => c.context.persona.callsign === null));
  assert.ok(['speakerId', 'pawnId', 'generation'].every(k => !Object.hasOwn(prepared.cases[7].context, k)));
  assert.deepEqual(prepared.primer.history, []); assert.deepEqual(prepared.primer.facts, []);
});

test('only fixed check/run arguments and correctly bound frozen case structure are accepted', async () => {
  for (const args of [[], ['--run', '--retry'], ['--check', '--run'], ['--output', 'elsewhere'], ['--model', 'other']])
    await assert.rejects(prepareIdentityDiagnostic(args, fixture), /INVALID_ARGUMENTS/);
  const nonempty = structuredClone(fixture); nonempty.cases[0].history.push({ responseText: 'Guess.' });
  await assert.rejects(prepareIdentityDiagnostic(['--check'], nonempty), /INVALID_CASE/);
  const wrong = structuredClone(fixture); wrong.cases[0].persona = 'scout';
  await assert.rejects(prepareIdentityDiagnostic(['--check'], wrong), /FIXTURE_BINDING_MISMATCH/);
  const bound = structuredClone(fixture); bound.cases[7].speakerId = 'edge';
  await assert.rejects(prepareIdentityDiagnostic(['--check'], bound), /UNBOUND_CASE_HAS_BINDING/);
});

test('check plans and a wrong fixture hash cannot enter execution or reserve a receipt', async () => {
  const r = rig();
  await assert.rejects(executeIdentityDiagnostic(await prepareIdentityDiagnostic(['--check'], fixture), evidence, r.dependencies), /INVALID_EXECUTION_PLAN/);
  await assert.rejects(executeIdentityDiagnostic(plan, { ...evidence, fixtureSha256: '0'.repeat(64) }, r.dependencies), /INVALID_EXECUTION_PLAN/);
  assert.equal(r.calls.reserve, 0); assert.equal(r.calls.creates, 0);
});

test('existing receipt refusal never constructs a second engine or changes prior captured evidence', async () => {
  const r = rig(); await executeIdentityDiagnostic(plan, evidence, r.dependencies);
  const before = structuredClone(r.calls.saves);
  await assert.rejects(executeIdentityDiagnostic(plan, evidence, r.dependencies), { code: 'EEXIST' });
  assert.equal(r.calls.creates, 1); assert.equal(r.calls.starts, 1); assert.deepEqual(r.calls.saves, before);
});

test('successful synthetic run preserves measured contexts, eight outcomes, pins and separate discarded primer', async () => {
  const r = rig(), report = await executeIdentityDiagnostic(plan, evidence, r.dependencies);
  assert.equal(report.classification, 'MOCK_ONLY'); assert.equal(report.status, 'COMPLETE_PENDING_SEMANTIC_REVIEW');
  assert.equal(report.independentSemanticReview, 'NOT_PERFORMED'); assert.equal(report.ownedProcessStopped, true);
  assert.equal(report.samples.length, 8); assert.ok(report.samples.every(s => s.status === 'TEXT_COMPLETE_DIAGNOSTIC_ONLY'));
  assert.equal(r.calls.generates.length, 9); assert.deepEqual(r.calls.generates.slice(1), plan.cases.map(c => c.context));
  assert.ok(report.samples.every(s => s.context.history.length === 0 && s.played === false && s.dispatched === false));
  assert.equal(report.primer.purpose, 'DISCARDED_CALIBRATION_ONLY'); assert.equal(report.primer.output, 'OK.');
  assert.deepEqual(report.sources, evidence.sources); assert.equal(report.fixtureSha256, IDENTITY_FIXTURE_SHA256);
  assert.deepEqual(report.notPerformed, []); assert.equal(r.calls.stops, 1); assert.equal(r.calls.closes, 1);
  assert.match(report.limitations.join(' '), /finish_reason/);
});

for (const [label, overrides, reason] of [
  ['low RAM', { availableRam: () => 4 * GiB }, 'INITIAL_RAM_INSUFFICIENT'],
  ['low disk', { availableDisk: async () => 9 * GiB }, 'DISK_RESERVE_INSUFFICIENT'],
  ['unknown RAM', { availableRam: () => NaN }, 'INITIAL_RAM_INSUFFICIENT']
]) test(`${label} blocks before constructing an engine and preserves all cases as unperformed`, async () => {
  const r = rig(overrides), report = await executeIdentityDiagnostic(plan, evidence, r.dependencies);
  assert.equal(report.status, 'INCOMPLETE'); assert.equal(report.error, reason);
  assert.equal(r.calls.creates, 0); assert.equal(r.calls.stops, 0); assert.equal(r.calls.closes, 1);
  assert.equal(report.notPerformed.length, 8); assert.equal(report.finalRuntime.state, 'NOT_STARTED');
});

test('a native case failure keeps earlier evidence and stops without retrying remaining cases', async () => {
  const r = rig(), original = r.engine.generate;
  r.engine.generate = async context => { if (r.calls.generates.length === 2) { r.calls.generates.push(context); throw Error('MODEL_FAILURE'); } return original(context); };
  const report = await executeIdentityDiagnostic(plan, evidence, r.dependencies);
  assert.equal(report.status, 'INCOMPLETE'); assert.equal(report.haltReason, 'OPERATION_FAILED');
  assert.equal(report.samples[0].status, 'TEXT_COMPLETE_DIAGNOSTIC_ONLY'); assert.equal(report.samples[1].status, 'FAILED');
  assert.equal(report.samples[1].nativeTimings, null); assert.equal(report.notPerformed.length, 6);
  assert.equal(r.calls.generates.length, 3); assert.equal(r.calls.stops, 1); assert.equal(r.calls.closes, 1);
});

test('generation that ignores cancellation is bounded and cannot dispatch a later case', async () => {
  const r = rig(), original = r.engine.generate;
  r.engine.generate = async context => { if (r.calls.generates.length) { r.calls.generates.push(context); return new Promise(() => {}); } return original(context); };
  const report = await executeIdentityDiagnostic(plan, evidence, r.dependencies);
  assert.equal(report.haltReason, 'OPERATION_DEADLINE'); assert.equal(report.samples[0].status, 'FAILED');
  assert.equal(report.samples[0].output, null); assert.equal(report.notPerformed.length, 7);
  assert.equal(r.calls.generates.length, 2); assert.equal(r.calls.stops, 1);
});

test('RAM loss during generation cancels the run and stops its sole worker', async () => {
  const r = rig(), original = r.engine.generate;
  r.engine.generate = async context => {
    if (r.calls.generates.length) { r.calls.generates.push(context); r.setRam(GiB); return new Promise(() => {}); }
    return original(context);
  };
  const report = await executeIdentityDiagnostic(plan, evidence, r.dependencies);
  assert.equal(report.haltReason, 'RAM_RESERVE_LOST'); assert.equal(report.minimumAvailableRamBytes, GiB);
  assert.equal(report.notPerformed.length, 7); assert.equal(r.calls.stops, 1);
});

test('global startup deadline prevents a hanging start from reaching any generation', async () => {
  const r = rig({ budgets: { operationMs: 30, workMs: 25, cleanupMs: 30, sampleMs: 5 } });
  r.engine.start = () => { r.calls.starts++; return new Promise(() => {}); };
  const report = await executeIdentityDiagnostic(plan, evidence, r.dependencies);
  assert.equal(report.haltReason, 'GLOBAL_TIME_LIMIT'); assert.equal(r.calls.generates.length, 0);
  assert.equal(report.notPerformed.length, 8); assert.equal(r.calls.stops, 1);
});

test('unconfirmed cleanup remains a failure even after every synthetic answer completed', async () => {
  const r = rig(); r.engine.stop = () => { r.calls.stops++; return new Promise(() => {}); };
  const report = await executeIdentityDiagnostic(plan, evidence, r.dependencies);
  assert.equal(report.status, 'OWNED_PROCESS_STOP_UNCONFIRMED'); assert.equal(report.stopError, 'CLEANUP_DEADLINE');
  assert.equal(report.ownedProcessStopped, false); assert.equal(report.finalRuntime.ownedPid, 1234);
  assert.equal(r.calls.creates, 1); assert.equal(r.calls.stops, 1); assert.equal(r.calls.closes, 1);
});

test('unverified native pins stop the owned engine before calibration or measured generation', async () => {
  const r = rig(), status = r.engine.status; r.engine.status = () => ({ ...status(), verification: 'UNKNOWN' });
  const report = await executeIdentityDiagnostic(plan, evidence, r.dependencies);
  assert.equal(report.error, 'PINS_NOT_VERIFIED'); assert.equal(r.calls.generates.length, 0);
  assert.equal(report.notPerformed.length, 8); assert.equal(r.calls.stops, 1);
});

for (const guard of ['RAM', 'GLOBAL', 'IO_FAILURE']) test(`${guard} while saving the pre-generation checkpoint retains unperformed cases`, async () => {
  const r = rig(guard === 'GLOBAL' ? { budgets: { operationMs: 30, workMs: 25, cleanupMs: 30, sampleMs: 5 } } : {});
  const reserve = r.dependencies.reserveReceipt; let delayed = false;
  r.dependencies.reserveReceipt = async () => {
    const receipt = await reserve(), save = receipt.save;
    receipt.save = async report => {
      if (!delayed && report.status === 'RUNNING' && r.calls.generates.length === 1) {
        delayed = true;
        assert.equal(report.samples[0].status, 'NOT_PERFORMED');
        if (guard === 'IO_FAILURE') throw Error('SYNTHETIC_WRITE_FAILURE');
        if (guard === 'RAM') r.setRam(GiB);
        await new Promise(resolve => setTimeout(resolve, 40));
      }
      return save(report);
    };
    return receipt;
  };
  const report = await executeIdentityDiagnostic(plan, evidence, r.dependencies);
  assert.equal(delayed, true); assert.equal(r.calls.generates.length, 1);
  assert.equal(report.status, 'INCOMPLETE'); assert.equal(report.samples[0].status, 'NOT_PERFORMED');
  assert.equal(report.samples[0].output, null); assert.equal(report.notPerformed.length, 8);
  if (guard === 'IO_FAILURE') assert.equal(report.error, 'SYNTHETIC_WRITE_FAILURE');
  else assert.equal(report.haltReason, guard === 'RAM' ? 'RAM_RESERVE_LOST' : 'GLOBAL_TIME_LIMIT');
  assert.equal(r.calls.stops, 1); assert.equal(r.calls.closes, 1);
});
