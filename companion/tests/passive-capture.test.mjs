// MOCK_ONLY. These cases test a project file format, not an MW5 recorder.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rmdir, unlink, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditPassiveCaptureBytes, inspectPassiveCaptureFile,
  PASSIVE_CAPTURE_LIMITS } from '../passive-capture.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const fixture = path.join(root, 'synthetic/passive-capture-example.json');
const mapFile = path.join(root, 'design/PASSIVE_CAPTURE_FIELD_MAP.json');
const bytes = samples => Buffer.from(JSON.stringify(samples));
const sample = (sequence = 1, observedAtMs = 1000, changes = {}) => ({
  schemaVersion: 1, kind: 'passive-capture', provenance: 'MOCK_ONLY',
  producerId: 'synthetic-observer', session: 'mission-a', sequence, observedAtMs,
  readings: [], ...changes,
});
const reading = (changes = {}) => ({ key: 'membership', subjectRole: 'aiController',
  bindingId: 'ai-a', status: 'VALUE', value: true, ...changes });
const audit = (samples, options = {}) => auditPassiveCaptureBytes(bytes(samples),
  { allowSynthetic: true, ...options });
const codes = report => report.findings.map(f => f.code);
const reviewCodes = report => report.reviewEvents.map(event => event.code);

test('synthetic example preserves bytes and reports asserted coverage without replay', async () => {
  const input = await readFile(fixture);
  const original = Buffer.from(input);
  const report = auditPassiveCaptureBytes(input, { allowSynthetic: true });
  assert.equal(report.formatStatus, 'VALID_PROJECT_CAPTURE');
  assert.equal(report.classification, 'MOCK_ONLY');
  assert.equal(report.sourceSha256, createHash('sha256').update(original).digest('hex'));
  assert.equal(report.fieldMapSha256,
    createHash('sha256').update(await readFile(mapFile)).digest('hex'));
  assert.equal(report.fieldMapKeyCount, 19);
  assert.equal(report.streams.length, 2);
  assert.equal(report.sessionChanges, 1);
  assert.equal(report.streams[0].samplesWithThreeAssertedAiBindings, 2);
  assert.equal(report.streams[0].assertedPlayerPawnBindingChanges, 1);
  assert.equal(report.streams[1].samplesWithThreeAssertedAiBindings, 1);
  assert.equal(report.streams[1].samplesWithTruncatedAiInventory, 1);
  assert.equal(report.streams[1].maxReportedTruncatedAiInventoryCount, 4);
  assert.equal(report.streams[1].readingsByStatus.READ_FAILED, 1);
  assert.equal(report.streams[1].readingsByStatus.NOT_ATTEMPTED, 1);
  assert.deepEqual(report.acquisitionExceptions, [
    { index: 2, session: 'synthetic-mission-b', sequence: 1, readingIndex: 0,
      key: 'currentAiControllers', subjectRole: 'squad', bindingId: 'squad-b',
      status: 'TRUNCATED' },
    { index: 2, session: 'synthetic-mission-b', sequence: 1, readingIndex: 4,
      key: 'currentJob', subjectRole: 'worker', bindingId: 'worker-d',
      status: 'READ_FAILED' },
    { index: 2, session: 'synthetic-mission-b', sequence: 1, readingIndex: 5,
      key: 'paused', subjectRole: 'world', bindingId: null,
      status: 'NOT_ATTEMPTED' },
  ]);
  assert.equal(report.acquisitionExceptionCount, 3);
  assert.equal(report.acquisitionExceptionsOmitted, 0);
  assert.equal(report.runtimeAcceptance, 'NOT_PERFORMED');
  assert.equal(report.nativeIdentityValidation, 'NOT_PERFORMED');
  assert.equal(report.clockCalibration, 'NOT_PERFORMED');
  assert.equal(report.commandsIssued, 0);
  assert.equal(report.replay, null);
  assert.equal(report.sourceModified, false);
  assert.deepEqual(input, original);
});

test('mock input needs opt-in; claimed game input stays unvalidated', () => {
  const disabled = auditPassiveCaptureBytes(bytes([sample()]));
  assert.equal(disabled.formatStatus, 'INVALID');
  assert.ok(codes(disabled).includes('SYNTHETIC_DISABLED'));
  const claimedGame = auditPassiveCaptureBytes(bytes([sample(1, 1000,
    { provenance: 'GAME_OBSERVED' })]));
  assert.equal(claimedGame.formatStatus, 'VALID_PROJECT_CAPTURE');
  assert.equal(claimedGame.classification, 'GAME_OBSERVED_UNVALIDATED');
  assert.equal(claimedGame.runtimeAcceptance, 'NOT_PERFORMED');
  assert.equal(claimedGame.replay, null);
  const mixed = audit([sample(), sample(1, 0,
    { session: 'mission-b', provenance: 'GAME_OBSERVED' })]);
  assert.equal(mixed.classification, 'MIXED_OR_INVALID_PROVENANCE');
});

