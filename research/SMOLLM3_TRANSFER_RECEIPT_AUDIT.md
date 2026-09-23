# SmolLM3 transfer receipt integrity audit

September 23, 2026 UTC / September 22 local. **PASS for receipt/input/pin/accounting consistency; native diagnostic INCOMPLETE.** This audit does not judge answer quality. No model, game, editor or audio process was started by the auditor.

The terminal [receipt](SMOLLM3_MODEL_TRANSFER_DIAGNOSTIC.json) has SHA-256 `ffd7341cf63f55d4994c3ddecc06eba5421f1c19e014c2365d0236928f5959ff`. The model reached READY, then its discarded primer exhausted the unchanged ten-second operation deadline. There is no completed answer and no evaluation-case invocation. All eight fresh cases therefore remain unexposed by this run; all eighteen historical cases remain exposed regressions with this attempt NOT_PERFORMED.

## Independent checks

A read-only Node audit rehashed the receipt and all **25** recorded source files: every hash matched. It invoked preparation only, using the frozen fresh fixture and predecessor, then compared the reconstructed primer and all **26 ordered records** against the receipt. Original contexts, actual contexts, complete projections, capture/provenance records, full role/content messages and character counts matched exactly. The fresh and regression fixtures, treatment and predecessor also matched. No production file or earlier receipt was changed.

- The first eight records are the exact fresh fixture order; the remaining eighteen are the exposed regression order. Fresh contexts use direct synthetic bindings, with zero coordinator captures; the old suite includes ten inert coordinator captures. Neither is native identity evidence.
- Every model message equals the candidate formatter output from its corresponding context. Criteria remain in receipt fixtures, not model messages; no later context contains a response from this run. The deliberately unbound fresh context remains unbound.
- All 26 cases have `status: NOT_PERFORMED`, null output/finish reason/native timings, no dispatch/playback and no semantic judgment. `notPerformed` equals their ordered ID list exactly.
- The primer is FAILED with null output, null finish reason and null native timings. The adapter's final completion metadata is also null. No truncated prefix, terminal stop or completed response is reconstructed from the log.

The setup and metadata links were independently revalidated with the runner's pure installation validator. Setup SHA `df497b311c276ba0f28878829ca6283d3de6c9b780941e9f0ab142c7cfd45a67` records VERIFIED_DOWNLOAD. Metadata SHA `664081abc411d183f43b51bd0599b999f25d068b26190df6c3320e17d99641a7` links those exact setup bytes, architecture `smollm3`, GGUF v3 and template SHA `b9b66f04c64fbb8695cf5b35c37780efd0b8e0829fbfe3e30fafb9f469b7d30e`. Recorded model pins equal the current lock's SmolLM3 Q4_K_M and llama.cpp b11065 entries; runtime pins equal their source manifest. This audit did not repeat the binary rehash; the executed adapter records PINNED_FILES_VERIFIED.

## Timing, resources and teardown

| Receipt measurement | Result |
|---|---:|
| Startup through READY | 5,723.712 ms |
| Discarded primer before failure | 10,005.2172 ms |
| Whole recorded run | 15,860.738 ms |
| Initial available RAM | 5.147766 GiB |
| Lowest sampled available RAM | 3.135002 GiB |
| Initial free disk | 22.911919 GiB |

Admission exceeded 5 GiB RAM and 10 GiB disk; sampled RAM stayed above the 2 GiB runtime floor. Settings retain CPU four threads, one slot, 2,048 context tokens, 64 output tokens/256 characters, compact 128/64 batches, no repacking, caching and the three experimental flags. RAM sampling is not proof that no between-sample dip occurred.

`error: STARTUP_INTERRUPTED` is the reused wait helper's cancellation label, **not a failed startup**: [`waitForStartup`](../scripts/Exercise-ConversationGrounding.mjs) is also called around generation in [`perform`](../scripts/Exercise-ConversationModelTransfer.mjs). READY and startup timing precede the primer; the decisive reason is `haltReason: OPERATION_DEADLINE`. The native log records prompt processing at 256 tokens / 77% after 8.59 seconds, approximately 29.79 prompt tokens/second. This is partial prefill evidence, not output throughput, a full prompt token count or an answer-quality result.

Final runtime is STOPPED, null owned PID, inactive generation and owned-process-stopped true, with no cleanup error; exit code -1 is consistent with the interrupted owned worker and is not a normal completed generation. The remaining 131.8088 ms after subtracting startup and primer includes other bookkeeping/checkpoint/teardown time; the receipt does not isolate cleanup latency. Parent additionally reported the supervisor exited with code 1 and a successful process inventory found no matching model/game/editor/recognizer; that inventory was not rerun by this auditor.

No factual quality, first-spoken latency, reliable termination, gameplay acceptance or release milestone passes from this attempt. The result is a bounded primer timeout with consistent fail-stop accounting and recorded owned cleanup. No further run was performed for this audit.
