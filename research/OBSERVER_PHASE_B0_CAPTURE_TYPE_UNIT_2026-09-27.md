# Phase B0 capture type proof

September 27, 2026. **PREPARED; this unit's native authoring/export NOT_PERFORMED.** This is the narrowed type proof selected by the coordinator for the intermediate one-page attachment snapshot. Full Phase B and its broader String-array capture plan remain deferred. This document supplies scratch authoring scope, not a completed B0 implementation or permission to deploy it.

Use only the existing unplaced, unsaved `BP_CodexAuthoringProbe` in the owned editor. Root owns every native action. Accepted source baseline: `evidence/phase-b-no-local-wrapper-native-01/wrapper.COPY`, 858187 bytes, SHA256 `677e2269f8cc78d9bb84b8ebf91c2fa39d7e95e5d7091fdab7f47369221c4b41`, reviewed by `native-wrapper-review.json`. Preserve all earlier graphs, members, functions and execution links. The separate wrapper invocation may complete before this unit; it does not change this source baseline unless a fresh export establishes otherwise.

## Native additions

Names below are proposed scratch names. Node labels are search targets whose actual identity/types must be observed and later exported.

1. Add one function, `ProofB0CaptureTypes`, with **no inputs, outputs or call node**. Keep its Entry execution unconnected. No new member variable is needed.
2. Place Get for the existing `ProofComponents` member. From that stock PlayerControllerComponent object-array output create **Get (a copy)** at index 0, array **Length**, and array **Clear**. Leave Clear execution unconnected and Length's result unused. This does not execute an array access or clear.
3. Promote the ArrayGet returned PCC object to a **local** named `ProofCurrentComponent`, using only the visibly offered local-variable action. Keep its Set execution unconnected. Place its local Get. The ArrayGet output must have exactly one consumer: the local Set value.
4. From that local Get add the already-observed **Get Object Class**. Promote its class result to local `ProofCurrentClass` and place that local Get. Preserve its generic CoreUObject.Object **class reference** type. Keep Set execution unconnected; GetObjectClass's result has exactly one consumer, this Set value.
5. Connect the PCC local Get to a question-mark **Is Valid** node's Input Object only. Leave Is Valid execution unconnected; no PCC object path node is needed for this narrowed B0 scope.
6. Connect the class local Get to **Is Valid Class** and another **Get Path Name** Object input. Record the editor's actual acceptance or refusal of class-reference-to-object compatibility. Leave results unused; do not substitute a cast, load or invented conversion if refused.
7. Compile once and preserve the observed result. On success, dispatch the separately reviewed fresh entry for the exact loaded scratch COPY export. No function invocation, event link, Play or save is part of this unit. Root may also collect the separately reviewed three disconnected text-helper caller templates before the same combined export; that separate candidate/scope must be pinned by the fresh entry, and those additions must be compared independently.

The proposed graph contains 13 nodes and two local declarations if the void function supplies only an Entry node and no adapters are inserted. This is an expectation to check against native output, not a fixed result to manufacture. A refusal, unexpected node, type or compiler result stops input for review. There is no String array, String-array port, array Add or new function caller in B0's scope.

## Source review and cleanup

The fresh export must establish the PCC member-array Get and specialized array node classes/pins; exact PCC object and generic Object class local declarations, GUIDs and Get/Set references; all reciprocal data edges; accepted PCC-object validity and class-reference validity/path compatibility; and disconnected execution for every mutating node. Pure sources feed a single storage setter, but **the disconnected template does not establish runtime storage ordering**. That ordering belongs in the later executable capture graph.

Compare all prior registered graphs and declarations against the accepted wrapper baseline. Record compile-generated identity/serialization changes separately. Confirm no existing event path reaches the new function and no new members or unrelated changes appeared. Source and original backup must remain 28153 bytes/SHA256 `0b7d06f0004d67d1944cd288b44a4b63d7f95d4e17de22b8ee828f4f96f0b6dc`; autosaves remain separate preserved artifacts. Source: `C:/Program Files/Epic Games/MechWarrior5Editor/MW5Mercs/Content/CodexEditorControlScratch20260925/BP_CodexAuthoringProbe.uasset`; backup: `artifacts/editor-authoring-probe-20260925/BP_CodexAuthoringProbe.uasset`.

`scripts/Inspect-PhaseB0CaptureTypes.py` is a bounded derivative of the consumed wrapper exporter, with a new output directory/stage and current baseline pins. It finds only the already-loaded exact Blueprint and exports it, without load/save/compile/query execution. Its 2 MiB bound is checked after the synchronous COPY export; no native call can be preempted by these Python guards. The timed entry is deliberately deferred until root requests it, then must pin the helper, this scope, accepted baseline/review and unchanged source/backup, plus editor PID/executable/creation and a fresh expiry. Previous entries stay consumed and unchanged.

Retain this reviewed unsaved scratch state only for immediate bounded continuation. Final cleanup is root's observed undo or normal owned-editor close/discard of these known scratch changes, followed by source/backup verification. No original observer, Phase A diagnostic asset, package, retail file or mod setting changes belong to this proof.
