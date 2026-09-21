"""Prepared single-asset editor research helper; native execution NOT_PERFORMED.

Future authorized use only: File > Execute Python Script in the MW5 editor.
No save, explicit compile, Play, cook, install, registry scan or dependency walk.
Native loading/export may implicitly load dependencies and regenerate editor
data/cache. Calls are synchronous: time/resource/size guards are cooperative,
cannot forcibly interrupt native work and are not hard allocation/output caps.
Importing this file does not import unreal or perform an inspection.
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

PROJECT = Path(__file__).resolve().parent.parent
EXPECTED_PROJECT = Path(r"C:\Users\jlewi\OneDrive\Documents\ChatGPT\MW5 LANCEMATE COMPANION")
SOURCE = Path(r"C:\Program Files\Epic Games\MechWarrior5Editor\MW5Mercs\Content\Modes\InstantAction\InstantActionPlayerController.uasset")
SOURCE_SHA256 = "7107745a8de461275a7acfa1f3ffc5be9bcb7002682c37b7705af5f00783e4f6"
OBJECT_PATH = "/Game/Modes/InstantAction/InstantActionPlayerController.InstantActionPlayerController"
CLASS_PATH = OBJECT_PATH + "_C"
DEFAULT_PATH = OBJECT_PATH.rsplit(".", 1)[0] + ".Default__InstantActionPlayerController_C"
ACTIVE_KEY = "_mw5_observer_caller_inspection"
MAX_SOURCE, MAX_FILE, MAX_TOTAL = 1024**2, 8 * 1024**2, 17 * 1024**2
MAX_SECONDS, MAX_JSON = 120, 64 * 1024


def digest_file(path, limit):
    path = Path(path)
    before = path.stat()
    if not 0 < before.st_size <= limit:
        raise ValueError("FILE_SIZE_LIMIT: " + str(path))
    digest, count = hashlib.sha256(), 0
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(65536), b""):
            count += len(chunk)
            if count > limit:
                raise ValueError("FILE_GREW_BEYOND_LIMIT")
            digest.update(chunk)
    after = path.stat()
    if (before.st_size, before.st_mtime_ns) != (after.st_size, after.st_mtime_ns) or count != after.st_size:
        raise ValueError("FILE_CHANGED_DURING_READ")
    return digest.hexdigest()


def system_health(root):
    class MemoryStatus(ctypes.Structure):
        _fields_ = [("length", wintypes.DWORD), ("load", wintypes.DWORD)] + [
            (name, ctypes.c_ulonglong) for name in
            ("total_phys", "avail_phys", "total_page", "avail_page",
             "total_virtual", "avail_virtual", "avail_extended")]
    status = MemoryStatus()
    status.length = ctypes.sizeof(status)
    query = ctypes.WinDLL("kernel32", use_last_error=True).GlobalMemoryStatusEx
    query.argtypes, query.restype = [ctypes.POINTER(MemoryStatus)], wintypes.BOOL
    if not query(ctypes.byref(status)):
        raise OSError("Memory health unavailable")
    return {"disk_free": shutil.disk_usage(str(root)).free,
            "physical_available": status.avail_phys, "commit_available": status.avail_page}


def main(api, root=PROJECT, source_path=SOURCE, expected_sha256=SOURCE_SHA256,
         health=system_health, clock=time.monotonic, native=False):
    """Return a report dict. Fake-API tests use native=False (always MOCK_ONLY).

    Fixture path/hash overrides are accepted only in MOCK_ONLY mode. Native entry
    fixes the source, fingerprint, project and this script's project location.
    Preflight failures raise before calling the supplied API. Later failures are
    preserved in this invocation's unique output directory and returned report.
    """
    if not native and getattr(api, "__name__", None) == "unreal":
        raise ValueError("REAL_UNREAL_API_FORBIDDEN_IN_MOCK_MODE")
    root, source_path = Path(root).resolve(), Path(source_path).resolve()
    if native and (root != EXPECTED_PROJECT.resolve() or root != PROJECT.resolve()
                   or source_path != SOURCE.resolve() or expected_sha256 != SOURCE_SHA256):
        raise ValueError("NATIVE_SCOPE_MISMATCH")
    if not re.fullmatch(r"[0-9a-fA-F]{64}", expected_sha256):
        raise ValueError("INVALID_SOURCE_FINGERPRINT")
    evidence = (root / "research/evidence/editor-source").resolve()
    evidence.relative_to(root)
    if not evidence.is_dir():
        raise ValueError("Expected project evidence directory missing")
    if digest_file(source_path, MAX_SOURCE) != expected_sha256.lower():
        raise ValueError("SOURCE_HASH_MISMATCH")
    for key in (ACTIVE_KEY, "_mw5_ai_research_collection", "_mw5_source_research_collection"):
        active = getattr(api, key, None)
        if active is not None and not getattr(active, "done", False):
            raise RuntimeError("ANOTHER_RESEARCH_INSPECTION_ACTIVE")
    token = uuid.uuid4().hex
    lock = evidence / ".observer-caller-inspection.lock"
    # Exclusive file lock also rejects another interpreter or a stale crashed run.
    # A stale lock requires human review; never silently remove someone else's lock.
    with lock.open("x", encoding="ascii") as stream:
        stream.write(token)
    output, report, total, checkpoint_number = None, None, 0, 0
    started = clock()

    def source_guard():
        if digest_file(source_path, MAX_SOURCE) != expected_sha256.lower():
            raise ValueError("SOURCE_CHANGED_DURING_INSPECTION")

    def check():
        value = health(evidence)
        if report is not None:
            report["last_health"] = value
        if (value["disk_free"] < 2 * 1024**3 or value["physical_available"] < 768 * 1024**2
                or value["commit_available"] < 1024**3):
            raise RuntimeError("RESOURCE_STOP")
        if clock() - started > MAX_SECONDS or total >= MAX_TOTAL:
            raise RuntimeError("COOPERATIVE_BUDGET_STOP")
        if output is not None and (output / "STOP").exists():
            raise RuntimeError("USER_STOP")

    def write_json(name):
        nonlocal total
        report["elapsed_seconds"] = round(clock() - started, 3)
        report["recorded_output_bytes_before_this_receipt"] = total
        raw = (json.dumps(report, indent=2) + "\n").encode("utf-8")
        if len(raw) > MAX_JSON:
            raise RuntimeError("REPORT_SIZE_LIMIT")
        # A small final receipt remains possible after an oversized native export.
        with (output / name).open("xb") as stream:
            stream.write(raw)
        total += len(raw)

    def checkpoint(stage):
        nonlocal checkpoint_number
        report["stage"] = stage
        write_json("checkpoint-%02d.json" % checkpoint_number)
        checkpoint_number += 1

    def export_object(obj, name, exporter, extension):
        nonlocal total
        check()
        destination = output / (name + "." + extension)
        if destination.exists():
            raise ValueError("OUTPUT_ALREADY_EXISTS")
        unit = {"status": "EXPORT_STARTED", "file": str(destination)}
        report[name] = unit
        checkpoint("EXPORT_" + name.upper())
        task = api.AssetExportTask()
        for key, value in {"object": obj, "exporter": exporter, "filename": str(destination),
                           "automated": True, "prompt": False, "replace_identical": False,
                           "selected": False, "use_file_archive": False, "write_empty_files": False}.items():
            task.set_editor_property(key, value)
        failure = None
        try:
            unit["export_return"] = bool(api.Exporter.run_asset_export_task(task))
        except Exception as exc:
            failure = exc
            unit["exception"] = type(exc).__name__ + ": " + str(exc)[:2000]
        try:
            unit["exporter_errors"] = [str(v)[:1000] for v in itertools.islice(task.get_editor_property("errors"), 20)]
        except Exception as exc:
            unit["error_read_failed"] = str(exc)[:1000]
            failure = failure or exc
        if not destination.is_file():
            raise RuntimeError("EXPORT_PRODUCED_NO_FILE")
        size = destination.stat().st_size
        unit["bytes"], total = size, total + size
        if not 0 < size <= MAX_FILE or total > MAX_TOTAL:
            unit["status"] = "OUTPUT_LIMIT_RETAINED_WITHOUT_READING"
            raise RuntimeError("NATIVE_OUTPUT_LIMIT")
        unit["sha256"] = digest_file(destination, MAX_FILE)
        if failure is not None or unit.get("export_return") is not True or unit.get("exporter_errors"):
            unit["status"] = "EXPORT_FAILED_EVIDENCE_RETAINED"
            raise RuntimeError("EXPORT_FAILURE_OR_ERRORS")
        unit["status"] = "EDITOR_TEXT_REQUIRES_REVIEW" if native else "MOCK_ONLY"
        return destination

    try:
        check()
        stamp = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        output = evidence / ("observer-caller-" + stamp + "-" + token[:12])
        output.mkdir(exist_ok=False)
        setattr(api, ACTIVE_KEY, token)
        report = {"status": "STARTED", "classification": "EDITOR_SOURCE_INSPECTION_ONLY" if native else "MOCK_ONLY",
                  "native_execution": "ATTEMPTED" if native else "NOT_PERFORMED",
                  "gameplay": "NOT_PERFORMED", "cook_install_publish": "NOT_PERFORMED",
                  "object_path": OBJECT_PATH, "source_path": str(source_path),
                  "source_sha256": expected_sha256.lower(), "output_directory": str(output),
                  "script_sha256": digest_file(__file__, MAX_SOURCE), "errors": [],
                  "source": {"status": "NOT_PERFORMED"}, "defaults": {"status": "NOT_PERFORMED"},
                  "limits": ["Exactly one named Blueprint; parent identity only, not parent export/load.",
                             "No recursive collection, registry scan, Find References index or API snapshot.",
                             "Native calls may implicitly load dependencies and regenerate editor cache/data.",
                             "No forced interruption or hard native allocation/output/time bounds.",
                             "Exports reflect memory; matching disk hashes do not exclude unsaved editor edits.",
                             "No save, explicit compile, Play, cook, install, live command or paid API."]}
        checkpoint("FIND_NAMED_ASSET")
        check()
        asset = api.find_asset(OBJECT_PATH, type=api.Blueprint, follow_redirectors=False)
        report["already_loaded"] = asset is not None
        if asset is None:
            check()
            source_guard()
            checkpoint("LOAD_NAMED_ASSET")
            asset = api.load_asset(OBJECT_PATH, type=api.Blueprint, follow_redirectors=False)
        if asset is None or not isinstance(asset, api.Blueprint) or asset.get_path_name() != OBJECT_PATH:
            raise ValueError("LOADED_ASSET_IDENTITY_OR_TYPE_MISMATCH")
        report["loaded_object_path"] = asset.get_path_name()
        check()
        exporter = api.ObjectExporterT3D()
        formats = [str(v) for v in itertools.islice(exporter.get_editor_property("format_extension"), 16)]
        extension = next((v for preferred in ("copy", "t3d") for v in formats
                          if v.casefold() == preferred), None)
        if not exporter.get_editor_property("text") or extension is None:
            raise RuntimeError("EXPECTED_TEXT_EXPORTER_UNAVAILABLE")
        source_text = export_object(asset, "source", exporter, extension)
        check()
        # Parent metadata comes from the named export; never load/export its parent.
        with source_text.open("rb") as stream:
            raw = stream.read(MAX_FILE + 1)
        if len(raw) > MAX_FILE or hashlib.sha256(raw).hexdigest() != report["source"]["sha256"]:
            raise ValueError("SOURCE_EXPORT_CHANGED_OR_OVERSIZED")
        text = raw.decode("utf-16" if raw.startswith((b"\xff\xfe", b"\xfe\xff")) else "utf-8-sig")
        parent_fields = list(itertools.islice(re.finditer(r"(?m)^[ \t]*ParentClass=([^\r\n]{1,2048})\r?$", text), 4))
        report["parent_metadata"] = {"status": "EXPORTED_TEXT_ONLY" if parent_fields else "UNKNOWN_NOT_EXPORTED",
                                     "fields": [v.group(1) for v in parent_fields]}
        source_guard()
        check()
        checkpoint("GET_NAMED_GENERATED_CLASS")
        generated = api.EditorAssetLibrary.load_blueprint_class(OBJECT_PATH)
        class_object = generated.static_class() if isinstance(generated, type) else generated
        if class_object is None or class_object.get_path_name() != CLASS_PATH:
            raise ValueError("GENERATED_CLASS_IDENTITY_MISMATCH")
        report["generated_class_path"] = class_object.get_path_name()
        check()
        default = api.get_default_object(generated)
        if (default is None or default.get_class().get_path_name() != CLASS_PATH
                or default.get_path_name() != DEFAULT_PATH):
            raise ValueError("DEFAULT_OBJECT_IDENTITY_MISMATCH")
        report["default_object_path"] = default.get_path_name()
        export_object(default, "defaults", exporter, extension)
        check()
        report["status"] = "COLLECTED_REQUIRES_REVIEW" if native else "MOCK_ONLY_COMPLETED"
    except Exception as exc:
        if report is None:
            raise
        report["status"] = "STOPPED_PARTIAL"
        report["errors"].append(type(exc).__name__ + ": " + str(exc)[:2000])
    finally:
        try:
            if report is not None:
                try:
                    source_guard()
                    report["source_unchanged_after"] = True
                except Exception as exc:
                    report["source_unchanged_after"] = False
                    report["status"] = "STOPPED_PARTIAL"
                    report["errors"].append(type(exc).__name__ + ": " + str(exc)[:2000])
                write_json("report.json")
        finally:
            if getattr(api, ACTIVE_KEY, None) == token:
                delattr(api, ACTIVE_KEY)
            if lock.is_file() and lock.stat().st_size == len(token) and lock.read_text(encoding="ascii") == token:
                lock.unlink()
    return report


if __name__ == "__main__":
    import unreal
    main(unreal, native=True)
