# Installed editor order-source audit

Status: **OBSERVED files, declarations and the Form On Me Activate posting graph; complete recipient-to-AI execution path UNKNOWN.** Accessed 2026-09-20; initial evidence recorded at 18:42:47 EDT, fragment evidence at 18:48:15 EDT, and user-supplied graph evidence at22:00. Applicable editor package: **1.1.390.0e** (`HoopoeEditor`). Earlier sections retain their original static-search limits; the latest graph observation below supersedes the absence of graph evidence for this one function.

## Observed member binding — 22:08 -04:00

**Superseding text evidence at22:19:** the native export subsequently succeeded for both Form On Me and the dispatcher. The [combined export review](BLUEPRINT_EXPORT_REVIEW_2026-09-20.md) and linked pin-level memos resolve screenshot comparison ambiguities, trace failed-binding retries and identify the limited array-length disable check. These are inspected editor graph edges, not runtime order acceptance. Retain the screenshot observations below as earlier evidence; do not repeat their unresolved-pixel questions as current blockers where the text review has resolved them.

Two additional user screenshots show `BindToSquadMemberDisplayObject`: [left](evidence/editor-source/bind-squad-member-left-2026-09-20.png) and [right](evidence/editor-source/bind-squad-member-right-2026-09-20.png). Their hashes and visible edges are retained in the [binding observation](evidence/editor-source/member-binding-graph-observation.json). Both are Zoom -5; tiny comparison operators are not treated as verified bounds semantics.

The function clears Order Recipients, obtains all member display info, and iterates it. A comparison between each object's Player State and the local controller's Player State sends the False branch to `L Other Squad Mates`. This supports exclusion of the local player's display entry; null-state and other human-player behavior are unverified. A Lance Index/zero condition separates indexed selection from iteration over that filtered list. The indexed path obtains and validates a display object, then adds its **Squad Member Id** to Order Recipients. The group path adds the same property from each valid filtered object. The graph therefore does not pass a raw UI index as the native recipient ID.

Invalid display objects set **L Waiting for Replication = true**, and Success returns its negation. The flag name does not prove replication completion. A failed group bind could already have accumulated some valid IDs; the caller must be inspected to establish whether failed Success prevents activation/posting. Current AI/controller binding, human possession, ID lifetime, exact bounds semantics and native execution remain UNKNOWN. The next source question is the caller's handling of this result. The proposed bulk-export probe below aims to make that inspection possible without further graph-by-graph screenshots.

## Observed dispatcher order creation — 22:04 -04:00

The [second user screenshot](evidence/editor-source/create-dpad-lance-order-2026-09-20.png) shows `Dpad_LanceOrderDispatcher > CreateDpadLanceOrder`. Its SHA256 is `2A5556141698C6098E150D4D90365C647A7DF7FCC2470EF9749BA319C637FEAB`; the current438,860-byte asset hashes to `DB261C72B7B66C88A9C35AE9234E9A93C9346C3F074DBD7710722C2AD28870CE`. [Structured observation](evidence/editor-source/dispatcher-creation-graph-observation.json). The function entry and right edge of the upper branch are clipped; do not infer unseen continuations.

Visible creation uses `Create Dpad Action Logic` with Class from `Lance Order Logic`, Outer from Self, Owner Mech from its getter, and **Defer Initialization checked**. The action output feeds `Cast To Dpad_BaseLanceOrder`, then the partly clipped SET of `L Lance Order`. The outer Sequence's Then1 reaches a validated GET of that local order and another Sequence. Its Then0 copies the dispatcher's **Order Recipients** array to **Order Recipients on L Lance Order**. Its Then1 calls Initialize with that local order wired as target, then returns the local order. Initialize's implementation is not shown.

**New verified edge:** dispatcher recipient array -> created order's recipient array, before the visible initialization call. Together with the Activate screenshot, this traces that value onward into the posted order-info struct. It does not establish the array's origin, contents, single-versus-all semantics, current-AI identity or native acceptance. The next visible function is **BindToSquadMemberDisplayObject**, immediately above CreateDpadLanceOrder in the Functions panel. Inspect whether/how it populates the dispatcher's array; do not infer that from its name.

## Observed Activate graph — 22:00 -04:00

