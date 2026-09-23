# Observer reference lookup: initial resource stop

Reviewed **2026-09-23 UTC** (September 22 local time). **OBSERVED: the user invoked the prepared helper in the editor; its first resource check stopped before any registry query or native lookup report.** There are no new reference candidates. The observer startup caller and cooking path remain **UNKNOWN/BLOCKED**.

## Preserved evidence

The coordinating task relayed the user's confirmation, “Ran script.” The [unaltered editor log snapshot](evidence/editor-source/observer-reference-attempt-20260923T023927Z-de0b7365b363/editor-log-snapshot.log:1121) independently records the exact `Inspect-ObserverReferences.py` invocation at **02:34:25.361Z**, followed at **02:34:25.775Z** by `RuntimeError: RESOURCE_STOP`. The traceback follows the original helper's lines **234 → 140 → 118**. The snapshot is local raw evidence pending content review before sharing.

The [assessment](evidence/editor-source/observer-reference-attempt-20260923T023927Z-de0b7365b363/assessment.json) preserves the baseline, traceback, original script and target identities, absence of native output, and limits. The [original helper snapshot](evidence/editor-source/observer-reference-attempt-20260923T023927Z-de0b7365b363/Inspect-ObserverReferences.original.py.txt) retains the exact code that ran. Do not edit these records to reflect a later retry.

| Preserved artifact | SHA256 |
|---|---|
| Assessment | `B959E3834BBCB150614EECC648AC486FC96D0E513A551465AB1D8212A25B84E9` |
| Editor log snapshot, 123,638 bytes | `2972AA93AD83E61E02B516EA5D03F589EC99502FE470581F6F3F7960545B6834` |
| Original helper, 11,828 bytes | `20C460FDF678DE74568C477B28C41A65408A5B5C7868BC1BB893D05CECED099B` |

At **02:29:21.5854109Z**, the helper and all three target size/hash pins matched the original preparation manifest, neither lookup/caller lock existed, and no direct-child `observer-references-*` output existed. After the reported attempt, all four pins still matched; no direct-child lookup output or lookup lock existed. These are observed before/after checks, not continuous asset locks.

## What stopped and what did not happen

Independent source/log review confirms that the first `check()` preceded output-directory creation, registry acquisition and every `get_referencers` call. The original check stopped if **any** of the following was true:

| Resource | Stop below |
|---|---:|
| Free disk | 2,147,483,648 bytes (2 GiB) |
| Available physical memory | 805,306,368 bytes (768 MiB) |
| Available commit | 1,073,741,824 bytes (1 GiB) |

**UNKNOWN:** which resource failed and its value at the failure. The original initial check ran while `report` was `None`, so it did not retain the health values; the exception contained only `RESOURCE_STOP`. A later snapshot cannot identify the original failing field. The coordinator's separate **02:38:33.800Z** observation reported 0.951683 GiB available RAM and 21.331863 GiB free disk using Node `os.freemem`/`statfs`; commit was not measured. Both tasks' CIM attempts were denied, and no null-derived zeros were used as measurements.

The coordinator subsequently read the helper's `system_health` function without entering `main`, importing `unreal` or querying the registry. At **02:42:41.768879Z** it reported disk **22,903,336,960 bytes**, available RAM **1,956,855,808 bytes**, and available commit **5,215,027,200 bytes**. All three small-helper limits passed then. This is a separate later observation, not failure-time evidence, a future resource reservation or admission for the automated full-editor experiment.

Source-pin checks and creation of the helper's temporary owned lock had occurred. Its final cleanup removed the matching lock. There was no `started.json`, checkpoint or `report.json` because the lookup output directory had not yet been created. This is an attributable **native invocation aborted at resource precheck**, with **registry lookup NOT_PERFORMED**. Engine startup had its own activity; the helper's no-load/no-save scope does not describe the whole editor process.

## Narrow diagnostic correction

The current [helper](../scripts/Inspect-ObserverReferences.py) retains the original resource comparisons and now adds compact JSON to the `RESOURCE_STOP` exception: the three `observed_bytes`, unchanged `minimum_bytes`, and exact `failed_fields`. This makes an initial failure inspectable in the editor log and also preserves the same details in an existing report for a later stop. It adds no native API call, file, retry, scan, asset load or query. Unrelated health fields are excluded.

The [independent diagnostic review](OBSERVER_REFERENCE_DIAGNOSTIC_REVIEW.md) passed **69/69 checks, MOCK_ONLY** under standalone Python 3.7.7: all 47 original regression cases plus 22 diagnostic/scope cases. It verifies exact failure values and reasons, zero native-API/output activity on the initial stop, equality-at-threshold acceptance, later persisted diagnostics, owned/foreign lock behavior, and unchanged code outside the exception body. The current helper is **12,417 bytes**, SHA256 **`ADC2DA144E2648C8FCBE7DF42667A76BF7BD258ACE455D0105B27A3FEA717A63`**. The review receipt hash is **`E5265F795E4B448F9FE9AFCD967CC54938F6257ED6E75624D61FECC48FF609D9`**.

The [revised preparation manifest](OBSERVER_REFERENCE_DIAGNOSTIC_PREPARATION.json) binds this helper and its tests. The original 47/47 fake review and preparation manifest remain historical records of the original helper. These tests are not native success or an automatic-startup gate pass. The frozen supervisor status and both earlier supervisor failures remain unchanged.

The automated full-editor experiment still pins the original helper. Its manifest cannot be silently reused with the revised script; any future automated experiment needs its own explicit reviewed rebaseline as well as the unresolved native safeguards. The revised-helper manifest applies to the bounded user-assisted lookup only.

## Next bounded action

The coordinator verified the revised helper and all three target pins again at **02:44:41.203640Z**. Its separate OS-only health observation returned disk **22,897,582,080 bytes**, available RAM **1,906,171,904 bytes**, and available commit **5,191,524,352 bytes**; all unchanged helper limits passed at that moment. Following the 69/69 review, the coordinator instructed **one user-assisted retry**. Execution is awaiting a new user confirmation; it must not be inferred from that instruction. Keep model/voice work from competing with the editor. Preserve another resource stop or partial/loading result as its own outcome; do not lower thresholds, add scans or automatically retry.

The next useful evidence is either the revised helper's exact resource-stop diagnostic in the editor log, or an attributable new **direct-child** `observer-references-<timestamp>-<token>` receipt. Verify script/three-target hashes, exact options, ordered queries, loading flags, caps, errors, source stability and output bounds before following any returned package. Do not rerun completed source exports. This user-assisted path does not establish that the separately proposed automated supervisor/desktop prerequisites have passed.
