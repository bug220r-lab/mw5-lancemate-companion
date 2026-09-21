"""Independent synthetic safety review; never imports Unreal or reads game assets.

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
HELPER = ROOT / "scripts/Inspect-ObserverCaller.py"
RECEIPT = ROOT / "research/PASSIVE_OBSERVER_HELPER_REVIEW.json"
PIN = ROOT / "research/PASSIVE_OBSERVER_CALLER_ASSET.json"
HEALTH = {"disk_free": 8 * 1024**3, "physical_available": 4 * 1024**3,
          "commit_available": 4 * 1024**3}


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def require(condition, message):
    if not condition:
        raise AssertionError(message)


def load_helper():
    require("unreal" not in sys.modules, "Review process must not contain real Unreal")
    spec = importlib.util.spec_from_file_location("observer_caller_under_review", HELPER)
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
        (evidence / ".observer-caller-inspection.lock").write_text("someone-else", encoding="ascii")
    report, raised = None, None
    try:
        report = helper.main(api, **options)
    except Exception as exc:
        raised = type(exc).__name__ + ": " + str(exc)
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
    lock = evidence / ".observer-caller-inspection.lock"
    if scenario == "stale_lock":
        require(lock.read_text(encoding="ascii") == "someone-else", "Preexisting lock was changed")
    else:
        require(not lock.exists(), "Own filesystem lock leaked")
    return {"case": scenario, "result": "PASS", "classification": "MOCK_ONLY",
            "expected_rejection": expected_error, "api_calls": api.calls,
            "helper_status": report.get("status") if report else None,
            "fixture_directory": str(root)}


def static_review(helper):
    tree = ast.parse(HELPER.read_text(encoding="utf-8"))
    allowed = {"api.find_asset", "api.load_asset", "api.ObjectExporterT3D", "api.AssetExportTask",
               "api.Exporter.run_asset_export_task", "api.EditorAssetLibrary.load_blueprint_class",
               "api.get_default_object"}
    called = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Call):
            expression = ast.unparse(node.func)
            if expression.startswith("api."):
                called.add(expression)
    require(called <= allowed, "Unreviewed API calls: " + str(called - allowed))
    pin = json.loads(PIN.read_text(encoding="utf-8-sig"))
    require(helper.SOURCE_SHA256 == pin["sha256"].lower(), "Native helper pin differs from observed receipt")
    require(str(helper.SOURCE) == pin["path"], "Native helper source path differs from observed receipt")
    return {"classification": "STATIC_SOURCE_REVIEW", "api_call_surface": sorted(called),
            "native_path_hash_match_observed_pin": True,
            "verified_exporter_api_reference": "scripts/Collect-AIResearch.py:213-221,288-400",
            "observed_uppercase_formats_reference": "research/evidence/editor-source/ai-research-collection-20260921T030437Z-f7d8e930/report.json:12904-12907",
            "no_save_compile_play_cook_install_recursive_scan_api_call": True}


def main():
    helper = load_helper()
    stamp = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    fixtures = ROOT / "research/evidence/editor-source" / ("observer-caller-helper-review-" + stamp + "-" + uuid.uuid4().hex[:8])
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
              "scope_limits": ["Fake API has no Unreal module or editor connection.",
                               "Synthetic sources are not game assets; no installed asset was loaded/read by tests.",
                               "No native exporter, source body, inheritance, runtime creation or cooking proof.",
                               "Native output/time/resource limits remain cooperative, not preemptive.",
                               "Retained fixtures contain synthetic data only."]}
    try:
        report["static_review"] = static_review(helper)
        for scenario, error, count in cases:
            try:
                report["cases"].append(run_case(helper, fixtures, scenario, error, count))
            except Exception as exc:
                report["cases"].append({"case": scenario, "result": "FAIL",
                                        "error": type(exc).__name__ + ": " + str(exc)})
    except Exception as exc:
        report["static_review_error"] = type(exc).__name__ + ": " + str(exc)
    report["passed"] = sum(item["result"] == "PASS" for item in report["cases"])
    report["failed"] = len(cases) - report["passed"]
    report["helper_unchanged_during_review"] = report["helper_sha256"] == sha(HELPER)
    report["status"] = ("PASS_MOCK_ONLY" if report["failed"] == 0 and report["helper_unchanged_during_review"]
                        else "FAIL_REQUIRES_REVIEW")
    RECEIPT.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"status": report["status"], "passed": report["passed"], "failed": report["failed"],
                      "helper_sha256": report["helper_sha256"], "receipt": str(RECEIPT)}))
    return 0 if report["status"] == "PASS_MOCK_ONLY" else 1


if __name__ == "__main__":
    raise SystemExit(main())
