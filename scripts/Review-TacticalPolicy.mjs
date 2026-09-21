// Independent, contract-derived adversarial review. Project-local synthetic data only.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { decideSquad } from './tactical-policy.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const copy = x => structuredClone(x);
const initiative = r => ['FOCUS', 'REPOSITION', 'REGROUP'].includes(r.action);
const unit = (name = 'alpha', n = 1) => ({ id: name, pawnId: `pawn${n}`, controllerId: `control${n}`,
  generation: 1, member: true, reciprocalBinding: true, aiOwned: true, alive: true,
  configured: true, authority: true, manual: { observable: true, revision: 0,
    orderId: null, status: 'none', persistent: false }, healthFraction: 1, heatFraction: 0.1,
  ammoAvailable: true, distanceToLeaderM: 100, weaponRangeM: { min: 100, max: 600 },
  capabilities: ['focus', 'regroup', 'reposition'], safeRegroupKnown: true,
  engagements: [{ targetId: 'enemy', distanceM: 300, lineOfFireKnownClear: true }], positions: [] });
const fixture = () => ({ schemaVersion: 1, session: 'reviewMission', sequence: 1,
  observedAtMs: 10000, nowMs: 10000, phase: 'active', authority: true,
  leader: { pawnId: 'playerPawn', matchesNativeSquadLeader: true },
  targets: [{ id: 'enemy', knownToLance: true, visibleToLance: true, allegiance: 'hostile',
    alive: true, observedAtMs: 10000, threat: 0.7 }], lancemates: [unit()] });
const position = (id = 'point1') => ({ id, pathFeasible: true, occupied: false,
  saferThanCurrent: true, targetId: 'enemy', distanceToTargetM: 300, lineOfFireKnownClear: true });
const manual = (status = 'active', persistent = true, revision = 1, orderId = 'human1') =>
  ({ observable: true, status, persistent, revision, orderId });
function next(s) { const n = copy(s); n.sequence++; n.nowMs += 100; n.observedAtMs = n.nowMs;
  n.targets.forEach(t => t.observedAtMs = n.nowMs); return n; }
const tests = [];
function test(id, purpose, run) { tests.push({ id, purpose, run }); }
function noInitiative(result, actor = 'alpha') { const r = result.recommendations.find(r => r.actorId === actor);
  assert(r, `Missing recommendation for ${actor}`); assert(!initiative(r), `${actor}: unexpected ${r.action} (${r.reason})`); }
function allDefer(result) { assert(result.recommendations.every(r => r.action === 'DEFER'),
  `Ambiguous identity allowed: ${result.recommendations.map(r => `${r.actorId}:${r.action}`).join(', ')}`); }
function runSequence(frames) { let state = null; const trace = [];
  for (const s of frames) { const r = decideSquad(s, state); trace.push(r); state = r.state; } return trace; }