test('duplicate JSON member names cannot change provenance, status or nested raw values', () => {
  const game = JSON.stringify([sample(1, 1000, {
    provenance: 'GAME_OBSERVED', readings: [reading()],
  })]);
  const vector = JSON.stringify([sample(1, 1000, {
    provenance: 'GAME_OBSERVED', readings: [reading({
      key: 'positionNative', subjectRole: 'aiPawn', bindingId: 'pawn-a',
      value: { x: 1, y: 2, z: 3 },
    })],
  })]);
  const cases = [
    game.replace('"provenance":"GAME_OBSERVED"',
      '"provenance":"MOCK_ONLY","provenance":"GAME_OBSERVED"'),
    game.replace('"provenance":"GAME_OBSERVED"',
      '"provenance":"MOCK_ONLY","\\u0070rovenance":"GAME_OBSERVED"'),
    game.replace('"status":"VALUE"', '"status":"READ_FAILED","status":"VALUE"'),
    game.replace('"status":"VALUE"', '"status":"READ_FAILED","\\u0073tatus":"VALUE"'),
    vector.replace('"x":1', '"x":1,"\\u0078":2'),
  ];
  for (const raw of cases) {
    assert.doesNotThrow(() => JSON.parse(raw));
    const input = Buffer.from(raw);
    const original = Buffer.from(input);
    const report = auditPassiveCaptureBytes(input);
    assert.equal(report.formatStatus, 'INVALID');
    assert.ok(codes(report).includes('DUPLICATE_JSON_MEMBER'));
    assert.equal(report.sourceSha256, createHash('sha256').update(original).digest('hex'));
    assert.deepEqual(input, original);
  }
});

test('CLI rejects duplicate-provenance JSON without rewriting input', async () => {
  const raw = JSON.stringify([sample(1, 1000, { provenance: 'GAME_OBSERVED' })])
    .replace('"provenance":"GAME_OBSERVED"',
      '"provenance":"MOCK_ONLY","provenance":"GAME_OBSERVED"');
  const original = Buffer.from(raw);
  const directory = await mkdtemp(path.join(root, 'artifacts', 'passive-capture-duplicate-'));
  const file = path.join(directory, 'capture.json');
  try {
    await writeFile(file, original);
    const result = spawnSync(process.execPath,
      [path.join(root, 'scripts/Inspect-PassiveCapture.mjs'), file],
      { cwd: root, encoding: 'utf8', windowsHide: true });
    assert.equal(result.status, 1, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.formatStatus, 'INVALID');
    assert.ok(codes(report).includes('DUPLICATE_JSON_MEMBER'));
    assert.equal(report.sourceSha256, createHash('sha256').update(original).digest('hex'));
    assert.deepEqual(await readFile(file), original);
  } finally {
    await unlink(file).catch(error => { if (error.code !== 'ENOENT') throw error; });
    await rmdir(directory);
  }
});

test('valid captures can exceed the per-sample structure limit in aggregate', () => {
  const samples = Array.from({ length: 4000 }, (_, index) =>
    sample(index + 1, index));
  const report = audit(samples);
  assert.equal(report.formatStatus, 'VALID_PROJECT_CAPTURE');
  assert.equal(report.sampleCount, samples.length);
  assert.deepEqual(report.findings, []);
});

