# Retained recognition: one timestamp-repair trial

September 23, 2026. This is authorized fallback component work while passive observer authoring is blocked. It does not change the active observer goal's completion standard, launch/control MW5, alter the default recognizer or provide gameplay evidence.

## Preserved failure and repair

The original `RESIDENT_RECOGNITION_COMPONENT_SMOKE.json` is immutable evidence of installation-check failure before inference. Its SHA-256 is `3a51114ad1044ccb0f605cee5bdd87a02f251f6a8b47877d12b8077d204fdb26`. The corresponding 16 source snapshots remain in `resident-recognition-attempt-001-source/`; manifest SHA-256 is `a06c90bd481297d989fa2eace667aad8c0b0d4fb8c0de09b9cee1c11133c7216`.

The diagnosed Windows/Python difference is between handle and path `ctime` values for the same unchanged file. The repair keeps handle-before/handle-after `ctime` equality, identity/size/mtime checks across APIs, and full content hashes. It removes only the unsupported cross-API `ctime` equality. The parent also preserves the first worker failure instead of replacing it with a later pipe error. The worker pin was updated after independent final worker review passed. The updated runner review must also pass before starting the native trial.

## Fixed trial

`scripts/Exercise-ResidentRecognition.mjs --check-repair` is read-only preparation. `--run-repair` reserves only `research/RESIDENT_RECOGNITION_REPAIR_SMOKE.json` with exclusive creation. Neither accepts a user-selected output path. Before reserving a repair receipt, the runner hashes the original receipt, pinned historical manifest and all sixteen historical source files. It checks that historical evidence again after the trial. Existing original flags retain their original, already occupied receipt and cannot overwrite it.

One owned CPU worker transcribes the existing synthetic clips VA-001, VA-006, VA-001. Their source pins, reference texts and ordering are unchanged. The native parameters remain CPU/four threads/English/GREEDY. No microphone, speakers, listener, network, download, paid API, game or editor is part of the trial.

Admission requires the reviewed worker/interpreter/runtime/model identities, no conflicting game/model/project workers, 3 GiB available RAM and 10 GiB free disk. The retained parent keeps its 2 GiB running RAM floor, 30-second startup, 10-second request and three-second stop limits. The experiment runner separately enforces its 65-second overall work limit. No weakening or unchanged retry is allowed if admission or execution fails.

The result must retain startup status and timing, each request's invoked/unperformed state, full untrusted transcript and reference comparison, owned PID continuity, resource samples, source identities, first failure, disposal and postflight process inventory. Stop after any mismatch, timeout, resource loss, crash or unresolved cleanup. Confirm owned-worker termination; do not stop unrelated processes.

This single component smoke cannot establish human recognition quality, a latency percentile, microphone performance, game-loaded performance or observer progress. Any native result is separate from MOCK_ONLY tests. The cold recognizer remains the default and no workbench integration is included. A failed repair trial requires a new diagnosis and reviewed artifact before another run.
