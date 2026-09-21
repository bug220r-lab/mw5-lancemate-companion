# Passive observer: declared packaging contract

Reviewed **2026-09-21**. **OBSERVED text / DOCUMENTED declarations; packaging and runtime execution NOT_PERFORMED.** This narrow review reads the already collected editor API reference as text and the two named installed BaseTemplate configuration files. It does not import or execute the generated stub, inspect live reflection, launch an editor/game, cook, publish, install, or change configuration.

**Result:** the collected editor reference exposes an exact package entry point, `MWModEditorWidget.package_mod(args: ModPackageArgs) -> None`. It does **not** supply a complete safe automated packaging procedure: widget acquisition, native implementation, destination selection, completion/error evidence, generated descriptor and cooked output remain unresolved. Packaging metadata does not establish an observer's runtime creation or registration.

## Sources and identity

| ID | Source and identity | Scope and limitation |
|---|---|---|
| PKG-API | `research/evidence/editor-source/ai-research-collection-20260921T030437Z-f7d8e930/unreal-api-reference.txt`; 21,026,350 bytes; SHA256 `AC4C46761BC54099302155BC0A908AE3F64B161CA77EB9AFD0CC6C1F1B826480`; recorded file modification UTC `2026-09-21T03:08:48Z`; read/hash checked 2026-09-21 | Generated documentation collected from installed MW5 editor; project baseline identifies editor package 1.1.390.0e / UE4.26.2. That version association comes from the project collection/installation record; the reference text does not independently certify editor/retail compatibility. Line numbers below are one-based text lines, not C++ header lines. `pass` and dummy returns in this documentation are placeholders, not actual implementation or observed live return values. |
| PKG-TAGS | `C:\Program Files\Epic Games\MechWarrior5Editor\MW5Mercs\Content\ModTemplates\BaseTemplate\Config\Tags\PLUGIN_NAMETags.ini`; SHA256 `AD7F8B6D4415FB7EDB4D52E83942A67C66313DA7EA504E6196679DB31B147E1B`; read/hash checked 2026-09-21 | Installed text has an empty line and the `[/Script/GameplayTags.GameplayTagsList]` section at line 2. No tag entries or component registration directive appears. |
| PKG-INPUT | `C:\Program Files\Epic Games\MechWarrior5Editor\MW5Mercs\Content\ModTemplates\BaseTemplate\Config\Input\PLUGIN_NAMEInput.ini`; SHA256 `FC21B00D6DB183E8434466E27F0F4FC194F7E852F66CE68BC15C9323271AA17D`; read/hash checked 2026-09-21 | Lines 1-17 explain action/axis mappings; line 19 selects `[/Script/Engine.InputSettings]`; lines 20-21 contain commented examples. No active binding or component registration directive appears. |

The [local snapshot](PASSIVE_OBSERVER_LOCAL_SNAPSHOT.json) records the installation/template inventory separately. This review did not treat file presence, matching engine metadata or a module name as proof that any runtime component will exist.

## Exact exposed types and operations

| Type or operation | Declared source | Exact relevant evidence and implication |
|---|---|---|
| `ModInfo(StructBase)` | Module `MechWarrior`, file `ModUtils.h`; PKG-API 87669-87802 | Properties and constructor at 87678-87694: display name, version, build number, description, author/URL, load order, game version, changed-file manifest, Steam published ID/submitted build/visibility. No component class, asset registration entry, world hook or initialization callback is declared. |
| `ModPackageArgs(StructBase)` | Module `MechWarriorEditor`, file `MWModEditorWidget.h`; PKG-API 112275-112338 | Constructor at 112292: `ModPackageArgs(mod_name="", skip_packaging=False, output_to_folder=False, publish_to_steam=False, steam_visibility="")`. The properties expose no output destination, isolated project path or completion callback. |
| `MWModEditorWidget(EditorUtilityWidget)` | Module `MechWarriorEditor`, file `MWModEditorWidget.h`; PKG-API 397620-397753 | `package_mod(self, args)` at 397703-397711 is documented as `x.package_mod(args) -> None`, with `args (ModPackageArgs)`. It is an instance method, so a valid widget instance and initialization context are prerequisites that this declaration does not resolve. |
| `MWModUtils(BlueprintFunctionLibrary)` | Module `MechWarrior`, file `ModUtils.h`; PKG-API 296883-297151 | Declares helpers for mod metadata/status/listing, paths, conflict comparison and active-mod selection. It does not expose `package_mod` in its own class block. Do not substitute a guessed `MWModUtils.package_mod` call. |
| `MWModUtils.save_mod_info_to_file(mod_name, mod_info, reset_steam_last_submitted_build_number) -> None` | PKG-API 296939-296949 | A declared metadata write operation; no claim of observer registration or component creation appears. It was not called. |
| `MWModUtils.set_active_mod(mod_name, browse_to_folder=False) -> None` | PKG-API 296928-296937 | A declared selection/mutation operation, not an observer startup contract. Exact side effects are not supplied. It was not called. |
| `MWModUtils.create_mod_entry(plugin_info) -> ModListEntry` | PKG-API 297140-297151 | The result is a `ModListEntry` value. Its name is not evidence that it creates a plugin folder, descriptor, content assets or a runtime component. |
| `MWModPluginInfo(StructBase)` | Module `MechWarrior`, file `ModUtils.h`; PKG-API 87415-87439 | Declared metadata includes mod name/plugin path, display/version fields, category and author/support/documentation URLs. No observer class or startup function is in this property list. |
| `ModListEntry`, `ModStatus` | Module `MechWarrior`, file `ModUtils.h`; PKG-API 87589-87667 | Entry fields are name, info, origin and status; status has an `enabled` Boolean. An enabled mod is not evidence of component instantiation. |

