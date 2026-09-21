# Offline memory contract exercise

Date: **2026-09-20**. **PROPOSED semantics, SYNTHETIC inputs, MOCK_ONLY results.** The [executable research model](../scripts/Exercise-MemoryContract.mjs) replays the 12 existing [memory fixtures](../synthetic/memory-branch-cases.json) without modifying them. The first recorded run meets **92 structured expectations across 12 cases**. The current [report](OFFLINE_MEMORY_REPORT.json) contains actual values, oracle values, per-step projections, audit events and fixture/source SHA256 hashes.

This executes a bounded interpretation of [CAMPAIGN_MEMORY.md](../design/CAMPAIGN_MEMORY.md). It is not a persistent memory subsystem, save reader, game adapter, conversational model or authority source. Actual game/campaign/pilot/save identifiers remain unknown. No export or deletion request in the fixtures is executed.

## Running and reviewing

From the project root:

```powershell
node .\scripts\Exercise-MemoryContract.mjs
```

The entry point reads only the project fixture and its own source, uses Node built-ins, and writes `research/OFFLINE_MEMORY_REPORT.json`. It requires no packages, listeners, database or runtime configuration. Importing the module does not run the entry point or perform file I/O.

Pure exports support independent mutation checks:

| Export | Result |
|---|---|
| `createMemoryState(fixture, initialState)` | Independent in-memory state, copied catalogs, immutable record copies and initial stipulated bindings |
| `applyMemoryOperation(state, step)` | New state; does not mutate the input state or fixture |
| `projectMemory(state, branchRef?)` | Scoped visible references, typed factual claims, reports, roleplay, reference-only summaries, conflicts and aggregate |
| `replayMemoryCase(fixture, testCase)` | Final state, per-step trace and state-derived fixture query values |
| `runMemoryFixtures(fixture)` | Oracle comparison report object; no file reads/writes |
| `MemoryContractError` | Deliberate malformed/unsupported operation error with a stable `code` |

The model never reads a case's `expected` values or branches on its case ID. The runner compares independently derived values with that oracle afterward. Nested expected objects are subset comparisons; arrays preserve fixture order. Every compared field shows both values. Unimplemented or undefined query results are marked `UNIMPLEMENTED_OR_AMBIGUOUS`, and exceptions fail a case instead of becoming a successful rejection. Narrative assertion and forbidden-outcome sentences are not automatically interpreted; their semantic evaluation remains outside the 92 structured comparisons.

## Implemented semantics

The state holds original record copies, classifications, branch/checkpoint definitions, proposed bindings, explicit relations, dry-run plans and audit events. Projection is separate from the journal. Branching, conflict handling, deduplication and correction never rewrite original provenance or erase records. The retention check compares every supplied record identity and canonical content with the retained journal; checking only the surviving records would miss deletion. The old-slot transfer query compares original pilot record subjects with later slot occupants and factual subject mappings, rather than assuming that transfer never happens.

| Typed input | Implemented behavior |
|---|---|
| `INGEST_PROPOSED_RECORD` | Validate the envelope, synthetic source/category/basis, campaign/branch and event scope. Retain rejected records separately from factual projection. User and roleplay text is never interpreted as an operation. |
| `PROPOSE_RELATION` | Permit explicit corroboration only from an eligible stipulated observation to a matching visible user report. Preserve both categories and records. |
| `LOAD_SIGNAL` | Revoke every recorded binding, clear the active branch and suspend continuing-history commits before validating the next epoch. A malformed/reused epoch remains suspended with no resolvable pending load; recovery requires a later valid load signal. A valid nonreused epoch enables only subsequent explicit lineage resolution. Hints and labels supply no lineage. |
| `RESOLVE_LINEAGE` | Require the supplied checkpoint identity and a valid matching catalog relationship. Create a fresh child branch with explicit checkpoint references and cutoff; inherited references also pass ancestor cutoffs. |
| `SELECT_PROVISIONAL_BRANCH` | Require an attributed pending user selection; create an isolated branch without ancestry. Pending outcomes and subsequently supplied observation facts remain quarantined while continuity is provisional; reports and roleplay may remain attributed conversation. The aggregate stays unknown. |
| `PROPOSE_BINDING_REPLACEMENT` | Require a currently visible verified identity assertion matching the old/new actors and new slot/generation, plus the exact current old binding/epoch. Revoke the old binding and create a proposal requiring rearm; authority remains `NONE`. |
| `PLAN_EXPORT_ONLY` | Validate active campaign/branch/pilot scope and an attributed privacy request. Produce an in-memory manifest/provenance/omission plan with selected record references; write no export. |
| `PLAN_DELETION_ONLY` | Produce only a branch-view-redaction plan that preserves shared ancestors and flags derived-summary invalidation. Delete no record, write no tombstone and claim no physical erasure. |

