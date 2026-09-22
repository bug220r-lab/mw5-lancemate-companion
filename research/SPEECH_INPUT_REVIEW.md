# Independent speech-input coordinator review

Date: 2026-09-22. Status: **PASS — 54 independent MOCK_ONLY cases**. Scope: `companion/speech-input.mjs`, the project push-to-talk lease and transcription-preview coordinator. No microphone, inference process, network listener, speaker, editor or game is used by these review tests. A requested supplementary server review inspected source only; separate server tests are identified below.

The public interface under review is `prepare`, `begin`, `submit`, `cancel`, `invalidate`, `dispose` and `status`. A valid result must remain untrusted text with dispatch disabled; it must not parse a recognized sentence into orders or claim native action acceptance.

## Independently specified cases

These cases were selected before the module was available for inspection:

- Preparation starts only the explicitly supplied recognizer; it must not begin capture, recognition or game actions.
- Begin requires an active, fresh mission context with three distinct, alive, AI-owned bindings; missing identity, duplicated actor/pawn/controller identity, human possession, pause/loading and microphone mute fail closed.
- Begin interrupts existing output, sets the push-to-talk gate once, and admits only one capture lease.
- Submit consumes its lease exactly once, validates a bounded canonical PCM16 mono 16 kHz WAV, and releases the capture gate while recognition remains owned.
- Cancellation, exceptions, invalidation, expiry and disposal release the push-to-talk gate. Stale lease cancellation must never release a newer lease's gate.
- A recognition result cannot survive changed mission, actor bindings, phase, microphone mute, capture expiry, transcription expiry or backward clock movement.
- Capture expires at 20 seconds, recognition at 10 seconds, and the preview at 5 seconds; expired results cannot revive when the clock changes.
- Ignored cancellation retains worker ownership, preventing another request until the recognizer reports completion/stop. A late first result must not overwrite a newer result.
- Invalid WAV format, duration and byte lengths reject before recognizer submission; caller mutation must not alter admitted bytes.
- A request ID does not grant native execution. Transcript contents remain opaque untrusted text even when they resemble commands or instructions.

## Findings and corrections

**Observed missing shutdown-ownership signal.** An initial 51-case run passed. A subsequent targeted test held `recognizer.stop()` unresolved while the fake engine reported `busy:false`, `ownsProcess:false` and a confirmed stopped process. The coordinator did not expose whether its stop operation was still pending. That run reported 52 cases, 51 passes and one failure: expected `shutdownComplete:false`, received `undefined`. The original server's disposal check looked only at engine flags, so the source could report all models stopped despite pending coordinator work. That server consequence was initially a source inference, not a pre-fix HTTP execution result.

The corrected coordinator exposes preparation, recognition, stop and cleanup ownership plus conservative `shutdownComplete`. Completion requires disposal to have been requested, no outstanding coordinator work or cleanup problem, and affirmative engine flags with `STOPPED`/`DISPOSED` state. Pending recognizer disposal is retained after bounded waiting. The independent suite now checks held stop, held disposal and rejected disposal; all pass. The server now consumes this complete shutdown result. The root agent separately added a server test that holds stop for its bounded wait and observes `LOCAL_MODEL_STOP_UNCONFIRMED`; see `companion/tests/speech-input-server.test.mjs`. This review did not execute that loopback suite itself.

**Source finding: malformed upload options retained PTT.** The first draft rejected malformed options before closing a matching active capture. The author fixed this before the independent regression executed. Matching invalid options now fail the capture and release PTT; an unrelated capture ID cannot close the current capture. The final regression passes. No pre-fix failing test is claimed for this source finding.

The suite confirms that cancellation may settle a public transcription promise while the recognizer still owns work. The coordinator blocks a successor until that ownership is gone; a late result or old capture cancellation cannot replace or cancel a later capture. A promise-returning radio hook is rejected by the implementation rather than treated as established immediate gating; the author's own hook regression is separate from this suite.

## Final independent receipt

Executed with bundled Node.js 24.19.0 on 2026-09-22:

```text
node --test companion/tests/speech-input-review.test.mjs
tests 54
pass 54
fail 0
cancelled 0
skipped 0
```

| Reviewed artifact | SHA-256 |
|---|---|
| `companion/speech-input.mjs` | `355b7479f3adcd714f4431a3fbcedc4692ee17b341bc244f19d77ebcdbb8e21a` |
| `companion/tests/speech-input-review.test.mjs` | `91796fa02b2f5f2462b2dbee88e0d734d7880ba08c8442390a12c255f22b16ab` |
| `companion/server.mjs` — supplementary source inspection | `9611040a4d01d88d4ea0123e8d225a20720a83295bb940bc42284a0f90eecc90` |

The 54 cases cover inert construction/preparation; interrupt and PTT ordering; active mission and microphone constraints; exactly three distinct alive AI bindings; identity changes and possession; array reorder; duplicate begin/submit; capture, transcription and preview expiration; permanent backward-clock invalidation; delayed preparation; cancellation with remaining native ownership; old cancellation isolation; failure redaction; canonical WAV boundaries and copy isolation; malformed options; wrong IDs; pre-aborted upload; bounded well-formed transcript text; callback failures; public-status copy isolation; and incomplete shutdown reporting.

Supplementary source inspection found that the server's WAV upload route has its own bounded upload ownership and remains outside the ordinary action queue, allowing cancellation during transcription. It verifies authentication, origin, capture identity, content type and byte size before admission. Disconnect cancellation is scoped to the uploaded capture. Transcription text is not sent to `parseSpokenCommand`, the language model, native controls or the command ledger. The existing typed-parser exercise remains explicitly labeled as such. These are source findings; they do not replace executable server or browser evidence.

## Limits and unperformed work

- The actual accepted context is `session`, active `phase`, unmuted microphone and three unique `id`/`pawnId` bindings with generation, AI ownership and alive flags. The initial review checklist also asked about controller identity and observation freshness. Those are **not fields of this offline context contract** and were not validated. This component must not be substituted for live observation/actor authority validation.
- Deadline cases advance the injected clock and exercise invalidation. They do not measure OS timer scheduling, real microphone capture, end-to-end latency or responsiveness under MW5 load.
- Fake recognizer results do not establish speech accuracy, accent/noise robustness, intent-plus-recipient correctness, echo isolation or microphone permission behavior. Those remain **NOT_PERFORMED** here.
- No native process, filesystem cleanup, browser recorder or AudioWorklet executes in this coordinator suite. The separate recognition review covers file/process protocol with its own fake dependencies and limits.
- Callback failures cause failure/disablement and prevent transcription. The coordinator cannot prove that an external callback actually silenced a speaker or changed an OS audio route.
- The returned preview is **UNTRUSTED_RECOGNITION**, `OFFLINE_PTT_PREVIEW`, with `dispatchable:false`. Passing these cases does not establish spoken game commands, conversational completion, a shipping adapter or mod acceptance.
