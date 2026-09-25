# Overnight observer handoff — September 25, 2026

**Outcome: offline diagnosis and a staged morning continuation are ready. The missing overlay is not fixed; its cause remains unresolved.** The user closed the game and asked for preparation while asleep. No editor/game launch, source-asset edit, retail change, deployment, settings change or paid call was performed during this preparation.

Morning entry point: [Small diagnostic control](../design/OBSERVER_DIAGNOSTIC_CONTROL_MORNING.md). Begin with a static input-triggered marker in a separate temporary control mod. Manual editor authoring is still required; unattended Blueprint authoring is not established. Component enumeration is deferred until that independent output is visible.

## Completed evidence

| Work | Result | Practical limit |
|---|---|---|
| [Native package review](OBSERVER_PACKAGE_RESULT_2026-09-25.md) | Original package completed at 05:52:43 UTC, native exit 0; all three intended assets included | Packaging is not game acceptance |
| [First retail observation](OBSERVER_STARTUP_RESULT_2026-09-25.md) | User reached Instant Action; no overlay then or earlier, per screenshot and user answer | `INCONCLUSIVE_READOUT_NOT_VISIBLE`; component absence not established |
| [Structured cooked registry review](OBSERVER_COOKED_REGISTRY_REVIEW_2026-09-25.md) | All 2,447 bytes parsed; three records; registration class `PlayerControllerComponentDataAsset_C` matches stock factory filter | Does not establish shipping mount/merge, load/cast or the loaded registration's property values |
| [Independent graph audit](OBSERVER_STARTUP_GRAPH_AUDIT_2026-09-25.md) | Five export hashes matched; 49 nodes, 172 pins and 58 reciprocal connections checked; no demonstrated wiring/default defect | Actual execution, native helper timing and final UI visibility remain unknown |
| [Diagnostic route comparison](OBSERVER_SHIPPING_DIAGNOSTIC_OPTIONS_2026-09-25.md) | Selected separate stock-controller substitution plus input-triggered static UMG control | Proposed changed configuration; not authored, installed or executed |
| [Preservation checkpoint](OBSERVER_OVERNIGHT_CHECKPOINT_2026-09-25.json) | Eight pinned editor files, three package files and three installed files all match; package/installed folders each contain exactly three files; game/editor processes absent | Point-in-time observation; refresh before future authoring or testing |

The registration record's class/path result rules out a demonstrated mismatch in that stored record. The source audit does not support speculative Auto Activate, parent BeginPlay, controller-cast or text-reset repairs. Native startup, component creation, owner selection and UI behavior remain separate unresolved stages.

## New offline tool and validation

[Inspect-CookedObserverRegistry.py](../scripts/Inspect-CookedObserverRegistry.py) is a project-authored, standard-library-only reader pinned to this exact cooked registry. It uses a documented serialization schema from a fixed CUE4Parse source commit; no downloaded source was executed or installed. It is intentionally not a general Unreal reader.

Both the author run and the coordinator's independent rerun passed the identity/coverage checks and rejected **2,606 malformed in-memory inputs**, including all 2,447 proper prefixes and 80 invalid FName-index cases. This is `OFFLINE_PARSER_VALIDATION_ONLY`.

- [Author receipt](OBSERVER_COOKED_REGISTRY_REVIEW_2026-09-25.json)
- [Independent receipt](evidence/retail-observer/startup-observation-20260925T061051Z/registry-independent-review.json)

No further parser testing is needed without a changed reader, changed evidence or a new concern. These checks cannot validate shipping behavior.

The coordinator checked all 36 local links across the five new reports/plans, both registry receipts against the current reader hash, Python syntax and the preservation checkpoint: PASS. A second review found no must-fix issue in the staged morning plan; its minor template-reference wording was corrected. This is document/offline validation only.

The parallel task's read-only review additionally tightened the deferred enumeration plan: data bounds do not prove all text fits; locality does not prove the helper's selected-controller identity; and the original overlay must be observed again under the changed control configuration. Those guards are now explicit in the morning guide and diagnostic report.

## State left for morning

The original mod remains installed and enabled in the saved configuration; it was not disabled or replaced overnight. Retail metadata still identifies **1.14.390 / CL456620**. Three source assets and the original local package remain intact. The preservation checkpoint identifies all paths, lengths and hashes.

Byte copies of the current enabled-mod list and the two-byte user Input.ini are under `research/evidence/retail-observer/overnight-preparation-20260925T062742Z`. They are **post-enable/post-test** snapshots, not an original mod-off baseline. Default/native input bindings are not resolved by that small Input.ini. The prepared plan leaves the control's key/chord unassigned until actual bindings are checked.

The initial checkpoint collection looked for game_info.xml under MW5Mercs and stopped because that path did not exist. A narrow root lookup located the actual retail-root file; the successful checkpoint reread all 14 pins and that exact metadata. No assets/settings were changed in either collection.

There is no attributable shipping log in the previously checked locations for the first attempt. The earlier editor log predates that game process and must not be used as its failure evidence. Do not redo the completed source exports or registry collection without a concrete new question.

## Next decisions and boundaries

The morning guide deliberately separates a small **static-output Phase A** from later component enumeration. A new stock override and input action are more intrusive than the original registration-only probe. Their actual authored manifest, input choice, package review, disposable baseline, finite stop conditions and rollback must be ready before a future deployment decision. Preparation alone does not establish this new runtime test's authorization or success.

No cause-backed correction was found to apply autonomously to the original Blueprint. Reliable native UI control and executable Blueprint authoring were not available; no binary asset rewriting, blind UI attempt or unproven commandlet workaround was used. The useful completed work is the structured metadata decoder, independent source audit, preserved state and concrete next experiment.

The parallel raw-passive-capture work belongs to **Plan parallel MW5 work** and remains offline. Its owner reports commit/push `a10faa53c7c08edf8b388defdf26992848fdcbb1` and 1,357/1,357 MOCK_ONLY checks; this observer preparation did not independently rerun that separate suite. Its files were not altered or committed by this observer preparation. Shared README/NEXT updates are coordinated with **Review overnight package handoff**. Local evidence/raw logs and authored binaries remain outside the source-only Git scope; no new observer Git commit or remote publication is claimed by this handoff.
