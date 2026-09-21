// Actual local CPU integration smoke. Synthetic mission; no playback, microphone or MW5.
import { createWorkbench } from '../companion/server.mjs';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const slowPreview = process.argv.includes('--allow-slow-preview');
const receipt = { schemaVersion: 1, recordedAt: new Date().toISOString(),
  slowOfflineAudition: slowPreview, acceptanceTargetMs: 4000, timingAcceptance: 'NOT_ESTABLISHED',
  classification: 'LOCAL_CPU_INTEGRATION_SYNTHETIC_INPUTS', status: 'RUNNING', samples: [],
  gameTests: 'NOT_PERFORMED', microphoneTests: 'NOT_PERFORMED', playbackTests: 'NOT_PERFORMED',
  voiceQualityAcceptance: 'NOT_PERFORMED', sources: {},
  limitations: ['File delivery latency is not first audible response latency.',
    'Three short generated previews do not establish mission factuality or game performance.'] };
for (const file of ['companion/server.mjs','companion/conversation.mjs','companion/local-language-model.mjs',
  'companion/local-speech.mjs','scripts/Kokoro-Worker.py'])
  receipt.sources[file] = createHash('sha256').update(await readFile(path.join(root,file))).digest('hex');
const workbench = await createWorkbench({ settingsPath: path.join(root, 'companion/local/benchmark-unset-settings.json') });
let minAvailableRamBytes = os.freemem();
const memory = setInterval(() => { minAvailableRamBytes = Math.min(minAvailableRamBytes, os.freemem()); },100);
async function until(predicate, timeoutMs) {
  const began = performance.now();
  while (performance.now() - began < timeoutMs) {
    const state = workbench.state(); if (predicate(state)) return state;
    await delay(50);
  }
  throw new Error('BENCHMARK_WAIT_TIMEOUT');
}
try {
  const start = performance.now(); await workbench.act({ type: 'models_start' });
  const ready = await until(s => !s.localModels.starting, 150000);
  receipt.startupMs = Math.round(performance.now()-start);
  receipt.engines = { language: ready.localModels.language, speech: ready.localModels.speech };
  if (ready.localModels.language.state !== 'READY' || ready.localModels.speech.state !== 'READY')
    throw new Error(ready.localModels.error || 'ENGINES_NOT_READY');
  await workbench.act({ type: 'demo' });
  if (slowPreview) await workbench.act({ type: 'preview_timing', allowSlow: true });
  for (const actorId of ['alpha','bravo','charlie']) {
    const began = performance.now(), sample = { actorId }; receipt.samples.push(sample);
    await workbench.act({ type: 'converse', actorId, text: 'Radio check. Give a brief greeting in eight words or fewer.' });
    let state = await until(s => s.localModels.reply?.status !== 'GENERATING', 12000);
    sample.textMs = Math.round(performance.now()-began); sample.replyStatus = state.localModels.reply?.status;
    sample.reason = state.localModels.reply?.reason; sample.text = state.localModels.reply?.text;
    if (sample.replyStatus !== 'GENERATED') continue;
    const synthesis = performance.now(); await workbench.act({ type: 'synthesize_reply' });
    state = await until(s => s.localModels.audio?.status !== 'SYNTHESIZING', 35000);
    sample.synthesisMs = Math.round(performance.now()-synthesis); sample.audioStatus = state.localModels.audio?.status;
    sample.voiceId = state.localModels.audio?.voiceId;
    if (sample.audioStatus !== 'READY') { sample.reason = state.localModels.audio?.error; continue; }
    const audioId = state.localModels.audio.id, bytes = await workbench.readAudio(audioId);
    sample.completeWavDeliveryMs = Math.round(performance.now()-began);
    sample.wavBytes = bytes.length; sample.wavSha256 = createHash('sha256').update(bytes).digest('hex');
    sample.playback = 'NOT_PERFORMED'; await workbench.act({ type: 'radio_complete', lineId: audioId });
    console.log(JSON.stringify(sample));
  }
  receipt.status = receipt.samples.length === 3 && receipt.samples.every(s => s.wavBytes > 44) ?
    'PASS_LOCAL_GENERATION_AND_WAV_DELIVERY_ONLY' : 'INCOMPLETE_LOCAL_PIPELINE';
} catch (error) { receipt.status = 'FAILED'; receipt.error = error.code || error.message; }
finally {
  receipt.shutdown = await workbench.dispose(); clearInterval(memory); receipt.minAvailableRamBytes = minAvailableRamBytes;
  receipt.fileDeliveryTiming = receipt.samples.length === 3 && receipt.samples.every(s => s.completeWavDeliveryMs > 4000)
    ? 'ALL_THREE_SAMPLES_EXCEED_4_SECOND_TARGET' : 'SEE_INDIVIDUAL_SAMPLES';
  if (receipt.shutdown.status !== 'LOCAL_MODELS_STOPPED') receipt.status = 'FAILED_SHUTDOWN';
  await writeFile(path.join(root,'research/WORKBENCH_CONVERSATION_BENCHMARK.json'), JSON.stringify(receipt,null,2)+'\n');
  console.log(JSON.stringify({ status:receipt.status, error:receipt.error, startupMs:receipt.startupMs,
    samples:receipt.samples.length, shutdown:receipt.shutdown, minAvailableRamGiB:minAvailableRamBytes/2**30 }));
  if (receipt.status !== 'PASS_LOCAL_GENERATION_AND_WAV_DELIVERY_ONLY') process.exitCode = 1;
}
