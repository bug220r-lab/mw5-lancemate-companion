// Independent fixed-model-substitution review. All execution/receipt dependencies are inert.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { RELATIVE_FACTS_FIXTURE_SHA256, RELATIVE_FACTS_QWEN17B_RECEIPT, RELATIVE_FACTS_QWEN17B_PREDECESSOR_SHA256,
  readRelativeFactsQwen17bPredecessor, readFrozenRelativeFactsFixture, prepareRelativeFactsDiagnostic,
  executeRelativeFactsDiagnostic, reserveRelativeFactsReceipt } from '../../scripts/Exercise-ConversationRelativeFacts.mjs';

const GiB = 1024 ** 3, sha = bytes => createHash('sha256').update(bytes).digest('hex');
const fixture = readFrozenRelativeFactsFixture(await readFile(new URL('../../synthetic/conversation-relative-facts-cases.json', import.meta.url)));
const bytes = await readFile(new URL('../../research/QWEN4B_RELATIVE_FACTS_ATTEMPT_002.json', import.meta.url)), prior = JSON.parse(bytes);
const plan = await prepareRelativeFactsDiagnostic(['--run-qwen17b'], fixture);
const lock = JSON.parse(await readFile(new URL('../models.lock.json', import.meta.url)));
const evidence = { fixtureSha256: RELATIVE_FACTS_FIXTURE_SHA256, sources: { review: 'MOCK_ONLY' },
  modelPins: lock.artifacts.filter(a => ['qwen1_7b', 'llama-cpu'].includes(a.id)), runtimePins: [] };

function rig({ runtimeModel = 'qwen1_7b', ram = 6 * GiB, refusal = false, mismatch = {} } = {}) {
  const calls = { reserve: [], factories: [], generates: [], starts: 0, stops: 0, closes: 0 }; let stopped = true;
  const engine = {
    async start() { calls.starts++; stopped = false; },
    async generate(context) { calls.generates.push(structuredClone(context)); return 'Mock response.'; },
    async stop() { calls.stops++; stopped = true; },
    status: () => ({ modelId: runtimeModel, threads: 4, state: stopped ? 'STOPPED' : 'READY', ownedPid: stopped ? null : 123,
      ownedProcessStopped: stopped, verification: 'PINNED_FILES_VERIFIED', log: '', settings: {
        host: '127.0.0.1', contextTokens: 2048, maxOutputTokens: 64, maxOutputChars: 256, gpuLayers: 0,
        processingBatch: 'compact', weightRepacking: false, promptCaching: true, experimentalSpeakerRelativeFacts: true,
        logicalBatchTokens: 128, physicalBatchTokens: 64, simultaneousModels: 1, thinking: false, webUI: false, mcpProxy: false, ...mismatch } })
  };
  return { calls, dependencies: {
    async reserveReceipt(action) { calls.reserve.push(action); if (refusal) throw Object.assign(Error('Exists'), { code: 'EEXIST' });
      return { async save() {}, async close() { calls.closes++; } }; },
    createEngine(options) { calls.factories.push(structuredClone(options)); return engine; },
    availableRam: () => ram, availableDisk: async () => 20 * GiB
  } };
}

