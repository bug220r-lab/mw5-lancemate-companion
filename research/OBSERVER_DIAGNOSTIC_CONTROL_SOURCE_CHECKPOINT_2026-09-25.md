# Diagnostic control source checkpoint — September 25, 2026

**SOURCE_CHECKPOINT_NOT_PACKAGE_ACCEPTANCE.** At **22:28:09 UTC**, the exact diagnostic mod root was completely inventoried and its seven content files were copied into a new project-local backup. Every source/backup byte count and SHA256 matched. Source content remained unchanged across the operation. The original seven observer files, separate original source `mod.json` and stock controller also matched their reviewed pins before and after.

The [frozen JSON record](evidence/editor-authored/LanceObserverDiagnosticControl-20260925T222809Z-548b77b2-source-checkpoint/SOURCE_CHECKPOINT.json) is **14,976 bytes**, SHA256 **`e178797fac03c6558f427a862fc1d6c0750c3198f190a18d6e528416477b698f`**. It records complete paths, modification times, before/after checks, selection state, descriptor fields, disk measurement and limitations. Backups reside in its sibling [content directory](evidence/editor-authored/LanceObserverDiagnosticControl-20260925T222809Z-548b77b2-source-checkpoint/content/). All seven backup files and the JSON record have Windows read-only attributes. This is preserved, hash-pinned evidence, not write-once storage.

## Complete source content

Exact source root: `C:\Program Files\Epic Games\MechWarrior5Editor\MW5Mercs\Plugins\LanceObserverDiagnosticControl`.

The recursive scan included hidden entries and rejected reparse points, nonregular files, escaping paths and case collisions. It found only the following seven content files, totaling **137,553 bytes**, plus the separately recorded `ActiveMod.txt` selection marker. No executable module or additional asset was present in this observed source inventory. This does not establish cooked/package membership.

| Relative path | Bytes | SHA256 |
|---|---:|---|
| `Config/Input/LanceObserverDiagnosticControlInput.ini` | 1,498 | `d1a5492fcb7e0ad41d8f4eb15e953fd0032e174510f3db89a74fec5901dbbd3f` |
| `Config/Tags/LanceObserverDiagnosticControlTags.ini` | 43 | `ad7f8b6d4415fb7edb4d52e83942a67c66313da7ea504e6196679db31b147e1b` |
| `Content/WBP_ObserverDiagnosticControl.uasset` | 30,768 | `80f52bb21156b638ca22d6c8ab778bfcfc7a6feb1f26286977a3324ac5978b4b` |
| `LanceObserverDiagnosticControl.uplugin` | 389 | `52b5bef1004246ac5377e81d9508579393be258f9c5477cf3626ee4c33cf1c79` |
| `mod.json` | 484 | `1733b881793403a6b577bba8effa9f8ab9ca4dbbdddcaf070c98f03f543f90a1` |
| `ModOverride/Modes/InstantAction/InstantActionPlayerController.uasset` | 92,019 | `ba725129011767a82935bd36a811ce2583bfebbfbbd8c4b2cff3fcbc1ca14948` |
| `Resources/Icon128.png` | 12,352 | `ec157f56f486e5a68fd4b27df6c88fecdb1b8f9bfff18aa5ef10a21bca6a4c5e` |

The original nine-file preservation check covers the seven `LanceObserverProbe` content/configuration/resource/`.uplugin` pins, its separate `mod.json` (**356 bytes**, `475c4ed15264743f84d326f28903079d3d72f102985d10c8a7ede4ccf7d5cea3`), and the stock controller (**53,635 bytes**, `7107745a8de461275a7acfa1f3ffc5be9bcb7002682c37b7705af5f00783e4f6`). Their complete before/after identities are in the JSON record.

## Descriptor and selection state

**OBSERVED on disk:** diagnostic `mod.json` was modified at `2026-09-25T22:24:25.457374100Z`. Its twelve parsed fields are preserved in the JSON record:

- Display name `LanceObserverDiagnosticControl`, version `1.0`, build `0`.
- Description `Static output diagnostic for Instant Action. Press F8 once. Runtime behavior not verified.`
- Author and author URL empty; default load order `0`; gameVersion `1.14.70`.
- Manifest contains exactly `/Game/Modes/InstantAction/InstantActionPlayerController.uasset`.
- Steam published-file ID and last submitted build are `0`; visibility is `Private`.

The coordinator observed Manage Mod close and create this descriptor; Package and Publish were not clicked. This subtask performed only filesystem reads and project-local backup/document writes. Descriptor metadata does not prove retail compatibility, actual substitution, successful packaging or publication.

`ActiveMod.txt` is intentionally excluded from the immutable content backup. At the checkpoint it was present in the diagnostic root as an empty file with SHA256 `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`; the original observer marker was absent. Selection state did not change during this checkpoint. The coordinator owns subsequent UI restoration and its postchecks. Those later observations must be recorded separately rather than rewriting this snapshot.

## Native source evidence and remaining limits

The [22:17:45 native inspection receipt](evidence/editor-source/diagnostic-final-source-20260925T221745Z-530263a1/report.json), SHA256 `203245c934b937c0aa3b87a429cf7a857235c2574c4c77f40787f988154ab839`, records `COLLECTED_REQUIRES_SOURCE_REVIEW`: four exports totaling **142,237 bytes**, no exporter errors, no asset loading and all twelve then-pinned disk inputs unchanged. This checkpoint independently rechecked the four export and four inventory hashes against that receipt. Controller/widget graph reviews belong to the separate reviewing agents; this backup does not substitute for them.

The handled localization-validator ensure and the reload warnings for `PlayerControllerSwitchMech_GEN_VARIABLE`, `PlayerControllerAirStrikeComponent_GEN_VARIABLE` and `ControllerFeedbackComponent_GEN_VARIABLE` remain unresolved here. See the [controller copy review](OBSERVER_DIAGNOSTIC_CONTROLLER_COPY_REVIEW_2026-09-25.md#unresolved-warnings-and-next-boundary). Export equality or matching ordinary CDO fields does not prove the warned generated templates are healthy.

Free project-drive space measured **5,847,560,192 bytes (about 5.45 GiB)**, **7,037,341,696 bytes below** the proposed **12 GiB** package starting floor. The [package preflight](OBSERVER_DIAGNOSTIC_CONTROL_PACKAGE_PREFLIGHT_2026-09-25.md) remains blocked on disk headroom and unresolved warning/source-review requirements. The RAM-reserve waiver does not remove this disk gate. No cache, Windows setting, game file, save or retail configuration was changed.

**Package/cook, publish, retail deployment and gameplay: NOT_PERFORMED by this checkpoint.** Before any later package attempt, recheck the complete content set against this frozen record, account separately for the current selection marker, finish the source/warning reviews and apply the package preflight. A newer authored file requires a new checkpoint; do not overwrite this backup.
