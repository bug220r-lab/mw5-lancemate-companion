# MW5 project audit and next step

Audit completed October 27, 2026, America/New_York. The latest substantive local implementation receipts found are dated October 17 UTC, which was October 16 Eastern.

**The project is at the native game integration stage.** A substantial offline workbench exists, and a diagnostic has displayed a component snapshot in the retail game. A usable mission recorder and working AI companion remain unfinished. The immediate next step is to inspect the saved diagnostic controller and obtain the native contracts needed to explain stale output across missions.

## Why the status is confusing

Three status surfaces describe different historical checkpoints:

| Surface | What it currently presents | Audit finding |
| --- | --- | --- |
| Local README and NEXT_CODEX_PROMPT | September 27 pause, failed B0 compilation and no B0 package | Superseded by October package, runtime and code receipts. Do not restart that old repair sequence. |
| GitHub branch and MW5 tracker Page | September Phase A source and package gates | Connected reads still show the older source snapshot. The tracker says no diagnostic gameplay observation occurred, which conflicts with later local evidence. |
| October 17 code completion plan and receipts | Offline increment complete; native integration blocked | Best available local continuation point, supported by preserved code and runtime records. |

The local branch remains `codex/companion-foundation`, HEAD `2d078efd1554b0452c29ed261deb211209d57866`. Before this audit document, Git reported **22 modified and 187 untracked entries**. Those are status entries, not a count of every file on disk. The latest commit returned by connected GitHub was the same SHA, dated September 26 UTC / September 25 Eastern. Later local work is not represented by that commit. A current complete remote backup has not been established by this audit.

Sources: [local README](../README.md), [old next prompt](../NEXT_CODEX_PROMPT.md), [current code plan](../design/CODE_COMPLETION_PLAN_20261017.md), [GitHub checkpoint](https://github.com/bug220r-lab/mw5-lancemate-companion/commit/2d078efd1554b0452c29ed261deb211209d57866), and [MW5 tracker](https://chatgpt.com/space/page_e0956d5425248191ba1b83269deee4aa), all read during this audit. Shared summaries were preserved.

## What is actually established

| Area | Evidence and practical meaning |
| --- | --- |
| Offline foundation | **OBSERVED in preserved receipts:** observation validation, recording/replay, guarded command simulation, squad policy, speech/PTT seams and exchange preview are implemented. The selected regression passed **908/908 tests across 48 files**. This audit rehashed all 31 files in the final increment and its test log; every hash matched. Tests were not rerun, and this was not the full suite. |
| In-game diagnostic | **OBSERVED historically through recorded screenshot inspection:** first F8 showed the static marker; second showed a B0 snapshot with 3 components checked, 0 invalid entries, completed scan and 0 probe matches; third left the output unchanged. This proves bounded displayed output, not a continuous recording or global absence of the probe. |
| Mission transitions | **UNKNOWN/BLOCKED:** a screenshot from a user-reported new Instant Action mission retained the previous captured identity and counts. The cause is unresolved. This does not establish that EndPlay failed, that the controller persisted, or what happened at the menu. |
| Passive recorder and native commands | **NOT COMPLETED:** the field map still declares the collector unimplemented and runtime unverified. The command module rejects LIVE mode and reports `nativeAdapter: NOT_BUILT`. No accepted native AI order or observed command-driven behavior is established. |
| Product releases | **NOT COMPLETED:** Tactical Companion and Direct Pilot still require native acquisition, command/ownership evidence, observed acceptance and release packaging. Offline tests cannot supply those results. |

Sources: [code result](evidence/code-completion-20261017-01/RESULT.json), [regression receipt](evidence/code-completion-20261017-01/combined-regression.RESULT.json), [F8 runtime record](evidence/b0-runtime-resume-20261004-01/CLEAN_MANUAL_SEQUENCE_THROUGH_THIRD_F8_20261005.json), [transition finding](evidence/b0-transition-diagnostic-20261005-01/TRANSITION_DIAGNOSTIC_REVIEW.md), [field map](../design/PASSIVE_CAPTURE_FIELD_MAP.json), and [control implementation](../companion/control.mjs).

## The next bounded work session

**PROPOSED: complete the saved controller inspection and native template capture.** Its deliverable is a trustworthy baseline and enough actual Blueprint information to prepare the transition diagnostic.

1. Establish one editor owner and refresh project/build, mod configuration, controller identity and unsaved state. Obtain a successful supported visual capture. Earlier native capture failed with `FrameArrived timed out: timed out waiting on channel`; current capture capability was not tested in this audit. Stop on failure and retain the existing manual handoff instead of repeating the failed route or substituting legacy input.
2. Preserve the user's saved controller. Compare its complete supported source and defaults against the protected historical baseline. An EventGraph clipboard alone is insufficient. The current bytes match the October 17 manual-save record, but semantic equivalence remains unverified. Do not restore the older controller merely to match an old hash.
3. Follow [MINIMUM_CAPTURE.md](evidence/b0-template-recovery-20261017-01/MINIMUM_CAPTURE.md): inspect current input bindings and obtain actual begin/end additive Bind and listener-specific Unbind contracts, the matching callback, Victory writer, New GUID and GUID-to-string. Preserve before/after evidence and any human work. Keep temporary inspection execution disconnected; this capture step does not compile, save or run it.
4. After review, prepare the smallest reversible transition diagnostic. It must distinguish controller/widget identities, arm once after display, retain a bounded receipt across teardown and preserve stock subscribers and the single parent EndPlay call. Compile, save/reload, packaging and a disposable Instant Action transition are subsequent evidence gates. A replacement retail installation still needs its concrete deployment authorization.

**Success for the immediate inspection:** current saved source/default comparison and all required native contracts are available and reviewed, or a precise missing operation is recorded. **Success for the following diagnostic:** durable observed evidence explains the stale display across a mission transition. Neither milestone requires adding companion features.

Then proceed through passive recording and export, one designated AI's validated native command, Tactical Companion, and finally Direct Pilot, following the [delivery contract](../design/FULL_MOD_DELIVERY.md). Review and privately back up the outstanding local work before further native mutation. Reconcile the README, next prompt and tracker from this evidence through the designated documentation owner.

## Current audit checks and limits

- **OBSERVED:** saved controller is 926,510 bytes, SHA-256 `ce3a7978fbd522fb1b625e22c8a1589c3d6821779e89f6643b4a65c232dedff6`; it matches the later plan's manual-save record. The older `86237f...` controller is a historical baseline.
- **OBSERVED:** no matching Unreal editor or MW5 shipping process was returned by the process check. C: had approximately 27.49 GiB free. The old 3.6 GiB space warning is stale; this observation alone is not a packaging resource preflight.
- **NOT_PERFORMED:** fresh native capture, graph/default comparison, test rerun, current gameplay reproduction, package rebuild, installed-mod verification, DLC entitlement review and full game/editor build admission. Historical capture failures are not claimed as current tool failures.
- Only this audit document and its [check receipt](evidence/project-audit-20261027-01/CHECKS.json) were created. Code, source assets, game/editor state, shared status documents, the tracker and GitHub were unchanged.

The audit covers the local project and targeted continuation evidence, the known native-capture chat, the observer handoff, connected GitHub and the MW5 tracker. The large foundation chat could not be returned by the chat reader; its local result and preservation receipts were available and inspected.
