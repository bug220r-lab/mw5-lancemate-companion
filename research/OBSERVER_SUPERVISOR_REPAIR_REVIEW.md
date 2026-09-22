# Independent supervisor repair review

Reviewed **2026-09-22**, using the installed standalone **Python 3.7.7** interpreter. Current result: **PASS_REPAIR_SYNTHETIC_ONLY, 171/171**. Editor/game launch and existing helper execution remain **NOT_PERFORMED**.

The [full repair receipt](evidence/editor-source/observer-supervisor-review-repair-20260922T230058Z-5d94758e09/repair-review-receipt.json) and [latest separate repair summary](OBSERVER_SUPERVISOR_REPAIR_REVIEW.json) have identical SHA-256 `86cd04afcd9047fcb4514c23af5f78295ea8959f6baa983ee559feea709c7eb1`. Every reviewed source and every pinned historical failure artifact was unchanged during the full run. The historical review script was imported only for its test functions; its old main and canonical receipt writer were not called.

| Check group | Passed/total | Evidence boundary |
| --- | ---: | --- |
| Existing core, fixed policy and native refusal checks | 71/71 | Fake process/backend/resource/clock, explicit mock attribution |
| Actual evidence validator | 48/48 | Real parser and hashes, synthetic files only |
| Retained-handle and late-child race checks | 18/18 | Actual adapter logic, mocked Windows observations |
| Job inventory completeness | 4/4 | Actual ctypes-wrapper logic, mocked kernel32 response |
| Process image/exit identity branch | 12/12 | Actual ctypes-wrapper logic, mocked kernel32 calls |
| Bounded failure diagnostics | 9/9 | Actual core sanitization and persistence, fake process lifecycle |
| Real Windows fixture modes | 9/9 | Real project-authored Python processes, explicitly MOCK_ONLY healthy resources |

All nine real Windows cases verified cleanup. Normal success, crash, ambiguous output, loading and partial output verified the owned job exited. Cooperative stop and the surviving-descendant case verified normal stop. Ignored stop and output flood verified forced stop through retained identities. Fault cases remained aborted; loading/partial evidence stayed partial. No native evidence was promoted from these results.

## Retained failures and the controlled repair sequence

The [original review](OBSERVER_SUPERVISOR_REVIEW.md) remains **129/130, FAILED**. Its descendant test had unknown cleanup; its original reason cannot be recovered. The failure receipt, timeline and lock remain unchanged. A later [read-only assessment](evidence/editor-source/observer-supervisor-review-20260922T223407Z-0708f1688e/windows-child-hold-readonly-assessment.json) found the four recorded PIDs absent. That later absence did not establish original job completeness or change the failed result.

The first repair added narrow same-handle exit revalidation and retained bounded diagnostic codes. After 29/29 mock checks, the [first targeted retry](evidence/editor-source/observer-supervisor-review-repair-20260922T225328Z-cf09460ee8/repair-review-receipt.json) again returned `CLEANUP_UNKNOWN`. This time its cleanup diagnostic recorded **`PROCESS_IMAGE_FAILED`, Win32 5**. The supervisor preserved the lock and stopped further launches. The [separate assessment](evidence/editor-source/observer-supervisor-review-repair-20260922T225328Z-cf09460ee8/windows-child-hold-readonly-assessment.json), timestamped `2026-09-22T22:55:24.449557+00:00`, found that attempt's four recorded PIDs absent; it did not revise the failure.

The next correction added a bounded confirmed-exit path for an already retained handle. The [41/41 mock proof](evidence/editor-source/observer-supervisor-review-repair-20260922T225925Z-8d54a822a4/repair-review-receipt.json) includes direct tests of the actual ctypes identity wrapper. Following explicit coordinating-task release, the [second targeted descendant run](evidence/editor-source/observer-supervisor-review-repair-20260922T230017Z-4e8b48bac1/repair-review-receipt.json) passed **1/1**, with **`VERIFIED_NORMAL_STOP`**. Its precheck freshly queried all eight recorded PIDs from both failed runs, found them absent, and checked actual resource floors and editor/game conflicts. Its source pins were then required to match the full-validation run exactly.

The second target and full run establish tested behavior on the new code. They do not prove the exact transient timing behind either earlier failure. Both failed attempts, both assessment receipts and both preserved locks remain immutable historical evidence.

## Reviewed corrections and preserved boundaries

The Windows adapter's `identity` method now checks the retained expected PID/creation time before an additional wait after an image-query failure. It waits on the **same retained handle**, at most once and at most **50 ms per identity** when the initial observation was alive. It accepts the previously recorded executable path only after the handle signals exit and a fresh PID/creation-time read still matches. Missing/mismatched expected identity, a process that remains alive, wait errors, refreshed identity drift and API failures all refuse. There is no image-query retry, handle reopening, or retained-path fallback for a live process. The direct mocks assert these branches and preservation of the original image failure code on timeout/wait failure.