test('IR01', 'Different member IDs cannot claim the same live pawn', () => {
  const s = fixture(); s.lancemates.push(unit('bravo', 2)); s.lancemates[1].pawnId = s.lancemates[0].pawnId;
  const r = decideSquad(s); allDefer(r); return [r];
});
test('IR02', 'Different member IDs cannot claim the same live controller', () => {
  const s = fixture(); s.lancemates.push(unit('bravo', 2)); s.lancemates[1].controllerId = s.lancemates[0].controllerId;
  const r = decideSquad(s); allDefer(r); return [r];
});
test('IR03', 'An AI recipient cannot simultaneously be the verified player leader pawn', () => {
  const s = fixture(); s.lancemates[0].pawnId = s.leader.pawnId;
  const r = decideSquad(s); noInitiative(r); return [r];
});
test('IR04', 'Persistent human order cannot be downgraded and released by completion', () => {
  const a = fixture(); a.lancemates[0].manual = manual();
  const b = next(a); b.lancemates[0].manual = manual('active', false, 2);
  const c = next(b); c.lancemates[0].manual = manual('completed', false, 3);
  const trace = runSequence([a, b, c]); noInitiative(trace[2]); return trace;
});
test('IR05', 'Disappearing member does not erase its unresolved human order', () => {
  const a = fixture(); a.lancemates.push(unit('bravo', 2)); a.lancemates[0].manual = manual();
  const b = next(a); b.lancemates = [b.lancemates[1]];
  const c = next(b); c.lancemates.unshift(unit()); c.lancemates[0].manual.revision = 1;
  const trace = runSequence([a, b, c]); noInitiative(trace[2]); return trace;
});
test('IR06', 'Conflicting clear-fire observations cannot grant a firing opportunity', () => {
  const s = fixture(); s.lancemates[0].engagements.push({ ...s.lancemates[0].engagements[0], lineOfFireKnownClear: false });
  const r = decideSquad(s); assert(!r.recommendations.some(r => r.action === 'FOCUS')); return [r];
});
test('IR07', 'Conflicting feasibility for one candidate cannot authorize repositioning', () => {
  const s = fixture(); s.lancemates[0].engagements = [];
  s.lancemates[0].positions = [position(), { ...position(), pathFeasible: false }];
  const r = decideSquad(s); assert(!r.recommendations.some(r => r.action === 'REPOSITION')); return [r];
});
test('IR08', 'Conflicting distance for one target cannot establish useful range', () => {
  const s = fixture(); s.lancemates[0].engagements.push({ ...s.lancemates[0].engagements[0], distanceM: 7000 });
  const r = decideSquad(s); assert(!r.recommendations.some(r => r.action === 'FOCUS')); return [r];
});
test('IR09', 'No current visibility means no focus or firing-position initiative', () => {
  const s = fixture(); s.targets[0].visibleToLance = false; s.lancemates[0].positions = [position()];
  const r = decideSquad(s); noInitiative(r); return [r];
});
test('IR10', 'A future target observation cannot create an engagement', () => {
  const s = fixture(); s.targets[0].observedAtMs++; const r = decideSquad(s); noInitiative(r); return [r];
});
test('IR11', 'A fresh world frame does not refresh an old contact by inference', () => {
  const s = fixture(); s.targets[0].observedAtMs = s.nowMs - 1001;
  const r = decideSquad(s); noInitiative(r); return [r];
});
test('IR12', 'Unknown known-to-lance status remains unknown', () => {
  const s = fixture(); delete s.targets[0].knownToLance; const r = decideSquad(s); noInitiative(r); return [r];
});
test('IR13', 'Time and repeated missing-order observations never release a human hold', () => {
  let s = fixture(); s.lancemates[0].manual = manual('active', false);
  let r = decideSquad(s); const trace = [r];
  for (let i = 0; i < 30; i++) { s = next(s); s.lancemates[0].manual = unit().manual;
    s.lancemates[0].manual.revision = 1; r = decideSquad(s, r.state); noInitiative(r); }
  trace.push(r); return trace;
});
test('IR14', 'Release of superseded order cannot release the current human order', () => {
  const a = fixture(); a.lancemates[0].manual = manual();
  const b = next(a); b.lancemates[0].manual = manual('active', true, 2, 'human2');
  const c = next(b); c.lancemates[0].manual = manual('released', true, 3, 'human1');
  const trace = runSequence([a, b, c]); noInitiative(trace[2]); return trace;
});
test('IR15', 'Human possession and return do not erase a persistent order', () => {
  const a = fixture(); a.lancemates[0].manual = manual();
  const b = next(a); b.lancemates[0].aiOwned = false;
  const c = next(b); c.lancemates[0].aiOwned = true; c.lancemates[0].manual = unit().manual;
  c.lancemates[0].manual.revision = 1; const d = next(c);
  const trace = runSequence([a, b, c, d]); trace.forEach(r => noInitiative(r)); return trace;
});
test('IR16', 'A human order observed during binding change remains held afterward', () => {
  const a = fixture(); const b = next(a); b.lancemates[0].generation = 2;
  b.lancemates[0].pawnId = 'replacement'; b.lancemates[0].manual = manual();
  const c = next(b); c.lancemates[0].manual = unit().manual; c.lancemates[0].manual.revision = 1;
  const trace = runSequence([a, b, c]); noInitiative(trace[2]); return trace;
});
test('IR17', 'An observed human order during global pause is not silently forgotten', () => {
  const a = fixture(); const b = next(a); b.phase = 'paused'; b.lancemates[0].manual = manual();
  const c = next(b); c.phase = 'active'; c.lancemates[0].manual = unit().manual;
  c.lancemates[0].manual.revision = 1; const trace = runSequence([a, b, c]); noInitiative(trace[2]); return trace;
});
test('IR18', 'Repeated sequence returns only defer and retains human hold', () => {
  const a = fixture(); a.lancemates[0].manual = manual();
  const initial = decideSquad(a); const b = copy(a); b.lancemates[0].manual = manual('released');
  const r = decideSquad(b, initial.state); allDefer(r);
  assert.equal(r.state.actors.alpha.heldHumanOrder.id, 'human1'); return [initial, r];
});
test('IR19', 'A candidate outside the declared weapon envelope cannot repair range', () => {
  const s = fixture(); s.lancemates[0].engagements = [];
  s.lancemates[0].positions = [{ ...position(), distanceToTargetM: 50 }];
  const r = decideSquad(s); noInitiative(r); return [r];
});
test('IR20', 'Unavailable reposition capability forbids an otherwise useful destination', () => {
  const s = fixture(); s.lancemates[0].engagements = []; s.lancemates[0].positions = [position()];
  s.lancemates[0].capabilities = ['focus']; const r = decideSquad(s); noInitiative(r); return [r];
});
test('IR21', 'Safer retreat still requires explicit path and occupancy evidence', () => {
  const s = fixture(); const a = s.lancemates[0]; a.healthFraction = 0.1; a.safeRegroupKnown = false;
  a.positions = [{ ...position(), pathFeasible: null }, { ...position('point2'), occupied: null }];
  const r = decideSquad(s); noInitiative(r); return [r];
});
test('IR22', 'Three members reserve distinct supplied positions in deterministic order', () => {
  const s = fixture(); s.lancemates = [unit('charlie', 3), unit('alpha', 1), unit('bravo', 2)];
  s.lancemates.forEach(a => { a.engagements = []; a.positions = [position(), position('point2'), position('point3')]; });
  const r = decideSquad(s); const chosen = r.recommendations.filter(r => r.action === 'REPOSITION').map(r => r.positionId);
  assert.equal(chosen.length, 3); assert.equal(new Set(chosen).size, 3);
  s.lancemates.reverse(); s.lancemates.forEach(a => a.positions.reverse());
  assert.deepEqual(decideSquad(s).recommendations, r.recommendations); return [r];
});
test('IR23', 'Hidden enemy tactical attributes cannot influence visible opportunities', () => {
  const s = fixture(); const expected = decideSquad(s).recommendations;
  for (const threat of [null, 0, 1, 999999]) { const x = copy(s);
    x.targets.push({ id: 'hidden', knownToLance: false, visibleToLance: false,
      allegiance: 'hostile', alive: true, observedAtMs: x.nowMs, threat });
    x.lancemates[0].engagements.push({ targetId: 'hidden', distanceM: 200, lineOfFireKnownClear: true });
    x.lancemates[0].positions.push({ ...position(), targetId: 'hidden' });
    assert.deepEqual(decideSquad(x).recommendations, expected); }
  return [decideSquad(s)];
});
test('IR24', 'Input and own returned state stay immutable and deterministic', () => {
  const s = fixture(); const prior = decideSquad(s).state; const n = next(s);
  const before = JSON.stringify({ n, prior }); const r = decideSquad(n, prior);
  assert.equal(JSON.stringify({ n, prior }), before); assert.deepEqual(decideSquad(n, prior), r); return [r];
});
test('IR25', 'Ambiguous target IDs fail closed even if only one record is visible', () => {
  const s = fixture(); s.targets.push({ ...s.targets[0], knownToLance: false });
  const r = decideSquad(s); allDefer(r); return [r];
});
test('IR26', 'Persistent order explicitly released permits useful initiative again', () => {
  const a = fixture(); a.lancemates[0].manual = manual();
  const b = next(a); b.lancemates[0].manual = manual('released', true, 2);
  const trace = runSequence([a, b]); assert.equal(trace[1].recommendations[0].action, 'FOCUS'); return trace;
});
test('IR27', 'Reserved JavaScript property identifiers cannot become control identities', () => {
  const traces = [];
  for (const bad of ['__proto__', 'constructor', 'prototype']) {
    for (const field of ['id', 'pawnId', 'controllerId']) {
      const s = fixture(); s.lancemates[0][field] = bad; const r = decideSquad(s);
      allDefer(r); traces.push(r);
    }
  }
  return traces;
});
test('IR28', 'Freshness limit is explicit and cannot expand with repeated frames', () => {
  const s = fixture(); s.nowMs += 1000; const r = decideSquad(s);
  assert.equal(r.recommendations[0].action, 'FOCUS');
  const expired = copy(s); expired.nowMs++; expired.sequence++;
  const q = decideSquad(expired, r.state); allDefer(q); return [r, q];
});
test('IR29', 'A valid human order remains held after an unrelated bad target inventory', () => {
  const a = fixture(); const b = next(a); b.targets.push(copy(b.targets[0]));
  b.lancemates[0].manual = manual(); const c = next(b); c.targets.pop();
  c.lancemates[0].manual = unit().manual; c.lancemates[0].manual.revision = 1;
  const trace = runSequence([a, b, c]); allDefer(trace[1]); noInitiative(trace[2]); return trace;
});
test('IR30', 'Human hold survives temporary loss of world control authority', () => {
  const a = fixture(); const b = next(a); b.authority = null; b.lancemates[0].manual = manual();
  const c = next(b); c.authority = true; c.lancemates[0].manual = unit().manual;
  c.lancemates[0].manual.revision = 1; const trace = runSequence([a, b, c]);
  allDefer(trace[1]); noInitiative(trace[2]); return trace;
});
test('IR31', 'Retained history never creates a recommendation for an absent member', () => {
  const a = fixture(); a.lancemates.push(unit('bravo', 2)); a.lancemates[0].manual = manual();
  const b = next(a); b.lancemates.shift(); const trace = runSequence([a, b]);
  assert.deepEqual(trace[1].recommendations.map(r => r.actorId), ['bravo']);
  assert.equal(trace[1].state.actors.alpha.heldHumanOrder.id, 'human1'); return trace;
});

