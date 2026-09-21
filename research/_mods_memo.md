# Mod compatibility research memo

Working research handoff retained for provenance. Final environment and recommendations are in FEASIBILITY.md and SOURCES.md; this memo is not an active-installation inventory.

Research date: 2026-09-20. Public author-maintained pages and file listings only. No downloads, installations, game launches, source extraction, messages to authors, or runtime tests. No assumption that any named mod is installed locally. This memo is supporting research, not a compatibility certification.

## Evidence register

All URLs accessed 2026-09-20. These are mutable pages, not pinned commits. No source commit SHA was established for a released mod. Section names provide reproducible locations; displayed site times retain the page's time zone ambiguity.

| ID | Original-author resource | Exact relevant sections | Evidence limit |
|---|---|---|---|
| M01 | [TTRulez_AIMod3 description](https://www.nexusmods.com/mechwarrior5mercenaries/mods/269?tab=description), Oraeon1224 | Permissions and credits; Changelogs Beta0.8/0.6; Compatibility; How to set new behaviors in deployment/in mission; Lancemate behaviors | Author description, not inspected Blueprint source or runtime proof |
| M02 | [TTRulez files](https://www.nexusmods.com/mechwarrior5mercenaries/mods/269?tab=files) | Main files: TTRulez3_Beta0_8, TTRulez2; Optional files: OriginalJJ, VoiceAttackProfile | Current filenames and upload dates are stronger identifiers than page's generic version 1 |
| M03 | [330's Pilot Overhaul](https://www.nexusmods.com/mechwarrior5mercenaries/mods/477?tab=description), Wpnx330/nofear001 | File information; Permissions; Version 7.0.4; Installation instructions | Legacy page retrieved from older crawl; do not treat its dependency instructions as Eternal's |
| M04 | [Pilot Overhaul - Eternal](https://www.nexusmods.com/mechwarrior5mercenaries/mods/1265?tab=description), Jackalope85/Wpnx330 | File information; Requirements; Permissions and author notes; 8.6.1, 8.1.0, 8.0.0; Major Features | Continuation with author permission, not the same artifact as legacy 330 |
| M05 | [Eternal files](https://www.nexusmods.com/mechwarrior5mercenaries/mods/1265?tab=files) | Main files; 8.5.1 and 8.5.0 old-file notes | No separately labelled source distribution located |
| M06 | [Yet Another Mechlab](https://www.nexusmods.com/mechwarrior5mercenaries/mods/459?tab=description), cszolee79/trueg/DeadRaiser | File information; Permissions and author notes; description compatibility; TTRulezAI support | Page claims do not establish installed build or external telemetry API |
| M07 | [YAML files](https://www.nexusmods.com/mechwarrior5mercenaries/mods/459?tab=files) | Main file; Optional Source files; YAML External Interface | Source package listed, contents and readme not downloaded/inspected |
| M08 | [YAML author changelog](https://steamcommunity.com/sharedfiles/filedetails/changelog/2549720490?p=3) | June 1, 2024; 0.92.2 | Historical extension mechanism; current retained implementation unverified |
| M09 | [Coyote description](https://www.nexusmods.com/mechwarrior5mercenaries/mods/263?tab=description), Coyotekins | File information; Permissions; Changelogs 4.8, 4.7, 4.6 | No independently verified controller/behavior-tree asset list |
| M10 | [Coyote files](https://www.nexusmods.com/mechwarrior5mercenaries/mods/263?tab=files) | Main 4.8.3; old 4.8 | DLC8 statement present in file notes; exact build absent |

## Findings supported by these resources

### TTRulez family

M01: TTRulez3 changes enemy and lancemate AI, targeting, jumpjets, formations and order behavior. It claims DLC8 support. Deployment settings include roles, attack/follow/move behavior and formations. Some in-mission controls remain labelled forthcoming, and defend-target is excluded from the initial release; do not promise them. Current text says role selection moves out of YAML/MercTech. Formation-changer mods are declared incompatible. Coyote missions use generic game AI according to the author. Modification and asset reuse permissions are permissive, with attribution required for reupload. No public source archive/repository or stable programmatic order API was established from examined pages. Behavioral capability is documented; exact implementation assets and callable symbols are unknown.

M02: TTRulez3_Beta0_8 was uploaded August 7, 2026, 17:20; TTRulez2 was uploaded May 28, 2026, 21:07 as the previous mod updated for DLC. Do not combine families or infer TTR2 command semantics from TTR3. OriginalJJ is an optional compatibility file for mods including YAML that alter jumpjets; its note specifies overwrite considerations. The dated 2022 VoiceAttack profile is evidence of voice-to-menu automation, not current remote-command API support. Earlier LancemateOrderz files document F7 menus and dependency on AIMod2; that is historical evidence only.

### Pilot identity family

M03: Legacy 330's Pilot Overhaul shows 7.0.4, March 16, 2024, and DLC6 fixes. It requires MW5 Compatibility Pack in its own instructions. Permissions allow credited improvements/bug fixes, but separate asset use needs permission; redistribution and conversion are restricted. This is historical comparison, not recommended present-day compatibility evidence.

M04: Eternal shows 8.6.1, May 26, 2026, with DLC8 support. It is maintained with Wpnx330's permission. Pilot name, callsign, portrait, backstory and voice are customizable; affinity, quirks, injury, fatigue and pilot records alter identity/state semantics. Mod Options configures it. Compatibility Pack dependency was removed in 8.0.0; DropPreparationWidget override was removed in 8.1.0. Published permissions allow credited improvements but require asset-use permission and identify third-party assets; original-mod permissions must be discussed with Wpnx330. No source/API availability was demonstrated. Display name and callsign are therefore unsuitable as the sole persistent identity key (engineering inference).

M05: Main Eternal download is 489MB, May 26, 2026. The 8.5.x notes document separated portrait packs and missing-portrait recovery concerns. Pilot state recovery and save migration must be explicitly tested, not inferred from a menu opening successfully.

### YAML

M06: YAML shows 0.98.5.1, September 12, 2026. Description claims MW5 1.14.390/DLC8 Patch 2 and supports TTRulez roles, but that role text conflicts with current TTR3's migration statement. Permissions require author consent for modification and prohibit rereleasing under another name or as a fork; third-party assets are also identified. Source availability does not equal permission to redistribute. Configuration/loadout changes mean weapon capabilities and effective range cannot safely be inferred from chassis alone (engineering inference).

M07: Optional editor-plugin source is explicitly listed (7.6GB; September 12, 2026, 10:26). Separate YAML External Interface 2.14 (107KB; May 26, 2026) documents asset-implemented interface functions, weapon mode switching and DerivedMech messages. This establishes a modding resource, not arbitrary network IPC, external-process telemetry, general order injection, or save-safe pilot identity. Main-file note still says 1.14.389/DLC8 Patch 1, unlike M06: preserve this discrepancy pending artifact validation. No source downloaded or readme inspected.

M08: A historical author changelog describes custom actors via Resources/YamlLoadList_PersistentModActors.ini, optional MWPersistentActorInterface, and a YamlLogString helper. These are leads for a later bounded editor/source inspection, not a reason to add YAML to the minimal baseline. Their present availability and lifecycle behavior remain untested.

### Coyote

M09: Current page shows 4.8.3, June 21, 2026. Beyond procedural missions, changelogs describe second-lance state/orders, friendly tanks, clanner targeting/cover behavior and navmesh rerouting. The 4.8 notes explicitly say rerouting for most enemy tanks/mechs does not work with TTRulez active. Permission is required for modification or asset use; reupload and commercial reuse are restricted. No public source archive or general runtime interface established. This directly prevents treating mission-only compatibility as behavior compatibility.

M10: 4.8.3 is a 550.4MB current main file; 4.8 notes explicitly mention DLC8, new repathing for enemies, second lance and player tanks, excluding ordinary lancemates. Exact target build is not supplied. These distinctions matter when scoping telemetry to the player's initial three lancemates.

## Compatibility interpretation and required inspection

The statements above show overlapping responsibilities, not exact asset collisions. Do not claim a controller class, Blackboard key, Behavior Tree or UFunction exists based on these mod descriptions. In a later authorized source/editor inspection, enumerate actual override paths, inheritance, Blueprint interfaces and owner/lifecycle rules; record package version/hash and verify a live command's effect. Merely locating a similarly named asset or seeing a load-order warning disappear is insufficient.

Read-only telemetry can still become wrong without crashing: skill-to-accuracy translation, mutable pilot presentation, different target/formation ownership, substituted actors, mission-specific AI and weapons with modded ranges all affect meaning. Runtime control needs one writer per semantic responsibility. The bridge should ask an adapter to execute an allowlisted intent through the active native AI/order system; it should not alternate direct movement writes against a mod's behavior tree.

## Minimal vanilla configuration (proposal only; NOT_PERFORMED)

Use a separate disposable local test context with pinned game/editor build and recorded DLC entitlement, default game AI, stock chassis/loadouts and stock pilots. Begin in a reproducible Instant Action mission with player plus one lancemate, then repeat with three. Disable optional gameplay mods only in that isolated future context, with the user's explicit launch/mod-change authorization; do not change the active profile during this sprint. Keep the first bridge additive and require no YAML, AI overhaul or pilot overhaul dependency. Capture baseline native attack-target, follow and move-to behavior before any bridge action. Verify command cancellation, manual-order precedence, death/despawn, player mech swap, mission restart/end, invalid pilot references and service disappearance. Use vanilla campaign state only in a later isolated-save persistence probe if required; Instant Action alone cannot establish stable campaign pilot identity.

## Later compatibility matrix (all NOT_PERFORMED)

Each row is a separate recorded configuration; pin actual mod artifact hashes and game build before a result becomes PASS.

| Stage | Configuration | Main question / minimum evidence |
|---|---|---|
| 0 | Vanilla baseline, bridge disabled | Native orders and telemetry ground truth |
| 1 | Vanilla + proposed bridge | Additive initialization; mission/pilot mapping; allowlisted command round trip; manual override and fail-safe |
| 2A | Stage 1 + TTRulez2 only | Older order adapter, legacy role/formation semantics; behavior ownership |
| 2B | Stage 1 + TTRulez3 Beta0.8 only | Current deployment/in-mission feature boundaries; move/target ownership; formations; generic fallback |
| 3 | Stage 1 + Eternal + required Mod Options | Rename/callsign changes, fatigue/injury, unavailable pilots, death/MIA and save reload; identity persistence |
| 4 | Stage 1 + YAML | Derived actor/equipment differences, range/weapon modes, team relations and target validity |
| 5 | Stage 1 + Coyote | Mission lifecycle, ordinary versus second lance, allied tanks, extra spawns and ownership exclusion |
| 6 | Relevant pairwise combinations | YAML+Eternal; YAML+each TTR family; Coyote+each TTR family; Eternal+each TTR family. Resolve version-specific conflict, do not assume transitivity |
| 7 | Exact intended full stack | Repeat critical gates under intended mission types; retain reduced known-good profile |

For TTR3+Coyote, preserve both author statements rather than choose one: generic fallback may permit play while suppressing particular AI improvements. Successful launch or mission completion would still not prove identical companion behavior. Any pass must specify what functions remain enabled, which adapter owns orders and which documented features are intentionally unavailable.

Recommended source next step: inspect vanilla editor interfaces first. YAML source/interface packages are a documented later option if vanilla facilities prove insufficient. TTRulez, Eternal and Coyote source availability and per-file permissions remain unknown until directly obtained/verified through permitted author resources. No author contact occurred.
