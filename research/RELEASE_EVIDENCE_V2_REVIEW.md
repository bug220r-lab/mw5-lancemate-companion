# Release evidence v2 independent review

Date: 2026-09-22. **OBSERVED: 53/53 independent offline validator tests PASS.** This is a review of supplied-evidence validation, not release acceptance. Game, editor, microphone, speaker, native-control and model execution in this review: **NOT_PERFORMED**.

The reviewer owns only [benchmark-review.test.mjs](../companion/tests/benchmark-review.test.mjs) and this report. The implementation, original tests, synthetic fixture and protocol were maintained by other task owners. The review read [FULL_MOD_DELIVERY.md](../design/FULL_MOD_DELIVERY.md), [TACTICAL_EVALUATION_PROTOCOL.md](../design/TACTICAL_EVALUATION_PROTOCOL.md), the validator and the preserved v1 gap receipt. No implementation changes were made by this reviewer.

## Observed result and method

Executed from the project root:

```text
node --test companion/tests/benchmark-review.test.mjs
tests 53; pass 53; fail 0; cancelled 0; skipped 0; todo 0
```

The first independent execution passed all 52 initial cases. One additional case explicitly combined the short-duration and missing-repeat-link conditions from the v1 receipt; the final run passed all 53. There was no reviewer-observed v2 test failure to conceal or repair. Several cases contain multiple independent mutations, including each of the five required exercise kinds. Counts above are the test runner's case counts, not a count of individual assertions. The review did not rerun the whole project suite. The implementation author's separate 40/40 result is not included in the independent 53.

The tests construct their own complete envelope in memory, including 108 comparison rows, 100 recordings, held-out style decisions, one endurance session and a distinct offline repeat. `GAME_OBSERVED` labels in those fabricated objects only exercise validator branches. Those objects are never saved as observation receipts. A separate test reads the repository fixture and verifies version 2, nonempty evidence collections, every row's `MOCK_ONLY` provenance, and rejection of release acceptance.

| Independent coverage | Cases | Result |
|---|---:|---|
| Version, empty/malformed envelopes, human-review caveats and stored fixture provenance | 4 | PASS |
| Mandatory ambiguity annotation, nonempty coverage, withholding, guessed-correct dispatch, accuracy and mixed failure/missing evidence | 6 | PASS |
| Endurance and offline summaries: workload hash, all five exercises, exact kinds, descriptions/references, statuses, duration, three-AI stability, failure counts and resource minima | 22 | PASS |
| Offline source qualification, missing/duplicate/self/reused identities, workload/configuration/provenance matching, source failure/incompleteness, shared evidence documents and offline flags | 14 | PASS |
| Existing count, accuracy, percentile, latency, style, gameplay and storage boundaries | 6 | PASS |
| Determinism and nonmutation | 1 | PASS |

## Acceptance challenges

- An ambiguous dispatch with `intentCorrect`, `recipientCorrect` and `dispatchRecipientCorrect` all true fails. One withheld ambiguous example supplies the required presence without an invented quota. Zero annotated ambiguous examples is incomplete. Withholding does not waive the 95% joint correctness requirement.
- Both endurance and offline rows require every exercise: `conversation`, `pause_resume`, `mech_swap`, `mission_transition`, and `component_failure`. Removing any kind, repeating a kind, supplying an unknown kind, omitting its description/reference, or reporting `NOT_PERFORMED` prevents acceptance. Every well-formed explicit `FAIL` fails. Missing evidence plus a known failure remains `INCOMPLETE` and retains the failure in `failures[]`, preserving the established status precedence.
- Offline flags alone are insufficient. The repeat needs its own complete 60-minute, three-AI, resource and exercise record, and exactly one qualifying source session. A missing, duplicate, self-referential, incomplete, failed or mismatched source cannot qualify it. Reusing any endurance session ID as the offline ID or duplicating an offline ID is rejected.
- Source eligibility is checked individually. An unrelated failed endurance row leaves the linked valid row eligible for the offline gate, while the endurance gate and whole release still fail. This avoids confusing aggregate status with the validity of the particular referenced source.
- Matching mock source/repeat rows remain `MOCK_ONLY`; changing only one side to an observed label is incomplete. Unknown provenance cannot qualify either side. Distinct repeats may reference the same valid source, and summaries may share an evidence document; neither is an invented failure condition.
- Existing numerical boundaries remain in effect: 108 matched comparison records; 10% median-efficiency improvement and at most 10% p95 frame-time overhead; 100 distinct recordings and 95% joint correctness; nearest-rank 1,500 ms transcription p95; 4,000 ms conversational first-audio threshold; 40 held-out decisions with 80% acceptance; 60-minute endurance/repeat duration; 2 GiB RAM and 1 GiB VRAM minima; 10 GiB storage reserve including simultaneous download, staging and cache allocations. Tests reject values just outside the selected exact boundaries and malformed numeric substitutes. The existing implementation suite retains the broader aggregation regressions.

No actionable implementation defect was found in this reviewed revision.

## Preserved v1 finding is separate evidence

The root task executed and preserved [RELEASE_EVIDENCE_V1_GAP.json](RELEASE_EVIDENCE_V1_GAP.json), classified `MOCK_ONLY`. It records four fabricated v1 inputs that incorrectly reached supplied-evidence `PASS`: missing exercise/repeat evidence, ambiguous dispatch, an ignored failed exercise, and a short unlinked offline run. This reviewer inspected that receipt but did not rerun the old implementation. Those are root-observed v1 gaps, not failed cases from the independent v2 run.

The independent v2 cases cover those conditions using newly constructed objects. Missing evidence is incomplete; a well-formed ambiguous dispatch or failed exercise fails; a short unlinked repeat cannot pass and retains both the missing-link issue and duration failure. Version 1 itself cannot pass the version 2 envelope check. Historical v1 records are not silently populated with invented evidence.

## Reviewed artifact identity

SHA-256 values read after the independent run:

| Artifact | SHA-256 |
|---|---|
| `companion/benchmark.mjs` | `fc4ccb3bd67a57e1358daddda026e63db3e13b80b22d01c0c2fa0a5e4461c05f` |
| `companion/tests/benchmark.test.mjs` | `d3dda67c58e484636d1f3db6e812915a3682b6bdd78b4755d82a8baeacfbf496` |
| `companion/tests/benchmark-review.test.mjs` | `037d134a0869917057212290f00613c405e499bf6935daf4e862bf4b86dffdbf` |
| `synthetic/release-benchmark.json` | `b1198e0463fb3a73f21c39b3fedfb37cb2acf186214f9283814035b3ca5fe1be` |
| Root's preserved `research/RELEASE_EVIDENCE_V1_GAP.json` | `e4d8aaaeffd0db34ffb53a3ae42116875a503a88390152e498a2500b75097d8d` |

## Limits

The checker validates supplied structure, arithmetic and declared relationships. It does not authenticate references, recompute manifests, inspect descriptions semantically, establish distinct physical captures, prove representative ambiguity coverage or prove that an exercise occurred. Nonempty descriptions and matching hashes are reviewable claims, not measurements. Shared evidence references are intentional and require inspection of their contents and capture identities.

The protocol correctly treats the three roles as active subject to yielding during pause, possession and planned faults; it does not require uninterrupted control writes. This schema review cannot establish that yielding or restoration actually works. No native writer inventory, restoration proof, adapter ownership, observed game behavior, actual endurance capacity or real offline repeat is established here. Those acceptance results remain **NOT_PERFORMED**.
