# Observer supervisor child-hold repair audit

**2026-09-22. Independent source and preserved-evidence review only.** This audit did not run a fixture, editor, game, native helper, process probe or cleanup action. It creates only this separate document. The original review receipt and its failed/unknown outcome remain unchanged. Applicable execution recorded by that receipt: Windows synthetic child processes under Python 3.7.7, with mocked healthy resource readings; no MW5 editor or gameplay acceptance.

**Decision: the original evidence establishes an ownership-verification failure after a cooperative stop request, not its exact backend cause.** A process-exit race in the existing identity/membership checks is a source-supported hypothesis. A model can establish that such a race is possible and whether a narrow change handles it; it cannot retrospectively identify the omitted original backend error or validate a repaired real-process run.

## Evidence identity

`CASE` below means `research/evidence/editor-source/observer-supervisor-review-20260922T223407Z-0708f1688e/case-109-windows-child_hold/attempt/` beneath this project. All hashes were read during this audit. Source references in this document refer to the pinned pre-repair versions below, not to later edits at the same paths.

| Source | Bytes | SHA256 |
|---|---:|---|
| `research/OBSERVER_SUPERVISOR_REVIEW.json` | 262294 | `ED01C9AAB74AC1EFC7F477D45534A8761B096FA5CC97ED4DA4F3515F03C23159` |
| `CASE/process-result.json` | 3361 | `6B5FB4B10CD735EE500277A413088555CD15F8E83F65159B5D4B3B64D6BCAD70` |
| `CASE/timeline.jsonl` | 4626 | `5F2F84021394918DCFE2DD03DC5E1E57EEF7868570AE573454BA5F2002E73284` |
| `CASE/child-control.json` | 2415 | `12DAAE44D31FEB4A90DF78B63683BE218E07A6AD55F4BFAB1937D7D8A851FD88` |
| `CASE/STOP` | 27 | `0C17CE6B7A6A5D0C34172CBE64570AC7418D441B63AEB81C5B4EF1F0D78C3B40` |
| `scripts/observer_supervisor.py` | 32036 | `092F79309DA6D751BFE2E11D1DEE0D8ACF3D917A37DC93FAA03FBDA822358094` |
| `scripts/observer_supervisor_windows.py` | 35176 | `77A9E344A6A08576F63E77977ECD970C85609176F97EACAAFB8123AD1060F726` |
| `scripts/Review-ObserverSupervisor.py` | 41802 | `B1C9010711AAE82908CD46E662E86E736E02F53C04F82A26A9BA69A9E5FD934C` |
| `scripts/fixtures/observer-supervisor-child.py` | 4898 | `944AB677C8792BD9C2588ED14CAD1100EE151EB77D92926336656A42376BC616` |

The original review's `files_before` and `files_after` pin these same core/backend/fixture versions. Its overall outcome is `FAIL_OR_CHANGED_REVIEW`, 129 cases passed and one failed. The failure entry is `windows_child_hold`, classified `REAL_SYNTHETIC_PROCESS_WITH_MOCK_RESOURCES`. This audit does not replace that classification with a repair result.

## What the preserved record establishes

| Evidence class | Exact evidence | Supported conclusion and limit |
|---|---|---|
| OBSERVED | `CASE/timeline.jsonl:1`, elapsed 0.031 | Root Python PID 27016, creation `134345900723970967`, and conhost PID 29736 were reported alive. The retained snapshot had `ownership_verified=true` and no backend errors. |
| OBSERVED | `CASE/timeline.jsonl:2`, elapsed 1.093 | Root PID 27016 and conhost 29736 were reported exited, code 0. Python child PID 13044, creation `134345900725027026`, parent 27016, and conhost PID 29372, creation `134345900725076070`, parent 13044, were reported alive. Ownership remained verified. |
| OBSERVED | `CASE/timeline.jsonl:3`, elapsed 2.140 | The same parent-exited/descendants-alive state and verified ownership remained in the last retained timeline observation. No new helper output directory was recorded in any timeline entry. |
| OBSERVED | `CASE/process-result.json:6-9,17-18,61`; preserved STOP file | Final outcome is `ABORTED`, `CLEANUP_UNKNOWN`, with `WHOLE_PROCESS_DEADLINE`, then `CLEANUP: OWNERSHIP_UNVERIFIED`. A `SYNTHETIC_STOP_REQUESTED` result exists; the supervisor lock was preserved. No `forced_stop` field is recorded. |
| OBSERVED | Original receipt's `windows_child_hold` entry; reviewer `windows_cases`, lines 384-425 | The case uses a two-second process deadline, one-second graceful allowance and 256 KiB log cap. Resource readings were deliberately replaced with healthy mock values. The reviewer stops further OS cases after cleanup becomes unverified. These observations do not establish actual resource headroom or recovery. |
| OBSERVED source | Fixture lines 33-37 and 47-52; stdout contains `SYNTHETIC_DESCENDANT_STARTED` | `child_hold` creates a descendant, waits 0.2 seconds, then lets the parent return. The descendant is written to return when the attempt-directory STOP file exists. This explains the intended scenario; source intent and a STOP file do not prove the child consumed it or exited. |

