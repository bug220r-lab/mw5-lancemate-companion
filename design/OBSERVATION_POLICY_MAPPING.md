# Observation envelope, policy mapping and read-only replay

Prepared 2026-09-21. **PROPOSED PROJECT CONTRACT. All shipping mappings UNVERIFIED.** This local Node module validates supplied data and replays the existing deterministic policy. It does not obtain observations, implement a game adapter, grant control authority, verify a sender or dispatch commands. No packages, model downloads, game/editor calls or paid services are involved.

Implementation: [observation.mjs](../companion/observation.mjs). Policy: [tactical-policy.mjs](../scripts/tactical-policy.mjs). Tests: [observation.test.mjs](../companion/tests/observation.test.mjs), including independent adversarial checks in [observation-review.test.mjs](../companion/tests/observation-review.test.mjs).

## API and evidence labels

```js
validateObservation(frame, {
  nowMs,                    // required caller clock, same calibrated time domain
  previousFrame: null,      // preceding structurally accepted observation envelope
  continuity: null,         // preceding nextContinuity; trusted caller-owned history
  allowSynthetic: false
}) // => { ok, errors, classification, snapshot, nextContinuity }

replayFrames(frames, { allowSynthetic: false })
// => { classification, results: [{ index, accepted, classification?, decision }],
//      errors: [{ index, errors }] }
```

The proposed envelope is `{ schemaVersion:1, kind:'observation', provenance, adapterId, session, sequence, observedAtMs, snapshot }`. `snapshot` uses the existing policy's input contract. Optional `replayNowMs` is used only by offline replay. No field is an MW5 telemetry name merely because it appears in this interface.

`provenance` must be `MOCK_ONLY` or `GAME_OBSERVED`. Synthetic frames are rejected by default. A game-labelled frame receives **GAME_OBSERVED_UNVALIDATED** classification: its string label is not evidence of a verified adapter or authentic recording. Unknown provenance yields INVALID_OBSERVATION. The separate dispatch layer must independently enforce adapter identity, enabled capabilities, artifact/configuration verification and authorization; `ok:true` cannot enable an action.

Replay is **MOCK_ONLY** if any replayed input claims synthetic provenance; otherwise its classification is **REAL_OBSERVATION_REPLAY_UNVALIDATED**. The underlying policy still labels its decisions MOCK_ONLY and always emits `dispatchable:false`. This deliberate distinction prevents recorded input from promoting the policy into demonstrated gameplay capability. Even an empty/failed replay with the real-observation label proves nothing about its input provenance.

## Validation and continuity

The module accepts plain JSON-compatible data and copies before normalization. It rejects accessors, executable/nonfinite values, nonplain instances, cycles, dangerous object keys, sparse/extended arrays, depth above 32 and more than 30,000 visited values. It never invokes getters while copying. These bounds apply to this in-memory API; a future transport must separately bound serialized bytes before parsing.

Envelope version/kind, nonempty adapter ID, policy-compatible session ID, nonnegative safe-integer sequence and timestamps are mandatory. Snapshot version, session, sequence and observation timestamp must match the envelope. Caller `nowMs` replaces packet `snapshot.nowMs`; no packet clock can make a stale frame fresh. Age must be at most 1000 ms and observation time cannot be in the caller's future. This threshold is the policy's proposed research limit, not measured MW5 latency. Clock calibration remains an adapter obligation.

Within a session, adapter/provenance changes, nonincreasing sequence and regressing observation time reject continuity. Member IDs must be unique; pawn/controller aliases reject control. Each member requires valid identity/generation, squad membership, reciprocal binding, AI ownership, alive/configured state and authority. A verified leader pawn cannot also be a commanded teammate. A pawn/controller/AI-ownership change must advance the binding generation; generations cannot regress. These checks validate assertions, not their native truth.

Stateful callers must carry **both** `previousFrame` and `nextContinuity`. The former orders fresh coherent packets, including rejected control packets; the latter retains the last accepted binding generation plus every pawn/controller ownership claim. A repeated invalid binding cannot lower the generation watermark or become valid by replacing the previous packet. Claims survive temporary member absence and binding replacement. A historical pawn or controller cannot be relabelled as another logical companion in the same mission: this protocol has no verified identity-reassignment proof. A new world/session resets the history only under the caller's lifecycle control; untrusted packets must not be allowed to grant themselves a reset.

