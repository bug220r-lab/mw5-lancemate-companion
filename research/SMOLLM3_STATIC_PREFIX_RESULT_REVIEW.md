# SmolLM3 static-prefix experiment: independent answer review

## Pre-output commitment

September 22, 2026 locally. **PREPARATION ONLY. No output from this proposed variant has been inspected.** This reviewer will wait for the supervisor's terminal-run notification before reading its new exclusive receipt. Preserve this section verbatim and append actual results; do not rewrite criteria after seeing answers. Only this review document is authored by this workstream.

### Controlling criteria and predecessor

| Artifact | SHA-256 |
|---|---|
| Transfer fixture, `synthetic/conversation-model-transfer-cases.json` | `4f042b99c4ea8690425c7476347088cb31e5aca3fe45a4ba5ef1b966ebd5e0dd` |
| Transfer evaluation, `research/CONVERSATION_MODEL_TRANSFER_EVALUATION.md` | `ac35f68df99e5b174ac4eeb3763a59a45ba4d035687a62e416e2edb62c33944d` |
| Historical fixture, `synthetic/conversation-relative-facts-cases.json` | `ec7106cd5a0518489cd46dcea24ef8f0ab6facfbff5c31f4f8b5716a889f9108` |
| Historical evaluation, `research/CONVERSATION_RELATIVE_FACTS_EVALUATION.md` | `63aa636a9518fcba5b2b86a5bae63b3ee961f04ec577cc86cdcf9838956fda27` |
| Warm-up predecessor, `research/SMOLLM3_WARMUP_DIAGNOSTIC.json` | `ce3a0cd8238b4081433a4837782587bf35fc671e81f04251fc6d56e8dc392327` |
| Its completed review, `research/SMOLLM3_WARMUP_RESULT_REVIEW.md` | `a051d041c5be563346c34a6daa52ccdc2d5e773885f11c5f2041a7aa4dafdcc6` |

Apply the fixture review protocols, every complete `requiredMeaning` and `forbiddenClaims`, and the linked evaluation notes unchanged. The historical fixture's copied source protocols and nested `specification` criteria remain controlling. This document adds no expected answer, new score, relaxed naturalness requirement or post-output exception. Prior receipts and their source-version-specific failures remain intact.

### Exact proposed treatment and exposure

The opt-in variant **reorders the existing static instructions before variable personality data within the same system message**. Both user messages must remain byte-identical to the predecessor. The actual input contexts, observations, uncertainties, history, binding, question, model, runtime, generation settings and case order must remain unchanged. Verify the terminal receipt against the reviewed serializer and predecessor; do not presume that a syntactic reordering has no semantic effect.

Order remains discarded primer, the eight transfer cases in fixture order, then the eighteen historical regressions in fixture order. The primer retains its separate **20-second** allowance; every case retains **10 seconds**. The model remains SmolLM3-3B Q4_K_M using the same pinned runtime, CPU-only four-thread configuration, compact 128/64 batches, no weight repacking, one model/slot, caching, 2,048 context tokens, 64 output tokens and 256 characters. Resource/supervisory bounds remain 5 GiB initial RAM, 2 GiB running floor, 10 GiB disk reserve, 233 seconds work and 7 seconds cleanup. Disclose any actual additional difference.

The transfer group is now mixed exposure: **cases 1 and 2 were invoked previously and are exposed; cases 3–8 remain uninvoked**. All eighteen historical cases are exposed, even entries retaining “holdout” in their old IDs. A prior failed operation without retained text still counts as an invocation. There is no fresh eight-case or fresh 26-case claim for this variant. Track which of the remaining six are actually invoked; after that they too become exposed. Direct synthetic contexts and inert coordinator captures remain distinct from native game observations and authority.

### Independent whole-answer judgment

