"""Independent single-mode helper review; no Unreal or installed-asset access.

Runs the prepared helper with a deliberately narrow fake API and synthetic files.
Fixtures are retained under this project's research/evidence/editor-source.
Results are MOCK_ONLY and cannot establish native editor/runtime behavior.
"""
import ast
import datetime
import hashlib
import importlib.util
import json
from pathlib import Path
import sys
from types import SimpleNamespace
import uuid

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parent.parent
HELPER = ROOT / "scripts/Inspect-ObserverMode.py"
RECEIPT = ROOT / "research/OBSERVER_MODE_HELPER_REVIEW.json"
MARKDOWN = ROOT / "research/OBSERVER_MODE_HELPER_REVIEW.md"
PIN = ROOT / "research/OBSERVER_MODE_ASSET.json"
READY_SHA = "ad0eeb1e1fa73e55cee24f679c27ca3c5aa52c0abffc48f4f8d0e88b0f44ed29"
PIN_SHA = "78f1cad778dcfbfbc1276bbe1a202b37bd8078fa96e13a63baf3280ecb68d737"
MINIMUMS = {"disk_free": 2 * 1024**3, "physical_available": 768 * 1024**2,
            "commit_available": 1024**3}
HISTORICAL = {
    "scripts/Inspect-ObserverCaller.py": "b99b1b05375be98af1160c9c2ccb3474af80eb97aa673ea492130d83386d0fa0",
    "scripts/Review-ObserverCaller.py": "0953515fca50def0de0411821a4c87cd0ea432f7c57133c6720d1bfe7ea0b83d",
    "research/PASSIVE_OBSERVER_HELPER_REVIEW.json": "1e99d29d0d47568e54c1d36501e4940d9fcd08312d88b0576d62db7bf22e277b",
    "scripts/Inspect-ObserverReferences.py": "adc2da144e2648c8fcbe7df42667a76bf7bd258ace455d0105b27a3fea717a63",
    "research/OBSERVER_REFERENCE_HELPER_REVIEW.json": "c9ee8adb3a4ef14de7c0dec200b34a16ee0a7e15bec9e5fd0103f93f7033ad20",
}
HEALTH = {"disk_free": 8 * 1024**3, "physical_available": 4 * 1024**3,
          "commit_available": 4 * 1024**3}


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def require(condition, message):
    if not condition:
        raise AssertionError(message)


def load_helper():
    require("unreal" not in sys.modules, "Review process must not contain real Unreal")
    spec = importlib.util.spec_from_file_location("observer_mode_under_review", str(HELPER))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    require("unreal" not in sys.modules, "Importing the helper imported Unreal")
    return module


class FakeBlueprint:
    def __init__(self, path):
        self.path = path

    def get_path_name(self):
        return self.path


class FakeClass:
    def __init__(self, path):
        self.path = path

    def get_path_name(self):
        return self.path


class FakeDefault:
    def __init__(self, path, class_path):
        self.path, self.class_path = path, class_path

    def get_path_name(self):
        return self.path

    def get_class(self):
        return FakeClass(self.class_path)


class FakeTask:
    def __init__(self):
        self.values, self.errors = {}, []

    def set_editor_property(self, key, value):
        self.values[key] = value

    def get_editor_property(self, key):
        require(key == "errors", "Unexpected export-task read")
        return self.errors