The user supplied an editor screenshot showing `Dpad_FormOnMeLogic > Activate`, at Zoom -4. The [retained screenshot](evidence/editor-source/form-on-me-activate-2026-09-20.png) has SHA256 `E4C705DF45387BBF5E52A2636C93351F67F4DAED81CC8D47BBAEA3066FB9C713`; the [observation record](evidence/editor-source/form-on-me-graph-observation.json) separates visible edges/defaults from unknowns. Rechecked installed asset SHA256 still matches `F62EFBE25BE7426ABFC03817219E12392D852CC13DA78C2E8815BF6C3EDB25F2`. This is static editor evidence, not an execution trace or packaged-game result.

- Parent class is visibly **Dpad Base Lance Order**. Class defaults show **Action Name = Form On Me**, **Order Class = FollowOrder**, and **Order Recipients = 0 array elements**. The last value is not runtime selection and does not establish what an empty array means downstream.
- `Activate` passes through `Print Integer Array`, then sets `L LocalController` from `Get Local Controller`. The visible execution path checks controller validity and the `Order Class` validated getter before posting.
- The local controller supplies both `Post Squad Order Class` Target and the order-info Instigator. `Order Class` feeds the posting Class input. `Order Recipients` feeds `Make MWSquadCommandOrderInfo` and the debug print. The struct shows **Priority = Medium** and **Persistent unchecked**.
- `Owner Mech` feeds the Target of `Get Squad Command Order Context`; that return feeds the order-info context. The constructed struct feeds the posting node's Squad Command Order Info input.
- Execution goes directly from posting to **Call On Complete**, Target self, Response **ReturnHome**. This is action/UI completion, not accepted native execution. No acceptance readback or movement confirmation is visible.

**Resolved in part:** the Form On Me action's configured FollowOrder and its actual context/recipient/controller posting connections. **Still UNKNOWN:** recipient assignment and one-AI mapping, Owner Mech binding, follow-target semantics, authoritative guards, acceptance, manual supersession and shipping execution. The next graph is `Dpad_LanceOrderDispatcher > CreateDpadLanceOrder` (name already captured at byte offset4669): trace the action's recipient assignment backward to selected-member versus all-member construction. That graph is not yet observed. Do not treat the existing recipient getter as a setter or invent a UI-slot-to-controller mapping.

## Initial file and fragment investigation

The installed package contains concrete assets named for Form On Me, follow orders, lance selection, and mech team orders. This narrows the next inspection to specific files. Filename presence does **not** establish their asset type, inheritance, graph connections, callable signatures, or current gameplay use. No one-AI order path has been verified by this audit.

The [evidence JSON](EDITOR_ORDER_SOURCE_EVIDENCE.json) records absolute paths, sizes and SHA-256 hashes for 20 named files, the Epic manifest identity, all 12 relevant input mapping lines, and the search scope. Its SHA-256 is `5850EEE29C0C9CC19563709370B5AB81AF7FC1EF2D31A1B0B7D75E500BFF6406`. Both the JSON and this note describe only this bounded static investigation; any separate editor reflection work needs its own result.

## Installed input mappings

OBSERVED in [DefaultInput.ini](<C:/Program Files/Epic Games/MechWarrior5Editor/MW5Mercs/Config/DefaultInput.ini:31>), under `[/Script/Engine.InputSettings]` beginning at line 31:

| Lines | Declared action | Key |
|---|---|---|
| 210 | `DispatchLance` | F1 |
| 211–213 | `DispatchLanceMate1`, `DispatchLanceMate2`, `DispatchLanceMate3` | F2, F3, F4 |
| 237 | `CancelOrders` | F5 |
| 243 | `DispatchLanceMate4` | F6 |
| 310–313, 337, 342 | Additional declarations for those same six actions | `None` |

File SHA-256: `52506733F01D33ED6A6F589BC742162D1F28CA510CD450CA5B5AE2939D799462`.

These are default action mappings, not a verified runtime input handler or active player configuration. They do not establish which actor a number selects, what the second key means, a Form On Me function, a cancellation callback, or manual-order generation tracking. `DispatchLanceMate4` is a declared action name; it does not prove an additional available AI slot.

## Exact asset locations