For outcome aggregation, only eligible typed stipulated observations count. A qualified event key includes namespace, campaign, branch and value. Exact agreeing deliveries from the same registered source count once, irrespective of their ingestion session labels. A contradictory payload, including a different source origin under the same qualified key, stays conflicted rather than silently deduplicating. A new child branch has a distinct event scope. Outcomes without reliable event identity are quarantined and make the affected branch aggregate unknown; matching titles, prose and clocks do not resolve them.

An explicit synthetic correction must cite the corrected and confirmed observations, match their event scope and the confirmed typed outcome, and use a separate correction identity. Projection applies the correction only where its evidence and references are visible. Original records remain. The exercise covers the fixture's single supported correction; it does not establish a general reconciliation algorithm for competing corrections or an arbitrary identity graph.

A supported self-identity link allows the fixture's rename to retain the local pilot reference and previous alias. Slot/pawn replacement requires the explicit typed replacement operation and matching evidence. New identity claims from a stale session are rejected before any binding mutation, including distinct-occupant claims. A stipulated distinct occupant receives a separate local identity; same callsign or slot never transfers prior pilot facts. These are hypothetical identity inputs, not discovered MW5 identifiers or actual control bindings.

## Summary boundary

Summary provenance is checked claim by claim for existing references, declared categories, active branch cutoff, source eligibility and cycles. An excluded parent future cannot become visible through citation, and relabelling a user report as an observation fails validation.

Even accurate citations cannot mechanically establish that arbitrary prose follows from them. A summary that passes reference checks is retained only as `SUMMARY_REFERENCE_ONLY`, with semantic entailment **NOT_PERFORMED**. It contributes no new `factual_claims`, outcome count or independent observation. The model produces no dialogue and does not test a language model's behavior.

## Validation and limits

The separate [root-authored adversarial review](OFFLINE_MEMORY_REVIEW.json) meets **14/14 cases**, using [Review-MemoryContract.mjs](../scripts/Review-MemoryContract.mjs). It checks forged evidence, mismatched event scope, unsupported and stale identity, nested fork cutoffs, summary authority, malformed operations, duplicate key ordering, invalid corrections, provisional history, bad reload epochs and a deliberately wrong oracle. Another agent reviewed the review script; input-immutability, duplicate-classification and binding-retention assertions were strengthened before the final run. This is independent work within the same assistant system, not human acceptance or formal verification.

Initial review exposed stale-occupant acceptance and premature provisional observation facts; the [retained pre-fix report](OFFLINE_MEMORY_REVIEW_BEFORE_FIX.json) records those two failures against the earlier model hash. Final review also checks invalid/reused load epochs and recovery through a later valid load. Current results are in the separate final report, which pins the final model, fixture and review script. Retention checks now compare all original inputs rather than just survivors. None of these fixes touched a real campaign.

To reproduce the independent review after the main exercise, run `node .\scripts\Review-MemoryContract.mjs` from the project root. It writes only its research report; the imported model performs no file I/O. Its cases do not change the original fixture.

The original fixture remains a proposed oracle with its original `NOT_PERFORMED` fields. Actual replay status lives in the separate report; changing the fixture labels would erase the distinction between specification and execution. Report hashes identify exactly which fixture and script produced a result.

The fixture queries assume a small number of focal entities and transitions: one initial pilot, at most one rename/replacement/distinct-occupant decision, and one explicit correction or corroboration relation. The model retains full lists and per-step projections for review, while legacy query fields select the unique focal record or relevant typed transition. These queries are not a general natural-language retrieval API.

All observations, checkpoints, source authority and continuity are stipulated. There is no real save discovery, external provenance verification, concurrency, process restart, persistence, storage migration, erasure validation, performance test or end-to-end game test. Catalog corruption, arbitrary predicate expansion, competing corrections and unrestricted identity reconciliation require separate specifications before further implementation. No fixture prose can authorize such work.

**Native actions: 0. Save access, persistence, export/deletion execution and summary semantic entailment: NOT_PERFORMED.** Passing this replay does not pass any editor/source or packaged-game gate in [PROOF_OF_CONCEPT.md](../design/PROOF_OF_CONCEPT.md).
