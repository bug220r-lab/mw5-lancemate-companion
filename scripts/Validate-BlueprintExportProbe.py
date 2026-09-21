"""Offline, strict-fake checks for Export-OpenBlueprints.py; no Unreal import.

Run with the bundled Python 3.7 executable and -B. Every output is synthetic.
Each invocation retains a unique validation folder; nothing is deleted.
"""
import datetime
import hashlib
import json
from pathlib import Path
import platform
import runpy
import sys
import uuid


PROJECT = Path(__file__).resolve().parent.parent
PROBE = PROJECT / "scripts" / "Export-OpenBlueprints.py"
PACKAGES = (
    "/Game/UI/Mech/DPad/DpadActionLogic/LanceCommands/Dpad_FormOnMeLogic",
    "/Game/UI/Mech/DPad/DpadActionLogic/LanceCommands/Dpad_LanceOrderDispatcher",
)
OBJECT_PATHS = tuple(p + "." + p.rsplit("/", 1)[1] for p in PACKAGES)
GRAPH = ("Begin Object Class=/Script/BlueprintGraph.K2Node_CallFunction Name=MockNode\n"
         " NodeGuid=0123456789ABCDEF0123456789ABCDEF\n"
         " CustomProperties Pin (PinId=11111111,LinkedTo=(MockOther 22222222,))\n"
         "End Object\n")
CANDIDATE = "CANDIDATE_GRAPH_TEXT_REQUIRES_REVIEW"


def require(condition, detail):
    if not condition:
        raise AssertionError(detail)


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def strict_api(case_root, loaded=(True, True), text=True, formats=("t3d",), plans=None):
    """Expose only the permitted Unreal API; asset objects have no mutator API."""
    state = {"finds": [], "exports": [], "tasks": [], "exporters": [],
             "metadata_reads": [], "violations": []}
    plans = plans or [{}, {}]

    def check(condition, detail):
        if not condition:
            state["violations"].append(detail)
            raise AssertionError(detail)

    class Blueprint:
        __slots__ = ("_path",)

        def __init__(self, path):
            object.__setattr__(self, "_path", path)

        def __setattr__(self, name, value):
            check(False, "Attempted asset mutation: " + name)

    assets = {p: Blueprint(p) for p, present in zip(OBJECT_PATHS, loaded) if present}

    class ObjectExporterT3D:
        __slots__ = ()

        def __init__(self):
            state["exporters"].append(self)

        def get_editor_property(self, name):
            allowed = {"format_extension": list(formats), "text": text,
                       "supported_class": "MOCK_SUPPORTED_OBJECT_CLASS"}
            check(name in allowed, "Unpermitted exporter property: " + name)
            state["metadata_reads"].append(name)
            return allowed[name]

    class AssetExportTask:
        __slots__ = ("_properties", "_errors")

        def __init__(self):
            self._properties = {}
            self._errors = []
            state["tasks"].append(self)

        def set_editor_property(self, name, value):
            allowed = {"object", "exporter", "filename", "automated", "prompt",
                       "replace_identical", "selected", "use_file_archive", "write_empty_files"}
            check(name in allowed, "Unpermitted task property: " + name)
            check(name not in self._properties, "Repeated task property: " + name)
            self._properties[name] = value

        def get_editor_property(self, name):
            check(name == "errors", "Unpermitted task read: " + name)
            return list(self._errors)

    class Exporter:
        __slots__ = ()

        @staticmethod
        def run_asset_export_task(task):
            check(type(task) is AssetExportTask, "Wrong export task type")
            values = task._properties
            flags = {"automated": True, "prompt": False, "replace_identical": False,
                     "selected": False, "use_file_archive": False, "write_empty_files": False}
            check(set(values) == set(flags) | {"object", "exporter", "filename"},
                  "Incomplete or extra export task properties")
            for name, value in flags.items():
                check(values[name] is value, "Wrong task flag: " + name)
            asset = values["object"]
            check(type(asset) is Blueprint and asset in assets.values(), "Unexpected asset")
            check(values["exporter"] in state["exporters"], "Unexpected exporter")
            destination = Path(values["filename"]).resolve()
            destination.relative_to(case_root.resolve())
            check(not destination.exists(), "Attempted output overwrite")
            index = OBJECT_PATHS.index(asset._path)
            state["exports"].append({"object_path": asset._path, "file": str(destination)})
            plan = plans[index]
            task._errors = plan.get("errors", [])
            raw = plan.get("raw", GRAPH.encode("utf-8"))
            if raw is not None:
                with destination.open("xb") as handle:
                    handle.write(raw)
            if plan.get("raise"):
                raise RuntimeError(plan["raise"])
            return plan.get("return", True)

    class API:
        __slots__ = ("Blueprint", "ObjectExporterT3D", "AssetExportTask", "Exporter")

        def find_asset(self, name, type, follow_redirectors):
            check(name in OBJECT_PATHS, "Unexpected asset lookup: " + name)
            check(type is Blueprint, "Lookup must validate Blueprint type")
            check(follow_redirectors is False, "Lookup followed redirects")
            state["finds"].append(name)
            return assets.get(name)

    api = API()
    api.Blueprint = Blueprint
    api.ObjectExporterT3D = ObjectExporterT3D
    api.AssetExportTask = AssetExportTask
    api.Exporter = Exporter
    return api, state


