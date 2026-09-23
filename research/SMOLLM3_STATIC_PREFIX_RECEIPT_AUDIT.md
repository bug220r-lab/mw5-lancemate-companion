# SmolLM3 static-prefix receipt integrity audit

September 23, 2026 UTC / September 22 local. **PASS for source/input/accounting consistency; native diagnostic INCOMPLETE.** This audit makes no semantic judgment and started no model, game, editor or audio process. Only this report was created.

The terminal [receipt](SMOLLM3_STATIC_PREFIX_DIAGNOSTIC.json) has SHA-256 `e0f5c52fd4be5c5d1d9baa91b93145bea567438969fc7791a394472f0d3bacb7`. Its primer and first evaluation response completed with confirmed stop. The next response reached its ten-second deadline; the other 24 cases were not invoked.

## Independent parity checks

A read-only Node audit rehashed **all 32 recorded source pins**, with no mismatch, and used inert preparation to reconstruct the exact variant. The fixtures, treatment, predecessor and all **27 prepared records** matched. For every primer/case record:

- Original context, actual context and projection equal both preparation and the preceding warm-up receipt. Case order, ID, capture and the variant's declared exposure/provenance match preparation.
- Both user messages and all roles are byte-identical to the warm-up baseline. The system message is exactly the old fixed instruction prefix, then its existing separation/nonthinking suffix, then unchanged personality JSON. An independent reconstruction from the old complete segments matched; the only added character is one separating newline. No wording, facts, unsupported raw data, histories or requests were shortened or supplied as answers.
- Every case retains its 10,000-ms configured budget; the discarded primer retains 20,000 ms. No dispatch or playback occurred.

The first two cases are correctly labeled previously invoked transfer cases, followed by six uninvoked-at-baseline transfer cases and eighteen historical exposed regressions. In this run, the first group has one returned answer and one failed invocation; the remaining two groups are wholly NOT_PERFORMED. `notPerformed` equals those 24 ordered IDs. They retain null output, finish reason and timings. The failed second operation also retains null output/finish/timings; it is not a completed or truncated answer. No new transfer case was reached.

The predecessor remains `ce3a0cd8238b4081433a4837782587bf35fc671e81f04251fc6d56e8dc392327`. All seventeen archived `research/QWEN*.json` and `research/SMOLLM3*.json` files at commit `682e142854d64661bd93459f99635e9c39d9e1cf` still match their exact Git bytes. Reading that commit's source blobs independently verified the predecessor runner `30adddbdbb62692faeb7dd568ce5b0dd312ecfa76a6aba65235993e25602b72c` and adapter `5cd1f9ec9a872cf3c1d6a45344d6f73de295c94c0a2e0822fb9d28ffe6965902`.

This run pins runner `e4a66ff4881e06450c2fa7a65722f541157cd12f757a422b4c3366fcd25d1320` and adapter `840e38296555cbda077b9e3290b308dbf7acc055e4c7b2b422e3119b3b2015d3`. Model/runtime pins and linked setup/metadata equal the predecessor and pass the pure installation validator. Removing only `experimentalStaticPrefix: true` from recorded settings and effective runtime settings leaves the predecessor settings exactly. Binary verification comes from the executed adapter's PINNED_FILES_VERIFIED status; this audit did not repeat the binary rehash or capture the native rendered template.

## Arithmetic and termination

| Phase | Elapsed | Completion | Native prompt evaluation | Native generation |
|---|---:|---|---|---|
| Startup to READY | 5,769.7724 ms | READY | Not applicable | Not applicable |
| Discarded primer | 13,091.2712 ms | stop | 335 tokens; cache 0; 11,167.241 ms | 24 tokens; 1,907.944 ms |
| First evaluation response | 7,375.3166 ms | stop | 186 tokens; cache 196; 6,433.915 ms | 12 tokens; 931.879 ms |
| Second evaluation response | 10,006.3486 ms | RESPONSE_DEADLINE | No confirmed terminal diagnostics | No confirmed terminal diagnostics |

Cold startup plus primer was **18,861.0436 ms**. Whole-run elapsed time was **36,396.9555 ms**; 154.2467 ms remains outside the recorded phase durations for other work/checkpoints/teardown. This residual is not an isolated cleanup measurement.

The first evaluation response records 196 cached tokens versus 155 in the warm-up run, and 186 evaluated prompt tokens versus 225. Its generation length also changed, from ten to twelve native tokens. These are measured single-run differences, not causal speedup, reliability or spoken-latency acceptance. The next response still timed out; its partial progress log cannot be converted into a full response timing breakdown or reconstructed output.

Initial available RAM was 5.118195 GiB; its sampled minimum was 3.015953 GiB. Initial free disk was 22.871197 GiB. Admission and sampled reserve thresholds passed; between-sample minima remain unknown. All CPU, cache, sampling, context/output and deadline settings otherwise remain the recorded baseline.

The generic `STARTUP_INTERRUPTED` label comes from the helper also wrapping generation. Startup had succeeded; the specific halt reason is RESPONSE_DEADLINE. Final runtime is STOPPED with null owned PID, inactive generation, null completion metadata and owned-process-stopped true, without a recorded cleanup error. The interrupted worker's exit code is -1. Parent reported supervisor exit 1 and separately owns the post-run process inventory; this auditor did not perform that inventory.

Receipt integrity and bounded termination do not establish correct dialogue, a four-second spoken response, full conversational reliability or game readiness. Whole-answer review belongs to the separate evaluator. No additional native run was performed for this audit.
