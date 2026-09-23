# Independent BaseMode native receipt review

Reviewed **2026-09-23 UTC**. **VERIFIED_NATIVE_EDITOR_SOURCE_RECEIPT_ONLY.** This audit read named files and preserved log lines, checked hashes, sizes, identities and accounting, and wrote only this summary plus [its JSON record](OBSERVER_BASE_MODE_NATIVE_REVIEW.json). It did not invoke an editor/helper/test, load assets, interpret graphs or look up a parent.

The [native report](evidence/editor-source/observer-base-mode-20260923T041436Z-7a4f6d0899d6/report.json) remains `COLLECTED_REQUIRES_REVIEW`. Its SHA256 is `966f19638290fbd3dbfb8af1e134fc8ae5331430eb6f17e09b15ff9ed1b824e6`.

## Attribution and identity

The independently hashed [preserved editor log](evidence/editor-source/observer-base-mode-native-evidence-20260923T041728Z-1636a297a4e4/editor-log-snapshot.log:1136) records this exact helper at **04:14:36.411Z**, then completion naming this exact output at **04:14:36.618Z**. The snapshot is **125,242 bytes**, SHA256 `fcd9358ea2e905e5874fbda6bd2d3e23c782967263a748c176918d6d1e8eac5c`; its metadata agrees with the adjacent capture receipt. This audit did not read the current live editor log.

Current helper bytes match preparation and native receipt: **14,913 bytes**, SHA256 `d339df11dba3a9fd752b0ebbe417ba415c54a883c5374f8090fe0f88ebf14bd7`. The installed `MW5GameMode.uasset` is **18,329 bytes**, SHA256 `83c3fce0632f3f92f0594a9534e77a8fa02a523bb5688d015922374e7a296279`.

The expected and recorded identities agree: `/Game/Modes/MW5GameMode.MW5GameMode`, its `.MW5GameMode_C` class, and `.Default__MW5GameMode_C` default object. Both export outer headers agree. The parent identity `/Script/MechWarrior.MWGameMode` is exported-text metadata only.

## Files and accounting

Exactly **seven files total 22,699 bytes**. Source is **3,099 bytes**, SHA256 `c8ad84b384428010190db4a6a5a639d41561e4a1506ff675a1dd072c256f899d`; defaults are **8,885 bytes**, SHA256 `fb31627725783ff7e950952039732b5053c288ec5850e374fcd7277804a844d0`. Both exporters returned true, with empty error arrays. Every raw file pin is recorded in the JSON review.

The **four** checkpoints are expected because `already_loaded=true`: find, export source, get generated class, export defaults. Elapsed times **0, 0.015, 0.125, 0.125 seconds** are nondecreasing; final elapsed is **0.187 seconds**. Byte counters **0, 1,458, 6,419, 8,597**, then **19,980 before the 2,719-byte final report**, reconstruct exactly. The retained final stage `EXPORT_DEFAULTS` is consistent with final successful collection.

No error or cap-stop status appears. Files fit the unchanged 1 MiB source, 8 MiB/export, 17 MiB accumulated output and 64 KiB/JSON limits. Recorded health clears the cooperative 2 GiB disk, 768 MiB RAM and 1 GiB commit thresholds; the owned lock is absent. These observations are historical and are not fresh resource admission.

## Preparation and preserved evidence

The frozen [preparation](OBSERVER_BASE_MODE_PREPARATION.json), **6,712 bytes**, still has SHA256 `023351aafba1b886d0ef6ac06e25b25e3a612d1186876e3d4b2ea82a673850f3`. Its **04:14:30.5333925Z** timestamp precedes the logged invocation. **Eight of nine linked current files still match.**

The exception is the worksheet's later status edit: its frozen pin is **5,334 bytes / `fd41734233c6dfe841ed6d9499a2ee0d6015b2e5ac0994188cb109f1ce42d759`**; the inspected current document is **5,611 bytes / `415630a6aac7778ab141d3ba058cf12f16ac99872f93e586e9b31ad85a68f366`**, last written **04:16:05Z**. It qualifies the old status as “at preparation” and adds the later output/no-repeat note. Do not describe every preparation-linked file as currently byte-identical. This does not change the pinned helper, target or raw result.

All **eight original InstantAction export files** still match their earlier reviewed pins. The separate **04:13:39 repeated InstantAction run** remains separate evidence; its source/default bytes match the originals. Its report and export pins are retained in the JSON review; its checkpoints were not re-audited.

## Limits

No receipt-integrity blocker was found. This establishes attributable editor exports, not observer initialization, runtime creation, cooking or shipping-game behavior. Implicit dependency loads remain possible. Matching disk hashes does not exclude unsaved editor-memory changes. Resource, duration and output guards are cooperative, not hard native-call bounds. Graph interpretation belongs to the separate observer task.

