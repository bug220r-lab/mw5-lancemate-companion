# One full-editor startup for the unchanged reference lookup

Prepared **2026-09-22**. **PROPOSED; execution NOT_PERFORMED.** This is a preparation review requested by the coordinating task. The editor was closed normally to free RAM, and the instruction for this turn is to leave it closed. No editor/game/lookup was launched. The [machine-readable experiment](../research/OBSERVER_NORMAL_EDITOR_EXPERIMENT.json) and [read-only snapshot](../research/OBSERVER_NORMAL_EDITOR_PREFLIGHT_2026-09-22.json) are preparation artifacts, not an executed launcher or native receipt.

**September 22 implementation continuation:** the [supervisor implementation](../research/OBSERVER_SUPERVISOR_IMPLEMENTATION.md) is built for synthetic process supervision and read-only native preflight. Its independent review finished **129/130, FAILED**: one synthetic descendant-cleanup case lost verified ownership. A separate later read-only check found all four recorded fixture PIDs absent; the original uncertain cleanup and lock remain preserved. Native desktop observation/normal close and the native helper STOP bridge remain unavailable. No editor/game/lookup execution occurred.

**Decision:** one future full-editor startup remains a distinct diagnostic once admission and supervision are ready. It is not a proven remedy for the earlier commandlet crash. The latest read-only snapshot has **5.14 GiB** available RAM, below the unchanged **8 GiB** threshold; it expires as admission evidence. Supervisor validation and native integration remain incomplete. Do not copy the command below into an unmonitored shell or lower thresholds simply to launch it.

## What this experiment answers

Can the installed MW5 editor enter full-editor mode, execute the already reviewed three-package lookup through `-ExecutePythonScript`, produce an attributable receipt, and exit? If so, did the registry provide useful direct package-reference candidates? These are separate outcomes. Automatic startup, registry readiness, automatic exit and native lookup are all untested for this mode on this installation.

**DOCUMENTED, adjacent version:** Epic's [UE4.27 Python documentation](https://dev.epicgames.com/documentation/en-us/unreal-engine/scripting-the-editor-using-python?application_version=4.27), accessed 2026-09-22, **The Command Line → Option 1: Full Editor**, describes `-ExecutePythonScript`, default-level loading before script execution and shutdown afterward. Its example uses `UE4Editor-Cmd.exe`; the executable's suffix alone does not select commandlet mode. Both scripting plugins must be enabled. This documentation is not validation of the MW5 **UE4.26.2** fork.

**OBSERVED local evidence:** current metadata still identifies UE4.26.2 / compatible CL14830424. Both required plugins are enabled. The [installed-source review](../research/OBSERVER_NORMAL_EDITOR_SOURCE_REVIEW.md) records `EditorStartupMap=/Game/UI/FrontEnd/TitleScreen/TitleScreen_Video.TitleScreen_Video`, the configuration precedence inspected, and a successful September 22 normal-GUI initialization in the retained log. The default map took about 67.165 seconds to load and engine initialization about 119.42 seconds. Asset discovery completion was logged about **5.29 seconds after** engine initialization. This makes early `STOPPED_REGISTRY_LOADING` a plausible outcome; it does not justify adding a wait or scan to the unchanged helper.

The prior `-run=pythonscript -NullRHI -NoShaderCompile` startup failed before Python. [Its review](../research/OBSERVER_REFERENCE_COMMANDLET_REVIEW.md) remains historical evidence. The new proposal uses normal full-editor initialization, supported by the separate successful GUI path; it does not claim an identified cause or fix for the old failure.

## Exact future process specification

The reserved output directory is:

`C:\Users\jlewi\OneDrive\Documents\ChatGPT\MW5 LANCEMATE COMPANION\research\evidence\editor-source\observer-normal-startup-20260922-01`

It was absent at preparation. Create it exclusively only at execution. If it exists by then, stop and allocate a reviewed new attempt ID; never reuse or overwrite it. The proposed process command, to be launched only inside the future supervisor, is:

```text
"C:\Program Files\Epic Games\MechWarrior5Editor\Engine\Binaries\Win64\UE4Editor-Cmd.exe" "C:\Program Files\Epic Games\MechWarrior5Editor\MW5Mercs\MW5Mercs.uproject" -ExecutePythonScript="C:\Users\jlewi\OneDrive\Documents\ChatGPT\MW5 LANCEMATE COMPANION\scripts\Inspect-ObserverReferences.py" -abslog="C:\Users\jlewi\OneDrive\Documents\ChatGPT\MW5 LANCEMATE COMPANION\research\evidence\editor-source\observer-normal-startup-20260922-01\editor.log"
```

