"""Three direct AssetRegistry referencer queries; no asset loads or exports.

Run in the existing, authorized MW5 editor via File > Execute Python Script.
Only project-local JSON evidence is written. No registry scan, recursive query,
save, compile, cook, Play, settings change or retail action. Native calls are
synchronous: Python limits cannot interrupt a call or cap its native allocation.
Importing this file does not import unreal or run the lookup. Python 3.7 compatible.
"""
import ctypes
from ctypes import wintypes
import datetime
import hashlib
import json
from pathlib import Path
import shutil
import time
import uuid

PROJECT = Path(__file__).resolve().parent.parent
EXPECTED_PROJECT = Path(r"C:\Users\jlewi\OneDrive\Documents\ChatGPT\MW5 LANCEMATE COMPANION")
CONTENT = Path(r"C:\Program Files\Epic Games\MechWarrior5Editor\MW5Mercs\Content")
TARGETS = (
    ("/Game/Objects/_common/MW5PlayerController", "fe6492fb35ef4759d3ef770cb802819dbc4da38f98fb88416ad8b10b16b5e6bc"),
    ("/Game/Modes/InstantAction/InstantActionPlayerController", "7107745a8de461275a7acfa1f3ffc5be9bcb7002682c37b7705af5f00783e4f6"),
    ("/Game/Objects/_common/Components/PlayerControllerComponents/PlayerControllerComponentDataAsset",
     "d5d06ee76fd4049e836563fedb4c65e79aa12862bc9dad7dba55fbd467985f5a"),
)
OPTIONS = dict(include_soft_package_references=True, include_hard_package_references=True,
               include_searchable_names=False, include_soft_management_references=False,
               include_hard_management_references=False)
ACTIVE_KEY = "_mw5_observer_reference_lookup"
MAX_PER_TARGET, MAX_TOTAL, MAX_NAME, MAX_ENCODED_NAME = 512, 1024, 512, 768
MAX_FILE, MAX_JSON, MAX_SECONDS = 2 * 1024**2, 1024**2, 60


def fingerprint(path):
    path = Path(path)
    before = path.stat()
    if not 0 < before.st_size <= MAX_FILE:
        raise ValueError("PIN_FILE_SIZE_LIMIT")
    digest, count = hashlib.sha256(), 0
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(65536), b""):
            count += len(chunk)
            if count > MAX_FILE:
                raise ValueError("PIN_FILE_GREW_BEYOND_LIMIT")
            digest.update(chunk)
    after = path.stat()
    if count != after.st_size or (before.st_size, before.st_mtime_ns) != (after.st_size, after.st_mtime_ns):
        raise ValueError("PIN_FILE_CHANGED_DURING_READ")
    return {"path": str(path), "bytes": count, "sha256": digest.hexdigest()}


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


