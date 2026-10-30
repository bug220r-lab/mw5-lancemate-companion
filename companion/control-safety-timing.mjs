// Pure project evidence checks. No capture, native access, control or authenticity proof.
import { types as utilTypes } from 'node:util';

export const RESTORATION_TARGET_MS = 150;
export const CONTROL_SAFETY_TIMING_LIMITS = Object.freeze({ measurementsPerKind: 2048, dataNodes: 100000,
  depth: 16, objectKeys: 16, stringUnits: 8 * 1024 * 1024 });

const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const own = (x, key) => Object.hasOwn(x, key);
const reserved = new Set(['__proto__', 'constructor', 'prototype']);
const ident = x => typeof x === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(x) && !reserved.has(x);
const hash = x => typeof x === 'string' && /^[a-f0-9]{64}$/i.test(x);
const reference = x => typeof x === 'string' && x.trim().length > 0 && x.length <= 512 && !/[\x00-\x1f\x7f]/.test(x);
const time = x => Number.isSafeInteger(x) && x >= 0;
const provenance = x => ['GAME_OBSERVED', 'MOCK_ONLY'].includes(x);
const confirmations = ['CONFIRMED', 'UNKNOWN', 'FAILED', 'NOT_PERFORMED'];
const bindingKeys = ['actorId', 'controllerId', 'pawnId', 'generation'];
const eventKeys = ['provenance', 'configHash', 'sessionId', 'clockId', 'binding', 'atMs', 'evidenceRef'];

// The public seam accepts bounded plain data, without invoking property getters.
function copyData(value) {
  let nodes = 0, stringUnits = 0; const stack = new Set();
  function visit(x, depth) {
    if (++nodes > CONTROL_SAFETY_TIMING_LIMITS.dataNodes || depth > CONTROL_SAFETY_TIMING_LIMITS.depth)
      throw new Error('DATA_LIMIT');
    if (typeof x === 'string') {
      stringUnits += x.length;
      if (x.length > 1024 || stringUnits > CONTROL_SAFETY_TIMING_LIMITS.stringUnits) throw new Error('STRING_LIMIT');
      return x;
    }
    if (x === null || ['boolean', 'number'].includes(typeof x)) return x;
    if (typeof x === 'object' && utilTypes.isProxy(x)) throw new Error('PROXY_DATA');
    const array = Array.isArray(x);
    if (!object(x) && !array) throw new Error('NON_DATA_VALUE');
    if (stack.has(x)) throw new Error('CYCLIC_DATA');
    if (array && Object.getPrototypeOf(x) !== Array.prototype) throw new Error('NON_PLAIN_ARRAY');
    if (!array && ![Object.prototype, null].includes(Object.getPrototypeOf(x)))
      throw new Error('NON_PLAIN_DATA');
    const length = array ? Object.getOwnPropertyDescriptor(x, 'length')?.value : null;
    if (array && (!time(length) || length > CONTROL_SAFETY_TIMING_LIMITS.measurementsPerKind))
      throw new Error('ARRAY_LIMIT');
    const allKeys = Reflect.ownKeys(x);
    if (array && (allKeys.length !== length + 1 || allKeys.some(key => key !== 'length' &&
        (typeof key !== 'string' || !/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= length))))
      throw new Error('SPARSE_OR_EXTENDED_ARRAY');
    if (!array && allKeys.length > CONTROL_SAFETY_TIMING_LIMITS.objectKeys)
      throw new Error('KEY_LIMIT');
    stack.add(x); const out = array ? [] : {};
    for (const key of allKeys) {
      if (array && key === 'length') continue;
      if (typeof key !== 'string' || key.length > 64 || reserved.has(key)) throw new Error('INVALID_DATA_KEY');
      const descriptor = Object.getOwnPropertyDescriptor(x, key);
      if (!descriptor || !own(descriptor, 'value') || !descriptor.enumerable) throw new Error('NON_DATA_PROPERTY');
      out[key] = visit(descriptor.value, depth + 1);
    }
    stack.delete(x); return out;
  }
  return visit(value, 0);
}

