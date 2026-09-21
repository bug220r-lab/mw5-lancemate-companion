// Independent synthetic mutation review. No game, save, network or persistence access.
// Run: node scripts/Review-MemoryContract.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import {
  createMemoryState, applyMemoryOperation, projectMemory, runMemoryFixtures, MemoryContractError,
} from './Exercise-MemoryContract.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixturePath = path.join(root, 'synthetic/memory-branch-cases.json');
const modelPath = path.join(root, 'scripts/Exercise-MemoryContract.mjs');
const fixtureBytes = fs.readFileSync(fixturePath);
const fixture = JSON.parse(fixtureBytes.toString('utf8').replace(/^\uFEFF/, ''));
const clone = (value) => structuredClone(value);
const sha = (value) => createHash('sha256').update(value).digest('hex');
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const tests = [];
let checks;
function check(name, actual, expected) {
  checks.push({ name, actual, expected, met: same(actual, expected) });
}
function review(id, title, body) {
  checks = [];
  try {
    body();
    tests.push({ id, title, result: checks.length && checks.every(c => c.met) ? 'EXPECTATIONS_MET' : 'EXPECTATIONS_NOT_MET', checks });
  } catch (error) {
    tests.push({ id, title, result: 'UNEXPECTED_ERROR', checks, error: { name: error.name, code: error.code ?? null, message: error.message } });
  }
}
const example = (id) => fixture.cases.find(c => c.case_id === id);
const initial = (id = 'MEM-01', f = fixture) => createMemoryState(clone(f), clone(example(id).initial_state));
const ingest = (state, record) => applyMemoryOperation(state, { step_id: 'review-input', operation: 'INGEST_PROPOSED_RECORD', record: clone(record) });
const entry = (state, record) => state.records.find(e => e.record.record_id === record.record_id);
function rejection(state, record) {
  check('input retained as rejected', entry(state, record)?.status, 'REJECTED');
  check('rejection reason recorded', (entry(state, record)?.reasons.length ?? 0) > 0, true);
  check('no observed victories', projectMemory(state).victory_count, 0);
}

review('MEM-ADV-01', 'A user source cannot impersonate the stipulated observer', () => {
  const record = clone(example('MEM-01').steps[0].record);
  record.provenance.source_ref = 'syn:source:user';
  rejection(ingest(initial(), record), record);
});

review('MEM-ADV-02', 'Event identity cannot name a different campaign', () => {
  const record = clone(example('MEM-01').steps[0].record);
  record.event_identity.campaign_ref = 'syn:campaign:other';
  rejection(ingest(initial(), record), record);
});

review('MEM-ADV-03', 'Event identity cannot name a different branch', () => {
  const record = clone(example('MEM-01').steps[0].record);
  record.event_identity.branch_ref = 'syn:branch:other';
  rejection(ingest(initial(), record), record);
});

review('MEM-ADV-04', 'Binding proposal cannot change the tuple supported by its evidence', () => {
  const c = example('MEM-08');
  let state = applyMemoryOperation(initial('MEM-08'), clone(c.steps[0]));
  const originalBinding = clone(state.bindings.find(b => b.actor_ref === c.steps[1].old_actor_ref));
  check('supported old binding exists before rejection', !!originalBinding, true);
  const proposal = clone(c.steps[1]);
  proposal.new_generation = 99;
  state = applyMemoryOperation(state, proposal);
  check('tuple mismatch rejected', state.audit.some(a => a.type === 'operation_rejected' && a.operation === proposal.operation), true);
  check('unsupported generation not recorded', state.bindings.some(b => b.generation === 99), false);
  check('rejected proposal preserves the old binding', same(state.bindings.find(b => b.actor_ref === proposal.old_actor_ref), originalBinding), true);
  check('memory grants no authority', state.bindings.every(b => b.authority === 'NONE'), true);
});

review('MEM-ADV-05', 'A reload cannot reuse identity evidence from the excluded future', () => {
  const c = example('MEM-08');
  let state = applyMemoryOperation(initial('MEM-08'), clone(c.steps[0]));
  state = applyMemoryOperation(state, { operation: 'LOAD_SIGNAL', next_session_epoch: 'syn:session:review-reload', loaded_checkpoint_identity: 'syn:checkpoint:baseline' });
  state = applyMemoryOperation(state, { operation: 'RESOLVE_LINEAGE', basis: 'STIPULATED_FIXTURE_CHECKPOINT', checkpoint_ref: 'syn:checkpoint:baseline', new_branch_ref: 'syn:branch:review-reload', parent_branch_ref: 'syn:branch:main' });
  state = applyMemoryOperation(state, clone(c.steps[1]));
  check('replacement rejected', state.audit.some(a => a.type === 'operation_rejected' && a.operation === 'PROPOSE_BINDING_REPLACEMENT'), true);
  const priorBindings = state.bindings.filter(b => b.actor_ref === c.steps[1].old_actor_ref);
  check('old binding remains recorded for review', priorBindings.length > 0, true);
  check('old binding remains revoked', priorBindings.every(b => b.status === 'REVOKED'), true);
  check('excluded identity is not visible', projectMemory(state).visible_record_refs.includes(c.steps[0].record.record_id), false);
  check('memory grants no authority', state.bindings.every(b => b.authority === 'NONE'), true);
});

