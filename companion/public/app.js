'use strict';
const token = location.hash.slice(1); let current = null;
const $ = id => document.getElementById(id);
async function api(action) {
  $('error').textContent = '';
  try {
    const response = await fetch(action ? '/api/action' : '/api/state', { method: action ? 'POST' : 'GET',
      headers: { Authorization: `Bearer ${token}`, ...(action ? { 'Content-Type': 'application/json' } : {}) },
      body: action ? JSON.stringify(action) : undefined });
    const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Request failed');
    render(data); return data;
  } catch (error) { $('error').textContent = error.message; }
}
function node(tag, text, cls) { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (cls) n.className = cls; return n; }
function render(data) {
  current = data; $('mode').textContent = data.classification;
  $('clock').textContent = `Recorded simulation time: ${(data.clockMs / 1000).toFixed(1)}s`;
  $('arm').disabled = data.classification !== 'MOCK_ONLY'; $('queue').disabled = !data.control.armed;
  $('demo').textContent = data.classification === 'MOCK_ONLY' ? 'Reset synthetic mission' : 'Start synthetic mission';
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
    const voiceLabel = node('label', 'Voice preference (engine pending)'), voice = node('input'); voice.id = `voice-${p.id}`; voice.maxLength = 64; voice.value = p.voice || ''; voice.placeholder = 'Unset'; voiceLabel.append(voice);
    body.append(modeLabel, label, voiceLabel);
    const events = node('div', undefined, 'events');
    for (const [event, label] of [['hold','Human hold'],['release','Release hold'],['damage','Damage'],['possession','Take possession'],['pause','Pause'],['resume','Resume']]) {
      const b = node('button', label); b.disabled = data.classification !== 'MOCK_ONLY'; b.onclick = () => api({ type: 'step', event, actorId: p.id }); events.append(b);
    }
    const radio = node('button', 'Radio text preview'); radio.disabled = data.classification !== 'MOCK_ONLY'; radio.onclick = () => api({ type: 'radio', actorId: p.id }); events.append(radio);
    body.append(events); card.append(head, body); $('pilots').append(card);
  });
  $('radio').textContent = data.radio.playing ? `${data.radio.playing.speakerId}: ${data.radio.playing.text} (authored text; no audio)` : 'No speaker.';
  $('complete').disabled = !data.radio.playing;
  $('result').textContent = JSON.stringify({ last: data.last, capabilities: data.control.capabilities, pending: data.control.pending,
    actionEvidence: data.control.ledger, integration: data.integration }, null, 2);
}
$('demo').onclick = () => api({ type: 'demo' }); $('arm').onclick = () => api({ type: 'arm' });
$('queue').onclick = () => api({ type: 'queue' }); $('disarm').onclick = () => api({ type: 'disarm' });
$('complete').onclick = () => api({ type: 'radio_complete', lineId: current.radio.playing?.lineId });
$('command').onsubmit = event => { event.preventDefault(); api({ type: 'command', text: $('transcript').value }); };
$('save').onclick = () => { const settings = structuredClone(current.settings);
  for (const k of ['micMuted', 'speechMuted', 'quiet']) settings[k] = $(k).checked;
  for (const p of settings.pilots) { p.mode = $(`mode-${p.id}`).value; p.callsign = $(`callsign-${p.id}`).value || null; p.voice = $(`voice-${p.id}`).value || null; }
  api({ type: 'settings', settings }); };
$('replay').onchange = async () => { const file = $('replay').files[0]; if (!file) return;
  try { if (file.size > 200000) throw new Error('Replay must be under 200 KB.');
    const frames = JSON.parse(await file.text()); const result = await api({ type: 'replay', frames, allowSynthetic: $('synthetic').checked });
    $('replayStatus').textContent = result ? 'Replay evaluated. Open the decision record below.' : 'Replay rejected.';
  } catch (error) { $('error').textContent = error.message; } };
api();
