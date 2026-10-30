# Native template lookup result — 2026-09-26

**OBSERVED: NATIVE LOOKUP PERFORMED ONCE; TEMPLATE COMPARISON UNKNOWN.** At 21:26:45 UTC the reviewed helper queried all ten exact diagnostic/stock paths in the running editor. Every query returned `NOT_ALREADY_LOADED`. The run finished in 1.578 seconds with no errors, no exports and no loading fallback. This is not evidence that saved templates are absent or corrupt.

The [native receipt](evidence/editor-source/diagnostic-templates-20260926T212645Z-273373d9/report.json) is 44,529 bytes, SHA256 `b4cb2bd02dca7de06d871b8473e2dfcf87eed958df034318f0a63e59c1061b79`. The only other native output is `started.json` (19,308 bytes; SHA256 `a2588ecac625ea4015b3c251858f2b762ffad8ef31c2822b778d93391548e6ae`). The earlier [preparation result](OBSERVER_DIAGNOSTIC_TEMPLATE_INSPECTION_RESULT_2026-09-26.md) remains a historical record of the editor-unavailable stage.

## Exact baseline and preserved source

[Attempt baseline](evidence/diagnostic-template-native-20260926T211653Z-1ecf0ae7/baseline.json): branch `codex/companion-foundation`, HEAD `2d078efd1554b0452c29ed261deb211209d57866`. A fresh GitHub compare reported the same remote branch identical. Six modified tracked files and sixteen untracked files existed before this resumed unit; their status entries were preserved. No branch change, commit or push occurred.

Editor: official `MechWarrior5Editor/Engine/Binaries/Win64/UE4Editor.exe`, PID **11980**, creation FILETIME **134349304323350249**. Installed build metadata records UE4 **4.26.2**, compatible changelist **14830424**. The user's confirmation that the editor was free was verified in the coordinating chat; that coordinator remained idle and committed to no concurrent input. This chat alone operated the editor; its reviewer remained read-only.

The source checkpoint remains [SOURCE_CHECKPOINT.json](evidence/editor-authored/LanceObserverDiagnosticControl-20260925T222809Z-548b77b2-source-checkpoint/SOURCE_CHECKPOINT.json), SHA256 `e178797fac03c6558f427a862fc1d6c0750c3198f190a18d6e528416477b698f`.

| Protected asset | Bytes | SHA256 |
|---|---:|---|
| Final diagnostic controller and frozen backup | 92,019 | `ba725129011767a82935bd36a811ce2583bfebbfbbd8c4b2cff3fcbc1ca14948` |
| Diagnostic widget and frozen backup | 30,768 | `80f52bb21156b638ca22d6c8ab778bfcfc7a6feb1f26286977a3324ac5978b4b` |
| Installed stock controller | 53,635 | `7107745a8de461275a7acfa1f3ffc5be9bcb7002682c37b7705af5f00783e4f6` |

**27/27 protected pins matched before, during and after**, including 23 source/backup/original files, checkpoint, freeze and two reused utilities. Root and reviewer independently rechecked them after execution. Original selection remained present and empty; diagnostic selection remained absent. See [after-verification.json](evidence/diagnostic-template-native-20260926T211653Z-1ecf0ae7/after-verification.json).

## Review and test disposition

One reviewer issued [READINESS_REVIEW_PASS](evidence/diagnostic-template-native-20260926T211653Z-1ecf0ae7/independent-readiness-review.md) for the exact manifest/entry, then [RECEIPT_REVIEW_PASS; DIAGNOSTIC_RESULT_UNKNOWN](evidence/diagnostic-template-native-20260926T211653Z-1ecf0ae7/independent-result-review.md) for the actual output. No reviewer native/UI call occurred.

The helper is unchanged at SHA256 `df090dbdbb4f0e8869819b6dc046b48fa3df881bb576506ed4a5760f552ef27c`. Its prior **29/29 focused tests remain MOCK_ONLY**; no unnecessary test rerun or full suite ran in this unit. The new entry was syntax-checked and independently reviewed, then executed once through File → Execute Python Script.