review('MEM-ADV-06', 'Nested branch views respect every ancestor cutoff', () => {
  const f = clone(fixture);
  const parentWin = clone(example('MEM-03').steps[0].record);
  const parentDeath = clone(example('MEM-03').steps[1].record);
  const firstCheckpoint = clone(f.checkpoint_catalog[0]);
  firstCheckpoint.checkpoint_ref = 'syn:checkpoint:review-parent';
  firstCheckpoint.journal_cutoff = 1;
  firstCheckpoint.visible_record_refs = ['syn:record:baseline', parentWin.record_id];
  const secondCheckpoint = clone(firstCheckpoint);
  secondCheckpoint.checkpoint_ref = 'syn:checkpoint:review-child';
  secondCheckpoint.branch_ref = 'syn:branch:review-child';
  secondCheckpoint.journal_cutoff = 2;
  f.checkpoint_catalog.push(firstCheckpoint, secondCheckpoint);
  let state = initial('MEM-03', f);
  state = ingest(state, parentWin);
  state = ingest(state, parentDeath);
  state = applyMemoryOperation(state, { operation: 'LOAD_SIGNAL', next_session_epoch: 'syn:session:review-child', loaded_checkpoint_identity: firstCheckpoint.checkpoint_ref });
  state = applyMemoryOperation(state, { operation: 'RESOLVE_LINEAGE', basis: 'STIPULATED_FIXTURE_CHECKPOINT', checkpoint_ref: firstCheckpoint.checkpoint_ref, new_branch_ref: 'syn:branch:review-child', parent_branch_ref: 'syn:branch:main' });
  const childWin = clone(parentWin);
  childWin.record_id = 'syn:record:review-child-win';
  childWin.branch_ref = 'syn:branch:review-child';
  childWin.event_identity.branch_ref = childWin.branch_ref;
  childWin.event_identity.value = 'syn:event:review-child-win';
  childWin.session_epoch = 'syn:session:review-child';
  childWin.journal_sequence = 3;
  state = ingest(state, childWin);
  state = applyMemoryOperation(state, { operation: 'LOAD_SIGNAL', next_session_epoch: 'syn:session:review-grandchild', loaded_checkpoint_identity: secondCheckpoint.checkpoint_ref });
  state = applyMemoryOperation(state, { operation: 'RESOLVE_LINEAGE', basis: 'STIPULATED_FIXTURE_CHECKPOINT', checkpoint_ref: secondCheckpoint.checkpoint_ref, new_branch_ref: 'syn:branch:review-grandchild', parent_branch_ref: 'syn:branch:review-child' });
  const view = projectMemory(state);
  check('grandchild selected', state.active_branch_ref, 'syn:branch:review-grandchild');
  check('eligible ancestor victory visible', view.visible_record_refs.includes(parentWin.record_id), true);
  check('future parent death excluded', view.visible_record_refs.includes(parentDeath.record_id), false);
  check('future child victory excluded', view.visible_record_refs.includes(childWin.record_id), false);
  check('only one eligible victory counted', view.victory_count, 1);
  check('all originals retained in journal', [parentWin, parentDeath, childWin].every(r => entry(state, r)), true);
});

review('MEM-ADV-07', 'Accurate citations cannot make invented summary prose an observation', () => {
  const record = clone(example('MEM-11').steps.at(-1).record);
  record.record_id = 'syn:record:review-unsupported-prose';
  record.branch_ref = 'syn:branch:main';
  record.session_epoch = 'syn:session:alpha';
  record.journal_sequence = 1;
  record.provenance.source_record_refs = ['syn:record:baseline'];
  record.claims = [{ subject_ref: 'syn:pilot:comet', predicate: 'summary.fact', value: 'Comet single-handedly won twelve missions.', source_record_refs: ['syn:record:baseline'], source_categories: ['VERIFIED_SYNTHETIC_OBSERVATION'] }];
  const state = ingest(initial(), record);
  const view = projectMemory(state);
  check('no fabricated victories counted', view.victory_count, 0);
  check('category stays derived', entry(state, record).record.evidence_category, 'DERIVED_SUMMARY');
  check('invented text absent from factual claims', JSON.stringify(view.factual_claims).includes('single-handedly'), false);
});

