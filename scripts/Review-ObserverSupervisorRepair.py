"""Independent repair review; default is mock-only and never launches a child.

The historical 129/130 review, failed case and lock are read-only inputs. Real
synthetic modes run only after coordinating-task release, recorded as run metadata,
and a fresh query-only absence check. This never executes the native lookup helper.
"""
import argparse
import ast
import copy
import ctypes
import datetime
import importlib.util
import json
import os
from pathlib import Path
import sys
import time
from types import SimpleNamespace
import uuid

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parent.parent
SCRIPTS = ROOT / "scripts"
sys.path.insert(0, str(SCRIPTS))
HISTORICAL = ROOT / "research/evidence/editor-source/observer-supervisor-review-20260922T223407Z-0708f1688e"
FAILED = HISTORICAL / "case-109-windows-child_hold"
ASSESSMENT = HISTORICAL / "windows-child-hold-readonly-assessment.json"
FAILED_REPAIR = ROOT / "research/evidence/editor-source/observer-supervisor-review-repair-20260922T225328Z-cf09460ee8"
REPAIR_ASSESSMENT = FAILED_REPAIR / "windows-child-hold-readonly-assessment.json"
RECEIPT = ROOT / "research/OBSERVER_SUPERVISOR_REPAIR_REVIEW.json"
ORIGINAL_PINS = {
    ROOT / "research/OBSERVER_SUPERVISOR_REVIEW.json": "ed01c9aab74ac1efc7f477d45534a8761b096fa5cc97ed4da4f3515f03c23159",
    HISTORICAL / "review-receipt.json": "ed01c9aab74ac1efc7f477d45534a8761b096fa5cc97ed4da4f3515f03c23159",
    FAILED / "attempt/process-result.json": "6b5fb4b10cd735ee500277a413088555cd15f8e83f65159b5d4b3b64d6bcad70",
    FAILED / "attempt/timeline.jsonl": "5f2f84021394918dcfe2dd03dc5e1e57eef7868570ae573454ba5f2002e73284",
    FAILED / ".observer-supervisor.lock": "f01b406149ed94c8b29d502233c1a9c27d8c3a6537afca2a1f5932cae5dfc781",
    ASSESSMENT: "fc6bf558780950de8e59144b1625c57f159fe3faf52227cd131ab2e7fb09934c",
    FAILED_REPAIR / "repair-review-receipt.json": "5628b832fb7dbec5b2c31259857216503b9ad9f0f897b87ea1045cb4fceac2bd",
    FAILED_REPAIR / "case-901-repair-windows-child_hold/attempt/process-result.json": "4527d1072d1256ff0e469a537b27941abb29c014e98a514d11ea912912e67d85",
    FAILED_REPAIR / "case-901-repair-windows-child_hold/attempt/timeline.jsonl": "87db2ff7a364ba621335fb68b477cff531643ad943e741978fe997d7d183b08b",
    FAILED_REPAIR / "case-901-repair-windows-child_hold/.observer-supervisor.lock": "5d64aa3b390b3b9d26f28069dcacc67812c9d544e0a22ae2429d4af6be89cd5b",
    REPAIR_ASSESSMENT: "947b8f9e61f68befbb12b22a625b84c6d758d87f4ce3ef0d88475a3cad62e30a",
}


def import_file(name, path):
    spec = importlib.util.spec_from_file_location(name, str(path))
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


old = import_file("historical_supervisor_review_functions", SCRIPTS / "Review-ObserverSupervisor.py")
require, pin = old.require, old.pin


def source_pins():
    return [pin(SCRIPTS / filename) for filename in
            ("observer_supervisor.py", "observer_supervisor_evidence.py", "observer_supervisor_windows.py",
             "fixtures/observer-supervisor-child.py", "Review-ObserverSupervisor.py", "Review-ObserverSupervisorRepair.py")]


