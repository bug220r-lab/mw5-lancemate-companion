import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {evaluateReleaseEvidence, ENDURANCE_EXERCISE_KINDS, GiB, percentile, storagePreflight} from '../benchmark.mjs';

// Every GAME_OBSERVED-shaped row below is fabricated solely in memory to challenge
// validator branches. This file performs no capture, model, game or network work.
const CONFIG = 'a'.repeat(64);
const WORKLOAD = 'b'.repeat(64);
const KINDS = ['conversation', 'pause_resume', 'mech_swap', 'mission_transition', 'component_failure'];
const COLLECTIONS = ['records', 'calibrationSessions', 'styleHeldOutDecisions', 'voiceRecordings',
  'conversationSamples', 'enduranceSessions', 'offlineWorkloads'];
const common = sessionId => ({sessionId, configHash: CONFIG, provenance: 'GAME_OBSERVED',
  evidenceRef: `in-memory-fabrication://${sessionId}`});
const resources = () => ({minAvailableRamBytes: 2 * GiB, minAvailableVramBytes: GiB});
function endurance(sessionId) {
  return {...common(sessionId), workloadHash: WORKLOAD, durationMs: 3600000,
    controlledAiCount: 3, allThreeActiveThroughout: true, noCrash: true,
    humanOverrideFailures: 0, wrongRecipientCommands: 0, resources: resources(),
    exercises: KINDS.map(kind => ({kind, status: 'PASS',
      evidenceRef: `in-memory-fabrication://${sessionId}/${kind}`,
      description: `Fabricated ${kind} event; a stipulated safeguard yielded control and recovered.`}))};
}
function suppliedShape() {
  const records = [];
  for (let cell = 1; cell <= 12; cell++) for (let rep = 1; rep <= 3; rep++) {
    for (const mode of ['vanilla', 'tactical', 'direct']) records.push({
      ...common(`fabricated-${cell}-${rep}-${mode}`), scenarioId: `C${String(cell).padStart(2, '0')}`,
      rep, mode, missionSuccess: true, lanceLosses: 0, damageTaken: 100,
      damageDealt: mode === 'vanilla' ? 100 : 110,
      frameTimesMs: [mode === 'vanilla' ? 10 : 11], resources: resources(),
    });
  }
  return {version: 2, currentConfigHash: CONFIG, records,
    calibrationSessions: [common('fabricated-calibration')],
    styleHeldOutDecisions: Array.from({length: 40}, (_, i) => ({...common('fabricated-held-out'),
      decisionId: `decision-${i}`, acceptable: true, userReviewed: true})),
    voiceRecordings: Array.from({length: 100}, (_, i) => ({...common('fabricated-voice'),
      recordingId: `recording-${i}`, ambiguous: i === 99, intentCorrect: true,
      recipientCorrect: true, finalTranscriptMs: 1500, dispatchAttempted: false})),
    conversationSamples: [{...common('fabricated-conversation'), sampleId: 'sample-1',
      firstAudioMs: 4000, grounded: true, speakerCorrect: true}],
    enduranceSessions: [endurance('fabricated-endurance')],
    offlineWorkloads: [{...endurance('fabricated-offline'), repeatsSessionId: 'fabricated-endurance',
      networkDisconnected: true, allComponentsLocal: true, workloadCompleted: true, paidApiCalls: 0}],
  };
}
function evaluate(mutate = () => {}) {
  const evidence = suppliedShape();
  mutate(evidence);
  return evaluateReleaseEvidence(evidence);
}
function expectGate(name, status, mutate) {
  const result = evaluate(mutate), selected = result.gates[name];
  assert.equal(selected.status, status, JSON.stringify(selected));
  assert.equal(selected.accepted, status === 'PASS');
  if (status !== 'PASS') assert.equal(result.accepted, false);
  return result;
}
const targets = [['enduranceSessions', 'endurance'], ['offlineWorkloads', 'offline']];

