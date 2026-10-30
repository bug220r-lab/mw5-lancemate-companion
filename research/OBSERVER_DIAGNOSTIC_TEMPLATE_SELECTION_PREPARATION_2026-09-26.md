# Separate stock and diagnostic inspections: preparation

Date: 2026-09-26. **OFFLINE_PREPARATION / NATIVE_INSPECTION_NOT_PERFORMED.** This implements the next preparation step from the read-only selection-preflight review. It does not switch Active Mod, execute an editor helper, repair an asset or establish template health.

## Source checkpoint and changes

The [baseline](evidence/diagnostic-template-selection-preparation-20260926T223556Z/baseline.json) records branch `codex/companion-foundation`, HEAD `2d078efd1554b0452c29ed261deb211209d57866`, existing working-tree changes and 27/27 matching protected files. They include the seven diagnostic source files and seven backups, original observer content/descriptor, stock controller, freeze/checkpoint records and inspection utilities. The saved diagnostic controller remains the 92,019-byte `ba725129011767a82935bd36a811ce2583bfebbfbbd8c4b2cff3fcbc1ca14948` checkpoint; the widget is 30,768 bytes / `80f52bb21156b638ca22d6c8ab778bfcfc7a6feb1f26286977a3324ac5978b4b`.

This work adds:

- [Inspect-DiagnosticTemplatePhase.py](../scripts/Inspect-DiagnosticTemplatePhase.py): one fixed phase per invocation, with stock evidence read back from files before the diagnostic phase.
- [Test-DiagnosticTemplatePhase.py](../scripts/Test-DiagnosticTemplatePhase.py): focused mock checks; no Unreal import or editor input.
- [Dormant manifest templates](OBSERVER_DIAGNOSTIC_TEMPLATE_PHASE_MANIFESTS.template.json): explicit fixed plans and protected pins, with current identity, ownership, input evidence and review fields deliberately unfilled.
- This preparation record and its new evidence directory; the [selection preflight](OBSERVER_DIAGNOSTIC_TEMPLATE_SELECTION_PREFLIGHT_2026-09-26.md) is revised. Its previous contents are preserved in `preflight-before.md` in the evidence directory.

The completed `Inspect-DiagnosticTemplates.py` and `Inspect-DiagnosticTemplateLoad.py` remain byte-identical. Their existing receipts and consumed entries are not reused. Shared README/NEXT, native assets, retail files, Git branch/history and other workers' files are outside these edits.

## Exact phase contract

Both phases use the actual generated API reference from the installed UE4.26.2 editor: [find_object, find_asset and load_asset declarations](evidence/editor-source/mod-research-collection-20260921T023909Z-5eeaf52a/unreal-api-reference.txt). `find_package` only finds an already loaded package; it is not a mount-registry query. No new reflection or registry API is assumed.

Stock resolves `/Game/Modes/InstantAction/InstantActionPlayerController.InstantActionPlayerController`. Diagnostic resolves `/ModOverride/LanceObserverDiagnosticControl/Modes/InstantAction/InstantActionPlayerController.InstantActionPlayerController`. Each must be `/Script/Engine.Blueprint` with its exact package outer. Stock allows no loading. Diagnostic allows one `load_asset` of its exact missing root, with redirects disabled. Root accessibility does not prove mount-registry state, which remains `UNKNOWN_NOT_QUERIED`.

For each phase, the generated-class path is the corresponding Blueprint path plus `_C`; the five colon subobjects and their exact classes are:

| Subobject | Class |
|---|---|
| `SimpleConstructionScript_0` | `/Script/Engine.SimpleConstructionScript` |
| `InheritableComponentHandler` | `/Script/Engine.InheritableComponentHandler` |
| `PlayerControllerSwitchMech_GEN_VARIABLE` | `/Game/Objects/_common/Components/PlayerControllerComponents/PlayerControllerSwitchMech.PlayerControllerSwitchMech_C` |
| `PlayerControllerAirStrikeComponent_GEN_VARIABLE` | `/Game/Objects/_common/Components/PlayerControllerComponents/PlayerControllerAirStrikeComponent.PlayerControllerAirStrikeComponent_C` |
| `ControllerFeedbackComponent_GEN_VARIABLE` | `/Game/Objects/_common/Components/PlayerControllerComponents/ControllerFeedbackComponent.ControllerFeedbackComponent_C` |

The generated class is the required immediate outer. The fixed inventory is copied from the pinned base helper; the new helper never modifies its `TARGETS`. A missing object or wrong identity stops the phase before exporting the five-object group. Successful exports preserve actual properties and lexical reference candidates. A candidate matching a fixed observed identity does not prove that a serialized property binds to it; all other candidates remain `UNKNOWN_NOT_QUERIED`. Omitted properties and explicit `None` values stay distinct.