Continuity is detached plain data with `{version:1,session,adapterId,provenance,actors,pawnClaims,controllerClaims}`. The budget is three stable logical companions and 256 distinct claims per binding kind per mission. At capacity, new binding claims reject control and retain the existing history; old claims are never evicted to admit a potentially replayed identity. Only coherent identity samples admit new binding claims. A failed phase, human ownership or missing control authority may still preserve valid identity observations and fresh active human holds. Passing only `previousFrame` remains a one-frame compatibility check, not adequate mission-wide identity continuity.

Human possession is an independent invalidation. Each known actor may carry an `ownershipFloor` recording a human-owned generation; return to AI requires a strictly greater generation and policy reobservation. Even if a coherent human-owned sample of the exact already known pawn/controller fails to increment its generation, the validator keeps a deny-only floor at the maximum previously accepted/observed generation. It does not admit a new or regressed binding, and repeated AI claims at the revoked generation stay rejected. This conservative record cannot prove that a physical possession event actually occurred; that evidence remains the future adapter's responsibility.

Targets cannot contain duplicate IDs; each member can have only one engagement per target and one record per candidate position. Contradictory records are not resolved by choosing the favorable one. Missing tactical values are copied as explicit nulls; a missing array is not fabricated as an empty known inventory. Detailed tactical sufficiency remains the existing policy's responsibility. Unknown heat, health, path, visibility, manual-order state or weapon range is never converted to zero/false/true knowledge.

Known target timestamps may not be newer than their enclosing snapshot and must also satisfy the caller-clock freshness bound. An optional `observedAtMs` on an engagement or candidate is project evidence metadata: when present it must be a finite nonnegative safe integer, not future to the snapshot, and at most 1000 ms old at evaluation. Explicit null, stale or future timestamps reject control instead of being silently refreshed. If this optional timestamp is omitted, the proposed atomic-snapshot contract says the derived range/path/fire information was sampled with the envelope; this is an adapter obligation, not a proven native mapping.

Two rejected-frame categories matter:

- **Untrustworthy envelope/ordering/time/record:** snapshot is null. Replay does not enter the policy or advance its prior frame/state. A stale or replayed release cannot clear a human hold.
- **Fresh structurally coherent frame with failed control/identity/inventory guards:** `ok:false` but a detached snapshot is returned. This is solely useful for a fail-closed policy pass retaining active human orders. Replay forces that pass's authority to false, so every recommendation is DEFER and no release/completion clears a hold. Snapshot presence never overrides `ok:false`.

Replay carries the policy's returned decision state and the validator's separate identity continuity. It uses `frame.replayNowMs ?? frame.observedAtMs`, never the machine's current date, so old recordings are evaluated at their recorded time. Recorded clock regression rejects the step. New sessions reset mission-scoped policy history; replay refuses to return to a retired session. Active holds survive paused/authority-rejected frames and temporary actor absence. Unknown manual persistence remains null in the snapshot; conservative policy hold retention must not pretend that persistence was observed. No state is persisted across calls or to a campaign.

The API does not establish cryptographic authenticity, reliable native input provenance, event completeness, absence of spoofed fields, or cross-session truth. A future live coordinator must own its accepted-frame history and lifecycle; it cannot let an unverified sender reset session IDs to obtain authority.

## Every policy input field: proposed meaning and source status

**No row below is GAME_VERIFIED.** Source leads refer to reviewed editor 1.1.390.0e / UE4.26.2 exports and native declarations. A declaration or connected Blueprint read is narrower than a verified shipping observation.

