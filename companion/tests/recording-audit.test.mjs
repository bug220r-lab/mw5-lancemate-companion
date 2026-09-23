// MOCK_ONLY. No native observer or real mission is exercised here.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditRecordingBytes, inspectRecordingFile, RECORDING_LIMITS } from '../recording-audit.mjs';
import { replayFrames } from '../observation.mjs';
import { baseline } from '../../synthetic/tactical-cases.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const frame = (sequence = 1, time = 1000, change = () => {}) => {
  const snapshot = baseline();
  Object.assign(snapshot, { sequence, observedAtMs: time, nowMs: time, targets: [] });
  snapshot.lancemates = ['alpha', 'bravo', 'charlie'].map((name, i) => ({
    ...structuredClone(snapshot.lancemates[0]), id: name, pawnId: `pawn${i}`, controllerId: `controller${i}`,
    capabilities: [], engagements: [], manual: null,
  }));
  const f = { schemaVersion: 1, kind: 'observation', provenance: 'MOCK_ONLY', adapterId: 'mock-recorder',
    session: snapshot.session, sequence, observedAtMs: time, snapshot };
  change(f, snapshot); return f;
};
const bytes = xs => Buffer.from(JSON.stringify(xs));
const check = (xs, options = {}) => auditRecordingBytes(bytes(xs), { allowSynthetic: true, ...options });

test('nominal intervals and three member IDs are measured without a gameplay claim', () => {
  const r = check([frame(), frame(2, 1500), frame(3, 2000)]);
  assert.equal(r.formatStatus, 'VALID_PROJECT_ENVELOPES');
  assert.equal(r.classification, 'MOCK_ONLY');
  assert.equal(r.streams[0].p95IntervalMs, 500);
  assert.equal(r.streams[0].framesWithThreeDistinctMemberIds, 3);
  assert.equal(r.streams[0].framesWithLeaderPawnId, 3);
  assert.equal(r.nativeIdentityValidation, 'NOT_PERFORMED');
  assert.equal(r.runtimeAcceptance, 'NOT_PERFORMED');
  assert.equal(r.commandsIssued, 0);
  assert.equal(r.replay.recommendationsDispatchable, false);
});

test('paused, unknown and empty roster samples remain in the original replay order', () => {
  const xs = [frame(), frame(2, 1500, (_, s) => { s.phase = 'paused'; }),
    frame(3, 2000, (_, s) => { s.authority = null; s.lancemates = []; }),
    frame(4, 2500, (_, s) => { s.phase = null; delete s.lancemates; }), frame(5, 3000)];
  const r = check(xs), expected = replayFrames(xs, { allowSynthetic: true });
  assert.equal(r.formatStatus, 'VALID_PROJECT_ENVELOPES');
  assert.equal(r.replay.framesSubmitted, 5);
  assert.equal(r.replay.rejected, expected.results.filter(x => !x.accepted).length);
  assert.deepEqual(r.replay.errors, expected.errors);
  assert.equal(r.streams[0].inactiveOrUnknownPhaseFrames, 2);
  assert.equal(r.streams[0].missingMemberInventoryFrames, 1);
});

test('sequence gaps and delayed timestamps are separate observations, never interpolated', () => {
  const r = check([frame(), frame(5, 3000), frame(6, 3000)]), s = r.streams[0];
  assert.equal(r.frameCount, 3); assert.equal(r.replay.framesSubmitted, 3);
  assert.equal(s.sequenceGaps, 1); assert.equal(s.unaccountedSequenceNumbers, '3');
  assert.equal(s.longIntervals, 1); assert.equal(s.minIntervalMs, 0);
  assert.equal(s.maxIntervalMs, 2000);
});

test('reordered, duplicate and time-regressed frames are reported rather than sorted', () => {
  const r = check([frame(3, 2000), frame(2, 1500), frame(2, 1500)]);
  assert.equal(r.formatStatus, 'INVALID');
  assert.equal(r.streams[0].nonIncreasingSequences, 2);
  assert.equal(r.streams[0].clockRegressions, 1);
  assert.equal(r.replay.framesSubmitted, 3);
});

test('new mission clocks can reset; returning to a retired session is flagged', () => {
  const newMission = frame(1, 0, (f, s) => { f.session = s.session = 'mission2'; });
  const valid = check([frame(), newMission]);
  assert.equal(valid.formatStatus, 'VALID_PROJECT_ENVELOPES');
  assert.equal(valid.streams.length, 2);
  assert.ok(valid.streams.every(s => s.measuredIntervalCount === 0));
  assert.ok(check([frame(), newMission, frame(2, 1500)]).findings.some(f => f.code === 'RETIRED_SESSION_REAPPEARED'));
});

test('an adapter or provenance change inside one session is not a continuous stream', () => {
  for (const mutate of [f => { f.adapterId = 'other'; }, f => { f.provenance = 'GAME_OBSERVED'; }]) {
    const r = check([frame(), frame(2, 1500, mutate)]);
    assert.ok(r.findings.some(f => f.code === 'SESSION_STREAM_CHANGED'));
    assert.equal(r.streams[0].measuredIntervalCount, 0);
  }
});

