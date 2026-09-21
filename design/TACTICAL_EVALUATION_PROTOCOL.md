# Tactical and direct-control evaluation protocol

Version 1, 2026-09-21. **PROPOSED protocol; all actual gameplay, model, microphone and endurance tests remain NOT_PERFORMED.** The project-owned [benchmark module](../companion/benchmark.mjs) and its [tests](../companion/tests/benchmark.test.mjs) evaluate supplied records using Node built-ins. They do not run MW5, capture telemetry, authenticate evidence or confer deployment permission.

The [synthetic fixture](../synthetic/release-benchmark.json) contains 108 stipulated game-run records plus stipulated voice/style/endurance records, all marked **MOCK_ONLY**. Its apparent numbers are chosen to exercise calculation boundaries. They are not measurements. The fixture must never be relabeled as a real receipt. Tests create fabricated observed-shaped copies only in memory to check the validator's branches.

## Comparison to predeclare before collecting results

Evaluate **vanilla**, **tactical** (native low-level AI with our bounded tactical decisions), and **direct** (the eventual continuous local piloting controller). Direct mode is a future capability, not implemented or observed by this checker. A tactical milestone may report its own subset, but the full three-mode release gate stays incomplete until all three modes have evidence.

Each of the following generic cells has repetitions 1, 2 and 3 in every mode: **12 x 3 x 3 = 108 independent run records**. These are experiment descriptions, not invented game map IDs, procedural seeds or launch commands. Resolve exact available Instant Action setups in a reviewed experiment manifest before gameplay.

| Cell | Objective | Terrain | Complementary loadout profile | Threat variation |
|---|---|---|---|---|
| C01 | Assault | Open | Mixed ranges | Balanced mech lance |
| C02 | Assault | Urban cover | Short range | Armored close assault |
| C03 | Assault | Broken terrain | Long range | Distant fire support |
| C04 | Defense | Open | Mixed ranges | Vehicles and VTOLs |
| C05 | Defense | Urban cover | Short range | Multiple approach directions |
| C06 | Defense | Broken terrain | Long range | Mobile flankers |
| C07 | Objective raid | Open | Mixed ranges | Pursuit during withdrawal |
| C08 | Objective raid | Urban cover | Short range | Turrets and obstacles |
| C09 | Objective raid | Broken terrain | Long range | Lost visibility |
| C10 | Sustained engagement | Open | Mixed ranges | Damage and heat pressure |
| C11 | Sustained engagement | Urban cover | Short range | Target changes |
| C12 | Sustained engagement | Broken terrain | Long range | Regroup under fire |

Pair corresponding scenario/repetition runs across modes. Hold mech/pilot/loadouts, difficulty, graphics, game build, DLC, effective mod configuration, mission settings and the human's experimental instructions constant. Counterbalance mode order to reduce warm-cache, learning and thermal effects. Record randomization/seed support only where it is actually available. If exact encounters cannot be reproduced, document the mismatch and redesign the experiment; matching a text label alone is not physical equivalence.

Predeclare the configuration and cell manifest before inspecting outcomes. `currentConfigHash` is the SHA-256 of that canonical evaluation manifest. The manifest identifies **all three variant artifact sets** and the invariant environment; `mode` records the enabled variant separately. The same hash across modes therefore does not assert identical executable artifacts. Updating game, adapter, model, graphics or protocol requires a new hash and new matching records. The checker compares the supplied hashes, but does not independently inspect the installed configuration or calculate that manifest hash.

Do not discard crashes, losses or failed missions as inconvenient runs. Preserve the original capture, a unique session ID, outcome and failure reason. If a run is technically unmeasurable, preserve it as an excluded/incomplete record with the reason in the human report; do not silently replace it or claim the complete gate passed. The v1 accepted matrix permits exactly one valid record per required cell/repetition/mode. Extra, duplicate or malformed records prevent acceptance.

## Required calculations and thresholds

1. Per-run **damage efficiency = damageDealt / max(1, damageTaken)**, using the same documented measurement scope/units for all modes. Aggregate the three designated AI lancemates only; do not silently mix player damage, building damage or whole-team totals between modes.
2. For each candidate mode, take the median of its 36 per-run efficiencies and the median of the 36 matched vanilla efficiencies. Required relative improvement is **candidate median / vanilla median - 1 >= 0.10**. This is neither a pooled total-damage ratio nor the median of pairwise percentage improvements. The latter is separately reported as advisory. A zero vanilla median makes relative improvement undefined and the damage comparison incomplete; no infinity or assumed substitute is inserted.
3. Per candidate mode, aggregate mission-success count must be at least vanilla's and total lancemate losses must be no greater. Each individual pair with lower success or higher losses is still flagged for critical review even when the aggregate meets the threshold. Inspect individual cells to prevent a median from hiding a weak situation.
4. For every matched run, **candidate p95 frame time / vanilla p95 frame time <= 1.10**. All frame-time samples must be finite, positive and nonempty. Collect the same complete gameplay window and loading/pause inclusion policy for each pair. The checker uses the nearest-rank percentile: sort ascending and select `ceil(n * p) - 1`.
5. During candidate runs and the endurance run, observed **minimum available RAM >= 2 GiB** and **minimum available VRAM >= 1 GiB**. These are the headroom values at worst resource pressure; a maximum available-memory reading or an average cannot substitute. Sample cadence and full capture duration remain review requirements.
6. Personal-style fit: at least **40 distinct held-out decisions**, with the user's explicit `userReviewed: true` and boolean `acceptable` result. At least **80%** must be acceptable. Declare calibration session IDs separately and exclude every decision from those sessions from the held-out evaluation. Real claims require real calibration provenance as well. Preserve rejected decisions.
7. Voice commands: at least **100 distinct recordings**, joint intent-and-recipient correctness **>=95%**, **zero wrong-recipient dispatches**, and **p95 push-to-talk release to final transcript <=1500 ms**. No-dispatch uncertainty is allowed and must be recorded honestly; it is not evidence that a dispatch path worked.
8. Conversation: valid observed first-audio latency samples with **p95 input-completion to first audio <=4000 ms**. Grounding and speaker identity must be recorded; an invented state or wrong speaker is a failure. The approved plan supplies **no minimum conversation sample count**. The checker exposes the count; one sample can satisfy the numerical criterion but cannot establish a reliable tail-latency estimate. The human review should predeclare a representative workload and report this limitation.
9. At least one **60-minute uninterrupted session with all three AI active throughout**, no crash, no human-override failures, no wrong-recipient commands, and the resource reserves above.
10. At least one completed workload with network disconnected, all components local and **zero paid API calls**. A configuration flag alone is not the capture: retain the actual offline test evidence.

