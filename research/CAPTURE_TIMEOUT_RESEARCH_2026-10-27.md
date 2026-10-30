# Windows capture timeout findings and recovery options

Research date: October 27, 2026, America/New_York. Research and local metadata inspection only; no new capture, reset, restart, installation or system change was performed.

**The failure closely matches current public reports about Codex native capture on Windows 10. No official, verified repair was found in the reviewed documentation and matching issues.** The immediate practical path is one controlled supported recovery test, followed by user-operated evidence collection if capture still fails. The saved MW5 controller should remain untouched while this tooling issue is investigated.

## Confirmed local evidence

| Component or observation | Verified value |
| --- | --- |
| Windows | Windows 10 Home 22H2, build 19045.6466 |
| Desktop MSIX package | OpenAI.Codex 26.1021.3705.0, x64 |
| Computer Use plugin | 26.1021.31345 |
| Bundled runtime | @oai/sky 0.7.13 |
| Native enumeration | Successful; File Explorer windows were returned |
| Screenshot attempts | Existing Documents window returned `FrameArrived timed out: timed out waiting on channel`, then a freshly enumerated retry returned `window capture timed out: timed out waiting on channel` |
| Editor during those attempts | No editor window returned; no editor launch or input occurred |
| Current controller | The two inspection receipts preserve the same manual-save SHA-256, `ce3a7978fbd522fb1b625e22c8a1589c3d6821779e89f6643b4a65c232dedff6` |

Sources: [inspection receipt](evidence/b0-saved-controller-inspection-20261027-01/RESULT.json), [retry receipt](evidence/b0-saved-controller-inspection-20261027-01/RETRY_01.json); read-only OS registry; installed AppxManifest.xml; plugin metadata; current configured Sky package.json. Version values identify different components and are not interchangeable. An update eligibility check was not performed in this research.

The older [October 17 provisioning diagnosis](evidence/b0-desktop-repair-investigation-20261017-01/README.md) concerned a delegated browser-only surface with missing native tools. Native tools are present in this chat. That older diagnosis does not explain the current screenshot failure.

The recent known desktop log directories for October 26 and 27 contained no matches for the exact timeouts or targeted D3D/DXGI/HRESULT capture failures. Their coverage does not establish that no helper diagnostics exist elsewhere. No local internal deadlock has been demonstrated.

## What external evidence establishes

