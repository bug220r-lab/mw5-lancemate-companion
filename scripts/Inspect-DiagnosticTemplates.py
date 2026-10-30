"""One fixed, already-loaded-object inspection; never load or edit an asset.

The native entry is dormant until a fresh reviewed manifest/process pin exists.
Only ObjectExporterT3D task objects are configured. Native calls are synchronous:
time and exporter-size limits are cooperative/post-call, not hard interruption.
Exports describe editor memory, not proven saved-memory or reference health.
"""
import ctypes
from ctypes import wintypes
import datetime
import hashlib
import importlib.util
import itertools
import json
import os
from pathlib import Path
import re
import sys
import time
import uuid

ROOT = Path(__file__).resolve().parent.parent
EXPECTED_ROOT = Path(r"C:\Users\jlewi\OneDrive\Documents\ChatGPT\MW5 LANCEMATE COMPANION")
EDITOR_EXE = Path(r"C:\Program Files\Epic Games\MechWarrior5Editor\Engine\Binaries\Win64\UE4Editor.exe")
MANIFEST = ROOT / "research/OBSERVER_DIAGNOSTIC_TEMPLATE_INSPECTION_MANIFEST.json"
CHECKPOINT = ROOT / "research/evidence/editor-authored/LanceObserverDiagnosticControl-20260925T222809Z-548b77b2-source-checkpoint/SOURCE_CHECKPOINT.json"
CHECKPOINT_SHA = "e178797fac03c6558f427a862fc1d6c0750c3198f190a18d6e528416477b698f"
FREEZE = ROOT / "research/OBSERVER_DIAGNOSTIC_CONTROL_SOURCE_FREEZE_2026-09-25.json"
FREEZE_SHA = "9f515b7b40cc9ab2830dda5f739fb5c367486c135b0b90d04b3ab3bee8e7c6ef"
UTILITY_PINS = (
    ("Inspect-FinalDiagnosticControl.py", "055fe707fcd7044a294e6fef99732bb2373c38364ebc509de17eab5d1d0b0c60"),
    ("Inspect-DiagnosticControllerCopy.py", "daa431f3d271e1d0f01345a97d87f018211bcbdbdefdd0f6d9d4a3f15e092360"),
)
PREFIXES = {
    "diagnostic": "/ModOverride/LanceObserverDiagnosticControl/Modes/InstantAction/InstantActionPlayerController.InstantActionPlayerController_C",
    "stock": "/Game/Modes/InstantAction/InstantActionPlayerController.InstantActionPlayerController_C",
}
# Full class pins require the narrowly inspected saved-package/declaration record.
COMPONENT_BASE = "/Game/Objects/_common/Components/PlayerControllerComponents/"
COMPONENTS = ("PlayerControllerSwitchMech", "PlayerControllerAirStrikeComponent", "ControllerFeedbackComponent")
SPEC = (("SimpleConstructionScript_0", "/Script/Engine.SimpleConstructionScript"),
        ("InheritableComponentHandler", "/Script/Engine.InheritableComponentHandler")) + tuple(
    (name + "_GEN_VARIABLE", COMPONENT_BASE + name + "." + name + "_C") for name in COMPONENTS)
TARGETS = tuple({"label": scope + "-" + name, "scope": scope, "name": name,
                 "object_path": prefix + ":" + name, "class_path": kind,
                 "outer_path": prefix} for scope, prefix in PREFIXES.items() for name, kind in SPEC)
ACTIVE_KEY = "_mw5_diagnostic_template_inspection"
OTHER_ACTIVE_KEYS = ("_mw5_diagnostic_controller_copy_inspection", "_mw5_authored_observer_inspection",
    "_mw5_observer_caller_inspection", "_mw5_observer_mode_inspection", "_mw5_observer_base_mode_inspection",
    "_mw5_ai_research_collection", "_mw5_source_research_collection", "_mw5_final_diagnostic_control_inspection",
    "_mw5_diagnostic_widget_copy_preparation", "_mw5_diagnostic_widget_text_update")
