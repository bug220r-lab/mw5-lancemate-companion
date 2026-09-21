# Expanded AI source collection

Prepared 2026-09-20 (local); UTC artifacts may be dated 2026-09-21. **LATEST: user-started native collection completed and audited.** [Result](AI_COLLECTION_RESULT_2026-09-20.md):249/249entries processed,244source exports,128class-default exports, five recorded gaps, no collection errors or audit mismatches. No repeat run is currently needed. User direction remains live tactical decisions as the nearer milestone and human-like real-time play as the eventual ambition; source collection implements neither runtime capability. The procedure below is preserved for reference.

## One editor action

In the existing responsive editor, choose **File > Execute Python Script** and select:

`C:\Users\jlewi\OneDrive\Documents\ChatGPT\MW5 LANCEMATE COMPANION\scripts\Collect-AIResearch.py`

Keep the project layout intact: the helper verifies its adjacent [reviewed manifest](AI_RESEARCH_SCOPE.json). Let pending editor discovery/compilation finish and leave assets unedited during collection. Do not run other collectors alongside it. Duplicate invocation of this helper recognizes its active session. Ordinary desktop Python cannot execute the collection entry point: it needs the existing editor's `unreal` module.

One named asset is processed per Slate callback. Native loads/exports may temporarily block the editor. Each run creates a unique direct child `research/evidence/editor-source/ai-research-collection-<UTC>-<id>/`, with `progress.json`, final `report.json`, and `coverage.json`. Editor log messages beginning `MW5_AI_RESEARCH_PROGRESS` and `MW5_AI_RESEARCH_FINISHED` identify progress/output. Processing the list does not establish complete AI understanding.

Completed outputs survive a stop. After resolving the resource issue, rerunning the same helper reuses eligible text from the eight most recent matching direct-child runs, with script/scope/source identity and text hash checks. Eighteen pinned earlier source exports are also reused. Reuse preserves an earlier capture, not current unsaved editor edits. A plain file named `STOP` in the current output directory stops the batch at its next cooperative check. No process is killed or restarted.

## Reviewed scope

**OBSERVED:** 249 unique installed source files, 42,082,266 bytes of original `.uasset` data; paths/hashes checked against the local installation. Source size is not predicted text output or RAM use. All 191 `.uasset` files observed beneath `MW5Mercs/Content/AI` are included. Manifest SHA256: `DF691070FAD853EC2DE37B67DE65AE246138AE07489290B20F01ABE02835D0D3`.

| Source family | Files | Research question |
|---|---:|---|
| Mech AI | 86 | Combat/follow/order trees, controllers, targeting, movement; includes 25 behavior/accuracy configuration assets |
| Common AI, jobs and root assets | 59 | Services, jobs, blackboards, sensors, formations, navigation recovery and environment queries |
| Tanks, VTOLs, turrets and humans | 42 | Which systems differ by unit type and which are shared with mechs |
| AI waypoints | 4 | Waypoint/navigation support definitions |
| Pilot skill assets | 12 | Skill growth and accuracy/evasion modifiers |
| Encounter behavior and parents | 17 | Leads for assignment and initial behavior; active mission use remains unproved |
| Orders and lance UI | 19 | Player orders, recipients, lifecycle and manual override paths |
| Supporting objects and libraries | 10 | Controller, target and control-switching references; one broad library deferred |

**PROPOSED:** eighteen source exports reused, up to 230 new source exports, plus one metadata-only entry. `MW5_FunctionLibrary` remains in the dependency inventory but is deferred from native export because its broad 18,090,466-byte source exceeds the 16 MiB source-load threshold. Unsupported registry classes are recorded without generic loading. Actual successful export counts require the native receipt.

For supported registry classes the helper attempts:

- Text exports of Blueprint graphs, behavior trees, blackboards, environment queries, curves, tables, enums/structs and the exact declared native `MWAIBehaviourConfigAsset` class.
- Separate Blueprint class-default-object text using generated-class/default-object APIs with exact identity checks. This is newly proposed native collection; failures are recorded. Defaults are not live actor state or guaranteed exhaustive inherited values.
- Hard/soft dependency names, with null/truncation flags. These are on-disk references, not executed call edges. Referenced assets outside the list are not automatically loaded.
- A text copy of the generated Python API reference, never imported/executed. Declarations and placeholders do not reveal all compiled native implementations.
- Output hashes, source-change checks, methods, failures/skips, and unresolved dependencies in `coverage.json`.

