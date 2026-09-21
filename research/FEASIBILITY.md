# Research and feasibility decision

Research date: **2026-09-20**. Scope: **MechWarrior 5: Mercenaries**, local single-player with existing AI lancemates. This is not a Clans/MWO integration, a deployment approval, or a tested prototype.

Evidence labels used throughout:

- **OBSERVED:** established by a named local observation, not inferred from earlier conversations.
- **DOCUMENTED:** supported by an inspected primary source, subject to its recorded version and limits.
- **PROPOSED:** project design or engineering inference, not demonstrated capability.
- **UNKNOWN/BLOCKED:** evidence or prerequisite missing; absence of a source is not proof of impossibility.

Source IDs below resolve in [SOURCES.md](SOURCES.md), with URLs, code/page locations, access dates and limitations. [ENVIRONMENT.json](ENVIRONMENT.json) preserves the local snapshot and selected metadata hashes.

**Latest source progress:** the [completed expanded collection](AI_COLLECTION_RESULT_2026-09-20.md) and subsequent [assignment](AI_ASSIGNMENT_TRACE.md), [order/job](ORDER_LIFECYCLE_TRACE.md) and [state](TACTICAL_STATE_TRACE.md) traces materially narrow the earlier unknowns. Connected native-order wrappers, follow-target/formation writes, tactic selection and actual observation declarations are now mapped. Native authority/scheduling, live binding, complete manual-origin detection and the shipping transport remain unverified. The [current readiness synthesis](../design/TACTICAL_CONTROL_READINESS.md) governs the next passive-probe preparation; older source-unavailable statements below are historical where these traces explicitly supersede them.

## Decision and route comparison

**The desired companion is plausible enough for a bounded bridge investigation, but reliable external read-and-command control is not yet established.** PGI documents native orders; original-author code provides one-way runtime export precedents. None of the inspected evidence completes designated-AI identity -> external command -> native accepted order -> observed behavior on this installation. [B02-B07]

**Recommendation (PROPOSED): Route 3 as a gated development direction**, beginning with deterministic integration research, not voice or a finished companion. A narrow adapter may preserve native locomotion/combat while adding conversation and occasional high-level orders. That hypothesis fails if the game's order/authority path cannot be reached safely through a maintainable shipping deployment. Resolve that before committing to the product architecture.

**Fallback (PROPOSED): Route 2**, explicit push-to-talk commands translated into existing menu inputs, with human supervision and honestly limited awareness. It can provide useful voice orders if validated, but cannot claim durable actor identity, complete telemetry or native acknowledgements. Route 1 is easier but does not meet the lancemate-control goal. Route 4 is a separate research project and not the default build.

| Dimension | 1. Conversation only | 2. Existing input translation | 3. Narrow game adapter | 4. Autonomous co-op client |
|---|---|---|---|---|
| Integration evidence | Voice/text APIs documented [V01] | Native menu orders and local key mappings [B03,L04]; input automation untested here | Mod cooking and one-way export code [B02,B06,B07]; bidirectional bridge unproven | Co-op documented [B01]; no inspected autonomous-client implementation |
| Experience | Named conversational radio partner | Voice-operated native squad menu | Potentially grounded, persistent AI lancemate using native combat | Potentially independent cooperative player; far beyond initial scope |
| Control reliability | No control | Vulnerable to menu/focus/remap/selection races | Potentially strongest, only after identity/authority/readback gates | Perception and continuous input errors; combat competence unknown |
| Game awareness | User-supplied facts | Screens/UI or separately proven telemetry; no inherent state feed | Only fields actually exposed and verified | Screen-limited, occlusion-sensitive; no privileged game state assumed |
| Latency | Voice/network/model pipeline | Pipeline plus input/UI delays | High-level cloud delay can sit outside combat loop; IPC unmeasured | Continuous observe/decide/act loop; no combat timing evidence |
| Hardware burden | Small local audio process if cloud-assisted | Similar plus optional screen processing | Small adapter intended; real overhead unknown | Another client/session and observation/inference; high potential burden |
| Development effort | Lowest relative effort | Moderate, with fragile focus/state handling | Highest initial integration uncertainty, narrower eventual runtime | Very high: gameplay skill, session management, perception, control |
| Ongoing cost | Voice/model usage | Voice/model usage; optional automation tool/license | Voice/model usage after deterministic bridge | Extra runtime/account/licensing prerequisites and potentially frequent vision/model usage |
| Compatibility | Little direct game coupling | HUD/key/menu dependent | Build/asset/controller/mod dependent | UI, networking, game update and input dependent |
| Maintenance | Prompts/audio/memory | Binding/menu regressions | Versioned adapter and test matrix | Entire autonomous-agent stack |

