# Qwen3-4B grounding diagnostic: independent receipt review

Reviewed 2026-09-21. **All three experiments are INCOMPLETE. No completed reply is available for semantic review.** The resource and deadline controls stopped the attempts; this is neither a grounding pass nor a grounding failure for the model.

This review inspected the three saved receipts, the current runner and adapter, the predeclared fixture, and their hashes. It did not start a model, repeat an experiment, modify a test, or alter a receipt.

## Observed results

| Configuration and receipt | Total elapsed | Successful startup | Lowest sampled available system RAM | Reply disposition | Terminal reason |
|---|---:|---:|---:|---|---|
| [Original batch settings, repacking enabled](QWEN4B_GROUNDING_DIAGNOSTIC.json) | 9,236.7189 ms | Not reached; no startup duration recorded | 2,106,843,136 bytes / 1.962151 GiB | 0 attempted; all 12 `NOT_PERFORMED` | `RAM_RESERVE_LOST`; `STARTUP_INTERRUPTED` |
| [Compact 128/64 batches, repacking enabled](QWEN4B_GROUNDING_COMPACT_DIAGNOSTIC.json) | 9,209.5795 ms | Not reached; no startup duration recorded | 1,576,218,624 bytes / 1.467968 GiB | 0 attempted; all 12 `NOT_PERFORMED` | `RAM_RESERVE_LOST`; `STARTUP_INTERRUPTED` |
| [Compact 128/64 batches, repacking disabled](QWEN4B_GROUNDING_NOREPACK_DIAGNOSTIC.json) | 18,122.5487 ms | 7,911.9852 ms, including adapter verification/startup | 3,172,077,568 bytes / 2.954227 GiB | 1 attempted and failed on deadline; 11 `NOT_PERFORMED`; 0 completed | `CASE_DEADLINE`; `GENERATION_CANCELLED` |

The last run attempted `history-is-not-acceptance-or-completion`. Its recorded elapsed time is **10,011.425 ms**, with `status: FAILED`, `output: null`, and `semanticReview: NOT_PERFORMED`. The ten-second diagnostic limit was reached; the small elapsed excess includes cancellation/return overhead. A failed timed request is not an incorrect factual answer. The eleven remaining cases were never requested.

The no-repack native log records model readiness, one processing slot with context 2048, and prompt processing before interruption. It does not supply a complete answer or a first-token timestamp. `output: null` establishes that the adapter returned no completed response; it does not prove that no internal token computation occurred.

Every receipt records `ownedProcessStopped: true`, final state `STOPPED`, `ownedPid: null`, and `activeGeneration: false`. Each records `nativeCalls: 0` both at receipt and final adapter level. Here **native calls means game-control calls**: a local llama.cpp executable did run. All receipts also retain `audioGenerated: false`, `microphoneCapture: false`, `speakerPlayback: false`, `gameExecution: false`, `downloads: false`, `defaultModelChanged: false`, and `candidateEnabled: false`.

## What the resource observations establish

The [runner](../scripts/Exercise-ConversationGrounding.mjs) requires at least 5 GiB available RAM before startup and samples available system RAM every 250 ms, stopping below 2 GiB. The **2 GiB value is a reactive stop threshold, not a guaranteed reserve**. Both startup failures fell below it before the process stopped. The measurements are sampled whole-system availability, not isolated model peak memory or a continuous minimum.

Smaller batches did not establish an improvement in these attempts. Disabling repacking was associated with successful startup and a higher sampled RAM minimum in the third attempt, but these sequential, uncontrolled system-memory observations do not isolate causation or prove reliable operation. The third configuration still failed to return its first complete answer within the diagnostic limit.

The run retained four CPU threads, context 2048, one slot, 64 output tokens, 256 output characters, no GPU layers, `cache_prompt: false`, temperature 0.7, top-p 0.8 and top-k 20. Sampling had no fixed seed. The final configuration only added compact processing batches and disabled weight repacking. It did not reduce context or change the model file.

The field `targetFirstSpokenMs: 4000` is a target label, **not a measurement**. There was no speech synthesis, playback, microphone input, or full spoken-response latency test. There is also no completed text-response latency result for this model/configuration series. Startup completion alone does not meet the interaction target.

## Runner and adapter controls

Read-only source review confirmed:

