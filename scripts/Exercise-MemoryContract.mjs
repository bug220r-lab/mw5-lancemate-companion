// Pure, bounded research replay. All identifiers and observations are synthetic.
// Only main() reads project fixture/source and writes the research report.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const OBS = 'VERIFIED_SYNTHETIC_OBSERVATION';
const sourceKinds = { [OBS]: 'STIPULATED_SYNTHETIC_OBSERVER', USER_REPORT: 'INVENTED_USER_REPORT',
  ROLEPLAY: 'INVENTED_ROLEPLAY', DERIVED_SUMMARY: 'PROPOSED_DERIVATION' };
const predicates = new Set(['mission.outcome', 'pilot.display_name', 'pilot.life_state', 'pilot.credit_claim',
  'personality.fiction', 'branch.user_selection', 'pilot.identity_link', 'summary.fact', 'privacy.user_request']);
const object = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const ref = (v) => typeof v === 'string' && /^syn:[A-Za-z0-9:_-]{1,160}$/.test(v);
const integer = (v) => Number.isSafeInteger(v) && v >= 0;
const copy = (v) => structuredClone(v);
const unique = (values) => [...new Set(values)];
const canonical = (v) => JSON.stringify(v, (_, value) => object(value)
  ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, value[key]])) : value);
const same = (a, b) => canonical(a) === canonical(b);
const only = (values) => values.length === 1 ? values[0] : null;
const claims = (entry, predicate) => entry.record.claims.filter((claim) => claim.predicate === predicate);
const eventKey = (record) => record.event_identity === null ? null : canonical([
  record.event_identity.namespace, record.event_identity.campaign_ref,
  record.event_identity.branch_ref, record.event_identity.value]);

export class MemoryContractError extends Error {
  constructor(code) { super(code); this.name = 'MemoryContractError'; this.code = code; }
}

function audit(state, type, fields = {}) { state.audit.push({ type, ...copy(fields) }); }
function rejectOperation(state, step, reason) {
  audit(state, 'operation_rejected', { operation: step.operation, reason });
  return state;
}
function entryFor(state, id) { return state.records.find((entry) => entry.record.record_id === id); }
function revokeBindings(state, predicate = () => true) {
  for (const binding of state.bindings) {
    if (binding.status !== 'REVOKED' && predicate(binding)) binding.status = 'REVOKED';
  }
  state.control_rearm_required = true;
}

function recordProblems(state, record) {
  if (!object(record) || !state.record_contract.required.every((key) => Object.hasOwn(record, key))) return ['INVALID_RECORD'];
  const problems = [];
  if (!ref(record.record_id) || !integer(record.journal_sequence) || !ref(record.session_epoch) ||
    !state.record_contract.record_kinds.includes(record.record_kind) ||
    !Object.hasOwn(sourceKinds, record.evidence_category) || !Array.isArray(record.claims) || record.claims.length === 0 ||
    !record.claims.every((claim) => object(claim) && ref(claim.subject_ref) && predicates.has(claim.predicate) && Object.hasOwn(claim, 'value')) ||
    !object(record.entity_refs) || !object(record.provenance)) return ['INVALID_RECORD'];
  if (record.campaign_ref !== state.campaign_ref) problems.push('CAMPAIGN_MISMATCH');
  const branch = state.branches.find((item) => item.branch_ref === record.branch_ref);
  if (record.branch_ref !== null && (!branch || branch.campaign_ref !== record.campaign_ref)) problems.push('UNKNOWN_OR_WRONG_BRANCH');
  if (record.entity_refs.game_pilot_id !== null) problems.push('REAL_GAME_ID_NOT_ALLOWED');
  const source = state.sources.find((item) => item.source_ref === record.provenance.source_ref);
  if (!source || source.kind !== sourceKinds[record.evidence_category] ||
    record.provenance.data_scope !== 'SYNTHETIC_FIXTURE' ||
    record.provenance.verification_basis !== (record.evidence_category === OBS ? 'STIPULATED_SYNTHETIC_INPUT' : 'NOT_OBSERVATION')) problems.push('SOURCE_CATEGORY_MISMATCH');
  if (!Array.isArray(record.provenance.source_record_refs)) problems.push('INVALID_PROVENANCE');
  if ((record.record_kind === 'SUMMARY') !== (record.evidence_category === 'DERIVED_SUMMARY')) problems.push('RECORD_CATEGORY_MISMATCH');
  if (record.event_identity !== null) {
    const event = record.event_identity;
    if (!object(event) || !ref(event.namespace) || !ref(event.value) ||
      event.campaign_ref !== record.campaign_ref || event.branch_ref !== record.branch_ref) problems.push('EVENT_SCOPE_MISMATCH');
  }
  return unique(problems);
}

