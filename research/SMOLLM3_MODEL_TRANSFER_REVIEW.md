# SmolLM3 model-transfer whole-answer review

## Pre-output commitment — frozen before candidate answers

September 22, 2026 local time. **PREPARATION ONLY. No SmolLM3 answers have been inspected by this reviewer.** The review will read the new native receipt only after the supervisor confirms its process is terminal. This section will be preserved; actual outcomes will be appended below it rather than rewriting the criteria after output exposure.

### Controlling criteria and preserved evidence

| Artifact | SHA-256 |
|---|---|
| Eight fresh cases: `synthetic/conversation-model-transfer-cases.json` | `4f042b99c4ea8690425c7476347088cb31e5aca3fe45a4ba5ef1b966ebd5e0dd` |
| Their evaluation protocol: `research/CONVERSATION_MODEL_TRANSFER_EVALUATION.md` | `ac35f68df99e5b174ac4eeb3763a59a45ba4d035687a62e416e2edb62c33944d` |
| Eighteen exposed cases: `synthetic/conversation-relative-facts-cases.json` | `ec7106cd5a0518489cd46dcea24ef8f0ab6facfbff5c31f4f8b5716a889f9108` |
| Their original evaluation protocol: `research/CONVERSATION_RELATIVE_FACTS_EVALUATION.md` | `63aa636a9518fcba5b2b86a5bae63b3ee961f04ec577cc86cdcf9838956fda27` |
| Preserved separated-request predecessor: `research/QWEN17B_SEPARATED_REQUEST_DIAGNOSTIC.json` | `b76aee167224bcd9cfd199ece83bd2a07ef02ec71cd60445c2df41a1712ec5ea` |
| Preserved briefing receipt: `research/QWEN17B_BRIEFING_DIAGNOSTIC.json` | `f63a50b7d1c20d98ce106fbb4a907dd03bb75fecd972c29b1645ad30c47b8389` |

For fresh cases, apply the fixture's shared `reviewProtocol`, each case's `requiredMeaning` and `forbiddenClaims`, and its evaluation note unchanged. For exposed cases, apply the copied source review protocols and the unchanged `specification.requiredMeaning`/`forbiddenClaims`. These references govern; this review introduces no expected-answer strings, new scoring rubric, relaxed unknowns or post-output exception.

### Predeclared order and provenance

The new fixed receipt is `research/SMOLLM3_MODEL_TRANSFER_DIAGNOSTIC.json`. After the separately discarded primer, the planned order is **all eight fresh cases in fixture order, then all eighteen exposed cases in their fixture order**. A halted run retains failed and unperformed entries in those positions; later entries are not retried to manufacture a complete suite.

The fresh eight are: configured introduction; own normal heat/available ammunition; counterfactual own critical heat/empty ammunition; caller nickname versus unset callsign; known pilot with missing heat; unbound addressed ammunition; equally current conflicting heat; and unverified chatter versus withdrawal/approach outcomes. They are direct synthetic adapter contexts, not actual coordinator captures. Their source observations and bindings are synthetic inputs, not shipping-game evidence or authority.

The exposed eighteen retain their historical ten inert coordinator captures and eight explicitly unbound contexts. Their earlier division into fourteen diagnosed regressions and four then-fresh holdouts remains in provenance, but **all eighteen are now exposed regressions**. No combined 26-case denominator will be described as a fresh holdout. The new eight lose fresh status for future iterations after candidate exposure; record which operations were actually invoked.

### Treatment and comparison limits

The proposed candidate is **SmolLM3-3B Q4_K_M**, publisher revision `4965cb60b150737b68a0408c36aeefb65078f894`, artifact SHA-256 `8334b850b7bd46238c16b0c550df2138f0889bf433809008cc17a8b05761863e`. This changes model family and quantization from the Qwen3-1.7B Q8 predecessor. The candidate-specific serializer retains the reference briefing and separate final question, moves the `/no_think` control to the system message, and preserves the player's actual question without the earlier suffix. The runtime still requests nonthinking through its template arguments and reasoning budget. Actual pins, messages and effective runtime settings must be checked against the terminal receipt, not inferred from these preparation descriptions.

The planned limits remain CPU-only, four threads, one model/slot, compact 128/64 batching without weight repacking, prompt caching, 2,048 context tokens, 64 output tokens and 256 characters. Resource and supervisory gates remain 5 GiB initial RAM, 2 GiB running floor, 10 GiB free disk, 10 seconds per operation, 233 seconds work and 7 seconds cleanup. Any actual difference must be disclosed. The reviewed completion guard requiring terminal `stop` plus `[DONE]` remains in force; a returned `length` completion is rejected and cannot pass. There is no inference of the content of rejected output.