def main():
    stamp = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    output = PROJECT / "research" / "evidence" / "editor-source" / (
        "blueprint-export-validation-" + stamp + "-" + uuid.uuid4().hex[:8])
    output.mkdir(exist_ok=False)
    # A non-main run name prevents the guarded Unreal import and GUI entrypoint.
    namespace = runpy.run_path(str(PROBE), run_name="blueprint_export_offline_validation")
    report = {
        "classification": "MOCK_ONLY", "native_export": "NOT_PERFORMED",
        "observed_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "python_version": platform.python_version(), "python_executable": sys.executable,
        "probe_file": str(PROBE), "probe_sha256": sha(PROBE),
        "validator_sha256": sha(__file__), "output_directory": str(output),
        "limits": ["Only synthetic bytes and a strict fake API were exercised.",
                   "Candidate markers do not establish genuine or complete Blueprint graphs.",
                   "No Unreal, native asset export, editor stability or gameplay was tested.",
                   "No native-call timeout, output-size bound or acknowledgement timer is proved."],
        "tests": [],
    }

    def test(case_id, action):
        try:
            details = action(case_id) or {}
            report["tests"].append(dict(id=case_id, result="PASS", **details))
        except Exception as exc:
            report["tests"].append({"id": case_id, "result": "FAIL",
                                    "error": type(exc).__name__ + ": " + str(exc)})

    def exercise(case_id, **options):
        case_root = output / case_id
        (case_root / "research" / "evidence" / "editor-source").mkdir(parents=True)
        api, state = strict_api(case_root, **options)
        receipt = namespace["run_probe"](api, case_root)
        saved = json.loads(receipt.read_text(encoding="utf-8"))
        require(not state["violations"], repr(state["violations"]))
        require(saved["gameplay"] == "NOT_PERFORMED", "Unexpected gameplay classification")
        require(saved["script_sha256"] == report["probe_sha256"], "Probe changed during validation")
        return case_root, api, state, receipt, saved

    def happy(case_id):
        _, _, state, receipt, saved = exercise(case_id)
        require(state["finds"] == list(OBJECT_PATHS), "Loaded-only lookup sequence differs")
        require(len(state["exports"]) == 2, "Expected two qualifying exports")
        require(not saved["errors"], "Unexpected probe error")
        require(all(x["status"] == CANDIDATE for x in saved["assets"]), "Missing candidate status")
        require(saved["exporter"]["supported_class"] == "MOCK_SUPPORTED_OBJECT_CLASS", "Missing metadata")
        require(len(state["exporters"]) == 1 and len(state["tasks"]) == 2, "Unexpected object count")
        return {"report": str(receipt), "checked": "Exact paths/type/no redirects; task flags; two exports"}

    def unloaded(case_id, loaded):
        _, _, state, receipt, saved = exercise(case_id, loaded=loaded)
        require(state["finds"] == [OBJECT_PATHS[0]], "Missing prerequisite did not stop lookup")
        require(not state["exports"] and not state["tasks"], "Exported without first loaded asset")
        require(saved["assets"][0]["status"] == "NOT_ALREADY_LOADED_SKIPPED", "Missing skip evidence")
        return {"report": str(receipt)}

    def bad_exporter(case_id, **options):
        _, _, state, receipt, saved = exercise(case_id, **options)
        require(not state["finds"] and not state["exports"] and not state["tasks"], "Invalid exporter used")
        require(any("expected text format" in x for x in saved["errors"]), "Missing exporter error")
        return {"report": str(receipt)}

    def missing_marker(case_id, omit):
        raw = "\n".join(line for line in GRAPH.splitlines() if omit not in line).encode("utf-8")
        _, _, state, receipt, saved = exercise(case_id, plans=[{"raw": raw}, {}])
        require(len(state["exports"]) == 1 and state["finds"] == [OBJECT_PATHS[0]], "Expanded after missing marker")
        require(saved["assets"][0]["status"] == "NO_GRAPH_CONNECTION_EVIDENCE", "Wrong marker status")
        return {"report": str(receipt)}

    def failed_return(case_id):
        _, _, state, receipt, saved = exercise(case_id, plans=[{"return": False, "errors": ["MOCK refusal"]}, {}])
        require(len(state["exports"]) == 1 and len(state["finds"]) == 1, "Expanded after false result")
        require(saved["assets"][0]["native_export_return"] is False, "False result lost")
        require(saved["assets"][0]["exporter_errors"] == ["MOCK refusal"], "Exporter errors lost")
        return {"report": str(receipt)}

    def export_exception(case_id):
        raw = b"MOCK partial export retained\n"
        _, _, state, receipt, saved = exercise(case_id, plans=[{"raw": raw, "raise": "MOCK export exception"}, {}])
        require(len(state["exports"]) == 1 and len(state["finds"]) == 1, "Expanded after exception")
        require(any("MOCK export exception" in x for x in saved["errors"]), "Exception report lost")
        require(Path(state["exports"][0]["file"]).read_bytes() == raw, "Partial evidence lost")
        return {"report": str(receipt)}

    def no_output(case_id):
        _, _, state, receipt, saved = exercise(case_id, plans=[{"raw": None}, {}])
        require(len(state["exports"]) == 1 and len(state["finds"]) == 1, "Expanded without output")
        require(saved["assets"][0]["status"] == "NO_OUTPUT_FILE", "Missing no-output status")
        return {"report": str(receipt)}

    def invalid_encoding(case_id):
        _, _, state, receipt, saved = exercise(case_id, plans=[{"raw": b"\xff\x80"}, {}])
        require(len(state["exports"]) == 1 and len(state["finds"]) == 1, "Expanded after invalid text")
        require(any("UnicodeDecodeError" in x for x in saved["errors"]), "Decode exception lost")
        require(Path(state["exports"][0]["file"]).read_bytes() == b"\xff\x80", "Invalid bytes lost")
        return {"report": str(receipt)}

    def repeat(case_id):
        case_root, _, _, first_receipt, _ = exercise(case_id)
        snapshot = {str(p): sha(p) for p in first_receipt.parent.iterdir() if p.is_file()}
        api, state = strict_api(case_root)
        second_receipt = namespace["run_probe"](api, case_root)
        second = json.loads(second_receipt.read_text(encoding="utf-8"))
        require(not state["violations"] and not second["errors"], "Repeat run failed")
        require(first_receipt.parent != second_receipt.parent, "Output directory reused")
        require(all(Path(p).is_file() and sha(p) == digest for p, digest in snapshot.items()), "Prior evidence changed")
        return {"first_report": str(first_receipt), "second_report": str(second_receipt),
                "preserved_files": len(snapshot)}

    def utf16(case_id, endian):
        bom = b"\xff\xfe" if endian == "le" else b"\xfe\xff"
        raw = bom + GRAPH.encode("utf-16-" + endian)
        _, _, state, receipt, saved = exercise(case_id, plans=[{"raw": raw}, {"raw": raw}])
        require(len(state["exports"]) == 2, "UTF-16 candidate did not permit second export")
        require(all(a["markers"] == {"status": CANDIDATE, "node_declarations": 1,
                                    "link_fields": 1, "node_guid_fields": 1}
                    for a in saved["assets"]), "Incorrect UTF-16 marker counts")
        return {"report": str(receipt), "encoding": "UTF-16-" + endian.upper()}

    def uppercase_formats(case_id):
        _, _, state, receipt, saved = exercise(case_id, formats=("T3D", "COPY"))
        require(state["finds"] == list(OBJECT_PATHS), "Uppercase formats prevented exact asset lookups")
        require(len(state["exports"]) == 2 and not saved["errors"], "Uppercase formats prevented exports")
        require(saved["exporter"]["formats"] == ["T3D", "COPY"], "Advertised format evidence changed")
        require(all(a["status"] == CANDIDATE for a in saved["assets"]), "Candidate status missing")
        require(all(Path(a["file"]).suffix == ".COPY" for a in saved["assets"]),
                "Preferred COPY extension lost its advertised case")
        require(all(Path(a["file"]).is_file() for a in saved["assets"]), "COPY output not retained")
        return {"report": str(receipt), "advertised_formats": ["T3D", "COPY"],
                "expected_filename_extension": ".COPY"}

    test("BPV-01-two-qualifying-exact-loaded-lookups", happy)
    test("BPV-02-both-assets-unloaded", lambda c: unloaded(c, (False, False)))
    test("BPV-03-first-unloaded-second-loaded", lambda c: unloaded(c, (False, True)))
    test("BPV-04-nontext-exporter", lambda c: bad_exporter(c, text=False))
    test("BPV-05-no-supported-extension", lambda c: bad_exporter(c, formats=("bin",)))
    test("BPV-06-no-node-marker", lambda c: missing_marker(c, "Begin Object"))
    test("BPV-07-no-link-marker", lambda c: missing_marker(c, "LinkedTo"))
    test("BPV-08-no-guid-marker", lambda c: missing_marker(c, "NodeGuid"))
    test("BPV-09-false-native-result", failed_return)
    test("BPV-10-exception-keeps-report-and-partial-bytes", export_exception)
    test("BPV-11-no-output-file", no_output)
    test("BPV-12-invalid-encoding-keeps-evidence", invalid_encoding)
    test("BPV-13-repeat-preserves-earlier-output", repeat)
    test("BPV-14-utf16-le-markers", lambda c: utf16(c, "le"))
    test("BPV-15-utf16-be-markers", lambda c: utf16(c, "be"))
    test("BPV-16-uppercase-formats-preserve-COPY-extension", uppercase_formats)
    report["probe_sha256_after"] = sha(PROBE)
    report["probe_unchanged"] = report["probe_sha256_after"] == report["probe_sha256"]
    report["test_count"] = len(report["tests"])
    report["passed"] = sum(t["result"] == "PASS" for t in report["tests"])
    report["failed"] = report["test_count"] - report["passed"]
    report["result"] = "PASS_MOCK_ONLY" if not report["failed"] and report["probe_unchanged"] else "FAIL_MOCK_ONLY"
    summary = output / "summary.json"
    with summary.open("x", encoding="utf-8") as handle:
        json.dump(report, handle, indent=2)
        handle.write("\n")
    print(json.dumps({"result": report["result"], "passed": report["passed"],
                      "test_count": report["test_count"], "summary": str(summary)}))
    return 0 if report["result"] == "PASS_MOCK_ONLY" else 1


if __name__ == "__main__":
    sys.exit(main())
