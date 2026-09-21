# Installed editor transport source audit

Access date: **2026-09-20**. Applicable installation: **MechWarrior 5 Editor / HoopoeEditor 1.1.390.0e**, installed at `C:\Program Files\Epic Games\MechWarrior5Editor`. This is a read-only inspection of installed files and metadata, not an editor or shipping-game execution result.

**OBSERVED, incorporating the 19:11 local-time generated-reference report:** the installed Victory and LowEntry folders contain plugin descriptors, editor module manifests, binaries and resources, but no source, headers, build rules or plugin config. Both plugins are explicitly enabled in the installed project descriptor. A later editor-generated Python reference now establishes reflected Victory file-I/O and LowEntry JSON declarations, signatures and documentation. This is generated editor reference evidence, not execution of those functions.

**UNKNOWN/BLOCKED:** native implementation bodies and exact C++ signatures, complete Blueprint node/pin behavior, calling-thread and blocking guarantees, a bounded asynchronous transport alternative, LowEntry resource/precision limits and shipping-game behavior. The generated Python signatures resolve the earlier declaration gap; they do not resolve these implementation and runtime questions. Existing upstream research cannot substitute for this installed fork.

## Generated declaration follow-up — 2026-09-20

**OBSERVED:** a separate editor-generated reference exists at [unreal.py](<C:/Users/jlewi/AppData/Local/MW5Mercs/Intermediate/PythonStub/unreal.py>). Its **21,026,350 bytes** hash to `AC4C46761BC54099302155BC0A908AE3F64B161CA77EB9AFD0CC6C1F1B826480`. This AppData location is outside the installed-editor filename search recorded below; its discovery does not contradict that earlier scoped source/header absence.

The text-only [inspection helper](<C:/Users/jlewi/OneDrive/Documents/ChatGPT/MW5 LANCEMATE COMPANION/scripts/Inspect-EditorPythonStub.py>) produced [generated-stub-contracts.json](<C:/Users/jlewi/OneDrive/Documents/ChatGPT/MW5 LANCEMATE COMPANION/research/evidence/editor-source/generated-stub-contracts.json>) at **23:11:29.783686 UTC / 19:11:29.783686 -04:00**. The report records `GENERATED_EDITOR_DECLARATIONS_ONLY`, matching before/after file identity metadata, **26 selected classes**, no missing classes and **10 class-documentation truncations**. None of those truncations affects Victory/LowEntry class documentation or the method contracts below; no method-count or class-byte truncation was reported. The helper reads text and parses selected bounded blocks with `ast`; it does not import or execute the generated stub, retain placeholder function bodies as implementations, or call Unreal APIs.

| Follow-up artifact | SHA256 |
|---|---|
| `scripts\Inspect-EditorPythonStub.py` | `ABC648E40659818D2A064D6D222C557CAE8FA77123620422532FFD6CA4E13507` |
| `research\evidence\editor-source\generated-stub-contracts.json` (246,744 bytes) | `C8B21AA1BD79183857E5686EFF36FD6B404B061412C8C51F1CBFF21B2ADE7F7A` |

The following typed summaries combine each generated Python signature with its argument/return documentation. They are **Python binding declarations**, not reconstructed native C++ signatures. Line numbers refer to the exact hashed `unreal.py` above; the report preserves original line offsets and documentation.

