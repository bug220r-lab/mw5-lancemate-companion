# Observer package preparation — 2026-09-25

**OBSERVED: Manage Mod and reviewed source inputs. Prepared for destination-dialog inspection only. Cook, publication, retail deployment and gameplay NOT_PERFORMED.** The paired JSON contains the exact source hashes, empty destination, build metadata and resource observation.

The user's screenshot shows active mod/title LanceObserverProbe, author Jlewis1231, description Passive lancemate observation probe and load order 0. The upper Mod Info section has a **Package** button. The separate lower **Publish To Steam** section has visibility Private and a Publish button, with a message that this mod has not yet been packaged. Private is a publication visibility setting; it does not mean offline-only.

**DOCUMENTED:** [PGI's official guide v2.3, printed page 11](https://static.mw5mercs.com/docs/MW5Mercs_Mod_Editor_Guide_%28v2.3%29.pdf#page=11), checked 2026-09-25, describes Package Mod opening a destination picker and **Select Folder** starting packaging. The guide is historical and its label differs slightly; observe the installed picker before confirming. No automated packaging call or native UI action was made during this preparation.

The eight saved plugin input files still match the reviewed backup, including all three authored assets. Current engine Build.version remains 4.26.2, compatible changelist 14830424; this is not a refreshed Epic package-version or retail compatibility check.

Reserved new empty destination:

`C:\Users\jlewi\OneDrive\Documents\ChatGPT\MW5 LANCEMATE COMPANION\artifacts\LanceObserverProbe\package-20260925-01`

This folder is project-local build output, not a retail Mods destination. Its creation does not constitute a build. Preserve any future partial output for review; do not overwrite a previous attempt. The complete generated output layout and descriptor are unknown until an actual cook completes.

Resource observation at 05:34:49 UTC: 1,283,702,784 bytes physical memory available (~1.20 GiB), 3,718,729,728 bytes commit available (~3.46 GiB), and 14,986,534,912 bytes C: free (~13.96 GiB). This provides only ~3.96 GiB above the project's 10 GiB disk reserve; package/staging peak use is unknown. These are observations, not sufficient build admission. The initial CIM memory query was denied; the zero values derived from that failed call were discarded. The successful observation used GlobalMemoryStatusEx.

Next manual step: open upper **Package**, select/navigate to the reserved folder, and stop before **Select Folder**. Inspect the resulting dialog. Before beginning a cook, resolve available resource headroom, attributable cache/staging/log locations, completion evidence, stop conditions and cleanup; recheck input hashes and current resources. No unrelated process should be terminated to make room. Existing editor lookup helpers and failed capture routes need no retry.

Any later package review must retain actual logs, warnings/errors, source/cooked hashes, generated descriptor and membership of the widget/component/registration packages. Packaging is separate from the [creation-only runtime experiment](../design/OBSERVER_CREATION_ONLY_PROBE.md), which still needs a concrete retail install/removal manifest, refreshed configuration, disposable Instant Action baseline and deployment authorization. The current work opens no game or campaign and authorizes no publication.
