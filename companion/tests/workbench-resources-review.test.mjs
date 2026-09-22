// Independent resource-policy review. Synthetic memory/disk, engines and
// promises only: no real models, microphone, native/game calls or speakers.
import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate as flush } from 'node:timers/promises';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createWorkbench } from '../server.mjs';
import { createWorkbenchResources, WORKBENCH_RESOURCE_POLICY } from '../workbench-resources.mjs';

const GiB = 1024 ** 3;
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
async function settle() { await flush(); await flush(); await flush(); }

async function fixture(t, { admissions = [], languageStart = null, speechStart = null, languageStop = null,
  languageStopRejects = false, languageStopUnconfirmed = false } = {}) {
  const folder = await mkdtemp(path.join(os.tmpdir(), 'mw5-resource-review-'));
  const events = [], generations = [], syntheses = [], policyCalls = [];
  let watch = null, policyMonitoring = false;
  const policy = {
    async admit(options = {}) { const index = policyCalls.length; policyCalls.push(options); events.push(`admit-${index}`); if (admissions[index]) await admissions[index].promise; },
    startWatch(callback) { if (policyMonitoring) return; events.push('watch-start'); watch = callback; policyMonitoring = true; },
    stopWatch() { events.push('watch-stop'); policyMonitoring = false; },
    status() { return { monitoring: policyMonitoring, sampling: false, admissionPending: false, cleanupPending: false, lastError: null }; }
  };
  const language = {
    state: 'STOPPED', starts: 0, stops: 0, owns: false,
    status() { return { state: this.state, ownedProcessStopped: !this.owns, ownedPid: this.owns ? 12345 : null, classification: 'MOCK_ONLY' }; },
    async start() { this.starts++; events.push('language-start'); this.state = 'STARTING'; if (languageStart) await languageStart.promise; this.owns = true; this.state = 'READY'; return this.status(); },
    async stop() {
      this.stops++; events.push('language-stop'); this.state = 'STOPPING';
      if (languageStop) await languageStop.promise;
      if (languageStopRejects) { this.state = 'FAILED'; throw new Error('MOCK_STOP_UNCONFIRMED'); }
      if (languageStopUnconfirmed) { this.state = 'STOPPED'; return this.status(); }
      this.owns = false; this.state = 'STOPPED'; return this.status();
    },
    generate(context, { signal }) { const work = deferred(); generations.push({ ...work, context, signal }); return work.promise; }
  };
  const speech = {
    state: 'NEW', starts: 0, stops: 0, owns: false,
    getState() { return { state: this.state, restartRequired: this.state === 'STOPPED', ownedProcess: this.owns, ownedPid: this.owns ? 12346 : null, busy: false, classification: 'MOCK_ONLY' }; },
    async start() { this.starts++; events.push('speech-start'); this.state = 'STARTING'; if (speechStart) await speechStart.promise; this.owns = true; this.state = 'READY'; return this.getState(); },
    async restart() { return this.start(); },
    async stop() { this.stops++; events.push('speech-stop'); this.state = 'STOPPED'; this.owns = false; return this.getState(); },
    synthesize(input, { signal }) { const work = deferred(); syntheses.push({ ...work, input, signal }); return work.promise; }
  };
  const recognition = {
    state: 'STOPPED', starts: 0, stops: 0,
    status() { return { state: this.state, busy: false, ownsProcess: false, processStopConfirmed: true, classification: 'MOCK_ONLY' }; },
    async start() { this.starts++; this.state = 'READY'; return this.status(); },
    async stop() { this.stops++; this.state = 'STOPPED'; return this.status(); },
    async dispose() { this.state = 'DISPOSED'; return this.status(); },
    async transcribe() { throw new Error('UNEXPECTED_TRANSCRIPTION'); }
  };
  const workbench = await createWorkbench({ settingsPath: path.join(folder, 'settings.json'), languageModel: language,
    speechEngine: speech, recognitionEngine: recognition, resourcePolicy: policy, residentStopTimeoutMs: 25, realNow: () => 10000 });
  t.after(async () => {
    for (const item of admissions) item?.resolve(); languageStart?.resolve(); speechStart?.resolve(); languageStop?.resolve();
    for (const item of generations) item.resolve('Discarded synthetic reply.');
    for (const item of syntheses) item.resolve({ wavPath: 'unused-synthetic-wave' });
    await settle(); await workbench.dispose();
    const resolved = path.resolve(folder); assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith('mw5-resource-review-')); await rm(resolved, { recursive: true, force: true });
  });
  const start = async () => { await workbench.act({ type: 'models_start' }); await settle(); };
  const breach = async (code = 'RESOURCE_RAM_RESERVE_LOST') => { assert.equal(typeof watch, 'function'); await watch(code); await settle(); };
  return { w: workbench, policy, policyCalls, language, speech, recognition, generations, syntheses, events, start, breach };
}

