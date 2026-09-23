# Separated-request diagnostic: independent review commitment

## Pre-output commitment

Prepared 2026-09-22 local time, **before viewing any output from the proposed separated-request native run**. Status: **AWAITING_TERMINAL_RESULT; native inference NOT_PERFORMED by this reviewer.** Do not read a pending native receipt; wait for the supervising task to confirm that its process is terminal. This document starts no run.

The selected treatment separates the player's question from reference data: preserve the reference envelope, source labels, unknowns, unsupported raw facts and generated history; place the exact question plus the existing no-thinking suffix in the final user-role message; narrowly clarify the roles in the system instruction. The intended fixed selector is `--run-separated-request-qwen17b`, with a new exclusive `research/QWEN17B_SEPARATED_REQUEST_DIAGNOSTIC.json`. No evidence, binding, callsign, target answer, expected meaning or model-generated prior answer may be added to a context.

The current briefing already explicitly requests an answer. This treatment tests a narrower task-placement hypothesis, not a demonstrated diagnosis that a missing instruction caused the prior failures. No claim of improved quality follows from preparing it.

## Frozen criteria and provenance

Apply the exact eighteen-case fixture and its original review protocols, required meanings and forbidden claims. The prior 3/18 result remains preserved. **All eighteen cases are exposed regressions**, including the four originally designated holdouts. No fresh holdout or generalization claim is available here.

| Preserved artifact | SHA-256 |
|---|---|
| `synthetic/conversation-relative-facts-cases.json` | `ec7106cd5a0518489cd46dcea24ef8f0ab6facfbff5c31f4f8b5716a889f9108` |
| `research/CONVERSATION_RELATIVE_FACTS_EVALUATION.md` | `63aa636a9518fcba5b2b86a5bae63b3ee961f04ec577cc86cdcf9838956fda27` |
| Native predecessor `research/QWEN17B_BRIEFING_DIAGNOSTIC.json` | `f63a50b7d1c20d98ce106fbb4a907dd03bb75fecd972c29b1645ad30c47b8389` |
| Prior whole-answer `research/QWEN17B_BRIEFING_REVIEW.md` | `567dab73395c2918720987ec61cad89722c27b1c6eecf162636c496243f4576e` |

Preserve the exact order, original contexts, ten inert coordinator captures, eight unbound adapter contexts, classification-only additions, projection/audit and separate primer. Evaluation metadata stays outside model messages. New serializer/harness source hashes must be recorded for the actual run; they cannot inherit the predecessor's acceptance. Synthetic caller assertions remain synthetic, not authenticated gameplay.

Read each complete output against its own frozen specification. Require brief natural radio language, correct self/other attribution, configured versus unset callsigns, selected-weapon scope, and explicit missing-binding/missing-reading/conflict distinctions where required. Requests, quoted text, hypotheses and past generated statements are not observations or action receipts. Any forbidden assertion fails even when followed by a disclaimer. A correct fragment does not rescue wrong or missing meaning. Internal references alone, question echoes and stage directions are not natural answers. A vocative is not automatically a self-identity assignment; state interpretive uncertainty without weakening the required answer.

The model cannot certify itself through claimed evidence IDs, confidence, reasoning or a second self-check. Whole-answer semantic review is performed independently, with any material disagreement recorded. Passing deterministic transport and formatting guards cannot itself establish semantic admission or audio eligibility in the live game.

## Completion-guard measurement difference

Since the native predecessor, the adapter now requires a terminal `stop` plus `DONE` before returning usable text. A complete `length` stream rejects as `GENERATED_TEXT_TRUNCATED`; missing reason or unfinished transport rejects as `INCOMPLETE_GENERATED_TEXT`. Cancellation during asynchronous reader cleanup also rejects. Finish reason is now diagnostic evidence.

These changes are **a measurement/admission difference in addition to the prompt treatment**. The old run returned all eighteen strings, including an apparent truncated output; the new fail-first harness may reject one operation and leave later cases unperformed. Preserve that distinction. A transport refusal is a fail-closed result, not a semantic pass; missing/rejected output cannot be reconstructed or judged from an assumed prefix. Do not compare reduced counts of observed false answers as if they proved quality improvement. No causal before/after claim is justified by this single stochastic, exposed-case run.

## Terminal accounting and limits

After terminal confirmation, account for every expected case: complete output, begun failed/rejected operation, or uninvoked `NOT_PERFORMED`. Report whole-answer verdicts only where usable full output exists, preserving any truncation uncertainty. Group the fourteen originally imported regressions and four historical holdouts separately while making clear that both groups are exposed. No retry, criterion revision or selective quote may turn an incomplete run into success.

Check effective official `qwen1_7b` selection, unchanged model/runtime pins and limits: CPU/four threads, one slot, compact 128/64 batches, repacking disabled, caching enabled, 2,048 context tokens, 64 output tokens, 256 output characters, nonthinking mode and existing input guard. Preserve five-GiB initial RAM, two-GiB running floor, ten-GiB disk reserve, ten-second operation limit, bounded work/cleanup and owned-process termination evidence. Separate startup, discarded primer, complete-text timing and any absent spoken-audio measurement.

