"""Read-only text export of three already-loaded, user-authored observer assets.

Run once using File > Execute Python Script in the MW5 editor. No load, save,
compile, Play, cook, registry scan or game command. Native export is synchronous;
time/resource/output guards cannot interrupt a native call. Exports represent
editor memory, not proof of saved-graph equivalence or runtime acceptance.
"""
import ctypes
from ctypes import wintypes
import datetime
import hashlib
import itertools
import json
from pathlib import Path
import shutil
import time
import uuid

ROOT = Path(__file__).resolve().parent.parent
EXPECTED_ROOT = Path(r"C:\Users\jlewi\OneDrive\Documents\ChatGPT\MW5 LANCEMATE COMPANION")
CONTENT = Path(r"C:\Program Files\Epic Games\MechWarrior5Editor\MW5Mercs\Plugins\LanceObserverProbe\Content")
ASSETS = (
    ("WBP_LanceObserverProbeReadout", "/Script/UMGEditor.WidgetBlueprint", "937538d7420b6b810cfaa1b4bfcc2fa5c2f7e50be2eb25ff8a771f0e00564282"),
    ("BP_LanceObserverProbeComponent", "/Script/Engine.Blueprint", "6a364cd8e9a35da959de67c0ab1ac0707a062100083f4503da74aef9ad57913a"),
    ("DA_LanceObserverProbeRegistration", "/Game/Objects/_common/Components/PlayerControllerComponents/PlayerControllerComponentDataAsset.PlayerControllerComponentDataAsset_C", "c5c09bbc3f6ee38e18e8ed330f405a6d7aba649a9ca8c4b9aad6581f82a28c35"),
)
MAX_FILE = 8 * 1024**2
MAX_TOTAL = 24 * 1024**2
ACTIVE_KEY = "_mw5_authored_observer_inspection"


def digest(path, limit=MAX_FILE):
    before = path.stat()
    if not 0 < before.st_size <= limit:
        raise ValueError("FILE_SIZE_LIMIT: " + str(path))
    value = hashlib.sha256()
    count = 0
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(65536), b""):
            count += len(chunk)
            if count > limit:
                raise ValueError("FILE_GREW_BEYOND_LIMIT")
            value.update(chunk)
    after = path.stat()
    if (before.st_size, before.st_mtime_ns) != (after.st_size, after.st_mtime_ns) or count != after.st_size:
        raise ValueError("FILE_CHANGED_DURING_READ")
    return value.hexdigest()


def health(root):
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


