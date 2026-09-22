# Three-package observer reference lookup

**September 22 continuation:** the editor has since been closed normally to free RAM. The [normal-editor startup experiment](OBSERVER_NORMAL_EDITOR_EXPERIMENT.md) is the current preparation for a future run of this unchanged helper. Its proposed RAM admission currently fails and its outer supervisor is NOT_BUILT. No editor/game/lookup execution occurred in that preparation. Existing-session instructions below describe the previously prepared route, not a claim that an editor is still running.

Prepared **2026-09-21 UTC**. **PROPOSED editor action; native lookup NOT_PERFORMED.** The user has now authorized running the editor or game when needed for continued implementation. This concrete step uses the existing editor to read three packages' direct reference metadata. It does not depend on another approval for editor execution. The completed [single-controller export](../research/OBSERVER_CALLER_NATIVE_RESULT.md) is preserved and must not be rerun.

## Question and scope

Which packages in the existing AssetRegistry refer directly to the known controller, its Instant Action child, or the registration-data class? Those names narrow the next source inspection for `AddPlayerControllerComponents` and actual controller assignment. They do **not** prove function calls, registry completeness, cooked inclusion or runtime creation.

The exact helper is [Inspect-ObserverReferences.py](../scripts/Inspect-ObserverReferences.py). Its [preparation manifest](../research/OBSERVER_REFERENCE_PREPARATION.json) binds the reviewed script and three installed files to hashes. The [API review](../research/OBSERVER_REFERENCE_API_REVIEW.md) records generated declaration locations and limitations.

| Package | Installed `.uasset` bytes | SHA256 |
|---|---:|---|
| `/Game/Objects/_common/MW5PlayerController` | 1,260,490 | `FE6492FB35EF4759D3EF770CB802819DBC4DA38F98FB88416AD8B10B16B5E6BC` |
| `/Game/Modes/InstantAction/InstantActionPlayerController` | 53,635 | `7107745A8DE461275A7ACFA1F3FFC5BE9BCB7002682C37B7705AF5F00783E4F6` |
| `/Game/Objects/_common/Components/PlayerControllerComponents/PlayerControllerComponentDataAsset` | 9,538 | `D5D06EE76FD4049E836563FEDB4C65E79AA12862BC9DAD7DBA55FBD467985F5A` |

**OBSERVED:** all three installed hashes were reread unchanged during this preparation. Files are under `C:\Program Files\Epic Games\MechWarrior5Editor\MW5Mercs\Content`. Applicable source/API provenance is editor **1.1.390.0e / UE4.26.2 / compatible CL14830424**. Installed package hashes are checked again before and after the helper. Matching disk data does not establish fresh or complete editor registry contents.

## Exact action and output contract

In the existing official editor, use **File > Execute Python Script** once with:

`C:\Users\jlewi\OneDrive\Documents\ChatGPT\MW5 LANCEMATE COMPANION\scripts\Inspect-ObserverReferences.py`

The helper obtains the existing registry, reads whether assets are still loading, then makes at most **three** `get_referencers(package_name, options)` calls. Options explicitly include hard and soft **package** references; searchable names and both management categories are false. Returned names retain target association and original order. Duplicates count toward the limits. A `None` return is recorded separately from an empty list. Loading before the first query stops the lookup; loading observed after a query preserves a partial result and stops. No registry scan, reindex, wait-for-completion, recursive query, object load or export is requested.

Each run writes only a new direct-child folder named `research/evidence/editor-source/observer-references-YYYYMMDDTHHMMSSZ-<token>`. It contains `started.json`, up to four small `checkpoint-NN.json` files, and `report.json`. The temporary project-local `.observer-reference-lookup.lock` rejects concurrent/stale runs; only an exact owned lock token is removed. Existing source/default exports are never replaced. The helper deliberately writes no installed assets, mod descriptor, settings, save, cooked file or retail file. Normal engine logs/cache activity remains distinct from its deliberate JSON output.

Limits are **512 entries per target**, **1,024 total entries**, **512 characters / 768 encoded JSON bytes per name**, **1 MiB final report**, **16 KiB started receipt** and **4 KiB per checkpoint**. Thus the designed six-file output ceiling is 1,081,344 bytes, plus the temporary 32-byte lock. Per-target counts and truncation remain explicit. A cap stops further queries; it does not certify a complete candidate list. Malformed names, source drift, API exceptions and resource failure retain an error receipt when a report directory exists. Preflight failures can stop before creating a report; inspect the editor log instead of rerunning blindly.

The helper checks at least **2 GiB disk**, **768 MiB available physical memory**, **1 GiB available commit**, and a **60-second cooperative budget**. A `STOP` file in its new output directory is honored at the next check. These are small-lookup guards, not the project's separate installation/cooking storage allowance. Native calls are synchronous: the checks cannot preempt a call, prevent an earlier native allocation, guarantee frame time or cap unrelated editor cache growth.

## Validation and access

The independent [fake-API review](../research/OBSERVER_REFERENCE_HELPER_REVIEW.json) passed **47/47 cases under bundled Python 3.7.7**, against helper SHA256 `20C460FDF678DE74568C477B28C41A65408A5B5C7868BC1BB893D05CECED099B`. It concerns helper boundaries only and remains **MOCK_ONLY**. The largest tested Unicode receipt was 793,921 bytes. Fault-injecting a much smaller JSON ceiling intentionally leaves only started/checkpoint evidence; final receipt write failure or disk exhaustion can likewise prevent a final report. These checks cannot establish that the native registry returns useful candidates.

The current [execution-access receipt](../research/OBSERVER_REFERENCE_EXECUTION_ACCESS.json) distinguishes the successful earlier export from this unrun lookup. The current supported Computer Use accessibility snapshot exposes only the main editor window title. The preceding screenshot attempt failed twice with `SetIsBorderRequired failed: No such interface supported (0x80004002)`. No new script path or execution input was sent. A review of the official commandlet route is recorded separately in [OBSERVER_REFERENCE_COMMANDLET_REVIEW.md](../research/OBSERVER_REFERENCE_COMMANDLET_REVIEW.md); no speculative flags or duplicate editor startup are part of this helper.

## Review after execution

Select only a new **direct-child** `observer-references-<timestamp>-<token>` directory. Nested `observer-reference-helper-review-*` fixtures are mocks. Verify the report's script pin, options, source hashes before/after, query count, loading flags, caps and errors. Hash the actual returned JSON files and preserve them unedited. `COLLECTED_REQUIRES_REVIEW` means metadata was collected; it is not M0 acceptance.

First reuse already collected source for the returned candidates. Any next native source export must identify the exact candidate, missing question and bounded output before running it. Offline byte/name screening may prioritize exact returned files but cannot establish connected calls or exclude native/dynamic callers. Do not expand into a whole-content search, recursive collector, save/compile/cook, registration change or creation experiment to turn a negative result into a positive claim.

No observer source assets or runtime are produced here. M0 still requires actual creation/ownership/teardown/cooked-registration evidence. Follow [FULL_MOD_DELIVERY.md](FULL_MOD_DELIVERY.md) and the coordinated [implementation status](../research/IMPLEMENTATION_STATUS.md) for the broader local work; source lookup does not substitute for the disposable scenario, manifest, baseline, stop conditions and rollback of a later game-affecting experiment.
