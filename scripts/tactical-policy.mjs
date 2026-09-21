// PROPOSED, OFFLINE ONLY. Pure recommendations; no I/O or native/game APIs.
export const POLICY_VERSION = '1.0.1';
export const LIMITS = Object.freeze({ maxAgeMs: 1000, criticalHealth: 0.25,
  coolingHeat: 0.9, isolatedM: 500, threatHysteresis: 0.2 });
const actions = ['regroup', 'focus', 'reposition'];
const obj = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const id = x => typeof x === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(x) &&
  !['__proto__', 'constructor', 'prototype'].includes(x);
const nat = x => Number.isSafeInteger(x) && x >= 0;
const finite = x => typeof x === 'number' && Number.isFinite(x);
const fraction = x => finite(x) && x >= 0 && x <= 1;
const unique = xs => new Set(xs).size === xs.length;
const validManual = m => obj(m) && m.observable === true && nat(m.revision) &&
  ['none', 'active', 'completed', 'released'].includes(m.status) &&
  typeof m.persistent === 'boolean' && (m.status === 'none'
    ? m.orderId === null && !m.persistent : id(m.orderId));
// Enough evidence to add a human hold; unknown persistence cannot authorize its
// later completion. The full manual contract still gates all release decisions.
const observedActiveManual = m => obj(m) && m.observable === true &&
  m.status === 'active' && nat(m.revision) && id(m.orderId);
const clone = x => JSON.parse(JSON.stringify(x));
const reply = (actorId, action, reason, evidence, extra = {}) => ({ actorId, action,
  reason, evidence, unmetPrerequisites: [], dispatchable: false, ...extra });
const defer = (actorId, reason) => reply(actorId, 'DEFER', reason, ['CONTROL-01'],
  { unmetPrerequisites: [reason] });

