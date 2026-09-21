// Closed-vocabulary PROJECT interface, not an MW5 API or truth attestation.
// The current adapter is absent. Even structurally valid caller evidence is
// never game-verified, live-eligible, a command, or permission to play audio.
import { types } from 'node:util';
export const MISSION_SPEECH_LIMITS = Object.freeze({ maxAgeMs: 5000, reports: 64 });
const idOk = x => typeof x === 'string' && /^[A-Za-z0-9_.:-]{1,128}$/.test(x);
const timeOk = x => Number.isFinite(x) && x >= 0;
const sources = Object.freeze({ SUBMITTED: 'DISPATCH_RECEIPT', ASSIGNED: 'NATIVE_ASSIGNMENT',
  BEHAVIOR_OBSERVED: 'INDEPENDENT_OBSERVATION', COMPLETED: 'MATCHED_COMPLETION', REJECTED: 'DISPATCH_REJECTION' });
const actions = Object.freeze({ regroup: 'regroup', focus: 'focus-target', reposition: 'reposition' });
const reject = reason => ({ status: 'REJECTED', reason, liveEligible: false, dispatchable: false });

function copy(input) {
  const ancestors = new Set(); let count = 0;
  function visit(v, depth) {
    if (++count > 6000 || depth > 10) throw new Error('DATA_LIMIT');
    if (v === null || typeof v === 'boolean' || (typeof v === 'number' && Number.isFinite(v)) ||
        (typeof v === 'string' && v.length <= 1024)) return v;
    if (!v || typeof v !== 'object' || types.isProxy(v) || ancestors.has(v) || (!Array.isArray(v) &&
        ![Object.prototype, null].includes(Object.getPrototypeOf(v)))) throw new Error('INVALID_DATA');
    ancestors.add(v); const out = Array.isArray(v) ? [] : {};
    const ownKeys = Reflect.ownKeys(v);
    if (ownKeys.length > 1000 || ownKeys.some(k => typeof k !== 'string' || k.length > 128)) throw new Error('DATA_LIMIT');
    for (const key of ownKeys.sort()) {
      if (Array.isArray(v) && key === 'length') continue;
      const d = Object.getOwnPropertyDescriptor(v, key);
      if (typeof key !== 'string' || ['__proto__', 'constructor', 'prototype'].includes(key) ||
          !d?.enumerable || !Object.hasOwn(d, 'value')) throw new Error('INVALID_DATA');
      out[key] = visit(d.value, depth + 1);
    }
    if (Array.isArray(v) && (out.length !== v.length || Object.keys(out).length !== v.length)) throw new Error('INVALID_DATA');
    ancestors.delete(v); return out;
  }
  return visit(input, 0);
}
function keys(x, required, optional = []) {
  return x && !Array.isArray(x) && typeof x === 'object' && required.every(k => Object.hasOwn(x, k)) &&
    Object.keys(x).every(k => required.includes(k) || optional.includes(k));
}
function bindingOk(b) {
  return keys(b, ['id', 'pawnId', 'generation', 'aiOwned', 'alive']) && idOk(b.id) && idOk(b.pawnId) &&
    Number.isSafeInteger(b.generation) && b.generation > 0 && typeof b.aiOwned === 'boolean' && typeof b.alive === 'boolean';
}
function reportOk(r) {
  return keys(r, ['id','session','actorId','pawnId','generation','actionId','action','stage','source','classification','observedAtMs','expiresAtMs']) &&
    ['id','session','actorId','pawnId','actionId'].every(k => idOk(r[k])) &&
    Number.isSafeInteger(r.generation) && r.generation > 0 && Object.hasOwn(actions, r.action) &&
    Object.hasOwn(sources, r.stage) && sources[r.stage] === r.source &&
    ['MOCK_ONLY', 'CALLER_ASSERTED_EVIDENCE'].includes(r.classification) &&
    timeOk(r.observedAtMs) && timeOk(r.expiresAtMs) && r.expiresAtMs > r.observedAtMs &&
    r.expiresAtMs <= r.observedAtMs + MISSION_SPEECH_LIMITS.maxAgeMs;
}
function actionText(r) {
  const name = actions[r.action];
  const text = {
    SUBMITTED: `My ${name} request was submitted. Acceptance is unconfirmed.`,
    ASSIGNED: `My ${name} order was assigned. Execution is unconfirmed.`,
    BEHAVIOR_OBSERVED: `My ${name} behavior was observed. Completion is unconfirmed.`,
    COMPLETED: `My ${name} action has a matching completion report.`,
    REJECTED: `My ${name} request was rejected.`
  }[r.stage];
  return (r.classification === 'MOCK_ONLY' ? 'Simulation: ' : 'Unverified report: ') + text;
}

