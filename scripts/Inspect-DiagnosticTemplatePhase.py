"""Dormant one-phase template inspector; never changes Active Mod selection.

Stock and diagnostic run separately, sharing only pinned evidence files. Stock
is already-loaded-only. Diagnostic may load its one exact Blueprint once after
a separately reviewed selection receipt. No mount-registry or reference-health
claim is made. Synchronous engine calls have cooperative, not hard, limits.
"""
import datetime
import hashlib
import importlib.util
import itertools
import json
import os
from pathlib import Path, PurePosixPath
import re
import sys
import time
import uuid

ROOT = Path(__file__).resolve().parent.parent
BASE = ROOT / 'scripts/Inspect-DiagnosticTemplates.py'
BASE_SHA = '8b92919782afdc799b2c415d7c18cba0282be24e0bf7c698e9a54500ecb018fd'
MOD_NAMES = ('LanceObserverProbe', 'LanceObserverDiagnosticControl')
EMPTY_SHA = hashlib.sha256(b'').hexdigest()
LIMITS = {'root_finds': 2, 'diagnostic_root_loads': 1, 'subobject_finds': 5,
          'exports': 5, 'seconds': 90, 'export_bytes': 1024**2,
          'raw_bytes': 8 * 1024**2, 'inventory_bytes': 8 * 1024**2,
          'receipt_bytes': 128 * 1024, 'outer_depth': 8, 'lexical_depth': 16,
          'disk_free_bytes': 2 * 1024**3, 'mod_files': 256,
          'mod_total_bytes': 512 * 1024**2, 'mod_directories': 1024,
          'capture_bytes': 8 * 1024**2, 'log_span_bytes': 256 * 1024}


def load_base():
    if hashlib.sha256(BASE.read_bytes()).hexdigest() != BASE_SHA:
        raise ValueError('BASE_HELPER_PIN_MISMATCH')
    spec = importlib.util.spec_from_file_location('_phase_template_primitives', BASE)
    base = importlib.util.module_from_spec(spec)
    prior = sys.dont_write_bytecode
    try:
        sys.dont_write_bytecode = True
        spec.loader.exec_module(base)
    finally:
        sys.dont_write_bytecode = prior
    return base


def plan(base, phase):
    if phase not in ('stock', 'diagnostic'):
        raise ValueError('FIXED_PHASE_REQUIRED')
    prefix = base.PREFIXES[phase]
    return {'phase': phase, 'targets': [dict(t) for t in base.TARGETS if t['scope'] == phase],
            'root_asset': {'label': phase, 'scope': phase, 'name': 'InstantActionPlayerController',
                           'object_path': prefix[:-2], 'class_path': '/Script/Engine.Blueprint',
                           'outer_path': prefix.split('.')[0]},
            'allow_load': False, 'allow_exact_root_load': phase == 'diagnostic',
            'limits': dict(LIMITS)}


def mod_roots(base):
    return [base.EDITOR_EXE.parents[3] / 'MW5Mercs/Plugins' / name for name in MOD_NAMES]


def expected_selection(roots, phase):
    if phase not in ('stock', 'diagnostic'):
        raise ValueError('FIXED_PHASE_REQUIRED')
    active = 0 if phase == 'stock' else 1
    return [dict(path=str(root / 'ActiveMod.txt'), present=i == active,
                 **({'bytes': 0, 'sha256': EMPTY_SHA} if i == active else {}))
            for i, root in enumerate(roots)]


def regular_path(path):
    stat = path.lstat()
    if path.is_symlink() or getattr(stat, 'st_file_attributes', 0) & 0x400:
        raise ValueError('REDIRECTED_MOD_PATH')
    return stat


