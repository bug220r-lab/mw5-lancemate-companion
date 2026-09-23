# Independent model-stream completion review

Reviewed 2026-09-22. **PASS_MOCK_ONLY / SOURCE-REVIEWED. Native inference: NOT_PERFORMED in this review.**

The corrected adapter returns text only after one supported terminal reason and `[DONE]`. A terminal `length` is a complete transport result containing truncated model output: it rejects as `GENERATED_TEXT_TRUNCATED`. A terminal `stop` establishes protocol completion, not factual accuracy, attribution, useful conversation, or readiness for live radio.

## Independent cases and observed results

The reviewer specified the cases before executing them and owns `companion/tests/llm-completion-review.test.mjs`. Its child process, filesystem verification, HTTP response and SSE stream are injected fakes. No model, game, editor or audio device was started.

The 29 cases cover four valid stream forms; missing, null, invalid, repeated and conflicting terminal reasons; content or another choice after termination; malformed packet/choice/delta shapes; incomplete EOF; empty output; explicit token truncation despite short text; and isolation of completion metadata between successive attempts. Valid forms include split wire records, final content combined with `stop`, and optional empty-choice usage after termination.

| Run | Adapter SHA-256 | Result |
|---|---|---|
| Before correction | `4a40f247c804136ea49b04af33fc1c1b9f638b3a03bea3931ff00017094cb127` | New contract: 0/29; existing review: 11/11 |
| Corrected source | `5dd6712ffdcfc17fc53d4ebba3903e414862ace20aa3bc9fb5542d3f73f5032f` | New contract: 29/29; existing review: 11/11; combined 40/40 |

The first run does **not** establish 29 behavioral defects: several failures only reflected the previously absent completion-reason status field. Actual accepted-invalid streams included missing/null terminal reason, `length`, repeated/conflicting reasons, content after `stop`, and an array-shaped terminal delta. The results were observed in tool output; no separate full pre-fix TAP receipt was created by this reviewer. Historical native receipts were preserved unchanged.

The only change to the existing `llm-review.test.mjs` is its valid response helper: it now emits a separate `stop` chunk before `[DONE]`. Its 11 prior assertions remain intact.

## Source findings

`companion/local-language-model.mjs:295` clears completion metadata for each admitted attempt. Lines 326–345 validate packet, choice and delta shapes, require supported reasons, and reject any subsequent choice. Empty-choice usage packets are ignored. Lines 349–358 require `[DONE]`, a reason, nonempty well-formed text and reject truncation. Lines 363–371 publish metadata only after bounded reader cleanup and reject cancellation occurring during that cleanup. No additional defect was found in this bounded source review.

`lastGenerationFinishReason` remains null for malformed, incomplete and cancelled attempts. A valid rejected `length` stream retains its own terminal reason and bounded timing data; it returns no usable text. The production owner's focused suite covers cancellation during cleanup. A separate reviewer covers rejection before conversation history and voice; those downstream results are not claimed as these 29 tests.

## Pinned runtime compatibility

The official llama.cpp **b11065**, commit `ce8caa6e60a03093351d6016a818720e0d46f0fb`, [chat-stream serializer](https://github.com/ggml-org/llama.cpp/blob/ce8caa6e60a03093351d6016a818720e0d46f0fb/tools/server/server-task.cpp#L438) was read on 2026-09-22. Lines 438–490 emit remaining content with null reasons, one terminal empty delta with `stop` or `length`, and optional empty-choice usage afterward. Tool-call completion is deliberately unsupported by this text-only adapter. This source supports the accepted separate-terminal and usage forms; it is not a fresh wire capture from the installed binary. The combined content-plus-stop test is supported tolerance, not a claim that this pin emits that shape. No change to model, prompt, output budget or native diagnostic criteria was made by this review.

## Frozen reviewer artifacts

| Artifact | SHA-256 |
|---|---|
| `companion/tests/llm-completion-review.test.mjs` | `1aaf2f7a450fb5541afe9ff5d49bd480baaf9c72ebc3eb6673e142a184e091f3` |
| `companion/tests/llm-review.test.mjs` | `51c6359c10d0d136143ba4e4148f09a76852693ad417267215513dca95613c57` |

These checks close a concrete completion-admission defect. They do not explain all previous grounding failures, retroactively relabel earlier native outputs, or establish factual conversation acceptance. The supervising task owns the complete regression run and any future native experiment.