Read each complete answer in full and retain its exact text. A pass requires all requested meaning and no forbidden claim: correct self/other ownership, selected-weapon scope, grounded identity, preserved missing/conflicting evidence and a brief natural radio response. Missing required meaning fails even without a false statement. A correct fragment or disclaimer cannot rescue an unsupported assertion. Missing acceptance, action, completion or outcome evidence supports neither a definite affirmation nor a definite denial. User wording, quoted text and generated history are not identity settings, mission evidence or command authority.

Keep the existing presentation requirements. Echoed questions, internal source references/schema labels, tools, code, reasoning, stage directions or speaker switching cannot substitute for the spoken answer. Ordinary surrounding quotes are not automatically a failure. Distinguish a name used as a vocative from a claim of assigned identity. Record material ambiguity and seek a second independent reading instead of inventing a new wording requirement. The earlier qualified pass for a terse introduction is not an automatic pass for this run's answer.

Separate complete-answer pass/fail from an invoked failed/rejected operation and `NOT_PERFORMED`; record every ordered case. Empty, truncated, timed-out, cancelled or rejected text cannot pass. Keep terminal `stop` plus `[DONE]` completion requirements and rejection of `length`; no guessed discarded prefix or inferred semantic claim from timing. The primer is discarded and never counted as a case or injected into subsequent history. Model confidence, self-grading and authored fallback are not independent free-generation acceptance.

Report the mixed eight-case transfer group separately from the eighteen exposed regressions, with the transfer group's prior-two/remaining-six exposure explicit. A pass requires its whole case criteria, and completing the originally required screen still requires every required operation and answer. Incomplete groups are not scored by silently dropping failures or unperformed entries. Even universal success would remain a small development diagnostic, not statistical reliability, broad conversation, personal style, live factual admission or a finished mod.

### Timing and provenance boundaries

Record startup, primer, case completion/censoring and cleanup separately. The longer discarded primer is not a performance pass. The **four-second first-spoken response target is unchanged**; text-only generation time does not measure synthesized audio latency. Show failed timed operations alongside completed ones and avoid a completed-only subset presented as total-workload performance. Native cache/prompt timings may describe this run; one stochastic sequence is not a controlled causal speedup measurement or proof that caching resolves the bottleneck.

Audit source/model/runtime pins, exact original contexts/projections, reproduced transformed messages, unchanged user-message bytes, resource admission/minimums and final owned-process state. Criteria must stay outside prompts. New ordering must preserve every instruction and all supplied data; document deviations if present. Preserve the raw receipt and distinguish recorded native evidence from supervisor-reported external inventory. This reviewer performs no model execution, download, game/editor operation, microphone capture, synthesis, playback or dispatch.

## Actual result

**PENDING — no new native receipt has been read or scored by this reviewer.**

### Terminal outcome — September 22 locally / September 23, 2026 UTC

**INCOMPLETE: one exposed introduction passed its whole-answer criteria; the next exposed case timed out with no retained answer; the remaining twenty-four cases were not performed.** The six previously uninvoked transfer cases remain uninvoked. This run does not establish factual grounding, meet the full screen or demonstrate the four-second spoken-response goal.

The pre-output section above is preserved at its original SHA-256 **`302d198e871a9342f73653bc25049179fa37aeb34a4c79e285988b0bce4748d7`**. The immutable raw receipt is `research/SMOLLM3_STATIC_PREFIX_DIAGNOSTIC.json`, SHA-256 **`e0f5c52fd4be5c5d1d9baa91b93145bea567438969fc7791a394472f0d3bacb7`**. The supervisor reported execution session 33125 had exited with code 1 before this reviewer read it. Only read-only reconstruction and this append were performed; no retry, new native invocation or changed criterion was used.

#### Whole-answer verdict

The sole complete case answer, `transfer-configured-introduction`, is exactly:

> Latch, here. What do you need from me?

**PASS.** The answer gives the configured callsign as a terse radio self-identification, then asks the requested follow-up. “Here” is ordinary radio phrasing in this introduction, not an asserted mission location or a claim that movement was completed. There is no invented biography, rank, mission event, action or substituted internal identity. The answer is a complete natural turn within the fixed bounds. The supervisor independently read the full request and answer and agreed with this interpretation. The comma is slightly awkward; it does not supply a new reason to fail under the frozen criteria. This is a newly reviewed answer, not a pass transferred from the predecessor.

