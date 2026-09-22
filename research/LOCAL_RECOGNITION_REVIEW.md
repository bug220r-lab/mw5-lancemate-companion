# Independent local recognition review

Date: 2026-09-22. Scope: the project-local `companion/local-recognition.mjs` adapter. Status: **PASS — 39 independent MOCK_ONLY cases**. Filesystem and child-process dependencies are simulated. No recognizer executable, model inference, microphone, network listener, speaker, editor or game is started by these tests.

The adapter is intended to return unverified transcription text from an explicitly submitted, bounded WAV. Successful transcription is not command recognition, target/recipient resolution, native command acceptance, gameplay behavior or speech-latency acceptance.

## Independently specified review cases

These constraints were selected before the implementation was available for inspection:

- Stop during a stalled preflight must settle without the metadata operation finishing; its late completion cannot start a child.
- Two simultaneous transcription requests cannot create two workers or a hidden queue.
- A cancellation must reject its result. Ownership must remain held until the exact child emits `close`, including when kill fails or no close arrives.
- Restart and cleanup must remain blocked while a worker's shutdown is unconfirmed.
- A transcript read that completes after cancellation must not produce success.
- A thrown spawn failure and a child `error` followed by `close` must produce redacted failure and recover ownership correctly.
- WAV validation must reject noncanonical headers, wrong formats/rates/channels, incorrect lengths and durations outside 100 ms to 15 seconds before spawning.
- The adapter must copy admitted input so caller mutation cannot change bytes written after validation.
- Empty, malformed and oversized transcript output must not become accepted text; private paths and process diagnostics must not enter public errors.
- Resolved-path or symbolic-link changes in a task directory, output file or cleanup ancestor must not cause a read/delete outside the owned temporary directory. Cleanup must not use recursive deletion.

## Observed defects and corrections

1. **Public startup did not settle on stop while preflight I/O was stalled.** The initial 31-case run observed the public `start()` promise still pending after `stop()` returned and an additional 20 ms had elapsed. Releasing the fake metadata read finally settled it. The recorded assertion was `false !== true`, with the explanation “public start callers must be released on stop while internal inspection remains owned.” The implementation now settles its public startup promise on stop and retains a separate internal preflight record until outstanding I/O drains. Restart remains blocked during that interval. Both prompt settlement and honest retained ownership now pass.
2. **An old worker's callback disabled a newer request.** The next 35-case run emitted an `error` from a completed mock worker while its successor owned a transcription. The new transcript succeeded, but the adapter incorrectly ended in `STOPPED` instead of `READY`, because the old callback changed global enabled state. The implementation now checks work identity and close state before child/stream callbacks act; `cancel()` also checks current ownership. The original failing case now passes.

The first run reported 24 passes and 7 failures: one implementation defect above and six review assertions that checked cleanup immediately after a deliberately early failure rejection. Those six assertions were corrected to wait for asynchronous cleanup; they were not adapter defects. The second run reported 33 passes and 2 failures: the stale-callback defect and an earlier review assertion awaiting the newly prompt public startup promise instead of waiting for internal preflight cleanup. That assertion was similarly corrected. These failed observations are preserved here rather than represented as clean first-pass validation.

A source review also found that the initial draft accepted artifact identity from two mutable manifests. The author added fixed model/archive metadata and a source-reviewed raw runtime-inventory digest before the independent replacement test ran. Replacement-of-both-manifests, model-only replacement and changed-runtime-hash cases pass. This finding was identified from source, **not** demonstrated by a pre-fix failing test.

## Final focused receipt

The earlier 38-case checkpoint passed against module SHA-256 `8386ab7f04623a52a733016f1d807c876aa8c4616f62182ab3a5cf00b171e926`. The author then added a public startup deadline and clarified pending-operation cleanup reporting. This final review inspected those changes, added an independent startup-deadline case, and reran all cases against the frozen module hash below. The deadline rejects the public caller while preserving internal inspection ownership until it drains.

Observed on 2026-09-22 using bundled Node.js 24.19.0:

```text
node --test companion/tests/local-recognition-review.test.mjs
tests 39
pass 39
fail 0
cancelled 0
skipped 0
```

Reviewed artifact SHA-256:

| Artifact | SHA-256 |
|---|---|
| `companion/local-recognition.mjs` | `c349f5ff1ed94f008cc337320aaf103616e1a9f233dd7eb4d87d570eb9a483b7` |
| `companion/tests/local-recognition-review.test.mjs` | `af46632da6c4573e65decca2d9a46d6b7f31e7092779aa864b46a57a8219ec8b` |

The cases additionally verify the exact 15-second boundary, startup with zero spawned children, fixed CPU/no-shell/hidden-window arguments, no hidden request queue, `exit` versus `close` ownership, thrown and unsuccessful kills, timeout handling, cancellation during output reads, private input copying, spawn failure redaction, malformed WAV rejection, empty/invalid/control/oversized output rejection, growing output rejection, native output caps, redirected directories, symbolic transcript refusal, unexpected-file cleanup refusal, and a RAM drop before actual spawn. No recursive deletion is used by the adapter.

## Remaining limits

- **Native invocation, actual process restoration and resource behavior: NOT_PERFORMED by this review.** Fakes do not prove Windows process termination, real filesystem behavior, pinned binary execution or recognition accuracy.
- Runtime hash checks and filesystem inventory are exercised through trusted code-only fakes. This review confirms checks are required and failures propagate; it does not authenticate a real installed model. Production preflight must do that itself.
- A pending native process or file operation retains ownership until its completion is known. Stop reports incomplete shutdown honestly. It does not guarantee that a stalled operating-system operation finishes within a deadline.
- Resolved-path and symbolic-link cases cover redirection present at the checked boundaries. They do not establish an atomic filesystem security boundary against another hostile local process changing paths between a check and an operation.
- The 10 GiB disk and 3 GiB RAM checks are admission samples, including a fresh sample immediately before spawning. They cannot guarantee continuous reserves under competing workloads.
- The returned text remains **UNTRUSTED_RECOGNITION**. Microphone/push-to-talk capture, recognition of intent and recipients, echo prevention, live order arbitration, latency targets and in-game performance remain separate work. No game integration or release acceptance follows from these 39 mock cases.
