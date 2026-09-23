// MOCK_ONLY: native engine and receipt I/O are replaced; real coordinator capture is inert.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { RELATIVE_FACTS_FIXTURE_SHA256, RELATIVE_FACTS_RECEIPT, readFrozenRelativeFactsFixture,
  RELATIVE_FACTS_ATTEMPT_002_RECEIPT, RELATIVE_FACTS_PREDECESSOR_SHA256, readRelativeFactsPredecessor,
  RELATIVE_FACTS_QWEN17B_RECEIPT, RELATIVE_FACTS_QWEN17B_PREDECESSOR_SHA256, readRelativeFactsQwen17bPredecessor,
  prepareRelativeFactsDiagnostic, executeRelativeFactsDiagnostic, reserveRelativeFactsReceipt }
  from '../../scripts/Exercise-ConversationRelativeFacts.mjs';
import { messagesFor } from '../local-language-model.mjs';
import { projectSpeakerObservations } from '../speaker-observations.mjs';

const bytes = await readFile(new URL('../../synthetic/conversation-relative-facts-cases.json', import.meta.url));
const fixture = readFrozenRelativeFactsFixture(bytes), GiB = 1024 ** 3;
const plan = await prepareRelativeFactsDiagnostic(['--run'], fixture);
const evidence = { fixtureSha256: RELATIVE_FACTS_FIXTURE_SHA256, sources: { fixture: RELATIVE_FACTS_FIXTURE_SHA256 }, modelPins: [], runtimePins: [] };
const confirmedSettings = { host: '127.0.0.1', contextTokens: 2048, maxOutputTokens: 64, maxOutputChars: 256, gpuLayers: 0,
  processingBatch: 'compact', weightRepacking: false, promptCaching: true, experimentalSpeakerRelativeFacts: true,
  logicalBatchTokens: 128, physicalBatchTokens: 64, simultaneousModels: 1, thinking: false, webUI: false, mcpProxy: false };
function rig(overrides = {}) {
  const calls = { reserve: 0, creates: 0, starts: 0, generates: [], stops: 0, closes: 0, saves: [] };
  let stopped = true, ram = 6 * GiB, exists = false;
  const engine = {
    async start() { calls.starts++; stopped = false; },
    async generate(context) { calls.generates.push(context); return calls.generates.length === 1 ? 'OK.' : 'Synthetic unverified answer.'; },
    async stop() { calls.stops++; stopped = true; },
    status: () => ({ state: stopped ? 'STOPPED' : 'READY', modelId: 'qwen4b', threads: 4, ownedPid: stopped ? null : 1234,
      ownedProcessStopped: stopped, activeGeneration: false, verification: 'PINNED_FILES_VERIFIED', log: '',
      settings: { ...confirmedSettings },
      lastGenerationTimings: { cache_n: 20, prompt_n: 30, predicted_n: 5, prompt_ms: 10, predicted_ms: 10 } })
  };
  const dependencies = {
    async reserveReceipt() {
      calls.reserve++; if (exists) throw Object.assign(Error('exists'), { code: 'EEXIST' }); exists = true;
      return { async save(report) { calls.saves.push(structuredClone(report)); }, async close() { calls.closes++; } };
    },
    createEngine(options) { calls.creates++; assert.deepEqual(options, { modelId: 'qwen4b', threads: 4,
      processingBatch: 'compact', weightRepacking: false, promptCaching: true, experimentalSpeakerRelativeFacts: true }); return engine; },
    availableRam: () => ram, availableDisk: async () => 20 * GiB,
    budgets: { operationMs: 100, workMs: 2000, cleanupMs: 100, sampleMs: 5 },
    ...overrides
  };
  return { calls, engine, dependencies, setRam: value => { ram = value; } };
}

test('frozen input refuses whitespace or any in-memory criterion/input change', async () => {
  assert.equal(fixture.expectedCaseCount, 18);
  assert.throws(() => readFrozenRelativeFactsFixture(Buffer.concat([bytes, Buffer.from('\n')])), /FROZEN_FIXTURE_CHANGED/);
  for (const change of [f => { f.cases[0].specification.requiredMeaning[0] = 'Looser criterion.'; },
    f => { f.cases[14].inputProtocol.speakerId = 'edge'; }, f => { f.cases[8].specification.history = []; }]) {
    const altered = structuredClone(fixture); change(altered);
    await assert.rejects(prepareRelativeFactsDiagnostic(['--check'], altered), /FROZEN_FIXTURE_CHANGED/);
  }
});

