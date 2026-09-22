import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {evaluateReleaseEvidence, storagePreflight, percentile, GiB, SCENARIO_CELLS, ENDURANCE_EXERCISE_KINDS} from '../benchmark.mjs';

const fixture = JSON.parse(readFileSync(new URL('../../synthetic/release-benchmark.json', import.meta.url), 'utf8'));
const fields = ['records', 'calibrationSessions', 'styleHeldOutDecisions', 'voiceRecordings', 'conversationSamples', 'enduranceSessions', 'offlineWorkloads'];
const empty = () => Object.fromEntries([['version', 2], ['currentConfigHash', 'a'.repeat(64)], ...fields.map(f => [f, []])]);
// Deliberately fabricated, memory-only evidence exercises validation branches. It is NEVER a gameplay receipt.
function suppliedObservedShape() {
  const x = structuredClone(fixture);
  for (const f of fields) for (const r of x[f]) r.provenance = 'GAME_OBSERVED';
  return x;
}
const check = mutate => { const x = suppliedObservedShape(); mutate(x); return evaluateReleaseEvidence(x); };
const storage = changes => storagePreflight({freeBytes:16*GiB,downloadsBytes:3*GiB,stagingBytes:2*GiB,cacheBytes:GiB,...changes});

test('12 predeclared cells span objectives/loadouts/terrain; all 108 fixture runs remain MOCK_ONLY', () => {
  assert.equal(SCENARIO_CELLS.length, 12);
  assert.equal(new Set(SCENARIO_CELLS.map(s => s.scenarioId)).size, 12);
  assert.equal(fixture.records.length, 108);
  assert.ok(fixture.records.every(r => r.provenance === 'MOCK_ONLY'));
  const report = evaluateReleaseEvidence(fixture);
  assert.equal(report.status, 'MOCK_ONLY');
  assert.equal(report.accepted, false);
  assert.ok(Object.values(report.gates).every(g => g.status === 'MOCK_ONLY'));
});

test('empty evidence is NOT_PERFORMED; absent/malformed envelope is not acceptance', () => {
  assert.equal(evaluateReleaseEvidence(empty()).status, 'NOT_PERFORMED');
  for (const e of [undefined, null, [], {}, {version:2}, 'PASS']) assert.equal(evaluateReleaseEvidence(e).accepted, false);
});

test('fully stipulated GAME_OBSERVED shape checks arithmetic only and exposes review limitation', () => {
  const r = evaluateReleaseEvidence(suppliedObservedShape());
  assert.equal(r.status, 'PASS');
  assert.equal(r.scope, 'SUPPLIED_RELEASE_EVIDENCE_ONLY');
  assert.ok(r.criticalReview.some(x => x.includes('authenticity')));
  assert.equal(r.gates.gameplay.metrics.comparisons.tactical.pairedRuns, 36);
  assert.ok(Math.abs(r.gates.gameplay.metrics.comparisons.tactical.medianDamageEfficiencyImprovement - .2) < 1e-12);
});

test('missing one run or one mode cannot be filled or inferred', () => {
  assert.equal(check(x => x.records.pop()).gates.gameplay.status, 'INCOMPLETE');
  const report = check(x => { x.records = x.records.filter(r => r.mode !== 'direct'); });
  assert.equal(report.gates.gameplay.metrics.missingPairs.length, 36);
  assert.equal(report.accepted, false);
});

test('duplicate pairs and reused run sessions are invalid even if counts look sufficient', () => {
  assert.equal(check(x => { x.records[1] = {...x.records[0],sessionId:'different-session'}; }).gates.gameplay.status, 'INCOMPLETE');
  assert.equal(check(x => { x.records[1].sessionId = x.records[0].sessionId; }).gates.gameplay.status, 'INCOMPLETE');
});

test('current configuration mismatch and unmatched pair cannot pass', () => {
  assert.equal(check(x => { x.currentConfigHash = 'b'.repeat(64); }).accepted, false);
  assert.equal(check(x => { x.records[1].configHash = 'b'.repeat(64); }).gates.gameplay.status, 'INCOMPLETE');
  assert.equal(check(x => { x.currentConfigHash = 'not-a-hash'; }).accepted, false);
});

test('mixed provenance is incomplete and missing evidence reference is not observed evidence', () => {
  assert.equal(check(x => { x.records[1].provenance = 'MOCK_ONLY'; }).gates.gameplay.status, 'INCOMPLETE');
  assert.equal(check(x => { delete x.records[1].evidenceRef; }).gates.gameplay.status, 'INCOMPLETE');
});

