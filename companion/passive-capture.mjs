// PROPOSED offline raw-capture format. No native collector, tactical replay, or command path.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { open } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { jsonArrayElementByteSizes } from './json-array-spans.mjs';
import { duplicateJsonMemberStatus } from './json-member-names.mjs';

const fieldMapBytes = readFileSync(fileURLToPath(new URL('../design/PASSIVE_CAPTURE_FIELD_MAP.json', import.meta.url)));
const fieldMap = JSON.parse(fieldMapBytes.toString('utf8'));
const keys = fieldMap.nativeCandidates?.map(row => row.key);
if (fieldMap.schemaVersion !== 1 || fieldMap.kind !== 'proposed-passive-capture-field-map' ||
    fieldMap.runtimeVerified !== false || fieldMap.collectorImplemented !== false ||
    !Array.isArray(keys) || keys.length !== 19 || new Set(keys).size !== keys.length ||
    keys.some(key => typeof key !== 'string')) throw new Error('CAPTURE_FIELD_MAP_CHANGED_REVIEW_REQUIRED');
const fieldKeys = new Set(keys);
const fieldMapSha256 = createHash('sha256').update(fieldMapBytes).digest('hex');
// subjectRole identifies the object a result pertains to. It is a producer claim,
// but these combinations follow the current field map's reader/capture-use rows.
const allowedRolesByKey = Object.freeze({
  playerSquad: ['playerController'], currentAiControllers: ['squad'],
  membership: ['aiController'], controlledPawn: ['playerController', 'aiController'],
  pawnController: ['playerPawn', 'aiPawn'], humanPossession: ['playerPawn', 'aiPawn'],
  actorDestroying: ['playerController', 'aiController', 'playerPawn', 'aiPawn'],
  actorAuthority: ['playerController', 'aiController', 'playerPawn', 'aiPawn'],
  positionNative: ['playerPawn', 'aiPawn'], worker: ['aiController'],
  workerActor: ['worker'], currentJob: ['worker'], jobCommandType: ['job'],
  jobRunningState: ['job'], jobFinishReason: ['job'], paused: ['world'],
  currentArea: ['world'], areaLoading: ['area'], areaIsHub: ['area'],
});
if (Object.keys(allowedRolesByKey).length !== keys.length ||
    keys.some(key => !allowedRolesByKey[key])) throw new Error('CAPTURE_ROLE_MAP_CHANGED_REVIEW_REQUIRED');
const nullableRelationships = new Set(['playerSquad', 'controlledPawn', 'pawnController',
  'worker', 'workerActor', 'currentJob', 'currentArea']);
const booleanKeys = new Set(['membership', 'humanPossession', 'actorDestroying',
  'actorAuthority', 'paused', 'areaLoading', 'areaIsHub']);

export const PASSIVE_CAPTURE_LIMITS = Object.freeze({ bytes: 32 * 1024 ** 2, samples: 20000,
  sampleBytes: 128 * 1024, sessions: 128, readingsPerSample: 256,
  detailedFindings: 200, reviewEvents: 200, acquisitionExceptions: 200,
  depth: 32, nodes: 30000 });
export const PASSIVE_CAPTURE_STATUSES = Object.freeze(['VALUE', 'NULL_RELATION', 'INVALID_OBJECT',
  'UNSUPPORTED_READ', 'READ_FAILED', 'NOT_ATTEMPTED', 'TRUNCATED']);
const statuses = new Set(PASSIVE_CAPTURE_STATUSES);
// Explicit unavailable or incomplete producer statuses. NULL_RELATION is a
// successfully resolved null relationship and is not an acquisition exception.
const acquisitionExceptionStatuses = new Set(['INVALID_OBJECT', 'UNSUPPORTED_READ',
  'READ_FAILED', 'NOT_ATTEMPTED', 'TRUNCATED']);
// These are project assertions about the subject of a read, not validated MW5 types.
export const PASSIVE_CAPTURE_ROLES = Object.freeze(['world', 'playerController', 'squad',
  'aiController', 'playerPawn', 'aiPawn', 'worker', 'job', 'area']);
const roles = new Set(PASSIVE_CAPTURE_ROLES);
const obj = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const nat = x => Number.isSafeInteger(x) && x >= 0;
const id = x => typeof x === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(x) &&
  !['__proto__', 'prototype', 'constructor'].includes(x);
