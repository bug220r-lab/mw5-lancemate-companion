"""Read-only attribution and validation for the bounded observer lookup.

Python 3.7 standard library only. No helper import/execution, editor API, process
control, file mutation, recursive inventory, or raw log/query-text return.
"""
import datetime
import hashlib
import json
import math
import os
from pathlib import Path
import re
import stat


DIRECTORY_RE = re.compile(r"^observer-references-(\d{8}T\d{6}Z)-[0-9a-f]{12}$")
MAX_DIRECTORIES = 256
MAX_LOG = 64 * 1024 * 1024
MAX_JSON_TOTAL = 1081344
MAX_STOP = 4096
MARKER = b"Observer reference lookup: "
TARGET_PACKAGES = (
    "/Game/Objects/_common/MW5PlayerController",
    "/Game/Modes/InstantAction/InstantActionPlayerController",
    "/Game/Objects/_common/Components/PlayerControllerComponents/PlayerControllerComponentDataAsset",
)
EXPECTED_OPTIONS = {
    "include_soft_package_references": True, "include_hard_package_references": True,
    "include_searchable_names": False, "include_soft_management_references": False,
    "include_hard_management_references": False,
}
EXPECTED_LIMITS = {"queries": 3, "per_target": 512, "total_entries": 1024,
                   "name_characters": 512, "encoded_name_bytes": 768,
                   "report_bytes": 1048576, "cooperative_seconds": 60}
FILE_LIMITS = dict({"started.json": 16384, "report.json": 1048576, "STOP": MAX_STOP},
                   **{"checkpoint-%02d.json" % n: 4096 for n in range(4)})
FINAL_STATUSES = {"COLLECTED_REQUIRES_REVIEW", "MOCK_ONLY_COMPLETED",
                  "STOPPED_REGISTRY_LOADING", "PARTIAL_NULL_RETURN", "PARTIAL_CAP_REACHED",
                  "PARTIAL_REGISTRY_LOADING", "ERROR_EVIDENCE_RETAINED"}
REPORT_FIELDS = {"status", "classification", "native_execution", "gameplay",
                 "asset_load_export_save_compile_cook", "output_directory", "source_before",
                 "source_after", "script", "options", "queries", "errors", "total_retained_entries",
                 "limits", "interpretation", "last_health", "registry_loading_before",
                 "source_hashes_unchanged", "elapsed_seconds"}


class EvidenceError(ValueError):
    """Only a bounded public code; exception text never includes log content."""
    def __init__(self, code):
        self.code = code if isinstance(code, str) and re.fullmatch(r"[A-Z0-9_]{1,64}", code) else "EVIDENCE_ERROR"
        super().__init__(self.code)


def _need(condition, code):
    if not condition:
        raise EvidenceError(code)


def reject_reparse(path, require_exists=True):
    """Return an absolute Path after lstat-checking it and every existing ancestor."""
    try:
        _need(".." not in Path(path).parts, "PATH_TRAVERSAL")
        absolute = Path(os.path.abspath(os.fspath(path)))
        for item in list(reversed(absolute.parents)) + [absolute]:
            try:
                info = os.lstat(str(item))
            except FileNotFoundError:
                if require_exists:
                    raise EvidenceError("PATH_MISSING")
                continue
            _need(not stat.S_ISLNK(info.st_mode)
                  and not (getattr(info, "st_file_attributes", 0) & 0x400), "REPARSE_PATH")
        return absolute.resolve(strict=require_exists)
    except EvidenceError:
        raise
    except (OSError, TypeError, ValueError):
        raise EvidenceError("PATH_UNAVAILABLE")


def _signature(info):
    return (info.st_dev, info.st_ino, info.st_size,
            getattr(info, "st_mtime_ns", int(info.st_mtime * 1e9)),
            getattr(info, "st_ctime_ns", int(info.st_ctime * 1e9)))


