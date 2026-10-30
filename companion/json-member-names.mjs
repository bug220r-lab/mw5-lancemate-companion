// Inspect member names only after JSON.parse has validated the source syntax.
// Last-wins parsing must not erase contradictory evidence before admission.
export function duplicateJsonMemberStatus(source) {
  const frames = [];
  for (let index = 0; index < source.length; index++) {
    const code = source.charCodeAt(index);
    if (code === 0x22) {
      const start = index;
      let escaped = false;
      for (index++; index < source.length; index++) {
        const character = source.charCodeAt(index);
        if (escaped) escaped = false;
        else if (character === 0x5c) escaped = true;
        else if (character === 0x22) break;
      }
      const frame = frames.at(-1);
      if (frame?.kind === 'object' && frame.expectKey) {
        const key = JSON.parse(source.slice(start, index + 1));
        if (frame.keys.has(key)) return 'DUPLICATE_JSON_MEMBER';
        frame.keys.add(key);
        frame.expectKey = false;
        // Match the existing per-record structure budget; never retain an
        // unbounded key set while checking a syntactically valid document.
        if (frame.keys.size > 30000) return 'JSON_STRUCTURE_LIMIT';
      }
    } else if (code === 0x7b || code === 0x5b) {
      frames.push(code === 0x7b ? { kind: 'object', expectKey: true, keys: new Set() } :
        { kind: 'array' });
      if (frames.length > 1024) return 'JSON_STRUCTURE_LIMIT';
    } else if (code === 0x7d || code === 0x5d) frames.pop();
    else if (code === 0x2c && frames.at(-1)?.kind === 'object')
      frames.at(-1).expectKey = true;
  }
  return null;
}
