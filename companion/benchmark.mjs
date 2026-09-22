/** Pure project evidence checks. No telemetry capture, game access or authenticity proof. */
export const GiB = 1024 ** 3;
export const RELEASE_MODES = Object.freeze(['vanilla', 'tactical', 'direct']);
export const ENDURANCE_EXERCISE_KINDS = Object.freeze([
  'conversation', 'pause_resume', 'mech_swap', 'mission_transition', 'component_failure',
]);
export const SCENARIO_CELLS = Object.freeze([
  ['C01', 'assault', 'open', 'mixed ranges', 'balanced mech lance'],
  ['C02', 'assault', 'urban cover', 'short range', 'armored close assault'],
  ['C03', 'assault', 'broken terrain', 'long range', 'distant fire support'],
  ['C04', 'defense', 'open', 'mixed ranges', 'vehicles and VTOLs'],
  ['C05', 'defense', 'urban cover', 'short range', 'multiple approach directions'],
  ['C06', 'defense', 'broken terrain', 'long range', 'mobile flankers'],
  ['C07', 'objective raid', 'open', 'mixed ranges', 'pursuit during withdrawal'],
  ['C08', 'objective raid', 'urban cover', 'short range', 'turrets and obstacles'],
  ['C09', 'objective raid', 'broken terrain', 'long range', 'lost visibility'],
  ['C10', 'sustained engagement', 'open', 'mixed ranges', 'damage and heat pressure'],
  ['C11', 'sustained engagement', 'urban cover', 'short range', 'target changes'],
  ['C12', 'sustained engagement', 'broken terrain', 'long range', 'regroup under fire'],
].map(([scenarioId, objective, terrain, loadout, threat]) => Object.freeze({scenarioId, objective, terrain, loadout, threat})));

const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const id = x => typeof x === 'string' && x.trim().length > 0 && x.length <= 512;
const nonnegative = x => typeof x === 'number' && Number.isFinite(x) && x >= 0;
const bytes = x => Number.isSafeInteger(x) && x >= 0;
const bool = x => typeof x === 'boolean';
const finitePositiveArray = x => Array.isArray(x) && x.length > 0 && x.every(n => nonnegative(n) && n > 0);
const hash = x => typeof x === 'string' && /^[a-f0-9]{64}$/i.test(x);

/** Explicit sizes only; sum includes simultaneously held download, staging and cache. */
export function storagePreflight(input = {}) {
  if (!object(input)) input = {};
  const {freeBytes, downloadsBytes, stagingBytes, cacheBytes, reserveBytes = 10 * GiB} = input;
  const issues = [];
  for (const [name, value] of Object.entries({freeBytes, downloadsBytes, stagingBytes, cacheBytes, reserveBytes})) {
    if (!bytes(value)) issues.push(`${name}: a known nonnegative safe integer byte count is required`);
  }
  if (bytes(reserveBytes) && reserveBytes < 10 * GiB) issues.push('reserveBytes: cannot reduce the 10 GiB minimum reserve');
  if (issues.length) return {status: 'INCOMPLETE', ok: false, requiredBytes: null, remainingBytes: null, issues};
  const allocationBytes = downloadsBytes + stagingBytes + cacheBytes;
  const requiredBytes = allocationBytes + reserveBytes;
  if (!issues.length && !Number.isSafeInteger(requiredBytes)) issues.push('combined size exceeds safe integer precision');
  if (issues.length) return {status: 'INCOMPLETE', ok: false, requiredBytes: null, remainingBytes: null, issues};
  const remainingBytes = freeBytes - allocationBytes;
  const ok = freeBytes >= requiredBytes;
  return {status: ok ? 'PASS' : 'FAIL', ok, requiredBytes, remainingBytes, reserveBytes,
    issues: ok ? [] : ['insufficient space for simultaneous allocations and reserve']};
}

