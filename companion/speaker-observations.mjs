// EXPERIMENTAL, explicit MOCK_ONLY projection. No game facts, inference or I/O.
const idOk = value => typeof value === 'string' && /^[A-Za-z0-9_.:-]{1,128}$/.test(value);
const metrics = Object.freeze({ heat: ['low', 'high', 'normal', 'critical'], selectedWeaponAmmo: ['empty', 'available'] });
const fail = () => { throw new Error('INVALID_SPEAKER_OBSERVATIONS'); };
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
function copyPlain(input) {
  let nodes = 0; const ancestors = new Set();
  function visit(value, depth) {
    if (++nodes > 4000 || depth > 12) fail();
    if (value === null || typeof value === 'boolean') return value;
    if (typeof value === 'string' && value.length <= 8192) return value;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (!value || typeof value !== 'object' || ancestors.has(value) ||
        (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) fail();
    ancestors.add(value); const result = Array.isArray(value) ? [] : {};
    for (const key of Reflect.ownKeys(value)) {
      if (Array.isArray(value) && key === 'length') continue;
      const d = Object.getOwnPropertyDescriptor(value, key);
      if (typeof key !== 'string' || ['__proto__', 'constructor', 'prototype'].includes(key) ||
          !d || !Object.hasOwn(d, 'value') || !d.enumerable) fail();
      result[key] = visit(d.value, depth + 1);
    }
    if (Array.isArray(value) && (result.length !== value.length || Object.keys(result).length !== value.length)) fail();
    ancestors.delete(value); return result;
  }
  return visit(input, 0);
}
function freeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}

/**
 * Input is an explicitly synthetic source contract, not MW5 telemetry. Only
 * speakerId binds first person. Personality, callsigns, text and history are
 * deliberately absent. Times remain caller assertions, never refreshed here.
 */
export function projectSpeakerObservations(input) {
  const c = copyPlain(input);
  if (!record(c) || c.schemaVersion !== 1 || c.classification !== 'MOCK_ONLY' ||
      Object.keys(c).some(k => !['schemaVersion', 'classification', 'speakerId', 'facts'].includes(k)) ||
      (c.speakerId != null && !idOk(c.speakerId)) || !Array.isArray(c.facts) || c.facts.length > 8) fail();
  const factIds = new Set();
  for (const f of c.facts) {
    if (!record(f) || !idOk(f.id) || factIds.has(f.id) || f.evidenceStatus !== 'CALLER_ASSERTED_OBSERVATION' ||
        !Object.hasOwn(f, 'data')) fail();
    for (const key of ['observedAtMs', 'expiresAtMs']) if (Object.hasOwn(f, key) &&
        !(typeof f[key] === 'number' && Number.isFinite(f[key]) && f[key] >= 0)) fail();
    factIds.add(f.id);
  }
  const speakerId = c.speakerId ?? null, knownActors = new Map(), unknownRows = [], sources = [], unprojectedFacts = [];
  function source(fact, factIndex, pointer) {
    const ref = `s${sources.length}`, value = { ref, factId: fact.id, factIndex, pointer };
    for (const key of ['observedAtMs', 'expiresAtMs']) if (Object.hasOwn(fact, key)) value[key] = fact[key];
    sources.push(value); return ref;
  }
  function row(value, pointer, fact, factIndex) {
    if (!record(value)) return false;
    const fields = Object.keys(metrics).filter(key => Object.hasOwn(value, key));
    if (!fields.length) return false;
    const actorId = idOk(value.actorId) ? value.actorId : null;
    let actor = actorId === null ? null : knownActors.get(actorId);
    if (!actor) {
      actor = { actorId, metrics: new Map() };
      if (actorId === null) unknownRows.push(actor); else knownActors.set(actorId, actor);
    }
    let entirelySupported = actorId !== null && Object.keys(value).every(k => k === 'actorId' || Object.hasOwn(metrics, k));
    for (const key of fields) {
      let metric = actor.metrics.get(key);
      if (!metric) { metric = { metric: key, reports: new Map(), unsupportedRefs: [] }; actor.metrics.set(key, metric); }
      const ref = source(fact, factIndex, `${pointer}/${key}`), reading = value[key];
      if (typeof reading === 'string' && metrics[key].includes(reading)) {
        if (!metric.reports.has(reading)) metric.reports.set(reading, []);
        metric.reports.get(reading).push(ref);
      } else { metric.unsupportedRefs.push(ref); entirelySupported = false; }
    }
    return entirelySupported;
  }
  c.facts.forEach((fact, index) => {
    const data = fact.data; let supported = false;
    if (record(data) && Object.hasOwn(data, 'pilots')) {
      // Both supported row forms can coexist. Read both; choosing only the
      // list would hide an explicit conflicting root-row reading.
      if (Object.keys(metrics).some(key => Object.hasOwn(data, key))) row(data, '/data', fact, index);
      if (Array.isArray(data.pilots)) {
        if (data.pilots.length > 16) fail();
        const results = data.pilots.map((pilot, i) => row(pilot, `/data/pilots/${i}`, fact, index));
        supported = results.length > 0 && results.every(Boolean) && Object.keys(data).length === 1;
      }
    } else supported = row(data, '/data', fact, index);
    // Preserve the whole original data object when anything is unsupported.
    // A partly recognized row is never allowed to hide contrary raw evidence.
    if (!supported) unprojectedFacts.push({ id: fact.id, data });
  });
  function observations(actor) {
    return [...actor.metrics.values()].map(m => ({ metric: m.metric,
      status: m.unsupportedRefs.length ? 'UNSUPPORTED_EVIDENCE' : m.reports.size > 1 ? 'CONFLICT' : 'REPORTED',
      reports: [...m.reports].map(([value, refs]) => ({ value, refs })),
      ...(m.unsupportedRefs.length ? { unsupportedRefs: m.unsupportedRefs } : {}) }));
  }
  const own = [], other = [], unattributed = [];
  for (const actor of [...knownActors.values(), ...unknownRows]) {
    const values = observations(actor);
    if (speakerId === null || actor.actorId === null) unattributed.push({ actorId: actor.actorId,
      reason: actor.actorId === null ? 'ACTOR_UNKNOWN' : 'SPEAKER_UNBOUND', observations: values });
    else if (actor.actorId === speakerId) own.push(...values);
    else other.push({ actorId: actor.actorId, observations: values });
  }
  return freeze({ schemaVersion: 1, classification: 'EXPERIMENTAL_MOCK_ONLY',
    prompt: { binding: speakerId === null ? 'UNKNOWN' : 'KNOWN', own, other, unattributed,
      missingOwnMetrics: Object.keys(metrics).filter(key => !own.some(m => m.metric === key)), unprojectedFacts },
    audit: { speakerId, sources, facts: c.facts } });
}
