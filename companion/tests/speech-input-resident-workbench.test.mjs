// MOCK_ONLY: actual workbench/PTT/resident coordinators with in-memory process
// and engine fakes. No startServer, network, worker, microphone or model runs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough, Writable } from 'node:stream';
import { mkdtemp, rm } from 'node:fs/promises';
import { setImmediate as flush } from 'node:timers/promises';
import os from 'node:os';
import path from 'node:path';
import { createWorkbench } from '../server.mjs';
import { createResidentRecognition } from '../resident-recognition.mjs';

async function drain() { await flush(); await flush(); }
function wave() {
  const out = Buffer.alloc(3244); out.write('RIFF'); out.writeUInt32LE(out.length - 8, 4);
  out.write('WAVEfmt ', 8); out.writeUInt32LE(16, 16); out.writeUInt16LE(1, 20);
  out.writeUInt16LE(1, 22); out.writeUInt32LE(16000, 24); out.writeUInt32LE(32000, 28);
  out.writeUInt16LE(2, 32); out.writeUInt16LE(16, 34); out.write('data', 36);
  out.writeUInt32LE(out.length - 44, 40); return out;
}
async function fixture(t) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'mw5-resident-ptt-'));
  const children = [], models = { starts: 0, generations: 0, syntheses: 0 };
  const recognizer = createResidentRecognition({ startupTimeoutMs: 1000, requestTimeoutMs: 1000,
    stopTimeoutMs: 20, resourceIntervalMs: 1000 }, {
    preflight: async () => ({ python: 'IN_MEMORY_FIXTURE', worker: 'IN_MEMORY_FIXTURE' }),
    now: () => 1000, freemem: () => 6 * 1024 ** 3,
    spawn: () => {
      const child = new EventEmitter(); child.pid = 1700 + children.length;
      child.stdout = new PassThrough(); child.stderr = new PassThrough(); child.requests = [];
      let closed = false;
      child.close = () => { if (!closed) { closed = true; child.emit('close', 0, null); } };
      child.stdin = new Writable({
        write(bytes, _encoding, done) { child.requests.push(JSON.parse(bytes.toString())); done(); },
        final(done) { queueMicrotask(child.close); done(); }
      });
      child.kill = () => { queueMicrotask(child.close); return true; };
      child.send = value => child.stdout.write(JSON.stringify(value) + '\n');
      children.push(child);
      queueMicrotask(() => child.send({ v: 1, type: 'ready',
        mode: 'RESIDENT_PIPE_TRANSCRIPTION_ONLY', nativeVersion: 'in-memory-fixture' }));
      return child;
    }
  });
  const stopped = () => ({ state: 'STOPPED', busy: false, ownsProcess: false, processStopConfirmed: true });
  const w = await createWorkbench({ settingsPath: path.join(directory, 'settings.json'),
    recognitionEngine: recognizer, realNow: () => 1000,
    languageModel: { status: stopped, async start() { models.starts++; throw Error('NOT_EXPECTED'); },
      async generate() { models.generations++; throw Error('NOT_EXPECTED'); }, async stop() {} },
    speechEngine: { getState: stopped, async start() { models.starts++; throw Error('NOT_EXPECTED'); },
      async synthesize() { models.syntheses++; throw Error('NOT_EXPECTED'); }, async stop() {} },
    resourcePolicy: { async admit() { throw Error('NOT_EXPECTED'); }, startWatch() {}, stopWatch() {},
      status: () => ({ monitoring: false, sampling: false, admissionPending: false, cleanupPending: false }) }
  });
  t.after(async () => {
    children.forEach(child => child.close()); await drain(); await w.dispose(); await recognizer.dispose();
    const target = path.resolve(directory);
    assert.equal(path.dirname(target), path.resolve(os.tmpdir()));
    assert.ok(path.basename(target).startsWith('mw5-resident-ptt-'));
    await rm(target, { recursive: true, force: true });
  });
  await w.act({ type: 'demo' }); await drain();
  async function begin() {
    await w.act({ type: 'recognition_prepare' }); await drain();
    const state = await w.act({ type: 'ptt_begin' }); return state.speechInput.current.id;
  }
  return { w, recognizer, children, models, begin };
}

test('workbench injected resident engine transcribes without implicit parsing, control or other engines', async t => {
  const r = await fixture(t);
  assert.equal(r.children.length, 0); assert.equal(r.w.state().speechInput.engine.state, 'STOPPED');
  const id = await r.begin(), child = r.children[0];
  assert.equal(r.w.state().speechInput.engine.ownsProcess, true);
  assert.equal(r.w.state().radio.gates.ptt, true);
  const pending = r.w.submitRecognition(id, wave()); await flush();
  const request = child.requests.findLast(row => row.type === 'transcribe');
  child.send({ v: 1, type: 'result', id: request.id, text: 'regroup slot 1' });
  const state = await pending;
  assert.equal(state.speechInput.current.text, 'regroup slot 1');
  assert.equal(state.speechInput.current.classification, 'UNTRUSTED_RECOGNITION');
  assert.equal(state.speechInput.dispatchable, false); assert.equal(state.radio.gates.ptt, false);
  assert.equal(state.control.nativeCalls, 0); assert.equal(state.last.status, 'MICROPHONE_CAPTURE_GRANTED');
  assert.deepEqual(r.models, { starts: 0, generations: 0, syntheses: 0 });
  assert.equal(r.children.length, 1);
  assert.equal((await r.w.dispose()).status, 'LOCAL_MODELS_STOPPED');
  assert.equal(r.recognizer.status().ownsProcess, false);
});

test('workbench possession cancels injected resident transcription and preserves zero dispatch', async t => {
  const r = await fixture(t), id = await r.begin(), child = r.children[0];
  const pending = r.w.submitRecognition(id, wave()); await flush();
  const request = child.requests.findLast(row => row.type === 'transcribe');
  await r.w.act({ type: 'step', actorId: 'alpha', event: 'possession' });
  const cancelled = await pending; await drain();
  assert.equal(cancelled.speechInput.current.status, 'CANCELLED');
  assert.equal(cancelled.speechInput.current.text, undefined);
  child.send({ v: 1, type: 'result', id: request.id, text: 'obsolete actor' }); await drain();
  const state = r.w.state(); assert.equal(state.speechInput.current.text, undefined);
  assert.equal(state.control.nativeCalls, 0); assert.equal(state.radio.gates.ptt, false);
  assert.equal(r.recognizer.status().ownsProcess, false); assert.equal(r.children.length, 1);
  await assert.rejects(r.w.act({ type: 'ptt_begin' }));
  assert.deepEqual(r.models, { starts: 0, generations: 0, syntheses: 0 });
});
