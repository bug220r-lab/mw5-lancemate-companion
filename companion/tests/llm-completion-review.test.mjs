// Independent MOCK_ONLY completion review: fake child, manifests, HTTP and SSE.
// Cases were specified to the implementation owner before executing this suite.
import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createLocalLanguageModel } from '../local-language-model.mjs';
import runtimePins from '../llama-runtime-pins.json' with { type: 'json' };

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const lock = JSON.parse(await readFile(path.join(root, 'companion/models.lock.json'), 'utf8'));
const context = { persona: { id: 'edge' }, request: { text: 'What do you know?' }, facts: [], history: [] };
const timings = { cache_n: 10, prompt_n: 20, prompt_ms: 1, predicted_n: 4, predicted_ms: 1 };
const event = value => `data: ${JSON.stringify(value)}\n\n`;
const chunk = (delta = {}, finish_reason = null, extra = {}) => event({ choices: [{ delta, finish_reason }], ...extra });
const done = 'data: [DONE]\n\n';
const content = () => chunk({ role: 'assistant', content: 'Unknown.' });

function rig(t) {
  const manifest = { schemaVersion: 1, files: runtimePins.files.map(f => ({ artifact: 'llama-cpu',
    path: `companion/local/runtimes/llama-cpu-b11065/${f.name}`, bytes: f.bytes, sha256: f.sha256 })) };
  const sizes = new Map(), hashes = new Map();
  for (const f of manifest.files) { sizes.set(path.resolve(root, f.path), f.bytes); hashes.set(path.resolve(root, f.path), f.sha256); }
  for (const f of lock.artifacts) { const file = path.join(root, 'companion/local/models', f.name); sizes.set(file, f.bytes); hashes.set(file, f.sha256); }
  let parts = [], clock = 0, children = 0;
  const io = {
    readFile: async file => JSON.stringify(file.endsWith('models.lock.json') ? lock : manifest),
    lstat: async file => ({ size: file.endsWith('.json') ? 1000 : sizes.get(file) ?? 0, isFile: () => true, isSymbolicLink: () => false }),
    realpath: async file => file,
    readdir: async () => manifest.files.map(f => ({ name: path.basename(f.path), isFile: () => true, isDirectory: () => false, isSymbolicLink: () => false })),
    hashFile: async file => hashes.get(file), reservePort: async () => 45678,
    now: () => clock, sleep: async ms => { clock += ms; }, randomBytes: n => Buffer.alloc(n, 0x45),
    spawn: () => {
      children++; const child = new EventEmitter(); child.stdout = new PassThrough(); child.stderr = new PassThrough(); child.pid = 7001;
      child.kill = () => { queueMicrotask(() => child.emit('exit', 0)); return true; }; return child;
    },
    fetch: async url => url.endsWith('/health') ? new Response('{}') : new Response(new ReadableStream({ start(controller) {
      for (const part of parts) controller.enqueue(new TextEncoder().encode(part)); controller.close();
    } }), { headers: { 'Content-Type': 'text/event-stream' } })
  };
  const model = createLocalLanguageModel({}, io); t.after(() => model.stop().catch(() => {}));
  return { model, setParts(value) { parts = value; }, get children() { return children; } };
}

for (const [name, parts] of [
  ['separate terminal', [content(), chunk({}, 'stop', { timings }), done]],
  ['combined final content and stop', [chunk({ role: 'assistant', content: 'Unknown.' }, 'stop', { timings }), done]],
  ['usage after stop', [content(), chunk({}, 'stop', { timings }), event({ choices: [], usage: { completion_tokens: 4 } }), done]],
  ['fragmented wire records', (() => { const text = content() + chunk({}, 'stop', { timings }) + done;
    return [text.slice(0, 7), text.slice(7, 39), text.slice(39, -4), text.slice(-4)]; })()]
]) test(`review completion accepts ${name}`, async t => {
  const r = rig(t); r.setParts(parts); await r.model.start();
  assert.equal(await r.model.generate(context), 'Unknown.');
  assert.equal(r.model.status().lastGenerationFinishReason, 'stop'); assert.deepEqual(r.model.status().lastGenerationTimings, timings);
  assert.equal(r.model.status().classification, 'MOCK_ONLY'); assert.equal(r.children, 1);
});

