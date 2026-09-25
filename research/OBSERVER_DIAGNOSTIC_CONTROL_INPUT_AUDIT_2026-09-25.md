# Diagnostic control input audit — September 25, 2026

**Status: PROPOSED_BINDING / NO_CONFLICT_FOUND_IN_INSPECTED_CONFIGURATION.** Recommend **unmodified F8** for the proposed `ObserverDiagnosticSnapshot` action. This is an authoring choice supported by the narrow configuration review below, not a runtime claim that the input reaches the substituted controller or has no other listener.

The new mod's generated input file was re-read at **2026-09-25T17:52:13.7311709Z**. It remains the untouched 1,383-byte template. This audit changed no installed configuration, asset, game setting or UI. No application was launched and no key was pressed. Only this project report was created.

## Proposed authoring settings

In the new mod's existing `[/Script/Engine.InputSettings]` section, the proposed single addition is:

```ini
+ActionMappings=(ActionName="ObserverDiagnosticSnapshot",bShift=False,bCtrl=False,bAlt=False,bCmd=False,Key=F8)
```

On the corresponding Blueprint input-action event, verify in its actual Details panel:

- **Consume Input: unchecked** (`False`). The diagnostic should not suppress lower-priority input listeners.
- **Execute When Paused: unchecked** (`False`). Trigger only during the future reviewed, unpaused Instant Action test.
- Use **Pressed** for the planned `Do Once` display chain. Do not add a native action-name override, a raw-key substitute, or a gameplay modifier chord.

These event settings are proposed, not observed authored settings. The intended output chain and later test boundary remain in [the Phase A plan](../design/OBSERVER_DIAGNOSTIC_CONTROL_MORNING.md).

## Observed generated template

Actual new file:

`C:\Program Files\Epic Games\MechWarrior5Editor\MW5Mercs\Plugins\LanceObserverDiagnosticControl\Config\Input\LanceObserverDiagnosticControlInput.ini`

- Size: **1,383 bytes**.
- SHA256: **`fc21b00d6db183e8434466e27f0f4fc194f7e852f66ce68bc15c9323271aa17d`**.
- Modification time: **2026-09-25T17:47:03.9332518Z**.
- Lines **8–12** describe the Shift/Ctrl/Alt/Cmd and Key fields.
- Line **19** supplies `[/Script/Engine.InputSettings]`.
- Line **20** supplies a commented `+ActionMappings=(ActionName="InputActionName",bShift=False,bCtrl=False,bAlt=False,bCmd=False,Key=F5)` example. Its semicolon means the example is not an active mapping.
- Line **21** supplies a commented axis example.
- There is no `ObserverDiagnosticSnapshot` or `F8` entry yet.

The generated file is byte-identical to both the installed source template `MW5Mercs\Content\ModTemplates\BaseTemplate\Config\Input\PLUGIN_NAMEInput.ini` and the original probe's `MW5Mercs\Plugins\LanceObserverProbe\Config\Input\LanceObserverProbeInput.ini`, beneath the same editor installation root. The original probe configuration therefore remains unchanged and has no active action addition.

## Binding and enabled-mod evidence

All following paths and line numbers refer to installed files read during this audit. The hash table was refreshed at the timestamp above. Applicable recorded configuration is the UE4 Release-4.26 editor and retail mod-list game version **1.14.390**; the retail executable version was not independently re-read by this subtask.

| Source | Observed finding |
|---|---|
| Editor `MW5Mercs\Config\DefaultInput.ini` | No whole-word `F8` or proposed action name. Lines **210–213**, **237**, **243** bind F1–F6 to native order actions. Lines **177**, **179**, **182**, **186**, **215** bind modifier keys themselves to gameplay actions. |
| Editor `Engine\Config\BaseInput.ini` | No F8 binding. Line **10** enables F11 fullscreen; lines **34–35** bind F11 editor commands. F11 remains excluded. Lines **46–47** also bind PageDown/PageUp debug targets. |
| `%LOCALAPPDATA%\MW5Mercs\Saved\Config\WindowsNoEditor\GameUserSettings.ini` | **Line 16**, `InputTypeToActionKeyMap`, contains populated retail action bindings. No F8 or proposed action name occurs in this file. Its keyboard mappings include LeftControl=ToggleFreeLook, RightControl=ToggleWeaponGroup, and LeftShift=ActivateMASC/Sprint. Axis records at lines **101–126** contain no F8. |
| `%LOCALAPPDATA%\MW5Mercs\Saved\Config\WindowsNoEditor\Input.ini` | Two bytes only. Its emptiness is not evidence of an unused key; actual populated bindings above were reviewed. |
| Editor `MW5Mercs\Saved\Config\Windows\Input.ini` | Also two bytes only; not used as sole evidence of key availability. |
| Retail `MW5Mercs\Mods\modlist.json` | Lines **2**, **5–7** report game version `1.14.390` and only `LanceObserverProbe` enabled in this recorded list. |