/** Nearest-rank percentile; no empty/nonfinite sample can become zero. */
export function percentile(values, fraction) {
  if (!Array.isArray(values) || !values.length || !values.every(nonnegative) || !Number.isFinite(fraction) || fraction <= 0 || fraction > 1) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.ceil(sorted.length * fraction) - 1];
}

function median(values) {
  if (!values.length || !values.every(x => typeof x === 'number' && Number.isFinite(x))) return null;
  const a = [...values].sort((x, y) => x - y), m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : a[m - 1] / 2 + a[m] / 2;
}
function frameMetrics(samples) {
  const sorted = [...samples].sort((a, b) => b - a);
  const worst = sorted.slice(0, Math.max(1, Math.ceil(samples.length * .01)));
  const meanWorst = worst.reduce((sum, n) => sum + n / worst.length, 0);
  return {p95Ms: percentile(samples, .95), onePercentLowFps: 1000 / meanWorst,
    stallsOver100MsPer1000Frames: samples.filter(n => n > 100).length / samples.length * 1000};
}
function getArray(e, field, issues) {
  if (e[field] === undefined) return [];
  if (!Array.isArray(e[field])) { issues.push(`${field}: expected an array`); return []; }
  return e[field];
}
function common(row, currentConfigHash, label, issues) {
  const before = issues.length;
  if (!object(row)) { issues.push(`${label}: expected an object`); return false; }
  if (!['GAME_OBSERVED', 'MOCK_ONLY'].includes(row.provenance)) issues.push(`${label}: unsupported or absent provenance`);
  if (!id(row.sessionId)) issues.push(`${label}: missing sessionId`);
  if (!id(row.evidenceRef)) issues.push(`${label}: missing inspectable evidenceRef`);
  if (!hash(row.configHash) || row.configHash !== currentConfigHash) issues.push(`${label}: configuration does not match currentConfigHash`);
  return before === issues.length;
}
function resourcesValid(row, label, issues) {
  if (!object(row.resources) || !bytes(row.resources.minAvailableRamBytes) || !bytes(row.resources.minAvailableVramBytes)) {
    issues.push(`${label}: minimum available RAM and VRAM byte counts are required`);
    return false;
  }
  return true;
}
function unique(value, seen, label, issues) {
  if (!id(value)) issues.push(`${label}: missing identifier`);
  else if (seen.has(value)) issues.push(`${label}: duplicate identifier ${value}`);
  else seen.add(value);
}
function enduranceSummary(row, currentConfigHash, label) {
  const issues = [], failures = [];
  common(row, currentConfigHash, label, issues);
  if (!object(row)) return {issues, failures};
  if (!hash(row.workloadHash)) issues.push(`${label}: predeclared workloadHash must be SHA-256 hex`);
  if (!nonnegative(row.durationMs) || !Number.isInteger(row.controlledAiCount) || !bool(row.allThreeActiveThroughout) ||
      !bool(row.noCrash) || !Number.isSafeInteger(row.humanOverrideFailures) || row.humanOverrideFailures < 0 ||
      !Number.isSafeInteger(row.wrongRecipientCommands) || row.wrongRecipientCommands < 0)
    issues.push(`${label}: invalid duration/coverage/failure evidence`);
  const validResources = resourcesValid(row, label, issues);
  if (nonnegative(row.durationMs) && row.durationMs < 60 * 60 * 1000) failures.push(`${label}: less than 60 uninterrupted minutes`);
  if ((Number.isInteger(row.controlledAiCount) && row.controlledAiCount !== 3) ||
      row.allThreeActiveThroughout === false || row.noCrash === false ||
      (Number.isSafeInteger(row.humanOverrideFailures) && row.humanOverrideFailures > 0) ||
      (Number.isSafeInteger(row.wrongRecipientCommands) && row.wrongRecipientCommands > 0))
    failures.push(`${label}: three-AI stability or human precedence failed`);
  if (validResources && (row.resources.minAvailableRamBytes < 2 * GiB || row.resources.minAvailableVramBytes < GiB))
    failures.push(`${label}: resource reserve violated`);
  if (!Array.isArray(row.exercises)) issues.push(`${label}: required exercise summaries are missing`);
  else {
    const seen = new Set();
    for (const [i, exercise] of row.exercises.entries()) {
      const name = `${label}.exercises[${i}]`;
      if (!object(exercise)) { issues.push(`${name}: expected an exercise summary`); continue; }
      if (!ENDURANCE_EXERCISE_KINDS.includes(exercise.kind)) issues.push(`${name}: unknown exercise kind`);
      else if (seen.has(exercise.kind)) issues.push(`${name}: duplicate exercise kind ${exercise.kind}`);
      else seen.add(exercise.kind);
      if (!id(exercise.evidenceRef) || !id(exercise.description)) issues.push(`${name}: evidenceRef and event/recovery description are required`);
      if (!['PASS', 'FAIL', 'NOT_PERFORMED'].includes(exercise.status)) issues.push(`${name}: unknown exercise status`);
      else if (exercise.status === 'NOT_PERFORMED') issues.push(`${name}: exercise not performed`);
      else if (exercise.status === 'FAIL') failures.push(`${name}: ${exercise.kind} exercise failed`);
    }
    for (const kind of ENDURANCE_EXERCISE_KINDS) if (!seen.has(kind)) issues.push(`${label}: missing ${kind} exercise`);
  }
  return {issues, failures};
}
function gate(items, minimum, issues, failures, metrics) {
  const observedCount = items.filter(x => x?.provenance === 'GAME_OBSERVED').length;
  const mockCount = items.filter(x => x?.provenance === 'MOCK_ONLY').length;
  let status;
  if (issues.length) status = 'INCOMPLETE';
  else if (items.length === 0) status = 'NOT_PERFORMED';
  else if (items.length < minimum) status = 'INCOMPLETE';
  else if (observedCount !== items.length) status = mockCount === items.length ? 'MOCK_ONLY' : 'INCOMPLETE';
  else status = failures.length ? 'FAIL' : 'PASS';
  return {status, accepted: status === 'PASS', requiredCount: minimum, suppliedCount: items.length, observedCount, mockCount,
    issues: [...issues, ...(items.length > 0 && items.length < minimum ? [`requires at least ${minimum} records`] : [])], failures, metrics};
}

