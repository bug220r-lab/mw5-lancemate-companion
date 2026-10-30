"""Independent MOCK_ONLY tests for the post-reload evidence/inspection contract.

All assets, objects, process identities, log bytes and images are synthetic in
temporary directories. This file neither imports Unreal nor invokes an editor.
"""
import copy
import datetime
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parent.parent


def module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


helper = module('postreload_under_test', ROOT / 'scripts/Inspect-DiagnosticPostReload.py')
evidence = module('postreload_evidence_under_test', ROOT / 'scripts/DiagnosticPostReloadEvidence.py')
fixtures = module('postreload_object_fixtures', ROOT / 'scripts/Test-DiagnosticTemplates.py')
HEALTH = dict(fixtures.HEALTH)


class Fixture(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='mw5-postreload-MOCK_ONLY-')
        self.root = Path(self.temp.name).resolve()
        self.addCleanup(self.cleanup)
        self.base, self.phase = helper.load_base(), helper.load_phase()
        self.attempt = self.root / 'research/evidence/diagnostic-post-reload-20260927T000000Z-1234abcd'
        self.attempt.mkdir(parents=True)
        self.shared = self.attempt.parent / 'editor-source'
        self.shared.mkdir()
        self.roots = [self.root / 'mods' / name for name in self.phase.MOD_NAMES]
        for root in self.roots:
            root.mkdir(parents=True)
            (root / 'mod.json').write_bytes(b'{"MOCK_ONLY":true}')
        (self.roots[1] / 'ActiveMod.txt').write_bytes(b'')
        self.source = self.root / 'protected.bin'
        self.source.write_bytes(b'MOCK_ONLY protected input')
        self.manifest = dict(helper.plan(self.base), attempt_id=self.attempt.name,
            protected_files=[self.pin(self.source)],
            selection=self.phase.expected_selection(self.roots, 'diagnostic'),
            mod_inventory=self.phase.snapshot_mod_roots(self.roots))
        target = self.manifest['root_asset']
        outer = fixtures.Obj(target['outer_path'], '/Script/CoreUObject.Package')
        self.root_object = fixtures.Obj(target['object_path'], target['class_path'], outer)
        self.loaded = {target['object_path']: self.root_object}
        self.objects = {}
        for target in self.manifest['targets']:
            package = fixtures.Obj(target['outer_path'].split('.')[0], '/Script/CoreUObject.Package')
            outer = fixtures.Obj(target['outer_path'], '/Script/Engine.BlueprintGeneratedClass', package)
            self.objects[target['object_path']] = fixtures.Obj(target['object_path'], target['class_path'], outer)
        self.root_finds, self.finds, self.exports, self.forbidden = [], [], [], []
        self.find_effect = self.export_effect = None
        self.raw_override = None

        def find_asset(path, follow_redirectors):
            self.assertFalse(follow_redirectors)
            self.root_finds.append(path)
            if self.find_effect:
                self.find_effect('root', path)
            return self.loaded.get(path)

        def find_object(outer, path, follow_redirectors):
            self.assertIsNone(outer)
            self.assertFalse(follow_redirectors)
            self.finds.append(path)
            if self.find_effect:
                self.find_effect('object', path)
            return self.objects.get(path)

        def forbidden(*args, **kwargs):
            self.forbidden.append((args, kwargs))
            raise AssertionError('FORBIDDEN_EXPLICIT_LOAD_RELOAD_SAVE_COMPILE')

        def export(task):
            values = task.values
            self.assertEqual(set(values), {'object', 'exporter', 'filename', 'automated', 'prompt',
                'replace_identical', 'selected', 'use_file_archive', 'write_empty_files'})
            self.assertTrue(values['automated'])
            for key in ('prompt', 'replace_identical', 'selected', 'use_file_archive', 'write_empty_files'):
                self.assertIs(values[key], False)
            obj = values['object']
            destination = Path(values['filename'])
            self.assertEqual(destination.parent, self.attempt / 'diagnostic')
            self.assertFalse(destination.exists())
            self.exports.append(obj.path)
            raw = self.raw_override if self.raw_override is not None else (
                'Begin Object Class=%s Name="%s"\n ExplicitNull=None\n'
                ' Unresolved=Object\'/Game/Unknown.Unknown\'\nEnd Object\n'
                % (obj.kind, obj.path.rsplit(':', 1)[-1])).encode()
            destination.write_bytes(raw)
            return self.export_effect(task, destination) if self.export_effect else True

        self.api = SimpleNamespace(find_asset=find_asset, find_object=find_object,
            load_asset=forbidden, reload_package=forbidden, save_asset=forbidden,
            compile_blueprint=forbidden, AssetExportTask=fixtures.Task,
            ObjectExporterT3D=lambda: SimpleNamespace(get_editor_property=lambda key:
                {'text': True, 'format_extension': ['COPY', 'T3D']}[key]),
            Exporter=SimpleNamespace(run_asset_export_task=export))

    def cleanup(self):
        self.assertEqual(self.root.parent, Path(tempfile.gettempdir()).resolve())
        self.assertTrue(self.root.name.startswith('mw5-postreload-MOCK_ONLY-'))
        self.temp.cleanup()

    def pin(self, path):
        raw = Path(path).read_bytes()
        return {'path': str(path), 'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()}

    def write_json(self, path, value):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(value, indent=2) + '\n', encoding='utf-8')
        return self.pin(path)

    def run_inspection(self, **kwargs):
        result = helper.execute(self.base, self.phase, self.api, self.manifest, self.attempt, self.roots,
            kwargs.pop('health_query', lambda _: dict(HEALTH)), kwargs.pop('clock', lambda: 0), False, **kwargs)
        self.assertEqual(result['classification'], 'MOCK_ONLY')
        self.assertEqual(result['native_inspection'], 'NOT_PERFORMED')
        self.assertFalse(self.forbidden)
        self.assertLessEqual(len(self.root_finds), 2)
        self.assertLessEqual(len(self.finds), 5)
        self.assertLessEqual(len(self.exports), 5)
        self.assertFalse(hasattr(self.api, self.base.ACTIVE_KEY))
        self.assertFalse(list(self.shared.glob('*.lock')))
        return result

    def stopped(self, result, text=None):
        self.assertTrue(result['status'].startswith('STOPPED'), result)
        if text:
            self.assertIn(text, str(result.get('errors', [])))