const quantile = (xs, p) => xs.length ? xs[Math.max(0, Math.ceil(xs.length * p) - 1)] : null;
const emptyStatuses = () => Object.fromEntries(PASSIVE_CAPTURE_STATUSES.map(status => [status, 0]));

function boundedStructure(value) {
  const stack = [[value, 0]]; let nodes = 0;
  while (stack.length) {
    const [item, depth] = stack.pop();
    if (++nodes > PASSIVE_CAPTURE_LIMITS.nodes || depth > PASSIVE_CAPTURE_LIMITS.depth ||
        (typeof item === 'number' && !Number.isFinite(item))) return false;
    if (item !== null && typeof item === 'object') {
      const values = Object.values(item);
      if (values.length + stack.length + nodes > PASSIVE_CAPTURE_LIMITS.nodes) return false;
      for (const child of values) stack.push([child, depth + 1]);
    }
  }
  return true;
}

function emptyAuditReport(sourceBytes) {
  return { schemaVersion: 1, kind: 'passive-capture-audit',
    classification: 'UNVALIDATED_CAPTURE', formatStatus: 'INVALID',
    sourceBytes, sourceSha256: null, fieldMapSha256,
    fieldMapKeyCount: keys.length, sampleCount: 0, sessionChanges: 0,
    findingCount: 0, findingsTruncated: false,
    findings: [], reviewEventCount: 0, reviewEventsOmitted: 0,
    reviewEvents: [], acquisitionExceptionCount: 0,
    acquisitionExceptionsOmitted: 0, acquisitionExceptions: [],
    streams: [], runtimeAcceptance: 'NOT_PERFORMED',
    nativeIdentityValidation: 'NOT_PERFORMED', clockCalibration: 'NOT_PERFORMED',
    commandsIssued: 0, sourceModified: false, replay: null,
    limitations: [
      'PROPOSED project format; no native producer or MW5 runtime read is verified.',
      'Producer, subject roles, binding IDs, provenance and clock units are unvalidated input assertions.',
      'Reported intervals are arithmetic on submitted timestamps, not calibrated game timing.',
      'Review events include diagnostic sequence/clock anomalies and changes in valid producer assertions; neither is an independently observed game event.',
      'Three asserted AI bindings do not prove roster completeness, AI ownership or durable identity.',
      'Raw values and unknown extra fields remain in the original bytes; none is mapped to tactical authority or replay.'
    ] };
}

function oversizedAuditReport(sourceBytes) {
  const report = emptyAuditReport(sourceBytes);
  report.findingCount = 1;
  report.findings.push({ index: null, code: 'CAPTURE_TOO_LARGE' });
  report.sourceHashStatus = 'NOT_COMPUTED_SIZE_LIMIT';
  report.limitations.push('The source exceeded the 32 MiB file limit and was not hashed or parsed.');
  return report;
}

