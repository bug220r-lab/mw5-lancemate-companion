# Voice, models, runtime suitability: research memo

Working research handoff retained for provenance. Its initial hardware assumption was subsequently verified by the parent inventory; use ENVIRONMENT.json, FEASIBILITY.md and SOURCES.md for the final synthesis.

Access date: **2026-09-20**. This is supporting research for the parent synthesis, not a implemented companion. No API request, credential inspection/request, paid operation, microphone capture, installation, or game control was performed. Hardware recommendation below uses the originally supplied i7-10750H / RTX 2070 Max-Q / 16 GB assumption until the parent inventory replaces it.

## Findings that matter

- **DOCUMENTED:** Current OpenAI sources support speech-to-speech with `gpt-realtime-2.1` and `gpt-realtime-2.1-mini`, a separate full-duplex voice frontend `gpt-live-1`, and an inspectable speech-to-text -> text agent -> text-to-speech chain. These services provide conversation and application function calling; they do not supply an MW5 state reader or order bridge. [V01-V08]
- **PROPOSED:** After deterministic game integration is proven, start voice with push-to-talk, transcription, a narrow intent/state validator, a text model, and TTS. Separating stages lets the project inspect precisely what was heard, validate a proposed action before execution, and delay the spoken success acknowledgement until actual game evidence arrives. This is a maintainability choice, not a claim of measured speed superiority.
- **DOCUMENTED:** Current desktop Computer Use supports Windows and macOS in supported regions. On Windows it operates the active desktop and foreground, moving keyboard/pointer. **OBSERVED:** the tools exposed in this session explicitly say native computer APIs are disabled; browser capability is separately exposed. Neither observation establishes MW5 control. **PROPOSED:** use Codex for development/review, and an independent minimal companion process for gameplay. Native desktop automation sharing Lewis's keyboard/foreground is a poor default concurrent combat controller. [V10-V11]
- **UNKNOWN:** end-to-end latency, correctness in noisy gameplay, actual account/model eligibility, FPS impact, local model fit, and the game-side integration. No latency/FPS/VRAM benchmark was run. No voice product demonstrates a persistent AI controller merely by speaking convincingly.

## Voice choices

| Route | Documented facility | Proposed fit and costs/limitations |
| --- | --- | --- |
| Chained STT -> text -> TTS | `gpt-4o-mini-transcribe` is currently priced; `gpt-5.6-luna` supports function calling and structured outputs; `gpt-4o-mini-tts` supports speech generation. Chained guide explicitly makes each stage inspectable/replaceable. | Preferred first voice layer after integration. Easy transcript review, deterministic grammar shortcut, validated action output, and grounded acknowledgement. Extra stages can add delay, but no measurement supports a numeric prediction. STT errors and text losing prosody remain concerns. |
| Realtime speech-to-speech | Current guide uses `gpt-realtime-2.1`. Mini has a lower rate; both accept audio and can call functions. Guide describes turn handling, interruption and WebRTC/browser or WebSocket/server transport. | Natural conversation and interruption candidate for later A/B evaluation. Function arguments still need local validation. Model cards list function calling but do not claim Structured Outputs support. Never interpret the general SDK/tool workflow as authorization to invoke arbitrary game code. |
| GPT-Live frontend plus backend | `gpt-live-1` listens and speaks concurrently and delegates reasoning/tools to an application or Responses backend. | Later immersion option; preserves separate backend enforcement. Active session time includes silence/backend work. This matters for a mostly quiet radio companion: a continuously open voice session still accrues duration charges. |
| Local speech/model processing | Not evaluated or installed in this sprint. | Potential later privacy/offline improvement, assessed separately on the verified machine. Local STT/TTS or fixed recorded acknowledgements can be introduced without replacing the controller. A whole local LLM + game may compete for GPU/RAM on the assumed laptop; that is a resource-contention inference, not a proven inability. |

`gpt-5.6-luna` is a **candidate**, not a validated MW5 decision model: its documented cost-sensitive role and structured-output support make it worth evaluating on recorded command cases. Use simple exact command parsing before the LLM; allowlist the same deterministic actions regardless of chosen model. Compare a stronger model only if evaluation reveals consequential failures. No claim that a smaller or larger model is reliable enough has been established. [V04, V09]

For model latency, instrument microphone release -> transcription complete -> validated intent -> command accepted -> independently observed order/effect -> first audible response. Report distributions and failures by configuration. Do not put cloud reasoning in movement, aiming, firing, collision avoidance, or other immediate control loops. This is a proposed separation; the game integration evidence must establish whether existing game AI can be directed without being replaced.