| Owner and original lines | Typed generated contract | Documented semantics and limit |
|---|---|---|
| `VictoryBPFunctionLibrary`, 292362–292374 | `load_string_from_file(full_file_path: str = "Enter Full File Path") -> str or None` | Reads a text file as one string; documentation states Unicode support. Exact encoding and detailed failure behavior are not established |
| Same, 292377–292392 | `load_string_array_from_file(full_file_path: str = "Enter Full File Path", exclude_empty_lines: bool = False) -> (string_array: Array(str), array_size: int32) or None` | Documents line splitting and optional whitespace-only/empty-line exclusion. Its prose has an apparent error about returning false when a file “could be loaded”; do not use that sentence as a validated failure contract |
| Same, 293146–293160 | `file_io_save_string_text_to_file(save_directory: str, joyful_file_name: str, save_text: str, allow_over_writing: bool = False, allow_append: bool = False) -> bool` | Documents a complete directory path plus chosen filename. The exposed flags do not establish atomic writes, append/overwrite precedence, encoding, locking or precise failure conditions |
| Same, 293163–293177 | `file_io_save_string_array_to_file(save_directory: str, joyful_file_name: str, save_text: Array(str), allow_over_writing: bool = False, allow_append: bool = False) -> bool` | Documents one supplied string per line; the same execution/atomicity limits remain |
| `LowEntryJsonLibrary`, 288208–288224 | `json_parse_json_string(json_string: str) -> (return_json_object_value: LowEntryJsonObject, return_json_array_value: LowEntryJsonArray, branch: LowEntryJsonParseResult)` | Documents parsing an object or array. No input-byte, nesting, allocation or execution-time bound appears in this declaration |
| Same, 287570–287581 | `object_to_json_string(json_object: LowEntryJsonObject, pretty_print: bool = True) -> str` | Object serialization with an exposed formatting flag; output limits and numeric round-trip guarantees remain unknown |
| Same, 288239–288250 | `array_to_json_string(json_array: LowEntryJsonArray, pretty_print: bool = True) -> str` | Array serialization; same limits |
| Same, 287810–287820 | `object_is_set(json_object: LowEntryJsonObject, key: str) -> bool` | Documents whether a key exists |
| Same, 287853–287865 | `object_get_null(json_object: LowEntryJsonObject, key: str) -> LowEntryJsonValueAndTypeFound` | Documents checking both entry existence and null type |
| Same, 287930–287943 | `object_get_integer(json_object: LowEntryJsonObject, key: str) -> (int32, branch: LowEntryJsonValueAndTypeFound)` | **The documented conversion accepts a float less than 0.001 away from a whole number.** This accessor alone is not strict integer schema validation |

Ownership metadata identifies `VictoryBPLibrary` / `VictoryBPFunctionLibrary.h` at stub lines **290159–290163**, and `LowEntryJson` / `LowEntryJsonLibrary.h` at **286691–286695**. Both classes derive from `BlueprintFunctionLibrary`, and the captured methods have `@classmethod` decorators. This establishes generated reflected declarations, not a successful node invocation or recovered source header.

`LowEntryJsonParseResult` declares `FOUND_OBJECT=0`, `FOUND_ARRAY=1`, `STRING_IS_EMPTY=2`, `UNABLE_TO_PARSE=3` at **13728–13731**. The separately named `LowEntryJsonValueFound` declares `FOUND=0`, `NOT_FOUND=1` at **13802–13803**; do not confuse it with the `LowEntryJsonValueAndTypeFound` used by typed getters. The latter enum was read directly as text at **13785–13787** and declares `SUCCESS=0`, `NOT_FOUND=1`, `WRONG_TYPE=2`; it was not among the helper's selected classes. `object_get` at **288114–288140** documents type-tagged values, including `int32`, and a `None` type for an absent key. These declarations improve the known missing/null/type-checking contract; their actual error outputs and behavior have not been tested.

**PROPOSED validation implication:** inspect parse-result and typed-getter branches explicitly. Do not treat a default value or a successful near-integer conversion as proof of a valid command schema. String identifiers would avoid relying on an undocumented 64-bit numeric round trip; strict numeric syntax/range checks still need an implementation and tests. No serialization, file exchange or command consumer was implemented by this follow-up.

**Still UNKNOWN/BLOCKED:** the methods expose direct returns without a callback/latent token in these signatures, but that alone does not prove blocking or asynchronous implementation. No bounded asynchronous file/JSON facility was identified in the inspected plugin declarations. Native thread ownership, maximum I/O duration, resource caps, cancellation, shutdown, atomic publication, concurrent readers/writers, duplicate-key handling, numeric precision and cooked-game support remain unresolved. All corresponding execution and shipping tests remain **NOT_PERFORMED**.

## Inspection scope and absence evidence

The initial search used `rg --files`, followed by `rg --files --hidden --no-ignore` and an independent `Get-ChildItem -Recurse -Force` inventory of exactly:

- `C:\Program Files\Epic Games\MechWarrior5Editor\MW5Mercs\Plugins\VictoryPlugin`
- `C:\Program Files\Epic Games\MechWarrior5Editor\MW5Mercs\Plugins\LowEntryJson`

