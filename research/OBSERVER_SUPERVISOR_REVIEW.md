# Independent observer supervisor review

Reviewed 2026-09-22 under the installed standalone Python 3.7.7 interpreter. **SYNTHETIC ONLY; native editor/game launch and existing helper execution NOT_PERFORMED.**

The current full run is **129/130 checks passed, one cleanup verification failure**. This is not an overall acceptance. The immutable [run receipt](evidence/editor-source/observer-supervisor-review-20260922T223407Z-0708f1688e/review-receipt.json) and [latest summary](OBSERVER_SUPERVISOR_REVIEW.json) retain the result. Source pins were unchanged throughout this run. Earlier passing runs predate subsequent safety fixes and do not establish acceptance of the current files.

| Category | Passed/total | Evidence boundary |
| --- | ---: | --- |
| Core, policy and native refusal | 71/71 | Fake processes, resource samples and clock; explicit injected attribution boundary |
| Actual evidence validator | 48/48 | Real parsing and file hashing of separately authored synthetic files |
| Adapter late-child regressions | 2/2 | Actual adapter logic with mocked Windows API snapshots; no native calls |
| Windows fixture modes | 8/9 | Real project-authored Python processes; healthy resources explicitly mocked |

## Current failed case

`windows_child_hold` reached the tightened synthetic deadline, requested its fixture's cooperative STOP, then failed closed with `CLEANUP: OWNERSHIP_UNVERIFIED`. Its recorded root was PID 27016, creation FILETIME `134345900723970967`, standalone Python executable. The last saved timeline also records descendants 29736, 13044 and 29372 with creation times, executable paths and parent IDs. The supervisor preserved its lock, returned `CLEANUP_UNKNOWN`, and did not attribute possibly live helper output. Further OS launches stopped immediately.

The raw evidence is retained in [the failed attempt](evidence/editor-source/observer-supervisor-review-20260922T223407Z-0708f1688e/case-109-windows-child_hold/attempt/process-result.json). No process-name cleanup or inferred cleanup was performed. A [separate read-only assessment](evidence/editor-source/observer-supervisor-review-20260922T223407Z-0708f1688e/windows-child-hold-readonly-assessment.json) at **2026-09-22T22:38:27.077281+00:00** found all four recorded PIDs absent in a successful bounded Toolhelp snapshot; exact query-only OpenProcess checks also returned Win32 87 for each PID. The original process-result, timeline and lock hashes remained unchanged. No processes were launched or terminated during that assessment.

This later absence corroborates the state of the recorded PIDs only. It does not prove completeness of the original owned job or retroactively turn the original cleanup receipt into a pass. The core's generic ownership exception did not preserve the adapter's bounded error code, limiting diagnosis of this attempt. The exact original cause remains **UNKNOWN**; job-membership timing and process-exit timing are hypotheses only.

**Checkpoint:** sources and tests are frozen, overall result remains **129/130, FAILED**, and no further fixture launch was performed. Bounded next work is preservation of adapter diagnostic codes in the core receipt plus offline review of the observed exit/membership races. Any focused synthetic retry must be separately reviewed after that work; it is **NOT_PERFORMED** at this checkpoint.

## What the passing checks establish

The production gates remain 8/8/12 GiB RAM/commit/disk admission and 2/2/10 GiB running floors, with 250 ms observation interval, two-second sample age, 300-second deadline and at most 30 seconds of graceful cleanup. Static assertions retain 1 MiB timeline, 4 MiB outer metadata, 64 MiB logs, 4 MiB baseline copies, and 1,081,344 bytes of helper JSON. Synthetic limits only tighten permitted time/quota fields; resource thresholds are never relaxed. Stale, future, repeated, malformed and missing samples fail closed.

Tests cover source/config pin drift, existing-process conflicts, unavailable or unsafe desktop guard, human editing, invalid process identity, PID reuse, unknown child lineage, flood/size limits, output ambiguity, helper quota, monitor overrun, source drift, launch failure with a retained owned handle, handle-close failure, and preservation of foreign locks. The unsupported native desktop guard refuses before process launch and before creating the reserved attempt. Real Windows tests cover success, cooperative stop, ignored stop, crash, log flood, ambiguous output, registry loading, missing final report and a surviving descendant. The first eight passed; the descendant case remains failed as above.

The actual evidence-validator checks exercise complete output, explicit partial/loading/null/cap/error results, malformed or duplicate JSON, nonfinite/oversized numbers, wrong helper/source/options/query/checkpoint identities, missing/duplicate/wrong completion messages, false native claims, unexpected files/directories, file caps, multiple/new-directory attribution and creation-time boundaries. Reparse rejection uses simulated Windows reparse metadata; actual symlink/junction creation was **NOT_PERFORMED**. The tests do not execute or import the existing lookup helper.

The latest core fixes require both a successful termination disposition and `all_exited=True` before cleanup promotion, cap each graceful sleep to remaining grace, separately record a fresh running-floor recheck, and preserve partial/aborted attribution without success promotion. The checks confirm missing resource recovery is reported independently of process exit. Saved outer receipts match returned results; baseline copies are included in the outer artifact index. `outer_receipt_complete` does not imply complete helper or native evidence.

## Reviewed source identities

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `scripts/observer_supervisor.py` | 32036 | `092f79309da6d751bfe2e11d1dee0d8acf3d917a37dc93faa03fbda822358094` |
| `scripts/observer_supervisor_evidence.py` | 24272 | `4b751a16c96c4783c78e22ca1ea5474198e8675eb08c4a338d447cae5ec30934` |
| `scripts/observer_supervisor_windows.py` | 35176 | `77a9e344a6a08576f63e77977ecd970c85609176f97eacaafb8123ad1060f726` |
| `scripts/fixtures/observer-supervisor-child.py` | 4898 | `944ab677c8792bd9c2588ed14cad1100ee151eb77d92926336656a42376bc616` |

Review script SHA-256: `b1c9010711aae82908cd46e662e86e736e02f53c04f82a26a9ba69a9e5fd934c`. Receipt SHA-256: `ed01c9aab74ac1efc7f477d45534a8761b096fa5cc97ed4da4f3515f03c23159`.

## Limits and native disposition

Mock resource headroom cannot satisfy the real RAM admission gate. Synthetic STOP is a fixture protocol, not an editor normal-close or helper-STOP bridge. No supported native desktop observation, prompt handling, human-interaction detection or normal-close integration has been implemented or tested here. The adapter deliberately rejects editor/game executable names. Therefore this review does not authorize or establish native execution, registry readiness, package-reference results, startup safety, autosave prevention, functional observer startup, cooking or game behavior.

Polling detects elapsed overruns after calls return; it cannot guarantee a hard real-time deadline if the host or an OS call stalls. Reparse checks and pin comparisons are bounded point-in-time checks, not an adversarial filesystem sandbox. Exact experiment requirements and additional implementation judgments are documented by the coordinating task; this independent receipt adds no new user approval boundary.
