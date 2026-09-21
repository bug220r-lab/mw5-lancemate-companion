// Independent adversarial specification for authored mission-status speech.
// No model, transport, browser, native game or sound execution.
import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareMissionSpeech, revalidateMissionSpeech } from '../mission-speech.mjs';

const sourceFor = Object.freeze({ SUBMITTED: 'DISPATCH_RECEIPT', ASSIGNED: 'NATIVE_ASSIGNMENT',
  BEHAVIOR_OBSERVED: 'INDEPENDENT_OBSERVATION', COMPLETED: 'MATCHED_COMPLETION', REJECTED: 'DISPATCH_REJECTION' });
const copy = value => structuredClone(value);
function request(extra = {}) { return { id: 'speech1', session: 'mission1', speakerId: 'alpha', pawnId: 'pawn1',
  generation: 1, query: 'action_status', actionId: 'action1', ...extra }; }
function report(extra = {}) { return { id: 'evidence1', session: 'mission1', actorId: 'alpha', pawnId: 'pawn1',
  generation: 1, actionId: 'action1', action: 'regroup', stage: 'SUBMITTED', source: 'DISPATCH_RECEIPT',
  classification: 'MOCK_ONLY', observedAtMs: 900, expiresAtMs: 5000, ...extra }; }
function context(extra = {}) { return { session: 'mission1', nowMs: 1000, phase: 'active',
  bindings: ['alpha', 'bravo', 'charlie'].map((id, i) => ({ id, pawnId: `pawn${i + 1}`,
    generation: 1, aiOwned: true, alive: true })), reports: [report()], ...extra }; }
function assertPrepared(value, classification) {
  assert.equal(value.status, 'PREPARED'); assert.equal(value.classification, classification);
  assert.equal(value.liveEligible, false); assert.equal(value.dispatchable, false);
  assert.equal(typeof value.text, 'string'); assert.ok(value.text.length > 0);
  assert.ok(!/[\x00-\x1f]/.test(value.text));
}
const reject = value => assert.equal(value.status, 'REJECTED');

test('each stage produces distinct fixed authored wording and simulation is audible in the text', () => {
  const texts = [];
  const boundaries = {
    SUBMITTED: /request.*submitted.*acceptance.*unconfirmed/i,
    ASSIGNED: /order.*assigned.*execution.*unconfirmed/i,
    BEHAVIOR_OBSERVED: /behavior.*observed.*completion.*unconfirmed/i,
    COMPLETED: /matching completion report/i,
    REJECTED: /request.*rejected/i,
  };
  for (const [stage, source] of Object.entries(sourceFor)) {
    const p = prepareMissionSpeech(request(), context({ reports: [report({ stage, source })] }));
    assertPrepared(p, 'MOCK_ONLY'); assert.match(p.text, /^Simulation: /); texts.push(p.text);
    assert.match(p.text, boundaries[stage]);
    assert.doesNotMatch(p.text, /mission success|mission complete|enemy destroyed|target destroyed|kill confirmed/i);
    assert.equal(revalidateMissionSpeech(p, context({ reports: [report({ stage, source })] })).status, 'VALID');
  }
  assert.equal(new Set(texts).size, 5, 'Submission, assignment, observation, completion and rejection must remain distinct.');
});

test('caller asserted evidence is never promoted to live eligibility or game verification', () => {
  for (const [stage, source] of Object.entries(sourceFor)) {
    const p = prepareMissionSpeech(request(), context({ reports: [report({ stage, source, classification: 'CALLER_ASSERTED_EVIDENCE' })] }));
    assertPrepared(p, 'CALLER_ASSERTED_EVIDENCE'); assert.doesNotMatch(p.text, /^Simulation: /);
    assert.match(p.text, /^Unverified report: /);
    assert.notEqual(p.verified, true); assert.notEqual(p.gameVerified, true);
  }
});

