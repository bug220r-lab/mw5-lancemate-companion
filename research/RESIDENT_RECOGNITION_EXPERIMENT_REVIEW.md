# Resident recognition experiment: independent preparation review

Date: 2026-09-23. Verdict: **PASS_STATIC_PREPARATION_REVIEW** for the source snapshot below. This is not native execution or recognition acceptance.

| Reviewed file | SHA-256 |
|---|---|
| `scripts/Exercise-ResidentRecognition.mjs` | `8c7c2906ccd5766e0747c3b2bc2236b61e2cc481dd5a85ae6b7037aea09852a3` |
| `companion/tests/resident-recognition-experiment.test.mjs` | `5bd7018fd7027d6201bb05418bc39396c71d14e05b0f1fa8a21752fff110f310` |

The reviewer read the runner and its current resident/cold adapter paths without importing or executing them. No `--check`, `--run`, model, DLL, microphone, speaker, network, game or editor operation was performed by this review. The implementation owner reports **19/19 injected runner cases passing**, and **64/64** when combined with the parent adapter cases. Those test results are owner-reported MOCK_ONLY evidence, not an independent rerun here.

## Initial finding and correction

The initial implementation marked a request invoked before the guarded timed callback actually called the adapter. Cancellation between those steps could mislabel an uninvoked request. Its first durable prepared checkpoint also retained top-level `nativeInference: NOT_PERFORMED`, although abrupt termination after that checkpoint could leave actual invocation unknown.

The frozen source now records `STARTUP_PREPARED` or `SUBMISSION_PREPARED` with `requestInvoked: null` before the checkpoint. Actual invocation becomes `true` only inside the guarded callback immediately before `start()` or `transcribe()`, with no intervening await (runner lines 185–202). Before the first submission checkpoint, top-level inference is explicitly `SUBMISSION_PREPARED_OUTCOME_UNKNOWN`, or its MOCK-prefixed equivalent. A normal unwind converts never-invoked prepared entries to `false`/`NOT_PERFORMED`; top-level inference becomes `NOT_PERFORMED` only when every request is known uninvoked (234–239). A surviving prepared receipt therefore does not assert an unperformed operation after an abrupt parent exit. The targeted cases inspect this checkpoint and cancellation behavior.

No remaining actionable blocker was found in this bounded source review.

## Reviewed boundaries

- Entry selection is fixed: no arguments is inert; only `--check` and `--run` are accepted. The run reserves the one fixed receipt with exclusive `wx` before preparation or worker construction. Check mode does not construct a worker (41–44, 97–124, 168–182).
- Preparation reads only declared bounded files, verifies both fixed WAV hashes, calls read-only resident preparation and the cold adapter's installation-only verification, and records model/runtime/source evidence. The source snapshot is checked before startup and after cleanup; clips are checked again before submission (45–79, 172–179, 193–195, 233). The native worker independently verifies its pinned installation before loading it; this review does not replace the worker ABI review.
- The sequence is exactly VA-001, VA-006, VA-001. The references are evaluation-only values: the actual adapter receives a copied WAV and abort signal, with no reference transcript or expected-answer prompt (24–29, 193–210).
- One retained worker must report READY and the same owned PID before and after each response. Startup has a 30-second bound, each request 10 seconds, work 65 seconds and disposal 3 seconds; startup/request wall times are separate. Initial and running RAM, disk admission, bounded sampling and pre/post process inventories fail closed on unavailable or conflicting evidence (22–23, 155–167, 175–229).
- A timeout, invalid result, transcript mismatch or resource/source failure stops the remaining sequence. Complete mismatched text remains distinguishable from failed or unperformed requests. `completedCount` counts returned validated results, while `referenceMatchedCount` records the exact normalized-reference outcome; neither claims general recognition quality (203–218, 237–239).
- Cleanup is limited to the owned adapter. Success requires disposal confirmation plus DISPOSED/no PID/no busy or pending preflight, and a successful postflight inventory. Missing closure evidence prevents success (219–231). Private inherited pipes and no device/command integration remain properties of the separately reviewed adapter/worker.

## Limits before interpreting any native result

Three existing synthetic requests cannot establish a human-speech accuracy rate, a latency percentile, game-loaded performance or context isolation beyond this one repeated-clip sequence. Different C API/CLI decoding defaults and uncontrolled background load preclude a residency-only causal speedup claim against older results. RAM sampling is reactive and process inventories are point-in-time checks.

Receipt saves are bounded and synced, but truncate/write is not crash-atomic: interruption during a rewrite can leave incomplete JSON. Such a file cannot establish success or confirmed cleanup. Even a complete prepared checkpoint has explicitly uncertain invocation until a normal terminal receipt resolves it. Native readiness, transcription, actual latency and process closure remain **NOT_PERFORMED by this review** and must be assessed from a later terminal receipt plus independent process evidence.

## Independent repair-runner review — September 23

Reviewer `identity_evaluation` checked the root-authored repair delta with 28% weekly allowance remaining. **PASS_SOURCE_REVIEW; no blocking issue.** Reviewed runner SHA256 `5672128aea67dab3baf5b42a8be46afff2176374e867a1f0d3c0f5316085832e`; supervisor test SHA256 `3d69ff618b18a32f36aa80ecf64e28f64763393d5f11d4e3d9453c6ae021cc55`. Root's focused supervisor run passed 24/24 MOCK_ONLY cases, and the full component run passed 1,343/1,343 MOCK_ONLY cases. The reviewer did not rerun those tests or start native workers.

The reviewer independently hashed the original failure receipt, pinned historical manifest and all sixteen unique archived source files, comparing them against both the manifest and original result's source pins. Zero mismatches. The original result is FAILED_OR_BLOCKED with installation rejection, zero completed requests, all three requests uninvoked and owned cleanup confirmed. The exact receipt hash binds those semantics even though the new integrity helper does not separately parse every result field.

The fixed repair selectors use a distinct receipt path, exclusive `wx` creation and predecessor verification before reservation/admission and after the trial. The repair output was absent during review. Resource limits, input ordering and native configuration remain unchanged. The worker hash `5c041fa4db196d65b12ae7650536532cc9a8b7d0e51d9a3cc303f95a7df44bad` matches the updated parent pin and completed worker repair review. A documentation correction clarifies that the 65-second work cap belongs to the experiment runner, separately from the parent startup/request/stop limits.

No native result is established here. The separately preserved repair trial may proceed only through its resource/identity/conflict checks; success still requires its actual terminal receipt and independent cleanup evidence.
