# Diagnostic-control retail additions and removal manifest

## Outcome update — 2026-09-27

This document is the **historical preliminary inventory and proposed ledger**. The separately authorized [three-file installation result](evidence/diagnostic-package-20260927-01/INSTALL_RESULT.json) and [actual additions/removal manifest](evidence/diagnostic-package-20260927-01/INSTALL_MANIFEST.json) supersede its proposed package rows. The package has three verified files; all three installed diagnostic copies matched their package hashes at independent review. Later `modlist.json` enabled both `LanceObserverProbe` and `LanceObserverDiagnosticControl` and differed from the preinstall backup, reflecting subsequent game-test changes rather than the 04:52 install transaction. A game process was running during that review. Do not use the 2026-09-25 four-file inventory below as the current retail state. Refresh the seven-file inventory and current `modlist.json` after game exit before rollback; remove only the three manifest-listed diagnostic additions and preserve intervening user edits. Full rollback remains **NOT_PERFORMED**.

Prepared 2026-09-25 19:09:21 UTC from read-only inspection of the installed Steam `MW5Mercs/Mods` directory. **PRELIMINARY / NO INSTALL OR GAME TEST HAD BEEN PERFORMED AT PREPARATION.** This is a historical starting inventory for the [separate package and test preflight](OBSERVER_DIAGNOSTIC_CONTROL_PACKAGE_PREFLIGHT_2026-09-25.md), not an install-time backup or a stock mod-off gameplay baseline.

## Observed retail starting inventory

Root: `C:\Program Files (x86)\Steam\steamapps\common\MechWarrior 5 Mercenaries\MW5Mercs\Mods`. The root contained only the `LanceObserverProbe` directory and `modlist.json`; there was no `LanceObserverDiagnosticControl` directory at this inspection. Four files were found under this root:

| Relative path | Bytes | SHA-256 |
| --- | ---: | --- |
| `modlist.json` | 112 | `d483286e4913d77e1dd4332e3c560101b73b568c7833eebd2fb8f5667e5cba0b` |
| `LanceObserverProbe/mod.json` | 405 | `dce8fc883da38b6cafdfd7baf4256ecd350bf9c6c6d621861bc9393e142793a7` |
| `LanceObserverProbe/Paks/LanceObserverProbe.pak` | 19,675 | `b913e0f0a8c9f6aa53b8f25e2414f8c700e06fbab0a53bcec5884ab8ce5211d6` |
| `LanceObserverProbe/Resources/Icon128.png` | 12,352 | `ec157f56f486e5a68fd4b27df6c88fecdb1b8f9bfff18aa5ef10a21bca6a4c5e` |

The current `modlist.json` says `gameVersion: 1.14.390` and has one `modStatus` entry, `LanceObserverProbe` with `bEnabled: true`. This is the **post-enable** state from the original observer test, not a mod-off baseline. The original probe's three installed files match the previously pinned [overnight checkpoint](OBSERVER_OVERNIGHT_CHECKPOINT_2026-09-25.json). No shipping-game process appeared in the checked process names; `UE4Editor` PID 28296 was running. Process-name inspection alone does not prove all game-related processes are closed at a later deployment.

## Package-to-retail file ledger — PROPOSED / NOT_PERFORMED

At preparation, the package had not been cooked. The later actual three-file package inventory and copy ledger are in the [installation manifest](evidence/diagnostic-package-20260927-01/INSTALL_MANIFEST.json). The original proposed ledger below is retained to show the planned checks; its `NOT_PERFORMED` rows describe the September 25 state, not current install status.

| Package-relative source; bytes; SHA-256 | Exact `Mods`-relative destination | Preexisting state; bytes; SHA-256 | Exact preexisting-byte backup; backup SHA-256 | Install action; UTC; operator | Installed bytes; SHA-256 | Removal or restore action; UTC | Post-rollback state; bytes; SHA-256 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **One row for each actual packaged file — NOT_PERFORMED** | NOT_PERFORMED | NOT_PERFORMED | NOT_PERFORMED | NOT_PERFORMED | NOT_PERFORMED | NOT_PERFORMED | NOT_PERFORMED |

