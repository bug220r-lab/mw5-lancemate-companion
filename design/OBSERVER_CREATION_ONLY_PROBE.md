# Creation-only observer probe contract

Prepared **2026-09-23 UTC** after the [native source boundary](../research/OBSERVER_BASE_MODE_NATIVE_RESULT.md). **PROPOSED; assets NOT_BUILT; cook/deployment/test NOT_PERFORMED.** This is an offline experiment specification, not an installable package or authorization to deploy. No more user-assisted source exports are queued.

## Question and scope

Can one explicitly included registration instance become visible to the existing controller component factory and result in exactly one passive component on the intended controller during a disposable Instant Action mission? The factory caller remains unknown. The test must measure creation without inserting a manual factory call, replacing a stock controller or assuming automatic registration. A deliberate call would test a different mechanism.

`LanceObserverProbe` is a proposed project name. The existing [factory trace](../research/PASSIVE_OBSERVER_FACTORY_TRACE.md) and [observer handoff](PASSIVE_OBSERVER_HANDOFF.md) identify actual source classes and limits. The minimal proposed artifacts are one passive component and one configured `PlayerControllerComponentDataAsset_C` instance. The base data asset has no component selected and runtime addition disabled; the configuration must therefore be explicit and reviewable. The [non-executable asset specification](OBSERVER_ASSET_SPEC.json) and [authoring/readout review](../research/OBSERVER_AUTHORING_READOUT_REVIEW.md) distinguish supported declarations from missing graph construction and shipping validation. A diagnostic widget/readout needs an actual supported implementation and measurement design before deployment; whether it appears in the shipping game is a test outcome. No arbitrary native function, output port or runtime Python facility is assumed.

The first probe has no tactical telemetry loop, orders, movement/target writes, model or voice integration, external listener, training or campaign persistence. It observes only registration visibility, creation count, owner/controller identity and lifetime. No duplicate-prevention code may hide the factory's actual creation behavior during this measurement.

## Required package before execution

| Required artifact/evidence | Current status |
|---|---|
| Exact component/registration package names, inheritance and configured properties | NOT_BUILT; use observed classes, not guessed nodes |
| Concrete supported diagnostic/readout implementation and measurement design | NOT_BUILT; probe-started UMG is a positive-only candidate; independent negative/teardown measurements remain unresolved |
| Cook recipe, final descriptor, dependencies and source/cooked hashes | NOT_BUILT; use the documented official content-mod workflow |
| Cooked-registration inclusion/visibility/load/cast measurement design | NOT_PERFORMED; specify supported methods before deployment; runtime outcomes may be collected during the authorized run |
| Exact isolated installation destination and full additions/removal manifest | NOT_BUILT; no retail files changed |
| Current editor/retail builds, DLC entitlement, active mods and measured disk requirement | Must be refreshed before execution; old metadata is insufficient |
| Stock Instant Action baseline, disposable scenario and expected controller identity | NOT_PERFORMED; no main campaign/save use |
| Rollback and normal-exit procedure with known configuration backup | NOT_PERFORMED; never discard unsaved work or delete unlisted files |

Missing actual assets, authoring/readout implementation, manifest and deployment authorization prevent execution now. Prior successful automatic initialization or runtime registry visibility is not required to authorize a properly prepared bounded positive attempt: those may be outcomes of the run. A fresh uniquely attributable observation of a real component can establish creation without explaining registry discovery. Silence remains INCONCLUSIVE. Editor/game permission does not itself supply retail deployment authorization.

## Proposed evidence record

The following are **test-record fields**, not claimed MW5 telemetry properties: build/configuration identity; probe source/cooked hashes; registration inclusion/visibility/load/cast evidence and measurement scope; separate component, controller, pawn and world/session identities; actual component enumeration and owners; creation/configuration observations; readout liveness; transition performed; clean-exit/removal verification; discrepancy and stop reason. Mark unavailable evidence UNKNOWN rather than substituting zero or a successful package build. Callback count and the factory's requested-class list are not instance counts.

Predeclare observation points: initial mission/controller establishment, before and after one possession change, before mission exit, and after a new world/controller has been established on re-entry. A controller-owned component may legitimately remain on the same live controller when only its pawn changes. Destroyed/replaced controllers or worlds need separately established liveness and identity evidence; do not infer invalid retention from a changed pawn alone. Missing teardown notification or disappearing UI is UNKNOWN without independent live evidence.

## Minimal sequence and interpretation

1. Review actual artifacts, measurement design and manifest; refresh configuration; establish a stock disposable Instant Action baseline and the intended owner/lifetime rules. State which measurements can support only positive observations and which independently support absence or teardown.
2. In the authorized isolated configuration, make one bounded positive attempt. A fresh attributable live-component observation establishes at least one creation, with missing fields stated. Separately establish owner identity and reliable class enumeration before claiming exactly one correct instance. Do not call the factory manually to make the result pass. On absent output, record INCONCLUSIVE and stop this attempt.
3. Only after an unambiguous single-instance observation on the verified intended controller, perform one planned possession transition and one mission exit/re-entry at the declared observation points. The same live controller with a new pawn may retain its component. Verify controller/world replacement and component liveness separately before judging teardown or duplication; missing independent evidence stays UNKNOWN.
4. Exit normally and roll back only the reviewed manifest entries. Verify baseline configuration and behavior are restored.

| Observation | Permitted conclusion |
|---|---|
| Package cooked but registry visibility unknown | Cooking completed; initialization unresolved |
| Fresh uniquely attributable observation of a real component | Creation observed: at least one; state unknown owner/count/lifetime fields; no proof of factory caller or registry discovery |
| Reliable complete enumeration reports one probe on the verified intended controller | Exactly-one snapshot established; transition/teardown and final acceptance remain separate |
| No widget/message or independently unverified zero | INCONCLUSIVE; stop this attempt, not proof of zero components |
| Independent live readout, relevant registry inclusion/visibility, successful load/cast and intended controller selection are established, and reliable enumeration shows zero | No creation observed in the bounded configuration/window; caller/timing remain unresolved |
| Observed component has wrong/unknown owner | Preserve the positive creation observation if valid; fail identity gate and stop |
| Same live controller, different pawn, same owned component | Potentially valid retention under the declared controller-owned lifetime; verify bindings and actual count |
| More than one actual instance on the intended controller, or independently proven live retention beyond a declared invalid controller/world lifetime | Fail count/lifecycle gate; stop |
| Teardown notification missing or widget disappeared without independent liveness evidence | UNKNOWN; neither destruction nor invalid retention is proved |
| Exactly one correct instance across the bounded transitions, baseline behavior unchanged and rollback verified | Creation/lifetime pass for the recorded configuration only; no tactical telemetry, command, compatibility or gameplay-improvement pass |

Stop on an unexpected prompt, edit requirement, save/campaign access, crash, abnormal resource use, identity ambiguity, missing readout or changed native behavior. Preserve evidence and return to the known baseline; do not repeat a failing invocation unchanged. A future tactical observer needs the separate [full observation contract](PASSIVE_OBSERVER_HANDOFF.md) after this smaller creation test is justified and completed.
