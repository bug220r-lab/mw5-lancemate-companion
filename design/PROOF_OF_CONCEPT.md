# Deterministic integration proof

Date: 2026-09-20. Status: **PARTIAL: source order/job, tactic and observation paths traced; packaged experiment BLOCKED by unresolved integration/authority/manual-origin contracts. ALL LIVE TESTS NOT_PERFORMED.** No LLM, speech, paid API, campaign memory or autonomous tactical loop belongs in this proof.

Objective: **one fresh live state read, one validated order to one designated AI lancemate, and independently observed confirmation in the packaged game.** The current sprint did not establish all prerequisites, so the live portion is gated rather than presented as a runnable implementation.

**Latest research handoff:** the user's nearer goal is live tactical decision-making, with human-like real-time play as the long-term ambition. The [expanded native collection completed](../research/AI_COLLECTION_RESULT_2026-09-20.md) with244source exports and128class-default exports, five explicit gaps and no audit mismatches. Continue offline source analysis; this replaces the older screenshot/small-export requests below. Source/default/dependency collection does not itself implement this one-command proof. See the [updated milestone sequence](AI_MAPPING_AND_EVALUATION.md).

**Subsequent trace complete:** [TACTICAL_CONTROL_READINESS](TACTICAL_CONTROL_READINESS.md) now specifies the minimal fresh binding/state observations, order-state-versus-motion distinction and remaining transport/manual-origin gates. The first action must match the actual native follow-leader semantics, not assume any IssuerPawn remains the FollowActor after worker initialization. No additional editor action is currently needed.

## Evidence and permission gates

| Gate | Required evidence | Current result |
|---|---|---|
| G0: installation identity | Game XML, launcher build, platform and hashes | OBSERVED unchanged Steam 1.14.390 / CL456620 / build24241637; receipt UE4.26.2 and executable hash added in follow-up; refresh before test |
| G1: editor/source | Completed matching MW5 editor; actual Blueprint/native order and field definitions | PARTIAL: editor1.1.390.0e / UE4.26.2; connected UI-to-order/job construction and follow worker/blackboard source traced, plus tactic selection and observation declarations. Native recipient resolution/scheduling, live actor binding, config/root transitions and human-origin lifecycle remain unresolved. See [order lifecycle](../research/ORDER_LIFECYCLE_TRACE.md) and [tactical state](../research/TACTICAL_STATE_TRACE.md) |
| G2: transport and authority inspection | Source/editor evidence identifies a credible shipping implementation for bounded input and the correct native order thread/owner; no live execution required at this gate | UNKNOWN/BLOCKED; synchronous upstream Victory I/O and audited generic native SDK narrow the search but do not pass. Actual shipping proof belongs to G4 after approval |
| G3: permission and isolation | Explicit approval for concrete install/deployment/launch/control steps; disposable scenario; backups and rollback manifest | Official editor installation APPROVED/completed. Subsequent continuation covers bounded installed-source inspection and its recorded editor diagnostic; the user started the existing GUI. Runtime deployment/gameplay remain outside scope; live isolation/rollback gates NOT_PERFORMED |
| G4: packaged execution | Versioned results and independent observations below | NOT_PERFORMED |

The user's unattended goal preserves research-only permissions. No adapter/driver exists today, so this is **not yet a runnable packaged-game test kit**. The new declaration evidence narrows the missing mechanism: `MWPlayerController.post_squad_order_class(...)` returns no acceptance value; `MWSquad.get_members_for_order(...)` resolves integer recipients, whose relationship to current AI actors must be traced; the worker/job route can be investigated for actor-bound `FOLLOW` state. A native `player_issued` flag cannot be assumed to distinguish a manual input from a companion using the player route.

## Short next experiment and pending actions