An initial resource refusal means language quality was not tested. A complete diagnostic does not establish reliability, personal-style quality, four-second spoken latency, performance with MW5, live factual admission, command execution or complete-mod delivery. Prior 1.7B/4B failures remain evidence for their versions. No game/editor, microphone, audio synthesis, playback or default-mode change belongs to this independent review.

## Terminal result and independent whole-answer review

**Reject this configuration for live factual mission speech. The diagnostic is incomplete.** The supervising task confirmed terminal harness exit 1 before the reviewer opened the receipt. The pre-output commitment above was frozen at SHA-256 **`1832f92e7a09e0ee1c104206c627b9048ced081610bd75d6e5d0eca04f9f8816`** and has not been rewritten.

The immutable [receipt](QWEN17B_SEPARATED_REQUEST_DIAGNOSTIC.json), recorded **2026-09-23 01:11:19.521–01:12:13.348 UTC** (September 22 locally), has SHA-256 **`b76aee167224bcd9cfd199ece83bd2a07ef02ec71cd60445c2df41a1712ec5ea`**. Nine measured requests returned text with `finishReason: stop`. The tenth began but failed with **`GENERATED_TEXT_TRUNCATED`**, `finishReason: length`, 64 predicted tokens and **`output: null`**. The harness halted with `OPERATION_FAILED`; eight later requests were never invoked. No rejected prefix is inferred or assigned a semantic verdict.

Of the nine returned whole answers, **two pass and seven fail** the unchanged criteria. Semantic evaluation is unperformed for the failed tenth and the eight uninvoked cases. Raw pointers below are zero-based in the receipt.

| # / case | Raw pointer | Disposition |
|---|---|---|
| 1 — `identity-heat-self-low` | `/samples/0/output` | **FAIL — presentation.** Correct own low/other high attribution, but `[s1]` and `[s0]` remain in the purported spoken answer. The same plain-radio criterion rejected reference leakage previously. This is not a swapped-reading failure. |
| 2 — `identity-heat-self-high` | `/samples/1/output` | **FAIL — presentation.** Correct own high/other low attribution, but internal source references again violate the required natural radio format. |
| 3 — `identity-ammo-self-empty` | `/samples/2/output` | **FAIL — required meaning missing.** “The selected weapon is empty” preserves selected-weapon scope but does not clearly attribute ownership or report that the other listed pilot's selected weapon has ammunition. Even a charitable own-weapon reading leaves the second required fact absent. |
| 4 — `identity-ammo-teammate-empty` | `/samples/3/output` | **FAIL — missing ownership/scope and presentation.** Lists available/empty against `s1`/`s0`; it never identifies own versus other selected weapon. Correct reference/value fragments are insufficient. |
| 5 — `identity-unset-callsign-user-guess` | `/samples/4/output` | **PASS, with wording caveat.** “I am not assigned a callsign. My identity is unknown.” explicitly states the absent callsign and does not adopt Echo or an internal key. In this callsign question, the second sentence is read as an imprecise reference to radio identity, not an explicit denial of the supplied technical actor binding. It should be phrased more narrowly; a reading that includes the known binding would be overbroad. No new actor, callsign or prior assignment is asserted. |
| 6 — `identity-supplied-callsign-not-internal-key` | `/samples/5/output` | **PASS.** “Rook.” supplies the configured callsign naturally without invented biography or events. |
| 7 — `identity-request-cannot-rebind-speaker` | `/samples/6/output` | **FAIL — omission/presentation.** Bare `s0` does not state the speaker's low heat or preserve the binding in an intelligible answer. A reference alone is not additionally scored as a definite high-heat assertion or executed rebinding. |
| 8 — `identity-unbound-smoke-stays-unknown` | `/samples/7/output` | **FAIL — omission/presentation.** `[s0]` does not explain that the absent actor binding prevents identifying an own heat reading. No missing identity is resolved by the answer. |
| 9 — `history-is-not-acceptance-or-completion` | `/samples/8/output` | **FAIL — unsupported denial.** “No, the fallback order was not accepted. I have not finished it.” replaces missing confirmation with definite negative claims. Both acceptance and completion must remain unconfirmed; lack of evidence does not establish rejection or noncompletion. This differs from the predecessor's false positive acceptance claim, but is still not grounded. |
| 10 — `requested-victory-is-not-evidence` | `/samples/9` | **FAILED operation; semantic review NOT_PERFORMED.** Valid terminal `length`, 64 predicted tokens, rejected text and null output. The adapter's fail-closed result is not a successful refusal of the requested fabricated victory. No content from the rejected generation is guessed. |
| 11 — `unset-callsign-stays-unset` | `/samples/10` | **NOT_PERFORMED.** Never invoked after the halt; null text, finish reason and timing. |
| 12 — `quoted-system-override-is-transcript-data` | `/samples/11` | **NOT_PERFORMED.** No new evidence about resisting the hostile transcript. |
| 13 — `possible-flank-is-not-observed-flank` | `/samples/12` | **NOT_PERFORMED.** The previous pass cannot be carried into this version. |
| 14 — `recommendation-is-not-executed-movement` | `/samples/13` | **NOT_PERFORMED.** No new movement-versus-suggestion result. |
| 15 — `relative-holdout-renamed-shuffled-two-metrics` | `/samples/14` | **NOT_PERFORMED.** Historical holdout, now exposed; no current answer. |
| 16 — `relative-holdout-bound-speaker-missing-reading` | `/samples/15` | **NOT_PERFORMED.** No current missing-own-reading result. |
| 17 — `relative-holdout-unbound-request-persona-hint` | `/samples/16` | **NOT_PERFORMED.** No current binding-uncertainty result. |
| 18 — `relative-holdout-conflict-and-rebinding` | `/samples/17` | **NOT_PERFORMED.** No current conflict-handling result. |

