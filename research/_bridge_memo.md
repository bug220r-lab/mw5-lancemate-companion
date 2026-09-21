# Game-side bridge research memo

Working research handoff retained for provenance. Final decisions and corrected test procedures are in FEASIBILITY.md, SOURCES.md and ../design/PROOF_OF_CONCEPT.md.

Research date/access date for all sources: **2026-09-20**. This memo records public-source inspection; no game/editor was launched, no loader installed, no process attached, no game files edited, no bridge tested. Environment inventory is owned by the parent task. The source projects below are evidence and investigation leads, not installed dependencies.

## Decision

**UNKNOWN/BLOCKED: a reliable bidirectional packaged-game bridge controlling one identified AI lancemate is not established.** The most credible product direction remains a narrow adapter to existing native AI, conditional on proving actor identity, order dispatch/acceptance, and a shipping-compatible transport. Two original-source implementations establish concrete MW5-specific *one-way* export mechanisms, while official documentation establishes real player-issued orders and moddable lance formation assets. None establishes this project's full read/command/confirmation loop on Steam 1.14.390.

Prefer an official Blueprint/content path if inspection reveals sufficient shipped capabilities. Escalate to a reviewed native runtime extension only after identifying what the official route lacks and obtaining explicit installation/runtime-control approval. Do not choose UE4SS merely because it is generic Unreal tooling. Keep input translation as a reduced-capability fallback; conversation alone cannot satisfy lancemate control.

## Traceable sources and what they prove

### B01 — PGI modding resources and FAQ

- URLs: <https://mw5mercs.com/resources/2020/01/29-modding-resources>, <https://mw5mercs.com/faq>.
- Sections: Download the Editor; Getting Started; Mission Creation Resources; FAQ question 4.
- Version: unversioned web pages, containing historic prose mixed with current links.
- **DOCUMENTED:** official editor access through Epic and supported game mod distribution mechanisms. The guide label says v2.2, but the downloaded linked guide is v2.3. The page's old statement that packaging is forthcoming conflicts with its newer guide and should not be used as current packaging status.
- Does not document telemetry, socket support, order API, or arbitrary native DLL loading.

### B02 — PGI Mod Editor Guide v2.3

- Final URL: <https://static.mw5mercs.com/docs/MW5Mercs_Mod_Editor_Guide_(v2.3).pdf>.
- Sections/pages: Creating a New Asset Mod pp.8–10; Manage Mod pp.10–11; Installing your new Mod p.12; Including External Assets / Adding New Input Events p.16; Spawning an AI 'Mech pp.18–21. Page numbering here is one-based PDF page numbering.
- **DOCUMENTED:** content substitution, new assets, cooking/packaging and in-game activation with restart. Lance formation is configured through `SquadCommandComponent` at `\Modes\MissionDirectorSystem\MissionComponents`; this is an inspection lead, not proof of an external order API. Formation diagrams distinguish player index 0; they do not supply persistent pilot identifiers. Custom input INI support and Config/Wwise asset packaging are described; no general runtime file/socket interface is established.
- **OBSERVED document inspection:** downloaded PDF; rendered and visually inspected pp.8,9,10,19,20. P9 shows formation array positions/directions. P20 shows a SpawnPoint property panel with Team ID 0 and unchecked Allow Client to Spawn. That panel alone does not establish AI authority rules in normal missions.
- Limit: guide is older than the current game. Exact editor/game compatibility and asset signatures require inspection of the installed matching editor.

### B03 — PGI game manual

- URL: <https://static.mw5mercs.com/docs/MW5Mercs_Game%20Manual.pdf>.
- Sections: Keyboard Controls p.4, HUD Overview p.11.
- **DOCUMENTED:** player commands include Attack my Target, Form On Me, Go To Location and Hold Fire/Weapons Free. F2 selects first lancemate at the selection stage and Form On Me at the order stage; F1 is whole-lance selection / attack-target command. Recheck user bindings and active UI state before any eventual automation.
- HUD documents lance names/health/chassis/positions, objectives, player heat/ammo/damage and target information. Visibility is not an API/export guarantee, and player telemetry is not assigned-lancemate telemetry.
- **OBSERVED document inspection:** rendered and visually inspected full pp.4,11 including HUD labels and keyboard legend. No command was issued.
- Version: PDF does not identify the local 1.14.390 build; control/UI documentation requires current-build validation.

