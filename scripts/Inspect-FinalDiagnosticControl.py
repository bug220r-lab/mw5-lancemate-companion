"""Dormant, read-only final source inspection for the two Phase A assets.

Requires a separately reviewed manifest with final saved file pins, editor PID
and an explicit exact-path loading decision, then its SHA256 below. No save,
compile, graph/property edit, UI, registry scan, Play, cook or retail operation.
Loading (only if enabled) can load dependencies; it is not a memory/disk identity
proof. Native calls are synchronous and cannot be interrupted by these guards.
"""
import datetime
import hashlib
import importlib.util
import itertools
import json
import os
from pathlib import Path
import re
import time
import uuid

ROOT = Path(__file__).resolve().parent.parent
EXPECTED_ROOT = Path(r"C:\Users\jlewi\OneDrive\Documents\ChatGPT\MW5 LANCEMATE COMPANION")
MANIFEST = ROOT / "research/OBSERVER_DIAGNOSTIC_CONTROL_FINAL_INSPECTION_MANIFEST.json"
# Final saved checkpoints and complete manifest reviewed on 2026-09-25.
# Never derive or accept a replacement pin at runtime.
REVIEWED_MANIFEST_SHA256 = "a4f18d3ca259b9bebbc6a5125bfacabfff8e0dbd238659a4445f6ece82f9dcb5"
HELPER = ROOT / "scripts/Inspect-DiagnosticControllerCopy.py"
HELPER_SHA256 = "daa431f3d271e1d0f01345a97d87f018211bcbdbdefdd0f6d9d4a3f15e092360"
EDITOR = Path(r"C:\Program Files\Epic Games\MechWarrior5Editor\MW5Mercs")
DIAGNOSTIC = EDITOR / "Plugins/LanceObserverDiagnosticControl"
TARGETS = (
    ("controller", DIAGNOSTIC / "ModOverride/Modes/InstantAction/InstantActionPlayerController.uasset",
     "/ModOverride/LanceObserverDiagnosticControl/Modes/InstantAction/InstantActionPlayerController.InstantActionPlayerController",
     "/Script/Engine.Blueprint"),
    ("widget", DIAGNOSTIC / "Content/WBP_ObserverDiagnosticControl.uasset",
     "/LanceObserverDiagnosticControl/WBP_ObserverDiagnosticControl.WBP_ObserverDiagnosticControl",
     "/Script/UMGEditor.WidgetBlueprint"),
)
EXTRA_PROTECTED = (
    (DIAGNOSTIC / "LanceObserverDiagnosticControl.uplugin", 389,
     "52b5bef1004246ac5377e81d9508579393be258f9c5477cf3626ee4c33cf1c79"),
    (DIAGNOSTIC / "Config/Input/LanceObserverDiagnosticControlInput.ini", 1498,
     "d1a5492fcb7e0ad41d8f4eb15e953fd0032e174510f3db89a74fec5901dbbd3f"),
)
ACTIVE_KEY = "_mw5_final_diagnostic_control_inspection"
OTHER_KEYS = ("_mw5_diagnostic_widget_copy_preparation", "_mw5_diagnostic_widget_text_update")
MAX_FILE, MAX_TOTAL, MAX_SECONDS = 8 * 1024**2, 32 * 1024**2, 90
MAX_INVENTORY = 2 * 1024**2
SHA256 = re.compile(r"[0-9a-f]{64}\Z")


def read_pinned(path, expected, limit=MAX_FILE):
    with path.open("rb") as stream:
        before = os.fstat(stream.fileno())
        if not 0 < before.st_size <= limit:
            raise ValueError("PINNED_FILE_SIZE_LIMIT")
        raw = stream.read(limit + 1)
        after = os.fstat(stream.fileno())
    current = path.stat()
    signature = lambda value: (value.st_dev, value.st_ino, value.st_size, value.st_mtime_ns)
    if len(raw) > limit:
        raise ValueError("PINNED_FILE_SIZE_LIMIT")
    if (signature(before) != signature(after) or signature(after) != signature(current)
            or len(raw) != before.st_size or hashlib.sha256(raw).hexdigest() != expected):
        raise ValueError("PINNED_FILE_CHANGED: " + str(path))
    return raw