**DOCUMENTED reporter reproduction:** [Codex issue 57149](https://github.com/openai/codex/issues/57149), opened October 26, reports version 26.1021.31345 and both exact timeout messages on Windows 10. Its author reports working OBS Windows Graphics Capture on the same machine. This supports investigating Codex's capture path; it does not establish this computer's root cause.

**DOCUMENTED matching reports:** [Issue 49383](https://github.com/openai/codex/issues/49383) remains open. Recent [Sky 0.7.13 evidence](https://github.com/openai/codex/issues/49383#issuecomment-6403950106) describes successful window discovery/accessibility and failed screenshots after a JavaScript reset. Other reports include unsuccessful app restarts and reboots. Restarting is therefore a diagnostic attempt, not a promised fix.

**PROPOSED local explanation:** community investigations describe a capture callback waiting for image conversion while that conversion needs resources held by the callback. [Issue 55185](https://github.com/openai/codex/issues/55185) records detailed evidence for an older Sky 0.7.8 build. A [Sky 0.7.13 experiment](https://github.com/openai/codex/issues/50362#issuecomment-6378345173) reports success after moving processing onto a worker. These are build-specific third-party investigations, not an official diagnosis of this installation. The error can occur after a frame arrives, so its wording alone does not prove Windows delivered no frame.

**DOCUMENTED simpler precondition:** OpenAI requires the target to be visible in the active Windows desktop. Microsoft's sample notes that a minimized window may be enumerated without being capturable. The recent Documents attempts established identity but not restored/foreground state. That remains one useful distinction to test. [OpenAI Computer Use](https://learn.chatgpt.com/docs/computer-use), [Microsoft HWND capture sample](https://github.com/microsoft/Windows.UI.Composition-Win32-Samples/blob/master/cpp/ScreenCaptureforHWND/README.md).

## Recommended next actions

1. **One bounded supported recovery test.** On an unlocked local desktop, restore a simple ordinary window and make it visible. Start with a fresh JavaScript session and initialize the documented native API. Enumerate and select the current window, then request one screenshot. A session reset clears JavaScript bindings; it does not prove the native helper restarted. If another timeout occurs, stop. This distinguishes the remaining window-state/session possibility without touching MW5.
2. **Optional user-coordinated full desktop-app restart.** Wait for active chats to finish and preserve their work first. Then reopen the app and perform the same ordinary-window test once. Checking for an eligible official update is reasonable, but the sources reviewed do not establish that an available release fixes this issue. Avoid repeated restart/retry cycles after an unchanged result.
3. **Continue MW5 through user-operated capture if necessary.** Use Windows Snipping Tool (`Windows+Shift+S`) to capture the editor identity and requested graph/pin views, then attach those images. Use Unreal's normal Copy operation to provide the required graph/template text. I can review the supplied evidence and historical source offline. This provides evidence for inspection; it does not restore autonomous editor control. [Microsoft Snipping Tool instructions](https://support.microsoft.com/en-us/windows/apps/use-snipping-tool-to-capture-screenshots).

For the MW5 handoff, retain the existing [minimum capture specification](evidence/b0-template-recovery-20261017-01/MINIMUM_CAPTURE.md): current controller identity and complete source/default comparison, BEFORE_EVENTGRAPH, actual native templates, AFTER_EVENTGRAPH and unsaved-state evidence. A screenshot or EventGraph clipboard alone is not a complete Blueprint baseline. Do not save temporary nodes or restore the older controller.

Appshots are another user-facing image-sharing option, using both Alt keys on Windows, but matching bug reports also describe Appshot failures. They are worth a simple check, not a dependable independent fallback. [Appshots documentation](https://learn.chatgpt.com/docs/appshots), [reported limitation](https://github.com/openai/codex/issues/49383).

## Workarounds that are not ready for this project

- **Community binary patches:** some users report success, but they modify the signed capture helper and require exact build/hash compatibility. The public older-build patch is not a verified repair for this runtime. The 0.7.13 experiment explicitly provides no installer or binaries and claims limited testing. Nothing was downloaded, patched or executed here.
- **Alternative capture servers:** a developer reports a separate Win32 backend working in classic desktop apps, with GPU-window limitations. That is not evidence of MW5 editor compatibility and is outside the currently prescribed supported native route. It is a separate integration proposal, not a silent fallback. [Developer report](https://github.com/openai/codex/issues/49383#issuecomment-6172831502).
- **Longer waits:** the installed `get_window_state` API exposes window, screenshot and text options; it exposes no screenshot-timeout parameter. Raising the outer tool-call wait does not configure the native helper's internal capture wait. The reported callback-blocking problem would require an implementation correction.

The current research does not justify changing MW5 assets, reinstalling the editor, replacing GPU drivers or broadening Windows security settings as a fix for this capture timeout.

## Support report ready for review

The following minimal report can be submitted by the user through in-app feedback or the existing GitHub issue. No report was sent during this research.

> Windows 10 Home 22H2 build 19045.6466; OpenAI.Codex MSIX 26.1021.3705.0; Computer Use 26.1021.31345; @oai/sky 0.7.13. Native window enumeration succeeds. Screenshot requests for the existing File Explorer Documents window fail with FrameArrived timeout and, after fresh enumeration and selection, window capture timeout. No image is returned. The target's restored state was not independently verified. No editor launch, input, binary patch, driver or security change occurred. Please advise whether an official signed fix or supported diagnostic exists for this combination, referencing issues 57149 and 49383.

[OpenAI's feedback guidance](https://learn.chatgpt.com/docs/reference/troubleshooting) describes using the slash menu and choosing whether to include the current chat. Review shared content first; private project sources and full logs are unnecessary for the minimal report above.
