# Phase A final source inspection preparation

Prepared 2026-09-25; saved-file checkpoint verified at 22:04:29 UTC, activated after coordinator review, and native export completed at 22:17:45 UTC. **COLLECTED_REQUIRES_SOURCE_REVIEW.** This is source evidence, not final graph acceptance or a runtime test.

## Files and activation boundary

- `scripts/Inspect-FinalDiagnosticControl.py` — 19,186 bytes; SHA256 `055fe707fcd7044a294e6fef99732bb2373c38364ebc509de17eab5d1d0b0c60`.
- `research/OBSERVER_DIAGNOSTIC_CONTROL_FINAL_INSPECTION_MANIFEST.json` — 5,021 bytes; SHA256 `a4f18d3ca259b9bebbc6a5125bfacabfff8e0dbd238659a4445f6ece82f9dcb5`.

The immutable reviewed manifest records the saved checkpoints with `REVIEWED_READY_FOR_SOURCE_INSPECTION`, editor PID 20352 and review timestamp `2026-09-25T22:04:29Z`. `allow_exact_path_load` remains false. The coordinator reviewed the complete manifest and script, then pinned `REVIEWED_MANIFEST_SHA256` to `a4f18d3ca259b9bebbc6a5125bfacabfff8e0dbd238659a4445f6ece82f9dcb5`. Independent verification reconstructed the exact preceding script hash by reverting only the two activation comments and hash assignment; all twelve disk pins still matched. The manifest's note that the inspector was dormant describes its historical preparation stage and is preserved unchanged because the manifest is pinned evidence.

The coordinator reports both assets UI-compiled and saved. Current disk independently matches the controller at 92,019 bytes, SHA256 `ba725129011767a82935bd36a811ce2583bfebbfbbd8c4b2cff3fcbc1ca14948`, and widget at 30,768 bytes, SHA256 `80f52bb21156b638ca22d6c8ab778bfcfc7a6feb1f26286977a3324ac5978b4b`. All ten protected files also match; their manifest entries are unchanged. These twelve disk checks establish saved file identity, not graph correctness. Activation and native execution were performed by the coordinator, not by this preparation subtask. Do not rerun the completed inspector without a new concrete review need.

The [native receipt](evidence/editor-source/diagnostic-final-source-20260925T221745Z-530263a1/report.json), SHA256 `203245c934b937c0aa3b87a429cf7a857235c2574c4c77f40787f988154ab839`, records four successful exports totaling 142,237 bytes, no exporter errors, loading disabled with no load attempted, and all twelve pinned inputs unchanged. Its four source/default export hashes and four inventory hashes were independently rechecked. Exact native source collection is complete; separate controller/widget graph reviews, warning resolution, package and runtime evidence remain distinct.

## Exact source scope

| Label | Exact asset object | Expected source class |
|---|---|---|
| Controller | `/ModOverride/LanceObserverDiagnosticControl/Modes/InstantAction/InstantActionPlayerController.InstantActionPlayerController` | `/Script/Engine.Blueprint` |
| Widget | `/LanceObserverDiagnosticControl/WBP_ObserverDiagnosticControl.WBP_ObserverDiagnosticControl` | `/Script/UMGEditor.WidgetBlueprint` |

The two additional queried/exported objects are their exact observed generated defaults:

- `/ModOverride/LanceObserverDiagnosticControl/Modes/InstantAction/InstantActionPlayerController.Default__InstantActionPlayerController_C`
- `/LanceObserverDiagnosticControl/WBP_ObserverDiagnosticControl.Default__WBP_ObserverDiagnosticControl_C`

Each CDO must have the exact corresponding asset object path plus `_C` as its class path. All returned object/class identities must match. A stock path, redirector, wrong class or missing CDO stops the run. No original observer UObject, registry, package list, selected-object list or alternate mount is queried.

Ten immutable disk inputs are fixed in both source and manifest: the original seven observer files, stock controller, diagnostic `LanceObserverDiagnosticControl.uplugin` and diagnostic input config. The two final target asset pins bring the disk checks to twelve. They are checked before, after and between operations. `ActiveMod.txt` remains selection state outside those content pins.

These twelve pins are not a complete source/package inventory. The original source `LanceObserverProbe/mod.json`, diagnostic tags and icon, and any diagnostic `mod.json` created through Manage Mod/package preparation are outside this inspector's pin set. The separate [package preflight](OBSERVER_DIAGNOSTIC_CONTROL_PACKAGE_PREFLIGHT_2026-09-25.md) requires the full current source inventory, exact file pins, selection state, metadata and final freeze manifest before cooking. A successful source export cannot replace that gate.

## Loading and export evidence

**DOCUMENTED locally:** the collected `unreal-api-reference.txt` in `research/evidence/editor-source/mod-research-collection-20260921T023909Z-5eeaf52a/` declares `find_object` at lines 48–52, `find_asset` at 66–70 and `load_asset` at 72–76. The first two look for loaded objects. `load_asset` loads an asset; this is distinct from proving the current editor object equals disk.

