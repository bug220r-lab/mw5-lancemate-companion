# Official 1.7B relative-fact diagnostic: independent receipt audit

Date: 2026-09-22 local time. The supervising task reported terminal harness exit 0 before this review. **Provenance, effective configuration, completion accounting and recorded cleanup verified; this is not semantic or release acceptance.** The reviewer performed read-only reconstruction and wrote this audit, without native execution, retries or changes to any earlier source, preparation document or raw receipt.

The immutable [receipt](QWEN17B_RELATIVE_FACTS_DIAGNOSTIC.json), recorded **2026-09-23 00:23:11.071–00:24:42.129 UTC**, has SHA-256 **`456ae004e7497fe9d90a574b218a1da2c47d26b4546c87d21c5133f9d26137a3`**. Its status is `COMPLETE_PENDING_SEMANTIC_REVIEW`, with eighteen completed measured responses, a separate completed primer, no unperformed cases and no halt reason.

## Provenance and actual model selection

All **21 recorded source hashes** match the reviewed files. The embedded frozen fixture matches; all eighteen ordered case identities, capture/provenance records, original contexts, classification-only additions, full projection/audit objects, transformed messages and character counts reconstruct exactly. The primer matches too. Those inputs also match the 4B predecessor byte-content interpretation exactly; no prior generated answer was added to a subsequent context. The fixture retains fourteen known regressions and four predeclared holdouts, with ten inert coordinator captures and eight explicitly unbound adapter contexts. These are synthetic caller assertions, not authenticated game observations.

The exact predecessor remains `QWEN4B_RELATIVE_FACTS_ATTEMPT_002.json`, SHA-256 `e227f94995bab1c44a3296c50202c995e36c9b25d2302f0cd1d05bd6266fb67b`. Its first-case deadline failure and seventeen unperformed cases are preserved. The fallback receipt's `modelSubstitution` metadata matches the fixed selector's verified predecessor and target.

The receipt pins the official **Qwen3-1.7B-Q8_0.gguf**, 1,834,426,016 bytes, SHA-256 `061b54daade076b5d3362dac252678d17da8c68f07560be70818cace6590cb1a`, revision `90862c4b9d2787eaed51d12237eafdfe7c5f6077`, with llama.cpp CPU b11065. Model/archive metadata and extracted-runtime metadata match the existing locks. Native runtime reports `modelId: qwen1_7b`, four threads and `PINNED_FILES_VERIFIED`; this is more than a changed report label. The reviewer did not independently rehash or reload the large native artifacts.

Every diagnostic setting except model ID is identical to attempt 002. Runtime settings additionally confirm CPU-only execution, one slot, compact 128/64 batches, repacking disabled, caching enabled, experimental speaker-relative projection enabled, context 2,048, output limits of 64 tokens and 256 characters, and disabled thinking/web UI/MCP proxy. Temperature remains 0.7, top-p 0.8, top-k 20, without a fixed seed. Resource gates and deadlines were unchanged.

## Timing and resource accounting

| Recorded measurement | Outcome |
|---|---:|
| Startup, including adapter verification/readiness | 5.527 seconds |
| Discarded primer, exact output `OK.` | 3.839 seconds |
| Startup plus primer | 9.367 seconds |
| Eighteen complete-text times | 2.274–6.513 seconds |
| Median complete-text time | 4.660 seconds |
| Descriptive nearest-rank p95 of eighteen samples | 6.513 seconds |
| Complete texts over four seconds | **12/18** |
| Total recorded run, including checkpoints/cleanup | 91.058 seconds |
| Initial available RAM / free disk | 5.153400 / 25.009464 GiB |
| Minimum sampled available RAM | 3.053982 GiB |

All requests completed within the unchanged ten-second diagnostic operation limit. That does not satisfy the four-second **first-spoken** target: no synthesis, playback or first-audible timestamp exists here, and the current complete-text-before-synthesis path already exceeds four seconds for twelve responses. The descriptive p95 is not a statistically established acceptance result or performance with MW5 running.

The primer records zero cached tokens, 213 processed prompt tokens and three predicted tokens. The measured responses record 126–222 cached prompt tokens, 35–187 newly processed prompt tokens and 14–55 predicted tokens, with valid native timing objects for all eighteen. These counters support prefix reuse in this run. They do not identify model size as the sole cause of any difference from the earlier 4B run: background load, stochastic answer lengths and startup conditions were not controlled. No quantified causal speedup or model-quality improvement is claimed.

Fresh admission exceeded the five-GiB RAM and ten-GiB disk requirements. The sampled RAM minimum remained above the two-GiB running floor, with 250-ms sampling and no resource halt. These are whole-system samples, not isolated model peak allocations, continuous reserve guarantees, or evidence for simultaneous game, recognition and synthesis workloads.

## Cleanup and remaining limits

Final state is `STOPPED`, `ownedPid: null`, `ownedProcessStopped: true`, `activeGeneration: false`, exit code `-1`, with no cleanup error. The adapter's stopped-ownership flag follows its observed child-exit path; `-1` can represent a signal exit without a numeric child code and is not independently diagnosed as a model crash. This receipt supports cleanup of its owned worker; it does not prove that every unrelated system process was absent or separately measure cleanup latency.

All eighteen returned outputs are preserved in full and marked undispatched/unplayed. Their completion status says the adapter returned a completed stream, **not** that the words satisfy the frozen semantic criteria. The adapter permits token-limit completion and does not expose finish reason; counts below 64 do not substitute for missing finish-reason evidence. Independent semantic review must retain naturalness, identity, unknown-state and command-boundary requirements without awarding partial credit for selected clauses.

No game/editor execution, download, microphone capture, generated audio, playback or default model/caching/projection change is recorded. The earlier 1.7B and 4B factual failure sets remain valid for their versions. Source integrity, text completion and confirmed shutdown cannot by themselves establish reliable conversation, personal-style matching or readiness for live mission radio.