def reviewed_inputs():
    """Local-only validation; incomplete manifest fails before any Unreal call."""
    if ROOT.resolve() != EXPECTED_ROOT.resolve():
        raise ValueError("PROJECT_SCOPE_MISMATCH")
    if not isinstance(REVIEWED_MANIFEST_SHA256, str) or not SHA256.fullmatch(REVIEWED_MANIFEST_SHA256):
        raise ValueError("DORMANT_REVIEWED_MANIFEST_PIN_REQUIRED")
    manifest = json.loads(read_pinned(MANIFEST, REVIEWED_MANIFEST_SHA256, 32768).decode("utf-8"))
    if manifest.get("schema_version") != 1 or manifest.get("status") != "REVIEWED_READY_FOR_SOURCE_INSPECTION":
        raise ValueError("MANIFEST_NOT_REVIEWED_READY")
    if type(manifest.get("editor_pid")) is not int or manifest["editor_pid"] != os.getpid():
        raise ValueError("EDITOR_PID_MISMATCH")
    if not isinstance(manifest.get("reviewed_at_utc"), str) or not manifest["reviewed_at_utc"]:
        raise ValueError("MANIFEST_REVIEW_TIMESTAMP_REQUIRED")
    if type(manifest.get("allow_exact_path_load")) is not bool:
        raise ValueError("EXPLICIT_LOAD_DECISION_REQUIRED")
    read_pinned(HELPER, HELPER_SHA256)
    spec = importlib.util.spec_from_file_location("_mw5_final_export_readonly_utilities", str(HELPER))
    helper = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(helper)  # Never invokes the historical run().
    protected = helper.PROTECTED + ((helper.ASSETS[0][1], helper.ASSETS[0][3], helper.ASSETS[0][4]),) + EXTRA_PROTECTED
    expected_protected = [{"file": str(path), "bytes": size, "sha256": pin} for path, size, pin in protected]
    if manifest.get("protected_files") != expected_protected:
        raise ValueError("PROTECTED_SCOPE_OR_PIN_MISMATCH")
    entries = manifest.get("targets")
    if not isinstance(entries, list) or len(entries) != len(TARGETS):
        raise ValueError("EXACT_TWO_TARGETS_REQUIRED")
    pins = list(protected)
    for entry, (label, path, object_path, class_path) in zip(entries, TARGETS):
        expected = {"label": label, "file": str(path), "object_path": object_path, "class_path": class_path}
        if not isinstance(entry, dict) or any(entry.get(key) != value for key, value in expected.items()):
            raise ValueError("TARGET_SCOPE_MISMATCH")
        if (type(entry.get("bytes")) is not int or not 0 < entry["bytes"] <= MAX_FILE
                or not isinstance(entry.get("sha256"), str) or not SHA256.fullmatch(entry["sha256"])):
            raise ValueError("FINAL_SAVED_TARGET_PIN_REQUIRED: " + label)
        pins.append((path, entry["bytes"], entry["sha256"]))
    return manifest, helper, tuple(pins)


