# Different local model experiment

September 22, 2026 local. Project-only component work under the approved full delivery plan. The editor and game remain closed. This experiment cannot enable game observation, orders, voice playback or direct piloting.

## Question and evidence

Does the independently trained SmolLM3-3B candidate answer small, supplied-fact radio questions more usefully than the previously failed Qwen diagnostics, within this laptop's existing component limits? This is a feasibility check, not a causal model comparison, training exercise or quality acceptance. The frozen [candidate report](../research/LOCAL_CONVERSATION_MODEL_CANDIDATE.md) establishes publisher, version, license and source-level runtime support. The recorded Qwen failures remain unchanged.

The [fresh fixture](../synthetic/conversation-model-transfer-cases.json) contains eight independently specified cases with criteria outside their contexts. Its [evaluation procedure](../research/CONVERSATION_MODEL_TRANSFER_EVALUATION.md) requires whole-answer review rather than matching keywords or model self-grades. Run those eight first, then the existing eighteen exposed regressions, as separate result groups. Never feed one answer into another case. After inference, attempted fresh cases cannot be reused as unseen evidence. A single stochastic output per case cannot establish reliability or broad generalization.

## Artifacts and setup

`companion/models.lock.json` adds only the fixed SmolLM3 Q4_K_M artifact; previous pins remain. `scripts/Install-SmollmCandidate.mjs` accepts only inert `--check` or explicit `--download`, reserves `research/SMOLLM3_SETUP.json` exclusively, transfers the pinned license/model, checks size/SHA-256 and preserves all previous installation receipts. It executes no downloaded code. Its staging and final paths are project-local. Final publication uses a hard link that fails if the destination exists; the retained staging path shares the same data, not an independent second backup. The conservative storage gate still budgets both copies, a 1-MiB metadata allowance and the unchanged 10-GiB reserve. It rechecks at transfer start and samples the working reserve during streaming. It cannot prevent unrelated processes from consuming the disk between samples.

`scripts/Inspect-SmollmMetadata.mjs` independently rehashes the local artifact, reads at most 32 MiB of GGUF metadata and exclusively writes `research/SMOLLM3_METADATA.json`. Review the embedded chat template before any generation. Static template support is not a captured rendered prompt or behavioral proof.

The language adapter's candidate selector is explicit and requires all three existing experimental observation/briefing/request flags. Its generation contexts must be MOCK_ONLY. The candidate uses the existing separated reference/question meanings, with the author's system `/no_think` control and `enable_thinking:false`; remove only the formatter-added Qwen user suffix. Preserve literal request text. Existing Qwen behavior and workbench default remain unchanged. Model family, quantization, tokenizer and required chat format differ, so outcomes are not attributable to a single isolated variable.

## Execution and stop rules

The fixed `scripts/Exercise-ConversationModelTransfer.mjs` preparation check starts no worker. Its one `--run` reserves `research/SMOLLM3_MODEL_TRANSFER_DIAGNOSTIC.json` exclusively before constructing an engine. Before native execution, freeze fixture, adapter, runner and supporting evidence hashes, review the actual candidate messages/template and pass relevant offline tests.

Use the existing b11065 CPU runtime, one model/slot, four threads, compact 128/64 batching, no weight repacking, prompt caching, 2,048 context tokens, at most 64 output tokens and 256 returned characters. Preserve existing sampling settings; no seed is fixed. No GPU offload, synthesis, microphone or automatic dialogue admission.

Admission requires at least 5 GiB available RAM and 10 GiB free disk; sample RAM every 250 ms and halt below 2 GiB. Each generation/primer has a ten-second budget, the work phase 233 seconds and cleanup seven seconds. These are reactive guards, not operating-system resource guarantees. Any invalid stream, length cutoff, cancellation, resource/deadline failure or configuration mismatch stops remaining cases. Keep rejected text null and uninvoked cases NOT_PERFORMED. A terminal stop establishes only transport completion, not factual correctness.

Record inputs/messages, source/model pins, raw complete outputs, confirmed completion reason, native timing where available, startup/primer time, initial/minimum RAM, disk and owned-worker cleanup. Inspect the actual process handle through terminal completion and independently verify that no owned model worker remains. Any surviving/unconfirmed process blocks another run. No unchanged retries: a refusal/failure must first be analyzed and preserved.

## Review and rollback

Independent whole-answer review and a second root reading assess supplied identity/value scope, conflicts, uncertainty, unsupported positive and negative outcome claims, instruction leakage and conversational usefulness. Report missing outputs separately. Complete-text time is not first spoken response time; no improvement over vanilla or release acceptance follows.

Rollback for the experiment is stopping its owned worker and leaving the unchanged default active. Preserve raw receipts and downloaded data for audit. No settings, retail assets, saves, editor state or game process is changed. A failed candidate stays diagnostic-only; authored fallback lines are not full conversational completion.
