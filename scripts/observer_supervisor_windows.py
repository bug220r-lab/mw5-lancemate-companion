"""Windows ownership backend for the observer supervisor (Python 3.7 stdlib).

This revision permits only explicitly allowlisted synthetic commands. Editor/game
launch and native UI inspection/normal-close are UNSUPPORTED. It is not an editor
automation bridge. No process is killed by close(), finalization, or job closure.

Ownership uses a private, non-inheritable Job Object, a suspended CreateProcessW,
and retained process handles. Names are used only to refuse conflicting launches,
never to select a process for termination. A child whose parent identity cannot
be established makes cleanup fail closed. Closing handles after that leaves it
running; callers must preserve the uncertainty and seek human intervention.

OS calls here are synchronous. Loops, buffers and waits are bounded, but Win32
does not give these calls an overall timeout; an external watchdog is required
to bound an OS call that itself stalls. No arbitrary thread cancellation is used.

Primary API contracts reviewed 2026-09-22:
https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-createprocessw
https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-updateprocthreadattribute
https://learn.microsoft.com/en-us/windows/win32/api/jobapi2/nf-jobapi2-queryinformationjobobject
https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-terminateprocess
"""

import ctypes
from ctypes import wintypes as wt
import os
import subprocess
import time


DEFAULT_CONFLICT_NAMES = frozenset((
    "ue4editor.exe", "ue4editor-cmd.exe", "mechwarrior.exe",
    "mechwarrior-win64-shipping.exe", "mw5mercs.exe",
    "mw5mercs-win64-shipping.exe",
))
INVALID_HANDLE_VALUE = ctypes.c_void_p(-1).value
WAIT_OBJECT_0, WAIT_TIMEOUT, WAIT_FAILED = 0, 258, 0xffffffff
ERROR_NO_MORE_FILES, ERROR_INSUFFICIENT_BUFFER, ERROR_MORE_DATA = 18, 122, 234
PROCESS_QUERY_LIMITED_INFORMATION, SYNCHRONIZE, PROCESS_TERMINATE = 0x1000, 0x100000, 0x1
CREATE_SUSPENDED, CREATE_NO_WINDOW = 0x4, 0x08000000
EXTENDED_STARTUPINFO_PRESENT = 0x00080000
STARTF_USESHOWWINDOW, STARTF_USESTDHANDLES = 0x1, 0x100
PROC_THREAD_ATTRIBUTE_HANDLE_LIST = 0x00020002
SIZE_T = ctypes.c_size_t
ULONG_PTR = ctypes.c_size_t


class BackendError(RuntimeError):
    """Bounded machine-readable failure; never includes command-line contents."""

    def __init__(self, code, winerror=None, owned_process=None):
        self.code = str(code)[:96]
        self.winerror = winerror
        self.owned_process = owned_process
        message = self.code
        if winerror is not None:
            message += " (Win32 {})".format(winerror)
        RuntimeError.__init__(self, message)

    def record(self):
        return {"code": self.code, "winerror": self.winerror}


class FILETIME(ctypes.Structure):
    _fields_ = [("low", wt.DWORD), ("high", wt.DWORD)]


class MEMORYSTATUSEX(ctypes.Structure):
    _fields_ = [("dwLength", wt.DWORD), ("dwMemoryLoad", wt.DWORD)] + [
        (name, ctypes.c_ulonglong) for name in (
            "ullTotalPhys", "ullAvailPhys", "ullTotalPageFile",
            "ullAvailPageFile", "ullTotalVirtual", "ullAvailVirtual",
            "ullAvailExtendedVirtual")]


class PROCESSENTRY32W(ctypes.Structure):
    _fields_ = [
        ("dwSize", wt.DWORD), ("cntUsage", wt.DWORD),
        ("th32ProcessID", wt.DWORD), ("th32DefaultHeapID", ULONG_PTR),
        ("th32ModuleID", wt.DWORD), ("cntThreads", wt.DWORD),
        ("th32ParentProcessID", wt.DWORD), ("pcPriClassBase", wt.LONG),
        ("dwFlags", wt.DWORD), ("szExeFile", wt.WCHAR * 260)]


class SECURITY_ATTRIBUTES(ctypes.Structure):
    _fields_ = [("nLength", wt.DWORD), ("lpSecurityDescriptor", wt.LPVOID),
                ("bInheritHandle", wt.BOOL)]


