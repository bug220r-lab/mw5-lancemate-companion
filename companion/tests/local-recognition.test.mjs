// MOCK_ONLY. In-memory artifacts/processes; no installed binary, microphone or game.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { setImmediate as flush } from 'node:timers/promises';
import { createLocalRecognition } from '../local-recognition.mjs';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const runtime = path.join(project, 'companion/local/runtimes/whisper-cpu-b5130/Release');
const scratch = path.join(project, 'companion/local/recognition-tmp');
const lockBytes = await readFile(path.join(project, 'companion/models.lock.json'));
const inventoryBytes = await readFile(path.join(project, 'companion/whisper-runtime-pins.json'));
const lock = JSON.parse(lockBytes), pins = JSON.parse(inventoryBytes);
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const error = code => Object.assign(new Error(code), { code });
function wav(ms = 500) {
  const data = Buffer.alloc(44 + ms * 32); data.write('RIFF', 0); data.writeUInt32LE(data.length - 8, 4);
  data.write('WAVEfmt ', 8); data.writeUInt32LE(16, 16); data.writeUInt16LE(1, 20); data.writeUInt16LE(1, 22);
  data.writeUInt32LE(16000, 24); data.writeUInt32LE(32000, 28); data.writeUInt16LE(2, 32); data.writeUInt16LE(16, 34);
  data.write('data', 36); data.writeUInt32LE(data.length - 44, 40); data.fill(7, 44); return data;
}
function rig(t, configure = () => {}, options = {}) {
  const files = new Map(), sizes = new Map(), hashes = new Map(), dirs = new Set(), links = new Set();
  const calls = [], reads = [], deletes = [], hashed = [], writes = [], handles = [];
  function addDir(dir) { for (let p = dir; ; p = path.dirname(p)) { dirs.add(p); if (path.dirname(p) === p) break; } }
  const add = (file, bytes) => { files.set(file, Buffer.from(bytes)); sizes.set(file, bytes.length); addDir(path.dirname(file)); };
  add(path.join(project, 'companion/models.lock.json'), lockBytes);
  add(path.join(project, 'companion/whisper-runtime-pins.json'), inventoryBytes);
  for (const artifact of lock.artifacts.filter(p => ['whisper-base-en', 'whisper-cpu'].includes(p.id))) {
    const file = path.join(project, 'companion/local/models', artifact.name); sizes.set(file, artifact.bytes); hashes.set(file, artifact.sha256); addDir(path.dirname(file));
  }
  for (const pin of pins.files) {
    const file = path.join(runtime, pin.name); sizes.set(file, pin.bytes); hashes.set(file, pin.sha256); addDir(path.dirname(file));
  }
  const stat = file => {
    if (!dirs.has(file) && !sizes.has(file)) throw error('ENOENT');
    return { size: sizes.get(file) ?? 0, isFile: () => sizes.has(file), isDirectory: () => dirs.has(file), isSymbolicLink: () => links.has(file) };
  };
  let sequence = 0;
  const api = { files, sizes, hashes, dirs, links, calls, reads, deletes, hashed, writes, handles, add,
    closeOnKill: true, killAccepted: true,
    complete(text = 'Hold position.', code = 0) {
      const latest = calls.at(-1); assert.ok(latest); const prefix = latest.args[latest.args.indexOf('--output-file') + 1];
      if (text !== null) add(prefix + '.txt', Buffer.isBuffer(text) ? text : Buffer.from(text));
      latest.child.emit('close', code, null);
    } };
  const io = {
    lstat: async file => stat(file), realpath: async file => file,
    statfs: async () => ({ bavail: 20 * 1024 ** 3, bsize: 1 }), freemem: () => 6 * 1024 ** 3, now: () => 1000,
    hashFile: async (file, bytes, guard) => { guard(); hashed.push(file); assert.equal(bytes, sizes.get(file)); return hashes.get(file); },
    readdir: async dir => [...new Set([...sizes.keys(), ...dirs])].filter(file => file !== dir && path.dirname(file) === dir)
      .map(file => ({ name: path.basename(file), ...stat(file) })),
    mkdir: async dir => { if (dirs.has(dir)) throw error('EEXIST'); assert.ok(dirs.has(path.dirname(dir))); dirs.add(dir); },
    mkdtemp: async prefix => { const dir = prefix + (++sequence); dirs.add(dir); return dir; },
    writeFile: async (file, bytes, opts) => { assert.equal(opts.flag, 'wx'); assert.ok(!sizes.has(file)); writes.push({ file, bytes: Buffer.from(bytes) }); add(file, bytes); },
    open: async file => {
      reads.push(file); if (!files.has(file)) throw error('ENOENT');
      const record = { file, closed: false }; handles.push(record);
      return { stat: async () => stat(file),
        read: async (buffer, offset, length, position) => {
          const source = files.get(file); const part = source.subarray(position, position + length); part.copy(buffer, offset); return { bytesRead: part.length };
        }, close: async () => { record.closed = true; } };
    },
    unlink: async file => { deletes.push(file); files.delete(file); sizes.delete(file); },
    rmdir: async dir => { deletes.push(dir); assert.equal([...sizes.keys()].some(file => path.dirname(file) === dir), false); dirs.delete(dir); },
    spawn: (file, args, opts) => {
      const child = new EventEmitter(); child.stdout = new PassThrough(); child.stderr = new PassThrough(); child.kills = [];
      child.kill = signal => { child.kills.push(signal); if (api.closeOnKill) queueMicrotask(() => child.emit('close', null, 'SIGTERM')); return api.killAccepted; };
      calls.push({ file, args, opts, child }); return child;
    }
  };
  configure(io, api);
  const recognizer = createLocalRecognition({ requestTimeoutMs: 5000, stopTimeoutMs: 20, ...options }, io);
  t.after(async () => { api.closeOnKill = true; for (const c of calls) c.child.emit('close', null, 'SIGTERM'); await recognizer.dispose(); });
  return { ...api, api, io, recognizer };
}
async function spawned(r) { for (let n = 0; n < 10 && !r.calls.length; n++) await flush(); assert.equal(r.calls.length, 1); }
async function idle(r) { for (let n = 0; n < 10 && r.recognizer.status().busy; n++) await flush(); assert.equal(r.recognizer.status().busy, false); }

