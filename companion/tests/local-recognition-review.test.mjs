// Independent MOCK_ONLY review. All child-process and file operations are fakes.
// This suite never starts Whisper, captures a microphone, plays audio or controls MW5.
import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { setImmediate as flush } from 'node:timers/promises';
import { createLocalRecognition } from '../local-recognition.mjs';
import runtimePins from '../whisper-runtime-pins.json' with { type: 'json' };

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const lock = JSON.parse(await readFile(path.join(root, 'companion/models.lock.json'), 'utf8'));
const inventoryBytes = await readFile(path.join(root, 'companion/whisper-runtime-pins.json'));
const runtime = path.join(root, 'companion/local/runtimes/whisper-cpu-b5130/Release');
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const outcome = promise => promise.then(value => ({ value }), error => ({ error: error.message }));
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

function wave({ frames = 1600, channels = 1, rate = 16000, bits = 16, format = 1 } = {}) {
  const block = channels * bits / 8;
  const buffer = Buffer.alloc(44 + frames * block);
  buffer.write('RIFF', 0); buffer.writeUInt32LE(buffer.length - 8, 4); buffer.write('WAVEfmt ', 8);
  buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(format, 20); buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(rate, 24); buffer.writeUInt32LE(rate * block, 28);
  buffer.writeUInt16LE(block, 32); buffer.writeUInt16LE(bits, 34);
  buffer.write('data', 36); buffer.writeUInt32LE(buffer.length - 44, 40);
  buffer.writeInt16LE(500, 44); return buffer;
}

