// Project control contract. No MW5 API, native adapter, transport, or live dispatch.
import { types as utilTypes } from 'node:util';
import { decideSquad } from '../scripts/tactical-policy.mjs';
import { validateObservation } from './observation.mjs';

const copy = value => structuredClone(value);
const validId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(value) &&
  !['__proto__', 'constructor', 'prototype'].includes(value);
const actions = new Set(['REGROUP', 'FOCUS', 'REPOSITION']);
const phases = ['SUBMITTED', 'ASSIGNED', 'BEHAVIOR_OBSERVED', 'COMPLETED', 'REJECTED'];
const fingerprint = actor => `${actor.controllerId}:${actor.pawnId}:${actor.generation}`;
const resultLimits = Object.freeze({ depth: 8, nodes: 256, keys: 32, stringUnits: 4096, evidenceUnits: 256 });

// Like observation admission, accept detached JSON data, never caller hooks.
// These are in-memory bounds; a future transport must separately bound bytes.
function copyResultRecord(value) {
  if (value === null || typeof value !== 'object' || utilTypes.isProxy(value) || Array.isArray(value))
    throw new Error('INVALID_RESULT_RECORD');
  const stack = new Set(); let nodes = 0; let stringUnits = 0;
  function visit(x, depth) {
    if (++nodes > resultLimits.nodes || depth > resultLimits.depth) throw new Error('RESULT_RECORD_LIMIT');
    if (typeof x === 'string') {
      stringUnits += x.length;
      if (stringUnits > resultLimits.stringUnits) throw new Error('RESULT_STRING_LIMIT');
      return x;
    }
    if (x === null || typeof x === 'boolean' || (typeof x === 'number' && Number.isFinite(x))) return x;
    if (typeof x !== 'object' || utilTypes.isProxy(x) || stack.has(x)) throw new Error('NON_JSON_RESULT');
    const array = Array.isArray(x); const proto = Object.getPrototypeOf(x);
    if (array ? proto !== Array.prototype : proto !== Object.prototype && proto !== null)
      throw new Error('NON_PLAIN_RESULT');
    const arrayLength = array ? Object.getOwnPropertyDescriptor(x, 'length').value : null;
    if (array && arrayLength > resultLimits.keys) throw new Error('RESULT_ARRAY_LIMIT');
    const keys = Reflect.ownKeys(x);
    if (keys.length > resultLimits.keys + (array ? 1 : 0)) throw new Error('RESULT_KEY_LIMIT');
    if (array) {
      if (keys.length !== arrayLength + 1) throw new Error('EXTENDED_RESULT_ARRAY');
      for (let index = 0; index < arrayLength; index++)
        if (!Object.hasOwn(x, String(index))) throw new Error('SPARSE_RESULT_ARRAY');
    }
    stack.add(x);
    const out = array ? [] : Object.create(null);
    for (const key of keys) {
      if (array && key === 'length') continue;
      if (typeof key !== 'string' || ['__proto__', 'constructor', 'prototype'].includes(key))
        throw new Error('INVALID_RESULT_KEY');
      stringUnits += key.length;
      if (stringUnits > resultLimits.stringUnits) throw new Error('RESULT_STRING_LIMIT');
      const descriptor = Object.getOwnPropertyDescriptor(x, key);
      if (!descriptor || !Object.hasOwn(descriptor, 'value') || !descriptor.enumerable)
        throw new Error('NON_DATA_RESULT_PROPERTY');
      out[key] = visit(descriptor.value, depth + 1);
    }
    stack.delete(x);
    return out;
  }
  return visit(value, 0);
}

export const CAPABILITIES = Object.freeze(['REGROUP', 'FOCUS', 'REPOSITION', 'MOVEMENT', 'AIM', 'FIRE', 'HEAT']
  .map(action => Object.freeze({ action, evidence: ['REGROUP', 'FOCUS', 'REPOSITION'].includes(action)
    ? 'SOURCE_SUPPORTED' : 'UNVERIFIED', enabled: false, gameVerified: false })));