test('NaN, Infinity, empty frames, negative damage and invalid loss counts are invalid evidence', () => {
  for (const value of [NaN, Infinity, -1, undefined, '100']) {
    assert.equal(check(x => { x.records[1].damageTaken = value; }).gates.gameplay.status, 'INCOMPLETE');
  }
  for (const value of [[], [NaN], [Infinity], [0], [-1], null]) {
    assert.equal(check(x => { x.records[1].frameTimesMs = value; }).gates.gameplay.status, 'INCOMPLETE');
  }
  for (const value of [4, -1, .5, NaN]) assert.equal(check(x => { x.records[1].lanceLosses = value; }).accepted, false);
});

test('non-object entries and wrong array types fail closed without throwing', () => {
  for (const field of fields) {
    assert.equal(check(x => { x[field] = [null]; }).accepted, false);
    assert.equal(check(x => { x[field] = {}; }).accepted, false);
  }
});

test('zero baseline median efficiency and derived overflow are incomplete, with no invented infinity score', () => {
  assert.equal(check(x => { for (const r of x.records) if (r.mode === 'vanilla') r.damageDealt = 0; }).gates.gameplay.status, 'INCOMPLETE');
  const report = check(x => { x.records[0].frameTimesMs = [Number.MIN_VALUE]; });
  assert.equal(report.gates.gameplay.status, 'INCOMPLETE');
  function finiteTree(x) {
    if (typeof x === 'number') assert.ok(Number.isFinite(x));
    else if (x && typeof x === 'object') Object.values(x).forEach(finiteTree);
  }
  finiteTree(report);
});

test('damage efficiency is dealt/max(1,taken), with exact 10% median boundary', () => {
  const at = check(x => { for (const r of x.records) r.damageDealt = r.mode === 'vanilla' ? 100 : 110; });
  assert.equal(at.gates.gameplay.status, 'PASS');
  assert.equal(check(x => { for (const r of x.records) if (r.mode !== 'vanilla') r.damageDealt = 109.9; }).gates.gameplay.status, 'FAIL');
  assert.equal(check(x => { for (const r of x.records) r.damageTaken = 0; }).gates.gameplay.status, 'PASS');
});

test('median efficiency is not pooled damage; one giant improvement cannot rescue most losses', () => {
  const result = check(x => {
    for (const r of x.records) if (r.mode === 'tactical') r.damageDealt = 100;
    x.records.find(r => r.mode === 'tactical').damageDealt = 1e9;
  });
  assert.equal(result.gates.gameplay.metrics.comparisons.tactical.medianDamageEfficiencyImprovement, 0);
  assert.equal(result.gates.gameplay.status, 'FAIL');
});

test('approved damage comparison uses ratio of medians, not median of paired percentages', () => {
  const result = check(x => {
    let n=0;
    for (const r of x.records) if (r.mode === 'vanilla') r.damageDealt = ++n <= 18 ? 100 : 300;
    for (const r of x.records) if (r.mode === 'tactical') r.damageDealt = 210;
  });
  const c = result.gates.gameplay.metrics.comparisons.tactical;
  assert.ok(Math.abs(c.medianDamageEfficiencyImprovement - .05)<1e-12);
  assert.ok(Math.abs(c.advisoryMedianPairedPercentageImprovement - .40)<1e-12);
  assert.equal(result.gates.gameplay.status,'FAIL');
});

test('better damage cannot compensate for lower mission success or more lance losses', () => {
  assert.equal(check(x => { x.records[1].missionSuccess = false; }).gates.gameplay.status, 'FAIL');
  assert.equal(check(x => { x.records[1].lanceLosses = 1; }).gates.gameplay.status, 'FAIL');
});

test('per-pair regressions remain visible when aggregate survival is equal', () => {
  const r = check(x => { x.records[1].lanceLosses = 1; x.records[3].lanceLosses = 1; });
  assert.equal(r.gates.gameplay.status, 'PASS');
  assert.ok(r.criticalReview.some(s => s.includes('C01/1/tactical')));
});

test('frame overhead accepts exact 10% boundary and rejects excess', () => {
  assert.equal(check(x => { x.records[1].frameTimesMs = Array(100).fill(17.6); }).gates.gameplay.status, 'PASS');
  assert.equal(check(x => { x.records[1].frameTimesMs = Array(100).fill(17.61); }).gates.gameplay.status, 'FAIL');
});

test('1% low and stalls remain advisory when p95 meets the approved gate', () => {
  const r = check(x => { x.records[1].frameTimesMs[99] = 150; });
  assert.equal(r.gates.gameplay.metrics.comparisons.tactical.worstP95FrameTimeRatio, 1);
  assert.equal(r.gates.gameplay.status, 'PASS');
  assert.ok(r.criticalReview.some(s => s.includes('advisory 1%-low/stall regression')));
});

