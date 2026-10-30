# Foreground process identity error: research and supported next step

Research date: October 27, 2026. Scope: read-only investigation; no native UI actions or editor changes in this research turn.

**No confirmed fix was found for `foreground window did not report a process id`. The best supported candidate is a stable, docked Blueprint editor followed by one bounded targeting test. Human-operated native Copy and screenshots provide an independent evidence-collection fallback. Neither route has been performed as part of this research.**

## Observed local evidence

- **OBSERVED:** The latest controller screenshot succeeded. A subsequent `sky.click` intended to open a context menu returned the exact foreground-PID error. Its following state refresh was not reached. This is distinct from the earlier Windows 10 `FrameArrived` screenshot timeout. See [READY_RETRY_01.json](evidence/b0-win11-inspection-20261027-03/READY_RETRY_01.json).
- **OBSERVED:** That capture contained a 1920x1040 parent composite and a 1228x656 controller image at screen origin 331,177. Earlier window activation/maximization attempts changed geometry; the mechanism is unknown. A user confirmation alone does not establish the actual window state.
- **OBSERVED:** The existing native [BEFORE_EVENTGRAPH.txt](evidence/b0-win11-inspection-20261027-03/BEFORE_EVENTGRAPH.txt) and [independent review](evidence/b0-win11-inspection-20261027-03/BASELINE_REVIEW.json) remain available. Primary EventGraph Copy is not a complete Blueprint/helper/default baseline.
- **OBSERVED:** This research rehashed all 17 custom source files and 43 protected files against the last post-update preservation receipt: every comparison matched. See [PRESERVATION_PID_RESEARCH.json](evidence/b0-win11-inspection-20261027-03/PRESERVATION_PID_RESEARCH.json). No editor restart, Compile, Save, Play, asset modification, setting change or automatic input retry occurred.
- Recorded environment: MW5 editor 1.1.399.0e / customized UE4.26.2; installed Computer Use plugin manifest 26.1021.31345. The previously recorded bundled Sky version is 0.7.13; that runtime version was not re-probed during this research.

## What the sources establish

