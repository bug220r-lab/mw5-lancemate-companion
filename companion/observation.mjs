// Project observation contract only. No game access, transport or dispatch.
import { decideSquad, LIMITS } from '../scripts/tactical-policy.mjs';

const record = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const ident = x => typeof x === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(x) &&
  !['__proto__', 'constructor', 'prototype'].includes(x);
const nat = x => Number.isSafeInteger(x) && x >= 0;
const finite = x => typeof x === 'number' && Number.isFinite(x);
const unique = xs => new Set(xs).size === xs.length;
const own = (x, key) => Object.hasOwn(x, key);
export const OBSERVATION_LIMITS = Object.freeze({ rememberedActors: 3, bindingClaimsPerKind: 256 });

// Accept JSON data, not getters, executable values, prototype-bearing instances
// or unbounded/cyclic structures. Copy before normalization; never mutate inputs.
function copyRecord(value) {
  const stack = new Set(); let nodes = 0;
  function visit(x, depth) {
    if (++nodes > 30000 || depth > 32) throw new Error('RECORD_LIMIT');
    if (x === null || typeof x === 'string' || typeof x === 'boolean') return x;
    if (finite(x)) return x;
    if (!record(x) && !Array.isArray(x)) throw new Error('NON_JSON_VALUE');
    if (stack.has(x)) throw new Error('CYCLIC_RECORD');
    const proto = Object.getPrototypeOf(x);
    if (!Array.isArray(x) && proto !== Object.prototype && proto !== null)
      throw new Error('NON_PLAIN_RECORD');
    stack.add(x);
    const out = Array.isArray(x) ? [] : {};
    for (const key of Reflect.ownKeys(x)) {
      if (Array.isArray(x) && key === 'length') continue;
      if (typeof key !== 'string' || ['__proto__', 'constructor', 'prototype'].includes(key))
        throw new Error('INVALID_RECORD_KEY');
      const descriptor = Object.getOwnPropertyDescriptor(x, key);
      if (!descriptor || !own(descriptor, 'value') || !descriptor.enumerable)
        throw new Error('NON_DATA_PROPERTY');
      out[key] = visit(descriptor.value, depth + 1);
    }
    if (Array.isArray(x) && (out.length !== x.length || Object.keys(out).length !== x.length))
      throw new Error('SPARSE_OR_EXTENDED_ARRAY');
    stack.delete(x);
    return out;
  }
  return visit(value, 0);
}

const nullMissing = (object, keys) => {
  for (const key of keys) if (!own(object, key)) object[key] = null;
};

function normalizeUnknowns(s) {
  nullMissing(s, ['phase', 'authority', 'leader', 'targets']);
  if (record(s.leader)) nullMissing(s.leader, ['pawnId', 'matchesNativeSquadLeader']);
  for (const a of s.lancemates) {
    nullMissing(a, ['pawnId', 'controllerId', 'generation', 'member', 'reciprocalBinding',
      'aiOwned', 'alive', 'configured', 'authority', 'manual', 'healthFraction',
      'heatFraction', 'ammoAvailable', 'distanceToLeaderM', 'weaponRangeM', 'capabilities',
      'safeRegroupKnown', 'engagements', 'positions']);
    if (record(a.manual)) nullMissing(a.manual, ['observable', 'revision', 'orderId', 'status', 'persistent']);
    if (record(a.weaponRangeM)) nullMissing(a.weaponRangeM, ['min', 'max']);
    if (Array.isArray(a.engagements)) for (const e of a.engagements)
      if (record(e)) nullMissing(e, ['distanceM', 'lineOfFireKnownClear']);
    if (Array.isArray(a.positions)) for (const p of a.positions)
      if (record(p)) nullMissing(p, ['pathFeasible', 'occupied', 'saferThanCurrent',
        'targetId', 'distanceToTargetM', 'lineOfFireKnownClear']);
  }
  if (Array.isArray(s.targets)) for (const t of s.targets)
    if (record(t)) nullMissing(t, ['knownToLance', 'visibleToLance', 'allegiance',
      'alive', 'observedAtMs', 'threat']);
}

