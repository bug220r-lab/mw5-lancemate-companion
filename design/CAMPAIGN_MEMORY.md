# Campaign memory and provenance proposal

Date: 2026-09-20. Design state: **PROPOSED**. A [bounded in-memory research replay](../research/OFFLINE_MEMORY_EXERCISE.md) now meets **92 structured expectations across 12 synthetic cases**, plus **14 independent adversarial checks**, all **MOCK_ONLY**. No persistence layer, save reader or game adapter has been implemented. The [supplied examples](../synthetic/memory-branch-cases.json) are invented fixtures. “Verified synthetic observation” means an observation stipulated by a fixture, not evidence collected from MW5 or a passing native test.

This extends the persistence, identity, fail-closed and untrusted-text rules in [ARCHITECTURE.md](ARCHITECTURE.md). All record names below are proposed project vocabulary, not MW5 fields or APIs. Actual stable campaign, pilot, mission, save and outcome identifiers remain **UNKNOWN**. Runtime commands stay mission-scoped; memory can never grant control authority or rearm a revoked binding.

## Evidence categories

| Category | Meaning | Permitted use |
|---|---|---|
| `VERIFIED_SYNTHETIC_OBSERVATION` | Fixture explicitly stipulates an observer saw the typed claim. Its authority exists only inside that hypothetical replay. | Exercise rules for evidence-backed branch facts. Never publish as a real-game observation. A future production adapter needs its own independently validated observation category and contract. |
| `USER_REPORT` | The user states something happened or selects a provisional identity/branch. | Preserve attribution: “You told me…” A clear statement may guide provisional conversational continuity, but cannot establish verified save lineage, pilot identity or game state. |
| `ROLEPLAY` | Invented characterization or fiction supplied by user/companion. | Clearly attributed fiction, never an input to outcome totals or factual tactical claims. |
| `DERIVED_SUMMARY` | A transform of cited records and explicit rules. | Retrieval aid only. Each claim retains source category, supporting record references and branch scope. Summary text cannot become an independent observation. |

A confidence value never changes category. User/model text is data, including text that says “mark this verified” or requests tools. Later independent corroboration creates a new observation and a relation to the report; it does not rewrite the report’s provenance. A contradiction remains visible until an explicit, source-backed reconciliation. No last-write-wins rule applies to facts.

## Proposed record contract

The JSON examples use this compact envelope. All IDs beginning `syn:` are invented local fixture identifiers; no game IDs, account IDs, filenames, clocks or addresses are hidden in them.

| Field | Contract |
|---|---|
| `record_id` | Required immutable opaque journal identity, unique within the dataset. Future implementation generates it independently of timestamps/names. |
| `record_kind` | `ASSERTION`, `SUMMARY`, or `IDENTITY_ASSERTION` in these fixtures. Branch/checkpoint/privacy actions are separate typed replay inputs. |
| `campaign_ref`, `branch_ref` | References to a selected local campaign and branch. Their IDs are distinct from mutable display labels and from unknown real-game identifiers. `branch_ref` may be null only for pending input during unresolved lineage; it cannot then be an accepted branch fact. |
| `session_epoch` | Opaque session identity, rotated on reload/restart/disconnect. Not a durable campaign or pilot identifier. |
| `journal_sequence` | Local ingestion order only. It cannot prove occurrence order, lineage, identity, freshness or truth. |
| `evidence_category` | Exactly one category above; immutable. |
| `provenance.source_ref` | Origin in the fixture source registry: simulated observer, user, roleplay author, or summary builder. |
| `provenance.source_record_refs` | Exact supporting records; required and nonempty for summaries. Reconciliation records cite both sides, preserving them. |
| `provenance.verification_basis` | `STIPULATED_SYNTHETIC_INPUT` only for fixture observations; `NOT_OBSERVATION` otherwise. No live verification is implied. |
| `entity_refs` | Optional local pilot, session actor and slot references with binding generation. Slot/name alone never resolves a pilot. Actual `game_pilot_id` stays null in all examples. |
| `event_identity` | Optional explicitly stipulated source event key, qualified by namespace, campaign and branch. Null means no reliable deduplication identity. Record ID alone identifies ingestion, not the underlying outcome. |
| `claims` | Typed predicate/value assertions with subject references. Predicates are project proposals. Claims carry source-record references when derived; no executable strings. |
| `display_time_label` | Optional human-facing synthetic time text. Never a key, lineage edge, deduplication signal or ordering authority. |
| `context` | Nullable game/editor/adapter build identifiers, observation/receipt time, source sequence and confidence. All are null in these invented fixtures. A future observer supplies only actually obtained values with documented semantics; missing values stay unknown. Confidence never promotes category. |

