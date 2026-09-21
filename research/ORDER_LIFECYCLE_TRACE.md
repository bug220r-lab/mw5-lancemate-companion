# Order lifecycle: source trace and tactical boundary

Status: **OBSERVED editor graph/default text; DOCUMENTED native declarations; runtime acceptance and behavior NOT_PERFORMED.** Reviewed 2026-09-20 local time. Applicable editor: Epic 1.1.390.0e / UE4.26.2. This does not certify Steam shipping behavior or compatibility.

The collected source now connects Form On Me to a job posting constrained by unit GUIDs, and connects the follow job to each worker's blackboard and group movement component. The native posting/recipient resolution/scheduling implementations remain missing. This is enough to specify a narrower future observation experiment, not enough to dispatch safely today.

## Evidence and reading method

All numbered files below are in [the completed AI collection](evidence/editor-source/ai-research-collection-20260921T030437Z-f7d8e930/report.json), abbreviated **RUN**. Each citation gives the exact filename and one-based text lines. Read source `FunctionGraphs` and actual event graphs, not duplicated compiled/expanded graphs. Linked execution pins and connected data pins support the claims below; filenames and unconnected nodes alone do not. Thirty-five cited source/default file hashes were independently recomputed against that receipt and matched during this review. No editor/game API was called.

The API evidence is RUN/[unreal-api-reference.txt](evidence/editor-source/ai-research-collection-20260921T030437Z-f7d8e930/unreal-api-reference.txt). It contains generated declarations with placeholder Python bodies, not the named C++ headers or implementations. The [earlier UI review](BLUEPRINT_EXPORT_REVIEW_2026-09-20.md), [Form On Me pin memo](_form_on_me_export_review.md) and [dispatcher pin memo](_dispatcher_export_review.md) retain more detailed GUID/pin identities. Their older claims about missing downstream assets are superseded by this report where explicitly resolved.

## Connected Form On Me path

| Stage | Observed connection | Exact source location in RUN |
|---|---|---|
| UI class | `Dpad_FormOnMeLogic` class default `OrderClass` is `FollowOrder_C`; display text is Form On Me. | `000-Dpad_FormOnMeLogic-defaults.COPY`, 1–4 |
| Recipient construction | Dispatcher uses selected member display objects' `SquadMemberId`, after filtering against the local controller's PlayerState. `LanceIndex` is a display-list index, not the posted identifier. It assigns its array into the created action before Initialize. | `001-Dpad_LanceOrderDispatcher-source.COPY`; exact binding/creation/caller locations and limitations in `_dispatcher_export_review.md` |
| Post | Activate validates the local controller and order class, then calls native `MWPlayerController.PostSquadOrderClass`. The payload uses that controller for Instigator, the integer recipient array, Medium priority, false `bPersistent`, and `OwnerMech.GetSquadCommandOrderContext`. | `000-Dpad_FormOnMeLogic-source.COPY`, 410–558, especially 482–546 |
| UI completion | Post's ordinary execution output directly invokes inherited `OnComplete`; no acceptance output appears on the posting node. | same file, 482–492 and 548–558 |
| Native gap | Generated `post_squad_order_class(class_, squad_command_order_info) -> None` says “Client Safe function.” The actual native transition to the order's ExecuteOrder, recipient authority and player-issued classification are not exported. | API 358066–358075; `MWSquadCommandOrder.execute_order` declaration 366308–366337 |
| Follow order | In FollowOrder's **EventGraph**, `K2Node_Event_0.ExecuteOrder.then` → `K2Node_CallFunction_0.IssueOrder.execute`. Squad, OrderInfo and bPlayerIssued are connected through unchanged; OrderJob is `Ally_FollowJob_C`. | `002-FollowOrder-source.COPY`, 18–41 |

The existing dispatcher is not sufficient as the companion's identity gate: its failed-binding retry and nonempty-array action check can be separate, and it excludes the local PlayerState rather than proving every returned controller is AI. See the earlier dispatcher memo. No host/co-op authorization policy is established by the “Client Safe” declaration.

## SquadOrderBase: how a posting is assembled

In `003-SquadOrderBase-source.COPY`, the actual IssueOrder graph begins at 175 and is registered at 1047. Its connected sequence is:

