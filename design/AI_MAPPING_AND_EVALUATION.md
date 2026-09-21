# Mapping and evaluating lancemate AI

Date: 2026-09-20. **Updated user direction:** the eventual ambition is an agent that plays MW5 in real time like a human. The nearer milestone is **live tactical decision-making**. Current work is a broader Python source collector covering lancemates and useful enemy/ally AI. No AI assets were changed, no mod was built/deployed, and no gameplay or training occurred. The long-term ambition is a goal, not a demonstrated or guaranteed capability.

## Milestone sequence

**Source progress:** the [expanded native collection is now complete](../research/AI_COLLECTION_RESULT_2026-09-20.md), with244source texts and128class-default texts verified and five explicit gaps. [Initial findings](../research/AI_EXPANDED_SOURCE_FIRST_LOOK.md) are available. Older references to this collector as pending are superseded; runtime mapping/testing is still outstanding.

1. **Current collection and analysis:** the [249-asset inventory/helper](../research/AI_SOURCE_COLLECTION.md) expand the eighteen-source baseline. Map controllers, roots, jobs, keys, configuration and human override paths. Report missing references and native bodies; source evidence does not supply live perception.
2. **Fresh-state observation and one-command proof:** resolve the bridge and identity/authority questions in [PROOF_OF_CONCEPT.md](PROOF_OF_CONCEPT.md). Prepare a concrete isolated experiment, then verify fresh telemetry, one accepted order, independently observed behavior and manual supersession. No such experiment has run.
3. **Live tactical decisions:** initially make bounded high-level decisions for verified AI lancemates, using measured state and demonstrated actions. Native AI can retain immediate movement, aiming and firing. Preserve player override and compare all three positions against a vanilla baseline. Cadence and benefit must be measured.
4. **Human-like real-time play:** investigate continuous perception, movement, aiming, firing, heat, positioning and adaptation after the tactical milestone works. A dedicated runtime/control loop, suitable observation/action access and repeatable gameplay evaluation would be additional engineering work. Required latency, hardware, cost and attainable competence remain unknown.

Mission interaction remains the experience focus; voice is deferred. Source collection does not advance into training, campaign persistence or paid services. Live deployment/control details must become concrete before a later test is authorized; no permission request is needed for this preparation.

## Feasibility

A substantial map of the exposed decision logic is feasible with the collected source. A complete map of every internal decision is not established: editable trees/Blueprints call compiled native classes, and the collected Python reference provides declarations rather than implementation bodies. Runtime conditions also include mission geometry, navigation, visibility, other actors and changing equipment/state. Those cannot be reconstructed from a static source export alone.

The existing MechAIController export names native parent `/Script/MechWarrior.MWMechAIController` at line 28. The generated reference declares that parent's `behaviour_config`, `default_behavior_tree`, `combat_target`, `move_with_respect_to_combat_target` and other properties near lines 341348 onward. These are actual inspection leads. Neither Python stub return placeholders nor absent serialized property values are verified instance defaults.

## Source map to build

| Layer | Output | What it establishes |
|---|---|---|
| Assets and inheritance | Versioned graph of exact tree, task, decorator, service, blackboard, job and controller references | Which definitions are available and which dependencies/native bodies remain missing |
| Decision rules | Runtime RootNode/Children links, conditions, branch order, abort behavior, target keys and configured parameters | What the available source instructs the AI to consider; editor graph decorations are not sufficient |
| State and ownership | Readers/writers for relevant keys, current mech/controller association and job lifecycle | Which actor a decision concerns, what state may be stale and where human overrides must win |
| Scenario reasoning | Small offline branch exercises with explicit assumptions and unknown external tasks | Logical consequences and contradictions in the modeled slice, classified MOCK_ONLY |
| Runtime measurement | Versioned isolated mission observations and before/after comparisons, only after separate approval | Whether a proposed change actually improves behavior without regressions |

Epic's [UE4 behavior-tree overview](https://dev.epicgames.com/documentation/en-us/unreal-engine/behavior-tree-overview?application_version=4.27) describes blackboard state, conditional decorators, action tasks, services and event-driven execution. Accessed 2026-09-20; the reference is 4.27 and this installed fork is 4.26.2. Use it to interpret generic engine concepts, not to fill in unknown MW5 task implementations.

## Current concrete starting points

The collected `BT_MechFollow` runtime links contain navigation-recovery, fight-while-following and formation/travel branches, plus a target-picking service. Its serialized service settings include Interval=1.5 and RandomDeviation=0.5 (lines 570-571); these are source configuration, not a measured gameplay cadence or a performance flaw. `BT_MechTeamOrders` contains distinct Wait/Stop/Move/Attack/Follow paths and associated target conditions. The initial exact-link analysis is recorded in [the first-pass map](../research/AI_BEHAVIOR_MAP_FIRST_PASS.md).

The next missing-source frontier is concrete: `BT_MechCombat`, `BT_MechFightWhileFollowing`, `BT_NavMeshCheckRecovery`, movement/hold subtrees, their referenced Blueprint decorators/tasks, and the parent `MWUnitBlackboard`. They are referenced by collected runtime links or blackboard parent metadata. The prepared expanded collector includes these installed paths and broader AI/configuration families. Its native execution is pending; it does not automatically follow the whole game's dependency graph.

## How to improve behavior

Start with one measurable behavior: fighting while keeping useful formation. Candidate hypotheses include fewer unnecessary formation corrections during useful combat, or fewer repeated failed movement attempts. These are proposals to test, not observed bugs. Wider combat priorities, weapon-range choices, heat, damage avoidance and coordinated roles require their corresponding source and actor-specific state first.

Before a change, establish the vanilla baseline under comparable mission/loadout conditions. Record time spent stuck, formation recovery time, command-response time, productive firing opportunities and damage dealt/taken when those can be measured reliably. Improved damage alone must not excuse worse survivability or disobedience. CPU/frame-time optimization is a separate profiling question; reducing a service interval is not automatically an improvement.

Make one isolated reversible change only after its implementation and test scope are concrete and approved. Repeat the baseline scenario, include a non-designated sentinel for one-pilot changes, and then test all three AI positions with varied loadouts. Shared AI assets may also affect enemies or other allies: actual class/job/tree assignment must establish the affected population before deployment. No assertion that a global tree edit upgrades only the three lancemates is justified yet.

## What 'playing it' would mean

Reasoning through exported branches and hypothetical battle states can help design better code, but does not reproduce the engine's full simulation. A later observer-and-test workflow could compare expected versus real behavior. A live tactical decision layer would additionally need the unresolved telemetry/command bridge and would submit occasional high-level decisions while native code handles movement, aiming and firing. Direct continuous piloting or a learned controller is a different, substantially larger project; this collection does not create either one.

The current actionable work is offline mapping and identification of testable changes. Source sufficient for a hypothesis is not evidence of gameplay improvement. All live execution, deployment, measured benefit and compatibility remain NOT_PERFORMED.