function rig(t, customize = () => {}, settings = {}) {
  const files = new Map(), dirs = new Set([root]), children = [], deleted = [], opened = [], writes = [];
  const sizes = new Map(), hashes = new Map();
  const digest = bytes => createHash('sha256').update(bytes).digest('hex');
  const put = (file, data) => {
    const bytes = Buffer.isBuffer(data) ? Buffer.from(data) : Buffer.from(data);
    files.set(file, bytes); sizes.set(file, bytes.length); hashes.set(file, digest(bytes));
    for (let d = path.dirname(file); d.length >= root.length; d = path.dirname(d)) { dirs.add(d); if (d === root) break; }
  };
  const fixtureLock = structuredClone(lock), fixturePins = structuredClone(runtimePins);
  // Synthetic metadata/hash I/O exercises lifecycle without reading a model or executing native code.
  for (const pin of fixtureLock.artifacts.filter(x => ['whisper-cpu', 'whisper-base-en'].includes(x.id))) {
    const file = path.join(root, 'companion/local/models', pin.name);
    put(file, Buffer.from('MOCK_ONLY ' + pin.id)); sizes.set(file, pin.bytes); hashes.set(file, pin.sha256);
  }
  for (const pin of fixturePins.files) {
    const file = path.join(runtime, pin.name);
    put(file, Buffer.from('MOCK_ONLY ' + pin.name)); sizes.set(file, pin.bytes); hashes.set(file, pin.sha256);
  }
  put(path.join(root, 'companion/models.lock.json'), JSON.stringify(fixtureLock));
  put(path.join(root, 'companion/whisper-runtime-pins.json'), inventoryBytes);
  const missing = () => Object.assign(Error('PRIVATE_PATH_MUST_NOT_LEAK'), { code: 'ENOENT' });
  const stat = file => ({ size: sizes.get(file) ?? 0, isFile: () => files.has(file), isDirectory: () => dirs.has(file), isSymbolicLink: () => state.symbolic === file });
  const entry = file => ({ name: path.basename(file), ...stat(file) });
  const state = { files, dirs, children, deleted, opened, writes, fixtureLock, fixturePins, put, sizes, hashes,
    onKill: child => { queueMicrotask(() => child.emit('close', 0, null)); return true; }, beforeRead: async () => {}, beforeWrite: async () => {} };
  const io = {
    lstat: async file => { if (!files.has(file) && !dirs.has(file)) throw missing(); return stat(file); },
    realpath: async file => state.redirect === file ? path.resolve(root, '../PRIVATE_EXTERNAL') : file,
    readdir: async dir => [...new Set([...files.keys(), ...dirs])].filter(f => f !== dir && path.dirname(f) === dir).map(entry),
    statfs: async () => ({ bavail: 20, bsize: 1024 ** 3 }), freemem: () => state.ram ?? 6 * 1024 ** 3,
    mkdir: async dir => { if (dirs.has(dir)) throw Object.assign(Error('exists'), { code: 'EEXIST' }); dirs.add(dir); },
    mkdtemp: async prefix => { const dir = prefix + String(dirs.size); dirs.add(dir); return dir; },
    writeFile: async (file, bytes, options) => { await state.beforeWrite(file, bytes); assert.equal(options.flag, 'wx'); if (files.has(file)) throw Error('exists'); writes.push({ file, bytes: Buffer.from(bytes) }); put(file, bytes); },
    unlink: async file => { deleted.push(file); if (!files.delete(file)) throw missing(); sizes.delete(file); hashes.delete(file); },
    rmdir: async dir => { assert.ok(![...files.keys(), ...dirs].some(f => f !== dir && path.dirname(f) === dir), 'nonempty directory deletion forbidden'); deleted.push(dir); dirs.delete(dir); },
    open: async file => {
      if (!files.has(file)) throw missing(); const bytes = files.get(file), handle = { file, closed: false }; opened.push(handle);
      return { stat: async () => ({ size: sizes.get(file), isFile: () => true }),
        read: async (buffer, offset, length, position) => { await state.beforeRead(file); const count = Math.max(0, Math.min(length, bytes.length - position)); bytes.copy(buffer, offset, position, position + count); return { bytesRead: count }; },
        close: async () => { handle.closed = true; } };
    },
    spawn: (file, args, options) => {
      const child = new EventEmitter(); child.stdout = new PassThrough(); child.stderr = new PassThrough();
      Object.assign(child, { file, args, options, pid: 9100 + children.length, kills: 0 });
      child.kill = () => { child.kills++; return state.onKill(child); };
      child.finish = (text = 'Regroup with the commander.', code = 0) => {
        const prefix = args[args.indexOf('--output-file') + 1]; if (text !== null) put(prefix + '.txt', text);
        child.emit('close', code, null);
      }; children.push(child); return child;
    },
    now: () => performance.now()
  };
  io.hashFile = async file => hashes.get(file);
  customize(io, state);
  const engine = createLocalRecognition({ requestTimeoutMs: 5000, stopTimeoutMs: 10, ...settings }, io);
  t.after(async () => {
    state.onKill = child => { queueMicrotask(() => child.emit('close', 0, null)); return true; };
    for (const child of children) child.emit('close', 0, null);
    await engine.dispose();
  });
  return { engine, io, state };
}

async function launched(h, request = wave(), options) {
  await h.engine.start(); const pending = outcome(h.engine.transcribe(request, options)); await flush();
  assert.equal(h.state.children.length, 1, 'exactly one owned mock worker should have launched');
  return { pending, child: h.state.children[0] };
}

test('review: replacing model/runtime and both mutable manifests cannot satisfy fixed artifact provenance', async t => {
  const h = rig(t, (io, state) => {
    for (const pin of state.fixtureLock.artifacts.filter(x => ['whisper-cpu', 'whisper-base-en'].includes(x.id))) {
      const file = path.join(root, 'companion/local/models', pin.name);
      state.put(file, 'FORGED_MODEL'); pin.bytes = state.sizes.get(file); pin.sha256 = state.hashes.get(file);
    }
    const archive = state.fixtureLock.artifacts.find(x => x.id === 'whisper-cpu');
    state.fixturePins.archiveBytes = archive.bytes; state.fixturePins.archiveSha256 = archive.sha256;
    for (const pin of state.fixturePins.files) {
      const file = path.join(runtime, pin.name); state.put(file, 'FORGED_RUNTIME');
      pin.bytes = state.sizes.get(file); pin.sha256 = state.hashes.get(file);
    }
    state.put(path.join(root, 'companion/models.lock.json'), JSON.stringify(state.fixtureLock));
    state.put(path.join(root, 'companion/whisper-runtime-pins.json'), JSON.stringify(state.fixturePins));
  });
  await assert.rejects(h.engine.start(), /RECOGNITION_PIN_MISMATCH/);
  assert.equal(h.state.children.length, 0);
});