test('review: constructing or reading a workbench never admits resources, starts monitoring or starts engines', async t => {
  const r = await fixture(t); r.w.state(); r.w.state();
  assert.equal(r.policyCalls.length, 0); assert.equal(r.events.length, 0);
  assert.equal(r.language.starts, 0); assert.equal(r.speech.starts, 0); assert.equal(r.recognition.starts, 0);
});

test('review: each resident engine gets a fresh admission immediately before its start', async t => {
  const second = deferred(), r = await fixture(t, { admissions: [null, second] }); await r.start();
  assert.equal(r.policyCalls.length, 2); assert.equal(r.language.starts, 1); assert.equal(r.speech.starts, 0);
  assert.ok(r.events.indexOf('admit-0') < r.events.indexOf('language-start'));
  assert.ok(r.events.indexOf('language-start') < r.events.indexOf('admit-1'));
  second.resolve(); await settle(); assert.equal(r.speech.starts, 1);
});

test('review: stopping during unresolved admission cannot start either engine when the read completes late', async t => {
  const admission = deferred(), r = await fixture(t, { admissions: [admission] }); await r.start();
  const stopping = r.w.act({ type: 'models_stop' }); await settle();
  assert.equal(r.policyCalls[0].signal.aborted, true);
  assert.equal(r.language.starts, 0); assert.equal(r.speech.starts, 0);
  await assert.rejects(r.w.act({ type: 'models_start' }), /LOCAL_MODEL_CLEANUP_PENDING/);
  admission.resolve(); await stopping; await settle();
  assert.equal(r.language.starts, 0); assert.equal(r.speech.starts, 0);
});

test('review: cancelling a pending language startup reaps its late worker and never starts speech', async t => {
  const languageStart = deferred(), r = await fixture(t, { languageStart }); await r.start();
  assert.equal(r.language.starts, 1); const stopping = r.w.act({ type: 'models_stop' }); await settle();
  languageStart.resolve(); await stopping; await settle();
  assert.equal(r.speech.starts, 0); assert.equal(r.language.owns, false);
  assert.equal(r.language.state, 'STOPPED');
});

test('review: watchdog breach cancels generation, stops resident engines and never changes human hold', async t => {
  const r = await fixture(t); await r.w.act({ type: 'demo' }); await r.start();
  await r.w.act({ type: 'step', event: 'hold', actorId: 'alpha' }); const controlBefore = r.w.state().control;
  await r.w.act({ type: 'converse', actorId: 'bravo', text: 'Synthetic radio check.' }); await settle();
  assert.equal(r.generations.length, 1); await r.breach();
  assert.equal(r.generations[0].signal.aborted, true); assert.equal(r.language.owns, false); assert.equal(r.speech.owns, false);
  assert.equal(r.w.state().localModels.reply, null); assert.equal(r.w.state().localModels.audio, null);
  assert.deepEqual(r.w.state().control, controlBefore);
  const starts = [r.language.starts, r.speech.starts]; r.generations[0].resolve('Late text must be discarded.'); await settle();
  r.w.state(); assert.deepEqual([r.language.starts, r.speech.starts], starts); assert.equal(r.w.state().localModels.reply, null);
});

