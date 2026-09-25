# Disposable editor authoring probe — September 25, 2026

**Status: PASS_EDITOR_AUTHORING_ONLY.** The disposable Actor Blueprint was created, named, wired, compiled, saved, closed and reopened through the editor UI. All eight original observer file hashes and sizes remain unchanged. This verifies a supervised editor-authoring workaround; it does not fix or validate the original in-game observer.

The user's “Continue with the next step” authorized this test. RAM and the prior usage stop threshold remain waived. The one authorized reset credit was consumed when the usage report reached 100% used (0% remaining); `ordinaryUsageAllowed` still reported true at that instant. The reset succeeded, returned 0% used, and left zero reset credits. No further reset is authorized by that completed request.

## Final observed result

| Check | Evidence |
| --- | --- |
| Created and named | `/Game/CodexEditorControlScratch20260925/BP_CodexAuthoringProbe`, parent Actor; dedicated folder was absent at preflight |
| Nodes and text | Event BeginPlay execution wire reaches Print String; exact literal `AUTHORING PROBE - NOT RUNTIME` |
| Compile | Visible Compiler Results: `[6431.30] Compile of BP_CodexAuthoringProbe successful! [in 227 ms]`; following package path is clipped |
| Save | File → Save As, same dedicated `/Game` path, replacing only this newly created test asset; Save To Mod was not used |
| Separate reopen | Closed at 17:19:39 UTC, reopened from Content Browser at 17:20:52 UTC; fresh image retained both nodes, wire and exact literal |
| Disk asset | Exactly one file in the dedicated directory: `BP_CodexAuthoringProbe.uasset`, 28,153 bytes, SHA256 `0b7d06f0004d67d1944cd288b44a4b63d7f95d4e17de22b8ee828f4f96f0b6dc` |
| Original files | 8/8 baseline sizes and SHA256 values match, independently rechecked; active mod selection remained LanceObserverProbe |
| Regression checks | 15/15 `scripts/Test-WindowBridge.py` tests pass, MOCK_ONLY; syntax/whitespace checks pass |

The primary receipts, image paths/hashes, original-file comparison and created-file inventory are in [the JSON record](EDITOR_AUTHORING_PROBE_2026-09-25.json). The compile image is `research/evidence/window-bridge/editor-fbb7a8971adf49c08657d1aabdad4f21/capture-bbc2e639e86b4597b5abe108bd1e87f0/client.png`; the separately reopened graph is `research/evidence/window-bridge/editor-2cdac1d0248a4da9a97805ea3706e087/capture-59fbffe369634ddea14e214a11de5cc6/client.png`. An independent read-only reviewer checked both images, their hashes, the exact saved asset and all eight original pins.

A hash-matching local copy is retained at `artifacts/editor-authoring-probe-20260925/BP_CodexAuthoringProbe.uasset`, with a narrow editor-log excerpt. The editor also generated an autosave; it is listed separately in the JSON and is not the accepted final asset. The temporary `Content/NewFolder` no longer exists after its verified rename.

## Practical controls and limits

The helper now binds exact owned menus, supports a single right click, and can enter short printable literal text in a visually reviewed active field. Exact pixels, identity, native focus, window ownership, image hash and receipt freshness remain checked. An optional wait of at most 1,200 ms permits the *exact* reviewed caret phase to recur; no pixels are masked or compared approximately. Each receipt permits one attempted action. Final helper SHA256: `583cf0d4cf5ed5f4a6c7233084d23c9e128f9ec80a294bd435bad9b559a6ae82`.

Native focus does not prove which Slate text field has focus. The operator must inspect that field and read back the result; global input retains a focus-switch race. Right-click cleanup has mocked regression coverage but was not exercised live in this proof. This is not a general unattended editor controller.

The asset window was reopened in the **same editor process**. Cold editor restart, package unload/reload, runtime execution, packaging and retail deployment are NOT_PERFORMED. Print String is visibly marked Development Only. The test actor was not placed in a level. The original observer's missing runtime readout remains unresolved.

The next bounded use is authoring the separate diagnostic control described in `design/OBSERVER_DIAGNOSTIC_CONTROL_MORNING.md`, with its own destination/baseline and validation gates. Do not interpret this authoring proof as that diagnostic mod being built or deployed.

## Scope and baseline