The recorded wall interval is 1790116472.395646 to 1790116474.5526009 Unix seconds. The available record contains no failed backend snapshot, latched backend error code or Win32 error for the final ownership failure. Empty `stderr.log` adds no diagnosis. `outer_receipt_complete=true` says the outer receipt was written, not that cleanup succeeded.

## Hypotheses and unsupported conclusions

**PROPOSED, source-supported race:** backend `_verify`, lines 290-298, first obtains an identity reporting a live process, then separately calls `IsProcessInJob` through `member`, lines 251-255. If the process exits between those operations, a false membership result currently becomes `OWNED_PROCESS_LEFT_JOB`. A comparable non-atomic sequence exists between the root identity observation and the job PID snapshot at lines 316-319. These are candidate failure paths; the child-hold record does not contain either backend code. The root was already recorded exited in the last two retained samples, so the root-specific variant is not directly indicated by those samples.

**UNKNOWN:** the original error could instead arise from another identity, job, snapshot or lineage check, an API failure, or another event not retained. The generic core error at lines 227-230 collapses a backend `ownership_verified=false` snapshot into `OWNERSHIP_UNVERIFIED` without retaining its `errors` field. The original record cannot select among those possibilities.

The following claims are therefore unsupported: that the original failure was definitely harmless; that all original descendants exited; that a job snapshot was stale; that the failure involved an unknown new child; that forced termination ran; or that current PID absence would retroactively prove the exact historical exit/cleanup sequence. No editor failure, asset-registry result, gameplay behavior or native human-work safety result is established by this synthetic case.

## Gates a narrow repair must preserve

| Existing source gate | Required preservation |
|---|---|
| Backend `identity`, lines 215-249, and `_verify`, lines 290-298 | A refreshed observation must use the same retained handle and still match PID, creation time and canonical executable path. Existing image-name fallback is allowed only after confirmed exit and matching retained PID/creation identity. Do not turn a missing image, unreadable identity or a live process outside the owned job into success. |
| Backend `inspect`, lines 317-364 | Preserve bounded job membership discovery, retained handles, snapshot-derived parent lineage, the topological parent check, parent creation-time ordering and descendant count limit. PID or process name alone remains insufficient ownership evidence. |
| Backend `inspect`, lines 365-382, and `terminate_owned`, lines 393-404 | Preserve the final empty-job check even when every retained process appears exited. Unknown children and identity failures stay latched; later disappearance does not erase uncertainty. |
| Backend `terminate_owned`, lines 405-450 | Keep termination restricted to verified retained handles. A newly observed job PID outside the selected identity set remains `UNOBSERVED_CHILD_DURING_CLEANUP`; do not replace this with job-wide termination or a process-name sweep. Successful cleanup requires an empty job and verified exited retained identities. |
| Core `inspect_owned`, lines 227-258 | Preserve explicit backend ownership approval, original root identity equality, typed/unique descendant identities, owned parent relationships and unchanged previously observed descendant identity/parent fields. Retain bounded diagnostics without weakening these rejections. |
| Core `check_guard`, lines 120-125, and cleanup, lines 426-465 | Keep the explicit human-work/safe-state checks before stop or forced termination and the independent post-termination exit check. A synthetic guard's true flags do not establish native human inactivity. Unsupported native desktop capability remains closed. |
| Core finally/evidence handling, lines 468-540 | Preserve `CLEANUP_UNKNOWN`, locks and uncertainty when ownership is unresolved; do not attribute potentially growing helper output or promote an aborted result. Retained recovery samples prove only the stated running floors. |

**PROPOSED repair boundary:** at either identified live-to-exit race, one new identity observation may resolve the inconsistency only when the same retained identity is now confirmed exited. A refresh that still reports alive, changes identity, or cannot be obtained must retain refusal. This is a bounded source-level judgment, not permission to launch another real process or a claim that the original failure is diagnosed.

Bounded model diagnostics should distinguish that exact confirmed-exit case from live membership loss, changed PID/creation/path, unreadable identity, unknown/late child and unsafe human-work state. The preexisting modeled late-child checks in reviewer lines 603-633 must continue rejecting completion; a repair must not achieve a passing child-hold result by dropping those gates. Any new model result must be marked `MOCK_ONLY`, pinned to its actual source revision and kept separate from the preserved original real-synthetic failure. A later real-process rerun and native editor validation are both **NOT_PERFORMED by this audit**.

## Appended review of the repaired source

**2026-09-22, OBSERVED source only.** This section reviews the actual edits below without changing the original evidence sections or running a model, fixture, process probe, editor or helper. These are new source identities; the pre-repair identities above still describe the historical failure.

| Repaired source | Bytes | SHA256 |
|---|---:|---|
| `scripts/observer_supervisor.py` | 35254 | `B260EE2D2B952BF716807F2923605F4C3644C434791313B0B1AEADD21559D960` |
| `scripts/observer_supervisor_windows.py` | 36435 | `A5A45EBAEBD84A09740263271AB54FFD34FEC634AE95BE8D19C4BDF6D638BD58` |

