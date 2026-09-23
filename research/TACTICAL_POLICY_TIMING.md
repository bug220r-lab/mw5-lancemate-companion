# Existing tactical rules: bounded offline timing

September 23, 2026 UTC. **OBSERVED local JavaScript timing on MOCK_ONLY scenarios; native/game/end-to-end performance NOT_PERFORMED.** The tactical coordinator is already deterministic code, so it can select recommendations without waiting for a language model. The measured decision function is small compared with the recorded multi-second conversation generations. This does not yet supply real game observations or execute a command.

## What is already implemented

`scripts/tactical-policy.mjs`, policy **1.0.1**, exports the pure `decideSquad(snapshot, previousState)` function. It validates identity, state freshness and authority; preserves human-order precedence and persistent/unknown holds; rejects unsafe possession/identity changes; protects damaged units using supplied safe options; accounts for heat/ammunition/range; regroups isolated units when prerequisites exist; selects known hostile targets; retains useful targets to avoid small-change churn; and coordinates target assignments and position reservations across up to three actors.

Its output vocabulary is `MAINTAIN`, `REGROUP`, `FOCUS`, `REPOSITION` and `DEFER`, with reasons and evidence references. All outputs remain **MOCK_ONLY** and **`dispatchable: false`**. These are project recommendations, not proved MW5 commands, learned human competence, a complete combat controller or direct aiming/firing.

`synthetic/tactical-cases.mjs` contains 48 scenarios and 59 ordered snapshot steps. `companion/tests/policy-regression.test.mjs` adds unknown-persistence/order-hold checks and wraps the existing 48-scenario/31-adversarial-case runners with an in-memory receipt sink. That wrapper was inspected, not rerun for this timing task. No historical test receipt was overwritten.

## One measured sample

The predeclared workload was one complete warm-up pass, followed by **50 repetitions** of the existing scenario list. State starts at null for each scenario and flows through only that scenario's ordered steps. The measured interval surrounds only the actual `decideSquad` call; input creation, assertions and filesystem operations are outside that interval. Per-call time is elapsed wall time and can include scheduling interruptions, not isolated CPU cycles.

| Population | Measured calls | p50 | p95 | Maximum |
|---|---:|---:|---:|---:|
| All existing snapshot steps | 2,950 | 0.0043 ms | 0.0225 ms | 0.3798 ms |
| Three-recipient snapshots | 150 | 0.0126 ms | 0.0381 ms | 0.2096 ms |

Quantiles use nearest rank, with no outlier removal. The complete warm-up/measured loop plus checks took **43.3849 ms**, below its cooperative **2,000-ms work guard**. Summed measured function time was **22.7324 ms**. Process CPU usage for the broader loop, including warm-up and assertions, was **32 ms user / 0 ms system**; that aggregate must not be represented as a separate policy-only CPU measurement.

This ran once on **Node.js v24.19.0, Windows x64, Intel Core i7-10750H**, with 12 logical CPUs and about 15.82 GiB physical RAM. The function runs synchronously in one Node process; the logical CPU count does not mean twelve-way policy parallelism. Host load, scheduler, JIT/GC, power and thermal state were not controlled. Repetition warms tiny fixture data and code. The pooled set includes quick rejection paths, and only three scenario shapes contain three recipients. The two-recipient fixture is a duplicate-identity rejection; its shorter timing does not indicate better multi-actor performance.

Every invocation's existing expected action list and optional target IDs matched; outputs remained non-dispatchable and synthetic. Fixture objects were unchanged. This was not a new full correctness or adversarial-suite run. The raw small receipt is [TACTICAL_POLICY_TIMING.json](TACTICAL_POLICY_TIMING.json); it records counts, timing method, hardware, action totals, source hashes and unchanged historical receipt hashes. No native engine, model, game/editor, network or persistent policy state was used.

## Practical implication and remaining work

Use this deterministic policy for supported tactical decisions, then let conversation explain the decision asynchronously. Speech or model latency need not block the policy calculation. Expanding evidence-backed tactical rules can likewise stay outside the language-model path; this is not a proposal to relabel canned dialogue as full conversation.

The remaining latency and correctness questions are **obtaining fresh native observations, maintaining exact actor/control ownership, detecting human input, transporting decisions, proving each native action and independently observing its result**. The existing observer work still owns that integration. Weapon ranges, safe routes and threat values in these fixtures are supplied data, not automatically available or verified MW5 telemetry. A sub-millisecond offline calculation cannot establish native action response time, frame-rate overhead, game-loaded memory headroom, real-time direct piloting or gameplay improvement. No live adapter or capability was enabled by this measurement.

Source pins for this sample:

- Policy: `4b6712af3804f4a6613d1a36cbb1be3d00801b143aae7bcc1981339aec19784e`.
- Scenarios: `157853194cdf0ac76a3193c2bac2887f12e0b824fd0fd843735cffa61496e685`.
- Regression wrapper: `1ae2b7c17926456b262c99063c98a162ba9966d8f38fbd20c1064d29d1ae5e5f`.

The pending larger-batch model experiment and its frozen answer-review commitment are separate and were untouched.
