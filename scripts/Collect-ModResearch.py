"""Run once in the existing MW5 editor via File > Execute Python Script.

Collects the exact reviewed research scope, one asset per Slate callback.
Loads named source assets for inspection; Unreal may load their dependencies
and perform normal editor regeneration. No save/compile/Play/game API is called.
Native loads/exports are synchronous and cannot be interrupted by our checks.
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
EDITOR = Path(r"C:\Program Files\Epic Games\MechWarrior5Editor")
STUB = Path(r"C:\Users\jlewi\AppData\Local\MW5Mercs\Intermediate\PythonStub\unreal.py")
SCOPE_FILE = "research/COLLECTOR_ASSET_SCOPE.json"
SCOPE_SHA256 = "034b18a7134dcfd6a2bdb1cc021c2ba5f431e1feba185d556c508dd3479d8aa3"
MAX_ASSETS = 18
MAX_FILE = 16 * 1024 * 1024
MAX_STUB = 64 * 1024 * 1024
MAX_TOTAL = 128 * 1024 * 1024
MAX_SECONDS = 600
ACTIVE_KEY = "_mw5_source_research_collection"


def sha(path):
    digest = hashlib.sha256()
    with Path(path).open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def read_scope(root):
    path = root / SCOPE_FILE
    if path.stat().st_size > 256 * 1024 or sha(path) != SCOPE_SHA256.lower():
        raise ValueError("Research asset scope differs from its reviewed fingerprint")
    data = json.loads(path.read_text(encoding="utf-8-sig"))
    assets = data["assets"]
    if not 1 <= len(assets) <= MAX_ASSETS:
        raise ValueError("Unexpected scope size")
    seen = set()
    for entry in assets:
        package = entry["package_path"]
        if not re.fullmatch(r"/Game/[A-Za-z0-9_/-]+", package) or ".." in package:
            raise ValueError("Invalid package path")
        if package in seen:
            raise ValueError("Duplicate source asset")
        seen.add(package)
        expected = (EDITOR / "MW5Mercs" / "Content" / (package[6:] + ".uasset")).resolve()
        if Path(entry["disk_path"]).resolve() != expected:
            raise ValueError("Package and installed file disagree")
        expected.relative_to((EDITOR / "MW5Mercs" / "Content").resolve())
        if entry["object_path"] != package + "." + package.rsplit("/", 1)[1]:
            raise ValueError("Unexpected object path")
        if entry["expected_asset_type"] not in ("Blueprint", "BehaviorTree", "BlackboardData"):
            raise ValueError("Unsupported research asset type")
        if not expected.is_file() or sha(expected).lower() != entry["sha256"].lower():
            raise ValueError("Installed source changed: " + package)
    return data


def system_health(root):
    # Read-only Windows memory accounting, not window/input automation.
    class MemoryStatus(ctypes.Structure):
        _fields_ = [("length", wintypes.DWORD), ("load", wintypes.DWORD)] + [
            (key, ctypes.c_ulonglong) for key in
            ("total_phys", "avail_phys", "total_page", "avail_page",
             "total_virtual", "avail_virtual", "avail_extended")]
    status = MemoryStatus()
    status.length = ctypes.sizeof(status)
    query = ctypes.WinDLL("kernel32", use_last_error=True).GlobalMemoryStatusEx
    query.argtypes = [ctypes.POINTER(MemoryStatus)]
    query.restype = wintypes.BOOL
    if not query(ctypes.byref(status)):
        raise OSError("Unable to read available memory")
    return {"disk_free": shutil.disk_usage(str(root)).free,
            "physical_available": status.avail_phys,
            "commit_available": status.avail_page}


def healthy(value):
    return (value["disk_free"] >= 2 * 1024 ** 3
            and value["physical_available"] >= 768 * 1024 ** 2
            and value["commit_available"] >= 1024 ** 3)


def text_details(raw):
    text = raw.decode("utf-16" if raw.startswith((b"\xff\xfe", b"\xfe\xff")) else "utf-8-sig")
    return {"node_guid_fields": len(re.findall(r"\bNodeGuid=", text)),
            "link_fields": len(re.findall(r"\bLinkedTo=", text)),
            "function_graph_fields": len(re.findall(r"\bFunctionGraphs\(", text)),
            "status": "TEXT_REQUIRES_SOURCE_REVIEW"}


class Collection:
    def __init__(self, api, root, scope, health=system_health, clock=time.monotonic):
        self.api, self.root, self.scope = api, Path(root).resolve(), scope
        self.health, self.clock = health, clock
        self.started = clock()
        self.index, self.total, self.handle = 0, 0, None
        self.busy, self.done = False, False
        evidence = (self.root / "research/evidence/editor-source").resolve()
        evidence.relative_to(self.root)
        if not evidence.is_dir():
            raise ValueError("Expected project evidence directory is missing")
        stamp = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        self.output = evidence / ("mod-research-collection-" + stamp + "-" + uuid.uuid4().hex[:8])
        self.output.mkdir(exist_ok=False)
        self.report = {
            "classification": "EDITOR_SOURCE_COLLECTION_ONLY", "status": "PREPARING",
            "started_utc": stamp, "output_directory": str(self.output),
            "script_sha256": sha(__file__), "scope_sha256": SCOPE_SHA256,
            "gameplay": "NOT_PERFORMED", "assets": [], "errors": [],
            "limits": ["18 exact source assets; dependency names only, no recursive loading by this script.",
                       "Unreal may implicitly load hard dependencies and regenerate assets/shaders.",
                       "600-second, disk, memory and byte checks are cooperative between native calls.",
                       "No hard native-call time, allocation or output-size bound.",
                       "Text exports omit some native implementations and may omit source/default details.",
                       "Exports reflect in-memory source; disk hashes do not rule out unsaved editor changes.",
                       "No save, explicit compile, Play, cook, game control, runtime bridge or paid API."],
        }
        self.checkpoint()

    def checkpoint(self):
        self.report.update(completed_assets=self.index, planned_assets=len(self.scope["assets"]),
                           recorded_output_bytes=self.total,
                           elapsed_seconds=round(self.clock() - self.started, 3))
        # Only this run's own progress file is replaced. Prior runs stay untouched.
        temporary = self.output / "progress.next.json"
        temporary.write_text(json.dumps(self.report, indent=2) + "\n", encoding="utf-8")
        temporary.replace(self.output / "progress.json")

    def check_resources(self):
        value = self.health(self.output)
        self.report["last_resource_check"] = value
        if not healthy(value):
            raise RuntimeError("RESOURCE_STOP: disk/RAM/commit threshold reached")
        if self.clock() - self.started > MAX_SECONDS or self.total >= MAX_TOTAL:
            raise RuntimeError("BUDGET_STOP: cooperative time/output threshold reached")
        if (self.output / "STOP").exists():
            raise RuntimeError("USER_STOP: STOP file observed")

    def start(self):
        try:
            self.check_resources()
            self.exporter = self.api.ObjectExporterT3D()
            formats = [str(v) for v in self.exporter.get_editor_property("format_extension")]
            self.extension = next((v for preferred in ("copy", "t3d") for v in formats
                                   if v.casefold() == preferred), None)
            if not self.exporter.get_editor_property("text") or not self.extension:
                raise RuntimeError("Expected text exporter unavailable")
            self.registry = self.api.AssetRegistryHelpers.get_asset_registry()
            self.options = self.api.AssetRegistryDependencyOptions(
                include_soft_package_references=True, include_hard_package_references=True,
                include_searchable_names=False, include_soft_management_references=False,
                include_hard_management_references=False)
            self.report.update(status="RUNNING", exporter_formats=formats,
                               registry_loading_at_start=bool(self.registry.is_loading_assets()))
            self.checkpoint()
            self.handle = self.api.register_slate_post_tick_callback(self.tick)
            self.api.log("MW5_RESEARCH_COLLECTION_STARTED: " + str(self.output))
        except Exception as exc:
            self.report["errors"].append(type(exc).__name__ + ": " + str(exc)[:2000])
            self.finish("STOPPED_PARTIAL", snapshot=False)
        return self.output

    def capture(self, entry):
        record = {"package": entry["package_path"], "object_path": entry["object_path"],
                  "source_sha256": entry["sha256"], "status": "STARTED"}
        self.report["assets"].append(record)
        self.checkpoint()  # Preserve which native operation was about to begin.
        dependencies = self.registry.get_dependencies(entry["package_path"], self.options)
        record["dependencies"] = None if dependencies is None else [str(v) for v in itertools.islice(dependencies, 512)]
        record["dependencies_truncated"] = dependencies is not None and len(dependencies) > 512
        record["dependency_meaning"] = "On-disk references, not executed call edges"
        record["registry_loading"] = bool(self.registry.is_loading_assets())
        metadata = self.registry.get_asset_by_object_path(entry["object_path"], include_only_on_disk_assets=True)
        record["registry_asset_class"] = str(metadata.asset_class)
        name = entry["package_path"].rsplit("/", 1)[1]
        destination = self.output / ("%02d-" % self.index + name + "." + self.extension)
        reuse = entry.get("reuse_export")
        if reuse:
            prior = (self.root / reuse["path"]).resolve()
            prior.relative_to(self.root)
            if prior.stat().st_size > MAX_FILE or sha(prior).lower() != reuse["sha256"].lower():
                raise ValueError("Previously reviewed export changed")
            self.check_resources()
            with destination.open("xb") as handle:
                handle.write(prior.read_bytes())
            record["collection_method"] = "REUSED_VERIFIED_EXPORT"
            record["reused_from"] = str(prior)
        else:
            expected_type = getattr(self.api, entry["expected_asset_type"])
            asset = self.api.find_asset(entry["object_path"], type=expected_type, follow_redirectors=False)
            record["already_loaded"] = asset is not None
            if asset is None:
                self.check_resources()
                record["status"] = "LOADING_NAMED_SOURCE"
                self.checkpoint()
                asset = self.api.load_asset(entry["object_path"], type=expected_type, follow_redirectors=False)
            if asset is None:
                record["status"] = "SOURCE_UNAVAILABLE"
                return
            if asset.get_path_name() != entry["object_path"]:
                raise ValueError("Loaded asset identity mismatch")
            self.check_resources()
            record["status"] = "EXPORTING_SOURCE"
            self.checkpoint()
            task = self.api.AssetExportTask()
            for key, value in {"object": asset, "exporter": self.exporter,
                               "filename": str(destination), "automated": True,
                               "prompt": False, "replace_identical": False, "selected": False,
                               "use_file_archive": False, "write_empty_files": False}.items():
                task.set_editor_property(key, value)
            record["native_export_return"] = bool(self.api.Exporter.run_asset_export_task(task))
            record["exporter_errors"] = [str(v)[:2000] for v in task.get_editor_property("errors")][:20]
            record["collection_method"] = "NATIVE_SOURCE_EXPORT"
        record["file"] = str(destination)
        if not destination.is_file():
            raise RuntimeError("Native exporter produced no file")
        size = destination.stat().st_size
        self.total += size
        record["bytes"] = size
        if size > MAX_FILE or self.total > MAX_TOTAL:
            raise RuntimeError("OUTPUT_LIMIT: native output retained without further reading")
        record["sha256"] = sha(destination)
        record["text"] = text_details(destination.read_bytes())
        if not size or record.get("native_export_return") is False or record.get("exporter_errors"):
            raise RuntimeError("Export returned failure/errors or empty output; evidence retained")
        record["status"] = "COLLECTED_REQUIRES_REVIEW"
        record["source_unchanged_after"] = sha(entry["disk_path"]).lower() == entry["sha256"].lower()
        if not record["source_unchanged_after"]:
            raise RuntimeError("Installed source changed during inspection")

    def snapshot_stub(self):
        self.check_resources()
        before = STUB.stat()
        if before.st_size > MAX_STUB or self.total + before.st_size > MAX_TOTAL:
            self.report["api_snapshot"] = {"status": "SKIPPED_OUTPUT_LIMIT"}
            return
        source_hash = sha(STUB)
        target = self.output / "unreal-api-reference.txt"
        with STUB.open("rb") as source, target.open("xb") as destination:
            copied = 0
            while True:
                chunk = source.read(1024 * 1024)
                if not chunk:
                    break
                copied += len(chunk)
                if copied > MAX_STUB or self.total + copied > MAX_TOTAL:
                    raise RuntimeError("API reference grew beyond collection limit")
                destination.write(chunk)
        self.total += copied
        after = STUB.stat()
        stable = before.st_size == after.st_size and before.st_mtime_ns == after.st_mtime_ns
        stable = stable and sha(target) == source_hash and sha(STUB) == source_hash
        self.report["api_snapshot"] = {"source": str(STUB), "file": str(target),
                                       "bytes": copied, "sha256": sha(target),
                                       "status": "DECLARATIONS_ONLY" if stable else "SOURCE_CHANGED_REQUIRES_REVIEW"}

    def tick(self, unused_delta):
        if self.busy or self.done:
            return
        self.busy = True
        try:
            self.check_resources()
            if self.index == len(self.scope["assets"]):
                self.finish("COLLECTION_FINISHED_REQUIRES_REVIEW")
                return
            entry = self.scope["assets"][self.index]
            self.capture(entry)
            self.index += 1
            self.checkpoint()
            self.api.log("MW5_RESEARCH_COLLECTED: %d/%d %s" % (
                self.index, len(self.scope["assets"]), entry["package_path"]))
        except Exception as exc:
            self.report["errors"].append(type(exc).__name__ + ": " + str(exc)[:2000])
            self.finish("STOPPED_PARTIAL", snapshot=False)
        finally:
            self.busy = False

    def finish(self, status, snapshot=True):
        if self.done:
            return
        self.done = True
        if self.handle is not None:
            try:
                self.api.unregister_slate_post_tick_callback(self.handle)
            except Exception as exc:
                self.report["errors"].append("Callback cleanup: " + str(exc)[:1000])
            self.handle = None
        if snapshot:
            try:
                self.snapshot_stub()
            except Exception as exc:
                self.report["errors"].append("API snapshot: " + str(exc)[:1000])
                status = "STOPPED_PARTIAL"
        self.report["status"] = status
        self.checkpoint()
        with (self.output / "report.json").open("x", encoding="utf-8") as handle:
            json.dump(self.report, handle, indent=2)
            handle.write("\n")
        self.api.log("MW5_RESEARCH_COLLECTION_FINISHED: " + str(self.output / "report.json"))


def launch(api, root=PROJECT):
    current = getattr(api, ACTIVE_KEY, None)
    if current is not None and not current.done:
        api.log("MW5_RESEARCH_ALREADY_RUNNING: " + str(current.output))
        return current
    root = Path(root).resolve()
    scope = read_scope(root)
    session = Collection(api, root, scope)
    setattr(api, ACTIVE_KEY, session)
    session.start()
    return session


if __name__ == "__main__":
    import unreal
    launch(unreal)