For diagnosis, the checker also reports an explicitly defined **1% low FPS = 1000 / mean(worst ceil(1% of frame-time samples))**, and the number of frames over 100 ms per 1,000 frames. They are advisory metrics, not added release blockers. It flags a greater-than-10% drop in that 1% low measure or additional normalized long stalls for review. These conventions should not be silently compared to a different overlay's similarly named FPS metric.

## Project evidence interface, version 1

`evaluateReleaseEvidence(evidence)` is pure and returns a report; it never reads `evidenceRef`, fetches a URL or modifies files. All names below are **project fields**, not claims about native MW5 telemetry/API names. Numbers require actual finite numeric values; strings such as `"1500"`, nulls, NaN, infinities, negative amounts and empty timing arrays are rejected. Byte counts must be nonnegative safe integers.

Top level:

```json
{
  "version": 1,
  "currentConfigHash": "<64 hexadecimal SHA-256 characters>",
  "records": [],
  "calibrationSessions": [],
  "styleHeldOutDecisions": [],
  "voiceRecordings": [],
  "conversationSamples": [],
  "enduranceSessions": [],
  "offlineWorkloads": []
}
```

Every entry in these arrays has `provenance` (`GAME_OBSERVED` or `MOCK_ONLY`), `sessionId`, `configHash` equal to the current hash, and a nonempty `evidenceRef` pointing to inspectable source evidence. Record editor experiments elsewhere: `EDITOR_ONLY` cannot meet this shipping-game release schema. Distinct sessions must not reuse IDs. Multiple decisions/recordings within one legitimate session may share its session ID while keeping their own item IDs unique.

| Array | Additional required fields |
|---|---|
| `records` | `scenarioId` C01-C12; integer `rep` 1-3; `mode` vanilla/tactical/direct; boolean `missionSuccess`; integer `lanceLosses` 0-3; nonnegative `damageDealt`, `damageTaken`; nonempty `frameTimesMs` array. Tactical/direct records additionally need `resources`. All 108 run session IDs must be distinct. |
| `calibrationSessions` | Common fields; unique session IDs. These identify where the style profile was adjusted, not weight training. |
| `styleHeldOutDecisions` | Unique `decisionId`; boolean `acceptable`; `userReviewed: true`; a session outside every calibration session. |
| `voiceRecordings` | Unique `recordingId`; booleans `intentCorrect`, `recipientCorrect`, `dispatchAttempted`; nonnegative `finalTranscriptMs`. If dispatched, boolean `dispatchRecipientCorrect` is mandatory and must be true. |
| `conversationSamples` | Unique `sampleId`; nonnegative `firstAudioMs`; booleans `grounded`, `speakerCorrect`, both true for acceptance. |
| `enduranceSessions` | Nonnegative `durationMs`; integer `controlledAiCount: 3`; `allThreeActiveThroughout: true`; `noCrash: true`; integer `humanOverrideFailures: 0`, `wrongRecipientCommands: 0`; `resources`. |
| `offlineWorkloads` | `networkDisconnected: true`; `allComponentsLocal: true`; `workloadCompleted: true`; integer `paidApiCalls: 0`. |

`resources` is `{minAvailableRamBytes, minAvailableVramBytes}` with observed byte minima. Keep raw resource traces and capture scope in `evidenceRef`; these two numbers do not prove the traces are complete.

Each gate returns `status`, `accepted`, `requiredCount`, `suppliedCount`, `observedCount`, `mockCount`, `issues`, `failures` and calculated `metrics`. The overall report has `schemaIssues` and `criticalReview` as well:

- **NOT_PERFORMED:** an empty valid envelope/gate has no observations.
- **INCOMPLETE:** missing coverage, malformed values, mixed provenance, unknown/changed configuration or unresolved calculation; acceptance is false.
- **MOCK_ONLY:** supplied complete-format synthetic evidence can exercise metrics, but acceptance is always false. Threshold failures remain visible in its `failures` list.
- **FAIL:** a fully observed, well-formed gate violates a required threshold. Other missing gates remain individually visible.
- **PASS:** all required fields/coverage/calculations meet the supplied-evidence contract. This is conditional on independent inspection of authenticity, correct actors, representative captures and experiment comparability. It is not an installation permission, native-control proof or certification of unrecorded scenarios.

Never construct observations from the desired threshold values. The benchmark does not derive observations from simulation, default assets, spoken acknowledgements or source-code availability. Human override, actor binding and native acceptance still require the separate controlled integration tests.

## Running only the offline checker tests

From the project root, `node --test companion/tests/benchmark.test.mjs` runs project-owned code using built-in modules. The suite checks missing and mock evidence, duplicates, configuration drift, nonfinite values, exact thresholds, aggregation differences, percentile tails, leakage, storage and purity. No game, microphone, model or network is accessed. These tests establish validator behavior only.
