# Phase A diagnostic control Instant Action evidence sheet

Prepared 2026-09-26 UTC; updated 2026-09-27. **PARTIAL RETAIL OBSERVATION / FORMAL BASELINE, LIFECYCLE RECEIPT AND ROLLBACK INCOMPLETE.** This sheet measures the separate static-output diagnostic's `CONTROL A — OUTPUT ONLY` marker in disposable Instant Action. The [package result](../research/OBSERVER_DIAGNOSTIC_PACKAGE_RESULT_2026-09-27.md) and [runtime result](../research/OBSERVER_DIAGNOSTIC_CONTROL_RUNTIME_RESULT_2026-09-27.md) now provide partial real evidence. The original observer's component creation, exact count and lifetime have a [different evidence sheet](OBSERVER_CREATION_EVIDENCE_SHEET.md); this control marker cannot establish any of those findings.

## Current partial evidence

| Finding | Status and limit |
|---|---|
| Package and install | Native cook succeeded and the three-file package/PAK was reviewed. An explicitly approved three-file retail copy was hash-verified. The proposed 12 GiB cook starting floor was missed, so its admission check did not pass. |
| Visible output | Two hash-verified screenshots show the exact static marker in game views, including one after a user-reported restart. F8 activation, press count, timing, normal controls and clean audio are user reports, not properties established by the screenshots. |
| Enabled configuration | At about 05:15 UTC a read-only `modlist.json` snapshot had exactly `LanceObserverProbe` and `LanceObserverDiagnosticControl` enabled. The first runtime receipt's parsed `enabled_mods.modStatus` is empty; use the later restart receipt and current modlist for this claim. Recheck after the running game exits. |
| Stock baseline | The user compared crunchy audio with both mods disabled, then reported it cleared after closing the editor. A controlled mod-off HUD/control baseline for the same mission remains **NOT_PERFORMED**. The audio association is not a diagnosed cause. |
| Lifecycle and rollback | The user reports the marker disappeared at the menu, was absent before F8 in another Instant Action mission, and reappeared after one F8 press. No new screenshot or timestamped record independently verifies those three checks. Duplicate suppression and full file/configuration rollback remain **NOT_PERFORMED**. |

The visible marker is an **OBSERVED static-output finding**. The stricter `CONTROL_OUTPUT_OBSERVED` evidence-sheet gate below requires a complete baseline and rollback, so it has **not** been met. Passive observer creation, three-AI coverage and recording remain unverified.

## Original gate checklist and remaining formal evidence

The package and retail copy were completed with separate user authorization. The historical [package preflight](../research/OBSERVER_DIAGNOSTIC_CONTROL_PACKAGE_PREFLIGHT_2026-09-25.md) and [preliminary retail manifest](../research/OBSERVER_DIAGNOSTIC_CONTROL_RETAIL_MANIFEST_2026-09-25.md) are superseded for those actions by the actual [package and installation receipts](../research/OBSERVER_DIAGNOSTIC_PACKAGE_RESULT_2026-09-27.md). The checklist below tracks remaining formal runtime evidence. Keep the test in disposable Instant Action, record an ordinary stock HUD/control baseline and exact rollback, and do not use the main campaign or an existing save.

| Attempt identity | Record |
|---|---|
| Attempt ID, UTC start/end, operator | Package attempt `diagnostic-package-20260927-01`: user started 04:41:46 UTC, native exit 04:47:56 UTC. Retail install 04:52:15 UTC. The complete runtime attempt/end record is pending. |
| Retail executable/build, DLC, scenario, lance/loadout | `modlist.json` reports retail version 1.14.390. Instant Action is user-reported and pictured; exact scenario, lance/loadout and DLC entitlement are not recorded here. |
| Exact package `mod.json`, PAK and installed-file SHA-256; complete PAK listing | **OBSERVED:** three output and installed file hashes in the [package result](../research/OBSERVER_DIAGNOSTIC_PACKAGE_RESULT_2026-09-27.md); UnrealPak list/test exit 0, exact seven-entry listing. Rehash after gameplay and rollback. |
| Source-freeze manifest hash and any package-time source/descriptor mutation | **OBSERVED:** six diagnostic asset/config/resource files still match the original freeze and all seven frozen backups match. Descriptor author changed from blank to `Jlewis` before the cook under review; packaging then changed only buildNumber 0 to 1. Current descriptor matches the packaged file. See [package result](../research/OBSERVER_DIAGNOSTIC_PACKAGE_RESULT_2026-09-27.md). |
| Full Mods inventory, enabled list, input/overlay conflict review | Pre-install four-file and post-install seven-file inventories exist. Later two-mod enabled list is saved with the restart receipt. A controlled mod-off HUD/input baseline and complete conflict review remain **NOT_PERFORMED**. |
| Approved retail additions/removal manifest and backup location | User approved the exact three-file copy; [installation receipt and manifest](../research/OBSERVER_DIAGNOSTIC_PACKAGE_RESULT_2026-09-27.md) include the preinstall modlist backup. Removal/restore remains **NOT_PERFORMED**. |
| Screenshot/video clock alignment and evidence file hashes | Two screenshots have verified hashes; no synchronized press-time/video record establishes activation latency or one-press count. |