This is a candidate screen, not an isolated causal model-only comparison: family, quantization, required template controls and fresh requests differ, and stochastic output has no fixed seed. Preserve the prior failures for their exact source versions. Do not transfer a Qwen pass into this run or attribute a difference to model size, template or caching alone.

### Whole-answer adjudication and accounting

Read every complete answer in full and retain its exact text. A semantic pass requires the whole requested meaning, correct ownership and scope, preserved missing/conflicting evidence, and a brief natural radio turn. A correct fragment does not rescue an unsupported claim or omitted required meaning. Unknown acceptance, movement, completion and outcome are neither confirmed true nor confirmed false. No guessing a callsign, widening selected-weapon ammunition to every weapon, or treating requests/generated history/transcripts as evidence or control authority is permitted.

Use the predeclared treatment of presentation: source references, schema labels, echoed questions, stage directions, tools, code, reasoning or speaker switching cannot substitute for the requested spoken answer. Ordinary quotation marks alone do not invalidate a valid line. Distinguish an awkward vocative from an actual claimed assigned identity; document material ambiguity and request a second independent reading rather than silently tightening or loosening criteria.

Report fresh and exposed groups separately, with a row for every ordered case. Separate complete-answer semantic pass/fail from a begun failed/rejected operation and `NOT_PERFORMED`. An empty, truncated, timed-out, cancelled or rejected answer cannot pass. Missing retained text is not an observed factual error and cannot be reconstructed from timing or finish reason. The discarded primer is neither a case pass nor context for later cases. Model confidence or self-grading is not independent validation.

Audit the receipt's fixture/source/model pins, original contexts, projections and actual transformed messages; case expectations must remain outside prompts. Report startup and primer separately from case generation, available native finish reasons/timings, resource admission/minimums, terminal runtime state and owned-process cleanup. Text-generation time is not the four-second first-spoken audio measure. No dispatch, voice synthesis, playback, microphone capture or game/editor action belongs to this diagnostic.

The predeclared fresh screen requires all eight operations to complete and every returned answer to meet its complete criteria. Even universal success is bounded development evidence, not statistical reliability, broad conversation, personal-style acceptance, live factual admission, combined game/audio performance or a finished mod. No authored-line fallback is counted as generated conversation. The four-second first-spoken target remains unchanged.

## Actual result

**PENDING — native receipt has not been read or scored by this reviewer.** Append only after the supervisor's terminal-run notification.

### Terminal receipt review — September 22 locally / September 23, 2026 UTC

**INCOMPLETE; semantic evaluation NOT_PERFORMED.** The model reached `READY`, but the discarded primer exceeded its 10-second operation deadline. No evaluation case was invoked and no answer was retained. There is **no model-quality score** for either group, and no semantic pass or semantic failure can be assigned. This failed bounded attempt does not complete the predeclared fresh screen.

The pre-output document through the preceding pending line had SHA-256 `533a356c3ee0f7abf62058819382655bf1ef03db899a697fc37fe1e4beb66c74`; it is preserved above. The immutable native receipt is `research/SMOLLM3_MODEL_TRANSFER_DIAGNOSTIC.json`, SHA-256 **`ffd7341cf63f55d4994c3ddecc06eba5421f1c19e014c2365d0236928f5959ff`**. The supervisor reported execution session 71183 exited with code 1. This reviewer read the receipt only after that terminal notification, performed read-only reconstruction and made no native invocation or retry.

#### Integrity and exact failure stage

All **25 recorded source hashes** matched current files before this append. Both receipt fixtures match their unchanged on-disk fixtures. Pure reconstruction reproduced all **26 prepared case contexts, original contexts, projections, messages, capture/provenance records and message-character counts**, plus the primer's original context, classified context, projection, messages and character count. Model pins match the lock and runtime pins match their manifest. This validates prepared inputs, not delivery of the 26 uninvoked prompts to the model.

The native receipt records `PINNED_FILES_VERIFIED` and `READY` after **5,723.712 ms** startup. The primer alone was invoked. It failed after **10,005.2172 ms**, with `output`, `finishReason` and `nativeTimings` all null. `haltReason` is **`OPERATION_DEADLINE`**. Its error string, `STARTUP_INTERRUPTED`, comes from the reused `waitForStartup` helper wrapping `engine.generate` (`scripts/Exercise-ConversationGrounding.mjs:15` and `scripts/Exercise-ConversationModelTransfer.mjs:186`); it does **not** mean model startup failed. The retained runtime log shows primer prompt processing, including 256 tokens at about 8.59 seconds, but no confirmed completed generation. Do not infer text, an output-token count, a truncation event or a semantic refusal from that log.

