# Instant Action mode: verified source and parent boundary

Reviewed **2026-09-23 UTC**. **PASS_EDITOR_SOURCE_EXPORT.** The mode's exported class defaults select the known Instant Action controller. Its connected construction path calls its parent, `MW5GameMode`, whose source is not in the collected evidence. The component-factory caller and observer startup/cooking remain **UNKNOWN/BLOCKED**. Do not rerun this completed mode helper.

## Verified native output

The user confirmed the run. The [preserved editor log](evidence/editor-source/observer-mode-native-evidence-20260923T040039Z-0937413cd148/editor-log-snapshot.log:1132) records invocation at **03:55:42.550Z** and `COLLECTED_REQUIRES_REVIEW` completion at **03:55:42.983Z**, naming the exact new [mode output directory](evidence/editor-source/observer-mode-20260923T035542Z-8fe04811300f/report.json). The eight original files remain unchanged.

The [independent receipt review](OBSERVER_MODE_NATIVE_REVIEW.md) and coordinating task's separate read-only audit verify exact object/generated-class/default identities, both successful exporter returns, empty exporter/error arrays, current helper/installed-file pins, unchanged source-after hash, five ordered checkpoints, and accumulated byte counts. All eight files total **640,141 bytes**. The mode was not already loaded when the helper's named lookup began; native loading can implicitly load dependencies. No explicit parent source lookup/export occurred.

| Artifact | Bytes | SHA256 |
|---|---:|---|
| [Source](evidence/editor-source/observer-mode-20260923T035542Z-8fe04811300f/source.COPY) | 617,929 | `B95A06B61AEEAD0CFE27FD2012E50E7D4BE07353C3E5E4E3DAFBACCAEE5DD551` |
| [Class defaults](evidence/editor-source/observer-mode-20260923T035542Z-8fe04811300f/defaults.COPY) | 9,362 | `BE04EEC660121621A7497A65EDF6F72578C9CCA28EBAF02076C71FD886A9E9CE` |
| Final report | 2,858 | `40833043EC712AE8A03E13041577602636BFC646C8F48B83C0DE108983C765CB` |
| Helper | 14,884 | `AD0EEB1E1FA73E55CEE24F679C27CA3C5AA52C0ABFFC48F4F8D0E88B0F44ED29` |
| Installed mode asset | 229,443 | `1C841BF1C5198B57499F2F872CBABCF3F1F38508054AB8695FCD2F6C41E4F17B` |
| Preserved log snapshot | 124,438 | `6D2A4EC6626227E4AF7B8D5CE64972E41DBF1F5281E830160D22F0C79BEC3C52` |

The helper reports **0.406 seconds** elapsed. Its last sample records **22,831,079,424 bytes disk**, **3,345,879,040 bytes available RAM**, and **4,603,273,216 bytes available commit**. These describe one source export, not gameplay performance, peak memory, future headroom or automated-supervisor admission. The snapshot is local raw evidence pending content review before sharing.

## Controller default and registered initialization

`S` below is the source export above; `D` is the adjacent defaults export. Line numbers are one-based.

**OBSERVED class-default assignment:** `D:45` selects `/Game/Modes/InstantAction/InstantActionPlayerController.InstantActionPlayerController_C` as `PlayerControllerClass`. `D:50` separately selects the base `MW5PlayerController_C` for replay spectators. This resolves the earlier package-reference ambiguity for the default, not which mode/controller is actually instantiated in a mission or whether another setting overrides it.

**OBSERVED registered graphs:** `S:3396–3398` lists only `EventGraph`, `UserConstructionScript` and `ReceiveStartNewGame`. Serialized/generated graph forms elsewhere in the export are not additional authored startup evidence.

**OBSERVED connected parent construction:** at `S:3348`, entry output pin `9052D80A41B92519E558A6ABA95DDF3D` links to parent-call execute pin `99D535A2408195FED3168AB8F25DE14C`; `S:3341` records the reciprocal link. The parent call's outgoing execution pin is unlinked (`3342`). `S:3393` identifies the parent as `/Game/Modes/MW5GameMode.MW5GameMode_C`. This establishes a specific source boundary to inspect, not the parent's body or an observed runtime call.

