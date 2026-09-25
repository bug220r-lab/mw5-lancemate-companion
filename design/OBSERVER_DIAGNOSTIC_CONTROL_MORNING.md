# Morning continuation — September 25, 2026

**Start here:** keep the existing `LanceObserverProbe` unchanged. The next useful editor task is a small, separate control that displays one static message when deliberately triggered after the mission HUD appears. First prove that message; component enumeration comes later.

**Status: PLAN_READY / MANUAL_AUTHORING_REQUIRED.** The control has not been authored, compiled, packaged, installed or run. Reliable unattended Blueprint authoring is not available in this session. No new game test is running. The [overnight handoff](../research/OBSERVER_OVERNIGHT_HANDOFF_2026-09-25.md) records completed work and the preserved build.

## What we know

- **OBSERVED:** the original package built successfully, and all three installed files still match it. All eight pinned editor inputs also match the saved baseline.
- **OBSERVED:** the cooked registry contains the component, widget and registration asset; the registration record has the class name searched by the stock factory. This is stored metadata, not a live registry query or successful object load.
- **OBSERVED:** the first retail mission displayed no observer overlay; the user saw none earlier either. The result remains `INCONCLUSIVE_READOUT_NOT_VISIBLE`.
- **UNKNOWN:** whether a probe instance existed, whether its BeginPlay ran, or which owner/cast/widget/display stage was reached. The source audit found no concrete wiring repair to make.

Do not repeat the same mission, rewire Auto Activate/parent BeginPlay, call the component factory manually, or recook the unchanged probe as a substitute for new evidence.

## Phase A — the smallest control to author

These new names are project proposals. The stock controller path is supported by collected editor source, but its selection in retail still needs observation. This control changes the tested configuration by substituting a controller and adding one input action; it does not establish the original observer's automatic startup.

1. Open the editor in a working manual session. Create a **separate temporary mod**, proposed `LanceObserverDiagnosticControl`. Confirm it is the active mod before saving any new work.
2. Use the editor's **Save To Mod** operation for `/Game/Modes/InstantAction/InstantActionPlayerController`. Preserve every existing graph, function, construction path and parent call. Work only on the substitution copy; leave the stock source, mode defaults, controller base and original observer untouched.
3. Create a separate UserWidget, proposed `WBP_ObserverDiagnosticControl`. Give it a Canvas Panel and a readable TextBlock with default text **`CONTROL A — OUTPUT ONLY`**, position 20/20, width 900, height 260 and wrapping enabled. Set the widget nonfocusable and **Not Hit-Testable (Self & All Children)**. No bindings, Tick, cursor, focus or input-mode changes are needed. Phase A needs no text setter function.
4. In the new mod's generated input configuration, add one proposed action `ObserverDiagnosticSnapshot`. Choose its key/chord after checking the actual native and active-mod bindings. The two-byte user `Input.ini` is not evidence of a free key. Record the chosen chord and input-consumption setting; do not edit the user's `Input.ini` or reuse a native action name. Inspect the actual generated template for its action-mapping syntax; the official guide is linked in the [diagnostic research](../research/OBSERVER_SHIPPING_DIAGNOSTIC_OPTIONS_2026-09-25.md).
5. On that action's **Pressed** event in the substituted controller, build this single execution chain:

   `Pressed → Do Once → Create Widget (new control class, Owning Player = Self) → Set ControlReadout → Is Valid → Add to Viewport (Target = ControlReadout, ZOrder = 1000)`

   `ControlReadout` is a new reference to this widget type. Connect its data output to both the validity check and display target. Leave invalid creation as a stopped attempt. `Add to Viewport` has no Boolean success output: the visible marker is the evidence. The path must not depend on the probe, its registration, its widget or a component lookup. Do Once prevents duplicate control widgets; no BeginPlay override is needed for display.
