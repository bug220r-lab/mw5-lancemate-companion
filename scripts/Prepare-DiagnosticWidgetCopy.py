"""One-shot Phase A widget duplication and inspection, for reviewed editor use.

Only AssetTools.duplicate_asset may change editor assets. If the exact pinned
source is not loaded, one explicit load_asset call may load it and implicit
dependencies. No save, compile, text/default change, UI operation, registry scan,
Play or cook. A created
duplicate is retained on any later failure; never retry without reviewing it.
Native calls are synchronous: resource/time/output checks cannot interrupt them.
See research/OBSERVER_DIAGNOSTIC_CONTROL_AUTHORING_ROUTE_2026-09-25.md for API evidence.
"""
import ctypes
from ctypes import wintypes
import datetime
import hashlib
import itertools
import json
from pathlib import Path
import re
import shutil
import time
import uuid

ROOT = Path(__file__).resolve().parent.parent
EXPECTED_ROOT = Path(r"C:\Users\jlewi\OneDrive\Documents\ChatGPT\MW5 LANCEMATE COMPANION")
EDITOR = Path(r"C:\Program Files\Epic Games\MechWarrior5Editor\MW5Mercs")
PROBE = EDITOR / "Plugins/LanceObserverProbe"
DIAGNOSTIC = EDITOR / "Plugins/LanceObserverDiagnosticControl"
SOURCE = "/LanceObserverProbe/WBP_LanceObserverProbeReadout.WBP_LanceObserverProbeReadout"
NAME = "WBP_ObserverDiagnosticControl"
PACKAGE_PATH = "/LanceObserverDiagnosticControl"
DESTINATION = PACKAGE_PATH + "/" + NAME + "." + NAME
DESTINATION_FILE = DIAGNOSTIC / "Content" / (NAME + ".uasset")
BLUEPRINT_CLASS = "/Script/UMGEditor.WidgetBlueprint"
PINS = tuple((PROBE / relative, size, pin) for relative, size, pin in (
    ("LanceObserverProbe.uplugin", 422, "fdee15a050ec0df0a0b54af070c0680e248190d21e10e6ade1efaaddec010a08"),
    ("Config/Input/LanceObserverProbeInput.ini", 1383, "fc21b00d6db183e8434466e27f0f4fc194f7e852f66ce68bc15c9323271aa17d"),
    ("Config/Tags/LanceObserverProbeTags.ini", 43, "ad7f8b6d4415fb7edb4d52e83942a67c66313da7ea504e6196679db31b147e1b"),
    ("Content/BP_LanceObserverProbeComponent.uasset", 139586, "6a364cd8e9a35da959de67c0ab1ac0707a062100083f4503da74aef9ad57913a"),
    ("Content/WBP_LanceObserverProbeReadout.uasset", 31659, "937538d7420b6b810cfaa1b4bfcc2fa5c2f7e50be2eb25ff8a771f0e00564282"),
    ("Content/DA_LanceObserverProbeRegistration.uasset", 2111, "c5c09bbc3f6ee38e18e8ed330f405a6d7aba649a9ca8c4b9aad6581f82a28c35"),
    ("Resources/Icon128.png", 12352, "ec157f56f486e5a68fd4b27df6c88fecdb1b8f9bfff18aa5ef10a21bca6a4c5e"),
)) + (
    (EDITOR / "Content/Modes/InstantAction/InstantActionPlayerController.uasset", 53635,
     "7107745a8de461275a7acfa1f3ffc5be9bcb7002682c37b7705af5f00783e4f6"),
    (DIAGNOSTIC / "ModOverride/Modes/InstantAction/InstantActionPlayerController.uasset", 61058,
     "e08001c7c1c8bf5c67b5bd00dc7fb65deed4c7ac8e1935a41e48f2c0f5ab85bc"),
)
ACTIVE_KEY = "_mw5_diagnostic_widget_copy_preparation"
OTHER_KEYS = ("_mw5_diagnostic_controller_copy_inspection", "_mw5_authored_observer_inspection",
              "_mw5_observer_caller_inspection", "_mw5_observer_mode_inspection",
              "_mw5_observer_base_mode_inspection", "_mw5_ai_research_collection",
              "_mw5_source_research_collection")
