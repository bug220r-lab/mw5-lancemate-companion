// Offline encoding/file-reader tests only. Historical fixtures are never run.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditReceiptTextBytes, inspectReceiptTextFile, RECEIPT_TEXT_LIMITS } from '../companion/diagnostic-receipt-text.mjs';

const args = process.argv.slice(2);
if (args.length !== 1) {
  console.error('Usage: node scripts/Test-DiagnosticReceiptText.mjs <repository-root-with-retained-historical-evidence>');
  process.exitCode = 2;
} else {
  const cases = [], historical = [];
  async function test(name, fn, classification = 'MOCK_ONLY') {
    try { await fn(); cases.push({ name, classification, status: 'PASSED' }); }
    catch (error) { cases.push({ name, classification, status: 'FAILED', error: error.message }); }
  }
  const sha = bytes => createHash('sha256').update(bytes).digest('hex');
  const pin = bytes => ({ expectedBytes: bytes.length, expectedSha256: sha(bytes) });
  const encoded = text => Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(text, 'utf16le')]);
  const audit = bytes => auditReceiptTextBytes(bytes, pin(bytes));
  function invariants(report) {
    assert.equal(report.runtimeAcceptance, 'NOT_PERFORMED');
    assert.equal(report.transitionSchema, 'NOT_DEFINED');
    assert.equal(report.semanticStatus, 'NOT_EVALUATED');
    assert.equal(report.aggregateBudgetValidation, 'NOT_PERFORMED');
    assert.equal(report.sourceModified, false);
    assert.equal(report.classification, 'PINNED_TEXT_ONLY');
  }
  function valid(text) {
    const bytes = encoded(text), original = Buffer.from(bytes), report = audit(bytes);
    invariants(report);
    assert.equal(report.formatStatus, 'VALID_PINNED_UTF16LE_TEXT');
    assert.equal(report.sourceUtf16Units, text.length);
    assert.equal(report.sourceSha256, sha(bytes));
    assert.equal(report.text, text);
    assert.deepEqual(encoded(report.text), original);
    assert.deepEqual(bytes, original);
    return report;
  }
  function invalid(bytes, code) {
    const report = audit(bytes);
    invariants(report);
    assert.equal(report.formatStatus, 'INVALID');
    assert.equal(report.text, null);
    assert(report.findings.some(f => f.code === code));
    return report;
  }
  await test('preserves ASCII, CRLF, whitespace, NUL, U+FEFF, and decomposed Unicode exactly', () => {
    valid('  \r\nA\0\uFEFFe\u0301\r\n\t ');
  });
  await test('preserves payload-leading U+FEFF after storage BOM', () => valid('\uFEFFpayload'));
  await test('BOM-only empty payload is byte-format valid without receipt semantics', () => valid(''));
  await test('counts supplementary scalar as two UTF-16 units', () => {
    assert.equal(valid('A\u{1f680}B').sourceUtf16Units, 4);
  });
  await test('accepts exactly 4096 ASCII UTF-16 units / 8194 total bytes', () => {
    assert.equal(valid('a'.repeat(4096)).sourceBytes, RECEIPT_TEXT_LIMITS.bytes);
  });
  await test('accepts supplementary pair ending exactly at 4096 units', () => valid('a'.repeat(4094) + '\u{1f680}'));
  await test('rejects 4097 units before copying or hashing', () => {
    const report = auditReceiptTextBytes(encoded('a'.repeat(4097)), pin(encoded('a'.repeat(4096))));
    invariants(report); assert.equal(report.formatStatus, 'INVALID'); assert.equal(report.text, null);
    assert(report.findings.some(f => f.code === 'RECEIPT_TEXT_TOO_LARGE'));
    assert.equal(report.sourceSha256, null);
  });
  await test('rejects UTF-8 bytes even when size/hash pins match', () => invalid(Buffer.from('text', 'utf8'), 'UTF16LE_BOM_REQUIRED'));
  await test('rejects UTF-8 BOM', () => invalid(Buffer.from([0xef, 0xbb, 0xbf, 0x41]), 'UTF16LE_BOM_REQUIRED'));
  await test('rejects big-endian BOM', () => invalid(Buffer.from([0xfe, 0xff, 0x00, 0x41]), 'UTF16LE_BOM_REQUIRED'));
  await test('rejects BOM-less UTF-16LE', () => invalid(Buffer.from('test', 'utf16le'), 'UTF16LE_BOM_REQUIRED'));
  await test('rejects empty bytes and one truncated BOM byte', () => {
    invalid(Buffer.alloc(0), 'UTF16LE_BOM_REQUIRED'); invalid(Buffer.from([0xff]), 'UTF16LE_BOM_REQUIRED');
  });
  await test('rejects odd byte truncation after valid BOM', () => invalid(Buffer.from([0xff, 0xfe, 0x41]), 'ODD_UTF16_BYTE_COUNT'));
  for (const [name, text] of [['lone high', '\ud800'], ['lone low', '\udc00'],
    ['high before non-low', '\ud800A'], ['two high', '\ud800\ud800'],
    ['low before high', '\udc00\ud800'], ['valid pair then lone low', '\ud800\udc00\udc00']]) {
    await test(`rejects ${name} surrogate`, () => invalid(encoded(text), 'UNPAIRED_UTF16_SURROGATE'));
  }
  await test('rejects high surrogate truncated at the unit cap', () => invalid(encoded('a'.repeat(4095) + '\ud800'), 'UNPAIRED_UTF16_SURROGATE'));
  await test('hash mismatch rejects otherwise valid text', () => {
    const bytes = encoded('abc'), report = auditReceiptTextBytes(bytes, { ...pin(bytes), expectedSha256: '0'.repeat(64) });
    invariants(report); assert.equal(report.pinStatus, 'MISMATCH'); assert.equal(report.text, null);
    assert.equal(report.sourceSha256, sha(bytes)); assert.equal(report.formatStatus, 'INVALID');
  });
  await test('size mismatch rejects otherwise valid text', () => {
    const bytes = encoded('abc'), report = auditReceiptTextBytes(bytes, { ...pin(bytes), expectedBytes: bytes.length + 2 });
    invariants(report); assert.equal(report.pinStatus, 'MISMATCH'); assert.equal(report.text, null);
  });
  await test('hash includes storage BOM and uses exact typed-array view', () => {
    const payload = encoded('view'), backing = Buffer.concat([Buffer.from('prefix'), payload, Buffer.from('suffix')]);
    const view = new Uint8Array(backing.buffer, backing.byteOffset + 6, payload.length);
    const report = auditReceiptTextBytes(view, pin(payload));
    assert.equal(report.text, 'view'); assert.equal(report.sourceSha256, sha(payload));
    assert.notEqual(report.sourceSha256, sha(payload.subarray(2)));
  });
  await test('byte inspection does not retain caller mutable byte view', () => {
    const bytes = encoded('keep'), report = audit(bytes); bytes.fill(0);
    assert.equal(report.text, 'keep'); assert.equal(report.sourceSha256, sha(encoded('keep')));
  });
  await test('absent, malformed, and unknown-key pins fail closed', () => {
    const bytes = encoded('a'), good = pin(bytes);
    for (const bad of [undefined, null, [], {}, { expectedBytes: 4 }, { expectedSha256: good.expectedSha256 },
      { ...good, extra: true }, { ...good, expectedBytes: -1 }, { ...good, expectedBytes: 4.1 },
      { ...good, expectedBytes: '4' }, { ...good, expectedBytes: 8195 }, { ...good, expectedBytes: Number.MAX_SAFE_INTEGER + 1 },
      { ...good, expectedSha256: 'z'.repeat(64) }, { ...good, expectedSha256: good.expectedSha256.toUpperCase() }])
      assert.throws(() => auditReceiptTextBytes(bytes, bad), /INVALID_RECEIPT_TEXT_PIN/);
  });
  await test('requires Uint8Array input', () => assert.throws(() => auditReceiptTextBytes('text', pin(encoded('text'))), /RECEIPT_TEXT_BYTES_REQUIRED/));

  function fakeFile(bytes, { change = {}, beforeChange = {}, chunkBytes = Infinity, readError = false, isFile = true, growth = false, short = false } = {}) {
    let calls = 0, closed = 0, reads = 0, totalRequested = 0;
    const baseline = { dev: 1n, ino: 2n, size: BigInt(bytes.length), mtimeNs: 3n, ctimeNs: 4n, ...beforeChange };
    const handle = {
      async stat(options) { assert.deepEqual(options, { bigint: true }); calls++; return {
        ...baseline, ...(calls > 1 ? change : {}), isFile: () => calls > 1 ? isFile : true }; },
      async read(buffer, offset, length, position) {
        reads++; totalRequested += length; assert.equal(position, offset);
        if (readError) throw new Error('SIMULATED_READ_FAILURE');
        const available = Math.max(0, bytes.length - offset - (short ? 1 : 0));
        let count = Math.min(length, chunkBytes, available);
        bytes.copy(buffer, offset, offset, offset + count);
        if (!count && growth && offset === bytes.length) { buffer[offset] = 0; count = 1; }
        return { bytesRead: count };
      },
      async close() { closed++; }
    };
    return { openFile: async (file, flags) => { assert.equal(file, 'fake'); assert.equal(flags, 'r'); return handle; },
      closed: () => closed, reads: () => reads, requested: () => totalRequested };
  }
  await test('bounded file reader accepts partial reads and closes exactly once', async () => {
    const bytes = encoded('read'), fake = fakeFile(bytes, { chunkBytes: 1 });
    const report = await inspectReceiptTextFile('fake', pin(bytes), fake);
    assert.equal(report.text, 'read'); invariants(report);
    assert.equal(report.fileReadStatus, 'BOUNDED_DESCRIPTOR_STABLE'); assert.equal(fake.closed(), 1);
    assert(fake.reads() <= bytes.length + 1);
  });
  for (const [key, value] of [['dev', 9n], ['ino', 9n], ['size', 9n], ['mtimeNs', 9n], ['ctimeNs', 9n]]) {
    await test(`file reader rejects changed ${key}`, async () => {
      const bytes = encoded('read'), fake = fakeFile(bytes, { change: { [key]: value } });
      await assert.rejects(inspectReceiptTextFile('fake', pin(bytes), fake), /INPUT_CHANGED_DURING_READ/);
      assert.equal(fake.closed(), 1);
    });
  }
  await test('growth sentinel rejects extra bytes even if metadata is unchanged', async () => {
    const bytes = encoded('read'), fake = fakeFile(bytes, { growth: true });
    await assert.rejects(inspectReceiptTextFile('fake', pin(bytes), fake), /INPUT_CHANGED_DURING_READ/);
    assert.equal(fake.closed(), 1);
  });
  await test('short read rejects unchanged-size descriptor', async () => {
    const bytes = encoded('read'), fake = fakeFile(bytes, { short: true });
    await assert.rejects(inspectReceiptTextFile('fake', pin(bytes), fake), /INPUT_CHANGED_DURING_READ/);
    assert.equal(fake.closed(), 1);
  });
  await test('read error closes descriptor', async () => {
    const bytes = encoded('read'), fake = fakeFile(bytes, { readError: true });
    await assert.rejects(inspectReceiptTextFile('fake', pin(bytes), fake), /SIMULATED_READ_FAILURE/);
    assert.equal(fake.closed(), 1);
  });
  await test('non-regular descriptor fails closed before any read', async () => {
    let reads = 0, closed = 0;
    await assert.rejects(inspectReceiptTextFile('fake', pin(encoded('a')), { openFile: async () => ({
      stat: async () => ({ isFile: () => false }), read: async () => { reads++; }, close: async () => { closed++; }
    }) }), /INPUT_NOT_BOUNDED_REGULAR_FILE/);
    assert.equal(reads, 0); assert.equal(closed, 1);
  });
  await test('oversize descriptor fails closed before any read', async () => {
    const bytes = encoded('read'), fake = fakeFile(bytes, { beforeChange: { size: 8195n } });
    await assert.rejects(inspectReceiptTextFile('fake', pin(bytes), fake), /INPUT_NOT_BOUNDED_REGULAR_FILE/);
    assert.equal(fake.reads(), 0); assert.equal(fake.closed(), 1);
  });
  await test('unknown pin fails before file open', async () => {
    let opened = false;
    await assert.rejects(inspectReceiptTextFile('fake', undefined, { openFile: async () => { opened = true; } }), /INVALID_RECEIPT_TEXT_PIN/);
    assert.equal(opened, false);
  });
  await test('oversize manifest pin fails before file open', async () => {
    let opened = false;
    await assert.rejects(inspectReceiptTextFile('fake', { expectedBytes: 8195, expectedSha256: '0'.repeat(64) },
      { openFile: async () => { opened = true; } }), /INVALID_RECEIPT_TEXT_PIN/);
    assert.equal(opened, false);
  });

  const fixtures = [
    { relative: 'research/evidence/victory-writer-manual-proof-20261006-01/native-run-001/victory-marker.txt',
      expectedBytes: 260, expectedSha256: '2eb21e246f58cc1bbe486d5d59c9842a745406ef2d7e471c89f3cab854d394a8', units: 129 },
    { relative: 'research/evidence/victory-writer-failure-proof-20261006-01/native-run-001/owned-native-fixture.txt',
      expectedBytes: 140, expectedSha256: '352705377882e8cdb73b469f43686f06e895b92cc851aa4ea0959d10ce4ded04', units: 69 }
  ];
  for (const fixture of fixtures) {
    await test(`retained historical file ${fixture.relative}`, async () => {
      const report = await inspectReceiptTextFile(join(args[0], fixture.relative), {
        expectedBytes: fixture.expectedBytes, expectedSha256: fixture.expectedSha256 });
      invariants(report); assert.equal(report.formatStatus, 'VALID_PINNED_UTF16LE_TEXT');
      assert.equal(report.sourceUtf16Units, fixture.units);
      assert.equal(sha(encoded(report.text)), fixture.expectedSha256);
      historical.push({ source: fixture.relative, classification: 'HISTORICAL_EDITOR_PYTHON_WRITER_BYTES_ONLY',
        sourceBytes: report.sourceBytes, sourceSha256: report.sourceSha256, sourceUtf16Units: report.sourceUtf16Units,
        missionReceipt: 'NOT_ESTABLISHED', current398Compatibility: 'NOT_PERFORMED' });
    }, 'HISTORICAL_EDITOR_PYTHON_WRITER_BYTES_ONLY');
  }
  const cli = fileURLToPath(new URL('./Inspect-DiagnosticReceiptText.mjs', import.meta.url));
  const first = fixtures[0], fixtureFile = join(args[0], first.relative);
  function cliRun(values) { return spawnSync(process.execPath, [cli, ...values], { encoding: 'utf8', timeout: 10000 }); }
  await test('CLI requires explicit size/hash pin and rejects unknown arguments', () => {
    for (const argv of [[], [fixtureFile], [fixtureFile, '--allow-synthetic'],
      [fixtureFile, '--expected-bytes', '260', '--expected-sha256', first.expectedSha256, '--extra']]) {
      const run = cliRun(argv); assert.equal(run.status, 2); assert.match(run.stderr, /Usage:/);
    }
  });
  await test('CLI reads retained exact pin without claiming semantic or runtime success', () => {
    const run = cliRun([fixtureFile, '--expected-bytes', '260', '--expected-sha256', first.expectedSha256]);
    assert.equal(run.status, 0, run.stderr); const report = JSON.parse(run.stdout); invariants(report);
    assert.equal(report.sourceSha256, first.expectedSha256);
  }, 'HISTORICAL_EDITOR_PYTHON_WRITER_BYTES_ONLY');
  await test('CLI returns rejection for mismatched pin', () => {
    const run = cliRun([fixtureFile, '--expected-bytes', '260', '--expected-sha256', '0'.repeat(64)]);
    assert.equal(run.status, 1, run.stderr); assert.equal(JSON.parse(run.stdout).pinStatus, 'MISMATCH');
  });
  await test('CLI reports read failure for missing file', () => {
    const run = cliRun([join(args[0], 'missing-receipt-fixture-never-created.txt'), '--expected-bytes', '260', '--expected-sha256', first.expectedSha256]);
    assert.equal(run.status, 2); const report = JSON.parse(run.stderr);
    assert.equal(report.status, 'READ_FAILED'); assert.equal(report.runtimeAcceptance, 'NOT_PERFORMED');
  });
  const failed = cases.filter(x => x.status === 'FAILED');
  console.log(JSON.stringify({ kind: 'diagnostic-receipt-text-tests', status: failed.length ? 'FAILED' : 'PASSED',
    passed: cases.length - failed.length, failed: failed.length, total: cases.length,
    runtimeAcceptance: 'NOT_PERFORMED', transitionSchema: 'NOT_DEFINED', semanticStatus: 'NOT_EVALUATED',
    aggregateBudgetValidation: 'NOT_PERFORMED', sourceModified: false,
    historicalLimitations: 'Retained October 6 native editor-Python writer outputs only; predate the October 15 editor update. No proof rerun, Blueprint execution, current398 compatibility or mission receipt.',
    historical, cases }, null, 2));
  process.exitCode = failed.length ? 1 : 0;
}