// A checkpoint is a stipulated explicit record set AND cutoff, not a save inference.
function scopeRefs(state, branchRef, cutoff = Infinity, trail = []) {
  if (trail.includes(branchRef)) throw new MemoryContractError('BRANCH_CYCLE');
  const branch = state.branches.find((item) => item.branch_ref === branchRef);
  if (!branch || branch.campaign_ref !== state.campaign_ref) return [];
  let ancestors = [];
  if (branch.parent_branch_ref !== null) {
    const checkpoint = state.checkpoints.find((item) => item.checkpoint_ref === branch.fork_checkpoint_ref);
    if (!checkpoint || checkpoint.branch_ref !== branch.parent_branch_ref || !integer(checkpoint.journal_cutoff)) return [];
    const eligible = new Set(scopeRefs(state, branch.parent_branch_ref, Math.min(cutoff, checkpoint.journal_cutoff), [...trail, branchRef]));
    ancestors = checkpoint.visible_record_refs.filter((id) => eligible.has(id));
  }
  const own = state.records.filter((entry) => entry.record.branch_ref === branchRef &&
    entry.record.campaign_ref === state.campaign_ref && entry.record.journal_sequence <= cutoff).map((entry) => entry.record.record_id);
  return unique([...ancestors, ...own]);
}