Each invocation ends and releases its owned lock/token and Python object references before a selection transition. No UObject is returned in a receipt or retained on the API for reuse. Diagnostic admission rehashes the stock receipt, all five raw exports/inventories, and the reviewed selection receipt. Partial stock capture, changed source/process/helper pins or an unexpected between-phase file difference is rejected.

Limits are fixed in code and must match the manifest: two root finds, five subobject finds, five exports, zero stock loads/at most one diagnostic load, eight outer steps, lexical depth sixteen, 2 GiB minimum free disk, 1 MiB per export/inventory, 8 MiB aggregate raw and aggregate inventories separately, and 128 KiB per receipt. Pre-dispatch inventory admission and the admitted inspection each have a separate 90-second cooperative budget; there is no single shared 90-second deadline for an invocation. The combined mod-root inventory is limited to 256 files, 512 MiB and 1,024 directories. Reparse points are rejected. No fixed RAM reserve is reinstated. Engine calls and exporter size checks are synchronous/cooperative and cannot forcibly interrupt engine work.

## Native admission remains dormant

For a future authorized attempt, prepare a new directory named `diagnostic-template-selection-YYYYMMDDTHHMMSSZ-xxxxxxxx` under `research/evidence`. Its parent must contain the existing `editor-source` lock directory. Use a separately reviewed `stock-manifest.json` and `run-stock.py`; after reviewed stock evidence and an authorized selection transition, prepare `diagnostic-manifest.json` and `run-diagnostic.py`. Each phase has an exclusive persistent dispatch claim. A consumed phase must not be retried.

Before dispatch, each manifest must contain the current editor executable/PID/creation identity, an ownership/authorization record reviewed within ten minutes, exact helper/base/entry hashes, the complete 27 protected pins, exact phase marker state and freshly observed whole-mod inventory. Null/malformed inventories, wrong root order, duplicate or noncanonical relative paths, unsorted rows, invalid pins and exceeded aggregate limits are rejected during manifest validation. Native admission compares a fresh bounded whole-mod snapshot **before opening the persistent dispatch claim**; stale inventories therefore do not consume it. A subsequent race remains subject to the in-phase checks. The stock template must not contain predecessor/selection evidence. Diagnostic requires `stock_evidence` and `selection_receipt` records containing exact path, byte length and SHA-256.

The separately authored `selection-review.json` must record `REVIEWED_SELECTION_ONLY`, matching editor identity, pinned stock-report hash, current marker state and whole-mod inventory, and observed `protected_unchanged=true`. It must explicitly attest `stock_source_review_passed=true`, `stock_log_review_passed=true`, `exclusive_owner_confirmed=true`, and `unexpected_dialog_reload_warning_save_compile=false`. These are owner-reviewed observations, never values inferred from a template or populated automatically. Only the expected empty marker removal/addition may differ between phases.

Those attestations must be backed by the receipt's `evidence` object. Every pin contains exactly `path`, `bytes` and `sha256`; files must be within project `research/evidence`, at exact nonredirected paths. The [dormant receipt template](OBSERVER_DIAGNOSTIC_TEMPLATE_SELECTION_REVIEW.template.json) leaves all observations unfilled.

- `stock_review`: a pin for this attempt's `stock-independent-review.json`. That JSON must contain `status=PASS_STOCK_SOURCE_AND_LOG_REVIEW`, matching `editor_identity` and `stock_report_sha256`, a named `reviewer`, and `source_review_passed=true`, `log_review_passed=true`. Its 128 KiB limit and hash are checked. A label naming a reviewer is traceability, not automated proof of reviewer independence.
- `ui_captures`: exactly two entries, in order, with `role=before_selection` and `role=after_selection`, each containing `capture` and `receipt` pins. Images are capped at 8 MiB each and receipts at 128 KiB. The observed WindowBridge receipt format binds `image`/`sha256` to the image pin and `identity.pid/process/process_created` to the manifest's PID/executable/creation identity. `created_utc` must be ordered from stock-manifest review through diagnostic-manifest review. This does not infer the selected mod from image bytes; visual review remains required.
- `log_spans`: exactly two entries, with roles `stock_inspection` and `selection`, each containing `file` (extract pin), absolute `source_log_path`, and integer `start_byte`/`end_byte`. Extract size must equal the offset difference and not exceed 256 KiB. Both spans name the same source log and have ordered, nonoverlapping offsets. Source-log continuity and warning interpretation are owner-reviewed; these pins establish extract integrity, not completeness of logging.

All cited evidence is rehashed during diagnostic guards as well as admission. Missing, altered, wrong-process or out-of-order evidence stops the operation. These are project-local proposed receipt fields, not new MW5 or Unreal APIs.

The owner reviews fresh UI and bounded log spans before selection, after selection, after either native phase and after any permitted restoration. The inspector itself does not monitor warning text, change selection or perform rollback. Missing/rotated/truncated/excess log coverage remains unresolved. See the preflight for the one-attempt/15-second/five-poll UI bounds, 256 KiB log-delta bounds and the distinction between comparison-only stops and stop-all-input events. Restoration requires fresh ownership/state checks; selection/disk restoration does not prove in-memory reference rollback.

