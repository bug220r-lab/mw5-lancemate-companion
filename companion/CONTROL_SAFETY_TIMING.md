# Supplied control-safety timing evidence, version 1

This pure checker evaluates project evidence records. It performs no capture, file access, native call, control write or authenticity check. Its scope is always `SUPPLIED_EVIDENCE_ONLY`, and `nativeRuntimeVerified` is always `false`. Even `GAME_OBSERVED` is a supplied assertion. A JSON confirmation, binding or hash is not proof that native control was restored.

The source requirement is [FULL_MOD_DELIVERY.md](../design/FULL_MOD_DELIVERY.md), line 72: initial restoration target **150 ms after detecting invalid control/observations**, with **complete human-override latency measured separately**. The implementation introduces no human-yield timing threshold, sample quota or percentile requirement. The existing release checker and its schema are unchanged.

## Use

Import `evaluateControlSafetyTimingEvidence` from `companion/control-safety-timing.mjs` and pass a plain data envelope. It returns a new report and does not mutate its input. From the repository root, run the synthetic tests with:

```powershell
node --test companion/tests/control-safety-timing.test.mjs
```

The module uses only Node's built-in `node:util` for proxy detection. No native engine, listener or service is started.

## Envelope and paired event claims

The envelope has exactly these fields. Either measurement collection may be omitted to report that part as `NOT_PERFORMED`.

```json
{
  "version": 1,
  "currentConfigHash": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "restorationObservations": [],
  "humanYieldObservations": []
}
```

Each restoration measurement has `measurementId`, `detection`, and `restoration`. Each human-yield measurement has `measurementId`, `humanInput`, and `completeYield`. Measurement IDs are globally unique across both collections. These are project report names, not native MW5 events or API fields.

Both endpoints have this event shape; only the ending endpoint has `confirmation`:

```json
{
  "provenance": "MOCK_ONLY",
  "configHash": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "sessionId": "mission1",
  "clockId": "capture1",
  "binding": {
    "actorId": "alpha",
    "controllerId": "controller1",
    "pawnId": "pawn1",
    "generation": 1
  },
  "atMs": 1000,
  "evidenceRef": "synthetic-fixture.md#trace",
  "confirmation": "CONFIRMED"
}
```

Use the same supplied configuration, provenance, mission, clock domain and exact actor/controller/pawn/generation binding at both endpoints. Configuration hashes are 64 hexadecimal digits and compared without case sensitivity. IDs use the existing project convention: 1–64 ASCII letters, digits, `_` or `-`, excluding `__proto__`, `constructor` and `prototype`. Generation is a positive safe integer. `evidenceRef` is a nonblank, inspectable reference of at most 512 characters without control characters. Several event records may refer to the same document; references need not be unique.

Bindings identify the subject whose control was being restored or yielded. A timestamp on a new pawn, controller, generation or mission cannot substitute for confirmation about the original subject. The acquisition/review process must establish attribution; this checker cannot infer it through a possession or mission change.

Timestamps follow the existing project observation convention: nonnegative safe integers in **whole milliseconds**, on one declared monotonic clock. The ending timestamp must be at least the starting timestamp. Fractional values are rejected, never rounded. A clock ID is an assertion, not evidence of its monotonicity, accuracy or resolution. Independent source review must establish those properties. The checker does not compare a monotonic timestamp with wall time, and cannot detect a fabricated future timestamp from the pair alone.

- `detection.atMs`: when invalid control/observations were detected, not when the original fault began.
- `restoration.atMs`, `CONFIRMED`: when restoration was independently confirmed for that subject, not merely when a request was sent or a callback was scheduled.
- `humanInput.atMs`: attributable human input marking the start of the complete human-override interval.
- `completeYield.atMs`, `CONFIRMED`: when complete yielding was confirmed for the affected subject. This interval stays separate from detection-to-restoration timing.

Both endpoints require references supporting their event meaning, identity, configuration and time. No reference is opened or authenticated by this function. Neither a function return, brain flag, stop request, supplied `true`, nor sampling frequency alone proves restoration or complete yielding.

Ending `confirmation` is one of:

- `CONFIRMED`: derive `latencyMs = end.atMs - start.atMs` after the pair validates.
- `UNKNOWN` or `NOT_PERFORMED`: incomplete measurement, with no derived latency.
- `FAILED`: preserve an explicit supplied failure, with no invented completion latency. Its `atMs` denotes the failure observation, not a confirmed completion.

Missing endpoints, fields, references or confirmation remain incomplete. A supplied `latencyMs`, threshold override or unknown field is rejected. No actuator values, ownership token, native input format or capture mechanism are defined here.

## Report meaning

Each section reports individual intervals, minimum/maximum and counts. No minimum sample count or statistical reliability is asserted.

- Restoration `PASS` means all supplied observed pairs validate and each confirmed interval is **at most 150 ms**. Above-target intervals or explicit failures produce `FAIL`.
- Human yield `RECORDED` means the supplied observed pairs validate and complete yielding was confirmed. Its timing is descriptive: `targetMs` and `withinTarget` stay `null`. A long interval does not acquire an invented numerical failure threshold. An explicit failed yield remains a failure.
- Valid empty sections are `NOT_PERFORMED`; malformed/unknown pairs are `INCOMPLETE`.
- Entirely synthetic sections remain `MOCK_ONLY`, even if their numbers meet the target. Known failures remain visible in `failures`.
- Mixed observed/mock claims are `INCOMPLETE`; they cannot be pooled into an observed pass.

The combined `PASS` requires a restoration supplied-evidence pass and recorded human-yield data. It means neither native runtime acceptance nor sufficient test coverage. A missing observed section makes the combined report incomplete; each section retains its own result. Incompleteness takes precedence over failure in the status, while failure details remain visible. A wholly synthetic report remains `MOCK_ONLY`; a valid empty report remains `NOT_PERFORMED`.

Admission has technical bounds: 2,048 measurements per collection, plain/null-prototype objects with at most 16 own keys, ordinary dense arrays, 16 nesting levels, 100,000 data nodes, individual strings at most 1,024 UTF-16 units and 8 Mi UTF-16 units in total. These are memory bounds, not sampling acceptance requirements. Accessors, proxies, cycles, executable values and non-data properties are rejected without invoking property getters or serialization hooks.

## Remaining native work

An actual observer/adapter must acquire trustworthy event attribution, continuous clock values, exact bindings and independently confirmed restoration/yielding. Writer exclusion, safe restoration, acquisition overhead, the measured 150 ms result, complete human-override latency and Direct Pilot acceptance remain unproven. This tool cannot resolve the M6 ownership or M7 control-loop dependencies.

Source basis: `design/FULL_MOD_DELIVERY.md:27–33,55–57,63,72`; `companion/observation.mjs:5–7,91–95` (identity/time and supplied provenance); `companion/benchmark.mjs:74–81,131–146` (configuration/reference and supplied-evidence status conventions); `design/TACTICAL_EVALUATION_PROTOCOL.md:99–101` (independent source review); `design/WORKBENCH_RESOURCE_POLICY.md:9` (local resource monitoring is separate from native restoration acceptance).