test('claimed real provenance and valid envelopes cannot certify a real mission', () => {
  const r = check([frame(1, 1000, f => { f.provenance = 'GAME_OBSERVED'; })]);
  assert.equal(r.classification, 'GAME_OBSERVED_UNVALIDATED');
  assert.equal(r.runtimeAcceptance, 'NOT_PERFORMED');
  assert.equal(r.nativeIdentityValidation, 'NOT_PERFORMED');
});

test('synthetic input requires explicit opt-in and mixed recordings retain mixed classification', () => {
  assert.ok(check([frame()], { allowSynthetic: false }).findings.some(x => x.code === 'SYNTHETIC_DISABLED'));
  assert.equal(check([frame(), frame(1, 0, (f, s) => {
    f.session = s.session = 'other'; f.provenance = 'GAME_OBSERVED';
  })]).classification, 'MIXED_OR_INVALID_PROVENANCE');
});

test('unknown extension data remains byte-for-byte unchanged and is not certified', () => {
  const input = bytes([frame(1, 1000, (_, s) => { s.nativeReadings = { position: null,
    units: null, unavailable: ['worker'], producerAssertion: 'verified' }; })]);
  const before = Buffer.from(input), r = auditRecordingBytes(input, { allowSynthetic: true });
  assert.deepEqual(input, before); assert.equal(r.sourceModified, false);
  assert.equal(r.sourceSha256, createHash('sha256').update(before).digest('hex'));
  assert.equal(r.nativeIdentityValidation, 'NOT_PERFORMED');
});

test('single samples cannot fabricate timing or a zero interval', () => {
  const s = check([frame()]).streams[0];
  assert.equal(s.measuredIntervalCount, 0);
  for (const k of ['minIntervalMs', 'p50IntervalMs', 'p95IntervalMs', 'maxIntervalMs']) assert.equal(s[k], null);
});

test('malformed envelopes break timing adjacency while all entries reach replay', () => {
  const r = check([frame(), null, frame(3, 2000)]);
  assert.equal(r.streams[0].measuredIntervalCount, 0);
  assert.equal(r.replay.framesSubmitted, 3);
  assert.equal(r.formatStatus, 'INVALID');
});

test('duplicate member or pawn claims do not become independent native identity proof', () => {
  const r = check([frame(1, 1000, (_, s) => { s.lancemates[1].pawnId = s.lancemates[0].pawnId; })]);
  assert.equal(r.replay.rejected, 1); assert.equal(r.nativeIdentityValidation, 'NOT_PERFORMED');
});

test('UTF-8, syntax, empty and oversized lists fail without a real-data success label', () => {
  for (const input of [Buffer.from([0xff]), Buffer.from('{'), bytes([]), bytes({}), bytes(Array(20001).fill(null))]) {
    const r = auditRecordingBytes(input);
    assert.equal(r.formatStatus, 'INVALID'); assert.equal(r.replay, null);
  }
});

test('file, frame and structure limits bound work before tactical replay', () => {
  const large = auditRecordingBytes(Buffer.alloc(RECORDING_LIMITS.bytes + 1));
  assert.equal(large.findings[0].code, 'RECORDING_TOO_LARGE');
  assert.equal(large.sourceSha256, null);
  const f = frame(); f.padding = 'x'.repeat(RECORDING_LIMITS.frameBytes);
  assert.equal(check([f]).replay, null);
  f.padding = null; let deep = {}; f.deep = deep;
  for (let i = 0; i < 40; i++) { deep.next = {}; deep = deep.next; }
  assert.ok(check([f]).findings.some(x => x.code === 'FRAME_STRUCTURE_LIMIT'));
});

test('finding detail is bounded while total count remains visible', () => {
  const r = check(Array(250).fill(null));
  assert.equal(r.findingCount, 250); assert.equal(r.findings.length, 200);
  assert.equal(r.findingsTruncated, true); assert.equal(r.replay.errorsTruncated, true);
});

test('read-only file inspection preserves the original bytes', async () => {
  const dir = await mkdtemp(path.join(root, 'tmp', 'recording-audit-test-'));
  const file = path.join(dir, 'sample.json');
  try {
    const input = bytes([frame(), frame(2, 1500)]); await writeFile(file, input);
    const r = await inspectRecordingFile(file, { allowSynthetic: true });
    assert.equal(r.formatStatus, 'VALID_PROJECT_ENVELOPES');
    assert.deepEqual(await readFile(file), input);
    await assert.rejects(inspectRecordingFile(dir), /INPUT_NOT_BOUNDED_REGULAR_FILE|EISDIR/);
  } finally {
    assert.ok(path.resolve(dir).startsWith(path.resolve(root, 'tmp') + path.sep));
    await rm(dir, { recursive: true, force: true });
  }
});
