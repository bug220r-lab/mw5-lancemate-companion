# Diagnostic control checkpoint — 2026-09-25 21:43 UTC

**OBSERVED / SAVED_INTERMEDIATE_CHECKPOINT.** The diagnostic controller compiled and has a verified saved backup. This note also records the subsequent 21:49 UTC widget inspection, which stopped before changing text. It is not final source acceptance, a packaging result or a game test.

## Saved controller

The exact saved asset is:

`C:\Program Files\Epic Games\MechWarrior5Editor\MW5Mercs\Plugins\LanceObserverDiagnosticControl\ModOverride\Modes\InstantAction\InstantActionPlayerController.uasset`

| Item | Observed value |
|---|---|
| Saved timestamp recorded in native inspection receipt | `2026-09-25T21:43:44.9336853Z` |
| File size | 92,019 bytes |
| SHA256 | `ba725129011767a82935bd36a811ce2583bfebbfbbd8c4b2cff3fcbc1ca14948` |
| Project-local backup | `artifacts/diagnostic-control-authoring-20260925/controller-display-cleanup-checkpoint.uasset` |
| Backup verification | Same 92,019-byte size and SHA256, independently read during preparation of this note |

This supersedes the earlier 61,058-byte controller checkpoint only as a saved-file pin. It does not establish that every graph connection, inherited component or default is correct.

## Native editor evidence

Applicable editor: installed Mercenaries UE4 editor, process 20352, process creation identity `134348399116267644`. The captured controller window was HWND `12324270`. These are historical evidence identities, not handles to reuse for input.

- **OBSERVED:** `research/evidence/window-bridge/editor-d78c1d77deda498c86f82861c0e27843/capture-4bf72f1f76fe47a0800d7e6a83363e99/client.png`, captured at `2026-09-25T21:43:10.758892Z`, visibly reports `Compile of InstantActionPlayerController successful! [in 273 ms]` for the diagnostic ModOverride asset. Its SHA256 is `ef39dff35a2007cc14844d96ba8816fe851ff68cfd4590f7e4a845ddda0fc753`.
- **OBSERVED:** the earlier cleanup view, `research/evidence/window-bridge/editor-d78c1d77deda498c86f82861c0e27843/capture-953691c65e434da5826ffb9dc2f56183/client.png`, shows Event End Play, Parent: End Play with the reason connection, the owned Control Readout reference, validity checks, Remove from Parent and a Set Control Readout node with no object value selected. The display nodes visible in the same view include Add to Viewport with ZOrder 1000 and ObserverDiagnosticSnapshot Pressed connected to Do Once. Its SHA256 is `471aa1a3c769f8b207905cc177d427be2368d77067127c795944e80225634351`.
- The screenshots show only part of the graph, with crossing wires and the widget creation portion outside the view. They support this checkpoint record, not a complete graph audit. The visible inherited-components list is not a structural proof of inherited-component integrity.
- The save-click action receipt records input insertion at 21:43:44 UTC, but its automatic post-input capture was refused because foreground changed. The saved-file hash and matching backup above provide separate disk evidence; the input receipt alone is not treated as proof that saving succeeded.

## Widget inspection stopped before mutation

Native receipt:

`research/evidence/editor-source/diagnostic-widget-text-20260925T214943Z-4a63aeb9/report.json`

Receipt size: 10,305 bytes. SHA256: `f76f93d53b9d849048c583302f1c6de45d1d7b092109d565fe24f09ef0ea92e5`.

**OBSERVED:** status `STOPPED_BEFORE_TEXT_CHANGE`, `mutation_attempted: false`, error `PRE_MUTATION_NATIVE_EXPORT_DRIFT_REQUIRES_NEW_BASELINE_REVIEW`. The exact diagnostic widget, generated default object and `WidgetTree.SnapshotText` identities/outer chain were found. Both the property readback and exported text remained `Observer preview`; the requested `CONTROL A — OUTPUT ONLY` text was not applied by this attempt.

| Export | Bytes | SHA256 |
|---|---:|---|
| `before-source.COPY` | 16,812 | `28c300de9adb1239c29c32a5fb62e321ebdb6af44745cd8c8d29766138fc0983` |
| `before-defaults.COPY` | 1,974 | `1d77c8de7050ef9c1e5781ab1cec67ad08dc8c96d48d4fcde25588c92ce1a050` |

Both exports were independently checked against their recorded size/hash. The defaults still match the 20:14 duplication export, while the full source export does not.

**OBSERVED, limited source comparison:** comparison of the two registered widget graphs against `diagnostic-widget-copy-20260925T201450Z-0d8a7d1e/widget-source.COPY` found the complete object fields and raw pin records unchanged for `SetSnapshot` and `EventGraph`, each with three node records. This independently corroborates the separate registered-graph review. The newer source no longer contains the earlier auxiliary `EdGraph_1` and `ExecuteUbergraph_WBP_ObserverDiagnosticControl` object records, and includes the WidgetTree `AllWidgets` entries. These source differences require an explicitly reviewed replacement baseline; unchanged registered graphs do not justify bypassing the failed whole-export pin.

The receipt records `destination_file_exists_after: false`: the diagnostic widget remained unsaved at this checkpoint. Do not reinterpret later work as evidence that it was saved here.

## Protected inputs and remaining gates

**OBSERVED:** all nine protected files match before and after the stopped attempt: the original observer's seven content/configuration files, the stock Instant Action controller and the current diagnostic controller checkpoint. Their nine size/hash pins were independently rechecked when this note was prepared. No protected input changed during the recorded attempt.

| Remaining result | Status at this checkpoint |
|---|---|
| Diagnostic widget target text applied and saved | NOT_PERFORMED |
| Final complete controller/widget source export and review | NOT_PERFORMED |
| Final saved assets reopened and read back | NOT_PERFORMED |
| Resolution of prior localization/generated-component warnings | NOT_ESTABLISHED by this checkpoint |
| Diagnostic control cook/package inspection | NOT_PERFORMED |
| Retail deployment or Instant Action test of this diagnostic control | NOT_PERFORMED |
| Runtime input, display, cleanup or inherited-behavior acceptance | NOT_PERFORMED |

The next authoring step needs the newly exported widget baseline reviewed and pinned before another text attempt, followed by widget compile/save and final two-asset inspection. Packaging and any game test require their separate source/configuration, resource, test and rollback checks. The original probe's missing overlay remains a separate inconclusive observation.
