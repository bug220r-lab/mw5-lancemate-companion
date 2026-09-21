# Bridge prerequisites: bounded follow-up

Date: **2026-09-20**. **Historical prerequisite investigation, followed by completed installation and a bounded source session.** Installation is now confirmed by [EDITOR_COMPLETION.json](EDITOR_COMPLETION.json). The [latest source session](EDITOR_SOURCE_SESSION_2026-09-20.md) supersedes the in-progress editor status and generic search leads below. No companion implementation or live gameplay test exists. Earlier snapshots remain dated evidence.

## Current installed-source findings

The [order audit](EDITOR_ORDER_SOURCE_AUDIT.md) pins dedicated Form On Me, selection, dispatcher and follow-order assets; [serialized ASCII evidence](EDITOR_SERIALIZED_NAME_EVIDENCE.json) preserves their byte-offset search leads. The newly generated [26-class declaration report](evidence/editor-source/generated-stub-contracts.json) now supplies actual reflected signatures: `MWPlayerController.post_squad_order_class(...) -> None`, `MWSquad.get_members_for_order(Array(int32), Controller) -> Array(Controller)`, and `MWMech.get_squad_command_order_context()`. These do not establish Blueprint edges, safe instance binding or order acceptance.

The existing GUI generated its Python reference automatically at19:03:36, after engine initialization was logged; no diagnostic script was executed inside it. The [text-only inspector](../scripts/Inspect-EditorPythonStub.py) read and hashed that file without importing or executing it. The old commandlet failure remains separate history. The [transport audit](EDITOR_TRANSPORT_SOURCE_AUDIT.md) now includes actual Victory/LowEntry declarations but still lacks implementation/thread/size/atomicity evidence. The original sections below describe earlier research, not current installation/API status.

**Most important remaining mechanism:** prove the single-member recipient mapping and connected Form On Me graph, then establish actor-bound native job readback and reliable human supersession. The declared route `MWAIController.worker_component -> get_job() -> get_command_type()` is a hypothesis for readback; `FOLLOW` alone cannot prove this request caused an order or the actor moved. A native `player_issued` boolean does not distinguish the user's input from a companion posting through the player controller. Nonblocking inbound/outbound transport and shipping inclusion are separate unresolved gates. The unattended goal remains **PARTIAL; packaged test blocked**. No runtime adapter was built around those missing contracts.

## Decision

**Prepare completed-package metadata review while the approved editor installation proceeds.** The installed game has a concrete engine-version record and a plausible built-in file-I/O lead. Neither supplies the missing native order function, AI binding or acceptance/override signals. The [inspection worksheet](../design/EDITOR_INSPECTION.md) and [read-only checker](../scripts/Inspect-EditorInstall.ps1) are prepared; the current request includes no editor launch or live test.

The preferred next inspection follows the stock command UI and selected lance member to the actual order receiver, together with the game's bundled Victory/Low Entry facilities. Inspect `SquadCommandComponent` if actual references connect it; its role in that dispatch path is not established. Do not replace native orders with generic AI movement. Native UEVR extension is a conditional fallback whose source audit exposed extra version, licensing and build/deployment risks. No transport is approved for production or proven on this machine.

## What changed since the first sprint