export function projectMemory(state, branchRef = state.active_branch_ref) {
  const scope = new Set(scopeRefs(state, branchRef));
  const entries = state.records.filter((entry) => scope.has(entry.record.record_id));
  const accepted = entries.filter((entry) => entry.status === 'ACCEPTED');
  const observations = accepted.filter((entry) => entry.record.evidence_category === OBS);
  const groups = new Map();
  for (const entry of observations.filter((item) => !item.resolution)) {
    const key = eventKey(entry.record) ?? `record:${entry.record.record_id}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(entry);
  }
  const corrections = observations.filter((entry) => entry.resolution &&
    scope.has(entry.resolution.corrected_ref) && scope.has(entry.resolution.confirmed_ref));
  const superseded = new Set(corrections.map((entry) => entry.resolution.corrected_ref));
  const factual = [], conflicts = [], duplicateLinks = [];
  for (const members of groups.values()) {
    const live = members.filter((entry) => !superseded.has(entry.record.record_id));
    if (live.length === 0) continue;
    const payloads = new Set(live.map((entry) => canonical([entry.record.provenance.source_ref,
      entry.record.record_kind, entry.record.entity_refs, entry.record.claims])));
    if (payloads.size > 1) { conflicts.push(live.map((entry) => entry.record.record_id)); continue; }
    factual.push(live[0]);
    for (const duplicate of live.slice(1)) duplicateLinks.push({ duplicate_record_ref: duplicate.record.record_id, original_record_ref: live[0].record.record_id });
  }
  const conflictRefs = new Set(conflicts.flat());
  const duplicateRefs = new Set(duplicateLinks.map((link) => link.duplicate_record_ref));
  const facts = factual.flatMap((entry) => entry.record.claims.map((claim) => ({ ...copy(claim), record_ref: entry.record.record_id,
    evidence_category: OBS, branch_ref: entry.record.branch_ref })));
  const quarantine = entries.filter((entry) => entry.status === 'QUARANTINED');
  const branch = state.branches.find((item) => item.branch_ref === branchRef);
  const unknownAggregate = !branch || branch.lineage_basis === 'USER_SELECTED_PROVISIONAL' ||
    (branchRef === state.active_branch_ref && state.memory_commit_mode === 'SUSPEND') ||
    quarantine.some((entry) => claims(entry, 'mission.outcome').length > 0) ||
    conflicts.some((ids) => ids.some((id) => claims(entryFor(state, id), 'mission.outcome').length > 0));
  return {
    visible_record_refs: accepted.filter((entry) => !conflictRefs.has(entry.record.record_id) &&
      !duplicateRefs.has(entry.record.record_id) && !superseded.has(entry.record.record_id)).map((entry) => entry.record.record_id),
    factual_claims: facts,
    factual_record_refs: factual.map((entry) => entry.record.record_id),
    attributed_report_refs: accepted.filter((entry) => entry.record.evidence_category === 'USER_REPORT').map((entry) => entry.record.record_id),
    roleplay_refs: accepted.filter((entry) => entry.record.evidence_category === 'ROLEPLAY').map((entry) => entry.record.record_id),
    summary_refs: entries.filter((entry) => entry.status === 'SUMMARY_REFERENCE_ONLY').map((entry) => entry.record.record_id),
    summary_entailment: 'NOT_PERFORMED',
    victory_count: unknownAggregate ? null : facts.filter((claim) => claim.predicate === 'mission.outcome' && claim.value?.outcome === 'VICTORY').length,
    conflicts, duplicate_links: duplicateLinks, quarantined_record_refs: quarantine.map((entry) => entry.record.record_id),
    superseded_claim_refs: [...superseded], corrections: corrections.map((entry) => ({ record_ref: entry.record.record_id, ...copy(entry.resolution) })),
  };
}

function summaryProblems(state, record) {
  const problems = [];
  const refs = record.provenance.source_record_refs;
  if (refs.length === 0) problems.push('MISSING_SUMMARY_SOURCES');
  const eligible = new Set(projectMemory(state).visible_record_refs);
  const scope = new Set(scopeRefs(state, state.active_branch_ref));
  const reaches = (id, target, seen = new Set()) => {
    if (id === target) return true;
    if (seen.has(id)) return false;
    seen.add(id);
    return (entryFor(state, id)?.record.provenance.source_record_refs ?? []).some((next) => reaches(next, target, seen));
  };
  for (const id of refs) {
    if (!entryFor(state, id)) problems.push('MISSING_SOURCE_RECORD');
    if (reaches(id, record.record_id)) problems.push('SUMMARY_CYCLE');
  }
  for (const claim of record.claims) {
    if (!Array.isArray(claim.source_record_refs) || claim.source_record_refs.length === 0 || !Array.isArray(claim.source_categories)) {
      problems.push('MISSING_CLAIM_PROVENANCE'); continue;
    }
    const categories = [];
    for (const id of claim.source_record_refs) {
      const source = entryFor(state, id);
      if (!refs.includes(id)) problems.push('UNDECLARED_SUMMARY_SOURCE');
      if (!scope.has(id)) problems.push('SOURCE_OUTSIDE_BRANCH_CUTOFF');
      else if (!eligible.has(id)) problems.push('SOURCE_NOT_ELIGIBLE');
      if (source) categories.push(source.record.evidence_category);
      else problems.push('MISSING_SOURCE_RECORD');
    }
    if (!same(unique(categories).sort(), unique(claim.source_categories).sort())) problems.push('SOURCE_CATEGORY_MISMATCH');
  }
  return unique(problems);
}

function identityClaim(entry, basis) {
  return entry?.status === 'ACCEPTED' && entry.record.record_kind === 'IDENTITY_ASSERTION' &&
    entry.record.evidence_category === OBS ? claims(entry, 'pilot.identity_link').find((claim) => claim.value?.basis === basis) : undefined;
}
function ingest(state, supplied, initial = false) {
  if (!object(supplied) || !ref(supplied.record_id)) { audit(state, 'record_rejected', { record_ref: supplied?.record_id ?? null, reasons: ['INVALID_RECORD'] }); return; }
  state.original_inputs.push({ record_ref: supplied.record_id, content: canonical(supplied) });
  if (entryFor(state, supplied.record_id)) { audit(state, 'record_rejected', { record_ref: supplied.record_id, reasons: ['RECORD_ID_REUSE'] }); return; }
  const record = copy(supplied);
  const problems = recordProblems(state, record);
  const entry = { record, original: canonical(record), status: 'ACCEPTED', reasons: [] };
  state.records.push(entry);
  if (problems.length > 0) {
    entry.status = 'REJECTED'; entry.reasons = problems;
    audit(state, 'record_rejected', { record_ref: record.record_id, reasons: problems }); return;
  }
  if ((record.record_kind === 'IDENTITY_ASSERTION' || claims(entry, 'pilot.identity_link').length > 0) &&
    record.session_epoch !== state.session_epoch) {
    entry.status = 'REJECTED'; entry.reasons = ['STALE_IDENTITY_SESSION'];
  } else if (!initial && (state.memory_commit_mode === 'SUSPEND' || record.branch_ref === null)) {
    entry.status = record.evidence_category === 'USER_REPORT' ? 'PENDING_REPORT' : 'QUARANTINED';
    entry.reasons = ['UNRESOLVED_LINEAGE'];
  } else if (record.branch_ref !== state.active_branch_ref && !initial) {
    entry.status = 'REJECTED'; entry.reasons = ['INACTIVE_BRANCH'];
  } else if (state.memory_commit_mode === 'ALLOW_PROVISIONAL_CONVERSATION_ONLY' && record.evidence_category === OBS) {
    entry.status = 'QUARANTINED'; entry.reasons = ['PROVISIONAL_LINEAGE_UNVERIFIED'];
  } else if (record.record_kind === 'SUMMARY') {
    entry.reasons = summaryProblems(state, record);
    entry.status = entry.reasons.length > 0 ? 'REJECTED_SUMMARY' : 'SUMMARY_REFERENCE_ONLY';
    entry.semantic_entailment = 'NOT_PERFORMED';
  } else if (record.evidence_category === OBS && claims(entry, 'mission.outcome').length && record.event_identity === null) {
    entry.status = 'QUARANTINED'; entry.reasons = ['POSSIBLE_DUPLICATE_WITHOUT_EVENT_IDENTITY'];
  }
  if (entry.status !== 'ACCEPTED') { audit(state, 'record_classified', { record_ref: record.record_id, status: entry.status, reasons: entry.reasons }); return; }

  const correction = claims(entry, 'mission.outcome').find((claim) => claim.value?.correction_of !== undefined || claim.value?.confirmation_of !== undefined);
  if (correction) {
    const corrected = entryFor(state, correction.value.correction_of), confirmed = entryFor(state, correction.value.confirmation_of);
    const scope = new Set(scopeRefs(state, state.active_branch_ref));
    const other = confirmed && claims(confirmed, 'mission.outcome').find((claim) => claim.subject_ref === correction.subject_ref &&
      claim.value?.mission_label === correction.value.mission_label && claim.value?.outcome === correction.value.outcome);
    if (record.evidence_category !== OBS || !corrected || !confirmed || corrected === confirmed ||
      corrected.status !== 'ACCEPTED' || confirmed.status !== 'ACCEPTED' || corrected.record.evidence_category !== OBS || confirmed.record.evidence_category !== OBS ||
      !scope.has(corrected.record.record_id) || !scope.has(confirmed.record.record_id) ||
      eventKey(corrected.record) === null || eventKey(corrected.record) !== eventKey(confirmed.record) || eventKey(record) === eventKey(corrected.record) ||
      !record.provenance.source_record_refs.includes(corrected.record.record_id) || !record.provenance.source_record_refs.includes(confirmed.record.record_id) || !other) {
      entry.status = 'REJECTED'; entry.reasons = ['INVALID_CORRECTION_EVIDENCE'];
    } else {
      entry.resolution = { corrected_ref: corrected.record.record_id, confirmed_ref: confirmed.record.record_id, outcome: correction.value.outcome };
      audit(state, 'correction_supported', { record_ref: record.record_id, ...entry.resolution });
    }
  }
  const distinct = identityClaim(entry, 'STIPULATED_FIXTURE_DISTINCT_OCCUPANT');
  if (distinct) {
    const entity = record.entity_refs;
    const original = state.pilots.find((pilot) => pilot.pilot_ref === distinct.value.distinct_from);
    const newcomer = state.pilots.find((pilot) => pilot.pilot_ref === distinct.subject_ref);
    if (!original || !newcomer || original.pilot_ref === newcomer.pilot_ref || entity.pilot_ref !== newcomer.pilot_ref ||
      !ref(entity.session_actor_ref) || !integer(entity.binding_generation) || entity.binding_generation < 1) {
      entry.status = 'REJECTED'; entry.reasons = ['INVALID_IDENTITY_EVIDENCE'];
    } else {
      revokeBindings(state, (binding) => binding.slot === entity.lance_slot);
      state.bindings.push({ pilot_ref: entity.pilot_ref, actor_ref: entity.session_actor_ref, slot: entity.lance_slot,
        generation: entity.binding_generation, session_epoch: state.session_epoch, status: 'PROPOSED_REARM_REQUIRED', evidence_ref: record.record_id, authority: 'NONE' });
      audit(state, 'distinct_occupant', { original_pilot_ref: original.pilot_ref, new_pilot_ref: newcomer.pilot_ref,
        basis: distinct.value.basis, record_ref: record.record_id });
    }
  }
  for (const rename of claims(entry, 'pilot.display_name').filter((claim) => object(claim.value) && Object.hasOwn(claim.value, 'current'))) {
    const support = record.provenance.source_record_refs.map((id) => entryFor(state, id)).find((source) => {
      const link = identityClaim(source, 'STIPULATED_FIXTURE_CONTINUITY');
      return link?.subject_ref === rename.subject_ref && link.value.from_local_pilot_ref === rename.subject_ref &&
        link.value.to_local_pilot_ref === rename.subject_ref && projectMemory(state).visible_record_refs.includes(source.record.record_id);
    });
    if (!support || record.evidence_category !== OBS) { entry.status = 'REJECTED'; entry.reasons = ['INVALID_IDENTITY_EVIDENCE']; }
    else audit(state, 'supported_rename', { pilot_ref: rename.subject_ref, current: rename.value.current,
      previous: rename.value.previous, identity_record_ref: support.record.record_id, record_ref: record.record_id });
  }
  const projection = projectMemory(state);
  if (projection.conflicts.length > 0) audit(state, 'conflict_opened', { record_refs: projection.conflicts[0] });
  audit(state, 'record_classified', { record_ref: record.record_id, status: entry.status, reasons: entry.reasons });
}

export function createMemoryState(fixture, initialState) {
  if (!object(fixture) || fixture.data_scope !== 'SYNTHETIC_FIXTURE_ONLY' || !object(initialState) ||
    !Array.isArray(fixture.initial_records) || !object(fixture.record_contract)) throw new MemoryContractError('INVALID_FIXTURE');
  const state = { ...copy(initialState), initial_state: copy(initialState),
    sources: copy(fixture.source_registry), pilots: copy(fixture.pilot_catalog), branches: copy(fixture.branch_catalog),
    checkpoints: copy(fixture.checkpoint_catalog), record_contract: copy(fixture.record_contract),
    records: [], original_inputs: [], initial_refs: [], bindings: [], audit: [], relations: [], plans: [], seen_sessions: [initialState.session_epoch],
    pending_load: null, control_rearm_required: false, commands_or_external_actions: [],
    export_files_written: 0, records_deleted: 0, tombstones_written: 0, external_transmissions: 0 };
  for (const record of fixture.initial_records) {
    ingest(state, record, true); state.initial_refs.push(record.record_id);
    const entity = record.entity_refs;
    if (entryFor(state, record.record_id)?.status === 'ACCEPTED' && record.evidence_category === OBS && ref(entity?.pilot_ref) && ref(entity?.session_actor_ref)) {
      state.bindings.push({ pilot_ref: entity.pilot_ref, actor_ref: entity.session_actor_ref, slot: entity.lance_slot,
        generation: entity.binding_generation, session_epoch: record.session_epoch, status: 'RECORDED', evidence_ref: record.record_id, authority: 'NONE' });
    }
  }
  return state;
}

export function applyMemoryOperation(previous, step) {
  if (!object(step) || typeof step.operation !== 'string') throw new MemoryContractError('INVALID_OPERATION_INPUT');
  const state = copy(previous);
  switch (step.operation) {
    case 'INGEST_PROPOSED_RECORD': ingest(state, step.record); break;
    case 'PROPOSE_RELATION': {
      const from = entryFor(state, step.from_record_ref), to = entryFor(state, step.to_record_ref);
      const visible = new Set(projectMemory(state).visible_record_refs);
      if (step.relation !== 'CORROBORATES' || !from || !to || !visible.has(step.from_record_ref) || !visible.has(step.to_record_ref) ||
        from.record.evidence_category !== OBS || to.record.evidence_category !== 'USER_REPORT' || !same(from.record.claims, to.record.claims)) return rejectOperation(state, step, 'INVALID_CORROBORATION');
      const relation = { kind: step.relation, from: step.from_record_ref, to: step.to_record_ref };
      state.relations.push(relation); audit(state, 'relation_proposed', relation); break;
    }
    case 'LOAD_SIGNAL': {
      const priorBranch = state.active_branch_ref;
      state.active_branch_ref = null; state.memory_commit_mode = 'SUSPEND'; state.lineage_basis = 'UNRESOLVED';
      state.visible_record_refs = []; state.actor_control_authority = 'NONE'; state.pending_load = null;
      revokeBindings(state); audit(state, 'load_suspended', { mode: state.memory_commit_mode });
      if (!ref(step.next_session_epoch) || state.seen_sessions.includes(step.next_session_epoch)) return rejectOperation(state, step, 'INVALID_NEW_SESSION');
      state.seen_sessions.push(step.next_session_epoch); state.session_epoch = step.next_session_epoch;
      state.pending_load = { checkpoint_ref: step.loaded_checkpoint_identity ?? null, prior_branch_ref: priorBranch };
      break;
    }
    case 'RESOLVE_LINEAGE': {
      const checkpoint = state.checkpoints.find((item) => item.checkpoint_ref === step.checkpoint_ref);
      const eligible = checkpoint ? new Set(scopeRefs(state, step.parent_branch_ref, checkpoint.journal_cutoff)) : new Set();
      if (!state.pending_load || state.pending_load.checkpoint_ref !== step.checkpoint_ref ||
        step.basis !== 'STIPULATED_FIXTURE_CHECKPOINT' || checkpoint?.basis !== step.basis ||
        checkpoint.branch_ref !== step.parent_branch_ref || !integer(checkpoint.journal_cutoff) ||
        !checkpoint.visible_record_refs.every((id) => eligible.has(id)) || !ref(step.new_branch_ref) ||
        state.branches.some((branch) => branch.branch_ref === step.new_branch_ref)) return rejectOperation(state, step, 'INVALID_LINEAGE_EVIDENCE');
      state.branches.push({ branch_ref: step.new_branch_ref, campaign_ref: state.campaign_ref, parent_branch_ref: step.parent_branch_ref,
        fork_checkpoint_ref: step.checkpoint_ref, lineage_basis: step.basis });
      state.active_branch_ref = step.new_branch_ref; state.lineage_basis = step.basis; state.memory_commit_mode = 'ALLOW_BRANCH_LOCAL';
      audit(state, 'branch_forked', { branch_ref: step.new_branch_ref, parent_branch_ref: step.parent_branch_ref, checkpoint_ref: step.checkpoint_ref });
      state.pending_load = null; break;
    }
    case 'SELECT_PROVISIONAL_BRANCH': {
      const report = entryFor(state, step.user_report_record_ref);
      if (!state.pending_load || !report || report.record.evidence_category !== 'USER_REPORT' || report.status !== 'PENDING_REPORT' ||
        !claims(report, 'branch.user_selection').length || step.parent_branch_ref !== null || step.fork_checkpoint_ref !== null ||
        !ref(step.new_branch_ref) || state.branches.some((branch) => branch.branch_ref === step.new_branch_ref)) return rejectOperation(state, step, 'INVALID_PROVISIONAL_SELECTION');
      state.branches.push({ branch_ref: step.new_branch_ref, campaign_ref: state.campaign_ref, parent_branch_ref: null,
        fork_checkpoint_ref: null, lineage_basis: 'USER_SELECTED_PROVISIONAL' });
      state.active_branch_ref = step.new_branch_ref; state.lineage_basis = 'USER_SELECTED_PROVISIONAL';
      state.memory_commit_mode = 'ALLOW_PROVISIONAL_CONVERSATION_ONLY'; state.pending_load = null;
      audit(state, 'provisional_selected', { report_ref: report.record.record_id, mode: state.memory_commit_mode }); break;
    }
    case 'PROPOSE_BINDING_REPLACEMENT': {
      const source = entryFor(state, step.identity_record_ref);
      const link = identityClaim(source, 'STIPULATED_FIXTURE_CONTINUITY');
      const entity = source?.record.entity_refs;
      if (!link || !projectMemory(state).visible_record_refs.includes(step.identity_record_ref) ||
        source.record.session_epoch !== state.session_epoch || link.subject_ref !== step.local_pilot_ref ||
        link.value.from_actor !== step.old_actor_ref || link.value.to_actor !== step.new_actor_ref ||
        entity.pilot_ref !== step.local_pilot_ref || entity.session_actor_ref !== step.new_actor_ref ||
        entity.lance_slot !== step.new_slot || entity.binding_generation !== step.new_generation ||
        !integer(step.new_generation) || step.new_generation <= step.old_generation) return rejectOperation(state, step, 'INVALID_IDENTITY_EVIDENCE');
      const binding = state.bindings.find((item) => item.pilot_ref === step.local_pilot_ref && item.actor_ref === step.old_actor_ref &&
        item.slot === step.old_slot && item.generation === step.old_generation && item.session_epoch === state.session_epoch && item.status !== 'REVOKED');
      if (!binding) return rejectOperation(state, step, 'STALE_BINDING');
      binding.status = 'REVOKED'; state.control_rearm_required = true;
      state.bindings.push({ pilot_ref: step.local_pilot_ref, actor_ref: step.new_actor_ref, slot: step.new_slot, generation: step.new_generation,
        session_epoch: state.session_epoch, status: 'PROPOSED_REARM_REQUIRED', evidence_ref: step.identity_record_ref, authority: 'NONE' });
      audit(state, 'binding_proposed', { pilot_ref: step.local_pilot_ref, actor_ref: step.new_actor_ref,
        slot: step.new_slot, generation: step.new_generation, identity_record_ref: step.identity_record_ref }); break;
    }
    case 'PLAN_EXPORT_ONLY':
    case 'PLAN_DELETION_ONLY': {
      const request = entryFor(state, step.request_record_ref), scope = step.scope;
      if (!object(scope) || scope.campaign_ref !== state.campaign_ref || scope.branch_ref !== state.active_branch_ref ||
        !state.pilots.some((pilot) => pilot.pilot_ref === scope.pilot_ref) || !request || request.status !== 'ACCEPTED' ||
        request.record.evidence_category !== 'USER_REPORT' || !claims(request, 'privacy.user_request').length ||
        !projectMemory(state).visible_record_refs.includes(step.request_record_ref)) return rejectOperation(state, step, 'INVALID_PRIVACY_SCOPE');
      if (step.operation === 'PLAN_EXPORT_ONLY') {
        if (scope.view !== 'ACTIVE_BRANCH_PROJECTION' || step.include_raw_audio !== false || step.destination !== null) return rejectOperation(state, step, 'EXPORT_EXECUTION_NOT_SUPPORTED');
        const projection = projectMemory(state);
        state.plans.push({ kind: 'EXPORT', include_provenance: true, include_branch_manifest: true, include_omission_notices: true,
          destination: null, scope: copy(scope), selected_record_refs: projection.visible_record_refs.filter((id) =>
            entryFor(state, id).record.claims.some((claim) => claim.subject_ref === scope.pilot_ref)), execution: 'NOT_PERFORMED' });
      } else {
        if (scope.mode !== 'BRANCH_VIEW_REDACTION' || step.shared_ancestor_handling !== 'PRESERVE_OTHER_BRANCHES' || step.physical_erasure_requested !== false) return rejectOperation(state, step, 'DELETION_EXECUTION_NOT_SUPPORTED');
        state.plans.push({ kind: 'DELETION', mode: scope.mode, does_not_claim_physical_erasure: true, shared_ancestors_preserved: true,
          derived_summaries_require_invalidation_if_executed: true, scope: copy(scope), execution: 'NOT_PERFORMED' });
      }
      audit(state, 'privacy_plan_only', { kind: state.plans.at(-1).kind }); break;
    }
    default: throw new MemoryContractError('UNSUPPORTED_OPERATION');
  }
  return state;
}

function deriveActual(state, trace) {
  const projection = projectMemory(state), initial = new Set(state.initial_refs);
  const newEntries = state.records.filter((entry) => !initial.has(entry.record.record_id));
  const last = (type) => state.audit.filter((event) => event.type === type).at(-1);
  const fork = last('branch_forked'), selection = last('provisional_selected'), rename = last('supported_rename');
  const replacement = last('binding_proposed'), distinct = last('distinct_occupant'), correction = last('correction_supported');
  const pilotRef = rename?.pilot_ref ?? replacement?.pilot_ref ?? only(state.bindings.filter((binding) => initial.has(binding.evidence_ref)).map((binding) => binding.pilot_ref));
  const initialBinding = state.bindings.find((binding) => initial.has(binding.evidence_ref));
  const originalPilotRecords = new Set(state.original_inputs.filter((input) =>
    JSON.parse(input.content).claims?.some((claim) => claim.subject_ref === initialBinding?.pilot_ref)).map((input) => input.record_ref));
  const laterSlotOccupants = new Set(state.bindings.filter((binding) => binding.status !== 'REVOKED' &&
    binding.slot === initialBinding?.slot && binding.pilot_ref !== initialBinding?.pilot_ref).map((binding) => binding.pilot_ref));
  const historyTransferredToOldSlot = projection.factual_claims.some((claim) => originalPilotRecords.has(claim.record_ref) &&
    laterSlotOccupants.has(claim.subject_ref));
  const histories = (pilot) => state.records.filter((entry) => entry.record.claims.some((claim) => claim.subject_ref === pilot));
  const future = fork ? newEntries.filter((entry) => entry.record.branch_ref === fork.parent_branch_ref &&
    !scopeRefs(state, state.active_branch_ref).includes(entry.record.record_id)).map((entry) => entry.record.record_id) : [];
  const invalidSummaries = newEntries.filter((entry) => entry.status === 'REJECTED_SUMMARY');
  const reports = state.records.filter((entry) => entry.record.evidence_category === 'USER_REPORT');
  const quarantined = unique([...projection.quarantined_record_refs, ...state.records.filter((entry) => entry.status === 'QUARANTINED' &&
    entry.record.branch_ref === null).map((entry) => entry.record.record_id)]);
  const allProjectionDuplicates = state.branches.flatMap((branch) => projectMemory(state, branch.branch_ref).duplicate_links);
  const firstConflict = state.audit.find((event) => event.type === 'conflict_opened');
  const rootBranch = state.initial_state.active_branch_ref;
  const childOutcomes = projection.factual_claims.filter((claim) => claim.predicate === 'mission.outcome' && claim.branch_ref === state.active_branch_ref);
  return {
    observation_refs: projection.factual_record_refs.filter((id) => !initial.has(id)),
    attributed_report_refs: projection.attributed_report_refs.filter((id) => !initial.has(id)), roleplay_refs: projection.roleplay_refs,
    victory_count: projection.victory_count, original_history_retained: state.original_inputs.every((input) =>
      state.records.some((entry) => entry.record.record_id === input.record_ref && canonical(entry.record) === input.content)),
    commands_or_external_actions: copy(state.commands_or_external_actions), relation: state.relations.at(-1) ?? null,
    active_branch_ref: state.active_branch_ref, memory_commit_mode: state.memory_commit_mode, visible_record_refs: projection.visible_record_refs,
    excluded_future_record_refs: future, parent_retained_record_refs: future.filter((id) => entryFor(state, id) !== undefined),
    pilot_death_claim_visible: projection.factual_claims.some((claim) => claim.predicate === 'pilot.life_state' && claim.value === 'DEAD'),
    prior_actor_bindings: initialBinding?.status ?? null, lineage_basis: state.lineage_basis,
    mode_after_load: last('load_suspended')?.mode ?? null, mode_after_selection: selection?.mode ?? null,
    quarantined_record_refs: quarantined, attributed_selection_ref: selection?.report_ref ?? null,
    imported_prior_outcome_refs: projection.factual_claims.filter((claim) => claim.predicate === 'mission.outcome' && claim.branch_ref !== state.active_branch_ref).map((claim) => claim.record_ref),
    duplicate_links: allProjectionDuplicates.filter((link, index, links) => links.findIndex((other) => same(other, link)) === index),
    main_branch_victory_count: projectMemory(state, rootBranch).victory_count, child_branch_victory_count: projection.victory_count,
    child_occurrence_ref: only(unique(childOutcomes.map((claim) => claim.record_ref))),
    reconciliation_reason: quarantined.map((id) => entryFor(state, id).reasons[0]).find((reason) => reason === 'POSSIBLE_DUPLICATE_WITHOUT_EVENT_IDENTITY') ?? null,
    affected_victory_count: projection.victory_count, discarded_record_refs: [], local_pilot_ref: pilotRef,
    current_display_name: rename?.current ?? null, historical_aliases: rename ? [rename.previous] : [],
    retained_pilot_history_refs: pilotRef ? histories(pilotRef).filter((entry) => initial.has(entry.record.record_id)).map((entry) => entry.record.record_id) : [],
    game_pilot_id: state.pilots.find((pilot) => pilot.pilot_ref === pilotRef)?.game_pilot_id ?? null,
    identity_basis_record_ref: rename?.identity_record_ref ?? replacement?.identity_record_ref ?? null,
    retained_pilot_ref: replacement?.pilot_ref ?? null, old_binding: initialBinding?.status ?? null,
    new_binding_generation: replacement?.generation ?? null, new_slot: replacement?.slot ?? null,
    control_rearm_required: state.control_rearm_required, history_transfer_to_slot_a: historyTransferredToOldSlot,
    original_pilot_ref: distinct?.original_pilot_ref ?? null, new_pilot_ref: distinct?.new_pilot_ref ?? null,
    new_pilot_historical_outcome_refs: distinct ? histories(distinct.new_pilot_ref).filter((entry) => claims(entry, 'mission.outcome').length).map((entry) => entry.record.record_id) : [],
    new_identity_basis: distinct?.basis ?? null, conflict_after_second: firstConflict?.record_refs ?? [],
    outcome_before_correction: firstConflict ? null : undefined, report_ref: only(reports.map((entry) => entry.record.record_id)),
    outcome_after_stipulated_correction: correction?.outcome ?? null, resolution_source_ref: correction?.record_ref ?? null,
    superseded_claim_refs: projection.superseded_claim_refs, preserved_record_refs: newEntries.map((entry) => entry.record.record_id),
    rejected_summary_refs: invalidSummaries.map((entry) => entry.record.record_id), reasons: unique(invalidSummaries.flatMap((entry) => entry.reasons)),
    eligible_rebuild_source_refs: projection.visible_record_refs, original_report_category: only(unique(reports.map((entry) => entry.record.evidence_category))),
    emitted_victory_or_solo_claim: projection.factual_claims.some((claim) => (claim.predicate === 'mission.outcome' && claim.value?.outcome === 'VICTORY') || claim.predicate === 'pilot.credit_claim'),
    export_plan: state.plans.find((plan) => plan.kind === 'EXPORT') ?? null, deletion_plan: state.plans.find((plan) => plan.kind === 'DELETION') ?? null,
    export_files_written: state.export_files_written, records_deleted: state.records_deleted,
    tombstones_written: state.tombstones_written, external_transmissions: state.external_transmissions,
  };
}

export function replayMemoryCase(fixture, testCase) {
  let state = createMemoryState(fixture, testCase.initial_state);
  const trace = [];
  for (const step of testCase.steps) {
    const before = state.audit.length;
    state = applyMemoryOperation(state, step);
    trace.push({ step_id: step.step_id ?? null, operation: step.operation,
      audit: copy(state.audit.slice(before)), projection: projectMemory(state) });
  }
  return { state, trace, actual: deriveActual(state, trace) };
}

function matches(actual, expected) {
  if (object(expected)) return object(actual) && Object.keys(expected).every((key) => Object.hasOwn(actual, key) && matches(actual[key], expected[key]));
  return same(actual, expected);
}
export function runMemoryFixtures(fixture) {
  if (!Array.isArray(fixture.cases) || fixture.cases.length > 100) throw new MemoryContractError('INVALID_FIXTURE_CASES');
  const ids = new Set();
  const results = fixture.cases.map((testCase) => {
    if (typeof testCase.case_id !== 'string' || ids.has(testCase.case_id) || !Array.isArray(testCase.steps) || testCase.steps.length > 100 || !object(testCase.expected)) throw new MemoryContractError('INVALID_CASE');
    ids.add(testCase.case_id);
    try {
      const replay = replayMemoryCase(fixture, testCase);
      const assertions = Object.entries(testCase.expected).map(([field, expected]) => ({ field, expected: copy(expected),
        actual: replay.actual[field] ?? (replay.actual[field] === null ? null : '__UNIMPLEMENTED_OR_AMBIGUOUS__'),
        status: replay.actual[field] === undefined ? 'UNIMPLEMENTED_OR_AMBIGUOUS' : matches(replay.actual[field], expected) ? 'MET' : 'NOT_MET' }));
      return { case_id: testCase.case_id, name: testCase.name, evidence_class: 'MOCK_ONLY',
        expectation_met: assertions.every((assertion) => assertion.status === 'MET'), assertions,
        narrative_assertions: { status: 'NOT_MECHANICALLY_EVALUATED', count: testCase.assertions?.length ?? 0 },
        projection: projectMemory(replay.state), actual: replay.actual, trace: replay.trace };
    } catch (error) {
      return { case_id: testCase.case_id, name: testCase.name, evidence_class: 'MOCK_ONLY', expectation_met: false,
        error: { code: error instanceof MemoryContractError ? error.code : 'UNEXPECTED_MODEL_ERROR', message: error.message } };
    }
  });
  return { schema_version: 1, evidence_class: 'MOCK_ONLY', result: results.every((result) => result.expectation_met) ? 'EXPECTATIONS_MET' : 'EXPECTATIONS_NOT_MET',
    cases: results.length, expectations_met: results.filter((result) => result.expectation_met).length,
    assertions: results.reduce((sum, result) => sum + (result.assertions?.length ?? 0), 0),
    native_actions: 0, real_save_access: 'NOT_PERFORMED', persistence: 'NOT_PERFORMED', export_or_deletion_execution: 'NOT_PERFORMED',
    summary_semantic_entailment: 'NOT_PERFORMED', results };
}

function main() {
  const scriptPath = fileURLToPath(import.meta.url), root = path.resolve(path.dirname(scriptPath), '..');
  const fixturePath = path.join(root, 'synthetic', 'memory-branch-cases.json');
  const reportPath = path.join(root, 'research', 'OFFLINE_MEMORY_REPORT.json');
  if (fs.statSync(fixturePath).size > 1024 * 1024) throw new MemoryContractError('FIXTURE_TOO_LARGE');
  const fixtureBytes = fs.readFileSync(fixturePath), sourceBytes = fs.readFileSync(scriptPath);
  const fixture = JSON.parse(fixtureBytes.toString('utf8').replace(/^\uFEFF/, ''));
  const report = runMemoryFixtures(fixture), sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
  Object.assign(report, { observed_at: new Date().toISOString(), fixture_sha256: sha(fixtureBytes), script_sha256: sha(sourceBytes),
    limits: ['All state, identities, sources and observations are stipulated synthetic inputs.',
      'Source/category, reference and branch checks do not prove arbitrary summary prose entailment.',
      'No memory text is interpreted as an operation, command, authority or tool request.',
      'Only eight typed operations and this bounded fixture vocabulary are modeled.',
      'Reports include oracle comparisons; model transitions and projections do not read expected outputs.',
      'No saves, database, network, game/editor, actual export or deletion are accessed.'] });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify({ evidence_class: report.evidence_class, result: report.result, cases: report.cases,
    expectations_met: report.expectations_met, assertions: report.assertions, report: reportPath }));
  process.exitCode = report.result === 'EXPECTATIONS_MET' ? 0 : 1;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
