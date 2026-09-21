import defaultPersonas from './personas.json' with { type: 'json' };
import { createHash } from 'node:crypto';

// Project-only state machine. No audio, commands, model calls or game access.
export const RADIO_LIMITS = Object.freeze({ factTtlMs: 5000, maxAgeMs: 30000,
  unsolicitedMs: 20000, exchangeMs: 10000, maxFacts: 256, maxQueue: 32, maxIds: 1024,
  maxFactIds: 65536 });
const priorities = Object.freeze({ danger: 0, answer: 1, tactical: 2, banter: 3 });
const clone = value => structuredClone(value);
const idOk = value => typeof value === 'string' && /^[A-Za-z0-9_.:-]{1,128}$/.test(value);
const finite = value => Number.isFinite(value) && value >= 0;
const unsolicited = line => line.priority === 'tactical' || line.priority === 'banter';
const reject = reason => ({ status: 'REJECTED', reason });
// Copy only finite JSON data. This is an input-size bound, not a truth validator.
function copyFactData(value) {
  let count = 0;
  function visit(v, depth) {
    if (++count > 256 || depth > 8) throw new TypeError('Fact data is too large.');
    if (v === null || typeof v === 'boolean') return v;
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string' && v.length <= 4000) return v;
    if (Array.isArray(v)) return v.map(item => visit(item, depth + 1));
    if (v && Object.getPrototypeOf(v) === Object.prototype) {
      return Object.fromEntries(Object.keys(v).sort().map(key => [key, visit(v[key], depth + 1)]));
    }
    throw new TypeError('Fact data must be finite JSON data.');
  }
  const result = visit(value, 0);
  if (JSON.stringify(result).length > 16384) throw new TypeError('Fact data is too large.');
  return result;
}
const copyBinding = b => ({ id: b.id, pawnId: b.pawnId, generation: b.generation,
  alive: b.alive, aiOwned: b.aiOwned, ...(b.slot === undefined ? {} : { slot: b.slot }),
  ...(b.invalidated === undefined ? {} : { invalidated: b.invalidated }) });
function validBinding(b) {
  return b && idOk(b.id) && idOk(b.pawnId) && Number.isSafeInteger(b.generation) && b.generation >= 0 &&
    typeof b.alive === 'boolean' && typeof b.aiOwned === 'boolean' &&
    (b.invalidated === undefined || typeof b.invalidated === 'boolean') &&
    (b.slot === undefined || (Number.isInteger(b.slot) && b.slot >= 1 && b.slot <= 3));
}
function bindingsValid(bindings) {
  return Array.isArray(bindings) && bindings.length <= 3 && bindings.every(validBinding) &&
    new Set(bindings.map(b => b.id)).size === bindings.length &&
    new Set(bindings.map(b => b.pawnId)).size === bindings.length &&
    new Set(bindings.filter(b => b.slot !== undefined).map(b => b.slot)).size === bindings.filter(b => b.slot !== undefined).length;
}

