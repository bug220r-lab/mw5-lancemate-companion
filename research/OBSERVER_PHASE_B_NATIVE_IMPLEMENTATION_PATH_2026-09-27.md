# Smallest practical native Phase B authoring path

**PROPOSED implementation decomposition; offline source inventory only.** Preserve the complete [current contract](OBSERVER_PHASE_B_SOURCE_CONTRACT_2026-09-27.md), including its 32-slot class scan after detail storage closes. The practical route is a small existing Event Graph calling a few UI-created impure functions whose internal nodes are generated from reviewed templates. Function/local-variable clipboard binding is still unproven; establish that once before generating large bodies. No model, native asset, package or game change was made for this report.

The [three-node proof](evidence/phase-b-three-node-proof-20260927-01/pasted-review.md) establishes native paste/compile of Self, the component query and GetPathName with their two reciprocal links. It does **not** establish execution, variable creation, function creation or cross-Blueprint member binding. The [typed-variable proof](OBSERVER_PHASE_B_TYPED_VARIABLE_PROOF_2026-09-27.md) is the appropriate immediate next step. Its result must be reviewed separately; this inventory does not preaccept it.

## Collect only the missing building blocks

| Priority | Exact next template/proof | Why it is needed |
|---|---|---|
| 1 | Native Get Object Class and Is Game Paused nodes; record the actual emitted references and all pins | Installed declarations exist, but their registered node templates are absent from the reviewed catalog/244-source search. They gate class identity and prequery pause refusal. `GetClass` is merely a search term, not a separate invented API. |
| 2 | Get Character as Number plus a bounded Unicode fixture using Len/GetSubstring | The installed declaration exists, but its node template is missing. Verify UTF-16 indexing and surrogate behavior; Python success cannot establish the engine's semantics. Test BMP, supplementary characters at the 40-unit boundary, 256/257-unit paths and invalid/control-character rejection. |
| 3 | One scratch impure function with a String input, Boolean/String outputs, a String local, its local Set/Get, Return and same-Blueprint call node | This proves function signatures, local `MemberScope`/GUID binding and generated body import. UI-created shells avoid assuming clipboard text registers a function or a variable. |
| 4 | String-array variable Get/Set and specialized Add/Get/Length/Clear; one call to the **diagnostic widget's own** SetSnapshot | Catalog Add/Clear examples are class arrays; array wildcards must specialize correctly. The original observer's SetSnapshot call refers to another widget class and cannot be copied unchanged. |

GetSubstring no longer needs a new native example: this review found and verified the registered stock node `CombatRolesToString.K2Node_CallFunction_111` in `232-MW5_GameplayTagLibrary-source.COPY`, function reference line1973, node registration2039, function registration2124. Extract it offline. Likewise extract registered BooleanAND (`010`, line2186; registrations2299/8436), Not_PreBool (`010`,2923;4462/8418), EqualEqual_IntInt (`008`,4934;5030/7081) and LessEqual_IntInt (`001`,5173;5217/5888). These checks used the existing lexical parser and verified each file against its catalog hash; no new catalog or graph was generated.

## Native inventory already available

The [26-example catalog](evidence/phase-b-node-examples-20260927-v2-complete.json) supplies registered source fields and pins for:

- `K2_GetComponentsByClass`, GetPathName, IsValidClass, IsLocalController and GetCurrentLevelName.
- Branch, execution sequence, IsValid, DoOnce, ForLoopWithBreak and ordinary variable Get/Set.
- Array Get, Length, Add and Clear, with their recorded source specializations.
- Len, exact EqualEqual_StrStr, Add_IntInt, Less_IntInt, Concat_StrStr, integer-to-string and string-to-text conversions.
- SetSnapshot entry, original observer SetSnapshot call and TextBlock SetText. The destination diagnostic widget already owns SetSnapshot; create its actual call seed from ControlReadout.

The actual Phase A [controller export](evidence/editor-source/diagnostic-final-source-20260925T221745Z-530263a1/controller-source.COPY), lines293–439, supplies owned cleanup, parent EndPlay, widget creation, ControlReadout, validity, AddToViewport, DoOnce and the F8 input route. Keep these identities and the unrelated construction/postmission paths. Its member declaration is at465. The [diagnostic widget export](evidence/editor-source/diagnostic-final-source-20260925T221745Z-530263a1/widget-source.COPY), lines26–58/128, has the exact impure SetSnapshot(Text) function and registered TextBlock setter. Its saved layout at107–119 is still 900×260; the proposed 1100×600/18-point/per-character layout requires a separate Designer edit and native verification.

Installed API declaration anchors are `is_game_paused`201271, `get_object_class`201552, `len`215360, `get_substring`215457 and `get_character_as_number`215472 in the pinned `unreal-api-reference.txt`. The last declaration says an out-of-range index returns0; every indexing call therefore needs an explicit range guard. Declarations do not supply executable Python implementations or prove clipboard spelling/behavior.

## Proposed function boundaries and UI work

All names below are project proposals. Keep the first-press marker independent and the later paging route free of live getters.

