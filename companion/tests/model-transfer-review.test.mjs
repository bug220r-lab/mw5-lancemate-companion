// Independent MOCK_ONLY supervisor review. No native model or real receipt writes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';
import { MODEL_TRANSFER_FIXTURE_SHA256, MODEL_TRANSFER_RECEIPT,
  readFrozenModelTransferFixture, prepareModelTransferDiagnostic,
  reserveModelTransferReceipt, executeModelTransferDiagnostic } from '../../scripts/Exercise-ConversationModelTransfer.mjs';
import { smollmMessagesFor } from '../local-language-model.mjs';

const GiB = 1024 ** 3;
const fixture = readFrozenModelTransferFixture(await readFile(new URL('../../synthetic/conversation-model-transfer-cases.json', import.meta.url)));
const plan = await prepareModelTransferDiagnostic(['--run'], fixture);
const evidence = { fixtureSha256: MODEL_TRANSFER_FIXTURE_SHA256, sources: {}, modelPins: [], runtimePins: [] };
const settings = { host: '127.0.0.1', contextTokens: 2048, maxOutputTokens: 64, maxOutputChars: 256, gpuLayers: 0,
  processingBatch: 'compact', weightRepacking: false, promptCaching: true, experimentalSpeakerRelativeFacts: true,
  experimentalSpeakerBriefing: true, experimentalSeparateRequest: true, logicalBatchTokens: 128,
  physicalBatchTokens: 64, simultaneousModels: 1, thinking: false, webUI: false, mcpProxy: false };
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
function rig() {
  let alive = false, reserved = false;
  const state = { finish: null, timings: null, ram: 6 * GiB };
  const calls = { starts: 0, stops: 0, closes: 0, contexts: [], snapshots: [] };
  const engine = {
    async start() { calls.starts++; alive = true; },
    async generate(context) {
      calls.contexts.push(structuredClone(context)); state.finish = 'stop';
      state.timings = { predicted_n: 3, predicted_ms: 2 }; return 'Unreviewed mock reply.';
    },
    async stop() { calls.stops++; alive = false; },
    status: () => ({ state: alive ? 'READY' : 'STOPPED', modelId: 'smollm3_3b', threads: 4,
      verification: 'PINNED_FILES_VERIFIED', ownedPid: alive ? 12345 : null, ownedProcessStopped: !alive,
      activeGeneration: false, settings: { ...settings }, log: '', lastGenerationFinishReason: state.finish,
      lastGenerationTimings: state.timings })
  };
  const io = {
    async reserveReceipt() {
      if (reserved) throw Object.assign(Error('exists'), { code: 'EEXIST' }); reserved = true;
      return { async save(report) { calls.snapshots.push(structuredClone(report)); }, async close() { calls.closes++; } };
    },
    createEngine: () => engine, availableRam: () => state.ram, availableDisk: async () => 20 * GiB,
    budgets: { operationMs: 150, workMs: 2500, cleanupMs: 50, sampleMs: 5 }
  };
  return { engine, io, calls, state };
}

test('review: model payloads exactly preserve each original request and the old eighteen actor/fact contexts', async () => {
  const prior = JSON.parse(await readFile(new URL('../../research/QWEN17B_SEPARATED_REQUEST_DIAGNOSTIC.json', import.meta.url)));
  assert.equal(plan.cases.length, 26);
  for (const [i, c] of plan.cases.entries()) {
    assert.equal(c.messages.length, 3); assert.equal(c.messages[2].role, 'user');
    assert.equal(c.messages[2].content, c.context.request.text);
    assert.deepEqual(c.messages, smollmMessagesFor(c.context));
    if (i < 8) assert.deepEqual(c.context, fixture.cases[i].context);
    else for (const k of ['context', 'originalContext', 'projection', 'capture', 'provenance'])
      assert.deepEqual(c[k], prior.samples[i - 8][k]);
  }
  // The supplied caller's actor naming cannot fill the intentionally missing speaker binding.
  assert.equal(Object.hasOwn(plan.cases[5].context, 'speakerId'), false);
  assert.equal(plan.cases[5].projection.prompt.binding, 'UNKNOWN');
  assert.ok(plan.cases.slice(0, 8).every(c => c.capture.coordinatorCalls === 0));
});