test('value, obtained null and unavailable statuses stay distinct', () => {
  const statuses = [reading(), reading({ key: 'currentJob', subjectRole: 'worker',
    bindingId: 'worker-a', status: 'NULL_RELATION', value: null }),
  ...['INVALID_OBJECT', 'UNSUPPORTED_READ', 'READ_FAILED', 'NOT_ATTEMPTED', 'TRUNCATED']
    .map((status, i) => ({ key: ['controlledPawn', 'pawnController', 'positionNative',
      'workerActor', 'currentAiControllers'][i],
      subjectRole: ['aiController', 'aiPawn', 'aiPawn', 'worker', 'squad'][i],
      bindingId: ['ai-b', 'pawn-a', 'pawn-a', 'worker-b', 'squad-a'][i], status,
      ...(status === 'TRUNCATED' ? { observedCount: 4 } : {}) }))];
  const report = audit([sample(1, 1000, { readings: statuses })]);
  assert.equal(report.formatStatus, 'VALID_PROJECT_CAPTURE');
  const counts = report.streams[0].readingsByStatus;
  for (const status of ['VALUE', 'NULL_RELATION', 'INVALID_OBJECT', 'UNSUPPORTED_READ',
    'READ_FAILED', 'NOT_ATTEMPTED', 'TRUNCATED']) assert.equal(counts[status], 1);
  assert.deepEqual(report.acquisitionExceptions.map(item => item.status),
    ['INVALID_OBJECT', 'UNSUPPORTED_READ', 'READ_FAILED', 'NOT_ATTEMPTED', 'TRUNCATED']);
  assert.deepEqual(report.acquisitionExceptions.map(item => item.readingIndex), [2, 3, 4, 5, 6]);
  assert.ok(report.acquisitionExceptions.every(item => !Object.hasOwn(item, 'value')));
  assert.equal(report.streams[0].unreportedFieldKeys.length, 12);
  const emptyRoster = audit([sample(1, 1000, { readings: [reading({
    key: 'currentAiControllers', subjectRole: 'squad', bindingId: 'squad-a', value: []
  })] })]);
  assert.equal(emptyRoster.formatStatus, 'VALID_PROJECT_CAPTURE');
  assert.equal(emptyRoster.streams[0].readingsByStatus.READ_FAILED, 0);
  assert.equal(emptyRoster.streams[0].samplesWithThreeAssertedAiBindings, 0);
  const omitted = audit([sample()]);
  assert.equal(omitted.streams[0].unreportedFieldKeys.length, 19);
  assert.equal(omitted.streams[0].readingsByStatus.NOT_ATTEMPTED, 0);
  assert.equal(omitted.acquisitionExceptionCount, 0);
});

test('only valid samples contribute explicit acquisition-exception locations', () => {
  const failed = (bindingId = 'ai-a') => {
    const item = reading({ bindingId, status: 'READ_FAILED' });
    delete item.value;
    return item;
  };
  const report = audit([
    sample(1, 1000, { readings: [failed()] }),
    sample(2, 1500, { readings: [failed(), failed()] }),
    sample(3, 2000, { readings: [failed('shared'),
      { key: 'controlledPawn', subjectRole: 'playerController',
        bindingId: 'shared', status: 'NOT_ATTEMPTED' }] }),
    sample(3, 2500, { readings: [failed()] }),
    sample(4, 3000, { readings: [failed()] }),
  ]);
  assert.equal(report.formatStatus, 'INVALID');
  assert.ok(codes(report).includes('DUPLICATE_READING'));
  assert.ok(codes(report).includes('CROSS_ROLE_BINDING_COLLISION'));
  assert.ok(codes(report).includes('NON_INCREASING_SEQUENCE'));
  assert.deepEqual(report.acquisitionExceptions.map(item => item.index), [0, 4]);
  assert.equal(report.acquisitionExceptionCount, 2);
  assert.equal(report.acquisitionExceptionsOmitted, 0);
});

test('acquisition-exception detail cap retains total and omitted counts', () => {
  const samples = Array.from({ length: PASSIVE_CAPTURE_LIMITS.acquisitionExceptions + 3 }, (_, i) => {
    const item = reading({ status: 'READ_FAILED' });
    delete item.value;
    return sample(i + 1, 1000 + i * 500, { readings: [item] });
  });
  const report = audit(samples);
  assert.equal(report.formatStatus, 'VALID_PROJECT_CAPTURE');
  assert.equal(report.acquisitionExceptionCount, samples.length);
  assert.equal(report.acquisitionExceptions.length, PASSIVE_CAPTURE_LIMITS.acquisitionExceptions);
  assert.equal(report.acquisitionExceptionsOmitted, 3);
  assert.deepEqual(report.acquisitionExceptions.map(item => item.index),
    Array.from({ length: PASSIVE_CAPTURE_LIMITS.acquisitionExceptions }, (_, i) => i));
});

