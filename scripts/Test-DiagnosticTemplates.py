"""Focused MOCK_ONLY tests. No Unreal import, installed assets or desktop calls."""
import ast
import datetime
import hashlib
import importlib.util
import json
from pathlib import Path
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location("template_inspector", ROOT / "scripts/Inspect-DiagnosticTemplates.py")
helper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helper)
HEALTH = {"disk_free": 4 * 1024**3, "physical_available": 0, "commit_available": 0}


class Obj:
    def __init__(self, path, kind, outer=None):
        self.path, self.kind, self.outer = path, kind, outer

    def get_path_name(self):
        return self.path

    def get_class(self):
        return SimpleNamespace(get_path_name=lambda: self.kind)

    def get_outer(self):
        return self.outer


class Task:
    def __init__(self):
        self.values, self.errors = {}, []

    def set_editor_property(self, key, value):
        self.values[key] = value

    def get_editor_property(self, key):
        assert key == "errors"
        return self.errors


class Checks(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="mw5-template-tests-")
        self.root = Path(self.temp.name).resolve()
        self.addCleanup(self.cleanup)
        self.evidence = self.root / "research/evidence/editor-source"
        self.evidence.mkdir(parents=True)
        self.source = self.root / "protected.bin"
        self.source.write_bytes(b"MOCK_ONLY protected source")
        self.marker = self.root / "original-ActiveMod.txt"
        self.marker.write_bytes(b"")
        absent = self.root / "diagnostic-ActiveMod.txt"
        self.manifest = {"targets": list(helper.TARGETS),
                         "protected_files": [helper.file_record(self.source)[1]],
                         "selection": helper.selection_snapshot([{"path": str(self.marker)}, {"path": str(absent)}])}
        self.objects, self.finds, self.exports = {}, [], []
        self.effect, self.raw_override = None, None
        self.find_effect = None
        for target in helper.TARGETS:
            package = Obj(target["outer_path"].split(".")[0], "/Script/CoreUObject.Package")
            outer = Obj(target["outer_path"], "/Script/Engine.BlueprintGeneratedClass", package)
            self.objects[target["object_path"]] = Obj(target["object_path"], target["class_path"], outer)

        def find(outer, path, follow_redirectors):
            self.assertIsNone(outer)
            self.assertFalse(follow_redirectors)
            self.finds.append(path)
            if self.find_effect:
                self.find_effect(path)
            return self.objects.get(path)

        def export(task):
            values = task.values
            self.assertEqual(set(values), {"object", "exporter", "filename", "automated", "prompt", "replace_identical", "selected", "use_file_archive", "write_empty_files"})
            self.assertTrue(values["automated"])
            self.assertTrue(all(values[key] is False for key in ("prompt", "replace_identical", "selected", "use_file_archive", "write_empty_files")))
            obj = values["object"]
            self.exports.append(obj.path)
            destination = Path(values["filename"])
            destination.resolve().relative_to(self.evidence)
            self.assertFalse(destination.exists())
            raw = self.raw_override if self.raw_override is not None else (
                'Begin Object Class=%s Name="%s"\n   ExplicitNull=None\nEnd Object\n' % (obj.kind, obj.path.rsplit(":", 1)[1])).encode()
            destination.write_bytes(raw)
            return self.effect(task, destination) if self.effect else True

        self.api = SimpleNamespace(find_object=find, AssetExportTask=Task,
            ObjectExporterT3D=lambda: SimpleNamespace(get_editor_property=lambda key: {"text": True, "format_extension": ["COPY", "T3D"]}[key]),
            Exporter=SimpleNamespace(run_asset_export_task=export))

    def cleanup(self):
        self.assertEqual(self.root.parent, Path(tempfile.gettempdir()).resolve())
        self.assertTrue(self.root.name.startswith("mw5-template-tests-"))
        self.temp.cleanup()

    def run_inspection(self, **kwargs):
        result = helper.run_mock(self.api, self.manifest, self.root,
            kwargs.pop("health_query", lambda _: dict(HEALTH)), **kwargs)
        self.assertEqual(result["classification"], "MOCK_ONLY")
        self.assertEqual(result["native_inspection"], "NOT_PERFORMED")
        self.assertEqual(result["asset_mutation_load_save_compile_selection_restart_cook_retail"], "NOT_PERFORMED")
        self.assertFalse((self.evidence / ".diagnostic-template-inspection.lock").exists())
        self.assertFalse(hasattr(self.api, helper.ACTIVE_KEY))
        self.assertEqual(result, json.loads((Path(result["output_directory"]) / "report.json").read_text()))
        return result

    def test_ten_exact_queries_and_exports_low_ram_allowed(self):
        result = self.run_inspection()
        self.assertEqual(result["status"], "COLLECTED_REQUIRES_REVIEW")
        self.assertEqual(self.finds, [t["object_path"] for t in helper.TARGETS])
        self.assertEqual(self.exports, self.finds)
        self.assertEqual(result["last_health"]["physical_available"], 0)
        self.assertTrue(result["protected_unchanged"])

    def test_missing_stock_never_loads_and_is_unknown(self):
        for target in helper.TARGETS[5:]:
            del self.objects[target["object_path"]]
        result = self.run_inspection()
        self.assertEqual(result["status"], "PARTIAL_MISSING_OBJECTS_UNKNOWN")
        self.assertEqual(len(self.exports), 5)
        self.assertTrue(all(q["interpretation"] == "UNKNOWN" for q in result["queries"][5:]))

    def test_missing_diagnostic_does_not_claim_absence(self):
        del self.objects[helper.TARGETS[0]["object_path"]]
        result = self.run_inspection()
        self.assertEqual(result["queries"][0]["status"], "NOT_ALREADY_LOADED")
        self.assertEqual(result["queries"][0]["interpretation"], "UNKNOWN")

    def test_wrong_class_rejected_before_export(self):
        self.objects[helper.TARGETS[0]["object_path"]].kind = "/Script/Engine.Actor"
        result = self.run_inspection()
        self.assertIn("EXACT_OBJECT_CLASS_OUTER_MISMATCH", str(result["errors"]))
        self.assertEqual(self.exports, [])

    def test_wrong_immediate_outer_rejected(self):
        self.objects[helper.TARGETS[0]["object_path"]].outer.path += "_WRONG"
        result = self.run_inspection()
        self.assertIn("EXACT_OBJECT_CLASS_OUTER_MISMATCH", str(result["errors"]))

    def test_stock_alias_rejected_before_any_export(self):
        self.objects[helper.TARGETS[5]["object_path"]] = self.objects[helper.TARGETS[0]["object_path"]]
        result = self.run_inspection()
        self.assertEqual(result["queries"][-1]["status"], "REJECTED_IDENTITY_OR_ALIAS")
        self.assertEqual(self.exports, [])

    def test_outer_cycle_stops(self):
        obj = self.objects[helper.TARGETS[0]["object_path"]]
        obj.outer.outer = obj
        result = self.run_inspection()
        self.assertIn("OUTER_CHAIN_CYCLE", str(result["errors"]))

    def test_outer_depth_stops(self):
        obj = self.objects[helper.TARGETS[0]["object_path"]]
        current = obj.outer
        for n in range(10):
            current.outer = Obj("/fake/outer%d" % n, "/Script/CoreUObject.Package")
            current = current.outer
        result = self.run_inspection()
        self.assertIn("OUTER_CHAIN_LIMIT", str(result["errors"]))

    def test_omitted_field_and_explicit_null_remain_distinct(self):
        result = self.run_inspection()
        inventory = json.loads((Path(result["output_directory"]) / result["queries"][0]["inventory"]["file"]).read_text())
        self.assertEqual(inventory["objects"][0]["fields"], [{"line": 2, "text": "ExplicitNull=None"}])
        self.assertNotIn("InheritedRecords", str(inventory))
        self.assertEqual(inventory["reference_interpretation"], "LEXICAL_ONLY_NOT_RESOLVED_REFERENCES")

    def test_colon_subobject_and_nested_inventory(self):
        first = helper.TARGETS[0]
        self.raw_override = ('Begin Object Class=%s Name="%s"\n Begin Object Class=/Script/CoreUObject.Object Name="Child"\n End Object\nEnd Object\n' % (first["class_path"], first["name"])).encode()
        # Restrict loaded inventory to this object; no dynamic target list.
        self.objects = {first["object_path"]: self.objects[first["object_path"]]}
        result = self.run_inspection()
        self.assertEqual(result["status"], "PARTIAL_MISSING_OBJECTS_UNKNOWN")
        inventory = json.loads((Path(result["output_directory"]) / result["queries"][0]["inventory"]["file"]).read_text())
        self.assertEqual(inventory["objects"][1]["relative_path"], "Child")

    def test_wrong_export_root_stops_and_preserves_raw(self):
        self.raw_override = b'Begin Object Class=/Script/Engine.Actor Name="Wrong"\nEnd Object\n'
        result = self.run_inspection()
        self.assertIn("EXPORT_ROOT_IDENTITY_MISMATCH", str(result["errors"]))
        self.assertEqual(len(list(Path(result["output_directory"]).glob("*.COPY"))), 1)

    def test_export_depth_limit(self):
        first = helper.TARGETS[0]
        self.raw_override = ('Begin Object Class=%s Name="%s"\n' % (first["class_path"], first["name"]) +
            ''.join('Begin Object Class=/Script/CoreUObject.Object Name="C%d"\n' % n for n in range(17)) + 'End Object\n' * 18).encode()
        result = self.run_inspection()
        self.assertIn("UNREVIEWED_EXPORT_HEADER", str(result["errors"]))

    def test_oversized_export_retained_but_not_parsed(self):
        self.raw_override = b"x" * (helper.MAX_EXPORT + 1)
        result = self.run_inspection()
        self.assertIn("FILE_SIZE_LIMIT", str(result["errors"]))
        self.assertEqual(len(list(Path(result["output_directory"]).glob("*.COPY"))), 1)
        self.assertFalse(list(Path(result["output_directory"]).glob("*-inventory.json")))

    def test_aggregate_budget_stops_after_call(self):
        with patch.object(helper, "MAX_RAW", 1):
            result = self.run_inspection()
        self.assertIn("COOPERATIVE_BUDGET_STOP", str(result["errors"]))
        self.assertEqual(len(self.exports), 1)

    def test_time_stop_before_find(self):
        times = iter([0, 0, 91, 91])
        result = self.run_inspection(clock=lambda: next(times, 91))
        self.assertIn("COOPERATIVE_BUDGET_STOP", str(result["errors"]))
        self.assertEqual(self.finds, [])

    def test_disk_stop_before_find(self):
        result = self.run_inspection(health_query=lambda _: dict(HEALTH, disk_free=0))
        self.assertIn("DISK_RESOURCE_STOP", str(result["errors"]))
        self.assertEqual(self.finds, [])

    def test_protected_drift_preserved_no_restore(self):
        def change(task, destination):
            self.source.write_bytes(b"changed by synthetic actor")
            return True
        self.effect = change
        result = self.run_inspection()
        self.assertEqual(result["status"], "STOPPED_PROTECTED_INPUT_OR_SELECTION_CHANGE")
        self.assertFalse(result["protected_unchanged"])
        self.assertEqual(self.source.read_bytes(), b"changed by synthetic actor")
        self.assertEqual(len(self.exports), 1)

    def test_selection_change_stops_no_restore(self):
        self.find_effect = lambda path: self.marker.write_bytes(b"user selection change")
        result = self.run_inspection()
        self.assertEqual(result["status"], "STOPPED_PROTECTED_INPUT_OR_SELECTION_CHANGE")
        self.assertEqual(self.exports, [])
        self.assertEqual(self.marker.read_bytes(), b"user selection change")

    def test_export_failure_retains_partial_receipt(self):
        self.effect = lambda task, destination: False
        result = self.run_inspection()
        self.assertIn("EXPORT_FAILED_OR_ERRORS", str(result["errors"]))
        self.assertTrue((Path(result["output_directory"]) / "before-export-1.json").is_file())

    def test_unreadable_selection_preserves_final_receipt(self):
        self.find_effect = lambda path: self.marker.write_bytes(b"x" * 1025)
        result = self.run_inspection()
        self.assertFalse(result["selection_unchanged"])
        self.assertIn("SELECTION_READ_FAILED", str(result["errors"]))
        self.assertEqual(result["status"], "STOPPED_PROTECTED_INPUT_OR_SELECTION_CHANGE")
        self.assertEqual(self.exports, [])
        self.assertEqual(self.marker.stat().st_size, 1025)

    def test_oversized_receipt_stops_with_bounded_receipt(self):
        self.manifest["mock_padding"] = "x" * helper.MAX_RECEIPT
        result = self.run_inspection()
        self.assertIn("RECEIPT_SIZE_LIMIT", str(result["errors"]))
        self.assertEqual(self.finds, [])
        self.assertEqual(self.exports, [])
        self.assertEqual(result["inspection_identity"], {"classification": "MOCK_ONLY"})
        self.assertLessEqual((Path(result["output_directory"]) / "report.json").stat().st_size, helper.MAX_RECEIPT)
        self.assertTrue(result["protected_unchanged"])
        self.assertTrue(result["selection_unchanged"])

    def test_native_allocation_exception_is_stop(self):
        def fail(task, destination):
            raise MemoryError("MOCK allocation failure")
        self.effect = fail
        result = self.run_inspection()
        self.assertIn("MemoryError", str(result["errors"]))
        self.assertEqual(len(self.exports), 1)

    def test_existing_lock_not_removed(self):
        lock = self.evidence / ".observer-other.lock"
        lock.write_text("other owner")
        with self.assertRaisesRegex(RuntimeError, "OTHER_INSPECTION_ACTIVE"):
            self.run_inspection()
        self.assertEqual(lock.read_text(), "other owner")

    def test_active_collector_without_file_lock_rejected(self):
        setattr(self.api, "_mw5_ai_research_collection", object())
        with self.assertRaisesRegex(RuntimeError, "OTHER_INSPECTION_ACTIVE"):
            self.run_inspection()
        self.assertEqual(self.finds, [])
        self.assertIsNotNone(getattr(self.api, "_mw5_ai_research_collection"))

    def test_user_stop(self):
        def stop(task, destination):
            (destination.parent / "STOP").write_text("stop")
            return True
        self.effect = stop
        result = self.run_inspection()
        self.assertIn("USER_STOP", str(result["errors"]))

    def test_real_api_rejected_by_mock_entry(self):
        self.api.__name__ = "unreal"
        with self.assertRaisesRegex(ValueError, "REAL_API_FORBIDDEN_IN_MOCK"):
            self.run_inspection()

    def test_unreviewed_native_entry_makes_no_query(self):
        self.api.__name__ = "unreal"
        with self.assertRaisesRegex(ValueError, "DORMANT_REVIEWED_MANIFEST_PIN_REQUIRED"):
            helper.run_native(self.api)
        self.assertEqual(self.finds, [])

    def test_native_manifest_dormant_wrong_pid_reuse_and_age(self):
        identity = {"pid": 123, "executable": str(helper.EDITOR_EXE), "creation_filetime": "134348399116267644"}
        now = datetime.datetime.now(datetime.timezone.utc)
        ready = dict(self.manifest, schema_version=1, status="REVIEWED_NATIVE_READY", allow_load=False,
                     editor_identity=identity, reviewed_at_utc=now.isoformat(), native_owner_confirmed=True,
                     native_owner="Research MW5 Lancemate AI", owner_evidence="MOCK_ONLY owner confirmation")
        helper.validate_native_manifest(ready, identity, now)
        for replacement, error in (({"status": "PREPARED_NATIVE_NOT_RUN_EDITOR_UNAVAILABLE"}, "NATIVE_REVIEW"),
                                   ({"allow_load": True}, "FIXED_SCOPE"),
                                   ({"targets": []}, "FIXED_SCOPE"),
                                   ({"editor_identity": dict(identity, creation_filetime="1")}, "IDENTITY_MISMATCH"),
                                   ({"native_owner_confirmed": "false"}, "FRESH_OWNER"),
                                   ({"native_owner": ""}, "FRESH_OWNER"),
                                   ({"reviewed_at_utc": (now-datetime.timedelta(minutes=11)).isoformat()}, "FRESH_OWNER")):
            with self.subTest(replacement=replacement):
                with self.assertRaisesRegex(ValueError, error):
                    helper.validate_native_manifest(dict(ready, **replacement), identity, now)

    def test_no_forbidden_native_operations_in_helper(self):
        tree = ast.parse((ROOT / "scripts/Inspect-DiagnosticTemplates.py").read_text())
        names = {node.attr for node in ast.walk(tree) if isinstance(node, ast.Attribute)}
        self.assertTrue(names.isdisjoint({"load_asset", "load_object", "find_asset", "save_asset", "save_loaded_asset",
            "compile_blueprint", "duplicate_asset", "get_asset_registry", "rename_asset", "reload_packages"}))


if __name__ == "__main__":
    unittest.main(verbosity=2)