def main(api, root=PROJECT, content=CONTENT, targets=TARGETS,
         health=system_health, clock=time.monotonic, native=False):
    """Native scope fixed; injectable paths/APIs exist only for offline fakes."""
    if not native and getattr(api, "__name__", None) == "unreal":
        raise ValueError("REAL_UNREAL_API_FORBIDDEN_IN_MOCK_MODE")
    root, content = Path(root).resolve(), Path(content).resolve()
    if native and (root != EXPECTED_PROJECT.resolve() or root != PROJECT.resolve()
                   or content != CONTENT.resolve() or targets != TARGETS):
        raise ValueError("NATIVE_SCOPE_MISMATCH")
    if len(targets) != 3 or tuple(t[0] for t in targets) != tuple(t[0] for t in TARGETS):
        raise ValueError("EXACT_THREE_PACKAGE_NAMES_REQUIRED")
    evidence = (root / "research/evidence/editor-source").resolve()
    evidence.relative_to(root)
    if not evidence.is_dir():
        raise ValueError("PROJECT_EVIDENCE_DIRECTORY_MISSING")

    def pins():
        result = []
        for package, expected in targets:
            path = (content / (package[len("/Game/"):] + ".uasset")).resolve()
            path.relative_to(content)
            value = fingerprint(path)
            if value["sha256"] != expected:
                raise ValueError("TARGET_HASH_MISMATCH: " + package)
            result.append(dict(value, package=package))
        return result

    before = pins()
    for key in (ACTIVE_KEY, "_mw5_observer_caller_inspection", "_mw5_ai_research_collection",
                "_mw5_source_research_collection"):
        active = getattr(api, key, None)
        if active is not None and not getattr(active, "done", False):
            raise RuntimeError("ANOTHER_RESEARCH_INSPECTION_ACTIVE")
    for other in (".observer-caller-inspection.lock",):
        if (evidence / other).exists():
            raise RuntimeError("OTHER_INSPECTION_LOCK_PRESENT")
    token = uuid.uuid4().hex
    lock = evidence / ".observer-reference-lookup.lock"
    with lock.open("x", encoding="ascii") as stream:
        stream.write(token)
    started, output, report, retained, number = clock(), None, None, 0, 0

    def check():
        value = health(evidence)
        if report is not None:
            report["last_health"] = value
        if (value["disk_free"] < 2 * 1024**3 or value["physical_available"] < 768 * 1024**2
                or value["commit_available"] < 1024**3):
            raise RuntimeError("RESOURCE_STOP")
        if clock() - started > MAX_SECONDS:
            raise RuntimeError("COOPERATIVE_TIME_STOP")
        if output is not None and (output / "STOP").exists():
            raise RuntimeError("USER_STOP")

    def write(name, value, limit):
        raw = (json.dumps(value, indent=2, ensure_ascii=False) + "\n").encode("utf-8")
        if len(raw) > limit:
            raise RuntimeError("JSON_SIZE_LIMIT")
        with (output / name).open("xb") as stream:
            stream.write(raw)

    def checkpoint(stage):
        nonlocal number
        write("checkpoint-%02d.json" % number,
              {"stage": stage, "elapsed_seconds": round(clock() - started, 3),
               "completed_query_count": len(report["queries"]),
               "native_execution": report["native_execution"]}, 4096)
        number += 1

    try:
        check()
        stamp = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        output = evidence / ("observer-references-" + stamp + "-" + token[:12])
        output.mkdir(exist_ok=False)
        setattr(api, ACTIVE_KEY, token)
        report = {"status": "STARTED", "classification": "EDITOR_METADATA_ONLY" if native else "MOCK_ONLY",
                  "native_execution": "ATTEMPTED" if native else "NOT_PERFORMED",
                  "gameplay": "NOT_PERFORMED", "asset_load_export_save_compile_cook": "NOT_PERFORMED",
                  "output_directory": str(output), "source_before": before,
                  "source_after": None, "script": fingerprint(__file__), "options": OPTIONS.copy(),
                  "queries": [], "errors": [], "total_retained_entries": 0,
                  "limits": {"queries": 3, "per_target": MAX_PER_TARGET, "total_entries": MAX_TOTAL,
                             "name_characters": MAX_NAME, "encoded_name_bytes": MAX_ENCODED_NAME,
                             "report_bytes": MAX_JSON,
                             "cooperative_seconds": MAX_SECONDS},
                  "interpretation": "On-disk package references only. No function-call, registry completeness, "
                                    "cooked visibility, runtime startup or gameplay proof."}
        write("started.json", report, 16384)
        checkpoint("GET_EXISTING_REGISTRY")
        registry = api.AssetRegistryHelpers.get_asset_registry()
        options = api.AssetRegistryDependencyOptions(**OPTIONS)
        check()
        report["registry_loading_before"] = bool(registry.is_loading_assets())
        if report["registry_loading_before"]:
            report["status"] = "STOPPED_REGISTRY_LOADING"
        else:
            for package, _expected in targets:
                check()
                checkpoint("QUERY " + package)
                unit = {"package": package, "status": "QUERY_STARTED", "referencers": []}
                report["queries"].append(unit)
                raw = registry.get_referencers(package, options)
                unit["registry_loading_after"] = bool(registry.is_loading_assets())
                if raw is None:
                    unit["status"] = "NULL_RETURN"
                    report["status"] = "PARTIAL_NULL_RETURN"
                    break
                count = len(raw)
                unit["returned_count"] = count
                allowance = min(MAX_PER_TARGET, MAX_TOTAL - retained)
                for index in range(min(count, allowance)):
                    name = str(raw[index])
                    if (not name.startswith("/") or len(name) > MAX_NAME or any(ord(c) < 32 for c in name)
                            or any(c in name for c in "\\.:") or any(not segment for segment in name.split("/")[1:])
                            or len(json.dumps(name, ensure_ascii=False).encode("utf-8")) > MAX_ENCODED_NAME):
                        raise ValueError("INVALID_OR_OVERSIZED_PACKAGE_NAME")
                    unit["referencers"].append(name)
                    retained += 1
                unit["retained_count"] = len(unit["referencers"])
                unit["status"] = "OBSERVED_PACKAGE_REFERENCES" if native else "MOCK_ONLY"
                check()
                if count > allowance:
                    unit["status"] = "TRUNCATED_AT_CAP"
                    report["status"] = "PARTIAL_CAP_REACHED"
                    break
                if unit["registry_loading_after"]:
                    report["status"] = "PARTIAL_REGISTRY_LOADING"
                    break
            else:
                report["status"] = "COLLECTED_REQUIRES_REVIEW" if native else "MOCK_ONLY_COMPLETED"
        check()
    except Exception as exc:
        if report is None:
            raise
        report["status"] = "ERROR_EVIDENCE_RETAINED"
        report["errors"].append(type(exc).__name__ + ": " + str(exc)[:1500])
    finally:
        try:
            if report is not None:
                try:
                    report["source_after"] = pins()
                    report["source_hashes_unchanged"] = report["source_after"] == before
                except Exception as exc:
                    report["source_hashes_unchanged"] = False
                    report["status"] = "ERROR_EVIDENCE_RETAINED"
                    report["errors"].append(type(exc).__name__ + ": " + str(exc)[:1500])
                report["total_retained_entries"] = retained
                report["elapsed_seconds"] = round(clock() - started, 3)
                write("report.json", report, MAX_JSON)
        finally:
            if getattr(api, ACTIVE_KEY, None) == token:
                delattr(api, ACTIVE_KEY)
            if lock.is_file():
                # A replaced lock belongs to someone else. Read a bounded binary
                # prefix; malformed/large contents must not mask the saved result.
                with lock.open("rb") as stream:
                    owned = stream.read(33) == token.encode("ascii")
                if owned:
                    lock.unlink()
    return report


if __name__ == "__main__":
    import unreal
    result = main(unreal, native=True)
    print("Observer reference lookup: " + result["status"] + " | " + result["output_directory"])
