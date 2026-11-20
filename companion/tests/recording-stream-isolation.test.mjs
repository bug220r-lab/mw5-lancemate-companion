// Supplied synthetic records only. No recorder, game, or live adapter is exercised.
import test from 'node:test';
import assert from 'node:assert/strict';
import { auditPassiveCaptureBytes } from '../passive-capture.mjs';
import { auditRecordingBytes } from '../recording-audit.mjs';
import { baseline } from '../../synthetic/tactical-cases.mjs';

const bodies = ['alpha', 'bravo', 'charlie'];
const asBytes = samples => Buffer.from(JSON.stringify(samples));
const auditOptions = { allowSynthetic: true };

function frame(sequence, observedAtMs, { session = 'mission-a', origin = 'origin-a',
  provenance = 'MOCK_ONLY', three = false } = {}) {
  const snapshot = { ...baseline(), session, sequence, observedAtMs, nowMs: observedAtMs, targets: [] };
  if (three) snapshot.lancemates = bodies.map((id, index) => ({
    ...structuredClone(snapshot.lancemates[0]), id, pawnId: `pawn-${index}`, controllerId: `controller-${index}`,
  }));
  return { schemaVersion: 1, kind: 'observation', session, sequence, observedAtMs,
    provenance, adapterId: origin, snapshot };
}

function sample(sequence, observedAtMs, { session = 'mission-a', origin = 'origin-a',
  provenance = 'MOCK_ONLY', three = false } = {}) {
  const readings = three ? bodies.map(bindingId => ({ key: 'membership', subjectRole: 'aiController',
    bindingId, status: 'VALUE', value: true })) : [];
  if (three) readings.push({ key: 'worker', subjectRole: 'aiController', bindingId: 'alpha', status: 'READ_FAILED' });
  return { schemaVersion: 1, kind: 'passive-capture', session, sequence, observedAtMs,
    provenance, producerId: origin, readings };
}

for (const [label, changedIdentity] of [
  ['origin', { origin: 'origin-b' }], ['provenance', { provenance: 'GAME_OBSERVED' }],
]) {
  const foreign = { ...changedIdentity, three: true };
  const classification = label === 'origin' ? 'MOCK_ONLY' : 'MIXED_OR_INVALID_PROVENANCE';

  test(`recording: foreign ${label} cannot fill sequence gaps or add coverage to the original stream`, () => {
    const report = auditRecordingBytes(asBytes([
      frame(1, 1000), frame(2, 1200, foreign), frame(3, 1500, foreign), frame(4, 2000),
    ]), auditOptions);
    assert.equal(report.formatStatus, 'INVALID');
    assert.equal(report.classification, classification);
    assert.equal(report.frameCount, 4);
    assert.equal(report.replay.framesSubmitted, 4);
    assert.equal(report.replay.rejected, 2);
    assert.deepEqual(report.findings, [1, 2].map(index => ({ index, code: 'SESSION_STREAM_CHANGED' })));
    assert.equal(report.streams.length, 1);
    const stream = report.streams[0];
    assert.equal(stream.adapterId, 'origin-a');
    assert.equal(stream.provenance, 'MOCK_ONLY');
    assert.equal(stream.sampleCount, 2);
    assert.equal(stream.unaccountedSequenceNumbers, '2');
    assert.equal(stream.framesWithThreeDistinctMemberIds, 0);
  });

  test(`raw capture: foreign ${label} cannot fill gaps or add readings to the original stream`, () => {
    const report = auditPassiveCaptureBytes(asBytes([
      sample(1, 1000), sample(2, 1200, foreign), sample(3, 1500, foreign), sample(4, 2000),
    ]), auditOptions);
    assert.equal(report.formatStatus, 'INVALID');
    assert.equal(report.classification, classification);
    assert.equal(report.sampleCount, 4);
    assert.deepEqual(report.findings, [1, 2].map(index => ({ index, code: 'SESSION_STREAM_CHANGED' })));
    assert.equal(report.streams.length, 1);
    const stream = report.streams[0];
    assert.equal(stream.producerId, 'origin-a');
    assert.equal(stream.provenance, 'MOCK_ONLY');
    assert.equal(stream.sampleCount, 2);
    assert.equal(stream.unaccountedSequenceNumbers, '2');
    assert.equal(stream.reportedIntervalCount, 0);
    assert.equal(stream.samplesWithThreeAssertedAiBindings, 0);
    assert.equal(stream.samplesWithThreeMentionedAiBindings, 0);
    assert.equal(stream.readingsByStatus.VALUE, 0);
    assert.equal(stream.readingsByStatus.READ_FAILED, 0);
    assert.ok(stream.unreportedFieldKeys.includes('membership'));
    assert.deepEqual(report.acquisitionExceptions, []);
  });
}

test('recording: adjacent foreign rows do not measure intervals or sequences of the original stream', () => {
  const foreign = { origin: 'origin-b' };
  const report = auditRecordingBytes(asBytes([
    frame(1, 1000), frame(2, 1200, foreign), frame(7, 5000, foreign), frame(8, 6000),
  ]), auditOptions);
  const stream = report.streams[0];
  assert.equal(stream.measuredIntervalCount, 0);
  assert.equal(stream.sequenceGaps, 0);
  assert.equal(stream.longIntervals, 0);
  assert.equal(stream.p95IntervalMs, null);
  assert.equal(stream.unaccountedSequenceNumbers, '6');
});

for (const [label, make, audit, intervalCount] of [
  ['recording', frame, auditRecordingBytes, 'measuredIntervalCount'],
  ['raw capture', sample, auditPassiveCaptureBytes, 'reportedIntervalCount'],
]) {
  test(`${label}: a foreign claim on a retired mission does not retire the legitimate current mission`, () => {
    const missionB = { session: 'mission-b', origin: 'origin-b' };
    const report = audit(asBytes([
      make(1, 1000), make(1, 100, missionB), make(2, 1200, { origin: 'foreign', three: true }),
      make(2, 600, missionB), make(3, 1100, missionB),
    ]), auditOptions);
    assert.equal(report.formatStatus, 'INVALID');
    assert.deepEqual(report.findings.filter(f => f.code === 'SESSION_STREAM_CHANGED').map(f => f.index), [2]);
    assert.deepEqual(report.findings.filter(f => f.code === 'RETIRED_SESSION_REAPPEARED').map(f => f.index), [2]);
    assert.deepEqual(report.streams.map(stream => [stream.session, stream.sampleCount, stream[intervalCount]]),
      [['mission-a', 1, 0], ['mission-b', 3, 1]]);
    if (label === 'raw capture') {
      assert.equal(report.sessionChanges, 1);
      assert.deepEqual(report.reviewEvents.filter(event => event.code === 'ASSERTED_SESSION_CHANGED').map(event => event.index), [1]);
    } else {
      assert.equal(report.replay.framesSubmitted, 5);
      assert.equal(report.replay.rejected, 1);
    }
  });
}