for (const [name, parts] of [
  ['omitted terminal reason', [event({ choices: [{ delta: { content: 'Unknown.' } }] }), done]],
  ['only null terminal reason', [content(), chunk({}, null), done]],
  ['empty-string terminal reason', [content(), chunk({}, ''), done]],
  ['boolean terminal reason', [content(), chunk({}, false), done]],
  ['unsupported terminal reason', [content(), chunk({}, 'tool_calls'), done]],
  ['repeated stop', [content(), chunk({}, 'stop'), chunk({}, 'stop'), done]],
  ['stop then length', [content(), chunk({}, 'stop'), chunk({}, 'length'), done]],
  ['length then stop', [content(), chunk({}, 'length'), chunk({}, 'stop'), done]],
  ['content after stop', [content(), chunk({}, 'stop'), chunk({ content: ' Extra.' }), done]],
  ['empty choice after stop', [content(), chunk({}, 'stop'), chunk({}), done]],
  ['role-only choice after stop', [content(), chunk({}, 'stop'), chunk({ role: 'assistant' }), done]],
  ['null packet', [content(), event(null), done]],
  ['array packet', [content(), event([]), done]],
  ['null choice', [content(), event({ choices: [null] }), done]],
  ['array choice', [content(), event({ choices: [[]] }), done]],
  ['null terminal delta', [content(), event({ choices: [{ delta: null, finish_reason: 'stop' }] }), done]],
  ['array terminal delta', [content(), event({ choices: [{ delta: [], finish_reason: 'stop' }] }), done]],
  ['multiple choices', [content(), event({ choices: [{ delta: {}, finish_reason: 'stop' }, { delta: {}, finish_reason: 'stop' }] }), done]],
  ['malformed JSON', [content(), 'data: {broken}\n\n', done]],
  ['EOF before terminal', [content()]],
  ['EOF after stop without DONE', [content(), chunk({}, 'stop', { timings })]],
  ['DONE without text', [chunk({}, 'stop'), done]],
  ['malformed packet after stop', [content(), chunk({}, 'stop', { timings }), event({ choices: null }), done]]
]) test(`review completion rejects ${name}`, async t => {
  const r = rig(t); r.setParts(parts); await r.model.start(); await assert.rejects(r.model.generate(context));
  assert.equal(r.model.status().lastGenerationFinishReason, null); assert.equal(r.model.status().lastGenerationTimings, null);
  assert.equal(r.model.status().activeGeneration, false); assert.equal(r.model.status().state, 'READY');
});

test('review completion rejects explicit length despite short text and retains only its valid terminal metadata', async t => {
  const r = rig(t); r.setParts([chunk({ content: 'A short fragment' }, 'length', { timings }), done]); await r.model.start();
  await assert.rejects(r.model.generate(context), /GENERATED_TEXT_TRUNCATED/);
  assert.equal(r.model.status().lastGenerationFinishReason, 'length'); assert.deepEqual(r.model.status().lastGenerationTimings, timings);
  assert.equal(r.model.status().activeGeneration, false);
});

test('review completion metadata belongs to the current attempt and a rejected reply does not occupy the next generation', async t => {
  const r = rig(t); await r.model.start();
  r.setParts([content(), chunk({}, 'stop', { timings }), done]); assert.equal(await r.model.generate(context), 'Unknown.');
  r.setParts([content(), done]); await assert.rejects(r.model.generate(context));
  assert.equal(r.model.status().lastGenerationFinishReason, null); assert.equal(r.model.status().lastGenerationTimings, null);
  r.setParts([chunk({ content: 'Still unknown.' }, 'stop'), done]); assert.equal(await r.model.generate(context), 'Still unknown.');
  assert.equal(r.model.status().lastGenerationFinishReason, 'stop'); assert.equal(r.model.status().lastGenerationTimings, null);
  assert.equal(r.children, 1);
});
