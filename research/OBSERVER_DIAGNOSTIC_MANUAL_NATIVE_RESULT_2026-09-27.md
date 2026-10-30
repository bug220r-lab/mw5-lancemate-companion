# Diagnostic template inspection: native collection reviewed

**PASS_NATIVE_SOURCE_COLLECTION_REVIEW — September 27, 2026.** The user executed the corrected single-use command at 04:18:16.580 UTC. It completed at 04:18:57.302 UTC. This is actual editor collection, not a mock result. The [post-run review](evidence/diagnostic-manual-inspection-20260927T041624Z-47db1fef/POST_RUN_REVIEW.json) records a primary offline verification; no second independent reviewer is claimed.

## Verified result

- The exact diagnostic Blueprint root and five planned subobjects were found with the expected paths, classes and immediate outers. The worker recorded two root finds, five subobject finds, five exports and zero explicit asset loads.
- All five raw exports were rehashed, their indexes reproduced from raw bytes, and their bodies compared with the pinned historical stock exports. All five are byte-identical: SimpleConstructionScript_0, InheritableComponentHandler, PlayerControllerSwitchMech_GEN_VARIABLE, PlayerControllerAirStrikeComponent_GEN_VARIABLE and ControllerFeedbackComponent_GEN_VARIABLE. These are different-time snapshots, not simultaneous stock/diagnostic observations.
- The manifest, canonical entry, helper/test/review pins and consumed dispatch claim agree. The invocation falls within its review window. The editor remained the same responding process (PID 11980, creation FILETIME 134349304323350249).
- All 27 protected paths matched. The complete 30-file inventory of both mod roots and the diagnostic selection markers matched the pre-dispatch baseline.
- Continuous log bytes 135776 through the captured end contain exactly the command and three result lines. No new warning, error or ensure occurs in that interval. The red LOG_ROTATED traceback visible above them belongs to the preserved earlier failed-admission attempt.

Evidence and reproducible **offline-only** verification are in [the attempt directory](evidence/diagnostic-manual-inspection-20260927T041624Z-47db1fef/POST_RUN_REVIEW.json). Its verify-result.py performs file checks only; it never imports Unreal or dispatches commands. Original native receipts retain COLLECTED_REQUIRES_REVIEW; this separate review records the outcome. Do not rerun either consumed native entry.

## What this resolves, and what remains

**OBSERVED:** all three previously warned generated templates now exist at their exact diagnostic object paths after the selector-triggered reload. The SCS text describes the default scene root; the handler and component exports contain little or no property body. The earlier hypothesis that the final loaded diagnostic controller simply lacks those five objects is not supported.

**UNKNOWN:** effective inherited values, resolved reference targets, repair of references nulled during the historical first copy, and cold disk/memory equivalence. Text containing an archetype path does not verify the referenced object. This inspection does not establish a healthy complete reference graph.

The historical final-save log independently identifies a separate validator problem: `EditorValidator_Localization did not include a pass or fail state`, with `IsValidationStateSet()` at EditorValidatorSubsystem.cpp line 164. This means that invocation failed to report a validation outcome; it does not by itself say that the diagnostic content failed localization validation. Cause and packaging impact remain UNKNOWN. The local named DataValidation plugin and MW5 Content search did not locate the validator implementation or subsystem source; that limited search is not proof that the implementation is unavailable everywhere.

Source: [preserved final-save log](evidence/editor-source/diagnostic-control-editor-log-20260925T2218Z/MW5Mercs-2218.log), lines 1272–1283; SHA-256 `09f80bc833f6d3d87b050d473bdadaa7986edd0522496a444537225f2f0ede7a`. Applicable editor: UE4.26.2 CL14830424. Access/review: September 27, 2026.

## Next bounded work

Finish the remaining warning-impact review before moving to packaging: locate the installed localization validator implementation (including editor plugin content/source), inspect its pass/fail paths offline where available, and identify the specific unresolved component-reference fields that require native readback. Reuse these five exports; do not repeat the template-presence experiment. If runtime reference inspection is necessary, prepare one exact read-only query of the identified fields, with a source/log baseline and no load, save or repair. Do not substitute guessed Unreal Python properties.

The next user action is **none** while that review is prepared. Leave LanceObserverDiagnosticControl selected and keep the current editor session available. Any later console entry must be newly reviewed; the prior command is consumed. Cook/package, retail deployment, game acceptance and Phase B enumeration remain NOT_PERFORMED in this work unit. The existing package preflight remains the boundary for a later package decision; no automatic selector restoration, restart or speculative asset fix was performed.
