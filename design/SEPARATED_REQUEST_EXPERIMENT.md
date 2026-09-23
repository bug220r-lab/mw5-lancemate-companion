# Separate the player request from reference data

September 22, 2026 locally. **PROPOSED prompt treatment; MOCK_ONLY contexts; native outcome recorded separately.** This is an input-format experiment for full generated conversation, not a new authored-response substitute or an accepted live radio path.

## Question and intervention

The preceding [briefing result](../research/QWEN17B_BRIEFING_DIAGNOSTIC.json), SHA256 `f63a50b7d1c20d98ce106fbb4a907dd03bb75fecd972c29b1645ad30c47b8389`, contains an exact question echo, a copied unverified history response, a copied hostile transcript and several bare source labels. It also contains three full passes. The explicit instructions already ask for an answer rather than an echo; their absence is **not** the explanation. The [independent diagnosis](../research/CONVERSATION_REQUEST_SEPARATION_REVIEW.md) identifies a competing hypothesis: a quoted player utterance inside the same reference document may encourage selection/copying instead of answering. That is not a proven cause.

The sole new prompt option is `experimentalSeparateRequest: true`, requiring both earlier experimental flags and a `MOCK_ONLY` context. It creates three chat messages:

1. The unchanged briefing system instruction, followed by a narrow instruction distinguishing the first user reference document from the final player question. Player wording cannot establish settings, facts, actions or outcomes.
2. The exact existing reference document through generated history, without the request section or no-thinking suffix.
3. The exact original player request, without JSON quotation, followed by the existing ` /no_think` suffix.

The reference message stays in the user role, never a privileged system role. Source labels, absent readings, unknown actor binding, conflicting/unsupported facts, raw text, personality, callsign and generated history are preserved. No request-driven pruning, desired-answer examples, request classifier, additional inference, response repair or source-label removal is added. The existing projector remains the source of relative actor attribution. Explicit chat roles prevent strings becoming new message objects; this does not prove that arbitrary text is immune to model-level prompt injection.

All older serialization modes stay byte-identical when this option is absent or false. The ordinary workbench has no setting for it. No model output supplies evidence, actor identity, permissions or commands.

Before execution, a bounded read of the installed Qwen3-1.7B Q8 GGUF metadata reconfirmed template SHA256 `57f1fd00f0013a2be96aa79b857391f27e23df5b5f847072b524c897e24d0361`, matching the earlier transport audit. The file reports GGUF v3, 28 metadata keys and metadata ending at byte 5,932,855. Template lines 25–27 iterate messages and emit each user turn without an alternating-role requirement; lines 80–84 supply the assistant prefix and closed thinking block for nonthinking mode. This supports the proposed consecutive user messages. It is inspection of the installed template text, not a native rendered/tokenized-prompt capture or proof against role-like strings in user content. The actual experiment still needs the runtime response and pinned-artifact checks.

## Evaluation and concrete run scope

Use the existing eighteen-case fixture unchanged, in its original order, plus the same discarded primer. Preserve original contexts, projection audits, persona settings, histories, facts, requests and full semantic criteria. All eighteen cases are exposed regressions with **zero fresh holdouts**. Historical four-holdout labels remain provenance only. The [independent next-step assessment](../research/CONVERSATION_NEXT_EXPERIMENT_REVIEW.md) and [pre-output review commitment](../research/QWEN17B_SEPARATED_REQUEST_REVIEW.md) separate this limited diagnostic from generalization evidence and live semantic admission.

The fixed runner command is `node scripts/Exercise-ConversationRelativeFacts.mjs --run-separated-request-qwen17b`. It may create only the exclusively reserved result `research/QWEN17B_SEPARATED_REQUEST_DIAGNOSTIC.json`; an existing result refuses a rerun. The runner checks the exact predecessor and fixture, pins source/model/runtime files and confirms its actual factory configuration. No arbitrary model, prompt, output path or deadline override is exposed.

Use the installed official Qwen3-1.7B Q8 model and pinned llama.cpp b11065; one CPU worker, four threads, compact 128/64 batches, weight repacking disabled and prompt caching enabled. Keep 2,048 context tokens, 64 output tokens, 256 output characters and the existing 6,000-character prompt guard. Preserve stochastic sampling settings, ten-second operation deadlines, 233-second work budget and seven-second cleanup budget. No download, audio generation, playback, microphone, editor, game, retail deployment or network inference belongs in this run. Owned local loopback inference is the only model transport.

Fresh resource admission requires at least **5 GiB available RAM and 10 GiB free working disk**. Poll available RAM every 250 ms and stop below 2 GiB, on measurement failure, supervisor interruption, deadline or first operation failure. Reactive sampling is not an OS-enforced resource guarantee. Before starting, check that no conflicting owned model/editor/game worker is running. Afterward verify terminal state and owned-process shutdown; a timeout alone is not proof of process exit. Preserve any failure and all unperformed cases; do not retry answers or change parameters after seeing output.

The editor stays closed. This is project-local text inference on synthetic contexts, not a game-affecting experiment. Cleanup stops only the worker created by this runner and releases its stream/receipt handles. There are no game artifacts to install or roll back, and no application preferences/defaults change.

## Important measurement difference

The current [completion guard](GENERATION_COMPLETION.md) postdates the predecessor. A complete stream ending in `length` now rejects instead of returning truncated text; missing/conflicting termination also rejects. Accepted and rejected-complete streams retain a bounded finish reason. This means historical versus new completion counts are not measured under identical admission rules. A failed case keeps null output; subsequent cases are unperformed. Any observed difference cannot be attributed solely to request placement.

Apply the same whole-answer meaning, factual-boundary and plain-radio criteria to each returned answer. Separate missing answers, false assertions, source-label/stage-direction defects, truncation and unperformed cases. A higher exposed-regression count is not reliability, fresh generalization, causal improvement, a four-second spoken-response result or proof of live factual admission. A model's self-rating or claimed source IDs cannot certify the truth of unrestricted language.

Before native execution, require independent serializer/runner checks, exact historical prompt preservation and the complete offline regression suite. Record new character counts rather than assuming fewer tokens or faster inference. A negative result calls for a different justified approach; this protocol does not authorize repeated unchanged runs or relaxed acceptance.