MAX_EXPORT, MAX_RAW, MAX_INDEX_TOTAL = 1024**2, 8 * 1024**2, 8 * 1024**2
MAX_RECEIPT, MAX_SECONDS, MIN_DISK = 128 * 1024, 90, 2 * 1024**3
MAX_OUTERS = 8


def file_record(path, limit=8 * 1024**2):
    """Stable regular-file read; zero bytes are valid only for selection markers."""
    path = Path(path)
    if path.is_symlink() or not path.is_file():
        raise ValueError("NOT_REGULAR_FILE: " + str(path))
    with path.open("rb") as stream:
        before = os.fstat(stream.fileno())
        if not 0 <= before.st_size <= limit:
            raise ValueError("FILE_SIZE_LIMIT")
        raw = stream.read(limit + 1)
        after = os.fstat(stream.fileno())
    signature = lambda s: (s.st_dev, s.st_ino, s.st_size, s.st_mtime_ns)
    if len(raw) > limit or len(raw) != before.st_size or signature(before) != signature(after) or signature(after) != signature(path.stat()):
        raise ValueError("FILE_CHANGED_DURING_READ")
    return raw, {"path": str(path), "bytes": len(raw), "sha256": hashlib.sha256(raw).hexdigest()}


def pinned_bytes(path, sha, limit=8 * 1024**2):
    raw, record = file_record(path, limit)
    if record["sha256"] != sha:
        raise ValueError("PIN_MISMATCH: " + str(path))
    return raw


def utilities():
    modules = []
    for index, (filename, sha) in enumerate(UTILITY_PINS):
        path = ROOT / "scripts" / filename
        pinned_bytes(path, sha)
        spec = importlib.util.spec_from_file_location("_template_readonly_util_" + str(index), str(path))
        module = importlib.util.module_from_spec(spec)
        prior = sys.dont_write_bytecode
        try:
            sys.dont_write_bytecode = True
            spec.loader.exec_module(module)  # Definitions only; never call old run().
        finally:
            sys.dont_write_bytecode = prior
        modules.append(module)
    return modules


def fixed_protected_inputs():
    checkpoint = json.loads(pinned_bytes(CHECKPOINT, CHECKPOINT_SHA))
    pins = []
    for root, rows in ((checkpoint["source_root"], checkpoint["content_files"]),
                       (checkpoint["backup_root"], checkpoint["backup_files"]),
                       (None, checkpoint["original7_source_descriptor_stock9_after"])):
        for row in rows:
            path = Path(root) / row["path"] if root else Path(row["path"])
            pins.append({"path": str(path), "bytes": row["bytes"], "sha256": row["sha256"]})
    for path, sha in ((CHECKPOINT, CHECKPOINT_SHA), (FREEZE, FREEZE_SHA)) + tuple(
            (ROOT / "scripts" / name, sha) for name, sha in UTILITY_PINS):
        raw = pinned_bytes(path, sha)
        pins.append({"path": str(path), "bytes": len(raw), "sha256": sha})
    return pins


def process_identity():
    """Same query-only Win32 calls as WindowBridge; no window/input operation."""
    kernel = ctypes.WinDLL("kernel32", use_last_error=True)
    kernel.OpenProcess.argtypes, kernel.OpenProcess.restype = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD], wintypes.HANDLE
    kernel.QueryFullProcessImageNameW.argtypes = [wintypes.HANDLE, wintypes.DWORD, wintypes.LPWSTR, ctypes.POINTER(wintypes.DWORD)]
    kernel.QueryFullProcessImageNameW.restype = wintypes.BOOL
    kernel.GetProcessTimes.argtypes, kernel.GetProcessTimes.restype = [wintypes.HANDLE] + [ctypes.POINTER(wintypes.FILETIME)] * 4, wintypes.BOOL
    kernel.CloseHandle.argtypes, kernel.CloseHandle.restype = [wintypes.HANDLE], wintypes.BOOL
    handle = kernel.OpenProcess(0x1000, False, os.getpid())
    if not handle:
        raise OSError("PROCESS_IDENTITY_UNAVAILABLE")
    try:
        buffer, times = ctypes.create_unicode_buffer(32768), [wintypes.FILETIME() for _ in range(4)]
        size = wintypes.DWORD(len(buffer))
        if not kernel.QueryFullProcessImageNameW(handle, 0, buffer, ctypes.byref(size)) or not kernel.GetProcessTimes(handle, *(ctypes.byref(t) for t in times)):
            raise OSError("PROCESS_IDENTITY_UNAVAILABLE")
        return {"pid": os.getpid(), "executable": buffer.value,
                "creation_filetime": str((times[0].dwHighDateTime << 32) | times[0].dwLowDateTime)}
    finally:
        kernel.CloseHandle(handle)