These comparisons are engineering estimates of relative burden, not measured hours, prices, success rates or latency.

## Environment inventory

The bounded follow-up is complete in [BRIDGE_INSPECTION.md](BRIDGE_INSPECTION.md), with [refreshed metadata](BRIDGE_ENVIRONMENT.json). It found a shipping receipt reporting UE4 **4.26.2**, declared Victory/LowEntry dependencies, and concrete upstream synchronous file-I/O functions. It also narrowed native command tracing to the author's Lance Status UI lead. These are inspection leads, not a working bridge. The official editor is free through Epic even for Steam owners; buying the game again is unnecessary under PGI's published policy. [F01–F07]

**Editor installation is complete.** Epic recorded success at **18:26:42 -04:00** on 2026-09-20. [Post-install metadata](EDITOR_POSTINSTALL.json) identifies **1.1.390.0e / UE4.26.2 / compatible CL14830424**, a completed manifest and the bundled project. [Completion evidence](EDITOR_COMPLETION.json) records the unchanged retail identity, matching engine fields, relevant hashes and approximately **10.47 GiB free at that time**. Earlier readiness snapshots remain historical. Actual allocated footprint, future cache allowance, source contracts and shipping compatibility remain unverified. The [subsequent source session](EDITOR_SOURCE_SESSION_2026-09-20.md) records named asset/fragment inspection, a diagnostic commandlet failure before API output and the existing GUI's shader compilation. No gameplay test occurred. [I03,I04]

The selected directory already is a dedicated project, so no nested duplicate project was created. Initially it contained only an empty Git repository on an unborn master branch. No applicable parent AGENTS.md was found at the checked ancestors; this sprint added project-local rules. No remote repository was created or published.

| Item | OBSERVED result and limits |
|---|---|
| OS/host | Windows 10 Home 22H2, 19045.6466 x64; registry reports MSI GS66 Stealth 10SF [L02] |
| CPU/GPU | i7-10750H; NVIDIA RTX 2070 with Max-Q Design; NVIDIA utility reports 8192 MiB and driver 596.49 [L02] |
| RAM/storage | Original probe: 16,988,229,632 physical bytes, about 15.82 GiB; about 4.87 GiB available; C: free 87,109,648,384 bytes, about 81.13 GiB [L02]. These are historical measurements. The in-progress 14:18 snapshot records 219,293,528,064 free bytes; changing allocation prevents comparison with the earlier pre-install requirement as a current sufficiency test [EDITOR_READINESS.json](EDITOR_READINESS.json) |
| Installed game | Steam app 784080 at `C:\Program Files (x86)\Steam\steamapps\common\MechWarrior 5 Mercenaries`; game_info.xml reports 1.14.390 / CL456620 / Main_Release-390_Shipping_CL456620; Steam build 24241637 [L01] |
| Distribution | Steam game installation directly observed. The original Epic manifest-absence observation is historical; the user has since started the official editor installation through Epic. No Epic game installation or repurchase is needed or established |
| DLC/edition | Base Mercenaries identity verified. Complete edition/bundle and entitlement unknown. SeenDLC.json contains tags 1-7; Steam manifest lists an additional DLC-tagged depot. Neither proves complete installed/enabled/owned DLC. No inference from PAK filenames [L01] |
| Mods | Local Mods contains only modlist.json; empty modStatus. Three downloaded Workshop items below; effective enabled state and load order UNKNOWN [L03] |
| Editor/engine | Completed Epic package **1.1.390.0e** and retail receipt both report **UE4.26.2 / compatible CL14830424** [I03]. Publisher ABI/source and shipping compatibility remain unverified. Earlier readiness/absence observations are historical. Free Epic editor access required no Steam-game repurchase [F03] |
| Development tools | Git 2.53.0.windows.3 and Node 24.19.0 run. dotnet exists but --list-sdks returns no entries. Python PATH entry is a WindowsApps alias, not a verified development interpreter; cl/cmake not found on PATH. Bundled document tools were usable for PDF research, not a verified MW5 build toolchain [L05] |
| Access | Local PowerShell/filesystem and public web search/fetch work. CIM/WMI queries denied; registry/.NET/NVIDIA read-only fallbacks succeeded. Initial browser tooling disabled native APIs [L02,L05]. A later dedicated native-tool attempt could read Epic accessibility text, but screenshot/coordinate failures prevented reliable installer interaction; see [installation history](EDITOR_INSTALLATION.md). No game UI inspected |

