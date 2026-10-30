"""Resume the observed unsaved widget duplicate; set only its template text.

For root-reviewed execution in the current editor only. No duplication, loading,
save, compile, UI, Play or cook. No deprecated wrap-property access or warning
suppression. Engine property notifications may have additional effects, which
before/after native exports retain for review. Never automatically roll back or
retry after a mutation. Native calls cannot be interrupted by these guards.
"""
import datetime
import hashlib
import importlib.util
import itertools
import json
import os
from pathlib import Path
import re
import time
import uuid

ROOT = Path(__file__).resolve().parent.parent
EXPECTED_ROOT = Path(r"C:\Users\jlewi\OneDrive\Documents\ChatGPT\MW5 LANCEMATE COMPANION")
EXPECTED_PID = 20352
HELPER = ROOT / "scripts/Prepare-DiagnosticWidgetCopy.py"
HELPER_SHA256 = "281cff17905cd728e3de7444da9a65fa9b1ea6eb07cbf6e377c80184f1b2ba75"
CONTROLLER_FILE = Path(r"C:\Program Files\Epic Games\MechWarrior5Editor\MW5Mercs\Plugins\LanceObserverDiagnosticControl\ModOverride\Modes\InstantAction\InstantActionPlayerController.uasset")
PREVIOUS_CONTROLLER_PIN = (61058, "e08001c7c1c8bf5c67b5bd00dc7fb65deed4c7ac8e1935a41e48f2c0f5ab85bc")
REVIEWED_CONTROLLER_PIN = (92019, "ba725129011767a82935bd36a811ce2583bfebbfbbd8c4b2cff3fcbc1ca14948")
PRIOR = ROOT / "research/evidence/editor-source/diagnostic-widget-copy-20260925T201450Z-0d8a7d1e"
EVIDENCE_PINS = (
    ("report.json", "1e1d75b25ef98c35f9d80c00aeac68f989b491af517c3477c5c2fca61f0a89da"),
    ("widget-source.COPY", "a1724cbd1f79bce05f902d718e9062e162bb775eefc8a60f105b6533d4f4332a"),
    ("widget-defaults.COPY", "1d77c8de7050ef9c1e5781ab1cec67ad08dc8c96d48d4fcde25588c92ce1a050"),
)
REVIEWED_BASELINE = ROOT / "research/evidence/editor-source/diagnostic-widget-text-20260925T214943Z-4a63aeb9"
REVIEWED_BASELINE_PINS = (
    ("report.json", 10305, "f76f93d53b9d849048c583302f1c6de45d1d7b092109d565fe24f09ef0ea92e5"),
    ("before-source.COPY", 16812, "28c300de9adb1239c29c32a5fb62e321ebdb6af44745cd8c8d29766138fc0983"),
    ("before-defaults.COPY", 1974, "1d77c8de7050ef9c1e5781ab1cec67ad08dc8c96d48d4fcde25588c92ce1a050"),
)
ASSET = "/LanceObserverDiagnosticControl/WBP_ObserverDiagnosticControl.WBP_ObserverDiagnosticControl"
DEFAULT = "/LanceObserverDiagnosticControl/WBP_ObserverDiagnosticControl.Default__WBP_ObserverDiagnosticControl_C"
TEXT = ASSET + ":WidgetTree.SnapshotText"
OUTERS = [TEXT, ASSET + ":WidgetTree", ASSET]
BEFORE_TEXT = "Observer preview"
TARGET_TEXT = "CONTROL A \u2014 OUTPUT ONLY"
ACTIVE_KEY = "_mw5_diagnostic_widget_text_update"
MAX_FILE, MAX_TOTAL, MAX_SECONDS = 8 * 1024**2, 32 * 1024**2, 90


def digest(path):
    before = path.stat()
    if not 0 < before.st_size <= MAX_FILE:
        raise ValueError("FILE_SIZE_LIMIT")
    raw = path.read_bytes()
    after = path.stat()
    if (before.st_size, before.st_mtime_ns) != (after.st_size, after.st_mtime_ns) or len(raw) != before.st_size:
        raise ValueError("FILE_CHANGED_DURING_READ")
    return hashlib.sha256(raw).hexdigest()


