# Offline reference lookup and desktop access checkpoint

September 22, 2026. **UNKNOWN/BLOCKED for M0 startup. No editor, game, reference helper, binary parser, cooking or gameplay test ran in this assessment.** The editor remains closed at the user's request to conserve RAM.

The existing observer task performed a bounded read-only assessment of whether preserved collection data or installed registry files could replace the three pending `AssetRegistry.get_referencers` queries. It did not establish a supported equivalent. This is not a claim that no compatible reader exists anywhere. The unchanged helper and frozen supervisor repair retain their separate status; this assessment does not repeat them.

## Existing collection cannot establish complete incoming references

`scripts/Collect-AIResearch.py:223-226` uses the desired hard and soft package options with searchable and both management categories disabled. Lines 324-327 collect outgoing dependencies, capped at 2,048 per allowlisted package. The [collection result](AI_COLLECTION_RESULT_2026-09-20.md) records 1,455 edges and 451 targets with no incomplete queries inside the selected 249-package scope. Lines 426-446 exclude already-exported targets from the coverage frontier. Consequently, that frontier is not a complete reverse index; the [factory trace](PASSIVE_OBSERVER_FACTORY_TRACE.md:75) already records this limitation.

The preserved collection report `evidence/editor-source/ai-research-collection-20260921T030437Z-f7d8e930/report.json`, SHA-256 `f5dbc2eeacbb81c0ea3e331651dfd40946b347fc219869246c48b9b853bc5eea`, supports historical incoming subsets only:

- `MW5PlayerController`: itself, `MW5PlayerControllerDerived`, `PlayerControllerComponent` and `PlayerControllerSwitchMech` (report lines 708, 788, 12214, 12333).
- `PlayerControllerComponentDataAsset`: `MW5PlayerController` and itself (lines 713, 12271).
- `InstantActionPlayerController`: no record/dependency hit in that collected subset. This is not a completed negative reverse-reference query.

The [completed controller export](OBSERVER_CALLER_NATIVE_RESULT.md) establishes inheritance without establishing a factory caller. The [commandlet review](OBSERVER_REFERENCE_COMMANDLET_REVIEW.md) preserves its pre-Python failure; it offers no reason to repeat that unchanged commandlet. Raw string or GUID screening remains candidate discovery, not parsing or complete reference evidence, as recorded in the [reference API review](OBSERVER_REFERENCE_API_REVIEW.md).

## Candidate local files are insufficient by themselves

The observer owner inspected metadata only, without opening or parsing these binaries:

| File | Bytes | Modified UTC |
|---|---:|---|
| `%LOCALAPPDATA%\MW5Mercs\Intermediate\CachedAssetRegistry.bin` | 663,942,909 | 2026-09-22 21:30:26.176433 |
| Editor `MW5Mercs\Releases\1.0\WindowsNoEditor\AssetRegistry.bin` | 70,864,380 | 2026-09-20 21:25:02.5190141 |
| Same release directory, `Metadata\DevelopmentAssetRegistry.bin` | 373,589,857 | 2026-09-20 21:25:07.5593078 |

File names and timestamps do not prove format, snapshot freshness, dependency completeness or equivalence to the current editor registry. Installed engine metadata remains 4.26.2 / compatible CL14830424. Installed `Engine/Source` contains Programs, without Runtime/AssetRegistry implementation. `BaseEngine.ini:1883-1888` defaults several cooked dependency serialization categories off and permits platform overrides; this warns against assuming that a release registry contains the required edges, without establishing its historical effective cook configuration.

The collected version-matched API declarations (`unreal-api-reference.txt`, SHA-256 `ac4c46761bc54099302155bc0a908ae3f64b161ca77eb9afd0cc6c1f1b826480`, lines 112748-112762 and 39209-39226) document native query/options, not a standalone reader. Epic's [4.27 registry overview](https://dev.epicgames.com/documentation/en-us/unreal-engine/asset-registry?application_version=4.27) and [Python API](https://dev.epicgames.com/documentation/en-us/unreal-engine/python-api/class/AssetRegistry?application_version=4.27), inspected by the observer owner, describe registry discovery/query semantics rather than a matching binary format. The older [UE-32232 issue](https://issues.unrealengine.com/issue/UE-32232) relates a cached registry to an asset gatherer in 4.12; it is not serialization evidence for this 4.26 fork. Generic UE5.5 documentation likewise cannot establish compatibility. No guessed parser, new package or third-party script was used.

## Supported desktop connection: discovery only

The current supported Windows Computer Use connection enumerated five windows and identified one Epic Games Launcher window (ID 134010, observed at this checkpoint). A text-only `get_window_state` for that exact returned window yielded `accessibility: null`. No screenshot, activation, click, keystroke, close action or application launch was performed. This confirms window discovery, not usable native prompt inspection, Unreal controls or a normal-close bridge. The earlier screenshot failure remains historical; it was not blindly retried. Browser-only access is a separate capability.

A scoped process-name inventory found no running editor or game at this checkpoint. These instantaneous read-only checks do not prove general process absence or future admission. A later lightweight resource snapshot at 23:22:32.872 UTC measured approximately 4.874 GiB available RAM and 25.113 GiB free disk, below the unchanged eight-GiB native-editor gate and also below the five-GiB local conversation diagnostic admission requirement. Neither gate is lowered.

## Exact remaining dependency

Either establish a supported observable editor session meeting current ownership/resource/stop prerequisites, or establish a proven compatible offline reader together with authoritative format, provenance and dependency-completeness evidence for an appropriate registry snapshot. Merely locating a registry binary is insufficient. Until then the three prepared queries remain **NOT_PERFORMED**, and factory caller, startup, cooking and shipping observation remain **UNKNOWN/BLOCKED**. Independent project-local development can continue while the editor stays closed.
