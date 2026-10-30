# Fixed text-helper fixtures through Call in Editor

September 27, 2026. **PREPARED; native button execution NOT_PERFORMED.** This is a six-case editor test of the three imported text helpers. It is neither a B0 game test nor full Phase B acceptance. Root owns every native action; this preparation performs none.

The zero-argument Python reflection attempt on `ProofNoLocalWrapper` stopped at 11:08:04 UTC with a required compiler-generated argument, `call_func_proof_helper_0_new_param1`. The receipt records one attempt, zero returns, and body execution `UNKNOWN_UNINSTRUMENTED`. Preserve its consumed claim and result; do not retry with guessed local or temporary arguments. See `evidence/phase-b-no-local-wrapper-call-20260927-01/native-result-review.json` (SHA256 `9eef1c6b5bc643cc902b0d1aa86394c7f407ce909fc02d3b2854bb5fe7d2ac50`). This does not establish an error in the algorithms or in Blueprint-to-Blueprint calls.

## Concrete route and prerequisites

Root reported the installed editor's **Call in Editor** checkbox visible in the 11:02:58 capture. The button route itself remains untested. Epic's adjacent-version [Calling Blueprints in the Editor documentation](https://dev.epicgames.com/documentation/unreal-engine/calling-blueprints-in-the-editor?application_version=4.27) documents a normal Actor Blueprint, a no-input function with this checkbox, and a placed selected instance whose Details button invokes it. That documentation is not installed 4.26 execution evidence. Keep the existing normal Actor base; do not substitute an Editor Utility Actor or guessed reflected metadata.

Use the existing scratch Blueprint only:
`/Game/CodexEditorControlScratch20260925/BP_CodexAuthoringProbe.BP_CodexAuthoringProbe`.
Its accepted source has an empty construction script and no test invocation wired to BeginPlay, Tick, input or another event. Recheck this in the latest combined type/caller export before placement. Root's current TitleScreen has six actors; record the actual level package and six actor identities before the transition rather than inferring an asset path from the display name.

Before authoring or changing levels, bind the unit to the **latest independently reviewed combined caller/type export**, its compile result, current editor PID/creation/executable and unchanged scratch source/backup. Historical `wrapper.COPY` is insufficient as a current baseline after new templates are added. Record the current level's dirty state and any unrelated unsaved work. If the level identity, ownership, or safe treatment of a save prompt is uncertain, stop for review; do not discard existing changes.

The source file and project backup must both remain 28153 bytes, SHA256 `0b7d06f0004d67d1944cd288b44a4b63d7f95d4e17de22b8ee828f4f96f0b6dc`:

- `C:/Program Files/Epic Games/MechWarrior5Editor/MW5Mercs/Content/CodexEditorControlScratch20260925/BP_CodexAuthoringProbe.uasset`
- `artifacts/editor-authoring-probe-20260925/BP_CodexAuthoringProbe.uasset`

## Minimal function source

Native metadata template: **RunFixedTextHelperFixtures**, created empty with no inputs, outputs or authored locals and Call in Editor checked through the observed UI. Preserve this template unchanged. Proposed six-case driver: **RunFixedTextHelperFixtures_Proof**, a distinct whole-function import that copies the reviewed native Call in Editor metadata and uses the actual reconstructed caller pins. This avoids replacing or auto-renaming the existing template. A zero-output Return may be omitted by the native editor; use source-proven Entry/Return templates and never fabricate a serialized Call in Editor flag.

Use six unrolled calls, with caller fields and pins taken from the pending native reconstructed-caller export. Their already observed destination graph GUIDs are:

| Function | Native graph GUID | Cases |
|---|---|---|
| ValidateBoundedIdentity | `17E7ADEB426A31CA70171090E4305F4D` | 1â€“2 |
| SegmentValidatedPath | `CAEFBE884530942ADF30A8838053E25B` | 3â€“4 |
| DecorateBoundedPage | `110735DF4002F8EF25A015A22EAF0312` | 5â€“6 |

Do not emit these callers until the actual mixed-type parameter pins are reviewed. The fixed inputs and exact expected outputs are recorded in `evidence/phase-b-call-in-editor-fixture-20260927-01/fixed-fixture-expectations.json`, 2768 bytes, SHA256 `e5b97cff7896a0d96a2d35847ce236aaf99b19dc6f638e2c245baf70db9325f3`. These expectations are **MOCK_ONLY**, derived from the frozen reference model, not native results.

| Case | Check |
|---|---|
| 1 | Valid ASCII identity; Boolean true and 11 UTF-16 units |
| 2 | Identity containing LF; Boolean false and 3 units |
| 3 | Forty W characters followed by Z; exact two-line segmentation |
| 4 | Thirty-nine W characters, U+1F680, then Z; intact pair moved to line two |
| 5 | Valid one-page decoration; exact text, Boolean true and 91 units |
| 6 | Total page count zero; Boolean false, empty page and zero units |

Case 4's supplementary literal and expected text must round-trip exactly in the native fixture export before invocation. A changed or lossy literal blocks this unit; do not silently replace it with an ASCII case. This unit does not use isolated surrogate or embedded-NUL literals.

The proposed execution chain is Entry â†’ fixed BEGIN log â†’ case 1 call â†’ compare **every output** â†’ Branch. A passing branch prints PASS01 and advances; a failing branch prints FAIL01, then END FAIL and returns. Repeat through case 6; the final passing branch prints PASS06 then END PASS. There is no loop or automatic retry. Use source-backed Boolean AND/NOT, integer/string equality, Branch, and the actual registered PrintString node. Exact false values must be tested too; merely reaching a Return is not a pass.

The PrintString template exists at `EventGraph.K2Node_CallFunction_0` in the pinned wrapper export (858187 bytes, SHA256 `677e2269f8cc78d9bb84b8ebf91c2fa39d7e95e5d7091fdab7f47369221c4b41`). Preserve its native types and self/world-context handling; set **Print to Screen false** and **Print to Log true**. Use static ASCII messages only, prefixed `MW5_TEXT_FIXTURE_20260927_01`. Print no object paths, arbitrary returned strings or reflected objects. There are at most eight messages: BEGIN, up to six PASS/FAIL messages, END PASS/FAIL. Each message is at most 128 characters, total message content at most 1024 characters; engine log prefixes are additional and must remain in the preserved raw excerpt.

The resulting function has no component/actor queries, loads, spawning, timers, input bindings, member writes, gameplay commands or calls to Python. The only impure nodes are the six fixed helper calls, branches/returns and bounded log output. No previous execution path is connected to the fixture. Existing imported helper bodies remain unchanged.

## Review, one invocation and evidence

1. Prepare the source-bound graph and offline reciprocal-link/argument/output checks. Compile once after import. Export and independently compare the full scratch source: exactly the intended fixture function and its actual Call in Editor metadata; six calls; correct source GUID bindings and arguments; all output comparisons; fixed log settings; unchanged prior helpers and empty UCS.
2. Through native UI create a **new empty unsaved disposable level**. Do not save the prior level, new level or scratch asset. Place exactly one instance of the reviewed scratch Actor in this new level and record the new world/actor path. Placement may run its reviewed empty construction script; Play is not used.
3. Select that owned instance and verify the observed Details button belongs to the source-reviewed **RunFixedTextHelperFixtures_Proof** driver, not the preserved empty RunFixedTextHelperFixtures template. Record its actual displayed label; do not guess the friendly-name formatting. Record the current output-log boundary and fresh process/world/selection identity. Click the button **once**. A missing button or unexpected controls stops the unit; it does not authorize another invocation route.
4. Preserve the bounded fresh raw log suffix with timestamps and process identity. Acceptance requires exactly one BEGIN, PASS01 through PASS06 in order, exactly one END PASS, and no FAIL, missing/duplicate marker, unexpected error or intervening second invocation. The six expected fixtures are the acceptance scope; do not infer all boundary cases or game compatibility from them.

A missing result, FAIL, exception, hang, unexpected modal, lost ownership or duplicate BEGIN stops further input and preserves evidence. Do not click again, enter guessed arguments or launch Play. A synchronous editor callback is not guaranteed preemptible by a time budget; record elapsed time without claiming cancellation support. Initial observation is bounded to a short responsive UI/log check, with no unattended polling or repeated input.

## Cleanup and outcome boundaries

After collecting evidence, remove the one owned actor or close/discard the known disposable unsaved level. Restore the exact previously recorded TitleScreen level without saving, then verify its six original actor identities, current level/process identity, scratch source/backup hashes and absence of the owned test instance. Do not delete or overwrite autosaves. Handle a save dialog only according to the recorded dirty-state baseline; an unexpected dirty asset must be reviewed before discard.

The newly authored scratch function may remain explicitly documented as unsaved for immediate bounded continuation. Final scratch cleanup is a separately observed known undo/compile/export or normal close/discard of the known scratch edits; do not discard unrelated assets. Preserve every native export, consumed attempt and log receipt.

A successful run means **six fixed text-helper fixtures passed through a native editor button on one disposable Actor**. It does not establish Unicode font rendering, every malformed string case, retail invocation, B0 attachment results, full per-entry paging, packaged compatibility or shipping-game behavior. A failure remains localized to its case/route until reviewed; the original passive observer, Phase A package/install and full Phase B contract stay unchanged.