def protected_files(helper):
    """Replace only the reviewed controller checkpoint; never change the helper."""
    previous = (CONTROLLER_FILE,) + PREVIOUS_CONTROLLER_PIN
    if (len(helper.PINS) != 9 or helper.PINS.count(previous) != 1
            or sum(path == CONTROLLER_FILE for path, unused_size, unused_pin in helper.PINS) != 1):
        raise ValueError("EXPECTED_EXACTLY_ONE_PREVIOUS_CONTROLLER_PIN")
    result = []
    for path, size, expected in helper.PINS:
        if path == CONTROLLER_FILE:
            size, expected = REVIEWED_CONTROLLER_PIN
        actual = helper.digest(path)
        record = {"path": str(path), "bytes": path.stat().st_size, "sha256": actual}
        if record["bytes"] != size or actual != expected:
            raise ValueError("PROTECTED_FILE_CHANGED: " + str(path))
        result.append(record)
    return result


def without_template_text(export_text):
    """Compare native exports while excluding exactly one observed text field."""
    stack, result, count = [], [], 0
    expected = ("WBP_ObserverDiagnosticControl", "WidgetTree", "SnapshotText")
    for line in export_text.splitlines():
        stripped = line.strip()
        if stripped.startswith("Begin Object "):
            match = re.search(r'\bName="([A-Za-z_][A-Za-z0-9_]*)"', stripped)
            if not match or len(stack) >= 16:
                raise ValueError("UNSUPPORTED_EXPORT_OBJECT_HEADER")
            stack.append(match.group(1))
        if tuple(stack) == expected and stripped.startswith("Text="):
            count += 1
        else:
            result.append(line)
        if stripped == "End Object":
            if not stack:
                raise ValueError("UNBALANCED_EXPORT")
            stack.pop()
    if stack or count != 1:
        raise ValueError("EXPECTED_EXACTLY_ONE_TEMPLATE_TEXT_FIELD")
    return "\n".join(result)


def read_export(path):
    raw = path.read_bytes()
    # Unreal text exports may switch to UTF-16 when non-ASCII text is present.
    # Accept only explicit UTF-16 BOMs or strict UTF-8; never replace characters.
    return raw.decode("utf-16" if raw.startswith((b"\xff\xfe", b"\xfe\xff")) else "utf-8-sig")


def native_text_literal(export_text):
    fields = re.findall(r"(?m)^\s*Text=(.*)$", export_text)
    if len(fields) != 1:
        raise ValueError("EXPECTED_ONE_NATIVE_TEXT_FIELD")
    field = fields[0].strip()
    quoted = r'"((?:\\.|[^"\\])*)"'
    localized = re.fullmatch(r"NSLOCTEXT\(" + quoted + r",\s*" + quoted + r",\s*" + quoted + r"\)", field)
    invariant = re.fullmatch(r"INVTEXT\(" + quoted + r"\)", field)
    plain = re.fullmatch(quoted, field)
    if localized:
        encoded = localized.group(3)
    elif invariant or plain:
        encoded = (invariant or plain).group(1)
    else:
        raise ValueError("UNREVIEWED_NATIVE_TEXT_SERIALIZATION")
    return json.loads('"' + encoded + '"')


