# Creation-only observer probe contract

Prepared **2026-09-23 UTC** after the [native source boundary](../research/OBSERVER_BASE_MODE_NATIVE_RESULT.md). **PROPOSED; assets NOT_BUILT; cook/deployment/test NOT_PERFORMED.** This is an offline experiment specification, not an installable package or authorization to deploy. No more user-assisted source exports are queued.

## Question and scope

Can one explicitly included registration instance become visible to the existing controller component factory and result in exactly one passive component on the intended controller during a disposable Instant Action mission? The factory caller remains unknown. The test must measure creation without inserting a manual factory call, replacing a stock controller or assuming automatic registration. A deliberate call would test a different mechanism.

`LanceObserverProbe` is a proposed project name. The existing [factory trace](../research/PASSIVE_OBSERVER_FACTORY_TRACE.md) and [observer handoff](PASSIVE_OBSERVER_HANDOFF.md) identify actual source classes and limits. The minimal proposed artifacts are one passive component and one configured `PlayerControllerComponentDataAsset_C` instance. The base data asset has no component selected and runtime addition disabled; the configuration must therefore be explicit and reviewable. Any diagnostic widget or other supported local readout is a separate artifact whose creation and cooked availability must also be demonstrated. No arbitrary native function, output port or runtime Python facility is assumed.

The first probe has no tactical telemetry loop, orders, movement/target writes, model or voice integration, external listener, training or campaign persistence. It observes only registration visibility, creation count, owner/controller identity and lifetime. No duplicate-prevention code may hide the factory's actual creation behavior during this measurement.

## Required package before execution

| Required artifact/evidence | Current status |
|---|---|
| Exact component/registration package names, inheritance and configured properties | NOT_BUILT; use observed classes, not guessed nodes |
| Supported diagnostic/readout mechanism and its lifetime | UNKNOWN/BLOCKED; must be demonstrated without assuming the missing factory call |
| Cook recipe, final descriptor, dependencies and source/cooked hashes | NOT_BUILT; use the documented official content-mod workflow |
| Independent evidence that the exact registration instance is included and visible in the relevant cooked registry | NOT_PERFORMED; method must be specified before a missing component can be interpreted |
| Exact isolated installation destination and full additions/removal manifest | NOT_BUILT; no retail files changed |
| Current editor/retail builds, DLC entitlement, active mods and measured disk requirement | Must be refreshed before execution; old metadata is insufficient |
| Stock Instant Action baseline, disposable scenario and expected controller identity | NOT_PERFORMED; no main campaign/save use |
| Rollback and normal-exit procedure with known configuration backup | NOT_PERFORMED; never discard unsaved work or delete unlisted files |

These missing items prevent execution now. They are concrete preparation work for the implementing task; this contract does not invent completed artifacts or a verified initialization mechanism. Editor/game permission does not itself supply retail deployment authorization.

## Proposed evidence record

The following are **test-record fields**, not claimed MW5 telemetry properties: build/configuration identity; probe source/cooked hashes; registration inclusion evidence; registry-visibility result and measurement scope; observed mission/controller identity; component instance count and owners; creation/configuration observations; transition performed; clean-exit/removal verification; discrepancy and stop reason. Mark unavailable evidence UNKNOWN rather than substituting zero or a successful package build.

## Minimal sequence and interpretation

1. Review actual artifacts and manifest, refresh configuration, establish a stock disposable Instant Action baseline, and verify the independent registration/readout measurements. Stop if either cannot be observed reliably.
2. In the authorized isolated configuration, start once with the passive probe. Compare expected controller identity, registration visibility and actual component count. Do not call the factory manually to make the result pass.
3. Only after an unambiguous single-instance observation, perform one planned possession transition and one mission exit/re-entry. Count instances and verify owner/lifetime changes; duplicate checks in the collected factory are not evidence of repeat-call safety.
4. Exit normally and roll back only the reviewed manifest entries. Verify baseline configuration and behavior are restored.

| Observation | Permitted conclusion |
|---|---|
| Package cooked but registry visibility unknown | Cooking completed; initialization unresolved |
| Registration verified visible, reliable readout shows zero instances | Automatic creation not demonstrated for this exact configuration; investigate caller/timing without broadening the run |
| One instance on wrong/unknown owner | Fail identity gate; stop |
| More than one instance or retained instance across an invalid lifetime | Fail lifecycle gate; stop |
| Exactly one correct instance across the bounded transitions, baseline behavior unchanged and rollback verified | Creation/lifetime pass for the recorded configuration only; no tactical telemetry, command, compatibility or gameplay-improvement pass |

Stop on an unexpected prompt, edit requirement, save/campaign access, crash, abnormal resource use, identity ambiguity, missing readout or changed native behavior. Preserve evidence and return to the known baseline; do not repeat a failing invocation unchanged. A future tactical observer needs the separate [full observation contract](PASSIVE_OBSERVER_HANDOFF.md) after this smaller creation test is justified and completed.