function emptyContinuity(f) {
  return { version: 1, session: f.session, adapterId: f.adapterId, provenance: f.provenance,
    actors: [], pawnClaims: [], controllerClaims: [] };
}
function continuityValid(c) {
  if (!record(c) || c.version !== 1 || !ident(c.session) || typeof c.adapterId !== 'string' ||
      !c.adapterId.trim() || c.adapterId.length > 128 || !['MOCK_ONLY', 'GAME_OBSERVED'].includes(c.provenance) ||
      !Array.isArray(c.actors) || c.actors.length > OBSERVATION_LIMITS.rememberedActors ||
      !c.actors.every(a => record(a) && ident(a.id) && ident(a.pawnId) && ident(a.controllerId) &&
        nat(a.generation) && a.generation >= 1 && typeof a.aiOwned === 'boolean' &&
        (a.ownershipFloor === undefined || (nat(a.ownershipFloor) && a.ownershipFloor >= a.generation))) ||
      !unique(c.actors.map(a => a.id))) return false;
  for (const [key, bindingKey] of [['pawnClaims', 'pawnId'], ['controllerClaims', 'controllerId']]) {
    if (!Array.isArray(c[key]) || c[key].length > OBSERVATION_LIMITS.bindingClaimsPerKind ||
        !c[key].every(x => record(x) && ident(x.bindingId) && ident(x.actorId) && c.actors.some(a => a.id === x.actorId)) ||
        !unique(c[key].map(x => x.bindingId)) ||
        !c.actors.every(a => c[key].some(x => x.bindingId === a[bindingKey] && x.actorId === a.id))) return false;
  }
  return true;
}

/**
 * Validate a proposed data envelope. GAME_OBSERVED is a sender assertion, never
 * adapter verification. A non-null snapshot with ok:false is usable only for a
 * fail-closed policy pass retaining fresh human holds; it grants no capability.
 * nowMs must be supplied by the caller. Packet snapshot.nowMs is ignored.
 */