| Finding | Evidence/status | What it resolves and what it does not |
|---|---|---|
| Installation unchanged | OBSERVED: game XML still 1.14.390 / CL456620; Steam build 24241637; all five original metadata hashes match [F01] | Confirms the target of this investigation, not live gameplay |
| Engine version now recorded | OBSERVED: shipping `.target` receipt reports **4.26.2**, branch `++UE4+Release-4.26`, compatible changelist 14830424 [F01] | Replaces the prior completely unknown engine version with receipt evidence. Does not identify every PGI engine change or match an editor package |
| Relevant built-in plugin names | OBSERVED: receipt lists VictoryPlugin/VictoryBPLibrary and LowEntryJson as UFS dependencies [F01] | Makes inspection more specific; the same list contains editor-only descriptors, so listing is not proof of shipping callable functions |
| Concrete file read/write source | DOCUMENTED: pinned upstream Victory source has Blueprint-callable string file read/write functions and a Runtime module [F02] | Source-level candidate only; MW5's bundled fork/version and node availability are unverified. Calls are synchronous |
| Editor installation started after the original search | Historical bounded absence [F01]; user now reports installation and supplied a progress screenshot. At 14:18 -04:00, `.egstore` exists but no final registration/manifest or expected editor executable is present [EDITOR_READINESS.json](EDITOR_READINESS.json) | Installation authorized/in progress; completion and matching editor build remain unverified |
| Public order-UI lead | DOCUMENTED author description points to Lance Status UI reuse by Battle Grid Orders [F06] | Narrows the editor trace; no actual native callable signature or Form On Me graph inspected |
| Native fallback has additional prerequisites | DOCUMENTED source audit finds reflection/engine-tick facilities, but raw hooks, deployment side effects and licensing distinctions [F05] | Strengthens the reason to inspect built-in facilities first; does not close the game API gap |
| Legacy Pilot Overhaul source exists | DOCUMENTED public author repository, legacy 7.0.3/build776 metadata [F07] | Corrects the earlier source-discovery gap for that historical branch only; not current Eternal code or a native order API |

## Local identity and availability

The game is at `C:\Program Files (x86)\Steam\steamapps\common\MechWarrior 5 Mercenaries`. The receipt is `MW5Mercs\Binaries\Win64\MechWarrior-Win64-Shipping.target`, lines 9-20 for Version, 57-58 for Victory and 93-94 for LowEntryJson. Receipt SHA256:

`E359B90434023F682D24BF722A4B6F26191790A8A8DC5878B24CCE9A4F621384`

Shipping executable SHA256:

`7F213246776E64F4FE63B8D68ACFA00CB4B16BD0AE72853B250F51C5C96A4888`

These identify observed artifacts; no executable was run. The receipt BuildId is `9bd41d70-2eec-41d4-8ae2-2ad7e06162b7`. No shipping PDB or loose Victory/LowEntry plugin descriptor was found at the receipt-derived locations. Narrow searches of the shipped `.exp`/`.lib` linker metadata found none of the candidate order/file-I/O names; that does not prove the functions are absent from the executable or cooked assets. No PAK extraction, disassembly, debugger attachment or memory inspection occurred.

The earlier follow-up found zero InstallationList entries in `C:\ProgramData\Epic\UnrealEngineLauncher\LauncherInstalled.dat`, no usual Epic manifest directory, and no editor in the checked default paths or relevant registry entries. That bounded absence and approximately **81 GiB free on C:** are historical observations. The user has since begun the approved installation at `C:\Program Files\Epic Games\MechWarrior5Editor`. The 14:18 -04:00 snapshot finds only `.egstore`, no final launcher registration/manifest, and status `INSTALLATION_NOT_CONFIRMED`. It records **219,293,528,064 free bytes** during installation. This in-progress value does not establish remaining allocation, peak staging demand, or completed working space.

## Actual order trace: known boundary

The following is an **inspection map, not a verified call graph**:

```text
OBSERVED local DispatchLanceMate1 / F2 binding
        |
        v
DOCUMENTED native one-member selection + Form On Me menu
        |
        v
AUTHOR-DESCRIBED Lance Status UI reuse by a command mod
        |
        v
UNKNOWN actual selected-member representation and native dispatch
        |
        v
UNKNOWN actual native order receiver
        |
        v
UNKNOWN AI owner, persistent order state and human-override signal

Separate PGI-documented anchor: SquadCommandComponent formation asset.
No connection from the order UI to this asset has been verified.
```

Existing manual/author descriptions establish that the game has orders and that mods have reused command UI. They do not establish a safe remote entry point. The order-agent's bounded repository search found no inspected public export containing the missing Form On Me signature. No function, parameter layout, RPC flag, enum value or Blackboard key is supplied here as a finding.

In the matching editor, inspect the selection widget/input references first, then follow the actual graph to its real order receiver. Inspect SquadCommandComponent if references connect it. Record full asset paths and graph/export evidence for: slot -> current pawn; AI versus human possession; dispatch action and parameters; authority; native readback; human-order event; destruction/rebinding. Public Pilot Overhaul assets may later help understand identity, but names such as a pilot-info widget do not reveal its fields without inspection.

## Telemetry and transport audit

