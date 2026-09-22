'use strict';
const token = location.hash.slice(1); let current = null, pollTimer = null, settingsDirty = false;
let playback = null, playbackEpoch = 0, requestSequence = 0;
const $ = id => document.getElementById(id);
let microphoneJob = null, microphoneEpoch = 0, microphoneStatus = 'Microphone idle.', holdSource = null;
const recorder = typeof MW5Microphone === 'undefined' ? null : MW5Microphone.createRecorder({
  onStatus: status => {
    if (status !== 'CLEANUP_COMPLETE') microphoneStatus = ({ PERMISSION: 'Waiting for microphone permission. Keep holding; release cancels.',
      RECORDING: 'Recording locally. Release to transcribe (15 seconds maximum).',
      RELEASED: 'Microphone released. Uploading for local transcription.',
      CANCELLED: 'Recording cancelled.', FAILED: 'Recording failed.' })[status] || status;
    renderMicrophone(current);
  },
  onAudio: (id, wav) => { holdSource = null; uploadRecognition(id, wav); },
  onCancel: (id, reason) => { if (microphoneJob?.id === id) cancelMicrophone(reason || 'Recording cancelled.'); },
  onError: message => { if (recorder?.blocked) cancelMicrophone(message); $('error').textContent = message; }
});
function invalidatesMicrophone(action) {
  return action && (['demo', 'models_stop', 'recognition_stop', 'interrupt'].includes(action.type) ||
    (action.type === 'step' && ['pause', 'possession'].includes(action.event)) ||
    (action.type === 'settings' && action.settings.micMuted));
}
function cancelMicrophone(reason = 'Recording cancelled.') {
  const job = microphoneJob; microphoneJob = null; ++microphoneEpoch; holdSource = null;
  job?.controller.abort(); recorder?.cancel(reason); microphoneStatus = reason;
  if (job?.id) api({ type: 'ptt_cancel', captureId: job.id });
  renderMicrophone(current);
}
function renderMicrophone(data) {
  if (!recorder || !data?.speechInput) return;
  const input = data.speechInput, capture = input.current;
  const invalid = microphoneJob?.id && (capture?.id !== microphoneJob.id || capture.session !== microphoneJob.session ||
    !['CAPTURING', 'TRANSCRIBING', 'TRANSCRIBED'].includes(capture.status) || capture.expiresAtMs <= Date.now() ||
    data.settings.micMuted || data.classification !== 'MOCK_ONLY' ||
    (recorder.active && capture.status !== 'CAPTURING'));
  if (invalid) { cancelMicrophone('Recording ended because its mission, permission or capture state changed.'); return; }
  const blocked = recorder.blocked || recorder.cleanupPending || input.pendingRecognition || input.stopping || input.cleanupPending;
  $('recognitionPrepare').disabled = data.classification !== 'MOCK_ONLY' || data.settings.micMuted || $('micMuted').checked ||
    input.preparing || blocked || !!microphoneJob;
  $('ptt').disabled = recorder.blocked || !MW5Microphone.supported() || data.classification !== 'MOCK_ONLY' || input.engine?.state !== 'READY' ||
    data.settings.micMuted || $('micMuted').checked || blocked || !!microphoneJob;
  // Keep the active button available so keyboard keyup and pointerup can release it.
  if (microphoneJob?.holding) $('ptt').disabled = false;
  $('ptt').textContent = microphoneJob?.holding ? 'Release to transcribe' : 'Hold to talk';
  $('ptt').className = microphoneJob?.holding ? 'ptt recording' : 'ptt';
  $('pttCancel').disabled = !microphoneJob && !['CAPTURING', 'TRANSCRIBING'].includes(capture?.status);
  $('recognitionStatus').textContent = recorder.blocked ? 'Microphone shutdown unconfirmed. Close this page and check the browser microphone indicator before trying again.' :
    recorder.cleanupPending ? 'Microphone tracks stopped. Waiting for the previous audio context to close before another capture.' :
    input.preparing ? 'Preparing local recognition; microphone remains off.' :
      `${input.engine?.state || 'Unavailable'} · ${microphoneStatus}${input.lastError || input.engine?.lastError || capture?.error ? ` · ${input.lastError || input.engine?.lastError || capture.error}` : ''}`;
  const hasText = capture?.status === 'TRANSCRIBED' && capture.expiresAtMs > Date.now() && typeof capture.text === 'string';
  $('recognizedText').textContent = hasText ? capture.text : 'No current transcript.';
  $('copyTranscript').disabled = !hasText;
}
async function beginMicrophone(source) {
  if (!recorder || microphoneJob || $('ptt').disabled) return;
  cancelPlayback(); holdSource = source;
  const job = { epoch: ++microphoneEpoch, holding: true, id: null, controller: new AbortController() };
  microphoneJob = job; microphoneStatus = 'Reserving a short recording window.'; renderMicrophone(current);
  const data = await api({ type: 'ptt_begin' }), capture = data?.speechInput?.current;
  if (microphoneJob !== job || job.epoch !== microphoneEpoch || !job.holding) {
    if (capture?.id && capture.status === 'CAPTURING') api({ type: 'ptt_cancel', captureId: capture.id });
    return;
  }
  if (!capture || capture.status !== 'CAPTURING' || capture.expiresAtMs <= Date.now()) {
    cancelMicrophone('Microphone capture could not begin. Prepare recognition and hold again.'); return;
  }
  job.id = capture.id; job.session = capture.session;
  cancelPlayback();
  await recorder.start({ id: job.id, expiresAtMs: capture.expiresAtMs });
}
function releaseMicrophone() {
  holdSource = null;
  if (!microphoneJob?.holding) return;
  microphoneJob.holding = false;
  if (!microphoneJob.id || !recorder?.active) cancelMicrophone('Released before microphone was ready.');
  else recorder.release();
}
async function uploadRecognition(id, wav) {
  const job = microphoneJob;
  if (!job || job.id !== id || job.epoch !== microphoneEpoch) return;
  job.holding = false;
  const eligible = () => microphoneJob === job && !job.controller.signal.aborted && job.epoch === microphoneEpoch;
  renderMicrophone(current);
  try {
    const response = await fetch(`/api/recognition/${encodeURIComponent(id)}`, { method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'audio/wav' }, body: wav, signal: job.controller.signal });
    const data = await response.json(); if (!eligible()) return;
    if (!response.ok) throw new Error(data.error || 'Local recognition failed.');
    microphoneJob = null; microphoneStatus = 'Transcription finished. Review the untrusted text before using it.';
    // Request fresh state so an upload response cannot replace newer lifecycle state.
    await api();
  } catch (error) {
    if (!eligible()) return;
    cancelMicrophone('Local transcription cancelled or failed.'); $('error').textContent = error.message;
  }
}
function cancelPlayback() {
  ++playbackEpoch; const old = playback; playback = null;
  old?.controller.abort(); old?.audio?.pause(); if (old?.url) URL.revokeObjectURL(old.url);
}
function invalidatesPlayback(action) {
  return action && (['demo','models_stop','interrupt','converse','synthesize_reply','radio_complete','preview_timing'].includes(action.type) ||
    (action.type === 'step' && ['pause','possession'].includes(action.event)) ||
    (action.type === 'settings' && action.settings.speechMuted));
}
async function api(action) {
  if (invalidatesPlayback(action)) cancelPlayback();
  if (invalidatesMicrophone(action)) cancelMicrophone('Recording interrupted.');
  const sequence = ++requestSequence;
  $('error').textContent = '';
  try {
    const response = await fetch(action ? '/api/action' : '/api/state', { method: action ? 'POST' : 'GET',
      headers: { Authorization: `Bearer ${token}`, ...(action ? { 'Content-Type': 'application/json' } : {}) },
      body: action ? JSON.stringify(action) : undefined });
    const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Request failed');
    if (sequence === requestSequence) render(data); return data;
  } catch (error) { $('error').textContent = error.message; }
}
function node(tag, text, cls) { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (cls) n.className = cls; return n; }
function render(data) {
  current = data; $('mode').textContent = data.classification;
  const models = data.localModels;
  $('slowPreview').checked = models.previewDeadlineMs === 10000;
  $('modelStatus').textContent = `${models.language.state} · Voice: ${models.speech.state}${models.error ? ` · ${models.error}` : ''}`;
  $('modelsStart').disabled = models.starting;
  $('askPilot').disabled = data.classification !== 'MOCK_ONLY' || models.language.state !== 'READY' || models.reply?.status === 'GENERATING';
  $('reply').textContent = models.reply?.text ? `${models.reply.speakerId}: ${models.reply.text} (generated; facts unverified)` :
    models.reply ? `${models.reply.status}${models.reply.reason ? ` · ${models.reply.reason}` : ''}` : 'No generated reply.';
  $('synthesize').disabled = models.reply?.status !== 'GENERATED' || models.speech.state !== 'READY' || models.audio?.status === 'SYNTHESIZING';
  $('listen').disabled = models.audio?.status !== 'READY';
  $('voiceStatus').textContent = models.audio ? `${models.audio.status} · ${models.audio.voiceId}${models.audio.error ? ` · ${models.audio.error}` : ''}` : 'No voice preview.';
  clearTimeout(pollTimer);
  if (models.starting || models.reply?.status === 'GENERATING' || models.audio?.status === 'SYNTHESIZING' || data.missionSpeech?.status === 'PREPARED' ||
      data.speechInput?.preparing || ['CAPTURING', 'TRANSCRIBING', 'TRANSCRIBED'].includes(data.speechInput?.current?.status)) pollTimer = setTimeout(() => api(), 750);
  if (playback && (models.audio?.id !== playback.id || models.reply?.id !== playback.replyId ||
      models.reply?.session !== playback.session || data.settings.speechMuted ||
      (playback.audio && data.radio.playing?.lineId !== playback.id))) cancelPlayback();
  $('clock').textContent = `Recorded simulation time: ${(data.clockMs / 1000).toFixed(1)}s`;
  $('arm').disabled = data.classification !== 'MOCK_ONLY'; $('queue').disabled = !data.control.armed;
  $('demo').textContent = data.classification === 'MOCK_ONLY' ? 'Reset synthetic mission' : 'Start synthetic mission';
  if (!settingsDirty) {
  for (const k of ['micMuted', 'speechMuted', 'quiet']) $(k).checked = data.settings[k];
  $('pilots').replaceChildren();
  const titles = ['The edge', 'The tactician', 'The scout'];
  const descriptions = ['Dry wit. Loyal under pressure.', 'Composed, deliberate and precise.', 'Energetic, observant and quick to report.'];
  data.settings.pilots.forEach((p, i) => {
    const card = node('article', undefined, 'pilot'), head = node('div', undefined, 'head'), body = node('div', undefined, 'body');
    head.append(node('p', `LANCEMATE ${i + 1} · ${p.id.toUpperCase()}`, 'eyebrow'), node('h2', p.callsign || titles[i]), node('div', descriptions[i]));
    const recommendation = data.control.recommendations.find(r => r.actorId === p.id);
    body.append(node('div', recommendation?.action || 'AWAITING OBSERVATION', 'decision'),
      node('p', recommendation ? `${recommendation.reason}${recommendation.targetId ? ` · ${recommendation.targetId}` : ''}` : 'No live game connection. Start a synthetic mission to inspect this pilot.', 'reason'));
    const modeLabel = node('label', 'Pilot mode preference'), select = node('select'); select.id = `mode-${p.id}`;
    for (const [value, label, disabled] of [['NATIVE','Native AI / simulation disabled'], ['ADVISORY','Advisory / simulation eligible'],['TACTICAL','Tactical autonomy — unavailable',true],['DIRECT','Direct pilot — unavailable',true]]) {
      const option = node('option', label); option.value = value; option.disabled = !!disabled; select.append(option);
    }
    select.value = p.mode; modeLabel.append(select);
    const label = node('label', 'Callsign (optional)'), input = node('input'); input.id = `callsign-${p.id}`; input.maxLength = 64; input.value = p.callsign || ''; input.placeholder = 'Unset'; label.append(input);
    const voiceLabel = node('label', 'Local voice ID (optional)'), voice = node('input'); voice.id = `voice-${p.id}`; voice.maxLength = 64; voice.value = p.voice || ''; voice.placeholder = 'Unset'; voiceLabel.append(voice);
    body.append(modeLabel, label, voiceLabel);
    const events = node('div', undefined, 'events');
    for (const [event, label] of [['hold','Human hold'],['release','Release hold'],['damage','Damage'],['possession','Take possession'],['pause','Pause'],['resume','Resume']]) {
      const b = node('button', label); b.disabled = data.classification !== 'MOCK_ONLY'; b.onclick = () => api({ type: 'step', event, actorId: p.id }); events.append(b);
    }
    const radio = node('button', 'Radio text preview'); radio.disabled = data.classification !== 'MOCK_ONLY'; radio.onclick = () => api({ type: 'radio', actorId: p.id }); events.append(radio);
    const status = node('button', 'Action status'); status.disabled = data.classification !== 'MOCK_ONLY'; status.onclick = () => api({ type: 'mission_status', actorId: p.id }); events.append(status);
    body.append(events); card.append(head, body); $('pilots').append(card);
  });
  }
  $('radio').textContent = data.radio.playing ? `${data.radio.playing.speakerId}: ${data.radio.playing.text} (${data.radio.playing.lineId === models.audio?.id ? 'generated preview; facts unverified' : 'authored text; no audio'})` :
    data.missionSpeech?.status === 'PREPARED' ? `${data.missionSpeech.request.speakerId}: ${data.missionSpeech.text} (authored status; text only)` : 'No speaker.';
  $('complete').disabled = !data.radio.playing;
  $('result').textContent = JSON.stringify({ last: data.last, capabilities: data.control.capabilities, pending: data.control.pending,
    actionEvidence: data.control.ledger, missionSpeech: data.missionSpeech, speechInput: data.speechInput, integration: data.integration }, null, 2);
  renderMicrophone(data);
}
$('demo').onclick = () => api({ type: 'demo' }); $('arm').onclick = () => api({ type: 'arm' });
$('queue').onclick = () => api({ type: 'queue' }); $('disarm').onclick = () => api({ type: 'disarm' });
$('complete').onclick = () => api({ type: 'radio_complete', lineId: current.radio.playing?.lineId });
$('command').onsubmit = event => { event.preventDefault(); api({ type: 'command', text: $('transcript').value }); };
$('save').onclick = () => { const settings = structuredClone(current.settings);
  for (const k of ['micMuted', 'speechMuted', 'quiet']) settings[k] = $(k).checked;
  for (const p of settings.pilots) { p.mode = $(`mode-${p.id}`).value; p.callsign = $(`callsign-${p.id}`).value || null; p.voice = $(`voice-${p.id}`).value || null; }
  settingsDirty = false; api({ type: 'settings', settings }); };
