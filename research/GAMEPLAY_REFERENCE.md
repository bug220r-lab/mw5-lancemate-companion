# Vanilla gameplay reference

Reviewed **2026-09-20** from the [user-supplied MechaDrew Gaming video](https://www.youtube.com/watch?v=LyoH8Nb66ms), Pure Vanilla #1, duration **42:08**. The creator identifies the playthrough as unmodded. Its exact game build, DLC configuration and files were not independently inspected.

**Method:** sampled gameplay visually in the browser, including brief playback and paused frames, and read the exported English auto-captions. This was not a continuous viewing of all 42 minutes or an audio-quality evaluation. Captions can mistranscribe words and mix creator commentary with game dialogue. Specific on-screen portraits, menus and HUD elements were used where available to distinguish them. The browser's seek-slider value sometimes lagged; notes use the settled visible player time and corresponding footage.

## Observations from the footage

| Sample | Visible evidence / caption context |
|---|---|
| [4:12](https://www.youtube.com/watch?v=LyoH8Nb66ms&t=252s) | Commando loadout screen separates equipment, armor, weight and inventory. Nearby commentary discusses survivability tradeoffs. |
| [10:02–11:37](https://www.youtube.com/watch?v=LyoH8Nb66ms&t=602s) | Cockpit HUD shows three selectable lancemates, group selection, weapon ranges/cooldowns, target details, damage, minimap and garrison objectives. Ryana's portrait appears during a mission warning. |
| [23:29](https://www.youtube.com/watch?v=LyoH8Nb66ms&t=1409s) | McCleary's portrait accompanies an engagement refusal, corroborated by captions. The underlying failure condition is not established. |
| [24:52 onward](https://www.youtube.com/watch?v=LyoH8Nb66ms&t=1492s) | Withdrawal toward the marked pickup zone and dropship; captions include a formation response. This is not a measured individual-pawn follow test. |
| [32:53–32:58](https://www.youtube.com/watch?v=LyoH8Nb66ms&t=1973s) | Whole-lance order menu offers attack, formation, movement and fire control; a movement refusal follows on screen. |
| [35:13](https://www.youtube.com/watch?v=LyoH8Nb66ms&t=2113s) | Selected Blackjack, lance order indicators and captioned engagement acknowledgement. This establishes UI feedback, not machine-readable acceptance. |
| [40:51](https://www.youtube.com/watch?v=LyoH8Nb66ms&t=2451s) | Repair work order compares local penalties with travel expense and time. |

## Implications for our proposed companion

These are **design inferences**, not newly discovered native APIs:

1. **Preserve the selection/order distinction.** The same function-key row serves different contexts. Our adapter must bind one specific AI, and a future input fallback would need verified UI context. Blind key sequences cannot establish who received an order.
2. **Keep failure messages useful.** When a native action is refused, report the refusal and a useful next choice. Do not invent a terrain/range/pathfinding diagnosis or imply the pilot chose to disobey. Attitude should not obscure command status.
3. **Use radio time sparingly.** Existing mission and target feedback already occupy the player's attention. Optional personality should add a relevant observation, not repeat every target acquisition or internal request stage. Detecting native radio activity in a future runtime remains unresolved.
4. **Separate tactical control from continuous piloting.** The proposed companion can select a supported high-level intention while the existing AI handles immediate movement and weapons. The visible range/cooldown/damage workload reinforces that division; it does not prove our adapter can read those fields.
5. **Give downtime a useful role.** Conditional loadout discussion, repair-versus-travel comparisons and post-mission reflection suit the persona. Advice must use supplied or verified equipment/cost information. Do not turn the creator's choices into universal optimal-build rules or the user's campaign memories.
6. **Respect withdrawal.** An explicit regroup/extraction decision must not be overwritten by opportunistic target chasing. This adds a useful later scenario; it does not expand the first proof's allowlist.

The [pilot behavior sheet](../design/PILOT_BEHAVIOR.md) incorporates these communication lessons. The [editor worksheet](../design/EDITOR_INSPECTION.md) now points to the concrete menu example. Native signatures, actor lifetime/authority, transport, readback and manual-override signals still require source inspection. No game/editor was launched or controlled for this viewing task; only the video player was operated.
