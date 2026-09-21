# Overnight package handoff

21 September 2026. **Completed research and offline implementation; all gameplay/integration tests NOT_PERFORMED.** This package implements the user-approved overnight scope. It does not complete the later live-control or direct-piloting roadmap.

Start with [the readable AI report](AI_REPORT.md). Detailed evidence is in [the technical appendix](AI_TECHNICAL_APPENDIX.md) and [coverage ledger](AI_COVERAGE_LEDGER.json). Future decision work should load [TACTICAL_PLAYBOOK.json v1.0.0](../design/TACTICAL_PLAYBOOK.json) and the evidence index, then consult exact source ranges. This is reusable project knowledge, not model training or a permanent memory guarantee.

## Delivered and verified

| Requirement | Result | Evidence |
|---|---|---|
| Every inventory entry accounted for | 249/249;167 semantic behavior/logic reviews,77 supporting-data reviews,5 explicit unavailable entries | [Ledger](AI_COVERAGE_LEDGER.json) |
| Every available export reviewed | 244 source exports and128 class-default exports have authored review records/citations;372 artifact hashes match preserved collection | [Index builder](../scripts/Build-AIReviewIndex.mjs) and ledger |
| Readable report, worked examples, diagrams and technical appendix | Delivered, source/configuration/inference/native/gameplay distinctions retained | [Report](AI_REPORT.md), [appendix](AI_TECHNICAL_APPENDIX.md) |
| Combat, movement, allies/enemies and other units analyzed | Four detailed workstream reports plus reused assignment/order/state traces | [Combat](AI_COMBAT_ANALYSIS.md), [movement](AI_MOVEMENT_ANALYSIS.md), [other units](AI_OTHER_UNITS_ANALYSIS.md), [control/support](AI_CONTROL_SUPPORT_ANALYSIS.md) |
| Unresolved dependencies triaged | Five collection gaps and222 unresolved metadata references categorized with impact/limits; dependency bodies not falsely counted reviewed | Ledger and appendix |
| Reusable tactical knowledge | Version1.0.0, six evidence-linked rules; observations, assumptions, cancellation and implementation status explicit | [Playbook](../design/TACTICAL_PLAYBOOK.md) / [JSON](../design/TACTICAL_PLAYBOOK.json) |
| Offline prototype for three individually coordinated members | Deterministic pure Node function with per-member reasons, shared reservations, retained decisions and human precedence | [Policy](../scripts/tactical-policy.mjs), [contract](../design/OFFLINE_TACTICAL_PROTOTYPE.md) |
| At least24 independently specified cases | 48 primary scenarios +3 general properties pass; separate reviewer wrote31 adversarial cases, all pass | [Primary results](OFFLINE_TACTICAL_RESULTS.json), [independent review](TACTICAL_INDEPENDENT_REVIEW.md) |
| Independent source/semantics review | Integration/source review, targeted control review and cross-review of other-unit semantics completed; qualifications retained | [Source review](OVERNIGHT_SOURCE_INDEPENDENT_REVIEW.md), [control review](CONTROL_SUPPORT_INDEPENDENT_REVIEW.md), [other-unit review](OTHER_UNITS_INDEPENDENT_REVIEW.md) |
| Concrete next integration handoff | Candidate creation/observation path, exact blockers, proposed artifact set, installation gate, isolated scenario and rollback | [Passive observer handoff](../design/PASSIVE_OBSERVER_HANDOFF.md) |
| Final artifact consistency | Hashes, current test receipts, links and completion counts checked | [Validation receipt](OVERNIGHT_VALIDATION.json) |

**All policy executions are MOCK_ONLY.** Native calls:0. Game/editor launches and control:0 in this package. No game assets, retail files, saves, load order, voice, API billing, training or campaign persistence were changed. The older command-contract exercise remains a separate simulation and was not substituted for native acceptance.

## Failures found and corrected