class FakeAPI:
    Blueprint = FakeBlueprint
    AssetExportTask = FakeTask

    def __init__(self, helper, scenario, source):
        self.helper, self.scenario, self.source = helper, scenario, source
        self.calls, self.export_count = [], 0
        self.Exporter = SimpleNamespace(run_asset_export_task=self.export)
        self.EditorAssetLibrary = SimpleNamespace(load_blueprint_class=self.generated)

    def exact(self, path, options):
        require(path == self.helper.OBJECT_PATH, "Unexpected asset target")
        require(options == {"type": FakeBlueprint, "follow_redirectors": False},
                "Missing typed load or redirects enabled")

    def find_asset(self, path, **options):
        self.exact(path, options)
        self.calls.append("find_asset")
        if self.scenario in ("named_load", "wrong_loaded_type", "missing_loaded_asset"):
            return None
        if self.scenario == "mutation_before_load":
            self.source.write_bytes(b"synthetic mutation before load")
            return None
        if self.scenario == "wrong_found_type":
            return FakeClass(path)
        if self.scenario == "wrong_found_path":
            return FakeBlueprint("/Game/SyntheticOther.SyntheticOther")
        return FakeBlueprint(path)

    def load_asset(self, path, **options):
        self.exact(path, options)
        self.calls.append("load_asset")
        if self.scenario == "wrong_loaded_type":
            return FakeClass(path)
        if self.scenario == "missing_loaded_asset":
            return None
        return FakeBlueprint(path)

    def ObjectExporterT3D(self):
        self.calls.append("ObjectExporterT3D")
        def prop(key):
            if key == "format_extension":
                return ["T3D", "COPY"]  # Actual observed native receipt values.
            if key == "text":
                return self.scenario != "nontext_exporter"
            raise AssertionError("Unexpected exporter property")
        return SimpleNamespace(get_editor_property=prop)

    def export(self, task):
        self.export_count += 1
        self.calls.append("export_" + str(self.export_count))
        expected_flags = {"automated": True, "prompt": False, "replace_identical": False,
                          "selected": False, "use_file_archive": False, "write_empty_files": False}
        for key, expected in expected_flags.items():
            require(task.values.get(key) is expected, "Unsafe export setting: " + key)
        destination = Path(task.values["filename"])
        require(destination.suffix == ".COPY", "Did not preserve observed preferred extension")
        destination.resolve().relative_to(self.source.parent.resolve())
        require(not destination.exists(), "Exporter was asked to overwrite output")
        target = task.values["object"]
        if self.export_count == 1:
            require(isinstance(target, FakeBlueprint), "First export is not the named Blueprint")
            payload = ("Begin Object Class=/Script/Engine.Blueprint Name=\"SyntheticOnly\"\r\n"
                       "   ParentClass=Class'\"/Script/MechWarrior.MWPlayerController\"'\r\n"
                       "End Object\r\n").encode("utf-8")
        else:
            require(isinstance(target, FakeDefault), "Second export is not the checked default")
            payload = b"Begin Object Name=\"SyntheticDefaultOnly\"\r\nEnd Object\r\n"
        if self.scenario == "export_no_file":
            return True
        if self.scenario == "export_empty":
            payload = b""
        if self.scenario == "export_oversized":
            payload = b"x" * (self.helper.MAX_FILE + 1)
        destination.write_bytes(payload)
        if self.scenario == "export_errors":
            task.errors = ["Synthetic exporter error"]
        if self.scenario == "export_exception":
            raise RuntimeError("Synthetic exporter exception after output")
        if self.scenario == "mutation_after_source" and self.export_count == 1:
            self.source.write_bytes(b"synthetic mutation during first export")
        if self.scenario == "mutation_after_defaults" and self.export_count == 2:
            self.source.write_bytes(b"synthetic mutation during second export")
        return self.scenario != "export_false"

    def generated(self, path):
        require(path == self.helper.OBJECT_PATH, "Generated-class lookup escaped named target")
        self.calls.append("generated_class")
        return FakeClass("/Game/Wrong.Wrong_C" if self.scenario == "wrong_generated_class"
                         else self.helper.CLASS_PATH)

    def get_default_object(self, generated):
        self.calls.append("get_default_object")
        require(generated.get_path_name() == self.helper.CLASS_PATH, "Unchecked generated class")
        return FakeDefault("/Game/Wrong.Default__Wrong_C" if self.scenario == "wrong_default_path"
                           else self.helper.DEFAULT_PATH,
                           "/Game/Wrong.Wrong_C" if self.scenario == "wrong_default_class"
                           else self.helper.CLASS_PATH)


