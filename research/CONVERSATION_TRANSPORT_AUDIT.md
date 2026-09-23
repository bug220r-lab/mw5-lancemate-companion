# Conversation transport audit

Reviewed 2026-09-23 UTC (September 22 locally). **NO_CONFIRMED_TRANSPORT_DEFECT** explaining the Qwen1.7B echo or false-history replies. This is a bounded source/metadata audit, not proof of every runtime-internal transformation and not conversational acceptance. No model, editor, game, microphone or audio device was started; no download or runtime/default change was made by this audit.

## Evidence boundary

The actual [Qwen1.7B diagnostic receipt](QWEN17B_RELATIVE_FACTS_DIAGNOSTIC.json) is SHA256 `456ae004e7497fe9d90a574b218a1da2c47d26b4546c87d21c5133f9d26137a3`. Its semantic failures remain assessed in [the independent result review](QWEN17B_RELATIVE_FACTS_REVIEW.md).

Source inspection and the reconstruction below occurred **before** the parent workstream added a new, unexecuted opt-in briefing serializer. At inspection, these files exactly matched the executed receipt's source pins:

| Inspected executed source | SHA256 |
|---|---|
| `companion/local-language-model.mjs` | `3e53dd4901270cb250af3fdfa363b924da65108ace452b57cc8fb9b05d92fd4d` |
| `companion/conversation.mjs` | `c661f2413a5323f59cd84617a566b83979580e1b24d16e9fa5ff8d8ff01e0c85` |
| `companion/speaker-observations.mjs` | `4b402ff008389075df0cbe53d371de1b4dc9000a774e249682948c3be7725d6d` |
| `companion/llama-runtime-pins.json` | `4044968e1b0bef2dade94d3911533df03d225a1cd57761e2dd1eab2e86d47a93` |

The newly edited adapter must not be described as the executed adapter or as covered by those old pins. Line numbers below refer to the inspected version; named functions identify the corresponding locations after subsequent edits.

## Findings

1. **Roles and bound context are preserved in the constructed request.** `conversation.mjs:115–121` freezes the selected actor/pawn/generation, its bound profile, supplied facts and its generated history. `messagesFor`, adapter lines 73–103, serializes the actor ID separately from callsign and persona style. The experimental projection removes profile ID from the spoken-identity object intentionally; it does not replace actor identity. Its result is exactly two messages: `system`, then `user`. History stays inside the user JSON under `unverifiedUndeliveredHistory`; it is not converted into authoritative assistant-role turns. Re-running this pure serializer on the receipt's **18 contexts plus primer reproduced every stored message exactly**. No criteria or earlier diagnostic answers enter those messages.

2. **The request body forwards those messages directly.** `runGeneration`, inspected lines 256–266, calls `messagesFor` with the configured projection option and puts the returned array directly into the JSON POST to authenticated loopback `/v1/chat/completions`. No request-text-only substitution, role reversal, local echo fallback, tools or separate completion prompt is present. The structured user content is intentionally JSON; its escaping inside the outer HTTP JSON is not an extra model-message role or an observed transport error. Whether that document-like representation encourages repetition is a model/prompt question.

3. **The installed model template supports the intended roles and nonthinking input.** A read-only GGUF metadata inspection consumed the header/metadata, not weights or inference: installed `companion/local/models/Qwen3-1.7B-Q8_0.gguf`, GGUF v3, `general.architecture=qwen3`, 28 metadata keys, metadata ending at byte 5,932,855. Its `tokenizer.chat_template` string has SHA256 `57f1fd00f0013a2be96aa79b857391f27e23df5b5f847072b524c897e24d0361`. Decoded template lines 13–15 emit the initial system message between `im_start`/`im_end`; lines 25–27 emit user messages with their role; lines 80–84 add the assistant prefix and an empty closed think block when `enable_thinking` is false. The adapter launches `--jinja`, `--chat-template-kwargs {"enable_thinking":false}` and `--reasoning-budget 0` (inspected lines 204–208), and supplies false again in the HTTP request plus `/no_think` in user content. The native log's deprecation warning recommends newer reasoning flags; it does not establish that these supplied controls were ignored. No custom template override is passed. The template inspection supports the intended path; it does not itself prove the server's actual rendered prompt.

4. **Streaming parsing cannot manufacture the observed echo or false receipt text.** Inspected adapter lines 267–306 read SSE `data` packets, append only `choices[0].delta.content`, reject role changes/tool calls/nonempty reasoning traces, require `[DONE]` and bounded nonempty text, then normalize whitespace. The code never appends input/history to the answer. For example, receipt `/samples/4/output` quotes the callsign question with empty supplied history; `/samples/8/output` falsely asserts order acceptance/completion despite its two supplied history turns remaining explicitly unverified user data. Those strings came through the model content path, rather than a local authored fallback. Existing `local-language-model.test.mjs` tests at the inspected lines 264–298 cover body fields and chunk/protocol rejection with injected dependencies; these tests establish mock protocol behavior, not native model compliance. No tests were rerun for this audit.

5. **No demonstrated cross-request history leak.** Each request rebuilds its messages. The native receipt preserves the intended isolated contexts; only the two predeclared historical cases contain history. The earlier [pinned cache source review](CONVERSATION_CACHE_SOURCE_REVIEW.md#pinned-evidence) documents matching-prefix reuse and divergent suffix removal for b11065/commit `ce8caa6e60a03093351d6016a818720e0d46f0fb`. That is inherited source evidence, not a fresh native cache proof. Nothing inspected demonstrates that previous generated replies were appended secretly or that caching caused the semantic failures.

## Limits and next decision

The receipt records constructed messages, output and timings, **not raw HTTP/SSE bytes or the server's actual rendered/tokenized prompt**. The adapter's status field `thinking:false` is a configured setting, not independent observation of every native internal state. No downloaded copy of the complete runtime chat parser was inspected in this pass. These gaps prevent claiming end-to-end native rendering has been independently proven.

The known `finish_reason` limitation remains: `stop` and `length` are accepted but the reason is not retained. This weakens completion evidence; it does not explain the complete quoted questions or false acceptance sentences. The actual diagnostic predicted 14–55 tokens per evaluated case, below the 64-token cap, with no positive truncation evidence.

There is no concrete transport correction justified by this audit. A separately identified factual-briefing representation can be evaluated while preserving this receipt and its failed semantic verdict. Such a test must not be described as a proven transport repair or as evidence that the model now understands the facts. Any later claim about exact native rendering would require separately captured native rendering/request evidence, not this source audit.
