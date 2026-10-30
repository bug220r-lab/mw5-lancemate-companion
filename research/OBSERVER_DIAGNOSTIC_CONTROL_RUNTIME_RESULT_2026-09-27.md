# Diagnostic control: output observed in retail

**CONTROL_OUTPUT_OBSERVED_AUDIO_ISSUE_REPORTED.** The user supplied a screenshot visibly showing `CONTROL A — OUTPUT ONLY` in Instant Action, and reported that F8, weapons and movement work. The user also reported crunchy audio. [Evidence receipt](evidence/diagnostic-control-runtime-20260927T050026Z/RESULT.json).

**Evidence correction:** the first saved modlist and RESULT.json contain an empty `modStatus`, so they do not confirm both mods enabled for that first screenshot. Both-enabled state was user-reported, and a preceding read showed it, but the discrepancy with the saved snapshot is unexplained. The later restart receipt separately confirms both enabled; it must not be backdated to the first capture. The original receipts are preserved byte-for-byte; see [annotation](evidence/diagnostic-control-runtime-20260927T050026Z/EVIDENCE_ANNOTATION.json). All three installed diagnostic package hashes matched the reviewed package at the first check. No live settings, assets or game state were changed by this evidence collection. The editor log inspected during this turn is the old packaging log, not a retail-game audio log.

This establishes the diagnostic static display in the photographed run, with user-reported F8 activation and controls. It does not establish the original observer startup, component enumeration, recording, measured activation latency, duplicate suppression, cleanup, or compatibility across missions. The mod-off baseline remains unperformed. Audio quality is user-reported; a screenshot cannot verify its cause. Do not attribute it to either mod, the editor, drivers or system load yet.

## Immediate next test

Exit the mission test normally. In Mods disable both probes, apply and restart MW5. Repeat the same Instant Action mission settings and mech with the same audio device, audio settings and background-app setup. Compare whether the crunchy audio remains, and confirm controls. Keep the main campaign out of this test. If the symptom disappears, investigate the mods individually; if it persists, investigate the audio/system baseline. A single comparison is evidence of association, not proof of cause. Do not change drivers, close background applications, edit audio settings or add Phase B at the same time, because that would confound the comparison.


## User-reported audio comparison — 2026-09-27T05:05:04.471221+00:00

The user reports that crunchy audio persisted with both mods disabled, then cleared after closing the MW5 editor. This supports an association with concurrent editor operation in this session; exact technical cause and repeatability were not measured. Do not claim the mods caused the audio issue or that a specific resource/driver mechanism was diagnosed.

Next: keep the editor closed, enable both probes, Apply and restart MW5; repeat disposable Instant Action, verify normal sound/movement/weapons, press F8 once and observe the static marker within ten seconds. The successful F8 screenshot remains valid. Combined mods-on/audio-normal acceptance with the editor closed is pending. Phase B component enumeration, original automatic observer startup and recording remain unverified. No settings or running applications were changed by this record.


## Restart confirmation — 2026-09-27T05:10:54.938141+00:00

**CONTROL_OUTPUT_AFTER_RESTART_OBSERVED.** The latest screenshot visibly shows the static diagnostic marker. The user confirms restarting MW5, clean audio, functional movement/weapons and working F8. Current modlist confirms both probes enabled; no UE4Editor process was returned. [Evidence](evidence/diagnostic-restart-confirmation-20260927T051054Z/RESULT.json). This corroborates the diagnostic display across a reported restart, with user-reported controls/audio normal in this run. It does not establish the original observer or recording, measured latency, duplicate suppression or lifecycle cleanup.

Next: return normally from this Instant Action mission to the main menu and check that the diagnostic text disappears. Then enter another Instant Action mission: text should be absent before F8 and appear after one F8 press. Record each outcome; do not open the editor or rebuild for these tests. Previous audio-test instructions above are historical; the restart check has passed.


## Formal acceptance boundary (historical; lifecycle status superseded below)

Visible static output and later both-enabled state are established by their respective evidence. User-reported audio recovery does not substitute for the formal stock mod-off HUD/control baseline. That baseline, mission-exit cleanup, next-mission prepress absence/reappearance and final rollback remain pending. No game/editor action was performed for this documentation correction.


## Lifecycle follow-up — 2026-09-27T05:18:35.994183+00:00

The user reports all three requested checks passed: marker disappeared on returning to the main menu; it was absent before F8 in a new Instant Action mission; one F8 press displayed it again. Classification: **USER_REPORTED_LIFECYCLE_CHECKS_PASSED**, alongside the separately screenshot-observed static output/restart results. No new screenshot or timing measurement accompanies these three checks. Do not retain these checks as pending in current handoffs; their direct visual capture remains unavailable. Formal stock mod-off HUD/control baseline and final rollback remain pending and are not implied by this report.

Next: prepare the separately reviewed Phase B component snapshot described in the morning plan and shipping diagnostic options. It should inspect existing components on the identified controller Self, show controller/class/level/locality and exact component class/object paths, and explicitly display completeness/truncation and exact probe-class match count. No component creation, factory call, activation repair or original observer edit. Preserve this tested Phase A package and the original observer. Authoring is a separate editor step; exit the retail game before reopening the editor because concurrent editor operation was associated with the audio issue. No Phase B asset edit, package, deployment or runtime result is claimed.