**Next permitted preparation:** refine the passive observation design using already collected texts and the [readiness synthesis](TACTICAL_CONTROL_READINESS.md). Trace controller-component initialization/possession and reliable manual-origin observation where supported, then specify a shipping-compatible probe/adapter manifest. The Form On Me, dispatcher, FollowOrder, SquadOrderBase and FollowJob graphs have already been exported and inspected; do not ask the user to reopen them or repeat their collection. Native implementation gaps may require a later controlled experiment rather than further broad asset export.

**First supervised packaged run, once G1–G3 are resolved:**

1. Refresh exact editor/game/adapter versions, active mods and DLC. Obtain approval for the concrete adapter manifest, install paths and the isolated test. Use stock Instant Action; no main-campaign save. If a save becomes necessary, name and verify its disposable backup before any changes.
2. Record the native one-AI baseline. Exit the game before applying approved artifacts, then relaunch with the documented startup command disarmed. Exact adapter/driver commands are **UNAVAILABLE until implementation is justified**; do not substitute a guessed command or editor Python.
3. Observe one real actor-position sample change during movement and stabilize while stopped; corroborate visually and bind it to the verified AI controller/pawn. Stipulated coordinates and heartbeat counts do not qualify.
4. Establish a non-follow native order first. Obtain fresh state, arm one validated Form On Me intent for that AI, and record command generation, bridge validation, dispatch, native job/order evidence and independent visible behavior separately.
5. Disarm. Test human supersession and repeat with a non-designated sentinel AI holding a distinct native order; its order must remain unchanged. Run remaining rejection/failure cases below before any ongoing use.
6. On wrong identity, stale/unknown state, uncertain acceptance, unintended recipient, loss of human control, stall or crash: stop new dispatch and preserve evidence. Never resubmit blindly. Stop only the known test driver, exit MW5 normally, remove only manifested additions, restore approved backups/configuration and verify rollback.

**Pending user actions/approvals:** none for this completed offline trace. Later approval is needed for a fully specified install/launch/control and supervised Instant Action test. First complete the probe/adapter preparation, reliable manual-supersession design and supported transport route so the proposed action is concrete and reviewable. No paid service or additional game purchase is required by this preparation.

Official editor installation and the subsequent bounded source investigation are already authorized. The [source session record](../research/EDITOR_SOURCE_SESSION_2026-09-20.md) distinguishes the failed diagnostic commandlet from the user's existing GUI startup. These do not authorize installing a runtime loader or commanding the game. Before requesting each game-affecting phase, produce the concrete file list, install destinations, artifact identity, backup location, rollback steps and test scope. If any action remains unspecified, complete the preparation first.

## Phase 0: executable read-only refresh

Use PowerShell on the machine with the verified installation. These paths were observed; if missing, stop and rediscover from relevant launcher metadata. Do not guess a replacement.

```powershell
$pocGameRoot = 'C:\Program Files (x86)\Steam\steamapps\common\MechWarrior 5 Mercenaries'
Get-Content -LiteralPath (Join-Path $pocGameRoot 'game_info.xml')
Get-Content -LiteralPath (Join-Path $pocGameRoot 'MW5Mercs\Mods\modlist.json')
Get-FileHash -LiteralPath (Join-Path $pocGameRoot 'game_info.xml') -Algorithm SHA256
Get-FileHash -LiteralPath (Join-Path $pocGameRoot 'MW5Mercs\Mods\modlist.json') -Algorithm SHA256
Get-Content -LiteralPath (Join-Path $pocGameRoot 'MW5Mercs\Binaries\Win64\MechWarrior-Win64-Shipping.target') |
    ConvertFrom-Json | Select-Object TargetName,Platform,Configuration,TargetType,Version
Get-FileHash -LiteralPath (Join-Path $pocGameRoot 'MW5Mercs\Binaries\Win64\MechWarrior-Win64-Shipping.target') -Algorithm SHA256
Get-Content -LiteralPath 'C:\Program Files (x86)\Steam\steamapps\appmanifest_784080.acf' |
    Select-String '"appid"|"name"|"buildid"|"installdir"'
Get-PSDrive -Name C | Select-Object Name,Free
```