test('review: watchdog breach cancels synthesis and cannot publish a late wave path', async t => {
  const r = await fixture(t); await r.w.act({ type: 'demo' }); await r.start();
  await r.w.act({ type: 'converse', actorId: 'alpha', text: 'Synthetic check.' }); await settle();
  r.generations[0].resolve('Synthetic reply.'); await settle();
  await r.w.act({ type: 'synthesize_reply' }); await settle(); assert.equal(r.syntheses.length, 1);
  await r.breach(); assert.equal(r.syntheses[0].signal.aborted, true);
  r.syntheses[0].resolve({ wavPath: 'untrusted-late-wave' }); await settle();
  assert.equal(r.w.state().localModels.audio, null); assert.equal(r.w.state().radio.playing, null);
});

test('review: watchdog breach revokes PTT and stops recognition without dispatching commands', async t => {
  const r = await fixture(t); await r.w.act({ type: 'demo' }); await r.start();
  await r.w.act({ type: 'recognition_prepare' }); await settle(); await r.w.act({ type: 'ptt_begin' });
  assert.equal(r.w.state().radio.gates.ptt, true); const before = r.w.state().control;
  await r.breach(); assert.equal(r.w.state().radio.gates.ptt, false);
  assert.equal(r.w.state().speechInput.current.status, 'CANCELLED'); assert.ok(r.recognition.stops > 0);
  assert.deepEqual(r.w.state().control, before); assert.equal(r.w.state().control.nativeCalls, 0);
});

test('review: a resolved stop that still reports a live owned process is not successful cleanup', async t => {
  const r = await fixture(t, { languageStopUnconfirmed: true }); await r.start(); await r.w.act({ type: 'models_stop' }); await settle();
  assert.equal(r.language.owns, true); assert.match(r.w.state().localModels.error ?? '', /UNCONFIRMED/);
  const count = r.language.starts;
  try { await r.w.act({ type: 'models_start' }); } catch {}
  await settle(); assert.equal(r.language.starts, count);
});

test('review: repeating Start after both engines are ready preserves a functioning watchdog', async t => {
  const r = await fixture(t); await r.start(); await r.start();
  assert.equal(r.w.state().localModels.language.state, 'READY'); assert.equal(r.w.state().localModels.speech.state, 'READY');
  await r.breach(); assert.equal(r.language.owns, false); assert.equal(r.speech.owns, false);
  assert.equal(r.w.state().localModels.resources.monitoring, false);
});

test('review: duplicate Start during healthy unresolved admission reuses one startup and preserves its watchdog', async t => {
  const admission = deferred(), r = await fixture(t, { admissions: [admission] }); await r.start();
  assert.equal(r.policyCalls.length, 1); assert.equal(r.language.starts, 0); assert.equal(r.speech.starts, 0);
  const duplicate = await r.w.act({ type: 'models_start' }); await settle();
  assert.equal(duplicate.last.status, 'STARTING_LOCAL_MODELS');
  assert.equal(duplicate.localModels.starting, true); assert.equal(r.policyCalls.length, 1);
  assert.equal(r.language.starts, 0); assert.equal(r.speech.starts, 0);
  admission.resolve(); await settle();
  assert.equal(r.policyCalls.length, 2); assert.equal(r.language.starts, 1); assert.equal(r.speech.starts, 1);
  await r.breach(); assert.equal(r.language.owns, false); assert.equal(r.speech.owns, false);
  assert.equal(r.w.state().localModels.resources.monitoring, false);
});