def validate_native_manifest(manifest, identity, now):
    if manifest.get("status") != "REVIEWED_NATIVE_READY" or manifest.get("schema_version") != 1:
        raise ValueError("NATIVE_REVIEW_AND_EDITOR_AVAILABILITY_REQUIRED")
    if manifest.get("targets") != list(TARGETS) or manifest.get("allow_load") is not False:
        raise ValueError("FIXED_SCOPE_REQUIRED")
    if manifest.get("editor_identity") != identity or Path(identity["executable"]).resolve() != EDITOR_EXE.resolve():
        raise ValueError("FRESH_EDITOR_IDENTITY_MISMATCH")
    stamp = datetime.datetime.fromisoformat(manifest["reviewed_at_utc"].replace("Z", "+00:00"))
    age = (now - stamp).total_seconds()
    if (not 0 <= age <= 600 or manifest.get("native_owner_confirmed") is not True
            or any(not isinstance(manifest.get(key), str) or not 0 < len(manifest[key].strip()) <= 2048
                   for key in ("native_owner", "owner_evidence"))):
        raise ValueError("FRESH_OWNER_REVIEW_REQUIRED")


def selection_snapshot(markers):
    result = []
    for marker in markers:
        path = Path(marker["path"])
        if path.exists():
            _, record = file_record(path, 1024)
            result.append(dict(record, present=True))
        else:
            result.append({"path": str(path), "present": False})
    return result


def protected_snapshot(pins):
    result = []
    for pin in pins:
        try:
            _, actual = file_record(pin["path"])
            actual["matches"] = all(actual[key] == pin[key] for key in ("bytes", "sha256"))
        except Exception as exc:
            actual = {"path": pin["path"], "matches": False, "error": str(exc)[:512]}
        result.append(actual)
    return result


def object_identity(obj, target, record):
    if obj is None:
        record.update(status="NOT_ALREADY_LOADED", interpretation="UNKNOWN")
        return False
    chain, current = [], obj
    for _ in range(MAX_OUTERS):
        if current is None:
            break
        name = current.get_path_name()
        if len(name) > 2048 or name in chain:
            raise ValueError("OUTER_CHAIN_CYCLE_OR_PATH_LIMIT")
        chain.append(name)
        current = current.get_outer()
    record.update(observed_path=chain[0], observed_class=obj.get_class().get_path_name(), outer_chain=chain)
    if current is not None:
        raise ValueError("OUTER_CHAIN_LIMIT")
    actual_outer = chain[1] if len(chain) > 1 else None
    if record["observed_path"] != target["object_path"] or record["observed_class"] != target["class_path"] or actual_outer != target["outer_path"]:
        record["status"] = "REJECTED_IDENTITY_OR_ALIAS"
        raise ValueError("EXACT_OBJECT_CLASS_OUTER_MISMATCH: " + target["label"])
    if target["scope"] == "stock" and any("/ModOverride/" in name for name in chain):
        record["status"] = "REJECTED_STOCK_ALIAS"
        raise ValueError("STOCK_TO_COPY_ALIAS")
    record["status"] = "EXACT_IDENTITY_OBSERVED"
    return True