**DOCUMENTED — matching report, no verified repair:** [OpenAI/codex issue 43777](https://github.com/openai/codex/issues/43777) reports this exact error in a Windows Zotero workflow on app version 26.901.51231. It is open as checked today. Its three reviewed comments do not provide a maintainer diagnosis or confirmed fix. It demonstrates the symptom is not unique to MW5; it does not establish a shared cause.

**DOCUMENTED — older anecdotal recovery:** [Issue 34039](https://github.com/openai/codex/issues/34039), originally reported on app 26.715.31925, says the same error sometimes occurred during state capture with the Codex window foreground and usually cleared after activation and one retry. That report used an unsupported direct helper client. Its foreground observation is only a clue; the helper transport and automatic approval handling are not acceptable workarounds. Our latest failure followed successful capture and occurred during input, so the reproduction also differs.

**DOCUMENTED — official operating conditions:** OpenAI requires Windows Computer Use to operate on the active desktop with the target visible; it cannot run in the background while the same desktop is being used. App access approval and foreground targeting are separate concerns. [OpenAI Computer Use](https://learn.chatgpt.com/docs/computer-use), sections “Windows foreground use” and “Permissions and approvals.”

**DOCUMENTED — Windows behavior, not a diagnosis of Sky:** [GetForegroundWindow](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getforegroundwindow) may return NULL during loss of activation. [GetWindowThreadProcessId](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getwindowthreadprocessid) can fail for an invalid window handle. [SetForegroundWindow](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setforegroundwindow) is restricted and may be denied even when listed conditions hold. These support a transient or failed foreground-identity lookup as a hypothesis; the exact internal failing call is UNKNOWN.

**DOCUMENTED — local API limitations:** Installed `docs/api.md:26` says input methods automatically activate their target. Manual foregrounding therefore cannot guarantee that the next click avoids activation code. `Raise` is allowed only when exposed in a fresh accessibility tree (`api.md:110-113`); its implementation is not documented as different from activation. No exposed API disables the foreground check, overrides its PID, forces input or controls maximize/restore directly.

The installed plugin directory contains documentation/metadata but no inspectable JS/TS implementation explaining this exact error. Its docs contain no matching error-specific repair. The precise failure stage and whether any input was emitted before the exception are UNKNOWN.

Coordinate clicks are documented as window-relative with a screenshot ID cached for the target (`api.md:66-74`). Screenshot origins are screen coordinates, and images may include related transient UI (`api.md:60-64,130-138`). The docs do not fully explain coordinate transformation for the observed cropped-image arrangement. Do not guess offsets or treat the geometry issue as the proven cause of the PID error.

Local documentation root: `C:\Users\jlewi\.codex\plugins\cache\openai-bundled\computer-use\26.1021.31345`.

## Proposed bounded recovery — NOT PERFORMED

1. **Human foreground/layout handoff:** Use Unreal's normal UI to dock the floating Blueprint asset/editor tab alongside the main editor, then leave the intended controller tab visible and foreground. Drag the beveled asset/editor tab, not the EventGraph panel tab. Do not close/reopen the asset, reset the whole layout, save/discard work or use Alt+Space. Alt+Space previously invoked the global ChatGPT overlay on this computer.
2. **Observe the changed layout:** Through the supported `node_repl` / `@oai/sky` entry point, enumerate fresh windows, select the actual returned editor window, and capture it. Discard all old IDs, screenshot IDs, coordinates and element indexes. Confirm the full diagnostic controller identity, idle/no Play, no recovery dialog and no unexpected dirty work. If geometry or identity remains ambiguous, stop before input.
3. **One harmless test:** On a freshly observed stable graph surface, perform one context-menu-open action and refresh. Do not create nodes during the test. If it works, dismiss the menu and verify the resulting state. Because input automatically activates, adding redundant activation calls is not necessary to test the changed layout. A new targeting/capture error ends the attempt immediately; no alternate backend or automatic recovery loop.
4. **Continue only after that succeeds:** Recheck the saved-controller capture gate and follow [MINIMUM_CAPTURE.md](evidence/b0-template-recovery-20261017-01/MINIMUM_CAPTURE.md). Capture the eight native purposes, keeping execution disconnected; copy only the temporary inspection nodes, remove only our additions and compare before/after. Unexpected dirty state or uncertain restoration means preserve and stop. A complete Blueprint/helper/default baseline remains required before production authoring.

Epic documents docking asset/editor tabs in [UE4.27 Layout Customization](https://dev.epicgames.com/documentation/en-us/unreal-engine/layout-customization?application_version=4.27), “Editor Tabs.” This is a supported editor UI operation, **not a verified Sky fix**. The source covers UE4.27, while MW5 uses customized UE4.26.2: confirm the offered docking UI first. Layout changes can persist across sessions even without saving Blueprint content. If docking is unavailable, do not improvise or close the asset.

An exposed accessibility `Raise` is another legitimate but lower-confidence experiment. There is no evidence that it avoids the same activation path, so do not chain it after a failed test or present it as a guard bypass.

## Independent fallback: user-operated native capture

If supported targeting fails again, the user can operate the editor while the assistant reviews evidence offline. Use normal Unreal Copy to put selected graph nodes into text files, and screenshots to retain asset identity and complete pin types, directions and defaults. Epic documents Ctrl+C for Copy Selection and graph context menus in its [UE4.27 Blueprint Editor Cheat Sheet](https://dev.epicgames.com/documentation/en-us/unreal-engine/blueprint-editor-cheat-sheet?application_version=4.27).

The capture packet is `BEFORE_EVENTGRAPH.txt`, `MISSING_NATIVE_TEMPLATES.txt`, `AFTER_EVENTGRAPH.txt`, plus identity and pin screenshots, following the existing [minimum capture checklist](evidence/b0-template-recovery-20261017-01/MINIMUM_CAPTURE.md). The eight purposes are begin/end additive Bind and listener-specific Unbind, a native matching callback, Victory string writer, New GUID, and GUID-to-string. Preserve exact native schema rather than manually transcribing or guessing pins. Existing BEFORE evidence can be reused only if a fresh comparison confirms the graph has not changed.

This workflow does not depend on automated input, but incomplete evidence still blocks conclusions. It preserves the same no Compile/Save/Play and before/after restoration rules. It does not establish runtime compatibility.

## Excluded approaches and remaining uncertainty

- No raw Win32, Python desktop control, direct helper client, helper patch, guessed handles, guard override or injected alternate input. The installed skill explicitly prohibits custom helper protocols (`skills/computer-use/SKILL.md:20`).
- No evidence justifies elevating either application. Microsoft documents integrity-level restrictions for [SendInput](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-sendinput), but this does not diagnose the missing-PID error.
- No evidence identifies a Windows setting, graphics driver change, editor reinstall, Codex restart or particular update as a confirmed fix. Changing them would add disruption without a demonstrated benefit.
- The editor update and Windows 11 upgrade improved the observed capture path; they did not establish reliable automated input. A successful screenshot remains insufficient to authorize blind input.

For a product bug report, retain the exact error, method (`sky.click`), plugin version, editor version, successful immediately preceding capture, multi-image geometry, and stop outcome. No public report, private project source or screenshot was sent during this research.
