# Phase A authoring route review

Initially reviewed 2026-09-25 through bounded local text inspection. The later native execution below was performed by the root task; this review did not itself operate the editor.

**Conclusion:** exact-path source loading and widget duplication have now succeeded natively, and the duplicate/source defaults were exported. Inspection then stopped on a deprecated wrapping-property warning; text mutation, save and explicit compile were not performed by that script. The remaining hybrid step is to update the identified duplicate template's text, verify it, and use the editor UI for graph construction and compilation. No verified Python route to build/wire the controller graph, construct a WidgetTree, import Blueprint clipboard nodes, or compile a Blueprint has been established.

## Native duplication checkpoint, 2026-09-25 20:14:50 UTC

**OBSERVED:** `research/evidence/editor-source/diagnostic-widget-copy-20260925T201450Z-0d8a7d1e/report.json` records exact source loading, one successful duplicate return and matching asset/CDO/template identities. Its status is accurately `STOPPED_PARTIAL_DUPLICATE_MAY_EXIST`, with the sole recorded error:

> DeprecationWarning: TextBlock: Property 'auto_wrap_text' on 'TextBlock' is deprecated: bAutoWrapText is deprecated. Please use AutoWrapText instead.

The duplicate is confirmed to exist in editor memory; the conservative failure status is not evidence of duplicate failure. Both native exports returned true without exporter errors:

- `widget-source.COPY`: 24,017 bytes, SHA-256 `a1724cbd1f79bce05f902d718e9062e162bb775eefc8a60f105b6533d4f4332a`.
- `widget-defaults.COPY`: 1,974 bytes, SHA-256 `1d77c8de7050ef9c1e5781ab1cec67ad08dc8c96d48d4fcde25588c92ce1a050`.
- Receipt SHA-256: `1e1d75b25ef98c35f9d80c00aeac68f989b491af517c3477c5c2fca61f0a89da`.

The observed duplicate is `/LanceObserverDiagnosticControl/WBP_ObserverDiagnosticControl.WBP_ObserverDiagnosticControl`. Its TextBlock is that exact path plus `:WidgetTree.SnapshotText`; the recorded outer chain is TextBlock → that asset's WidgetTree → that asset. The CDO is `/LanceObserverDiagnosticControl/WBP_ObserverDiagnosticControl.Default__WBP_ObserverDiagnosticControl_C` with the new generated class. These are now native returned identities, superseding the earlier derived lookup candidates for this duplicate.

The source export retains `Observer preview` (117), `AutoWrapText=True` (118), and offsets 20/20/900/260 (124). Self-type references now point to the diagnostic generated class (52,151). Tick, Construct and PreConstruct remain disabled (74,88,99); registered graphs remain EventGraph and SetSnapshot (175–176). `CategorySorting(1)` retains the old display label (178); that label is not an original-mod object dependency. The CDO export retains IsFocusable false, no implemented Tick/Paint (14–17), and HitTestInvisible (45). No `/LanceObserverProbe/` path occurs in these two exports; this is source evidence, not a complete cooked dependency/compatibility proof.

All nine protected disk pins matched before/after. The diagnostic `.uasset` did not yet exist on disk at the end of this run. **Do not rerun the duplication script.** Continue against the existing in-memory duplicate. The separately prepared `scripts/Set-DiagnosticWidgetText.py` makes only the exact template text assignment after identity/preexisting-text checks, pins this evidence and all nine protected inputs, and exports before/after state. Its fresh source and CDO exports must both exactly match the frozen hashes above before mutation; even editor metadata drift stops for a new baseline review. It reads wrapping from native export instead of accessing the deprecated alias; it applies no warning suppression. That resume script has not been executed by this review and still requires root review/native validation.

## Evidence identities

- `API`: `research/evidence/editor-source/mod-research-collection-20260921T023909Z-5eeaf52a/unreal-api-reference.txt`. SHA-256 rechecked: `ac4c46761bc54099302155bc0a908ae3f64b161ca77eb9afd0cc6c1f1b826480`. This is the previously collected PGI editor reflected API, not a fresh live reflection.
- `WIDGET`: `research/evidence/editor-source/observer-authored-20260925T052357Z-b89383e2/WBP_LanceObserverProbeReadout.COPY`.
- `CDO`: the same directory's `WBP_LanceObserverProbeReadout-defaults.COPY`.
- The same directory's `report.json:8–24` records the original object path, disk pin, successful source/default exports and export hashes. These are historical editor-memory exports; they do not certify a future duplicate or current unsaved state.

## Supported declarations and gaps