The narrow process-name check found no matching MW5/editor process at probe time. It does not certify absence under another executable name. Saved config/log directory names were inspected; save contents and unrelated personal/employer files were not.

Downloaded Workshop metadata, **not a certification of active mods**:

| Workshop folder | Display name | Version / build | Declared gameVersion | defaultLoadOrder |
|---|---|---|---|---|
| 2677921408 | Cockpit Glass | pre-0.98 / 218 | 1.14.69 | 0 |
| 2811899266 | Another MW4 Lasers | 1.0 / 33 | 1.14.70 | 8 |
| 3746349463 | Another MW4 Lasers RETRO | 1.0 / 6 | 1.14.68 | 0 |

Those declared versions are metadata, not proof of incompatibility or compatibility. The two laser packages list overlapping assets; no change or conflict resolution was attempted. TTRulez, Pilot Overhaul, YAML and Coyote were not found in the checked local mod/Workshop locations. This does not imply they are absent from every possible external archive/profile. [L03]

## A. Reading useful state

**No live telemetry was read in this sprint.** Local files establish installation/configuration, not current mission state. Structured access below remains untested on 1.14.390.

| Candidate field | Best evidenced source/update mechanism | Availability and missing evidence |
|---|---|---|
| Player pose/position | SpaceMonkey native tick -> SendFrame, local player pawn only [B07] | DOCUMENTED code precedent; units/transform/current ABI require verification. Smallest first export candidate |
| Assigned pilot identity | Lance HUD names [B03]; historical persistence support [B11] | Visible presentation documented; native durable pilot ID/roster accessor UNKNOWN |
| Assigned mech identity | Lance HUD/chassis [B03] | Native live pawn-to-campaign-mech mapping UNKNOWN, especially swaps/ejection |
| Lance slot | Selection controls/HUD; separate formation indices [B02,B03,L04] | UI selection documented; runtime slot-to-AI mapping UNKNOWN. Formation index is not persistent identity |
| Player-selected target | Target HUD/native attack action [B03] | Live accessor, target lifetime and hostile-team validation UNKNOWN |
| Current AI order | PGI command feedback [B04] | UI feedback documented; structured getter/acceptance callback UNKNOWN |
| Mission phase/instance | Objective/mission scripting [B03,B05] | Lifecycle/epoch and pause/menu/loading signals UNKNOWN for adapter |
| Armor/component damage | Player/target HUD [B03] | Assigned-lancemate component getter/update events UNKNOWN |
| Heat | Player HUD [B03] | AI-pawn heat readout/accessor UNKNOWN; do not narrate it from player data |
| Ammunition | Player weapon HUD [B03] | Per-weapon AI ammo accessor/consumption events UNKNOWN |
| Campaign events | Historical economic/persistent mod hooks [B11] | Complete event feed, stable IDs and reload reconciliation UNKNOWN |
| Generic event packets | MechShaker relay -> OnTelemetry hook -> shared-memory ring [B06] | Payload export documented; desired event semantics/relay definitions UNKNOWN |

Minimum proof: one corroborated changing game value, preferably player position initially, **plus separate validated identity/ownership for the commanded actor**. A packet counter or fabricated mock position is not game telemetry. The exported player field cannot support statements about the companion's health or ammo. Full campaign access is unnecessary for the first command gate.

## B. Sending one established order

**DOCUMENTED:** Form On Me is a native command, and an individual lancemate can be selected. Local config contains DispatchLanceMate1/F2, Mate2/F3 and Mate3/F4; these are input-map action names, not native callable order functions. Prefer Form On Me first because it avoids hostile-target selection. [B03,L04]

