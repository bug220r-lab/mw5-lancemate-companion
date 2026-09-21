# Form On Me export review

**OBSERVED source evidence, reviewed 2026-09-20 local time.** This review reads exported editor text and the earlier screenshot. It does not execute a Blueprint or establish runtime order acceptance, movement, authority, compatibility, or shipping exposure.

## Evidence identity and coverage

- [Native probe receipt](evidence/editor-source/graph-export-probe-20260921T021934Z-f46eba67/report.json): started `20260921T021934Z` (2026-09-20 22:19:34 -04:00); reports native export `true`, no exporter errors, and `gameplay: NOT_PERFORMED`.
- [Form On Me text](evidence/editor-source/graph-export-probe-20260921T021934Z-f46eba67/Dpad_FormOnMeLogic.COPY): 117,454 bytes; independently recomputed SHA256 `6D0024D940A51BA0965AD13B58F0B46D19BD7A279E14C113927E67DEE690C7A2`, matching the receipt. Asset `/Game/UI/Mech/DPad/DpadActionLogic/LanceCommands/Dpad_FormOnMeLogic.Dpad_FormOnMeLogic`.
- [Earlier Activate screenshot](evidence/editor-source/form-on-me-activate-2026-09-20.png): visibly shows the same execution sequence, payload wiring, class-default `FollowOrder`, and `ReturnHome` action response. Screenshot and export are different observation times; no claim is made that every asset property was compared.
- Applicable installed editor: recorded package `1.1.390.0e`, UE4.26.2 / compatible CL14830424. This export is editor-source evidence, not a result from Steam shipping build 24241637.

The export contains usable node identities, typed pins, defaults and `LinkedTo` edges. The receipt's **42 node declarations / 42 NodeGuid fields are not 42 unique action nodes**: the file contains **27 distinct NodeGuid values**. `Activate` has 15 listed nodes (`Nodes(0)` through `Nodes(14)`, lines 569–583). Its nodes also appear under auxiliary `EdGraph_0`, alongside 12 additional validation/tunnel identities; that graph has 23 `Nodes` entries (379–401) despite 27 declared node objects. Both graph objects carry GraphGuid `21F16E8947682F97DC1917AB74EF6542` (402, 584). Their shapes are consistent with macro/validated-get expansion; do not count those copies as separate user actions or infer complete compiler semantics from this text alone.

The source graph is specifically identified by `FunctionGraphs(0)=EdGraph'"Activate"'` (594). `EventGraph` has no node list in its exported body (586–590); this does not establish the absence of inherited behavior. The generated-class reference (602) does not include its class-default-object values here. This review makes no completeness claim for other assets, inherited graphs, native bodies or the dispatcher.

## Exact Activate execution and guards

All node names below are scoped to `Activate`, whose body begins at line 410. The screenshot agrees with this order.

| Step | Observed node and edge | Export location |
|---|---|---|
| Entry | `K2Node_FunctionEntry_0` (`4DDC2EE34780B98E2EE7C8A538277343`) `then` pin `92474BD045BD297E1CBB43BACCCF7CA7` links to `K2Node_CallFunction_0.execute` pin `CDBD6AD44122822C6DB5F5BCD08BB696`. | 560–566, 417 |
| Recipient debug call | `K2Node_CallFunction_0` calls `/Script/LowEntryJson.LowEntryJsonDebugLibrary.PrintIntegerArray`; then pin `278E6E77462171BAFD3B3BBF2E27E6BE` links to `K2Node_VariableSet_3.execute` `8DCE3CB4493EEBAF409F9B8F1E66DB3E`. | 412, 418, 469 |
| Capture controller | Pure `K2Node_CallFunction_2` calls `/Script/MechWarrior.MWBlueprintUtils.GetLocalController`; return `EA0689914CD179E5275E6FA0EFADBC1E` feeds local `L LocalController` at `K2Node_VariableSet_3` input `E40F722A48BEAAED6E7132A83ECF3FD5`. | 464–472, 493–501 |
| Controller guard | Set `then` links to `K2Node_MacroInstance_0.exec`; set `Output_Get` links to that macro's `InputObject`. Macro reference is `/Engine/EditorBlueprintResources/StandardMacros.StandardMacros:IsValid`. `Is Valid` feeds the validated OrderClass getter; `Is Not Valid` has no outgoing link. | 454–462, 470–472 |
| Order-class guard | `K2Node_VariableGet_4` is an impure/validated `OrderClass` getter (`bIsPureGet=False`). Its valid `then` pin `C0E2B07F4B74EE5635ECAFAA1921861F` links to posting execute pin `A8460DB74B803B343BA1209DC3E8F319`. Its `else` is unconnected. | 428–438, 487 |
| Post | `K2Node_CallFunction_3` (`DB4E05D54F17768B164CA88188C2C7FD`) calls `/Script/MechWarrior.MWPlayerController.PostSquadOrderClass`; target, class and payload are listed below. | 482–491 |
| UI/action completion | Posting `then` pin `9C858FDD454970966E2ED586C2A1322E` directly links to `K2Node_CallDelegate_1.execute` pin `C0A33611476B263AF7664BA36EA590D7`. Delegate reference is inherited `Dpad_ActionLogic.OnComplete`. | 488, 548–558 |

The auxiliary `EdGraph_0` supplies additional source corroboration: controller `IsValid` and its bool branch (124–178), plus `OrderClass -> KismetSystemLibrary.IsValidClass -> branch -> PostSquadOrderClass` (97–121). This supports the guard interpretation without inventing a native validation API.

