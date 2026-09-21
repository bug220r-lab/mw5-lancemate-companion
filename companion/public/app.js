'use strict';
const token = location.hash.slice(1); let current = null, pollTimer = null, settingsDirty = false;
let playback = null, playbackEpoch = 0, requestSequence = 0;
const $ = id => document.getElementById(id);
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
  if (models.starting || models.reply?.status === 'GENERATING' || models.audio?.status === 'SYNTHESIZING' || data.missionSpeech?.status === 'PREPARED') pollTimer = setTimeout(() => api(), 750);
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
    actionEvidence: data.control.ledger, missionSpeech: data.missionSpeech, integration: data.integration }, null, 2);
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
$('modelsStart').onclick = () => api({ type: 'models_start' });
$('slowPreview').onchange = () => api({ type: 'preview_timing', allowSlow: $('slowPreview').checked });
$('modelsStop').onclick = () => api({ type: 'models_stop' });
$('interrupt').onclick = () => api({ type: 'interrupt' });
$('conversation').onsubmit = event => { event.preventDefault(); api({ type: 'converse', actorId: $('speaker').value, text: $('utterance').value }); };
$('synthesize').onclick = () => api({ type: 'synthesize_reply' });
$('listen').onclick = async () => {
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