test('independent in-memory complete v2 shape reaches supplied-evidence PASS with review caveats', () => {
  const result = evaluate();
  assert.equal(result.version, 2);
  assert.equal(result.status, 'PASS');
  assert.equal(result.accepted, true);
  assert.equal(result.scope, 'SUPPLIED_RELEASE_EVIDENCE_ONLY');
  assert.deepEqual([...ENDURANCE_EXERCISE_KINDS], KINDS);
  assert.ok(result.criticalReview.some(x => /authenticity|independent human/i.test(x)));
  assert.ok(result.criticalReview.some(x => /ambiguity.*exercise.*workload/i.test(x)));
  assert.ok(result.criticalReview.some(x => /neither installs nor authorizes/i.test(x)));
});

test('stored fixture remains entirely MOCK_ONLY and cannot be accepted', async () => {
  const fixture = JSON.parse(await readFile(new URL('../../synthetic/release-benchmark.json', import.meta.url), 'utf8'));
  assert.equal(fixture.version, 2);
  for (const key of COLLECTIONS) {
    assert.ok(fixture[key].length > 0);
    assert.ok(fixture[key].every(row => row.provenance === 'MOCK_ONLY'), key);
  }
  const result = evaluateReleaseEvidence(fixture);
  assert.equal(result.status, 'MOCK_ONLY');
  assert.equal(result.accepted, false);
  assert.ok(Object.values(result.gates).every(gate => !gate.accepted));
});

test('old version is not silently migrated even when all v2 fields are supplied', () => {
  for (const version of [1, '2', undefined, null]) {
    const result = evaluate(e => { e.version = version; });
    assert.equal(result.status, 'INCOMPLETE');
    assert.equal(result.accepted, false);
    assert.ok(result.schemaIssues.some(issue => issue.includes('version')));
  }
});

test('empty v2 evidence remains NOT_PERFORMED and malformed envelope does not throw', () => {
  const empty = {version: 2, currentConfigHash: CONFIG};
  assert.equal(evaluateReleaseEvidence(empty).status, 'NOT_PERFORMED');
  for (const value of [undefined, null, [], 'evidence', 2]) {
    assert.equal(evaluateReleaseEvidence(value).accepted, false);
  }
});

test('ambiguous dispatch fails even with guessed correct intent, recipient, and dispatch recipient', () => {
  const result = expectGate('voiceCommands', 'FAIL', e => {
    Object.assign(e.voiceRecordings[99], {ambiguous: true, dispatchAttempted: true,
      intentCorrect: true, recipientCorrect: true, dispatchRecipientCorrect: true});
  });
  assert.equal(result.gates.voiceCommands.metrics.correctRate, 1);
  assert.equal(result.gates.voiceCommands.metrics.annotatedAmbiguousCount, 1);
  assert.equal(result.gates.voiceCommands.metrics.ambiguousDispatchCount, 1);
  assert.ok(result.gates.voiceCommands.failures.some(x => /ambiguous.*dispatched/.test(x)));
});

test('every voice record requires a literal boolean ambiguity annotation', () => {
  for (const ambiguous of [undefined, null, 'true', 'false', 0, 1, {}, []]) {
    expectGate('voiceCommands', 'INCOMPLETE', e => { e.voiceRecordings[0].ambiguous = ambiguous; });
  }
});

test('zero ambiguous coverage is incomplete, but one withheld ambiguous case satisfies coverage', () => {
  const missing = expectGate('voiceCommands', 'INCOMPLETE', e => {
    for (const row of e.voiceRecordings) row.ambiguous = false;
  });
  assert.equal(missing.gates.voiceCommands.metrics.annotatedAmbiguousCount, 0);
  assert.equal(missing.gates.voiceCommands.metrics.ambiguousDispatchCount, 0);
  const complete = expectGate('voiceCommands', 'PASS');
  assert.equal(complete.gates.voiceCommands.metrics.annotatedAmbiguousCount, 1);
  assert.equal(complete.gates.voiceCommands.metrics.ambiguousDispatchCount, 0);
});

test('withholding ambiguity does not waive joint intent/recipient accuracy', () => {
  expectGate('voiceCommands', 'FAIL', e => {
    for (const row of e.voiceRecordings.slice(0, 6)) Object.assign(row, {
      ambiguous: true, dispatchAttempted: false, recipientCorrect: false});
  });
});

test('nonambiguous wrong-recipient dispatch still fails and unknown dispatch result is incomplete', () => {
  expectGate('voiceCommands', 'FAIL', e => Object.assign(e.voiceRecordings[0], {
    dispatchAttempted: true, dispatchRecipientCorrect: false}));
  expectGate('voiceCommands', 'INCOMPLETE', e => { e.voiceRecordings[0].dispatchAttempted = true; });
});