def original_pins():
    result = [pin(path) for path in ORIGINAL_PINS]
    require(all(p["sha256"] == ORIGINAL_PINS[Path(p["path"])] for p in result), "Historical evidence pin changed")
    return result


class SnapshotApi:
    """Only mocked APIs; no Windows DLL instance or termination API is present."""
    def __init__(self, identities, memberships, jobs):
        self.identities = copy.deepcopy(identities)
        self.memberships, self.jobs = list(memberships), copy.deepcopy(jobs)
        self.calls = []
        self.k = SimpleNamespace()
    def identity(self, handle, expected=None):
        require(handle == "retained_root", "Identity refresh changed retained handle")
        self.calls.append("identity")
        value = self.identities.pop(0) if len(self.identities) > 1 else self.identities[0]
        if isinstance(value, Exception):
            raise value
        return dict(value)
    def member(self, handle, job):
        require(handle == "retained_root" and job == "fake_job", "Membership check changed retained ownership handles")
        self.calls.append("member")
        value = self.memberships.pop(0) if len(self.memberships) > 1 else self.memberships[0]
        if isinstance(value, Exception):
            raise value
        return value
    def job_ids(self, job, maximum):
        self.calls.append("job_ids")
        value = self.jobs.pop(0) if len(self.jobs) > 1 else self.jobs[0]
        if isinstance(value, Exception):
            raise value
        return list(value)
    def snapshot(self):
        self.calls.append("snapshot")
        return {}
    def close(self, handle):
        self.calls.append("close_handle")


def ownership_race_cases():
    from observer_supervisor_windows import OwnedProcess, BackendError
    root = dict(pid=1234, created="133000000000000001", exe=sys.executable, alive=True, exit_code=None)
    exited = dict(root, alive=False, exit_code=0)
    changed_pid = dict(exited, pid=1235)
    changed_created = dict(exited, created="133000000000000099")
    changed_path = dict(exited, exe=str(ROOT / "different-python.exe"))
    cases = [
        ("retained_live_member", "verify", [root], [True], [[]], True),
        ("retained_exited", "verify", [exited], [False], [[]], True),
        ("member_false_same_handle_now_exited", "verify", [root, exited], [False], [[]], True),
        ("member_false_still_live", "verify", [root, root], [False], [[]], False),
        ("member_false_changed_pid", "verify", [root, changed_pid], [False], [[]], False),
        ("member_false_changed_creation", "verify", [root, changed_created], [False], [[]], False),
        ("member_false_changed_path", "verify", [root, changed_path], [False], [[]], False),
        ("member_api_failure_not_exit", "verify", [root, exited], [BackendError("JOB_MEMBERSHIP_FAILED", 5)], [[]], False),
        ("refresh_identity_failure", "verify", [root, BackendError("PROCESS_TIMES_FAILED", 6)], [False], [[]], False),
        ("root_missing_job_now_exited", "inspect", [root, exited], [True], [[], []], True),
        ("root_missing_job_still_live", "inspect", [root, root], [True], [[]], False),
        ("root_missing_job_identity_changed", "inspect", [root, changed_created], [True], [[]], False),
        ("root_missing_job_identity_failure", "inspect", [root, BackendError("PROCESS_WAIT_FAILED", 6)], [True], [[]], False),
        ("normal_exit_late_unknown_child", "inspect", [exited], [False], [[], [9876]], False),
        ("cleanup_exit_late_unknown_child", "terminate", [exited], [False], [[], [], [9876], [], []], False),
        ("normal_exit_known_job_membership_not_empty", "inspect", [exited], [False], [[], [1234]], False),
    ]
    outcomes = []
    for name, action, identities, memberships, jobs, expected in cases:
        api = SnapshotApi(identities, memberships, jobs)
        process = OwnedProcess(api, "fake_job", SimpleNamespace(hProcess="retained_root", hThread="fake_thread", dwProcessId=1234),
                               [sys.executable], 32)
        process._root, process._assigned = dict(root), True
        outcome = dict(name=name, classification="MOCK_ONLY_RETAINED_HANDLE_RACE")
        try:
            if action == "verify":
                value = process._verify("retained_root", root)
                accepted = True
            elif action == "inspect":
                value = process.inspect()
                accepted = value["ownership_verified"]
            else:
                value = process.terminate_owned()
                accepted = value["all_exited"]
            outcome["result"] = value
        except BackendError as exc:
            accepted = False
            outcome["caught"] = exc.record()
        except Exception as exc:
            accepted = None
            outcome["unexpected_exception"] = type(exc).__name__
        outcome.update(passed=accepted is expected, calls=api.calls)
        if len(api.calls) > 20:
            outcome.update(passed=False, failure="Unexpected repeated API polling")
        if accepted is not expected:
            outcome["failure"] = "Unexpected ownership disposition"
        if name == "normal_exit_late_unknown_child":
            api.jobs, api.identities = [[]], [exited]
            later = process.inspect()
            if later["ownership_verified"] is not False:
                outcome.update(passed=False, failure="Unknown-child error latch cleared by later empty snapshot")
        if name == "member_api_failure_not_exit" and api.calls != ["identity", "member"]:
            outcome.update(passed=False, failure="Membership API failure treated as false response")
        outcomes.append(outcome)
    return outcomes


