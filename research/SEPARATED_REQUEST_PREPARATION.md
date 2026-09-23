# Separated-request diagnostic preparation

September 22, 2026 — **PREPARED_NOT_EXECUTED / PASS_MOCK_ONLY**. This preparation starts no native worker and reserves no result. The fixed proposed selector is `--run-separated-request-qwen17b`; its exclusive new destination is `research/QWEN17B_SEPARATED_REQUEST_DIAGNOSTIC.json`, absent when this note was prepared. A supervisor must separately decide whether resource admission and bounded execution are appropriate.

The runner requires the exact stopped briefing predecessor, SHA256 **`F63A50B7D1C20D98CE106FBB4A907DD03BB75FECD972C29B1645AD30C47B8389`**, before accepting the new attempt. Its recorded `COMPLETE_PENDING_SEMANTIC_REVIEW` status is historical transport evidence, not acceptance of its outputs; the independent review found **3/18 full passes**. No predecessor bytes or verdicts changed.

The declared `SEPARATED_REQUEST_BRIEFING_V1` treatment passes the code-only `experimentalSeparateRequest: true` together with the required existing briefing and relative-fact flags. Effective runtime confirmation checks all three. The model remains installed official Qwen3-1.7B Q8. One system clarification identifies the reference-only briefing and final question; the first user message retains every prior briefing byte before the request section, and the second user message contains the exact original `request.text` plus the unchanged ` /no_think` suffix. No answers, facts, histories, conflicting alternatives or source references are removed or supplied. This is model input, not an authored response.

The original eighteen-case fixture remains **`EC7106CD5A0518489CD46DCEA24EF8F0AB6FACFBFF5C31F4F8B5716A889F9108`**. Case order, original contexts, ten inert coordinator captures, eight unbound contexts, projections/audits and semantic criteria remain exact. All eighteen are now exposed regressions; four retain historical holdout provenance, with **zero fresh holdouts**. Every older selector retains its prior messages unchanged.

This is **not solely a prompt-code comparison with the historical receipt**. The intervening adapter completion guard now requires a valid terminal reason followed by stream completion, rejects `length` with `GENERATED_TEXT_TRUNCATED`, and exposes bounded finish-reason/timing diagnostics. The new receipt's `completionEvidenceChange` explicitly records that difference and sets `isolatedPromptCodeComparison: false`. A truncated sample now has no admitted output, is failed, and stops later cases; unperformed cases cannot become semantic passes. Old results do not receive retroactive completion reasons.

CPU four-thread/one-slot operation, 2,048-token context, compact 128/64 batches, disabled repacking, prompt caching, 64-token/256-character output limits, ten-second operation deadline, and 5-GiB initial RAM/2-GiB sampled running RAM/10-GiB disk gates are unchanged. CLI overrides for paths, models, prompts, limits or retries are rejected. Reservations use only the fixed `wx` destination and refuse replacement. No default workbench capability changes. Root's preparation measured 1,485 primer characters and 1,613–1,933 case characters, 145 more than the prior treatment; character counts do not establish speed or token counts.

## Focused verification and pins

**72/72 focused checks passed, zero failures or skips, MOCK_ONLY**: seventeen new separated-request checks plus fifty-five existing relative-fact/briefing checks. Native engines and receipt I/O were replaced with inert code-only fakes. Checks cover exact reference/request separation, preserved context/criteria/history/audit, older-message byte identity, predecessor integrity, forged comparison/exposure metadata, exclusive reservation, actual factory flags, effective runtime rejection, unchanged resource refusal, bounded failed truncation and abort-ignoring deadline handling. A successful fake text operation remains pending independent semantic review and never plays audio or dispatches a command. Diff checks passed; full-project verification is separately owned by the supervisor.

| Prepared source | SHA256 |
|---|---|
| `scripts/Exercise-ConversationRelativeFacts.mjs` | `4BE2F6F5F3C6C05FFA577D14054597325022DD0C01B85693BA355C6BF7604B72` |
| `companion/tests/separated-request-diagnostic.test.mjs` | `56C4D107AFD53650201F136B76FA8396B937805F3D406D10DB28D851B4273C93` |
| Adapter inspected during this preparation; owned separately | `71E4B7195CAA3E903D4B6BEB223543265CA28E0DB6CFC444126C7F13B622F815` |

Future receipts pin the current adapter, projector, harness, source tests and relevant design/evaluation notes. They do not pin an appendable semantic-results note as if its post-output bytes existed before execution. Historical receipt source maps remain historical. No native inference, game/editor execution, audio, microphone, download or JSON result creation occurred in this workstream. Model compliance, new-case generalization, latency acceptance and mission-conversation suitability remain unproved.
