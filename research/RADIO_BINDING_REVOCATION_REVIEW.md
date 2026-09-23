# Radio permission after uncertain or denied ownership

Reviewed September 23, 2026 UTC. This is an offline project-component correction. No model, audio, microphone, editor query or game action is part of its validation.

## Reproduced problem

At Git commit `e91ae91644e79fc92f2a468ea056e5a53dc51ae7`, `companion/radio.mjs` was 23,093 bytes, SHA-256 `def9b360ad28b62f6115cd64b140a1e05eefa9e7ee944c4ad0003e956428e95d`. Root exercised that module with a synthetic mission, three valid AI bindings and one queued answer for `edge / pawn-1 / generation 1`. The line had no fact dependencies and remained within its time limit.

A fresh update for the same actor, pawn and generation with `aiOwned: false` returned `GENERATION_MUST_ADVANCE`. The same update with `aiOwned: null` returned `INVALID_BINDING_UPDATE`. In **both actual offline runs**, the subsequent `next()` still returned the old answer. Rejecting the update had left the earlier permission to speak intact. These observations demonstrate a component defect, not a wrong-speaker event observed in MW5.

The delivery contract requires possession to revoke companion control and speaker identity to be revalidated before playback. The conversation coordinator already conservatively revokes generation when current ownership/liveness becomes unknown. The radio scheduler also needs to withdraw stale speech permission when a coherent current-pawn update contradicts its last verified state.

## Bounded correction

The change is limited to the radio scheduler and its behavior tests. A fresh coherent denial or unknown ownership/liveness for a known actor and its current pawn revokes that actor's speech without granting the rejected state any positive authority. Recovery requires a valid generation beyond the recorded revocation floor. Stale, old-generation, foreign-mission or foreign-pawn updates cannot revoke a newer binding. General malformed observations still require caller-level context invalidation; this correction is not a native observation adapter.

Linked radio exchanges are cancelled when a participant is revoked, including an opener that already finished. Unrelated pilots' answers remain eligible. The limits on mission identity, timestamps, queue size and fact lifetime remain in place.

## Verification

The implementation's focused run passed **59/59 MOCK_ONLY cases**, comprising 46 existing radio cases and 13 new behavior cases. A separate reviewer added and passed **12/12 independent cases** on the same frozen radio source. Root reviewed the production diff and the independent results. No actionable defect remained in this bounded change.

The cases cover queued and active speech, all three pilots, possession/death/unknown values, high-generation revocation and recovery, stale/future/foreign updates, duplicate-slot rejection, getter side effects, linked exchanges at different stages, mission reset and unaffected teammates. They assert externally visible scheduling outcomes. The independent reviewer did not claim to have run its new cases on the old source; root's two pre-fix reproductions above are the observed baseline failures.

The [complete offline receipt](COMPANION_VALIDATION.json), recorded **2026-09-23T03:00:00.043Z**, passed **1,205/1,205 tests**, zero failures/skips, with concurrency **1** in **32.620 seconds**. Root verified all **109 recorded source hashes** and the complete test-log hash. Historical tactical scenarios and prior tests remain included. These are **MOCK_ONLY** results: no game integration, native playback cancellation or end-to-end override latency is established.

| Frozen source | SHA-256 |
|---|---|
| [Radio scheduler](../companion/radio.mjs) | `c8d630eafa6eabea0e219da0372401bd7ad6be13e5aa76b7c4a4a5416c62e825` |
| [Implementation cases](../companion/tests/radio-binding-invalidation.test.mjs) | `ec5d5620ae1df66aeee97409eb15d2b76242d54fdcc700c53428447ebddfe9c7` |
| [Independent cases](../companion/tests/radio-binding-review.test.mjs) | `53d6894fa736113f3a1d108f672494a404cb77178395ef288bd4f467a7444455` |
| [Complete-suite verifier](../scripts/Verify-Companion.mjs) | `bf9ff3f255e876a40bbb64ee7a87cb6e0991933625533f133036962c538ac559` |

The complete-suite verifier now accepts optional `MW5_TEST_CONCURRENCY=1` through `4` and records the selected concurrency in its receipt. An unset variable retains Node's default. This changes only worker scheduling, allowing the same complete offline suite to run with fewer workers while the user has the editor open. Test selection and the existing timeout are unchanged.
