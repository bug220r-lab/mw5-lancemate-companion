"""Independent supervisor adversarial review. Never launches MW5 or Unreal.

Core cases use synthetic files, a fake clock/process/backend and an explicitly
mocked attribution boundary. Optional Windows cases launch only the reviewed
project fixture through the adapter's exact argv allowlist and retained handles.
"""
import argparse
import copy
import datetime
import hashlib
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
CORE_PATH = SCRIPTS / "observer_supervisor.py"
RECEIPT = ROOT / "research/OBSERVER_SUPERVISOR_REVIEW.json"
GIB, MIB = 1024**3, 1024**2


def require(value, message):
    if not value:
        raise AssertionError(message)


def pin(path, **extra):
    path = Path(path)
    return dict(path=str(path), bytes=path.stat().st_size,
                sha256=hashlib.sha256(path.read_bytes()).hexdigest(), **extra)


def module(index):
    spec = importlib.util.spec_from_file_location("supervisor_independent_%s" % index, CORE_PATH)
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


class FakeClock:
    def __init__(self):
        self.now = 1000.0
    def monotonic(self):
        return self.now
    def time(self):
        return 1800000000.0 + self.now
    def sleep(self, seconds):
        require(0 <= seconds <= 1.0, "Unexpected/unbounded sleep")
        self.now += seconds


class FakeProcess:
    def __init__(self, backend, argv):
        self.backend, self.argv = backend, argv
        self.started = backend.clock.now
        self.alive, self.closed, self.terminated = True, False, False
        self.stop_requested = False
        self.inspections = 0
    def inspect(self):
        self.inspections += 1
        name = self.backend.name
        age = self.backend.clock.now - self.started
        if self.stop_requested and name not in ("ignore_stop", "cleanup_unknown", "grace_bound"):
            self.alive = False
        if name not in ("wait_stop", "ignore_stop", "cleanup_unknown", "grace_bound", "pid_reuse", "ownership_lost", "unknown_child", "human_changed",
                        "runtime_ram", "runtime_commit", "runtime_disk", "runtime_stale", "log_flood", "timeline_cap",
                        "output_ambiguous", "helper_cap", "monitor_exception", "monitor_overrun", "user_stop") and age >= 0.25:
            self.alive = False
        created = "133000000000000001"
        if name == "pid_reuse" and self.inspections > 1:
            created = "133000000000000099"
        descendants = []
        if name == "unknown_child" and self.inspections > 1:
            descendants = [dict(pid=4567, created="133000000000000020", exe=self.argv[0], parent_pid=9999,
                                alive=True, ownership_verified=False)]
        if name == "bad_identity":
            created = True
        return dict(pid=1234, created=created, exe=self.argv[0], argv=self.argv, alive=self.alive,
                    exit_code=None if self.alive else (7 if name == "crash" else 0), descendants=descendants,
                    ownership_verified=not (name == "ownership_lost" and self.inspections > 1), errors=[])
    def terminate_owned(self):
        self.backend.calls.append("terminate_owned")
        self.backend.terminate_time = self.backend.clock.now
        self.terminated = True
        self.alive = False
        if self.backend.name == "cleanup_unknown":
            return dict(status="CLEANUP_UNKNOWN", termination_request_accepted=False, all_exited=False)
        return dict(status="TERMINATED", termination_request_accepted=True, all_exited=True)
    def close(self):
        self.backend.calls.append("close_handles")
        self.closed = True
        if self.backend.name == "close_failure":
            raise RuntimeError("synthetic handle close failure")


