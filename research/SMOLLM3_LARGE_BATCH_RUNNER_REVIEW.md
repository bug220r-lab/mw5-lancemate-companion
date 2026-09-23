# Independent review: larger CPU batches

September 23, 2026 UTC. **PASS_MOCK_ONLY preparation review; native large-batch execution NOT_PERFORMED and on hold for the editor/observer work.** No implementation blocker was found within this bounded review. This is not native adoption, performance, conversation, or game acceptance.

## Scope and source identity

Reviewed the experimental adapter, fixed runner, [design](../design/SMOLLM3_LARGE_BATCH_EXPERIMENT.md), [native-observation source note](SMOLLM3_BATCH_OBSERVATION_SOURCE.md), nine implementation tests, six runner tests, and twelve independently specified tests. All test workers, HTTP responses, memory readings and receipt writes were injected; no model, audio, editor or game was started.

| Reviewed file | SHA-256 |
|---|---|
| `companion/local-language-model.mjs` | `0643cf8b1cd76c7e31d3b2384a661aa29152ba284b282e70c20dfec2e6217622` |
| `scripts/Exercise-ConversationModelTransfer.mjs` | `df5b0dd1f39c5e336c0cb5ac5ef224f1f45c08e2996e855004543221ba6b3224` |
| `companion/tests/smollm-large-batch-review.test.mjs` | `c20c9f7382ab94a9bf6b7b2e10950525130d4965ca06bb79ee03f9bf60d3a620` |
| `companion/tests/smollm-large-batch.test.mjs` | `f1242e8761f5cef896ea483e0e4227393b9f1181dd066113fa3f2e8a1945dbf1` |
| `companion/tests/model-transfer-large-batch.test.mjs` | `3967c87fd16418aca963b06cad5dcb649d145bcfe5f15f78fe5d812125718d1b` |
| `research/SMOLLM3_BATCH_OBSERVATION_SOURCE.md` | `3490db4fd59d683d8eb493835d369fe35d5976266ce6bf8f767e6f1d0b1f5e3a` |

The unchanged predecessor is `research/SMOLLM3_STATIC_PREFIX_DIAGNOSTIC.json`, SHA `e0f5c52fd4be5c5d1d9baa91b93145bea567438969fc7791a394472f0d3bacb7`. Independent hashing of Git blobs at `7d44b06154ad602bf207e947240ff3e7bcc6b21d` confirms its recorded adapter `840e3829…` and runner `e4a66ff4…` are recoverable with exactly those full receipt hashes.

## Findings

The adapter’s `batchLogReader` and `confirmBatchObservation` (lines 216 and 246) keep requested settings separate from observed startup capacities. Large mode explicitly requests `-b 2048 -ub 512 --log-verbosity 4`. The source note documents post-clamping library logs and the INFO-to-TRACE-4 mapping at pinned llama.cpp commit `ce8caa6e60a03093351d6016a818720e0d46f0fb`; this review checked the implemented parser against that documented format. An independent web refetch returned cache misses, so this review does not claim a second successful retrieval of those upstream files.

The parser accepts complete anchored native lines with the documented optional wrapper, on separate bounded stream buffers. Missing, partial, oversized, cross-stream, prefixed, decimal, ANSI or trailing-data lookalikes cannot establish confirmation. Wrong capacities or duplicate metrics reject. The health gate is outside the retryable fetch catch; tests confirm that a healthy response without proof fails immediately, stops the owned child and never generates. Proof resets on restart, ignores old children, freezes before inference, survives normal log-tail eviction and cannot be changed through returned status objects.

The factory permits this mode only for the explicit Smol experimental path. The fixed runner separately enforces four CPU threads, no repacking, caching, 2,048 context tokens, 64 output tokens and 256 characters. Its additional native-observation guard rejects intended settings without confirmed observed 2048/512, the correct source and verbosity, and no observation error.

Every original/actual context, projection and message in the discarded primer and 26 cases matches the predecessor exactly. Actual injected inference payloads match preparation; criteria are absent from messages. Exposure remains **two invoked transfer cases, six uninvoked transfer cases and eighteen exposed regressions**. The fixed new receipt uses exclusive creation; changed inputs, metadata, limits or destination are rejected before worker creation. Historical receipts are preserved.

Limits remain 20 seconds for the primer, ten per response, 233 seconds total work, seven seconds cleanup, 250-ms sampling, five GiB initial RAM, two GiB running RAM and ten GiB free disk. The shared operation/cleanup paths are unchanged. The new runner tests demonstrate RAM loss cancels the primer, nulls output and leaves all evaluated cases unperformed. No deadline increase or weaker completion rule was introduced.

## Validation and limits

The first independent run was **10/11**, not a pass: one test incorrectly expected the general factory to fix threads/repacking/cache too. The agreed API assigns those constraints to the fixed runner. That review assumption was corrected, and a separate test verifies the runner refuses their relaxation. It was not an observed implementation defect.

The final focused command ran `smollm-large-batch-review.test.mjs`, `smollm-large-batch.test.mjs` and `model-transfer-large-batch.test.mjs`: **27/27 PASS_MOCK_ONLY**, zero failures or skips. Twelve cases are independent review checks. No full-suite result is claimed here.

Verbosity 4 changes instrumentation as well as batch size; timing cannot be attributed solely to batching. Startup capacities do not prove every decode uses that batch, and synthetic log tests do not prove the installed native formatter or memory fit. Only a later gated attempt can supply that evidence. Sampling remains reactive, semantic review remains required, and the existing first-spoken-response and full-mod acceptance targets are unchanged.