test('--check preserves ten real captures, eight unbound contexts and original facts/history with only a synthetic marker added', async () => {
  const before = structuredClone(fixture), prepared = await prepareRelativeFactsDiagnostic(['--check'], fixture);
  assert.equal(prepared.action, '--check'); assert.deepEqual(fixture, before); assert.equal(prepared.cases.length, 18);
  assert.deepEqual(prepared.cases.map(c => c.capture.coordinatorCalls), [1,1,1,1,1,1,1,0,0,0,0,0,0,0,1,1,0,1]);
  assert.equal(prepared.cases.filter(c => c.provenance.kind === 'NEW_PREDECLARED_HOLDOUT').length, 4);
  for (const c of prepared.cases) {
    const { classification, ...other } = c.context;
    assert.equal(classification, 'MOCK_ONLY'); assert.deepEqual(other, c.originalContext);
    assert.equal(Object.hasOwn(c.originalContext, 'classification'), false);
    assert.deepEqual(c.context.history, c.specification.history);
    assert.deepEqual(c.context.facts.map(x => ({ id:x.id, data:x.data })), c.specification.facts.map(x => ({ id:x.id, data:x.data })));
    assert.ok(c.context.facts.every(x => x.evidenceStatus === 'CALLER_ASSERTED_OBSERVATION' && !Object.hasOwn(x,'verified')));
    if (!c.capture.coordinatorCalls) assert.ok(['speakerId','pawnId','generation'].every(k => !Object.hasOwn(c.context,k)));
    assert.deepEqual(c.projection, projectSpeakerObservations({ schemaVersion:1,classification:'MOCK_ONLY',speakerId:c.context.speakerId??null,facts:c.context.facts }));
    assert.deepEqual(c.messages, messagesFor(c.context,{experimentalSpeakerRelativeFacts:true}));
    assert.deepEqual(c.projection.audit.facts,c.context.facts);
    assert.equal(c.messageCharacters,c.messages.reduce((n,m)=>n+m.content.length,0));
    assert.ok(Object.isFrozen(c.context) && Object.isFrozen(c.projection.audit));
  }
  assert.equal(prepared.cases[5].context.persona.callsign,'Rook');
  assert.ok(prepared.cases.filter((_,i)=>i!==5).every(c=>c.context.persona.callsign===null));
  assert.equal(prepared.cases[8].context.history.length,2); assert.equal(prepared.cases[13].context.history.length,1);
  assert.deepEqual(prepared.primer.context.history,[]); assert.deepEqual(prepared.primer.context.facts,[]);
  assert.equal(prepared.primer.context.classification,'MOCK_ONLY');
});

test('actual request and prior unverified history reach messages but case criteria, rationale, provenance and audit never do', () => {
  for (const c of plan.cases) {
    const serialized=JSON.stringify(c.messages), user=JSON.parse(c.messages[1].content.slice(0,-' /no_think'.length));
    assert.equal(user.text,c.specification.request);
    assert.deepEqual(user.unverifiedUndeliveredHistory,c.specification.history.map(h=>[h.requestText,h.responseText]));
    assert.deepEqual(user.callerAssertedCurrentObservations,c.projection.prompt);
    assert.equal(Object.hasOwn(user.speaker,'profileId'),false);
    assert.deepEqual(Object.keys(user).sort(),['speaker','callerAssertedCurrentObservations','unverifiedUndeliveredHistory','text'].sort());
    for(const criterion of [...c.specification.requiredMeaning,...c.specification.forbiddenClaims,c.specification.rationale])
      assert.equal(serialized.includes(criterion),false);
    for(const key of ['requiredMeaning','forbiddenClaims','rationale','inputProtocol','provenance','caseObjectSha256','factIndex','observedAtMs'])
      assert.equal(serialized.includes('"'+key+'"'),false);
    assert.equal(serialized.includes('CAPTURE_ONLY_PLACEHOLDER'),false);
  }
});