def _inspect(api, manifest, root, final, health_query, clock, native, extra_guard=lambda: None, inspection_identity=None, prepare=None):
    if not native and getattr(api, "__name__", None) == "unreal":
        raise ValueError("REAL_API_FORBIDDEN_IN_MOCK")
    evidence = Path(root) / "research/evidence/editor-source"
    if not evidence.is_dir() or evidence.resolve() != evidence.absolute():
        raise ValueError("EVIDENCE_DIRECTORY_MISSING_OR_REDIRECTED")
    if (any(evidence.glob(".diagnostic-*.lock")) or any(evidence.glob(".observer-*.lock"))
            or any(getattr(api, key, None) is not None for key in (ACTIVE_KEY,) + OTHER_ACTIVE_KEYS)):
        raise RuntimeError("OTHER_INSPECTION_ACTIVE")
    pins, markers = manifest["protected_files"], manifest["selection"]
    token = uuid.uuid4().hex
    lock = evidence / ".diagnostic-template-inspection.lock"
    stamp = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    output = evidence / ("diagnostic-templates-" + stamp + "-" + token[:8])
    started, total, index_total = clock(), 0, 0
    report = {"status": "STARTED", "classification": "EDITOR_SOURCE_REQUIRES_REVIEW" if native else "MOCK_ONLY",
              "native_inspection": "STARTED" if native else "NOT_PERFORMED", "queries": [], "errors": [],
              "output_directory": str(output), "manifest": manifest,
              "inspection_identity": inspection_identity or {"classification": "MOCK_ONLY"},
              "asset_mutation_load_save_compile_selection_restart_cook_retail": "NOT_PERFORMED",
              "limitations": ["Loaded-memory identity only; not saved-memory, resolved-reference, inherited-default or runtime acceptance.",
                              "Missing/omitted fields remain UNKNOWN; lexical references are not proof of healthy binding.",
                              "At most ten exact finds/exports, eight outer steps, lexical nesting depth sixteen.",
                              "Native time/output limits are cooperative/post-call; cannot interrupt an exporter.",
                              "No fixed physical-RAM/commit admission gate; actual failures stop."]}
    if prepare is not None:
        # The separately admitted exact-load wrapper supplies this hook. The
        # original native and mock entries never supply one and remain no-load.
        del report["asset_mutation_load_save_compile_selection_restart_cook_retail"]
        report["explicit_asset_edit_save_compile_reload_selection_restart_cook_retail"] = "NOT_PERFORMED"
        report["loading"] = {"status": "NOT_STARTED", "attempted_calls": 0, "assets": []}
        report["limitations"][2] = "At most four root finds, two exact root loads, ten subobject finds and ten exports; eight outer steps and lexical depth sixteen."
        report["limitations"].append("Exact loading may load implicit dependencies and invoke normal native post-load work; no explicit compile/save calls.")

    def write_json(name, data, limit):
        raw = (json.dumps(data, indent=2, ensure_ascii=True) + "\n").encode("utf-8")
        if len(raw) > limit:
            raise ValueError("JSON_OUTPUT_LIMIT")
        with (output / name).open("xb") as stream:
            stream.write(raw)
        return {"file": name, "bytes": len(raw), "sha256": hashlib.sha256(raw).hexdigest()}

    def receipt(name):
        report.update(elapsed_seconds=round(clock() - started, 3), exported_bytes=total, inventory_bytes=index_total)
        try:
            write_json(name, report, MAX_RECEIPT)
        except ValueError as exc:
            if str(exc) != "JSON_OUTPUT_LIMIT":
                raise
            # Preserve a bounded stop; earlier raw exports/receipts stay intact.
            minimal = {key: report[key] for key in ("classification", "native_inspection", "output_directory",
                       "elapsed_seconds",
                       "exported_bytes", "inventory_bytes", "inspection_identity")}
            if "loading" in report:
                minimal["loading"] = {"status": report["loading"]["status"], "attempted_calls": report["loading"]["attempted_calls"]}
                minimal["explicit_asset_edit_save_compile_reload_selection_restart_cook_retail"] = "NOT_PERFORMED"
            else:
                minimal["asset_mutation_load_save_compile_selection_restart_cook_retail"] = "NOT_PERFORMED"
            minimal.update(status="STOPPED_RECEIPT_SIZE_LIMIT", errors=["RECEIPT_SIZE_LIMIT"],
                           query_count=len(report.get("queries", [])),
                           protected_unchanged=report.get("protected_unchanged", "UNKNOWN"),
                           selection_unchanged=report.get("selection_unchanged", "UNKNOWN"),
                           limitations=["Detailed receipt exceeded its bound; retain earlier receipts and raw files. No further native calls."])
            report.clear()
            report.update(minimal)
            write_json(name, report, MAX_RECEIPT)
            if name != "report.json":
                raise RuntimeError("RECEIPT_SIZE_LIMIT")

    def check():
        extra_guard()
        if clock() - started > MAX_SECONDS or total > MAX_RAW or index_total > MAX_INDEX_TOTAL:
            raise RuntimeError("COOPERATIVE_BUDGET_STOP")
        if (output / "STOP").exists():
            raise RuntimeError("USER_STOP")
        report["last_health"] = health_query(evidence)
        if report["last_health"]["disk_free"] < MIN_DISK:
            raise RuntimeError("DISK_RESOURCE_STOP")
        if not all(row["matches"] for row in protected_snapshot(pins)):
            raise ValueError("PROTECTED_INPUT_CHANGED")
        if selection_snapshot(markers) != markers:
            raise ValueError("SELECTION_CHANGED")

    with lock.open("x", encoding="ascii") as stream:
        stream.write(token)
    try:
        setattr(api, ACTIVE_KEY, token)
        output.mkdir(exist_ok=False)
        receipt("started.json")
        report["protected_before"] = protected_snapshot(pins)
        report["selection_before"] = selection_snapshot(markers)
        check()
        if prepare is not None:
            prepare(api, report, check, receipt)
            check()
        objects = []
        for target in TARGETS:
            check()
            record = {"target": target, "status": "QUERY_STARTED"}
            report["queries"].append(record)
            obj = api.find_object(None, target["object_path"], follow_redirectors=False)
            if object_identity(obj, target, record):
                objects.append((target, obj, record))
            check()
        exporter = api.ObjectExporterT3D()
        formats = list(itertools.islice(exporter.get_editor_property("format_extension"), 16))
        extension = next((str(value) for preferred in ("copy", "t3d") for value in formats if str(value).casefold() == preferred), None)
        if not exporter.get_editor_property("text") or extension is None:
            raise ValueError("TEXT_EXPORTER_UNAVAILABLE")
        for target, obj, record in objects:
            check()
            object_identity(obj, target, record)
            destination = output / (target["label"] + "." + extension)
            task = api.AssetExportTask()
            for key, value in {"object": obj, "exporter": exporter, "filename": str(destination), "automated": True,
                               "prompt": False, "replace_identical": False, "selected": False,
                               "use_file_archive": False, "write_empty_files": False}.items():
                task.set_editor_property(key, value)
            record["export_status"] = "STARTED"
            receipt("before-export-" + str(len([r for r in report["queries"] if "export_status" in r])) + ".json")
            success = bool(api.Exporter.run_asset_export_task(task))
            record["exporter_errors"] = [str(value)[:512] for value in itertools.islice(task.get_editor_property("errors"), 20)]
            raw, exported = file_record(destination, MAX_EXPORT)
            total += len(raw)
            record["export"] = exported
            if not success or record["exporter_errors"]:
                raise ValueError("EXPORT_FAILED_OR_ERRORS")
            check()
            # Colon subobjects use their final subobject name, not package.Class:Name.
            index = final.inventory(raw, target["name"], target["class_path"])
            index["reference_interpretation"] = "LEXICAL_ONLY_NOT_RESOLVED_REFERENCES"
            index["fixed_inventory_references"] = [
                {"path": candidate["text"], "status": "EXACT_INVENTORY_IDENTITY_OBSERVED" if any(
                    entry[0]["object_path"] == candidate["text"] for entry in objects) else "UNKNOWN_NOT_QUERIED"}
                for candidate in index["path_candidates"]]
            record["inventory"] = write_json(target["label"] + "-inventory.json", index, MAX_EXPORT)
            index_total += record["inventory"]["bytes"]
            record["export_status"] = "EXPORTED_REQUIRES_REVIEW"
            check()
        report["status"] = "COLLECTED_REQUIRES_REVIEW" if len(objects) == 10 else "PARTIAL_MISSING_OBJECTS_UNKNOWN"
        report["native_inspection"] = "PERFORMED" if native else "NOT_PERFORMED"
    except Exception as exc:
        report["status"] = "STOPPED_PARTIAL_REQUIRES_REVIEW"
        report["errors"].append(type(exc).__name__ + ": " + str(exc)[:1024])
        report["native_inspection"] = "ATTEMPTED_PARTIAL" if native else "NOT_PERFORMED"
    finally:
        try:
            report["protected_after"] = protected_snapshot(pins)
            report["protected_unchanged"] = all(row["matches"] for row in report["protected_after"])
            try:
                report["selection_after"] = selection_snapshot(markers)
                report["selection_unchanged"] = report["selection_after"] == markers
            except Exception as exc:
                report["selection_unchanged"] = False
                report["errors"].append("SELECTION_READ_FAILED: " + str(exc)[:512])
            if not report["protected_unchanged"] or not report["selection_unchanged"]:
                report["status"] = "STOPPED_PROTECTED_INPUT_OR_SELECTION_CHANGE"
            try:
                extra_guard()
            except Exception as exc:
                report["status"] = "STOPPED_INSPECTION_INPUT_CHANGE"
                report["errors"].append(str(exc)[:1024])
            if output.is_dir():
                receipt("report.json")
        finally:
            if getattr(api, ACTIVE_KEY, None) == token:
                delattr(api, ACTIVE_KEY)
            if lock.exists() and lock.read_text(encoding="ascii") == token:
                lock.unlink()
    return report