Compare with [ENVIRONMENT.json](../research/ENVIRONMENT.json) and [BRIDGE_ENVIRONMENT.json](../research/BRIDGE_ENVIRONMENT.json), recording drift. Review [SOURCES](../research/SOURCES.md), especially B02, B04-B07, F01-F07 and P03-P04. The announced October update requires a new compatibility check; do not assume today's offsets/assets remain valid.

## Phase 1: smallest missing investigation

The read-only follow-up is recorded in [BRIDGE_INSPECTION.md](../research/BRIDGE_INSPECTION.md). The official editor is now installed at `C:\Program Files\Epic Games\MechWarrior5Editor`; Epic reported success at **18:26:42 -04:00** on 2026-09-20. [Post-install metadata](../research/EDITOR_POSTINSTALL.json) identifies package **1.1.390.0e / UE4.26.2**; [completion evidence](../research/EDITOR_COMPLETION.json) includes the unchanged Steam identity and matching compatible CL14830424. Earlier absence/readiness snapshots remain historical. Compatibility and native order/source definitions are still unverified.

The source checklist is in [EDITOR_INSPECTION.md](EDITOR_INSPECTION.md). Final launcher/engine/project metadata and relevant stable hashes are recorded in [EDITOR_POSTINSTALL.json](../research/EDITOR_POSTINSTALL.json) and [EDITOR_COMPLETION.json](../research/EDITOR_COMPLETION.json). The installed package's declared size is separate from actual allocated footprint and future cache allowance. The completion snapshot recorded **10.47 GiB free**; later startup observations are in the [source session](../research/EDITOR_SOURCE_SESSION_2026-09-20.md). Named order/telemetry assets and serialized fragments have now been inspected; callable signatures and graph connections remain unknown. Continue within the existing GUI once ready. No Play-In-Editor, cooking or retail-game test is authorized by this source investigation.

In an authorized editor/source session:

1. Start with the real single-member selection UI and the author-described **Lance Status UI** lead [F06], then follow actual references toward the PGI-documented SquadCommandComponent location if connected. No edge between them is verified yet. Trace **one-member Form On Me**, recording actual graph/function names, full asset paths, argument types, ownership/authority checks and native dependencies. An asset name alone is not the result.
2. Trace from a chosen lance slot to its current pilot, mech pawn and AI ownership. Find lifetime/invalidation behavior and whether player mech swap changes ownership. Record a way to reject stale references; do not bind permanently to an array index.
3. Find one observable live value. Start with player pawn position/velocity if accessible, since public export code provides that narrow precedent. Separately obtain the actor-binding information needed for the command. This first value need not include campaign data. If designated-lancemate pose is obtainable, prefer it and record the actual source.
4. Inspect the native order result/readback and manual-order signal. If unavailable, record the precise missing evidence. Do not label a function call or a debug print “accepted.”
5. Inspect actual bundled Victory/LowEntry definitions, plugin hashes, runtime exposure and any genuine asynchronous I/O facility. The upstream file functions [F02] are synchronous; timers do not solve this. The separately audited native SDK fallback [F05] still needs thread, shutdown/unload, version, dependency and license resolution. Stock source builds may auto-deploy, so do not run them as compile-only checks. Test no loader merely to see what happens.
6. Update `research/BRIDGE_INSPECTION.md` with actual editor evidence and a source-backed implementation manifest if justified. Retain exact missing contracts otherwise. No Play-In-Editor, packaging or retail execution is included in source-inspection approval.

This investigation can falsify the recommendation cheaply: if actor-specific native orders cannot be reached without replacing AI or unsafe unsupported hooks, reassess Route 3 and propose the reduced Route 2 experiment. An inability to inspect the editor is a prerequisite failure, not proof of impossibility.

## Phase 2: artifacts required before any live approval

The following are **proposed artifacts, not files created by this sprint**:

