# Minimal manual authoring recipe: one positive creation snapshot

Prepared **2026-09-23 UTC**. **PROPOSED manual Blueprint/UMG recipe; native authoring, compilation and execution NOT_PERFORMED.** This is the selected manual route after the [two-approach decision](../research/OBSERVER_AUTHORING_ROUTE_DECISION.md). It implements only an initial positive snapshot, not the requested mission recorder or full M0 lifecycle proof. All new asset/function/variable names below are project proposals, not existing MW5 interfaces.

The coordinator must confirm the authoring session, resources, destination and one asset owner before execution. This task has not launched the editor or authorized cooking/deployment. Use a newly created official mod content area; record its actual mount and paths instead of assuming a `/Game` replacement path. Do not change stock assets, use ModOverride, place a component manually, or call `AddPlayerControllerComponents` to make the test pass. If a required class, property or node cannot be selected, stop and record that exact blocker.

## Three assets and order

| Order | Proposed asset | Required type |
|---|---|---|
| 1 | `WBP_LanceObserverProbeReadout` | Widget Blueprint derived from `UserWidget` |
| 2 | `BP_LanceObserverProbeComponent` | Blueprint derived from the exact stock `PlayerControllerComponent_C` class below |
| 3 | `DA_LanceObserverProbeRegistration` | A new **data asset instance** of the exact stock `PlayerControllerComponentDataAsset_C`, not another Blueprint definition |

Component parent: `/Game/Objects/_common/Components/PlayerControllerComponents/PlayerControllerComponent.PlayerControllerComponent_C`.

Registration instance class: `/Game/Objects/_common/Components/PlayerControllerComponents/PlayerControllerComponentDataAsset.PlayerControllerComponentDataAsset_C`.

