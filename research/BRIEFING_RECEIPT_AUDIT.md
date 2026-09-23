# Speaker-briefing diagnostic: independent receipt audit

Reviewed 2026-09-22 local time after the supervising task reported terminal harness exit 0. **Provenance, effective settings, completion accounting and recorded cleanup verified. Semantic acceptance is a separate review.** This reviewer performed only read-only comparisons/reconstruction and wrote this document; no native execution, retry, test-suite run or earlier artifact modification occurred.

The [raw receipt](QWEN17B_BRIEFING_DIAGNOSTIC.json), recorded **2026-09-23 00:43:20.644–00:44:50.278 UTC**, has SHA-256 **`f63a50b7d1c20d98ce106fbb4a907dd03bb75fecd972c29b1645ad30c47b8389`**. Its status is `COMPLETE_PENDING_SEMANTIC_REVIEW`: all eighteen measured responses and the separate primer returned text, with no unperformed cases or halt reason.

## Provenance and treatment isolation

All **26 recorded source hashes** match current reviewed files. The frozen fixture remains `ec7106cd5a0518489cd46dcea24ef8f0ab6facfbff5c31f4f8b5716a889f9108`. All eighteen ordered IDs, provenance/capture records, original contexts, classification-only additions and complete projection/audit objects match the exact predecessor, [QWEN17B_RELATIVE_FACTS_DIAGNOSTIC.json](QWEN17B_RELATIVE_FACTS_DIAGNOSTIC.json), SHA-256 `456ae004e7497fe9d90a574b218a1da2c47d26b4546c87d21c5133f9d26137a3`. The primer matches as well. All nineteen changed message pairs and character counts reproduce the reviewed briefing serializer exactly; all projection objects independently reconstruct from their recorded contexts.

The ten coordinator captures and eight unbound contexts retain the original synthetic observations, history and uncertainty. The treatment changes both system wording and fact presentation; it does not change the facts, evidence criteria or projector. All eighteen cases are now exposed regressions. The four original holdout provenance records remain intact, but none is a fresh holdout for this treatment. No prior generated response was added to another context.

The harness is pinned at `1b7962da1de164ba15b021f10b1171b3f6395abd29386c3863c117dc972a2320`, serializer at `4a40f247c804136ea49b04af33fc1c1b9f638b3a03bea3931ff00017094cb127`, and unchanged projector at `4b402ff008389075df0cbe53d371de1b4dc9000a774e249682948c3be7725d6d`. The fixed treatment metadata points to the verified predecessor and new receipt. Expectations stay in the fixture/receipt, outside the model messages.

## Actual configuration and timing

Model pins and extracted-runtime pins equal the predecessor. Runtime reports official **Qwen3-1.7B-Q8_0.gguf**, SHA-256 `061b54daade076b5d3362dac252678d17da8c68f07560be70818cace6590cb1a`, llama.cpp CPU b11065, four threads and `PINNED_FILES_VERIFIED`. The native log names that model and four-thread pool. This reviewer did not rehash or reload the large native artifacts.

Both diagnostic settings and effective runtime settings match the predecessor after removing the single added `experimentalSpeakerBriefing: true` field. The relative-projection flag remains enabled; CPU-only, one slot, compact 128/64 batches, no repacking, caching, 2,048 context tokens, 64 output tokens and 256 output characters are unchanged. Sampling settings remain temperature 0.7, top-p 0.8, top-k 20, without a fixed seed. The ten-second operation deadline, 233-second work budget and seven-second cleanup budget remain unchanged.

| Recorded measurement | Outcome |
|---|---:|
| Startup | 5.474 seconds |
| Discarded primer (`OK.`) | 5.006 seconds |
| Eighteen complete-text times | 2.536–6.985 seconds |
| Median complete-text time | 4.124 seconds |
| Descriptive nearest-rank p95 | 6.985 seconds |
| Complete texts over four seconds | **11/18** |
| Total run, including checkpoints/cleanup | 89.634 seconds |
| Initial available RAM / free disk | 5.153660 / 24.978020 GiB |
| Minimum sampled available RAM | 2.988110 GiB |

Every operation completed within its diagnostic deadline. This does not meet the four-second first-spoken acceptance target: eleven texts alone exceeded four seconds, and no speech synthesis or audible-response measurement exists. These eighteen stochastic samples do not establish causal speed improvement, reliability, or performance alongside MW5. Initial admission cleared five GiB RAM/ten GiB disk; 250-ms RAM samples remained above the two-GiB running floor. Samples are not continuous reserve guarantees or per-process peak allocations.

## Completion, cleanup and limits

All eighteen full returned strings are retained, nonempty and within 256 characters, marked undispatched and unplayed. Predicted-token counts range from three to 64. **`requested-victory-is-not-evidence` reaches 64**, and the adapter does not record `finish_reason`; completion therefore cannot establish absence of token truncation. Semantic review must assess complete answers and this uncertainty without treating selected correct words as a pass. This audit assigns no semantic scores.

Final runtime is `STOPPED`, `ownedPid: null`, `ownedProcessStopped: true`, `activeGeneration: false`, `lastError: null`, exit code `-1`, with no cleanup error. This records observed termination of the owned worker. It does not independently inventory unrelated processes, establish a model crash from `-1`, or separately measure cleanup latency.

The receipt records no download, game/editor execution, microphone capture, synthesis, playback or default configuration change. Earlier native receipts and failure reviews remain unmodified and applicable to their recorded versions. Completed text generation and valid provenance are not full conversation, live radio or release acceptance.