test('constructor is inert; start is verified preflight only and remains process-free', async t => {
  const r = rig(t); assert.equal(r.reads.length, 0); assert.equal(r.calls.length, 0);
  assert.equal(r.recognizer.status().state, 'STOPPED');
  const [first, second] = await Promise.all([r.recognizer.start(), r.recognizer.start()]);
  assert.equal(first.state, 'READY'); assert.equal(second.state, 'READY'); assert.equal(first.verification, 'MOCK_VERIFIED');
  assert.equal(r.hashed.length, 42); assert.equal(r.calls.length, 0); assert.equal(r.writes.length, 0);
  assert.equal(first.mode, 'COLD_FILE_TRANSCRIPTION_ONLY'); assert.equal(first.resourceSnapshot.continuousReserveGuaranteed, false);
});

test('only a fixed hidden CPU CLI executes and text remains explicitly untrusted', async t => {
  const r = rig(t); await r.recognizer.start(); const pending = r.recognizer.transcribe(wav()); await spawned(r);
  const { file, args, opts } = r.calls[0];
  assert.equal(file, path.join(runtime, 'whisper-cli.exe')); assert.equal(opts.windowsHide, true); assert.equal(opts.shell, false);
  assert.equal(opts.cwd, runtime); assert.deepEqual(opts.stdio, ['ignore', 'pipe', 'pipe']);
  assert.deepEqual(args, ['--model', path.join(project, 'companion/local/models/ggml-base.en.bin'), '--file', path.join(scratch, 'asr-1/input.wav'),
    '--threads', '4', '--language', 'en', '--no-gpu', '--output-txt', '--output-file', path.join(scratch, 'asr-1/transcript')]);
  assert.equal(opts.env.OMP_NUM_THREADS, '4'); assert.equal(r.hashed.length, 84);
  r.complete('  Attack this known target.\n'); const result = await pending;
  assert.equal(result.text, 'Attack this known target.'); assert.equal(result.classification, 'MOCK_ONLY');
  assert.equal(result.transcriptTrust, 'UNTRUSTED_RECOGNITION'); assert.equal(result.commandExecution, false);
  assert.equal(result.durationMs, 500); assert.equal(result.microphoneCapture, false);
  assert.equal(r.recognizer.status().state, 'READY'); assert.equal(r.deletes.length, 3);
  assert.ok(r.handles.every(h => h.closed));
});