class InspectionChecks(Fixture):
    def test_exact_five_already_loaded_exports_and_unknown_reference_health(self):
        result = self.run_inspection()
        self.assertEqual(result['status'], 'COLLECTED_REQUIRES_REVIEW')
        paths = [target['object_path'] for target in self.manifest['targets']]
        self.assertEqual(self.root_finds, [self.manifest['root_asset']['object_path']] * 2)
        self.assertEqual(self.finds, paths)
        self.assertEqual(self.exports, paths)
        self.assertEqual(result['root']['load_calls'], 0)
        self.assertEqual(result['mount_registry_state'], 'UNKNOWN_NOT_QUERIED')
        index = json.loads(Path(result['queries'][0]['inventory']['path']).read_text())
        self.assertEqual(index['reference_interpretation'], 'LEXICAL_ONLY_NOT_RESOLVED_REFERENCES')
        self.assertTrue(any(row['status'] == 'UNKNOWN_NOT_QUERIED' for row in index['fixed_inventory_references']))

    def test_missing_root_never_loads_or_retries(self):
        self.loaded.clear()
        self.stopped(self.run_inspection(), 'EXACT_ROOT_UNAVAILABLE_UNKNOWN')
        self.assertEqual(len(self.root_finds), 1)
        self.assertEqual(self.finds + self.exports + self.forbidden, [])

    def test_stock_alias_root_stops_before_subobject_queries(self):
        self.root_object.path = self.phase.plan(self.base, 'stock')['root_asset']['object_path']
        self.stopped(self.run_inspection(), 'EXACT_OBJECT_CLASS_OUTER_MISMATCH')
        self.assertEqual(self.finds + self.exports, [])

    def test_wrong_root_class_or_outer_stops(self):
        self.root_object.kind = '/Script/Engine.Actor'
        self.stopped(self.run_inspection(), 'EXACT_OBJECT_CLASS_OUTER_MISMATCH')
        self.assertEqual(self.finds + self.exports, [])

    def test_wrong_root_immediate_outer_stops(self):
        self.root_object.outer.path += '_wrong'
        self.stopped(self.run_inspection(), 'EXACT_OBJECT_CLASS_OUTER_MISMATCH')
        self.assertEqual(self.finds + self.exports, [])

    def test_replaced_root_stops_before_subobjects(self):
        def change(kind, path):
            if kind == 'root' and len(self.root_finds) == 2:
                obj = self.loaded[path]
                self.loaded[path] = fixtures.Obj(obj.path, obj.kind, obj.outer)
        self.find_effect = change
        self.stopped(self.run_inspection(), 'ROOT_REFERENCE_CHANGED_UNKNOWN')
        self.assertEqual(self.finds + self.exports, [])

    def test_missing_final_template_prevents_all_exports(self):
        del self.objects[self.manifest['targets'][-1]['object_path']]
        self.stopped(self.run_inspection(), 'TEMPLATE_MISSING_UNKNOWN')
        self.assertEqual(len(self.finds), 5)
        self.assertEqual(self.exports, [])

    def test_wrong_template_class_prevents_all_exports(self):
        self.objects[self.manifest['targets'][0]['object_path']].kind = '/Script/Engine.Actor'
        self.stopped(self.run_inspection(), 'EXACT_OBJECT_CLASS_OUTER_MISMATCH')
        self.assertFalse(self.exports)

    def test_wrong_template_outer_prevents_all_exports(self):
        self.objects[self.manifest['targets'][0]['object_path']].outer.path += '_wrong'
        self.stopped(self.run_inspection(), 'EXACT_OBJECT_CLASS_OUTER_MISMATCH')
        self.assertFalse(self.exports)

    def test_retained_identity_changes_during_next_find(self):
        first = self.objects[self.manifest['targets'][0]['object_path']]
        def change(kind, path):
            if kind == 'object' and len(self.finds) == 2:
                first.path += '_changed'
        self.find_effect = change
        self.stopped(self.run_inspection(), 'EXACT_OBJECT_CLASS_OUTER_MISMATCH')
        self.assertFalse(self.exports)

    def test_protected_drift_stops_without_repair(self):
        self.find_effect = lambda *_: self.source.write_bytes(b'MOCK_CHANGED')
        result = self.run_inspection()
        self.stopped(result, 'PROTECTED_INPUT_CHANGED')
        self.assertEqual(self.source.read_bytes(), b'MOCK_CHANGED')
        self.assertEqual(self.finds + self.exports, [])

    def test_selection_drift_stops_without_restoration(self):
        self.find_effect = lambda *_: (self.roots[0] / 'ActiveMod.txt').write_bytes(b'')
        self.stopped(self.run_inspection(), 'SELECTION_CHANGED')
        self.assertTrue((self.roots[0] / 'ActiveMod.txt').exists())
        self.assertTrue((self.roots[1] / 'ActiveMod.txt').exists())

    def test_new_inventory_file_before_first_query_rejected(self):
        (self.roots[0] / 'unexpected.bin').write_bytes(b'MOCK_ONLY')
        self.stopped(self.run_inspection(), 'MOD_BASELINE_CHANGED')
        self.assertFalse(self.root_finds)

    def test_new_inventory_file_after_export_prevents_acceptance(self):
        def change(*_):
            (self.roots[0] / 'unexpected.bin').write_bytes(b'MOCK_ONLY')
            return True
        self.export_effect = change
        result = self.run_inspection()
        self.stopped(result)
        self.assertIsNot(result['mod_inventory_unchanged'], True)

    def test_guard_drift_prevents_more_exports(self):
        def guard():
            if self.exports:
                raise ValueError('MOCK_PREDECESSOR_CHANGED')
        self.stopped(self.run_inspection(guard=guard), 'MOCK_PREDECESSOR_CHANGED')
        self.assertEqual(len(self.exports), 1)

    def test_user_stop_before_query(self):
        (self.attempt / 'STOP').write_bytes(b'MOCK_ONLY')
        self.stopped(self.run_inspection(), 'USER_STOP')
        self.assertFalse(self.root_finds)

    def test_disk_limit_before_query(self):
        self.stopped(self.run_inspection(health_query=lambda _: dict(HEALTH, disk_free=0)), 'DISK_RESOURCE_STOP')
        self.assertFalse(self.root_finds)

    def test_cooperative_ninety_second_limit(self):
        self.stopped(self.run_inspection(clock=lambda: 91 if self.root_finds else 0), 'COOPERATIVE_TIME_STOP')
        self.assertFalse(self.finds)

    def test_failed_export_preserves_raw_and_no_retry(self):
        self.export_effect = lambda *_: False
        self.stopped(self.run_inspection(), 'EXPORT_FAILED_OR_ERRORS')
        self.assertEqual(len(self.exports), 1)
        self.assertEqual(len(list((self.attempt / 'diagnostic').glob('*.COPY'))), 1)

    def test_export_error_list_is_failure(self):
        def fail(task, _):
            task.errors = ['MOCK_ONLY exporter error']
            return True
        self.export_effect = fail
        self.stopped(self.run_inspection(), 'EXPORT_FAILED_OR_ERRORS')
        self.assertEqual(len(self.exports), 1)

    def test_export_byte_bound(self):
        self.raw_override = b'x' * (1024 * 1024 + 1)
        self.stopped(self.run_inspection(), 'FILE_SIZE_LIMIT')
        self.assertEqual(len(self.exports), 1)

    def test_wrong_export_identity_rejected(self):
        self.raw_override = b'Begin Object Class=/Script/Engine.Actor Name="Wrong"\nEnd Object\n'
        self.stopped(self.run_inspection(), 'EXPORT_ROOT_IDENTITY_MISMATCH')

    def test_text_exporter_required(self):
        self.api.ObjectExporterT3D = lambda: SimpleNamespace(get_editor_property=lambda key:
            {'text': False, 'format_extension': ['bin']}[key])
        self.stopped(self.run_inspection(), 'TEXT_EXPORTER_UNAVAILABLE')
        self.assertFalse(self.exports)

    def test_scope_cannot_enable_explicit_load(self):
        self.manifest['allow_exact_root_load'] = True
        with self.assertRaises(ValueError):
            self.run_inspection()
        self.assertFalse(self.root_finds + self.finds + self.forbidden)

    def test_scope_cannot_substitute_stock_target(self):
        self.manifest['targets'][0] = self.phase.plan(self.base, 'stock')['targets'][0]
        with self.assertRaises(ValueError):
            self.run_inspection()
        self.assertFalse(self.root_finds)

    def test_mock_entry_forbids_real_unreal_api(self):
        self.api.__name__ = 'unreal'
        with self.assertRaisesRegex(ValueError, 'REAL_API_FORBIDDEN_IN_MOCK'):
            self.run_inspection()
        self.assertFalse(self.root_finds)

    def test_existing_output_preserved(self):
        output = self.attempt / 'diagnostic'
        output.mkdir()
        (output / 'owner.txt').write_bytes(b'EXISTING_OTHER_OWNER')
        self.stopped(self.run_inspection())
        self.assertEqual({p.name: p.read_bytes() for p in output.iterdir()}, {'owner.txt': b'EXISTING_OTHER_OWNER'})

    def test_mock_dispatch_claim_survives_and_prevents_replay(self):
        self.run_inspection()
        claim = self.attempt / 'diagnostic-mock-dispatch-claim.json'
        before = claim.read_bytes()
        counts = (len(self.root_finds), len(self.finds), len(self.exports))
        with self.assertRaisesRegex(ValueError, 'DISPATCH_ALREADY_CLAIMED'):
            self.run_inspection()
        self.assertEqual(claim.read_bytes(), before)
        self.assertEqual(counts, (len(self.root_finds), len(self.finds), len(self.exports)))

    def test_direct_native_core_cannot_bypass_admission(self):
        self.api.__name__ = 'unreal'
        with self.assertRaises((ValueError, RuntimeError)):
            helper.execute(self.base, self.phase, self.api, self.manifest, self.attempt,
                self.roots, lambda _: HEALTH, lambda: 0, True)
        self.assertFalse(self.root_finds + self.finds + self.exports)
        self.assertFalse((self.attempt / 'diagnostic-native-dispatch-claim.json').exists())

    def test_inspection_clock_discontinuity_rejected(self):
        ticks = iter([10, 10, 9])
        self.stopped(self.run_inspection(clock=lambda: next(ticks, 9)), 'MONOTONIC_CLOCK_DISCONTINUITY')
        self.assertFalse(self.root_finds)

    def test_nan_disk_capacity_is_not_available_capacity(self):
        self.stopped(self.run_inspection(health_query=lambda _: dict(HEALTH, disk_free=float('nan'))), 'DISK_RESOURCE_STOP')
        self.assertFalse(self.root_finds)

    def test_nonfinite_clock_is_rejected(self):
        ticks = iter([0, 0, float('nan')])
        self.stopped(self.run_inspection(clock=lambda: next(ticks, float('nan'))), 'MONOTONIC_CLOCK_DISCONTINUITY')
        self.assertFalse(self.root_finds)

    def test_preexisting_lock_preserved(self):
        lock = self.shared / '.diagnostic-template-inspection.lock'
        lock.write_bytes(b'MOCK_ONLY other owner')
        with self.assertRaisesRegex(RuntimeError, 'OTHER_INSPECTION_ACTIVE'):
            self.run_inspection()
        self.assertEqual(lock.read_bytes(), b'MOCK_ONLY other owner')
        self.assertFalse(self.root_finds)
        self.assertFalse((self.attempt / 'diagnostic-mock-dispatch-claim.json').exists())

    def test_existing_collector_token_preserved(self):
        key = self.base.OTHER_ACTIVE_KEYS[0]
        setattr(self.api, key, 'MOCK_ONLY other owner')
        with self.assertRaisesRegex(RuntimeError, 'OTHER_INSPECTION_ACTIVE'):
            self.run_inspection()
        self.assertEqual(getattr(self.api, key), 'MOCK_ONLY other owner')
        self.assertFalse(self.root_finds)


