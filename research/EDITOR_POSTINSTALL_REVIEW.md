# Editor post-install review

Reviewed **2026-09-20**. **OBSERVED: official Mercenaries editor installation completed.** Named metadata and configuration were read without launching the editor or game. Graph/source-contract inspection, cooking, runtime transport and shipping behavior remain **NOT_PERFORMED**.

## Completion and package identity

The [completion receipt](EDITOR_COMPLETION.json) records Epic's successful process at **2026-09-20T22:26:42.848Z** (**18:26:42.848 -04:00**): `ProcessSuccess=TRUE`, `FailureType=NoError`, `ErrorCode=OK`, `FinalProgressValue=1.0`, `VerifyTime=9:04 min`. Its source is the named log:

`C:\Users\jlewi\AppData\Local\EpicGamesLauncher\Saved\Logs\EpicGamesLauncher.log`

The [post-install checker receipt](EDITOR_POSTINSTALL.json), observed **18:30:51.5535884 -04:00**, contains one registration and one complete manifest, with the expected executable present. Both saved JSON files parsed successfully.

| Item | Observed value |
|---|---|
| Product | MechWarrior 5 Editor |
| Epic app / version | `HoopoeEditor` / `1.1.390.0e` |
| Catalog item / namespace | `8b875a03af264458a79b8bad35a16f52` / `b9def67e597b4be7a16146146a044d02` |
| Installation root | `C:\Program Files\Epic Games\MechWarrior5Editor` |
| Final manifest | `C:\ProgramData\Epic\EpicGamesLauncher\Data\Manifests\6F64B6344614FB850F6BC695B33FFA0F.item` |
| Manifest completeness | `bIsIncompleteInstall=false` |
| Manifest-declared installation size | **256,122,524,996 bytes**; not a measured or guaranteed logical/allocated footprint |
| Editor engine | **4.26.2**, compatible CL **14830424**, branch `++UE4+Release-4.26` |
| Bundled project | `MW5Mercs/MW5Mercs.uproject`; FileVersion 3; empty EngineAssociation |
| Project modules | Runtime `MechWarrior`; Editor `MechWarriorEditor` and `MechWarriorFactory` |
| Named bundled descriptors | VictoryBPLibrary **1.0**, Runtime/PreDefault; LowEntryJson **4.25.0 r2**, Runtime/PreDefault plus UncookedOnly editor module |
| Space at 18:32:18.0492185 -04:00 | **11,246,854,144 bytes free (~10.47 GiB)** on C: |
| First-open/cache working allowance | **UNKNOWN** |

Epic's successful verification is evidence of its completed process. Local hashes identify the observed files; they are not an independent comparison against publisher-supplied hashes. Descriptor/module presence establishes names and declarations, not callable functions, asynchronous transport or shipping behavior. Remaining staging-directory presence does not negate the separate success/manifest evidence and is not permission to remove it.

## Retail comparison

The completion receipt preserves the refreshed named Steam files:

- `C:\Program Files (x86)\Steam\steamapps\common\MechWarrior 5 Mercenaries\game_info.xml`: **1.14.390 / CL456620**, build name `Main_Release-390_Shipping_CL456620`.
- `C:\Program Files (x86)\Steam\steamapps\appmanifest_784080.acf`: **app784080 / build24241637**.
- `MW5Mercs\Binaries\Win64\MechWarrior-Win64-Shipping.target` under that retail root: **UE4.26.2**, compatible CL **14830424**, branch `++UE4+Release-4.26`; BuildId `9bd41d70-2eec-41d4-8ae2-2ad7e06162b7`.

**OBSERVED agreement:** editor and retail engine version, compatible changelist and branch. **UNKNOWN compatibility:** editor package `1.1.390.0e` and game `1.14.390` use distinct labels; the agreement does not establish matching PGI asset/native API behavior, a successful editor launch, a valid cook or retail mod compatibility. No update or package conversion is implied.

## Exact proposed source-viewing launch scope

The final manifest's launch fields were independently read directly:

| Field | Value |
|---|---|
| Executable, relative to install root | `Engine/Binaries/Win64/UE4Editor.exe` |
| Arguments | `MW5Mercs -Installed` |
| Absolute executable | `C:\Program Files\Epic Games\MechWarrior5Editor\Engine\Binaries\Win64\UE4Editor.exe` |
| Executable SHA256 | `33092EC0737275E59A2C132675A7938813A98F27F575BF43D8A3CDB53A441BF2` |
| Bundled project | `C:\Program Files\Epic Games\MechWarrior5Editor\MW5Mercs\MW5Mercs.uproject` |
| Proposed working directory | Observed installation root; preserve the manifest's relative context |
| Proposed evidence output | Project-local `research/evidence/editor-source/`; not created by this review |