All paths below are relative to `C:\Program Files\Epic Games\MechWarrior5Editor\MW5Mercs\Content`. Their individual hashes and absolute paths are preserved in the evidence JSON. The final column states an inspection question, not observed behavior.

| Observed path | Question for graph/source inspection |
|---|---|
| `UI\Mech\DPad\DpadActionLogic\LanceCommands\Dpad_FormOnMeLogic.uasset` | What event/function handles this named action? |
| `UI\Mech\DPad\DpadActionLogic\LanceCommands\Dpad_LanceOrderDispatcher.uasset` | Where is its recipient input obtained, and how is it forwarded? |
| `UI\Mech\DPad\DpadActionLogic\LanceCommands\Dpad_BaseLanceOrder.uasset` | Is there a shared dispatch contract, and what is its signature? |
| `UI\Mech\DPad\DpadActionLogic\LanceCommands\Dpad_SelectAllLayout.uasset` | How does all-lance selection differ from a single recipient? |
| `UI\Mech\Components\LanceStatus\LanceStatusWidget.uasset` | Where do the keyboard actions enter this UI, if they do? |
| `UI\Mech\Components\LanceStatus\LanceMemberWidget.uasset` | Is a member identity stored or resolved here? |
| `UI\Mech\Components\LanceStatus\LanceOrderWindow.uasset` | Which order selection event is emitted? |
| `UI\Mech\Components\LanceStatus\LanceOrderWidget.uasset` | What value represents the selected order? |
| `UI\Mech\Components\LanceStatus\OrderAllWidget.uasset` | Does this use a separate recipient collection? |
| `Modes\MissionDirectorSystem\MissionComponents\SquadCommandComponent.uasset` | Is this reached from player input or used by mission scripting, and with what ownership? |
| `Modes\MissionDirectorSystem\MissionComponents\SquadOrders\SquadOrderBase.uasset` | What order contract and result, if any, exist? |
| `Modes\MissionDirectorSystem\MissionComponents\SquadOrders\FollowOrder.uasset` | Does Form On Me actually reach this asset, and which actor is followed? |
| `AI\Mech\MechAIController.uasset` | What receiver and authority checks, if any, are exposed? |
| `AI\Mech\Behaviors\BT_MechTeamOrders.uasset` | How is order state consumed, if this asset is involved? |
| `AI\Mech\Behaviors\Follow\BT_MechFollow.uasset` | What constitutes active following, and can it be read back? |
| `AI\Mech\Behaviors\Follow\BT_MechFightWhileFollowing.uasset` | How does following coexist with native combat, if connected? |
| `Objects\_common\MW5PlayerController.uasset` | Where is player input or selected recipient ownership implemented? |
| `Objects\_common\MW5PlayerControllerDerived.uasset` | Does this participate in the relevant controller chain? |
| `Modes\InstantAction\InstantActionPlayerController.uasset` | What differs in the isolated proof scenario? |

Key file pins:

- `Dpad_FormOnMeLogic.uasset`: `F62EFBE25BE7426ABFC03817219E12392D852CC13DA78C2E8815BF6C3EDB25F2`.
- `SquadCommandComponent.uasset`: `8CE40EA42BEA475B0A2291CB3CC0399E9302F716F8868D7EC8B4ACCA57E0E54B`.
- `FollowOrder.uasset`: `682F83F7D2EA606C56BE6935A4397774622602DAFB848C0FCDFD9DE083A6D932`.

Binary asset line numbers are not applicable. The initial path/text pass did not parse, export, interpret or disassemble their contents; the supplement below reviews separately captured printable fragments. Hashing establishes file identity only. No arrow between entries in this table is yet supported by an inspected graph edge.

## Supplemental serialized-name leads

OBSERVED in the separately captured [serialized-name evidence](EDITOR_SERIALIZED_NAME_EVIDENCE.json), timestamp `2026-09-20T18:48:15.9582231-04:00`, package **1.1.390.0e**. JSON SHA-256: `50410F4D8619E46A8E137349E7A6E5D120F3BAB8468A1C6EE66EC8775269930F`. It records eight named assets, their hashes, and byte offsets of matching printable ASCII runs. Seven are order-related assets already pinned above; the eighth, `UnitPilotComponent.uasset`, is a separate pilot-state lead and does not establish order authority.