- One small adapter with source and cook/build instructions justified by Phase 1; no copied proprietary source or unrelated mod dependency.
- One deterministic local driver supporting exactly the proposed actions and negative tests. Concrete CLI syntax must be documented after implementation; there is no `send-order` executable today.
- A manifest listing every added/modified file, SHA256, original file backup if applicable, game/editor/engine/build IDs, dependency versions, license notes, chosen IPC and cleanup behavior.
- Test-run metadata, line-delimited structured logs, and a place for manually recorded/video observations with consent. Logs must redact secrets/account IDs.
- A physical disarm control tested without sending gameplay orders. No public listener and no paid backend.

Offline protocol tests may exercise bad IDs, stale sequences and replay handling, but their results must be labelled **mock only**. They cannot make G2/G4 pass. An editor execution is explicitly **editor only**.

## Phase 3: controlled packaged-game run, after approval

1. Close the game normally. Capture original mod configuration and exact relevant files before any change. Back up the full relevant save/config set to the agreed location without altering the originals; verify backup hashes/readability. Do not overwrite the main campaign or rely solely on cloud sync as backup.
2. Choose an isolated **Instant Action** setup with stock mechs, one AI lancemate, safe open terrain and no optional gameplay mods. This is the preferred first scenario. If campaign-only features force a campaign test later, use a separately identified disposable copy and confirmed branch. Verify that a proposed profile/isolation mechanism actually exists before relying on it.
3. Record DLC screen, build and active-mod UI manually or with newly authorized inspection. The installed build's XML, old `SeenDLC.json` and PAK presence do not establish full DLC entitlement. Record a baseline screenshot of the selected pilot/mech/slot.
4. Before enabling the adapter, record native behavior and frame-time baseline in the chosen scenario. Then install/enable only the previously approved artifacts, following the inspected PGI packaging path. Do not infer arbitrary DLL loading from the mod PAK mechanism. Restart normally if required. Confirm the manifest, expected initialization and no optional-mod collision. Repeat the same baseline with the adapter enabled but disarmed so its overhead can be distinguished from dispatch behavior.
5. For the native order baseline, use the actual current menu to manually issue a single-lancemate movement order creating an observable non-follow state, then Form On Me. The manual documents F2 as Lancemate 1 selection and F2 as Form On Me in the command menu; confirm the visible menu/current bindings instead of blindly repeating keys. Record what native following looks like in that scenario. **Before every companion dispatch, restore a verified non-follow order at a known location, move the player away and confirm the actor stays on that order.** Obtain a fresh snapshot after the reset; continued following from the baseline cannot count as a new effect.
6. Start the driver disarmed. Establish a fresh session epoch. Observe a changing telemetry value during human-controlled movement, followed by a stable value when stopped; match it to the visible state. A heartbeat counter alone does not count as the required live state read.
7. Bind the designated AI actor and confirm its pilot/mech/slot. If the adapter cannot verify ownership and binding generation, stop. Arm one command only. Submit Form On Me with a new ID, current epoch/generation, recent snapshot and short expiry.
8. Independently record the game's displayed/native order, any native acknowledgement, the designated mech's return/follow behavior, and that other slots receive no companion order. Use timestamped observer notes/video, plus native readback where available. Inspect sender and receiver logs separately.
9. Disarm immediately, then perform the negative/failure cases below in controlled resets. Repeat with a full stock lance to prove specificity: give at least one non-designated AI a distinct native go-to order before dispatch and verify that its order remains unchanged. This sentinel detects an accidental whole-lance order even when other mechs might otherwise already be following. Repeat normal dispatch five times, restoring the verified non-follow precondition before each trial; this is an initial gate, not a reliability rate estimate.
10. Do not introduce attack-target until the Form On Me gate passes and target/team validation exists. Its later extension requires a safely selected hostile and rejection of friendly/missing/destroyed targets; no assumed nearest-target fallback.

## Required test cases and outcome evidence

