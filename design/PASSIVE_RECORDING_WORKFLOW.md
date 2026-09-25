# Passive mission recordings: preparation and offline inspection

Updated September 25, 2026. **OFFLINE RECORDING TOOLS ONLY; native recorder and real-mission recording acceptance NOT_PERFORMED.** The active observer-first goal is not complete. The three assets in the [manual recipe](OBSERVER_MINIMAL_AUTHORING_RECIPE.md) have been authored and [cooked locally](../research/OBSERVER_PACKAGE_RESULT_2026-09-25.md) as a minimal creation probe, not a recorder. In the [first retail observation](../research/OBSERVER_STARTUP_RESULT_2026-09-25.md), its readout was not visible; component creation remains inconclusive.

## What exists now

`scripts/Inspect-MissionRecording.mjs` reads a local JSON array of the existing project observation envelopes and checks format, sequence order, timestamps and mission boundaries. It sends the complete array, in original order, through `companion/observation.mjs` for historical-clock tactical replay. It never sends a command or accesses the game, models, microphone or network.

**PROPOSED raw-capture lane, added September 25:** `scripts/Inspect-PassiveCapture.mjs` checks a separate JSON array of `passive-capture` samples before any native collector exists. Each sample has `schemaVersion: 1`, `kind: "passive-capture"`, `provenance`, `producerId`, `session`, `sequence`, `observedAtMs` and `readings`. A reading carries a key from the nineteen candidates in [the source field map](PASSIVE_CAPTURE_FIELD_MAP.json), a project-asserted `subjectRole` and `bindingId`, an acquisition `status`, and a `value` only when acquired. `subjectRole` is the object the result pertains to; the checker restricts each key to roles consistent with the source-map use. `VALUE` requires a non-null JSON value; `NULL_RELATION` requires explicit null and is reserved for relationships. Successful non-world reads need a claimed binding ID. `INVALID_OBJECT`, `UNSUPPORTED_READ`, `READ_FAILED`, `NOT_ATTEMPTED` and `TRUNCATED` omit `value`; `TRUNCATED` is reserved for the AI inventory and requires a separate integer `observedCount` greater than three. If the count is unknown, report an unavailable read instead. An omitted reading remains unreported; it is not silently relabeled as a failed or unattempted read. These names and roles are project metadata, not verified MW5 enums or object identities.

Run the synthetic example with `node scripts/Inspect-PassiveCapture.mjs synthetic/passive-capture-example.json --allow-synthetic`. Without `--allow-synthetic`, mock samples fail format admission. The CLI exits 0 for valid **project format** only, 1 for invalid format and 2 for usage/read errors. The report hashes the exact source bytes and the exact field-map bytes, checks bounded structure, session changes, sequences, reported-clock intervals and status counts. Its three-AI binding count requires an acquired `VALUE` or `NULL_RELATION` reading for each asserted AI binding; a separate mentioned-binding count includes failed or unattempted reads and is not coverage. An asserted pawn appearing in both player and AI roles during a non-atomic transition is reported as ambiguous, not rejected as a malformed file. `GAME_OBSERVED` remains `GAME_OBSERVED_UNVALIDATED`; no native identity, clock calibration, complete roster, gameplay or tactical eligibility is certified. The raw checker never calls policy replay or converts native values into authority, units, orders or AI ownership. The original input stays unchanged, including extra fields the checker does not interpret.

Before sample interpretation, the proposed raw-capture audit rejects duplicate JSON object member names anywhere in the input, including names that decode to the same name through JSON escapes. Last-wins parsing could otherwise hide provenance, binding claims or an explicit failed read. This is an offline format check exercised with `MOCK_ONLY` data; it does not verify a native recorder or game observation.

`reviewEvents` gives a bounded index, session and sequence for submitted session changes, truncated AI inventories, sequence gaps/regressions and reported-clock regressions. A session-change event belongs only to the valid sample that actually changes the submitted session; an invalid transition sample does not pass its event to a later sample. It also marks changed **asserted** pause, area-loading and player-pawn-role bindings only between adjacent valid samples in the same producer/session, with increasing sequence and nonregressing reported clock. Each compared sample must have exactly one acquired `VALUE` reading for the relevant Boolean field, with matching subject bindings, or exactly one acquired player-pawn-role binding for that change event. Multiple claimed pause or area-loading values are ambiguous and produce no flip event regardless of reading order. An absent or invalid sample, including a cross-role binding collision or sequence/clock regression, breaks state comparison; diagnostic regression events themselves remain indexed. Existing aggregate sequence/clock counts retain their original rules. At most 200 event details are emitted; `reviewEventCount` and `reviewEventsOmitted` retain the total. These are review pointers to unverified producer claims, not independently observed game transitions or proof of mission state, identity, authority or missed sampling attempts.