def inventory(raw, expected_name, expected_class):
    """Index actual COPY/T3D text; preserve raw pin/field lines, infer no behavior.

    Class declarations and later bodies repeat object names in native exports.
    Merge by their complete nested name sequence, not by a bare node name.
    Registration lines stay raw: no assumption that every exported graph runs.
    """
    text = raw.decode("utf-16" if raw.startswith((b"\xff\xfe", b"\xfe\xff")) else "utf-8-sig")
    objects, references, stack, roots = {}, {}, [], 0
    registrations = []
    for line_number, line in enumerate(text.splitlines(), 1):
        if line_number > 50000 or len(line) > 65536:
            raise ValueError("INVENTORY_TEXT_LIMIT")
        stripped = line.strip()
        if stripped.startswith("Begin Object "):
            name = re.search(r'\bName="([A-Za-z_][A-Za-z0-9_]*)"', stripped)
            kind = re.search(r"\bClass=(/[^\s]+)", stripped)
            if not name or len(stack) >= 16:
                raise ValueError("UNREVIEWED_EXPORT_HEADER")
            if not stack:
                roots += 1
                if name.group(1) != expected_name or not kind or kind.group(1) != expected_class:
                    raise ValueError("EXPORT_ROOT_IDENTITY_MISMATCH")
            stack.append(name.group(1))
            key = tuple(stack)
            record = objects.setdefault(key, {"relative_path": ".".join(key[1:]), "class_path": None,
                                               "begin_lines": [], "fields": [], "pin_lines": []})
            record["begin_lines"].append(line_number)
            if kind:
                if record["class_path"] not in (None, kind.group(1)):
                    raise ValueError("EXPORT_CLASS_CONFLICT")
                record["class_path"] = kind.group(1)
            if len(objects) > 2048:
                raise ValueError("INVENTORY_OBJECT_LIMIT")
        elif stripped == "End Object":
            if not stack:
                raise ValueError("UNBALANCED_EXPORT")
            stack.pop()
        elif stripped:
            if not stack:
                raise ValueError("UNREVIEWED_TEXT_OUTSIDE_OBJECT")
            record = objects[tuple(stack)]
            # Retain all non-pin fields, including graph registration, input
            # flags, widget defaults, function references and graph Nodes lists.
            field = {"line": line_number, "text": stripped}
            record["pin_lines" if stripped.startswith("CustomProperties Pin ") else "fields"].append(field)
            if len(stack) == 1 and re.match(r"(?:UbergraphPages|FunctionGraphs|MacroGraphs|DelegateSignatureGraphs)\(", stripped):
                registrations.append(field)
        # Lexical candidates only: native text is not a complete dependency list.
        for path in re.findall(r"/[A-Za-z_][A-Za-z0-9_./:\-]*", line):
            references.setdefault(path, []).append(line_number)
            if len(references) > 4096:
                raise ValueError("INVENTORY_REFERENCE_LIMIT")
    if stack or roots != 1:
        raise ValueError("UNBALANCED_OR_MULTIPLE_ROOT_EXPORT")
    entries = list(objects.values())
    return {"classification": "LEXICAL_SOURCE_INVENTORY_REQUIRES_REVIEW", "root_name": expected_name,
            "root_class": expected_class, "line_count": line_number, "objects": entries,
            "registered_graph_fields": registrations,
            "graph_paths": [obj["relative_path"] for obj in entries if obj["class_path"] == "/Script/Engine.EdGraph"],
            "node_paths": [obj["relative_path"] for obj in entries if "/BlueprintGraph.K2Node_" in (obj["class_path"] or "")],
            "path_candidates": [{"text": path, "lines": sorted(set(lines))} for path, lines in sorted(references.items())],
            "limits": ["Only declarations emitted in this export are indexed; omitted objects remain unknown.",
                       "No reachability, execution, compilation, saved-memory equivalence or runtime test is performed.",
                       "Registration fields and auxiliary graphs remain distinct evidence for manual review.",
                       "Path candidates are lexical matches, not validated dependencies; relative references remain in fields/pins."]}


