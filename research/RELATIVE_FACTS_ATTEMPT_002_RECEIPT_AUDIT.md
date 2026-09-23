# Relative-fact attempt 002: independent receipt audit

Date: 2026-09-22 local time; receipt interval **2026-09-23 00:07:35.239–00:08:01.528 UTC**. The supervising task reported terminal exit 1 before review. Verdict: **receipt provenance and failure accounting verified; measured language evaluation incomplete**. No inference, retry or source/receipt edits were performed by this reviewer.

The immutable [attempt-002 receipt](QWEN4B_RELATIVE_FACTS_ATTEMPT_002.json) has SHA-256 **`e227f94995bab1c44a3296c50202c995e36c9b25d2302f0cd1d05bd6266fb67b`**. The predecessor remains byte-identical at `a4970f273317987ec2ab807dc4a23c3c362cadc6cea81a10b375094b84902771`; its earlier RAM refusal is not overwritten.

| Stage | Recorded result |
|---|---|
| Fresh admission | 5.148232 GiB available RAM and 25.043819 GiB free disk; above unchanged five-/ten-GiB gates. |
| Native startup | `READY`, `PINNED_FILES_VERIFIED`, approximately 6,878.970 ms. |
| Discarded primer | Completed with exact output **`OK.`**, approximately 9,223.631 ms. It is not a measured semantic case. |
| First measured case, `identity-heat-self-low` | `FAILED`, null output, approximately 10,003.940 ms; per-operation deadline fired. |
| Remaining cases | **17 NOT_PERFORMED**, including thirteen other known regressions and all four holdouts; all outputs null. |
| Overall result | `INCOMPLETE`, zero completed measured cases out of eighteen, `haltReason: OPERATION_DEADLINE`. |
| Cleanup | `STOPPED`, `ownedPid: null`, `ownedProcessStopped: true`, `activeGeneration: false`; no cleanup error recorded. |

`STARTUP_INTERRUPTED` appears as the receipt and failed-case error because the existing `waitForStartup` helper is also used to await generation and gives that label to any abort. It does **not** mean startup or the primer failed: their earlier success is directly recorded. The native log includes processing of the subsequent request, consistent with first-case failure. Its unfinished prompt-progress line is not an answer or a complete timing measurement. The first measured case has no native timing object; seventeen later cases have no generation timings at all.

The minimum sampled available RAM was **2.462223 GiB**, above the unchanged two-GiB running floor; the recorded stop reason was time, not memory. Samples do not establish an uninterrupted memory minimum between polls or performance with MW5 running. Total recorded time was approximately **26,288.482 ms**, including startup, primer, first-case wait and shutdown/checkpoints; it is not response latency. The primer records 213 prompt tokens, zero cached tokens and three predicted tokens, with 8,986.976-ms prompt processing and 212.418-ms prediction. Those are calibration costs, not an eighteen-case latency distribution or first spoken audio.

The final runtime's exit code `-1` is the adapter's fallback for a child exit without a numeric code, including signal termination. Coupled with the source's exit-observed ownership flag, null PID and stopped state, it supports termination of the owned worker. It does not establish a separate native crash, nor prove absence of every unrelated process. No cleanup latency was independently instrumented in this receipt.

The reviewer independently matched **all 21 source hashes** to the recorded current files, the embedded fixture and exact attempt/predecessor metadata. All eighteen original contexts, classification-only additions, capture/provenance records, projection/audits, transformed messages and character counts reconstruct exactly; the primer matches too. The fixture stays frozen at `ec7106cd5a0518489cd46dcea24ef8f0ab6facfbff5c31f4f8b5716a889f9108`, with ten inert coordinator captures and eight unbound contexts. Model/runtime metadata match their locked records. Unlike the predecessor's admission refusal, this run reached the native adapter's pinned-file verification and ready state.

Runtime settings confirm Qwen 4B, four CPU threads, compact 128/64 batching, no GPU layers, no weight repacking, one slot, caching enabled, 2,048 context tokens, 64 output tokens, 256 output characters and the explicit experimental projection. The ten-second operation, 233-second work and seven-second cleanup limits are unchanged. All measured cases remain undispatched and unplayed. The receipt records no download, game/editor execution, microphone capture, audio generation, playback or default model/caching/projection change.

There is **no completed measured answer to adjudicate**. One attempted deadline failure is not seventeen additional semantic failures, and unperformed holdouts cannot pass. The adapter still does not expose finish reason; no inference about the timed-out answer's hypothetical correctness or truncation is justified. The earlier identity and broader factual failure sets remain valid for their recorded versions. This audit does not convert a successful primer, successful cleanup or source-integrity pass into conversation acceptance.
