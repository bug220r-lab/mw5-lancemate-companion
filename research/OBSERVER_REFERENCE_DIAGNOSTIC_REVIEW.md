# Independent resource-stop diagnostic review

Reviewed **2026-09-23 UTC**, with standalone **Python 3.7.7**. Result: **PASS_MOCK_ONLY, 69/69** — the original **47/47** regression cases against the changed helper, plus **22/22** independent diagnostic/scope cases. Native helper, editor and game execution, and installed-asset reads were **NOT_PERFORMED**.

The [new summary receipt](OBSERVER_REFERENCE_DIAGNOSTIC_REVIEW.json) and [immutable run receipt](evidence/editor-source/observer-reference-helper-review-diagnostics-20260923T024347Z-2cf44c99ea/diagnostic-review-receipt.json) have the same SHA-256: `e5265f795e4b448f9fe9afcd967cc54938f6257ed6e75624d61fecc48ff609d9`.

## Reviewed change

Only the resource exception body changed. The comparisons at `scripts/Inspect-ObserverReferences.py:116–117` are unchanged: stop below **2,147,483,648 bytes disk**, **805,306,368 bytes RAM**, or **1,073,741,824 bytes available commit**. Equality remains accepted.

The exception at lines **120–125** now starts with `RESOURCE_STOP ` followed by compact JSON containing the exact three `observed_bytes`, unchanged `minimum_bytes`, and `failed_fields`. Extra health fields are excluded. This adds no native API call, query, filesystem write or output directory. It does not lower a limit or change the resource check's position before initial output creation.

An AST comparison against the byte-preserved original helper confirms that the resource guard and all executable code outside that exception body are identical. The original copy's hash matches `20c460fdf678de74568c477b28c41a65408a5b5c7868bc1bb893d05ceced099b`. Direct source review of the changed body confirms only dictionary construction, comparisons, JSON serialization and the exception.

## Independent checks

The 22 new cases cover each resource one byte below its minimum, exactly at and one byte above each minimum, all thresholds equal, each pair/all three failing, extra health-field exclusion, late stops for each resource/all three, and owned/foreign lock handling. Initial stops make **zero registry API calls and create no output directory**, while still reporting the exact injected values. Late stops retain the diagnostic in `report.json`, stop after the first query, preserve scope/source flags, and keep the saved report equal to the returned report. Owned locks are cleaned up; replaced foreign locks remain untouched.

The unchanged original 47 named cases were run through the reused `run_case` function without calling the original review's main function or canonical receipt writer. They continue to cover source/scope gates, exact query order/options, registry loading, null versus empty results, caps, invalid names, source drift, exceptions, cooperative stops, bounded JSON and lock preservation. All source files used by the diagnostic cases were synthetic fixtures or the project helper; no real Unreal API was imported.

## Source and historical identities

| Artifact | SHA-256 |
| --- | --- |
| Changed helper, **12,417 bytes** | `adc2da144e2648c8fcbe7df42667a76bf7bd258ace455d0105b27a3fea717a63` |
| New `Review-ObserverReferenceDiagnostics.py` | `1c94b4506ed35cd9133f86eac731edf113e5499226792a08fecf750244c1be97` |
| Original `Review-ObserverReferences.py`, unchanged | `64eb03b71b19785f4f317052d0d3c2fcc93ad9c808f67645e12377116e33e1a5` |
| Original 47-case JSON receipt, unchanged | `c9ee8adb3a4ef14de7c0dec200b34a16ee0a7e15bec9e5fd0103f93f7033ad20` |
| Original review Markdown, unchanged | `109f0a3fba3d398a283c27df7df036e7d8a95b807c9ccb8f945b6e6477b92ead` |

The changed helper and all three historical review artifacts were unchanged during the run. The old receipt still describes the old helper hash; this separate receipt covers the revised hash.

## Evidence restrictions

These are fake-API and synthetic-file results. They do not establish native timing, registry completeness, candidate references, observer startup/cooking or gameplay behavior. The earlier native `RESOURCE_STOP` remains a pre-query failure with **unknown failure-time resource values**; synthetic values and later snapshots cannot fill that gap. This diagnostic is intended to make a future stop interpretable. **No native retry was performed for this review.**