test('two same-tick requests cannot queue or spawn twice, and admitted audio is copied', async t => {
  const r = rig(t); await r.recognizer.start(); const buffer = wav(), expected = Buffer.from(buffer);
  const pending = r.recognizer.transcribe(buffer); buffer.fill(255);
  await assert.rejects(r.recognizer.transcribe(wav()), /RECOGNITION_BUSY/); await spawned(r);
  assert.deepEqual(r.writes[0].bytes, expected); r.complete(); await pending; assert.equal(r.calls.length, 1);
});

test('WAV admission rejects noncanonical headers, range violations, paths and extra options', async t => {
  const r = rig(t); await r.recognizer.start();
  const invalid = [null, 'input.wav', new Uint8Array(wav()), wav(99), wav(15001), Buffer.alloc(44)];
  for (const [offset, value] of [[4, 1], [16, 18], [20, 3], [22, 2], [24, 48000], [28, 64000], [32, 4], [34, 8], [40, 1]]) {
    const valueWav = wav(); valueWav.writeUInt32LE(value, offset); invalid.push(valueWav);
  }
  for (const buffer of invalid) await assert.rejects(r.recognizer.transcribe(buffer), /INVALID_RECOGNITION_WAV/);
  await assert.rejects(r.recognizer.transcribe(wav(), { file: '../escape' }), /INVALID_RECOGNITION_OPTIONS/);
  assert.equal(r.calls.length, 0); assert.equal(r.writes.length, 0);
});

test('constructor cannot configure a path, language, thread count, or executable', () => {
  for (const options of [{ runtime: 'other' }, { threads: 16 }, { language: 'auto' }, { requestTimeoutMs: 0 },
    { stopTimeoutMs: 10001 }, { [Symbol('path')]: 'x' }, Object.create(null)])
    assert.throws(() => createLocalRecognition(options), /INVALID_RECOGNITION_OPTIONS/);
});

test('disk and RAM fail preflight with measured snapshot and zero scratch/process effects', async t => {
  for (const [name, configure, expected] of [
    ['disk', io => { io.statfs = async () => ({ bavail: 9 * 1024 ** 3, bsize: 1 }); }, /RECOGNITION_DISK_RESERVE/],
    ['ram', io => { io.freemem = () => 2 * 1024 ** 3; }, /RECOGNITION_RAM_RESERVE/]]) {
    const r = rig(t, configure); await assert.rejects(r.recognizer.start(), expected);
    assert.ok(r.recognizer.status().resourceSnapshot, name); assert.equal(r.calls.length, 0); assert.equal(r.writes.length, 0);
  }
});

test('runtime hash drift, extra payload and mutable manifest replacement fail closed', async t => {
  for (const configure of [
    (io, a) => { a.hashes.set(path.join(runtime, 'whisper-cli.exe'), '0'.repeat(64)); },
    (io, a) => { a.sizes.set(path.join(runtime, 'unreviewed.dll'), 42); },
    (io, a) => { const altered = JSON.parse(lockBytes); altered.artifacts.find(x => x.id === 'whisper-base-en').sha256 = '0'.repeat(64);
      a.add(path.join(project, 'companion/models.lock.json'), Buffer.from(JSON.stringify(altered))); },
    (io, a) => { const altered = JSON.parse(inventoryBytes); altered.files[0].sha256 = '0'.repeat(64);
      a.add(path.join(project, 'companion/whisper-runtime-pins.json'), Buffer.from(JSON.stringify(altered))); }
  ]) {
    const r = rig(t, configure); await assert.rejects(r.recognizer.start(), /RECOGNITION_(PIN|RUNTIME_INVENTORY)_MISMATCH/); assert.equal(r.calls.length, 0);
  }
});

test('stopping stalled preflight is bounded and prevents a late READY or spawn', async t => {
  const gate = deferred(); const r = rig(t, io => { io.statfs = () => gate.promise; });
  const starting = r.recognizer.start(); const rejected = assert.rejects(starting, /RECOGNITION_STOPPED/);
  const stopped = await r.recognizer.stop(); assert.equal(stopped.pendingPreflight, true); assert.equal(stopped.ownedProcessStopped, true);
  await assert.rejects(r.recognizer.start(), /RECOGNITION_BUSY/);
  await rejected; gate.resolve({ bavail: 20 * 1024 ** 3, bsize: 1 }); await idle(r);
  assert.equal(r.recognizer.status().state, 'STOPPED'); assert.equal(r.calls.length, 0);
});