**Source-review judgment: no removed gate or new material defect was found in the bounded repair and diagnostic changes.** This is not a test result, proof of native cleanup, or diagnosis of the original failure.

- Backend lines 295-313 factor retained PID/creation/executable equality into `_retained_identity`. A successful membership query returning false for an identity previously observed alive triggers one identity refresh through the same retained handle. Only that unchanged identity now reported exited avoids `OWNED_PROCESS_LEFT_JOB`. Membership API errors are not retried or converted to exit. The existing identity implementation at lines 218-252 still requires a valid wait result and restricts the post-exit image-path fallback to matching retained PID and creation time.
- Backend lines 331-339 revalidate a root missing from the job snapshot through that same verification path; a root still alive is rejected. This does not infer that a job snapshot is stale or accept a different process. New descendants still require job membership and proven parent lineage, with creation-time ordering and count bounds at lines 340-384. Incomplete job PID lists now raise `JOB_INCOMPLETE_PID_LIST` at lines 271-277 rather than allowing a partial list to prove absence.
- Final empty-job checks remain at lines 385-390 and 413-424. Latched ownership failures remain latched at lines 391-402. Termination remains limited to retained, reverified identities, and unselected late children still cause refusal at lines 425-470. No job-wide kill, process-name selection, broad cleanup or native desktop capability was introduced.
- Core lines 230-272 retain only bounded diagnostic identity facts: validated numeric PID/parent/exit fields, at most 20 decimal creation-time characters, booleans, at most 16 bounded machine-code/Win32-error records, and at most 32 descendants. Paths, arguments and arbitrary error text are not copied into this diagnostic object. Malformed fields are omitted or represented by fixed markers; truncation flags remain explicit. These diagnostic facts are labelled a failed observation, not fresh ownership proof.
- Core lines 275-306 still reject failed backend ownership and preserve the existing identity/lineage checks. The diagnostic object is attached to that rejection; monitor and cleanup exception handlers retain it at lines 467-471 and 517-521 without relaxing the decision. Those two exception paths bound the number of observations retained by one supervisor call. The human-work guard remains required before forced termination at lines 507-509, followed by the existing explicit termination-result and independent exit checks at lines 510-516. Native admission and backend editor/game launch remain blocked.

**UNKNOWN remains unchanged:** the original child-hold receipt lacks the failed backend diagnostic, so these source edits do not establish which original check failed or whether its descendants ultimately exited. Any model validation, repaired real-synthetic rerun or native acceptance must be reported separately with its own evidence and source pins.

## Appended review of the retained-image exit wait

**2026-09-22, OBSERVED source only.** Backend `scripts/observer_supervisor_windows.py`, 37407 bytes, SHA256 `D80ABFE0CFE6FE80D010547101D5F8E41E3FB9BAA7B6436ED55767242104C402`, adds the bounded wait reviewed here. Core remains 35254 bytes, SHA256 `B260EE2D2B952BF716807F2923605F4C3644C434791313B0B1AEADD21559D960`. No tests, real processes, process probes, editor or helper were run by this review. Earlier evidence sections and their source pins remain historical records.

**Source-review judgment: no new material defect or weakened ownership gate was found in this change.** Backend lines 223-269 obtain PID and creation time from the same supplied handle before the image query. If that query fails, an absent expected identity or initially mismatched PID/creation time is rejected immediately. Only a known matching identity may wait on that same handle, with a configured timeout of 50 ms when it was initially unsignaled and zero otherwise. The fallback requires `WAIT_OBJECT_0`, then newly queried matching PID and creation time, before reusing the retained executable path. The exit code query must also succeed. No image query retry, process-name search or reopening by PID was added. A still-live process, timeout, failed wait, unreadable fresh identity or identity change does not obtain the cached-path fallback.

The existing `_retained_identity` comparison at lines 312-318 still checks canonical executable identity as well as PID/creation. False live membership and a missing live root remain subject to same-handle verification at lines 320-356. Incomplete job PID lists are rejected at lines 277-295. Final empty-job checks, latched failures and exclusion of unknown/late children remain at lines 402-419 and 425-487; the wait does not authorize broader termination or erase a previously latched failure. Core human-work and native-capability decisions are unchanged.

**Timing limitation:** 50 ms is the configured wait for one eligible `identity()` call, not a budget for all identities in an inspection, the whole cleanup, or an operating-system call that fails to return. Multiple identities, repeated verification and other synchronous calls can collectively exceed the 250 ms monitoring target. Core lines 426-454 detect a returned observation overrun; they cannot interrupt the underlying calls while they are running. The wait therefore does not establish a hard 250 ms observation guarantee or a new native-readiness claim.

The coordinator's separately recorded repair tests and image-query failure diagnosis are outside this source-only assessment. In particular, neither this change nor another test result supplies the backend diagnostic missing from the **original** child-hold receipt. That original cause remains **UNKNOWN**, and its recorded `CLEANUP_UNKNOWN` outcome is not rewritten.
