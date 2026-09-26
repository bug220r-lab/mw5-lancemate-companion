# Phase A diagnostic control Instant Action evidence sheet

Prepared 2026-09-26 UTC. **PROPOSED / ALL TEST ROWS NOT_PERFORMED.** This sheet measures only whether the separate static-output diagnostic accepts one F8 input and displays its owned `CONTROL A — OUTPUT ONLY` widget in an isolated retail Instant Action configuration. The [final editor-source review](../research/OBSERVER_DIAGNOSTIC_CONTROL_FINAL_SOURCE_REVIEW_2026-09-25.md) supports the authored route, but no cook, retail installation or game observation has occurred. The original observer's component creation, exact count and lifetime have a [different evidence sheet](OBSERVER_CREATION_EVIDENCE_SHEET.md); this control marker cannot establish any of those findings.

## Gate before retail changes

Fill the [package preflight](../research/OBSERVER_DIAGNOSTIC_CONTROL_PACKAGE_PREFLIGHT_2026-09-25.md) and [per-file retail additions/removal manifest](../research/OBSERVER_DIAGNOSTIC_CONTROL_RETAIL_MANIFEST_2026-09-25.md) from the actual cooked package. Recheck game/editor builds, DLC entitlement and active mods. Record a disposable stock Instant Action scenario, ordinary HUD/controls and exact rollback before requesting the separate approval for a game-affecting test. Do not use the main campaign or an existing save. The current source freeze and backup are source evidence, not package membership or deployment authorization.

| Attempt identity | Record |
|---|---|
| Attempt ID, UTC start/end, operator | NOT_PERFORMED |
| Retail executable/build, DLC, scenario, lance/loadout | NOT_PERFORMED |
| Exact package `mod.json`, PAK and installed-file SHA-256; complete PAK listing | NOT_PERFORMED |
| Source-freeze manifest hash and any package-time source/descriptor mutation | NOT_PERFORMED |
| Full Mods inventory, enabled list, input/overlay conflict review | NOT_PERFORMED |
| Approved retail additions/removal manifest and backup location | NOT_PERFORMED |
| Screenshot/video clock alignment and evidence file hashes | NOT_PERFORMED |

## Configuration sequence

Keep exact byte backups and hashes of `Mods/modlist.json` at each transition. A prior inventory found the original `LanceObserverProbe` enabled; that historical snapshot is not the stock baseline. Record the actual state immediately before this attempt and guard against intervening user changes. Use a normal game exit/restart for each configuration change needed by the test.

| State | Original probe | Diagnostic control | `modlist.json` bytes/hash, full enabled list, restart and evidence |
|---|---|---|---|
| Pretest restore point, before any changes | VERIFY | VERIFY | NOT_PERFORMED |
| Stock mod-off baseline | OFF | OFF | NOT_PERFORMED |
| Control-on comparison | ON | ON | NOT_PERFORMED |
| Rollback to exact pretest state | RESTORE | RESTORE | NOT_PERFORMED |

For the stock baseline, capture the same disposable mission with the ordinary HUD visible, game unpaused and movement/order controls responsive. Record any preexisting overlay, popup, input conflict, crash or unusual resource behavior. If the stock baseline is incomplete, stop before enabling the diagnostic control.

## Single-press observation

After enabling the reviewed original-probe-plus-control configuration and restarting, capture a **prepress** HUD image with the mission fully loaded, normal controls responsive and the diagnostic marker absent. Press the reviewed F8 key **exactly once**; record the time and capture the **postpress** HUD within ten seconds. The authored input has no modifiers and does not consume input, but actual input routing and conflicts are untested. Do not press repeatedly to force a positive result.

| Observation | Method/evidence, UTC or video time, finding |
|---|---|
| Stock mod-off HUD/controls and preexisting overlays | NOT_PERFORMED |
| Control-on enabled list and successful restart | NOT_PERFORMED |
| Loaded, unpaused prepress HUD; marker absent | NOT_PERFORMED |
| One F8 press; exact timestamp and input-interference note | NOT_PERFORMED |
| HUD within ten seconds: exact marker, absence, or ambiguous result | NOT_PERFORMED |
| Duplicate widget, original probe overlay, input side effect, crash or performance issue | NOT_PERFORMED |
| Normal mission/game exit and evidence hashes | NOT_PERFORMED |

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
