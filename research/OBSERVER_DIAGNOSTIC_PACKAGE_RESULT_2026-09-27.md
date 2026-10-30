# Diagnostic control package verified

**LOCAL_PACKAGE_VERIFIED_RUNTIME_NOT_PERFORMED.** The user started the local package at 04:41:46 UTC on September 27. Native `BUILD SUCCESSFUL` and AutomationTool exit code 0 were recorded at 04:47:56 UTC. The cook process took 367.87 seconds and exited 0. Its invocation targeted LanceObserverDiagnosticControl, the prepared output, SkipPackaging=false and PublishToSteam=false.

[Full review and hashes](evidence/diagnostic-package-20260927-01/PACKAGE_REVIEW.json), [PAK listing](evidence/diagnostic-package-20260927-01/pak-list.txt), and [installation/rollback manifest](evidence/diagnostic-package-20260927-01/INSTALL_MANIFEST.json) preserve the concrete artifacts.

## Verified output

Directory: `artifacts/LanceObserverDiagnosticControl/package-20260927-01/LanceObserverDiagnosticControl`.

| File | Bytes | SHA-256 |
|---|---:|---|
| mod.json | 532 | 24ae37d564c49cf345b0edec5f6a834a5a018ccee6a99f4628c8e4b898efd5af |
| Paks/LanceObserverDiagnosticControl.pak | 20,780 | 0162669d380166bc94244412fb2212d4d5145b20410f01742517f581f6bb1722 |
| Resources/Icon128.png | 12,352 | ec157f56f486e5a68fd4b27df6c88fecdb1b8f9bfff18aa5ef10a21bca6a4c5e |

UnrealPak -List returned exit 0, mount point `../../../MW5Mercs/`, and exactly seven entries: the diagnostic Input and Tags ini files, the InstantActionPlayerController uasset/uexp pair at `Content/Modes/InstantAction/`, the diagnostic widget uasset/uexp pair under the plugin Content, and the plugin AssetRegistry.bin. No original observer assets appear. The controller's cooked path agrees with the descriptor's reviewed substitution target. This establishes package membership, not retail override precedence or executed behavior.

The cook log explicitly clears WindowsNoEditor cooked content at line 865 and cooks the two reviewed assets at lines 1030–1031. Its large initial cooked-package counter is baseline bookkeeping, not this mod's asset count. No missing diagnostic templates, localization ensure, compiler error or other cook error was recorded. All 186 primary warning lines belong to the same exact primary-warning-line set as the earlier observer build; no new primary warning text appeared. The raw cook log additionally contains 50 LogInit warning recap lines, for 236 lines containing `: Warning:` in total. That comparison does not claim all stock warnings are harmless, but identifies no new diagnostic-specific failure.

The saved diagnostic assets/configuration match the reviewed pre-cook freeze. Source mod.json changed only in buildNumber, 0 to 1, and its parsed contents match the packaged descriptor. The author change from blank to Jlewis occurred before cooking and was separately reviewed in picker-source-freeze.json. Original observer immutable files, stock controller and the existing four retail files remained unchanged.

## Resources and limitations

The user started before the proposed 12 GiB disk admission floor was re-established. Recorded samples reached approximately 5.12 GiB free disk and 343 MiB available RAM, then recovered after the cook. These sampled minima are not continuous peak measurements or validation of resource thresholds. No process was terminated and no memory/pagefile/security settings were changed. The monitor completed after the native success marker.

The earlier preview-icon warning pointed at `Plugins/Resources/Icon128.png`; the correct diagnostic icon was present throughout and appears byte-identically in the final package. Historical GUI in-memory reference repair and localization validation remain unknown. The successful separate-process cook narrows those risks for this package; it does not establish game behavior.

## Deployment boundary and exact next action

**Installation NOT_PERFORMED.** A requested copy operation was rejected by automatic approval review before execution. Reason: the project requires separate explicit retail-deployment authorization; the earlier request to test the mod was not accepted as that authorization. No workaround, indirect copy, enablement or game launch followed the rejection.

The concrete approval is to copy only the three verified files above into:

`C:\Program Files (x86)\Steam\steamapps\common\MechWarrior 5 Mercenaries\MW5Mercs\Mods\LanceObserverDiagnosticControl`

That directory was absent at pre-install inspection. The original observer and modlist.json are preserved; the latter has an exact verified project-local backup at `research/evidence/diagnostic-package-20260927-01/retail-preinstall-modlist.json`. No package is published. Refresh process, package pins and complete retail inventory immediately before any authorized copy; stop on a changed or preexisting target.

After separate installation authorization and verification, use a disposable Instant Action scenario. Record stock mod-off normal HUD/control baseline, then enable the original probe and diagnostic control through the game, apply and restart. Record the prepress state, press F8 once, and look for `CONTROL A — OUTPUT ONLY` within ten seconds. Missing output, input interference, crash or unexpected behavior stops the experiment. Main campaign, component enumeration, AI orders, voice and recording are outside this test. Roll back only manifest-listed additions and approved configuration changes, preserving intervening user edits.


## Authorized installation completed

Supersedes the installation block above. The user explicitly replied "Authorized" to the concrete three-file retail-install request. [Install result](evidence/diagnostic-package-20260927-01/INSTALL_RESULT.json) records all three files copied and hash-verified at 2026-09-27T04:52:15.5116662Z. Pre-copy checks found MW5 closed, the destination absent, unchanged source package hashes, and exactly the existing four-file retail baseline. Original observer files and modlist.json stayed unchanged. The diagnostic has not been enabled or game-tested by this operation. The backup and exact rollback ledger remain available. Next is the manual disposable Instant Action baseline, followed by enabling both probes, applying/restarting and the one-press F8 static-output test.


## Evidence wording annotation

The preserved PACKAGE_REVIEW.json has a stale `pak_membership=REQUIRES_UNREALPAK_LIST` field inherited from collection, despite its subsequently recorded seven verified pak_entries and pak_mount. [Addendum](evidence/diagnostic-package-20260927-01/PACKAGE_REVIEW_ANNOTATION.json) corrects that field to verified exact seven-member listing without altering the original receipt. Warning counts mean 186 primary occurrences plus 50 recap lines. No game/editor state changed.