**PARTIAL:** generated editor documentation now declares `MWPlayerController.post_squad_order_class(class_, squad_command_order_info) -> None`, a typed `MWSquadCommandOrderInfo` with integer recipient IDs, and `MWSquad.get_members_for_order(...) -> Array(Controller)`. `MWMech` owns the order-context getter. The exact Form On Me graph, instance acquisition, member-to-pawn mapping, authority/thread/lifetime guards and accepted-order semantics remain unresolved. Worker/job declarations provide a concrete readback hypothesis, not a live result. The real `SquadCommandComponent` remains a graph-inspection lead; mission scripting is not automatically the player path. [I05,B02,B05]

The adapter must identify the exact current AI-controlled actor, bind a generation/session, revalidate at dispatch and avoid reassigning by slot/name after a swap. Attack-target additionally requires a still-valid hostile selected target. Human orders must invalidate pending intents. Merely sending keys or writing an IPC message cannot establish any of these properties.

Keep five observations distinct: message received; validation passed; native dispatch attempted; native order observed; behavioral effect observed. Establish a visibly different prior order/location to avoid mistaking pre-existing following for success. Use another lancemate as a negative control. [B04; design inference detailed in POC]

## C. Bridge and shipping feasibility

| Mechanism | Evidence | Verdict/limitation |
|---|---|---|
| Official content/Blueprint mod | PGI guide describes assets, cooking/packaging, activation/restart, config and input additions [B02] | DOCUMENTED deployment for supported content. Arbitrary runtime file I/O, sockets, JSON and native DLL loading NOT established |
| MechShaker native bridge | Pinned MW5-UEVR-Plugins source, MechShakerBridge class version 2.0.6, hooks ControllerFeedbackComponent/OnTelemetry and writes MMF [B06] | Concrete one-way export code; no inbound command consumer, AI selection or local-build test. Native hooks and relay dependency need review |
| SpaceMonkey | Pinned MW5 shipping profile; GPSimple exports player pose [B07] | One-way code; explicitly filters to player-controlled local pawn, so not an AI-lancemate solution |
| UE4SS | Generic Lua/C++ reflection and loader tooling [B08] | Secondary investigation only. Current MW5 support, signatures, libraries and safe order path unverified |
| Built-in file I/O / other local IPC | Retail receipt declares VictoryPlugin; pinned upstream functions read/write strings synchronously [F01,F02]. No MW5-specific bidirectional shipping implementation established | Inspect bundled fork first. Node exposure/async facilities unknown; synchronous polling is not an accepted nonblocking bridge. No HTTP/WebSocket support inferred |
| Editor Python | Generic UE4.27 documentation describes editor scripting [B09] | Not evidence of Python gameplay in cooked MW5. Receipt reports UE4.26.2; editor remains unknown. A listed Python descriptor is not shipping script support [F01] |

MechShaker/SpaceMonkey are stronger than generic engine speculation because their authors supply MW5-specific code/configuration. They remain source/document evidence, not independent deployment validation here. Total Command's target-build-matched development report explicitly stops at an editor prototype; it is not a shipping solution. [B06,B07,B10]

Native extensions can run with game-process privileges, break on build changes, collide with other hooks or crash on stale objects. The follow-up audit found direct generic reflection/tick callbacks but also raw relay hooks, stock post-build deployment, unresolved dependencies and no worker-unload handshake. The inspected UEVR root license is ALL RIGHTS RESERVED; separately MIT headers and the MW5 plugin do not license the entire stack. A direct SDK/named-pipe adapter is only a proposed fallback. Review complete source/dependencies, licenses and cleanup before any installation. Neither a mod PAK nor a source license establishes PGI support for injected native functionality. [B06-B08,F05; implementation/security assessment is PROPOSED]

PGI's announced October 6, 2026 update includes changed mod PAK loading and asset/data changes. It is a future patch preview, not installed behavior. Record builds and revalidate after updates rather than extending a 1.14.390 result to DLC9. [P03,P04]

## D. Authority and AI ownership

First design: Lewis hosts a local single-player mission, the normal controller continues possessing the AI mech, and the companion submits occasional supported native orders. **PROPOSED**, conditional on inspected authority checks. Do not possess the AI pawn or alternate direct movement with a behavior tree.

Generic Unreal server authority and an editor spawn checkbox do not prove the actual MW5 controller/RPC path. Host-only deployment, human co-op possession, client-side asset requirements, replication, reconnect and order precedence remain **UNKNOWN**. Later co-op must prove that an adapter never commands a human-owned mech and that all peers observe consistent native state. Until manual-order observation exists, autonomous/repeating orders remain disabled. [B02,B09]

