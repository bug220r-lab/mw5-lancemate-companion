"""Offline strict-fake checks for Collect-ModResearch.py; run with Python 3.7 -B.

No Unreal import or native editor/game call. Exact installed scope files and
prior exports are hashed read-only. Synthetic test artifacts are retained in
a unique project-local validation folder. Fakes do not establish native API
compatibility, dependency cost, output completeness or shipping behavior.
"""
import copy
import datetime
import hashlib
import json
import os
from pathlib import Path
import platform
import runpy
import sys
import uuid

PROJECT = Path(__file__).resolve().parent.parent
COLLECTOR = PROJECT / "scripts/Collect-ModResearch.py"
GOOD = {"disk_free": 8 * 1024 ** 3, "physical_available": 3 * 1024 ** 3,
        "commit_available": 4 * 1024 ** 3}
GRAPH = b"Begin Object Name=Mock\nNodeGuid=01234567\nLinkedTo=(MockOther)\nEnd Object\n"


def require(condition, message):
    if not condition:
        raise AssertionError(message)


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


class FakeClock:
    def __init__(self):
        self.value = 0.0

    def __call__(self):
        return self.value


def strict_api(root, entries, plans=None):
    """Only inspected collector APIs exist; every unrecognized call fails."""
    plans = plans or {}
    state = {"finds": [], "loads": [], "exports": [], "violations": [],
             "dependencies": [], "metadata": [], "callbacks": {},
             "registered": [], "unregistered": [], "logs": []}
    paths = {e["object_path"]: e for e in entries}
    registry_options = {
        "include_soft_package_references": True,
        "include_hard_package_references": True,
        "include_searchable_names": False,
        "include_soft_management_references": False,
        "include_hard_management_references": False,
    }

    def check(condition, message):
        if not condition:
            state["violations"].append(message)
            raise AssertionError(message)

    class Asset:
        __slots__ = ("_path",)

        def __init__(self, path):
            object.__setattr__(self, "_path", path)

        def get_path_name(self):
            return plans.get(self._path, {}).get("identity", self._path)

        def __setattr__(self, name, value):
            check(False, "Asset mutation attempted: " + name)

        def __getattr__(self, name):
            check(False, "Unpermitted asset method: " + name)

    class Blueprint(Asset):
        __slots__ = ()

    class BehaviorTree(Asset):
        __slots__ = ()

    class BlackboardData(Asset):
        __slots__ = ()

    types = {c.__name__: c for c in (Blueprint, BehaviorTree, BlackboardData)}
    assets = {p: types[e["expected_asset_type"]](p) for p, e in paths.items()}

    class ObjectExporterT3D:
        __slots__ = ()

        def get_editor_property(self, name):
            fields = {"format_extension": ["T3D", "COPY"], "text": True}
            check(name in fields, "Unpermitted exporter property: " + name)
            return fields[name]

    class AssetExportTask:
        __slots__ = ("values", "errors")

        def __init__(self):
            self.values, self.errors = {}, []

        def set_editor_property(self, name, value):
            check(name in ("object", "exporter", "filename", "automated", "prompt",
                           "replace_identical", "selected", "use_file_archive",
                           "write_empty_files"), "Unpermitted task field: " + name)
            check(name not in self.values, "Duplicate task field: " + name)
            self.values[name] = value

        def get_editor_property(self, name):
            check(name == "errors", "Unpermitted task read: " + name)
            return self.errors

    class Exporter:
        @staticmethod
        def run_asset_export_task(task):
            flags = {"automated": True, "prompt": False, "replace_identical": False,
                     "selected": False, "use_file_archive": False, "write_empty_files": False}
            check(set(task.values) == set(flags) | {"object", "exporter", "filename"},
                  "Wrong task field set")
            for name, value in flags.items():
                check(task.values[name] is value, "Unsafe export flag: " + name)
            asset = task.values["object"]
            check(asset in assets.values(), "Export asset outside exact scope")
            check(type(task.values["exporter"]) is ObjectExporterT3D, "Wrong exporter")
            destination = Path(task.values["filename"]).resolve()
            destination.relative_to(root.resolve())
            check(destination.suffix == ".COPY", "Advertised COPY spelling was not preserved")
            check(not destination.exists(), "Would overwrite existing output")
            state["exports"].append(asset._path)
            plan = plans.get(asset._path, {})
            if not plan.get("no_file"):
                destination.write_bytes(plan.get("content", GRAPH))
            task.errors.extend(plan.get("errors", []))
            if plan.get("export_exception"):
                raise RuntimeError("Synthetic exporter interruption")
            return plan.get("export_return", True)

    class AssetRegistryDependencyOptions:
        def __init__(self, **options):
            check(options == registry_options, "Unexpected registry dependency options")

    class Metadata:
        __slots__ = ("asset_class",)

        def __init__(self, value):
            self.asset_class = value

    class Registry:
        def is_loading_assets(self):
            return False

        def get_dependencies(self, package, options):
            check(package in [e["package_path"] for e in entries], "Registry package outside scope")
            check(type(options) is AssetRegistryDependencyOptions, "Wrong registry options")
            state["dependencies"].append(package)
            return ["/Game/MockDependencyNotLoaded"]

        def get_asset_by_object_path(self, path, include_only_on_disk_assets=False):
            check(path in paths and include_only_on_disk_assets is True, "Unsafe metadata query")
            state["metadata"].append(path)
            if plans.get(path, {}).get("on_metadata"):
                plans[path]["on_metadata"]()
            return Metadata(paths[path]["expected_asset_type"])

    class AssetRegistryHelpers:
        @staticmethod
        def get_asset_registry():
            return Registry()

    class API:
        def find_asset(self, path, type=None, follow_redirectors=None):
            check(path in paths, "Asset find outside scope")
            check(type is types[paths[path]["expected_asset_type"]], "Untyped/wrong asset find")
            check(follow_redirectors is False, "Redirect following on find")
            state["finds"].append(path)
            return assets[path] if plans.get(path, {}).get("loaded") else None

        def load_asset(self, path, type=None, follow_redirectors=None):
            check(path in paths, "Asset load outside scope")
            check(type is types[paths[path]["expected_asset_type"]], "Untyped/wrong asset load")
            check(follow_redirectors is False, "Redirect following on load")
            state["loads"].append(path)
            plan = plans.get(path, {})
            if plan.get("on_load"):
                plan["on_load"]()
            return None if plan.get("missing") else assets[path]

        def register_slate_post_tick_callback(self, callback):
            handle = len(state["registered"]) + 1
            state["registered"].append(handle)
            state["callbacks"][handle] = callback
            return handle

        def unregister_slate_post_tick_callback(self, handle):
            check(handle in state["callbacks"], "Unknown or repeated unregister")
            state["unregistered"].append(handle)
            del state["callbacks"][handle]

        def log(self, message):
            state["logs"].append(message)

        def __getattr__(self, name):
            if name == "_mw5_source_research_collection":
                raise AttributeError(name)
            check(False, "Undocumented or prohibited API: " + name)

    api = API()
    for item in (Blueprint, BehaviorTree, BlackboardData, ObjectExporterT3D, AssetExportTask,
                 Exporter, AssetRegistryDependencyOptions, AssetRegistryHelpers):
        setattr(api, item.__name__, item)
    return api, state