test('resource reserves use minimum available memory, not maximum available or average', () => {
  assert.equal(check(() => {}).gates.gameplay.status, 'PASS');
  for (const [key, value] of [['minAvailableRamBytes',2*GiB-1],['minAvailableVramBytes',GiB-1]]) {
    assert.equal(check(x => { x.records[1].resources[key] = value; }).gates.gameplay.status, 'FAIL');
  }
  assert.equal(check(x => { x.records[1].resources = {peakAvailableRamBytes:9*GiB}; }).gates.gameplay.status, 'INCOMPLETE');
});

test('held-out style needs 40 reviewed decisions with >=80% acceptable', () => {
  assert.equal(check(() => {}).gates.personalStyle.status, 'PASS');
  assert.equal(check(x => { x.styleHeldOutDecisions.pop(); }).gates.personalStyle.status, 'INCOMPLETE');
  assert.equal(check(x => { x.styleHeldOutDecisions[0].acceptable = false; }).gates.personalStyle.status, 'FAIL');
  assert.equal(check(x => { x.styleHeldOutDecisions[0].userReviewed = false; }).gates.personalStyle.status, 'INCOMPLETE');
});

test('calibration and held-out sessions cannot overlap or use mock calibration for real claims', () => {
  assert.equal(check(x => { x.styleHeldOutDecisions[0].sessionId = x.calibrationSessions[0].sessionId; }).gates.personalStyle.status, 'INCOMPLETE');
  assert.equal(check(x => { x.calibrationSessions = []; }).gates.personalStyle.status, 'INCOMPLETE');
  assert.equal(check(x => { x.calibrationSessions[0].provenance = 'MOCK_ONLY'; }).gates.personalStyle.status, 'INCOMPLETE');
  assert.equal(check(x => { x.styleHeldOutDecisions[1].decisionId = x.styleHeldOutDecisions[0].decisionId; }).gates.personalStyle.status, 'INCOMPLETE');
});

test('voice correctness requires both intent and recipient and 100 distinct recordings', () => {
  assert.equal(check(() => {}).gates.voiceCommands.status, 'PASS');
  assert.equal(check(x => { x.voiceRecordings[0].recipientCorrect = false; }).gates.voiceCommands.status, 'FAIL');
  assert.equal(check(x => { x.voiceRecordings.pop(); }).gates.voiceCommands.status, 'INCOMPLETE');
  assert.equal(check(x => { x.voiceRecordings[1].recordingId = x.voiceRecordings[0].recordingId; }).gates.voiceCommands.status, 'INCOMPLETE');
});

test('a single wrong-recipient dispatch fails even with excellent recognition', () => {
  const r = check(x => { x.voiceRecordings[0].dispatchAttempted = true; x.voiceRecordings[0].dispatchRecipientCorrect = false; });
  assert.equal(r.gates.voiceCommands.status, 'FAIL');
});

test('nearest-rank p95 accepts five high outliers out of 100, rejects six', () => {
  assert.equal(percentile([5,1,4,2,3],.5),3);
  assert.equal(percentile([], .95),null);
  assert.equal(percentile([NaN], .95),null);
  assert.equal(percentile([1], 0),null);
  assert.equal(check(x => { for (let i=0;i<5;i++) x.voiceRecordings[i].finalTranscriptMs=1501; }).gates.voiceCommands.status, 'PASS');
  assert.equal(check(x => { for (let i=0;i<6;i++) x.voiceRecordings[i].finalTranscriptMs=1501; }).gates.voiceCommands.status, 'FAIL');
});

test('conversation latency has 4000ms p95 boundary and explicit grounding/speaker checks', () => {
  assert.equal(check(() => {}).gates.conversation.status, 'PASS');
  assert.equal(check(x => { for(let i=0;i<6;i++) x.conversationSamples[i].firstAudioMs=4001; }).gates.conversation.status, 'FAIL');
  assert.equal(check(x => { x.conversationSamples[0].grounded=false; }).gates.conversation.status, 'FAIL');
  assert.equal(check(x => { x.conversationSamples[0].speakerCorrect=false; }).gates.conversation.status, 'FAIL');
  assert.equal(check(x => { x.conversationSamples[0].firstAudioMs=NaN; }).gates.conversation.status, 'INCOMPLETE');
  assert.equal(check(x => { x.conversationSamples=x.conversationSamples.slice(0,1); }).gates.conversation.status,'PASS');
});