Working directory: `C:\Program Files\Epic Games\MechWarrior5Editor\Engine\Binaries\Win64`. The launcher must use structured process arguments, retain the returned process handle, and use `-WindowStyle Hidden` if implemented with PowerShell `Start-Process`. That setting does not promise suppression of all editor windows or resource costs. No `-run`, `-script`, `-ExecCmd`, `-NullRHI`, `-NoShaderCompile`, map override, plugin change or setting change is part of this proposal. Do not add flags by trial and error.

Pinned helper: **11,828 bytes**, SHA256 `20C460FDF678DE74568C477B28C41A65408A5B5C7868BC1BB893D05CECED099B`. Its [47-case fake-only review](../research/OBSERVER_REFERENCE_HELPER_REVIEW.json) remains applicable because the helper is unchanged; that suite was not rerun. The current executable, project, build, plugin descriptors, map configuration and three target file hashes are in the snapshot/manifest. Reverify them immediately before launch and after shutdown where appropriate. Pinning the executable and selected metadata is not a whole-installation integrity check.

## Admission and baseline

These numbers are **PROPOSED engineering limits**, not measured startup requirements or guaranteed reserves:

| Resource | Admission | Stop threshold |
|---|---:|---:|
| Available physical RAM | 8 GiB | Below 2 GiB |
| Available commit | 8 GiB | Below 2 GiB |
| Free C: disk | 12 GiB | Below 10 GiB |

The 8 GiB RAM admission leaves room for the several-GiB editor footprint suggested by the before/after-close samples, a 2 GiB running floor and uncertainty. Those samples include unrelated activity and are not an editor peak measurement. Disk admission allocates 2 GiB above the project's 10 GiB reserve; normal startup may consume more, so the outer monitor must stop on the floor. The helper's own smaller thresholds do not guard startup.

At **2026-09-22T21:52:16Z**, the read-only snapshot recorded **6,047,584,256 bytes RAM**, **10,073,747,456 bytes commit** and **27,127,230,464 bytes disk free**: RAM fails; commit and disk pass. This snapshot expires as admission evidence. Require two fresh passing samples at least one second apart, with the last no more than two seconds old at launch. If unavailable or ambiguous, do not launch. Coordinate an idle window with the owner of local speech/model benchmarks; do not kill unrelated processes to meet the gate.

Before a future run, the supervisor must:

1. Positively enumerate processes and verify no existing MW5 editor, editor commandlet or retail game process. The preparation snapshot had none, but that is not a future guarantee. Refuse to close/reuse someone else's process. Ensure no other collector/lookup and no pre-existing observer lock is active.
2. Reverify every pinned artifact; record exact process command and helper identity. Keep prior lookup/helper results untouched. Snapshot the direct-child `observer-references-*` directory inventory before launch; nested mock fixtures are excluded.
3. Refresh relevant default/user editor configuration, enabled scripting plugins, configured Python paths/startup scripts and known initialization scripts using the source-review scope. Do not execute downloaded scripts or import the generated stub. A changed, newly active or unresolved startup script requires source review before proceeding. The current narrow inspection is not a universal guarantee that no startup code runs.
4. Record hashes and privately copy the exact generated editor configuration files that exist before launch into `baseline/`, with each copy's original path and hash. Record absent files explicitly. Inspect their content before any later publication. The exact file list comes from the source review; do not broadly copy saves, user profiles, logs or authentication data.
5. Establish that this fresh process will be reserved for this lookup, with no concurrent human editing. If a restore/conversion/save/login or other unexpected prompt appears, stop the experiment without accepting it. The installed project/default level is being inspected; it is not a disposable retail campaign or a game scenario. No PIE or stock-game test is included.

## Supervision and owned-process cleanup

The future supervisor must monitor from process creation through verified exit. The separate [supervisor implementation and review](../research/OBSERVER_SUPERVISOR_IMPLEMENTATION.md) now cover synthetic processes, but the final **129/130** review leaves one cleanup failure unresolved and native desktop integration is unavailable. Before editor execution, resolve that failure and the explicitly listed native prerequisites. The supplied Python helper is not the supervisor, and its 47 fake cases are not supervisor validation.

Use a **250 ms observation interval**, a **2-second maximum valid resource-sample age**, and a **300-second whole-process deadline**. The helper's 60-second budget begins only inside Python and is cooperative. Record a bounded timeline at most once per second; cap it at **1 MiB**. Stop if combined attempt-owned engine/stdout/stderr logs exceed **64 MiB**, if attempt-owned helper JSON exceeds its designed ceiling, or if a resource/deadline/manual-stop condition occurs. Polling thresholds are not hard allocation or disk caps; overrun between observations remains possible. Normal caches/shared logs are outside the owned-log cap but still consume disk and RAM.