## Configuration sequence

Keep exact byte backups and hashes of `Mods/modlist.json` at each transition. A prior inventory found the original `LanceObserverProbe` enabled; that historical snapshot is not the stock baseline. Record the actual state immediately before this attempt and guard against intervening user changes. Use a normal game exit/restart for each configuration change needed by the test.

| State | Original probe | Diagnostic control | `modlist.json` bytes/hash, full enabled list, restart and evidence |
|---|---|---|---|
| Pretest restore point, before any changes | VERIFY | VERIFY | The preinstall 112-byte `modlist.json` was backed up and hashed. It recorded the original probe enabled before the new directory was copied; confirm the exact target rollback state against the install receipt and any later user edits. |
| Stock mod-off baseline | OFF | OFF | User-reported audio comparison only. Ordinary HUD, controls, scenario and byte-level configuration baseline **NOT_PERFORMED**. |
| Control-on comparison | ON | ON | Later restart receipt records both mods enabled and visible marker. At about 05:15 UTC `modlist.json` was 181 bytes, SHA-256 `ae8fb9c4eaa2ad9d79a5168bb47efd5b3d6f0ed6de6cb97f760fb1dee1b68d58`; refresh after game exit. |
| Rollback to exact pretest state | RESTORE | RESTORE | NOT_PERFORMED |

The original protocol called for a stock baseline in the same disposable mission, with the ordinary HUD visible, game unpaused and movement/order controls responsive, and for stopping before enabling the control if that baseline was incomplete. The control was enabled without this formal baseline. This is a recorded protocol gap; collect a later baseline if useful, but do not backdate it to the first control-on run.

## Single-press observation

After enabling the reviewed original-probe-plus-control configuration and restarting, capture a **prepress** HUD image with the mission fully loaded, normal controls responsive and the diagnostic marker absent. Press the reviewed F8 key **exactly once**; record the time and capture the **postpress** HUD within ten seconds. The authored input has no modifiers and does not consume input, but actual input routing and conflicts are untested. Do not press repeatedly to force a positive result.

| Observation | Method/evidence, UTC or video time, finding |
|---|---|
| Stock mod-off HUD/controls and preexisting overlays | NOT_PERFORMED |
| Control-on enabled list and successful restart | Later saved modlist shows both enabled; user reports restart, normal controls/audio and working F8. The first screenshot's saved modlist did not confirm enabled state; see the [runtime correction](../research/OBSERVER_DIAGNOSTIC_CONTROL_RUNTIME_RESULT_2026-09-27.md). |
| Loaded, unpaused prepress HUD; marker absent | User reports marker absent before F8 in the next Instant Action mission; no prepress image or timestamp saved. |
| One F8 press; exact timestamp and input-interference note | User reports one F8 press produced the marker in the next mission, with movement and weapons functional. Press count and timestamp were not independently recorded. |
| HUD within ten seconds: exact marker, absence, or ambiguous result | Exact marker is visible in two hash-verified screenshots. Within-ten-seconds timing is **NOT_MEASURED**. |
| Duplicate widget, original probe overlay, input side effect, crash or performance issue | User reports working movement/weapons/audio after restart; duplicate suppression, original probe overlay and performance were not independently checked. |
| Normal mission/game exit and evidence hashes | User reports marker disappeared at the menu. No separate lifecycle screenshot/hash or final game exit receipt yet. |

Record `CONTROL_OUTPUT_OBSERVED` only if the exact marker is attributable to this package, appears after the one press in the recorded configuration, and baseline/rollback evidence is complete. Record `CONTROL_OUTPUT_NOT_ESTABLISHED` if absent, ambiguous, or unsupported by the configuration/evidence; keep the observed facts separate from the result label. Even a positive marker demonstrates only that input/widget route in that configuration. It does not prove automatic observer creation, three-AI coverage, recording, component lifetime, commands or broad compatibility.

## Stop and rollback

Stop for a crash, duplicate or unintended control output, unknown load order, unexpected retail file/configuration change, source/package drift, missing stock baseline or unreviewable evidence. Exit the game normally. Remove only files listed as test additions; restore only exact backed-up changed files/configuration after checking for intervening user edits. Rehash the full Mods inventory and `modlist.json`, restore the pretest enabled state, restart if required, and recapture the pretest HUD/controls. Preserve partial evidence and label every unrun step `NOT_PERFORMED`.

| Rollback check | Evidence/status |
|---|---|
| Game exited normally; exact additions/changed files identified | NOT_PERFORMED |
| Manifest-listed additions removed and backed-up files restored | NOT_PERFORMED |
| Complete Mods inventory and `modlist.json` match the pretest restore point | NOT_PERFORMED |
| Pretest enabled state and ordinary controls/HUD rechecked | NOT_PERFORMED |
| Partial results, stop reason and reviewer conclusion retained | NOT_PERFORMED |