## Proposed radio behavior

All rules here are **PROPOSED project behavior**, not automatic guarantees of the APIs:

1. Push-to-talk by default, using an explicitly chosen microphone. Do not capture game output or other applications by default. Use headphones and echo cancellation; mute input during local playback if echo cancellation is insufficient. Avoid binding PTT to an MW5 action without checking the actual input map.
2. Immediate local earcon means only “input received.” A deterministic “order accepted” phrase requires accepted-order evidence; “following” requires independently observed state/effect according to the integration proof. Never speak success just because the model generated a function call.
3. User speech cancels queued noncritical chatter; a dedicated mute suppresses speech without changing normal game AI. Explicit cancel or human game command revokes a pending companion command; audio interruption alone is not proof that an already accepted game command was undone.
4. One short radio line per eligible event, event de-duplication, configurable cooldown and small queue. Collapse repeated damage events and expire old chatter. Silence during menus/loading unless directly asked. Offer a quiet/combat profile.
5. Prefer deterministic, locally played acknowledgement clips for predictable events, provided their recording/synthesis and voice rights are appropriate. They avoid repeated network requests. Do not clone MW4 actors or extract copyrighted game dialogue for redistribution.
6. On microphone/network/model failure: stop proposing new actions, discard expired speech, show status outside the game if needed, keep game AI and manual controls functioning. Persistent records must come from the local event ledger, not be inferred from the fact that a cloud session remains open.

Realtime VAD is documented as optional. The guide describes silence-based and semantic detection, response creation, and interruption settings; these mechanisms do not establish robustness against battle audio. [V07]

## Explicit memory and teaching

**PROPOSED:** Keep personality and behavior configuration separate from a verified campaign ledger. Prompt with a short character definition, allowed actions, current validated state, a compact set of relevant verified events, and a few examples of good concise responses, uncertain responses, and rejected commands. Expose no arbitrary shell, filesystem, browser or code-execution capability to the runtime model.

Use demonstrations first as reviewed prompt examples and replay test cases: e.g., “Follow me” -> the project's allowlisted follow intent, or an unknown actor -> refusal/request for clarification. This does not change model weights. A user correction should update a reviewable preference/config record; it must not rewrite objective campaign history.

The ledger needs campaign identity, save branch/epoch, pilot identity, event provenance and observed timestamp. An older save means later events are excluded from factual recall for that branch. Distinguish roleplay biography, user assertions, and verified game facts. Conversation history is not an authoritative campaign database.

**DOCUMENTED:** OpenAI optimization guidance starts with evaluation and prompting; it describes example outputs and model-specific fine-tuning. The current selected Luna/Realtime/Live model cards do not support fine-tuning. The optimization guide marks affected platform workflows as moving into legacy documentation. [V04-V06, V09]

**PROPOSED:** Fine-tuning is a later option only if sufficient authorized examples and evaluation show a recurring problem that prompts/configuration cannot solve, and only after checking a supported model/service. It does not create an MW5 API, current game facts, reliable save rollback memory, or a safe action validator. Reinforcement learning for actual piloting would require an instrumented resettable training environment, observations/actions, reward design and substantial evaluation. It is a separate research project, unnecessary for the proposed high-level order companion. OpenAI reinforcement fine-tuning of graded model responses is not the same as training a continuous MW5 motor controller.

## Hardware and runtime recommendation

**PROPOSED using the supplied laptop assumption:** Keep the initial runtime local and lightweight for state validation, identity/command tracking, audio I/O and records; offload speech and text inference to cloud APIs only after user approval for paid use. This reserves game-machine resources without promising a particular FPS result. Keep synchronous cloud calls off the game thread. Bound every queue, use timeouts, and allow a local deterministic command/acknowledgement path independent of cloud availability once proven.

No new GPU or second computer is justified by this research. A separate autonomous co-op client implies a second game process/runtime, its own observation/action loop, session/account/licensing prerequisites, and potentially another host; those burdens require dedicated verification. Screen recognition and input capability alone do not show co-op AI performance. The supplied laptop should not be assumed capable of two satisfactory game clients plus local inference.

## API billing versus subscriptions

