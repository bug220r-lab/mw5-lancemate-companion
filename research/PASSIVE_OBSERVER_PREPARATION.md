# Passive observer initialization and packaging investigation

**Subsequent result, 2026-09-21:** the approved [one-asset editor export succeeded](OBSERVER_CALLER_NATIVE_RESULT.md). The source confirms direct inheritance from `MW5PlayerController_C` but supplies no factory caller. The once-only helper action is complete; do not rerun it. The preparation/NOT_PERFORMED statements below describe the earlier static pass. Observer assets remain NOT_BUILT and game integration remains untested.

Reviewed **2026-09-21 UTC**. **PARTIAL: packaging route documented; runtime initialization UNKNOWN/BLOCKED; observer assets NOT_BUILT.** This continues the overnight handoff's next bounded task. It does not claim completion of the requested component/widget package.

## Result

The official Mod Manager provides a content-mod creation and packaging route, and the collected current-editor declarations expose its packaging operation. Neither that route nor the installed template establishes a caller that creates the proposed observer. The controller factory remains a candidate, not a verified registration contract. Creating a data asset or filling in a mod descriptor would not close this gap.

Three focused reviews support this conclusion:

- [Official PGI route and version limits](PASSIVE_OBSERVER_OFFICIAL_PATH.md).
- [Collected component-factory and lifecycle trace](PASSIVE_OBSERVER_FACTORY_TRACE.md).
- [Current-editor packaging declarations](PASSIVE_OBSERVER_PACKAGING_CONTRACT.md).

The new [local snapshot](PASSIVE_OBSERVER_LOCAL_SNAPSHOT.json) contains actual named-file hashes, template inventory, configuration excerpts and installation identities. The [preparation ledger](PASSIVE_OBSERVER_PREPARATION.json) explicitly separates these existing evidence artifacts from the absent observer package. It is not an installation manifest.

## Current local evidence

**OBSERVED, 2026-09-21T04:22:17Z:** Epic's completed manifest still identifies editor **1.1.390.0e** at `C:\Program Files\Epic Games\MechWarrior5Editor`; its engine metadata is **4.26.2 / compatible CL14830424**. Retail `game_info.xml` still identifies **1.14.390 / CL456620**, and Steam metadata records build **24241637**. These are metadata observations, not compatibility results.

The installed `MW5Mercs\Content\ModTemplates\BaseTemplate` contains exactly these three files in the inspected template tree:

| Actual template file | OBSERVED contents / limit |
|---|---|
| `Config\Input\PLUGIN_NAMEInput.ini` | Input-settings section and commented examples. No active probe binding or startup instruction. |
| `Config\Tags\PLUGIN_NAMETags.ini` | Gameplay-tag section. No component registration. |
| `Resources\Icon128.png` | Icon; not an executable entry point. |

`DefaultEngine.ini:31-34` selects native `MWAssetManager`. `DefaultGame.ini:63-147` contains asset-manager scanning configuration and excludes `/ModOverride/` at line143. No explicit `PlayerControllerComponent` or mod-startup entry was found in the two inspected config files. This does not rule out native or Blueprint logic elsewhere and does not justify adding arbitrary scan rules.

The editor's `Mods\modlist.json` has an empty status map and an old **1.14.70** version string. Retail's corresponding file has an empty status map and **1.14.390**. The old editor modlist value is not the editor package version; neither file certifies the in-game enabled-mod screen. They were left unchanged. DLC entitlement and actual enabled mods remain UNKNOWN.

Free space was **7,073,288,192 bytes (about 6.59 GiB)**. The cook's incremental, intermediate, cache and peak-space requirements are UNKNOWN. No cleanup was attempted, and this observation is not a sufficient-space verdict.

## Supported packaging route and its limits

