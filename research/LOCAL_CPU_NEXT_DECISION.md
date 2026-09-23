# Next local CPU decision

September 23, 2026 UTC. **Read-only assessment. One untested batch-isolation experiment is justified for later preparation; no further experiment was performed here.** Current CPU conversation still fails to establish the required response time or factual reliability. This is not proof that different hardware must be purchased.

## Evidence and limits

The latest [static-prefix receipt](SMOLLM3_STATIC_PREFIX_DIAGNOSTIC.json), independently verified SHA-256 `e0f5c52fd4be5c5d1d9baa91b93145bea567438969fc7791a394472f0d3bacb7`, records a 7,375.3166-ms introduction: 6,433.915 ms processing 186 prompt tokens, cache count 196, and 931.879 ms generating twelve tokens. The next case failed its ten-second deadline; 24 were unperformed. Minimum sampled RAM was 3,238,354,944 bytes. The preceding [warmup](SMOLLM3_WARMUP_DIAGNOSTIC.json) recorded 8,499.8256 ms, 225 processed prompt tokens and cache 155 for the introduction. These different stochastic responses do not isolate a causal speedup; prompt processing remains the dominant measured cost.

All reviewed SmolLM3 receipts use four CPU threads, compact 128/64 batching and disabled repacking. The earlier [Qwen4B batch/repacking review](QWEN4B_GROUNDING_REVIEW.md) covers three combinations: default batching with repacking hit the RAM floor; compact batching with repacking also hit it; compact without repacking started but timed out. That series does **not** establish the result of larger batching without repacking, particularly for a different model. The editor-closed repeat and cache experiments retained compact/no-repack settings.

The reviewed conversation receipts all used four inference threads. The recorded two-thread setting belongs to artifact re-quantization, not an inference comparison. There is no measured thread-scaling result that justifies a thread sweep. The [Qwen quantization comparison](QWEN_CONVERSATION_QUALITY_REVIEW.md) already found faster derived-Q4 text alongside unacceptable factual claims; repeating it would not solve grounding.

## Single next option

Predeclare **SmolLM3 with explicit logical/physical batches 2048/512, keeping repacking disabled**. This tests whether the compact batching choice restricts prompt-processing throughput. It may increase working memory or fail to improve speed; neither improvement nor reserve safety is assumed. It is a settings hypothesis, not another prompt rewrite.

First make the intended batch sizes explicit and testable. Current `companion/local-language-model.mjs` lines 289–293 only passes `-b 128 -ub 64` for compact mode; default mode omits those arguments while lines 438–439 report 2048/512. A future diagnostic must explicitly pass and record the candidate values and check native adoption where available, rather than treating those derived status fields as independent native measurement. No source change was made in this assessment.

Keep the same model/runtime, four threads, static-prefix messages, all facts/history/criteria, case order, sampling, caching, output caps and 20-second primer/10-second response/233-second work/seven-second cleanup limits. Retain 5-GiB initial RAM, 2-GiB running RAM and 10-GiB disk gates, a new exclusive receipt and one attempt only. Evaluate full answers as well as actual prompt/cache/generation timings; do not call a shorter answer or isolated run a proven speedup. Do not enable repacking or change threads simultaneously.

If that bounded test still fails, stop isolated CPU tuning pending a measured game-resource and integration baseline. Even success would leave combined MW5 frame time, RAM, speech latency and factual quality unproved. GPU offload requires actual spare-VRAM measurement while the game runs; no purchase, offload, longer deadline, dropped fact or default-model change follows from these results.