class FakeBackend:
    native_capable = False
    def __init__(self, name, clock, spec):
        self.name, self.clock, self.spec = name, clock, spec
        self.calls, self.samples, self.conflict_calls, self.process = [], 0, 0, None
    def sample(self):
        self.samples += 1
        self.clock.now += 0.005
        stamp = self.clock.now
        value = dict(physical_available=8*GIB, commit_available=8*GIB, disk_free=12*GIB,
                     sampled_monotonic=stamp, sample_duration=0.005)
        if self.name == "sample_future":
            value["sampled_monotonic"] += 0.001
        elif self.name == "sample_stale" or (self.name == "runtime_stale" and self.process):
            value["sampled_monotonic"] -= 2.001
        elif self.name == "sample_repeat" and self.samples == 2:
            value["sampled_monotonic"] = self.first_stamp
        elif self.name == "sample_nan":
            value["physical_available"] = float("nan")
        elif self.name == "sample_bool":
            value["disk_free"] = True
        elif self.name == "sample_missing":
            del value["commit_available"]
        elif self.name == "sample_negative":
            value["physical_available"] = -1
        elif self.name == "sample_infinite":
            value["commit_available"] = float("inf")
        elif self.name == "sample_timeout":
            self.clock.now += 2.001
        elif self.name in ("admit_ram", "admit_commit", "admit_disk"):
            key = {"admit_ram": "physical_available", "admit_commit": "commit_available", "admit_disk": "disk_free"}[self.name]
            value[key] -= 1
        elif self.name in ("runtime_ram", "runtime_commit", "runtime_disk") and self.process:
            key = {"runtime_ram": "physical_available", "runtime_commit": "commit_available", "runtime_disk": "disk_free"}[self.name]
            value[key] = (10*GIB if key == "disk_free" else 2*GIB) - 1
        elif self.name == "monitor_exception" and self.process:
            raise RuntimeError("synthetic sampling failure")
        elif self.name == "monitor_overrun" and self.process:
            self.clock.now += 0.251
        if self.name == "pin_drift_admission" and self.samples == 2:
            Path(self.spec["pins"][0]["path"]).write_bytes(b"changed during admission")
        if self.samples == 1:
            self.first_stamp = value.get("sampled_monotonic")
        return value
    def conflicts(self):
        self.conflict_calls += 1
        self.calls.append("conflicts")
        if self.name == "existing_process" or (self.name == "conflict_drift" and self.conflict_calls >= 2):
            return [dict(pid=991, created="existing", exe="SYNTHETIC-CONFLICT")]
        return []
    def launch(self, argv, cwd, stdout_path, stderr_path):
        self.calls.append("launch")
        require(argv == self.spec["argv"] and cwd == self.spec["cwd"], "Launch arguments changed")
        if self.name == "launch_exception":
            raise RuntimeError("synthetic launch refused before creation")
        self.process = FakeProcess(self, argv)
        if self.name == "launch_exception_owned":
            error = RuntimeError("synthetic launch error with retained owned handle")
            error.owned_process = self.process
            raise error
        for name in (stdout_path, stderr_path):
            Path(name).write_text("MOCK_ONLY\n", encoding="utf-8")
        attempt = Path(self.spec["attempt_dir"])
        if self.name == "log_flood":
            Path(stdout_path).write_bytes(b"X" * 8193)
        if self.name == "user_stop":
            (attempt / "STOP").write_text("synthetic user stop", encoding="ascii")
        if self.name == "pin_drift_after_launch":
            Path(self.spec["pins"][0]["path"]).write_bytes(b"changed after launch")
        if self.name == "lock_replaced":
            (Path(self.spec["evidence_parent"]) / ".observer-supervisor.lock").write_bytes(b"foreign-replacement")
        if self.name == "output_ambiguous":
            for token in ("123456789abc", "abcdef123456"):
                (Path(self.spec["evidence_parent"]) / ("observer-references-20260922T235959Z-" + token)).mkdir()
        if self.name == "helper_cap":
            output = Path(self.spec["evidence_parent"]) / "observer-references-20260922T235959Z-123456789abc"
            output.mkdir()
            (output / "report.json").write_bytes(b" " * 1025)
        return self.process


class FakeGuard:
    native_capable = False
    def __init__(self, name, backend):
        self.name, self.backend = name, backend
    def preflight(self):
        return dict(supported=self.name != "no_ui", safe=self.name != "unsafe_ui",
                    no_human_editing=self.name != "human_editing", normal_close_supported=self.name != "no_close")
    def check(self, process):
        value = self.preflight()
        if self.name == "human_changed":
            value["no_human_editing"] = False
        return value
    def request_normal_close(self, process):
        self.backend.calls.append("normal_close")
        self.backend.stop_time = self.backend.clock.now
        process.stop_requested = True
        return dict(status="SYNTHETIC_NORMAL_CLOSE")


def fixture(base, index, name):
    parent = base / ("case-%03d-%s" % (index, name))
    parent.mkdir()
    inputs = parent / "inputs"
    inputs.mkdir()
    paths = []
    for number in range(5):
        path = inputs / ("synthetic-%d.txt" % number)
        path.write_text("MOCK_ONLY fixture %d" % number, encoding="ascii")
        paths.append(path)
    attempt = parent / "attempt"
    argv = [sys.executable, "-B", str(SCRIPTS / "fixtures/observer-supervisor-child.py"), "--control", str(attempt / "child-control.json")]
    packages = ("/Game/Objects/_common/MW5PlayerController", "/Game/Modes/InstantAction/InstantActionPlayerController",
                "/Game/Objects/_common/Components/PlayerControllerComponents/PlayerControllerComponentDataAsset")
    return dict(mode="SYNTHETIC", evidence_parent=str(parent), attempt_dir=str(attempt), argv=argv,
                cwd=str(ROOT), pins=[pin(p) for p in paths] + [pin(sys.executable), pin(argv[2])],
                baseline_copies=[dict(source=str(paths[0]), destination="baseline/settings.ini")],
                helper_pin=pin(paths[1]), targets=[pin(paths[n], package=packages[n-2]) for n in (2, 3, 4)],
                options=dict(include_soft_package_references=True, include_hard_package_references=True,
                             include_searchable_names=False, include_soft_management_references=False,
                             include_hard_management_references=False), control=dict(mode="success"),
                test_limits=dict(deadline=0.75, grace=0.5))


