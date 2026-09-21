# AI assignment and tactic selection trace

Date: 2026-09-20 local / 2026-09-21 UTC. **OBSERVED source evidence; gameplay NOT_PERFORMED.** This is an offline trace of the completed, audited `ai-research-collection-20260921T030437Z-f7d8e930` collection, from MW5 editor 1.1.390.0e / UE4.26.2. It does not establish which controller, tree, config or tactic a particular shipping-game actor currently uses.

We can now explain the connected Blueprint that chooses combat tactics, plus encounter behavior selection and pilot-config construction. Final lancemate root/config assignment still crosses native boundaries.

## Evidence index and interpretation

Line numbers are one-based. Arrows describe serialized pins, not observed calls. `OBSERVED` means inspected graphs/values; `DOCUMENTED` means generated API declarations, whose placeholder returns are not implementation; `PROPOSED` means interpretation/future test; `UNKNOWN` means missing source/runtime evidence.

| Alias | Source |
|---|---|
| Controller | [009-MechAIController-source.COPY](evidence/editor-source/ai-research-collection-20260921T030437Z-f7d8e930/009-MechAIController-source.COPY) and [defaults](evidence/editor-source/ai-research-collection-20260921T030437Z-f7d8e930/009-MechAIController-defaults.COPY) |
| Tactic | [055-BTService_PickCombatTactic-source.COPY](evidence/editor-source/ai-research-collection-20260921T030437Z-f7d8e930/055-BTService_PickCombatTactic-source.COPY) and [defaults](evidence/editor-source/ai-research-collection-20260921T030437Z-f7d8e930/055-BTService_PickCombatTactic-defaults.COPY) |
| Combat | [057-BT_MechCombat-source.COPY](evidence/editor-source/ai-research-collection-20260921T030437Z-f7d8e930/057-BT_MechCombat-source.COPY) |
| Encounter | [229-EncounterClassParent-source.COPY](evidence/editor-source/ai-research-collection-20260921T030437Z-f7d8e930/229-EncounterClassParent-source.COPY) |
| Encounter behavior | [226-EncounterBehaviorComponent-source.COPY](evidence/editor-source/ai-research-collection-20260921T030437Z-f7d8e930/226-EncounterBehaviorComponent-source.COPY) |
| Encounter types | [224-BehaviorTypes-source.COPY](evidence/editor-source/ai-research-collection-20260921T030437Z-f7d8e930/224-BehaviorTypes-source.COPY) |
| Pilot | [208-PilotSkillGrowth-source.COPY](evidence/editor-source/ai-research-collection-20260921T030437Z-f7d8e930/208-PilotSkillGrowth-source.COPY) |
| API | [unreal-api-reference.txt](evidence/editor-source/ai-research-collection-20260921T030437Z-f7d8e930/unreal-api-reference.txt) |

See [verified collection provenance](AI_COLLECTION_RESULT_2026-09-20.md). Report SHA256: `f5dbc2eeacbb81c0ea3e331651dfd40946b347fc219869246c48b9b853bc5eea`. Serialized `ErrorType` fields are not measured compile failures; node presence alone is not reachability.

## Controller and root-tree assignment

**OBSERVED:** Controller source lines10-25 has an empty EventGraph and a construction-script entry with no outgoing execution link. Line28 identifies native parent `MWMechAIController`. Therefore this particular Blueprint does not contain the missing native initialization algorithm.

**OBSERVED:** Controller defaults lines59-85 serialize `CombatTactic=None`, `PrimaryCombatTactic=None`, `DefaultBehaviorTree=BT_MechMasterTree`, an empty `BehaviourConfig.AIBehaviourConfigAsset.Id`, and `bStartAILogicOnPossess=False`. These are class defaults, not an enemy-only classification, a statement that a spawned unit has no config, or a guarantee that its default root is active.

**OBSERVED:** the ally job defaults explicitly name a required tree:

| Job default export | Property |
|---|---|
| `004-Ally_FollowJob-defaults.COPY`, line14 | `RequiredBehaviorTree=BT_AllyMechMasterTree` |
| `032-Ally_GoToLocationJob-defaults.COPY`, line12 | `RequiredBehaviorTree=BT_AllyMechMasterTree` |
| `033-Ally_TargetAttackJob-defaults.COPY`, line11 | `RequiredBehaviorTree=BT_AllyMechMasterTree` |

**DOCUMENTED:** API lines334724-334757 declare native `MWJob.required_behavior_tree`. They do not describe when or how that property replaces a running controller tree. **UNKNOWN:** which native worker/job operation consumes it, restoration after job completion, and whether a particular AI is already on that tree. Do not combine the general and ally roots into a single live pipeline without resolving that transition.

The general and ally roots both reference the common combat subtree, as established in [the first findings](AI_EXPANDED_SOURCE_FIRST_LOOK.md). **PROPOSED implication:** edits to common combat logic must be evaluated against all populations actually routed through it, not presumed lancemate-only.

## Connected combat tactic algorithm

**OBSERVED:** this decision code is present in Blueprint, not just in native declarations. Tactic `ReceiveTick` and `ReceiveActivation` both cast their `OwnerActor` to `MWAIController`, obtain its pawn and cast that to `MWMech`, then call `PickCombatTactic` with those two objects. The execution and data links are at Tactic lines253-394. Failed casts have no connected path to that call in these graphs.

Combat's runtime root is `BTComposite_Selector_1` (line535); its `Services(0)` references this tactic service (line383). The service instance serializes `Interval=1.25` and `RandomDeviation=0.25` at lines529-533. The service class defaults instead contain 0.5/0.1 at lines7-8: the tree instance values are the relevant recorded overrides here. None of these is a measured reaction time or a companion command frequency.

Tactic class defaults line3 contains `CloseRangeCombatThresholdInMeters=179`. No different threshold is serialized on the inspected Combat instance. The following is a transcription of connected branches in `PickCombatTactic`; it is not a reimplementation or gameplay validation:

| Ordered branch | Connected result and evidence |
|---|---|
| `CanFulfillPrimaryCombatRole(MyController, MyMech)` returns true | Set combat tactic to `MyController.PrimaryCombatTactic`. Function entry -> call -> branch at lines416-473; setter input at475-484; primary-property data link at753-760. |
| Otherwise, mech weight class equals `Light` | Set `HitAndRun`. Weight -> equality data links at501-509 and762-768; false-primary execution -> branch -> setter at511-529. |
| Otherwise, `OptimalRangeComponent.GetOptimalRange() > CloseRangeCombatThresholdInMeters * 100` | Evaluate `IsCombatCapableWithinRange(min=threshold, max=100000, bExcludeLRMs=true)`; true sets `Ranged`, false sets `Indirect`. Optimal-range data path427-445, comparison539-565 and791-800; capability path575-589 and770-788; setters605-632. |
| Otherwise, weight class is in `{Heavy, Assault}` | Set `Tank`; other weight classes on this path set `Mobile`. Membership649-677; execution branch679-686; setters688-715. |

The graph explicitly multiplies the threshold by 100; `GetOptimalRange()` units are undocumented in API299130-299138. **DOCUMENTED:** API295472-295503 says LRM capability requires an LRM with ammunition, while range capability asks whether any weapon deals damage in the specified range. Exact algorithms and boundary handling remain unknown.

The connected `CanFulfillPrimaryCombatRole` function first switches on `PrimaryCombatTactic`, using a sequence with a final false return if no branch reaches a true return (lines849-880 and1157-1181). The true paths are:

| Primary tactic | Conditions visible in connected graph |
|---|---|
| Mobile | `CombatTarget` passes the `IsValid` macro, `IsCombatCapableWithinRange(0, threshold, false)` returns true, and weight is `Light` or `Medium`. Lines890-967,1191-1202,1250-1273. |
| Tank | Capability in `(0, threshold, false)` and weight in `{Medium, Heavy, Assault}`. The target-validation macro's **both** `Is Valid` and `Is Not Valid` outputs feed the same capability branch; a valid target is not a gate here. Lines970-1048,1204-1215,1276-1300. |
| Indirect | `IsLRMCapable()` returns true. Lines1051-1074 and1111-1119. |
| Ranged | `IsCombatCapableWithinRange(threshold, 2000, false)` returns true. Lines1077-1108 and1217-1228. |
| HitAndRun | Weight is `Light` or `Medium`. Lines1121-1154 and1230-1248. |

**PROPOSED:** these branches may explain role changes after weapon loss and movement differences by loadout/weight. Neither these hypotheses nor the Tank validation asymmetry establish a gameplay bug. A tactical layer should respect existing role selection.

**UNKNOWN:** initial assignment of `PrimaryCombatTactic`. API lines377054-377065 declare `MWUnitCardAsset.get_primary_combat_tactic(unit_card) -> CombatTactic`, but the collected graph does not establish the caller that writes that result to a spawned controller. The service reads the primary tactic and sets the current tactic; it does not prove the provenance of the primary value.

## Behavior-config construction and interpretation

**OBSERVED:** Pilot's `GetAIBehaviourConfig` function is a direct connected data path:

```text
PilotSkills -> Break PilotSkillSet.DefaultAIBehaviourConfig
            -> Make MWAIBehaviourConfig.AIBehaviourConfigAsset
            -> ReturnValue
```

The execution link from function entry to result is at Pilot lines5562-5573. The struct links are at5575-5617. Other exposed struct inputs at5618-5623 are explicit zero/false defaults, including accuracy/lethality/DPS bonuses, boss/focus-commander flags and delay between shots. This proves what this Blueprint override returns when called. It does not prove which mission pilots call it, which `PilotSkillSet` they supply, or whether another stage subsequently overrides its result.

**DOCUMENTED:** native `MWGameMode` exposes `default_ai_behavior_config_asset` and `lancemate_behavior_config` at API326332-326348. `UnitCard` carries `ai_controller_override`, `ai_behaviour_config` and `combat_role` in its documented construction fields at API81824. These are concrete potential input paths, not a resolved precedence order.

**DOCUMENTED:** API298511-298526 supplies useful meanings for config fields: lethality determines critical versus non-critical component targeting; coordination influences focus fire; overheat willingness controls the composition of a shot-decision deck; accuracy is range-dependent. Thus the lancemate config's `LethalityPercent=0.8` from the first findings must not be described as an 80% kill chance. The formulas and selection/application lifecycle are still not present in the stub.

**UNKNOWN:** the active GameMode's configured values, which UnitCard overrides win, when config is applied to a spawned or repossessed controller, and how pilot-specific values interact with the default/lancemate config. Empty controller defaults cannot answer these questions.

## Encounter behavior is another layer

**OBSERVED:** `EncounterClassParent.SetBehaviorComponent` selects an encounter behavior component from a `BehaviorTypes` input. The entry, completion of a component loop, enum switch and selected constructors are connected at Encounter14641-14760. Each selected `InternalAddEncounterBehaviorComponent` result flows to local `BehaviorComp` and then the function's result at14654-14661 and14769-14846. The enum's display-name mapping is recorded at Encounter types line3.

| Encounter input | Selected component |
|---|---|
| Standard Garrison | `StandardGarrisonBehaviorComponent` (Encounter14486-14497) |
| Standard Blank Garrison | `StandardBlankGarrisonBehaviorComponent` (14512-14523) |
| Dispatch Waves, three modes | `DispatchWavesBehaviorComponent` with the connected `SetWaveType` calls (14499-14579) |
| Dispatch Reinforcements | `DispatchReinforcementsBehaviorComponent` (14603-14614) |
| Dispatch Units To Alert Another Garrison | `DispatchUnitsToAlertBehaviorComponent` (14616-14627) |
| Ambush | `AmbushBehaviorComponent` (14629-14639) |