The two visible guards validate an object and a class. **They do not establish current AI ownership, a valid recipient mapping, human possession exclusion, pause/loading exclusion or server authority.** No separate `OwnerMech` validity check or recipient-array validation appears in the 15-node Activate path. The unconnected invalid branches do not invoke `OnComplete` through this path; no failure acknowledgement is shown.

## Posting arguments and exact payload

| Input | Observed source / default | Export location |
|---|---|---|
| Posting target `self` | Local `L LocalController`, typed `/Script/MechWarrior.MWPlayerController`; getter `K2Node_VariableGet_5` output `7E3B7BDD401D4C84E55AAB99EE7D01DD` links to post target `B93E5E8B471796ABB30824A1AD6884CC`. | 447–452, 489 |
| `Class` | Inherited `OrderClass`, typed class-of-`MWSquadCommandOrder`; getter `K2Node_VariableGet_1` output `F533301C4D008C156BCE8EADD0607F25` links to post `Class` pin `E90383704F3579C20E2B59AD64896523`. | 474–490 |
| `SquadCommandOrderInfo` | `K2Node_MakeStruct_0` (`0D87968540D2A0C9D840F48CE3D5ADED`) builds `/Script/MechWarrior.MWSquadCommandOrderInfo`; output `D9459B5A4F15C11FC8232088D6FBA0BF` links to post payload input `FD5804234F2EB41E1DB6A284A5B2423D`. | 491, 511–523 |
| `Instigator` | Same captured local controller, via `K2Node_VariableGet_6`; struct pin is typed `/Script/Engine.Controller`. | 440–445, 524 |
| `OrderRecipients` | Inherited `OrderRecipients`, **array of integers**; `K2Node_VariableGet_2` output `2D7354BF43F30F380E40E9BC816E8209` links to struct input `04643BC847909DDA7D398E82799C87F0` and the debug print. | 503–509, 525 |
| `Priority` | Unlinked enum input `/Script/MechWarrior.EMWJobPriority`, literal `Medium`. | 526 |
| `bPersistent` | Unlinked bool input, literal `False`. | 527 |
| `OrderContext` | `K2Node_CallFunction_1` (`27BC9CD64B37637C6C826287B6C7DB49`) calls `/Script/MechWarrior.MWMech.GetSquadCommandOrderContext` on inherited `OwnerMech`. Its return `4B7D00E94F0B0A9657A060BDA6FD3D80` links to struct input `4288C1C34B97FB59DB8FD2B414A9DEA6`. | 528, 530–546 |

`OrderContext` also serializes a default with `IssuerPawn=None`, `TargetActor=None`, and extremely large target-location components (528). **The input is connected**: those serialized fallback literals are not observed runtime context and must not be used as actual target/position values. What `GetSquadCommandOrderContext` returns and how FollowOrder consumes it remain unresolved here. OwnerMech's assignment is inherited and is not shown in this function.

The screenshot, not this text's generated-class reference, establishes the displayed `Order Class = FollowOrder` and default `Order Recipients = 0 array elements`. The [earlier serialized-name audit](EDITOR_ORDER_SOURCE_AUDIT.md) separately records the package reference `/Game/Modes/MissionDirectorSystem/MissionComponents/SquadOrders/FollowOrder` at byte offset 446 in the installed asset. These are corroborating sources with different limits: an empty class-default array does not describe the runtime recipient selection or its downstream meaning.

## Completion semantics and useful extras

`PostSquadOrderClass` has exec input/output, target, class and info pins; **no acceptance/result output** appears in its complete exported node body (482–492). `OnComplete` follows the ordinary exec edge immediately, with unconnected response input `NewEnumerator0` of `/Game/UI/Mech/DPad/Dpad_ActionResponse.Dpad_ActionResponse` (557); the screenshot renders that enum choice as **ReturnHome**. `Layout` is an unconnected `/Game/UI/Mech/DPad/Dpad_Layout.Dpad_Layout` struct input (558). This is evidence of an action/UI completion notification, not independently observed native acceptance or completed movement. Its listeners and the native posting implementation are outside this review.

The initial debug call receives the same recipient array and is configured with label `ORDER RECIPIENTS`, five-second duration, screen output `true`, log output `true` (421–425). This is a potential future supervised diagnostic lead; the export does not prove that debug output survives shipping or appears in any current log. No function was invoked to test it.

Parent class is `/Game/UI/Mech/DPad/DpadActionLogic/LanceCommands/Dpad_BaseLanceOrder.Dpad_BaseLanceOrder_C` (591); Activate overrides `/Game/UI/Mech/DPad/DpadActionLogic/Dpad_ActionLogic.Dpad_ActionLogic_C.Activate` (562). Exact connected evidence now supports this source-level path:

`Activate -> debug recipients -> capture/validate local controller -> validate OrderClass -> PostSquadOrderClass(controller, OrderClass, info{controller, int[] recipients, Medium, nonpersistent, OwnerMech context}) -> OnComplete(ReturnHome)`.

**Remaining UNKNOWN in this artifact:** who populates recipients and OwnerMech; one-integer-to-current-AI binding; authority and possession/lifecycle behavior; native acceptance/rejection and execution; FollowOrder's real follow target/job assignment; manual supersession; transport and shipping behavior. All live tests remain **NOT_PERFORMED**.
