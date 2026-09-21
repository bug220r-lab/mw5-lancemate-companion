# First pass: exposed lancemate behavior structure

**OBSERVED source structure; runtime behavior NOT_PERFORMED.** Inspected on 2026-09-20 from the native editor collection `mod-research-collection-20260921T023909Z-5eeaf52a`, editor package **1.1.390.0e / UE4.26.2**. Scope is four exported texts, not all AI. No editor, game, script, simulation or optimization was run for this review.

Evidence directory: `research/evidence/editor-source/mod-research-collection-20260921T023909Z-5eeaf52a/`. In the references below, **T** = `12-BT_MechTeamOrders.COPY`, **F** = `13-BT_MechFollow.COPY`, **A** = `14-BT_AllyMechMasterTree.COPY`, **B** = `15-Blackboard_Mech.COPY`. Line numbers refer to those immutable exported texts. Collection fingerprints are in the adjacent `report.json`.

## Runtime object links, rather than editor layout

The map follows each asset's `RootNode`, then serialized `Children`, `Decorators`, `Services` and `BehaviorAsset` references. Editor `BehaviorTreeGraphNode` positions and pins are not the basis for execution claims. Array order below is the serialized selector order; actual branch outcomes depend on conditions, task results and engine behavior.

**Team orders:** root `BTComposite_Selector_0` (T:482), with an attached infinite root loop (T:438-440,486). Children are:

1. `Wait` key set -> wait task configured **1.0** (T:344,364-369,467-470).
2. `MissionOrders == Stop` (serialized IntValue **5**) -> `BT_HoldPosition` reference (T:345,423-429,452-455).
3. `MissionOrders == Move` (**4**) and `TravelLocation` set -> a nested selector. Its first child requires `HasArrivedAtOrderedLocation` not set and `IsMovingWithHoldFire` set, then references `BT_MechGoDirectlyToLocation`; fallback references `BT_MechGoToLocation` (T:346,352-356,379-393,409-421,457-465).
4. `MissionOrders == Attack` (**1**) and `TargetActor` set -> `BTTask_SetCombatTarget_C` using `TargetActor`, then `BT_MechCombat` (T:347,358-362,371-377,403-407,442-445,477-480).
5. `MissionOrders == Follow` (**2**) and `FormationTravelActor` set -> the exported `BT_MechFollow` (T:348,395-401,431-436,447-450).
6. Fallback wait configured **1.0** (T:349,472-475).

Several order decorators explicitly set `FlowAbortMode=Both` (T:375,399,413,427,434). That is visible branch-interruption configuration, not proof of correct human override, accepted orders or current actor authority.

**Follow:** root `BTComposite_Selector_1` (F:594) has these children and a service (F:397-403):

1. `NeedsNavMeshRecovery` set, with `FlowAbortMode=LowerPriority` -> `BT_NavMeshCheckRecovery` reference (F:398,432-437,532-535).
2. `BTDecorator_CombatTargetInteraction_C` configured `FireAt` / `FlowAbortMode=Both`, plus `FormationTravelActor` set -> `BT_MechFightWhileFollowing` reference (F:399,418-423,537-540,576-580).
3. Movement selector (F:400,391-395): prefer the formation selector when both `FormationTravelActor` and `FacingDirection` are set (F:392,439-451); otherwise a `TravelActor` MoveTo has a set-key guard, `MarkStuckOnFail` and an outside-range decorator (F:393,425-430,493-505,564-566,588-592).
4. Root service `MWBTService_PickCombatTarget` reads the `TargetSelectionStrategy` key and explicitly configures **Interval=1.5**, **RandomDeviation=0.5**, **bRestartTimerOnEachActivation=False** (F:401,568-574). These are serialized scheduling settings, not measured reaction latency or proof of a target-scoring algorithm.

The formation selector has four linked children (F:404-410):

- A sequence gated by native `MWBTDecorator_IsBBEntrySame`, using `FormationTravelActorLocation` and **AcceptableTolerance=1.0**: MoveTo formation actor with **AcceptableRadius=1000**, then wait **0.75**, **RandomDeviation=0.25** (F:405,412-416,468-480,542-546,553-558). What values the native decorator compares remains unknown.
- MoveTo formation actor with **AcceptableRadius=10**, guarded by inverse `IsAtLocation` with **AcceptableRadius=500** (F:406,453-462,482-491).
- MoveTo formation actor with **AcceptableRadius=5000**, guarded by `MarkStuckOnFail` and an outside-range decorator configured **Distance=5000** (F:407,507-519,560-562,582-586).
- Fallback wait configured **1.0** (F:408,548-551).

