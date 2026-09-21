"""Independent fake-only review of Inspect-ObserverReferences; Python 3.7.

Never imports Unreal, operates the editor, or reads installed game assets.
Synthetic fixtures remain below one uniquely named review directory.
"""
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
HELPER = ROOT / "scripts/Inspect-ObserverReferences.py"
RECEIPT = ROOT / "research/OBSERVER_REFERENCE_HELPER_REVIEW.json"
HEALTH = {"disk_free": 8 * 1024**3, "physical_available": 4 * 1024**3,
          "commit_available": 4 * 1024**3}
EXPECTED_PACKAGES = (
    "/Game/Objects/_common/MW5PlayerController",
    "/Game/Modes/InstantAction/InstantActionPlayerController",
    "/Game/Objects/_common/Components/PlayerControllerComponents/PlayerControllerComponentDataAsset",
)
EXPECTED_OPTIONS = dict(include_soft_package_references=True, include_hard_package_references=True,
                        include_searchable_names=False, include_soft_management_references=False,
                        include_hard_management_references=False)


def require(condition, message):
    if not condition:
        raise AssertionError(message)


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def load_helper(index):
    require("unreal" not in sys.modules, "Real Unreal already imported")
    spec = importlib.util.spec_from_file_location("observer_refs_review_%s" % index, HELPER)
    helper = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(helper)
    require("unreal" not in sys.modules, "Helper import imported Unreal")
    return helper


class FakeAPI:
    """Only the two allowed metadata methods and options constructor exist."""
    def __init__(self, scenario, files, evidence):
        self.scenario, self.files, self.evidence = scenario, files, evidence
        self.calls, self.queries, self.options = [], [], None
        self.tick, self.low_health = 0.0, None
        self.AssetRegistryHelpers = SimpleNamespace(get_asset_registry=self.get_registry)

    def __getattr__(self, name):
        if name.startswith("_mw5_") or name == "__name__":
            raise AttributeError(name)
        raise AssertionError("Unexpected/forbidden API access: " + name)

    def get_registry(self):
        self.calls.append("get_asset_registry")
        if self.scenario == "registry_exception":
            raise RuntimeError("Synthetic native registry exception")
        return self

    def AssetRegistryDependencyOptions(self, **options):
        self.calls.append("options")
        require(options == EXPECTED_OPTIONS, "Reference options changed")
        self.options = SimpleNamespace(**options)
        return self.options

    def is_loading_assets(self):
        self.calls.append("is_loading_assets")
        return self.scenario == "loading_before" or (
            self.scenario == "loading_after" and len(self.queries) >= 1)

    def get_referencers(self, package, options):
        self.calls.append("get_referencers")
        index = len(self.queries)
        require(index < 3 and package == EXPECTED_PACKAGES[index], "Wrong/repeated package query")
        require(options is self.options, "Query options not the reviewed object")
        self.queries.append(package)
        if self.scenario == "query_exception":
            raise RuntimeError("Synthetic native query exception")
        if self.scenario == "source_drift":
            self.files[0].write_bytes(b"synthetic drift")
        if self.scenario == "time_during_query":
            self.tick = 61.0
        if self.scenario == "resource_during_query":
            self.low_health = "physical_available"
        if self.scenario == "user_stop":
            outputs = list(self.evidence.glob("observer-references-*"))
            require(len(outputs) == 1, "Unexpected fake output count")
            (outputs[0] / "STOP").write_text("synthetic stop", encoding="ascii")
        if self.scenario == "lock_replaced":
            (self.evidence / ".observer-reference-lookup.lock").write_text("someone-else", encoding="ascii")
        if self.scenario == "lock_nonascii":
            (self.evidence / ".observer-reference-lookup.lock").write_bytes(b"\xff")
        if self.scenario == "null_return":
            return None
        if self.scenario in ("empty_return", "json_guard"):
            return []
        if self.scenario == "duplicates":
            return ["/Game/Duplicate", "/Game/Duplicate"]
        if self.scenario == "per_target_cap":
            return ["/Game/Lead_%03d" % n for n in range(513)]
        if self.scenario == "total_cap":
            return ["/Game/Q%d_Lead_%03d" % (index, n) for n in range(512)]
        if self.scenario == "exact_total_empty_last":
            return [] if index == 2 else ["/Game/Q%d_Lead_%03d" % (index, n) for n in range(512)]
        if self.scenario == "max_json_payload":
            return [] if index == 2 else ["/Game/" + "e" * 750 + str(index) + "%03d" % n for n in range(512)]
        invalid = {"invalid_empty": "", "invalid_no_slash": "Game/Lead", "invalid_control": "/Game/X\nY",
                   "invalid_too_long": "/Game/" + "x" * 507, "invalid_encoded": "/Game/" + "\U0001f600" * 200,
                   "invalid_root_only": "/", "invalid_dot_segment": "/Game/../Escape",
                   "invalid_empty_segment": "/Game//Lead", "invalid_backslash": "/Game/X\\Y",
                   "invalid_object_path": "/Game/Lead.Lead", "invalid_trailing_slash": "/Game/Lead/"}
        if self.scenario in invalid:
            return [invalid[self.scenario]]
        if self.scenario == "unicode_valid":
            return ["/Game/Caf\u00e9"]
        return ["/Game/Candidate_%d" % index, "/Engine/SharedCandidate"]

    def health(self, _path):
        state = HEALTH.copy()
        if self.low_health:
            state[self.low_health] = 0
        return state


