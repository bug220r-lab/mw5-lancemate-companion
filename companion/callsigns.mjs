// Display preferences are not authority. These helpers only describe exact-name routing.
const asciiLower = value => value.replace(/[A-Z]/g, letter => letter.toLowerCase());
const idOk = value => typeof value === 'string' && /^[A-Za-z0-9_.:-]{1,128}$/.test(value);
const reserved = new Set(['slot', 'actor', 'callsign', 'regroup', 'focus', 'release', 'human', 'hold',
  'disarm', 'reposition', 'to', 'location', 'and', 'all', 'everyone', 'lance', 'squad']);

export function normalizeCallsign(value) {
  if (value === null) return null;
  if (typeof value !== 'string' || value.length > 64 || /[\x00-\x1f\x7f]/.test(value)) throw new TypeError('INVALID_CALLSIGN');
  return asciiLower(value.trim().replace(/\s+/g, ' ')) || null;
}

function knownActorIds(options) {
  if (!options || typeof options !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(options))) throw new TypeError('INVALID_ACTOR_IDS');
  const descriptor = Object.getOwnPropertyDescriptor(options, 'actorIds');
  if (!descriptor) return [];
  if (!Object.hasOwn(descriptor, 'value')) throw new TypeError('INVALID_ACTOR_IDS');
  const ids = descriptor.value;
  if (!Array.isArray(ids) || Object.getPrototypeOf(ids) !== Array.prototype || ids.length > 3) throw new TypeError('INVALID_ACTOR_IDS');
  const result = [];
  for (let i = 0; i < ids.length; i++) {
    const item = Object.getOwnPropertyDescriptor(ids, String(i));
    if (!item || !Object.hasOwn(item, 'value') || !idOk(item.value)) throw new TypeError('INVALID_ACTOR_IDS');
    result.push(asciiLower(item.value));
  }
  return result;
}

export function callsignRoutability(value, options = {}) {
  let normalized, actorIds;
  try { normalized = normalizeCallsign(value); actorIds = knownActorIds(options); }
  catch (error) { return { normalized: null, routable: false, reason: error.message === 'INVALID_ACTOR_IDS' ? 'INVALID_ACTOR_IDS' : 'INVALID_CALLSIGN' }; }
  const result = reason => ({ normalized, routable: reason === null, reason });
  if (normalized === null) return result('CALLSIGN_UNSET');
  if (!/^[a-z][a-z0-9]*(?:[ '\-][a-z0-9]+)*$/.test(normalized)) return result('UNSUPPORTED_CALLSIGN_CHARACTERS');
  if (normalized.split(/[ '\-]/).some(word => reserved.has(word))) return result('RESERVED_CALLSIGN');
  if (actorIds.includes(normalized)) return result('ACTOR_ID_CALLSIGN_COLLISION');
  return result(null);
}