export function validateObservation(frame, { nowMs, previousFrame = null, continuity = null, allowSynthetic = false } = {}) {
  const errors = []; let classification = 'INVALID_OBSERVATION';
  let nextContinuity = null;
  const reject = () => ({ ok: false, errors: [...new Set(errors)], classification, snapshot: null, nextContinuity });
  let f; let previous;
  try {
    nextContinuity = continuity === null ? null : copyRecord(continuity);
    if (nextContinuity !== null && !continuityValid(nextContinuity)) {
      nextContinuity = null; errors.push('INVALID_CONTINUITY'); return reject();
    }
    f = copyRecord(frame);
    previous = previousFrame === null ? null : copyRecord(previousFrame);
  } catch { errors.push('MALFORMED_RECORD'); return reject(); }
  if (!record(f) || !record(f.snapshot)) { errors.push('INVALID_ENVELOPE'); return reject(); }
  if (f.provenance === 'MOCK_ONLY') classification = 'MOCK_ONLY';
  else if (f.provenance === 'GAME_OBSERVED') classification = 'GAME_OBSERVED_UNVALIDATED';
  else errors.push('INVALID_PROVENANCE');
  if (f.provenance === 'MOCK_ONLY' && allowSynthetic !== true) errors.push('SYNTHETIC_DISABLED');
  if (f.schemaVersion !== 1 || f.kind !== 'observation') errors.push('INVALID_ENVELOPE_SCHEMA');
  if (typeof f.adapterId !== 'string' || !f.adapterId.trim() || f.adapterId.length > 128)
    errors.push('INVALID_ADAPTER_ID');
  if (!ident(f.session) || !nat(f.sequence) || !nat(f.observedAtMs)) errors.push('INVALID_ENVELOPE_IDENTITY_TIME');
  if (!nat(nowMs)) errors.push('INVALID_CALLER_CLOCK');
  else if (nat(f.observedAtMs) && (f.observedAtMs > nowMs || nowMs - f.observedAtMs > LIMITS.maxAgeMs))
    errors.push('STALE_OR_FUTURE_OBSERVATION');
  const s = f.snapshot;
  if (s.schemaVersion !== 1 || s.session !== f.session || s.sequence !== f.sequence ||
      s.observedAtMs !== f.observedAtMs) errors.push('ENVELOPE_SNAPSHOT_MISMATCH');
  if (previous !== null) {
    if (!record(previous) || previous.schemaVersion !== 1 || previous.kind !== 'observation' ||
        !ident(previous.session) || !nat(previous.sequence) || !nat(previous.observedAtMs) ||
        !record(previous.snapshot)) errors.push('INVALID_PREVIOUS_FRAME');
    else if (previous.session === f.session) {
      if (previous.adapterId !== f.adapterId || previous.provenance !== f.provenance)
        errors.push('OBSERVATION_STREAM_CHANGED');
      if (f.sequence <= previous.sequence || f.observedAtMs < previous.observedAtMs)
        errors.push('REGRESSING_OR_REPLAYED_OBSERVATION');
    }
  }
  if (nextContinuity?.session === f.session &&
      (nextContinuity.adapterId !== f.adapterId || nextContinuity.provenance !== f.provenance))
    errors.push('OBSERVATION_STREAM_CHANGED');
  if (!Array.isArray(s.lancemates) || s.lancemates.length < 1 || s.lancemates.length > 3 ||
      !s.lancemates.every(a => record(a) && ident(a.id))) errors.push('INVALID_MEMBER_INVENTORY');
  else if (!unique(s.lancemates.map(a => a.id))) errors.push('DUPLICATE_MEMBER_ID');
  if (errors.length) return reject();

  // Backward-compatible one-frame binding checks. Stateful callers must carry
  // nextContinuity as well as previousFrame; a last-frame pointer cannot retain
  // ownership through absence or repeated rejected binding updates.
  if (nextContinuity === null && previous !== null) {
    const seed = validateObservation(previous, { nowMs: previous.observedAtMs, allowSynthetic });
    nextContinuity = seed.nextContinuity;
  }
  const history = nextContinuity?.session === f.session ? nextContinuity : emptyContinuity(f);

  s.nowMs = nowMs;
  normalizeUnknowns(s);
  if (s.phase !== 'active') errors.push('INACTIVE_OR_UNKNOWN_PHASE');
  if (s.authority !== true) errors.push('UNKNOWN_OR_MISSING_AUTHORITY');
  if (s.targets !== null && (!Array.isArray(s.targets) || !s.targets.every(t => record(t) && ident(t.id)) ||
      !unique(s.targets.map(t => t.id)))) errors.push('INVALID_OR_DUPLICATE_TARGET_ID');
  const identityErrors = [];
  if (!unique(s.lancemates.map(a => a.pawnId)) || !unique(s.lancemates.map(a => a.controllerId)))
    identityErrors.push('ALIASED_MEMBER_IDENTITY');
  const before = new Map(history.actors.map(a => [a.id, { ...a }]));
  const ownershipInvalidations = [];
  const pawnClaims = new Map(history.pawnClaims.map(x => [x.bindingId, x.actorId]));
  const controllerClaims = new Map(history.controllerClaims.map(x => [x.bindingId, x.actorId]));
  const evidenceTimeValid = value => nat(value) && value <= f.observedAtMs && nowMs - value <= LIMITS.maxAgeMs;
  if (Array.isArray(s.targets)) for (const t of s.targets) {
    if (record(t) && t.observedAtMs !== null && !evidenceTimeValid(t.observedAtMs))
      errors.push(`INVALID_TARGET_EVIDENCE_TIME:${t.id}`);
  }
  for (const a of s.lancemates) {
    for (const [key, idKey] of [['engagements', 'targetId'], ['positions', 'id']]) {
      if (a[key] !== null && (!Array.isArray(a[key]) || !a[key].every(x => record(x) && ident(x[idKey])) ||
          !unique(a[key].map(x => x[idKey])))) errors.push(`INVALID_OR_DUPLICATE_${key.toUpperCase()}:${a.id}`);
      if (Array.isArray(a[key])) for (const fact of a[key]) {
        // Omitted time means this proposed atomic sample's timestamp. An
        // explicitly supplied unknown/stale/future time must never be ignored.
        if (record(fact) && own(fact, 'observedAtMs') && !evidenceTimeValid(fact.observedAtMs))
          errors.push(`INVALID_${key.toUpperCase()}_EVIDENCE_TIME:${a.id}`);
      }
    }
    const coherentIdentity = ident(a.pawnId) && ident(a.controllerId) && nat(a.generation) && a.generation >= 1 &&
      a.member === true && a.reciprocalBinding === true && typeof a.aiOwned === 'boolean';
    if (!coherentIdentity ||
        (s.leader?.matchesNativeSquadLeader === true && a.pawnId === s.leader.pawnId))
      identityErrors.push(`INVALID_MEMBER_BINDING:${a.id}`);
    // Human-owned/alive/configuration/authority flags gate control, but a
    // coherent observed possession event must still invalidate the old epoch.
    if (a.aiOwned !== true || a.alive !== true || a.configured !== true || a.authority !== true)
      errors.push(`INVALID_MEMBER_BINDING:${a.id}`);
    const old = before.get(a.id);
    if (old && nat(old.generation) && (a.generation < old.generation ||
        ((a.pawnId !== old.pawnId || a.controllerId !== old.controllerId || a.aiOwned !== old.aiOwned) &&
          a.generation <= old.generation))) identityErrors.push(`INVALID_BINDING_GENERATION:${a.id}`);
    if (a.aiOwned === true && old?.ownershipFloor !== undefined && a.generation <= old.ownershipFloor)
      identityErrors.push(`OWNERSHIP_GENERATION_NOT_ADVANCED:${a.id}`);
    if (coherentIdentity && a.aiOwned === false && old && a.pawnId === old.pawnId && a.controllerId === old.controllerId)
      ownershipInvalidations.push({ id: a.id, floor: Math.max(old.generation, old.ownershipFloor ?? 0, a.generation) });
    if ((pawnClaims.has(a.pawnId) && pawnClaims.get(a.pawnId) !== a.id) ||
        (controllerClaims.has(a.controllerId) && controllerClaims.get(a.controllerId) !== a.id))
      identityErrors.push(`BINDING_OWNER_CHANGED:${a.id}`);
  }
  if (identityErrors.length === 0) {
    for (const a of s.lancemates) {
      before.set(a.id, { id: a.id, pawnId: a.pawnId, controllerId: a.controllerId, generation: a.generation, aiOwned: a.aiOwned,
        ...(a.aiOwned === false ? { ownershipFloor: a.generation } : {}) });
      pawnClaims.set(a.pawnId, a.id); controllerClaims.set(a.controllerId, a.id);
    }
    if (before.size > OBSERVATION_LIMITS.rememberedActors || pawnClaims.size > OBSERVATION_LIMITS.bindingClaimsPerKind ||
        controllerClaims.size > OBSERVATION_LIMITS.bindingClaimsPerKind) identityErrors.push('CONTINUITY_CAPACITY');
    else nextContinuity = { ...history, actors: [...before.values()],
      pawnClaims: [...pawnClaims].map(([bindingId, actorId]) => ({ bindingId, actorId })),
      controllerClaims: [...controllerClaims].map(([bindingId, actorId]) => ({ bindingId, actorId })) };
  }
  // A human-possession sample with a missing generation increment cannot be
  // accepted as a valid binding update, but ignoring it would reopen the last
  // AI epoch. Keep its deny-only watermark on the already known exact binding.
  if (ownershipInvalidations.length && nextContinuity?.session === f.session) {
    for (const invalidation of ownershipInvalidations) {
      const actor = nextContinuity.actors.find(a => a.id === invalidation.id);
      if (actor) actor.ownershipFloor = Math.max(actor.generation, actor.ownershipFloor ?? 0, invalidation.floor);
    }
  }
  errors.push(...identityErrors);
  return { ok: errors.length === 0, errors: [...new Set(errors)], classification, snapshot: s, nextContinuity };
}