def run_mock(api, manifest, root, health_query, clock=time.monotonic):
    if getattr(api, "__name__", None) == "unreal":
        raise ValueError("REAL_API_FORBIDDEN_IN_MOCK")
    final, _ = utilities()
    return _inspect(api, manifest, root, final, health_query, clock, False)


def run_native(api, manifest_sha256=None):
    if ROOT.resolve() != EXPECTED_ROOT.resolve() or getattr(api, "__name__", None) != "unreal":
        raise ValueError("EXACT_PROJECT_EDITOR_REQUIRED")
    if not isinstance(manifest_sha256, str) or not re.fullmatch(r"[0-9a-f]{64}", manifest_sha256):
        raise ValueError("DORMANT_REVIEWED_MANIFEST_PIN_REQUIRED")
    manifest = json.loads(pinned_bytes(MANIFEST, manifest_sha256, MAX_RECEIPT))
    validate_native_manifest(manifest, process_identity(), datetime.datetime.now(datetime.timezone.utc))
    if manifest.get("protected_files") != fixed_protected_inputs():
        raise ValueError("PROTECTED_SCOPE_MISMATCH")
    expected_markers = [str(Path(row["path"])) for row in manifest["selection"]]
    expected_roots = [str(EDITOR_EXE.parents[3] / "MW5Mercs/Plugins" / name / "ActiveMod.txt")
                      for name in ("LanceObserverProbe", "LanceObserverDiagnosticControl")]
    if expected_markers != expected_roots:
        raise ValueError("SELECTION_SCOPE_MISMATCH")
    helper_sha = file_record(Path(__file__))[1]["sha256"]
    if manifest.get("helper_sha256") != helper_sha:
        raise ValueError("REVIEWED_HELPER_PIN_MISMATCH")
    final, common = utilities()

    def guard():
        pinned_bytes(MANIFEST, manifest_sha256, MAX_RECEIPT)
        pinned_bytes(Path(__file__), helper_sha)
        for name, sha in UTILITY_PINS:
            pinned_bytes(ROOT / "scripts" / name, sha)

    return _inspect(api, manifest, ROOT, final, common.health, time.monotonic, True, guard,
                    {"manifest_sha256": manifest_sha256, "helper_sha256": helper_sha,
                     "editor_identity": manifest["editor_identity"]})


if __name__ == "__main__":
    raise SystemExit("NATIVE_NOT_PERFORMED: import the reviewed module, then call run_native with a freshly reviewed manifest SHA256 inside the already-running editor")
