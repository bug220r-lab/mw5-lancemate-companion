# One-asset observer follow-up: Instant Action mode

Prepared **2026-09-23 UTC**. **PROPOSED source/default export; native execution NOT_PERFORMED.** The [completed three-query lookup](../research/OBSERVER_REFERENCE_NATIVE_RESULT.md) returned `/Game/Modes/InstantAction/InstantActionMode` as the only non-self referencer of the known Instant Action controller. Prior collected source does not contain this mode. The reference helper and earlier controller exporters are complete and must not be rerun.

The [independent helper review](../research/OBSERVER_MODE_HELPER_REVIEW.md) passed **67/67 synthetic cases, MOCK_ONLY**, under Python 3.7.7. Current helper: **14,884 bytes / SHA256 `AD0EEB1E1FA73E55CEE24F679C27CA3C5AA52C0ABFFC48F4F8D0E88B0F44ED29`**. The [preparation manifest](../research/OBSERVER_MODE_PREPARATION.json) binds this source, exact target and review. Native export remains unrun; fresh resource/pin checks and a coordinated user-assisted invocation are the next step.

## Exact missing question

Does this mode's actual class default or connected graph select `InstantActionPlayerController`, and does its own connected initialization invoke the controller-component factory? What is the exact parent identity if responsibility lies elsewhere? A mode package name or package reference alone answers none of these questions.

The [observed file pin](../research/OBSERVER_MODE_ASSET.json) identifies:

- Installed path: `C:\Program Files\Epic Games\MechWarrior5Editor\MW5Mercs\Content\Modes\InstantAction\InstantActionMode.uasset`
- Package: `/Game/Modes/InstantAction/InstantActionMode`
- Size: **229,443 bytes**; SHA256 **`1C841BF1C5198B57499F2F872CBABCF3F1F38508054AB8695FCD2F6C41E4F17B`**.

## Smallest prepared action

The new [Inspect-ObserverMode.py](../scripts/Inspect-ObserverMode.py) reuses the established single-asset export approach without changing either completed helper. It requests only the named mode's source and class-default text, then extracts parent metadata from that source text. It does not load/export the parent, follow dependencies, scan the registry, collect an API snapshot or inspect the other 28 missing candidates.

The object path `.InstantActionMode`, generated class suffix `_C`, default-object naming and Blueprint type are **expected identities to validate**, using the previously established exporter convention; they are not claimed as observations from this metadata-only result. The helper checks returned asset type/path, generated-class path and default-object identity and stops on mismatch. It does not follow redirectors or guess another target after failure.

Once independent fake review passes and the coordinator refreshes pins/resources, the existing authorized user-assisted action is **File > Execute Python Script** with:

`C:\Users\jlewi\OneDrive\Documents\ChatGPT\MW5 LANCEMATE COMPANION\scripts\Inspect-ObserverMode.py`

This is preparation, not an instruction that execution has occurred. The user controls the editor; this task launches no application or native helper. Keep model/voice work paused while editor resources are needed. Do not save an incidental edit or accept an unexpected prompt to make the source lookup work; stop and preserve the result.

## Bounds, output and cleanup

The helper pins exactly one existing installed source file and the project directory. It rejects concurrent caller/reference/collector work and stale/foreign locks. Its own temporary `.observer-mode-inspection.lock` is removed only when the bounded binary contents match the owned token; replaced or malformed locks remain for review.

New evidence goes only to a direct-child `research/evidence/editor-source/observer-mode-<UTC>-<12hex>` directory. Match the exact timestamp/token pattern; exclude `observer-mode-helper-review-*` and all nested mock folders. Expected successful output is source/default text, stage checkpoints and a final `report.json`. Existing evidence is not overwritten. The exporter is automated with prompts and replacement disabled. The helper has no explicit save, compile, Play, cook, install or retail control call.

Unchanged export bounds from the proven single-asset approach are **1 MiB input source**, **8 MiB per text export**, a **17 MiB accumulated-output stop budget**, **64 KiB per JSON receipt** and **120 cooperative seconds**. Resource checks stop below **2 GiB disk**, **768 MiB available RAM** or **1 GiB available commit**; a resource-stop message preserves exact measurements and failed fields. A `STOP` file in the new output directory is honored at the next check. Native load/export calls can load dependencies or regenerate editor data and are synchronous: the checks cannot preempt a call, cap its earlier allocation/output or guarantee responsiveness. An oversized native export is retained without reading it further, and a small final receipt can still be written after that stop.

This lookup deliberately writes only new project evidence. Normal editor cache/log activity remains separate. Matching installed-file hashes do not exclude unsaved in-memory changes. No asset rollback is proposed because no asset mutation is requested; stop rather than save unexpected changes, preserve failed evidence, and leave owned temporary locks to the helper's exact-token cleanup. No automatic configuration/cache deletion or restoration occurs.

## Review and stop boundary

Require an attributable new native output directory and editor completion evidence. Check script/source identities, exporter returns/errors, source/default hashes, source stability, resource/elapsed limits and class/default identities. A mock receipt or a filename is not native success.

Read only the mode's exported controller selection/default and connected construction/initialization/factory paths. Record whether `PlayerControllerClass` actually selects the expected class, whether any factory call has connected execution, and the concrete parent identity. Absence is bounded to this source; native/dynamic/inherited behavior may remain unknown. **Stop before any parent export or additional asset lookup.** No observer Blueprint, registration instance, descriptor, mod deployment, gameplay or campaign persistence is part of this step.
