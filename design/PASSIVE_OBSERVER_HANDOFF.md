# Next integration experiment: passive actor-bound observation

**September 23 source checkpoint:** controller/reference/mode/base-mode lookups are complete. The [last export](../research/OBSERVER_BASE_MODE_NATIVE_RESULT.md) reaches native `/Script/MechWarrior.MWGameMode` through an empty Blueprint body; it does not expose the factory caller. Do not repeat these lookups. The smaller [creation-only probe contract](OBSERVER_CREATION_ONLY_PROBE.md) must be made concrete before the broader observation experiment below. No observer assets, registry/readout mechanism or cooked startup have been proven.

**Unattended preparation complete:** the [authoring/readout review](../research/OBSERVER_AUTHORING_READOUT_REVIEW.md) provides a non-executable asset recipe and exact supported-interface gaps. A later bounded positive attempt need not assume successful initialization or prior runtime registry visibility; those may be measured outcomes. Absence requires independent live measurement, while positive creation, reliable exactly-one enumeration and full lifecycle/rollback acceptance are separate. Same-controller pawn changes may validly retain the component. The corrected smaller contract governs those distinctions before this broader telemetry proposal.

Prepared 2026-09-21 UTC. PROPOSED, NOT_BUILT and NOT_PERFORMED. This is the handoff after the offline package, not permission to deploy. Read [control support](../research/AI_CONTROL_SUPPORT_ANALYSIS.md), [tactical state](../research/TACTICAL_STATE_TRACE.md) and [order lifecycle](../research/ORDER_LIFECYCLE_TRACE.md) with their cited RUN sources.

## Smallest credible first route

Investigate an official cooked content-mod **passive component plus diagnostic widget**, without an external inbound receiver. This separates the unresolved external transport from the immediate question: can a shipping-compatible, mission-scoped observer be instantiated and display correct current AI state? Only native read operations belong in the observer. No order submission or target/movement writes.

The existing `PlayerControllerComponent` / `PlayerControllerComponentDataAsset` pattern is a candidate registration mechanism. `MW5PlayerController.AddPlayerControllerComponents` queries the registry, checks `bAddAtRuntime`, adds a class and calls `ControllerConfigured` (010 source1444–1741). The factory's caller is not established. **Do not assume that adding a data asset automatically starts a mod.** The base component has ticking and autoactivation disabled (238 defaults2–7); the base data asset has no selected component and runtime addition false (239 defaults2–3).

First resolve the exact official mod initialization path and how it invokes or bypasses this factory. Use installed mod templates/configuration and current primary PGI documentation narrowly. If the mechanism cannot be established statically, propose a minimal creation-only cooked probe as a separate supervised experiment. Do not replace stock controller assets speculatively.

The factory clears its recorded component-class list before scanning (010 source1456–1465). Its duplicate check therefore does not establish idempotence across repeated calls. The creation probe must count instances across mission/possession transitions and verify that it cannot accumulate duplicate observers.

## Proposed artifacts and installation gate

Proposed mod identifier: **LanceObserverProbe**. Proposed assets: one passive component, its registration data asset if supported, and one diagnostic widget. These are project names, not existing MW5 assets. None has been created or packaged.

Before any test, the implementing task must produce: actual initialization/cooking steps, asset/package list, source and cooked hashes, final mod descriptor, exact destination beneath the verified retail Mods directory, dependencies, enabled-mod configuration changes, disk requirement and removal manifest. The present file is not a fabricated ready-to-install manifest. Any required change outside the isolated new mod needs its own concrete rationale and rollback entry.

For the first measurement, an in-game diagnostic overlay avoids inventing a socket/port or treating synchronous Victory file I/O as asynchronous. Output must show diagnostic status and unknown values directly. Its actual creation/lifetime and ability to survive cooking still require proof. Persistent recording/external telemetry remains a later transport question. Never claim editor Python is the packaged runtime: its principal module is UncookedOnly.

## Observation and lifecycle contract

