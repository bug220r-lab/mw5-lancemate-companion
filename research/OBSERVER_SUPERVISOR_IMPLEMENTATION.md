# Observer supervisor implementation

**2026-09-22. Project-local implementation and synthetic validation only. Native editor/game/lookup execution: NOT_PERFORMED.** The reference helper remains unchanged. This continuation implements the [normal-editor experiment](../design/OBSERVER_NORMAL_EDITOR_EXPERIMENT.md)'s process/evidence machinery while keeping unsupported native checks closed.

## Validation checkpoint

**IMPLEMENTED; SYNTHETIC REVIEW FAILED; NATIVE BLOCKED.** The final independent [review](OBSERVER_SUPERVISOR_REVIEW.md) and [130-case receipt](OBSERVER_SUPERVISOR_REVIEW.json) record **129 passed, 1 failed**, with source hashes stable during the run under standalone Python 3.7.7. The categories are 71 core/policy checks, 48 checks of the actual evidence parser with synthetic files, 2 Windows-backend race checks with mocked API observations, and 9 actual Windows fixture modes. The first 121 checks and eight process modes passed. Actual process tests used explicitly mocked healthy resource samples; they do not show that the real RAM admission gate passed.

`windows_child_hold` hit its deliberately shortened deadline, requested its cooperative STOP, then reported `CLEANUP_UNKNOWN` / `OWNERSHIP_UNVERIFIED`. It was the final process mode. No further fixture launches occurred. The original receipt, timeline and supervisor lock are preserved. The core retained the generic ownership failure but not the underlying adapter error code; the precise transient cause remains **UNKNOWN**, not an established diagnosis. Earlier passing runs and author smoke checks do not supersede this failed final run.

At **2026-09-22T22:38:27Z**, a [separate read-only assessment](evidence/editor-source/observer-supervisor-review-20260922T223407Z-0708f1688e/windows-child-hold-readonly-assessment.json) found all four recorded fixture PIDs absent in a successful bounded process snapshot; exact query-only calls also returned Win32 87. No process was terminated. This establishes present absence of the recorded processes, not the original shutdown timing, complete job membership or failure cause. The original `CLEANUP_UNKNOWN` and lock are not rewritten as success.

The [read-only native preflight](OBSERVER_SUPERVISOR_PREFLIGHT_2026-09-22.json), at **22:28:55Z**, found all **16 pins matching**, no editor/game conflict and no reserved native attempt directory. Available RAM was **5,513,908,224 bytes (5.14 GiB)**, below the unchanged **8 GiB** admission gate. Commit/disk passed their respective thresholds. This is an expired snapshot for future admission, not launch permission or a completed startup audit.

The next bounded work is to retain sanitized backend diagnostic codes and review the exit/membership races using offline fixtures before considering a separately reviewed focused process retry. Do not repeat the native helper, launch the editor or lower a gate. The [machine checkpoint](OBSERVER_SUPERVISOR_STATUS.json) binds this outcome to the source and review hashes.

## Components and entry point

- [observer_supervisor.py](../scripts/observer_supervisor.py): exact policy parsing, resource admission, fixed command/synthetic-fixture scope, file pins, private baseline copies, exclusive attempt/lock, process monitoring, stop coordination, bounded evidence and receipt finalization.
- [observer_supervisor_windows.py](../scripts/observer_supervisor_windows.py): Windows resource/process inspection, hidden suspended creation of an allowlisted synthetic process, assignment to a private job before resumption, retained process identities and child lineage, and explicit owned-process cleanup. No kill-on-job-close or process-name termination sweep.
- [observer_supervisor_evidence.py](../scripts/observer_supervisor_evidence.py): bounded stable reads, reparse rejection, strict JSON/schema checks and exact new-directory/process-log attribution. It returns evidence paths/hashes and outcomes without returning raw log text, reference names or helper error strings.
- [observer-supervisor-child.py](../scripts/fixtures/observer-supervisor-child.py): project-authored synthetic child with completion, loading/partial, crash, flooding, cooperative stop, ignored stop and descendant modes. It never imports Unreal or executes the native helper.
- [Review-ObserverSupervisor.py](../scripts/Review-ObserverSupervisor.py): independent adversarial review and real Windows synthetic-process exercises. The final [review receipt](OBSERVER_SUPERVISOR_REVIEW.json) binds results to exact files; pending or earlier receipts must not be presented as current validation.

The production CLI deliberately offers **read-only preflight only**:

```powershell
& 'C:\Program Files\Epic Games\MechWarrior5Editor\Engine\Binaries\ThirdParty\Python3\Win64\python.exe' -B .\scripts\observer_supervisor.py --preflight
```

This runs the standalone Python interpreter, not the editor. It verifies the prepared manifest/pins, reads named process/resource state and reports launch disabled. It does not create the reserved native attempt directory, copy user configuration, execute the helper or open the game/editor. There is no native `--run` switch.

## Enforced scope

Production admission remains **8 GiB available RAM / 8 GiB available commit / 12 GiB free disk**, with two passing samples separated by at least one second and a fresh sample at launch. Running floors remain **2 / 2 / 10 GiB**. The whole-process deadline is **300 seconds**, maximum normal-close grace **30 seconds**, observation target **250 ms**, and maximum valid sample age **2 seconds**. Synthetic tests may tighten time/output quotas only; they cannot lower production resource floors or silently change the native manifest policy.

The helper ceiling remains **1,081,344 JSON bytes**; owned logs **64 MiB**, outer metadata **4 MiB** including a **1 MiB** timeline, and copied baseline configuration **4 MiB**. Raw oversized evidence is retained, not deleted or read without a bound. Publication eligibility is separate from local collection; engine logs/configuration require content review.