test('review: receipt writer handles partial writes, truncates old tails, syncs and keeps its fixed path', async () => {
  let stored = Buffer.alloc(0), position = 0, syncs = 0, closed = 0;
  const receipt = await reserveModelTransferReceipt(async (file, mode) => {
    assert.ok(file.replaceAll('\\', '/').endsWith('/' + MODEL_TRANSFER_RECEIPT)); assert.equal(mode, 'wx');
    return {
      async write(bytes, offset, count, at) {
        assert.equal(at, offset); const n = Math.min(count, 7);
        if (stored.length < at + n) { const grown = Buffer.alloc(at + n); stored.copy(grown); stored = grown; }
        bytes.copy(stored, at, offset, offset + n); position = at + n; return { bytesWritten: n };
      },
      async truncate(length) { assert.equal(position, length); stored = stored.subarray(0, length); },
      async sync() { syncs++; }, async close() { closed++; }
    };
  });
  await receipt.save({ value: 'A'.repeat(100) }); await receipt.save({ value: 'short' });
  assert.deepEqual(JSON.parse(stored.toString()), { value: 'short' });
  assert.equal(syncs, 2); await receipt.close(); assert.equal(closed, 1);
});

test('review: a zero-progress receipt write rejects instead of looping or claiming a saved result', async () => {
  let writes = 0, truncates = 0, syncs = 0;
  const receipt = await reserveModelTransferReceipt(async () => ({
    async write() { writes++; return { bytesWritten: 0 }; }, async truncate() { truncates++; },
    async sync() { syncs++; }, async close() {}
  }));
  await assert.rejects(receipt.save({ a: 1 }), /RECEIPT_WRITE_FAILED/);
  assert.equal(writes, 1); assert.equal(truncates, 0); assert.equal(syncs, 0);
});

test('review: a concurrent attempt cannot acquire the receipt or start a second worker', async () => {
  const r = rig(), started = deferred(), release = deferred(), start = r.engine.start;
  r.engine.start = async () => { await start(); started.resolve(); await release.promise; };
  const first = executeModelTransferDiagnostic(plan, evidence, r.io); await started.promise;
  await assert.rejects(executeModelTransferDiagnostic(plan, evidence, r.io), { code: 'EEXIST' });
  assert.equal(r.calls.starts, 1); release.resolve(); await first;
  assert.equal(r.calls.stops, 1); assert.equal(r.calls.closes, 1);
});

test('review: deadline while disk measurement drains prevents subsequent model construction', async () => {
  const r = rig(), diskEntered = deferred(), disk = deferred(); r.io.budgets.workMs = 10;
  r.io.availableDisk = () => { diskEntered.resolve(); return disk.promise; };
  const pending = executeModelTransferDiagnostic(plan, evidence, r.io); await diskEntered.promise;
  await sleep(20); disk.resolve(20 * GiB); const report = await pending;
  assert.equal(report.haltReason, 'GLOBAL_TIME_LIMIT'); assert.equal(r.calls.starts, 0);
  assert.equal(report.primer.status, 'NOT_PERFORMED'); assert.equal(report.notPerformed.length, 26);
});

test('review: RAM loss cancels the current invocation, retains null failed text and does not retry', async () => {
  const r = rig(), generate = r.engine.generate, late = deferred(); let pendingSignal;
  r.engine.generate = (context, opts) => {
    if (!r.calls.contexts.length) return generate(context, opts);
    r.calls.contexts.push(structuredClone(context)); pendingSignal = opts.signal; r.state.ram = GiB;
    return late.promise;
  };
  const report = await executeModelTransferDiagnostic(plan, evidence, r.io);
  assert.equal(report.haltReason, 'RAM_RESERVE_LOST'); assert.equal(report.samples[0].status, 'FAILED');
  assert.equal(report.samples[0].output, null); assert.equal(report.samples[0].finishReason, null);
  assert.equal(report.samples[0].nativeTimings, null); assert.equal(report.notPerformed.length, 25);
  assert.equal(pendingSignal.aborted, true); assert.equal(r.calls.contexts.length, 2);
  const terminal = structuredClone(report), saves = r.calls.snapshots.length;
  late.resolve('A late answer must not resurrect this run.'); await sleep(0);
  assert.deepEqual(report, terminal); assert.equal(r.calls.snapshots.length, saves); assert.equal(r.calls.stops, 1);
});

