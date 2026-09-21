"""Execute once with File > Execute Python Script in the existing MW5 editor.

Read-only source investigation: exact manifest, text exports, Blueprint defaults,
dependency names and generated API declarations. No Play/save/compile/game calls.
Unreal can implicitly load dependencies and regenerate editor data. Native calls
are synchronous; resource limits are cooperative, not hard allocation/time caps.
Rerunning reuses hash-verified completed text from this collector's recent runs.
"""
import collections
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
SCOPE_FILE = "research/AI_RESEARCH_SCOPE.json"
SCOPE_SHA256 = "df691070fad853ec2de37b67de65ae246138ae07489290b20f01abe02835d0d3"
PREFIX = "ai-research-collection-"
ACTIVE_KEY = "_mw5_ai_research_collection"
MAX_ASSETS, MAX_SECONDS = 300, 900
MAX_FILE, MAX_STUB, MAX_TOTAL = 32 * 1024**2, 64 * 1024**2, 512 * 1024**2
MAX_SOURCE = 16 * 1024**2
ALLOWED_CLASSES = frozenset((
    "Blueprint", "WidgetBlueprint", "BehaviorTree", "BlackboardData", "EnvQuery",
    "CurveFloat", "CurveVector", "CurveLinearColor", "CurveTable", "DataTable",
    "UserDefinedEnum", "UserDefinedStruct", "MWAIBehaviourConfigAsset",
    "DataAsset", "PrimaryDataAsset"))
BLUEPRINT_CLASSES = frozenset(("Blueprint", "WidgetBlueprint"))
TEXT_OK = "TEXT_COLLECTED_REQUIRES_REVIEW"


class CollectionStop(RuntimeError):
    """Stop the whole batch while retaining completed evidence."""


def sha(path):
    result = hashlib.sha256()
    with Path(path).open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            result.update(chunk)
    return result.hexdigest()


def inside(path, parent):
    path = Path(path).resolve()
    path.relative_to(Path(parent).resolve())
    return path


def read_scope(root):
    path = inside(Path(root) / SCOPE_FILE, root)
    if path.stat().st_size > 2 * 1024**2 or sha(path) != SCOPE_SHA256:
        raise ValueError("AI scope differs from its reviewed fingerprint")
    scope = json.loads(path.read_text(encoding="utf-8-sig"))
    assets, seen = scope["assets"], set()
    if not 1 <= len(assets) <= MAX_ASSETS:
        raise ValueError("Unexpected scope size")
    content = (EDITOR / "MW5Mercs/Content").resolve()
    for entry in assets:
        package = entry["package_path"]
        if not re.fullmatch(r"/Game/[A-Za-z0-9_/-]+", package) or ".." in package or package in seen:
            raise ValueError("Invalid or duplicate package")
        seen.add(package)
        expected = inside(content / (package[6:] + ".uasset"), content)
        if Path(entry["disk_path"]).resolve() != expected:
            raise ValueError("Source file does not match package")
        if entry["object_path"] != package + "." + package.rsplit("/", 1)[1]:
            raise ValueError("Unexpected object path")
        if entry["expected_asset_type"] not in ALLOWED_CLASSES | {"REGISTRY_CLASS_REVIEW"}:
            raise ValueError("Unexpected reviewed class")
        if expected.stat().st_size != entry["bytes"] or sha(expected) != entry["sha256"].lower():
            raise ValueError("Installed source changed: " + package)
        reuse = entry.get("reuse_export")
        if reuse:
            prior = inside(Path(root) / reuse["path"], root)
            if prior.stat().st_size != reuse["bytes"] or sha(prior) != reuse["sha256"].lower():
                raise ValueError("Pinned prior export changed: " + package)
    return scope


