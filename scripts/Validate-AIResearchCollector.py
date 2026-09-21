"""Strict offline control-flow validation for Collect-AIResearch.py (Python 3.7).

Never imports Unreal. Real manifest/source/reuse files are hashed read-only;
synthetic fixtures and reports remain inside a unique MOCK_ONLY test folder.
Passing fakes do not establish native editor support, cost or gameplay behavior.
"""
import copy
import datetime
import hashlib
import json
from pathlib import Path
import platform
import runpy
import sys
import uuid

PROJECT = Path(__file__).resolve().parent.parent
COLLECTOR = PROJECT / "scripts/Collect-AIResearch.py"
GOOD = {"disk_free": 8 * 1024**3, "physical_available": 3 * 1024**3,
        "commit_available": 4 * 1024**3}
GRAPH = b'Begin Object Name=Mock\nNodeGuid=01234567\nLinkedTo=(MockOther)\nClass=/Script/Mock.Native\nEnd Object\n'


def require(condition, message):
    if not condition:
        raise AssertionError(message)


def sha(path):
    result = hashlib.sha256()
    with Path(path).open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            result.update(chunk)
    return result.hexdigest()


class Clock:
    def __init__(self):
        self.value = 0.0

    def __call__(self):
        return self.value


def strict_api(root, entries, classes, plans=None):
    plans = plans or {}
    state = {key: [] for key in ("finds", "loads", "exports", "generated", "defaults",
                                 "violations", "dependencies", "metadata", "registered",
                                 "unregistered", "logs")}
    state["callbacks"] = {}
    paths = {e["object_path"]: e for e in entries}

    def check(condition, message):
        if not condition:
            state["violations"].append(message)
            raise AssertionError(message)

    class Immutable:
        def __setattr__(self, name, value):
            check(False, "Asset/metadata mutation: " + name)

        def __getattr__(self, name):
            check(False, "Unpermitted object access: " + name)

    class Asset(Immutable):
        def __init__(self, path, kind="source"):
            object.__setattr__(self, "_path", path)
            object.__setattr__(self, "_kind", kind)

        def get_path_name(self):
            return plans.get(self._path, {}).get("identity", self._path)

    types = {name: type(name, (Asset,), {}) for name in classes}
    selected = {p: plans.get(p, {}).get("asset_class", e["expected_asset_type"])
                for p, e in paths.items()}
    selected = {p: "Blueprint" if name == "REGISTRY_CLASS_REVIEW" else name
                for p, name in selected.items()}
    assets = {p: types.get(selected[p], Asset)(p) for p in paths}

    class Generated(Immutable):
        def __init__(self, path):
            object.__setattr__(self, "_path", path)

        def get_path_name(self):
            return plans.get(self._path, {}).get("generated_identity", self._path + "_C")

    generated = {p: Generated(p) for p in paths}
    generated_types = {p: type("MockGeneratedType", (), {
        "static_class": staticmethod(lambda p=p: generated[p])}) for p in paths}

    class Default(Asset):
        def __init__(self, path):
            super().__init__(path, "defaults")

        def get_class(self):
            plan = plans.get(self._path, {})
            if plan.get("wrong_default_class"):
                return Generated("/Game/Wrong.Wrong")
            return generated[self._path]

        def get_path_name(self):
            return self._path.rsplit(".", 1)[0] + ".Default__" + self._path.rsplit(".", 1)[1] + "_C"

    defaults = {p: Default(p) for p in paths}

    class ObjectExporterT3D:
        def get_editor_property(self, name):
            values = {"format_extension": ["T3D", "COPY"], "text": True}
            check(name in values, "Unpermitted exporter property")
            return values[name]

    class AssetExportTask:
        def __init__(self):
            self.values, self.errors = {}, []

        def set_editor_property(self, name, value):
            check(name in ("object", "exporter", "filename", "automated", "prompt",
                           "replace_identical", "selected", "use_file_archive", "write_empty_files"),
                  "Unpermitted transient task property")
            check(name not in self.values, "Repeated transient task property")
            self.values[name] = value

        def get_editor_property(self, name):
            check(name == "errors", "Unpermitted transient task read")
            return self.errors

    class Exporter:
        @staticmethod
        def run_asset_export_task(task):
            flags = {"automated": True, "prompt": False, "replace_identical": False,
                     "selected": False, "use_file_archive": False, "write_empty_files": False}
            check(set(task.values) == set(flags) | {"object", "exporter", "filename"}, "Wrong task fields")
            for key, value in flags.items():
                check(task.values[key] is value, "Unsafe export flag " + key)
            asset = task.values["object"]
            check(asset in list(assets.values()) + list(defaults.values()), "Unscoped export object")
            check(type(task.values["exporter"]) is ObjectExporterT3D, "Wrong exporter")
            destination = Path(task.values["filename"]).resolve()
            destination.relative_to(root.resolve())
            check(destination.suffix == ".COPY" and not destination.exists(), "Wrong extension or overwrite")
            state["exports"].append((asset._path, asset._kind))
            plan = plans.get(asset._path, {}).get(asset._kind, {})
            if not plan.get("no_file"):
                destination.write_bytes(plan.get("content", GRAPH))
            task.errors.extend(plan.get("errors", []))
            if plan.get("after_export"):
                plan["after_export"]()
            if plan.get("exception"):
                raise RuntimeError("Synthetic exporter interruption")
            return plan.get("return", True)

    class AssetRegistryDependencyOptions:
        def __init__(self, **options):
            expected = {"include_soft_package_references": True, "include_hard_package_references": True,
                        "include_searchable_names": False, "include_soft_management_references": False,
                        "include_hard_management_references": False}
            check(options == expected, "Wrong registry dependency options")

    class Metadata(Immutable):
        def __init__(self, path):
            object.__setattr__(self, "_path", path)
            object.__setattr__(self, "object_path", plans.get(path, {}).get("registry_identity", path))
            object.__setattr__(self, "asset_class", selected[path])

        def is_valid(self):
            return not plans.get(self._path, {}).get("invalid")

        def is_redirector(self):
            return bool(plans.get(self._path, {}).get("redirector"))

    class Registry:
        def is_loading_assets(self):
            return bool(state.get("registry_loading"))

        def get_dependencies(self, package, options):
            check(package in [e["package_path"] for e in entries], "Unscoped dependency query")
            check(type(options) is AssetRegistryDependencyOptions, "Wrong options type")
            state["dependencies"].append(package)
            path = next(e["object_path"] for e in entries if e["package_path"] == package)
            return plans.get(path, {}).get("dependencies", ["/Game/DependencyNotLoaded"])

        def get_asset_by_object_path(self, path, include_only_on_disk_assets=False):
            check(path in paths and include_only_on_disk_assets is True, "Unscoped/non-disk registry query")
            state["metadata"].append(path)
            if plans.get(path, {}).get("on_metadata"):
                plans[path]["on_metadata"]()
            return Metadata(path)

    class AssetRegistryHelpers:
        @staticmethod
        def get_asset_registry():
            return Registry()

    class EditorAssetLibrary:
        @staticmethod
        def load_blueprint_class(path):
            check(path in paths and selected[path] in ("Blueprint", "WidgetBlueprint"), "Unscoped/non-Blueprint class load")
            state["generated"].append(path)
            plan = plans.get(path, {})
            if plan.get("on_generated"):
                plan["on_generated"]()
            if plan.get("generated_missing"):
                return None
            return generated_types[path] if plan.get("generated_python_type") else generated[path]

    class API:
        def find_asset(self, path, type=None, follow_redirectors=None):
            check(path in paths and type is types[selected[path]], "Untyped/wrong/out-of-scope find")
            check(follow_redirectors is False, "Find follows redirects")
            state["finds"].append(path)
            return assets[path] if plans.get(path, {}).get("loaded") else None

        def load_asset(self, path, type=None, follow_redirectors=None):
            check(path in paths and type is types[selected[path]], "Untyped/wrong/out-of-scope load")
            check(follow_redirectors is False, "Load follows redirects")
            state["loads"].append(path)
            plan = plans.get(path, {})
            if plan.get("on_load"):
                plan["on_load"]()
            if plan.get("missing"):
                return None
            if plan.get("wrong_type"):
                return Asset(path)
            return assets[path]

        def get_default_object(self, value):
            check(value in list(generated.values()) + list(generated_types.values()), "Default requested for unreviewed class")
            wrapper = value.static_class() if isinstance(value, type) else value
            state["defaults"].append(wrapper._path)
            return defaults[wrapper._path]

        def register_slate_post_tick_callback(self, callback):
            handle = len(state["registered"]) + 1
            state["registered"].append(handle)
            state["callbacks"][handle] = callback
            return handle

        def unregister_slate_post_tick_callback(self, handle):
            check(handle in state["callbacks"], "Unknown/repeated callback cleanup")
            state["unregistered"].append(handle)
            del state["callbacks"][handle]

        def log(self, message):
            state["logs"].append(message)

        def __getattr__(self, name):
            if name in classes or name in ("_mw5_ai_research_collection", "_mw5_source_research_collection"):
                raise AttributeError(name)
            check(False, "Undocumented/prohibited API: " + name)

    api = API()
    for name, value in types.items():
        if not any(plan.get("missing_python_class") == name for plan in plans.values()):
            setattr(api, name, value)
    for item in (ObjectExporterT3D, AssetExportTask, Exporter, AssetRegistryDependencyOptions,
                 AssetRegistryHelpers, EditorAssetLibrary):
        setattr(api, item.__name__, item)
    return api, state


