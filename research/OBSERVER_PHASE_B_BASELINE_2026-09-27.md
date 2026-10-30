# Phase B baseline and validation handoff

**OBSERVED — Phase A bytes preserved and verified; Phase B NOT PERFORMED.** Capture completed **2026-09-27 05:30:33 UTC**. All **27 known file-hash checks passed**. Fifteen files (203,878 bytes) were preserved in a project-local backup. This task read the editor installation, retail Mods directory and existing packages; it made no editor/retail changes, launched neither application, and did not execute an editor command.

The machine-readable [baseline](evidence/phase-b-baseline-20260927T052800Z/BASELINE.json) contains exact source paths, all hashes, the complete 20-file diagnostic-plugin inventory, complete seven-file retail Mods inventory, current configuration, process observations and build metadata. The [backup manifest](evidence/phase-b-baseline-20260927T052800Z/BACKUP_MANIFEST.json) maps every preserved source to its verified local copy.

## Preserved state

| Item | Fresh verification | Preservation |
|---|---|---|
| Diagnostic authored source and descriptor | Seven files match the reviewed source, incorporating the documented author metadata and cook buildNumber changes | Exact copies in `backup/diagnostic-editor-source/` |
| Diagnostic selection marker | Empty `ActiveMod.txt` present; original probe marker absent | Marker copied separately from the seven authored files; this is saved selection, not an observed editor UI |
| Working Phase A package | All three files match the reviewed package | Exact copies in `backup/phase-a-package/` |
| Installed Phase A control | All three files match the installation receipt and preserved package | Retail files untouched; package backup provides matching restore bytes |
| Original observer editor source | All seven immutable historical source pins match | Read-only verification; these files were not recopied or modified |
| Original observer package and installed files | Three package plus three installed files match their historical pins | Exact three-file package copied to `backup/original-probe-package/`; retail untouched |
| Current retail configuration | Both probes enabled, no other entries in `modStatus` | Exact 181-byte `modlist.json` copied to `backup/configuration/retail-modlist.json` |

Backup root: `research/evidence/phase-b-baseline-20260927T052800Z/backup`.

The diagnostic's 12 derived `Intermediate/` and `Saved/` cook/cache/log files were inventoried but not duplicated. They are not authored-source restoration inputs. The complete diagnostic inventory, both package inventories and complete retail inventory matched before and after capture. The current modlist is a **both-enabled restore point**, not a stock mod-off baseline; its SHA-256 is `ae8fb9c4eaa2ad9d79a5168bb47efd5b3d6f0ed6de6cb97f760fb1dee1b68d58`. Do not replace it with the older 112-byte, one-probe-enabled preinstall receipt.

The verified diagnostic package and installed identities are:

| Relative file | Bytes | SHA-256 |
|---|---:|---|
| `mod.json` | 532 | `24ae37d564c49cf345b0edec5f6a834a5a018ccee6a99f4628c8e4b898efd5af` |
| `Paks/LanceObserverDiagnosticControl.pak` | 20,780 | `0162669d380166bc94244412fb2212d4d5145b20410f01742517f581f6bb1722` |
| `Resources/Icon128.png` | 12,352 | `ec157f56f486e5a68fd4b27df6c88fecdb1b8f9bfff18aa5ef10a21bca6a4c5e` |

Basic process enumeration returned no matching game/editor/cook processes at **05:30:30.754** and **05:30:32.966 UTC**. The earlier detailed Win32_Process query returned access denied; that failed query is not evidence of closure. These basic name-filtered observations are point-in-time checks and must be refreshed before later authoring/deployment.

Observed saved metadata: retail **1.14.390 / CL456620**, Steam build **24241637**, editor and retail target **UE 4.26.2 / CompatibleChangelist 14830424**. DLC entitlement and in-memory state were not verified. Free disk was approximately **15.70 GiB** at capture; refresh resources before any cook. The user's RAM-reserve waiver remains distinct from disk-space admission.

