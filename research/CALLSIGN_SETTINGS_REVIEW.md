# Callsign settings independent review

Status: **PASS_MOCK_ONLY — 20/20 independent cases**. This review uses injected generators, speech promises, fake recognition/resource providers and disposable settings files. No model inference, audio playback, microphone, browser, editor, game, network listener or gameplay execution is part of this review.

## Preserved before-fix observation

On 2026-09-22, the initial ten independent workbench cases produced **3 PASS / 7 FAIL** against:

- `companion/server.mjs` SHA256 `F6C4230E8DE0DB06DC40E7B466E6FA287550092D70EFF46C092CCBCB1D760A0F`.
- `companion/conversation.mjs` SHA256 `796E9E618299CC5DF1D9C107C62BAADD6FA3809ED8C6304455E3D1229EC1A7BA`.

The serialized generator requests contained `callsign: null` for all three pilots despite saved Rook/Anchor/Spark settings. Rename/unset left old generation and synthesis signals un-aborted, and an already-reading audio reply retained its radio reservation. The failed-persistence case preserved the original settings file but still observed the pre-existing missing-callsign bug in the subsequent prompt; this was **not** evidence that an unsaved name had been installed. Same-name preservation, tactical hold/possession protection and the latched conversation clock checks already passed.

The independent test file is [callsign-settings-review.test.mjs](../companion/tests/callsign-settings-review.test.mjs). The failure record above remains historical after correction.

## Corrected source assessment

The correction passes **20/20 independent cases**, with no additional source-review blocker. After the implementation owner confirmed source freeze, the independent suite was rerun and the three runtime hashes were verified unchanged on 2026-09-22. Review targets:

| Artifact | SHA256 |
|---|---|
| `companion/server.mjs` | `8B2C927E9505D7C94512983A557B04566DD2B3FB31B5750BDB9445AC06DBA65A` |
| `companion/conversation.mjs` | `19C1FD08A929D7F6C609E951A533F059475075592C8B04FBC2DAA0E19D8494D0` |
| `companion/public/app.js` | `849EFA859C9B358DD018253073B2555E03D3EE78C85FD86ADB9945998148647B` |
| `companion/tests/callsign-settings-review.test.mjs` | `7DCA9646308B558A1FCA373F6CB994F8603E630C7F84654D4A0269BA64BB5EF9` |

At [server.mjs:61](../companion/server.mjs#L61), each coordinator receives copied persona profiles with the saved callsign mapped by the configured profile ID. [Binding construction](../companion/server.mjs#L202) preserves actor identity independently of personality. This also applies when the offline audition coordinator or synthetic mission is recreated.

The [settings transaction](../companion/server.mjs#L262) invalidates affected old replies/audio before its first disk await, blocks new affected requests during persistence, and rejects overlapping settings saves. Names enter the coordinator only after the settings-file rename succeeds. The failure case uses an intentionally unwritable temporary-file location inside the disposable test fixture. It verifies that the old settings and speaker identity remain installed. Same normalized names preserve pending answers, history and prepared audio; changing another pilot's name preserves an unaffected current answer.

The [coordinator update](../companion/conversation.mjs#L199) validates the complete batch before mutation, copies its values, changes only callsigns, and clears affected generated history. Cancellation does not release the occupied generator slot until its original promise settles. It does not reconstruct the coordinator or reset actor/pawn ownership, revocation generations, used request IDs, retired sessions, gates or clock faults.

## Independent outcome coverage

Fourteen workbench cases cover loaded/saved/renamed/unset names through the actual `messagesFor` serializer; correct actor/profile separation; immediate cancellation and pending-save exclusion; serial identity commits; ignored generator cancellation; same-name and other-pilot continuity; failed persistence; stale synthesis and audio reads; successor-radio isolation; persistent human holds and possession; a latched backward clock; pause/resume; workbench isolation; and retention through mission/audition changes.

Six direct coordinator cases cover consumed request IDs and retired sessions; unknown ownership with a strictly newer restoration generation; historical pawn claims; pause, backward-clock and disposal boundaries; selective pending-job/history invalidation; atomic invalid batches including accessor payloads; and protection against later mutation of the caller's update data.

The browser change at [app.js:103](../companion/public/app.js#L103) is **statically reviewed only**: a normalized name change triggers the existing playback cancellation before the action request is awaited. This review did not execute browser UI or audio playback. It does not claim the existing byte stream already delivered to a separate client can be recalled by the server.

## Limits and verification

Run the focused cases with `node --test companion/tests/callsign-settings-review.test.mjs`. The coordinating task owns the final whole-project regression check. No test here demonstrates that a language model follows a supplied callsign, that generated dialogue is factually grounded, or that spoken game commands recognize a callsign. Generated text remains unverified and non-dispatchable. No actual speech, game control, runtime acceptance or release acceptance is established.