test('the fresh cases preserve both shuffled metrics, missing own reading, absent binding and unresolved source conflict', () => {
  const [renamed,missing,unbound,conflict]=plan.cases.slice(14).map(c=>c.projection);
  assert.deepEqual(renamed.prompt.own.map(m=>[m.metric,m.reports.map(r=>r.value)]),[['heat',['high']],['selectedWeaponAmmo',['available']]]);
  assert.deepEqual(renamed.prompt.other.map(a=>[a.actorId,a.observations.map(m=>[m.metric,m.reports.map(r=>r.value)])]),
    [['unit-12',[['heat',['low']],['selectedWeaponAmmo',['empty']]]]]);
  assert.equal(missing.prompt.binding,'KNOWN'); assert.deepEqual(missing.prompt.own,[]); assert.ok(missing.prompt.missingOwnMetrics.includes('heat'));
  assert.equal(unbound.prompt.binding,'UNKNOWN'); assert.deepEqual(unbound.prompt.own,[]); assert.equal(unbound.prompt.unattributed.length,2);
  assert.equal(conflict.audit.speakerId,'unit-12'); assert.equal(conflict.prompt.own[0].status,'CONFLICT');
  assert.deepEqual(conflict.prompt.own[0].reports.map(r=>r.value),['high','low']);
  assert.equal(conflict.audit.sources.filter(s=>s.pointer==='/data/pilots/0/heat'||s.pointer==='/data/pilots/1/heat').length,4);
});

test('fixed CLI selectors reject model, path, retry or tuning arguments', async () => {
  for(const args of [[],['--run','--retry'],['--check','--run'],['--output','elsewhere'],['--model','other'],
    ['--run-attempt-001'],['--run-attempt-003'],['--run-attempt-2'],['--run-attempt-002','--output','elsewhere'],
    ['--run-qwen17b','--model','qwen4b'],['--run-qwen17b','--threads','8'],['--run-qwen17b','--output','elsewhere'],['--run-qwen17b-q4']])
    await assert.rejects(prepareRelativeFactsDiagnostic(args,fixture),/INVALID_ARGUMENTS/);
});

test('attempt 002 pins the exact immutable admission refusal and changes no case or model input', async () => {
  const prior = await readFile(new URL('../../research/QWEN4B_RELATIVE_FACTS_DIAGNOSTIC.json', import.meta.url));
  assert.deepEqual(readRelativeFactsPredecessor(prior), { path: RELATIVE_FACTS_RECEIPT, sha256: RELATIVE_FACTS_PREDECESSOR_SHA256 });
  assert.throws(() => readRelativeFactsPredecessor(Buffer.concat([prior, Buffer.from('\n')])), /PREDECESSOR_EVIDENCE_CHANGED/);
  const altered = JSON.parse(prior); altered.status = 'COMPLETE_PENDING_SEMANTIC_REVIEW';
  assert.throws(() => readRelativeFactsPredecessor(Buffer.from(JSON.stringify(altered))), /PREDECESSOR_EVIDENCE_CHANGED/);
  const second = await prepareRelativeFactsDiagnostic(['--run-attempt-002'], fixture);
  assert.deepEqual(second.attempt, { id: '002', receiptPath: RELATIVE_FACTS_ATTEMPT_002_RECEIPT,
    predecessor: { path: RELATIVE_FACTS_RECEIPT, sha256: RELATIVE_FACTS_PREDECESSOR_SHA256 } });
  assert.deepEqual(second.cases, plan.cases); assert.deepEqual(second.primer, plan.primer); assert.deepEqual(second.fixture, plan.fixture);
  assert.equal(Object.hasOwn(plan, 'attempt'), false);
});