### B04 — PGI command feedback update

- URL: <https://mw5mercs.com/news/2023/01/76-free-game-update-details>; title Free Game Update Details, January 17, 2023.
- Section: AI/quality-of-life bullets.
- **DOCUMENTED:** PGI announced UI feedback when issuing lancemate commands and improved command adherence. This supports looking for native feedback during the test, not assuming an accessible acknowledgement callback or guaranteed behavior.

### B05 — PGI Mission Scripting Reference

- URL: <https://mw5mercs.com/static/docs/MW5%20Mission%20Scripting%20Reference.pdf>.
- Sections: Dispatch Waves To Attack Player Lance p.4; Defend Garrison p.10; Go To Units p.14.
- **DOCUMENTED:** mission objective/dispatch scripting, including unit GUID references in mission data. Go To Units is a player-controlled-unit proximity objective. It is not an AI follow command. No reusable external-lancemate-order function was established in this document.
- Version: no current-game build identified; useful for scope boundaries, not a current adapter contract.

### B06 — sicsix MW5-UEVR-Plugins, MechShakerBridge

- Repo: <https://github.com/sicsix/MW5-UEVR-Plugins>.
- Commit observed through GitHub API: `2214b0efb862c121c79109be5ea4bb731934ac37`, commit date 2026-03-30.
- Pinned files:
  - <https://github.com/sicsix/MW5-UEVR-Plugins/blob/2214b0efb862c121c79109be5ea4bb731934ac37/README.md> — MechShakerBridge section.
  - <https://github.com/sicsix/MW5-UEVR-Plugins/blob/2214b0efb862c121c79109be5ea4bb731934ac37/src/mechshaker_bridge/MechShakerBridge.cpp> — `OnInitialize`, `OnTelemetry`, `SetupMemoryMappedFile`, `WriteToSharedMemory`; class version 2.0.6.
  - <https://github.com/sicsix/MW5-UEVR-Plugins/blob/2214b0efb862c121c79109be5ea4bb731934ac37/include/PluginExtension.h> — `AddEventHook` / `RemoveAllEventHooks`.
  - <https://github.com/sicsix/MW5-UEVR-Plugins/blob/2214b0efb862c121c79109be5ea4bb731934ac37/LICENSE>.
- **DOCUMENTED + SOURCE INSPECTED:** author describes game events captured by MechShakerRelay, hooked by native UEVR plugin and delivered to standalone MechShaker through shared memory. Source obtains player controller 0, resolves `ControllerFeedbackComponent`, and hooks `OnTelemetry`. It writes a fixed-size event ring plus write index/packet counter to `MechShakerBridgeMemory` through Windows mapping APIs. Version check and event hook lifecycle are implemented.
- **What this proves:** actual MW5-specific authored native bridge code and one-way external-consumer architecture, beyond generic Unreal speculation.
- **What it does not prove:** event semantics without relay source; companion-request receive path; AI actor selection; valid order function; acceptance; exact Steam 1.14.390 compatibility; a safe reusable command channel. The code emits event payloads but has no inbound command consumer. MMF counters alone are not authentication, replay protection or complete lifecycle identity.
- License observed: MIT, copyright 2024 Tim Butler; retain notices for copied substantial portions. This does not grant redistribution rights for MW5 assets, separate relay assets, or other dependencies. Native code runs inside the game and has ordinary process/user privileges; require a reviewed source/build chain and explicit later approval. This sprint does not recommend installing VR merely to obtain telemetry.

### B07 — PHARTGAMES SpaceMonkey MW5/UEVR telemetry