function keys(value, allowed, label, issues) {
  for (const key of Object.keys(value)) if (!allowed.includes(key)) issues.push(`${label}: unknown field ${key}`);
}
function validBinding(value) {
  return object(value) && Object.keys(value).length === bindingKeys.length &&
    bindingKeys.every(k => own(value, k)) && ['actorId', 'controllerId', 'pawnId'].every(k => ident(value[k])) &&
    time(value.generation) && value.generation >= 1;
}
function event(value, currentConfigHash, label, terminal, issues) {
  if (!object(value)) { issues.push(`${label}: missing event observation`); return; }
  keys(value, terminal ? [...eventKeys, 'confirmation'] : eventKeys, label, issues);
  if (!provenance(value.provenance)) issues.push(`${label}: unsupported or absent provenance`);
  if (!hash(value.configHash) || !hash(currentConfigHash) || value.configHash.toLowerCase() !== currentConfigHash.toLowerCase())
    issues.push(`${label}: configuration does not match currentConfigHash`);
  if (!ident(value.sessionId)) issues.push(`${label}: missing or invalid sessionId`);
  if (!ident(value.clockId)) issues.push(`${label}: missing or invalid monotonic clockId`);
  if (!validBinding(value.binding)) issues.push(`${label}: exact actor/controller/pawn/generation binding required`);
  if (!reference(value.evidenceRef)) issues.push(`${label}: missing inspectable evidenceRef`);
  if (!time(value.atMs)) issues.push(`${label}: atMs must be a nonnegative safe integer in milliseconds`);
  if (terminal && !confirmations.includes(value.confirmation)) issues.push(`${label}: explicit confirmation required`);
}

function measurement(row, kind, currentConfigHash, label, seen) {
  const issues = [], failures = [];
  const [startKey, endKey] = kind === 'restoration' ? ['detection', 'restoration'] : ['humanInput', 'completeYield'];
  if (!object(row)) return { measurementId: null, provenance: null, latencyMs: null, issues: [`${label}: expected a measurement`], failures };
  keys(row, ['measurementId', startKey, endKey], label, issues);
  if (!ident(row.measurementId)) issues.push(`${label}: missing or invalid measurementId`);
  else if (seen.has(row.measurementId)) issues.push(`${label}: duplicate measurementId ${row.measurementId}`);
  else seen.add(row.measurementId);
  const start = row[startKey], end = row[endKey];
  event(start, currentConfigHash, `${label}.${startKey}`, false, issues);
  event(end, currentConfigHash, `${label}.${endKey}`, true, issues);
  if (object(end)) {
    if (end.confirmation === 'FAILED') failures.push(`${label}: supplied ${endKey} observation explicitly reports failure`);
    else if (['UNKNOWN', 'NOT_PERFORMED'].includes(end.confirmation)) issues.push(`${label}: ${endKey} is not confirmed`);
  }
  let source = null;
  if (object(start) && object(end)) {
    if (provenance(start.provenance) && start.provenance === end.provenance) source = start.provenance;
    else issues.push(`${label}: event provenance must match`);
    if (start.sessionId !== end.sessionId) issues.push(`${label}: events belong to different sessions`);
    if (start.clockId !== end.clockId) issues.push(`${label}: events belong to different clock domains`);
    if (validBinding(start.binding) && validBinding(end.binding) &&
        bindingKeys.some(k => start.binding[k] !== end.binding[k])) issues.push(`${label}: event bindings do not match`);
    if (time(start.atMs) && time(end.atMs) && end.atMs < start.atMs) issues.push(`${label}: event clock regressed`);
  }
  let latencyMs = null;
  if (!issues.length && !failures.length) latencyMs = end.atMs - start.atMs;
  if (kind === 'restoration' && latencyMs !== null && latencyMs > RESTORATION_TARGET_MS)
    failures.push(`${label}: detection-to-confirmed-restoration exceeds ${RESTORATION_TARGET_MS} ms`);
  return { measurementId: ident(row.measurementId) ? row.measurementId : null, provenance: source,
    sessionId: ident(start?.sessionId) ? start.sessionId : null, clockId: ident(start?.clockId) ? start.clockId : null,
    binding: validBinding(start?.binding) ? { ...start.binding } : null,
    startAtMs: time(start?.atMs) ? start.atMs : null, endAtMs: time(end?.atMs) ? end.atMs : null,
    startEvidenceRef: reference(start?.evidenceRef) ? start.evidenceRef : null,
    endEvidenceRef: reference(end?.evidenceRef) ? end.evidenceRef : null,
    confirmation: confirmations.includes(end?.confirmation) ? end.confirmation : null,
    latencyMs, withinTarget: kind === 'restoration' && latencyMs !== null ? latencyMs <= RESTORATION_TARGET_MS : null,
    issues, failures };
}

