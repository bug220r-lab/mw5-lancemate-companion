# Independent workbench resource-policy review

Reviewed 2026-09-22. **PASS_MOCK_ONLY: 31/31 independent checks.** This reviews the resident language/speech startup policy and its workbench integration using injected resource readings, fake engines, controlled promises and timers. It does not establish physical memory capacity, peak use, native shutdown or performance under gameplay load.

No real model, microphone, speaker, editor or game was started. No machine-memory/disk measurements were used by these tests. Temporary settings locations contained synthetic data only and were removed after containment checks. Native resource-pressure and combined game/model tests remain **NOT_PERFORMED**.

## Reviewed artifacts

| Artifact | SHA-256 |
|---|---|
| `companion/workbench-resources.mjs` | `f912ddbb9a34c1ca6f7ffcfd122d4a6d3084f81b0155962ffe015cc7b8ea7289` |
| `companion/server.mjs` | `f6c4230e8de0db06dc40e7b466e6fa287550092d70eff46c092ccbcb1d760a0f` |
| `companion/tests/workbench-resources-review.test.mjs` | `56a72b12c8976fbcafea9838550af2eb6e7f118b7c8171dd513ed3de233a9bb0` |

The independent reviewer owns only [the review tests](../companion/tests/workbench-resources-review.test.mjs) and this report. Implementation fixes were made by the implementation author. Evidence applies to these artifact identities; a later functional change requires renewed review.

## Executed checks

Command: `node --test companion/tests/workbench-resources-review.test.mjs`.

| Boundary | Independent result |
|---|---|
| Cold construction | Creating or reading the policy/workbench makes no admission request, starts no monitor, and starts no engine. |
| Startup admission | A fresh admission precedes each resident engine. Disk is sampled before fresh RAM. Exactly 5 GiB available RAM and 10 GiB working-disk space passes; one byte below either floor rejects. |
| Unknown readings | Nonfinite, negative, missing, string or unsafe RAM values fail closed. Missing/invalid disk fields and multiplication overflow cannot become usable capacity. |
| Admission cancellation | Stop/abort settles the public request while unresolved underlying I/O remains owned. A late successful read cannot start an engine or publish an accepted sample. |
| Startup lifecycle | A cancelled pending language start is reaped if it finishes late; it cannot start the successor speech engine. Language readiness alone does not permit generation while the second admission remains unfinished. |
| Sampling ownership | Watch and admission reads do not overlap. Healthy pending watch sampling is visible as sampling, without being mislabeled cleanup. Cancellation and timeout retain draining ownership. |
| Watchdog limits | Exactly 2 GiB available RAM remains eligible; below the floor causes one breach and stops polling. Unknown readings also stop monitoring. A hung read gets one deadline, does not overlap another read, and cannot silently restart monitoring after timing out. |
| Resident cancellation | A breach cancels pending generation, synthesis and PTT. Late text/audio results cannot publish. Fake owned resident engines and recognition receive stop requests. |
| Human precedence | Watchdog cancellation leaves the synthetic control state, including a human hold, unchanged; native call count stays zero. |
| Repeated Start | Starting again after both engines reach READY preserves a working watchdog. During healthy unresolved admission, a duplicate returns `STARTING_LOCAL_MODELS`, reuses one startup/admission and starts each engine only once; its watchdog still works. Cancelled/draining startup remains rejected. The injected policy intentionally mirrors the real helper's idempotent `startWatch` behavior. |
| Unconfirmed shutdown | A fulfilled stop promise that still reports an owned process is not successful cleanup. A stop that exceeds its public deadline keeps cleanup ownership and blocks replacement starts. |
| Restart | Late shutdown completion does not restart engines. A new explicit start is required after ownership drains. |

The default policy records a 250 ms watch interval and a 2,000 ms resource-sample deadline. The independent module tests use controlled timers; one integration case uses a short injected public stop deadline with fake workers. These are lifecycle checks, not measured scheduling or native stop latencies.

## Findings and review history

No unresolved implementation defect was found by the final independent suite. Parallel source review identified two issues before the corresponding independent cases ran: healthy sampling was initially exposed as cleanup, and a repeated completed Start could retain a watch callback tied to an old startup epoch. The implementation author corrected both, and the independent cases now verify the intended behavior. This report does not claim a pre-fix executable reproduction for those source findings.

The frozen-source check also inspected the updated active-worker predicate: explicit ownership flags or a PID retain watchdog eligibility even when an engine reports `FAILED`. The initial independent suite passed 30/30. That result did not cover duplicate Start during unresolved admission.

The root reviewer subsequently observed a real compatibility regression in the full suite: **627 total / 626 passed / 1 failed**, preserved in [COMPANION_VALIDATION_RESOURCE_FAILURE.json](COMPANION_VALIDATION_RESOURCE_FAILURE.json), SHA-256 `7b98cbe1984e728fb932167c9b5a4435a3d34b637a642576f3ad05278a7e9d67`. A separate root-run focused conversation suite reproduced **29 total / 28 passed / 1 failed**: a duplicate `models_start` during healthy pending startup threw `LOCAL_MODEL_CLEANUP_PENDING` instead of retaining the prior idempotent behavior. The bounded full-suite receipt tail omits that failed case; the focused diagnosis is root-observed evidence, not an initial failure reproduced by this independent suite.

The implementation author restored idempotent handling for healthy pending startup while preserving rejection of cancelled/draining work. This reviewer added the unresolved-admission duplicate case, including the truthful `STARTING_LOCAL_MODELS` label, and strengthened cancellation coverage to ensure a duplicate stays blocked after abort. The revised independent suite passes **31/31** against the final artifact hashes above. The implementation author's tests, root browser cases and root full-suite rerun are separate receipts, not part of this 31-case count.

The first independent run had one test-fixture error: passing `undefined` to the fixture selected its default RAM value. The fixture was corrected to explicitly supply an undefined reading; the policy rejects it. This was a harness correction, separate from the subsequently root-observed duplicate-Start product regression.

## Limits

These floors are conservative admission and shutdown policy values, not a reservation or capacity proof. Another process can consume RAM between samples; synchronous execution and operating-system delays can postpone polling or cleanup. Disk is checked on admission; the watchdog's continuing floor applies to RAM. GPU/VRAM, real engine peaks, pagefile behavior, combined game/editor/model load and real worker termination remain unmeasured here. A timeout never proves a worker or pending I/O operation stopped.

The stop and cancellation checks establish behavior of the shipped coordination code against injected engine contracts. Real engines, process ownership, and recovery must still be validated through separately bounded native tests before claiming resource safety under actual load.