def _read_stable(path, max_bytes, collect=False, consume=None):
    _need(type(max_bytes) is int and max_bytes >= 0, "INVALID_BYTE_LIMIT")
    path = reject_reparse(path)
    try:
        before = os.lstat(str(path))
        _need(stat.S_ISREG(before.st_mode), "NOT_REGULAR_FILE")
        _need(before.st_size <= max_bytes, "FILE_SIZE_LIMIT")
        result, chunks, count = hashlib.sha256(), [], 0
        with path.open("rb") as stream:
            _need(_signature(os.fstat(stream.fileno())) == _signature(before), "FILE_CHANGED")
            while True:
                chunk = stream.read(min(65536, max_bytes - count + 1))
                if not chunk:
                    break
                count += len(chunk)
                _need(count <= max_bytes, "FILE_SIZE_LIMIT")
                result.update(chunk)
                if collect:
                    chunks.append(chunk)
                if consume is not None:
                    consume(chunk)
            _need(_signature(os.fstat(stream.fileno())) == _signature(before), "FILE_CHANGED")
        reject_reparse(path)
        after = os.lstat(str(path))
        _need(_signature(after) == _signature(before) and count == after.st_size, "FILE_CHANGED")
        return {"path": str(path), "bytes": count, "sha256": result.hexdigest()}, b"".join(chunks)
    except EvidenceError:
        raise
    except (OSError, ValueError):
        raise EvidenceError("FILE_READ_FAILED")


def stable_hash(path, max_bytes):
    return _read_stable(path, max_bytes)[0]


def _pairs(pairs):
    result = {}
    for key, value in pairs:
        _need(key not in result, "JSON_DUPLICATE_KEY")
        result[key] = value
    return result


def _constant(unused):
    raise EvidenceError("JSON_NONFINITE_NUMBER")


def _float(value):
    number = float(value)
    _need(math.isfinite(number), "JSON_NONFINITE_NUMBER")
    return number


def _integer(value):
    _need(len(value) <= 64, "JSON_NUMBER_LIMIT")
    return int(value)


def _json_file(path, max_bytes):
    pin, raw = _read_stable(path, max_bytes, collect=True)
    try:
        value = json.loads(raw.decode("utf-8-sig"), object_pairs_hook=_pairs, parse_constant=_constant,
                           parse_float=_float, parse_int=_integer)
    except EvidenceError:
        raise
    except (UnicodeError, ValueError, RecursionError):
        raise EvidenceError("JSON_INVALID")
    return value, pin


def bounded_json(path, max_bytes):
    return _json_file(path, max_bytes)[0]


def _timestamp(value):
    if isinstance(value, datetime.datetime):
        _need(value.tzinfo is not None, "TIMEZONE_REQUIRED")
        value = value.timestamp()
    elif isinstance(value, str):
        try:
            parsed = datetime.datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            raise EvidenceError("INVALID_TIME_INTERVAL")
        _need(parsed.tzinfo is not None, "TIMEZONE_REQUIRED")
        value = parsed.timestamp()
    _need(type(value) in (int, float) and math.isfinite(value), "INVALID_TIME_INTERVAL")
    return float(value)


def inventory(parent):
    """Only direct children with the exact helper directory convention are inventoried."""
    parent = reject_reparse(parent)
    try:
        _need(parent.is_dir(), "PARENT_NOT_DIRECTORY")
        parent_device = os.lstat(str(parent)).st_dev
        result = {}
        with os.scandir(str(parent)) as entries:
            for entry in entries:
                match = DIRECTORY_RE.fullmatch(entry.name)
                if match is None:
                    continue
                _need(len(result) < MAX_DIRECTORIES, "DIRECTORY_COUNT_LIMIT")
                try:
                    datetime.datetime.strptime(match.group(1), "%Y%m%dT%H%M%SZ")
                except ValueError:
                    raise EvidenceError("INVALID_DIRECTORY_TIMESTAMP")
                child = reject_reparse(parent / entry.name)
                info = os.lstat(str(child))
                _need(stat.S_ISDIR(info.st_mode), "EVIDENCE_NOT_DIRECTORY")
                _need(info.st_dev == parent_device, "FILESYSTEM_MISMATCH")
                created = getattr(info, "st_birthtime", info.st_ctime)
                _need(math.isfinite(created), "INVALID_DIRECTORY_TIMESTAMP")
                result[entry.name] = {"path": str(child), "created_timestamp": created,
                                      "created_utc": datetime.datetime.fromtimestamp(
                                          created, datetime.timezone.utc).isoformat()}
        return result
    except EvidenceError:
        raise
    except OSError:
        raise EvidenceError("INVENTORY_FAILED")


