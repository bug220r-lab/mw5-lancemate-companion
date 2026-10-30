# Native text-helper fixture checkpoint — 2026-09-27

**PASS: six fixed Blueprint fixtures ran in the editor at 12:47:37 UTC. Cleanup is pending a separate observation.**

The reviewed `RunFixedTextHelperFixtures_Proof` function ran on the sole selected scratch actor `/Temp/Untitled_1.Untitled:PersistentLevel.BP_CodexAuthoringProbe_2` in the disposable unsaved level. Root reports clicking the correct Call in Editor button once. Independent review verified the source graph, previously recorded actor/world identity, unchanged log prefix, and exact recorded byte range; it did not operate the UI.

The log contains exactly `BEGIN`, `PASS01` through `PASS06`, and `END PASS`, in order, from that actor in frame 233 at 12:47:37.199–12:47:37.202 UTC. The original log bytes at offsets 857340–858301 equal the preserved 961-byte invocation log. No earlier matching marker from that actor occurred in the verified prefix.

| Fixed case | Native comparison passed |
| --- | --- |
| ASCII identity | Valid, 11 UTF-16 units |
| Identity containing LF | Rejected, 3 units |
| 40-unit path boundary | Complete two-line segmentation |
| Supplementary-character boundary | Intact rocket pair moved to the second segment |
| Valid summary page | Exact decorated page, 91 units |
| Invalid page count | Rejected with empty page and 0 units |

This is native Blueprint execution evidence for these six inputs. It does not establish exhaustive helper correctness, a finished B0 snapshot, full Phase B, retail-game behavior, widget fit or font fallback. The earlier offline mock results remain distinct.

The pre-placement title-screen baseline had six actors, no selection or dirty maps, and only the owned scratch Blueprint dirty. The 12:45:48 postplacement observation showed the one selected owned actor, only `/Temp/Untitled_1` dirty as a map, and the same owned scratch content dirty. Both observations are sequential, not atomic. The saved scratch asset and its project backup still matched their recorded hash during this review.

The native fixture export returned true with no exporter errors, then its 2 MiB size check stopped the helper. That `STOPPED_NO_RETRY` receipt remains preserved. Its existing 2,229,892-byte UTF-16LE file was independently reviewed within a separate 4 MiB offline bound, without another native export; all 50 nodes, 294 pins, 70 reciprocal connections and the supplementary literals were verified.

**Cleanup: PENDING.** Restore the exact recorded title-screen world without saving the disposable map, then review the separate cleanup observation for the original six actors, empty selection/dirty-map list, and unchanged owned scratch content state. Do not treat fixture success as cleanup completion.

Evidence: [native test receipt](evidence/phase-b-fixed-text-fixtures-native-01/native-test-result.json), [invocation log](evidence/phase-b-fixed-text-fixtures-native-01/invocation.log), [independent source comparison](evidence/phase-b-fixed-text-fixtures-native-01/native-fixtures-second-review.json), [original world baseline review](evidence/phase-b-fixture-world-baseline-20260927-01/actual-baseline-independent-review.json), [postplacement observation](evidence/phase-b-fixture-world-postplacement-20260927-01/postplacement.result.json).


## Cleanup completed — 2026-09-27 13:22:15 UTC

**Current result: six fixed native editor fixtures PASS; fixture-world cleanup PASS.** The preceding pending-cleanup paragraphs are the preserved initial checkpoint.

The separate five-call cleanup observation restored the exact original `TitleScreen_Video` world and all six baseline actor paths/classes. Selection, dirty maps and dirty content were empty. The disposable scratch actor was absent from the current restored level. This does not claim that every temporary object has been garbage-collected.

After the fixture run, root deliberately saved the owned scratch Blueprint to its existing path and created a durable project checkpoint. The current source and new backup are both 834,972 bytes, SHA-256 `4a19924a8bb305d5e449e851c508fb7d0cafeccce8961e77f2a351f627583b32`. The original 28,153-byte backup remains unchanged. This authorized save explains why the baseline's one dirty scratch package is now clean; reload equivalence has not been tested.

Independent review rechecked all 27 protected Phase A/probe/source/package/installed files, 15 baseline backup files, and the retail modlist: every byte count and hash still matched. The deliberately changed scratch asset is outside that protected set, so no protected-file exclusion was required.

The historical `native-test-result.json` is preserved byte-for-byte with its original pending-cleanup statement. The separate [cleanup review](evidence/phase-b-fixture-world-cleanup-saved-20260927-01/cleanup-independent-review.json) records this later completion and fresh integrity checks. The [saved checkpoint receipt](../artifacts/phase-b-scratch-saved-checkpoint-20260927T130837Z/CHECKPOINT.json) records the intentional save. No retail behavior, completed B0 snapshot or full Phase B result is claimed.