def diagnostic_cases(base):
    """Actual core diagnostics; all observations/process control remain mocked."""
    core = old.module("repair_diagnostics")
    outcomes = []
    def check(name, callback):
        item = dict(name=name, classification="MOCK_ONLY_DIAGNOSTIC_RETENTION")
        try:
            item["evidence"] = callback()
            item["passed"] = True
        except (AssertionError, Exception) as exc:
            item.update(passed=False, failure=str(exc)[:240])
        outcomes.append(item)
    valid = dict(pid=1234, created="133000000000000001", exe=sys.executable, argv=["UNTRUSTED_ARGV_SENTINEL"],
                 alive=True, exit_code=None, descendants=[], ownership_verified=False,
                 errors=[dict(code="OWNED_PROCESS_LEFT_JOB", winerror=5, raw="UNTRUSTED_ERROR_SENTINEL")])
    def direct():
        try:
            core.inspect_owned(SimpleNamespace(inspect=lambda: copy.deepcopy(valid)))
        except core.SupervisorError as exc:
            require(exc.code == "OWNERSHIP_UNVERIFIED", "Primary failure code changed")
            value = exc.ownership_diagnostics
            require(value["backend_errors"] == [dict(code="OWNED_PROCESS_LEFT_JOB", winerror=5)], "Adapter code lost or altered")
            require(value["root"] == dict(pid=1234, created="133000000000000001", alive=True, exit_code=None), "Root identity lost")
            raw = json.dumps(value)
            require("UNTRUSTED" not in raw and '"exe"' not in raw and '"argv"' not in raw, "Sensitive/raw fields retained")
            return value
        raise AssertionError("Ownership failure was accepted")
    check("diagnostic_direct_code_propagation", direct)
    for label, state in (("null", None), ("list", []), ("text", "UNTRUSTED_TEXT")):
        def shape_case(state=state):
            value = core.bounded_ownership_diagnostics(state)
            require(value["state_shape_valid"] is False and value["ownership_verified"] is False, "Bad shape promoted")
            require(value["root"] is None and value["descendants"] == [], "Bad shape retained raw content")
            return value
        check("diagnostic_shape_" + label, shape_case)
    def malformed():
        state = dict(valid, pid=True, created="UNTRUSTED_CREATED", alive="yes", exit_code=-1,
                     descendants=[dict(pid=0, parent_pid=True, created="9"*21, alive=1, exit_code=2**32), "UNTRUSTED_CHILD"],
                     errors=[None, dict(code="lowercase raw", winerror=1), dict(code="VALID", winerror=True),
                             dict(code="X"*97, winerror=None), dict(code="VALID", winerror=-1),
                             dict(code="VALID", winerror=2**32), dict(code="VALID", winerror=None)])
        value = core.bounded_ownership_diagnostics(state)
        require(value["root"] == dict(pid=None, created=None, alive=None, exit_code=None), "Malformed root retained")
        require(value["descendants"][0] == dict(pid=None, parent_pid=None, created=None, alive=None, exit_code=None)
                and value["descendants"][1] is None, "Malformed descendant retained")
        require(all(v == dict(code="MALFORMED_BACKEND_DIAGNOSTIC", winerror=None) for v in value["backend_errors"][:-1]), "Malformed diagnostic retained")
        require(value["backend_errors"][-1] == dict(code="VALID", winerror=None), "Valid null error changed")
        require("UNTRUSTED" not in json.dumps(value), "Untrusted text escaped sanitization")
        return value
    check("diagnostic_malformed_values_sanitized", malformed)
    def shapes():
        value = core.bounded_ownership_diagnostics(dict(valid, errors="UNTRUSTED", descendants={"UNTRUSTED": True}))
        require(value["descendants_shape_valid"] is False and value["descendants"] == [], "Malformed descendants list accepted")
        require(value["backend_errors"] == [dict(code="MALFORMED_BACKEND_DIAGNOSTICS", winerror=None)], "Malformed errors list accepted")
        return value
    check("diagnostic_malformed_collection_shapes", shapes)
    def caps():
        state = copy.deepcopy(valid)
        state["descendants"] = [dict(pid=2000+n, parent_pid=1234, created="133000000000000002", alive=False,
                                     exit_code=0, exe="UNTRUSTED_PATH") for n in range(1000)]
        state["errors"] = [dict(code="SYNTHETIC_ERROR_%d" % n, winerror=n, raw="UNTRUSTED"*1000) for n in range(1000)]
        value = core.bounded_ownership_diagnostics(state)
        require(len(value["descendants"]) == 32 and len(value["backend_errors"]) == 16, "Diagnostic cap drift")
        require(value["descendants_truncated"] is True and value["backend_errors_truncated"] is True, "Truncation not labeled")
        raw = json.dumps(value).encode("utf-8")
        require(len(raw) < 8192 and b"UNTRUSTED" not in raw, "Diagnostics exceed bounded budget or expose raw content")
        return dict(bytes=len(raw), observation=value)
    check("diagnostic_caps_and_json_budget", caps)
    for number, mode in enumerate(("monitor_and_cleanup", "cleanup_only"), 801):
        def lifecycle(mode=mode, number=number):
            spec = old.fixture(base, number, "diagnostic-" + mode)
            clock = old.FakeClock()
            backend = old.FakeBackend("ignore_stop", clock, spec)
            guard = old.FakeGuard("ignore_stop", backend)
            class DiagnosticProcess(old.FakeProcess):
                def inspect(self):
                    state = super().inspect()
                    bad = self.inspections > 1 if mode == "monitor_and_cleanup" else self.stop_requested
                    if bad:
                        state.update(ownership_verified=False, errors=copy.deepcopy(valid["errors"]))
                    return state
            original_launch = backend.launch
            def launch(*args):
                process = original_launch(*args)
                process.__class__ = DiagnosticProcess
                return process
            backend.launch = launch
            value = core.supervise(spec, backend, guard, clock)
            require(value["status"] == "ABORTED" and value["cleanup"] == "CLEANUP_UNKNOWN", "Unsafe diagnostic state promoted")
            failures = value.get("ownership_failures", [])
            require([v["phase"] for v in failures] == (["monitor", "cleanup"] if mode == "monitor_and_cleanup" else ["cleanup"]), "Phase retention wrong")
            require(all(v["observation"]["backend_errors"] == [dict(code="OWNED_PROCESS_LEFT_JOB", winerror=5)] for v in failures), "Bounded backend code lost")
            require("terminate_owned" not in backend.calls, "Unknown ownership caused termination")
            require(value["supervisor_lock"] == "PRESERVED_CLEANUP_UNKNOWN", "Uncertain lock removed")
            require("output" not in value, "Possibly live evidence parsed")
            saved = json.loads((Path(spec["attempt_dir"]) / "process-result.json").read_text(encoding="utf-8"))
            require(saved == value, "Persisted diagnostic result differs")
            return dict(result=value, backend_calls=backend.calls)
        check("diagnostic_supervisor_" + mode, lifecycle)
    return outcomes


