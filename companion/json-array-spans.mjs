// Measure elements in an already syntax-validated JSON array's original UTF-8
// bytes. This is not a JSON validator: callers must parse and check the array
// first. Whitespace inside the array belongs to its adjacent element's span;
// commas, brackets and whitespace outside the array do not count.
export function jsonArrayElementByteSizes(bytes) {
  const sizes = [];
  let depth = 0, inString = false, escaped = false, start = null;
  for (let index = 0; index < bytes.byteLength; index++) {
    const byte = bytes[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (byte === 0x5c) escaped = true;
      else if (byte === 0x22) inString = false;
      continue;
    }
    if (byte === 0x22) inString = true;
    else if (byte === 0x5b || byte === 0x7b) {
      depth++;
      if (depth === 1) start = index + 1;
    } else if (byte === 0x5d || byte === 0x7d) {
      if (byte === 0x5d && depth === 1) sizes.push(index - start);
      depth--;
    } else if (byte === 0x2c && depth === 1) {
      sizes.push(index - start);
      start = index + 1;
    }
  }
  return sizes;
}
