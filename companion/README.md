# Companion implementation workbench

This is a functioning local **offline workbench**, not an installed MW5 mod. It never attaches to or controls MW5. No native adapter or direct piloting exists yet. Default mode is disconnected; simulated dispatch requires a synthetic mission and explicit simulation arming. Every capability's game-enabled flag remains false.

From the project root, run `START_COMPANION.cmd`, or `node companion/server.mjs` and open its printed loopback URL. Stop the terminal with Ctrl+C. No autostart service is installed. Node.js 24 is the tested runtime. No npm dependency is required.

The workbench supports three independent mock recipients, human holds/releases, pause/resume, possession, damage, command-parser previews, text radio scheduling, preference persistence and bounded JSON observation replay. It does not record a microphone or play generated audio. Typed commands are parser fixtures and never issue an order or release a real human hold.

Settings only are saved in `companion/local/settings.json`; mission state is in memory and resets when the server closes. Model/runtime artifacts and component outputs live under `companion/local/`, excluded from Git. The optional callsigns/voice preferences are not confirmed pilot or game identities.

## Code contracts

- `observation.mjs`: validate frames; carry bounded mission identity history separately from received frame order; replay historical clocks. Caller-owned continuity must be retained across absent/invalid bindings.
- `control.mjs`: offline arbitration and simulated evidence only. Rejects live mode. Bounded queues/history; uncertain prior actions cannot be resubmitted as fresh orders. Fresh active human intent survives invalid control frames.
- `radio.mjs`: single speaker; mission identity, current fact references, interruption and shared chatter budget; explicit-recipient finite parser. Verified references do not prove that generated prose is entailed by those facts.
- `benchmark.mjs`: storage and release-evidence arithmetic. A supplied `GAME_OBSERVED` label is not independent verification of an actual recording.
- `server.mjs` / `public/`: local review panel. Loopback only, random process-session bearer token, origin/host checks, bounded body/requests, restrictive browser policy and preference allowlist. This endpoint is not a native transport.

Run `node scripts/Verify-Companion.mjs` for the offline receipt. Existing tactical regression assertions run without replacing their historical receipts. See [delivery contract](../design/FULL_MOD_DELIVERY.md), [mapping](../design/OBSERVATION_POLICY_MAPPING.md), [radio contract](../design/THREE_PILOT_RADIO.md), [evaluation protocol](../design/TACTICAL_EVALUATION_PROTOCOL.md) and [status](../research/IMPLEMENTATION_STATUS.md).

## Component experiments

`Install-LocalModels.mjs` downloads only project-locked official artifacts after storage preflight, checks size/hash and records licenses. It executes no upstream installer script. `Expand-LocalRuntimes.ps1` checks archive hashes, paths and expansion bounds before recording every extracted file. These setup scripts are not automatic game deployment.

`Exercise-LocalConversation.mjs` evaluates CPU Qwen3-4B using one local authenticated llama.cpp server, three synthetic persona prompts, nonthinking mode and a 64-token output cap. `--fallback` selects the pinned 1.7B model. The server is stopped afterward. No generated output is executed or played. Results measure text latency only, not first audio or in-game overhead.

Game/editor tests, microphone accuracy, accepted voices, native action acceptance, direct-control restoration, live compatibility and full release remain unverified until their corresponding experiments pass.
