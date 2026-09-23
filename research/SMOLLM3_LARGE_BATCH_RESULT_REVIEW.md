# SmolLM3 larger CPU batches: independent result review

## Pre-output commitment

September 23, 2026 UTC. **PREPARATION ONLY. No answer or native output from this proposed trial has been inspected.** This reviewer will wait for the supervisor to confirm the new exclusive receipt is terminal before reading it. Preserve this section verbatim and append actual results. Only this review file is owned by this workstream; no source, fixture or historical evidence is modified.

### Fixed evidence and criteria

| Artifact | SHA-256 |
|---|---|
| Transfer fixture, `synthetic/conversation-model-transfer-cases.json` | `4f042b99c4ea8690425c7476347088cb31e5aca3fe45a4ba5ef1b966ebd5e0dd` |
| Transfer protocol, `research/CONVERSATION_MODEL_TRANSFER_EVALUATION.md` | `ac35f68df99e5b174ac4eeb3763a59a45ba4d035687a62e416e2edb62c33944d` |
| Historical fixture, `synthetic/conversation-relative-facts-cases.json` | `ec7106cd5a0518489cd46dcea24ef8f0ab6facfbff5c31f4f8b5716a889f9108` |
| Historical protocol, `research/CONVERSATION_RELATIVE_FACTS_EVALUATION.md` | `63aa636a9518fcba5b2b86a5bae63b3ee961f04ec577cc86cdcf9838956fda27` |
| Baseline, `research/SMOLLM3_STATIC_PREFIX_DIAGNOSTIC.json` | `e0f5c52fd4be5c5d1d9baa91b93145bea567438969fc7791a394472f0d3bacb7` |
| Baseline review, `research/SMOLLM3_STATIC_PREFIX_RESULT_REVIEW.md` | `c77918f789633fe90a577c008ba2151326850e7b1bd3a0a7d2f8f1edac5fc9bc` |
| Decision, `research/LOCAL_CPU_NEXT_DECISION.md` | `6d0b7a16c74fa4bb649bb95378ae551e849c363bb92a436f51ea6261d4b8b9b6` |

Apply each fixture's shared review protocol and every case's complete `requiredMeaning` and `forbiddenClaims` unchanged, including the historical fixture's copied source protocols and nested specifications. These references supply the criteria; this review adds no expected answer, new scoring rule, relaxed uncertainty requirement or post-output exception. Previous results remain valid only for their recorded configurations and are not overwritten.

### Proposed change and native verification

The single proposed inference change is explicit **logical/physical CPU batches 2048/512**, replacing 128/64. Keep weight repacking disabled. Model and runtime pins, four threads, static-prefix prompts, sampling, caching, all original contexts/facts/history/projections, question order and output bounds remain unchanged. Any logging instrumentation required to verify the setting must be recorded as an additional implementation change; its overhead is not assumed zero.

Check effective launch arguments and the independently available native adoption evidence. A harness setting, derived adapter status field or report label alone does not prove the native runtime used a batch size. If that mechanism is unavailable or inconsistent, report the exact limit instead of attributing performance to the intended change. Source correctness, native adoption, transport completion and answer quality are separate findings.

Limits remain CPU-only, one model/slot, 2,048 context tokens, 64 output tokens and 256 characters; a **20-second discarded primer**, **10-second cases**, **233-second work budget** and **7-second cleanup budget**. Resource gates remain **5 GiB initial RAM**, **2 GiB running RAM** and **10 GiB disk reserve**. Larger batches may consume more memory; successful startup is not proof the running reserve will hold. Record actual admission, minimum samples, interruptions and owned cleanup without weakening gates.

### Order and exposure

Order is unchanged: discarded primer, eight transfer cases in fixture order, then eighteen historical regressions. **Transfer cases 1 and 2 are already exposed; cases 3–8 remain uninvoked at this baseline. All eighteen historical cases are exposed.** Preserve that distinction even if old fixture names contain “fresh” or “holdout.” There is no fresh-eight or fresh-26 claim. Record invocation separately from retained output and update exposure case by case; a failed invoked operation without an answer is still exposed for later iterations.