def run(api):
    manifest, helper, pins = reviewed_inputs()
    if getattr(api, "__name__", None) != "unreal":
        raise ValueError("EDITOR_API_REQUIRED")
    evidence = (ROOT / "research/evidence/editor-source").resolve()
    if not evidence.is_dir():
        raise ValueError("EVIDENCE_DIRECTORY_MISSING")
    keys = (ACTIVE_KEY, helper.ACTIVE_KEY) + helper.OTHER_ACTIVE_KEYS + OTHER_KEYS
    if any(getattr(api, key, None) is not None for key in keys):
        raise RuntimeError("OTHER_EDITOR_SCRIPT_ACTIVE")
    if any(evidence.glob(".observer-*.lock")) or any(evidence.glob(".diagnostic-*.lock")):
        raise RuntimeError("OTHER_EDITOR_SCRIPT_LOCK")
    script_sha256 = helper.digest(Path(__file__))
    token = uuid.uuid4().hex
    lock = evidence / ".diagnostic-final-source-inspection.lock"
    with lock.open("x", encoding="ascii") as stream:
        stream.write(token)
    setattr(api, ACTIVE_KEY, token)
    stamp = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    output = evidence / ("diagnostic-final-source-" + stamp + "-" + token[:8])
    started, total = time.monotonic(), 0
    report = {"status": "STARTED", "classification": "EDITOR_SOURCE_REQUIRES_REVIEW", "editor_pid": os.getpid(),
              "manifest_sha256": REVIEWED_MANIFEST_SHA256, "script_sha256": script_sha256,
              "helper_sha256": HELPER_SHA256, "assets": [], "errors": [],
              "asset_mutation_save_compile_ui_play_cook_retail": "NOT_PERFORMED",
              "allow_exact_path_load": manifest["allow_exact_path_load"],
              "memory_reserve_gate": "WAIVED_BY_USER_OBSERVE_ONLY",
              "limits": ["Four exports only: exact two Blueprints and their exact CDOs; no alias acceptance.",
                         "Optional exact loading may load implicit dependencies; missing CDO stops without fallback.",
                         "Native calls are synchronous; resource/time/output checks are cooperative.",
                         "Disk pins and memory exports do not establish saved-memory equivalence or shipping behavior."]}

    def guard_pins():
        read_pinned(MANIFEST, REVIEWED_MANIFEST_SHA256, 32768)
        read_pinned(HELPER, HELPER_SHA256)
        if helper.digest(Path(__file__)) != report["script_sha256"]:
            raise ValueError("INSPECTOR_CHANGED_DURING_RUN")
        result = []
        for path, size, expected in pins:
            actual = helper.digest(path)
            if path.stat().st_size != size or actual != expected:
                raise ValueError("PROTECTED_OR_FINAL_TARGET_FILE_CHANGED: " + str(path))
            result.append({"file": str(path), "bytes": size, "sha256": actual})
        return result

    def check():
        report["last_health"] = helper.health(evidence)
        if report["last_health"]["disk_free"] < 2 * 1024**3:
            raise RuntimeError("DISK_RESOURCE_STOP")
        if time.monotonic() - started > MAX_SECONDS or total > MAX_TOTAL:
            raise RuntimeError("COOPERATIVE_BUDGET_STOP")
        if (output / "STOP").exists():
            raise RuntimeError("USER_STOP")
        guard_pins()

    def write_json(filename, value, limit):
        data = (json.dumps(value, indent=2, ensure_ascii=True) + "\n").encode("utf-8")
        if len(data) > limit:
            raise ValueError("JSON_OUTPUT_LIMIT: " + filename)
        with (output / filename).open("xb") as stream:
            stream.write(data)

    def receipt(filename):
        report["elapsed_seconds"], report["exported_bytes"] = round(time.monotonic() - started, 3), total
        write_json(filename, report, 128 * 1024)

    def identity(obj, object_path, class_path, record):
        record.update(requested_path=object_path, expected_class=class_path, found=obj is not None)
        if obj is not None:
            record.update(observed_path=obj.get_path_name(), observed_class=obj.get_class().get_path_name())
        if obj is None or record["observed_path"] != object_path or record["observed_class"] != class_path:
            raise ValueError("EXACT_OBJECT_IDENTITY_MISMATCH: " + object_path)

    def export(obj, label, record, object_path, class_path):
        nonlocal total
        check()
        identity(obj, object_path, class_path, record)
        destination = output / (label + "." + extension)
        task = api.AssetExportTask()
        for key, value in {"object": obj, "exporter": exporter, "filename": str(destination), "automated": True,
                           "prompt": False, "replace_identical": False, "selected": False,
                           "use_file_archive": False, "write_empty_files": False}.items():
            task.set_editor_property(key, value)
        record.update(file=destination.name, status="EXPORT_STARTED")
        record["return"] = bool(api.Exporter.run_asset_export_task(task))
        record["errors"] = [str(error)[:1000] for error in itertools.islice(task.get_editor_property("errors"), 20)]
        if not destination.is_file():
            raise RuntimeError("EXPORT_NO_FILE")
        record["bytes"] = destination.stat().st_size
        total += record["bytes"]
        record["sha256"] = helper.digest(destination)
        if not record["return"] or record["errors"] or total > MAX_TOTAL:
            raise RuntimeError("EXPORT_FAILED_OR_OUTPUT_LIMIT")
        record["status"] = "EXPORTED_REQUIRES_REVIEW"
        check()
        data = read_pinned(destination, record["sha256"])
        index = inventory(data, object_path.rsplit(".", 1)[1], class_path)
        index["source_file"], index["source_sha256"] = destination.name, record["sha256"]
        name = label + "-inventory.json"
        write_json(name, index, MAX_INVENTORY)
        record["inventory"] = {"file": name, "sha256": helper.digest(output / name),
                               "classification": index["classification"]}

    try:
        output.mkdir(exist_ok=False)
        report["output_directory"] = str(output)
        receipt("started.json")
        check()
        report["disk_pins_before"] = guard_pins()
        objects = []
        for label, disk_path, object_path, class_path in TARGETS:
            check()
            record = {"label": label, "file": str(disk_path), "exact_load_attempted": False,
                      "source": {"status": "NOT_PERFORMED"}, "defaults": {"status": "NOT_PERFORMED"}}
            report["assets"].append(record)
            asset = api.find_asset(object_path, follow_redirectors=False)
            if asset is None and manifest["allow_exact_path_load"]:
                check()
                record["exact_load_attempted"] = True
                receipt("before-" + label + "-load.json")
                asset = api.load_asset(object_path, follow_redirectors=False)
            identity(asset, object_path, class_path, record["source"])
            check()
            default_path = object_path.rsplit(".", 1)[0] + ".Default__" + object_path.rsplit(".", 1)[1] + "_C"
            default = api.find_object(None, default_path, follow_redirectors=False)
            identity(default, default_path, object_path + "_C", record["defaults"])
            check()
            objects.append((label, asset, default, object_path, default_path, class_path, record))
        exporter = api.ObjectExporterT3D()
        formats = [str(value) for value in itertools.islice(exporter.get_editor_property("format_extension"), 16)]
        extension = next((value for preferred in ("copy", "t3d") for value in formats if value.casefold() == preferred), None)
        if not exporter.get_editor_property("text") or extension is None:
            raise RuntimeError("TEXT_EXPORTER_UNAVAILABLE")
        for label, asset, default, object_path, default_path, class_path, record in objects:
            export(asset, label + "-source", record["source"], object_path, class_path)
            export(default, label + "-defaults", record["defaults"], default_path, object_path + "_C")
            receipt(label + "-receipt.json")
        check()
        report["status"] = "COLLECTED_REQUIRES_SOURCE_REVIEW"
    except Exception as exc:
        report["status"] = "STOPPED_PARTIAL_REQUIRES_REVIEW"
        report["errors"].append(type(exc).__name__ + ": " + str(exc)[:2000])
    finally:
        try:
            try:
                report["disk_pins_after"] = guard_pins()
                report["all_12_disk_pins_unchanged"] = True
            except Exception as exc:
                report["all_12_disk_pins_unchanged"] = False
                report["status"] = "STOPPED_PROTECTED_INPUT_CHANGE"
                report["errors"].append(type(exc).__name__ + ": " + str(exc)[:2000])
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
    print("FINAL_DIAGNOSTIC_SOURCE: " + result["status"] + " | " + result.get("output_directory", ""))