test('review: start verifies only and successful transcript remains untrusted with no command execution', async t => {
  const h = rig(t); assert.equal(h.state.children.length, 0);
  const started = await h.engine.start(); assert.equal(started.state, 'READY'); assert.equal(h.state.children.length, 0);
  const { pending, child } = await launched(h);
  assert.equal(child.options.shell, false); assert.equal(child.options.windowsHide, true);
  assert.match(child.file, /whisper-cli\.exe$/); assert.ok(child.args.includes('--no-gpu'));
  assert.equal(child.args[child.args.indexOf('--threads') + 1], '4');
  child.finish(); const { value, error } = await pending; assert.equal(error, undefined);
  assert.equal(value.classification, 'MOCK_ONLY'); assert.equal(value.transcriptTrust, 'UNTRUSTED_RECOGNITION');
  assert.equal(value.commandExecution, false); assert.equal(value.microphoneCapture, false); assert.equal(value.speakerPlayback, false);
  assert.equal(h.engine.status().busy, false); assert.equal(h.engine.status().cleanupPending, false);
  assert.ok(h.state.opened.every(handle => handle.closed));
});

test('review: stopping stalled preflight returns honestly and late inspection cannot enable or spawn', async t => {
  const gate = deferred(), reached = deferred(); let held = false;
  const h = rig(t, (io, state) => { state.beforeRead = async file => {
    if (file.endsWith('models.lock.json') && !held) { held = true; reached.resolve(); await gate.promise; }
  }; });
  const starting = outcome(h.engine.start()); await reached.promise;
  const stopped = await h.engine.stop(); assert.equal(stopped.stopped, false); assert.equal(stopped.pendingPreflight, true);
  await assert.rejects(h.engine.start(), /RECOGNITION_BUSY/); assert.equal(h.state.children.length, 0);
  gate.resolve(); assert.match((await starting).error, /RECOGNITION_STOPPED/); await flush();
  assert.equal(h.engine.status().state, 'STOPPED'); assert.equal(h.state.children.length, 0);
});

test('review: stop settles the public start promise even while underlying inspection is stalled', async t => {
  const gate = deferred(), reached = deferred(); let held = false, settled = false;
  const h = rig(t, (io, state) => { state.beforeRead = async file => {
    if (file.endsWith('models.lock.json') && !held) { held = true; reached.resolve(); await gate.promise; }
  }; });
  const starting = outcome(h.engine.start()).then(value => { settled = true; return value; });
  await reached.promise; await h.engine.stop(); await delay(20); const settledWithoutRead = settled;
  gate.resolve(); await starting; await flush();
  assert.equal(settledWithoutRead, true, 'public start callers must be released on stop while internal inspection remains owned');
  assert.equal(h.state.children.length, 0);
});

test('review: startup deadline releases its caller but preserves unfinished inspection ownership', async t => {
  const gate = deferred(), reached = deferred(); let held = false;
  const h = rig(t, (io, state) => { state.beforeRead = async file => {
    if (file.endsWith('models.lock.json') && !held) { held = true; reached.resolve(); await gate.promise; }
  }; }, { requestTimeoutMs: 150 });
  const starting = outcome(h.engine.start()); await reached.promise;
  const result = await starting; assert.equal(result.error, 'RECOGNITION_TIMEOUT');
  assert.equal(h.engine.status().busy, true); await assert.rejects(h.engine.start(), /RECOGNITION_BUSY/);
  gate.resolve(); await flush(); assert.equal(h.engine.status().busy, false); assert.equal(h.state.children.length, 0);
});