**DOCUMENTED:** ChatGPT sign-in grants subscription access for Codex; API-key usage follows Platform API rates instead of included ChatGPT plan credits. The authentication guide distinguishes general OpenAI API calls, which use Platform API keys, from Codex access tokens. Codex/ChatGPT app entitlement therefore is not evidence of paid companion API entitlement or prepaid API budget. Actual user plan, credits, account availability and rate limit were not inspected. [V12]

An approved future companion would need separately configured API access and an explicit spend ceiling. Credentials belong in an OS secret store or external process configuration, never in a mod PAK, save, telemetry record, prompt, or distributable configuration. These are proposed storage boundaries; no key was requested/read.

## Dated illustrative session costs

**Calculations only, not measured costs or quoted hourly rates.** USD rates fetched **2026-09-20**, standard API pricing. The illustration uses a 60-minute play period with intermittent voice. Billable quantities below are deliberately assumed, not predictions of real tokenization or latency. Excludes tax, retries beyond the assumed aggregate, paid built-in tools, cache-write fees if applicable, regional uplift, additional transcripts/images, and all unlisted usage. No caching discount is assumed. Additional context/turns can exceed the example materially.

| Price component | Fetched rate | Source |
| --- | --- | --- |
| `gpt-4o-mini-transcribe` | Official estimated $0.003 / input minute; model is token-billed | V03 |
| `gpt-5.6-luna`, short-context standard | $0.20 input / $1.20 output per million text tokens | V04 |
| `gpt-4o-mini-tts` | $0.60 / million input text tokens; $12 / million output audio tokens | V05 |
| `gpt-realtime-2.1-mini` | Audio $10 input / $20 output per million; text $0.60 input / $2.40 output per million | V06 |
| `gpt-realtime-2.1` | Audio $32 input / $64 output per million; text $4 input / $24 output per million | V08 |
| `gpt-live-1` | $0.05 / active minute, per-second billing, backend extra | V13 |

### Example A: chained pipeline

Assume **10 total minutes sent for transcription**, **100,000 aggregate billed text input tokens and 5,000 billed text output tokens** across the text-model calls, **5,000 aggregate TTS input text tokens and 6,000 output audio tokens**. Text input includes repeated prompts/state/memory across calls; output includes any billable reasoning/tool output. TTS audio tokens are an assumed billable count; no claim converts these TTS tokens to spoken minutes.

`10 * 0.003 + 100000/1000000 * 0.20 + 5000/1000000 * 1.20 + 5000/1000000 * 0.60 + 6000/1000000 * 12 = $0.131`

Approximately **$0.13 for this assumed usage**, with the transcription portion itself an official estimate. Quiet play with cached local acknowledgements can use less API audio; different histories or long discussions can use much more.

### Example B: Realtime comparison

Assume **36,000 aggregate uncached input audio tokens**, **6,000 output audio tokens**, **100,000 aggregate uncached input text tokens**, and **5,000 output text tokens** over all responses. The input audio total includes an assumed repeated-history burden; it is not simply microphone duration. Realtime costs reprocess conversation input at successive turns and may cache matching history; optional input transcription is separately billed. [V02]

- Mini: `(36000*10 + 6000*20 + 100000*0.60 + 5000*2.40) / 1000000 = $0.552`.
- Full: `(36000*32 + 6000*64 + 100000*4 + 5000*24) / 1000000 = $2.056`.

These compare rates under identical assumed counts, not equivalent observed quality or actual model usage. Neither is an all-in guaranteed session cap. Speech-to-speech does not require a separately billed STT/TTS chain; add transcription only if the application enables it. Do not multiply the price of new audio alone and present that as total multi-turn cost.

### Example C: GPT-Live duration

Assume one already-running voice session is open for **60 billable minutes** (including silent time) plus the same Luna backend token aggregate as Example A. `$0.05 * 60 + $0.026 = $3.026`, before any applicable omitted charges. Closing the session during quiet periods changes billable duration but requires explicit reconnection/context restoration. Microphone mute alone does not close a session. WebRTC initialization can have a 15-second charge credited against running duration, so repeated unsuccessful initialization/reconnect attempts require separate accounting. [V02, V13]

Before paid evaluation, log provider usage totals and apply a local per-session budget governor that stops requests. A provider billing dashboard or budget alert must not be presumed to be an instantaneous hard stop without checking its documented behavior.

## Evidence register for synthesis

All accessed **2026-09-20**. Applicability is the named current API/product documentation, not MW5. Live pages are mutable; model aliases and prices must be rechecked when implementation begins. Pages were actually opened, including current redirected destinations. Search snippets were not treated as proof.