test('attempt 002 reservation has one fixed wx destination and cannot overwrite either receipt', async () => {
  const files = new Map([[RELATIVE_FACTS_RECEIPT, 'original refusal']]); let opens = 0;
  const fakeOpen = async (file, flags) => {
    opens++; assert.equal(flags, 'wx');
    assert.ok(file.replaceAll('\\', '/').endsWith('/' + RELATIVE_FACTS_ATTEMPT_002_RECEIPT));
    if (files.has(RELATIVE_FACTS_ATTEMPT_002_RECEIPT)) throw Object.assign(Error('exists'), { code: 'EEXIST' });
    files.set(RELATIVE_FACTS_ATTEMPT_002_RECEIPT, 'reserved');
    return { async close() {} };
  };
  await assert.rejects(reserveRelativeFactsReceipt(fakeOpen, '--run-attempt-003'), /INVALID_ATTEMPT/);
  await assert.rejects(reserveRelativeFactsReceipt(fakeOpen, 'research/elsewhere.json'), /INVALID_ATTEMPT/);
  assert.equal(opens, 0);
  await (await reserveRelativeFactsReceipt(fakeOpen, '--run-attempt-002')).close();
  await assert.rejects(reserveRelativeFactsReceipt(fakeOpen, '--run-attempt-002'), { code: 'EEXIST' });
  assert.equal(files.get(RELATIVE_FACTS_RECEIPT), 'original refusal');
  assert.equal(files.get(RELATIVE_FACTS_ATTEMPT_002_RECEIPT), 'reserved');
});

test('attempt metadata cannot be forged at execution and mock second receipts retain the predecessor', async () => {
  const second = await prepareRelativeFactsDiagnostic(['--run-attempt-002'], fixture), r = rig({ availableRam: () => 4 * GiB });
  for (const modify of [p => { p.attempt.id = '003'; }, p => { p.attempt.receiptPath = 'research/elsewhere.json'; },
    p => { p.attempt.predecessor.sha256 = '0'.repeat(64); }, p => { delete p.attempt; }]) {
    const forged = structuredClone(second); modify(forged);
    await assert.rejects(executeRelativeFactsDiagnostic(forged, evidence, r.dependencies), /INVALID_EXECUTION_PLAN/);
  }
  assert.equal(r.calls.reserve, 0); assert.equal(r.calls.creates, 0);
  const reserve = r.dependencies.reserveReceipt;
  r.dependencies.reserveReceipt = async action => { assert.equal(action, '--run-attempt-002'); return reserve(); };
  const report = await executeRelativeFactsDiagnostic(second, evidence, r.dependencies);
  assert.equal(report.classification, 'MOCK_ONLY'); assert.equal(report.error, 'INITIAL_RAM_INSUFFICIENT');
  assert.deepEqual(report.attempt, second.attempt); assert.equal(report.notPerformed.length, 18); assert.equal(r.calls.creates, 0);
  assert.deepEqual(report.settings, (await executeRelativeFactsDiagnostic(plan, evidence, rig({ availableRam: () => 4 * GiB }).dependencies)).settings);
});

test('fixed Qwen1.7B selection pins the stopped 4B attempt without changing any prompt or criterion', async () => {
  const prior = await readFile(new URL('../../research/QWEN4B_RELATIVE_FACTS_ATTEMPT_002.json', import.meta.url));
  assert.deepEqual(readRelativeFactsQwen17bPredecessor(prior), { path: RELATIVE_FACTS_ATTEMPT_002_RECEIPT, sha256: RELATIVE_FACTS_QWEN17B_PREDECESSOR_SHA256 });
  assert.throws(() => readRelativeFactsQwen17bPredecessor(Buffer.concat([prior, Buffer.from('\n')])), /QWEN17B_PREDECESSOR_EVIDENCE_CHANGED/);
  const selected = await prepareRelativeFactsDiagnostic(['--run-qwen17b'], fixture);
  assert.deepEqual(selected.modelSubstitution, { id: 'QWEN17B_OFFICIAL_Q8', receiptPath: RELATIVE_FACTS_QWEN17B_RECEIPT,
    referenceModelId: 'qwen4b', modelId: 'qwen1_7b',
    predecessor: { path: RELATIVE_FACTS_ATTEMPT_002_RECEIPT, sha256: RELATIVE_FACTS_QWEN17B_PREDECESSOR_SHA256 } });
  assert.deepEqual(selected.cases, plan.cases); assert.deepEqual(selected.primer, plan.primer); assert.deepEqual(selected.fixture, plan.fixture);
  assert.equal(Object.hasOwn(selected, 'attempt'), false); assert.equal(Object.hasOwn(plan, 'modelSubstitution'), false);
});