def run():
    require("unreal" not in sys.modules, "Validator must start without Unreal")
    ns = runpy.run_path(str(COLLECTOR), run_name="mw5_collector_offline_validation")
    globals_ = ns["Collection"].__init__.__globals__
    stamp = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    output = PROJECT / "research/evidence/editor-source" / (
        "collector-validation-" + stamp + "-" + uuid.uuid4().hex[:8])
    output.mkdir(exist_ok=False)
    results = []
    scope = None

    def case(name, fn):
        try:
            detail = fn()
            results.append({"name": name, "result": "PASS", "detail": detail})
        except Exception as exc:
            results.append({"name": name, "result": "FAIL", "detail": type(exc).__name__ + ": " + str(exc)})

    def validate_scope():
        nonlocal scope
        scope = globals_["read_scope"](PROJECT)
        require(len(scope["assets"]) == 18, "Expected reviewed 18-asset scope")
        for entry in scope["assets"]:
            require(sha(entry["disk_path"]).lower() == entry["sha256"].lower(), "Installed hash changed")
            if entry.get("reuse_export"):
                prior = entry["reuse_export"]
                require(sha(PROJECT / prior["path"]).lower() == prior["sha256"].lower(), "Retained export hash changed")
        return "OBSERVED_READ_ONLY: exact 18 installed paths/hashes and retained reuse exports match; no native API call."

    case("C01_reviewed_scope_and_installed_hashes", validate_scope)
    if scope is None:
        return finish(output, results)
    native_entry = next(e for e in scope["assets"] if not e.get("reuse_export"))

    def make(name, entries=None, plans=None, health=None, clock=None):
        root = output / name
        (root / "research/evidence/editor-source").mkdir(parents=True, exist_ok=False)
        entries = copy.deepcopy(entries or [native_entry])
        local_scope = {"assets": entries}
        api, state = strict_api(root, entries, plans)
        stub = root / "unexecuted-stub.py"
        sentinel = root / "STUB_EXECUTED"
        stub.write_text("from pathlib import Path\nPath(" + repr(str(sentinel)) + ").write_text('wrong')\n", encoding="utf-8")
        globals_["STUB"] = stub
        session = globals_["Collection"](api, root, local_scope,
                                          health=health or (lambda unused: dict(GOOD)),
                                          clock=clock or FakeClock())
        return session, api, state, stub, sentinel

    def drain(session, state):
        for unused in range(len(session.scope["assets"]) + 3):
            if session.done:
                break
            session.tick(0.01)
        require(session.done, "Collection did not finish")
        require(not state["callbacks"], "Callback retained after finish")
        require(not state["violations"], "; ".join(state["violations"]))
        receipt = session.output / "report.json"
        require(receipt.is_file(), "No final receipt")
        require(json.loads(receipt.read_text(encoding="utf-8"))["status"] == session.report["status"], "Receipt status mismatch")

    def success():
        entries = [next(e for e in scope["assets"] if e["expected_asset_type"] == t and not e.get("reuse_export"))
                   for t in ("Blueprint", "BehaviorTree", "BlackboardData")]
        session, unused, state, stub, sentinel = make("typed-load-and-snapshot", entries)
        session.start()
        require(not state["loads"], "Start loaded synchronously rather than scheduling")
        session.tick(0.01)
        require(len(state["loads"]) == 1 and session.index == 1, "Not one asset per callback")
        drain(session, state)
        require(session.report["status"] == "COLLECTION_FINISHED_REQUIRES_REVIEW", "Success status")
        require(state["loads"] == [e["object_path"] for e in entries], "Wrong exact typed source set/order")
        require(len(state["exports"]) == 3 and state["unregistered"] == [1], "Export/cleanup mismatch")
        require((session.output / "unreal-api-reference.txt").read_bytes() == stub.read_bytes(), "Snapshot not byte-identical")
        require(not sentinel.exists() and "unreal" not in sys.modules, "Stub or native module executed")
        require(all(r["source_unchanged_after"] for r in session.report["assets"]), "Source modified")
        return "MOCK_ONLY: three distinct typed exact loads, COPY flags, one per tick, dependency names not loaded, snapshot bytes copied without execution, single cleanup."
    case("C02_typed_exact_loads_and_passive_snapshot", success)

    def loaded():
        path = native_entry["object_path"]
        session, unused, state, unused_stub, unused_sentinel = make("already-loaded", plans={path: {"loaded": True}})
        session.start()
        drain(session, state)
        require(state["finds"] == [path] and not state["loads"] and state["exports"] == [path], "Loaded lookup did not avoid load")
        return "MOCK_ONLY: existing exact typed asset exported without loading."
    case("C03_already_loaded_lookup", loaded)

    def reuse():
        entry = copy.deepcopy(scope["assets"][0])
        session, unused, state, unused_stub, unused_sentinel = make("reuse", [entry])
        prior = session.root / "prior-reviewed.COPY"
        prior.write_bytes(GRAPH)
        entry = session.scope["assets"][0]
        entry["reuse_export"] = {"path": prior.name, "sha256": sha(prior)}
        original_cwd = os.getcwd()
        try:
            os.chdir(output)
            session.start()
            drain(session, state)
        finally:
            os.chdir(original_cwd)
        require(not state["finds"] and not state["loads"] and not state["exports"], "Reuse touched native assets")
        require(session.report["assets"][0]["collection_method"] == "REUSED_VERIFIED_EXPORT", "Reuse not recorded")
        require(Path(session.report["assets"][0]["file"]).read_bytes() == GRAPH, "Reused bytes differ")
        return "MOCK_ONLY: relative hash-matched prior export copied from a different working directory without asset find/load/native export."
    case("C04_reuse_avoids_native_export", reuse)

    def plan_case(name, plan, status, expected_exports):
        path = native_entry["object_path"]
        session, unused, state, unused_stub, unused_sentinel = make(name, plans={path: plan})
        session.start()
        drain(session, state)
        require(session.report["status"] == status, "Wrong completion status")
        require(len(state["exports"]) == expected_exports, "Wrong export count")
        return session, state

    def missing():
        session, unused = plan_case("missing", {"missing": True}, "COLLECTION_FINISHED_REQUIRES_REVIEW", 0)
        require(session.report["assets"][0]["status"] == "SOURCE_UNAVAILABLE", "Missing asset not recorded")
        return "MOCK_ONLY: unavailable asset recorded, never exported; overall review still required."
    case("C05_missing_asset_recorded", missing)

    def identity():
        session, unused = plan_case("identity", {"identity": "/Game/Wrong.Wrong"}, "STOPPED_PARTIAL", 0)
        require("identity mismatch" in " ".join(session.report["errors"]), "Mismatch reason missing")
        return "MOCK_ONLY: wrong object identity stops before export and unregisters."
    case("C06_identity_mismatch", identity)

    def resource_before():
        health = dict(GOOD)
        session, unused, state, unused_stub, unused_sentinel = make("resource-before", health=lambda unused: health)
        session.start()
        health["disk_free"] = 1
        drain(session, state)
        require(not state["loads"] and not state["finds"] and not state["exports"], "Resource stop reached native asset call")
        require(session.report["status"] == "STOPPED_PARTIAL", "Resource stop status")
        return "MOCK_ONLY: depleted disk before callback prevents all asset lookup/load/export."
    case("C07_resource_stop_before_load", resource_before)

    def resource_after():
        health = dict(GOOD)
        def consume():
            health["physical_available"] = 1
        path = native_entry["object_path"]
        session, unused, state, unused_stub, unused_sentinel = make("resource-after", plans={path: {"on_load": consume}}, health=lambda unused: health)
        session.start()
        drain(session, state)
        require(state["loads"] == [path] and not state["exports"], "Export continued after load consumed memory")
        require(session.report["status"] == "STOPPED_PARTIAL", "Wrong resource stop")
        return "MOCK_ONLY: RAM exhausted by synchronous fake load stops before export; cannot interrupt inside real load."
    case("C08_resource_stop_after_load", resource_after)

    def export_failure():
        session, unused = plan_case("export-errors", {"errors": ["Synthetic failure"], "export_return": False}, "STOPPED_PARTIAL", 1)
        record = session.report["assets"][0]
        require(Path(record["file"]).read_bytes() == GRAPH and record["exporter_errors"] == ["Synthetic failure"], "Failed output/errors lost")
        return "MOCK_ONLY: false native return plus exporter errors stop and preserve output receipt/hash."
    case("C09_exporter_error_preserves_output", export_failure)

    def export_exception():
        session, unused = plan_case("export-exception", {"export_exception": True, "content": b"partial synthetic output"}, "STOPPED_PARTIAL", 1)
        outputs = list(session.output.glob("*.COPY"))
        require(len(outputs) == 1 and outputs[0].read_bytes() == b"partial synthetic output", "Partial output lost")
        require("Synthetic exporter interruption" in " ".join(session.report["errors"]), "Exception receipt missing")
        return "MOCK_ONLY: synchronous exporter exception preserves partial file and final error receipt."
    case("C10_exception_preserves_partial", export_exception)

    def elapsed():
        clock = FakeClock()
        session, unused, state, unused_stub, unused_sentinel = make("elapsed", clock=clock)
        session.start()
        clock.value = globals_["MAX_SECONDS"] + 1
        drain(session, state)
        require(not state["loads"] and not state["exports"], "Time budget did not stop before load")
        require("BUDGET_STOP" in " ".join(session.report["errors"]), "Time-stop reason missing")
        return "MOCK_ONLY: exceeded cooperative elapsed budget prevents next asset call."
    case("C11_elapsed_stop", elapsed)

    def duplicate():
        session, api, state, unused_stub, unused_sentinel = make("duplicate-launch")
        session.start()
        setattr(api, globals_["ACTIVE_KEY"], session)
        second = globals_["launch"](api, session.root)
        require(second is session and state["registered"] == [1], "Duplicate collection scheduled")
        drain(session, state)
        require(len(list((session.root / "research/evidence/editor-source").iterdir())) == 1, "Duplicate output folder")
        prior_events = copy.deepcopy(state["exports"])
        session.tick(0.01)
        session.finish("SHOULD_NOT_REWRITE")
        require(state["exports"] == prior_events and state["unregistered"] == [1], "Done session ran again")
        return "MOCK_ONLY: duplicate launch reuses active session; repeated tick/finish cannot export or unregister twice."
    case("C12_duplicate_launch_and_idempotent_finish", duplicate)

    def stop_file():
        session, unused, state, unused_stub, unused_sentinel = make("stop-file")
        session.start()
        (session.output / "STOP").write_text("synthetic stop", encoding="utf-8")
        drain(session, state)
        require(not state["finds"] and "USER_STOP" in " ".join(session.report["errors"]), "STOP not respected")
        return "MOCK_ONLY: per-run STOP stops before asset lookup and releases callback."
    case("C13_stop_file", stop_file)

    def tamper_scope():
        root = output / "tampered-scope"
        (root / "research").mkdir(parents=True)
        path = root / globals_["SCOPE_FILE"]
        path.write_bytes((PROJECT / globals_["SCOPE_FILE"]).read_bytes() + b"\n")
        try:
            globals_["read_scope"](root)
        except ValueError as exc:
            require("fingerprint" in str(exc), "Wrong tamper rejection")
        else:
            raise AssertionError("Modified scope accepted")
        return "OBSERVED_OFFLINE_GUARD: changed bytes reject against pinned fingerprint before collection."
    case("C14_scope_fingerprint_tamper", tamper_scope)

    def field_mutations():
        original_pin = globals_["SCOPE_SHA256"]
        mutations = [
            ("path", lambda data: data["assets"][0].update(object_path="/Game/Wrong.Wrong")),
            ("disk", lambda data: data["assets"][0].update(disk_path=str(PROJECT / "README.md"))),
            ("source_hash", lambda data: data["assets"][0].update(sha256="0" * 64)),
            ("duplicate", lambda data: data["assets"].__setitem__(1, copy.deepcopy(data["assets"][0]))),
        ]
        try:
            for name, mutate in mutations:
                root = output / ("invalid-scope-" + name)
                (root / "research").mkdir(parents=True)
                data = copy.deepcopy(scope)
                mutate(data)
                path = root / globals_["SCOPE_FILE"]
                path.write_text(json.dumps(data), encoding="utf-8")
                globals_["SCOPE_SHA256"] = sha(path)
                try:
                    globals_["read_scope"](root)
                except ValueError:
                    pass
                else:
                    raise AssertionError("Invalid scope accepted: " + name)
        finally:
            globals_["SCOPE_SHA256"] = original_pin
        return "OBSERVED_OFFLINE_GUARD: independently repinned malformed object path, disk mapping, source hash and duplicate package rejected."
    case("C15_scope_identity_guards", field_mutations)

    def reuse_tamper():
        entry = copy.deepcopy(scope["assets"][0])
        session, unused, state, unused_stub, unused_sentinel = make("reuse-tamper", [entry])
        prior = session.root / "prior.COPY"
        prior.write_bytes(GRAPH)
        session.scope["assets"][0]["reuse_export"] = {"path": str(prior), "sha256": "0" * 64}
        session.start()
        drain(session, state)
        require(session.report["status"] == "STOPPED_PARTIAL" and not state["loads"] and not state["exports"], "Changed prior export reused")
        require(not list(session.output.glob("*.COPY")), "Changed prior export copied")
        return "MOCK_ONLY: changed reuse fingerprint stops before output copy or native operation."
    case("C16_reuse_fingerprint_guard", reuse_tamper)

    def registry_consumes_resources():
        health = dict(GOOD)
        def consume():
            health["commit_available"] = 1
        path = native_entry["object_path"]
        session, unused, state, unused_stub, unused_sentinel = make(
            "registry-resource-drop", plans={path: {"on_metadata": consume}}, health=lambda unused: health)
        session.start()
        drain(session, state)
        require(state["finds"] == [path] and not state["loads"] and not state["exports"],
                "Collector loaded after metadata work depleted commit availability")
        require(session.report["status"] == "STOPPED_PARTIAL", "Wrong intermediate resource stop")
        return "MOCK_ONLY: resource loss during registry work is rechecked immediately before expensive native load."
    case("C17_resource_recheck_immediately_before_load", registry_consumes_resources)
    require("unreal" not in sys.modules, "Native Unreal unexpectedly imported")
    return finish(output, results)


def finish(output, results):
    receipt = {"classification": "OFFLINE_VALIDATION_ONLY", "native_api_calls": 0,
               "gameplay": "NOT_PERFORMED", "python": platform.python_version(),
               "collector_sha256": sha(COLLECTOR), "validator_sha256": sha(__file__),
               "scope_sha256": sha(PROJECT / "research/COLLECTOR_ASSET_SCOPE.json"),
               "passed": sum(r["result"] == "PASS" for r in results),
               "failed": sum(r["result"] == "FAIL" for r in results), "cases": results,
               "limitations": ["Strict fakes validate control flow only; no native export or callback was invoked.",
                               "Real installed asset and existing export hashes are read-only observations.",
                               "Native loading, regeneration, output completeness and shipping behavior remain untested."]}
    path = output / "summary.json"
    path.write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"summary": str(path), "passed": receipt["passed"], "failed": receipt["failed"]}))
    return 1 if receipt["failed"] else 0


if __name__ == "__main__":
    sys.exit(run())