def job_inventory_cases():
    from observer_supervisor_windows import _WinAPI, BackendError
    outcomes = []
    for name, assigned, count, expected in (("complete_empty", 0, 0, True), ("complete_one", 1, 1, True),
                                            ("assigned_exceeds_returned", 2, 1, False), ("returned_exceeds_assigned", 1, 2, False)):
        api = _WinAPI.__new__(_WinAPI)
        def query(job, info_class, raw, size, returned):
            data = raw._obj
            data.assigned, data.count = assigned, count
            for n in range(count):
                data.ids[n] = 1234 + n
            return True
        api.k = SimpleNamespace(QueryInformationJobObject=query)
        item = dict(name="job_inventory_" + name, classification="MOCK_ONLY_JOB_INVENTORY")
        try:
            item["result"] = api.job_ids("fake_job", 33)
            item["passed"] = expected
        except BackendError as exc:
            item.update(caught=exc.record(), passed=not expected and exc.code == "JOB_INCOMPLETE_PID_LIST")
        outcomes.append(item)
    return outcomes


def image_query_race_cases():
    """Exercise actual ctypes wrapper logic with a fake kernel32 function table."""
    from observer_supervisor_windows import _WinAPI, BackendError, WAIT_TIMEOUT, WAIT_OBJECT_0, WAIT_FAILED
    modes = ("normal_image", "initially_exited", "exit_during_bounded_wait", "still_live_timeout",
             "bounded_wait_error", "missing_expected", "expected_pid_mismatch", "expected_creation_mismatch",
             "refreshed_pid_mismatch", "refreshed_creation_mismatch", "refreshed_pid_failure", "refreshed_times_failure")
    outcomes = []
    for mode in modes:
        calls, waits = [], []
        creation = 133000000000000001
        expected = dict(pid=1234, created=str(creation), exe=sys.executable)
        if mode == "missing_expected":
            expected = None
        elif mode == "expected_pid_mismatch":
            expected["pid"] = 2222
        elif mode == "expected_creation_mismatch":
            expected["created"] = str(creation + 1)
        class Kernel:
            def GetProcessId(self, handle):
                require(handle == "retained_handle", "PID query reopened or changed process handle")
                calls.append("GetProcessId")
                second = calls.count("GetProcessId") > 1
                if second and mode == "refreshed_pid_failure":
                    ctypes.set_last_error(6)
                    return 0
                return 2222 if second and mode == "refreshed_pid_mismatch" else 1234
            def GetProcessTimes(self, handle, created, exited, kernel, user):
                require(handle == "retained_handle", "Creation query changed handle")
                calls.append("GetProcessTimes")
                second = calls.count("GetProcessTimes") > 1
                if second and mode == "refreshed_times_failure":
                    ctypes.set_last_error(6)
                    return False
                value = creation + 1 if second and mode == "refreshed_creation_mismatch" else creation
                created._obj.high, created._obj.low = value >> 32, value & 0xffffffff
                return True
            def WaitForSingleObject(self, handle, timeout):
                require(handle == "retained_handle", "Wait changed retained handle")
                calls.append("WaitForSingleObject")
                waits.append(timeout)
                if len(waits) == 1:
                    return WAIT_OBJECT_0 if mode == "initially_exited" else WAIT_TIMEOUT
                if mode == "still_live_timeout":
                    return WAIT_TIMEOUT
                if mode == "bounded_wait_error":
                    ctypes.set_last_error(6)
                    return WAIT_FAILED
                return WAIT_OBJECT_0
            def QueryFullProcessImageNameW(self, handle, flags, path, size):
                require(handle == "retained_handle", "Image query changed retained handle")
                calls.append("QueryFullProcessImageNameW")
                if mode == "normal_image":
                    path.value = sys.executable
                    size._obj.value = len(sys.executable)
                    return True
                ctypes.set_last_error(5)
                return False
            def GetExitCodeProcess(self, handle, code):
                require(handle == "retained_handle", "Exit query changed retained handle")
                calls.append("GetExitCodeProcess")
                code._obj.value = 259 if mode == "normal_image" else 0
                return True
        api = _WinAPI.__new__(_WinAPI)
        api.k = Kernel()
        item = dict(name="image_query_" + mode, classification="MOCK_ONLY_ACTUAL_WINAPI_IDENTITY_BRANCH")
        expected_success = mode in ("normal_image", "initially_exited", "exit_during_bounded_wait")
        try:
            value = api.identity("retained_handle", expected)
            item["result"] = value
            require(expected_success, "Image query failure wrongly accepted")
            if mode != "normal_image":
                require(value["alive"] is False and value["image_identity_source"] == "RETAINED_IDENTITY_AFTER_EXIT",
                        "Retained path used without confirmed exit")
                require(calls.count("GetProcessId") == 2 and calls.count("GetProcessTimes") == 2,
                        "Confirmed-exit fallback lacks fresh identity check")
            item["passed"] = True
        except BackendError as exc:
            item["caught"] = exc.record()
            expected_code = ("RETAINED_IDENTITY_CHANGED" if mode in ("refreshed_pid_mismatch", "refreshed_creation_mismatch")
                             else "PROCESS_ID_FAILED" if mode == "refreshed_pid_failure"
                             else "PROCESS_TIMES_FAILED" if mode == "refreshed_times_failure"
                             else "PROCESS_IMAGE_FAILED")
            item["passed"] = not expected_success and exc.code == expected_code
            if expected_code == "PROCESS_IMAGE_FAILED":
                item["passed"] = item["passed"] and exc.winerror == 5
        except AssertionError as exc:
            item.update(passed=False, failure=str(exc))
        item.update(calls=calls, wait_milliseconds=waits)
        if calls.count("QueryFullProcessImageNameW") != 1 or sum(waits) > 50 or len([v for v in waits if v > 0]) > 1:
            item.update(passed=False, failure="Image retry or positive wait exceeded bound")
        if mode in ("missing_expected", "expected_pid_mismatch", "expected_creation_mismatch", "normal_image") and any(waits):
            item.update(passed=False, failure="Wait without matching retained identity/image failure")
        if mode == "exit_during_bounded_wait" and waits != [0, 50]:
            item.update(passed=False, failure="Expected one bounded50ms wait on the same handle")
        outcomes.append(item)
    return outcomes


