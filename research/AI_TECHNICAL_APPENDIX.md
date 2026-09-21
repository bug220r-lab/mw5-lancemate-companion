# AI research technical appendix

21 September 2026. Static analysis of the preserved editor collection; native implementation and gameplay remain unverified. Read [the main report](AI_REPORT.md) first.

## Evidence and reproducibility

The authoritative input is [collection report.json](evidence/editor-source/ai-research-collection-20260921T030437Z-f7d8e930/report.json). Asset IDs in this appendix, the playbook and ledger are its zero-based inventory IDs, rendered with three digits in export filenames. `source` identifies a text/graph export; `defaults` identifies a class-default object export. These are different evidence kinds.

[AI_COVERAGE_LEDGER.json](AI_COVERAGE_LEDGER.json) records package path, class, disposition, authored semantic summary, precise source/default line ranges, limitations, reviewer workstream and artifact SHA-256. [Build-AIReviewIndex.mjs](../scripts/Build-AIReviewIndex.mjs) combines the four authored ledgers and checks uniqueness/completeness, citation existence and range bounds, playbook references and source/default hashes. It does not generate semantic understanding from counts.

| Disposition | Count | Meaning |
|---|---:|---|
| SEMANTIC_REVIEWED | 167 | Connected behavior, relevant readers/writers, defaults and boundaries reviewed. |
| SUPPORTING_DATA_REVIEWED | 77 | Configuration, schema, interface, curve or supporting UI/library source reviewed for AI relevance; no claim to exhaustively validate unrelated utility/UI behavior. |
| UNAVAILABLE | 5 | Inventory entry accounted for with a specific gap; no invented implementation. |

All 244 available source exports and all 128 collected defaults have review records and citations. Native declarations are signatures/configuration, not implementation bodies. Source observations are marked OBSERVED static evidence or DOCUMENTED source findings in the component reports; neither denotes observed gameplay. Proposed policy remains PROPOSED, synthetic execution MOCK_ONLY, and all shipping tests NOT_PERFORMED.

## Source map

| Question | Main assets | Detailed trace |
|---|---|---|
| Where do orders go? | 000-008, 029-045, 234-237, 242-248 | [Order lifecycle](ORDER_LIFECYCLE_TRACE.md), [movement/jobs](AI_MOVEMENT_ANALYSIS.md) |
| Which controller/config/role is selected? | 009-016, 055, 094-125, 230-241 | [Assignment](AI_ASSIGNMENT_TRACE.md), [combat](AI_COMBAT_ANALYSIS.md), [control support](AI_CONTROL_SUPPORT_ANALYSIS.md) |
| What can be observed safely? | 003, 008-010, 194, 238-241 and native API declarations | [Tactical state](TACTICAL_STATE_TRACE.md), [control support](AI_CONTROL_SUPPORT_ANALYSIS.md) |
| How do combat and positioning interact? | 046-079, 094-125, 168-179, 191-213 | [Combat](AI_COMBAT_ANALYSIS.md), [movement](AI_MOVEMENT_ANALYSIS.md) |
| What controls non-mech units and encounters? | 018-028, 127-157, 214-230 | [Other units and encounters](AI_OTHER_UNITS_ANALYSIS.md) |
| What is specific to tutorials/debugging? | 080-093, 150-156 | [Movement](AI_MOVEMENT_ANALYSIS.md), [other units](AI_OTHER_UNITS_ANALYSIS.md) |

Each component report links exact exports and line ranges. The ledger is the per-asset lookup when a summary references a range of IDs. Registered function graphs, event links, runtime tree roots and serialized `Children` connections were distinguished from unused objects and comments. Unknown callers remain unknown even when a function body is accessible.

## Selected state readers and writers

This is an index of traced relationships, not a complete native state machine. See the linked component analyses for all branch guards and line-level evidence.

| State | Exposed writer or supplier | Reader/consumer | Limit |
|---|---|---|---|
| Follow target / `TravelActor` | Ally_FollowJob 004; worker setup chooses player-squad leader | Follow tree 013 and fight-while-following 073 | Native formation membership/slot allocation and runtime leader require observation. |
| `Wait`, `Guard`, `Attack` | Ally move/attack/follow jobs 004,032,033 | Ally master 014, other applicable behavior branches | Generic `MissionOrders` is a separate mechanism; do not conflate enums and flags. |
| `MissionOrders` | Team-order/native job context | Mech 012, tank 133, VTOL 149 and master-tree guards | Human origin cannot be inferred solely from this state. |
| Combat target / suspicion / last-known location | Senses 194, ally attack 033, native target service | Combat tree 057, predicates 169/171/172, scout context 181 | Native scoring and sensory computation unavailable; current visibility is separate. |
| Combat tactic | Picker 055, assigned/default primary tactic | Combat 057, role trees 058-062 | Native capability/range calculations and actual runtime config not reconstructed. |
| Evasive-maneuver flag/counter | Service 053 | Mobile 060 | Native dead-zone predicate; configured cadence is not measured reaction time. |
| Guard/travel destination | Ally move 032, query tasks and contexts | Movement 075-079, arrival/location checks | Projection, EQS scoring, path completion and arrival are distinct. |
| Navigation recovery flag | Native recovery service and recovery tree 165 | Follow, combat and movement selectors | A serialized setter lacks an explicit boolean value; clearing behavior not asserted. |
| Encounter unit maps, spawn queue, alert state | Encounter parent 229 and derived 214-228 | Jobs, activation/wave/awareness callbacks | Queued spawn is not actor existence; LeftPlay is not necessarily combat death. |

