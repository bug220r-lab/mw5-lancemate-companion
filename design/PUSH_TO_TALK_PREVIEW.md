# Push-to-talk preview

Date: 2026-09-22. Status: **IMPLEMENTED_OFFLINE_PREVIEW; microphone/browser/native inference acceptance NOT_PERFORMED**. This is a project interface for the local workbench, not an MW5 speech or command API.

The preview lets the user deliberately hold a button, release it to request local transcription, then inspect the resulting text. Copying that text into the existing command field does not parse or execute it. Parsing remains a separate click and produces only a nondispatchable synthetic parser result. No recording starts on launch, after a mission change or on receipt of generated speech. No recognized text is automatically passed to a language model.

## Explicit flow

1. Start the synthetic mission and prepare local recognition. The preflight checks the pinned installed Whisper CLI/model and available resources. Preparation does not start a microphone or recognition process.
2. Hold the talk button, or hold Space/Enter while that button has focus. The server grants one capture lease tied to the current synthetic mission and all three actor/pawn/generation bindings. The browser stops its current preview audio and requests microphone permission only from this deliberate action.
3. Release to submit a canonical mono 16 kHz PCM16 WAV to the authenticated loopback workbench. The browser releases tracks and its audio context before submission. Maximum capture is 15 seconds, minimum 100 milliseconds. A 20-second grant includes permission/setup time; a slow first permission decision can require another hold.
4. Local cold-file recognition has a ten-second total preview deadline. Read the untrusted transcript, optionally copy it to the command field, then separately click Parse. The transcript expires after five seconds. Copied text is still an editable fixture, with no authority to issue game commands.

Browser permission, microphone availability, natural-speech accuracy and real listening still need a supervised test. The user was away during implementation; tests did not activate a microphone. The latest earlier component preflight failed its 3 GiB available-RAM admission gate while the editor was open. The workbench does not close unrelated applications to make room. A passing preflight is not evidence of acceptable performance during MW5.

## Boundaries and lifecycle

`speech-input.mjs` wraps the separately reviewed [local recognition adapter](LOCAL_RECOGNITION.md). Its context is `{session, phase, micMuted, bindings:[{id,pawnId,generation,aiOwned,alive}]}`. All three bindings must be distinct, alive and AI-owned, phase must be active, and microphone mute must be false. It snapshots and rechecks this context on both sides of asynchronous work and when status is read. This context does **not** include live controller identity, observation age or native human-input provenance; a future game adapter must supply those separately. Current grants are synthetic only.

Human possession, mission reset, pause, microphone mute, explicit interruption, expiry and clock rollback revoke the lease. Old IDs and late worker results cannot overwrite a successor. A cancelled public request may settle before its worker or filesystem activity finishes; internal ownership remains occupied until those operations drain. An elapsed stop timeout is not a confirmed shutdown. Shutdown status includes pending preparation, recognition and stop work rather than relying solely on a process flag.

One radio speaker remains enforced. Beginning capture cancels pending conversation/audio and raises the radio push-to-talk gate. Submission releases that gate after local recording has stopped; transcription itself does not speak. The browser rejects listening while its own capture is active. Audio delivery rechecks the gate after file reads. Echo cancellation is requested from the browser but is not verified suppression of game audio, other applications or another device; a transcript never proves the input came from the player.

Browser capture uses AudioWorklet, channel averaging, a Blackman-windowed low-pass filter (65–257 taps depending on input rate) and resampling to 16 kHz. It retains at most 240,000 PCM samples. Unsupported input rates fail closed. Release, cancellation, lost focus, hidden/unloaded page, mute and lifecycle changes stop tracks/context; a permission promise that resolves after cancellation immediately has its returned tracks stopped. Cleanup attempts each resource independently; uncertainty is reported and blocks another capture. The worklet emits silence to its output rather than monitoring the microphone through the speaker. It sends completed samples after each audio quantum to avoid retaining a final partial block; browser scheduling and overhead remain unmeasured.

## Transport and data

The existing private loopback server accepts exact `audio/wav` bytes on `/api/recognition/<captureId>`, with its process-session bearer token and matching Host/Origin checks. Maximum body is 480,044 bytes. A current capture ID is required before body collection; only one upload may occupy the slot. Recognition is separate from the JSON action lock so cancellation can be handled while transcription is pending. Client disconnect cancels only its own capture.

Browser PCM and the displayed transcript stay in memory. The file adapter temporarily writes the admitted clip and transcript into its fixed project-local scratch directory, deletes only its exact owned files and reports blocked cleanup instead of deleting broadly. No audio or transcript is put in preferences, persisted command history, remote backups or native game assets by this feature. Unconfirmed scratch cleanup can leave local files; see the adapter status. The browser/backend/model interaction uses no paid service and requires no public listener.

## Verification and remaining experiment

The implementation suite, separate adversarial coordinator review, actual-client VM tests, worklet numerical checks and loopback HTTP tests are synthetic. Their exact source hashes and combined counts are in [COMPANION_VALIDATION.json](../research/COMPANION_VALIDATION.json); the independent findings are in [SPEECH_INPUT_REVIEW.md](../research/SPEECH_INPUT_REVIEW.md) and [MICROPHONE_REVIEW.md](../research/MICROPHONE_REVIEW.md). They do not establish visual rendering, microphone permissions, real device cleanup, native recognition quality or latency.

The next supervised local experiment is: ensure resource preflight passes, start one synthetic mission, hold/release one short phrase, compare the transcript, then exercise release-before-permission, cancellation, mute, pause and mission reset. Confirm the OS microphone indicator turns off and no game action occurs. Stop on unwanted capture, continued capture after release, an unexpected process, unconfirmed shutdown or low-memory refusal. Rollback is stopping the workbench and its owned workers; no game files or campaign changes are involved. The 100-recording accuracy and 1.5-second p95 targets remain untested by this increment.