test('fixed fallback preserves predecessor bytes, exact 18 inputs and primer while naming the official Q8 model', async () => {
  assert.equal(RELATIVE_FACTS_QWEN17B_RECEIPT, 'research/QWEN17B_RELATIVE_FACTS_DIAGNOSTIC.json');
  assert.equal(RELATIVE_FACTS_QWEN17B_PREDECESSOR_SHA256, 'e227f94995bab1c44a3296c50202c995e36c9b25d2302f0cd1d05bd6266fb67b');
  assert.equal(sha(bytes), RELATIVE_FACTS_QWEN17B_PREDECESSOR_SHA256);
  const predecessor = { path: 'research/QWEN4B_RELATIVE_FACTS_ATTEMPT_002.json', sha256: RELATIVE_FACTS_QWEN17B_PREDECESSOR_SHA256 };
  assert.deepEqual(readRelativeFactsQwen17bPredecessor(bytes), predecessor);
  assert.throws(() => readRelativeFactsQwen17bPredecessor(Buffer.concat([bytes, Buffer.from('\n')])));
  assert.deepEqual(plan.modelSubstitution, { id: 'QWEN17B_OFFICIAL_Q8', receiptPath: RELATIVE_FACTS_QWEN17B_RECEIPT,
    referenceModelId: 'qwen4b', modelId: 'qwen1_7b', predecessor });
  assert.equal(plan.attempt, undefined); assert.ok(Object.isFrozen(plan.modelSubstitution));
  assert.deepEqual(plan.fixture, prior.fixture); assert.equal(plan.cases.length, 18);
  for (const [i,c] of plan.cases.entries()) {
    assert.equal(c.specification.id, prior.samples[i].id);
    for (const key of ['originalContext','context','projection','messages','messageCharacters','provenance','capture'])
      assert.deepEqual(c[key], prior.samples[i][key], `${c.specification.id}:${key}`);
  }
  for (const key of ['originalContext','context','projection','messages','messageCharacters']) assert.deepEqual(plan.primer[key], prior.primer[key]);
  assert.equal(plan.cases.filter(c => c.capture.coordinatorCalls === 1).length, 10);
  assert.equal(plan.cases.filter(c => c.provenance.kind === 'NEW_PREDECLARED_HOLDOUT').length, 4);
  const official = evidence.modelPins.find(p => p.id === 'qwen1_7b');
  assert.equal(official.name, 'Qwen3-1.7B-Q8_0.gguf'); assert.equal(official.sha256, '061b54daade076b5d3362dac252678d17da8c68f07560be70818cace6590cb1a');
  assert.equal(official.bytes, 1834426016);
  for (const action of ['--check','--run','--run-attempt-002']) {
    const old = await prepareRelativeFactsDiagnostic([action], fixture);
    assert.deepEqual(old.cases, plan.cases); assert.deepEqual(old.primer, plan.primer); assert.equal(old.modelSubstitution, undefined);
  }
});

test('actual injected factory receives only the official model substitution and recorded limits remain identical', async () => {
  const r = rig(), report = await executeRelativeFactsDiagnostic(plan, evidence, r.dependencies);
  assert.equal(report.status, 'COMPLETE_PENDING_SEMANTIC_REVIEW'); assert.equal(report.classification, 'MOCK_ONLY');
  assert.deepEqual(r.calls.factories, [{ modelId: 'qwen1_7b', threads: 4, processingBatch: 'compact',
    weightRepacking: false, promptCaching: true, experimentalSpeakerRelativeFacts: true }]);
  const { modelId: oldModel, ...oldSettings } = prior.settings, { modelId: newModel, ...newSettings } = report.settings;
  assert.equal(oldModel, 'qwen4b'); assert.equal(newModel, 'qwen1_7b'); assert.deepEqual(newSettings, oldSettings);
  assert.deepEqual(report.modelSubstitution, plan.modelSubstitution); assert.deepEqual(report.modelPins, evidence.modelPins);
  assert.deepEqual(r.calls.generates, [plan.primer.context, ...plan.cases.map(c => c.context)]);
  assert.deepEqual(r.calls.reserve, ['--run-qwen17b']); assert.equal(r.calls.starts, 1); assert.equal(r.calls.stops, 1);
  assert.equal(report.independentSemanticReview, 'NOT_PERFORMED'); assert.equal(report.gameAcceptance, 'NOT_PERFORMED');
  assert.ok(report.samples.every(c => !c.dispatched && !c.played));
});

test('wrong effective runtime model or inference configuration fails before primer despite a correct fallback label', async () => {
  for (const options of [{ runtimeModel: 'qwen4b' }, { mismatch: { promptCaching: false } },
    { mismatch: { weightRepacking: true } }, { mismatch: { logicalBatchTokens: 2048 } }]) {
    const r = rig(options), report = await executeRelativeFactsDiagnostic(plan, evidence, r.dependencies);
    assert.equal(report.status, 'INCOMPLETE'); assert.equal(report.error, 'CONFIGURATION_NOT_CONFIRMED');
    assert.equal(report.primer.status, 'NOT_PERFORMED'); assert.equal(report.notPerformed.length, 18);
    assert.equal(r.calls.generates.length, 0); assert.equal(r.calls.stops, 1);
  }
});