$('pilots').addEventListener('input', () => { settingsDirty = true; });
for (const k of ['micMuted', 'speechMuted', 'quiet']) $(k).addEventListener('change', () => { settingsDirty = true; });
if (recorder) {
  $('micMuted').addEventListener('change', () => {
    settingsDirty = true;
    if ($('micMuted').checked) cancelMicrophone('Microphone muted.');
    renderMicrophone(current);
  });
  $('recognitionPrepare').onclick = () => api({ type: 'recognition_prepare' });
  $('recognitionStop').onclick = () => api({ type: 'recognition_stop' });
  $('pttCancel').onclick = () => {
    const id = current?.speechInput?.current?.id, hadJob = !!microphoneJob;
    cancelMicrophone(); if (!hadJob && id) api({ type: 'ptt_cancel', captureId: id });
  };
  $('ptt').addEventListener('pointerdown', event => {
    if (event.button !== 0 || holdSource) return;
    event.preventDefault(); $('ptt').setPointerCapture?.(event.pointerId); beginMicrophone(`pointer:${event.pointerId}`);
  });
  $('ptt').addEventListener('pointerup', event => { if (holdSource === `pointer:${event.pointerId}`) releaseMicrophone(); });
  $('ptt').addEventListener('pointercancel', () => cancelMicrophone('Pointer capture cancelled.'));
  $('ptt').addEventListener('lostpointercapture', () => { if (microphoneJob?.holding) cancelMicrophone('Pointer capture lost.'); });
  $('ptt').addEventListener('keydown', event => {
    if (![' ', 'Enter'].includes(event.key)) return;
    event.preventDefault(); if (!event.repeat && !holdSource) beginMicrophone(`key:${event.key}`);
  });
  $('ptt').addEventListener('keyup', event => {
    if (![' ', 'Enter'].includes(event.key)) return;
    event.preventDefault(); if (holdSource === `key:${event.key}`) releaseMicrophone();
  });
  $('ptt').addEventListener('blur', () => { if (microphoneJob?.holding) cancelMicrophone('Hold control lost focus.'); });
  $('copyTranscript').onclick = () => {
    const capture = current?.speechInput?.current;
    if (capture?.status !== 'TRANSCRIBED' || capture.expiresAtMs <= Date.now() || typeof capture.text !== 'string') return;
    $('transcript').value = capture.text.slice(0, 300); $('transcript').focus();
    microphoneStatus = capture.text.length > 300 ? 'First 300 characters copied. Review them, then click Parse.' : 'Copied. Review the command field, then click Parse.';
    renderMicrophone(current);
  };
  window.addEventListener('blur', () => cancelMicrophone('Window lost focus. Hold again to record.'));
  window.addEventListener('pagehide', () => cancelMicrophone('Page closed.'));
  document.addEventListener?.('visibilitychange', () => { if (document.hidden) cancelMicrophone('Page hidden. Hold again to record.'); });
}
$('modelsStart').onclick = () => api({ type: 'models_start' });
$('slowPreview').onchange = () => api({ type: 'preview_timing', allowSlow: $('slowPreview').checked });
$('modelsStop').onclick = () => api({ type: 'models_stop' });
$('interrupt').onclick = () => api({ type: 'interrupt' });
$('conversation').onsubmit = event => { event.preventDefault(); api({ type: 'converse', actorId: $('speaker').value, text: $('utterance').value }); };
$('synthesize').onclick = () => api({ type: 'synthesize_reply' });
$('listen').onclick = async () => {
  if (microphoneJob || recorder?.active) return;
  const id = current?.localModels.audio?.id, reply = current?.localModels.reply;
  if (!id || !reply || current.localModels.audio.status !== 'READY') return;
  cancelPlayback();
  const job = { id, replyId: reply.id, session: reply.session, epoch: playbackEpoch, controller: new AbortController() };
  playback = job; const eligible = () => playback === job && job.epoch === playbackEpoch && !job.controller.signal.aborted;
  try {
    const options = { headers: { Authorization: `Bearer ${token}` }, signal: job.controller.signal };
    const response = await fetch(`/api/audio/${id}`, options);
    if (!response.ok) throw new Error((await response.json()).error);
    const blob = await response.blob(); if (!eligible()) return;
    const sequence = ++requestSequence, fresh = await fetch('/api/state', options);
    if (!fresh.ok) throw new Error('Playback state unavailable.');
    const data = await fresh.json(); if (!eligible() || sequence !== requestSequence) return;
    if (data.localModels.audio?.id !== id || data.localModels.reply?.id !== job.replyId ||
        data.localModels.reply?.session !== job.session || data.localModels.reply?.expiresAtMs <= Date.now() ||
        data.settings.speechMuted || data.radio.playing?.lineId !== id) throw new Error('Voice preview expired or interrupted.');
    render(data); if (!eligible()) return;
    job.url = URL.createObjectURL(blob); const audio = new Audio(job.url); job.audio = audio;
    audio.onended = () => { if (!eligible()) return; cancelPlayback(); api({ type: 'radio_complete', lineId: id }); };
    audio.onerror = () => { if (!eligible()) return; cancelPlayback(); api({ type: 'radio_complete', lineId: id }); $('error').textContent = 'Audio playback failed.'; };
    await audio.play(); if (!eligible()) audio.pause();
  } catch (error) {
    if (!eligible()) return;
    cancelPlayback(); api({ type: 'radio_complete', lineId: id }); $('error').textContent = error.message;
  }
};
window.addEventListener('pagehide', cancelPlayback);
$('replay').onchange = async () => { const file = $('replay').files[0]; if (!file) return;
  try { if (file.size > 200000) throw new Error('Replay must be under 200 KB.');
    const frames = JSON.parse(await file.text()); const result = await api({ type: 'replay', frames, allowSynthetic: $('synthetic').checked });
    $('replayStatus').textContent = result ? 'Replay evaluated. Open the decision record below.' : 'Replay rejected.';
  } catch (error) { $('error').textContent = error.message; } };
api();
