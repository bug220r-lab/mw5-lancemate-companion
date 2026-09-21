# Independent tactical-policy review

Classification: **MOCK_ONLY**. Gameplay/native control: **NOT_PERFORMED**. Generated 2026-09-21T04:06:51.889Z.

Result: **FAIL — counterexamples require correction**; 16/26 independent adversarial cases pass.

The reviewer separately specified fixtures from the human-precedence, identity, knowledge and feasibility requirements in design/OFFLINE_TACTICAL_PROTOTYPE.md and the approved plan. The existing 48-case suite was read for coverage gaps; its fixtures and expected branches were not imported. Tests execute only the project-owned pure Node policy. No MW5 processes, native calls, listeners or paid APIs are used.

These tests check forbidden initiative, order continuity, freshness, ambiguity, explicit geometry evidence, complementary reservations and determinism. They do not model weapon damage, establish real telemetry quality or prove better tactical play. Previous-state inputs are the policy's own returned state.

| Artifact | SHA-256 |
|---|---|
| scripts/tactical-policy.mjs | 6790c77d034ef5fdaa8fd205e3c122d4eb9265919d0ea3dadb55aa2c421b3828 |
| scripts/Review-TacticalPolicy.mjs | 9a453fda93c7da5f6e182addc34c553c7275e5ea51c401e5ace662b0714c822b |
| design/OFFLINE_TACTICAL_PROTOTYPE.md | cf1a6af016cbeff57272fe9d8f82184b189008425d7a32db4a5dc3c094e5f421 |

| Case | Requirement | Result |
|---|---|---|
| IR01 | Different member IDs cannot claim the same live pawn | FAIL |
| IR02 | Different member IDs cannot claim the same live controller | FAIL |
| IR03 | An AI recipient cannot simultaneously be the verified player leader pawn | FAIL |
| IR04 | Persistent human order cannot be downgraded and released by completion | FAIL |
| IR05 | Disappearing member does not erase its unresolved human order | FAIL |
| IR06 | Conflicting clear-fire observations cannot grant a firing opportunity | FAIL |
| IR07 | Conflicting feasibility for one candidate cannot authorize repositioning | FAIL |
| IR08 | Conflicting distance for one target cannot establish useful range | FAIL |
| IR09 | No current visibility means no focus or firing-position initiative | PASS |
| IR10 | A future target observation cannot create an engagement | PASS |
| IR11 | A fresh world frame does not refresh an old contact by inference | PASS |
| IR12 | Unknown known-to-lance status remains unknown | PASS |
| IR13 | Time and repeated missing-order observations never release a human hold | PASS |
| IR14 | Release of superseded order cannot release the current human order | PASS |
| IR15 | Human possession and return do not erase a persistent order | PASS |
| IR16 | A human order observed during binding change remains held afterward | FAIL |
| IR17 | A observed human order during global pause is not silently forgotten | FAIL |
| IR18 | Repeated sequence returns only defer and retains human hold | PASS |
| IR19 | A candidate outside the declared weapon envelope cannot repair range | PASS |
| IR20 | Unavailable reposition capability forbids an otherwise useful destination | PASS |
| IR21 | Safer retreat still requires explicit path and occupancy evidence | PASS |
| IR22 | Three members reserve distinct supplied positions in deterministic order | PASS |
| IR23 | Hidden enemy tactical attributes cannot influence visible opportunities | PASS |
| IR24 | Input and own returned state stay immutable and deterministic | PASS |
| IR25 | Ambiguous target IDs fail closed even if only one record is visible | PASS |
| IR26 | Persistent order explicitly released permits useful initiative again | PASS |

## Failing counterexamples

- **IR01:** Different member IDs cannot claim the same live pawn. Ambiguous identity allowed: alpha:FOCUS, bravo:FOCUS
- **IR02:** Different member IDs cannot claim the same live controller. Ambiguous identity allowed: alpha:FOCUS, bravo:FOCUS
- **IR03:** An AI recipient cannot simultaneously be the verified player leader pawn. alpha: unexpected FOCUS (KNOWN_USEFUL_FIRING_OPPORTUNITY)
- **IR04:** Persistent human order cannot be downgraded and released by completion. alpha: unexpected FOCUS (KNOWN_USEFUL_FIRING_OPPORTUNITY)
- **IR05:** Disappearing member does not erase its unresolved human order. alpha: unexpected FOCUS (KNOWN_USEFUL_FIRING_OPPORTUNITY)
- **IR06:** Conflicting clear-fire observations cannot grant a firing opportunity. The expression evaluated to a falsy value:    assert(!r.recommendations.some(r => r.action === 'FOCUS')) 
- **IR07:** Conflicting feasibility for one candidate cannot authorize repositioning. The expression evaluated to a falsy value:    assert(!r.recommendations.some(r => r.action === 'REPOSITION')) 
- **IR08:** Conflicting distance for one target cannot establish useful range. The expression evaluated to a falsy value:    assert(!r.recommendations.some(r => r.action === 'FOCUS')) 
- **IR16:** A human order observed during binding change remains held afterward. alpha: unexpected FOCUS (KNOWN_USEFUL_FIRING_OPPORTUNITY)
- **IR17:** A observed human order during global pause is not silently forgotten. alpha: unexpected FOCUS (RETAIN_USEFUL_TARGET)

## Review limits and reproducibility

Run with the existing Node runtime: `node scripts/Review-TacticalPolicy.mjs`. Exit code is 1 on any failed assertion. This file records the latest verified policy hash; a later policy edit requires rerunning it.

Native visibility uses a two-second-history predicate in the source; this prototype instead stipulates current friendly visibility and clear-fire evidence. Candidate positions are supplied, not generated. The policy emits recommendations with dispatchable:false. Independent source review must still validate the evidence index; the policy checks cannot establish those game semantics.
