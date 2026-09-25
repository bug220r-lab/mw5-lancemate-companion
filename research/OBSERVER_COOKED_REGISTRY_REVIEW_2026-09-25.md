# Structured cooked observer registry review

**OBSERVED, offline binary metadata: all three expected asset records are present in the exact cooked registry, and the registration record's asset class matches the stock factory filter.** The bounded decoder accounts for all 2,447 bytes. This narrows the earlier printable-string result; it does not establish that shipping MW5 mounted this registry, merged it, discovered/loaded the registration, created the component or displayed the widget. The missing-readout observation remains **INCONCLUSIVE**.

Access/review date: **2026-09-25**. Input: [cooked-AssetRegistry.bin](evidence/retail-observer/startup-observation-20260925T061051Z/cooked-AssetRegistry.bin), **2,447 bytes**, SHA-256 `bad69d85cd2a54641c2e41f756708a7b7354c2f9bf490b3d8a10830e9636773a`. The file is the preserved extraction used by the [startup review](OBSERVER_STARTUP_RESULT_2026-09-25.md); this review does not independently repeat PAK extraction or shipping file validation. See the [machine-readable receipt](OBSERVER_COOKED_REGISTRY_REVIEW_2026-09-25.json) for every field, byte offset, name reference, tag, source identity and parser test result.

## Exact records

Offsets below are decimal, zero-based, with exclusive end offsets. Every record has package path `/LanceObserverProbe` and chunk IDs `[0]`.

| Byte range | Asset name | Serialized asset class | Package name |
|---|---|---|---|
| `[32,559)` | `BP_LanceObserverProbeComponent` | `Blueprint` | `/LanceObserverProbe/BP_LanceObserverProbeComponent` |
| `[559,902)` | `DA_LanceObserverProbeRegistration` | `PlayerControllerComponentDataAsset_C` | `/LanceObserverProbe/DA_LanceObserverProbeRegistration` |
| `[902,1340)` | `WBP_LanceObserverProbeReadout` | `WidgetBlueprint` | `/LanceObserverProbe/WBP_LanceObserverProbeReadout` |

The exact serialized object paths are:

```text
/LanceObserverProbe/BP_LanceObserverProbeComponent.BP_LanceObserverProbeComponent
/LanceObserverProbe/DA_LanceObserverProbeRegistration.DA_LanceObserverProbeRegistration
/LanceObserverProbe/WBP_LanceObserverProbeReadout.WBP_LanceObserverProbeReadout
```

The component record has ten tags. Its `GeneratedClass` is `BlueprintGeneratedClass'/LanceObserverProbe/BP_LanceObserverProbeComponent.BP_LanceObserverProbeComponent_C'`; its `ParentClass` is `BlueprintGeneratedClass'/Game/Objects/_common/Components/PlayerControllerComponents/PlayerControllerComponent.PlayerControllerComponent_C'`; its `NativeParentClass` is `Class'/Script/Engine.ActorComponent'`.

The registration record has four tags:

| Tag | Serialized value |
|---|---|
| `PrimaryAssetType` | `PlayerControllerComponentDataAsset_C` |
| `PrimaryAssetName` | `DA_LanceObserverProbeRegistration` |
| `AssetBundleData` | `(Bundles=)` |
| `NativeClass` | `BlueprintGeneratedClass'/Game/Objects/_common/Components/PlayerControllerComponents/PlayerControllerComponentDataAsset.PlayerControllerComponentDataAsset_C'` |

The widget record has eleven tags. Its `GeneratedClass` is `WidgetBlueprintGeneratedClass'/LanceObserverProbe/WBP_LanceObserverProbeReadout.WBP_LanceObserverProbeReadout_C'`. Both parent tags are `Class'/Script/UMG.UserWidget'`. `TickFrequency=Auto`, `PropertyBindings=0` and `TickPrediction=WontTick` are recorded tag values, not observations of runtime ticking.

Raw package-flag words are `0x00040000`, `0x00000000` and `0x00040000`, respectively. They are retained without inferring gameplay behavior or cook failure from them.

## Format and coverage