The retail root is `C:\Program Files (x86)\Steam\steamapps\common\MechWarrior 5 Mercenaries`. The editor root is `C:\Program Files\Epic Games\MechWarrior5Editor`.

Unmodified F8 avoids deliberately pressing the known gameplay modifier keys. This rationale does not establish how every native listener handles extra modifiers; the later test should use the documented unmodified key once.

The installed original probe PAK was also rehashed during the initial audit: **19,675 bytes**, SHA256 `b913e0f0a8c9f6aa53b8f25e2414f8c700e06fbab0a53bcec5884ab8ce5211d6`. It matches the previously reviewed package. Its existing [nine-entry PAK listing](evidence/editor-source/observer-package-20260925T054502Z/UnrealPak-list-output.txt) lists the unchanged input template at `Config/Input/LanceObserverProbeInput.ini`. No new unpacking or PAK tool execution was performed.

The Steam Workshop installation metadata lists packages **2677921408** (Cockpit Glass), **2811899266** (Another MW4 Lasers), and **3746349463** (Another MW4 Lasers RETRO). Their descriptor titles were read from `steamapps\workshop\content\784080\<id>\mod.json`. These packages are not entries in the inspected enabled-mod list. Their presence does not prove enabled status, and their packed contents were not collected.

## Pinned inputs

| Source | Bytes | SHA256 |
|---|---:|---|
| New diagnostic generated input / source template / original probe input, each | 1,383 | `fc21b00d6db183e8434466e27f0f4fc194f7e852f66ce68bc15c9323271aa17d` |
| Editor `MW5Mercs\Config\DefaultInput.ini` | 74,500 | `52506733f01d33ed6a6f589bc742162d1f28ca510cd450ca5b5ae2939d799462` |
| Editor `Engine\Config\BaseInput.ini` | 22,759 | `4b53855e2d4d43f123af1774fc01607821a21bdb7e974fc45d2500c7003beba8` |
| Retail user `GameUserSettings.ini` | 20,703 | `d37a6ff9be1c81d6885a6ddc7c516cf4e7d1460d7ac0dbd6dc24ca39a6d6a48d` |
| Retail user `Input.ini` / editor generated `Input.ini`, each | 2 | `7eb70257593da06f682a3ddda54a9d260d4fc514f645237f5ca74b08f8da61a6` |
| Retail `Mods\modlist.json` | 112 | `d483286e4913d77e1dd4332e3c560101b73b568c7833eebd2fb8f5667e5cba0b` |

## Limits and next verification

- **AnyKey is present** in the native/retail action mappings. Unchecked consumption is intended to preserve input propagation; it cannot promise that no other listener reacts, or that another listener will not consume the key first.
- No exhaustive inspection of retail packed defaults, hardcoded/native handlers, all Blueprint raw-key events, Workshop packed input, operating-system/overlay hotkeys or keyboard firmware was performed. No claim of globally exclusive F8 ownership is made.
- F8 has not been pressed in either editor or retail. Do not use this audit as permission to enter Play or as evidence about editor Play-session shortcuts. The planned functional test is a separately reviewed retail Instant Action scenario.
- The editor's recognition of a new mod-local input action, its event settings, compilation, cooked inclusion and actual shipping input routing remain **NOT_PERFORMED** at this checkpoint.
- Before authoring, preserve the generated file's baseline and add only the reviewed mapping. Do not edit the user `Input.ini`, stock `DefaultInput.ini`, source template or original probe configuration.
- Before a future authorized retail test, refresh native/user bindings and enabled-mod state, confirm the packaged input configuration and event settings, and use the Phase A baseline/stop/rollback procedure. No marker would remain inconclusive rather than prove absence of the original observer.

**Authoring blocker:** none found in this narrow input audit. **Runtime acceptance:** untested. UI work remains under the root operator's separate focus/pointer-interference pause; this report does not resume or authorize input.