The independent policy reviewer initially reproduced ten failing cases. The [original review](TACTICAL_INDEPENDENT_REVIEW_BEFORE_FIX.md) is preserved with its original hashes. Corrections now reject duplicate live pawn/controller identities and player-leader recipients, reject contradictory duplicate target/position observations, preserve persistent human orders against weakened repeated reports, retain holds when members disappear, and capture fresh active human orders during pause or binding transitions. All original counterexamples and five follow-up cases pass against the corrected policy. No failing policy case remains in the reviewed suite; this is not a proof against every possible input or a game-performance claim.

Source cross-review corrected a range-decorator asset ID, clarified omitted native defaults/context and retained the actual REDCON clamp arguments. A later source trace superseded the earlier literal-name search for CancelOrders: this UI binding closes the order menu, without establishing cancellation of a native job.

Two control-lifecycle qualifications remain: ControllerConfigured does not have a proven notification path for every null/unpossessed transition, and the component factory's duplicate check applies only within one invocation. These are live-integration obligations, not reasons to mark the completed offline scope unfinished.

## Still unknown

- Native target scoring, weapon selection/aiming, pathfinding, formation allocation and worker arbitration bodies. Exposed calls/configuration cannot reconstruct their implementation.
- Actual shipping assignments and compatibility for this build, DLC and enabled-mod configuration. Prior environment metadata is historical and must be refreshed before live work.
- Correct runtime actor identity and authoritative human-input provenance, especially across possession, pause, world changes and missing callbacks.
- Reliable native completion/release semantics. Posting, UI completion, arrival dialogue and observed movement are separate evidence stages.
- A supported initialization/cooking path for the passive component, its resource cost and an eventual bounded asynchronous external transport.
- Tactical benefit, latency, survival, damage, mission performance and the feasibility/competence of a continuous direct-piloting loop.

No observation that a source graph is odd has been promoted to a shipping-game bug or an optimization result. Unknown path/visibility facts remain unknown.

## Exact next bounded task

Resolve the official mod initialization and cooking path for the proposed **LanceObserverProbe** passive component and diagnostic widget. Start from the collected player-controller component factory and inspect only the required installed templates/configuration and current primary documentation. Establish a supported caller/registration mechanism; do not assume that creating a data asset automatically installs it. Do not repeatedly invoke the existing factory as a speculative repair.

Then prepare actual component/widget assets, actual package/dependency hashes, destination paths, mod descriptor, enabled-mod changes, disk requirement and removal/restore manifest. These assets are **NOT_BUILT**; the handoff deliberately does not pretend its proposed names are a ready-to-install package.

The first supervised experiment, after its concrete artifacts and deployment authorization exist, is a passive stock Instant Action observation with one identified AI and an unaffected sentinel. Record baseline; display verified identity/job/follow/position and sample age; have the user issue normal orders, pause, swap mechs and end/restart the mission. Check null-pawn transitions and duplicate component count explicitly. The probe submits no commands. Compare samples to independently visible behavior, measure frame-time/sample gaps, then remove only manifest-listed additions and restore the recorded configuration.

Only after that evidence passes should the project attempt one Form On Me order to one AI. All-three tactical autonomy follows verified one-AI control and repeated comparisons. Direct movement, aiming and firing remain later incremental capabilities requiring a dedicated local loop. The main campaign stays outside these tests.

## Reproduction and continuation

Use existing Node.js; no packages or paid services are needed:

```powershell
node scripts/Build-AIReviewIndex.mjs
node scripts/Exercise-TacticalPolicy.mjs
node scripts/Review-TacticalPolicy.mjs
node scripts/Verify-OvernightPackage.mjs
```

Run affected checks again when source summaries, policy, fixtures or contracts change; unchanged passing suites do not need continuous reruns. The scripts execute project-owned offline analysis only. [NEXT_CODEX_PROMPT.md](../NEXT_CODEX_PROMPT.md) and [progress checkpoints](../design/OVERNIGHT_PROGRESS.md) preserve the continuation context.
