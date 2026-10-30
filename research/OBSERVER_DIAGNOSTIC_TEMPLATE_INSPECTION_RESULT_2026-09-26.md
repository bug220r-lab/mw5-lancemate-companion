# Bounded diagnostic template inspection — 2026-09-26 UTC

**PREPARATION COMPLETE; NATIVE INSPECTION NOT_PERFORMED — EDITOR UNAVAILABLE.** This unit prepared the fixed read-only helper, focused mock tests and dormant manifest. It did not establish live template equivalence, repair the warning, or establish package readiness. No next milestone began.

Attempt: `diagnostic-template-preparation-20260926T003328Z-a7043c5e`. Evidence is in [the attempt directory](evidence/diagnostic-template-preparation-20260926T003328Z-a7043c5e/). The baseline and final verification receipts retain timestamps, hashes, process observations, selection and working-tree status.

## Checkpoint and changes

**OBSERVED:** local branch `codex/companion-foundation`, HEAD `2d078efd1554b0452c29ed261deb211209d57866`; the GitHub comparison during baseline preparation reported that exact remote checkpoint identical. There were five modified tracked files and twelve untracked files before this unit, rather than the historical seven/fourteen. Existing work was preserved; no branch change, commit or push occurred.

The inspected disk checkpoint is [SOURCE_CHECKPOINT.json](evidence/editor-authored/LanceObserverDiagnosticControl-20260925T222809Z-548b77b2-source-checkpoint/SOURCE_CHECKPOINT.json), SHA256 `e178797fac03c6558f427a862fc1d6c0750c3198f190a18d6e528416477b698f`. The [source freeze](OBSERVER_DIAGNOSTIC_CONTROL_SOURCE_FREEZE_2026-09-25.json) remains SHA256 `9f515b7b40cc9ab2830dda5f739fb5c367486c135b0b90d04b3ab3bee8e7c6ef`.

| Protected controller | Bytes | SHA256 |
|---|---:|---|
| Final diagnostic and frozen backup | 92,019 | `ba725129011767a82935bd36a811ce2583bfebbfbbd8c4b2cff3fcbc1ca14948` |
| Installed stock | 53,635 | `7107745a8de461275a7acfa1f3ffc5be9bcb7002682c37b7705af5f00783e4f6` |

This task added only [Inspect-DiagnosticTemplates.py](../scripts/Inspect-DiagnosticTemplates.py), [Test-DiagnosticTemplates.py](../scripts/Test-DiagnosticTemplates.py), the [inspection manifest](OBSERVER_DIAGNOSTIC_TEMPLATE_INSPECTION_MANIFEST.json), this report, and the attempt's baseline/review/test/final-verification receipts. Shared README/NEXT documents and other workers' files were not edited. This chat owns this helper/native investigation; the parallel work remained offline and the shared-status owner remained frozen.

## Review and tests

**PREPARATION_REVIEW_PASS:** one independent reviewer checked read-only behavior, exact path/class/outer identity, stock-to-copy alias rejection, bounds and evidence interpretation, with no outstanding blocking code finding. Its [final review](evidence/diagnostic-template-preparation-20260926T003328Z-a7043c5e/independent-review.md) pins the final helper, tests and manifest. The [first review](evidence/diagnostic-template-preparation-20260926T003328Z-a7043c5e/review-round-01.md) is preserved: active collectors without filesystem locks and truthy owner flags required stricter rejection; both were corrected and covered by regression cases.

**PASS / MOCK_ONLY:** [round 1](evidence/diagnostic-template-preparation-20260926T003328Z-a7043c5e/tests-round-01.txt) passed 27 tests. After adding final selection-read failure handling, bounded receipt fallback and runtime manifest/helper identities, [round 2](evidence/diagnostic-template-preparation-20260926T003328Z-a7043c5e/tests-round-02.txt) passed all 29 tests. No full companion suite or native smoke test ran. Mock fixtures were isolated temporary files.

The helper permits at most ten exact already-loaded lookups and ten exports, eight outer steps and lexical nesting depth sixteen. Bounds are 1 MiB per export/inventory, 8 MiB aggregate each, 128 KiB per receipt, 90 seconds and 2 GiB free disk. Native time/export limits are cooperative or checked after a synchronous call; they cannot interrupt an unresponsive exporter. The RAM reserve waiver is honored; actual allocation failures stop. A changed protected file stops the run and is reported, never restored automatically.

## Per-template evidence and unknowns

The exact proposed query identity is `prefix:suffix`, with these independently derived prefixes:

