# First retail observer observation

**OBSERVED: the user reached an Instant Action mission, but the custom readout was not visible. Component creation is INCONCLUSIVE.** The user also reported never seeing `BEGINPLAY SNAPSHOT — NOT LIVE` on the main menu, loading screen or earlier in the mission. This is an observation of missing output, not proof that no component exists.

## Evidence

- The user installed the reviewed package. All three retail files matched the [package receipt](OBSERVER_PACKAGE_RESULT_2026-09-25.json) immediately before this observation.
- Retail `Mods/modlist.json` records only `LanceObserverProbe`, enabled. This establishes configuration, not actual package mounting or registry visibility.
- Refreshed `game_info.xml` identifies retail `1.14.390`, CL456620. Shipping process 24264 started at 06:09:55 UTC on 2026-09-25.
- The supplied screenshot shows an in-mission cockpit and normal game HUD; the diagnostic text is not visible. Exact scenario/loadout, elapsed observation duration, DLC entitlement and absence of other runtime influences were not independently established.
- In the two known log locations checked, no attributable current shipping log was found. The newest AppData `MW5Mercs.log` ends with editor shutdown at 06:01:48 UTC, before the shipping process started. The retail installation's `MW5Mercs/Saved/Logs` directory does not exist. Do not diagnose this mission using the earlier editor/cook log.
- A byte-level inspection of the cooked `AssetRegistry.bin` found the exact registration object/path, `PlayerControllerComponentDataAsset_C`, and the component/readout names. Its SHA-1 matches the native PAK listing. Printable strings establish byte presence only; no structured registry parse, shipping merge, load or cast was demonstrated.

The original screenshot is preserved unmodified with SHA-256 `888b98071b8b11347ca08fc29f2a406ae00cec6e496bcceb0de315ab523bd3f7`. The [result receipt](evidence/retail-observer/startup-observation-20260925T061051Z/result.json), [pre-observation record](evidence/retail-observer/startup-observation-20260925T061051Z/attempt.json) and [registry byte inspection](evidence/retail-observer/startup-observation-20260925T061051Z/cooked-registry-byte-inspection.json) pin the source paths and limitations. No mod-off mission baseline or independently measured lifecycle result exists for this attempt.

## Bounded source diagnosis

An independent reviewer rechecked the exact [factory trace](PASSIVE_OBSERVER_FACTORY_TRACE.md), [native boundary](OBSERVER_BASE_MODE_NATIVE_RESULT.md), [authored source review](AUTHORED_OBSERVER_REVIEW_RESULT.md), and relevant underlying exported pins/defaults. No concrete registration/type/path mismatch or activation defect was found.

The stock factory searches the expected data-asset class with subclasses included, without a path/name filter. Its native component-add return is ignored, and a requested-class list is not an enumeration of attached instances. The factory caller and timing remain unknown in the collected source.

The authored graph can stop silently at invalid owner, failed controller cast, nonlocal controller, invalid widget creation, or unsuccessful AddToPlayerScreen. Failed display removes and clears the owned widget. EndPlay also removes it. Display is attempted once at BeginPlay with ZOrder 0; occlusion or early timing are possibilities, not observed causes. The stock and authored components both have Auto Activate disabled, and the reviewed BeginPlay graph has no activation prerequisite; changing that setting is not an evidence-backed fix.

## Next diagnostic boundary

Stop this observation attempt here. Do not proceed to possession/lifecycle acceptance or repeat the same mission unchanged to manufacture a pass. The user was asked to return to the main menu; normal exit to desktop permits later preparation without modifying a running game.

A useful next diagnostic must distinguish entry into the component from success of the existing widget path. Its design needs an independently demonstrated output control, a marker before the owner/controller/UI gates, branch outcomes including AddToPlayerScreen, and a lifetime marker. An extra widget downstream of the same silent gates would leave the same ambiguity. No reliable independent shipping entry/output route has yet been established, so no new node, shipping Print String solution, startup override, manual factory call, loader or injection is prescribed here.

Any separate explicit-creation/readout-control experiment must be labeled separately from automatic initialization, use a supported route and a new reviewed package, and have its own bounded test/rollback plan. Preserve this package and evidence. Follow the [creation-only evidence sheet](../design/OBSERVER_CREATION_EVIDENCE_SHEET.md); runtime registry, actual instance count, intended owner, lifecycle and recording remain UNKNOWN or NOT_PERFORMED as applicable.

Only read-only game configuration/process/log/source inspection and project-local evidence/document writes were performed in this review. No game/editor control, settings changes, reinstall, factory invocation or new runtime attempt occurred.