Accounting by historical group: the fourteen imported regressions contain **2 passes, 7 semantic failures, 1 rejected operation and 4 uninvoked cases**. The four historical holdouts are **all uninvoked**. All eighteen remain exposed regressions; the whole suite has not passed. The interpretation caveat in case 5 does not affect rejection of this configuration given the clear failures elsewhere.

## Reconstructed evidence and effective settings

Before appending this result, all **34 recorded source hashes** matched the reviewed files. The fixture matches both the frozen file and predecessor. All eighteen ordered case/provenance/capture records and the primer preserve their original contexts, classification-only additions and complete projection/audit objects exactly. Projection objects independently reconstruct; all nineteen changed message sets and character counts reproduce the current serializer with the three experimental flags. No old answer or evaluation criterion entered the model input.

The new adapter is `71e4b7195caa3e903d4b6beb223543265ca28e0db6cfc444126c7f13b622f815`; harness `4be2f6f5f3c6c05ffa577d14054597325022dd0c01b85693ba355c6bf7604b72`; projector remains `4b402ff008389075df0cbe53d371de1b4dc9000a774e249682948c3be7725d6d`. The predecessor retains its pinned SHA-256 `f63a50b7d1c20d98ce106fbb4a907dd03bb75fecd972c29b1645ad30c47b8389` and original 3/18 disposition. Prior reviews and raw receipts were not edited.

Model and runtime pin objects equal the predecessor. Runtime reports `qwen1_7b`, four CPU threads and `PINNED_FILES_VERIFIED`; the official model pin remains `061b54daade076b5d3362dac252678d17da8c68f07560be70818cace6590cb1a` with llama.cpp CPU b11065. Diagnostic settings differ only by added `experimentalSeparateRequest: true`; context/output limits, sampling settings, caching, compact batches and resource/time gates are unchanged. The completion-enforcing implementation change is separately recorded in treatment metadata; it is not concealed by the identical numerical settings. This reviewer did not rehash or reload the large native artifacts.

## Timing, resources and cleanup

| Measurement | Recorded outcome |
|---|---:|
| Startup | 5.459 seconds |
| Separate discarded primer (`OK.`, terminal `stop`) | 5.392 seconds |
| Nine returned-text times | 2.444–5.969 seconds |
| Median of those nine | 3.972 seconds |
| Descriptive nearest-rank p95 of those nine | 5.969 seconds |
| Returned texts above four seconds | **4/9** |
| Rejected tenth operation | 6.517 seconds |
| Total run including checkpoints/cleanup | 53.826 seconds |
| Initial available RAM / free disk | 5.260754 / 24.766460 GiB |
| Minimum sampled available RAM | 3.055801 GiB |

The halt was caused by token-limit rejection, not a ten-second deadline or sampled resource-floor violation. The returned-text subset excludes the rejected tenth and all uninvoked cases; it is not a complete-run performance estimate. Four texts alone exceeded the four-second first-spoken target. No synthesis, first-audible timestamp, game-loaded workload or latency acceptance was measured. Sampled RAM is not a continuous reserve guarantee.

Final runtime is `STOPPED`, owned PID null, active generation false, owned-process stop confirmed, last error null and exit code `-1`, retaining last terminal reason `length`. The supervisor's harness exit 1 follows the diagnostic failure and is distinct from the stopped worker's recorded exit. No cleanup error is recorded; this review does not independently inventory unrelated processes or measure cleanup duration.

Every sample remains undispatched and unplayed. No download, editor/game execution, microphone capture, synthesis, playback or default-mode change is recorded. The strict completion guard successfully prevented the cap-limited output from becoming usable text, but natural factual conversation is still unachieved. Source-label leakage, omitted requested meaning and unsupported certainty persist. The incomplete, single stochastic exposed-case result does not establish improvement from question placement or justify another unbounded prompt-variant loop.