The entries below are exact **search names**, with decimal byte offsets in the named asset. They are not reconstructed function definitions, typed pins, graph connections, or execution traces. The full package-path fragments are preserved in the JSON.

| Asset filename, using the exact path above | Selected fragment and byte offset | Next question to resolve |
|---|---|---|
| `Dpad_FormOnMeLogic.uasset` | `/Game/Modes/MissionDirectorSystem/MissionComponents/SquadOrders/FollowOrder` at **446**; `GetSquadCommandOrderContext` **3213**; `MWPlayerController` **4233**; `MWSquadCommandOrderInfo` **4323**; `OrderClass` **4653**, `OrderContext` **4672**, `OrderRecipients` **4693**; `PostSquadOrderClass` **4851** | Inspect those names and their actual connections. Do they construct an order for one recipient and post it through the controller? |
| `Dpad_BaseLanceOrder.uasset` | `GetSquadCommandOrderContext` **3066**; `MWPlayerController` **4076**; `MWSquadCommandOrderInfo` **4166**; `OrderContext` **4549**; `OrderRecipients` **4570**; `PostSquadOrderClass` **4728** | Determine the actual shared contract, parameter types and inherited behavior, if any. |
| `Dpad_LanceOrderDispatcher.uasset` | `/Game/UI/Mech/Components/LanceStatus/LanceStatusWidget` **446**; Form On Me package path **856**; `BindToSquadMemberDisplayObject` **2388**; `DispatchOrders` **5260**, `DispatchOrders_DLC` **5283**, `DispatchOrders_NoDLC` **5310**; `FetchSquadInfo` **6391**; `LanceIndex` **8320**; `OrderRecipients` **9644**; `SquadMemberId` **10518** | Inspect recipient binding and branch selection. DLC-named fragments alone do not identify the active branch, entitlement or supported configuration. |
| `LanceStatusWidget.uasset` | `CanOrderMechs` **5933**; `DispatchOrder` **7584**; `GetSquadCommandOrderContext` **10177**; `IssueOrderToRecipient` **11379**; `LanceMemberIndex` **13311**; `OrderRecipients` **16777**; `PostSquadOrderClass` **17436**; `SquadMemberId` **19007**; `SquadMemberLookUp` **19029**; `Input Action Dispatch Lance Mate 1` **1082079** | Inspect the keyboard recipient lookup and order dispatch. Determine whether slot, display identity and controlled actor remain distinct and freshly resolved. |
| `FollowOrder.uasset` | `/Game/AI/Jobs/Ally_FollowJob` **386**; `ExecuteOrder` **1510**; `IssueOrder` **1749**; `MWSquad` **2079**; `MWSquadCommandOrderInfo` **2123** | Inspect implementation and receiver; establish what follow target is supplied and whether any acceptance/result exists. The job path is a serialized reference lead, not a verified loaded job or file-existence check. |
| `SquadOrderBase.uasset` | `IssueOrder` **4463**; `IssuerPawn` **4482**; `MWSquad` **6027**; `MWSquadCommandOrderContext` **6071**; `OrderContext` **6406**; `OrderRecipients` **6486** | Resolve actual recipient iteration, validity checks and the context fields used. |
| `SquadCommandComponent.uasset` | FollowOrder package path **776**; `IssueOrder` **5203**; `IssuerPawn` **5222**; `MWSquad` **6852**; `MWSquadCommandOrderInfo` **6969**; `OrderRecipients` **7375** | Determine whether this component participates in the player order path or a separate mission-script path. |

These fragments make `PostSquadOrderClass`, `GetSquadCommandOrderContext`, `IssueOrderToRecipient`, `OrderRecipients`, `SquadMemberId`, `ExecuteOrder` and `IssueOrder` concrete next search terms. They may be imports, names, generated symbols, labels or unused references. Even their presence together in one file does not prove a caller/receiver relationship. In particular, the fragment `MWPlayerController` must not be silently equated with the separately named `MW5PlayerController.uasset`.

No signature, recipient element type, struct layout, return value, authority rule, manual supersession signal or shipping support is established here. Neither `PostSquadOrderClass` nor `IssueOrder` is evidence that an order was accepted or carried out. The separate commandlet probe produced no reflection output, so it adds no signature or graph evidence to this supplement; this audit did not repeat that probe.

