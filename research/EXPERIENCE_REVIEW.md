# Experience review

**MEETS_CRITERIA for these exact static artifacts.** Reviewed 2026-09-20 by assistant agent `/root/bridge_research`, separate from the scene and audition authors within the same task. This is a semantic review of authored text and plans, supported by local parsing, word counts and arithmetic. It is not an executed companion, model evaluation, audio audition or player-preference result.

The [connected scene](../design/MISSION_REHEARSAL.md) has 39 beats and 26 spoken lines: 205 words across all speakers, including nine companion lines totaling 78 words. All **11 scene criteria** meet the profile. The [personality audition](../design/PERSONALITY_AUDITION.md) has **18 alternatives across six shared contexts**; every alternative meets its evidence and word limits. The [character options](../design/CHARACTER_OPTIONS.md) remain unselected. The [JSON report](EXPERIENCE_REVIEW.json) records individual decisions and word counts, mapped beat IDs, complete source hashes and limitations.

## What the scene establishes on paper

| Evidence | Review |
|---|---|
| MR-003–009: request, dispatch, native order evidence, then separately observed approach | “Heard you” promises no success. “Closing the distance” has its own fictional observation. Neither line claims arrival or actual integration. |
| MR-010–014: human native move and confirmed refusal | The eight-word reply gives the refusal and unknown cause. It invents no terrain, range, navigation or pilot-motive diagnosis, retained-order state or retry. |
| MR-001–002, 006–007, 015–016: occupied native radio | The competing companion lines are empty. Their directions discard commentary rather than hold it for a delayed burst. Occupancy is an author stipulation, not an implemented detector. |
| MR-017–018: critical mech-arm damage and an unchanged repeat | One three-word warning, then silence five seconds later. No joke, pilot injury, component destruction or automatic maneuver is added. |
| MR-019–026 and 031: interruption and withdrawal | PTT ends the prefix and discards its remainder. A later reply acknowledges the conversational boundary after the user and native feedback finish. The later optional target gets silence; companion control remains disarmed. |
| MR-027–029 and 032: two fresh reports disagree | Neither a newer timestamp nor extraction resolves the other pilot's status. The reply names the conflict without humor or a casualty/survival fact. |
| MR-035–038: repair-versus-travel conversation | On the invented quotes, the hub totals 160,000 C-bills and 14 days versus 180,000 and four days locally: 20,000 saved for ten extra days. Unknown costs remain explicit, and the human makes the choice. No transaction or repair outcome is asserted. |

One issue was resolved before the final source pin. The original MR-019/020 context did not explain why a quip followed a critical-damage warning. The parent flagged this and the reviewer concurred. The final JSON and reader explicitly provide a **190–198 second lull with no immediate incoming danger or new worsening**, while the arm remains damaged. The clarification permits restrained invited humor without inventing repairs.

Every human native movement or whole-lance order remains separate from the proposed single-AI `FORM_ON_PLAYER` action. All scene runtime-action and memory-write lists are empty. The final reader's simpler stage directions preserve the dialogue, event order and evidence boundaries.

## The three personality directions

All 18 alternatives were read, not inferred from their rationales. Their independently counted words match the author counts; the longest is 21 words, within its 90-word downtime limit.

| Context | Assessment of A / B / C |
|---|---|
| PA-001: critical component damage | All deliberately converge on the same six-word warning. That restraint is appropriate, rather than a missing style distinction. |
| PA-002: uncertain casualty | All use the same sober eleven-word reply. None invents an identity, death, survival or reassurance. |
| PA-003: unconfirmed follow attempt | The styles range from understated uncertainty to a sharper objection to false confidence. All preserve unknown acceptance and movement; none invents a cause or retry. |
| PA-004: reported heat problem | Each requests the missing loadout and proposes the same general cooling/fire review. B's furnace is a downtime metaphor about the report, not a claim that equipment was inspected. |
| PA-005: contract choice | Each asks for terms and likely opposition. The wit challenges the attraction of risk; it does not fabricate terms, insult the user or choose a contract. |
| PA-006: the user chooses differently | Each ends the disagreement and respects the choice. Sarcasm targets the objection itself; confrontation supplies no extra authority. |

Six callsign suggestions, three alternative origins and three text-only delivery briefs are clearly optional. No name, biography, voice identity, performer, clone, provider or runtime model is selected. The six common reading lines have distinct invented contexts and are not one continuous message. Fictional expertise never substitutes for missing evidence.

## Focused supplemental cases