class AdmissionChecks(Fixture):
    def setUp(self):
        super().setUp()
        self.identity = {'pid': 12345, 'creation_filetime': '134000000000000000',
                         'executable': str(self.root / 'Editor/Engine/Binaries/Win64/UE4Editor.exe')}
        self.base.EDITOR_EXE = Path(self.identity['executable'])
        self.base.EXPECTED_ROOT = self.root
        self.base.EDITOR_EXE.parent.mkdir(parents=True)
        self.base.EDITOR_EXE.write_bytes(b'MOCK_ONLY executable is never run')
        self.now = datetime.datetime.now(datetime.timezone.utc)
        self.addCleanup(patch.stopall)
        patch.object(self.phase, 'mod_roots', lambda _: self.roots).start()
        self.manifest['protected_files'] = []
        for index in range(27):
            path = self.root / ('protected-%02d.bin' % index)
            path.write_bytes(('MOCK_ONLY protected %d' % index).encode())
            self.manifest['protected_files'].append(self.pin(path))
        self.protected = copy.deepcopy(self.manifest['protected_files'])
        patch.object(self.base, 'fixed_protected_inputs', lambda: copy.deepcopy(self.protected)).start()
        (self.roots[1] / 'ActiveMod.txt').unlink()
        (self.roots[0] / 'ActiveMod.txt').write_bytes(b'')
        original = self.phase.snapshot_mod_roots(self.roots)
        (self.roots[0] / 'ActiveMod.txt').unlink()
        (self.roots[1] / 'ActiveMod.txt').write_bytes(b'')
        self.manifest.update(schema_version=1, status='REVIEWED_NATIVE_READY', editor_identity=self.identity,
            engine_version=evidence.ENGINE_VERSION,
            dispatcher={'path': str(self.attempt / 'dispatch-diagnostic.py'), 'format_version': 1},
            reviewed_at_utc=self.now.isoformat(), native_owner_confirmed=True,
            native_owner='MOCK_ONLY owner', owner_evidence='MOCK_ONLY owner evidence',
            authorization_evidence='MOCK_ONLY authorization', base_helper_sha256=helper.BASE_SHA,
            phase_helper_sha256=helper.PHASE_SHA, helper_sha256=self.pin(Path(helper.__file__))['sha256'],
            evidence_helper_sha256=self.pin(Path(evidence.__file__))['sha256'], original_mod_inventory=original)

    def validate(self, candidate=None, identity=None, now=None):
        return helper.validate(self.base, self.phase, candidate or self.manifest,
                               identity or self.identity, now or self.now)

    def test_reviewed_synthetic_manifest_structure_passes_without_native_calls(self):
        self.validate()
        self.assertFalse(self.root_finds + self.finds + self.exports)

    def test_missing_or_changed_review_scope_and_helper_pins_rejected(self):
        for key, value in (('status', 'DORMANT'), ('protocol', 'PRE_RELOAD_PROTOCOL'),
                ('phase', 'stock'), ('allow_load', True), ('allow_exact_root_load', True),
                ('native_owner_confirmed', False), ('native_owner', ''), ('owner_evidence', ''),
                ('authorization_evidence', ''), ('attempt_id', '../old-attempt'),
                ('base_helper_sha256', '0' * 64), ('phase_helper_sha256', '0' * 64),
                ('helper_sha256', 'unreviewed'), ('evidence_helper_sha256', None), ('limits', {})):
            with self.subTest(key=key):
                candidate = copy.deepcopy(self.manifest)
                candidate[key] = value
                with self.assertRaises((ValueError, KeyError, TypeError)):
                    self.validate(candidate)

    def test_stale_and_future_reviews_rejected(self):
        for seconds in (-601, 1):
            candidate = copy.deepcopy(self.manifest)
            candidate['reviewed_at_utc'] = (self.now + datetime.timedelta(seconds=seconds)).isoformat()
            with self.subTest(seconds=seconds), self.assertRaisesRegex(ValueError, 'FRESH_OWNER'):
                self.validate(candidate)

    def test_wrong_pid_creation_or_executable_rejected(self):
        for key, value in (('pid', 54321), ('creation_filetime', '134000000000000001'),
                ('executable', str(self.root / 'different.exe'))):
            identity = dict(self.identity, **{key: value})
            with self.subTest(key=key), self.assertRaisesRegex(ValueError, 'IDENTITY'):
                self.validate(identity=identity)

    def test_missing_or_altered_protected_scope_rejected(self):
        for change in ('missing', 'changed', 'duplicate'):
            candidate = copy.deepcopy(self.manifest)
            if change == 'missing':
                candidate['protected_files'].pop()
            elif change == 'changed':
                candidate['protected_files'][0]['sha256'] = '0' * 64
            else:
                candidate['protected_files'][0] = candidate['protected_files'][1]
            with self.subTest(change=change), self.assertRaisesRegex(ValueError, '27_PROTECTED'):
                self.validate(candidate)

    def test_selection_requires_exact_diagnostic_marker_state(self):
        candidate = copy.deepcopy(self.manifest)
        candidate['selection'] = self.phase.expected_selection(self.roots, 'stock')
        with self.assertRaisesRegex(ValueError, 'DIAGNOSTIC_SELECTION'):
            self.validate(candidate)

    def test_duplicate_inventory_path_is_rejected(self):
        candidate = copy.deepcopy(self.manifest)
        candidate['mod_inventory'][0]['files'].append(copy.deepcopy(candidate['mod_inventory'][0]['files'][0]))
        with self.assertRaises(ValueError):
            self.validate(candidate)


