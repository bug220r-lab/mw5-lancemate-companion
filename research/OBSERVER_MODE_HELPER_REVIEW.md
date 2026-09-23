# Independent InstantActionMode helper review

**PASS_MOCK_ONLY: 67/67 synthetic cases passed.** Native editor/game execution, installed asset reads, actual Blueprint export, runtime creation and cooking are **NOT_PERFORMED**.

The review adapts the historical caller helper's 29 fake cases and adds 38 independent resource-boundary, diagnostic, cross-inspection and foreign-lock cases. Tests inject synthetic sources, health observations and a narrow FakeAPI. Source digest guards reject any installed/out-of-fixture asset read.

The static review checks the exact mode path/hash and generated/default identities, unchanged export logic and resource comparisons, and the permitted API call surface. The only prepared native scope is one named Blueprint source export and its checked class-default export. Parent metadata comes from exported text; no parent is loaded or exported.

Resource failures are checked before API access and after the first export; byte-exact thresholds, equality, multi-resource diagnostics and unrelated-field exclusion are exercised. Foreign non-ASCII, oversized and own-token-prefix locks remain intact, with cleanup reads bounded to 33 bytes.

| Artifact | SHA256 |
|---|---|
| `scripts/Inspect-ObserverMode.py` | `ad0eeb1e1fa73e55cee24f679c27ca3c5aa52c0abffc48f4f8d0e88b0f44ed29` |
| `scripts/Review-ObserverMode.py` | `9f201b51608d42be274b083d41613f91ad4e1b342720ced0a7fbcb1a4728e359` |
| `research/OBSERVER_MODE_ASSET.json` | `78f1cad778dcfbfbc1276bbe1a202b37bd8078fa96e13a63baf3280ecb68d737` |

Runtime: `3.7.7 (tags/v3.7.7:d7c567b08f, Mar 10 2020, 10:41:24) [MSC v.1900 64 bit (AMD64)]`.

[Detailed receipt](OBSERVER_MODE_HELPER_REVIEW.json). Immutable run receipt: `research/evidence/editor-source/observer-mode-helper-review-20260923T034725Z-14c83be7/independent-review-receipt.json`.

Historical caller/reference helpers and review pins were unchanged before and after the run. Matching disk hashes do not establish clean editor memory; native calls can implicitly load dependencies and regenerate cache/data. Time, resource and output checks remain cooperative and cannot interrupt an individual native call.
