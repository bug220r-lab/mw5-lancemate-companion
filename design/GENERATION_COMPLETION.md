# Local generation completion contract

Implemented September 22, 2026 locally (September 23 UTC). This is a project adapter contract, not an MW5 API. Verification uses injected protocol/lifecycle and workbench tests; native inference with the changed adapter is **NOT_PERFORMED**.

The preserved [briefing diagnostic](../research/QWEN17B_BRIEFING_DIAGNOSTIC.json) returned a fabricated answer that visibly ended mid-sentence after 64 predicted tokens. The old adapter accepted both `stop` and `length` and did not retain the finish reason. That receipt cannot retrospectively prove which native reason was sent. Its factual failure and its original source hashes remain unchanged.

## Accepted response

`companion/local-language-model.mjs` collects the bounded text stream privately. It returns a reply only after all of the following:

1. Valid supported content arrives through the existing authenticated local chat endpoint, within the existing byte, character and payload limits.
2. Exactly one choice has a terminal `finish_reason` of `stop`.
3. The stream subsequently supplies `[DONE]`. Nonempty, well-formed text is required.
4. The caller has not cancelled, the deadline has not expired and the owned worker remains available, including after bounded response cleanup.

The terminal chunk may carry the final content or an empty delta. Empty-choice usage packets may appear before or after it; they do not supply a finish reason or replace terminal timing evidence. Any further choice between the terminal chunk and `[DONE]` rejects the response, including a duplicate terminal, conflicting reason or appended text. `[DONE]` ends parsing and the reader is cancelled; the adapter does not claim to audit bytes after that marker.

`length` followed by `[DONE]` is a completed transport response containing unusable token-truncated text. It rejects with `GENERATED_TEXT_TRUNCATED`. Missing reason or missing `[DONE]` rejects as incomplete. Unsupported reasons, malformed payloads and conflicting endings also reject. No partial reply is repaired, silently retried, appended to history or returned for speech. Output limits and model settings remain unchanged.

An explicit `stop` is a transport admission condition, **not proof of grammatical completeness, factual grounding, naturalness or tactical competence**. Accepted text remains `GENERATED_UNVERIFIED`; the model's earlier factual failures remain unresolved.

## Diagnostics and consumers

`status().lastGenerationFinishReason` is `null`, `stop` or `length`. It is published only after a valid complete transport/text sequence survives cleanup. A `length` rejection retains its reason and any validated bounded terminal timing fields, but never its rejected text. Missing or malformed optional timings remain null. Incomplete, malformed or cancelled attempts leave both fields null. A newly admitted generation, an invalid/pre-cancelled attempt while ready and a fresh process startup clear prior evidence; an unrelated busy rejection does not replace the active generation's evidence.

The existing coordinator maps generator failure to rejection. Its generated history and the workbench's voice-eligibility record are created only after generation succeeds. This change does not make the coordinator trust timing/finish diagnostics, accept a command or authorize any game action.

Future identity and relative-fact diagnostic receipts record `finishReason` separately from sample status and text. A matched truncation error may retain `length` and timings while the sample stays `FAILED`, output stays null and later cases remain unperformed. Missing or unrelated metadata is not inferred from token count. Historical JSON receipts are not rewritten.

## Evidence

- [Independent stream review](../research/LLM_COMPLETION_REVIEW.md): malformed/incomplete streams, supported termination forms, reset and recovery boundaries.
- [Actual adapter/workbench integration review](../research/CONVERSATION_COMPLETION_INTEGRATION_REVIEW.md): mocked worker/transport, actual coordinator and voice-preview admission paths.
- [Diagnostic harness review](../research/GENERATION_COMPLETION_DIAGNOSTIC_REVIEW.md): honest failed/unperformed accounting and finish metadata.
- [Current offline verification receipt](../research/COMPANION_VALIDATION.json): exact tested source hashes and synthetic-only results.

The editor remains closed. This increment starts no model, game, audio device or public service. Native protocol compatibility, conversation quality, in-game performance and the full companion release still need their own evidence.