## What the Phase A evidence supports

The [runtime record](OBSERVER_DIAGNOSTIC_CONTROL_RUNTIME_RESULT_2026-09-27.md) and its pinned receipts document screenshot-observed static control output, including the later reported restart. This task reviewed the records and hashes; it did not independently recapture or re-review the images. Clean audio, functional F8/movement/weapons and the three menu/new-mission lifecycle checks remain **USER_REPORTED**. No separate lifecycle images or activation timing accompany those reports.

The first screenshot's saved modlist discrepancy is preserved in its annotation. The later both-enabled receipt and this current both-enabled snapshot must not be backdated to that first screenshot. Formal stock mod-off HUD/control baseline and final retail rollback remain **NOT_PERFORMED**. The original observer startup, component presence, passive recording and broad compatibility remain unresolved. The current byte match establishes preservation, not another runtime result.

## Proposed Phase B validation sequence

Use the [Phase B evidence sheet](../design/OBSERVER_PHASE_B_COMPONENT_SNAPSHOT_EVIDENCE_SHEET.md) and [reviewed diagnostic scope](OBSERVER_SHIPPING_DIAGNOSTIC_OPTIONS_2026-09-25.md). All steps below are **PROPOSED / NOT_PERFORMED** in this task.

1. **Authoring admission:** refresh process/selection/source hashes, confirm exclusive editor access, and keep the retail game closed. Work only in the diagnostic revision. Preserve the original observer, stock controller and frozen Phase A package. Record the exact changed paths; do not repair activation, invoke a factory, create components or introduce orders.
2. **Source review:** retain the independent static control, deliberate one-shot trigger and owned-widget cleanup. The snapshot must identify captured controller Self, class, level/world and locality, then enumerate existing components with raw object/class paths, validity of the selected stock base class, and exact comparison against the reviewed probe class-path string. Probe-class loading/resolution stays NOT_CHECKED; no hard probe reference is introduced. Preserve existing controller behavior and inherited cleanup. Locality alone does not prove Self is the stock helper's intended local-controller target.
3. **Bounded output proof:** review the current 32-entry, 4096 UTF-16 aggregate and 768-unit decorated-page bounds in the source contract, invalid-entry handling, exact class-path matching, match count and visible completeness status. Define the byte encoding/measurement; string character count alone does not prove a byte limit. Verify complete display fit or capture every reviewed page. The Phase A 900-by-260 box must not be assumed sufficient. Validate empty, one-match, multiple-match, invalid and truncated cases with clearly labeled offline evidence where feasible; synthetic cases are not game acceptance.
4. **Fresh package and deployment ledger:** compile/save and inspect the exact revision; use a new package folder. Review native cook outcome, warnings and full PAK membership against the new manifest. Do not overwrite either preserved package. Before any authorized replacement, refresh the current full retail inventory/configuration and exact backup, record old/new bytes and every addition/removal, and confirm the game is closed. No Phase B package or installation is prepared by this baseline alone.
5. **Disposable comparison:** record the actual named stock Instant Action scenario, player mech and lance before starting; the prior exact scenario is not established by this baseline. Record build, DLC and enabled-mod UI, audio/background configuration, normal HUD and controls with mods off. Then use the separately reviewed original-probe-plus-control configuration and restart. Keep the editor closed because concurrent editor operation was associated with the earlier audio symptom; its technical cause remains unproven.
6. **One snapshot:** when unpaused with ordinary HUD and controls working, capture the independent static control and pretrigger state, trigger the reviewed snapshot once, and retain timestamped readable output. Record all pages, header, raw identities, array/exact-match counts, selected stock base-class validity, explicit probe-class resolution NOT_CHECKED, class-scan and detail-output completeness and whether the original observer overlay is visible in this same configuration. Do not blindly retry a silent or ambiguous attempt.
7. **Interpret and clean up:** a valid exact probe-class entry establishes an instance on the captured Self at that moment only. A zero, partial, invalid or clipped list does not establish factory failure; a captured-array matching-entry count requires a complete valid class scan and readable summary. Detail-storage closure alone does not invalidate that count. A global absence or intended-owner claim remains unsupported. Record input interference/duplicates and cleanup after leaving the mission. Any possession/lifetime experiment requires separately identified before/after controller and world evidence; a single snapshot is not lifetime proof. Restore the reviewed prior state and capture the rollback receipt.

