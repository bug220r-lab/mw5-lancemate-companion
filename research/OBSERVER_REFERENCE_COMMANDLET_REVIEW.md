# Observer reference lookup: commandlet review

Reviewed **2026-09-21**. Applicable recorded installation: MW5 editor **1.1.390.0e / Unreal 4.26.2**. Scope: installed text/source and retained startup evidence, plus one narrowly targeted Epic documentation page to resolve missing Python command-line syntax. This review launched no editor/game/commandlet, changed no installed file or setting, and executed no downloaded script. Native lookup: **NOT_PERFORMED by this review**.

**Recommendation (PROPOSED): prefer the already initialized editor's supported Python entry point. Do not repeat the previous commandlet unchanged merely because this helper is smaller.** A new startup mode could be a separately recorded diagnostic experiment if the existing editor cannot be used, but the available evidence does not identify a fix for the old startup crash or establish commandlet registry completeness.

The parent task owns execution, fresh resource/process checks and the final decision. The user's newer permission to run the editor removes an authorization gap; it does not convert earlier failed startup into a supported configuration or override the need to preserve current work.

## Local evidence and supported arguments

Installed paths below are relative to `C:/Program Files/Epic Games/MechWarrior5Editor/` unless otherwise specified.

| Evidence | Exact location | Finding and limit |
|---|---|---|
| OBSERVED | `MW5Mercs/MW5Mercs.uproject:79-85` | PythonScriptPlugin and EditorScriptingUtilities are enabled. This is configuration evidence, not successful commandlet execution. |
| OBSERVED | `Engine/Plugins/Experimental/PythonScriptPlugin/PythonScriptPlugin.uplugin:17-27` | Python preload is Runtime/EarliestPossible; the principal plugin is UncookedOnly/PreDefault. This remains editor scripting, not shipping Python. |
| OBSERVED | `Engine/Source/Programs/AutomationTool/AutomationUtils/CommandletUtils.cs:250-285`, especially 270-277 | Bundled AutomationTool constructs a project argument followed by `-run=...`, `-abslog=...`, `-stdout`, `-CrashForUAT`, `-unattended` and `-NoLogTimes`. This supports those generic launcher spellings. It does not prove the PythonScript commandlet works in this MW5 fork. There is no need to inherit every AutomationTool flag for this investigation. |
| DOCUMENTED, different commandlet | `Engine/Plugins/Experimental/PythonScriptPlugin/SphinxDocs/PythonAPI_docs_readme.txt:53-62,75-98` | The installed README documents **PythonOnlineDocs**. It uses `-NoShaderCompile` because that documentation commandlet does not need shaders. It does not document PythonScript with `-NullRHI -NoShaderCompile`. Do not run PythonOnlineDocs as a fallback: its documentation describes dependency installation and document generation unrelated to this lookup. |
| OBSERVED bounded absence | Filename inspection of installed PythonScriptPlugin, `Engine/Source` and relevant `Engine/Documentation` names | No PythonScriptCommandlet, AssetRegistry runtime implementation, LaunchEngineLoop or NullRHI source file was found by the bounded filename searches. Available matching commandlet source was AutomationTool C#. Python API HTML exists as a bundled `.tgz`, which was not executed or extracted. This is a limit of this inspection, not proof that the installed executable lacks those features. |

**DOCUMENTED, adjacent engine version:** Epic's [Scripting the Editor using Python, UE4.27](https://dev.epicgames.com/documentation/en-us/unreal-engine/scripting-the-editor-using-python?application_version=4.27), accessed 2026-09-21, sections The File Menu and The Command Line, specifies `-run=pythonscript -script="<file>"` with the project and UE4Editor-Cmd executable. It also describes `-ExecutePythonScript="<file>"` as a distinct full-editor startup mode that loads the default level before execution, then exits after the script. The menu offers Execute Python Script for an existing session. Epic warns against startup `ExecCmd`/`py` because it may run too early. These are documentation-supported entry points for 4.27, not a validated startup recipe for this 4.26.2 MW5 installation.

**UNKNOWN:** local implementation/compatibility of `-NullRHI` in the failed combination; whether removing either rendering/shader flag fixes anything; whether `-Installed`, `-nop4` or `-nosplash` affect this fault. The old log proves those strings were supplied. Its `Installed Engine Build: 1` entry does not isolate the effect of the `-Installed` argument. No new flag combination is certified by this review.

## What the previous attempt actually proves

**OBSERVED:** `research/evidence/editor-source/native-reflection-run.json:3-13` records startup at 18:44:45 -04:00 on 2026-09-20, exit **3**, no stop guard and no report. Its argument string includes `-Installed -run=pythonscript -script=... -unattended -nop4 -nosplash -NullRHI -NoShaderCompile` and an absolute project-local log. The run lasted approximately 16 seconds. Disk free bytes changed from 10,903,769,088 to 10,903,089,152; these are historical points, not present headroom or peak-resource measurements.

The retained `native-reflection-editor.log` shows:

- **Line 158:** the exact attempted command line.
- **Lines 594-608:** cache initialization and a writable local DDC at `C:/Users/jlewi/AppData/Local/UnrealEngine/Common/DerivedDataCache`.
- **Line 609:** AssetRegistry module startup. This is not a discovery-complete marker.
- **Lines 618-619:** Sphere static-mesh building and completion.
- **Lines 620-653:** access violation reading address `0x58`, unresolved Engine/CoreUObject frames, error shutdown.