def run_case(helper, fixtures, scenario, expected_error=None, maximum_exports=0):
    root = fixtures / scenario
    evidence = root / "research/evidence/editor-source"
    evidence.mkdir(parents=True)
    source = root / "synthetic-source.bin"
    source.write_bytes(b"SYNTHETIC ONLY: not an Unreal asset\n")
    expected_hash = sha(source)
    api = FakeAPI(helper, scenario, source)
    options = dict(root=root, source_path=source, expected_sha256=expected_hash,
                   health=lambda unused: dict(HEALTH), native=False)
    if scenario == "changed_source_hash":
        source.write_bytes(b"synthetic content changed after fingerprint")
    if scenario == "source_size_limit":
        source.write_bytes(b"x" * (helper.MAX_SOURCE + 1))
        options["expected_sha256"] = sha(source)
    if scenario == "native_wrong_root":
        options.update(native=True, source_path=helper.SOURCE, expected_sha256=helper.SOURCE_SHA256)
    if scenario == "native_wrong_source":
        options.update(native=True, root=helper.PROJECT, expected_sha256=helper.SOURCE_SHA256)
    if scenario == "native_wrong_hash":
        options.update(native=True, root=helper.PROJECT, source_path=helper.SOURCE,
                       expected_sha256="0" * 64)
    if scenario == "real_api_in_mock_mode":
        api.__name__ = "unreal"  # Name only; this remains a FakeAPI, no native module.
    if scenario == "low_resources":
        options["health"] = lambda unused: dict(HEALTH, physical_available=1)
    if scenario == "time_budget":
        times = iter([0, helper.MAX_SECONDS + 1])
        options["clock"] = lambda: next(times)
    if scenario == "active_other_collection":
        api._mw5_ai_research_collection = SimpleNamespace(done=False)
    if scenario == "stale_lock":
        (evidence / ".observer-mode-inspection.lock").write_text("someone-else", encoding="ascii")
    original_digest = helper.digest_file
    def guarded_digest(path, limit):
        absolute = Path(path).resolve()
        require(absolute == HELPER.resolve() or root.resolve() in absolute.parents,
                "Digest attempted installed/out-of-fixture access")
        return original_digest(path, limit)
    helper.digest_file = guarded_digest
    report, raised = None, None
    try:
        report = helper.main(api, **options)
    except Exception as exc:
        raised = type(exc).__name__ + ": " + str(exc)
    finally:
        helper.digest_file = original_digest
    if expected_error is None:
        require(raised is None and report is not None, "Successful fixture did not return a report")
        require(report["status"] == "MOCK_ONLY_COMPLETED", "Synthetic success incorrectly classified")
        require(report["classification"] == "MOCK_ONLY" and report["native_execution"] == "NOT_PERFORMED",
                "Synthetic work was promoted to native evidence")
        require(report["gameplay"] == "NOT_PERFORMED" and report["cook_install_publish"] == "NOT_PERFORMED",
                "Synthetic work was promoted to runtime evidence")
        require(report["source_unchanged_after"] is True, "Successful source unexpectedly changed")
        require(report["parent_metadata"] == {"status": "EXPORTED_TEXT_ONLY",
                "fields": ["Class'\"/Script/MechWarrior.MWPlayerController\"'"]},
                "CRLF parent metadata was missing or overclaimed")
        require(api.export_count == 2, "Success must export only named source and defaults")
        require(api.calls.count("load_asset") == (1 if scenario == "named_load" else 0),
                "Already-loaded source was redundantly loaded")
    else:
        errors = raised if raised else "\n".join(report.get("errors", []))
        require(expected_error in errors, "Wrong rejection: " + str(errors))
        if report is not None:
            require(report["status"] == "STOPPED_PARTIAL", "Rejected evidence incorrectly passed")
            require(report["native_execution"] == "NOT_PERFORMED", "Rejected fake reported native execution")
        require(api.export_count <= maximum_exports, "Rejection allowed later exports")
        if scenario in ("changed_source_hash", "source_size_limit", "native_wrong_root",
                        "native_wrong_source", "native_wrong_hash", "real_api_in_mock_mode",
                        "low_resources", "time_budget", "active_other_collection", "stale_lock"):
            require(not api.calls, "Preflight failure reached supplied API")
        if scenario == "mutation_before_load":
            require("load_asset" not in api.calls, "Changed source reached native load")
        if scenario == "mutation_after_source":
            require("generated_class" not in api.calls, "Changed source reached default lookup")
        if scenario in ("mutation_after_source", "mutation_after_defaults"):
            require(report["source_unchanged_after"] is False, "Mutation was not recorded")
        if scenario == "export_oversized":
            require("sha256" not in report["source"], "Oversized native output was hashed/read")
    require(not hasattr(api, helper.ACTIVE_KEY), "Own in-memory active marker leaked")
    lock = evidence / ".observer-mode-inspection.lock"
    if scenario == "stale_lock":
        require(lock.read_text(encoding="ascii") == "someone-else", "Preexisting lock was changed")
    else:
        require(not lock.exists(), "Own filesystem lock leaked")
    return {"case": scenario, "result": "PASS", "classification": "MOCK_ONLY",
            "expected_rejection": expected_error, "api_calls": api.calls,
            "helper_status": report.get("status") if report else None,
            "fixture_directory": str(root)}


def call_name(node):
    """Only attribute/name syntax is relevant; compatible with Python 3.7."""
    if isinstance(node, ast.Name):
        return node.id
    if isinstance(node, ast.Attribute):
        parent = call_name(node.value)
        return (parent + "." + node.attr) if parent else ""
    return ""


