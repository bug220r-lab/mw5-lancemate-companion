# Editor telemetry source audit

Accessed **2026-09-20**. **OBSERVED: installed filenames and printable ASCII fragments only.** A live telemetry reader, signatures, field types, actor binding, update rate and shipping behavior remain **UNKNOWN / NOT_PERFORMED**.

Scope: filename enumeration within installed `MW5Mercs/Content/Objects`, `AI/_common` and `UI/Mech`; byte inspection of **two selected assets only**, totaling **523,457 bytes**. No editor launch, asset load, graph evaluation, gameplay call or installed-file change occurred. Only this project audit was written.

Installation root: `C:/Program Files/Epic Games/MechWarrior5Editor/MW5Mercs/Content/`. The earlier [diagnostic log](evidence/editor-source/native-reflection-editor.log) identifies engine **4.26.2-0+++UE4+Release-4.26**; that run failed before producing reflection evidence. This audit is separate from that failed probe.

Method: read each selected file as bytes, compute SHA256 over those bytes, map each byte one-to-one using Latin-1, then locate printable ASCII runs with `[\x20-\x7E]{4,}`. Offsets below are **zero-based byte offsets from the start of the .uasset**. No package parser, disassembler or Blueprint graph reconstruction was used. These loose editor-content files contain Blueprint-related names; package cook flags were not decoded.

## 1. Position lead

File: [BTDecorator_WithinRangeFromActor.uasset](<C:/Program Files/Epic Games/MechWarrior5Editor/MW5Mercs/Content/AI/_common/Decorators/BTDecorator_WithinRangeFromActor.uasset>)  
Size: **72,072 bytes**  
SHA256: `440013B9EF61E0E1D1F4F4114E3B166B0161BB7B4A79D8404E13B613E6FDD4C4`

| Byte offset | Observed ASCII fragment |
|---|---|
| 957 / 0x3BD | `BlackboardKeySelector` |
| 1022 / 0x3FE | `Blueprint` |
| 1693 / 0x69D | `CallFunc_K2_GetActorLocation_ReturnValue` |
| 1742 / 0x6CE | `CallFunc_K2_GetPawn_ReturnValue` |
| 2931 / 0xB73 | `K2_GetActorLocation` |
| 2959 / 0xB8F | `K2_GetPawn` |
| 4524 / 0x11AC | `Subtract_VectorVector` |
| 4826 / 0x12DA | `Vector` |

**PROPOSED next source check:** inspect this specific decorator's graph to identify the owning controller, which pawn/actor feeds each location, and any blackboard selection. It is a concrete place to investigate actor position, not proof that these fragments form a connected or executed path.

**UNKNOWN:** input/return signatures, coordinate semantics, selected actor identity, authority, freshness and whether this behavior is used by a lancemate. A literal `Vector` elsewhere in the file does not establish any particular pin's type.

## 2. Health-display lead

File: [MechTargetComponent.uasset](<C:/Program Files/Epic Games/MechWarrior5Editor/MW5Mercs/Content/Objects/Targets/MechTargetComponent.uasset>)  
Size: **451,385 bytes**  
SHA256: `C1FB86C0E4C3DBC3395606F7ACD1A788B9A9720E2EFA5885A1EA50387CBC2B0C`

| Byte offset | Observed ASCII fragment |
|---|---|
| 669 / 0x29D | `/Game/Objects/Targets/MechPaperDoll` |
| 965 / 0x3C5 | `/Script/MechWarrior` |
| 1382 / 0x566 | `Blueprint` |
| 1985 / 0x7C1 | `CenterTorsoArmor` |
| 2041 / 0x7F9 | `CenterTorsoInternal` |
| 3302 / 0xCE6 | `GetOwner` |
| 4380 / 0x111C | `LeftArmArmorDamage` |
| 4495 / 0x118F | `LeftArmInternalDamage` |
| 5407 / 0x151F | `MWMech` |
| 7273 / 0x1C69 | `SetupPaperDoll` |
| 36690 / 0x8F52 | `Class'/Script/MechWarrior.MWTargetComponent'` |

**PROPOSED next source check:** inspect the component's owner association and paper-doll setup, then follow actual references to the provider of component damage values. The armor/internal labels make this a health-display lead; they may describe presentation, static configuration or serialized names rather than accessible current health.

**UNKNOWN:** whether any named value is current/max health, damage amount, normalized fraction or display state; how it is populated; whether it belongs to the player, a target or a lancemate; and whether a safe reader exists. No callable health getter was established by this audit.

## Decision

Prioritize the small position decorator for a bounded actor-position trace. Keep the target component as the second, explicitly weaker, route toward damage telemetry. Do not create a telemetry schema from these strings or mark a native bridge gate passed. The ongoing GUI shader compilation was neither controlled nor waited on by this audit.