| ID | Exact primary URL / section | What it supports | Limitation |
| --- | --- | --- | --- |
| V01 | https://developers.openai.com/api/docs/guides/voice-agents — Build a full-duplex voice agent; Build a speech-to-speech voice agent; Build a chained voice workflow; Evaluate your voice agent | Three voice architectures and inspectable chained stages; task-outcome evaluation | No MW5 integration/performance proof |
| V02 | https://developers.openai.com/api/docs/guides/voice-latency-cost — GPT-Live usage and costs; Realtime API usage and costs; Input transcription costs; Caching | Live active-time accounting; repeated Realtime history input; optional transcription separate; usage events | Rates are examples in this guide; use pricing/model cards for current rate; no fixed total cost from audio minutes alone |
| V03 | https://developers.openai.com/api/docs/pricing — Transcription models; Realtime and audio generation models; GPT-Live sessions | Current rate table, including mini transcription estimated $0.003/min | Model account availability and actual usage unverified; pricing modes differ |
| V04 | https://developers.openai.com/api/docs/models/gpt-5.6-luna — Overview; Pricing; Features | Candidate text model's rates, function calling and structured outputs; no fine-tuning; long-context threshold and cache-write distinction | Does not establish MW5 command accuracy; short-context standard price assumed |
| V05 | https://developers.openai.com/api/docs/models/gpt-4o-mini-tts — Pricing; Snapshots | Text/audio token rates; model and dated snapshots including 2025-12-15 | Actual voice quality and audio token count untested |
| V06 | https://developers.openai.com/api/docs/models/gpt-realtime-2.1-mini — Overview; Pricing; Features | Lower-cost Realtime model, modalities, rates, function calling, lack of structured outputs/fine-tuning | Alias shown; no account test or task benchmark |
| V07 | https://developers.openai.com/api/docs/guides/realtime-vad — Overview; Server VAD; Semantic VAD | Optional/default VAD and turn/interrupt settings | Generic speech, not battle-audio validation |
| V08 | https://developers.openai.com/api/docs/models/gpt-realtime-2.1 — Overview; Pricing; Features | Current full Realtime model and rates; reasoning can increase latency and output usage | No measured latency; no MW5 bridge |
| V09 | https://developers.openai.com/api/docs/guides/model-optimization — Model optimization workflow; Write effective prompts; Fine-tuning methods | Evals/prompt examples; model-specific fine-tuning distinctions | Page explicitly warns affected workflows moving into legacy; no training recommendation here |
| V10 | https://learn.chatgpt.com/docs/computer-use — Introduction; Set up Computer Use | Current documented Windows/macOS UI capability in supported regions | Session's actually exposed native APIs are disabled; no game-runtime guarantees |
| V11 | https://learn.chatgpt.com/use-cases/use-your-computer-with-codex — Practical tips / Understand how the task runs on each computer; Avoid parallel runs in the same app | Windows foreground keyboard/pointer contention; desktop availability prerequisites | No benchmark or guarantee for games or same-machine simultaneous player use |
| V12 | https://learn.chatgpt.com/docs/auth — OpenAI authentication; Sign in with an API key; Use Codex access tokens for enterprise automation | Subscription vs Platform API access; API usage separate from included ChatGPT credits | User's actual plan/credits uninspected; source was reached through https://learn.chatgpt.com/codex/auth redirect |
| V13 | https://developers.openai.com/api/docs/models/gpt-live-1 — Overview; Pricing | Full duplex frontend with backend delegation; $0.05/min per-second billing, backend extra | No demonstrated MW5 use, access/quality untested |
| V14 | https://developers.openai.com/api/docs/guides/realtime — Build a speech-to-speech voice agent; Beta to GA migration | Current guide uses gpt-realtime-2.1; WebRTC/server WebSocket; ephemeral client credentials and GA shape | These are external voice-service connections, not MW5 networking capabilities |
| V15 | https://developers.openai.com/api/docs/guides/text-to-speech — Introduction; Voice options | Speech endpoint and AI-generated-voice disclosure | No license to clone a game actor's voice or redistribute game audio |

## Inspection notes

Read the local OpenAI Docs skill and its model-selection reference. The skill directs current official-source search/open for this comparison; no official-docs connector was exposed, so official-domain web access was used. Native session tool instructions were inspected as the current capability boundary. No current Codex configuration or authentication secrets were needed/read. The parent is responsible for machine/game inventory. This research proves product documentation availability and supplies design reasoning; it does not prove the companion's runtime.
