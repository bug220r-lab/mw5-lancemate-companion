# Consolidated editor source collection

**Completed native run:** [result and coverage](COLLECTION_RESULT_2026-09-20.md), [actual receipt](evidence/editor-source/mod-research-collection-20260921T023909Z-5eeaf52a/report.json). All eighteen assets collected, zero reported errors; sixteen new exports plus two reused. The API text snapshot also completed. The preparation instructions below are historical; no repeat run is needed. Semantic review of the new exports remains pending, and all gameplay tests remain NOT_PERFORMED.

Prepared 2026-09-20 in response to the user's request to gather the mod research data in one go. **PROPOSED source collection; native run NOT_PERFORMED.** This replaces the pending three-file handoff. Earlier exports, receipts and helpers remain preserved.

## One user action

In the existing editor, use **File > Execute Python Script** and select:

```text
C:\Users\jlewi\OneDrive\Documents\ChatGPT\MW5 LANCEMATE COMPANION\scripts\Collect-ModResearch.py
```

Leave that editor running. The helper schedules one named asset per editor callback and writes `progress.json` as it proceeds. Final output is `research/evidence/editor-source/mod-research-collection-<UTC>-<suffix>/report.json`. Codex can inspect the folder directly. There is no need to open individual Blueprints or capture each graph. A second launch while this collection is active reports the same output directory instead of scheduling a duplicate.

## Exact coverage

The [reviewed manifest](COLLECTOR_ASSET_SCOPE.json) pins **18 installed assets** by exact package/object path and SHA256, with reasons and evidence pointers: two previous exports reused after hash checks, plus sixteen new source exports. Expected types are fourteen Blueprints, three behavior trees and one blackboard. Those type names are validation targets, not observed native export results. The installed files total 4,112,820 bytes; this does not estimate their memory footprint, dependency size or text-export size.

The scope covers the Form On Me UI and dispatcher, follow-order receiver/shared base/job, inherited action initialization, lance UI/manual-order leads, player/AI controller leads, follow/team-order/master behavior trees and blackboard, and position/health-display leads. A health display is not automatically the commanded AI's health.

The collector also records up to 512 direct on-disk dependency names per selected package and snapshots the existing generated Unreal API reference as **text**. It does not import or execute that reference. Dependencies are names for offline analysis, not executed graph edges or an instruction to load further assets. There is no registry-wide scan or recursive dependency traversal. The complete generated declarations can answer additional API questions offline without repeatedly asking the user for menu actions.

Unlike the earlier loaded-only probes, this helper may **load these exact named source assets** when absent from memory. That is part of the requested consolidated source inspection. Unreal may load their hard dependencies and perform normal editor regeneration/cache/shader work. No explicit save, compile, Play, cook, mod creation, gameplay command, external request or paid API is called. It does not change retail files, saves or load order.

## Limits and interpretation

Resource checks occur between operations: require 2 GiB disk free, 768 MiB available physical RAM and 1 GiB available commit; stop at a cooperative 600-second elapsed limit or 128 MiB recorded output. These are conservative project choices, not guaranteed safe engine thresholds. Individual export reading is limited to 16 MiB and the API snapshot to 64 MiB. **A synchronous native load/export cannot be interrupted by these checks and may temporarily exceed those budgets.** Loading can leave more editor assets resident after the script stops.

Each asset is checkpointed before loading/exporting, failures and partial output are retained, and callbacks are unregistered at completion/stop. Creating a file named `STOP` in the active output folder requests cancellation at the next boundary; it cannot interrupt a native call already underway. All writes stay in a unique project evidence folder. Actual export text reflects in-memory source; unchanged on-disk hashes do not rule out unsaved editor changes.

Missing objects, dependency-query incompleteness and source drift are recorded. Errors stop further native work. A finished collection means the planned inspection attempts finished; it does not imply every source was available, every text export contains a complete graph, or any research contract passed.

This is the broadest concrete source snapshot justified by the known questions, **not all evidence the eventual mod will ever need**. Unavailable native C++ bodies, current AI ownership/authority, manual supersession, actual order acceptance, shipping transport and gameplay/performance still require further source or separately authorized isolated execution. Voice, campaign persistence and autonomous behavior are not added by this collection.

## Source/API basis

The installed `C:\Users\jlewi\AppData\Local\MW5Mercs\Intermediate\PythonStub\unreal.py` supplies: find/load asset at lines 66–76; Slate callback registration/removal at 998–1007; AssetRegistryDependencyOptions at 39209 onward; registry acquisition at 112606; dependencies at 112763; registry lookup at 112877; exported classes Blueprint at 182709, BehaviorTree at 250144 and BlackboardData at 250599. ObjectExporterT3D/AssetExportTask already worked for the two retained UI assets; coverage for the new types remains untested.

Epic's [AssetRegistry Python reference](https://dev.epicgames.com/documentation/en-us/unreal-engine/python-api/class/AssetRegistry?application_version=4.27) corroborates the on-disk dependency query. Accessed 2026-09-20; that page describes 4.27, while installed declarations are the authority for this 4.26.2 fork. Independent review checked the actual installed signatures and identified a relative-path defect, repaired before any editor run. No native action occurred during preparation.

## Preparation validation

[Seventeen focused checks passed](evidence/editor-source/collector-validation-20260921T023803Z-c6c6639a/summary.json) under bundled Python 3.7.7 with `-B`, using [Validate-ModResearchCollector.py](../scripts/Validate-ModResearchCollector.py). The fake Unreal API exposes only the expected research methods. Checks cover exact typed loads, no redirects, three asset types, reuse from a different working directory, missing/changed sources, resource stops before and after loading, retained partial output, time/STOP boundaries, callback cleanup/duplicate prevention and passive reference copying with an execution sentinel. The real eighteen installed file hashes and pinned manifest were also read-only verified. Native export and callback validation remains **MOCK_ONLY / NOT_PERFORMED**.

Validated collector SHA256: `21253740455E22DB7C283D4FCA7B1B07D6D0848E845FAC880DD284BBC5215743`. Manifest SHA256: `034B18A7134DCFD6A2BDB1CC021C2BA5F431E1FEBA185D556C508DD3479D8AA3`. The read-only Windows resource query succeeded during preparation with about 2.58 GiB available physical RAM and 11.74 GiB free disk at that moment; the helper rechecks before work. Actual native export, callback behavior, resource cost and graph completeness remain NOT_PERFORMED. **Ready for its first user-started editor collection run.**