## Search boundary and remaining evidence

OBSERVED: `MW5Mercs` has no top-level `Source` directory. `rg --files` over `Config` and `Plugins` returned 72 files matching `.h/.hpp/.cpp/.cs/.ini/.json/.uplugin`, with zero `.h/.hpp/.cpp/.cs` files. Searching those text types for `DispatchLance|CancelOrders|SquadCommand|LanceStatus|FormOnMe|Form On Me` returned the input mappings above only.

Filename enumeration of `Content` found zero `.h/.hpp/.cpp/.cs` files. It found 3,431 `.h/.hpp/.cpp/.cs/.ini/.json/.txt` paths overall, but zero in the named `UI\Mech`, `AI\Mech`, `Objects\_common`, and `Modes\MissionDirectorSystem` subtrees, and zero with the exact order leads in their basenames. Unrelated text contents were not searched. These results describe those scopes and extension filters; they do not prove that gameplay definitions are absent from every installation location or inaccessible through supported editor inspection.

The next source inspection should establish one real input-to-recipient-to-order path, recording each actual function/event, receiver, input/output type and graph edge. It must then determine single-actor selection, player-follow target, authority and possession checks, acceptance/readback, manual supersession, and whether the other AI recipients remain untouched. The D-pad filename is a useful alternate entry point; equivalence with the keyboard UI remains unproven.

Actual signatures, return semantics, identity mapping, authority, manual-order detection and call graph: **UNKNOWN**. Editor graph inspection, native dispatch, accepted-order readback and observed following behavior in this audit: **NOT_PERFORMED**. No editor or game process was launched by this audit, no gameplay function was called, and no installed asset or configuration was changed. Further supported source/reflection investigation is separate; the limited text result is not a finding that all such routes are blocked.

## 2026-09-20 follow-up — GENERATED_EDITOR_DECLARATIONS_ONLY

The editor generated [unreal.py](<C:/Users/jlewi/AppData/Local/MW5Mercs/Intermediate/PythonStub/unreal.py>) at **19:03:36 local time** for package **1.1.390.0e / UE4.26.2**. Subsequent read-only text inspection verified **21,026,350 bytes**, SHA-256 `AC4C46761BC54099302155BC0A908AE3F64B161CA77EB9AFD0CC6C1F1B826480`. This follow-up supersedes the earlier absence of typed declaration evidence for the entries below; it preserves the earlier file/fragment findings and unsuccessful commandlet history. The project-local generated-contract report was pending when this section was prepared.

These are generated editor declarations and documentation, **not C++ implementation, executed calls, connected Blueprint graphs or shipping-game results**. Placeholder bodies such as `return None`, `return False` or enum values are not observed outcomes. The file was never imported or executed by this audit. Line numbers are one-based in the pinned file.

| Lines / owner | Observed declaration and limit |
|---|---|
| 102556–102573 / `MWSquadCommandOrderInfo` | `instigator: Controller`, `order_recipients: Array(int32)`, `priority: MWJobPriority`, `persistent: bool`, `order_context: MWSquadCommandOrderContext`. No recipient-ID allocation or lifetime semantics are supplied. |
| 102621–102636 / `MWSquadCommandOrderContext`; 341110–341118 / `MWMech` | Context fields are `issuer_pawn: Pawn`, `target_actor: Actor`, `target_location: Vector`. **MWMech** owns `get_squad_command_order_context() -> MWSquadCommandOrderContext`; do not attribute this method to MWPlayerController. |
| 366183–366195 / `MWSquad` | `get_members_for_order(order_recipients: Array(int32), order_instigator: Controller) -> Array(Controller)`. Actual one-member selection and fallback/expansion behavior remain uninspected. |
| 366482–366502 / `MWSquadDisplayInfo`; 366767–366771 / `MWSquadMemberDisplayInfo` | Display lookup accepts a `Controller`; `squad_member_id: int32` is documented **Server only**. Its equality to a UI slot or `MWSquadMemberId` enum value is not established. |
| 358066–358085 / `MWPlayerController` | `post_squad_order_class(class_: type(Class), squad_command_order_info: MWSquadCommandOrderInfo) -> None` is documented **Client Safe function**. The adjacent `post_squad_order(order: MWSquadCommandOrder, squad_command_order_info) -> None` takes an order object. Neither declaration supplies an acceptance return; client-safe wording does not establish all authority/RPC guards. |
| 366278–366288 / `MWSquadCommandComponent`; 366327–366337 / `MWSquadCommandOrder` | `post_order(order: MWSquadCommandOrder, order_info: MWSquadCommandOrderInfo, player_issued: bool) -> None`; `execute_order(squad: MWSquad, order_info: MWSquadCommandOrderInfo, player_issued: bool) -> None`. Their actual execution relationship remains untraced. |