review('MEM-ADV-08', 'Unsupported operations raise the deliberate guard error', () => {
  const before = initial();
  const original = JSON.stringify(before);
  let code = null;
  let deliberateGuard = false;
  try { applyMemoryOperation(before, { operation: 'WRITE_REAL_SAVE', path: 'untrusted data' }); }
  catch (error) { code = error.code; deliberateGuard = error instanceof MemoryContractError; }
  check('typed guard, not arbitrary failure', deliberateGuard, true);
  check('unsupported operation rejected explicitly', code, 'UNSUPPORTED_OPERATION');
  check('input state unchanged', JSON.stringify(before) === original, true);
});

review('MEM-ADV-09', 'Object-key order does not turn an identical event into a conflict', () => {
  const c = example('MEM-05');
  const before = initial('MEM-05');
  const originalState = JSON.stringify(before);
  const first = clone(c.steps[0].record);
  const duplicate = clone(c.steps[1].record);
  duplicate.claims[0].value = Object.fromEntries(Object.entries(duplicate.claims[0].value).reverse());
  const firstOperation = { operation: 'INGEST_PROPOSED_RECORD', record: first };
  const duplicateOperation = { operation: 'INGEST_PROPOSED_RECORD', record: duplicate };
  const originalOperations = JSON.stringify([firstOperation, duplicateOperation]);
  let state = applyMemoryOperation(before, firstOperation);
  state = applyMemoryOperation(state, duplicateOperation);
  check('one agreed source event counted once', projectMemory(state).victory_count, 1);
  check('duplicate ingestion accepted and retained', entry(state, duplicate)?.status, 'ACCEPTED');
  check('delivery linked to original source event', projectMemory(state).duplicate_links.some(link => link.duplicate_record_ref === duplicate.record_id && link.original_record_ref === first.record_id), true);
  check('no conflict created', projectMemory(state).conflicts.length, 0);
  check('entire actual operation inputs unchanged', JSON.stringify([firstOperation, duplicateOperation]) === originalOperations, true);
  check('prior state remains unchanged', JSON.stringify(before) === originalState, true);
});

review('MEM-ADV-10', 'A correction cannot resolve a conflict by citing an unrelated record', () => {
  const c = example('MEM-10');
  let state = initial('MEM-10');
  for (const step of c.steps.slice(0, 3)) state = applyMemoryOperation(state, clone(step));
  const correction = clone(c.steps[3].record);
  correction.claims[0].value.correction_of = 'syn:record:baseline';
  correction.provenance.source_record_refs = ['syn:record:baseline', c.steps[1].record.record_id];
  state = ingest(state, correction);
  check('unrelated correction rejected', entry(state, correction)?.status, 'REJECTED');
  check('disputed aggregate still unknown', projectMemory(state).victory_count, null);
  check('both conflicting originals retained', c.steps.slice(0, 2).every(s => !!entry(state, s.record)), true);
});

review('MEM-ADV-11', 'Stale occupant identity cannot be stamped into the current session', () => {
  const before = initial('MEM-09');
  const bindings = JSON.stringify(before.bindings);
  const record = clone(example('MEM-09').steps[0].record);
  record.session_epoch = 'syn:session:expired';
  const state = ingest(before, record);
  check('stale identity rejected', entry(state, record)?.status, 'REJECTED');
  check('binding evidence left unchanged', JSON.stringify(state.bindings) === bindings, true);
  check('stale actor not adopted', state.bindings.some(b => b.actor_ref === record.entity_refs.session_actor_ref), false);
});

review('MEM-ADV-12', 'Provisional conversation cannot accept continuing-history observation facts', () => {
  const c = example('MEM-04');
  let state = initial('MEM-04');
  for (const step of c.steps) state = applyMemoryOperation(state, clone(step));
  const record = clone(example('MEM-01').steps[0].record);
  record.record_id = 'syn:record:review-provisional-win';
  record.branch_ref = state.active_branch_ref;
  record.event_identity.branch_ref = state.active_branch_ref;
  record.session_epoch = state.session_epoch;
  record.journal_sequence = 3;
  state = ingest(state, record);
  check('still conversation-only', state.memory_commit_mode, 'ALLOW_PROVISIONAL_CONVERSATION_ONLY');
  check('continuing-history assertion quarantined', entry(state, record)?.status, 'QUARANTINED');
  check('not a visible factual record', projectMemory(state).factual_record_refs.includes(record.record_id), false);
  check('outcome total remains unknown', projectMemory(state).victory_count, null);
});

