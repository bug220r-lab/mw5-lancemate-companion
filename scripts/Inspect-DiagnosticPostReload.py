"""Dormant, exact already-loaded diagnostic inspection after reviewed native reload.

This module never selects a mod, loads/reloads an asset, traverses references,
compiles, saves or repairs state. Native readiness requires a separately reviewed
fresh entry/manifest and actual transition/continuity evidence. MOCK_ONLY is not
native admission. Engine calls and size/time bounds remain cooperative.
"""
import datetime
import hashlib
import importlib.util
import itertools
import json
import math
import os
from pathlib import Path
import re
import sys
import time
import uuid

ROOT = Path(__file__).resolve().parent.parent
PHASE = ROOT / 'scripts/Inspect-DiagnosticTemplatePhase.py'
PHASE_SHA = '13b0e9d3e395468b70c6e06ced6edfb5018b8c56d0339c284167d15e308a0105'
BASE = ROOT / 'scripts/Inspect-DiagnosticTemplates.py'
BASE_SHA = '8b92919782afdc799b2c415d7c18cba0282be24e0bf7c698e9a54500ecb018fd'
EVIDENCE = ROOT / 'scripts/DiagnosticPostReloadEvidence.py'
PROTOCOL = 'DIAGNOSTIC_POST_RELOAD_LOADED_ONLY_V1'
_NATIVE_ADMISSION_TOKEN = object()
LIMITS = {'root_finds': 2, 'diagnostic_root_loads': 0, 'subobject_finds': 5,
          'exports': 5, 'seconds': 90, 'export_bytes': 1024**2,
          'raw_bytes': 8 * 1024**2, 'inventory_bytes': 8 * 1024**2,
          'receipt_bytes': 128 * 1024, 'outer_depth': 8, 'lexical_depth': 16,
          'disk_free_bytes': 2 * 1024**3, 'mod_files': 256,
          'mod_total_bytes': 512 * 1024**2, 'mod_directories': 1024,
          'capture_bytes': 8 * 1024**2, 'log_span_bytes': 256 * 1024}


def exact_path(path, directory=False):
    """Reject any redirected/nonregular component, including junction ancestors."""
    path = Path(path)
    if not path.is_absolute() or path.resolve() != path.absolute():
        raise ValueError('EXACT_NONREDIRECTED_PATH_REQUIRED')
    for component in (path,) + tuple(path.parents):
        stat = component.lstat()
        if component.is_symlink() or getattr(stat, 'st_file_attributes', 0) & 0x400:
            raise ValueError('REDIRECTED_PATH_FORBIDDEN')
    if not (path.is_dir() if directory else path.is_file()):
        raise ValueError('REGULAR_PATH_REQUIRED')
    return path


def load_module(path, sha, name):
    path = exact_path(path)
    if not isinstance(sha, str) or not re.fullmatch(r'[0-9a-f]{64}', sha):
        raise ValueError('REVIEWED_MODULE_PIN_REQUIRED')
    # Hash exact bytes before compiling those same bytes, not a second unpinned read.
    raw = path.read_bytes()
    if hashlib.sha256(raw).hexdigest() != sha:
        raise ValueError('MODULE_PIN_MISMATCH')
    module = importlib.util.module_from_spec(importlib.util.spec_from_file_location(name, path))
    exec(compile(raw, str(path), 'exec'), module.__dict__)
    return module


def load_phase():
    return load_module(PHASE, PHASE_SHA, '_postreload_phase_primitives')


def load_base():
    return load_module(BASE, BASE_SHA, '_postreload_base_primitives')


def plan(base):
    prefix = base.PREFIXES['diagnostic']
    return {'protocol': PROTOCOL, 'phase': 'diagnostic',
            'targets': [dict(t) for t in base.TARGETS if t['scope'] == 'diagnostic'],
            'root_asset': {'label': 'diagnostic', 'scope': 'diagnostic',
                           'name': 'InstantActionPlayerController', 'object_path': prefix[:-2],
                           'class_path': '/Script/Engine.Blueprint', 'outer_path': prefix.split('.')[0]},
            'allow_load': False, 'allow_exact_root_load': False, 'limits': dict(LIMITS)}