export function decideSquad(snapshot, previousState = null) {
  const s = obj(snapshot) ? snapshot : {};
  const members = Array.isArray(s.lancemates) ? s.lancemates : [];
  const prior = obj(previousState) && previousState.schemaVersion === 1 &&
    previousState.session === s.session ? previousState : null;
  const state = { schemaVersion: 1, policyVersion: POLICY_VERSION, session: s.session ?? null,
    sequence: prior?.sequence ?? -1, observedAtMs: prior?.observedAtMs ?? -1,
    nowMs: prior?.nowMs ?? -1, actors: obj(prior?.actors) ? clone(prior.actors) : {} };
  const result = recommendations => ({ classification: 'MOCK_ONLY', policyVersion: POLICY_VERSION,
    recommendations, state });
  const fail = reason => result((members.length ? members : [{ id: null }])
    .map(a => defer(obj(a) && id(a.id) ? a.id : null, reason)));
  if (s.schemaVersion !== 1 || !id(s.session) || !nat(s.sequence) || !nat(s.observedAtMs) ||
      !nat(s.nowMs) || members.length < 1 || members.length > 3 ||
      !members.every(a => obj(a) && id(a.id)) || !unique(members.map(a => a.id)))
    return fail('INVALID_SNAPSHOT');
  if (s.observedAtMs > s.nowMs || s.nowMs - s.observedAtMs > LIMITS.maxAgeMs)
    return fail('STALE_OR_FUTURE_SNAPSHOT');
  if (prior && (s.sequence <= state.sequence || s.observedAtMs < state.observedAtMs ||
      s.nowMs < state.nowMs)) return fail('REGRESSING_OR_REPLAYED_SNAPSHOT');
  state.sequence = s.sequence; state.observedAtMs = s.observedAtMs; state.nowMs = s.nowMs;
  // A fresh active human order may arrive while paused, changing possession or
  // missing other prerequisites. Conservatively latch it before those gates.
  // This pass only adds/strengthens holds; it never releases one.
  for (const a of members) {
    const before = obj(state.actors[a.id]) ? state.actors[a.id] : {};
    const m = a.manual; const held = before.heldHumanOrder;
    if (observedActiveManual(m) &&
        (!nat(before.manualRevision) || m.revision >= before.manualRevision) &&
        (!held || m.orderId === held.id || m.revision > held.revision)) {
      state.actors[a.id] = { ...before, manualRevision: m.revision,
        heldHumanOrder: { id: m.orderId, revision: m.revision,
          persistent: m.persistent !== false || (held?.id === m.orderId && held.persistent === true) } };
    }
  }
  if (!unique(members.map(a => a.pawnId)) || !unique(members.map(a => a.controllerId)))
    return fail('AMBIGUOUS_LIVE_IDENTITY');
  if (s.phase !== 'active' || s.authority !== true) return fail('INACTIVE_OR_UNKNOWN_AUTHORITY');
  if (!Array.isArray(s.targets) || !s.targets.every(t => obj(t) && id(t.id)) ||
      !unique(s.targets.map(t => t.id))) return fail('INVALID_TARGET_INVENTORY');
  // Hidden/friendly/stale targets are excluded before scoring or reading their tactical attributes.
  const targets = s.targets.filter(t => t.knownToLance === true && t.visibleToLance === true &&
    t.allegiance === 'hostile' && t.alive === true && nat(t.observedAtMs) &&
    t.observedAtMs <= s.nowMs && s.nowMs - t.observedAtMs <= LIMITS.maxAgeMs && fraction(t.threat));
  const targetsById = new Map(targets.map(t => [t.id, t]));
  const assigned = new Map(); const reserved = new Set(); const recommendations = [];
  // Stable identity order, not input array/UI order, defines deterministic coordination.
  for (const a of [...members].sort((x, y) => x.id.localeCompare(y.id, 'en'))) {
    const before = obj(state.actors[a.id]) ? state.actors[a.id] : {};
    const output = r => { recommendations.push(r); state.actors[a.id] = { ...before,
      ...(state.actors[a.id] ?? {}), recommendation: r }; };
    if (!id(a.pawnId) || !id(a.controllerId) || !nat(a.generation) || a.generation < 1 ||
        a.member !== true || a.reciprocalBinding !== true || a.aiOwned !== true ||
        a.alive !== true || a.configured !== true || a.authority !== true ||
        (s.leader?.matchesNativeSquadLeader === true && a.pawnId === s.leader.pawnId)) {
      state.actors[a.id] = { ...before, controlValid: false };
      output(defer(a.id, 'INVALID_OR_HUMAN_BINDING')); continue;
    }
    const binding = `${a.controllerId}:${a.pawnId}:${a.generation}`;
    const changed = before.binding !== undefined && (before.binding !== binding || before.controlValid === false);
    state.actors[a.id] = { ...before, binding, controlValid: true };
    if (changed) { output(defer(a.id, 'BINDING_CHANGED_REOBSERVE')); continue; }
    const m = a.manual;
    if (!validManual(m)) {
      output(defer(a.id, 'UNKNOWN_MANUAL_ORDER')); continue;
    }
    if (nat(before.manualRevision) && m.revision < before.manualRevision) {
      output(defer(a.id, 'REGRESSING_MANUAL_REVISION')); continue;
    }
    const held = obj(before.heldHumanOrder) ? before.heldHumanOrder : null;
    state.actors[a.id].manualRevision = m.revision;
    if (m.status === 'active') {
      if (held && m.orderId !== held.id && m.revision <= held.revision) {
        output(defer(a.id, 'UNVERSIONED_HUMAN_ORDER_CHANGE')); continue;
      }
      state.actors[a.id].heldHumanOrder = { id: m.orderId,
        persistent: m.persistent || (held?.id === m.orderId && held.persistent === true), revision: m.revision };
      output(reply(a.id, 'MAINTAIN', 'HUMAN_ORDER_ACTIVE', ['CONTROL-01'])); continue;
    }
    if (held && (m.orderId !== held.id || m.revision < held.revision ||
        (m.status !== 'released' && !(m.status === 'completed' && !held.persistent && !m.persistent)))) {
      output(defer(a.id, 'HUMAN_ORDER_NOT_RELEASED')); continue;
    }
    if (m.status === 'completed' && m.persistent) {
      state.actors[a.id].heldHumanOrder = held ?? { id: m.orderId, persistent: true, revision: m.revision };
      output(defer(a.id, 'PERSISTENT_ORDER_REQUIRES_RELEASE')); continue;
    }
    state.actors[a.id].heldHumanOrder = null;
    if (!fraction(a.healthFraction) || !fraction(a.heatFraction) || typeof a.ammoAvailable !== 'boolean' ||
        !finite(a.distanceToLeaderM) || a.distanceToLeaderM < 0 || !obj(a.weaponRangeM) ||
        !finite(a.weaponRangeM.min) || a.weaponRangeM.min < 0 || !finite(a.weaponRangeM.max) ||
        a.weaponRangeM.max < a.weaponRangeM.min || !Array.isArray(a.capabilities) ||
        !a.capabilities.every(c => actions.includes(c)) || !unique(a.capabilities) ||
        !Array.isArray(a.engagements) || !Array.isArray(a.positions)) {
      output(defer(a.id, 'INCOMPLETE_TACTICAL_OBSERVATION')); continue;
    }
    // One observation per target/candidate for this actor. Choosing the favorable
    // duplicate would turn contradictory evidence into an invented prerequisite.
    if (!a.engagements.every(e => obj(e) && id(e.targetId)) ||
        !unique(a.engagements.map(e => e.targetId)) ||
        !a.positions.every(p => obj(p) && id(p.id)) || !unique(a.positions.map(p => p.id))) {
      output(defer(a.id, 'AMBIGUOUS_TACTICAL_OBSERVATION')); continue;
    }
    const capable = action => a.capabilities.includes(action);
    const inRange = d => finite(d) && d >= a.weaponRangeM.min && d <= a.weaponRangeM.max;
    const safePositions = a.positions.filter(p => obj(p) && id(p.id) && p.pathFeasible === true &&
      p.occupied === false && !reserved.has(p.id));
    const regroup = () => capable('regroup') && a.safeRegroupKnown === true &&
      obj(s.leader) && id(s.leader.pawnId) && s.leader.matchesNativeSquadLeader === true;
    const reposition = (p, reason) => { reserved.add(p.id);
      return reply(a.id, 'REPOSITION', reason, ['MOVE-01', 'TACTIC-02'], { positionId: p.id }); };
    if (a.healthFraction <= LIMITS.criticalHealth) {
      const safer = safePositions.filter(p => p.saferThanCurrent === true).sort((x, y) => x.id.localeCompare(y.id))[0];
      if (capable('reposition') && safer) output(reposition(safer, 'PROTECT_DAMAGED_MECH'));
      else if (regroup()) output(reply(a.id, 'REGROUP', 'PROTECT_DAMAGED_MECH', ['FOLLOW-01', 'TACTIC-02']));
      else output(reply(a.id, 'MAINTAIN', 'NO_VERIFIED_SAFE_RETREAT', ['TACTIC-02'],
        { unmetPrerequisites: ['SAFE_REPOSITION_OR_REGROUP'] }));
      continue;
    }
    if (a.heatFraction >= LIMITS.coolingHeat || !a.ammoAvailable) {
      output(reply(a.id, 'MAINTAIN', a.ammoAvailable ? 'ALLOW_NATIVE_COOLING' : 'NO_AMMUNITION_OPPORTUNITY', ['COMBAT-01'])); continue;
    }
    if (a.distanceToLeaderM > LIMITS.isolatedM && regroup()) {
      output(reply(a.id, 'REGROUP', 'RESTORE_LANCE_COHESION', ['FOLLOW-01', 'TACTIC-02'])); continue;
    }
    let opportunities = a.engagements.filter(e => obj(e) && targetsById.has(e.targetId) &&
      e.lineOfFireKnownClear === true && inRange(e.distanceM));
    // Duplicate observations for one target cannot create extra assignments.
    opportunities = [...new Map(opportunities.map(e => [e.targetId, targetsById.get(e.targetId)])).values()];
    if (capable('focus') && opportunities.length) {
      const underCap = opportunities.filter(t => (assigned.get(t.id) ?? 0) < 2);
      if (underCap.length) opportunities = underCap;
      opportunities.sort((x, y) => y.threat - x.threat || x.id.localeCompare(y.id));
      let chosen = opportunities[0];
      const old = before.recommendation;
      const retained = old?.action === 'FOCUS' ? opportunities.find(t => t.id === old.targetId) : null;
      if (retained && chosen.threat - retained.threat <= LIMITS.threatHysteresis) chosen = retained;
      assigned.set(chosen.id, (assigned.get(chosen.id) ?? 0) + 1);
      output(reply(a.id, 'FOCUS', retained?.id === chosen.id ? 'RETAIN_USEFUL_TARGET' : 'KNOWN_USEFUL_FIRING_OPPORTUNITY',
        ['COMBAT-01', 'TACTIC-01'], { targetId: chosen.id })); continue;
    }
    const firingPositions = safePositions.filter(p => targetsById.has(p.targetId) &&
      inRange(p.distanceToTargetM) && p.lineOfFireKnownClear === true)
      .sort((x, y) => targetsById.get(y.targetId).threat - targetsById.get(x.targetId).threat || x.id.localeCompare(y.id));
    if (capable('reposition') && firingPositions.length) {
      output(reposition(firingPositions[0], 'REACH_USEFUL_WEAPON_RANGE')); continue;
    }
    output(reply(a.id, 'MAINTAIN', 'NO_VERIFIED_BETTER_ACTION', ['TACTIC-01'],
      { unmetPrerequisites: targets.length ? ['USABLE_RANGE_PATH_OR_ACTION'] : ['FRESH_KNOWN_HOSTILE_TARGET'] }));
  }
  // Retain mission-scoped history for temporarily absent actors, including human
  // holds. Only currently observed members receive recommendations; a new session
  // resets history. Disappearance is never evidence of completion or release.
  return result(recommendations);
}