def snapshot_mod_roots(roots, budget=lambda: None):
    """Bound the whole two-root inventory, including otherwise unpinned files."""
    result, file_count, byte_count, directory_count = [], 0, 0, 0
    signature = lambda s: (s.st_dev, s.st_ino, s.st_size, s.st_mtime_ns)
    for root in roots:
        root = Path(root)
        regular_path(root)
        if not root.is_dir() or root.resolve() != root.absolute():
            raise ValueError('EXACT_MOD_DIRECTORY_REQUIRED')
        rows, pending = [], [root]
        while pending:
            budget()
            directory = pending.pop()
            directory_count += 1
            if directory_count > LIMITS['mod_directories']:
                raise ValueError('MOD_DIRECTORY_LIMIT')
            with os.scandir(str(directory)) as entries:
                for entry in entries:
                    budget()
                    path = Path(entry.path)
                    stat = regular_path(path)
                    if entry.is_dir(follow_symlinks=False):
                        pending.append(path)
                        if directory_count + len(pending) > LIMITS['mod_directories']:
                            raise ValueError('MOD_DIRECTORY_LIMIT')
                        continue
                    if not entry.is_file(follow_symlinks=False):
                        raise ValueError('NONREGULAR_MOD_FILE')
                    file_count += 1
                    byte_count += stat.st_size
                    if file_count > LIMITS['mod_files'] or byte_count > LIMITS['mod_total_bytes']:
                        raise ValueError('MOD_INVENTORY_LIMIT')
                    digest, count = hashlib.sha256(), 0
                    with path.open('rb') as stream:
                        before = os.fstat(stream.fileno())
                        while True:
                            budget()
                            raw = stream.read(min(1024**2, stat.st_size - count + 1))
                            if not raw:
                                break
                            count += len(raw)
                            if count > stat.st_size:
                                raise ValueError('MOD_FILE_CHANGED_DURING_READ')
                            digest.update(raw)
                        after = os.fstat(stream.fileno())
                    if (count != stat.st_size or signature(stat) != signature(before)
                            or signature(before) != signature(after) or signature(after) != signature(path.stat())):
                        raise ValueError('MOD_FILE_CHANGED_DURING_READ')
                    rows.append({'path': path.relative_to(root).as_posix(), 'bytes': count,
                                 'sha256': digest.hexdigest()})
        result.append({'root': str(root), 'files': sorted(rows, key=lambda row: row['path'])})
    return result


def inventory_changes(before, after):
    def flat(snapshot):
        return {(root['root'], row['path']): row for root in snapshot for row in root['files']}
    left, right = flat(before), flat(after)
    key = lambda item: {'root': item[0], 'path': item[1]}
    return {'added': [key(k) for k in sorted(right.keys() - left.keys())],
            'removed': [key(k) for k in sorted(left.keys() - right.keys())],
            'changed': [key(k) for k in sorted(left.keys() & right.keys()) if left[k] != right[k]]}


def validate_mod_inventory(inventory, roots, selection):
    """Reject absent, ambiguous or unbounded manifests before any dispatch claim."""
    if not isinstance(inventory, list) or len(inventory) != 2:
        raise ValueError('COMPLETE_MOD_INVENTORY_REQUIRED')
    count, total = 0, 0
    for group, root, marker in zip(inventory, roots, selection):
        if (not isinstance(group, dict) or set(group) != {'root', 'files'}
                or group['root'] != str(root) or not isinstance(group['files'], list)):
            raise ValueError('EXACT_MOD_INVENTORY_ROOTS_REQUIRED')
        names, folded = [], set()
        marker_file = None
        for row in group['files']:
            if not isinstance(row, dict) or set(row) != {'path', 'bytes', 'sha256'}:
                raise ValueError('MOD_INVENTORY_ROW_SCHEMA')
            name = row['path']
            if (not isinstance(name, str) or not name or len(name) > 2048
                    or '\\' in name or ':' in name or PurePosixPath(name).is_absolute()
                    or any(p in ('', '.', '..') or p.rstrip(' .') != p for p in name.split('/'))
                    or any(ord(c) < 32 for c in name) or name.casefold() in folded):
                raise ValueError('UNIQUE_RELATIVE_MOD_PATH_REQUIRED')
            if (type(row['bytes']) is not int or row['bytes'] < 0
                    or not isinstance(row['sha256'], str) or not re.fullmatch(r'[0-9a-f]{64}', row['sha256'])):
                raise ValueError('MOD_INVENTORY_FILE_PIN_REQUIRED')
            names.append(name)
            folded.add(name.casefold())
            count += 1
            total += row['bytes']
            if count > LIMITS['mod_files'] or total > LIMITS['mod_total_bytes']:
                raise ValueError('MOD_INVENTORY_LIMIT')
            if name.casefold() == 'activemod.txt':
                marker_file = row
        if names != sorted(names):
            raise ValueError('SORTED_MOD_INVENTORY_REQUIRED')
        expected_marker = {'path': 'ActiveMod.txt', 'bytes': 0, 'sha256': EMPTY_SHA} if marker['present'] else None
        if marker_file != expected_marker:
            raise ValueError('MOD_INVENTORY_SELECTION_MISMATCH')


