# Conditional companion architecture

Updated: 2026-09-21. **PROPOSED throughout unless explicitly marked DOCUMENTED.** This is a specification for a possible adapter, not an implemented game API. Sources and actual integration limits are in [FEASIBILITY](../research/FEASIBILITY.md) and [SOURCES](../research/SOURCES.md). The accepted delivery scope is now [FULL_MOD_DELIVERY.md](FULL_MOD_DELIVERY.md). Local implementation status is separate from native acceptance; see [IMPLEMENTATION_STATUS.md](../research/IMPLEMENTATION_STATUS.md).

## Evidence boundary and smallest system

**Latest source refinement:** [tactical-control readiness](TACTICAL_CONTROL_READINESS.md) maps current candidates and unresolved gates. Native FollowJob changes its follow target to `GetPlayerSquadLeader` during worker initialization; the generic recipient/job path is not a proven human-control exclusion gate; squad-member IDs are documented server-only; pawn/controller bindings change during mech switching. These are source findings, not a live adapter. Existing human-precedence, freshness and nonblocking-I/O requirements remain unchanged.

DOCUMENTED: MW5 has native squad orders and mod packaging; community code exports some MW5 runtime data. UNKNOWN/BLOCKED: an exact designated-lancemate read/order implementation and an inbound channel on build 1.14.390. Do not select a transport or runtime loader merely because the external language supports it.

Follow-up OBSERVED: the shipping receipt reports UE 4.26.2 and declares Victory/LowEntry dependencies. The installed editor's generated Python reference now supplies typed squad-order, worker/job and Victory/LowEntry declarations. It is documentation, not executable native source or shipping validation. Upstream Victory file functions are synchronous; the installed implementation/thread contract remains unknown. A native SDK/named-pipe alternative remains PROPOSED and needs verified engine-thread dispatch, safe worker shutdown/unload and a contained build without stock auto-deployment. See [BRIDGE_INSPECTION.md](../research/BRIDGE_INSPECTION.md) and the [source session](../research/EDITOR_SOURCE_SESSION_2026-09-20.md).

Start native integration with one deterministic local test driver, one narrow adapter and existing game AI. Independent local conversation/audio development may proceed while integration is unresolved. Expand native control to all three only after recipient isolation, human precedence and each capability pass. Direct piloting is a subsequent required release with exclusive movement/aim/fire ownership and restoration tests. No YAML dependency is assumed.

```text
Lewis's physical controls --------------------------------------+
                                                              v
MW5 local authority -> existing order system -> existing AI controller
        ^                          ^                   |
        | verified reads           | validated intent  | movement/aim/fire
        |                          |                   v
        +-- [PROPOSED game adapter + command arbiter] -> designated pawn
                     |                     ^
              bounded snapshots       bounded command queue
                     v                     |
             [UNRESOLVED authenticated local IPC]
                     |                     ^
          [local deterministic driver / companion process]
            | event filter | memory | allowlist | audio controls
            |                                      |
       mission-scoped records          shared local STT/text/TTS
```

If no suitable inbound transport is proven, this architecture is blocked. One-way motion telemetry, editor sockets, a generic UE plugin example, or a YAML asset interface do not satisfy the channel shown above.

## Component responsibilities

1. **Game adapter (implementation unknown):** read only verified game fields; establish world/session and actor identity; route through the game's existing order mechanism on the correct thread/authority; observe native order state if possible. Avoid invasive asset replacements. Never wait for cloud/network/audio or disk writes on the game thread. A bounded queue hands off work; overflow drops telemetry and rejects commands explicitly.
2. **Local arbiter:** one authorized actor and one action for the first proof; three independent actor-bound states with shared coordination after capability gates pass. Enforce TTL, deduplication, human-order holds and rate limits. The game side must independently revalidate before mutation; external validation alone is insufficient.
3. **Companion process:** microphone push-to-talk, local transcription, finite command grammar, event prioritization, mission facts and one shared local conversation/speech engine serving three persona contexts. No recurring paid API dependency. A small text model can propose typed intents; it cannot execute code, choose process addresses or expand permissions. Fast piloting remains independent of speech and model availability.
4. **Normal AI:** retains combat behavior. Companion failure stops new intents without deleting/replacing the controller. An already accepted native order may continue until the user changes it; losing the companion must not periodically reset native orders.

Node.js is the selected starting coordinator, preserving decideSquad(snapshot, previousState). Engine access and any fast controller require their own verified execution/thread contract. The project-local browser workbench is an offline review tool; its HTTP API is not a game transport.

## Proposed interface, explicitly not MW5 API

The names below belong to this project only. Do not search for them as engine symbols or present them as working endpoints.