**PROPOSED readback hypothesis:** `MWAIController.worker_component` (295310–295315) supplies a declared `MWWorkerComponent`; its `get_job() -> MWJob` (381298–381306) and `get_actor() -> Actor` (381307–381315) can be investigated together. The latter documents returning the controlled pawn when attached to an AIController. `MWJob.get_command_type() -> MWCommandType` (334891–334899), `get_running_state() -> MWJobRunningState` (334855–334863), `get_posting_details() -> MWJobPosting` (334864–334872), and `get_all_workers() -> Array(MWWorkerComponent)` (334900–334908) are concrete declared readback candidates. Enum declarations include `MWCommandType.FOLLOW=2` (16427–16446) and `MWJobRunningState.INACTIVE/RUNNING/FINISHED=0/1/2` (17384–17398). A FOLLOW job must still be associated with the designated actor and intended target; its existence alone would not establish that this request caused it or that the pawn visibly followed.

**Manual-origin gap remains:** `MWJobPosting` (73764–73788) declares `player_issued: bool`, described as whether a player issued the posting, and includes instigator, priority, subscriber bounds and interruptibility. Worker `on_job_changed` (381263–381270) uses `JobChangedSig(job: MWJob, active: bool)` (24214–24229). Neither declaration establishes reliable manual-versus-companion attribution, notification timing, a command correlation ID or a monotonic manual revision. Companion requests through the player route might also be player-issued. Display `job_change` is a bool and `current_command_icon` is Texture2D (366797–366831), not substitutes for those missing contracts.

The next source inspection is now precise: connect the real UI member ID to exactly one current AI controller; inspect Form On Me/FollowOrder graph arguments and context construction; then connect dispatch to that actor's worker/job state and manual supersession. **Generated signatures are OBSERVED; those graph edges, native acceptance, human precedence, runtime exposure and packaged-game behavior remain UNKNOWN / NOT_PERFORMED.** Editor Python documentation is not a packaged-game Python bridge. No new native capability was exercised by this follow-up.

### Follow-target follow-up, 19:18 -04:00

The generated `MWJob.required_behavior_tree` property (stub334753) supplied a concrete reason to inspect one additional asset: `MW5Mercs/Content/AI/Jobs/Ally_FollowJob.uasset`,219,221bytes, SHA256`92F889B72D31642985249D58BE8E80A2D6AA7C4839CD882DD656774D51C5073C`. [Filtered byte-offset evidence](evidence/editor-source/follow-job-target-fragments.json) uses the same one-to-one Latin-1/printable-ASCII method, not a UAsset parser. Observed fragments: `BT_MechFollow` package path at589, `Blackboard_Mech` at642, `FollowActor` at4132, `FollowUnit` at4152, `GetPlayerSquadLeader` at4414, `InitializeFromSquadCommandOrderInfo` at4562 and `RequiredBehaviorTree` at6992. These do not establish assigned values, active tree, blackboard keys or graph edges.

The pinned generated reference additionally documents `MWBlueprintUtils.get_player_squad_leader(world_context_object: Object) -> Actor` at307755–307766 (owning class begins306543). `MWJob.initialize_from_squad_command_order_info(order_info: MWSquadCommandOrderInfo) -> bool` at334843–334853 says it initializes a job from a player's squad-order information. **That bool is not an accepted-order acknowledgement.** The correct follow target and failure semantics still require the actual implementation/graph. Next inspect the job's initialization and worker-start graph to determine what supplies FollowActor/FollowUnit, how it reaches the behavior tree and how the intended player leader is maintained across possession/lifecycle changes. No additional follow-target accessor, correlation ID or manual revision was found in the already-extracted MWJob/worker/posting declarations.