class EvidenceFixture(AdmissionChecks):
    """Complete synthetic historical/transition evidence; never a real manifest."""
    def setUp(self):
        super().setUp()
        patch.object(evidence, 'ROOT', self.root).start()
        self.manifest['engine_version'] = evidence.ENGINE_VERSION
        self.clock_domain = 'MOCK_ONLY same process monotonic clock'
        self.utc_origin = self.now - datetime.timedelta(seconds=1100)
        self.common = {'editor_identity': self.identity, 'engine_version': evidence.ENGINE_VERSION,
                       'attempt_id': self.attempt.name}
        self.source_log = self.root / 'MOCK_ONLY_editor.log'
        self.source_log.write_bytes(b'MOCK_ONLY historical prefix\n')
        build_path = self.base.EDITOR_EXE.parents[2] / 'Build/Build.version'
        self.build = {'MajorVersion': 4, 'MinorVersion': 26, 'PatchVersion': 2, 'CompatibleChangelist': 14830424}
        self.build_pin = self.write_json(build_path, self.build)
        self.manifest.update(editor_build=self.build_pin, editor_version=self.build,
                             editor_executable=self.pin(self.base.EDITOR_EXE))
        self.make_predecessor()
        self.make_transition('selection')

    def source_point(self):
        stat = self.source_log.stat()
        return {'source_log_path': str(self.source_log), 'stat_identity': [stat.st_dev, stat.st_ino],
                'prefix_bytes': stat.st_size, 'prefix_sha256': self.pin(self.source_log)['sha256']}

    def stamp(self, value):
        value += getattr(self, 'clock_offset', 0)
        return {'utc': (self.utc_origin + datetime.timedelta(seconds=value)).isoformat(),
                'monotonic': value, 'clock_domain': self.clock_domain}

    def timing(self, *values):
        return dict(zip(('submitted', 'started', 'completed', 'returned'), [self.stamp(v) for v in values]))

    def state(self, which):
        descriptors = []
        for group in self.manifest['original_mod_inventory']:
            record = next(row for row in group['files'] if row['path'] == 'mod.json')
            descriptors.append(dict(record, path=str(Path(group['root']) / 'mod.json')))
        return dict(self.common, selection=self.phase.expected_selection(self.roots, which),
            protected_files=copy.deepcopy(self.manifest['protected_files']), descriptors=descriptors,
            mod_inventory=copy.deepcopy(self.manifest['original_mod_inventory'] if which == 'stock'
                                        else self.manifest['mod_inventory']))

    def make_predecessor(self):
        prior_attempt = self.attempt.parent / 'diagnostic-template-selection-20260926T000000Z-abcd1234'
        prior_attempt.mkdir()
        prior = {'attempt_id': prior_attempt.name}
        scripts = self.root / 'scripts'
        scripts.mkdir()
        for key, name in (('helper', 'Inspect-DiagnosticTemplatePhase.py'), ('base_helper', 'Inspect-DiagnosticTemplates.py')):
            target = scripts / name
            target.write_bytes((ROOT / 'scripts' / name).read_bytes())
            prior[key] = self.pin(target)
        entry = prior_attempt / 'run-stock.py'
        entry.write_bytes(b'# MOCK_ONLY inert entry; never execute\n')
        prior['entry'] = self.pin(entry)
        stock_plan = self.phase.plan(self.base, 'stock')
        saved = dict(stock_plan, attempt_id=prior_attempt.name, editor_identity=self.identity,
            protected_files=copy.deepcopy(self.protected), helper_sha256=prior['helper']['sha256'],
            base_helper_sha256=prior['base_helper']['sha256'], entry_file=prior['entry'],
            selection=self.phase.expected_selection(self.roots, 'stock'),
            mod_inventory=copy.deepcopy(self.manifest['original_mod_inventory']))
        prior['manifest'] = self.write_json(prior_attempt / 'stock-manifest.json', saved)
        report = {'manifest': saved, 'attempt_id': prior_attempt.name, 'editor_identity': self.identity,
            'classification': 'EDITOR_SOURCE_REQUIRES_REVIEW', 'native_inspection': 'PERFORMED',
            'phase': 'stock', 'status': 'COLLECTED_REQUIRES_REVIEW', 'errors': [], 'root_finds': 2,
            'protected_unchanged': True, 'selection_unchanged': True, 'mod_inventory_unchanged': True,
            'explicit_asset_edit_save_compile_reload_selection_restart_cook_retail': 'NOT_PERFORMED',
            'mod_inventory_before': saved['mod_inventory'], 'mod_inventory_after': saved['mod_inventory'],
            'mod_inventory_changes': {'added': [], 'removed': [], 'changed': []}}
        def observed(target):
            return {'target': target, 'status': 'EXACT_IDENTITY_OBSERVED',
                    'observed_path': target['object_path'], 'observed_class': target['class_path'],
                    'outer_chain': [target['object_path'], target['outer_path']]}
        report['root'] = dict(observed(stock_plan['root_asset']), load_calls=0)
        report['queries'], prior['files'] = [], []
        output = prior_attempt / 'stock'
        output.mkdir()
        final, _ = self.base.utilities()
        for target in stock_plan['targets']:
            path = output / (target['label'] + '.COPY')
            raw = ('Begin Object Class=%s Name="%s"\n ExplicitNull=None\nEnd Object\n'
                   % (target['class_path'], target['name'])).encode()
            path.write_bytes(raw)
            index = final.inventory(raw, target['name'], target['class_path'])
            index.update(reference_interpretation='LEXICAL_ONLY_NOT_RESOLVED_REFERENCES',
                fixed_inventory_references=[{'path': row['text'], 'status': 'UNKNOWN_NOT_QUERIED'}
                                            for row in index['path_candidates']])
            pair = {'export': self.pin(path), 'inventory': self.write_json(output / (target['label'] + '-inventory.json'), index)}
            prior['files'].append(pair)
            report['queries'].append(dict(observed(target), export_status='EXPORTED_REQUIRES_REVIEW',
                                          exporter_errors=[], **pair))
        report['exported_bytes'] = sum(pair['export']['bytes'] for pair in prior['files'])
        report['inventory_bytes'] = sum(pair['inventory']['bytes'] for pair in prior['files'])
        prior['report'] = self.write_json(output / 'report.json', report)
        point = self.source_point()
        baseline = {'editor_identity': self.identity, 'editor_build': self.build, 'editor_build_pin': self.build_pin,
                    'log_before': dict(path=point['source_log_path'], stat_identity=point['stat_identity'],
                                       bytes=point['prefix_bytes'], sha256=point['prefix_sha256'])}
        prior['baseline'] = self.write_json(prior_attempt / 'baseline.json', baseline)
        cursor = point['prefix_bytes']
        def span(role):
            nonlocal cursor
            raw = ('MOCK_ONLY historical %s\n' % role).encode()
            path = prior_attempt / (role + '-log-span.txt')
            path.write_bytes(raw)
            with self.source_log.open('ab') as stream:
                stream.write(raw)
            value = {'source_log_path': str(self.source_log), 'start_byte': cursor,
                     'end_byte': cursor + len(raw), 'file': self.pin(path)}
            cursor += len(raw)
            return value
        stock_span = span('stock')
        after = {'report': prior['report'], 'log_span': stock_span, 'log_prefix_unchanged': True,
            'log_identity_unchanged': True, 'protected_matching': 27, 'selection_matches': True,
            'mod_inventory_matches': True, 'mod_inventory': saved['mod_inventory'], 'selection': saved['selection'],
            'protected': [dict(pin, matches=True) for pin in self.protected]}
        prior['post_verification'] = self.write_json(prior_attempt / 'stock-after-verification.json', after)
        review = {'status': 'PASS_STOCK_SOURCE_AND_LOG_REVIEW', 'editor_identity': self.identity,
            'stock_report_sha256': prior['report']['sha256'], 'source_review_passed': True, 'log_review_passed': True,
            'reviewer': 'MOCK_ONLY independent reviewer', 'stock_manifest': prior['manifest'],
            'post_verification': prior['post_verification'], 'reviewed_at_utc': self.now.isoformat(),
            'stock_log_span': stock_span}
        prior['review'] = self.write_json(prior_attempt / 'stock-independent-review.json', review)
        prior['intervening'] = []
        for role, filename in (('selection', 'selection-observation.json'), ('restoration', 'restoration-verification.json')):
            transition = {'editor_identity': self.identity, 'log_identity_unchanged': True,
                          'log_prefix_unchanged': True, 'log_span': span(role)}
            prior['intervening'].append({'role': role, 'receipt': self.write_json(prior_attempt / filename, transition)})
        empty = self.attempt / 'historical-continuity.txt'
        empty.write_bytes(b'')
        final_point = self.source_point()
        prefix_path = self.attempt / 'historical-prefix.txt'
        prefix_path.write_bytes(self.source_log.read_bytes())
        continuity = dict(self.common, status='REVIEWED_HISTORICAL_TO_NEW_BASELINE',
            reviewer='MOCK_ONLY reviewer', historical_report_sha256=prior['report']['sha256'],
            historical_baseline_sha256=prior['baseline']['sha256'], intervening=prior['intervening'], source_log_origin=point,
            spans=[{'source_log_path': str(self.source_log), 'stat_identity': final_point['stat_identity'],
                    'start_byte': cursor, 'end_byte': cursor, 'file': self.pin(empty), 'lines': [],
                    'truncated': False, 'rotated': False}], baseline_log=final_point,
            prefix_file=self.pin(prefix_path), historical_selection_memory_equivalence='UNKNOWN')
        prior['continuity'] = self.write_json(self.attempt / 'historical-continuity.json', continuity)
        self.manifest['predecessor'] = prior

    def ui(self, label, mod, at):
        path = self.attempt / (label + '-MOCK_ONLY.png')
        path.write_bytes(('MOCK_ONLY capture ' + label).encode())
        capture = self.pin(path)
        receipt = dict(self.common, capture=capture, active_mod=mod, responsive=True,
            main_window_foreground=True, exclusive_owner=True, modal_visible=False,
            human_intervention=False, pending_tool_work=False, observed_at=self.stamp(at),
            reviewer='MOCK_ONLY reviewer', interpretation='MOCK_ONLY synthetic unobstructed UI')
        return {'capture': capture, 'receipt': self.write_json(self.attempt / (label + '-ui.json'), receipt)}

    def make_transition(self, transition):
        self.clock_offset = 100 if transition == 'restoration' else 0
        before_mod, after_mod = (('LanceObserverProbe', 'LanceObserverDiagnosticControl') if transition == 'selection'
                                else ('LanceObserverDiagnosticControl', 'LanceObserverProbe'))
        point = self.source_point()
        prefix_path = self.attempt / (transition + '-prefix.txt')
        prefix_path.write_bytes(self.source_log.read_bytes())
        before = dict(self.common, transition=transition, clock_source='time.monotonic',
            clock_domain=self.clock_domain, clock_domain_verified=True, start=self.stamp(1000),
            durable_written_at=self.stamp(1000.1), ui=self.ui(transition + '-before', before_mod, 999),
            log=point, log_prefix_file=self.pin(prefix_path), intervening_lines=[],
            state=self.state('stock' if transition == 'selection' else 'diagnostic'))
        if transition == 'restoration':
            eligibility = dict(self.common, status='REVIEWED_SAFE_RESTORATION',
                selection_receipt=self.manifest['selection_receipt'], ui=before['ui'], state=before['state'],
                log=before['log'], unsafe_conditions_observed=[], reviewer='MOCK_ONLY independent reviewer',
                reason='MOCK_ONLY comparison stopped before dispatch; safe recorded state',
                reviewed_at_utc=self.stamp(999.5)['utc'], outcome='NOT_PERFORMED_COMPARISON_ONLY_STOP',
                diagnostic_report=None, diagnostic_manifest=None)
            before['eligibility_review'] = self.write_json(self.attempt / 'restoration-eligibility-review.json', eligibility)
        before_pin = self.write_json(self.attempt / (transition + '-before.json'), before)
        action = dict(self.common, transition=transition, pre_click_sha256=before_pin['sha256'],
            selection_clicks=1, result='COMPLETED', timing=self.timing(1000.2, 1001, 1004, 1005),
            observation_call_count=2, uncounted_observation_calls=0, explicit_loads=0, explicit_reloads=0,
            asset_edits=0, saves=0, compiles=0, dialog_dismissals=0, restarts=0)
        action_pin = self.write_json(self.attempt / (transition + '-action.json'), action)
        package = evidence.DIAGNOSTIC_PACKAGE if transition == 'selection' else evidence.STOCK_PACKAGE
        directory = '../../../MW5Mercs/Plugins/' + before_mod
        def log_prefix(at):
            return '[' + datetime.datetime.fromisoformat(self.stamp(at)['utc']).strftime('%Y.%m.%d-%H.%M.%S:%f')[:-3] + '][  1]'
        items = [(log_prefix(1002) + 'LogDirectoryWatcher: A directory notification for \'%s\' was aborted.' % directory,
                  'LogDirectoryWatcher', 'deselected_mod_directory_notice', directory),
                 (log_prefix(1003) + 'LogUObjectGlobals: Reloading 1 Package(s):',
                  'LogUObjectGlobals', 'implicit_selection_reload', package),
                 ('    Asset Name: ' + package, 'LogUObjectGlobals', 'implicit_selection_reload_package', package),
                 (log_prefix(1004) + 'LogUObjectHash: Compacting FUObjectHashTables data took   1.25ms',
                  'LogUObjectHash', 'object_hash_compaction', '')]
        raw = ''.join(item[0] + '\n' for item in items).encode()
        path = self.attempt / (transition + '-log.txt')
        path.write_bytes(raw)
        with self.source_log.open('ab') as stream:
            stream.write(raw)
        span = dict(source_log_path=str(self.source_log), stat_identity=point['stat_identity'],
            start_byte=point['prefix_bytes'], end_byte=point['prefix_bytes'] + len(raw),
            source_prefix_sha256=point['prefix_sha256'], file=self.pin(path), truncated=False, rotated=False)
        rows, offset = [], span['start_byte']
        for text, channel, operation, item_path in items:
            end = offset + len((text + '\n').encode())
            rows.append(dict(start_byte=offset, end_byte=end, text=text, channel=channel, operation=operation,
                             path=item_path, interpretation='MOCK_ONLY expected', reviewer='MOCK_ONLY reviewer',
                             disposition='REVIEWED_EXPECTED'))
            offset = end
        polls = []
        for n, first in ((1, 1006), (2, 1012)):
            poll = dict(self.common, poll_id=n, kind='explicit', result='OBSERVED',
                unsafe_conditions_observed=[],
                timing=self.timing(first, first + 1, first + 4, first + 5), elapsed_seconds=first + 5 - 1000,
                ui=self.ui(transition + '-poll-' + str(n), after_mod, first + 3),
                log=dict(span, read_started=self.stamp(first + 2), read_completed=self.stamp(first + 3)))
            polls.append(self.write_json(self.attempt / (transition + '-poll-' + str(n) + '.json'), poll))
        state = dict(self.state('diagnostic' if transition == 'selection' else 'stock'),
            observed_at=self.stamp(1016), ui=poll['ui'], inventory_complete=True,
            inventory_differences={'added': [], 'removed': [], 'changed': []})
        receipt = dict(self.common, schema_version=1, protocol=evidence.PROTOCOL, transition=transition,
            status='REVIEWED_TRANSITION_OBSERVATIONS', reviewer='MOCK_ONLY independent reviewer',
            reviewed_at_utc=self.stamp(1020)['utc'], pre_click=before_pin, action=action_pin, polls=polls,
            final_state=self.write_json(self.attempt / (transition + '-state.json'), state),
            log_review=self.write_json(self.attempt / (transition + '-log-review.json'),
                {'source': point, 'file': span['file'], 'end_byte': span['end_byte'], 'lines': rows}),
            final_log=self.source_point(), live_reference_health='UNKNOWN', in_memory_rollback='UNKNOWN')
        self.manifest[transition + '_receipt'] = self.write_json(self.attempt / (transition + '-review.json'), receipt)

    def update_transition(self, part, change, transition='selection', poll_number=None):
        review_pin = self.manifest[transition + '_receipt']
        review = json.loads(Path(review_pin['path']).read_text())
        if part == 'review':
            change(review)
        else:
            pin = review['polls'][poll_number - 1] if part == 'poll' else review[part]
            document = json.loads(Path(pin['path']).read_text())
            change(document)
            updated = self.write_json(Path(pin['path']), document)
            if part == 'poll':
                review['polls'][poll_number - 1] = updated
            else:
                review[part] = updated
        self.manifest[transition + '_receipt'] = self.write_json(Path(review_pin['path']), review)

    def check_predecessor(self):
        return evidence.validate_predecessor(self.base, self.phase, self.manifest, self.identity)

    def check_transition(self, transition='selection'):
        return evidence.validate_transition(self.base, self.phase, self.manifest, self.identity, transition)

    def make_dispatch(self):
        self.clock_offset = 0
        entry_path = self.attempt / 'run-diagnostic.py'
        entry_path.write_text('# MOCK_ONLY entry: fake API receiver, never an installed module\n'
            'def run(api, approved_manifest_sha):\n'
            '    import sys\n'
            '    return sys.modules["mock_only_postreload_entry_receiver"].run_native(api, '
            + repr(str(self.attempt / 'diagnostic-manifest.json')) + ', approved_manifest_sha)\n', encoding='utf-8')
        self.manifest['entry_file'] = self.pin(entry_path)
        prefix_path = self.attempt / 'dispatch-prefix.txt'
        prefix_path.write_bytes(self.source_log.read_bytes())
        wrapper_path = Path(self.manifest['dispatcher']['path'])
        command = 'py "' + os.path.relpath(wrapper_path, self.base.EDITOR_EXE.parent).replace('\\', '/') + '"'
        record = dict(self.common, status='REVIEWED_EXACT_INVOCATION_ECHO_ONLY',
            reviewer='MOCK_ONLY reviewer', selection_receipt=self.manifest['selection_receipt'],
            entry_file=self.manifest['entry_file'], dispatcher=self.manifest['dispatcher'], expected_command=command,
            reviewed_at_utc=self.stamp(1095)['utc'], expires_at_utc=self.stamp(1695)['utc'],
            log=self.source_point(), prefix_file=self.pin(prefix_path), intervening_lines=[],
            log_timestamp_basis='UTC_OBSERVED_EDITOR_LOG',
            ui=self.ui('dispatch', 'LanceObserverDiagnosticControl', 1094))
        self.manifest['dispatch_log'] = self.write_json(self.attempt / 'dispatch-log-review.json', record)
        at = datetime.datetime.fromisoformat(self.stamp(1097)['utc']).strftime('%Y.%m.%d-%H.%M.%S:%f')[:-3]
        self.echo = ('[' + at + '][  1]Cmd: ' + command + '\n').encode()
        with self.source_log.open('ab') as stream:
            stream.write(self.echo)
        self.seal_fixture_dispatcher()

    def seal_fixture_dispatcher(self):
        path = self.attempt / 'diagnostic-manifest.json'
        digest = self.write_json(path, self.manifest)['sha256']
        Path(self.manifest['dispatcher']['path']).write_bytes(
            evidence.render_dispatcher(path, digest, self.manifest['entry_file']))

    def check_dispatch(self):
        return evidence.validate_live_dispatch_log(self.base, self.phase, self.manifest, self.identity)

    def repin_dispatch(self, change):
        pin = self.manifest['dispatch_log']
        data = json.loads(Path(pin['path']).read_text())
        change(data)
        self.manifest['dispatch_log'] = self.write_json(Path(pin['path']), data)
        self.seal_fixture_dispatcher()

    def prepend_failed_poll(self, transition, result, reason):
        """Keep two valid safe polls after one counted failed observation.

        Rejection must concern the earlier failure itself, rather than a missing
        second successful sample, invalid timing, unsafe-list flag, or stale pin.
        """
        review_pin = self.manifest[transition + '_receipt']
        review = json.loads(Path(review_pin['path']).read_text())
        observed = [json.loads(Path(pin['path']).read_text()) for pin in review['polls']]
        self.assertEqual([poll['result'] for poll in observed], ['OBSERVED', 'OBSERVED'])
        failed = dict(self.common, poll_id=1, kind='explicit', result=result,
            reason=reason, unsafe_conditions_observed=[],
            timing=self.timing(1005, 1005, 1005, 1005), elapsed_seconds=5)
        polls = [failed] + [dict(poll, poll_id=number) for number, poll in enumerate(observed, 2)]
        review['polls'] = [self.write_json(self.attempt / (transition + '-poll-' + str(number) + '.json'), poll)
                           for number, poll in enumerate(polls, 1)]
        action_path = Path(review['action']['path'])
        action = json.loads(action_path.read_text())
        action['observation_call_count'] = 3
        review['action'] = self.write_json(action_path, action)
        self.manifest[transition + '_receipt'] = self.write_json(Path(review_pin['path']), review)


