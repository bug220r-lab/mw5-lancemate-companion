"""Offline evidence admission for the proposed post-reload experiment.

No Unreal import, UI action, asset load, mutation, or native dispatch lives here.
Passing these checks authenticates bounded files and their recorded observations;
it cannot authenticate a human's visual interpretation or prove live references.
Native pre-dispatch log continuity is deliberately a separate, strict operation.
"""
import datetime
import functools
import hashlib
import json
import math
import os
from pathlib import Path
import re
import stat
import sys

ROOT = Path(__file__).resolve().parent.parent
RECEIPT_BYTES = 128 * 1024
EXPORT_BYTES = 1024 * 1024
LOG_BYTES = 256 * 1024
CAPTURE_BYTES = 8 * 1024 * 1024
PREFIX_BYTES = 16 * 1024 * 1024
EMPTY_SHA = hashlib.sha256(b'').hexdigest()
ENGINE_VERSION = '4.26.2/CL14830424'
PROTOCOL = 'DIAGNOSTIC_POST_RELOAD_LOADED_ONLY_V1'
DIAGNOSTIC_PACKAGE = '/ModOverride/LanceObserverDiagnosticControl/Modes/InstantAction/InstantActionPlayerController'
STOCK_PACKAGE = '/Game/Modes/InstantAction/InstantActionPlayerController'


def require(test, message):
    if not test:
        raise ValueError(message)


def _fail_closed(function):
    @functools.wraps(function)
    def validate(*args, **kwargs):
        try:
            return function(*args, **kwargs)
        except ValueError:
            raise
        except (KeyError, TypeError, IndexError, AttributeError, OSError, OverflowError) as exc:
            raise ValueError('MALFORMED_OR_UNAVAILABLE_EVIDENCE: ' + type(exc).__name__) from exc
    return validate


def _text(value):
    return isinstance(value, str) and 0 < len(value.strip()) <= 2048


def _sha(value):
    return isinstance(value, str) and re.fullmatch(r'[0-9a-f]{64}', value) is not None


def _number(value):
    return type(value) in (int, float) and math.isfinite(value) and value >= 0


def _utc(value):
    require(isinstance(value, str), 'UTC_REQUIRED')
    try:
        result = datetime.datetime.fromisoformat(value.replace('Z', '+00:00'))
    except (ValueError, TypeError):
        raise ValueError('UTC_REQUIRED')
    require(result.tzinfo is not None and result.utcoffset() == datetime.timedelta(0), 'UTC_REQUIRED')
    return result


def _regular(path, directory=False):
    """Reject links/reparse points in every ancestor, not just the final file."""
    path = Path(path)
    require(path.is_absolute() and path.absolute() == path.resolve(), 'EXACT_UNREDIRECTED_PATH_REQUIRED')
    try:
        for part in [path] + list(path.parents):
            info = part.lstat()
            require(not stat.S_ISLNK(info.st_mode) and not getattr(info, 'st_file_attributes', 0) & 0x400,
                    'REDIRECTED_EVIDENCE_PATH')
        info = path.lstat()
    except OSError as exc:
        raise ValueError('EVIDENCE_FILE_UNAVAILABLE: ' + str(path)) from exc
    require(stat.S_ISDIR(info.st_mode) if directory else stat.S_ISREG(info.st_mode), 'REGULAR_EVIDENCE_REQUIRED')
    return info


def _inside(path, root):
    try:
        Path(path).relative_to(root)
    except ValueError:
        raise ValueError('EVIDENCE_OUTSIDE_APPROVED_ROOT')


def read_pin(pin, limit=RECEIPT_BYTES, exact=None, root=None):
    require(isinstance(pin, dict) and set(pin) == {'path', 'bytes', 'sha256'}, 'EXACT_FILE_PIN_REQUIRED')
    require(_text(pin['path']) and type(pin['bytes']) is int and 0 <= pin['bytes'] <= limit
            and _sha(pin['sha256']), 'BOUNDED_FILE_PIN_REQUIRED')
    path = Path(pin['path'])
    if exact is not None:
        require(path == Path(exact), 'EXACT_EVIDENCE_PATH_REQUIRED')
    _inside(path, root if root is not None else ROOT / 'research/evidence')
    before = _regular(path)
    try:
        with path.open('rb') as stream:
            opened = os.fstat(stream.fileno())
            raw = stream.read(limit + 1)
            closed = os.fstat(stream.fileno())
        after = path.stat()
    except OSError as exc:
        raise ValueError('EVIDENCE_READ_FAILED') from exc
    signature = lambda s: (s.st_dev, s.st_ino, s.st_size, s.st_mtime_ns)
    require(signature(before) == signature(opened) == signature(closed) == signature(after), 'EVIDENCE_CHANGED_DURING_READ')
    require(len(raw) == pin['bytes'] and hashlib.sha256(raw).hexdigest() == pin['sha256'], 'EVIDENCE_PIN_MISMATCH')
    return raw


def read_json(pin, **kwargs):
    def unique(pairs):
        result = {}
        for key, value in pairs:
            require(key not in result, 'DUPLICATE_EVIDENCE_JSON_KEY')
            result[key] = value
        return result
    try:
        return json.loads(read_pin(pin, **kwargs).decode('utf-8-sig'), object_pairs_hook=unique)
    except (UnicodeError, json.JSONDecodeError) as exc:
        raise ValueError('EVIDENCE_JSON_INVALID') from exc


def _source_point(point):
    require(isinstance(point, dict) and set(point) == {'source_log_path', 'stat_identity', 'prefix_bytes', 'prefix_sha256'},
            'SOURCE_LOG_PROVENANCE_REQUIRED')
    require(_text(point['source_log_path']) and Path(point['source_log_path']).is_absolute(), 'ABSOLUTE_SOURCE_LOG_REQUIRED')
    require(isinstance(point['stat_identity'], list) and len(point['stat_identity']) == 2
            and all(type(x) is int and x >= 0 for x in point['stat_identity']), 'SOURCE_LOG_IDENTITY_REQUIRED')
    require(type(point['prefix_bytes']) is int and 0 <= point['prefix_bytes'] <= PREFIX_BYTES
            and _sha(point['prefix_sha256']), 'BOUNDED_LOG_PREFIX_REQUIRED')
    return point


@_fail_closed
def validate_live_log_continuity(point):
    """Read the actual source log; reject any uncovered tail or changed identity.

    Call only at a separately supervised pre-dispatch boundary. Calling inside
    Unreal after its console invocation logs a new line is NOT an equivalent
    boundary; that new line needs its own review/integration. No tail is ignored.
    """
    point = _source_point(point)
    path = Path(point['source_log_path'])
    before = _regular(path)
    require([before.st_dev, before.st_ino] == point['stat_identity'], 'LIVE_LOG_IDENTITY_CHANGED')
    require(before.st_size == point['prefix_bytes'], 'LIVE_LOG_UNREVIEWED_TAIL_OR_TRUNCATION')
    with path.open('rb') as stream:
        raw = stream.read(PREFIX_BYTES + 1)
        after = os.fstat(stream.fileno())
    require((before.st_dev, before.st_ino, before.st_size, before.st_mtime_ns) ==
            (after.st_dev, after.st_ino, after.st_size, after.st_mtime_ns), 'LIVE_LOG_CHANGED_DURING_READ')
    require(hashlib.sha256(raw).hexdigest() == point['prefix_sha256'], 'LIVE_LOG_PREFIX_CHANGED')
    return {'status': 'OBSERVED_CURRENT_REVIEWED_LOG_BYTES', 'bytes': len(raw),
            'native_dispatch_continuity': 'UNKNOWN_UNTIL_DISPATCH_INTEGRATION'}


def _prefix_file(pin, point):
    raw = read_pin(pin, PREFIX_BYTES)
    require(len(raw) == point['prefix_bytes'] and hashlib.sha256(raw).hexdigest() == point['prefix_sha256'],
            'COMPLETE_LOG_PREFIX_FILE_REQUIRED')
    return raw


