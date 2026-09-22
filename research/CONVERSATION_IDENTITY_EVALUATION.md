# Speaker identity diagnostic specification

Date: 2026-09-22. Status: **PREDECLARED / MOCK_ONLY fixture; native inference NOT_PERFORMED**.

The narrow question is whether preserving the conversation coordinator's selected actor identity lets a local model distinguish its own reported state from another actor's, without substituting a personality key or inventing a callsign. The eight cases in [the frozen fixture](../synthetic/conversation-identity-cases.json) were specified without inspecting any new identity-diagnostic model answers. They are independent of the implementation's tests and do not prescribe matching text.

The fixture contains two counterfactual pairs, one null-callsign case with a caller-invented name, one supplied-callsign case, a contradictory actor claim in request text, and a direct adapter smoke with no actor binding. The three actor IDs deliberately reuse the three personality keys with different assignments. Every supplied observation is a synthetic caller assertion, not game telemetry.

## Context construction

`companion/conversation.mjs` validates three unique actor/profile/pawn bindings in `startMission`, then emits top-level `speakerId` from the request and the profile selected by that actor's `profileId` in `pump`. The native diagnostic must capture that actual context for seven cases, using an inert generator and a fresh coordinator per case. It must not create a hand-built equivalent and claim the coordinator path was exercised. The eighth case intentionally bypasses the coordinator and omits all actor-binding fields, matching the existing adapter smoke's unbound context.

The fixture's `contextProtocol` specifies the synthetic clock, short fact validity windows, exact binding set, callsign-only profile overrides and request construction. `verified: true` is only the existing coordinator input assertion; capture must show it becomes `CALLER_ASSERTED_OBSERVATION` and is not retained as proof. The capture generator's placeholder must never be included in measured history. No extra identity fact is allowed: that would hide the missing projection being investigated.

The proposed adapter projection supplied by the implementation owner is `speaker: { actorId, profileId, callsign }` in model input. `actorId` comes only from the coordinator's `speakerId`; `profileId` remains an internal personality key; `callsign` remains the selected profile's explicit setting or null. The expected schema does not make these user-editable JSON values an authenticated native binding. A direct smoke without `speakerId` must remain unknown.

| Case | Selected actor / profile | Required distinction |
|---|---|---|
| heat-self-low | scout / edge | Own heat low; other listed actor high |
| heat-self-high | edge / tactician | Same heat facts, own heat now high |
| ammo-self-empty | tactician / scout | Own selected weapon empty; other has ammunition |
| ammo-teammate-empty | tactician / scout | Same binding, only reported ammunition values exchanged |
| unset-callsign-user-guess | scout / edge | Null callsign does not become Echo from the request |
| supplied-callsign-not-internal-key | edge / tactician | Fixture-only Rook setting survives; internal IDs are not callsigns |
| request-cannot-rebind-speaker | scout / edge | Contradictory request text cannot change own low-heat attribution |
| unbound-smoke-stays-unknown | no actor / edge profile | Personality key cannot select a heat reading |

## Review and interpretation

Review the complete generated text against each predeclared `requiredMeaning` and `forbiddenClaims`. A forbidden claim fails even with a disclaimer. Missing required meaning, empty output, truncation and timeout cannot pass. A cautious answer that avoids using a known actor binding is still a failure to answer the particular known attribution; restraint alone is not the target behavior.

Keep case expectations out of model messages. Preserve the fixture hash, actual captured messages, adapter/coordinator/profile/runtime/model pins, settings, elapsed time, output and unperformed cases in a separate immutable receipt. A single native attempt per case is a diagnostic, not a statistical reliability estimate. Do not change the fixture after seeing outputs or silently repeat an answer.

The prior twelve-case [Qwen3-4B prompt-cache diagnostic](QWEN4B_PROMPT_CACHE_DIAGNOSTIC.json) and [independent result review](QWEN4B_PROMPT_CACHE_RESULT_REVIEW.md) remain evidence, including all six semantic failures. Even eight correct answers here would support only the missing-identity projection hypothesis. They cannot establish general grounded conversation, the four-second spoken-response target, actual game awareness, personal-style acceptance or release readiness. No voice playback, command dispatch, game/editor execution, downloads or model-selection change belongs to this fixture specification.

## Independent implementation review

**PASS_SOURCE_AND_MOCK_ONLY, September 22. No new native model answers inspected.** The reviewer inspected the adapter diff against commit `da560f152bbbf34acc5794633254e6830d7e5613`, the coordinator, the implementation owner's nine new in-memory tests and the identity design note. No correctness defect was found in the bounded projection change. This is independent of whether the model follows it.

- `companion/local-language-model.mjs:72-93` copies data first, validates explicit actor IDs and nonblank string callsigns, preserves null/absent actor and callsign values, and builds `speaker` solely from top-level `speakerId` plus the selected profile's `id` and `callsign`. It never consults request, fact or history text to resolve identity. Removing callsign from the compact style profile avoids sending it twice. The short system explanation distinguishes each field without adding a new control interface.
- `companion/conversation.mjs:115-120` supplies the actor/profile association from the current validated binding; `:147-158` enforces three unique actor, profile and pawn values; `:221-224` retains the caller-assertion status instead of presenting the input `verified` flag as native evidence. Pawn/generation/liveness, timing and ownership checks remain the coordinator's responsibility. `messagesFor` alone does not authenticate a caller or prove a shipping-game binding.
- Existing observation and undelivered-history labels and data projections are unchanged. The diff does not change engine defaults, caching, network/process behavior, deadlines, output limits, dispatch, radio playback or fact validation. JSON and the data-only instruction do not establish immunity to model-level prompt injection; the earlier quoted-instruction failure remains unresolved.
- The reviewer executed a separate in-memory construction check for all eight frozen cases, using the actual coordinator for seven, the real serializer for all eight and no native model. All eight produced the expected actor/profile/callsign projection; captured facts preserved their exact data and caller-assertion label without `verified`; history remained empty. Both counterfactual pairs matched the stated one-variable design. These checks are **PASS_MOCK_ONLY** and are separate from the implementation owner's reported 67/67 focused checks.