test('endurance requires 60 uninterrupted minutes with all three AIs and zero control failures', () => {
  assert.equal(check(() => {}).gates.endurance.status, 'PASS');
  for (const [key,value] of [['durationMs',3599999],['controlledAiCount',2],['allThreeActiveThroughout',false],['noCrash',false],['humanOverrideFailures',1],['wrongRecipientCommands',1]]) {
    assert.equal(check(x => { x.enduranceSessions[0][key]=value; }).gates.endurance.status,'FAIL');
  }
});

test('offline evidence must explicitly confirm disconnected local completed workload without APIs', () => {
  for (const [key,value] of [['networkDisconnected',false],['allComponentsLocal',false],['workloadCompleted',false],['paidApiCalls',1]]) {
    assert.equal(check(x => { x.offlineWorkloads[0][key]=value; }).gates.offline.status,'FAIL');
  }
  assert.equal(check(x => { delete x.offlineWorkloads[0].networkDisconnected; }).gates.offline.status,'INCOMPLETE');
});

test('storage requires room for download, staging, cache and 10GiB reserve concurrently', () => {
  assert.equal(storage().status,'PASS');
  assert.equal(storage().remainingBytes,10*GiB);
  assert.equal(storage({freeBytes:16*GiB-1}).status,'FAIL');
  assert.equal(storage({reserveBytes:11*GiB}).status,'FAIL');
  assert.equal(storage({reserveBytes:0}).status,'INCOMPLETE');
});

test('unknown or nonsensical sizes fail closed without coercion or overflow', () => {
  for (const field of ['freeBytes','downloadsBytes','stagingBytes','cacheBytes','reserveBytes']) {
    for (const value of [null,NaN,Infinity,-1,.1,'0',Symbol('bad'),2n]) assert.equal(storage({[field]:value}).ok,false);
  }
  assert.equal(storagePreflight({freeBytes:100*GiB}).ok,false);
  assert.equal(storage({downloadsBytes:Number.MAX_SAFE_INTEGER}).status,'INCOMPLETE');
});

test('evaluation is deterministic and never mutates supplied evidence', () => {
  const input=structuredClone(fixture), before=structuredClone(input);
  assert.deepEqual(evaluateReleaseEvidence(input),evaluateReleaseEvidence(input));
  assert.deepEqual(input,before);
});

test('schema v1 cannot silently inherit v2 acceptance', () => {
  const report=check(x=>{x.version=1;});
  assert.equal(report.version,2);assert.equal(report.accepted,false);assert.equal(report.status,'INCOMPLETE');
  assert.ok(report.schemaIssues.some(message=>message.includes('legacy')));
});

test('voice needs explicit ambiguity annotations and nonempty ambiguous coverage', () => {
  assert.equal(check(x=>{delete x.voiceRecordings[0].ambiguous;}).gates.voiceCommands.status,'INCOMPLETE');
  assert.equal(check(x=>{for(const row of x.voiceRecordings)row.ambiguous=false;}).gates.voiceCommands.status,'INCOMPLETE');
  const report=check(()=>{}).gates.voiceCommands;
  assert.equal(report.metrics.annotatedAmbiguousCount,1);assert.equal(report.metrics.ambiguousDispatchCount,0);
  assert.equal(report.status,'PASS');
});

test('ambiguous dispatch fails even if intent and guessed recipient are both marked correct', () => {
  const report=check(x=>{Object.assign(x.voiceRecordings[0],{ambiguous:true,intentCorrect:true,recipientCorrect:true,
    dispatchAttempted:true,dispatchRecipientCorrect:true});}).gates.voiceCommands;
  assert.equal(report.status,'FAIL');assert.equal(report.metrics.ambiguousDispatchCount,1);
  assert.ok(report.failures.some(message=>message.includes('ambiguous command')));
});

test('known unsafe dispatch remains visible when other voice evidence is incomplete', () => {
  const report=check(x=>{Object.assign(x.voiceRecordings[0],{ambiguous:true,dispatchAttempted:true,dispatchRecipientCorrect:true});
    delete x.voiceRecordings[1].ambiguous;}).gates.voiceCommands;
  assert.equal(report.status,'INCOMPLETE');assert.ok(report.failures.some(message=>message.includes('ambiguous command')));
});