`acquisitionExceptions` separately locates explicit `INVALID_OBJECT`, `UNSUPPORTED_READ`, `READ_FAILED`, `NOT_ATTEMPTED` and `TRUNCATED` readings by sample index, session, sequence, reading index, key, subject role and asserted binding ID. It indexes only samples that pass the auditor's valid-sample review gate. `NULL_RELATION` is a successfully obtained null relationship and is not an acquisition exception; omitted readings are not assigned a status. The first 200 details are retained, with `acquisitionExceptionCount` and `acquisitionExceptionsOmitted` preserving the total. These locations contain no raw values and help annotate failed or incomplete producer claims; they do not validate native acquisition. A truncated roster also has a separate `reviewEvents` pointer, without changing its one status count.

The raw-capture auditor reports **VALID_PROJECT_CAPTURE** when its proposed file format passes. Separately, paused, empty-roster and uncertain-authority samples can be valid tactical observation envelopes while remaining unsuitable for tactical decisions; the older recording checker reports **VALID_PROJECT_ENVELOPES** separately from replay eligibility and native acceptance. A successful exit code from either checker means only that its own project file checks passed. It does not mean the observer, positions, identities, lifecycle or gameplay were verified.

The file reader does not rewrite input. Its SHA-256 binds the report to the exact original bytes. Keep that file unchanged; store corrections and annotations separately. Unknown extension data remains in the original file and is not automatically interpreted or certified. No native field-to-project mapping is implemented by this checker.

The checker accepts at most 32 MiB, 20,000 frames, 128 KiB per original serialized sample span and 128 mission sessions. Each span includes whitespace adjacent to the sample inside the outer JSON array; the limit is measured before JSON formatting or escapes can be normalized. Deep/large structures are rejected before replay. Detailed findings are capped at 200, with total/truncation information preserved. These are project file limits, not native capture-buffer limits or performance results.

## Inspect a file

From the project folder, using the installed Node runtime:

```powershell
node scripts/Inspect-MissionRecording.mjs 'companion/local/recordings/capture.json'
```

For the explicitly synthetic example only, add `--allow-synthetic`:

```powershell
node scripts/Inspect-MissionRecording.mjs 'synthetic/passive-recording-example.json' --allow-synthetic
```

The output is a JSON report on standard output. The tool does not automatically write a report, move the recording, contact GitHub or upload gameplay. Keep real recordings and annotations under the excluded `companion/local/recordings/` folder when a collector exists. The synthetic example is preparation evidence only and must never be substituted for the goal's required real recording.

The default nominal interval is the proposed 500 ms. Actual minimum, median, p95 and maximum intervals are measured between adjacent valid envelopes of the same stream. A single sample has no measured interval. Invalid entries break timing adjacency. Long intervals may represent pause, loading, scheduling delay or lost capture; sequence gaps identify unaccounted sequence numbers, not their cause. No missing sample is invented, interpolated or relabeled as zero movement. Observation-clock units and pause behavior must be established in the actual producer before these values can describe game timing.

## Native capture readiness: still pending

The [creation probe package](../research/OBSERVER_PACKAGE_RESULT_2026-09-25.md) now supplies cooked hashes and a PAK mount. Its first retail observation did not show the readout and did not prove component creation. Before a real recording test, a separate native recorder package still needs actual artifact hashes, supported game/editor builds, an installation manifest and removal procedure. Confirm the isolated stock Instant Action configuration and unchanged baseline. Establish sampling clock, timestamp units, identifier generation, source-backed field mapping, bounded buffer and supported export path. Keep unavailable state explicitly unknown.

The current tool supplies no in-game Start, Stop or Export control. Those instructions cannot be completed until the executable assets and export mechanism are built and proven. Do not install the source-only workbench or the minimal overlay as though it were a mission recorder.

The [passive-capture field map](PASSIVE_CAPTURE_FIELD_MAP.json) pins nineteen read candidates to the existing API export and distinguishes raw player/AI/worker/job observations from control-policy fields. Its declaration checks and independent source review are recorded in `research/PASSIVE_CAPTURE_FIELD_REVIEW.json`. No row is a verified shipping-game read; clock, object identity and serialization still require an actual producer.

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