test('the preflight deadline settles a stalled public start but holds the slot until its I/O drains', async t => {
  const gate = deferred(); const r = rig(t, io => { io.statfs = () => gate.promise; }, { requestTimeoutMs: 10 });
  await assert.rejects(r.recognizer.start(), /RECOGNITION_TIMEOUT/);
  assert.equal(r.recognizer.status().busy, true); assert.equal(r.recognizer.status().lastError, 'RECOGNITION_TIMEOUT');
  await assert.rejects(r.recognizer.start(), /RECOGNITION_BUSY/);
  gate.resolve({ bavail: 20 * 1024 ** 3, bsize: 1 }); await idle(r);
  assert.equal(r.recognizer.status().lastError, 'RECOGNITION_TIMEOUT'); assert.equal(r.calls.length, 0);
});

test('a resource drop during file verification is checked again before native spawn', async t => {
  let checks = 0; const r = rig(t, io => { io.freemem = () => (++checks < 3 ? 6 : 2) * 1024 ** 3; });
  await r.recognizer.start(); await assert.rejects(r.recognizer.transcribe(wav()), /RECOGNITION_RAM_RESERVE/); await idle(r);
  assert.equal(r.calls.length, 0); assert.equal(r.deletes.length, 2); assert.equal(checks, 3);
});

test('abort retains ownership and all files until child close, even when kill is refused', async t => {
  const r = rig(t, (_io, a) => { a.closeOnKill = false; a.killAccepted = false; }); await r.recognizer.start();
  const controller = new AbortController(); const pending = r.recognizer.transcribe(wav(), { signal: controller.signal });
  const rejected = assert.rejects(pending, /RECOGNITION_ABORTED/); await spawned(r); controller.abort(); await rejected;
  const stopped = await r.recognizer.stop(); assert.equal(stopped.ownedProcessStopped, false); assert.equal(stopped.state, 'STOP_UNCONFIRMED');
  assert.equal(stopped.busy, true); assert.equal(r.deletes.length, 0);
  await assert.rejects(r.recognizer.start(), /RECOGNITION_BUSY/);
  r.calls[0].child.emit('exit', 0); await flush(); assert.equal(r.recognizer.status().ownsProcess, true);
  r.complete('late result must never return'); await idle(r); assert.equal(r.recognizer.status().state, 'STOPPED');
  assert.equal(r.deletes.length, 3);
});

test('timeout kills the owned child, rejects late success and permits explicit preflight restart only', async t => {
  const r = rig(t, (_io, a) => { a.closeOnKill = false; }, { requestTimeoutMs: 20 }); await r.recognizer.start();
  const pending = r.recognizer.transcribe(wav()); const rejected = assert.rejects(pending, /RECOGNITION_TIMEOUT/); await spawned(r);
  await rejected; assert.equal(r.recognizer.status().busy, true); assert.equal(r.calls[0].child.kills.length, 1);
  r.complete('late'); await idle(r); await assert.rejects(r.recognizer.transcribe(wav()), /RECOGNITION_NOT_READY/);
  await r.recognizer.start(); assert.equal(r.recognizer.status().state, 'READY');
});

test('abort during a stalled output read rejects late bytes and retains cleanup ownership', async t => {
  const gate = deferred(), entered = deferred();
  const r = rig(t, io => { const original = io.open; io.open = async file => {
    const handle = await original(file); if (file.endsWith('transcript.txt')) { const read = handle.read;
      handle.read = async (...args) => { entered.resolve(); await gate.promise; return read(...args); }; } return handle;
  }; });
  await r.recognizer.start(); const controller = new AbortController();
  const pending = r.recognizer.transcribe(wav(), { signal: controller.signal }); const rejected = assert.rejects(pending, /RECOGNITION_ABORTED/);
  await spawned(r); r.complete('should be discarded'); await entered.promise; controller.abort(); await rejected;
  const stopped = await r.recognizer.stop(); assert.equal(stopped.ownedProcessStopped, true); assert.equal(stopped.busy, true);
  assert.equal(stopped.cleanupComplete, false); gate.resolve(); await idle(r); assert.ok(r.handles.every(h => h.closed));
});

