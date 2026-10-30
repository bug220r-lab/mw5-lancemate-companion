"""Human-operated admission for the pinned, already-loaded-only collection worker.

This is a separate admission route, not a passing automated transition receipt.
It preserves the old modules and reuses only their collection worker after the
manual evidence, live process/files and exact console invocation are validated.
No automatic UI input, selection, loading, saving or recovery is implemented.
"""
import datetime
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import shutil
import sys
import time

ROOT = Path(__file__).resolve().parent.parent
CORE = ROOT / 'scripts/Inspect-DiagnosticPostReload.py'
CORE_SHA = 'aa09f44960508e4fe98b8b9551da7e3675d2c79f287ccd3794afc9735252071a'
ROUTE = 'MANUAL_DIAGNOSTIC_LOADED_ONLY_V1'
SELECTION = ROOT / 'research/evidence/diagnostic-manual-selection-20260927T040217Z-8d849d36'
CHECKS = ('process_identity_and_responsiveness', 'protected_files', 'diagnostic_markers',
          'only_expected_marker_inventory_changes', 'logs_stable', 'samples_two_seconds_apart',
          'all_lines_reviewed', 'exactly_one_diagnostic_reload', 'complete_lines', 'no_warning_error_ensure')


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def require(condition, message):
    if not condition:
        raise ValueError(message)


def core_module():
    source = CORE.read_bytes()
    require(digest(source) == CORE_SHA, 'COLLECTION_WORKER_CHANGED')
    module = importlib.util.module_from_spec(importlib.util.spec_from_file_location('_manual_collection_worker', CORE))
    exec(compile(source, str(CORE), 'exec'), module.__dict__)
    return module


def read_pin(core, record, exact=None, limit=512 * 1024**2):
    path = core.exact_path(record['path'])
    require(exact is None or path == Path(exact), 'UNEXPECTED_PIN_PATH')
    require(type(record['bytes']) is int and 0 <= record['bytes'] <= limit, 'PIN_SIZE_LIMIT')
    with path.open('rb') as stream:
        raw = stream.read(record['bytes'] + 1)
    require(len(raw) == record['bytes'] and digest(raw) == record['sha256'], 'PIN_CHANGED')
    return raw


def render_entry(manifest_path, manifest_sha, helper_sha):
    helper = ROOT / 'scripts/Inspect-DiagnosticManual.py'
    return ("import hashlib, importlib.util, pathlib, unreal\n"
            "p = pathlib.Path(%r)\nb = p.read_bytes()\n"
            "if hashlib.sha256(b).hexdigest() != %r: raise RuntimeError('MANUAL_HELPER_CHANGED')\n"
            "m = importlib.util.module_from_spec(importlib.util.spec_from_file_location('_manual_diagnostic', p))\n"
            "exec(compile(b, str(p), 'exec'), m.__dict__)\n"
            "r = m.run_native(unreal, %r, %r)\n"
            "print('MW5_MANUAL_DIAGNOSTIC_RESULT', r['status'], r['output_directory'])\n"
            % (str(helper), helper_sha, str(manifest_path), manifest_sha)).encode('utf-8')


def check_log(record, expected_command, since, now):
    require(record.get('python_stat_version') == list(sys.version_info[:3]), 'LOG_IDENTITY_RUNTIME_MISMATCH')
    path = Path(record['path'])
    before = path.stat()
    require([before.st_dev, before.st_ino] == record['stat_identity'], 'LOG_ROTATED')
    require(record['bytes'] <= before.st_size <= record['bytes'] + 4096, 'UNEXPECTED_LOG_LENGTH')
    with path.open('rb') as stream:
        raw = stream.read(record['bytes'] + 4097)
    after = path.stat()
    require((before.st_dev, before.st_ino, before.st_size, before.st_mtime_ns) ==
            (after.st_dev, after.st_ino, after.st_size, after.st_mtime_ns), 'LOG_CHANGED_DURING_READ')
    require(digest(raw[:record['bytes']]) == record['sha256'], 'LOG_PREFIX_CHANGED')
    tail = raw[record['bytes']:].decode('utf-8')
    match = re.fullmatch(r'\[([^\]]+)\]\[\s*\d+\]Cmd: ' + re.escape(expected_command) + r'\r?\n', tail)
    require(match is not None, 'EXACT_SINGLE_COMMAND_ECHO_REQUIRED')
    stamp = datetime.datetime.strptime(match.group(1), '%Y.%m.%d-%H.%M.%S:%f').replace(tzinfo=datetime.timezone.utc)
    require(since <= stamp <= now, 'COMMAND_OUTSIDE_REVIEW_WINDOW')