test('review: simultaneous transcriptions have no queue and exit alone does not release ownership', async t => {
  const h = rig(t); const { pending, child } = await launched(h);
  await assert.rejects(h.engine.transcribe(wave()), /RECOGNITION_BUSY/);
  child.emit('exit', 0); await flush(); assert.equal(h.engine.status().busy, true);
  await assert.rejects(h.engine.transcribe(wave()), /RECOGNITION_BUSY/);
  child.finish(); assert.ok((await pending).value); assert.equal(h.state.children.length, 1);
});

test('review: failed kill retains ownership until late close and forbids premature cleanup or restart', async t => {
  const controller = new AbortController(); const h = rig(t, (io, state) => { state.onKill = () => false; });
  const { pending, child } = await launched(h, wave(), { signal: controller.signal }); controller.abort();
  assert.equal((await pending).error, 'RECOGNITION_ABORTED');
  const stopped = await h.engine.stop(); assert.equal(stopped.stopped, false); assert.equal(stopped.ownedProcessStopped, false);
  assert.equal(h.engine.status().state, 'STOP_UNCONFIRMED'); assert.equal(h.state.deleted.length, 0);
  await assert.rejects(h.engine.start(), /RECOGNITION_BUSY/); await assert.rejects(h.engine.transcribe(wave()), /RECOGNITION_BUSY/);
  child.finish('Late text must never survive.'); await flush();
  assert.equal(h.engine.status().busy, false); assert.equal(h.engine.status().state, 'STOPPED');
  assert.equal(h.state.children.length, 1);
});

test('review: thrown kill and timeout cannot release an unclosed worker', async t => {
  const h = rig(t, (io, state) => { state.onKill = () => { throw Error('PRIVATE_PATH_MUST_NOT_LEAK'); }; }, { requestTimeoutMs: 1000 });
  const { pending, child } = await launched(h); assert.equal((await pending).error, 'RECOGNITION_TIMEOUT');
  const stopped = await h.engine.stop(); assert.equal(stopped.ownedProcessStopped, false); assert.equal(h.state.deleted.length, 0);
  assert.equal(child.kills, 1); child.emit('close', null, 'SIGTERM'); await flush(); assert.equal(h.engine.status().busy, false);
});

test('review: cancelled output read cannot succeed and closes its handle after the late read settles', async t => {
  const gate = deferred(), reached = deferred(), controller = new AbortController();
  const h = rig(t, (io, state) => { state.beforeRead = async file => {
    if (file.endsWith('transcript.txt')) { reached.resolve(); await gate.promise; }
  }; });
  const { pending, child } = await launched(h, wave(), { signal: controller.signal }); child.finish(); await reached.promise;
  controller.abort(); assert.equal((await pending).error, 'RECOGNITION_ABORTED');
  assert.equal(h.engine.status().busy, true); await assert.rejects(h.engine.start(), /RECOGNITION_BUSY/);
  gate.resolve(); await flush(); assert.equal(h.engine.status().busy, false);
  assert.ok(h.state.opened.every(handle => handle.closed));
});

test('review: admitted input is copied before any asynchronous operation', async t => {
  const gate = deferred(), reached = deferred();
  const h = rig(t, (io, state) => { state.beforeWrite = async () => { reached.resolve(); await gate.promise; }; });
  await h.engine.start(); const input = wave(), expected = Buffer.from(input), pending = outcome(h.engine.transcribe(input));
  input.fill(0); await reached.promise; gate.resolve(); await flush();
  assert.deepEqual(h.state.writes[0].bytes, expected); h.state.children[0].finish(); assert.ok((await pending).value);
});