def run(api):
    if ROOT.resolve() != EXPECTED_ROOT.resolve() or getattr(api, "__name__", None) != "unreal" or os.getpid() != EXPECTED_PID:
        raise ValueError("EDITOR_PROCESS_OR_SCOPE_MISMATCH")
    if digest(HELPER) != HELPER_SHA256:
        raise ValueError("REVIEWED_HELPER_CHANGED")
    # Import only reviewed constants/hash/health/parser helpers. Its native run()
    # is never called; import uses a non-__main__ module name.
    spec = importlib.util.spec_from_file_location("_mw5_widget_copy_readonly_helpers", str(HELPER))
    helper = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(helper)
    evidence = (ROOT / "research/evidence/editor-source").resolve()
    if not evidence.is_dir():
        raise ValueError("EVIDENCE_DIRECTORY_MISSING")
    for key in (ACTIVE_KEY, helper.ACTIVE_KEY) + helper.OTHER_KEYS:
        active = getattr(api, key, None)
        if active is not None and not getattr(active, "done", False):
            raise RuntimeError("OTHER_EDITOR_SCRIPT_ACTIVE")
    if any(evidence.glob(".observer-*.lock")) or any(evidence.glob(".diagnostic-*.lock")):
        raise RuntimeError("OTHER_EDITOR_SCRIPT_LOCK")
    token = uuid.uuid4().hex
    lock = evidence / ".diagnostic-widget-text-update.lock"
    with lock.open("x", encoding="ascii") as stream:
        stream.write(token)
    setattr(api, ACTIVE_KEY, token)
    stamp = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    output = evidence / ("diagnostic-widget-text-" + stamp + "-" + token[:8])
    started, total = time.monotonic(), 0
    report = {"status": "STARTED", "editor_pid": os.getpid(), "mutation_attempted": False,
              "asset": ASSET, "template_text": TEXT, "target_text": TARGET_TEXT, "errors": [], "exports": {},
              "controller_pin_supersession": {
                  "file": str(CONTROLLER_FILE),
                  "previous": {"bytes": PREVIOUS_CONTROLLER_PIN[0], "sha256": PREVIOUS_CONTROLLER_PIN[1]},
                  "reviewed_current": {"bytes": REVIEWED_CONTROLLER_PIN[0], "sha256": REVIEWED_CONTROLLER_PIN[1]},
                  "saved_at_utc": "2026-09-25T21:43:44.9336853Z",
                  "scope": "SAVED_CHECKPOINT_PIN_ONLY_NOT_FINAL_GRAPH_ACCEPTANCE"},
              "reviewed_baseline_reason": "Only unregistered EdGraph_1/ExecuteUbergraph blocks removed and two AllWidgets memberships added; other source bytes and CDO unchanged. Original evidence remains pinned.",
              "save_compile_load_duplicate_gameplay_cook": "NOT_PERFORMED",
              "memory_reserve_gate": "WAIVED_BY_USER_OBSERVE_ONLY",
              "wrap_inspection": "NATIVE_EXPORT_ONLY_NO_DEPRECATED_PROPERTY_READ",
              "limits": ["Unsaved editor memory only; later UI compile/save/readback still required.",
                         "Native calls are synchronous; guards cannot interrupt them.",
                         "No rollback or automatic retry if the text setter or later inspection fails."]}

    def prior_pins():
        for filename, expected in EVIDENCE_PINS:
            if digest(PRIOR / filename) != expected:
                raise ValueError("PRIOR_NATIVE_EVIDENCE_CHANGED: " + filename)
        if digest(HELPER) != HELPER_SHA256:
            raise ValueError("REVIEWED_HELPER_CHANGED")
        for filename, size, expected in REVIEWED_BASELINE_PINS:
            path = REVIEWED_BASELINE / filename
            if digest(path) != expected or path.stat().st_size != size:
                raise ValueError("REVIEWED_PRE_MUTATION_BASELINE_CHANGED: " + filename)
        stopped = json.loads((REVIEWED_BASELINE / "report.json").read_text(encoding="utf-8"))
        if stopped.get("status") != "STOPPED_BEFORE_TEXT_CHANGE" or stopped.get("mutation_attempted") is not False:
            raise ValueError("REVIEWED_BASELINE_MUST_BE_STOPPED_BEFORE_MUTATION")

    def check():
        report["health"] = helper.health(evidence)
        if report["health"]["disk_free"] < 2 * 1024**3:
            raise RuntimeError("DISK_RESOURCE_STOP")
        if time.monotonic() - started > MAX_SECONDS or total > MAX_TOTAL:
            raise RuntimeError("COOPERATIVE_BUDGET_STOP")
        if (output / "STOP").exists():
            raise RuntimeError("USER_STOP")
        if helper.DESTINATION_FILE.exists():
            raise ValueError("UNSAVED_WIDGET_PRECONDITION_CHANGED")
        protected_files(helper)
        prior_pins()

    def receipt(label):
        report["elapsed_seconds"] = round(time.monotonic() - started, 3)
        report["exported_bytes"] = total
        data = (json.dumps(report, indent=2, ensure_ascii=True) + "\n").encode("utf-8")
        if len(data) > 128 * 1024:
            raise RuntimeError("RECEIPT_SIZE_LIMIT")
        with (output / label).open("xb") as stream:
            stream.write(data)

    def find(path, expected_class, label):
        check()
        obj = api.find_object(None, path, follow_redirectors=False)
        info = {"found": obj is not None, "requested_path": path, "expected_class": expected_class}
        report[label] = info
        if obj is not None:
            info.update(path=obj.get_path_name(), class_path=obj.get_class().get_path_name())
        if obj is None or info["path"] != path or info["class_path"] != expected_class:
            raise ValueError("ALREADY_LOADED_IDENTITY_MISMATCH: " + label)
        return obj

    def text_object(label):
        obj = find(TEXT, "/Script/UMG.TextBlock", label)
        current, chain = obj, []
        for unused in OUTERS:
            if current is None:
                break
            chain.append(current.get_path_name())
            current = current.get_outer()
        report[label]["outer_chain"] = chain
        if chain != OUTERS:
            raise ValueError("TEMPLATE_OUTER_CHAIN_MISMATCH")
        return obj

    def export(obj, label):
        nonlocal total
        check()
        destination = output / (label + "." + extension)
        task = api.AssetExportTask()
        for key, value in {"object": obj, "exporter": exporter, "filename": str(destination),
                           "automated": True, "prompt": False, "replace_identical": False,
                           "selected": False, "use_file_archive": False, "write_empty_files": False}.items():
            task.set_editor_property(key, value)
        record = {"file": destination.name, "status": "EXPORT_STARTED"}
        report["exports"][label] = record
        record["return"] = bool(api.Exporter.run_asset_export_task(task))
        record["errors"] = [str(value)[:1000] for value in itertools.islice(task.get_editor_property("errors"), 20)]
        if not destination.is_file():
            raise RuntimeError("EXPORT_NO_FILE")
        record["bytes"] = destination.stat().st_size
        total += record["bytes"]
        record["sha256"] = helper.digest(destination)
        if not record["return"] or record["errors"] or total > MAX_TOTAL:
            raise RuntimeError("EXPORT_FAILED_OR_LIMIT")
        record["status"] = "EXPORTED_REQUIRES_REVIEW"
        check()
        return destination

    try:
        output.mkdir(exist_ok=False)
        report["output_directory"] = str(output)
        report["script_sha256"] = digest(Path(__file__))
        receipt("started.json")
        check()
        report["protected_before"] = protected_files(helper)
        report["prior_evidence_pins"] = [{"file": str(PRIOR / name), "sha256": pin} for name, pin in EVIDENCE_PINS]
        report["reviewed_baseline_pins"] = [{"file": str(REVIEWED_BASELINE / name), "bytes": size, "sha256": pin}
                                            for name, size, pin in REVIEWED_BASELINE_PINS]
        asset = find(ASSET, "/Script/UMGEditor.WidgetBlueprint", "asset_identity")
        default = find(DEFAULT, ASSET + "_C", "default_identity")
        text = text_object("text_before_identity")
        before_value = str(text.get_editor_property("text"))
        report["text_before"] = before_value
        if before_value != BEFORE_TEXT:
            raise ValueError("PREEXISTING_TEXT_CHANGED_NO_MUTATION")
        exporter = api.ObjectExporterT3D()
        formats = [str(value) for value in itertools.islice(exporter.get_editor_property("format_extension"), 16)]
        extension = next((value for preferred in ("copy", "t3d") for value in formats if value.casefold() == preferred), None)
        if not exporter.get_editor_property("text") or extension is None:
            raise RuntimeError("TEXT_EXPORTER_UNAVAILABLE")
        before_source = read_export(export(asset, "before-source"))
        before_defaults = export(default, "before-defaults").read_bytes()
        report["before_export_text_literal"] = native_text_literal(before_source)
        if report["before_export_text_literal"] != BEFORE_TEXT:
            raise ValueError("PREEXISTING_TEXT_NOT_CONFIRMED_IN_NATIVE_EXPORT")
        if helper.template_text_paths(before_source) != ["WidgetTree.SnapshotText"]:
            raise ValueError("TEMPLATE_DECLARATIONS_CHANGED")
        source_without_text = without_template_text(before_source)
        report["before_source_matches_duplication_export"] = (
            report["exports"]["before-source"]["sha256"] == EVIDENCE_PINS[1][1])
        report["before_defaults_match_duplication_export"] = (
            report["exports"]["before-defaults"]["sha256"] == EVIDENCE_PINS[2][1])
        report["before_source_matches_reviewed_baseline"] = (
            report["exports"]["before-source"]["sha256"] == REVIEWED_BASELINE_PINS[1][2])
        report["before_defaults_match_reviewed_baseline"] = (
            report["exports"]["before-defaults"]["sha256"] == REVIEWED_BASELINE_PINS[2][2])
        if not report["before_source_matches_reviewed_baseline"] or not report["before_defaults_match_reviewed_baseline"]:
            raise ValueError("PRE_MUTATION_NATIVE_EXPORT_DRIFT_REQUIRES_NEW_BASELINE_REVIEW")
        check()
        text = text_object("text_at_mutation_identity")
        if str(text.get_editor_property("text")) != BEFORE_TEXT:
            raise ValueError("PREEXISTING_TEXT_CHANGED_BEFORE_SETTER")
        report["mutation_attempted"] = True
        receipt("before-text-change.json")
        # The sole asset-property assignment. Do not write deprecated wrapping,
        # CDO fields, layout, graph content, bindings or the original widget.
        text.set_editor_property("text", api.Text(TARGET_TEXT))
        text = text_object("text_after_identity")
        report["text_after"] = str(text.get_editor_property("text"))
        if report["text_after"] != TARGET_TEXT:
            raise ValueError("TEXT_READBACK_MISMATCH")
        receipt("after-text-readback.json")
        after_source = read_export(export(asset, "after-source"))
        after_defaults = export(default, "after-defaults").read_bytes()
        report["after_export_text_literal"] = native_text_literal(after_source)
        if report["after_export_text_literal"] != TARGET_TEXT:
            raise ValueError("TARGET_TEXT_NOT_CONFIRMED_IN_NATIVE_EXPORT")
        report["source_unchanged_except_template_text"] = without_template_text(after_source) == source_without_text
        report["defaults_export_unchanged"] = after_defaults == before_defaults
        check()
        report["status"] = ("TEXT_SET_READBACK_AND_EXPORT_REQUIRES_REVIEW"
                            if report["source_unchanged_except_template_text"] and report["defaults_export_unchanged"]
                            else "TEXT_SET_ADDITIONAL_NATIVE_EXPORT_CHANGES_REVIEW_REQUIRED")
    except Exception as exc:
        report["status"] = "STOPPED_PARTIAL_TEXT_MAY_HAVE_CHANGED" if report["mutation_attempted"] else "STOPPED_BEFORE_TEXT_CHANGE"
        report["errors"].append(type(exc).__name__ + ": " + str(exc)[:2000])
    finally:
        try:
            try:
                report["protected_after"] = protected_files(helper)
                prior_pins()
                report["protected_disk_files_and_prior_evidence_unchanged"] = True
            except Exception as exc:
                report["protected_disk_files_and_prior_evidence_unchanged"] = False
                report["status"] = "STOPPED_PROTECTED_INPUT_CHANGE"
                report["errors"].append(str(exc)[:2000])
            report["destination_file_exists_after"] = helper.DESTINATION_FILE.exists()
            if output.is_dir():
                receipt("report.json")
        finally:
            if getattr(api, ACTIVE_KEY, None) == token:
                delattr(api, ACTIVE_KEY)
            if lock.exists() and lock.read_text(encoding="ascii") == token:
                lock.unlink()
    return report


if __name__ == "__main__":
    import unreal
    result = run(unreal)
    print("DIAGNOSTIC_WIDGET_TEXT: " + result["status"] + " | " + result.get("output_directory", ""))
