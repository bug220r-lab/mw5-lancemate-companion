# Observer startup graph audit — 2026-09-25

**OBSERVED source review: no concrete defect found in the authored startup graph, stock-base delegation, registration type, or snapshot-to-widget wiring. No corrective node change is justified by this evidence.** The missing retail readout remains **INCONCLUSIVE** for component creation. This review does not establish that the exported graph executed, that the native component factory ran, or that an actual widget reached the retail viewport.

This is a bounded independent audit of the existing export after [the first retail observation](OBSERVER_STARTUP_RESULT_2026-09-25.md). It rechecked the exact sources behind [the authored review](AUTHORED_OBSERVER_REVIEW_RESULT.md), [factory trace](PASSIVE_OBSERVER_FACTORY_TRACE.md), and [native game-mode boundary](OBSERVER_BASE_MODE_NATIVE_RESULT.md). Only this new report was written. No editor/game/native call, asset edit, compilation, collector, package change, deployment, or runtime attempt occurred.

## Evidence identity

Access date: **2026-09-25**. `A` denotes [observer-authored-20260925T052357Z-b89383e2](evidence/editor-source/observer-authored-20260925T052357Z-b89383e2/report.json). `S` denotes [ai-research-collection-20260921T030437Z-f7d8e930](evidence/editor-source/ai-research-collection-20260921T030437Z-f7d8e930/report.json). `API` denotes the existing [generated API reference](evidence/editor-source/mod-research-collection-20260921T023909Z-5eeaf52a/unreal-api-reference.txt). Line numbers are one-based.

The recorded editor is **1.1.390.0e / UE4.26.2**. The retail observation records **1.14.390 / CL456620**. These are evidence provenance, not a fresh installed-build or compatibility check. Source exports represent loaded editor objects; text integrity does not prove equivalence with saved binary graphs, cooked bytecode, or retail execution.

All five authored export lengths and SHA-256 hashes were independently reread and matched `A/report.json`:

| File in A | Bytes | SHA-256 |
|---|---:|---|
| `BP_LanceObserverProbeComponent.COPY` | 311,678 | `7CA123068C6A73EE2E4A9CA9BC970F3E3CD88223951BE239EDFF1F2B9C212CE4` |
| `BP_LanceObserverProbeComponent-defaults.COPY` | 800 | `9F56C1229C2285FE9725F6BC5591DB43BCF82E857328D5070D3507C78BA21B23` |
| `WBP_LanceObserverProbeReadout.COPY` | 17,218 | `F1514DDD2484BF545749C640C892E1B7E7EBF1C3D1DD914FE234CCC004B7D2C3` |
| `WBP_LanceObserverProbeReadout-defaults.COPY` | 1,962 | `2DB67F3B51795BA5101C6F59A3B68FC1E83B01CCB56AC3E9C3C0C2DBE8DEE9E6` |
| `DA_LanceObserverProbeRegistration.COPY` | 533 | `08D0EB03B249EF97031AA57BA27138AE99E1A33C21F62FE27C3595007EF4B331` |

The four stock source/default files used for the factory/type/base checks also match the SHA-256 values recorded in the factory trace: `010-MW5PlayerController-source.COPY`, `238-PlayerControllerComponent-source.COPY`, `238-PlayerControllerComponent-defaults.COPY`, and `239-PlayerControllerComponentDataAsset-source.COPY`.

## Connected initialization and cleanup

**OBSERVED:** an independent read-only structural check of `A/BP_LanceObserverProbeComponent.COPY:178–718` reproduced **49 EventGraph nodes, 172 pins, and 58 reciprocal link pairs**, with **zero missing endpoints, nonreciprocal links, or orphaned-pin flags**. Node and pin identity were evaluated together; reused pin GUIDs on different copied nodes were not incorrectly treated as the same endpoint. This is serialized graph validation, not a compiler or execution test.