The inventories agree: **4 Victory files and 9 LowEntry files**, enumerated below. Neither folder has a `Source`, `Config` or `Intermediate` directory. Neither contains `.h`, `.hpp`, `.cpp`, `.cs` or `.ini` files. Consequently no `UFUNCTION` declaration, implementation body, `.Build.cs` dependency list or generated registration code was available there.

The named-header fallback searched filenames under the complete installed editor root with `--hidden --no-ignore` and the six globs `*Victory*.h`, `*Victory*.cpp`, `*Victory*.cs`, `*LowEntry*.h`, `*LowEntry*.cpp`, `*LowEntry*.cs`. It returned **zero matching paths**. `MW5Mercs\Intermediate` does not exist; `Engine\Intermediate` exists and is included in that root-level filename search. No named generated header was available to inspect. This bounded filename search does not claim that every unrelated engine header was examined or that archived/compiled metadata contains no relevant symbols.

A text-only search for `LoadStringFromFile`, `FileIO__SaveStringTextToFile`, `Async`, `Serialize` and `Deserialize` in the named plugin folders, limited to source/header/build/config/descriptor/module/JSON extensions, returned no matches. A search of `MW5Mercs\Config` `.ini`/`.json` files for the exact plugin/function names also returned no matches. The project descriptor separately establishes plugin enablement, as recorded below. General gameplay uses of the word “Victory” are not plugin evidence.

DLLs, dylibs, the icon images and the macro asset were inventoried and hashed only. No binary strings, exports, disassembly, asset graph extraction or decompilation was performed.

## Installed text evidence

All line numbers are one-based in the exact files hashed below. Path aliases are exact absolute prefixes, not search patterns:

```text
E = C:\Program Files\Epic Games\MechWarrior5Editor
V = C:\Program Files\Epic Games\MechWarrior5Editor\MW5Mercs\Plugins\VictoryPlugin
J = C:\Program Files\Epic Games\MechWarrior5Editor\MW5Mercs\Plugins\LowEntryJson
W = C:\Users\jlewi\OneDrive\Documents\ChatGPT\MW5 LANCEMATE COMPANION
```

| Evidence | Exact file and lines | OBSERVED declaration | Limitation |
|---|---|---|---|
| Package identity | `W\research\EDITOR_POSTINSTALL.json:9–19`; `W\research\EDITOR_COMPLETION.json:15` | Completed-install snapshot identifies `HoopoeEditor`, `1.1.390.0e` | Reuses the recorded installation identity; this audit did not rerun Epic verification |
| Engine identity | `E\Engine\Build\Build.version:2–9` | UE4.26.2; compatible changelist 14830424; branch `++UE4+Release-4.26` | Matching retail engine metadata does not establish binary/source or mod compatibility |
| Project enablement | `E\MW5Mercs\MW5Mercs.uproject:40–44,73–77` | `VictoryBPLibrary` and `LowEntryJson` each have `Enabled: true` | Configuration intent, not evidence of a successful load or callable node |
| Victory version and module | `V\VictoryBPLibrary.uplugin:3–4,13–20` | Version 1 / `1.0`; EngineVersion `4.26.0`; `VictoryBPLibrary`, `Runtime`, `PreDefault`; installed true, no content | Descriptor version is not a source commit; engine string is separate from the package's actual 4.26.2 engine |
| Victory platform/dependency declaration | `V\VictoryBPLibrary.uplugin:21–37` | Win64 is among the platform whitelist; `ApexDestruction` is enabled as a plugin dependency | No `.Build.cs` is present, so the complete native module dependency list is unknown |
| Victory Windows module mapping | `V\Binaries\Win64\UE4Editor.modules:2–5` | BuildId `0af6a96c-14c0-4dec-9f4e-d7ede01f11ec`; maps `VictoryBPLibrary` to `UE4Editor-VictoryBPLibrary.dll` | Names an editor binary; does not expose function signatures or establish the retail implementation |
| LowEntry version/purpose | `J\LowEntryJson.uplugin:3–6,13–15` | Version 25 / `4.25.0 r2`; EngineVersion `4.26.0`; installed true; can contain content; descriptor describes Blueprint JSON creation/parsing | Description is metadata, not a verified function list, parser contract or precision/size guarantee |
| LowEntry module split | `J\LowEntryJson.uplugin:16–26` | `LowEntryJson`: `Runtime` / `PreDefault`; `LowEntryJsonEditor`: `UncookedOnly` / `Default` | The second module is declared `UncookedOnly`, not `Runtime`. Its presence must not be treated as cooked-game functionality |
| LowEntry Windows module mapping | `J\Binaries\Win64\UE4Editor.modules:2–6` | Same Windows BuildId as Victory; maps the runtime-named and editor-named modules to their two `UE4Editor-*.dll` files | A module's Runtime classification does not turn its supplied editor DLL into a verified shipping DLL |
| LowEntry Mac module mapping | `J\Binaries\Mac\UE4Editor.modules:2–6` | BuildId `13144385`; maps the two modules to `.dylib` files | Included inventory metadata only; no Mac compatibility or execution claim |

