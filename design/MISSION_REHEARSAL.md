# Mission rehearsal: an expensive exit

**Original fictional scene · authored 2026-09-20 · no game, audio or runtime execution**

Read this as a short radio script. Every **Native radio**, **Player** and **Companion** line below is an original fictional substitute, including the briefing and acknowledgements. None is quoted from MW5 or the reference video. All mission events, observations and costs are invented. The companion follows the proposed female mercenary persona; her callsign, biography and voice remain unset.

The clock covers a **six-minute mission**, then a repair conversation through **07:30**. Timestamps and speech windows are author estimates. Quiet gaps are intentional. Bracketed directions describe the fiction and are not spoken.

## The scene

**00:00 — Approach** · MR-001–002

**Native radio:** “Two relay units are marked. Disable them, then reach the pickup beacon. Keep the approach clear.”

*[The briefing occupies the channel through 00:10. She lets it finish. No quip is held for later.]*

**00:24 — A request, then evidence** · MR-003–009

**Player:** “Form on me.”

*[Your request has been heard. There is no confirmation yet.]*

**00:26.2 — Companion:** “Heard you.”

*[Her follow order is confirmed just before the native radio responds.]*

**00:28 — Native radio:** “Regroup order received.”

*[She does not repeat the acknowledgement or announce movement over it.]*

**00:35 — Player:** “Are you coming back?”

*[Her mech is now closing the distance.]*

**00:39 — Companion:** “Closing the distance.”

*[The channel stays quiet while the approach continues.]*

**01:40 — The move that does not happen** · MR-010–014

**Player:** “I'm marking a position for you.”

*[You select her mech and place the marker using the ordinary squad controls. From here, you handle the orders yourself.]*

**01:46 — Native radio:** “Move request denied.”

**01:51 — Player:** “What stopped that move?”

**01:55 — Companion:** “The move was refused. I can't tell why.”

*[No reason is given for the refusal. She leaves the next move to you.]*

**02:10 — Room for the existing radio** · MR-015–016

**Native radio:** “Additional contacts approaching from the west. Keep the pickup route clear.”

*[The native line occupies the channel through 02:17. Optional commentary is dropped.]*

**02:30 — Damage** · MR-017–018

**Companion:** “Left arm critical.”