Proposed sampling target: 2 Hz for initial observation, plus immediate invalidation on possession/world/mission changes. This is a test setting, not sufficient latency for piloting. Only read game-owned objects on the supported game thread; cap traversal to current player squad and three AI recipients. No broad actor scans each frame, synchronous external I/O, polling for model results or holding references across world transitions.

Display the current world/session identity, sequence/sample age, authority, pause/loading/menu/cutscene state, player-squad leader and the selected unit's squad ID, controller, pawn, unit GUID, worker, job type/state, follow target and position. Distinguish native values from observer-generated session/sequence/binding-generation counters. Reflect unknown authority or acquisition failures explicitly.

Re-resolve reciprocal controller/pawn binding, squad membership, alive/configured state and human ownership for every sample. Invalidate on destruction, replacement, possession or loss of authority. `HandlePawnPossessionChanged` → `OnPawnChanged` → `HandleMechBindings` → `ControllerConfigured` supplies observed source leads (010 source3575–3586,6580–6782,4722–5426). Polling identity confirmation remains necessary until event coverage is measured.

Specifically, HandleMechBindings has no connected invalid-new-pawn output (010 source5050–5059), and its spectator branch has a multiplayer guard (4997–5005). A null/unpossessed transition must invalidate via another proven event or the next sample; do not promise immediate callback coverage before measuring it. No command layer may act on a retained old binding in that gap.

## Manual order provenance and completion

Record ordinary player actions without submitting anything. Known UI entry candidates are D-pad action Activate and the LanceStatusWidget OnOrderIssued/IssueOrderToRecipient path. 008 UpdateBindings binds its order-window delegate (4239–4258), while CancelOrders calls CloseOrderWindow (4193–4214); that menu action does not establish cancellation of a worker's job. Cover keyboard, controller, selection changes and mech swap before relying on one hook.

`bPlayerIssued` cannot distinguish a human input from a companion using the player route. A physical-input revision must be acquired separately and correlated to resolved recipients; if unsupported, live autonomy stays disabled. An input event alone also does not prove the order was accepted. Track submission, native worker/job assignment, completion reason and observed movement separately. Ally_GoToLocationJob's arrival dialogue/path callback is not correlated job completion; Follow has no collected formation-reached Finish(Success) path. Human intent therefore cannot be cleared on a timer or an affirmative radio line. Persistent follow/guard-style intent requires explicit release unless real completion semantics are proven.

## Supervised test and rollback

After the actual manifest is reviewable and deployment/launch is authorized, refresh retail/editor builds, mod hashes, DLC and active mods. Use stock Instant Action and no campaign save. Record vanilla behavior first. Start the passive mod disarmed, identify one AI and a sentinel, then have the user move, issue ordinary orders, pause, switch mechs and end/restart the mission. Compare display samples with independent visible behavior. Native tasks must remain unchanged.

Pass only if identity, state freshness, mission transitions and manual-input provenance are demonstrated and the observer neither issues commands nor causes material frame-time regression. Record sample gaps and frame-time measurements rather than claiming the configured 2 Hz was achieved. On ambiguity or instability, stop the probe and preserve findings; do not advance into command control.

Exit normally, remove only manifest-listed additions, restore any specifically backed-up mod configuration and verify the original state. Do not delete unlisted files, caches or user saves. After this passes, the separately approved one-AI Form On Me proof can reuse the observer while keeping a distinct native-order baseline on the sentinel.

## Remaining engineering questions

1. Official mod initialization and cooked registration: exact supported mechanism still unverified.
2. Manual origin and persistent-intent lifecycle: callbacks are candidates, complete coverage unverified.
3. External communication: bounded asynchronous transport, thread/lifetime behavior and shutdown unknown; no port or loader selected.
4. Native job scheduling, recipient authority and visibility semantics: declarations/source wrappers do not expose all internals.
5. Direct piloting: separate low-level perception/control engineering; the special dropship and mech-swap scripts are leads, not a complete pilot API.

These are explicit next research/test obligations. Their absence does not prevent the offline package from being completed, and does not establish that integration is impossible.
