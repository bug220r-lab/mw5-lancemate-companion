"""Bounded observer process supervision. No editor execution from this CLI.

Native desktop observation/normal-close integration is intentionally unavailable.
The native CLI is read-only preflight. Synthetic tests exercise actual owned child
processes plus injected faults; neither establishes native editor acceptance.
"""
import argparse
import datetime
import json
import math
import os
from pathlib import Path
import re
import time

from observer_supervisor_evidence import stable_hash, bounded_json, inventory, attribute, EvidenceError

ROOT = Path(__file__).resolve().parent.parent
EVIDENCE = ROOT / "research/evidence/editor-source"
HELPER_SHA = "20c460fdf678de74568c477b28c41a65408a5b5c7868bc1bb893d05ceced099b"
GIB, MIB = 1024**3, 1024**2
ADMISSION = dict(physical_available=8*GIB, commit_available=8*GIB, disk_free=12*GIB)
FLOORS = dict(physical_available=2*GIB, commit_available=2*GIB, disk_free=10*GIB)
LIMITS = dict(deadline=300.0, grace=30.0, interval=0.25, sample_age=2.0,
              logs=64*MIB, metadata=4*MIB, timeline=MIB, baseline=4*MIB,
              helper=1081344, timeline_interval=1.0)
LOCKS = (".observer-reference-lookup.lock", ".observer-caller-inspection.lock",
         ".observer-supervisor.lock")


class SupervisorError(Exception):
    pass


class SystemClock:
    monotonic = staticmethod(time.monotonic)
    sleep = staticmethod(time.sleep)
    time = staticmethod(time.time)


class UnavailableDesktopGuard:
    native_capable = False

    def preflight(self):
        return dict(supported=False, safe=False, no_human_editing=False, normal_close_supported=False)

    def check(self, process):
        return self.preflight()

    def request_normal_close(self, process):
        return dict(status="UNSUPPORTED")


class SyntheticFileGuard:
    """Test child STOP protocol only. This is not a native window guard."""
    native_capable = False

    def __init__(self, attempt_dir):
        self.attempt_dir = Path(attempt_dir)

    def preflight(self):
        return dict(supported=True, safe=True, no_human_editing=True, normal_close_supported=True)

    def check(self, process):
        return self.preflight()

    def request_normal_close(self, process):
        marker = self.attempt_dir / "STOP"
        reject_reparse(marker, missing_ok=True)
        try:
            with marker.open("xb") as stream:
                stream.write(b"SYNTHETIC_COOPERATIVE_STOP\n")
        except FileExistsError:
            pass
        return dict(status="SYNTHETIC_STOP_REQUESTED")


def reject_reparse(path, missing_ok=False):
    """Check lexical components before resolve; never traverse a link/junction."""
    path = Path(os.path.abspath(str(path)))
    for part in (list(reversed(path.parents)) + [path]):
        try:
            st = part.lstat()
        except FileNotFoundError:
            if missing_ok:
                continue
            raise SupervisorError("PATH_MISSING")
        if part.is_symlink() or getattr(st, "st_file_attributes", 0) & 0x400:
            raise SupervisorError("REPARSE_PATH")
    return path


def contained(path, parent, missing_ok=False):
    path = reject_reparse(path, missing_ok)
    parent = reject_reparse(parent)
    try:
        path.relative_to(parent)
    except ValueError:
        raise SupervisorError("PATH_OUTSIDE_SCOPE")
    if path == parent:
        raise SupervisorError("PATH_EQUALS_PARENT")
    return path


