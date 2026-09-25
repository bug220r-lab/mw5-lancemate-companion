# Phase A unattended authoring preflight — September 25, 2026

**Result: BLOCKED_APP_CAPTURE_APPROVAL_TIMEOUT. Phase A assets remain NOT_BUILT.** This is a fresh capability check requested through the coordinating task, not an attempted editor authoring run. The window count and capture error below come from that task's tool transcript; this summary is not a saved raw UI receipt. No editor/game launch, asset change, input injection, cooking or deployment occurred.

## Current evidence

1. Read the installed `computer-use` skill, guidance, confirmations and relevant API reference. Its documented entry is the persistent Node session with `@oai/sky`.
2. Discovery found `mcp__node_repl__js`. Importing `@oai/sky` succeeded. **The Windows API entry point is callable**; it must not be described as absent merely because the separate `cua_repl` surface has native APIs disabled.
3. `sky.list_windows()` succeeded and returned six open windows, including one unambiguously identified Task Manager window. No editor/game window was returned. The independent process check also returned no game/editor process.
4. Before considering an expensive editor launch, issued exactly one read-only `get_window_state` request for that returned Task Manager window with screenshot enabled and accessibility text disabled. It returned **`Computer Use app approval timed out`**. No screenshot/state result was obtained. No click, key, activation or text-entry action was issued, and the request was not retried.

The current blocker is the app-approval timeout on observation. The historical `SetIsBorderRequired` / `E_NOINTERFACE` capture failure was **not** reproduced by this call because capture did not return a frame. Do not equate the timeout with a proven renderer failure, successful approval or a missing package.

The user's bedtime instruction and existing authorizations cover useful preparation, but they do not cause an unanswered app approval to succeed. No pending user question is needed while the user is asleep. A later awake session can attempt the app's approval flow, then verify one usable observation before any editor-control attempt. Authorization to work and the availability of a usable visual control surface are separate requirements.

## Other preconditions remain separate

The coordinating task reported a fresh read-only resource sample: 7,843,766,272 bytes available physical RAM, 10,287,628,288 bytes available commit and 16,857,145,344 bytes free on C:. That is below the existing native supervisor's 8 GiB physical-RAM admission. These values are attributed to the coordinator's `WinBackend.sample()` observation, not independently sampled here and not a continuing resource guarantee. No threshold was relaxed and no process was terminated.

The proposed diagnostic key remains unassigned. The coordinator's exact retail DefaultInput.ini inspection found `bF11TogglesFullscreen=True`; absence of an F11 action mapping does not make F11 free. Preserve that input audit as separate evidence rather than assigning a chord from an incomplete map.

## Morning continuation

Continue with [the staged morning guide](../design/OBSERVER_DIAGNOSTIC_CONTROL_MORNING.md). Manual authoring remains the planned alternative in an awake editor session, subject to fresh resource checks and a working editor; it was not attempted here. Unattended authoring requires a usable approved capture/input route plus fresh resource/input/asset checks. Stop before cooking, retail installation or game execution under this Phase A delegation.

Do not import guessed serialized Blueprint graphs, rewrite .uasset binaries, spawn a custom Windows helper, repeat the failed capture unchanged, or rerun completed source exports to bypass this blocker. No new phase-A mod directory, controller substitution, widget or input configuration was created by this preflight.