def run(api, root=ROOT, content=CONTENT, assets=ASSETS, health_query=health,
        clock=time.monotonic, native=False):
    root, content = Path(root).resolve(), Path(content).resolve()
    if native:
        if root != ROOT.resolve() or root != EXPECTED_ROOT.resolve() or content != CONTENT.resolve() or assets != ASSETS:
            raise ValueError("NATIVE_SCOPE_MISMATCH")
    elif getattr(api, "__name__", None) == "unreal":
        raise ValueError("REAL_API_FORBIDDEN_IN_MOCK_MODE")
    evidence = (root / "research/evidence/editor-source").resolve()
    evidence.relative_to(root)
    if not evidence.is_dir():
        raise ValueError("EVIDENCE_DIRECTORY_MISSING")
    if getattr(api, ACTIVE_KEY, None) is not None or any(evidence.glob(".observer-*.lock")):
        raise RuntimeError("OTHER_INSPECTION_LOCK_PRESENT")
    started = clock()
    total = 0
    output = None
    report = {"status": "STARTED", "classification": "EDITOR_EXPORT_REQUIRES_REVIEW" if native else "MOCK_ONLY",
              "gameplay": "NOT_PERFORMED", "cook_install": "NOT_PERFORMED", "assets": [], "errors": [],
              "limits": ["Already-loaded named objects only; no asset loading or recursive discovery.",
                         "Native export guards are cooperative, not hard interruption or output caps.",
                         "Disk hashes do not prove exported memory matches saved assets.",
                         "Missing CDO or omitted properties remain unknown, never defaulted to safe values."]}

    def guard_sources():
        for name, _, expected in assets:
            if digest(content / (name + ".uasset")) != expected:
                raise ValueError("SOURCE_HASH_MISMATCH: " + name)

    def check():
        value = health_query(evidence)
        report["last_health"] = value
        minimum = {"disk_free": 2 * 1024**3, "physical_available": 768 * 1024**2, "commit_available": 1024**3}
        failed = [key for key in minimum if value[key] < minimum[key]]
        if failed:
            raise RuntimeError("RESOURCE_STOP: " + ",".join(failed))
        if clock() - started > 90 or total > MAX_TOTAL:
            raise RuntimeError("COOPERATIVE_BUDGET_STOP")
        if output is not None and (output / "STOP").exists():
            raise RuntimeError("USER_STOP")
        guard_sources()

    def receipt(name):
        report["elapsed_seconds"] = round(clock() - started, 3)
        raw = (json.dumps(report, indent=2) + "\n").encode("utf-8")
        if len(raw) > 128 * 1024:
            raise RuntimeError("RECEIPT_SIZE_LIMIT")
        with (output / name).open("xb") as stream:
            stream.write(raw)

    def export(obj, label, record):
        nonlocal total
        check()
        destination = output / (label + "." + extension)
        if destination.exists():
            raise ValueError("OUTPUT_ALREADY_EXISTS")
        task = api.AssetExportTask()
        for key, value in {"object": obj, "exporter": exporter, "filename": str(destination),
                           "automated": True, "prompt": False, "replace_identical": False,
                           "selected": False, "use_file_archive": False, "write_empty_files": False}.items():
            task.set_editor_property(key, value)
        record["file"] = destination.name
        record["export_return"] = bool(api.Exporter.run_asset_export_task(task))
        record["exporter_errors"] = [str(v)[:1000] for v in itertools.islice(task.get_editor_property("errors"), 20)]
        record["bytes"] = destination.stat().st_size
        total += record["bytes"]
        if not 0 < record["bytes"] <= MAX_FILE or total > MAX_TOTAL:
            raise RuntimeError("NATIVE_OUTPUT_LIMIT_RETAINED")
        record["sha256"] = digest(destination)
        if not record["export_return"] or record["exporter_errors"]:
            raise RuntimeError("EXPORT_FAILURE_OR_ERRORS")
        check()

    token = uuid.uuid4().hex
    lock = evidence / ".observer-authored-inspection.lock"
    with lock.open("x", encoding="ascii") as stream:
        stream.write(token)
    setattr(api, ACTIVE_KEY, token)
    try:
        stamp = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        output = evidence / ("observer-authored-" + stamp + "-" + token[:8])
        output.mkdir(exist_ok=False)
        report["output_directory"] = str(output)
        report["script_sha256"] = digest(Path(__file__))
        receipt("started.json")
        check()
        exporter = api.ObjectExporterT3D()
        formats = [str(v) for v in itertools.islice(exporter.get_editor_property("format_extension"), 16)]
        extension = next((v for preferred in ("copy", "t3d") for v in formats if v.casefold() == preferred), None)
        if not exporter.get_editor_property("text") or extension is None:
            raise RuntimeError("TEXT_EXPORTER_UNAVAILABLE")
        for index, (name, expected_class, expected_hash) in enumerate(assets):
            check()
            object_path = "/LanceObserverProbe/" + name + "." + name
            record = {"object_path": object_path, "disk_sha256": expected_hash}
            report["assets"].append(record)
            asset = api.find_asset(object_path, follow_redirectors=False)
            if asset is None:
                raise RuntimeError("NOT_ALREADY_LOADED_OPEN_ASSET: " + name)
            if asset.get_path_name() != object_path or asset.get_class().get_path_name() != expected_class:
                raise ValueError("ASSET_IDENTITY_OR_TYPE_MISMATCH: " + name)
            record["class_path"] = expected_class
            record["source"] = {}
            export(asset, name, record["source"])
            if name.startswith(("BP_", "WBP_")):
                check()
                default_path = object_path.rsplit(".", 1)[0] + ".Default__" + name + "_C"
                default = api.find_object(None, default_path, follow_redirectors=False)
                record["defaults"] = {"status": "NOT_ALREADY_LOADED"}
                if default is not None:
                    if default.get_path_name() != default_path or default.get_class().get_path_name() != object_path + "_C":
                        raise ValueError("DEFAULT_IDENTITY_MISMATCH")
                    export(default, name + "-defaults", record["defaults"])
                    record["defaults"]["status"] = "EXPORTED_REQUIRES_REVIEW"
            receipt("asset-%02d.json" % index)
        check()
        report["status"] = "COLLECTED_REQUIRES_REVIEW" if native else "MOCK_ONLY_COMPLETED"
    except Exception as exc:
        report["status"] = "STOPPED_PARTIAL"
        report["errors"].append(type(exc).__name__ + ": " + str(exc)[:2000])
    finally:
        try:
            try:
                guard_sources()
                report["disk_sources_unchanged"] = True
            except Exception as exc:
                report["disk_sources_unchanged"] = False
                report["status"] = "STOPPED_PARTIAL"
                report["errors"].append(str(exc)[:2000])
            if output is not None:
                receipt("report.json")
        finally:
            if getattr(api, ACTIVE_KEY, None) == token:
                delattr(api, ACTIVE_KEY)
            if lock.exists() and lock.read_text(encoding="ascii") == token:
                lock.unlink()
    return report


if __name__ == "__main__":
    import unreal
    result = run(unreal, native=True)
    print("AUTHORED_OBSERVER_REVIEW: " + result["status"] + " | " + result.get("output_directory", ""))