def validate_contract(core, base, phase, manifest, identity, now):
    require(manifest.get('admission_route') == ROUTE and manifest.get('status') == 'REVIEWED_MANUAL_NATIVE_READY',
            'REVIEWED_MANUAL_ROUTE_REQUIRED')
    require(manifest.get('operator') == 'USER_CONSOLE' and
            manifest.get('automated_transition_acceptance') == 'NOT_USED_NOT_PASSED', 'HUMAN_ROUTE_REQUIRED')
    require(manifest.get('editor_identity') == identity and Path(identity['executable']) == base.EDITOR_EXE,
            'EDITOR_IDENTITY_CHANGED')
    require(all(manifest.get(k) == v for k, v in core.plan(base).items()) and
            manifest.get('allow_load') is False and manifest.get('allow_exact_root_load') is False, 'FIXED_SCOPE_REQUIRED')
    since = datetime.datetime.fromisoformat(manifest['reviewed_at_utc'])
    require(since.tzinfo is not None and 0 <= (now - since).total_seconds() <= 600, 'REVIEW_EXPIRED')
    require(manifest.get('protected_files') == base.fixed_protected_inputs(), 'EXACT_PROTECTED_PINS_REQUIRED')
    require(manifest.get('selection') == phase.expected_selection(phase.mod_roots(base), 'diagnostic'),
            'EXACT_DIAGNOSTIC_SELECTION_REQUIRED')
    review = json.loads(read_pin(core, manifest['selection_review'], SELECTION / 'selection-review.json', 128*1024))
    require(review.get('protocol') == 'MANUAL_SELECTION_STATE_REVIEW_V1' and
            review.get('status') == 'PASS_MANUAL_SELECTION_STATE_REVIEW' and
            set(review.get('checks', {})) == set(CHECKS) and all(review['checks'][k] is True for k in CHECKS),
            'MANUAL_SELECTION_REVIEW_REQUIRED')
    require(review['editor_identity'] == identity and review['selection'] == manifest['selection'] and
            review['mod_inventory'] == manifest['mod_inventory'], 'MANUAL_REVIEW_BINDING_MISMATCH')
    read_pin(core, review['screenshot']['file'], SELECTION / 'user-after-selection.png', 8*1024**2)
    baseline = json.loads(read_pin(core, manifest['manual_baseline'], SELECTION / 'baseline.json', 128*1024))
    require(baseline['editor_identity'] == identity and baseline['protected_files'] == manifest['protected_files'],
            'MANUAL_BASELINE_BINDING_MISMATCH')
    for sample in review['log_samples']:
        read_pin(core, sample['file'], limit=256*1024)
    selected_end = review['log_samples'][-1]['end_byte']
    if manifest['pre_dispatch_log']['bytes'] != selected_end:
        closure_path = ROOT / 'research/evidence/diagnostic-manual-inspection-20260927T041030Z-1c299360/FAILURE_REVIEW.json'
        closure = json.loads(read_pin(core, manifest.get('continuation_review', {}), closure_path, 128*1024))
        require(closure.get('status') == 'PASS_ADMISSION_FAILURE_CLOSURE' and closure.get('failure') == 'LOG_ROTATED'
                and closure.get('editor_identity') == identity and closure.get('claim_absent') is True
                and closure.get('output_absent') is True and closure.get('native_object_inspection') == 'NOT_PERFORMED',
                'REVIEWED_ADMISSION_FAILURE_CLOSURE_REQUIRED')
        failed = closure_path.parent
        require(not (failed / 'diagnostic-native-dispatch-claim.json').exists() and not (failed / 'diagnostic').exists(),
                'FAILED_ATTEMPT_HAS_NATIVE_COLLECTION')
        read_pin(core, closure['failed_manifest'], failed / 'manifest.json', 128*1024)
        read_pin(core, closure['used_source'], failed / 'Inspect-DiagnosticManual.used.py', 128*1024)
        gap = closure['log']
        require(gap['start_byte'] == selected_end and gap['end_byte'] == manifest['pre_dispatch_log']['bytes']
                and gap['path'] == manifest['pre_dispatch_log']['path']
                and gap['prefix_sha256'] == manifest['pre_dispatch_log']['sha256'], 'FAILURE_CONTINUITY_GAP')
        raw = read_pin(core, gap['file'], failed / 'failure-log-span.txt', 256*1024)
        prefix = read_pin(core, gap['prefix_file'], failed / 'after-failure-log.txt', 1024*1024)
        require(len(raw) == gap['end_byte']-gap['start_byte'] and len(prefix) == gap['end_byte']
                and digest(prefix) == gap['prefix_sha256'] and prefix[gap['start_byte']:] == raw, 'FAILURE_LOG_BYTES_CHANGED')
        offset = selected_end
        lines = raw.decode('utf-8').splitlines(keepends=True)
        require(len(lines) == len(closure['lines']) and raw.endswith(b'\n'), 'FAILURE_LINES_INCOMPLETE')
        for line, row in zip(lines, closure['lines']):
            end = offset + len(line.encode('utf-8'))
            require(row['start_byte'] == offset and row['end_byte'] == end and row['text'] == line.rstrip('\r\n')
                    and row['disposition'] == 'REVIEWED_ADMISSION_FAILURE', 'FAILURE_LINE_REVIEW_MISMATCH')
            offset = end
    for record in manifest['review_files']:
        read_pin(core, record, limit=128*1024)
    require(bool(manifest['review_files']), 'SOURCE_REVIEW_REQUIRED')
    return since