The fallback MoveTo `TravelActor` likewise configures **AcceptableRadius=5000** and its outside-range decorator configures **Distance=5000** (F:498-503,588-591). Explicit radius-inclusion flags are false on the 1000/5000 movement tasks (F:475-476,500-501,514-515). Distances are retained in serialized units; no measured gameplay-distance interpretation is claimed. Omitted inherited defaults cannot safely be read as zero or false.

**Separate ally master asset:** `BT_AllyMechMasterTree` root selector serializes Wait -> Guard/GoToLocation -> Attack/set combat target/Combat -> Follow -> 0.1 fallback wait; root services are `FeatherJumpJets` and `NavMeshRecoveryCheck` (A:225-239,241-285,287-305). This asset uses `Attack` and `Guard` blackboard checks rather than the TeamOrders enum conditions. These four files do **not** establish which root is selected for a current player lancemate, whether both are active in the same path, or whether one is an alternative/legacy route. They must not be drawn as one invented sequential pipeline.

## What the map can and cannot explain

Five concrete areas are now inspectable: order routing and interruption configuration; move-with-hold-fire routing; navigation recovery priority; fighting versus formation movement while following; and several formation distance/wait/target-service settings. None is a confirmed defect, and simply decreasing a number would not establish an improvement.

`Blackboard_Mech` contributes ten local keys, including `TravelActor`, `IntermediateTravelLocation`, `Wait`, `Throttle`, `RequiredToGetToFormation` and `IsLanceMember` (B:45-54). Its parent is **`/Game/AI/_common/MWUnitBlackboard`** (B:44), whose contents are absent from this batch. These are declarations, not recorded AI thoughts or current values; fields used by the trees but missing locally may be inherited.

| Evidence boundary | Exact examples |
|---|---|
| Exported tree structure | TeamOrders -> Follow and Follow's linked selectors/tasks above; all three trees reference Blackboard_Mech (T:485; F:597; A:305). |
| Native node instances, implementation absent | `/Script/MechWarrior.MWBTService_PickCombatTarget`, `MWBTDecorator_IsBBEntrySame`, `MWBTDecorator_MarkStuckOnFail` (F:132-138); `MWBTService_FeatherJumpJets` and `MWBTService_NavMeshRecoveryCheck` (A:60-62). Instance parameters do not reveal their algorithms. `/Script/AIModule` movement/selector implementations are also not exported here. |
| Referenced Blueprint classes, body absent here | `/Game/AI/_common/Tasks/BTTask_SetCombatTarget` (T:102; A:64); `BTDecorator_CombatTargetInteraction` and `BTDecorator_OutsideRangeFromActor` (F:140-144). Exported instances show overrides, not full class functions. |
| Referenced subtrees absent | Combat, HoldPosition, GoDirectlyToLocation and GoToLocation (T:443,453,458,463); NavMeshCheckRecovery and MechFightWhileFollowing (F:533,538). |

The follow export also contains `RotateToFaceBBEntry_1` with precision **5.0** (F:521-531), but no linked runtime child points to it in F:391-416. A `TimeLimit_0` object has a parent reference (F:464-467), but does not appear in those runtime decorator lists. Do not describe either as running just because it appears among serialized/editor objects. This is why dependency inventories alone cannot fully map behavior.

## Two proposed optimization experiments

**PROPOSED H1 — reduce formation corrections while preserving responsiveness.** After resolving the active tree, missing decorator logic, target updates and inherited defaults, compare baseline with one controlled change to formation arrival/stop tolerance or explicit hysteresis. Measure stop/start transitions per minute, travel-direction reversals, time spent outside the intended formation, collision/blocking events, and time to obey a new human command. Run identical open-terrain and obstructed routes, first with one AI and then all three, with fixed mech/loadout/pilot conditions. The unusual-looking 500 guard versus 10 MoveTo radius is a question to explain, not a demonstrated bug. No modification or run performed.

**PROPOSED H2 — reduce target thrashing without creating slow reactions.** After the native selection contract and missing combat subtree are understood, compare baseline against a bounded target-retention rule or a single service-cadence adjustment. Measure target changes per minute, time until firing at a newly valid threat, damage to ordered targets, incoming damage, order-to-action latency and frame time. Include a destroyed/lost target and a new manual attack order so retention cannot conceal stale target behavior. The exported 1.5/0.5 timing settings provide a specific investigation point; they do not prove thrashing or justify a faster service. No modification or run performed.

Source mapping can identify these candidate experiments and generate a decision-level model. Such a model would be **MOCK_ONLY** until compared against an instrumented, isolated in-game baseline; it cannot reproduce unavailable perception, weapon, navigation, physics or native AI code simply by reading these four files.