class STARTUPINFOW(ctypes.Structure):
    _fields_ = [
        ("cb", wt.DWORD), ("lpReserved", wt.LPWSTR),
        ("lpDesktop", wt.LPWSTR), ("lpTitle", wt.LPWSTR),
        ("dwX", wt.DWORD), ("dwY", wt.DWORD),
        ("dwXSize", wt.DWORD), ("dwYSize", wt.DWORD),
        ("dwXCountChars", wt.DWORD), ("dwYCountChars", wt.DWORD),
        ("dwFillAttribute", wt.DWORD), ("dwFlags", wt.DWORD),
        ("wShowWindow", wt.WORD), ("cbReserved2", wt.WORD),
        ("lpReserved2", ctypes.POINTER(wt.BYTE)),
        ("hStdInput", wt.HANDLE), ("hStdOutput", wt.HANDLE),
        ("hStdError", wt.HANDLE)]


class STARTUPINFOEXW(ctypes.Structure):
    _fields_ = [("StartupInfo", STARTUPINFOW), ("lpAttributeList", wt.LPVOID)]


class PROCESS_INFORMATION(ctypes.Structure):
    _fields_ = [("hProcess", wt.HANDLE), ("hThread", wt.HANDLE),
                ("dwProcessId", wt.DWORD), ("dwThreadId", wt.DWORD)]


class JOBOBJECT_BASIC_LIMIT_INFORMATION(ctypes.Structure):
    _fields_ = [
        ("PerProcessUserTimeLimit", ctypes.c_longlong),
        ("PerJobUserTimeLimit", ctypes.c_longlong), ("LimitFlags", wt.DWORD),
        ("MinimumWorkingSetSize", SIZE_T), ("MaximumWorkingSetSize", SIZE_T),
        ("ActiveProcessLimit", wt.DWORD), ("Affinity", ULONG_PTR),
        ("PriorityClass", wt.DWORD), ("SchedulingClass", wt.DWORD)]


class IO_COUNTERS(ctypes.Structure):
    _fields_ = [(name, ctypes.c_ulonglong) for name in (
        "ReadOperationCount", "WriteOperationCount", "OtherOperationCount",
        "ReadTransferCount", "WriteTransferCount", "OtherTransferCount")]


class JOBOBJECT_EXTENDED_LIMIT_INFORMATION(ctypes.Structure):
    _fields_ = [("BasicLimitInformation", JOBOBJECT_BASIC_LIMIT_INFORMATION),
                ("IoInfo", IO_COUNTERS), ("ProcessMemoryLimit", SIZE_T),
                ("JobMemoryLimit", SIZE_T), ("PeakProcessMemoryUsed", SIZE_T),
                ("PeakJobMemoryUsed", SIZE_T)]


def _canonical(path):
    return os.path.normcase(os.path.normpath(os.path.abspath(path)))


def _last_error(code):
    return BackendError(code, ctypes.get_last_error())