def validate(base, manifest, identity, now):
    if manifest.get('schema_version') != 1 or manifest.get('status') != 'REVIEWED_NATIVE_READY':
        raise ValueError('NATIVE_REVIEW_REQUIRED')
    fixed = plan(base, manifest.get('phase'))
    if any(manifest.get(key) != value for key, value in fixed.items()):
        raise ValueError('FIXED_PHASE_SCOPE_REQUIRED')
    if manifest.get('allow_load') is not False or manifest.get('allow_exact_root_load') is not (manifest['phase'] == 'diagnostic'):
        raise ValueError('EXPLICIT_PHASE_LOAD_DECISION_REQUIRED')
    if manifest.get('editor_identity') != identity or Path(identity['executable']).resolve() != base.EDITOR_EXE.resolve():
        raise ValueError('FRESH_EDITOR_IDENTITY_MISMATCH')
    stamp = datetime.datetime.fromisoformat(manifest['reviewed_at_utc'].replace('Z', '+00:00'))
    if (not 0 <= (now - stamp).total_seconds() <= 600 or manifest.get('native_owner_confirmed') is not True
            or any(not isinstance(manifest.get(k), str) or not 0 < len(manifest[k].strip()) <= 2048
                   for k in ('native_owner', 'owner_evidence', 'authorization_evidence'))):
        raise ValueError('FRESH_OWNER_AND_SCOPE_REVIEW_REQUIRED')
    if not re.fullmatch(r'diagnostic-template-selection-\d{8}T\d{6}Z-[0-9a-f]{8}', manifest.get('attempt_id', '')):
        raise ValueError('EXACT_ATTEMPT_REQUIRED')
    if manifest.get('base_helper_sha256') != BASE_SHA:
        raise ValueError('BASE_MANIFEST_PIN_MISMATCH')
    if manifest.get('selection') != expected_selection(mod_roots(base), manifest['phase']):
        raise ValueError('PHASE_SELECTION_SCOPE_MISMATCH')
    validate_mod_inventory(manifest.get('mod_inventory'), mod_roots(base), manifest['selection'])
    if manifest['phase'] == 'stock' and (manifest.get('stock_evidence') is not None or manifest.get('selection_receipt') is not None):
        raise ValueError('STOCK_MUST_PRECEDE_SELECTION')


def read_record(base, record, limit):
    if (not isinstance(record, dict) or set(record) != {'path', 'bytes', 'sha256'}
            or not isinstance(record['path'], str) or type(record['bytes']) is not int
            or not 0 <= record['bytes'] <= limit or not isinstance(record['sha256'], str)
            or not re.fullmatch(r'[0-9a-f]{64}', record['sha256'])):
        raise ValueError('BOUNDED_EVIDENCE_PIN_REQUIRED')
    path = Path(record['path'])
    if path.resolve() != path.absolute():
        raise ValueError('EVIDENCE_PATH_REDIRECTED')
    raw, actual = base.file_record(path, limit)
    if actual != record:
        raise ValueError('EVIDENCE_PIN_MISMATCH')
    return raw


