# Installed editor source investigation

Date: **2026-09-20**. Package **1.1.390.0e / UE4.26.2**. The user continued after the proposed native-order/telemetry inspection. This session performed bounded installed-file research and one diagnostic editor commandlet attempt; it did not implement a companion or execute gameplay.

## Results

**OBSERVED:** the installed content contains dedicated Form On Me, order-dispatch, selection-display and follow-order assets. The [order audit](EDITOR_ORDER_SOURCE_AUDIT.md) pins 20 relevant files and input mappings. The [serialized-name evidence](EDITOR_SERIALIZED_NAME_EVIDENCE.json) records byte offsets and hashes from eight named uncooked Blueprint assets. These are filename/text-fragment observations, not reconstructed graph connections.

| Concrete source lead | What was observed | Still unknown |
|---|---|---|
| `UI/Mech/DPad/DpadActionLogic/LanceCommands/Dpad_FormOnMeLogic.uasset` | `FollowOrder` package reference, `MWPlayerController`, `GetSquadCommandOrderContext`, `PostSquadOrderClass`, `MWSquadCommandOrderInfo`, `OrderRecipients`, `OrderContext` fragments | Actual receiver signature, graph edges, ownership and authority |
| `Dpad_BaseLanceOrder.uasset` and `Dpad_LanceOrderDispatcher.uasset` in the same folder | Recipient and selection/dispatch name fragments; exact offsets in the audit | Slot-to-current-AI binding, all-lance versus one-member behavior, stale identity rejection |
| `Modes/MissionDirectorSystem/MissionComponents/SquadOrders/FollowOrder.uasset` | `ExecuteOrder`, `IssueOrder`, `MWSquad`, `MWSquadCommandOrderInfo`, and `Ally_FollowJob` package reference | Native acceptance/readback, actual job dispatch and observed following |
| `SquadOrderBase.uasset` and `SquadCommandComponent.uasset` | `GetMembersForOrder`, `InitializeFromSquadCommandOrderInfo`, `MWAIController`, `RequiredPawns` and related fragments | Parameter types, execution sequence, human override, host/thread/lifetime rules |
| `AI/_common/VariableContainerComponents/UnitPilotComponent.uasset` | `IsPiloted` fragment | Its semantics and a durable pilot identity; no live pilot data was read |

**OBSERVED:** the named Victory and LowEntry plugin folders contain descriptors, binaries and limited supporting assets, but no implementation/header source. The [transport audit](EDITOR_TRANSPORT_SOURCE_AUDIT.md) preserves the bounded search and 13 artifact hashes. Project enablement and Runtime module declarations are established. Actual installed read/write signatures, synchronous/asynchronous implementation, payload bounds and shipping behavior remain **UNKNOWN**.

**OBSERVED:** the [telemetry audit](EDITOR_TELEMETRY_SOURCE_AUDIT.md) pins two additional assets and their ASCII offsets. `AI/_common/Decorators/BTDecorator_WithinRangeFromActor.uasset` contains `K2_GetActorLocation`, `K2_GetPawn` and `BlackboardKeySelector` names, making it the first proposed position-graph inspection. `Objects/Targets/MechTargetComponent.uasset` contains armor/internal-damage and paper-doll names, a weaker health-display lead. Neither establishes a connected getter, actor binding, units, freshness or live telemetry.

## Diagnostic API inspection