def run_case(base, index, name):
    helper = load_helper(index)
    case_root = base / ("case-%02d-%s" % (index, name))
    evidence = case_root / "research/evidence/editor-source"
    evidence.mkdir(parents=True)
    content = case_root / "synthetic-content"
    files, targets = [], []
    for number, package in enumerate(EXPECTED_PACKAGES):
        path = content / (package[len("/Game/"):] + ".uasset")
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(("SYNTHETIC package fixture %d" % number).encode("ascii"))
        files.append(path)
        targets.append((package, sha(path)))
    targets = tuple(targets)
    api = FakeAPI(name, files, evidence)
    kwargs = dict(root=case_root, content=content, targets=targets, health=api.health,
                  clock=lambda: api.tick, native=False)
    lock = evidence / ".observer-reference-lookup.lock"
    expected_exception, expected_status, maximum_queries = None, "MOCK_ONLY_COMPLETED", 3
    if name == "pin_mismatch":
        files[0].write_bytes(b"wrong hash")
        expected_exception, maximum_queries = "TARGET_HASH_MISMATCH", 0
    elif name == "pin_empty":
        files[0].write_bytes(b"")
        expected_exception, maximum_queries = "PIN_FILE_SIZE_LIMIT", 0
    elif name == "pin_oversized":
        files[0].write_bytes(b"x" * (helper.MAX_FILE + 1))
        expected_exception, maximum_queries = "PIN_FILE_SIZE_LIMIT", 0
    elif name == "wrong_target_count":
        kwargs["targets"] = targets[:2]
        expected_exception, maximum_queries = "EXACT_THREE_PACKAGE_NAMES_REQUIRED", 0
    elif name == "wrong_target_order":
        kwargs["targets"] = tuple(reversed(targets))
        expected_exception, maximum_queries = "EXACT_THREE_PACKAGE_NAMES_REQUIRED", 0
    elif name == "native_scope":
        kwargs["native"] = True
        expected_exception, maximum_queries = "NATIVE_SCOPE_MISMATCH", 0
    elif name == "real_api_marker":
        api.__name__ = "unreal"
        expected_exception, maximum_queries = "REAL_UNREAL_API_FORBIDDEN_IN_MOCK_MODE", 0
    elif name == "missing_evidence":
        evidence.rmdir()
        expected_exception, maximum_queries = "PROJECT_EVIDENCE_DIRECTORY_MISSING", 0
    elif name == "active_guard":
        setattr(api, helper.ACTIVE_KEY, SimpleNamespace(done=False))
        expected_exception, maximum_queries = "ANOTHER_RESEARCH_INSPECTION_ACTIVE", 0
    elif name == "other_active_guard":
        api._mw5_ai_research_collection = SimpleNamespace(done=False)
        expected_exception, maximum_queries = "ANOTHER_RESEARCH_INSPECTION_ACTIVE", 0
    elif name == "completed_guard":
        api._mw5_ai_research_collection = SimpleNamespace(done=True)
    elif name == "other_lock":
        (evidence / ".observer-caller-inspection.lock").write_text("foreign", encoding="ascii")
        expected_exception, maximum_queries = "OTHER_INSPECTION_LOCK_PRESENT", 0
    elif name == "stale_lock":
        lock.write_text("stale", encoding="ascii")
        expected_exception, maximum_queries = "FileExistsError", 0
    elif name in ("disk_before", "physical_before", "commit_before"):
        api.low_health = {"disk_before": "disk_free", "physical_before": "physical_available",
                          "commit_before": "commit_available"}[name]
        expected_exception, maximum_queries = "RESOURCE_STOP", 0
    elif name == "loading_before":
        expected_status, maximum_queries = "STOPPED_REGISTRY_LOADING", 0
    elif name == "loading_after":
        expected_status, maximum_queries = "PARTIAL_REGISTRY_LOADING", 1
    elif name == "null_return":
        expected_status, maximum_queries = "PARTIAL_NULL_RETURN", 1
    elif name in ("per_target_cap", "total_cap"):
        expected_status = "PARTIAL_CAP_REACHED"
        maximum_queries = 1 if name == "per_target_cap" else 3
    elif name.startswith("invalid_") or name in ("registry_exception", "query_exception", "source_drift",
                                                "resource_during_query", "time_during_query", "user_stop"):
        expected_status = "ERROR_EVIDENCE_RETAINED"
        maximum_queries = 0 if name == "registry_exception" else (3 if name == "source_drift" else 1)
    elif name == "json_guard":
        helper.MAX_JSON = 128
        expected_exception = "JSON_SIZE_LIMIT"
    if name == "max_json_payload":
        # 512-character constraint still applies: use multibyte text near encoded cap.
        original_query = api.get_referencers
        def max_payload_query(package, options):
            original_query(package, options)
            q = len(api.queries) - 1
            return [] if q == 2 else ["/Game/" + "\u00e9" * 374 + str(q) + "%03d" % n for n in range(512)]
        api.get_referencers = max_payload_query

    report, caught = None, None
    try:
        report = helper.main(api, **kwargs)
    except Exception as exc:
        caught = type(exc).__name__ + ": " + str(exc)
    outputs = list(evidence.glob("observer-references-*")) if evidence.exists() else []
    persisted = []
    for output in outputs:
        for path in output.glob("*.json"):
            raw = path.read_bytes()
            json.loads(raw.decode("utf-8"))
            persisted.append({"name": path.name, "bytes": len(raw), "sha256": sha(path)})
    outcome = {"name": name, "classification": "MOCK_ONLY", "api_calls": api.calls,
               "queried_packages": api.queries, "caught": caught, "status": report and report["status"],
               "output_directories": [str(p) for p in outputs], "json_files": persisted}
    try:
        require(len(api.queries) <= maximum_queries, "Too many native queries")
        require(api.queries == list(EXPECTED_PACKAGES[:len(api.queries)]), "Query sequence drift")
        if expected_exception:
            require(caught is not None and expected_exception in caught, "Expected exception: " + expected_exception)
        else:
            require(caught is None, "Unexpected exception: " + str(caught))
            require(report is not None and report["status"] == expected_status,
                    "Expected status %s, got %s" % (expected_status, report and report["status"]))
            require(report["classification"] == "MOCK_ONLY", "Fake result misclassified")
            require(report["native_execution"] == "NOT_PERFORMED", "Fake labeled native")
            require(report["options"] == EXPECTED_OPTIONS, "Receipt option drift")
            require(report["gameplay"] == "NOT_PERFORMED", "Gameplay mislabeled")
            require(report["asset_load_export_save_compile_cook"] == "NOT_PERFORMED", "Scope mislabeled")
            require(len(outputs) == 1, "Expected one fake output directory")
            require(json.loads((outputs[0] / "report.json").read_text(encoding="utf-8")) == report,
                    "Persisted report differs")
        if name in ("pin_mismatch", "pin_empty", "pin_oversized", "native_scope", "real_api_marker",
                    "wrong_target_count", "wrong_target_order", "missing_evidence", "active_guard",
                    "other_active_guard", "other_lock", "stale_lock", "disk_before", "physical_before", "commit_before"):
            require(not api.calls, "Preflight failure touched fake native API")
        if name not in ("active_guard",):
            require(not hasattr(api, helper.ACTIVE_KEY), "Owned API active marker leaked")
        if name in ("stale_lock", "lock_replaced", "lock_nonascii"):
            require(lock.exists(), "Removed a foreign lock")
            expected_lock = {"stale_lock": b"stale", "lock_replaced": b"someone-else", "lock_nonascii": b"\xff"}[name]
            require(lock.read_bytes() == expected_lock, "Changed foreign lock bytes")
        else:
            require(not lock.exists(), "Owned filesystem lock leaked")
        if name == "other_lock":
            require((evidence / ".observer-caller-inspection.lock").read_text(encoding="ascii") == "foreign",
                    "Changed another inspection lock")
        if report:
            entries = sum(len(q["referencers"]) for q in report["queries"])
            require(entries == report["total_retained_entries"], "Retained entry count wrong")
            require(entries <= 1024 and all(len(q["referencers"]) <= 512 for q in report["queries"]), "Caps failed")
            require(report["source_hashes_unchanged"] is (name != "source_drift"), "Source drift result wrong")
            if name == "duplicates":
                require(entries == 6 and report["queries"][0]["returned_count"] == 2, "Duplicates silently collapsed")
            if name == "null_return":
                require(report["queries"][0]["status"] == "NULL_RETURN", "None treated as empty")
            if name == "empty_return":
                require(len(report["queries"]) == 3 and entries == 0, "Empty result handling wrong")
            if name == "max_json_payload":
                report_size = (outputs[0] / "report.json").stat().st_size
                require(750000 < report_size <= 1024**2, "Large bounded JSON expectation failed")
        if name == "json_guard":
            require(len(outputs) == 1 and (outputs[0] / "started.json").exists(), "No evidence after JSON stop")
            require(not (outputs[0] / "report.json").exists(), "Oversized final report was written")
        require("unreal" not in sys.modules, "Review imported Unreal")
        outcome["passed"] = True
    except AssertionError as exc:
        outcome["passed"], outcome["failure"] = False, str(exc)
    return outcome