def system_health(root):
    class MemoryStatus(ctypes.Structure):
        _fields_ = [("length", wintypes.DWORD), ("load", wintypes.DWORD)] + [
            (key, ctypes.c_ulonglong) for key in
            ("total_phys", "avail_phys", "total_page", "avail_page",
             "total_virtual", "avail_virtual", "avail_extended")]
    status = MemoryStatus()
    status.length = ctypes.sizeof(status)
    query = ctypes.WinDLL("kernel32", use_last_error=True).GlobalMemoryStatusEx
    query.argtypes, query.restype = [ctypes.POINTER(MemoryStatus)], wintypes.BOOL
    if not query(ctypes.byref(status)):
        raise OSError("Unable to read available memory")
    return {"disk_free": shutil.disk_usage(str(root)).free,
            "physical_available": status.avail_phys, "commit_available": status.avail_page}


def text_details(raw):
    value = raw.decode("utf-16" if raw.startswith((b"\xff\xfe", b"\xfe\xff")) else "utf-8-sig")
    return {"node_guid_fields": len(re.findall(r"\bNodeGuid=", value)),
            "link_fields": len(re.findall(r"\bLinkedTo=", value)),
            "function_graph_fields": len(re.findall(r"\bFunctionGraphs\(", value)),
            "native_packages": sorted(set(re.findall(r"/Script/[A-Za-z0-9_]+", value))),
            "meaning": "Text markers only; absence is not proof of missing logic"}


