# Exact-package loading inspection — 2026-09-26

**OBSERVED: ONE NATIVE ATTEMPT; DIAGNOSTIC OVERRIDE ROOT NOT MOUNTED.** Stock loaded as the exact expected Blueprint. The diagnostic copy returned `None`; the editor explicitly rejected its `/ModOverride/LanceObserverDiagnosticControl/` root. The helper stopped before any template query or export. Template/reference health remains **UNKNOWN**, not corrupt or absent on disk. This work unit is complete at its stop boundary; packaging and runtime gates remain unpassed.

## Actual run and evidence

The user said **“Proceed”** after the proposal for a separate bounded exact-package loading inspection. That covered two fixed controller roots and the existing ten-object inspection; no mod switch, package reload, restart, compile/save, cook, retail or repair fallback was included.

The reviewed entry dispatched once at **22:05:45 UTC**, before its 22:10:32 UTC expiry. The native helper completed in **0.844 seconds** with status `STOPPED_PARTIAL_REQUIRES_REVIEW`, native disposition `ATTEMPTED_PARTIAL`, and `EXACT_ROOT_UNAVAILABLE_UNKNOWN: diagnostic`.

- [Native report](evidence/editor-source/diagnostic-templates-20260926T220545Z-fd9bfcf6/report.json): 40,034 bytes; SHA256 `be2fedd10a86389526d10acf593fab682bebf0f8a0948ef43770979bc3c29381`.
- [Editor log delta](evidence/diagnostic-template-load-20260926T214811Z-2eb064c1/native-log-delta.txt): 3,018 bytes, captured from the pre-run byte offset 126,278. Lines 2–6 record invalid-root/load failures; lines 7–8 record the stopped result.
- [Attempt directory](evidence/diagnostic-template-load-20260926T214811Z-2eb064c1/) contains baseline, reviewed manifest, entry, persistent one-dispatch claim, tests and independent reviews. Native output consists of `started.json`, two before-load receipts and `report.json`; there are no exports or template inventories.

| Root | Exact query identity | Native result |
|---|---|---|
| Stock | `/Game/Modes/InstantAction/InstantActionPlayerController.InstantActionPlayerController` | Initially not loaded; one load returned this exact path, class `/Script/Engine.Blueprint`, and outer `/Game/Modes/InstantAction/InstantActionPlayerController`. |
| Diagnostic | `/ModOverride/LanceObserverDiagnosticControl/Modes/InstantAction/InstantActionPlayerController.InstantActionPlayerController` | Initially not loaded; one load returned `None`. Editor log rejects the override root as unregistered in this session. |

The log's accepted roots include `/LanceObserverDiagnosticControl/` for normal content and `/ModOverride/LanceObserverProbe/` for the selected original mod. They do **not** include the diagnostic override root. Normal diagnostic content mounting does not establish override mounting. No alternative path or mount-registration call was attempted. The two loader error pairs are engine messages from the single diagnostic `load_asset` call, not helper retries.

## Baseline and integrity

Branch `codex/companion-foundation`; HEAD **`2d078efd1554b0452c29ed261deb211209d57866`**. Fresh remote compare returned identical (zero ahead/behind). Six modified tracked files and seventeen untracked files were present at this unit's baseline and preserved. No branch change, commit or push occurred.

Editor identity: official UE4Editor.exe, PID **11980**, creation FILETIME **134349304323350249**, installed UE4 **4.26.2**. The same process remained responding after execution. Research alone operated the editor; the coordinator remained idle and its existing commitment to no concurrent editor input was verified. The independent reviewer made no native calls.

The [frozen source checkpoint](evidence/editor-authored/LanceObserverDiagnosticControl-20260925T222809Z-548b77b2-source-checkpoint/SOURCE_CHECKPOINT.json) remains SHA256 `e178797fac03c6558f427a862fc1d6c0750c3198f190a18d6e528416477b698f`.

| Protected source | Bytes | SHA256 |
|---|---:|---|
| Final diagnostic controller and backup | 92,019 | `ba725129011767a82935bd36a811ce2583bfebbfbbd8c4b2cff3fcbc1ca14948` |
| Diagnostic widget and backup | 30,768 | `80f52bb21156b638ca22d6c8ab778bfcfc7a6feb1f26286977a3324ac5978b4b` |
| Stock controller | 53,635 | `7107745a8de461275a7acfa1f3ffc5be9bcb7002682c37b7705af5f00783e4f6` |

**27/27 protected files matched before, during and after.** Original `ActiveMod.txt` remained present and empty; the diagnostic marker remained absent. [Independent disk recheck](evidence/diagnostic-template-load-20260926T214811Z-2eb064c1/after-verification.json). No automatic restoration or unload was performed; stock remains loaded in editor memory.