## Initial static-file contract results (historical)

This table records the initial source/descriptor inspection before the generated reference became available. The follow-up above supersedes its declaration/signature and documented JSON-type gaps; native implementation, bounded transport and shipping questions remain open.

| Question | Result for this installed package | What would resolve it |
|---|---|---|
| Does `LoadStringFromFile` exist, with what arguments, return value and Blueprint metadata? | **UNKNOWN/BLOCKED.** No source/header/generated declaration is supplied in the searched paths | An actual exposed editor node/function declaration or matching supplied source, with full argument types and output semantics |
| Does `FileIO__SaveStringTextToFile` exist, with what overwrite/append/encoding behavior? | **UNKNOWN/BLOCKED.** No installed implementation body or declaration inspected | Installed node/declaration plus implementation evidence; test encoding, failure and append/overwrite semantics separately if later authorized |
| Are those installed file operations synchronous or asynchronous? | **UNKNOWN/BLOCKED.** The earlier upstream audit found synchronous operations, but no equivalence to these DLLs was established | Matching implementation/thread contract. A timer or repeated Blueprint invocation alone would not demonstrate nonblocking I/O |
| Is a bounded asynchronous file/socket/pipe alternative actually supplied? | **No alternative established by this inspection.** No worker, latent-action declaration, async class, task implementation or socket API was found in available plugin text | An actual installed API and evidence of byte/queue bounds, cancellation, shutdown ownership, thread handoff and error behavior |
| What LowEntry JSON functions/types are callable in cooked runtime? | **UNKNOWN/BLOCKED.** Runtime module and JSON-oriented description are observed; a macro asset exists but was not inspected | Real callable node/declaration evidence with runtime ownership; separate cooked-package validation |
| Are JSON parse/serialize costs and inputs bounded? | **UNKNOWN/BLOCKED.** No maximum message length, nesting limit, allocation limit or execution-time bound established | Actual parser/serializer implementation and deliberately bounded protocol validation |
| What are JSON number, string and failure semantics? | **UNKNOWN/BLOCKED.** Integer precision, null/missing distinctions, UTF encoding, duplicate keys, malformed input, failure outputs and error reporting are unverified | Installed API/source contract, then isolated tests after approval |
| Is file exchange an atomic/reliable message transport? | **UNKNOWN/BLOCKED.** No locking, atomic replacement, partial-write handling, size precheck, sequencing or replay protection established | Explicit implementation of those guarantees plus failure tests; JSON support alone provides none of this evidence |
| Does any candidate survive cooking and work in the shipping game? | **NOT_PERFORMED** | A separately approved, versioned packaged-game proof with rollback; editor declarations or node visibility alone are insufficient |

**Earlier OBSERVED follow-up: reflection attempt failed before producing a report.** The coordinating task ran a bounded headless metadata probe through the already-enabled PythonScriptPlugin from **18:44:45 to 18:45:01 local time (-04:00) on 2026-09-20**. The [run record](<C:/Users/jlewi/OneDrive/Documents/ChatGPT/MW5 LANCEMATE COMPANION/research/evidence/editor-source/native-reflection-run.json:2>) records process 20084, exit code **3** and `report_present: false`; the [editor log](<C:/Users/jlewi/OneDrive/Documents/ChatGPT/MW5 LANCEMATE COMPANION/research/evidence/editor-source/native-reflection-editor.log:620>) records an access violation during startup, with Engine/CoreUObject frames, before any Python-generated API report. This does not diagnose a plugin defect or establish a function contract. At that point, all signature, exposure, implementation, async and serialization unknowns were unchanged. Separately, the coordinating task observed graphical editor process **18596**, started **18:40:11** before this probe, with nine shader workers and queued shader jobs decreasing **2673 to 2638**; the user reported Epic showing Running without a visible editor window. These were startup observations, not successful editor readiness. The recommendation at that point was to await that existing startup before choosing another reflection route, without blindly retrying the headless probe or killing the existing editor. The later generated-reference evidence is recorded above and does not retroactively make this failed probe successful. No upstream replacement or native-loader fallback is implied.

