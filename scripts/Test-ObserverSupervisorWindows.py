"""Bounded Windows OS smoke tests. Launches authored synthetic children only.

Usage: python -B scripts/Test-ObserverSupervisorWindows.py
Artifacts stay in the printed project-local unique directory for review.
No editor/game is launched, and no installed editor helper is executed.
"""
import ctypes
import json
import os
from pathlib import Path
import sys
import tempfile
import time

from observer_supervisor_windows import BackendError, WinBackend


ROOT = Path(__file__).resolve().parents[1]
CHILD = Path(__file__).resolve().with_name("observer_supervisor_test_child.py")


def until(predicate, timeout=5.0):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        result = predicate()
        if result:
            return result
        time.sleep(0.025)
    raise AssertionError("synthetic wait deadline expired")


def run():
    if os.name != "nt":
        raise RuntimeError("Windows smoke requires Windows")
    scratch = ROOT / "research" / "evidence" / "observer-supervisor"
    scratch.mkdir(parents=True, exist_ok=True)
    directory = Path(tempfile.mkdtemp(prefix="windows-smoke-", dir=str(scratch)))
    records = []
    values = ["", "space value", 'embedded"quote', "trailing slash\\", "snowman \u2603"]
    echo = [sys.executable, "-B", str(CHILD), "echo"] + values
    tree = [sys.executable, "-B", str(CHILD), "tree"]
    marker = directory / "survived.txt"
    survive = [sys.executable, "-B", str(CHILD), "survive-close", str(marker)]
    backend = WinBackend(str(ROOT), allowed_argvs=[echo, tree, survive])
    sample = backend.sample()
    assert all(sample[key] > 0 for key in ("physical_available", "commit_available", "disk_free"))
    assert sample["sample_duration"] >= 0
    records.append({"name": "real-resource-sample", "result": "PASS", "sample": sample})
    assert backend.ui_status()["status"] == "UNSUPPORTED"
    assert backend.request_normal_close()["status"] == "UNSUPPORTED"
    records.append({"name": "native-ui-remains-unsupported", "result": "PASS"})
    conflicts = backend.conflicts()
    assert all(item["name"] in backend.conflict_names for item in conflicts)
    records.append({"name": "bounded-conflict-identities", "result": "PASS", "conflicts": conflicts})
    try:
        backend.launch([sys.executable, "-B", str(CHILD), "sleep"], str(ROOT),
                       str(directory / "unallowed-out"), str(directory / "unallowed-err"))
        raise AssertionError("non-allowlisted argv accepted")
    except BackendError as error:
        assert error.code == "ARGV_NOT_ALLOWLISTED"
    assert not (directory / "unallowed-out").exists()
    records.append({"name": "allowlist-before-process-or-files", "result": "PASS"})
    fake_editor = [str(ROOT / "UE4Editor.exe")]
    blocked = WinBackend(str(ROOT), allowed_argvs=[fake_editor])
    try:
        blocked.launch(fake_editor, str(ROOT), str(directory / "editor-out"), str(directory / "editor-err"))
        raise AssertionError("editor accepted")
    except BackendError as error:
        assert error.code == "EDITOR_GAME_LAUNCH_UNSUPPORTED"
    assert not (directory / "editor-out").exists()
    records.append({"name": "editor-denied-even-if-allowlisted", "result": "PASS"})

    # Failure injection surrounds real OS calls: the process really is created
    # suspended, but job assignment is refused before any fixture code can run.
    class RefuseAssignment(object):
        def __init__(self, original):
            self.original = original
            self.terminated_pids = []
            self.resume_count = 0

        def __getattr__(self, name):
            return getattr(self.original, name)

        def AssignProcessToJobObject(self, job, process):
            ctypes.set_last_error(5)
            return False

        def ResumeThread(self, thread):
            self.resume_count += 1
            return self.original.ResumeThread(thread)

        def TerminateProcess(self, process, code):
            self.terminated_pids.append(int(self.original.GetProcessId(process)))
            return self.original.TerminateProcess(process, code)

    failing = WinBackend(str(ROOT), allowed_argvs=[echo])
    proxy = RefuseAssignment(failing._api.k)
    failing._api.k = proxy
    try:
        failing.launch(echo, str(ROOT), str(directory / "rollback.stdout"), str(directory / "rollback.stderr"))
        raise AssertionError("injected assignment refusal did not stop launch")
    except BackendError as error:
        assert error.code == "ASSIGN_PROCESS_TO_JOB_FAILED"
        assert error.owned_process is None
    assert proxy.resume_count == 0 and len(proxy.terminated_pids) == 1
    assert proxy.terminated_pids[0] not in failing._api.snapshot()
    assert (directory / "rollback.stdout").stat().st_size == 0
    records.append({"name": "injected-assignment-failure-real-suspended-rollback", "result": "PASS",
                    "injection": "AssignProcessToJobObject returned Win32 5", "resumed": False,
                    "terminated_pid": proxy.terminated_pids[0]})

    owned = backend.launch(echo, str(ROOT), str(directory / "echo.stdout"), str(directory / "echo.stderr"))
    try:
        state = until(lambda: (lambda state: state if state["alive"] is False else None)(owned.inspect()))
        assert state["ownership_verified"], state
        assert state["exit_code"] == 7
        assert state["argv"] == echo and state["created"].isdigit()
        output = json.loads((directory / "echo.stdout").read_text(encoding="utf-8"))
        assert output["argv"] == values and output["pid"] == state["pid"]
        assert (directory / "echo.stderr").read_text().strip() == "synthetic stderr"
        cleanup = owned.terminate_owned()
        assert cleanup["status"] == "ALREADY_EXITED" and cleanup["all_exited"]
        records.append({"name": "argv-stdout-stderr-natural-exit", "result": "PASS", "identity": state})
    finally:
        owned.close()
    assert owned.inspect()["ownership_verified"] is False
    records.append({"name": "closed-handles-cannot-claim-ownership", "result": "PASS"})

    owned = backend.launch(tree, str(ROOT), str(directory / "tree.stdout"), str(directory / "tree.stderr"))
    try:
        until(lambda: (directory / "tree.stdout").stat().st_size > 0)
        output = json.loads((directory / "tree.stdout").read_text())
        state = until(lambda: (lambda state: state if any(item["pid"] == output["child_pid"] for item in state["descendants"]) else None)(owned.inspect()))
        assert state["ownership_verified"] and state["alive"], state
        child = next(item for item in state["descendants"] if item["pid"] == output["child_pid"])
        assert child["pid"] == output["child_pid"] and child["parent_pid"] == state["pid"] and child["alive"]
        cleanup = owned.terminate_owned()
        assert cleanup["status"] == "TERMINATED" and cleanup["all_exited"], cleanup
        records.append({"name": "private-job-child-lineage-and-cleanup", "result": "PASS",
                        "before": state, "cleanup": cleanup})
    finally:
        cleanup = owned.terminate_owned()
        owned.close()
    assert cleanup["all_exited"], cleanup

    owned = backend.launch(survive, str(ROOT), str(directory / "survive.stdout"), str(directory / "survive.stderr"))
    state = owned.inspect()
    assert state["alive"] and state["ownership_verified"], state
    closed = owned.close()
    assert closed["status"] == "CLOSED" and closed["termination_requested"] is False
    until(marker.exists)
    records.append({"name": "close-is-not-kill", "result": "PASS", "identity": state,
                    "marker": marker.read_text(), "close": closed})
    receipt = {"classification": "SYNTHETIC_OS_ONLY", "editor_launch": "NOT_PERFORMED",
               "python": sys.version, "passed": len(records), "tests": records}
    path = directory / "receipt.json"
    path.write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"result": "PASS_SYNTHETIC_OS_ONLY", "passed": len(records), "receipt": str(path)}))


if __name__ == "__main__":
    run()