def validate_selection_evidence(base, manifest, saved, receipt, attempt):
    """Hash the observed evidence behind attestations; do not interpret UI text."""
    evidence = receipt.get('evidence')
    if not isinstance(evidence, dict) or set(evidence) != {'stock_review', 'ui_captures', 'log_spans'}:
        raise ValueError('SELECTION_SUPPORTING_EVIDENCE_REQUIRED')

    def read(pin, limit):
        if not isinstance(pin, dict) or not isinstance(pin.get('path'), str):
            raise ValueError('BOUNDED_EVIDENCE_PIN_REQUIRED')
        path = Path(pin['path'])
        try:
            path.relative_to(attempt.parent)
        except ValueError:
            raise ValueError('LOCAL_SELECTION_EVIDENCE_REQUIRED')
        return read_record(base, pin, limit)

    review_raw = read(evidence['stock_review'], LIMITS['receipt_bytes'])
    if Path(evidence['stock_review']['path']) != attempt / 'stock-independent-review.json':
        raise ValueError('EXACT_INDEPENDENT_STOCK_REVIEW_REQUIRED')
    review = json.loads(review_raw)
    required = {'status': 'PASS_STOCK_SOURCE_AND_LOG_REVIEW', 'editor_identity': manifest['editor_identity'],
                'stock_report_sha256': manifest['stock_evidence']['sha256'],
                'source_review_passed': True, 'log_review_passed': True}
    if (any(review.get(k) != v for k, v in required.items()) or not isinstance(review.get('reviewer'), str)
            or not 0 < len(review['reviewer'].strip()) <= 2048):
        raise ValueError('INDEPENDENT_STOCK_REVIEW_IDENTITY_MISMATCH')
    captures = evidence['ui_captures']
    if not isinstance(captures, list) or len(captures) != 2:
        raise ValueError('BEFORE_AFTER_SELECTION_CAPTURES_REQUIRED')
    earliest = datetime.datetime.fromisoformat(saved['reviewed_at_utc'].replace('Z', '+00:00'))
    latest = datetime.datetime.fromisoformat(manifest['reviewed_at_utc'].replace('Z', '+00:00'))
    for item, role in zip(captures, ('before_selection', 'after_selection')):
        if not isinstance(item, dict) or set(item) != {'role', 'capture', 'receipt'} or item['role'] != role:
            raise ValueError('EXACT_CAPTURE_ROLES_REQUIRED')
        read(item['capture'], LIMITS['capture_bytes'])
        capture = json.loads(read(item['receipt'], LIMITS['receipt_bytes']))
        identity = capture.get('identity', {})
        expected = manifest['editor_identity']
        if (capture.get('image') != item['capture']['path'] or capture.get('sha256') != item['capture']['sha256']
                or identity.get('pid') != expected['pid'] or identity.get('process') != expected['executable']
                or str(identity.get('process_created')) != expected['creation_filetime']):
            raise ValueError('CAPTURE_PROCESS_OR_IMAGE_PIN_MISMATCH')
        stamp = datetime.datetime.fromisoformat(capture['created_utc'].replace('Z', '+00:00'))
        if not earliest <= stamp <= latest:
            raise ValueError('CAPTURE_OUTSIDE_REVIEWED_PHASE_ORDER')
        earliest = stamp
    spans = evidence['log_spans']
    if not isinstance(spans, list) or len(spans) != 2:
        raise ValueError('STOCK_AND_SELECTION_LOG_SPANS_REQUIRED')
    previous_end, source = None, None
    for item, role in zip(spans, ('stock_inspection', 'selection')):
        if (not isinstance(item, dict) or set(item) != {'role', 'file', 'source_log_path', 'start_byte', 'end_byte'}
                or item['role'] != role or type(item['start_byte']) is not int or type(item['end_byte']) is not int
                or not 0 <= item['start_byte'] <= item['end_byte']
                or not isinstance(item['source_log_path'], str) or not Path(item['source_log_path']).is_absolute()):
            raise ValueError('BOUNDED_ATTRIBUTABLE_LOG_SPAN_REQUIRED')
        raw = read(item['file'], LIMITS['log_span_bytes'])
        if len(raw) != item['end_byte'] - item['start_byte']:
            raise ValueError('LOG_SPAN_OFFSETS_MISMATCH')
        if previous_end is not None and (source != item['source_log_path'] or previous_end > item['start_byte']):
            raise ValueError('LOG_SOURCE_OR_ORDER_CHANGED')
        previous_end, source = item['end_byte'], item['source_log_path']