Process exit, cleanup, helper evidence and research acceptance are separate fields. A valid loading/partial receipt stays partial; zero exit without a valid attributable report does not pass. Forced termination stays aborted even if a completed helper receipt exists. Identity uncertainty prevents termination and leaves `CLEANUP_UNKNOWN`; handle closure itself never implies termination. An uncertain helper lock remains evidence. No configuration/cache/save restore or deletion is automatic.

After verified cleanup, a retained fresh resource sample can establish only that the running floors are met. It does not establish full recovery to the admission baseline or attribute all resource changes to the child process. A failed check remains `RECOVERY_NOT_VERIFIED`; a check without eligible verified cleanup remains `NOT_VERIFIED`. An aborted run may retain valid partial helper attribution while its process status remains aborted; growing evidence is not attributed after uncertain cleanup.

`outer_receipt_complete` reports successful writing of the outer receipt and index only. It can coexist with an aborted run or `CLEANUP_UNKNOWN`. The index covers the outer logs/metadata and named baseline copies; attributed helper-file hashes are separately listed under `process-result.json`'s `output.files`. No field promotes receipt finalization to complete native evidence or research acceptance.

## Native prerequisites still missing

**Supported desktop guard:** `UnavailableDesktopGuard` and the Windows backend's UI methods report unavailable/unsupported. They cannot observe native prompts, establish the reserved session's no-human-editing condition or request supported normal editor close. The production supervisor and Windows launch backend reject editor/game launch independently. Synthetic STOP-file cooperation tests only the project fixture protocol; it does not validate native window close or prompt detection. The coordinating task reports that browser simulation works but native editor-window capture remains unavailable. Browser evidence does not resolve native prompt observation. No alternative desktop automation path was built.

**Bounded OS-call monitoring:** Windows identity/resource/file calls are synchronous. The supervisor checks duration/freshness and stops on returned stale or overrun observations, but cannot safely interrupt an individual Win32 call that never returns. A separate watchdog/cancellation arrangement would be an additional engineering measure before claiming a hard stop during such a stall; it is not an explicit requirement in the existing manifest and was not built this turn. The plan's polling thresholds remain cooperative, not hard allocation/write caps.

**Fresh native preflight:** current resource values expire immediately as future admission evidence. Recheck pinned installation/project/helper/configuration, startup Python/plugin paths, exact process/lock absence, generated configuration baseline and benchmark-owner coordination before any later native attempt. The earlier source audit and an unchanged helper do not establish that new startup hooks or prompts cannot appear.

**Actual MW5 entry and exit:** the UE4.26.2 fork's `-ExecutePythonScript` entry, registry readiness, resource peak and automatic exit remain untested. A synthetic Windows process proves only the tested supervisor/backend behavior. It does not resolve the factory caller, cooked registration or observer startup.

**Native helper stop and startup baseline:** the native helper's attributed output-directory STOP signal is not implemented; the synthetic guard signals only its fixture's attempt directory. Refreshing the startup-script/plugin/configuration scope and recording absent baseline files remain procedural requirements before a future native run. Pin matching for the currently existing three configuration files is narrower than that audit. The guard interface's booleans exercise decisions; they are not retained native desktop observations or proof of human inactivity.

The coordinating task owns broader companion work, Git and backup. This implementation does not change those files or promote M0/native acceptance. Review the final receipt and current handoff before continuing.

## Desktop requirement provenance

The following requirements already appear in the [experiment manifest](OBSERVER_NORMAL_EDITOR_EXPERIMENT.json) and [experiment design](../design/OBSERVER_NORMAL_EDITOR_EXPERIMENT.md). They are distinct from implementation choices made in this continuation.

| Existing requirement and exact location | Implemented boundary and remaining limitation |
|---|---|
| Manifest `stops.unexpected_prompt`: **"Stop without accepting, saving or discarding"**. Design **Admission and baseline**, item 5: **"If a restore/conversion/save/login or other unexpected prompt appears, stop the experiment without accepting it."** | The guard must supply a safe-state result; no real native observer supplies it. Prompt detection remains NOT_IMPLEMENTED/NOT_TESTED. A successful browser simulation is not this check. |
| Manifest `process_ownership.forced_termination`: **"Only exact still-owned process/verified descendants when no-human-editing condition holds; record ABORTED"**. `identity_or_human_work_uncertain`: **"No broad termination; record CLEANUP_UNKNOWN"**. Design **Admission and baseline**, item 5 requires a reserved fresh process with no concurrent human editing. | The core requires explicit `no_human_editing` before launch and cleanup. Uncertainty prevents termination. Synthetic fixtures exercise this decision only; actual human-edit detection/reservation assurance is missing. |
| Manifest `process_ownership.stop`: **"Attributed STOP marker if possible, supported normal close of owned editor, at most30s grace"**. Design **Supervision and owned-process cleanup** qualifies normal close with **"through supported window control if available"** and forbids automatic save/discard. | The core uses a guard interface. Its synthetic implementation writes only the fixture's own STOP marker. Native normal close and the attributed native helper STOP bridge are not implemented. |

**New implementation judgments:** requiring `normal_close_supported=True` at admission is a conservative precondition of this implementation; the design's wording does not itself make supported normal-close availability an unconditional admission requirement. The generic `supported`/`safe` fields, `native_capable` gates and independent backend editor/game denial are implementation mechanisms, not claimed manifest field names. A locked-desktop detector and external watchdog are not explicit requirements in the manifest and are not implemented. No new native automation work is authorized by recording these gaps. Unsupported native state remains closed under the coordinating task's explicit instruction for this turn.
