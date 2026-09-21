# Offline tactical decision prototype

Version 1. PROPOSED project interface and policy; synthetic evaluation is MOCK_ONLY. No MW5 adapter, native calls, listener, model API, game simulation or paid service.

## Purpose and inputs

The pure Node.js function `decideSquad(snapshot, previousState)` returns recommendations and new volatile decision state. A separate runner reads synthetic fixtures and writes reviewable JSON. All inputs below are project fixture fields, not claimed MW5 telemetry names.

The snapshot identifies a mission session, monotonic sequence, sample time and current clock, mission phase and known authority. It contains at most three uniquely identified lancemates, known targets, and a player-leader binding. Each lancemate supplies current pawn/controller/generation, reciprocal binding confirmation, AI ownership, membership, configured/alive state, manual-order observation, health/heat/ammunition, weapon-range envelope, distance to the leader, permitted recommendation capabilities, actor-specific target engagements and supplied reposition candidates. Targets include friendly-lance knowledge, current visibility, observed time and a normalized threat estimate. Candidates explicitly supply path feasibility, occupancy, relative safety and a target-range estimate; the policy never invents geometry.

Unknown required information yields DEFER. Only fresh known hostile targets may be selected. No hidden enemy facts may influence a recommendation. Output vocabulary is MAINTAIN, REGROUP, FOCUS, REPOSITION and DEFER, with reasons, evidence identifiers, unmet prerequisites and explicit `dispatchable: false`.

Member IDs, live pawn identities and controller identities must be unambiguous. A recipient cannot also be the verified player-leader pawn. Each actor has at most one engagement observation per target and one record per candidate location; duplicates defer instead of selecting the favorable assertion. Identifier strings reserve JavaScript prototype property names. Prior state must be the policy's own returned state, not arbitrary model-supplied data.

Fresh active human-order observations are retained even while paused or failing other control gates. Holds survive temporary absence from the member list, possession changes and repeated active reports that weaken a persistent flag. Only currently present eligible members receive recommendations. History is volatile and scoped to the mission session; a new session resets it. This is not campaign persistence.

## Proposed priorities

1. Reject invalid, duplicate, stale or regressing observations; invalidate continuity after binding changes, human possession or loss of control prerequisites.
2. Honor human orders before tactics. Active or unresolved orders retain precedence. Auto-resume requires a matching observed completed nonpersistent order or an explicit release. Persistent orders require release. Time alone cannot clear a human order.
3. Protect a critically damaged mech: choose an explicitly safer, navigable unoccupied supplied location; otherwise regroup only when the correct native player-squad leader and safe route are stipulated; otherwise maintain native behavior.
4. Leave heat/ammunition management to native AI when temporarily unable to contribute; do not invent a firing command.
5. Regroup an isolated mech when a safe route and correct leader are known; otherwise evaluate combat without assuming a path.
6. Focus a fresh, visible, known hostile target with a clear firing opportunity inside the supplied weapon envelope. Prefer threat, retain a still-useful prior target to limit churn, and cap assignments per target to two when an alternative exists. This is a proposed coordination heuristic, not MW5 damage simulation.
7. If no useful firing opportunity exists, consider only supplied path-verified candidate positions inside weapon range of a known visible target. Reserve each candidate location ID across the lance.
8. Otherwise maintain native behavior and explain missing tactical opportunity. Unsupported actions are never recommended as executable.

Proposed fixture thresholds: observation age <=1000 ms, health <=0.25 critical, heat >=0.9 cooling, isolation >500 m, target-change preference hysteresis 0.2 normalized threat. These values are tunable research assumptions, not extracted MW5 constants or measured optima.

## Independent scenario specification

Before implementing policy, define expected constraints for: useful focus; mixed weapon ranges; threatened damaged mech; unavailable safe retreat; regrouping; unknown leader; overheating; depleted ammunition; lost/dead/friendly/hidden targets; stale targets; shared-target distribution; exclusive position assignment; stable target retention; active human order; verified completion; persistent order; explicit release; unresolved completion; stale/regressing/future snapshots; pause/loading; unknown authority; human possession; changed binding; duplicate IDs; missing observations; unsupported capabilities; input purity; and deterministic output.

Each case must assert externally meaningful actions or forbidden outcomes. Reviewers should add counterexamples without relying on implementation branch names. Prior command-contract fixtures and their dispatch model stay separate and unchanged.

## Limits

All safety and tactical observations are stipulated. Target visibility is a fixture assertion, not the native hysteretic `is_actor_visible` value. Weapon envelope, threat, path and safer-position estimates need real acquisition and validation later. The module cannot establish improved gameplay, predict damage, or issue MW5 orders. Its output is a hypothesis to compare with future recorded situations.