For an absent destination, write `ABSENT` in the preexisting and backup cells, copy only the reviewed file, and list that exact destination for removal. For a preexisting destination, preserve its bytes in a named project-local backup, verify the backup hash before replacement, and restore those exact bytes only if there is no intervening user change. A directory is removable only when every file in it was listed as an addition and no new or unrelated file has appeared. Preserve any partial install and its evidence if the ledger or rollback cannot be reconciled. The original `LanceObserverProbe` files are **not** package additions and must remain untouched; rehash their three inventory entries above before the test and after rollback. Any other retail file or setting affected by the test needs its own ledger row, byte backup and approved rollback before the change.

## `modlist.json` and configuration-state ledger — PROPOSED / NOT_PERFORMED

`Mods/modlist.json` is a separate existing file. Immediately before the first approved change, record its byte count, SHA-256, complete parsed `modStatus` list, enabled names, load order/dependencies if present, and an exact project-local byte backup with a verified hash. The 112-byte snapshot above is **not** this pretest backup. Record who or what made each selection change and the game process-closed check where applicable. Preserve a byte copy and hash at each state transition. A `modlist.json` write whose effect cannot be tied to the intended selection stops the test. These four rows are distinct evidence states, even if two happen to have identical bytes.

| State and required selection | `modlist.json` bytes; SHA-256; exact copy/backup path and copy SHA-256 | Complete parsed `modStatus`, enabled names, load order/dependencies | Change method; UTC; process-closed/restart evidence | Verification and status |
| --- | --- | --- | --- | --- |
| **0. Pretest restore point:** preserve whatever is actually present; do not substitute the historical one-probe-enabled snapshot | NOT_PERFORMED | NOT_PERFORMED | NOT_PERFORMED | NOT_PERFORMED |
| **1. Stock mod-off baseline:** both probes off and **no other mod enabled**; use the same disposable Instant Action scenario | NOT_PERFORMED | NOT_PERFORMED | NOT_PERFORMED | NOT_PERFORMED |
| **2. Control-on comparison:** `LanceObserverProbe` and `LanceObserverDiagnosticControl` enabled; no other mod enabled unless separately reviewed and recorded | NOT_PERFORMED | NOT_PERFORMED | NOT_PERFORMED | NOT_PERFORMED |
| **3. Rollback:** exact pretest enabled state and, absent intervening user changes, exact pretest bytes/hash restored | NOT_PERFORMED | NOT_PERFORMED | NOT_PERFORMED | NOT_PERFORMED |

The stock mod-off baseline must show the normal HUD and responsive controls before the control-on comparison. After the test, exit normally, check for intervening user edits, remove only manifest-listed additions, restore exact backed-up files/configuration where appropriate, and rehash the **complete** `Mods` inventory. Record whether state 3 matches state 0 byte-for-byte and whether each original-probe file still matches its pinned hash. If state 0 cannot be restored without overwriting a later user change, stop and reconcile the difference rather than copying old bytes over it. The separate [Phase A evidence sheet](../design/OBSERVER_DIAGNOSTIC_CONTROL_EVIDENCE_SHEET.md) holds the stock HUD, one-press output and rollback observations; all are **NOT_PERFORMED**.

## Gate and provenance

**Historical gate before deployment:** the September 25 plan required package review, a fresh retail inventory, a disposable Instant Action scenario, filled ledgers and separate game-affecting approval. Later package and installation results are linked above. No retail copy, selection change, gameplay or rollback occurred **during this preparation**; final rollback still remains to be recorded.

**Evidence provenance:** `C:\Program Files (x86)\Steam\steamapps\common\MechWarrior 5 Mercenaries\MW5Mercs\Mods` read-only inventory on 2026-09-25 19:09:21 UTC; applicable installed-game version as recorded in that historical `modlist.json` was `1.14.390`. The exact four inventory hashes above are that historical snapshot only. The [package preflight](OBSERVER_DIAGNOSTIC_CONTROL_PACKAGE_PREFLIGHT_2026-09-25.md) and [Phase A evidence sheet](../design/OBSERVER_DIAGNOSTIC_CONTROL_EVIDENCE_SHEET.md) are proposed procedures, not retail observations. Fresh package, process, configuration and rollback evidence remains **UNKNOWN/BLOCKED** or **NOT_PERFORMED** as labeled above.
