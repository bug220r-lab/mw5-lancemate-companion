# Retail input configuration check — September 25, 2026

**OBSERVED (offline config only).** A bounded read of the installed retail base PAK found its `MW5Mercs/Config/DefaultInput.ini`. It has **no explicit F11 action or axis mapping**, but line 133 sets `bF11TogglesFullscreen=True`. F11 must therefore **not** be treated as a free diagnostic-control key. No alternative chord is certified safe by this file check. No game/editor was launched, input setting changed, mod authored, or retail file written.

## Exact source and extraction

- Retail metadata: `C:\Program Files (x86)\Steam\steamapps\common\MechWarrior 5 Mercenaries\game_info.xml`, SHA-256 `a3fbbe56a51ca7950b85570b2c074c9c54beeba585e48cb1887e307850316afb`, identifies game 1.14.390 / CL456620. This is the installed metadata, not a gameplay compatibility result.
- Base PAK: `MW5Mercs/Content/Paks/MW5Mercs-WindowsNoEditor.pak` under that retail root; 90,786,417,647 bytes, last-write time 2026-08-11T03:45:58.2033250Z. Its entire 90.8 GB payload was not hashed. The installed UnrealPak `-Info` reported version 11, unencrypted index, index size 3,652,738 bytes, and index SHA-1 `9E8A75DA244301E8974C2C6A67FD39FE480B4B25`. `-List` identified `MW5Mercs/Config/DefaultInput.ini`, 74,498 bytes, entry SHA-1 `222455792BF1AA3BAB8FF4110CBE377A4A0A0A5C`.
- Reader: installed editor `Engine/Binaries/Win64/UnrealPak.exe`, 166,400 bytes, SHA-256 `fd05fe25d9707b39b8419028b867e3a1d9f0ea395577af7a3b41712a062b7dc5`, already pinned by [the package receipt](OBSERVER_PACKAGE_RESULT_2026-09-25.json). Its own help declares `-Extract <ExtractDir> [-Filter=<filename>]`. The exact filter first extracted only `Config/Input/LanceObserverProbeInput.ini` from the small probe PAK into an ignored `tmp/` test folder.
- The same installed tool then extracted **only one** retail entry with `-Filter=MW5Mercs/Config/DefaultInput.ini` into ignored `tmp/retail-input-20260925-01/MW5Mercs/Config/DefaultInput.ini`. It was 74,498 bytes; SHA-1 `222455792BF1AA3BAB8FF4110CBE377A4A0A0A5C` matches the listing, and SHA-256 is `c306521f3b2bb3c0bc8e0079b4fa5750dc901c6cefd36d7e6b88a7e62f779fe4`. The retail PAK's length and last-write time were unchanged after extraction. The extracted bytes remain local and are not in the source backup.

## Binding findings

The other checked input sources were `C:\Program Files\Epic Games\MechWarrior5Editor\MW5Mercs\Config\DefaultInput.ini`, `C:\Program Files (x86)\Steam\steamapps\common\MechWarrior 5 Mercenaries\MW5Mercs\Mods\modlist.json`, and `C:\Users\jlewi\AppData\Local\MW5Mercs\Saved\Config\WindowsNoEditor\Input.ini`.

The extracted file has 431 lines, including 253 `+ActionMappings` and 26 `+AxisMappings`. Line 133 configures F11 as a fullscreen toggle. Line 214 maps stock action `Any` to `AnyKey`; this is a source mapping, not a demonstrated gameplay conflict for every key. F1–F4 are explicitly mapped to lance dispatch actions at lines 210–213. The retail file and the editor's `DefaultInput.ini` have the same 431 lines and action/axis counts; the only line-by-line differences are two trailing spaces in editor lines 5 and 11. The editor file itself is 74,500 bytes, SHA-256 `52506733f01d33ed6a6f589bc742162d1f28ca510cd450ca5b5ae2939d799462`.

At this check, the retail enabled-mod list SHA-256 was `d483286e4913d77e1dd4332e3c560101b73b568c7833eebd2fb8f5667e5cba0b` and listed only `LanceObserverProbe`. Its mod input template contains commented examples, not an active binding. The user's `Saved/Config/WindowsNoEditor/Input.ini` was two bytes, SHA-256 `7eb70257593da06f682a3ddda54a9d260d4fc514f645237f5ca74b08f8da61a6`; that file alone cannot prove effective default or overlay bindings. No loose retail `*Input*.ini` was found under `MW5Mercs` before the targeted PAK read.

## Phase A consequence

Keep `ObserverDiagnosticSnapshot`'s key/chord **unassigned** in the [morning control plan](../design/OBSERVER_DIAGNOSTIC_CONTROL_MORNING.md). The retail base configuration rules out F11 as a defensible choice. A different chord needs a current binding review, including effective runtime mapping and system/Steam/overlay conflicts, before the control's input configuration is finalized. This read does not prove how `AnyKey` is handled in the mission, that another key is unused, or that a new mod input action fires in shipping. It does not establish observer creation or recording.