test('failed AI reads mention bindings without counting successful asserted coverage', () => {
  const failed = ['ai-a', 'ai-b', 'ai-c'].map(bindingId => {
    const item = reading({ bindingId, status: 'READ_FAILED' });
    delete item.value;
    return item;
  });
  const result = audit([sample(1, 1000, { readings: failed })]);
  assert.equal(result.formatStatus, 'VALID_PROJECT_CAPTURE');
  assert.equal(result.streams[0].samplesWithThreeMentionedAiBindings, 1);
  assert.equal(result.streams[0].samplesWithThreeAssertedAiBindings, 0);
  const acquired = failed.map((item, index) =>
    index === 0 ? reading({ bindingId: item.bindingId }) : item);
  const partial = audit([sample(1, 1000, { readings: acquired })]);
  assert.equal(partial.streams[0].samplesWithThreeMentionedAiBindings, 1);
  assert.equal(partial.streams[0].samplesWithThreeAssertedAiBindings, 0);
});

test('status-value mismatches and unknown field keys fail the proposed format', () => {
  const invalid = [
    reading({ value: null }),
    reading({ status: 'NULL_RELATION', value: true }),
    reading({ status: 'READ_FAILED', value: null }),
    reading({ key: 'inventedNativeRead' }),
  ];
  for (const item of invalid) {
    const result = audit([sample(1, 1000, { readings: [item] })]);
    assert.equal(result.formatStatus, 'INVALID');
    assert.ok(codes(result).includes(item.key === 'inventedNativeRead' ?
      'INVALID_READING' : 'STATUS_VALUE_MISMATCH'));
  }
  const noValue = reading(); delete noValue.value;
  assert.ok(codes(audit([sample(1, 1000, { readings: [noValue] })]))
    .includes('STATUS_VALUE_MISMATCH'));
});

test('duplicate readings and contradictory player/AI binding claims are reported', () => {
  const duplicate = audit([sample(1, 1000, { readings: [reading(), reading()] })]);
  assert.ok(codes(duplicate).includes('DUPLICATE_READING'));
  const distinctKeySameBinding = audit([sample(1, 1000, { readings: [reading(),
    reading({ key: 'controlledPawn', value: 'pawn-a' })] })]);
  assert.equal(distinctKeySameBinding.formatStatus, 'VALID_PROJECT_CAPTURE');
  const collision = audit([sample(1, 1000, { readings: [reading(),
    reading({ key: 'controlledPawn', subjectRole: 'playerController', value: 'pawn-a' })] })]);
  assert.ok(codes(collision).includes('CROSS_ROLE_BINDING_COLLISION'));
  const workerCollision = audit([sample(1, 1000, { readings: [reading(),
    reading({ key: 'currentJob', subjectRole: 'worker', status: 'VALUE', value: 'job-a' })] })]);
  assert.ok(codes(workerCollision).includes('CROSS_ROLE_BINDING_COLLISION'));
  const transitionalPawn = audit([sample(1, 1000, { readings: [
    reading({ key: 'positionNative', subjectRole: 'playerPawn', bindingId: 'pawn-a',
      value: { x: 1, y: 2, z: 3 } }),
    reading({ key: 'humanPossession', subjectRole: 'aiPawn', bindingId: 'pawn-a', value: false }),
  ] })]);
  assert.equal(transitionalPawn.formatStatus, 'VALID_PROJECT_CAPTURE');
  assert.equal(transitionalPawn.streams[0].samplesWithAmbiguousPawnRoleOverlap, 1);
});

test('source-backed role and status restrictions reject impossible positive reads', () => {
  const cases = [
    [reading({ key: 'currentJob', subjectRole: 'world', bindingId: null, value: 'job-a' }),
      'INVALID_READING'],
    [reading({ key: 'paused', subjectRole: 'world', bindingId: null,
      status: 'NULL_RELATION', value: null }), 'READING_SEMANTIC_MISMATCH'],
    [reading({ bindingId: null }), 'READING_SEMANTIC_MISMATCH'],
    [reading({ value: 'true' }), 'READING_SEMANTIC_MISMATCH'],
    [reading({ key: 'currentAiControllers', subjectRole: 'squad',
      bindingId: 'squad-a', value: 'ai-a' }), 'READING_SEMANTIC_MISMATCH'],
    [reading({ key: 'currentAiControllers', subjectRole: 'squad',
      bindingId: 'squad-a', value: ['ai-a', 'ai-b', 'ai-c', 'ai-d'] }),
      'READING_SEMANTIC_MISMATCH'],
  ];
  for (const [item, expected] of cases) {
    assert.ok(codes(audit([sample(1, 1000, { readings: [item] })])).includes(expected));
  }
  const truncatedScalar = reading({ key: 'paused', subjectRole: 'world', bindingId: null,
    status: 'TRUNCATED', observedCount: 4 });
  delete truncatedScalar.value;
  assert.ok(codes(audit([sample(1, 1000, { readings: [truncatedScalar] })]))
    .includes('READING_SEMANTIC_MISMATCH'));
  for (const observedCount of [undefined, 3, -1]) {
    const truncatedRoster = reading({ key: 'currentAiControllers', subjectRole: 'squad',
      bindingId: 'squad-a', status: 'TRUNCATED' });
    delete truncatedRoster.value;
    if (observedCount !== undefined) truncatedRoster.observedCount = observedCount;
    assert.ok(codes(audit([sample(1, 1000, { readings: [truncatedRoster] })]))
      .includes('READING_SEMANTIC_MISMATCH'));
  }
  assert.ok(codes(audit([sample(1, 1000, { readings: [reading({ observedCount: 4 })] })]))
    .includes('READING_SEMANTIC_MISMATCH'));
});