The earlier user request explicitly excluded switching active mods, package reload, editor restart and retail work. This preparation therefore does not create a native-ready manifest or execute the selection proposal. No approval was inferred from historical screenshots, subordinate messages or populated artifact fields.

## Review, validation and remaining result

The coordinator's subsequent offline audit requested evidence citations behind review booleans and inventory rejection before a dispatch claim. Those refinements are implemented above. Their new receipts are stored separately in `evidence/diagnostic-template-selection-audit-20260926T231313Z`; the original 55-test result and its source copies remain preserved.

**Current focused checks: 67/67 PASS, MOCK_ONLY** in 23.137 seconds; see the [audit test log](evidence/diagnostic-template-selection-audit-20260926T231313Z/phase-tests-audit-initial.txt) and [independent audit review](evidence/diagnostic-template-selection-audit-20260926T231313Z/phase-independent-audit-review.md). All checks passed on the first audit run. The 12 added tests cover malformed/stale inventories before claim consumption, required evidence roles and pins, changed supporting artifacts, process/report binding, capture chronology, bounded ordered log spans, evidence containment and in-phase evidence drift. Synthetic captures and review/log fixtures validate the contract only; they are not native evidence.

Current helper SHA-256: `13b0e9d3e395468b70c6e06ced6edfb5018b8c56d0339c284167d15e308a0105`. Current test SHA-256: `e6d8c59332a5d10ed98d7a3bf80ee71b6570128637b7fbeaadf82e1cfb99df55`. The [audit verification receipt](evidence/diagnostic-template-selection-audit-20260926T231313Z/offline-verification.json) records final pins, dormant templates, grammar/link checks and protected-file comparisons. The [completion receipt](evidence/diagnostic-template-selection-audit-20260926T231313Z/completion.json) preserves this offline result and the outstanding native boundary.

**Historical focused checks: 55/55 PASS, MOCK_ONLY** in 13.172 seconds; see the [previous final log](evidence/diagnostic-template-selection-preparation-20260926T223556Z/phase-tests-final-20260926T2302.txt). They cover fixed plans, exact identities/aliases, zero/one-load rules, partial evidence, phase selection, predecessor tampering, replay, protected/unpinned file drift, oversized markers, output/time/disk limits and preservation of pre-existing directories/locks. The fake-native admission tests use a mock API and patched process/filesystem context; they are not editor execution.

The [initial run](evidence/diagnostic-template-selection-preparation-20260926T223556Z/phase-tests-initial-20260926T2258.txt) had 51/52 passes and one fixture error: its synthetic filesystem stat omitted `st_mode`. That fixture was corrected, the failure was retained, and the final run includes three additional targeted checks. During source review, predecessor root/template identity checks and exception-safe final marker reporting were tightened before the final run.

Previously reviewed helper SHA-256: `7983c0812a11ce9355117116eb7ef008f0a9827e7e8ecd82a27c13e6f284e931`. Previous test SHA-256: `bd521c81ceb09dfd1f3fee8d49d2403c64d4bd97de9b83f1466e6ba008f0eaac`. The [original independent review](evidence/diagnostic-template-selection-preparation-20260926T223556Z/phase-independent-review.md) records that checkpoint's scope and limitations. Its [offline verification](evidence/diagnostic-template-selection-preparation-20260926T223556Z/offline-verification.json) confirmed **27/27 protected pins unchanged**, both completed helpers unchanged, Python 3.7 grammar accepted, fixed plans matching the templates and dormant admission rejected. These historical hashes are not pins for the refined helper.

Status: **PREPARED_AND_MOCK_TESTED / NATIVE_NOT_PERFORMED**. No current editor ownership, selection UI, resource admission or fresh native manifest is asserted by these checks. The next native experiment remains separately scoped.

No new native template comparison occurred. For all five rows above, stock identity, diagnostic identity, inspected properties, reference binding and equivalence remain **UNKNOWN in this work unit**. The previous [21:26 lookup](OBSERVER_DIAGNOSTIC_TEMPLATE_NATIVE_RESULT_2026-09-26.md) found no already-loaded fixed objects; the [22:05 load attempt](OBSERVER_DIAGNOSTIC_TEMPLATE_LOAD_RESULT_2026-09-26.md) resolved the stock Blueprint and stopped at the unavailable diagnostic override root with zero template exports. This preparation does not upgrade either result.

Remaining questions are the diagnostic root's accessibility after selection, live inherited-template/reference structure, generated-component replacement warnings, localization-validator ensure disposition, fresh-process readback and the independent package/runtime gates. No package-safety conclusion follows from this helper or its tests.

Next action: after focused review is complete and the separately scoped selection experiment is authorized, capture/review stock evidence in the existing editor before attempting diagnostic selection. Stop if the stock phase is incomplete; do not load stock, restart or switch to manufacture a baseline.
