# Larger CPU batches without repacking

September 23, 2026 UTC. **Preparation for one local component diagnostic; native execution NOT_PERFORMED at this checkpoint.** The prior goal turn made progress by implementing, testing and independently evaluating static-prefix reuse, then backing up its exact source. It still failed the second response deadline. The editor remains closed, and the separately owned observer investigation is unchanged.

## Hypothesis and preserved baseline

The [next CPU decision](../research/LOCAL_CPU_NEXT_DECISION.md) identifies one untested combination: larger prompt batches with repacking disabled. Prior large/compact Qwen comparisons used repacking, and all SmolLM3 runs used compact 128/64 batches. The static-prefix introduction still spent 6.434 of 7.375 seconds processing the prompt. These observations justify testing a batch constraint; they do not predict an improvement or prove sufficient memory.

Compare against `research/SMOLLM3_STATIC_PREFIX_DIAGNOSTIC.json`, SHA-256 `e0f5c52fd4be5c5d1d9baa91b93145bea567438969fc7791a394472f0d3bacb7`. Its exact runner (`e4a66ff4881e06450c2fa7a65722f541157cd12f757a422b4c3366fcd25d1320`) and adapter (`840e38296555cbda077b9e3290b308dbf7acc055e4c7b2b422e3119b3b2015d3`) are preserved at private Git commit `7d44b06154ad602bf207e947240ff3e7bcc6b21d`. Preserve all historical receipts.

## One inference change and observation requirement

The experimental `processingBatch: large` mode explicitly requests logical/physical batches **2048/512**, replacing **128/64**. Restrict it to the existing SmolLM3 synthetic-only static-prefix path. Default/compact modes and workbench defaults remain unchanged. Keep repacking disabled, four threads, CPU-only, one model/slot, prompt caching, 2,048 context tokens, 64 output tokens, 256 characters and identical sampling.

Intended settings are not independent evidence of native adoption. Before execution, the adapter workstream must document a version-pinned native observation mechanism in `research/SMOLLM3_BATCH_OBSERVATION_SOURCE.md`, implement bounded observation, and reject missing, conflicting or mismatched batch values before any generation. Explicitly disclose any diagnostic logging change needed to observe them; do not claim a strictly isolated timing comparison if instrumentation also differs. Native execution remains gated until that mechanism and its independent tests are complete.

The established mechanism uses **native log verbosity 4**, only in the large-batch experiment. The pinned library logs its post-clamp context batch values at a level suppressed by the baseline verbosity 3. Capture only complete matching startup lines from the current owned child, using bounded separate stream buffers; retain at most the two batch lines. Reset observations at each startup, reject duplicates/conflicts or wrong values, and stop observation before any inference logging. A successful health response requires both native values, not merely requested settings. The adapter and runner independently gate generation on confirmed 2048/512. This instrumentation also changes logging overhead, so the run cannot isolate timing effects to batch size alone. Default and compact modes retain their previous logging behavior.

Keep every static-prefix message, original/actual context, observation, uncertainty, history, case criterion and order byte-identical to preparation from the predecessor. No new answers, shorter facts, prompt edits, thread changes or repacking changes. Retain the same discarded primer; its output never enters later inputs. Two transfer cases were already invoked, six remain uninvoked and eighteen are historical regressions. Administrative labels must preserve this exposure rather than claim a fresh 26-case screen.

## Fixed execution and limits

`--check-large-batch-004` is inert preparation. `--run-large-batch-004` exclusively reserves `research/SMOLLM3_LARGE_BATCH_DIAGNOSTIC.json`; an existing destination refuses before worker creation. Verify the exact predecessor, complete primer/first answer, second response failure, remaining 24 unperformed and stopped owned process, then reconstruct all 27 records. No arbitrary output, runtime, model or deadline inputs.

Keep **20 seconds for the discarded primer, 10 seconds per evaluated response, 233 seconds total work, seven seconds cleanup**, and 250-ms resource sampling. Require five GiB available RAM at admission, two GiB while running and ten GiB free disk. Reactive samples are not an OS-enforced memory guarantee. Any resource loss, missing native confirmation, invalid completion, cancellation or deadline stops the run. Failed/rejected text remains null; later questions remain NOT_PERFORMED. Verify owned shutdown and independently check process absence before another native action.

No download, editor/game launch, audio generation/playback, microphone, dispatch, retail change or GPU offload. Stop the owned worker for rollback; no other application setting changes.

## Review and stopping rule

Independently review all complete answers under unchanged whole-answer criteria. Report cold startup, primer, failures/unperformed cases and native cache/prompt/generation timings separately. A terminal transport stop is not semantic acceptance; a faster short answer is not a controlled causal speedup. The four-second first-spoken target remains unchanged and cannot be passed by a text-only experiment.

This is one attempt, not a settings sweep. If the bounded test still fails, stop isolated CPU tuning pending an actual game-resource and integration baseline. Do not respond with more prompt variations, longer deadlines, fewer facts or automatic GPU offload. Even a successful small test leaves factual reliability, combined MW5 workload, speech latency and full-mod acceptance unproven.