def static_review(helper):
    tree = ast.parse(HELPER.read_text(encoding="utf-8"))
    allowed = {"api.find_asset", "api.load_asset", "api.ObjectExporterT3D", "api.AssetExportTask",
               "api.Exporter.run_asset_export_task", "api.EditorAssetLibrary.load_blueprint_class",
               "api.get_default_object"}
    called = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Call):
            expression = call_name(node.func)
            if expression.startswith("api."):
                called.add(expression)
    require(called <= allowed, "Unreviewed API calls: " + str(called - allowed))
    pin = json.loads(PIN.read_text(encoding="utf-8-sig"))
    require(helper.SOURCE_SHA256 == pin["sha256"].lower(), "Native helper pin differs from observed receipt")
    require(str(helper.SOURCE) == pin["path"], "Native helper source path differs from observed receipt")
    require(pin["bytes"] == 229443 and helper.SOURCE_SHA256 ==
            "1c841bf1c5198b57499f2f872cbabcf3f1f38508054ab8695fcd2f6c41e4f17b", "Unexpected mode asset pin")
    require(helper.OBJECT_PATH == "/Game/Modes/InstantAction/InstantActionMode.InstantActionMode"
            and helper.CLASS_PATH == helper.OBJECT_PATH + "_C"
            and helper.DEFAULT_PATH == "/Game/Modes/InstantAction/InstantActionMode.Default__InstantActionMode_C",
            "Helper escaped exact mode identity")
    require((helper.MAX_SOURCE, helper.MAX_FILE, helper.MAX_TOTAL, helper.MAX_SECONDS, helper.MAX_JSON)
            == (1024**2, 8 * 1024**2, 17 * 1024**2, 120, 64 * 1024), "Export limits changed")
    require(helper.ACTIVE_KEY == "_mw5_observer_mode_inspection", "Mode active key is not separate")
    old_tree = ast.parse((ROOT / "scripts/Inspect-ObserverCaller.py").read_text(encoding="utf-8"))
    def function(parent, name):
        return next(node for node in parent.body if isinstance(node, ast.FunctionDef) and node.name == name)
    for name in ("digest_file", "system_health"):
        require(ast.dump(function(old_tree, name)) == ast.dump(function(tree, name)), name + " changed")
    old_main, new_main = function(old_tree, "main"), function(tree, "main")
    require(ast.dump(function(old_main, "export_object")) == ast.dump(function(new_main, "export_object")),
            "Native export logic changed from proven caller helper")
    checks = [function(main, "check") for main in (old_main, new_main)]
    comparisons = [next(node.test for node in check.body if isinstance(node, ast.If)
                        and isinstance(node.test, ast.BoolOp)) for check in checks]
    require(ast.dump(comparisons[0]) == ast.dump(comparisons[1]), "Resource comparison/boundary changed")
    exports = [ast.literal_eval(node.args[1]) for node in ast.walk(new_main)
               if isinstance(node, ast.Call) and call_name(node.func) == "export_object"]
    require(sorted(exports) == ["defaults", "source"], "Export count or objects changed")
    require("Observer mode source lookup: " in HELPER.read_text(encoding="utf-8"), "Completion line missing")
    return {"classification": "STATIC_SOURCE_REVIEW", "api_call_surface": sorted(called),
            "native_path_hash_match_observed_pin": True,
            "verified_exporter_api_reference": "scripts/Collect-AIResearch.py:213-221,288-400",
            "observed_uppercase_formats_reference": "research/evidence/editor-source/ai-research-collection-20260921T030437Z-f7d8e930/report.json:12904-12907",
            "no_save_compile_play_cook_install_recursive_scan_api_call": True}


def pin(path):
    path = Path(path)
    return {"path": str(path), "bytes": path.stat().st_size, "sha256": sha(path)}


def history():
    values = [pin(ROOT / path) for path in HISTORICAL]
    require(all(value["sha256"] == HISTORICAL[str(Path(value["path"]).relative_to(ROOT)).replace("\\", "/")]
                for value in values), "Historical helper/review changed")
    return values


def diagnostic(message, observed):
    raw = message.split("RESOURCE_STOP", 1)[1].lstrip(": ")
    value = json.loads(raw)
    require(set(value) == {"observed_bytes", "minimum_bytes", "failed_fields"}, "Unexpected diagnostic fields")
    require(value["observed_bytes"] == {key: observed[key] for key in MINIMUMS}, "Wrong observed byte values")
    require(value["minimum_bytes"] == MINIMUMS, "Wrong diagnostic thresholds")
    failed = [key for key in MINIMUMS if observed[key] < MINIMUMS[key]]
    require(set(value["failed_fields"]) == set(failed) and len(value["failed_fields"]) == len(failed),
            "Missing/repeated failed resource fields")
    require(len(message) < 1500, "Resource error exceeded bounded error allowance")
    return value


