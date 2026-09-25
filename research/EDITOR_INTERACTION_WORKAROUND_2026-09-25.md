# Editor interaction workaround — September 25, 2026

**Latest follow-up: PASS_EDITOR_AUTHORING_ONLY.** The separate [authoring probe](EDITOR_AUTHORING_PROBE_2026-09-25.md) now verifies creation, wiring, compilation, save and same-process reopen of a disposable Blueprint. It also records consumption of the one authorized usage reset. The original mod remains unchanged and its missing in-game readout remains unresolved.

**Historical navigation checkpoint: EDITOR_CAPTURE_AND_NAVIGATION_PROVEN; SCRATCH_CLICK_TYPE_DRAG_PROVEN; Blueprint authoring NOT_VERIFIED at that checkpoint.** The user requested this workaround, then explicitly overrode the 10% usage stop point and the fixed RAM reserve. At that checkpoint, usage was 96% weekly with one available reset, not yet consumed. The findings and helper capabilities below describe that earlier revision; use the linked authoring record for the later result.

## September 25 continuation

[WindowBridge.py](../scripts/WindowBridge.py) provides a one-shot Windows input helper. [WindowBridge-Fixture.py](../scripts/WindowBridge-Fixture.py) is a separate Tk receiver with no input synthesis. Both disposable sessions closed normally through their visible Close buttons; their PIDs were absent afterward.

| Check | Observed result |
|---|---|
| Capture | Physical client pixels matched 720×450 Win32 dimensions, origin (600,306), with the whole fixture inside monitor work area (0,0,1920,1040). |
| Click | Session01 counter visibly changed to 1; independent receiver press/release agreed at screen (699,390). |
| Typing | Session02 Entry and Echo visibly displayed `MW5 bridge typing verified`; receiver recorded that exact 26-character value. |
| Drag | Each session visibly moved the square into its goal and independently recorded 20 motion events and an accepted release. |
| Wrong focus | Session02 refused typing before Entry focus; persisted rejection records zero input. |
| Outside client | Session02 refused (-1,100), with a persisted zero-input rejection. |
| Changed geometry | A fixture button shifted only its window 20px. Old coordinates were refused despite identical image pixels; new origin (620,306) permitted normal closure. |
| Foreground changed | Session01 first click refused input after focus changed. This is tool-transcript evidence, not a persisted receipt from that older revision. |

Raw local evidence (ignored by source backup): `research/evidence/window-bridge/live-20260925-01` and `live-20260925-02`. Captures have PNG/hash/identity receipts; attempts have action results; the receiver independently records events and closure. Session01 widget bounds were defective for several controls and are not calibration evidence. Session02 corrected those bounds. Session01 predates later identity/focus guards and does not validate the final source revision. Post-close refresh failures are expected because the target windows had closed.

The helper requires an explicitly reviewed image hash, a capture at most 120 seconds old, exact process/handle/creation-time identity, stable geometry/focus, current point ownership, no held keys/buttons, and unchanged pixels. Editor actions can name an explicit reviewed image region to exclude unrelated animation: its exact pixels must match, every action point needs a 16px margin, and the straight drag path stays inside. The full image hash and full window/focus/ownership checks remain mandatory. Each capture permits one input attempt. Cleanup releases an owned mouse button on failure. Tk routes keyboard input through its native root, so its actual Entry focus event corroborates the native same-window check. Successful input insertion alone is not application-effect acceptance. Microsoft documents that SendInput uses the global input stream: checks reduce but cannot eliminate human focus/pointer races. [SendInput](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-sendinput)

The editor extension binds only the pinned installed UE4Editor.exe, permits pointer actions, and rejects editor text input. Its scope is reviewed navigation; pointer capability does not make every possible click harmless. The original observer's eight source pins matched before editor launch at 15:31:51 UTC and again after navigation. No asset edits, compile, cook, Play or retail-game action was performed in this proof.

### Actual UE4 observations

Installed editor: UE4 4.26.2, compatible changelist 14830424; PID 28296, process creation value 134348239112222110. These identifiers describe this session only. The first stock-content Message Log contained five missing effect references; their relationship to the observer problem is UNKNOWN.

| UTC on 2026-09-25 | OBSERVED result |
|---|---|
| 15:37:34 | Clicked Blueprint Log in the UE4 Message Log; a fresh screenshot showed that selected log. |
| 15:39:25 | Closed only the Message Log through its visible close button; fresh window enumeration confirmed the main editor remained. |
| 15:47:31 | Refused a planned Blueprint-thumbnail click after foreground changed; persisted receipt records zero input. |
| 15:49:42 | Two click pairs on the existing component thumbnail opened `BP_LanceObserverProbeComponent`; a fresh native window identity and the 15:50:19 graph screenshot confirmed the effect. |
| 15:52:43 | Final helper revision selected the existing `SnapshotOwner` variable. Its highlighted row and matching Details panel were visually confirmed in the immediate capture. No property was edited. |

The main UE4 custom frame reported `IsZoomed = false` and native client bounds (-8,-8,1928,1048). The capture deliberately clipped to the selected monitor's visible work area (0,0,1920,1040), preserving the full native bounds for stale-geometry checks. Coordinates are **screenshot-relative physical pixels**, mapped by `capture_origin`; they are not necessarily native-client-relative. The final mapping label is `physical_capture_pixels_1_to_1`. Older receipts used `physical_client_pixels_1_to_1`; those historical receipts must not be reused for new input. The smaller Blueprint window was fully visible at (331,177) with a 1240×668 capture.

