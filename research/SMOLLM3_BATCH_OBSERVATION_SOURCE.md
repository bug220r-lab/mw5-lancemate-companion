# Native batch-size observation for the bounded SmolLM3 experiment

Date: 2026-09-22. **DOCUMENTED source mechanism; PASS_MOCK_ONLY adapter checks. Native large-batch execution NOT_PERFORMED.** This note concerns initial native context capacities, not achieved prompt throughput, each individual decode size, model quality, or MW5 acceptance.

The pinned b11065 source explains why the earlier startup logs did not include batch capacities. Library INFO messages are mapped to common TRACE level **4**. The existing runtime's level 3 hides those messages. The proposed large-batch mode therefore adds explicit `-b 2048 -ub 512` **and** `--log-verbosity 4`. The additional logging is an observation-instrumentation change and a potential performance confound, not an unchanged-logging comparison.

## Primary-source chain

Official repository, exact commit `ce8caa6e60a03093351d6016a818720e0d46f0fb`, inspected read-only on the date above. No fetched code was executed and no runtime was installed.

| Source | What it establishes |
|---|---|
| [llama-context.cpp:83](https://github.com/ggml-org/llama.cpp/blob/ce8caa6e60a03093351d6016a818720e0d46f0fb/src/llama-context.cpp#L83) | The emitting function is the `llama_context` constructor. Its `__func__` supplies the native message prefix. |
| [llama-context.cpp:244–247](https://github.com/ggml-org/llama.cpp/blob/ce8caa6e60a03093351d6016a818720e0d46f0fb/src/llama-context.cpp#L244) | Native causal logical capacity is clamped to context size; physical capacity is clamped to logical capacity. Observing these post-clamping values is stronger than reading the intended command line. |
| [llama-context.cpp:309–310](https://github.com/ggml-org/llama.cpp/blob/ce8caa6e60a03093351d6016a818720e0d46f0fb/src/llama-context.cpp#L309) | `LLAMA_LOG_INFO` prints the resulting `cparams.n_batch` and `cparams.n_ubatch`, each on its own complete line. |
| [common.cpp:394](https://github.com/ggml-org/llama.cpp/blob/ce8caa6e60a03093351d6016a818720e0d46f0fb/common/common.cpp#L394) | Installs `common_log_default_callback` as the llama library logging callback. |
| [log.cpp:529–545](https://github.com/ggml-org/llama.cpp/blob/ce8caa6e60a03093351d6016a818720e0d46f0fb/common/log.cpp#L529), [log.h:24–29](https://github.com/ggml-org/llama.cpp/blob/ce8caa6e60a03093351d6016a818720e0d46f0fb/common/log.h#L24) | Library INFO is assigned TRACE, whose numeric threshold is 4; the callback filters messages above the selected threshold. |
| [arg.cpp:3925–3939](https://github.com/ggml-org/llama.cpp/blob/ce8caa6e60a03093351d6016a818720e0d46f0fb/common/arg.cpp#L3925) | `--log-verbosity` directly sets that threshold; level 4 is the documented trace level. |
| [log.cpp:104–166](https://github.com/ggml-org/llama.cpp/blob/ce8caa6e60a03093351d6016a818720e0d46f0fb/common/log.cpp#L104) | Normal INFO output uses stderr. Optional formatting prepends the timestamp in minutes/seconds/milliseconds/microseconds and `I `; the original message follows unchanged. |
| [server-context.cpp:4181–4215](https://github.com/ggml-org/llama.cpp/blob/ce8caa6e60a03093351d6016a818720e0d46f0fb/tools/server/server-context.cpp#L4181) | `/props` constructs default generation settings from task/sampling parameters and provides slot context size, rather than querying both native batch getters. It is not used as the native-adoption channel. |
| [server-context.cpp:3314](https://github.com/ggml-org/llama.cpp/blob/ce8caa6e60a03093351d6016a818720e0d46f0fb/tools/server/server-context.cpp#L3314) | The server separately logs an effective per-decode batch. Initial context capacities do not prove every later decode has that size. |

## Implemented contract

`createLocalLanguageModel` accepts `processingBatch: 'large'` only for `smollm3_3b` with all three existing experimental fact/briefing/request flags and `experimentalStaticPrefix: true`. The fixed experiment runner owns the additional CPU-4, no-repack, cache-enabled restriction. Default and compact modes retain their previous arguments, status shape and message serialization.

Only large mode adds `settings.nativeLogVerbosity: 4` and the following separate diagnostic status:

```text
nativeBatchObservation:
  status: PENDING | CONFIRMED | REJECTED
  source: OWNED_PROCESS_STARTUP_LOG
  logicalBatchTokens: null | observed integer
  physicalBatchTokens: null | observed integer
  logVerbosity: 4
  lines: at most two complete accepted native lines
  error: null | rejection code
```

The existing `settings.logicalBatchTokens` and `settings.physicalBatchTokens` remain **intent/configuration**, not native observation. In injected tests the enclosing status remains `MOCK_ONLY`; a synthetic line does not become native evidence because it resembles a native message.

Each owned startup gets a fresh observation. Stdout and stderr have independent line buffers, each capped at 4,096 characters; an overlong line is discarded through its newline. Only anchored native `llama_context` capacity lines are accepted, optionally preceded by the exact uncolored INFO/timestamp wrapper above. CRLF is accepted. Partial lines, unrelated prefixes, trailing text and cross-stream fragments cannot establish an observation. Unsupported formatting fails closed rather than guessing.

At authenticated health readiness, both capacities must have been observed exactly once as 2,048 and 512. Missing, differing or duplicated observations reject with `NATIVE_BATCH_OBSERVATION_MISSING`, `NATIVE_BATCH_OBSERVATION_MISMATCH` or `NATIVE_BATCH_OBSERVATION_CONFLICT`. The check is outside the retryable health-fetch catch. Rejection triggers existing owned-process cleanup and cannot become READY. Generation also requires the confirmed capacities.

Accepted evidence freezes before generation. Later logs cannot satisfy or revise adoption, and old-child callbacks cannot contribute to a new startup. Exact accepted lines are retained independently of the bounded general log tail. Status returns copied records, so callers cannot mutate the internal confirmation. A new explicit startup resets previous success or failure; stopping preserves the last diagnostic for the receipt.

## Verification and limits

The new nine implementation cases plus the static-prefix and existing language-model suites passed **51/51 MOCK_ONLY**. They exercise actual injected spawn arguments and request bodies; all 27 prepared static-prefix messages remain exact. Missing/mismatched/duplicate readings prevent generation and confirm owned cleanup. Fragmented wrapped lines, separate-stream boundaries, oversize lines, general-log eviction, post-readiness logs, old-child output, restart reset and caller mutation are covered. Independent review is recorded separately.

The model, runtime, prompts, fixture criteria, output limits and deadlines are not altered by this adapter change. Native compatibility of the exact uncolored startup formatter remains to be observed in the separately authorized experiment. That experiment is currently on hold while editor/observer work takes priority. No inference or game/editor process was started by this work.
