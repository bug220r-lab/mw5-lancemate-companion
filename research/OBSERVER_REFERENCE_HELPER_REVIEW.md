# Independent fake-only reference-helper review

Reviewed **2026-09-21 UTC**. **PASS_MOCK_ONLY: 47 cases passed, zero failed**, using the editor's bundled standalone **Python 3.7.7** interpreter. The review did not import `unreal`, operate the editor, read installed game assets, or execute a native registry query. These results establish synthetic behavior only.

- Production helper: [Inspect-ObserverReferences.py](../scripts/Inspect-ObserverReferences.py), unchanged during the test run; SHA256 `20C460FDF678DE74568C477B28C41A65408A5B5C7868BC1BB893D05CECED099B`.
- Independent suite: [Review-ObserverReferences.py](../scripts/Review-ObserverReferences.py); SHA256 `64EB03B71B19785F4F317052D0D3C2FCC93AD9C808F67645E12377116E33E1A5`.
- Detailed [JSON receipt](OBSERVER_REFERENCE_HELPER_REVIEW.json); SHA256 `C9EE8ADB3A4EF14DE7C0DEC200B34A16EE0A7E15BEC9E5FD0103F93F7033AD20`.
- Retained synthetic fixture root: [observer-reference-helper-review-20260921T052904Z-448a59e323](evidence/editor-source/observer-reference-helper-review-20260921T052904Z-448a59e323/). All fake output directories are nested beneath it, never directly under the native evidence root.

The suite checks exact three-package query order and option values through a strict fake exposing only the reviewed metadata APIs. It verifies hash/scope preflight rejection before API use; source mutation detection; active/stale/foreign lock handling; loading-state stops before and after a query; distinct `None` and empty results; per-target and aggregate caps; duplicate retention/counting; malformed, oversized and Unicode names; native-call exceptions; resource/time/STOP guards; and final JSON-size enforcement. It also checks persisted report equality, scope labels, source-hash results and owned-lock cleanup.

Two issues identified during initial static review were corrected by the implementing agent before execution of this suite: malformed package paths are rejected, and lock ownership checks use a bounded binary read so a replaced non-ASCII lock is preserved without masking completion. This reviewer did not modify the production helper.

The large Unicode fixture retains **1,024 entries** in a **793,921-byte** final JSON report, within the fixed 1 MiB ceiling. A separate deliberately reduced report limit correctly rejects the final write and preserves started/checkpoint evidence; an external reader must not assume that every partial run has a final `report.json`. Duplicate entries are intentionally retained and counted; `total_retained_entries` is not a unique-package count.

Limits remain: native calls are synchronous; Python cannot preempt their execution or prevent their initial native allocation. Source drift during a query is detected by final pin verification, after the bounded metadata queries; this is not a continuously locked source snapshot. Registry completeness/currency, runtime API behavior, package-reference meaning, factory invocation, cooked visibility and gameplay are **NOT_PERFORMED by this review**. The [API review](OBSERVER_REFERENCE_API_REVIEW.md) defines the separate evidence and interpretation boundaries.
