# Official 1.7B substitution: independent preparation review

Date: 2026-09-22. **PASS_MOCK_ONLY: six independent checks passed**, zero failures, skips or cancellations (199.2352 ms). No native model, game/editor, microphone, playback, download or real fallback receipt was started by this review. This is preparation evidence; a later run still needs fresh resource admission and independent review of its complete outcomes.

The fixed `--run-qwen17b` selector writes exclusively to `research/QWEN17B_RELATIVE_FACTS_DIAGNOSTIC.json`. It substitutes the already installed official `qwen1_7b` artifact, **Qwen3-1.7B-Q8_0.gguf**, 1,834,426,016 bytes, pinned SHA-256 `061b54daade076b5d3362dac252678d17da8c68f07560be70818cace6590cb1a`. It does not select the locally requantized Q4 candidate or change workbench defaults.

## Why this is a changed experiment

The earlier official-Q8 three-prompt smoke completed text in 2.170–3.003 seconds (`LOCAL_CONVERSATION_FALLBACK_BENCHMARK.json`). With richer prompts, six cases took 3.647–5.719 seconds, median 4.463 seconds, and included false order acceptance and invented victory (`QWEN_QUANTIZATION_COMPARISON.json`, `QWEN_CONVERSATION_QUALITY_REVIEW.md`). Its workbench WAV deliveries took 5.866–6.838 seconds, without actual playback (`WORKBENCH_CONVERSATION_BENCHMARK.json`). The derived 1.7B Q4 completed its six texts faster in that earlier comparison but shared factual failures and added invented callsigns/garbled wording; it remains disabled. Background load, output length and differing prompts preclude a quantified causal speedup claim.

Those 1.7B experiments did not test the current eighteen-case speaker-relative projection with caching enabled, compact 128/64 batching and repacking disabled. By changing only the model in the immediately preceding prepared experiment, this diagnostic can collect new evidence without prompt or criterion changes. Prior smaller-model failures remain recorded, not presumed cured. The **four-second first-spoken acceptance target is unchanged**: the ten-second diagnostic collection limit is not an accepted product latency, and faster complete text alone would still need semantic and speech-performance evidence.

## Independent checks

- All eighteen ordered original contexts, synthetic-marker additions, full projections/audits, transformed messages, message sizes and capture/provenance records exactly match attempt 002. The primer matches too. The frozen fixture retains fourteen known regressions and four holdouts, with ten inert coordinator captures and eight unbound contexts. No criterion, history or fact was weakened or removed.
- The real harness invocation of the injected engine factory receives `modelId: qwen1_7b`; every other option is identical. A fake runtime still reporting 4B, disabled caching, enabled repacking or the wrong batch size fails before the primer. This verifies selection beyond a receipt label.
- Read-only production review confirms `main` selects `qwen1_7b` and `llama-cpu` from the existing lock for this selector, and the standard adapter uses the selected model's fixed filename/hash before launch. Actual installed native-file verification remains the future native startup's responsibility; this review did not rehash multi-gigabyte files or launch them.
- The predecessor is exact attempt 002, SHA-256 `e227f94995bab1c44a3296c50202c995e36c9b25d2302f0cd1d05bd6266fb67b`. Preparation and execution independently re-read it; exact metadata/hash and its stopped deadline-failure disposition are required before reservation. Changed metadata, cross-selector fields, paths, models, tuning or mock CLI arguments are refused.
- In-memory filesystem tests preserve both earlier receipts and refuse reuse of the fixed fallback path through `wx`. An existing receipt prevents even engine construction. `--run`, `--run-attempt-002` and inert `--check` retain their earlier selection/context behavior.
- All report settings except model ID exactly equal attempt 002: four CPU threads; caching and projection enabled; compact 128/64 batches; no repacking; context 2,048; output 64 tokens/256 characters; five-GiB initial RAM, two-GiB running floor and ten-GiB disk; 10-second operation, 233-second work, seven-second cleanup and 250-ms sampling. One byte below RAM admission still prevents factory invocation. Injected execution remains explicitly `MOCK_ONLY`, undispatched and unplayed.

The native path has no request/CLI dependency-injection seam. Existing shutdown, halt-first-failure and unperformed-case accounting remain in place. No remaining blocker was found in this bounded source/preparation review. Semantic acceptance, actual latency, resource use under MW5, real speech and player-style matching remain unproved.

## Frozen source identity

| File | SHA-256 |
|---|---|
| `scripts/Exercise-ConversationRelativeFacts.mjs` | `0c8bea654707867b7563f7329c114baa65f44c7730a11596ab1fa859a4966922` |
| `companion/tests/conversation-relative-facts-diagnostic.test.mjs` | `b9ccaa586877fbb1e3d4c3c2f08948bbbb08ac737944453f7077072e97c8e469` |
| `companion/tests/relative-facts-fallback-review.test.mjs` | `dadec5dc506b0b35b57191459103eef213ee831f75d5e6fe02211a2369451a8b` |
| `companion/local-language-model.mjs` | `3e53dd4901270cb250af3fdfa363b924da65108ace452b57cc8fb9b05d92fd4d` |
| `companion/speaker-observations.mjs` | `4b402ff008389075df0cbe53d371de1b4dc9000a774e249682948c3be7725d6d` |
| `companion/conversation.mjs` | `c661f2413a5323f59cd84617a566b83979580e1b24d16e9fa5ff8d8ff01e0c85` |
| `companion/models.lock.json` | `035aa0318e1c3f92de9ede3fbea5cdb8ad5750e5db289774545e86b35a325fc3` |
| `companion/llama-runtime-pins.json` | `4044968e1b0bef2dade94d3911533df03d225a1cd57761e2dd1eab2e86d47a93` |

The fallback receipt was absent at review freeze. That observation is historical if a later explicitly supervised run creates it. This review and its tests are included in that selector's source-pin list; earlier preparation reports and raw receipts remain unchanged.
