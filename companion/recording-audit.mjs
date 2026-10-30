// Offline project-file inspection only. No collector, game I/O or command path.
import { createHash } from 'node:crypto';
import { open } from 'node:fs/promises';
import { replayFrames } from './observation.mjs';
import { jsonArrayElementByteSizes } from './json-array-spans.mjs';
import { duplicateJsonMemberStatus } from './json-member-names.mjs';

export const RECORDING_LIMITS = Object.freeze({ bytes: 32 * 1024 ** 2, frames: 20000,
  frameBytes: 128 * 1024, streams: 128, detailedFindings: 200 });
const obj = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const nat = x => Number.isSafeInteger(x) && x >= 0;
const id = x => typeof x === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(x) &&
  !['__proto__', 'prototype', 'constructor'].includes(x);
const quantile = (xs, p) => xs.length ? xs[Math.max(0, Math.ceil(xs.length * p) - 1)] : null;
function boundedStructure(value) {
  const stack = [[value, 0]]; let nodes = 0;
  while (stack.length) {
    const [x, depth] = stack.pop();
    if (++nodes > 30000 || depth > 32) return false;
    if (x !== null && typeof x === 'object') {
      const values = Object.values(x);
      if (values.length + stack.length + nodes > 30000) return false;
      for (const child of values) stack.push([child, depth + 1]);
    }
  }
  return true;
}

/** Retain the original file; report format and timing separately from tactical eligibility.
 * A GAME_OBSERVED label is unverified input. Nothing here certifies native identity,
 * hidden-information exclusion, correct units, lifecycle behavior, or runtime success.
 */