export function prepareMissionSpeech(request, context) {
  let r, c;
  try { r = copy(request); c = copy(context); } catch { return reject('INVALID_DATA'); }
  if (!keys(r, ['id','session','speakerId','pawnId','generation','query'], ['actionId','targetId']) ||
      !['id','session','speakerId','pawnId'].every(k => idOk(r[k])) ||
      !Number.isSafeInteger(r.generation) || r.generation < 1 ||
      !['action_status','mission_outcome','target_status'].includes(r.query) ||
      (r.query === 'action_status' ? !idOk(r.actionId) : Object.hasOwn(r, 'actionId')) ||
      (r.query === 'target_status' ? !idOk(r.targetId) : Object.hasOwn(r, 'targetId'))) return reject('INVALID_REQUEST');
  if (!keys(c, ['session','nowMs','phase','bindings','reports']) || !idOk(c.session) || !timeOk(c.nowMs) ||
      !Array.isArray(c.bindings) || c.bindings.length < 1 || c.bindings.length > 3 || !c.bindings.every(bindingOk) ||
      ['id', 'pawnId'].some(k => new Set(c.bindings.map(b => b[k])).size !== c.bindings.length) ||
      !Array.isArray(c.reports) || c.reports.length > MISSION_SPEECH_LIMITS.reports || !c.reports.every(reportOk) ||
      new Set(c.reports.map(x => x.id)).size !== c.reports.length) return reject('INVALID_CONTEXT');
  if (r.session !== c.session || c.phase !== 'active') return reject('INACTIVE_SESSION');
  const b = c.bindings.find(x => x.id === r.speakerId);
  if (!b || b.pawnId !== r.pawnId || b.generation !== r.generation || !b.aiOwned || !b.alive) return reject('INELIGIBLE_SPEAKER');
  let report = null, text;
  if (r.query === 'action_status') {
    const matches = c.reports.filter(x => x.actionId === r.actionId);
    if (matches.length > 1) return reject('CONFLICTING_REPORTS');
    report = matches[0] ?? null;
    if (report && (report.session !== r.session || report.actorId !== r.speakerId || report.pawnId !== r.pawnId ||
        report.generation !== r.generation)) return reject('REPORT_BINDING_MISMATCH');
    if (report && (report.observedAtMs > c.nowMs || report.expiresAtMs <= c.nowMs ||
        c.nowMs - report.observedAtMs > MISSION_SPEECH_LIMITS.maxAgeMs)) return reject('REPORT_STALE');
    text = report ? actionText(report) : 'I have no current report for that action.';
  } else if (r.query === 'mission_outcome') text = 'I cannot confirm the mission outcome.';
  else text = 'I cannot confirm that target\'s status.';
  return { schemaVersion: 1, status: 'PREPARED', request: r, text, evidence: report,
    classification: report?.classification ?? 'PROJECT_ONLY', grounding: 'AUTHORED_TEMPLATE_ONLY',
    createdAtMs: c.nowMs, expiresAtMs: Math.min(c.nowMs + MISSION_SPEECH_LIMITS.maxAgeMs, report?.expiresAtMs ?? Infinity),
    liveEligible: false, dispatchable: false, audioGenerated: false };
}

// Recompute words from current evidence; caller-supplied text is never authority.
// This is a schema/entailment check, not a signature or a verified adapter.
export function revalidateMissionSpeech(prepared, context) {
  let p, c;
  try { p = copy(prepared); c = copy(context); } catch { return reject('INVALID_DATA'); }
  if (p?.status !== 'PREPARED' || !timeOk(p.createdAtMs) || !timeOk(p.expiresAtMs) ||
      !timeOk(c?.nowMs) || c.nowMs < p.createdAtMs || c.nowMs >= p.expiresAtMs) return reject('LINE_EXPIRED_OR_INVALID');
  const fresh = prepareMissionSpeech(p.request, c);
  if (fresh.status !== 'PREPARED') return fresh;
  const originalTime = prepareMissionSpeech(p.request, { ...c, nowMs: p.createdAtMs });
  if (JSON.stringify(copy(originalTime)) !== JSON.stringify(p)) return reject('TEXT_OR_EVIDENCE_CHANGED');
  return { status: 'VALID', liveEligible: false, dispatchable: false, classification: p.classification };
}
