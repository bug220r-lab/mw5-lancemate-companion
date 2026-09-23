# Shared-prefix layout experiment

September 23, 2026 UTC. **PROPOSED local component diagnostic; no native result at this preparation checkpoint.** The previous goal turn made progress: tested warm-up handling, obtained a complete response and a response deadline failure, independently reviewed both, and backed up the source. The editor remains closed. This work does not resolve the separately owned native observer investigation.

## Mechanism and one change

The [prior finding](../research/SMOLLM3_PREFILL_FINDING.md) records 7.733 seconds of prompt processing within the sole 8.500-second complete response. Variable personality data occurs before two static system instructions, interrupting their shared prefix. Cache reuse is observed, but better reuse and faster replies from reordering remain hypotheses.

Add one opt-in `experimentalStaticPrefix` variant, restricted to the existing synthetic-only SmolLM3 path. Build its system message from the exact existing parts in this order: base instructions, request-separation instruction, `/no_think`, personality-data segment. Preserve every word and JSON value, adding only necessary separating newlines. Both user messages must be byte-identical. Do not shorten observations, history, unknowns, source references or instructions; do not move data between roles, insert answers, or modify evaluation criteria. Default SmolLM3 and Qwen messages/settings remain unchanged.

The comparison receipt is `research/SMOLLM3_WARMUP_DIAGNOSTIC.json`, SHA-256 `ce3a0cd8238b4081433a4837782587bf35fc671e81f04251fc6d56e8dc392327`. Its exact executed adapter and runner are preserved at Git commit `682e142854d64661bd93459f99635e9c39d9e1cf`: adapter SHA `5cd1f9ec9a872cf3c1d6a45344d6f73de295c94c0a2e0822fb9d28ffe6965902`, runner SHA `30adddbdbb62692faeb7dd568ce5b0dd312ecfa76a6aba65235993e25602b72c`. Current source changes do not rewrite that prior execution.

## Fixed execution and limits

Preparation is `--check-static-prefix-003`; execution is `--run-static-prefix-003`. Only the latter may exclusively reserve `research/SMOLLM3_STATIC_PREFIX_DIAGNOSTIC.json`. Refuse an existing receipt before starting a worker. Verify the predecessor's raw hash, READY state, completed primer/first response, second response deadline, remaining 24 unperformed and stopped owned process. Reconstruct and compare all baseline contexts, projections and messages before applying the new layout.

Use the same pinned SmolLM3-3B Q4_K_M and b11065 runtime, CPU-only four threads, one model/slot, compact 128/64 batches, no repacking, prompt caching, 2,048 context tokens, 64 output tokens, 256 characters and unchanged sampling. Keep the same discarded `Say OK.` primer and all 26 questions in order. No actual response enters later inputs. The primer allowance remains 20 seconds, each case 10 seconds, total work 233 seconds, cleanup seven seconds, 250-ms resource sampling, initial available RAM five GiB, running reserve two GiB and disk reserve ten GiB. No new download is needed.

Failure, cancellation, bad completion, resource loss or a deadline stops the run, with failed output null and later questions NOT_PERFORMED. Preserve terminal `stop` versus rejected `length`; absence of terminal metadata remains unknown. Stop only the owned worker and independently verify process absence. No editor/game, audio, microphone, dispatch, defaults or retail changes; rollback is shutting down the owned model worker.

## Evaluation and decision

Two transfer questions were invoked previously and are now exposed. The other six remain uninvoked; eighteen old questions remain exposed regressions. Preserve original fixture provenance, but explicitly identify this current exposure in the new receipt. Never call the 26 questions a fresh holdout. The unchanged per-case required meanings and forbidden claims govern an independent whole-answer review; no keyword-only pass, self-grade or authored replacement.

Record cold startup, primer, every invoked operation, timeouts and unperformed cases. Report actual native cache/prompt/generation timings only when available. A larger character prefix is not proof of reused tokens or saved time. A single stochastic run cannot establish a causal speedup or representative distribution. Changed instruction order can affect meaning, so compare full answers as well as timing; no performance improvement can waive factual criteria.

The proposed four-second first-spoken response target stays unchanged. Text-only data cannot pass audio latency or the combined game resource budget. Preserve the outcome, including failure; do not retry the same selector or retune based on its output. This experiment informs the next architecture decision, not full conversation or mod acceptance.