def _path_key(value):
    _need(isinstance(value, str) and 0 < len(value) <= 32768
          and not any(ord(char) < 32 for char in value), "INVALID_RECORDED_PATH")
    _need(Path(value).is_absolute(), "RECORDED_PATH_NOT_ABSOLUTE")
    _need(".." not in Path(value).parts, "PATH_TRAVERSAL")
    return os.path.normcase(os.path.abspath(value))


def _pin(value, package=False):
    fields = {"path", "bytes", "sha256"} | ({"package"} if package else set())
    _need(type(value) is dict and set(value) == fields, "INVALID_PIN")
    _path_key(value["path"])
    _need(type(value["bytes"]) is int and value["bytes"] > 0, "INVALID_PIN")
    _need(isinstance(value["sha256"], str)
          and re.fullmatch(r"[0-9a-fA-F]{64}", value["sha256"]) is not None, "INVALID_PIN")
    return value


def _pin_equal(actual, expected, package=False):
    _pin(actual, package)
    return (_path_key(actual["path"]) == _path_key(expected["path"])
            and actual["bytes"] == expected["bytes"]
            and actual["sha256"].lower() == expected["sha256"].lower()
            and (not package or actual["package"] == expected["package"]))


def _pins_equal(values, targets):
    return (type(values) is list and len(values) == len(targets)
            and all(_pin_equal(value, target, True) for value, target in zip(values, targets)))


def _marker(log_path):
    state = {"pending": b"", "markers": []}

    def line(raw):
        count = raw.count(MARKER)
        if not count:
            return
        _need(count == 1 and not state["markers"], "MULTIPLE_COMPLETION_MARKERS")
        payload = raw.split(MARKER, 1)[1].rstrip(b"\r")
        _need(len(payload) <= 32768, "COMPLETION_MARKER_LIMIT")
        try:
            text = payload.decode("utf-8")
        except UnicodeError:
            raise EvidenceError("COMPLETION_MARKER_INVALID")
        match = re.fullmatch(r"([A-Z_]{1,64}) \| (.+)", text)
        _need(match is not None, "COMPLETION_MARKER_INVALID")
        _path_key(match.group(2))
        state["markers"].append((match.group(1), match.group(2)))

    def consume(chunk):
        pending = state["pending"] + chunk
        parts = pending.split(b"\n")
        for complete in parts[:-1]:
            line(complete)
        pending = parts[-1]
        if MARKER not in pending:
            pending = pending[-(len(MARKER) - 1):]
        else:
            pending = pending[pending.index(MARKER):]
            _need(len(pending) <= 32768 + len(MARKER), "COMPLETION_MARKER_LIMIT")
        state["pending"] = pending

    pin, unused = _read_stable(log_path, MAX_LOG, consume=consume)
    line(state["pending"])
    return state["markers"], pin


def _exact_options(value):
    return (type(value) is dict and set(value) == set(EXPECTED_OPTIONS)
            and all(value[key] is expected for key, expected in EXPECTED_OPTIONS.items()))


def _header(value, output, helper_pin, targets, native):
    _need(type(value) is dict, "REPORT_NOT_OBJECT")
    _need(set(value) <= REPORT_FIELDS, "REPORT_UNEXPECTED_FIELD")
    _need(_path_key(value.get("output_directory")) == _path_key(str(output)), "REPORT_OUTPUT_MISMATCH")
    _need(value.get("classification") == ("EDITOR_METADATA_ONLY" if native else "MOCK_ONLY")
          and value.get("native_execution") == ("ATTEMPTED" if native else "NOT_PERFORMED"),
          "REPORT_CLASSIFICATION_MISMATCH")
    _need(value.get("gameplay") == "NOT_PERFORMED"
          and value.get("asset_load_export_save_compile_cook") == "NOT_PERFORMED", "REPORT_SCOPE_MISMATCH")
    _need(_pin_equal(value.get("script"), helper_pin), "HELPER_PIN_MISMATCH")
    _need(_pins_equal(value.get("source_before"), targets), "SOURCE_BEFORE_MISMATCH")
    _need(_exact_options(value.get("options")), "REPORT_OPTIONS_MISMATCH")
    limits = value.get("limits")
    _need(type(limits) is dict and set(limits) == set(EXPECTED_LIMITS)
          and all(type(limits[key]) is int and limits[key] == limit
                  for key, limit in EXPECTED_LIMITS.items()), "REPORT_LIMITS_MISMATCH")