const results = [];
for (const t of tests) {
  try { const traces = t.run();
    for (const r of traces) { assert.equal(r.classification, 'MOCK_ONLY');
      assert(r.recommendations.every(x => x.dispatchable === false && x.evidence.length > 0)); }
    results.push({ id: t.id, purpose: t.purpose, status: 'PASS' });
  } catch (e) { results.push({ id: t.id, purpose: t.purpose, status: 'FAIL', error: e.message }); }
}
const failures = results.filter(r => r.status === 'FAIL');
const hash = file => createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex');
const report = `# Independent tactical-policy review\n\n` +
  `Classification: **MOCK_ONLY**. Gameplay/native control: **NOT_PERFORMED**. Generated ${new Date().toISOString()}.\n\n` +
  `Result: **${failures.length ? 'FAIL — counterexamples require correction' : 'PASS — reviewed synthetic constraints hold'}**; ${results.length - failures.length}/${results.length} independent adversarial cases pass.\n\n` +
  `The [initial review](TACTICAL_INDEPENDENT_REVIEW_BEFORE_FIX.md) preserved ten failing counterexamples. Root corrected identity ambiguity, persistent-order downgrade, loss of holds across absent/binding/paused frames, and favorable selection from contradictory engagement/candidate observations. The reviewer inspected those corrections and reran the original cases plus follow-up boundary cases; passing results below apply only to the recorded final hash.\n\n` +
  `The reviewer separately specified fixtures from the human-precedence, identity, knowledge and feasibility requirements in design/OFFLINE_TACTICAL_PROTOTYPE.md and the approved plan. The existing 48-case suite was read for coverage gaps; its fixtures and expected branches were not imported. Tests execute only the project-owned pure Node policy. No MW5 processes, native calls, listeners or paid APIs are used.\n\n` +
  `These tests check forbidden initiative, order continuity, freshness, ambiguity, explicit geometry evidence, complementary reservations and determinism. They do not model weapon damage, establish real telemetry quality or prove better tactical play. Previous-state inputs are the policy's own returned state.\n\n` +
  `| Artifact | SHA-256 |\n|---|---|\n` + ['scripts/tactical-policy.mjs', 'scripts/Review-TacticalPolicy.mjs', 'design/OFFLINE_TACTICAL_PROTOTYPE.md']
    .map(f => `| ${f} | ${hash(f)} |`).join('\n') + '\n\n' +
  `| Case | Requirement | Result |\n|---|---|---|\n` + results.map(r => `| ${r.id} | ${r.purpose} | ${r.status} |`).join('\n') + '\n\n' +
  (failures.length ? `## Failing counterexamples\n\n` + failures.map(r => `- **${r.id}:** ${r.purpose}. ${r.error.replace(/\n/g, ' ')}`).join('\n') + '\n\n' : '') +
  `## Review limits and reproducibility\n\nRun with the existing Node runtime: \`node scripts/Review-TacticalPolicy.mjs\`. Exit code is 1 on any failed assertion. This file records the latest verified policy hash; a later policy edit requires rerunning it.\n\n` +
  `Native visibility uses a two-second-history predicate in the source; this prototype instead stipulates current friendly visibility and clear-fire evidence. Candidate positions are supplied, not generated. The policy emits recommendations with dispatchable:false. Independent source review must still validate the evidence index; the policy checks cannot establish those game semantics.\n`;
fs.writeFileSync(path.join(root, 'research/TACTICAL_INDEPENDENT_REVIEW.md'), report);
console.log(JSON.stringify({ classification: 'MOCK_ONLY', total: results.length,
  passed: results.length - failures.length, failed: failures }, null, 2));
process.exitCode = failures.length ? 1 : 0;
