# Normal-editor observer lookup: installed-source review

Review date: **2026-09-22**. **Preparation only; no editor/game launch, lookup, launcher creation, settings change or installed-script execution.** The coordinating task owns the experiment and current resource decision. This review writes only this document.

Native lookup and normal-editor auto-run/auto-exit tests: **NOT_PERFORMED**. Proposed launcher: **NOT_BUILT**.

**Verdict: a normal full-editor startup has concrete local precedent and a known default map. Automatic `-ExecutePythonScript` execution and automatic exit remain untested on this installation.** This route is distinct from the failed PythonScript commandlet. Normal startup is larger than the metadata lookup itself and cannot be described as a metadata-only process.

The editor was normally closed by the coordinator; [EDITOR_CLOSE_RESOURCE_2026-09-22.json](EDITOR_CLOSE_RESOURCE_2026-09-22.json) records zero remaining editor processes/windows, no forced termination and no save/discard prompt action. Reads below were performed after that recorded closure. The old recommendation to use an already running editor therefore no longer describes the current state.

## Paths and version

Path abbreviations used below:

- `INSTALL` = `C:/Program Files/Epic Games/MechWarrior5Editor`
- `SAVED` = `C:/Users/jlewi/AppData/Local/MW5Mercs/Saved`
- `LOG` = `C:/Users/jlewi/AppData/Local/MW5Mercs/Saved/Logs/MW5Mercs.log`

**OBSERVED metadata, refreshed 2026-09-22:** the completed Epic manifest at `C:/ProgramData/Epic/EpicGamesLauncher/Data/Manifests/6F64B6344614FB850F6BC695B33FFA0F.item` identifies `HoopoeEditor`, package **1.1.390.0e**, this install root, and `bIsIncompleteInstall=false`. Its launch executable is `Engine/Binaries/Win64/UE4Editor.exe` and its ordinary launcher command is `MW5Mercs -Installed`. `INSTALL/Engine/Build/Build.version:2-9` reports **4.26.2**, compatible changelist **14830424**, branch `++UE4+Release-4.26`. These are installation pins, not proof that a new auto-execution switch will succeed. Executable rehash and the final argument list belong to the coordinator's manifest.

## Effective default map: configuration plus observed load

| Evidence | Exact location | Finding |
|---|---|---|
| OBSERVED configured project default | `INSTALL/MW5Mercs/Config/DefaultEngine.ini:50-54` | `EditorStartupMap=/Game/UI/FrontEnd/TitleScreen/TitleScreen_Video.TitleScreen_Video`; GameDefaultMap names the same asset. The section also declares `MWGameInstance` and editor GameMode. |
| OBSERVED startup policy | `INSTALL/Engine/Config/BaseEditorPerProjectUserSettings.ini:156-158` | EditorLoadingSavingSettings uses `LoadLevelAtStartup=ProjectDefault`. |
| OBSERVED remembered level | `SAVED/Config/Windows/EditorPerProjectUserSettings.ini:77-78` | LastLevel is `/Game/UI/FrontEnd/TitleScreen/TitleScreen_Video`. |
| OBSERVED scope of override search | Relevant-key search of INIs below `INSTALL/Engine/Config`, `INSTALL/MW5Mercs/Config`, and `SAVED/Config/Windows` | No later `LoadLevelAtStartup` or competing project/user EditorStartupMap entry was found. This is scoped file evidence, not a complete live configuration dump. |
| OBSERVED actual normal-editor load | `LOG:975,1030,1048` | On 2026-09-22 the editor loaded `../../../MW5Mercs/Content/UI/FrontEnd/TitleScreen/TitleScreen_Video.umap`. Map loading took **67.165 seconds**; total engine initialization was **119.42 seconds**. |

The configured default and the last observed effective map agree. The known map file is `INSTALL/MW5Mercs/Content/UI/FrontEnd/TitleScreen/TitleScreen_Video.umap`, 39,398 bytes; it was hashed without loading/exporting it. No map override or empty-map substitution is justified by this review.

## Python enablement and initialization scope

**OBSERVED:** `INSTALL/MW5Mercs/MW5Mercs.uproject:79-84` explicitly enables PythonScriptPlugin and EditorScriptingUtilities. `LOG:56,79` records their mounting; `LOG:691` records Python **3.7.7**. The installed Python descriptor (`INSTALL/Engine/Plugins/Experimental/PythonScriptPlugin/PythonScriptPlugin.uplugin:17-27`) has Runtime/EarliestPossible preload and an UncookedOnly/PreDefault principal module. Editor Scripting Utilities' descriptor at `INSTALL/Engine/Plugins/Editor/EditorScriptingUtilities/EditorScriptingUtilities.uplugin:19-22` declares an Editor module. Its `Config/BaseEditorScriptingUtilities.ini:1-3` contains a class redirect, not an auto-run recipe.