Separately, a valid false membership response or a live-root absence from the job list permits one re-read of that same retained identity; only unchanged confirmed exit can explain the transition. Still-live or changed identities continue to fail. The job list must be complete (`count == assigned`). Unknown children and final nonempty-job checks remain latched failures; a later empty snapshot cannot erase them. There is no job-wide or process-name termination sweep.

Core diagnostics now preserve at most two ownership-failure observations, identifying monitor or cleanup phase. Each observation retains only bounded machine codes/Win32 numbers and sanitized identity facts: at most 16 backend errors and 32 descendants. Tests reject or sanitize malformed fields and prove no raw argv, executable path or arbitrary error text enters this diagnostic object. Failed ownership still prevents forced termination and possibly live output attribution, and preserves the supervisor lock. Saved receipts match returned results.

Relevant current source locations: `scripts/observer_supervisor.py:230` (bounded diagnostics), `:470` and `:520` (phase retention); `scripts/observer_supervisor_windows.py:223` and `:234` (retained process key/image handling), `:291` (complete job list), `:312` and `:320` (retained-identity verification), and `:356` (live root absent from job refusal).

## Actual resources versus mocked test resources

The [fresh read-only preflight before full validation](evidence/editor-source/observer-supervisor-review-repair-20260922T230017Z-4e8b48bac1/full-validation-readonly-preflight.json) observed:

| Resource | Actual available bytes | Native admission | Running floor |
| --- | ---: | --- | --- |
| RAM | 5,507,551,232 | **FAIL**, requires 8 GiB | PASS, requires 2 GiB |
| Commit | 9,274,912,768 | PASS, requires 8 GiB | PASS, requires 2 GiB |
| Disk | 26,967,695,360 | PASS, requires 12 GiB | PASS, requires 10 GiB |

There were no editor/game conflicts. These are timestamped point-in-time readings, not guaranteed current headroom. The actual synthetic supervisor tests inject healthy resource samples expressly as **MOCK_ONLY**, so their process tests can exercise ownership and cleanup without waiving native admission. The production 8/8/12 GiB admission, 2/2/10 GiB floors, 250 ms interval, two-second sample age, 300-second deadline and 30-second maximum grace remain unchanged. The whole-run resource tests and post-cleanup samples inside the synthetic harness remain mocked.

## Final source identities

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `scripts/observer_supervisor.py` | 35254 | `b260ee2d2b952bf716807f2923605f4c3644c434791313b0b1aeadd21559d960` |
| `scripts/observer_supervisor_evidence.py` | 24272 | `4b751a16c96c4783c78e22ca1ea5474198e8675eb08c4a338d447cae5ec30934` |
| `scripts/observer_supervisor_windows.py` | 37407 | `d80abfe0cfe6fe80d010547101d5f8e41e3fb9baa7b6436ed55767242104c402` |
| `scripts/fixtures/observer-supervisor-child.py` | 4898 | `944ab677c8792bd9c2588ed14cad1100ee151eb77d92926336656a42376bc616` |
| `scripts/Review-ObserverSupervisor.py` | 41802 | `b1c9010711aae82908cd46e662e86e736e02f53c04f82a26a9ba69a9e5fd934c` |
| `scripts/Review-ObserverSupervisorRepair.py` | 31867 | `3530283a3d7a5d4411e7502de5b4910113957d53c20fba7a1bc5fe34427223e3` |

The existing `Inspect-ObserverReferences.py` hash was rechecked unchanged at `20c460fdf678de74568c477b28c41a65408a5b5c7868bc1bb893d05ceced099b`; it was not run. The passing targeted receipt hash is `84e6ad22a86e5d35b3dd03a19cc818a3465d8d345223fb517f924f1ad2266077`; the 41-case mock receipt hash is `deae9847d2dc8f4a012f87613e102627ba897a1db2a34610ce063ce26d67a266`.

## Remaining limits

The 50 ms allowance applies per identity and can accumulate across descendants. The core still refuses an aggregate observation overrun; synchronous OS calls and scheduler stalls do not have a guaranteed hard real-time bound. This change does not relax the 250 ms policy.

Native desktop observation, prompt handling, human-interaction detection, normal editor close and the helper STOP bridge remain unimplemented/unvalidated. The adapter still refuses editor/game launches. Reparse tests use simulated metadata rather than creating actual junctions. No editor registry lookup, factory caller, observer startup/cooking, deployment or gameplay behavior is established by this repair review. The next native decision still requires its own current readiness evidence; this review adds no new user-approval requirement.