test('sequence gaps and reported intervals are measurements, not invented samples', () => {
  const report = audit([sample(1, 1000), sample(4, 3000), sample(5, 3000)]);
  const stream = report.streams[0];
  assert.equal(report.formatStatus, 'VALID_PROJECT_CAPTURE');
  assert.equal(stream.sampleCount, 3);
  assert.equal(stream.sequenceGaps, 1);
  assert.equal(stream.unaccountedSequenceNumbers, '2');
  assert.equal(stream.reportedIntervalCount, 2);
  assert.equal(stream.minReportedIntervalMs, 0);
  assert.equal(stream.p95ReportedIntervalMs, 2000);
  assert.equal(stream.longReportedIntervals, 1);
  assert.equal(stream.reportedClockRegressions, 0);
  assert.deepEqual(report.reviewEvents, [{ index: 1, session: 'mission-a',
    sequence: 4, code: 'SEQUENCE_GAP' }]);
});

test('review index locates asserted state changes and truncation without interpreting them', () => {
  const readings = (paused, areaLoading, pawn) => [
    { key: 'paused', subjectRole: 'world', bindingId: null, status: 'VALUE', value: paused },
    { key: 'areaLoading', subjectRole: 'area', bindingId: 'area-a',
      status: 'VALUE', value: areaLoading },
    { key: 'positionNative', subjectRole: 'playerPawn', bindingId: pawn,
      status: 'VALUE', value: { x: 1, y: 2, z: 3 } },
  ];
  const truncated = { key: 'currentAiControllers', subjectRole: 'squad',
    bindingId: 'squad-a', status: 'TRUNCATED', observedCount: 4 };
  const report = audit([
    sample(1, 1000, { readings: readings(false, true, 'pawn-a') }),
    sample(3, 2000, { readings: [...readings(true, false, 'pawn-b'), truncated] }),
    sample(1, 0, { session: 'mission-b', readings: [] }),
  ]);
  assert.equal(report.formatStatus, 'VALID_PROJECT_CAPTURE');
  assert.deepEqual(reviewCodes(report), [
    'ASSERTED_AI_INVENTORY_TRUNCATED', 'SEQUENCE_GAP', 'ASSERTED_PAUSE_CHANGED',
    'ASSERTED_AREA_LOADING_CHANGED', 'ASSERTED_PLAYER_PAWN_ROLE_BINDING_CHANGED',
    'ASSERTED_SESSION_CHANGED',
  ]);
  assert.deepEqual(report.reviewEvents.map(event => [event.index, event.session, event.sequence]),
    [[1, 'mission-a', 3], [1, 'mission-a', 3], [1, 'mission-a', 3],
      [1, 'mission-a', 3], [1, 'mission-a', 3], [2, 'mission-b', 1]]);
  assert.equal(report.reviewEventCount, 6);
  assert.equal(report.reviewEventsOmitted, 0);
  assert.equal(report.commandsIssued, 0);
  assert.equal(report.replay, null);
});

test('unavailable or omitted reads, changed area binding and invalid samples break state comparisons', () => {
  const paused = value => ({ key: 'paused', subjectRole: 'world', bindingId: null,
    status: 'VALUE', value });
  const area = (bindingId, value) => ({ key: 'areaLoading', subjectRole: 'area',
    bindingId, status: 'VALUE', value });
  const pawn = bindingId => ({ key: 'humanPossession', subjectRole: 'playerPawn',
    bindingId, status: 'VALUE', value: true });
  const unavailable = { key: 'paused', subjectRole: 'world', bindingId: null,
    status: 'READ_FAILED' };
  const report = audit([
    sample(1, 1000, { readings: [paused(false), area('area-a', false), pawn('pawn-a')] }),
    sample(2, 1500, { readings: [unavailable, area('area-b', true)] }),
    sample(3, 2000, { readings: [paused(true), area('area-b', true), pawn('pawn-b')] }),
    null,
    sample(4, 2500, { readings: [paused(false), area('area-b', false), pawn('pawn-c')] }),
  ]);
  assert.equal(report.formatStatus, 'INVALID');
  assert.deepEqual(report.reviewEvents, []);
  assert.equal(report.reviewEventCount, 0);
});