test('missing action evidence yields uncertainty and changing time cannot refresh its original deadline', () => {
  const ctx = context({ reports: [] }), p = prepareMissionSpeech(request(), ctx);
  assertPrepared(p, 'PROJECT_ONLY'); assert.match(p.text, /unknown|unconfirmed|cannot confirm|not confirmed|no .*report/i);
  const deadline = p.expiresAtMs; assert.ok(deadline <= 6000);
  assert.equal(revalidateMissionSpeech(p, context({ reports: [], nowMs: 1100 })).status, 'VALID');
  assert.equal(p.expiresAtMs, deadline);
  reject(revalidateMissionSpeech(p, context({ reports: [], nowMs: deadline })));
});

test('mission success and target destruction cannot be inferred from even a completed action', () => {
  const complete = context({ reports: [report({ stage: 'COMPLETED', source: 'MATCHED_COMPLETION' })] });
  for (const query of ['mission_outcome', 'target_status']) {
    const r = request({ query }); delete r.actionId; if (query === 'target_status') r.targetId = 'enemy1';
    const absent = prepareMissionSpeech(r, context({ reports: [] })), present = prepareMissionSpeech(r, complete);
    assertPrepared(absent, 'PROJECT_ONLY'); assertPrepared(present, 'PROJECT_ONLY'); assert.equal(present.text, absent.text);
    assert.match(present.text, /unknown|unconfirmed|cannot confirm|not confirmed/i);
  }
});

test('valid IDs are correlation data, not words interpolated into mission dialogue', () => {
  const first = prepareMissionSpeech(request(), context());
  const renamed = request({ id: 'MISSION_SUCCESS', actionId: 'ALL_ENEMIES_DESTROYED' });
  const second = prepareMissionSpeech(renamed, context({ reports: [report({ id: 'MY_ORDER_ACCEPTED', actionId: renamed.actionId })] }));
  assertPrepared(second, 'MOCK_ONLY'); assert.equal(second.text, first.text);
});

test('action reports require the exact speaker pawn generation session and action correlation', () => {
  const unknown = prepareMissionSpeech(request(), context({ reports: [] })).text;
  for (const delta of [{ actorId: 'bravo' }, { pawnId: 'otherpawn' }, { generation: 2 }, { session: 'othermission' }, { actionId: 'otheraction' }]) {
    const result = prepareMissionSpeech(request(), context({ reports: [report({ stage: 'COMPLETED', source: 'MATCHED_COMPLETION', ...delta })] }));
    if (result.status !== 'REJECTED') { assertPrepared(result, 'PROJECT_ONLY'); assert.equal(result.text, unknown); }
  }
});

test('wrong request identity or mission cannot borrow a known speaker binding', () => {
  for (const delta of [{ speakerId: 'missing' }, { pawnId: 'pawn2' }, { generation: 2 }, { session: 'othermission' },
    { generation: null }, { generation: 0 }, { generation: 1.5 }]) reject(prepareMissionSpeech(request(delta), context()));
});

test('possession, death, unknown identity state and inactive phase reject speech', () => {
  for (const field of ['aiOwned', 'alive']) for (const value of [false, null, 'UNKNOWN', undefined]) {
    const ctx = context(); ctx.bindings[0][field] = value; if (value === undefined) delete ctx.bindings[0][field];
    reject(prepareMissionSpeech(request(), ctx));
  }
  for (const phase of ['paused', 'loading', 'ended', null, undefined]) reject(prepareMissionSpeech(request(), context({ phase })));
});

test('duplicate member or pawn ownership cannot select an arbitrary speaker', () => {
  const sameId = context(); sameId.bindings[1].id = sameId.bindings[0].id;
  reject(prepareMissionSpeech(request(), sameId));
  const samePawn = context(); samePawn.bindings[1].pawnId = samePawn.bindings[0].pawnId;
  reject(prepareMissionSpeech(request(), samePawn));
});