- Stock: `/Game/Modes/InstantAction/InstantActionPlayerController.InstantActionPlayerController_C`
- Diagnostic: `/ModOverride/LanceObserverDiagnosticControl/Modes/InstantAction/InstantActionPlayerController.InstantActionPlayerController_C`

These are **prepared query identities**, not identities newly observed in a running editor. The manifest records every full object/class/outer path. The independent reviewer corroborated all five class/outer pins through a narrow read-only parse of the pinned stock and diagnostic packages; its export-index table is retained in the review. Component classes use `/Game/Objects/_common/Components/PlayerControllerComponents/<component>.<component>_C`; the expected immediate outer is the corresponding prefix above.

| Object suffix in both stock and diagnostic | Existing properties/reference evidence | Matching findings and differences | Still UNKNOWN |
|---|---|---|---|
| `SimpleConstructionScript_0` | Final controller export line 460 points to `InstantActionPlayerController_C:SimpleConstructionScript_0`; class `/Script/Engine.SimpleConstructionScript`. | Prior source review records the same relative reference as historical stock. No detailed body comparison in this unit. | Current loaded identity, nodes, templates, inheritance and resolved reference health. |
| `InheritableComponentHandler` | Final export line 464 points to `InstantActionPlayerController_C:InheritableComponentHandler`; class `/Script/Engine.InheritableComponentHandler`. | Prior source review records the same relative reference as historical stock. No detailed record comparison in this unit. | Current loaded identity, inheritance records, component keys and live targets. |
| `PlayerControllerSwitchMech_GEN_VARIABLE` | Saved-package audit resolves `PlayerControllerSwitchMech_C` and the local generated-class outer. | Present once in stock/final; absent from initial copy. Class, outer, flags and normalized 12-byte serialized body match. | Loaded template, inherited values, effective references and whether earlier nulled references recovered. |
| `PlayerControllerAirStrikeComponent_GEN_VARIABLE` | Saved-package audit resolves `PlayerControllerAirStrikeComponent_C` and the local generated-class outer. | Present once in stock/final; absent from initial copy. Class, outer, flags and normalized 12-byte serialized body match. | Loaded template, inherited values, effective references and whether earlier nulled references recovered. |
| `ControllerFeedbackComponent_GEN_VARIABLE` | Saved-package audit resolves `ControllerFeedbackComponent_C` and the local generated-class outer. | Present once in stock/final; absent from initial copy. Class, outer, flags and normalized 12-byte serialized body match. | Loaded template, inherited values, effective references and whether earlier nulled references recovered. |

**DOCUMENTED, tied to currently verified disk hashes:** [saved-package binary audit](OBSERVER_DIAGNOSTIC_TEMPLATE_BINARY_AUDIT_2026-09-26.md) and [final source review](OBSERVER_DIAGNOSTIC_CONTROLLER_FINAL_REVIEW_2026-09-25.md). The saved component-body difference is a package-local `None` name index (172 stock / 242 diagnostic), with matching remaining eight bytes. Ordinary `None` CDO fields and matching serialized stubs do not prove complete template equivalence. No new native property/reference outputs were generated. Missing fields remain UNKNOWN, not empty valid records.

## Native result, protection and next action

**NOT_PERFORMED:** all fresh process observations in this unit found no `UE4Editor` process. The helper was not invoked in Unreal. No object was loaded, no native asset was compiled/saved/changed, and no editor launch/restart, selection change, reload, cook, package, install or retail operation occurred. The manifest deliberately has no process identity and remains `PREPARED_NATIVE_NOT_RUN_EDITOR_UNAVAILABLE`; independent code review does not activate it.

**OBSERVED:** final verification checks all 23 protected source/backup/original files against the baseline, plus checkpoint, freeze and both reused utilities: **27/27 pinned files unchanged**. The original mod marker remains present and empty; the diagnostic marker remains absent. Exact final hashes and process timestamps are in [final-verification.json](evidence/diagnostic-template-preparation-20260926T003328Z-a7043c5e/final-verification.json).

Unanswered: live stock/copy aliasing, SCS/handler records, effective inherited references, the impact of the earlier reload warnings, equality after fresh-process readback, and localization-validator warning disposition. Cook/package/runtime gates remain separate and unrun by this unit. The recorded user usage override was located verbatim: “Continue below 10%; override the stop rule.” No usage reset was used.

**One next action:** once the editor is opened normally, refresh its exact process identity and exclusive ownership, review a newly pinned manifest, and invoke this helper once against already-loaded objects only. If the required objects or independent stock are unavailable, retain UNKNOWN and propose a separate bounded readback step; do not change selection or load/reload objects to complete this inspection.