# Fixture provides setup/utilities, not inherited duplicate admission tests.
for _name in list(AdmissionChecks.__dict__):
    if _name.startswith('test_'):
        setattr(EvidenceFixture, _name, None)


class HistoricalEvidenceChecks(EvidenceFixture):
    def test_complete_historical_native_shaped_fixture_rehashes_without_engine_calls(self):
        result = self.check_predecessor()
        self.assertEqual((result['raw_exports'], result['inventories']), (5, 5))
        self.assertEqual(result['live_reference_health'], 'UNKNOWN')
        self.assertFalse(self.root_finds + self.finds + self.exports)

    def test_each_of_ten_prior_raw_and_index_files_missing_or_altered_rejects(self):
        self.check_predecessor()
        for pair in self.manifest['predecessor']['files']:
            for key, pin in pair.items():
                path, original = Path(pin['path']), Path(pin['path']).read_bytes()
                for missing in (True, False):
                    with self.subTest(file=path.name, missing=missing):
                        path.unlink() if missing else path.write_bytes(original + b'MOCK_CHANGED')
                        with self.assertRaises(ValueError):
                            self.check_predecessor()
                        path.write_bytes(original)

    def test_each_predecessor_supporting_pin_detects_altered_bytes(self):
        for key in ('report', 'manifest', 'entry', 'helper', 'base_helper', 'review', 'baseline', 'post_verification', 'continuity'):
            pin = self.manifest['predecessor'][key]
            path, raw = Path(pin['path']), Path(pin['path']).read_bytes()
            with self.subTest(key=key):
                path.write_bytes(raw + b'MOCK_CHANGED')
                with self.assertRaises(ValueError):
                    self.check_predecessor()
                path.write_bytes(raw)

    def test_prior_raw_files_cannot_reorder_or_duplicate(self):
        original = copy.deepcopy(self.manifest['predecessor']['files'])
        for value in (list(reversed(original)), original[:4], [original[0]] * 5):
            self.manifest['predecessor']['files'] = value
            with self.assertRaises(ValueError):
                self.check_predecessor()
        self.manifest['predecessor']['files'] = original

    def test_historical_process_change_rejected(self):
        with self.assertRaisesRegex(ValueError, 'HISTORICAL_PROCESS_CHANGED'):
            evidence.validate_predecessor(self.base, self.phase, self.manifest, dict(self.identity, pid=99999))

    def test_independent_review_report_source_log_binding_rejected(self):
        pin = self.manifest['predecessor']['review']
        path, original = Path(pin['path']), json.loads(Path(pin['path']).read_text())
        for key, value in (('stock_report_sha256', '0' * 64), ('source_review_passed', False),
                           ('log_review_passed', False), ('reviewer', '')):
            candidate = dict(original, **{key: value})
            self.manifest['predecessor']['review'] = self.write_json(path, candidate)
            with self.subTest(key=key), self.assertRaisesRegex(ValueError, 'INDEPENDENT_SOURCE_LOG_REVIEW'):
                self.check_predecessor()
        self.manifest['predecessor']['review'] = self.write_json(path, original)

    def test_historical_stock_log_extract_alteration_rejected(self):
        review = json.loads(Path(self.manifest['predecessor']['review']['path']).read_text())
        Path(review['stock_log_span']['file']['path']).write_bytes(b'MOCK_CHANGED')
        with self.assertRaisesRegex(ValueError, 'EVIDENCE_PIN_MISMATCH'):
            self.check_predecessor()

    def test_historical_continuity_gap_and_memory_overclaim_rejected(self):
        pin = self.manifest['predecessor']['continuity']
        path, original = Path(pin['path']), json.loads(Path(pin['path']).read_text())
        for change in ('gap', 'overclaim'):
            value = copy.deepcopy(original)
            if change == 'gap':
                value['spans'][0]['start_byte'] += 1
            else:
                value['historical_selection_memory_equivalence'] = 'VERIFIED'
            self.manifest['predecessor']['continuity'] = self.write_json(path, value)
            with self.subTest(change=change), self.assertRaises(ValueError):
                self.check_predecessor()