def fake_case(base, index, name):
    core = module(index)
    spec = fixture(base, index, name)
    clock = FakeClock()
    backend = FakeBackend(name, clock, spec)
    guard = FakeGuard(name, backend)
    expected_launch = name not in ("no_ui", "unsafe_ui", "human_editing", "no_close", "existing_process", "conflict_drift",
            "sample_future", "sample_stale", "sample_repeat", "sample_nan", "sample_bool", "sample_missing", "sample_negative",
            "sample_infinite", "sample_timeout", "admit_ram", "admit_commit", "admit_disk", "pin_drift_before",
            "pin_drift_admission", "stale_lock", "baseline_cap", "metadata_cap", "baseline_escape", "baseline_unpinned",
            "attempt_exists", "policy_weaken", "resource_override", "reparse_parent", "launch_exception")
    expected_abort = name in ("wait_stop", "ignore_stop", "cleanup_unknown", "grace_bound", "pid_reuse", "ownership_lost", "unknown_child", "human_changed",
            "runtime_ram", "runtime_commit", "runtime_disk", "runtime_stale", "log_flood", "timeline_cap", "output_ambiguous",
            "helper_cap", "monitor_exception", "monitor_overrun", "user_stop", "pin_drift_after_launch", "attribute_exception",
            "close_failure", "bad_identity", "launch_exception_owned")
    if name == "pin_drift_before":
        Path(spec["pins"][0]["path"]).write_bytes(b"preexisting pin drift")
    elif name == "stale_lock":
        (Path(spec["evidence_parent"]) / ".observer-supervisor.lock").write_bytes(b"foreign")
    elif name in ("baseline_cap", "metadata_cap", "timeline_cap"):
        spec["test_limits"][{"baseline_cap": "baseline", "metadata_cap": "metadata", "timeline_cap": "timeline"}[name]] = 1
    elif name == "log_flood":
        spec["test_limits"]["logs"] = 8192
    elif name == "helper_cap":
        spec["test_limits"]["helper"] = 1024
    elif name == "baseline_escape":
        spec["baseline_copies"][0]["destination"] = "../escape.ini"
    elif name == "baseline_unpinned":
        spec["pins"] = spec["pins"][1:]
    elif name == "attempt_exists":
        Path(spec["attempt_dir"]).mkdir()
    elif name == "policy_weaken":
        spec["test_limits"]["deadline"] = 301
    elif name == "resource_override":
        spec["test_limits"]["physical_available"] = 1
    elif name == "control_scope_override":
        spec["control"] = {"mode": "success", "classification": "EDITOR_METADATA_ONLY", "attempt_dir": "outside-scope"}
    attribute_calls = []
    def mocked_attribute(*args, **kwargs):
        attribute_calls.append("MOCK_ONLY_ATTRIBUTION_BOUNDARY")
        if name == "attribute_exception":
            raise core.SupervisorError("AMBIGUOUS_RECEIPT")
        return dict(classification="MOCK_ONLY", status="MOCK_ONLY_ATTRIBUTED", completed=True)
    core.attribute = mocked_attribute
    old_lstat = Path.lstat
    if name == "reparse_parent":
        def fake_lstat(path):
            original = old_lstat(path)
            if str(path) == spec["evidence_parent"]:
                class ReparseStat:
                    st_file_attributes = 0x400
                    def __getattr__(self, field):
                        return getattr(original, field)
                return ReparseStat()
            return original
        Path.lstat = fake_lstat
    try:
        result = core.supervise(spec, backend, guard, clock)
    finally:
        Path.lstat = old_lstat
    outcome = dict(name=name, classification="MOCK_ONLY_CORE", result=result, backend_calls=backend.calls,
                   attribute_boundary=attribute_calls, fixture_parent=spec["evidence_parent"])
    try:
        require(result["launched"] is expected_launch, "Unexpected launch disposition")
        if not expected_launch:
            require("normal_close" not in backend.calls and "terminate_owned" not in backend.calls,
                    "Refusal touched process cleanup")
        if expected_abort:
            require(result["status"].startswith("ABORTED"), "Unsafe run was not aborted")
        if name == "success":
            require(result["status"] == "SYNTHETIC_RUN_VALIDATED" and result["cleanup"] == "VERIFIED_OWNED_JOB_EXIT", "Success mislabeled")
            require(result["resource_recovery"]["status"] == "RUNNING_FLOORS_RECHECK_PASSED"
                    and clock.now - result["resource_recovery"]["sample"]["sampled_monotonic"] <= 2,
                    "Missing fresh post-cleanup floor sample")
            index_data = json.loads((Path(spec["attempt_dir"]) / "artifact-index.json").read_text(encoding="utf-8"))
            require(any(Path(v["path"]).name == "settings.ini" for v in index_data["files"]), "Baseline copy absent from artifact index")
            require(result.get("outer_receipt_complete") is True and "evidence_complete" not in result,
                    "Outer receipt mistaken for whole evidence completion")
        if name == "crash":
            require(result["status"].startswith("ABORTED") and result["exit_code"] == 7, "Nonzero exit promoted")
        if name in ("pid_reuse", "ownership_lost", "unknown_child", "human_changed", "bad_identity"):
            require("terminate_owned" not in backend.calls, "Unsafe/unknown identity was terminated")
            require(result["cleanup"] == "CLEANUP_UNKNOWN", "Unknown cleanup claimed verified")
        if name == "ignore_stop":
            require("terminate_owned" in backend.calls and result["status"] == "ABORTED", "Timeout escalation failed")
        if name == "cleanup_unknown":
            require(result["cleanup"] == "CLEANUP_UNKNOWN", "Unknown termination response promoted to verified cleanup")
        if name == "grace_bound":
            require(backend.terminate_time - backend.stop_time <= spec["test_limits"]["grace"] + 0.000001,
                    "Cooperative grace exceeded fixed maximum")
        if name in ("runtime_ram", "runtime_commit", "runtime_disk", "runtime_stale"):
            require(result["resource_recovery"]["status"] == "RECOVERY_NOT_VERIFIED", "Low/stale resources claimed recovered")
        if name in ("pid_reuse", "ownership_lost", "unknown_child", "bad_identity", "cleanup_unknown"):
            require(not attribute_calls, "Uncertain cleanup parsed possibly live output")
        if name in ("wait_stop", "ignore_stop", "launch_exception_owned"):
            require(attribute_calls and result["status"].startswith("ABORTED"), "Abort attribution missing or promoted")
        if name == "stale_lock":
            require((Path(spec["evidence_parent"]) / ".observer-supervisor.lock").read_bytes() == b"foreign", "Foreign lock changed")
        if name == "control_scope_override":
            saved_control = json.loads((Path(spec["attempt_dir"]) / "child-control.json").read_text(encoding="utf-8"))
            require(saved_control["classification"] == "MOCK_ONLY" and saved_control["attempt_dir"] == spec["attempt_dir"],
                    "Synthetic control scope escaped")
        if result.get("cleanup", "").startswith("VERIFIED") and name != "lock_replaced":
            require(not (Path(spec["evidence_parent"]) / ".observer-supervisor.lock").exists(), "Owned completed lock leaked")
        if name == "lock_replaced":
            require((Path(spec["evidence_parent"]) / ".observer-supervisor.lock").read_bytes() == b"foreign-replacement",
                    "Foreign replacement lock changed")
            require(result.get("supervisor_lock") == "FOREIGN_LOCK_PRESERVED", "Foreign lock state omitted")
        result_path = Path(spec["attempt_dir"]) / "process-result.json"
        if result_path.exists():
            require(json.loads(result_path.read_text(encoding="utf-8")) == result, "Persisted result is stale")
        require(result["native_lookup"] == "NOT_PERFORMED", "Fake native lookup claimed")
        outcome["passed"] = True
    except AssertionError as exc:
        outcome["passed"], outcome["failure"] = False, str(exc)
    return outcome