## Existing mods and compatibility

All below are **author-documented research leads, not installed dependencies or locally tested combinations**. Source access and permissions are separate questions. Downloading a mod for permitted personal play does not automatically permit editing, forking or redistributing its assets. No author contact occurred.

| Family/current visible artifact | Relevant behavior/integration evidence | Source/permission status | Main collision risk |
|---|---|---|---|
| TTRulez3 Beta0.8, uploaded 2026-08-07; TTRulez2 DLC update 2026-05-28 | AI roles, formation/order behavior; TTR3 claims DLC8 support [M01,M02] | Examined page allows modifications/assets with stated attribution conditions; source archive or stable order API not established | AI/controller behavior and formations; do not combine TTR2 and TTR3 or inherit old LancemateOrderz semantics |
| Legacy 330 Pilot Overhaul 7.0.4, 2024-03-16; Eternal 8.6.1, 2026-05-26 | Eternal is permissioned continuation with DLC8-era pilot customization/state [M03-M05] | F07 adds public legacy source pin with manifest7.0.3/build776 and MIT repository license; only metadata/text inspected. Current Eternal source/API unproved; third-party asset rights remain separate | Mutable name/callsign, injuries, fatigue, death/MIA and save identity |
| YAML 0.98.5.1, 2026-09-12 | Loadouts/equipment; editor source package and External Interface 2.14 listed [M06-M08] | Source available by listed download, not inspected. Modification permission required; forks/rereleases restricted | Derived mech/equipment semantics, weapon ranges/modes, older TTR role integration text |
| Coyote 4.8.3, 2026-06-21 | Mission, secondary-lance and some AI/navmesh behavior [M09,M10] | Public source not established; modification/assets require permission; redistribution restrictions | Actor scope, mission lifecycle, second lance/tanks and AI changes |

YAML's “External Interface” concerns implementing game asset interfaces, not external-process communication. Its historical persistent-actor list is an inspection lead, not a reason to make YAML a mandatory dependency. YAML description targets 1.14.390 / Patch 2 while the current main-file note still says 1.14.389 / Patch 1; preserve this discrepancy pending artifact validation. [M06-M08]

TTR3 says Coyote missions use generic AI, while Coyote's 4.8 notes say its rerouting feature does not operate with TTRulez active. These may describe playable configurations with disabled features, not a contradiction to resolve by guesswork. Coyote distinguishes enemy/second-lance/tank repathing from ordinary lancemates. Test specific behaviors rather than promise blanket compatibility. Formation-overriding mods also need scrutiny. [M01,M09,M10]

**Minimal future configuration (PROPOSED):** stock game, stock pilot/loadout, isolated Instant Action with one AI, no optional gameplay mods and only the approved test adapter. Record DLC and active mods first. This proposal does not authorize changing the current load order or removing downloaded mods.

Later matrix, every row currently **NOT_PERFORMED**:

| Stage | Configuration | Must establish |
|---|---|---|
| 0 | Vanilla, no bridge | Native order/telemetry ground truth |
| 1 | Vanilla + bridge | Identity, dispatch, readback, behavior, human override and failures |
| 2A/2B | Stage 1 + TTR2 or TTR3 separately | Correct role/order/formation semantics and one owner of command behavior |
| 3 | Stage 1 + Eternal and required Mod Options | Rename/injury/death/reload identity and state migration |
| 4 | Stage 1 + YAML | Pawn/equipment differences, ranges/modes and target validation |
| 5 | Stage 1 + Coyote | Mission boundaries and exclusion of secondary-lance/allied actors |
| 6 | Relevant pairwise combinations | YAML/Eternal, YAML/each TTR, Coyote/each TTR, Eternal/each TTR; no transitive compatibility inference |
| 7 | Exact intended full stack | All critical gates on pinned artifacts and relevant mission types, retaining known-good reduced baseline |

## Voice, runtime and teaching

**Recommended after the bridge passes:** a lightweight local process with push-to-talk, cloud-assisted recognition/text/synthesis, deterministic common-command parsing and local validation. It conserves the verified laptop's limited shared RAM/VRAM without claiming a measured FPS advantage. Consider local speech later; no new hardware purchase is justified by these findings.

