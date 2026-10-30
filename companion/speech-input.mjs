// Project-only PTT transcription preview. No microphone, model, game or commands.
import { randomUUID } from 'node:crypto';

const CAPTURE_MS = 20000, RECOGNITION_MS = 10000, TEXT_MS = 5000, STOP_WAIT_MS = 3000;
const fault = code => Object.assign(new Error(code), { code });
const idOk = value => typeof value === 'string' && /^[A-Za-z0-9_.:-]{1,128}$/.test(value);
const record = value => value && Object.getPrototypeOf(value) === Object.prototype;
const data = (object, key) => { const d = Object.getOwnPropertyDescriptor(object, key); return d && Object.hasOwn(d, 'value') ? d.value : undefined; };
const terminal = capture => capture && ['FAILED', 'CANCELLED'].includes(capture.status);
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const knownCode = error => ['SPEECH_INPUT_CLOCK_INVALID', 'SPEECH_INPUT_CONTEXT_INVALID', 'SPEECH_INPUT_DISPOSED',
  'SPEECH_INPUT_CONTEXT_CHANGED', 'SPEECH_INPUT_CAPTURE_EXPIRED', 'SPEECH_INPUT_RECOGNITION_TIMEOUT',
  'SPEECH_INPUT_TEXT_EXPIRED', 'SPEECH_INPUT_PREPARE_CANCELLED', 'SPEECH_INPUT_ENGINE_NOT_READY'].includes(error?.code) ? error.code : null;

function waveCopy(wav) {
  if (!Buffer.isBuffer(wav) || wav.length < 3244 || wav.length > 480044) throw fault('SPEECH_INPUT_INVALID_WAV');
  const out = Buffer.from(wav);
  if (out.toString('ascii', 0, 4) !== 'RIFF' || out.readUInt32LE(4) !== out.length - 8 ||
      out.toString('ascii', 8, 16) !== 'WAVEfmt ' || out.readUInt32LE(16) !== 16 ||
      out.readUInt16LE(20) !== 1 || out.readUInt16LE(22) !== 1 || out.readUInt32LE(24) !== 16000 ||
      out.readUInt32LE(28) !== 32000 || out.readUInt16LE(32) !== 2 || out.readUInt16LE(34) !== 16 ||
      out.toString('ascii', 36, 40) !== 'data' || out.readUInt32LE(40) !== out.length - 44 || (out.length - 44) % 2)
    throw fault('SPEECH_INPUT_INVALID_WAV');
  return out;
}

/** Trusted functions are injected by the offline workbench. None are called at
 * construction. Native ASR is only reached by explicit prepare/submit calls.
 * Public cancellation can settle promptly while underlying recognition/stop
 * ownership stays occupied. No timeout is evidence that a worker stopped.
 */