| Field(s) | Proposed meaning / source lead | Mapping status and required verification |
|---|---|---|
| Envelope `schemaVersion`, `kind` | Versioned observation data contract. | PROJECT_METADATA; no native equivalent asserted. |
| Envelope `provenance`, `adapterId` | Sender's input-origin label and adapter name. | UNVERIFIED_ASSERTION; independent adapter verification required. |
| Envelope/snapshot `session` | Mission/world epoch bound to actual lifecycle. | PROJECT_METADATA; reliable startup/reset boundary unresolved. |
| Envelope/snapshot `sequence` | Monotonic sample ordering within one session. | PROJECT_METADATA; producer must prevent reuse/reordering. |
| Envelope/snapshot `observedAtMs` | Sample timestamp in calibrated caller clock domain. | PROJECT_METADATA; sampling instant and clock alignment unmeasured. |
| Snapshot `schemaVersion` | Existing policy input version, currently 1. | PROJECT_METADATA; must equal envelope version. |
| Snapshot `nowMs` | Evaluation time. | CALLER_CLOCK; packet value is replaced. |
| Envelope `replayNowMs` | Historical evaluation clock for offline replay only. | RECORDING_METADATA; a value does not authenticate the recording. |
| Snapshot `phase` | Active mission versus pause/loading/menu/cutscene/transition. | SOURCE_LEADS: GameState/Area/pause declarations; complete conjunction and lifecycle UNVERIFIED. |
| Snapshot `authority` | Current verified authority for the observed squad/world. | SOURCE_LEAD: Actor.has_authority; full adapter execution context/ownership UNVERIFIED. |
| `leader.pawnId` | Session-scoped identity of the actual player-squad leader pawn. | SOURCE_LEAD: GetPlayerSquadLeader and follow worker setup004; live identity mapping UNVERIFIED. |
| `leader.matchesNativeSquadLeader` | Explicit current comparison with native follow-leader resolution. | PROPOSED_COMPOSITE; cannot infer from order issuer or UI slot. |
| `lancemates[].id` | Stable within-session companion actor identity. | PROJECT_BINDING; not native display index, pilot name or raw pointer. |
| `pawnId`, `controllerId` | Current session-scoped bindings to actual objects. | SOURCE_LEADS: Controller.K2_GetPawn and Pawn.GetController; live serialization/lifetime mapping UNVERIFIED. |
| `generation` | Changes whenever actor/controller/ownership binding changes. | PROJECT_BINDING; complete invalidation/event coverage UNVERIFIED. |
| `member` | Current verified player-squad membership. | SOURCE_LEADS: MWSquad.is_member/get_ai_members; server-only recipient mapping must also be respected. |
| `reciprocalBinding` | Current pawn's controller and controller's pawn agree. | PROPOSED_COMPOSITE from two native reads; dispatch-time recheck still needed. |
| `aiOwned` | Valid AI controller and no human possession. | SOURCE_LEADS: Pawn.IsPlayerControlled and240 swap gates; negative human check alone is insufficient. |
| `alive` | Selected mech is not dead/destroying. | SOURCE_LEADS: living component IsDead and actor lifetime; actual actor/version/semantics UNVERIFIED. |
| `configured` | Native mech configuration is ready. | SOURCE_LEAD: MWMech.is_configured declaration; availability/timing UNVERIFIED. |
| Member `authority` | Authority for this exact current recipient. | SOURCE_LEAD: Actor.has_authority; not inherited from a class default or global flag. |
| `manual.observable` | All required human-order paths are currently observable. | UNRESOLVED; D-pad/keyboard delegates are leads, not complete physical-input provenance. |
| `manual.revision` | Monotonic observed human-intent version. | PROJECT_METADATA; reliable acquisition UNRESOLVED. |
| `manual.orderId` | Correlates human intent with the tracked order throughout its lifecycle. | PROJECT_CORRELATION; native job/change identity alone does not establish correlation. |
| `manual.status` | none/active/completed/released according to verified human-intent lifecycle. | UNRESOLVED; UI OnComplete, menu close and arrival dialogue cannot supply completion/release. |
| `manual.persistent` | Whether intent requires explicit release instead of completion-based resumption. | PROPOSED_POLICY_METADATA; do not equate blindly with a native posting's bPersistent field. |
| `healthFraction` | Normalized relevant mech condition in [0,1]. | SOURCE_LEAD: GetCurrentHealthPercent/051; scale and interpretation relative to armor/internal health UNVERIFIED. |
| `heatFraction` | Normalized current heat in [0,1] for this policy. | SOURCE_LEAD: heat-component getters; scale/overshoot/shutdown treatment UNVERIFIED. |
| `ammoAvailable` | At least one usable weapon opportunity, including energy weapons. | PROPOSED_AGGREGATE; ammo-bin counts alone are insufficient and must not be double-counted. |
| `distanceToLeaderM` | Current separation from correctly bound leader in meters. | PROPOSED_DERIVATION from position reads; coordinate conversion/calibration UNVERIFIED. |
| `weaponRangeM.min`, `.max` | Simplified currently useful weapon envelope in meters. | PROPOSED_AGGREGATE; native capability/range declarations are leads, not an established exact envelope. |
| `capabilities` | Available recommendation vocabulary: regroup/focus/reposition. | PROJECT_POLICY_INPUT; supplied strings are not native action acceptance or dispatcher permissions. |
| `safeRegroupKnown` | Route to correct leader is presently established as acceptably safe. | PROPOSED_ESTIMATE; no single discovered native getter supplies this claim. |
| `engagements[].targetId` | Links this actor's observed opportunity to a target record. | PROJECT_JOIN; target identity must be friendly-known and current. |
| `engagements[].distanceM` | Actor-to-target distance in meters. | PROPOSED_DERIVATION; native positions/units require calibration. |
| `engagements[].lineOfFireKnownClear` | A current usable firing path is established. | UNRESOLVED; native IsActorVisible's history threshold is not instantaneous firing clearance. |
| Optional `engagements[].observedAtMs`, `positions[].observedAtMs` | Age of a supplied derived observation; omission asserts atomic sampling with the envelope. | PROJECT_EVIDENCE_METADATA; explicit unknown/stale/future time rejects control. No corresponding native field is claimed. |
| `positions[].id` | Shared identity for one supplied candidate location. | PROJECT_RESERVATION_KEY; equal physical candidates require consistent IDs. |
| `positions[].pathFeasible` | A route for this exact actor is currently verified. | UNRESOLVED; nav projection, EQS scoring or a nonpartial-path flag alone is not enough. |
| `positions[].occupied` | Current candidate occupancy is known. | PROPOSED_GEOMETRIC_OBSERVATION; no mapping established. Null is not free space. |
| `positions[].saferThanCurrent` | Candidate is materially safer under an explicit friendly-knowledge model. | PROPOSED_HEURISTIC; requires a measured definition, not hidden enemy data. |
| `positions[].targetId` | Known target associated with a firing candidate. | PROJECT_JOIN; does not permit hidden target state. |
| `positions[].distanceToTargetM` | Candidate-to-known-target distance in meters. | PROPOSED_DERIVATION; supplied geometry/units must be verified. |
| `positions[].lineOfFireKnownClear` | Firing clearance at that candidate for this actor. | UNRESOLVED; score-only visibility tests do not establish this boolean. |
| `targets[].id` | Stable session target binding. | PROJECT_BINDING; cannot use ambiguous display labels. |
| `targets[].knownToLance` | Information was legitimately acquired by the friendly lance. | UNRESOLVED_PROVENANCE; actor existence or enemy awareness is insufficient. |
| `targets[].visibleToLance` | Current friendly observation makes the target presently usable. | UNRESOLVED; hysteretic native visibility must not be relabelled current clear sight. |
| `targets[].allegiance` | Current hostile/friendly/other relation from friendly observations. | SOURCE_LEADS: native attitude checks; team/faction handling and freshness UNVERIFIED. |
| `targets[].alive` | Known current target life state. | SOURCE_LEAD: living components; no hidden knowledge from unobserved enemies. |
| `targets[].observedAtMs` | Age of this target's information independently of frame age. | PROJECT_METADATA; known time must not exceed the envelope sample and must be fresh at the caller clock. Unknown remains null. |
| `targets[].threat` | Normalized [0,1] prioritization estimate. | PROPOSED_HEURISTIC; no native threat score or optimal model claimed. |

