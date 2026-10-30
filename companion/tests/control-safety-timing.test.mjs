// Fabricated claims exercise a pure checker. GAME_OBSERVED here is never a runtime receipt.
import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateControlSafetyTimingEvidence as evaluate, RESTORATION_TARGET_MS,
  CONTROL_SAFETY_TIMING_LIMITS } from '../control-safety-timing.mjs';

const config = 'a'.repeat(64);
function event(atMs, terminal = false) {
  return { provenance: 'GAME_OBSERVED', configHash: config, sessionId: 'mission1', clockId: 'capture1',
    binding: { actorId: 'alpha', controllerId: 'controller1', pawnId: 'pawn1', generation: 1 },
    atMs, evidenceRef: 'fixture-only.md#trace', ...(terminal ? { confirmation: 'CONFIRMED' } : {}) };
}
function fixture(restorationMs = 150, humanYieldMs = 4000) {
  return { version: 1, currentConfigHash: config,
    restorationObservations: [{ measurementId: 'restoration1', detection: event(1000), restoration: event(1000 + restorationMs, true) }],
    humanYieldObservations: [{ measurementId: 'yield1', humanInput: event(500), completeYield: event(500 + humanYieldMs, true) }] };
}
function check(mutate = () => {}, restorationMs = 150, humanYieldMs = 4000) {
  const input = fixture(restorationMs, humanYieldMs); mutate(input); return evaluate(input);
}
const allEvents = input => input.restorationObservations.flatMap(r => [r.detection, r.restoration])
  .concat(input.humanYieldObservations.flatMap(r => [r.humanInput, r.completeYield]));

test('exact existing target checks supplied evidence only and human timing is descriptive', () => {
  const report = evaluate(fixture());
  assert.equal(RESTORATION_TARGET_MS, 150); assert.equal(report.status, 'PASS');
  assert.equal(report.scope, 'SUPPLIED_EVIDENCE_ONLY'); assert.equal(report.nativeRuntimeVerified, false);
  assert.equal(report.restoration.status, 'PASS'); assert.equal(report.restoration.targetMs, 150);
  assert.equal(report.restoration.measurements[0].latencyMs, 150);
  assert.equal(report.restoration.measurements[0].withinTarget, true);
  assert.equal(report.humanYield.targetMs, null); assert.equal(report.humanYield.maxMs, 4000);
  assert.equal(report.humanYield.status, 'RECORDED');
  assert.equal(report.humanYield.measurements[0].withinTarget, null);
  assert.match(report.limitations.join(' '), /not native verification/);
});

for (const [latency, expected] of [[0, 'PASS'], [149, 'PASS'], [150, 'PASS'], [151, 'FAIL']]) {
  test(`restoration boundary ${latency} ms returns ${expected}`, () => {
    const r = evaluate(fixture(latency)); assert.equal(r.status, expected);
    assert.equal(r.restoration.measurements[0].latencyMs, latency);
    assert.equal(r.restoration.maxMs, latency);
    assert.equal(r.restoration.failures.length, expected === 'FAIL' ? 1 : 0);
  });
}

test('large valid complete-human-yield latency has no invented numerical failure threshold', () => {
  const r = evaluate(fixture(150, Number.MAX_SAFE_INTEGER - 500));
  assert.equal(r.status, 'PASS'); assert.equal(r.humanYield.maxMs, Number.MAX_SAFE_INTEGER - 500);
  assert.deepEqual(r.humanYield.failures, []);
});

test('empty valid envelope is not performed; absent measurements are not silently zero', () => {
  const r = evaluate({ version: 1, currentConfigHash: config });
  assert.equal(r.status, 'NOT_PERFORMED'); assert.equal(r.restoration.status, 'NOT_PERFORMED');
  assert.equal(r.humanYield.status, 'NOT_PERFORMED'); assert.equal(r.restoration.minMs, null);
  assert.equal(r.humanYield.maxMs, null);
  const partial = check(e => delete e.humanYieldObservations);
  assert.equal(partial.status, 'INCOMPLETE'); assert.equal(partial.restoration.status, 'PASS');
});

test('mock-only data cannot become an observed timing pass, including failed mock timings', () => {
  for (const latency of [150, 151]) {
    const r = check(e => allEvents(e).forEach(v => { v.provenance = 'MOCK_ONLY'; }), latency);
    assert.equal(r.status, 'MOCK_ONLY'); assert.equal(r.nativeRuntimeVerified, false);
    assert.equal(r.restoration.status, 'MOCK_ONLY');
    assert.equal(r.restoration.failures.length, latency > 150 ? 1 : 0);
  }
});

test('mixed provenance is incomplete both inside a measurement and between measurement collections', () => {
  assert.equal(check(e => { e.restorationObservations[0].restoration.provenance = 'MOCK_ONLY'; }).status, 'INCOMPLETE');
  const mixed = check(e => e.humanYieldObservations.forEach(r => {
    r.humanInput.provenance = r.completeYield.provenance = 'MOCK_ONLY'; }));
  assert.equal(mixed.status, 'INCOMPLETE'); assert.equal(mixed.restoration.status, 'PASS');
  assert.equal(mixed.humanYield.status, 'MOCK_ONLY');
  assert.match(mixed.schemaIssues.join(' '), /mock and game-observed claims cannot be combined/);
});

