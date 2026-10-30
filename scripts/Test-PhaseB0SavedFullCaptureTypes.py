"""MOCK_ONLY tests for saved-checkpoint admission and raw export limits; no Unreal import."""
import hashlib
import importlib.util
import os
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest

ROOT = Path(__file__).resolve().parents[1]
HELPER = ROOT / 'scripts/Inspect-PhaseB0SavedFullCaptureTypes.py'


class SavedCheckpointExportTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix='mw5-b0-export-mock-')
        self.root = Path(self.tmp.name).resolve()
        spec = importlib.util.spec_from_file_location('saved_b0_export_mock', str(HELPER))
        self.m = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.m)
        self.m.ROOT = self.root
        self.m.OUTPUT = self.root / 'research/evidence/phase-b0-capture-type-function-native-02'
        self.m.OUTPUT.parent.mkdir(parents=True)
        self.m.SOURCE = self.root / 'source.uasset'
        self.m.BACKUP = self.root / 'original.uasset'
        self.m.CHECKPOINT = self.root / 'checkpoint.uasset'
        self.m.BASELINE = self.root / 'fixtures.COPY'
        source = b'S' * 834972
        original = b'B' * 28153
        baseline = b'\xff\xfe' + b' \x00' * ((2229892 - 2) // 2)
        self.m.SOURCE.write_bytes(source)
        self.m.CHECKPOINT.write_bytes(source)
        self.m.BACKUP.write_bytes(original)
        self.m.BASELINE.write_bytes(baseline)
        self.m.SOURCE_SHA = hashlib.sha256(source).hexdigest()
        self.m.BACKUP_SHA = hashlib.sha256(original).hexdigest()
        self.m.BASELINE_SHA = hashlib.sha256(baseline).hexdigest()
        self.m.os = SimpleNamespace(getpid=lambda: 26084, path=os.path)
        self.calls = {'find': 0, 'export': 0}
        self.export_bytes = baseline
        self.during_export = None
        self.find_result = SimpleNamespace(
            get_path_name=lambda: self.m.OBJECT,
            get_class=lambda: SimpleNamespace(get_path_name=lambda: '/Script/Engine.Blueprint'))

        def find(*args, **kwargs):
            self.calls['find'] += 1
            self.assertEqual(args, (self.m.OBJECT,))
            self.assertEqual(kwargs, {'type': self.api.Blueprint, 'follow_redirectors': False})
            return self.find_result

        class Task:
            def __init__(self):
                self.values = {'errors': []}

            def set_editor_property(self, key, value):
                self.values[key] = value

            def get_editor_property(self, key):
                return self.values[key]

        def export(task):
            self.calls['export'] += 1
            self.assertFalse(task.values['replace_identical'])
            self.assertFalse(task.values['prompt'])
            Path(task.values['filename']).write_bytes(self.export_bytes)
            if self.during_export:
                self.during_export()
            return True

        self.api = SimpleNamespace(
            __name__='unreal', Blueprint=object(), find_asset=find,
            ObjectExporterT3D=lambda: SimpleNamespace(
                get_editor_property=lambda key: {'text': True, 'format_extension': ['COPY']}[key]),
            AssetExportTask=Task, Exporter=SimpleNamespace(run_asset_export_task=export),
            log=lambda message: None)

    def tearDown(self):
        # Only this test's newly allocated temporary root is removed.
        self.assertEqual(Path(self.tmp.name).resolve(), self.root)
        self.tmp.cleanup()

    def run_export(self):
        return self.m.run(self.api, 'full', 26084)

    def assert_preclaim_refusal(self):
        with self.assertRaises(ValueError):
            self.run_export()
        self.assertEqual(self.calls, {'find': 0, 'export': 0})
        self.assertFalse((self.m.OUTPUT / 'full.consumed.json').exists())

    def test_distinct_saved_source_and_original_backup_admit_utf16_sized_export(self):
        result = self.run_export()
        self.assertEqual(result['status'], 'EXPORTED_REQUIRES_GRAPH_REVIEW')
        self.assertEqual(result['export']['bytes'], 2229892)
        self.assertEqual(self.calls, {'find': 1, 'export': 1})
        self.assertNotEqual(result['source_sha256'], result['original_backup_sha256'])

    def test_source_same_size_hash_drift_refuses_before_claim(self):
        self.m.SOURCE.write_bytes(b'T' * 834972)
        self.assert_preclaim_refusal()

    def test_original_backup_same_size_hash_drift_refuses_before_claim(self):
        self.m.BACKUP.write_bytes(b'C' * 28153)
        self.assert_preclaim_refusal()

    def test_checkpoint_same_size_hash_drift_refuses_before_claim(self):
        self.m.CHECKPOINT.write_bytes(b'T' * 834972)
        self.assert_preclaim_refusal()

    def test_baseline_same_size_hash_drift_refuses_before_claim(self):
        self.m.BASELINE.write_bytes(b'L' * 2229892)
        self.assert_preclaim_refusal()

    def test_wrong_process_refuses_before_claim(self):
        self.m.os.getpid = lambda: 26085
        self.assert_preclaim_refusal()

    def test_existing_result_refuses_before_claim(self):
        self.m.OUTPUT.mkdir()
        (self.m.OUTPUT / 'full.result.json').write_bytes(b'preserve me')
        self.assert_preclaim_refusal()
        self.assertEqual((self.m.OUTPUT / 'full.result.json').read_bytes(), b'preserve me')

    def test_replay_refuses_without_second_native_call(self):
        self.run_export()
        with self.assertRaises(ValueError):
            self.run_export()
        self.assertEqual(self.calls, {'find': 1, 'export': 1})

    def test_missing_loaded_object_consumes_attempt_without_export(self):
        self.find_result = None
        self.assertEqual(self.run_export()['status'], 'STOPPED_NO_RETRY')
        self.assertEqual(self.calls, {'find': 1, 'export': 0})
        self.assertTrue((self.m.OUTPUT / 'full.consumed.json').exists())

    def test_four_mib_boundary_is_admitted(self):
        self.export_bytes = b'X' * (4 * 1024 * 1024)
        self.assertEqual(self.run_export()['status'], 'EXPORTED_REQUIRES_GRAPH_REVIEW')

    def test_four_mib_plus_one_preserves_stopped_attempt_without_retry(self):
        self.export_bytes = b'X' * (4 * 1024 * 1024 + 1)
        result = self.run_export()
        self.assertEqual(result['status'], 'STOPPED_NO_RETRY')
        self.assertIn('size bound', result['error'])
        self.assertEqual((self.m.OUTPUT / 'full.COPY').stat().st_size, len(self.export_bytes))
        with self.assertRaises(ValueError):
            self.run_export()
        self.assertEqual(self.calls, {'find': 1, 'export': 1})

    def test_source_drift_during_export_stops(self):
        self.during_export = lambda: self.m.SOURCE.write_bytes(b'T' * 834972)
        self.assertEqual(self.run_export()['status'], 'STOPPED_NO_RETRY')

    def test_original_backup_drift_during_export_stops(self):
        self.during_export = lambda: self.m.BACKUP.write_bytes(b'C' * 28153)
        self.assertEqual(self.run_export()['status'], 'STOPPED_NO_RETRY')

    def test_saved_checkpoint_drift_during_export_stops(self):
        self.during_export = lambda: self.m.CHECKPOINT.write_bytes(b'T' * 834972)
        self.assertEqual(self.run_export()['status'], 'STOPPED_NO_RETRY')


if __name__ == '__main__':
    unittest.main(verbosity=2)
