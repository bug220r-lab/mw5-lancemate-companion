// Conservative local preview policy; neither admission nor polling proves peak capacity.
import os from 'node:os';
import { statfs } from 'node:fs/promises';
import { RUNTIME_ROOT } from './runtime-paths.mjs';
const GiB = 1024 ** 3;
export const WORKBENCH_RESOURCE_POLICY = Object.freeze({
  admissionRamBytes: 5 * GiB, workingDiskBytes: 10 * GiB, runningRamBytes: 2 * GiB,
  sampleTimeoutMs: 2000, watchIntervalMs: 250, peakCapacityVerified: false,
});
const fault = code => Object.assign(new Error(code), { code });
const validBytes = value => Number.isSafeInteger(value) && value >= 0;

/** Trusted code-only seams. No reads, timer or process begins on construction. */
export function createWorkbenchResources(testIo = null) {
  const io = { freemem: () => os.freemem(), statfs, now: () => performance.now(),
    setTimeout, clearTimeout, ...testIo };
  let epoch = 0, work = null, admission = null, watch = null, timer = null;
  let lastError = null, lastSample = null;

  function cancelTimer() { if (timer !== null) { io.clearTimeout(timer); timer = null; } }
  function finish(request, error, value) {
    if (request.settled) return;
    request.settled = true; io.clearTimeout(request.timer);
    request.signal?.removeEventListener('abort', request.abort);
    if (error) request.reject(error); else request.resolve(value);
  }
  function sample(includeDisk) {
    if (work) throw fault('RESOURCE_SAMPLE_BUSY');
    const owned = {}; work = owned;
    owned.done = Promise.resolve().then(async () => {
      let availableDiskBytes = null;
      if (includeDisk) {
        const disk = await io.statfs(RUNTIME_ROOT);
        if (!disk || !validBytes(disk.bavail) || !validBytes(disk.bsize)) throw fault('RESOURCE_READING_UNAVAILABLE');
        availableDiskBytes = disk.bavail * disk.bsize;
        if (!validBytes(availableDiskBytes)) throw fault('RESOURCE_READING_UNAVAILABLE');
      }
      const availableRamBytes = await io.freemem();
      if (!validBytes(availableRamBytes)) throw fault('RESOURCE_READING_UNAVAILABLE');
      const sampledAtMs = io.now();
      if (!Number.isFinite(sampledAtMs) || sampledAtMs < 0) throw fault('RESOURCE_READING_UNAVAILABLE');
      return { availableRamBytes, availableDiskBytes, sampledAtMs };
    }).finally(() => { if (work === owned) work = null; });
    return owned.done;
  }
  function schedule() {
    if (!watch || admission || work || timer !== null) return;
    const owned = watch;
    timer = io.setTimeout(() => { timer = null; if (watch === owned) void poll(owned); }, WORKBENCH_RESOURCE_POLICY.watchIntervalMs);
    timer?.unref?.();
  }
  function breach(owned, code) {
    if (watch !== owned) return;
    lastError = code; watch = null; cancelTimer();
    try { Promise.resolve(owned.onBreach(code)).catch(() => {}); } catch { /* Caller owns shutdown status. */ }
  }
  async function poll(owned) {
    if (watch !== owned || admission || work) { schedule(); return; }
    try { if (owned.isActive() !== true) { watch = null; return; } }
    catch { breach(owned, 'RESOURCE_READING_UNAVAILABLE'); return; }
    let expired = false;
    const deadline = io.setTimeout(() => {
      expired = true; if (work) work.draining = true;
      breach(owned, 'RESOURCE_SAMPLE_TIMEOUT');
    }, WORKBENCH_RESOURCE_POLICY.sampleTimeoutMs);
    try {
      const result = await sample(false);
      if (watch !== owned || expired) return;
      lastSample = result;
      if (result.availableRamBytes < WORKBENCH_RESOURCE_POLICY.runningRamBytes) breach(owned, 'RESOURCE_RAM_RESERVE_LOST');
    } catch { if (!expired) breach(owned, 'RESOURCE_READING_UNAVAILABLE'); }
    finally { io.clearTimeout(deadline); schedule(); }
  }
  function admit({ signal } = {}) {
    if (signal && (typeof signal.aborted !== 'boolean' || typeof signal.addEventListener !== 'function' ||
        typeof signal.removeEventListener !== 'function')) return Promise.reject(fault('RESOURCE_INVALID_ABORT_SIGNAL'));
    if (admission || (work && !watch)) return Promise.reject(fault('RESOURCE_CLEANUP_PENDING'));
    if (signal?.aborted) return Promise.reject(fault('RESOURCE_ADMISSION_CANCELLED'));
    cancelTimer(); lastError = null;
    const owned = { epoch, signal, settled: false }; admission = owned;
    const promise = new Promise((resolve, reject) => { owned.resolve = resolve; owned.reject = reject; });
    owned.abort = () => { if (work) work.draining = true; finish(owned, fault('RESOURCE_ADMISSION_CANCELLED')); };
    signal?.addEventListener('abort', owned.abort, { once: true });
    owned.timer = io.setTimeout(() => {
      if (work) work.draining = true;
      if (owned.epoch === epoch) lastError = 'RESOURCE_SAMPLE_TIMEOUT';
      finish(owned, fault('RESOURCE_SAMPLE_TIMEOUT'));
    }, WORKBENCH_RESOURCE_POLICY.sampleTimeoutMs);
    function guard() {
      if (owned.settled || owned.epoch !== epoch || signal?.aborted) throw fault('RESOURCE_ADMISSION_CANCELLED');
    }
    void (async () => {
      try {
        if (work) await work.done.catch(() => {});
        guard(); const result = await sample(true); guard(); lastSample = result;
        if (result.availableRamBytes < WORKBENCH_RESOURCE_POLICY.admissionRamBytes) throw fault('RESOURCE_ADMISSION_RAM');
        if (result.availableDiskBytes < WORKBENCH_RESOURCE_POLICY.workingDiskBytes) throw fault('RESOURCE_ADMISSION_DISK');
        finish(owned, null, { ...result, classification: 'CONSERVATIVE_ADMISSION_ONLY' });
      } catch (error) {
        const code = ['RESOURCE_ADMISSION_RAM', 'RESOURCE_ADMISSION_DISK', 'RESOURCE_ADMISSION_CANCELLED'].includes(error?.code)
          ? error.code : 'RESOURCE_READING_UNAVAILABLE';
        if (owned.epoch === epoch && !owned.settled) lastError = code;
        finish(owned, fault(code));
      } finally { if (admission === owned) admission = null; schedule(); }
    })();
    return promise;
  }
  function startWatch(onBreach, isActive = () => true) {
    if (typeof onBreach !== 'function' || typeof isActive !== 'function') throw fault('RESOURCE_INVALID_CALLBACK');
    if (watch) return status();
    if (admission || work) throw fault('RESOURCE_CLEANUP_PENDING');
    watch = { onBreach, isActive }; schedule(); return status();
  }
  function stopWatch() {
    ++epoch; watch = null; cancelTimer();
    if (work) work.draining = true;
    if (admission) finish(admission, fault('RESOURCE_ADMISSION_CANCELLED'));
    return status();
  }
  function status() {
    return { policy: WORKBENCH_RESOURCE_POLICY, classification: testIo ? 'MOCK_ONLY' : 'LOCAL_RESOURCE_POLICY',
      monitoring: !!watch, sampling: !!work, admissionPending: !!admission,
      cleanupPending: !!work?.draining || !!admission?.settled,
      lastError, lastSample: lastSample && { ...lastSample }, continuousReserveGuaranteed: false };
  }
  return Object.freeze({ admit, startWatch, stopWatch, status });
}
