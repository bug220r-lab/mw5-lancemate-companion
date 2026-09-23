# Independent review of the Instant Action mode native receipt

Reviewed 2026-09-23. **OBSERVED: VERIFIED_NATIVE_EDITOR_SOURCE_RECEIPT.** This review validates the eight-file receipt from the user-assisted editor invocation at 03:55:42Z. The reviewer performed read-only file, hash, schema, identity and chronology checks; no tests, helper execution, editor actions or additional exports were performed.

The [machine-readable review](OBSERVER_MODE_NATIVE_REVIEW.json) records the complete before/after inventory, current pins, checkpoint accounting, historical resource samples and log binding. Its SHA256 is `0760D36381978C4A472AEF93220610505FE43BA720BC5FD5CEDE2BC264A9CBDD` (15,507 bytes).

## Receipt and native attribution

The direct-child output is [observer-mode-20260923T035542Z-8fe04811300f](evidence/editor-source/observer-mode-20260923T035542Z-8fe04811300f). It contains exactly five checkpoints, `source.COPY`, `defaults.COPY` and `report.json`. All eight sizes and hashes were unchanged across review; no reparse boundary or extra file was found. JSON was parsed with duplicate-key and nonfinite-value rejection.

The preserved [editor log](evidence/editor-source/observer-mode-native-evidence-20260923T040039Z-0937413cd148/editor-log-snapshot.log), lines 1132–1133, records the exact helper command at `2026-09-23T03:55:42.550Z` and the completion status plus exact output directory at `03:55:42.983Z`. The snapshot is 124,438 bytes, SHA256 `6D2A4EC6626227E4AF7B8D5CE64972E41DBF1F5281E830160D22F0C79BEC3C52`; the separate [capture receipt](evidence/editor-source/observer-mode-native-evidence-20260923T040039Z-0937413cd148/capture.json) records a stable capture at 04:00:39.5848348Z. These two log lines also matched the current editor log when reviewed. All eight raw-file creation/modification times fall within the recorded invocation/completion interval.

The final native report is `COLLECTED_REQUIRES_REVIEW`, classification `EDITOR_SOURCE_INSPECTION_ONLY`, with `native_execution=ATTEMPTED`, no report errors and `source_unchanged_after=true`. Both exporters returned `true`, with empty `exporter_errors` and `EDITOR_TEXT_REQUIRES_REVIEW` status. Gameplay and cook/install/publish remain `NOT_PERFORMED`.

| Raw file | Bytes | SHA256 |
| --- | ---: | --- |
| checkpoint-00.json | 1,500 | `90ceea587ca240c61d60ec4d8a6d69f914076f910cbfc1af49b40b72b9a92cf7` |
| checkpoint-01.json | 1,657 | `55ffc70bd8d243dbc10495afde81942e8990b6898c98521e6fdf704d90e533ad` |
| checkpoint-02.json | 1,926 | `dd665700352e2a6a465d6a196dff0d8aa00d878d436b1dd139b0cc95fe426fc8` |
| checkpoint-03.json | 2,271 | `b61ccddc8a63d818eec1b6d57d19d6e25c3436a2d22e1516bb05bb2031d5a065` |
| checkpoint-04.json | 2,638 | `821a30ff02bb423e7a1138f529d297b72cb2a99437b84e4d79e00a3a0c19f16d` |
| source.COPY | 617,929 | `b95a06b61aeead0cfe27fd2012e50e7d4be07353c3e5e4e3dafbaccaee5dd551` |
| defaults.COPY | 9,362 | `be04eec660121621a7497a65edf6f72578c9cca28ebaf02076c71fd886a9e9ce` |
| report.json | 2,858 | `40833043ec712ae8a03e13041577602636bfc646c8f48b83c0de108983c765cb` |

## Manifest and identity checks

