# MW5 Lancemate Companion

Research snapshot: **2026-09-25**. Current priority is the [observer-first plan](design/OBSERVER_FIRST_GOAL.md): a passive mission observer and useful exported recordings, with no orders or AI-behavior changes. The longer-term three-lancemate/direct-piloting plan remains separate; speech and broad model work are paused. A diagnostic display alone is not a completed recorder.

## Current verdict

**Latest authoring result, September 25 at 17:22:59 UTC — PASS_EDITOR_AUTHORING_ONLY:** the [disposable authoring probe](research/EDITOR_AUTHORING_PROBE_2026-09-25.md) and [receipt](research/EDITOR_AUTHORING_PROBE_2026-09-25.json) record a new Actor Blueprint at `/Game/CodexEditorControlScratch20260925/BP_CodexAuthoringProbe`, with BeginPlay wired to Print String and the exact literal `AUTHORING PROBE - NOT RUNTIME`. Explicit compile success, Save As, closure and reopening in the **same editor process** were observed; all eight original observer file hashes and sizes still matched. This establishes a supervised editor-authoring workaround beyond the earlier [capture/navigation proof](research/EDITOR_INTERACTION_WORKAROUND_2026-09-25.md). Cold restart, package unload/reload, Save To Mod, Play, cook and retail execution were not performed in this probe. The helper's 15/15 regression checks are **MOCK_ONLY**. The diagnostic control remains unbuilt and the original missing readout remains unresolved.

**September 25 — OBSERVED:** the three original observer assets have been manually authored and reviewed, and [native packaging succeeded](research/OBSERVER_PACKAGE_RESULT_2026-09-25.md), including all three assets. The [overnight checkpoint](research/OBSERVER_OVERNIGHT_CHECKPOINT_2026-09-25.json), recorded at 06:28:26 UTC, confirms all fourteen source/package/installed file pins; the three installed files match their package counterparts. It records the original `LanceObserverProbe` installed and enabled, with game/editor processes closed at that checkpoint. These are dated observations; refresh the configuration and process state before future live work.

**Retail result — INCONCLUSIVE_READOUT_NOT_VISIBLE:** the [first Instant Action observation](research/OBSERVER_STARTUP_RESULT_2026-09-25.md) reached a mission with no custom overlay. The user also saw none earlier. This does not establish component absence. The [structured cooked-registry review](research/OBSERVER_COOKED_REGISTRY_REVIEW_2026-09-25.md) accounts for all 2,447 bytes and three asset records; the registration class matches the stock factory filter. The [independent graph audit](research/OBSERVER_STARTUP_GRAPH_AUDIT_2026-09-25.md) found no demonstrated wiring/default defect. Shipping discovery, factory execution, component creation, output visibility, lifecycle and mission recording remain unresolved; no cause-backed fix has been identified.

**Next bounded work — PROPOSED / NOT_BUILT:** author **static-output Phase A only** of the [morning diagnostic-control plan](design/OBSERVER_DIAGNOSTIC_CONTROL_MORNING.md) in a separate temporary `LanceObserverDiagnosticControl` mod, using the supervised workaround with fresh window identity and reviewed captures. The disposable Actor proof does not yet validate this control's Save To Mod, UMG or input configuration. Its proposed stock Instant Action controller substitution, dedicated input and plain UMG marker provide a separate output control; they have not been authored, packaged, installed or executed. Keep the original observer unchanged. Compile and review the actual control assets, input binding, package manifest, disposable baseline, stop conditions and rollback before a deployment decision. Component enumeration is deferred to a separately reviewed Phase B **only after the static marker is visibly demonstrated**.

Use the [September 25 overnight handoff](research/OBSERVER_OVERNIGHT_HANDOFF_2026-09-25.md) together with the later authoring result above; the supervised workaround supersedes the earlier unresolved editor-authoring route. Completed exports, graph audits and parser checks need no unchanged rerun; the parser's 2,606 rejected malformed inputs are **OFFLINE_PARSER_VALIDATION_ONLY**. Overnight preparation does not authorize the new controller/input runtime experiment. The coordinator owns resource admission, runtime/deployment decisions, implementation status and backup; this observer task owns README/NEXT. Native mission recording remains unbuilt, and speech/model work remains paused. All dated sections below preserve earlier states and instructions; this current verdict supersedes their pending-authoring, NOT_BUILT and unrun-package statements for the original three assets.