1. Validate Squad and its JobBoardComponent, then validate the OrderJob class (185–202, 265–281, 310–326). Clear RequiredPawns and Requirements; construct the requested job with the board as Outer (294–308, 384–402, 490–502). SetWorld on the new job, then call its InitializeFromSquadCommandOrderInfo with the complete incoming OrderInfo (328–337, 641–657).
2. Only initialization **true** enters the recipient loop (438–463). Initialization false goes to a selected recipient's dialogue component, if valid, and `JobCannotBeInitialized`; this is not a structured return/acceptance result to the original caller (665–740).
3. `MWSquad.GetMembersForOrder` receives the incoming integer OrderRecipients and Instigator and returns the controllers iterated by `K2Node_MacroInstance_3` (603–639, 453–463). This **native resolver's implementation is still unknown**. Its declared return is `Array(Controller)`, not `Array(MWAIController)` (API 366183–366195).
4. For each controller, the graph attempts a cast to MWAIController. Success invokes StopIssuedOrder; **both the success continuation and cast-failure continuation then add that original controller's GetPawn result to RequiredPawns** (404–436, 465–474, 504–509, 742–754). Thus this graph itself does not establish human-pawn exclusion or reject cast failure. Whether native resolution already excludes humans is unresolved; do not report this source observation as a live bug.
5. Once that loop completes, clear L_RequiredGuids, require RequiredPawns.Length > 0, and iterate those pawns through the `MWUnitInterface.GetUnitGuid` message into L_RequiredGuids (525–601, 763–803). Then construct `UnitFromListRequirement_C` with `Units=L_RequiredGuids`, add it to Requirements and call `JobBoardComponent.PostJob` (353–375, 283–292). The returned integer posting ID is **unconnected** at line 292. The IssueOrder path has no propagated posting-ID or acceptance result.

The recipient-to-worker requirement is now concrete: in `042-UnitFromListRequirement-source.COPY` 31–46, 80–120, MeetsRequirement executes `Worker.GetActor` → `GetUnitGuid` → `Units.Contains`, whose result is returned. The source also contains an owner/AI cast/GetPawn fragment at 48–78, but its execution and result are unconnected; it is not an additional active guard. The worker's native GetActor documentation says it returns the controlled pawn if attached to an AI controller (API 381307–381315).

### Priority, persistence and player origin

The `MWJobPosting` make-struct at SquadOrderBase 204–236 is wired as follows:

| Posting field | Actual source/default | Meaning limit |
|---|---|---|
| Job | Newly created and initialized job, via reroute at 346–351 | Constructed object is not yet an active worker job. |
| Instigator | OrderInfo.Instigator, via 511–516 | Does not independently prove human/manual origin. |
| Priority | OrderInfo.Priority, via 483–488 and 603–618 | Form On Me sends Medium; the make-struct's serialized Low fallback is ignored on this connected input. |
| MinSubscribers / MaxSubscribers | Unconnected literals **1 / 3** at 228–229 | Does not prove every designated worker joined; the native scheduler is missing. |
| bUninterruptible | Literal false at 230 | The native reference says higher-priority jobs may draw workers away when interruptible. Actual timing/ties remain unknown. |
| bKeepPostingOnBoardAfterJobStart | OrderInfo.bPersistent, via 476–481 and 619 | This is allowing later subscribers after start, **not campaign/save persistence**. |
| DelayBeforeJobStart | Literal 0 at 232 | Reference says nonpositive delay starts on the next frame after subscriber requirements; no runtime timing was measured. |
| bPlayerIssued | IssueOrder.PlayerIssued, via 658–663 | The incoming ExecuteOrder boolean propagates into the posting. Its value/source upstream remains native. |
| Requirements | GUID-list requirement assembled above | Native requirement application, worker eligibility and scheduling are not observed. |

DOCUMENTED meanings above come from API `MWJobPosting`, 73764–73786. Its priority documentation says higher priorities take precedence **by default**; this is not a complete arbitration algorithm. FollowJob's class default Low/Inactive values (`004-Ally_FollowJob-defaults.COPY`, 16–23) are not evidence that a runtime Form On Me posting stays Low or Inactive.

## Follow job: target, worker initialization and cleanup

The initialization function in `004-Ally_FollowJob-source.COPY` 1039–1126 calls its native parent initializer, sets command type **Follow**, then copies `OrderInfo.OrderContext.IssuerPawn` into FollowActor and returns IsValid(FollowActor). The parent's boolean return is unconnected (1061). This resolves the initial follow-target field: it is IssuerPawn, not TargetActor or TargetLocation.

**Worker initialization changes that target again.** In the same file, BeginWorker → InitWorker (278–285, 628–636). The InitWorker custom event invokes `MWBlueprintUtils.GetPlayerSquadLeader`, assigns its return to FollowActor, then validates `Worker.GetActor` and its AI controller (619–625, 830–850, 229–247, 287–305). That overwrites the initializer's IssuerPawn before these connected actions:

- Set blackboard `TravelActor=FollowActor` (249–276, 439–445).
- Set `RequiredToGetToFormation=true`, `Attack=false`, `Wait=false`, `Guard=false` (797–828, 871–948).
- Resolve the worker actor's MWGroupMovementComponent; if valid, cast FollowActor to Pawn and call FollowUnit on that component with that pawn as InLeader (307–370). Failed validation/cast branches are unconnected.

