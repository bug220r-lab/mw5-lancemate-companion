# Consolidated source collection result

**OBSERVED: the native editor collection finished at approximately 22:39 local time on 2026-09-20.** [Receipt](evidence/editor-source/mod-research-collection-20260921T023909Z-5eeaf52a/report.json) reports eighteen of eighteen assets collected, zero errors and 2.891 seconds elapsed for this particular run. That duration is not a general performance guarantee.

The batch contains sixteen successful new native text exports and two hash-verified reused exports. Fourteen of the sixteen new exports were already loaded; only the range decorator and MechTargetComponent needed explicit loading. Runtime registry classes are thirteen Blueprint, one WidgetBlueprint, three BehaviorTree and one BlackboardData. No dependency list was truncated; the registry reported that it was not loading assets during queries. These observations do not prove graph completeness or active gameplay use.

**Independent read-only receipt audit passed:** all eighteen output hashes/sizes and raw graph-marker counts match the receipt; all eighteen current installed source hashes match the scope and receipt; collector, scope and API-reference hashes match current files. There are 160 recorded dependency-reference entries covering 88 distinct names, with no missing assets or truncation. Marker counts are not unique node counts or semantic verification. No native/editor/game action was performed by the audit.

Asset text totals 6,462,606 bytes. The generated API reference snapshot adds 21,026,350 bytes, for **27,488,956 bytes (26.22 MiB)** of recorded source/reference output, excluding JSON receipts. API snapshot SHA256 is `AC4C46761BC54099302155BC0A908AE3F64B161CA77EB9AFD0CC6C1F1B826480`, unchanged from the previously inspected generated reference. All eighteen installed source hashes were unchanged according to the collector's after-export checks. Exports reflect in-memory content; unchanged disk hashes do not prove that no unsaved editor changes existed.

## What was collected and why

| Group | Files | Question for the mod |
|---|---|---|
| Command selection (2) | Dpad_FormOnMeLogic; Dpad_LanceOrderDispatcher | How does a selected lancemate become an order recipient? |
| Command setup and manual input (4) | Dpad_ActionLogic; Dpad_FunctionLib; Dpad_BaseLanceOrder; LanceStatusWidget | How are actions created, attached to the player's mech, enabled and triggered manually? |
| Follow-order delivery (3) | FollowOrder; SquadOrderBase; Ally_FollowJob | How is an order translated into a job, delivered to recipients and given a follow target? |
| Controller leads (3) | MechAIController; MW5PlayerController; MW5PlayerControllerDerived | Which player/AI classes own relevant input, possession and lifecycle behavior? |
| Decision trees and working-state definitions (4) | BT_MechTeamOrders; BT_MechFollow; BT_AllyMechMasterTree; Blackboard_Mech | How are order/follow decisions organized, and which named state fields do they use? |
| Position and damage-display leads (2) | BTDecorator_WithinRangeFromActor; MechTargetComponent | How are positions/ranges and damage-display values obtained and associated with an actor? |

For each asset the collection retains exported text, exact source/object paths, source and export hashes, type metadata, direct dependency names, status, size and errors. Blueprint text can contain functions, events, nodes, typed pins and wiring. Behavior-tree text is a different structure and must be read accordingly. The blackboard defines typed state keys rather than an executable graph; zero graph GUID/link fields for that file is expected.

The full API-reference text captures exposed class/function/property declarations and documentation for further offline lookup. It does not provide native C++ implementation bodies or prove a method is callable in the packaged game. Dependency records identify references, not runtime execution edges, and do not include the contents of every dependency.

## Immediate limits and next analysis

Collection success is a source-acquisition milestone. The new sixteen exports still require semantic review. In particular, MechAIController's small export is not proof that the AI has little logic; behavior may be inherited or native. Blackboard_Mech explicitly references the unexported parent MWUnitBlackboard. Its ten local keys include TravelActor, Throttle and IsLanceMember, but their actual mission values were not sampled.

Next analyze the collected files offline in this order: FollowOrder -> SquadOrderBase -> Ally_FollowJob; UI initialization/manual inputs and controller boundaries; behavior trees/blackboard; actor-bound telemetry. Record precise graph/pin evidence and unresolved native dependencies. Do not request another collection run or asset screenshot merely because a referenced name appears. Determine the exact unresolved question first.

Live ownership/authority, human override, order acceptance, movement, game communication, compatibility and performance remain **NOT_PERFORMED**. This batch did not read campaign saves, record audio, implement a runtime, start a game or issue gameplay orders. The collection stays in this project folder.
