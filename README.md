# MW5 Lancemate Companion

Research snapshot: **2026-09-22**. Updated goal: **three independently coordinating AI lancemates while the user plays**, followed by progressively proven direct piloting. The mission-only experience remains in scope and the callsign is undecided. The approved [full delivery plan](design/FULL_MOD_DELIVERY.md) now includes local voice/model component work. Shipping control and gameplay improvement are not yet demonstrated.

## Current verdict

**Editor/supervisor status, September 22:** the coordinating task [closed the editor normally](research/EDITOR_CLOSE_RESOURCE_2026-09-22.json). The [supervisor is implemented](research/OBSERVER_SUPERVISOR_IMPLEMENTATION.md) for synthetic process tests and read-only native preflight. Its final independent review is **129/130, FAILED**: one synthetic descendant-cleanup case lost verified ownership. A later exact process assessment found all four recorded fixture PIDs absent; the original uncertain cleanup receipt and lock remain preserved. The latest timestamped preflight has **5.14 GiB available RAM versus the unchanged 8 GiB admission gate**. Native prompt observation/normal-close integration and the helper STOP bridge remain unavailable. **No editor/game/helper launch occurred in this continuation.** Leave the editor closed; the [future full-editor experiment](design/OBSERVER_NORMAL_EDITOR_EXPERIMENT.md) remains gated. Earlier instructions to use an already running editor are historical.

**Current implementation:** the [implementation checkpoint](research/IMPLEMENTATION_STATUS.md) records local observation/arbitration/radio components, a browser workbench, validation and local model benchmarks. Those results have their own current receipts; the original overnight receipts remain historical. The user subsequently authorized running the editor or game when needed for continued implementation. That authorization permits the bounded editor lookup below; an actual game-affecting experiment still needs concrete artifacts, a disposable scenario, baseline, stop conditions and rollback. No shipping adapter or full-mod acceptance is claimed.

**Latest passive-observer result:** the approved user-assisted [single-controller export succeeded](research/OBSERVER_CALLER_NATIVE_RESULT.md); source/default hashes and identities are verified. `InstantActionPlayerController` inherits directly from the collected controller but exposes no factory call. The startup caller remains unresolved and observer assets remain **NOT_BUILT**. Do not rerun the completed helper. The next [three-package metadata lookup](design/PASSIVE_OBSERVER_REFERENCE_LOOKUP.md) has a separate helper and pinned output manifest; its native execution remains **NOT_PERFORMED**. The [initialization/packaging investigation](research/PASSIVE_OBSERVER_PREPARATION.md) preserves the broader unresolved contract. No observer deployment or gameplay test occurred.

**Overnight implementation:** [Read the AI report](research/AI_REPORT.md), [technical appendix](research/AI_TECHNICAL_APPENDIX.md), [coverage ledger](research/AI_COVERAGE_LEDGER.md), [versioned tactical playbook](design/TACTICAL_PLAYBOOK.md) and [handoff/status](research/OVERNIGHT_HANDOFF.md). All 249 collected inventory entries have dispositions; 244 available source exports and 128 defaults have review evidence and verified hashes. The project now contains a pure offline tactical recommendation module for up to three lancemates. The [main synthetic suite](research/OFFLINE_TACTICAL_RESULTS.json) and [separate adversarial review](research/TACTICAL_INDEPENDENT_REVIEW.md) record current results. All prototype results are MOCK_ONLY; no adapter, native acceptance, gameplay improvement or direct-piloting capability is claimed.