class Collection:
    def __init__(self, api, root, scope, health=system_health, clock=time.monotonic):
        self.api, self.root, self.scope = api, Path(root).resolve(), scope
        self.health, self.clock, self.started = health, clock, clock()
        self.index, self.total, self.handle = 0, 0, None
        self.busy, self.done = False, False
        self.evidence = inside(self.root / "research/evidence/editor-source", self.root)
        if not self.evidence.is_dir():
            raise ValueError("Expected project evidence directory is missing")
        stamp = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        self.output = self.evidence / (PREFIX + stamp + "-" + uuid.uuid4().hex[:8])
        self.output.mkdir(exist_ok=False)
        self.report = {
            "classification": "AI_EDITOR_SOURCE_COLLECTION_ONLY", "status": "PREPARING",
            "started_utc": stamp, "output_directory": str(self.output),
            "script_sha256": sha(__file__), "scope_sha256": SCOPE_SHA256,
            "gameplay": "NOT_PERFORMED", "assets": [], "errors": [],
            "limits": [
                "Exact reviewed assets only. Dependency names are recorded, never automatically followed.",
                "Unreal may implicitly load dependencies and regenerate assets/shaders.",
                "900 seconds, 512 MiB total, 32 MiB per export; cooperative checks between native calls.",
                "Stops below 2 GiB disk, 768 MiB physical memory or 1 GiB commit headroom.",
                "No hard native-call time, allocation or output-size bound. Oversized output is retained.",
                "Text/default exports do not contain every native algorithm, inherited value or runtime state.",
                "In-memory source may contain unsaved changes; disk hashes do not rule these out.",
                "Reused source reflects its earlier capture, not necessarily current unsaved editor contents.",
                "Directory/name categories do not prove allegiance or active tree assignment.",
                "No save, explicit compile, Play, cook, game control, runtime bridge or paid API."],
            "omitted_categories": scope.get("omitted_categories", [])}
        self.prior = self.read_prior()
        self.checkpoint()

    def read_prior(self):
        result = {}
        # Direct children only: nested MOCK_ONLY validation runs are not native evidence.
        directories = sorted(self.evidence.glob(PREFIX + "*"), reverse=True)
        for directory in directories[:8]:
            try:
                directory = inside(directory, self.evidence)
                if directory == self.output or directory.parent != self.evidence:
                    continue
                receipt = directory / "report.json"
                if not receipt.is_file():
                    receipt = directory / "progress.json"
                if not receipt.is_file() or receipt.stat().st_size > 8 * 1024**2:
                    continue
                data = json.loads(receipt.read_text(encoding="utf-8-sig"))
                if (data.get("classification") != "AI_EDITOR_SOURCE_COLLECTION_ONLY"
                        or data.get("script_sha256") != self.report["script_sha256"]
                        or data.get("scope_sha256") != SCOPE_SHA256):
                    continue
                for record in data.get("assets", []):
                    if record.get("source_unchanged_after") is not True:
                        continue
                    for component in ("source", "defaults"):
                        unit = record.get(component, {})
                        if unit.get("status") != TEXT_OK:
                            continue
                        key = (record.get("object_path"), record.get("source_sha256", "").lower(), component)
                        if key not in result:
                            result[key] = (unit, directory, str(receipt))
            except (OSError, ValueError, TypeError, KeyError):
                continue
        return result

    def checkpoint(self):
        self.report.update(processed_assets=self.index, planned_assets=len(self.scope["assets"]),
                           recorded_output_bytes=self.total,
                           elapsed_seconds=round(self.clock() - self.started, 3))
        temporary = self.output / "progress.next.json"
        payload = json.dumps(self.report, indent=2) + "\n"
        for attempt in range(4):
            try:
                temporary.write_text(payload, encoding="utf-8")
                temporary.replace(self.output / "progress.json")
                return
            except PermissionError:
                if attempt == 3:
                    raise CollectionStop("CHECKPOINT_LOCKED: unable to replace this run's progress file")
                time.sleep(0.05)  # Brief bounded tolerance for OneDrive/indexer file locks.

    def check_resources(self):
        value = self.health(self.output)
        self.report["last_resource_check"] = value
        if (value["disk_free"] < 2 * 1024**3 or value["physical_available"] < 768 * 1024**2
                or value["commit_available"] < 1024**3):
            raise CollectionStop("RESOURCE_STOP: disk/RAM/commit threshold reached")
        if self.clock() - self.started > MAX_SECONDS or self.total >= MAX_TOTAL:
            raise CollectionStop("BUDGET_STOP: cooperative time/output threshold reached")
        if (self.output / "STOP").exists():
            raise CollectionStop("USER_STOP: STOP file observed")

    def source_guard(self, entry, record=None):
        if sha(entry["disk_path"]) != entry["sha256"].lower():
            if record is not None:
                record.update(source_unchanged_after=False, status="SOURCE_CHANGED_DURING_CAPTURE")
            raise CollectionStop("SOURCE_CHANGED: " + entry["package_path"])

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
            if self.registry.is_loading_assets():
                raise CollectionStop("REGISTRY_LOADING: wait for editor discovery, then rerun")
            self.report.update(status="RUNNING", exporter_formats=formats)
            self.checkpoint()
            self.handle = self.api.register_slate_post_tick_callback(self.tick)
            self.api.log("MW5_AI_RESEARCH_STARTED: " + str(self.output))
        except Exception as exc:
            self.report["errors"].append(type(exc).__name__ + ": " + str(exc)[:2000])
            self.finish("STOPPED_PARTIAL", snapshot=False)
        return self.output

    def destination(self, entry, component):
        name = entry["package_path"].rsplit("/", 1)[1]
        return self.output / ("%03d-%s-%s.%s" % (self.index, name, component, self.extension))

    def inspect_output(self, destination, unit):
        if not destination.is_file():
            raise RuntimeError("Exporter produced no file")
        size = destination.stat().st_size
        self.total += size
        unit.update(file=str(destination), bytes=size)
        if size > MAX_FILE or self.total > MAX_TOTAL:
            raise CollectionStop("OUTPUT_LIMIT: output retained without further reading")
        unit.update(sha256=sha(destination), text=text_details(destination.read_bytes()))
        if not size or unit.get("native_export_return") is False or unit.get("exporter_errors"):
            raise RuntimeError("Export failure/errors/empty output; evidence retained")
        unit["status"] = TEXT_OK

    def reuse_component(self, entry, component, unit):
        key = (entry["object_path"], entry["sha256"].lower(), component)
        candidate = self.prior.get(key)
        origin = None
        if candidate:
            saved, boundary, origin = candidate
        elif component == "source" and entry.get("reuse_export"):
            saved = dict(entry["reuse_export"])
            saved["file"] = str(self.root / saved["path"])
            boundary, origin = self.root, saved.get("report_path")
        else:
            return False
        try:
            prior = inside(saved["file"], boundary)
            size = prior.stat().st_size
            if size != saved["bytes"] or not 0 < size <= MAX_FILE or sha(prior) != saved["sha256"].lower():
                raise ValueError("Prior text fingerprint/size mismatch")
        except (OSError, ValueError, KeyError, TypeError) as exc:
            unit["reuse_rejected"] = str(exc)[:1000]
            return False
        self.check_resources()
        if self.total + size > MAX_TOTAL:
            raise CollectionStop("BUDGET_STOP: reused text would exceed output budget")
        destination = self.destination(entry, component)
        with prior.open("rb") as source, destination.open("xb") as output:
            shutil.copyfileobj(source, output, 1024 * 1024)
        unit.update(method="REUSED_VERIFIED_TEXT", reused_from=str(prior), origin_receipt=origin)
        self.inspect_output(destination, unit)
        if unit["sha256"] != saved["sha256"].lower():
            unit["status"] = "REUSE_CHANGED_DURING_COPY"
            raise CollectionStop("Prior text changed while copying")
        return True

    def export_object(self, asset, entry, component, record):
        self.check_resources()
        unit = record[component]
        unit.update(status="EXPORTING", method="NATIVE_TEXT_EXPORT")
        destination = self.destination(entry, component)
        unit["file"] = str(destination)
        self.checkpoint()
        task = self.api.AssetExportTask()
        for key, value in {"object": asset, "exporter": self.exporter, "filename": str(destination),
                           "automated": True, "prompt": False, "replace_identical": False,
                           "selected": False, "use_file_archive": False, "write_empty_files": False}.items():
            task.set_editor_property(key, value)
        try:
            unit["native_export_return"] = bool(self.api.Exporter.run_asset_export_task(task))
            unit["exporter_errors"] = [str(v)[:2000] for v in task.get_editor_property("errors")][:20]
        except Exception:
            # Preserve and account for partial native output, but never reuse it as success.
            if destination.is_file():
                size = destination.stat().st_size
                unit["bytes"] = size
                self.total += size
                if size > MAX_FILE or self.total > MAX_TOTAL:
                    raise CollectionStop("OUTPUT_LIMIT after exporter exception")
            raise
        self.inspect_output(destination, unit)

    def capture(self, entry):
        record = {"package": entry["package_path"], "object_path": entry["object_path"],
                  "source_sha256": entry["sha256"], "category": entry.get("category"),
                  "status": "STARTED", "source": {"status": "PENDING"},
                  "defaults": {"status": "NOT_APPLICABLE"}}
        self.report["assets"].append(record)
        self.checkpoint()
        self.source_guard(entry, record)
        if self.registry.is_loading_assets():
            raise CollectionStop("REGISTRY_LOADING: partial evidence retained; rerun after discovery")
        dependencies = self.registry.get_dependencies(entry["package_path"], self.options)
        record["dependencies"] = None if dependencies is None else [str(v) for v in itertools.islice(dependencies, 2048)]
        record["dependencies_truncated"] = dependencies is not None and len(dependencies) > 2048
        record["dependency_meaning"] = "On-disk references, not executed call edges or active assignments"
        metadata = self.registry.get_asset_by_object_path(entry["object_path"], include_only_on_disk_assets=True)
        if not metadata.is_valid() or metadata.is_redirector():
            record["status"] = "INVALID_OR_REDIRECTED_METADATA"
            return
        if str(metadata.object_path) != entry["object_path"]:
            raise ValueError("Registry identity mismatch")
        asset_class = str(metadata.asset_class)
        record["registry_asset_class"] = asset_class
        if entry.get("collection_action") == "METADATA_ONLY" or entry["bytes"] > MAX_SOURCE:
            record.update(status="METADATA_ONLY_DEFERRED", source={"status": "DEFERRED_SOURCE_SIZE_OR_SCOPE"})
            return
        if asset_class not in ALLOWED_CLASSES:
            record.update(status="METADATA_ONLY_UNSUPPORTED_CLASS", source={"status": "UNSUPPORTED_CLASS"})
            return
        expected = entry["expected_asset_type"]
        if expected != "REGISTRY_CLASS_REVIEW" and asset_class != expected:
            raise ValueError("Registry class changed from reviewed evidence")
        native_type = getattr(self.api, asset_class, None)
        if native_type is None:
            record.update(status="METADATA_ONLY_UNAVAILABLE_PYTHON_CLASS", source={"status": "PYTHON_CLASS_UNAVAILABLE"})
            return
        source = record["source"]
        try:
            if not self.reuse_component(entry, "source", source):
                self.check_resources()
                asset = self.api.find_asset(entry["object_path"], type=native_type, follow_redirectors=False)
                source["already_loaded"] = asset is not None
                if asset is None:
                    self.check_resources()
                    source["status"] = "LOADING_NAMED_SOURCE"
                    self.checkpoint()
                    asset = self.api.load_asset(entry["object_path"], type=native_type, follow_redirectors=False)
                if asset is None:
                    raise RuntimeError("Named source unavailable")
                if asset.get_path_name() != entry["object_path"] or not isinstance(asset, native_type):
                    raise ValueError("Loaded asset identity/type mismatch")
                self.export_object(asset, entry, "source", record)
        except CollectionStop:
            raise
        except Exception as exc:
            source.update(status="SOURCE_EXPORT_FAILED", error=type(exc).__name__ + ": " + str(exc)[:2000])
        self.source_guard(entry, record)
        record["source_unchanged_after"] = True
        self.checkpoint()
        if asset_class in BLUEPRINT_CLASSES and source["status"] == TEXT_OK:
            record["source_unchanged_after"] = False  # Revalidate after the new native work.
            defaults = record["defaults"] = {"status": "PENDING"}
            try:
                if not self.reuse_component(entry, "defaults", defaults):
                    self.check_resources()
                    defaults["status"] = "LOADING_GENERATED_CLASS"
                    self.checkpoint()
                    generated = self.api.EditorAssetLibrary.load_blueprint_class(entry["object_path"])
                    expected_class_path = entry["object_path"] + "_C"
                    class_object = generated.static_class() if isinstance(generated, type) else generated
                    if class_object is None or class_object.get_path_name() != expected_class_path:
                        raise ValueError("Generated class identity unavailable/mismatched")
                    self.check_resources()
                    default = self.api.get_default_object(generated)
                    if default is None or default.get_class().get_path_name() != expected_class_path:
                        raise ValueError("Default object class identity mismatch")
                    defaults.update(generated_class=expected_class_path, object_path=default.get_path_name())
                    self.export_object(default, entry, "defaults", record)
                    defaults["meaning"] = "Editor class default object text; not live actor state or exhaustive inherited defaults"
            except CollectionStop:
                raise
            except Exception as exc:
                defaults.update(status="DEFAULTS_EXPORT_FAILED", error=type(exc).__name__ + ": " + str(exc)[:2000])
        self.source_guard(entry, record)
        record["source_unchanged_after"] = True
        record["status"] = "SOURCE_COLLECTED_REQUIRES_REVIEW" if source["status"] == TEXT_OK else "SOURCE_INCOMPLETE"
        if record["defaults"]["status"] == "DEFAULTS_EXPORT_FAILED":
            record["status"] = "SOURCE_COLLECTED_DEFAULTS_INCOMPLETE"

    def snapshot_stub(self):
        self.check_resources()
        before = STUB.stat()
        if before.st_size > MAX_STUB or self.total + before.st_size > MAX_TOTAL:
            self.report["api_snapshot"] = {"status": "SKIPPED_OUTPUT_LIMIT"}
            return
        fingerprint = sha(STUB)
        target = self.output / "unreal-api-reference.txt"
        self.report["api_snapshot"] = {"status": "COPYING_DECLARATIONS", "file": str(target)}
        self.checkpoint()
        with STUB.open("rb") as source, target.open("xb") as destination:
            copied = 0
            for chunk in iter(lambda: source.read(1024 * 1024), b""):
                copied += len(chunk)
                if copied > MAX_STUB or self.total + copied > MAX_TOTAL:
                    raise CollectionStop("API reference grew beyond budget")
                destination.write(chunk)
        self.total += copied
        after = STUB.stat()
        stable = before.st_size == after.st_size and before.st_mtime_ns == after.st_mtime_ns
        stable = stable and sha(target) == fingerprint and sha(STUB) == fingerprint
        self.report["api_snapshot"] = {"source": str(STUB), "file": str(target), "bytes": copied,
                                       "sha256": sha(target), "status": "DECLARATIONS_ONLY" if stable else "SOURCE_CHANGED"}

    def coverage(self):
        planned = {e["package_path"] for e in self.scope["assets"]}
        sources = {r["package"] for r in self.report["assets"]
                   if r.get("source_unchanged_after") is True and r.get("source", {}).get("status") == TEXT_OK}
        dependencies = collections.defaultdict(set)
        for record in self.report["assets"]:
            for package in record.get("dependencies") or []:
                if package not in sources:
                    dependencies[package].add(record["package"])
        result = {
            "meaning": "Coverage of the reviewed allowlist, not all MW5 AI or runtime decisions",
            "planned": len(planned), "processed": self.index, "source_text_collected": len(sources),
            "defaults_text_collected": sum(r.get("source_unchanged_after") is True
                and r.get("defaults", {}).get("status") == TEXT_OK for r in self.report["assets"]),
            "status_counts": dict(collections.Counter(r["status"] for r in self.report["assets"])),
            "uncollected_planned_packages": sorted(planned - sources),
            "unresolved_dependency_frontier": [{"package": p, "in_reviewed_scope": p in planned,
                "referenced_by": sorted(refs), "status": "REFERENCE_ONLY_NOT_AUTOMATICALLY_LOADED"}
                for p, refs in sorted(dependencies.items())],
            "dependency_queries_incomplete": [r["package"] for r in self.report["assets"]
                if r.get("dependencies") is None or r.get("dependencies_truncated")],
            "runtime_tree_assignment": "NOT_PERFORMED", "native_implementation_bodies": "NOT_COLLECTED",
            "live_tactical_decisions": "NOT_PERFORMED"}
        path = self.output / "coverage.json"
        with path.open("x", encoding="utf-8") as handle:
            json.dump(result, handle, indent=2)
            handle.write("\n")
        self.report["coverage"] = {"file": str(path), "sha256": sha(path),
                                   "source_text_collected": len(sources), "planned": len(planned)}

    def tick(self, unused_delta):
        if self.busy or self.done:
            return
        self.busy = True
        try:
            self.check_resources()
            if self.index == len(self.scope["assets"]):
                self.finish("SCOPE_PROCESSED_REVIEW_COVERAGE")
                return
            entry = self.scope["assets"][self.index]
            try:
                self.capture(entry)
            except CollectionStop:
                raise
            except Exception as exc:
                self.report["assets"][-1].update(status="ASSET_INSPECTION_FAILED",
                    error=type(exc).__name__ + ": " + str(exc)[:2000])
            self.index += 1
            self.checkpoint()
            self.api.log("MW5_AI_RESEARCH_PROGRESS: %d/%d %s" % (
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
        self.coverage()
        try:
            self.checkpoint()
        except Exception as exc:
            self.report["errors"].append("Final checkpoint: " + str(exc)[:1000])
            self.report["status"] = "STOPPED_PARTIAL"
        with (self.output / "report.json").open("x", encoding="utf-8") as handle:
            json.dump(self.report, handle, indent=2)
            handle.write("\n")
        self.api.log("MW5_AI_RESEARCH_FINISHED: " + str(self.output / "report.json"))


def launch(api, root=PROJECT):
    for key in (ACTIVE_KEY, "_mw5_source_research_collection"):
        current = getattr(api, key, None)
        if current is not None and not current.done:
            api.log("MW5_RESEARCH_ALREADY_RUNNING: " + str(current.output))
            return current
    root = Path(root).resolve()
    session = Collection(api, root, read_scope(root))
    setattr(api, ACTIVE_KEY, session)
    session.start()
    return session


if __name__ == "__main__":
    import unreal
    launch(unreal)