*[The warning concerns her mech's left-arm component. Five seconds later, the same warning repeats without worsening. She lets it pass in silence.]*

**03:10 — A decision changes mid-sentence** · MR-019–026

*[A short lull: no immediate incoming danger or worsening damage is supplied between 03:10 and 03:18. The damaged arm has not repaired itself.]*

**Player:** “Anything worth chasing?”

**03:16 — Companion:** “If you're shopping for trouble—”

**03:18 — Player:** “Stop. We're withdrawing. No more target suggestions.”

*[She stops as you cut in. The rest of the quip is abandoned. You have the channel through 03:23.]*

**03:24 — Player:** “Regrouping the lance. Heading for pickup.”

*[You issue the regroup order through the ordinary squad controls.]*

**03:30 — Native radio:** “Lance regroup acknowledged.”

**03:36 — Companion:** “Withdrawal understood. No more target suggestions.”

*[She keeps the channel clear while you lead the withdrawal.]*

**04:10 — An unresolved report** · MR-027–029

*[Two fresh reports disagree about another pilot: one says ejected, the other still piloting. Neither source settles it.]*

**04:14 — Player:** “Did our other pilot eject?”

**04:19 — Companion:** “Conflicting reports. I can't confirm an ejection.”

*[The pilot's status remains unresolved.]*

**04:52 — Stay with the withdrawal** · MR-030–034

**Native radio:** “Pickup corridor is open. Keep moving toward the beacon.”

*[At 05:10, another possible target offers a detour. She stays quiet. You already made the call.]*

**05:42 — Native radio:** “Extraction complete. You're clear of the combat zone.”

*[You are clear of the fight. The other pilot's status is still unresolved. The mission clock ends at 06:00.]*

**06:30 — Repairs** · MR-035–039

**Player:** “Local repairs: one hundred eighty thousand C-bills, four days. At the hub: one hundred thousand, two days. Round-trip travel adds sixty thousand and twelve days. Which would you choose?”

*[You finish reading out the quotes by 06:47.]*

**06:50 — Companion:** “On your figures, the hub saves twenty thousand C-bills but takes ten extra days, before unlisted costs. I'd stay if time matters. Otherwise, the hub is cheaper. Quite a holiday for a repair bill. Your call.”

**07:14 — Player:** “Local repairs, then. I'll approve them myself.”

**07:21 — Companion:** “Your call. I'll spare you the invoice commentary.”

*[Quiet through 07:30.]*

## Evidence and review criteria

The [structured scene](../synthetic/mission-rehearsal.json) contains all **39 beats**, their supplied evidence, unknowns, speech decisions, proposed duration, and **11 separate review criteria**. It is an authored semantic fixture, not an executable simulation or a native event schema. Every action and memory-write list is empty. Its stage directions are story inputs, not results from the command-contract exercise.

The intended checks are:

- **MRC-01 / whole scene:** explicit fictional authorship; no real API, game or memory result is asserted.
- **MRC-02 / MR-003–009:** request acknowledgement, native acceptance and observed approach have distinct evidence. Never infer the latter stages from dispatch.
- **MRC-03 / MR-010–014:** a confirmed native refusal permits a refusal statement; its cause stays unknown. The move is a fictional human native action.
- **MRC-04 / MR-001–002, 006–007, 015–016:** optional companion speech yields to the declared native-radio windows and is discarded rather than deferred.
- **MRC-05 / MR-017–018:** one concise damage warning, then silence for unchanged duplicate evidence.
- **MRC-06 / MR-020–026:** stop at the player's interruption, discard the canceled remainder, respect withdrawal, and never silently rearm.
- **MRC-07 / MR-027–029:** conflicting reports about one other actor do not become a confirmed ejection, survival claim, joke or memory.
- **MRC-08 / MR-030–034:** withdrawal outranks a target detour; mission invalidation leaves no queued action. Human whole-lance regroup does not expand the project allowlist.
- **MRC-09 / MR-035–038:** repair advice is conditional on supplied figures, preserves unknown costs, and leaves the transaction to the human.
- **MRC-10–11 / whole scene:** restrained persona and no planned companion speech over player/native lines. Check wording and decisions as properties; do not require these exact sentences.

The repair arithmetic is **local: 180,000 C-bills / 4 days**; **hub: 100,000 + 60,000 = 160,000 C-bills / 2 + 12 = 14 days**. On the stated sequential-time assumption, the hub saves **20,000 C-bills** and adds **10 days**. Maintenance, deadlines, missed work and other charges remain unknown.

Speech windows use a proposed 150 words/minute plus at least half a second of ending allowance. MR-020 intentionally stops after a five-word prefix at 03:18; it has no normal ending allowance. The JSON records PTT windows and native-radio holds. These are timing estimates for later audition, not measured speaking speed, interruption latency or an implemented radio detector.

## Source pins and acceptance worksheet

Prepared against the unchanged [pilot profile](PILOT_BEHAVIOR.md), profile `mw5lc.pilot.edgy-female.v0.1`, version **0.1.0**. Source hashes identify the exact documents used:

| Document | SHA256 |
|---|---|
| [PILOT_BEHAVIOR.md](PILOT_BEHAVIOR.md) | `01C9A95BD0D4A192930B0D1D5F08B1550AF5B3723BF03F85F957AEFC440EDEA0` |
| [GAMEPLAY_REFERENCE.md](../research/GAMEPLAY_REFERENCE.md), implications 2, 3, 5 and 6 | `5DD8B6A90249AFB9295CA178C5602524F48B6AEB985998DE5668DD06CEBED35F` |
| [COMMAND_CONTRACT.md](COMMAND_CONTRACT.md), proposed message rules and invariants 1–2, 6, 8 | `F4B4EDA51A4FE25C6FC40F40D169FAF69508D2D8981C288E5E2C39AFEAC59863` |

The gameplay reference motivates refusal clarity, radio restraint, withdrawal and downtime discussion. It supplies no dialogue or events in this story. The command contract permits only proposed `FORM_ON_PLAYER`; the human's fictional native movement and whole-lance inputs do not enlarge that project allowlist.

| Review | Status at authoring | Evidence to record later |
|---|---|---|
| JSON structure, unique IDs, order, duration estimates, word budgets and arithmetic | AUTHOR_CHECKS_MET | 39 beats; 26 matching spoken lines; 205 words; no planned speech overlap; native holds and source hashes match. Independent review pins the final input hashes separately |
| Independent semantic review | NOT_PERFORMED | Reviewer, criterion IDs, findings and exact input hashes |
| User preference for persona and scene | NOT_PERFORMED | Requested changes or explicit acceptance |
| Audio timing, pronunciation and interruption | NOT_PERFORMED | Separate authorized audition and measured results |
| Native APIs, actual event acquisition and shipping-game behavior | NOT_PERFORMED | Separate source-inspection and authorized live-proof evidence |

Creating or reviewing this script does not pass the editor, bridge, audio or live-game gates. A future reading can change the dialogue without treating any invented mission fact as the user's campaign history.
