# Warm Whisper component benchmark

**OBSERVED — 2026-09-21, Windows x64, official whisper.cpp b5130, base.en, four CPU threads.** One resident model processed the six existing resampled synthetic Zira clips sequentially. The project script verified the model and release archive pins, all 40 recorded runtime files, and input WAV hashes before starting the owned process. There was no microphone capture, playback, download, game activity or UI integration.

| Measurement | Earlier cold CLI | Warm HTTP server |
|---|---:|---:|
| Median complete-response time | 2,030.888 ms | 1,382.382 ms |
| Nearest-rank p95 / maximum, six samples | 2,430.342 ms | 1,462.496 ms |
| Word edits / reference words | 0 / 40 | 0 / 40 |

The observed sample p95 improved 39.82% and met the proposed 1,500 ms recognition component target, with only 37.5 ms margin. Server startup to ready was another 386.562 ms. No warm-up request was discarded. Timing starts at HTTP upload and ends after the full response; startup, audio recording and command handling are excluded. This historical comparison is not controlled for background load or differences in CLI/server decoding defaults. Six synthetic clips cannot establish human-command, noisy-audio or game-load acceptance.

**DOCUMENTED transport limits.** The pinned implementation exposes multipart inference, health and model-loading routes, supplies wildcard CORS headers, and shows no authentication gate in those handlers. A nonexistent static directory still leaves fallback HTML. This benchmark bound only `127.0.0.1` on an ephemeral port with a random request-path prefix; the prefix is not authentication. Conversion was disabled. Client disconnect is not a proven native inference cancellation mechanism. [Official b5130 server source](https://github.com/ggml-org/whisper.cpp/blob/b5130/examples/server/server.cpp) lines 52–65, 697–699, 766–832, 1093–1141 and 1165–1179; [request format](https://github.com/ggml-org/whisper.cpp/blob/b5130/examples/server/README.md) lines 67–85, accessed 2026-09-21.

**PROPOSED next integration gate:** establish authenticated, route-restricted backend transport and owned-process cancellation before any UI connection. Keep transcripts untrusted and separate from command dispatch. Repeat the measurement with the planned human recordings and game workload before claiming the 1.5-second requirement. No deployment or adapter acceptance follows from this test.

Evidence: [full receipt](../research/WARM_WHISPER_COMPONENT_BENCHMARK.json), [project-authored supervisor](../scripts/Exercise-WarmWhisper.mjs), [preserved cold receipt](../research/WHISPER_COMPONENT_BENCHMARK.json). The supervisor's default invocation is inert; `node scripts/Exercise-WarmWhisper.mjs --run` explicitly executes this fixed benchmark and replaces only its warm receipt. The owned server PID 4228 was terminated in `finally`; its close event and supervisor exit code 0 were observed. GPU-disabled initialization was confirmed in the log.

Status: **COMPONENT_SMOKE_PASS; HUMAN_ACCEPTANCE, GAME_LOAD, END_TO_END_VOICE and UI_INTEGRATION NOT_PERFORMED.**

## Later provenance hardening — no inference rerun

The successful timing run used a local runtime inventory alongside the pinned archive hash. That inventory had not itself been derived from ZIP payloads in the benchmark. A separate read-only Python `zipfile` check subsequently verified the official archive hash, hashed all 40 entry payloads without extracting or executing them, and compared each with both the installed files and the hashes already stored in the timing receipt. Every comparison passed.

The resulting source-controlled [runtime pins](../companion/whisper-runtime-pins.json) now anchor future preflight to the official ZIP contents. `verifyWarmPreflight()` checks the pinned archive/model, tracked inventory identity, every file hash and the exact runtime directory contents, without invoking any executable. Its read-only check passed. The [separate provenance receipt](../research/WARM_WHISPER_RUNTIME_PROVENANCE.json) records both script hashes and the unchanged timing-receipt hash. The timing receipt deliberately retains the earlier script hash; the revised script has **not** rerun inference. There were no downloads or native runtime invocations in this follow-up.