test('Qwen1.7B reservation uses only its fixed exclusive path and preserves an existing receipt', async () => {
  let exists = false, opens = 0;
  const fakeOpen = async (file, flags) => {
    opens++; assert.equal(flags, 'wx'); assert.ok(file.replaceAll('\\', '/').endsWith('/' + RELATIVE_FACTS_QWEN17B_RECEIPT));
    if (exists) throw Object.assign(Error('exists'), { code: 'EEXIST' }); exists = true;
    return { async close() {} };
  };
  await assert.rejects(reserveRelativeFactsReceipt(fakeOpen, '--run-qwen17b-q4'), /INVALID_ATTEMPT/); assert.equal(opens, 0);
  await (await reserveRelativeFactsReceipt(fakeOpen, '--run-qwen17b')).close();
  await assert.rejects(reserveRelativeFactsReceipt(fakeOpen, '--run-qwen17b'), { code: 'EEXIST' });
});

test('Qwen1.7B reaches the actual engine factory and effective report with otherwise identical settings', async () => {
  const selected = await prepareRelativeFactsDiagnostic(['--run-qwen17b'], fixture), r = rig();
  const originalStatus = r.engine.status; r.engine.status = () => ({ ...originalStatus(), modelId: 'qwen1_7b' });
  let receivedOptions;
  r.dependencies.createEngine = options => { r.calls.creates++; receivedOptions = structuredClone(options); return r.engine; };
  const report = await executeRelativeFactsDiagnostic(selected, evidence, r.dependencies);
  assert.deepEqual(receivedOptions, { modelId: 'qwen1_7b', threads: 4, processingBatch: 'compact', weightRepacking: false,
    promptCaching: true, experimentalSpeakerRelativeFacts: true });
  assert.equal(report.status, 'COMPLETE_PENDING_SEMANTIC_REVIEW'); assert.equal(report.classification, 'MOCK_ONLY');
  assert.deepEqual(r.calls.generates, [plan.primer.context, ...plan.cases.map(c => c.context)]);
  assert.deepEqual(report.modelSubstitution, selected.modelSubstitution);
  const baseline = await executeRelativeFactsDiagnostic(plan, evidence, rig().dependencies);
  assert.deepEqual({ ...report.settings, modelId: 'qwen4b' }, baseline.settings);
  await assert.rejects(executeRelativeFactsDiagnostic(selected, evidence, r.dependencies), { code: 'EEXIST' });
  assert.equal(r.calls.creates, 1);
});

test('a mislabeled 4B runtime or forged substitution cannot execute the 1.7B cases', async () => {
  const selected = await prepareRelativeFactsDiagnostic(['--run-qwen17b'], fixture), r = rig();
  r.dependencies.createEngine = () => { r.calls.creates++; return r.engine; };
  for (const modify of [p => { p.modelSubstitution.modelId = 'qwen4b'; }, p => { p.modelSubstitution.receiptPath = 'research/elsewhere.json'; },
    p => { p.modelSubstitution.predecessor.sha256 = '0'.repeat(64); }, p => { delete p.modelSubstitution; }]) {
    const forged = structuredClone(selected); modify(forged);
    await assert.rejects(executeRelativeFactsDiagnostic(forged, evidence, r.dependencies), /INVALID_EXECUTION_PLAN/);
  }
  assert.equal(r.calls.reserve, 0); assert.equal(r.calls.creates, 0);
  const report = await executeRelativeFactsDiagnostic(selected, evidence, r.dependencies);
  assert.equal(report.error, 'CONFIGURATION_NOT_CONFIRMED'); assert.equal(r.calls.generates.length, 0);
  assert.equal(report.notPerformed.length, 18); assert.equal(r.calls.stops, 1);
});

