# Observer asset authoring and shipping readout review

Reviewed **2026-09-23 UTC**. **PARTIAL: asset factory declarations and a UMG candidate are source-supported; executable graph authoring and the actual cooked readout remain UNKNOWN/BLOCKED.** This bounded unattended review read existing collected source/API declarations and narrow official documentation. No editor/game launch, native method invocation, asset creation, compilation, cook, deployment, plugin installation or test execution occurred.

The concrete deliverable is [OBSERVER_ASSET_SPEC.json](../design/OBSERVER_ASSET_SPEC.json), a **non-executable specification** for the component, configured registration instance, readout and measurement semantics. It is not a builder, `.uasset`, shipping runtime or ready-to-install manifest. Creating empty assets now would not resolve the missing diagnostic behavior, so no speculative builder or placeholder asset was produced.

## Evidence identity

`API` means `research/evidence/editor-source/mod-research-collection-20260921T023909Z-5eeaf52a/unreal-api-reference.txt`, **21,026,350 bytes**, SHA256 `AC4C46761BC54099302155BC0A908AE3F64B161CA77EB9AFD0CC6C1F1B826480`. `RUN` means `research/evidence/editor-source/ai-research-collection-20260921T030437Z-f7d8e930/`. Its `010` controller, `008` widget and `238/239` component/data-asset text are already collected evidence. Source locations below are one-based. The final review checkpoint binds these files.

The recorded editor identity is PGI **1.1.390.0e / UE4.26.2 / compatible CL14830424**. It was not refreshed by this offline review. Public Epic pages accessed September 23 target stock **UE4.27**, an adjacent version, and cannot establish the exact PGI fork's behavior. Declarations and serialized connections are distinct from successful native calls and shipping results.

## What can be specified without guessing

| Operation | Collected evidence | Meaning and remaining limit |
|---|---|---|
| Select a Blueprint parent and create an asset | `BlueprintFactory.parent_class`, API 169961–169983; `AssetTools.create_asset`, 127109–127124 | Candidate route for an empty component subclass; creation can fail/return NULL. Does not author callback graphs. |
| Load the stock component's generated class | `EditorAssetLibrary.load_blueprint_class`, API 382486–382497 | Supplies a class rather than treating the Blueprint asset object as the runtime class. Not invoked here. |
| Create a registration instance | `DataAssetFactory.data_asset_class`, API 170378–170400 | Candidate factory for an instance of the existing registration class; exact factory/asset-class combination has not been validated. |
| Inspect/configure new assets | CDO access, API 90–94; editor-property access, 357–370 | Requires exact returned identities and property/value readback. No stock CDO mutation is needed. |
| Save a new asset package | `save_loaded_asset`, API 382372–382384 | Exposed editor operation with package-wide/checkout effects; neither executed nor a graph compile or cook proof. |

The exact parent for the proposed component is `/Game/Objects/_common/Components/PlayerControllerComponents/PlayerControllerComponent.PlayerControllerComponent_C`. The registration must be a **new instance** of `/Game/Objects/_common/Components/PlayerControllerComponents/PlayerControllerComponentDataAsset.PlayerControllerComponentDataAsset_C`, not merely another Blueprint definition.

RUN `239-PlayerControllerComponentDataAsset-source.COPY:13,16–17` observes the `PrimaryDataAsset` parent, `ActorComponent` class reference constrained to the component base, and `bAddAtRuntime` Boolean. Its defaults (2–3) are `None`/`False`. The proposal points the new instance at the new component's generated class and enables runtime addition; actual editor-visible property identity/accepted values must be verified before assignment. That configuration still does not establish cooking, discovery or automatic factory invocation.

