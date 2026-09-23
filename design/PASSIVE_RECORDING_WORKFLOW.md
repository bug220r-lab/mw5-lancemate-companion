# Passive mission recordings: preparation and offline inspection

September 23, 2026. **OFFLINE TOOLS ONLY; native recorder and real-mission acceptance NOT_PERFORMED.** The active observer-first goal is not complete. The [authoring decision](../research/OBSERVER_AUTHORING_ROUTE_DECISION.md) identifies one working-editor-UI authoring session as the next dependency. The [manual recipe](OBSERVER_MINIMAL_AUTHORING_RECIPE.md) creates a minimal positive creation probe, not a recorder.

## What exists now

`scripts/Inspect-MissionRecording.mjs` reads a local JSON array of the existing project observation envelopes and checks format, sequence order, timestamps and mission boundaries. It sends the complete array, in original order, through `companion/observation.mjs` for historical-clock tactical replay. It never sends a command or accesses the game, models, microphone or network.

Paused, empty-roster and uncertain-authority samples can be valid capture envelopes while remaining unsuitable for tactical decisions. The report therefore separates **VALID_PROJECT_ENVELOPES** from replay eligibility and native acceptance. A successful exit code means only that the inspected envelope sequence passed these file checks. It does not mean the observer, positions, identities, lifecycle or gameplay were verified.

The file reader does not rewrite input. Its SHA-256 binds the report to the exact original bytes. Keep that file unchanged; store corrections and annotations separately. Unknown extension data remains in the original file and is not automatically interpreted or certified. No native field-to-project mapping is implemented by this checker.

The checker accepts at most 32 MiB, 20,000 frames, 128 KiB per serialized frame and 128 mission sessions. Deep/large structures are rejected before replay. Detailed findings are capped at 200, with total/truncation information preserved. These are project file limits, not native capture-buffer limits or performance results.

## Inspect a file

From the project folder, using the installed Node runtime:

```powershell
& 'C:\Users\jlewi\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' scripts/Inspect-MissionRecording.mjs 'companion/local/recordings/capture.json'
```

For the explicitly synthetic example only, add `--allow-synthetic`:

```powershell
& 'C:\Users\jlewi\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' scripts/Inspect-MissionRecording.mjs 'synthetic/passive-recording-example.json' --allow-synthetic
```

The output is a JSON report on standard output. The tool does not automatically write a report, move the recording, contact GitHub or upload gameplay. Keep real recordings and annotations under the excluded `companion/local/recordings/` folder when a collector exists. The synthetic example is preparation evidence only and must never be substituted for the goal's required real recording.

The default nominal interval is the proposed 500 ms. Actual minimum, median, p95 and maximum intervals are measured between adjacent valid envelopes of the same stream. A single sample has no measured interval. Invalid entries break timing adjacency. Long intervals may represent pause, loading, scheduling delay or lost capture; sequence gaps identify unaccounted sequence numbers, not their cause. No missing sample is invented, interpolated or relabeled as zero movement. Observation-clock units and pause behavior must be established in the actual producer before these values can describe game timing.

## Capture readiness: all still pending

Before a real test, the concrete package must supply its actual asset/cooked hashes, mod mount, supported game/editor builds, installation manifest and removal procedure. Confirm the isolated stock Instant Action configuration and unchanged baseline. Establish sampling clock, timestamp units, identifier generation, source-backed field mapping, bounded buffer and supported export path. Keep unavailable state explicitly unknown.

The current tool supplies no in-game Start, Stop or Export control. Those instructions cannot be completed until the executable assets and export mechanism are built and proven. Do not install the source-only workbench or the minimal overlay as though it were a mission recorder.

## First isolated recording checklist

Use this only after the above package and test are ready and deployment is authorized. Record independent visible evidence alongside the observer data, with a documented way to align their clocks. The observer's own readout cannot independently validate its own identities.

1. Record game/mod versions, exact Instant Action mission and loadouts, and the independently visible player plus three lancemates. Note any identity that cannot be independently matched.
2. Establish the baseline frame-time/resource measurement and observer-off behavior. Then record the prepared passive package's identity and start time.
3. Observe ordinary movement with all three AI present. Record which displayed pilot/mech corresponds to each claimed actor/controller/pawn binding; slot number alone is not proof of stable identity.
4. Let the player issue a normal order. Annotate the visible recipient and action. Treat job changes as job changes; they do not prove human-input provenance or completion.
5. Pause and resume. Record whether samples continue, stop or use a paused clock. Account for the gap without inventing lost samples or resumed orders.
6. Perform a normal player mech swap. Independently match the newly possessed mech and the former player mech. Verify that bindings and ownership change correctly; do not assume a controller-owned component must be recreated for every pawn change.
7. Exit the mission and enter a new isolated mission. Confirm a fresh session, no surviving stale bindings, and exactly one intended observer through independent evidence. A vanished overlay alone does not establish teardown.
8. Stop using the implemented capture control, export with the proven mechanism, and preserve the original bytes. Inspect the file and annotate invalid samples, gaps and unknowns even if the mission otherwise appeared normal.
9. Run the manifest-driven removal procedure, compare against the recorded baseline, and retain the removal evidence. Until tested, removal is NOT_PERFORMED.

Stop the test if there is a crash, unexplained growth/stall, wrong actor mapping, duplicate observer, unintended input/AI behavior, main-campaign access or unclear rollback. Preserve evidence rather than continue to automatic tactics.

## Independent annotation and acceptance

Copy `synthetic/passive-recording-annotation-template.json` into the local recording folder. Fill in the actual recording hash, observer build, clock alignment, independent evidence and checks. Its blank entries and NOT_PERFORMED status are deliberate. Do not set a check to verified based solely on the recording asserting a value.

Each identity/transition finding should cite the recording frame index plus independently visible evidence time or image reference, the expected observation, what actually happened, and any remaining uncertainty. Keep human-order evidence separate from native assignment and behavior. A report or reviewer label is not automated acceptance.

Goal completion additionally needs a real export, source-supported player/all-three observations including positions and available AI state, independently validated lifecycle behavior, measured timing/overhead and verified installation/removal. None is supplied by this synthetic example or the file checker.
