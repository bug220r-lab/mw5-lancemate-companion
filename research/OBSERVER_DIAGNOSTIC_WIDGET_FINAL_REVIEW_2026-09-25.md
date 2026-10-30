# Diagnostic widget final source review — 2026-09-25

**PASS_FOR_EDITOR_WIDGET_SOURCE_CHECKPOINT.** The saved diagnostic widget retains the intended static text, tree/layout, registered graph bodies and noninteractive defaults. Native UI evidence shows a successful widget compile and the text after asset-tab reopening. This is bounded editor authoring evidence; it does not establish cold disk reload, cooked dependencies, input behavior, cleanup or retail rendering. The controller graph and packaging have separate reviews.

## Evidence integrity

Independently checked the [22:17:45 native report](evidence/editor-source/diagnostic-final-source-20260925T221745Z-530263a1/report.json), all four export lengths/hashes, their four inventory hashes, exact requested/returned object paths and classes, successful exporter return values and empty exporter error lists. The report records four exports totaling **142,237 bytes**, no asset loads, and no mutation/save/compile/UI/Play/cook/retail actions by this inspection.

| Export | Bytes | SHA-256 |
|---|---:|---|
| controller-source.COPY | 97,628 | `1c46d0589b6c79342fcba90857d0ea1970d463325a9eeb00a31e86fbd2afa0db` |
| controller-defaults.COPY | 9,149 | `fbb353fde17e65e1826227844d75220df3adf2cc3ab09d90229edc3d0044d8d2` |
| [widget-source.COPY](evidence/editor-source/diagnostic-final-source-20260925T221745Z-530263a1/widget-source.COPY) | 33,486 | `f74f506601b395e34036d4e417a9c82ef4acaacd8587f8df7fc3dd1f4b9f7ee6` |
| [widget-defaults.COPY](evidence/editor-source/diagnostic-final-source-20260925T221745Z-530263a1/widget-defaults.COPY) | 1,974 | `1d77c8de7050ef9c1e5781ab1cec67ad08dc8c96d48d4fcde25588c92ce1a050` |

All **12** before/after disk pins match, and an independent read of each installed file matched its reported length and SHA-256. These cover the seven original observer files, stock controller, diagnostic descriptor/input configuration/controller and widget. The saved widget is **30,768 bytes**, SHA-256 `80f52bb21156b638ca22d6c8ab778bfcfc7a6feb1f26286977a3324ac5978b4b`. Selection markers are outside these content pins.

The report itself is **12,552 bytes**, SHA-256 `203245c934b937c0aa3b87a429cf7a857235c2574c4c77f40787f988154ab839`. The manifest, inspection script and shared helper currently match the report's respective pins `a4f18d3ca259b9bebbc6a5125bfacabfff8e0dbd238659a4445f6ece82f9dcb5`, `055fe707fcd7044a294e6fef99732bb2373c38364ebc509de17eab5d1d0b0c60`, and `daa431f3d271e1d0f01345a97d87f018211bcbdbdefdd0f6d9d4a3f15e092360`. Controller export integrity was checked here; controller behavior was not audited in this review.

## Complete comparison against the reviewed text mutation

The comparison baseline is the [21:57:06 after-source export](evidence/editor-source/diagnostic-widget-text-20260925T215706Z-e406db05/after-source.COPY), **33,488 bytes**, SHA-256 `b0971dc286e758f8318fab059ac9289125226629928498235dce160dfe1a6824`.

Both source files use **UTF-16LE with a BOM**. Exactly two decoded lines differ:

- Line 130: `CategorySorting(1)="WBP Lance Observer Probe Readout"` becomes `CategorySorting(1)=""`.
- Line 131: `CategorySorting(2)=""` becomes `CategorySorting(2)="WBP Observer Diagnostic Control"`.

The old label contains 32 characters; the replacement contains 31. Its move between category slots and one fewer UTF-16 code unit explain the exact **two-byte decrease**, 33,488 → 33,486. Restoring only these two category lines reconstructs the earlier source **byte-for-byte**, including its BOM and line endings. No GUID, graph, pin, tree, property or dependency-reference change is hidden by normalization. The defaults exports are byte-identical.

The earlier unregistered `EdGraph_1`/generated empty graph remain absent, and `AllWidgets(0/1)` remain present. The final difference is editor category metadata; its precise lifecycle cause is not established by these exports.

## Widget findings

- **Text:** source line 107 is `Text=INVTEXT("CONTROL A — OUTPUT ONLY")`. The dash is exactly **U+2014**; no replacement character is present. This is unchanged from the reviewed mutation.
- **Tree/layout:** one CanvasPanel root and its owned variable `SnapshotText` TextBlock; `AutoWrapText=True` at line 108; offsets **20/20/900/260** at line 114; owner-local parent/content references at lines 115–116; root and both membership entries at lines 121–123. These are unchanged.
- **Registered graphs:** `SetSnapshot` at lines 26–58 retains three nodes, eight pins and three reciprocal execution/data links (six linked pins). It only assigns its `InText` argument to the owned TextBlock through `SetText`. EventGraph at lines 59–104 retains three disabled, unconnected PreConstruct/Construct/Tick stubs, nine pins and zero links. Parent/generated classes and graph registrations at lines 125–134 are unchanged. Keeping the unused setter adds no observed self-executing path in this widget export.
- **Defaults:** `bIsFocusable=False`, `bStopAction=False`, `bHasScriptImplementedTick=False`, `bHasScriptImplementedPaint=False`, and `TickFrequency=Auto` at defaults lines 14–18; `Visibility=HitTestInvisible` at line 45. These describe a nonfocusable, hit-test-invisible design; they are not a gameplay test. `SnapshotText=None` on the CDO does not remove the separately exported template tree.
- **References:** all path references outside the category labels are unchanged; no literal `/LanceObserverProbe/` runtime path appears in the final widget source/defaults. Text export inspection is not complete cooked-dependency validation.

## Native UI corroboration and limits

Verified all five indexed image hashes against their PNGs and source receipts in the [UI checkpoint index](evidence/diagnostic-final-ui-checkpoint-20260925T2218Z.json), SHA-256 `3aac5474978e42789ba33105704884285695ffbfaa67026e91f24cd34d26450c`. Its lossless string process-creation value `134348399116267644` matches the native receipt integer exactly. This review visually inspected the two widget images:

- **22:03:02 UTC saved-state image:** the Designer shows the intended text and its CanvasPanel/TextBlock hierarchy. Compiler Results explicitly shows `Compile of WBP_ObserverDiagnosticControl successful! [in 766 ms]` for the diagnostic asset path. Image SHA-256 `36e3af1691c5d92bbe08df7f52d186af23f6efd1c5b19898e895c90daf595498`.
- **22:11:11 UTC reopened asset-tab image:** the same text and hierarchy remain visible. Image SHA-256 `ba7ce9a20ff6a6a1b5810c3eec1014c07774efad4bbcc897ece2ced4b7d11626`.

Both captures belong to editor PID **20352** with the same process-creation identity. Reopening an asset tab within that process does not prove the package was unloaded and reloaded from disk. The saved-file pin plus these observations establish an editor checkpoint, not saved-memory equivalence. Earlier controller generated-component replacement warnings are not resolved by this widget audit. No native actions or source-asset edits were performed by this reviewer; this Markdown review is the only output written.