**DOCUMENTED:** [PGI's v2.3 guide](https://static.mw5mercs.com/docs/MW5Mercs_Mod_Editor_Guide_(v2.3).pdf), PDF pp.8-12 and16, describes creating/selecting a mod, placing new assets in its content, Manage Mod / Package Mod, selecting output, and later copying the complete generated folder into retail Mods. The guide is historical; the [official-source review](PASSIVE_OBSERVER_OFFICIAL_PATH.md) records its access date and current-version limits.

**OBSERVED declarations:** the collected editor reference declares `MWModEditorWidget.package_mod(args)` and `ModPackageArgs`. A future first local cook should use local folder output, publication disabled and staging reuse disabled; actual UI settings must be verified before invocation. `package_mod` returns no declared success receipt. Its return cannot substitute for completed output, logs, package membership and hashes. Preserve the editor-generated descriptor instead of guessing JSON fields from Python property names or the old guide.

**UNKNOWN/BLOCKED:** an official observer-specific initialization contract, its registry inclusion after cooking, and its supported widget creation/lifetime. PGI's September2026 preview announces future mod-loading/cooking changes; they cannot be credited to the installed build.

## Why actual assets are not ready

The factory queries assets of `PlayerControllerComponentDataAsset_C`, loads/casts the instances and conditionally adds the configured component class. The collected base data-asset Blueprint defines a type; it is not a configured registration instance. Its defaults are `ActorComponent=None` and `bAddAtRuntime=False`. The base component is not ticking or autoactivating by default.

No connected caller was found among the 244 collected source exports. This is a bounded negative result, not proof that no caller exists. The factory clears its class list on each invocation, so its duplicate check does not guarantee repeat-call safety. It adds a component to `self` but enumerates local-controller components for configuration and passes stored pawn values; the caller's owner and initialization order matter. Existing possession callbacks also do not prove complete null-pawn invalidation. Exact ranges and hashes are in the [factory trace](PASSIVE_OBSERVER_FACTORY_TRACE.md).

Consequently, a speculative controller replacement, repeated factory call, invented mod-root actor or handwritten descriptor would not be a supported implementation. No such artifact was created.

## Concrete next source action

The smallest next action is a **single-asset source export**, described in [the bounded worksheet](../design/PASSIVE_OBSERVER_SOURCE_LOOKUP.md). The installed `/Game/Modes/InstantAction/InstantActionPlayerController` was outside the overnight collection. Its newly verified [53,635-byte asset/hash](PASSIVE_OBSERVER_CALLER_ASSET.json) matches the prior observation, but its inheritance and initialization body remain uncollected. [Inspect-ObserverCaller.py](../scripts/Inspect-ObserverCaller.py) prepares only that export for a later authorized editor session; it has not been run against the editor. The asset may be a menu controller or unrelated to the factory; its name does not establish a mission role.

Review its actual parent, initialization and any factory call first. If that still leaves the caller unresolved, use the editor's reference-search facility on the already exported `MW5PlayerController.AddPlayerControllerComponents`, recording search/index scope. Export only a newly identified caller needed to answer this question; do not rerun the 249-entry collector.

If the lookup yields no attributable caller, retain UNKNOWN. A later creation-only experiment must independently verify that its data-asset instance was cooked and is registry-visible before interpreting a missing component. Such an experiment is a separate approval and evidence gate, not an automatic next step in this source lookup.

The project [operating rules](../AGENTS.md) say the overnight authorization "does not include editor/game execution"; [the continuation prompt](../NEXT_CODEX_PROMPT.md) likewise confines it to research/preparation. No editor action was executed in this pass. The one-asset helper is the concrete next action for new authorization, before asset authoring or cooking.

## Build and deployment readiness

| Required item | Actual status / next evidence |
|---|---|
| Proposed names | `LanceObserverProbe`; component, optional registration instance and diagnostic widget remain project proposals. |
| Source component/widget/data asset | NOT_BUILT; no `.uasset` placeholder or fabricated hash. |
| Source consumer / startup | UNKNOWN/BLOCKED by missing caller and lifecycle proof. |
| Cooked packages / membership / dependency closure | NOT_BUILT; package hash and package size are null in the ledger. |
| Mod descriptor | NOT_GENERATED; retain real editor output after an authorized build. |
| Dependencies | Candidate game-owned controller/component/UMG references require actual generated-reference and cooked-package inspection; no extra mod, DLL or loader selected. Evidence-input hashes are not dependency-closure proof. |
| Local packaging destination | PROPOSED `artifacts\LanceObserverProbe\` under this project; not created. Actual output layout must be recorded. |
| Retail destination | PROPOSED `C:\Program Files (x86)\Steam\steamapps\common\MechWarrior 5 Mercenaries\MW5Mercs\Mods\LanceObserverProbe`; absent at snapshot time. |
| Enabled-mod change | NOT_PREPARED / NOT_APPLIED. Future exact generated mod ID and before/after config must be captured without changing unrelated entries. |
| Disk requirement | UNKNOWN until real package/staging measurements; current free-space observation retained. |
| Removal / restore manifest | No installed files to remove. Future manifest must enumerate actual added files and exact backed-up configuration, with hashes; no recursive guessed-directory cleanup. |
| Editor/game tests, native reads, commands and performance | NOT_PERFORMED in this pass. |

The existing [passive Instant Action protocol](../design/PASSIVE_OBSERVER_HANDOFF.md) remains the later behavior gate: baseline, one observed AI, an unaffected sentinel, human orders/pause/mech swaps/mission restart, sample age and duplicate count, measured frame-time/sample gaps, then manifest-driven rollback. It is not executable yet. Native order control, three-member autonomy and direct piloting remain later milestones.

## Validation

This pass refreshed and hashed twelve named local metadata/template files plus the one candidate asset, inspected the collected text declarations and factory sources, and checked primary PGI documentation. Independent review of the new helper caught and corrected uppercase exporter-format matching. Its [29 fake-API cases](PASSIVE_OBSERVER_HELPER_REVIEW.json) pass under Codex Python3.12.14. The helper also passes a syntax-only check under the editor's standalone Python3.7.7; fake behavior under3.7 and actual native execution remain NOT_PERFORMED. Tests cover wrong source/identity, failed/oversized exports, mutation and resource/concurrency stops, not gameplay.

New research artifact links, JSON structure and evidence hashes are checked in [the preparation receipt](PASSIVE_OBSERVER_PREPARATION_VALIDATION.json). The unchanged tactical tests were not rerun. No runtime capability or gameplay acceptance is inferred from static document checks.