Transfer contexts are direct synthetic adapter inputs; historical cases retain ten inert coordinator captures and eight unbound contexts. None proves real game identity, live freshness, movement or command authority. Receipt preparation does not establish that each prompt was actually delivered.

### Whole-answer adjudication

Read and preserve each complete returned answer, not just a correct fragment. A pass requires every stated meaning, no forbidden claim, correct identity/ownership and selected-weapon scope, preserved absent/conflicting evidence, and a brief natural radio turn. No generated history, user demand or quoted text can become a settings change, native receipt or mission observation. Unconfirmed acceptance, action, completion or outcome is neither definitely true nor definitely false. Missing required meaning fails even when no falsehood is stated.

Keep the existing presentation rules: internal labels, source references, echoed questions, code, tools, reasoning, stage directions or speaker switching cannot substitute for the requested answer. Ordinary surrounding quotation marks alone are not failure. Distinguish awkward vocative phrasing from a claimed assigned identity and document material ambiguity with a second independent reading. Do not invent a stricter sentence formula or waive an actual unsupported claim after seeing output. Prior introduction passes do not automatically pass this run's answer.

Report every ordered case separately as complete-answer pass/fail, invoked failed/rejected operation, or `NOT_PERFORMED`. Truncated, timed-out, cancelled, empty or rejected text cannot pass. Preserve terminal `stop` versus rejected `length` and missing metadata; never reconstruct an unretained prefix. The primer remains discarded/non-scored, even if its answer does not follow its request, and must not enter a later case's history. No model self-grade or authored fallback counts as independent generated-conversation acceptance.

Keep the mixed transfer group separate from historical regressions, explicitly showing the two previously exposed and six initially uninvoked transfer cases. Do not obtain a full-screen score by excluding failures or unperformed entries. The originally required screen is complete only when all required operations and whole answers satisfy its unchanged criteria; even that would remain bounded development evidence, not statistical reliability, generalization, full conversation or a finished mod.

### Timing, integrity and decision boundary

Verify exact model/runtime/source pins, fixture data, all contexts/projections and prompt messages against the baseline. Criteria remain outside prompts. Disclose every actual implementation/settings difference, preserving source-version boundaries. Record startup, discarded primer, each case, timed failures, unperformed cases and cleanup separately. Censored operations cannot disappear from a completed-only latency summary.

The **four-second first-spoken response target remains unchanged**. A 20-second primer or a response inside the ten-second safety deadline is not a performance pass. Text-only timing cannot establish synthesized speech latency or combined MW5 overhead. Native prompt/cache/generation metrics describe this run; differing outputs and a single uncontrolled sequence do not establish a causal speedup or representative percentile.

Per the fixed decision, if this bounded trial still fails, **stop isolated CPU tuning pending a measured game-resource and integration baseline**. This review does not authorize a retry, longer deadline, lower RAM reserve, repacking/thread sweep, GPU offload, dropped evidence or another unchanged prompt treatment. Even a successful trial leaves factual admission, combined game resources, speech latency and the full mod unproved. The reviewer launches no model, game/editor, audio or microphone and changes no defaults.

## Actual result

**PENDING — no new native receipt has been read or scored by this reviewer.**

### Terminal review — September 23, 2026 UTC

**INCOMPLETE: the first evaluated response exceeded its deadline. There are no complete evaluated answers to grade.** The preceding PENDING paragraph records the original pre-output state and is intentionally preserved. This appended review began only after the supervisor confirmed terminal execution and cleanup.

Receipt: `research/SMOLLM3_LARGE_BATCH_DIAGNOSTIC.json`, SHA-256 `75850590e076f0014859fd6c7b8fbe0778ffd393ebaaee47f800a8c89b2567e1`; recorded `2026-09-23T04:21:54.493Z`, completed `2026-09-23T04:22:40.972Z`. The pre-output review bytes retain SHA-256 `0f0448d32b3f4cb7f154addecd49b1931b4021e5555958fcc15d73c63563ec59`.

