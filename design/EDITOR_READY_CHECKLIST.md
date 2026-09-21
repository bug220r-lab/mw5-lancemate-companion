# When the editor window is ready

**Collection is complete:** see [the native result](../research/COLLECTION_RESULT_2026-09-20.md). All eighteen assets and the generated API snapshot are available for offline inspection; do not ask for another collector run or screenshots of these assets. The handoffs below are historical. Follow-order/job, controller/UI and telemetry semantic analysis is next; live gameplay remains NOT_PERFORMED.

**CURRENT handoff:** the user requested one consolidated collection. Use File > Execute Python Script once with [Collect-ModResearch.py](../scripts/Collect-ModResearch.py); see [coverage and limits](../research/CONSOLIDATED_RESEARCH_COLLECTION.md). It handles the eighteen named sources itself, reuses the two completed exports, records dependency names and snapshots the generated API reference. This supersedes the three-file action below. Native execution remains NOT_PERFORMED.

Prepared2026-09-20 for installed MW5 Editor1.1.390.0e / UE4.26.2. **PARTIAL: generated declarations and Form On Me Activate graph inspected; recipient selection, downstream execution and gameplay remain unverified.** Do not use the failed commandlet launcher again.

**Current next action:** choose File > Execute Python Script in the existing editor and run [Export-FollowOrderSources.py](../scripts/Export-FollowOrderSources.py). The [prepared three-asset batch](../research/FOLLOW_ORDER_EXPORT.md) covers FollowOrder, SquadOrderBase and Ally_FollowJob; seven focused MOCK_ONLY checks passed. It exports available already-loaded objects and reports missing objects without loading them. Its native run remains NOT_PERFORMED. The previous two UI exports are [reviewed](../research/BLUEPRINT_EXPORT_REVIEW_2026-09-20.md); no repeat export or screenshots are needed for them. The numbered graph steps below are historical. Native gameplay, acceptance and shipping tests remain NOT_PERFORMED.

## First action on return: inspect the real graph

The editor generated its API reference automatically; the [26-class report](../research/evidence/editor-source/generated-stub-contracts.json) is already collected. Another Python menu action is unnecessary for the declarations now known.

1. In the existing responsive editor, locate `Dpad_FormOnMeLogic` in the Content Browser at `Content/UI/Mech/DPad/DpadActionLogic/LanceCommands`. Open its Blueprint for inspection only.
2. Show the graph around `PostSquadOrderClass`, including the owning graph, order class, order-info/context inputs and connected recipient source. Exact visible node spelling remains to be confirmed; these names came from this asset and generated native declarations.
3. Follow the actual recipient connection to its selection/dispatcher definition, then the order-class connection into `Content/Modes/MissionDirectorSystem/MissionComponents/SquadOrders/FollowOrder`. Record types, defaults, guards and the current-controller lookup. Do not replace IDs with guessed slot numbers.
4. Inspect and record the visible graph/pins. The user has authorized Codex to perform this inspection directly. Native window discovery now works, but screenshot capture fails on both editor windows with `SetIsBorderRequired`/`0x80004002`; text-only accessibility exposes only window roots. See [capture evidence](../research/evidence/editor-source/desktop-capture-attempt-2026-09-20.json). Obtain supported capture recovery or user-provided current screenshots before visual input. Following the user's screenshot, the empty `Create Mod` dialog was closed with targeted Alt+F4, confirmed by fresh window discovery; do not repeat dismissal or create a mod for this inspection. Do not press Play/Simulate or save changes. If opening is blocked or native implementation is hidden, record that exact limit rather than treating a generated signature as an implementation.

The desired source result is one verified selected-AI -> recipient -> follow-order path, with an actor-bound readback and human-override plan. See [proof gates and pending approvals](PROOF_OF_CONCEPT.md). A source graph alone does not pass the packaged-game test.

For the follow target, the next named asset is `Content/AI/Jobs/Ally_FollowJob`. Inspect initialization/worker-start references involving `FollowActor`, `FollowUnit`, `GetPlayerSquadLeader`, the required behavior tree and `BT_MechFollow`. These names are now pinned byte fragments; their wiring and values remain unknown. A boolean from `initialize_from_squad_command_order_info` concerns initialization and must not be reported as accepted native execution.