test('no unreviewed model, renamed receipt, altered predecessor or cross-selector metadata is admissible', async () => {
  for (const args of [['--run-qwen17b','--model','local-q4'], ['--run-qwen17b','--threads','2'],
    ['--run-qwen17b','--output','somewhere.json'], ['--run-qwen17b','--ram','0'], ['--run-qwen17b','--mock'], ['--run-qwen17b-002']])
    await assert.rejects(prepareRelativeFactsDiagnostic(args,fixture),/INVALID_ARGUMENTS/);
  for (const change of [p => { p.modelSubstitution.modelId='qwen4b'; }, p => { p.modelSubstitution.receiptPath=prior.attempt.receiptPath; },
    p => { p.modelSubstitution.predecessor.sha256='0'.repeat(64); }, p => { p.action='--run'; },
    p => { p.attempt=prior.attempt; }, p => { delete p.modelSubstitution; }]) {
    const altered=structuredClone(plan); change(altered); const r=rig();
    await assert.rejects(executeRelativeFactsDiagnostic(altered,evidence,r.dependencies));
    assert.equal(r.calls.reserve.length,0); assert.equal(r.calls.factories.length,0);
  }
});

test('fixed wx reservation cannot overwrite either earlier receipt or a completed fallback receipt', async () => {
  const files=new Map([['research/QWEN4B_RELATIVE_FACTS_DIAGNOSTIC.json',Buffer.from('original')],
    ['research/QWEN4B_RELATIVE_FACTS_ATTEMPT_002.json',Buffer.from(bytes)]]), opens=[];
  const before=new Map([...files].map(([k,v])=>[k,Buffer.from(v)]));
  const fakeOpen=async(file,flags)=>{
    const name=file.replaceAll('\\','/').split('/research/').at(-1), key='research/'+name;
    assert.equal(flags,'wx'); opens.push(key); if(files.has(key))throw Object.assign(Error('Exists'),{code:'EEXIST'});
    assert.equal(key,RELATIVE_FACTS_QWEN17B_RECEIPT); files.set(key,Buffer.alloc(0));
    return {async write(data,offset,length,position){assert.equal(position,0);files.set(key,Buffer.from(data));return{bytesWritten:length};},
      async truncate(n){files.set(key,files.get(key).subarray(0,n));},async sync(){},async close(){}};
  };
  for(const action of ['--run','--run-attempt-002'])await assert.rejects(reserveRelativeFactsReceipt(fakeOpen,action),{code:'EEXIST'});
  const receipt=await reserveRelativeFactsReceipt(fakeOpen,'--run-qwen17b');await receipt.save({classification:'MOCK_ONLY'});await receipt.close();
  const fallback=Buffer.from(files.get(RELATIVE_FACTS_QWEN17B_RECEIPT));
  await assert.rejects(reserveRelativeFactsReceipt(fakeOpen,'--run-qwen17b'),{code:'EEXIST'});
  assert.deepEqual(files.get(RELATIVE_FACTS_QWEN17B_RECEIPT),fallback);
  for(const [key,value]of before)assert.deepEqual(files.get(key),value);
  const count=opens.length;await assert.rejects(reserveRelativeFactsReceipt(fakeOpen,'--run-qwen17b-002'));assert.equal(opens.length,count);
});

test('unchanged RAM admission and an existing fallback receipt prevent any model factory call', async () => {
  const r=rig({ram:5*GiB-1}),report=await executeRelativeFactsDiagnostic(plan,evidence,r.dependencies);
  assert.equal(report.error,'INITIAL_RAM_INSUFFICIENT');assert.equal(report.notPerformed.length,18);
  assert.equal(report.primer.status,'NOT_PERFORMED');assert.equal(r.calls.factories.length,0);assert.equal(r.calls.closes,1);
  const exists=rig({refusal:true});await assert.rejects(executeRelativeFactsDiagnostic(plan,evidence,exists.dependencies),{code:'EEXIST'});
  assert.equal(exists.calls.factories.length,0);assert.equal(exists.calls.starts,0);
});
