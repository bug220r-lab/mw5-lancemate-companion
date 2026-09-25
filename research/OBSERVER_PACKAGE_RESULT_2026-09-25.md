# LanceObserverProbe local package result

**OBSERVED — LOCAL_PACKAGE_VERIFIED_RUNTIME_NOT_PERFORMED.** On 2026-09-25 the user started the native Manage Mod package operation. The editor reported `BUILD SUCCESSFUL` at **05:52:43.443 UTC (01:52:43 EDT)** and AutomationTool exited with code **0**. The cooked package contains all three reviewed observer assets. This result supersedes the pending cook/output fields in the historical [preflight](OBSERVER_PACKAGE_PREFLIGHT_2026-09-25.md) and [preparation record](OBSERVER_PACKAGE_PREPARATION.md); their earlier observations remain historical.

## Verified output

Output folder: `artifacts/LanceObserverProbe/package-20260925-01/LanceObserverProbe` within this project.

| File | Bytes | SHA-256 |
|---|---:|---|
| `mod.json` | 405 | `dce8fc883da38b6cafdfd7baf4256ecd350bf9c6c6d621861bc9393e142793a7` |
| `Paks/LanceObserverProbe.pak` | 19,675 | `b913e0f0a8c9f6aa53b8f25e2414f8c700e06fbab0a53bcec5884ab8ce5211d6` |
| `Resources/Icon128.png` | 12,352 | `ec157f56f486e5a68fd4b27df6c88fecdb1b8f9bfff18aa5ef10a21bca6a4c5e` |

The installed editor's UnrealPak utility listed the PAK successfully with exit code 0 and mount point `../../../MW5Mercs/`. Its nine entries are the Input and Tags configuration files, `AssetRegistry.bin`, and a cooked `.uasset` / `.uexp` pair for each of:

- `BP_LanceObserverProbeComponent`
- `DA_LanceObserverProbeRegistration`
- `WBP_LanceObserverProbeReadout`

The native directory listing establishes package membership; it does not establish retail loading, registration visibility or behavior. No extraction, retail installation or game launch was performed for this verification.

All **eight reviewed saved-source files** still match the pre-package hashes and lengths. The generated source `mod.json` changed only semantically in `buildNumber`, from 0 to 1; its final values equal the output descriptor. It still declares editor-origin `gameVersion: "1.14.70"`, an empty changed-file manifest and Steam published ID 0. Compatibility with the separately recorded retail build remains unverified.

## Native build evidence and warnings

The main editor log records `PackageMW5Mod`, `SkipPackaging=false`, `PublishToSteam=false`, and the exact project-local output directory. Cook began at **05:45:07.267 UTC** for `WindowsNoEditor`, using `DLCName=LanceObserverProbe` and `basedonreleaseversion=1.0`. The commandlet process completed with exit code 0 after 454.45 seconds; native PAK generation and output copying followed.

The plugin cook log invalidates prior cook settings and clears cooked content, then explicitly cooks the three authored assets. It reports a three-package chunk and an asset registry containing three assets. The displayed 109704 cooked-package counter includes an unexplained initial count of 109701 before those three cook lines; it is **not** evidence that 109704 new mod assets were built.

The cook reported **0 errors and 186 warnings**. Independent review counted the original warnings before the repeated summary:

| Warning family | Count | Scope |
|---|---:|---|
| Missing-load warnings | 27 | Stock ExplosionsMegaPack effects |
| Unresolved release-registry packages | 159 | 152 stock ExplosionsMegaPack entries and 7 Wwise icons/types |

No warning references the probe namespace or its three authored assets. These warnings did not prevent packaging; their retail implications have not been tested or repaired.

Source locations: `MW5Mercs.log` original lines 1192–1799; plugin `LanceObserverProbeCookOutput.txt-2026.09.25-01.45.07.txt` lines 931–933, 1097–1112 and 1300. The editor identifies itself as `Editor_Release-70 DEVELOPMENT CL457211 (v1.14.70)`, UE4 4.26.2. Local evidence copies, complete paths, tool identity, output hashes and native PAK membership are pinned in the [machine-readable receipt](OBSERVER_PACKAGE_RESULT_2026-09-25.json). Raw evidence remains in the ignored project-local directory `research/evidence/editor-source/observer-package-20260925T054502Z`; cooked outputs remain ignored under `artifacts/`.

## Resource outcome

The user began packaging before the proposed admission gate had passed and explicitly chose to continue after the proposed resource floors were crossed. No process was force-ended, Defender setting changed, or cache/pagefile removed by this task. Spotify was left open.

The collected short monitoring windows observed physical memory available as low as **228,003,840 bytes (about 217 MiB)** and disk free as low as **5,426,802,688 bytes (about 5.05 GiB)**. This was not a continuous full-run trace; these are sampled minima, not certified peak requirements. Build success does not validate those proposed resource gates.

At **05:59:00 UTC**, available physical memory was **7,808,180,224 bytes (7.27 GiB)**, available commit **5,979,803,648 bytes (5.57 GiB)**, and disk free **13,774,901,248 bytes (12.83 GiB)**. The packaging child processes, IDs 15936 and 24692, were absent; the user's original editor process 11420 remained open.

## Next boundary

**Retail installation, startup, visible readout, runtime registration, lifecycle validation and mission recording: NOT_PERFORMED.** Steam publication was disabled for this operation and was not performed. A successful cook does not establish game compatibility or completion of the mission recorder.

The next proposed milestone is a bounded, disposable stock Instant Action test using the [creation-only evidence sheet](../design/OBSERVER_CREATION_EVIDENCE_SHEET.md). Before retail deployment, prepare the exact additions/configuration backup and removal manifest, refresh the game build and active-mod evidence, declare the baseline and observation limits, and obtain the separate game-affecting test authorization required by the project operating rules. Preserve the main campaign and existing mods.