Stop on unexpected source/package/inventory drift, invalid selected stock base class, unreadable evidence, extra widget, input/audio interference, crash or unexpected behavior. Report incomplete class scans with total UNKNOWN; detail-storage closure with a complete class scan retains a qualified captured-array count. Intended-owner equality and probe-class resolution remain explicitly unverified. Preserve partial observations and label the result INCONCLUSIVE or NOT_PERFORMED as appropriate. No main campaign, saves, voice, recording, AI orders or autonomy are part of this work unit.

## Exact rollback boundary

This is a restore **plan**, not an executed rollback. Refresh configuration and detect later user edits first. Do not blindly rerun the baseline collector: its receipt files use exclusive creation, and its archived output is historical.

| Target | Restore input and action after a reviewed Phase B change |
|---|---|
| Diagnostic editor source under `C:\Program Files\Epic Games\MechWarrior5Editor\MW5Mercs\Plugins\LanceObserverDiagnosticControl` | With editor/game closed, restore only the changed authored paths from `backup/diagnostic-editor-source/` when their current bytes match the recorded Phase B revision. Remove only individually manifested new assets. Handle the saved selection marker separately and preserve any later deliberate selection. Never replace stock or original-probe source. |
| Diagnostic retail folder under `C:\Program Files (x86)\Steam\steamapps\common\MechWarrior 5 Mercenaries\MW5Mercs\Mods\LanceObserverDiagnosticControl` | With game closed, restore the three exact Phase A package files listed above if those paths were replaced by the reviewed Phase B package; remove only its separately manifested additions. This returns to preserved Phase A, not the older pre-control installation state. |
| Retail `Mods/modlist.json` | Restore the exact 181-byte backup only when restoring this both-enabled checkpoint is intended and no intervening user edits would be lost. Otherwise reconcile the difference explicitly. Do not restore unrelated settings or saves. |
| Original observer | No change planned. Rehash the seven immutable source pins and all three installed/package pins; any mismatch stops restoration for investigation. The backup package is a recovery source, not permission to overwrite unexplained edits. |
| Final verification | Rehash the complete retail Mods inventory against the seven-file baseline, all restored source/package inputs and configuration. Document any intentionally retained difference. Confirm stock HUD/controls through the separately recorded mod-off comparison and cleanup through a fresh observation; a hash-only rollback is not a gameplay check. |

## Artifact integrity and collection note

- `BASELINE.json`: 228,257 bytes; SHA-256 `190a83394692f2ebcdfae39c28738642bea1776819f02f82937f7be45b6fc906`.
- `BACKUP_MANIFEST.json`: 14,405 bytes; SHA-256 `366036b01469a0f562d26a33b4830cc2a92fb92ee668ae40500832abce693544`.
- The project-local collector initially stopped while decoding UTF-16 `game_info.xml`, after creating the backup copies. Encoding handling was corrected; the completed pass rehashed every existing copy and source without replacing them. No failed partial receipt was treated as acceptance.
- Historical receipts and shared runtime/README/NEXT files were not edited. Provenance is the pinned local package/install/source/runtime evidence and fresh filesystem/process observations, applicable to the versions above.

## September 27 scope reconciliation

At 07:56 UTC the proposed validation wording was aligned with the current no-hard-probe-reference contract and separate class-scan/detail-storage completeness. The earlier baseline collections, hashes, backups and process observations remain historical and unchanged. No new native or retail result is implied.
