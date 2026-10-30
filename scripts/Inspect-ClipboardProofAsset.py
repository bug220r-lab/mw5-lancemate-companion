"""One-stage, already-loaded-only export of the disposable clipboard proof.

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
SOURCE_SHA = '0b7d06f0004d67d1944cd288b44a4b63d7f95d4e17de22b8ee828f4f96f0b6dc'
OUTPUT = ROOT / 'research/evidence/phase-b-clipboard-proof-20260927-01'


def run(api, stage, editor_pid):
    if api.__name__ != 'unreal' or type(editor_pid) is not int or os.getpid() != editor_pid:
        raise ValueError('Exact editor API/process required')
    if stage not in ('before', 'pasted', 'restored'):
        raise ValueError('Unknown proof stage')
    if SOURCE.stat().st_size != 28153 or hashlib.sha256(SOURCE.read_bytes()).hexdigest() != SOURCE_SHA:
        raise ValueError('Disposable source changed; review before continuing')
    if OUTPUT.resolve().parent != (ROOT / 'research/evidence').resolve():
        raise ValueError('Evidence containment failed')
    OUTPUT.mkdir(exist_ok=True)
    claim = OUTPUT / (stage + '.consumed.json')
    destination = OUTPUT / (stage + '.COPY')
    result_path = OUTPUT / (stage + '.result.json')
    if destination.exists() or result_path.exists() or claim.exists():
        raise ValueError('Stage evidence already exists; no native work performed')
    with claim.open('x', encoding='utf-8') as stream:
        json.dump({'utc': datetime.now(timezone.utc).isoformat(), 'pid': editor_pid, 'stage': stage}, stream)
    record = {'status': 'STARTED', 'stage': stage, 'pid': editor_pid, 'object': OBJECT,
              'source_sha256': SOURCE_SHA, 'native_actions': 'find already-loaded object and export only',
              'runtime': 'NOT_PERFORMED'}
    try:
        obj = api.find_asset(OBJECT, type=api.Blueprint, follow_redirectors=False)
        if obj is None or obj.get_path_name() != OBJECT or obj.get_class().get_path_name() != '/Script/Engine.Blueprint':
            raise ValueError('Exact disposable Blueprint is not already loaded')
        if destination.exists():
            raise ValueError('Export destination exists')
        exporter = api.ObjectExporterT3D()
        if not bool(exporter.get_editor_property('text')) or 'copy' not in [str(x).lower() for x in exporter.get_editor_property('format_extension')]:
            raise ValueError('COPY export not advertised')
        task = api.AssetExportTask()
        for key, value in {'object': obj, 'exporter': exporter, 'filename': str(destination),
                           'automated': True, 'prompt': False, 'replace_identical': False,
                           'selected': False, 'use_file_archive': False, 'write_empty_files': False}.items():
            task.set_editor_property(key, value)
        record['returned'] = bool(api.Exporter.run_asset_export_task(task))
        record['errors'] = [str(error)[:1000] for error in task.get_editor_property('errors')][:10]
        if not record['returned'] or record['errors'] or not destination.is_file():
            raise ValueError('Native export did not succeed')
        size = destination.stat().st_size
        if not 0 < size < 1024 * 1024:
            raise ValueError('Export outside review size bound')
        record['export'] = {'path': str(destination), 'bytes': size,
                            'sha256': hashlib.sha256(destination.read_bytes()).hexdigest()}
        if hashlib.sha256(SOURCE.read_bytes()).hexdigest() != SOURCE_SHA:
            raise ValueError('Source changed during read-only export')
        record['status'] = 'EXPORTED_REQUIRES_GRAPH_REVIEW'
    except Exception as error:
        record['status'] = 'STOPPED_NO_RETRY'
        record['error'] = str(error)
    record['finished_utc'] = datetime.now(timezone.utc).isoformat()
    with result_path.open('x', encoding='utf-8') as stream:
        json.dump(record, stream, indent=2)
        stream.write('\n')
    api.log('MW5_DISPOSABLE_CLIPBOARD_PROOF: ' + record['status'] + ' ' + stage)
    return record