def pure_cases(base):
    core = module("policy")
    results = []
    expected_limits = dict(deadline=300.0, grace=30.0, interval=0.25, sample_age=2.0, logs=64*MIB,
                           metadata=4*MIB, timeline=MIB, baseline=4*MIB, helper=1081344, timeline_interval=1.0)
    checks = [("fixed_resource_gates", core.ADMISSION == dict(physical_available=8*GIB, commit_available=8*GIB, disk_free=12*GIB)
               and core.FLOORS == dict(physical_available=2*GIB, commit_available=2*GIB, disk_free=10*GIB)),
              ("fixed_limits", core.LIMITS == expected_limits)]
    for name, passed in checks:
        results.append(dict(name=name, classification="STATIC_POLICY_ASSERTION", passed=passed))
    manifest = json.loads((ROOT / "research/OBSERVER_NORMAL_EDITOR_EXPERIMENT.json").read_text(encoding="utf-8"))
    native = core.native_spec(manifest)
    native["attempt_dir"] = str(core.EVIDENCE / ("observer-normal-startup-refusal-review-" + uuid.uuid4().hex[:8]))
    native["argv"][-1] = "-abslog=" + str(Path(native["attempt_dir"]) / "editor.log")
    clock = FakeClock()
    backend = FakeBackend("native_no_ui", clock, native)
    value = core.supervise(native, backend, core.UnavailableDesktopGuard(), clock)
    results.append(dict(name="native_no_ui_prevents_launch", classification="MOCK_ONLY_REFUSAL", result=value,
                        passed=not value["launched"] and "launch" not in backend.calls
                        and not Path(native["attempt_dir"]).exists()
                        and any("NATIVE_DESKTOP_INTEGRATION_UNAVAILABLE" in e for e in value["errors"])))
    drift_fields = [("admission", "available_ram_bytes"), ("admission", "available_commit_bytes"),
                    ("admission", "free_disk_bytes"), ("admission", "last_sample_maximum_age_ms"),
                    ("stops", "whole_process_deadline_seconds"), ("stops", "maximum_graceful_close_seconds"),
                    ("stops", "observation_interval_ms"), ("stops", "timeline_record_interval_ms"),
                    ("stops", "helper_temporary_lock_bytes"), ("stops", "helper_internal_cooperative_budget_seconds")]
    for section, key in drift_fields:
        changed = copy.deepcopy(manifest)
        changed[section][key] += 1
        caught = None
        try:
            core.native_spec(changed)
        except Exception as exc:
            caught = str(exc)
        results.append(dict(name="manifest_drift_" + key, classification="MOCK_ONLY_POLICY", passed=caught is not None,
                            caught=caught))
    return results