review('MEM-ADV-13', 'Changing the expected answer cannot change the model result to match', () => {
  const f = clone(fixture);
  f.cases = [clone(example('MEM-01'))];
  f.cases[0].expected.victory_count = 999;
  const report = runMemoryFixtures(f);
  const assertion = report.results[0].assertions.find(a => a.field === 'victory_count');
  check('deliberately wrong oracle fails', report.result, 'EXPECTATIONS_NOT_MET');
  check('actual remains derived from inputs', assertion.actual, 1);
  check('mismatch is specifically detected', assertion.status, 'NOT_MET');
});

review('MEM-ADV-14', 'A bad reload epoch still invalidates the old memory view and binding', () => {
  for (const epoch of ['syn:session:alpha', null]) {
    const before = initial();
    const state = applyMemoryOperation(before, { operation: 'LOAD_SIGNAL', next_session_epoch: epoch, loaded_checkpoint_identity: 'syn:checkpoint:baseline' });
    const label = epoch === null ? 'missing epoch' : 'reused epoch';
    check(`${label}: commits suspended`, state.memory_commit_mode, 'SUSPEND');
    check(`${label}: prior active view unavailable`, state.active_branch_ref, null);
    check(`${label}: no factual output from old view`, projectMemory(state).factual_claims.length, 0);
    check(`${label}: prior binding retained and revoked`, state.bindings.length > 0 && state.bindings.every(b => b.status === 'REVOKED'), true);
    check(`${label}: invalid epoch recorded`, state.audit.some(a => a.type === 'operation_rejected' && a.operation === 'LOAD_SIGNAL'), true);
    const attemptedRecovery = applyMemoryOperation(state, { operation: 'RESOLVE_LINEAGE', basis: 'STIPULATED_FIXTURE_CHECKPOINT', checkpoint_ref: 'syn:checkpoint:baseline', new_branch_ref: 'syn:branch:review-bad-epoch', parent_branch_ref: 'syn:branch:main' });
    check(`${label}: checkpoint alone cannot reenable continuity`, attemptedRecovery.memory_commit_mode, 'SUSPEND');
    const freshLoad = applyMemoryOperation(attemptedRecovery, { operation: 'LOAD_SIGNAL', next_session_epoch: 'syn:session:review-valid-recovery', loaded_checkpoint_identity: 'syn:checkpoint:baseline' });
    const recovered = applyMemoryOperation(freshLoad, { operation: 'RESOLVE_LINEAGE', basis: 'STIPULATED_FIXTURE_CHECKPOINT', checkpoint_ref: 'syn:checkpoint:baseline', new_branch_ref: 'syn:branch:review-valid-recovery', parent_branch_ref: 'syn:branch:main' });
    check(`${label}: a fresh valid load can recover`, recovered.memory_commit_mode, 'ALLOW_BRANCH_LOCAL');
    check(`${label}: recovery still grants no control`, recovered.bindings.length > 0 && recovered.bindings.every(b => b.status === 'REVOKED' && b.authority === 'NONE'), true);
  }
});

const report = {
  schema_version: 1,
  evidence_class: 'MOCK_ONLY',
  evaluator: 'Independent root-agent mutation checks against the subagent-authored research model',
  observed_at: new Date().toISOString(),
  result: tests.every(t => t.result === 'EXPECTATIONS_MET') ? 'EXPECTATIONS_MET' : 'EXPECTATIONS_NOT_MET',
  case_count: tests.length,
  expectations_met: tests.filter(t => t.result === 'EXPECTATIONS_MET').length,
  inputs: { fixture_sha256: sha(fixtureBytes), model_sha256: sha(fs.readFileSync(modelPath)), review_script_sha256: sha(fs.readFileSync(fileURLToPath(import.meta.url))) },
  limits: ['All inputs are synthetic mutations; no native identifiers or state are validated.', 'This is the same model system with independently authored checks, not human acceptance or formal verification.', 'Summary prose entailment, durable storage, real reload detection, audio and game integration are NOT_PERFORMED.', 'The only filesystem writes are this research report; no exports, deletions, tombstones or game actions occur.'],
  native_calls: 0,
  tests,
};
const reportPath = path.join(root, 'research/OFFLINE_MEMORY_REVIEW.json');
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ result: report.result, cases: report.case_count, met: report.expectations_met, report: reportPath }));
process.exitCode = report.result === 'EXPECTATIONS_MET' ? 0 : 1;