test('production receipt reservation requests the fixed wx path and preserves bytes on a second open', async () => {
  let exists=false,contents=Buffer.alloc(0),closed=0,synced=0;
  const fakeOpen=async (file,flags)=>{
    assert.ok(file.replaceAll('\\','/').endsWith('/'+RELATIVE_FACTS_RECEIPT));assert.equal(flags,'wx');
    if(exists)throw Object.assign(Error('exists'),{code:'EEXIST'});exists=true;
    return {async write(bytes,offset,length,position){const count=Math.min(length,17),next=Buffer.alloc(Math.max(contents.length,position+count));contents.copy(next);bytes.copy(next,position,offset,offset+count);contents=next;return{bytesWritten:count}},
      async truncate(length){contents=contents.subarray(0,length)},async sync(){synced++},async close(){closed++}};
  };
  const receipt=await reserveRelativeFactsReceipt(fakeOpen);
  await receipt.save({result:'longer first checkpoint'});await receipt.save({result:'short'});await receipt.close();
  assert.deepEqual(JSON.parse(contents.toString()),{result:'short'});assert.equal(synced,2);assert.equal(closed,1);
  const before=Buffer.from(contents);await assert.rejects(reserveRelativeFactsReceipt(fakeOpen),{code:'EEXIST'});assert.deepEqual(contents,before);
});

test('check plans and a wrong fixture hash cannot enter execution or reserve a receipt', async () => {
  const r = rig();
  await assert.rejects(executeRelativeFactsDiagnostic(await prepareRelativeFactsDiagnostic(['--check'], fixture), evidence, r.dependencies), /INVALID_EXECUTION_PLAN/);
  await assert.rejects(executeRelativeFactsDiagnostic(plan, { ...evidence, fixtureSha256: '0'.repeat(64) }, r.dependencies), /INVALID_EXECUTION_PLAN/);
  assert.equal(r.calls.reserve, 0); assert.equal(r.calls.creates, 0);
});

test('existing receipt refusal never constructs a second engine or changes prior captured evidence', async () => {
  const r = rig(); await executeRelativeFactsDiagnostic(plan, evidence, r.dependencies);
  const before = structuredClone(r.calls.saves);
  await assert.rejects(executeRelativeFactsDiagnostic(plan, evidence, r.dependencies), { code: 'EEXIST' });
  assert.equal(r.calls.creates, 1); assert.equal(r.calls.starts, 1); assert.deepEqual(r.calls.saves, before);
});

test('successful synthetic run preserves measured contexts, eighteen outcomes, pins and separate discarded primer', async () => {
  const r = rig(), report = await executeRelativeFactsDiagnostic(plan, evidence, r.dependencies);
  assert.equal(report.classification, 'MOCK_ONLY'); assert.equal(report.status, 'COMPLETE_PENDING_SEMANTIC_REVIEW');
  assert.equal(report.independentSemanticReview, 'NOT_PERFORMED'); assert.equal(report.ownedProcessStopped, true);
  assert.equal(report.samples.length, 18); assert.ok(report.samples.every(s => s.status === 'TEXT_COMPLETE_DIAGNOSTIC_ONLY'));
  assert.equal(r.calls.generates.length, 19); assert.deepEqual(r.calls.generates.slice(1), plan.cases.map(c => c.context));
  assert.ok(report.samples.every(s => s.played === false && s.dispatched === false));
  assert.equal(report.primer.purpose, 'DISCARDED_CALIBRATION_ONLY'); assert.equal(report.primer.output, 'OK.');
  assert.deepEqual(report.sources, evidence.sources); assert.equal(report.fixtureSha256, RELATIVE_FACTS_FIXTURE_SHA256);
  assert.deepEqual(report.notPerformed, []); assert.equal(r.calls.stops, 1); assert.equal(r.calls.closes, 1);
  assert.match(report.limitations.join(' '), /finish_reason/);
});

for (const [label, overrides, reason] of [
  ['low RAM', { availableRam: () => 4 * GiB }, 'INITIAL_RAM_INSUFFICIENT'],
  ['low disk', { availableDisk: async () => 9 * GiB }, 'DISK_RESERVE_INSUFFICIENT'],
  ['unknown RAM', { availableRam: () => NaN }, 'INITIAL_RAM_INSUFFICIENT']
]) test(`${label} blocks before constructing an engine and preserves all cases as unperformed`, async () => {
  const r = rig(overrides), report = await executeRelativeFactsDiagnostic(plan, evidence, r.dependencies);
  assert.equal(report.status, 'INCOMPLETE'); assert.equal(report.error, reason);
  assert.equal(r.calls.creates, 0); assert.equal(r.calls.stops, 0); assert.equal(r.calls.closes, 1);
  assert.equal(report.notPerformed.length, 18); assert.equal(report.finalRuntime.state, 'NOT_STARTED');
});

