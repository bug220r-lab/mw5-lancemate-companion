# Diagnostic-control retail additions and removal manifest

Prepared 2026-09-25 19:09:21 UTC from read-only inspection of the installed Steam `MW5Mercs/Mods` directory. **PRELIMINARY / NO INSTALL OR GAME TEST PERFORMED.** This is a starting inventory for the [separate package and test preflight](OBSERVER_DIAGNOSTIC_CONTROL_PACKAGE_PREFLIGHT_2026-09-25.md). Reinspect every path, enabled state, process and hash immediately before any authorized deployment; this snapshot is not an install-time backup or a stock mod-off gameplay baseline.

## Observed retail starting inventory

Root: `C:\Program Files (x86)\Steam\steamapps\common\MechWarrior 5 Mercenaries\MW5Mercs\Mods`. The root contained only the `LanceObserverProbe` directory and `modlist.json`; there was no `LanceObserverDiagnosticControl` directory at this inspection. Four files were found under this root:

| Relative path | Bytes | SHA-256 |
| --- | ---: | --- |
| `modlist.json` | 112 | `d483286e4913d77e1dd4332e3c560101b73b568c7833eebd2fb8f5667e5cba0b` |
| `LanceObserverProbe/mod.json` | 405 | `dce8fc883da38b6cafdfd7baf4256ecd350bf9c6c6d621861bc9393e142793a7` |
| `LanceObserverProbe/Paks/LanceObserverProbe.pak` | 19,675 | `b913e0f0a8c9f6aa53b8f25e2414f8c700e06fbab0a53bcec5884ab8ce5211d6` |
| `LanceObserverProbe/Resources/Icon128.png` | 12,352 | `ec157f56f486e5a68fd4b27df6c88fecdb1b8f9bfff18aa5ef10a21bca6a4c5e` |

The current `modlist.json` says `gameVersion: 1.14.390` and has one `modStatus` entry, `LanceObserverProbe` with `bEnabled: true`. This is the **post-enable** state from the original observer test, not a mod-off baseline. The original probe's three installed files match the previously pinned [overnight checkpoint](OBSERVER_OVERNIGHT_CHECKPOINT_2026-09-25.json). No shipping-game process appeared in the checked process names; `UE4Editor` PID 28296 was running. Process-name inspection alone does not prove all game-related processes are closed at a later deployment.

## Proposed additions and removal record

| Target | Pre-install state now | Required action before install | Proposed rollback and verification |
| --- | --- | --- | --- |
| `Mods/LanceObserverDiagnosticControl/` | Absent | Review the actual fresh package and its complete file list and hashes; then recheck absence or capture hashes and byte backups if it has appeared. Record exact relative destinations and source hashes for every file before copying. | Remove only manifest-listed files created by the test, or restore exact backed-up preexisting files. Rehash the entire Mods inventory after removal. Do not remove the original probe. |
| `Mods/modlist.json` | Present, hash above; only original probe enabled | Capture an exact byte backup and current hash immediately before changing selection. Record the full before/after enabled-mod list and whether the game UI or a file operation made the change. | Restore the exact pre-test bytes only if no intervening user change occurred, then rehash. Otherwise reconcile each entry with the user instead of overwriting later changes. |
| `Mods/LanceObserverProbe/` | Present, three pinned files above | Rehash and leave contents untouched; record whether the original probe is enabled for the test configuration. | Confirm all three file hashes still match and restore only a separately documented deviation. |
| Other retail files or user input/settings | No other Mods-root files observed; other settings not inventoried here | Stop on any proposed change outside the reviewed control package and exact enabled-mod selection until separately listed with a byte backup and rollback. | Verify no unexplained additions or changes after the test. |

**Remaining before deployment:** finish diagnostic asset authoring and source review; cook to the reserved local output; verify native logs, complete PAK membership and the package file manifest; refresh installed game/editor builds, DLC and active mods; choose a disposable stock Instant Action scenario; capture an actual mod-off baseline; fill exact destination and backup columns from fresh reads; then obtain the separate game-affecting approval required by project operating rules. No copy, mod selection change, gameplay or rollback occurred in this preparation.
