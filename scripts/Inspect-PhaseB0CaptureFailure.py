"""Failed-Capture loaded-only source preservation export of the exact diagnostic controller and widget.

No load fallback, asset edit/save/compile, clipboard, input, gameplay or retry.
Run only from the separately reviewed process/time/hash-pinned native entry.
"""
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'research/evidence/phase-b0-capture-failure-native-01'
MANIFEST = OUTPUT / 'protected-inputs.json'
MANIFEST_SHA = '5beac88296e5865892bb30b612819994f944e143b9fd88f9aafdf831675286c3'
MAX_EXPORT_BYTES = 4 * 1024 * 1024
TARGETS = (
    ('controller', '/ModOverride/LanceObserverDiagnosticControl/Modes/InstantAction/InstantActionPlayerController.InstantActionPlayerController', '/Script/Engine.Blueprint'),
    ('widget', '/LanceObserverDiagnosticControl/WBP_ObserverDiagnosticControl.WBP_ObserverDiagnosticControl', '/Script/UMGEditor.WidgetBlueprint'),
)


def checked_bytes(path, size, sha):
    if not path.is_file() or path.is_symlink() or path.resolve() != path.absolute():
        raise ValueError('Protected input missing or redirected: ' + str(path))
    if getattr(path.lstat(), 'st_file_attributes', 0) & 0x400 or path.stat().st_size != size:
        raise ValueError('Protected input size or reparse mismatch: ' + str(path))
    with path.open('rb') as stream:
        raw = stream.read(size + 1)
    if len(raw) != size or hashlib.sha256(raw).hexdigest() != sha:
        raise ValueError('Protected input hash changed: ' + str(path))
    return raw


def protected_inputs():
    if MANIFEST.stat().st_size > 65536:
        raise ValueError('Manifest exceeds fixed read bound')
    raw = checked_bytes(MANIFEST, MANIFEST.stat().st_size, MANIFEST_SHA)
    manifest = json.loads(raw.decode('utf-8'))
    if manifest['status'] != 'PREPARED_READ_ONLY_B0_CAPTURE_FAILURE' or len(manifest['protected_files']) != 27:
        raise ValueError('Protected scope changed')
    for row in manifest['protected_files'] + manifest['backup_and_history_files']:
        checked_bytes(Path(row['path']), row['bytes'], row['sha256'])
    anchor = manifest['log_anchor']
    log_path, size = Path(anchor['path']), anchor['prefix_bytes']
    if type(size) is not int or not 0 < size <= 4 * 1024 * 1024:
        raise ValueError('Log prefix outside fixed read bound')
    if not log_path.is_file() or log_path.is_symlink() or log_path.resolve() != log_path.absolute():
        raise ValueError('Owned editor log missing or redirected')
    if getattr(log_path.lstat(), 'st_file_attributes', 0) & 0x400 or log_path.stat().st_size < size:
        raise ValueError('Owned editor log shrank or became redirected')
    with log_path.open('rb') as stream:
        prefix = stream.read(size)
    if len(prefix) != size or hashlib.sha256(prefix).hexdigest() != anchor['prefix_sha256']:
        raise ValueError('Owned editor log prefix changed')
    return manifest


def verify_output_directory():
    expected = ROOT / 'research/evidence/phase-b0-capture-failure-native-01'
    if OUTPUT.is_symlink() or (OUTPUT.exists() and getattr(OUTPUT.lstat(), 'st_file_attributes', 0) & 0x400):
        raise ValueError('Evidence directory redirect rejected')
    if OUTPUT.resolve() != expected.absolute():
        raise ValueError('Exact evidence directory resolution changed')


def run(api, stage, editor_pid):
    if api.__name__ != 'unreal' or type(editor_pid) is not int or editor_pid != 26084 or os.getpid() != editor_pid:
        raise ValueError('Exact editor API/process required')
    if stage != 'failure':
        raise ValueError('Unknown stage')
    if MANIFEST_SHA.startswith('PENDING_'):
        raise ValueError('DORMANT: failed-Capture manifest and entry not activated')
    protected_inputs()
    verify_output_directory()
    OUTPUT.mkdir(exist_ok=True)
    verify_output_directory()
    claim = OUTPUT / 'failure.consumed.json'
    result_path = OUTPUT / 'failure.result.json'
    destinations = {label: OUTPUT / (label + '.COPY') for label, _, _ in TARGETS}
    if any(os.path.lexists(str(p)) for p in [claim, result_path] + list(destinations.values())):
        raise ValueError('Stage evidence already exists; no native work performed')
    with claim.open('x', encoding='utf-8') as stream:
        json.dump({'utc': datetime.now(timezone.utc).isoformat(), 'pid': editor_pid, 'stage': stage}, stream)
    record = {'status': 'STARTED', 'stage': stage, 'pid': editor_pid, 'targets': [],
              'native_actions': 'Find exactly two already-loaded assets, then export their source only.',
              'source_changes': 'NOT_PERFORMED', 'runtime': 'NOT_PERFORMED',
              'limitations': 'Sequential observation; synchronous exporter cap is post-call. Native source requires independent comparison.'}
    try:
        loaded = []
        for label, object_path, class_path in TARGETS:
            obj = api.find_asset(object_path, type=api.Blueprint, follow_redirectors=False)
            if obj is None or obj.get_path_name() != object_path or obj.get_class().get_path_name() != class_path:
                raise ValueError('Exact ' + label + ' is not already loaded; no loading fallback')
            loaded.append((label, object_path, class_path, obj))
        for label, object_path, class_path, obj in loaded:
            protected_inputs()
            destination = destinations[label]
            if os.path.lexists(str(destination)):
                raise ValueError('Export destination exists')
            exporter = api.ObjectExporterT3D()
            if not bool(exporter.get_editor_property('text')) or 'copy' not in [str(x).lower() for x in exporter.get_editor_property('format_extension')]:
                raise ValueError('COPY export not advertised')
            task = api.AssetExportTask()
            for key, value in {'object': obj, 'exporter': exporter, 'filename': str(destination),
                               'automated': True, 'prompt': False, 'replace_identical': False,
                               'selected': False, 'use_file_archive': False, 'write_empty_files': False}.items():
                task.set_editor_property(key, value)
            item = {'label': label, 'object': object_path, 'class': class_path}
            record['targets'].append(item)
            verify_output_directory()
            item['returned'] = bool(api.Exporter.run_asset_export_task(task))
            verify_output_directory()
            item['errors'] = [str(e)[:1000] for e in task.get_editor_property('errors')][:10]
            if not item['returned'] or item['errors'] or not destination.is_file():
                raise ValueError('Native export failed: ' + label)
            size = destination.stat().st_size
            if not 0 < size <= MAX_EXPORT_BYTES:
                raise ValueError('Export outside review bound: ' + label)
            item['export'] = {'path': str(destination), 'bytes': size,
                              'sha256': hashlib.sha256(destination.read_bytes()).hexdigest()}
        protected_inputs()
        record['status'] = 'EXPORTED_AFTER_FAILED_COMPILE_REQUIRES_REVIEW'
    except Exception as error:
        record['status'] = 'STOPPED_NO_RETRY'
        record['error'] = str(error)
    record['finished_utc'] = datetime.now(timezone.utc).isoformat()
    verify_output_directory()
    with result_path.open('x', encoding='utf-8') as stream:
        json.dump(record, stream, indent=2)
        stream.write('\n')
    api.log('MW5_B0_CAPTURE_FAILURE: ' + record['status'])
    return record
