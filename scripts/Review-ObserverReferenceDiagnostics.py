"""Independent fake-only review of the resource-stop diagnostic change.

No editor/game/native helper execution, installed-asset access or real Unreal
import. Reuse historical test functions without calling their main/receipt writer.
"""
import ast
import datetime
import hashlib
import importlib.util
import json
from pathlib import Path
import sys
import uuid

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parent.parent
HELPER = ROOT / "scripts/Inspect-ObserverReferences.py"
READY_SHA = "adc2da144e2648c8fcbe7df42667a76bf7bd258ace455d0105b27a3fea717a63"
ORIGINAL_HELPER = ROOT / "research/evidence/editor-source/observer-reference-attempt-20260923T023927Z-de0b7365b363/Inspect-ObserverReferences.original.py.txt"
RECEIPT = ROOT / "research/OBSERVER_REFERENCE_DIAGNOSTIC_REVIEW.json"
MINIMUMS = dict(disk_free=2*1024**3, physical_available=768*1024**2, commit_available=1024**3)
HISTORICAL = {
    ROOT / "scripts/Review-ObserverReferences.py": "64eb03b71b19785f4f317052d0d3c2fcc93ad9c808f67645e12377116e33e1a5",
    ROOT / "research/OBSERVER_REFERENCE_HELPER_REVIEW.json": "c9ee8adb3a4ef14de7c0dec200b34a16ee0a7e15bec9e5fd0103f93f7033ad20",
    ROOT / "research/OBSERVER_REFERENCE_HELPER_REVIEW.md": "109f0a3fba3d398a283c27df7df036e7d8a95b807c9ccb8f945b6e6477b92ead",
}


def load_old():
    path = ROOT / "scripts/Review-ObserverReferences.py"
    spec = importlib.util.spec_from_file_location("historical_reference_review_functions", str(path))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


old = load_old()
require = old.require


def pin(path):
    path = Path(path)
    return dict(path=str(path), bytes=path.stat().st_size,
                sha256=hashlib.sha256(path.read_bytes()).hexdigest())


def historical_pins():
    values = [pin(path) for path in HISTORICAL]
    require(all(item["sha256"] == HISTORICAL[Path(item["path"])] for item in values), "Historical review artifacts changed")
    return values


def original_case_names():
    tree = ast.parse((ROOT / "scripts/Review-ObserverReferences.py").read_text(encoding="utf-8"))
    main = next(node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name == "main")
    assignment = next(node for node in main.body if isinstance(node, ast.Assign)
                      and any(isinstance(target, ast.Name) and target.id == "cases" for target in node.targets))
    names = ast.literal_eval(assignment.value)
    require(type(names) is list and len(names) == 47, "Original case list changed")
    return names


def fixture(base, index, name):
    helper = old.load_helper("diagnostic_%d" % index)
    case_root = base / ("diagnostic-%02d-%s" % (index, name))
    evidence = case_root / "research/evidence/editor-source"
    evidence.mkdir(parents=True)
    content = case_root / "synthetic-content"
    files, targets = [], []
    for number, package in enumerate(old.EXPECTED_PACKAGES):
        path = content / (package[len("/Game/"):] + ".uasset")
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(("MOCK_ONLY diagnostic package %d" % number).encode("ascii"))
        files.append(path)
        targets.append((package, old.sha(path)))
    api = old.FakeAPI("normal", files, evidence)
    kwargs = dict(root=case_root, content=content, targets=tuple(targets), clock=lambda: 0.0, native=False)
    return helper, api, evidence, kwargs


def parse_diagnostic(message):
    """Format is finalized against the coordinating task's source-ready change."""
    start = message.index("RESOURCE_STOP")
    text = message[start + len("RESOURCE_STOP"):].lstrip(": ")
    return json.loads(text)


def check_diagnostic(message, observed):
    value = parse_diagnostic(message)
    require(value.get("observed_bytes") == {key: observed[key] for key in MINIMUMS}, "Diagnostic observed byte values differ or extra fields leaked")
    require(value.get("minimum_bytes") == MINIMUMS, "Diagnostic thresholds differ")
    expected_failed = [key for key in MINIMUMS if observed[key] < MINIMUMS[key]]
    require(set(value.get("failed_fields", [])) == set(expected_failed)
            and len(value.get("failed_fields", [])) == len(expected_failed), "Wrong or repeated failed field names")
    require(set(value) == {"observed_bytes", "minimum_bytes", "failed_fields"}, "Unexpected diagnostic data")
    require(len(message) < 1500, "Diagnostic exceeds existing bounded exception-message allowance")
    return value


