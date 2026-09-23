# Local speech repair result

September 23, 2026. **PASS_RESIDENT_COMPONENT_SMOKE_ONLY** for one bounded CPU trial on existing synthetic audio. The passive observer remains incomplete and this result does not advance its runtime acceptance.

## Actual result

The trial ran from **06:11:16.360 to 06:11:24.234 UTC**. Startup reached READY in **1.140 seconds**. All three requests returned validated text matching their normalized reference. The same owned worker PID, 29952, served every request.

| Request | Reference and returned text | Request wall time |
| --- | --- | --- |
| VA-001 | Heard you. | 1.508 s |
| VA-006 | Withdrawal understood. No more target suggestions. | 1.751 s |
| VA-001 repeated | Heard you. | 1.464 s |

These are individual measurements, not a percentile or a claim that the 1.5-second acceptance target is met. The first and second requests exceed that proposed bound. Two unique synthetic clips do not establish recognition quality for human speech, microphone input, noisy missions, recipient selection or commands. The repeated clip checks this sequence only. No improvement over a previous engine is claimed because decoding configuration and background load were not controlled for that comparison.

The minimum sampled available RAM was **5,888,565,248 bytes** (about 5.48 GiB). Sampling is reactive, not a memory reservation. This was not measured while MW5 was running. The parent reported DISPOSED, no owned PID, no busy/pending work and confirmed process stop; the trial's postflight process inventory was empty. A separate read-only Windows process query at **06:12:09.037 UTC** found PID 29952 absent and no processes in the recorded game/model/project-Python scope. No unowned process was stopped.

## Preserved evidence

| Artifact | SHA-256 |
| --- | --- |
| Repair terminal receipt, 27,731 bytes | `8d0f249fb406463ea37584a709a6ba7f2d1ccc6041981c998532bbaca44eac9a` |
| Original failed receipt, unchanged | `3a51114ad1044ccb0f605cee5bdd87a02f251f6a8b47877d12b8077d204fdb26` |
| Original sixteen-source manifest, unchanged | `a06c90bd481297d989fa2eace667aad8c0b0d4fb8c0de09b9cee1c11133c7216` |
| Reviewed runner used by repair trial | `5672128aea67dab3baf5b42a8be46afff2176374e867a1f0d3c0f5316085832e` |
| Reviewed repaired worker | `5c041fa4db196d65b12ae7650536532cc9a8b7d0e51d9a3cc303f95a7df44bad` |

The terminal [repair receipt](RESIDENT_RECOGNITION_REPAIR_SMOKE.json) retains all seventeen current source hashes, input WAV pins, runtime/model pins, full untrusted returned text, timing, PID continuity, RAM samples, original-attempt verification, pre/post process inventories and cleanup. Source bytes were checked unchanged before and after the trial. It is separate from the earlier [failed receipt](RESIDENT_RECOGNITION_COMPONENT_SMOKE.json), whose installation-check failure was not erased.

Independent reviewer `identity_evaluation` subsequently rehashed all seventeen recorded sources, the original receipt/manifest and sixteen archived sources, both WAV inputs, the model/archive and all forty installed runtime payloads: **zero mismatches**. It independently checked the three full reference matches, one-PID continuity, 36 RAM samples and terminal cleanup fields. This was a read-only receipt/artifact audit; no inference was repeated. The review agrees that two requests exceeded 1.5 seconds and that no percentile, human-speech, device, game or causal speedup acceptance follows.

The separate full offline regression receipt at 06:04:32 UTC records **1,343/1,343 PASS, MOCK_ONLY**. A later hash comparison found all 131 implementation/test/configuration and other recorded files unchanged; only the repair-plan document differs, because its 65-second deadline attribution was clarified from parent to runner after that test run. The native trial pins the corrected document. The original test receipt was not rewritten and passing tests were not needlessly repeated for that wording edit.

Before inference, read-only preparation verified the repaired installation. The restricted runner could not obtain Windows process inventory; a direct diagnostic identified `Get-CimInstance` access denied, HRESULT `0x80041003`. The reviewed preflight passed when granted the required process-read permission. No verification guard was removed to bypass that failure.

## Scope and next boundary

The worker used pinned local Whisper CPU files, English GREEDY decoding and four threads. Native version reported `1.9.4`. No download, network call, paid API, microphone, speaker playback, public listener, game/editor launch, command dispatch or default-adapter switch occurred. This closes the specifically authorized timestamp-repair component trial. Human-audio evaluation, game-resource acceptance and any future integration need their separate evidence; none is claimed here.

The observer-first task should now return to its remaining authoring dependency. Broad speech/model tuning is not the next action while that goal remains the priority.