for (const key of ['actorId', 'controllerId', 'pawnId', 'generation']) {
  test(`a different terminal ${key} cannot be paired with the starting binding`, () => {
    const r = check(e => { const b = e.restorationObservations[0].restoration.binding;
      b[key] = key === 'generation' ? 2 : 'other'; });
    assert.equal(r.status, 'INCOMPLETE'); assert.equal(r.restoration.measuredCount, 0);
    assert.match(r.restoration.issues.join(' '), /bindings do not match/);
  });
}
for (const key of ['sessionId', 'clockId']) {
  test(`different ${key} cannot manufacture an elapsed interval`, () => {
    const r = check(e => { e.restorationObservations[0].restoration[key] = 'different'; });
    assert.equal(r.status, 'INCOMPLETE'); assert.equal(r.restoration.measurements[0].latencyMs, null);
  });
}

for (const invalid of [null, '1000', -1, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, 1000.5]) {
  test(`invalid or unsupported-precision timestamp ${String(invalid)} is incomplete`, () => {
    const r = check(e => { e.restorationObservations[0].detection.atMs = invalid; });
    assert.equal(r.status, 'INCOMPLETE'); assert.equal(r.restoration.measuredCount, 0);
  });
}
test('reversed event times cannot become negative or zero latency', () => {
  const r = check(e => { e.humanYieldObservations[0].completeYield.atMs = 499; });
  assert.equal(r.status, 'INCOMPLETE'); assert.equal(r.humanYield.measurements[0].latencyMs, null);
});

test('missing, unknown and unperformed confirmation never count as restored', () => {
  for (const confirmation of [undefined, null, false, 'UNKNOWN', 'NOT_PERFORMED', 'PASS']) {
    const r = check(e => {
      if (confirmation === undefined) delete e.restorationObservations[0].restoration.confirmation;
      else e.restorationObservations[0].restoration.confirmation = confirmation;
    });
    assert.equal(r.status, 'INCOMPLETE'); assert.equal(r.restoration.measuredCount, 0);
  }
  assert.equal(check(e => delete e.restorationObservations[0].restoration).status, 'INCOMPLETE');
});

test('explicit failed restoration or complete yield is preserved without inventing a completion time', () => {
  for (const [collection, end] of [['restorationObservations', 'restoration'], ['humanYieldObservations', 'completeYield']]) {
    const r = check(e => { e[collection][0][end].confirmation = 'FAILED'; });
    assert.equal(r.status, 'FAIL');
    const section = collection === 'restorationObservations' ? r.restoration : r.humanYield;
    assert.equal(section.measuredCount, 0); assert.equal(section.measurements[0].latencyMs, null);
    assert.equal(section.failures.length, 1);
  }
});

test('incomplete evidence retains another supplied known threshold failure', () => {
  const r = check(e => { e.humanYieldObservations[0].completeYield.atMs = null; }, 151);
  assert.equal(r.status, 'INCOMPLETE'); assert.equal(r.restoration.status, 'FAIL');
  assert.equal(r.restoration.failures.length, 1);
});

test('configuration, provenance, binding and inspectable evidence references are mandatory', () => {
  for (const mutate of [
    e => { e.currentConfigHash = 'bad'; },
    e => { e.restorationObservations[0].restoration.configHash = 'b'.repeat(64); },
    e => { e.restorationObservations[0].restoration.provenance = 'EDITOR_OBSERVED'; },
    e => { e.restorationObservations[0].restoration.binding.generation = 0; },
    e => { e.restorationObservations[0].detection.binding.actorId = '__proto__'; },
    e => { e.restorationObservations[0].detection.evidenceRef = ''; },
    e => { e.restorationObservations[0].restoration.evidenceRef = 'line\nnot-reference'; },
    e => { e.restorationObservations[0].restoration.evidenceRef = 'x'.repeat(513); },
  ]) assert.equal(check(mutate).status, 'INCOMPLETE');
});

test('hash case represents the same configuration; shared source documents are allowed', () => {
  const r = check(e => { allEvents(e).forEach(v => { v.configHash = config.toUpperCase(); v.evidenceRef = 'one-document.md'; }); });
  assert.equal(r.status, 'PASS'); assert.equal(r.currentConfigHash, config);
});

test('duplicate measurement IDs within or between collections cannot count as distinct evidence', () => {
  const same = check(e => e.restorationObservations.push(structuredClone(e.restorationObservations[0])));
  assert.equal(same.status, 'INCOMPLETE');
  const other = check(e => { e.humanYieldObservations[0].measurementId = 'restoration1'; });
  assert.equal(other.status, 'INCOMPLETE');
});

test('caller-supplied latency, thresholds and unknown fields cannot override measurements', () => {
  for (const mutate of [e => { e.targetMs = 9999; },
    e => { e.restorationObservations[0].latencyMs = 0; },
    e => { e.restorationObservations[0].restoration.binding.lease = 'invented'; }])
    assert.equal(check(mutate).status, 'INCOMPLETE');
});