def validate(base, phase, manifest, identity, now):
    if manifest.get('schema_version') != 1 or manifest.get('status') != 'REVIEWED_NATIVE_READY':
        raise ValueError('NATIVE_REVIEW_REQUIRED')
    if (any(manifest.get(k) != v for k, v in plan(base).items()) or
            manifest.get('allow_load') is not False or manifest.get('allow_exact_root_load') is not False):
        raise ValueError('EXACT_LOADED_ONLY_SCOPE_REQUIRED')
    if (manifest.get('editor_identity') != identity or
            Path(identity['executable']).resolve() != base.EDITOR_EXE.resolve()):
        raise ValueError('FRESH_EDITOR_IDENTITY_MISMATCH')
    if type(identity.get('pid')) is not int or identity['pid'] <= 0 or not re.fullmatch(r'[0-9]+', identity.get('creation_filetime', '')):
        raise ValueError('EXACT_PROCESS_CREATION_REQUIRED')
    stamp = datetime.datetime.fromisoformat(manifest['reviewed_at_utc'].replace('Z', '+00:00'))
    if (stamp.tzinfo is None or not 0 <= (now - stamp).total_seconds() <= 600 or
            manifest.get('native_owner_confirmed') is not True or
            any(not isinstance(manifest.get(k), str) or not 0 < len(manifest[k].strip()) <= 2048
                for k in ('native_owner', 'owner_evidence', 'authorization_evidence'))):
        raise ValueError('FRESH_OWNER_AND_SCOPE_REVIEW_REQUIRED')
    if not re.fullmatch(r'diagnostic-post-reload-\d{8}T\d{6}Z-[0-9a-f]{8}', manifest.get('attempt_id', '')):
        raise ValueError('EXACT_NEW_ATTEMPT_REQUIRED')
    if manifest.get('engine_version') != '4.26.2/CL14830424':
        raise ValueError('EXACT_EDITOR_ENGINE_VERSION_REQUIRED')
    if manifest.get('base_helper_sha256') != BASE_SHA or manifest.get('phase_helper_sha256') != PHASE_SHA:
        raise ValueError('PRIMITIVE_HELPER_PIN_MISMATCH')
    if manifest.get('selection') != phase.expected_selection(phase.mod_roots(base), 'diagnostic'):
        raise ValueError('DIAGNOSTIC_SELECTION_REQUIRED')
    phase.validate_mod_inventory(manifest.get('mod_inventory'), phase.mod_roots(base), manifest['selection'])
    phase.validate_mod_inventory(manifest.get('original_mod_inventory'), phase.mod_roots(base),
                                 phase.expected_selection(phase.mod_roots(base), 'stock'))
    pins = manifest.get('protected_files')
    if not isinstance(pins, list) or len(pins) != 27 or pins != base.fixed_protected_inputs():
        raise ValueError('EXACT_27_PROTECTED_PINS_REQUIRED')
    for key in ('helper_sha256', 'evidence_helper_sha256'):
        if not isinstance(manifest.get(key), str) or not re.fullmatch(r'[0-9a-f]{64}', manifest[key]):
            raise ValueError('NEW_HELPER_REVIEWED_PINS_REQUIRED')


def read_pin(base, phase, pin, limit):
    if not isinstance(pin, dict) or not isinstance(pin.get('path'), str):
        raise ValueError('EXACT_FILE_PIN_REQUIRED')
    exact_path(pin['path'])
    return phase.read_record(base, pin, limit)


def validate_implementation_review(base, phase, manifest, attempt):
    review_pin = manifest.get('implementation_review')
    if not isinstance(review_pin, dict) or Path(review_pin.get('path', '')) != attempt / 'implementation-review.json':
        raise ValueError('EXACT_IMPLEMENTATION_REVIEW_REQUIRED')
    review = json.loads(read_pin(base, phase, review_pin, LIMITS['receipt_bytes']))
    required = {'status': 'PASS_OFFLINE_IMPLEMENTATION_AND_ENTRY_REVIEW',
                'helper_sha256': manifest['helper_sha256'],
                'evidence_helper_sha256': manifest['evidence_helper_sha256'],
                'entry_file': manifest['entry_file'], 'dispatcher': manifest['dispatcher'], 'protocol': PROTOCOL,
                'native_execution': 'NOT_PERFORMED'}
    if any(review.get(k) != v for k, v in required.items()) or not review.get('reviewer'):
        raise ValueError('IMPLEMENTATION_ENTRY_REVIEW_BINDING_MISMATCH')
    return review