**Next bounded milestone:** resolve the [passive observer's](design/PASSIVE_OBSERVER_HANDOFF.md) creation/cooking path, then prepare an actual manifest and isolated Instant Action experiment within the current delivery plan. Do not repeat the completed broad collection or treat a package reference as a connected function call. The milestones below are historical and superseded by the current implementation checkpoint and observer handoff.

## Earlier research verdicts — historical

**LATEST research pass complete: assignment, orders and tactical state traced.** [Readiness synthesis](design/TACTICAL_CONTROL_READINESS.md) combines [combat-role/config assignment](research/AI_ASSIGNMENT_TRACE.md), [order/job lifecycle](research/ORDER_LIFECYCLE_TRACE.md) and [current actor/state observations](research/TACTICAL_STATE_TRACE.md). The next bounded work is a passive observation design and integration manifest, using the existing evidence. Source now shows that follow jobs select the player-squad leader, generic recipient resolution is not itself an AI-only guard, and mech swapping changes pawn/controller bindings. The shipping connection, manual-input provenance and actual acceptance/movement remain unverified. No runtime or game test was created or run.

**LATEST completed: expanded AI collection.** [Verified result](research/AI_COLLECTION_RESULT_2026-09-20.md):249/249entries processed,244source exports and128class-default exports, approximately56.53MiB including the API reference, zero collection errors or audit mismatches. Five entries were skipped/deferred and are listed explicitly. [First source findings](research/AI_EXPANDED_SOURCE_FIRST_LOOK.md) show controller defaults, shared combat logic and tactical branches. Next analyze these texts; **do not rerun the collector**. Gameplay/live tactical decisions remain NOT_PERFORMED. This result supersedes preparation-stage statements below.

## Historical milestones

**Latest prepared action: expanded AI collection.** [Collect-AIResearch.py](scripts/Collect-AIResearch.py) covers a reviewed inventory of **249 assets**, including all 191 observed files in the AI directory, plus pilot skills, orders and supporting definitions. It reuses eighteen earlier source exports, attempts broader source/default text, and reports unsupported classes, partial results and missing references. [One editor action and limits](research/AI_SOURCE_COLLECTION.md). Expanded native execution is **NOT_PERFORMED**. The [milestone plan](design/AI_MAPPING_AND_EVALUATION.md) records the updated goal and prerequisites for live tactical decisions.

**Completed baseline:** [all eighteen earlier assets and API-reference text](research/COLLECTION_RESULT_2026-09-20.md) are available locally: sixteen new native exports, two reused exports, zero reported errors and approximately 26.22 MiB of source/reference data. Do not rerun that smaller helper; the expanded collector preserves and reuses its results. Successful source collection does not establish a working companion or an in-game result. Older milestones below are historical.

**Latest source milestone, 2026-09-20 22:19:** the [Blueprint export and review](research/BLUEPRINT_EXPORT_REVIEW_2026-09-20.md) succeeded for Form On Me and the lance dispatcher. Their actual graph text now exposes recipient construction, posting and failed-binding retry behavior, eliminating further screenshots for those two assets. Current-AI authority, downstream follow execution/readback and shipping transport remain unresolved; this is source progress, not a working companion or a live gameplay test.

**Editor installed and verified by Epic.** At **18:26:42 -04:00**, Epic recorded `ProcessSuccess: TRUE` and `ErrorCode: OK`. Completed package **1.1.390.0e** uses **UE4.26.2 / compatible CL14830424**, matching the refreshed Steam receipt's engine metadata. The completion snapshot recorded **10.47 GiB free**; future working-space requirements and game/mod compatibility remain unverified. See [completion evidence](research/EDITOR_COMPLETION.json), [post-install metadata](research/EDITOR_POSTINSTALL.json), [installation history](research/EDITOR_INSTALLATION.md), and the [source-inspection worksheet](design/EDITOR_INSPECTION.md). That metadata review did not launch the editor; the subsequent startup investigation is recorded below.

**Subsequent source session:** the user's continuation led to [installed order-asset inspection](research/EDITOR_ORDER_SOURCE_AUDIT.md), [serialized name evidence](research/EDITOR_SERIALIZED_NAME_EVIDENCE.json), a [telemetry audit](research/EDITOR_TELEMETRY_SOURCE_AUDIT.md), and a [bundled transport audit](research/EDITOR_TRANSPORT_SOURCE_AUDIT.md). A bounded editor commandlet attempt failed during startup before producing an API report. A separate existing graphical editor is compiling shaders; its queue is decreasing, and it was left running. The [session record](research/EDITOR_SOURCE_SESSION_2026-09-20.md) distinguishes these events from successful installation and timestamps current space observations. Current signatures, graph connections and shipping behavior remain unverified.

**Current integration milestone: PARTIAL.** The editor subsequently generated an API reference, which the [text-only inspector](scripts/Inspect-EditorPythonStub.py) extracted into a [26-class declaration report](research/evidence/editor-source/generated-stub-contracts.json). Actual recipient-array, order-posting, job-readback, position and file/JSON declarations are now known. Connected Blueprint graphs, current-actor mapping, manual supersession and bounded shipping transport remain unresolved. The [supervised procedure](design/PROOF_OF_CONCEPT.md) is gated; no live adapter exists. The command exercise now passes47synthetic cases; the new inspector passes16synthetic checks. On return, follow the [ready-window checklist](design/EDITOR_READY_CHECKLIST.md) to inspect the actual Form On Me graph; another metadata-script run is unnecessary for the declarations already captured.

**Conditionally plausible; the complete integration is NOT demonstrated.** Native lancemate orders are documented, and original-author code provides MW5-specific examples of exporting runtime data. Neither establishes a reliable external command channel to one designated AI lancemate on this installation. No bridge, mod, voice runtime or live proof was executed here.

**22:00 editor graph progress:** the user's [Activate screenshot](research/evidence/editor-source/form-on-me-activate-2026-09-20.png) now verifies Form On Me's configured FollowOrder, local-controller posting target and connected recipient/context struct. [Observed details](research/EDITOR_ORDER_SOURCE_AUDIT.md) distinguish its UI-completion callback from native acceptance. Runtime recipient selection, current-AI binding and downstream execution remain unknown. Next inspect `Dpad_LanceOrderDispatcher` recipient construction; the earlier blanket statement that no graph has been inspected is superseded for this one function.

The recommended route is a **bounded investigation of a narrow game-side adapter directing existing AI**, followed by a deterministic shipping-game proof only after prerequisites and approval. Leave aiming, firing and locomotion to the game. This division of responsibility is a proposal to test, not a verified implementation. If the bridge cannot be established, use supervised voice-to-existing-input commands as a reduced-capability fallback. A conversation-only companion remains a separate, weaker option.

**Biggest blocker:** finding and validating the current build's authoritative, actor-specific native order path together with an inbound transport that actually survives cooking and shipping. A language model cannot supply that missing connection.

**Work while the editor installs:** the [three-hour preparation plan](design/WAITING_WINDOW_PLAN.md) includes an editable [edgy female pilot persona](design/PILOT_BEHAVIOR.md), [campaign memory/branch rules](design/CAMPAIGN_MEMORY.md), and a [command contract exercise](design/COMMAND_CONTRACT.md). All **16 static radio candidates met their fixture criteria** in [separate-agent text review](research/OFFLINE_RADIO_REVIEW.md). The [memory replay](research/OFFLINE_MEMORY_EXERCISE.md) meets **92 structured expectations across 12 cases**, plus **14 independent adversarial checks**. Command and memory exercises are **MOCK_ONLY**. Live speech interaction, persistence and game integration remain untested.

**Experience preview:** read [the connected mission rehearsal](design/MISSION_REHEARSAL.md), compare [six situations in three personality styles](design/PERSONALITY_AUDITION.md), and explore [six callsigns, three alternate origins and three voice directions](design/CHARACTER_OPTIONS.md). The scene runs from a fictional briefing through withdrawal and repair discussion. All 26 spoken lines are original; none is copied from the gameplay reference. The [experience review](research/EXPERIENCE_REVIEW.md) records static checks and four focused supplemental radio cases. These previews leave tone, callsign, biography and voice choices unselected.

## What was established locally

**Local voice audition:** the user authorized a Zira trial after discussing API costs. [The clean and radio samples](audio/zira-audition-001/README.md), each 28.517 seconds with six fictional mission lines, were generated locally with zero API requests or speech API fees. File checks passed, but the user rejected the sound and requested free online AI voice alternatives. In-game behavior remains untested; the permanent voice is unset. Mission-only interaction is the user's current direction; broader written revisions are deferred.

- Windows 10 MSI GS66 Stealth 10SF; i7-10750H; RTX 2070 Max-Q with 8 GiB VRAM; approximately 16 GB RAM.
- A **Steam** installation is present: game **1.14.390**, changelist **456620**, Steam build **24241637**. The previous Epic description is not the verified installation for this sprint.
- Follow-up shipping receipt reports **Unreal 4.26.2** and declares Victory/LowEntry plugins. Concrete upstream file read/write functions are synchronous; their availability in the bundled game version is unverified.
- Three Workshop visual-mod packages are present. The game's modStatus map is empty; active mods and effective load order were not verified in-game.
- Epic editor **1.1.390.0e** installation is complete; [post-install metadata](research/EDITOR_POSTINSTALL.json) identifies UE4.26.2, the bundled project and plugin descriptors. The Steam game is still **1.14.390 / CL456620 / build24241637**. Editor/game compatibility and complete DLC entitlement remain unverified.

See the original [environment snapshot](research/ENVIRONMENT.json) and [follow-up snapshot](research/BRIDGE_ENVIRONMENT.json) for paths, hashes and limitations. Those snapshots predate the user-started editor installation. Research artifacts are project-local; subsequent editor startup also produced normal editor logs/cache data. No Steam files, saves or load order were changed by the assistant. The official editor is separately distributed free through Epic; **Steam owners do not need to buy MW5 again on Epic** under PGI's published policy [SOURCES F03](research/SOURCES.md).

## Documents

| File | Purpose |
|---|---|
| [AGENTS.md](AGENTS.md) | Research-stage permissions and evidence rules |
| [research/FEASIBILITY.md](research/FEASIBILITY.md) | Decision, route comparison, telemetry/commands, compatibility, hardware and cost |
| [research/SOURCES.md](research/SOURCES.md) | Traceable primary-source and local-observation register |
| [research/GAMEPLAY_REFERENCE.md](research/GAMEPLAY_REFERENCE.md) | Timestamped vanilla-footage observations and companion design implications |
| [research/BRIDGE_INSPECTION.md](research/BRIDGE_INSPECTION.md) | Completed follow-up: actual engine receipt, transport/order leads, editor prerequisite proposal |
| [research/EDITOR_INSTALLATION.md](research/EDITOR_INSTALLATION.md) | Current installation progress, evidence and post-install handoff |
| [design/EDITOR_INSPECTION.md](design/EDITOR_INSPECTION.md) | Source-tracing checklist and evidence worksheets |
| [scripts/Inspect-EditorInstall.ps1](scripts/Inspect-EditorInstall.ps1) | Read-only installation and version-metadata check |
| [design/WAITING_WINDOW_PLAN.md](design/WAITING_WINDOW_PLAN.md) | Three-hour budget, prepared outputs and inspection-to-build decisions |
| [design/PILOT_BEHAVIOR.md](design/PILOT_BEHAVIOR.md) | Editable persona, dialogue preview and radio discipline |
| [research/OFFLINE_RADIO_REVIEW.md](research/OFFLINE_RADIO_REVIEW.md) | Sixteen original static responses/silence plans, independently reviewed within this assistant task |
| [design/MISSION_REHEARSAL.md](design/MISSION_REHEARSAL.md) | A connected original radio scene, six-minute mission plus repair-bay coda |
| [design/PERSONALITY_AUDITION.md](design/PERSONALITY_AUDITION.md) | Eighteen original lines comparing three styles across identical situations |
| [design/CHARACTER_OPTIONS.md](design/CHARACTER_OPTIONS.md) | Unselected callsigns, alternate fictional origins, original voice directions and common reading script |
| [research/EXPERIENCE_REVIEW.md](research/EXPERIENCE_REVIEW.md) | Independent review of the scene/options and four focused supplemental cases |
| [design/CAMPAIGN_MEMORY.md](design/CAMPAIGN_MEMORY.md) | Proposed provenance, pilot identity and save-branch behavior |
| [research/OFFLINE_MEMORY_EXERCISE.md](research/OFFLINE_MEMORY_EXERCISE.md) | Executed synthetic replay and independent mutation review; semantics and limits |
| [design/COMMAND_CONTRACT.md](design/COMMAND_CONTRACT.md) | Bounded executable research model of command arbitration |
| [research/OFFLINE_COMMAND_REPORT.json](research/OFFLINE_COMMAND_REPORT.json) | Actual synthetic-case assertions and traces; MOCK_ONLY |
| [design/ARCHITECTURE.md](design/ARCHITECTURE.md) | Conditional architecture, proposed protocol, memory and failure handling |
| [design/PROOF_OF_CONCEPT.md](design/PROOF_OF_CONCEPT.md) | Gated deterministic experiment and acceptance criteria |
| [NEXT_CODEX_PROMPT.md](NEXT_CODEX_PROMPT.md) | Self-contained next bounded investigation |

Installation and metadata comparison are complete. Continue the bounded source investigation in the existing editor once startup finishes: trace **one AI lancemate's Form On Me order**, native readback/human override, one telemetry field and bundled I/O. The [current session record](research/EDITOR_SOURCE_SESSION_2026-09-20.md) preserves the failed commandlet attempt and successful ongoing shader compilation. The eventual first live proof needs separate approval: one state read and one order to one AI, with the remaining lance unaffected. Packaged-game behavior, performance, voice latency and compatibility tests remain **NOT_PERFORMED**.

## Complete file inventory

Files from the first sprint and bounded follow-up are listed below, relative to the exact project root:

`C:\Users\jlewi\OneDrive\Documents\ChatGPT\MW5 LANCEMATE COMPANION`

Main documents, observation snapshots and the read-only helper:

```text
README.md
AGENTS.md
research/FEASIBILITY.md
research/SOURCES.md
research/GAMEPLAY_REFERENCE.md
research/ENVIRONMENT.json
design/ARCHITECTURE.md
design/PROOF_OF_CONCEPT.md
NEXT_CODEX_PROMPT.md
research/BRIDGE_INSPECTION.md
research/BRIDGE_ENVIRONMENT.json
research/EDITOR_INSTALLATION.md
research/EDITOR_READINESS.json
research/EDITOR_PROGRESS_CHECK.json
design/EDITOR_INSPECTION.md
scripts/Inspect-EditorInstall.ps1
design/WAITING_WINDOW_PLAN.md
design/PILOT_BEHAVIOR.md
design/CAMPAIGN_MEMORY.md
design/COMMAND_CONTRACT.md
scripts/Exercise-CommandContract.mjs
synthetic/command-cases.json
synthetic/pilot-radio-cases.json
synthetic/pilot-radio-candidates.json
synthetic/memory-branch-cases.json
research/OFFLINE_COMMAND_REPORT.json
research/OFFLINE_RADIO_REVIEW.json
research/OFFLINE_RADIO_REVIEW.md
scripts/Exercise-MemoryContract.mjs
scripts/Review-MemoryContract.mjs
research/OFFLINE_MEMORY_REPORT.json
research/OFFLINE_MEMORY_REVIEW.json
research/OFFLINE_MEMORY_REVIEW_BEFORE_FIX.json
research/OFFLINE_MEMORY_EXERCISE.md
design/MISSION_REHEARSAL.md
design/PERSONALITY_AUDITION.md
design/CHARACTER_OPTIONS.md
synthetic/mission-rehearsal.json
synthetic/personality-audition.json
synthetic/pilot-radio-supplemental-cases.json
research/EXPERIENCE_REVIEW.md
research/EXPERIENCE_REVIEW.json
research/EXPERIENCE_PREVIEW_CHECK.json
```

Retained supporting work (research provenance, not additional implementation):

```text
research/_bridge_memo.md
research/_mods_memo.md
research/_voice_memo.md
research/_editor_followup.md
research/_order_followup.md
research/_transport_followup.md
research/evidence/editor-install-start.png
tmp/pdfs/MW5_Editor_v2.3.pdf
tmp/pdfs/MW5_Game_Manual.pdf
tmp/pdfs/editor-formation-08.png
tmp/pdfs/editor-formation-09.png
tmp/pdfs/editor-page-10.png
tmp/pdfs/editor-page-19.png
tmp/pdfs/editor-page-20.png
tmp/pdfs/manual-page-4.png
tmp/pdfs/manual-page-11.png
tmp/pdfs/MW5_Mod_Editor_EULA.pdf
tmp/pdfs/editor-eula-01.png
tmp/pdfs/editor-eula-02.png
tmp/pdfs/editor-eula-03.png
tmp/pdfs/editor-introduction-02.png
```

The source audit also retained 22 plain source/license files plus [their index](research/evidence/transport-source/INDEX.json). The index lists every filename, immutable public URL, access date and SHA256. These files were read only; retained CMake/source files are evidence, not project build instructions.

During the first sprint, automatic approval review rejected removal of interim files because it could conflict with preserving existing work. Those files and the follow-up evidence were retained. Final decisions are in the main documents above.

The [ElevenLabs mission voice audition](audio/elevenlabs-audition-001/README.md) now contains three real MP3 samples: Laura, Sarah, and Lily. Generated on the Free plan using 798 credits; 9,202 remained afterward. All three passed MP3 frame-structure checks. The user tentatively prefers Sarah but finds the audio recognizably AI-generated; naturalness needs refinement and final selection remains open. A shorter follow-up text draft is prepared, with no additional generation performed.