| Option | Current documented support | Project assessment |
|---|---|---|
| Chained speech -> text -> speech | gpt-4o-mini-transcribe, candidate gpt-5.6-luna text reasoning/structured outputs, gpt-4o-mini-tts [V01,V03-V05] | Most inspectable initial voice path; extra stages may add delay. Validate before native dispatch and speak success only after evidence |
| Speech-to-speech | gpt-realtime-2.1 and gpt-realtime-2.1-mini with audio/function calls [V06,V08,V14] | Later natural-conversation trial; local schema/permission validation still required; no Structured Outputs guarantee on these cards |
| Full-duplex frontend | gpt-live-1 delegates reasoning/tools to backend [V13] | Later option; open-session duration costs matter for a quiet companion |
| Local speech | OpenAI Whisper repository provides local recognition and English models [V16] | Candidate for bounded offline speech evaluation; needs dependencies/model files. No concurrent-game resource/accuracy test done. Local clips can handle routine acknowledgements without inference |

Use independent mute/disarm controls, barge-in cancellation, headphones/echo controls and short event-based chatter with cooldowns. API voice activity detection is not proof against battle-audio echo. Instrument microphone release, transcript, intent, dispatch, readback, observed effect and first audio; report distributions rather than a guessed latency. [V07; ARCHITECTURE contains proposed controls]

**Desktop control check:** the researched official ChatGPT/Codex documentation supports Windows computer use, with foreground keyboard/pointer takeover. The initial browser tool disabled native APIs; the later dedicated native-tool attempt read Epic accessibility text but hit screenshot/coordinate-geometry failures, recorded in [installation history](EDITOR_INSTALLATION.md). Neither observation establishes usable editor graph control or a continuously active MW5 combat controller. Codex should develop/review the companion; a separate bounded process should run it during gameplay. A second co-op client would need its own session, licensing/account prerequisites, rendering budget and control loop, not merely a more emphatic prompt. [V10,V11,L05]

**Teaching:** start with a personality/configuration sheet, explicit branch-aware factual memory, examples and replay evaluations. Demonstrations can be prompt examples without training weights. Current selected Luna/Realtime/Live cards do not support fine-tuning; revisit supported models only if evaluation justifies it. Model training cannot create a missing bridge or solve save lineage. Reinforcement learning for continuous piloting would need a resettable instrumented environment, action/observation space, rewards and a separate research budget; it is unnecessary for the proposed high-level companion. [V04,V06,V08,V09,V13]

## Dated example costs

**Illustrative USD usage calculations, not measured hourly prices, budget guarantees or account-access confirmation. Rates accessed 2026-09-20.** API usage follows Platform billing separately from included ChatGPT/Codex subscription credits; no paid call or credential access occurred. [V12]

| Component | Standard rate used |
|---|---|
| Mini transcription | Estimated $0.003/input minute; underlying service token-billed [V03] |
| Luna text | $0.20 input / $1.20 output per million, short-context requests [V04] |
| Mini TTS | $0.60 input text / $12 output audio per million tokens [V05] |
| Realtime 2.1-mini | Audio $10 in / $20 out; text $0.60 in / $2.40 out per million [V06] |
| Realtime 2.1 | Audio $32 in / $64 out; text $4 in / $24 out per million [V08] |
| GPT-Live | $0.05/active minute, billed per second; backend extra [V13] |

Assume a 60-minute play period. These are alternative scenarios, not equivalent measured outputs:

1. **Chain:** 10 minutes sent for transcription; 100,000 aggregate billed text input tokens and 5,000 output; TTS 5,000 text-input and 6,000 audio-output tokens. `(10*0.003)+(100000*0.20+5000*1.20+5000*0.60+6000*12)/1000000 = $0.131`, approximately $0.13 with estimated transcription. TTS audio tokens are an assumed count, not an asserted number of speech minutes.
2. **Realtime:** 36,000 aggregate uncached input-audio, 6,000 output-audio, 100,000 input-text and 5,000 output-text tokens across all turns. Mini: `(36000*10+6000*20+100000*0.60+5000*2.40)/1000000 = $0.552`. Full: `(36000*32+6000*64+100000*4+5000*24)/1000000 = $2.056`.
3. **GPT-Live:** one session open for 60 billable minutes plus the same Luna text aggregate: `60*0.05+0.026 = $3.026`. Silence is billable while the session remains open. Reconnect/initialization billing requires separate accounting. [V02]