**OBSERVED scoped settings:** `INSTALL/MW5Mercs/Config/DefaultEngine.ini:285-286` sets Python developer mode true. No `StartupScripts`, `AdditionalPaths` or `bRemoteExecution` override was found in the three INI search roots above. This absence does not certify every possible startup path, a live setting value or absence of a listener. The inspecting shell's process/user/machine `PYTHONPATH` values and process `UE_PYTHON_DIR` were unset. The future editor inherits the actual launch environment, which must be captured separately if different.

Exact file-existence checks found no `init_unreal.py` under `INSTALL/Engine/Content/Python`, `INSTALL/MW5Mercs/Content/Python`, `C:/Users/jlewi/Documents/UnrealEngine/Python` or `C:/Users/jlewi/OneDrive/Documents/UnrealEngine/Python`. Windows' Documents known-folder query returned `C:/Users/jlewi/Documents`. A filename-only check of the installed engine/project plugin roots found three initialization files:

| Installed initialization file, relative to `INSTALL/Engine/Plugins` | Read-only body finding | Activation evidence/limit |
|---|---|---|
| `MovieScene/MovieRenderPipeline/Content/Python/init_unreal.py:2` | Imports MoviePipelineExampleRuntimeExecutor. | Corresponding MovieRenderPipeline.uplugin:16 sets EnabledByDefault=false. |
| `Experimental/Shotgun/Content/Python/init_unreal.py:5-18` | Conditional Shotgun bootstrap import controlled by plugin/environment state. | Shotgun.uplugin:13 sets EnabledByDefault=false. No bootstrap was executed or external environment target opened. |
| `Importers/USDImporter/Content/Python/init_unreal.py:5-7` | Conditionally imports USD editor export classes. | USDImporter.uplugin:13 sets EnabledByDefault=false. |

None of those three plugins has an explicit enable entry in the inspected project or a mount entry in the closed session's log. **Inference:** these three files were not evidenced as active startup hooks for that session. This is not a proof that all imports or native plugin initialization are absent; imported modules, engine internals and every dependency path were not audited. No installed Python file was executed, modified or copied into a startup path.

## Auto-run, auto-exit and registry readiness

