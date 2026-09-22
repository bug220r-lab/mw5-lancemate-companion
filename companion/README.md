# Companion implementation workbench

This is a local **offline workbench** with synthetic tactical exercises and optional local conversation/voice previews. It never attaches to or controls MW5. No native adapter or direct piloting exists yet. Default mode is disconnected; simulated dispatch requires a synthetic mission and explicit simulation arming. Game-enabled capabilities remain unavailable.

Each pilot now has an **Action status** button. After simulating recommendations, it reports only the stage actually present in the simulated ledger: submission does not mean acceptance or movement. Without a report it states uncertainty. These fixed authored previews use no model, generate no audio and expire after five real seconds. They are a limited status mode, not full conversation. See [the admission contract](../design/MISSION_SPEECH_ADMISSION.md). Free-form generated auditions remain unverified; both tested Qwen candidates failed factual-boundary checks.

The larger 4B model has also been evaluated under explicit resource guards. Earlier attempts hit memory or response limits. A separate [prefix-cache experiment](../research/QWEN4B_PROMPT_CACHE_RESULT_REVIEW.md) completed twelve answers but failed six factual cases; ten answers exceeded four seconds before voice synthesis. It is not accepted for factual mission dialogue. The workbench's smaller-model default and disabled cache default are unchanged.

A subsequent [eight-case identity diagnostic and independent review](../research/QWEN4B_IDENTITY_RESULT_REVIEW.md) supplied the selected actor, personality key and callsign explicitly. All texts completed, but all six actor/state cases failed attribution or factual requirements. Both callsign facts were correct; one answer also failed the predeclared naturalness requirement. Seven of eight texts exceeded four seconds before synthesis. Fixing the context data path did not establish reliable conversation; this is actual local inference on synthetic inputs, with no game, microphone or playback involved.

From the project root, run `START_COMPANION.cmd`, or `node companion/server.mjs` and open its printed loopback URL. Stop the terminal with Ctrl+C. No autostart service is installed. Node.js 24 is the tested runtime. No npm dependency is required.

The launcher locates the existing bundled Node executable without relying on Codex's temporary PATH. `START_COMPANION.cmd --check` validates that runtime without opening a browser or starting engines; this check passed with PATH reduced to Windows system directories. An explicit `MW5_COMPANION_NODE` variable can select another full Node.js 24 executable path. The runtime files must remain installed; another computer and an actual Explorer double-click are not yet validated.

The workbench supports three independent mock recipients, human holds/releases, pause/resume, possession, damage, command-parser previews, radio scheduling, preference persistence and bounded JSON observation replay. Local conversation and voice previews now passed a three-pilot generation-and-WAV-delivery smoke using the explicitly slower audition mode. Complete WAV delivery took **5.87–6.84 seconds**, so the four-second spoken-response target has not passed. Microphone, actual listening and gameplay remain untested.

An explicit **hold-to-talk preview** is now implemented, with real microphone/browser testing still pending. It is separate from game control. Typed commands are parser fixtures and never issue an order or release a real human hold. Authored preview text is fictional; generated replies remain unverified and currently receive no live mission facts. Recognized speech is untrusted and is never automatically parsed or executed.

## Try the microphone preview

Start a synthetic mission, then click **Prepare recognition**. This checks the local pinned Whisper installation and resource reserve; it does not turn on the microphone. Hold **Hold to talk**, allow browser microphone access if requested, speak a short phrase, then release. Space/Enter also work while the talk button has focus. Recording stops before transcription begins. You may copy the result into the existing command field, review it and separately click **Parse**; this still cannot command the game.

Capture is limited to 15 seconds. Its grant expires after 20 seconds including setup/permission time, recognition after ten seconds, and text after five seconds. Releasing before permission completes cancels the attempt; if permission is later granted its tracks are immediately stopped. Muting the microphone, pausing, taking possession, resetting the mission, hiding/leaving the page or cancelling stops the preview. A browser/worker that ignores cancellation remains owned until cleanup is confirmed.

Earlier preflights refused startup while the editor was consuming memory. After its normal close, the [one-clip adapter smoke](../research/LOCAL_RECOGNITION_COMPONENT_SMOKE.json) transcribed an existing synthetic clip correctly in 2.179 seconds, exceeding the 1.5-second target. No microphone was used. Prepare recognition reports resource failures; it does not close other applications. Browser microphone indicators, real capture cleanup and human recognition quality need supervised validation. See [preview design and limits](../design/PUSH_TO_TALK_PREVIEW.md). Page launch never requests a microphone, loads models or starts playback automatically.

## Try the local voice preview