class TransitionChecks(EvidenceFixture):
    def test_complete_two_poll_selection_has_bounded_unknown_health_result(self):
        result = self.check_transition()
        self.assertEqual((result['polls'], result['implicit_reloads'], result['elapsed_seconds']), (2, 1, 17))
        self.assertEqual(result['live_reference_health'], 'UNKNOWN')
        self.assertEqual(result['in_memory_rollback'], 'UNKNOWN')

    def test_action_tool_return_latency_counts_toward_120_seconds(self):
        self.update_transition('action', lambda d: d['timing'].update(returned=self.stamp(1120.01)))
        with self.assertRaisesRegex(ValueError, 'WALL_BUDGET'):
            self.check_transition()

    def test_poll_latency_counts_toward_120_seconds(self):
        self.update_transition('poll', lambda d: d['timing'].update(returned=self.stamp(1121)), poll_number=2)
        with self.assertRaisesRegex(ValueError, 'WALL_BUDGET'):
            self.check_transition()

    def test_wrong_clock_domain_rejected(self):
        self.update_transition('poll', lambda d: d['timing']['returned'].update(clock_domain='MOCK_OTHER_PROCESS'), poll_number=2)
        with self.assertRaisesRegex(ValueError, 'CLOCK_DOMAIN'):
            self.check_transition()

    def test_backward_monotonic_and_utc_substitution_rejected(self):
        self.update_transition('poll', lambda d: d['timing']['returned'].update(monotonic=999), poll_number=2)
        with self.assertRaisesRegex(ValueError, 'CLOCK_REVERSED'):
            self.check_transition()

    def test_nan_monotonic_rejected(self):
        self.update_transition('poll', lambda d: d['timing']['returned'].update(monotonic=float('nan')), poll_number=2)
        with self.assertRaisesRegex(ValueError, 'CLOCK_DOMAIN'):
            self.check_transition()

    def test_uncounted_automatic_or_failed_poll_rejected(self):
        self.update_transition('action', lambda d: d.update(uncounted_observation_calls=1))
        with self.assertRaisesRegex(ValueError, 'MUST_BE_COUNTED'):
            self.check_transition()

    def test_sixth_poll_rejected_before_reading_pins(self):
        self.update_transition('review', lambda d: d.update(polls=d['polls'] * 3))
        with self.assertRaisesRegex(ValueError, 'FIVE_POLL_CAP'):
            self.check_transition()

    def test_one_successful_sample_is_insufficient(self):
        review_pin = self.manifest['selection_receipt']
        review = json.loads(Path(review_pin['path']).read_text())
        final_poll = json.loads(Path(review['polls'][-1]['path']).read_text())
        final_poll['poll_id'] = 1
        self.assertEqual(final_poll['result'], 'OBSERVED')
        review['polls'] = [self.write_json(self.attempt / 'selection-poll-1.json', final_poll)]
        action_path = Path(review['action']['path'])
        action = json.loads(action_path.read_text())
        action['observation_call_count'] = 1
        review['action'] = self.write_json(action_path, action)
        self.manifest['selection_receipt'] = self.write_json(Path(review_pin['path']), review)
        with self.assertRaisesRegex(ValueError, 'TWO_SUCCESSFUL_FINAL_POLLS_REQUIRED'):
            self.check_transition()

    def failed_poll_remains_unresolved(self, result, transition='selection', reason=None):
        if transition == 'restoration':
            self.make_transition('restoration')
        # Establish that the other two complete safe observations satisfy the
        # same full evidence validator before introducing the failed poll.
        self.assertEqual(self.check_transition(transition)['polls'], 2)
        self.prepend_failed_poll(transition, result, reason or
            'MOCK_ONLY foreground focus and exclusive ownership were lost; unsafe list omitted the incident')
        with self.assertRaisesRegex(ValueError, 'FAILED_OBSERVATION_REQUIRES_SEPARATE_RESOLUTION'):
            self.check_transition(transition)
        self.assertFalse(self.root_finds + self.finds + self.exports)

    def test_failed_poll_empty_unsafe_list_cannot_be_repaired_by_two_safe_polls(self):
        self.failed_poll_remains_unresolved('FAILED')

    def test_refused_poll_empty_unsafe_list_cannot_be_repaired_by_two_safe_polls(self):
        self.failed_poll_remains_unresolved('REFUSED')

    def test_timed_out_poll_empty_unsafe_list_cannot_be_repaired_by_two_safe_polls(self):
        self.failed_poll_remains_unresolved('TIMED_OUT')

    def test_benign_transport_failure_still_requires_separate_resolution(self):
        self.failed_poll_remains_unresolved('FAILED', reason=
            'MOCK_ONLY transport request failed before capture; no known foreground or ownership change')

    def test_restoration_failed_poll_empty_unsafe_list_blocks_later_safe_polls(self):
        self.failed_poll_remains_unresolved('FAILED', transition='restoration')

    def test_restoration_refused_poll_empty_unsafe_list_blocks_later_safe_polls(self):
        self.failed_poll_remains_unresolved('REFUSED', transition='restoration')

    def test_restoration_timed_out_poll_empty_unsafe_list_blocks_later_safe_polls(self):
        self.failed_poll_remains_unresolved('TIMED_OUT', transition='restoration')

    def test_samples_less_than_two_seconds_apart_rejected(self):
        self.update_transition('poll', lambda d: d['log'].update(read_completed=self.stamp(1010)), poll_number=1)
        def edit(d):
            d['timing'] = self.timing(1011.1, 1011.2, 1016, 1017)
            d['log']['read_started'] = self.stamp(1011.5)
            d['log']['read_completed'] = self.stamp(1012)
        self.update_transition('poll', edit, poll_number=2)
        with self.assertRaisesRegex(ValueError, 'TWO_SECONDS_IDENTICAL'):
            self.check_transition()

    def test_unreviewed_log_line_blocks_quiescent_samples(self):
        self.update_transition('log_review', lambda d: d['lines'].pop())
        with self.assertRaisesRegex(ValueError, 'EVERY_LOG_LINE'):
            self.check_transition()

    def test_directorywatcher_requires_exact_explicit_path_review(self):
        self.update_transition('log_review', lambda d: d['lines'][0].update(path='../../../MW5Mercs/Plugins/UnknownMod'))
        with self.assertRaisesRegex(ValueError, 'DIRECTORYWATCHER'):
            self.check_transition()

    def test_log_span_truncation_or_rotation_rejected(self):
        self.update_transition('poll', lambda d: d['log'].update(rotated=True), poll_number=2)
        with self.assertRaisesRegex(ValueError, 'COMPLETE_UNROTATED_LOG'):
            self.check_transition()

    def test_log_prefix_or_source_identity_change_rejected(self):
        self.update_transition('poll', lambda d: d['log'].update(source_prefix_sha256='0' * 64), poll_number=2)
        with self.assertRaisesRegex(ValueError, 'FULL_PRE_CLICK_LOG'):
            self.check_transition()

    def test_ui_modal_prevents_admission(self):
        review = json.loads(Path(self.manifest['selection_receipt']['path']).read_text())
        poll_pin = review['polls'][1]
        poll = json.loads(Path(poll_pin['path']).read_text())
        ui_path = Path(poll['ui']['receipt']['path'])
        ui = json.loads(ui_path.read_text())
        ui['modal_visible'] = True
        new_pin = self.write_json(ui_path, ui)
        self.update_transition('poll', lambda d: d['ui'].update(receipt=new_pin), poll_number=2)
        with self.assertRaisesRegex(ValueError, 'SAFE_TARGET_UI'):
            self.check_transition()

    def test_incomplete_inventory_or_descriptor_drift_rejected(self):
        self.update_transition('final_state', lambda d: d['descriptors'][0].update(sha256='0' * 64))
        with self.assertRaisesRegex(ValueError, 'DESCRIPTOR'):
            self.check_transition()

    def test_reference_health_overclaim_rejected(self):
        self.update_transition('review', lambda d: d.update(live_reference_health='HEALTHY'))
        with self.assertRaisesRegex(ValueError, 'OVERCLAIM'):
            self.check_transition()

    def test_restoration_current_files_verified_but_memory_stays_unknown(self):
        self.make_transition('restoration')
        (self.roots[1] / 'ActiveMod.txt').unlink()
        (self.roots[0] / 'ActiveMod.txt').write_bytes(b'')
        result = evidence.validate_restoration(self.base, self.phase, self.manifest, self.identity)
        self.assertEqual(result['in_memory_rollback'], 'UNKNOWN')
        self.assertEqual(result['current_ui_process'], 'UNKNOWN_REQUIRES_SUPERVISED_FRESH_OBSERVATION')

    def test_restoration_added_file_is_not_hidden_by_matching_markers(self):
        self.make_transition('restoration')
        (self.roots[1] / 'ActiveMod.txt').unlink()
        (self.roots[0] / 'ActiveMod.txt').write_bytes(b'')
        (self.roots[0] / 'unexpected.bin').write_bytes(b'MOCK_ONLY')
        with self.assertRaisesRegex(ValueError, 'CURRENT_FULL_MOD_INVENTORY'):
            evidence.validate_restoration(self.base, self.phase, self.manifest, self.identity)

    def test_restoration_descriptor_drift_is_not_hidden_by_matching_markers(self):
        self.make_transition('restoration')
        (self.roots[1] / 'ActiveMod.txt').unlink()
        (self.roots[0] / 'ActiveMod.txt').write_bytes(b'')
        (self.roots[1] / 'mod.json').write_bytes(b'{"MOCK_CHANGED":true}')
        with self.assertRaisesRegex(ValueError, 'EVIDENCE_PIN_MISMATCH'):
            evidence.validate_restoration(self.base, self.phase, self.manifest, self.identity)

    def test_restoration_not_performed_cannot_hide_consumed_dispatch(self):
        self.make_transition('restoration')
        (self.attempt / 'diagnostic-native-dispatch-claim.json').write_bytes(b'{"MOCK_ONLY":true}')
        with self.assertRaises(ValueError):
            self.check_transition('restoration')

    def test_restoration_not_performed_cannot_hide_inspection_output(self):
        self.make_transition('restoration')
        output = self.attempt / 'diagnostic'
        output.mkdir()
        (output / 'started.json').write_bytes(b'{"MOCK_ONLY":true}')
        with self.assertRaises(ValueError):
            self.check_transition('restoration')

    def test_restoration_not_performed_cannot_hide_active_lock(self):
        self.make_transition('restoration')
        lock = self.shared / '.diagnostic-template-inspection.lock'
        lock.write_bytes(b'MOCK_ONLY active owner')
        with self.assertRaises(ValueError):
            self.check_transition('restoration')
        self.assertEqual(lock.read_bytes(), b'MOCK_ONLY active owner')

    def test_restoration_requires_separate_fresh_safe_eligibility(self):
        self.make_transition('restoration')
        pin = self.manifest['restoration_receipt']
        review = json.loads(Path(pin['path']).read_text())
        before_path = Path(review['pre_click']['path'])
        before = json.loads(before_path.read_text())
        eligibility_path = Path(before['eligibility_review']['path'])
        eligibility = json.loads(eligibility_path.read_text())
        eligibility['unsafe_conditions_observed'] = ['MOCK_ONLY ownership loss unresolved']
        before['eligibility_review'] = self.write_json(eligibility_path, eligibility)
        review['pre_click'] = self.write_json(before_path, before)
        self.manifest['restoration_receipt'] = self.write_json(Path(pin['path']), review)
        with self.assertRaisesRegex(ValueError, 'SAFE_RESTORATION_ELIGIBILITY'):
            self.check_transition('restoration')

    def test_unsafe_failed_poll_cannot_be_erased_by_later_quiescence(self):
        self.update_transition('poll', lambda d: d.update(result='REFUSED', reason='MOCK_ONLY lost focus',
            unsafe_conditions_observed=['ownership_loss']), poll_number=1)
        with self.assertRaisesRegex(ValueError, 'UNSAFE_OBSERVATION'):
            self.check_transition()

    def test_complete_line_review_rejects_warning_unknown_and_wrong_reload(self):
        review = json.loads(Path(self.manifest['selection_receipt']['path']).read_text())
        log_review = json.loads(Path(review['log_review']['path']).read_text())
        original = log_review['lines']
        changes = [('warning', 3, '[2026.09.27-00.00.03:000][  1]LogUObjectHash: Warning: MOCK_ONLY'),
                   ('unknown', 3, '[2026.09.27-00.00.03:000][  1]LogUnknown: MOCK_ONLY'),
                   ('extra_reload', 1, '[2026.09.27-00.00.03:000][  1]LogUObjectGlobals: Reloading 2 Package(s):'),
                   ('wrong_package', 2, '    Asset Name: /Game/Unexpected.Unexpected')]
        for label, index, text in changes:
            rows = copy.deepcopy(original)
            rows[index]['text'] = text
            cursor = rows[0]['start_byte']
            for row in rows:
                row['start_byte'] = cursor
                cursor += len((row['text'] + '\n').encode())
                row['end_byte'] = cursor
            raw = ''.join(row['text'] + '\n' for row in rows).encode()
            with self.subTest(change=label), self.assertRaises(ValueError):
                evidence._review_lines(raw, rows[0]['start_byte'], rows,
                    'LanceObserverProbe', evidence.DIAGNOSTIC_PACKAGE)


