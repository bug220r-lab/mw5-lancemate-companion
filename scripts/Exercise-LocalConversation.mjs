// Actual isolated CPU component benchmark. Synthetic prompts; no MW5 or speech.
import { spawn } from 'node:child_process';
import net from 'node:net';
import os from 'node:os';
import { randomBytes, createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const executable = path.join(root, 'companion/local/runtimes/llama-cpu-b11065/llama-server.exe');
const fallback = process.argv.includes('--fallback');
const model = path.join(root, 'companion/local/models', fallback ? 'Qwen3-1.7B-Q8_0.gguf' : 'Qwen3-4B-Q4_K_M.gguf');
const receiptPath = path.join(root, 'research', fallback ? 'LOCAL_CONVERSATION_FALLBACK_BENCHMARK.json' : 'LOCAL_CONVERSATION_COMPONENT_BENCHMARK.json');
const hash = async file => { const h = createHash('sha256'); for await (const part of createReadStream(file)) h.update(part); return h.digest('hex'); };
const pinned = JSON.parse(await readFile(path.join(root, 'companion/models.lock.json'), 'utf8')).artifacts.find(a => a.id === (fallback ? 'qwen1_7b' : 'qwen4b'));
if (await hash(model) !== pinned.sha256) throw new Error('MODEL_HASH_MISMATCH');
const runtimeReceipt = JSON.parse(await readFile(path.join(root, 'companion/local/runtimes/runtime-files.json'), 'utf8').then(x => x.replace(/^\uFEFF/, '')));
for (const item of runtimeReceipt.files.filter(f => f.artifact === 'llama-cpu'))
  if (await hash(path.join(root, item.path)) !== item.sha256) throw new Error('RUNTIME_HASH_MISMATCH');
const reservation = net.createServer(); await new Promise(resolve => reservation.listen(0, '127.0.0.1', resolve));
const port = reservation.address().port; await new Promise(resolve => reservation.close(resolve));
const token = randomBytes(24).toString('hex'), origin = `http://127.0.0.1:${port}`;
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('LLAMA_ARG_')));
const args = ['-m', model, '--host', '127.0.0.1', '--port', String(port), '--api-key', token,
  '--offline', '--no-webui', '--no-webui-mcp-proxy', '-ngl', '0', '-t', '4', '-tb', '4', '-c', '2048',
  '-np', '1', '--jinja', '--chat-template-kwargs', '{"enable_thinking":false}', '--reasoning-budget', '0'];
const began = performance.now(); let log = '', exit = null, minAvailableRamBytes = os.freemem();
const child = spawn(executable, args, { windowsHide: true, env, stdio: ['ignore','pipe','pipe'] });
child.once('error', error => { log += error.message; exit = -1; }); child.once('exit', code => { exit = code ?? -1; });
for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => { log = (log + chunk.toString()).slice(-32000); });
const memorySampler = setInterval(() => { minAvailableRamBytes = Math.min(minAvailableRamBytes, os.freemem()); }, 100);
const receipt = { schemaVersion: 1, recordedAt: new Date().toISOString(), classification: 'LOCAL_COMPONENT_BENCHMARK_SYNTHETIC_PROMPTS',
  gameTests: 'NOT_PERFORMED', speechTests: 'NOT_PERFORMED', styleAcceptance: 'NOT_PERFORMED',
  model: { id: pinned.id, sha256: pinned.sha256, version: pinned.version }, runtime: 'llama.cpp b11065 CPU x64',
  settings: { threads: 4, contextTokens: 2048, maxOutputTokens: 64, gpuLayers: 0, thinking: false, simultaneousModels: 1 },
  samples: [], status: 'RUNNING', limitations: ['Component-only CPU run; MW5 workload not started or measured.',
    'First generated text is not first spoken audio.', 'Generated output is untrusted and was never played or dispatched.'] };
try {
  let ready = false;
  for (let i = 0; i < 120; i++) {
    if (exit !== null) throw new Error('LOCAL_SERVER_EXITED');
    try { const response = await fetch(`${origin}/health`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(750) });
      if (response.ok) { ready = true; break; } } catch {}
    await delay(500);
  }
  if (!ready) throw new Error('LOCAL_SERVER_READY_TIMEOUT');
  receipt.startupMs = performance.now() - began; console.log(`Local CPU model ready in ${Math.round(receipt.startupMs)} ms`);
  const prompts = [
    { persona: 'edgy_female', style: 'an edgy woman with dry wit and loyalty', fact: 'The squad is holding position because of the player order.', user: 'Are you still holding?' },
    { persona: 'composed_tactician', style: 'a composed, concise tactician', fact: 'Enemy status, route safety and teammate damage are unknown.', user: 'Is that route safe?' },
    { persona: 'energetic_scout', style: 'an energetic but precise scout', fact: 'One hostile target was visible in the current synthetic observation. No kill is verified.', user: 'Did we get that target?' }
  ];
  for (const item of prompts) {
    const messages = [{ role: 'system', content: `You are ${item.style}, a fictional MW5 lancemate. Reply in one short sentence, at most 18 words. This is a synthetic offline audition. Use only the supplied fact; acknowledge unknowns. Do not issue commands or claim you executed an action. Fact: ${item.fact}` },
      { role: 'user', content: `${item.user} /no_think` }];
    const start = performance.now(); let firstTextMs = null, output = '', buffer = '', finishReason = null;
    const response = await fetch(`${origin}/v1/chat/completions`, { method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, max_tokens: 64, temperature: 0.7, top_p: 0.8, top_k: 20, seed: 1234, stream: true,
        chat_template_kwargs: { enable_thinking: false } }), signal: AbortSignal.timeout(60000) });
    if (!response.ok || !response.body) throw new Error(`INFERENCE_HTTP_${response.status}`);
    const decoder = new TextDecoder();
    for await (const chunk of response.body) {
      buffer += decoder.decode(chunk, { stream: true }); let boundary;
      while ((boundary = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0,boundary).trim(); buffer = buffer.slice(boundary+1);
        if (!line.startsWith('data:') || line === 'data: [DONE]') continue;
        const packet = JSON.parse(line.slice(5)); const choice = packet.choices?.[0];
        const text = choice?.delta?.content;
        if (text) { if (firstTextMs === null) firstTextMs = performance.now() - start; output += text; }
        if (choice?.finish_reason) finishReason = choice.finish_reason;
      }
    }
    receipt.samples.push({ ...item, firstTextMs, totalMs: performance.now() - start, output, finishReason,
      groundingReview: 'PENDING_HUMAN_REVIEW', dispatched: false, played: false });
    console.log(JSON.stringify(receipt.samples.at(-1)));
  }
  receipt.status = 'COMPONENT_SMOKE_COMPLETE';
} catch (error) { receipt.status = 'FAILED'; receipt.error = error.message; process.exitCode = 1; }
finally {
  clearInterval(memorySampler); if (exit === null) child.kill();
  for (let i = 0; i < 50 && exit === null; i++) await delay(100);
  receipt.ownedProcessStopped = exit !== null; receipt.minimumAvailableRamBytes = minAvailableRamBytes;
  receipt.completedAt = new Date().toISOString(); receipt.runtimeLog = log.split(token).join('[SESSION_TOKEN]');
  await writeFile(receiptPath, JSON.stringify(receipt, null, 2) + '\n');
  console.log(`Saved ${path.relative(root, receiptPath)}: ${receipt.status}`);
}
