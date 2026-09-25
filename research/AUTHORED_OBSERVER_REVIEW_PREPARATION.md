# Authored observer review preparation — 2026-09-25

The guided manual authoring session has produced three actual assets under `/LanceObserverProbe`: `WBP_LanceObserverProbeReadout`, `BP_LanceObserverProbeComponent`, and `DA_LanceObserverProbeRegistration`. Earlier NOT_BUILT statements describe the historical preparation stage. This checkpoint does not establish startup, cooked discovery or recording.

User screenshots show the recipe's BeginPlay owner/cast/local-controller path, stored class-family enumeration, widget creation with captured controller, stored and validated readout, source identity/count formatting, AddToPlayerScreen Boolean handling and owned-widget failure/EndPlay cleanup. Component tick-start is unchecked. The readout's visibility is self-and-all-children hit-test-invisible; its text slot is 20/20/900/260 with Auto Wrap Text checked. Focusability remains to be independently read. Compile icons were green at checkpoints. Registration shows the selected probe component with Add at Runtime checked. These are screenshot observations; the whole saved graph has not yet been independently reviewed.

The native plugin's eight saved files were copied and hash-checked in `evidence/editor-authored/LanceObserverProbe-20260925-011139`. The widget subsequently changed for wrapping/visibility, so that earlier backup is historical, not the final widget. Current source pins are in `AUTHORED_OBSERVER_EXPORT_PREFLIGHT.json` and the new helper. No source-only GitHub claim covers binary asset backups.

## One next editor action

Keep the three new assets open in the existing editor. From the main editor choose File > Execute Python Script and select `scripts/Inspect-AuthoredObserver.py` using its complete project path. Do not modify assets during export. This newly authored helper is separate from the four completed stock-reference helpers, which must not be rerun.

The helper finds only the three already-loaded, exact objects, checks their classes and pinned saved-file hashes, and exports source text plus up to two already-loaded class-default objects. It does not load assets, save, compile, start Play, scan the registry, cook, install or command the game. It uses the previously exercised ObjectExporterT3D workflow; `find_object` is documented in the collected installed API at line 48. Missing CDO data remains UNKNOWN. Memory exports do not prove equivalence to disk, even when disk hashes match.

Each invocation creates a unique `research/evidence/editor-source/observer-authored-*` directory, source/default texts, checkpoints and report.json. A hash mismatch, missing object, type mismatch, exporter error or resource stop preserves partial evidence. Native calls are synchronous; 90-second/size/resource checks are cooperative and cannot interrupt native export or impose a hard allocation cap. No blind retries. There is no editor-state rollback because the helper issues no asset mutation; it removes only its owned lock. Unique output evidence is retained.

## Validation

`Test-AuthoredObserverInspection.py`: 9/9 offline safety checks passed, MOCK_ONLY. Checks cover exact bounded object export, missing assets/defaults, changed sources, resource rejection, exporter failure, change during export, foreign locks and wrong class. The fake API has no asset-loading or gameplay API. These are author-run tests, not independent native acceptance. The receipt pins the tested helper and test hashes and confirms the three current saved source hashes.

Native execution and semantic graph review: NOT_PERFORMED. After the user runs the helper, review connected pins, branch direction, exact parent/class paths, widget defaults and registration text. Then prepare the concrete bounded startup experiment and packaging/removal manifests. No Play/cook/retail deployment follows automatically from successful export.

Weekly allowance at end of preparation: 23% remaining; observer-first usage thresholds still apply.