## Optional fallback metadata collection

Use these earlier steps only if a specific gap in the generated reference justifies new metadata; they are not the default next action.

1. Wait for the existing editor window to appear and respond. Refresh C: free space before collecting metadata; a zero shader count alone does not prove readiness. No new editor instance is needed.
2. In that window, choose **File > Execute Python Script**, then select:

   ```text
   C:\Users\jlewi\OneDrive\Documents\ChatGPT\MW5 LANCEMATE COMPANION\scripts\Inspect-EditorReflection.py
   ```

   Epic documents this menu in [UE4.27 Python scripting, File Menu](https://dev.epicgames.com/documentation/en-us/unreal-engine/scripting-the-editor-using-python?application_version=4.27), accessed2026-09-20. The installed fork is4.26.2, so the actual menu remains to be confirmed. Its project already enables PythonScriptPlugin and EditorScriptingUtilities. If the item is absent or an error appears, record that observation; do not enable/install plugins or restart speculatively.
3. The script writes one small metadata report at [native-reflection.json](../research/evidence/editor-source/) (the report does not exist yet) and logs `MW5_RESEARCH_REFLECTION_COMPLETE`. Tell Codex that execution finished or quote the error; Codex can read the local result directly. Existing final/temporary reports cause an early refusal instead of overwriting evidence. Do not delete them to force a rerun.

The collector reads exposed Python type/member documentation. It does not create objects, load assets/levels, execute Blueprint graphs, issue orders, start Play-In-Editor or save/cook assets. Caps:500types,500members/type,4000members total,8000characters/doc and4MiB of serialized records. A10-second cooperative time check is not a hard timeout. Missing/truncated documentation and incomplete collection are explicit; documentation is not proof of shipping availability or correct behavior. Normal editor startup/cache activity is separate from this report.

## What Codex does with the result

- Verify the report's script hash, nonempty relevant types, errors, limits and partial-result indicators. The status `COLLECTED_REQUIRES_REVIEW` is not an integration pass.
- Look for the actual owners/signatures related to the already-observed `MWPlayerController`, `MWSquadCommandOrderContext`, `MWSquadCommandOrderInfo` and `PostSquadOrderClass` names, accounting for actual Python naming. These are search leads, not callable commands.
- Follow the [eight prioritized contract gaps](../research/EDITOR_CONTRACT_GAP_MATRIX.md): current AI binding, one recipient, authority, Form On Me, native acceptance/readback, human override, position and bounded transport.
- Inspect the named Blueprint connections only after readiness and metadata review. Begin with `UI/Mech/DPad/DpadActionLogic/LanceCommands/Dpad_FormOnMeLogic` and its verified references; use `AI/_common/Decorators/BTDecorator_WithinRangeFromActor` for the position lead. Never infer graph edges from matching strings.

Direct editor inspection is authorized. The earlier tool initialization error is resolved; the remaining visual-access blocker is screenshot capture compatibility, with insufficient accessibility text. Local report analysis can proceed without screenshots. No game launch, runtime deployment, paid service, new voice work or live control is included.

## Preparation validation

**OBSERVED / MOCK_ONLY:** [13 synthetic checks](../research/evidence/editor-source/reflection-collector-offline-validation.json) passed under bundled Python3.7.7. They cover representative C/Python documentation, descriptor traps, missing types, caps, preservation and publication. An independent code review found no high/medium issue. Real Unreal descriptor coverage, GUI execution and native contracts remain unverified. The [earlier commandlet script](../research/evidence/editor-source/native-reflection-commandlet-script.py) is preserved separately from this revision and its failed startup receipt.

The subsequent [text-only reference inspector](../scripts/Inspect-EditorPythonStub.py) passed [16 synthetic checks](../research/evidence/editor-source/stub-inspector-offline-validation.json) and extracted the actual generated file without importing it. It preserves source hash/stat/line provenance, missing classes and truncations. This successful text extraction supersedes the need for the fallback collector for already-captured declarations.
