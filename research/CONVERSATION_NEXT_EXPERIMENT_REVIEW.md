# Independent recommendation for the next conversation experiment

2026-09-22 local time. **PROPOSED; no implementation, fixture change or native inference performed.** Existing model-quality failures and the complete-mod acceptance requirements remain unchanged.

## Recommendation

Do not run another broad rewritten-prompt diagnostic merely because the latest score is low. One small **question-channel comparison** is defensible before investing in a new conversation architecture: preserve the speaker/evidence projection, but distinguish the player's current conversational question from the evidence being discussed. Treat it as a diagnostic of task interpretation, not a presumed repair of factual grounding. Continue to use freely generated wording; do not supply target sentences or substitute the authored mission-status renderer.

The hypothesis that the present prompt never asks the model to answer is **contradicted by the actual messages**. The system says to give a concise spoken radio line without echoing; the user envelope ends with `REQUEST TO ANSWER`. Cases 1, 6 and 13 answer sufficiently to pass, so the model can sometimes perform the existing task. The weaker hypothesis—that a quoted request inside an all-data envelope encourages extraction/echo rather than answering—is plausible but unproved. It cannot explain away the false action and outcome claims, and another wording change is not evidence of progress by itself.

## What the outputs establish

The whole-answer review accepts only 3/18. Distinct failure modes need separate outcomes:

| Evidence in the briefing receipt | Implication for a next experiment |
|---|---|
| Cases 2–4, 8 and 16 return `s0`/`s1` rather than required state or uncertainty; case 5 repeats the question | Task interpretation and source-label copying are real observed failures. Removing labels might hide one symptom, so do not combine that change with a question-channel comparison. |
| Case 1 correctly compares own/other heat; case 6 answers the configured callsign | The existing representation is not universally incomprehensible. Success on a few controls cannot excuse the other outputs. |
| Cases 11/13 append irrelevant heat/ammunition unknowns; case 14 invents an unclear heat reading instead of addressing movement | Unconditional metric boilerplate may distract from the requested subject. This is a separate relevance hypothesis, not a reason to silently discard facts or adverse evidence in the next comparison. |
| Case 9 repeats unreliable history as current order acceptance; case 10 fabricates victory; case 12 repeats a hostile transcript | Identity projection and plain prose do not establish fact/intent separation. Whole-answer semantic admission remains unresolved even if echoing improves. |
| Cases 15/18 retain useful factual fragments while missing self-attribution or the conflict explanation | Inspect complete meaning; correct values alone cannot pass. |

Case 10 also reached 64 predicted tokens and ended unfinished. The subsequent adapter completion fix rejects `length`, absent terminal reason and unfinished transport before history/speech. That is a necessary boundary repair, **not** a solution to complete-but-false answers such as case 9. Earlier receipts predate this fix and must not be retrospectively rescored as if it were active.

## Narrow architectural separation to test

Keep three responsibilities distinct:

1. **Application-owned evidence and identity.** The current actor join, configured callsign, own/other/unattributed metrics, conflicts, unknowns and audit remain deterministic. Request wording cannot create bindings, readings, accepted actions or outcomes. An absent receipt means no supplied confirmation, not proof that an action failed or never occurred.
2. **Conversational task.** A player's question may select what is being asked and request a reply. It cannot promote its factual assertions, quoted transcript or historical generated text into observations. The system must express this distinction rather than implying that acknowledging a question grants factual or control authority. Recognized commands remain on the existing separate parser/arbiter path; conversational text grants no dispatch permission.
3. **Model-owned wording only.** The model composes a natural answer from this context and the question, retaining persona. No authored answer, case-specific expected meaning, evaluation label or approved sentence enters its prompt. A returned answer remains unverified until a separate admission process assesses it.

For the experimental treatment, place the unchanged current question in its own final user-role message, with a bounded system instruction to answer it subject to the evidence/identity constraints. Preserve the earlier evidence envelope, its raw unsupported facts and unverified history. Remove only the duplicate embedded request from that envelope. The question is still lower-priority content, not a system instruction, observation or execution authorization; text resembling a role delimiter cannot become a real role. Log exact messages and review the actual runtime template behavior before interpreting any result.

This is one declared **task-placement-and-boundary treatment**, not an isolated causal test of quotation marks. Do not simultaneously remove reference labels, prune facts, add examples, change model settings, add a second generation pass or rewrite unsupported fields. Those changes would obscure the outcome. If the chat template cannot represent the proposed message arrangement faithfully, record that blocker rather than altering the comparison silently.

## Smallest useful evaluation

Independently freeze **eight new scenario specifications**, then run each once under the current briefing and once under the proposed task placement: sixteen outputs, not a further unchanged 18-case rerun. Include ordinary answer-versus-echo controls, crossed actor/reading counterfactuals, configured/unset identity, known binding with missing evidence, conflict, and requests/transcripts/history that demand unconfirmed actions or outcomes. Use fresh names, paraphrases and values; no prior output may become an example. Freeze required meaning, forbidden claims and natural-radio criteria before implementation/output inspection. Do not call the exposed eighteen cases new holdouts.

