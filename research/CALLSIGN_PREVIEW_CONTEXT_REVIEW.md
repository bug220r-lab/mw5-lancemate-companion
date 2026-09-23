# Independent callsign preview context review

Date: 2026-09-22. Verdict: **PASS_MOCK_ONLY for the bounded rename/capture/preview contract**. Thirteen independent checks passed: ten against the actual workbench with all three engines injected, and three against the actual client script in Node VM with fake DOM, fetch and recorder. No native process, browser, microphone, audio playback, listener, editor or game was started. Full speech recognition, usability and native command acceptance remain **NOT_PERFORMED** by this review.

## Actual data path and authority

Recognition produces an `UNTRUSTED_RECOGNITION` text preview. The user must explicitly copy it into an editable text field and separately press Parse. That action returns a `MOCK_ONLY`, `TYPED_TRANSCRIPT_FIXTURE`, `dispatchable: false` interpretation. There is no confirmation or game-dispatch stage in this path. Recognizer output does not become authenticated human input or enter the control ledger automatically.

The server supplies the actor bindings and saved callsign map; caller-supplied alternate maps, bindings, origin and dispatch flags cannot replace them in the tested action route. The selected target remains the existing synthetic target. The context token is an opaque comparison string, not authentication or proof of a live game observation.

Sources: `companion/server.mjs`, `commandNames`, `commandContext`, the `command` action and `submitRecognition`; `companion/public/app.js`, the Copy and command-submit handlers; `companion/speech-input.mjs`, `publicCapture` and `submit`.

## Invalidation contract

| Transition | Independently checked result |
|---|---|
| Any actual saved callsign change | Cancels recognizer preparation, active capture, pending transcription or displayed transcript before the first persistence await. Cancellation applies squad-wide because a name can change recipient meaning. |
| Save pending | Parse, recognition preparation and PTT begin reject `CALLSIGN_UPDATE_PENDING`; no replacement operation begins. |
| Save succeeds | The new map and context become available. A fresh explicit parse uses the new map; an old result is not silently relabeled. |
| Save fails | Old saved names remain intact; previously invalidated recognition/text stays cancelled. |
| Same trimmed saved name | Capture and pending transcription are preserved. Whitespace trimmed at either end is not a new saved identity. |
| Case-only or internal-space edit | Counts as a changed saved name and invalidates capture, even though the parser may normalize both names identically. |
| Ignored recognizer abort | Public cancellation settles promptly, but underlying ownership stays occupied until the fake operation actually settles. Late text cannot revive the cancelled capture. |
| Pause, possession, mission reset | The comparison context changes, preventing an earlier displayed interpretation from remaining current. |

The server's existing speech-input fingerprint does not need a callsign field for this contract: synchronous invalidation plus the pending-rename admission gate prevents an admitted capture spanning a saved-name mutation. The context includes mission session, phase, current bindings, saved actor/name pairs and rename-pending state. It does not claim complete mission-state or target provenance.

## Client race review

The current client invalidates parsed results using both its command epoch/text and the server context. A delayed response for an old map cannot be attached after a newer poll has displayed a changed context. The current direct response can display a preview only when its own `last.previewContext` equals the nonempty state context. The UI states that nothing was sent.

The initial implementation gap identified during review was that cancelling a recorder alone did not remove a ready transcript: the completed recording no longer had an active microphone job, and a render could enable Copy again from old state. The implementation owner added `suppressedTranscriptId`. Independent VM evidence confirms that the old capture stays hidden and uncopyable during delayed save, old-state polling and failed persistence; the Copy handler checks the suppression independently of its disabled button. A genuinely new capture ID may be copied.

A single suppression ID is sufficient for the examined same-page serial-capture lifecycle: the server has one current capture, IDs are newly generated, and request sequencing prevents older responses replacing newer admitted state. This is not a claim about malicious servers, manual DOM mutation or browser/device behavior. Text already copied or manually typed is intentionally retained. Its previous interpretation is cleared; a new explicit Parse reads the current saved names. There is no stale execution token to confirm.

## Verification and source identity

Command: `node --test companion/tests/callsign-preview-server-review.test.mjs`.

Result: **13 passed, 0 failed, 0 skipped, 0 cancelled**; Node test duration 227.7305 ms. Disposable settings files were created beneath a uniquely prefixed temporary directory, with resolved path containment checked before cleanup. Deferred fake work was settled before disposal. Every language, speech and recognition adapter was injected; unexpected generation, synthesis, resource admission or audio reads would throw.

| File | SHA-256 at independent review |
|---|---|
| `companion/server.mjs` | `5b5582726582feba25fa9fc0396360ff1868a8a284d72efc457a62dd977a5024` |
| `companion/public/app.js` | `405867eb750d7a2862ed52aeea40c73dadd03b6d7b2b87ea3a6fd73be94efdeb` |
| `companion/speech-input.mjs` | `355b7479f3adcd714f4431a3fbcedc4692ee17b341bc244f19d77ebcdbb8e21a` |
| `companion/radio.mjs` | `df897a527197929e1efe30edc104eb7f999a871b8021c572aa28e71884904650` |
| `companion/callsigns.mjs` | `10a4cb0e2389263fb47538793d5039d73e1aa16dcd5a07558437682e9876132d` |
| `companion/tests/callsign-preview-server-review.test.mjs` | `ce6954bdcb76227a9aec05cd2fcaf9a679f3029433c9e7fab0f30f72f0dbed32` |

No remaining blocking concern was found in this bounded async review. Parser grammar and collision coverage are reviewed separately. This result does not improve or supersede any failed model-language evaluation, RAM admission outcome, native speech benchmark or blocked game-integration milestone.

## Final parser dependency revalidation

The separate parser review found a terminal-punctuation collision: saved names `Rook!` and `Rook` could cause the explicit request `regroup callsign Rook!` to select the wrong named actor. The parser owner corrected that dependency and froze it before this revalidation. The earlier table remains the original review snapshot; it is not rewritten as evidence for the later parser version.

The same unchanged thirteen async/capture/client cases were rerun against final `companion/radio.mjs` SHA-256 `def9b360ad28b62f6115cd64b140a1e05eefa9e7ee944c4ad0003e956428e95d`: **13 passed, 0 failed, 0 skipped, 0 cancelled**, duration 224.5759 ms. The shared `companion/callsigns.mjs` remained `10a4cb0e2389263fb47538793d5039d73e1aa16dcd5a07558437682e9876132d`; server, client and independent test-file hashes still match the original table. This revalidates their async contract after the parser correction; dedicated punctuation/collision evidence belongs to the independent parser review. No new case, native process or expanded acceptance claim was introduced.
