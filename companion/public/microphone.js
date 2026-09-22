'use strict';
// Browser-only capture. No permission is requested until start() is called by
// the hold control. Fixed PCM storage; tracks/graph are stopped synchronously
// on release/cancel and context closure is tracked until it settles. Late
// permission or worklet promises cannot restart a cancelled capture.
(() => {
  const RATE = 16000, MAX_SAMPLES = RATE * 15, MIN_SAMPLES = RATE / 10;
  const supported = () => !!(globalThis.navigator?.mediaDevices?.getUserMedia &&
    globalThis.AudioContext && globalThis.AudioWorkletNode);
  function wave(samples, length) {
    if (!Number.isInteger(length) || length < MIN_SAMPLES || length > MAX_SAMPLES || length > samples.length)
      throw new Error('Hold for at least 0.1 seconds (maximum 15 seconds).');
    const buffer = new ArrayBuffer(44 + length * 2), view = new DataView(buffer);
    const ascii = (at, text) => { for (let i = 0; i < text.length; i++) view.setUint8(at + i, text.charCodeAt(i)); };
    ascii(0, 'RIFF'); view.setUint32(4, buffer.byteLength - 8, true); ascii(8, 'WAVE'); ascii(12, 'fmt ');
    view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
    view.setUint32(24, RATE, true); view.setUint32(28, RATE * 2, true); view.setUint16(32, 2, true);
    view.setUint16(34, 16, true); ascii(36, 'data'); view.setUint32(40, length * 2, true);
    for (let i = 0; i < length; i++) view.setInt16(44 + i * 2, samples[i], true);
    return buffer;
  }
  function createRecorder({ onStatus = () => {}, onAudio = () => {}, onError = () => {}, onCancel = () => {} } = {}) {
    let active = null, cleanupBlocked = false, pendingClosures = 0;
    const owns = job => active === job && !job.closed;
    function shutdownUnconfirmed() {
      cleanupBlocked = true;
      onError('Microphone shutdown could not be confirmed. Close this page and check the browser microphone indicator before trying again.');
    }
    function stopTracks(stream) {
      let complete = true, tracks;
      try { tracks = stream?.getTracks() ?? []; } catch { return false; }
      for (const track of tracks) { try { track.stop(); } catch { complete = false; } }
      return complete;
    }
    function cleanup(job) {
      job.closed = true; clearTimeout(job.timer); clearTimeout(job.leaseTimer);
      let complete = stopTracks(job.stream); job.stream = null;
      for (const item of [job.source, job.node, job.silent]) { try { item?.disconnect(); } catch { complete = false; } }
      if (job.node) {
        try { job.node.port.onmessage = null; } catch { complete = false; }
        try { job.node.port.close(); } catch { complete = false; }
      }
      if (job.context) {
        try {
          const closing = job.context.close(); ++pendingClosures;
          Promise.resolve(closing).then(() => { --pendingClosures; onStatus('CLEANUP_COMPLETE'); }, () => {
            --pendingClosures; shutdownUnconfirmed(); onStatus('CLEANUP_COMPLETE');
          });
        } catch { complete = false; }
      }
      if (!complete) shutdownUnconfirmed();
      return complete;
    }
    function cancel(reason = 'Recording cancelled.') {
      const job = active; if (!job) return;
      active = null; const complete = cleanup(job); job.samples = null;
      onStatus(complete ? 'CANCELLED' : 'FAILED'); onCancel(job.id, reason);
    }
    function fail(job, error) {
      if (!owns(job)) return;
      active = null; cleanup(job); job.samples = null;
      onStatus('FAILED'); onCancel(job.id, error.message); onError(error.message);
    }
    function release() {
      const job = active; if (!job) return;
      if (job.status !== 'RECORDING') { cancel('Released before microphone was ready.'); return; }
      if (Date.now() >= job.expiresAtMs) { cancel('Capture lease expired. Hold again.'); return; }
      active = null;
      if (!cleanup(job)) { job.samples = null; onStatus('FAILED'); onCancel(job.id, 'Microphone shutdown unconfirmed.'); return; }
      try { const buffer = wave(job.samples, job.length); job.samples = null; onStatus('RELEASED'); onAudio(job.id, buffer); }
      catch (error) { job.samples = null; onStatus('FAILED'); onCancel(job.id, error.message); onError(error.message); }
    }
    async function start({ id, expiresAtMs }) {
      if (active) return false;
      if (cleanupBlocked) { shutdownUnconfirmed(); onCancel(id, 'Microphone shutdown unconfirmed.'); return false; }
      if (pendingClosures) { onCancel(id, 'Previous microphone context is still closing.'); return false; }
      if (!supported()) { onError('This browser does not support secure microphone capture with AudioWorklet.'); onCancel(id); return false; }
      if (typeof id !== 'string' || !Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) { onCancel(id); return false; }
      const job = { id, expiresAtMs, samples: new Int16Array(MAX_SAMPLES), length: 0, status: 'PERMISSION', closed: false };
      active = job; onStatus('PERMISSION');
      job.leaseTimer = setTimeout(() => { if (owns(job)) cancel('Capture lease expired. Hold again.'); }, Math.min(20000, expiresAtMs - Date.now()));
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: { ideal: 1 },
          echoCancellation: true, noiseSuppression: true, autoGainControl: false }, video: false });
        if (!owns(job)) { if (!stopTracks(stream)) shutdownUnconfirmed(); return false; }
        job.stream = stream;
        if (Date.now() >= job.expiresAtMs) { cancel('Capture lease expired. Hold again.'); return false; }
        for (const track of stream.getTracks()) track.addEventListener?.('ended', () => { if (owns(job)) cancel('Microphone disconnected.'); });
        const context = new AudioContext(); job.context = context;
        if (!Number.isFinite(context.sampleRate) || context.sampleRate < RATE || context.sampleRate > 192000)
          throw new Error('Unsupported microphone sample rate.');
        await context.audioWorklet.addModule('/microphone-worklet.js');
        if (!owns(job)) return false;
        if (Date.now() >= job.expiresAtMs) { cancel('Capture lease expired. Hold again.'); return false; }
        job.source = context.createMediaStreamSource(stream);
        job.node = new AudioWorkletNode(context, 'mw5-ptt-pcm', { numberOfInputs: 1, numberOfOutputs: 1,
          outputChannelCount: [1], channelCountMode: 'max' });
        job.node.onprocessorerror = () => fail(job, new Error('Microphone processing failed.'));
        job.node.port.onmessage = event => {
          if (!owns(job)) return;
          if (Date.now() >= job.expiresAtMs) { cancel('Capture lease expired. Hold again.'); return; }
          const message = event.data;
          if (message?.type !== 'pcm' || !(message.samples instanceof Int16Array) || message.samples.length > 256) {
            fail(job, new Error('Invalid microphone audio block.')); return;
          }
          const count = Math.min(message.samples.length, MAX_SAMPLES - job.length);
          job.samples.set(message.samples.subarray(0, count), job.length); job.length += count;
          if (job.length === MAX_SAMPLES || message.limit === true) release();
        };
        job.silent = context.createGain(); job.silent.gain.value = 0;
        job.source.connect(job.node); job.node.connect(job.silent); job.silent.connect(context.destination);
        await context.resume();
        if (!owns(job)) return false;
        if (Date.now() >= job.expiresAtMs) { cancel('Capture lease expired. Hold again.'); return false; }
        job.status = 'RECORDING'; onStatus('RECORDING');
        job.timer = setTimeout(() => { if (owns(job)) release(); }, 15000);
        return true;
      } catch (error) { fail(job, error); return false; }
    }
    return Object.freeze({ start, release, cancel, get active() { return !!active; }, get blocked() { return cleanupBlocked; },
      get cleanupPending() { return pendingClosures > 0; } });
  }
  globalThis.MW5Microphone = Object.freeze({ supported, createRecorder });
})();
