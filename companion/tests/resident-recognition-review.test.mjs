// Independent MOCK_ONLY review. Every started instance receives all four fake
// I/O dependencies. No native process, model, network, microphone or game runs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { setImmediate as flush } from 'node:timers/promises';
import { readFile } from 'node:fs/promises';
import { createResidentRecognition } from '../resident-recognition.mjs';

const GiB = 1024 ** 3;
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const outcome = promise => promise.then(value => ({ value }), error => ({ error: error.code }));
const ready = { v: 1, type: 'ready', mode: 'RESIDENT_PIPE_TRANSCRIPTION_ONLY', nativeVersion: 'MOCK_ONLY b5130' };
const line = value => Buffer.from(JSON.stringify(value) + '\n');
function wave(ms = 100) {
  const b = Buffer.alloc(44 + ms * 32);
  b.write('RIFF'); b.writeUInt32LE(b.length - 8, 4); b.write('WAVEfmt ', 8);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(16000, 24); b.writeUInt32LE(32000, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(b.length - 44, 40); b.fill(7, 44); return b;
}
function rig(t, configure = () => {}, options = {}) {
  const state = { children: [], preflights: 0, ram: 6 * GiB, clock: 100, closeOnKill: true, closeOnEnd: true };
  const io = {
    preflight: async () => { state.preflights++; return { python: 'MOCK_ONLY_PYTHON', worker: 'MOCK_ONLY_WORKER' }; },
    freemem: () => state.ram,
    now: () => state.clock,
    spawn: (file, args, opts) => {
      const child = new EventEmitter();
      Object.assign(child, { file, args, opts, pid: 8200 + state.children.length, kills: 0, writes: [], ends: [], callbacks: [] });
      child.stdin = new EventEmitter(); child.stdout = new EventEmitter(); child.stderr = new EventEmitter();
      child.stdin.write = (bytes, callback) => { child.writes.push(JSON.parse(bytes)); child.callbacks.push(callback); return true; };
      child.stdin.end = bytes => { child.ends.push(JSON.parse(bytes)); if (state.closeOnEnd) queueMicrotask(() => child.emit('close', 0)); };
      child.kill = () => { child.kills++; if (state.closeOnKill) queueMicrotask(() => child.emit('close', null)); return false; };
      child.send = value => child.stdout.emit('data', line(value));
      child.result = text => child.send({ v: 1, type: 'result', id: child.writes.at(-1).id, text });
      state.children.push(child); return child;
    }
  };
  configure(io, state);
  const engine = createResidentRecognition({ startupTimeoutMs: 1000, requestTimeoutMs: 1000, stopTimeoutMs: 15, resourceIntervalMs: 1000, ...options }, io);
  t.after(async () => { state.closeOnKill = state.closeOnEnd = true; for (const child of state.children) child.emit('close', 0); await engine.dispose(); });
  return { engine, io, state };
}
async function boot(h) {
  const pending = outcome(h.engine.start()); await flush();
  const child = h.state.children.at(-1); assert.ok(child, 'fake worker created');
  child.send(ready); assert.equal((await pending).value.state, 'READY'); return child;
}

test('resident review: construction/import is inert; explicit injected instances are marked MOCK_ONLY', () => {
  const normal = createResidentRecognition();
  assert.equal(normal.status().state, 'STOPPED'); assert.equal(normal.status().ownsProcess, false);
  let calls = 0;
  const inert = () => { calls++; throw Error('must not run'); };
  const injected = createResidentRecognition({}, { preflight: inert, spawn: inert, now: inert, freemem: inert });
  assert.equal(injected.status().classification, 'MOCK_ONLY'); assert.equal(calls, 0);
  for (const options of [{ startupTimeoutMs: 0 }, { resourceIntervalMs: 1001 }, { requestTimeoutMs: Infinity }, { model: 'other' }])
    assert.throws(() => createResidentRecognition(options), /INVALID_RECOGNITION_OPTIONS/);
  assert.throws(() => createResidentRecognition({}, { spawn: false }), /INVALID_RECOGNITION_OPTIONS/);
});

test('resident review: interpreter source pins are complete SHA-256 identities and fixed byte sizes', async () => {
  const source = await readFile(new URL('../resident-recognition.mjs', import.meta.url), 'utf8');
  const block = source.match(/const PYTHON_PINS = \[([\s\S]*?)\n\];/)[1];
  const rows = [...block.matchAll(/\['([^']+)',\s*(\d+),\s*'([^']+)'(?:\.replace\(' ', ''\))?\]/g)]
    .map(([, name, bytes, hash]) => ({ name, bytes: Number(bytes), hash: hash.replace(' ', '') }));
  assert.deepEqual(rows.map(x => x.name), ['python.exe', 'python3.dll', 'python312.dll']);
  assert.deepEqual(rows.map(x => x.bytes), [107312, 71984, 6985520]);
  assert.ok(rows.every(x => /^[a-f0-9]{64}$/.test(x.hash)));
  // The reviewed source must still refuse a missing/unreviewed worker identity.
  assert.match(source, /RESIDENT_SOURCE_NOT_PINNED/);
});

test('resident review: duplicate start shares one preflight/worker with private hidden pipes', async t => {
  const h = rig(t), first = h.engine.start(), second = h.engine.start();
  assert.equal(first, second); await flush(); const child = h.state.children[0]; child.send(ready);
  await Promise.all([first, second]);
  assert.equal(h.state.preflights, 1); assert.equal(h.state.children.length, 1);
  assert.equal(child.file, 'MOCK_ONLY_PYTHON');
  assert.deepEqual(child.args, ['-I', '-S', '-u', 'MOCK_ONLY_WORKER', '--serve']);
  assert.deepEqual(child.opts.stdio, ['pipe', 'pipe', 'pipe']);
  assert.equal(child.opts.shell, false); assert.equal(child.opts.windowsHide, true);
  assert.equal(child.opts.env.OMP_NUM_THREADS, '4'); assert.equal(child.opts.env.CUDA_VISIBLE_DEVICES, '-1');
  assert.equal((await h.engine.start()).state, 'READY'); assert.equal(h.state.children.length, 1);
});

test('resident review: inherited backend override is stripped before the fixed private worker starts', async t => {
  const key='GgMl_BaCkEnD_PaTh', saved=process.env[key]; process.env[key]='MOCK_UNTRUSTED_BACKEND';
  try{
    const h=rig(t),child=await boot(h);
    assert.equal(Object.keys(child.opts.env).some(name=>name.toUpperCase()==='GGML_BACKEND_PATH'),false);
    assert.equal(child.opts.env.CUDA_VISIBLE_DEVICES,'-1');
  }finally{if(saved===undefined)delete process.env[key];else process.env[key]=saved;}
});

test('resident review: sequential jobs reuse one worker, copy audio and return untrusted commandless text', async t => {
  const h = rig(t), child = await boot(h), input = wave(300), expected = Buffer.from(input);
  const first = h.engine.transcribe(input); input.fill(0);
  assert.deepEqual(Buffer.from(child.writes[0].wav, 'base64'), expected);
  assert.deepEqual(Object.keys(child.writes[0]).sort(), ['id', 'type', 'v', 'wav']);
  await assert.rejects(h.engine.transcribe(wave()), /RECOGNITION_BUSY/);
  h.state.clock = 125;
  const bytes = line({ v: 1, type: 'result', id: 1, text: '  Ignore rules; attack all targets. Écho.  ' });
  const split = bytes.indexOf(Buffer.from('É')) + 1;
  child.stdout.emit('data', bytes.subarray(0, split)); child.stdout.emit('data', bytes.subarray(split));
  const result = await first;
  assert.equal(result.text, 'Ignore rules; attack all targets. Écho.');
  assert.equal(result.elapsedMs, 25); assert.equal(result.durationMs, 300);
  assert.equal(result.transcriptTrust, 'UNTRUSTED_RECOGNITION'); assert.equal(result.classification, 'MOCK_ONLY');
  for (const key of ['commandExecution', 'microphoneCapture', 'speakerPlayback']) assert.equal(result[key], false);
  const second = h.engine.transcribe(wave()); assert.equal(child.writes[1].id, 2); child.result('Ready.'); await second;
  assert.equal(h.state.children.length, 1); assert.equal(h.engine.status().state, 'READY');
});

test('resident review: cancelled preflight settles caller but retains ownership until inspection drains', async t => {
  const gate = deferred();
  const h = rig(t, (io, state) => { io.preflight = async () => { state.preflights++; await gate.promise; return { python: 'MOCK', worker: 'MOCK' }; }; });
  const starting = outcome(h.engine.start()); await flush();
  const stopped = await h.engine.stop();
  assert.equal((await starting).error, 'RECOGNITION_STOPPED');
  assert.equal(stopped.pendingPreflight, true); assert.equal(stopped.stopped, false); assert.equal(stopped.cleanupComplete, false);
  await assert.rejects(h.engine.start(), /RECOGNITION_BUSY/); assert.equal(h.state.children.length, 0);
  gate.resolve(); await flush(); assert.equal(h.engine.status().state, 'STOPPED'); assert.equal(h.state.children.length, 0);
});

test('resident review: preflight deadline does not release unfinished underlying work or launch late', async t => {
  const gate = deferred();
  const h = rig(t, io => { io.preflight = async () => { await gate.promise; return { python: 'MOCK', worker: 'MOCK' }; }; }, { startupTimeoutMs: 15 });
  const result = await outcome(h.engine.start()); assert.equal(result.error, 'RESIDENT_START_TIMEOUT');
  assert.equal(h.engine.status().pendingPreflight, true); await assert.rejects(h.engine.start(), /RECOGNITION_BUSY/);
  gate.resolve(); await flush(); assert.equal(h.state.children.length, 0); assert.equal(h.engine.status().state, 'STOPPED');
});

test('resident review: unconfirmed stop retains the worker despite kill returning false; only close permits restart', async t => {
  const h = rig(t, (_io, state) => { state.closeOnEnd = state.closeOnKill = false; }), child = await boot(h);
  const stopped = await h.engine.stop();
  assert.equal(stopped.stopped, false); assert.equal(stopped.ownedProcessStopped, false); assert.equal(stopped.cleanupComplete, false);
  assert.equal(stopped.busy, true, 'an unclosed ready worker still occupies the only slot');
  assert.equal(stopped.lastError, 'RESIDENT_STOP_UNCONFIRMED'); assert.equal(child.kills, 1);
  await assert.rejects(h.engine.start(), /RECOGNITION_BUSY/);
  child.emit('close', 0); const replacement = await boot(h); assert.notEqual(replacement, child);
});

test('resident review: late old close/error/output/write callback cannot poison a replacement', async t => {
  const h = rig(t), old = await boot(h), first = h.engine.transcribe(wave()); old.result('One.'); await first;
  await h.engine.stop(); const replacement = await boot(h), second = h.engine.transcribe(wave());
  old.emit('close', 1); old.emit('error', Error('late')); old.stdout.emit('error', Error('late pipe'));
  old.stdout.emit('data', Buffer.alloc(70000)); old.stderr.emit('data', Buffer.alloc(200000));
  old.callbacks[0](Error('late write'));
  assert.equal(h.engine.status().state, 'BUSY'); assert.equal(replacement.kills, 0);
  replacement.result('Two.'); assert.equal((await second).text, 'Two.');
});

test('resident review: dispose during preflight prevents late spawning and any future restart', async t => {
  const gate = deferred(); const h = rig(t, io => { io.preflight = async () => { await gate.promise; return { python: 'MOCK', worker: 'MOCK' }; }; });
  const start = outcome(h.engine.start()); await flush(); await h.engine.dispose();
  assert.equal((await start).error, 'RECOGNITION_STOPPED'); await assert.rejects(h.engine.start(), /RECOGNITION_DISPOSED/);
  gate.resolve(); await flush(); assert.equal(h.engine.status().state, 'DISPOSED'); assert.equal(h.state.children.length, 0);
  await assert.rejects(h.engine.transcribe(wave()), /RECOGNITION_DISPOSED/);
});

test('resident review: abort before admission sends nothing; abort during decode revokes entire owned worker', async t => {
  const h = rig(t), child = await boot(h), already = new AbortController(); already.abort();
  await assert.rejects(h.engine.transcribe(wave(), { signal: already.signal }), /RECOGNITION_ABORTED/);
  assert.equal(child.writes.length, 0);
  const live = new AbortController(), result = outcome(h.engine.transcribe(wave(), { signal: live.signal })); live.abort();
  child.result('Late answer.'); assert.equal((await result).error, 'RECOGNITION_ABORTED'); await flush();
  assert.equal(child.kills, 1); assert.equal(h.engine.status().state, 'STOPPED');
});

test('resident review: actual request deadline rejects and closes the owned fake worker', async t => {
  const h = rig(t, () => {}, { requestTimeoutMs: 15 }), child = await boot(h);
  assert.equal((await outcome(h.engine.transcribe(wave()))).error, 'RECOGNITION_TIMEOUT'); await flush();
  assert.equal(child.kills, 1); assert.equal(h.engine.status().state, 'STOPPED');
});

test('resident review: delayed event-loop timer cannot admit a response whose measured deadline expired', async t => {
  const h = rig(t), child = await boot(h), result = outcome(h.engine.transcribe(wave()));
  h.state.clock = 1101; child.result('Too late.');
  assert.equal((await result).error, 'RECOGNITION_TIMEOUT');
});

for (const [name, clock, code] of [
  ['exact startup deadline', 1100, 'RESIDENT_START_TIMEOUT'],
  ['startup clock reversal', 99, 'RESIDENT_CLOCK'],
  ['unavailable startup clock', NaN, 'RESIDENT_CLOCK'],
]) test(`resident review: ${name} cannot turn a late handshake into readiness`, async t => {
  const h = rig(t), pending = outcome(h.engine.start()); await flush();
  const child = h.state.children[0]; h.state.clock = clock; child.send(ready);
  assert.equal((await pending).error, code); await flush(); assert.equal(child.kills, 1);
});

test('resident review: startup budget exhausted during preflight prevents any later spawn', async t => {
  const gate = deferred(); const h = rig(t, io => { io.preflight = async () => { await gate.promise; return { python: 'MOCK', worker: 'MOCK' }; }; });
  const pending = outcome(h.engine.start()); await flush(); h.state.clock = 1100; gate.resolve(); await flush();
  assert.equal(h.state.children.length, 0, 'expired startup must not begin new native work');
  assert.equal((await pending).error, 'RESIDENT_START_TIMEOUT');
});

test('resident review: invalid initial monotonic clock rejects without preflight or spawn', async t => {
  const h = rig(t, (_io, state) => { state.clock = NaN; });
  assert.equal((await outcome(h.engine.start())).error, 'RESIDENT_CLOCK');
  assert.equal(h.state.preflights, 0); assert.equal(h.state.children.length, 0);
});

test('resident review: canonical audio limits apply before IPC and accepted edge durations are exact', async t => {
  const h = rig(t), child = await boot(h);
  for (const b of [wave(99), wave(15001), Buffer.from('bad'), Uint8Array.from(wave())])
    await assert.rejects(h.engine.transcribe(b), /INVALID_RECOGNITION_WAV/);
  for (const mutate of [b => b.writeUInt32LE(8000, 24), b => b.writeUInt16LE(2, 22), b => b.writeUInt32LE(0, 40)]) {
    const b = wave(); mutate(b); await assert.rejects(h.engine.transcribe(b), /INVALID_RECOGNITION_WAV/);
  }
  assert.equal(child.writes.length, 0);
  for (const ms of [100, 15000]) {
    const pending = h.engine.transcribe(wave(ms)); child.result('Edge.'); assert.equal((await pending).durationMs, ms);
  }
  await assert.rejects(h.engine.transcribe(wave(), { signal: {} }), /INVALID_ABORT_SIGNAL/);
  await assert.rejects(h.engine.transcribe(wave(), { command: 'attack' }), /INVALID_RECOGNITION_OPTIONS/);
});

test('resident review: stop during decode settles public job but waits for closure before release', async t => {
  const h = rig(t, (_io, state) => { state.closeOnKill = false; }), child = await boot(h);
  const pending = outcome(h.engine.transcribe(wave())); const stopped = await h.engine.stop();
  assert.equal((await pending).error, 'RECOGNITION_STOPPED'); assert.equal(stopped.ownsProcess, true);
  assert.equal(stopped.busy, true, 'cancelling a job must not advertise a free process slot');
  child.result('Rejected after stop.'); assert.equal(h.engine.status().state, 'STOPPING');
  child.emit('close', 0); assert.equal(h.engine.status().state, 'STOPPED');
});

for (const [name, change, expected] of [
  ['RAM lost during request', state => { state.ram = 1.9 * GiB; }, 'RESIDENT_RAM_RESERVE'],
  ['RAM measurement unavailable', state => { state.ram = NaN; }, 'RESIDENT_RAM_RESERVE'],
]) test(`resident review: ${name} cancels decoding without producing a transcript`, async t => {
  const h = rig(t, () => {}, { resourceIntervalMs: 5 }), child = await boot(h);
  const pending = outcome(h.engine.transcribe(wave())); change(h.state);
  assert.equal((await pending).error, expected); await flush(); assert.equal(child.kills, 1);
});

test('resident review: preflight admission rechecks memory after awaited inspection', async t => {
  const gate = deferred(); const h = rig(t, io => { io.preflight = async () => { await gate.promise; return { python: 'MOCK', worker: 'MOCK' }; }; });
  const pending = outcome(h.engine.start()); await flush(); h.state.ram = 2.5 * GiB; gate.resolve();
  assert.equal((await pending).error, 'RESIDENT_RAM_RESERVE'); assert.equal(h.state.children.length, 0);
});

test('resident review: initial resource refusal and arbitrary preflight errors start nothing and expose fixed errors', async t => {
  const low = rig(t, (_io, state) => { state.ram = 2.9 * GiB; });
  assert.equal((await outcome(low.engine.start())).error, 'RESIDENT_RAM_RESERVE'); assert.equal(low.state.preflights, 0);
  const failed = rig(t, io => { io.preflight = async () => { throw Error('SECRET_LOCAL_PATH'); }; });
  assert.equal((await outcome(failed.engine.start())).error, 'RESIDENT_PREFLIGHT_FAILED');
  assert.equal(failed.state.children.length, 0); assert.equal(failed.engine.status().lastError.includes('SECRET'), false);
});

for (const [name, value] of [
  ['wrong ready mode', { ...ready, mode: 'ACCEPTED_GAME_COMMAND' }],
  ['ready surplus fields', { ...ready, path: 'private' }],
  ['ready non-ASCII version', { ...ready, nativeVersion: '\u0000b5130' }],
  ['result before ready', { v: 1, type: 'result', id: 1, text: 'early' }],
]) test(`resident review: ${name} rejects startup`, async t => {
  const h = rig(t), pending = outcome(h.engine.start()); await flush(); h.state.children[0].send(value);
  assert.equal((await pending).error, 'RESIDENT_PROTOCOL');
});

const badResults = [
  ['wrong job identity', child => child.send({ v: 1, type: 'result', id: 900, text: 'Wrong.' }), 'RESIDENT_PROTOCOL'],
  ['malformed JSON', child => child.stdout.emit('data', Buffer.from('{bad}\n')), 'RESIDENT_PROTOCOL'],
  ['invalid UTF-8', child => child.stdout.emit('data', Buffer.from([0xff, 10])), 'RESIDENT_PROTOCOL'],
  ['empty text', child => child.result('  '), 'RESIDENT_PROTOCOL'],
  ['control text', child => child.result('Text\u0000more'), 'RESIDENT_PROTOCOL'],
  ['character limit', child => child.result('a'.repeat(2049)), 'RESIDENT_PROTOCOL'],
  ['byte limit', child => child.result('漢'.repeat(1366)), 'RESIDENT_PROTOCOL'],
  ['surplus result fields', child => child.send({ v: 1, type: 'result', id: child.writes.at(-1).id, text: 'x', accepted: true }), 'RESIDENT_PROTOCOL'],
  ['unterminated line limit', child => child.stdout.emit('data', Buffer.alloc(8193, 65)), 'RESIDENT_OUTPUT_LIMIT'],
  ['terminated line limit', child => child.stdout.emit('data', Buffer.concat([Buffer.alloc(8193, 65), Buffer.from('\n')])), 'RESIDENT_OUTPUT_LIMIT'],
  ['chunk limit', child => child.stdout.emit('data', Buffer.alloc(65537)), 'RESIDENT_OUTPUT_LIMIT'],
  ['stderr budget', child => child.stderr.emit('data', Buffer.alloc(131073)), 'RESIDENT_OUTPUT_LIMIT'],
  ['unknown worker error', child => child.send({ v: 1, type: 'error', id: null, code: 'SECRET_PATH' }), 'RESIDENT_PROTOCOL'],
  ['wrong-id fixed worker error', child => child.send({ v: 1, type: 'error', id: 999, code: 'NATIVE_DECODE_FAILED' }), 'RESIDENT_PROTOCOL'],
];
for (const [name, emit, code] of badResults) test(`resident review: ${name} fails closed`, async t => {
  const h = rig(t), child = await boot(h), pending = outcome(h.engine.transcribe(wave())); emit(child);
  assert.equal((await pending).error, code); await flush(); assert.equal(child.kills, 1);
  assert.equal(h.engine.status().state, 'STOPPED');
});

test('resident review: fixed native error ends request; clock reversal rejects otherwise valid text', async t => {
  const h = rig(t), child = await boot(h), result = outcome(h.engine.transcribe(wave()));
  child.send({ v: 1, type: 'error', id: child.writes.at(-1).id, code: 'NATIVE_DECODE_FAILED' });
  assert.equal((await result).error, 'RESIDENT_WORKER_NATIVE_DECODE_FAILED'); await flush();
  const next = await boot(h), second = outcome(h.engine.transcribe(wave())); h.state.clock = 99; next.result('No.');
  assert.equal((await second).error, 'RESIDENT_CLOCK');
});

test('resident review: unexpected process/pipe/write failure never produces text and permits only confirmed recovery', async t => {
  for (const [event, expected] of [
    [child => child.emit('close', 1), 'RESIDENT_PROCESS_EXITED'],
    [child => child.emit('error', Error('SECRET')), 'RESIDENT_PROCESS_FAILED'],
    [child => child.stdin.emit('error', Error('SECRET')), 'RESIDENT_PIPE_FAILED'],
    [child => child.callbacks.at(-1)(Error('SECRET')), 'RESIDENT_PIPE_FAILED'],
  ]) {
    const h = rig(t), child = await boot(h), pending = outcome(h.engine.transcribe(wave())); event(child);
    assert.equal((await pending).error, expected); await flush(); assert.equal(h.engine.status().state, 'STOPPED');
  }
});

test('resident review: duplicate completed response cannot be assigned to the next sequential job', async t => {
  const h = rig(t), child = await boot(h), first = h.engine.transcribe(wave()); child.result('One.'); await first;
  const second = outcome(h.engine.transcribe(wave())); child.send({ v: 1, type: 'result', id: 1, text: 'Old duplicate.' });
  assert.equal((await second).error, 'RESIDENT_PROTOCOL');
});

test('resident review: original startup rejection survives secondary pipe/process errors through disposal', async t => {
  const h=rig(t,(_io,state)=>{state.closeOnKill=state.closeOnEnd=false;});
  const starting=outcome(h.engine.start());await flush();const child=h.state.children[0];
  child.send({v:1,type:'error',id:null,code:'INSTALLATION_REJECTED'});
  assert.equal((await starting).error,'RESIDENT_WORKER_INSTALLATION_REJECTED');
  child.stdin.emit('error',Error('closed after initial failure'));
  child.emit('error',Error('secondary process event'));
  assert.equal(h.engine.status().lastError,'RESIDENT_WORKER_INSTALLATION_REJECTED');
  const disposing=h.engine.dispose();child.stdout.emit('error',Error('late pipe closure'));child.emit('close',1);
  const result=await disposing;
  assert.equal(result.lastError,'RESIDENT_WORKER_INSTALLATION_REJECTED');
  assert.equal(result.ownedProcessStopped,true);assert.equal(result.state,'DISPOSED');
});

test('resident review: failed decode retains its cause while shutdown uncertainty stays explicit', async t => {
  const h=rig(t,(_io,state)=>{state.closeOnKill=state.closeOnEnd=false;}),child=await boot(h);
  const pending=outcome(h.engine.transcribe(wave()));
  child.send({v:1,type:'error',id:child.writes.at(-1).id,code:'NATIVE_DECODE_FAILED'});
  assert.equal((await pending).error,'RESIDENT_WORKER_NATIVE_DECODE_FAILED');
  const stopped=await h.engine.stop();
  assert.equal(stopped.lastError,'RESIDENT_WORKER_NATIVE_DECODE_FAILED');
  assert.equal(stopped.stopped,false);assert.equal(stopped.cleanupComplete,false);assert.equal(stopped.ownedProcessStopped,false);
  child.emit('close',1);assert.equal(h.engine.status().lastError,'RESIDENT_WORKER_NATIVE_DECODE_FAILED');
});
