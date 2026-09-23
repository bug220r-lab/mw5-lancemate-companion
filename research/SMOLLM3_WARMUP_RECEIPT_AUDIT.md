# SmolLM3 warm-up receipt integrity audit

September 23, 2026 UTC / September 22 local. **PASS for source/input/accounting consistency; native diagnostic INCOMPLETE.** This audit does not grade the returned text. The auditor started no model, game, editor or audio process and changed only this report.

The [warm-up receipt](SMOLLM3_WARMUP_DIAGNOSTIC.json), SHA-256 `ce3a0cd8238b4081433a4837782587bf35fc671e81f04251fc6d56e8dc392327`, records a completed discarded primer, one completed fresh response, then a second fresh response that exhausted its unchanged ten-second deadline. The other 24 cases were not invoked.

## Input and source parity

An independent read-only Node check rehashed **all 30 source pins** with no mismatch. Inert preparation rebuilt the warm-up plan and compared all **27 prepared records**—primer plus 26 cases—to both this receipt and the first SmolLM3 receipt. Original/current contexts, projection audits, complete ordered role/content messages and character counts matched exactly; each case also retained its ID, suite, capture and provenance. Both fixtures, predecessor and treatment matched preparation. No case criterion or actual response was added to a later input.

The first eight cases remain the predeclared direct-synthetic suite; the next eighteen remain historical exposed regressions. Invocation accounting is **two fresh invoked, six fresh uninvoked, eighteen historical cases uninvoked**. The second fresh case is a failed operation, not a returned answer. `notPerformed` exactly equals the ordered IDs from case three onward. Unperformed records retain null output, finish reason and timings, with no semantic judgment, dispatch or playback.

The executed runner is `30adddbdbb62692faeb7dd568ce5b0dd312ecfa76a6aba65235993e25602b72c`. Reading the Git blob at `afb5c7c1cc5f9552622e8f3770363098f39d71cd` independently recovered the exact first-run source hash `fd3ae7557d85ee733244c6759a178c2595791283ae4ce55e73e36103592de663`; no line-ending reconstruction was needed. The predecessor receipt remains `ffd7341cf63f55d4994c3ddecc06eba5421f1c19e014c2365d0236928f5959ff`. All sixteen archived `research/QWEN*.json` and `research/SMOLLM3*.json` files present in that commit still match their original bytes.

Installation validation again matched the linked VERIFIED_DOWNLOAD setup, SmolLM3/GGUF-v3 metadata and template SHA. Model pins, runtime pins and effective native settings equal the first run. Removing the newly recorded `primerMs: 20000` field from this receipt's settings leaves the first receipt's settings exactly. The primer's configured budget is 20,000 ms; every case's configured budget remains 10,000 ms. CPU threads, sampling, cache, flags, context/output caps and resource/work/cleanup limits are unchanged. Binary verification is the executed adapter's PINNED_FILES_VERIFIED evidence; this audit did not rehash the model binary again.

## Timing and terminal accounting

| Phase | Configured budget | Measured elapsed | Terminal evidence |
|---|---:|---:|---|
| Startup to READY | Within total work bound | 5,674.5413 ms | READY |
| Discarded primer | 20,000 ms | 11,269.8210 ms | Confirmed stop; 3 returned characters |
| Fresh case 1 | 10,000 ms | 8,499.8256 ms | Confirmed stop; 32 returned characters |
| Fresh case 2 | 10,000 ms | 10,014.1335 ms | RESPONSE_DEADLINE; null output/finish/timings |

Cold startup plus primer cost **16,944.3623 ms**. The whole recorded run took 35,615.8192 ms; the remaining 157.4978 ms includes checkpoints and teardown, not a separately measured cleanup latency. The completed primer exceeds the old primer deadline but fits the explicitly enlarged one. This does not relax the measured-response requirement or establish first-spoken latency.

Confirmed primer diagnostics report 333 prompt tokens, zero cached tokens, 11,093.997 ms prompt evaluation and 164.423 ms generation. Fresh case 1 reports 155 cached tokens, 225 prompt tokens, 7,733.423 ms prompt evaluation and 751.154 ms generation. These are retained native diagnostics, not semantic scores or a counterfactual caching benchmark. The second operation retained no confirmed completion metadata; its log's partial prompt progress cannot become a rejected answer or token-throughput estimate for a complete response.

The generic error `STARTUP_INTERRUPTED` comes from the wait helper also wrapping generation. Startup had succeeded; the phase-specific `RESPONSE_DEADLINE` identifies the failure. Available RAM began at 5.218285 GiB and reached a sampled minimum of 3.096638 GiB; initial disk space was 22.904282 GiB. Admission and sampled RAM thresholds passed, without proving between-sample minima.

Final runtime is STOPPED, null owned PID, inactive generation, null completion metadata and owned-process-stopped true; no cleanup error is recorded. Exit code -1 reflects the interrupted worker, not normal completion of the second response. Parent separately reported supervisor exit 1 and a fresh process inventory with zero matching processes; the auditor did not repeat that inventory.

The bounded run demonstrates completed transport for the primer and one response, followed by fail-stop cancellation. Full semantic review belongs to the separate evaluator. Reliability, full conversation, spoken-latency and game acceptance remain unverified; no further native run was performed for this audit.
