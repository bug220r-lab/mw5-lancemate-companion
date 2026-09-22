# Observer supervisor cleanup repair

**2026-09-22. Project-local supervisor repair and synthetic tests only. Editor, game and native lookup helper execution: NOT_PERFORMED.** This continuation preserves the [original 129/130 review](OBSERVER_SUPERVISOR_REVIEW.md), its immutable failed attempt and lock. The [independent source audit](OBSERVER_SUPERVISOR_REPAIR_AUDIT.md) separates observed evidence from possible explanations.

## Evidence and correction boundary

The original child-hold fixture intentionally let its root process exit while a descendant remained alive. Its shortened deadline triggered the fixture's cooperative STOP, after which the supervisor returned `CLEANUP_UNKNOWN`. The old core retained only `OWNERSHIP_UNVERIFIED`; it omitted the backend error. Later absence of the recorded PIDs does not establish the original cleanup sequence or diagnose that failure.

The core now preserves bounded backend error codes and Win32 values, plus sanitized PID/creation/parent/exit observations, at the monitor and cleanup failure sites. The record is capped at 16 backend errors and 32 descendants per observation. It excludes arguments, executable paths and free-form backend text. These are failed observations for diagnosis, not new ownership evidence or permission to terminate.

Source review also identified two non-atomic read sequences: a process can exit between a live identity observation and its job-membership check, or between a root identity observation and the next job PID list. The backend now rechecks the same retained handle once in those cases. It accepts only an unchanged PID, creation time and executable path with confirmed exit. A still-live process outside its job, changed identity, failed API call or unknown child remains a refusal. The final empty-job check is unchanged.

This reasoning uses Microsoft's documented distinction between process-object termination signaling and [retained process handles](https://learn.microsoft.com/en-us/windows/win32/procthread/terminating-a-process), and the separate success/result fields of [IsProcessInJob](https://learn.microsoft.com/en-us/windows/win32/api/jobapi/nf-jobapi-isprocessinjob), accessed 2026-09-22. It is a justified source correction, not a retrospective diagnosis of the missing original error. The backend also refuses a [job PID list](https://learn.microsoft.com/en-us/windows/win32/api/winnt/ns-winnt-jobobject_basic_process_id_list) whose returned count differs from its required count; this strengthens completeness checking and is not claimed as the original cause.

## First targeted repair attempt

Independent mock review passed **29/29** before a real fixture launch. The coordinating task then explicitly reported its bounded model diagnostic complete, with its owned process stopped. Fresh exact-PID checks found the original four recorded PIDs absent. Real RAM/commit/disk running floors passed, and no editor/game conflict was found. The synthetic harness still injected explicitly mocked healthy resource values; real RAM remained below the native 8 GiB admission gate, which was not waived.

The [first targeted repair attempt](evidence/editor-source/observer-supervisor-review-repair-20260922T225328Z-cf09460ee8/repair-review-receipt.json) again returned `CLEANUP_UNKNOWN`. New diagnostics captured **`PROCESS_IMAGE_FAILED`, Win32 5**, during cleanup. No full validation or further process launch followed that failure. A [separate assessment](evidence/editor-source/observer-supervisor-review-repair-20260922T225328Z-cf09460ee8/windows-child-hold-readonly-assessment.json) at **22:55:24Z** found all four newly recorded PIDs absent, without termination; its failed receipt, timeline and lock remain unchanged.

This identifies the failing API step in the new attempt. It does not establish why that query was denied, and does not supply the error omitted from the original run. An unreadable live process is still not accepted through cached identity alone.

## Guarded wait after an image-query failure

The additional backend correction permits one wait of at most **50 milliseconds** on an already retained process handle after an executable-image query fails. Before that wait, its PID and creation time must match the previously established identity. Only a signaled process, followed by a fresh matching PID/creation-time read, may use the already established path. Unknown identities, changed keys, timeout and API failures continue to refuse. No new process handle is opened, and the failed image query is not retried.

This uses the process-handle signal and finite timeout behavior documented for [WaitForSingleObject](https://learn.microsoft.com/en-us/windows/win32/api/synchapi/nf-synchapi-waitforsingleobject), and preserves the error boundary of [QueryFullProcessImageNameW](https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-queryfullprocessimagenamew), accessed 2026-09-22. The 50 ms bound is an implementation choice per identity. Several waits can accumulate in one observation; the existing 250 ms aggregate-overrun rejection remains unchanged. OS scheduling, system sleep and a stalled synchronous call are not hard real-time guarantees. This wait does not grant permission to trust an unreadable live path.

## Validation status

**PASS_REPAIR_SYNTHETIC_ONLY: 171/171 independent checks passed on stable source hashes under Python 3.7.7.** The [independent repair review](OBSERVER_SUPERVISOR_REPAIR_REVIEW.md), [full receipt](OBSERVER_SUPERVISOR_REPAIR_REVIEW.json) and [frozen checkpoint](OBSERVER_SUPERVISOR_REPAIR_STATUS.json) contain the exact identities and limitations.

The final source revision first passed **41/41 repair mocks**, including 12 direct tests of the actual Windows API identity wrapper with simulated kernel responses. A new [targeted child-hold run](evidence/editor-source/observer-supervisor-review-repair-20260922T230017Z-4e8b48bac1/repair-review-receipt.json) then passed with `VERIFIED_NORMAL_STOP`, after fresh absence checks of all eight PIDs recorded across both failed runs and fresh actual resource/conflict checks. Only after that pass did the [full independent review](evidence/editor-source/observer-supervisor-review-repair-20260922T230058Z-5d94758e09/repair-review-receipt.json) run.

| Independent category | Passed/total | Evidence boundary |
|---|---:|---|
| Core, policy and native refusal | 71/71 | Simulated processes/resources/clock and injected attribution boundary |
| Actual evidence validator | 48/48 | Synthetic files parsed and hashed by the actual module |
| Existing late-child regressions | 2/2 | Actual adapter logic with simulated Windows snapshots |
| Added repair regressions | 41/41 | 16 retained-handle races, 4 job-list completeness checks, 9 bounded diagnostic checks, 12 direct API-wrapper cases |
| Windows fixture modes | 9/9 | Real project-authored processes; healthy supervisor resource readings explicitly mocked |

All nine real fixture modes verified cleanup. The descendant fixture's expected process status remains `ABORTED` because it deliberately reaches a short deadline; the passing assertion is verified cooperative cleanup, not successful lookup execution. Neither the real-resource snapshot nor the synthetic resource injection establishes native admission. Immediately before full validation, actual RAM was **5,507,551,232 bytes (5.13 GiB)**, below the unchanged **8 GiB** native gate; actual running floors passed and no editor/game conflict was found.

Both failed receipts, their raw timelines and their locks remain byte-for-byte preserved. The new pass establishes behavior on the tested revised implementation; it does not retroactively turn either earlier cleanup into success or reveal the error omitted from the original run. No further tests or process launches are needed for this frozen checkpoint.

The editor/game launch prohibitions and unsupported native desktop guard remain in force. Prompt/human-edit observation, native normal close, the attributed native helper STOP bridge, startup/configuration/lock/baseline refresh and real native resource admission remain separate outstanding requirements. No resource, ownership, lineage or human-work gate is relaxed, and no alternate desktop-control path is built.