## Fingerprints

SHA256 values identify the exact inspected files, not their provenance or functional correctness. Binary files have no source line numbers; their content was not interpreted. Each path below expands using the absolute prefixes above.

| File | Bytes | SHA256 |
|---|---:|---|
| `V\VictoryBPLibrary.uplugin` | 807 | `48089205E3EF311602621680A579BAC5D24660BA6B18F4BB10DAC1C08CA29761` |
| `V\Binaries\Win64\UE4Editor.modules` | 135 | `1A163F2AE559E281DA7358EFE1B19D4304011473B788933AEDA47E23E393BF37` |
| `V\Binaries\Win64\UE4Editor-VictoryBPLibrary.dll` | 1060352 | `200F53C256DDDDA936537A7188464D9BF37BF895C1F6343A3A9D12DEFCDDD076` |
| `V\Resources\Icon128.png` | 45224 | `D26ACF338A5004FC9E1EC3FCCAE763C69B6FC985C666B20B5C33D556CE0AB81B` |
| `J\LowEntryJson.uplugin` | 749 | `7A29B3DB3CE8043E37FEC4AA8C4E325E8AE1451111FD3D2846372BCEDCA53DC3` |
| `J\Binaries\Win64\UE4Editor.modules` | 188 | `0175B26C728831842C5BBAFC409A0C5E70BCD4D308E992D2E837041644DE4FDF` |
| `J\Binaries\Win64\UE4Editor-LowEntryJson.dll` | 706048 | `8E8AB41DD8199E3F73AD0C12310DE54386D8AD43D72880CA9411A8ED0849C56C` |
| `J\Binaries\Win64\UE4Editor-LowEntryJsonEditor.dll` | 211968 | `A3F50DB4B4AC633569612ED3CC6AAF8D8457C0F2B8CA894445B5FCF57A6249D7` |
| `J\Binaries\Mac\UE4Editor.modules` | 164 | `21D877EEADBFE950C1CBFCA803D854EDA8C31A76E2F46538C214A540F9EDE58F` |
| `J\Binaries\Mac\UE4Editor-LowEntryJson.dylib` | 1413332 | `F8107A0BD5E2CD09EB7D17B324CF0914375F11F68A713AB6FC3BD165F6770A4F` |
| `J\Binaries\Mac\UE4Editor-LowEntryJsonEditor.dylib` | 337112 | `D4D7E6D569326825C34FB087C3971244B3424427EAF73E45E5663377EB04DF65` |
| `J\Content\Blueprints\LowEntryJsonMacros.uasset` | 848783 | `ED32F571CEA2C2FE96297E7D68270D6D377CCA5CBB9782289C35C0A3E0FBE3CC` |
| `J\Resources\Icon128.png` | 8407 | `B54B55E5136125BE12E8F6A129D25CDCDF6923085C967B2FEA6DB1D2EBD0A06A` |
| `E\MW5Mercs\MW5Mercs.uproject` | 4653 | `A66A2197DF7AE9780A648735520884D04A7BDB2CCE656E324E9ECD5AC4EBAEAB` |
| `E\Engine\Build\Build.version` | 212 | `820D6814CF61B6458FB4FC22247A0EE77B964B3BD7A48FE07222C78389785765` |

Referenced project snapshots, hashed at this audit:

- `W\research\EDITOR_POSTINSTALL.json`: `990582D6A49B680FA0716FA1BAA95E6E78893C3F313FEA615A6F01F0941513EC`.
- `W\research\EDITOR_COMPLETION.json`: `DD7C39891C152C02560FE057913F99E6E7D6A65C1DCDD00B2403531E75EBB6F3`.

The initial static-file audit wrote only this document; the later project-local text helper/report are separately identified above. This document update changes no installed files, project configuration, game state or saves. No generated or downloaded source was imported, executed or substituted by the text inspection. The coordinating task's failed editor-startup probe is recorded separately. Native file/JSON API execution, transport execution, builds and shipping behavior tests remain **NOT_PERFORMED** by these inspections.