test('review: denied admission prevents every resident engine and clears startup without automatic retry', async t => {
  const admission = deferred(), r = await fixture(t, { admissions: [admission] }); await r.start();
  admission.reject(Object.assign(new Error('RESOURCE_ADMISSION_RAM'), { code: 'RESOURCE_ADMISSION_RAM' })); await settle();
  assert.equal(r.language.starts, 0); assert.equal(r.speech.starts, 0); assert.equal(r.w.state().localModels.starting, false);
  assert.equal(r.w.state().localModels.error, 'RESOURCE_ADMISSION_RAM');
  r.w.state(); await settle(); assert.equal(r.policyCalls.length, 1);
});

test('review: an unresolved stop keeps cleanup ownership after its public timeout and permits only an explicit later restart', async t => {
  const languageStop = deferred(), r = await fixture(t, { languageStop }); await r.start();
  const stopped = await r.w.act({ type: 'models_stop' });
  assert.equal(stopped.last.status, 'LOCAL_MODEL_STOP_UNCONFIRMED');
  assert.equal(stopped.localModels.stopping, true); assert.equal(stopped.localModels.cleanupPending, true);
  await assert.rejects(r.w.act({ type: 'models_start' }), /LOCAL_MODEL_CLEANUP_PENDING/);
  const starts = r.language.starts; languageStop.resolve(); await settle();
  assert.equal(r.w.state().localModels.cleanupPending, false); assert.equal(r.language.starts, starts);
  await r.start(); assert.equal(r.language.starts, starts + 1); assert.equal(r.language.state, 'READY');
});

test('review: language readiness alone cannot bypass the unfinished second resource admission', async t => {
  const second = deferred(), r = await fixture(t, { admissions: [null, second] }); await r.w.act({ type: 'demo' }); await r.start();
  assert.equal(r.language.state, 'READY'); assert.equal(r.w.state().localModels.starting, true);
  await assert.rejects(r.w.act({ type: 'converse', actorId: 'alpha', text: 'Must wait for startup.' }), /LOCAL_MODEL/);
  assert.equal(r.generations.length, 0); second.resolve(); await settle();
});

function resourceFixture({ ram = 5 * GiB, disk = { bavail: 10 * GiB, bsize: 1 }, memoryWait = null, diskWait = null } = {}) {
  const timers = new Map(), reads = [], breaches = []; let sequence = 0, memory = ram;
  const policy = createWorkbenchResources({
    freemem() { reads.push('ram'); return memoryWait ? memoryWait.promise : memory; },
    statfs() { reads.push('disk'); return diskWait ? diskWait.promise : disk; }, now: () => 1000,
    setTimeout(fn, ms) { const timer = { id: ++sequence, unref() {} }; timers.set(timer, { fn, ms }); return timer; },
    clearTimeout(timer) { timers.delete(timer); }
  });
  const runTimer = async ms => {
    const entry = [...timers].find(([, timer]) => timer.ms === ms); assert.ok(entry, `Expected ${ms} ms timer`);
    timers.delete(entry[0]); entry[1].fn(); await settle();
  };
  return { policy, timers, reads, breaches, runTimer, setRam: value => { memory = value; },
    watch: active => policy.startWatch(code => breaches.push(code), active) };
}

test('review: policy is cold on creation/status and has fixed conservative thresholds', () => {
  const r = resourceFixture(); const state = r.policy.status();
  assert.equal(r.reads.length, 0); assert.equal(r.timers.size, 0); assert.equal(state.monitoring, false);
  assert.equal(WORKBENCH_RESOURCE_POLICY.admissionRamBytes, 5 * GiB);
  assert.equal(WORKBENCH_RESOURCE_POLICY.workingDiskBytes, 10 * GiB);
  assert.equal(WORKBENCH_RESOURCE_POLICY.runningRamBytes, 2 * GiB);
  assert.equal(state.continuousReserveGuaranteed, false);
});

