# Qwen 4B editor-closed diagnostic: independent result review

Reviewed 2026-09-22. Classification: **OBSERVED local CPU component diagnostic with synthetic prompts; game acceptance NOT_PERFORMED**. This review reads preserved receipts, checks source hashes and compares configuration. It runs no model, editor, game, microphone or speaker.

## Finding

The editor-closed run passed its resource admission checks, verified the pinned model/runtime and reached `READY`. Its first response did not finish within the unchanged 10-second case deadline. The harness cancelled generation, attempted no further cases, and recorded confirmed shutdown of its owned process. **The result remains INCOMPLETE: zero completed responses out of 12, with semantic review NOT_PERFORMED.** Closing the editor did not establish an accepted conversational configuration in this attempt.

Evidence: [new diagnostic](QWEN4B_GROUNDING_EDITOR_CLOSED_DIAGNOSTIC.json), [prior compact/no-repack diagnostic](QWEN4B_GROUNDING_NOREPACK_DIAGNOSTIC.json), fields `status`, `samples`, `haltReason`, `notPerformed`, `runtime` and `finalRuntime`.

| Recorded measurement | Prior no-repack run, September 21 | Editor-closed run, September 22 |
|---|---:|---:|
| Adapter startup to ready | 7,911.9852 ms | 8,455.0392 ms |
| First case elapsed before cancellation returned | 10,011.425 ms | 10,004.2569 ms |
| Completed responses / planned cases | 0 / 12 | 0 / 12 |
| Additional cases not attempted | 11 | 11 |
| Minimum sampled available RAM | 3,172,077,568 bytes (2.954 GiB) | 2,997,612,544 bytes (2.792 GiB) |
| Initial free disk | 17,349,025,792 bytes | 27,155,263,488 bytes |
| Total elapsed, including cleanup | 18,122.5487 ms | 18,631.4025 ms |
| Halt reason / first-case error | `CASE_DEADLINE` / `GENERATION_CANCELLED` | Same |
| Owned process stopped | `true` | `true` |

Both final runtime snapshots report `STOPPED`, `ownedPid: null`, `activeGeneration: false` and `ownedProcessStopped: true`. Exit code `-1` accompanies cancellation/termination; it is not evidence of a completed response or independently diagnosed model crash.

## What was held constant

Direct comparisons found identical embedded 12-case fixtures, first-case message arrays, diagnostic `settings` and `runtime.settings`. The fixture bytes also match both recorded hashes. The attempted case was `history-is-not-acceptance-or-completion`: it asks whether a past, unverified dialogue claim proves an order was accepted or completed. No answer was available to judge that behavior.

Both runs used Qwen3-4B Q4_K_M, CPU only, four threads, one model and one slot, 2,048 context tokens, at most 64 output tokens / 256 characters, nonthinking mode, compact batches of 128 logical / 64 physical tokens, and weight repacking disabled. Sampling remained temperature 0.7, top-p 0.8 and top-k 20, without a fixed seed or prompt caching. The 10-second case deadline, 233-second work budget, seven-second cleanup budget and recorded four-second first-spoken target were unchanged.

“Unchanged” therefore describes inference configuration and test input, **not byte-identical adapter and harness source**:

- The language adapter changed only its two health-response body cancellation expressions to await them through the existing abortable wrapper. Replacing those two expressions in memory exactly reproduced the prior recorded SHA-256 (`4190bd17…`); the current source hash is `0a6a9fd9…`. These are startup cancellation safeguards at [local-language-model.mjs](../companion/local-language-model.mjs), lines 204–208, not generation-setting changes.
- The current harness adds explicit argument parsing and the `--editor-closed` receipt selection/context label. It preserves the model configuration and existing deadlines, and exclusively creates the new receipt before starting a worker. See [Exercise-ConversationGrounding.mjs](../scripts/Exercise-ConversationGrounding.mjs), lines 43–56, 65–85 and 104–148. The receipt explicitly says `editorStateCheckedByScript: false`; its editor condition is supervisor-reported with a separate evidence reference.

## Resource evidence is not performance acceptance

[Editor closure evidence](EDITOR_CLOSE_RESOURCE_2026-09-22.json) records a normal close, zero remaining editor processes/windows, no force termination and 6,024,306,688 available RAM bytes at 21:32:08Z. It is an earlier environmental observation, not the exact Qwen admission sample and not a controlled causal comparison: other allocations can change.

The harness requires 10 GiB free disk and 5 GiB available RAM before startup (lines 104–107), then samples RAM at 250 ms intervals with a 2 GiB stop floor (lines 91–110). Reaching `READY` establishes that this admission path passed; the receipt does not preserve the exact initial 5 GiB admission reading. Its recorded minimum stayed above the 2 GiB sampled floor. This is neither a continuous memory guarantee nor evidence for capacity with MW5, recognition and speech synthesis running together. The two sampled minima do not establish memory regression or improvement.

The new final log contains prompt-processing progress at 128 tokens / 0.66 with 5.76 seconds and 22.24 tokens/second; the prior log records 6.19 seconds and 20.67 tokens/second at that progress point. These single partial progress messages cannot establish a speedup, steady-state token rate, completed-answer latency or p95 performance. The adapter returns only a completed response, so `output: null` does not establish that no internal token or partial stream ever existed. No first-token or first-spoken timing was measured.

The separate [recognition smoke](LOCAL_RECOGNITION_COMPONENT_SMOKE.json) passed one fixed synthetic audio example with confirmed disposal. It neither validates this language model's grounding nor supplies the missing human speech, end-to-end latency or combined-workload evidence.

## Integrity and acceptance boundary

Every new-receipt source hash was checked against current bytes. Personas, model lock and runtime pins are identical to the prior receipt. The adapter reports `PINNED_FILES_VERIFIED`; this review checked recorded/source integrity and did not independently reload or execute native artifacts.

| Artifact | Verified SHA-256 |
|---|---|
| New diagnostic | `da4bcaa158ef443be9b1ff4809760adc1b7ace4d28c2a5c1c43830f1d7a0109f` |
| Prior diagnostic | `26130f7945e835e681a90d1d1956bc737d9dade44e1815e5d2fd1e377448a816` |
| Grounding fixture | `2139103acf90c3eab87eb2e1bf38d25de75e069e0f295b19ab23600962f331fb` |
| Current harness | `50da99c88081092b27c5cfa4f800e3c462cf4aae53d1854fe349ab89232cc106` |
| Current language adapter | `0a6a9fd911e0a05328ce4d371dba55720b5ba0bc521d3fe7291d02b7224fda47` |
| Personas | `1f66276cc3db94dd8dc824d069440c24eb5e2bfb005960b02d9e1ab4b690d0ee` |
| Model lock | `035aa0318e1c3f92de9ede3fbea5cdb8ad5750e5db289774545e86b35a325fc3` |
| Llama runtime pins | `4044968e1b0bef2dade94d3911533df03d225a1cd57761e2dd1eab2e86d47a93` |

No default model was changed and the candidate remains disabled. There was no generated audio, playback, microphone capture, dispatch or game execution in the Qwen diagnostic. A quality pass, four-second conversational acceptance, p95 estimate or general judgment that this model can never work would exceed the evidence. The remaining requirement is a completed, independently reviewed set of responses and measured accepted workload; this result does not justify promotion or an automatic repeated run.
