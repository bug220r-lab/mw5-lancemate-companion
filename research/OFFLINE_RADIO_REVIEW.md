# Offline radio candidate review

**2026-09-20 — 16/16 static candidates MEET_CRITERIA.** No actionable revisions or unresolved disagreements were found. This grades exact text and proposed delivery decisions, not runtime, audio, game control or player preference.

The [candidates](../synthetic/pilot-radio-candidates.json) were manually drafted by assistant agent `/root/mod_research`. Separate agent `/root/voice_runtime_research` read the profile/fixtures and defined checks before receiving them. This is independent-agent review within the same assistant task, not human, blind or held-out evaluation. [Per-case evidence and checks](OFFLINE_RADIO_REVIEW.json) include all utterances, plans and grounding reasons.

## Exact inputs

Profile version **0.1.0**; fixture schema **1.0.0**; candidate revision **0.1.0**. SHA256 values cover file bytes:

| File | SHA256 |
|---|---|
| `synthetic/pilot-radio-cases.json` | `A3263912313EB48815DE67AC844BA6483E2B5FAFA6FF16390F865AF073B2D09D` |
| `synthetic/pilot-radio-candidates.json` | `A76DB60B330ED843AEE667FE4BA422FF4DF68E6942CA2D8FDDCCE0A88587FA6D` |
| `design/PILOT_BEHAVIOR.md` | `01C9A95BD0D4A192930B0D1D5F08B1550AF5B3723BF03F85F957AEFC440EDEA0` |

Candidate source pins match. Inputs remain unchanged; their `NOT_PERFORMED` review fields preserve authoring/handoff status. This separate report records subsequent static review for these hashes.

## Counts and decisions

Count Unicode letter/digit tokens in **utterances only**, retaining internal apostrophes and hyphens as part of a word. Contractions count once; punctuation-only tokens, rationale and plan text are excluded. Exact regex is in the JSON.

All IDs, decisions, speech presence and declared word counts match; all budgets are met. **128 proposed words total; longest candidate 37 words.** Action and memory-write arrays are empty. Priority is the fixture requirement, assessed semantically against the text/plan; candidates have no explicit priority field.

Every row below received **MEETS_CRITERIA**:

| Case | Decision | Words / limit | Priority |
|---|---|---:|---|
| PRC-001 | SPEAK | 3/16 | P2 |
| PRC-002 | SPEAK | 8/16 | P2 |
| PRC-003 | SPEAK | 7/16 | P2 |
| PRC-004 | SPEAK | 4/16 | P2 |
| PRC-005 | SPEAK | 7/16 | P2 |
| PRC-006 | SPEAK | 3/12 | P1 |
| PRC-007 | SILENT | 0/0 | P1 |
| PRC-008 | SILENT | 0/0 | P3 |
| PRC-009 | STOP_THEN_SPEAK | 6/12 | P1 |
| PRC-010 | STOP_AND_REMAIN_SILENT | 0/0 | P0 |
| PRC-011 | SILENT | 0/0 | P0 |
| PRC-012 | SILENT | 0/0 | P0 |
| PRC-013 | SPEAK | 37/90 | P2 |
| PRC-014 | SPEAK | 16/45 | P2 |
| PRC-015 | SILENT | 0/0 | P0 |
| PRC-016 | SPEAK | 37/90 | P2 |

## Useful line examples

Original static text; no audio was generated or played:

| Synthetic situation | Proposed line |
|---|---|
| Request heard only | “I heard you.” |
| Dispatch unconfirmed | “No confirmation yet. I'm not calling it done.” |
| Approach observed, acceptance unknown | “I'm closing the distance.” |
| Newly critical left arm | “Left arm critical.” |
| Casualty uncertain | “I can't confirm a loss. That chatter doesn't identify the pilot or tell us what happened.” |
| Invited quiet contract opinion | “Exciting is fine. Unpaid funerals aren't.” The full candidate then asks for terms/opposition and leaves the choice with the user. |

Receipt, dispatch, native state and observed movement stay distinct. Silence/mute/PTT/stale-state decisions are appropriate; reports and ambiguous chatter never become verified facts. Combat restraint and downtime dry humor fit the proposed persona. The funeral remark is hypothetical, not a campaign casualty. No callsign or history is invented.

The reviewer assessed `delivery_plan` **as text only**. Cancellation, discarding, scheduling and rearming were not executed.

## Limits

- Handwritten candidates target known fixtures; runtime-model behavior and generalization remain **NOT_PERFORMED**.
- Ambiguous casualty chatter is covered; contradictory verified reports need another case.
- Native refusal, native-radio contention and withdrawal/regroup need dedicated cases.
- Cooldown boundaries, races, unmute/PTT-release transitions, actual interruption latency and echo suppression were not executed.
- Voice quality, audible gender presentation, player preference, native field/authority access, command behavior, persistence and packaged-game compatibility remain **NOT_PERFORMED**.

Only the two review files were created. No source edits, game/network/audio actions or persistence operations occurred.