def historical_fake_names():
    tree = ast.parse((SCRIPTS / "Review-ObserverSupervisor.py").read_text(encoding="utf-8"))
    function = next(node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name == "main")
    assignment = next(node for node in function.body if isinstance(node, ast.Assign)
                      and any(isinstance(target, ast.Name) and target.id == "names" for target in node.targets))
    result = ast.literal_eval(assignment.value)
    require(isinstance(result, list) and len(result) == 58 and all(isinstance(v, str) for v in result), "Historical case list changed")
    return result


def query_known_absence(expected):
    """No process control: exact recorded IDs only, query/synchronize rights."""
    from observer_supervisor_windows import _WinAPI, PROCESS_QUERY_LIMITED_INFORMATION, SYNCHRONIZE
    api = _WinAPI()
    started = datetime.datetime.now(datetime.timezone.utc).isoformat()
    snapshot = api.snapshot()
    queries = []
    for identity in expected:
        pid = identity["pid"]
        item = dict(expected_identity=identity, present_in_toolhelp=pid in snapshot)
        handle = api.k.OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION | SYNCHRONIZE, False, pid)
        try:
            if handle:
                item.update(status="HANDLE_OBTAINED_REFUSE", identity=api.identity(handle))
            else:
                code = ctypes.get_last_error()
                item.update(status="NOT_OPENABLE", winerror=code)
        finally:
            api.close(handle)
        queries.append(item)
    absent = all(not item["present_in_toolhelp"] and item["status"] == "NOT_OPENABLE" and item["winerror"] == 87 for item in queries)
    return dict(classification="READ_ONLY_EXACT_PID_CHECK", started_at=started,
                ended_at=datetime.datetime.now(datetime.timezone.utc).isoformat(),
                status="RECORDED_PIDS_ABSENT" if absent else "ABSENCE_NOT_VERIFIED", queries=queries,
                termination_attempt="NOT_PERFORMED", unrelated_process_names_saved=False)


