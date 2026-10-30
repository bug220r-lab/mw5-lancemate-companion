# Diagnostic controller final source review — 2026-09-25

**OBSERVED / SOURCE_WIRING_REVIEW_COMPLETE_WITH_LIMITATIONS.** The final native export contains the intended one-shot diagnostic display and owned-widget EndPlay cleanup connections. Existing construction and postmission graph connections are preserved. No demonstrated wiring/default regression was found in the exposed source. Three existing-pin metadata differences and unresolved generated-component/template warnings remain explicitly recorded below. This is not package readiness or shipping-game acceptance.

## Evidence and integrity

Final native evidence directory: `research/evidence/editor-source/diagnostic-final-source-20260925T221745Z-530263a1/`.

The receipt is `COLLECTED_REQUIRES_SOURCE_REVIEW`, with zero exporter errors, exact controller Blueprint/CDO identities and `exact_load_attempted: false`. Receipt SHA256: `203245c934b937c0aa3b87a429cf7a857235c2574c4c77f40787f988154ab839` (12,552 bytes). The exporter itself performed no asset mutation, save, compile, UI, cook or retail operation.

| Controller evidence | Bytes | SHA256 |
|---|---:|---|
| Saved diagnostic controller `.uasset` | 92,019 | `ba725129011767a82935bd36a811ce2583bfebbfbbd8c4b2cff3fcbc1ca14948` |
| `controller-source.COPY` | 97,628 | `1c46d0589b6c79342fcba90857d0ea1970d463325a9eeb00a31e86fbd2afa0db` |
| `controller-defaults.COPY` | 9,149 | `fbb353fde17e65e1826227844d75220df3adf2cc3ab09d90229edc3d0044d8d2` |
| `controller-source-inventory.json` | Derived lexical inventory | `ea9f9ba04cc33c38d8fb9d86b0cc933c2df914538c236a05204edf0e12b66e9b` |
| `controller-defaults-inventory.json` | Derived lexical inventory | `50df1e2656a7b0eaa51826b1c2e6fbbfb32d39bb806be843c533d1bef458c641` |

The exact controller object is `/ModOverride/LanceObserverDiagnosticControl/Modes/InstantAction/InstantActionPlayerController.InstantActionPlayerController`; its CDO is the corresponding `.Default__InstantActionPlayerController_C`. Saved file location is the diagnostic plugin's `ModOverride/Modes/InstantAction/InstantActionPlayerController.uasset` under the installed editor.

**Independently verified during this review:** all four final export files and their four inventory hashes match the native receipt; all twelve before/after disk-pin records are identical, and all twelve current installed files match those size/hash pins. That set covers the original observer's seven files, stock controller, diagnostic `.uplugin`, diagnostic input configuration, diagnostic controller and diagnostic widget. The paired widget source is reviewed separately; matching its hash here is not its semantic approval.

Comparison baselines:

- Isolated pre-authoring copy: `research/evidence/editor-source/diagnostic-controller-copy-20260925T192618Z-cfd90ca1/mod-copy-source.COPY` and `mod-copy-defaults.COPY`. Their recorded SHA256 values are `07ac445c6a13ff8f7143c938ad920a1df9e2ffce247a59419724927916bccaa7` and `47768e473f46d951feccc60eaf879c3abf8e1c396051de0b68771529f3e7c912`.
- Historical stock: `research/evidence/editor-source/observer-caller-20260921T044217Z-54302cc3f1af/source.COPY` (83,932 bytes, SHA256 `6690e8c5a192d28cc15f84798c6e053fe3f543728f7aecee0f2ce81968c6a0fd`) and `defaults.COPY` (9,087 bytes, SHA256 `fa10c21c165e2ab68a2d7c841c413909fc3ff04b58097d1a15b710c2cbedf7c0`). These hashes were independently verified. This remains a historical memory baseline; current stock disk hash matching does not prove current stock memory equivalence.

Object records were compared by full nested identity, with raw fields/pin records retained. For the direct historical-stock comparison, only the exact diagnostic self-package prefix was changed to the exact historical stock prefix. No link, pin identifier or default was discarded. The three specific metadata-boolean differences below were identified before comparing the remaining pin fields.

## Existing behavior exposed by the exports