def run_native(api, manifest_path, manifest_sha):
    core = core_module()
    base, phase = core.load_base(), core.load_phase()
    require(getattr(api, '__name__', None) == 'unreal', 'NATIVE_EDITOR_API_REQUIRED')
    path = core.exact_path(manifest_path)
    attempt = path.parent
    require(attempt.parent == ROOT / 'research/evidence' and
            re.fullmatch(r'diagnostic-manual-inspection-\d{8}T\d{6}Z-[0-9a-f]{8}', attempt.name) and
            path.name == 'manifest.json', 'EXACT_NEW_ATTEMPT_REQUIRED')
    raw = path.read_bytes()
    require(len(raw) <= 128*1024 and digest(raw) == manifest_sha, 'MANIFEST_CHANGED')
    manifest = json.loads(raw)
    require(manifest['attempt_id'] == attempt.name, 'ATTEMPT_ID_MISMATCH')
    helper_pin = manifest['manual_helper']
    read_pin(core, helper_pin, Path(__file__))
    entry_path = attempt / 'run.py'
    require(core.exact_path(entry_path).read_bytes() == render_entry(path, manifest_sha, helper_pin['sha256']),
            'ENTRY_CHANGED')
    command = 'py "' + os.path.relpath(entry_path, base.EDITOR_EXE.parent).replace('\\', '/') + '"'
    started = time.monotonic()

    def guard():
        require(0 <= time.monotonic() - started <= 90, 'COOPERATIVE_TIME_STOP')
        require(not (attempt / 'STOP').exists(), 'USER_STOP')
        require(digest(path.read_bytes()) == manifest_sha, 'MANIFEST_CHANGED')
        read_pin(core, helper_pin, Path(__file__))
        require(core.exact_path(entry_path).read_bytes() == render_entry(path, manifest_sha, helper_pin['sha256']), 'ENTRY_CHANGED')
        now = datetime.datetime.now(datetime.timezone.utc)
        since = validate_contract(core, base, phase, manifest, base.process_identity(), now)
        core.validate_editor_artifacts(base, phase, manifest)
        require(all(row['matches'] for row in base.protected_snapshot(manifest['protected_files'])), 'PROTECTED_FILE_CHANGED')
        require(base.selection_snapshot(manifest['selection']) == manifest['selection'], 'SELECTION_CHANGED')
        require(phase.snapshot_mod_roots(phase.mod_roots(base)) == manifest['mod_inventory'], 'MOD_INVENTORY_CHANGED')
        require(shutil.disk_usage(attempt).free >= core.LIMITS['disk_free_bytes'], 'DISK_RESOURCE_STOP')
        check_log(manifest['pre_dispatch_log'], command, since, now)
        return {'admission_route': ROUTE, 'operator': 'USER_CONSOLE',
                'automated_transition_acceptance': 'NOT_USED_NOT_PASSED'}

    guard()  # No engine-object query or claim before this alternative admission passes.
    # Explicit new admission uses the existing pinned collection worker, not the
    # old automated run_native entry. Its private token is supplied only here,
    # after the separate manual guard, and never exposed in the user command.
    return core.execute(base, phase, api, manifest, attempt, phase.mod_roots(base),
        lambda _: {'disk_free': shutil.disk_usage(attempt).free}, time.monotonic,
        native=True, guard=guard, _admission=core._NATIVE_ADMISSION_TOKEN, _manifest_sha256=manifest_sha)


if __name__ == '__main__':
    raise SystemExit('Dormant: use the reviewed per-attempt console entry only.')