export function createSpeechInput({ recognizer, getContext, now = Date.now,
  onInterrupt = () => {}, onPttChange = () => {} } = {}) {
  if (!recognizer || ['start', 'transcribe', 'stop', 'dispose', 'status'].some(k => typeof recognizer[k] !== 'function') ||
      [getContext, now, onInterrupt, onPttChange].some(fn => typeof fn !== 'function')) throw fault('SPEECH_INPUT_CONFIGURATION');
  let current = null, prepared = false, preparedFingerprint = null, preparing = null, recognition = null, stopping = null;
  let engineDisposal = null, disposalFailed = false;
  let lastError = null;
  let disposed = false, epoch = 0, lastNow = -Infinity, clockFault = false, ptt = false;

  function time() {
    let t;
    try { t = now(); } catch { t = NaN; }
    if (!Number.isSafeInteger(t) || t < 0 || t > Number.MAX_SAFE_INTEGER - 30000 || t < lastNow) clockFault = true;
    else lastNow = t;
    if (clockFault) throw fault('SPEECH_INPUT_CLOCK_INVALID');
    return t;
  }
  function context() {
    let value;
    try { value = getContext(); } catch { throw fault('SPEECH_INPUT_CONTEXT_INVALID'); }
    if (!record(value)) throw fault('SPEECH_INPUT_CONTEXT_INVALID');
    const session = data(value, 'session'), phase = data(value, 'phase'), micMuted = data(value, 'micMuted');
    const raw = data(value, 'bindings');
    if (!idOk(session) || phase !== 'active' || micMuted !== false || !Array.isArray(raw) || raw.length !== 3)
      throw fault('SPEECH_INPUT_CONTEXT_INVALID');
    const bindings = [];
    for (let index = 0; index < 3; index++) {
      const source = data(raw, String(index));
      if (!record(source)) throw fault('SPEECH_INPUT_CONTEXT_INVALID');
      const b = Object.fromEntries(['id', 'pawnId', 'generation', 'aiOwned', 'alive'].map(key => [key, data(source, key)]));
      if (!idOk(b.id) || !idOk(b.pawnId) || !Number.isSafeInteger(b.generation) || b.generation < 0 || b.aiOwned !== true || b.alive !== true)
        throw fault('SPEECH_INPUT_CONTEXT_INVALID');
      bindings.push(b);
    }
    if (new Set(bindings.map(b => b.id)).size !== 3 || new Set(bindings.map(b => b.pawnId)).size !== 3)
      throw fault('SPEECH_INPUT_CONTEXT_INVALID');
    bindings.sort((a, b) => a.id.localeCompare(b.id));
    return { session, fingerprint: JSON.stringify({ session, phase, micMuted, bindings }) };
  }
  function engine() {
    try { return structuredClone(recognizer.status()); }
    catch { return { state: 'UNAVAILABLE', busy: true, processStopConfirmed: false }; }
  }
  function engineReady() {
    const value = engine();
    if (value?.state !== 'READY' || value.busy !== false || value.cleanupPending === true ||
        value.cleanupBlocked === true || value.pendingPreflight === true) return false;
    // Resident ASR retains its worker between requests. Readiness must describe
    // that healthy ownership explicitly; it must never imply confirmed closure.
    if (value.mode === 'RESIDENT_PIPE_TRANSCRIPTION_ONLY') return value.ownsProcess === true &&
      value.processStopConfirmed === false && value.pendingPreflight === false && value.lastError === null &&
      Number.isSafeInteger(value.pid) && value.pid > 0;
    return value.ownsProcess === false && value.processStopConfirmed === true;
  }
  function clearCaptureTimer(capture) { clearTimeout(capture?.timer); if (capture) capture.timer = null; }
  function callHook(fn, value) {
    const result = fn(value);
    // These hooks must synchronously gate the shared radio. A Promise is not
    // evidence that speech was interrupted; consume rejection and fail closed.
    if (result && typeof result.then === 'function') {
      void Promise.resolve(result).catch(() => {}); throw fault('SPEECH_INPUT_HOOK_FAILED');
    }
  }
  function hookPtt(value) {
    if (ptt === value) return;
    ptt = value;
    try { callHook(onPttChange, value); } catch { throw fault('SPEECH_INPUT_HOOK_FAILED'); }
  }
  function releasePtt() { try { hookPtt(false); return true; } catch { return false; } }
  function stopEngine() {
    if (stopping) return stopping.promise;
    const work = { promise: null }; stopping = work;
    work.promise = Promise.resolve().then(() => recognizer.stop()).catch(() => null)
      .finally(() => { if (stopping === work) stopping = null; });
    return work.promise;
  }
  function settleRecognition(work) {
    if (work.settled) return;
    work.settled = true;
    work.signal?.removeEventListener('abort', work.onAbort);
    work.resolve(view());
  }
  function endCapture(capture, code, kind = 'CANCELLED') {
    if (current !== capture || terminal(capture)) return;
    clearCaptureTimer(capture); delete capture.text;
    capture.status = kind; capture.error = code;
    lastError = code;
    prepared = false; preparedFingerprint = null; ++epoch;
    if (!releasePtt()) { capture.status = 'FAILED'; capture.error = 'SPEECH_INPUT_HOOK_FAILED'; }
    if (recognition?.capture === capture) {
      recognition.abort.abort(); settleRecognition(recognition);
    }
    void stopEngine();
  }
  function invalidateInternal(code) {
    lastError = code;
    prepared = false; preparedFingerprint = null; ++epoch;
    if (preparing && !preparing.settled) {
      preparing.settled = true; preparing.reject(fault(code));
    }
    if (current && !terminal(current)) endCapture(current, code);
    else { releasePtt(); void stopEngine(); }
  }
  function validate() {
    try {
      const t = time(), c = context();
      if (disposed) throw fault('SPEECH_INPUT_DISPOSED');
      if (preparedFingerprint && c.fingerprint !== preparedFingerprint) throw fault('SPEECH_INPUT_CONTEXT_CHANGED');
      if (preparing && c.fingerprint !== preparing.fingerprint) throw fault('SPEECH_INPUT_CONTEXT_CHANGED');
      if (current && !terminal(current)) {
        if (c.fingerprint !== current.fingerprint) throw fault('SPEECH_INPUT_CONTEXT_CHANGED');
        if (t >= current.expiresAtMs) throw fault(current.status === 'CAPTURING' ? 'SPEECH_INPUT_CAPTURE_EXPIRED' :
          current.status === 'TRANSCRIBING' ? 'SPEECH_INPUT_RECOGNITION_TIMEOUT' : 'SPEECH_INPUT_TEXT_EXPIRED');
      }
      return { t, context: c };
    } catch (error) {
      const code = error?.code ?? 'SPEECH_INPUT_CONTEXT_INVALID';
      if (prepared || preparing || current && !terminal(current)) invalidateInternal(code);
      throw fault(code);
    }
  }
  function publicCapture() {
    if (!current) return null;
    const { id, session, status, expiresAtMs, text, error } = current;
    return { id, session, status, expiresAtMs, ...(text === undefined ? {} : { text }), ...(error === undefined ? {} : { error }),
      classification: 'UNTRUSTED_RECOGNITION' };
  }
  function view() {
    const snapshot = engine();
    const cleanupPending = !!preparing || !!recognition || !!stopping || !!engineDisposal ||
      snapshot?.cleanupPending === true || snapshot?.cleanupBlocked === true;
    const shutdownComplete = disposed && !prepared && !cleanupPending && !disposalFailed &&
      snapshot?.busy === false && snapshot.ownsProcess === false && snapshot.processStopConfirmed === true &&
      ['STOPPED', 'DISPOSED'].includes(snapshot.state);
    return { engine: snapshot, preparing: !!preparing, pendingRecognition: !!recognition, stopping: !!stopping,
      cleanupPending, shutdownComplete, disposed, lastError, current: publicCapture(),
      mode: 'OFFLINE_PTT_PREVIEW', dispatchable: false };
  }
  function status() { try { validate(); } catch {} return view(); }
  function prepare() {
    let checked;
    try { checked = validate(); } catch (error) { lastError = knownCode(error) ?? 'SPEECH_INPUT_CONTEXT_INVALID'; return Promise.reject(fault(lastError)); }
    if (preparing) return preparing.promise;
    if (recognition || stopping || current && ['CAPTURING', 'TRANSCRIBING'].includes(current.status))
      return Promise.reject(fault('SPEECH_INPUT_BUSY'));
    if (prepared && engineReady()) return Promise.resolve(view());
    lastError = null;
    const generation = ++epoch, work = { ...deferred(), fingerprint: checked.context.fingerprint, settled: false };
    preparing = work;
    void (async () => {
      try {
        await recognizer.start();
        const after = validate();
        if (work !== preparing || epoch !== generation || disposed || after.context.fingerprint !== work.fingerprint)
          throw fault('SPEECH_INPUT_PREPARE_CANCELLED');
        if (!engineReady()) throw fault('SPEECH_INPUT_ENGINE_NOT_READY');
        prepared = true; preparedFingerprint = work.fingerprint; lastError = null;
      } catch (error) {
        prepared = false; preparedFingerprint = null;
        if (!work.settled) { lastError = knownCode(error) ?? 'SPEECH_INPUT_PREPARE_FAILED'; work.settled = true; work.reject(fault(lastError)); }
        void stopEngine();
      } finally { if (preparing === work) preparing = null; }
      if (!work.settled) { work.settled = true; work.resolve(view()); }
    })();
    return work.promise;
  }
  function begin() {
    const { t, context: c } = validate();
    if (preparing || recognition || stopping || current && ['CAPTURING', 'TRANSCRIBING'].includes(current.status)) throw fault('SPEECH_INPUT_BUSY');
    if (!prepared || !engineReady()) throw fault('SPEECH_INPUT_NOT_PREPARED');
    clearCaptureTimer(current);
    const capture = { id: randomUUID(), session: c.session, fingerprint: c.fingerprint,
      status: 'CAPTURING', expiresAtMs: t + CAPTURE_MS };
    current = capture; lastError = null;
    try {
      callHook(onInterrupt, 'SPEECH_INPUT_PTT'); hookPtt(true); validate();
    } catch {
      endCapture(capture, 'SPEECH_INPUT_HOOK_FAILED', 'FAILED'); throw fault('SPEECH_INPUT_HOOK_FAILED');
    }
    capture.timer = setTimeout(() => endCapture(capture, 'SPEECH_INPUT_CAPTURE_EXPIRED'), CAPTURE_MS); capture.timer.unref?.();
    return view();
  }
  async function submit(captureId, wav, options = {}) {
    if (!record(options) || Reflect.ownKeys(options).some(key => key !== 'signal') ||
        Object.getOwnPropertyDescriptor(options, 'signal') && !Object.hasOwn(Object.getOwnPropertyDescriptor(options, 'signal'), 'value')) {
      if (current?.id === captureId && current.status === 'CAPTURING') endCapture(current, 'SPEECH_INPUT_INVALID_OPTIONS', 'FAILED');
      throw fault('SPEECH_INPUT_INVALID_OPTIONS');
    }
    const signal = data(options, 'signal');
    if (signal !== undefined && !(signal instanceof AbortSignal)) {
      if (current?.id === captureId && current.status === 'CAPTURING') endCapture(current, 'SPEECH_INPUT_INVALID_OPTIONS', 'FAILED');
      throw fault('SPEECH_INPUT_INVALID_OPTIONS');
    }
    validate();
    const capture = current;
    if (!capture || capture.id !== captureId || capture.status !== 'CAPTURING') throw fault('SPEECH_INPUT_CAPTURE_MISMATCH');
    if (recognition || preparing || stopping || !prepared || !engineReady()) throw fault('SPEECH_INPUT_BUSY');
    let admitted;
    try { admitted = waveCopy(wav); }
    catch (error) { endCapture(capture, error.code, 'FAILED'); throw error; }
    if (signal?.aborted) { endCapture(capture, 'SPEECH_INPUT_ABORTED'); return view(); }
    const { t } = validate(); clearCaptureTimer(capture);
    if (!releasePtt()) { endCapture(capture, 'SPEECH_INPUT_HOOK_FAILED', 'FAILED'); return view(); }
    capture.status = 'TRANSCRIBING'; capture.expiresAtMs = t + RECOGNITION_MS;
    const work = { ...deferred(), capture, abort: new AbortController(), signal, settled: false };
    recognition = work;
    work.onAbort = () => endCapture(capture, 'SPEECH_INPUT_ABORTED');
    signal?.addEventListener('abort', work.onAbort, { once: true });
    if (signal?.aborted) work.onAbort();
    capture.timer = setTimeout(() => endCapture(capture, 'SPEECH_INPUT_RECOGNITION_TIMEOUT'), RECOGNITION_MS); capture.timer.unref?.();
    void (async () => {
      try {
        validate();
        if (work !== recognition || capture !== current || capture.status !== 'TRANSCRIBING' || work.abort.signal.aborted)
          throw fault('SPEECH_INPUT_ABORTED');
        const result = await recognizer.transcribe(admitted, { signal: work.abort.signal });
        const after = validate();
        if (work !== recognition || capture !== current || capture.status !== 'TRANSCRIBING' || work.abort.signal.aborted)
          throw fault('SPEECH_INPUT_ABORTED');
        const text = result?.text;
        if (typeof text !== 'string' || !text.trim() || text.length > 2048 || Buffer.byteLength(text, 'utf8') > 4096 ||
            !text.isWellFormed() || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(text))
          throw fault('SPEECH_INPUT_RESULT_INVALID');
        clearCaptureTimer(capture); capture.status = 'TRANSCRIBED'; capture.text = text.trim(); capture.expiresAtMs = after.t + TEXT_MS;
        capture.timer = setTimeout(() => endCapture(capture, 'SPEECH_INPUT_TEXT_EXPIRED'), TEXT_MS); capture.timer.unref?.();
      } catch (error) {
        if (capture === current && !terminal(capture)) endCapture(capture,
          error?.code === 'SPEECH_INPUT_RESULT_INVALID' ? error.code : 'SPEECH_INPUT_RECOGNITION_FAILED', 'FAILED');
      } finally {
        work.signal?.removeEventListener('abort', work.onAbort);
        if (recognition === work) recognition = null;
        settleRecognition(work);
      }
    })();
    return work.promise;
  }
  function cancel(captureId, _reason = 'CANCELLED') {
    if (current?.id === captureId) endCapture(current, 'SPEECH_INPUT_CANCELLED');
    return status();
  }
  function invalidate(_reason = 'INVALIDATED') { invalidateInternal('SPEECH_INPUT_INVALIDATED'); return status(); }
  async function dispose() {
    if (!disposed) { disposed = true; invalidateInternal('SPEECH_INPUT_DISPOSED'); }
    let timer;
    const stopped = engineDisposal ? Promise.resolve() : stopEngine();
    await Promise.race([stopped, new Promise(resolve => { timer = setTimeout(resolve, STOP_WAIT_MS); })]); clearTimeout(timer);
    // The coordinator never assumes unresolved stop/disposal means terminated.
    if (!stopping && !recognition && !preparing && !engineDisposal) {
      const work = { promise: null }; engineDisposal = work; disposalFailed = false;
      work.promise = Promise.resolve().then(() => recognizer.dispose()).catch(() => { disposalFailed = true; })
        .finally(() => { if (engineDisposal === work) engineDisposal = null; });
    }
    if (engineDisposal) {
      await Promise.race([engineDisposal.promise, new Promise(resolve => { timer = setTimeout(resolve, STOP_WAIT_MS); })]);
      clearTimeout(timer);
    }
    return view();
  }
  return Object.freeze({ prepare, begin, submit, cancel, invalidate, dispose, status });
}