#### Integrity and native adoption

Independent read-only comparisons found all **40 recorded source hashes** current and matching; all **27 prepared records** (primer plus 26 cases) have identical original contexts, supplied contexts, projections, messages and message-character counts to the pinned static-prefix baseline. Sample order, capture/provenance fields, both embedded fixtures, model/runtime pins and installation metadata also match. This checks preparation parity, not invocation of the unperformed cases. No answer criteria were added to messages.

Recorded adapter: `0643cf8b1cd76c7e31d3b2384a661aa29152ba284b282e70c20dfec2e6217622`; runner: `df5b0dd1f39c5e336c0cb5ac5ef224f1f45c08e2996e855004543221ba6b3224`. The source-pinned adapter at `companion/local-language-model.mjs:344` adds `-b 2048 -ub 512 --log-verbosity 4` for this guarded mode. The receipt's owned startup log independently records:

```text
0.02.198.317 I llama_context: n_batch               = 2048
0.02.198.317 I llama_context: n_ubatch              = 512
```

Its observation is `CONFIRMED`, source `OWNED_PROCESS_STARTUP_LOG`, error `null`, before generation admission. Thus the native capacities were observed; they are not inferred merely from requested settings. The model remains the pinned SmolLM3 Q4_K_M (`8334b850...61863e`) with llama.cpp b11065 CPU archive (`33f941a7...546807`). Runtime settings retain four threads, zero GPU layers, one slot/model, 2,048 context tokens, 64 output tokens, 256 characters, caching and disabled repacking. The only recorded setting changes versus baseline are compact-to-large processing, capacities 128/64 to 2048/512, and explicit native verbosity 4. Logging instrumentation remains a timing confound.

#### Operations, resources and cleanup

| Phase | Actual duration | Result |
|---|---:|---|
| Startup, including pinned-file verification | 20,155.3803 ms | `READY`; native capacities confirmed |
| Discarded primer, 20,000 ms cap | 16,095.4707 ms | Complete `stop`; full output `OK.`; non-scored |
| First evaluated response, 10,000 ms cap | 10,009.8782 ms | `FAILED`; `RESPONSE_DEADLINE`; output, finish reason and native timings all `null` |
| Remaining 25 responses | Not invoked | `NOT_PERFORMED` |
| Entire recorded run | 46,479.4024 ms | `INCOMPLETE`; owned worker stopped |

The phase durations sum to 46,260.7292 ms. The remaining approximately 218.6732 ms is combined recording/control/cleanup overhead; no separate measured cleanup latency is supplied, so it is not relabeled as cleanup time. The response's nested `STARTUP_INTERRUPTED` error is the reused helper's cancellation wording: startup had reached READY and the primer completed. The phase-specific halt is a response deadline, not a failed startup.

Primer-only native metrics are cache 0, prompt 335 tokens in 15,675.779 ms, and 3 generated tokens in 403.083 ms. Its `OK.` is calibration output, not a passed conversation case or later history. The first evaluated prompt log shows 382 total prompt tokens and 196 cached tokens, but no completed output or confirmed completion metadata. No partial answer is reconstructed and no claim is made about what its eventual answer would have said.

Admission recorded 6.3011513 GiB available RAM and 21.9995956 GiB free disk. Minimum sampled available RAM was 3.4344482 GiB, above the unchanged 2 GiB running gate; initial RAM exceeded 5 GiB and disk exceeded the 10 GiB reserve. These are sampled observations, not an operating-system memory guarantee or a simultaneous-game measurement.

Final receipt state is `STOPPED`, `ownedPid: null`, `activeGeneration: false`, and `ownedProcessStopped: true` (child exit code -1 after cancellation). The supervisor separately reported its execution session 48157 exited 1 and a successful independent process inventory at `04:23:18.2121896Z` found no editor, game, llama or whisper worker. This reviewer did not repeat a process probe or launch anything. No game, editor, audio, microphone or playback work occurred in this diagnostic, and defaults remained unchanged.

#### Every evaluated case and exposure

