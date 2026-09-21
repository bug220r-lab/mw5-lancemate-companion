# Single-controller source export: verified result

Reviewed **2026-09-21 UTC**. **PASS_EDITOR_SOURCE_EXPORT.** The approved user-assisted run completed and produced genuine editor source/default exports. Observer initialization remains **UNKNOWN/BLOCKED**; observer assets remain **NOT_BUILT**, and gameplay/cooking/deployment remain **NOT_PERFORMED**.

## Verified export

The [unaltered native receipt](evidence/editor-source/observer-caller-20260921T044217Z-54302cc3f1af/report.json) reports `COLLECTED_REQUIRES_REVIEW`, two successful export returns and no errors. The helper reports 1.25 seconds; that is export timing, not a gameplay-performance result. [Independent review](OBSERVER_CALLER_NATIVE_REVIEW.md) and [verification data](OBSERVER_CALLER_NATIVE_RESULT.json) retain the identity, hashes and limits.

| Artifact | Verified result |
|---|---|
| Named Blueprint | `/Game/Modes/InstantAction/InstantActionPlayerController.InstantActionPlayerController` |
| Source export | [source.COPY](evidence/editor-source/observer-caller-20260921T044217Z-54302cc3f1af/source.COPY), 83,932 bytes, 468 lines; SHA256 `6690E8C5A192D28CC15F84798C6E053FE3F543728F7AECEE0F2CE81968C6A0FD` |
| Class defaults | [defaults.COPY](evidence/editor-source/observer-caller-20260921T044217Z-54302cc3f1af/defaults.COPY), 9,087 bytes, 235 lines; SHA256 `FA10C21C165E2AB68A2D7C841C413909FC3FF04B58097D1A15B710C2CBEDF7C0` |
| Helper | Matches reviewed SHA256 `B99B1B05375BE98AF1160C9C2CCB3474AF80EB97AA673EA492130D83386D0FA0` |
| Installed asset | Matches pinned SHA256 `7107745A8DE461275A7ACFA1F3FFC5BE9BCB7002682C37B7705AF5F00783E4F6`; receipt reports unchanged after export and the review rechecked it |
| Output classification | Direct-child native run `observer-caller-20260921T044217Z-54302cc3f1af`; not one of the nested MOCK_ONLY fixtures |

The inspector lock is absent. There is no reason to rerun this completed export. The earlier [UI-access attempt](OBSERVER_CALLER_EXECUTION_ATTEMPT.json) is retained as historical evidence and is superseded for execution status by this user-assisted result.

## What the new source establishes

**OBSERVED:** the parent is `MW5PlayerController_C` directly (`source.COPY:421`), not `MW5PlayerControllerDerived_C`. The two registered function graphs are `UserConstructionScript` and `CheckAndShowPostMissionScreen` (`424-426`).

The construction script's only connected action is a parent construction call (`109-128`). The already collected parent source, [010-MW5PlayerController-source.COPY](evidence/editor-source/ai-research-collection-20260921T030437Z-f7d8e930/010-MW5PlayerController-source.COPY), has an entry-only construction graph at `7402-7412`, with no link from its `then` pin. This construction chain supplies no component-factory caller.

The exported event graph contains two disconnected `bShowPostMission` setters (`82-108`). Its other connected override handles post-mission/Instant Action screen behavior (`129-238`). No `AddPlayerControllerComponents` reference occurs in this new source. The additional serialized `EdGraph_0`/`EdGraph_1` forms also supply no factory call; they are not extra registered initialization functions.

The defaults select `InstantActionUIScreensComponent_C` (`defaults.COPY:76`). Defaults such as null pawn/component references are class-default data, not observations of a running controller. Neither inheritance nor the asset's name proves which controller is instantiated in an actual mission.

## Remaining question and next bounded step

This closes the missing-source question for this one candidate. It does **not** establish automatic registration or prove that the factory is never called elsewhere. Inherited, native, dynamic and uncollected callers remain possible.

The next useful source action is the [bounded reference lookup](../design/PASSIVE_OBSERVER_SOURCE_LOOKUP.md) for `MW5PlayerController.AddPlayerControllerComponents`, with explicit indexing/search limits, followed only by a positive call site or exact controller-assignment reference. The earlier source helper should not be run again. The once-only approval has been fulfilled; further editor operations require scope covering that additional action. No additional export or editor lookup was executed while reviewing these files.

The baseline 249-entry overnight ledger and its test receipts remain unchanged historical artifacts. This separate one-asset result does not expand those original coverage claims. No tactical tests were rerun because their inputs and implementation were unchanged.
