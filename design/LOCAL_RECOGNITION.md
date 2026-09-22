# Bounded local file transcription

Prepared 2026-09-22. **Project interface; no MW5 API.** This component turns an explicitly supplied short WAV into untrusted text through the installed CPU whisper.cpp command-line executable. It starts no HTTP service and has no dependency on a paid API. The later [push-to-talk preview](PUSH_TO_TALK_PREVIEW.md) connects explicit browser capture through a separate workbench coordinator; real microphone/inference acceptance remains unperformed.

The earlier resident-server experiment improved six synthetic-clip timings, but its unmodified listener has no verified authentication gate and exposes unnecessary routes. This file-only adapter supplies a reviewable baseline without enabling that listener. It intentionally retains cold model startup. The historical cold benchmark's 2.430-second sample p95 did not meet the 1.5-second recognition requirement; implementing this adapter does not change that requirement or establish better latency.

## Contract

`companion/local-recognition.mjs` exposes `createLocalRecognition(options)`:

- `start()` checks the pinned installation and resource reserves. It performs no inference and starts no process. Its public promise has a deadline and settles promptly on stop; outstanding filesystem operations retain the occupied preflight slot until they drain.
- `transcribe(wavBuffer, {signal})` admits exactly one canonical PCM16, mono, 16 kHz WAV between 100 ms and 15 seconds. A private byte copy prevents later caller mutation. Requests cannot supply paths, executable names, arguments or model choices.
- `stop()` cancels work and waits for bounded confirmation of the owned child's closure. Unconfirmed work retains the occupied slot, preventing a second worker.
- `dispose()` prevents future startup. `status()` separates process ownership, closure, pending cleanup and failed cleanup.

Production paths are fixed to the existing b5130 CPU runtime and base.en weights. The tracked release-payload inventory and model/archive hashes are checked before startup and each request. CPU threads are fixed to four, GPU execution is disabled and shell execution is disabled. Test I/O overrides are code-only dependencies and mark results `MOCK_ONLY`.

Each request uses a unique directory beneath `companion/local/recognition-tmp`. Input and output are bounded, path resolution and links are checked, and cleanup only removes the expected request files followed by the empty directory. There is no recursive deletion. Native process output is counted for size limits and discarded; it is not surfaced as diagnostics or logged. Public failures use fixed error codes. Cancelled, late or malformed responses cannot become successful transcripts.

Returned text is `UNTRUSTED_RECOGNITION`, in mode `COLD_FILE_TRANSCRIPTION_ONLY`. It is neither evidence of human speech nor an accepted command. This file adapter never invokes the radio scheduler, language model, tactical arbiter or game dispatcher. The separate preview coordinator handles radio interruption and synthetic mission binding; verified echo exclusion, real recipient/target disambiguation and native human-input provenance remain unresolved for game integration.

## Resource and validation limits

The start and per-request admission checks require 10 GiB free disk and 3 GiB available RAM. The RAM check leaves an initial margin above the plan's 2 GiB reserve; it is not a promise about continuous availability or peak model usage. The small smoke supervisor additionally samples RAM and aborts below 2 GiB, which is reactive rather than a hard memory guarantee.

The [independent review](../research/LOCAL_RECOGNITION_REVIEW.md) records **39 passing MOCK_ONLY cases**, alongside **20 implementation cases**. It found and drove fixes for an unresolved public startup promise on stop and a completed worker's late event affecting a successor. Neither fake-process suite ran Whisper. The complete regression receipt is [COMPANION_VALIDATION.json](../research/COMPANION_VALIDATION.json); its hashes bind validation to the reviewed source.

`node scripts/Exercise-LocalRecognition.mjs --check` performs read-only preflight and validates the fixed existing synthetic input. Without arguments the runner is inert. Explicit `--run` processes only the already prepared VA-001 synthetic clip, then disposes the adapter. It writes an exclusive `research/LOCAL_RECOGNITION_COMPONENT_SMOKE.json` receipt and refuses to overwrite one. It records exact source/input hashes and separates an adapter smoke from human recognition, microphone, game-load and latency acceptance. It plays no sound.

The earlier 2026-09-22 read-only checks refused startup with `RECOGNITION_RAM_RESERVE`; no child process was started. The [historical preflight receipt](../research/LOCAL_RECOGNITION_PREFLIGHT_2026-09-22.json) records approximately **1.51 GiB available RAM** and **25.41 GiB free disk** against the frozen source. It stopped before installation verification and inference.

After the user requested closing the unused editor, a normal close completed and [process/window checks confirmed its exit](../research/EDITOR_CLOSE_RESOURCE_2026-09-22.json). A new read-only recognition preflight passed with pinned files verified. The subsequent [one-clip native smoke](../research/LOCAL_RECOGNITION_COMPONENT_SMOKE.json) then correctly transcribed the existing synthetic clip as **"Heard you."**, taking **2,178.6 ms** through the cold CPU adapter. Sampled available RAM stayed at or above **5,685,686,272 bytes (5.30 GiB)**. Disposal confirmed the owned worker stopped and request cleanup completed. This is **PASS_ADAPTER_SMOKE_ONLY**, using the unchanged reviewed adapter; no microphone, playback, network, listener or command dispatch was involved.

This single two-word synthetic clip does not establish natural-speech accuracy, p95 latency, integrated push-to-talk behavior or game-loaded performance. Its measured transcription duration also exceeds the 1.5-second end-to-end target. The required human-recording, actual game workload and real browser/device acceptance remain **NOT_PERFORMED**; UI integration still has only injected/VM/HTTP evidence. Do not rerun the exclusive smoke to overwrite this result.

No artifact is copied into the editor, retail game, save or campaign. Rollback for this component is removal of its project source references; it installs no service and changes no operating-system settings. Interrupted scratch directories are project-local and must be inspected before any manual cleanup.
