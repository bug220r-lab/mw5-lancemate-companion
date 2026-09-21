# Official editor installation

Date: **2026-09-20**. User authorization: **“Install the editor.”** Latest request: **“installing now. Prep next steps.”** The official Mercenaries editor installation is approved and was started manually by the user. Retail changes, loaders, gameplay control and companion implementation remain outside this preparation.

## Current status

**INSTALLED; Epic verification succeeded.** The user reported installed, and Epic logged `ProcessSuccess: TRUE`, `ErrorCode: OK`, `FailureType: NoError`, and progress **1.0** at **18:26:42 -04:00**. The completed manifest registers **MechWarrior 5 Editor / HoopoeEditor / 1.1.390.0e**, with `bIsIncompleteInstall: false`. The [post-install checker](EDITOR_POSTINSTALL.json) returns **READY_FOR_VERSION_REVIEW**, one registration, usable metadata and no errors. The [completion receipt](EDITOR_COMPLETION.json) records launch metadata, relevant hashes and refreshed retail identity. Its declared installation size is **256,122,524,996 bytes**; this is a manifest value, not independently measured allocated space. C: has approximately **10.47 GiB free** after installation. UE4.26.2 and compatible CL14830424 match the retail receipt; game/mod compatibility and editor launch remain **NOT_PERFORMED**. No assistant deletion, uninstall or move occurred.

The successful retry followed the user's temporary-file cleanup and began at **18:10:37 -04:00** with **18.13 GiB free**. Relocation completed at **18:17:20**, verification began at **18:17:36**, and Epic recorded **9:04 min** verification time. The user did not pause. The retry logged zero additional downloaded bytes. Preserve the earlier [recovery evidence](EDITOR_RECOVERY_2026-09-20.json); no staging deletion or cache changes are needed for this verification.

The initial failure at 85% was **IS-IN-MF01-0-112**. After the user uninstalled Project Zomboid and POSTAL 2, C: had **14.28 GiB free** at **17:48:01 -04:00**. Stage relocation exhausted that space and failed at **17:56:45 -04:00** with **IS-IN-MF01-112-112**; the 17:59 check confirmed zero free bytes. The user's later Windows Storage screenshot showed **18.1 GB Temporary files**, which the user subsequently reported clearing. Exact cleanup categories were not supplied. A separate bounded metadata scan found a 112.01 GiB personal media folder; its backup status and disposability are unverified, and it was not changed. Staged logical size did not predict additional installation allocation.

Earlier local checks found `C:\Program Files\Epic Games\MechWarrior5Editor` with `.egstore` staging content, an empty Epic `InstallationList`, and no matching final `.item` manifest. [EDITOR_READINESS.json](EDITOR_READINESS.json), captured at **14:18:10 -04:00**, reports **INSTALLATION_NOT_CONFIRMED**. A separate [15:10:40 -04:00 check](EDITOR_PROGRESS_CHECK.json) returned the same status, with zero matching registrations/manifests, no expected editor executable and no inspection errors. No editor build metadata was confirmed. The checker deliberately avoids reading or hashing the assembling editor payload.

That snapshot records **219,293,528,064 free bytes** on C:. Installation allocation was already changing this number. Do not subtract the full pre-install requirement from in-progress free space or declare enough space from this snapshot: remaining allocation, peak staging demand and later cache/cook needs are unknown. The user's cleanup method is unknown; no cleanup or data move was performed by the assistant.

- Actual observed destination: `C:\Program Files\Epic Games\MechWarrior5Editor`.
- Product: official Mercenaries editor, distributed through Epic. The Steam game need not be repurchased [SOURCES F03](SOURCES.md).
- Final editor package: **1.1.390.0e**, UE4.26.2; declared installation bytes recorded above. Actual allocated footprint, future cache allowance and editor/game compatibility: **UNKNOWN**.
- Preparation completed: [read-only metadata checker](../scripts/Inspect-EditorInstall.ps1), [source-inspection worksheet](../design/EDITOR_INSPECTION.md) and [next-task handoff](../NEXT_CODEX_PROMPT.md).

## Evidence and earlier observations

