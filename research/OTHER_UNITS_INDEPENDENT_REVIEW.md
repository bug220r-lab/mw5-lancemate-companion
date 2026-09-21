# Independent spot review: vehicle trees, query tests and alert arithmetic

Reviewed 2026-09-21 by the movement-analysis worker, independently of the other-units report's author. Evidence is the preserved `ai-research-collection-20260921T030437Z-f7d8e930` collection for editor 1.1.390.0e / UE4.26.2. Scope is the specific high-risk source claims in [AI_OTHER_UNITS_ANALYSIS.md](AI_OTHER_UNITS_ANALYSIS.md), plus the movement synthesis in [AI_REPORT.md](AI_REPORT.md) and [AI_TECHNICAL_APPENDIX.md](AI_TECHNICAL_APPENDIX.md). No recollection or source editing, no native calls, no game/editor execution. Gameplay: **NOT_PERFORMED**.

**Result: the five requested other-unit claims pass the source spot check. One appendix asset-number correction was reported to the lead author.** This is independent confirmation of these claims, not another exhaustive review of the entire other-units population.

## Runtime roots rather than stored graph groups

**133, tank orders: confirmed.** RootNode selects `BTComposite_Selector_0` at line 472. Its only two children at lines 346–347 are RunBehavior_3 guarded by Blackboard_8, then Wait_0. Blackboard_8 checks MissionOrders against the Stop value; RunBehavior_3 points to TankHoldPosition. The other selector/sequence objects, Follow task and Attack/Move groups have no root Children edge reaching them. Their presence, editor wiring or stored ParentNode is insufficient to count them as executed. The report correctly limits the finding to this exported runtime tree and does not declare shipping commands broken. [133 source, lines 345–476](evidence/editor-source/ai-research-collection-20260921T030437Z-f7d8e930/133-BT_TankTeamOrders-source.COPY).

**149, VTOL orders: confirmed.** RootNode at line 456 likewise points to Selector_0, whose children at lines 335–337 are RunBehavior_3 guarded by Stop, RunBehavior_1 guarded by Follow, then Wait_0. These reference VTOLHoldPosition and VTOLFollow respectively. The second selector and Attack sequence are not reachable from these children. This differs from the tank root and was not mistakenly collapsed into the same behavior. [149 source, lines 334–460](evidence/editor-source/ai-research-collection-20260921T030437Z-f7d8e930/149-BT_VTOLTeamOrders-source.COPY).

## Long-range predicate

**127: confirmed short-circuit OR, with a controller precondition.** The registered PerformConditionCheckAI casts OwnerController to MWTankAIController. Cast failure returns false. On success, OnlyHasLRMs=true immediately returns true; its false branch casts ControlledPawn to MWTank and returns bFightFromLongRange, with pawn cast failure returning false. It is not `OnlyHasLRMs AND bFightFromLongRange`. More exactly, the required controller cast precedes both alternatives. [127 source, lines 35–143](evidence/editor-source/ai-research-collection-20260921T030437Z-f7d8e930/127-BTDecorator_TankShouldFightAtLongRange-source.COPY).

| Static input condition | Connected result |
|---|---|
| Controller cast fails | False |
| Controller valid, OnlyHasLRMs true | True without a required pawn cast on that branch |
| Controller valid, OnlyHasLRMs false, tank pawn valid | bFightFromLongRange |
| Controller valid, OnlyHasLRMs false, tank pawn cast fails | False |

These rows restate pin semantics; they are not gameplay tests or measurements of the native OnlyHasLRMs implementation.

## VTOL position-query semantics

**143: confirmed score-only tests.** The single active option lists four tests at lines 121–124. The two distance tests, visibility trace test and tether-shape test each explicitly serialize `TestPurpose=Score` (129, 135, 145 and 154). Thus neither the visibility comment nor the tether's range value establishes a mandatory filter. The generator configures six points, radius 25000 and a 60-degree arc centered on the combat target, oriented by its view-direction context. Elevation is bound to a native provider; default 8000 is not proof of the runtime elevation. [143 source, lines 102–161](evidence/editor-source/ai-research-collection-20260921T030437Z-f7d8e930/143-EQS_VTOLCircle-source.COPY).

Minor precision note for later edits: the report describes one distance term as “own 2D distance.” Its distance mode is serialized, but its DistanceTo context is omitted. Unless the base engine default is separately cited, “a 2D distance term” is the exact statement established by this asset alone. This does not change the verified score-only conclusion. Native context/provider/test implementations and the omitted scoring defaults remain unverified.

## Alert arithmetic

**226: confirmed reversed numeric direction.** Increase REDCON multiplies Increase By by -1, adds current REDCON, feeds that into Clamp with Min=1 and Max=Minimum REDCON, compares the result to current REDCON, and writes/calls REDCON Reaction only when different. Decrease REDCON instead adds Decrease By to current REDCON before the same clamp/comparison/write pattern. This supports the report's arithmetic distinction without interpreting the method name as numeric addition. [226 source, lines 2508–2646 and 3262–3411](evidence/editor-source/ai-research-collection-20260921T030437Z-f7d8e930/226-EncounterBehaviorComponent-source.COPY).

Keep the distinction between invoking Clamp and guaranteeing a valid clamp interval: this base component's defaults are REDCON=0 and Minimum REDCON=0. The initialized standard-garrison configuration is a separate cited path in the other-units report. This review does not infer valid startup behavior for every uninitialized subclass or a universal semantic interpretation of all REDCON values. [226 defaults, lines 4–5](evidence/editor-source/ai-research-collection-20260921T030437Z-f7d8e930/226-EncounterBehaviorComponent-defaults.COPY).

## Movement synthesis review

The main report accurately retains these movement findings: worker follow setup chooses the native player-squad leader; following remains combat-capable; move orders lead to local guarding/repositioning; nav projection is not path feasibility; the move callback ignores request identity and does not finish the job; IsClosingIn does not test target progress; IsAllyNearby can accept the no-qualifying-allies case; and scripted movement is not a complete direct-piloting interface. The appendix also preserves the unresolved recovery-key value and the distinction between order flags and MissionOrders.

One concrete correction was sent to the lead author: the appendix's units row originally identified “073 connected tree and **175** range decorator.” The source for the inclusive outside-distance predicate used by 073 is **177**, not 175. The predicate compares squared 3D distance **>=** Distance squared, so its inverse is strictly less-than; this matters at the formation-follow boundaries. [177 source, lines 47–227](evidence/editor-source/ai-research-collection-20260921T030437Z-f7d8e930/177-BTDecorator_OutsideRangeFromActor-source.COPY), [073 source, lines 335–525](evidence/editor-source/ai-research-collection-20260921T030437Z-f7d8e930/073-BT_MechFightWhileFollowing-source.COPY).

No additional movement behavioral correction was required in this synthesis pass. Independent confirmation here concerns static evidence only; native scheduling, actual assignments, physical movement, live authority and runtime latency remain outside this review.