export function auditRecordingBytes(bytes, { allowSynthetic = false, nominalIntervalMs = 500 } = {}) {
  if (!(bytes instanceof Uint8Array)) throw new Error('RECORDING_BYTES_REQUIRED');
  if (!nat(nominalIntervalMs) || nominalIntervalMs < 1 || nominalIntervalMs > 60000)
    throw new Error('INVALID_NOMINAL_INTERVAL');
  const report = { schemaVersion: 1, kind: 'passive-recording-audit',
    classification: 'UNVALIDATED_RECORDING', formatStatus: 'INVALID',
    sourceBytes: bytes.byteLength, sourceSha256: null, frameCount: 0,
    runtimeAcceptance: 'NOT_PERFORMED', nativeIdentityValidation: 'NOT_PERFORMED',
    commandsIssued: 0, sourceModified: false, findings: [], findingCount: 0,
    findingsTruncated: false, streams: [], replay: null,
    limitations: ['Project observation-envelope JSON array; not an MW5 API or installed collector.',
      'Nominal interval is a proposed setting, not a measured guarantee.',
      'Long intervals and sequence gaps do not establish why data is missing.',
      'Source labels and replay acceptance do not verify gameplay or authorize dispatch.',
      'Original bytes are retained by the caller; unknown/native extension fields are not rewritten or semantically certified.'] };
  const finding = (index, code) => {
    report.findingCount++;
    if (report.findings.length < RECORDING_LIMITS.detailedFindings) report.findings.push({ index, code });
    else report.findingsTruncated = true;
  };
  if (bytes.byteLength > RECORDING_LIMITS.bytes) { finding(null, 'RECORDING_TOO_LARGE'); return report; }
  report.sourceSha256 = createHash('sha256').update(bytes).digest('hex');
  let frames, source;
  try {
    source = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    frames = JSON.parse(source);
  }
  catch { finding(null, 'INVALID_UTF8_OR_JSON'); return report; }
  const duplicateStatus = duplicateJsonMemberStatus(source);
  if (duplicateStatus !== null) {
    finding(null, duplicateStatus === 'JSON_STRUCTURE_LIMIT' ? 'RECORDING_STRUCTURE_LIMIT' : duplicateStatus);
    return report;
  }
  if (!Array.isArray(frames) || !frames.length || frames.length > RECORDING_LIMITS.frames) {
    finding(null, 'INVALID_FRAME_COUNT'); return report;
  }
  report.frameCount = frames.length;
  const frameByteSizes = jsonArrayElementByteSizes(bytes);
  if (frameByteSizes.length !== frames.length) {
    finding(null, 'INVALID_FRAME_SPANS'); return report;
  }
  const labels = new Set(frames.map(f => f?.provenance));
  report.classification = labels.size === 1 && labels.has('MOCK_ONLY') ? 'MOCK_ONLY' :
    labels.size === 1 && labels.has('GAME_OBSERVED') ? 'GAME_OBSERVED_UNVALIDATED' : 'MIXED_OR_INVALID_PROVENANCE';
  const streams = new Map(), retired = new Set();
  let previous = null, currentSession = null, canReplay = true;
  for (let index = 0; index < frames.length; index++) {
    const f = frames[index], s = f?.snapshot;
    if (!boundedStructure(f)) {
      finding(index, 'FRAME_STRUCTURE_LIMIT'); canReplay = false; previous = null; continue;
    }
    if (frameByteSizes[index] > RECORDING_LIMITS.frameBytes) {
      finding(index, 'FRAME_TOO_LARGE'); canReplay = false; previous = null; continue;
    }
    if (!obj(f) || f.schemaVersion !== 1 || f.kind !== 'observation' || !id(f.session) ||
        !nat(f.sequence) || !nat(f.observedAtMs) || typeof f.adapterId !== 'string' ||
        !f.adapterId.trim() || f.adapterId.length > 128 ||
        !['MOCK_ONLY', 'GAME_OBSERVED'].includes(f.provenance) || !obj(s) ||
        s.schemaVersion !== 1 || s.session !== f.session || s.sequence !== f.sequence ||
        s.observedAtMs !== f.observedAtMs) {
      finding(index, 'INVALID_FRAME_ENVELOPE'); previous = null; continue;
    }
    if (f.provenance === 'MOCK_ONLY' && allowSynthetic !== true) finding(index, 'SYNTHETIC_DISABLED');
    if (currentSession !== f.session) {
      if (retired.has(f.session)) finding(index, 'RETIRED_SESSION_REAPPEARED');
      if (currentSession !== null) retired.add(currentSession);
      currentSession = f.session;
    }
    if (!streams.has(f.session)) {
      if (streams.size >= RECORDING_LIMITS.streams) { finding(index, 'STREAM_LIMIT'); canReplay = false; break; }
      streams.set(f.session, { session: f.session, adapterId: f.adapterId, provenance: f.provenance,
        sampleCount: 0, firstObservedAtMs: f.observedAtMs, lastObservedAtMs: f.observedAtMs,
        sequenceGaps: 0, unaccountedSequenceNumbers: '0', nonIncreasingSequences: 0,
        clockRegressions: 0, longIntervals: 0, intervals: [], sequences: [],
        nominalIntervalMs, framesWithThreeDistinctMemberIds: 0, framesWithLeaderPawnId: 0,
        inactiveOrUnknownPhaseFrames: 0, missingMemberInventoryFrames: 0 });
    }
    const stream = streams.get(f.session);
    if (stream.adapterId !== f.adapterId || stream.provenance !== f.provenance)
      finding(index, 'SESSION_STREAM_CHANGED');
    stream.sampleCount++; stream.lastObservedAtMs = f.observedAtMs; stream.sequences.push(f.sequence);
    if (s.phase !== 'active') stream.inactiveOrUnknownPhaseFrames++;
    if (!Array.isArray(s.lancemates)) stream.missingMemberInventoryFrames++;
    else if (s.lancemates.length === 3 && s.lancemates.every(a => obj(a) && id(a.id)) &&
      new Set(s.lancemates.map(a => a.id)).size === 3) stream.framesWithThreeDistinctMemberIds++;
    if (id(s.leader?.pawnId)) stream.framesWithLeaderPawnId++;
    if (previous?.session === f.session && previous.adapterId === f.adapterId && previous.provenance === f.provenance) {
      if (f.sequence <= previous.sequence) {
        stream.nonIncreasingSequences++; finding(index, 'NON_INCREASING_SEQUENCE');
      } else if (f.sequence - previous.sequence > 1) {
        stream.sequenceGaps++;
      }
      const delta = f.observedAtMs - previous.observedAtMs;
      if (delta < 0) { stream.clockRegressions++; finding(index, 'OBSERVATION_CLOCK_REGRESSED'); }
      else {
        stream.intervals.push(delta);
        if (delta > nominalIntervalMs * 1.5) stream.longIntervals++;
      }
    }
    previous = f;
  }
  report.streams = [...streams.values()].map(({ intervals, sequences, ...stream }) => {
    intervals.sort((a, b) => a - b);
    const distinctSequences = [...new Set(sequences)].sort((a, b) => a - b);
    // Count unique absent numbers within the observed span, not a sum of
    // overlapping adjacent-gap claims when packets arrive out of order.
    const unaccounted = BigInt(distinctSequences.at(-1)) - BigInt(distinctSequences[0]) + 1n - BigInt(distinctSequences.length);
    return { ...stream, unaccountedSequenceNumbers: String(unaccounted),
      measuredIntervalCount: intervals.length, minIntervalMs: intervals[0] ?? null,
      p50IntervalMs: quantile(intervals, .5), p95IntervalMs: quantile(intervals, .95),
      maxIntervalMs: intervals.at(-1) ?? null };
  });
  if (canReplay) {
    // The complete original order goes through the existing historical-clock replay.
    // Rejected, paused and incomplete samples are never filtered before replay.
    const replay = replayFrames(frames, { allowSynthetic });
    report.replay = { classification: replay.classification, framesSubmitted: frames.length,
      accepted: replay.results.filter(r => r.accepted).length,
      rejected: replay.results.filter(r => !r.accepted).length,
      errors: replay.errors.slice(0, RECORDING_LIMITS.detailedFindings),
      errorsTruncated: replay.errors.length > RECORDING_LIMITS.detailedFindings,
      recommendationsDispatchable: false };
  }
  report.formatStatus = report.findingCount === 0 ? 'VALID_PROJECT_ENVELOPES' : 'INVALID';
  return report;
}

/** Bounded, read-only regular-file input; never writes or exports the original. */
export async function inspectRecordingFile(file, options) {
  const handle = await open(file, 'r');
  try {
    const before = await handle.stat();
    if (!before.isFile() || before.size > RECORDING_LIMITS.bytes) throw new Error('INPUT_NOT_BOUNDED_REGULAR_FILE');
    const bytes = Buffer.alloc(before.size + 1);
    let offset = 0;
    while (offset < bytes.length) {
      const r = await handle.read(bytes, offset, bytes.length - offset, null);
      if (!r.bytesRead) break;
      offset += r.bytesRead;
    }
    const after = await handle.stat();
    if (offset !== before.size || after.size !== before.size || after.mtimeMs !== before.mtimeMs || after.ctimeMs !== before.ctimeMs)
      throw new Error('INPUT_CHANGED_DURING_READ');
    return auditRecordingBytes(bytes.subarray(0, offset), options);
  } finally { await handle.close(); }
}