class _WinAPI(object):
    def __init__(self):
        self.k = ctypes.WinDLL("kernel32", use_last_error=True)
        signatures = {
            "CloseHandle": ([wt.HANDLE], wt.BOOL),
            "GlobalMemoryStatusEx": ([ctypes.POINTER(MEMORYSTATUSEX)], wt.BOOL),
            "GetDiskFreeSpaceExW": ([wt.LPCWSTR, ctypes.POINTER(ctypes.c_ulonglong),
                                     ctypes.POINTER(ctypes.c_ulonglong),
                                     ctypes.POINTER(ctypes.c_ulonglong)], wt.BOOL),
            "CreateToolhelp32Snapshot": ([wt.DWORD, wt.DWORD], wt.HANDLE),
            "Process32FirstW": ([wt.HANDLE, ctypes.POINTER(PROCESSENTRY32W)], wt.BOOL),
            "Process32NextW": ([wt.HANDLE, ctypes.POINTER(PROCESSENTRY32W)], wt.BOOL),
            "OpenProcess": ([wt.DWORD, wt.BOOL, wt.DWORD], wt.HANDLE),
            "GetProcessId": ([wt.HANDLE], wt.DWORD),
            "GetProcessTimes": ([wt.HANDLE] + [ctypes.POINTER(FILETIME)] * 4, wt.BOOL),
            "QueryFullProcessImageNameW": ([wt.HANDLE, wt.DWORD, wt.LPWSTR,
                                            ctypes.POINTER(wt.DWORD)], wt.BOOL),
            "GetExitCodeProcess": ([wt.HANDLE, ctypes.POINTER(wt.DWORD)], wt.BOOL),
            "WaitForSingleObject": ([wt.HANDLE, wt.DWORD], wt.DWORD),
            "CreateJobObjectW": ([ctypes.POINTER(SECURITY_ATTRIBUTES), wt.LPCWSTR], wt.HANDLE),
            "SetInformationJobObject": ([wt.HANDLE, ctypes.c_int, wt.LPVOID, wt.DWORD], wt.BOOL),
            "QueryInformationJobObject": ([wt.HANDLE, ctypes.c_int, wt.LPVOID, wt.DWORD,
                                            ctypes.POINTER(wt.DWORD)], wt.BOOL),
            "AssignProcessToJobObject": ([wt.HANDLE, wt.HANDLE], wt.BOOL),
            "IsProcessInJob": ([wt.HANDLE, wt.HANDLE, ctypes.POINTER(wt.BOOL)], wt.BOOL),
            "TerminateProcess": ([wt.HANDLE, wt.UINT], wt.BOOL),
            "ResumeThread": ([wt.HANDLE], wt.DWORD),
            "CreateFileW": ([wt.LPCWSTR, wt.DWORD, wt.DWORD,
                              ctypes.POINTER(SECURITY_ATTRIBUTES), wt.DWORD,
                              wt.DWORD, wt.HANDLE], wt.HANDLE),
            "InitializeProcThreadAttributeList": ([wt.LPVOID, wt.DWORD, wt.DWORD,
                                                    ctypes.POINTER(SIZE_T)], wt.BOOL),
            "UpdateProcThreadAttribute": ([wt.LPVOID, wt.DWORD, SIZE_T, wt.LPVOID,
                                            SIZE_T, wt.LPVOID, ctypes.POINTER(SIZE_T)], wt.BOOL),
            "DeleteProcThreadAttributeList": ([wt.LPVOID], None),
            "CreateProcessW": ([wt.LPCWSTR, wt.LPWSTR, wt.LPVOID, wt.LPVOID,
                                wt.BOOL, wt.DWORD, wt.LPVOID, wt.LPCWSTR,
                                wt.LPVOID, ctypes.POINTER(PROCESS_INFORMATION)], wt.BOOL),
        }
        for name, signature in signatures.items():
            function = getattr(self.k, name)
            function.argtypes, function.restype = signature

    def close(self, handle):
        if handle and handle != INVALID_HANDLE_VALUE:
            if not self.k.CloseHandle(handle):
                raise _last_error("CLOSE_HANDLE_FAILED")

    def snapshot(self):
        handle = self.k.CreateToolhelp32Snapshot(2, 0)
        if handle == INVALID_HANDLE_VALUE:
            raise _last_error("PROCESS_SNAPSHOT_FAILED")
        result = {}
        try:
            entry = PROCESSENTRY32W()
            entry.dwSize = ctypes.sizeof(entry)
            ok = self.k.Process32FirstW(handle, ctypes.byref(entry))
            while ok:
                if len(result) >= 8192:
                    raise BackendError("PROCESS_SNAPSHOT_LIMIT")
                pid = int(entry.th32ProcessID)
                if pid in result:
                    raise BackendError("PROCESS_SNAPSHOT_DUPLICATE_PID")
                result[pid] = {"parent_pid": int(entry.th32ParentProcessID),
                               "name": entry.szExeFile.lower()}
                ok = self.k.Process32NextW(handle, ctypes.byref(entry))
            if ctypes.get_last_error() != ERROR_NO_MORE_FILES:
                raise _last_error("PROCESS_SNAPSHOT_ENUMERATION_FAILED")
            return result
        finally:
            self.close(handle)

    def identity(self, handle, expected=None):
        pid = self.k.GetProcessId(handle)
        if not pid:
            raise _last_error("PROCESS_ID_FAILED")
        created, exited, kernel, user = FILETIME(), FILETIME(), FILETIME(), FILETIME()
        if not self.k.GetProcessTimes(handle, ctypes.byref(created), ctypes.byref(exited),
                                      ctypes.byref(kernel), ctypes.byref(user)):
            raise _last_error("PROCESS_TIMES_FAILED")
        creation = str((created.high << 32) | created.low)
        wait = self.k.WaitForSingleObject(handle, 0)
        if wait not in (WAIT_OBJECT_0, WAIT_TIMEOUT):
            raise _last_error("PROCESS_WAIT_FAILED")
        size = wt.DWORD(32768)
        path = ctypes.create_unicode_buffer(size.value)
        image_source = "QUERIED"
        if not self.k.QueryFullProcessImageNameW(handle, 0, path, ctypes.byref(size)):
            error = _last_error("PROCESS_IMAGE_FAILED")
            # Windows may no longer expose the image name after process exit.
            # Only a previously queried path tied to this retained handle's
            # identical PID and creation time can substitute after confirmed exit.
            wait = self.k.WaitForSingleObject(handle, 0)
            if (wait != WAIT_OBJECT_0 or expected is None or
                    expected["pid"] != int(pid) or expected["created"] != creation):
                raise error
            executable = expected["exe"]
            image_source = "RETAINED_IDENTITY_AFTER_EXIT"
        else:
            executable = path.value
        exit_code = wt.DWORD()
        if not self.k.GetExitCodeProcess(handle, ctypes.byref(exit_code)):
            raise _last_error("PROCESS_EXIT_CODE_FAILED")
        return {"pid": int(pid), "created": creation,
                "exe": executable, "image_identity_source": image_source,
                "alive": wait == WAIT_TIMEOUT,
                "exit_code": None if wait == WAIT_TIMEOUT else int(exit_code.value)}

    def member(self, handle, job):
        member = wt.BOOL()
        if not self.k.IsProcessInJob(handle, job, ctypes.byref(member)):
            raise _last_error("JOB_MEMBERSHIP_FAILED")
        return bool(member.value)

    def job_ids(self, job, capacity):
        class ID_LIST(ctypes.Structure):
            _fields_ = [("assigned", wt.DWORD), ("count", wt.DWORD),
                        ("ids", ULONG_PTR * capacity)]
        data = ID_LIST()
        if not self.k.QueryInformationJobObject(job, 3, ctypes.byref(data),
                                                ctypes.sizeof(data), None):
            code = ctypes.get_last_error()
            if code == ERROR_MORE_DATA:
                raise BackendError("JOB_PROCESS_LIMIT", code)
            raise BackendError("JOB_QUERY_FAILED", code)
        if data.assigned > capacity or data.count > capacity:
            raise BackendError("JOB_PROCESS_LIMIT")
        result = [int(data.ids[index]) for index in range(data.count)]
        if len(set(result)) != len(result) or 0 in result:
            raise BackendError("JOB_INVALID_PID_LIST")
        return result