## September 23 handoff — preserved history

**Latest handoff, September 23:** independent recording preparation is complete: the [passive recording workflow](design/PASSIVE_RECORDING_WORKFLOW.md), [source-supported capture field map](design/PASSIVE_CAPTURE_FIELD_MAP.json) and [field review](research/PASSIVE_CAPTURE_FIELD_REVIEW.json) document the read-only file auditor, capture checklist, annotation workflow and nineteen candidate reads. Paused, uncertain and gap evidence stays separate from tactical eligibility; native capture, export and real-mission acceptance remain NOT_PERFORMED. The three observer assets still require a working manual editor authoring session. The coordinator has asked the user asynchronously about availability; no reply has arrived at this handoff. Do not duplicate that request or restart completed source investigations.

**Narrow speech repair completed, separate from the observer:** the [repair result](research/RESIDENT_RECOGNITION_REPAIR_RESULT.md) and [terminal receipt](research/RESIDENT_RECOGNITION_REPAIR_SMOKE.json) record three matched requests using two fixed prerecorded synthetic clips, with owned-worker cleanup confirmed. The coordinator separately reports **1,343 passing offline regression checks**. This is component smoke evidence only: no human/game/latency acceptance or integration is claimed. Broad speech/model work remains stopped, and this repair does not close the observer goal.

**Bounded authoring-route decision:** [two approaches were assessed](research/OBSERVER_AUTHORING_ROUTE_DECISION.md). Existing reflected APIs do not establish executable graph/widget authoring, and the coordinator's desktop checks found no proven usable unattended editor surface. The selected fallback is the [exact manual recipe](design/OBSERVER_MINIMAL_AUTHORING_RECIPE.md): three new assets, native BeginPlay owner/component snapshot, noninteractive UMG display and owned-widget cleanup. One working-UI authoring session is the remaining dependency; node availability/compile and shipping behavior are NOT_PERFORMED. The independent recording preparation is now complete as described above; native recording remains unbuilt. No new source export, editor launch or asset creation occurred in this route decision.

**Completed unattended authoring/readout review:** the [source-backed review](research/OBSERVER_AUTHORING_READOUT_REVIEW.md) and [non-executable asset specification](design/OBSERVER_ASSET_SPEC.json) identify the exact proposed component/registration types and UMG measurement building blocks. Empty-asset factory APIs are exposed; supported executable graph/widget-tree authoring remains unresolved. No builder, placeholder assets or native calls were produced. The [corrected creation-only contract](design/OBSERVER_CREATION_ONLY_PROBE.md) separates positive creation, exactly-one observation and full lifecycle acceptance; silence is inconclusive, and a controller-owned component may remain across a pawn change. Actual artifacts, measurement design and deployment/rollback gates still need completion.

**Latest observer result, September 23 UTC:** the [MW5GameMode parent export](research/OBSERVER_BASE_MODE_NATIVE_RESULT.md) succeeded: seven files, **22,699 bytes**, and an independent receipt audit passed. The exported EventGraph is empty, construction has only an unlinked entry, and the parent is native `/Script/MechWarrior.MWGameMode`. No factory caller is exposed. The completed controller/reference/mode/base-mode helpers must not be rerun; this review needs no further editor activity. The [creation-only probe contract](design/OBSERVER_CREATION_ONLY_PROBE.md) names the actual artifacts and independent registry/readout evidence still needed before a later isolated test. Observer assets remain **NOT_BUILT**, startup/cooking **UNKNOWN/BLOCKED**, and gameplay **NOT_PERFORMED**.