def _name(value):
    _need(isinstance(value, str) and value.startswith("/") and len(value) <= 512
          and not any(ord(char) < 32 for char in value)
          and not any(char in value for char in "\\.:")
          and all(value.split("/")[1:])
          and len(json.dumps(value, ensure_ascii=False).encode("utf-8")) <= 768, "INVALID_REFERENCE_NAME")


def _queries(report, native):
    queries, errors = report.get("queries"), report.get("errors")
    _need(type(queries) is list and len(queries) <= 3, "QUERY_COUNT_INVALID")
    _need(type(errors) is list and len(errors) <= 2
          and all(isinstance(error, str) and len(error) <= 1600 for error in errors), "REPORT_ERRORS_INVALID")
    total = 0
    expected_observed = "OBSERVED_PACKAGE_REFERENCES" if native else "MOCK_ONLY"
    for index, query in enumerate(queries):
        _need(type(query) is dict and query.get("package") == TARGET_PACKAGES[index], "QUERY_ORDER_MISMATCH")
        _need(set(query) <= {"package", "status", "referencers", "registry_loading_after",
                             "returned_count", "retained_count"}, "QUERY_UNEXPECTED_FIELD")
        status, names = query.get("status"), query.get("referencers")
        _need(status in {expected_observed, "QUERY_STARTED", "NULL_RETURN", "TRUNCATED_AT_CAP"},
              "QUERY_STATUS_INVALID")
        _need(type(names) is list and len(names) <= min(512, 1024 - total), "RETAINED_COUNT_INVALID")
        for name in names:
            _name(name)
        allowance = min(512, 1024 - total)
        total += len(names)
        if "registry_loading_after" in query:
            _need(type(query["registry_loading_after"]) is bool, "REGISTRY_LOADING_INVALID")
        if "retained_count" in query:
            _need(type(query["retained_count"]) is int and query["retained_count"] == len(names),
                  "RETAINED_COUNT_INVALID")
        if status == "NULL_RETURN":
            _need(not names and "returned_count" not in query and "retained_count" not in query
                  and type(query.get("registry_loading_after")) is bool, "NULL_RETURN_INVALID")
        elif status in {expected_observed, "TRUNCATED_AT_CAP"}:
            count = query.get("returned_count")
            _need(type(count) is int and count >= 0 and type(query.get("registry_loading_after")) is bool
                  and query.get("retained_count") == len(names), "QUERY_COUNTS_INVALID")
            if status == expected_observed:
                _need(count == len(names), "QUERY_COUNTS_INVALID")
            else:
                _need(count > allowance and len(names) == allowance, "TRUNCATION_INVALID")
        elif "returned_count" in query:
            _need(type(query["returned_count"]) is int and query["returned_count"] >= len(names),
                  "QUERY_COUNTS_INVALID")
        else:
            _need(not names, "QUERY_COUNTS_INVALID")
        if status != expected_observed or query.get("registry_loading_after") is True:
            _need(index == len(queries) - 1, "QUERY_AFTER_STOP")
    _need(type(report.get("total_retained_entries")) is int
          and report["total_retained_entries"] == total, "TOTAL_COUNT_MISMATCH")
    return queries, errors, total


