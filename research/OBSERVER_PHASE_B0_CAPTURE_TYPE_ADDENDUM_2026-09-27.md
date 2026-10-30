# Observed class specialization and B0 continuation

September 27, 2026. The original type-unit plan and its consumed partial export entry remain unchanged. This addendum replaces only the plan's assumption that the promoted class local would have generic CoreUObject.Object class-reference type.

The partial native export at 11:48:49 UTC contains exactly seven nodes, eighteen pins, two locals and four reciprocal data connections in `ProofB0CaptureTypes`; no execution pins are connected. [Independent review](evidence/phase-b0-capture-types-native-01/partial-native-review.json) verifies all earlier records unchanged, including generated ReceiveBeginPlay in this particular comparison. Root changes are limited to the new function registration and editor view record. Saved source and backup remain unchanged. This partial graph has **not been compiled or invoked**.

The displayed Get Class is the existing native `K2Node_CallFunction` for `/Script/Engine.GameplayStatics.GetObjectClass`. Its Object input remains generic Object, fed by the stored PCC object. The native ReturnValue and promoted `NewLocalVar_1` have `PinCategory="class"` and the exact BlueprintGeneratedClass subtype `/Game/Objects/_common/Components/PlayerControllerComponents/PlayerControllerComponent.PlayerControllerComponent_C`. The local is a class reference, not a component instance. Its GUID is `B3AA666740F5CD55CD4AFEB058F98EB0`.

Retain that observed specialization; do not force a generic class type. It is suitable as the PCC-specific B0 source template pending the remaining native connections and compile. It does not yet prove runtime output, class-validity/path compatibility or shipping behavior.

Root's next bounded authoring actions are:

1. Rename `NewLocalVar_1` to `ProofCurrentClass`, preserving its native class-reference type/GUID, and add its local Get.
2. Add array Length and Clear from the existing `ProofComponents` member Get. Keep Clear execution unconnected.
3. Connect the PCC object local Get to the question-mark Is Valid Input Object; keep execution unconnected.
4. Connect the PCC class local Get to Is Valid Class and Get Path Name's Object input. Record actual acceptance or refusal and any native adapter. No guessed cast, conversion, load or replacement type.
5. After those observations, root may add the separately reviewed three disconnected text-helper caller templates in EventGraph, compile and obtain a fresh combined export. Preserve prior authored nodes and all events. No invocation, save, package or retail work is included.

The type graph still expects thirteen nodes after the six missing nodes are collected. The three caller templates belong to the separate EventGraph scope. Native additions/counts and any name/type/pin changes must be independently reviewed against the partial export. The consumed partial exporter/entry must not be replayed or rewritten; final collection needs a new output unit and fresh pinned entry.

## Accepted separate-function route

The coordinator subsequently selected an offline generated whole-function candidate, `ProofB0CaptureTypes_Full`, in place of manually adding the six nodes to the partial function. **The original seven-node `ProofB0CaptureTypes`, including `NewLocalVar_1`, stays unchanged.** The later caller export already confirms that preservation and has separately captured the three helper signatures and empty editor-callable fixture function.

The new candidate contains thirteen nodes, thirty-six pins, two freshly identified locals and nine reciprocal data connections. All execution pins remain disconnected. It has no inputs, outputs, caller or invocation mechanism. It retains the scratch-owned `ProofComponents` member binding; it is not a portable payload for a diagnostic controller.

The seven-node body comes from the reviewed partial export. Added array Length/Clear use native ActorComponent **object-array** templates from `BP_LanceObserverProbeComponent.COPY` (SHA256 `7ca123068c6a73ee2e4a9ca9bc970f3e3cd88223951be239edff1f2b9c212ce4`), specialized in the candidate to the already observed PCC object-array type. The same source supplies generic IsValid and GetPathName templates. IsValidClass comes from the registered `SquadOrderBase.IssueOrder.K2Node_CallFunction_15` source (SHA256 `dee7eb994d93fde96e240988322664ecbeacf1db933a75301e7ac33f0ad00fd0`). The new class-local Get uses the actual local getter structure with the exact observed class-local declaration/type. All function names, node classes and parameter names come from those sources.

**PROPOSED, not native-observed:** PCC specialization of those array-operation pins, the new class-local getter instantiation, and PCC/class connections to generic validity/path inputs. These are explicit implementation proposals requiring native import/compile/export review, not claims of previously observed type compatibility. No cast, new MW5 interface, reflection mutation or asset load is introduced. No scalar assembly core file is changed.

Candidate artifacts and source/transform audit are in `evidence/phase-b0-capture-type-function-20260927-01`. Structural checks cover exact native names/types, fresh node/pin/local identities, reciprocal internal links, absence of connected execution, source pin drift and preserved distinction between object and class arrays. Their result is MOCK_ONLY. Before any later paste, root must independently review the candidate and stage it through a separately bounded helper. A fresh post-import export must show the separate function registered correctly, actual specialized pins/edges, compile result and complete preservation of the partial original and all other source. No execution, save, package or retail action belongs to this type proof.