def extra_case(helper, base, name, changed=None, late=False, active=None, cross_lock=None,
               foreign=None, health_error=False):
    root = base / name
    evidence = root / "research/evidence/editor-source"
    evidence.mkdir(parents=True)
    source = root / "synthetic-source.bin"
    source.write_bytes(b"SYNTHETIC ONLY mode safety fixture\n")
    api = FakeAPI(helper, "uppercase_crlf_loaded", source)
    lock = evidence / ".observer-mode-inspection.lock"
    if active:
        setattr(api, active[0], SimpleNamespace(done=active[1]))
    if cross_lock:
        (evidence / cross_lock).write_bytes(b"FOREIGN CROSS-INSPECTION LOCK\xff")
    observed = dict(HEALTH)
    observed.update(changed or {})
    failed = any(observed[key] < MINIMUMS[key] for key in MINIMUMS)
    observations, digest_paths, lock_reads, injected = [], [], [], []
    original_open, original_digest = Path.open, helper.digest_file

    class TrackedRead:
        def __init__(self, stream):
            self.stream = stream
        def __enter__(self):
            self.stream.__enter__()
            return self
        def __exit__(self, *args):
            return self.stream.__exit__(*args)
        def read(self, count=-1):
            require(type(count) is int and 0 < count <= 33, "Foreign lock read was unbounded")
            lock_reads.append(count)
            return self.stream.read(count)
        def __getattr__(self, name):
            return getattr(self.stream, name)

    def tracking_open(path, *args, **kwargs):
        stream = original_open(path, *args, **kwargs)
        mode = args[0] if args else kwargs.get("mode", "r")
        if Path(path) == lock and mode == "rb":
            return TrackedRead(stream)
        return stream

    def guarded_digest(path, limit):
        absolute = Path(path).resolve()
        require(absolute == HELPER.resolve() or root.resolve() in absolute.parents,
                "Digest escaped project helper/synthetic fixture")
        digest_paths.append(str(absolute))
        return original_digest(path, limit)

    def health(path):
        require(Path(path) == evidence.resolve(), "Health query escaped synthetic fixture")
        state = observed if not late or api.export_count else HEALTH
        observations.append(dict(state))
        if foreign and not injected and (not late or api.export_count):
            if foreign == "nonascii":
                payload = b"\xff" * 32
            elif foreign == "large":
                payload = b"foreign" * 1024
            elif foreign == "owned_prefix":
                with original_open(lock, "rb") as stream:
                    payload = stream.read(33) + b"foreign suffix"
            else:
                payload = b"someone-else"
            lock.write_bytes(payload)
            injected.append(payload)
        if health_error:
            raise OSError("SYNTHETIC_HEALTH_UNAVAILABLE")
        return dict(state)

    helper.digest_file, Path.open = guarded_digest, tracking_open
    report, caught = None, None
    try:
        report = helper.main(api, root=root, source_path=source, expected_sha256=sha(source),
                             health=health, clock=lambda: 0.0, native=False)
    except Exception as exc:
        caught = {"type": type(exc).__name__, "message": str(exc)}
    finally:
        helper.digest_file, Path.open = original_digest, original_open
    outputs = list(evidence.glob("observer-mode-*"))
    outcome = {"case": name, "classification": "MOCK_ONLY", "result": "PASS", "api_calls": api.calls,
               "export_count": api.export_count, "health_observations": observations,
               "source_digest_paths": digest_paths, "foreign_lock_read_sizes": lock_reads,
               "fixture_directory": str(root), "caught": caught}
    blocked = bool(cross_lock or (active and not active[1]))
    if blocked:
        code = "OTHER_INSPECTION_LOCK_PRESENT" if cross_lock else "ANOTHER_RESEARCH_INSPECTION_ACTIVE"
        require(caught and code in caught["message"], "Cross-inspection guard did not refuse")
        require(not api.calls and not outputs and not observations, "Cross guard called API/health or created output")
    elif health_error:
        require(caught and "SYNTHETIC_HEALTH_UNAVAILABLE" in caught["message"], "Health error was swallowed")
        require(not api.calls and not outputs, "Unavailable resource state reached API/output")
    elif failed and not late:
        require(caught and caught["type"] == "RuntimeError" and report is None, "Initial resource failure did not escape")
        outcome["diagnostic"] = diagnostic(caught["message"], observed)
        require(not api.calls and not outputs and len(observations) == 1, "Initial resource failure reached API/output")
    elif failed:
        require(caught is None and report["status"] == "STOPPED_PARTIAL", "Late resource error lost partial receipt")
        require(api.export_count == 1 and "generated_class" not in api.calls, "Late resource stop reached defaults/parent load")
        require(len(report["errors"]) == 1, "Late resource error count changed")
        outcome["diagnostic"] = diagnostic(report["errors"][0], observed)
        require(report["last_health"] == observed, "Late resource report lost observation")
    else:
        require(caught is None and report["status"] == "MOCK_ONLY_COMPLETED", "Healthy/equal boundary failed")
        require(api.export_count == 2 and api.calls.count("find_asset") == 1, "Success escaped exactly one Blueprint and its default")
    if report is not None:
        require(len(outputs) == 1, "Expected one distinct mode output directory")
        saved = json.loads((outputs[0] / "report.json").read_text(encoding="utf-8"))
        require(saved == report, "Saved report differs from return")
        require(report["classification"] == "MOCK_ONLY" and report["native_execution"] == "NOT_PERFORMED",
                "Fake evidence promoted to native")
        require(report["gameplay"] == "NOT_PERFORMED" and report["cook_install_publish"] == "NOT_PERFORMED",
                "Fake evidence promoted to gameplay/deployment")
        require(report["source_unchanged_after"] is True and report["object_path"] == helper.OBJECT_PATH,
                "Source identity drifted")
        require((outputs[0] / "report.json").stat().st_size <= helper.MAX_JSON, "Receipt exceeded helper bound")
        outcome["saved_report"] = pin(outputs[0] / "report.json")
    if foreign:
        require(lock.read_bytes() == injected[0], "Foreign lock overwritten/removed")
        require(lock_reads and all(0 < count <= 33 for count in lock_reads), "Foreign lock cleanup did not use bounded reads")
    else:
        require(not lock.exists(), "Owned mode lock leaked")
    if cross_lock:
        require((evidence / cross_lock).read_bytes() == b"FOREIGN CROSS-INSPECTION LOCK\xff", "Cross-inspection lock changed")
    if active and active[0] == helper.ACTIVE_KEY and not active[1]:
        require(hasattr(api, helper.ACTIVE_KEY), "Preexisting active inspection marker removed")
    else:
        require(not hasattr(api, helper.ACTIVE_KEY), "Owned active marker leaked")
    require("unreal" not in sys.modules, "Tests imported real Unreal")
    return outcome