def validate_editor_artifacts(base, phase, manifest):
    executable = manifest.get('editor_executable')
    version = manifest.get('editor_build')
    if not isinstance(executable, dict) or Path(executable.get('path', '')) != base.EDITOR_EXE:
        raise ValueError('EXACT_EDITOR_EXECUTABLE_PIN_REQUIRED')
    read_pin(base, phase, executable, 512 * 1024**2)
    version_path = base.EDITOR_EXE.parents[2] / 'Build/Build.version'
    if not isinstance(version, dict) or Path(version.get('path', '')) != version_path:
        raise ValueError('EXACT_EDITOR_BUILD_PIN_REQUIRED')
    fields = json.loads(read_pin(base, phase, version, LIMITS['receipt_bytes']))
    required = {'MajorVersion': 4, 'MinorVersion': 26, 'PatchVersion': 2, 'CompatibleChangelist': 14830424}
    if any(fields.get(k) != v for k, v in required.items()) or manifest.get('editor_version') != required:
        raise ValueError('EXACT_OBSERVED_EDITOR_VERSION_REQUIRED')


def execute(base, phase_helper, api, manifest, attempt, roots, health_query, clock, native, guard=lambda: None, _admission=None, _manifest_sha256=None):
    if native and _admission is not _NATIVE_ADMISSION_TOKEN:
        raise ValueError('NATIVE_ADMISSION_ENTRY_REQUIRED')
    if native and (not isinstance(_manifest_sha256, str) or not re.fullmatch(r'[0-9a-f]{64}', _manifest_sha256)):
        raise ValueError('NATIVE_MANIFEST_BYTES_PIN_REQUIRED')
    if not native and getattr(api, '__name__', None) == 'unreal':
        raise ValueError('REAL_API_FORBIDDEN_IN_MOCK')
    phase = manifest['phase']
    fixed = plan(base)
    if (any(manifest.get(k) != v for k, v in fixed.items()) or
            manifest.get('allow_load') is not False or manifest.get('allow_exact_root_load') is not False):
        raise ValueError('FIXED_PHASE_SCOPE_REQUIRED')
    if manifest.get('selection') != phase_helper.expected_selection(roots, phase):
        raise ValueError('PHASE_SELECTION_SCOPE_MISMATCH')
    evidence = attempt.parent / 'editor-source'
    if not evidence.is_dir() or attempt.resolve() != attempt.absolute() or not attempt.is_dir():
        raise ValueError('PREPARED_ATTEMPT_DIRECTORY_REQUIRED')
    if (any(evidence.glob('.diagnostic-*.lock')) or any(evidence.glob('.observer-*.lock'))
            or any(getattr(api, key, None) is not None for key in (base.ACTIVE_KEY,) + base.OTHER_ACTIVE_KEYS)):
        raise RuntimeError('OTHER_INSPECTION_ACTIVE')
    final, _ = base.utilities()
    token, started = uuid.uuid4().hex, clock()
    if type(started) not in (int, float) or not math.isfinite(started) or started < 0:
        raise ValueError('VALID_INITIAL_MONOTONIC_CLOCK_REQUIRED')
    last_clock = [started]
    output = attempt / phase
    lock = evidence / '.diagnostic-template-inspection.lock'
    report = {'classification': 'EDITOR_SOURCE_REQUIRES_REVIEW' if native else 'MOCK_ONLY',
              'native_inspection': 'STARTED' if native else 'NOT_PERFORMED',
              'phase': phase, 'attempt_id': manifest.get('attempt_id'), 'manifest': manifest,
              'editor_identity': manifest.get('editor_identity'), 'status': 'STARTED',
              'queries': [], 'errors': [], 'root': {'load_calls': 0},
              'root_finds': 0, 'subobject_finds': 0, 'exports': 0, 'explicit_asset_loads': 0, 'exported_bytes': 0, 'inventory_bytes': 0,
              'native_admission': 'PASSED_REQUIRES_REVIEW' if native else 'NOT_PERFORMED',
              'reference_health': 'UNKNOWN', 'memory_rollback': 'UNKNOWN',
              'output_directory': str(output), 'mount_registry_state': 'UNKNOWN_NOT_QUERIED',
              'explicit_asset_edit_save_compile_reload_selection_restart_cook_retail': 'NOT_PERFORMED',
              'limitations': ['Only exact name/class/outer accessibility is observed; no mount-registry proof.',
                              'Lexical references and omitted fields remain UNKNOWN; no dynamic reference loads.',
                              'Native calls and exporter size bounds are cooperative/post-call; cannot interrupt engine work.',
                              'No explicit loads or reference traversal; engine export behavior is not runtime acceptance.',
                              'No fixed RAM reserve; actual allocation failure stops. No UI rollback is automated.']}
    retained, objects, owns_output = [], [], False

    def write_json(name, data, limit):
        raw = (json.dumps(data, indent=2, ensure_ascii=True) + '\n').encode('utf-8')
        if len(raw) > limit:
            raise ValueError('JSON_OUTPUT_LIMIT')
        exact_path(output, directory=True)
        with (output / name).open('xb') as stream:
            stream.write(raw)
        return {'path': str(output / name), 'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()}

    def receipt(name):
        report['elapsed_seconds'] = round(last_clock[0] - started, 3)
        try:
            write_json(name, report, LIMITS['receipt_bytes'])
        except ValueError as exc:
            if str(exc) != 'JSON_OUTPUT_LIMIT':
                raise
            summary = {k: report[k] for k in ('classification', 'native_inspection', 'phase', 'attempt_id',
                       'output_directory', 'root', 'root_finds', 'exported_bytes', 'inventory_bytes',
                       'explicit_asset_edit_save_compile_reload_selection_restart_cook_retail')}
            summary.update(status='STOPPED_RECEIPT_SIZE_LIMIT', errors=['RECEIPT_SIZE_LIMIT'],
                           limitations=['Detailed report exceeded bound; retain earlier receipts/raw files.'])
            write_json(name, summary, LIMITS['receipt_bytes'])
            if name == 'report.json':
                report.clear()
                report.update(summary)
            else:
                raise RuntimeError('RECEIPT_SIZE_LIMIT')

    def budget():
        if (attempt / 'STOP').exists() or (output / 'STOP').exists():
            raise RuntimeError('USER_STOP')
        current = clock()
        if type(current) not in (float, int) or not math.isfinite(current) or current < last_clock[0]:
            raise RuntimeError('MONOTONIC_CLOCK_DISCONTINUITY')
        last_clock[0] = current
        if current - started > LIMITS['seconds']:
            raise RuntimeError('COOPERATIVE_TIME_STOP')

    def check():
        budget()
        report['guard_evidence'] = guard()
        report['last_health'] = health_query(attempt)
        budget()
        if (type(report['last_health'].get('disk_free')) not in (int, float)
                or not math.isfinite(report['last_health']['disk_free'])
                or report['last_health']['disk_free'] < LIMITS['disk_free_bytes']):
            raise RuntimeError('DISK_RESOURCE_STOP')
        if not all(row['matches'] for row in base.protected_snapshot(manifest['protected_files'])):
            raise ValueError('PROTECTED_INPUT_CHANGED')
        if base.selection_snapshot(manifest['selection']) != manifest['selection']:
            raise ValueError('SELECTION_CHANGED')
        for target, obj in retained:
            base.object_identity(obj, target, {})
        if (report['root_finds'] > LIMITS['root_finds'] or report['subobject_finds'] > LIMITS['subobject_finds']
                or report['exports'] > LIMITS['exports'] or report['explicit_asset_loads'] != 0):
            raise ValueError('EXACT_CALL_BUDGET_EXCEEDED')
        if report['exported_bytes'] > LIMITS['raw_bytes'] or report['inventory_bytes'] > LIMITS['inventory_bytes']:
            raise ValueError('AGGREGATE_OUTPUT_LIMIT')
        budget()

    claim = attempt / ('diagnostic-' + ('native' if native else 'mock') + '-dispatch-claim.json')
    if claim.exists():
        raise ValueError('DISPATCH_ALREADY_CLAIMED')
    exact_path(attempt, directory=True)
    exact_path(evidence, directory=True)
    with lock.open('x', encoding='ascii') as stream:
        stream.write(token)
    try:
        # Exclusive creation consumes this attempt even if a later write/call fails.
        with claim.open('x', encoding='utf-8') as stream:
            json.dump({'attempt_id': manifest.get('attempt_id'), 'token': token,
                       'classification': 'NATIVE_DISPATCH_CLAIM' if native else 'MOCK_ONLY',
                       'manifest_sha256': _manifest_sha256 if native else hashlib.sha256(json.dumps(manifest, sort_keys=True).encode()).hexdigest(),
                       'editor_identity': manifest.get('editor_identity')}, stream)
            stream.flush()
            os.fsync(stream.fileno())
        setattr(api, base.ACTIVE_KEY, token)
        output.mkdir(exist_ok=False)
        owns_output = True
        receipt('started.json')
        check()
        report['mod_inventory_before'] = phase_helper.snapshot_mod_roots(roots, budget)
        if report['mod_inventory_before'] != manifest['mod_inventory']:
            raise ValueError('MOD_BASELINE_CHANGED')
        check()
        target, row = fixed['root_asset'], report['root']
        row['target'] = target
        report['root_finds'] += 1
        obj = api.find_asset(target['object_path'], follow_redirectors=False)
        check()
        if not base.object_identity(obj, target, row):
            raise ValueError('EXACT_ROOT_UNAVAILABLE_UNKNOWN')
        retained.append((target, obj))
        check()
        report['root_finds'] += 1
        current = api.find_asset(target['object_path'], follow_redirectors=False)
        if not base.object_identity(current, target, row) or current != obj:
            raise ValueError('ROOT_REFERENCE_CHANGED_UNKNOWN')
        check()
        for target in fixed['targets']:
            check()
            record = {'target': target, 'status': 'QUERY_STARTED'}
            report['queries'].append(record)
            report['subobject_finds'] += 1
            obj = api.find_object(None, target['object_path'], follow_redirectors=False)
            if not base.object_identity(obj, target, record):
                raise ValueError('TEMPLATE_MISSING_UNKNOWN')
            retained.append((target, obj))
            objects.append((target, obj, record))
            check()
        exporter = api.ObjectExporterT3D()
        formats = list(itertools.islice(exporter.get_editor_property('format_extension'), 16))
        extension = next((str(v) for p in ('copy', 't3d') for v in formats if str(v).casefold() == p), None)
        if not exporter.get_editor_property('text') or extension is None:
            raise ValueError('TEXT_EXPORTER_UNAVAILABLE')
        for number, (target, obj, record) in enumerate(objects, 1):
            check()
            exact_path(output, directory=True)
            destination = output / (target['label'] + '.' + extension)
            if destination.exists() or destination.is_symlink():
                raise ValueError('EXPORT_DESTINATION_ALREADY_EXISTS')
            task = api.AssetExportTask()
            for key, value in {'object': obj, 'exporter': exporter, 'filename': str(destination), 'automated': True,
                               'prompt': False, 'replace_identical': False, 'selected': False,
                               'use_file_archive': False, 'write_empty_files': False}.items():
                task.set_editor_property(key, value)
            record['export_status'] = 'STARTED'
            receipt('before-export-' + str(number) + '.json')
            check()
            report['exports'] += 1
            success = bool(api.Exporter.run_asset_export_task(task))
            record['exporter_errors'] = [str(v)[:512] for v in itertools.islice(task.get_editor_property('errors'), 20)]
            raw, record['export'] = base.file_record(destination, LIMITS['export_bytes'])
            report['exported_bytes'] += len(raw)
            if not raw or not success or record['exporter_errors']:
                raise ValueError('EXPORT_FAILED_OR_ERRORS')
            check()
            index = final.inventory(raw, target['name'], target['class_path'])
            index['reference_interpretation'] = 'LEXICAL_ONLY_NOT_RESOLVED_REFERENCES'
            index['fixed_inventory_references'] = [
                {'path': candidate['text'], 'status': 'EXACT_INVENTORY_IDENTITY_OBSERVED' if any(
                    t['object_path'] == candidate['text'] for t, _ in retained) else 'UNKNOWN_NOT_QUERIED'}
                for candidate in index['path_candidates']]
            record['inventory'] = write_json(target['label'] + '-inventory.json', index, LIMITS['export_bytes'])
            report['inventory_bytes'] += record['inventory']['bytes']
            record['export_status'] = 'EXPORTED_REQUIRES_REVIEW'
            check()
        if (report['root_finds'], report['subobject_finds'], report['exports']) != (2, 5, 5):
            raise ValueError('INCOMPLETE_FIXED_INSPECTION')
        report.update(status='COLLECTED_REQUIRES_REVIEW', native_inspection='PERFORMED' if native else 'NOT_PERFORMED')
    except Exception as exc:
        report['status'] = 'STOPPED_PARTIAL_REQUIRES_REVIEW'
        report['errors'].append(type(exc).__name__ + ': ' + str(exc)[:1024])
        report['native_inspection'] = 'ATTEMPTED_PARTIAL' if native else 'NOT_PERFORMED'
    finally:
        # Local-only verification; never restore assets/markers or keep UObjects
        # in a module/API variable for a later selection phase.
        retained.clear()
        objects.clear()
        try:
            for label, snapshot in (
                    ('protected_unchanged', lambda: all(row['matches'] for row in base.protected_snapshot(manifest['protected_files']))),
                    ('selection_unchanged', lambda: base.selection_snapshot(manifest['selection']) == manifest['selection'])):
                try:
                    report[label] = snapshot()
                except Exception as exc:
                    report[label] = 'UNKNOWN'
                    report['errors'].append(label + '_READ_FAILED: ' + str(exc)[:512])
            try:
                report['mod_inventory_after'] = phase_helper.snapshot_mod_roots(roots, budget)
                changes = phase_helper.inventory_changes(manifest['mod_inventory'], report['mod_inventory_after'])
                report['mod_inventory_changes'] = changes
                report['mod_inventory_unchanged'] = not any(changes.values())
                guard()
            except Exception as exc:
                report['mod_inventory_unchanged'] = 'UNKNOWN'
                report['errors'].append('FINAL_VERIFICATION_FAILED: ' + str(exc)[:1024])
            if any(report.get(k) is not True for k in ('protected_unchanged', 'selection_unchanged', 'mod_inventory_unchanged')):
                report['status'] = 'STOPPED_FINAL_VERIFICATION_REQUIRES_REVIEW'
            if owns_output:
                receipt('report.json')
        finally:
            if getattr(api, base.ACTIVE_KEY, None) == token:
                delattr(api, base.ACTIVE_KEY)
            if lock.exists() and lock.read_text(encoding='ascii') == token:
                lock.unlink()
    return report



def run_mock(api, manifest, attempt, roots, health_query, clock=time.monotonic, guard=lambda: None):
    """Exercise export protocol only. Full native evidence admission is not implied."""
    return execute(load_base(), load_phase(), api, manifest, Path(attempt), roots,
                   health_query, clock, False, guard)


def run_native(api, manifest_path=None, manifest_sha256=None):
    """Dormant entry, admitted only by freshly pinned source/transition/log evidence."""
    started, last = time.monotonic(), [None]
    admitting = [True]

    def admission_budget():
        current = time.monotonic()
        if not math.isfinite(current) or (last[0] is not None and current < last[0]):
            raise ValueError('ADMISSION_MONOTONIC_CLOCK_DISCONTINUITY')
        last[0] = current
        if current - started > LIMITS['seconds']:
            raise ValueError('COOPERATIVE_ADMISSION_TIME_STOP')

    phase, base = load_phase(), load_base()
    admission_budget()
    if ROOT.resolve() != base.EXPECTED_ROOT.resolve() or getattr(api, '__name__', None) != 'unreal':
        raise ValueError('EXACT_PROJECT_EDITOR_REQUIRED')
    if not isinstance(manifest_sha256, str) or not re.fullmatch(r'[0-9a-f]{64}', manifest_sha256):
        raise ValueError('DORMANT_REVIEWED_MANIFEST_PIN_REQUIRED')
    path = exact_path(manifest_path)
    if path.parent.parent != ROOT / 'research/evidence' or path.name != 'diagnostic-manifest.json':
        raise ValueError('EXACT_NEW_MANIFEST_DIRECTORY_REQUIRED')
    manifest = json.loads(base.pinned_bytes(path, manifest_sha256, LIMITS['receipt_bytes']))
    attempt = path.parent
    identity = base.process_identity()
    now = datetime.datetime.now(datetime.timezone.utc)
    validate(base, phase, manifest, identity, now)
    if attempt.name != manifest['attempt_id']:
        raise ValueError('NEW_ATTEMPT_DIRECTORY_IDENTITY_MISMATCH')
    if manifest['helper_sha256'] != base.file_record(Path(__file__))[1]['sha256']:
        raise ValueError('REVIEWED_INSPECTOR_PIN_MISMATCH')
    entry = manifest.get('entry_file')
    if not isinstance(entry, dict) or Path(entry.get('path', '')) != attempt / 'run-diagnostic.py':
        raise ValueError('EXACT_NEW_ENTRY_REQUIRED')
    if manifest.get('dispatcher') != {'path': str(attempt / 'dispatch-diagnostic.py'), 'format_version': 1}:
        raise ValueError('EXACT_DERIVED_DISPATCHER_REQUIRED')
    evidence = load_module(EVIDENCE, manifest['evidence_helper_sha256'], '_postreload_evidence')
    admission_budget()

    def guard():
        if admitting[0]:
            admission_budget()
        if (attempt / 'STOP').exists():
            raise ValueError('USER_STOP')
        base.pinned_bytes(path, manifest_sha256, LIMITS['receipt_bytes'])
        for helper, digest in ((Path(__file__), manifest['helper_sha256']), (EVIDENCE, manifest['evidence_helper_sha256']),
                               (BASE, BASE_SHA), (PHASE, PHASE_SHA)):
            exact_path(helper)
            base.pinned_bytes(helper, digest)
        read_pin(base, phase, entry, LIMITS['receipt_bytes'])
        for name, digest in base.UTILITY_PINS:
            base.pinned_bytes(ROOT / 'scripts' / name, digest)
        if base.process_identity() != identity:
            raise ValueError('EDITOR_PROCESS_IDENTITY_CHANGED')
        validate(base, phase, manifest, identity, datetime.datetime.now(datetime.timezone.utc))
        validate_editor_artifacts(base, phase, manifest)
        validate_implementation_review(base, phase, manifest, attempt)
        predecessor = evidence.validate_predecessor(base, phase, manifest, identity)
        selection = evidence.validate_transition(base, phase, manifest, identity, transition='selection')
        dispatch = evidence.validate_live_dispatch_log(base, phase, manifest, identity)
        if admitting[0]:
            admission_budget()
        return {'predecessor': predecessor, 'selection': selection, 'dispatch': dispatch}

    guard()
    roots = phase.mod_roots(base)
    inventory = phase.snapshot_mod_roots(roots, admission_budget)
    if inventory != manifest['mod_inventory']:
        raise ValueError('MOD_BASELINE_CHANGED_BEFORE_DISPATCH')
    if not all(row['matches'] for row in base.protected_snapshot(manifest['protected_files'])):
        raise ValueError('PROTECTED_INPUT_CHANGED_BEFORE_DISPATCH')
    if base.selection_snapshot(manifest['selection']) != manifest['selection']:
        raise ValueError('SELECTION_CHANGED_BEFORE_DISPATCH')
    guard()
    _, common = base.utilities()
    health = common.health(attempt)
    if (type(health.get('disk_free')) not in (int, float) or not math.isfinite(health['disk_free'])
            or health['disk_free'] < LIMITS['disk_free_bytes']):
        raise ValueError('DISK_RESOURCE_STOP_BEFORE_DISPATCH')
    guard()
    admission_budget()
    admitting[0] = False
    # execute starts its own 90-second inspection budget and claims under lock.
    return execute(base, phase, api, manifest, attempt, roots, common.health, time.monotonic, True,
                   guard, _admission=_NATIVE_ADMISSION_TOKEN, _manifest_sha256=manifest_sha256)


if __name__ == '__main__':
    raise SystemExit('DORMANT: no automatic execution; fresh independently reviewed manifest/entry/transition evidence required.')