**DOCUMENTED by the prior review, official refresh owned by coordinator:** [Epic UE4.27 Python documentation](https://dev.epicgames.com/documentation/en-us/unreal-engine/scripting-the-editor-using-python?application_version=4.27), The Command Line / Option 1: Full Editor, describes `-ExecutePythonScript` as full startup through the default level, followed by script execution and editor shutdown. The [commandlet review](OBSERVER_REFERENCE_COMMANDLET_REVIEW.md) records its 2026-09-21 access. It is adjacent-version documentation; this review does not claim a fresh web check or local auto-run success.

**UNKNOWN installed implementation:** no C++ implementation/header for Python startup or this full-editor auto-run/exit path was present in the narrowly inspected PythonScriptPlugin and EditorScriptingUtilities trees. Native routing, exception-to-exit behavior, modal-dialog behavior and the point of script execution relative to discovery cannot be source-certified here. The latest GUI log has no observed `ExecutePythonScript` experiment. Its normal shutdown after the coordinator's close action (`LOG:1111-1122,1563`) is not automatic-exit evidence.

**OBSERVED important ordering:** `LOG:1048` records engine initialization completion at **14:11:49.989 UTC**; `LOG:1065` records asset discovery completion at **14:11:55.279 UTC**, approximately **5.29 seconds later**. Therefore a completed default-map load or engine initialization is not sufficient evidence that the asset registry has finished discovery. The unchanged helper can return `STOPPED_REGISTRY_LOADING`; record that as a valid bounded stop, not a completed reference result. Do not add a wait, scan, forced asset load or automatic retry under the description of the unchanged helper. Empty references remain inconclusive about completeness and connected function calls.

## Expected writes, construction and resource decision

**OBSERVED ordinary-startup work:** the closed log records shader working-directory cleanup/local shader compiler setup (`624-627`), writable DDC at `C:/Users/jlewi/AppData/Local/UnrealEngine/Common/DerivedDataCache` (`641`), configuration use under `SAVED/Config/Windows` (`315-316,544-547`), default-level loading (`975-1030`) and Python stub regeneration at `C:/Users/jlewi/AppData/Local/MW5Mercs/Intermediate/PythonStub/unreal.py` (`1061-1064`). A new run can write normal logs/cache/intermediate/config state even when the helper only writes project-local evidence.

**OBSERVED defaults:** `INSTALL/Engine/Config/BaseEditorPerProjectUserSettings.ini:163-177` disables dirty marking for migrated Blueprints, enables map/content autosave, sets its interval to ten minutes, and includes a localization auto-reimport directory. No corresponding override was found in the inspected project/current Windows INIs. This is not evidence that a future run will modify or autosave any asset; it prevents a promise that normal editor startup is categorically write-free. The helper does not intentionally dirty assets. The exact timing and activation of these normal services remain unmeasured.

**PROPOSED risk interpretation:** opening the title map as an editor world is not a request for Play-In-Editor or retail gameplay. It nevertheless loads game assets and native/editor modules and may perform editor-time construction or initialization. The title-map graph and all constructors were not executed or audited by this review. Monitor the actual startup rather than equating no helper loads with no process loads. Runtime control, deployment and shipping compatibility remain outside this lookup.

**PROPOSED coordinator limits reviewed:** admission requires 8 GiB available physical RAM, 8 GiB available commit and 12 GiB free disk; running floors are 2 GiB available RAM/commit and 10 GiB disk; whole-process timeout is **300 seconds** with a separate **30-second** normal-shutdown allowance. The coordinator shortened the proposed timeout in light of the autosave configuration; no autosave setting was changed. These are chosen safeguards, not publisher requirements, hard allocation caps or assurance that resource loss between polls is impossible. The historical 119.42-second startup does not establish a worst case. Helper output caps and its 60 cooperative seconds begin in Python and do not bound native initialization or an individual synchronous query. The shorter outer period does not prove autosave timer semantics or guarantee no ordinary editor/dirty-asset writes. No launcher or execution code is built by this preparation.

The coordinator reports that its current RAM sample does not meet the proposed admission threshold. **No admission PASS is issued here and no launch is attempted.** Refresh all three resource measures and owned-process identity before any later run. If the helper completes, inspect its native report and observed editor exit separately; a zero process exit code alone is insufficient. If it stops for registry loading, preserve that result and end the bounded experiment.

Raw launcher log command lines can contain authentication/account arguments. Preserve only reviewed non-sensitive excerpts in shareable evidence; do not publish or reproduce the full LOG or its raw startup command. This document records the log path, hash and relevant non-sensitive locations only.

## Hash pins read on 2026-09-22

| File | SHA256 |
|---|---|
| Epic manifest identified above | `1A304CCF534B8DD0433F0361FE1D4B8EDCBFE48867899CD91E5C138946D1891C` |
| `INSTALL/Engine/Build/Build.version` | `820D6814CF61B6458FB4FC22247A0EE77B964B3BD7A48FE07222C78389785765` |
| `INSTALL/MW5Mercs/MW5Mercs.uproject` | `A66A2197DF7AE9780A648735520884D04A7BDB2CCE656E324E9ECD5AC4EBAEAB` |
| `INSTALL/MW5Mercs/Config/DefaultEngine.ini` | `3543892993C407F648491E7F0B6DEBE928D7BF80C62708046AD7AD51F7C91C6E` |
| `INSTALL/Engine/Config/BaseEditorPerProjectUserSettings.ini` | `7E6EE32858110980B859FDFE441DFA77FE631D85D33B98D326AFE83EEFDF9968` |
| `SAVED/Config/Windows/Engine.ini` | `6B50B50330CBD5B2E70D3E99DA5C883CBEBF3BD8A5AD323CBD183CD1CA697307` |
| `SAVED/Config/Windows/Editor.ini` | `90E451AD3E29D8965A28E2C564D6A73F1ADA83CF430B3AF7746A148A23183AEC` |
| `SAVED/Config/Windows/EditorPerProjectUserSettings.ini` | `CF12085457237B3E390CEF3F60870FB0273A91FFFBEA4D6A16FF09C8B4A9DA14` |
| `LOG`, 169,353 bytes after closed session | `6EE40EACC19F0DDAF4BE7D6887D0F3BE05B7222F23871F1D45DDEFE4A072D8B7` |
| PythonScriptPlugin descriptor | `A2CFC07ADC6E812A5730CFC1D230A710DD540959AD471D5581F7A90DF30D5610` |
| EditorScriptingUtilities descriptor | `1A07DB8343BC62FADBF2F2B2C6F9C51712CD34D987CE84F4ADAD33B756772E5F` |
| TitleScreen_Video.umap identified above | `4E5BB74B906E9C7732DC4339E794C1D2C09DF6C605ACCDCCACDA1EE6701029F4` |
| Project `scripts/Inspect-ObserverReferences.py`, unchanged, 11,828 bytes | `20C460FDF678DE74568C477B28C41A65408A5B5C7868BC1BB893D05CECED099B` |
| MovieRenderPipeline initialization file | `537BB275D7604CF1C0D2B80C8EA9C53658C64098A7936EDD63F048DED020F322` |
| MovieRenderPipeline descriptor | `2C4CD31C44F7E03CF7D2ECA96C0C907A1BEF5B271674D2738449008BE717FBA1` |
| Shotgun initialization file | `668D013053B55A9F8A8E61DA05C1433EA8E9DBEC92F087D37F7A4915BFF6AD32` |
| Shotgun descriptor | `DDF5975A34E5EA2ABA86BC0FB87C1C3325EA67B0B15B27EB2B4CA4E26445B9E3` |
| USDImporter initialization file | `C49DB08B98B535DA4BA537EC4D3761B34D748F369254B61AE5D15E2DA95F2F6F` |
| USDImporter descriptor | `DFC346A7F21691AA2E4B8AED071F23596DC6B7C98FC0AD4C5C8D89334F10212B` |

Hash identity records the bytes inspected. It does not certify publisher authenticity, a complete configuration merge, absence of future writes or successful auto-execution. No README, NEXT_CODEX_PROMPT, Git state, launcher or runtime code was changed by this review.
