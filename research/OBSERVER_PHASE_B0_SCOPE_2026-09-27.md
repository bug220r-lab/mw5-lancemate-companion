# Phase B0: one-page attachment diagnostic

2026-09-27. **SELECTED INTERMEDIATE IMPLEMENTATION SCOPE; NATIVE IMPLEMENTATION AND RETAIL ACCEPTANCE NOT_PERFORMED.** This is a smaller diagnostic step toward the unchanged [full Phase B contract](OBSERVER_PHASE_B_SOURCE_CONTRACT_2026-09-27.md). It does not complete or cancel that contract. The original observer and tested Phase A source/package remain preserved. No native action was performed to write this document.

## Question and evidence

In one bounded, sequential capture, does the array returned for the actual diagnostic controller Self and the fixed stock PlayerControllerComponent class contain an entry whose subsequently checked valid class path exactly equals the probe-class string? The query and later per-entry checks are **non-atomic**; they do not establish that every observation held at one instant.

The diagnostic's existing first-F8 marker was screenshot-observed in retail; separate lifecycle checks were user-reported, with the qualifications retained in [the Phase A result](OBSERVER_DIAGNOSTIC_CONTROL_RUNTIME_RESULT_2026-09-27.md). This is not evidence that B0 runs.

Source support, collected for editor1.1.390.0e / UE4.26.2:

| Source | Relevant evidence and limitation |
|---|---|
| [Diagnostic controller COPY](evidence/editor-source/diagnostic-final-source-20260925T221745Z-530263a1/controller-source.COPY), lines293–439 | Existing F8 input, nonconsuming action, Do Once, owned widget creation/display, validity checks, widget-only removal and parent EndPlay. Preserve these behaviors. |
| [Widget COPY](evidence/editor-source/diagnostic-final-source-20260925T221745Z-530263a1/widget-source.COPY), lines26–51 | Registered SetSnapshot(Text) calls TextBlock.SetText; use its actual native binding. |
| [Stock controller COPY](evidence/editor-source/ai-research-collection-20260921T030437Z-f7d8e930/010-MW5PlayerController-source.COPY), lines4808–4816 and4864–4870 | K2_GetComponentsByClass, fixed stock class selection and PCC object-array return; declared API Array(ActorComponent) does not replace the observed selected pin type. |
| [Installed API declarations](evidence/editor-source/mod-research-collection-20260921T023909Z-5eeaf52a/unreal-api-reference.txt), lines201552–201563,217544–217555,217961–217971 | GetObjectClass, IsValidClass and GetPathName identities. Declaration availability alone is not native pin-compatibility or gameplay proof. |
| [Native reconstructed templates](evidence/phase-b-missing-template-proof-20260927-01/native-template-specifications.json) and [local bindings](evidence/phase-b-local-binding-proof-20260927-01/local-binding-specifications.json) | Actual native call pins and scalar local/caller binding patterns. PCC/class-reference locals and specialized PCC array operations still require their own native evidence. |

Fixed query class:
`/Game/Objects/_common/Components/PlayerControllerComponents/PlayerControllerComponent.PlayerControllerComponent_C`.

Exact comparison **string**, never a loaded class, cast or asset dependency. Probe-class resolution is explicitly **NOT_CHECKED**; this unit does not establish whether that literal resolves to the intended class in this runtime:
`/LanceObserverProbe/BP_LanceObserverProbeComponent.BP_LanceObserverProbeComponent_C`.

## Finite behavior

1. First F8 retains the independent static marker. Set the control-attempt flag before the existing creation route; exit without component or class lookup. Human observation of the marker remains required before second F8. Widget validity is not display proof.
2. Second F8 consumes the one snapshot attempt before any guard or query. Require the retained widget, unpaused/local controller, valid fixed stock class, and bounded nonempty Self object-path identity. Read each needed value once and store it before reuse. Record the actual selected stock-class validity result explicitly; an unperformed check remains NOT_CHECKED and a false result remains INVALID. Validity does not prove this is the intended runtime controller or the factory's target. A guard/identity failure displays an explicit NOT COLLECTED reason when the existing widget is valid; no replacement widget, query or retry follows.
3. Query Self with the exact stock class once. The pure return has exactly one execution-dependent consumer: Set of the correctly typed stored array. Store the full array Length once. Never connect the pure query directly to Length, formatting, a loop or later F8.
4. Fixed loop0–31 only; test index against the stored full count before every Get. Store the component, validate it, store its class, validate that class, then store its path. Require nonempty valid identity within256 UTF-16 units before exact case-sensitive comparison. Invalid component/class/class-path increments the invalid count and continues; it is not a valid nonmatch. No component object-path read, component invocation, creation, activation, load, ordering or mutation belongs in this loop.
5. Freeze returned/visited/valid-checked/invalid/matching-entry counts and class-scan completeness. Clear the captured component array and current component/class references after these strings and counts are frozen, including failure exits. Publish one bounded snapshot through the existing widget setter.
6. All later F8 presses do nothing. No repeat lookup, retry, reset, widget creation or page advance. EndPlay clears the retained output/reference and attempt-owned data and reaches the existing parent EndPlay exactly once; do not reset either attempt before teardown.

