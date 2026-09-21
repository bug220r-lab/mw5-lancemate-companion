# Independent source-integration review

Review date: 2026-09-21. Final status: **PASS — source integration, playbook and passive handoff reviewed; no open material finding.** This is a static-document/source verdict, not gameplay acceptance. No game/editor execution or new collection was performed.

This reviewer authored the other-units/encounter workstream. The independent scope here is the root-authored coverage integration, tactical playbook and passive-observer handoff, with direct source checks from the movement/control/combat populations. It is not represented as an independent re-review of the reviewer's own encounter conclusions.

## Checks completed

- Read `scripts/Build-AIReviewIndex.mjs` and the four input-ledger structure. The builder combines authored conclusions, rejects missing/duplicate inventory records, checks source/default citations, compares collected artifact hashes and validates playbook reference ranges. It does not claim that hashing or range validation itself performs semantic review.
- Ran a separate read-only checker against the final rebuilt index: 249 inventory entries, 468 final ledger citation ranges, 244 source hashes and 128 default hashes were valid. All four review-input hashes and the collection-report hash matched. Playbook citation ranges also passed. Earlier intermediate builds had 476 citation ranges; the final count above follows the final authored ledgers, not an attempt to maximize citation count.
- Checked actual `BT_MechFollow.RootNode` and `Children` links: the root prioritizes navigation recovery, then the combat-capable follow subtree under its relevant decorators, then formation/travel movement. This validates the playbook's limited claim that following retains combat behavior; it does not imply uninterrupted firing, perfect formation or safety.
- Checked the health decorator's connected living-component `GetCurrentHealthPercent` → `LessEqual_FloatFloat` → return path. The prototype's 0.25 health threshold is correctly labeled a proposal, not copied as a native tactical rule.
- Checked GoToLocation navigation projection references and the distinction between projected location and a complete feasible route. The playbook does not claim that native projection establishes friendly-safe travel.
- Checked LanceMateBehaviorConfig: CoordinationLevel=Large and the native config fields support only a coordination-related source lead. The playbook explicitly identifies its own target-capacity and hysteresis rules as proposals, not a reconstruction of native scheduling or damage prediction.
- Read the passive handoff in full. It marks the component/widget and 2 Hz target as proposals, leaves cooked initialization unresolved, distinguishes physical human origin from player-issued metadata, separates submission/assignment/completion/movement, and retains explicit manifest, disposable scenario and rollback gates. It does not deploy an adapter or invent a network transport.
- Read `AI_REPORT.md` and `AI_TECHNICAL_APPENDIX.md` in full. Their population/role descriptions, connectedness caveats, native uncertainty, raw units versus proposed thresholds, source/default distinction, known gaps and separate integration milestones agree with the reviewed component reports. Linked section anchors were checked against the actual component headings. The broad-function-library size explanation is supported by the earlier collection plan's recorded 18,090,466-byte size versus 16 MiB limit.

## Findings and resolution

| Finding | Severity | Resolution |
|---|---|---|
| FOLLOW-01 originally cited asset013 lines1–40, which declare editor graph objects rather than the connected behavior. | Evidence accuracy | Root changed the reference to398–594; verified against runtime tree links and the combat subtree asset reference. |
| TACTIC-01 originally cited asset118 lines1–30, but the export has9 lines. | Citation validity | Root changed the range to1–9. The independent range check passed afterward. |
| COMBAT-01 said “Native combat tactic choice” although the visible role picker is exposed Blueprint using native capability/range helpers. | Wording precision | Root changed it to “Exposed combat tactic picker” using native capability/range helpers; verified in the current JSON. |
| Other-units unavailable IDs134/135 initially cited the broad collection coverage header. | Evidence specificity | Reviewer changed its owned ledger to exact report.json6823–6838 and6841–6856; the invalid/redirected status and alternative-path metadata are now directly cited. |
| The component factory's Contains guard could be mistaken for idempotent initialization. | Lifecycle precision | Root now notes that the runtime-component list is cleared first, so the guard deduplicates that scan and does not prove safety across repeated calls; passive handoff retains the unresolved creation/lifetime test. |