The bundled project already enables PythonScriptPlugin and EditorScriptingUtilities (`MW5Mercs.uproject:79–85`). Epic documents a PythonScript commandlet for inspecting/editor scripting without opening its UI: [UE4.27 Python scripting documentation](https://dev.epicgames.com/documentation/en-us/unreal-engine/scripting-the-editor-using-python?application_version=4.27), accessed2026-09-20. This is adjacent-version documentation; it is not evidence that the MW5 fork supports every API or headless configuration.

Prepared [Inspect-EditorReflection.py](../scripts/Inspect-EditorReflection.py) to enumerate already-exposed Python type/member documentation, with no requested asset/level loads, native gameplay calls, UObject creation, asset saving, cooking or Play-In-Editor. Its output is a new project-local JSON report; it also writes a completion marker to the editor log. Inherited/unexposed methods are not exhaustively captured. A separate review checked the script and [guarded launcher](../scripts/Invoke-EditorReflection.ps1); Python syntax and PowerShell parsing passed.

The launcher uses the installed `Engine/Binaries/Win64/UE4Editor-Cmd.exe`, bundled project, `-Installed -run=pythonscript`, and requests `-NullRHI -NoShaderCompile` with unattended startup. The local polled guards require8GiB to start and stop only the owned diagnostic process below4GiB or after180seconds; these are chosen safeguards, not publisher requirements or hard resource caps. Startup can still load dependencies and write normal editor cache/log/stub data.

**OBSERVED FAILED ATTEMPT:** the process ran **18:44:45–18:45:01 -04:00**, PID20084, and exited3 with `EXCEPTION_ACCESS_VIOLATION` in an unresolved Engine/CoreUObject stack. It produced **no reflection report**. The script did not reach its completion marker, and no Python execution is observed. The log shows the startup Sphere mesh build completing before the crash; that is not evidence that Sphere caused it. Neither a low-space guard nor the time limit triggered. The commandlet is gone; it was not restarted.

- [Run receipt](evidence/editor-source/native-reflection-run.json)
- [Diagnostic editor log](evidence/editor-source/native-reflection-editor.log)

The root cause is **UNKNOWN**. Shader-disabled/headless startup is a hypothesis, not a demonstrated incompatibility or corrupted installation. Epic's completed installation verification remains separate evidence. No settings repair, plugin replacement, reinstall or speculative flag retry was performed.

The diagnostic log did establish the effective local DDC path for **that invocation**: `C:/Users/jlewi/AppData/Local/UnrealEngine/Common/DerivedDataCache`, writable, with no shared cache path found. It also records editor configuration reads under `C:/Users/jlewi/AppData/Local/MW5Mercs/Saved/Config/Windows`. These observations do not establish every GUI-session path or a sufficient future working-space allowance.

## Existing graphical editor startup

**OBSERVED:** a separate `UE4Editor.exe`, PID18596, started **18:40:11 -04:00**, before the diagnostic commandlet. It was left untouched. The user reports Epic says Running but no editor window has appeared; their screenshot is `C:/Users/jlewi/AppData/Local/Temp/codex-clipboard-003e9304-efde-4a7c-ac86-f9ddf786a943.png`.

The existing editor log at `C:/Users/jlewi/AppData/Local/MW5Mercs/Saved/Logs/MW5Mercs.log` shows nine shader workers and a decreasing queue: **2,673 at18:46:17**, **2,638 at18:47:27**, **2,602 at18:48:52**. This establishes ongoing work, not a ready window or an ETA. C: had **8.36GiB free at18:48:53**; a subsequent snapshot was8.46GiB. Windows' pagefile measured8.03GiB, versus6.50GiB before this editor startup; that is a separate contributor to used disk space. No paging/cache setting was changed.

Follow-up **18:53:24 -04:00:** the shader queue reached **1,330** at18:53:23; C: had **8.31GiB free**. Compilation is progressing. These point-in-time observations do not establish graphical readiness or remaining startup duration.

Follow-up **18:55:05 -04:00:** the queue reached **1,185**, with **6.30GiB free**. Space headroom remains tight; no additional instance should be launched. Ten updated documents passed local-link checks, five evidence JSON files parsed, the two installation receipt hashes stayed unchanged, and both telemetry asset hashes matched their audit.

The subsequent pagefile measurement was **10.05GiB**, up from8.03GiB earlier; this accounts for approximately2GiB of additional disk use without implying a new editor download. PID18596 still matched the original18:40:11 start time.

## Next bounded action

While startup continued, the user requested useful waiting work. Prepared the [ready-window checklist](../design/EDITOR_READY_CHECKLIST.md) and [eight-contract gap matrix](EDITOR_CONTRACT_GAP_MATRIX.md). Revised the metadata collector for bounded existing-GUI execution, including early collision checks, `MW` name coverage, static/custom descriptor handling and explicit collection limits. Independent review found no high/medium issue; [13 synthetic checks](evidence/editor-source/reflection-collector-offline-validation.json) passed using bundled Python3.7.7. These are **MOCK_ONLY**, not engine execution. The earlier script is preserved as [native-reflection-commandlet-script.py](evidence/editor-source/native-reflection-commandlet-script.py), SHA256`47C67EB3ED670D667D5DC3E37FEA03EF197917B5DB7407EEA0687F84042FC605`. Prior run receipts/logs were not changed.

Startup follow-up **19:01:26 -04:00:** the log remained active, showing5,027shaders after a later batch was added; C: had4.94GiB free. Counts can rise as additional work is queued and are not an overall completion estimate. No new engine process was launched for this waiting work.

The metadata step was subsequently resolved by text extraction from the automatically generated editor reference, as recorded below. Do not launch another instance or repeat the failed commandlet. GUI metadata collection remains an optional fallback only for a specific remaining gap; its prior failure receipt stays historical.

Then inspect the named Blueprint graph edges and recipient selection, native readback/human override and one telemetry field. Graphical desktop control is unavailable to this task, so user interaction may be needed to run the script or expose a graph. No gameplay, mod creation/cook/deployment, loaders, paid APIs, voice work or campaign persistence is included. **All shipping-game proof gates remain NOT_PERFORMED.**

## Unattended integration goal — 2026-09-20, from19:05 -04:00

The user supplied `C:/Users/jlewi/.codex/attachments/6a3c80a6-530b-488a-9ef6-4203b8de01f2/pasted-text-1.txt`: prepare the first evidence-backed game integration experiment while preserving research-only permissions. The [checkpoint](evidence/editor-source/integration-goal-checkpoint.json) pins that request, current artifact hashes, editor metadata and remaining gates. This first goal turn made **PROGRESS**, not merely a verified wait; the original target remains unmet and the goal stays active.

**Actual environment:** the dedicated OneDrive project on Windows10.0.19045; existing editor PID18596 retains its18:40:11start. Current tool inventory supplies filesystem/process inspection and browser tools, but no usable native editor desktop control. No Sales Assist, employer or other-game workspace was accessed. The installation checker still returns `READY_FOR_VERSION_REVIEW`; package/engine identity remains1.1.390.0e/UE4.26.2. The latest checkpoint records11.62GiB free, after an earlier2.40GiB observation; no assistant cleanup or settings change caused that recovery. The editor logged engine initialization at19:00:23, completion timing at19:03:32 and Python-stub generation at19:03:34. This does not independently verify a responsive visible window.

### What changed and was demonstrated

1. **OBSERVED — actual generated declarations:** the running editor wrote `C:/Users/jlewi/AppData/Local/MW5Mercs/Intermediate/PythonStub/unreal.py`,21,026,350bytes, SHA256`AC4C46761BC54099302155BC0A908AE3F64B161CA77EB9AFD0CC6C1F1B826480`. The new [text inspector](../scripts/Inspect-EditorPythonStub.py) streams/hashes that file, parses selected class text with Python AST, checks source stability and refuses output collisions. It never imports or executes the stub. Its [report](evidence/editor-source/generated-stub-contracts.json) captures26selected classes,213method entries and217property entries, with no missing selected classes. Ten oversized class docstrings are explicitly truncated; methods/enum declarations are separate. This is **GENERATED_EDITOR_DECLARATIONS_ONLY**, not native source or execution.
2. **Actual native declaration leads:** the recipient structure contains `Array(int32)` IDs and `MWSquad.get_members_for_order` returns controllers. `MWPlayerController.post_squad_order_class` is documented client-safe but returnsNone; `MWMech` owns the context getter. A current-worker/job route and `MWCommandType.FOLLOW` provide a readback hypothesis. `Actor.get_actor_location()` documents a root-component Vector, but live AI binding and sampling remain unproven. The [order audit](EDITOR_ORDER_SOURCE_AUDIT.md) retains exact source lines and unresolved graph/authority/origin edges.
3. **Installed transport declarations:** Victory text read/write and LowEntry JSON methods are now documented in this generated package reference. Implementations, blocking/size/depth bounds, atomicity and shipping availability remain unknown. LowEntry integer getters accept near-integral floats within0.001 and returnint32; they are not a strict schema validator. See the [transport follow-up](EDITOR_TRANSPORT_SOURCE_AUDIT.md).
4. **MOCK_ONLY reliability progress:** the command model passed43cases before changes. Four added fixtures cover direct wrong actor, null binding, human supersession after dispatch and disconnect/reconnect after dispatch. All47cases pass; the original43objects and model source remained unchanged. The architecture now distinguishes same-mission companion/IPC loss (retain deduplication history, disarm/purge actions) from authoritative world-session replacement (new epoch). No native disconnection or save-load detection is implemented.
5. **Updated handoff:** existing README, feasibility, architecture, source register, audits, proof procedure, gap matrix, ready checklist and NEXT_CODEX_PROMPT now reflect the declaration evidence and remaining blockers. The supervised procedure includes prerequisites, isolated Instant Action, observation, one command, independent confirmation, stop conditions and rollback, but explicitly lacks runtime startup commands until an adapter is justified.

### Commands and results

From the dedicated project root:

```powershell
node .\scripts\Exercise-CommandContract.mjs
node --check .\scripts\Exercise-CommandContract.mjs
& 'C:\Program Files\Epic Games\MechWarrior5Editor\Engine\Binaries\ThirdParty\Python3\Win64\python.exe' -B .\scripts\Validate-EditorPythonStub.py
& 'C:\Program Files\Epic Games\MechWarrior5Editor\Engine\Binaries\ThirdParty\Python3\Win64\python.exe' -B .\scripts\Inspect-EditorPythonStub.py
& .\scripts\Inspect-EditorInstall.ps1
```

- Command exercise: exit0; baseline43/43, then47/47 `EXPECTATIONS_MET`, zero native calls. [Current report](OFFLINE_COMMAND_REPORT.json); the [retained earlier report](evidence/editor-source/goal-baseline-command-report.json) preserves pre-change evidence. Node syntax check passed.
- New stub inspector: [16synthetic checks](evidence/editor-source/stub-inspector-offline-validation.json), exit0 under bundled Python3.7.7. Covers no-execution behavior, line/docs/enums, missing types, source/class limits, changed source, malformed/duplicate classes, preserved outputs and publication. Actual extraction also exited0 with stable-source evidence. These are different evidence levels.
- Installation metadata: refreshed successfully; no errors in the checkpoint. No installer, dependency, editor process or game was started by this goal turn.
- Validation/extraction outputs use exclusive publication. On a justified later rerun, choose a new project-local `--report` (validator) or `--output` (inspector); preserve existing evidence. Do not rerun the live editor or bypass a collision by deleting files.
- **NOT_PERFORMED:** real reflection calls, Blueprint graph execution, native state read/order, actual acknowledgement timing, live failure cases, cooking, deployment, packaged-game behavior, mod compatibility or performance. Existing memory/voice exercises were not rerun because they do not resolve this milestone.

### Completion audit and pending actions

| Goal requirement | Current authoritative evidence | Verdict |
|---|---|---|
| Start from actual project/environment | Read local instructions/design/code; refreshed metadata; observed live editor and generated file | COMPLETE for investigation context |
| Establish both integration directions on applicable build | Typed state/order/recipient/job/I/O declarations plus pinned asset leads; no connected graph, lifetime/manual/transport implementation or shipping proof | PARTIAL |
| Smallest permitted code/investigation artifact | Text inspector, bounded generated report and synthetic validation | COMPLETE for permitted helper; no runtime adapter |
| Reliability where executable |43-case baseline,47-case follow-up and16inspector checks | MOCK_ONLY; real acknowledgement timer, native signals and live cases absent |
| Exact supervised experiment and approvals | Updated PROOF_OF_CONCEPT and ready checklist with stop/rollback gates | Procedure prepared; cannot be run as an integration package yet |
| Dated session report and restart handoff | This section, checkpoint and updated NEXT_CODEX_PROMPT | COMPLETE as checkpoint; goal not achieved |

**Milestone: PARTIAL / PACKAGED EXPERIMENT BLOCKED.** The highest-value missing evidence is the connected Form On Me graph and selected-recipient-to-current-AI mapping, followed by native job correlation/manual supersession. Reliable bounded transport and shipping inclusion remain independent blockers. More simulated successes cannot resolve them. The report is not a working companion or a runnable game-test kit.

**First concrete action on return:** in the existing responsive editor, open `Dpad_FormOnMeLogic` at `Content/UI/Mech/DPad/DpadActionLogic/LanceCommands` and show its order/context/recipient graph pins using [EDITOR_READY_CHECKLIST.md](../design/EDITOR_READY_CHECKLIST.md). The generated metadata already exists; do not run another script merely to collect the same declarations. User-assisted graph display is pending because native desktop control is unavailable. Later deployment/game-test approval remains pending until the exact adapter files, startup commands and rollback manifest can be supplied. No routine permission question or paid-service setup is needed now.

## Goal continuation2 — 19:16–19:19 -04:00

The preceding goal turn is classified **PROGRESS** (actual declaration extraction, helper validation and four new fixtures). This turn also made **PROGRESS**: it narrowed a specific remaining follow-target question, while the critical connected-graph/shipping dependency remains unresolved. [Checkpoint02](evidence/editor-source/integration-goal-continuation-02.json) records the revalidated PID18596, unchanged generated-stub hash, current13.49GiB free and supported-access findings. The live process/log observation was a verified wait, not proof of GUI usability; it was not restarted.

A second review found no additional target/correlation accessor in the extracted MWJob/worker/posting declarations, but identified `MWJob.required_behavior_tree` as a concrete source-navigation lead. Read exactly one new219,221-byte asset, `Ally_FollowJob.uasset`, preserving its hash and [230filtered ASCII fragments](evidence/editor-source/follow-job-target-fragments.json). FollowActor/FollowUnit, player-squad-leader and required-tree names now narrow the graph check. The [order audit](EDITOR_ORDER_SOURCE_AUDIT.md) records their byte offsets and native declaration references. A job-initialization bool remains distinct from order acceptance. No property values, graph edges, runtime actor or follow behavior were established.

Read the bundled Python remote-execution helper as text and inspected only relevant configuration fields. `Get-NetUDPEndpoint` failed with Access denied, which was not negative evidence. A successful `netstat -ano -p udp` snapshot filtered to the known editor PID showed6666/24024/62929, without the helper's documented default6766 discovery endpoint. The inspected configuration did not establish remote execution enablement. This does not rule out a nondefault mechanism; it supplies no usable connection to proceed with. No discovery traffic, command channel, listener, remote execution, settings change or plugin action occurred. Do not guess or probe unrelated editor endpoints.

Code and fixtures were unchanged, so passing tests were **NOT_RERUN**. The milestone stays **PARTIAL / PACKAGED EXPERIMENT BLOCKED**. All useful work available from these declarations and this bounded asset inspection is recorded; further proof of the same missing graph/recipient/target/manual contracts requires supported editor inspection or matching implementation source. The first user action and later deployment approval gates above remain current. The active goal has not been marked achieved or blocked on this second goal turn.

## Goal continuation3 — blocked audit, 19:20 -04:00

The previous turn remains **PROGRESS** because it captured and narrowed the actual follow-job source lead. This turn revalidated the same live editor PID/start time, unchanged generated-reference hash and unchanged validated artifact hashes. No real reflection report or new graph evidence appeared. The latest log tail ended with one shader remaining at19:17:26; that alone does not prove completion, a freeze or a usable GUI. C: had13.63GiB free at19:20:24. The process was not restarted or terminated.

No new integration progress occurred; this was a verified process observation and blocked audit. A separate agent challenged the remaining-action assessment and found no high-value permitted action that would resolve the missing graph/recipient/manual/transport implementation contracts with current access. Existing47command cases and16inspector checks retain matching source hashes and remainMOCK_ONLY; tests were not repeated without a change.

The same genuine source-access/contract dependency has persisted across the original goal turn and both continuations. The [blocked audit](evidence/editor-source/integration-goal-blocked-audit.json) records that the three-turn threshold is met and a blocked goal state is required. **The goal is not achieved.** Work must resume from new supported graph/source access or user-supplied graph evidence, not by repeating fragment scans, adding mocks or weakening gates. The named first user action and later runtime approval requirements above are unchanged.

## User-authorized direct inspection attempt — 20:08 -04:00

The user asked Codex to perform the pending editor inspection directly and offered full access. Read the native computer-use skill and its guidance, API and confirmation documents. Its supported `@oai/sky` API is distinct from the browser-only CUA surface; earlier statements that native tooling was categorically unavailable were too broad.

**OBSERVED:** both attempts to initialize `mcp__node_repl__js` failed before window discovery with `failed to write kernel assets: The system cannot find the path specified. (os error 3)`. A successful JavaScript session reset between attempts did not resolve the error. No native input action occurred, and no Blueprint graph was inspected. The [access-attempt record](evidence/editor-source/desktop-access-attempt-2026-09-20.json) preserves these results. The missing internal path and cause remain **UNKNOWN**; broader permissions alone do not resolve this initialization failure.

Separate read-only process metadata reports the original PID18596 responding with title `MW5Mercs - Unreal Editor` and a nonzero main-window handle. This establishes a reported window, not visual readiness or graph contents. C: had13.70GiB free. TEMP/TMP, LOCALAPPDATA and the configured workspace Node executable/package directories exist. The editor was left running. Existing passing offline tests were not repeated. Graph inspection, native state/order execution and shipping tests remain **NOT_PERFORMED**.

## Direct-access continuation — 21:55 -04:00

**OBSERVED:** native JavaScript initialization now succeeds, and `sky.list_windows()` returns the existing `MW5Mercs - Unreal Editor` window plus `Create Mod`. Screenshot capture fails for both with `SetIsBorderRequired failed: No such interface supported (0x80004002)`. Text-only accessibility works but supplies only window roots, with Create Mod focused. One Escape key sent to that observed dialog did not dismiss it. No blind coordinates, asset changes, mod creation, gameplay execution or process restart occurred. [Capture-attempt record](evidence/editor-source/desktop-capture-attempt-2026-09-20.json).

**DOCUMENTED / inference:** independent review verified Windows10 build19045 and Microsoft's [minimum build20348 for IsBorderRequired](https://learn.microsoft.com/en-us/uwp/api/windows.graphics.capture.graphicscapturesession.isborderrequired?view=winrt-26100), accessed2026-09-20. This is consistent with a capture-helper compatibility defect; the helper implementation was not inspected. The installed supported API has no border toggle or alternate capture backend. Current editor screenshots supplied by the user or supported capture recovery are needed to proceed visually. The previous kernel-assets failure is resolved and must not be repeated as the current diagnosis. Graph inspection and all live integration gates remain **NOT_PERFORMED**.