test('review: interruption aborts an ignoring worker and removes only the runner signal listeners', async () => {
  const r = rig(), invoked = deferred(), late = deferred(); let signal;
  const counts = ['SIGINT', 'SIGTERM'].map(s => process.listenerCount(s));
  r.engine.generate = (context, options) => { r.calls.contexts.push(context); signal = options.signal; invoked.resolve(); return late.promise; };
  const pending = executeModelTransferDiagnostic(plan, evidence, r.io); await invoked.promise; process.emit('SIGINT');
  const report = await pending;
  assert.equal(report.haltReason, 'SUPERVISOR_INTERRUPTED'); assert.equal(signal.aborted, true);
  assert.equal(report.primer.status, 'FAILED'); assert.equal(report.notPerformed.length, 26);
  assert.deepEqual(['SIGINT', 'SIGTERM'].map(s => process.listenerCount(s)), counts);
  assert.equal(r.calls.stops, 1); late.resolve('ignored'); await sleep(0);
});

test('review: rejected stop and falsely unconfirmed ownership cannot produce a clean completion', async () => {
  for (const mode of ['reject', 'retained-child']) {
    const r = rig(); r.engine.stop = async () => { r.calls.stops++; if (mode === 'reject') throw Error('PROCESS_STOP_UNCONFIRMED'); };
    const report = await executeModelTransferDiagnostic(plan, evidence, r.io);
    assert.equal(report.status, 'OWNED_PROCESS_STOP_UNCONFIRMED'); assert.equal(report.ownedProcessStopped, false);
    assert.equal(report.independentSemanticReview, 'NOT_PERFORMED'); assert.equal(r.calls.closes, 1);
    assert.equal(r.calls.stops, 1); assert.equal(report.samples.length, 26);
  }
});

test('review: failed startup still owns teardown and leaves every measured case uninvoked', async () => {
  const r = rig(), start = r.engine.start;
  r.engine.start = async () => { await start(); throw Error('MODEL_LOAD_FAILED'); };
  const report = await executeModelTransferDiagnostic(plan, evidence, r.io);
  assert.equal(report.error, 'MODEL_LOAD_FAILED'); assert.equal(report.status, 'INCOMPLETE');
  assert.equal(report.primer.status, 'NOT_PERFORMED'); assert.equal(report.notPerformed.length, 26);
  assert.equal(r.calls.contexts.length, 0); assert.equal(r.calls.stops, 1); assert.equal(report.ownedProcessStopped, true);
});

test('review: aborted truncation cannot borrow the previous successful terminal metadata', async () => {
  const r = rig(), generate = r.engine.generate; r.io.budgets.operationMs = 10;
  r.engine.generate = async (context, opts) => {
    if (!r.calls.contexts.length) return generate(context, opts);
    r.calls.contexts.push(context); await sleep(20); r.state.finish = 'length'; throw Error('GENERATED_TEXT_TRUNCATED');
  };
  const report = await executeModelTransferDiagnostic(plan, evidence, r.io);
  assert.equal(report.haltReason, 'OPERATION_DEADLINE'); assert.equal(report.samples[0].output, null);
  assert.equal(report.samples[0].finishReason, null); assert.equal(report.samples[0].nativeTimings, null);
  await sleep(25); assert.equal(report.samples[0].finishReason, null); assert.equal(r.calls.contexts.length, 2);
});

test('review: invalid returned text is rejected despite an asserted stop reason', async () => {
  for (const output of ['', '   ', 'x'.repeat(257), { text: 'not a string' }]) {
    const r = rig(); r.engine.generate = async () => { r.state.finish = 'stop'; return output; };
    const report = await executeModelTransferDiagnostic(plan, evidence, r.io);
    assert.equal(report.error, 'INVALID_GENERATED_TEXT'); assert.equal(report.primer.status, 'FAILED');
    assert.equal(report.primer.output, null); assert.equal(report.primer.finishReason, null);
    assert.equal(report.primer.nativeTimings, null); assert.equal(report.notPerformed.length, 26);
  }
});

test('review: failed checkpoint remains an error while its owned worker still stops and closes', async () => {
  const r = rig(), reserve = r.io.reserveReceipt; let saves = 0;
  r.io.reserveReceipt = async () => { const receipt = await reserve(); return { ...receipt, async save(report) {
    if (++saves === 3) throw Error('CHECKPOINT_IO_FAILED'); await receipt.save(report);
  } }; };
  const report = await executeModelTransferDiagnostic(plan, evidence, r.io);
  assert.equal(report.status, 'INCOMPLETE'); assert.equal(report.error, 'CHECKPOINT_IO_FAILED');
  assert.equal(report.primer.status, 'TEXT_COMPLETE_DIAGNOSTIC_ONLY');
  assert.equal(report.notPerformed.length, 26); assert.equal(r.calls.stops, 1); assert.equal(r.calls.closes, 1);
});
