# Authored observer review result — 2026-09-25

**OBSERVED: editor-source review completed with minor display notes.** The three new assets exist, and their exported connected graphs, explicit defaults and registration match the intended passive creation snapshot. No functional graph defect was found in this bounded review. This advances the work to packaging preparation. Startup, cooking, retail deployment, visible display, teardown and recording remain **NOT_PERFORMED**.

This supersedes the pending-review status in [the preparation checkpoint](AUTHORED_OBSERVER_REVIEW_PREPARATION.md), without changing that historical record. The [manual recipe](../design/OBSERVER_MINIMAL_AUTHORING_RECIPE.md) and [creation-only contract](../design/OBSERVER_CREATION_ONLY_PROBE.md) still define scope and acceptance limits.

## Evidence and integrity

The user ran `scripts/Inspect-AuthoredObserver.py` in the existing editor. Its completed export is [observer-authored-20260925T052357Z-b89383e2](evidence/editor-source/observer-authored-20260925T052357Z-b89383e2/report.json): three assets, two class-default objects, no reported errors, 0.359 seconds. Five exported files total 332,191 bytes. Their lengths and SHA-256 values, the helper hash and the three current saved asset hashes were independently checked against that receipt. The helper reported saved source files unchanged throughout the export.

The applicable installation is the recorded MW5 editor, UE 4.26.2 / editor collection build 1.1.390.0. These exports are evidence from the current editor session, accessed 2026-09-25; they are not shipping-game evidence. Version metadata must be refreshed before a native build or game test.

The export contains loaded editor objects. Stable matching disk hashes do **not** independently establish that the loaded graphs exactly equal the saved binary graphs. Earlier green Compile icons are user-screenshot observations; this review did not execute compilation or produce an independent compiler receipt.

All line references below are to files in that export directory. `BP` means `BP_LanceObserverProbeComponent.COPY`; `WBP` means `WBP_LanceObserverProbeReadout.COPY`.

## Component graph

A separate read-only reviewer traced the actual linked pins against the recipe. It found 49 EventGraph nodes, 172 pins and 58 reciprocal link pairs, with no missing endpoints, nonreciprocal links or orphaned-pin flags. Counts are structural review evidence, not execution tests.

| Check | Observed source and location |
|---|---|
| Exact parent and variables | Stock `PlayerControllerComponent_C` parent; the four intended typed variables. BP:720,723–726. |
| Native BeginPlay and owner | Enabled connected BeginPlay captures ActorComponent.GetOwner on self; stored owner passes IsValid before the exact native MWPlayerController cast. Cast failure stops. BP:582–621,660–665. |
| Local-controller gate | Successful cast is stored; IsLocalController uses that stored controller; only True continues. BP:555–578. |
| One saved enumeration | GetComponentsByClass uses stored SnapshotOwner and the new probe generated class; one array setter consumes its result. Formatting reads Length of the stored array. BP:422–435,528–548. |
| Widget ownership | CreateWidget selects the new readout class, explicitly receives stored SnapshotController as OwningPlayer, stores Readout, and validates it before SetSnapshot. BP:477–519. |
| Formatting | Owner/self paths and converted saved-array length enter the intended Append inputs; final string-to-text reaches SetSnapshot.InText. BP:341–469,480. |
| Display and failure handling | SetSnapshot continues to AddToPlayerScreen on stored Readout, ZOrder 0. Its return drives the Branch. True ends; False removes only that Readout if valid, then clears the reference on both paths. BP:272–331,478. |
| EndPlay | Native EndPlay checks Readout; valid removes only the owned widget; both paths clear Readout, owner, controller and the stored array. BP:184–265. |
| Unused stubs | Tick event/parent call and the disconnected parent BeginPlay call are explicitly disabled. Native authored BeginPlay and EndPlay are connected. BP:625–665. |
| Passive scope | Complete graph references contain observation, formatting, own-variable assignments and owned-widget display/removal. No gameplay orders, input capture, timers, factory calls, component destruction or global widget removal were found. |

Component defaults explicitly show owner/controller/readout None (lines 2–4), tick capability/start disabled (5), replication false (8), autoactivation false (9), and editor-only false (12).

`SnapshotComponents` is omitted from the class-default export, so its initial empty value is **UNKNOWN from this export**. It is assigned the enumeration before any count read in the active initialization path, and explicitly cleared during EndPlay. The omission is not evidence of a populated array or a broken path.

## Widget and registration

Root review confirmed the widget's three-node SetSnapshot graph: entry execution → TextBlock.SetText; SnapshotText getter → target; entry InText → text input, with reciprocal links (WBP:26–56). Its parent is UserWidget (125). PreConstruct, Construct and Tick stubs are disabled and unconnected (59–103).

The tree has one CanvasPanel and one variable TextBlock. AutoWrapText is explicitly true; slot offsets are 20/20/900/260 (WBP:105–123). User screenshots also showed width 900 and height 260. The widget defaults explicitly show `bIsFocusable=False`, `bStopAction=False`, no script Tick/Paint, and `Visibility=HitTestInvisible` for self and children (defaults:14–18,45). VisibilityDelegate is null (24). No authored live text binding or input/focus-mode call appears in the exported widget graph. The CDO's `SnapshotText=None` is not a missing tree: the authored TextBlock and its graph target are present in the widget tree/source.

Registration is a data asset instance of the existing `PlayerControllerComponentDataAsset_C`, with ActorComponent pointing to `/LanceObserverProbe/BP_LanceObserverProbeComponent.BP_LanceObserverProbeComponent_C` and `bAddAtRuntime=True` (`DA_LanceObserverProbeRegistration.COPY`:1–4). This confirms source configuration, not cooked discovery or factory execution.

## Display notes and remaining limits

- BP:406 spells the label `Componet:`. This is a cosmetic typo and does not affect wiring or object identity values. It has not been silently edited.
- BP:352,384,406,416 use slash separators instead of the original recipe's actual newlines. The guided manual steps used these separators. Auto-wrap is enabled; actual path readability and clipping remain untested. Retain the authored wording for this checkpoint rather than treating the separator choice as a functional failure.
- The display retains `BEGINPLAY SNAPSHOT — NOT LIVE`, the class-family count qualification, and `Registry, lifecycle and recording: NOT VERIFIED`.
- A future visible snapshot can establish an attributable positive creation observation. It cannot prove exactly one stable instance, registry discovery, correct mission identity, lifecycle acceptance or a full mission recording. No display remains INCONCLUSIVE.

## Backup and next bounded step

`AUTHORED_OBSERVER_REVIEW_RECEIPT.json` records the independent integrity checks and the fresh eight-file backup manifest. That backup contains the final wrapping/visibility widget version, the component, registration, generated descriptor/configuration and icon. It is local evidence, excluded from source-only GitHub backup. Earlier binary backups are preserved unchanged.

Next inspect the installed editor's **Manage Mod** panel for LanceObserverProbe and record the actual packaging options. This is a settings inspection, not a cook invocation. Before building, pin the final input hashes, a fresh project-local output folder, resource gates, logs/stop conditions and cleanup. Use official local-folder packaging with publication and staging reuse disabled if those observed controls are available. Do not infer support from API declarations alone.

Retail deployment and a disposable Instant Action experiment require the concrete install/removal manifest, refreshed game/editor build and active-mod/DLC configuration, baseline, rollback and explicit deployment authorization specified in the creation-only contract. None was performed or granted by the export result. No stock lookup helpers need repeating.