All cases currently **NOT_PERFORMED**. Suggested 1-second command context TTL and 2-second dispatch/readback timeout are test parameters to tune; allow an independently chosen 15-second unobstructed movement observation window. Record native baseline variability. Do not infer a universal performance guarantee from those thresholds.

| Case | Stimulus | Required result |
|---|---|---|
| Fresh normal command | Current epoch/binding; valid AI in verified non-follow state; one Form On Me | Fresh state corroborated; one dispatch; correct native order readback if obtainable; visible change to follow behavior; non-designated sentinel's native order unchanged (ordinary movement/heat changes allowed) |
| Invalid target | Missing/friendly/dead hostile for attack extension, or target supplied to targetless form action | Reject before native dispatch; unchanged native order; no side effect |
| Wrong actor | Handle for a different slot or human pawn | Reject, even if handle points to a valid actor |
| Stale actor | Old generation after slot change, destruction or mech swap | Reject; no automatic rebinding to new occupant |
| Repeated command | Resubmit exactly same command ID | Return recorded result; native dispatch count remains one |
| Stale mission | Old epoch after restart/load, or expired snapshot | Reject, purge queue, no delayed replay |
| Manual override before dispatch | Human order after model/driver snapshot | Reject companion command due to manual generation mismatch |
| Manual override after dispatch | Human issues a different order | Manual order persists; companion disarms and sends no corrective repeat |
| Pause/menu/loading | Submit before/during transition | No execution while blocked; resume requires new state and intent |
| Companion failure | Gracefully stop then crash/terminate only the known test driver process | Native AI and manual controls remain functional; no game-thread stall, reset or queued replay |
| IPC malformed/unauthorized | Bad framing/schema/auth/oversized message | Reject safely, bounded logs; no native call |
| Loss of actor/mission | Death/ejection/end/reload in disposable scenario | Revoke binding and epoch; do not invent campaign events |

Do not kill a game process for the failure test. Terminating the deliberately created test driver requires confirming its process ID/path. Detailed death/ejection and save tests can remain blocked until a safe reproducible scenario exists, but then the overall safety gate remains incomplete rather than PASS.

## Logs, pass criteria and reporting

Record run/build/artifact IDs, scenario, mission epoch, monotonic samples, actor binding generation, human-order generation, command ID, validation result, dispatch count, native readback and independent observation IDs. Record errors and latency at each boundary. Use no fabricated success events. An observed response line in the driver's log is not independent evidence.

**First behavior proof PASS** requires fresh real state, verified AI binding, exactly one actual native dispatch, correct native order evidence, independently corroborated change from non-follow to follow behavior, and unchanged native order for the non-designated sentinel in the full-lance trial. If native readback is unavailable, report **BEHAVIOR_OBSERVED_WITH_ACCEPTANCE_UNKNOWN**, not an all-stage PASS. If only editor behavior works, report **EDITOR_ONLY**. All required rejection/failure cases must pass before enabling ongoing runtime use; mark pending cases explicitly.

Performance records should include baseline and adapter frame-time observations, command timestamps and stalls/crashes. No FPS/latency acceptance claim exists until a measurable budget is agreed and tested. One successful trial never establishes general reliability or compatibility.

## Cleanup and rollback

Disarm; stop only the companion/test process; exit MW5 normally. Remove only files listed as newly created in the approved install manifest; restore backed-up modified files and original mod selection after verifying exact paths. Never recursively delete a computed game/mod directory. Close test endpoints and invalidate secrets. Recheck relevant hashes and launch the vanilla baseline only if that verification launch was approved. Retain redacted failure evidence. Do not overwrite newer real campaign saves with older backups. Restore a disposable test save only to its recorded test destination.

## What cannot be tested yet

The inbound channel, exact command/readback functions, AI authority, supported native loading, runtime actor binding and manual interception lack inspection proof. Stable campaign pilot IDs, save lineage, co-op, full mod compatibility, voice latency/accuracy and FPS impact also remain untested. A voice demo is not a substitute for any gate here.