/** Inspect exact source bytes without rewriting values or projecting tactical state. */
export function auditPassiveCaptureBytes(bytes, { allowSynthetic = false, nominalIntervalMs = 500 } = {}) {
  if (!(bytes instanceof Uint8Array)) throw new Error('CAPTURE_BYTES_REQUIRED');
  if (!nat(nominalIntervalMs) || nominalIntervalMs < 1 || nominalIntervalMs > 60000)
    throw new Error('INVALID_NOMINAL_INTERVAL');
  if (bytes.byteLength > PASSIVE_CAPTURE_LIMITS.bytes)
    return oversizedAuditReport(bytes.byteLength);
  const report = emptyAuditReport(bytes.byteLength);
  const finding = (index, code) => {
    report.findingCount++;
    if (report.findings.length < PASSIVE_CAPTURE_LIMITS.detailedFindings)
      report.findings.push({ index, code });
    else report.findingsTruncated = true;
  };
  const reviewEvent = (index, sample, code) => {
    report.reviewEventCount++;
    if (report.reviewEvents.length < PASSIVE_CAPTURE_LIMITS.reviewEvents)
      report.reviewEvents.push({ index, session: sample.session, sequence: sample.sequence, code });
    else report.reviewEventsOmitted++;
  };
  const acquisitionException = detail => {
    report.acquisitionExceptionCount++;
    if (report.acquisitionExceptions.length < PASSIVE_CAPTURE_LIMITS.acquisitionExceptions)
      report.acquisitionExceptions.push(detail);
    else report.acquisitionExceptionsOmitted++;
  };
  report.sourceSha256 = createHash('sha256').update(bytes).digest('hex');
  let samples, source;
  try {
    source = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    samples = JSON.parse(source);
  }
  catch { finding(null, 'INVALID_UTF8_OR_JSON'); return report; }
  const duplicateStatus = duplicateJsonMemberStatus(source);
  if (duplicateStatus !== null) {
    finding(null, duplicateStatus === 'JSON_STRUCTURE_LIMIT' ? 'CAPTURE_STRUCTURE_LIMIT' : duplicateStatus);
    return report;
  }
  if (!Array.isArray(samples) || !samples.length || samples.length > PASSIVE_CAPTURE_LIMITS.samples) {
    finding(null, 'INVALID_SAMPLE_COUNT'); return report;
  }
  report.sampleCount = samples.length;
  const sampleByteSizes = jsonArrayElementByteSizes(bytes);
  if (sampleByteSizes.length !== samples.length) {
    finding(null, 'INVALID_SAMPLE_SPANS'); return report;
  }
  const labels = new Set(samples.map(sample => sample?.provenance));
  report.classification = labels.size === 1 && labels.has('MOCK_ONLY') ? 'MOCK_ONLY' :
    labels.size === 1 && labels.has('GAME_OBSERVED') ? 'GAME_OBSERVED_UNVALIDATED' :
      'MIXED_OR_INVALID_PROVENANCE';
  const streams = new Map(), retired = new Set();
  let currentSession = null, previous = null, previousClaims = null;
  for (let index = 0; index < samples.length; index++) {
    const sample = samples[index];
    if (!boundedStructure(sample)) { finding(index, 'SAMPLE_STRUCTURE_LIMIT'); previous = null; continue; }
    if (sampleByteSizes[index] > PASSIVE_CAPTURE_LIMITS.sampleBytes) {
      finding(index, 'SAMPLE_TOO_LARGE'); previous = null; continue;
    }
    if (!obj(sample) || sample.schemaVersion !== 1 || sample.kind !== 'passive-capture' ||
        !id(sample.producerId) || !id(sample.session) || !nat(sample.sequence) ||
        !nat(sample.observedAtMs) || !['MOCK_ONLY', 'GAME_OBSERVED'].includes(sample.provenance) ||
        !Array.isArray(sample.readings) ||
        sample.readings.length > PASSIVE_CAPTURE_LIMITS.readingsPerSample) {
      finding(index, 'INVALID_SAMPLE_ENVELOPE'); previous = null; continue;
    }
    let validReadings = true;
    const seen = new Set(), roleBindings = new Map(), rolesByBinding = new Map();
    const aiControllersWithRead = new Set(), acquiredPlayerPawns = new Set();
    const readStatuses = emptyStatuses(), readKeys = new Set();
    const acquisitionCandidates = [];
    let unboundReadings = 0, truncatedInventory = false, maxTruncatedInventoryCount = null;
    let pauseClaim = null, areaLoadingClaim = null;
    let pauseValueCount = 0, areaLoadingValueCount = 0;
    for (let readingIndex = 0; readingIndex < sample.readings.length; readingIndex++) {
      const reading = sample.readings[readingIndex];
      if (!obj(reading) || !fieldKeys.has(reading.key) || !roles.has(reading.subjectRole) ||
          !allowedRolesByKey[reading.key]?.includes(reading.subjectRole) ||
          !(reading.bindingId === null || id(reading.bindingId)) || !statuses.has(reading.status)) {
        finding(index, 'INVALID_READING'); validReadings = false; continue;
      }
      const hasValue = Object.hasOwn(reading, 'value');
      if ((reading.status === 'VALUE' && (!hasValue || reading.value === null)) ||
          (reading.status === 'NULL_RELATION' && (!hasValue || reading.value !== null)) ||
          (!['VALUE', 'NULL_RELATION'].includes(reading.status) && hasValue)) {
        finding(index, 'STATUS_VALUE_MISMATCH'); validReadings = false; continue;
      }
      if ((reading.status === 'NULL_RELATION' && !nullableRelationships.has(reading.key)) ||
          (reading.status === 'TRUNCATED' && reading.key !== 'currentAiControllers') ||
          (reading.status === 'TRUNCATED' &&
            (!nat(reading.observedCount) || reading.observedCount <= 3)) ||
          (reading.status !== 'TRUNCATED' && Object.hasOwn(reading, 'observedCount')) ||
          (reading.status === 'VALUE' && booleanKeys.has(reading.key) && typeof reading.value !== 'boolean') ||
          (reading.status === 'VALUE' && reading.key === 'currentAiControllers' &&
            (!Array.isArray(reading.value) || reading.value.length > 3)) ||
          (['VALUE', 'NULL_RELATION', 'TRUNCATED'].includes(reading.status) &&
            reading.subjectRole !== 'world' && reading.bindingId === null)) {
        finding(index, 'READING_SEMANTIC_MISMATCH'); validReadings = false; continue;
      }
      const identity = `${reading.key}\0${reading.subjectRole}\0${reading.bindingId ?? ''}`;
      if (seen.has(identity)) { finding(index, 'DUPLICATE_READING'); validReadings = false; continue; }
      seen.add(identity);
      readStatuses[reading.status]++;
      readKeys.add(reading.key);
      if (acquisitionExceptionStatuses.has(reading.status))
        acquisitionCandidates.push({ index, session: sample.session, sequence: sample.sequence,
          readingIndex, key: reading.key, subjectRole: reading.subjectRole,
          bindingId: reading.bindingId, status: reading.status });
      if (reading.key === 'paused' && reading.status === 'VALUE') {
        pauseValueCount++; pauseClaim = reading;
      }
      if (reading.key === 'areaLoading' && reading.status === 'VALUE') {
        areaLoadingValueCount++; areaLoadingClaim = reading;
      }
      if (reading.subjectRole === 'playerPawn' && reading.bindingId !== null &&
          ['VALUE', 'NULL_RELATION'].includes(reading.status))
        acquiredPlayerPawns.add(reading.bindingId);
      if (reading.bindingId === null && reading.subjectRole !== 'world') unboundReadings++;
      if (reading.key === 'currentAiControllers' && reading.status === 'TRUNCATED') {
        truncatedInventory = true;
        maxTruncatedInventoryCount = Math.max(maxTruncatedInventoryCount ?? 0, reading.observedCount);
      }
      if (reading.bindingId !== null) {
        if (!roleBindings.has(reading.subjectRole)) roleBindings.set(reading.subjectRole, new Set());
        roleBindings.get(reading.subjectRole).add(reading.bindingId);
        if (!rolesByBinding.has(reading.bindingId)) rolesByBinding.set(reading.bindingId, new Set());
        rolesByBinding.get(reading.bindingId).add(reading.subjectRole);
        if (reading.subjectRole === 'aiController' &&
            ['VALUE', 'NULL_RELATION'].includes(reading.status))
          aiControllersWithRead.add(reading.bindingId);
      }
    }
    if (!validReadings) { previous = null; continue; }
    const currentClaims = { pause: pauseValueCount === 1 ? pauseClaim : null,
      areaLoading: areaLoadingValueCount === 1 ? areaLoadingClaim : null,
      playerPawnBinding: acquiredPlayerPawns.size === 1 ? [...acquiredPlayerPawns][0] : null };
    const mentionedAiControllers = roleBindings.get('aiController') ?? new Set();
    const playerPawns = roleBindings.get('playerPawn') ?? new Set();
    const aiPawns = roleBindings.get('aiPawn') ?? new Set();
    const ambiguousPawnRoleOverlap = [...rolesByBinding.values()].some(claims =>
      claims.size === 2 && claims.has('playerPawn') && claims.has('aiPawn'));
    const crossRoleBindingCollision = [...rolesByBinding.values()].some(claims =>
      claims.size > 1 && !(claims.size === 2 &&
        claims.has('playerPawn') && claims.has('aiPawn')));
    if (crossRoleBindingCollision) finding(index, 'CROSS_ROLE_BINDING_COLLISION');
    const sessionChanged = currentSession !== null && currentSession !== sample.session;
    const retiredSessionReappeared = sessionChanged && retired.has(sample.session);
    if (currentSession !== sample.session) {
      if (retiredSessionReappeared) finding(index, 'RETIRED_SESSION_REAPPEARED');
      if (currentSession !== null) {
        retired.add(currentSession);
        report.sessionChanges++;
      }
      currentSession = sample.session;
    }
    if (!streams.has(sample.session)) {
      if (streams.size >= PASSIVE_CAPTURE_LIMITS.sessions) {
        finding(index, 'SESSION_LIMIT'); previous = null; break;
      }
      streams.set(sample.session, { session: sample.session, producerId: sample.producerId,
        provenance: sample.provenance, sampleCount: 0, firstObservedAtMs: sample.observedAtMs,
        lastObservedAtMs: sample.observedAtMs, sequenceGaps: 0,
        unaccountedSequenceNumbers: '0', nonIncreasingSequences: 0, reportedClockRegressions: 0,
        longReportedIntervals: 0, reportedIntervalCount: 0, minReportedIntervalMs: null,
        p50ReportedIntervalMs: null, p95ReportedIntervalMs: null, maxReportedIntervalMs: null,
        nominalIntervalMs, readingsByStatus: emptyStatuses(), unboundReadings: 0,
        samplesWithThreeAssertedAiBindings: 0, samplesWithOverThreeAssertedAiBindings: 0,
        samplesWithThreeMentionedAiBindings: 0, samplesWithOverThreeMentionedAiBindings: 0,
        samplesWithTruncatedAiInventory: 0, maxReportedTruncatedAiInventoryCount: null,
        samplesWithAmbiguousPawnRoleOverlap: 0,
        assertedPlayerPawnBindingChanges: 0,
        unreportedFieldKeys: [], _intervals: [], _sequences: [], _keys: new Set(),
        _lastPlayerPawnBinding: null });
    }
    const stream = streams.get(sample.session);
    const sameStream = stream.producerId === sample.producerId && stream.provenance === sample.provenance;
    if (!sameStream) finding(index, 'SESSION_STREAM_CHANGED');
    const syntheticDisabled = sample.provenance === 'MOCK_ONLY' && allowSynthetic !== true;
    if (syntheticDisabled) finding(index, 'SYNTHETIC_DISABLED');
    stream.sampleCount++;
    stream.lastObservedAtMs = sample.observedAtMs;
    stream._sequences.push(sample.sequence);
    for (const key of readKeys) stream._keys.add(key);
    for (const status of PASSIVE_CAPTURE_STATUSES) stream.readingsByStatus[status] += readStatuses[status];
    stream.unboundReadings += unboundReadings;
    if (aiControllersWithRead.size === 3) stream.samplesWithThreeAssertedAiBindings++;
    if (aiControllersWithRead.size > 3) stream.samplesWithOverThreeAssertedAiBindings++;
    if (mentionedAiControllers.size === 3) stream.samplesWithThreeMentionedAiBindings++;
    if (mentionedAiControllers.size > 3) stream.samplesWithOverThreeMentionedAiBindings++;
    if (truncatedInventory) {
      stream.samplesWithTruncatedAiInventory++;
      stream.maxReportedTruncatedAiInventoryCount = Math.max(
        stream.maxReportedTruncatedAiInventoryCount ?? 0, maxTruncatedInventoryCount);
    }
    if (ambiguousPawnRoleOverlap) stream.samplesWithAmbiguousPawnRoleOverlap++;
    if (playerPawns.size === 1) {
      const playerPawnBinding = [...playerPawns][0];
      if (stream._lastPlayerPawnBinding !== null &&
          stream._lastPlayerPawnBinding !== playerPawnBinding) stream.assertedPlayerPawnBindingChanges++;
      stream._lastPlayerPawnBinding = playerPawnBinding;
    } else stream._lastPlayerPawnBinding = null;
    const diagnosticReviewCodes = [], transitionReviewCodes = [];
    if (previous?.session === sample.session && previous.producerId === sample.producerId &&
        previous.provenance === sample.provenance && sameStream) {
      if (sample.sequence <= previous.sequence) {
        stream.nonIncreasingSequences++; finding(index, 'NON_INCREASING_SEQUENCE');
        diagnosticReviewCodes.push('NON_INCREASING_SEQUENCE');
      } else if (sample.sequence - previous.sequence > 1) {
        stream.sequenceGaps++;
        if (previousClaims) transitionReviewCodes.push('SEQUENCE_GAP');
      }
      const delta = sample.observedAtMs - previous.observedAtMs;
      if (delta < 0) {
        stream.reportedClockRegressions++; finding(index, 'REPORTED_CLOCK_REGRESSED');
        diagnosticReviewCodes.push('REPORTED_CLOCK_REGRESSION');
      } else {
        stream._intervals.push(delta);
        if (delta > nominalIntervalMs * 1.5) stream.longReportedIntervals++;
      }
      if (sample.sequence > previous.sequence && delta >= 0 && previousClaims) {
        if (currentClaims.pause && previousClaims.pause &&
            currentClaims.pause.bindingId === previousClaims.pause.bindingId &&
            currentClaims.pause.value !== previousClaims.pause.value)
          transitionReviewCodes.push('ASSERTED_PAUSE_CHANGED');
        if (currentClaims.areaLoading && previousClaims.areaLoading &&
            currentClaims.areaLoading.bindingId === previousClaims.areaLoading.bindingId &&
            currentClaims.areaLoading.value !== previousClaims.areaLoading.value)
          transitionReviewCodes.push('ASSERTED_AREA_LOADING_CHANGED');
        if (currentClaims.playerPawnBinding !== null && previousClaims.playerPawnBinding !== null &&
            currentClaims.playerPawnBinding !== previousClaims.playerPawnBinding)
          transitionReviewCodes.push('ASSERTED_PLAYER_PAWN_ROLE_BINDING_CHANGED');
      }
    }
    for (const code of diagnosticReviewCodes) reviewEvent(index, sample, code);
    const reviewCurrentValid = !crossRoleBindingCollision && !retiredSessionReappeared &&
      sameStream && !syntheticDisabled && diagnosticReviewCodes.length === 0;
    if (reviewCurrentValid) {
      for (const detail of acquisitionCandidates) acquisitionException(detail);
      if (sessionChanged) reviewEvent(index, sample, 'ASSERTED_SESSION_CHANGED');
      if (truncatedInventory) reviewEvent(index, sample, 'ASSERTED_AI_INVENTORY_TRUNCATED');
      for (const code of transitionReviewCodes) reviewEvent(index, sample, code);
    }
    previous = sameStream ? sample : null;
    previousClaims = reviewCurrentValid ? currentClaims : null;
  }
  report.streams = [...streams.values()].map(stream => {
    const intervals = stream._intervals.sort((a, b) => a - b);
    const sequences = [...new Set(stream._sequences)].sort((a, b) => a - b);
    const unaccounted = BigInt(sequences.at(-1)) - BigInt(sequences[0]) + 1n - BigInt(sequences.length);
    const { _intervals, _sequences, _keys, _lastPlayerPawnBinding, ...publicStream } = stream;
    return { ...publicStream, unaccountedSequenceNumbers: String(unaccounted),
      reportedIntervalCount: intervals.length, minReportedIntervalMs: intervals[0] ?? null,
      p50ReportedIntervalMs: quantile(intervals, .5), p95ReportedIntervalMs: quantile(intervals, .95),
      maxReportedIntervalMs: intervals.at(-1) ?? null,
      unreportedFieldKeys: keys.filter(key => !_keys.has(key)) };
  });
  report.formatStatus = report.findingCount === 0 ? 'VALID_PROJECT_CAPTURE' : 'INVALID';
  return report;
}