The new [supplemental fixture](../synthetic/pilot-radio-supplemental-cases.json) adds exactly four cases tied to actual scene beats:

| Case | Scene mapping | Added focus |
|---|---|---|
| PRS-001 | MR-011–014 | Confirmed refusal with an unknown cause; no retry or invented diagnosis. |
| PRS-002 | MR-001–002, 006–007, 015–016 | Optional speech yields to native radio and is discarded. |
| PRS-003 | MR-011, 019–026, 031 | Interrupted reply, manual withdrawal precedence, persistent disarming and no later target suggestion. |
| PRS-004 | MR-027–029, 032–033 | Two fresh same-pilot reports remain unresolved through extraction. |

These expectations were written **after reading the scene**, by its separate reviewer. They are useful regression criteria, not held-out tests. The source fixture retains `NOT_PERFORMED`; the report separately records that the pinned scene's text meets those properties. No case runner or new response generator was built.

The original 16-case fixture, candidates and earlier reports were not edited by this reviewer. Mute/echo/pause cases were not duplicated merely to increase the count.

## What was checked, and what remains untested

Local checks parsed the JSON, verified byte hashes and mapped IDs, recounted the actual utterances, and compared the proposed windows. All counts match, all spoken companion lines fit their budgets, all duration arithmetic is consistent, and the three native-radio holds match their declared endpoints.

The 150-word/minute assumption and half-second allowance are **author estimates**. MR-020 explicitly has no normal ending allowance because its five-word prefix stops at 198 seconds. Checking half-open intervals `[start,end)` finds no planned companion overlap; it says nothing about real speech length or stopping latency.

The scene stays unmuted. The profile and audition consistently give mute and user speech precedence, but no mute/unmute transition is enacted here. No actual microphone, PTT, audio queue, echo suppression, native-radio detector, game binding, command acceptance, actor movement or campaign persistence was tested. No runtime model produced these lines. Exact cooldown boundaries, timing races and behavior outside this particular script remain untested.

User enjoyment, selected personality, callsign, biography and vocal delivery remain **NOT_PERFORMED / UNSELECTED**. The parent-owned reader-preview browser checks are separate from this semantic review.

## Exact input pins

SHA256 is over file bytes; any source edit requires a new review pin. Full pins for all ten inputs are also in the machine-readable report.

| Input | SHA256 |
|---|---|
| [mission-rehearsal.json](../synthetic/mission-rehearsal.json) | `DAC44F916017FDF0A8732AE95C75AA1D713BF5506C51E2AA300621379B03E733` |
| [MISSION_REHEARSAL.md](../design/MISSION_REHEARSAL.md) | `4304BAD474DC8A74F231AC9402749A1D0F85F11C8220A307C369249D17836699` |
| [personality-audition.json](../synthetic/personality-audition.json) | `C4894C5CCA7499600211A23F5D4930EE546AF7CB8850F38C6AD1DCC1A44C340A` |
| [PERSONALITY_AUDITION.md](../design/PERSONALITY_AUDITION.md) | `B16CF37B2799E3F7F6BEE7F16B20A32A033C6E8B8EAAACD4F73673A32744AD81` |
| [CHARACTER_OPTIONS.md](../design/CHARACTER_OPTIONS.md) | `4FFCB873327D007186F279EFC1FFA47FA2F6ED59C13AB4959F2852897EEAB238` |
| [PILOT_BEHAVIOR.md](../design/PILOT_BEHAVIOR.md) | `01C9A95BD0D4A192930B0D1D5F08B1550AF5B3723BF03F85F957AEFC440EDEA0` |
| [GAMEPLAY_REFERENCE.md](GAMEPLAY_REFERENCE.md) | `5DD8B6A90249AFB9295CA178C5602524F48B6AEB985998DE5668DD06CEBED35F` |
| [COMMAND_CONTRACT.md](../design/COMMAND_CONTRACT.md) | `F4B4EDA51A4FE25C6FC40F40D169FAF69508D2D8981C288E5E2C39AFEAC59863` |
| [pilot-radio-cases.json](../synthetic/pilot-radio-cases.json) | `A3263912313EB48815DE67AC844BA6483E2B5FAFA6FF16390F865AF073B2D09D` |
| [pilot-radio-supplemental-cases.json](../synthetic/pilot-radio-supplemental-cases.json) | `91A275F13E49227E5FFB0CF901712865A02CACEEACDFC973B280225EF16177AA` |

**Native actions: 0. Audio generated: 0. External model/API calls: 0. Real memory writes: 0.** Only the supplemental fixture and these two review files were written by this reviewer.
