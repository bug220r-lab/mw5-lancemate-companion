# Editor interaction workaround — September 25, 2026

**Status: PARTIAL_PROOF — alternative capture and accessible text editing observed; pointer/Blueprint automation NOT_READY.** The user explicitly asked how to develop a workaround for interacting with the editor. This work tested an independent local capture path on a scratch Notepad window, not Unreal or the game.

## Observed results

| Check | Result |
|---|---|
| Original Windows Graphics Capture | Fresh `sky.get_window_state` failed with `SetIsBorderRequired failed: No such interface supported (0x80004002)` |
| App access | Initial Notepad launch approval timed out; user confirmed they could approve, and the next launch succeeded |
| Accessibility-only observation | `sky.get_window_state(include_screenshot=False, include_text=True)` returned Notepad's editable text control and focus |
| Original pointer route | Clicking observed edit element 1 failed with `coordinate input geometry is unavailable`; no successful pointer movement/click is claimed |
| Accessible value editing | `sky.set_value` placed `MW5 capture workaround test - 2026-09-25` in the blank Notepad editor; a fresh tree returned the exact text |
| Sandboxed independent capture | Could not access/enumerate the interactive windows; did not produce an image |
| Approved capture outside sandbox | Exact title/process resolution succeeded, saved local PNGs, and visual inspection confirmed the marker in the window |
| Keyboard probe | An Alt+Space request returned without error, but its intended menu result was not verified; this is not keyboard-control acceptance |
| Unreal editor / assets / game | Not launched, modified or tested in this work unit |

The first helper revision attempted to use the tool's opaque window ID directly. That failed; it was initially described too strongly as a minimized-window result. The corrected helper enumerates native windows independently and requires an exact unique title/process match. Its sandboxed enumeration also failed, while the approved outside-sandbox invocation succeeded. Therefore sandbox desktop access was a demonstrated additional obstacle; no unsupported claim that the original ID could never equal an HWND is made.

## Concrete artifact

[Capture-SelectedWindow.py](../scripts/Capture-SelectedWindow.py) is a project-authored read-only helper using the already installed Pillow 12.3.0. It resolves a unique current window, checks process/title/visibility/minimized state and before/after geometry, and writes a PNG plus JSON receipt beneath `research/evidence/desktop-capture`. It contains no input injection, focus change, listener, network request or binary-asset editing.

Two methods exist:

- `window`: Pillow's HWND capture. An earlier helper revision produced an image showing the marker but omitting the frame and retaining a black lower area. The final helper revision has not been rerun with this method. It is not accepted as complete window geometry.
- `screen`: captures the identified foreground window rectangle and refuses a different foreground window before or after capture. The tested image showed the title, menu and marker. The lower region was black and the window extended down to y=1323; complete visible bounds/monitor clipping were not validated. Do not use this image to assume valid clickable coordinates throughout the rectangle.

The helper sets only its own process DPI context before geometry calls; it does not change Windows display settings. Screenshot production is not equivalent to a calibrated pointer system.

Local evidence (excluded from the source backup; these paths will not resolve in GitHub):

- Initial local image: `research/evidence/desktop-capture/20260925T145845669429Z/receipt.json`.
- Visible-marker HWND capture from an earlier helper revision: `research/evidence/desktop-capture/20260925T150104380428Z/receipt.json`, image SHA-256 `dca934612f50583a19883b8e3fe704b4fd3c047a66b9fe08561cdec95bfd3cb5`.
- Foreground-rectangle capture made with the then-current helper: `research/evidence/desktop-capture/20260925T150227489149Z/receipt.json`, image SHA-256 `afe15f349a0e4cef55990732cc7909d7a18a5b47c1b4e5f08888910ab781b216`. The later source-only dimension guard has not been exercised in a live capture.

Notepad contains only the unsaved test marker and remains open. No user document was opened or overwritten. Screenshots stay local and are not source-publication artifacts.

## Proposed completion path

1. Finish capture calibration on a fully visible scratch window: validate monitor bounds, physical pixels, client/window origins, clipping and changed-window rejection. Verify the screenshot actually contains each proposed target before issuing input.
2. Add a separate, narrowly scoped local input adapter if the original tool's geometry route remains unusable. Use documented Windows input APIs, not a private Computer Use helper protocol. It should accept one action only against an allowlisted editor/scratch window, require a fresh reviewed capture and unchanged process/window geometry/focus, and stop on stale state or ambiguous ownership. It must not provide an unattended arbitrary-desktop loop, background listener or permission workaround.
3. Prove a click, text input, drag and immediate recapture in a disposable scratch canvas. Handle modifiers and release every pressed key/button on failure. Accessibility-based SetValue passing in Notepad does not prove UE4 graph input.
4. Only then validate observation/navigation in the real editor, followed by the separate diagnostic mod under the existing source/resource/review gates. Keep all retail/cooking/game actions outside this interaction proof.

The alternative does not require game injection, a mod loader, remote desktop service or paid service. Whether it can accurately operate UE4's graph canvas is still NOT_PERFORMED. The proposed input adapter was not implemented in this work unit.

## Sources and scope

- [Pillow ImageGrab reference](https://pillow.readthedocs.io/en/latest/reference/ImageGrab.html), `window`, `bbox` and `all_screens`; accessed 2026-09-25. Windows single-window support was added in 11.2.1; installed version and callable signature were inspected locally.
- [Microsoft SetProcessDpiAwarenessContext](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setprocessdpiawarenesscontext), process scope, invocation ordering and errors; accessed 2026-09-25. This documents DPI setup, not successful coordinate calibration.
- Installed Computer Use `SKILL.md`, `guidance.md` and `api.md`, version `26.917.71314`; supported accessibility observation and value-setting calls were used without the failed screenshot request. The independent screenshot helper is the user's explicitly requested alternative, not a claim that the original tool now supports these captures.

The editor task's resource preflight at 14:44:47 UTC reported 6.180 GiB available physical RAM, below the existing native supervisor's 8 GiB cold-start admission; commit and disk individually passed. It also reported that all eight editor-source pins matched. These are coordinator-reported observations, separate from the scratch-window test, and must be refreshed before future editor execution.
