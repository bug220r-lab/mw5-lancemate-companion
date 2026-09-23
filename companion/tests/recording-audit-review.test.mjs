// Independent offline adversarial review. MOCK_ONLY; no game or native proof.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { auditRecordingBytes, RECORDING_LIMITS } from '../recording-audit.mjs';

function frame(sequence = 1, observedAtMs = 1000, session = 'review-session') {
  return { schemaVersion: 1, kind: 'observation', adapterId: 'review-fixture',
    provenance: 'MOCK_ONLY', session, sequence, observedAtMs,
    snapshot: { schemaVersion: 1, session, sequence, observedAtMs,
      phase: null, authority: null, leader: null, lancemates: null, targets: null } };
}
const audit = (frames, options = {}) => auditRecordingBytes(Buffer.from(JSON.stringify(frames)),
  { allowSynthetic: true, ...options });

test('review: unaccounted numbers do not double count gaps after reordering', () => {
  const r = audit([frame(1), frame(5, 1500), frame(2, 2000), frame(6, 2500)]);
  assert.equal(r.formatStatus, 'INVALID');
  // Only 3 and 4 are absent within the observed sequence span 1..6.
  assert.equal(r.streams[0].unaccountedSequenceNumbers, '2');
});

test('review: synthetic opt-in requires the boolean true', () => {
  for (const value of [1, 'true', 'false', {}, []]) {
    const r = audit([frame()], { allowSynthetic: value });
    assert.ok(r.findings.some(x => x.code === 'SYNTHETIC_DISABLED'));
    assert.equal(r.formatStatus, 'INVALID');
    assert.equal(r.replay.accepted, 0);
  }
});

test('review: metadata claiming completed acceptance never overrides audit labels', () => {
  const f = frame();
  Object.assign(f, { provenance: 'GAME_OBSERVED', runtimeAcceptance: 'PASS',
    nativeIdentityValidation: 'PASS', recommendationsDispatchable: true });
  const r = audit([f]);
  assert.equal(r.classification, 'GAME_OBSERVED_UNVALIDATED');
  assert.equal(r.runtimeAcceptance, 'NOT_PERFORMED');
  assert.equal(r.nativeIdentityValidation, 'NOT_PERFORMED');
  assert.equal(r.replay.recommendationsDispatchable, false);
});

test('review: whitespace and unknown raw fields remain hashed as original bytes', () => {
  const f = frame(); f.snapshot.unknown = { x: null, y: 'unavailable', z: 1e-5 };
  const original = Buffer.from(' \n\t' + JSON.stringify([f], null, 4) + '\r\n');
  const saved = Buffer.from(original), r = auditRecordingBytes(original, { allowSynthetic: true });
  assert.equal(r.sourceSha256, createHash('sha256').update(saved).digest('hex'));
  assert.deepEqual(original, saved);
  assert.equal(r.sourceModified, false);
});

test('review: stream limit preserves declared frame count but prevents partial replay', () => {
  const r = audit(Array.from({ length: RECORDING_LIMITS.streams + 1 }, (_, i) => frame(1, 0, `s${i}`)));
  assert.equal(r.frameCount, RECORDING_LIMITS.streams + 1);
  assert.equal(r.streams.length, RECORDING_LIMITS.streams);
  assert.equal(r.replay, null);
  assert.equal(r.formatStatus, 'INVALID');
  assert.ok(r.findings.some(x => x.code === 'STREAM_LIMIT'));
});

test('review: huge safe integer sequence gaps retain exact decimal totals', () => {
  const r = audit([frame(0), frame(Number.MAX_SAFE_INTEGER, 1500)]);
  assert.equal(r.streams[0].unaccountedSequenceNumbers, String(BigInt(Number.MAX_SAFE_INTEGER) - 1n));
});

test('review: numeric strings are not treated as valid timestamps or sequence numbers', () => {
  for (const key of ['sequence', 'observedAtMs']) {
    const f = frame(); f[key] = f.snapshot[key] = '1000';
    const r = audit([f]);
    assert.equal(r.formatStatus, 'INVALID');
    assert.equal(r.streams.length, 0);
    assert.equal(r.replay.framesSubmitted, 1);
  }
});

test('review: missing phase samples remain counted and do not become active observations', () => {
  const f = frame(); delete f.snapshot.phase;
  const r = audit([f, frame(2, 1500)]);
  assert.equal(r.streams[0].sampleCount, 2);
  assert.equal(r.streams[0].inactiveOrUnknownPhaseFrames, 2);
  assert.equal(r.streams[0].missingMemberInventoryFrames, 2);
  assert.equal(r.replay.framesSubmitted, 2);
  assert.equal(r.replay.accepted, 0);
});

test('review: mixed provenance has no real-game success classification', () => {
  const f = frame(1, 0, 'claimed-live'); f.provenance = 'GAME_OBSERVED';
  const r = audit([frame(), f]);
  assert.equal(r.classification, 'MIXED_OR_INVALID_PROVENANCE');
  assert.equal(r.replay.classification, 'MOCK_ONLY');
  assert.equal(r.nativeIdentityValidation, 'NOT_PERFORMED');
});

test('review: invalid nominal cadence is rejected before producing timing statistics', () => {
  for (const nominalIntervalMs of [0, -1, 0.5, NaN, Infinity, 60001, '500'])
    assert.throws(() => audit([frame()], { nominalIntervalMs }), /INVALID_NOMINAL_INTERVAL/);
});
