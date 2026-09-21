# Native Blueprint export review

**OBSERVED: useful graph text exported and reviewed for two existing editor assets.** Both exports completed at2026-09-20 22:19:34 -04:00 using the corrected inspection script. This resolves the screenshot bottleneck for these two Blueprints. It is editor-source evidence; native gameplay dispatch, accepted orders and shipping behavior remain **NOT_PERFORMED**.

## Receipt and source identity

[Actual receipt](evidence/editor-source/graph-export-probe-20260921T021934Z-f46eba67/report.json) records two native export returns of true, no exporter errors, and0.266seconds elapsed for this one run. Both files contain readable source graph names, nodes, typed pins, defaults and LinkedTo references. Marker counts alone were not treated as success: the Form On Me connections were cross-checked against the supplied screenshot, and the dispatcher source was traced independently.

| Export | Bytes | SHA256 |
|---|---:|---|
| [Dpad_FormOnMeLogic.COPY](evidence/editor-source/graph-export-probe-20260921T021934Z-f46eba67/Dpad_FormOnMeLogic.COPY) |117454|`6D0024D940A51BA0965AD13B58F0B46D19BD7A279E14C113927E67DEE690C7A2`|
| [Dpad_LanceOrderDispatcher.COPY](evidence/editor-source/graph-export-probe-20260921T021934Z-f46eba67/Dpad_LanceOrderDispatcher.COPY) |1139615|`42E9A62EF6549A4D5E7AD439D001DED0A1C2A68B1EF755FFC14685EDFD6D0EB2`|

Editor package:1.1.390.0e / UE4.26.2. Script SHA256:`436B377810FEFA327372155C3382C33C656F681FD85EDC7DB10F2EED5FCE9223`. Installed asset hashes were rechecked after export and still match their prior observations: FormOnMe`F62EFBE25BE7426ABFC03817219E12392D852CC13DA78C2E8815BF6C3EDB25F2`; dispatcher`DB261C72B7B66C88A9C35AE9234E9A93C9346C3F074DBD7710722C2AD28870CE`.

The earlier uppercase-format rejection is preserved in the [first receipt](evidence/editor-source/graph-export-probe-20260921T021720Z-1ba69e17/report.json). The corrected helper's16offline checks remain MOCK_ONLY; they are separate from this actual editor-export result.

## Verified source conclusions

The [Form On Me review](_form_on_me_export_review.md) records precise node GUIDs, pin IDs and line locations. The source Activate graph has15nodes, not the receipt's42raw node records. Auxiliary expanded graphs duplicate identities; the whole file contains27distinct node GUIDs. Source FunctionGraphs and graph-local node names must be used when following connections.

1. Form On Me captures and validates the local player controller, validates OrderClass, posts an order-info struct, then calls OnComplete. The struct uses the controller as instigator, the existing integer recipient array, Medium priority, bPersistent=false, and the connected OwnerMech-derived context. The previous screenshot, rather than an exported class-default-object value, establishes the displayed FollowOrder default.
2. PostSquadOrderClass has no acceptance-result pin in the exported node. Its execution output goes directly to OnComplete; the screenshot renders that response as ReturnHome. This is action/UI completion. No native acceptance or behavior readback has been acquired.
3. Dispatcher creation passes its OrderRecipients array into the new action before the visible Initialize call. Member binding clears that array, filters display objects using PlayerState equality against the local controller, and adds each selected display object's SquadMemberId. The UI's LanceIndex is used to retrieve a display object, not sent directly as the recipient ID.
4. The indexed condition is now readable: LanceIndex>=0 selects the indexed path; its next comparison is Length(L OtherSquadMates)>=LanceIndex. Equality is therefore permitted by that numeric condition. Retrieval is followed by display-object validation. This is a source-level observation, not a tested out-of-range behavior or a claim of a shipping-game defect.
5. Invalid display objects set L Waiting for Replication; binding returns the negation as Success. The caller's failed result schedules a0.2second delay and retry. Initialize also has a separate unconditional UpdateState sequence branch. A group binding can contain already-added IDs while waiting for another display object.
6. The dispatcher source `IsActionDisabled` returns only OrderRecipients.Length<=0 (source graph lines5171–5210). It does not independently reject a nonempty partial array or inspect the binding Success flag. Its Activate graph constructs the menu layout without a Success condition. Outer UI/inherited gating is not yet inspected, so this does not prove a user can issue an order during retry. A proposed companion adapter must check its own fresh, complete, actor-specific binding rather than use this UI predicate as sufficient authorization.

The [dispatcher review](_dispatcher_export_review.md) preserves the exact binding/caller edges and remaining limits. Additional root inspection confirmed IsActionDisabled's integer comparison and Activate's menu-construction role. CreateCommandForSlot selects between DLC/no-DLC command arrays through IsOwnedDLC with the literal DLC.DLC1 tag (lines4214–4233); this is a branch definition, not entitlement evidence or proof of the active branch.

## What this does not establish

The exported Blueprint source is useful for these functions, but it does not include every referenced/inherited asset, native implementation, or class-default-object value. It does not prove live array contents, display-ID lifetime, current AI controller/pawn resolution, human possession exclusion, safe host/mission authority, native order acceptance, manual supersession or shipping transport. No companion runtime was implemented or installed.

The next bounded inspection should use this validated export approach on specifically named source dependencies: FollowOrder, SquadOrderBase and Ally_FollowJob for receiver/job/follow-target behavior; Dpad_ActionLogic and Dpad_FunctionLib for inherited initialization/OwnerMech and outer invocation assumptions. Prefer a small batch of already-loaded assets and report missing assets explicitly. Do not repeat the completed two-asset probe unchanged or request more screenshots of its graphs. Any new asset loading/export scope must remain inspection-only, with no save, compile, Play, cook, mod installation or game dispatch.