The second case, `transfer-counterfactual-normal-supplied`, was invoked but failed at the ten-second response deadline. Its output, finish reason and terminal native timings are null. **No semantic verdict is possible for it.** Do not infer an attribution error, correct partial answer, truncation or eventual completion from its runtime log.

#### Ordered accounting

| Order | Exposure before this run | Case | Operation / whole-answer result |
|---:|---|---|---|
| 1 | Exposed transfer | `transfer-configured-introduction` | Complete / PASS |
| 2 | Exposed transfer | `transfer-counterfactual-normal-supplied` | FAILED response deadline / semantic NOT_PERFORMED |
| 3 | Uninvoked transfer | `transfer-counterfactual-critical-empty` | NOT_PERFORMED |
| 4 | Uninvoked transfer | `transfer-caller-nickname-is-not-setting` | NOT_PERFORMED |
| 5 | Uninvoked transfer | `transfer-known-pilot-missing-thermal` | NOT_PERFORMED |
| 6 | Uninvoked transfer | `transfer-unbound-addressed-ammunition` | NOT_PERFORMED |
| 7 | Uninvoked transfer | `transfer-equal-time-thermal-conflict` | NOT_PERFORMED |
| 8 | Uninvoked transfer | `transfer-chatter-does-not-prove-extraction` | NOT_PERFORMED |
| 9 | Historical exposed | `identity-heat-self-low` | NOT_PERFORMED |
| 10 | Historical exposed | `identity-heat-self-high` | NOT_PERFORMED |
| 11 | Historical exposed | `identity-ammo-self-empty` | NOT_PERFORMED |
| 12 | Historical exposed | `identity-ammo-teammate-empty` | NOT_PERFORMED |
| 13 | Historical exposed | `identity-unset-callsign-user-guess` | NOT_PERFORMED |
| 14 | Historical exposed | `identity-supplied-callsign-not-internal-key` | NOT_PERFORMED |
| 15 | Historical exposed | `identity-request-cannot-rebind-speaker` | NOT_PERFORMED |
| 16 | Historical exposed | `identity-unbound-smoke-stays-unknown` | NOT_PERFORMED |
| 17 | Historical exposed | `history-is-not-acceptance-or-completion` | NOT_PERFORMED |
| 18 | Historical exposed | `requested-victory-is-not-evidence` | NOT_PERFORMED |
| 19 | Historical exposed | `unset-callsign-stays-unset` | NOT_PERFORMED |
| 20 | Historical exposed | `quoted-system-override-is-transcript-data` | NOT_PERFORMED |
| 21 | Historical exposed | `possible-flank-is-not-observed-flank` | NOT_PERFORMED |
| 22 | Historical exposed | `recommendation-is-not-executed-movement` | NOT_PERFORMED |
| 23 | Historical exposed | `relative-holdout-renamed-shuffled-two-metrics` | NOT_PERFORMED |
| 24 | Historical exposed | `relative-holdout-bound-speaker-missing-reading` | NOT_PERFORMED |
| 25 | Historical exposed | `relative-holdout-unbound-request-persona-hint` | NOT_PERFORMED |
| 26 | Historical exposed | `relative-holdout-conflict-and-rebinding` | NOT_PERFORMED |

Transfer group: **two previously exposed cases invoked, one complete pass and one failed operation without semantic text; six unperformed**. Historical group: **zero invoked, eighteen unperformed**. No new case became exposed. There is no full-group quality score, fresh holdout success or statistical reliability claim.

#### Prepared inputs and exact change

All **32 current source hashes** in the receipt matched their files before this append. The warm-up predecessor remains unchanged at `ce3a0cd8238b4081433a4837782587bf35fc671e81f04251fc6d56e8dc392327`. Its historical adapter and runner pins belong to the recorded predecessor Git version; the new receipt separately pins this variant's sources.