Keep the installed official 1.7B Q8 model, existing parameter/resource/output limits and new strict completion handling identical between conditions. Predeclare a balanced condition order and isolate logical conversation history between cases. Record complete outputs, terminal reason, prompt/token/cache counters, elapsed time, source hashes and cleanup. Differences in caching, stochastic output length and background load still limit causal claims. No automatic retry or additional wording variant follows a failed comparison.

The primary result is whether the treatment changes task interpretation **without any identity, scope, unsupported-fact or command-boundary regression**. Report per-case outcomes and false assertions separately; reject a candidate with any observed false acceptance/outcome claim. A better small tally is a development signal, not acceptance. If both conditions fail ordinary controls or the new form retains false claims, stop this prompt branch and preserve the failed result. More generic scaffolding, self-check instructions or renamed authored responses would not resolve the demonstrated capability gap.

## Semantic admission without self-certification

The model must not grade its own answer, certify a list of its own claimed facts, or convert its own generated explanation into evidence. A second pass through the same model is also not independent validation and adds unmeasured latency. Structured claim IDs alone do not establish that the accompanying unrestricted text says only those claims.

For this development experiment, an independent reviewer reads each **whole answer** against the predeclared evidence and criteria, preferably with treatment identity hidden during the initial judgment. Contradictions, unsupported events, missing required meaning, source-label echoes and incomplete responses remain failures. Use an independent second reading for disputed interpretations; preserve ambiguity rather than declaring a machine-scored pass. This is offline adjudication, not a shippable real-time validator.

For eventual runtime admission, transport, size, explicit formatting and source-label checks can reject obvious failures, but passing them cannot establish semantic truth. A proposed semantic validator needs its own independently authored adversarial suite measuring false admission of fluent unsupported claims and false rejection of valid paraphrases. Unparsed or uncertain claims must remain inadmissible. Until such a mechanism is demonstrated, freely generated factual mission speech remains preview-only. Rejected lines are not silently repaired, spoken, or counted as successful conversation. The existing `mission-speech.mjs` authored path remains a separately labeled limited feature.

There is no new external input required for the narrow comparison. Full local conversational delivery nevertheless remains unproved: the briefing run had eleven of eighteen text responses above four seconds, before synthesis, and no accepted workload alongside MW5. A task-placement result cannot relax the four-second first-spoken target, resource gates, unknown-state rules or the natural-conversation requirement in `FULL_MOD_DELIVERY.md`.

## Evidence identity

- `design/FULL_MOD_DELIVERY.md`: `398eecff10cf39fb09915f723f7a9c6e7725c372787a80eb39067c8d5b8e4ea9`.
- `research/QWEN17B_BRIEFING_DIAGNOSTIC.json`: `f63a50b7d1c20d98ce106fbb4a907dd03bb75fecd972c29b1645ad30c47b8389`; samples 1–18 and their exact messages/contexts.
- `research/QWEN17B_BRIEFING_REVIEW.md`: `567dab73395c2918720987ec61cad89722c27b1c6eecf162636c496243f4576e`; whole-answer 3/18 disposition.
- Earlier projection review `research/QWEN17B_RELATIVE_FACTS_REVIEW.md`: `c7ab469efbd379cc86633aff2e4d50512feb9a55b40ab1f7407a3109ad277a69`; prior 2/18 remains valid for its version.
- Current completion-enforcing adapter `companion/local-language-model.mjs`: `5dd6712ffdcfc17fc53d4ebba3903e414862ace20aa3bc9fb5542d3f73f5032f`; differs from the native briefing receipt's `4a40f247...` serializer version.
- `companion/mission-speech.mjs`: `ccd9592e626a289d3c941b1681d9836e94cac63b96f709b272f566be7d805944`; its authored evidence renderer is not full free conversation.

No source, fixture, historical review or native receipt was modified for this assessment.

## Supervising task's selected next protocol

After this assessment was drafted, the supervising task selected a single task-channel treatment using the **same eighteen exposed regression contexts**, retaining reference labels, unknowns, raw material and history. Its intended form is a reference-only first user message and the exact request plus the existing no-thinking suffix in a final user message, with a narrow system role clarification. The separate exclusive receipt is `research/QWEN17B_SEPARATED_REQUEST_DIAGNOSTIC.json`. This differs from the eight-new-specification/two-condition proposal above; that fresh comparison has not been implemented or performed.

The selected regression run can reveal concrete remaining failures, but cannot establish generalization or isolate causation against the historical briefing run. The completion-enforcing adapter changed since that predecessor: token-limit or incomplete streams now reject and halt subsequent cases, and finish reason is retained. Compare complete supported outcomes and unperformed accounting explicitly rather than treating fewer returned failures as improvement. The independent pre-output review commitment is `research/QWEN17B_SEPARATED_REQUEST_REVIEW.md`.
