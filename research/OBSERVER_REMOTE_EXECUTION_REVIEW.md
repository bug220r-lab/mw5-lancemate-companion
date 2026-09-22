# Official editor Python remote-execution review

**2026-09-21 — read-only feasibility review. Default transport not observed; effective remote-execution setting UNKNOWN.** The installed editor includes Epic's supported Python remote-execution client, but plugin availability and Python scripting enablement do not establish that the current editor exposes remote execution. This review did not import that client, execute an editor script, probe endpoints, change configuration or start a process. It does not duplicate the asset investigation assigned to `scripts/Inspect-ObserverReferences.py`.

## Installed version and source evidence

Installation root: `C:\Program Files\Epic Games\MechWarrior5Editor`.

- [Engine Build.version](<C:/Program Files/Epic Games/MechWarrior5Editor/Engine/Build/Build.version:2>) lines 2–9 records UE **4.26.2**, compatible changelist **14830424**, and branch `++UE4+Release-4.26`. This identifies the inspected installation, not a separately queried live process build.
- [PythonScriptPlugin.uplugin](<C:/Program Files/Epic Games/MechWarrior5Editor/Engine/Plugins/Experimental/PythonScriptPlugin/PythonScriptPlugin.uplugin:3>) records version **1.0**, Epic Games as author, beta status and an `UncookedOnly` PythonScriptPlugin module. Its `EnabledByDefault: false` concerns the plugin, not the separate remote-execution setting.
- [MW5Mercs.uproject](<C:/Program Files/Epic Games/MechWarrior5Editor/MW5Mercs/MW5Mercs.uproject:79>) lines 79–80 explicitly enables `PythonScriptPlugin` for this project.
- [remote_execution.py](<C:/Program Files/Epic Games/MechWarrior5Editor/Engine/Plugins/Experimental/PythonScriptPlugin/Content/Python/remote_execution.py:11>) is the installed official client inspected as text. SHA-256: `0fe87cd41a4d593a722b6845745e46e86263b6be07c055580d4ee9bfd85c9062`.

The client defines protocol version 1 and magic `ue_py` at lines 11–19. Discovery and connection requests use UDP; commands and results use TCP. Its defaults at lines 24–27 are:

| Setting | Client default | Meaning and limitation |
|---|---|---|
| Multicast group | `239.0.0.1:6766` | UDP discovery; must match the editor's configured group. |
| Multicast bind address | `0.0.0.0` | All adapters according to the source comment. This is not a demonstrated editor bind. |
| Multicast TTL | `0` | Source comment describes local-host scope. |
| Command endpoint | `127.0.0.1:6776` | TCP listener hosted by the **external Python client**; the selected editor connects back. It is not an editor listener inferred from a fixed port. |

`RemoteExecution.start()` begins discovery at lines 67–72. A discovered node is selected for `open_command_connection()` at lines 92–100. Execution modes are declared at lines 29–32 and exposed by `run_command()` at lines 110–126. Socket construction at lines 253–263 and 458–480 confirms the UDP discovery/TCP callback direction. These are supported client operations described by source, **not operations performed in this review**.

## Configuration evidence and remaining uncertainty

[Project DefaultEngine.ini](<C:/Program Files/Epic Games/MechWarrior5Editor/MW5Mercs/Config/DefaultEngine.ini:285>) lines 285–286 contains the `PythonScriptPluginSettings` section with only `bDeveloperMode=True`. Developer mode is not evidence that remote execution is enabled.

Narrow text searches for `PythonScriptPlugin`, `bRemoteExecution`, `RemoteExecution`, `MulticastBind` and `MulticastGroup` in these discovered configuration locations found **no explicit remote-execution enablement or endpoint overrides**:

- `C:\Program Files\Epic Games\MechWarrior5Editor\MW5Mercs\Config`
- `C:\Program Files\Epic Games\MechWarrior5Editor\Engine\Config`
- `C:\Users\jlewi\AppData\Local\MW5Mercs\Saved\Config` — including Windows and WindowsNoEditor
- `C:\Users\jlewi\AppData\Local\UnrealEngine\4.26\Saved` — configuration INI files only

[Saved Windows Engine.ini](C:/Users/jlewi/AppData/Local/MW5Mercs/Saved/Config/Windows/Engine.ini:15) line 15 and [WindowsNoEditor Engine.ini](C:/Users/jlewi/AppData/Local/MW5Mercs/Saved/Config/WindowsNoEditor/Engine.ini:8) line 8 merely list the plugin's content path. Search absence has no supporting line range and is not a merged runtime-settings query.

The plugin's native settings constructor/source was not installed in the inspected plugin directory; its top-level directories were Binaries, Content, Resources and SphinxDocs. The discovered generated `C:\Users\jlewi\AppData\Local\MW5Mercs\Intermediate\PythonStub\unreal.py` did not expose the relevant settings declaration in the targeted search. Therefore this review does **not** establish the compiled enablement default, effective merged value, unsaved in-memory value or current non-default endpoint. Missing keys must not be relabeled as `False`.

## Parent-task observations

The parent task separately reported a read-only `Get-NetUDPEndpoint` query scoped to the single UE4Editor process **PID 18596**. It returned only `0.0.0.0:62929` and `0.0.0.0:24024`; **no UDP 6766 endpoint was observed**. These are parent-reported results, not a query independently repeated by this reviewer. The two other ports were not classified as Python transport and were not probed.

The parent also reported a fresh accessibility inspection of editor window **593470**, yielding only a root node and no controls. That result does not reveal the Python settings checkbox. No additional UI inspection was performed here.

## Disposition and minimal next verification

**DOCUMENTED:** the installed official client provides a supported existing-editor integration route when remote execution is enabled and correctly configured. **OBSERVED BY PARENT:** its default UDP discovery port was not present in the scoped endpoint result. **UNKNOWN:** effective enablement and any non-default transport. The default route is therefore **not currently demonstrated usable**.

The smallest next verification is a read-only inspection of the current editor's Plugins → Python remote-execution settings, including enablement and multicast group/bind fields, without toggling them. If disabled, stop. If enabled, record those effective values before proposing a separately bounded transport test. This report does not authorize enabling the feature, trying the two unrelated ports, arbitrary endpoint discovery, script execution or any game-affecting action.