Native manifest SHA256: `7723f40d31b242eedde8f383ce14a62eb52cd216f5ef5b49db99dd71bc888a9d`. Entry SHA256: `d67d832ea38cc5010b8ae67a9dccaf083ac0a882fa0d81d5ecce225abd5353ca`. Dispatch preceded the manifest's 21:27:49 UTC expiry. Retain these as completed-attempt evidence; do not reuse this expired entry/manifest.

## Per-template comparison

Each full queried identity is the prefix below, followed by `:` and the row's suffix. These are queried identities; **no native object identity, class or outer was returned**.

- Stock prefix: `/Game/Modes/InstantAction/InstantActionPlayerController.InstantActionPlayerController_C`
- Diagnostic prefix: `/ModOverride/LanceObserverDiagnosticControl/Modes/InstantAction/InstantActionPlayerController.InstantActionPlayerController_C`

| Object suffix | Diagnostic query | Stock query | Properties, references and comparison |
|---|---|---|---|
| `SimpleConstructionScript_0` | NOT_ALREADY_LOADED | NOT_ALREADY_LOADED | UNKNOWN; no nodes, templates or references inspected. |
| `InheritableComponentHandler` | NOT_ALREADY_LOADED | NOT_ALREADY_LOADED | UNKNOWN; no inheritance records or targets inspected. |
| `PlayerControllerSwitchMech_GEN_VARIABLE` | NOT_ALREADY_LOADED | NOT_ALREADY_LOADED | UNKNOWN; no loaded fields, inherited values or targets inspected. |
| `PlayerControllerAirStrikeComponent_GEN_VARIABLE` | NOT_ALREADY_LOADED | NOT_ALREADY_LOADED | UNKNOWN; no loaded fields, inherited values or targets inspected. |
| `ControllerFeedbackComponent_GEN_VARIABLE` | NOT_ALREADY_LOADED | NOT_ALREADY_LOADED | UNKNOWN; no loaded fields, inherited values or targets inspected. |

There are no native matching/differing property findings. Stock-to-copy aliasing is **UNKNOWN**, not a pass from an empty comparison. The earlier [saved-package audit](OBSERVER_DIAGNOSTIC_TEMPLATE_BINARY_AUDIT_2026-09-26.md) still documents three final serialized templates with matching normalized stock stubs; the current unchanged hashes keep that evidence applicable to these files. It does not establish live reference health or recovery from the historical reload warnings.

## Files changed and action boundary

This unit refreshed only the project-local inspection manifest and added this report, two native receipts, UI capture/action receipts, and the [new attempt directory](evidence/diagnostic-template-native-20260926T211653Z-1ecf0ae7/): `baseline.json`, preserved prior manifest, reviewed candidate manifest, `run-inspection.py`, independent readiness/result reviews, and `after-verification.json`. Helper/test code, native assets, original observer, shared README/NEXT documents and other workers' files were not edited.

The standard screenshot route timed out twice and exposed no usable accessibility controls. The previously user-authorized WindowBridge workaround supplied fresh exact-window captures and single guarded inputs. A wrong foreground binding and changed-pixel text attempt were rejected before input; fresh observations resolved both. No stale identity was used. The File picker was closed by the single dispatch; editor PID 11980 remained responding afterward.

**NOT_PERFORMED:** asset loading/editing, compile/save, mod-selection change, package reload, editor restart, cook/package/install, retail activity, command dispatch, speech/model work, commit or push. The current work unit is stopped.

**Remaining questions:** actual SCS/handler contents, inherited component defaults and reference targets, stock/copy independence, saved-memory equivalence, consequences of the earlier ReloadPackage warnings, and localization-validator ensure disposition. Package/runtime gates remain unpassed.

**One next action — PROPOSED ONLY:** prepare a separate bounded exact-package disk-readback/loading experiment for the frozen diagnostic controller and an independent stock baseline. It must establish supported package resolution, exact identity, baseline/stop/rollback evidence, and obtain authorization for loading before execution. Keep no-save/no-compile/no-restart/no-selection-change boundaries unless explicitly expanded. No repair is justified by this missing-object result.