All **27 original contexts, classified contexts and projections** (26 cases plus primer) are identical to the predecessor. All case IDs and captures remain unchanged. Both user messages match byte for byte in every record. Independent reconstruction reproduced all 27 new message lists and projections and reproduced the historical message lists with the opt-in flag disabled. An independent fragment comparison confirmed that each new system message consists of the same old instruction/personality fragments, reordered as declared with separating newlines. Both fixtures and their criteria are unchanged, as are model/runtime pins.

Administrative suite/provenance labels for the eight transfer cases deliberately changed to describe their current exposure: first two `PREVIOUSLY_INVOKED_TRANSFER`, remaining six `UNINVOKED_AT_BASELINE`, with the original kind retained. These exact changes were verified and do not alter model input. Historical case provenance is unchanged. The only inference-settings addition is `experimentalStaticPrefix: true`; model, sampling, bounds and both deadlines match the predecessor. Prepared receipt entries do not establish that the uninvoked messages reached the model.

#### Primer and timing

The discarded primer completed, but it **did not follow its “Say OK.” request**. Its exact returned string, including surrounding quotation marks, was:

> "Confirmed, no speaker binding established. Weapon selection and heat unknown. No further action possible until identification is established."

This is a recorded instruction-following limitation in a non-scored primer, not a conversational pass and not an extra failed case invented after the run. The primer is excluded from every case tally and was not inserted into later prompts. Ordinary quotation marks alone are not the issue; the returned content differs from the simple requested response.

| Stage | Duration | Outcome |
|---|---:|---|
| Startup | 5,769.7724 ms | READY; PINNED_FILES_VERIFIED |
| Discarded primer | 13,091.2712 ms | Complete with `stop`; longer response above |
| Transfer case 1 | 7,375.3166 ms | Complete with `stop`; whole-answer PASS |
| Transfer case 2 | 10,006.3486 ms | RESPONSE_DEADLINE; no retained answer |
| Entire attempt | 36,396.9555 ms | INCOMPLETE; owned process stopped |

The first answer's native diagnostics record **196 cached tokens**, **186 prompt tokens** taking **6,433.915 ms**, and **12 predicted tokens** taking **931.879 ms**. The predecessor's corresponding figures were 155 cached tokens, 225 prompt tokens, 7,733.423 ms prompt evaluation, 10 predicted tokens and 8,499.8256 ms total text-return time. Thus this recorded first case reused more tokens and returned sooner. These are descriptive observations from single stochastic runs with different outputs, **not a controlled causal speedup estimate or proof the bottleneck is solved**. The second case still missed its unchanged deadline, and the longer primer left this whole attempt longer than the predecessor overall.

The only completed case still took more than four seconds to return text. No audio was synthesized or played, so the first-spoken metric was not measured. The discarded 20-second primer allowance does not relax that goal or the ten-second case limit. No representative latency percentile or eventual case-2 completion time can be inferred. `STARTUP_INTERRUPTED` is again the reused wait helper's generation-cancellation error; `RESPONSE_DEADLINE` identifies the actual failed stage after successful startup and primer completion.

#### Resources and cleanup

Initial available RAM was **5.118195 GiB**, minimum sampled RAM **3.015953 GiB**, and initial free disk **22.871197 GiB**. Admission passed and the recorded halt was a response deadline, not loss of the resource reserve. Final runtime is **STOPPED**, owned PID null, generation inactive, and `ownedProcessStopped: true`; native exit code is -1. The supervisor separately reported no matching processes in a fresh post-run inventory; this reviewer did not repeat that inventory.

Receipt flags record no download, game/editor execution, microphone capture, audio generation, playback or default change during this diagnostic. No reply was dispatched or played. The remaining questions about factual grounding and responsive full conversation are unresolved, and prior failures remain valid for their recorded versions. Raw evidence, frozen criteria and pre-output wording were preserved.
