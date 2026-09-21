# Bounded editor source export and lookup: observer initialization

**Latest actual result, 2026-09-21:** the approved user-assisted helper run **completed successfully**. [Verified source/default result](../research/OBSERVER_CALLER_NATIVE_RESULT.md) identifies the parent but finds no factory call in this candidate. **Do not rerun the helper.** Its once-only approval is fulfilled. The follow-up reference lookup below is the remaining proposed editor action; it was not performed by this run. Earlier pending/export-access text is historical and superseded for current execution status.

**Current authorization/access update, 2026-09-21:** the user explicitly approved running `Inspect-ObserverCaller.py` once in the existing editor. That approval persists; do not ask again for this exact action. The [execution-attempt receipt](../research/OBSERVER_CALLER_EXECUTION_ATTEMPT.json) records a screen-capture failure after one recovery retry (`SetIsBorderRequired failed: No such interface supported (0x80004002)`) and title-only accessibility. The helper was **NOT_EXECUTED** by the assistant. A user-assisted File > Execute Python Script action, or recovery of supported editor UI access, can perform the already approved step. Asset creation/cooking/deployment/gameplay remain outside this approval. The preparation-stage authorization wording below is historical.

Prepared **2026-09-21 UTC**. **PROPOSED; NOT_PERFORMED.** This worksheet specifies the next source action after [the static preparation](../research/PASSIVE_OBSERVER_PREPARATION.md). New authorization is required for editor interaction under the project's current handoff. It does not authorize Play, asset authoring, compile/save, cooking, installation or retail-game launch.

## Question and exact existing target

Who calls `AddPlayerControllerComponents` on `/Game/Objects/_common/MW5PlayerController`, and why would that caller see a newly cooked `PlayerControllerComponentDataAsset_C` instance at the correct point in controller/world initialization?

The function body has already been exported and reviewed. Its source is `research/evidence/editor-source/ai-research-collection-20260921T030437Z-f7d8e930/010-MW5PlayerController-source.COPY:1444-1741`. Reopening it is only for reference navigation, not a request to collect its body again.

## First action: export one missing candidate

The installed `/Game/Modes/InstantAction/InstantActionPlayerController.InstantActionPlayerController` is an exact, uncollected candidate. [The fresh pin](../research/PASSIVE_OBSERVER_CALLER_ASSET.json) records 53,635 bytes and SHA256 `7107745A8DE461275A7ACFA1F3FFC5BE9BCB7002682C37B7705AF5F00783E4F6`. It does not prove this is a subclass or the mission controller.

After explicit approval for this source-only editor step, use **File > Execute Python Script** in the existing official editor and select:

`C:\Users\jlewi\OneDrive\Documents\ChatGPT\MW5 LANCEMATE COMPANION\scripts\Inspect-ObserverCaller.py`

The helper targets that one asset and its associated class defaults/metadata. It writes a fresh evidence folder under this project's `research/evidence/editor-source`; it does not recollect the API reference or traverse dependencies. Unreal may load dependencies and regenerate normal editor data as part of a native load/export; those calls are synchronous and the helper cannot preempt a hung native operation. It does not call asset save/compile, Play, cook, deployment or game-control APIs.

Review the real export receipt, identity, source/defaults and hashes after completion. Then trace its parent and connected initialization, treating an absent factory call as only a result for this one asset. An unrelated menu controller is a valid negative finding. The helper's 29 independent fake-API checks pass under Python3.12.14 and remain MOCK_ONLY; standalone editor Python3.7.7 has syntax-only validation. Neither establishes successful native export. Its review receipt is [PASSIVE_OBSERVER_HELPER_REVIEW.json](../research/PASSIVE_OBSERVER_HELPER_REVIEW.json).

## Follow-up reference lookup if the export does not resolve the caller

1. Use the existing official editor, if available. Confirm the selected mod and current build without changing either. Record the initial selection so it can be left as found. If the editor is unavailable, do not start another instance under this worksheet without authorization covering launch.
2. Open the exact existing controller asset. Select `AddPlayerControllerComponents` and use the editor's reference-search facility. Record whether the search covers this Blueprint, loaded/indexed Blueprints, or all indexed Blueprints. Do not mistake unindexed or excluded assets for a complete negative result. Do not start a broad reindex/load sweep to obtain an empty result without recording its additional scope first.
3. For each direct positive call-site result, record the caller's full asset/function/event path and connected execution path, including controller target, authority/mission conditions, old/new-pawn initialization and repeat-call conditions. A name in a variable, definition or editor-history entry is not a call.
4. Inspect only that caller's immediate lifecycle source and the registration scan it invokes. Establish whether the data assets are real instances of the expected generated class, when they become visible, and whether the new mod's namespace is included. Record unknown native boundaries explicitly. Do not insert a new call or alter stock assets as a diagnostic.
5. Preserve a source export or screenshot of the actual positive call site and exact location in a new project-local evidence folder. Any script/export step must be specified against the discovered asset before execution; no old broad collector is part of this worksheet. If the UI cannot produce the required evidence, record that limitation.
6. Leave the source asset, active mod, game settings and native controller unchanged. Record files deliberately written as evidence and normal editor cache/log side effects separately. Do not save incidental source-asset changes. A source lookup has no deployed probe to remove.

## Review outcomes

| Outcome | Meaning and next step |
|---|---|
| Connected caller found with adequate registry/lifecycle evidence | OBSERVED source contract; prepare the smallest component/registration-instance/widget authoring plan with exact new package paths and references. Cooking/runtime remain untested. |
| Caller found but crosses unresolved native or registry boundary | PARTIAL; name that exact boundary and prepare a creation-only experiment for separate approval. |
| No caller found in bounded indexed scope | UNKNOWN/BLOCKED; preserve search/index limits. Do not infer that registration is impossible or automatic. |
| Editor/reference navigation unavailable | NOT_PERFORMED; user-assisted source export or another supported inspection method is needed. |

No runtime success criteria can pass during this lookup. A subsequent creation-only test would first establish registry presence, owner/world identity and exactly one component/widget instance before adding AI telemetry. Passive retail observation and one-AI order control retain their separate deployment/launch approvals.
