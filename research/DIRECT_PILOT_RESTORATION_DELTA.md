# Direct-pilot restoration: receiver-specific constraints

Reviewed 2026-09-22. **OBSERVED:** preserved editor declarations and connected Blueprint source. **UNKNOWN/BLOCKED:** reversible direct-control ownership and shipping-game restoration. **NOT_PERFORMED:** native execution, deployment, takeover or gameplay tests in this review.

This is a narrow addition to [AI movement analysis](AI_MOVEMENT_ANALYSIS.md), especially line 102, and [control/support analysis](AI_CONTROL_SUPPORT_ANALYSIS.md), lines 31–33. Those reports already identify dropship throttle scripting and mech-swap brain restart. The new finding is that the exposed stop, pause and restart operations belong to different receivers and do not establish interchangeable restoration contracts.

Applicable evidence: collection `ai-research-collection-20260921T030437Z-f7d8e930`, editor **1.1.390.0e / UE4.26.2**. This does not verify Steam **1.14.390** behavior. The Python reference contains generated declarations/docstrings and placeholder bodies, not the native implementation; `return False` and `return None` in that file are not observed game results.

## New constraints

| Receiver and exact declaration | Source evidence | Consequence for direct piloting |
|---|---|---|
| `MWBlueprintUtils.stop_logic(pawn) -> bool` | [API reference](evidence/editor-source/ai-research-collection-20260921T030437Z-f7d8e930/unreal-api-reference.txt), lines **306627–306640**. The docstring says: “This terminates all behaviors, ResumeLogic cannot be used to undo this action.” The next line inconsistently describes the boolean as whether logic was “paused.” | **DOCUMENTED constraint:** do not design `stop_logic` followed by `resume_logic` as an inverse pair. The contradictory return wording requires native verification; a true result would not prove a reversible pause or restored state. “All behaviors” is the declaration's wording, not proof that every movement, weapon or other component writer stops. |
| `MWBlueprintUtils.pause_logic(pawn) -> bool` and `resume_logic(pawn) -> bool` | API lines **306916–306928**, **306836–306848** describe pausing/resuming AI logic and booleans indicating those operations occurred. | **UNKNOWN/BLOCKED:** preservation of jobs, timers, blackboard state, weapon state and movement input is unspecified. These pawn utility declarations must not be attributed to `BrainComponent`. |
| `BrainComponent.stop_logic(reason)`, `start_logic()` and `restart_logic()`, all returning `None` | API lines **250178–250198**. Start does nothing if already running; restart applies to currently running or previously run brain logic. `is_running` / `is_paused` are declared at **250199–250216**. The captured class occupies **250156–250216** and has no own pause/resume method. | **DOCUMENTED distinction:** start and restart are not equivalent. Neither call returns a restoration acknowledgement or promises to reconstruct a worker job, prior order or other component state. Brain flags alone cannot prove that native locomotion and firing resumed correctly. |
| `MWWorkerComponent.stop_logic(reason) -> None` | API lines **381271–381279** say it stops worker logic entirely, effectively stopping its current job. The captured class body **381239–381327** has job-search/job-board setters and job/actor getters, but no explicit start/resume/restart counterpart. | **UNKNOWN/BLOCKED:** the exposed worker stop has no demonstrated inverse. `set_will_look_for_jobs(true)` is documented only as enabling job search with a valid board (**381280–381297**); it cannot be labeled restoration of the interrupted job. Absence from this captured class does not prove native restoration is impossible. |

## What the connected examples actually establish

**Dropship exit:** in the registered EventGraph, `K2_BeginWorker` feeds `Array_AddUnique`, then calls **MWWorkerComponent.StopLogic** with reason `ExitDropshipJob`, then calls `UpdateMechThrottle` with throttle 1. The same event's worker is wired into the stop receiver and update argument. This is a concrete worker-level stop inside a special job, not a call to either the pawn utility or the brain component. The export contains no named `StartLogic`, `RestartLogic`, `PauseLogic` or `ResumeLogic` call; that bounded absence does not exclude native or external lifecycle restoration.

Evidence: [031 source](evidence/editor-source/ai-research-collection-20260921T030437Z-f7d8e930/031-Ally_ExitDropshipJob-source.COPY), event **2649–2656**, worker links / array-add **2353–2377**, stop **2507–2515**, update **2423–2433**, node registration **2674**, graph registration **2702–2704**. The existing movement report covers the exit/timer cleanup; this review does not promote that cleanup into restoration proof.

**Mech swap:** two registered calls target **BrainComponent.RestartLogic**. The first receives the brain of `NextMechCandidateController`. Its execution output reaches an `IsValid` check on `PreviousMechAIController`; the valid branch then restarts that controller's brain. Thus this example names two stored controller references in a possession workflow, not a generic “restart the worker I stopped” procedure. Copying the calls into a takeover loop would require fresh controller-to-pawn identity and ownership evidence.

Evidence: [240 source](evidence/editor-source/ai-research-collection-20260921T030437Z-f7d8e930/240-PlayerControllerSwitchMech-source.COPY), connected sequence **2239–2250**, first call **1403–1410**, first receiver **3017–3023**, **3487–3494**, conditional **2698–2706**, **3463–3469**, second call **1742–1749**, second receiver **3414–3419**, **3430–3437**. Nodes are registered at **3978**, **4091**, **4176**, **4188**, with EventGraph registration **5011**. The separate weapon-stop calls already described in the control/support report remain separate operations. These paths do not prove exclusive ownership of every movement, aim or firing writer.

## Smallest useful future experiment

**PROPOSED, blocked on the passive observer:** observe one designated native AI during a normal dropship exit and a separate player-requested mech swap, with another teammate as sentinel. Add no companion stop/start calls. Record timestamped controller/pawn/worker/brain identities, available brain state and worker job changes before, during and after each transition; mark unavailable fields unknown. Correlate those observations with independently visible movement and firing. This distinguishes which native lifecycle restores behavior and whether a reused controller reference now owns a different pawn. It does not prove takeover safety.

Before execution, prepare the actual observer artifact/install manifest, refresh builds and active configuration, and use disposable stock Instant Action with a baseline and rollback. Stop on identity ambiguity, unintended writes or loss of observation; exit the disposable session normally and remove only manifested probe additions. No main campaign, native loader or injected control is implied.

Only after that observation and a complete writer/ownership inventory should a separate one-AI pause/stop/restoration experiment be specified. Its pass criteria must include correct recipient, unaffected sentinel, human precedence, independently observed resumption and verified job/order semantics. A function return, brain flag or scheduled restart is insufficient. **No supported reversible direct-control protocol is established by this delta.**

## Evidence integrity

Recomputed SHA-256 hashes on 2026-09-22; they match the preserved collection report. Paths below are relative to `research/evidence/editor-source/ai-research-collection-20260921T030437Z-f7d8e930/`.

| Preserved file | SHA-256 |
|---|---|
| `unreal-api-reference.txt` | `ac4c46761bc54099302155bc0a908ae3f64b161ca77eb9afd0cc6c1f1b826480` |
| `031-Ally_ExitDropshipJob-source.COPY` | `76aefdef2c4f9ea1cf5dea1ed6acc5411fdb242869f5cacb9824f35f8ae91738` |
| `240-PlayerControllerSwitchMech-source.COPY` | `4365c7382ec90f6491036fd0392d046ba2d71b8f53fafb7c9acc4a3ab3c42cf1` |

Source inspection and hashing only. No sources were recollected or modified.