test('multiple acquired pause or area-loading values cannot create order-dependent flip events', () => {
  const paused = (bindingId, value) => ({ key: 'paused', subjectRole: 'world',
    bindingId, status: 'VALUE', value });
  const area = (bindingId, value) => ({ key: 'areaLoading', subjectRole: 'area',
    bindingId, status: 'VALUE', value });
  const ambiguous = [paused('world-a', true), paused('world-b', false),
    area('area-a', true), area('area-b', false)];
  for (const middle of [ambiguous, [...ambiguous].reverse()]) {
    const report = audit([
      sample(1, 1000, { readings: [paused('world-a', false), area('area-a', false)] }),
      sample(2, 1500, { readings: middle }),
      sample(3, 2000, { readings: [paused('world-a', true), area('area-a', true)] }),
    ]);
    assert.equal(report.formatStatus, 'VALID_PROJECT_CAPTURE');
    assert.equal(report.streams[0].readingsByStatus.VALUE, 8);
    assert.deepEqual(report.reviewEvents, []);
    assert.equal(report.reviewEventCount, 0);
  }
});

test('a cross-role collision breaks review adjacency without changing aggregate accounting', () => {
  const paused = value => ({ key: 'paused', subjectRole: 'world',
    bindingId: 'shared', status: 'VALUE', value });
  const report = audit([
    sample(1, 1000, { readings: [paused(false)] }),
    sample(2, 1500, { readings: [paused(true), reading({ bindingId: 'shared' })] }),
    sample(3, 2000, { readings: [paused(false)] }),
  ]);
  assert.equal(report.formatStatus, 'INVALID');
  assert.ok(codes(report).includes('CROSS_ROLE_BINDING_COLLISION'));
  assert.deepEqual(report.reviewEvents, []);
  assert.equal(report.streams[0].sampleCount, 3);
  assert.equal(report.streams[0].reportedIntervalCount, 2);
  assert.equal(report.streams[0].readingsByStatus.VALUE, 4);
});

test('an invalid session-transition sample cannot shift its event onto a later sample', () => {
  const paused = value => ({ key: 'paused', subjectRole: 'world',
    bindingId: 'shared', status: 'VALUE', value });
  const report = audit([
    sample(1, 1000, { session: 'mission-a', readings: [paused(false)] }),
    sample(1, 0, { session: 'mission-b',
      readings: [paused(true), reading({ bindingId: 'shared' })] }),
    sample(2, 500, { session: 'mission-b', readings: [paused(false)] }),
  ]);
  assert.equal(report.formatStatus, 'INVALID');
  assert.ok(codes(report).includes('CROSS_ROLE_BINDING_COLLISION'));
  assert.equal(report.sessionChanges, 1);
  assert.deepEqual(report.streams.map(stream => stream.sampleCount), [1, 2]);
  assert.deepEqual(report.reviewEvents, []);
  assert.equal(report.reviewEventCount, 0);
});

test('sequence and clock regressions are indexed but break asserted-state adjacency', () => {
  const paused = value => ({ key: 'paused', subjectRole: 'world',
    bindingId: null, status: 'VALUE', value });
  for (const [middleSequence, middleTime, expectedCode] of [
    [1, 1500, 'NON_INCREASING_SEQUENCE'],
    [2, 900, 'REPORTED_CLOCK_REGRESSION'],
  ]) {
    const report = audit([
      sample(1, 1000, { readings: [paused(false)] }),
      sample(middleSequence, middleTime, { readings: [paused(true)] }),
      sample(3, 2000, { readings: [paused(false)] }),
      sample(4, 2500, { readings: [paused(true)] }),
    ]);
    assert.equal(report.formatStatus, 'INVALID');
    assert.deepEqual(reviewCodes(report), [expectedCode, 'ASSERTED_PAUSE_CHANGED']);
    assert.deepEqual(report.reviewEvents.map(event => event.index), [1, 3]);
    assert.equal(report.streams[0].sampleCount, 4);
    assert.equal(report.streams[0].reportedIntervalCount,
      expectedCode === 'REPORTED_CLOCK_REGRESSION' ? 2 : 3);
  }
});