The registered event graph's `ReceiveProcessStartConditions` output has no execution link (`S:3372`). BeginPlay is explicitly disabled and unlinked (`3376–3384`). The generated wrapper (`2403–2430`) and generated ubergraph event (`2498`) do not supply another connected authored initialization path. Native and inherited behavior remain separate unknowns.

## Connected new-game path

`ReceiveStartNewGame` entry pin `F15FF9444D8135B21E36DB99F2C20018` (`S:3251`) connects to sequence input `AA1C5509447089F27D3D0D92B2B21349` (`3095`). Its nine outputs (`3096–3104`) lead to these source operations:

| Output | Connected operation | Source locations |
|---|---|---|
| 0 | Set the campaign identifier to `InstantAction`. | 3075–3083 |
| 1 | If `StartupScenario` is valid, copy its scenario specification to the output; invalid execution is unlinked. | 3187–3235 |
| 2 | Associate deployment slots 1–4 with players 1–4. | 3127–3169 |
| 3 | Iterate starting pilot assets, require a valid resolved asset, then add its pilot data to the roster. | 2775–2848 |
| 4 | Iterate weapons; addition requires both `CanMechEquip` and ownership of the associated DLC. | 2592–2630, 2871–2889, 2996–3039 |
| 5 | Equivalent equipment iteration and two-part condition. | 2632–2670, 2851–2869, 2940–3028 |
| 6 | Load the Instant Action deployment with the supplied persistent-model argument. | 2572–2580 |
| 7 | If deployed tonnage equals zero, add the starting mech and deploy it in slot 1. | 2519–2547, 2727–2757 |
| 8 | Return from the function. | 3243 |

The serialized `TechLevel == 1` branch (`S:2672–2700`) has no execution links on its input or either output; it is not an active condition in this trace. These are observed graph connections only. This review did not execute the graph or access a persistent model, save, roster or campaign.

No exact `AddPlayerControllerComponents` occurrence exists in either export. That excludes a direct named occurrence in this source set, not indirect/native/dynamic behavior or a caller elsewhere. The collected API declaration identifies native `MWGameMode.h` (`unreal-api-reference.txt:326096–326104`) and the two receive methods (`326404–326428`) but does not contain their implementation.

## Historical next-lookup preparation — now completed

The exact parent package has no asset record in either the 249-entry AI or 18-entry mod collection receipts/allowlists. The subsequent one-asset exports cover only the controller and this mode. Parent metadata is not parent source.

Only **`/Game/Modes/MW5GameMode`** is selected next. Its [observed installed file](OBSERVER_BASE_MODE_ASSET.json) is **18,329 bytes**, SHA256 **`83C3FCE0632F3F92F0594A9534E77A8FA02A523BB5688D015922374E7A296279`**. The [parent-only preparation](../design/OBSERVER_BASE_MODE_SOURCE_LOOKUP.md) will inspect its construction and connected initialization/controller setup, then stop. Its helper passed [70/70 independent MOCK_ONLY checks](OBSERVER_BASE_MODE_HELPER_REVIEW.md); the [preparation manifest](OBSERVER_BASE_MODE_PREPARATION.json) binds the exact helper, asset, review and bounds. Fresh resource and pin checks remain the coordinator's prerequisite for one user-assisted run. No parent load/export has been performed by this preparation, and there is no automatic follow-up beyond it.

The earlier failed reference attempt, successful reference receipts, synthetic test reports and historical supervisor failures remain separate evidence. No observer Blueprint, registration instance, descriptor, asset mutation, cooking, installation or gameplay acceptance follows from this export.

## Later outputs at handoff

A repeated mode run produced `observer-mode-20260923T041339Z-46bd6b40588b`. Its report SHA256 is `023D048A89EBE177939AB532D4392479DD543232856E18E4586A6A57E62CF125`; direct hashing confirms its source/default text is byte-identical to the first reviewed export. Preserve that duplicate separately; it does not supply parent source or justify another mode run. Its full independent receipt review is not part of this result.

The exact parent directory `observer-base-mode-20260923T041436Z-7a4f6d0899d6` subsequently appeared after the preparation baseline. Its [completed result](OBSERVER_BASE_MODE_NATIVE_RESULT.md) reaches an empty Blueprint body and native parent without exposing a factory caller. Do not request another native run; the preparation above remains historical.