test('every endurance exercise needs exactly one performed summary', () => {
  for(const kind of ENDURANCE_EXERCISE_KINDS){
    assert.equal(check(x=>{x.enduranceSessions[0].exercises=x.enduranceSessions[0].exercises.filter(row=>row.kind!==kind);}).gates.endurance.status,'INCOMPLETE');
    assert.equal(check(x=>{x.enduranceSessions[0].exercises.find(row=>row.kind===kind).status='NOT_PERFORMED';}).gates.endurance.status,'INCOMPLETE');
    assert.equal(check(x=>{x.enduranceSessions[0].exercises.find(row=>row.kind===kind).status='FAIL';}).gates.endurance.status,'FAIL');
  }
  assert.equal(check(x=>{x.enduranceSessions[0].exercises.push({...x.enduranceSessions[0].exercises[0]});}).gates.endurance.status,'INCOMPLETE');
  assert.equal(check(x=>{x.enduranceSessions[0].exercises.push({kind:'unapproved',status:'PASS',description:'Extra',evidenceRef:'mock://extra'});}).gates.endurance.status,'INCOMPLETE');
});

test('exercise claims and workload references cannot substitute for missing descriptions/evidence', () => {
  for(const field of ['description','evidenceRef','status','kind'])
    assert.equal(check(x=>{delete x.enduranceSessions[0].exercises[0][field];}).gates.endurance.status,'INCOMPLETE');
  for(const value of [undefined,'bad',null])
    assert.equal(check(x=>{x.enduranceSessions[0].workloadHash=value;}).gates.endurance.status,'INCOMPLETE');
  const report=check(x=>{x.enduranceSessions[0].exercises[0].status='FAIL';x.enduranceSessions[0].exercises.pop();});
  assert.equal(report.gates.endurance.status,'INCOMPLETE');assert.ok(report.gates.endurance.failures.length>0);
});

test('offline flags alone no longer establish a full repeated endurance workload', () => {
  const report=check(x=>{const r=x.offlineWorkloads[0];for(const key of ['durationMs','controlledAiCount','allThreeActiveThroughout',
    'noCrash','humanOverrideFailures','wrongRecipientCommands','resources','exercises','workloadHash','repeatsSessionId'])delete r[key];});
  assert.equal(report.gates.offline.status,'INCOMPLETE');assert.equal(report.accepted,false);
});

test('offline repeats preserve the same duration, three-AI and resource thresholds', () => {
  for(const [key,value] of [['durationMs',3599999],['controlledAiCount',2],['allThreeActiveThroughout',false],['noCrash',false],['humanOverrideFailures',1],['wrongRecipientCommands',1]])
    assert.equal(check(x=>{x.offlineWorkloads[0][key]=value;}).gates.offline.status,'FAIL');
  for(const [key,value] of [['minAvailableRamBytes',2*GiB-1],['minAvailableVramBytes',GiB-1]])
    assert.equal(check(x=>{x.offlineWorkloads[0].resources[key]=value;}).gates.offline.status,'FAIL');
  for(const kind of ENDURANCE_EXERCISE_KINDS)
    assert.equal(check(x=>{x.offlineWorkloads[0].exercises.find(row=>row.kind===kind).status='FAIL';}).gates.offline.status,'FAIL');
});

test('offline source linkage requires a distinct unique matching endurance session', () => {
  for(const mutate of [
    x=>{delete x.offlineWorkloads[0].repeatsSessionId;},
    x=>{x.offlineWorkloads[0].repeatsSessionId='missing';},
    x=>{x.offlineWorkloads[0].sessionId=x.enduranceSessions[0].sessionId;},
    x=>{x.enduranceSessions.push(structuredClone(x.enduranceSessions[0]));},
    x=>{x.offlineWorkloads[0].workloadHash='b'.repeat(64);},
    x=>{x.enduranceSessions[0].provenance='MOCK_ONLY';},
    x=>{x.enduranceSessions[0].configHash='b'.repeat(64);},
  ]) assert.equal(check(mutate).gates.offline.status,'INCOMPLETE');
});

test('offline cannot repeat unknown, incomplete or failed source acceptance', () => {
  assert.equal(check(x=>{delete x.enduranceSessions[0].noCrash;}).gates.offline.status,'INCOMPLETE');
  assert.equal(check(x=>{x.enduranceSessions[0].exercises[0].status='NOT_PERFORMED';}).gates.offline.status,'INCOMPLETE');
  assert.equal(check(x=>{x.enduranceSessions[0].noCrash=false;}).gates.offline.status,'FAIL');
  assert.equal(check(x=>{x.enduranceSessions[0].exercises[0].status='FAIL';}).gates.offline.status,'FAIL');
});

test('offline linkage uses the referenced row qualification rather than unrelated aggregate failure', () => {
  const report=check(x=>{x.enduranceSessions.push({...structuredClone(x.enduranceSessions[0]),sessionId:'other-endurance',noCrash:false});});
  assert.equal(report.gates.endurance.status,'FAIL');assert.equal(report.gates.offline.status,'PASS');assert.equal(report.accepted,false);
});