| Existing source | Result |
|---|---|
| `UserConstructionScript` | Same graph GUID, two node records, four pins, entry-to-parent execution connection, node fields and pin IDs/types/defaults/links. One hidden-self pin metadata boolean differs, listed below. |
| `CheckAndShowPostMissionScreen` | Same graph GUID, eleven node records, 35 pins, ordered node registration and parent/branch/function-result links. Two branch-pin metadata booleans differ, listed below. |
| Two original EventGraph setter objects | `K2Node_VariableSet_0` and `_1` remain identical to both prior baselines, with ten pins total and no links. Neither the prior isolated export nor the final export lists these two objects in its `Nodes(...)` array. Their serialized presence is not evidence of registered or executable nodes. |
| Blueprint registration/parent | `UbergraphPages(0)=EventGraph`, `FunctionGraphs(0)=UserConstructionScript`, `FunctionGraphs(1)=CheckAndShowPostMissionScreen`, and parent `/Game/Objects/_common/MW5PlayerController.MW5PlayerController_C` remain unchanged. Final source lines 458–464. |
| Class defaults | Seven exported object records retained: root plus six component objects. Every prior exported class/default/component field is unchanged. The sole added root default is `ControlReadout=None` at defaults line 26. |

This corrects the earlier copy review's overly broad description of the two disconnected EventGraph setters as registered nodes. The actual prior/final registration text is the authority; this correction does not identify a newly removed connection.

## New diagnostic display path

The final EventGraph explicitly lists thirteen new node records at source lines 442–454. These nodes contain 47 pins. Together with the ten unchanged pins on the original setter objects, the graph export has 57 pins, 31 linked-pin endpoints and **17 reciprocal link pairs**. Every linked node/pin target resolves within this graph and every reverse link is present. Those seventeen pairs comprise ten execution connections and seven data connections.

The execution path is:

`ObserverDiagnosticSnapshot.Pressed → Do Once → Create Widget → Set ControlReadout → Is Valid → AddToViewport`

| Required detail | Native source evidence |
|---|---|
| F8 input | Diagnostic `Config/Input/LanceObserverDiagnosticControlInput.ini`, line 22, maps `ObserverDiagnosticSnapshot` to `F8` with Shift/Ctrl/Alt/Cmd false. Pinned file is 1,498 bytes, SHA256 `d1a5492fcb7e0ad41d8f4eb15e953fd0032e174510f3db89a74fec5901dbbd3f`. Export input name and `bConsumeInput=False` are at lines 422–423. |
| Only Pressed enters display path | Input Pressed and Do Once execute are mutually linked at lines 427 and 416. Released and Key are unconnected. |
| One-shot node | Do Once references the actual engine StandardMacros `DoOnce` graph at line 412. Reset is unconnected. The native UI checkpoint visibly shows Start Closed unchecked; the source pin itself has no explicit serialized default value. |
| Correct widget class | Create Widget Class default is `/LanceObserverDiagnosticControl/WBP_ObserverDiagnosticControl.WBP_ObserverDiagnosticControl_C`, line 437. |
| Owning Player is Self | Self output to Create Widget OwningPlayer, lines 367 and 439. |
| Store exact created widget | Create Widget ReturnValue to Set ControlReadout input, lines 438 and 359. Execution links are lines 436 and 357. |
| Validate stored widget | Set output reference to Is Valid InputObject, lines 361 and 385; execution at lines 358 and 384. |
| Display only validated reference | Is Valid success to AddToViewport execute, lines 386 and 347; AddToViewport target is that same Set output reference, lines 349 and 361. |
| ZOrder | AddToViewport `DefaultValue="1000"`, line 350. Its autogenerated default remains 0; the authored default is 1000. |

The display validity failure output is unconnected, so that path ends. AddToViewport's execution output is also unconnected. No reset/retry path is connected. `ExecuteWhenPaused` is not explicitly serialized by this export; its current value must not be invented from an omitted field. Input routing in the shipping game remains untested.

## EndPlay cleanup and parent call

The authored cleanup is:

`Event EndPlay → Is Valid(ControlReadout) → RemoveFromParent(ControlReadout) → Set ControlReadout(None) → Parent EndPlay`

The invalid-reference branch bypasses RemoveFromParent and reaches that same clear-reference node, then Parent EndPlay.

- EndPlay execution goes to the cleanup Is Valid: source lines 338 and 374.
- The ControlReadout getter supplies both validity input and RemoveFromParent target: lines 318, 375 and 311. No other widget target is connected.
- The valid branch reaches RemoveFromParent at lines 376/309; its output reaches the clear Set node at 310/298.
- The invalid branch reaches the same clear Set node at 377/298.
- The clear Set's ControlReadout value pin has no link or object default, line 300; the UI checkpoint shows no selected object. The clear Set output reaches the parent call, lines 299/326.
- `K2Node_CallParentFunction_0` references Actor `ReceiveEndPlay`, line 322. The event's actual EndPlayReason is linked directly to the parent's EndPlayReason pin, lines 339/329, so the serialized `Destroyed` default is not substituted for the connected reason.
- The parent's execution output is unconnected; both cleanup branches converge before this single parent call. No input or end-event loop appears in these links.

