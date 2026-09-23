# SmolLM3 large-batch attempt: independent receipt audit

September 23, 2026 UTC. **Input/provenance audit passed; the actual diagnostic is INCOMPLETE.** The first evaluated response reached its ten-second deadline. No evaluated answer was retained. This document audits execution and integrity only; whole-answer adjudication belongs to [the separate result review](SMOLLM3_LARGE_BATCH_RESULT_REVIEW.md). No inference, tests, download, editor/game operation or default change was performed by this reviewer.

## Immutable evidence and reconstruction

- Actual receipt: `research/SMOLLM3_LARGE_BATCH_DIAGNOSTIC.json`, SHA-256 `75850590e076f0014859fd6c7b8fbe0778ffd393ebaaee47f800a8c89b2567e1`.
- Predecessor: `research/SMOLLM3_STATIC_PREFIX_DIAGNOSTIC.json`, SHA-256 `e0f5c52fd4be5c5d1d9baa91b93145bea567438969fc7791a394472f0d3bacb7`.
- Executed runner: `df5b0dd1f39c5e336c0cb5ac5ef224f1f45c08e2996e855004543221ba6b3224`; adapter: `0643cf8b1cd76c7e31d3b2384a661aa29152ba284b282e70c20dfec2e6217622`. These match the [frozen preparation review](SMOLLM3_LARGE_BATCH_RUNNER_REVIEW.md).

All **40 recorded source hashes** match their current files. Both receipt fixtures equal the unchanged fixture files. All **27 input records**—discarded primer plus 26 ordered cases—match the predecessor's original context, actual context, projection, messages and character counts; case identities, capture metadata, provenance and suite labels also match. A read-only calculation using the current pure serializer and projector independently reproduces all 27 messages/projections. No model factory or generation operation was invoked for that calculation.

The receipt retains two previously invoked transfer cases, six transfer cases uninvoked at baseline, and eighteen historical regressions. Only the first, already exposed, transfer case was invoked in this run. All six initially uninvoked cases remain uninvoked. Preparation of their inputs is not invocation or evaluation.

The exact model/runtime pin objects match both `companion/models.lock.json` / `companion/llama-runtime-pins.json` and the predecessor. The model remains SmolLM3 Q4_K_M, revision `4965cb60b150737b68a0408c36aeefb65078f894`, 1,915,305,312 bytes, SHA `8334b850b7bd46238c16b0c550df2138f0889bf433809008cc17a8b05761863e`. The runtime remains llama.cpp b11065, archive SHA `33f941a74b8db38e92690f5f151a770ef5a66481c07dabfe2e505b57e3546807`. Linked setup/metadata hashes match. The adapter reports `PINNED_FILES_VERIFIED` before readiness; this audit compares provenance records and does not claim a second independent hash pass over the large installed binaries.

## Actual settings and native adoption

The only settings differences from the predecessor are `processingBatch: compact → large`, logical capacity `128 → 2048`, physical capacity `64 → 512`, and added native log verbosity `4`. Four CPU threads, no repacking, prompt caching, one slot, 2,048 context tokens, 64 output tokens, 256 characters, sampling and all deadlines remain unchanged. Effective runtime settings agree, including zero GPU layers, loopback host and disabled web UI/MCP proxy.

The owned startup log retains these complete native lines:

```text
0.02.198.317 I llama_context: n_batch               = 2048
0.02.198.317 I llama_context: n_ubatch              = 512
```

`nativeBatchObservation` is `CONFIRMED`, source `OWNED_PROCESS_STARTUP_LOG`, with no observation error; it is preserved through final shutdown. The frozen adapter requires these post-clamp native readings before readiness/generation, and the runner separately checks them. This establishes observed initial context capacities, not the size or throughput of every later decode. Verbosity 4 changes instrumentation as well as batching; this is not an isolated causal speed comparison.

## Execution, resources and shutdown

The receipt spans **04:21:54.493Z–04:22:40.972Z**. Its 46,479.4024 ms monotonic elapsed time agrees with the 46,479 ms wall-clock interval to timestamp rounding. The root reports supervising session **48157**, terminal exit **1**.

| Stage | Recorded outcome | Elapsed |
|---|---|---:|
| Adapter verification/startup | `READY`, pins verified, native batches confirmed | 20,155.3803 ms |
| Discarded primer | Complete text, finish reason `stop`; never scored or added to later history | 16,095.4707 ms of 20,000 ms |
| `transfer-configured-introduction` | Invoked, `FAILED`, `RESPONSE_DEADLINE`; output, finish reason and native timings null | 10,009.8782 ms of 10,000 ms |
| Remaining 25 evaluated cases | `NOT_PERFORMED`; no output, finish metadata or elapsed-operation field | Not invoked |

There are **zero complete evaluated answers**. The explicit `notPerformed` list exactly matches the 25 uninvoked records. The receipt's `STARTUP_INTERRUPTED` error comes from the reused `waitForStartup` cancellation wrapper around generation; startup had already succeeded. It is not evidence of a model-loading failure. No discarded partial response is reconstructed or scored.

The primer's retained native timings are cache 0 tokens, prompt 335 tokens / 15,675.779 ms, and prediction 3 tokens / 403.083 ms. These are component timings for an unscored operation, not conversational acceptance. The failed evaluated response has no retained native timings. Startup includes adapter verification and readiness, rather than only native model load time.

Admission RAM was **6.3011513 GiB** against 5 GiB; minimum sampled RAM was **3.4344482 GiB** against the 2 GiB floor. Initial disk space was **21.9995956 GiB** against 10 GiB. No resource halt is recorded. The unchanged source configures 250-ms reactive memory sampling; the receipt retains initial/minimum readings, not a complete timestamped sample series. This does not prove continuous reserve or capacity alongside MW5.

Final state is `STOPPED`, owned PID null, active generation false, `ownedProcessStopped: true`, exit code `-1`, with no cleanup-deadline error. The fixed seven-second cleanup budget remains intact. The 218.6732 ms difference between total time and recorded operation/startup times also includes checkpoints and other overhead; it must not be relabeled as measured shutdown or human-override latency.

Root independently reported a successful named-process inventory at **04:23:18.2121896Z**, with no editor/game/llama/whisper worker. This reviewer separately obtained **zero matching processes at 04:25:46.6607832Z** using a read-only inventory scoped to `UE4Editor`, `MW5Mercs`, `MechWarrior*`, `llama-server`, `whisper-cli` and `whisper-server`. These observations support post-run absence within their scope; they are not an all-system historical monitor.

## Decision

The exclusive attempt and predecessor remain unchanged. Native batch adoption was observed, but the response deadline failed and the required screen did not complete. No quality score, four-second first-spoken pass, gameplay benefit or full-conversation acceptance follows from this attempt. Per the predeclared [CPU decision](LOCAL_CPU_NEXT_DECISION.md), **stop isolated CPU tuning pending a measured game-resource and integration baseline**. No retry or additional tuning is proposed or performed here.