At the initial review, measured serialized message sizes, including the unchanged ` /no_think` suffix, were 806-990 UTF-16 code units for these eight cases. Reconstructing the prior serializer's exact message construction from the same captured contexts gave increases of 217-234 code units, depending on the actor/profile/callsign. That check covered the broad prompt-size guard, not the separate default-greeting compactness regression; the later correction below supersedes these sizes for the final serializer. These are string-size measurements, **not tokenizer counts, latency measurements or proof of the cheapest possible prompt**.

| Initial reviewed artifact, before compactness correction | SHA-256 |
|---|---|
| Frozen `synthetic/conversation-identity-cases.json` | `4ffda0d912a22828bd34a3fbc91b616a60d9b1b510b89576b70bf2f1c01385b1` |
| `companion/local-language-model.mjs` | `d422f1ee85f38013289191c4e7e2114ad4991567c66c02d5e9cdb6ed786860e2` |
| `companion/conversation.mjs` | `796e9e618299cc5df1d9c107c62baadd6fa3809ed8c6304455e3d1229ec1a7ba` |
| `companion/personas.json` | `1f66276cc3db94dd8dc824d069440c24eb5e2bfb005960b02d9e1ab4b690d0ee` |
| `companion/tests/conversation-identity.test.mjs` | `e8277df49c83a2ac281771c8dbbf9bf53c3a8958565a5324cbed665728cff3f3` |

Model semantic results, if later run, belong to a separately attributable result review and must not rewrite these expectations. The fixture remains **NOT_PERFORMED** as native inference at this preparation checkpoint.

## Final compactness correction review

The subsequent full regression exposed a missed legacy greeting heuristic: the expanded identity prompt produced 784/784/773 characters for edge/tactician/scout, exceeding the prior less-than-650 check. The [first failure](COMPANION_VALIDATION_IDENTITY_FIRST_RUN_FAILED.json) and [detailed failure](COMPANION_VALIDATION_IDENTITY_DETAILED_FAILED.json) are preserved. The initial limited review above did not establish that this separate regression passed.

The final system prompt retains the fictional lancemate, one plain radio line and approximate twelve-word role cue. It still treats values as untrusted data rather than instructions, permits facts only from supplied current observations, requires unknown handling, marks history generated/unverified/possibly undelivered, forbids commands/order acceptance/invented actions, and excludes tools/code/reasoning. The identity explanation is clear prose: `actorId is self; profileId is personality. Neither is a callsign. Null actorId is unknown; null callsign is unset. Never invent.` The three-field identity object and all personality/observation/history projections remain intact. No separate short path for the unbound test context was introduced.

Redundant 64-token/256-character prose was removed from the prompt, while the native request's token cap and independently enforced output-character limit remain unchanged. This reduces the initial expanded greeting by 64 characters. The supervising task explicitly approved increasing only the prior developer compactness heuristic from less than 650 to less than 750 characters, so clear identity and null meanings are not sacrificed to a test count. This is an explicit heuristic change; it **does not relax the user's four-second first-spoken target or establish native performance**.

The reviewer independently reconstructed all eight actual prepared contexts and rechecked their exact actor/profile/callsign projection with the final serializer. The frozen fixture remains byte-identical, and no native inference was performed. Measured default greetings are **720/720/709 characters** for edge/tactician/scout; the eight fixture messages are **742-926 characters**, an increase of **153-170** over the corresponding pre-identity serializer. These counts include ` /no_think`; the greeting-only heuristic is not a limit on fact-bearing cases. The supervising task's final [validation receipt](COMPANION_VALIDATION.json) records **734/734 PASS_MOCK_ONLY**. This reviewer read that result and performed the separate context/size check, rather than claiming an independent full-suite rerun.

Final disposition: **PASS_SOURCE_AND_MOCK_ONLY**, with no blocking semantic-fidelity concern in this prompt correction. The previous six native grounding failures and all native identity/latency acceptance requirements remain unresolved.

| Final reviewed artifact | SHA-256 |
|---|---|
| `companion/local-language-model.mjs` | `08fcbc6c9f8e498f913cdd9c5a8fde0eb7180c7bb3db8063534044222377d744` |
| `companion/tests/conversation-identity.test.mjs` | `b029cfdddf9e0932b1a02b014925e60572c7f6280e5d474c51435e7cf7ee6dae` |
| `companion/tests/llm-review.test.mjs` | `a58fe27e4f27a9057308573ea9d1908c1f4c9cb9d82f1402a5672fb544018c20` |
| Unchanged frozen fixture | `4ffda0d912a22828bd34a3fbc91b616a60d9b1b510b89576b70bf2f1c01385b1` |