export class ControlSession {
  constructor({ mode = 'DISCONNECTED', now = () => Date.now(), mockSink = null, maxPending = 16,
    maxRemembered = 2048, maxSessions = 256 } = {}) {
    if (!['DISCONNECTED', 'MOCK_ONLY'].includes(mode)) throw new Error('LIVE_ADAPTER_UNAVAILABLE');
    if (typeof now !== 'function' || (mockSink !== null && typeof mockSink !== 'function') ||
        !Number.isSafeInteger(maxPending) || maxPending < 1 || maxPending > 64 ||
        !Number.isSafeInteger(maxRemembered) || maxRemembered < 1 || maxRemembered > 10000 ||
        !Number.isSafeInteger(maxSessions) || maxSessions < 1 || maxSessions > 1000) throw new Error('INVALID_OPTIONS');
    if (mockSink && mode !== 'MOCK_ONLY') throw new Error('MOCK_SINK_REQUIRES_EXPLICIT_MOCK_MODE');
    this.mode = mode; this.now = now; this.mockSink = mockSink; this.maxPending = maxPending;
    this.maxRemembered = maxRemembered; this.maxSessions = maxSessions;
    this.armed = false; this.session = null; this.retired = new Set(); this.previousFrame = null;
    this.continuity = null;
    this.frame = null; this.policyState = null; this.recommendations = []; this.queue = [];
    this.seen = new Set(); this.ledger = new Map(); this.audit = []; this.enabled = new Set();
    // Rate-limit timestamps outlive mission permissions and are bounded independently of the ledger.
    this.lastDispatchByActor = new Map();
    this.latestDispatchAtMs = null;
  }
  log(type, details = {}) {
    this.audit.push({ type, atMs: this.now(), classification: this.mode, ...copy(details) });
    if (this.audit.length > 256) this.audit.shift();
  }
  disarm(reason = 'USER_DISARM') {
    const discarded = this.queue.map(i => i.id); this.queue = []; this.armed = false;
    this.log('DISARMED', { reason, discarded }); return { status: 'DISARMED', discarded };
  }
  armSimulation(actorIds) {
    if (this.mode !== 'MOCK_ONLY' || !this.frame || this.frame.provenance !== 'MOCK_ONLY')
      return { status: 'REJECTED', reason: 'LIVE_ADAPTER_UNAVAILABLE' };
    const eligible = this.frame.snapshot.lancemates;
    if (!Array.isArray(actorIds) || !actorIds.length || !actorIds.every(id =>
      validId(id) && eligible.some(a => a.id === id && a.aiOwned === true)) || new Set(actorIds).size !== actorIds.length)
      return { status: 'REJECTED', reason: 'INVALID_RECIPIENTS' };
    this.enabled = new Set(actorIds); this.armed = true; this.log('SIMULATION_ARMED', { actorIds });
    return { status: 'MOCK_ONLY', armed: true, nativeDispatchEnabled: false };
  }
  ingest(frame) {
    // Validate data properties before reading any caller-supplied field.
    let validation = validateObservation(frame, { nowMs: this.now(), continuity: this.continuity,
      allowSynthetic: this.mode === 'MOCK_ONLY' });
    const session = validation.snapshot?.session;
    if (session && this.retired.has(session)) {
      this.frame = null; this.recommendations = []; this.disarm('RETIRED_SESSION');
      return { ok: false, errors: ['RETIRED_SESSION'], recommendations: [] };
    }
    if (session && this.previousFrame?.session === session) validation = validateObservation(frame,
      { nowMs: this.now(), previousFrame: this.previousFrame, continuity: this.continuity,
        allowSynthetic: this.mode === 'MOCK_ONLY' });
    // All new observations supersede queued intentions. Nothing waits across a pause.
    this.queue = [];
    if (!validation.snapshot) {
      this.frame = null; this.recommendations = []; this.disarm('OBSERVATION_REJECTED');
      return { ...validation, recommendations: [] };
    }
    if (this.session !== frame.session) {
      if (this.session !== null && this.retired.size >= this.maxSessions) {
        this.frame = null; this.recommendations = []; this.disarm('SESSION_HISTORY_FULL');
        return { ok: false, errors: ['SESSION_HISTORY_FULL_RESTART_REQUIRED'], recommendations: [] };
      }
      if (this.session !== null) this.retired.add(this.session);
      this.disarm('SESSION_CHANGED'); this.session = frame.session; this.policyState = null;
      this.enabled.clear(); this.seen.clear(); this.ledger.clear();
    }
    const snapshot = copy(validation.snapshot);
    this.continuity = copy(validation.nextContinuity);
    // Retain fresh active human holds on a failed control frame, never release them.
    if (!validation.ok) snapshot.authority = false;
    const decision = decideSquad(snapshot, this.policyState);
    this.policyState = decision.state; this.previousFrame = copy(frame);
    this.recommendations = decision.recommendations;
    this.frame = validation.ok ? { ...copy(frame), snapshot: copy(validation.snapshot) } : null;
    if (!validation.ok || snapshot.phase !== 'active') this.disarm('CONTROL_PREREQUISITES_LOST');
    this.log('OBSERVATION', { session: frame.session, sequence: frame.sequence, ok: validation.ok });
    return { ...validation, recommendations: copy(this.recommendations), dispatchable: false };
  }
  queueRecommendations() {
    if (this.mode !== 'MOCK_ONLY' || !this.armed || !this.frame || this.frame.provenance !== 'MOCK_ONLY')
      return { status: 'REJECTED', reason: 'SIMULATION_NOT_ARMED_OR_NO_LIVE_ADAPTER', queued: [] };
    const queued = []; const rejected = []; const clock = this.now();
    for (const recommendation of this.recommendations) {
      if (!actions.has(recommendation.action) || !this.enabled.has(recommendation.actorId)) continue;
      const actor = this.frame.snapshot.lancemates.find(a => a.id === recommendation.actorId);
      const id = `${this.session}:${actor.id}:${this.frame.sequence}:${recommendation.action}`;
      const intent = { schemaVersion: 1, kind: 'tactical_intent', id, session: this.session,
        actorId: actor.id, binding: fingerprint(actor), observationSequence: this.frame.sequence,
        action: recommendation.action, targetId: recommendation.targetId ?? null,
        positionId: recommendation.positionId ?? null, createdAtMs: clock, expiresAtMs: clock + 500,
        classification: 'MOCK_ONLY', dispatchable: false, evidence: copy(recommendation.evidence) };
      const reason = this.reasonToReject(intent, clock);
      if (reason) { rejected.push({ id, reason }); continue; }
      if (this.seen.has(id) || this.queue.some(i => i.id === id)) { rejected.push({ id, reason: 'DUPLICATE' }); continue; }
      if (this.seen.size + this.queue.length >= this.maxRemembered) { rejected.push({ id, reason: 'HISTORY_FULL' }); continue; }
      if (this.queue.length >= this.maxPending) { rejected.push({ id, reason: 'QUEUE_FULL' }); continue; }
      this.queue.push(intent); queued.push(copy(intent));
    }
    return { status: 'MOCK_ONLY', queued, rejected };
  }
  reasonToReject(intent, clock = this.now()) {
    if (this.mode !== 'MOCK_ONLY' || !this.armed || !this.frame || this.frame.provenance !== 'MOCK_ONLY') return 'NOT_ARMED';
    const s = this.frame.snapshot;
    if (!Number.isSafeInteger(clock) || (this.latestDispatchAtMs !== null && clock < this.latestDispatchAtMs) ||
        clock < intent.createdAtMs || clock >= intent.expiresAtMs ||
        clock < s.observedAtMs || clock - s.observedAtMs > 1000) return 'EXPIRED_OR_INVALID_CLOCK';
    if (intent.session !== this.session || intent.observationSequence !== this.frame.sequence) return 'SUPERSEDED_OBSERVATION';
    if (s.phase !== 'active' || s.authority !== true) return 'INACTIVE_OR_UNKNOWN_AUTHORITY';
    const actor = s.lancemates.find(a => a.id === intent.actorId);
    if (!actor || fingerprint(actor) !== intent.binding || actor.aiOwned !== true || actor.alive !== true ||
        actor.member !== true || actor.reciprocalBinding !== true || actor.configured !== true || actor.authority !== true)
      return 'INVALID_BINDING';
    if (!this.enabled.has(actor.id)) return 'RECIPIENT_DISABLED';
    if (this.policyState?.actors?.[actor.id]?.heldHumanOrder || actor.manual?.observable !== true ||
        actor.manual.status === 'active') return 'HUMAN_PRECEDENCE';
    const prior = [...this.ledger.values()].findLast(e => e.actorId === actor.id && e.binding === intent.binding);
    if (prior && !['COMPLETED', 'REJECTED'].includes(prior.stages.at(-1)?.stage)) return 'UNCONFIRMED_PRIOR_ACTION';
    if (prior && clock - prior.stages[0].observedAtMs < 2000) return 'ACTION_RATE_LIMIT';
    for (const [actorId, dispatchedAtMs] of this.lastDispatchByActor) {
      if (Number.isSafeInteger(dispatchedAtMs) && clock >= dispatchedAtMs && clock - dispatchedAtMs >= 2000)
        this.lastDispatchByActor.delete(actorId);
    }
    if (this.lastDispatchByActor.has(actor.id)) return 'ACTION_RATE_LIMIT';
    if (this.lastDispatchByActor.size >= this.maxRemembered) return 'COOLDOWN_HISTORY_FULL';
    const current = this.recommendations.find(r => r.actorId === actor.id);
    if (!current || current.action !== intent.action || !actions.has(current.action) ||
        (current.targetId ?? null) !== intent.targetId || (current.positionId ?? null) !== intent.positionId)
      return 'NO_CURRENT_RECOMMENDATION';
    return null;
  }
  drainSimulation() {
    const results = [];
    while (this.queue.length) {
      const intent = this.queue.shift(); const attemptedAtMs = this.now();
      const reason = this.reasonToReject(intent, attemptedAtMs);
      if (reason) { results.push({ id: intent.id, status: 'REJECTED', reason }); continue; }
      if (this.seen.size >= this.maxRemembered) { results.push({ id: intent.id, status: 'REJECTED', reason: 'HISTORY_FULL' }); continue; }
      this.seen.add(intent.id);
      this.lastDispatchByActor.set(intent.actorId, attemptedAtMs);
      this.latestDispatchAtMs = attemptedAtMs;
      const entry = { id: intent.id, actorId: intent.actorId, binding: intent.binding, session: intent.session, action: intent.action,
        classification: 'MOCK_ONLY', stages: [{ stage: 'SUBMITTED', observedAtMs: attemptedAtMs,
          evidence: 'SIMULATED_SINK_ONLY' }], dispatchable: false };
      this.ledger.set(intent.id, entry);
      try {
        const sinkResult = this.mockSink?.(copy(intent));
        if (utilTypes.isPromise(sinkResult)) {
          // Handle an actual rejected Promise without invoking a custom thenable.
          Promise.prototype.then.call(sinkResult, undefined, () => {});
          throw new Error('ASYNC_SINK_UNSUPPORTED');
        }
        if (sinkResult && typeof sinkResult.then === 'function') {
          // This in-memory fixture API is synchronous, never an asynchronous transport.
          throw new Error('ASYNC_SINK_UNSUPPORTED');
        }
        results.push({ id: intent.id, status: 'SIMULATED_SUBMISSION', nativeAcceptance: 'NOT_PERFORMED' });
      } catch {
        // Invocation may already have had an effect. Only correlated result evidence can resolve it.
        entry.stages[0].evidence = 'SIMULATED_SINK_OUTCOME_UNKNOWN';
        this.disarm('SIMULATED_SINK_FAILURE'); results.push({ id: intent.id, status: 'UNCONFIRMED',
          reason: 'SINK_FAILURE', nativeAcceptance: 'NOT_PERFORMED' });
      }
    }
    return results;
  }
  observeSimulatedResult(event) {
    if (this.mode !== 'MOCK_ONLY') return { status: 'REJECTED', reason: 'SIMULATION_ONLY' };
    try { event = copyResultRecord(event); }
    catch { return { status: 'REJECTED', reason: 'MALFORMED_RESULT' }; }
    if (event.classification !== 'MOCK_ONLY' || !phases.includes(event.stage))
      return { status: 'REJECTED', reason: 'SIMULATION_ONLY' };
    const entry = this.ledger.get(event.id);
    if (!entry || event.session !== this.session || event.actorId !== entry.actorId || event.binding !== entry.binding ||
        !Number.isSafeInteger(event.observedAtMs) || event.observedAtMs > this.now() || typeof event.evidence !== 'string' ||
        event.evidence.length > resultLimits.evidenceUnits ||
        !event.evidence.trim()) return { status: 'REJECTED', reason: 'UNCORRELATED_EVIDENCE' };
    const last = entry.stages.at(-1);
    if (last && (event.observedAtMs < last.observedAtMs || ['COMPLETED', 'REJECTED'].includes(last.stage)))
      return { status: 'REJECTED', reason: 'REGRESSING_OR_TERMINAL_RESULT' };
    if (event.stage !== 'REJECTED' && phases.indexOf(event.stage) <= phases.indexOf(last?.stage ?? 'SUBMITTED'))
      return { status: 'REJECTED', reason: 'DUPLICATE_OR_REGRESSING_STAGE' };
    entry.stages.push({ stage: event.stage, observedAtMs: event.observedAtMs, evidence: event.evidence.slice(0, 256) });
    // Action evidence never releases a human order. Only an observed manual lifecycle does.
    return { status: 'MOCK_ONLY', recorded: true };
  }
  getState() {
    return copy({ mode: this.mode, armed: this.armed, session: this.session,
      nativeAdapter: 'NOT_BUILT', nativeCalls: 0, capabilities: CAPABILITIES,
      recommendations: this.recommendations, pending: this.queue, ledger: [...this.ledger.values()],
      policyState: this.policyState, audit: this.audit });
  }
}
