// Offline, read-only pinned text ingress. No receipt event schema or native calls.
import { createHash } from 'node:crypto';
import { open } from 'node:fs/promises';

export const RECEIPT_TEXT_LIMITS = Object.freeze({ utf16Units: 4096, bytes: 8194 });
const own = (x, key) => Object.hasOwn(x, key);
function requirePin(pin) {
  if (pin === null || typeof pin !== 'object' || Array.isArray(pin) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(pin)) ||
      Object.keys(pin).length !== 2 || !own(pin, 'expectedBytes') || !own(pin, 'expectedSha256') ||
      !Number.isSafeInteger(pin.expectedBytes) || pin.expectedBytes < 0 || pin.expectedBytes > RECEIPT_TEXT_LIMITS.bytes ||
      typeof pin.expectedSha256 !== 'string' || !/^[0-9a-f]{64}$/.test(pin.expectedSha256))
    throw new Error('INVALID_RECEIPT_TEXT_PIN');
  return { expectedBytes: pin.expectedBytes, expectedSha256: pin.expectedSha256 };
}

/** Encoding and exact pinned bytes only. The text has no defined receipt schema.
 * The leading storage BOM is excluded from text/units; all payload units survive.
 */
export function auditReceiptTextBytes(bytes, pin) {
  const expected = requirePin(pin);
  if (!(bytes instanceof Uint8Array)) throw new Error('RECEIPT_TEXT_BYTES_REQUIRED');
  const report = { schemaVersion: 1, kind: 'diagnostic-receipt-text-audit',
    classification: 'PINNED_TEXT_ONLY', formatStatus: 'INVALID', pinStatus: 'NOT_EVALUATED',
    sourceBytes: bytes.byteLength, sourceSha256: null, sourceUtf16Units: null, text: null,
    sourceModified: false, runtimeAcceptance: 'NOT_PERFORMED', transitionSchema: 'NOT_DEFINED',
    semanticStatus: 'NOT_EVALUATED', aggregateBudgetValidation: 'NOT_PERFORMED', findings: [],
    limitations: [
      'Byte-format validity does not establish a native mission receipt, controller instance count, arming, transition, or teardown.',
      'No event schema is defined or parsed; empty BOM-only text can be byte-format valid.',
      '4096 UTF-16 units is a per-file ingress limit, not validation of the proposed 32-record/4096-total-unit writer budget.',
      'Each file has a separate two-byte BOM storage overhead; the BOM is excluded from payload units.',
      'Pins identify exact retained bytes; they do not establish writer provenance or current editor/retail compatibility.'
    ] };
  const fail = code => { report.findings.push({ code }); return report; };
  if (bytes.byteLength > RECEIPT_TEXT_LIMITS.bytes) return fail('RECEIPT_TEXT_TOO_LARGE');
  // Hash and decode this same bounded copy, including BOM in the hash. A view's
  // unrelated backing-buffer bytes are never included.
  const source = Buffer.from(bytes);
  report.sourceSha256 = createHash('sha256').update(source).digest('hex');
  if (source.length !== expected.expectedBytes || report.sourceSha256 !== expected.expectedSha256) {
    report.pinStatus = 'MISMATCH';
    return fail('RECEIPT_TEXT_PIN_MISMATCH');
  }
  report.pinStatus = 'MATCHED';
  if (source.length < 2 || source[0] !== 0xff || source[1] !== 0xfe)
    return fail('UTF16LE_BOM_REQUIRED');
  if (source.length % 2 !== 0) return fail('ODD_UTF16_BYTE_COUNT');
  report.sourceUtf16Units = (source.length - 2) / 2;
  // Validate code units explicitly: Buffer's decoder alone replaces/accepts
  // malformed surrogate sequences. No trim, newline conversion or normalization.
  for (let at = 2; at < source.length; at += 2) {
    const unit = source.readUInt16LE(at);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      if (at + 2 >= source.length) return fail('UNPAIRED_UTF16_SURROGATE');
      const next = source.readUInt16LE(at + 2);
      if (next < 0xdc00 || next > 0xdfff) return fail('UNPAIRED_UTF16_SURROGATE');
      at += 2;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) return fail('UNPAIRED_UTF16_SURROGATE');
  }
  report.text = source.toString('utf16le', 2);
  report.formatStatus = 'VALID_PINNED_UTF16LE_TEXT';
  return report;
}

const metadataKeys = ['dev', 'ino', 'size', 'mtimeNs', 'ctimeNs'];
function requireMetadata(stat) {
  if (!stat.isFile() || metadataKeys.some(key => typeof stat[key] !== 'bigint') ||
      stat.size < 0n || stat.size > BigInt(RECEIPT_TEXT_LIMITS.bytes))
    throw new Error('INPUT_NOT_BOUNDED_REGULAR_FILE');
}

/** Bounded stat/read/restat of one read-only descriptor. openFile is a dependency
 * seam for deterministic offline tests; the CLI always uses node:fs/promises.open.
 * Stability is observed over this read only, not guaranteed after return.
 */
export async function inspectReceiptTextFile(file, pin, { openFile = open } = {}) {
  const expected = requirePin(pin); // Fail unknown pins before opening anything.
  const handle = await openFile(file, 'r');
  try {
    const before = await handle.stat({ bigint: true });
    requireMetadata(before);
    const source = Buffer.alloc(Number(before.size) + 1); // One growth sentinel.
    let offset = 0;
    while (offset < source.length) {
      const remaining = source.length - offset;
      const { bytesRead } = await handle.read(source, offset, remaining, offset);
      if (!Number.isSafeInteger(bytesRead) || bytesRead < 0 || bytesRead > remaining)
        throw new Error('INVALID_FILE_READ_RESULT');
      if (bytesRead === 0) break;
      offset += bytesRead;
    }
    const after = await handle.stat({ bigint: true });
    if (!after.isFile() || offset !== Number(before.size) ||
        metadataKeys.some(key => after[key] !== before[key]))
      throw new Error('INPUT_CHANGED_DURING_READ');
    return { ...auditReceiptTextBytes(source.subarray(0, offset), expected),
      fileReadStatus: 'BOUNDED_DESCRIPTOR_STABLE' };
  } finally { await handle.close(); }
}