- Commit observed through GitHub API: `709c2711ac293cf0922a7c1fadf40348124ec115`, 2025-04-07.
- Pinned files:
  - <https://github.com/PHARTGAMES/SpaceMonkey/blob/709c2711ac293cf0922a7c1fadf40348124ec115/README.md> — Mech Warrior 5 Mercenaries section; UEVR configuration section.
  - <https://github.com/PHARTGAMES/SpaceMonkey/blob/709c2711ac293cf0922a7c1fadf40348124ec115/SpaceMonkeyUEVR/Release/UnrealVRMod/MechWarrior-Win64-Shipping/plugins/sm_game_config.json>.
  - <https://github.com/PHARTGAMES/SpaceMonkey/blob/709c2711ac293cf0922a7c1fadf40348124ec115/SpaceMonkeyUEVR/SpaceMonkeyUEVR/GPSimple.cpp> — `is_correct_pawn`, `tick`, `get_child_object_for_path`, transform helper.
- **DOCUMENTED + SOURCE INSPECTED:** shipping-executable-named MW5 profile selects `DerivedMech_C`, traverses child components to the pilot scene object, and applies a transform offset. `GPSimple` exports time/pose/direction through `SendFrame`; it rejects pawns unless locally controlled AND player controlled. Therefore it explicitly does not solve AI-lancemate telemetry. The old standalone MW5 loader path is marked deprecated in README in favor of UEVR.
- Minimum field with concrete native precedent: **local player's pose/position**, sampled during engine update by this implementation. It is useful for export proof; insufficient alone to validate the intended AI actor. Position units/axes are transformed in source, and the profile's floating-point representation is project configuration, not evidence of MW5's engine ABI. Never copy that flag into a new adapter without verification.
- No incoming lancemate command path/current-build validation found in inspected files. Repository displays MIT license; dependency and bundled-artifact licenses still require per-file review before reuse.

### B08 — UE4SS generic runtime extension

- Repo: <https://github.com/UE4SS-RE/RE-UE4SS>.
- Commit observed: `35d1795dfc1f6d0b7d60c4814745b69d69480324`, 2026-09-16.
- Pinned README: <https://github.com/UE4SS-RE/RE-UE4SS/blob/35d1795dfc1f6d0b7d60c4814745b69d69480324/README.md>; pinned license same commit `/LICENSE`.
- **DOCUMENTED:** Lua/C++ APIs, reflected-object tools and Blueprint loading for UE games, with proxy-DLL/game Win64 deployment. Project explicitly says game compatibility is not automatic and may require game-specific signatures/configuration. MIT license observed (copyright 2022 Narknon). License of UE4SS does not license the target game or copied game assets.
- **UNKNOWN:** current MW5 1.14.390 compatibility, required signatures, Lua I/O facilities/dependencies on the selected release, safe command invocation, and whether it is less intrusive than a reviewed existing native bridge. Generic JSON, HTTP or socket libraries do not establish their availability inside MW5. Keep UE4SS as a secondary research route.

### B09 — Epic documentation scope checks

- Python: <https://dev.epicgames.com/documentation/en-us/unreal-engine/scripting-the-editor-using-python?application_version=4.27>, Ways to Run Python Code in Unreal Editor / From Editor-only Blueprints.
- Networking: <https://dev.epicgames.com/documentation/en-us/unreal-engine/networking-overview?application_version=4.27>, Client-Server Model.
- **DOCUMENTED for generic UE4.27:** editor Python is not a cooked-game gameplay scripting environment. The standard engine network model is server authoritative. **Not version-matched MW5 deployment evidence:** these references are guardrails; local engine/editor version and MW5-specific authority must still be identified. An external Python process remains possible but needs a proven game-side bridge.

### B10 — Total Command author development report

- <https://www.moddb.com/mods/mechwarrior-5-total-command/news/mw5-total-command-development-update-010-prealpha>.
- Author LootVexGaming; September 13, 2026; target Steam 1.14.390; sections Release status / What this prototype does not provide yet / Current test package.
- **DOCUMENTED author report:** isolated editor-side allied-AI fixture. Author explicitly excludes retail cooking/installation tests, campaign pilot/Mech identity binding, persistence and host co-op from completed capabilities. It supplies no usable bridge implementation here. Concept images are declared non-gameplay. Do not cite it as packaged-game proof.

### B11 — PGI persistent actors and Blueprint exposure

