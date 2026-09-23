# Offline workbench packaging and restore review

Scope: **OFFLINE_WORKBENCH_ONLY**. This packages the existing synthetic workbench; it does not install a mod or complete M5/M8. The [package contract](../design/WORKBENCH_PACKAGE.md) and [standalone instructions](../design/WORKBENCH_PACKAGE_README.md) define the boundary.

## Source package

The fixed inventory contains 29 authored files, including the launcher, UI, default configuration pins, tactical policy and synthetic scenario. Personal settings, downloaded engines/models, media, raw game research and Git data are excluded. An existing Node.js 24 installation is required separately. The builder performs no payload execution or downloads.

The deterministic manifest records each destination path, byte count and SHA-256. Builds require a new directory, check bounded stable source reads, and write the manifest last. Pristine verification rejects altered, missing or extra files and unsupported paths. These are integrity checks, not a signature or protection against coordinated replacement of both manifest and payload. Supported filesystem checks reject symlinks/junctions; they do not claim detection of every Windows reparse tag or atomic protection against hostile concurrent filesystem mutation.

## Separate source review

The builder's nine synthetic cases and the independent reviewer's nine cases passed serially. They cover reproducible bytes, exact inventory/exclusions, existing destinations, same-size content changes, missing/extra files, manifest/path changes, source drift, bounded sizes and junction rejection. The independent suite also checks a competing destination created during source inspection: its sentinel is preserved.

The first builder run exposed an overly broad canonical-path check against a sandbox-restricted ancestor. The correction retains ancestor type/link checks but resolves the requested directory itself. The independent review's first run incorrectly restored a manifest with compact JSON; canonical verification correctly rejected it. Only that test helper's serialization changed. Both final focused suites passed; neither ran the application or a native component.

Frozen builder SHA-256: `8a04552e4cccd9616a8e823b53bfc5f142dba03249ffaa25fd705fc27f207ccf`.

Implementation test SHA-256: `5b2f99c9f9e927c931fc7cb0417166a664b5965699c276bc7ae39756e2aa4b2f`.

Independent test SHA-256: `d2f7077dfcfc9b815db6450fdb77cc8b0e8f2e4e5701e4d8f7c0cc8eaf802f90`.

## Actual restored-source exercise

The separate verifier's seven guard/preparation cases passed. Read-only review caught a receipt-write issue before execution: a short file write was not checked. The correction writes all bytes with explicit offsets and refuses invalid or zero progress; two fake-handle regressions cover that failure mode. The reviewer rechecked final source SHA-256 `c5790b0b74090634a68118f9129fd875530c5ba2c95916ba62ee979784cffd8d`. Preparation-test SHA-256 is `a77c8bcb90311fec87ccc7539c9179e64a7d1851e7a1939924eff85d78103566`.

Root ran the final verifier **once**, from **2026-09-23 03:23:58.875 to 03:24:01.652 UTC**, on Node **v24.19.0**, Windows x64. Result: **PASS_OFFLINE_WORKBENCH_RESTORE_ONLY**. The [exclusive receipt](WORKBENCH_RESTORE_VALIDATION.json) is SHA-256 `232d85bf4f383d04efeafb4008af0eebed0840ad4632c6666d1ea8790e6dea74`.

Both copies contain **29 payload files totaling 389,046 bytes**, plus the identical manifest with SHA-256 `3f835b7c84d7ac9130331ef0de8e5cd8ee7a6b395ab4a560ad3351b2c888847a`. They reside under `tmp/workbench-restore-3fa8bbb9-05b1-4bfe-922d-b439eed96c35/`. `package-a` was exercised; `package-b` remains pristine. These two copies are on the same drive and are not independent disaster-recovery backups.

The actual copied `createWorkbench` used its default constructors, with only its settings path explicitly set inside the copy. All **15 checkpoints passed**, covering disconnected defaults, three distinct synthetic actors, unarmed refusal, simulated submission, persistent human hold, pause/resume, explicit release, possession, and preference reload with reset mission state. Submission records retained MOCK_ONLY/SUBMITTED evidence; no native acceptance was synthesized.

Both workbench disposals reported `LOCAL_MODELS_STOPPED`. Known process/network entrypoint guards recorded zero attempts and were restored. These instrument reviewed paths; they are not an OS sandbox or a comprehensive traffic monitor. The only added local-state file was `package-a/companion/local/settings.json`; all 29 payloads remained unchanged, and package-b gained no files. The original checkout's settings passed the separate hash-or-absence comparison. Root independently rehashed all **31 source inputs**, both payload sets and both manifests without mismatch. Initial free disk was **21.307 GiB**, above the unchanged 10 GiB reserve plus the verifier's staging allowance.

The complete [companion regression](COMPANION_VALIDATION.json) finished at **03:25:28.878 UTC**: **1,230/1,230 PASS, MOCK_ONLY**, zero failures/skips, one test worker, 54.502 seconds. Root independently verified all **116 source hashes** and the complete test-log hash. The new package/restore source and tests are included in that receipt.

A separate read-only post-run audit independently checked the exclusive receipt, all 31 current source pins, both complete actual copies and their exact inventories. It found no mismatch. It confirmed the only added file was the expected 503-byte settings file inside package-a, while original-checkout settings remained absent. All 15 recorded PASS checkpoints, two stopped-model disposal results, zero guarded attempts, restored guards and null failure agree with the inspected artifacts. That audit did not rerun the app or tests.

Browser/Explorer launch, microphone/audio, downloaded component restoration, other-machine acceptance and gameplay remain outside this exercise. The shipping observer and direct-control milestones remain unfinished.
