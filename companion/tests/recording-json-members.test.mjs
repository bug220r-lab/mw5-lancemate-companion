// MOCK_ONLY: ambiguous evidence must never be interpreted by last-wins parsing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { auditRecordingBytes } from '../recording-audit.mjs';
import { baseline } from '../../synthetic/tactical-cases.mjs';

function frame(sequence = 1) {
  const snapshot = baseline();
  snapshot.sequence = sequence;
  snapshot.observedAtMs = snapshot.nowMs = 1000 + (sequence - 1) * 500;
  snapshot.targets[0].observedAtMs = snapshot.observedAtMs;
  return { schemaVersion: 1, kind: 'observation', provenance: 'MOCK_ONLY',
    adapterId: 'json-member-fixture', session: snapshot.session, sequence,
    observedAtMs: snapshot.observedAtMs, snapshot };
}
function rejected(source, options = { allowSynthetic: true }) {
  const input = Buffer.from(source), saved = Buffer.from(input);
  const result = auditRecordingBytes(input, options);
  assert.equal(result.formatStatus, 'INVALID');
  assert.deepEqual(result.findings, [{ index: null, code: 'DUPLICATE_JSON_MEMBER' }]);
  assert.equal(result.replay, null);
  assert.equal(result.classification, 'UNVALIDATED_RECORDING');
  assert.equal(result.commandsIssued, 0);
  assert.equal(result.runtimeAcceptance, 'NOT_PERFORMED');
  assert.equal(result.sourceSha256, createHash('sha256').update(saved).digest('hex'));
  assert.deepEqual(input, saved);
}

test('duplicate provenance cannot bypass synthetic opt-in in either member order', () => {
  const source = JSON.stringify(frame());
  for (const replacement of [
    '"provenance":"MOCK_ONLY","provenance":"GAME_OBSERVED"',
    '"provenance":"GAME_OBSERVED","provenance":"MOCK_ONLY"'
  ]) rejected(`[${source.replace('"provenance":"MOCK_ONLY"', replacement)}]`, {});
});

test('escaped member names are compared after decoding, including nested fields', () => {
  const source = JSON.stringify(frame());
  rejected(`[${source.replace('"provenance":"MOCK_ONLY"',
    '"provenance":"MOCK_ONLY","\\u0070rovenance":"GAME_OBSERVED"')}]`, {});
  rejected(`[${source.replace('"phase":"active"', '"phase":"paused","\\u0070hase":"active"')}]`);
});

test('duplicate manual state cannot erase an active human order before replay', () => {
  const source = JSON.stringify(frame());
  rejected(`[${source.replace('"manual":',
    '"manual":{"observable":true,"revision":1,"status":"active","persistent":true,"orderId":"human-hold"},"manual":')}]`);
});

test('nested duplicate extension fields and special-looking key names also reject', () => {
  const source = JSON.stringify(frame()).slice(0, -1);
  for (const extension of [
    '"extra":{"x":1,"x":2}',
    '"extra":{"outer":[{"x":1,"\\u0078":2}]}',
    '"extra":{"__proto__":1,"__proto__":2}',
    '"extra":{"constructor":1,"constructor":2}',
    '"extra":{"":1,"":2}'
  ]) rejected(`[${source},${extension}}]`);
});

test('a duplicate in a later frame blocks all replay rather than keeping a valid prefix', () => {
  const first = JSON.stringify(frame()), second = JSON.stringify(frame(2));
  rejected(`[${first},${second.replace('"sequence":2', '"sequence":2,"sequence":2')}]`);
});

test('names may repeat across separate frames and nested objects', () => {
  const first = frame(), second = frame(2);
  first.extension = { one: { x: 1 }, two: [{ x: 2 }, { x: 3 }] };
  const result = auditRecordingBytes(Buffer.from(JSON.stringify([first, second])), { allowSynthetic: true });
  assert.equal(result.formatStatus, 'VALID_PROJECT_ENVELOPES');
  assert.equal(result.replay.framesSubmitted, 2);
});

test('member-like text, escaped quotes and delimiter characters inside values stay data', () => {
  const value = frame();
  value.extension = { text: '"x":1,"x":2, } ] { \\ "', x: 'safe' };
  const result = auditRecordingBytes(Buffer.from(JSON.stringify([value])), { allowSynthetic: true });
  assert.equal(result.formatStatus, 'VALID_PROJECT_ENVELOPES');
  assert.equal(result.replay.framesSubmitted, 1);
});

test('malformed JSON and invalid UTF-8 retain their original syntax findings', () => {
  for (const input of [Buffer.from('[{"x":1,"x":}]'), Buffer.from([0xff])]) {
    const result = auditRecordingBytes(input);
    assert.deepEqual(result.findings, [{ index: null, code: 'INVALID_UTF8_OR_JSON' }]);
    assert.equal(result.replay, null);
  }
});