class OwnedProcess(object):
    """One private job and retained identities; close() is deliberately non-killing."""

    def __init__(self, api, job, info, argv, max_descendants):
        self._api, self._job = api, job
        self._process, self._thread = info.hProcess, info.hThread
        self._max_descendants = max_descendants
        self._root = None
        self._children = {}
        self._latched_errors = []
        self._closed, self._assigned, self._resumed = False, False, False
        self.argv = tuple(argv)
        self.pid = int(info.dwProcessId)

    def _verify(self, handle, expected):
        actual = self._api.identity(handle, expected)
        if (actual["pid"] != expected["pid"] or
                actual["created"] != expected["created"] or
                _canonical(actual["exe"]) != _canonical(expected["exe"])):
            raise BackendError("RETAINED_IDENTITY_CHANGED")
        if actual["alive"] and not self._api.member(handle, self._job):
            raise BackendError("OWNED_PROCESS_LEFT_JOB")
        return actual

    def _error(self, error):
        record = error.record()
        if record not in self._latched_errors and len(self._latched_errors) < 16:
            self._latched_errors.append(record)

    def inspect(self):
        root = dict(self._root or {"pid": self.pid, "created": None, "exe": None,
                                   "alive": None, "exit_code": None})
        descendants = []
        pending = {}
        if self._closed:
            return dict(root, descendants=[], ownership_verified=False,
                        argv=list(self.argv), errors=[{"code": "HANDLES_CLOSED", "winerror": None}])
        try:
            if self._root is None or not self._assigned:
                raise BackendError("ROOT_OWNERSHIP_UNESTABLISHED")
            root = self._verify(self._process, self._root)
            active = self._api.job_ids(self._job, self._max_descendants + 1)
            if root["alive"] and self.pid not in active:
                raise BackendError("LIVE_ROOT_MISSING_FROM_JOB")
            if len(set(active) - {self.pid} - set(self._children)) + len(self._children) > self._max_descendants:
                raise BackendError("RETAINED_DESCENDANT_LIMIT")
            snapshot = self._api.snapshot()
            for pid in active:
                if pid == self.pid or pid in self._children:
                    continue
                handle = self._api.k.OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION | SYNCHRONIZE | PROCESS_TERMINATE,
                                                 False, pid)
                if not handle:
                    error = _last_error("DESCENDANT_OPEN_FAILED")
                    if pid not in self._api.job_ids(self._job, self._max_descendants + 1):
                        continue  # It ended before a handle could be retained.
                    raise error
                try:
                    identity = self._api.identity(handle)
                    if identity["pid"] != pid or not self._api.member(handle, self._job):
                        raise BackendError("DESCENDANT_MEMBERSHIP_UNVERIFIED")
                    if pid not in snapshot:
                        raise BackendError("DESCENDANT_LINEAGE_MISSING")
                    identity["parent_pid"] = snapshot[pid]["parent_pid"]
                    pending[pid] = (handle, identity)
                    handle = None
                finally:
                    self._api.close(handle)
            # Topological pass: a grandchild may occur earlier in the PID list.
            for unused in range(self._max_descendants + 1):
                progressed = False
                for pid, (handle, identity) in list(pending.items()):
                    parent_id = identity["parent_pid"]
                    parent = root if parent_id == self.pid else self._children.get(parent_id, {}).get("identity")
                    if parent is None:
                        continue
                    if int(parent["created"]) > int(identity["created"]):
                        raise BackendError("DESCENDANT_PARENT_IDENTITY_STALE")
                    self._children[pid] = {"handle": handle, "identity": identity}
                    del pending[pid]
                    progressed = True
                if not pending or not progressed:
                    break
            if pending:
                raise BackendError("DESCENDANT_LINEAGE_UNVERIFIED")
            for child in self._children.values():
                identity = self._verify(child["handle"], child["identity"])
                identity["parent_pid"] = child["identity"]["parent_pid"]
                descendants.append(identity)
            if not root["alive"] and not any(item["alive"] for item in descendants):
                # A final child can be born after the first job snapshot, while
                # its observed parent exits before handle verification. Empty job
                # plus exited retained handles is the normal-completion proof.
                if self._api.job_ids(self._job, self._max_descendants + 1):
                    raise BackendError("JOB_NOT_EMPTY_AFTER_OBSERVED_EXIT")
        except BackendError as error:
            self._error(error)
        finally:
            for handle, identity in pending.values():
                try:
                    self._api.close(handle)
                except BackendError as error:
                    self._error(error)
        # Unknown children/identity failures stay unknown even if they later exit.
        return dict(root, descendants=descendants, argv=list(self.argv),
                    ownership_verified=not self._latched_errors and self._assigned,
                    errors=list(self._latched_errors))

    def terminate_owned(self, exit_code=1460, wait_ms=2000):
        if (not isinstance(exit_code, int) or isinstance(exit_code, bool) or
                not 0 <= exit_code <= 0xffffffff or not isinstance(wait_ms, int) or
                isinstance(wait_ms, bool) or not 0 <= wait_ms <= 5000):
            raise BackendError("INVALID_TERMINATION_ARGUMENTS")
        before = self.inspect()
        if not before["ownership_verified"]:
            return {"status": "CLEANUP_UNKNOWN", "termination_request_accepted": False,
                    "all_exited": False, "snapshot": before}
        if not before["alive"] and not any(item["alive"] for item in before["descendants"]):
            # Observed parents may exit after creating a child too late for the
            # inspect snapshot. No successful cleanup claim without an empty job.
            try:
                if self._api.job_ids(self._job, self._max_descendants + 1):
                    raise BackendError("JOB_NOT_EMPTY_AFTER_OBSERVED_EXIT")
            except BackendError as error:
                self._error(error)
                return {"status": "CLEANUP_UNKNOWN", "termination_request_accepted": False,
                        "all_exited": False, "snapshot": self.inspect(), "error": error.record()}
            return {"status": "ALREADY_EXITED", "termination_request_accepted": False,
                    "all_exited": True, "snapshot": before}
        # Terminate only previously inspected identities through retained handles.
        # A job-wide kill could include a child born after inspection; that would
        # exceed the observed-identity contract. Such children are left running.
        selected = [(self._process, self._root)] + [
            (child["handle"], child["identity"]) for child in self._children.values()]
        selected_pids = {identity["pid"] for handle, identity in selected}
        terminated = []
        try:
            if set(self._api.job_ids(self._job, self._max_descendants + 1)) - selected_pids:
                raise BackendError("UNOBSERVED_CHILD_DURING_CLEANUP")
            # Stop the root first to prevent it creating further children. Each
            # child can still race creation; no claim of an atomic tree snapshot.
            for handle, identity in selected:
                actual = self._verify(handle, identity)
                if not actual["alive"]:
                    continue
                if not self._api.k.TerminateProcess(handle, exit_code):
                    error = _last_error("TERMINATE_PROCESS_FAILED")
                    if not self._verify(handle, identity)["alive"]:
                        continue  # It naturally exited between verification/call.
                    raise error
                terminated.append({key: actual[key] for key in ("pid", "created", "exe")})
            deadline = time.monotonic() + wait_ms / 1000.0
            active = self._api.job_ids(self._job, self._max_descendants + 1)
            while active:
                if set(active) - selected_pids:
                    raise BackendError("UNOBSERVED_CHILD_DURING_CLEANUP")
                if time.monotonic() >= deadline:
                    break
                time.sleep(min(0.02, max(0.0, deadline - time.monotonic())))
                active = self._api.job_ids(self._job, self._max_descendants + 1)
            after = self.inspect()
            active = self._api.job_ids(self._job, self._max_descendants + 1)
            if set(active) - selected_pids:
                raise BackendError("UNOBSERVED_CHILD_DURING_CLEANUP")
            empty = not active
            all_exited = (empty and after["ownership_verified"] and not after["alive"]
                          and not any(item["alive"] for item in after["descendants"]))
            return {"status": "TERMINATED" if all_exited else "CLEANUP_UNKNOWN",
                    "termination_request_accepted": bool(terminated), "all_exited": all_exited,
                    "terminated_identities": terminated, "snapshot": after}
        except BackendError as error:
            self._error(error)
            return {"status": "CLEANUP_UNKNOWN", "termination_request_accepted": bool(terminated),
                    "all_exited": False, "terminated_identities": terminated,
                    "snapshot": self.inspect(), "error": error.record()}

    def ui_status(self):
        return {"status": "UNSUPPORTED", "reason": "SUPPORTED_EXTERNAL_UI_BRIDGE_REQUIRED"}

    def request_normal_close(self):
        return self.ui_status()

    def close(self):
        if self._closed:
            return {"status": "ALREADY_CLOSED", "termination_requested": False}
        errors = []
        handles = [self._thread, self._process] + [item["handle"] for item in self._children.values()] + [self._job]
        for handle in handles:
            try:
                self._api.close(handle)
            except BackendError as error:
                errors.append(error.record())
        self._closed = True
        self._thread = self._process = self._job = None
        self._children = {}
        return {"status": "CLOSE_FAILED" if errors else "CLOSED",
                "termination_requested": False, "errors": errors}