def main():
    require(sha(HELPER) == READY_SHA, "Helper differs from root source-ready hash")
    require(sha(PIN) == PIN_SHA, "Mode asset metadata differs from root-released pin")
    historical_before = history()
    helper = load_helper()
    stamp = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    fixtures = ROOT / "research/evidence/editor-source" / ("observer-mode-helper-review-" + stamp + "-" + uuid.uuid4().hex[:8])
    fixtures.mkdir()
    cases = [("uppercase_crlf_loaded", None, 2), ("named_load", None, 2),
             ("changed_source_hash", "SOURCE_HASH_MISMATCH", 0),
             ("source_size_limit", "FILE_SIZE_LIMIT", 0),
             ("native_wrong_root", "NATIVE_SCOPE_MISMATCH", 0),
             ("native_wrong_source", "NATIVE_SCOPE_MISMATCH", 0),
             ("native_wrong_hash", "NATIVE_SCOPE_MISMATCH", 0),
             ("real_api_in_mock_mode", "REAL_UNREAL_API_FORBIDDEN_IN_MOCK_MODE", 0),
             ("wrong_found_type", "LOADED_ASSET_IDENTITY_OR_TYPE_MISMATCH", 0),
             ("wrong_found_path", "LOADED_ASSET_IDENTITY_OR_TYPE_MISMATCH", 0),
             ("wrong_loaded_type", "LOADED_ASSET_IDENTITY_OR_TYPE_MISMATCH", 0),
             ("missing_loaded_asset", "LOADED_ASSET_IDENTITY_OR_TYPE_MISMATCH", 0),
             ("wrong_generated_class", "GENERATED_CLASS_IDENTITY_MISMATCH", 1),
             ("wrong_default_class", "DEFAULT_OBJECT_IDENTITY_MISMATCH", 1),
             ("wrong_default_path", "DEFAULT_OBJECT_IDENTITY_MISMATCH", 1),
             ("export_false", "EXPORT_FAILURE_OR_ERRORS", 1),
             ("export_errors", "EXPORT_FAILURE_OR_ERRORS", 1),
             ("export_exception", "EXPORT_FAILURE_OR_ERRORS", 1),
             ("export_no_file", "EXPORT_PRODUCED_NO_FILE", 1),
             ("export_empty", "NATIVE_OUTPUT_LIMIT", 1),
             ("export_oversized", "NATIVE_OUTPUT_LIMIT", 1),
             ("nontext_exporter", "EXPECTED_TEXT_EXPORTER_UNAVAILABLE", 0),
             ("mutation_before_load", "SOURCE_CHANGED_DURING_INSPECTION", 0),
             ("mutation_after_source", "SOURCE_CHANGED_DURING_INSPECTION", 1),
             ("mutation_after_defaults", "SOURCE_CHANGED_DURING_INSPECTION", 2),
             ("low_resources", "RESOURCE_STOP", 0),
             ("time_budget", "COOPERATIVE_BUDGET_STOP", 0),
             ("active_other_collection", "ANOTHER_RESEARCH_INSPECTION_ACTIVE", 0),
             ("stale_lock", "FileExistsError", 0)]
    report = {"reviewed_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
              "classification": "INDEPENDENT_STATIC_AND_MOCK_ONLY_REVIEW",
              "native_editor_execution": "NOT_PERFORMED", "gameplay": "NOT_PERFORMED",
              "helper_path": str(HELPER), "helper_sha256": sha(HELPER),
              "review_script_sha256": sha(__file__), "python_executable": sys.executable,
              "python_version": sys.version, "fixtures": str(fixtures), "cases": [],
              "historical_before": historical_before, "mode_asset_pin": pin(PIN),
              "scope_limits": ["Fake API has no Unreal module or editor connection.",
                               "Synthetic sources are not game assets; no installed asset was loaded/read by tests.",
                               "No native exporter, source body, inheritance, runtime creation or cooking proof.",
                               "Native output/time/resource limits remain cooperative, not preemptive.",
                               "Retained fixtures contain synthetic data only."]}
    extras = []
    for key, minimum in MINIMUMS.items():
        extras.extend([
            ("initial_" + key, dict(changed={key: minimum - 1})),
            ("equal_" + key, dict(changed={key: minimum})),
            ("above_" + key, dict(changed={key: minimum + 1})),
            ("after_source_export_" + key, dict(changed={key: minimum - 1}, late=True)),
        ])
    keys = list(MINIMUMS)
    for first, second in ((0, 1), (0, 2), (1, 2)):
        extras.append(("initial_pair_%d%d" % (first, second),
                       dict(changed={keys[n]: MINIMUMS[keys[n]] - 1 for n in (first, second)})))
    all_low = {key: minimum - 1 for key, minimum in MINIMUMS.items()}
    extras.extend([
        ("initial_all_low", dict(changed=all_low)),
        ("after_source_export_all_low", dict(changed=all_low, late=True)),
        ("all_exact_boundaries", dict(changed=MINIMUMS)),
        ("diagnostic_excludes_extra_health_field", dict(changed=dict(all_low, untrusted_text="DO_NOT_COPY_THIS_FIELD"))),
        ("health_unavailable_before_api", dict(health_error=True)),
    ])
    for index, key in enumerate((helper.ACTIVE_KEY, "_mw5_observer_caller_inspection", "_mw5_observer_reference_lookup",
                                 "_mw5_ai_research_collection", "_mw5_source_research_collection")):
        extras.append(("active_guard_%d" % index, dict(active=(key, False))))
        extras.append(("completed_marker_%d" % index, dict(active=(key, True))))
    for index, filename in enumerate((".observer-caller-inspection.lock", ".observer-reference-lookup.lock")):
        extras.append(("cross_lock_%d" % index, dict(cross_lock=filename)))
    extras.extend([
        ("foreign_lock_nonascii", dict(foreign="nonascii")),
        ("foreign_lock_large", dict(foreign="large")),
        ("foreign_lock_owned_prefix", dict(foreign="owned_prefix")),
        ("foreign_nonascii_initial_resource", dict(changed=all_low, foreign="nonascii")),
        ("foreign_nonascii_late_resource", dict(changed=all_low, late=True, foreign="nonascii")),
        ("foreign_ascii_after_source", dict(late=True, foreign="ascii")),
    ])
    try:
        report["static_review"] = static_review(helper)
        for scenario, error, count in cases:
            try:
                report["cases"].append(run_case(helper, fixtures, scenario, error, count))
            except Exception as exc:
                report["cases"].append({"case": scenario, "result": "FAIL",
                                        "error": type(exc).__name__ + ": " + str(exc)})
        report["original_regression"] = {"total": len(cases),
                                        "passed": sum(item["result"] == "PASS" for item in report["cases"])}
        for name, kwargs in extras:
            try:
                report["cases"].append(extra_case(helper, fixtures, name, **kwargs))
            except Exception as exc:
                report["cases"].append({"case": name, "result": "FAIL",
                                        "error": type(exc).__name__ + ": " + str(exc)})
    except Exception as exc:
        report["static_review_error"] = type(exc).__name__ + ": " + str(exc)
    report["passed"] = sum(item["result"] == "PASS" for item in report["cases"])
    report["failed"] = len(cases) + len(extras) - report["passed"]
    report["independent_boundary_guard_cases"] = {"total": len(extras),
        "passed": sum(item["result"] == "PASS" for item in report["cases"][len(cases):])}
    report["helper_unchanged_during_review"] = report["helper_sha256"] == sha(HELPER)
    report["historical_after"] = history()
    report["historical_unchanged"] = historical_before == report["historical_after"]
    report["mode_pin_unchanged"] = report["mode_asset_pin"] == pin(PIN)
    report["status"] = ("PASS_MOCK_ONLY" if report["failed"] == 0 and report["helper_unchanged_during_review"]
                        and report["historical_unchanged"] and report["mode_pin_unchanged"]
                        and "static_review_error" not in report
                        else "FAIL_REQUIRES_REVIEW")
    raw = json.dumps(report, indent=2) + "\n"
    immutable = fixtures / "independent-review-receipt.json"
    immutable.write_text(raw, encoding="utf-8")
    RECEIPT.write_text(raw, encoding="utf-8")
    text = ("# Independent InstantActionMode helper review\n\n"
            "**{status}: {passed}/{total} synthetic cases passed.** Native editor/game execution, installed asset reads, "
            "actual Blueprint export, runtime creation and cooking are **NOT_PERFORMED**.\n\n"
            "The review adapts the historical caller helper's 29 fake cases and adds {extra} independent resource-boundary, "
            "diagnostic, cross-inspection and foreign-lock cases. Tests inject synthetic sources, health observations and "
            "a narrow FakeAPI. Source digest guards reject any installed/out-of-fixture asset read.\n\n"
            "The static review checks the exact mode path/hash and generated/default identities, unchanged export logic "
            "and resource comparisons, and the permitted API call surface. The only prepared native scope is one named "
            "Blueprint source export and its checked class-default export. Parent metadata comes from exported text; "
            "no parent is loaded or exported.\n\n"
            "Resource failures are checked before API access and after the first export; byte-exact thresholds, equality, "
            "multi-resource diagnostics and unrelated-field exclusion are exercised. Foreign non-ASCII, oversized and "
            "own-token-prefix locks remain intact, with cleanup reads bounded to 33 bytes.\n\n"
            "| Artifact | SHA256 |\n|---|---|\n"
            "| `scripts/Inspect-ObserverMode.py` | `{helper}` |\n"
            "| `scripts/Review-ObserverMode.py` | `{review}` |\n"
            "| `research/OBSERVER_MODE_ASSET.json` | `{asset}` |\n\n"
            "Runtime: `{runtime}`.\n\n"
            "[Detailed receipt](OBSERVER_MODE_HELPER_REVIEW.json). Immutable run receipt: `{immutable}`.\n\n"
            "Historical caller/reference helpers and review pins were unchanged before and after the run. Matching disk "
            "hashes do not establish clean editor memory; native calls can implicitly load dependencies and regenerate "
            "cache/data. Time, resource and output checks remain cooperative and cannot interrupt an individual native call.\n")
    MARKDOWN.write_text(text.format(status=report["status"], passed=report["passed"], total=len(cases) + len(extras),
                                  extra=len(extras), helper=report["helper_sha256"], review=report["review_script_sha256"],
                                  asset=report["mode_asset_pin"]["sha256"], runtime=sys.version.splitlines()[0],
                                  immutable=str(immutable.relative_to(ROOT)).replace("\\", "/")), encoding="utf-8")
    print(json.dumps({"status": report["status"], "passed": report["passed"], "failed": report["failed"],
                      "helper_sha256": report["helper_sha256"], "receipt": str(RECEIPT)}))
    return 0 if report["status"] == "PASS_MOCK_ONLY" else 1


if __name__ == "__main__":
    raise SystemExit(main())