@_fail_closed
def render_dispatcher(manifest_path, manifest_sha256, entry_file):
    """Return dormant wrapper text derived from final reviewed manifest bytes.

    The manifest pins the inner entry; its dispatcher descriptor pins only this
    canonical format and exact path. Derivation from the completed manifest SHA
    breaks the otherwise circular manifest/entry/dispatcher content hashes.
    This function generates text only. It never imports Unreal or runs code.
    """
    path = Path(manifest_path)
    require(path.is_absolute() and path.name == 'diagnostic-manifest.json'
            and _sha(manifest_sha256), 'EXACT_FINAL_MANIFEST_FOR_DISPATCHER_REQUIRED')
    require(isinstance(entry_file, dict) and set(entry_file) == {'path', 'bytes', 'sha256'}
            and Path(entry_file['path']) == path.parent / 'run-diagnostic.py'
            and type(entry_file['bytes']) is int and 0 < entry_file['bytes'] <= RECEIPT_BYTES
            and _sha(entry_file['sha256']), 'EXACT_INNER_ENTRY_FOR_DISPATCHER_REQUIRED')
    return ('"""One reviewed post-reload invocation; no retries or result printing."""\n'
            'import hashlib\nimport types\nimport sys\nfrom pathlib import Path\nimport unreal\n'
            '_manifest = Path(' + json.dumps(str(path)) + ')\n'
            '_entry = Path(' + json.dumps(entry_file['path']) + ')\n'
            'for _path in (_manifest, _entry):\n'
            '    if not _path.is_file() or _path.resolve() != _path.absolute():\n'
            '        raise RuntimeError("REVIEWED_DISPATCH_PATH_CHANGED")\n'
            '    for _part in [_path] + list(_path.parents):\n'
            '        if _part.is_symlink() or getattr(_part.lstat(), "st_file_attributes", 0) & 0x400:\n'
            '            raise RuntimeError("REVIEWED_DISPATCH_PATH_REDIRECTED")\n'
            'with _manifest.open("rb") as _stream:\n    _manifest_raw = _stream.read(' + str(RECEIPT_BYTES + 1) + ')\n'
            'if len(_manifest_raw) > ' + str(RECEIPT_BYTES) + ' or hashlib.sha256(_manifest_raw).hexdigest() != '
            + json.dumps(manifest_sha256) + ':\n    raise RuntimeError("REVIEWED_MANIFEST_BYTES_CHANGED")\n'
            'with _entry.open("rb") as _stream:\n    _raw = _stream.read(' + str(RECEIPT_BYTES + 1) + ')\n'
            'if len(_raw) != ' + str(entry_file['bytes']) + ' or hashlib.sha256(_raw).hexdigest() != '
            + json.dumps(entry_file['sha256']) + ':\n    raise RuntimeError("REVIEWED_ENTRY_BYTES_CHANGED")\n'
            '_module = types.ModuleType("_mw5_postreload_reviewed_entry")\n_module.__file__ = str(_entry)\n'
            '_previous_bytecode = sys.dont_write_bytecode\ntry:\n    sys.dont_write_bytecode = True\n'
            '    exec(compile(_raw, str(_entry), "exec"), _module.__dict__)\nfinally:\n    sys.dont_write_bytecode = _previous_bytecode\n'
            '_module.run(unreal, ' + json.dumps(manifest_sha256) + ')\n').encode('utf-8')