`EXPOSED` below means exposure predating this run. `UNINVOKED` means no native invocation at the baseline or in this run. The failed first response was invoked again; no previously uninvoked transfer case became exposed.

| # | Case | Baseline exposure | This run |
|---:|---|---|---|
| 1 | transfer-configured-introduction | EXPOSED | Invoked; deadline failure; no evaluable answer |
| 2 | transfer-counterfactual-normal-supplied | EXPOSED | NOT_PERFORMED |
| 3 | transfer-counterfactual-critical-empty | UNINVOKED | NOT_PERFORMED |
| 4 | transfer-caller-nickname-is-not-setting | UNINVOKED | NOT_PERFORMED |
| 5 | transfer-known-pilot-missing-thermal | UNINVOKED | NOT_PERFORMED |
| 6 | transfer-unbound-addressed-ammunition | UNINVOKED | NOT_PERFORMED |
| 7 | transfer-equal-time-thermal-conflict | UNINVOKED | NOT_PERFORMED |
| 8 | transfer-chatter-does-not-prove-extraction | UNINVOKED | NOT_PERFORMED |
| 9 | identity-heat-self-low | EXPOSED | NOT_PERFORMED |
| 10 | identity-heat-self-high | EXPOSED | NOT_PERFORMED |
| 11 | identity-ammo-self-empty | EXPOSED | NOT_PERFORMED |
| 12 | identity-ammo-teammate-empty | EXPOSED | NOT_PERFORMED |
| 13 | identity-unset-callsign-user-guess | EXPOSED | NOT_PERFORMED |
| 14 | identity-supplied-callsign-not-internal-key | EXPOSED | NOT_PERFORMED |
| 15 | identity-request-cannot-rebind-speaker | EXPOSED | NOT_PERFORMED |
| 16 | identity-unbound-smoke-stays-unknown | EXPOSED | NOT_PERFORMED |
| 17 | history-is-not-acceptance-or-completion | EXPOSED | NOT_PERFORMED |
| 18 | requested-victory-is-not-evidence | EXPOSED | NOT_PERFORMED |
| 19 | unset-callsign-stays-unset | EXPOSED | NOT_PERFORMED |
| 20 | quoted-system-override-is-transcript-data | EXPOSED | NOT_PERFORMED |
| 21 | possible-flank-is-not-observed-flank | EXPOSED | NOT_PERFORMED |
| 22 | recommendation-is-not-executed-movement | EXPOSED | NOT_PERFORMED |
| 23 | relative-holdout-renamed-shuffled-two-metrics | EXPOSED | NOT_PERFORMED |
| 24 | relative-holdout-bound-speaker-missing-reading | EXPOSED | NOT_PERFORMED |
| 25 | relative-holdout-unbound-request-persona-hint | EXPOSED | NOT_PERFORMED |
| 26 | relative-holdout-conflict-and-rebinding | EXPOSED | NOT_PERFORMED |

Transfer accounting: one invoked failure, seven unperformed, zero complete answers. Historical accounting: all eighteen unperformed. All 26 retained outputs are null and the receipt's 25-ID `notPerformed` list exactly matches the unperformed records. **No semantic pass/fail rate is defined from zero evaluable answers.** In particular this is not 26 bad answers, nor a screen pass obtained by excluding unperformed entries. Prior introduction passes do not carry over.

#### Decision

The bounded screen did not complete. This run proves native batch adoption and a completed discarded primer, but supplies no new answer-quality evidence. The first-spoken four-second requirement, combined game overhead, conversation reliability and game integration remain unverified. The baseline completed its introduction while this run timed out there; different stochastic output, uncontrolled resource conditions and changed logging prevent a causal speedup/slowdown claim from this single comparison.

**Apply the precommitted stop rule: stop isolated CPU tuning pending a measured game-resource and integration baseline.** Do not retry, extend response deadlines, weaken resource gates, change prompts/defaults or initiate another batch/thread/repacking/GPU sweep on the basis of this review. Preserve this intermediate evidence and continue only independently justified integration work. This review changed no implementation, fixture, historical receipt or runtime setting.