# Diagnostic controller copy review — September 25, 2026

**READY_FOR_BOUNDED_AUTHORING_SOURCE_ONLY.** The actual mod-copy export preserves every node, pin, link, graph registration and exported class-default value in the three registered stock graphs. No demonstrated graph/default regression blocks continuing the separate Phase A authoring task. This is not a clean compile, resolved reload warning, package or runtime result.

The [complete comparison record](OBSERVER_DIAGNOSTIC_CONTROLLER_COPY_REVIEW_2026-09-25.json) pins all input files and enumerates every detected difference. The [native copy-only receipt](evidence/editor-source/diagnostic-controller-copy-20260925T192618Z-cfd90ca1/report.json) reports two successful exports, no exporter errors, exact mod-copy Blueprint/CDO identities, and unchanged hashes for nine installed files plus three historical baseline files. The [earlier identity inventory](evidence/editor-source/diagnostic-controller-copy-20260925T191753Z-5a4f3b86/report.json) established that stock-path queries returned the mod-copy identities; those aliases were rejected, with zero exports.

## Scope and complete comparison

The current [mod-copy source](evidence/editor-source/diagnostic-controller-copy-20260925T192618Z-cfd90ca1/mod-copy-source.COPY) and [defaults](evidence/editor-source/diagnostic-controller-copy-20260925T192618Z-cfd90ca1/mod-copy-defaults.COPY) were compared with the [historical stock source](evidence/editor-source/observer-caller-20260921T044217Z-54302cc3f1af/source.COPY), [defaults](evidence/editor-source/observer-caller-20260921T044217Z-54302cc3f1af/defaults.COPY) and [receipt](evidence/editor-source/observer-caller-20260921T044217Z-54302cc3f1af/report.json). That earlier receipt pins the same stock disk SHA256 `7107745a8de461275a7acfa1f3ffc5be9bcb7002682c37b7705af5f00783e4f6`. It remains a **historical comparison baseline**, not an observation of current stock memory.

The only value normalization replaced the exact self-package prefix `/ModOverride/LanceObserverDiagnosticControl/Modes/InstantAction/InstantActionPlayerController` with `/Game/Modes/InstantAction/InstantActionPlayerController`: four occurrences in source, one in defaults. Complete object trees were compared by declaration/definition and object name, with object emission-order changes recorded separately. No GUID, pin, type, link or property value was discarded or normalized. All 56 common object blocks were inspected.

| Registered graph | Nodes | Pins | Linked pins | Comparison |
|---|---:|---:|---:|---|
| UserConstructionScript | 2 | 4 | 2 | Every node/property/pin identical; entry-to-parent construction remains connected. |
| EventGraph | 2 | 10 | 0 | Both original disconnected setters and all properties remain identical. |
| CheckAndShowPostMissionScreen | 11 | 35 | 25 | Every node/property/pin and graph property identical; object emission order differs. |

The original parent class, `FunctionGraphs`/`UbergraphPages` registrations, graph GUIDs, ordered `Nodes` arrays, construction/postmission parent calls and postmission branches remain unchanged. The `SimpleConstructionScript` and `InheritableComponentHandler` references remain unchanged. Neither referenced generated structure is fully exposed by these exports.

## Every observed difference

1. **Six omitted object blocks:** declaration and definition pairs for `ExecuteUbergraph_InstantActionPlayerController`, `EdGraph_0` and `EdGraph_1`. Historical source lines 44–81 and 247–420 contain those blocks, totaling 40,360 raw bytes. None is listed in the historical `FunctionGraphs` or `UbergraphPages` registrations. The three registered graphs above remain intact. The source export shrank from 83,932 to 43,446 bytes; these omissions account for most of that reduction. The precise compiler-internal cause and runtime significance are not established.
2. **Blueprint identity metadata:** `BlueprintGuid` changed from `00800D4E491D9CA79F18F3B6E3CF5AF7` to `9FC1925A4FB02F5489AA54B6837CB174`.
3. **Editor view state:** `LastEditedDocuments(1)` retains EventGraph but loses its saved view offset; `LastEditedDocuments(2)`, the saved postmission-function view, is absent. The underlying function remains registered and identical.
4. **Object emission order:** top-level source objects, the eleven postmission-node declarations/definitions, and the six CDO component declarations/definitions are reordered. Object sets and all common member properties remain unchanged except the separately enumerated omissions/metadata above.
5. **Self-package references:** the five exact prefix substitutions described above. The defaults export increased from 9,087 to 9,125 bytes; after that prefix substitution and accounting for component-object order, every header and property is identical. There are zero added object blocks and zero CDO property-value changes.

## Unresolved warnings and next boundary

The editor log at 18:47:46 UTC records a handled localization-validator ensure. At 18:47:48 it records missing replacement objects for `PlayerControllerSwitchMech_GEN_VARIABLE`, `PlayerControllerAirStrikeComponent_GEN_VARIABLE` and `ControllerFeedbackComponent_GEN_VARIABLE` during reload of the exact mod copy. The three ordinary CDO reference fields are `None` in both exports, but the generated template objects named by the warnings are not exposed here. Matching those values does **not** resolve the warnings or establish complete in-memory health.

Continue only the isolated, reversible Phase A authoring scope, retaining the pre-edit copy and these receipts. Its final compile, save/reopen and graph/default review remain required before a package decision; investigate any new compile failure or warning rather than treating this comparison as acceptance. No UI input, installed-file modification, native export, compile, cook or game action was performed by this independent review.
