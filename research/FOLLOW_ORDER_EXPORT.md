# Next source inspection: follow-order receiver

Prepared 2026-09-20 for installed editor 1.1.390.0e / UE4.26.2. **READY_FOR_USER_RUN; native execution NOT_PERFORMED.** The earlier two UI exports remain completed and reviewed in [the source review](BLUEPRINT_EXPORT_REVIEW_2026-09-20.md).

In the existing editor choose **File > Execute Python Script** and select [Export-FollowOrderSources.py](../scripts/Export-FollowOrderSources.py). It writes a new `research/evidence/editor-source/follow-order-export-<UTC>-<suffix>/report.json` and available text exports. Codex can read them directly; screenshots are unnecessary if the exports contain the needed source.

| Exact package | Source question | Installed bytes / SHA256 rechecked 2026-09-20 |
|---|---|---|
| `/Game/Modes/MissionDirectorSystem/MissionComponents/SquadOrders/FollowOrder` | How is the follow job issued? | 17308 / `682F83F7D2EA606C56BE6935A4397774622602DAFB848C0FCDFD9DE083A6D932` |
| `/Game/Modes/MissionDirectorSystem/MissionComponents/SquadOrders/SquadOrderBase` | How are recipients resolved and orders delivered? | 212408 / `F9D840728B40CD70DC5C145FE7FABA40D197E60EC48F9EA46E4500CD3CEE531F` |
| `/Game/AI/Jobs/Ally_FollowJob` | Which actor is followed, and what initializes the job? | 219221 / `92F889B72D31642985249D58BE8E80A2D6AA7C4839CD882DD656774D51C5073C` |

Installed files are under `C:\Program Files\Epic Games\MechWarrior5Editor\MW5Mercs\Content`. Exact references and prior evidence are in [the order audit](EDITOR_ORDER_SOURCE_AUDIT.md), including its follow-target subsection. Asset existence is verified; loaded editable Blueprint objects are not yet verified. A loaded generated class alone does not establish the latter.

This new helper preserves the original two-asset helper unchanged. It uses the same installed `find_asset` / `ObjectExporterT3D` / `AssetExportTask` APIs already demonstrated by that export. It finds only the three exact loaded Blueprint objects, with redirect following disabled. Missing assets are recorded and skipped without loading them. It does not save, compile, execute graphs, create a mod, start Play or control the game.

Unexpected exporter metadata, native failure, exporter error messages, missing output, invalid text, excessive inspection size or missing graph markers stop the remaining batch. Outputs and failures are retained in unique directories. It requires 1 GiB free before and between exports and checks a cooperative 30-second limit between assets. Native synchronous calls still have **no enforced time, memory or output-size bound**; the 8 MiB cap applies only to subsequent reading.

[Seven focused offline checks](evidence/editor-source/follow-export-validation-20260921T022956Z-b59f5be9/summary.json) passed under bundled Python 3.7.7. They use the prior strict fake API and cover exact paths, all/none loaded, missing first/middle, exporter-reported error, false native result and absent graph markers. Classification: **MOCK_ONLY**. Receipt helper SHA256: `02418831BFF8B186D269EE22961A2629EB8387C62CDD73EAEF2E4E93F922BB0B`. Independent read-only review found no material blocker and confirmed the recorded hashes. Native execution and graph coverage remain unverified.

After execution, inspect the receipt and recompute output hashes before tracing source FunctionGraphs, nodes and pin links. Distinguish source bodies from auxiliary expanded graphs. Report missing/native boundaries exactly; references and successful exports are not order acceptance. Inherited UI initialization (`Dpad_ActionLogic` / `Dpad_FunctionLib`) remains a later named batch, not included here. Shipping transport, live current-AI ownership and human supersession remain unresolved.
