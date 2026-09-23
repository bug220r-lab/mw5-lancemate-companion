# MW5GameMode native source result and remaining boundary

Reviewed **2026-09-23 UTC** against the installed editor's UE4.26.2 source export. **OBSERVED editor source; observer startup and cooking UNKNOWN/BLOCKED.** The user confirmed that `Inspect-ObserverBaseMode.py` finished without error. No helper or editor action was performed by the reviewing task. The coordinator's independent receipt audit passed; its [separate review](OBSERVER_BASE_MODE_NATIVE_REVIEW.md) records integrity checks and the later worksheet revision.

## Native receipt

Exact output: `research/evidence/editor-source/observer-base-mode-20260923T041436Z-7a4f6d0899d6`. There are **seven files, 22,699 bytes**: four stage checkpoints, source, defaults and report. The asset was already loaded, so this run has no separate load checkpoint; the previous mode run's eight-file count is not a requirement for this run.

| Artifact | Bytes | SHA256 |
|---|---:|---|
| `source.COPY` | 3,099 | `C8AD84B384428010190DB4A6A5A639D41561E4A1506FF675A1DD072C256F899D` |
| `defaults.COPY` | 8,885 | `FB31627725783FF7E950952039732B5053C288EC5850E374FCD7277804A844D0` |
| `report.json` | 2,719 | `966F19638290FBD3DBFB8AF1E134FC8AE5331430EB6F17E09B15FF9ED1B824E6` |
| Reviewed helper | 14,913 | `D339DF11DBA3A9FD752B0EBBE417BA415C54A883C5374F8090FE0F88EBF14BD7` |
| Installed `MW5GameMode.uasset` | 18,329 | `83C3FCE0632F3F92F0594A9534E77A8FA02A523BB5688D015922374E7A296279` |

The report records `COLLECTED_REQUIRES_REVIEW`, both exporter returns true, empty error lists, exact Blueprint/generated-class/default identities and unchanged installed source. Its recorded 19,980 bytes before the 2,719-byte report reconcile to the directory total. The observed stages are named-asset lookup, source export, generated-class lookup and default export. The helper's earlier **70/70 MOCK_ONLY** review remains distinct from these native exports.

The [preparation manifest](OBSERVER_BASE_MODE_PREPARATION.json) was frozen at **04:14:30.5333925Z**, before invocation. Preserve it unchanged as historical preparation, including its then-current worksheet hash. The worksheet and shared handoff were subsequently updated to report completion; those later document hashes belong to the final checkpoint, not a rewritten preflight.

The durable log snapshot at `research/evidence/editor-source/observer-base-mode-native-evidence-20260923T041728Z-1636a297a4e4/editor-log-snapshot.log` is **125,242 bytes**, SHA256 `FCD9358EA2E905E5874FBDA6BD2D3E23C782967263A748C176918D6D1E8EAC5C`. Its capture receipt records a stable read. Lines **1136–1137** attribute the exact BaseMode invocation at **04:14:36.411Z** and completion at **04:14:36.618Z**. The 0.187-second helper measurement and reported health are historical source-inspection observations, not gameplay performance or current resource admission.

## Source findings

Locations below refer to this run's `source.COPY` (S) and `defaults.COPY` (D).

- **OBSERVED:** S:31–32 registers exactly `EventGraph` and `UserConstructionScript`. The EventGraph is empty (S:10–14).
- **OBSERVED:** construction contains only its entry (S:15–24). Its outgoing execution pin `54B1F6C2490EAF8610EA949BA279F580` has no `LinkedTo` (S:19); no parent-call node is exported. The earlier Instant Action construction call therefore reaches this empty exported Blueprint body. This is a source trace, not observed execution.
- **OBSERVED:** S:28 identifies the parent as native **`/Script/MechWarrior.MWGameMode`**. This is not another identified Blueprint package for the one-asset helper to export.
- **OBSERVED:** D:39 selects `MW5PlayerControllerDerived_C`; D:44 selects `MW5PlayerController_C` for replay spectators. The child Instant Action mode's D:45 overrides the normal controller default with `InstantActionPlayerController_C`. None identifies an actual running mission controller.
- **OBSERVED bounded negative:** neither export contains `AddPlayerControllerComponents`. Empty graphs and absent text do not rule out inherited native, dynamic or other uncollected callers.

The already collected `mod-research-collection-20260921T023909Z-5eeaf52a/unreal-api-reference.txt` declares `MWGameMode(GameModeBase)` and names module/header **`MechWarrior/MWGameMode.h`** (326096–326104). Its `player_controller_class` description concerns the class spawned for logging-in players (326198). `receive_start_new_game` and `receive_process_start_conditions` (326404–326428) are generated signatures/stubs. Their placeholder bodies are not the native implementation, a callsite or evidence that either invokes this factory.

## Concrete remaining blocker

The source chain now establishes controller defaults and reaches a native boundary. It still does not establish **who invokes `MW5PlayerController.AddPlayerControllerComponents`, when a cooked registration instance becomes discoverable, or whether it creates exactly one observer at the correct controller/mission lifetime**. Native parent identity does not prove the missing call lives in that parent. No further Blueprint parent is selected, no additional export helper is prepared, and the completed controller/reference/mode/base-mode helpers must not be repeated.

The next useful unattended work is the [creation-only probe contract](../design/OBSERVER_CREATION_ONLY_PROBE.md): prepare a reviewable evidence and artifact package for a later isolated test. It is explicitly NOT_BUILT/NOT_PERFORMED. The measurement method, cooked-registration visibility and supported independent readout must be established before interpreting that test. Automatic initialization remains the outcome to measure, not a prerequisite assumed to pass. This source review needs **no further editor-native activity**; closing an otherwise unused editor is coordinated by the main task without forcing or discarding edits.

## Preserved separate evidence

The repeated mode export `observer-mode-20260923T041339Z-46bd6b40588b` is retained separately. Its source/default hashes equal the first reviewed mode export; its report hash is `023D048A89EBE177939AB532D4392479DD543232856E18E4586A6A57E62CF125`. It is not parent evidence. Earlier failed reference diagnostics, successful reference receipts and automated-supervisor failures/reviews are unchanged.

No observer asset, registration instance, diagnostic widget, descriptor, cooking, installation, gameplay test, campaign operation or shipping startup proof was produced. `NOT_BUILT`, `NOT_PERFORMED`, source evidence and MOCK_ONLY results retain their separate meanings.
