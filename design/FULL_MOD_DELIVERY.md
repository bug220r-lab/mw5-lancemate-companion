# Complete mod delivery contract

Approved by the user on 2026-09-21. This is the current product scope; historical reports and receipts remain evidence for their original artifacts. Current work is tracked separately in [IMPLEMENTATION_STATUS.md](../research/IMPLEMENTATION_STATUS.md).

Subsequent user authorization: continue until usage limits stop work; create a GitHub backup; run the game or editor when needed. Needed bounded execution is authorized, while the concrete test preparation, private source review and retail/native-deployment gates remain. Do not repeatedly request permission for already authorized application execution.

## Target

Three distinct companions occupy existing AI lancemate slots while the user plays normally. They understand spoken mission commands, give useful concise radio replies, discuss verified events with the player and each other, coordinate targets/positions/ranges and protect damaged teammates. Human input takes precedence immediately. Eventually each companion makes its own steering, aim, weapon and heat-management decisions through a dedicated local loop.

Two releases are required: **Tactical Companion**, using individually proven native AI actions, then **Direct Pilot**, adding genuine low-level piloting. The first is useful but cannot be reported as completion of the second. Source evidence and mocks cannot establish shipping behavior.

Defaults: single-player; three AI; mission-only interaction; existing laptop first; no recurring API charges. Preserve an edgy female pilot, with a composed tactician and energetic scout. Callsigns remain unset and voices configurable until accepted. Persist settings/personality; reset mission facts. Campaign memory is optional later work after stable save/pilot identity and lineage. Learn preferences through versioned playbook revisions and measured examples, not a claim of model-weight training.

## Implementation decisions

Use official content mechanisms where proven. Engine object access, identity, human precedence and immediate safeguards stay on the supported game thread. The existing observer task owns creation, initialization and cooking research. Its controller export succeeded; the next source lead is a targeted reference search for AddPlayerControllerComponents. Do not duplicate that investigation.

If a necessary official read/write/lifecycle/transport contract is missing, document it precisely and evaluate a narrow version-pinned native extension. Source/build dependencies, concrete installation manifest, teardown and rollback must exist before deployment approval. If safe control/restoration remain unproven, mark that milestone blocked.

Preserve `decideSquad(snapshot, previousState)`. Three actor-bound states share target/position coordination; unknown visibility, paths and identity remain unknown. Separate observation validation, policy, dispatch and evidence. One capability's proof enables no other capability.

Versioned **project interfaces**, not MW5 APIs:

| Interface | Required meaning |
|---|---|
| Observation frame | Mission epoch, actor/controller/pawn bindings, monotonic time/sequence, friendly knowledge and explicit unknowns |
| Mission event | Attributed human input, verified events and lifecycle changes |
| Tactical intent | Exact recipient/binding, action, prerequisites and expiry |
| Action result | Separate submission, native assignment, behavior and completion evidence |
| Pilot input | Bounded low-level controls, unavailable before ownership/restoration proof |

Transport must be bounded and nonblocking. Use a proven official asynchronous channel or reviewed private local IPC; synchronous file polling is not the fast loop. Local browser-workbench HTTP endpoints are not an MW5 adapter.

## Local speech and conversation

One shared conversation model and speech engine serve three separate persona contexts. Initial candidates: CPU whisper.cpp base.en (tiny.en fallback), CPU Kokoro-82M with approved acknowledgement cache, and Qwen3-4B Q4_K_M through llama.cpp in nonthinking mode (2,048 context, 64 output tokens). Evaluate Qwen3-1.7B if the larger model fails requirements. Start CPU-only. GPU offload requires spare-VRAM measurement alongside MW5.

Pin versions, licenses and hashes. Account for downloads, expansion/staging and caches plus at least 10 GiB working reserve before download or cooking. Do not delete unrelated files or assume new hardware. No ElevenLabs quota, subscription, cloud inference or Codex-open dependency may be required for the eventual personal runtime.

Push-to-talk first. Separate microphone mute, speech mute and control disarm. Deterministic recognized commands use the same arbiter as manual controls; unclear recipients/targets require clarification. One radio speaker at a time. Unsolicited squad chatter shares the existing 20-second budget, normally one initiating line and one reply. Player speech and verified danger interrupt banter. Detectable mission dialogue suppresses chatter; manual quiet is available if detection is missing. Output audio cannot be treated as human input. Recheck speaker, facts and freshness before playback.

Human orders hold affected recipients. Resume after matching verified completion of known nonpersistent orders or explicit release. Persistent or unknown orders never silently expire. Possession revokes control; pause clears actions/audio but preserves unresolved intent. Model/audio failure cannot block immediate control revocation. A limited authored-dialogue fallback must remain labeled incomplete relative to full conversation.

## Milestones and evidence gates

