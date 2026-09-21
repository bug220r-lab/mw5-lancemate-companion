# Three-pilot mission radio — implemented local core

Version **1.0.0**, 2026-09-21. **IMPLEMENTED / MOCK_ONLY evaluation.**

The project now has a deterministic, in-memory radio coordinator and a finite spoken-command parser in [radio.mjs](../companion/radio.mjs). They coordinate three configured pilot identities, check references to supplied facts, reserve one speaker at a time, and discard speech that loses its mission, binding or timing context. They do not read MW5, generate language, transcribe a microphone, synthesize/play audio, dispatch an order, or save a campaign. Actual dialogue quality, acoustic interruption, native-game integration and gameplay acceptance are **NOT_PERFORMED**.

The editable [personas.json](../companion/personas.json) contains an edgy woman, a calm tactician and an energetic scout. Their IDs are `edge`, `tactician` and `scout`; callsigns and voice IDs are all `null`. These are original style directions, not voice models or verified biographies. The existing [pilot sheet](PILOT_BEHAVIOR.md) provides tone examples; its historical single-pilot preparation scope does not define the new three-pilot release boundary.

## Mission state and profile configuration

Create a director with `createRadioDirector({ personas, now })`. `personas` may be the JSON object containing `profiles`, or an array of exactly three profiles with unique IDs. The constructor copies configuration; later caller mutations have no effect. The default clock is `performance.now()`. When supplying `now`, use the same nonnegative, monotonically increasing millisecond clock for all event and line timestamps.

`startMission(session, bindings)` accepts a new, unique session epoch and up to three current bindings. Starting a mission clears all facts, speech, exchanges, used line IDs and the previous chatter budget. Persona configuration and user gate preferences remain. Reusing any epoch in that director is rejected; delayed data cannot reopen a retired mission. After 1,024 epochs, create a fresh director. This is in-memory configuration retention, **not disk or campaign persistence**. A host may save user preferences separately; mission facts must not become profile memories automatically.

Each binding is:

```js
{ id: 'edge', pawnId: 'observed-pawn-id', generation: 1,
  alive: true, aiOwned: true, slot: 1 }
```

`slot` is optional and, when present, explicitly maps 1–3. Array order is never treated as a slot assignment. Binding IDs must match configured profile IDs. A host using `alpha`, `bravo` and `charlie` must supply profile copies with those IDs; an unknown identity is rejected. Pawn IDs and slots must be unique. Generation is a nonnegative integer that advances whenever identity, possession, life state or slot changes, or an invalidated binding is restored.

The coordinator checks the most recently supplied binding before reserving speech. It cannot independently establish that a binding is still true in the game. The observer/host must invalidate it on lost observability and refresh it after possession or identity changes. No timer here can establish regained authority.

## Facts and identity observations

The supported observation envelopes are project interfaces, not MW5 telemetry names:

```js
// Immutable fact observation. An omitted expiry defaults to observedAtMs + 5,000.
director.observe({
  id: 'observation-123', session: 'mission-epoch', observedAtMs: 1000,
  kind: 'fact', verified: true,
  data: { targetId: 'observed-target-id', visible: true },
  expiresAtMs: 6000
});

// Replacement/current binding; changes require a newer generation.
director.observe({
  id: 'binding-event-123', session: 'mission-epoch', observedAtMs: 1000,
  kind: 'binding',
  binding: { id: 'edge', pawnId: 'replacement-id', generation: 2,
    alive: true, aiOwned: true, slot: 1 }
});

// Invalidates only the matching pawn and generation.
director.observe({
  id: 'invalidation-123', session: 'mission-epoch', observedAtMs: 1000,
  kind: 'bindinginvalidated',
  data: { speakerId: 'edge', pawnId: 'replacement-id', generation: 2 }
});
```

`bindingInvalidated` is an accepted spelling of `bindinginvalidated`; the invalidation fields may also be top-level. A delayed invalidation cannot invalidate a newer pawn/generation. A binding update older than that binding's last update is rejected. A changed binding without a generation advance is rejected.