def diagnostic_case(base, index, name, changed, late=False, foreign_lock=False):
    helper, api, evidence, kwargs = fixture(base, index, name)
    observed = old.HEALTH.copy()
    observed.update(changed)
    expected_stop = any(observed[key] < MINIMUMS[key] for key in MINIMUMS)
    health_calls = []
    def health(path):
        require(Path(path) == evidence.resolve(), "Health probe escaped fixture evidence directory")
        state = observed if not late or api.queries else old.HEALTH
        health_calls.append(dict(state))
        if foreign_lock and state is observed:
            (evidence / ".observer-reference-lookup.lock").write_bytes(b"foreign-diagnostic-lock")
        return dict(state)
    kwargs["health"] = health
    # Guard every source fingerprint: imports only define paths; reads must remain
    # in this synthetic case or the project helper itself, never installed assets.
    original_fingerprint = helper.fingerprint
    fingerprint_paths = []
    def guarded_fingerprint(path):
        absolute = Path(path).resolve()
        require(absolute == HELPER.resolve() or kwargs["root"].resolve() in absolute.parents,
                "Fingerprint attempted installed/out-of-fixture source access")
        fingerprint_paths.append(str(absolute))
        return original_fingerprint(path)
    helper.fingerprint = guarded_fingerprint
    report, caught = None, None
    try:
        report = helper.main(api, **kwargs)
    except Exception as exc:
        caught = dict(type=type(exc).__name__, message=str(exc))
    outputs = list(evidence.glob("observer-references-*"))
    outcome = dict(name=name, classification="MOCK_ONLY_RESOURCE_DIAGNOSTIC", api_calls=api.calls,
                   queried_packages=api.queries, health_observations=health_calls, caught=caught,
                   output_directories=[str(p) for p in outputs], fingerprint_paths=fingerprint_paths)
    try:
        lock = evidence / ".observer-reference-lookup.lock"
        if expected_stop and not late:
            require(report is None and caught and caught["type"] == "RuntimeError", "Initial stop did not escape as RuntimeError")
            outcome["diagnostic"] = check_diagnostic(caught["message"], observed)
            require(not api.calls and not api.queries, "Initial stop accessed registry API")
            require(not outputs, "Initial stop created an output directory/receipt")
            require(len(health_calls) == 1, "Initial stop performed another health probe")
        elif expected_stop:
            require(caught is None and report["status"] == "ERROR_EVIDENCE_RETAINED", "Late stop not retained")
            require(len(report["queries"]) == 1 and api.queries == [old.EXPECTED_PACKAGES[0]], "Late stop queried additional packages")
            require(len(report["errors"]) == 1, "Late stop error count changed")
            outcome["diagnostic"] = check_diagnostic(report["errors"][0], observed)
            require(report["last_health"] == observed, "Late report lost observed health")
        else:
            require(caught is None and report["status"] == "MOCK_ONLY_COMPLETED", "Equality/healthy boundary refused")
            require(api.queries == list(old.EXPECTED_PACKAGES), "Healthy run query scope changed")
            require(not report["errors"], "Healthy run produced error")
        if report is not None:
            require(len(outputs) == 1, "Expected one synthetic output")
            saved = json.loads((outputs[0] / "report.json").read_text(encoding="utf-8"))
            require(saved == report, "Persisted diagnostic report differs")
            require(report["classification"] == "MOCK_ONLY" and report["native_execution"] == "NOT_PERFORMED", "Mock promoted to native")
            require(report["options"] == old.EXPECTED_OPTIONS and report["source_hashes_unchanged"] is True, "Scope/source changed")
            require(report["gameplay"] == "NOT_PERFORMED" and report["asset_load_export_save_compile_cook"] == "NOT_PERFORMED", "Scope flags changed")
            require((outputs[0] / "report.json").stat().st_size <= 1048576, "Report cap exceeded")
            outcome["persisted_report"] = pin(outputs[0] / "report.json")
        if foreign_lock:
            require(lock.read_bytes() == b"foreign-diagnostic-lock", "Foreign diagnostic lock changed")
        else:
            require(not lock.exists(), "Owned lock leaked")
        require(not hasattr(api, helper.ACTIVE_KEY), "Owned API marker leaked")
        require("unreal" not in sys.modules, "Review imported Unreal")
        outcome["passed"] = True
    except (AssertionError, ValueError, KeyError, TypeError) as exc:
        outcome.update(passed=False, failure=str(exc))
    return outcome


def scope_case():
    helper = old.load_helper("diagnostic_scope")
    outcome = dict(name="unchanged_scope_options_caps", classification="MOCK_ONLY_STATIC_SCOPE")
    try:
        require(tuple(item[0] for item in helper.TARGETS) == old.EXPECTED_PACKAGES, "Target package names/order changed")
        require(helper.OPTIONS == old.EXPECTED_OPTIONS, "Query options changed")
        require((helper.MAX_PER_TARGET, helper.MAX_TOTAL, helper.MAX_NAME, helper.MAX_ENCODED_NAME,
                 helper.MAX_FILE, helper.MAX_JSON, helper.MAX_SECONDS) == (512, 1024, 512, 768, 2097152, 1048576, 60),
                "Scope caps/cooperative budget changed")
        require("unreal" not in sys.modules, "Scope import imported Unreal")
        require(pin(ORIGINAL_HELPER)["sha256"] == "20c460fdf678de74568c477b28c41a65408a5b5c7868bc1bb893d05ceced099b", "Preserved original helper changed")
        trees = [ast.parse(path.read_text(encoding="utf-8")) for path in (ORIGINAL_HELPER, HELPER)]
        guards = []
        for tree in trees:
            main = next(node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name == "main")
            check = next(node for node in main.body if isinstance(node, ast.FunctionDef) and node.name == "check")
            resource_if = next(node for node in check.body if isinstance(node, ast.If) and isinstance(node.test, ast.BoolOp))
            guards.append(ast.dump(resource_if.test))
            resource_if.body = [ast.Pass()]
        require(guards[0] == guards[1], "Resource threshold/comparison changed")
        require(ast.dump(trees[0]) == ast.dump(trees[1]), "Code outside resource exception branch changed")
        outcome["comparison"] = "Original/current AST identical outside resource exception body; guard identical"
        outcome["passed"] = True
    except AssertionError as exc:
        outcome.update(passed=False, failure=str(exc))
    return outcome