The native header filenames are **documentation attribution**, not inspected native header bodies. An exposed declaration is established; callable behavior, supported widget construction and the package implementation are not.

## Folder output, publishing and stale-output hazards

1. **DOCUMENTED:** `output_to_folder` and `publish_to_steam` are separate Boolean fields (PKG-API 112286-112292, 112313-112329). **PROPOSED guard for any later approved local cook:** explicitly require Steam publication disabled and folder output selected. The declaration does not establish exclusivity, operation ordering or what happens when both/neither is selected, so it is not a sufficient safety contract by itself.
2. **DOCUMENTED:** `steam_visibility` accepts the named options `Private`, `FriendsOnly`, and `Public` (112290, 112331-112338); `PublishedModVisibility` similarly has private/friends/public entries (15607-15620), and `ModInfo` declares a private constructor default (87693). **PROPOSED interpretation:** private visibility is a visibility choice for publication, not an offline-only mode. Do not authorize or trigger Steam upload merely because its visibility is private.
3. **DOCUMENTED:** `skip_packaging=True` uses an existing staging/intermediate folder if possible (112289, 112304-112311). **PROPOSED consequence:** a later source change plus packaging skipped cannot establish a fresh cook. Record explicit fresh-cook settings and artifact hashes before attributing output to source.
4. **DOCUMENTED:** `ModInfo.build_number` is described as auto-versioned and incremented when a package is published (87682, 87714-87721). **UNKNOWN/BLOCKED:** this stub does not define whether local folder export follows that same increment path. A build number cannot replace source/cooked hashes or a verified completion record.
5. **DOCUMENTED:** `package_mod` returns `None` and its declaration includes no completion/error value or output path (397703-397711). **UNKNOWN/BLOCKED:** synchronous/asynchronous behavior, native error reporting, destination picker behavior, output naming and disk requirements are not present. A successful method invocation would not itself prove cook/package success.
6. **DOCUMENTED:** the same editor widget declares Steam callback registration and Steam state/user queries (397682-397693, 397718-397747). **Limit:** presence alone does not prove those actions occur during a folder-only cook; this review did not invoke them or infer a network effect.

`get_mods_install_path() -> str` (PKG-API 297014-297022) is an accessor declaration with no concrete path in its documentation. The stub's empty-string return is a placeholder. It cannot justify a guessed destination or automatic copy into the retail game.

## What metadata does not establish

**OBSERVED text:** the inspected `ModInfo`, `MWModPluginInfo`, `ModListEntry` and `ModStatus` fields have no player-controller component registration field. The inspected template configuration contains only an empty tags section and commented input examples.

**UNKNOWN/BLOCKED:** whether the real controller-component data asset is discovered from a mounted cooked mod, when its factory runs, and whether that creates exactly one observer per intended lifecycle. Those questions belong to the [passive observer handoff](../design/PASSIVE_OBSERVER_HANDOFF.md) and the independent factory trace. The lack of a field in these metadata declarations does not prove that a separate registry mechanism cannot work.

Creating/saving mod metadata, selecting an active editor mod, enabling a retail mod, mounting its assets, discovering a data asset, invoking the component factory and actually constructing a correctly owned component are distinct events. This review supplies declarations for only some of those events. It does not infer the missing links from a descriptor, a `manifest` list, a successful cook or a visible mod-list row.

## Smallest next action

**PROPOSED:** use the primary PGI creation/cooking documentation and the independent factory trace to finish the exact **creation-only editor inspection** scope: create the proposed empty `LanceObserverProbe` through the documented mod tool only after that editor action is explicitly approved; capture the actual generated descriptor, directories and selected mod identity before making assets or cooking. The initial inspection must stop before package/publish buttons or retail changes. This resolves the generated descriptor and source-folder uncertainty without pretending the stub contains them.

If current static evidence already identifies a narrowly named missing native/widget asset or configuration record, inspect that existing text first. Do not replace the missing path with generic UE packaging flags, a guessed Python constructor, an editor-runtime assumption or copied template files. Resolve observer discovery/initialization before proposing a cook; then separately specify actual source assets, exact local package destination, Steam-disabled settings, fresh-cook evidence and output/removal manifest. No such action was executed here.

| Validation | Status |
|---|---|
| Read and hash existing reference/template text; verify source ranges | OBSERVED |
| Exact editor package-method declaration | DOCUMENTED |
| Complete automated create/cook procedure | UNKNOWN/BLOCKED |
| Metadata automatically registers observer | NOT_ESTABLISHED |
| New mod/assets, cook, publication, installation, editor/game execution | NOT_PERFORMED |
| Cooked observer construction, identity/lifecycle correctness or gameplay compatibility | NOT_PERFORMED |
