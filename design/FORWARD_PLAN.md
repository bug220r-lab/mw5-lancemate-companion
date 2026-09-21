# Forward plan: from offline decisions to autonomous lancemates

Prepared 2026-09-21. **PROPOSED plan, not a new active goal or deployment authorization.** Continues the completed overnight package. The end goal remains three independently coordinating lancemates while the user plays, followed by progressively proven movement, aiming and firing control. Human commands take precedence throughout. Mission-only interaction remains the experience target; voice is deferred.

## Current work and ownership

The task **Review overnight package handoff** is actively investigating passive observer initialization and cooking/packaging in this same workspace. Its observed work includes a targeted source lookup for the installed `InstantActionPlayerController`, which was outside the overnight inventory. Its startup role is not yet established. Read its latest [preparation status](../research/PASSIVE_OBSERVER_PREPARATION.md) and [source lookup](PASSIVE_OBSERVER_SOURCE_LOOKUP.md) when that task finishes; this snapshot may be superseded by its findings.

This task has prepared the downstream plan only. Keep observer helpers, packaging research, README and NEXT_CODEX_PROMPT ownership with the task already working on them. Do not start a second observer implementation or broad recollection in parallel. This file is an additive planning artifact and does not modify the overnight evidence, policy or validation receipts.

The completed baseline is [the report](../research/AI_REPORT.md), [evidence ledger](../research/AI_COVERAGE_LEDGER.json), [playbook](TACTICAL_PLAYBOOK.json), [offline policy contract](OFFLINE_TACTICAL_PROTOTYPE.md) and [handoff](../research/OVERNIGHT_HANDOFF.md). Its passing synthetic results establish offline constraints; all shipping observation/control remains NOT_PERFORMED.

## Milestones and evidence required

| Stage | Deliverable | Required result before advancing |
|---|---|---|
| 1. Finish observer preparation | Proven initialization/cooking route, minimal actual component/widget artifacts, hashes, dependencies, installation manifest and rollback | A supported entry point is identified; any missing caller/registration fact is resolved or reduced to an exact supervised probe. Proposed asset names alone do not complete this stage. |
| 2. Validate passive observation | Approved disposable Instant Action run with a passive diagnostic display and a preserved observation record | Correct actor/controller/pawn identity, freshness, possession and mission transitions; human-order entry coverage measured; no commands emitted or duplicate observer instances. Record overhead and sample gaps. |
| 3. Evaluate recommendations without control | Replay verified observations through the existing policy, then show recommendations alongside gameplay only when a supported observation route exists | Every policy input is mapped, derived with documented evidence, or explicitly unknown. No hidden enemy state. Recommendations are compared with independently annotated situations; no dispatch occurs. |
| 4. Prove one native command | One designated AI receives Form On Me in isolated Instant Action, with an unchanged sentinel teammate | Correct native job/worker assignment and independent movement evidence; immediate human supersession measured; pause, stale identity, possession and disconnect cannot cause a command to the wrong actor. |
| 5. Enable bounded tactics for one AI | A small approved action set driven by valid observations, with retained human intent and native fallback | Each action has its own acceptance/behavior/completion evidence. Begin with the proven regroup action; add target and position orders only after separate proofs. Shadow reasoning alone does not enable control. |
| 6. Coordinate all three | Per-unit roles/targets/positions with shared coordination and measured outcomes | No wrong-recipient or human-override failures in the acceptance suite; repeatable comparisons with vanilla across varied loadouts and mission conditions. Improvements must include mission performance and survival, not only damage. |
| 7. Pilot directly | A dedicated local observation/control loop, tested one capability at a time | Movement, orientation/aiming, firing and heat management each pass controlled trials before combination; control ownership, stopping, latency, accuracy and game overhead are measured. Competence remains a feasibility question. |

Stages 3 and 4 can use the same validated observations, but command testing does not wait on implementing every tactical rule. Each stage records failures and limits rather than declaring success from a launch, message transmission or a plausible visual result.

## Most useful independent preparation

While the observer task runs, prepare the **evaluation specification for Stage 3**. This can be a later bounded offline task; it does not need another pass through all source exports.