#### Complete case accounting

Every row below has `status: NOT_PERFORMED`, null output/finish reason/native timings, no operation elapsed-time field, and `dispatched: false`, `played: false`. Thus each whole-answer verdict is also **NOT_PERFORMED**.

| Order | Group | Case | Whole-answer verdict |
|---:|---|---|---|
| 1 | Fresh | `transfer-configured-introduction` | NOT_PERFORMED |
| 2 | Fresh | `transfer-counterfactual-normal-supplied` | NOT_PERFORMED |
| 3 | Fresh | `transfer-counterfactual-critical-empty` | NOT_PERFORMED |
| 4 | Fresh | `transfer-caller-nickname-is-not-setting` | NOT_PERFORMED |
| 5 | Fresh | `transfer-known-pilot-missing-thermal` | NOT_PERFORMED |
| 6 | Fresh | `transfer-unbound-addressed-ammunition` | NOT_PERFORMED |
| 7 | Fresh | `transfer-equal-time-thermal-conflict` | NOT_PERFORMED |
| 8 | Fresh | `transfer-chatter-does-not-prove-extraction` | NOT_PERFORMED |
| 9 | Exposed | `identity-heat-self-low` | NOT_PERFORMED |
| 10 | Exposed | `identity-heat-self-high` | NOT_PERFORMED |
| 11 | Exposed | `identity-ammo-self-empty` | NOT_PERFORMED |
| 12 | Exposed | `identity-ammo-teammate-empty` | NOT_PERFORMED |
| 13 | Exposed | `identity-unset-callsign-user-guess` | NOT_PERFORMED |
| 14 | Exposed | `identity-supplied-callsign-not-internal-key` | NOT_PERFORMED |
| 15 | Exposed | `identity-request-cannot-rebind-speaker` | NOT_PERFORMED |
| 16 | Exposed | `identity-unbound-smoke-stays-unknown` | NOT_PERFORMED |
| 17 | Exposed | `history-is-not-acceptance-or-completion` | NOT_PERFORMED |
| 18 | Exposed | `requested-victory-is-not-evidence` | NOT_PERFORMED |
| 19 | Exposed | `unset-callsign-stays-unset` | NOT_PERFORMED |
| 20 | Exposed | `quoted-system-override-is-transcript-data` | NOT_PERFORMED |
| 21 | Exposed | `possible-flank-is-not-observed-flank` | NOT_PERFORMED |
| 22 | Exposed | `recommendation-is-not-executed-movement` | NOT_PERFORMED |
| 23 | Exposed | `relative-holdout-renamed-shuffled-two-metrics` | NOT_PERFORMED |
| 24 | Exposed | `relative-holdout-bound-speaker-missing-reading` | NOT_PERFORMED |
| 25 | Exposed | `relative-holdout-unbound-request-persona-hint` | NOT_PERFORMED |
| 26 | Exposed | `relative-holdout-conflict-and-rebinding` | NOT_PERFORMED |

Fresh group: **0 invoked, 0 complete, 8 unperformed**. Exposed group: **0 invoked, 0 complete, 18 unperformed**. The failed operation is the separate discarded primer, not case 1. All eight fresh cases remain uninvoked; their frozen criteria are unchanged and this run supplies no candidate answers with which to tune them. Prior failures of the eighteen exposed cases remain evidence for their earlier recorded versions.

#### Resources, timing and cleanup

The effective runtime and receipt settings match the predeclared model, CPU-only four-thread configuration, compact batches, caching, context/output bounds and deadlines. Initial available RAM was **5.147766 GiB**, minimum sampled RAM **3.135002 GiB**, and initial free disk **22.911919 GiB**. Admission passed; the recorded stop cause was the operation deadline, not a reserve failure. Total measured attempt duration was **15,860.738 ms**. There are no completed-case latency statistics and no first-spoken audio measurement; neither the four-second target nor a causal speed comparison is established.

Final runtime is **`STOPPED`**, owned PID null, active generation false, owned-process-stopped true, with native process exit code -1. The supervisor separately reported a fresh global inventory containing no model, editor or game process; this reviewer did not repeat that inventory. Receipt flags record no download during this diagnostic, game/editor execution, audio generation, microphone capture or playback. The earlier separately recorded model setup is not erased by the diagnostic's `downloads: false` flag.

The evidence establishes a successfully loaded candidate and an unsuccessful bounded primer operation followed by confirmed owned cleanup. Candidate grounding, natural conversation, case-level latency, gameplay integration and full-mod acceptance remain **NOT_VERIFIED**. No criterion, safeguard or raw receipt was changed to turn this outcome into a pass.
