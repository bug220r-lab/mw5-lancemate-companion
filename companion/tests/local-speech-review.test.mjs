// Independent file-format/protocol checks. No inference, microphone or playback.
import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough, Writable } from 'node:stream';
import { mkdir, realpath, writeFile, unlink } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { createLocalSpeech, SPEECH_OUTPUT_DIRECTORY, LOCAL_SPEECH_VOICES } from '../local-speech.mjs';

const request = { text: 'Synthetic format fixture.', voiceId: 'af_bella' };
function wave({ channels = 1, sampleRate = 24000, bits = 16, format = 1, frames = 24000, junk = false } = {}) {
  const block = channels * bits / 8, pcm = Buffer.alloc(frames * block), prefix = junk ? 56 : 44;
  const data = Buffer.alloc(prefix + pcm.length); data.write('RIFF'); data.writeUInt32LE(data.length - 8, 4); data.write('WAVE', 8);
  let at = 12;
  if (junk) { data.write('JUNK', at); data.writeUInt32LE(3, at + 4); data.write('abc', at + 8); at += 12; }
  data.write('fmt ', at); data.writeUInt32LE(16, at + 4); data.writeUInt16LE(format, at + 8);
  data.writeUInt16LE(channels, at + 10); data.writeUInt32LE(sampleRate, at + 12);
  data.writeUInt32LE(sampleRate * block, at + 16); data.writeUInt16LE(block, at + 20); data.writeUInt16LE(bits, at + 22);
  data.write('data', at + 24); data.writeUInt32LE(pcm.length, at + 28); pcm.copy(data, at + 32); return data;
}
async function harness(t, options = {}) {
  const files = [], children = [];
  const speech = createLocalSpeech({ spawnProcess: () => {
    const child = new EventEmitter(); child.stdout = new PassThrough(); child.stderr = new PassThrough(); child.requests = [];
    child.stdin = new Writable({ write(chunk, encoding, done) { child.requests.push(JSON.parse(chunk.toString())); done(); } });
    child.kill = () => { setImmediate(() => child.emit('close', 0)); return true; };
    child.send = msg => child.stdout.write(JSON.stringify(msg) + '\n'); children.push(child); return child;
  }, ...options });
  t.after(async () => {
    await speech.stop();
    for (const file of files) {
      assert.equal(path.dirname(path.resolve(file)), path.resolve(SPEECH_OUTPUT_DIRECTORY));
      assert.match(path.basename(file), /^[a-f0-9-]{36}\.wav$/);
      await unlink(file).catch(error => { if (error.code !== 'ENOENT') throw error; });
    }
  });
  const boot = speech.start(); const child = children[0];
  child.send({ type: 'ready', protocol: 1, device: 'cpu', voices: [...LOCAL_SPEECH_VOICES], microphoneCapture: false, speakerPlayback: false });
  await boot;
  async function sendWave(data, patch = {}) {
    const req = child.requests.at(-1); await mkdir(SPEECH_OUTPUT_DIRECTORY, { recursive: true });
    const actual = await realpath(SPEECH_OUTPUT_DIRECTORY);
    assert.equal(actual.toLowerCase(), path.resolve(SPEECH_OUTPUT_DIRECTORY).toLowerCase());
    assert.match(req.id, /^[a-f0-9-]{36}$/); const file = path.join(SPEECH_OUTPUT_DIRECTORY, req.id + '.wav');
    files.push(file); await writeFile(file, data, { flag: 'wx' });
    child.send({ type: 'result', id: req.id, fileName: req.id + '.wav', voiceId: req.voiceId,
      firstAudioMs: 5, synthesisMs: 10, audioDurationSeconds: 1, sampleRate: 24000, channels: 1,
      bytes: data.length, sha256: createHash('sha256').update(data).digest('hex'), ...patch });
  }
  return { speech, child, sendWave };
}

for (const junk of [false, true]) test(`review: valid PCM16 mono24k fixture is accepted, optional padded chunk=${junk}`, async t => {
  const h = await harness(t); const pending = h.speech.synthesize(request);
  await h.sendWave(wave({ junk })); const result = await pending;
  assert.equal(result.classification, 'LOCAL_TTS_FILE_ONLY'); assert.equal(result.speakerPlayback, false);
});

for (const [name, make] of [
  ['wrong sample rate', () => wave({ sampleRate: 48000 })],
  ['stereo', () => wave({ channels: 2 })],
  ['8-bit samples', () => wave({ bits: 8 })],
  ['floating-point format', () => wave({ format: 3, bits: 32 })],
  ['false RIFF length', () => { const b = wave(); b.writeUInt32LE(36, 4); return b; }],
  ['truncated data chunk', () => { const b = wave(); b.writeUInt32LE(b.length, 40); return b; }],
  ['invalid byte rate', () => { const b = wave(); b.writeUInt32LE(123, 28); return b; }],
  ['invalid block alignment', () => { const b = wave(); b.writeUInt16LE(4, 32); return b; }],
  ['magic only without format or audio', () => { const b = Buffer.alloc(44); b.write('RIFF'); b.writeUInt32LE(36, 4); b.write('WAVE', 8); return b; }]
]) test(`review: hash-matching WAV still rejects ${name}`, async t => {
  const h = await harness(t); const pending = h.speech.synthesize(request);
  const rejected = assert.rejects(pending, /OUTPUT_VERIFICATION_FAILED/);
  await h.sendWave(make()); await rejected; assert.equal(h.speech.getState().restartRequired, true);
});

test('review: declared duration must match the actual PCM frame count', async t => {
  const h = await harness(t); const pending = h.speech.synthesize(request);
  const rejected = assert.rejects(pending, /OUTPUT_VERIFICATION_FAILED/);
  await h.sendWave(wave(), { audioDurationSeconds: .2 }); await rejected;
});