test('review: exact startup thresholds pass, with fresh RAM sampled after disk, and leave no admission timer', async () => {
  const r = resourceFixture(); await r.policy.admit(); await settle();
  assert.deepEqual(r.reads, ['disk', 'ram']); assert.equal(r.timers.size, 0);
  assert.equal(r.policy.status().admissionPending, false); assert.equal(r.policy.status().cleanupPending, false);
});

for (const bad of [NaN, Infinity, -1, undefined, '6000000000', Number.MAX_SAFE_INTEGER + 1]) {
  test(`review: unknown or invalid RAM reading ${String(bad)} fails closed`, async () => {
    const r = resourceFixture(); r.setRam(bad); await assert.rejects(r.policy.admit(), /RESOURCE_READING_UNAVAILABLE/);
    await settle(); assert.equal(r.timers.size, 0); assert.equal(r.policy.status().lastSample, null);
  });
}

test('review: readings just below either startup floor reject admission', async () => {
  await assert.rejects(resourceFixture({ ram: 5 * GiB - 1 }).policy.admit(), /RESOURCE_ADMISSION_RAM/);
  await assert.rejects(resourceFixture({ disk: { bavail: 10 * GiB - 1, bsize: 1 } }).policy.admit(), /RESOURCE_ADMISSION_DISK/);
});

test('review: invalid disk fields or multiplication overflow cannot become available disk', async () => {
  for (const disk of [null, {}, { bavail: -1, bsize: 4096 }, { bavail: Infinity, bsize: 1 },
    { bavail: Number.MAX_SAFE_INTEGER, bsize: 4096 }, { bavail: '90000000000', bsize: 1 }]) {
    await assert.rejects(resourceFixture({ disk }).policy.admit(), /RESOURCE_READING_UNAVAILABLE/);
  }
});

test('review: cancelled admission settles promptly but retains pending I/O ownership until its late read drains', async () => {
  const diskWait = deferred(), r = resourceFixture({ diskWait }), controller = new AbortController();
  const promise = r.policy.admit({ signal: controller.signal }); await settle();
  const rejection = assert.rejects(promise, /RESOURCE_ADMISSION_CANCELLED/); controller.abort(); await rejection;
  assert.equal(r.policy.status().cleanupPending, true); await assert.rejects(r.policy.admit(), /RESOURCE_CLEANUP_PENDING/);
  diskWait.resolve({ bavail: 10 * GiB, bsize: 1 }); await settle();
  assert.equal(r.policy.status().cleanupPending, false); assert.equal(r.policy.status().lastSample, null); assert.equal(r.timers.size, 0);
});

test('review: admission deadline settles publicly without freeing an unresolved resource read or publishing late success', async () => {
  const diskWait = deferred(), r = resourceFixture({ diskWait });
  const pending = r.policy.admit(), rejection = assert.rejects(pending, /RESOURCE_SAMPLE_TIMEOUT/);
  await settle(); await r.runTimer(WORKBENCH_RESOURCE_POLICY.sampleTimeoutMs); await rejection;
  assert.equal(r.policy.status().cleanupPending, true); assert.equal(r.policy.status().lastSample, null);
  await assert.rejects(r.policy.admit(), /RESOURCE_CLEANUP_PENDING/);
  diskWait.resolve({ bavail: 10 * GiB, bsize: 1 }); await settle();
  assert.equal(r.policy.status().cleanupPending, false); assert.equal(r.policy.status().lastSample, null); assert.equal(r.timers.size, 0);
});

test('review: admission waits for an active watch read instead of starting overlapping I/O', async () => {
  const memoryWait = deferred(), r = resourceFixture({ memoryWait }); r.watch();
  await r.runTimer(WORKBENCH_RESOURCE_POLICY.watchIntervalMs);
  const pending = r.policy.admit(); await settle();
  assert.deepEqual(r.reads, ['ram']); assert.ok(r.timers.size <= 2);
  memoryWait.resolve(5 * GiB); await pending; await settle();
  assert.deepEqual(r.reads, ['ram', 'disk', 'ram']); assert.equal(r.timers.size, 1);
  r.policy.stopWatch(); assert.equal(r.timers.size, 0);
});