Fact data must be finite JSON with bounded size and depth. Events cannot come from another session, the future, or more than 30 seconds ago. Explicit fact expiry cannot exceed 30 seconds after observation. These are conservative **project defaults**, not measured MW5 update periods. Up to 256 unexpired facts are retained. Identical duplicate facts are idempotent; changing an existing fact ID permanently marks that ID conflicting for the mission and cancels referencing speech. Use a new ID for a new observation. The director keeps at most 65,536 immutable fact digests per mission, then rejects further IDs instead of silently reusing old evidence.

`verified: true` is a declaration by the trusted observation boundary. This module cannot prove provenance, visibility, identity, units or hidden-enemy-state exclusion from that boolean. The future observer must establish those properties before supplying a fact. A model response or retrieved text must never be promoted into a verified observation merely because it contains this field.

## Radio scheduling contract

`enqueue(line)` admits a candidate; `next()` reserves the next eligible line and returns its copy, or `null`. There can be only one reservation. A playback host would acknowledge its actual completion using `complete(lineId)`. A wrong or expired line cannot complete another speaker's turn.

```js
{
  lineId: 'line-123', session: 'mission-epoch',
  speakerId: 'edge', pawnId: 'replacement-id', generation: 2,
  priority: 'tactical', text: 'Target in sight.',
  createdAtMs: 1000, expiresAtMs: 6000,
  factIds: ['observation-123'],
  // Optional two-turn exchange: first turn 0, reply 1.
  exchangeId: 'exchange-123', exchangeTurn: 0
}
```

The mission, speaker, pawn, generation, life/ownership state, line expiry and every fact reference must pass admission and be rechecked by `next()`. A line may contain at most 600 characters and eight unique fact IDs, with a lifetime of at most 30 seconds. Returned lines are marked `classification: 'PROJECT_ONLY'` and `dispatchable: false`. Extra caller-supplied action fields are discarded. References present yield `grounding: 'VERIFIED_FACT_REFERENCES_ONLY'`.

All danger, tactical and banter lines require fact references. An answer may have none, but is labeled `USER_REQUESTED_UNGROUNDED`. This label records the caller's requested-answer classification; it does not prove a human asked for the answer. **Neither label proves that the text follows from its references.** For an eventual release, factual language must come from constrained, reviewed templates or pass separate semantic validation. A generated assertion with a valid unrelated fact ID remains unsupported. Fictional style cannot become a report of an unobserved event.

| Priority | Scheduling behavior |
|---|---|
| `danger` | Runs before queued answers/chatter. A new verified-reference warning interrupts playing tactical/banter speech and cancels its exchange. It does not interrupt a playing answer or another danger. |
| `answer` | Runs before tactical/banter. Exempt from the unsolicited budget because the caller declares it user-requested. |
| `tactical` | Shares the squad's noncritical unsolicited budget with banter. |
| `banter` | Lowest priority, subject to the same shared budget and factual-reference checks. |

There is **one noncritical unsolicited start per 20 seconds across the entire squad**, not per pilot. A two-turn exchange consumes one start: turn 0 followed by at most one turn 1 from a different pilot, at the same priority, within ten seconds of turn 0 starting. The second turn waits for verified coordinator completion of the first reservation. This is a caller's playback-completion acknowledgement, not a game observation. Suppressed chatter is dropped rather than saved for later. Interruption cancels the exchange; a different pilot cannot finish its obsolete reply.

Danger and requested answers bypass the noncritical timer. Urgent text still needs fresh facts and respects every all-speech gate. Queue length is bounded at 32. A danger can evict queued noncritical chatter; a queue containing only dangers/answers remains full. Up to 1,024 admitted line IDs per mission are retained to prevent exact-ID replay. Semantic incident coalescing, differently numbered repeated warnings, one-answer-per-user-turn enforcement, the pilot sheet's shorter word budgets and model text review are **not implemented by this scheduler**. A release dialogue producer must enforce them before enqueueing; these are not claimed accepted merely because reference validation passes.

## Gates and interruption

`setGates(update)` accepts only the following boolean keys; pass selected gate fields rather than an entire settings document. Unknown keys fail without changing gates.

