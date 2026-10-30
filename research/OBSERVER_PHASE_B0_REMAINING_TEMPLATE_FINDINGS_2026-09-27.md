# Remaining B0 node templates

2026-09-27. **OBSERVED source schemas; new PCC specialization and connections PROPOSED.** All five required operations already have registered native-source node definitions. Manual creation of every node is avoidable: a bounded assembled candidate can reuse these wrappers and observed native PCC types, then receive native compile/export review. This search produced no candidate and performed no editor action.

Exact fields, every pin line, source hashes, line numbers and node/graph registrations are preserved in [exact-source-nodes.json](evidence/phase-b0-remaining-template-search-20260927-01/exact-source-nodes.json), 21105 bytes, SHA256 `97a46cd042f3a2bd6074c5a80aad8c765c818baf115b90d2f5a8fe7a1d0c9a0d`.

| Operation | Source node and body line | Observed shape; remaining proposal |
|---|---|---|
| Array Length | Observer `EventGraph.K2Node_CallArrayFunction_0`, 420 | KismetArrayLibrary.Array_Length, pure; ActorComponent **object array**, reference/const TargetArray; Int result. Substitute the exact observed PCC object item type as a **proposed specialization**, then verify native output. |
| Array Clear | Observer `EventGraph.K2Node_CallArrayFunction_1`, 179 | KismetArrayLibrary.Array_Clear; execute/then plus the same ActorComponent object-array reference/const input. PCC specialization remains proposed; leave execution disconnected in the type proof. |
| Is Valid | Observer `EventGraph.K2Node_MacroInstance_0`, 593 | StandardMacros.IsValid, GraphGuid `64422BCD430703FF5CAEA8B79A32AA65`; generic CoreUObject.Object InputObject with valid/invalid exec exits. Node schema is observed; the new PCC-object connection is proposed. |
| Is Valid Class | SquadOrderBase `IssueOrder.K2Node_CallFunction_15`, 310 | Pure KismetSystemLibrary.IsValidClass; generic CoreUObject.Object **class** input and Bool result. Existing producer is MWJob class through a knot. New PCC-class connection remains proposed. |
| Get Path Name | Observer `EventGraph.K2Node_CallFunction_6`, 438 | Pure KismetSystemLibrary.GetPathName; generic const CoreUObject.Object input, String output. Existing producer is Self object. **No class-reference-to-Object link was found in the selected sources.** Proposed PCC-class connection must survive native compile/export without an invented conversion. |

Observer source: `evidence/editor-source/observer-authored-20260925T052357Z-b89383e2/BP_LanceObserverProbeComponent.COPY`, 311678 bytes, SHA256 `7ca123068c6a73ee2e4a9ca9bc970f3e3cd88223951be239edff1f2b9c212ce4`. Squad source: `evidence/editor-source/ai-research-collection-20260921T030437Z-f7d8e930/003-SquadOrderBase-source.COPY`, SHA256 `dee7eb994d93fde96e240988322664ecbeacf1db933a75301e7ac33f0ad00fd0`.

The stock MW5PlayerController catalog's `AddPlayerControllerComponents.K2Node_CallArrayFunction_1` is a PCC **class array** Clear; it is not the desired PCC object array and must not be copied unchanged. PlayerControllerSwitchMech's three Length nodes are Actor arrays. This is why subtype names alone are insufficient.

The current seven-node partial proof already supplies the exact PCC object and specialized PCC class local declarations, native GetObjectClass specialization, and local setter pins: `phase-b0-capture-types-native-01/types.COPY`, 875671 bytes, SHA256 `9b5a67b82422edc7c3d3f766d0c773a8041ca50c5196516ebf3ff5eae4efd043`; independently reviewed specifications SHA256 `b7ddef93ead09da27691f7ae7b9d2646723530f9b5d4334b68679df6d02820cf`. A class local getter is the sixth new node: its destination scope/name/GUID/type can come from that declaration, with a source-backed getter wrapper. Its assembled form still requires native review.

A separate 13-node whole-function candidate may preserve the seven-node pattern, add the five wrappers plus that getter, use fresh graph-local identities, and connect only the explicit proposed data edges. No setter, Clear or validity execution is connected. After import, compile/export must establish the exact resulting types, all reciprocal edges, registrations and preservation of prior graphs. A refused edge or automatic conversion is an observation to review, not permission to silently alter the algorithm. Source shape and compile success do not establish execution behavior.

Search was bounded to the pinned observer/diagnostic exports, relevant collected stock controller/component/order sources, and current scratch proof exports. It did not search every asset and makes no unavailability claim.