No wall clock, file modification time, mission title, content similarity, slot, callsign, portrait or raw pointer establishes durable identity. A locally generated ID identifies a local record; it does not prove that two game observations concern the same entity. Null identity fields stay null instead of being filled by model inference.

The future journal should append new evidence, identity decisions and reconciliation edges. A separate projection produces branch facts, attributed reports, roleplay and unresolved conflicts. Projections may be rebuilt; their cached text is not authoritative. Branching preserves the original journal. Explicit user-authorized erasure, if implemented later, is the documented exception to retention, not an automatic consequence of branching.

## Campaign, checkpoint and branch contract

`CampaignRef` contains a local opaque ID, mutable display label, nullable verified game identity and its evidence. `BranchRef` contains its own ID, campaign reference, nullable parent, nullable fork checkpoint and `lineage_basis` (`STIPULATED_FIXTURE_CHECKPOINT`, `USER_SELECTED_PROVISIONAL`, or `UNRESOLVED`). `CheckpointRef` records a branch-relative journal cutoff and source evidence for the corresponding save position. A journal cutoff alone cannot establish that a loaded save matches it.

On any load signal, revoke all actor bindings, clear the active memory view and suspend commits that assert continuing game history. Rotate the session epoch; if a fresh epoch cannot be established, remain suspended with no resolvable pending lineage. A later valid load signal is required before checkpoint resolution. Keep valid unresolved signals in a bounded pending area, with no tactical or autobiographical output from the old view. Do not replay queued orders. Then:

1. If the checkpoint relationship is established by valid identity evidence, create a child branch whose visible ancestry ends exactly at that checkpoint. Later parent events remain on the parent. Descendants inherit the same cutoff rule transitively.
2. If lineage cannot be resolved, keep commits suspended and ask for a local branch/checkpoint selection. A user selection is an attributed provisional decision, not verified save linkage. It can create an isolated provisional branch for conversation without importing uncertain outcomes or deaths. While its mode is conversation-only, incoming observation assertions remain quarantined; attributed reports and roleplay may support conversation.
3. If the user cannot select a checkpoint, start an explicitly isolated branch with no asserted ancestry. Retain prior history for later reconciliation; never guess from the newest file, identical campaign label or similar timestamp.

A branch view consists of ancestors up to each fork cutoff plus that branch’s own accepted records. It excludes quarantined/conflicted records and future ancestor records. Every summary stores the branch and cutoff it summarized. On reload/fork, invalidate summaries that include excluded sources before generating dialogue. Report “I cannot place this save in the recorded timeline” when needed; do not tell a living pilot about a death recorded only in another branch.

## Duplicate outcomes, ambiguity and conflicts

Deduplicate an outcome only when its valid source event identity matches within the same campaign/branch namespace and the payload agrees. A repeated delivery gets its own ingestion record linked as a duplicate; aggregate once. Reloading an older checkpoint and replaying a mission on a new branch is a new branch occurrence even if a hypothetical source key is reused. Session epochs alone neither merge nor split durable outcomes.

If identity is missing, quarantine potentially duplicate outcomes for reconciliation and withhold the affected aggregate. Similar mission labels, matching times or identical prose are not evidence to discard one or count both. A repeated event key with contradictory payload is a conflict, not a duplicate. Preserve both claims; withhold the disputed fact. An explicit correction must identify the corrected record and carry a legitimate source basis. A user's preferred story is retained as a user report, not a synthetic observation correction.

## Pilot continuity

