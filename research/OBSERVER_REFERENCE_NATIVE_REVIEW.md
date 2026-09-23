# Independent native package-reference receipt review

Reviewed **2026-09-23 UTC**. **VERIFIED_NATIVE_EDITOR_METADATA_ONLY.** The user-assisted invocation produced a complete, attributable metadata receipt. This review performed read-only artifact validation and wrote this summary plus [its JSON evidence](OBSERVER_REFERENCE_NATIVE_REVIEW.json); it did not run tests, invoke the helper/editor/game, alter raw evidence, or collect additional assets.

The exact direct-child output is [observer-references-20260923T033812Z-a2542db9f0e4](evidence/editor-source/observer-references-20260923T033812Z-a2542db9f0e4/report.json). Editor log **lines 1130–1131** record the exact helper command at **03:38:12.240Z** and `COLLECTED_REQUIRES_REVIEW` completion for this exact directory at **03:38:12.322Z**. Those lines were independently matched between the current editor log and the coordinator's [preserved log snapshot](evidence/editor-source/observer-reference-native-evidence-20260923T034135Z-e88436f813fc/editor-log-snapshot.log). The snapshot is **124,043 bytes**, SHA-256 `7608e3291615073bf2facecfd0b10b256106853af143f0a3d992e3cb7795f770`; its [capture receipt](evidence/editor-source/observer-reference-native-evidence-20260923T034135Z-e88436f813fc/capture.json) is also pinned in the JSON review. No file was added to the native six-file directory.

## Result and scope

| Queried package | Returned/retained | Unique within query |
| --- | ---: | ---: |
| `/Game/Objects/_common/MW5PlayerController` | 31/31 | 31 |
| `/Game/Modes/InstantAction/InstantActionPlayerController` | 2/2 | 2 |
| `/Game/Objects/_common/Components/PlayerControllerComponents/PlayerControllerComponentDataAsset` | 4/4 | 4 |

There are **37 retained entries and 35 unique package names**; case-insensitive counting also gives 35. No query contains duplicate names. `MW5PlayerController` and `InstantActionPlayerController` each occur in two different query lists. Each queried package includes itself, giving **three self-reference entries**. Excluding the three target package names leaves **32 unique other package names**. Raw ordering and duplicates across queries were preserved.

Both initial and final receipts identify `EDITOR_METADATA_ONLY`, `native_execution=ATTEMPTED`, gameplay `NOT_PERFORMED`, and asset load/export/save/compile/cook `NOT_PERFORMED`. The final status is `COLLECTED_REQUIRES_REVIEW`, with exactly the three authorized queries in order. Hard and soft package references are enabled; searchable names and both management-reference options are disabled, matching the [revised preparation manifest](OBSERVER_REFERENCE_DIAGNOSTIC_PREPARATION.json).

`registry_loading_before` and all three `registry_loading_after` values are false. The error list is empty. Returned counts equal retained counts, and no cap/truncation status appears. All names satisfy the helper's formatting and length rules. Checkpoints 00–03 are contiguous: registry acquisition followed by the three ordered query stages, with completed-query counts **0, 0, 1, 2** and native execution `ATTEMPTED`. Their recorded elapsed times are nondecreasing and bounded by the final reported **0.031 seconds**.

All configured limits match preparation: three queries, 512 entries per target, 1,024 total, 512 characters/768 encoded bytes per name, 1 MiB report, and 60 cooperative seconds. Six raw JSON files total **9,978 bytes**, below the designed **1,081,344-byte** ceiling.

## Identity and raw preservation

The revised helper's current bytes, recorded bytes and preparation pin agree: **12,417 bytes**, SHA-256 `adc2da144e2648c8fcbe7df42667a76bf7bd258ace455d0105b27a3fea717a63`.

The three sources' `source_before` and `source_after` arrays are identical, `source_hashes_unchanged=true`, and independent current on-disk hashes match the revised preparation and both arrays:

| Source | Bytes | SHA-256 |
| --- | ---: | --- |
| MW5PlayerController | 1,260,490 | `fe6492fb35ef4759d3ef770cb802819dbc4da38f98fb88416ad8b10b16b5e6bc` |
| InstantActionPlayerController | 53,635 | `7107745a8de461275a7acfa1f3ffc5be9bcb7002682c37b7705af5f00783e4f6` |
| PlayerControllerComponentDataAsset | 9,538 | `d5d06ee76fd4049e836563fedb4c65e79aa12862bc9dad7dba55fbd467985f5a` |

The exact six-file set was verified, including bounded strict JSON parsing and reparse-path rejection. Each raw file's hash was identical before and after review:

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| started.json | 2,412 | `d8abe3d515abc593c7aa048d0949767dd28a319ea03a05133f94ff1996018acf` |
| checkpoint-00.json | 130 | `8d1dec18cde4a5c88750658efa4b95784ca8ed5dc1537253fdda835371027374` |
| checkpoint-01.json | 158 | `f05d209c436bb35f935932a2593c08216713a06a3d0053a526e263cabaedf3e0` |
| checkpoint-02.json | 172 | `6234db7e3a38a4d92fbd64d4e33f981c6c9b5837e3a9308b880ee00e3e62af4e` |
| checkpoint-03.json | 211 | `a37432131c5cb06943f1adf16d3de1fde91ad4e473ccf6089721024ffcbfa4cb` |
| report.json | 6,895 | `55ca5794bbdb2f84a7f28a5b8eef56b8ccea1664bf24e21b5c91d020856caf0a` |

## Limits

These are **observed package-reference candidates**, not connected function calls or proof of an initialization path. False loading flags and a completed query set do not prove registry completeness. Self references are retained metadata, not independent consumers. No observer creation, cooking, packaged visibility, shipping-game behavior or compatibility was established.

The last recorded helper health was disk **22,850,129,920**, RAM **1,546,854,400**, and available commit **4,884,299,776 bytes**, each above that helper's unchanged minimum. This is one historical observation, not current headroom, a resource reservation, or automated supervisor admission. The earlier resource-stop attempt remains separate evidence; its missing failure-time values are not supplied by this successful run.

The JSON review SHA-256 is `9a20408aa46b960a719bac2da3e975ba5614ce47718691f73c240d40caf66c09`. Raw status remains `COLLECTED_REQUIRES_REVIEW`; interpreting any candidate requires separate bounded source evidence.