The keys above are confirmed by `004-Ally_FollowJob-defaults.COPY` 2–9. RequiredBehaviorTree is `BT_AllyMechMasterTree` (14); a separate BT property references `BT_MechFollow` (3). Those defaults and the writes support later tree-consumer analysis. They do not expose the native code that switches/starts the required tree. `GetPlayerSquadLeader` is only an Actor-returning declaration (API 307755–307766); its host/co-op/mech-switch selection rules remain unknown. Therefore **“follows any supplied issuer pawn” is not a valid current contract**.

Cleanup/end conditions are separate from successful movement:

- `K2_EndWorker` validates the worker actor and its group movement component, calls FollowUnit with an **unconnected InLeader**, then validates the actor's AI controller and clears TravelActor on its blackboard (372–493). This is an explicit empty-leader argument in source; the native null-leader semantics are not shown. Because the blackboard cleanup is downstream of valid group movement, do not claim unconditional cleanup for every unit class.
- BeginJob binds to the valid FollowActor's MWMechLivingActorComponent.OnLivingActorDeath (495–541, 564–581). That event clears FollowActor, reacquires GetPlayerSquadLeader, then either reinitializes all existing workers and binds the new actor's death event, or calls Finish(Failure) if the replacement actor is invalid (524–529, 543–563, 583–729, 852–869).
- EndJob unbinds the death delegate if the current FollowActor/component is valid (731–795).
- No connected “formation reached → Finish(Success)” path was found in this follow-job graph. Follow status should not be equated to a one-time movement completion; whether other native conditions end it remains unknown.

## Supersession, cancellation and possession

`SquadOrderBase.StopIssuedOrder` is a **per-worker removal path**. In `003-SquadOrderBase-source.COPY` 889–1024 it obtains InAIController.WorkerComponent, validates that worker and GetJob(), reads `job.GetPostingDetails().bPlayerIssued`, and only the true branch calls `job.RemoveWorker(worker)`. False/invalid branches have no outgoing action. The graph does **not** call board.RemovePosting, AbortJob, or Finish. Native MWJob documentation says removing a worker aborts the job if workers fall below MinRequiredWorkers (API 334792–334800); that possible wider consequence must be distinguished from the explicit per-worker call.

This stop path runs during a successfully initialized new order, before that recipient's pawn/GUID enters the new posting (IssueOrder 328–337, 427–474). It neither identifies the companion's own commands nor proves that a new posting will subsequently acquire the worker. A lost/rejected new posting could not safely be “retried until movement” based only on the UI completion event.

Manual and companion submissions through the same player-controller route cannot be distinguished merely by `bPlayerIssued`. Its runtime assignment upstream is unknown, and its documented meaning is player-issued versus not, not keyboard versus companion. A future implementation requires an independently observed manual input/order generation and actor binding; source-level candidates must not be presented as an implemented override detector.

The default-input audit records `CancelOrders`, but an exact text search for that name across this run's `*-source.COPY` files found no hit. Thus no connected F5 handler or “cancel all active orders” contract has been established here. That is a bounded search result, not proof the game lacks cancellation.

