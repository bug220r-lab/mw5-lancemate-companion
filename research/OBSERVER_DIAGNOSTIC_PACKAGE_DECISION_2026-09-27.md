# Diagnostic control: warning disposition and local package experiment

Date: September 27, 2026. **Warning review completed for one local package experiment. Build NOT_STARTED: disk headroom and manual dialog action remain.** This is an explicit prospective package decision, not a declaration that historical warnings are harmless or runtime behavior is correct.

## Warning disposition

The initial Save To Mod reload warned that three replacement component templates were absent and existing references would be nulled. The final saved-file audit found those exact serialized templates, with normalized bodies matching stock. The September 27 native inspection now finds the exact loaded diagnostic root and all five expected objects after selector-triggered reload; all five exports are byte-identical to the earlier stock snapshots. Both the selector interval and subsequent collection interval contain no new replacement warning. These observations resolve current template absence. They do not resolve every inherited value or historical in-memory reference.

Decision: **permit one separate-process local cook of the unchanged frozen saved assets**, then review its own loading, compilation and serialization log and full PAK membership before retail deployment. The original package cook log, line 151, records a separate `-run=Cook -TargetPlatform=WindowsNoEditor` invocation with DLC substitution parameters; require equivalent attributable evidence for this diagnostic build. We are not repairing or relying on the GUI session's old references for game acceptance. Do not repeat template-presence inspection or make speculative parent-call, delay or component edits.

The localization warning explicitly says `EditorValidator_Localization did not include a pass or fail state`, at `IsValidationStateSet()` in EditorValidatorSubsystem.cpp line 164. The full installed editor filename search did not find that validator's implementation or the subsystem C++ source. No claim about its exact faulty branch can be made. Epic's [UE4.27 validation documentation](https://dev.epicgames.com/documentation/en-us/unreal-engine/data-validation?application_version=4.27), Validation Rules, requires each ValidateLoadedAsset path to call AssetPasses or AssetFails. This is adjacent-version documentation supporting interpretation of the exact local message, not verification of PGI's UE4.26.2 implementation. A missing validator result is neither a content validation pass nor a reported content failure.

Decision: **carry localization validation as UNKNOWN; permit the local cook as a bounded diagnostic experiment**. A new diagnostic-specific ensure, missing reference, compiler error, failed cook or unexpected cooked content stops progression to retail review. Preserve failures without retry. No validator is disabled, patched or bypassed. This decision supersedes older instructions to wait indefinitely for complete warning resolution before a local cook; it retains review before any installation and no claim of compatibility.

## Fresh checks and evidence

[Attempt baseline](evidence/diagnostic-package-20260927-01/BASELINE.json): the saved-source inspector returned `SOURCE_MATCHES_SUPPLIED_FREEZE`, exit 0, no issues. All source/configuration bytes match the complete supplied freeze. The diagnostic descriptor remains build 0 with exactly the reviewed Instant Action controller override. Diagnostic selection marker is present. Same responding UE4Editor PID 11980. Current retail inventory remains four files: the original observer's three files and modlist.json with only that observer enabled. No retail modification occurred.

Two initial memory queries failed with access denied and are recorded as UNKNOWN, not zero available memory. A separate read-only Windows memory query succeeded: approximately 1.91 GiB available physical RAM and 4.16 GiB available commit at 04:33:19 UTC. **No RAM/commit threshold applies.** Free disk fell during preparation to approximately 11.2 GiB. The retained 12 GiB starting floor is not met; about 0.81 GiB is missing, so freeing roughly 1 GiB is the practical minimum. Recheck immediately before starting. Do not delete caches, change pagefile/hibernation settings or close unrelated user applications automatically.

The prepared, empty output parent is:

`C:\Users\jlewi\OneDrive\Documents\ChatGPT\MW5 LANCEMATE COMPANION\artifacts\LanceObserverDiagnosticControl\package-20260927-01`

The baseline pins every diagnostic source file, the current retail inventory, the complete current editor log and the historical warning log. Package source, log, resource and output checks are observations for this preparation, not durable permission to reuse a stale baseline after changes.

## Manual start and completion

Computer-use discovery found the correct editor window. It was minimized; after activation, capture failed with `FrameArrived timed out: timed out waiting on channel`. No Package button was clicked and no input was typed. Manual interaction is required until capture works.

1. Make at least 12 GiB free on C: and refresh source/resource/log baselines before the build. Keep the unchanged diagnostic selected.
2. Open Manage Mod for LanceObserverDiagnosticControl. Use the upper **Package** button, not Publish To Steam.
3. Select the exact empty parent above in the output picker. If the selected mod/path differs or a warning/dialog appears, stop and provide its screenshot. Do not change authoring settings.
4. On completion, provide the result. Review the native cook/package logs, outcome, every output hash, full UnrealPak listing and unchanged original source. Permit only an attributable diagnostic descriptor build-number update; investigate other source drift. Preserve any partial output and do not silently rerun.
5. After a reviewed package, fill the exact package-to-retail additions/removal ledger and perform the separately bounded disposable Instant Action test. A successful package alone is not a successful mod test. Phase A checks one F8 press and the static `CONTROL A — OUTPUT ONLY` marker within ten seconds; it does not establish passive recording. Never use the main campaign.

Rollback for this local experiment: keep partial output and logs for review; do not install them. Original mod content and retail files remain untouched. Do not automatically revert selector state, force-end the editor, erase shared cook caches, or overwrite an intervening user change. A later retail experiment needs its own exact file/configuration backup and rollback ledger populated from the actual package.