## Review and focused tests

[Independent readiness review](evidence/diagnostic-template-load-20260926T214811Z-2eb064c1/independent-readiness-review.md): **READINESS_REVIEW_PASS** for the exact helper, manifest and entry. The reviewer requested a correction to the receipt's maximum-operation wording; it was applied before final review. [Independent result review](evidence/diagnostic-template-load-20260926T214811Z-2eb064c1/independent-result-review.md): **RECEIPT_REVIEW_PASS; DIAGNOSTIC_OVERRIDE_MOUNT_UNAVAILABLE; TEMPLATE_HEALTH_UNKNOWN**, with independently rechecked 27/27 hashes, selection and responding process at 22:08:09 UTC.

The original **29/29** focused checks and new **16/16** loading checks passed; all are **MOCK_ONLY**. The initial new suite passed 15/16 because one test expected the wrong stop-status label; its log and corrected runs are retained. A preparation command also hit a Python string-escaping syntax error before execution; the corrected project-local preparation file then succeeded. No preparation error touched native assets.

The new checks cover exact stock-first loading, no reload of resident roots, missing roots, initial and post-load stock aliases, wrong classes, file/selection drift, resource failures, user stop, and truthful missing-template results. The native attempt establishes only the outcomes above; successful mock tests do not establish healthy native templates.

Final reviewed pins:

- Loading wrapper: `30697c7e5d2011af33644e031e0bae2c20e556e627cc3295222a0f8b84c2d1d2`.
- Reused inspector with optional preparation hook: `8b92919782afdc799b2c415d7c18cba0282be24e0bf7c698e9a54500ecb018fd`.
- Manifest: `60af0d5131e276d7567c4a78542d33c33091f3dba9ddca3c0658c84567fce84a`.
- Entry: `e150ebc8f71c58302a5d31515d65ac7c12bf3052fdb3ca14296e061b31bdc9ad`.

The native claim prevents a second dispatch of this attempt. Retain these files as completed-attempt evidence; do not reuse them.

## Per-template result

| Fixed template | Stock properties/references | Diagnostic properties/references | Comparison |
|---|---|---|---|
| `SimpleConstructionScript_0` | NOT_INSPECTED | NOT_INSPECTED | UNKNOWN |
| `InheritableComponentHandler` | NOT_INSPECTED | NOT_INSPECTED | UNKNOWN |
| `PlayerControllerSwitchMech_GEN_VARIABLE` | NOT_INSPECTED | NOT_INSPECTED | UNKNOWN |
| `PlayerControllerAirStrikeComponent_GEN_VARIABLE` | NOT_INSPECTED | NOT_INSPECTED | UNKNOWN |
| `ControllerFeedbackComponent_GEN_VARIABLE` | NOT_INSPECTED | NOT_INSPECTED | UNKNOWN |

The load prerequisite failed before the ten fixed lookups. No root post-load requery pair was reached and no stock/copy template independence is claimed. The earlier [saved-package audit](OBSERVER_DIAGNOSTIC_TEMPLATE_BINARY_AUDIT_2026-09-26.md) remains applicable to unchanged bytes, but native reference health, inherited fields, fresh-process disk/memory equivalence, historical ReloadPackage warning impact and localization-validator ensure disposition remain unresolved.

## Files changed and next action

Added `scripts/Inspect-DiagnosticTemplateLoad.py`, `scripts/Test-DiagnosticTemplateLoad.py`, `research/OBSERVER_DIAGNOSTIC_TEMPLATE_LOAD_MANIFEST.json`, this report and the attempt/UI/native evidence. Extended `scripts/Inspect-DiagnosticTemplates.py` with an optional preparation hook under its existing lock and truthful load-run metadata. Its original entry still performs no loads; exact preceding bytes are preserved as `Inspect-DiagnosticTemplates.before.py`. No shared README/NEXT or other workers' files were edited.

UI evidence is in WindowBridge sessions `editor-47553bdfeffd4a5a89719f40ccea45b1`, `editor-d117b6c34e854f13943a4af067357923` and `editor-9e19eb4cf539474e956bca7eaafe038e`. Two invalid review-region requests were rejected with zero input, then corrected using fresh captures. The script picker closed on dispatch; no editor restart or mod change occurred.

**One next action — PROPOSED ONLY:** prepare a bounded two-phase active-mod selection experiment: first capture the five independently resolved stock objects while the original mod is selected, then activate the diagnostic mod and inspect its five exact objects, with a recorded selection rollback to the original. Review the editor's supported activation behavior and its reload consequences before execution; changing active mod is a new boundary. Reject stock queries that alias after activation. Do not attempt repairs, cooking or retail work on this evidence.
