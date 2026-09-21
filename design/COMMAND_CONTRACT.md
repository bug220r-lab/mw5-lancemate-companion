# Offline command contract exercise

Prepared 2026-09-20 while the official editor installs. **PROPOSED contract; SYNTHETIC inputs; MOCK_ONLY results.** This is an executable research model of the rules in [ARCHITECTURE.md](ARCHITECTURE.md). It is not a companion runtime, game adapter, native API or deployment choice.

## Question this work can answer now

Does our proposed arbitration policy prevent duplicate, stale, misdirected or overridden commands in explicitly constructed event sequences? Separating receipt from dispatch lets us examine changes that arrive while a command is waiting. Resolving policy contradictions now reduces the amount of reasoning mixed into later editor work.

It cannot establish whether MW5 exposes the required observations or command path. Every authority flag, actor handle, generation, snapshot and manual-order signal in this exercise is stipulated fixture data. Acquiring those values from the game remains UNKNOWN. No script here reads or controls the game, opens a listener, records audio, runs an LLM, or makes native calls.

## Run and inspect

From the project root:

```powershell
node .\scripts\Exercise-CommandContract.mjs
```

The [script](../scripts/Exercise-CommandContract.mjs) uses Node's built-in modules, reads only its [synthetic cases](../synthetic/command-cases.json) and its own source, then writes [OFFLINE_COMMAND_REPORT.json](../research/OFFLINE_COMMAND_REPORT.json). No package install is needed. The report includes fixture/script hashes, individual assertions and traces. A nonzero exit code indicates unmet expectations or an invalid fixture.

`EXPECTATIONS_MET` means the listed synthetic expectations match the model's output. A `mock_dispatch` event means the model would permit a call; no native call occurs. The model contains no transition to accepted order or observed game behavior. One case deliberately allows a second order after the configured cooldown; that does not authorize repeated runtime control.

## Proposed message and state rules

The first action is project-defined `FORM_ON_PLAYER`. Mapping it to an actual native Form On Me receiver is an editor task. Attack, arbitrary targets, coordinates, scripts, functions and additional message fields are rejected by this first exercise.

**Source-mapping update:** the [order lifecycle trace](../research/ORDER_LIFECYCLE_TRACE.md) establishes that native FollowJob worker initialization uses `GetPlayerSquadLeader`, overwriting the earlier IssuerPawn target. A future mapping of `FORM_ON_PLAYER` must verify that this native leader matches the intended current player target, or reject the intent. Supplying IssuerPawn alone cannot request arbitrary-actor following. The existing synthetic model/fixtures were not changed or rerun; their expected bindings remain stipulated, not native proof.

| Command field | Proposed meaning |
|---|---|
| `protocolVersion` | Exactly 1 for this exercise |
| `id` | Opaque bounded command identifier, unique within a session |
| `session` | Current mission/session epoch; never inferred from a callsign |
| `actorHandle`, `bindingGeneration` | Explicit current AI binding, unrelated to durable campaign identity |
| `action` | Only `FORM_ON_PLAYER` |
| `observedSequence` | Exact snapshot context used to form this intent |
| `manualRevision` | Expected observed human-order revision; unknown is not zero |
| `ttlMs` | Requested lifetime, constrained by the receiving model to 1–1000 ms |

The fixture state separately stipulates active mission, known authority, capability availability, a living AI-owned pawn, connection state, manual observation capability and a current sample. Integers, handles and time values have bounded/explicit validity checks. These are project contract names, not documented MW5 fields.

## Invariants