| Message | Minimum proposed fields |
|---|---|
| `Snapshot` | protocol version, adapter/build identifier, session epoch, monotonically increasing sequence, sample monotonic time, mission phase, authority flag, available capabilities, manual-order observation status/generation, actor binding generation, verified fields plus provenance |
| `ActorBinding` | session-local opaque actor handle, binding generation, assigned lance slot, human/AI ownership flag; pilot/mech IDs only if actually obtained |
| `Command` | random command ID, session epoch, actor handle/generation, allowlisted action, observed snapshot sequence, short TTL, expected manual-order generation, optional target handle/generation |
| `CommandResult` | same ID, stage, reason, native order evidence if observed, observation time; never upgrade stages solely because an outbound write succeeded |

First allowed action is project `FORM_ON_PLAYER`, mapped later to the verified native Form On Me path. Second is project `ATTACK_SELECTED_HOSTILE`, enabled only after hostility, alive/despawn state and the exact selected target can be validated in-game. Neither action includes arbitrary coordinates, functions or code. No eject, fire, save, load, purchase or equipment edits.

Initial tuning proposals: sample small telemetry at 2 Hz; reject command context older than 1 second; no more than one companion order per actor per 2 seconds; bound queues and payload size. These are test starting points, not measured requirements. Record actual response distributions before changing them. Expiry must check both a deadline fixed at the receiver's first receipt and the age of the referenced snapshot on an authoritative monotonic timeline. Revalidate both immediately before dispatch. Retransmission cannot refresh the original deadline, and fresh receipt cannot make stale context fresh. Do not trust wall-clock synchronization or model-supplied timestamps.

The [offline command contract](COMMAND_CONTRACT.md) defines the stricter proposed rules used for logical evaluation, including a model-owned clock and synthetic state. Passing that exercise establishes only the modeled invariants; actual native timing, manual-order observation and actor/authority signals remain UNKNOWN.

Command stages are separate:

```text
requested -> received -> validated -> dispatched
                                  -> rejected(reason)
dispatched -> native_order_observed -> behavioral_effect_observed
           -> unconfirmed_timeout
```

`received` proves transport only. `validated` proves checks only. `dispatched` proves a call attempt. If no native order readback exists, report that stage UNKNOWN and require independent visual evidence; do not manufacture an accepted acknowledgement. A behavioral observation needs an observer/metric outside the command sender.

## Validation and arbitration

- Re-resolve world and weak actor references immediately before dispatch. Reject a different session, stale generation, destroyed/ejected pilot, human-controlled pawn, slot reassignment or missing authority. Slot number or callsign alone is not identity.
- Bind explicitly once per mission; show pilot/mech/slot to the human when those fields are available. A mismatched identity cancels authorization rather than silently following a slot occupant.
- For attack, bind the target in the same snapshot and recheck team relation, validity and selection at dispatch. If it changed, reject and require fresh intent; never attack the nearest available actor as an implicit fallback.
- Check the session epoch before consulting the command-ID ledger. Within the same session, an identical-payload duplicate returns its recorded historical status without dispatch, even if the original command has since expired or the actor is no longer authorized. That history is not fresh acceptance or current actor state. Reusing a retained ID with a changed payload is rejected. Old-session requests are rejected rather than revived after ledger reset. A timeout yields uncertainty, not an automatic retry with a new ID.
- Keep a finite per-session command-ID ledger. The first-proof contract fails closed for new IDs when it is full; it does not evict retained IDs and risk replay. Matching duplicates can still retrieve history. Rejected/expired results already admitted to the ledger remain recorded for that session. A new epoch revokes bindings and requires a fresh baseline; it is not an automatic ledger-capacity workaround.
- Verified human orders increment a manual generation and immediately suspend autonomy for affected recipients. Resume only after matching verified completion of a known nonpersistent order or explicit release. Persistent orders, unknown persistence and unknown completion stay held; no timeout releases them. Missing, invalid or unverified manual-order observation rejects **all companion writes**; unknown is never generation zero. A disarm, possession change or lost connection remains a separate revocation requiring fresh validation. A physical kill switch alone is not proof of semantic override.
- All rejected/expired commands are removed from the action queue, never replayed after a menu or load; their ledger history remains subject to the rule above. Voice acknowledgement before native evidence must say only that the request was heard; a canned success line must not claim completion.

## State transitions and failures

