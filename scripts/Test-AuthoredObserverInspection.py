"""Offline safety checks only. No Unreal import, installed asset access or game run."""
import hashlib
import importlib.util
import json
from pathlib import Path
import sys
import tempfile
from types import SimpleNamespace
import unittest

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location("authored_review", ROOT / "scripts/Inspect-AuthoredObserver.py")
helper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helper)
HEALTH = {"disk_free": 4 * 1024**3, "physical_available": 2 * 1024**3, "commit_available": 2 * 1024**3}


class Obj:
    def __init__(self, path, kind):
        self.path, self.kind = path, kind

    def get_path_name(self):
        return self.path

    def get_class(self):
        return SimpleNamespace(get_path_name=lambda: self.kind)


class Task:
    def __init__(self):
        self.values = {}
        self.errors = []

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
        self.content = self.root / "content"
        self.content.mkdir()
        self.evidence = self.root / "research/evidence/editor-source"
        self.evidence.mkdir(parents=True)
        self.assets = []
        self.objects = {}
        self.calls = []
        self.exports = []
        self.export_error = False
        self.mutate = False
        for name, kind, _ in helper.ASSETS:
            raw = name.encode()
            (self.content / (name + ".uasset")).write_bytes(raw)
            self.assets.append((name, kind, hashlib.sha256(raw).hexdigest()))
            path = "/LanceObserverProbe/" + name + "." + name
            self.objects[path] = Obj(path, kind)
            if name.startswith(("BP_", "WBP_")):
                default_path = path.rsplit(".", 1)[0] + ".Default__" + name + "_C"
                self.objects[default_path] = Obj(default_path, path + "_C")
        self.assets = tuple(self.assets)

        def find(path, follow_redirectors):
            self.assertFalse(follow_redirectors)
            self.calls.append(path)
            return self.objects.get(path)

        def export(task):
            values = task.values
            for key in ("prompt", "replace_identical", "selected", "use_file_archive", "write_empty_files"):
                self.assertFalse(values[key])
            self.assertTrue(values["automated"])
            self.exports.append(values["object"].path)
            destination = Path(values["filename"])
            destination.resolve().relative_to(self.evidence.resolve())
            self.assertFalse(destination.exists())
            destination.write_text("MOCK_ONLY " + values["object"].path)
            if self.mutate:
                (self.content / (self.assets[0][0] + ".uasset")).write_bytes(b"changed")
            if self.export_error:
                task.errors = ["synthetic exporter error"]
                return False
            return True

        self.api = SimpleNamespace(
            find_asset=find, find_object=lambda outer, path, follow_redirectors: find(path, follow_redirectors),
            ObjectExporterT3D=lambda: SimpleNamespace(get_editor_property=lambda key: {"text": True, "format_extension": ["copy"]}[key]),
            AssetExportTask=Task, Exporter=SimpleNamespace(run_asset_export_task=export))

    def run_export(self, **kw):
        result = helper.run(self.api, self.root, self.content, self.assets,
                            health_query=kw.get("health", lambda root: HEALTH))
        self.assertFalse((self.evidence / ".observer-authored-inspection.lock").exists())
        self.assertFalse(hasattr(self.api, helper.ACTIVE_KEY))
        report = json.loads((Path(result["output_directory"]) / "report.json").read_text())
        self.assertEqual(report["classification"], "MOCK_ONLY")
        self.assertEqual(report["gameplay"], "NOT_PERFORMED")
        return result

    def test_only_three_assets_and_two_existing_defaults(self):
        result = self.run_export()
        self.assertEqual(result["status"], "MOCK_ONLY_COMPLETED")
        self.assertEqual(set(self.exports), set(self.objects))
        self.assertEqual(len(self.exports), 5)
        self.assertTrue(result["disk_sources_unchanged"])

    def test_missing_asset_never_loaded(self):
        self.objects.pop(next(iter(self.objects)))
        result = self.run_export()
        self.assertIn("NOT_ALREADY_LOADED", str(result["errors"]))
        self.assertEqual(self.exports, [])

    def test_missing_defaults_remain_unknown(self):
        self.objects = {k: v for k, v in self.objects.items() if "Default__" not in k}
        result = self.run_export()
        self.assertEqual(len(self.exports), 3)
        self.assertEqual(result["assets"][0]["defaults"]["status"], "NOT_ALREADY_LOADED")

    def test_changed_saved_asset_stops_before_api(self):
        (self.content / (self.assets[0][0] + ".uasset")).write_bytes(b"changed")
        result = self.run_export()
        self.assertFalse(result["disk_sources_unchanged"])
        self.assertEqual(self.calls, [])

    def test_low_resources_stop_before_api(self):
        result = self.run_export(health=lambda root: dict(HEALTH, physical_available=1))
        self.assertIn("RESOURCE_STOP", str(result["errors"]))
        self.assertEqual(self.calls, [])

    def test_export_failure_stops_remaining_work(self):
        self.export_error = True
        result = self.run_export()
        self.assertEqual(result["status"], "STOPPED_PARTIAL")
        self.assertEqual(len(self.exports), 1)

    def test_source_change_during_export_stops_remaining_work(self):
        self.mutate = True
        result = self.run_export()
        self.assertFalse(result["disk_sources_unchanged"])
        self.assertEqual(len(self.exports), 1)

    def test_foreign_lock_is_preserved(self):
        lock = self.evidence / ".observer-reference-lookup.lock"
        lock.write_text("another owner")
        with self.assertRaisesRegex(RuntimeError, "LOCK_PRESENT"):
            helper.run(self.api, self.root, self.content, self.assets)
        self.assertEqual(lock.read_text(), "another owner")
        self.assertEqual(self.calls, [])

    def test_wrong_object_class_is_rejected(self):
        self.objects[next(iter(self.objects))].kind = "/Script/Engine.Texture2D"
        result = self.run_export()
        self.assertIn("IDENTITY_OR_TYPE_MISMATCH", str(result["errors"]))
        self.assertEqual(self.exports, [])


if __name__ == "__main__":
    unittest.main(verbosity=2)