This establishes the exposed authored call structure, not that every native or inherited teardown behavior has been observed in a running mission.

## Exact differences and warning limitations

Compared with the isolated pre-authoring source, all 22 existing full-path object records remain. Twenty-one records are added: thirteen diagnostic EventGraph nodes plus two auxiliary graph records with three node records each. The auxiliary graphs are `InpActEvt_ObserverDiagnosticSnapshot_K2Node_InputActionEvent_0` and `ReceiveEndPlay`; they contain calls to `ExecuteUbergraph_InstantActionPlayerController` and are not included in the Blueprint's three explicit registered graph fields. Their generated-looking structure is recorded, not promoted to an independent runtime/compiler-body proof.

Other observed changes are exactly:

1. New `ControlReadout` variable declaration, typed to the diagnostic widget class, with GUID `66B32CB44A97BF8DB59604A96F7FA74F` (source line 465), and `ControlReadout=None` in the CDO.
2. EventGraph's thirteen new `Nodes(...)` entries and the new records/links reviewed above.
3. EventGraph editor view metadata changed to offset `(-422.000000,-418.933319)` and zoom `0.750000` (line 498).
4. **Three existing-pin metadata changes:** construction parent-call hidden `self` pin `AFD05EB24277B66E9855DB9BC14A681F`: `PinType.bIsUObjectWrapper=False → True`; postmission branch `execute` pin `FD830DEA48B4F64572125A86524D57AE` and `Condition` pin `73E483F04AC1703057ADAAB026FCB8E2`: `True → False`. All other serialized fields of these pins match after the exact self-path normalization where applicable. The review does not silently call these pin records byte-identical or prove the reason for the metadata changes.

The final controller source/defaults contain no literal `/LanceObserverProbe` path. Newly introduced lexical paths correspond to the diagnostic widget, self skeleton class, standard Do Once/Is Valid macros, input/event node classes and the expected engine/UMG types. This is text-reference inspection, not complete cooked dependency closure.

**UNKNOWN/BLOCKED for complete template equivalence:** the previously recorded localization-validator ensure and reload warnings for `PlayerControllerSwitchMech_GEN_VARIABLE`, `PlayerControllerAirStrikeComponent_GEN_VARIABLE` and `ControllerFeedbackComponent_GEN_VARIABLE` remain unresolved by these exports. `SimpleConstructionScript` and `InheritableComponentHandler` references are unchanged (lines 460/464), but their generated template bodies are not exposed. The corresponding ordinary CDO fields remain `None` in prior and final exports (defaults lines 27–29), and the three component names remain visible in the editor's inherited-components list. Neither observation establishes that the missing replacement templates were correctly regenerated. A successful compile does not erase that limitation. Historical warning provenance is recorded in `research/OBSERVER_DIAGNOSTIC_CONTROLLER_COPY_REVIEW_2026-09-25.md`.

## Compile, save, asset-tab reopen and remaining boundary

`research/evidence/diagnostic-final-ui-checkpoint-20260925T2218Z.json` indexes the original UI receipts. The original receipt files and PNG hashes are authoritative. Its process-creation values were corrected to decimal strings to preserve the exact integer `134348399116267644`.

The controller compile, saved and reopened images were visually inspected:

- Compile image `capture-4bf72f1f76fe47a0800d7e6a83363e99/client.png`: successful native compile in 273 ms at the 21:43 UTC checkpoint; SHA256 `ef39dff35a2007cc14844d96ba8816fe851ff68cfd4590f7e4a845ddda0fc753`.
- Saved image `capture-af7dadc7c0b641cca75189dcb2f82f33/client.png`: compile success remains visible, with the authored cleanup; SHA256 `9e2d8fb9030d2d21cd33f332a0cd197c748bf6caaa83b1a6d44951a6cfa55a5b`.
- Asset-tab reopen image `capture-f9b763e5f04a42d78300494179f7fbb3/client.png`: same controller graph and class defaults, including Control Readout None; SHA256 `328e1e10cb010e36d95ba356ca6ee546ff7c3d0f2772c14ca70df69a2bcfe631`.

Asset-tab reopening in the same editor process is **not** a forced disk/package reload. The read-only final export confirms exact editor memory identities and unchanged disk pins, not equality of all editor memory with saved binary contents. Complete generated-template equivalence remains unknown; clean-process/disk reload, diagnostic package/cook inspection and shipping-game behavior are **NOT_PERFORMED by this review**. The final package decision must retain the warning limitations and the separate widget/configuration/resource gates.

This review used local native evidence and read-only comparison only. It performed no editor input, native execution, installed-asset modification, game launch, cook, installation or retail test.