The installed base editor settings enable map/content autosave at a nominal **10-minute interval**. The final five-minute deadline plus at most 30 seconds of close grace supersedes the initially considered ten-minute deadline. It leaves margin around the observed initialization and helper budgets while avoiding that nominal interval; it does not prove that autosave or other automatic writes cannot occur sooner. Do not disable or alter autosave to run this experiment. Limit outer JSON metadata to **4 MiB** in total, including the timeline; private baseline configuration copies have a separate **4 MiB** ceiling. If the exact baseline files exceed that allowance, revise the manifest before launch.

Before proceeding beyond process creation, bind the process by retained handle plus **PID, creation time and exact executable path**, with the reviewed argument vector. Record creation-time lineage and executable paths for any descendants during the run. Do not infer ownership from a name or parent PID alone after the parent exits; PIDs can be reused. Failure to retain trustworthy ownership stops the experiment and prevents broad cleanup.

On normal completion, allow documented automatic exit and verify it. On a stop, first signal the attributed helper directory's `STOP` file if the helper has started, then request normal close of the exact owned editor through supported window control if available. Allow at most **30 seconds** for normal exit. Never save or discard an unexpected prompt automatically. If the process remains and the fresh lookup-only/no-human-editing condition still holds, terminate only the retained owned process and separately verified descendants. This is the proposed final containment step, not an action taken here. If identity or possible human edits become uncertain, leave automatic termination pending and report `CLEANUP_UNKNOWN`; do not sweep process names or stop unrelated editor/model/game processes. Record any forced exit as an aborted run even if a report exists.

Verify owned process/descendant exit and resource recovery. If a handle, exact path, creation time or lineage cannot be checked, preserve the uncertainty. Do not claim resources recovered merely because the parent process disappeared. Preserve a stale helper lock after abnormal exit; compare its run ownership and recorded token before a separately recorded exact-file removal. Never remove another run's lock.

## Evidence, side effects and interpretation

Planned attempt artifacts are `baseline.json`, bounded `timeline.jsonl`, `editor.log`, `process-result.json`, and `artifact-index.json`, plus exact generated-config baseline copies. The unchanged helper independently writes one direct-child `observer-references-<timestamp>-<token>` directory with its existing JSON contract. Raw native logs and copied configuration are **local evidence pending content review**, not source-backup candidates. The retained GUI log contains launcher/account fields; do not copy or publish it wholesale. No credentials are needed in the proposed command.

The helper has no outer attempt-ID/PID field. Attribute output using the pre-run direct-child inventory, launch/exit interval, exact script/source/option pins and the completion line in this attempt's unique log. Require exactly one new attributable helper directory. If another run appears, the log cannot bind it, or timestamps/identities disagree, report `AMBIGUOUS_RECEIPT`; do not select whichever folder is newest. Hash finished artifacts and keep raw receipts unedited. An exit code of zero is insufficient.

| Observation | Recorded outcome |
|---|---|
| Startup crashes or exits without attributable helper evidence | `STARTUP_FAILED_OR_HELPER_NOT_OBSERVED`; lookup NOT_PERFORMED/UNKNOWN according to available evidence |
| Helper records registry loading before queries | `EDITOR_ENTRY_OBSERVED_LOOKUP_BLOCKED_LOADING`; no automatic retry, tick loop, wait or scan |
| Helper returns None, caps, errors or source drift | Preserve exact partial/error status; candidate coverage unproven |
| Three queries complete, identities match, automatic clean exit verified | `EDITOR_QUERY_COLLECTED_REVIEW_PENDING`; candidate review follows separately |
| Timeout/resource stop, forced exit or ambiguous cleanup | `ABORTED` plus exact cleanup status; no successful-run promotion |

Full-editor startup may load the default level and dependencies, run installed startup code, compile shaders, update user/editor configuration, generate API stubs and write DDC/cache/log data. It therefore exceeds the helper's three-query metadata-only scope even though no helper asset load/save/compile/cook is requested. Do not silently label the entire process metadata-only.

After exit, compare listed configuration and asset hashes. Restore an exact changed generated-config file only from its verified baseline when no later user edits occurred and the restoration is specifically justified; record that action. Otherwise preserve the difference for review. Do not restore/delete shared caches, logs, project trees, user files or saves as a blanket rollback. No installed mod or asset is added, so there is no deployment to remove. Unexpected asset writes invalidate the intended boundary and require investigation.

Package references remain source-inspection leads. This experiment cannot establish a connected component-factory caller, component creation, cooked visibility, retail compatibility, native AI control or gameplay improvement.
