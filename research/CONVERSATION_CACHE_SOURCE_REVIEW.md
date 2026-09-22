# Conversation prefix-cache experiment: source review

Reviewed 2026-09-22. **DOCUMENTED / SOURCE-SUPPORTED CANDIDATE. Native execution of this experiment: NOT_PERFORMED.** This review changed no runtime default, started no model or game, and did not evaluate a generated response.

## Finding and proposed experiment

One bounded cache experiment is justified by the preserved editor-closed result: `QWEN4B_GROUNDING_EDITOR_CLOSED_DIAGNOSTIC.json` reached ready, then its first complete response exceeded ten seconds. Its log recorded partial prompt processing at 128 tokens / 5.76 seconds; that is evidence of prompt-processing work, not a complete latency estimate. The adapter currently sends `cache_prompt: false` for every request.

Use the existing generation path with a code-only boolean that defaults to false. Explicitly enable it only in a separate diagnostic. First submit this calibration context: persona `{id: "calibration"}`, request text `Say OK.`, empty facts and empty history. Its formatted system message retains the existing grounding rules and has an empty persona object. This input contains no holdout question, factual observation, expected answer or history. Discard its generated answer; never append it to history, play it or dispatch it. Then submit the unchanged twelve contexts in their original order, once each. Do not alter prompts or tune against their outputs.

Keep four CPU threads, one slot, 2,048 context tokens, compact 128/64 batches, disabled repacking, current sampling and 64-token/256-character limits. Preserve five-GiB RAM admission, ten-GiB disk reserve, the sampled two-GiB stop floor, ten-second calibration and response deadlines, 233-second total work budget and seven-second cleanup budget. Calibration failure ends the run. Record an exclusive new receipt and preserve earlier failures.

Report engine startup and calibration as cold initialization, separately from each subsequent request. Include both in total wall time. Reused-prefix counts are mechanism evidence; they do not establish a causal speedup against older, uncontrolled runs. Warm text completion is not first-spoken latency. Caching does not reduce model-weight admission requirements or establish enough capacity alongside MW5, recognition and synthesis.

## Pinned evidence