test('mixed invalid voice evidence preserves known ambiguous-dispatch failure', () => {
  const result = expectGate('voiceCommands', 'INCOMPLETE', e => {
    Object.assign(e.voiceRecordings[99], {dispatchAttempted: true, dispatchRecipientCorrect: true});
    delete e.voiceRecordings[0].ambiguous;
  });
  assert.ok(result.gates.voiceCommands.failures.some(x => /ambiguous.*dispatched/.test(x)));
});

for (const [collection, gate] of targets) {
  test(`${gate}: missing workload hash or non-SHA256 values cannot qualify`, () => {
    for (const workloadHash of [undefined, null, '', ' ', 'b'.repeat(63), 'z'.repeat(64), 7]) {
      expectGate(gate, 'INCOMPLETE', e => { e[collection][0].workloadHash = workloadHash; });
    }
  });

  test(`${gate}: each of the five required exercise kinds must be present`, () => {
    for (const kind of KINDS) expectGate(gate, 'INCOMPLETE', e => {
      e[collection][0].exercises = e[collection][0].exercises.filter(x => x.kind !== kind);
    });
  });

  test(`${gate}: absent, empty, malformed exercise collections are incomplete`, () => {
    for (const exercises of [undefined, null, {}, 'PASS', [], [null], [[]]]) {
      expectGate(gate, 'INCOMPLETE', e => { e[collection][0].exercises = exercises; });
    }
  });

  test(`${gate}: duplicate and unknown exercise summaries are rejected instead of filling coverage`, () => {
    expectGate(gate, 'INCOMPLETE', e => {
      e[collection][0].exercises.push({...e[collection][0].exercises[0]});
    });
    expectGate(gate, 'INCOMPLETE', e => {
      e[collection][0].exercises.push({kind: 'unapproved_kind', status: 'PASS',
        evidenceRef: 'in-memory-fabrication://extra', description: 'Fabricated extra.'});
    });
    expectGate(gate, 'INCOMPLETE', e => { e[collection][0].exercises[0].kind = 'Conversation'; });
  });

  test(`${gate}: exercise evidence references and event/recovery descriptions are mandatory`, () => {
    for (const field of ['description', 'evidenceRef']) for (const value of [undefined, null, '', ' \n\t ', 5]) {
      expectGate(gate, 'INCOMPLETE', e => { e[collection][0].exercises[0][field] = value; });
    }
  });

  test(`${gate}: every required NOT_PERFORMED summary is incomplete and every explicit FAIL fails`, () => {
    for (const kind of KINDS) {
      expectGate(gate, 'INCOMPLETE', e => {
        e[collection][0].exercises.find(x => x.kind === kind).status = 'NOT_PERFORMED';
      });
      const result = expectGate(gate, 'FAIL', e => {
        e[collection][0].exercises.find(x => x.kind === kind).status = 'FAIL';
      });
      assert.ok(result.gates[gate].failures.some(x => x.includes(kind)));
    }
  });

  test(`${gate}: unknown exercise statuses cannot be treated as PASS`, () => {
    for (const status of [undefined, null, true, 'pass', 'NOT_VERIFIED', 'READY']) {
      expectGate(gate, 'INCOMPLETE', e => { e[collection][0].exercises[0].status = status; });
    }
  });

  test(`${gate}: missing evidence plus an explicit exercise failure retains both findings`, () => {
    const result = expectGate(gate, 'INCOMPLETE', e => {
      e[collection][0].exercises[0].status = 'FAIL';
      e[collection][0].exercises.pop();
    });
    assert.ok(result.gates[gate].issues.length > 0);
    assert.ok(result.gates[gate].failures.some(x => x.includes('conversation')));
  });

  test(`${gate}: full 60-minute three-AI stability and failure summary is required`, () => {
    for (const field of ['durationMs', 'controlledAiCount', 'allThreeActiveThroughout', 'noCrash',
      'humanOverrideFailures', 'wrongRecipientCommands']) {
      expectGate(gate, 'INCOMPLETE', e => { delete e[collection][0][field]; });
    }
    for (const [field, value] of [['durationMs', 3599999], ['controlledAiCount', 2],
      ['allThreeActiveThroughout', false], ['noCrash', false], ['humanOverrideFailures', 1],
      ['wrongRecipientCommands', 1]]) {
      expectGate(gate, 'FAIL', e => { e[collection][0][field] = value; });
    }
  });

  test(`${gate}: minimum resource samples are required with exact 2-GiB/1-GiB floors`, () => {
    expectGate(gate, 'PASS');
    for (const field of ['minAvailableRamBytes', 'minAvailableVramBytes']) {
      expectGate(gate, 'FAIL', e => { e[collection][0].resources[field]--; });
      expectGate(gate, 'INCOMPLETE', e => { delete e[collection][0].resources[field]; });
    }
    expectGate(gate, 'INCOMPLETE', e => { e[collection][0].resources = {
      peakAvailableRamBytes: 99 * GiB, averageAvailableVramBytes: 99 * GiB}; });
  });

  test(`${gate}: invalid durations, counts, and resource numbers fail closed without throwing`, () => {
    for (const value of [-1, Infinity, NaN, '3600000', null]) {
      expectGate(gate, 'INCOMPLETE', e => { e[collection][0].durationMs = value; });
    }
    for (const field of ['humanOverrideFailures', 'wrongRecipientCommands']) for (const value of [-1, .5, Infinity, '0']) {
      expectGate(gate, 'INCOMPLETE', e => { e[collection][0][field] = value; });
    }
    for (const value of [NaN, Infinity, -1, .5, '2147483648', Number.MAX_SAFE_INTEGER + 1]) {
      expectGate(gate, 'INCOMPLETE', e => { e[collection][0].resources.minAvailableRamBytes = value; });
    }
  });
}