def _final_report(report, native):
    status = report.get("status")
    _need(status in FINAL_STATUSES, "REPORT_STATUS_INVALID")
    _need(status not in ({"MOCK_ONLY_COMPLETED"} if native else {"COLLECTED_REQUIRES_REVIEW"}),
          "REPORT_CLASSIFICATION_MISMATCH")
    queries, errors, total = _queries(report, native)
    loading = report.get("registry_loading_before")
    _need(loading is None or type(loading) is bool, "REGISTRY_LOADING_INVALID")
    completed = status in {"COLLECTED_REQUIRES_REVIEW", "MOCK_ONLY_COMPLETED"}
    expected_observed = "OBSERVED_PACKAGE_REFERENCES" if native else "MOCK_ONLY"
    if completed:
        _need(len(queries) == 3 and loading is False and not errors
              and all(query["status"] == expected_observed and query.get("registry_loading_after") is False
                      for query in queries), "FALSE_COMPLETION_CLAIM")
    elif status == "STOPPED_REGISTRY_LOADING":
        _need(loading is True and not queries and not errors, "LOADING_STATUS_MISMATCH")
    elif status == "PARTIAL_NULL_RETURN":
        _need(loading is False and bool(queries) and queries[-1]["status"] == "NULL_RETURN" and not errors,
              "NULL_STATUS_MISMATCH")
    elif status == "PARTIAL_CAP_REACHED":
        _need(loading is False and bool(queries) and queries[-1]["status"] == "TRUNCATED_AT_CAP" and not errors,
              "CAP_STATUS_MISMATCH")
    elif status == "PARTIAL_REGISTRY_LOADING":
        _need(loading is False and bool(queries) and queries[-1]["status"] == expected_observed
              and queries[-1].get("registry_loading_after") is True and not errors, "LOADING_STATUS_MISMATCH")
    else:
        _need(bool(errors), "ERROR_STATUS_WITHOUT_ERRORS")
    _need(not queries or loading is False, "QUERY_WHILE_REGISTRY_LOADING")
    elapsed = report.get("elapsed_seconds")
    _need(type(elapsed) in (int, float) and math.isfinite(elapsed) and elapsed >= 0, "ELAPSED_TIME_INVALID")
    return completed, len(queries), total