def targeted_child_hold(base):
    from observer_supervisor_windows import WinBackend
    expected = []
    for assessment_path in (ASSESSMENT, REPAIR_ASSESSMENT):
        expected.extend(entry["expected_identity"] for entry in json.loads(assessment_path.read_text(encoding="utf-8"))["recorded_identity_queries"])
    require(len(expected) == 8 and len(set(item["pid"] for item in expected)) == 8, "Known failed-run identity inventory changed")
    absence = query_known_absence(expected)
    (base / "prior-known-process-absence.json").write_text(json.dumps(absence, indent=2) + "\n", encoding="utf-8")
    require(absence["status"] == "RECORDED_PIDS_ABSENT", "Previous recorded process absence unverified; no launch")
    core = old.module("repair_targeted")
    spec = old.fixture(base, 901, "repair-windows-child_hold")
    spec["control"] = dict(mode="child_hold")
    spec["test_limits"] = dict(deadline=2.0, grace=1.0, logs=256*1024)
    backend = WinBackend(str(ROOT), allowed_argvs=(spec["argv"],))
    conflicts = backend.conflicts()
    actual_resources = backend.sample()
    actual_admission = {key: actual_resources[key] >= minimum for key, minimum in core.ADMISSION.items()}
    actual_floors = {key: actual_resources[key] >= minimum for key, minimum in core.FLOORS.items()}
    actual_receipt = dict(classification="OBSERVED_REAL_RESOURCES_BEFORE_SYNTHETIC_TEST", sample=actual_resources,
                         native_admission=actual_admission, running_floors=actual_floors,
                         editor_game_conflicts=conflicts,
                         synthetic_resource_injection="MOCK_ONLY; never native admission evidence")
    (base / "actual-resource-check.json").write_text(json.dumps(actual_receipt, indent=2) + "\n", encoding="utf-8")
    require(all(actual_floors.values()), "Actual running-resource floors failed; no synthetic launch")
    require(not conflicts, "Editor/game conflict found; no synthetic launch")
    backend.sample = lambda: dict(physical_available=8*old.GIB, commit_available=8*old.GIB, disk_free=12*old.GIB,
                                  sampled_monotonic=time.monotonic(), sample_duration=0.0)
    result = core.supervise(spec, backend, core.SyntheticFileGuard(spec["attempt_dir"]))
    outcome = dict(name="repair_windows_child_hold", classification="REAL_SYNTHETIC_PROCESS_WITH_MOCK_RESOURCES",
                   result=result, fixture_parent=spec["evidence_parent"], prior_absence=absence, actual_resources=actual_receipt)
    try:
        require(result["launched"], "Targeted synthetic process not launched")
        require(result["cleanup"].startswith("VERIFIED"), "Targeted cleanup unverified; stop all further launches")
        require(result["status"].startswith("ABORTED") and result["native_lookup"] == "NOT_PERFORMED", "Disposition promoted")
        saved = Path(spec["attempt_dir"]) / "process-result.json"
        require(json.loads(saved.read_text(encoding="utf-8")) == result, "Saved result stale")
        outcome["passed"] = True
    except AssertionError as exc:
        outcome.update(passed=False, failure=str(exc))
    return outcome


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--mode", choices=("mock-only", "targeted-child-hold", "full-validation"), default="mock-only")
    parser.add_argument("--release-note", default="No real synthetic release; mock-only")
    parser.add_argument("--prior-targeted-receipt")
    args = parser.parse_args()
    require("unreal" not in sys.modules, "Native helper must not be imported")
    original_before, before = original_pins(), source_pins()
    if args.mode == "full-validation":
        require(args.prior_targeted_receipt, "A stable passing targeted repair receipt is required")
        prior = json.loads(Path(args.prior_targeted_receipt).read_text(encoding="utf-8"))
        require(prior["mode"] == "targeted-child-hold" and prior["status"] == "PASS_REPAIR_SYNTHETIC_ONLY"
                and prior["files_after"] == before, "Targeted receipt failed or source pins changed")
    stamp = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    base = ROOT / "research/evidence/editor-source" / ("observer-supervisor-review-repair-" + stamp + "-" + uuid.uuid4().hex[:10])
    base.mkdir()
    outcomes = []
    if args.mode == "targeted-child-hold":
        outcomes = [targeted_child_hold(base)]
    else:
        outcomes = ownership_race_cases() + job_inventory_cases() + image_query_race_cases() + diagnostic_cases(base)
        if args.mode == "full-validation":
            outcomes += old.pure_cases(base)
            outcomes += [old.fake_case(base, index, name) for index, name in enumerate(historical_fake_names(), 1)]
            outcomes += old.evidence_cases(base) + old.backend_race_cases()
            if all(item["passed"] for item in outcomes):
                outcomes.extend(old.windows_cases(base))
    after, original_after = source_pins(), original_pins()
    passed = sum(item["passed"] for item in outcomes)
    stable = before == after and original_before == original_after
    status = ("PASS_REPAIR_MOCK_ONLY" if args.mode == "mock-only" else "PASS_REPAIR_SYNTHETIC_ONLY") if passed == len(outcomes) and stable else "FAIL_OR_CHANGED_REPAIR_REVIEW"
    receipt = dict(schema_version=1, mode=args.mode, status=status, runtime=sys.version, coordination_release=args.release_note,
                   reviewed_at=datetime.datetime.now(datetime.timezone.utc).isoformat(),
                   editor_game_launch="NOT_PERFORMED", existing_helper_execution="NOT_PERFORMED",
                   original_failed_result="129/130 FAILED; unchanged", original_files_before=original_before,
                   original_files_after=original_after, files_before=before, files_after=after,
                   fixtures=str(base), cases=outcomes, cases_passed=passed, cases_failed=len(outcomes)-passed,
                   limits=["Original failure reason remains UNKNOWN; mock races do not establish its cause.",
                           "Real synthetic modes use MOCK healthy resources; native admission gates remain unchanged.",
                           "No editor/game/helper launch, native UI proof, or automatic retry on unverified cleanup."])
    serialized = json.dumps(receipt, indent=2, allow_nan=False) + "\n"
    (base / "repair-review-receipt.json").write_text(serialized, encoding="utf-8")
    RECEIPT.write_text(serialized, encoding="utf-8")
    print(json.dumps(dict(status=status, passed=passed, failed=len(outcomes)-passed, sources_and_history_unchanged=stable,
                         fixtures=str(base), failures=[dict(name=item["name"], failure=item.get("failure")) for item in outcomes if not item["passed"]]), indent=2))
    return 0 if status.startswith("PASS_") else 1


if __name__ == "__main__":
    sys.exit(main())