The thumbnail action used the explicit region (0,700,500,930), avoiding a continuously changing performance overlay at the top of the screen. Count=2 was used on a reviewed asset thumbnail where the first click selects it; two inserted click pairs alone do not prove that an application recognized a double-click. The actual opened Blueprint establishes that outcome here. A separate bottom-right notification was not clicked through the main-window binding because its native root was different.

Raw editor evidence roots:

- Message Log: `research/evidence/window-bridge/editor-987943d63ae94f778f5aead2828121a7`.
- Main workspace and thumbnail input: `research/evidence/window-bridge/editor-3defac3b038842c2a27fdd29510e213a`.
- Opened Blueprint and variable selection: `research/evidence/window-bridge/editor-013d4df02b534f97adb81d26bd42d2b9`.

[The evidence index](EDITOR_INTERACTION_WORKAROUND_2026-09-25.json) pins selected receipts/images, final helper sources, and the post-navigation eight-file integrity check. Scratch and earlier editor actions preceded some helper changes; they do not validate every path in the final source revision. After the successful thumbnail action, only coordinate-label/error-message wording changed in the helper; the final revision's capture and single-click path were exercised on `SnapshotOwner`. Post-action capture refusals after a window closed or another window opened mean the original binding no longer owns foreground; they do not invalidate the separately observed application effect.

### Continuing from here

The editor is left open with the component Blueprint visible and `SnapshotOwner` selected. Its existing graph and saved source files are unchanged. The original retail result remains `INCONCLUSIVE_READOUT_NOT_VISIBLE`; this interaction proof does not fix or reclassify it.

For the next control action, obtain a fresh exact window identity, bring that returned editor window forward through the supported Computer Use activation API, and capture it with `WindowBridge.py`. After visually reviewing the image, pass its receipt, exact hash and screenshot-relative pointer coordinates to one `act` call. Rebind after opening a different window. Never reuse the IDs or coordinates in this report without a fresh capture. Interactive desktop access requires the approved outside-sandbox tool route; sandbox enumeration was not viable.

Editor text entry, graph-node placement, pin dragging, compilation and saving remain NOT_VERIFIED. The next independent experiment should use a disposable editor asset to verify authoring before applying this control route to the separate diagnostic mod. Follow `design/OBSERVER_DIAGNOSTIC_CONTROL_MORNING.md` for that mod's established scope; do not infer new retail deployment or main-campaign permission from this navigation result.

The user explicitly said: “Override the RAM usage requirement. Use as much RAM as the PC allows.” The fixed 8 GiB start reserve is waived for this work. Before launch, a real API sample reported 6.074 GiB physical and 9.165 GiB commit headroom; disk was about 15.43 GiB. A denied CIM query's derived zeros were discarded. Current application responsiveness and real failures still govern continuation.

## Earlier Notepad observations

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

## Earlier proposed completion path (superseded by continuation above)

1. Finish capture calibration on a fully visible scratch window: validate monitor bounds, physical pixels, client/window origins, clipping and changed-window rejection. Verify the screenshot actually contains each proposed target before issuing input.
2. Add a separate, narrowly scoped local input adapter if the original tool's geometry route remains unusable. Use documented Windows input APIs, not a private Computer Use helper protocol. It should accept one action only against an allowlisted editor/scratch window, require a fresh reviewed capture and unchanged process/window geometry/focus, and stop on stale state or ambiguous ownership. It must not provide an unattended arbitrary-desktop loop, background listener or permission workaround.
3. Prove a click, text input, drag and immediate recapture in a disposable scratch canvas. Handle modifiers and release every pressed key/button on failure. Accessibility-based SetValue passing in Notepad does not prove UE4 graph input.
4. Only then validate observation/navigation in the real editor, followed by the separate diagnostic mod under the existing source/resource/review gates. Keep all retail/cooking/game actions outside this interaction proof.

At the earlier Notepad checkpoint, the input adapter was not implemented. The continuation above implements and verifies its stated subset. The alternative does not require game injection, a mod loader, remote desktop service or paid service; graph-node authoring remains NOT_PERFORMED.

## Sources and scope

- [Pillow ImageGrab reference](https://pillow.readthedocs.io/en/latest/reference/ImageGrab.html), `window`, `bbox` and `all_screens`; accessed 2026-09-25. Windows single-window support was added in 11.2.1; installed version and callable signature were inspected locally.
- [Microsoft SetProcessDpiAwarenessContext](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setprocessdpiawarenesscontext), process scope, invocation ordering and errors; accessed 2026-09-25. This documents DPI setup, not successful coordinate calibration.
- Installed Computer Use `SKILL.md`, `guidance.md` and `api.md`, version `26.917.71314`; supported accessibility observation and value-setting calls were used without the failed screenshot request. The independent screenshot helper is the user's explicitly requested alternative, not a claim that the original tool now supports these captures.

The editor task's resource preflight at 14:44:47 UTC reported 6.180 GiB available physical RAM, below the existing native supervisor's 8 GiB cold-start admission; commit and disk individually passed. It also reported that all eight editor-source pins matched. These are coordinator-reported observations, separate from the scratch-window test, and must be refreshed before future editor execution.
