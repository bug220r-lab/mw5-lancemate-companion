// MOCK_ONLY: offline file admission, not a native recorder or gameplay proof.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { auditRecordingBytes, RECORDING_LIMITS } from '../recording-audit.mjs';

function frame(sequence = 1) {
  return { schemaVersion: 1, kind: 'observation', adapterId: 'span-fixture',
    provenance: 'MOCK_ONLY', session: 'span-session', sequence, observedAtMs: sequence * 500,
    snapshot: { schemaVersion: 1, session: 'span-session', sequence, observedAtMs: sequence * 500,
      phase: null, authority: null, leader: null, lancemates: null, targets: null } };
}
const audit = source => auditRecordingBytes(source, { allowSynthetic: true });
const encode = source => Buffer.from(source, 'utf8');
function paddedElement(extra = 0, before = false) {
  const source = JSON.stringify(frame());
  const padding = ' '.repeat(RECORDING_LIMITS.frameBytes - Buffer.byteLength(source) + extra);
  return before ? padding + source : source + padding;
}

test('original serialized span accepts its exact byte limit with leading or trailing whitespace', () => {
  for (const before of [false, true]) {
    const input = encode(`[${paddedElement(0, before)}]`), saved = Buffer.from(input);
    const result = audit(input);
    assert.equal(result.formatStatus, 'VALID_PROJECT_ENVELOPES');
    assert.equal(result.frameCount, 1);
    assert.equal(result.replay.framesSubmitted, 1);
    assert.equal(result.sourceSha256, createHash('sha256').update(saved).digest('hex'));
    assert.deepEqual(input, saved);
  }
});

test('whitespace cannot hide a span one byte over the limit or produce partial replay', () => {
  for (const before of [false, true]) {
    const result = audit(encode(`[${paddedElement(1, before)}]`));
    assert.equal(result.formatStatus, 'INVALID');
    assert.deepEqual(result.findings, [{ index: 0, code: 'FRAME_TOO_LARGE' }]);
    assert.equal(result.frameCount, 1);
    assert.equal(result.replay, null);
    assert.equal(result.commandsIssued, 0);
    assert.equal(result.runtimeAcceptance, 'NOT_PERFORMED');
  }
});

test('JSON Unicode escapes count as original bytes even when the parsed string is short', () => {
  const value = frame(); value.padding = 'a'.repeat(22000);
  const compact = JSON.stringify(value);
  const escaped = compact.replace('"padding":"' + value.padding + '"',
    '"padding":"' + '\\u0061'.repeat(value.padding.length) + '"');
  assert.deepEqual(JSON.parse(escaped), value);
  assert.equal(audit(encode(`[${compact}]`)).formatStatus, 'VALID_PROJECT_ENVELOPES');
  const result = audit(encode(`[${escaped}]`));
  assert.deepEqual(result.findings, [{ index: 0, code: 'FRAME_TOO_LARGE' }]);
  assert.equal(result.replay, null);
});

test('oversized middle frame retains its original index and disables replay of the entire recording', () => {
  const result = audit(encode(`[${JSON.stringify(frame())},${paddedElement(1)},${JSON.stringify(frame(3))}]`));
  assert.equal(result.frameCount, 3);
  assert.deepEqual(result.findings, [{ index: 1, code: 'FRAME_TOO_LARGE' }]);
  assert.equal(result.streams[0].sampleCount, 2);
  assert.equal(result.streams[0].measuredIntervalCount, 0);
  assert.equal(result.replay, null);
});

test('nested punctuation, escaped quotes and UTF-8 text do not split frames', () => {
  const first = frame(), second = frame(2);
  first.extension = { text: '汉字,][}{"\\\"', nested: ['x,y', { x: '],} {' }] };
  const input = encode(` \n[ \t${JSON.stringify(first)},\r\n${JSON.stringify(second)} ]\n`);
  const result = audit(input);
  assert.equal(result.formatStatus, 'VALID_PROJECT_ENVELOPES');
  assert.equal(result.frameCount, 2);
  assert.equal(result.streams[0].measuredIntervalCount, 1);
  assert.equal(result.streams[0].maxIntervalMs, 500);
});

test('UTF-8 encoded width counts towards the span rather than JavaScript string length', () => {
  const value = frame(); value.padding = '界'.repeat(45000);
  const source = JSON.stringify(value);
  assert.ok(source.length < RECORDING_LIMITS.frameBytes);
  assert.ok(Buffer.byteLength(source) > RECORDING_LIMITS.frameBytes);
  assert.deepEqual(audit(encode(`[${source}]`)).findings, [{ index: 0, code: 'FRAME_TOO_LARGE' }]);
});

test('outer whitespace and an accepted UTF-8 BOM stay hashed but are outside the element cap', () => {
  const input = encode('\ufeff \n[' + paddedElement() + ']\t\r\n');
  const result = audit(input);
  assert.equal(result.formatStatus, 'VALID_PROJECT_ENVELOPES');
  assert.equal(result.sourceSha256, createHash('sha256').update(input).digest('hex'));
});

test('typed-array byte offsets cannot include neighboring backing-buffer bytes', () => {
  const payload = encode(`[${paddedElement()}]`);
  const backing = Buffer.concat([encode('prefix'), payload, encode('suffix')]);
  const view = new Uint8Array(backing.buffer, backing.byteOffset + 6, payload.length);
  const result = audit(view);
  assert.equal(result.formatStatus, 'VALID_PROJECT_ENVELOPES');
  assert.equal(result.sourceBytes, payload.length);
  assert.equal(result.sourceSha256, createHash('sha256').update(payload).digest('hex'));
});