The workbench requires **5 GiB available memory and 10 GiB free disk space before each engine starts**. While engines run, memory falling below 2 GiB triggers cancellation and a request to stop its owned workers. A failed or unfinished check also blocks startup. The panel shows the reason; after freeing resources, retry explicitly. It does not close other applications or restart engines automatically. These conservative [resource checks](../design/WORKBENCH_RESOURCE_POLICY.md) do not prove sufficient capacity alongside MW5.

1. Launch the workbench using the command above. Click **Start local engines** and wait for language and voice to report `READY`. This explicitly starts the installed, pinned CPU components; opening the page alone does not load them. The launcher does not download missing dependencies.
2. Click **Start synthetic mission**. Simulation arming is unnecessary for conversation or speech.
3. For a voice audition on this machine, explicitly check **Allow slower offline auditions**. This permits a ten-second text deadline; the default remains four seconds, and the performance acceptance target stays four seconds. Changing this setting cancels pending output and resets conversation history while preserving mission identity, pause, mute and human holds.
4. Choose one of the three pilots, type a short message and click **Ask pilot**. Wait for a generated reply. Its factual content is unverified.
5. Click **Generate voice preview**, then **Listen once** when the preview reports `READY`. Synthesis creates a local WAV; playback happens only after that separate listening click. There is no automatic playback.
6. Use **Interrupt speech** to cancel current conversation/audio, **Stop engines** to stop the owned local workers, and Ctrl+C to close the workbench. Interrupting active synthesis stops its worker; use **Start local engines** to restart it before another voice preview.

Replies and audio expire. Resetting the synthetic mission, taking possession, pausing or applying speech mute invalidates affected pending output. If a preview reports `FAILED`, `CANCELLED` or an expiry error, read its diagnostic rather than treating it as a completed audition. **Speech mute** and **microphone mute** are separate controls. **Quiet mode** suppresses unsolicited chatter, and **Disarm simulation** affects simulated control rather than requested speech.

The current voice candidates are `af_bella` for the edgy companion, `am_adam` for the tactician and `af_heart` for the scout. A supported ID entered in a pilot's voice preference and saved overrides that pilot's default; blank or unsupported text falls back to the default. These are audition candidates, not accepted final voices or clones of Sarah. The [bounded browser check](../research/WORKBENCH_BROWSER_VALIDATION_2026-09-22.json) now covers the visible panels and synthetic controls; real microphone, speaker playback and user listening acceptance remain unperformed.

Settings only are saved in `companion/local/settings.json`; mission state is in memory and resets when the server closes. Model/runtime artifacts and component outputs live under `companion/local/`, excluded from Git. The optional callsigns/voice preferences are not confirmed pilot or game identities.

## Code contracts

- `observation.mjs`: validate frames; carry bounded mission identity history separately from received frame order; replay historical clocks. Caller-owned continuity must be retained across absent/invalid bindings.
- `control.mjs`: offline arbitration and simulated evidence only. Rejects live mode. Bounded queues/history; uncertain prior actions cannot be resubmitted as fresh orders. Fresh active human intent survives invalid control frames.
- `radio.mjs`: single speaker; mission identity, current fact references, interruption and shared chatter budget; explicit-recipient finite parser. Verified references do not prove that generated prose is entailed by those facts.
- `conversation.mjs`: one injected generator, three separately bounded persona histories, mission/binding/fact expiry, cooperative cancellation and unverified output. Unknown ownership/liveness revokes the affected speaker until a valid newer binding. An ignoring generator retains its sole slot until it settles.
- `local-language-model.mjs`: explicit pinned CPU llama.cpp lifecycle, owned-process startup/shutdown, bounded local authenticated inference and text-only output. No automatic downloads or game commands.
- `local-speech.mjs`: explicit CPU Kokoro worker lifecycle, three allowed voice candidates and bounded local WAV output. No microphone or speaker interface exists in the worker; the browser's explicit listening control handles playback.
- `workbench-resources.mjs`: resident-engine admission and reactive memory monitoring. Pending cancellation retains ownership of unfinished checks; ordinary healthy sampling is not a cleanup failure. The workbench stops its own engine pipeline on a breach and preserves human tactical holds.
- `local-recognition.mjs`: [bounded cold file transcription](../design/LOCAL_RECOGNITION.md) through pinned CPU Whisper CLI, with no listener. Submitted WAVs produce untrusted text only. One existing synthetic clip passed the actual adapter smoke; microphone and performance acceptance remain incomplete.
- `speech-input.mjs`: explicit capture leases, lifecycle/identity checks, bounded transcription and opaque untrusted previews. Browser capture and authenticated uploads are connected through the workbench, with fake/VM/HTTP coverage but no real microphone acceptance.
- `benchmark.mjs`: storage and release-evidence arithmetic. A supplied `GAME_OBSERVED` label is not independent verification of an actual recording.
- `server.mjs` / `public/`: local review panel. Loopback only, random process-session bearer token, origin/host checks, bounded body/requests, restrictive browser policy and preference allowlist. This endpoint is not a native transport.