## Why enemy and ally AI help

**PROPOSED inference:** comparison can distinguish lancemate-specific decisions from common combat behavior, and identify whether a future change could also affect enemies or other allies. Names and directories alone do not prove allegiance or runtime use. Analysis must trace controller defaults, job/root selection, key readers/writers and mission assignment before recommending changes.

## Resource and completeness limits

The helper checks for at least 2 GiB free disk, 768 MiB available physical memory and 1 GiB available commit. It stops cooperatively after 900 seconds, 512 MiB recorded text, or an export larger than 32 MiB. Native calls cannot be interrupted by these checks. Unreal may implicitly load dependencies and generate caches/shaders whose cost is outside that budget. Oversized/partial files are retained. Prior outputs are never overwritten; only this run's progress checkpoint is replaced.

**UNKNOWN/BLOCKED:** compiled selection/aiming/movement algorithms, unexposed inherited data, DLC/mission-specific sources outside the manifest, runtime actor ownership/tree assignment, navigation/visibility and live target/heat/damage state. Source mapping is not full game simulation. Unsupported exporters may need a later targeted method.

No deliberate asset edit/save/compile/cook, Play-In-Editor, retail launch/control, game files, saves, active mods, paid services or runtime telemetry are involved. Normal editor regeneration during loading remains possible.

## API evidence and validation

Authority is the installed **UE4.26.2 / MW5 editor 1.1.390.0e** reference `C:\Users\jlewi\AppData\Local\MW5Mercs\Intermediate\PythonStub\unreal.py`, read as text on 2026-09-20. Locations: `find_asset`/`load_asset` 66-76; `get_default_object` 90-94; `Object.static_class` 297-301; `AssetData` 35813 onward; registry dependencies/object lookup around 112763/112877; `MWAIBehaviourConfigAsset` 298500; `EditorAssetLibrary.load_blueprint_class` 382486-382497. The [earlier native collection](COLLECTION_RESULT_2026-09-20.md) supplies proven text-export precedents and eighteen reused receipts.

Epic's [AssetData](https://dev.epicgames.com/documentation/en-us/unreal-engine/python-api/class/AssetData?application_version=4.27) and [EditorAssetLibrary](https://dev.epicgames.com/documentation/en-us/unreal-engine/python-api/class/EditorAssetLibrary?application_version=4.27) references, accessed 2026-09-20, corroborate the APIs. They describe 4.27; the installed fork's declarations govern this helper. Declaration support is not native acceptance.

**OBSERVED offline result: 40/40 checks passed** under the installed Python 3.7.7 interpreter using `-B`. [Validation receipt](evidence/editor-source/ai-collector-validation-20260921T030245Z-2cb4fe51/summary.json) and [validator](../scripts/Validate-AIResearchCollector.py). All249source identities and18reuse fingerprints were checked read-only. Strict fakes exercised exact typed/nonredirected loads, immutable assets/CDOs, identity guards, passive API copying, reuse/tamper rejection, resource/size/time limits, partial failures, honest coverage and transient/persistent checkpoint locks. No native Unreal call occurred in validation; fakes establish control flow only.

Collector SHA256: `6924C6D7B0929799E28D664BD6188703A8A9DDC5D6FEC2E032AE222904D8FEA7`. Validator SHA256: `88F27D2514676CB3D86A5AA65E468960CDE82AD2286DB402221A3653DBA16762`. The older proven `Collect-ModResearch.py` was preserved unchanged at `21253740455E22DB7C283D4FCA7B1B07D6D0848E845FAC880DD284BBC5215743`.

Independent code review identified generated-class Python-type/native-wrapper handling and premature source-verification provenance; both were corrected and covered by tests. The final review found no additional material issue. An earlier real OneDrive progress-replacement lock prompted bounded retry handling; its earlier failed fixture receipt remains historical evidence. The final suite verifies both recovery and persistent-lock reporting. This is static/control-flow review, not native acceptance.

The subsequent [actual native result](AI_COLLECTION_RESULT_2026-09-20.md) supersedes preparation-stage native-pending language above for the244collected source assets and128default exports. The five gaps, complete native implementation coverage, gameplay and live tactical decisions remain unresolved; **gameplay NOT_PERFORMED**.