## Source references and limitations

[Tactical-state trace](../research/TACTICAL_STATE_TRACE.md) gives exact API locations for identity, membership, health, heat, ammunition, range, visibility, movement and mission signals. [Control support](../research/AI_CONTROL_SUPPORT_ANALYSIS.md) and its [independent review](../research/CONTROL_SUPPORT_INDEPENDENT_REVIEW.md) explain component-factory uncertainty, guarded possession notifications and CancelOrders meaning menu close. [Order lifecycle](../research/ORDER_LIFECYCLE_TRACE.md) and [movement analysis](../research/AI_MOVEMENT_ANALYSIS.md) distinguish native follow leader, arrival callbacks, jobs and observed behavior. [Combat analysis](../research/AI_COMBAT_ANALYSIS.md) separates target/visibility history and native computations from exposed policy. [The playbook](TACTICAL_PLAYBOOK.md) specifies simplified ammunition/range meanings and policy-only thresholds.

Tests use Node's built-in test runner: `node --test companion/tests/observation.test.mjs`. They cover provenance, clock replacement/boundaries, aliases, contradictory records, binding changes, historical replay, sequence/time rejection, stale release, paused active holds, absence, persistent completion, session reset/retired replay, hidden information, purity and malformed data. Passing these tests establishes only the local contract; no real recording has been validated and no native action has been accepted or executed.