By default the script requires both exact assets already loaded. Only if the final reviewed manifest explicitly enables exact loading, each missing target may receive one `load_asset(exact_object_path, follow_redirectors=False)` call. Loading may also load implicit dependencies. The returned exact path/class is then checked. No loading aliases, class-loading fallback, compilation, asset property writes or automatic retry are available.

The script imports only constants/hash/health utilities from the frozen, read-only `scripts/Inspect-DiagnosticControllerCopy.py`, SHA256 `daa431f3d271e1d0f01345a97d87f018211bcbdbdefdd0f6d9d4a3f15e092360`. It never calls that historical helper's `run()`. Native ObjectExporterT3D/AssetExportTask use matches the existing inspected export pattern. Task configuration setters do not edit the inspected assets.

Limits: four native text exports, 8 MiB per export, 32 MiB aggregate native export bytes, 2 MiB per derived inventory, bounded receipts, 90-second cooperative limit and 2 GiB free-disk floor. RAM/commit are observed without a reserve floor under the user's waiver. Exclusive project lock, active-script keys, STOP file and pinned inputs apply. Native synchronous work cannot be forcibly interrupted by these limits.

Pinned files are read through an opened handle with a `limit + 1` byte read. Handle size/mtime/identity before and after the read, the current path identity and SHA256 must agree; oversized/growing/replaced or changed files are rejected. This also bounds a file that grows after its initial size check.

## Review output, not acceptance

A completed run would produce four exact native exports and four inventories in a new output directory. A stopped run can contain only partial receipts, exports or inventories; inspect the actual report and each file before making a completeness claim. Inventory records preserve nested object identity, declaration/body line locations, raw node pins and fields, raw registered-graph fields, graph/node paths and lexical absolute-path candidates. Repeated declaration/body blocks are merged by full nested name, not bare node name. UTF-8 and BOM-marked UTF-16 are decoded strictly; unfamiliar/unbalanced structure stops with the native export retained.

All declarations emitted in each successfully indexed export remain visible, including emitted auxiliary graphs absent from registered graph fields. This does not establish that the exporter emitted every generated object or dependency. No reachability, function behavior, parent-call preservation, saved-memory equivalence or dependency closure is inferred. A reviewer must inspect the actual execution/data connections, defaults, owned-widget cleanup, inherited behavior and absence of original observer dependencies. Compile, reopen, package and runtime evidence remain separate.

The [controller copy review](OBSERVER_DIAGNOSTIC_CONTROLLER_COPY_REVIEW_2026-09-25.md#unresolved-warnings-and-next-boundary) records a handled localization-validator ensure at 18:47:46 UTC and three reload warnings at 18:47:48 UTC: missing replacement objects for `PlayerControllerSwitchMech_GEN_VARIABLE`, `PlayerControllerAirStrikeComponent_GEN_VARIABLE` and `ControllerFeedbackComponent_GEN_VARIABLE`. Those generated templates were not exposed by the earlier exports. Matching ordinary CDO `None` fields, a successful export or matching source graphs cannot clear these warnings or establish full memory health. Carry them into manual compile/save/reopen/component review; resolve them or explicitly block the package decision under the separate preflight.

## Offline checks performed

**OBSERVED during initial dormant preparation:** syntax validation passed; the dormant `run()` rejected before a sentinel allowed any API access. The ten protected disk size/hash pins and frozen utility helper hash matched. That earlier manifest had two null target pins and a null editor PID. At the historical 22:04:29 saved-file preparation stage, those fields were filled while loading remained disabled and activation was still unset. The reviewed activation and completed native run are recorded above.

The inventory parsed four existing native exports without editor access:

| Existing checkpoint | Objects | Node declarations | Registration fields | Derived JSON bytes |
|---|---:|---:|---:|---:|
| `diagnostic-controller-copy-20260925T192618Z-cfd90ca1/mod-copy-source.COPY` | 22 | 15 | 3 | 60,314 |
| Same checkpoint, `mod-copy-defaults.COPY` | 7 | 0 | 0 | 24,521 |
| `diagnostic-widget-copy-20260925T201450Z-0d8a7d1e/widget-source.COPY` | 18 | 9 | 2 | 34,946 |
| Same checkpoint, `widget-defaults.COPY` | 1 | 0 | 0 | 5,963 |

Encoding variants produced identical inventories; wrong root identity and malformed nesting were rejected. A static call check found no save/compile/duplicate/class-load APIs and confirmed the only `set_editor_property` call configures the export task. These are offline source/parser checks on older native evidence, not a final graph test. No native execution, UI action, asset mutation or original/retail change occurred in this preparation.

After hardening, the correct pinned temporary file read succeeded; a bad hash, empty file and oversized file were rejected. A focused real-file growth case appended 100,000 bytes after the opened-handle initial stat: the reader requested only `limit + 1` bytes and rejected the file. The full offline syntax, dormant no-API gate, unchanged incomplete manifest, ten current protected pins, frozen helper and four inventory/encoding/identity checks were rerun and passed. No editor API was invoked.
