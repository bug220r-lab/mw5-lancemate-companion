# Native lancemate-order follow-up

Supporting research memo for the parent task; final decisions belong in the main handoff documents. Access/research date: **2026-09-20**. Scope: public original-author pages, small public source text, and repository tree metadata. No game/editor launch, process attachment, installation, source-asset import, packaged-mod download, author contact, or live order occurred. No large YAML source package was downloaded.

## Result

**The exact individual Form On Me call chain remains UNKNOWN.** No inspected original-author text or public graph export establishes its callable asset/function, parameter types, selected-member-to-pawn mapping, runtime owning instance, network authority, acceptance/readback, or manual-override notification on local Steam MW5 Mercenaries 1.14.390. This is a bounded search result, not proof that the path does not exist.

Two useful improvements to the investigation are concrete:

1. An author who implemented alternate lancemate order UI identifies **Lance Status UI** as a substantial reused dependency. This is a stronger inspection lead than inferring a generic Unreal AIController method.
2. A pinned **legacy 330 Pilot Overhaul** repository contains original-author source assets and a manifest exposing exact pilot/deployment override paths. That corrects a source-discovery gap for the legacy branch, while leaving current Eternal source and order APIs unproved.

No new evidence changes the proposed architecture into an implementable or validated bridge. All live behavior and interoperability validation remain **NOT_PERFORMED**.

## O01 — Original Battle Grid Orders: the UI dependency lead