test('offline flags alone no longer substitute for a full endurance repeat', () => {
  expectGate('offline', 'INCOMPLETE', e => {
    e.offlineWorkloads = [{...common('fabricated-offline'), networkDisconnected: true,
      allComponentsLocal: true, workloadCompleted: true, paidApiCalls: 0}];
  });
});

test('a short unlinked offline run remains incomplete and retains its explicit duration failure', () => {
  const result = expectGate('offline', 'INCOMPLETE', e => {
    e.offlineWorkloads[0].durationMs = 1000;
    delete e.offlineWorkloads[0].repeatsSessionId;
  });
  assert.ok(result.gates.offline.issues.some(x => x.includes('repeatsSessionId')));
  assert.ok(result.gates.offline.failures.some(x => x.includes('less than 60')));
});

test('offline repeat must identify an existing unique source session', () => {
  for (const repeatsSessionId of [undefined, null, '', ' ', 'absent-session', 1]) {
    expectGate('offline', 'INCOMPLETE', e => { e.offlineWorkloads[0].repeatsSessionId = repeatsSessionId; });
  }
  expectGate('offline', 'INCOMPLETE', e => { e.enduranceSessions = []; });
  expectGate('offline', 'INCOMPLETE', e => {
    e.enduranceSessions.push(structuredClone(e.enduranceSessions[0]));
  });
});

test('offline session cannot reuse its source or any other endurance session identity', () => {
  expectGate('offline', 'INCOMPLETE', e => { e.offlineWorkloads[0].sessionId = e.enduranceSessions[0].sessionId; });
  expectGate('offline', 'INCOMPLETE', e => {
    e.enduranceSessions.push(endurance('another-endurance'));
    e.offlineWorkloads[0].sessionId = 'another-endurance';
  });
  expectGate('offline', 'INCOMPLETE', e => {
    e.offlineWorkloads[0].repeatsSessionId = e.offlineWorkloads[0].sessionId;
  });
});

test('offline records cannot double count the same offline session', () => {
  expectGate('offline', 'INCOMPLETE', e => { e.offlineWorkloads.push(structuredClone(e.offlineWorkloads[0])); });
});

test('offline repeat must match source workload, configuration, and provenance', () => {
  for (const [field, value] of [['workloadHash', 'c'.repeat(64)], ['configHash', 'c'.repeat(64)],
    ['provenance', 'MOCK_ONLY']]) {
    expectGate('offline', 'INCOMPLETE', e => { e.offlineWorkloads[0][field] = value; });
    expectGate('offline', 'INCOMPLETE', e => { e.enduranceSessions[0][field] = value; });
  }
});

