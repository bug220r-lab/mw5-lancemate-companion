# Fresh local-model transfer evaluation

2026-09-22 local time. **PREPARATION ONLY / MOCK_ONLY / native inference NOT_PERFORMED.** No candidate-specific prompt, model, runtime or native output was used to tune these eight new cases. Their failure families are informed by the historical diagnostics; that is not a claim of blind discovery or a statistical test of generalization.

The frozen fixture is [conversation-model-transfer-cases.json](../synthetic/conversation-model-transfer-cases.json), SHA-256 **`4f042b99c4ea8690425c7476347088cb31e5aca3fe45a4ba5ef1b966ebd5e0dd`**. It is intended for an eventual **different local model candidate**, not another repeat of the rejected unchanged 1.7B prompt branch. The model-specific template and effective inference configuration must be separately recorded before use. This document neither downloads a model nor authorizes or starts inference.

## Eight independently specified cases

| # | Case | Required distinction |
|---|---|---|
| 1 | `transfer-configured-introduction` | Give the configured callsign and a natural follow-up question. This is a positive conversational task, not merely a safe refusal. |
| 2 | `transfer-counterfactual-normal-supplied` | Own normal heat/supplied selected weapon versus another listed actor's critical heat/empty selected weapon, with metric rows in different orders. |
| 3 | `transfer-counterfactual-critical-empty` | The same words, persona and observations, but the other explicit speaker binding reverses both own/other attributions. |
| 4 | `transfer-caller-nickname-is-not-setting` | The caller's nickname and informal note cannot establish a callsign absent from settings; a known binding still exists. |
| 5 | `transfer-known-pilot-missing-thermal` | A known actor has an ammunition reading but no own heat reading. Neither missing identity nor missing all observations is the correct explanation. |
| 6 | `transfer-unbound-addressed-ammunition` | Addressing a listed actor in the question cannot create a missing speaker binding or identify its weapon as self. |
| 7 | `transfer-equal-time-thermal-conflict` | Equally current own normal/critical reports conflict; another actor's consistent reading cannot resolve them. |
| 8 | `transfer-chatter-does-not-prove-extraction` | Generated history, a command-looking rebroadcast and a demand for confidence cannot confirm completed withdrawal or a clear approach. Definite negative outcomes are equally unsupported. |

Each case has independent `requiredMeaning` and `forbiddenClaims`, together with shared whole-answer criteria. They are semantic expectations, not expected output sentences. Values, wording, actor names, mixed-metric cases and uncertainty combinations are new; the counterfactual pair is deliberately related, so eight cases are not eight statistically independent observations.

## Input and provenance contract

Only each case's **`context`** may become model input. Case IDs, families, relationships, expected meanings, prohibitions, rationales and review metadata must never be passed to the model. No successful prior output, canned answer or authored fallback may be substituted for generation.

These are explicitly **direct synthetic adapter contexts**, not claimed captures from the conversation coordinator or real game. Seven include a synthetic `speakerId`; the unbound sixth case deliberately omits it. Each has a concrete persona/settings snapshot, request, caller-asserted facts and supplied history compatible with the current `messagesFor` input shape. The fixed timestamps are synthetic snapshot metadata, not live freshness. The counterfactual pair represents independent possible input worlds, not a same-session ownership change. A future harness must label this mode honestly instead of inventing capture counts or runtime authority.

Preserve context bytes/data, transformed messages, projection/audit where used and the actual template in the receipt. A future candidate's template may differ, but cannot silently remove an adverse fact, infer a binding, add an answer or change the question. Freeze any candidate-specific transformation and review it separately before output inspection. If the context cannot fit within the agreed bounds, record a refusal rather than truncating evidence.

## Independent scoring and completion

Read the entire reply. Require a brief natural radio turn, correct scope/identity, the requested meaning and preserved unknowns. Two connected short sentences are allowed. Actor IDs, source pointers or echoed questions cannot substitute for the answer; stage directions, code, reasoning and speaker switching remain disallowed. Merely surrounding an otherwise valid spoken answer with quotation marks does not itself invent a claim or establish a failure. The configured callsign itself is legitimate reply content. A listed actor name is not automatically a claimed callsign, and a vocative is not automatically a self-identity assertion; explain material interpretation uncertainty.

An unsupported claim fails even with a disclaimer, and missing required meaning still fails when no falsehood was uttered. Critically, **unconfirmed is not false**: missing acceptance/completion/outcome evidence permits neither definite affirmation nor definite denial. Do not relax this to reward the recent negative-assertion failure mode.

A model's confidence, chosen evidence IDs, explanation or self-grade is not independent admission. Use independent whole-answer adjudication, with a second reading for disputed claims. Record semantic pass/fail separately from transport acceptance, a begun rejected operation and an uninvoked case. Empty, truncated, timed-out, cancelled or rejected text cannot pass. Do not infer content from an unretained partial output.

The current llama adapter requires a terminal `stop` plus `[DONE]`; other runtime/model contracts must be verified before borrowing that assumption. Retain actual finish reason and bounded-output checks. A complete answer is still not proof of factual correctness or eligibility for live speech. No response is dispatched or played by this evaluation.

## Relationship to existing evidence and acceptance

Keep the prior **18 exposed regression cases** separate, unchanged at SHA-256 `ec7106cd5a0518489cd46dcea24ef8f0ab6facfbff5c31f4f8b5716a889f9108`. Preserve the prior native briefing receipt `f63a50b7d1c20d98ce106fbb4a907dd03bb75fecd972c29b1645ad30c47b8389` and separated-request receipt `b76aee167224bcd9cfd199ece83bd2a07ef02ec71cd60445c2df41a1712ec5ea`. Their failures and unperformed cases remain valid for their recorded versions.

The new eight may provide an initial predeclared held-out check only if they are not used as prompt examples, tuning targets or rehearsal requests. After first candidate inference, treat them as exposed for future iterations. If a future run also evaluates the old eighteen, report **eight fresh-at-first-use cases and eighteen exposed regressions separately**, with an explicit predeclared order. Do not present a combined 26-case denominator as a fresh holdout, transfer old passes into the new model, or omit failures/unperformed cases after a halt.

An initial screen succeeds only if every invoked usable answer meets its full criteria and all eight required operations complete; this remains development evidence, not full-mod acceptance. Report any failure directly rather than adjusting criteria or retrying until it passes. Even 8/8 would leave broader multi-turn conversation, personal style, voice quality, four-second first-spoken latency, resource use alongside MW5, native observation and control unproved. No authored-line fallback may be relabeled full conversation.

Use existing admission/ownership/time safeguards for any later bounded native evaluation; changing them requires a separately reviewed actual candidate plan. This fixture does not relax the resource reserve, output limits, latency objective, game authority or privacy boundaries. Preserve raw outputs and exact model/runtime/source hashes in a new exclusive receipt; no paid service or game interaction is part of this preparation.

## Preparation checks

Read-only checks verified eight unique IDs, nonempty independent criteria, explicit synthetic classification, request lengths of 32–96 characters, and existing fact/history limits. All eight contexts pass the current pure `messagesFor` data checks and pure speaker projector without invoking a generator. The two counterfactual contexts differ only in `speakerId`; expected meaning is outside both. The prior fixture and two cited raw receipt hashes remain unchanged.

No model inference, native process, download, output inspection for these cases, source modification or old-fixture/report change occurred. The fixture and this note are the only new artifacts owned by this workstream.