def _derived_file(path, limit):
    path = Path(path)
    _inside(path, ROOT / 'research/evidence')
    _regular(path)
    with path.open('rb') as stream:
        raw = stream.read(limit + 1)
    require(len(raw) <= limit, 'DERIVED_FILE_TOO_LARGE')
    pin = {'path': str(path), 'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()}
    read_pin(pin, limit, exact=path)
    return raw, pin


@_fail_closed
def validate_dispatcher_bytes(manifest, manifest_sha256):
    attempt = ROOT / 'research/evidence' / manifest['attempt_id']
    path = attempt / 'dispatch-diagnostic.py'
    require(manifest.get('dispatcher') == {'path': str(path), 'format_version': 1}, 'FIXED_DISPATCHER_DESCRIPTOR_REQUIRED')
    raw, pin = _derived_file(path, RECEIPT_BYTES)
    require(raw == render_dispatcher(attempt / 'diagnostic-manifest.json', manifest_sha256, manifest['entry_file']),
            'CANONICAL_DISPATCHER_BYTES_MISMATCH')
    return pin


@_fail_closed
def validate_live_dispatch_log(base, phase, manifest, identity):
    """Admit only the exact, reviewed invocation echo after a reviewed prefix.

    The historical editor log shows a timestamp/frame envelope followed by
    ``Cmd: py "relative/path.py"``. This classifier is intentionally limited to
    one exact entry pin/command and one line. Any Python output, warning, reload,
    extra command, incomplete line or changed prefix stops this native guard.
    The collector must not print inside the inspector before its final guard.
    """
    attempt = ROOT / 'research/evidence' / manifest['attempt_id']
    review = read_json(manifest['dispatch_log'], exact=attempt / 'dispatch-log-review.json')
    _identity(review, identity, manifest)
    require(review.get('status') == 'REVIEWED_EXACT_INVOCATION_ECHO_ONLY' and review.get('attempt_id') == manifest['attempt_id']
            and _text(review.get('reviewer')) and review.get('selection_receipt') == manifest['selection_receipt'],
            'EXACT_DISPATCH_LOG_REVIEW_REQUIRED')
    entry = manifest['entry_file']
    read_pin(entry, exact=attempt / 'run-diagnostic.py')
    require(review.get('entry_file') == entry, 'DISPATCH_ENTRY_PIN_MISMATCH')
    manifest_raw, manifest_pin = _derived_file(attempt / 'diagnostic-manifest.json', RECEIPT_BYTES)
    require(read_json(manifest_pin) == manifest, 'DISPATCH_MANIFEST_BYTES_BINDING_REQUIRED')
    dispatcher = validate_dispatcher_bytes(manifest, manifest_pin['sha256'])
    expected = 'py "' + os.path.relpath(dispatcher['path'], base.EDITOR_EXE.parent).replace('\\', '/') + '"'
    require(review.get('expected_command') == expected and '\n' not in expected and '\r' not in expected,
            'EXACT_DISPATCH_COMMAND_REQUIRED')
    reviewed = _utc(review['reviewed_at_utc'])
    expires = _utc(review['expires_at_utc'])
    now = datetime.datetime.now(datetime.timezone.utc)
    require(0 < (expires - reviewed).total_seconds() <= 600 and reviewed <= now <= expires, 'DISPATCH_LOG_REVIEW_STALE')
    point = _source_point(review['log'])
    prefix = _prefix_file(review['prefix_file'], point)
    selection = read_json(manifest['selection_receipt'], exact=attempt / 'selection-review.json')
    require(_utc(selection['reviewed_at_utc']) <= reviewed, 'DISPATCH_REVIEW_PRECEDES_SELECTION_REVIEW')
    selection_before = read_json(selection['pre_click'], exact=attempt / 'selection-before.json')
    ui = _ui(review['ui'], identity, manifest, 'LanceObserverDiagnosticControl')
    _stamp(ui['observed_at'], selection_before['clock_domain'], selection_before['start'])
    ui_at = _utc(ui['observed_at']['utc'])
    require(_utc(selection['reviewed_at_utc']) <= ui_at <= reviewed
            and (reviewed - ui_at).total_seconds() <= 30
            and (now - ui_at).total_seconds() <= 600, 'FRESH_SAFE_DISPATCH_UI_REQUIRED')
    selected_point = _source_point(selection['final_log'])
    require(point['source_log_path'] == selected_point['source_log_path'] and point['stat_identity'] == selected_point['stat_identity']
            and point['prefix_bytes'] >= selected_point['prefix_bytes']
            and hashlib.sha256(prefix[:selected_point['prefix_bytes']]).hexdigest() == selected_point['prefix_sha256'],
            'DISPATCH_PREFIX_SELECTION_BINDING_REQUIRED')
    gap = prefix[selected_point['prefix_bytes']:]
    require(len(gap) <= LOG_BYTES, 'DISPATCH_CONTINUITY_SPAN_TOO_LARGE')
    _review_lines(gap, selected_point['prefix_bytes'], review.get('intervening_lines'), None, None, allow_empty=True)
    path = Path(point['source_log_path'])
    before = _regular(path)
    require([before.st_dev, before.st_ino] == point['stat_identity'], 'LIVE_LOG_IDENTITY_CHANGED')
    require(point['prefix_bytes'] < before.st_size <= point['prefix_bytes'] + 4096, 'EXACT_ONE_INVOCATION_LOG_TAIL_REQUIRED')
    with path.open('rb') as stream:
        actual = stream.read(PREFIX_BYTES + 4097)
        after = os.fstat(stream.fileno())
    signature = lambda s: (s.st_dev, s.st_ino, s.st_size, s.st_mtime_ns)
    require(signature(before) == signature(after) == signature(path.stat()), 'LIVE_LOG_CHANGED_DURING_READ')
    require(actual[:len(prefix)] == prefix, 'LIVE_LOG_PREFIX_CHANGED')
    tail = actual[len(prefix):]
    try:
        text = tail.decode('utf-8')
    except UnicodeError as exc:
        raise ValueError('INVOCATION_LINE_ENCODING_INVALID') from exc
    match = re.fullmatch(r'\[(\d{4}\.\d{2}\.\d{2}-\d{2}\.\d{2}\.\d{2}:\d{3})\]\[\s*(\d+)\]Cmd: (.+)\r?\n', text)
    require(match is not None and match.group(3) == expected, 'UNREVIEWED_OR_EXTRA_DISPATCH_LOG_LINE')
    observed = datetime.datetime.strptime(match.group(1), '%Y.%m.%d-%H.%M.%S:%f').replace(tzinfo=datetime.timezone.utc)
    require(review.get('log_timestamp_basis') == 'UTC_OBSERVED_EDITOR_LOG'
            and reviewed <= observed <= expires and observed <= now + datetime.timedelta(seconds=1), 'INVOCATION_TIME_OUTSIDE_REVIEW')
    return {'status': 'OBSERVED_REVIEWED_PREFIX_AND_EXACT_INVOCATION_ECHO', 'source_log_path': str(path),
            'stat_identity': point['stat_identity'], 'start_byte': len(prefix), 'end_byte': len(actual),
            'tail_sha256': hashlib.sha256(tail).hexdigest(), 'text': text.rstrip('\r\n'),
            'command': expected, 'entry_file': entry, 'dispatcher_file': dispatcher,
            'manifest_sha256': manifest_pin['sha256'], 'channel': 'Cmd', 'operation': 'exact_reviewed_entry_invocation',
            'disposition': 'PRE_REVIEWED_EXACT_PATTERN_MATCH', 'reviewer': review['reviewer'],
            'dispatch_review_sha256': manifest['dispatch_log']['sha256'], 'observed_at_utc': now.isoformat(),
            'live_reference_health': 'UNKNOWN'}


def _identity(record, identity, manifest):
    require(isinstance(record, dict) and record.get('editor_identity') == identity, 'SAME_PROCESS_EVIDENCE_REQUIRED')
    require(record.get('engine_version') == manifest.get('engine_version') == ENGINE_VERSION, 'SAME_VERSION_EVIDENCE_REQUIRED')


def _stock_object(row, target, root=False):
    require(isinstance(row, dict) and row.get('target') == target
            and row.get('status') == 'EXACT_IDENTITY_OBSERVED'
            and row.get('observed_path') == target['object_path']
            and row.get('observed_class') == target['class_path'], 'EXACT_STOCK_OBJECT_REQUIRED')
    outer = row.get('outer_chain')
    require(isinstance(outer, list) and 2 <= len(outer) <= 8 and outer[0] == target['object_path']
            and outer[1] == target['outer_path'] and all(isinstance(x, str) and '/ModOverride/' not in x for x in outer),
            'EXACT_STOCK_IMMEDIATE_OUTER_REQUIRED')
    if root:
        require(row.get('load_calls') == 0, 'STOCK_EXPLICIT_LOAD_FORBIDDEN')
    else:
        require(row.get('export_status') == 'EXPORTED_REQUIRES_REVIEW' and row.get('exporter_errors') == [],
                'COMPLETE_STOCK_EXPORT_REQUIRED')


def _protected_and_inventory(base, phase, manifest, snapshot, which, actual=False):
    roots = phase.mod_roots(base)
    expected_selection = phase.expected_selection(roots, which)
    original = manifest['original_mod_inventory']
    expected = original if which == 'stock' else manifest['mod_inventory']
    require(len(manifest.get('protected_files', [])) == 27, 'EXACT_27_PROTECTED_FILES_REQUIRED')
    require(manifest['protected_files'] == base.fixed_protected_inputs(), 'FIXED_PROTECTED_SOURCE_CONTRACT_REQUIRED')
    require(len({p['path'].casefold() for p in manifest['protected_files']}) == 27, 'UNIQUE_27_PROTECTED_FILES_REQUIRED')
    phase.validate_mod_inventory(original, roots, phase.expected_selection(roots, 'stock'))
    phase.validate_mod_inventory(expected, roots, expected_selection)
    phase.validate_mod_inventory(manifest['mod_inventory'], roots, phase.expected_selection(roots, 'diagnostic'))
    allowed = {'added': [{'root': str(roots[1]), 'path': 'ActiveMod.txt'}],
               'removed': [{'root': str(roots[0]), 'path': 'ActiveMod.txt'}], 'changed': []}
    require(phase.inventory_changes(original, manifest['mod_inventory']) == allowed, 'ONLY_MARKER_MOVE_ALLOWED')
    require(snapshot.get('selection') == expected_selection, 'EXACT_MARKER_STATE_REQUIRED')
    require(snapshot.get('mod_inventory') == expected, 'COMPLETE_MOD_INVENTORY_MISMATCH')
    require(snapshot.get('protected_files') == manifest['protected_files'], '27_PROTECTED_PINS_MISMATCH')
    descriptors = []
    for group in original:
        rows = [r for r in group['files'] if r['path'] == 'mod.json']
        require(len(rows) == 1, 'BOTH_BASELINE_DESCRIPTORS_REQUIRED')
        descriptors.append(dict(rows[0], path=str(Path(group['root']) / 'mod.json')))
    require(snapshot.get('descriptors') == descriptors, 'BOTH_DESCRIPTOR_PINS_MISMATCH')
    if actual:
        require(base.selection_snapshot(expected_selection) == expected_selection, 'CURRENT_MARKER_STATE_MISMATCH')
        for pin in manifest['protected_files'] + descriptors:
            # Protected pins intentionally include approved paths outside evidence.
            require(0 <= pin['bytes'] <= 512 * 1024 * 1024, 'PROTECTED_FILE_TOO_LARGE')
            read_pin(pin, limit=pin['bytes'], exact=pin['path'], root=Path(pin['path']).parent)
        require(phase.snapshot_mod_roots(roots) == expected, 'CURRENT_FULL_MOD_INVENTORY_MISMATCH')
    return descriptors


@_fail_closed
def validate_predecessor(base, phase, manifest, identity):
    """Rehash the historical native stock snapshot, never reacquire stock objects."""
    prior = manifest.get('predecessor')
    require(isinstance(prior, dict), 'PINNED_HISTORICAL_PREDECESSOR_REQUIRED')
    attempt_id = prior.get('attempt_id', '')
    require(isinstance(attempt_id, str) and re.fullmatch(r'diagnostic-template-selection-\d{8}T\d{6}Z-[0-9a-f]{8}', attempt_id),
            'HISTORICAL_ATTEMPT_REQUIRED')
    attempt = ROOT / 'research/evidence' / attempt_id
    report = read_json(prior['report'], exact=attempt / 'stock/report.json')
    saved = read_json(prior['manifest'], exact=attempt / 'stock-manifest.json')
    review = read_json(prior['review'], exact=attempt / 'stock-independent-review.json')
    baseline = read_json(prior['baseline'], exact=attempt / 'baseline.json')
    after = read_json(prior['post_verification'], exact=attempt / 'stock-after-verification.json')
    require(report.get('manifest') == saved and saved.get('attempt_id') == report.get('attempt_id') == attempt_id,
            'STOCK_SAVED_MANIFEST_BINDING_REQUIRED')
    require(saved.get('editor_identity') == report.get('editor_identity') == review.get('editor_identity') == identity
            and baseline.get('editor_identity') == identity, 'HISTORICAL_PROCESS_CHANGED')
    build = baseline.get('editor_build', {})
    require((build.get('MajorVersion'), build.get('MinorVersion'), build.get('PatchVersion'), build.get('CompatibleChangelist'))
            == (4, 26, 2, 14830424) and manifest.get('engine_version') == ENGINE_VERSION, 'HISTORICAL_BUILD_CHANGED')
    build_pin = baseline.get('editor_build_pin')
    expected_build = base.EDITOR_EXE.parents[2] / 'Build/Build.version'
    require(json.loads(read_pin(build_pin, exact=expected_build, root=expected_build.parent)) == build, 'BUILD_BYTES_AND_METADATA_DIFFER')
    require(saved.get('protected_files') == manifest.get('protected_files') and len(saved.get('protected_files', [])) == 27,
            'HISTORICAL_PROTECTED_SOURCE_CHANGED')
    for key, wanted in phase.plan(base, 'stock').items():
        require(saved.get(key) == wanted, 'HISTORICAL_FIXED_SCOPE_CHANGED')
    helper = ROOT / 'scripts/Inspect-DiagnosticTemplatePhase.py'
    base_helper = ROOT / 'scripts/Inspect-DiagnosticTemplates.py'
    read_pin(prior['helper'], exact=helper, root=ROOT / 'scripts')
    read_pin(prior['base_helper'], exact=base_helper, root=ROOT / 'scripts')
    read_pin(prior['entry'], exact=attempt / 'run-stock.py')
    require(prior['helper']['sha256'] == saved.get('helper_sha256') and prior['base_helper']['sha256'] == saved.get('base_helper_sha256')
            and prior['entry'] == saved.get('entry_file'), 'HISTORICAL_HELPER_ENTRY_BINDING_REQUIRED')
    require(report.get('classification') == 'EDITOR_SOURCE_REQUIRES_REVIEW' and report.get('native_inspection') == 'PERFORMED'
            and report.get('phase') == 'stock' and report.get('status') == 'COLLECTED_REQUIRES_REVIEW'
            and report.get('errors') == [] and report.get('root_finds') == 2, 'COMPLETED_NATIVE_STOCK_REQUIRED')
    require(all(report.get(k) is True for k in ('protected_unchanged', 'selection_unchanged', 'mod_inventory_unchanged')),
            'UNCHANGED_HISTORICAL_STOCK_STATE_REQUIRED')
    require(report.get('explicit_asset_edit_save_compile_reload_selection_restart_cook_retail') == 'NOT_PERFORMED',
            'HISTORICAL_EXPLICIT_MUTATION_FORBIDDEN')
    stock_plan = phase.plan(base, 'stock')
    _stock_object(report['root'], stock_plan['root_asset'], root=True)
    queries = report.get('queries')
    require(isinstance(queries, list) and len(queries) == 5 and isinstance(prior.get('files'), list)
            and len(prior['files']) == 5, 'FIVE_RAW_AND_FIVE_INDEX_FILES_REQUIRED')
    final, _ = base.utilities()
    raw_total = index_total = 0
    all_paths = set()
    for row, target, pair in zip(queries, stock_plan['targets'], prior['files']):
        _stock_object(row, target)
        require(pair == {'export': row['export'], 'inventory': row['inventory']}, 'ORDERED_STOCK_FILE_PINS_REQUIRED')
        pin = pair['export']
        path = Path(pin['path'])
        require(path.parent == attempt / 'stock' and path.stem == target['label'] and path.suffix.lower() in ('.copy', '.t3d'),
                'EXACT_STOCK_EXPORT_PATH_REQUIRED')
        raw = read_pin(pin, limit=EXPORT_BYTES)
        require(len(raw) > 0, 'NONEMPTY_COMPLETE_EXPORT_REQUIRED')
        index = read_json(pair['inventory'], limit=EXPORT_BYTES, exact=attempt / 'stock' / (target['label'] + '-inventory.json'))
        derived = final.inventory(raw, target['name'], target['class_path'])
        derived['reference_interpretation'] = 'LEXICAL_ONLY_NOT_RESOLVED_REFERENCES'
        derived['fixed_inventory_references'] = [dict(path=c['text'], status='EXACT_INVENTORY_IDENTITY_OBSERVED'
            if any(t['object_path'] == c['text'] for t in stock_plan['targets']) else 'UNKNOWN_NOT_QUERIED')
            for c in derived['path_candidates']]
        require(index == derived, 'RAW_EXPORT_AND_INDEX_DIFFER')
        for item in pair.values():
            require(item['path'].casefold() not in all_paths, 'DUPLICATE_STOCK_FILE')
            all_paths.add(item['path'].casefold())
        raw_total += pin['bytes']
        index_total += pair['inventory']['bytes']
    require(raw_total <= 8 * EXPORT_BYTES and index_total <= 8 * EXPORT_BYTES
            and raw_total == report.get('exported_bytes') and index_total == report.get('inventory_bytes'), 'STOCK_TOTAL_BYTES_MISMATCH')
    roots = phase.mod_roots(base)
    require(saved.get('selection') == phase.expected_selection(roots, 'stock'), 'ORIGINAL_STOCK_SELECTION_REQUIRED')
    phase.validate_mod_inventory(saved.get('mod_inventory'), roots, saved['selection'])
    require(report.get('mod_inventory_before') == report.get('mod_inventory_after') == saved['mod_inventory']
            == manifest.get('original_mod_inventory') and report.get('mod_inventory_changes') == {'added': [], 'removed': [], 'changed': []},
            'HISTORICAL_FULL_INVENTORY_CHANGED')
    require(review.get('status') == 'PASS_STOCK_SOURCE_AND_LOG_REVIEW' and review.get('stock_report_sha256') == prior['report']['sha256']
            and review.get('source_review_passed') is True and review.get('log_review_passed') is True and _text(review.get('reviewer'))
            and review.get('stock_manifest') == prior['manifest'] and review.get('post_verification') == prior['post_verification'],
            'INDEPENDENT_SOURCE_LOG_REVIEW_BINDING_REQUIRED')
    _utc(review.get('reviewed_at_utc'))
    require(after.get('report') == prior['report'] and after.get('log_span') == review.get('stock_log_span')
            and after.get('log_prefix_unchanged') is True and after.get('log_identity_unchanged') is True
            and after.get('protected_matching') == 27 and after.get('selection_matches') is True
            and after.get('mod_inventory_matches') is True and after.get('mod_inventory') == saved['mod_inventory']
            and after.get('selection') == saved['selection'], 'HISTORICAL_POST_VERIFICATION_REQUIRED')
    expected_protected = [dict(p, matches=True) for p in saved['protected_files']]
    require(after.get('protected') == expected_protected, 'HISTORICAL_POST_PROTECTED_PINS_REQUIRED')
    origin = baseline['log_before']
    point = _source_point(dict(source_log_path=origin['path'], stat_identity=origin['stat_identity'],
                               prefix_bytes=origin['bytes'], prefix_sha256=origin['sha256']))
    span = review['stock_log_span']
    stock_raw = _old_span(span, attempt / 'stock-log-span.txt', point['source_log_path'], point['prefix_bytes'])
    end = span['end_byte']
    require(isinstance(prior.get('intervening'), list) and len(prior['intervening']) == 2, 'HISTORICAL_TRANSITIONS_REQUIRED')
    for item, role, filename in zip(prior['intervening'], ('selection', 'restoration'), ('selection-observation.json', 'restoration-verification.json')):
        require(item.get('role') == role, 'HISTORICAL_TRANSITION_ORDER_REQUIRED')
        transition = read_json(item['receipt'], exact=attempt / filename)
        require(transition.get('editor_identity') == identity and transition.get('log_identity_unchanged') is True
                and transition.get('log_prefix_unchanged') is True, 'HISTORICAL_TRANSITION_IDENTITY_REQUIRED')
        _old_span(transition['log_span'], attempt / (role + '-log-span.txt'), point['source_log_path'], end)
        end = transition['log_span']['end_byte']
    continuity = read_json(prior['continuity'])
    _identity(continuity, identity, manifest)
    require(continuity.get('status') == 'REVIEWED_HISTORICAL_TO_NEW_BASELINE' and _text(continuity.get('reviewer'))
            and continuity.get('historical_report_sha256') == prior['report']['sha256']
            and continuity.get('historical_baseline_sha256') == prior['baseline']['sha256']
            and continuity.get('intervening') == prior['intervening'] and continuity.get('source_log_origin') == point,
            'REVIEWED_HISTORICAL_CONTINUITY_REQUIRED')
    spans = continuity.get('spans')
    require(isinstance(spans, list) and 1 <= len(spans) <= 16, 'BOUNDED_CONTINUITY_SPANS_REQUIRED')
    for item in spans:
        require(item['start_byte'] == end, 'HISTORICAL_LOG_COVERAGE_GAP')
        raw = _span(item, point['source_log_path'], point['stat_identity'])
        _review_lines(raw, item['start_byte'], item['lines'], allowed_mod=None, reload_package=None, allow_empty=True)
        end = item['end_byte']
    final_point = _source_point(continuity['baseline_log'])
    require(final_point['source_log_path'] == point['source_log_path'] and final_point['stat_identity'] == point['stat_identity']
            and final_point['prefix_bytes'] == end, 'HISTORICAL_CONTINUITY_FINAL_OFFSET_REQUIRED')
    prefix = _prefix_file(continuity['prefix_file'], final_point)
    require(hashlib.sha256(prefix[:point['prefix_bytes']]).hexdigest() == point['prefix_sha256'], 'HISTORICAL_LOG_PREFIX_CHANGED')
    require(prefix[span['start_byte']:span['end_byte']] == stock_raw, 'HISTORICAL_STOCK_LOG_BYTES_CHANGED')
    for item in prior['intervening']:
        old = read_json(item['receipt'])['log_span']
        require(prefix[old['start_byte']:old['end_byte']] == read_pin(old['file'], LOG_BYTES), 'HISTORICAL_TRANSITION_LOG_BYTES_CHANGED')
    for item in spans:
        require(prefix[item['start_byte']:item['end_byte']] == read_pin(item['file'], LOG_BYTES), 'HISTORICAL_CONTINUITY_LOG_BYTES_CHANGED')
    require(continuity.get('historical_selection_memory_equivalence') == 'UNKNOWN', 'HISTORICAL_MEMORY_OVERCLAIM')
    return {'status': 'HISTORICAL_STOCK_FILES_REHASHED', 'raw_exports': 5, 'inventories': 5,
            'stock_report_sha256': prior['report']['sha256'], 'baseline_log': final_point,
            'native_dispatch_continuity': 'NOT_PERFORMED', 'live_reference_health': 'UNKNOWN',
            'baseline_helper_entry_pins': 'PREPARATION_ONLY_ACTUAL_RUN_PINS_FROM_REVIEWED_STOCK_MANIFEST'}


def _old_span(span, exact, source, start):
    require(isinstance(span, dict) and span.get('source_log_path') == source and span.get('start_byte') == start
            and type(span.get('end_byte')) is int and span['end_byte'] >= start, 'HISTORICAL_LOG_SOURCE_OFFSET_MISMATCH')
    raw = read_pin(span['file'], LOG_BYTES, exact=exact)
    require(len(raw) == span['end_byte'] - start, 'LOG_SPAN_LENGTH_MISMATCH')
    return raw


def _stamp(stamp, domain, start=None):
    require(isinstance(stamp, dict) and set(stamp) == {'utc', 'monotonic', 'clock_domain'}, 'UTC_MONOTONIC_STAMP_REQUIRED')
    require(stamp['clock_domain'] == domain and _number(stamp['monotonic']), 'MONOTONIC_CLOCK_DOMAIN_MISMATCH')
    utc = _utc(stamp['utc'])
    if start is not None:
        elapsed = stamp['monotonic'] - start['monotonic']
        require(elapsed >= 0, 'MONOTONIC_CLOCK_REVERSED')
        require(abs((utc - _utc(start['utc'])).total_seconds() - elapsed) <= 1.0, 'UTC_MONOTONIC_DISCONTINUITY')
    return stamp['monotonic']


def _timing(timing, domain, start, minimum):
    require(isinstance(timing, dict) and set(timing) == {'submitted', 'started', 'completed', 'returned'}, 'TOOL_TIMING_BOUNDARIES_REQUIRED')
    vals = [_stamp(timing[k], domain, start) for k in ('submitted', 'started', 'completed', 'returned')]
    require(vals == sorted(vals) and vals[0] >= minimum, 'TOOL_TIMING_ORDER_INVALID')
    require(vals[-1] - start['monotonic'] <= 120, 'TRANSITION_WALL_BUDGET_EXCEEDED')
    return vals


def _ui(ui, identity, manifest, expected_mod, within=None):
    require(isinstance(ui, dict) and set(ui) == {'capture', 'receipt'}, 'BOUND_UI_CAPTURE_RECEIPT_REQUIRED')
    read_pin(ui['capture'], CAPTURE_BYTES)
    receipt = read_json(ui['receipt'])
    _identity(receipt, identity, manifest)
    require(receipt.get('capture') == ui['capture'] and receipt.get('active_mod') == expected_mod
            and all(receipt.get(k) is True for k in ('responsive', 'main_window_foreground', 'exclusive_owner'))
            and all(receipt.get(k) is False for k in ('modal_visible', 'human_intervention', 'pending_tool_work')),
            'SAFE_TARGET_UI_OBSERVATION_REQUIRED')
    if within:
        at = _stamp(receipt['observed_at'], within[0], within[1])
        require(within[2] <= at <= within[3], 'UI_CAPTURE_OUTSIDE_POLL')
    require(_text(receipt.get('reviewer')) and _text(receipt.get('interpretation')), 'EXPLICIT_UI_REVIEW_REQUIRED')
    return receipt


def _span(span, source, identity):
    require(isinstance(span, dict) and span.get('source_log_path') == source and span.get('stat_identity') == identity,
            'LOG_SOURCE_IDENTITY_MISMATCH')
    require(type(span.get('start_byte')) is int and type(span.get('end_byte')) is int
            and 0 <= span['start_byte'] <= span['end_byte'] and span['end_byte'] - span['start_byte'] <= LOG_BYTES,
            'BOUNDED_LOG_OFFSETS_REQUIRED')
    raw = read_pin(span['file'], LOG_BYTES)
    require(len(raw) == span['end_byte'] - span['start_byte'], 'LOG_SPAN_LENGTH_MISMATCH')
    require(span.get('truncated') is False and span.get('rotated') is False, 'COMPLETE_UNROTATED_LOG_REQUIRED')
    return raw


def _review_lines(raw, start, rows, allowed_mod, reload_package, allow_empty=False,
                  expected_command=None, command_window=None, time_window=None):
    try:
        lines = raw.decode('utf-8').splitlines(keepends=True)
    except UnicodeError as exc:
        raise ValueError('COMPLETE_UTF8_LOG_REQUIRED') from exc
    require(not raw or raw.endswith(b'\n'), 'PARTIAL_LOG_LINE_FORBIDDEN')
    require(isinstance(rows, list) and len(rows) == len(lines), 'EVERY_LOG_LINE_REVIEW_REQUIRED')
    if not allow_empty:
        require(bool(lines), 'TRANSITION_LOG_REQUIRED')
    offset, reloads, packages, commands = start, 0, [], 0
    for line, row in zip(lines, rows):
        length = len(line.encode('utf-8'))
        content = line.rstrip('\r\n')
        require(isinstance(row, dict) and row.get('start_byte') == offset and row.get('end_byte') == offset + length
                and row.get('text') == content and row.get('disposition') == 'REVIEWED_EXPECTED'
                and _text(row.get('reviewer')) and _text(row.get('interpretation')), 'EXACT_LINE_REVIEW_REQUIRED')
        require(not re.search(r'(?i)\b(warning|error|ensure|fatal)\b', content), 'WARNING_ERROR_ENSURE_COMPARISON_STOP')
        prefix = r'^\[\d{4}\.\d{2}\.\d{2}-\d{2}\.\d{2}\.\d{2}:\d{3}\]\[\s*\d+\]'
        timestamp = re.match(r'^\[([^\]]+)\]', content)
        if timestamp:
            try:
                recorded = datetime.datetime.strptime(timestamp.group(1), '%Y.%m.%d-%H.%M.%S:%f').replace(tzinfo=datetime.timezone.utc)
            except ValueError as exc:
                raise ValueError('LOG_TIMESTAMP_INVALID') from exc
            if time_window is not None:
                require(time_window[0] <= recorded <= time_window[1], 'LOG_LINE_OUTSIDE_TRANSITION_WINDOW')
        directory = re.fullmatch(prefix + r"LogDirectoryWatcher: A directory notification for '([^']+)' was aborted\.", content)
        reload = re.fullmatch(prefix + r'LogUObjectGlobals: Reloading (\d+) Package\(s\):', content)
        package = re.fullmatch(r'\s*Asset Name: (\S+)', content)
        compact = re.fullmatch(prefix + r'LogUObjectHash: Compacting FUObjectHashTables data took\s+\d+(?:\.\d+)?ms', content)
        command = re.fullmatch(prefix + r'Cmd: (.+)', content)
        if directory:
            require(allowed_mod is not None, 'UNEXPECTED_DIRECTORYWATCHER_NOTICE')
            base = '../../../MW5Mercs/Plugins/' + allowed_mod
            allowed = {base, base + '/ModOverride', base + '/ModOverride/', base + '/Config/Input', base + '/Config/Tags'}
            require(directory.group(1) in allowed and row.get('channel') == 'LogDirectoryWatcher'
                    and row.get('operation') == 'deselected_mod_directory_notice' and row.get('path') == directory.group(1),
                    'DIRECTORYWATCHER_NOTICE_NOT_EXPLICITLY_REVIEWED')
        elif reload:
            require(reload_package is not None and reload.group(1) == '1'
                    and row.get('channel') == 'LogUObjectGlobals' and row.get('operation') == 'implicit_selection_reload'
                    and row.get('path') == reload_package, 'UNEXPECTED_RELOAD_RECORD')
            reloads += 1
        elif package:
            require(reload_package is not None and package.group(1) == reload_package
                    and row.get('channel') == 'LogUObjectGlobals' and row.get('operation') == 'implicit_selection_reload_package'
                    and row.get('path') == reload_package and len(packages) < reloads, 'UNEXPECTED_RELOAD_PACKAGE')
            packages.append(package.group(1))
        elif compact:
            require(row.get('channel') == 'LogUObjectHash' and row.get('operation') == 'object_hash_compaction'
                    and row.get('path') == '', 'COMPACTION_LINE_REVIEW_REQUIRED')
        elif command:
            require(expected_command is not None and command.group(1) == expected_command
                    and row.get('channel') == 'Cmd' and row.get('operation') == 'exact_reviewed_entry_invocation'
                    and row.get('path') == expected_command and command_window is not None
                    and command_window[0] <= recorded <= command_window[1], 'UNEXPECTED_INSPECTOR_COMMAND_LINE')
            commands += 1
            require(commands == 1, 'REPEATED_INSPECTOR_COMMAND_LINE')
        else:
            raise ValueError('UNEXPECTED_OR_UNEXPLAINED_LOG_LINE')
        offset += length
    if reload_package is not None:
        require(reloads == 1 and packages == [reload_package], 'EXACTLY_ONE_IMPLICIT_RELOAD_REQUIRED')
    else:
        require(reloads == 0, 'CONTINUITY_RELOAD_FORBIDDEN')
    return {'lines': len(lines), 'reloads': reloads, 'commands': commands}


@_fail_closed
def validate_transition(base, phase, manifest, identity, transition='selection'):
    require(transition in ('selection', 'restoration'), 'FIXED_TRANSITION_REQUIRED')
    attempt = ROOT / 'research/evidence' / manifest['attempt_id']
    receipt = read_json(manifest[transition + '_receipt'], exact=attempt / (transition + '-review.json'))
    _identity(receipt, identity, manifest)
    require(receipt.get('schema_version') == 1 and receipt.get('protocol') == PROTOCOL
            and receipt.get('transition') == transition and receipt.get('attempt_id') == manifest['attempt_id']
            and receipt.get('status') == 'REVIEWED_TRANSITION_OBSERVATIONS' and _text(receipt.get('reviewer')),
            'REVIEWED_TRANSITION_RECEIPT_REQUIRED')
    require(receipt.get('live_reference_health') == 'UNKNOWN' and receipt.get('in_memory_rollback') == 'UNKNOWN', 'REFERENCE_HEALTH_OVERCLAIM')
    before_mod, after_mod = (('LanceObserverProbe', 'LanceObserverDiagnosticControl') if transition == 'selection'
                             else ('LanceObserverDiagnosticControl', 'LanceObserverProbe'))
    before = read_json(receipt['pre_click'], exact=attempt / (transition + '-before.json'))
    _identity(before, identity, manifest)
    require(before.get('attempt_id') == manifest['attempt_id'] and before.get('transition') == transition, 'PRE_CLICK_ATTEMPT_REQUIRED')
    require(before.get('clock_source') == 'time.monotonic' and _text(before.get('clock_domain'))
            and before.get('clock_domain_verified') is True, 'VERIFIED_MONOTONIC_CLOCK_REQUIRED')
    domain = before['clock_domain']
    start = before['start']
    _stamp(start, domain)
    durable = _stamp(before['durable_written_at'], domain, start)
    require(durable >= start['monotonic'], 'PRE_CLICK_DURABLE_RECORD_REQUIRED')
    source = _source_point(before['log'])
    source_prefix = _prefix_file(before['log_prefix_file'], source)
    if transition == 'selection':
        predecessor = validate_predecessor(base, phase, manifest, identity)
        require(source == predecessor['baseline_log'], 'SELECTION_PREDECESSOR_LOG_CONTINUITY_REQUIRED')
    else:
        selected = validate_transition(base, phase, manifest, identity, 'selection')
        selection_review = read_json(manifest['selection_receipt'])
        require(_utc(start['utc']) >= _utc(selection_review['reviewed_at_utc']), 'RESTORATION_PRECEDES_SELECTION_REVIEW')
        eligible = read_json(before['eligibility_review'], exact=attempt / 'restoration-eligibility-review.json')
        _identity(eligible, identity, manifest)
        require(eligible.get('status') == 'REVIEWED_SAFE_RESTORATION' and eligible.get('attempt_id') == manifest['attempt_id']
                and eligible.get('selection_receipt') == manifest['selection_receipt']
                and eligible.get('ui') == before['ui'] and eligible.get('state') == before['state']
                and eligible.get('log') == source and eligible.get('unsafe_conditions_observed') == []
                and _text(eligible.get('reviewer')) and _text(eligible.get('reason')),
                'SEPARATE_SAFE_RESTORATION_ELIGIBILITY_REQUIRED')
        require(_utc(selection_review['reviewed_at_utc']) <= _utc(eligible['reviewed_at_utc']) <= _utc(start['utc'])
                and (_utc(start['utc']) - _utc(eligible['reviewed_at_utc'])).total_seconds() <= 30,
                'FRESH_PRE_CLICK_RESTORATION_ELIGIBILITY_REQUIRED')
        outcome = eligible.get('outcome')
        if outcome == 'NOT_PERFORMED_COMPARISON_ONLY_STOP':
            require(eligible.get('diagnostic_report') is None and eligible.get('diagnostic_manifest') is None,
                    'UNPERFORMED_DIAGNOSTIC_REPORT_CONTRADICTION')
            evidence_root = ROOT / 'research/evidence'
            require(not any(os.path.lexists(str(attempt / name)) for name in
                            ('diagnostic-native-dispatch-claim.json', 'diagnostic-mock-dispatch-claim.json', 'diagnostic')),
                    'DISPATCH_CLAIM_OR_OUTPUT_CONTRADICTS_NOT_PERFORMED')
            require(all(not any(folder.glob(pattern)) for folder in (evidence_root, evidence_root / 'editor-source')
                        for pattern in ('.diagnostic-*.lock', '.observer-*.lock')),
                    'ACTIVE_INSPECTION_CONTRADICTS_NOT_PERFORMED')
            # This is a passive Python-module dictionary check only, not an
            # Unreal import or reflected native call. Absent API is unobserved.
            api = sys.modules.get('unreal')
            if api is not None:
                keys = (getattr(base, 'ACTIVE_KEY', '_mw5_diagnostic_template_inspection'),) + tuple(getattr(base, 'OTHER_ACTIVE_KEYS', ()))
                require(all(vars(api).get(key) is None for key in keys), 'ACTIVE_API_INSPECTION_CONTRADICTS_NOT_PERFORMED')
        else:
            diagnostic = read_json(eligible['diagnostic_report'], exact=attempt / 'diagnostic/report.json')
            admitted = read_json(eligible['diagnostic_manifest'], exact=attempt / 'diagnostic-manifest.json')
            comparable = lambda value: {k: v for k, v in value.items() if k != 'restoration_receipt'}
            require(diagnostic.get('attempt_id') == manifest['attempt_id'] and diagnostic.get('editor_identity') == identity
                    and diagnostic.get('classification') == 'EDITOR_SOURCE_REQUIRES_REVIEW'
                    and diagnostic.get('manifest') == admitted and comparable(admitted) == comparable(manifest)
                    and diagnostic.get('explicit_asset_loads') == 0
                    and diagnostic.get('reference_health') == 'UNKNOWN' and diagnostic.get('memory_rollback') == 'UNKNOWN',
                    'RESTORATION_DIAGNOSTIC_REPORT_BINDING_REQUIRED')
            require(outcome in ('INSPECTION_COMPLETED', 'REVIEWED_COMPARISON_ONLY_STOP'), 'REVIEWED_RESTORATION_OUTCOME_REQUIRED')
            if outcome == 'INSPECTION_COMPLETED':
                require(diagnostic.get('status') == 'COLLECTED_REQUIRES_REVIEW' and diagnostic.get('native_inspection') == 'PERFORMED'
                        and diagnostic.get('errors') == [], 'SUCCESSFUL_DIAGNOSTIC_EVIDENCE_REQUIRED')
            else:
                require(diagnostic.get('status') == 'STOPPED_PARTIAL_REQUIRES_REVIEW'
                        and diagnostic.get('native_inspection') == 'ATTEMPTED_PARTIAL'
                        and eligible.get('reviewed_errors') == diagnostic.get('errors') and bool(diagnostic.get('errors')),
                        'COMPARISON_STOP_ERRORS_MUST_BE_REVIEWED')
        prior_log = selected['log']
        require(source['source_log_path'] == prior_log['source_log_path'] and source['stat_identity'] == prior_log['stat_identity']
                and source['prefix_bytes'] >= prior_log['prefix_bytes']
                and hashlib.sha256(source_prefix[:prior_log['prefix_bytes']]).hexdigest() == prior_log['prefix_sha256'],
                'RESTORATION_SELECTION_LOG_CONTINUITY_REQUIRED')
        gap = source_prefix[prior_log['prefix_bytes']:]
        require(len(gap) <= LOG_BYTES, 'RESTORATION_CONTINUITY_SPAN_TOO_LARGE')
        expected_command, command_window = None, None
        if b'Cmd:' in gap:
            dispatch = read_json(manifest['dispatch_log'], exact=attempt / 'dispatch-log-review.json')
            _identity(dispatch, identity, manifest)
            require(dispatch.get('status') == 'REVIEWED_EXACT_INVOCATION_ECHO_ONLY'
                    and dispatch.get('selection_receipt') == manifest['selection_receipt']
                    and dispatch.get('entry_file') == manifest['entry_file'], 'RESTORATION_DISPATCH_REVIEW_BINDING_REQUIRED')
            manifest_raw, manifest_pin = _derived_file(attempt / 'diagnostic-manifest.json', RECEIPT_BYTES)
            admitted_manifest = read_json(manifest_pin)
            require({k: v for k, v in admitted_manifest.items() if k != 'restoration_receipt'} ==
                    {k: v for k, v in manifest.items() if k != 'restoration_receipt'}, 'RESTORATION_DISPATCH_MANIFEST_MISMATCH')
            dispatcher = validate_dispatcher_bytes(admitted_manifest, manifest_pin['sha256'])
            expected_command = 'py "' + os.path.relpath(dispatcher['path'], base.EDITOR_EXE.parent).replace('\\', '/') + '"'
            require(dispatch.get('expected_command') == expected_command, 'RESTORATION_EXACT_ENTRY_COMMAND_REQUIRED')
            read_pin(manifest['entry_file'], exact=attempt / 'run-diagnostic.py')
            command_window = (_utc(dispatch['reviewed_at_utc']), _utc(dispatch['expires_at_utc']))
        _review_lines(gap, prior_log['prefix_bytes'], before.get('intervening_lines'), None, None, allow_empty=True,
                      expected_command=expected_command, command_window=command_window)
    ui_before = _ui(before['ui'], identity, manifest, before_mod)
    pre_ui_at = _stamp(ui_before['observed_at'], domain)
    require(0 <= start['monotonic'] - pre_ui_at <= 30, 'FRESH_PRE_CLICK_UI_REQUIRED')
    _protected_and_inventory(base, phase, manifest, before['state'], 'stock' if transition == 'selection' else 'diagnostic')
    action = read_json(receipt['action'], exact=attempt / (transition + '-action.json'))
    _identity(action, identity, manifest)
    require(action.get('attempt_id') == manifest['attempt_id'] and action.get('pre_click_sha256') == receipt['pre_click']['sha256']
            and action.get('transition') == transition and action.get('selection_clicks') == 1
            and action.get('result') == 'COMPLETED', 'ONE_BOUND_SELECTION_ACTION_REQUIRED')
    require(all(action.get(k) == 0 and type(action.get(k)) is int for k in
                ('explicit_loads', 'explicit_reloads', 'asset_edits', 'saves', 'compiles', 'dialog_dismissals', 'restarts')),
            'EXPLICIT_MUTATION_OR_RETRY_FORBIDDEN')
    action_times = _timing(action['timing'], domain, start, durable)
    polls = receipt.get('polls')
    require(isinstance(polls, list) and 1 <= len(polls) <= 5, 'FIVE_POLL_CAP')
    require(action.get('observation_call_count') == len(polls) and action.get('uncounted_observation_calls') == 0,
            'ALL_AUTOMATIC_FAILED_OBSERVATIONS_MUST_BE_COUNTED')
    last = action_times[1]
    successful = []
    for number, pin in enumerate(polls, 1):
        poll = read_json(pin, exact=attempt / (transition + '-poll-' + str(number) + '.json'))
        _identity(poll, identity, manifest)
        require(poll.get('poll_id') == number and poll.get('attempt_id') == manifest['attempt_id']
                and poll.get('kind') in ('explicit', 'automatic_post_action'), 'SEQUENTIAL_COUNTED_POLLS_REQUIRED')
        minimum = max(last, action_times[-1]) if poll['kind'] == 'explicit' else last
        times = _timing(poll['timing'], domain, start, minimum)
        last = times[-1]
        require(poll.get('elapsed_seconds') == times[-1] - start['monotonic'], 'POLL_ELAPSED_MISMATCH')
        require(poll.get('result') in ('OBSERVED', 'FAILED', 'REFUSED', 'TIMED_OUT'), 'POLL_RESULT_REQUIRED')
        require(poll.get('unsafe_conditions_observed') == [], 'UNSAFE_OBSERVATION_REQUIRES_SEPARATE_RESOLUTION')
        # A free-text reason and an empty unsafe list cannot establish that a
        # failed observation was harmless. Later safe polls do not repair that
        # evidence gap. Preserve/count the failure, but do not admit this attempt.
        require(poll['result'] == 'OBSERVED', 'FAILED_OBSERVATION_REQUIRES_SEPARATE_RESOLUTION')
        _ui(poll['ui'], identity, manifest, after_mod, (domain, start, times[1], times[2]))
        sample = poll['log']
        read_start = _stamp(sample['read_started'], domain, start)
        read_end = _stamp(sample['read_completed'], domain, start)
        require(times[1] <= read_start <= read_end <= times[2], 'LOG_READ_OUTSIDE_POLL')
        raw = _span(sample, source['source_log_path'], source['stat_identity'])
        require(sample['start_byte'] == source['prefix_bytes'] and sample.get('source_prefix_sha256') == source['prefix_sha256'],
                'FULL_PRE_CLICK_LOG_COVERAGE_REQUIRED')
        successful.append((poll, raw, read_start, read_end))
    require(len(successful) >= 2 and successful[-1][0]['poll_id'] == len(polls), 'TWO_SUCCESSFUL_FINAL_POLLS_REQUIRED')
    left, right = successful[-2:]
    require(right[2] - left[3] >= 2 and left[1] == right[1]
            and left[0]['log']['end_byte'] == right[0]['log']['end_byte'], 'TWO_SECONDS_IDENTICAL_COMPLETE_LOG_SAMPLES_REQUIRED')
    require(max(last, action_times[-1]) - start['monotonic'] <= 120, 'TRANSITION_WALL_BUDGET_EXCEEDED')
    review = read_json(receipt['log_review'], exact=attempt / (transition + '-log-review.json'))
    require(review.get('source') == source and review.get('file') == right[0]['log']['file']
            and review.get('end_byte') == right[0]['log']['end_byte'], 'FULL_LOG_REVIEW_BINDING_REQUIRED')
    package = DIAGNOSTIC_PACKAGE if transition == 'selection' else STOCK_PACKAGE
    details = _review_lines(right[1], source['prefix_bytes'], review.get('lines'), before_mod, package,
                            time_window=(_utc(start['utc']), _utc(successful[-1][0]['timing']['completed']['utc'])))
    final_state = read_json(receipt['final_state'], exact=attempt / (transition + '-state.json'))
    _identity(final_state, identity, manifest)
    state_at = _stamp(final_state['observed_at'], domain, start)
    require(successful[-1][0]['timing']['started']['monotonic'] <= state_at <= last
            and final_state.get('ui') == successful[-1][0]['ui'], 'TIMED_FINAL_STATE_REQUIRED')
    _protected_and_inventory(base, phase, manifest, final_state, 'diagnostic' if transition == 'selection' else 'stock')
    require(final_state.get('inventory_complete') is True and final_state.get('inventory_differences') == {'added': [], 'removed': [], 'changed': []},
            'COMPLETE_UNCHANGED_FINAL_INVENTORY_REQUIRED')
    point = _source_point(receipt['final_log'])
    require(point['source_log_path'] == source['source_log_path'] and point['stat_identity'] == source['stat_identity']
            and point['prefix_bytes'] == right[0]['log']['end_byte'], 'FINAL_LOG_PROVENANCE_REQUIRED')
    require(hashlib.sha256(source_prefix + right[1]).hexdigest() == point['prefix_sha256'], 'FINAL_LOG_PREFIX_HASH_MISMATCH')
    require(_utc(receipt['reviewed_at_utc']) >= _utc(successful[-1][0]['timing']['returned']['utc']), 'REVIEW_PRECEDES_OBSERVATION')
    return {'status': 'RECORDED_TRANSITION_EVIDENCE_VERIFIED', 'transition': transition,
            'elapsed_seconds': max(last, action_times[-1]) - start['monotonic'], 'polls': len(polls),
            'log': point, 'reviewed_lines': details['lines'], 'implicit_reloads': 1,
            'native_dispatch_continuity': 'NOT_PERFORMED', 'live_reference_health': 'UNKNOWN', 'in_memory_rollback': 'UNKNOWN'}


@_fail_closed
def validate_restoration(base, phase, manifest, identity):
    result = validate_transition(base, phase, manifest, identity, 'restoration')
    receipt = read_json(manifest['restoration_receipt'])
    snapshot = read_json(receipt['final_state'])
    # Unlike historical receipt review, acceptance of restoration includes fresh
    # disk reads. UI/process freshness still belongs to the supervised collector.
    _protected_and_inventory(base, phase, manifest, snapshot, 'stock', actual=True)
    result['status'] = 'RECORDED_RESTORATION_AND_CURRENT_SAVED_FILES_VERIFIED'
    result['current_ui_process'] = 'UNKNOWN_REQUIRES_SUPERVISED_FRESH_OBSERVATION'
    result['current_log'] = 'UNKNOWN_REQUIRES_FRESH_SOURCE_CONTINUITY_CHECK'
    return result


def template_fields():
    """Incomplete, explicitly non-executable manifest fields for preparation."""
    pin = lambda: {'path': 'REQUIRES_REVIEWED_EXACT_PATH', 'bytes': 0, 'sha256': 'REQUIRES_FRESH_SHA256'}
    return {'predecessor': dict(attempt_id='REQUIRES_HISTORICAL_ATTEMPT',
            **{k: pin() for k in ('report', 'manifest', 'entry', 'helper', 'base_helper', 'review', 'baseline', 'post_verification', 'continuity')},
            files=[{'export': pin(), 'inventory': pin()} for _ in range(5)],
            intervening=[{'role': role, 'receipt': pin()} for role in ('selection', 'restoration')]),
            'selection_receipt': pin(), 'restoration_receipt': None, 'dispatch_log': pin(),
            'native_dispatch_continuity': 'REQUIRES_REVIEWED_PREFIX_AND_EXACT_ENTRY_ECHO'}


def transition_template():
    """Schema documentation only: placeholders deliberately fail admission."""
    pin = {'path': 'REQUIRES_EXACT_PATH', 'bytes': 0, 'sha256': 'REQUIRES_SHA256'}
    stamp = {'utc': 'REQUIRES_UTC', 'monotonic': None, 'clock_domain': 'REQUIRES_VERIFIED_DOMAIN'}
    timing = {name: dict(stamp) for name in ('submitted', 'started', 'completed', 'returned')}
    point = {'source_log_path': 'REQUIRES_SOURCE_PATH', 'stat_identity': [], 'prefix_bytes': 0, 'prefix_sha256': 'REQUIRES_SHA256'}
    common = {'editor_identity': {}, 'engine_version': ENGINE_VERSION, 'attempt_id': 'REQUIRES_NEW_ATTEMPT'}
    return {
        'review': dict(common, schema_version=1, protocol=PROTOCOL, transition='selection', status='PROPOSED_NON_EXECUTABLE',
                       reviewer='', reviewed_at_utc='', pre_click=dict(pin), action=dict(pin), polls=[], final_state=dict(pin),
                       log_review=dict(pin), final_log=dict(point), live_reference_health='UNKNOWN', in_memory_rollback='UNKNOWN'),
        'before': dict(common, transition='selection', clock_source='time.monotonic', clock_domain='', clock_domain_verified=False,
                       start=dict(stamp), durable_written_at=dict(stamp), ui={'capture': dict(pin), 'receipt': dict(pin)},
                       log=dict(point), log_prefix_file=dict(pin), intervening_lines=[], state={}, eligibility_review=None),
        'action': dict(common, transition='selection', pre_click_sha256='', selection_clicks=0, result='NOT_PERFORMED',
                       timing=timing, observation_call_count=0, uncounted_observation_calls=0, explicit_loads=0, explicit_reloads=0,
                       asset_edits=0, saves=0, compiles=0, dialog_dismissals=0, restarts=0),
        'poll': dict(common, poll_id=1, kind='explicit', result='NOT_PERFORMED', timing=timing, elapsed_seconds=None,
                     unsafe_conditions_observed=[],
                     ui={'capture': dict(pin), 'receipt': dict(pin)}, log=dict(source_log_path='', stat_identity=[],
                     start_byte=0, end_byte=0, source_prefix_sha256='', file=dict(pin), read_started=dict(stamp), read_completed=dict(stamp),
                     truncated=False, rotated=False)),
        'ui': dict(common, capture=dict(pin), active_mod='', responsive=False, main_window_foreground=False,
                   exclusive_owner=False, modal_visible=None, human_intervention=None, pending_tool_work=None,
                   observed_at=dict(stamp), reviewer='', interpretation=''),
        'state': dict(common, observed_at=dict(stamp), ui={'capture': dict(pin), 'receipt': dict(pin)}, selection=[],
                      protected_files=[], mod_inventory=[], descriptors=[], inventory_complete=False,
                      inventory_differences={'added': [], 'removed': [], 'changed': []}),
        'log_review': {'source': dict(point), 'file': dict(pin), 'end_byte': 0, 'lines': []},
        'line': {'start_byte': 0, 'end_byte': 0, 'text': '', 'channel': '', 'operation': '', 'path': '',
                 'interpretation': '', 'reviewer': '', 'disposition': 'UNREVIEWED'},
        'dispatch_log_review': dict(common, status='PROPOSED_NON_EXECUTABLE', reviewer='', selection_receipt=dict(pin),
                                   entry_file=dict(pin), expected_command='', reviewed_at_utc='', expires_at_utc='',
                                   log=dict(point), prefix_file=dict(pin), intervening_lines=[], log_timestamp_basis='UTC_OBSERVED_EDITOR_LOG',
                                   ui={'capture': dict(pin), 'receipt': dict(pin)}),
        'restoration_eligibility_review': dict(common, status='PROPOSED_NON_EXECUTABLE', selection_receipt=dict(pin),
                                              ui={'capture': dict(pin), 'receipt': dict(pin)}, state={}, log=dict(point),
                                              unsafe_conditions_observed=[], reviewer='', reason='', reviewed_at_utc='',
                                              outcome='NOT_PERFORMED_COMPARISON_ONLY_STOP', diagnostic_report=None, diagnostic_manifest=None),
    }
