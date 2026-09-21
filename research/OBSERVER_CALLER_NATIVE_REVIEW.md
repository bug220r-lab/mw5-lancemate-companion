# Independent review of the single-asset native export

Reviewed **2026-09-21 UTC**. **OBSERVED: native source/default export verified. UNKNOWN/BLOCKED: observer startup caller.** The approved user-assisted run exported the exact `InstantActionPlayerController` candidate. Its actual parent is `MW5PlayerController_C`; the new source contains no `AddPlayerControllerComponents` call. This closes the one-candidate source gap without establishing automatic observer registration or a shipping-game result.

## Evidence identity and verification

`RUN` means [observer-caller-20260921T044217Z-54302cc3f1af](evidence/editor-source/observer-caller-20260921T044217Z-54302cc3f1af/), a **direct child** of `research/evidence/editor-source`. It is separate from the `observer-caller-helper-review*` fixture trees. All source/default ranges below are one-based and refer to unchanged raw exports.

The [native receipt](evidence/editor-source/observer-caller-20260921T044217Z-54302cc3f1af/report.json), lines **2-27**, records `COLLECTED_REQUIRES_REVIEW`, `EDITOR_SOURCE_INSPECTION_ONLY`, two true exporter returns, no exporter errors and no collection errors. Its conservative `native_execution` field remains `ATTEMPTED`; this review establishes the presence, identity, size and content of both resulting native text exports. The run identifier records **2026-09-21T04:42:17Z**, and the report file's creation/write timestamp is **2026-09-21T04:42:18.3353169Z**. The helper reports **1.25 seconds** elapsed (**38**).

Independently reread SHA256 values on this review date:

| File | Bytes | SHA256 |
|---|---:|---|
| RUN/source.COPY | 83,932 | `6690E8C5A192D28CC15F84798C6E053FE3F543728F7AECEE0F2CE81968C6A0FD` |
| RUN/defaults.COPY | 9,087 | `FA10C21C165E2AB68A2D7C841C413909FC3FF04B58097D1A15B710C2CBEDF7C0` |
| RUN/report.json | 2,995 | `F3A8D60C904C6375F6E413F439D854957A951D583B4CD5DDAAB49BA0C35B5543` |
| scripts/Inspect-ObserverCaller.py | 14,058 | `B99B1B05375BE98AF1160C9C2CCB3474AF80EB97AA673EA492130D83386D0FA0` |
| Installed InstantActionPlayerController.uasset | 53,635 | `7107745A8DE461275A7ACFA1F3FFC5BE9BCB7002682C37B7705AF5F00783E4F6` |

The source/default sizes and hashes match the native receipt. The helper hash matches [the static preparation receipt](PASSIVE_OBSERVER_PREPARATION_VALIDATION.json); the installed asset hash matches [the prior candidate pin](PASSIVE_OBSERVER_CALLER_ASSET.json) and the native receipt. The receipt records `source_unchanged_after=true` (**55**); the independent post-export installed-file hash agrees. Raw evidence and original receipts were not modified.

The exact loaded Blueprint path is `/Game/Modes/InstantAction/InstantActionPlayerController.InstantActionPlayerController` (**report:7,46**). Its class and default object are respectively `/Game/Modes/InstantAction/InstantActionPlayerController.InstantActionPlayerController_C` and `/Game/Modes/InstantAction/InstantActionPlayerController.Default__InstantActionPlayerController_C` (**53-54**). The source begins with the named Blueprint (**source:1**); the defaults begin with the matching generated class/default name (**defaults:1**). `already_loaded=false` (**report:45**) records the helper's initial lookup result, not a claim about which dependencies Unreal loaded.

Applicable version context is the earlier same-session [local snapshot](PASSIVE_OBSERVER_LOCAL_SNAPSHOT.json): editor **1.1.390.0e / UE4.26.2 / compatible CL14830424**, observed **2026-09-21T04:22:17Z**. This reviewer refreshed the pinned asset and helper hashes, not the editor installation metadata. Retail metadata **1.14.390 / CL456620 / Steam build24241637** is background provenance only; no retail compatibility result follows.

## Actual parent and connected initialization

The entire **468-line source** and **235-line defaults** were inspected, including the extra serialized graphs and class properties.

**OBSERVED parent:** [source.COPY](evidence/editor-source/observer-caller-20260921T044217Z-54302cc3f1af/source.COPY), **421**, declares `/Game/Objects/_common/MW5PlayerController.MW5PlayerController_C` directly. It does not declare `MW5PlayerControllerDerived` as the parent. The helper's parent metadata agrees (**report:47-51**).

**OBSERVED construction edge:** `UserConstructionScript` (**source:109-128**) links its entry output (**113**) to the parent `MW5PlayerController.UserConstructionScript` call (**115-119**). The parent-call continuation pin (**120**) has no `LinkedTo`. The graph lists only those two nodes (**124-125**). There is no additional child initialization on this visible execution chain.

The already collected parent [010-MW5PlayerController-source.COPY](evidence/editor-source/ai-research-collection-20260921T030437Z-f7d8e930/010-MW5PlayerController-source.COPY), **7402-7412**, has only the construction function entry; its `then` pin (**7406**) is unlinked. Its hash was independently rechecked as `6FAAA7CF5D925123441F8022BDA01D7B3475C71849FFF94758E7D2C6BAA4B530`. Thus this specific child-to-parent construction path supplies no factory invocation. It does not exclude inherited event behavior or unresolved native code.

