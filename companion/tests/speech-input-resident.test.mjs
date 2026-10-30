// MOCK_ONLY: actual PTT/resident coordinators with injected in-memory pipes.
// The spawn seam below creates EventEmitters, never a process or native worker.
import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough, Writable } from 'node:stream';
import { setImmediate as flush } from 'node:timers/promises';
import { createSpeechInput } from '../speech-input.mjs';
import { createResidentRecognition } from '../resident-recognition.mjs';

const MODE = 'RESIDENT_PIPE_TRANSCRIPTION_ONLY';
const context = () => ({ session: 'resident-ptt-fixture', phase: 'active', micMuted: false,
  bindings: ['alpha', 'bravo', 'charlie'].map((id, index) => ({ id,
    pawnId: `pawn-${index}`, generation: 1, alive: true, aiOwned: true })) });
function wave() {
  const out = Buffer.alloc(44 + 1600 * 2);
  out.write('RIFF'); out.writeUInt32LE(out.length - 8, 4); out.write('WAVEfmt ', 8);
  out.writeUInt32LE(16, 16); out.writeUInt16LE(1, 20); out.writeUInt16LE(1, 22);
  out.writeUInt32LE(16000, 24); out.writeUInt32LE(32000, 28);
  out.writeUInt16LE(2, 32); out.writeUInt16LE(16, 34); out.write('data', 36);
  out.writeUInt32LE(out.length - 44, 40); return out;
}
async function drain() { await flush(); await flush(); }
function rig(t) {
  const r = { context: context(), children: [], autoClose: true, ptt: [], interrupts: [] };
  const recognizer = createResidentRecognition({ startupTimeoutMs: 1000, requestTimeoutMs: 1000,
    stopTimeoutMs: 20, resourceIntervalMs: 1000 }, {
    preflight: async () => ({ python: 'IN_MEMORY_FIXTURE', worker: 'IN_MEMORY_FIXTURE' }),
    now: () => 1000, freemem: () => 6 * 1024 ** 3,
    spawn: () => {
      const child = new EventEmitter(); child.pid = 700 + r.children.length;
      child.stdout = new PassThrough(); child.stderr = new PassThrough();
      child.requests = []; child.kills = 0; child.closed = false;
      child.close = () => {
        if (child.closed) return; child.closed = true; child.emit('close', 0, null);
      };
      child.stdin = new Writable({
        write(bytes, _encoding, done) { child.requests.push(JSON.parse(bytes.toString())); done(); },
        final(done) { if (r.autoClose) queueMicrotask(child.close); done(); }
      });
      child.kill = () => {
        child.kills++; if (r.autoClose) queueMicrotask(child.close); return true;
      };
      child.send = value => child.stdout.write(JSON.stringify(value) + '\n');
      r.children.push(child); return child;
    }
  });
  r.recognizer = recognizer;
  r.input = createSpeechInput({ recognizer, getContext: () => r.context, now: () => 1000,
    onPttChange: value => r.ptt.push(value), onInterrupt: reason => r.interrupts.push(reason) });
  r.prepare = async () => {
    const preparing = r.input.prepare(); await flush();
    const child = r.children.at(-1);
    child.send({ v: 1, type: 'ready', mode: MODE, nativeVersion: 'in-memory-fixture' });
    const prepared = await preparing; return { child, prepared };
  };
  r.finish = (child, text) => {
    const request = child.requests.findLast(row => row.type === 'transcribe');
    child.send({ v: 1, type: 'result', id: request.id, text });
  };
  t.after(async () => {
    r.autoClose = true; r.children.forEach(child => child.close());
    await drain(); await r.input.dispose(); await recognizer.dispose();
  });
  return r;
}

test('PTT admits the existing healthy retained resident worker without changing its ownership', async t => {
  const r = rig(t); assert.equal(r.children.length, 0);
  const { child, prepared } = await r.prepare();
  assert.equal(prepared.engine.mode, MODE); assert.equal(prepared.engine.state, 'READY');
  assert.equal(prepared.engine.ownsProcess, true); assert.equal(prepared.engine.processStopConfirmed, false);
  assert.equal(r.children.length, 1); assert.equal(r.input.begin().current.status, 'CAPTURING');
  assert.deepEqual(r.ptt, [true]); assert.deepEqual(r.interrupts, ['SPEECH_INPUT_PTT']);
  assert.equal(child.requests.length, 0); assert.equal(r.input.status().dispatchable, false);
});

test('two PTT submissions reuse one healthy resident and return only untrusted previews', async t => {
  const r = rig(t), { child } = await r.prepare();
  const requestIds = [];
  for (const text of ['regroup slot 1', 'release slot 2']) {
    const capture = r.input.begin().current;
    const pending = r.input.submit(capture.id, wave());
    const request = child.requests.findLast(row => row.type === 'transcribe'); requestIds.push(request.id);
    r.finish(child, text); const result = await pending;
    assert.equal(result.current.status, 'TRANSCRIBED'); assert.equal(result.current.text, text);
    assert.equal(result.current.classification, 'UNTRUSTED_RECOGNITION');
    assert.equal(result.dispatchable, false); assert.equal(result.engine.ownsProcess, true);
    assert.equal(result.engine.state, 'READY');
  }
  assert.equal(r.children.length, 1); assert.ok(requestIds[1] > requestIds[0]);
  assert.deepEqual(r.ptt, [true, false, true, false]);
});

