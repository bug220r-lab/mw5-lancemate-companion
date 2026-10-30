"""MOCK_ONLY resume collector guards. Never imports Unreal or executes an entry."""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest

ROOT = Path(__file__).resolve().parents[1]


class ResumeCollectorTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix='mw5-resume-readonly-mock-')
        self.root = Path(self.tmp.name).resolve()
        spec = importlib.util.spec_from_file_location('resume_mock', str(ROOT / 'scripts/Inspect-PhaseB0ResumeState.py'))
        self.m = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.m)
        self.m.ROOT = self.root
        self.m.OUTPUT = self.root / 'research/evidence/phase-b0-resume-source-native-01'
        self.m.OUTPUT.mkdir(parents=True)
        self.m.MANIFEST = self.m.OUTPUT / 'protected-inputs.json'
        source = self.root / 'source'; source.write_bytes(b'preserved')
        self.source = source
        row = {'path': str(source), 'bytes': 9, 'sha256': hashlib.sha256(b'preserved').hexdigest()}
        log = self.root / 'editor.log'; log.write_bytes(b'prefix')
        manifest = {'status': 'PREPARED_READ_ONLY_B0_RESUME_INSPECTION', 'protected_files': [row] * 28,
                    'backup_and_history_files': [], 'log_anchor': {'path': str(log), 'prefix_bytes': 6,
                    'prefix_sha256': hashlib.sha256(b'prefix').hexdigest()}}
        self.m.MANIFEST.write_text(json.dumps(manifest), encoding='utf-8')
        self.m.MANIFEST_SHA = hashlib.sha256(self.m.MANIFEST.read_bytes()).hexdigest()
        self.m.os = SimpleNamespace(getpid=lambda: 26084, path=os.path)
        self.calls = {'find': [], 'export': []}
        self.missing = None; self.wrong_class = False; self.failed_export = False
        self.export_bytes = b'COPY'; self.during_export = None
        expected = {path: cls for _, path, cls in self.m.TARGETS}

        def find(path, **kwargs):
            self.calls['find'].append(path)
            self.assertEqual(kwargs, {'type': self.api.Blueprint, 'follow_redirectors': False})
            if path == self.missing:
                return None
            return SimpleNamespace(get_path_name=lambda: path, get_class=lambda: SimpleNamespace(
                get_path_name=lambda: '/wrong' if self.wrong_class else expected[path]))

        class Task:
            def __init__(self): self.values = {'errors': []}
            def set_editor_property(self, key, value): self.values[key] = value
            def get_editor_property(self, key): return self.values[key]

        def export(task):
            self.calls['export'].append(task.values['filename'])
            self.assertEqual(task.values['automated'], True)
            self.assertFalse(task.values['replace_identical'])
            self.assertFalse(task.values['prompt'])
            Path(task.values['filename']).write_bytes(self.export_bytes)
            if self.during_export: self.during_export()
            return not self.failed_export

        self.api = SimpleNamespace(__name__='unreal', Blueprint=object(), find_asset=find,
            ObjectExporterT3D=lambda: SimpleNamespace(get_editor_property=lambda key:
                {'text': True, 'format_extension': ['COPY']}[key]), AssetExportTask=Task,
            Exporter=SimpleNamespace(run_asset_export_task=export), log=lambda text: None)

    def tearDown(self): self.tmp.cleanup()
    def run_collector(self, stage='resume', pid=26084): return self.m.run(self.api, stage, pid)
    def assert_no_api(self): self.assertEqual(self.calls, {'find': [], 'export': []})

    def test_exact_three_find_three_export_then_replay_refused(self):
        result = self.run_collector()
        self.assertEqual(result['status'], 'EXPORTED_RESUME_STATE_REQUIRES_REVIEW')
        self.assertEqual(self.calls['find'], [p for _, p, _ in self.m.TARGETS])
        self.assertEqual(len(self.calls['export']), 3)
        with self.assertRaises(ValueError): self.run_collector()
        self.assertEqual(len(self.calls['export']), 3)

    def test_wrong_stage_and_process_refuse_before_claim(self):
        for args in [('failure', 26084), ('resume', 1)]:
            with self.assertRaises(ValueError): self.run_collector(*args)
        self.assert_no_api()
        self.assertFalse((self.m.OUTPUT / 'resume.consumed.json').exists())

    def test_missing_third_target_stops_before_any_export_no_fallback(self):
        self.missing = self.m.TARGETS[-1][1]
        result = self.run_collector()
        self.assertEqual(result['status'], 'STOPPED_NO_RETRY')
        self.assertEqual(len(self.calls['find']), 3); self.assertEqual(self.calls['export'], [])

    def test_wrong_native_class_stops(self):
        self.wrong_class = True
        self.assertEqual(self.run_collector()['status'], 'STOPPED_NO_RETRY')
        self.assertEqual(self.calls['export'], [])

    def test_preexisting_output_refuses_before_queries(self):
        (self.m.OUTPUT / 'widget.COPY').write_bytes(b'prior evidence')
        with self.assertRaises(ValueError): self.run_collector()
        self.assert_no_api()

    def test_source_drift_refuses_before_claim(self):
        self.source.write_bytes(b'changed!!')
        with self.assertRaises(ValueError): self.run_collector()
        self.assert_no_api()
        self.assertFalse((self.m.OUTPUT / 'resume.consumed.json').exists())

    def test_source_drift_between_exports_stops_after_first(self):
        self.during_export = lambda: self.source.write_bytes(b'changed!!')
        self.assertEqual(self.run_collector()['status'], 'STOPPED_NO_RETRY')
        self.assertEqual(len(self.calls['export']), 1)

    def test_export_failure_is_preserved_no_retry(self):
        self.failed_export = True
        self.assertEqual(self.run_collector()['status'], 'STOPPED_NO_RETRY')
        self.assertEqual(len(self.calls['export']), 1)
        self.assertTrue((self.m.OUTPUT / 'resume.consumed.json').is_file())

    def test_four_mib_plus_one_stops_before_second_export(self):
        self.export_bytes = b'x' * (4 * 1024 * 1024 + 1)
        self.assertEqual(self.run_collector()['status'], 'STOPPED_NO_RETRY')
        self.assertEqual(len(self.calls['export']), 1)

    def test_log_prefix_drift_refuses_before_claim(self):
        (self.root / 'editor.log').write_bytes(b'change')
        with self.assertRaises(ValueError): self.run_collector()
        self.assert_no_api()


if __name__ == '__main__':
    unittest.main(verbosity=2)