The log provides no observed Python completion or helper result. The crash follows Sphere building, but no symbolized cause identifies Sphere, either flag, asset corruption or resource exhaustion as responsible. Changing the script does not target this failure because its execution was not reached.

`research/EDITOR_SOURCE_SESSION_2026-09-20.md:27-36` records the failed attempt and chosen 8 GiB start / 4 GiB stop / 180-second safeguards. The same document at line 64 records later normal-GUI engine initialization and Python-stub generation. That is evidence the GUI route progressed, not proof of a commandlet repair. It does not establish current process readiness, cached startup costs or current free space.

## Will three metadata queries see the registry?

**OBSERVED declarations:** the retained native reference at
`research/evidence/editor-source/mod-research-collection-20260921T023909Z-5eeaf52a/unreal-api-reference.txt`
attributes `AssetRegistry` to `AssetRegistry / IAssetRegistry.h` at lines 112655-112662.

- Lines **112748-112761** describe `get_referencers` as package references from on-disk metadata, returning an array or None.
- Lines **112778-112787** describe `is_loading_assets` as current file-loading status.
- Lines **112665-112672**, **112686-112704** separately expose waiting, global searching and recursive synchronous scanning.

**UNKNOWN:** these declarations do not say the PythonScript commandlet automatically indexes every potential referring package before running the script. The earlier module-startup log does not settle it. A false loading flag alone does not prove an exhaustive reverse-reference index. An empty query may mean no indexed references; it cannot prove no package refers to the target. A narrow scan of only the three targets would also not discover every other package that might reference them.

**PROPOSED interpretation:** retain positive references as observed metadata leads. Treat empty results as inconclusive unless registry population is independently established, ideally by the already initialized GUI's completed discovery and a known expected reference among the same queried packages. Even that control validates a useful portion of the index rather than universal completeness. Do not quietly add `search_all_assets`, scans or waits to force a result; they change the bounded lookup's work and timing. Package references do not identify a connected function call or establish runtime instantiation.

## Resource bounds and retry decision

**OBSERVED helper text:** the reviewed `scripts/Inspect-ObserverReferences.py` pins three package paths/hashes, uses no load/export/save/cook API, and checks registry loading before and after its three direct queries. Lines 32-33 cap retained output (512 per target, 1,024 total, 1 MiB report) and choose 60 cooperative seconds. Lines 112-122 enforce checks between native operations: 2 GiB disk, 768 MiB available physical memory, 1 GiB available commit and a project-local STOP marker. At line 171 the native result is allocated before truncation of retained entries. These limits cannot interrupt that native call, limit native allocation, bound startup, or prevent editor initialization cache/config/log writes. The final report can record an error while the process itself exits normally; review the report, not just the exit code.

**PROPOSED decision:**

1. Use the existing healthy editor through its supported menu/console once the parent can operate it. The new three-query helper answers a concrete remaining question without a second engine startup.
2. An identical commandlet retry is **not warranted by this review**. A warm cache, elapsed time or a smaller script is not evidence that the pre-Python fault was corrected.
3. If a new process becomes necessary, distinguish a full-editor `ExecutePythonScript` experiment from a commandlet retry. It adds default-level loading and corresponding resource costs; do not label the whole process metadata-only. Choose and record one justified mode, fresh disk/RAM/commit/process checks, unique log/output paths, owned-process timeout/termination behavior and native-call limits before starting it. Preserve the existing editor and unsaved work. Avoid parallel engine startups when headroom is uncertain.
4. A commandlet experiment should also have an explicit expected registry-readiness outcome. If it fails before Python, yields no reliable registry evidence or repeats the same crash, retain the receipt and stop that route. Do not cycle speculative rendering flags or broaden scans until something happens.

This is an engineering recommendation, not an extra user-permission requirement. The parent can act within the user's authorization after making the chosen experiment concrete. All actual startup changes and native results remain **NOT_PERFORMED by this review**.

## Identity of reviewed artifacts

SHA256 values read on 2026-09-21:

| File | SHA256 |
|---|---|
| `scripts/Inspect-ObserverReferences.py` | `20C460FDF678DE74568C477B28C41A65408A5B5C7868BC1BB893D05CECED099B` |
| `research/evidence/editor-source/native-reflection-run.json` | `A45008D3B95F379E8A69833EF7547E61BF8E5856D07890720AF43C291819E135` |
| `research/evidence/editor-source/native-reflection-editor.log` | `A4D09E6F881A48E55ADEF9D4ECF373211FEC0E02A7B4E69D0D79153458F8310C` |
| Installed PythonScriptPlugin descriptor | `A2CFC07ADC6E812A5730CFC1D230A710DD540959AD471D5581F7A90DF30D5610` |
| Installed Python API documentation README | `831BD9A48CCA7E2FAB0A935327A9FE3FE078607D1DCB02ED11FE314D6AD52B32` |
| Installed `CommandletUtils.cs` | `8156D4C39D1848A9CDE3A8215BD99197AD4184E7D02D86E4347010A9C1E0A51B` |

This review writes only this document. It does not update shared handoffs or select a runtime implementation.
