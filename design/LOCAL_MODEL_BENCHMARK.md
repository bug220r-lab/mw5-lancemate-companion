# Local conversation and speech benchmark

Version 1, 2026-09-21. **PROPOSED provider selection and procedure. No model/download/install/game/microphone benchmark was performed.** This document replaces older cloud-first recommendations for the user's current requirement of zero recurring service charges, mission-only memory and single-player with three AI lancemates. It does not authorize downloads or native execution by itself.

Recorded host: i7-10750H, RTX 2070 Max-Q with 8 GiB VRAM, approximately 16 GB RAM. Historical environment details are in [FEASIBILITY](../research/FEASIBILITY.md); available memory, free disk, driver and game configuration must be refreshed before a real benchmark. None of these candidates has demonstrated acceptable simultaneous MW5 performance on this host.

## Candidates verified against primary sources on 2026-09-21

| Function | Default candidate | Fallback and limits | Primary evidence |
|---|---|---|---|
| Push-to-talk transcription | whisper.cpp **v1.9.4**, English `base.en`, CPU initially | `tiny.en` if CPU contention is excessive. Project estimates base 142 MiB disk/~388 MB memory, tiny 75 MiB/~273 MB; these are not whole-process or concurrent-game measurements. MIT engine. | [Official repository](https://github.com/ggml-org/whisper.cpp), [v1.9.4 release](https://github.com/ggml-org/whisper.cpp/releases/tag/v1.9.4) |
| Three configurable voices | **Kokoro-82M model v1.0**, explicitly CPU | **Piper v1.8.0** maintained OHF fork if Kokoro cannot meet resource/latency/quality needs. Kokoro code and model Apache-2.0; Piper engine GPL-3.0 and voice-specific terms are separate. | [Kokoro model](https://huggingface.co/hexgrad/Kokoro-82M), [code license](https://github.com/hexgrad/kokoro/blob/main/LICENSE), [CPU selection source](https://github.com/hexgrad/kokoro/blob/main/kokoro/pipeline.py), [Piper release](https://github.com/OHF-Voice/piper1-gpl/releases/tag/v1.8.0), [Piper voice guidance](https://github.com/OHF-Voice/piper1-gpl/blob/main/docs/VOICES.md) |
| Short grounded conversation | **Qwen3-4B Q4_K_M**, nonthinking mode in llama.cpp | **Qwen3-1.7B Q8_0**, then authored context-specific dialogue if the smaller model cannot meet quality. Official model files are respectively 2.50 GB and 1.83 GB, excluding runtime/KV cache. Qwen weights Apache-2.0; llama.cpp MIT. | [Qwen 4B model](https://huggingface.co/Qwen/Qwen3-4B-GGUF), [1.7B files](https://huggingface.co/Qwen/Qwen3-1.7B-GGUF/tree/main), [llama.cpp](https://github.com/ggml-org/llama.cpp) |

The newest llama.cpp build observed during research was **b11065**, explicitly marked pre-release. Pin a validated runtime/build and model revision/hash during implementation instead of promising stability from the newest number. No runtime was installed or selected by execution. [Official releases](https://github.com/ggml-org/llama.cpp/releases)

For Kokoro, audition `af_heart`, `af_bella` and `am_michael` as distinct female/female/male presets, with each pilot independently configurable. These are released preset voices assigned to original fictional characters, not newly trained or cloned voices. Kokoro's `af_sarah` is unrelated to ElevenLabs Sarah; the shared name is not evidence of similar sound. Its author notes that very short utterances can be weak, which is directly relevant to combat radio. Include actual two-to-eight-word barks and pronunciation of mech names. Longer pleasant samples alone are insufficient. [Official voice inventory and limitations](https://huggingface.co/hexgrad/Kokoro-82M/blob/main/VOICES.md)

Piper's VCTK medium is a candidate for several speaker slots in one model; its card lists 109 speakers, a CC BY 4.0 dataset and fine-tuning from Lessac. Final speakers, model provenance and redistribution terms require artifact-specific review. The catalog's broad MIT header does not replace individual model cards. [VCTK card](https://huggingface.co/rhasspy/piper-voices/blob/main/en/en_GB/vctk/medium/MODEL_CARD)

Local operation avoids subscription/API charges; it still consumes electricity, disk and computing capacity. There is no promise of ElevenLabs-equivalent quality or real-time performance. Package all required phonemizers/model/voice assets deliberately and prove disconnected operation after approved setup, rather than allowing lazy runtime downloads.

## Storage gate before any proposed acquisition

The pure project interface is:

```js
storagePreflight({freeBytes, downloadsBytes, stagingBytes, cacheBytes, reserveBytes: 10 * 1024 ** 3})
```

All byte counts must be known nonnegative safe integers. Unknown runtime wheels, dependency installers, model files, staging expansion or future cache allowances mean **INCOMPLETE**, not zero. The calculation is conservative simultaneous occupancy:

`freeBytes >= downloadsBytes + stagingBytes + cacheBytes + reserveBytes`

The reserve defaults to **10 GiB** and cannot be reduced below 10 GiB through the argument. A larger explicit reserve is allowed. `remainingBytes` means free bytes after the planned allocations, before subtracting the reserve. Overflow, missing values, negatives or coerced strings fail closed. Exact equality with the reserve passes the arithmetic gate; it is not proof that the estimates are accurate.

This task did not query current disk space. Historical editor-install figures cannot satisfy the current preflight. The reported model-file sizes in the candidate table are not complete download estimates, and are not automatically written into this checker as a sufficient budget. Collect an exact manifest with measured dependency sizes, installation/staging overlap, model hashes, cache caps and destination volume before requesting/performing acquisition. Never use cleanup of unrelated files as an automatic workaround.

## Resource experiment and selection rules

1. Before the authorized supervised benchmark, resolve game/adapter versions, actual DLC/mod state and the disposable mission manifest. Close the editor normally for the game measurement; do not terminate unrelated processes. Capture a representative vanilla mission baseline on AC power with fixed graphics and comparable thermal conditions. Preserve complete frame-time, available-RAM and available-VRAM traces with timestamps.
2. Benchmark each local component with fixed recorded fixtures outside gameplay, then the combined stack. Use one shared LM process for all three personas, one shared TTS engine, serial utterance generation, bounded queues and mission-only state. Begin with explicitly CPU transcription/TTS; benchmark the LM CPU path as a reference. GPU offload is an experiment only after measuring spare VRAM. Eight GiB total VRAM is not eight GiB available to a model while MW5 runs.
3. Proposed initial conversation workload: 2,048-4,096 context tokens, 64-96 generated-token limit, nonthinking mode, current mission facts only and one response at a time. Separate actor identity/personality/state records; do not load three model copies. Cache approved common acknowledgements, cancel queued speech for player input, and discard responses whose state became obsolete. These settings are tunable proposals, not native MW5 settings or measured optimums.
4. Gather at least 100 command recordings spanning ordinary commands, callsigns, mech names, varying speech pace and battle-audio conditions. Retain every recording/transcript/intent/recipient/dispatch result and latency. Wrong-recipient dispatch is a failure even when average recognition is high. An uncertain recognizer must yield to the checked command policy; never infer authority from fluent text.
5. Audition all three voices with the user. Retain original text, voice/model identity and user comments. Include short damage/target alerts, longer exchanges and game vocabulary. Naturalness and distinctness are explicit user acceptance observations; the checker does not invent scores or an unapproved quantitative naturalness threshold. If a fallback sounds unacceptable, preserve authored subtitle/text responses while the voice selection remains pending.
6. Run representative grounded exchanges, both player-to-pilot and pilot-to-pilot. Measure input completion through first audible speech, including scheduling/transcription/generation/TTS where applicable. Report p50/p95, count, full workload and each stage; do not report only warm-cache best cases. There is no approved minimum conversation sample count; predeclare enough cases for a useful tail estimate and report uncertainty when evidence is sparse.
7. Compare matching runs across the 12-cell three-mode matrix and run the 60-minute all-three-AI session described in [TACTICAL_EVALUATION_PROTOCOL](TACTICAL_EVALUATION_PROTOCOL.md). The exact approved automated resource gates are **p95 frame time <=110% of paired vanilla**, **minimum available RAM >=2 GiB**, **minimum available VRAM >=1 GiB**. Command STT p95 is **<=1500 ms**, joint command/recipient correctness **>=95%**, no wrong-recipient dispatches; conversation p95 first audio **<=4000 ms**. One-percent-low FPS and long stalls are diagnostic findings, not extra release blockers.
8. Repeat the representative workload with network disconnected. Confirm all components stay local, the workload finishes and paid API calls remain zero. Preserve this proof; a local URL or configuration name does not establish offline operation by itself.

If the default fails the resource/latency gate, try the bounded fallback and repeat the same cases. A smaller model must also pass grounding and voice/persona quality review; faster output alone is insufficient. If neither conversation candidate meets the gates, use authored contextual responses and retain independent tactical functions. No language model or speech failure may delay the human's game input, clear a human-order latch or make a stale game action valid.

All actual results remain **NOT_PERFORMED** until captures from the approved setup are reviewed. The current [synthetic release fixture](../synthetic/release-benchmark.json) cannot resolve hardware fit, local voice quality, native acceptance or gameplay improvement.