test('a native case failure keeps earlier evidence and stops without retrying remaining cases', async () => {
  const r = rig(), original = r.engine.generate;
  r.engine.generate = async context => { if (r.calls.generates.length === 2) { r.calls.generates.push(context); throw Error('MODEL_FAILURE'); } return original(context); };
  const report = await executeRelativeFactsDiagnostic(plan, evidence, r.dependencies);
  assert.equal(report.status, 'INCOMPLETE'); assert.equal(report.haltReason, 'OPERATION_FAILED');
  assert.equal(report.samples[0].status, 'TEXT_COMPLETE_DIAGNOSTIC_ONLY'); assert.equal(report.samples[1].status, 'FAILED');
  assert.equal(report.samples[1].nativeTimings, null); assert.equal(report.notPerformed.length, 16);
  assert.equal(r.calls.generates.length, 3); assert.equal(r.calls.stops, 1); assert.equal(r.calls.closes, 1);
});

test('generation that ignores cancellation is bounded and cannot dispatch a later case', async () => {
  const r = rig(), original = r.engine.generate;
  r.engine.generate = async context => { if (r.calls.generates.length) { r.calls.generates.push(context); return new Promise(() => {}); } return original(context); };
  const report = await executeRelativeFactsDiagnostic(plan, evidence, r.dependencies);
  assert.equal(report.haltReason, 'OPERATION_DEADLINE'); assert.equal(report.samples[0].status, 'FAILED');
  assert.equal(report.samples[0].output, null); assert.equal(report.notPerformed.length, 17);
  assert.equal(r.calls.generates.length, 2); assert.equal(r.calls.stops, 1);
});

test('RAM loss during generation cancels the run and stops its sole worker', async () => {
  const r = rig(), original = r.engine.generate;
  r.engine.generate = async context => {
    if (r.calls.generates.length) { r.calls.generates.push(context); r.setRam(GiB); return new Promise(() => {}); }
    return original(context);
  };
  const report = await executeRelativeFactsDiagnostic(plan, evidence, r.dependencies);
  assert.equal(report.haltReason, 'RAM_RESERVE_LOST'); assert.equal(report.minimumAvailableRamBytes, GiB);
  assert.equal(report.notPerformed.length, 17); assert.equal(r.calls.stops, 1);
});

test('global startup deadline prevents a hanging start from reaching any generation', async () => {
  const r = rig({ budgets: { operationMs: 100, workMs: 100, cleanupMs: 100, sampleMs: 5 } });
  r.engine.start = () => { r.calls.starts++; return new Promise(() => {}); };
  const report = await executeRelativeFactsDiagnostic(plan, evidence, r.dependencies);
  assert.equal(report.haltReason, 'GLOBAL_TIME_LIMIT'); assert.equal(r.calls.generates.length, 0);
  assert.equal(report.notPerformed.length, 18); assert.equal(r.calls.stops, 1);
});

test('unconfirmed cleanup remains a failure even after every synthetic answer completed', async () => {
  const r = rig(); r.engine.stop = () => { r.calls.stops++; return new Promise(() => {}); };
  const report = await executeRelativeFactsDiagnostic(plan, evidence, r.dependencies);
  assert.equal(report.status, 'OWNED_PROCESS_STOP_UNCONFIRMED'); assert.equal(report.stopError, 'CLEANUP_DEADLINE');
  assert.equal(report.ownedProcessStopped, false); assert.equal(report.finalRuntime.ownedPid, 1234);
  assert.equal(r.calls.creates, 1); assert.equal(r.calls.stops, 1); assert.equal(r.calls.closes, 1);
});

test('unverified native pins stop the owned engine before calibration or measured generation', async () => {
  const r = rig(), status = r.engine.status; r.engine.status = () => ({ ...status(), verification: 'UNKNOWN' });
  const report = await executeRelativeFactsDiagnostic(plan, evidence, r.dependencies);
  assert.equal(report.error, 'PINS_NOT_VERIFIED'); assert.equal(r.calls.generates.length, 0);
  assert.equal(report.notPerformed.length, 18); assert.equal(r.calls.stops, 1);
});