def windows_cases(base):
    from observer_supervisor_windows import WinBackend
    core = module("windows")
    results = []
    for index, mode in enumerate(("success", "wait_stop", "ignore_stop", "crash", "flood", "ambiguous", "loading", "partial", "child_hold"), 101):
        spec = fixture(base, index, "windows-" + mode)
        spec["control"] = dict(mode=mode)
        spec["test_limits"] = dict(deadline=2.0, grace=1.0, logs=256*1024)
        backend = WinBackend(str(ROOT), allowed_argvs=(spec["argv"],))
        # Actual Windows ownership/launch/cleanup with explicitly synthetic healthy resources.
        def healthy():
            import time
            return dict(physical_available=8*GIB, commit_available=8*GIB, disk_free=12*GIB,
                        sampled_monotonic=time.monotonic(), sample_duration=0.0)
        backend.sample = healthy
        result = core.supervise(spec, backend, core.SyntheticFileGuard(spec["attempt_dir"]))
        outcome = dict(name="windows_" + mode, classification="REAL_SYNTHETIC_PROCESS_WITH_MOCK_RESOURCES",
                       result=result, fixture_parent=spec["evidence_parent"])
        try:
            require(result["launched"], "Synthetic process not launched")
            require(result["cleanup"].startswith("VERIFIED"), "Synthetic child cleanup unverified")
            require(result["native_lookup"] == "NOT_PERFORMED", "Native lookup mislabeled")
            require(result["resource_recovery"]["status"] == "RUNNING_FLOORS_RECHECK_PASSED", "Post-cleanup mock floors not sampled")
            if mode == "success":
                require(result["status"] == "SYNTHETIC_RUN_VALIDATED" and result.get("output", {}).get("completed") is True,
                        "Valid synthetic output rejected")
            elif mode in ("loading", "partial"):
                require(result["status"] == "LOOKUP_PARTIAL" and result.get("output", {}).get("completed") is False,
                        "Zero exit partial/loading output promoted or lost")
                require(result["outer_receipt_complete"] is True, "Partial helper result lost outer receipt")
            else:
                require(result["status"].startswith("ABORTED"), "Fault case promoted to success")
            if mode in ("ignore_stop", "flood"):
                require(result["status"] == "ABORTED", "Forced/flood result not aborted")
            saved = Path(spec["attempt_dir"]) / "process-result.json"
            require(saved.exists() and json.loads(saved.read_text(encoding="utf-8")) == result, "Saved Windows result mismatch")
            outcome["passed"] = True
        except AssertionError as exc:
            outcome["passed"], outcome["failure"] = False, str(exc)
        results.append(outcome)
        if not result.get("cleanup", "").startswith("VERIFIED"):
            break  # No more OS launches while any child cleanup is uncertain.
    return results