test('spawn throw and emitted error plus close are redacted and cleanly release the slot', async t => {
  for (const throwSpawn of [true, false]) {
    const r = rig(t, io => { if (throwSpawn) io.spawn = () => { throw new Error('C:/private/secret=abc'); }; });
    await r.recognizer.start(); const pending = r.recognizer.transcribe(wav()); const rejected = assert.rejects(pending, /RECOGNITION_(IO|PROCESS)_FAILED/);
    if (!throwSpawn) { await spawned(r); r.calls[0].child.emit('error', new Error('password=abc')); }
    await rejected; await idle(r); assert.equal(JSON.stringify(r.recognizer.status()).includes('abc'), false); assert.equal(r.deletes.length, 2);
  }
});

test('malformed, oversized, empty and controlled-character transcript outputs never return text', async t => {
  for (const text of [Buffer.from([0xff]), Buffer.alloc(4097, 65), '', 'ok\u0000secret', 'x'.repeat(2049)]) {
    const r = rig(t); await r.recognizer.start(); const pending = r.recognizer.transcribe(wav());
    const rejected = assert.rejects(pending, /RECOGNITION_(FILE|OUTPUT)_REJECTED/); await spawned(r); r.complete(text); await rejected; await idle(r);
    assert.equal(r.recognizer.status().state, 'STOPPED');
  }
});

test('native stdout/stderr are discarded and cumulative output has a hard limit', async t => {
  const r = rig(t); await r.recognizer.start(); const pending = r.recognizer.transcribe(wav());
  const rejected = assert.rejects(pending, /RECOGNITION_NATIVE_OUTPUT_LIMIT/); await spawned(r);
  r.calls[0].child.stderr.write('C:/private/credential-value'); r.calls[0].child.stdout.write(Buffer.alloc(131073, 65));
  await rejected; await idle(r); assert.equal(JSON.stringify(r.recognizer.status()).includes('credential'), false);
});

test('runtime and parent reparse paths fail before hash or process', async t => {
  for (const configure of [
    (_io, a) => a.links.add(path.join(project, 'companion/local')),
    io => { io.realpath = async file => file === runtime ? path.resolve(project, '..', 'elsewhere') : file; },
  ]) {
    const r = rig(t, configure); await assert.rejects(r.recognizer.start(), /RECOGNITION_PATH_REJECTED/);
    assert.equal(r.calls.length, 0); assert.equal(r.writes.length, 0);
  }
});

test('a linked transcript is not read or deleted and cleanup failure blocks reuse', async t => {
  const r = rig(t); await r.recognizer.start(); const pending = r.recognizer.transcribe(wav());
  const rejected = assert.rejects(pending, /RECOGNITION_PATH_REJECTED/); await spawned(r);
  const output = path.join(scratch, 'asr-1/transcript.txt'); r.links.add(output); r.complete('never read'); await rejected; await idle(r);
  assert.equal(r.reads.includes(output), false); assert.equal(r.deletes.length, 0);
  assert.equal(r.recognizer.status().cleanupBlocked, true); await assert.rejects(r.recognizer.start(), /RECOGNITION_CLEANUP_FAILED/);
});

test('changed scratch ancestor prevents any cleanup operation outside the checked tree', async t => {
  const r = rig(t); await r.recognizer.start(); const pending = r.recognizer.transcribe(wav());
  const rejected = assert.rejects(pending, /RECOGNITION_PATH_REJECTED/); await spawned(r);
  r.links.add(scratch); r.complete(); await rejected; await idle(r);
  assert.equal(r.deletes.length, 0); assert.equal(r.recognizer.status().cleanupBlocked, true);
});

test('dispose is permanent and no auto restart follows later requests', async t => {
  const r = rig(t); await r.recognizer.start(); const result = await r.recognizer.dispose();
  assert.equal(result.state, 'DISPOSED'); await assert.rejects(r.recognizer.start(), /RECOGNITION_DISPOSED/);
  await assert.rejects(r.recognizer.transcribe(wav()), /RECOGNITION_DISPOSED/); assert.equal(r.calls.length, 0);
});