/** Bounded, read-only regular-file input. The original bytes are never rewritten. */
export async function inspectPassiveCaptureFile(file, options) {
  const handle = await open(file, 'r');
  try {
    const before = await handle.stat();
    if (!before.isFile()) throw new Error('INPUT_NOT_BOUNDED_REGULAR_FILE');
    if (before.size > PASSIVE_CAPTURE_LIMITS.bytes) {
      const after = await handle.stat();
      if (after.size !== before.size || after.mtimeMs !== before.mtimeMs ||
          after.ctimeMs !== before.ctimeMs) throw new Error('INPUT_CHANGED_DURING_READ');
      return oversizedAuditReport(before.size);
    }
    const bytes = Buffer.alloc(before.size + 1);
    let offset = 0;
    while (offset < bytes.length) {
      const result = await handle.read(bytes, offset, bytes.length - offset, null);
      if (!result.bytesRead) break;
      offset += result.bytesRead;
    }
    const after = await handle.stat();
    if (offset !== before.size || after.size !== before.size ||
        after.mtimeMs !== before.mtimeMs || after.ctimeMs !== before.ctimeMs)
      throw new Error('INPUT_CHANGED_DURING_READ');
    return auditPassiveCaptureBytes(bytes.subarray(0, offset), options);
  } finally { await handle.close(); }
}