This is a **PROPOSED launch scope**, not an executed command or launch approval. A later graphical session would view existing definitions and capture narrow notes/screenshots for one AI's Form On Me, binding/authority/lifetime, native readback/manual override, one telemetry field and bundled I/O. It would permit ordinary editor startup logs/settings and shader/DDC generation or applicable cache maintenance; exact effective locations and adequate space must first be bounded.

The scope excludes Play/Simulate, cooking, mod creation, asset saves/migration, new plugins or build tools, running retained repository scripts, game/save changes and retail gameplay. Stop for conversion, repair, new terms or dependency prompts outside that scope. Further authorized named text/metadata reads can proceed without requesting another approval.

## Configuration evidence for startup writes

Accessed **2026-09-20**, installed editor **1.1.390.0e / UE4.26.2**. These are exact configuration observations, not a claim about the effective graph of an editor that has never been launched.

| Source / location | What is documented in the installed file | Limit |
|---|---|---|
| `C:\Program Files\Epic Games\MechWarrior5Editor\Engine\Config\BaseEngine.ini:1696–1698` | Source builds default to DerivedDataBackendGraph; installed builds default to InstalledDerivedDataBackendGraph; a `-DDC=GraphSectionName` argument can select another graph | No extra DDC argument is proposed; effective selection has not been observed |
| Same file, **1752–1759** | Installed graph: Boot at `%ENGINEUSERDIR%DerivedDataCache/Boot.ddc`; writable Local at `%ENGINEVERSIONAGNOSTICUSERDIR%DerivedDataCache`, with EditorOverrideSetting and cache-maintenance options; a Shared entry also exists | Macro expansion, user settings, environment/shared availability and runtime resolution remain unverified |
| Same file, **1757** | Boot has `MaxCacheSize=512` | A Boot-node setting is not an overall installation or DDC-space cap |
| `C:\Program Files\Epic Games\MechWarrior5Editor\MW5Mercs\Config\DefaultEngine.ini:98–107` | Separate DerivedDataBackendGraph: project Boot at `%GAMEDIR%DerivedDataCache/Boot.ddc`, Local at `../../../Engine/DerivedDataCache` | Do not equate this source-build graph section with the installed graph selected at launch |
| Same project file, **109–119** | Separate BambooDDC graph has its own Boot/Local/Shared entries | Its existence does not establish selection; the section header is line 109 |

These entries justify expecting cache writes and possible cache maintenance. They do not establish actual startup log locations, shader-cache volume, total first-open demand or sufficient working space. The approximately **10.47 GiB** free is a point-in-time observation and cannot be promoted to a safe allowance. No cache or environment setting was changed. The DDC graph's AsyncPut label is not evidence of an asynchronous external companion transport.

## Evidence fingerprints

Hashes are SHA256 over file bytes. The receipt files also contain complete paths, sizes and hashes for engine metadata, the project and plugin descriptors.

| Artifact | SHA256 |
|---|---|
| [EDITOR_POSTINSTALL.json](EDITOR_POSTINSTALL.json) | `990582D6A49B680FA0716FA1BAA95E6E78893C3F313FEA615A6F01F0941513EC` |
| [EDITOR_COMPLETION.json](EDITOR_COMPLETION.json) | `DD7C39891C152C02560FE057913F99E6E7D6A65C1DCDD00B2403531E75EBB6F3` |
| Final Epic manifest | `1A304CCF534B8DD0433F0361FE1D4B8EDCBFE48867899CD91E5C138946D1891C` |
| Engine Build.version | `820D6814CF61B6458FB4FC22247A0EE77B964B3BD7A48FE07222C78389785765` |
| MW5Mercs.uproject | `A66A2197DF7AE9780A648735520884D04A7BDB2CCE656E324E9ECD5AC4EBAEAB` |
| BaseEngine.ini | `E8FDF60643985E32E294945B22E1F586510A16B2FCCB017CFF15E003B8A7B463` |
| MW5Mercs/Config/DefaultEngine.ini | `3543892993C407F648491E7F0B6DEBE928D7BF80C62708046AD7AD51F7C91C6E` |

The [updated worksheet](../design/EDITOR_INSPECTION.md) marks completed metadata steps and retains all unrun source/runtime gates. The next useful work is bounded resolution of startup configuration/working space and the remaining source-inspection scope, followed by a separately authorized graphical session if needed. **No editor/game launch, source-graph inspection, runtime build, gameplay action or cache cleanup occurred in this review.**