1. **Observation-to-policy mapping.** For each field consumed by the current policy, record its meaning, unit, provenance, freshness requirement, unknown representation and candidate source. Separate direct observations from estimates such as threat, useful weapon range, safe retreat and path feasibility. Do not invent a native field for a convenient fixture value.
2. **A mission test matrix.** Specify mixed short/long-range loadouts, regrouping under fire, a damaged teammate, lost visibility, obstructions, target changes, pause/loading, human orders, persistent orders and mech swaps. Start with the existing synthetic cases; add real-observation evaluation questions, not duplicate mocks.
3. **An annotation sheet.** For each observed decision point, record what the friendly lance knew, the human's intended order, acceptable alternatives, forbidden actions and why. Write the expected constraints before comparing the policy output. Record ambiguity rather than making the policy its own answer key.
4. **A comparison protocol.** Specify vanilla and companion conditions, scenario/loadout/configuration identity, repetitions, exclusions and metrics. Mission success, lance losses/repair cost, useful firing time, target/order churn, latency and frame-time overhead should be considered together. Fix acceptance criteria before the corresponding trial; numeric performance thresholds remain unset until a baseline is measured.
5. **A replay format proposal.** Keep recorded observations, manual events, expected constraints and policy/playbook versions together. Replay uses the recorded timeline to evaluate age and ordering; it must neither refresh stale samples nor reject every historical sample merely because the wall clock has advanced. Initial records may be manually annotated if the passive display is the only proven output; automated replay requires a validated recording/export mechanism. An overlay alone does not establish an external data connection.

Suggested outputs for that future task: `design/OBSERVATION_POLICY_MAPPING.md`, `design/TACTICAL_EVALUATION_PROTOCOL.md` and a bounded benchmark manifest. These names are proposed; the artifacts have not been implemented by this planning step.

## Rules for transferring from recommendations to control

- A future adapter must distinguish desired intent, submission, native acceptance, observed behavior and completion. The offline module currently returns `dispatchable:false`; a passing case must never silently change that meaning.
- Keep an action/configuration capability table with separate evidence status (UNVERIFIED, SOURCE_SUPPORTED or GAME_VERIFIED) and enabled/disabled state. Proving Form On Me cannot enable attack, move or direct piloting by association.
- Human-order completion/release needs genuine evidence. Persistent intent remains held until explicit release. Missing observations, radio responses, closing the command menu and elapsed time cannot restore autonomy.
- Preserve identity across mech swapping and member-list changes. A slot number or cached pawn pointer cannot become a permanent recipient identity. Require current reciprocal binding and ownership before every dispatch.
- Initial follow experiments must verify the actual native player-squad leader. Position projection and remembered visibility are insufficient evidence of a safe route or current clear fire.
- Any future command transport needs bounded queues, expiry, duplicate suppression, supported thread access and disconnect behavior. Its implementation and installation requirements remain unresolved; the plan selects no port, loader or API.
- Native AI continues when the companion cannot make a justified decision. Do not stop native behavior merely to wait for external reasoning. Low-level direct piloting later needs a separately demonstrated ownership/handover mechanism.

Measure human override from input through cancelled/replaced companion intent to actual native behavior. The proposed 2 Hz passive sampling rate and incomplete possession-callback coverage cannot establish immediate interruption by themselves.

## Handoff between the two tasks

When the running observer task returns, record its exact status: preparation complete, a targeted editor lookup awaiting authorization/results, a creation-only probe ready, or a validated passive observer. These are different milestones. Read its artifacts before advancing this plan.

The next implementation scope should be bounded by that result. If startup remains unresolved, finish the targeted lookup rather than building a speculative runtime. If startup and packaging are established, finish a concrete artifact manifest and supervised passive experiment. If observation is validated, implement only the missing recording/replay mapping and recommendation evaluation needed for Stage 3.

Keep one task responsible for each mutable artifact set. Bring findings back through saved files and explicit handoffs; do not have parallel tasks overwrite the same policy, observer asset or current-status document. No new task, recurring schedule or continuing goal is activated by this plan.

## Live execution boundary

Every game-affecting step still needs its concrete artifacts, version/mod/entitlement checks, disposable Instant Action scenario, baseline and rollback before execution authorization. Main-campaign use follows successful isolated trials. This planning step performs no editor/game execution, adapter installation, paid API use, voice generation, model training or campaign persistence.

The immediate success criterion is a tested way to know what is happening to the correct AI actors. The later success criterion is demonstrated tactical benefit with reliable human precedence. Direct piloting becomes its own measured engineering project after those foundations are established.