The installed runtime pin is llama.cpp **b11065**. Its [official release](https://github.com/ggml-org/llama.cpp/releases/tag/b11065) resolves to commit **ce8caa6e60a03093351d6016a818720e0d46f0fb**. These source pages were read on 2026-09-22; they describe the pin, not a measured local cache result.

| Contract | Source location and implication |
|---|---|
| Request caching | [server-schema.cpp, lines 26–27](https://github.com/ggml-org/llama.cpp/blob/ce8caa6e60a03093351d6016a818720e0d46f0fb/tools/server/server-schema.cpp#L26) accepts the boolean. [README, lines 1212–1220](https://github.com/ggml-org/llama.cpp/blob/ce8caa6e60a03093351d6016a818720e0d46f0fb/tools/server/README.md#L1212) documents completion options on chat requests. |
| Prefix and suffix handling | [server-context.cpp, lines 2941–2944](https://github.com/ggml-org/llama.cpp/blob/ce8caa6e60a03093351d6016a818720e0d46f0fb/tools/server/server-context.cpp#L2941) selects an identical token prefix. Lines 3110 and 3132–3137 truncate tokens and remove remaining KV positions. This supports excluding earlier divergent dialogue from the next context. |
| Native timing fields | [README, lines 1291–1314](https://github.com/ggml-org/llama.cpp/blob/ce8caa6e60a03093351d6016a818720e0d46f0fb/tools/server/README.md#L1291): `cache_n` counts reused prompt tokens; `prompt_n` counts processed prompt tokens; `predicted_n` counts generated tokens. `prompt_ms` and `predicted_ms` are milliseconds. |
| Final streamed timing location | [server-task.cpp, lines 438–490](https://github.com/ggml-org/llama.cpp/blob/ce8caa6e60a03093351d6016a818720e0d46f0fb/tools/server/server-task.cpp#L438) attaches timings to the final emitted chunk when statistics exist. Normally this is the finish-reason chunk; requesting usage adds a final empty-choices usage chunk instead. |
| Memory distinction | [server-context.cpp, lines 1245–1255](https://github.com/ggml-org/llama.cpp/blob/ce8caa6e60a03093351d6016a818720e0d46f0fb/tools/server/server-context.cpp#L1245) creates a separate prompt cache. Lines 1479–1524 can save/load copies on slot reuse. [README, lines 155–157](https://github.com/ggml-org/llama.cpp/blob/ce8caa6e60a03093351d6016a818720e0d46f0fb/tools/server/README.md#L155) records an 8,192-MiB default maximum, not eager allocation. One slot does not imply zero extra cache memory. |

Keep launch arguments unchanged for this experiment and record that secondary-cache default. A future `--cache-ram 0` trial would be a distinct configuration, not an unreported safeguard adjustment. Arbitrary chunk shifting is disabled by the pinned default `n_cache_reuse: 0` ([README, line 490](https://github.com/ggml-org/llama.cpp/blob/ce8caa6e60a03093351d6016a818720e0d46f0fb/tools/server/README.md#L490)). Prefix caching can change numerical results; independent semantic review remains necessary ([README, line 536](https://github.com/ggml-org/llama.cpp/blob/ce8caa6e60a03093351d6016a818720e0d46f0fb/tools/server/README.md#L536)).

## Measurement and interpretation

Optional adapter telemetry should retain only bounded numeric fields from a terminal response: `cache_n`, `prompt_n`, `prompt_ms`, `predicted_n`, `predicted_ms`. Missing or malformed telemetry is unknown, never zero. Clear telemetry before each attempted generation and after failure/cancellation so primer evidence cannot be mistaken for case evidence. Keep response payload, deadline and lifecycle validation intact. No cache hit or complete text answer authorizes gameplay control or model promotion.

For each completed case, preserve full supplied messages, generated text, wall time and native counters. The first case should expose whether the generic primer yielded a reusable prefix. A positive count alone does not identify which exact prefix was reused; connect it to the pinned source and unchanged serialized inputs. Later cases may reuse larger identical prefixes than the calibration rules. Do not call that persistent factual memory or model learning. A missing hit leaves the optimization hypothesis unresolved even if an answer completes.

## Rejected complexity for this experiment

Do not add `/apply-template`, `/tokenize` or prompt-only priming. Although [README line 483](https://github.com/ggml-org/llama.cpp/blob/ce8caa6e60a03093351d6016a818720e0d46f0fb/tools/server/README.md#L483) and [server-schema.cpp lines 37–41](https://github.com/ggml-org/llama.cpp/blob/ce8caa6e60a03093351d6016a818720e0d46f0fb/tools/server/server-schema.cpp#L37) declare zero-token priming, the inspected ordinary generation path samples at [server-context.cpp lines 3498–3527](https://github.com/ggml-org/llama.cpp/blob/ce8caa6e60a03093351d6016a818720e0d46f0fb/tools/server/server-context.cpp#L3498) before its observed budget check at lines 1744–1748. That source/documentation discrepancy was not resolved by native testing. The ordinary discarded calibration avoids depending on it.

`/apply-template` uses the chat parser ([server-context.cpp lines 4603–4613](https://github.com/ggml-org/llama.cpp/blob/ce8caa6e60a03093351d6016a818720e0d46f0fb/tools/server/server-context.cpp#L4603)), but system-only output was not shown to be an exact token prefix of a full request. The proposed experiment does not need that claim.

## Independent preparation review

**GO for one bounded diagnostic, conditional on the adapter owner's focused tests and the supervising task's fresh process/resource preflight. This is preparation review, not native success or semantic acceptance.** The reviewer independently ran the two preparation tests: **2/2 PASS_MOCK_ONLY**. No model was started by this review.

Reviewed the harness, its design, preparation tests, imported startup-wait helper and adapter lifecycle. The initially identified accounting issue was corrected before execution: a sample now remains `NOT_PERFORMED` if the guard rejects it before invocation. The final unperformed list uses that status rather than merely array membership. Changing to `RUNNING` and invoking generation have no intervening await. A timeout or rejected call becomes `FAILED`; only a returned response surviving the abort check becomes `TEXT_COMPLETE_DIAGNOSTIC_ONLY`, never a semantic pass.

The fixed loops permit at most thirteen generation calls: one independent calibration and twelve unchanged cases. There is no retry or answer-driven prompt modification. Exclusive receipt creation occurs before engine construction/start; an existing receipt prevents execution. Admission failure stops without starting a worker. Startup/global cancellation reaches the owned engine's stop path; the startup promise retains rejection handlers. Cleanup is bounded and explicitly records an unconfirmed process stop as failure. Filesystem writes are awaited and memory sampling is cooperative; neither is a hard real-time guarantee.

The calibration supplies empty facts/history and no configured pilot identity. The full holdout contexts remain unchanged, with no generated answer fed into any later case. Existing resource/deadline/model/sampling limits remain intact. `promptCaching` is a strict code-only boolean with false default; the workbench receives no new request setting. Native timing fields remain optional, bounded, detached numeric copies, and unknown when absent. The adapter owner corrected idle pre-aborted-request handling so a new rejected request cannot retain the prior request's timings.

| Reviewed artifact | SHA-256 |
|---|---|
| `scripts/Exercise-ConversationCache.mjs` | `19d3bb529b0d363db3b82e17ddc3dea87d0d4cbf28969a1462be210f258235b0` |
| `design/CONVERSATION_CACHE_DIAGNOSTIC.md` | `ace1b5c42d22f416e20a1fbd2fb934d4fe020bcb19a15174d95b99bd16774fff` |
| `companion/tests/conversation-cache-diagnostic.test.mjs` | `e15b2d13a29c8519dfd46a20e9bf599fe9497ef1452725b0df800e911e83d71b` |
| Unchanged grounding fixture | `2139103acf90c3eab87eb2e1bf38d25de75e069e0f295b19ab23600962f331fb` |
| Preserved editor-closed diagnostic | `da4bcaa158ef443be9b1ff4809760adc1b7ace4d28c2a5c1c43830f1d7a0109f` |

Adapter implementation/test hashes belong in its owner's final review and the actual run receipt; that file was still being finalized during this initial review. Current source supports proceeding with the narrow measurement, not forecasting its result. A successful cache hit still requires independent review of completed answers and does not establish game-loaded performance, spoken latency, or complete-mod acceptance.

## Final preparation addendum

The table above preserves the initially reviewed snapshot. Before evaluating the completed native receipt, the reviewer checked the final harness and adapter changes. The harness now copies native timing fields only for `TEXT_COMPLETE_DIAGNOSTIC_ONLY` samples; a cancelled or failed sample cannot inherit successful terminal telemetry. The adapter also clears timings when external cancellation, deadline expiry, owned shutdown or child exit is detected during reader cleanup. It correctly distinguishes these from its own deliberate cleanup abort. These changes preserve the prompt, sampling, deadlines and resource guards.

| Final execution artifact | SHA-256 |
|---|---|
| `scripts/Exercise-ConversationCache.mjs` | `d4fff59d0463b535b5c7f648d8799a2f5a775635acb6bb51ea09942309bcbc99` |
| `companion/local-language-model.mjs` | `005541d449d1cde7f1944e475bb19a86184cb4b399490e696aca7ce926986442` |

Both hashes match the completed diagnostic's recorded source hashes. The preparation tests, fixture and preserved editor-closed receipt retain the hashes in the earlier table. The design hash identifies the preparation version; the supervising task subsequently appended native results to that document. The supervising task reported 706/706 regression tests passing before this one native run; this reviewer independently ran only the two preparation tests noted above. Native results and their independent semantic assessment are recorded separately in [QWEN4B_PROMPT_CACHE_RESULT_REVIEW.md](QWEN4B_PROMPT_CACHE_RESULT_REVIEW.md). The opening `NOT_PERFORMED` label describes the original preparation review, not the subsequent run.