def main():
    require("unreal" not in sys.modules, "Real Unreal already imported")
    historical_before, helper_before = historical_pins(), pin(HELPER)
    require(helper_before["sha256"] == READY_SHA, "Helper differs from root-released source hash")
    stamp = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    base = ROOT / "research/evidence/editor-source" / ("observer-reference-helper-review-diagnostics-" + stamp + "-" + uuid.uuid4().hex[:10])
    base.mkdir()
    regression = [old.run_case(base, index, name) for index, name in enumerate(original_case_names(), 1)]
    cases = []
    keys = list(MINIMUMS)
    for index, key in enumerate(keys):
        cases.append(("initial_" + key, {key: MINIMUMS[key]-1}, False, False))
        cases.append(("equal_" + key, {key: MINIMUMS[key]}, False, False))
        cases.append(("above_" + key, {key: MINIMUMS[key]+1}, False, False))
        cases.append(("late_" + key, {key: MINIMUMS[key]-1}, True, False))
    for first, second in ((0,1), (0,2), (1,2)):
        cases.append(("initial_pair_%d%d" % (first, second), {keys[n]:MINIMUMS[keys[n]]-1 for n in (first,second)}, False, False))
    low_all = {key: minimum-1 for key, minimum in MINIMUMS.items()}
    cases.extend([("initial_all_low", low_all, False, False), ("late_all_low", low_all, True, False),
                  ("all_exact_boundaries", MINIMUMS.copy(), False, False),
                  ("initial_extra_health_fields_excluded", dict(low_all, untrusted_text="DO_NOT_COPY_THIS_FIELD"), False, False),
                  ("initial_foreign_lock_preserved", low_all, False, True),
                  ("late_foreign_lock_preserved", low_all, True, True)])
    diagnostics = [diagnostic_case(base, index, *case) for index, case in enumerate(cases, 1)] + [scope_case()]
    outcomes = regression + diagnostics
    helper_after, historical_after = pin(HELPER), historical_pins()
    stable = helper_before == helper_after and historical_before == historical_after
    passed = sum(item["passed"] for item in outcomes)
    status = "PASS_MOCK_ONLY" if stable and passed == len(outcomes) else "FAIL_MOCK_REVIEW"
    receipt = dict(schema_version=1, classification="MOCK_ONLY", status=status, native_execution="NOT_PERFORMED",
                   editor_game_launch="NOT_PERFORMED", installed_asset_reads="NOT_PERFORMED", runtime=sys.version,
                   reviewed_at=datetime.datetime.now(datetime.timezone.utc).isoformat(), helper_before=helper_before,
                   helper_after=helper_after, historical_before=historical_before, historical_after=historical_after,
                   review_script=pin(__file__), fixture_directory=str(base), cases_passed=passed, cases_failed=len(outcomes)-passed,
                   original_regression=dict(passed=sum(v["passed"] for v in regression), total=len(regression)),
                   independent_diagnostics=dict(passed=sum(v["passed"] for v in diagnostics), total=len(diagnostics)), cases=outcomes,
                   limits=["Synthetic content files and FakeAPI only; no native execution or installed asset reads.",
                           "Historical47-case review artifacts remain unchanged; new receipt covers changed helper hash.",
                           "Diagnostic values describe the injected observation, not the earlier native failure.",
                           "No new native receipt/output before initial resource stop; cooperative/native timing unproved."])
    raw = json.dumps(receipt, indent=2, ensure_ascii=False) + "\n"
    (base / "diagnostic-review-receipt.json").write_text(raw, encoding="utf-8")
    RECEIPT.write_text(raw, encoding="utf-8")
    print(json.dumps(dict(status=status, passed=passed, failed=len(outcomes)-passed, original_regression=receipt["original_regression"],
                         independent_diagnostics=receipt["independent_diagnostics"], sources_and_history_unchanged=stable,
                         fixture_directory=str(base), failures=[dict(name=v["name"], failure=v.get("failure")) for v in outcomes if not v["passed"]]), indent=2))
    return 0 if status == "PASS_MOCK_ONLY" else 1


if __name__ == "__main__":
    sys.exit(main())