Run `node scripts/Verify-Companion.mjs` for the offline receipt. Existing tactical regression assertions run without replacing their historical receipts. See [delivery contract](../design/FULL_MOD_DELIVERY.md), [mapping](../design/OBSERVATION_POLICY_MAPPING.md), [radio contract](../design/THREE_PILOT_RADIO.md), [evaluation protocol](../design/TACTICAL_EVALUATION_PROTOCOL.md) and [status](../research/IMPLEMENTATION_STATUS.md).

The independent conversation/server review initially added **32 passing injected-fake cases**, then four preview-timing cases. Another **25 Node VM cases** execute the actual client script against fake DOM/fetch/Audio APIs. They cover unverified text never becoming commands, cancellation/reset/possession/mute, asynchronous freshness, radio reservation ownership, failed shutdown reporting, disposed lifecycle, unknown actor state and safe client playback cleanup. They also verify that slower audition mode is explicit, keeps the four-second target unchanged and preserves control/identity gates.

The current [complete offline receipt](../research/COMPANION_VALIDATION.json) records the passing test count and exact file hashes, including existing suites and wrappers preserving 48 tactical scenarios, 31 adversarial cases and three properties. The file-transcription adapter adds 20 implementation cases and 39 independent review cases. Node VM checks are not browser layout, real audio or listening acceptance; no actual models or game ran in the independent fake/VM cases.

## Component experiments

`Install-LocalModels.mjs` downloads only project-locked official artifacts after storage preflight, checks size/hash and records licenses. It executes no upstream installer script. `Expand-LocalRuntimes.ps1` checks archive hashes, paths and expansion bounds before recording every extracted file. These setup scripts are not automatic game deployment.

`Exercise-LocalConversation.mjs` evaluates CPU Qwen3-4B using one local authenticated llama.cpp server, three synthetic persona prompts, nonthinking mode and a 64-token output cap. `--fallback` selects the pinned 1.7B model. The server is stopped afterward. No generated output is executed or played. Results measure text latency only, not first audio or in-game overhead.

The separate 1.7B smoke completed; it is the current workbench language-model default. CPU Kokoro produced three WAV files, and whisper.cpp transcribed six existing Zira clips. Two strict integrated attempts are preserved as [attempt 001](../research/WORKBENCH_CONVERSATION_ATTEMPT_001.json) and [attempt 002](../research/WORKBENCH_CONVERSATION_ATTEMPT_002.json): all three requests in each hit the four-second text timeout. During optimization, a separate three-greeting text diagnostic took roughly 4.1–5.3 seconds; it was not release acceptance.

The [slower-audition integration receipt](../research/WORKBENCH_CONVERSATION_BENCHMARK.json) records **PASS_LOCAL_GENERATION_AND_WAV_DELIVERY_ONLY** for all three pilots: text took 3.84–4.56 seconds, synthesis 2.02–2.39 seconds, and complete WAV delivery 5.87–6.84 seconds. All three complete deliveries exceeded four seconds. No WAV was played, no microphone/game ran, and all owned workers were confirmed stopped. The 2.45 GiB minimum available RAM was measured without an MW5 test workload. This proves local generation and file delivery, not accepted voices, first-audible-response latency or performance alongside MW5.

## Source backup

Reviewed checkpoints are stored in the private [bug220r-lab/mw5-lancemate-companion](https://github.com/bug220r-lab/mw5-lancemate-companion) repository, branch `codex/companion-foundation`. [The local backup receipt](../research/GITHUB_BACKUP.json) identifies the exact latest verified commit. Working-tree changes are not backed up until their push is verified.

This is a source/report backup. `companion/local/`, `tmp/`, raw `research/evidence/` exports and audio/media payloads remain local and are excluded. A fresh checkout needs separately restored or verified setup inputs before model/audio experiments; raw-source hash checks require the original evidence. Preserve that local evidence independently. The [source review](../research/SOURCE_BACKUP_REVIEW.json) records selection and content checks; no credentials belong in the repository.

Game/editor tests, microphone accuracy, accepted voices, native action acceptance, direct-control restoration, live compatibility and full release remain unverified until their corresponding experiments pass.
