"""One-stage, already-loaded-only export of the saved-checkpoint separate full PCC capture type proof.

No asset load/edit/save/compile, clipboard access, input, game call or retry.
Invoke run from a separately prepared, hash-pinned stage entry in the editor.
"""
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OBJECT = '/Game/CodexEditorControlScratch20260925/BP_CodexAuthoringProbe.BP_CodexAuthoringProbe'
SOURCE = Path('C:/Program Files/Epic Games/MechWarrior5Editor/MW5Mercs/Content/'
              'CodexEditorControlScratch20260925/BP_CodexAuthoringProbe.uasset')
SOURCE_SHA = '4a19924a8bb305d5e449e851c508fb7d0cafeccce8961e77f2a351f627583b32'
SOURCE_BYTES = 834972
BACKUP_SHA = '0b7d06f0004d67d1944cd288b44a4b63d7f95d4e17de22b8ee828f4f96f0b6dc'
CHECKPOINT = ROOT / 'artifacts/phase-b-scratch-saved-checkpoint-20260927T130837Z/BP_CodexAuthoringProbe.uasset'
OUTPUT = ROOT / 'research/evidence/phase-b0-capture-type-function-native-02'
BASELINE = ROOT / 'research/evidence/phase-b-fixed-text-fixtures-native-01/fixtures.COPY'
BASELINE_SHA = '245dcd262b233bddc77116e4393c780501394654f71ab1823e6364106e46b34e'
BASELINE_BYTES = 2229892  # Observed UTF-16LE BOM export; separately reviewed after the old 2 MiB stop.
MAX_EXPORT_BYTES = 4 * 1024 * 1024  # Post-export raw-byte review cap; cannot preempt the synchronous exporter.
BACKUP = ROOT / 'artifacts/editor-authoring-probe-20260925/BP_CodexAuthoringProbe.uasset'


def verify_output_directory():
    expected = ROOT / 'research/evidence/phase-b0-capture-type-function-native-02'
    if OUTPUT.is_symlink() or (OUTPUT.exists() and getattr(OUTPUT.lstat(), 'st_file_attributes', 0) & 0x400):
        raise ValueError('Evidence directory redirect rejected')
    if OUTPUT.resolve() != expected.absolute():
        raise ValueError('Exact evidence directory resolution changed')


def run(api, stage, editor_pid):
    if api.__name__ != 'unreal' or type(editor_pid) is not int or editor_pid != 26084 or os.getpid() != editor_pid:
        raise ValueError('Exact editor API/process required')
    if stage != 'full':
        raise ValueError('Unknown proof stage')
    if SOURCE.stat().st_size != SOURCE_BYTES or hashlib.sha256(SOURCE.read_bytes()).hexdigest() != SOURCE_SHA:
        raise ValueError('Disposable source changed; review before continuing')
    if BACKUP.stat().st_size != 28153 or hashlib.sha256(BACKUP.read_bytes()).hexdigest() != BACKUP_SHA:
        raise ValueError('Preserved scratch backup changed; review before continuing')
    if CHECKPOINT.stat().st_size != SOURCE_BYTES or hashlib.sha256(CHECKPOINT.read_bytes()).hexdigest() != SOURCE_SHA:
        raise ValueError('Saved scratch checkpoint changed; review before continuing')
    if BASELINE.stat().st_size != BASELINE_BYTES or hashlib.sha256(BASELINE.read_bytes()).hexdigest() != BASELINE_SHA:
        raise ValueError('Pinned retained template export changed; review before continuing')
    verify_output_directory()
    OUTPUT.mkdir(exist_ok=True)
    verify_output_directory()
    claim = OUTPUT / (stage + '.consumed.json')
    destination = OUTPUT / (stage + '.COPY')
    result_path = OUTPUT / (stage + '.result.json')
    if any(os.path.lexists(str(path)) for path in (destination, result_path, claim)):
        raise ValueError('Stage evidence already exists; no native work performed')
    verify_output_directory()
    with claim.open('x', encoding='utf-8') as stream:
        json.dump({'utc': datetime.now(timezone.utc).isoformat(), 'pid': editor_pid, 'stage': stage}, stream)
    record = {'status': 'STARTED', 'stage': stage, 'pid': editor_pid, 'object': OBJECT,
              'source_sha256': SOURCE_SHA, 'original_backup_sha256': BACKUP_SHA, 'native_actions': 'find already-loaded object and export only',
              'runtime': 'NOT_PERFORMED',
              'baseline_export': {'path': str(BASELINE), 'bytes': BASELINE_BYTES, 'sha256': BASELINE_SHA},
              'max_export_bytes': MAX_EXPORT_BYTES,
              'baseline_semantics': 'SEPARATE_OFFLINE_REVIEW_REQUIRED'}
    try:
        obj = api.find_asset(OBJECT, type=api.Blueprint, follow_redirectors=False)
        if obj is None or obj.get_path_name() != OBJECT or obj.get_class().get_path_name() != '/Script/Engine.Blueprint':
            raise ValueError('Exact disposable Blueprint is not already loaded')
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
        verify_output_directory()
        record['returned'] = bool(api.Exporter.run_asset_export_task(task))
        verify_output_directory()
        record['errors'] = [str(error)[:1000] for error in task.get_editor_property('errors')][:10]
        if not record['returned'] or record['errors'] or not destination.is_file():
            raise ValueError('Native export did not succeed')
        size = destination.stat().st_size
        if not 0 < size <= MAX_EXPORT_BYTES:
            raise ValueError('Export outside review size bound')
        record['export'] = {'path': str(destination), 'bytes': size,
                            'sha256': hashlib.sha256(destination.read_bytes()).hexdigest()}
        if hashlib.sha256(SOURCE.read_bytes()).hexdigest() != SOURCE_SHA:
            raise ValueError('Source changed during read-only export')
        if BACKUP.stat().st_size != 28153 or hashlib.sha256(BACKUP.read_bytes()).hexdigest() != BACKUP_SHA:
            raise ValueError('Backup changed during read-only export')
        if CHECKPOINT.stat().st_size != SOURCE_BYTES or hashlib.sha256(CHECKPOINT.read_bytes()).hexdigest() != SOURCE_SHA:
            raise ValueError('Saved scratch checkpoint changed during read-only export')
        record['status'] = 'EXPORTED_REQUIRES_GRAPH_REVIEW'
    except Exception as error:
        record['status'] = 'STOPPED_NO_RETRY'
        record['error'] = str(error)
    record['finished_utc'] = datetime.now(timezone.utc).isoformat()
    verify_output_directory()
    with result_path.open('x', encoding='utf-8') as stream:
        json.dump(record, stream, indent=2)
        stream.write('\n')
    api.log('MW5_SAVED_DISPOSABLE_FULL_PCC_CAPTURE_TYPES: ' + record['status'] + ' ' + stage)
    return record