def evidence_cases(base):
    """Exercise the real parser/attribution boundary using newly authored files."""
    import observer_supervisor_evidence as evidence
    names = ["complete", "partial", "loading", "null_return", "cap_partial", "loading_after", "error_partial",
             "malformed_json", "duplicate_key", "nonfinite_json", "large_integer", "wrong_helper_pin",
             "wrong_source_before", "wrong_source_after", "source_drift_flag", "wrong_options", "wrong_limits",
             "wrong_query_package", "wrong_query_status", "wrong_query_count", "invalid_reference", "query_over_cap",
             "wrong_checkpoint_stage", "wrong_checkpoint_count", "wrong_checkpoint_native", "missing_checkpoint",
             "missing_started", "missing_marker", "duplicate_marker", "wrong_marker_directory", "wrong_marker_status",
             "native_claim", "unexpected_file", "unexpected_directory", "oversized_report", "oversized_started",
             "oversized_checkpoint", "oversized_stop", "multiple_outputs", "no_new_output", "wrong_creation_interval",
             "partial_with_marker", "checkpoint_without_started", "empty_partial", "wrong_input_options",
             "wrong_input_target", "report_reparse", "parent_reparse"]
    expected_codes = {"complete": "MOCK_ONLY_METADATA_COMPLETE", "partial": "PARTIAL_REPORT_ABSENT",
                      "empty_partial": "PARTIAL_REPORT_ABSENT", "loading": "ATTRIBUTED_STOPPED_REGISTRY_LOADING",
                      "null_return": "ATTRIBUTED_PARTIAL_NULL_RETURN", "cap_partial": "ATTRIBUTED_PARTIAL_CAP_REACHED",
                      "loading_after": "ATTRIBUTED_PARTIAL_REGISTRY_LOADING", "error_partial": "ATTRIBUTED_ERROR_EVIDENCE_RETAINED"}
    results = []
    for index, name in enumerate(names, 201):
        spec = fixture(base, index, "evidence-" + name)
        parent = Path(spec["evidence_parent"])
        start = time.time() - 0.05
        stamp = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        output = parent / ("observer-references-" + stamp + "-" + uuid.uuid4().hex[:12])
        output.mkdir()
        report = dict(status="MOCK_ONLY_COMPLETED", classification="MOCK_ONLY", native_execution="NOT_PERFORMED",
                      gameplay="NOT_PERFORMED", asset_load_export_save_compile_cook="NOT_PERFORMED",
                      output_directory=str(output), source_before=copy.deepcopy(spec["targets"]),
                      source_after=copy.deepcopy(spec["targets"]), source_hashes_unchanged=True,
                      script=copy.deepcopy(spec["helper_pin"]), options=copy.deepcopy(spec["options"]),
                      registry_loading_before=False, queries=[], errors=[], total_retained_entries=0, elapsed_seconds=0.02,
                      limits=dict(queries=3, per_target=512, total_entries=1024, name_characters=512,
                                  encoded_name_bytes=768, report_bytes=1048576, cooperative_seconds=60))
        for target in spec["targets"]:
            report["queries"].append(dict(package=target["package"], status="MOCK_ONLY", referencers=[],
                                          returned_count=0, retained_count=0, registry_loading_after=False))
        initial = copy.deepcopy(report)
        initial.update(status="STARTED", source_after=None, queries=[], total_retained_entries=0)
        initial.pop("registry_loading_before")
        initial.pop("source_hashes_unchanged")
        checkpoints = [dict(stage="GET_EXISTING_REGISTRY" if n == 0 else "QUERY " + spec["targets"][n-1]["package"],
                            elapsed_seconds=0.01, completed_query_count=max(0, n-1), native_execution="NOT_PERFORMED")
                       for n in range(4)]
        if name == "loading":
            report.update(status="STOPPED_REGISTRY_LOADING", registry_loading_before=True, queries=[])
            checkpoints = checkpoints[:1]
        elif name == "null_return":
            report.update(status="PARTIAL_NULL_RETURN", queries=[dict(package=spec["targets"][0]["package"],
                          status="NULL_RETURN", referencers=[], registry_loading_after=False)])
            checkpoints = checkpoints[:2]
        elif name == "cap_partial":
            values = ["/Game/Synthetic/Ref%d" % n for n in range(512)]
            report.update(status="PARTIAL_CAP_REACHED", total_retained_entries=512,
                          queries=[dict(package=spec["targets"][0]["package"], status="TRUNCATED_AT_CAP",
                                        referencers=values, retained_count=512, returned_count=513, registry_loading_after=False)])
            checkpoints = checkpoints[:2]
        elif name == "loading_after":
            report.update(status="PARTIAL_REGISTRY_LOADING", queries=report["queries"][:1])
            report["queries"][0]["registry_loading_after"] = True
            checkpoints = checkpoints[:2]
        elif name == "error_partial":
            report.update(status="ERROR_EVIDENCE_RETAINED", queries=[], errors=["Synthetic controlled failure"])
            checkpoints = checkpoints[:1]
        elif name == "wrong_helper_pin":
            report["script"]["sha256"] = "0" * 64
        elif name == "wrong_source_before":
            report["source_before"][0]["sha256"] = "0" * 64
        elif name == "wrong_source_after":
            report["source_after"][0]["sha256"] = "0" * 64
        elif name == "source_drift_flag":
            report["source_hashes_unchanged"] = False
        elif name == "wrong_options":
            report["options"]["include_searchable_names"] = True
        elif name == "wrong_limits":
            report["limits"]["queries"] = 4
        elif name == "wrong_query_package":
            report["queries"][0]["package"] = "/Game/Wrong"
        elif name == "wrong_query_status":
            report["queries"][0]["status"] = "OBSERVED_PACKAGE_REFERENCES"
        elif name == "wrong_query_count":
            report["queries"][0]["returned_count"] = 1
        elif name == "invalid_reference":
            report["queries"][0].update(referencers=["/Game//Invalid"], returned_count=1, retained_count=1)
            report["total_retained_entries"] = 1
        elif name == "query_over_cap":
            report["queries"][0].update(referencers=["/Game/X"] * 513, returned_count=513, retained_count=513)
            report["total_retained_entries"] = 513
        elif name == "wrong_checkpoint_stage":
            checkpoints[1]["stage"] = "QUERY /Game/Wrong"
        elif name == "wrong_checkpoint_count":
            checkpoints[2]["completed_query_count"] = 2
        elif name == "wrong_checkpoint_native":
            checkpoints[0]["native_execution"] = "ATTEMPTED"
        elif name == "native_claim":
            report["native_execution"] = "ATTEMPTED"
        if name not in ("missing_started", "checkpoint_without_started", "empty_partial"):
            (output / "started.json").write_text(json.dumps(initial), encoding="utf-8")
        if name != "empty_partial":
            for n, checkpoint in enumerate(checkpoints):
                if name == "missing_checkpoint" and n == 1:
                    continue
                (output / ("checkpoint-%02d.json" % n)).write_text(json.dumps(checkpoint), encoding="utf-8")
        if name not in ("partial", "partial_with_marker", "checkpoint_without_started", "empty_partial"):
            (output / "report.json").write_text(json.dumps(report), encoding="utf-8")
        marker = "Observer reference lookup: %s | %s\n" % (report["status"], output)
        if name in ("missing_marker", "partial", "checkpoint_without_started", "empty_partial"):
            marker = "Synthetic output only\n"
        elif name == "duplicate_marker":
            marker += marker
        elif name == "wrong_marker_directory":
            marker = marker.replace(str(output), str(parent))
        elif name == "wrong_marker_status":
            marker = marker.replace(report["status"], "STOPPED_REGISTRY_LOADING")
        log = parent / "synthetic.log"
        log.write_text(marker, encoding="utf-8")
        raw_changes = {"malformed_json": "{", "duplicate_key": '{"status":0,"status":1}',
                       "nonfinite_json": '{"elapsed_seconds":1e999}', "large_integer": '{"x":' + "9"*65 + '}'}
        if name in raw_changes:
            (output / "report.json").write_text(raw_changes[name], encoding="utf-8")
        oversize = {"oversized_report": ("report.json", 1048577), "oversized_started": ("started.json", 16385),
                    "oversized_checkpoint": ("checkpoint-00.json", 4097), "oversized_stop": ("STOP", 4097)}
        if name in oversize:
            filename, count = oversize[name]
            (output / filename).write_bytes(b" " * count)
        if name == "unexpected_file":
            (output / "unexpected.txt").write_bytes(b"MOCK_ONLY")
        elif name == "unexpected_directory":
            (output / "nested").mkdir()
        elif name == "multiple_outputs":
            (parent / ("observer-references-" + stamp + "-" + uuid.uuid4().hex[:12])).mkdir()
        if name == "wrong_input_options":
            spec["options"]["include_searchable_names"] = True
        elif name == "wrong_input_target":
            spec["targets"][0]["package"] = "/Game/Wrong"
        before = [output.name] if name == "no_new_output" else []
        if name == "wrong_creation_interval":
            start = time.time() + 5
        end = max(time.time() + 0.05, start + 0.05)
        original_lstat = evidence.os.lstat
        if name in ("report_reparse", "parent_reparse"):
            reparse_target = str(output / "report.json") if name == "report_reparse" else str(parent)
            def reparse_lstat(path, *args, **kwargs):
                value = original_lstat(path, *args, **kwargs)
                if os.path.normcase(os.fspath(path)) == os.path.normcase(reparse_target):
                    class ReparseStat:
                        st_file_attributes = 0x400
                        def __getattr__(self, field):
                            return getattr(value, field)
                    return ReparseStat()
                return value
            evidence.os.lstat = reparse_lstat
        outcome = dict(name="evidence_" + name, classification="ACTUAL_EVIDENCE_VALIDATOR_SYNTHETIC_FILES",
                       fixture_parent=str(parent), reparse_metadata="MOCK_ONLY" if "reparse" in name else "NOT_USED")
        try:
            value = evidence.attribute(parent, before, log, start, end, spec["helper_pin"], spec["targets"], spec["options"], native=False)
            outcome["result"] = value
            require(name in expected_codes, "Invalid or ambiguous evidence accepted")
            require(value["code"] == expected_codes[name], "Wrong completion/partial disposition")
            require(value["completed"] is (name == "complete"), "Partial evidence promoted")
            require(value["native_execution"] == "NOT_PERFORMED", "Mock evidence promoted to native")
            outcome["passed"] = True
        except evidence.EvidenceError as exc:
            outcome.update(caught=exc.code, passed=name not in expected_codes)
            if name in expected_codes:
                outcome["failure"] = "Valid synthetic evidence rejected: " + exc.code
        except AssertionError as exc:
            outcome.update(passed=False, failure=str(exc))
        finally:
            evidence.os.lstat = original_lstat
        results.append(outcome)
    return results