| Boundary | Exact source finding | Assessment |
|---|---|---|
| Entry | BP:659–665 enables native `ActorComponent.ReceiveBeginPlay` and connects it to the owner setter. BP:118–140 also exports the generated ReceiveBeginPlay wrapper. | No disconnected or disabled authored entry was found. Generated wrapper text is not inspected bytecode. |
| Owner and type | BP:603–621 reads `GetOwner` on self, stores it, and feeds validity and cast inputs. BP:582–600 gates the exact native `MWPlayerController` cast on a valid owner. | No wrong-object or wrong-cast-class wiring found. Failure exits silently. |
| Local controller | BP:555–578 stores the successful cast, evaluates `IsLocalController` on that stored controller, and continues only on True. | No reversed branch or unassigned read found. This does not independently prove a ready local player/viewport. |
| Snapshot | BP:526–548 enumerates the saved owner using the probe generated class and stores the result before display. BP:422–435 reads length from that stored array. | The count cannot block display. It is a one-time class-family count, not stable uniqueness evidence. |
| Widget creation | BP:497–519 passes the stored controller as OwningPlayer, selects the exact probe widget class, stores the result, then validates it at BP:487–490. | No missing owner or widget-class input found. Failed creation exits silently. |
| Text then display | BP:477–480 calls `SetSnapshot` on the stored widget; its outgoing execution reaches `AddToPlayerScreen`, BP:320–324. | Correct object and execution order are serialized. The display return drives the branch. |
| Failed display | BP:309–312 sends False to BP:295–303, which removes the owned widget if valid and clears Readout on either validity branch, BP:267–285. | Failure intentionally leaves no persistent diagnostic output. This is an observability limit, not a demonstrated defect. |
| Teardown | BP:219–265 removes only the owned widget, then clears Readout, owner and controller and clears the array, BP:180–217. | No unconditional removal on the successful display branch, global widget removal, or component destruction was found. |

The concrete silent outcomes are invalid owner, cast failure, nonlocal controller, invalid widget, unsuccessful AddToPlayerScreen, and later EndPlay removal. No observed branch result identifies one of them as the cause of this retail result.

## Parent BeginPlay, activation, and factory ordering

**OBSERVED:** the authored parent call at BP:649–658 is disabled and disconnected. Its actual stock parent, `S/238-PlayerControllerComponent-source.COPY:34–44`, has only a disabled, unconnected ReceiveBeginPlay stub, and inherits directly from `Engine.ActorComponent` at line 107. The parent does not contain an initialization, registration, activation, or widget action that the child omitted. The stock `ControllerConfigured` event has no connected authored body at lines 20–33; the generated wrapper at 67–105 does not add a missing setup procedure. Enabling the parent's empty Blueprint BeginPlay call is therefore not a source-backed repair.

**OBSERVED/DOCUMENTED:** stock defaults line 6 and authored defaults line 9 both have `bAutoActivate=False`; the authored tick capability/start flags are also false. The active authored graph contains no `IsActive` check and uses ReceiveBeginPlay rather than an activation delegate. The installed API comments distinguish automatic activation (`API:118558–118562`) from the component BeginPlay event (`118707–118713`), including dynamically created components whose owning actor has already begun play. Epic's [UE4.27 ActorComponent reference](https://dev.epicgames.com/documentation/en-us/unreal-engine/python-api/class/ActorComponent?application_version=4.27) documents the same distinction. UE4.27 documentation is a corroborating engine reference, not proof of MW5's UE4.26.2 native helper implementation. Neither the exported stock base nor these contracts supports treating Auto Activate as the missing BeginPlay switch.

**OBSERVED:** `S/010-MW5PlayerController-source.COPY:1444–1775` clears its requested-class list, scans `PlayerControllerComponentDataAsset_C` with subclasses included, loads/casts each result, checks `bAddAtRuntime`, skips an already requested class, and calls the MW5 native add helper on **self**. The helper's component return is ignored at line 1500. After the asset loop completes at 1654, a separate loop enumerates components on **GetLocalController** and sends `ControllerConfigured` with self and stored pawn fields, lines 1536–1568 and 1656–1697. Add and configure therefore have different target expressions; no change to the probe's owner-based BeginPlay path is justified by that distinction alone.

The exact class conversion is **hard class to soft class**, not unresolved soft class to hard class: `ActorComponent` has a `class` pin at 1721; the conversion input/output at 1574–1575 are `class` → `softclass`; the helper accepts `softclass` at 1498. The registration stores the intended generated class at `A/DA_LanceObserverProbeRegistration.COPY:2`. No missing-load defect follows from this conversion node.

