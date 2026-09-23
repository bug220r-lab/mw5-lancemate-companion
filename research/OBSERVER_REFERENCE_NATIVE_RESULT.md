# Observer reference lookup: verified native metadata

Reviewed **2026-09-23 UTC**. **PASS_EDITOR_REFERENCE_METADATA.** The user-assisted revised helper completed all three bounded registry queries. This produced reference candidates; the factory caller, actual controller assignment, observer startup and cooking remain **UNKNOWN/BLOCKED**. Do not rerun this completed helper.

## Attributable result and verification

The user confirmed running the revised script. The [preserved editor log](evidence/editor-source/observer-reference-native-evidence-20260923T034135Z-e88436f813fc/editor-log-snapshot.log:1130) records its exact invocation at **03:38:12.240Z** and successful completion message at **03:38:12.322Z**, naming the new output directory. The original six JSON files remain unchanged in [observer-references-20260923T033812Z-a2542db9f0e4](evidence/editor-source/observer-references-20260923T033812Z-a2542db9f0e4/report.json).

The [independent native receipt review](OBSERVER_REFERENCE_NATIVE_REVIEW.md) and the coordinating task's separate read-only audit agree:

- Exactly three queries in the prepared order, with hard/soft package references enabled and searchable/management references disabled.
- `COLLECTED_REQUIRES_REVIEW`, `EDITOR_METADATA_ONLY`, no errors, registry loading false before and after each query, and no truncation.
- **31, 2 and 4 entries** respectively: **37 retained entries, 35 unique package names**. Counts include three self-reference entries; duplicate names across different target lists remain attributable to those targets.
- The four checkpoint stages and counts **0, 0, 1, 2** match the helper's sequence. All six files total **9,978 bytes**, within the reviewed limits.
- Helper **12,417 bytes / SHA256 `ADC2DA144E2648C8FCBE7DF42667A76BF7BD258ACE455D0105B27A3FEA717A63`**, all three installed target hashes/sizes, recorded source-before/source-after and started/final receipt identities agree. These are before/after observations, not continuous locks on editor memory.

The final report SHA256 is **`55CA5794BBDB2F84A7F28A5B8EEF56B8CCEA1664BF24E21B5C91D020856CAF0A`**. The preserved 124,043-byte log snapshot SHA256 is **`7608E3291615073BF2FACECFD0B10B256106853AF143F0A3D992E3CB7795F770`**; it remains local raw evidence pending content review before sharing.

The helper reports **0.031 seconds** elapsed and a last health sample of **22,850,129,920 bytes disk**, **1,546,854,400 bytes available RAM**, and **4,884,299,776 bytes available commit**. These describe this metadata lookup, not editor-startup cost, peak memory, gameplay performance or future admission.

## What the candidate lists establish

| Queried package | Entries | Bounded interpretation |
|---|---:|---|
| `/Game/Objects/_common/MW5PlayerController` | 31 | Broad set of controller-related package references; includes already collected controllers/components and uncollected UI, mode and other packages. No connected caller is established by this list. |
| `/Game/Modes/InstantAction/InstantActionPlayerController` | 2 | Itself and **`/Game/Modes/InstantAction/InstantActionMode`**. The latter is the only non-self result and the smallest new controller-assignment lead. |
| `/Game/Objects/_common/Components/PlayerControllerComponents/PlayerControllerComponentDataAsset` | 4 | Itself, the already collected controller, `PlayerControllerFeedbackDataAsset`, and `PlayerControllerAirStrikeDataAsset`. The new names alone establish neither instance/type details nor runtime registration. |

The Instant Action mode appears at [raw report line 105](evidence/editor-source/observer-references-20260923T033812Z-a2542db9f0e4/report.json:105). This relationship is not yet a `PlayerControllerClass` assignment or an `AddPlayerControllerComponents` call. Positive package metadata narrows source inspection; even this successful lookup does not certify the registry as exhaustive, current for unsaved changes, or shipping-equivalent.

## Existing source reused and one missing source selected

Six of the 35 unique candidates already have source/default exports: `MW5PlayerController`, `MW5PlayerControllerDerived`, `PlayerControllerComponent`, `PlayerControllerComponentDataAsset`, `PlayerControllerSwitchMech`, and `InstantActionPlayerController`. The first five are entries 010, 011, 238, 239 and 240 of the [AI collection](evidence/editor-source/ai-research-collection-20260921T030437Z-f7d8e930/report.json); the sixth is the [completed one-controller export](OBSERVER_CALLER_NATIVE_RESULT.md). Their completed collection must not be repeated.

The other 29 candidates are absent from that reviewed source set. `ControllerFeedbackComponent`, `PlayerControllerAirStrikeComponent` and `MWPlayerCameraManager` previously had dependency-only records; those did not contain their source. None of this justifies exporting the whole list.

`InstantActionMode` is absent from the prior 249-entry AI and 18-entry mod collection allowlists/receipts, and no exact name hit was found in their existing source/default exports. Its [observed installed file](OBSERVER_MODE_ASSET.json) is **229,443 bytes**, SHA256 **`1C841BF1C5198B57499F2F872CBABCF3F1F38508054AB8695FCD2F6C41E4F17B`**. Only this returned package is selected for the [next one-asset source/default lookup](../design/OBSERVER_MODE_SOURCE_LOOKUP.md). No parent, UI package or data-asset instance is included automatically.

## Preserved limits and next outcome

The [earlier initial resource stop](OBSERVER_REFERENCE_NATIVE_ATTEMPT.md), original helper snapshot, raw log and diagnostic review remain unchanged. Its failure-time resource/value are still unknown. This later success does not rewrite that attempt or satisfy the separate automated-supervisor/desktop gates.

The mode lookup's separate [independent review](OBSERVER_MODE_HELPER_REVIEW.md) passed **67/67 MOCK_ONLY cases**. Its [preparation manifest](OBSERVER_MODE_PREPARATION.json) fixes one asset and the reviewed helper; the coordinator must refresh source/resource checks before arranging a user-assisted run. The mode's native export remains **NOT_PERFORMED**. Inspect its actual controller default/assignment, parent identity and connected initialization paths; then stop for review. If the boundary is in another source or native implementation, name that exact unresolved boundary. No observer assets, descriptor, save/compile/cook, deployment or gameplay action follows from this metadata result.