No external telemetry schema is inferred from these names. The prototype's identity generation, sequence, observation timestamp, manual revision and safety fields are **project proposals**. [Prototype contract](../design/OFFLINE_TACTICAL_PROTOTYPE.md).

## Units, configuration and instance overrides

| Value | Evidence kind | Interpretation |
|---|---|---|
| Visibility threshold 2 seconds | 172 connected native call argument | History predicate; current line-of-fire geometry remains separate. |
| Role picker 1.25 with 0.25 deviation | 057 service instance | Requested interval, not benchmarked response latency. |
| Tank-role recent damage 15 seconds | 049 predicate plus 062 instance | Positive damage timestamp and inclusive time comparison; separate from vehicle AI. |
| Follow/combat boundaries 7500,5000,10000 | 073 connected tree and 177 range decorator | Preserve raw values and comparison direction; do not infer a whole formation policy from one threshold. |
| Ally move projection default 20 metres, multiplied by 100 | 032 connected graph/default | Explicit conversion supported at this call. Projection does not prove route feasibility. |
| EQS radii such as 5000/15000/30000 | Query assets 064-071 | Raw spatial values; native providers/tests may differ by query option. |
| Tutorial VTOL 0.03 versus class default 0.5 | 155 instance / 151 default | Instance overrides matter; no external 33 Hz control capability established. |
| Health 0.25, heat 0.9, isolation 500 metres, age 1000 ms, threat hysteresis 0.2 | Offline policy constants | Proposed research settings; not reverse-engineered MW5 thresholds or validated optima. |
| Observer 2 Hz | Proposed handoff | Initial bounded sampling setting; not a direct-piloting loop. |

The [combat](AI_COMBAT_ANALYSIS.md) and [movement](AI_MOVEMENT_ANALYSIS.md) reports preserve branch order, raw values, inclusive/exclusive checks, instance overrides, configuration-vs-native distinctions and disconnected-node caveats.

## Missing exports and dependency triage

| Inventory ID | Disposition | Consequence / smallest useful resolution |
|---|---|---|
| 134,135 | Invalid/unavailable old VTOL paths in collected metadata | Inspect only the specific redirect/assignment if needed. The valid VTOL tree at 149 is reviewed; do not treat an old path as a second working implementation. |
| 186 | Old/redirected EQS metadata; no usable export | Verify resolution to the actually referenced query before relying on its behavior. |
| 187 | DiamondFormation custom asset unsupported by source exporter | Targeted property/default inspection if formation optimization becomes the next concrete question. |
| 231 | MW5_FunctionLibrary source exceeded the collector's per-source size budget | Targeted export/inspection of the needed function later; no broad recollection or blanket claim to know this library. |

The ledger categorizes **222 unresolved dependency-frontier references** and retains every referring asset. Categorization is explicitly `METADATA_TRIAGE_ONLY`, with semantic review `NOT_PERFORMED`. It ranks native implementation boundaries, transport/plugin leads, manual-input dependencies, perception/configuration, spawning/assignment, unit lifecycle, supporting helpers and presentation concerns. It is not a substitute for reviewing the referenced code.

High-impact blockers are actor/possession identity, reliable human-command provenance/completion, the candidate component initialization caller, cooked availability and observation output. These block live integration. Native weapon selection, range, pathfinding, formation and arbitration internals limit detailed behavioral explanations and optimization claims. Tutorial/debug or cosmetic dependencies should be pursued only when they affect the chosen experiment. The complete unresolved list stays available; none is silently declared harmless.

## Control support correction and shipping boundary

The newer UI trace finds a binding for `InputAction_CancelOrder="CancelOrders"`: it binds `CloseOrderWindow`. That function closes the command interface. It does **not** establish cancelling the current native job. This supersedes the earlier narrower claim that no such binding had been found. [Control-support evidence, asset 008](AI_CONTROL_SUPPORT_ANALYSIS.md).

`PlayerController.AddPlayerControllerComponents` can find component data assets and add eligible runtime components. Its body is available; a connected initialization caller has not been established. The base component's configured callback and the possession-handling path are useful candidates, not proof that a new mod component will initialize, cook or run correctly in the shipping build. [Candidate and blockers](../design/PASSIVE_OBSERVER_HANDOFF.md).

Editor Python is not a shipping adapter. A native declaration of a file or JSON function is not proof of an asynchronous transport or safe throughput. No public listener, game adapter, DLL, injected code, cooked mod or executable integration package was created here.

## Repeating the offline checks

From the project directory, using existing Node.js and built-in libraries:

```powershell
node scripts/Build-AIReviewIndex.mjs
node scripts/Exercise-TacticalPolicy.mjs
node scripts/Review-TacticalPolicy.mjs
```

These commands inspect preserved text and run synthetic policy cases. They do not start the editor/game or read live actors. The policy accepts a snapshot plus prior state and produces recommendations; all fields require explicit future mapping. The existing command-contract exercise remains separate. Passing either suite cannot establish native order acceptance, behavior, compatibility or performance.

Final independent reviews and the completion checklist are linked from [OVERNIGHT_HANDOFF.md](OVERNIGHT_HANDOFF.md). Any later source or policy change must refresh the relevant hashes/results and review rather than reuse a stale verdict.
