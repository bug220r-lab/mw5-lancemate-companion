# Diagnostic widget duplicate: independent source review

Reviewed 2026-09-25 after the bounded native attempt at **20:14:50 UTC**. **EDITOR-MEMORY DUPLICATE VERIFIED; SAVE, FINAL COMPILE, PACKAGE AND RUNTIME NOT_PERFORMED.** This review supports continuation on the already created duplicate. It does not clear the controller's earlier generated-component reload warnings or establish that the diagnostic widget will render in retail.

## Exact evidence

| Evidence | Bytes | SHA-256 |
|---|---:|---|
| [Native report](evidence/editor-source/diagnostic-widget-copy-20260925T201450Z-0d8a7d1e/report.json) | 10,513 | `1e1d75b25ef98c35f9d80c00aeac68f989b491af517c3477c5c2fca61f0a89da` |
| New [widget source export](evidence/editor-source/diagnostic-widget-copy-20260925T201450Z-0d8a7d1e/widget-source.COPY) | 24,017 | `a1724cbd1f79bce05f902d718e9062e162bb775eefc8a60f105b6533d4f4332a` |
| New [defaults export](evidence/editor-source/diagnostic-widget-copy-20260925T201450Z-0d8a7d1e/widget-defaults.COPY) | 1,974 | `1d77c8de7050ef9c1e5781ab1cec67ad08dc8c96d48d4fcde25588c92ce1a050` |
| Historical [original widget source](evidence/editor-source/observer-authored-20260925T052357Z-b89383e2/WBP_LanceObserverProbeReadout.COPY) | 17,218 | `f1514ddd2484bf545749c640c892e1b7e7ebf1c3d1dd914fe234ccc004b7d2c3` |
| Historical [original defaults](evidence/editor-source/observer-authored-20260925T052357Z-b89383e2/WBP_LanceObserverProbeReadout-defaults.COPY) | 1,962 | `2db67f3b51795ba5101c6f59a3b68fc1e83b01ccb56ac3e9c3c0c2dbe8dee9e6` |

The reviewed helper [Prepare-DiagnosticWidgetCopy.py](../scripts/Prepare-DiagnosticWidgetCopy.py) was **19,020 bytes**, SHA-256 `281cff17905cd728e3de7444da9a65fa9b1ea6eb07cbf6e377c80184f1b2ba75` in the native report. Its exact source/destination identities passed; `source_load_attempted=true`, `duplication_attempted=true`, and the returned WidgetBlueprint and CDO matched the requested diagnostic paths/classes. The actual `SnapshotText` TextBlock path, class and outer chain were also verified. The report's nine protected content/controller file pins matched before and after, and an independent disk reread matched all nine. The destination `.uasset` did not exist at the attempt's end or the independent reread. The original observer's temporary `ActiveMod.txt` selection marker is outside those nine content pins and remains a later restoration obligation.

## What the exports establish

After exact source/asset self-path renaming and excluding regenerated `NodeGuid` values, the registered `SetSnapshot` and `EventGraph` sections compare byte-for-byte with the historical original. `SetSnapshot` has three nodes, eight pins and three reciprocal execution/data links; EventGraph has three disabled, unlinked event nodes and nine pins. The registered graph GUIDs and pin IDs are retained. The hidden SetSnapshot self-class pin points to the new diagnostic generated class in both visible declarations ([new source lines 52 and 151](evidence/editor-source/diagnostic-widget-copy-20260925T201450Z-0d8a7d1e/widget-source.COPY)).

The CanvasPanel root, `SnapshotText` TextBlock, visible `Observer preview`, automatic wrapping, slot offsets 20/20/900/260 and exported defaults survive the duplicate. Defaults compare byte-for-byte after the generated-class name changes, including `bIsFocusable=False`, `Visibility=HitTestInvisible` and `TickFrequency=Auto`. Neither new text export contains a literal `/LanceObserverProbe/` path. Text absence alone is not a complete dependency or cooked-package review.

The duplicate export also has an **unregistered `EdGraph_1`** containing a second SetSnapshot-like graph with the same graph GUID, omits the original exported `AllWidgets(0/1)` entries, and omits editor `LastEditedDocuments` history. Six node GUIDs, the Blueprint GUID and localization IDs changed. Its human-facing category still says `WBP Lance Observer Probe Readout`. The exports do not establish whether the unregistered graph or absent `AllWidgets` entries affect a saved or cooked widget. They must be reassessed after save, compile, reopen and fresh exact export. The category is a stale label, not by itself a runtime reference to the original mod.

## Stop and continuation

The helper stopped **after** duplication and both exports when `TextBlock.get_editor_property("auto_wrap_text")` raised a `DeprecationWarning`. Status is `STOPPED_PARTIAL_DUPLICATE_MAY_EXIST`; no explicit text change, save, compile, Play, cook or installation occurred. Do not rerun duplication against the occupied in-memory destination. Inspect or edit the **same verified object** through a separately reviewed path that avoids the deprecated getter, then compile, save, reopen and export. Confirm the exact static text `CONTROL A — OUTPUT ONLY`, wrapping/layout/noninteractive defaults, registered graph body, absence of original-mod runtime dependencies, saved file hash, and any remaining unregistered/tree differences before accepting this widget as a package input. The controller display/cleanup graph and retail behavior have separate gates.