test('an incomplete or unperformed source cannot qualify an otherwise complete offline repeat', () => {
  for (const mutate of [source => { delete source.workloadHash; }, source => { delete source.evidenceRef; },
    source => { source.exercises[0].status = 'NOT_PERFORMED'; }, source => { source.exercises.pop(); },
    source => { source.durationMs = null; }, source => { delete source.resources; }]) {
    expectGate('offline', 'INCOMPLETE', e => mutate(e.enduranceSessions[0]));
  }
});

test('a failed source cannot qualify an otherwise passing offline repeat', () => {
  for (const mutate of [source => { source.durationMs--; }, source => { source.noCrash = false; },
    source => { source.exercises[0].status = 'FAIL'; }, source => { source.resources.minAvailableRamBytes--; }]) {
    const result = expectGate('offline', 'FAIL', e => mutate(e.enduranceSessions[0]));
    assert.ok(result.gates.offline.failures.some(x => /referenced endurance/.test(x)));
  }
});

test('source qualification is individual while unrelated bad endurance still prevents whole acceptance', () => {
  const result = expectGate('offline', 'PASS', e => {
    const other = endurance('unrelated-endurance');
    other.noCrash = false;
    e.enduranceSessions.push(other);
  });
  assert.equal(result.gates.endurance.status, 'FAIL');
  assert.equal(result.accepted, false);
  assert.equal(result.status, 'FAIL');
});

test('distinct repeats may share one source and one evidence document without invented uniqueness rules', () => {
  const result = evaluate(e => {
    e.offlineWorkloads.push({...structuredClone(e.offlineWorkloads[0]), sessionId: 'second-offline'});
    for (const rows of [e.enduranceSessions, e.offlineWorkloads]) for (const row of rows) {
      row.evidenceRef = 'in-memory-fabrication://shared-document';
      for (const exercise of row.exercises) exercise.evidenceRef = row.evidenceRef;
    }
  });
  assert.equal(result.gates.offline.status, 'PASS');
  assert.equal(result.accepted, true);
});

test('matching MOCK_ONLY endurance and offline rows remain MOCK_ONLY even with complete evidence shape', () => {
  const result = evaluate(e => {
    for (const field of COLLECTIONS) for (const row of e[field]) row.provenance = 'MOCK_ONLY';
  });
  assert.equal(result.status, 'MOCK_ONLY');
  assert.equal(result.gates.endurance.status, 'MOCK_ONLY');
  assert.equal(result.gates.offline.status, 'MOCK_ONLY');
  assert.equal(result.accepted, false);
});

test('mixed or unknown source provenance cannot be laundered through observed offline rows', () => {
  for (const provenance of [undefined, null, 'OBSERVED', 'MOCK_ONLY']) {
    expectGate('offline', 'INCOMPLETE', e => { e.enduranceSessions[0].provenance = provenance; });
  }
  expectGate('offline', 'INCOMPLETE', e => {
    e.enduranceSessions[0].provenance = 'OBSERVED';
    e.offlineWorkloads[0].provenance = 'OBSERVED';
  });
});

test('offline disconnection, locality, completion and zero-paid-call requirements remain enforced', () => {
  for (const field of ['networkDisconnected', 'allComponentsLocal', 'workloadCompleted']) {
    expectGate('offline', 'FAIL', e => { e.offlineWorkloads[0][field] = false; });
    expectGate('offline', 'INCOMPLETE', e => { delete e.offlineWorkloads[0][field]; });
  }
  expectGate('offline', 'FAIL', e => { e.offlineWorkloads[0].paidApiCalls = 1; });
  for (const paidApiCalls of [undefined, -1, .5, '0', NaN]) {
    expectGate('offline', 'INCOMPLETE', e => { e.offlineWorkloads[0].paidApiCalls = paidApiCalls; });
  }
});

test('malformed endurance and offline rows cannot throw or silently qualify', () => {
  for (const [collection, gate] of targets) for (const value of [null, [], 3, 'PASS']) {
    expectGate(gate, 'INCOMPLETE', e => { e[collection] = [value]; });
  }
  for (const [collection, gate] of targets) expectGate(gate, 'INCOMPLETE', e => { e[collection] = {}; });
});