export function createRadioDirector({ personas = defaultPersonas, now = () => performance.now() } = {}) {
  const profiles = clone(Array.isArray(personas) ? personas : personas?.profiles);
  if (!Array.isArray(profiles) || profiles.length !== 3 || profiles.some(p => !idOk(p.id)) ||
      new Set(profiles.map(p => p.id)).size !== 3 || typeof now !== 'function') throw new TypeError('Three unique persona IDs and a clock are required.');
  const profileIds = new Set(profiles.map(p => p.id));
  let session = null, bindings = new Map(), bindingTimes = new Map(), facts = new Map(), factDigests = new Map(), queue = [], playing = null;
  let lineIds = new Set(), conflicts = new Set(), exchanges = new Map(), usedSessions = new Set();
  let lastUnsolicitedAt = -Infinity, lastNow = -Infinity, clockFault = false, ordinal = 0;
  let gates = { paused: false, micMuted: false, speechMuted: false, quiet: false, nativeDialogue: false, ptt: false, armed: false };
  function stopPlaying(reason) {
    const line = playing; playing = null;
    if (line?.exchangeId) {
      const exchange = exchanges.get(line.exchangeId);
      if (exchange) exchange.cancelled = true;
      queue = queue.filter(q => q.exchangeId !== line.exchangeId);
    }
    return line ? { lineId: line.lineId, reason } : null;
  }
  function interrupt(reason = 'INTERRUPTED') {
    const discardedLineIds = queue.map(l => l.lineId);
    const cancelled = stopPlaying(reason);
    queue = [];
    for (const e of exchanges.values()) if (!e.finished) e.cancelled = true;
    return { status: 'INTERRUPTED', reason, interruptedLineId: cancelled?.lineId ?? null, discardedLineIds };
  }
  function time() {
    let value;
    try { value = now(); } catch { value = NaN; }
    if (!finite(value) || value < lastNow) { clockFault = true; interrupt('CLOCK_INVALID'); return null; }
    lastNow = value;
    return clockFault ? null : value;
  }
  function gateReason(line) {
    if (gates.paused) return 'PAUSED';
    if (gates.ptt) return 'USER_SPEAKING';
    if (gates.speechMuted) return 'SPEECH_MUTED';
    if (gates.nativeDialogue) return 'NATIVE_DIALOGUE';
    if (gates.quiet && unsolicited(line)) return 'QUIET';
    return null; // Microphone mute and control arming are separate from speech permission.
  }
  function current(line, t) {
    if (!session || line.session !== session) return 'SESSION_MISMATCH';
    const b = bindings.get(line.speakerId);
    if (!b || b.invalidated || !b.alive || !b.aiOwned || b.pawnId !== line.pawnId || b.generation !== line.generation) return 'BINDING_INVALID';
    if (line.createdAtMs > t || line.expiresAtMs <= t) return 'LINE_STALE';
    for (const id of line.factIds) {
      const fact = facts.get(id);
      if (!fact || fact.expiresAtMs <= t || fact.observedAtMs > t || conflicts.has(id)) return 'FACT_UNKNOWN_OR_STALE';
    }
    return gateReason(line);
  }
  function prune(t) {
    for (const [id, fact] of facts) if (fact.expiresAtMs <= t) facts.delete(id);
    queue = queue.filter(l => !current(l, t) && !exchanges.get(l.exchangeId)?.cancelled);
    if (playing && current(playing, t)) stopPlaying('PLAYBACK_CONTEXT_INVALIDATED');
  }
  function startMission(nextSession, nextBindings) {
    if (!idOk(nextSession) || usedSessions.has(nextSession)) return reject('NEW_SESSION_REQUIRED');
    if (!bindingsValid(nextBindings) || nextBindings.some(b => !profileIds.has(b.id))) return reject('INVALID_BINDINGS');
    if (usedSessions.size >= RADIO_LIMITS.maxIds) return reject('SESSION_CAPACITY');
    let t;
    try { t = now(); } catch { t = NaN; }
    if (!finite(t)) return reject('CLOCK_INVALID');
    interrupt('MISSION_CHANGED');
    session = nextSession; usedSessions.add(session); bindings = new Map(nextBindings.map(b => [b.id, copyBinding(b)]));
    bindingTimes = new Map(nextBindings.map(b => [b.id, t]));
    facts = new Map(); factDigests = new Map(); queue = []; playing = null; lineIds = new Set(); conflicts = new Set(); exchanges = new Map();
    lastNow = t; clockFault = false; lastUnsolicitedAt = -Infinity; ordinal = 0;
    return { status: 'STARTED', session };
  }
  function setGates(update) {
    if (!update || typeof update !== 'object' || Array.isArray(update) || Object.entries(update).some(([key, value]) => !Object.hasOwn(gates, key) || typeof value !== 'boolean')) return reject('INVALID_GATES');
    gates = { ...gates, ...update };
    const t = time();
    const cancelled = playing && gateReason(playing) ? stopPlaying(gateReason(playing)) : null;
    if (gates.ptt || gates.paused || gates.speechMuted || gates.nativeDialogue) interrupt('GATE_CLOSED');
    else if (t !== null) prune(t);
    return { status: 'GATES_UPDATED', gates: clone(gates), interruptedLineId: cancelled?.lineId ?? null };
  }
  function observe(event) {
    const t = time(); if (t === null) return reject('CLOCK_INVALID');
    if (!event || !idOk(event.id) || !session || event.session !== session) return reject('SESSION_OR_EVENT_INVALID');
    if (!finite(event.observedAtMs) || event.observedAtMs > t || t - event.observedAtMs > RADIO_LIMITS.maxAgeMs) return reject('EVENT_STALE');
    if (event.kind === 'bindinginvalidated' || event.kind === 'bindingInvalidated') {
      const data = event.data ?? event, b = bindings.get(data.speakerId);
      if (!b || b.pawnId !== data.pawnId || b.generation !== data.generation) return reject('BINDING_MISMATCH');
      b.invalidated = true; prune(t); return { status: 'INVALIDATED', speakerId: b.id };
    }
    if (event.kind === 'binding') {
      const next = event.binding, old = bindings.get(next?.id);
      if (!validBinding(next) || !old || next.generation < old.generation) return reject('INVALID_BINDING_UPDATE');
      if (event.observedAtMs < bindingTimes.get(next.id)) return reject('STALE_BINDING_UPDATE');
      const changed = old.invalidated || next.pawnId !== old.pawnId || next.alive !== old.alive || next.aiOwned !== old.aiOwned || next.slot !== old.slot;
      if (changed && next.generation <= old.generation) return reject('GENERATION_MUST_ADVANCE');
      const all = [...bindings.values()].filter(b => b.id !== next.id).concat(next);
      if (!bindingsValid(all)) return reject('DUPLICATE_BINDING');
      bindings.set(next.id, copyBinding(next)); bindingTimes.set(next.id, event.observedAtMs);
      prune(t); return { status: 'OBSERVED' };
    }
    if (event.kind !== 'fact' || event.verified !== true || event.data === undefined) return reject('UNVERIFIED_FACT');
    const expiresAtMs = event.expiresAtMs ?? event.observedAtMs + RADIO_LIMITS.factTtlMs;
    if (!finite(expiresAtMs) || expiresAtMs <= t || expiresAtMs > event.observedAtMs + RADIO_LIMITS.maxAgeMs) return reject('FACT_STALE');
    if (conflicts.has(event.id)) return reject('FACT_CONFLICT');
    let fact, digest;
    try {
      fact = { id: event.id, session, observedAtMs: event.observedAtMs, kind: 'fact', verified: true,
        data: copyFactData(event.data), expiresAtMs };
      digest = createHash('sha256').update(JSON.stringify(fact)).digest('hex');
    } catch { return reject('INVALID_FACT_DATA'); }
    if (factDigests.has(event.id)) {
      if (factDigests.get(event.id) === digest) return { status: 'DUPLICATE' };
      facts.delete(event.id); conflicts.add(event.id); prune(t); return reject('FACT_CONFLICT');
    }
    prune(t);
    if (facts.size >= RADIO_LIMITS.maxFacts || factDigests.size >= RADIO_LIMITS.maxFactIds) return reject('FACT_CAPACITY');
    facts.set(event.id, fact); factDigests.set(event.id, digest); return { status: 'OBSERVED' };
  }
  function enqueue(input) {
    const t = time(); if (t === null) return reject('CLOCK_INVALID');
    if (!input || !idOk(input.lineId) || !Object.hasOwn(priorities, input.priority) || typeof input.text !== 'string' ||
        !input.text.trim() || input.text.length > 600 || !Array.isArray(input.factIds) || input.factIds.length > 8 ||
        !input.factIds.every(idOk) || new Set(input.factIds).size !== input.factIds.length ||
        !finite(input.createdAtMs) || !finite(input.expiresAtMs) || input.expiresAtMs <= input.createdAtMs ||
        input.expiresAtMs > input.createdAtMs + RADIO_LIMITS.maxAgeMs ||
        (input.priority !== 'answer' && input.factIds.length === 0)) return reject('INVALID_LINE');
    if (lineIds.has(input.lineId)) return reject('DUPLICATE_LINE');
    if (lineIds.size >= RADIO_LIMITS.maxIds) return reject('LINE_ID_CAPACITY');
    const line = { lineId: input.lineId, session: input.session, speakerId: input.speakerId,
      pawnId: input.pawnId, generation: input.generation, priority: input.priority, text: input.text.trim(),
      createdAtMs: input.createdAtMs, expiresAtMs: input.expiresAtMs, factIds: [...input.factIds],
      ...(input.exchangeId === undefined ? {} : { exchangeId: input.exchangeId }),
      ...(input.exchangeTurn === undefined ? {} : { exchangeTurn: input.exchangeTurn }),
      classification: 'PROJECT_ONLY', dispatchable: false,
      grounding: input.factIds.length ? 'VERIFIED_FACT_REFERENCES_ONLY' : 'USER_REQUESTED_UNGROUNDED', ordinal: ordinal++ };
    const reason = current(line, t); if (reason) return reject(reason);
    prune(t);
    let newExchange, replyingTo;
    if (input.exchangeId !== undefined) {
      if (!idOk(input.exchangeId) || !unsolicited(line) || ![0, 1].includes(input.exchangeTurn)) return reject('INVALID_EXCHANGE');
      const exchange = exchanges.get(line.exchangeId);
      if (line.exchangeTurn === 0) {
        if (exchange) return reject('EXCHANGE_EXISTS');
        newExchange = { firstSpeaker: line.speakerId, firstLine: line.lineId, priority: line.priority, state: 'QUEUED', cancelled: false, secondQueued: false };
      } else {
        if (!exchange || exchange.cancelled || exchange.finished || exchange.secondQueued || exchange.firstSpeaker === line.speakerId || exchange.priority !== line.priority) return reject('EXCHANGE_INVALID_REPLY');
        replyingTo = exchange;
      }
    } else if (input.exchangeTurn !== undefined) return reject('EXCHANGE_ID_REQUIRED');
    if (queue.length >= RADIO_LIMITS.maxQueue) {
      const victim = line.priority === 'danger' ? queue.find(q => unsolicited(q)) : null;
      if (!victim) return reject('QUEUE_FULL');
      if (victim.exchangeId) exchanges.get(victim.exchangeId).cancelled = true;
      queue = queue.filter(q => q.lineId !== victim.lineId && !(victim.exchangeId && q.exchangeId === victim.exchangeId));
    }
    if (newExchange) exchanges.set(line.exchangeId, newExchange);
    if (replyingTo) replyingTo.secondQueued = true;
    if (line.priority === 'danger' && playing && unsolicited(playing)) stopPlaying('DANGER_PREEMPTED');
    lineIds.add(line.lineId); queue.push(line); return { status: 'QUEUED', lineId: line.lineId };
  }
  function next() {
    const t = time(); if (t === null) return null;
    prune(t); if (playing) return null;
    queue.sort((a, b) => priorities[a.priority] - priorities[b.priority] || a.ordinal - b.ordinal);
    while (queue.length) {
      const line = queue.shift(), exchange = exchanges.get(line.exchangeId);
      if (line.exchangeTurn === 1 && (!exchange || exchange.state !== 'COMPLETED' || exchange.startedAtMs + RADIO_LIMITS.exchangeMs <= t)) continue;
      if (unsolicited(line) && line.exchangeTurn !== 1 && t - lastUnsolicitedAt < RADIO_LIMITS.unsolicitedMs) {
        if (exchange) exchange.cancelled = true;
        continue; // Suppressed chatter is discarded, never replayed later.
      }
      if (unsolicited(line) && line.exchangeTurn !== 1) lastUnsolicitedAt = t;
      if (exchange && line.exchangeTurn === 0) { exchange.state = 'PLAYING'; exchange.startedAtMs = t; }
      playing = { ...line, startedAtMs: t };
      return clone(playing);
    }
    return null;
  }
  function complete(lineId) {
    const t = time(); if (t === null) return reject('CLOCK_INVALID');
    prune(t);
    if (!playing || playing.lineId !== lineId) return reject('NOT_PLAYING');
    const exchange = exchanges.get(playing.exchangeId);
    if (exchange) {
      if (playing.exchangeTurn === 0) exchange.state = 'COMPLETED'; else exchange.finished = true;
    }
    playing = null; return { status: 'COMPLETED', lineId };
  }
  function getState() {
    const t = time(); if (t !== null) prune(t);
    return clone({ session, profiles, bindings: [...bindings.values()], facts: [...facts.values()], gates,
      queue, playing, clockFault, lastUnsolicitedAt: Number.isFinite(lastUnsolicitedAt) ? lastUnsolicitedAt : null,
      exchanges: [...exchanges].map(([id, value]) => ({ id, ...value })) });
  }
  return { startMission, setGates, observe, enqueue, next, complete, interrupt, getState };
}