test('review event details are capped while total and omitted counts remain exact', () => {
  const samples = Array.from({ length: PASSIVE_CAPTURE_LIMITS.reviewEvents + 50 }, (_, i) =>
    sample(i + 1, 1000 + i * 500, { readings: [{ key: 'paused', subjectRole: 'world',
      bindingId: null, status: 'VALUE', value: i % 2 === 0 }] }));
  const report = audit(samples);
  assert.equal(report.formatStatus, 'VALID_PROJECT_CAPTURE');
  assert.equal(report.reviewEventCount, samples.length - 1);
  assert.equal(report.reviewEvents.length, PASSIVE_CAPTURE_LIMITS.reviewEvents);
  assert.equal(report.reviewEventsOmitted,
    report.reviewEventCount - PASSIVE_CAPTURE_LIMITS.reviewEvents);
  assert.ok(reviewCodes(report).every(code => code === 'ASSERTED_PAUSE_CHANGED'));
});

test('reordered samples, clock regressions and retired-session return are explicit', () => {
  const backwards = audit([sample(3, 2000), sample(2, 1500), sample(2, 1500)]);
  assert.equal(backwards.streams[0].nonIncreasingSequences, 2);
  assert.equal(backwards.streams[0].reportedClockRegressions, 1);
  assert.ok(codes(backwards).includes('NON_INCREASING_SEQUENCE'));
  assert.ok(codes(backwards).includes('REPORTED_CLOCK_REGRESSED'));
  assert.deepEqual(reviewCodes(backwards), ['NON_INCREASING_SEQUENCE',
    'REPORTED_CLOCK_REGRESSION', 'NON_INCREASING_SEQUENCE']);
  const fresh = audit([sample(), sample(1, 0, { session: 'mission-b' })]);
  assert.equal(fresh.formatStatus, 'VALID_PROJECT_CAPTURE');
  assert.equal(fresh.sessionChanges, 1);
  assert.ok(fresh.streams.every(stream => stream.reportedIntervalCount === 0));
  const returned = audit([sample(), sample(1, 0, { session: 'mission-b' }), sample(2, 1500)]);
  assert.ok(codes(returned).includes('RETIRED_SESSION_REAPPEARED'));
  assert.equal(returned.sessionChanges, 2);
  assert.equal(returned.streams.length, 2);
});

test('producer or provenance drift in one session breaks reported-clock adjacency', () => {
  for (const changes of [{ producerId: 'different-producer' }, { provenance: 'GAME_OBSERVED' }]) {
    const report = audit([sample(), sample(2, 1500, changes)]);
    assert.ok(codes(report).includes('SESSION_STREAM_CHANGED'));
    assert.equal(report.streams[0].reportedIntervalCount, 0);
  }
});

test('invalid samples break adjacency and do not turn missing reads into failures', () => {
  const report = audit([sample(), null, sample(3, 2000)]);
  assert.equal(report.formatStatus, 'INVALID');
  assert.equal(report.streams[0].reportedIntervalCount, 0);
  assert.equal(report.streams[0].readingsByStatus.READ_FAILED, 0);
});

test('file, sample, reading, structure and session limits bound processing', () => {
  assert.equal(codes(auditPassiveCaptureBytes(Buffer.alloc(PASSIVE_CAPTURE_LIMITS.bytes + 1)))[0],
    'CAPTURE_TOO_LARGE');
  for (const input of [Buffer.from([0xff]), Buffer.from('{'), bytes([]), bytes({}),
    bytes(Array(PASSIVE_CAPTURE_LIMITS.samples + 1).fill(null))])
    assert.equal(auditPassiveCaptureBytes(input).formatStatus, 'INVALID');
  const huge = sample(); huge.padding = 'x'.repeat(PASSIVE_CAPTURE_LIMITS.sampleBytes);
  assert.ok(codes(audit([huge])).includes('SAMPLE_TOO_LARGE'));
  const tooManyReads = sample(1, 1000,
    { readings: Array(PASSIVE_CAPTURE_LIMITS.readingsPerSample + 1).fill(reading()) });
  assert.ok(codes(audit([tooManyReads])).includes('INVALID_SAMPLE_ENVELOPE'));
  let nested = {}, last = nested;
  for (let i = 0; i < PASSIVE_CAPTURE_LIMITS.depth + 1; i++) {
    last.next = {}; last = last.next;
  }
  assert.ok(codes(audit([sample(1, 1000, { extra: nested })])).includes('SAMPLE_STRUCTURE_LIMIT'));
  const manySessions = Array.from({ length: PASSIVE_CAPTURE_LIMITS.sessions + 1 }, (_, i) =>
    sample(1, 0, { session: `mission-${i}` }));
  assert.ok(codes(audit(manySessions)).includes('SESSION_LIMIT'));
});