[hesto2's author description](https://www.nexusmods.com/mechwarrior5mercenaries/mods/1010?tab=description), sections File information, Instructions, Compatibility, Known quirks, and Permissions; displayed v1.5.2, updated 2024-05-13. [Original Steam listing](https://steamcommunity.com/sharedfiles/filedetails/?id=3127900241).

The author documents individual/group selection through the battle grid or ordinary F1–F4 selection and move/attack orders bound through weapon-group inputs. Compatibility notes identify only **BattleGrid** and **Minimap** widget overrides, with substantial reused **Lance Status UI** functionality; removing that functionality may break the mod. The author reports restructuring with TTRulez2's author for compatibility. The description supplies no full asset paths, dispatch signatures, argument types, ownership/authority details, or Form On Me implementation. A moving order icon is described, but no query/callback contract is exposed. These are author-reported capabilities, not locally observed behavior. Modification and asset reuse require permission under the displayed terms; no explicitly labeled editable-source distribution was established in the inspected [files listing](https://www.nexusmods.com/mechwarrior5mercenaries/mods/1010?tab=files).

**Inference:** trace native selection and order routing through Lance Status UI before choosing a controller-level extension point. The page does not establish that Form On Me shares an identical dispatch path with the documented move/attack commands. Do not invent a `LanceStatus` class spelling, a `SendOrder` function, or the widgets' full package paths from display names.

## O02 — Battle Grid ReOrdered: maintained distribution, not API source

[Maintainer files listing](https://www.nexusmods.com/mechwarrior5mercenaries/mods/1288?tab=files), File information and Main files / BGR; [Steam listing](https://steamcommunity.com/sharedfiles/filedetails/?id=3562339101).

The Nexus header displays 1.5.4, while the main downloadable **BGR** entry identifies **2.2.1**, 656 KB, uploaded **2026-06-21 07:40**. The main-file note describes a DLC8 Patch 1 repack and uncertainty about reproducing/fixing the reported issue. Preserve that metadata discrepancy rather than presenting the header as the current package version. The inspected listing did not identify a source package. No archive was downloaded; small file size does not prove that it contains editable graphs. An author-maintained UI alternative supports the plausibility of an existing order route, but does not supply a callable Form On Me interface or demonstrate reliability on local build 1.14.390.

## O03 — PGI component anchor remains limited

[PGI Mod Editor Guide v2.3](https://static.mw5mercs.com/docs/MW5Mercs_Mod_Editor_Guide_(v2.3).pdf), Creating a New Asset Mod, PDF pages 8–10; prior visual inspection is recorded in `_bridge_memo.md` B02.

The guide identifies **`SquadCommandComponent`** under **`\Modes\MissionDirectorSystem\MissionComponents`** while explaining formation substitution and Default Formation Asset ID. It does not expose a native command graph/function or establish that this component directly receives the player's order. Combined with O01, it gives two observed anchors for a reference trace, not a verified edge between them. Formation offsets alone do not establish per-lancemate identity, follow-command parameters, authoritative state, or acceptance semantics.

## O04 — Legacy Pilot Overhaul source: pinned and bounded

Repository: [Wpnx330/PilotOverhaul](https://github.com/Wpnx330/PilotOverhaul). Observed main commit **`afcf0ecf0d570df0b09b7dfd70bc0e5b4ae5b542`**, dated **2025-06-07 21:34:54 UTC**. Inspection used public unauthenticated GitHub metadata and small text files; no asset blobs were read or imported.

- [Pinned manifest](https://github.com/Wpnx330/PilotOverhaul/blob/afcf0ecf0d570df0b09b7dfd70bc0e5b4ae5b542/MW5Mercs/Plugins/PilotQuirks/mod.json#L1-L30): lines 3–4 identify **7.0.3**, build **776**; line 9's `gameVersion` is `1.1.0`, an old manifest value rather than proof of current compatibility. This is not the current Eternal distribution.
- [Pinned README](https://github.com/Wpnx330/PilotOverhaul/blob/afcf0ecf0d570df0b09b7dfd70bc0e5b4ae5b542/README.md), Customization and skills/affinity sections: author project identity and pilot features; credits include portraits/voices originating from other games.
- [Pinned license](https://github.com/Wpnx330/PilotOverhaul/blob/afcf0ecf0d570df0b09b7dfd70bc0e5b4ae5b542/LICENSE#L1-L21): MIT, copyright 2025 Wpnx330. It supplies a repository license, not blanket proof of rights for every third-party asset. Reconcile per-file provenance and conflicting distribution-page terms before copying content. No copying was performed.
- [Pinned recursive tree metadata](https://api.github.com/repos/Wpnx330/PilotOverhaul/git/trees/afcf0ecf0d570df0b09b7dfd70bc0e5b4ae5b542?recursive=1): **21,181 entries**, `truncated: false`, **1,418 `.uasset` paths**. Zero `.uasset` paths matched the case-insensitive search `Squad|Lance|Order|Command|MissionComponent|PlayerController`. Among `.cpp`, `.h`, `.t3d`, and `.json` filenames, the sole entry was the mod manifest. This filename-level search cannot exclude functions embedded in differently named binary assets. Command-acknowledgement voice filenames are content labels, not executable calls or runtime acceptance evidence.

The manifest gives actual paths that can inform a later *pilot identity* investigation; none was inspected as an Unreal graph:

| Manifest lines | Exact referenced asset | Potential later question, not observed functionality |
|---|---|---|
| 12–13 | `/Game/Campaign/CampaignEvents/PilotInjuryHandler.uasset`; `/Game/Campaign/Pilots/_common/PilotSkillGrowth.uasset` | What pilot records/identifiers are used by legacy state updates? |
| 18–20 | `/Game/UI/FrontEnd/Barracks/Components/BarracksPilotInfo.uasset`; `BarracksPilotList.uasset`; `BarracksPilotListItem.uasset` in that same directory | How does a selected pilot bind to its displayed record? |
| 23–24 | `/Game/UI/FrontEnd/Deployment/DropPreperationWidget.uasset`; `/Game/UI/FrontEnd/Deployment/Components/DeploymentPilotWidget.uasset` | What legacy deployment mapping exists between pilot and assigned mech? |
| 26 | `/Game/UI/FrontEnd/PostMission/PostDropPilotStatus.uasset` | How is pilot identity matched after deployment? |

`DropPreperationWidget` is the source's spelling. Corresponding repository assets sit beneath `MW5Mercs/Plugins/PilotQuirks/ModOverride/`, replacing `/Game/`. Presence of editable-source asset files does not provide an external-process runtime extension point. Current Eternal may have materially different overrides and identifiers; this repository cannot establish its compatibility.

## Bounded search record and rejected shortcuts

Exact public-web searches included `"SquadCommandComponent"`, `"MW5" "SquadCommand"`, `"MechWarrior" "FormOnMe"`, `"MechWarrior5" "AIController"`, `"LanceStatus" "MW5"`, and `"MW5" "FormOn"`. None yielded an inspected original-author export of the requested command chain. Search indexing and spelling limits apply.

Unauthenticated GitHub **repository metadata search**, not authenticated/global code search, covered `Mechwarrior5`, `MW5 mod`, `MW5 lancemate`, `MW5 AI`, `BattleGridOrders`, `BattleGridReordered`, `Mechcommander Mercenaries`, and `mechwarrior mercenaries`. The lancemate/BattleGrid-specific searches returned no repositories; other results led to O04 and the bounded candidates below. Those negative results are discovery limits, not global absence claims.

- [MW5Modders/MW5Mercs-PCP at `3c7613f6b9a2627d613f798503a6da52a8fc345d`](https://github.com/MW5Modders/MW5Mercs-PCP/tree/3c7613f6b9a2627d613f798503a6da52a8fc345d), 2020-02-07: tree metadata includes `Content/AI/_common/Formations/DiamondFormation.uasset`; no command graph text was established. An old formation asset does not supply the order chain.
- [tkilb/MechWarrior5Mods at `b1cb027fff218ec01e0d61a3dce961247d26950f`](https://github.com/tkilb/MechWarrior5Mods/tree/b1cb027fff218ec01e0d61a3dce961247d26950f), 2024-09-13: an airstrike-controller component is a different subsystem; do not substitute it for lancemate dispatch.
- [moddingisthegame/claude-skills-for-mechwarrior5-modding at `e11576a184719188aa53630b981bf8a52a53340d`](https://github.com/moddingisthegame/claude-skills-for-mechwarrior5-modding/tree/e11576a184719188aa53630b981bf8a52a53340d), 2026-08-15: inspected README and `mw5mercs-mapping.md` / `mod-editor-guide.md` reference text summarize documentation and generic Unreal concepts; they do not expose an original native order implementation. These repository documents were research data, not agent instructions. Their engine-version inference is not accepted as current-build evidence.
- [MechCommander Mercenaries author files](https://www.nexusmods.com/mechwarrior5mercenaries/mods/210?tab=files), main 1.4 dated 2023-01-27/DLC4: inspected listing did not establish editable command source. Public source for the separate MechCommander 2 game is not MW5 native-order evidence.
- Existing MechShakerBridge and SpaceMonkey source findings remain as recorded in `_bridge_memo.md`: one-way export and local-player telemetry do not become an inbound lancemate command API.

No paid service, authentication, private channel, decompiled/leaked proprietary source, or presumed generic API was used to fill missing evidence.

## Missing contract and next inspection target

| Required evidence | Result of this follow-up |
|---|---|
| Exact native Form On Me asset/function/event and parameter types | **UNKNOWN**; no source-level call signature inspected |
| Selection of exactly one AI member and mapping to spawned pawn | **UNKNOWN**; alternate order UI documents individual selection, not underlying identifiers |
| Runtime owner and retrieval path | **UNKNOWN**; SquadCommandComponent is an observed asset anchor, not an observed runtime instance |
| Host/client authority and legal execution context | **UNKNOWN**; no RPC flags, authority branch, server implementation, or call-site evidence |
| Acceptance and state readback | **UNKNOWN**; visual indicators/voice files do not provide a machine-readable contract |
| Native manual-command precedence and override notification | **UNKNOWN**; cannot yet distinguish companion order from a later player order |
| Current local retail build applicability | **NOT_PERFORMED**; source/distribution existence is not validation on 1.14.390 |

The next meaningful source inspection is a matching, legitimately obtained editor/source view with the native **Lance Status UI** implementation and its references to the documented **SquadCommandComponent** (if any). First resolve the actual full widget package paths; then trace a single selected member through Form On Me dispatch to its receiving object. Record exact node/function/enum names, argument types, instance retrieval, authority gates and all callers before designing an adapter. Record what produces native order feedback and whether a subsequent manual order mutates an observable state/event. Do not substitute `AI MoveTo`, behavior-tree replacement, blind keypress success, or a radio line for these missing facts.

That future inspection must preserve the current authorization boundary: an editor installation, asset import, game process operation, mod activation or live test requires the separately authorized next stage. Continuing broad web searches without a new concrete source lead is unlikely to resolve embedded Blueprint graphs.