| Observation | What it establishes | Limit |
|---|---|---|
| Earlier user Choose Install Location screenshot | **150.52 GB download / 238.53 GB required**; default Epic destination above | Pre-install dialog, no download/completion/version proof |
| Earlier C: check: **86,662,725,632 free bytes** | The displayed requirement did not fit at that time | Historical; superseded by the user-started download and new readings |
| Latest [user progress screenshot](evidence/editor-install-start.png) | Installing; **107.36 MB of 148.08 GB** | Size differs from the prior dialog for an unknown reason; neither is a measured installed footprint |
| [Local readiness snapshot](EDITOR_READINESS.json) | Staging exists; final registration/manifest absent at observation time | Narrow metadata check; not continuous monitoring or launcher integrity verification |
| [Later local progress check](EDITOR_PROGRESS_CHECK.json), 15:10:40 -04:00 | Completion still unconfirmed; C: free 155,934,941,184 bytes | No download percentage or ETA measured; free space alone does not reveal remaining storage demand |
| [Next-work readiness check](EDITOR_STATUS_2026-09-20_NEXT_WORK.json), 17:06:47 -04:00 | Completion still unconfirmed; zero final registrations/manifests and expected editor executable absent; no inspection errors | Named-location metadata only; no percentage, ETA, package integrity or launch result measured |

Latest image source: `C:\Users\jlewi\AppData\Local\Temp\codex-clipboard-9c09b6ba-fd25-4f9c-a744-f74c73484048.png`. Retained unmodified as `research/evidence/editor-install-start.png`, SHA256 **AA31E8BAACC998A9927DCF3134DF7FCA210F8807C71F74FCC6C4616B912E5DD1**. The prior dialog source was `C:\Users\jlewi\AppData\Local\Temp\codex-clipboard-781f577d-9523-49a5-8037-3a618ad84c7f.png`.

The earlier proposal `C:\MW5Tools\MechWarrior5Editor` was not created. Historical public 55 GB / 67.72 GB figures are not current installation requirements. Do not ask the user for the already-supplied download/required-space figures again.

## Post-install handoff

Completed on **2026-09-20**: `Inspect-EditorInstall.ps1` produced [EDITOR_POSTINSTALL.json](EDITOR_POSTINSTALL.json), preserving the in-progress snapshots. The helper read named manifests/receipts and completed engine/project/plugin metadata without launching or repairing anything. Relevant fingerprints and Epic success evidence are retained in [EDITOR_COMPLETION.json](EDITOR_COMPLETION.json).

Its statuses distinguish unconfirmed installation, installed metadata needing investigation, and metadata ready for version review. Even **READY_FOR_VERSION_REVIEW** is not compatibility or launch validation. Missing expected files require narrow discovery. Compare engine/project/release evidence and refresh the Steam identity; differing editor/game BuildIds are not by themselves incompatibility. Do not update the game automatically.

Preparation validation previously exercised the incomplete-install branch. The completed-install branch has now run successfully against the actual package, returning valid JSON and **READY_FOR_VERSION_REVIEW** with no errors. Epic's successful verification is separate evidence from this metadata check. No launch or live integration test occurred.

Then use [EDITOR_INSPECTION.md](../design/EDITOR_INSPECTION.md) for the bounded source session. Establish the actual launch target and expected cache/log writes before a subsequently authorized editor launch. The immediate investigation is single-AI selection, native Form On Me, readback/human override, one telemetry field and bundled transport. Current preparation performs no launch, Play-In-Editor, mod creation/cooking, deployment or retail orders.

## Historical automation limitation

Before the user started the download, the dedicated native computer-use tool could enumerate Epic and read accessibility text, but screenshots failed with `SetIsBorderRequired failed: No such interface supported (0x80004002)` and clicks failed because coordinate geometry was unavailable. Search-field edits timed out; a later read showed one edit had nevertheless taken effect. Keyboard focus was unreliable. No automated product selection or installation was completed. An official-store browser tab exposed an age/sign-in flow and was closed without submission.

Those failures explain the earlier manual handoff. They are not evidence that the user's current download failed. No custom UI helper, launcher credential extraction, security-setting change or third-party installer was used.