The [preparation manifest](OBSERVER_MODE_PREPARATION.json), 5,458 bytes, SHA256 `1B61BCC544F3AC39A8C6C4C20FDCC7387D8280930F272106F36D5EB4279BCEA4`, remained unchanged. Its preparation-only status is historical; this review supplies the later native evidence without rewriting that status. The current files independently match its four pins:

| Pin | Bytes | SHA256 |
| --- | ---: | --- |
| `scripts/Inspect-ObserverMode.py` | 14,884 | `AD0EEB1E1FA73E55CEE24F679C27CA3C5AA52C0ABFFC48F4F8D0E88B0F44ED29` |
| Installed `Content/Modes/InstantAction/InstantActionMode.uasset` | 229,443 | `1C841BF1C5198B57499F2F872CBABCF3F1F38508054AB8695FCD2F6C41E4F17B` |
| `research/OBSERVER_MODE_ASSET.json` | 912 | `78F1CAD778DCFBFBC1276BBE1A202B37BD8078FA96E13A63BAF3280ECB68D737` |
| Prior native reference `report.json` | 6,895 | `55CA5794BBDB2F84A7F28A5B8EEF56B8CCEA1664BF24E21B5C91D020856CAF0A` |

The named package is `/Game/Modes/InstantAction/InstantActionMode`. The report observes `already_loaded=false`, then the exact loaded object `/Game/Modes/InstantAction/InstantActionMode.InstantActionMode`, generated class `/Game/Modes/InstantAction/InstantActionMode.InstantActionMode_C`, and default object `/Game/Modes/InstantAction/InstantActionMode.Default__InstantActionMode_C`.

`source.COPY` line 1 identifies Blueprint `InstantActionMode`; `defaults.COPY` line 1 identifies its exact generated class and `Default__InstantActionMode_C`. The sole `ParentClass` field at `source.COPY` line 3393 is `/Game/Modes/MW5GameMode.MW5GameMode_C`, matching report metadata marked `EXPORTED_TEXT_ONLY`. This identifies the parent from the named export; the helper did not explicitly load or export that parent.

## Sequence, budgets and resource evidence

The contiguous checkpoint sequence is `FIND_NAMED_ASSET`, `LOAD_NAMED_ASSET`, `EXPORT_SOURCE`, `GET_NAMED_GENERATED_CLASS`, `EXPORT_DEFAULTS`. Elapsed values are 0.000, 0.000, 0.156, 0.312 and 0.328 seconds; the final report records 0.406 seconds. Each checkpoint's prior-output byte count matches the files that existed at that stage. The final prior-receipt total is 637,283 bytes; adding the 2,858-byte report gives **640,141 bytes** overall, including 12,850 bytes of JSON.

The installed asset is below the manifest's 1 MiB input limit; each export is below 8 MiB; each JSON file is below 64 KiB; total output is below the 17 MiB accumulated stop budget. The reported duration is below the cooperative 120-second limit. These observations do not establish hard native-call allocation, output or time bounds.

Every recorded health sample is above the unchanged helper minimums: disk 2,147,483,648 bytes, physical memory 805,306,368 bytes and commit headroom 1,073,741,824 bytes. The final sample records disk 22,831,079,424 bytes, physical memory 3,345,879,040 bytes and commit headroom 4,603,273,216 bytes. Checkpoint 00 has no health field because its report did not yet exist during the first guard check. These are historical helper samples, not current resource reservations or proof that the separate automated supervisor admission gates pass.

## Limits of the finding

This is receipt integrity and named object/class/default identity evidence; graph interpretation is a separate review. The exports reflect editor memory, so matching installed bytes before, after and during this review cannot exclude unsaved in-memory edits. A named native load/export may implicitly load dependencies or regenerate editor data/cache. The helper's guards are cooperative and cannot interrupt native calls.

No save, explicit compile, Play, cook, install, recursive collection, additional parent export or live command was requested by this helper. The receipt does not establish runtime startup, cooked visibility, shipping-game behavior, compatibility or an implemented companion runtime. Raw evidence was preserved unchanged and no file was added to its eight-file directory.
