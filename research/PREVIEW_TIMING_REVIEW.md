# Preview timing independent review

2026-09-22 — **PASS_MOCK_ONLY: 9/9 independent cases**. No native model, process, microphone, audio device, browser, editor or game was started. Only this note and [preview-timing-review.test.mjs](../companion/tests/preview-timing-review.test.mjs) belong to the independent review.

## Concrete problem and evidence limits

The implementation owner's read-only, inert reproduction reported that a clock regression from 10,000 to 9,000 made the current workbench reject conversation with `CLOCK_INVALID`. Selecting the already-active 4,000-ms timing mode then reconstructed the coordinator in the same `demo_1` mission. The next request was generated despite the unresolved clock fault. A generic injected generator that ignored cancellation and kept reporting `READY` also reached two outstanding calls after a timing selection.

Those pre-fix observations are attributed to the implementation owner's parent-visible tool output and message. They were not independently rerun before the fix: by this review's first executable run, the correction had already been written. No pre-run hash snapshot or receipt was recorded for that reproduction. Earlier frozen callsign sources were server `8B2C927E9505D7C94512983A557B04566DD2B3FB31B5750BDB9445AC06DBA65A` and coordinator `19C1FD08A929D7F6C609E951A533F059475075592C8B04FBC2DAA0E19D8494D0`; these are previous-source pins, not hashes measured during the reproduction.

This does **not** establish concurrent native inference or wrong-recipient gameplay. The actual model adapter has its own generation guard, and an injected generator reporting `GENERATING` was rejected by the workbench readiness check. The owner also observed that the separate `ControlSession` human hold/policy state stayed unchanged and a possessed pilot remained `BINDING_INVALID`. The independent corrected-source cases confirm those boundaries rather than claiming they were broken.

## Correction and independent checks

The coordinator's [setTimeoutMs](../companion/conversation.mjs#L220) accepts only an integer from 1 through 10,000 and rejects invalid or disposed updates before mutation. Every valid selection cancels pending previews, including selection of the same value. It changes future request timers in place while preserving generated history, clock-fault state, used request/session IDs, actor bindings, revocation generations, historical pawn claims, gates and the occupied generator slot until its promise settles.

The [workbench timing action](../companion/server.mjs#L244) keeps its existing reply/audio invalidation and updates the displayed deadline after setter success. It no longer disposes, reconstructs or starts a new coordinator mission for a timing preference. The four-second spoken-response target remains unchanged; a ten-second offline audition is not acceptance of slower conversation.

The nine independent cases verify:

- A same-mode timing selection cannot clear a latched backward clock within the same mission.
- An abort-ignoring injected generator retains the sole coordinator slot; its late output cannot replace the successor.
- Generated history survives while a pending reply is cancelled.
- Separate tactical holds, possessed-pilot rejection and zero native-call count remain intact.
- Used request IDs, retired sessions, revoked generations and historical pawn ownership survive.
- Same-value cancellation preserves history, gates, bindings and occupied ownership.
- Invalid/disposed updates neither coerce objects nor cancel valid work.
- New requests actually time out under the newly selected duration, using fake timers; late old promises do not renew deadlines.

The independent suite passed **9/9** against the reviewed correction. The owner and coordinating task own the implementation-focused and whole-project regression suites. One older test explicitly expected timing changes to erase history; updating that expectation is a deliberate policy correction, not removal of cancellation coverage.

The implementation owner confirmed source freeze at the independently checked hashes below. The owner separately reported 114/114 focused checks passing, including the coordinating task's corrected history-preservation assertion; that is attributed evidence, not an additional test run by this reviewer.

| Reviewed artifact | SHA256 |
|---|---|
| `companion/server.mjs` | `768BFDADEA0ED58FEFAB1BA48495B17AD9A9F151737520171CEBEB5B751F4282` |
| `companion/conversation.mjs` | `C661F2413A5323F59CD84617A566B83979580E1B24D16E9FA5FF8D8FF01E0C85` |
| `companion/tests/preview-timing-review.test.mjs` | `0134751A2F3F77DC39834154A52D3297762B5FD6C3E40BE124750BDF5DB33042` |

Actual inference, physical audio cancellation, performance and gameplay acceptance remain **NOT_PERFORMED** by this review. No existing diagnostic harness, fixture, projection file or historical receipt was changed.