def validate_stock_evidence(base, manifest, attempt):
    """Validate only completed files; never retain/reacquire stock UObjects."""
    record = manifest['stock_evidence']
    if Path(record['path']) != attempt / 'stock/report.json':
        raise ValueError('EXACT_STOCK_RECEIPT_REQUIRED')
    stock = json.loads(read_record(base, record, LIMITS['receipt_bytes']))
    if (stock.get('phase') != 'stock' or stock.get('classification') != 'EDITOR_SOURCE_REQUIRES_REVIEW'
            or stock.get('native_inspection') != 'PERFORMED' or stock.get('status') != 'COLLECTED_REQUIRES_REVIEW'
            or stock.get('attempt_id') != manifest['attempt_id'] or stock.get('editor_identity') != manifest['editor_identity']
            or stock.get('protected_unchanged') is not True or stock.get('selection_unchanged') is not True
            or stock.get('mod_inventory_unchanged') is not True or stock.get('errors') != []):
        raise ValueError('COMPLETE_SAME_PROCESS_STOCK_EVIDENCE_REQUIRED')
    saved = stock['manifest']
    for key in ('helper_sha256', 'base_helper_sha256', 'protected_files', 'editor_identity', 'attempt_id'):
        if saved.get(key) != manifest.get(key):
            raise ValueError('STOCK_CHECKPOINT_IDENTITY_MISMATCH')
    for key, value in plan(base, 'stock').items():
        if saved.get(key) != value:
            raise ValueError('STOCK_FIXED_SCOPE_MISMATCH')
    if saved.get('selection') != expected_selection(mod_roots(base), 'stock'):
        raise ValueError('STOCK_SELECTION_EVIDENCE_MISMATCH')
    validate_mod_inventory(saved.get('mod_inventory'), mod_roots(base), saved['selection'])
    validate_mod_inventory(manifest.get('mod_inventory'), mod_roots(base), manifest['selection'])
    root, expected_root = stock.get('root', {}), plan(base, 'stock')['root_asset']
    if (root.get('target') != expected_root or root.get('status') != 'EXACT_IDENTITY_OBSERVED'
            or root.get('observed_path') != expected_root['object_path']
            or root.get('observed_class') != expected_root['class_path'] or root.get('load_calls') != 0
            or stock.get('root_finds') != 2 or len(root.get('outer_chain', [])) < 2
            or root['outer_chain'][1] != expected_root['outer_path']
            or any('/ModOverride/' in name for name in root['outer_chain'])):
        raise ValueError('STOCK_ROOT_IDENTITY_EVIDENCE_MISMATCH')
    targets = plan(base, 'stock')['targets']
    if [row.get('target') for row in stock.get('queries', [])] != targets:
        raise ValueError('COMPLETE_FIVE_STOCK_OBJECTS_REQUIRED')
    for row in stock['queries']:
        if row.get('export_status') != 'EXPORTED_REQUIRES_REVIEW':
            raise ValueError('STOCK_EXPORT_REQUIRED')
        target = row['target']
        if (row.get('status') != 'EXACT_IDENTITY_OBSERVED' or row.get('observed_path') != target['object_path']
                or row.get('observed_class') != target['class_path']
                or len(row.get('outer_chain', [])) < 2 or row['outer_chain'][1] != target['outer_path']
                or any('/ModOverride/' in name for name in row['outer_chain'])):
            raise ValueError('STOCK_OBJECT_IDENTITY_EVIDENCE_MISMATCH')
        for kind in ('export', 'inventory'):
            pin = row[kind]
            path = Path(pin['path'])
            if path.parent != attempt / 'stock':
                raise ValueError('STOCK_EXPORT_PATH_MISMATCH')
            read_record(base, pin, LIMITS['export_bytes'])
    changes = inventory_changes(saved['mod_inventory'], manifest['mod_inventory'])
    expected = {'added': [{'root': str(mod_roots(base)[1]), 'path': 'ActiveMod.txt'}],
                'removed': [{'root': str(mod_roots(base)[0]), 'path': 'ActiveMod.txt'}], 'changed': []}
    if changes != expected:
        raise ValueError('UNEXPECTED_BETWEEN_PHASE_FILE_CHANGE')
    receipt_pin = manifest['selection_receipt']
    if Path(receipt_pin['path']) != attempt / 'selection-review.json':
        raise ValueError('EXACT_SELECTION_REVIEW_REQUIRED')
    receipt = json.loads(read_record(base, receipt_pin, LIMITS['receipt_bytes']))
    required = {'status': 'REVIEWED_SELECTION_ONLY', 'editor_identity': manifest['editor_identity'],
                'stock_report_sha256': record['sha256'], 'selection': manifest['selection'],
                'mod_inventory': manifest['mod_inventory'], 'protected_unchanged': True,
                'stock_source_review_passed': True, 'stock_log_review_passed': True,
                'unexpected_dialog_reload_warning_save_compile': False, 'exclusive_owner_confirmed': True}
    if any(receipt.get(k) != v for k, v in required.items()):
        raise ValueError('SELECTION_TRANSITION_REVIEW_REQUIRED')
    validate_selection_evidence(base, manifest, saved, receipt, attempt)