| Stage | Exit evidence |
|---|---|
| M0 Resolve integration | Verified creation, ownership, cooking and teardown; creation-only probe if required; exactly one instance through mission transitions |
| M1 Observe | Passive records match visible actors; pawn/controller/worker identity, freshness, pause/loading, possession, human provenance and destruction validated; overhead measured; zero commands |
| M2 One command | One designated AI transitions from verified non-follow baseline to Form On Me; native assignment plus independent movement; unaffected sentinel; measured human override; stale, duplicate, rejection, disconnect/restart cases |
| M3 Evaluate tactics | Real observation mapping, correctly timed replay and independently annotated situations; documented threat/range/safety derivation; unavailable prerequisites stay unknown; no auto-dispatch |
| M4 Tactical autonomy | One-AI regroup first; individually prove focus and reposition; expand to three after isolation/failure gates; complementary ranges, reservations, target retention, damage protection and bounded recovery |
| M5 Tactical Companion release | Local recognition, grounded conversation, three accepted voices/personas and pilot exchanges; spoken commands only verified capabilities; launcher, settings, diagnostics and rollback |
| M6 Control ownership | Identify all native movement/aim/fire writers; exclusive ownership and restoration for one AI without breaking physics/weapons. Dropship/mech-swap scripts are leads, not a general takeover API |
| M7 Direct piloting | Movement/stop, aim/tracking, single weapon, heat/ammo, combined one AI, then three. Proposed 20 Hz controls and 2–5 Hz tactics require measured deadlines/jitter |
| M8 Full acceptance | Matched vanilla/style comparison, sustained/offline/failure tests, reproducible personal package, supported configuration and removal manifest. Three conversational direct pilots must pass |

Independent local mapping, benchmark tools, annotations and speech evaluation may proceed while M0–M2 are blocked. Each mutable artifact set has one owner. Every game-affecting experiment needs its exact artifacts, disposable Instant Action setup or backed-up disposable save, baseline, stop conditions and rollback before authorization. No main-campaign-first test.

## Acceptance

Preserve original 48 scenario, 31 independent adversarial and three property checks. Add identity/duplicate binding/possession; persistent/completed/released/missing orders; stale/reordered/reconnect/world/action availability; lost visibility/routes/conflicts; voice ambiguity/echo/wrong speaker/staleness/interruption; component failure and watchdog restoration cases. Zero wrong-recipient dispatch or human-precedence violations in release suite. Native evidence and independently observed behavior are both required.

Proposed requirements (not measurements):

- p95 frame time at most 10% worse than matched vanilla.
- At least 2 GiB available system RAM and 1 GiB spare VRAM at peak accepted workload.
- At least 95% correct intent **and** recipient across 100 representative recordings; ambiguous cases do not execute.
- p95 transcription completed within 1.5 seconds of push-to-talk release.
- p95 first spoken conversational response within 4 seconds; stale responses discarded.
- Initial control restoration target 150 ms after detecting invalid control/observations; separately measure complete human override latency. Sampling frequency is not proof.

If a requirement fails, optimize or downgrade optional work and retest; do not weaken safeguards or silently substitute authored responses.

Benchmark 12 cells × three repetitions × vanilla/Tactical/Direct = 108 observed runs on the recorded comparison configuration. Reuse seeds only if reliably exposed. Predeclare mission success, lance losses and damage efficiency `damageDealt / max(1, damageTaken)`. No aggregate success/loss regression; target candidate median efficiency at least 10% above vanilla median. Report per-cell regressions, variation and paired metrics; a schema checker cannot verify source evidence by itself.

Personal style: approved user gameplay and explanations for calibration; 40 held-out decisions from different sessions; at least 80% acceptable against recorded preferences. The earlier reference video is not the user's gameplay.

Complete a 60-minute all-three session with conversation, pause/resume, mech swaps, transitions and component failures; repeat accepted workload offline. No internet-required inference path.

## Release contents and completion

One launcher and compact per-pilot settings/control panel: modes, autonomy, push-to-talk, voices, quiet and disarm. Detailed native diagnostics stay behind an advanced view. Package exact mod/runtime/model versions, licenses, hashes, supported build/hardware evidence and manifest-driven removal. Stock Instant Action first. Existing mods are separate compatibility tests; no universal compatibility or mandatory YAML/TTRulez/Pilot Overhaul/Coyote.

Complete only when all three converse, coordinate, directly pilot, yield reliably and pass selected quality/resource tests. If essential control/hardware requirements remain unresolved, preserve the working intermediate release and explicitly report the final goal unachieved.

Primary model references: [whisper.cpp](https://github.com/ggml-org/whisper.cpp), [Kokoro](https://huggingface.co/hexgrad/Kokoro-82M), [Qwen3-4B](https://huggingface.co/Qwen/Qwen3-4B-GGUF), [llama.cpp](https://github.com/ggml-org/llama.cpp). Actual selected files are recorded in the local lock/installation receipts, not inferred from these moving landing pages.