class DispatchEvidenceChecks(EvidenceFixture):
    def setUp(self):
        super().setUp()
        self.make_dispatch()

    def test_exact_one_reviewed_echo_after_bound_prefix_passes(self):
        result = self.check_dispatch()
        self.assertEqual(result['live_reference_health'], 'UNKNOWN')
        self.assertEqual(result['end_byte'] - result['start_byte'], len(self.echo))
        self.assertFalse(self.root_finds + self.finds + self.exports)

    def test_missing_echo_is_not_silent_dispatch_success(self):
        self.source_log.write_bytes(self.source_log.read_bytes()[:-len(self.echo)])
        with self.assertRaisesRegex(ValueError, 'EXACT_ONE_INVOCATION_LOG_TAIL'):
            self.check_dispatch()

    def test_extra_line_or_second_echo_blocks_dispatch(self):
        original = self.source_log.read_bytes()
        for tail in (self.echo, b'MOCK_ONLY unexplained\n', b'Warning: MOCK warning\n'):
            self.source_log.write_bytes(original + tail)
            with self.subTest(tail=tail), self.assertRaisesRegex(ValueError, 'UNREVIEWED_OR_EXTRA'):
                self.check_dispatch()
        self.source_log.write_bytes(original)

    def test_wrong_command_entry_is_rejected(self):
        self.source_log.write_bytes(self.source_log.read_bytes().replace(b'dispatch-diagnostic.py', b'dispatch-unknown.py'))
        with self.assertRaisesRegex(ValueError, 'UNREVIEWED_OR_EXTRA'):
            self.check_dispatch()

    def test_incomplete_echo_line_rejected(self):
        self.source_log.write_bytes(self.source_log.read_bytes()[:-1])
        with self.assertRaisesRegex(ValueError, 'UNREVIEWED_OR_EXTRA'):
            self.check_dispatch()

    def test_altered_live_prefix_rejected(self):
        raw = self.source_log.read_bytes()
        self.source_log.write_bytes(b'X' + raw[1:])
        with self.assertRaisesRegex(ValueError, 'LIVE_LOG_PREFIX_CHANGED'):
            self.check_dispatch()

    def test_changed_source_log_identity_rejected(self):
        self.repin_dispatch(lambda d: d['log'].update(stat_identity=[0, 0]))
        with self.assertRaises(ValueError):
            self.check_dispatch()

    def test_stale_review_and_old_invocation_rejected(self):
        self.repin_dispatch(lambda d: d.update(reviewed_at_utc=self.stamp(0)['utc'], expires_at_utc=self.stamp(600)['utc']))
        with self.assertRaisesRegex(ValueError, 'STALE'):
            self.check_dispatch()

    def test_fresh_dispatch_ui_required(self):
        pin = self.manifest['dispatch_log']
        document = json.loads(Path(pin['path']).read_text())
        ui_pin = document['ui']['receipt']
        ui = json.loads(Path(ui_pin['path']).read_text())
        ui['observed_at'] = self.stamp(1050)
        new_pin = self.write_json(Path(ui_pin['path']), ui)
        self.repin_dispatch(lambda d: d['ui'].update(receipt=new_pin))
        with self.assertRaisesRegex(ValueError, 'FRESH_SAFE_DISPATCH_UI'):
            self.check_dispatch()

    def test_dispatch_entry_bytes_changed_after_review_rejected(self):
        Path(self.manifest['entry_file']['path']).write_bytes(b'# MOCK_CHANGED entry\n')
        with self.assertRaisesRegex(ValueError, 'EVIDENCE_PIN_MISMATCH'):
            self.check_dispatch()

    def execute_synthetic_wrapper(self, receiver, raw=None):
        path = Path(self.manifest['dispatcher']['path'])
        with patch.dict(sys.modules, {'unreal': self.api, 'mock_only_postreload_entry_receiver': receiver}):
            exec(compile(path.read_bytes() if raw is None else raw, str(path), 'exec'),
                 {'__name__': '__main__', '__file__': str(path)})

    def test_canonical_wrapper_passes_exact_approved_manifest_sha_without_hash_cycle(self):
        calls = []
        receiver = SimpleNamespace(run_native=lambda api, path, digest: calls.append((api, path, digest)))
        self.execute_synthetic_wrapper(receiver)
        manifest_path = self.attempt / 'diagnostic-manifest.json'
        self.assertEqual(calls, [(self.api, str(manifest_path), self.pin(manifest_path)['sha256'])])
        self.assertEqual(set(self.manifest['dispatcher']), {'path', 'format_version'})
        self.assertNotIn(self.pin(manifest_path)['sha256'], Path(self.manifest['entry_file']['path']).read_text())
        self.assertFalse(self.root_finds + self.finds + self.exports)

    def test_wrapper_source_tampering_rejected_by_canonical_guard(self):
        path = Path(self.manifest['dispatcher']['path'])
        path.write_bytes(path.read_bytes() + b'# MOCK_CHANGED wrapper\n')
        with self.assertRaisesRegex(ValueError, 'CANONICAL_DISPATCHER'):
            self.check_dispatch()

    def test_wrong_embedded_manifest_sha_rejected_by_canonical_guard(self):
        path = Path(self.manifest['dispatcher']['path'])
        path.write_bytes(evidence.render_dispatcher(self.attempt / 'diagnostic-manifest.json',
                                                    '0' * 64, self.manifest['entry_file']))
        with self.assertRaisesRegex(ValueError, 'CANONICAL_DISPATCHER'):
            self.check_dispatch()

    def test_wrapper_rejects_altered_manifest_before_calling_entry(self):
        calls = []
        receiver = SimpleNamespace(run_native=lambda *args: calls.append(args))
        (self.attempt / 'diagnostic-manifest.json').write_bytes(b'{"MOCK_CHANGED":true}')
        with self.assertRaises(RuntimeError):
            self.execute_synthetic_wrapper(receiver)
        self.assertEqual(calls, [])

    def test_wrapper_rejects_altered_entry_before_calling_entry(self):
        calls = []
        receiver = SimpleNamespace(run_native=lambda *args: calls.append(args))
        Path(self.manifest['entry_file']['path']).write_bytes(b'raise AssertionError("MOCK_CHANGED must not execute")\n')
        with self.assertRaisesRegex(RuntimeError, 'ENTRY_BYTES_CHANGED'):
            self.execute_synthetic_wrapper(receiver)
        self.assertEqual(calls, [])

    def test_wrong_entry_hash_inside_wrapper_is_not_admitted(self):
        path = Path(self.manifest['dispatcher']['path'])
        entry = dict(self.manifest['entry_file'], sha256='0' * 64)
        path.write_bytes(evidence.render_dispatcher(self.attempt / 'diagnostic-manifest.json',
            self.pin(self.attempt / 'diagnostic-manifest.json')['sha256'], entry))
        with self.assertRaisesRegex(ValueError, 'CANONICAL_DISPATCHER'):
            self.check_dispatch()