def backend_race_cases():
    """Actual ownership adapter logic with simulated Windows API snapshots only."""
    from observer_supervisor_windows import OwnedProcess
    results = []
    for name, job_states in (("normal_exit_late_child", [[], [9876]]),
                              ("cleanup_already_exited_late_child", [[], [], [9876], [], []])):
        calls = []
        root = dict(pid=1234, created="133000000000000001", exe=sys.executable, alive=False, exit_code=0)
        class Api:
            def identity(self, handle, expected=None):
                return dict(root)
            def job_ids(self, job, maximum):
                calls.append("job_ids")
                return job_states.pop(0) if job_states else []
            def snapshot(self):
                return {}
            def close(self, handle):
                calls.append("close_handle")
        api = Api()
        # No native API object and no callable termination method are supplied.
        api.k = SimpleNamespace()
        process = OwnedProcess(api, "fake_job", SimpleNamespace(hProcess="fake_process", hThread="fake_thread", dwProcessId=1234),
                               [sys.executable], 32)
        process._root, process._assigned = dict(root), True
        value = process.inspect() if name.startswith("normal") else process.terminate_owned()
        snapshot = value if name.startswith("normal") else value["snapshot"]
        passed = (snapshot["ownership_verified"] is False
                  and any(e["code"] == "JOB_NOT_EMPTY_AFTER_OBSERVED_EXIT" for e in snapshot["errors"]))
        if not name.startswith("normal"):
            passed = passed and value["status"] == "CLEANUP_UNKNOWN" and value["all_exited"] is False
        results.append(dict(name="backend_" + name, classification="MOCK_ONLY_WINDOWS_API_RACE", passed=passed,
                            result=value, calls=calls))
    return results


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--with-windows", action="store_true")
    args = parser.parse_args()
    require("unreal" not in sys.modules, "Unreal must not be imported")
    stamp = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    base = ROOT / "research/evidence/editor-source" / ("observer-supervisor-review-" + stamp + "-" + uuid.uuid4().hex[:10])
    base.mkdir()
    paths = [CORE_PATH, SCRIPTS / "observer_supervisor_evidence.py", SCRIPTS / "observer_supervisor_windows.py",
             SCRIPTS / "fixtures/observer-supervisor-child.py"]
    before = [pin(p) for p in paths if p.exists()]
    names = ["success", "no_ui", "unsafe_ui", "human_editing", "no_close", "existing_process", "conflict_drift",
             "sample_future", "sample_stale", "sample_repeat", "sample_nan", "sample_bool", "sample_missing",
             "sample_negative", "sample_infinite", "sample_timeout", "admit_ram", "admit_commit", "admit_disk",
             "pin_drift_before", "pin_drift_admission", "pin_drift_after_launch", "stale_lock", "baseline_cap",
             "metadata_cap", "timeline_cap", "baseline_escape", "baseline_unpinned", "attempt_exists", "policy_weaken",
             "resource_override", "reparse_parent", "control_scope_override", "wait_stop", "ignore_stop", "cleanup_unknown", "grace_bound", "crash", "pid_reuse",
             "ownership_lost", "unknown_child", "bad_identity", "human_changed", "runtime_ram", "runtime_commit",
             "runtime_disk", "runtime_stale", "log_flood", "helper_cap", "output_ambiguous", "monitor_exception", "monitor_overrun", "user_stop",
             "attribute_exception", "close_failure", "launch_exception", "launch_exception_owned", "lock_replaced"]
    outcomes = pure_cases(base) + [fake_case(base, index, name) for index, name in enumerate(names, 1)]
    outcomes.extend(evidence_cases(base))
    outcomes.extend(backend_race_cases())
    if args.with_windows:
        outcomes.extend(windows_cases(base))
    after = [pin(p) for p in paths if p.exists()]
    passed = sum(v["passed"] for v in outcomes)
    receipt = dict(schema_version=1, reviewed_at=datetime.datetime.now(datetime.timezone.utc).isoformat(),
                   status="PASS_SYNTHETIC_ONLY" if passed == len(outcomes) and before == after else "FAIL_OR_CHANGED_REVIEW",
                   editor_game_launch="NOT_PERFORMED", existing_helper_execution="NOT_PERFORMED", runtime=sys.version,
                   core_fake_cases="MOCK_ONLY; attribution boundary injected explicitly",
                   windows_cases="REAL_SYNTHETIC_PROCESS_WITH_MOCK_RESOURCES" if args.with_windows else "NOT_PERFORMED",
                   files_before=before, files_after=after, fixtures=str(base), review_script=pin(__file__),
                   cases_passed=passed, cases_failed=len(outcomes)-passed, cases=outcomes,
                   limits=["No native editor/UI acceptance or registry lookup proof.",
                           "Mock resources cannot establish real available headroom.",
                           "OS tests stop after any unverified cleanup; no process-name cleanup sweeps."])
    receipt["category_counts"] = {label: dict(total=sum(v["classification"] == label for v in outcomes),
                                             passed=sum(v["classification"] == label and v["passed"] for v in outcomes))
                                  for label in sorted(set(v["classification"] for v in outcomes))}
    serialized = json.dumps(receipt, indent=2, allow_nan=False) + "\n"
    (base / "review-receipt.json").write_text(serialized, encoding="utf-8")
    RECEIPT.write_text(serialized, encoding="utf-8")
    print(json.dumps(dict(status=receipt["status"], passed=passed, failed=len(outcomes)-passed,
                         source_files_unchanged=before == after,
                         failures=[dict(name=v["name"], failure=v.get("failure"), errors=v.get("result", {}).get("errors"))
                                   for v in outcomes if not v["passed"]], receipt=str(RECEIPT)), indent=2))
    return 0 if receipt["status"] == "PASS_SYNTHETIC_ONLY" else 1


if __name__ == "__main__":
    sys.exit(main())