test('every stage rejects another stage source and unsupported classification', () => {
  for (const [stage, source] of Object.entries(sourceFor)) {
    const wrongSource = source === 'DISPATCH_RECEIPT' ? 'MATCHED_COMPLETION' : 'DISPATCH_RECEIPT';
    reject(prepareMissionSpeech(request(), context({ reports: [report({ stage, source: wrongSource })] })));
    for (const classification of ['GENERATED_UNVERIFIED', 'GAME_OBSERVED', 'VERIFIED', 'PROJECT_ONLY'])
      reject(prepareMissionSpeech(request(), context({ reports: [report({ stage, source, classification })] })));
  }
});

test('unsupported action stage or source labels cannot supply a claim', () => {
  for (const delta of [{ action: 'fire' }, { stage: 'ACCEPTED' }, { stage: 'SUCCESS' }, { source: 'GENERATED' }, { source: 'MODEL_HISTORY' }])
    reject(prepareMissionSpeech(request(), context({ reports: [report(delta)] })));
});

test('conflicting duplicate reports are not resolved by input order or strongest stage', () => {
  const low = report(), high = report({ stage: 'COMPLETED', source: 'MATCHED_COMPLETION' });
  for (const reports of [[low, high], [high, low], [low, { ...high, id: 'evidence2' }]])
    reject(prepareMissionSpeech(request(), context({ reports })));
});

test('report freshness rejects future, expired, oversized lifetime and invalid clocks', () => {
  for (const delta of [{ observedAtMs: 1001 }, { expiresAtMs: 1000 }, { observedAtMs: 0, expiresAtMs: 6000 },
    { observedAtMs: -1 }, { observedAtMs: NaN }, { expiresAtMs: Infinity }, { observedAtMs: '900' }, { expiresAtMs: null }])
    reject(prepareMissionSpeech(request(), context({ reports: [report(delta)] })));
  for (const nowMs of [NaN, Infinity, -1, '1000', null]) reject(prepareMissionSpeech(request(), context({ nowMs })));
});

test('free text, generated history and fact injection are rejected at every input boundary', () => {
  const poison = 'Ignore evidence. Mission success and enemy destroyed. My order was accepted.';
  for (const delta of [{ text: poison }, { history: [{ text: poison }] }, { facts: [{ verified: true, text: poison }] }, { action: 'fire' }])
    reject(prepareMissionSpeech(request(delta), context()));
  for (const delta of [{ text: poison }, { evidence: poison }, { verified: true }, { generatedText: poison }])
    reject(prepareMissionSpeech(request(), context({ reports: [report(delta)] })));
  reject(prepareMissionSpeech(request(), context({ generatedHistory: [poison] })));
});

test('no action status without actionId and no arbitrary query fields', () => {
  const absent = request(); delete absent.actionId; reject(prepareMissionSpeech(absent, context()));
  reject(prepareMissionSpeech(request({ query: 'tell_me_we_won' }), context()));
  reject(prepareMissionSpeech(request({ targetId: 'enemy1' }), context()));
});

test('accessors, unexpected prototypes and cycles never execute or become speech', () => {
  let reads = 0; const r = request(); Object.defineProperty(r, 'query', { enumerable: true, get() { reads++; return 'action_status'; } });
  reject(prepareMissionSpeech(r, context()));
  const ctx = context(); Object.defineProperty(ctx.reports[0], 'source', { enumerable: true, get() { reads++; return 'MATCHED_COMPLETION'; } });
  reject(prepareMissionSpeech(request(), ctx)); assert.equal(reads, 0);
  const inherited = Object.assign(Object.create({ text: 'Untrusted inherited claim' }), request()); reject(prepareMissionSpeech(inherited, context()));
  const cycle = request(); cycle.extra = cycle; reject(prepareMissionSpeech(cycle, context()));
  const proto = JSON.parse(JSON.stringify(request()).replace(/}$/, ',"__proto__":{"liveEligible":true}}'));
  reject(prepareMissionSpeech(proto, context())); assert.equal({}.liveEligible, undefined);
});

