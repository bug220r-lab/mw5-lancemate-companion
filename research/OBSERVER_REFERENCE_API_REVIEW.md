# Bounded observer reference lookup: API review

Reviewed **2026-09-21 UTC**. **OBSERVED declarations; PROPOSED lookup and screening.** This review reads only the existing API/source exports. It does not execute editor APIs, load/export assets, or establish a caller of `AddPlayerControllerComponents`.

## Source and exact declarations

`API` below is the already collected [unreal-api-reference.txt](evidence/editor-source/mod-research-collection-20260921T023909Z-5eeaf52a/unreal-api-reference.txt). Its independently reread SHA256 is `AC4C46761BC54099302155BC0A908AE3F64B161CA77EB9AFD0CC6C1F1B826480`. Ranges are one-based. Applicable provenance remains editor **1.1.390.0e / UE4.26.2 / compatible CL14830424** from the [local snapshot](PASSIVE_OBSERVER_LOCAL_SNAPSHOT.json); this review did not refresh installation metadata. Generated stubs describe an exposed API, not its native implementation or completeness of registry data.

| API range | OBSERVED declaration | Consequence |
|---|---|---|
| 112605-112614 | `AssetRegistryHelpers.get_asset_registry() -> AssetRegistry` | Obtain the existing registry interface. No asset argument or load operation is declared. |
| 112748-112762 | `AssetRegistry.get_referencers(package_name, reference_options) -> Array(Name) or None` | Returns packages referencing the supplied package; the documentation explicitly limits this to **on-disk references only**. The input is a long package name such as `/Game/MyFolder/MyAsset`, without `.AssetName` or `_C`. |
| 112778-112786 | `AssetRegistry.is_loading_assets() -> bool` | True means the registry is loading files and does not know about all assets. False only answers that current-loading question; it does not prove complete, current or shipping-equivalent references. |
| 39209-39226 | `AssetRegistryDependencyOptions(...)` constructor and documented flags | Soft/hard package references default true; searchable names and both management-reference flags default false. Set all five flags explicitly for reproducible scope. |
| 112831-112845 | `get_assets_by_package_name(package_name, include_only_on_disk_assets=False)` | Optional package metadata lookup. If used, set the flag true and cap results; this is separate from `get_referencers`. |
| 112877-112889 | `get_asset_by_object_path(object_path, include_only_on_disk_assets=False) -> AssetData` | Optional exact-object metadata lookup. True explicitly ignores in-memory objects. The result may be invalid. |
| 35823-35862,35872-35880 | `AssetData` exposes asset class/name, object path, package name/path, and `is_valid()` | These are sufficient for bounded metadata identity checks. Do not serialize the transient `AssetData` object itself; copy only bounded primitive values. |

`get_referencers` has **no** `include_only_on_disk_assets` or recursive argument. Its on-disk limitation is part of the method description. Do not pass an invented keyword. Returned items are package names, not function-call nodes, object instances or proven runtime dependencies.

## Minimal proposed call scope and limits

Query only these three existing package names, once each, using the existing registry:

1. `/Game/Objects/_common/MW5PlayerController`
2. `/Game/Modes/InstantAction/InstantActionPlayerController`
3. `/Game/Objects/_common/Components/PlayerControllerComponents/PlayerControllerComponentDataAsset`

Use `AssetRegistryDependencyOptions(include_soft_package_references=True, include_hard_package_references=True, include_searchable_names=False, include_soft_management_references=False, include_hard_management_references=False)`. The hard/soft meanings are documented at **API:39220-39224,39229-39245**. This combined query does not distinguish which of the two categories produced each edge. Searchable-name references concern specific names inside a package (**39222,39247-39254**); that flag is not a function-call search. Management references describe primary-asset management relationships (**39220,39223,39256-39272**). Excluding them keeps this first result interpretable as a package-reference candidate list.

**PROPOSED guards:** at most three native referencer calls; at most **512 returned entries per target**, **1,024 retained unique entries overall**, **512 characters per package name**, and **1 MiB of JSON evidence**. Preserve target association and exact option flags. Bound iteration with a sentinel entry beyond the cap so truncation is explicit. If a native result exceeds the limit, retain a partial/capped receipt and stop further expansion; do not present the retained prefix as the complete result. These are proposed local safeguards, not Unreal API limits.

