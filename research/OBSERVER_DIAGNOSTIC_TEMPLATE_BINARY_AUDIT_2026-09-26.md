# Diagnostic controller generated-template binary audit

Reviewed 2026-09-26 00:16 UTC. **OBSERVED IN SAVED PACKAGE BYTES / RELOAD IMPACT UNKNOWN.** Two independent read-only parses of the three pinned `.uasset` files agreed: the three generated component-template exports named in the initial `ReloadPackage` warnings are absent from the first mod copy and present exactly once each in the final saved diagnostic controller. Their final serialized class, outer, flags and normalized 12-byte bodies match the historical stock package. This narrows the warning to the earlier copy state; it does not establish a healthy editor reload, live reference binding, cook or retail behavior.

## Inputs and warning provenance

| Input | Bytes | SHA-256 |
|---|---:|---|
| [Pinned stock controller](../artifacts/diagnostic-control-authoring-20260925/baseline/InstantActionPlayerController.uasset) | 53,635 | `7107745a8de461275a7acfa1f3ffc5be9bcb7002682c37b7705af5f00783e4f6` |
| [Initial Save To Mod copy](../artifacts/diagnostic-control-authoring-20260925/baseline/diagnostic-copy-before-authoring.uasset) | 50,172 | `c9bdddac76f53b163752e778e8dfeaf354201d636ea4d627368229dadcef376f` |
| [Frozen final diagnostic controller](evidence/editor-authored/LanceObserverDiagnosticControl-20260925T222809Z-548b77b2-source-checkpoint/content/ModOverride/Modes/InstantAction/InstantActionPlayerController.uasset) | 92,019 | `ba725129011767a82935bd36a811ce2583bfebbfbbd8c4b2cff3fcbc1ca14948` |

The [captured Save To Mod log span](evidence/editor-source/diagnostic-controller-copy-20260925T191216Z-5356000a/save-to-mod-log-span.txt) is 7,018 bytes, SHA-256 `9e200da5db89ed35642f31e8ef7289ab04b109a037e56d26fcb16efe57a039bd`. At 18:47:48 UTC, its lines 43–45 warn that `ReloadPackage` could not find replacement objects for `PlayerControllerSwitchMech_GEN_VARIABLE`, `PlayerControllerAirStrikeComponent_GEN_VARIABLE` and `ControllerFeedbackComponent_GEN_VARIABLE` in the new package, and that existing references would be nulled. Lines 13–16 record the separate handled `EditorValidator_Localization` ensure. The [copy review](OBSERVER_DIAGNOSTIC_CONTROLLER_COPY_REVIEW_2026-09-25.md) and [final source review](OBSERVER_DIAGNOSTIC_CONTROL_FINAL_SOURCE_REVIEW_2026-09-25.md) preserve the source-level context and their limits.

## Serialized export comparison

| Generated template | Stock export / body offset | Initial copy | Final export / body offset | Resolved component class in stock and final |
|---|---:|---|---:|---|
| `ControllerFeedbackComponent_GEN_VARIABLE` | #4 / 35,168 | Absent | #4 / 57,279 | `ControllerFeedbackComponent_C` |
| `PlayerControllerAirStrikeComponent_GEN_VARIABLE` | #32 / 53,274 | Absent | #49 / 91,658 | `PlayerControllerAirStrikeComponent_C` |
| `PlayerControllerSwitchMech_GEN_VARIABLE` | #33 / 53,286 | Absent | #50 / 91,670 | `PlayerControllerSwitchMech_C` |

For each of these three exports, both saved packages resolve the class import to the same `/Game/Objects/_common/Components/PlayerControllerComponents/...` component path and the outer to the local `InstantActionPlayerController_C`. Each has object flags `0x400021` and a 12-byte serialized body. The stock body is `ac0000000000000000000000`; the final body is `f20000000000000000000000`. The first four bytes index `None` in their respective name maps (stock 172, final 242), and the remaining eight bytes are zero. The bodies are thus identical after normalizing only this package-local name index.

Both independent passes found export counts of 39 stock, 36 initial and 56 final, using 104-byte export entries; import counts were 63, 56 and 88, using 36-byte entries. In all three files, the name, import and export maps terminate exactly at their recorded next-map offsets. Serialized export ranges cover from `TotalHeaderSize` to the four-byte footer contiguously, without an out-of-range span, gap or overlap. Each footer tag is `c1832a9e`; neither pass found an out-of-range name or object reference in the parsed maps. These structural checks make the three identified entries stronger evidence than a plain string search. They are limited to the package format and the fields checked; the local UE4.26 serialization implementation was not independently reviewed.

## Package decision boundary

**BINARY_EXPORTS_PRESENT; WARNING_IMPACT_UNKNOWN.** The saved final file contains stock-shaped serialized stubs for the three warned templates. The historical warning describes the first `ReloadPackage` operation, when those exports were absent; it is not evidence that the final file still lacks them. Conversely, their presence does not prove that the later editor process reloaded them cleanly or that preexisting references were repaired. The handled localization-validator ensure also has no established cause or impact. The [package preflight](OBSERVER_DIAGNOSTIC_CONTROL_PACKAGE_PREFLIGHT_2026-09-25.md) retains its warning review, selection, output, resource and package-membership gates. No editor, cook, retail or gameplay action was part of this audit.
