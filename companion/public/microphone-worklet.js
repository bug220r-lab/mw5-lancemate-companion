'use strict';
// Causal Blackman-windowed sinc low-pass, followed by resampling. Increase
// the tap count with input rate (65–257) to preserve the anti-alias bandwidth.
// Input channels are averaged to mono. The worklet owns only a fixed history
// and 256-sample block; the main thread caps PCM storage at 240,000 samples.
class MW5PttPcm extends AudioWorkletProcessor {
  constructor() {
    super(); this.history = new Float64Array(512); this.taps = new Float64Array(64 * Math.ceil(sampleRate / 48000) + 1);
    this.cursor = 0; this.phase = 0; this.total = 0; this.used = 0; this.block = new Int16Array(256);
    const cutoff = 0.45 * Math.min(1, 16000 / sampleRate); let sum = 0;
    const last = this.taps.length - 1;
    for (let i = 0; i <= last; i++) {
      const x = i - last / 2, sinc = x === 0 ? 2 * cutoff : Math.sin(2 * Math.PI * cutoff * x) / (Math.PI * x);
      const window = 0.42 - 0.5 * Math.cos(2 * Math.PI * i / last) + 0.08 * Math.cos(4 * Math.PI * i / last);
      this.taps[i] = sinc * window; sum += this.taps[i];
    }
    for (let i = 0; i <= last; i++) this.taps[i] /= sum;
  }
  send(limit) {
    const samples = this.used === 256 ? this.block : this.block.slice(0, this.used);
    this.port.postMessage({ type: 'pcm', samples, limit }, [samples.buffer]);
    this.block = new Int16Array(256); this.used = 0;
  }
  process(inputs, outputs) {
    for (const output of outputs) for (const channel of output) channel.fill(0);
    if (this.total >= 240000) return false;
    const channels = inputs[0]; if (!channels?.length) return true;
    const count = Math.min(channels.length, 32);
    for (let i = 0; i < channels[0].length; i++) {
      let mono = 0;
      for (let c = 0; c < count; c++) { const sample = channels[c][i]; mono += Number.isFinite(sample) ? sample / count : 0; }
      this.history[this.cursor] = mono;
      this.phase += 16000;
      if (this.phase >= sampleRate) {
        this.phase -= sampleRate;
        let value = 0;
        for (let t = 0; t < this.taps.length; t++) value += this.taps[t] * this.history[(this.cursor - t + 512) % 512];
        value = Math.max(-1, Math.min(1, value));
        this.block[this.used++] = Math.round(value * (value < 0 ? 32768 : 32767)); this.total++;
        if (this.used === 256 || this.total === 240000) this.send(this.total === 240000);
        if (this.total === 240000) return false;
      }
      this.cursor = (this.cursor + 1) % 512;
    }
    // Deliver the tail every render quantum so release need not keep tracks or
    // the context alive waiting for an asynchronous flush acknowledgement.
    if (this.used) this.send(false);
    return true;
  }
}
registerProcessor('mw5-ptt-pcm', MW5PttPcm);
