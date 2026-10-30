"""Focused MOCK_ONLY loading-boundary tests; no Unreal or desktop invocation."""
import importlib.util
import json
from pathlib import Path
import sys
from types import SimpleNamespace
import unittest

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parent.parent


def module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


fixtures = module('template_fixtures', ROOT / 'scripts/Test-DiagnosticTemplates.py')
loader = module('template_loader', ROOT / 'scripts/Inspect-DiagnosticTemplateLoad.py')
base = loader.load_base()


class LoadChecks(unittest.TestCase):
    def setUp(self):
        self.fixture = fixtures.Checks()
        self.fixture.setUp()
        self.addCleanup(self.fixture.doCleanups)
        self.api = self.fixture.api
        self.roots = {}
        self.loaded = {}
        self.finds, self.loads = [], []
        self.effect = None
        for target in loader.assets(base):
            package = fixtures.Obj(target['outer_path'], '/Script/CoreUObject.Package')
            self.roots[target['object_path']] = fixtures.Obj(target['object_path'], target['class_path'], package)

        def find(path, follow_redirectors):
            self.assertFalse(follow_redirectors)
            self.finds.append(path)
            return self.loaded.get(path)

        def load(path, follow_redirectors):
            self.assertFalse(follow_redirectors)
            self.assertTrue(getattr(self.api, base.ACTIVE_KEY))
            self.assertTrue((self.fixture.evidence / '.diagnostic-template-inspection.lock').exists())
            self.loads.append(path)
            self.assertEqual(len(list(self.fixture.evidence.glob('diagnostic-templates-*/before-*-load.json'))), len(self.loads))
            if self.effect:
                result = self.effect(path)
            else:
                result = self.roots[path]
            self.loaded[path] = result
            return result

        self.api.find_asset = find
        self.api.load_asset = load

    def run_load(self, health_query=None):
        result = loader.run_mock(self.api, self.fixture.manifest, self.fixture.root,
                                 health_query or (lambda _: dict(fixtures.HEALTH)))
        self.assertEqual(result['classification'], 'MOCK_ONLY')
        self.assertEqual(result['native_inspection'], 'NOT_PERFORMED')
        self.assertNotIn('asset_mutation_load_save_compile_selection_restart_cook_retail', result)
        self.assertEqual(result['explicit_asset_edit_save_compile_reload_selection_restart_cook_retail'], 'NOT_PERFORMED')
        self.assertFalse(hasattr(self.api, base.ACTIVE_KEY))
        self.assertFalse((self.fixture.evidence / '.diagnostic-template-inspection.lock').exists())
        self.assertEqual(result, json.loads((Path(result['output_directory']) / 'report.json').read_text()))
        return result

    def test_loads_stock_then_copy_once_and_requeries_roots(self):
        result = self.run_load()
        names = list(self.roots)
        self.assertEqual(self.loads, names)
        self.assertEqual(self.finds, names + names)
        self.assertEqual(len(self.fixture.finds), 10)
        self.assertEqual(len(self.fixture.exports), 10)
        self.assertEqual(result['loading']['status'], 'EXACT_ROOT_IDENTITIES_OBSERVED')
        self.assertTrue(result['protected_unchanged'])

    def test_already_loaded_roots_never_reloaded(self):
        self.loaded.update(self.roots)
        self.assertEqual(self.run_load()['loading']['attempted_calls'], 0)
        self.assertEqual(self.loads, [])

    def test_missing_stock_stops_no_diagnostic_or_template_call(self):
        self.effect = lambda _: None
        result = self.run_load()
        self.assertIn('EXACT_ROOT_UNAVAILABLE_UNKNOWN', str(result['errors']))
        self.assertEqual(len(self.loads), 1)
        self.assertEqual(self.fixture.finds, [])

    def test_missing_diagnostic_stops_no_template_call(self):
        self.effect = lambda path: self.roots[path] if path.startswith('/Game/') else None
        result = self.run_load()
        self.assertEqual(result['loading']['status'], 'MISSING_ROOT_UNKNOWN')
        self.assertEqual(len(self.loads), 2)
        self.assertEqual(self.fixture.finds, [])

    def test_initial_stock_alias_rejected(self):
        self.loaded[list(self.roots)[0]] = list(self.roots.values())[1]
        self.assertIn('EXACT_OBJECT_CLASS_OUTER_MISMATCH', str(self.run_load()['errors']))
        self.assertEqual(self.loads, [])
        self.assertEqual(self.fixture.exports, [])

    def test_stock_redirect_introduced_by_diagnostic_load_rejected(self):
        def effect(path):
            if path.startswith('/ModOverride/'):
                self.loaded[list(self.roots)[0]] = self.roots[path]
            return self.roots[path]
        self.effect = effect
        result = self.run_load()
        self.assertIn('EXACT_OBJECT_CLASS_OUTER_MISMATCH', str(result['errors']))
        self.assertEqual(self.fixture.finds, [])

    def test_bad_root_class_rejected(self):
        list(self.roots.values())[0].kind = '/Script/CoreUObject.ObjectRedirector'
        self.assertIn('EXACT_OBJECT_CLASS_OUTER_MISMATCH', str(self.run_load()['errors']))
        self.assertEqual(self.fixture.finds, [])

    def test_disk_change_during_load_stops_no_restore(self):
        def effect(path):
            self.fixture.source.write_bytes(b'changed')
            return self.roots[path]
        self.effect = effect
        result = self.run_load()
        self.assertFalse(result['protected_unchanged'])
        self.assertEqual(len(self.loads), 1)
        self.assertEqual(self.fixture.finds, [])
        self.assertEqual(self.fixture.source.read_bytes(), b'changed')

    def test_selection_change_during_load_stops(self):
        def effect(path):
            self.fixture.marker.write_bytes(b'changed')
            return self.roots[path]
        self.effect = effect
        self.assertFalse(self.run_load()['selection_unchanged'])
        self.assertEqual(self.fixture.finds, [])

    def test_allocation_failure_preserved_and_no_retry(self):
        def effect(path):
            raise MemoryError('MOCK load allocation failure')
        self.effect = effect
        self.assertIn('MemoryError', str(self.run_load()['errors']))
        self.assertEqual(len(self.loads), 1)

    def test_disk_gate_before_load(self):
        self.assertIn('DISK_RESOURCE_STOP', str(self.run_load(lambda _: {'disk_free': 0})['errors']))
        self.assertEqual(self.loads, [])

    def test_human_stop_before_load(self):
        def health(_):
            for directory in self.fixture.evidence.glob('diagnostic-templates-*'):
                (directory / 'STOP').write_text('user stop')
            return dict(fixtures.HEALTH)
        self.assertIn('USER_STOP', str(self.run_load(health)['errors']))
        self.assertEqual(self.loads, [])

    def test_template_missing_stays_unknown_after_root_load(self):
        self.fixture.objects.clear()
        result = self.run_load()
        self.assertEqual(result['status'], 'PARTIAL_MISSING_OBJECTS_UNKNOWN')
        self.assertEqual(len(self.loads), 2)
        self.assertTrue(all(q['interpretation'] == 'UNKNOWN' for q in result['queries']))

    def test_oversized_receipt_no_false_no_load_claim(self):
        self.fixture.manifest['padding'] = 'x' * base.MAX_RECEIPT
        result = self.run_load()
        self.assertEqual(result['status'], 'STOPPED_PARTIAL_REQUIRES_REVIEW')
        self.assertIn('RECEIPT_SIZE_LIMIT', str(result['errors']))
        self.assertEqual(self.loads, [])

    def test_unreviewed_native_entry_calls_no_api(self):
        self.api.__name__ = 'unreal'
        with self.assertRaisesRegex(ValueError, 'DORMANT_REVIEWED_MANIFEST_PIN_REQUIRED'):
            loader.run_native(self.api)
        self.assertEqual(self.loads, [])

    def test_exact_scope_and_permission_admission(self):
        import datetime
        now = datetime.datetime.now(datetime.timezone.utc)
        identity = {'pid': 1, 'executable': str(base.EDITOR_EXE), 'creation_filetime': '1'}
        manifest = dict(self.fixture.manifest, schema_version=1, status='REVIEWED_NATIVE_READY', allow_load=False,
                        allow_exact_path_load=True, root_assets=loader.assets(base), editor_identity=identity,
                        reviewed_at_utc=now.isoformat(), native_owner_confirmed=True, native_owner='MOCK', owner_evidence='MOCK',
                        attempt_id='diagnostic-template-load-20260926T214811Z-2eb064c1', base_helper_sha256=loader.BASE_SHA)
        loader.validate(base, manifest, identity, now)
        for replacement in ({'allow_exact_path_load': 'true'}, {'root_assets': []}, {'allow_load': True}, {'attempt_id': '../escape'}):
            with self.subTest(replacement=replacement), self.assertRaises(ValueError):
                loader.validate(base, dict(manifest, **replacement), identity, now)


if __name__ == '__main__':
    unittest.main(verbosity=2)