Create one new, unreferenced Actor Blueprint, proposed `/Game/CodexEditorControlScratch20260925/BP_CodexAuthoringProbe`. The new directory was absent at preflight. All eight original `LanceObserverProbe` file hashes matched the prior baseline; see the adjacent JSON receipt. The original Blueprint window was closed normally without saving a change. Only UE4Editor PID 28296 was returned by the targeted game/editor process check; the retail process was absent.

This asset is not placed in a level. No Play, packaging, cook, deployment, retail launch or main-campaign access belongs in the test. Existing observer assets, stock assets and active-mod selection are not editing targets.

## Acceptance

1. Observe creation and naming of the new asset in its separate folder.
2. Use actually available nodes to connect BeginPlay to Print String, with the fixed marker `AUTHORING PROBE - NOT RUNTIME`.
3. Verify text, nodes and execution wire visually.
4. Compile and observe the compiler result; save only the disposable asset.
5. Close/reopen it, verify persistence, and record its disk path/hash.
6. Refresh the original eight file hashes.

Successful input insertion, a saved file or a green icon alone does not satisfy the whole test. Execution in the game is NOT_PERFORMED even if all authoring checks pass.

## Control details under test

The supported Computer Use route remains preferred for keyboard actions that work. Its original screenshot/coordinate route failed previously, so reviewed physical captures and pointer actions use the project helper. Each action needs a fresh capture; text additionally needs a visually confirmed active editable field. Do not use a native Slate window focus handle as proof of which field will receive text.

The Add/Import menu was observed as a separate empty-title popup HWND 4589702 owned by main editor HWND 4264034, with the main window remaining foreground. This requires an explicit exact popup/owner binding, not a process-wide relaxation of point ownership. These IDs are historical and must be rediscovered after the popup closes.

Microsoft documents `GetWindow(GW_OWNER)` as the owner relationship lookup and `GetGUIThreadInfo` as GUI-thread state. They do not establish Slate field focus or application-effect acceptance. Sources accessed 2026-09-25: [GetWindow](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getwindow), [GetGUIThreadInfo](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getguithreadinfo).

## Intermediate checkpoints (superseded by final result)

- OBSERVED: the exact owned Add/Import popup accepted its New Folder action. Disk inspection found a newly created, empty `MW5Mercs/Content/NewFolder`, outside the original observer plugin. It is the temporary creation path for this test; do not treat it as a pre-existing cleanup target.
- OBSERVED: scrolling and folder selection worked. The attempted Content Browser divider drag produced no observed resize, so resizing is not accepted.
- OBSERVED: a later fresh screenshot showed `NewFolder` selected in an active inline rename field. The earlier F2 return and selected-label click do not independently establish which action activated it.
- NOT_VERIFIED: the supported keyboard tool returned after typing `CodexEditorControlScratch20260925`, but the immediately refreshed screenshot still showed `NewFolder`. No successful text entry or folder rename is claimed. A separate bounded text route is being prepared; it must require the visually active field and retain all target, focus, freshness and pixel guards.
- OBSERVED (later checkpoint): guarded literal text changed the selected inline folder name. Clicking empty Content Browser space committed it, and filesystem inspection returned the exact `CodexEditorControlScratch20260925` directory with `NewFolder` absent. The new folder opened empty. The observed Blueprint Class menu and Actor parent picker created an initial `NewBlueprint` entry inside it; naming/saving that asset is still incomplete.
- Two pre-input pixel rejections on the asset-name field were traced to exactly 13 changed pixels in a 1-by-13 rectangle, consistent with the visible blinking caret. No input was inserted by those rejected attempts. The proposed stabilization waits briefly for exact reviewed pixels; it does not mask or tolerate changed pixels.
- Node authoring, compilation, save and reopen remain NOT_PERFORMED at this checkpoint.

## Stop and cleanup

Stop input on unexpected source changes, uncertain focus/effect, absent target, error or loss of responsiveness. Reobserve before any recovery; never blind-retry a mutating step. Preserve receipts and the actual outcome.

Retain newly created test assets as local evidence, outside retail packaging. Later cleanup must close the asset, check references and the exact manifested paths, and remove only the dedicated new directory after verifying containment. Original observer assets and stock content are not rollback targets. Any editor UI layout changes are cosmetic; no Windows settings or security configuration is changed.