The matching [Epic AssetTools](https://dev.epicgames.com/documentation/en-us/unreal-engine/python-api/class/AssetTools?application_version=4.27), [BlueprintFactory](https://dev.epicgames.com/documentation/en-us/unreal-engine/python-api/class/BlueprintFactory?application_version=4.27) and [DataAssetFactory](https://dev.epicgames.com/documentation/en-us/unreal-engine/python-api/class/DataAssetFactory?application_version=4.27) sections document these generic creation interfaces. PGI's [Mod Editor Guide v2.3](https://static.mw5mercs.com/docs/MW5Mercs_Mod_Editor_Guide_%28v2.3%29.pdf), “Creating a New Asset Mod” / “Manage Mod,” PDF pages 8–11, supplies the official content-mod authoring/packaging workflow. Neither supplies this probe's actual mod mount, assets or registry/lifecycle result.

## Exact unattended authoring blocker

The collected `Blueprint` declaration (API 182709–182735) exposes metadata and compile-mode properties. `EdGraphNode` and `K2Node` (146036–146058) are empty declarations. The inspected API contains no declaration of `BlueprintEditorLibrary`, `BlueprintEditorUtils`, `compile_blueprint`, `add_function_graph`, `connect_pins` or `add_member_variable`. This is a bounded negative result in the collected reflected surface, not proof that every supported editor interface lacks the capability.

The stock component's `ControllerConfigured` custom event has no connected body (RUN 238:21–33), and BeginPlay/Tick are disabled and unconnected (34–57). Its native parent is ActorComponent (107). An empty subclass therefore implements no diagnostic. The [WidgetBlueprintFactory documentation](https://dev.epicgames.com/documentation/en-us/unreal-engine/python-api/class/WidgetBlueprintFactory?application_version=4.27) establishes a factory, not Python widget-tree or callback/pin construction on this installation. Edited COPY serialization is not a verified import or executable-graph authoring route.

The next missing **authoring capability** is therefore precise: create/override the component events and create/wire the readout's widget tree and executable graph through a supported installed-editor interface. A later bounded manual Blueprint authoring session is a possible route; no unattended graph builder can be justified from the evidence inspected here. Do not add a plugin/native helper, guess node APIs, or emit an executable text-asset substitute to bypass this gap.

## Supported observation building blocks and limits

API `Actor.get_components_by_class` (117066–117079) returns actual attached components inheriting the requested class; component `get_owner` (118755–118763) returns its owning actor. Controller source already uses this enumeration for the component base (RUN 010:1536–1545). Factory creation targets self while configuration enumerates `GetLocalController`, so actual owner versus callback/controller identity must be checked explicitly. Requested-class entries and callback counts are not instance counts.

API 118693–118713 documents BeginPlay/EndPlay for components, including creation after the actor has begun play. This supports a proposed observation recipe; it does not prove inherited empty events run useful code. Controller, component, pawn and world/session identities must be recorded separately. The same live controller changing pawns may validly retain its controller-owned component. Destroyed/replaced controllers or worlds require separate liveness evidence before declaring a retained component invalid.

**UMG is the ordinary runtime display candidate.** API 139427–139449 declares viewport/player-screen insertion; 158125–158134 text assignment; 138221–138229 owning-player access; 138057–138063 removal. RUN 010:3291–3299,4272–4281,3230–3239 connects stock `SystemInformationScreen` creation/storage/display. This proves a stock graph uses UMG; its hard-coded widget classes are not a mod-widget registration mechanism. Epic's [UMG quick start](https://dev.epicgames.com/documentation/en-us/unreal-engine/umg-ui-designer-quick-start-guide?application_version=4.27), “Required Project Setup,” describes ordinary Widget Blueprint creation and viewport display, but not this MW5 component's player/world context.

The alternative `MWUIScreensComponent.show_custom_screen` declaration (API 376607–376618) does not establish a passive overlay, independent startup, input effects or cooked availability. `show_debug_screen` (376598–376605) contains an ambiguous development comment; it is not retail support evidence. Neither is selected as a shortcut.

The collected controller's PrintString nodes are explicitly `DevelopmentOnly` (RUN 010:6165–6169; also 6348–6351,7029–7033,7253–7257). Epic's [UE4.11 release notes](https://www.unrealengine.com/blog/unreal-engine-4-11-released?lang=en-US), “Development Only Functions,” describe PrintString/PrintText and cook removal behavior. No effective PGI shipping configuration was established, so these cannot be the sole acceptance channel. [Epic's Python documentation](https://dev.epicgames.com/documentation/unreal-engine/scripting-the-editor-using-python?application_version=4.27), “Ways to Run” / “From Editor-only Blueprints,” confines Python to editor automation; it is not the cooked probe runtime.

## Positive observation, absence and lifetime

An actual probe-started UMG display could establish a **fresh uniquely attributable positive observation** of at least one component. Missing owner/count/lifetime fields must remain unknown; wrong or unknown owner stops the test. With reliable complete enumeration and verified controller identity, a separate exactly-one snapshot may be established. Neither observation identifies the factory caller or proves the discovery mechanism.

No display is **INCONCLUSIVE**, not zero. Negative interpretation needs independently live measurement, relevant cooked-registry inclusion/visibility, successful load/cast, correct controller selection and reliable component enumeration in a stated window. API 112778–112786 warns discovery can still be incomplete while the registry is loading. Those runtime outcomes may be obtained during the authorized test; requiring them all to pass before any positive attempt would be circular. What must precede deployment is a concrete supported measurement design, actual artifacts, manifest, isolated baseline, authorization and rollback.

Widget Construct/Destruct can occur more than once (API 139374–139388); OnInitialized is per non-template widget instance (139079–139086). Widget/callback counts therefore do not measure component creation. Disappearing UI or a missing teardown callback does not independently prove component destruction or invalid retention. Final bounded creation/lifetime acceptance needs the declared observation points, owner/count/transition evidence and successful rollback in the [corrected experiment contract](../design/OBSERVER_CREATION_ONLY_PROBE.md).

## Next action and stop

The asset specification resolves what must be authored and how observations must be interpreted. The remaining executable work is blocked by **supported graph/widget authoring**, **actual cooked assets and measurement implementation**, and **independent absence/teardown readout if those stronger conclusions are required**. A positive-only attempt remains a valid later option once its concrete implementation and deployment gates are satisfied; it cannot silently become the full M0 pass.

No user action is available tonight and no native authoring is authorized in this subtask. Stop here with exact blockers rather than create empty placeholders or repeat source exports. Preserve the prior native checkpoint as historical; shared handoff updates point to this new preparation review. The coordinator owns broader runtime, resource decisions, IMPLEMENTATION_STATUS and private backup.