MAX_FILE, MAX_TOTAL, MAX_SECONDS = 8 * 1024**2, 16 * 1024**2, 90


def digest(path):
    before = path.stat()
    if not 0 < before.st_size <= MAX_FILE:
        raise ValueError("FILE_SIZE_LIMIT: " + str(path))
    value, count = hashlib.sha256(), 0
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(65536), b""):
            count += len(chunk)
            if count > MAX_FILE:
                raise ValueError("FILE_GREW_BEYOND_LIMIT")
            value.update(chunk)
    after = path.stat()
    if (before.st_size, before.st_mtime_ns) != (after.st_size, after.st_mtime_ns) or count != after.st_size:
        raise ValueError("FILE_CHANGED_DURING_READ")
    return value.hexdigest()


def protected_files():
    result = []
    for path, size, expected in PINS:
        actual = digest(path)
        record = {"path": str(path), "bytes": path.stat().st_size, "sha256": actual}
        if record["bytes"] != size or actual != expected:
            raise ValueError("PROTECTED_FILE_CHANGED: " + str(path))
        result.append(record)
    return result


def health(path):
    class MemoryStatus(ctypes.Structure):
        _fields_ = [("length", wintypes.DWORD), ("load", wintypes.DWORD)] + [
            (name, ctypes.c_ulonglong) for name in
            ("total_phys", "avail_phys", "total_page", "avail_page",
             "total_virtual", "avail_virtual", "avail_extended")]
    value = MemoryStatus()
    value.length = ctypes.sizeof(value)
    query = ctypes.WinDLL("kernel32", use_last_error=True).GlobalMemoryStatusEx
    query.argtypes, query.restype = [ctypes.POINTER(MemoryStatus)], wintypes.BOOL
    if not query(ctypes.byref(value)):
        raise OSError("MEMORY_HEALTH_UNAVAILABLE")
    return {"disk_free": shutil.disk_usage(str(path)).free,
            "physical_available": value.avail_phys, "commit_available": value.avail_page}


def template_text_paths(export_text, root_name=NAME):
    """Read named declarations from actual native COPY output; never synthesize it.

    Supports only the simple observed hierarchy. Unknown/ambiguous structures stop.
    The native object lookup and class/outer checks remain authoritative afterward.
    """
    stack, declarations, roots = [], {}, 0
    for line in export_text.splitlines():
        line = line.strip()
        if line.startswith("Begin Object "):
            name = re.search(r'\bName="([A-Za-z_][A-Za-z0-9_]*)"', line)
            kind = re.search(r'\bClass=(/[^\s]+)', line)
            if not name or len(stack) >= 16:
                raise ValueError("UNSUPPORTED_EXPORT_OBJECT_HEADER")
            if not stack:
                roots += 1
                if name.group(1) != root_name or not kind or kind.group(1) != BLUEPRINT_CLASS:
                    raise ValueError("EXPORT_ROOT_IDENTITY_MISMATCH")
            stack.append(name.group(1))
            if kind:
                key = tuple(stack)
                previous = declarations.setdefault(key, kind.group(1))
                if previous != kind.group(1) or len(declarations) > 128:
                    raise ValueError("EXPORT_DECLARATION_AMBIGUITY_OR_LIMIT")
        elif line == "End Object":
            if not stack:
                raise ValueError("UNBALANCED_EXPORT")
            stack.pop()
    if stack or roots != 1:
        raise ValueError("UNBALANCED_OR_MULTIPLE_ROOT_EXPORT")
    trees = [key for key, kind in declarations.items()
             if kind == "/Script/UMG.WidgetTree" and len(key) == 2]
    if len(trees) != 1:
        raise ValueError("EXPECTED_ONE_TEMPLATE_WIDGET_TREE")
    texts = [key for key, kind in declarations.items()
             if kind == "/Script/UMG.TextBlock" and key[:2] == trees[0]]
    if len(texts) != 1:
        raise ValueError("EXPECTED_ONE_TEMPLATE_TEXT_BLOCK")
    return [".".join(key[1:]) for key in texts]