| Operation | Exact local lines | Evidence and limit |
|---|---|---|
| Create an empty widget asset | API 260175–260198, 127109–127124 | `WidgetBlueprintFactory.parent_class` and `AssetTools.create_asset` are declared. Creation can return NULL; no tree authoring follows from this. |
| Duplicate a loaded asset | API 127062–127075, 127126–127146 | `AssetToolsHelpers.get_asset_tools()` and `AssetTools.duplicate_asset(asset_name, package_path, original_object)` are declared. Native duplication, returned identities and exported self-reference remapping are now observed at the checkpoint above. Persistence and runtime behavior remain unverified. |
| Alternative duplication API | API 382655–382667 | `EditorAssetLibrary.duplicate_asset` explicitly loads the source and tries checkout. The AssetTools form is preferable for a bounded already-loaded experiment. |
| Find an existing inner object | API 48–52, 66–70 | `find_object(outer, name, type=Object, follow_redirectors=True)` and `find_asset` find already-loaded objects. Use `follow_redirectors=False`; verify returned path and class before editing. |
| Edit an existing object's properties | API 347–370 | `modify` supports transaction bookkeeping; `get_editor_property`/`set_editor_property` are declared, with pre/post change notifications for setters. This does not prove widget Blueprint dirtying/compilation/persistence by itself. |
| Static text and wrapping | API 157979–158048, 158125–158134, 158199–158207 | TextBlock `text`, `auto_wrap_text` and `slot` are editor properties. `set_text` and `set_auto_wrap_text` also exist. A reviewed property assignment using a Python Unicode string can carry the exact em dash without extending mouse/keyboard helpers. |
| Canvas layout | API 150965–151040 | CanvasPanelSlot exposes `layout_data` and position/size methods. The exact returned slot must belong to the new widget. Existing layout may require no change. |
| Widget defaults | API 138328–138385, 3880 | UserWidget exposes `is_focusable`, `visibility` and `tick_frequency`. `SlateVisibility.HIT_TEST_INVISIBLE` disables hit testing on the widget and its children. |
| Save | API 382372–382384 | `save_loaded_asset` saves the package and attempts checkout; it is not a compiler. UI compile/save followed by readback is still required for the candidate. |
| Controller graph authoring | API 146036–146058, 182709–182735 | EdGraphNode/K2Node declarations contain no authoring methods. Blueprint exposes metadata, not graph construction. Searches found no BlueprintEditorLibrary, BlueprintEditorUtils, compile_blueprint, connect_pins, add_member_variable, ImportNodesFromText or equivalent node-paste API in this collected file. Bounded absence only. |
| Widget tree creation | API 260123–260198 | BaseWidgetBlueprint/WidgetBlueprint expose no widget-tree property or methods. No WidgetTree declaration or construct_widget method was found in this collected file. CanvasPanel.add_child_to_canvas is exposed (150952–150963), but it does not establish how to create/register/persist an asset's root tree. |

Clipboard getter/setter declarations elsewhere in API are not a node importer. Editing exported COPY text or passing it to an unspecified import/paste function is not an established route. Do not substitute generated binary serialization or a new native helper for the missing graph API.

## Existing widget as duplication source

The observed asset object path is `/LanceObserverProbe/WBP_LanceObserverProbeReadout.WBP_LanceObserverProbeReadout` (`report.json:8`). Its source is small and does not reference the observer component or registration asset:

- WIDGET 18–24 and 105–123 declare `WidgetTree`, TextBlock `SnapshotText`, CanvasPanel `CanvasPanel_0` and its `CanvasPanelSlot_4`. RootWidget and AllWidgets point to these objects.
- WIDGET 107–108 stores `Observer preview` and `AutoWrapText=True`. Slot offsets at 114 are 20,20,900,260.
- WIDGET 26–57 defines the sole `SetSnapshot` function: its input goes to `TextBlock.SetText`, targeting its own SnapshotText. The hidden self pin at 42 points to the **original** widget generated class and must be remapped in a duplicate.
- WIDGET 59–103 contains disabled, unconnected Tick, Construct and PreConstruct nodes. ParentClass is ordinary `/Script/UMG.UserWidget` (125). Registered graphs are EventGraph and SetSnapshot (127–128).
- CDO 14–18 has `bIsFocusable=False`, no implemented Tick/Paint, and TickFrequency Auto; 45 has `Visibility=HitTestInvisible`. CDO 2's `SnapshotText=None` is not the designer's template TextBlock and is not the text-edit target.

The hierarchy's original TextBlock lookup can be derived from the recorded asset outer and WIDGET 116's relative reference: `asset:WidgetTree.SnapshotText`; slot hierarchy is `asset:WidgetTree.CanvasPanel_0.CanvasPanelSlot_4`. These are **derived lookup candidates, not independently observed inner get_path_name results**. For a new duplicate, capture actual returned paths and exported inner names first; do not assume the factory preserves every name or that the destination mount matches the original.

An unused SetSnapshot function is not itself a probe dependency. Retaining it is a possible scope choice if the new controller never calls it, no widget lifecycle/body/binding invokes it, and the actual duplicate has no runtime references to the original probe. If the agreed Phase A asset should have no setter, delete the function through the editor UI; no supported removal API was found. A whole-file search alone must distinguish editor history strings from runtime object references, and actual package/dependency review must still exclude the original mod.

## Narrow proposed experiment

1. Pin the original widget and confirm its loaded identity. Confirm the destination mod content mount and nonexistence of the requested new asset; do not overwrite.
2. Duplicate through the declared AssetTools operation or editor UI, obtaining and checking the exact returned asset identity. Keep the original widget untouched.
3. Export/inspect the actual duplicate and defaults before any property assignment. Resolve the actual template TextBlock and its slot through already-loaded lookup; validate classes, owner hierarchy and current properties. Missing or different identity stops the experiment.
4. Set only the duplicate's TextBlock `text` to `CONTROL A — OUTPUT ONLY` through the declared editor property. Retain already-correct wrap/layout/defaults, or change only verified named properties with readback. Unicode is supported by Python text; actual Unreal value acceptance/readback remains to be observed.
5. Compile and save in the editor UI. Reopen and export the duplicate to verify static text, tree, defaults, graph bodies, self-reference remapping and independence from `/LanceObserverProbe`. Inspect actual dependency/package evidence before deployment; creation/export success is not runtime acceptance.
6. Author the F8 input/controller graph through the already-proven guarded UI route. This review supplies no Python shortcut for pins, events, member variables or compilation.

The initial review created no mutation script. Later bounded scripts were separately authorized by the root task: the duplicate-and-inspect run above and the prepared text-only resume step. UI graph work and compile/save verification remain separate; no runtime acceptance follows from these editor results.