test('cancelling resident capture stops its worker and requires explicit preparation again', async t => {
  const r = rig(t); await r.prepare(); const first = r.input.begin().current.id;
  r.input.cancel(first); await drain();
  assert.equal(r.input.status().current.status, 'CANCELLED');
  assert.equal(r.recognizer.status().ownsProcess, false);
  assert.throws(() => r.input.begin(), /SPEECH_INPUT_NOT_PREPARED/);
  await r.prepare(); const second = r.input.begin().current.id;
  assert.notEqual(second, first); assert.equal(r.children.length, 2);
  r.input.cancel(first); assert.equal(r.input.status().current.id, second);
  assert.equal(r.input.status().current.status, 'CAPTURING');
});

test('cancelling resident transcription settles safely and discards late text', async t => {
  const r = rig(t), { child } = await r.prepare(), id = r.input.begin().current.id;
  const pending = r.input.submit(id, wave()); r.input.cancel(id);
  const result = await pending; await drain();
  assert.equal(result.current.status, 'CANCELLED'); assert.equal(result.current.text, undefined);
  assert.equal(child.kills, 1); r.finish(child, 'obsolete text'); await drain();
  assert.equal(r.input.status().current.text, undefined); assert.equal(r.children.length, 1);
  assert.equal(r.recognizer.status().ownsProcess, false);
});

test('identity change cancels resident transcription and cannot publish its old actor context', async t => {
  const r = rig(t), { child } = await r.prepare(), id = r.input.begin().current.id;
  const pending = r.input.submit(id, wave()); r.context.bindings[0].generation++;
  assert.equal(r.input.status().current.error, 'SPEECH_INPUT_CONTEXT_CHANGED');
  assert.equal((await pending).current.text, undefined); await drain();
  r.finish(child, 'old binding'); assert.equal(r.input.status().current.text, undefined);
  assert.equal(r.children.length, 1); assert.deepEqual(r.ptt, [true, false]);
});

test('resident disposal confirms closure, releases PTT and permanently refuses new work', async t => {
  const r = rig(t); await r.prepare(); r.input.begin();
  const disposed = await r.input.dispose();
  assert.equal(disposed.shutdownComplete, true); assert.equal(disposed.cleanupPending, false);
  assert.equal(disposed.engine.ownsProcess, false); assert.equal(disposed.engine.processStopConfirmed, true);
  assert.deepEqual(r.ptt, [true, false]);
  await assert.rejects(r.input.prepare(), /SPEECH_INPUT_DISPOSED/);
  assert.throws(() => r.input.begin(), /SPEECH_INPUT_DISPOSED/);
});

test('unconfirmed resident closure never permits a replacement worker or another capture', async t => {
  const r = rig(t); await r.prepare(); r.autoClose = false;
  r.input.cancel(r.input.begin().current.id); await new Promise(resolve => setTimeout(resolve, 35));
  assert.equal(r.input.status().engine.state, 'STOPPING');
  assert.equal(r.input.status().engine.ownsProcess, true); assert.equal(r.input.status().shutdownComplete, false);
  await assert.rejects(r.input.prepare()); assert.equal(r.children.length, 1);
  assert.throws(() => r.input.begin());
});

function readyStatus(patch = {}) {
  return { state: 'READY', mode: MODE, busy: false, ownsProcess: true, processStopConfirmed: false,
    pendingPreflight: false, pid: 701, lastError: null, ...patch };
}
function statusRig(t, ready) {
  let status = readyStatus({ state: 'STOPPED', ownsProcess: false, processStopConfirmed: true, pid: null });
  const recognizer = { status: () => structuredClone(status),
    async start() { status = ready; }, async transcribe() { throw Error('NOT_EXPECTED'); },
    async stop() { status = { state: 'STOPPED', busy: false, ownsProcess: false, processStopConfirmed: true }; },
    async dispose() { await this.stop(); } };
  const input = createSpeechInput({ recognizer, getContext: context, now: () => 1000 });
  t.after(() => input.dispose()); return input;
}
for (const [label, patch] of [
  ['pending startup', { state: 'STARTING' }], ['busy request', { busy: true }],
  ['stopping worker', { state: 'STOPPING' }], ['failed worker', { state: 'STOP_FAILED' }],
  ['absent retained ownership', { ownsProcess: false }], ['unknown retained ownership', { ownsProcess: undefined }],
  ['already closed worker', { processStopConfirmed: true }], ['unknown closure state', { processStopConfirmed: undefined }],
  ['pending preflight', { pendingPreflight: true }], ['unknown preflight', { pendingPreflight: undefined }],
  ['missing owned PID', { pid: null }], ['invalid owned PID', { pid: 0 }],
  ['unresolved resident failure', { lastError: 'RESIDENT_STOP_UNCONFIRMED' }],
  ['pending cleanup', { cleanupPending: true }], ['failed cleanup', { cleanupBlocked: true }],
  ['cold mode claiming retained ownership', { mode: 'COLD_FILE_TRANSCRIPTION_ONLY' }],
  ['unrecognized retained mode', { mode: 'UNKNOWN_RETAINED_ENGINE' }]
]) test(`inconsistent readiness fails closed: ${label}`, async t => {
  const input = statusRig(t, readyStatus(patch));
  await assert.rejects(input.prepare(), /SPEECH_INPUT_ENGINE_NOT_READY/);
  assert.throws(() => input.begin(), /SPEECH_INPUT_NOT_PREPARED|SPEECH_INPUT_BUSY/);
});

for (const mode of [undefined, 'COLD_FILE_TRANSCRIPTION_ONLY']) {
  test(`existing idle nonresident readiness remains supported (${mode ?? 'legacy injected status'})`, async t => {
    const input = statusRig(t, { state: 'READY', busy: false, ownsProcess: false,
      processStopConfirmed: true, ...(mode === undefined ? {} : { mode }) });
    await input.prepare(); assert.equal(input.begin().current.status, 'CAPTURING');
  });
}