/** Read-only replay. Historical frames use their recorded clock, not Date.now. */
export function replayFrames(frames, { allowSynthetic = false } = {}) {
  const results = []; const errors = []; const retiredSessions = new Set();
  let previousFrame = null; let previousState = null; let previousClock = null; let continuity = null;
  let classification = 'REAL_OBSERVATION_REPLAY_UNVALIDATED';
  if (!Array.isArray(frames)) return { classification, results, errors: [{ index: null, errors: ['INVALID_FRAME_LIST'] }] };
  for (let index = 0; index < frames.length; index++) {
    let frame;
    try { frame = copyRecord(frames[index]); }
    catch { errors.push({ index, errors: ['MALFORMED_RECORD'] }); results.push({ index, accepted: false, decision: null }); continue; }
    if (frame?.provenance === 'MOCK_ONLY') classification = 'MOCK_ONLY';
    const nowMs = frame?.replayNowMs ?? frame?.observedAtMs;
    const validation = validateObservation(frame, { nowMs, previousFrame, continuity, allowSynthetic });
    if (previousFrame && frame?.session === previousFrame.session && nat(nowMs) && nowMs < previousClock) {
      validation.ok = false; validation.snapshot = null; validation.errors.push('REGRESSING_REPLAY_CLOCK');
    }
    if (frame?.session !== previousFrame?.session && retiredSessions.has(frame?.session)) {
      validation.ok = false; validation.snapshot = null; validation.errors.push('RETIRED_SESSION_REPLAY');
    }
    let decision = null;
    if (validation.snapshot !== null) {
      // Rejected control frames cannot release holds or select tactics. Passing
      // through the policy's own global gate retains fresh active human orders.
      const policySnapshot = validation.ok ? validation.snapshot : { ...validation.snapshot, authority: false };
      decision = decideSquad(policySnapshot, previousState);
      previousState = decision.state;
      if (previousFrame && previousFrame.session !== frame.session) retiredSessions.add(previousFrame.session);
      previousFrame = frame;
      previousClock = nowMs;
      continuity = validation.nextContinuity;
    }
    if (!validation.ok) errors.push({ index, errors: [...new Set(validation.errors)] });
    results.push({ index, accepted: validation.ok, classification: validation.classification, decision });
  }
  return { classification, results, errors };
}