def run():
    require("unreal" not in sys.modules, "Validator cannot run inside Unreal")
    loaded_collector_sha = sha(COLLECTOR)
    ns = runpy.run_path(str(COLLECTOR), run_name="mw5_ai_research_offline")
    g = ns["Collection"].__init__.__globals__
    stamp = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    output = PROJECT / "research/evidence/editor-source" / ("ai-collector-validation-" + stamp + "-" + uuid.uuid4().hex[:8])
    output.mkdir(exist_ok=False)
    (output / "MOCK_ONLY.txt").write_text("All nested collector receipts are strict-fake test fixtures, not native editor evidence.\n", encoding="utf-8")
    results, real_scope = [], None

    def case(name, fn):
        try:
            detail = fn()
            results.append({"name": name, "result": "PASS", "detail": detail or "MOCK_ONLY"})
        except Exception as exc:
            results.append({"name": name, "result": "FAIL", "detail": type(exc).__name__ + ": " + str(exc)})

    def preflight():
        nonlocal real_scope
        real_scope = g["read_scope"](PROJECT)
        require(len(real_scope["assets"]) == 249, "Expected 249 reviewed installed sources")
        require(sum(bool(e.get("reuse_export")) for e in real_scope["assets"]) == 18, "Expected 18 pinned prior exports")
        return "OBSERVED_READ_ONLY: all 249 installed source paths/sizes/SHA256s and 18 pinned prior export fingerprints validated; no Unreal calls."
    case("C01_real_manifest_preflight", preflight)

    def make(name, kinds=("Blueprint",), plans=None, health=None, clock=None, existing_root=None):
        root = existing_root or output / name
        (root / "research/evidence/editor-source").mkdir(parents=True, exist_ok=True)
        entries = []
        for index, kind in enumerate(kinds):
            source = root / ("source%d.uasset" % index)
            if not source.exists():
                source.write_bytes(("MOCK_ONLY_SOURCE_%d" % index).encode("ascii"))
            package = "/Game/AI/Mock%d" % index
            entries.append({"package_path": package, "object_path": package + ".Mock%d" % index,
                            "disk_path": str(source), "bytes": source.stat().st_size, "sha256": sha(source),
                            "expected_asset_type": kind, "category": "MOCK_ONLY"})
        api, state = strict_api(root, entries, g["ALLOWED_CLASSES"], plans)
        stub = root / "unexecuted-stub.py"
        sentinel = root / "STUB_EXECUTED"
        stub.write_text("from pathlib import Path\nPath(" + repr(str(sentinel)) + ").write_text('wrong')\n", encoding="utf-8")
        g["STUB"] = stub
        session = g["Collection"](api, root, {"assets": entries}, health=health or (lambda unused: dict(GOOD)), clock=clock or Clock())
        return session, api, state, stub, sentinel

    def drain(session, state, allow_synthetic_source_mutation=False):
        for unused in range(len(session.scope["assets"]) + 3):
            if session.done:
                break
            session.tick(0.01)
        require(session.done and not state["callbacks"], "Collection/callback did not finish")
        require(not state["violations"], "; ".join(state["violations"]))
        receipt = json.loads((session.output / "report.json").read_text(encoding="utf-8"))
        require(receipt["status"] == session.report["status"], "Final receipt mismatch")
        if not allow_synthetic_source_mutation:
            for entry in session.scope["assets"]:
                require(sha(entry["disk_path"]) == entry["sha256"], "Fake input source mutated")
        return json.loads((session.output / "coverage.json").read_text(encoding="utf-8"))

    p0, p1 = "/Game/AI/Mock0.Mock0", "/Game/AI/Mock1.Mock1"

    def success():
        kinds = tuple(sorted(g["ALLOWED_CLASSES"]))
        session, unused, state, stub, sentinel = make("all-typed-classes", kinds)
        session.start()
        require(not state["loads"], "Start ran synchronous source load")
        session.tick(0.01)
        require(session.index == 1 and len(state["loads"]) == 1, "More than one source per callback")
        coverage = drain(session, state)
        require(session.report["status"] == "SCOPE_PROCESSED_REVIEW_COVERAGE", "Wrong completed status")
        require(len(state["loads"]) == len(kinds), "Wrong source load count")
        require(len(state["exports"]) == len(kinds) + 2 and len(state["defaults"]) == 2, "Blueprint defaults coverage wrong")
        require(coverage["source_text_collected"] == len(kinds), "Missing typed source coverage")
        require(coverage["native_implementation_bodies"] == "NOT_COLLECTED", "Overclaims native source")
        require((session.output / "unreal-api-reference.txt").read_bytes() == stub.read_bytes(), "Snapshot changed")
        require(not sentinel.exists() and "unreal" not in sys.modules, "Stub/native module executed")
        require(state["unregistered"] == [1], "Callback cleanup count")
        return "MOCK_ONLY: every allowlisted class uses exact typed no-redirect lookup/load; immutable sources and CDOs exported with strict flags; passive API bytes copied; one asset per tick."
    case("C02_all_typed_classes_defaults_flags_and_passive_snapshot", success)

    def scenario(name, plan, kinds=("Blueprint",)):
        session, api, state, stub, sentinel = make(name, kinds, {p0: plan})
        session.start()
        coverage = drain(session, state)
        return session, state, coverage

    def loaded():
        session, state, unused = scenario("loaded", {"loaded": True})
        require(state["finds"] == [p0] and not state["loads"] and len(state["exports"]) == 2, "Loaded source did not avoid load")
    case("C03_already_loaded_source", loaded)

    def rejection(name, plan, expected, kind="Blueprint"):
        session, state, coverage = scenario(name, plan, (kind, "BehaviorTree"))
        require(session.report["assets"][0]["status"] == expected, "Wrong rejection status: " + session.report["assets"][0]["status"])
        require(p0 not in state["loads"] and all(v[0] != p0 for v in state["exports"]), "Rejected metadata reached native load/export")
        require(p1 in state["loads"] and coverage["source_text_collected"] == 1, "Did not continue with valid next asset")
        require(len(coverage["uncollected_planned_packages"]) == 1, "Incomplete coverage concealed")

    case("C04_invalid_registry_metadata", lambda: rejection("invalid-metadata", {"invalid": True}, "INVALID_OR_REDIRECTED_METADATA"))
    case("C05_redirector_metadata", lambda: rejection("redirector", {"redirector": True}, "INVALID_OR_REDIRECTED_METADATA"))
    case("C06_registry_identity_guard", lambda: rejection("registry-identity", {"registry_identity": "/Game/Wrong.Wrong"}, "ASSET_INSPECTION_FAILED"))
    case("C07_registry_type_guard", lambda: rejection("registry-type", {"asset_class": "BehaviorTree"}, "ASSET_INSPECTION_FAILED"))
    case("C08_unknown_class_metadata_only", lambda: rejection("unknown-class", {"asset_class": "World"}, "METADATA_ONLY_UNSUPPORTED_CLASS", "REGISTRY_CLASS_REVIEW"))
    case("C09_unavailable_python_class", lambda: rejection("no-python-class", {"missing_python_class": "Blueprint"}, "METADATA_ONLY_UNAVAILABLE_PYTHON_CLASS"))

    def deferred():
        session, unused, state, unused_stub, unused_sentinel = make("deferred", ("Blueprint", "BehaviorTree"))
        session.scope["assets"][0]["collection_action"] = "METADATA_ONLY"
        session.start()
        coverage = drain(session, state)
        require(session.report["assets"][0]["status"] == "METADATA_ONLY_DEFERRED", "Deferred scope ignored")
        require(state["loads"] == [p1] and not state["generated"] and coverage["source_text_collected"] == 1, "Deferred metadata loaded")
    case("C10_explicit_metadata_only", deferred)

    def bad_source(name, plan):
        session, state, coverage = scenario(name, plan, ("Blueprint", "BehaviorTree"))
        require(session.report["assets"][0]["source"]["status"] == "SOURCE_EXPORT_FAILED", "Source failure missing")
        require(not state["generated"] and coverage["source_text_collected"] == 1, "Failed source triggered defaults or stopped next source")
    case("C11_loaded_identity_guard", lambda: bad_source("loaded-identity", {"identity": "/Game/Wrong.Wrong"}))
    case("C12_loaded_type_guard", lambda: bad_source("loaded-type", {"wrong_type": True}))
    case("C13_missing_source_continues", lambda: bad_source("missing-source", {"missing": True}))

    def bad_defaults(name, plan, expected_default_calls):
        session, state, coverage = scenario(name, plan, ("Blueprint", "BehaviorTree"))
        require(session.report["assets"][0]["status"] == "SOURCE_COLLECTED_DEFAULTS_INCOMPLETE", "Failed default hidden")
        require(len(state["defaults"]) == expected_default_calls, "Wrong default lookup count")
        require(len(state["exports"]) == 2 and coverage["source_text_collected"] == 2 and coverage["defaults_text_collected"] == 0, "Invalid default exported or source lost")
    case("C14_generated_class_identity_guard", lambda: bad_defaults("generated-wrong", {"generated_identity": "/Game/Wrong.Wrong_C"}, 0))
    case("C15_default_class_identity_guard", lambda: bad_defaults("default-wrong", {"wrong_default_class": True}, 1))

    def resource(name, trigger):
        health = dict(GOOD)
        def consume():
            health["commit_available"] = 1
        plan = {}
        if trigger == "before":
            pass
        elif trigger == "source":
            plan["source"] = {"after_export": consume}
        else:
            plan[trigger] = consume
        session, unused, state, unused_stub, unused_sentinel = make(name, plans={p0: plan}, health=lambda unused: health)
        session.start()
        if trigger == "before":
            consume()
        drain(session, state)
        require(session.report["status"] == "STOPPED_PARTIAL" and "RESOURCE_STOP" in " ".join(session.report["errors"]), "Resource stop missing")
        if trigger in ("before", "on_metadata"):
            require(not state["finds"] and not state["loads"] and not state["exports"], "Lookup after depleted health")
        elif trigger == "on_load":
            require(state["loads"] == [p0] and not state["exports"], "Export after expensive load depleted health")
        elif trigger == "source":
            require(len(state["exports"]) == 1 and not state["generated"], "Generated class loaded after source depleted health")
        elif trigger == "on_generated":
            require(state["generated"] == [p0] and not state["defaults"], "CDO lookup after generated class depleted health")
    for index, trigger in enumerate(("before", "on_metadata", "on_load", "source", "on_generated"), 16):
        case("C%02d_resource_%s" % (index, trigger), lambda trigger=trigger: resource("resource-" + trigger, trigger))

    def export_errors():
        session, state, coverage = scenario("export-errors", {"source": {"return": False, "errors": ["Synthetic error"]}}, ("Blueprint", "BehaviorTree"))
        unit = session.report["assets"][0]["source"]
        require(unit["status"] == "SOURCE_EXPORT_FAILED" and Path(unit["file"]).read_bytes() == GRAPH, "Failed export evidence lost")
        require(unit["exporter_errors"] == ["Synthetic error"] and len(state["exports"]) == 2 and coverage["source_text_collected"] == 1, "Failed export reused/counted or next asset skipped")
    case("C21_export_failure_preserves_evidence_and_continues", export_errors)

    def export_exception():
        session, unused, coverage = scenario("export-exception", {"source": {"exception": True, "content": b"partial"}}, ("Blueprint", "BehaviorTree"))
        unit = session.report["assets"][0]["source"]
        require(unit["status"] == "SOURCE_EXPORT_FAILED" and unit["bytes"] == 7 and Path(unit["file"]).read_bytes() == b"partial", "Partial exception bytes not retained/accounted")
        require(coverage["source_text_collected"] == 1, "Partial output counted as success")
    case("C22_exception_partial_output_accounted", export_exception)

    def stopping(name, mode):
        clock = Clock()
        session, unused, state, unused_stub, unused_sentinel = make(name, clock=clock)
        session.start()
        if mode == "STOP":
            (session.output / "STOP").write_text("MOCK_ONLY", encoding="utf-8")
        elif mode == "time":
            clock.value = g["MAX_SECONDS"] + 1
        else:
            session.total = g["MAX_TOTAL"]
        coverage = drain(session, state)
        require(session.report["status"] == "STOPPED_PARTIAL" and not state["finds"], "Cooperative stop ignored")
        require(coverage["source_text_collected"] == 0 and len(coverage["uncollected_planned_packages"]) == 1, "Stopped coverage dishonest")
    case("C23_stop_file", lambda: stopping("stop-file", "STOP"))
    case("C24_time_limit", lambda: stopping("time-limit", "time"))
    case("C25_total_limit", lambda: stopping("total-limit", "total"))

    def oversized():
        original = g["MAX_FILE"]
        try:
            g["MAX_FILE"] = 8
            session, state, coverage = scenario("oversized", {})
            require(session.report["status"] == "STOPPED_PARTIAL" and len(state["exports"]) == 1, "Oversized output did not stop")
            unit = session.report["assets"][0]["source"]
            require(Path(unit["file"]).read_bytes() == GRAPH and "sha256" not in unit, "Oversized output not retained or read further")
            require(coverage["source_text_collected"] == 0, "Oversized output classified successful")
        finally:
            g["MAX_FILE"] = original
    case("C26_per_output_limit_retains_without_hash_read", oversized)

    def resume(name, component=None, tamper=False):
        first, unused, state1, unused_stub, unused_sentinel = make(name)
        first.start()
        drain(first, state1)
        record = first.report["assets"][0]
        if component:
            if tamper:
                Path(record[component]["file"]).write_bytes(b"TAMPERED")
            else:
                record[component]["status"] = "SYNTHETIC_FAILED_COMPONENT"
                (first.output / "report.json").write_text(json.dumps(first.report), encoding="utf-8")
        second, unused, state2, unused_stub, unused_sentinel = make(name, existing_root=first.root)
        second.start()
        drain(second, state2)
        actual = second.report["assets"][0]
        for part in ("source", "defaults"):
            require(actual[part]["status"] == g["TEXT_OK"], "Resumed component incomplete")
            expected = "NATIVE_TEXT_EXPORT" if part == component else "REUSED_VERIFIED_TEXT"
            require(actual[part]["method"] == expected, "Wrong resume source for " + part)
        if component is None:
            require(not state2["finds"] and not state2["loads"] and not state2["generated"] and not state2["exports"], "Successful components did not avoid native work")
        if tamper:
            require("reuse_rejected" in actual[component], "Tampering rejection omitted")
    case("C27_resume_verified_source_and_defaults", lambda: resume("resume-all"))
    case("C28_resume_only_successful_source_component", lambda: resume("resume-partial", "defaults"))
    case("C29_tampered_source_rejected_and_recollected", lambda: resume("resume-tamper-source", "source", True))
    case("C30_tampered_defaults_rejected_and_recollected", lambda: resume("resume-tamper-defaults", "defaults", True))

    def pinned_reuse():
        session, unused, state, unused_stub, unused_sentinel = make("pinned-reuse", ("BehaviorTree",))
        prior = session.root / "prior.COPY"
        prior.write_bytes(GRAPH)
        session.scope["assets"][0]["reuse_export"] = {"path": prior.name, "bytes": prior.stat().st_size, "sha256": sha(prior)}
        session.start()
        drain(session, state)
        require(not state["finds"] and not state["loads"] and not state["exports"], "Pinned source reuse touched native objects")
        require(session.report["assets"][0]["source"]["method"] == "REUSED_VERIFIED_TEXT", "Pinned source reuse unrecorded")
    case("C31_pinned_prior_reuse", pinned_reuse)

    def duplicate():
        session, api, state, unused_stub, unused_sentinel = make("duplicate")
        session.start()
        setattr(api, g["ACTIVE_KEY"], session)
        require(g["launch"](api, session.root) is session and state["registered"] == [1], "Duplicate collection scheduled")
        drain(session, state)
        count = len(state["exports"])
        session.tick(0.01)
        session.finish("SHOULD_NOT_CHANGE")
        require(len(state["exports"]) == count and state["unregistered"] == [1], "Done session ran again")
    case("C32_duplicate_and_idempotent_completion", duplicate)

    def registry_loading():
        session, unused, state, unused_stub, unused_sentinel = make("registry-loading")
        state["registry_loading"] = True
        session.start()
        coverage = drain(session, state)
        require(session.report["status"] == "STOPPED_PARTIAL" and not state["registered"] and coverage["source_text_collected"] == 0, "Loading registry did not defer")
    case("C33_registry_discovery_defers", registry_loading)

    def dependencies():
        session, state, coverage = scenario("dependencies", {"dependencies": ["/Game/Unknown%d" % i for i in range(2050)]})
        require(len(coverage["unresolved_dependency_frontier"]) == 2048, "Dependency bound wrong")
        require(coverage["dependency_queries_incomplete"] == ["/Game/AI/Mock0"], "Truncation hidden")
        require(state["loads"] == [p0], "Collector followed dependency frontier")
    case("C34_dependency_bound_and_honest_frontier", dependencies)

    def tamper_manifest():
        root = output / "tampered-manifest"
        (root / "research").mkdir(parents=True)
        path = root / g["SCOPE_FILE"]
        path.write_bytes((PROJECT / g["SCOPE_FILE"]).read_bytes() + b"\n")
        try:
            g["read_scope"](root)
        except ValueError as exc:
            require("fingerprint" in str(exc), "Wrong manifest rejection")
        else:
            raise AssertionError("Changed manifest accepted")
        return "OBSERVED_OFFLINE_GUARD: altered manifest bytes rejected before source collection."
    case("C35_manifest_pin_guard", tamper_manifest)

    def generated_python_type():
        session, state, coverage = scenario("generated-python-type", {"generated_python_type": True})
        require(session.report["assets"][0]["defaults"]["status"] == g["TEXT_OK"], "Python generated class did not normalize")
        require(state["defaults"] == [p0] and len(state["exports"]) == 2 and coverage["defaults_text_collected"] == 1, "Python generated type CDO flow incorrect")
    case("C36_generated_python_type_variant", generated_python_type)

    def mutated_during_defaults():
        plans = {p0: {"defaults": {}}}
        first, unused, state1, unused_stub, unused_sentinel = make("source-mutation-during-default", plans=plans)
        source = Path(first.scope["assets"][0]["disk_path"])
        plans[p0]["defaults"]["after_export"] = lambda: source.write_bytes(b"MOCK_ONLY_EXTERNAL_SOURCE_CHANGE")
        first.start()
        coverage = drain(first, state1, allow_synthetic_source_mutation=True)
        record = first.report["assets"][0]
        require(first.report["status"] == "STOPPED_PARTIAL" and record["source_unchanged_after"] is False, "Changed source still verified")
        require(record["status"] == "SOURCE_CHANGED_DURING_CAPTURE" and coverage["source_text_collected"] == 0 and coverage["defaults_text_collected"] == 0, "Changed source contributed successful coverage")
        second, unused, state2, unused_stub, unused_sentinel = make("source-mutation-during-default", existing_root=first.root)
        require(not second.prior, "Source-change receipt indexed as resumable success")
        second.start()
        drain(second, state2)
        require(state2["loads"] == [p0] and len(state2["exports"]) == 2, "Changed source reused stale text")
        return "MOCK_ONLY: simulated external disk change during CDO export stops and clears verified flag; both source/defaults excluded from coverage and reuse."
    case("C37_source_changed_during_default_export", mutated_during_defaults)

    def checkpoint_lock(name, persistent):
        session, unused, state, unused_stub, unused_sentinel = make(name)
        session.start()
        original_replace, original_sleep = Path.replace, g["time"].sleep
        attempts, delays = [], []

        def locked_replace(path, target):
            if path.parent == session.output and path.name == "progress.next.json":
                attempts.append(str(path))
                if persistent or len(attempts) <= 2:
                    raise PermissionError("MOCK_ONLY simulated progress file lock")
            return original_replace(path, target)

        try:
            Path.replace = locked_replace
            g["time"].sleep = lambda seconds: delays.append(seconds)
            coverage = drain(session, state)
        finally:
            Path.replace, g["time"].sleep = original_replace, original_sleep
        if persistent:
            require(session.report["status"] == "STOPPED_PARTIAL" and not state["finds"], "Persistent checkpoint lock permitted native work")
            require(len(attempts) == 8 and delays == [0.05] * 6, "Persistent checkpoint retry not bounded to four per checkpoint")
            require("CHECKPOINT_LOCKED" in " ".join(session.report["errors"]) and "Final checkpoint" in " ".join(session.report["errors"]), "Persistent failure final receipt incomplete")
            require(coverage["source_text_collected"] == 0, "Persistent checkpoint failure claimed collection")
        else:
            require(session.report["status"] == "SCOPE_PROCESSED_REVIEW_COVERAGE" and delays == [0.05, 0.05], "Transient checkpoint lock did not recover with bounded waits")
            require(coverage["source_text_collected"] == 1 and not session.report["errors"], "Transient retry lost source evidence")
        return "MOCK_ONLY: simulated replacement locks; actual sleep replaced with duration recorder, filesystem calls otherwise real and project-local."
    case("C38_transient_checkpoint_lock_retry", lambda: checkpoint_lock("checkpoint-transient", False))
    case("C39_persistent_checkpoint_lock_final_receipt", lambda: checkpoint_lock("checkpoint-persistent", True))
    case("C40_collector_stable_during_validation", lambda: require(sha(COLLECTOR) == loaded_collector_sha, "Collector changed while tests were executing; rerun against stable file"))

    require("unreal" not in sys.modules, "Native Unreal unexpectedly imported")
    receipt = {"classification": "MOCK_ONLY_OFFLINE_VALIDATION", "native_api_calls": 0,
               "gameplay": "NOT_PERFORMED", "python": platform.python_version(),
               "collector_sha256": loaded_collector_sha, "validator_sha256": sha(__file__),
               "scope_sha256": sha(PROJECT / g["SCOPE_FILE"]),
               "passed": sum(r["result"] == "PASS" for r in results),
               "failed": sum(r["result"] == "FAIL" for r in results), "cases": results,
               "limitations": ["Strict fakes validate control flow only; no native exports or game calls.",
                               "Real manifest/source/reuse fingerprints are read-only observations.",
                               "Native class/default exports, dependency loading cost, completeness and gameplay remain untested."]}
    path = output / "summary.json"
    path.write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"summary": str(path), "passed": receipt["passed"], "failed": receipt["failed"],
                      "failures": [r for r in results if r["result"] == "FAIL"]}))
    return 1 if receipt["failed"] else 0


if __name__ == "__main__":
    sys.exit(run())