**Smallest telemetry candidate remains player pose**, based on SpaceMonkey's existing local-player sampling/export code [B07]. This does not prove an AI-lancemate field and was not run. Do not conflate that independent example with a currently working export through the proposed built-in path.

**Candidate to inspect first: the already-declared Victory facilities.** Upstream commit `4a05929b718dd14f47a0a949481ae8f7c21d2eaa` exposes `LoadStringFromFile` (header lines 1034-1037) and `FileIO__SaveStringTextToFile` (header lines 1245-1246; implementation lines 3058-3094). The read wraps `FFileHelper::LoadFileToString`; the write calls `FFileHelper::SaveStringToFile`. Its module descriptor says Runtime/PreDefault. This is concrete upstream code, not proof of the exact bundled MW5 implementation. [F02]

Both operations are **synchronous**. Putting a call on a timer does not move disk I/O off the game thread. Therefore this is an editor/source-discovery lead and, after separate approval, potentially a small one-shot isolated I/O probe. It is **not** an accepted nonblocking continuous bridge. Check for a genuine asynchronous facility, payload/file-size bounds, fixed allowed directory, partial-write rejection and lifecycle cleanup before promotion. A file exchange would need authenticated session ownership, expiry/deduplication and protected paths; atomic publication and async dispatch are not established by these two functions. Do not use OneDrive, the campaign saves or the game install as the proposed exchange directory. Do not install a newer upstream Victory plugin over the game's bundled one.

LowEntryJson is a serialization lead only. Its exact fork/functions and current shipping exposure remain UNKNOWN; no HTTP/socket capability follows from its name. This investigation does not prescribe a JSON node or a port.

**Audited fallback: a narrow native adapter using UEVR SDK facilities.** The source contains reflected function invocation and engine-tick callbacks. A proposed adapter could receive bounded local named-pipe messages off-thread, then validate and dispatch only on a verified game-thread callback. This design remains hypothetical; no pipe or MW5 order receiver exists in the inspected bridge. `process_event` forwards a call and does not mean an order was accepted. [F05]

Do not copy the existing relay hook machinery as a safety guarantee: it uses raw frame assumptions and a hard-coded function offset. Initialization follows a D3D-thread path, so it is not a game-thread guarantee. Any I/O worker needs a supported stop/cancel/drain handshake before DLL unload; the inspected wrapper does not supply one. The build configuration also contains an automatic post-build deployment copy, and dependency completeness needs repair before any authorized build. The current UEVR root license and separately MIT-licensed API headers are different; the small MW5 plugin's MIT license does not grant unrestricted rights to every dependency. No loader binary was downloaded/installed, no build script was run, and no proposed native implementation is approved.

## Approved editor installation and prepared inspection

**Package and permission:** the user authorized “Install the editor” and has started the official Epic Games **MechWarrior 5: Mercenaries Mod Editor** installation. That authorization remains valid and need not be requested again. The game remains the user's Steam installation. PGI's June 4, 2020 announcement made the editor free regardless of game ownership, and the current Epic page lists it as free. **No Epic copy of the game or repurchase is required under that published policy.** The old guide's ownership condition is superseded. The offered editor build remains unknown. [B01,F03]

**Actual installation destination:** `C:\Program Files\Epic Games\MechWarrior5Editor`, shown in the user's installer dialog and now containing `.egstore`. It is outside OneDrive and the Steam game tree. The earlier `C:\MW5Tools\MechWarrior5Editor` proposal was not selected or created by the assistant. Do not move or recreate the active installation as part of this preparation.

**Progress and storage evidence:** the latest user screenshot shows **107.36 MB of 148.08 GB** installing. A separate earlier location dialog displayed **150.52 GB download / 238.53 GB required storage**; those are historical readings from a different installer stage, not interchangeable measurements. The earlier approximately 86 GB free-space readings cannot establish a current shortage after allocation/state changes. Conversely, comparing the in-progress 219,293,528,064 free bytes with the pre-install requirement cannot establish sufficiency. Record final installed footprint and available working space after completion, with staging/cache needs separately assessed. The prior 20 GiB OS/general reserve is a project planning choice, not a publisher requirement or proof of adequacy. No cleanup, purchase or destination change is part of this preparation. [EDITOR_INSTALLATION.md](EDITOR_INSTALLATION.md), [EDITOR_READINESS.json](EDITOR_READINESS.json)

