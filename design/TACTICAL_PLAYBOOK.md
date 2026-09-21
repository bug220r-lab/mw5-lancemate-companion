# Tactical knowledge and revision process

Version1.0.0, 2026-09-21 UTC. The machine-readable [playbook](TACTICAL_PLAYBOOK.json) links each rule used by the [offline prototype](OFFLINE_TACTICAL_PROTOTYPE.md) to observations, evidence, assumptions, intended benefit and abort conditions. The [AI report](../research/AI_REPORT.md) explains the game logic; the [coverage ledger](../research/AI_COVERAGE_LEDGER.json) resolves source IDs to exact files and hashes.

## How future tasks use the findings

Read the report's current verdict, the applicable build/collection identity and these rule records before proposing a new tactic. Resolve each evidence ID through the ledger, distinguish source behavior from policy assumptions, then inspect the relevant trace. Do not load old synthetic results as if they were recorded game observations. The current `decideSquad` module emits these rule IDs with every recommendation.

This is reusable project knowledge, not model-weight training or a claim of permanent memory. A future agent can reconstruct the reasoning from the files. No cloud embedding service or external database is required.

## What the prototype knows

It receives explicit, synthetic observations for up to three mechs. It can suggest useful target assignments, preserve a still-useful target, choose a supplied reposition location, regroup safely or leave native behavior alone. It never manufactures target positions or route validity. `ammoAvailable` means some usable weapon opportunity exists, including an energy-only mech; it must not be naively mapped to total ammunition count. `weaponRangeM` is a simplified effective envelope, not a simulation of every weapon group's timing, minimum range or damage.

Human intent has higher priority than all tactical scores. Completion must match the tracked order; a persistent order requires release. Missing orders, UI completion, affirmative speech and elapsed time are not sufficient. Recommendations have `dispatchable=false` permanently in this prototype. Even a source-supported candidate still needs independent native validation.

## How improvement will be established later

Retain versioned baseline observations, loadout/mission/build identity, human interventions and the policy decision/reason. Compare a revised rule on the same recorded situations first; then run an authorized paired Instant Action experiment. Measure mission progress, survival, damage taken/dealt where reliable, time stuck, command responsiveness, unnecessary target/order changes and frame time. Record failures and uncertainty alongside successes.

Change one behavioral hypothesis at a time. Add a case for the observed failure before altering the policy; re-run affected scenarios and check the independent review. Update the rule version, source applicability and limitation when evidence changes. Promote `PROPOSED_HEURISTIC` to game-verified only after a reproducible in-game receipt supports the exact claim. A higher synthetic pass count is not measured combat improvement.

## Next boundary

The [passive observer handoff](PASSIVE_OBSERVER_HANDOFF.md) defines the next experiment and actual integration gaps. Voice, campaign persistence, model training and direct piloting are later separate phases. Independent squad tactics is the selected eventual mode; native AI retains movement/aiming/firing through the first live tactical milestone.
