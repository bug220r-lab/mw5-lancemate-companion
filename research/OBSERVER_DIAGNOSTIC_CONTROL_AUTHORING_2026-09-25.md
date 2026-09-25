# Phase A diagnostic control authoring — September 25, 2026

**Status: SEPARATE_MOD_CREATED_CONTROLLER_COPY_NOT_PERFORMED.** The separate `LanceObserverDiagnosticControl` mod was created through the installed editor's Create Mod dialog. Its descriptor, input/tag templates, icon and active-selection marker exist. The controller substitution and widget are not built; no compile, Play, cook, package, retail installation or runtime test was performed in this work unit.

This continues the [morning Phase A plan](../design/OBSERVER_DIAGNOSTIC_CONTROL_MORNING.md) after the [disposable authoring proof](EDITOR_AUTHORING_PROBE_2026-09-25.md). The adjacent [JSON record](OBSERVER_DIAGNOSTIC_CONTROL_AUTHORING_2026-09-25.json) contains the fresh baseline, actual created-file hashes and checkpoint. The coordinator owns the separate [package/review preflight](OBSERVER_DIAGNOSTIC_CONTROL_PACKAGE_PREFLIGHT_2026-09-25.md). These preparation artifacts do not establish that the original missing readout is fixed.

## Observed checkpoint

- At preflight, all eight original observer pins matched, the proposed diagnostic directory was absent, UE4Editor PID 28296 was present and the targeted retail process check returned no game process. The installed editor reports UE4 4.26.2 / compatible changelist 14830424; retail metadata reports 1.14.390 / changelist 456620. These build observations do not establish DLC entitlement or runtime compatibility.
- The untouched stock source `MW5Mercs/Content/Modes/InstantAction/InstantActionPlayerController.uasset` is 53,635 bytes, SHA256 `7107745a8de461275a7acfa1f3ffc5be9bcb7002682c37b7705af5f00783e4f6`. A local baseline copy is retained under `artifacts/diagnostic-control-authoring-20260925/baseline`.
- Create Mod produced `MW5Mercs/Plugins/LanceObserverDiagnosticControl`. A fresh screenshot showed this exact active-mod name and its empty Content Browser folder. Disk inspection found exactly five generated files and no `.uasset`.
- The generated `Config/Input/LanceObserverDiagnosticControlInput.ini` is the unchanged 1,383-byte template, SHA256 `fc21b00d6db183e8434466e27f0f4fc194f7e852f66ce68bc15c9323271aa17d`. No action has been added. F8 is a candidate from the independent input audit, not a tested runtime binding.
- The stock Instant Action controller was selected in the Content Browser and opened using Return. Native enumeration observed its `InstantActionPlayerController` asset window. **Save To Mod has not been clicked**, and the stock hash still matches.
- The seven original observer descriptor/content/configuration/resource pins still match. Creating the separate mod moved the editor selection marker: the original `ActiveMod.txt` is absent and the diagnostic mod has the zero-byte marker. This is the recorded selection change, not an observer content edit. Restoring the original selection and rechecking all eight remain pending.

## Input interruption and continuation

A reviewed folder double-click stopped when the cursor moved between click pairs; a fresh screenshot showed the folder selected, and subsequent keyboard navigation opened it. Later, capture of the newly opened stock controller refused because foreground focus changed. No stock-controller write occurred. Editor input was then stopped, and the user was asked whether they can leave the editor/mouse idle or prefer offline preparation. A pending question is not consent to resume input.

Once the user indicates the editor is available, rediscover its current windows, foreground and active-mod selection; do not reuse the historical handles or receipts. Rehash stock and observer content, then use the actual Save To Mod operation for the exact controller only after verifying the separate diagnostic mod is active. Record the resulting substitution path and compare the inherited graph/defaults before authoring the independent static widget and input chain. Preserve stock files and the original observer. Continue no further than the reviewed Phase A scope; component enumeration belongs to a later phase after visible runtime output is established.

The user's fixed RAM-reserve waiver remains in effect. Resource observations are useful, but this work must not reinstate a fixed physical-RAM/commit reserve. Stop for actual allocation failure, loss of responsiveness, unexpected changes or uncertain UI effects. Retail testing remains a separate concrete manifest/baseline/rollback decision.

Raw screenshots and the stock baseline copy remain local evidence. The source backup may contain this report, the index and reviewed project-authored scripts; it must not silently include game binaries or desktop screenshots.
