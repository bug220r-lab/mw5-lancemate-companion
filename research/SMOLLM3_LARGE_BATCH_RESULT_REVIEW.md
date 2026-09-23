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
