# Passive observer: official packaging and initialization evidence

Access/review date: **2026-09-21**. Scope: bounded public-primary-source and collected-text review. No editor/game execution, asset creation, cooking, packaging, installation, input injection or remote publication was performed by this review. Proposed identifier remains `LanceObserverProbe`; no runtime artifact is delivered here.

**Verdict: official content-mod packaging is DOCUMENTED; a mission startup contract for this observer remains UNKNOWN/BLOCKED by these sources alone.** Do not turn the guide's packaging workflow, a plugin descriptor, or a registration data asset into a claim that a component will be instantiated. Combine this document with the separate current-installation and collected-controller trace before choosing the experiment.

## Official sources and version limits

| ID / evidence | Exact primary source and location | Applicability and limitation |
|---|---|---|
| O1 / DOCUMENTED | [PGI Modding Resources](https://mw5mercs.com/resources/2020/01/29-modding-resources), Getting Started, accessed 2026-09-21 | Currently served official resource index. Its link caption identifies guide v2.2, but its target is v2.3. The page also retains packaging-forthcoming language; use O2 for the actual packaging instructions. This is not a current-build compatibility certification. |
| O2 / DOCUMENTED | [PGI Mod Editor Guide v2.3](https://static.mw5mercs.com/docs/MW5Mercs_Mod_Editor_Guide_(v2.3).pdf), Creating a New Asset Mod pp.8-10; Manage Mod pp.10-11; Installing your new Mod p.12; Including External Assets and Adding New Input Events p.16 | Historical, undated guide v2.3; not a guide explicitly matched to editor 1.1.390.0e or retail 1.14.390. Pagination is one-based PDF page number. Local copy: `tmp/pdfs/MW5_Editor_v2.3.pdf`; SHA256 `77E7030273916B78998DB51689DA9E60CBFDDC234D9BBBA443B5C4B5004151B6`. Existing page-10 rendering inspected; packaging/configuration text read from official PDF. No assertion that the local copy was re-downloaded or byte-compared with today's response. |
| O3 / DOCUMENTED | [PGI MW5 Patch #3](https://mw5mercs.com/news/2020/03/34-mw5-patch), Mod Editor Updates / Game Updates, accessed 2026-09-21 | Historical official description of the content-mod system: safe substitution copies, one-button cooking/packaging and in-game activation. It documents specific Blueprint hooks and persistent actors, but does not establish an arbitrary mission observer's creation path. Persistent save/load features are outside this probe. |
| O4 / DOCUMENTED preview | [PGI Ashes & Ascension free-update preview](https://www.mw5mercs.com/news/2026/09/197-ashes-ascension-free-update-details-and-patch-notes-preview), published 2026-09-08, introduction and Modding section, accessed 2026-09-21 | Future update preview, explicitly incomplete. It announces earlier mod PAK loading and a fix for missing primary asset IDs when cooking certain assets that use Asset Manager during pre-save. These changes cannot be credited to the presently recorded editor/game builds. No observer-specific defect is established by this generic fix description. |

## What the official guide establishes

**DOCUMENTED, historical O2:** create and select a mod through the editor's mod controls. Place new assets in that mod's content; existing-asset substitutions belong in ModOverride through Save To Mod. The formation example explicitly changes a stock consumer to reference its new formation. Manage Mod opens the packaging interface; Package Mod asks for an output destination, defaulting to the editor's `MW5Mercs/Mods`. After completion, PGI directs the user to copy the complete generated mod folder to the retail Mods folder, refresh/enable/apply in the game, and restart. Mod-local Config and ModOverride/WwiseAudio receive special inclusion support. These steps describe the publisher's authoring and packaging route; they do not specify an observer startup hook or the cook closure of a newly invented component/widget chain. [O2, pp.4-12,16]

**PROPOSED application:** keep every new probe asset under one uniquely named mod and keep output inside this research project until a concrete deployment has been approved. Do not use the guide's formation example as a reason to replace SquadCommandComponent or modify formation behavior. It is an example of explicitly wiring a consumer, not evidence that arbitrary new objects execute automatically.

## Current collected declarations narrow the packaging contract

**OBSERVED text, not executed:** the pre-existing native collection contains
`research/evidence/editor-source/mod-research-collection-20260921T023909Z-5eeaf52a/unreal-api-reference.txt`.
SHA256 verified during this review: `AC4C46761BC54099302155BC0A908AE3F64B161CA77EB9AFD0CC6C1F1B826480`.
The collection belongs to the recorded editor **1.1.390.0e / UE4.26.2** source session; [installation metadata](EDITOR_POSTINSTALL.json) and [collection result](COLLECTION_RESULT_2026-09-20.md) retain provenance. The installed receipt is to be refreshed separately before execution.

| Declaration / exact lines | OBSERVED declaration fact | Limit |
|---|---|---|
| `MWModPluginInfo`, 87415-87543, native attribution `MechWarrior / ModUtils.h` | Plugin identity, path, metadata and engine-version fields are reflected. | No reflected observer actor or component entry field in this inspected struct. That does not exclude an unreflected native mechanism. |
| `ModInfo`, 87669-87803, `MechWarrior / ModUtils.h` | Reflects `game_version`, `manifest`, `default_load_order`, version/build and publication fields. The manifest is described as the list of files changed by the mod. | Do not hand-author a ready descriptor from this Python spelling; exact serialized JSON keys and actual packaged file entries need generated output. The guide's historical `loadOrder` spelling does not establish today's schema. |
| `ModPackageArgs`, 112275-112339, `MechWarriorEditor / MWModEditorWidget.h` | Reflects `mod_name`, `skip_packaging`, `output_to_folder`, `publish_to_steam` and visibility. | Declarations are evidence that a local-output/publication distinction exists; not a completed cook, a command-line recipe or permission to publish. Avoid reusing staging output via skip-packaging for a first probe. |
| `MWModUtils`, 296883-297152, `MechWarrior / ModUtils.h` | Reflects mod lists, active/enabled state, restart requirement, mod install path and related metadata operations. | List/activation operations do not instantiate an observer. `get_running_mods` describes applied mods in a non-editor build; its declaration is not observed runtime output. |
| `MWGameInstance`, 325984-326095, `MechWarrior / MWGameInstance.h` | Reflected properties include profile-state and pawn/controller-change delegates. The latter's description warns that a pawn/controller pair may be broadcast more than once. | No arbitrary mod-root actor registration appears in this inspected declaration. Native implementation and lifecycle order are not exposed by this stub. Repeated delegate events must not be treated as unique component creation. |
| `MWModEditorWidget`, 397620-397754, `MechWarriorEditor / MWModEditorWidget.h` | Exposes `package_mod(args)` accepting `ModPackageArgs`. | It is an editor utility, not the proposed diagnostic game widget and not a packaged-runtime execution API. Method stub bodies are documentation placeholders. |

These are narrow, attributable declarations. They neither prove automatic mod startup nor justify executing editor Python in the shipping game.

## Initialization and cooking decision

**UNKNOWN/BLOCKED from the public sources and declarations inspected here:**

1. Which current-build caller invokes `MW5PlayerController.AddPlayerControllerComponents`, under what world/mission conditions, and whether the registration scan includes this mod's newly cooked data asset. The separate controller trace is the correct place to settle any visible Blueprint caller; this report does not duplicate it.
2. Whether one observer instance is created per intended owner and whether repeated creation/configuration or possession/world transitions accumulate duplicates. Absence of duplicate evidence is not an idempotence guarantee.
3. The exact asset-reference and registry coverage needed to include and load a proposed component, registration data asset and game widget after cooking. The packaging UI and file manifest do not by themselves prove successful class resolution or runtime registration.
4. A proven local-player widget owner/lifetime route that neither intercepts game input nor survives with stale bindings after mission transitions.

**PROPOSED next evidence, contingent on the current-installation/graph findings:** prepare the smallest creation-only probe that uses an actually evidenced caller or registration path. It should display only probe identity, owner/world identity and instance counts. If the caller cannot be established, perform one named source inspection/export of the missing lifecycle asset before widening the implementation. Do not speculate that a convention named ModActor, a GameInstance mod manager, or an arbitrary plugin startup class is supported by MW5. None was established by this review.

For a later authorized cook, preserve the editor-generated descriptor and the complete local output. Record source and cooked SHA256 values, package membership, referenced class paths, dependency list, warnings/errors and staged file count. Verify that the registration, component and widget packages are all present. Cooking success is distinct from shipping discovery; a visible creation marker and bounded instance count in an isolated mission are separate runtime gates. Do not mark either gate PASS until its evidence exists.

## Status handed back

| Check | Status |
|---|---|
| Official packaging controls and historical install workflow | DOCUMENTED |
| Current collected native packaging declarations | OBSERVED |
| Generic automatic root-actor initialization contract | UNKNOWN/BLOCKED |
| Proposed observer's mission caller and cooked registration | Requires separate current-source/installation trace; not established by this public-doc review |
| Observer asset/widget creation, cook, packaged manifest and hashes | NOT_PERFORMED |
| Runtime discovery, creation count, identity/freshness and lifecycle | NOT_PERFORMED |
| Native AI unchanged / performance | NOT_PERFORMED |

No external dependency, paid service, native loader, campaign persistence or input-control feature is selected by these findings.