for (const kind of ['throw', 'error_then_close']) test(`review: ${kind} spawn failure is redacted and no stale ownership remains`, async t => {
  const h = rig(t, (io, state) => {
    const original = io.spawn;
    io.spawn = (...args) => {
      if (kind === 'throw') throw Error('PRIVATE_PATH_MUST_NOT_LEAK');
      const child = original(...args); queueMicrotask(() => child.emit('error', Error('PRIVATE_PATH_MUST_NOT_LEAK'))); return child;
    };
  });
  await h.engine.start(); const result = await outcome(h.engine.transcribe(wave())); await flush();
  assert.match(result.error, /^RECOGNITION_(IO|PROCESS)_FAILED$/); assert.equal(h.engine.status().busy, false);
  assert.doesNotMatch(JSON.stringify(h.engine.status()), /PRIVATE_PATH_MUST_NOT_LEAK/);
});

for (const [name, make] of [
  ['too short', () => wave({ frames: 1599 })], ['too long', () => wave({ frames: 240001 })],
  ['stereo', () => wave({ channels: 2 })], ['wrong rate', () => wave({ rate: 24000 })],
  ['float', () => wave({ bits: 32, format: 3 })],
  ['false RIFF size', () => { const b = wave(); b.writeUInt32LE(12, 4); return b; }],
  ['false data size', () => { const b = wave(); b.writeUInt32LE(8, 40); return b; }],
  ['wrong byte rate', () => { const b = wave(); b.writeUInt32LE(16000, 28); return b; }],
  ['wrong format chunk length', () => { const b = wave(); b.writeUInt32LE(18, 16); return b; }],
  ['trailing byte', () => Buffer.concat([wave(), Buffer.from([0])])], ['arbitrary view', () => new Uint8Array(wave())]
]) test(`review: WAV ${name} rejects before worker or temporary write`, async t => {
  const h = rig(t); await h.engine.start(); await assert.rejects(h.engine.transcribe(make()), /INVALID_RECOGNITION_WAV/);
  assert.equal(h.state.children.length, 0); assert.equal(h.state.writes.length, 0);
});

for (const [name, bytes] of [
  ['empty', Buffer.alloc(0)], ['whitespace', Buffer.from(' \r\n\t')], ['invalid UTF-8', Buffer.from([0xc3, 0x28])],
  ['control bytes', Buffer.from('follow\u0000me')], ['too many bytes', Buffer.alloc(4097, 120)], ['too many characters', Buffer.alloc(2049, 120)]
]) test(`review: transcript ${name} is rejected without native diagnostics`, async t => {
  const h = rig(t); const { pending, child } = await launched(h);
  child.stderr.write('PRIVATE_PATH_MUST_NOT_LEAK'); child.finish(bytes);
  const result = await pending; assert.match(result.error, /^RECOGNITION_(OUTPUT|FILE)_REJECTED$/); assert.equal(result.value, undefined);
  await flush(); assert.doesNotMatch(JSON.stringify(h.engine.status()), /PRIVATE_PATH_MUST_NOT_LEAK/); assert.equal(h.engine.status().busy, false);
});

test('review: excessive stdout/stderr cancels without retaining or exposing diagnostic content', async t => {
  const h = rig(t); const { pending, child } = await launched(h);
  child.stdout.write(Buffer.alloc(131073, 120)); assert.equal((await pending).error, 'RECOGNITION_NATIVE_OUTPUT_LIMIT');
  await flush(); assert.equal(h.engine.status().busy, false); assert.equal(child.kills, 1);
});

test('review: redirected scratch directory cannot be read or cleaned through its new target', async t => {
  const h = rig(t); const { pending, child } = await launched(h);
  const input = child.args[child.args.indexOf('--file') + 1], dir = path.dirname(input);
  h.state.redirect = dir;
  child.finish();
  const result = await pending; await flush();
  assert.equal(result.error, 'RECOGNITION_PATH_REJECTED'); assert.equal(h.engine.status().cleanupBlocked, true);
  assert.equal(h.state.deleted.length, 0); assert.equal(h.state.opened.some(handle => handle.file.endsWith('transcript.txt')), false);
});