## Limits of this review

Static source analysis cannot prove native recipient acceptance, order execution, achieved sampling rate, actual shipping asset assignment, low-level piloting competence or tactical improvement. All such validation remains NOT_PERFORMED. Supporting-data dispositions distinguish configuration/schema/helper review from complete native implementations. The exact next observer experiment must still establish initialization, actor identity and manual-input provenance before control is enabled.

An independent movement-workstream reviewer additionally checked five selected other-unit claims. Two refinements were applied to this reviewer's own report/ledger: the VTOL EQS 2D-distance term no longer assumes an omitted `DistanceTo` context, and the encounter clamp discussion now explicitly preserves the base MinimumREDCON=0 default and its initialization dependency. Standard-garrison initialization to 4 remains separately cited.

No material content finding remains open. The final integrated index includes all corrected inputs and has zero independent-check errors. The appendix's corrected range-decorator reference is177; native recovery/setter defaults remain explicitly unknown rather than assigned an inferred boolean value.

## Reviewed artifact identity

These SHA-256 values identify the inspected content. A later semantic change requires review; regeneration of a timestamped index should still recheck its input identities and citations.

| Artifact | SHA-256 |
|---|---|
| research/AI_REPORT.md | `6487d77176a3cd72bfc328efb97eef62213371fd449c514f1c07c9dd6e82f119` |
| research/AI_TECHNICAL_APPENDIX.md | `a22c5050d76f9f9878010cac61c71475afa085ec3cde728ba3b0b8474b7bca48` |
| research/AI_COVERAGE_LEDGER.json | `b8cb16c2b69ce4e6998e7463606d83f5bfdb88755fd916cab81c67e7c406f3e4` |
| design/TACTICAL_PLAYBOOK.json | `7a5733e37c1b3308066e0848d33247c61c288c4d2f8dfdcb3cd4d334ec33b925` |
| design/PASSIVE_OBSERVER_HANDOFF.md | `f986c61b8aecfffd4ac8bb03bc7fcfc6ebe8a13c1c09b156efcbc4207611c147` |
| scripts/Build-AIReviewIndex.mjs | `a6dba1187bb80cedb4187c62e32d107b8709223376923a0e0499286797f70009` |

The independent checker is the project-local read-only helper `tmp/other-units-independent-check.cjs`. It reads the index, current input ledgers, playbook and preserved exports; it does not invoke the game or generate semantic review labels. The new final handoff and artifact-consistency validator were still being assembled by the root task at this review boundary and are outside this source-integration verdict.

## Final delivery review extension

Read `research/OVERNIGHT_HANDOFF.md` and `scripts/Verify-OvernightPackage.mjs` after their completion. **PASS:** the handoff accurately distinguishes the completed research/offline package from unperformed gameplay, native integration and piloting milestones. It accounts for the original failures and corrections, preserves missing dependencies and names the exact next task: establish supported initialization/cooking, prepare real passive component/widget artifacts and a removal manifest, then request authorization for a disposable Instant Action observation test with identity, human-order, pause, possession and mission-transition checks. It does not claim those assets already exist or authorize live control.

Two validator refinements were requested and verified in the final code: source-review acceptance now matches the explicit final PASS verdict rather than any occurrence of the word, and validation recomputes all 372 preserved source/default content hashes plus the original collection-receipt hash. It also checks all six source-review artifact hashes. The resulting receipt reports `PASS_OFFLINE_PACKAGE`, 30 checks and zero errors, with `STATIC_AND_MOCK_ONLY`, gameplay `NOT_PERFORMED` and native calls 0. These checks support artifact consistency and executed synthetic receipts; they do not promote test success to native acceptance or measured combat improvement.

No handoff contradiction or open material validator issue remains in this bounded review. The six previously recorded artifact hashes are unchanged. The root task will refresh the artifact receipt after this review note and the final progress checkpoint.
