# Independent tactical-policy review

Classification: **MOCK_ONLY**. Gameplay/native control: **NOT_PERFORMED**. Generated 2026-09-21T04:12:16.511Z.

Result: **PASS — reviewed synthetic constraints hold**; 31/31 independent adversarial cases pass.

The [initial review](TACTICAL_INDEPENDENT_REVIEW_BEFORE_FIX.md) preserved ten failing counterexamples. Root corrected identity ambiguity, persistent-order downgrade, loss of holds across absent/binding/paused frames, and favorable selection from contradictory engagement/candidate observations. The reviewer inspected those corrections and reran the original cases plus follow-up boundary cases; passing results below apply only to the recorded final hash.

The reviewer separately specified fixtures from the human-precedence, identity, knowledge and feasibility requirements in design/OFFLINE_TACTICAL_PROTOTYPE.md and the approved plan. The existing 48-case suite was read for coverage gaps; its fixtures and expected branches were not imported. Tests execute only the project-owned pure Node policy. No MW5 processes, native calls, listeners or paid APIs are used.

These tests check forbidden initiative, order continuity, freshness, ambiguity, explicit geometry evidence, complementary reservations and determinism. They do not model weapon damage, establish real telemetry quality or prove better tactical play. Previous-state inputs are the policy's own returned state.

| Artifact | SHA-256 |
|---|---|
| scripts/tactical-policy.mjs | f0db998754bbb55b867549f635adad5cecd33d435470979b31bf4a08dec2f357 |
| scripts/Review-TacticalPolicy.mjs | e96031c98a3c54f8978dc3b54e9380f25f03b6b56522fa018cbad487457b16b7 |
| design/OFFLINE_TACTICAL_PROTOTYPE.md | 4a268f723fb076281a52c1b63b927ec6b8cf5acc319981d5cbad7c964d3c98ea |

| Case | Requirement | Result |
|---|---|---|
| IR01 | Different member IDs cannot claim the same live pawn | PASS |
| IR02 | Different member IDs cannot claim the same live controller | PASS |
| IR03 | An AI recipient cannot simultaneously be the verified player leader pawn | PASS |
| IR04 | Persistent human order cannot be downgraded and released by completion | PASS |
| IR05 | Disappearing member does not erase its unresolved human order | PASS |
| IR06 | Conflicting clear-fire observations cannot grant a firing opportunity | PASS |
| IR07 | Conflicting feasibility for one candidate cannot authorize repositioning | PASS |
| IR08 | Conflicting distance for one target cannot establish useful range | PASS |
| IR09 | No current visibility means no focus or firing-position initiative | PASS |
| IR10 | A future target observation cannot create an engagement | PASS |
| IR11 | A fresh world frame does not refresh an old contact by inference | PASS |
| IR12 | Unknown known-to-lance status remains unknown | PASS |
| IR13 | Time and repeated missing-order observations never release a human hold | PASS |
| IR14 | Release of superseded order cannot release the current human order | PASS |
| IR15 | Human possession and return do not erase a persistent order | PASS |
| IR16 | A human order observed during binding change remains held afterward | PASS |
| IR17 | An observed human order during global pause is not silently forgotten | PASS |
| IR18 | Repeated sequence returns only defer and retains human hold | PASS |
| IR19 | A candidate outside the declared weapon envelope cannot repair range | PASS |
| IR20 | Unavailable reposition capability forbids an otherwise useful destination | PASS |
| IR21 | Safer retreat still requires explicit path and occupancy evidence | PASS |
| IR22 | Three members reserve distinct supplied positions in deterministic order | PASS |
| IR23 | Hidden enemy tactical attributes cannot influence visible opportunities | PASS |
| IR24 | Input and own returned state stay immutable and deterministic | PASS |
| IR25 | Ambiguous target IDs fail closed even if only one record is visible | PASS |
| IR26 | Persistent order explicitly released permits useful initiative again | PASS |
| IR27 | Reserved JavaScript property identifiers cannot become control identities | PASS |
| IR28 | Freshness limit is explicit and cannot expand with repeated frames | PASS |
| IR29 | A valid human order remains held after an unrelated bad target inventory | PASS |
| IR30 | Human hold survives temporary loss of world control authority | PASS |
| IR31 | Retained history never creates a recommendation for an absent member | PASS |

## Review limits and reproducibility

Run with the existing Node runtime: `node scripts/Review-TacticalPolicy.mjs`. Exit code is 1 on any failed assertion. This file records the latest verified policy hash; a later policy edit requires rerunning it.

Native visibility uses a two-second-history predicate in the source; this prototype instead stipulates current friendly visibility and clear-fire evidence. Candidate positions are supplied, not generated. The policy emits recommendations with dispatchable:false. Independent source review must still validate the evidence index; the policy checks cannot establish those game semantics.