Read `is_loading_assets()` before querying and after each query. If true before the first query, stop with `REGISTRY_LOADING` and no completeness claim. If it becomes true after a query, preserve that partial result and stop. Treat `None`, an empty array, an invalid metadata result and an exception as distinct observations. A `None` return must not silently become an empty reference set. Use a cooperative time budget, for example **30 seconds**, around calls; a synchronous native call cannot be forcibly interrupted safely by this helper, and a returned array may have been allocated before Python applies its count cap.

No recursive referencer traversal is needed. Do not invoke `search_all_assets`, `scan_paths_synchronous`, `scan_modified_asset_files` or `scan_files_synchronous` (**API:112686-112723**), nor `wait_for_completion` (**112665-112670**), to manufacture a more complete answer. They would expand this existing-metadata lookup or introduce an unbounded wait. Do not enumerate all assets or cached paths. Do not call `AssetData.get_asset()` (**35949-35957**) or `AssetRegistryHelpers.get_asset()` (**112615-112627**): both explicitly may load an unloaded asset. `get_class()` also offers no needed benefit and its declaration does not establish a no-load guarantee.

## Offline screening of returned candidates

**PROPOSED lead-generation only:** after recording the exact direct referencer names, a separate bounded local-file inspection may prioritize which already identified candidate merits source review. First reuse any existing source export. For an uncollected candidate, map only an observed `/Game/...` package under the verified editor content root, validate the resolved path stays there, reject traversal/reparse ambiguity, and record an actual existing `.uasset` path, size and SHA256. A package may instead be a map or use another mount; a guessed or absent `.uasset` is `UNRESOLVED_PATH`, never a negative caller finding.

Suggested first screening bound is **32 attributable candidates**, **16 MiB per file**, **64 MiB total read**, no recursive directory walk, and bounded hit offsets/counts. Read-only name/GUID-byte searches need not parse or execute the asset. Preserve size/hash before and after reading; changed or oversized files are unreviewed, not negative. These screening limits are proposals independent of the registry lookup, and a cap must retain the unreviewed remainder explicitly.

The exact function name is established in the existing [controller source](evidence/editor-source/ai-research-collection-20260921T030437Z-f7d8e930/010-MW5PlayerController-source.COPY), **1596-1603**: `FunctionReference=(MemberName="AddPlayerControllerComponents")`. The factory graph's `GraphGuid` is **`8D65532A42F6C950EE8422B719A4944D`** at **1774**. Do not confuse it with the entry node's `NodeGuid` at **1601**. The graph GUID is an observed graph identifier; a future caller's exact `MemberGuid` relationship is not established by this definition alone.

Searching exact function-name bytes in ASCII/UTF-8 and UTF-16LE, and exact textual graph-GUID forms, can identify candidates. If binary GUID patterns are tried, record their encoding/byte-order assumptions as **hypotheses**; this collected declaration evidence does not validate `.uasset` GUID serialization. Neither a name hit nor a GUID hit proves a call. Hits can represent definitions, name tables, inherited metadata, editor history, stale/unconnected nodes or other serialized references. Binary coincidences are also possible. Absence can result from encoding, indirection, omitted sections/sidecar files, serialization differences or unsupported mapping. It cannot establish that no caller exists.

The required positive proof remains a native source export or attributable editor reference result showing a **call node**, the exact target/member and connected execution path. Only then can a lifecycle trace assess invocation, owner/world selection, repetition and registry timing. This metadata phase must stop at a candidate list; no source export, broad collector, save, compile, cook, deployment or game execution occurred during this review.

## Interpretation boundary

Package references are useful to narrow the investigation. They cannot alone resolve function-level usage, show that a registry entry is fresh, establish cooked visibility, or prove that the shipping game instantiates/configures an observer. An empty scoped result remains **UNKNOWN/BLOCKED** for the startup contract. A nonempty result is **OBSERVED package-reference metadata**, pending source review. No editor/native query or offline candidate byte scan has been performed by this reviewer.