function section(input, kind, currentConfigHash, seen) {
  const field = kind === 'restoration' ? 'restorationObservations' : 'humanYieldObservations';
  const issues = [], failures = []; let rows = own(input, field) ? input[field] : [];
  if (!Array.isArray(rows)) { issues.push(`${field}: expected an array`); rows = []; }
  if (rows.length > CONTROL_SAFETY_TIMING_LIMITS.measurementsPerKind) {
    issues.push(`${field}: measurement limit exceeded`); rows = [];
  }
  const measurements = rows.map((row, i) => measurement(row, kind, currentConfigHash, `${field}[${i}]`, seen));
  for (const row of measurements) { issues.push(...row.issues); failures.push(...row.failures); }
  const observedCount = measurements.filter(r => r.provenance === 'GAME_OBSERVED').length;
  const mockCount = measurements.filter(r => r.provenance === 'MOCK_ONLY').length;
  let status;
  if (issues.length) status = 'INCOMPLETE';
  else if (!rows.length) status = 'NOT_PERFORMED';
  else if (mockCount === rows.length) status = 'MOCK_ONLY';
  else if (observedCount !== rows.length) status = 'INCOMPLETE';
  else status = failures.length ? 'FAIL' : kind === 'restoration' ? 'PASS' : 'RECORDED';
  if (observedCount && mockCount) issues.push(`${field}: mock and game-observed claims cannot be combined`);
  const times = measurements.flatMap(r => r.latencyMs === null ? [] : [r.latencyMs]);
  return { status, assessment: kind === 'restoration' ? 'SUPPLIED_RESTORATION_TARGET' : 'DESCRIPTIVE_COMPLETE_YIELD_TIMING',
    targetMs: kind === 'restoration' ? RESTORATION_TARGET_MS : null,
    suppliedCount: rows.length, observedCount, mockCount, measuredCount: times.length,
    minMs: times.length ? Math.min(...times) : null, maxMs: times.length ? Math.max(...times) : null,
    issues, failures, measurements };
}

/**
 * Version 1 project schema: see CONTROL_SAFETY_TIMING.md alongside this module.
 * PASS checks supplied claims only. It never opens/authenticates evidenceRef or verifies a native restoration.
 */
export function evaluateControlSafetyTimingEvidence(evidence) {
  const schemaIssues = []; let input = {};
  try { input = copyData(evidence); }
  catch { schemaIssues.push('evidence: expected bounded plain data without accessors, cycles or executable values'); }
  if (!object(input)) { schemaIssues.push('evidence: expected an object'); input = {}; }
  keys(input, ['version', 'currentConfigHash', 'restorationObservations', 'humanYieldObservations'], 'evidence', schemaIssues);
  if (input.version !== 1) schemaIssues.push('evidence: version must be 1');
  if (!hash(input.currentConfigHash)) schemaIssues.push('evidence: currentConfigHash must be SHA-256 hex');
  const seen = new Set();
  const restoration = section(input, 'restoration', input.currentConfigHash, seen);
  const humanYield = section(input, 'humanYield', input.currentConfigHash, seen);
  const sections = [restoration, humanYield];
  const observedCount = sections.reduce((n, s) => n + s.observedCount, 0);
  const mockCount = sections.reduce((n, s) => n + s.mockCount, 0);
  if (observedCount && mockCount) schemaIssues.push('evidence: mock and game-observed claims cannot be combined');
  let status;
  if (schemaIssues.length || sections.some(s => s.status === 'INCOMPLETE')) status = 'INCOMPLETE';
  else if (sections.every(s => s.status === 'NOT_PERFORMED')) status = 'NOT_PERFORMED';
  else if (!observedCount && mockCount) status = 'MOCK_ONLY';
  else if (mockCount || sections.some(s => s.status === 'NOT_PERFORMED')) status = 'INCOMPLETE';
  else status = sections.some(s => s.status === 'FAIL') ? 'FAIL' : 'PASS';
  return { version: 1, status, scope: 'SUPPLIED_EVIDENCE_ONLY', nativeRuntimeVerified: false,
    currentConfigHash: hash(input.currentConfigHash) ? input.currentConfigHash.toLowerCase() : null,
    schemaIssues, restoration, humanYield,
    limitations: ['Provenance, clock, binding, configuration and confirmations are supplied assertions, not native verification.',
      'Evidence references are not opened or authenticated; independent source and measurement review is required.',
      'No sample quota, human-yield latency threshold, percentile, native ownership or release acceptance is established.'] };
}