for (const guard of ['RAM', 'GLOBAL', 'IO_FAILURE']) test(`${guard} while saving the pre-generation checkpoint retains unperformed cases`, async () => {
  const r = rig(guard === 'GLOBAL' ? { budgets: { operationMs: 100, workMs: 100, cleanupMs: 100, sampleMs: 5 } } : {});
  const reserve = r.dependencies.reserveReceipt; let delayed = false;
  r.dependencies.reserveReceipt = async () => {
    const receipt = await reserve(), save = receipt.save;
    receipt.save = async report => {
      if (!delayed && report.status === 'RUNNING' && r.calls.generates.length === 1) {
        delayed = true;
        assert.equal(report.samples[0].status, 'NOT_PERFORMED');
        if (guard === 'IO_FAILURE') throw Error('SYNTHETIC_WRITE_FAILURE');
        if (guard === 'RAM') r.setRam(GiB);
        await new Promise(resolve => setTimeout(resolve, 150));
      }
      return save(report);
    };
    return receipt;
  };
  const report = await executeRelativeFactsDiagnostic(plan, evidence, r.dependencies);
  assert.equal(delayed, true); assert.equal(r.calls.generates.length, 1);
  assert.equal(report.status, 'INCOMPLETE'); assert.equal(report.samples[0].status, 'NOT_PERFORMED');
  assert.equal(report.samples[0].output, null); assert.equal(report.notPerformed.length, 18);
  if (guard === 'IO_FAILURE') assert.equal(report.error, 'SYNTHETIC_WRITE_FAILURE');
  else assert.equal(report.haltReason, guard === 'RAM' ? 'RAM_RESERVE_LOST' : 'GLOBAL_TIME_LIMIT');
  assert.equal(r.calls.stops, 1); assert.equal(r.calls.closes, 1);
});

for(const [label,change] of [
  ['projection disabled',s=>{s.settings.experimentalSpeakerRelativeFacts=false}],
  ['wrong model',s=>{s.modelId='qwen1_7b'}],['wrong threads',s=>{s.threads=2}],
  ['wrong context',s=>{s.settings.contextTokens=4096}],['GPU enabled',s=>{s.settings.gpuLayers=1}],
  ['cache disabled',s=>{s.settings.promptCaching=false}]
])test(label+' refuses calibration and measured requests, stopping the owned worker',async()=>{
  const r=rig(),status=r.engine.status;r.engine.status=()=>{const s=status();change(s);return s};
  const report=await executeRelativeFactsDiagnostic(plan,evidence,r.dependencies);
  assert.equal(report.status,'INCOMPLETE');assert.equal(report.error,'CONFIGURATION_NOT_CONFIRMED');
  assert.equal(r.calls.generates.length,0);assert.equal(report.notPerformed.length,18);assert.equal(r.calls.stops,1);
});

test('successful receipt retains original contexts, full audit, exact transformed messages and separate source criteria',async()=>{
  const r=rig(),report=await executeRelativeFactsDiagnostic(plan,evidence,r.dependencies);
  assert.deepEqual(report.fixture,fixture);assert.equal(report.defaultProjectionChanged,false);
  assert.equal(report.settings.experimentalSpeakerRelativeFacts,true);
  for(const [i,s]of report.samples.entries()){
    const p=plan.cases[i];assert.deepEqual(s.originalContext,p.originalContext);assert.deepEqual(s.context,p.context);
    assert.deepEqual(s.projection,p.projection);assert.deepEqual(s.messages,p.messages);assert.deepEqual(s.provenance,p.provenance);
    assert.equal(s.semanticReview,'NOT_PERFORMED');
  }
  assert.deepEqual(report.primer.projection,plan.primer.projection);
  assert.equal(report.primer.semanticReview,'NOT_APPLICABLE');assert.equal(report.primer.played,false);
  assert.deepEqual(r.calls.generates,[plan.primer.context,...plan.cases.map(c=>c.context)]);
});