| UI-created impure function | Signature proposal | Generated body responsibility |
|---|---|---|
| CaptureExistingComponentSnapshot | No parameters or outputs | Consume the already-guarded second press; validate identity/context; store the sole query result; loop0–31; class-check every valid bounded slot; close details permanently on rejection; build summary/context/atomic row bodies; decorate/final-check/store pages; clear component/current-object references. Keep counters, flags, body arrays and temporary paths local here. |
| ValidateBoundedIdentity | Raw:String, Limit:Int → Valid:Bool, Units:Int | Nonempty/length/control/surrogate validation using a fixed bounded character loop. No segmentation. Class-only scanning calls this after storage closes. |
| SegmentValidatedPath | Raw:String → Valid:Bool, Segmented:String, Lines:Int | At most seven 40-unit segments for a previously valid256-unit path; move a boundary before a surrogate pair. Called only when details are open, or while building prequery controller context. |
| DecorateBoundedPage | Body:String, Index:Int, Total:Int, Status:String → Valid:Bool, Page:String, Units:Int | Index is zero-based: only Index=0 is the summary and receives the640-unit body limit; every other body is limited to600. After Capture has built/admitted all bodies and determined completeness, freeze final Total and Status before decorating any page. Use that same Total/Status for every page, display Index+1, count all separators and final units/lines, and enforce page768/16 lines and count70. Capture separately enforces aggregate4096. |
| ShowStoredSnapshotPage | No parameters or outputs | Guard PagesReady/widget; advance only below stored length; display the selected stored String through diagnostic SetSnapshot; saturate. No query, pause/locality or identity reads. |

Keep row-pair admission, final summary construction and the fixed final-page loop inside Capture initially. This avoids extra by-reference-array signatures or a new user-defined struct before those are proven. The four small helpers remove the repeated validation/formatting/wiring work without moving live reads onto the paging path. A larger flat Event Graph is technically conceivable from the proven fragments but would increase member state and make audit/replacement harder; there is no need to depend on that route.

Create these six persistent variables through the UI once: ControlAttempted/false, SnapshotAttempted/false, PagesReady/false; SnapshotComponents/empty with the **actual query output type**; SnapshotPages/empty String array; PageIndex/Int0. Preserve existing ControlReadout. Capture locals include seven counters (returned/visited/valid checks/matches/retained/invalid/reserved text), final text total, count-known/detail-closed/completeness/failure flags, current component/class, bounded identity strings and the bounded temporary page-body array. Create exact local declarations in the destination function and export them before emitting Get/Set references. EndPlay clears persistent arrays/reference and preserves the parent call once. If defensive busy/ending flags are added to port callback/teardown cases, specify and review them explicitly; do not pretend Python exception handling is a Blueprint node.

Stock source proves locals and functions exist: `001-Dpad_LanceOrderDispatcher-source.COPY` has `MemberScope="CreateMoreButton"` with matching variable GUID at969/986, `LocalVariables` on its FunctionEntry at1167, an integer local at1570, input UserDefinedPin at1580, and registered functions at5886–5892. This supports the proposed decomposition, but not cross-graph clipboard rebinding. Never copy stock/local GUIDs or the original probe's member/class references into the diagnostic.

## Reduce manual authoring without weakening acceptance

1. Finish the current typed-variable proof. Then combine priorities1–4 above in one bounded scratch-template collection, with a tiny function-body paste/compile/export comparison. A real caller must resolve to the scratch function and its local references before considering the route proven.
2. Create destination variables/function signatures/local declarations through visible UI once. Export that baseline. Generate only bodies from the actual destination member/function GUIDs and captured node/pin templates. Preserve native entry/return nodes; connect any boundary pins visibly instead of assuming external clipboard links attach to existing nodes. A later proven whole-function import may reduce this overhead, but is not a dependency.
3. Generate one bounded payload per function/graph. Assign fresh node/pin IDs; remap all reciprocal internal links; reject unlisted functions/classes and external graph links; count query consumers and ensure only Set SnapshotComponents consumes its pure result. Bind every payload to its destination baseline and templates. Compare registered exports after paste/compile, not merely the green compiler icon.
4. Implement helpers, Capture, then the small F8/EndPlay routing changes. Preserve every current numerical limit and class-scan/detail distinction. Use exact 68-test fixtures for native string and widget checks. Only after complete source review and separate bounded packaging/runtime work is the result a runnable-mod candidate.

No unsupported exception/display-success node, Tick/timer, repeat query, factory call, component creation, probe-class hard reference, input capture or simplified ASCII-only formatter is substituted for the contract. Missing glyphs and native Unicode/layout behavior remain explicit blockers to the affected display acceptance.

## Reviewed input pins

| Input | SHA-256 |
|---|---|
| Current contract | `9c0579ca3241c75a7e4dc3ce40e3dd5b3afdf2bae698db6e3e22343e480c10fa` |
| Node catalog v2 complete | `1b5fc129e2d5c09cb8464fe68b862d2642ae6e77d0991779ee6c2680c7118c0b` |
| Phase A controller export | `1c46d0589b6c79342fcba90857d0ea1970d463325a9eeb00a31e86fbd2afa0db` |
| Phase A widget export | `f74f506601b395e34036d4e417a9c82ef4acaacd8587f8df7fc3dd1f4b9f7ee6` |
| Installed API declarations | `ac4c46761bc54099302155bc0a908ae3f64b161ca77eb9afd0cc6c1f1b826480` |
| Stock232 export with GetSubstring | `d253b5ebe6ef2a90a2d9f8ef4cbe5c22e639cb03711dc2c1432fe060846088be` |
| Three-node paste/compile review JSON (`phase-b-three-node-proof-20260927-01/pasted-review.json`; companion Markdown is a different artifact) | `6df72673e131921ba7e65d6d4e710ce83342cf8ead3a2a2fc36ec8b4e41aed2b` |

Scope: local editor1.1.390.0e/UE4.26.2 source and declaration evidence, read September27,2026. Native/editor/game actions by this inventory author: **NOT_PERFORMED**.