test('review: symbolic transcript is neither read nor deleted during cleanup', async t => {
  const h = rig(t); const { pending, child } = await launched(h);
  const prefix = child.args[child.args.indexOf('--output-file') + 1]; h.state.symbolic = prefix + '.txt'; child.finish();
  const result = await pending; await flush();
  assert.equal(result.error, 'RECOGNITION_PATH_REJECTED'); assert.equal(h.engine.status().cleanupBlocked, true);
  assert.equal(h.state.opened.some(handle => handle.file === h.state.symbolic), false);
  assert.equal(h.state.deleted.includes(h.state.symbolic), false);
  await assert.rejects(h.engine.start(), /RECOGNITION_CLEANUP_FAILED/);
});

test('review: late error from a completed worker cannot disable a later owned request', async t => {
  const h = rig(t); const first = await launched(h); first.child.finish(); assert.ok((await first.pending).value);
  const second = outcome(h.engine.transcribe(wave())); await flush(); const current = h.state.children[1];
  assert.ok(current); first.child.emit('error', Error('stale callback'));
  current.finish(); assert.ok((await second).value);
  assert.equal(h.engine.status().state, 'READY'); assert.equal(h.engine.status().lastError, null);
  assert.equal(current.kills, 0);
});

test('review: an output file growing beyond its declared length cannot pass a bounded read', async t => {
  const h = rig(t); const { pending, child } = await launched(h);
  child.finish('This file has extra bytes.'); const prefix = child.args[child.args.indexOf('--output-file') + 1];
  h.state.sizes.set(prefix + '.txt', 4);
  assert.equal((await pending).error, 'RECOGNITION_FILE_REJECTED'); await flush();
});

test('review: cleanup refuses unexpected files rather than recursively deleting their directory', async t => {
  const h = rig(t); const { pending, child } = await launched(h);
  const dir = path.dirname(child.args[child.args.indexOf('--file') + 1]);
  const extra = path.join(dir, 'not-owned.txt'); h.state.put(extra, 'must stay'); child.finish();
  assert.equal((await pending).error, 'RECOGNITION_CLEANUP_FAILED'); assert.equal(h.state.deleted.length, 0);
  assert.equal(h.state.files.has(extra), true); assert.equal(h.engine.status().cleanupBlocked, true);
});

test('review: maximum 15-second canonical input is admitted without resampling or a second worker', async t => {
  const h = rig(t); const { pending, child } = await launched(h, wave({ frames: 240000 }));
  child.finish(); const { value } = await pending; assert.equal(value.durationMs, 15000); assert.equal(h.state.children.length, 1);
});

test('review: a forged model pin alone cannot redefine the selected base.en artifact', async t => {
  const h = rig(t, (io, state) => {
    const pin = state.fixtureLock.artifacts.find(x => x.id === 'whisper-base-en');
    const file = path.join(root, 'companion/local/models', pin.name); state.put(file, 'forged model bytes');
    pin.bytes = state.sizes.get(file); pin.sha256 = state.hashes.get(file);
    state.put(path.join(root, 'companion/models.lock.json'), JSON.stringify(state.fixtureLock));
  });
  await assert.rejects(h.engine.start(), /RECOGNITION_PIN_MISMATCH/); assert.equal(h.state.children.length, 0);
});

test('review: runtime contents must match source-pinned digest despite unchanged size and filenames', async t => {
  const h = rig(t, (io, state) => { state.hashes.set(path.join(runtime, 'whisper-cli.exe'), 'a'.repeat(64)); });
  await assert.rejects(h.engine.start(), /RECOGNITION_PIN_MISMATCH/); assert.equal(h.state.children.length, 0);
});

test('review: RAM lost during temporary-file preparation prevents the later worker launch', async t => {
  const h = rig(t, (io, state) => { state.beforeWrite = async () => { state.ram = 2 * 1024 ** 3; }; });
  await h.engine.start(); const result = await outcome(h.engine.transcribe(wave())); await flush();
  assert.equal(result.error, 'RECOGNITION_RAM_RESERVE'); assert.equal(h.state.children.length, 0);
  assert.equal(h.engine.status().cleanupPending, false);
  assert.equal(h.engine.status().resourceSnapshot.availableRamBytes, 2 * 1024 ** 3);
});