def number(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def limits_for(spec):
    result = LIMITS.copy()
    for key, value in spec.get("test_limits", {}).items():
        if spec["mode"] != "SYNTHETIC" or key not in ("deadline", "grace", "logs", "metadata", "timeline", "baseline", "helper"):
            raise SupervisorError("POLICY_OVERRIDE_FORBIDDEN")
        if not number(value) or value <= 0 or value > result[key]:
            raise SupervisorError("POLICY_WEAKENING")
        result[key] = value
    return result


def check_guard(guard, process=None):
    state = guard.preflight() if process is None else guard.check(process)
    if not isinstance(state, dict) or any(state.get(k) is not True for k in
            ("supported", "safe", "no_human_editing", "normal_close_supported")):
        raise SupervisorError("DESKTOP_OR_HUMAN_GUARD_UNVERIFIED")
    return state


def resource_sample(backend, clock, thresholds, previous=None):
    start = clock.monotonic()
    sample = backend.sample()
    now = clock.monotonic()
    stamp = sample.get("sampled_monotonic") if isinstance(sample, dict) else None
    if (not number(stamp) or stamp > now or now - stamp > 2.0 or now - start > 2.0
            or (previous is not None and stamp <= previous)):
        raise SupervisorError("RESOURCE_SAMPLE_INVALID_OR_STALE")
    for key, floor in thresholds.items():
        value = sample.get(key)
        if not number(value) or value < 0:
            raise SupervisorError("RESOURCE_SAMPLE_MALFORMED")
        if value < floor:
            raise SupervisorError("RESOURCE_FLOOR_" + key.upper())
    return {k: sample[k] for k in tuple(thresholds) + ("sampled_monotonic",)}


def verify_pins(pins):
    if not isinstance(pins, list) or not 1 <= len(pins) <= 64:
        raise SupervisorError("PIN_LIST_INVALID")
    seen, observed = set(), []
    for pin in pins:
        if not isinstance(pin, dict) or pin.get("path") in seen:
            raise SupervisorError("DUPLICATE_OR_INVALID_PIN")
        seen.add(pin.get("path"))
        actual = stable_hash(pin["path"], 32*MIB)
        if actual["bytes"] != pin["bytes"] or actual["sha256"].lower() != pin["sha256"].lower():
            raise SupervisorError("PIN_DRIFT")
        observed.append(actual)
    return observed


def validate_spec(spec):
    if spec.get("mode") not in ("EDITOR", "SYNTHETIC"):
        raise SupervisorError("MODE_INVALID")
    parent = reject_reparse(spec["evidence_parent"])
    attempt = contained(spec["attempt_dir"], parent, missing_ok=True)
    if attempt.parent != parent or attempt.exists():
        raise SupervisorError("ATTEMPT_NOT_FRESH_DIRECT_CHILD")
    argv = spec.get("argv")
    if not isinstance(argv, list) or not argv or not all(isinstance(x, str) and x and "\0" not in x for x in argv):
        raise SupervisorError("ARGV_INVALID")
    reject_reparse(spec["cwd"])
    if not Path(spec["cwd"]).is_dir():
        raise SupervisorError("WORKING_DIRECTORY_INVALID")
    pinned = {os.path.normcase(os.path.abspath(p["path"])) for p in spec.get("pins", [])}
    if os.path.normcase(os.path.abspath(argv[0])) not in pinned:
        raise SupervisorError("EXECUTABLE_UNPINNED")
    if spec["mode"] == "SYNTHETIC":
        relative = parent.relative_to(EVIDENCE)
        if not relative.parts or not relative.parts[0].startswith("observer-supervisor-review-"):
            raise SupervisorError("SYNTHETIC_SCOPE_REQUIRED")
        expected_script = str(ROOT / "scripts/fixtures/observer-supervisor-child.py")
        if len(argv) != 5 or argv[1] != "-B" or argv[2] != expected_script or argv[3] != "--control" or argv[4] != str(attempt / "child-control.json"):
            raise SupervisorError("SYNTHETIC_ARGV_NOT_ALLOWLISTED")
        if Path(argv[0]).name.lower() not in ("python.exe", "python3.exe"):
            raise SupervisorError("SYNTHETIC_EXECUTABLE_FORBIDDEN")
        if os.path.normcase(expected_script) not in pinned:
            raise SupervisorError("FIXTURE_UNPINNED")
    else:
        if parent != EVIDENCE or not re.fullmatch(r"observer-normal-startup-[a-zA-Z0-9-]+", attempt.name):
            raise SupervisorError("EDITOR_SCOPE_MISMATCH")
        expected = [r"C:\Program Files\Epic Games\MechWarrior5Editor\Engine\Binaries\Win64\UE4Editor-Cmd.exe",
                    r"C:\Program Files\Epic Games\MechWarrior5Editor\MW5Mercs\MW5Mercs.uproject",
                    "-ExecutePythonScript=" + str(ROOT / "scripts/Inspect-ObserverReferences.py"),
                    "-abslog=" + str(attempt / "editor.log")]
        if argv != expected or spec["helper_pin"]["sha256"].lower() != HELPER_SHA:
            raise SupervisorError("EDITOR_COMMAND_OR_HELPER_DRIFT")
    limits_for(spec)
    return parent, attempt


class EvidenceWriter:
    def __init__(self, directory, limits):
        self.directory, self.limits = directory, limits
        self.metadata_bytes, self.timeline_bytes = 0, 0

    def write(self, name, value, final=False):
        raw = (json.dumps(value, indent=2, allow_nan=False) + "\n").encode("utf-8")
        # Reserve half the total allowance for final failure/result/index evidence.
        cap = self.limits["metadata"] if final else self.limits["metadata"] // 2
        if self.metadata_bytes + len(raw) > cap:
            raise SupervisorError("OUTER_METADATA_LIMIT")
        destination = contained(self.directory / name, self.directory, missing_ok=True)
        with destination.open("xb") as stream:
            stream.write(raw)
        self.metadata_bytes += len(raw)

    def tick(self, value):
        raw = (json.dumps(value, allow_nan=False) + "\n").encode("utf-8")
        if self.timeline_bytes + len(raw) > self.limits["timeline"] or self.metadata_bytes + len(raw) > self.limits["metadata"] // 2:
            raise SupervisorError("TIMELINE_LIMIT")
        path = contained(self.directory / "timeline.jsonl", self.directory, missing_ok=True)
        with path.open("ab") as stream:
            stream.write(raw)
        self.timeline_bytes += len(raw)
        self.metadata_bytes += len(raw)


def inspect_owned(process, original=None):
    state = process.inspect()
    if not isinstance(state, dict) or state.get("ownership_verified") is not True:
        raise SupervisorError("OWNERSHIP_UNVERIFIED")
    for key in ("pid", "created", "exe"):
        if not state.get(key) or (original is not None and state[key] != original[key]):
            raise SupervisorError("PROCESS_IDENTITY_CHANGED")
    if (type(state["pid"]) is not int or state["pid"] <= 0 or type(state.get("alive")) is not bool
            or not isinstance(state["created"], str) or not re.fullmatch(r"[0-9]{1,20}", state["created"])
            or not Path(state["exe"]).is_absolute()):
        raise SupervisorError("PROCESS_IDENTITY_MALFORMED")
    children = state.get("descendants")
    if not isinstance(children, list) or len(children) > 32:
        raise SupervisorError("DESCENDANT_INVENTORY_UNVERIFIED")
    if any(not all(child.get(k) for k in ("pid", "created", "exe")) for child in children):
        raise SupervisorError("DESCENDANT_IDENTITY_UNVERIFIED")
    child_pids = set()
    for child in children:
        if (type(child["pid"]) is not int or child["pid"] <= 0 or child["pid"] in child_pids
                or child["pid"] == state["pid"] or type(child.get("alive")) is not bool
                or type(child.get("parent_pid")) is not int or child["parent_pid"] <= 0):
            raise SupervisorError("DESCENDANT_LINEAGE_UNVERIFIED")
        child_pids.add(child["pid"])
    previous_pids = {c["pid"] for c in original["descendants"]} if original else set()
    if any(c["parent_pid"] not in {state["pid"]} | child_pids | previous_pids for c in children):
        raise SupervisorError("DESCENDANT_PARENT_NOT_OWNED")
    if original is not None:
        old = {c["pid"]: c for c in original["descendants"]}
        for child in children:
            if child["pid"] in old and any(child[k] != old[child["pid"]][k] for k in ("created", "exe", "parent_pid")):
                raise SupervisorError("DESCENDANT_IDENTITY_CHANGED")
    return state


def supervised_sizes(attempt, parent, before_names, limits):
    logs = 0
    for name in ("editor.log", "stdout.log", "stderr.log"):
        path = reject_reparse(attempt / name, missing_ok=True)
        if path.exists():
            logs += path.stat().st_size
    if logs > limits["logs"]:
        raise SupervisorError("OWNED_LOG_LIMIT")
    current = inventory(parent)
    new = set(current) - set(before_names)
    if len(new) > 1:
        raise SupervisorError("AMBIGUOUS_NEW_OUTPUT")
    helper_bytes = 0
    for name in new:
        folder = contained(parent / name, parent)
        entries = list(folder.iterdir())
        if len(entries) > 7:
            raise SupervisorError("HELPER_OUTPUT_FILE_COUNT")
        for path in entries:
            reject_reparse(path)
            if not path.is_file():
                raise SupervisorError("HELPER_OUTPUT_UNEXPECTED_DIRECTORY")
            if path.suffix.lower() == ".json":
                helper_bytes += path.stat().st_size
            elif path.name != "STOP":
                raise SupervisorError("HELPER_OUTPUT_UNEXPECTED_FILE")
    if helper_bytes > limits["helper"]:
        raise SupervisorError("HELPER_OUTPUT_LIMIT")
    return dict(owned_log_bytes=logs, helper_json_bytes=helper_bytes, new_directories=sorted(new))


def supervise(spec, backend, guard, clock=None):
    """Returns evidence; native execution stays disabled without supported UI/OS capability."""
    clock = clock or SystemClock()
    result = dict(status="REFUSED", classification="SYNTHETIC_PROCESS_SUPERVISION" if spec.get("mode") == "SYNTHETIC" else "EDITOR_SUPERVISION",
                  native_lookup="NOT_PERFORMED", launched=False, cleanup="NOT_NEEDED", errors=[])
    process, original, writer, lock, token, parent, attempt = None, None, None, None, None, None, None
    started, started_utc = None, None
    before_names, limits = [], LIMITS.copy()
    baseline_files, attribution_attempted = [], False
    try:
        parent, attempt = validate_spec(spec)
        limits = limits_for(spec)
        if spec["mode"] == "EDITOR" and (not getattr(guard, "native_capable", False) or not getattr(backend, "native_capable", False)):
            raise SupervisorError("NATIVE_DESKTOP_INTEGRATION_UNAVAILABLE")
        check_guard(guard)
        if backend.conflicts():
            raise SupervisorError("EXISTING_EDITOR_OR_GAME")
        if any((parent / name).exists() for name in LOCKS):
            raise SupervisorError("PREEXISTING_INSPECTION_LOCK")
        pins = verify_pins(spec["pins"])
        before_names = list(inventory(parent))
        first = resource_sample(backend, clock, ADMISSION)
        first_received = clock.monotonic()
        clock.sleep(1.0)
        second = resource_sample(backend, clock, ADMISSION, first["sampled_monotonic"])
        if second["sampled_monotonic"] - first["sampled_monotonic"] < 1.0 or clock.monotonic() - first_received < 1.0:
            raise SupervisorError("ADMISSION_SAMPLES_TOO_CLOSE")
        check_guard(guard)
        if backend.conflicts() or any((parent / name).exists() for name in LOCKS):
            raise SupervisorError("PREFLIGHT_CONFLICT_DRIFT")
        verify_pins(spec["pins"])
        attempt.mkdir()
        writer = EvidenceWriter(attempt, limits)
        import uuid
        token = uuid.uuid4().hex.encode("ascii")
        lock = parent / ".observer-supervisor.lock"
        with lock.open("xb") as stream:
            stream.write(token)
        baseline_files, total = [], 0
        for item in spec.get("baseline_copies", []):
            source = reject_reparse(item["source"])
            target = contained(attempt / item["destination"], attempt, missing_ok=True)
            if target.parent != attempt / "baseline":
                raise SupervisorError("BASELINE_DESTINATION_INVALID")
            pin = next((p for p in pins if os.path.normcase(p["path"]) == os.path.normcase(str(source))), None)
            if pin is None:
                raise SupervisorError("BASELINE_UNPINNED")
            total += pin["bytes"]
            if total > limits["baseline"]:
                raise SupervisorError("BASELINE_LIMIT")
            target.parent.mkdir(exist_ok=True)
            with source.open("rb") as src, target.open("xb") as dst:
                data = src.read(pin["bytes"] + 1)
                if len(data) != pin["bytes"]:
                    raise SupervisorError("BASELINE_CHANGED")
                dst.write(data)
            if stable_hash(target, limits["baseline"])["sha256"] != pin["sha256"]:
                raise SupervisorError("BASELINE_CHANGED")
            baseline_files.append(dict(source=str(source), copy=str(target), sha256=pin["sha256"]))
        writer.write("baseline.json", dict(classification=result["classification"], argv=spec["argv"],
                    cwd=spec["cwd"], pins=pins, baseline_copies=baseline_files,
                    previous_directories=before_names, admission_samples=[first, second]))
        if spec["mode"] == "SYNTHETIC":
            control = dict(spec.get("control", {}), classification="MOCK_ONLY", attempt_dir=str(attempt),
                           evidence_parent=str(parent), helper_pin=spec["helper_pin"], targets=spec["targets"], options=spec["options"])
            writer.write("child-control.json", control)
        # All potentially slow file work preceded a final, fresh admission check.
        verify_pins(spec["pins"])
        final_sample = resource_sample(backend, clock, ADMISSION, second["sampled_monotonic"])
        check_guard(guard)
        if backend.conflicts():
            raise SupervisorError("CONFLICT_BEFORE_LAUNCH")
        if clock.monotonic() - final_sample["sampled_monotonic"] > 2.0:
            raise SupervisorError("STALE_AT_LAUNCH")
        started, started_utc = clock.monotonic(), clock.time()
        process = backend.launch(spec["argv"], spec["cwd"], str(attempt / "stdout.log"), str(attempt / "stderr.log"))
        result["launched"] = True
        if spec["mode"] == "EDITOR":
            result["native_lookup"] = "ATTEMPTED_NOT_VERIFIED"
        original = inspect_owned(process)
        if os.path.normcase(original["exe"]) != os.path.normcase(os.path.abspath(spec["argv"][0])):
            raise SupervisorError("LAUNCHED_PATH_MISMATCH")
        result["identity"] = {k: original[k] for k in ("pid", "created", "exe")}
        result["started_utc"] = started_utc
        last_sample, last_tick = final_sample["sampled_monotonic"], -math.inf
        while True:
            observation_start = clock.monotonic()
            state = inspect_owned(process, original)
            original["descendants"] = state["descendants"]
            check_guard(guard, process)
            if backend.conflicts():
                # Synthetic jobs never match editor/game names. A future native
                # backend must omit only the verified owned job, never all names.
                raise SupervisorError("CONCURRENT_EDITOR_OR_GAME")
            sizes = supervised_sizes(attempt, parent, before_names, limits)
            sample = resource_sample(backend, clock, FLOORS, last_sample)
            last_sample = sample["sampled_monotonic"]
            now = clock.monotonic()
            if now - last_tick >= 1.0:
                writer.tick(dict(elapsed=round(now-started, 3), resources=sample, sizes=sizes, identity=state))
                last_tick = now
            if now - started >= limits["deadline"]:
                raise SupervisorError("WHOLE_PROCESS_DEADLINE")
            if clock.monotonic() - observation_start > limits["interval"]:
                raise SupervisorError("MONITOR_INTERVAL_OVERRUN")
            if not state["alive"] and not any(c["alive"] for c in state["descendants"]):
                result["exit_code"], result["cleanup"] = state["exit_code"], "VERIFIED_OWNED_JOB_EXIT"
                result["status"] = "PROCESS_EXITED" if state["exit_code"] == 0 else "ABORTED_NONZERO_EXIT"
                break
            if (attempt / "STOP").exists():
                raise SupervisorError("USER_STOP")
            elapsed = clock.monotonic() - observation_start
            if elapsed > limits["interval"]:
                raise SupervisorError("MONITOR_INTERVAL_OVERRUN")
            clock.sleep(max(0.0, limits["interval"] - elapsed))
        verify_pins(spec["pins"])
        attribution_attempted = True
        result["output"] = attribute(parent, before_names, attempt / "editor.log", started_utc, clock.time(),
                                     spec["helper_pin"], spec["targets"], spec["options"], native=spec["mode"] == "EDITOR")
        result["process_outcome"] = result["status"]
        if result["status"] == "PROCESS_EXITED":
            if result["output"].get("completed") is True:
                result["status"] = "SYNTHETIC_RUN_VALIDATED" if spec["mode"] == "SYNTHETIC" else "EDITOR_QUERY_COLLECTED_REVIEW_PENDING"
                if spec["mode"] == "EDITOR":
                    result["native_lookup"] = "VERIFIED_METADATA_ONLY"
            else:
                result["status"] = "LOOKUP_PARTIAL"
    except Exception as exc:
        result["errors"].append(getattr(exc, "code", None) or str(exc)[:240] or type(exc).__name__)
        if process is None and getattr(exc, "owned_process", None) is not None:
            process = exc.owned_process
            result["launched"] = True
        if process is not None:
            result["status"], result["cleanup"] = "ABORTED", "CLEANUP_UNKNOWN"
            try:
                state = inspect_owned(process, original)
                if not state["alive"] and not any(c["alive"] for c in state["descendants"]):
                    result["cleanup"] = "VERIFIED_OWNED_JOB_EXIT"
                else:
                    check_guard(guard, process)
                    result["normal_stop"] = guard.request_normal_close(process)
                    if result["normal_stop"].get("status") == "UNSUPPORTED":
                        raise SupervisorError("NORMAL_CLOSE_UNSUPPORTED")
                    grace_start = clock.monotonic()
                    while clock.monotonic() - grace_start < limits["grace"]:
                        state = inspect_owned(process, original)
                        original = original or state
                        original["descendants"] = state["descendants"]
                        check_guard(guard, process)
                        if not state["alive"] and not any(c["alive"] for c in state["descendants"]):
                            result["cleanup"] = "VERIFIED_NORMAL_STOP"
                            break
                        try:
                            resource_sample(backend, clock, FLOORS)
                            supervised_sizes(attempt, parent, before_names, limits)
                        except Exception:
                            # Grace is a maximum. Deteriorating resources/logs
                            # require immediate containment of the verified job.
                            break
                        remaining_grace = limits["grace"] - (clock.monotonic() - grace_start)
                        if remaining_grace <= 0:
                            break
                        clock.sleep(min(limits["interval"], remaining_grace))
                    if result["cleanup"] != "VERIFIED_NORMAL_STOP":
                        inspect_owned(process, original)
                        check_guard(guard, process)
                        result["forced_stop"] = process.terminate_owned()
                        if (not isinstance(result["forced_stop"], dict)
                                or result["forced_stop"].get("status") not in ("TERMINATED", "ALREADY_EXITED")
                                or result["forced_stop"].get("all_exited") is not True):
                            raise SupervisorError("FORCED_CLEANUP_UNVERIFIED")
                        state = inspect_owned(process, original)
                        if not state["alive"] and not any(c["alive"] for c in state["descendants"]):
                            result["cleanup"] = "VERIFIED_FORCED_STOP"
            except Exception as cleanup_exc:
                result["errors"].append("CLEANUP: " + (getattr(cleanup_exc, "code", None) or str(cleanup_exc)[:200]))
    finally:
        result["ended_utc"] = clock.time()
        # Retain partial helper evidence after verified aborted cleanup without
        # promoting the process outcome. Never inspect a possibly live writer.
        if process is not None and not attribution_attempted and result["cleanup"].startswith("VERIFIED"):
            try:
                result["output"] = attribute(parent, before_names, attempt / "editor.log", started_utc,
                                             result["ended_utc"], spec["helper_pin"], spec["targets"],
                                             spec["options"], native=spec["mode"] == "EDITOR")
            except Exception as exc:
                result["output_attribution"] = dict(status="NOT_ESTABLISHED_RAW_RETAINED",
                                                    error=getattr(exc, "code", None) or type(exc).__name__)
        result["resource_recovery"] = dict(status="NOT_VERIFIED")
        if process is not None and result["cleanup"].startswith("VERIFIED"):
            try:
                result["resource_recovery"] = dict(
                    status="RUNNING_FLOORS_RECHECK_PASSED",
                    sample=resource_sample(backend, clock, FLOORS),
                    limitation="Fresh minimum floors only; not proof of full baseline recovery or exclusive resource attribution")
            except Exception as exc:
                result["resource_recovery"] = dict(
                    status="RECOVERY_NOT_VERIFIED", error=getattr(exc, "code", None) or str(exc)[:160])
        if process is not None:
            try:
                result["post_run_pins"] = verify_pins(spec["pins"])
            except Exception as exc:
                result["errors"].append("POST_RUN_PIN_CHECK: " + (getattr(exc, "code", None) or str(exc)[:160]))
                result["status"] = "ABORTED_PIN_DRIFT_OR_UNREADABLE"
        if process is not None:
            try:
                closed = process.close()  # Handle release never implies termination.
                if isinstance(closed, dict) and closed.get("status") not in ("CLOSED", "ALREADY_CLOSED"):
                    raise SupervisorError("HANDLE_CLOSE_FAILED")
            except Exception:
                result["errors"].append("HANDLE_CLOSE_FAILED")
                result["cleanup"] = "CLEANUP_UNKNOWN"
                result["status"] = "ABORTED_CLEANUP_UNVERIFIED"
        if lock is not None and token is not None and (process is None or result["cleanup"].startswith("VERIFIED")):
            try:
                reject_reparse(lock)
                with lock.open("rb") as stream:
                    owned = stream.read(33) == token
                if owned:
                    lock.unlink()
                    result["supervisor_lock"] = "OWNED_LOCK_REMOVED"
                else:
                    result["supervisor_lock"] = "FOREIGN_LOCK_PRESERVED"
            except Exception:
                result["supervisor_lock"] = "LOCK_PRESERVED_UNVERIFIED"
        elif lock is not None:
            result["supervisor_lock"] = "PRESERVED_CLEANUP_UNKNOWN"
        if writer is not None:
            try:
                files = []
                for name in ("baseline.json", "child-control.json", "timeline.jsonl", "editor.log", "stdout.log", "stderr.log"):
                    path = attempt / name
                    if path.exists():
                        # Oversized raw logs are preserved; no unbounded hashing.
                        if path.stat().st_size > 64*MIB:
                            files.append(dict(path=str(path), bytes=path.stat().st_size, hash_status="OVERSIZED_NOT_READ"))
                        else:
                            files.append(stable_hash(path, 64*MIB))
                for copied in baseline_files:
                    files.append(stable_hash(copied["copy"], limits["baseline"]))
                writer.write("artifact-index.json", dict(files=files, classification=result["classification"],
                             scope="Outer artifacts and baseline copies; attributed helper hashes are in process-result output.files"), final=True)
                result["artifact_index"] = stable_hash(attempt / "artifact-index.json", 4*MIB)
                result["outer_receipt_complete"] = True
                writer.write("process-result.json", result, final=True)
            except Exception as final_exc:
                result["status"] = "EVIDENCE_FINALIZATION_FAILED"
                result["outer_receipt_complete"] = False
                result["errors"].append("FINAL_EVIDENCE: " + (getattr(final_exc, "code", None) or str(final_exc)[:160]))
    return result


def native_spec(manifest):
    """Parse exact production policy. This does not authorize or launch it."""
    admission = manifest["admission"]
    checks = {"available_ram_bytes": 8*GIB, "available_commit_bytes": 8*GIB, "free_disk_bytes": 12*GIB,
              "passing_samples_required": 2, "sample_separation_ms": 1000, "last_sample_maximum_age_ms": 2000}
    stops = manifest["stops"]
    stop_checks = dict(available_ram_floor_bytes=2*GIB, available_commit_floor_bytes=2*GIB,
                       free_disk_floor_bytes=10*GIB, observation_interval_ms=250, maximum_sample_age_ms=2000,
                       whole_process_deadline_seconds=300, maximum_graceful_close_seconds=30,
                       owned_logs_bytes=64*MIB, outer_metadata_bytes=4*MIB, timeline_bytes=MIB,
                       baseline_config_copy_bytes=4*MIB, helper_designed_json_bytes=1081344,
                       timeline_record_interval_ms=1000, helper_internal_cooperative_budget_seconds=60,
                       helper_temporary_lock_bytes=32)
    if any(type(admission.get(k)) is not int or admission[k] != v for k, v in checks.items()) or any(type(stops.get(k)) is not int or stops[k] != v for k, v in stop_checks.items()):
        raise SupervisorError("MANIFEST_POLICY_DRIFT")
    if (type(admission.get("existing_editor_game_processes_allowed")) is not int
            or admission["existing_editor_game_processes_allowed"] != 0
            or type(manifest["attempt"].get("maximum_editor_processes")) is not int
            or manifest["attempt"]["maximum_editor_processes"] != 1):
        raise SupervisorError("MANIFEST_PROCESS_POLICY_DRIFT")
    pins = manifest["identities"] + manifest["additional_preparation_identities"]["files"]
    reference = bounded_json(ROOT / "research/OBSERVER_REFERENCE_PREPARATION.json", MIB)
    helper = dict(reference["helper"])
    return dict(mode="EDITOR", evidence_parent=str(EVIDENCE), attempt_dir=manifest["attempt"]["directory"],
                argv=[manifest["proposed_command"]["executable"]] + manifest["proposed_command"]["arguments"],
                cwd=manifest["proposed_command"]["working_directory"], pins=pins,
                baseline_copies=[dict(source=v["source"], destination=v["proposed_copy"]) for v in manifest["proposed_baseline_copies"]],
                helper_pin=helper, targets=reference["targets"], options=reference["options"])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--preflight", action="store_true", required=True)
    args = parser.parse_args()
    from observer_supervisor_windows import WinBackend
    spec = native_spec(bounded_json(ROOT / "research/OBSERVER_NORMAL_EDITOR_EXPERIMENT.json", MIB))
    backend = WinBackend(str(ROOT))
    receipt = dict(classification="READ_ONLY_PREFLIGHT", native_launch="NOT_PERFORMED",
                   native_lookup="NOT_PERFORMED", desktop_guard="UNAVAILABLE", launch_enabled=False)
    try:
        validate_spec(spec)
        receipt["pins"] = verify_pins(spec["pins"])
        receipt["conflicts"] = backend.conflicts()
        receipt["resources"] = backend.sample()
        receipt["resource_admission"] = {k: receipt["resources"][k] >= v for k, v in ADMISSION.items()}
        receipt["status"] = "NATIVE_LAUNCH_BLOCKED_DESKTOP_INTEGRATION"
    except Exception as exc:
        receipt["status"] = "PREFLIGHT_REFUSED"
        receipt["error"] = getattr(exc, "code", None) or str(exc)[:240]
    print(json.dumps(receipt, indent=2))


if __name__ == "__main__":
    main()