Aggregate input counts must include repeated context/history; Realtime optional transcription is additionally billed. No cache discount assumed; cache-write charges, long-context uplift, taxes, retries beyond these totals, images, additional tools and any other usage are excluded. Rates do not predict quality, latency or actual consumption. Use a local request budget governor and provider usage reporting before future approved paid evaluation; do not assume an alert is an instantaneous spending stop. [V02-V08,V13]

## Prioritized unknowns and next action

| Priority | Missing evidence | Smallest resolving step |
|---|---|---|
| 1 | Exact AI actor binding and authoritative native Form On Me entry/readback | Inspect matching editor's real input/order chain and record signatures/assets |
| 2 | Shipping-capable inbound local transport and native loading support | Inspect actual bundled Victory/LowEntry exposure and any genuine async path; native fallback audited with unresolved deployment/lifetime constraints [F02,F05] |
| 3 | Human-order interception and lifetime invalidation | Trace manual input, possession, mission/pawn destruction in the same implementation |
| 4 | Future cache/working-space allowance, shipping compatibility and DLC entitlement | Completed editor identity and current free space are recorded [I03]. Follow [EDITOR_INSPECTION.md](../design/EDITOR_INSPECTION.md); do not equate the declared package size with measured allocation or a sufficient launch/cook budget |
| 5 | Mod-specific overrides and target-build drift | Inspect actual artifacts and run staged matrix after baseline |
| 6 | Durable pilot/save lineage, event semantics | Separate disposable-save investigation after mission proof |
| 7 | Audio/model suitability and performance | Approved recorded-command evaluations and measured local/cloud trials after bridge |

The single biggest risk is **the unproven actor-specific inbound order path in a cooked game**. The prerequisite research and completed editor metadata are recorded in [BRIDGE_INSPECTION.md](BRIDGE_INSPECTION.md) and [EDITOR_POSTINSTALL_REVIEW.md](EDITOR_POSTINSTALL_REVIEW.md). The user's continuation covers the bounded source session now underway; inspect the named Lance Status UI/order and bundled I/O leads in the existing GUI once it finishes startup. [NEXT_CODEX_PROMPT.md](../NEXT_CODEX_PROMPT.md) preserves the handoff. No Play-In-Editor, retail-game control or live integration test is included.

## Validation record

Completed: narrow local metadata/hardware/tool checks and refreshed receipt/executable hashes; current primary-source research; commit-pinned bridge, SDK, Victory and legacy pilot source/metadata inspection; visual inspection of relevant official manual/editor/EULA PDF pages; cost arithmetic; project-document review. WMI denial was handled using permitted narrower reads. The old editor guide's Epic ownership condition was corrected using PGI's later announcement.

The official editor installation is **CONFIRMED** by the user's report, Epic success log and completed manifest. The checker's completed-install branch ran without errors and returned usable version metadata in [EDITOR_POSTINSTALL.json](EDITOR_POSTINSTALL.json). Historical incomplete-install output remains in [EDITOR_READINESS.json](EDITOR_READINESS.json). This is installation evidence, not editor-launch or runtime compatibility acceptance. [I03]

Unattended integration goal2026-09-20: **PARTIAL, not packaged-test-ready**. [Generated declaration extraction](evidence/editor-source/generated-stub-contracts.json) retained26selected classes from the actual editor-produced reference, with stable-source checks, SHA256 and line locations; ten class-doc truncations are explicit. The helper passed16synthetic checks under bundled Python3.7.7. The existing command model passed43cases before fixture changes and47after four identity/override/disconnection additions; model source stayed unchanged. These results do not implement the bridge, acquisition of native state or an acknowledgement timer. [I05]

**NOT_PERFORMED:** retail-game launch/control, gameplay command/input injection, live telemetry, mod/loader installation, save access/change, runtime bridge build, in-game model/voice calls, microphone capture, native acceptance, mod compatibility, latency/FPS or co-op tests. The local Zira audition is a separate completed experiment. The editor diagnostic was attempted and failed; GUI startup is progressing, not yet accepted as ready. No simulated success logs or production scaffolding were created. Public PDF/source reads and installation metadata do not count as a live integration test.