def execute(base, api, manifest, attempt, roots, health_query, clock, native, guard=lambda: None):
    if not native and getattr(api, '__name__', None) == 'unreal':
        raise ValueError('REAL_API_FORBIDDEN_IN_MOCK')
    phase = manifest['phase']
    fixed = plan(base, phase)
    if any(manifest.get(k) != v for k, v in fixed.items()):
        raise ValueError('FIXED_PHASE_SCOPE_REQUIRED')
    if manifest.get('selection') != expected_selection(roots, phase):
        raise ValueError('PHASE_SELECTION_SCOPE_MISMATCH')
    evidence = attempt.parent / 'editor-source'
    if not evidence.is_dir() or attempt.resolve() != attempt.absolute() or not attempt.is_dir():
        raise ValueError('PREPARED_ATTEMPT_DIRECTORY_REQUIRED')
    if (any(evidence.glob('.diagnostic-*.lock')) or any(evidence.glob('.observer-*.lock'))
            or any(getattr(api, key, None) is not None for key in (base.ACTIVE_KEY,) + base.OTHER_ACTIVE_KEYS)):
        raise RuntimeError('OTHER_INSPECTION_ACTIVE')
    final, _ = base.utilities()
    token, started = uuid.uuid4().hex, clock()
    output = attempt / phase
    lock = evidence / '.diagnostic-template-inspection.lock'
    report = {'classification': 'EDITOR_SOURCE_REQUIRES_REVIEW' if native else 'MOCK_ONLY',
              'native_inspection': 'STARTED' if native else 'NOT_PERFORMED',
              'phase': phase, 'attempt_id': manifest.get('attempt_id'), 'manifest': manifest,
              'editor_identity': manifest.get('editor_identity'), 'status': 'STARTED',
              'queries': [], 'errors': [], 'root': {'load_calls': 0},
              'root_finds': 0, 'exported_bytes': 0, 'inventory_bytes': 0,
              'output_directory': str(output), 'mount_registry_state': 'UNKNOWN_NOT_QUERIED',
              'explicit_asset_edit_save_compile_reload_selection_restart_cook_retail': 'NOT_PERFORMED',
              'limitations': ['Only exact name/class/outer accessibility is observed; no mount-registry proof.',
                              'Lexical references and omitted fields remain UNKNOWN; no dynamic reference loads.',
                              'Native calls and exporter size bounds are cooperative/post-call; cannot interrupt engine work.',
                              'Diagnostic load may trigger implicit dependencies and native post-load work.',
                              'No fixed RAM reserve; actual allocation failure stops. No UI rollback is automated.']}
    retained, objects, owns_output = [], [], False

    def write_json(name, data, limit):
        raw = (json.dumps(data, indent=2, ensure_ascii=True) + '\n').encode('utf-8')
        if len(raw) > limit:
            raise ValueError('JSON_OUTPUT_LIMIT')
        with (output / name).open('xb') as stream:
            stream.write(raw)
        return {'path': str(output / name), 'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()}

    def receipt(name):
        report['elapsed_seconds'] = round(clock() - started, 3)
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
        if clock() - started > LIMITS['seconds']:
            raise RuntimeError('COOPERATIVE_TIME_STOP')

    def check():
        budget()
        guard()
        report['last_health'] = health_query(attempt)
        budget()
        if report['last_health']['disk_free'] < LIMITS['disk_free_bytes']:
            raise RuntimeError('DISK_RESOURCE_STOP')
        if not all(row['matches'] for row in base.protected_snapshot(manifest['protected_files'])):
            raise ValueError('PROTECTED_INPUT_CHANGED')
        if base.selection_snapshot(manifest['selection']) != manifest['selection']:
            raise ValueError('SELECTION_CHANGED')
        for target, obj in retained:
            base.object_identity(obj, target, {})
        if report['exported_bytes'] > LIMITS['raw_bytes'] or report['inventory_bytes'] > LIMITS['inventory_bytes']:
            raise ValueError('AGGREGATE_OUTPUT_LIMIT')
        budget()

    with lock.open('x', encoding='ascii') as stream:
        stream.write(token)
    try:
        setattr(api, base.ACTIVE_KEY, token)
        output.mkdir(exist_ok=False)
        owns_output = True
        receipt('started.json')
        check()
        report['mod_inventory_before'] = snapshot_mod_roots(roots, budget)
        if report['mod_inventory_before'] != manifest['mod_inventory']:
            raise ValueError('MOD_BASELINE_CHANGED')
        check()
        target, row = fixed['root_asset'], report['root']
        row['target'] = target
        report['root_finds'] += 1
        obj = api.find_asset(target['object_path'], follow_redirectors=False)
        check()
        if obj is None and phase == 'diagnostic':
            receipt('before-diagnostic-load.json')
            check()
            row['load_calls'] += 1
            obj = api.load_asset(target['object_path'], follow_redirectors=False)
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
            destination = output / (target['label'] + '.' + extension)
            task = api.AssetExportTask()
            for key, value in {'object': obj, 'exporter': exporter, 'filename': str(destination), 'automated': True,
                               'prompt': False, 'replace_identical': False, 'selected': False,
                               'use_file_archive': False, 'write_empty_files': False}.items():
                task.set_editor_property(key, value)
            record['export_status'] = 'STARTED'
            receipt('before-export-' + str(number) + '.json')
            check()
            success = bool(api.Exporter.run_asset_export_task(task))
            record['exporter_errors'] = [str(v)[:512] for v in itertools.islice(task.get_editor_property('errors'), 20)]
            raw, record['export'] = base.file_record(destination, LIMITS['export_bytes'])
            report['exported_bytes'] += len(raw)
            if not success or record['exporter_errors']:
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
                report['mod_inventory_after'] = snapshot_mod_roots(roots, budget)
                changes = inventory_changes(manifest['mod_inventory'], report['mod_inventory_after'])
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


def run_mock(api, manifest, attempt, roots, health_query, clock=time.monotonic):
    return execute(load_base(), api, manifest, Path(attempt), roots, health_query, clock, False)


def run_native(api, manifest_path=None, manifest_sha256=None):
    base = load_base()
    if ROOT.resolve() != base.EXPECTED_ROOT.resolve() or getattr(api, '__name__', None) != 'unreal':
        raise ValueError('EXACT_PROJECT_EDITOR_REQUIRED')
    if not isinstance(manifest_sha256, str) or not re.fullmatch(r'[0-9a-f]{64}', manifest_sha256):
        raise ValueError('DORMANT_REVIEWED_MANIFEST_PIN_REQUIRED')
    path = Path(manifest_path)
    if path.resolve() != path.absolute() or path.parent.parent != ROOT / 'research/evidence':
        raise ValueError('EXACT_MANIFEST_DIRECTORY_REQUIRED')
    manifest = json.loads(base.pinned_bytes(path, manifest_sha256, LIMITS['receipt_bytes']))
    identity, now = base.process_identity(), datetime.datetime.now(datetime.timezone.utc)
    validate(base, manifest, identity, now)
    phase, attempt = manifest['phase'], path.parent
    if attempt.name != manifest['attempt_id'] or path.name != phase + '-manifest.json':
        raise ValueError('EXACT_PHASE_MANIFEST_REQUIRED')
    if manifest['protected_files'] != base.fixed_protected_inputs():
        raise ValueError('PROTECTED_SCOPE_MISMATCH')
    helper_sha = base.file_record(Path(__file__))[1]['sha256']
    if manifest.get('helper_sha256') != helper_sha:
        raise ValueError('REVIEWED_HELPER_PIN_MISMATCH')
    entry = manifest['entry_file']
    if Path(entry['path']) != attempt / ('run-' + phase + '.py'):
        raise ValueError('EXACT_ENTRY_FILE_REQUIRED')

    def guard():
        base.pinned_bytes(path, manifest_sha256, LIMITS['receipt_bytes'])
        base.pinned_bytes(Path(__file__), helper_sha)
        base.pinned_bytes(BASE, BASE_SHA)
        read_record(base, entry, LIMITS['receipt_bytes'])
        for name, sha in base.UTILITY_PINS:
            base.pinned_bytes(ROOT / 'scripts' / name, sha)
        if phase == 'diagnostic':
            validate_stock_evidence(base, manifest, attempt)

    guard()
    # Shape and fresh file comparison precede the persistent claim. Missing or
    # stale inventory must not consume a one-use phase just to be rejected later.
    admission_started = time.monotonic()

    def admission_budget():
        if (attempt / 'STOP').exists():
            raise RuntimeError('USER_STOP')
        if time.monotonic() - admission_started > LIMITS['seconds']:
            raise RuntimeError('COOPERATIVE_ADMISSION_TIME_STOP')

    actual_inventory = snapshot_mod_roots(mod_roots(base), admission_budget)
    if actual_inventory != manifest['mod_inventory']:
        raise ValueError('MOD_BASELINE_CHANGED_BEFORE_DISPATCH')
    guard()
    admission_budget()
    validate(base, manifest, identity, datetime.datetime.now(datetime.timezone.utc))
    # Exclusive, persistent per-phase claim: no replay after success or failure.
    with (attempt / (phase + '-native-dispatch-claim.json')).open('x', encoding='utf-8') as stream:
        json.dump({'manifest_sha256': manifest_sha256, 'editor_identity': identity, 'at_utc': now.isoformat()}, stream)
    _, common = base.utilities()
    return execute(base, api, manifest, attempt, mod_roots(base), common.health, time.monotonic, True, guard)


if __name__ == '__main__':
    raise SystemExit('DORMANT: review a separate phase manifest and exact entry before editor invocation.')