**Version gate:** after installation completes, record the final launcher package/version and engine/project metadata with the prepared checker and worksheet. Compare with game 1.14.390/CL456620 and receipt 4.26.2 using relevant engine/project/release evidence; do not demand identical editor/game BuildIds. An engine minor-version match alone is insufficient. A newer DLC9 editor may require a separately approved alignment decision; do not update the game automatically.

**Terms/account boundary:** the installation is user-started and approved. The project has not recorded the exact current terms presented or any account transaction; do not infer new purchases or additional license acceptance from the preparation request. The linked dated editor EULA remains source evidence with its recorded limits. [F03,F04]

**Prepared tools/files:** [EDITOR_INSPECTION.md](../design/EDITOR_INSPECTION.md) provides the source-trace worksheet; [Inspect-EditorInstall.ps1](../scripts/Inspect-EditorInstall.ps1) reads named installation metadata and writes JSON to stdout; [EDITOR_READINESS.json](EDITOR_READINESS.json) retains the incomplete-install observation. After completion, use the official editor's actual bundled project/assets within an explicitly scoped source-viewing session. No Visual Studio, UE4SS, VR stack, API key or extra mod package is justified yet. The current machine has not established a native compiler toolchain; that matters only if a later approved native build is selected.

**Installation and rollback boundary:** Epic manages the selected editor directory, download/staging data, launcher records and potentially prerequisites/cache. Record actual paths after completion. Do not enable a mod or alter the Steam installation. Any later cancellation/uninstall must target the exact editor entry through Epic; do not recursively delete parent folders or guess cache ownership. Preserve research notes and source exports. No rollback operation was performed here.

Installation completion remains **unverified**, distinct from the user's confirmed progress and existing authorization. The current work prepares the next inspection while installation continues; it does not launch the editor, Play-In-Editor or the retail game. Historical launcher-control limitations and installer screenshots are recorded in [EDITOR_INSTALLATION.md](EDITOR_INSTALLATION.md).

## Next executable inspection and stop boundary

Once Epic reports installation complete:

1. Rerun the prepared read-only checker, reconcile final launcher status with expected files, and record package/version, footprint and working space. `READY_FOR_VERSION_REVIEW`, if later reported, is metadata readiness only. Compare target metadata; stop on unexplained mismatch.
2. Obtain explicit scope for editor launch/source viewing if not already granted, then follow [EDITOR_INSPECTION.md](../design/EDITOR_INSPECTION.md). Installation approval is already recorded; it does not itself authorize this launch. Do not enter Play-In-Editor or launch the retail game under an inspection-only approval.
3. Trace the real order UI and component graphs described above; record signatures and ownership checks without issuing an order.
4. Inspect the bundled Victory/LowEntry definitions and whether the relevant functions are exposed, runtime-supported and synchronous/asynchronous. Record actual plugin versions/hashes; do not substitute upstream code.
5. Produce a source-backed implementation manifest and revise the deterministic POC. If the native order/readback path or nonblocking transport is still missing, stop and report it. An editor/source finding does not pass a shipping-game gate.

## Validation and remaining uncertainty

Completed: refreshed metadata/hash comparison; executable/receipt fingerprinting; narrow editor/launcher/registry checks; original-author source and license inspection; review of relevant official editor material. Final document checks found no broken local links across eight main Markdown files. All 22 retained source files match their provenance-index hashes, and the five original game/mod metadata files still match their recorded hashes. Independent document reviews preserved the evidence and scope distinctions.

The official editor installation is now **IN_PROGRESS**, with completion not verified. The preparation adds the inspection worksheet, read-only checker and retained readiness snapshot; none passes a live integration gate.

Still UNKNOWN/BLOCKED: exact native Form On Me signature/target identity, live mission/actor lifetime signals, accepted-order readback, reliable manual override, completed matching editor package and nonblocking bidirectional shipping transport. **All editor/game launches, live reads, gameplay command execution, mod/loader installations, builds, voice/API usage, performance and compatibility tests remain NOT_PERFORMED.**