test('review: healthy watch sampling is observable without claiming cleanup is pending', async () => {
  const memoryWait = deferred(), r = resourceFixture({ memoryWait }); r.watch();
  await r.runTimer(WORKBENCH_RESOURCE_POLICY.watchIntervalMs);
  try {
    assert.equal(r.policy.status().sampling, true); assert.equal(r.policy.status().monitoring, true);
    assert.equal(r.policy.status().cleanupPending, false);
  } finally { r.policy.stopWatch(); memoryWait.resolve(5 * GiB); await settle(); }
});

test('review: watch floor is inclusive and a later breach stops polling with exactly one notification', async () => {
  const r = resourceFixture({ ram: 2 * GiB }); r.watch(); await r.runTimer(WORKBENCH_RESOURCE_POLICY.watchIntervalMs);
  assert.equal(r.breaches.length, 0); assert.equal(r.timers.size, 1); r.setRam(2 * GiB - 1);
  await r.runTimer(WORKBENCH_RESOURCE_POLICY.watchIntervalMs); assert.deepEqual(r.breaches, ['RESOURCE_RAM_RESERVE_LOST']);
  assert.equal(r.timers.size, 0); assert.equal(r.policy.status().monitoring, false);
});

test('review: hung watch read is bounded by one deadline, never overlaps, and cannot silently restart after timeout', async () => {
  const memoryWait = deferred(), r = resourceFixture({ memoryWait }); r.watch();
  await r.runTimer(WORKBENCH_RESOURCE_POLICY.watchIntervalMs);
  assert.deepEqual(r.reads, ['ram']); assert.equal(r.timers.size, 1);
  await r.runTimer(WORKBENCH_RESOURCE_POLICY.sampleTimeoutMs);
  assert.deepEqual(r.breaches, ['RESOURCE_SAMPLE_TIMEOUT']); assert.equal(r.policy.status().cleanupPending, true);
  assert.equal(r.timers.size, 0); assert.throws(() => r.watch(), /RESOURCE_CLEANUP_PENDING/);
  memoryWait.resolve(5 * GiB); await settle();
  assert.equal(r.policy.status().cleanupPending, false); assert.equal(r.policy.status().monitoring, false);
  assert.equal(r.timers.size, 0); assert.deepEqual(r.breaches, ['RESOURCE_SAMPLE_TIMEOUT']);
});

test('review: stop during watch read retains draining ownership and ignores a late low-memory result', async () => {
  const memoryWait = deferred(), r = resourceFixture({ memoryWait }); r.watch();
  await r.runTimer(WORKBENCH_RESOURCE_POLICY.watchIntervalMs); r.policy.stopWatch();
  assert.equal(r.policy.status().monitoring, false); assert.equal(r.policy.status().cleanupPending, true);
  memoryWait.resolve(0); await settle(); assert.equal(r.breaches.length, 0); assert.equal(r.timers.size, 0);
});

test('review: watchdog unknown readings stop monitoring, and no-active-worker watch stops without reading memory', async () => {
  const unknown = resourceFixture({ ram: NaN }); unknown.watch(); await unknown.runTimer(WORKBENCH_RESOURCE_POLICY.watchIntervalMs);
  assert.deepEqual(unknown.breaches, ['RESOURCE_READING_UNAVAILABLE']); assert.equal(unknown.timers.size, 0);
  const idle = resourceFixture(); idle.watch(() => false); await idle.runTimer(WORKBENCH_RESOURCE_POLICY.watchIntervalMs);
  assert.equal(idle.reads.length, 0); assert.equal(idle.timers.size, 0); assert.equal(idle.policy.status().monitoring, false);
});