test('sample byte cap measures original JSON spans including whitespace and escapes', () => {
  const base = JSON.stringify(sample(1, 1000, {
    extra: { note: 'quote " ,[]{} café', nested: [[1, { value: 'a,b' }]] },
  }));
  const padded = padding => Buffer.from(`[${base.slice(0, -1)}${' '.repeat(padding)}}]`);
  const atLimit = padded(PASSIVE_CAPTURE_LIMITS.sampleBytes - Buffer.byteLength(base));
  assert.equal(auditPassiveCaptureBytes(atLimit, { allowSynthetic: true }).formatStatus,
    'VALID_PROJECT_CAPTURE');
  const overLimit = padded(PASSIVE_CAPTURE_LIMITS.sampleBytes - Buffer.byteLength(base) + 1);
  const original = Buffer.from(overLimit);
  const oversized = auditPassiveCaptureBytes(overLimit, { allowSynthetic: true });
  assert.equal(oversized.formatStatus, 'INVALID');
  assert.ok(codes(oversized).includes('SAMPLE_TOO_LARGE'));
  assert.equal(oversized.sourceSha256, createHash('sha256').update(original).digest('hex'));
  assert.deepEqual(overLimit, original);
  const escaped = Buffer.from(`[${JSON.stringify(sample()).slice(0, -1)},` +
    `"padding":"${'\\u0041'.repeat(Math.ceil(PASSIVE_CAPTURE_LIMITS.sampleBytes / 6))}"}]`);
  const parsedEscape = JSON.parse(escaped.toString('utf8'))[0];
  assert.equal(parsedEscape.padding.length,
    Math.ceil(PASSIVE_CAPTURE_LIMITS.sampleBytes / 6));
  assert.ok(Buffer.byteLength(JSON.stringify(parsedEscape)) < PASSIVE_CAPTURE_LIMITS.sampleBytes);
  assert.ok(codes(auditPassiveCaptureBytes(escaped, { allowSynthetic: true }))
    .includes('SAMPLE_TOO_LARGE'));
});

test('finding detail is capped while total count remains visible', () => {
  const report = audit(Array(250).fill(null));
  assert.equal(report.findingCount, 250);
  assert.equal(report.findings.length, PASSIVE_CAPTURE_LIMITS.detailedFindings);
  assert.equal(report.findingsTruncated, true);
});

test('read-only file inspection and CLI keep the source unchanged', async () => {
  const original = await readFile(fixture);
  const report = await inspectPassiveCaptureFile(fixture, { allowSynthetic: true });
  assert.equal(report.formatStatus, 'VALID_PROJECT_CAPTURE');
  assert.deepEqual(await readFile(fixture), original);
  await assert.rejects(inspectPassiveCaptureFile(path.dirname(fixture)),
    /INPUT_NOT_BOUNDED_REGULAR_FILE|EISDIR/);
  const cli = path.join(root, 'scripts/Inspect-PassiveCapture.mjs');
  const valid = spawnSync(process.execPath, [cli, fixture, '--allow-synthetic'],
    { cwd: root, encoding: 'utf8', windowsHide: true });
  assert.equal(valid.status, 0, valid.stderr);
  const parsed = JSON.parse(valid.stdout);
  assert.equal(parsed.classification, 'MOCK_ONLY');
  assert.deepEqual(parsed.acquisitionExceptions, report.acquisitionExceptions);
  const disabled = spawnSync(process.execPath, [cli, fixture],
    { cwd: root, encoding: 'utf8', windowsHide: true });
  assert.equal(disabled.status, 1, disabled.stderr);
  const usage = spawnSync(process.execPath, [cli],
    { cwd: root, encoding: 'utf8', windowsHide: true });
  assert.equal(usage.status, 2);
  const missing = spawnSync(process.execPath, [cli, path.join(root, 'synthetic/no-such-capture.json')],
    { cwd: root, encoding: 'utf8', windowsHide: true });
  assert.equal(missing.status, 2);
  assert.equal(JSON.parse(missing.stderr).status, 'READ_FAILED');
  assert.deepEqual(await readFile(fixture), original);
});