class NativeAdmissionChecks(EvidenceFixture):
    """Calls native-shaped entry with fake API/process/health only, never Unreal."""
    def setUp(self):
        super().setUp()
        self.make_dispatch()
        self.api.__name__ = 'unreal'  # Synthetic namespace, not an Unreal module.
        self.base.process_identity = lambda: dict(self.identity)
        for name, digest in self.base.UTILITY_PINS:
            (self.root / 'scripts' / name).write_bytes((ROOT / 'scripts' / name).read_bytes())
            self.assertEqual(self.pin(self.root / 'scripts' / name)['sha256'], digest)
        final, _ = self.base.utilities()
        self.base.utilities = lambda: (final, SimpleNamespace(health=lambda _: dict(HEALTH)))
        patch.object(helper, 'ROOT', self.root).start()
        patch.object(helper, 'load_base', lambda: self.base).start()
        patch.object(helper, 'load_phase', lambda: self.phase).start()
        original_load = helper.load_module
        def loaded(path, sha, name):
            if Path(path) == Path(evidence.__file__):
                # Do perform the reviewed-byte load, only redirect synthetic ROOT.
                result = original_load(path, sha, name)
                result.ROOT = self.root
                return result
            return original_load(path, sha, name)
        patch.object(helper, 'load_module', loaded).start()
        review = {'status': 'PASS_OFFLINE_IMPLEMENTATION_AND_ENTRY_REVIEW',
            'helper_sha256': self.manifest['helper_sha256'],
            'evidence_helper_sha256': self.manifest['evidence_helper_sha256'],
            'entry_file': self.manifest['entry_file'], 'protocol': helper.PROTOCOL,
            'dispatcher': self.manifest['dispatcher'],
            'native_execution': 'NOT_PERFORMED', 'reviewer': 'MOCK_ONLY independent reviewer'}
        self.manifest['implementation_review'] = self.write_json(self.attempt / 'implementation-review.json', review)
        self.manifest_path = self.attempt / 'diagnostic-manifest.json'
        self.repin_manifest()

    def repin_manifest(self):
        self.manifest_pin = self.write_json(self.manifest_path, self.manifest)['sha256']
        Path(self.manifest['dispatcher']['path']).write_bytes(
            evidence.render_dispatcher(self.manifest_path, self.manifest_pin, self.manifest['entry_file']))

    def call_native_fixture(self):
        return helper.run_native(self.api, self.manifest_path, self.manifest_pin)

    def assert_no_native_dispatch(self):
        self.assertFalse(self.root_finds + self.finds + self.exports + self.forbidden)
        self.assertFalse((self.attempt / 'diagnostic-native-dispatch-claim.json').exists())

    def test_complete_full_evidence_admission_and_persistent_replay_refusal(self):
        result = self.call_native_fixture()
        self.assertEqual(result['status'], 'COLLECTED_REQUIRES_REVIEW')
        self.assertEqual(result['root']['load_calls'], 0)
        self.assertEqual(len(self.exports), 5)
        # Native-shaped receipt below belongs ONLY to this temporary mock fixture.
        claim = self.attempt / 'diagnostic-native-dispatch-claim.json'
        before = claim.read_bytes()
        with self.assertRaisesRegex(ValueError, 'DISPATCH_ALREADY_CLAIMED'):
            self.call_native_fixture()
        self.assertEqual(claim.read_bytes(), before)
        self.assertEqual(len(self.exports), 5)

    def test_bad_predecessor_blocks_before_claim_and_any_engine_call(self):
        path = Path(self.manifest['predecessor']['files'][0]['export']['path'])
        path.write_bytes(b'MOCK_CHANGED')
        with self.assertRaises(ValueError):
            self.call_native_fixture()
        self.assert_no_native_dispatch()

    def test_unreviewed_log_line_blocks_before_claim(self):
        with self.source_log.open('ab') as stream:
            stream.write(b'MOCK_ONLY unexpected after dispatch\n')
        with self.assertRaisesRegex(ValueError, 'UNREVIEWED_OR_EXTRA'):
            self.call_native_fixture()
        self.assert_no_native_dispatch()

    def test_new_helper_hash_drift_blocks_before_claim(self):
        self.manifest['helper_sha256'] = '0' * 64
        self.repin_manifest()
        with self.assertRaisesRegex(ValueError, 'INSPECTOR_PIN'):
            self.call_native_fixture()
        self.assert_no_native_dispatch()

    def test_missing_implementation_review_blocks_before_claim(self):
        del self.manifest['implementation_review']
        self.repin_manifest()
        with self.assertRaisesRegex(ValueError, 'IMPLEMENTATION_REVIEW'):
            self.call_native_fixture()
        self.assert_no_native_dispatch()

    def test_stale_manifest_blocks_before_claim(self):
        self.manifest['reviewed_at_utc'] = (self.now - datetime.timedelta(seconds=601)).isoformat()
        self.repin_manifest()
        with self.assertRaisesRegex(ValueError, 'FRESH_OWNER'):
            self.call_native_fixture()
        self.assert_no_native_dispatch()

    def test_process_change_blocks_before_claim(self):
        self.base.process_identity = lambda: dict(self.identity, pid=12346)
        with self.assertRaisesRegex(ValueError, 'IDENTITY'):
            self.call_native_fixture()
        self.assert_no_native_dispatch()

    def test_predecessor_changes_during_query_prevent_acceptance_without_retry(self):
        changed = Path(self.manifest['predecessor']['files'][0]['export']['path'])
        self.find_effect = lambda *_: changed.write_bytes(b'MOCK_CHANGED')
        result = self.call_native_fixture()
        self.stopped(result, 'EVIDENCE_PIN_MISMATCH')
        self.assertEqual(len(self.root_finds), 1)
        self.assertFalse(self.finds + self.exports)
        self.assertTrue((self.attempt / 'diagnostic-native-dispatch-claim.json').exists())

    def test_manifest_drift_during_query_consumes_claim_and_stops(self):
        self.find_effect = lambda *_: self.manifest_path.write_text('{}', encoding='utf-8')
        result = self.call_native_fixture()
        self.stopped(result)
        self.assertEqual(len(self.root_finds), 1)
        self.assertFalse(self.finds + self.exports)
        self.assertTrue((self.attempt / 'diagnostic-native-dispatch-claim.json').exists())

    def test_actual_canonical_wrapper_executes_complete_fake_native_entry_once(self):
        path = Path(self.manifest['dispatcher']['path'])
        before = self.pin(self.manifest_path)
        with patch.dict(sys.modules, {'unreal': self.api, 'mock_only_postreload_entry_receiver': helper}):
            exec(compile(path.read_bytes(), str(path), 'exec'), {'__name__': '__main__', '__file__': str(path)})
        result = json.loads((self.attempt / 'diagnostic/report.json').read_text())
        self.assertEqual(result['status'], 'COLLECTED_REQUIRES_REVIEW')
        self.assertEqual(self.pin(self.manifest_path), before)
        self.assertEqual(len(self.exports), 5)
        self.assertFalse(self.forbidden)
        self.assertTrue((self.attempt / 'diagnostic-native-dispatch-claim.json').exists())


if __name__ == '__main__':
    print('Classification: MOCK_ONLY. Native/editor execution: NOT_PERFORMED. All native-shaped receipts are temporary synthetic fixtures.', flush=True)
    unittest.main(verbosity=2)