def main():
    stamp = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    base = ROOT / "research/evidence/editor-source" / ("observer-reference-helper-review-" + stamp + "-" + uuid.uuid4().hex[:10])
    base.mkdir()
    cases = ["normal", "empty_return", "null_return", "duplicates", "unicode_valid", "pin_mismatch", "pin_empty",
             "pin_oversized", "wrong_target_count", "wrong_target_order", "native_scope", "real_api_marker",
             "missing_evidence", "active_guard", "other_active_guard", "completed_guard", "other_lock", "stale_lock",
             "lock_replaced", "lock_nonascii", "disk_before", "physical_before", "commit_before", "loading_before",
             "loading_after", "per_target_cap", "total_cap", "exact_total_empty_last", "invalid_empty",
             "invalid_no_slash", "invalid_control", "invalid_too_long", "invalid_encoded", "invalid_root_only",
             "invalid_dot_segment", "invalid_empty_segment", "invalid_backslash", "invalid_object_path",
             "invalid_trailing_slash", "source_drift", "registry_exception", "query_exception", "resource_during_query",
             "time_during_query", "user_stop", "json_guard", "max_json_payload"]
    helper_before = sha(HELPER)
    outcomes = [run_case(base, index, name) for index, name in enumerate(cases, 1)]
    helper_after = sha(HELPER)
    passed = sum(v["passed"] for v in outcomes)
    receipt = {"schema_version": 1, "classification": "MOCK_ONLY", "native_execution": "NOT_PERFORMED",
               "status": "PASS_MOCK_ONLY" if passed == len(outcomes) and helper_before == helper_after else "FAIL_MOCK_REVIEW",
               "reviewed_at": datetime.datetime.now(datetime.timezone.utc).isoformat(), "runtime": sys.version,
               "helper_path": str(HELPER), "helper_sha256_before": helper_before, "helper_sha256_after": helper_after,
               "review_script_sha256": sha(__file__), "fixture_directory": str(base), "cases_passed": passed,
               "cases_failed": len(outcomes) - passed, "cases": outcomes,
               "limits": ["Fake APIs and synthetic package files only; no Unreal import or editor action.",
                          "No native registry completeness, timing, allocation, serialization, or gameplay proof.",
                          "JSON cap fault injection retains started/checkpoint files; final receipt may be absent.",
                          "Production helper and original evidence were not modified by this review."]}
    RECEIPT.write_text(json.dumps(receipt, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({"status": receipt["status"], "passed": passed, "failed": len(outcomes) - passed,
                      "failures": [{"name": v["name"], "failure": v.get("failure")} for v in outcomes if not v["passed"]],
                      "receipt": str(RECEIPT), "helper_unchanged": helper_before == helper_after}, indent=2))
    return 0 if receipt["status"] == "PASS_MOCK_ONLY" else 1


if __name__ == "__main__":
    sys.exit(main())
