import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateReleaseEvidence, percentile, RELEASE_MODES, SCENARIO_CELLS, GiB} from '../benchmark.mjs';

// Labeled shapes are fabricated in memory; no evidenceRefs identify real runs.
const configHash = 'a'.repeat(64);
function comparisonShape(candidateFrames) {
  const records = SCENARIO_CELLS.flatMap(({scenarioId}) =>
    [1, 2, 3].flatMap(rep => RELEASE_MODES.map(mode => ({
      scenarioId, rep, mode, sessionId: `${scenarioId}/${rep}/${mode}`,
      configHash, provenance: 'GAME_OBSERVED', evidenceRef: 'synthetic:frame-integrity',
      missionSuccess: true, lanceLosses: 0, damageTaken: 100,
      damageDealt: mode === 'vanilla' ? 100 : 150,
      frameTimesMs: Array(20).fill(16),
      resources: {minAvailableRamBytes: 2 * GiB, minAvailableVramBytes: GiB},
    }))));
  records.find(r => r.sessionId === 'C01/1/tactical').frameTimesMs = candidateFrames;
  return {version: 2, currentConfigHash: configHash, records};
}

function sparseSamples() {
  const samples = Array(20).fill(16);
  delete samples[19]; // Nearest-rank p95 can currently bypass this missing sample.
  return samples;
}

test('percentile rejects a missing index even when its selected rank exists', () => {
  assert.equal(percentile(sparseSamples(), .95), null);
});

test('an incomplete candidate frame capture cannot fill one of the 108 gameplay cells', () => {
  const report = evaluateReleaseEvidence(comparisonShape(sparseSamples()));
  assert.equal(report.gates.gameplay.status, 'INCOMPLETE');
  assert.equal(report.gates.gameplay.accepted, false);
  assert.deepEqual(report.gates.gameplay.metrics.missingPairs, ['C01/1/tactical']);
  assert.equal(report.gates.gameplay.metrics.comparisons.tactical.pairedRuns, 35);
  assert.equal(report.gates.gameplay.metrics.comparisons.direct.pairedRuns, 36);
});

test('a numeric entry inherited from an array prototype does not fill a missing sample', () => {
  const samples = sparseSamples();
  const prototype = Object.create(Array.prototype);
  Object.defineProperty(prototype, '19', {value: 16});
  Object.setPrototypeOf(samples, prototype);
  assert.equal(percentile(samples, .95), null);
  assert.deepEqual(
    evaluateReleaseEvidence(comparisonShape(samples)).gates.gameplay.metrics.missingPairs,
    ['C01/1/tactical']);
});

test('sample admission rejects an indexed accessor without reading it', () => {
  const samples = Array(20).fill(16);
  let reads = 0;
  Object.defineProperty(samples, '0', {get() { reads++; return 16; }});
  const rank = percentile(samples, .95);
  const report = evaluateReleaseEvidence(comparisonShape(samples));
  assert.equal(reads, 0);
  assert.equal(rank, null);
  assert.equal(report.gates.gameplay.status, 'INCOMPLETE');
});

test('dense frame metrics use the declared numeric entries, bypassing array overrides', () => {
  const samples = Array(20).fill(16);
  samples[19] = 200; // One stall, but outside this nearest-rank p95.
  let calls = 0;
  const unexpected = () => { calls++; throw Error('called supplied array method'); };
  Object.defineProperties(samples, {
    every: {value: unexpected},
    filter: {value: unexpected},
    [Symbol.iterator]: {value: unexpected},
  });
  assert.equal(percentile(samples, .95), 16);
  const report = evaluateReleaseEvidence(comparisonShape(samples));
  assert.equal(calls, 0);
  assert.equal(report.gates.gameplay.status, 'PASS');
  const tactical = report.gates.gameplay.metrics.comparisons.tactical;
  assert.equal(tactical.pairedRuns, 36);
  assert.equal(tactical.worstP95FrameTimeRatio, 1);
  assert.equal(tactical.worstAdditionalStallsPer1000Frames, 50);
});