The labels here are an encounter-level dispatch choice, not proof of each pawn's low-level BehaviorTree or allegiance. The incoming `Behavior` argument, rather than a hard-coded enemy/ally split, selects the branch.

**OBSERVED:** a connected spawn path passes a UnitCard into the deferred spawn queue. Encounter `SpawnUnit` entry -> local UnitCard assignment -> valid spawn-point branch -> its `Spawner.BehaviorTree` assignment -> `MW5_FunctionLibrary.AddUnitToSpawnQueue` is linked at16946-16958,17335-17355,17045-17052,17250-17258 and16833-16846. The BehaviorTree object input at17353 is unlinked and has no explicit asset default; it does not select either collected mech root. On the alternative valid UnitCardSpawnerComponent path, execution changes the UnitCard's `UnitType` before calling the queue helper (17035-17042,17112-17152,16787-16800).

The same graph also contains `SetUnitCard -> K2_Spawn` nodes at16813-16831, but the `SetUnitCard` execution input is unconnected in this export. That pair must not be promoted to the active entry-to-spawn path merely because the function names are present. **UNKNOWN:** the queue helper body was deliberately deferred by the collector, and native spawn/application logic is not supplied by API365344-365408.

**OBSERVED:** encounter initialization binds awareness and unit-lifecycle callbacks rather than visibly choosing a mech combat tactic. In Encounter behavior `Setup`, the function entry feeds a sequence at6201-6221. `then_2` enters `MWDebugBranch`: one output binds the unit-manager callbacks directly; the other obtains encounter units and passes the `HasEntries?` true output to the same binding node (6302-6323,6072-6088,6398-6405). `OnUnitSpawned` is bound first, followed by `OnUnitLeftPlay` (5859-5877), using the functions named in the delegate nodes6121-6158. Therefore the binding has a concrete path and conditions; it is not unconditional simply because it exists.

The `Setup` sequence's `then_3` path enumerates current encounter units, resolves each GUID through `GetUnitFromGuid`, checks actor and awareness-component validity, then binds `OnTargetAwarenessUpdated`, `OnTargetBecomesKnown` and `OnTargetForgotten` (5923-5960,6061-6070,6209,6294-6299,6326-6355,5879-5910). These bindings are sources to examine for what an encounter knows. They are not permission to expose omniscient hidden enemy state to a companion.

## What remains before live tactical decisions

| Missing question | Smallest source or later runtime evidence that would answer it |
|---|---|
| Which low-level tree is active after an ally job starts/ends? | Native consumer of `MWJob.RequiredBehaviorTree` and worker start/end path; later observe tree/job before and after one authorized isolated order. |
| Where do lancemate/enemy configs and primary tactics come from? | Active mission GameMode's actual defaults, the caller assigning `MWAIController.BehaviourConfig` / `PrimaryCombatTactic`, and UnitCard spawn/application precedence. |
| How does the active encounter spawn path reach native spawning? | The specific `MW5_FunctionLibrary.AddUnitToSpawnQueue` implementation and queue consumer, rather than every function in the large library. |
| What makes an AI combat-capable or determines optimal range? | Native implementations behind `MWAIController.IsCombatCapableWithinRange`, `IsLRMCapable` and `MWAIOptimalRangeComponent.GetOptimalRange`, or tightly controlled observations after the live gates are met. |
| Is the actor a current AI lancemate, friendly NPC or enemy? | Current squad/member/controller/pawn binding plus authoritative team attitude and possession state. A folder name, config name, encounter mode or class default is insufficient. |

**PROPOSED next work:** combine this with the order-lifecycle trace and define a passive tactical-state contract whose unknown fields prevent dispatch. Preserve native tactics; consider bounded squad decisions after identity, freshness, native acceptance and human supersession are demonstrated. No runtime implementation is claimed.

No game launch, native/editor call, source asset modification, runtime simulation, live order, AI optimization or model training was performed for this report.