- <https://mw5mercs.com/news/2020/03/34-mw5-patch>, Mod Editor Updates.
- **DOCUMENTED historically:** `MWPersistentActorInterface`, SaveGame-marked variables, `PreSave`/`PostLoad`, campaign economic hooks and selected movement/sensor functions were exposed for mods. This is concrete evidence of persistent mod-state facilities, but does not identify current campaign/pilot identity keys, trustworthy complete event history, arbitrary file I/O, or current-game compatibility. Avoid placing companion memory in main campaign saves until save semantics are proven.

## Field availability matrix

All proposed structured fields below are **untested** on the local packaged build. HUD is only a possible human/screen observation source.

| Candidate | Best established source | Availability/update evidence | Remaining work / status |
|---|---|---|---|
| Player position/pose | B07 profile + GPSimple | Runtime tick sample and export in original native code | DOCUMENTED historical native precedent; validate current build/units/ABI; preferred first export-only field |
| Assigned pilot identity | B03 lance HUD; B11 persistence is adjacent only | Visible pilot/lance information, no durable ID accessor proven | UNKNOWN native accessor and campaign identity mapping; never use display name alone |
| Assigned Mech identity/chassis | B03 lance HUD | Chassis displayed, no stable instance ID proven | UNKNOWN live pawn-to-Mech roster link, especially switching/ejection |
| Lance slot | B03 controls and HUD; B02 formation indices | UI slot selection documented, formation index is a different concept | UNKNOWN reliable slot->AI pawn mapping; first proof needs cross-checks |
| Selected enemy target | B03 HUD/controls | Current target visible; command exists | UNKNOWN accessor, team/liveness/mission validation; defer attack order |
| Current AI order | B04 UI feedback | Feedback exists; no structured current-order getter shown | UNKNOWN; inspect native dispatch and durable order state separately |
| Mission state | B03 objectives; B05 mission flow | Mission objective mechanics documented | UNKNOWN mission instance/lifecycle accessor; derive session nonce only after real boundaries are detected |
| Armor/component damage | B03 player/target HUD | Visible damage presentation | UNKNOWN assigned-pawn per-component values and event hooks |
| Heat | B03 player HUD | Displayed player value | UNKNOWN assigned-AI accessor; player heat cannot justify lancemate heat calls |
| Ammo | B03 weapon readout | Displayed player's remaining ammo | UNKNOWN assigned-AI per-weapon values and consumption hooks |
| Campaign events | B11 economic/persistence facilities | Specific historic hooks exist | UNKNOWN complete verified timeline, transaction/save/reload identities; manual user-confirmed memory initially |
| Event stream | B06 relay callback | Fixed-size event packets exported to MMF | UNKNOWN event-code definitions and whether any desired field is emitted |

## Command and authority boundaries

**Verified player-facing first action: Form On Me to one selected lancemate.** Prefer it to attack because it does not require a hostile target reference. Exact native callable function, parameter schema, owning object and game-thread/authority requirements are still UNKNOWN. `SquadCommandComponent` is a real named asset to inspect; no invented `IssueOrder`, `SetFollow`, `GetLancemate` function should appear in implementation instructions.

Record five different outcomes: request received; adapter validation passed; dispatch invoked; native state/feedback indicates order accepted for the designated actor; independently observed movement consistent with that order. A console line emitted by the adapter proves only the stages it actually measures. A moving Mech may already have been following; establish a distinct prior position/order to avoid a false positive. Demonstration should leave a second lancemate as a negative control if scenario permits.

**PROPOSED authority:** first prototype runs with Lewis in local single-player and existing game AI retaining possession. Require an observed authoritative context before mutation, restrict binding to an AI-controlled pawn in the player's current lance, and never possess that pawn. Host ownership in MW5 co-op, RPC paths, client mod requirements, replication and reconnect behavior remain UNKNOWN. Generic server architecture and the editor SpawnPoint checkbox do not resolve them. Human input must cancel queued companion actions and establish an override lease; until a reliable override hook is identified, allow only explicit single-shot commands and no autonomous order loop.

## Transport feasibility ledger