- Importing the runner or taking its no-argument/`--check` path does not start a model. Execution requires `--run`.
- Each configuration has a separate receipt path, opened with `wx` before engine construction. An existing receipt causes refusal before the write/finally path, preserving earlier evidence.
- The runner uses `createLocalLanguageModel({modelId: 'qwen4b', ...})`; it does not duplicate raw server launch or inference code. Startup must report `PINNED_FILES_VERIFIED`.
- The adapter verifies the fixed model, runtime archive and tracked runtime-file pins before launch. The runner records fixture, model-lock, runtime-pin, persona, adapter and runner source hashes.
- Requests run sequentially. Any case error or deadline stops the run instead of continuing with another case. `notPerformed` enumerates unattempted fixture IDs, while an attempted failed case remains in `samples`.
- A 233-second work timer, startup abort race, signal handlers, and a seven-second bounded cleanup attempt are present. Cleanup failure is labeled `OWNED_PROCESS_STOP_UNCONFIRMED`, not success. These three actual runs all finished well inside four minutes; this does not prove universal timing guarantees under arbitrary OS/filesystem stalls.
- The [adapter](../companion/local-language-model.mjs) still defaults to `qwen1_7b`, `processingBatch: 'default'`, and `weightRepacking: true`. Optional compact and no-repack arguments are code-only configuration; these experiments did not select 4B as the default.

## Preserved provenance

All three receipts contain the same predeclared [12-case fixture](../synthetic/conversation-grounding-cases.json), whose actual current SHA-256 matches their recorded value:

`2139103acf90c3eab87eb2e1bf38d25de75e069e0f295b19ab23600962f331fb`

The pinned model is `Qwen3-4B-Q4_K_M.gguf`, 2,497,280,256 bytes, with SHA-256 `7485fe6f11af29433bc51cab58009521f205840f5b4ae3a32fa7f92e8534fdf5`, from Qwen revision `bc640142c66e1fdd12af0bd68f40445458f3869b`. The runtime is llama.cpp `b11065`; archive SHA-256 is `33f941a74b8db38e92690f5f151a770ef5a66481c07dabfe2e505b57e3546807`. These identities are recorded in the [model lock](../companion/models.lock.json); the receipts report successful adapter pin verification. This review did not repeat the multi-gigabyte model hash operation.

Actual receipt hashes at review:

| Receipt | SHA-256 |
|---|---|
| Original | `7be55d4e263e01bbcb2babaf2c803f20afc0ddcb53a8e54bbe6534a91d4f6982` |
| Compact | `94b5c631f4d0281de06572d33464b71bead06cf89041a670d299cd34396a3c8c` |
| Compact/no-repack | `26130f7945e835e681a90d1d1956bc737d9dade44e1815e5d2fd1e377448a816` |

The runner and adapter evolved between configurations. Their **original recorded hashes remain unchanged in each receipt**:

| Configuration | Runner SHA-256 | Adapter SHA-256 |
|---|---|---|
| Original | `be9a5060aebd7bf5b2c5b22c13a333f9826a882f7d850ab7860883b1ff2820d0` | `99075f252cfab699b5747c3f0a639c761d336ec0c179d3fd9d64fc0c15c370af` |
| Compact | `97956553629fbc6d95e4f96394bec11a146b1ed6b851bf3d995a02be3a20d105` | `0f466e57afa2438e6a803e646e129ee2e780e89ea0b395514fa383274e065673` |
| Compact/no-repack | `854a21929d8a4ed5238acf63b7cfd35961c9d65b11faecd53b1ee24246ca7deb` | `4190bd17759e0774a846c3c10afd2d093fe20bd0b4d1889a16ecbde417390885` |

At the initial independent review, the runner and adapter matched the final row. The fixture, persona, model-lock and runtime-pin hashes are identical across all three receipts. Earlier source hashes must not be replaced with newer hashes or presented as checks of a later source revision.

Post-review maintenance note: the root subsequently bounded both successful and not-ready health-response body cancellation in the adapter using its existing abort signal. Independent injected tests first reproduced a shutdown hang for both cases, then passed after the fix. That later adapter edit was not used in these model experiments; no experiment was rerun to imply otherwise. The complete offline regression receipt binds the newer source separately.

## Disposition

**Semantic review: NOT_PERFORMED. Live mission speech, spoken latency, user-style acceptance and gameplay acceptance: NOT_PERFORMED.** There is no basis here to claim that 4B resolves the smaller models' documented factual failures, nor to conclude that it cannot do so. The evidence establishes two resource aborts and one timed-out first request on this machine/configuration.

No further configuration trials belong to this bounded experiment. Preserve all three receipts, leave 4B unselected, and carry this result into the project handoff without promoting startup or protective shutdown into model-quality acceptance.