The official Mod Manager/content workflow is described in [PGI's guide v2.3](https://static.mw5mercs.com/docs/MW5Mercs_Mod_Editor_Guide_%28v2.3%29.pdf), “Creating a New Asset Mod” and “Manage Mod.” Exact installed UI choices and class eligibility must still be observed. Asset creation declarations support these types, but no assets or real mod mount exist from this recipe yet.

## 1. Build the readout first

In the actual new mod content folder, create a Widget Blueprint named `WBP_LanceObserverProbeReadout`. In its Designer, use a Canvas Panel containing one Text widget named `SnapshotText`; make that widget available as a graph variable. Put it in the upper-left area with enough width/height for several short lines. Use a readable built-in font and no buttons or other interactive controls.

Set the widget's focusable setting false. Its display visibility must be **hit-test-invisible for self and all children**, represented by `SlateVisibility.HIT_TEST_INVISIBLE` in the installed declarations (API:3866–3881). Do not select only-self exclusion while leaving children interactive. Do not add input events, cursor changes, focus changes or input-mode calls. Exact Designer labels must be checked in the installed editor.

Create a public, **impure** function named `SetSnapshot` with one input `InText` of type **Text**, no output. This is a new project function. Its complete execution graph is:

| Connection | Required value |
|---|---|
| `SetSnapshot` entry execution → TextBlock `SetText` execution | One direct execution link |
| `SnapshotText` variable getter → `SetText.Target` | The authored TextBlock |
| `InText` → `SetText.InText`/text input | Check actual displayed input name/type |

Use direct text assignment, with **no live text binding**. Compile this widget and save only its new package. Stop on warnings/errors relevant to missing variables, functions, types or graph connections. The generic visual-authoring operations are documented in Epic's [UMG quick start](https://dev.epicgames.com/documentation/en-us/unreal-engine/umg-ui-designer-quick-start-guide?application_version=4.27) and [Functions](https://dev.epicgames.com/documentation/unreal-engine/functions?application_version=4.27); these are adjacent stock 4.27 instructions, not a PGI 4.26.2 acceptance result.

## 2. Create the component subclass and variables

Create a Blueprint class in the same new mod content area, selecting the exact component parent above. Name it `BP_LanceObserverProbeComponent`. Verify the parent in Class Settings before editing. Do not substitute native `ActorComponent`; the existing factory enumerates the stock component base.

Create only these proposed variables, defaulting references to None and the array to empty:

| Variable | Type | Purpose |
|---|---|---|
| `SnapshotOwner` | Actor object reference | One captured result from component GetOwner |
| `SnapshotController` | Native MWPlayerController object reference | Successful owner cast |
| `SnapshotComponents` | ActorComponent object-reference array | One stored enumeration, including derived classes |
| `Readout` | WBP_LanceObserverProbeReadout object reference | Only this instance's widget |

Keep ticking disabled. Do not change activation, replication or input settings to force startup. The base defaults include `bCanEverTick=False`, `bAutoActivate=False`, `bReplicates=False`, `bIsEditorOnly=False`; record the new subclass's actual defaults rather than assuming inheritance has passed verification.

## 3. Connect a native BeginPlay snapshot

Add the native ActorComponent **Event BeginPlay** to the new child graph. Ensure it is enabled and execution-connected. Existing collected base/switch-component BeginPlay nodes are disabled; copying their appearance is not a working implementation. This first recipe does not override `ControllerConfigured`.

Connect execution in this order:

| Step | Execution/data wiring |
|---|---|
| A | BeginPlay → Set `SnapshotOwner`; value is **ActorComponent GetOwner with self as component target**. Do not choose Actor.GetOwner or a global local-controller lookup. |
| B | Set owner → validity Branch on stored `SnapshotOwner`; false stops. True → **Cast To MWPlayerController**; Object is stored `SnapshotOwner`. Successful cast → Set `SnapshotController` from the cast output. CastFailed stops this path. |
| C | Set controller → Branch whose condition is **IsLocalController** on stored `SnapshotController`. False stops this path. Local does not by itself prove intended mission identity or authority. |
| D | True → Set `SnapshotComponents`; value is **GetComponentsByClass** on stored `SnapshotOwner`, ComponentClass explicitly set to the new probe's compiled generated class. Save the result once. |
| E | Set array → **Create Widget**; Class is `WBP_LanceObserverProbeReadout`, OwningPlayer is stored `SnapshotController`. Store ReturnValue in `Readout`. |
| F | Set Readout → validity Branch for stored `Readout`; false stops. True → call the new widget's `SetSnapshot` with the text described below. |
| G | SetSnapshot → **AddToPlayerScreen** on stored `Readout`, ZOrder 0. Inspect its Boolean return. False → remove only this widget if valid, clear `Readout`, and stop. True finishes this one-time path. |

A null/pending-kill owner is an unknown/failure path, never a zero count. The owner validity check in step B is required. Do not add retries, delayed callbacks or unrelated screen APIs when this minimal path fails. Supply the captured controller to CreateWidget's OwningPlayer pin; do not leave player/world context implicit or replace it with player index zero. If the editor cannot resolve the component's world context or rejects this node, stop with the actual compiler message.

### Snapshot text without a live binding

Use **GetPathName** on self and stored `SnapshotOwner`, plus **Length** on stored `SnapshotComponents`. Do not re-run enumeration while formatting. GetComponentsByClass includes subclasses; label this as a class-family snapshot count, not a global or final count.

The smallest installed-declaration-backed formatting recipe uses chained two-input string concatenation (`StringLibrary.concat_str_str`, commonly displayed as Append), integer-to-string, and final string-to-text conversion. Each concatenation passes the previous result into A and the next piece into B:

1. `BEGINPLAY SNAPSHOT — NOT LIVE\nOwner: ` plus owner path.
2. Append `\nComponent: `, then self path.
3. Append `\nAttached class-family count at BeginPlay: `, then integer-to-string of the saved array's Length.
4. Append `\nRegistry, lifecycle and recording: NOT VERIFIED`.
5. Convert the final string to Text and pass it to `Readout.SetSnapshot.InText`.

Here `\n` means an actual line break in the authored text, not a requirement to use an unverified escape parser. The strings are proposed diagnostic wording. Object paths identify this snapshot's objects, not durable cross-session identities. Do not label the display PASS, LIVE or RECORDER READY. AddToPlayerScreen returning true is not independent proof that a human saw the readout.

## 4. Add only owned-widget cleanup

Add enabled native ActorComponent **Event EndPlay**. Its path checks this instance's `Readout`; if valid, call **RemoveFromParent** on that reference only. Clear `Readout` afterward; release the component's own stored owner/controller/array references as well. Do not enumerate/remove other widgets, destroy game components, or alter the owning controller. This cleanup is a proposed graph, not measured teardown proof. Missing EndPlay or disappearing UI remains unknown without independent evidence.

Compile the component and save only the new package. Confirm no stock package was dirtied, no unconnected disabled event was mistaken for a callback, and no new warnings/errors are being ignored. Do not press Play or cook as part of this authoring recipe.

## 5. Create the registration instance last

Use the editor's new Data Asset workflow and choose the exact existing registration class above. If that class is unavailable in the picker, record the class-selection failure; do not create another Blueprint definition or edit the stock CDO instead.

Name the new instance `DA_LanceObserverProbeRegistration`. Set its observed properties:

- **ActorComponent:** the new component's compiled generated class.
- **bAddAtRuntime:** true.

Read both values back and verify the actual object type. Save only the new instance package. These are the serialized source property names; if the installed property UI differs, verify the underlying property rather than assuming a similar label is equivalent. This instance still has no proven cooked inclusion or startup guarantee.

## Authoring completion and later proof

Return the actual mod/content mount, exact three asset/package paths, parent/class/default identities, recorded compile outcomes and final source asset hashes. The coordinator must review actual connected graphs/defaults through a separately bounded capture of these **new** artifacts; the four old lookup helpers remain completed and must not be reused or rerun. A concrete cook/install/removal manifest, disposable Instant Action baseline and deployment decision come later.

Even after successful authoring, the first display can prove only an attributable positive execution/component observation. Initial BeginPlay enumeration can precede later components; overlapping widgets can conceal duplicates. It cannot independently prove stable exactly-one count, registry discovery, final mission/controller identity, lifecycle or exported recording. No display is INCONCLUSIVE. The [creation-only contract](OBSERVER_CREATION_ONLY_PROBE.md) defines the stronger acceptance gates; the [observer-first goal](OBSERVER_FIRST_GOAL.md) additionally requires real passive capture and local export, owned separately by the coordinator.

## Installed evidence map

`API` refers to the pinned collected `unreal-api-reference.txt`; `RUN` refers to the existing `ai-research-collection-20260921T030437Z-f7d8e930` directory. Full paths/hashes are bound in the route checkpoint.

| Recipe operation | Installed evidence |
|---|---|
| Component BeginPlay / EndPlay / GetOwner | API 118707–118713 / 118693–118701 / 118755–118763 |
| Cast to native MWPlayerController; exact cast pins | RUN 240 source 4422–4433; API 357510 establishes PlayerController ancestry |
| IsLocalController → Branch | RUN 240 source 1422–1432; API 132924–132932 |
| Actual component enumeration / Length | RUN 010 source 1536–1545; API 117066–117079; RUN 008 source 1559–1567 |
| CreateWidget, OwningPlayer and stored typed return | RUN 010 source 3271–3280 / 4283–4292 |
| Object validity / full path | API 217557–217568 / 217961–217972 |
| Integer-to-string / concatenate / string-to-text | API 215785–215796 / 215879–215891 / 219789–219800 |
| TextBlock.SetText / AddToPlayerScreen / RemoveFromParent | API 158125–158134 / 139437–139449 / 138057–138063 |
| Focus/visibility | API 138360 / 3866–3881 |
| Registration class and properties/defaults | RUN 239 source 13,16–17; defaults 2–3 |

The separate official [Blueprint variables](https://dev.epicgames.com/documentation/en-us/unreal-engine/blueprint-variables?application_version=4.27) and [Array Nodes](https://dev.epicgames.com/documentation/unreal-engine/array-nodes?application_version=4.27) guides describe ordinary visual variable and Length operations. These support a manual recipe; they do not supply an unattended authoring API or establish installed-editor compilation.