**Subsequent source clarification, 2026-09-21:** [the control-support review](AI_CONTROL_SUPPORT_ANALYSIS.md#new-clarification-cancel-orders-here-closes-the-menu) followed the default variable into asset008 UpdateBindings. It binds CancelOrders to CloseOrderWindow, which closes the command UI. This supersedes the narrower literal-name search result above; it still does not establish cancellation of an active native job or physical-key coverage across every input route.

Mech switching invalidates a permanent controller-to-pawn assumption. `240-PlayerControllerSwitchMech-source.COPY` contains an actual SwapControllers source graph, registered at 5016. Entry saves C2.GetPawn as LP2 and checks the target mech is not dead; it then saves C1.GetPawn as LP1 (4310–4346, 4398–4408, 4446–4469, 4478–4483, 4527–4532, 4555–4573). On the ordinary non-spectator branch, C1.Possess(LP2) executes before C2.Possess(LP1) (4410–4417, 4378–4396, 4492–4511, 4548–4553). A separate spectator path calls PossessDeadMech (4348–4356, 4368–4376, 4422–4444). This establishes mutable bindings, not a complete multiplayer authority lifecycle; the outer PossessionLogic event/RPC flow and any reliable adapter notification still need review.

## Observed tactical action inventory

These are installed class names and connected behavior, not newly invented bridge commands. They are potential later actions after one supervised Form On Me proof; none was invoked.

| UI/default label | Actual order and payload use | Source evidence and limit |
|---|---|---|
| Form On Me | `FollowOrder` → `Ally_FollowJob`. Initializes from **IssuerPawn**, then worker setup overwrites FollowActor with the current player-squad leader. | `000` defaults 2–4; `002` source 18–41; `004` source/defaults as above. Do not offer arbitrary-actor follow yet. |
| Move To | `GoToLocationOrder` → `Ally_GoToLocationJob`. Uses **OrderContext.TargetLocation**; projects it to navigation, then stores the projected TravelLocation and returns IsValidAILocation; projection failure returns false. Sets command type Move. | `245-Dpad_MoveToLogic-defaults.COPY` 2–4; `235-GoToLocationOrder-source.COPY` 18–41; `032-Ally_GoToLocationJob-source.COPY` 677–823. Projection extent is ProjectionDistanceMeters × 100 converted to vector; default is 20 (032 defaults 5). This is not a path-reachability guarantee. |
| Attack Target | `AttackOrder` → `Ally_TargetAttackJob`. Uses **TargetActor** as TargetUnit and **IssuerPawn** for attitude/self comparison. Returns true only after valid target and living component gates, with not-friendly, not-dead and target-not-issuer checks connected to the final AND. Sets Attack. | `242-Dpad_AttackTargetLogic-defaults.COPY` 2–4; `234-AttackOrder-source.COPY` 18–41; `033-Ally_TargetAttackJob-source.COPY` 878–1161. The attitude function is native. Target-death event → Finish(Success), while invalid/already-dead BeginJob paths Abort (033, 301–421). Success does not prove which unit killed the target or quantify performance. |
| Toggle Hold Fire | `ToggleHoldFireWeaponsFreeOrder` resolves recipients and examines combat interaction, then applies a shared FireMode via `K2_SetCombatTargetInteraction`. It does not use IssueOrder/job posting. | `247-Dpad_ToggleHoldFireLogic-defaults.COPY` 2–4; `237-ToggleHoldFireWeaponsFreeOrder-source.COPY` 72–228, plus continuation 230–430. Context/priority/persistence/player-issued inputs are unconnected in this event graph. It is a **toggle**, not a verified idempotent “set hold fire” API; desired state needs fresh readback. |
| Cycle ECM | `ToggleECMMode` resolves recipients, casts each to MWAIController, gets its pawn's MWECMComponent and calls CycleECMMode when valid. It does not use IssueOrder/job posting. | `248-Dpad_ToggleLanceECMLogic-defaults.COPY` 2–5; `236-ToggleECMMode-source.COPY` 36–153. No explicit desired ECM state or acknowledgement; component absence skips that recipient. |
| Hold position | No separate exposed player `HoldPositionOrder` has been established. A behavior subtree `BT_HoldPosition` moves toward set TravelLocation when its inverted IsAtLocation condition applies, then waits, with a wait fallback. | `164-BT_HoldPosition-source.COPY` 114–163: decorator radius 100, MoveTo radius 50, post-move wait 0.5. Raw values are recorded without a unit claim. This subtree's existence is not a callable player-order contract; Move To/Guard behavior requires its own tree trace. |

## Readback candidates and smallest remaining proof

The following **DOCUMENTED declarations** could support a future game-side observer; none was called here:

- `MWWorkerComponent.get_job()`, `get_actor()` and `on_job_changed`: API 381258–381269 and 381298–381315.
- `MWJob.get_running_state()`, `get_posting_details()`, `get_finish_reason()`, `get_command_type()`, `get_all_workers()`: API 334855–334908. FinishReason is documented as meaningful only in Finished state.
- Job-board posting/start/finish events and get_all_jobs: API 335024–335053, 335112–335120; component equivalents 335173–335204, 335262–335270.
- `MWJobBoardComponent.post_job()` documents a unique posting ID (335244–335255), but the inspected Blueprint discards it. Retaining/correlating such an ID would be a **future adapter change**, not existing order acceptance evidence. Similar methods have differing names: board `remove_associated_posting_and_job` versus component `remove_associated_posting_or_job`; neither should be substituted by guesswork.

**Smallest next source proof:** review the existing collected player-controller component creation/possession graph and squad display refresh edges to define when controller/pawn/worker identity becomes stale. Resolve whether a supported shipping observer can access the above readback plus the posted recipient/controller mapping, and where it can distinguish manual submissions. Native headers/implementations for MWPlayerController, MWSquad, MWJobBoard and MWWorkerComponent are still unavailable in this collection; more source text export alone does not guarantee those bodies can be recovered.

Once a concrete adapter and authorized isolated experiment exist, the minimal live proof remains **one AI, one Form On Me**. Correlate the freshly resolved recipient, controller, pawn, unit GUID, worker and follow job; independently observe blackboard/follow target and motion; then test a human order and a possession change while a second AI retains its baseline order. Proposed correlation evidence would strengthen order-state observation but would still not, by itself, prove successful movement. Transport, native authority, stable identity, manual override handling, actual job acceptance and visible behavior all remain **UNKNOWN / NOT_PERFORMED** today.