1. **Explicit arming and binding.** The human must arm the current valid state. Unknown ownership, authority, capability or manual-order observation rejects every write in this first proof. No fallback to an assumed revision of zero.
2. **Two checks.** Receipt validates the request and context. Dispatch rechecks the current context, binding, manual revision, phase, authority, sample age, deadline and cooldown. Passing receipt checks is not permission to act later.
3. **Fixed deadlines and trustworthy observations.** The model owns one monotonically advancing clock. Expiry is fixed at first receipt; dispatch at the deadline is expired. Retransmission never refreshes it. Context older than 1000 ms is stale even for a newly received command. Future/regressing sample times are invalid; a newer sample needs a newer sequence. Observation structure and chronology are checked before state is committed, including during a simultaneous pause or loss of authority. A rejected observation latches a fault: waiting for the clock or rearming cannot make it valid. Recovery requires a valid newer observation and explicit rearming. The last valid sequence/time/manual revision remain available for regression checks across unknown observations; only a new session resets that context.
4. **Historical duplicate results.** Only a same-session ID with an identical normalized payload gets the stored stage. That stage is historical, not a fresh statement about the pawn or current order. An altered payload is an ID collision. A rejected ID remains rejected. Old-session traffic is rejected before lookup.
5. **Finite queues and records.** The exercise permits two queued commands and retains eight IDs per session to make saturation easy to test. At capacity it rejects explicitly; a full ledger disarms and purges queued work without evicting old IDs. These small capacities are evaluation settings, not production sizing.
6. **Human precedence and invalidation.** A manual revision change, actor replacement, human possession, death, loss of authority/capability, pause/loading or disconnect revokes arming and cancels queued commands. Resume/reconnect/rearm never resurrects those entries. A new session clears volatile world/authority/capability/connection/actor/manual state and requires a fresh valid baseline; it cannot inherit permission from the previous mission. Reusing an earlier epoch identifier is rejected within a trace. Generating/retaining trustworthy epochs in a real runtime is unimplemented.
7. **Rate limit independent of arming.** The proposed 2000 ms cooldown starts at simulated dispatch. Disarm/rearm and session transitions do not reset it. The exact boundary is eligible only with fresh valid context.
8. **Uncertainty is retained.** A stipulated uncertain outcome changes a prior mock attempt to `unconfirmed`, revokes arming and never auto-retries. A new ID cannot bypass that disarm. Future real reconciliation and native readback are outside this model.

The exercise uses an intentionally strict rule: a changed snapshot sequence rejects a waiting intent, even if the new snapshot remains recent. This is a starting policy for the first proof, not a measured necessity; later relaxation needs a field-specific rationale and new cases.

## Coverage and remaining evidence

Cases cover normal permission, lack of arming, unknown/invalid manual observation, manual override while queued, duplicates before/after dispatch and expiry, ID collision, mission rotation, actor replacement, human possession, destruction, pause/resume, authority/connection loss, exact TTL/cooldown boundaries, stale/future/regressing observations, queue/ledger saturation, uncertainty, malformed/oversized requests and a backwards clock.

The fixtures are examples, not an exhaustive proof. They do not model concurrent threads, process restart, transport authentication/framing, real pointer lifetimes, native generation acquisition, latency or performance. A production design would need its own lifecycle and persistence analysis, particularly across process restarts. Starting the model anew never asserts that an actual mission has safely restarted.

Unattended-goal follow-up2026-09-20: the43-case baseline passed before changes. AddedC44–C47 for a wrong actor with matching generation, a null binding, a human override after simulated dispatch, and a disconnect/reconnect after simulated dispatch. All47cases now meet their expectations; the model code and original43case objects were unchanged. `connected=false` models companion/IPC loss within the same authoritative mission: retained ID history prevents replay, while queued actions and arming are revoked. Actual world/host-session replacement requires a new epoch and is a separate signal. This distinction is now explicit in ARCHITECTURE.md. C24 stipulates uncertainty; an actual acknowledgement timeout timer and native readback remain **NOT_IMPLEMENTED / NOT_PERFORMED**.

After editor inspection, replace each stipulated prerequisite with a source-backed acquisition method or retain UNKNOWN. Use [PROOF_OF_CONCEPT.md](PROOF_OF_CONCEPT.md) for the separate shipping test. No offline result passes its editor/source, native transport or live behavior gates.