**UNKNOWN/BLOCKED:** native `MWBlueprintUtils.AddComponentByClass` exposes a signature and ActorComponent return (`API:308934–308947`), not its allocation, registration, initialization, duplicate, or BeginPlay implementation. There is no source basis here for adding a separate RegisterComponent/Activate call. A completed registry loop orders the subsequent configuration calls after the helper calls, but it does not establish the helper's internal lifecycle behavior. The factory's caller and timing remain unresolved at the already reviewed native boundary. The probe deliberately does not depend on ControllerConfigured; moving initialization there would change the experiment and could miss a callback rather than repair a proven fault.

## Readout construction, text, visibility, and controller class

**OBSERVED:** `A/WBP_LanceObserverProbeReadout.COPY:26–56` sends the SetSnapshot input directly to the variable TextBlock's SetText. Construct, PreConstruct and Tick are disabled and unconnected at 59–103. The only authored initial text is `Observer preview` in the tree at 107; no authored binding, later setter, or Construct/PreConstruct reset is exported. The widget parent is native UserWidget at 125. There is no source-supported text-clearing race to repair by moving SetSnapshot after AddToPlayerScreen.

**DOCUMENTED:** the installed API describes SetText as assigning the text and removing its text binding (`API:158125–158133`), and Construct as a Slate-construction event (`139381–139388`). Epic's [UE4.27 TextBlock reference](https://dev.epicgames.com/documentation/en-us/unreal-engine/python-api/class/TextBlock?application_version=4.27) and [UE4.27 UserWidget reference](https://dev.epicgames.com/documentation/en-us/unreal-engine/python-api/class/UserWidget?application_version=4.27) corroborate those contracts. They do not show the actual retail tree instance. `SnapshotText=None` on the widget class default at defaults:2 is not evidence that the instantiated tree lacks its variable TextBlock; the exported tree and variable getter exist.

**OBSERVED/DOCUMENTED:** the UserWidget defaults explicitly have full color alpha (line 3), identity render transform (25), enabled true (28), `Visibility=HitTestInvisible` (45), and `RenderOpacity=1` (46). `API:3877–3881` identifies HitTestInvisible as visible while excluding cursor hit testing for the widget and its children. It is not Hidden or Collapsed. The tree has a CanvasPanel root and the TextBlock in its slot (`WBP:105–123`), with offsets 20/20/900/260 and AutoWrapText true. No authored zero opacity, zero scale, hidden flag, or zero-size slot is exposed.

**UNKNOWN/BLOCKED effective geometry:** child visual properties, slot anchors/alignment, inherited native defaults, final viewport/DPI geometry, and the actual retained Slate tree are not fully resolved by these exports. Omitted fields were not promoted to measured runtime defaults. The readout uses AddToPlayerScreen with ZOrder 0 (`BP:323`); the existing stock controller also contains AddToViewport calls with explicit orders 200/300/400 (`S/010:3050,3176,3239`). Those calls establish that other UI layers exist in source, not that an opaque layer covered this readout or that the ordering between these viewport paths caused the observed failure. Raising ZOrder is not an established fix.

**OBSERVED class compatibility:** the authored owner cast is to `/Script/MechWarrior.MWPlayerController` (`BP:582`). The already collected [Instant Action controller export](evidence/editor-source/observer-caller-20260921T044217Z-54302cc3f1af/source.COPY):421 inherits directly from `MW5PlayerController_C`, whose parent is that exact native type (`S/010:8415`). Therefore no source-level mismatch exists for that controller chain. Which controller actually owned a retail probe instance, or whether there was any such instance, remains unknown.

## Disposition

**No corrective node-change recipe is proposed.** Reconnecting the empty parent call, enabling Auto Activate, inserting a delay, switching to ControllerConfigured, moving SetSnapshot, forcing registration, or raising ZOrder would each change behavior without an observed failing boundary. Preserve the package and this result.

A future diagnostic must first establish an independent output control and distinguish component entry from owner/cast/local-controller/widget/display outcomes, with a lifetime marker. The next experiment must label any explicit creation separately from automatic startup and carry its own reviewed artifacts, disposable scenario, baseline, stop conditions and rollback. That experiment was not prepared or performed by this source audit. No additional broad source collection or unchanged runtime retry is justified by this report.