def _attribute(parent, before_names, log_path, started_utc, ended_utc,
               helper_pin, targets, options, native=True):
    """Attribute exactly one invocation, retaining partial outcomes without success promotion."""
    _need(type(native) is bool, "INVALID_MODE")
    start, end = _timestamp(started_utc), _timestamp(ended_utc)
    _need(start <= end, "INVALID_TIME_INTERVAL")
    _pin(helper_pin)
    _need(type(targets) in (list, tuple) and len(targets) == 3, "TARGET_SCOPE_INVALID")
    for index, target in enumerate(targets):
        _pin(target, True)
        _need(target["package"] == TARGET_PACKAGES[index], "TARGET_SCOPE_INVALID")
    _need(_exact_options(options), "OPTIONS_SCOPE_INVALID")
    _need(type(before_names) in (list, tuple, set) and len(before_names) <= MAX_DIRECTORIES
          and all(isinstance(name, str) and DIRECTORY_RE.fullmatch(name) for name in before_names)
          and len(set(before_names)) == len(before_names), "BEFORE_INVENTORY_INVALID")
    parent = reject_reparse(parent)
    current = inventory(parent)
    _need(set(before_names) <= set(current), "PRIOR_DIRECTORY_DISAPPEARED")
    added = set(current) - set(before_names)
    _need(bool(added), "NO_NEW_EVIDENCE_DIRECTORY")
    _need(len(added) == 1, "MULTIPLE_NEW_EVIDENCE_DIRECTORIES")
    item = current[next(iter(added))]
    output = reject_reparse(item["path"])
    _need(output.parent == parent and start <= item["created_timestamp"] <= end, "DIRECTORY_TIME_OR_PARENT_MISMATCH")
    log_path = reject_reparse(log_path)
    _need(os.lstat(str(log_path)).st_dev == os.lstat(str(parent)).st_dev, "FILESYSTEM_MISMATCH")
    markers, log_pin = _marker(log_path)
    parsed, file_pins, json_total = {}, [], 0
    try:
        with os.scandir(str(output)) as entries:
            for entry in entries:
                _need(entry.name in FILE_LIMITS, "UNEXPECTED_EVIDENCE_FILE")
                path = reject_reparse(output / entry.name)
                _need(os.lstat(str(path)).st_dev == os.lstat(str(parent)).st_dev, "FILESYSTEM_MISMATCH")
                if entry.name == "STOP":
                    pin = stable_hash(path, MAX_STOP)
                else:
                    value, pin = _json_file(path, FILE_LIMITS[entry.name])
                    parsed[entry.name] = value
                    json_total += pin["bytes"]
                    _need(json_total <= MAX_JSON_TOTAL, "EVIDENCE_JSON_TOTAL_LIMIT")
                file_pins.append(pin)
    except EvidenceError:
        raise
    except OSError:
        raise EvidenceError("EVIDENCE_DIRECTORY_READ_FAILED")
    if "started.json" in parsed:
        initial = parsed["started.json"]
        _header(initial, output, helper_pin, targets, native)
        _need(initial.get("status") == "STARTED" and initial.get("queries") == []
              and initial.get("errors") == [] and initial.get("source_after") is None
              and type(initial.get("total_retained_entries")) is int
              and initial["total_retained_entries"] == 0, "STARTED_RECEIPT_INVALID")
    checkpoint_names = sorted(name for name in parsed if name.startswith("checkpoint-"))
    _need(checkpoint_names == ["checkpoint-%02d.json" % n for n in range(len(checkpoint_names))],
          "CHECKPOINT_SEQUENCE_INVALID")
    for index, name in enumerate(checkpoint_names):
        checkpoint = parsed[name]
        expected_stage = "GET_EXISTING_REGISTRY" if index == 0 else "QUERY " + TARGET_PACKAGES[index - 1]
        _need(type(checkpoint) is dict and set(checkpoint) == {"stage", "elapsed_seconds",
              "completed_query_count", "native_execution"} and checkpoint.get("stage") == expected_stage
              and checkpoint.get("native_execution") == ("ATTEMPTED" if native else "NOT_PERFORMED")
              and type(checkpoint.get("completed_query_count")) is int
              and checkpoint["completed_query_count"] == max(0, index - 1), "CHECKPOINT_INVALID")
        seconds = checkpoint.get("elapsed_seconds")
        _need(type(seconds) in (int, float) and math.isfinite(seconds) and seconds >= 0, "CHECKPOINT_INVALID")
    _need(not checkpoint_names or "started.json" in parsed, "STARTED_RECEIPT_MISSING")
    result = {"classification": "EDITOR_METADATA_ONLY" if native else "MOCK_ONLY",
              "native_execution": "ATTEMPTED" if native else "NOT_PERFORMED",
              "output_directory": str(output), "log": log_pin,
              "files": sorted(file_pins, key=lambda pin: pin["path"]), "completed": False}
    if "report.json" not in parsed:
        _need(not markers, "COMPLETION_MARKER_WITHOUT_REPORT")
        if native and "started.json" not in parsed:
            result.update(classification="INCOMPLETE_EVIDENCE", native_execution="NOT_ESTABLISHED")
        result.update(code="PARTIAL_REPORT_ABSENT", status="PARTIAL_REPORT_ABSENT", report_path=None)
        return result
    _need("started.json" in parsed and bool(checkpoint_names), "STARTED_RECEIPT_MISSING")
    _need(len(markers) == 1, "COMPLETION_MARKER_MISSING")
    report = parsed["report.json"]
    _header(report, output, helper_pin, targets, native)
    _need(markers[0][0] == report.get("status")
          and _path_key(markers[0][1]) == _path_key(str(output)), "COMPLETION_MARKER_MISMATCH")
    _need(_pins_equal(report.get("source_after"), targets)
          and report.get("source_hashes_unchanged") is True, "SOURCE_AFTER_MISMATCH")
    complete, query_count, total = _final_report(report, native)
    _need(len(checkpoint_names) == query_count + 1, "CHECKPOINT_QUERY_COUNT_MISMATCH")
    result.update(code=("ATTRIBUTED_METADATA_COMPLETE" if native else "MOCK_ONLY_METADATA_COMPLETE")
                  if complete else "ATTRIBUTED_" + report["status"], status=report["status"],
                  completed=complete, report_path=str(output / "report.json"),
                  query_count=query_count, total_retained_entries=total,
                  query_statuses=[query["status"] for query in report["queries"]],
                  error_count=len(report["errors"]),
                  registry_loading_before=report.get("registry_loading_before"),
                  registry_loading_after=[query.get("registry_loading_after") for query in report["queries"]])
    return result


def attribute(parent, before_names, log_path, started_utc, ended_utc,
              helper_pin, targets, options, native=True):
    """Public attribution boundary with bounded failure codes, never raw OS/log text."""
    try:
        return _attribute(parent, before_names, log_path, started_utc, ended_utc,
                          helper_pin, targets, options, native=native)
    except EvidenceError:
        raise
    except OSError:
        raise EvidenceError("EVIDENCE_IO_FAILED")
    except (TypeError, ValueError, OverflowError, RecursionError):
        raise EvidenceError("EVIDENCE_INPUT_INVALID")