**DOCUMENTED schema source:** original maintained [FabianFG/CUE4Parse](https://github.com/FabianFG/CUE4Parse), fixed commit [`149cad578905243d181ab12ace556ed218f6563a`](https://github.com/FabianFG/CUE4Parse/commit/149cad578905243d181ab12ace556ed218f6563a). The relevant files were fetched as text, read and hashed; none was executed or installed. This is third-party serialization implementation evidence, not PGI engine source or an executed Unreal deserialization test. The installed editor's `Engine/Source` location contained no matching AssetRegistry/AssetData/NameTable files in the narrow search.

The [version enum and magic](https://github.com/FabianFG/CUE4Parse/blob/149cad578905243d181ab12ace556ed218f6563a/CUE4Parse/UE4/Versions/FAssetRegistryVersion.cs) and [header constructor](https://github.com/FabianFG/CUE4Parse/blob/149cad578905243d181ab12ace556ed218f6563a/CUE4Parse/UE4/AssetRegistry/Objects/FAssetRegistryHeader.cs) identify the observed GUID words `717f9ee7 e9b0493a 88b39132 1b388107` and version **7 / AddedDependencyFlags**. The [state loader](https://github.com/FabianFG/CUE4Parse/blob/149cad578905243d181ab12ace556ed218f6563a/CUE4Parse/UE4/AssetRegistry/FAssetRegistryState.cs) chooses the older name-table branch for that version. The [name-table reader](https://github.com/FabianFG/CUE4Parse/blob/149cad578905243d181ab12ace556ed218f6563a/CUE4Parse/UE4/AssetRegistry/Objects/FNameTableArchiveReader.cs) defines the signed 64-bit name-table offset, index/number pairs and tag key/string pairs. The [asset-data constructor](https://github.com/FabianFG/CUE4Parse/blob/149cad578905243d181ab12ace556ed218f6563a/CUE4Parse/UE4/AssetRegistry/Objects/FAssetData.cs) supplies record field order and the chunk/flag fields.

The decoder uses the UE4.26 context recorded for this editor/package, corresponding to object version 522 in CUE4Parse's `EGame.GetVersion`; this engine profile is **not itself encoded by this registry header**. `FNameEntrySerialized` defines the string plus two unsigned 16-bit name hashes; `FArchive.ReadFString` defines signed length, narrow/wide encoding and terminators. Exact URLs, relevant sections, source byte lengths and SHA-256 values for all nine inspected schema/version files are in the receipt.

| Byte range | Parsed content |
|---|---|
| `[0,20)` | Four GUID words and registry version |
| `[20,28)` | Name-table offset = 1356 |
| `[28,32)` | Asset count = 3 |
| `[32,1340)` | Three complete asset records, 25 tag pairs, chunk arrays and flag words |
| `[1340,1348)` | Dependency-section length = 4 |
| `[1348,1352)` | Dependency-node count = 0 |
| `[1352,1356)` | Package-data count = 0 |
| `[1356,2447)` | Name count = 30; 30 serialized names and 60 stored 16-bit hashes |

**OBSERVED:** no unparsed body gap or trailing bytes; all forty FName references index the thirty-entry name table; every FName number is zero; each object path equals package name plus asset name; each package path matches its package directory. Every stored string has a valid terminator and this file's narrow strings are ASCII. Name hashes are retained but **not recomputed**. Empty dependency/package-data sections describe this registry only; they do not prove the assets have no external dependencies.

## Validation and reproduction

The project-authored [bounded decoder](../scripts/Inspect-CookedObserverRegistry.py) uses Python's standard library and reads the input without mutation. It accepts only this exact file identity at the command-line entry point. Its internal format reader rejects unsupported versions, numbered FNames, nonempty dependency/package-data variants and non-ASCII narrow strings rather than guessing. It is not a general Unreal asset reader.

Run from the project directory with the already-installed Python interpreter:

```powershell
& 'C:/Users/jlewi/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe' scripts/Inspect-CookedObserverRegistry.py --self-test --output research/OBSERVER_COOKED_REGISTRY_REVIEW_2026-09-25.json
```

**PASS, OFFLINE_PARSER_VALIDATION_ONLY:** the three expected name/class identities and full parse coverage were checked. The decoder rejected **2,606 malformed in-memory variants**, including all **2,447** proper file prefixes; negative and out-of-range indices at **all 40 FName locations / 80 cases**; every nonempty string's corrupted terminator; invalid header/version/offset/count/length values; mismatched object path; unsupported numbered names; nonempty or malformed trailing sections; and an appended byte. These checks exercise the decoder, not engine acceptance. No malformed fixture was written over the evidence file.

## What this changes, and what remains unknown

**OBSERVED/DOCUMENTED comparison:** the [stock factory trace](PASSIVE_OBSERVER_FACTORY_TRACE.md), sourced to `010-MW5PlayerController-source.COPY` graph `AddPlayerControllerComponents` around lines 1502-1535, searches `PlayerControllerComponentDataAsset_C` with subclasses enabled and no package-path/name filter. The registration record's parsed class exactly equals that class-name filter; its parsed `NativeClass` tag names the expected stock data-asset class. There is no demonstrated cooked registry class/path mismatch in this record. This is a metadata comparison, not a live `GetAssetsByClass` result.

The registry does **not** carry `bAddAtRuntime` or `ActorComponent` among this registration record's tags. Those loaded-object properties were not decoded here. The source/default review remains separate evidence for their authored values; this registry cannot independently certify them or a shipping cast. Likewise a `GeneratedClass` tag establishes a stored reference, not successful class resolution.

**UNKNOWN/BLOCKED:** shipping mount/registry merge; runtime registry visibility; successful load and cast; configured loaded-object properties; stock factory caller/timing; intended owner; actual attached instance count; component entry; independent output visibility; lifecycle and recording. No replacement package, runtime fix or new live experiment is justified solely by this parse. Preserve the [first startup observation](OBSERVER_STARTUP_RESULT_2026-09-25.md) and prepare any later diagnostic under its separate reviewed test/rollback gate.

This work only read project/local metadata and public source text, ran the project-authored offline decoder, and created the decoder plus this report/receipt. No game/editor launch or control, binary edit, mod/plugin/retail change, install, native attach, loader or injection occurred.
