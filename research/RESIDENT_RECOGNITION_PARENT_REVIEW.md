# Resident recognition parent: independent review

2026-09-23. **PASS_MOCK_ONLY — 44 independent cases, zero failures or skips.** This review covers the Node parent in `companion/resident-recognition.mjs`, not the Python ABI implementation, actual native decoding, microphone capture, workbench integration or game acceptance. Every started test instance injects all four dependencies (`preflight`, `spawn`, `freemem`, `now`); construction/import alone is also checked. No default startup, native process, model, listener, browser, audio or game was executed.

The final focused command was `node --test --test-concurrency=1 companion/tests/resident-recognition-review.test.mjs`, using the bundled Node runtime. It passed all 44 cases in 426.9 ms. This duration is test-run time, not recognition latency.

## Findings and corrections

Source inspection found that a result arriving after its deadline could be admitted before a delayed JavaScript timer callback ran. The implementation owner added elapsed-time checks at result admission and at the ready handshake. Independent fake-clock cases now reject expired, backward and unavailable timing evidence.

A further independently executed regression initially failed: an awaited preflight resolving at the exact startup deadline still spawned one child (expected zero). That run had **43 passes / 1 failure**. The owner added a clock/deadline check immediately after preflight, before spawn. The unchanged failing assertion now passes. This preserves the distinction between settling a public promise and retaining ownership of unfinished underlying inspection.

The owner also corrected `busy` during unconfirmed shutdown. Independent assertions verify that an unclosed worker occupies the slot even after its request has been cancelled. Kill's return value never proves closure; late events from a confirmed old worker cannot affect its replacement.

## Covered boundaries

- One start/worker for duplicate startup; sequential jobs reuse that worker. Submitted canonical WAV bytes are copied, duration and format bounds are enforced, and concurrent jobs are refused.
- Cancelled or timed-out preflight stays occupied until it drains, then cannot launch late. Disposal prevents restarting. Active cancellation, request deadlines, stop during decoding and unconfirmed shutdown preserve process ownership.
- Fixed protocol shape, version, job identity and error vocabulary; fragmented UTF-8; malformed/oversized frames; text character/byte/control bounds; stderr budget; wrong or duplicate responses; process, pipe and asynchronous write errors.
- Initial and post-inspection RAM admission, active loss/unavailable RAM, monotonic timing, and delayed timer callbacks. Reactive monitoring is not a memory reservation.
- Arbitrary recognized text remains `UNTRUSTED_RECOGNITION`, with explicit `commandExecution:false`, no microphone capture or speaker playback. Tests never interpret transcripts as commands.

## Production preparation and limits

Static inspection verifies fixed hidden subprocess arguments with isolated Python options, inherited pipes, no shell and CPU-only environment choices. The preflight checks source/interpreter identities and disk reserve; unknown disk readings are rejected. Source-pin syntax is independently checked. Hash-only reads of the installed `python.exe`, `python3.dll` and `python312.dll` matched the three parent constants. These reads did not invoke Python.

At this review snapshot, `WORKER_SHA256` is deliberately `NOT_YET_PINNED`; production startup rejects that value before launching anything. The worker must receive its separately reviewed immutable identity before a native attempt. The source and tests below establish parent behavior through injected dependencies, not a successful production preflight, proven ctypes layout, DLL execution, confirmed OS cleanup or native speed. Actual worker framing, full dependency provenance, ABI correctness and decoding remain separate evidence requirements. The component is not connected to the workbench and enables no game command.

## Reviewed identities

| File | SHA-256 |
|---|---|
| `companion/resident-recognition.mjs` | `4c765471b7327956611978463d9aa377f5867f4f678712ac34d4260cb16b71ba` |
| `companion/tests/resident-recognition-review.test.mjs` | `a573f7134479015505d00973bba73617751a17a79416cd5c20c9afd07904f9aa` |

Later worker-pin edits require recording the new parent identity; they do not retroactively change this reviewed snapshot or promote these mock results to native acceptance.

## Revalidation after worker pin and environment guard

The earlier snapshot above is preserved. The parent now pins independently reviewed worker SHA-256 `908fa18c7504f405af435f45ad499239ff8b9827b7f107dfac41633e18d6f80c`. Hash-only reads confirmed that value against the current worker source. The parent also removes inherited `GGML_BACKEND_PATH` variables case-insensitively before creating the child; a new fake-worker case verifies that a mixed-case override cannot reach the spawned environment. Existing four-thread and GPU-disabled choices remain.

The exported `verifyResidentRecognitionPreparation()` calls the existing read-only parent preflight and returns `PREFLIGHT_PASS_NO_INFERENCE`. Source inspection confirms it has no worker construction/start call. This reviewer did not invoke its production preflight or load a native library.

The updated **45 parent cases pass**, together with the separate **19 fake-I/O experiment cases**: **64/64 PASS_MOCK_ONLY**, zero failures/skips, 808.6 ms for that combined run. The experiment suite tests its supervisor rather than extending the parent's claim. The earlier 43/44 failure and its correction remain recorded above. Native invocation, resource fit, speed and actual cleanup remain **NOT_PERFORMED by this review**.

| Current file | SHA-256 |
|---|---|
| `companion/resident-recognition.mjs` | `12a98fb7b3a9d37eead52486ef83e77296822943e7b478193ea8001d131e1d7a` |
| `companion/resident_recognition_worker.py` — pin comparison only; ABI review is separate | `908fa18c7504f405af435f45ad499239ff8b9827b7f107dfac41633e18d6f80c` |
| `companion/tests/resident-recognition-review.test.mjs` | `e1e50897408a4da19017fbfa55bda8996404e0587dd66a47f0675ae1ea1917dc` |