def run(api):
    if ROOT.resolve() != EXPECTED_ROOT.resolve() or getattr(api, "__name__", None) != "unreal":
        raise ValueError("NATIVE_SCOPE_MISMATCH")
    evidence = (ROOT / "research/evidence/editor-source").resolve()
    evidence.relative_to(ROOT.resolve())
    if not evidence.is_dir() or not (DIAGNOSTIC / "Content").is_dir():
        raise ValueError("EXPECTED_DIRECTORY_MISSING")
    for key in (ACTIVE_KEY,) + OTHER_KEYS:
        active = getattr(api, key, None)
        if active is not None and not getattr(active, "done", False):
            raise RuntimeError("OTHER_EDITOR_SCRIPT_ACTIVE")
    if any(evidence.glob(".observer-*.lock")) or any(evidence.glob(".diagnostic-*.lock")):
        raise RuntimeError("OTHER_EDITOR_SCRIPT_LOCK")
    started, total = time.monotonic(), 0
    token = uuid.uuid4().hex
    lock = evidence / ".diagnostic-widget-copy-preparation.lock"
    with lock.open("x", encoding="ascii") as stream:
        stream.write(token)
    setattr(api, ACTIVE_KEY, token)
    stamp = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    output = evidence / ("diagnostic-widget-copy-" + stamp + "-" + token[:8])
    report = {"status": "STARTED", "source": SOURCE, "destination": DESTINATION,
              "destination_file": str(DESTINATION_FILE), "errors": [], "exports": {},
              "source_load_attempted": False,
              "duplication_attempted": False, "duplicate_returned": False,
              "explicit_save_compile_text_change": "NOT_PERFORMED", "gameplay_cook_install": "NOT_PERFORMED",
              "memory_reserve_gate": "WAIVED_BY_USER_OBSERVE_ONLY",
              "limits": ["Native duplication may have editor side effects; no explicit save is called.",
                         "One exact-source load is permitted if not loaded; it may load implicit dependencies.",
                         "Plugin files corroborate source content, not active mounting; unresolved source stops.",
                         "Any created duplicate is retained on failure; no automatic retry or removal.",
                         "Disk pins do not certify unchanged unsaved source memory.",
                         "Native calls are synchronous; guards cannot interrupt them.",
                         "ActiveMod.txt is selection state and excluded from protected content."]}

    def receipt(label):
        report["elapsed_seconds"] = round(time.monotonic() - started, 3)
        report["exported_bytes"] = total
        data = (json.dumps(report, indent=2, ensure_ascii=True) + "\n").encode("utf-8")
        if len(data) > 128 * 1024:
            raise RuntimeError("RECEIPT_SIZE_LIMIT")
        with (output / label).open("xb") as stream:
            stream.write(data)

    def check():
        report["health"] = health(evidence)
        if report["health"]["disk_free"] < 2 * 1024**3:
            raise RuntimeError("DISK_RESOURCE_STOP")
        if time.monotonic() - started > MAX_SECONDS or total > MAX_TOTAL:
            raise RuntimeError("COOPERATIVE_BUDGET_STOP")
        if (output / "STOP").exists():
            raise RuntimeError("USER_STOP")
        protected_files()

    def identity(obj, expected_path, expected_class, label):
        observed = {"found": obj is not None, "expected_path": expected_path, "expected_class": expected_class}
        report[label] = observed
        if obj is not None:
            observed.update(path=obj.get_path_name(), class_path=obj.get_class().get_path_name())
        if obj is None or observed["path"] != expected_path or observed["class_path"] != expected_class:
            raise ValueError("OBJECT_IDENTITY_MISMATCH: " + label)
        return obj

    def owned_identity(obj, expected_class):
        if obj is None or obj.get_class().get_path_name() != expected_class:
            raise ValueError("TEMPLATE_TYPE_MISMATCH")
        names, current = [], obj
        for unused in range(8):
            names.append(current.get_path_name())
            if names[-1] == DESTINATION:
                return {"path": obj.get_path_name(), "class_path": expected_class, "outer_chain": names}
            current = current.get_outer()
            if current is None:
                break
        raise ValueError("TEMPLATE_NOT_OWNED_BY_DUPLICATE")

    def boolean_property(obj, name):
        value = obj.get_editor_property(name)
        if type(value) is not bool:
            raise ValueError("NON_BOOLEAN_EDITOR_PROPERTY: " + name)
        return value

    def export(obj, label):
        nonlocal total
        check()
        path = output / (label + "." + extension)
        task = api.AssetExportTask()
        for key, value in {"object": obj, "exporter": exporter, "filename": str(path),
                           "automated": True, "prompt": False, "replace_identical": False,
                           "selected": False, "use_file_archive": False, "write_empty_files": False}.items():
            task.set_editor_property(key, value)
        record = {"file": path.name, "status": "EXPORT_STARTED"}
        report["exports"][label] = record
        record["return"] = bool(api.Exporter.run_asset_export_task(task))
        record["errors"] = [str(value)[:1000] for value in itertools.islice(task.get_editor_property("errors"), 20)]
        if not path.is_file():
            raise RuntimeError("EXPORT_NO_FILE")
        record["bytes"] = path.stat().st_size
        total += record["bytes"]
        record["sha256"] = digest(path)
        if not record["return"] or record["errors"] or total > MAX_TOTAL:
            raise RuntimeError("EXPORT_FAILED_OR_LIMIT")
        record["status"] = "EXPORTED_REQUIRES_REVIEW"
        check()
        return path

    try:
        output.mkdir(exist_ok=False)
        report["output_directory"] = str(output)
        report["script_sha256"] = digest(Path(__file__))
        receipt("started.json")
        check()
        report["protected_before"] = protected_files()
        collision = api.find_object(None, DESTINATION, follow_redirectors=False)
        report["destination_before"] = {"disk_exists": DESTINATION_FILE.exists(),
                                        "object_found": collision is not None,
                                        "object_path": collision.get_path_name() if collision is not None else None}
        if DESTINATION_FILE.exists() or collision is not None:
            raise ValueError("DESTINATION_ALREADY_EXISTS")
        descriptor_path = PROBE / "LanceObserverProbe.uplugin"
        descriptor = json.loads(descriptor_path.read_text(encoding="utf-8-sig"))
        if descriptor.get("CanContainContent") is not True or descriptor.get("IsMod") is not True:
            raise ValueError("SOURCE_CONTENT_PLUGIN_IDENTITY_MISMATCH")
        report["source_content_corroboration"] = {
            "descriptor": str(descriptor_path), "can_contain_content": True, "is_mod": True,
            "source_file": str(PROBE / "Content/WBP_LanceObserverProbeReadout.uasset"),
            "mount_limitation": "Files alone do not prove the source mount is active."}
        source = api.find_asset(SOURCE, follow_redirectors=False)
        report["source_already_loaded"] = source is not None
        if source is None:
            check()
            report["source_load_attempted"] = True
            receipt("before-exact-source-load.json")
            source = api.load_asset(SOURCE, follow_redirectors=False)
            check()
        source = identity(source, SOURCE, BLUEPRINT_CLASS, "source_identity")
        receipt("source-identity.json")
        check()
        exporter = api.ObjectExporterT3D()
        formats = [str(value) for value in itertools.islice(exporter.get_editor_property("format_extension"), 16)]
        extension = next((value for preferred in ("copy", "t3d") for value in formats if value.casefold() == preferred), None)
        if not exporter.get_editor_property("text") or extension is None:
            raise RuntimeError("TEXT_EXPORTER_UNAVAILABLE")
        asset_tools = api.AssetToolsHelpers.get_asset_tools()
        if asset_tools is None:
            raise RuntimeError("ASSET_TOOLS_UNAVAILABLE")
        check()
        if DESTINATION_FILE.exists() or api.find_object(None, DESTINATION, follow_redirectors=False) is not None:
            raise ValueError("DESTINATION_APPEARED_BEFORE_DUPLICATION")
        report["duplication_attempted"] = True
        receipt("before-duplication.json")
        duplicate = asset_tools.duplicate_asset(NAME, PACKAGE_PATH, source)
        report["duplicate_returned"] = duplicate is not None
        identity(duplicate, DESTINATION, BLUEPRINT_CLASS, "duplicate_identity")
        receipt("after-duplication.json")
        check()
        source_export = export(duplicate, "widget-source")
        default_path = PACKAGE_PATH + "/" + NAME + ".Default__" + NAME + "_C"
        default = identity(api.find_object(None, default_path, follow_redirectors=False), default_path,
                           DESTINATION + "_C", "default_identity")
        export(default, "widget-defaults")
        report["default_properties"] = {"is_focusable": boolean_property(default, "is_focusable"),
                                        "visibility": str(default.get_editor_property("visibility")),
                                        "tick_frequency": str(default.get_editor_property("tick_frequency"))}
        template_paths = template_text_paths(source_export.read_text(encoding="utf-8-sig"))
        report["template_paths_from_actual_export"] = template_paths
        for relative in template_paths:
            check()
            path = DESTINATION + ":" + relative
            text = identity(api.find_object(None, path, follow_redirectors=False), path,
                            "/Script/UMG.TextBlock", "text_identity")
            report["template_text"] = owned_identity(text, "/Script/UMG.TextBlock")
            report["template_text"].update(text=str(text.get_editor_property("text")),
                                           auto_wrap_text=boolean_property(text, "auto_wrap_text"))
            slot = text.get_editor_property("slot")
            report["template_slot"] = owned_identity(slot, "/Script/UMG.CanvasPanelSlot")
            report["template_slot"].update(layout_data=str(slot.get_editor_property("layout_data")),
                                           auto_size=boolean_property(slot, "auto_size"),
                                           z_order=int(slot.get_editor_property("z_order")))
        check()
        report["status"] = "DUPLICATED_AND_INSPECTED_REQUIRES_REVIEW"
    except Exception as exc:
        report["status"] = "STOPPED_PARTIAL_DUPLICATE_MAY_EXIST" if report["duplication_attempted"] else "STOPPED_BEFORE_DUPLICATION"
        report["errors"].append(type(exc).__name__ + ": " + str(exc)[:2000])
    finally:
        try:
            try:
                report["protected_after"] = protected_files()
                report["protected_disk_files_unchanged"] = True
            except Exception as exc:
                report["protected_disk_files_unchanged"] = False
                report["status"] = "STOPPED_PROTECTED_FILE_CHANGE"
                report["errors"].append(str(exc)[:2000])
            report["destination_disk_after"] = {"exists": DESTINATION_FILE.exists()}
            if DESTINATION_FILE.is_file():
                try:
                    report["destination_disk_after"].update(bytes=DESTINATION_FILE.stat().st_size, sha256=digest(DESTINATION_FILE))
                except Exception as exc:
                    report["destination_disk_after"]["inspection_error"] = str(exc)[:2000]
            if output.is_dir():
                receipt("report.json")
        finally:
            if getattr(api, ACTIVE_KEY, None) == token:
                delattr(api, ACTIVE_KEY)
            if lock.exists() and lock.read_text(encoding="ascii") == token:
                lock.unlink()
    return report


if __name__ == "__main__":
    import unreal
    result = run(unreal)
    print("DIAGNOSTIC_WIDGET_COPY: " + result["status"] + " | " + result.get("output_directory", ""))