class WinBackend(object):
    """Synthetic-only backend. Allowlist entries are complete argv sequences."""

    def __init__(self, disk_root, allowed_argvs=(), conflict_names=None, max_descendants=32):
        if os.name != "nt":
            raise BackendError("UNSUPPORTED_PLATFORM")
        if not isinstance(max_descendants, int) or isinstance(max_descendants, bool) or not 1 <= max_descendants <= 128:
            raise BackendError("INVALID_DESCENDANT_LIMIT")
        if not isinstance(disk_root, str) or not os.path.isabs(disk_root) or not os.path.isdir(disk_root):
            raise BackendError("INVALID_DISK_ROOT")
        self.disk_root = _canonical(disk_root)
        self.allowed_argvs = frozenset(self._validate_argv(argv) for argv in allowed_argvs)
        names = DEFAULT_CONFLICT_NAMES if conflict_names is None else conflict_names
        if isinstance(names, str):
            raise BackendError("INVALID_CONFLICT_NAMES")
        self.conflict_names = frozenset(str(name).lower() for name in names)
        if len(self.conflict_names) > 32 or any(not name or os.path.basename(name) != name for name in self.conflict_names):
            raise BackendError("INVALID_CONFLICT_NAMES")
        self.max_descendants = max_descendants
        self._api = _WinAPI()

    @staticmethod
    def _validate_argv(argv):
        if not isinstance(argv, (list, tuple)) or not 1 <= len(argv) <= 64:
            raise BackendError("INVALID_ARGV")
        if any(not isinstance(arg, str) or len(arg) > 16000 or any(ord(char) < 32 for char in arg) for arg in argv):
            raise BackendError("INVALID_ARGV")
        if not os.path.isabs(argv[0]) or not argv[0].lower().endswith(".exe"):
            raise BackendError("EXECUTABLE_MUST_BE_ABSOLUTE_EXE")
        command = subprocess.list2cmdline(argv)
        if len(command.encode("utf-16-le")) // 2 >= 32767:
            raise BackendError("COMMAND_LINE_TOO_LONG")
        return tuple(argv)

    def sample(self):
        start = time.monotonic()
        memory = MEMORYSTATUSEX()
        memory.dwLength = ctypes.sizeof(memory)
        if not self._api.k.GlobalMemoryStatusEx(ctypes.byref(memory)):
            raise _last_error("MEMORY_SAMPLE_FAILED")
        available, total, free = ctypes.c_ulonglong(), ctypes.c_ulonglong(), ctypes.c_ulonglong()
        if not self._api.k.GetDiskFreeSpaceExW(self.disk_root, ctypes.byref(available),
                                               ctypes.byref(total), ctypes.byref(free)):
            raise _last_error("DISK_SAMPLE_FAILED")
        end = time.monotonic()
        return {"physical_available": int(memory.ullAvailPhys),
                "commit_available": int(memory.ullAvailPageFile),
                "disk_free": int(available.value), "sampled_monotonic": end,
                "sample_duration": end - start}

    def conflicts(self):
        snapshot = self._api.snapshot()
        results = []
        for pid, entry in snapshot.items():
            if entry["name"] not in self.conflict_names:
                continue
            handle = self._api.k.OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION | SYNCHRONIZE,
                                             False, pid)
            if not handle:
                # Even an exit race blocks admission; the caller may resample.
                raise _last_error("CONFLICT_IDENTITY_UNAVAILABLE")
            try:
                identity = self._api.identity(handle)
                if identity["pid"] != pid or os.path.basename(identity["exe"]).lower() != entry["name"]:
                    raise BackendError("CONFLICT_SNAPSHOT_IDENTITY_CHANGED")
                results.append(dict(identity, name=entry["name"], parent_pid=entry["parent_pid"]))
            finally:
                self._api.close(handle)
        return results

    def ui_status(self):
        return {"status": "UNSUPPORTED", "reason": "SUPPORTED_EXTERNAL_UI_BRIDGE_REQUIRED"}

    def request_normal_close(self, owned_process=None):
        return self.ui_status()

    def launch(self, argv, cwd, stdout_path, stderr_path):
        argv = self._validate_argv(argv)
        if argv not in self.allowed_argvs:
            raise BackendError("ARGV_NOT_ALLOWLISTED")
        if os.path.basename(argv[0]).lower() in DEFAULT_CONFLICT_NAMES:
            raise BackendError("EDITOR_GAME_LAUNCH_UNSUPPORTED")
        if not os.path.isfile(argv[0]):
            raise BackendError("EXECUTABLE_NOT_FOUND")
        if not isinstance(cwd, str) or not os.path.isabs(cwd) or not os.path.isdir(cwd):
            raise BackendError("INVALID_WORKING_DIRECTORY")
        for path in (stdout_path, stderr_path):
            if (not isinstance(path, str) or not os.path.isabs(path) or
                    not os.path.isdir(os.path.dirname(path)) or os.path.lexists(path)):
                raise BackendError("OUTPUT_MUST_BE_NEW_ABSOLUTE_FILE")
        if _canonical(stdout_path) == _canonical(stderr_path):
            raise BackendError("OUTPUT_PATHS_MUST_DIFFER")
        api = self._api
        job = api.k.CreateJobObjectW(None, None)
        if not job:
            raise _last_error("CREATE_JOB_FAILED")
        streams, attribute_buffer, attributes = [], None, None
        owned = None
        try:
            limits = JOBOBJECT_EXTENDED_LIMIT_INFORMATION()
            # All limits zero: no breakaway flags and especially no kill-on-close.
            if not api.k.SetInformationJobObject(job, 9, ctypes.byref(limits), ctypes.sizeof(limits)):
                raise _last_error("SET_JOB_LIMITS_FAILED")
            if not api.k.QueryInformationJobObject(job, 9, ctypes.byref(limits), ctypes.sizeof(limits), None):
                raise _last_error("VERIFY_JOB_LIMITS_FAILED")
            if limits.BasicLimitInformation.LimitFlags != 0:
                raise BackendError("UNEXPECTED_JOB_LIMITS")
            security = SECURITY_ATTRIBUTES(ctypes.sizeof(SECURITY_ATTRIBUTES), None, True)
            for path, access, disposition in (("NUL", 0x80000000, 3),
                                              (stdout_path, 0x40000000, 1),
                                              (stderr_path, 0x40000000, 1)):
                handle = api.k.CreateFileW(path, access, 3, ctypes.byref(security), disposition, 0x80, None)
                if handle == INVALID_HANDLE_VALUE:
                    raise _last_error("CREATE_STDIO_HANDLE_FAILED")
                streams.append(handle)
            size = SIZE_T()
            api.k.InitializeProcThreadAttributeList(None, 1, 0, ctypes.byref(size))
            if ctypes.get_last_error() != ERROR_INSUFFICIENT_BUFFER or not 0 < size.value <= 65536:
                raise _last_error("ATTRIBUTE_LIST_SIZE_FAILED")
            attribute_buffer = ctypes.create_string_buffer(size.value)
            attributes = ctypes.cast(attribute_buffer, wt.LPVOID)
            if not api.k.InitializeProcThreadAttributeList(attributes, 1, 0, ctypes.byref(size)):
                attributes = None
                raise _last_error("ATTRIBUTE_LIST_INIT_FAILED")
            inherited_handles = (wt.HANDLE * len(streams))(*streams)
            if not api.k.UpdateProcThreadAttribute(attributes, 0, PROC_THREAD_ATTRIBUTE_HANDLE_LIST,
                                                    ctypes.byref(inherited_handles), ctypes.sizeof(inherited_handles), None, None):
                raise _last_error("INHERITED_HANDLE_LIST_FAILED")
            startup = STARTUPINFOEXW()
            startup.StartupInfo.cb = ctypes.sizeof(startup)
            startup.StartupInfo.dwFlags = STARTF_USESHOWWINDOW | STARTF_USESTDHANDLES
            startup.StartupInfo.wShowWindow = 0  # SW_HIDE, not UI automation.
            startup.StartupInfo.hStdInput, startup.StartupInfo.hStdOutput, startup.StartupInfo.hStdError = streams
            startup.lpAttributeList = attributes
            info = PROCESS_INFORMATION()
            command = ctypes.create_unicode_buffer(subprocess.list2cmdline(argv))
            flags = CREATE_SUSPENDED | CREATE_NO_WINDOW | EXTENDED_STARTUPINFO_PRESENT
            if not api.k.CreateProcessW(argv[0], command, None, None, True, flags, None, cwd,
                                        ctypes.byref(startup), ctypes.byref(info)):
                raise _last_error("CREATE_PROCESS_FAILED")
            owned = OwnedProcess(api, job, info, argv, self.max_descendants)
            job = None  # The retained OwnedProcess is now the only owner.
            owned._root = api.identity(owned._process)
            if (owned._root["pid"] != owned.pid or
                    _canonical(owned._root["exe"]) != _canonical(argv[0]) or not owned._root["alive"]):
                raise BackendError("SUSPENDED_ROOT_IDENTITY_MISMATCH")
            if not api.k.AssignProcessToJobObject(owned._job, owned._process):
                raise _last_error("ASSIGN_PROCESS_TO_JOB_FAILED")
            if not api.member(owned._process, owned._job):
                raise BackendError("ASSIGNED_JOB_MEMBERSHIP_UNVERIFIED")
            owned._assigned = True
            count = api.k.ResumeThread(owned._thread)
            if count == 0xffffffff:
                raise _last_error("RESUME_THREAD_FAILED")
            # Once ResumeThread succeeds, no automatic rollback may kill a child.
            owned._resumed = True
            if count != 1:
                raise BackendError("UNEXPECTED_SUSPEND_COUNT")
            return owned
        except BackendError as error:
            if owned is not None:
                if not owned._resumed:
                    # Its primary thread has never run. This exact retained handle
                    # is safe to roll back even if job assignment failed.
                    killed = api.k.TerminateProcess(owned._process, 1460)
                    waited = api.k.WaitForSingleObject(owned._process, 2000) if killed else WAIT_TIMEOUT
                    if killed and waited == WAIT_OBJECT_0:
                        closed = owned.close()
                        if closed["status"] == "CLOSE_FAILED":
                            raise BackendError("SUSPENDED_ROLLBACK_HANDLE_CLOSE_FAILED",
                                               closed["errors"][0]["winerror"], owned)
                    else:
                        error.owned_process = owned
                else:
                    error.owned_process = owned
            raise
        finally:
            if attributes:
                api.k.DeleteProcThreadAttributeList(attributes)
            # No killing in finally. Close failures are explicit; preserve any
            # owned process in the failure rather than discarding its handles.
            close_error = None
            for handle in streams + ([job] if job else []):
                try:
                    api.close(handle)
                except BackendError as error:
                    close_error = error
            if close_error:
                close_error.owned_process = owned if owned and not owned._closed else None
                raise close_error