6. Add cleanup for this owned widget on EndPlay: valid reference → Remove from Parent → clear ControlReadout; invalid reference → clear ControlReadout. Preserve any existing/inherited EndPlay behavior and required parent call. Do not remove all widgets or destroy components.
7. Compile and save the two changed assets. Review the whole small control in one batch, including its input configuration and cleanup. If a named node/type is unavailable or compilation fails, stop and capture that specific blocker. Do not improvise additional startup hooks.

## Review before any deployment

The coordinator must inspect the actual authored result and make the proposed test concrete before seeking any final deployment authorization required by the project rules. The user's bedtime request covers preparation; do not silently treat this new stock override/input addition as the already tested observer package.

The review manifest must contain:

| Item | Required evidence |
|---|---|
| Two assets and generated configuration | Actual paths, hashes, compile results and exported graph/default review |
| Controller substitution | Exact original target and package substitution mapping; no other stock overrides |
| Input | Actual unique action, checked key/chord, consumption setting and mod-local config path |
| Display | Independent static widget, valid target, no observer dependency, one widget per controller |
| Cleanup | Only the control's stored widget is removed; inherited behavior preserved |
| Package | Separate output directory, native cook result, complete PAK listing, descriptor and config hashes |
| Test state | Refreshed game/editor builds, applicable DLC and active mods; named disposable stock Instant Action setup; process-closed installation check |
| Restore state | Exact pre-change mod configuration and manifest of only this control's files; preserved original probe hashes |

Do not package over `artifacts/LanceObserverProbe/package-20260925-01`, overwrite its retail folder, or publish anything. The post-test config backup in the [checkpoint](../research/OBSERVER_OVERNIGHT_CHECKPOINT_2026-09-25.json) already has the probe enabled; it is **not** an original mod-off baseline. Refresh the restore point immediately before a future authorized test.

## One bounded Phase A test

After the authored package review and applicable authorization, record a mod-off baseline in a named disposable Instant Action scenario, then repeat that setup with the original probe plus the new control. Use no campaign save. Record the exact enabled-mod state and restart after applying changes.

When the ordinary mission HUD is visible, the game is unpaused and controls work, press the reviewed chord **once**. Allow ten seconds and capture the result.

- **Marker appears:** record `CONTROL_OUTPUT_OBSERVED` for this control configuration. It proves only that this input/widget route worked. Exit normally and review before Phase B.
- **No marker:** record `CONTROL_OUTPUT_NOT_ESTABLISHED` and stop. The original observer remains inconclusive. Do not keep trying different delays, ZOrders, factory calls or frameworks during this attempt.
- **Input interference, crash, duplicate widget or unexpected behavior:** stop and preserve the result. Restore the prior configuration while the game is closed.

After the comparison, disable/remove only the manifest-listed temporary control and its own packaged configuration. Restore the pre-change enabled-mod state only after checking for intervening user changes. Recheck original probe hashes. Do not restore unrelated settings or touch saves.

## Phase B — only after Phase A is visible

Use a separately reviewed revision of the proven control to take one saved snapshot of **existing** stock player-controller components on Self and display controller/class/level/locality plus every component's object/class path. The exact bounded design and interpretation are in [Shipping diagnostic options](../research/OBSERVER_SHIPPING_DIAGNOSTIC_OPTIONS_2026-09-25.md). Do not create a probe or invoke its factory.

Phase B must redesign the small static display as needed: a 900-by-260 TextBlock cannot be assumed to fit 32 path entries or 16 KiB. Put controller identity, exact probe-class match count and completeness/truncation status in a visible header; verify full fit or capture every page. Locality alone does not establish that Self is the stock helper's GetLocalController target. Keep the owner claim limited to the captured Self unless that identity is directly verified. Also record whether the original probe overlay appears in this same control-plus-probe run.

Finding the exact probe class would establish an instance at that moment under the control configuration. An absent match would still require owner/class-resolution and complete-output checks before a stronger absence conclusion. Neither outcome, by itself, establishes the original automatic startup route, recording, lifecycle or AI behavior.