| Gate | Effect in this core |
|---|---|
| `paused` | Stops current speech, drops the queue and rejects all new speech. Also represents a host-detected loading/menu boundary when mapped by the host. |
| `ptt` | Stops current speech, drops the queue and rejects speech while the human holds push-to-talk. |
| `speechMuted` | Stops and suppresses all companion speech, including danger. |
| `nativeDialogue` | Conservatively yields the whole radio, including warnings, to supplied native dialogue activity. The real activity signal remains an integration requirement. |
| `quiet` | Stops/rejects tactical and banter; requested answers and danger remain eligible. |
| `micMuted` | Metadata for the host's microphone boundary. It does not mute received companion speech. No microphone exists in this core. |
| `armed` | Metadata for control arming. It does not itself permit commands or mute conversation. Control authority belongs to the separate arbiter. |

`interrupt(reason)` stops the current reservation, discards queued lines, cancels unfinished exchanges and returns the interrupted/queued line IDs. A host must call it on a human command or other explicit cancellation and stop actual playback accordingly. A later gate reopening does not restore discarded speech. Clock regression or a failed clock latches a silent failure until a new mission epoch.

The module is synchronous and has **no background timer**. It reevaluates state when called. A future playback host must poll state or process gate/invalidation results and cancel audio; this library alone cannot guarantee a measured acoustic interruption latency. `getState()` returns a defensive copy for inspection and reevaluates expiry. `complete()` also rechecks expiry before accepting completion.

Human-order completion and autonomy resumption are separate control rules. The approved full project policy permits resumption after **verified completion of a nonpersistent human order or explicit release**; persistent orders and unknown completion remain held. The old blanket requirement to rearm after every order, and the old campaign-memory-first sequence, are not adopted here. The radio never releases a hold from elapsed time, dialogue, mood or a model suggestion. Mission-scoped conversation is the main scope; campaign persistence remains optional later work.

## Finite spoken-command parser

`parseSpokenCommand({ text, origin, final, session, bindings, selectedTargetId, locations })` returns an `INTENT`, `CLARIFICATION` or `REJECTED` object. `origin` must be `human_ptt` and `final` must be `true`; generated audio, model output, native dialogue and partial transcripts are rejected. These fields must originate at a trusted ingress. A caller can fabricate strings, so the parser is **not** an authentication mechanism, echo-cancellation proof or speech recognizer.

Supported grammar, with explicit recipients:

```text
regroup slot 1
slot 2 regroup
focus actor scout
regroup slot 1 and slot 3
reposition slot 2 to location ridge-a
release human hold slot 1
release slot 1
disarm slot 3
disarm
```

`actor <id>` means the exact configured binding ID, case-insensitively. The parser does not infer callsigns, pronouns, “everyone,” array positions, world coordinates or targets from conversational wording. Unknown, duplicate or ambiguous recipients require clarification. Focus additionally requires a supplied `selectedTargetId`; location-based reposition needs an unambiguous ID from `locations: [{ id: 'ridge-a' }]` or an equivalent string list. Availability, visibility, path feasibility and reachability of those supplied IDs still need the control validator.

Movement/focus/release require current eligible AI bindings. Targeted disarm is allowed for a known binding even if it is human-possessed or dead; global `disarm` requires a valid session but remains available without bindings. The intent actions are `REGROUP`, `FOCUS`, `REPOSITION`, `RELEASE_HUMAN_HOLD` and `DISARM`. Intents carry `recipientIds`, copied binding identity and any target/location ID. They are explicitly `PROJECT_INTENT`, `dispatchable: false`. A dispatcher must separately check the current mission, authority, human precedence and any capability support; no parsed intent is a native MW5 acceptance.

## Verification and remaining release work

Run `node --test companion/tests/radio.test.mjs` from the project root. On the existing Node 24.19.0 environment, **46/46 tests passed**, zero skipped, on 2026-09-21. [The tests](../companion/tests/radio.test.mjs) use hand-authored synthetic identities, observations and clocks. They cover all three profiles, mission reset, immutable/conflicting/expired facts, wrong recipients, possession/death, new binding generations, delayed invalidations, all gates, one-speaker ownership, shared timing, two-turn exchanges, danger preemption, bounded queues, clock failure, malformed data and finite command parsing.

This validates local scheduling and parsing only. Remaining release evidence includes actual observation provenance, semantic grounding and persona output review, incident coalescing, native radio contention, microphone origin/echo isolation, separate local STT/TTS quality and performance, real playback interruption, bounded resource use alongside MW5, and accepted game actions with independently observed effects. No model is downloaded and no paid service, voice generation, game/editor execution or campaign persistence is needed to run these tests.
