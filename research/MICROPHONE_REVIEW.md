# Independent browser microphone component review

Review date: 2026-09-22. Classification: **MOCK_ONLY**. Scope: the shipped recorder and AudioWorklet JavaScript, executed inside Node.js VM contexts with fake media objects. This review did not request microphone permission, record a person, open a browser, play audio, execute ASR, or control the game.

**Final result: 8/8 independent checks PASS.** This establishes bounded synthetic behavior for the reviewed files. Real microphone capture, browser permission prompts, audio quality, visual controls, game overhead and the 100-recording recognition benchmark remain **NOT_PERFORMED**.

## Findings and corrections

1. **OBSERVED in fake execution: one track-stop exception aborted remaining cleanup.** The first six-case run returned 4 PASS and 2 FAIL. `recorder.cancel()` threw `simulated track cleanup failure`, through the original unguarded `track.stop()` loop, before the second track and AudioContext cleanup. The UI implementation now tries each track independently and continues through graph, port and context cleanup. Unconfirmed synchronous cleanup blocks replacement recording and suppresses a release upload.
2. **OBSERVED in fake execution: a MessagePort close exception skipped AudioContext cleanup.** The other failure in that same run was `simulated port cleanup failure` escaping `recorder.release()`. Port closure is now isolated from the remaining cleanup steps. The final test checks that context closure is still attempted and audio is not uploaded after this uncertainty.
3. **Source-observed ownership gap: a pending AudioContext close permitted new contexts.** After the first fixes, source inspection found that a close rejection was handled but a never-settling close promise did not block replacement capture. The implementation now counts pending context closures, exposes `cleanupPending`, and denies new capture while closure remains pending. A rejected close leaves the recorder blocked. The final deferred-close test passes. This case was added while the fix landed; no pre-fix failing execution is claimed for it.
4. **Source-observed tail loss: the final partial PCM block was not flushed.** The earlier worklet posted only full 256-sample blocks except at its 15-second limit. Its source therefore left up to 255 samples unpublished at ordinary release; exactly 1,600 generated samples would leave 64 in the worklet after six full blocks. The implementation now posts its partial block after each completed render quantum. The final numerical test produces exactly 1,600 delivered samples for 100 ms of 16 kHz synthetic input. This was a source finding, followed by a passing post-change test, not a recorded pre-fix failing test.

The final suite also covers an asynchronous context-close rejection, late permission after release, old track-ended callbacks, silent output, bounded queued PCM, and fixed worklet history. An earlier redundant late-permission fixture reused the same fake stream across requests; it was removed in favor of the explicit late-permission and stale-ended ownership cases. No failing finding was removed.

## Reviewed behavior and evidence locations

| Behavior | Source location | Evidence and limit |
|---|---|---|
| No permission request before explicit start | `companion/public/microphone.js`, `createRecorder` / `start` | DOCUMENTED by local source; VM tests use a fake `getUserMedia`, never the browser API. |
| Best-effort cleanup of every owned track, graph node and port | `microphone.js`, `stopTracks` / `cleanup` | OBSERVED in the exception-injection tests. A thrown cleanup operation is not reported as confirmed closure. |
| Pending or rejected context close blocks replacement | `microphone.js`, `pendingClosures`, `cleanup`, `start`, `cleanupPending` | OBSERVED with deferred and rejecting fake promises. A pending close is retained without inventing a timeout success. |
| Late permission and ended events are scoped to their capture | `microphone.js`, `owns`, the post-permission branch, track-ended callback | OBSERVED in independent fake ownership tests. |
| Speaker output contains zeros | `companion/public/microphone-worklet.js`, `process` output clearing; recorder's zero-gain node | OBSERVED for every output block in the synthetic worklet run. Real device monitoring was not tested. |
| PCM production stops at 240,000 samples | `microphone-worklet.js`, `total` checks; recorder `MAX_SAMPLES` | OBSERVED at 192 kHz input, with exactly 240,000 output samples and blocks no larger than 256 samples. |
| Partial PCM is posted after each completed quantum | `microphone-worklet.js`, final `if (this.used) this.send(false)` | OBSERVED for exactly 100 ms of synthetic 16 kHz input. This is not proof that every asynchronous message arrives before a real pointer-release event. |

The worklet test deliberately does not consume its queued messages. It checks a conservative bound of 30,000 messages for the selected 192 kHz, 128-input-frame quantum fixture, 480,000 total PCM payload bytes, and 512 history entries. Per-quantum flushing increases message overhead compared with 256-sample batching. Message/container overhead and actual browser scheduling cost were not benchmarked.

## Reproduction and reviewed artifacts

Run with the project Node.js runtime:

```text
node --test companion/tests/microphone-review.test.mjs
```

Final independent run: **8 tests, 8 pass, 0 fail**, approximately 1.97 seconds. The test loads the actual two browser source files; no duplicate implementation is substituted. The first run's two exception failures were corrected by the UI owner; this reviewer changed only the independent tests and this report.

SHA-256 at final review:

| Artifact | SHA-256 |
|---|---|
| `companion/public/microphone.js` | `5e15f36ab76869fc24227f193d7fb14498213f5df7f2a8745f4769f45f585f72` |
| `companion/public/microphone-worklet.js` | `4114b11a26961504f65819393836721987c657e6900b3ef521594e17bbca1c3b` |
| `companion/tests/microphone-review.test.mjs` | `a334a9938fcff3672532a0bc325f5a0ed7f5b50fc752abfb9d74be31d186ba38` |

## Remaining acceptance work

Release closes the capture immediately and discards late asynchronous worklet messages. Quantum flushing reduces unpublished worklet tail, but does not guarantee sample-exact capture through the human release instant. Real browser/device trials must check clipping, truncation, silence, permission denial, device removal, slow event loops, and microphone-indicator shutdown. Local ASR transcription, intent accuracy, spoken command execution and native human precedence are separate milestones; none is established by this component review.