**Completed preceding mode result:** the [InstantActionMode source/default export](research/OBSERVER_MODE_NATIVE_RESULT.md) establishes the class default `InstantActionPlayerController_C` and connected construction call into **`MW5GameMode`**. The exported new-game graph initializes scenario/roster/deployment; no direct component-factory name occurs. The subsequent parent lookup above closes that specific source gap. Its **70/70 MOCK_ONLY** preparation remains separate from native source evidence. The accidental repeated mode export has identical source/default hashes and is preserved separately.

**Completed reference lookup:** [all three native metadata queries](research/OBSERVER_REFERENCE_NATIVE_RESULT.md) returned **31/2/4 entries, 37 total and 35 unique packages**, with exact options/pins and no errors/loading/truncation. That narrowed the now-completed mode export. Do not rerun the reference, mode or earlier controller helpers; no broader candidate collection is needed for the current parent boundary.

**Preserved earlier lookup failure:** the [initial user-assisted attempt](research/OBSERVER_REFERENCE_NATIVE_ATTEMPT.md) stopped at RESOURCE_STOP before any query/output. Its exact failed resource/value remain unknown. The diagnostic-only correction passed [69/69 MOCK_ONLY checks](research/OBSERVER_REFERENCE_DIAGNOSTIC_REVIEW.md) with unchanged limits. The later native success does not rewrite that earlier failure.

**Earlier automated editor/supervisor work, September 22:** the [cleanup repair](research/OBSERVER_SUPERVISOR_REPAIR.md) passed **171/171 independent checks**, including all nine real Windows fixture modes with verified cleanup. This is **SYNTHETIC_ONLY**: fixture resource readings were explicitly mocked, and native desktop integration remains unproven. The original **129/130 failed review** and a subsequent failed targeted retry, their timelines and locks remain unchanged; later PID absence does not rewrite either outcome. The last actual pre-validation sample had **5.13 GiB available RAM versus the unchanged 8 GiB native gate**. Prompt/human-edit observation, supported native normal close and the native helper STOP bridge were still missing. **No editor/game/helper launch occurred during that supervisor repair.** The [future full-editor experiment](design/OBSERVER_NORMAL_EDITOR_EXPERIMENT.md) remains gated; [the frozen repair checkpoint](research/OBSERVER_SUPERVISOR_REPAIR_STATUS.json) supersedes the earlier supervisor failure as source-validation evidence. The later user-assisted invocation does not validate automated startup.

**Current implementation:** the [implementation checkpoint](research/IMPLEMENTATION_STATUS.md) records local observation/arbitration/radio components, a browser workbench, validation and local model benchmarks. Those results have their own current receipts; the original overnight receipts remain historical. The user subsequently authorized running the editor or game when needed for continued implementation. The bounded source lookups are complete; an actual game-affecting experiment still needs concrete artifacts, a disposable scenario, baseline, stop conditions and rollback. No shipping adapter or full-mod acceptance is claimed.

**Passive-observer source chain:** the [single-controller export](research/OBSERVER_CALLER_NATIVE_RESULT.md) shows `InstantActionPlayerController` inherits directly from the collected controller without a direct factory call. The mode establishes its class-default selection and connected parent call; the [parent export](research/OBSERVER_BASE_MODE_NATIVE_RESULT.md) reaches the native boundary without exposing a caller. The startup caller remains unresolved and observer assets remain **NOT_BUILT**. The [initialization/packaging investigation](research/PASSIVE_OBSERVER_PREPARATION.md) preserves the broader unresolved contract. No observer deployment or gameplay test occurred.

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

**Historical September 20 startup plan, superseded:** the [session record](research/EDITOR_SOURCE_SESSION_2026-09-20.md) preserves the failed commandlet attempt and shader compilation observed then. Its proposed Form On Me source trace has since been completed. The current source limit is the [native initialization boundary](research/OBSERVER_BASE_MODE_NATIVE_RESULT.md). The eventual first live proof still needs a concrete isolated scenario, baseline, stop conditions and rollback. Packaged-game behavior, performance, voice latency and compatibility tests remain **NOT_PERFORMED**.

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