The output is explicitly **B0, SEQUENTIAL CAPTURE, NOT LIVE**. It includes the full bounded Self object path and returned/visited/valid-checked/invalid counts, a qualified probe matching-entry result, **Stock class: VALID/INVALID/NOT_CHECKED** reflecting the actual guard result, **Probe resolution: NOT_CHECKED**, and **DETAILS/PAGING DEFERRED**. The evidence records these same qualifiers and the non-atomic capture limitation. Match counts describe raw captured-array entries, not distinct objects or component instances.

If the captured array has at most32 entries and every returned entry was visited and validly checked, the displayed exact matching-entry total is complete for the sequential checks of that captured array. A positive match observed during a partial scan establishes that a captured entry's valid class path matched the literal when that entry was checked; the total remains UNKNOWN, so report only the observed matches among checked entries. Zero with any invalid entry, count over32, interrupted scan or other uncertainty is UNKNOWN, never an absence claim. Even complete zero means only zero literal matches among the validly checked entries in this captured Self/selected-class array. It does not establish that this Self is the intended controller or factory target, that the probe class resolves, that all observations were simultaneous, or that the observer is absent globally. A class-path match does not prove BeginPlay ran, the overlay worked, registry/factory provenance, or lifecycle correctness.

Self raw path remains limited to256 UTF-16 units, displayed in complete segments of at most40 without splitting pairs or adding an ellipsis. The single final page must include all labels, counts, status and newlines within768 UTF-16 units and16 visible lines. Check bounds before concatenation and retain the actual final check. Refuse an overlarge identity before the query; a post-query formatting overflow produces a bounded INCOMPLETE result with match total UNKNOWN. Do not mislabel overflow as an empty array. Native wrapping/glyph fit remains a required check, not a consequence of character counts. The existing generated text helpers remain candidates for reuse subject to their separate native execution acceptance.

## Narrow typed-template collection

This list supersedes only the immediate collection scope for B0; [the full capture template plan](OBSERVER_PHASE_B_CAPTURE_TEMPLATE_UNIT_2026-09-27.md) remains the deferred full-Phase-B plan. Root owns all native actions. Use a fresh reviewed full scratch export at the unit start, after the current wrapper work, with exact source/backup/process guards; old collected exports are schema evidence, not current live-state proof.

Create one disconnected scratch function `ProofB0CaptureTypes` (a proposed scratch name), with no requested user inputs or outputs. Collect only:

- Existing typed ProofComponents member Get feeding native PCC-array Get(copy), Length and Clear. Index0 is an unexecuted template default; Clear execution is disconnected.
- Promote the array item to a PCC **local** `ProofCurrentComponent`, with one setter consumer and an explicit local getter.
- Local component getter to GetObjectClass; promote its result to generic Object **class-reference local** `ProofCurrentClass`, with one setter consumer and local getter.
- Component getter to Is Valid; class getter to Is Valid Class and to GetPathName.Object. These four edges, including the class-reference-to-object-input edge, must be accepted and exported natively. A refused edge is a recorded blocker, not permission for a guessed cast.

All setters, Clear and validity execution pins remain disconnected; the function is never invoked. No String-array local, Add, String-array input/output/caller, component object-path node or disconnected helper caller is required for this narrower unit. A Return node or direct Entry-to-Return connection is only added if the native compiler actually requires it, with that change recorded and no execution of setters/array nodes.

Compile/export review must confirm registrations, actual local VarGuid/MemberScope/declared types, exact array container/item/reference flags, the four compatibility edges, and preservation of all earlier graphs and declarations. Before B0 authoring in the diagnostic controller, still collect its destination-specific attempt-Boolean/stored-array member GUIDs and any same-Blueprint helper call bindings; scratch GUIDs must not be copied as diagnostic destination identities. Existing widget SetSnapshot is reused with its observed native target/signature.

## Acceptance, deferred work and cleanup

Acceptance requires reviewed final diagnostic controller/widget exports, one-query/one-stored-consumer validation, fixed-loop/invalid-path logic, no new probe asset reference, native bounded text/summary fixtures, and a reviewed new source/package/install baseline before a disposable Instant Action test. In-game acceptance records first-F8 marker, second-F8 Self/count/result snapshot, unchanged output/no resample on extra F8, normal controls, and owned cleanup. Existing saved Phase A files are the rollback source; neither editor compile nor a successful wrapper call is shipping acceptance.

Full per-entry object/class paths, controller-class/level context pages, detail completeness, retained row accounting/atomic pairs, page arrays, page indexing/navigation, multi-page aggregate accounting and full Phase B acceptance are explicitly deferred. B0 must not claim those checks or report full Phase B COMPLETE. This intermediate scope does not authorize voice, recording, orders, autonomy or persistence.

For the disconnected scratch collection, preserve the pre-unit export and unchanged source/backup hashes; root removes only the new isolated function via the known undo route and verifies a post-cleanup export, or explicitly records retaining unsaved scratch state for the next bounded unit. Preserve autosaves; do not delete them. For a later B0 retail attempt, preserve the known Phase A package/configuration hashes first, exit the game before changing installation state, and restore/verify that recorded baseline under the separately concrete deployment/rollback unit. Do not overwrite the original observer or use the main campaign. Unexpected ownership/focus, mutation, compile/type mismatch or runtime behavior stops the unit with evidence preserved.