export function parseSpokenCommand(input = {}) {
  if (!input || typeof input !== 'object') return reject('INVALID_CONTEXT');
  const { text, origin, final, session, bindings, selectedTargetId, locations = [] } = input;
  if (origin !== 'human_ptt' || final !== true) return reject('TRUSTED_FINAL_HUMAN_PTT_REQUIRED');
  if (!idOk(session)) return reject('INVALID_CONTEXT');
  if (typeof text !== 'string' || text.length > 300) return reject('INVALID_TEXT');
  const spoken = text.trim().toLowerCase().replace(/[.!?]+$/, '').replace(/\s+/g, ' ');
  const clarify = reason => ({ status: 'CLARIFICATION', reason });
  const intent = (action, recipients, extra = {}) => ({ status: 'INTENT', classification: 'PROJECT_INTENT',
    dispatchable: false, session, origin, action, recipientIds: recipients.map(b => b.id), bindings: recipients.map(copyBinding), ...extra });
  if (spoken === 'disarm') return intent('DISARM', [], { scope: 'ALL_COMPANION_CONTROL' });
  if (!bindingsValid(bindings) || !bindings.length) return reject('INVALID_CONTEXT');
  let action, spec, locationId;
  const move = spoken.match(/^reposition (.+) to location ([a-z0-9_.:-]+)$/);
  const front = spoken.match(/^(regroup|focus|release(?: human hold)?|disarm) (.+)$/);
  const back = spoken.match(/^(.+) (regroup|focus|release(?: human hold)?|disarm)$/);
  if (move) { action = 'REPOSITION'; spec = move[1]; locationId = move[2]; }
  else if (front || back) {
    const verb = front ? front[1] : back[2]; spec = front ? front[2] : back[1];
    action = verb.startsWith('release') ? 'RELEASE_HUMAN_HOLD' : verb.toUpperCase();
  } else return clarify('USE_EXPLICIT_SLOT_OR_ACTOR_AND_SUPPORTED_VERB');
  const recipients = [];
  for (const part of spec.split(/\s+and\s+|,\s*/)) {
    const slot = part.match(/^slot ([1-3])$/), actor = part.match(/^actor ([a-z0-9_.:-]+)$/);
    if (!slot && !actor) return clarify('AMBIGUOUS_RECIPIENT');
    const matches = bindings.filter(b => slot ? b.slot === Number(slot[1]) : b.id.toLowerCase() === actor[1]);
    if (matches.length !== 1 || recipients.some(b => b.id === matches[0]?.id)) return clarify('UNKNOWN_OR_DUPLICATE_RECIPIENT');
    const b = matches[0];
    if (action !== 'DISARM' && (!b.alive || !b.aiOwned || b.invalidated)) return reject('INELIGIBLE_RECIPIENT');
    recipients.push(b);
  }
  if (action === 'FOCUS' && !idOk(selectedTargetId)) return clarify('KNOWN_SELECTED_TARGET_REQUIRED');
  if (action === 'REPOSITION') {
    if (!Array.isArray(locations)) return reject('INVALID_LOCATIONS');
    const matches = locations.map(l => typeof l === 'string' ? l : l?.id).filter(id => idOk(id) && id.toLowerCase() === locationId);
    if (matches.length !== 1) return clarify('KNOWN_NAMED_LOCATION_REQUIRED');
    return intent(action, recipients, { locationId: matches[0] });
  }
  return intent(action, recipients, action === 'FOCUS' ? { targetId: selectedTargetId } : {});
}