**OBSERVED event scope:** the child's `EventGraph` body (**82-108**) contains two `bShowPostMission` variable-set objects. Both execution inputs and outputs lack `LinkedTo` (**88-89,99-100**). No child BeginPlay/`ReceiveBeginPlay` event is present. `ExecuteUbergraph_InstantActionPlayerController` (**247-250**) contains schema/GUID metadata only in this export. These are source observations, not evidence that the instantiated controller has no inherited lifecycle behavior.

`EdGraph_0` (**251-272**) repeats the construction entry/parent-call links and shares its graph GUID (**127,271**). `EdGraph_1` (**273-420**) shares the post-mission graph GUID (**237,419**) and exposes an expanded validity branch. Neither appears in the two-element `FunctionGraphs` list (**425-426**). Their presence does not establish a second startup path or a second runtime execution; this review does not infer the exporter's internal graph-generation mechanism.

## Other connected behavior and class defaults

The other listed function is `CheckAndShowPostMissionScreen` (**source:129-238,426**):

1. Entry calls the parent's same-named function (**130-151**). The parent's `bShown` return drives a branch (**153-160**). True returns `bShown=true` (**136-142**).
2. False calls `GetUIScreensComponent`/`ShowInstantActionScreen` (**169-188**), then evaluates the existing `CrossplayInviteOverlay` reference (**189-200**).
3. A valid overlay receives `SetUsePauseScreen(true)` (**201-210**); an invalid overlay follows the two reroutes (**211-224**). Both reach the `bShown=false` result (**161-168**). The function-entry `InPersistentModel` pin (**134**) and parent-call input (**150**) are unlinked in this export; no data forwarding is inferred.

The additional `EdGraph_1` serialization has the corresponding explicit `IsValid` node and branch (**380-406**), with calls to the same UI functions (**318-338,353-363**). It also has no factory call. This is observed post-mission/UI logic; it does **not** establish that the class is exclusively a menu controller or identify the game mode that instantiates it during a mission.

[defaults.COPY](evidence/editor-source/observer-caller-20260921T044217Z-54302cc3f1af/defaults.COPY), **2-25**, lists inherited TransformComponent0, RemoteControl, PlayerTargetVisibilityComponent, MissionLifecycleComponent, KeyRemappingSystem and AimAssistComponent subobjects. Other relevant defaults are:

| Range | OBSERVED default | Limit |
|---|---|---|
| 26-28,35-39 | Named switch-mech/airstrike/feedback references and current-mech/controller references are `None`. | Class defaults do not enumerate components added to a live actor. |
| 67-68 | `InNewPawn=None`, `InOldPawn=None`. | No freshness or assignment order is established. |
| 70,76 | `CrossplayInviteOverlay=None`; `UIScreensComponentClass` points to `InstantActionUIScreensComponent_C`. | The UI class reference is not an observer entry point or proof of mission controller selection. |
| 95,119-123,151-157 | Squad, Player, acknowledged/current pawn, player state and spectator references are unset; `bIsLocalPlayerController=False`. | These defaults are not runtime identity, locality or authority observations. |
| 162,175,186,197 | Actor tick can run and ticks when paused; tick-before-BeginPlay is allowed; `bReplicates=False`; `Role=ROLE_Authority`. | These defaults do not prove the passive component exists, samples safely, or has live authority. |

## Factory result and remaining boundary

**OBSERVED bounded negative:** `AddPlayerControllerComponents`, `ControllerConfigured`, `PlayerControllerComponentDataAsset`, `GetAssetsByClass` and `PlayerControllerClass` do not occur in this child's source/default pair. `InNewPawn`/`InOldPawn` occur only as the null defaults above. There is no connected factory call or registration scan in this new export. This extends the earlier [factory trace](PASSIVE_OBSERVER_FACTORY_TRACE.md) by exactly one candidate; it is not a complete project-wide reverse-reference search.

**UNKNOWN/BLOCKED:** the actual caller of the parent factory, registry visibility/timing for a newly cooked registration instance, active mission controller assignment, successful single-instance creation, owner/world identity, pawn initialization order, and teardown behavior. The parent construction path is closed as a lead; other inherited events and native implementation boundaries retain their prior limits. No caller, registration instance or shipping entry point should be fabricated from this result.

The smallest proposed follow-up remains the [worksheet's bounded reference lookup](../design/PASSIVE_OBSERVER_SOURCE_LOOKUP.md) on the already exported `MW5PlayerController.AddPlayerControllerComponents`, recording the indexed search scope and attributable call sites. That lookup is **NOT_PERFORMED** in this review. The approved helper does not need another run.

## Scope and validation limits

This review performed local text inspection and file hashing only. It did not operate the editor, run another export, load another asset, modify evidence, or rerun mock/tactical tests. The helper's native run explicitly excludes save, explicit compile, Play, cook, install, live commands and paid APIs (**report:29-35**); its native loads/exports may implicitly load dependencies and regenerate normal editor data. Matching disk hashes cannot exclude unsaved in-memory asset changes.

No Find References index, dependency traversal, registry scan or API snapshot was collected. The exports do not establish compiled bytecode execution, actual native callback timing or retail behavior. **Observer authoring/build/deployment and gameplay remain NOT_PERFORMED; observer assets remain NOT_BUILT.** The completed result is the reviewed one-asset source export.