test('malformed collections and out-of-version envelopes are incomplete', () => {
  for (const input of [null, [], {}, { version: 2, currentConfigHash: config },
    { version: 1, currentConfigHash: config, restorationObservations: null },
    { version: 1, currentConfigHash: config, humanYieldObservations: {} }])
    assert.equal(evaluate(input).status, 'INCOMPLETE');
});

test('accessors, toJSON hooks and proxies are rejected without executing caller code', () => {
  let calls = 0;
  const getter = fixture(); Object.defineProperty(getter.restorationObservations[0].restoration, 'atMs', {
    enumerable: true, get() { calls++; throw new Error('EXECUTED'); } });
  assert.equal(evaluate(getter).status, 'INCOMPLETE');
  const hook = fixture(); hook.toJSON = () => { calls++; throw new Error('EXECUTED'); };
  assert.equal(evaluate(hook).status, 'INCOMPLETE');
  const proxy = new Proxy(fixture(), { getPrototypeOf() { calls++; throw new Error('EXECUTED'); },
    ownKeys() { calls++; throw new Error('EXECUTED'); } });
  assert.equal(evaluate(proxy).status, 'INCOMPLETE');
  const revoked = Proxy.revocable({}, {}); revoked.revoke();
  assert.equal(evaluate(revoked.proxy).status, 'INCOMPLETE'); assert.equal(calls, 0);
});

test('cyclic, nonplain, sparse, extended, oversized and executable data are bounded failures', () => {
  const cycle = fixture(); cycle.cycle = cycle;
  const nonplain = fixture(); nonplain.restorationObservations[0].detection.binding = new Date();
  const sparse = fixture(); sparse.restorationObservations = Array(1);
  const extended = fixture(); extended.restorationObservations.extra = true;
  const symbol = fixture(); symbol[Symbol('bad')] = true;
  const oversize = fixture(); oversize.restorationObservations = Array.from(
    { length: CONTROL_SAFETY_TIMING_LIMITS.measurementsPerKind + 1 }, () => null);
  const executable = fixture(); executable.restorationObservations[0].restoration.atMs = () => 0;
  for (const input of [cycle, nonplain, sparse, extended, symbol, oversize, executable])
    assert.equal(evaluate(input).status, 'INCOMPLETE');
});

test('a sparse array plus a named extra property cannot cancel out the missing index', () => {
  const input = fixture(); const disguised = Array(2);
  disguised[1] = input.restorationObservations[0]; disguised.extra = null;
  input.restorationObservations = disguised;
  assert.equal(disguised.length, 2); assert.equal(Object.keys(disguised).length, 2);
  const r = evaluate(input); assert.equal(r.status, 'INCOMPLETE');
  assert.equal(r.restoration.measuredCount, 0);
});

test('nonstandard array prototypes and noncanonical indices are not plain JSON arrays', () => {
  for (const mutate of [array => Object.setPrototypeOf(array, {}), array => Object.setPrototypeOf(array, null),
    array => { array['01'] = null; }, array => { array['-1'] = null; }]) {
    const input = fixture(); mutate(input.restorationObservations);
    assert.equal(evaluate(input).status, 'INCOMPLETE');
  }
});

test('explicit failures remain visible in mock-only and incomplete supplied evidence', () => {
  const mock = check(e => { allEvents(e).forEach(v => { v.provenance = 'MOCK_ONLY'; });
    e.humanYieldObservations[0].completeYield.confirmation = 'FAILED'; });
  assert.equal(mock.status, 'MOCK_ONLY'); assert.equal(mock.humanYield.failures.length, 1);
  assert.equal(mock.nativeRuntimeVerified, false);
  const incomplete = check(e => { e.restorationObservations[0].restoration.confirmation = 'FAILED';
    e.restorationObservations[0].restoration.evidenceRef = ''; });
  assert.equal(incomplete.status, 'INCOMPLETE'); assert.equal(incomplete.restoration.failures.length, 1);
});

test('a known supplied failure survives a missing or malformed starting event', () => {
  for (const [collection, start, end, section] of [
    ['restorationObservations', 'detection', 'restoration', 'restoration'],
    ['humanYieldObservations', 'humanInput', 'completeYield', 'humanYield']]) {
    for (const missing of [true, false]) {
      const r = check(e => { e[collection][0][end].confirmation = 'FAILED';
        if (missing) delete e[collection][0][start]; else e[collection][0][start] = null; });
      assert.equal(r.status, 'INCOMPLETE'); assert.equal(r[section].failures.length, 1);
      assert.equal(r[section].measuredCount, 0);
    }
  }
});

test('frozen inputs are unchanged and report mutation cannot affect a later evaluation', () => {
  const input = fixture(); const before = structuredClone(input);
  function freeze(value) { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } }
  freeze(input); const report = evaluate(input);
  assert.deepEqual(input, before); report.restoration.measurements[0].binding.pawnId = 'changed';
  report.limitations.length = 0;
  assert.equal(evaluate(input).restoration.measurements[0].binding.pawnId, 'pawn1');
  assert.equal(evaluate(input).limitations.length, 3);
});