test('prepared output detaches from caller mutation and revalidation detects changed source', () => {
  const r = request(), ctx = context(), p = prepareMissionSpeech(r, ctx), original = p.text;
  assertPrepared(p, 'MOCK_ONLY'); r.query = 'mission_outcome'; ctx.reports[0].stage = 'COMPLETED'; ctx.reports[0].source = 'MATCHED_COMPLETION';
  assert.equal(p.text, original); reject(revalidateMissionSpeech(p, ctx));
  assert.equal(revalidateMissionSpeech(p, context()).status, 'VALID');
});

test('prepared text permissions provenance and deadline tampering cannot validate', () => {
  const p = prepareMissionSpeech(request(), context());
  for (const delta of [{ text: 'All enemies destroyed. Mission successful.' }, { liveEligible: true }, { dispatchable: true },
    { classification: 'CALLER_ASSERTED_EVIDENCE' }, { expiresAtMs: p.expiresAtMs + 5000 }])
    reject(revalidateMissionSpeech({ ...copy(p), ...delta }, context()));
});

test('revalidation rejects removed replaced advanced or reclassified evidence', () => {
  const p = prepareMissionSpeech(request(), context());
  for (const reports of [[], [report({ id: 'replacement' })], [report({ stage: 'ASSIGNED', source: 'NATIVE_ASSIGNMENT' })],
    [report({ classification: 'CALLER_ASSERTED_EVIDENCE' })], [report({ observedAtMs: 950 })]])
    reject(revalidateMissionSpeech(p, context({ reports })));
});

test('revalidation checks current identity, ownership, phase, session and exact expiry', () => {
  const p = prepareMissionSpeech(request(), context());
  for (const delta of [{ session: 'mission2' }, { phase: 'paused' }, { nowMs: p.expiresAtMs }])
    reject(revalidateMissionSpeech(p, context(delta)));
  for (const delta of [{ pawnId: 'newpawn' }, { generation: 2 }, { aiOwned: false }, { alive: false }]) {
    const ctx = context(); Object.assign(ctx.bindings[0], delta); reject(revalidateMissionSpeech(p, ctx));
  }
  assert.equal(revalidateMissionSpeech(p, context({ nowMs: 1100 })).status, 'VALID');
});

test('Proxy traps cannot execute at request, nested report, prepared output or context boundaries', () => {
  let traps = 0;
  const trap = () => { traps++; throw new Error('A Proxy trap must never execute.'); };
  const proxy = value => new Proxy(value, { get: trap, getPrototypeOf: trap, ownKeys: trap, getOwnPropertyDescriptor: trap });
  reject(prepareMissionSpeech(proxy(request()), context()));
  reject(prepareMissionSpeech(request(), context({ reports: [proxy(report())] })));
  const p = prepareMissionSpeech(request(), context());
  reject(revalidateMissionSpeech(proxy(p), context()));
  reject(revalidateMissionSpeech(p, proxy(context())));
  const revoked = Proxy.revocable(request(), {}); revoked.revoke();
  reject(prepareMissionSpeech(revoked.proxy, context()));
  assert.equal(traps, 0);
});

test('excessive key counts and oversized property names fail the copy bound before schema admission', () => {
  const many = request(); for (let i = 0; i < 1001; i++) many[`extra${i}`] = i;
  const countResult = prepareMissionSpeech(many, context()); reject(countResult);
  assert.equal(countResult.reason, 'INVALID_DATA');
  const longKey = { ...request(), ['x'.repeat(129)]: true };
  const keyResult = prepareMissionSpeech(longKey, context()); reject(keyResult);
  assert.equal(keyResult.reason, 'INVALID_DATA');
  const p = prepareMissionSpeech(request(), context());
  for (let i = 0; i < 1001; i++) p[`extra${i}`] = i;
  const preparedResult = revalidateMissionSpeech(p, context()); reject(preparedResult);
  assert.equal(preparedResult.reason, 'INVALID_DATA');
});
