"""MOCK_ONLY tests: no Unreal import, installed asset read or desktop input."""
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
spec = importlib.util.spec_from_file_location("diagnostic_copy_inspector", ROOT / "scripts/Inspect-DiagnosticControllerCopy.py")
helper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helper)
HEALTH = {"disk_free": 4 * 1024**3, "physical_available": 0, "commit_available": 0}


class Obj:
    def __init__(self, path, kind):
        self.path, self.kind = path, kind

    def get_path_name(self):
        return self.path

    def get_class(self):
        return SimpleNamespace(get_path_name=lambda: self.kind)


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
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.evidence = self.root / "research/evidence/editor-source"
        self.evidence.mkdir(parents=True)
        self.assets, self.protected, self.objects = [], [], {}
        self.finds, self.exports = [], []
        self.effect = None
        for label, _, object_path, _, _ in helper.ASSETS:
            raw = ("synthetic source " + label).encode()
            source = self.root / (label + ".uasset")
            source.write_bytes(raw)
            self.assets.append((label, source, object_path, len(raw), hashlib.sha256(raw).hexdigest()))
            self.objects[object_path] = Obj(object_path, "/Script/Engine.Blueprint")
            default_path = object_path.rsplit(".", 1)[0] + ".Default__" + helper.NAME + "_C"
            self.objects[default_path] = Obj(default_path, object_path + "_C")
        for index in range(7):
            raw = ("protected synthetic " + str(index)).encode()
            path = self.root / ("protected-%d.bin" % index)
            path.write_bytes(raw)
            self.protected.append((path, len(raw), hashlib.sha256(raw).hexdigest()))
        self.assets, self.protected = tuple(self.assets), tuple(self.protected)
        self.historical = []
        for label in ("receipt", "source", "defaults"):
            relative = "historical-" + label + ".txt"
            raw = ("MOCK_ONLY historical " + label).encode()
            (self.root / relative).write_bytes(raw)
            self.historical.append((label, relative, len(raw), hashlib.sha256(raw).hexdigest()))
        self.historical = tuple(self.historical)

        def find(path, follow_redirectors):
            self.assertFalse(follow_redirectors)
            self.finds.append(path)
            return self.objects.get(path)

        def export(task):
            values = task.values
            self.assertEqual(set(values), {"object", "exporter", "filename", "automated", "prompt", "replace_identical", "selected", "use_file_archive", "write_empty_files"})
            for key in ("prompt", "replace_identical", "selected", "use_file_archive", "write_empty_files"):
                self.assertIs(values[key], False)
            self.assertIs(values["automated"], True)
            self.exports.append(values["object"].path)
            destination = Path(values["filename"])
            destination.resolve().relative_to(self.evidence.resolve())
            self.assertFalse(destination.exists())
            destination.write_text("MOCK_ONLY " + values["object"].path)
            if self.effect:
                return self.effect(task, destination)
            return True

        self.api = SimpleNamespace(
            find_asset=find, find_object=lambda outer, path, follow_redirectors: find(path, follow_redirectors),
            ObjectExporterT3D=lambda: SimpleNamespace(get_editor_property=lambda key: {"text": True, "format_extension": ["T3D", "COPY"]}[key]),
            AssetExportTask=Task, Exporter=SimpleNamespace(run_asset_export_task=export))

    def run_export(self, **kwargs):
        result = helper.run(self.api, self.root, self.assets, self.protected,
                            health_query=kwargs.pop("health_query", lambda root: dict(HEALTH)),
                            historical=self.historical, **kwargs)
        self.assertFalse((self.evidence / ".diagnostic-controller-copy-inspection.lock").exists())
        self.assertFalse(hasattr(self.api, helper.ACTIVE_KEY))
        saved = json.loads((Path(result["output_directory"]) / "report.json").read_text())
        self.assertEqual(saved, result)
        self.assertEqual(saved["classification"], "MOCK_ONLY")
        self.assertEqual(saved["gameplay"], "NOT_PERFORMED")
        self.assertEqual(saved["cook_install"], "NOT_PERFORMED")
        return result

    def stopped(self, token, **kwargs):
        result = self.run_export(**kwargs)
        self.assertEqual(result["status"], "STOPPED_PARTIAL")
        self.assertIn(token, str(result["errors"]))
        return result

    def test_only_two_blueprints_and_two_defaults_low_ram_allowed(self):
        result = self.run_export()
        self.assertEqual(result["status"], "MOCK_ONLY_COMPLETED")
        self.assertEqual(self.finds, list(self.objects))
        self.assertEqual(self.exports, list(self.objects))
        self.assertEqual(result["last_health"]["physical_available"], 0)
        self.assertEqual(result["last_health"]["commit_available"], 0)
        self.assertEqual(len(result["source_checks_before"]), 9)
        self.assertEqual(len(result["source_checks_after"]), 9)
        self.assertTrue(result["disk_sources_unchanged"])
        self.assertTrue(all(a["source"]["export_return"] for a in result["assets"]))
        self.assertTrue(all(a["source"]["file"].endswith(".COPY") for a in result["assets"]))

    def test_missing_blueprint_or_cdo_never_loads_or_exports(self):
        for missing in list(self.objects):
            with self.subTest(missing=missing):
                obj = self.objects.pop(missing)
                self.stopped("NOT_ALREADY_LOADED")
                self.assertEqual(self.exports, [])
                self.objects[missing] = obj

    def test_wrong_blueprint_and_cdo_identity(self):
        for target in list(self.objects):
            for field in ("path", "kind"):
                with self.subTest(target=target, field=field):
                    obj = self.objects[target]
                    value = getattr(obj, field)
                    setattr(obj, field, "/Wrong/Other.Other")
                    self.stopped("IDENTITY_OR_TYPE_MISMATCH")
                    self.assertEqual(self.exports, [])
                    setattr(obj, field, value)

    def test_stock_alias_records_both_blueprints_and_defaults_without_export(self):
        stock_path, copy_path = self.assets[0][2], self.assets[1][2]
        self.objects[stock_path] = self.objects[copy_path]
        result = self.stopped("BLUEPRINT_IDENTITY_OR_TYPE_MISMATCH: stock")
        self.assertTrue(result["identity_inventory_complete"])
        self.assertEqual(self.finds, list(self.objects))
        self.assertEqual(len(result["assets"]), 2)
        stock, mod_copy = result["assets"]
        self.assertEqual(stock["source"]["requested_object_path"], stock_path)
        self.assertEqual(stock["source"]["observed_object_path"], copy_path)
        self.assertEqual(stock["source"]["observed_class_path"], "/Script/Engine.Blueprint")
        self.assertFalse(stock["source"]["identity_matches"])
        self.assertEqual(mod_copy["source"]["observed_object_path"], copy_path)
        self.assertTrue(mod_copy["source"]["identity_matches"])
        self.assertTrue(all(a["defaults"]["identity_matches"] for a in result["assets"]))
        self.assertEqual(result["exported_bytes"], 0)
        self.assertEqual(self.exports, [])

    def test_cdo_alias_records_actual_class_and_path_but_never_exports(self):
        default_paths = [p for p in self.objects if ".Default__" in p]
        self.objects[default_paths[0]] = self.objects[default_paths[1]]
        result = self.stopped("CDO_IDENTITY_OR_TYPE_MISMATCH: stock")
        source = result["assets"][0]["defaults"]
        self.assertEqual(source["observed_object_path"], default_paths[1])
        self.assertEqual(source["observed_class_path"], self.assets[1][2] + "_C")
        self.assertFalse(source["identity_matches"])
        self.assertEqual(len(self.finds), 4)
        self.assertEqual(self.exports, [])

    def test_first_lookup_exception_still_records_second_candidate(self):
        original_find = self.api.find_asset
        stock_path = self.assets[0][2]
        def lookup(path, **options):
            if path == stock_path:
                self.finds.append(path)
                raise RuntimeError("synthetic identity lookup failure")
            return original_find(path, **options)
        self.api.find_asset = lookup
        result = self.stopped("BLUEPRINT_IDENTITY_LOOKUP_FAILED: stock")
        self.assertIn("synthetic identity lookup failure", result["assets"][0]["source"]["identity_exception"])
        self.assertTrue(result["assets"][1]["source"]["identity_matches"])
        self.assertEqual(len(self.finds), 4)
        self.assertEqual(self.exports, [])

    def test_disk_mutation_during_identity_lookup_stops_inventory(self):
        original_find = self.api.find_asset
        def mutate(path, **options):
            found = original_find(path, **options)
            self.protected[0][0].write_bytes(b"changed")
            return found
        self.api.find_asset = mutate
        result = self.stopped("SOURCE_HASH_OR_SIZE_MISMATCH")
        self.assertFalse(result["disk_sources_unchanged"])
        self.assertNotIn("identity_inventory_complete", result)
        self.assertEqual(len(self.finds), 1)
        self.assertEqual(self.exports, [])

    def test_copy_only_exports_exact_copy_with_historical_stock_no_stock_query(self):
        stock, mod_copy = self.assets
        # The observed active-mod alias exists, but copy-only must never query it.
        self.objects[stock[2]] = self.objects[mod_copy[2]]
        result = self.run_export(mode="copy-only")
        expected = [mod_copy[2], mod_copy[2].rsplit(".", 1)[0] + ".Default__" + helper.NAME + "_C"]
        self.assertEqual(result["status"], "MOCK_ONLY_COMPLETED")
        self.assertEqual(result["inspection_mode"], "copy-only")
        self.assertEqual(self.finds, expected)
        self.assertEqual(self.exports, expected)
        self.assertEqual(len(result["assets"]), 1)
        self.assertEqual(len(result["source_checks_before"]), 9)
        self.assertEqual(len(result["source_checks_after"]), 9)
        baseline = result["historical_stock_comparison"]
        self.assertEqual(baseline["classification"], "HISTORICAL_COMPARISON_BASELINE")
        self.assertEqual(baseline["stock_object_path"], stock[2])
        self.assertEqual(baseline["stock_disk_sha256"], stock[4])
        self.assertEqual(len(baseline["files_before"]), 3)
        self.assertTrue(result["historical_baseline_unchanged"])

    def test_copy_only_rejects_wrong_or_missing_copy_identity(self):
        copy_path = self.assets[1][2]
        for field in ("path", "kind"):
            with self.subTest(field=field):
                obj = self.objects[copy_path]
                original = getattr(obj, field)
                setattr(obj, field, "/Wrong/Other.Other")
                self.stopped("BLUEPRINT_IDENTITY_OR_TYPE_MISMATCH", mode="copy-only")
                self.assertEqual(self.exports, [])
                setattr(obj, field, original)
        default_path = copy_path.rsplit(".", 1)[0] + ".Default__" + helper.NAME + "_C"
        del self.objects[default_path]
        self.stopped("NOT_ALREADY_LOADED_CDO", mode="copy-only")
        self.assertEqual(self.exports, [])

    def test_copy_only_still_pins_stock_disk(self):
        self.assets[0][1].write_bytes(b"changed stock")
        self.stopped("SOURCE_HASH_OR_SIZE_MISMATCH", mode="copy-only")
        self.assertEqual(self.finds, [])

    def test_copy_only_historical_files_must_match_before_api(self):
        for label, relative, _, _ in self.historical:
            with self.subTest(label=label):
                path = self.root / relative
                raw = path.read_bytes()
                path.write_bytes(b"changed")
                result = self.stopped("HISTORICAL_BASELINE_HASH_OR_SIZE_MISMATCH", mode="copy-only")
                self.assertFalse(result["historical_baseline_unchanged"])
                self.assertEqual(self.finds, [])
                path.write_bytes(raw)

    def test_copy_only_historical_change_during_export_stops_remaining_export(self):
        def mutate(task, destination):
            (self.root / self.historical[1][1]).write_bytes(b"changed")
            return True
        self.effect = mutate
        result = self.stopped("HISTORICAL_BASELINE_HASH_OR_SIZE_MISMATCH", mode="copy-only")
        self.assertFalse(result["historical_baseline_unchanged"])
        self.assertTrue(result["disk_sources_unchanged"])
        self.assertEqual(len(self.exports), 1)

    def test_unknown_mode_rejected_before_source_or_api_access(self):
        with self.assertRaisesRegex(ValueError, "UNSUPPORTED_FIXED_INSPECTION_MODE"):
            helper.run(self.api, self.root, self.assets, self.protected, mode="arbitrary")
        self.assertEqual(self.finds, [])

    def test_fixed_entry_loads_pinned_definitions_without_unreal_or_inspection(self):
        wrapper_spec = importlib.util.spec_from_file_location("copy_only_entry_test", ROOT / "scripts/Inspect-DiagnosticControllerCopyOnly.py")
        wrapper = importlib.util.module_from_spec(wrapper_spec)
        wrapper_spec.loader.exec_module(wrapper)
        loaded = wrapper.load_pinned_helper()
        self.assertEqual(loaded.ASSETS, helper.ASSETS)
        self.assertNotIn("unreal", sys.modules)
        with patch.object(wrapper, "HELPER_SHA256", "0" * 64):
            with self.assertRaisesRegex(ValueError, "HELPER_HASH_MISMATCH"):
                wrapper.load_pinned_helper()
        with patch.object(wrapper, "ROOT", self.root):
            with self.assertRaisesRegex(ValueError, "ROOT_MISMATCH"):
                wrapper.load_pinned_helper()

    def test_each_pinned_file_mutation_rejected_before_api(self):
        paths = [a[1] for a in self.assets] + [p[0] for p in self.protected]
        for path in paths:
            with self.subTest(path=path.name):
                raw = path.read_bytes()
                path.write_bytes(b"changed")
                result = self.stopped("SOURCE_HASH_OR_SIZE_MISMATCH")
                self.assertFalse(result["disk_sources_unchanged"])
                self.assertEqual(self.finds, [])
                path.write_bytes(raw)

    def test_source_mutation_during_export_stops_remaining_work(self):
        def mutate(task, destination):
            self.assets[1][1].write_bytes(b"changed")
            return True
        self.effect = mutate
        result = self.stopped("SOURCE_HASH_OR_SIZE_MISMATCH")
        self.assertFalse(result["disk_sources_unchanged"])
        self.assertEqual(len(self.exports), 1)

    def test_protected_mutation_during_export_is_detected(self):
        def mutate(task, destination):
            self.protected[4][0].write_bytes(b"changed")
            return True
        self.effect = mutate
        self.assertFalse(self.stopped("SOURCE_HASH_OR_SIZE_MISMATCH")["disk_sources_unchanged"])
        self.assertEqual(len(self.exports), 1)

    def test_low_disk_stops_before_api(self):
        self.stopped("DISK_RESOURCE_STOP", health_query=lambda root: dict(HEALTH, disk_free=1))
        self.assertEqual(self.finds, [])

    def test_export_false_is_not_promoted_to_success(self):
        self.effect = lambda task, destination: False
        result = self.stopped("EXPORT_FAILURE_OR_ERRORS")
        self.assertIs(result["assets"][0]["source"]["export_return"], False)
        self.assertEqual(len(self.exports), 1)

    def test_export_errors_fail_even_when_return_true(self):
        def error(task, destination):
            task.errors = ["synthetic native error"]
            return True
        self.effect = error
        result = self.stopped("EXPORT_FAILURE_OR_ERRORS")
        self.assertTrue(result["assets"][0]["source"]["export_return"])
        self.assertEqual(result["assets"][0]["source"]["exporter_errors"], ["synthetic native error"])

    def test_export_exception_retained(self):
        def error(task, destination):
            raise OSError("synthetic native exception")
        self.effect = error
        result = self.stopped("synthetic native exception")
        self.assertEqual(result["assets"][0]["source"]["status"], "EXPORT_EXCEPTION")
        self.assertEqual(len(self.exports), 1)

    def test_no_file_rejected(self):
        def remove(task, destination):
            destination.unlink()
            return True
        self.effect = remove
        self.stopped("EXPORT_PRODUCED_NO_FILE")

    def test_empty_file_rejected(self):
        def empty(task, destination):
            destination.write_bytes(b"")
            return True
        self.effect = empty
        self.stopped("NATIVE_OUTPUT_LIMIT_RETAINED")

    def test_oversize_export_retained_but_not_read(self):
        def large(task, destination):
            with destination.open("wb") as stream:
                stream.truncate(helper.MAX_FILE + 1)
            return True
        self.effect = large
        result = self.stopped("NATIVE_OUTPUT_LIMIT_RETAINED")
        self.assertNotIn("sha256", result["assets"][0]["source"])
        self.assertEqual(len(self.exports), 1)

    def test_total_output_limit(self):
        with patch.object(helper, "MAX_TOTAL", 1):
            self.stopped("NATIVE_OUTPUT_LIMIT_RETAINED")
        self.assertEqual(len(self.exports), 1)

    def test_nontext_or_unknown_export_format_rejected(self):
        for properties in ({"text": False, "format_extension": ["COPY"]}, {"text": True, "format_extension": ["png"]}):
            with self.subTest(properties=properties):
                self.api.ObjectExporterT3D = lambda: SimpleNamespace(get_editor_property=lambda key: properties[key])
                self.stopped("TEXT_EXPORTER_UNAVAILABLE")
                self.assertEqual(self.exports, [])

    def test_stop_marker_stops_next_native_export(self):
        def stop(task, destination):
            (destination.parent / "STOP").write_text("user stop")
            return True
        self.effect = stop
        self.stopped("USER_STOP")
        self.assertEqual(len(self.exports), 1)

    def test_cooperative_timeout_stops_before_api(self):
        values = iter([0, 0, 91])
        self.stopped("COOPERATIVE_BUDGET_STOP", clock=lambda: next(values, 91))
        self.assertEqual(self.finds, [])

    def test_foreign_lock_preserved(self):
        for name in (".observer-reference-lookup.lock", ".diagnostic-other.lock"):
            lock = self.evidence / name
            lock.write_text("another owner")
            with self.assertRaisesRegex(RuntimeError, "LOCK_PRESENT"):
                helper.run(self.api, self.root, self.assets, self.protected)
            self.assertEqual(lock.read_text(), "another owner")
            lock.unlink()
        self.assertEqual(self.finds, [])

    def test_other_active_inspector_is_not_cleared(self):
        setattr(self.api, helper.OTHER_ACTIVE_KEYS[0], "foreign token")
        with self.assertRaisesRegex(RuntimeError, "OTHER_INSPECTION_ACTIVE"):
            helper.run(self.api, self.root, self.assets, self.protected)
        self.assertEqual(getattr(self.api, helper.OTHER_ACTIVE_KEYS[0]), "foreign token")
        self.assertEqual(self.finds, [])

    def test_native_scope_override_rejected_before_installed_file_access(self):
        with self.assertRaisesRegex(ValueError, "NATIVE_SCOPE_MISMATCH"):
            helper.run(self.api, self.root, self.assets, self.protected, native=True)
        self.assertEqual(self.finds, [])

    def test_real_unreal_api_rejected_in_mock_mode(self):
        self.api.__name__ = "unreal"
        with self.assertRaisesRegex(ValueError, "REAL_API_FORBIDDEN"):
            helper.run(self.api, self.root, self.assets, self.protected)
        self.assertEqual(self.finds, [])


if __name__ == "__main__":
    unittest.main(verbosity=2)