| Condition | Required behavior |
|---|---|
| Pause, menu, loading, unknown phase | Reject commands; suppress tactical chatter; retain no action queue for resume |
| Mission restart/end, save reload, loss of authoritative world session (including host-session disconnect) | Rotate session epoch, revoke bindings, purge command ledger/queue, require fresh baseline; reject old-epoch traffic before ID lookup |
| Pilot death/ejection, pawn destruction or lance change | Stop control immediately; mark events only if verified; rebind through explicit identity checks |
| Player mech swap or human co-op possession | Revoke actor authorization; never treat a human pawn as the companion |
| Cloud, network, model or microphone failure | Keep native AI running; deterministic local controls may remain if armed; no inferred/model retry |
| Companion/IPC disappears while authoritative mission remains the same | Disarm and purge queued actions; retain same-session command history so reconnect cannot replay an old ID. Require valid fresh state and explicit rearming. No new native commands; existing native order continues; user retains ordinary control |
| Adapter has invalid pointers or cannot verify authority | Fail closed, record bounded error; never probe random functions or keep stale references |
| Log/disk queue full | Drop/rotate diagnostics, surface local fault; never block combat |

Co-op is a later, separate gate. Generic Unreal server ownership does not establish this game's command path. The proposed authoritative adapter lives with the host; human possession always wins. Replication, client assets/mod matching, reconnect and host change require explicit evidence and tests. No client-side mod requirement is asserted until the packaged implementation proves it.

## Persistence and personality

Initial release: persist personality/settings only; reset mission facts at boundaries. A local append-only campaign event journal is optional later work after stable identity and save lineage are verified. That later journal needs source, observed time, game/build context, campaign branch, pilot identity, confidence and stable event IDs. Verified facts, user-reported facts and roleplay remain separate. Retrieved text and model summaries cannot promote a claim to verified status.

Campaign and pilot stable IDs are UNKNOWN. This blocks campaign persistence; provisional labels do not remove that blocker. Never equate a mutable name/portrait, lance slot or raw memory address with a durable pilot ID. Gameplay control and initial conversation facts are mission-scoped.

On older-save load, suspend automatic memory commit. Establish the save lineage/checkpoint or ask the user to select a branch when inspection cannot determine it. Fork memory from that checkpoint; keep later events on the original branch. Do not tell the pilot it remembers victories, deaths or contracts that have not happened in the loaded timeline. Repeated mission outcomes deduplicate by verified event identity; absent one, hold as pending reconciliation rather than guessing.

Personality is a small editable behavior sheet: callsign, tone, radio brevity, boundaries and a few example exchanges. MW4-inspired rhythm is an aesthetic target, not a license to copy actor voices or assets. Loadout/contract discussion must identify its inputs (fresh telemetry, user-provided screen/details, or general game knowledge); say when inventory or mission information is unavailable. Conversation never silently changes orders.

## Voice and event discipline

Begin with push-to-talk and a chained recognition -> intent/text -> synthesis pipeline. Parse common commands deterministically; the model handles ambiguity and conversation. Pre-recorded or locally generated short acknowledgements can avoid paid generation on routine requests. A speech-to-speech option is later and must use the same arbiter.

- Separate mute microphone, mute companion speech and disarm control. Provide a physical interruption/kill binding independent of recognition.
- Headphones, application-level audio routing and gating during output reduce echo; test actual device leakage. If no reliable echo control exists, half-duplex push-to-talk is the baseline.
- User speech interrupts current TTS. Discard superseded speech and queued commands, not just audio output.
- Start with no unsolicited tactical orders. Proposed chatter budget: at most one short noncritical call every 20 seconds, suppress repeats, and prioritize verified danger over flavor. These are configurable design values, not game observations.
- An event classifier may say “left arm damaged” only with a verified component event. Without that field it must remain silent or explicitly discuss uncertainty. Silence is preferable to invented radio traffic.

## Data and transport security

Local settings and model artifacts live under companion/local, outside game assets. Keep raw microphone audio off by default; future optional recordings need explicit user participation and deletion/export. The initial release sends no utterances or mission facts to paid/cloud inference. It requires no runtime API credential.

Transport choice remains gated. If native facilities permit a Windows named pipe or shared memory, restrict it to the same user/session and authenticate endpoints. If loopback sockets are selected, bind only loopback, choose/configure the port at runtime, authenticate with a random session secret and use bounded framing. Do not copy a research example's public bind, unprotected map or hard-coded port. A custom token does not make an unauthenticated upstream loader secure.

Treat game strings, mod descriptions, memory text and retrieved content as data. No model-generated code evaluation, shell execution, filesystem browsing or permission changes occur in the runtime. Any native loader raises separate permission, stability and maintenance issues; its adoption requires review and explicit installation approval.

## Unresolved decisions

The official editor installation is confirmed. Source inspection reached generated declarations including `MWPlayerController.post_squad_order_class(...) -> None`, recipient arrays and worker/job readback candidates. Creation/cooking/lifecycle, reliable human-input observation and nonblocking shipping transport remain unresolved. The observer task owns the next targeted AddPlayerControllerComponents reference search. Implementation authorization covers local components, not an unproven live adapter. The historical command exercise and new simulation workbench prove neither native lifecycle detection nor accepted game orders.