| Route | What is established | Blocker / deployment consequence |
|---|---|---|
| Official content/Blueprint mod | PGI packaging and input/config assets | Need actual runtime fields, order path, startup lifecycle and shipped bidirectional IPC; no HTTP/WebSocket/file API presumed |
| Native UEVR plugin + relay | MW5-specific one-way MMF code | In-process hooks, native dependency/load order, build/ABI drift, no request receiver or AI order implementation; VR integration is unnecessary product burden unless narrowed |
| UE4SS | Generic Lua/C++ reflection/loader tooling | MW5 support and safe command surface not demonstrated; extra loader maintenance/security review |
| External file polling | Concept only | Editor JSON export and mod INI reading are not runtime arbitrary I/O proof; atomicity and polling costs must be tested |
| External key input | Existing UI commands documented | Foreground/menu/remap/selection race; no structured acceptance or reliable identity; reduced scope only |

For a later native channel, use a project-specific named pipe/MMF with per-user ACL and handshake/session secret (PROPOSED), bounded messages, no public network listener, no cloud credentials in game. The existing MechShaker MMF name/layout is historical source evidence, not this project's proposed production protocol. Runtime hooks may crash with invalid object lifetimes or compete with other hooks. Script/native modules run with game process privileges; review dependency provenance and clean removal before approval. Do not claim PGI support for runtime injection.

## Smallest honest next experiment

**Gate 0, next bounded investigation:** locate/version a matching official editor; if absent, obtain explicit installation approval. Read the named `SquadCommandComponent` asset and native input call chain, capture actual function signatures/parameter types and authority checks. Identify exactly one live state getter (prefer position or a simple pawn status), designated-slot binding, the actual Form On Me dispatch function and native acceptance signal. Inspect shipped plugin/module inventory for transport. If transport remains absent, evaluate source-level extraction of the small runtime-export precedent rather than installing an entire stack blindly. Output an evidence table and exact proposed build/install manifest; stop before game-affecting work.

**Gate 1, later approved editor probe:** isolated mod workspace/test map with recorded version, no main saves. Use deterministic in-editor trigger for one designated existing AI actor; read one field, issue Form On Me through the existing path, and capture native state plus visual behavior. This does not pass shipping or external IPC.

**Gate 2, later approved packaged proof:** use Instant Action if it exposes the needed lance order flow; otherwise a backed-up disposable test save. Freeze game/mod hashes and mappings. Package via verified official route or separately approved native loader. External deterministic harness sends one authenticated, expiring request bound to mission epoch + pawn/pilot/slot binding. Show live state changing with game state, then order acceptance and independently observed behavior for that one actor. Keep no LLM, voice, cloud call or autonomous loop.

Required test cases before PASS: wrong/stale pawn binding; nonexistent/dead target for any later attack action; duplicate command ID (one invocation only); stale mission epoch; menu/pause/loading rejection; human override invalidation; companion exit/disconnect while ordinary AI continues; mission end/lance change invalidating binding. For first Form On Me-only interface, unsupported attack target requests must reject before dispatch. Measure timeouts and adjust only after observing the build; do not advertise invented latency.

Evidence bundle: game/editor/loader/build identities; exact mod manifest/hashes; real state samples with monotonic time and mission epoch; request/validation/dispatch/native acceptance logs; short screen recording with visible assigned slot and negative-control actor; before/after order state if available; exception/performance observations. Failure to observe acceptance or effect is NOT_PERFORMED/FAIL, never inferred from harness success.

Cleanup later: stop companion; exit game normally; deactivate only this test mod/loader additions using the recorded manifest; restore only files actually changed after verifying backup identity; restore previous mod configuration; launch clean test scenario only under the same execution approval. No installation/control/cleanup operations were performed in this sprint.

## Scratch artifacts from source inspection

Public PDFs and rendered reference pages are under `tmp/pdfs/`; no code source was executed. `pdftoppm` emitted missing Symbol/ArialUnicode font warnings, but the inspected pages rendered legibly. Bundled Python lacked `fitz`; bundled Poppler was used successfully without installing anything. Shell public HTTPS reads needed an approved network sandbox escalation; source metadata/content were fetched read-only. These are research-tool observations, not game tests.
