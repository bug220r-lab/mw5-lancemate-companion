# SmolLM3 initialization and ready-state experiment

September 22, 2026 local. **PROPOSED bounded local component diagnostic; native run NOT_PERFORMED at this preparation checkpoint.** It is authorized project-local evaluation under the delivery plan. The unused game/editor stay closed; no downloads, microphone, audio, dispatch or retail changes are involved.

## What the preceding result establishes

The [first candidate receipt](../research/SMOLLM3_MODEL_TRANSFER_DIAGNOSTIC.json), SHA-256 `ffd7341cf63f55d4994c3ddecc06eba5421f1c19e014c2365d0236928f5959ff`, reached native READY after 5.724 seconds, then failed its ten-second discarded primer budget. No evaluation case was invoked. The log records incomplete prompt processing at 256 tokens / 77 percent after about 8.59 seconds. All eight fresh inputs remain uninvoked; the other eighteen remain historically exposed regressions. This supports a distinct initialization experiment, not a conclusion that the model gives good answers or that subsequent requests will be fast.

The original receipt, criteria and source evidence stay intact. Its exact executed runner bytes are preserved at verified private Git commit `afb5c7c1cc5f9552622e8f3770363098f39d71cd`, path `scripts/Exercise-ConversationModelTransfer.mjs`, SHA-256 `fd3ae7557d85ee733244c6759a178c2595791283ae4ce55e73e36103592de663` (22,674 bytes). Root independently hashed that Git blob and matched the original receipt. Extending the current runner changes its current source hash; it does not retrospectively change the historical execution. All prior raw receipts remain immutable.

## One predeclared change

Keep the same pinned SmolLM3 model, b11065 runtime, actual primer, exact 26 contexts/messages, case order, criteria, CPU settings, nonthinking controls, sampling and prompt-cache setting. Change **only the discarded initialization primer's allowance to 20 seconds**, while keeping every measured case at **10 seconds**. The previous partial prefill justifies checking whether a bounded initialization phase can finish; it does not justify repeated timeout increases or moving a slow actual answer into warm-up.

The primer is still the same generic `Say OK.` request using the existing reference format, not an evaluation question. No expected answer from an evaluation case is used as a primer, cached substitute or prompt example. Its generated text never enters later contexts or radio output. Cache state may survive as it did in the first diagnostic; record reported native token/cache timings when present. Prompt caching is not assumed to eliminate all processing or prevent context influence.

The fixed `--check-warmup-002` selector performs preparation without creating a model or result receipt. The fixed `--run-warmup-002` selector exclusively reserves `research/SMOLLM3_WARMUP_DIAGNOSTIC.json`. It checks the exact preceding receipt, successful startup, failed primer, 26 unperformed cases and confirmed stopped worker before any new reservation. Current fixture/input reconstruction and model installation checks remain. Arbitrary receipt paths, models or user-supplied deadlines are not accepted.

## Unchanged limits and accounting

One CPU model and native slot, four threads, compact 128/64 batches, no repacking, 2,048-token context, 64 generated tokens and 256 returned characters. RAM admission remains 5 GiB available, running floor 2 GiB with 250-ms samples, disk reserve 10 GiB, total work phase 233 seconds and cleanup seven seconds. The additional primer allowance consumes this same total work budget. Any resource failure, invalid output/completion, cancellation or deadline stops the run and leaves remaining questions NOT_PERFORMED. Rejected text stays null. Owned cleanup must be verified through the original process handle and a fresh process inventory before any later run.

Record each operation's configured budget, its phase and elapsed time. Separate artifact verification/startup, initialization primer and every actual response. An expired primer and expired measured response must be distinguishable. A terminal transport stop never implies semantic quality. Keep all actual cold-start costs in the report; do not include the primer in response percentiles, hide it from startup costs or count its success as an evaluation pass. The ten-second diagnostic ceiling is not the product target: **p95 first spoken response within four seconds remains unchanged and unproved**. This experiment produces no audio.

## Review and decision

The [eight-case criteria](../research/CONVERSATION_MODEL_TRANSFER_EVALUATION.md) and earlier eighteen-case criteria are unchanged. A separate reviewer and root assess every whole returned answer against them. Report eight fresh-at-first-invocation and eighteen exposed cases separately, with failed operations/unperformed cases visible. Invoked fresh cases become exposed for later work; uninvoked cases do not. No output gets a keyword-only pass, model self-grade or authored replacement.

The useful outcomes are bounded: initialization still fails; it completes but actual requests exceed their deadlines; or complete responses permit factual quality review. None alone completes the conversational milestone or proves acceptable game-loaded resources. Preserve the outcome even if it disappoints. Do not repeat this selector, increase deadlines again without a separate evidence-backed reason, or alter the default model based solely on a few good lines. Rollback is stopping the one owned worker; no other application setting is changed.
