"""Read-only export of exact, already-loaded Phase A controller objects.

Execute only through the authorized editor Python-script entry point after UI
identity review. No loading, saving, compiling, registry scan, Play or cook.
Exports reflect editor memory, not proven disk equivalence or runtime behavior.
Native calls are synchronous; time/output guards cannot interrupt native work.
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
EDITOR = Path(r"C:\Program Files\Epic Games\MechWarrior5Editor\MW5Mercs")
NAME = "InstantActionPlayerController"
# label, exact disk path, exact observed object path, bytes, SHA256
ASSETS = (
    ("stock", EDITOR / "Content/Modes/InstantAction/InstantActionPlayerController.uasset",
     "/Game/Modes/InstantAction/InstantActionPlayerController.InstantActionPlayerController",
     53635, "7107745a8de461275a7acfa1f3ffc5be9bcb7002682c37b7705af5f00783e4f6"),
    ("mod-copy", EDITOR / "Plugins/LanceObserverDiagnosticControl/ModOverride/Modes/InstantAction/InstantActionPlayerController.uasset",
     "/ModOverride/LanceObserverDiagnosticControl/Modes/InstantAction/InstantActionPlayerController.InstantActionPlayerController",
     50172, "c9bdddac76f53b163752e778e8dfeaf354201d636ea4d627368229dadcef376f"),
)
PROBE = EDITOR / "Plugins/LanceObserverProbe"
# ActiveMod.txt is deliberately excluded: it is selection state, not content.
PROTECTED = tuple((PROBE / relative, size, pin) for relative, size, pin in (
    ("LanceObserverProbe.uplugin", 422, "fdee15a050ec0df0a0b54af070c0680e248190d21e10e6ade1efaaddec010a08"),
    ("Config/Input/LanceObserverProbeInput.ini", 1383, "fc21b00d6db183e8434466e27f0f4fc194f7e852f66ce68bc15c9323271aa17d"),
    ("Config/Tags/LanceObserverProbeTags.ini", 43, "ad7f8b6d4415fb7edb4d52e83942a67c66313da7ea504e6196679db31b147e1b"),
    ("Content/BP_LanceObserverProbeComponent.uasset", 139586, "6a364cd8e9a35da959de67c0ab1ac0707a062100083f4503da74aef9ad57913a"),
    ("Content/WBP_LanceObserverProbeReadout.uasset", 31659, "937538d7420b6b810cfaa1b4bfcc2fa5c2f7e50be2eb25ff8a771f0e00564282"),
    ("Content/DA_LanceObserverProbeRegistration.uasset", 2111, "c5c09bbc3f6ee38e18e8ed330f405a6d7aba649a9ca8c4b9aad6581f82a28c35"),
    ("Resources/Icon128.png", 12352, "ec157f56f486e5a68fd4b27df6c88fecdb1b8f9bfff18aa5ef10a21bca6a4c5e"),
))
ACTIVE_KEY = "_mw5_diagnostic_controller_copy_inspection"
OTHER_ACTIVE_KEYS = ("_mw5_authored_observer_inspection", "_mw5_observer_caller_inspection",
                     "_mw5_observer_mode_inspection", "_mw5_observer_base_mode_inspection",
                     "_mw5_ai_research_collection", "_mw5_source_research_collection")
MAX_FILE, MAX_TOTAL, MAX_SECONDS = 8 * 1024**2, 32 * 1024**2, 90
BASELINE_DIR = "research/evidence/editor-source/observer-caller-20260921T044217Z-54302cc3f1af/"
HISTORICAL = (
    ("receipt", BASELINE_DIR + "report.json", 2995, "f3a8d60c904c6375f6e413f439d854957a951d583b4cd5ddaab49ba0c35b5543"),
    ("source", BASELINE_DIR + "source.COPY", 83932, "6690e8c5a192d28cc15f84798c6e053fe3f543728f7aecee0f2ce81968c6a0fd"),
    ("defaults", BASELINE_DIR + "defaults.COPY", 9087, "fa10c21c165e2ab68a2d7c841c413909fc3ff04b58097d1a15b710c2cbedf7c0"),
)


def digest(path, limit=MAX_FILE):
    path = Path(path)
    before = path.stat()
    if not 0 < before.st_size <= limit:
        raise ValueError("FILE_SIZE_LIMIT: " + str(path))
    value, count = hashlib.sha256(), 0
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


def run(api, root=ROOT, assets=ASSETS, protected=PROTECTED, health_query=health,
        clock=time.monotonic, native=False, mode="paired", historical=HISTORICAL):
    root = Path(root).resolve()
    if mode not in ("paired", "copy-only"):
        raise ValueError("UNSUPPORTED_FIXED_INSPECTION_MODE")
    if native:
        if (root != ROOT.resolve() or root != EXPECTED_ROOT.resolve()
                or assets != ASSETS or protected != PROTECTED or historical != HISTORICAL):
            raise ValueError("NATIVE_SCOPE_MISMATCH")
    elif getattr(api, "__name__", None) == "unreal":
        raise ValueError("REAL_API_FORBIDDEN_IN_MOCK_MODE")
    evidence = (root / "research/evidence/editor-source").resolve()
    evidence.relative_to(root)
    if not evidence.is_dir():
        raise ValueError("EVIDENCE_DIRECTORY_MISSING")
    for key in (ACTIVE_KEY,) + OTHER_ACTIVE_KEYS:
        active = getattr(api, key, None)
        if active is not None and not getattr(active, "done", False):
            raise RuntimeError("OTHER_INSPECTION_ACTIVE")
    if any(evidence.glob(".observer-*.lock")) or any(evidence.glob(".diagnostic-*.lock")):
        raise RuntimeError("OTHER_INSPECTION_LOCK_PRESENT")
    started, total, output = clock(), 0, None
    # Selection changes only the exact in-memory queries; all nine disk inputs
    # remain pinned in both modes. Copy-only never queries or accepts stock aliases.
    targets = assets if mode == "paired" else (assets[1],)
    pins = tuple((Path(path), size, pin) for _, path, _, size, pin in assets) + tuple(protected)
    report = {"status": "STARTED", "classification": "EDITOR_EXPORT_REQUIRES_REVIEW" if native else "MOCK_ONLY",
              "inspection_mode": mode,
              "gameplay": "NOT_PERFORMED", "cook_install": "NOT_PERFORMED", "assets": [], "errors": [],
              "memory_reserve_gate": "WAIVED_BY_USER_OBSERVE_ONLY",
              "limits": ["Paired mode requires both exact Blueprints/CDOs; copy-only queries only the exact mod copy and its CDO.",
                         "No asset load, save, compile, recursive discovery or registry query.",
                         "Native guards are cooperative, not hard interruption or output caps.",
                         "Disk hashes do not prove exported memory matches saved assets.",
                         "A missing CDO or omitted property remains unknown; no default assumptions.",
                         "Original ActiveMod.txt is selection state and is excluded from content pins."]}

    def guard_historical():
        results = []
        for label, relative, size, expected in historical:
            path = (root / relative).resolve()
            path.relative_to(root)
            actual = digest(path)
            if path.stat().st_size != size or actual != expected:
                raise ValueError("HISTORICAL_BASELINE_HASH_OR_SIZE_MISMATCH: " + label)
            results.append({"label": label, "file": relative, "bytes": size, "sha256": actual})
        return results

    def guard_sources():
        results = []
        for path, size, expected in pins:
            actual = digest(path)
            matches = path.stat().st_size == size and actual == expected
            results.append({"path": str(path), "bytes": path.stat().st_size,
                            "sha256": actual, "matches": matches})
            if not matches:
                raise ValueError("SOURCE_HASH_OR_SIZE_MISMATCH: " + str(path))
        return results

    def check():
        value = health_query(evidence)
        report["last_health"] = value
        if value["disk_free"] < 2 * 1024**3:
            raise RuntimeError("DISK_RESOURCE_STOP")
        if clock() - started > MAX_SECONDS or total > MAX_TOTAL:
            raise RuntimeError("COOPERATIVE_BUDGET_STOP")
        if output is not None and (output / "STOP").exists():
            raise RuntimeError("USER_STOP")
        guard_sources()
        if mode == "copy-only":
            guard_historical()

    def receipt(name):
        report["elapsed_seconds"] = round(clock() - started, 3)
        report["exported_bytes"] = total
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
        record["file"], record["status"] = destination.name, "EXPORT_STARTED"
        try:
            record["export_return"] = bool(api.Exporter.run_asset_export_task(task))
        except Exception as exc:
            record["exception"] = type(exc).__name__ + ": " + str(exc)[:2000]
            record["status"] = "EXPORT_EXCEPTION"
            raise
        record["exporter_errors"] = [str(v)[:1000] for v in itertools.islice(task.get_editor_property("errors"), 20)]
        if not destination.is_file():
            raise RuntimeError("EXPORT_PRODUCED_NO_FILE")
        record["bytes"] = destination.stat().st_size
        total += record["bytes"]
        if not 0 < record["bytes"] <= MAX_FILE or total > MAX_TOTAL:
            raise RuntimeError("NATIVE_OUTPUT_LIMIT_RETAINED")
        record["sha256"] = digest(destination)
        if not record["export_return"] or record["exporter_errors"]:
            raise RuntimeError("EXPORT_FAILURE_OR_ERRORS")
        record["status"] = "EXPORTED_REQUIRES_REVIEW" if native else "MOCK_ONLY_EXPORTED"
        check()

    token = uuid.uuid4().hex
    lock = evidence / ".diagnostic-controller-copy-inspection.lock"
    with lock.open("x", encoding="ascii") as stream:
        stream.write(token)
    setattr(api, ACTIVE_KEY, token)
    try:
        stamp = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        output = evidence / ("diagnostic-controller-copy-" + stamp + "-" + token[:8])
        output.mkdir(exist_ok=False)
        report["output_directory"] = str(output)
        report["script_sha256"] = digest(Path(__file__))
        receipt("started.json")
        check()
        report["source_checks_before"] = guard_sources()
        if mode == "copy-only":
            stock_object = assets[0][2]
            report["historical_stock_comparison"] = {
                "classification": "HISTORICAL_COMPARISON_BASELINE",
                "observed_run_utc": "2026-09-21T04:42:17Z",
                "stock_object_path": stock_object,
                "stock_class_path": stock_object + "_C",
                "stock_default_path": stock_object.rsplit(".", 1)[0] + ".Default__" + NAME + "_C",
                "stock_disk_sha256": assets[0][4],
                "files_before": guard_historical(),
                "limitation": "Prior editor export only; no live stock identity, current-memory health, or saved-copy equivalence is established."}
        objects, identity_errors = [], []

        def inspect_identity(lookup, requested_path, expected_class, kind, label, record):
            """Record returned identity even when it differs; never accept aliases."""
            check()
            record["requested_object_path"] = requested_path
            record["expected_class_path"] = expected_class
            try:
                obj = lookup()
                record["found"] = obj is not None
                if obj is None:
                    record["status"] = "NOT_ALREADY_LOADED"
                    identity_errors.append("NOT_ALREADY_LOADED_%s: %s" % (kind, label))
                    return None
                record["observed_object_path"] = obj.get_path_name()
                record["observed_class_path"] = obj.get_class().get_path_name()
                matches = (record["observed_object_path"] == requested_path
                           and record["observed_class_path"] == expected_class)
                record["identity_matches"] = matches
                record["status"] = "IDENTITY_MATCHED_NOT_EXPORTED" if matches else "IDENTITY_MISMATCH"
                if not matches:
                    identity_errors.append("%s_IDENTITY_OR_TYPE_MISMATCH: %s" % (kind, label))
                return obj
            except Exception as exc:
                record["status"] = "IDENTITY_LOOKUP_FAILED"
                record["identity_exception"] = type(exc).__name__ + ": " + str(exc)[:2000]
                identity_errors.append("%s_IDENTITY_LOOKUP_FAILED: %s" % (kind, label))
                return None
            finally:
                # A source/resource/stop failure must halt; it is not an identity
                # mismatch that permits continuing the remaining fixed lookups.
                check()

        for label, disk_path, object_path, size, pin in targets:
            check()
            record = {"label": label, "object_path": object_path, "disk_path": str(disk_path),
                      "disk_bytes": size, "disk_sha256": pin, "source": {"status": "NOT_PERFORMED"},
                      "defaults": {"status": "NOT_PERFORMED"}}
            report["assets"].append(record)
            asset = inspect_identity(
                lambda: api.find_asset(object_path, follow_redirectors=False),
                object_path, "/Script/Engine.Blueprint", "BLUEPRINT", label, record["source"])
            default_path = object_path.rsplit(".", 1)[0] + ".Default__" + NAME + "_C"
            record["defaults"]["object_path"] = default_path
            default = inspect_identity(
                lambda: api.find_object(None, default_path, follow_redirectors=False),
                default_path, object_path + "_C", "CDO", label, record["defaults"])
            objects.append((label, asset, default, record))
        check()
        report["identity_inventory_complete"] = True
        if identity_errors:
            report["errors"].extend(identity_errors)
            raise RuntimeError("OBJECT_IDENTITY_INVENTORY_FAILED_NO_EXPORT")
        exporter = api.ObjectExporterT3D()
        formats = [str(v) for v in itertools.islice(exporter.get_editor_property("format_extension"), 16)]
        extension = next((v for preferred in ("copy", "t3d") for v in formats if v.casefold() == preferred), None)
        if not exporter.get_editor_property("text") or extension is None:
            raise RuntimeError("TEXT_EXPORTER_UNAVAILABLE")
        for index, (label, asset, default, record) in enumerate(objects):
            export(asset, label + "-source", record["source"])
            export(default, label + "-defaults", record["defaults"])
            receipt("asset-%02d.json" % index)
        check()
        report["status"] = "COLLECTED_REQUIRES_REVIEW" if native else "MOCK_ONLY_COMPLETED"
    except Exception as exc:
        report["status"] = "STOPPED_PARTIAL"
        report["errors"].append(type(exc).__name__ + ": " + str(exc)[:2000])
    finally:
        try:
            try:
                report["source_checks_after"] = guard_sources()
                report["disk_sources_unchanged"] = True
            except Exception as exc:
                report["disk_sources_unchanged"] = False
                report["status"] = "STOPPED_PARTIAL"
                report["errors"].append(str(exc)[:2000])
            if mode == "copy-only":
                try:
                    report["historical_files_after"] = guard_historical()
                    report["historical_baseline_unchanged"] = True
                except Exception as exc:
                    report["historical_baseline_unchanged"] = False
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
    print("DIAGNOSTIC_CONTROLLER_COPY_REVIEW: " + result["status"] + " | " + result.get("output_directory", ""))