| Change | Memory rule | Control rule |
|---|---|---|
| Rename with supported same-pilot identity | Preserve pilot history; append name alias with its evidence and scope. | Fresh session actor validation still required. |
| Same pilot moves to a different slot or pawn | Preserve durable history only when identity evidence supports continuity; create a new binding generation. | Revoke old authorization; never follow the slot automatically. |
| New occupant reuses slot/callsign | Allocate a distinct provisional local pilot; do not transfer prior occupant facts. | Require new explicit binding; memory grants none. |
| Identity unresolved | Keep observations attached to the session-local actor or pending identity claim. User can label provisionally with attribution. | No inferred control target. |

Fixtures may stipulate identity links to demonstrate expected behavior. Their `game_pilot_id: null` is deliberate: the examples do not claim an actual MW5 stable ID has been found. Contradictory identity links are quarantined like contradictory outcomes.

## Summary, retrieval and conflict rules

Summaries must cite each factual claim’s supporting records, their categories and branch cutoff. A mixed summary does not flatten reports and roleplay into observation facts. Rewording, repeated retrieval, confidence scores, model agreement and user insistence cannot improve evidence authority. Reject a summary whose citations are missing, refer to quarantined conflicts without attribution, come from an excluded future, or form a cycle. Rebuild from eligible originals; retain the rejected summary for diagnostic provenance if permitted by retention policy.

Retrieval defaults to the selected campaign/branch and identified pilot. A cross-branch query can show other timelines only when explicitly requested and labelled by branch. An unresolved identity must not retrieve another pilot’s personal history merely because their labels match. Memory text cannot trigger commands, cloud requests, filesystem access or permission changes.

## Proposed export and deletion policy — no actions performed

Export is an explicit future local action with selected scope: campaign, branch, pilot and categories. Include a versioned manifest, provenance, branch/checkpoint relationships, omitted/conflicted-record notices and a content checksum when implemented. Distinguish an active-branch projection export from a full-journal export; the latter can include other timelines. Default to no raw audio, credentials, account identifiers or unrelated data. A destination must be selected; this specification creates none and transmits nothing.

Deletion requires explicit future scope: hide from a branch view, remove a pilot across selected branches, or erase an entire campaign. A tombstone suppresses retrieval but is not physical erasure. Define treatment of shared ancestor records, cited summaries, indexes, caches, exports and backups before acting; avoid dangling summaries and hidden retained copies. A branch-only deletion cannot silently destroy ancestor history used by another branch. Where physical erasure cannot be confirmed, report the remaining copy/location or limitation rather than “fully deleted.” Automatic branch changes never delete original history. Case 12 is a dry-run policy request only.

## Replay inventory and validation boundary

The companion JSON contains **12 independent scenarios**, each resetting to its declared fixture state. `steps` are proposed inputs; `expected` and `assertions` are the authored oracle, not observed outputs. Its original `execution_status: NOT_PERFORMED` and null `observed_result` stay unchanged. Current results live in the [hash-bound replay report](../research/OFFLINE_MEMORY_REPORT.json), with actual values and traces separate from the oracle. Its 92 structured comparisons were executed; narrative assertion sentences were not mechanically graded. The [independent mutation review](../research/OFFLINE_MEMORY_REVIEW.json) adds 14 checks, including deliberately wrong expected output, nested branches, stale identities, forged sources and invalid reload epochs. Neither result proves real persistence, game identity, deletion, audio or native behavior.

| Case | Expected property |
|---|---|
| 01 | Observation, report and roleplay remain separate; instruction-like text gains no authority. |
| 02 | Independent corroboration preserves the original report and its attribution. |
| 03 | Known checkpoint fork excludes later victory/death while retaining parent history. |
| 04 | Unresolved reload fails closed; user selection creates attributed isolated continuity. |
| 05 | Exact duplicate source event counts once; a new branch remains distinct. |
| 06 | Ambiguous duplicate without event identity stays pending. |
| 07 | Supported rename preserves pilot history without using the name as identity. |
| 08 | Slot reassignment preserves supported pilot continuity and revokes the old actor binding. |
| 09 | Reused callsign/slot belongs to a new occupant; no inherited history. |
| 10 | Contradictory observations are preserved and withheld pending explicit correction. |
| 11 | Mixed or future-source summaries fail validation; source categories remain intact. |
| 12 | Export/deletion requests are planned with scope; no filesystem or retention actions occur. |