/**
 * Schema v2 is documented in design/TACTICAL_EVALUATION_PROTOCOL.md.
 * A PASS checks supplied evidence only; evidenceRef content is never fetched/authenticated.
 */
export function evaluateReleaseEvidence(evidence) {
  const e = object(evidence) ? evidence : {};
  const schemaIssues = [];
  if (e.version !== 2) schemaIssues.push('version: expected 2; legacy evidence is not implicitly migrated');
  if (!hash(e.currentConfigHash)) schemaIssues.push('currentConfigHash: expected SHA-256 hex for the current evaluation configuration');
  const criticalReview = ['Evidence provenance, capture completeness and evidenceRef authenticity require independent human inspection.',
    'Voice ambiguity annotations, exercise descriptions and predeclared workload hashes require independent review; labels alone prove none of them.',
    'Passing this checker neither installs nor authorizes a game adapter; it is not proof of native order acceptance.'];
  const gates = {};

  const runIssues = [], runFailures = [], records = getArray(e, 'records', runIssues);
  const runMap = new Map(), sessions = new Set(), scenarioIds = new Set(SCENARIO_CELLS.map(x => x.scenarioId));
  for (const [i, r] of records.entries()) {
    const label = `records[${i}]`, start = runIssues.length;
    common(r, e.currentConfigHash, label, runIssues);
    if (!object(r)) continue;
    if (!scenarioIds.has(r.scenarioId) || !Number.isInteger(r.rep) || r.rep < 1 || r.rep > 3 || !RELEASE_MODES.includes(r.mode)) runIssues.push(`${label}: unknown scenario/rep/mode`);
    unique(r.sessionId, sessions, `${label}.sessionId`, runIssues);
    if (!bool(r.missionSuccess) || !Number.isInteger(r.lanceLosses) || r.lanceLosses < 0 || r.lanceLosses > 3) runIssues.push(`${label}: invalid success/lance loss result`);
    if (!nonnegative(r.damageDealt) || !nonnegative(r.damageTaken)) runIssues.push(`${label}: damage must be finite and nonnegative`);
    if (!finitePositiveArray(r.frameTimesMs)) runIssues.push(`${label}: nonempty finite positive frame times are required`);
    if (r.mode !== 'vanilla') resourcesValid(r, label, runIssues);
    const key = `${r.scenarioId}/${r.rep}/${r.mode}`;
    if (runMap.has(key)) runIssues.push(`${label}: duplicate scenario/rep/mode ${key}`);
    if (runIssues.length === start) runMap.set(key, r);
  }
  const missingPairs = [];
  for (const s of SCENARIO_CELLS) for (let rep = 1; rep <= 3; rep++) for (const mode of RELEASE_MODES) {
    const key = `${s.scenarioId}/${rep}/${mode}`;
    if (!runMap.has(key)) missingPairs.push(key);
  }
  if (records.length && missingPairs.length) runIssues.push(`missing/invalid run cells: ${missingPairs.join(', ')}`);
  const comparisons = {};
  for (const mode of ['tactical', 'direct']) {
    const improvements = [], baselineEfficiencies = [], candidateEfficiencies = [], p95Ratios = [], lowFpsRatios = [], stalls = [];
    let baselineSuccesses = 0, candidateSuccesses = 0, baselineLosses = 0, candidateLosses = 0;
    for (const s of SCENARIO_CELLS) for (let rep = 1; rep <= 3; rep++) {
      const a = runMap.get(`${s.scenarioId}/${rep}/vanilla`), b = runMap.get(`${s.scenarioId}/${rep}/${mode}`);
      if (!a || !b) continue;
      if (a.configHash !== b.configHash) { runIssues.push(`${s.scenarioId}/${rep}: unmatched comparison configuration`); continue; }
      const baselineEfficiency = a.damageDealt / Math.max(1, a.damageTaken);
      const candidateEfficiency = b.damageDealt / Math.max(1, b.damageTaken);
      baselineEfficiencies.push(baselineEfficiency); candidateEfficiencies.push(candidateEfficiency);
      const improvement = candidateEfficiency / baselineEfficiency - 1;
      if (baselineEfficiency > 0 && Number.isFinite(improvement)) improvements.push(improvement);
      else criticalReview.push(`${s.scenarioId}/${rep}/${mode}: paired percentage improvement undefined; excluded from advisory paired median`);
      const af = frameMetrics(a.frameTimesMs), bf = frameMetrics(b.frameTimesMs);
      const p95Ratio = bf.p95Ms / af.p95Ms, lowRatio = bf.onePercentLowFps / af.onePercentLowFps;
      if (![...Object.values(af), ...Object.values(bf), p95Ratio, lowRatio].every(Number.isFinite)) {
        runIssues.push(`${s.scenarioId}/${rep}/${mode}: derived frame metrics exceed numeric range`);
        continue;
      }
      p95Ratios.push(p95Ratio);
      lowFpsRatios.push(lowRatio);
      stalls.push(bf.stallsOver100MsPer1000Frames - af.stallsOver100MsPer1000Frames);
      baselineSuccesses += Number(a.missionSuccess); candidateSuccesses += Number(b.missionSuccess);
      baselineLosses += a.lanceLosses; candidateLosses += b.lanceLosses;
      if (Number(b.missionSuccess) < Number(a.missionSuccess) || b.lanceLosses > a.lanceLosses) criticalReview.push(`${s.scenarioId}/${rep}/${mode}: mission/survival regression; inspect even if aggregate thresholds pass`);
      if (b.resources.minAvailableRamBytes < 2 * GiB || b.resources.minAvailableVramBytes < GiB) runFailures.push(`${s.scenarioId}/${rep}/${mode}: resource reserve violated`);
    }
    const baselineMedianEfficiency = median(baselineEfficiencies), candidateMedianEfficiency = median(candidateEfficiencies);
    let improvement = baselineMedianEfficiency > 0 ? candidateMedianEfficiency / baselineMedianEfficiency - 1 : null;
    if (baselineEfficiencies.length && (improvement === null || !Number.isFinite(improvement))) {
      runIssues.push(`${mode}: relative improvement between median damage efficiencies is undefined`);
      improvement = null;
    }
    comparisons[mode] = {pairedRuns: p95Ratios.length, medianDamageEfficiencyImprovement: improvement,
      baselineMedianEfficiency, candidateMedianEfficiency, advisoryMedianPairedPercentageImprovement: median(improvements),
      advisoryDefinedPairedPercentageCount: improvements.length,
      baselineSuccesses, candidateSuccesses, baselineLosses, candidateLosses,
      worstP95FrameTimeRatio: p95Ratios.length ? Math.max(...p95Ratios) : null,
      worstOnePercentLowFpsRatio: lowFpsRatios.length ? Math.min(...lowFpsRatios) : null,
      worstAdditionalStallsPer1000Frames: stalls.length ? Math.max(...stalls) : null};
    if (improvement !== null && improvement + 1e-12 < .10) runFailures.push(`${mode}: median damage-efficiency improvement is below 10%`);
    if (candidateSuccesses < baselineSuccesses || candidateLosses > baselineLosses) runFailures.push(`${mode}: aggregate mission success or lance survival is worse than vanilla`);
    if (p95Ratios.some(n => n > 1.10 + 1e-12)) runFailures.push(`${mode}: p95 frame-time budget exceeded in at least one pair`);
    if (lowFpsRatios.some(n => n < .90 - 1e-12) || stalls.some(n => n > 1e-12)) criticalReview.push(`${mode}: advisory 1%-low/stall regression; no additional release threshold was approved`);
  }
  gates.gameplay = gate(records, 108, runIssues, runFailures, {missingPairs, comparisons});

  const styleIssues = [], styleFailures = [], calibrationSessions = getArray(e, 'calibrationSessions', styleIssues);
  const decisions = getArray(e, 'styleHeldOutDecisions', styleIssues), calibrationIds = new Set(), decisionIds = new Set();
  for (const [i, r] of calibrationSessions.entries()) {
    common(r, e.currentConfigHash, `calibrationSessions[${i}]`, styleIssues);
    if (object(r)) unique(r.sessionId, calibrationIds, `calibrationSessions[${i}].sessionId`, styleIssues);
  }
  if (decisions.length && !calibrationSessions.length) styleIssues.push('separate calibrationSessions are required');
  if (decisions.some(r => r?.provenance === 'GAME_OBSERVED') && calibrationSessions.some(r => r?.provenance !== 'GAME_OBSERVED')) styleIssues.push('real held-out evaluation requires real calibration provenance');
  for (const [i, r] of decisions.entries()) {
    common(r, e.currentConfigHash, `styleHeldOutDecisions[${i}]`, styleIssues);
    if (!object(r)) continue;
    unique(r.decisionId, decisionIds, `styleHeldOutDecisions[${i}].decisionId`, styleIssues);
    if (calibrationIds.has(r.sessionId)) styleIssues.push(`styleHeldOutDecisions[${i}]: calibration/held-out session leakage`);
    if (!bool(r.acceptable) || r.userReviewed !== true) styleIssues.push(`styleHeldOutDecisions[${i}]: requires user's explicit acceptability review`);
  }
  const acceptanceRate = decisions.length ? decisions.filter(r => r?.acceptable === true && r?.userReviewed === true).length / decisions.length : null;
  if (acceptanceRate !== null && acceptanceRate < .8) styleFailures.push('held-out personal-style acceptability is below 80%');
  gates.personalStyle = gate(decisions, 40, styleIssues, styleFailures, {acceptanceRate, calibrationSessionCount: calibrationSessions.length});

  const voiceIssues = [], voiceFailures = [], voice = getArray(e, 'voiceRecordings', voiceIssues), recordingIds = new Set();
  for (const [i, r] of voice.entries()) {
    common(r, e.currentConfigHash, `voiceRecordings[${i}]`, voiceIssues);
    if (!object(r)) continue;
    unique(r.recordingId, recordingIds, `voiceRecordings[${i}].recordingId`, voiceIssues);
    if (!bool(r.ambiguous)) voiceIssues.push(`voiceRecordings[${i}]: independent ambiguity annotation is required`);
    if (!bool(r.intentCorrect) || !bool(r.recipientCorrect) || !nonnegative(r.finalTranscriptMs) || !bool(r.dispatchAttempted) || (r.dispatchAttempted && !bool(r.dispatchRecipientCorrect))) voiceIssues.push(`voiceRecordings[${i}]: invalid correctness/dispatch/latency evidence`);
    if (r.dispatchAttempted && r.dispatchRecipientCorrect === false) voiceFailures.push(`voiceRecordings[${i}]: wrong-recipient dispatch`);
    if (r.ambiguous === true && r.dispatchAttempted === true) voiceFailures.push(`voiceRecordings[${i}]: ambiguous command was dispatched`);
  }
  const annotatedAmbiguousCount = voice.filter(r => r?.ambiguous === true).length;
  const ambiguousDispatchCount = voice.filter(r => r?.ambiguous === true && r?.dispatchAttempted === true).length;
  if (voice.length && annotatedAmbiguousCount === 0) voiceIssues.push('annotated ambiguous recordings are required to evaluate withholding behavior');
  const correctRate = voice.length ? voice.filter(r => r?.intentCorrect === true && r?.recipientCorrect === true).length / voice.length : null;
  const sttP95Ms = percentile(voice.map(r => r?.finalTranscriptMs), .95);
  if (correctRate !== null && correctRate < .95) voiceFailures.push('joint intent/recipient accuracy is below 95%');
  if (sttP95Ms !== null && sttP95Ms > 1500) voiceFailures.push('p95 end-of-push-to-talk to final transcript exceeds 1500 ms');
  gates.voiceCommands = gate(voice, 100, voiceIssues, voiceFailures, {correctRate, sttP95Ms, annotatedAmbiguousCount, ambiguousDispatchCount});

  const talkIssues = [], talkFailures = [], conversation = getArray(e, 'conversationSamples', talkIssues), sampleIds = new Set();
  for (const [i, r] of conversation.entries()) {
    common(r, e.currentConfigHash, `conversationSamples[${i}]`, talkIssues);
    if (!object(r)) continue;
    unique(r.sampleId, sampleIds, `conversationSamples[${i}].sampleId`, talkIssues);
    if (!nonnegative(r.firstAudioMs) || !bool(r.grounded) || !bool(r.speakerCorrect)) talkIssues.push(`conversationSamples[${i}]: invalid latency/grounding/speaker evidence`);
    if (r.grounded === false || r.speakerCorrect === false) talkFailures.push(`conversationSamples[${i}]: invented state or incorrect speaker`);
  }
  const firstAudioP95Ms = percentile(conversation.map(r => r?.firstAudioMs), .95);
  if (firstAudioP95Ms !== null && firstAudioP95Ms > 4000) talkFailures.push('p95 input completion to first audio exceeds 4000 ms');
  gates.conversation = gate(conversation, 1, talkIssues, talkFailures, {firstAudioP95Ms});

  const enduranceIssues = [], enduranceFailures = [], endurance = getArray(e, 'enduranceSessions', enduranceIssues), enduranceIds = new Set();
  const enduranceBySession = new Map();
  for (const [i, r] of endurance.entries()) {
    const result = enduranceSummary(r, e.currentConfigHash, `enduranceSessions[${i}]`);
    enduranceIssues.push(...result.issues); enduranceFailures.push(...result.failures);
    if (!object(r)) continue;
    unique(r.sessionId, enduranceIds, `enduranceSessions[${i}].sessionId`, enduranceIssues);
    if (id(r.sessionId)) {
      const matches = enduranceBySession.get(r.sessionId) ?? [];
      matches.push({row:r, ...result}); enduranceBySession.set(r.sessionId, matches);
    }
  }
  gates.endurance = gate(endurance, 1, enduranceIssues, enduranceFailures,
    {requiredDurationMs: 3600000, requiredExercises: ENDURANCE_EXERCISE_KINDS});

  const offlineIssues = [], offlineFailures = [], offline = getArray(e, 'offlineWorkloads', offlineIssues), offlineIds = new Set();
  for (const [i, r] of offline.entries()) {
    const label = `offlineWorkloads[${i}]`, result = enduranceSummary(r, e.currentConfigHash, label);
    offlineIssues.push(...result.issues); offlineFailures.push(...result.failures);
    if (!object(r)) continue;
    unique(r.sessionId, offlineIds, `offlineWorkloads[${i}].sessionId`, offlineIssues);
    if (!bool(r.networkDisconnected) || !bool(r.allComponentsLocal) || !bool(r.workloadCompleted) || !Number.isSafeInteger(r.paidApiCalls) || r.paidApiCalls < 0) offlineIssues.push(`offlineWorkloads[${i}]: invalid offline workload evidence`);
    if (r.networkDisconnected !== true || r.allComponentsLocal !== true || r.workloadCompleted !== true || r.paidApiCalls !== 0) offlineFailures.push(`offlineWorkloads[${i}]: disconnected zero-API workload not demonstrated`);
    const matches = id(r.repeatsSessionId) ? enduranceBySession.get(r.repeatsSessionId) ?? [] : [];
    if (matches.length !== 1) offlineIssues.push(`${label}: repeatsSessionId must identify one distinct endurance session`);
    if (r.sessionId === r.repeatsSessionId || enduranceIds.has(r.sessionId)) offlineIssues.push(`${label}: offline repeat must use a distinct sessionId`);
    if (matches.length === 1) {
      const source = matches[0];
      if (source.row.configHash !== r.configHash || source.row.provenance !== r.provenance || source.row.workloadHash !== r.workloadHash)
        offlineIssues.push(`${label}: referenced endurance configuration/provenance/workload does not match`);
      if (source.issues.length) offlineIssues.push(`${label}: referenced endurance session is incomplete`);
      if (source.failures.length) offlineFailures.push(`${label}: referenced endurance session failed acceptance`);
    }
  }
  gates.offline = gate(offline, 1, offlineIssues, offlineFailures,
    {requiredDurationMs: 3600000, requiredExercises: ENDURANCE_EXERCISE_KINDS});

  const results = Object.values(gates), accepted = !schemaIssues.length && results.every(g => g.accepted);
  let status = accepted ? 'PASS' : 'INCOMPLETE';
  if (!schemaIssues.length && results.every(g => g.status === 'NOT_PERFORMED')) status = 'NOT_PERFORMED';
  else if (!schemaIssues.length && results.every(g => ['MOCK_ONLY', 'NOT_PERFORMED'].includes(g.status)) && results.some(g => g.status === 'MOCK_ONLY')) status = 'MOCK_ONLY';
  else if (!schemaIssues.length && results.some(g => g.status === 'FAIL')) status = 'FAIL';
  return {version: 2, status, accepted, scope: 'SUPPLIED_RELEASE_EVIDENCE_ONLY', currentConfigHash: hash(e.currentConfigHash) ? e.currentConfigHash : null,
    schemaIssues, gates, criticalReview};
}
