# Phase B retail additions and removal ledger

**PROPOSED / NOT PERFORMED.** No Phase B package, retail replacement or rollback has been verified. This is the file-level handoff for a later reviewed package and disposable Instant Action test; it is not authority to copy files. The [package preflight](OBSERVER_PHASE_B_PACKAGE_PREFLIGHT_2026-09-27.md) holds source, resource, native log and PAK admission gates.

## Historical comparison and verified restore bytes

The [05:30 UTC baseline](OBSERVER_PHASE_B_BASELINE_2026-09-27.md) verified a seven-file retail Mods inventory and exact project-local copies of the tested Phase A diagnostic package. These hashes are a **comparison point**, not a current preinstall inventory. Rehash the full retail tree and verify the game is closed immediately before any replacement. The candidate Phase A restore bytes are at `research/evidence/phase-b-baseline-20260927T052800Z/backup/phase-a-package/`; their copy-to-source hashes matched at baseline capture. Use them for rollback only if the fresh prechange diagnostic files still match those Phase A hashes. If any differs, preserve its current bytes and reconcile the change before replacing or restoring it.

| `Mods/` relative path | 05:30 UTC bytes | 05:30 UTC SHA-256 | Phase B action | Conditional Phase A rollback input |
|---|---:|---|---|---|
| `LanceObserverDiagnosticControl/mod.json` | 532 | `24ae37d564c49cf345b0edec5f6a834a5a018ccee6a99f4628c8e4b898efd5af` | Replacement candidate; new package bytes **NOT PERFORMED** | `phase-a-package/mod.json` |
| `LanceObserverDiagnosticControl/Paks/LanceObserverDiagnosticControl.pak` | 20,780 | `0162669d380166bc94244412fb2212d4d5145b20410f01742517f581f6bb1722` | Replacement candidate; new package bytes **NOT PERFORMED** | `phase-a-package/Paks/LanceObserverDiagnosticControl.pak` |
| `LanceObserverDiagnosticControl/Resources/Icon128.png` | 12,352 | `ec157f56f486e5a68fd4b27df6c88fecdb1b8f9bfff18aa5ef10a21bca6a4c5e` | Preserve if identical; any replacement needs a reviewed package row | `phase-a-package/Resources/Icon128.png` |

The original `LanceObserverProbe` retail `mod.json` (405 bytes, `dce8fc883da38b6cafdfd7baf4256ecd350bf9c6c6d621861bc9393e142793a7`), PAK (19,675 bytes, `b913e0f0a8c9f6aa53b8f25e2414f8c700e06fbab0a53bcec5884ab8ce5211d6`) and icon (12,352 bytes, `ec157f56f486e5a68fd4b27df6c88fecdb1b8f9bfff18aa5ef10a21bca6a4c5e`) are protected comparison entries. They are not Phase B additions or replacement targets. Any mismatch stops for investigation.

## Actual change rows to complete after a fresh cook

Enter **one row for every actual packaged file and every changed retail/configuration file**. An absent prior destination is an addition; a prior destination is a replacement with its own verified byte backup. If the Phase B package contains an unanticipated file, stop and review its PAK membership and destination before any retail action. Do not infer this list from the Phase A package.

| Attempt ID and package-relative source | Source bytes and SHA-256 | Exact destination; preexisting bytes and SHA-256 or `ABSENT` | Exact prechange backup and verified SHA-256 or `ABSENT` | Approved action, operator and UTC | Installed bytes and SHA-256 | Removal or restore action, operator and UTC | Final bytes and SHA-256 |
|---|---|---|---|---|---|---|---|
| **NOT PERFORMED — fill from actual Phase B output** | NOT PERFORMED | NOT PERFORMED | NOT PERFORMED | NOT PERFORMED | NOT PERFORMED | NOT PERFORMED | NOT PERFORMED |

The `Mods/modlist.json` comparison was 181 bytes, SHA-256 `ae8fb9c4eaa2ad9d79a5168bb47efd5b3d6f0ed6de6cb97f760fb1dee1b68d58`, with both observer mods enabled at 05:30 UTC. Its exact copy is `backup/configuration/retail-modlist.json`. This is a **both-enabled restore point**, not a stock mod-off baseline. Before a test, record the current bytes, complete parsed entries, enabled state and exact backup; record each mod-off, control-on and restored state separately. Restore old bytes only if no later user edit would be lost.

## Admission and rollback record

| Required evidence | Status |
|---|---|
| Fresh game-closed Mods inventory, exact process/build/configuration observation and every prechange byte backup | NOT PERFORMED |
| Final saved-source review, resource admission, native cook/log, complete PAK list and integrity check | NOT PERFORMED |
| Concrete reviewed Phase B replacement and disposable Instant Action approval | NOT PERFORMED |
| Per-file installation, source/destination hashes and enabled-mod transition | NOT PERFORMED |
| Stock mod-off HUD/control baseline and Phase B one-snapshot evidence | NOT PERFORMED |
| Normal exit, manifest-limited removal/restoration, full seven-file-or-reconciled inventory and HUD/control check | NOT PERFORMED |

Stop on an unexplained retail file, changed modlist, hash drift, package output mismatch, extra PAK member, unverified backup or user edit that the planned restore would overwrite. Remove a directory only if every file within it is a recorded addition and no other file has appeared. Preserve partial evidence and mark an incomplete rollback **NOT PERFORMED**; never reset the original probe, unrelated mods, saves or campaign state to force a match.