test('unchanged voice thresholds are 100 distinct recordings and 95-percent joint accuracy', () => {
  expectGate('voiceCommands', 'INCOMPLETE', e => { e.voiceRecordings.splice(0, 1); });
  expectGate('voiceCommands', 'INCOMPLETE', e => { e.voiceRecordings[0].recordingId = e.voiceRecordings[1].recordingId; });
  expectGate('voiceCommands', 'PASS', e => { for (const row of e.voiceRecordings.slice(0, 5)) row.intentCorrect = false; });
  expectGate('voiceCommands', 'FAIL', e => { for (const row of e.voiceRecordings.slice(0, 6)) row.intentCorrect = false; });
  expectGate('voiceCommands', 'FAIL', e => {
    for (const row of e.voiceRecordings.slice(0, 3)) row.intentCorrect = false;
    for (const row of e.voiceRecordings.slice(3, 6)) row.recipientCorrect = false;
  });
});

test('unchanged nearest-rank voice p95 permits five high samples but fails six out of 100', () => {
  assert.equal(percentile([...Array(95).fill(1500), ...Array(5).fill(9000)], .95), 1500);
  expectGate('voiceCommands', 'PASS', e => { for (const row of e.voiceRecordings.slice(0, 5)) row.finalTranscriptMs = 9000; });
  expectGate('voiceCommands', 'FAIL', e => { for (const row of e.voiceRecordings.slice(0, 6)) row.finalTranscriptMs = 1501; });
});

test('unchanged conversation threshold is 4000 ms with no invented sample minimum', () => {
  expectGate('conversation', 'PASS');
  expectGate('conversation', 'FAIL', e => { e.conversationSamples[0].firstAudioMs = 4001; });
  expectGate('conversation', 'FAIL', e => { e.conversationSamples[0].grounded = false; });
  expectGate('conversation', 'FAIL', e => { e.conversationSamples[0].speakerCorrect = false; });
});

test('unchanged style boundaries require 40 held-out decisions and 80-percent explicit acceptance', () => {
  expectGate('personalStyle', 'PASS', e => { for (const row of e.styleHeldOutDecisions.slice(0, 8)) row.acceptable = false; });
  expectGate('personalStyle', 'FAIL', e => { for (const row of e.styleHeldOutDecisions.slice(0, 9)) row.acceptable = false; });
  expectGate('personalStyle', 'INCOMPLETE', e => { e.styleHeldOutDecisions.pop(); });
  expectGate('personalStyle', 'INCOMPLETE', e => { e.styleHeldOutDecisions[0].sessionId = e.calibrationSessions[0].sessionId; });
});

test('unchanged gameplay boundaries retain 108 matched runs, ten-percent improvement and frame budget', () => {
  expectGate('gameplay', 'PASS');
  expectGate('gameplay', 'INCOMPLETE', e => { e.records.pop(); });
  expectGate('gameplay', 'FAIL', e => { for (const row of e.records) if (row.mode === 'direct') row.damageDealt = 109.99; });
  expectGate('gameplay', 'FAIL', e => { e.records.find(x => x.mode === 'direct').frameTimesMs = [11.001]; });
  expectGate('gameplay', 'FAIL', e => { e.records.find(x => x.mode === 'direct').missionSuccess = false; });
  expectGate('gameplay', 'FAIL', e => { e.records.find(x => x.mode === 'direct').lanceLosses = 1; });
});

test('storage reserve still includes download, staging and cache and cannot fall below ten GiB', () => {
  const input = {freeBytes: 16 * GiB, downloadsBytes: GiB, stagingBytes: 2 * GiB, cacheBytes: 3 * GiB};
  assert.equal(storagePreflight(input).status, 'PASS');
  assert.equal(storagePreflight({...input, freeBytes: input.freeBytes - 1}).status, 'FAIL');
  assert.equal(storagePreflight({...input, reserveBytes: 10 * GiB - 1}).status, 'INCOMPLETE');
});

test('evaluation is deterministic and does not mutate supplied exercise or repeat evidence', () => {
  const input = suppliedShape(), before = structuredClone(input);
  const first = evaluateReleaseEvidence(input), second = evaluateReleaseEvidence(input);
  assert.deepEqual(input, before);
  assert.deepEqual(first, second);
});
