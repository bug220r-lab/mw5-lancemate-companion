"""Fixed already-loaded reflection probe. Does not invoke the three functions.

The installed API documents find_object(outer, name), so this probe never guesses
a combined UFunction object-path separator. Export coverage is an observation,
not proof that Blueprint pins or all parameter/metadata flags were captured.
"""
from datetime import datetime, timezone
import hashlib
import inspect
import json
import os
from pathlib import Path
import shutil
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'research/evidence/phase-b-reflected-functions-20260927-01'
BASELINE = ROOT / 'research/evidence/phase-b-typed-variable-proof-20260927-01/typed.COPY'
BASELINE_SHA = 'faf4d7cce4a304693576c9c2207b61a85b79987104d31e71b116ba6e43ffa829'
SCRATCH = '/Game/CodexEditorControlScratch20260925/BP_CodexAuthoringProbe.BP_CodexAuthoringProbe'
SOURCE = Path('C:/Program Files/Epic Games/MechWarrior5Editor/MW5Mercs/Content/'
              'CodexEditorControlScratch20260925/BP_CodexAuthoringProbe.uasset')
BACKUP = ROOT / 'artifacts/editor-authoring-probe-20260925/BP_CodexAuthoringProbe.uasset'
SOURCE_SHA = '0b7d06f0004d67d1944cd288b44a4b63d7f95d4e17de22b8ee828f4f96f0b6dc'
PROPERTY_HELPER = ROOT / 'scripts/Probe-BlueprintPropertyReadAccess.py'
PROPERTY_HELPER_SHA256 = 'c2ff9478c18a2e43cc8ab5304b0f66e631843068101dd65e970aa361b9e3399d'
PARENTS = ('/Script/Engine.GameplayStatics', '/Script/Engine.KismetStringLibrary')
TARGETS = (
    (PARENTS[0], 'GetObjectClass', '01-GetObjectClass.COPY'),
    (PARENTS[0], 'IsGamePaused', '02-IsGamePaused.COPY'),
    (PARENTS[1], 'GetCharacterAsNumber', '03-GetCharacterAsNumber.COPY'),
)


def read_pinned(path, size, expected):
    if not path.is_file() or path.is_symlink() or path.resolve() != path.absolute():
        raise ValueError('Pinned path missing or redirected: ' + str(path))
    if getattr(path.lstat(), 'st_file_attributes', 0) & 0x400 or path.stat().st_size != size:
        raise ValueError('Pinned file size/reparse mismatch: ' + str(path))
    with path.open('rb') as stream:
        raw = stream.read(size + 1)
    if len(raw) != size or hashlib.sha256(raw).hexdigest() != expected:
        raise ValueError('Pinned file bytes changed: ' + str(path))
    return raw


def verify_directory():
    if OUTPUT.is_symlink() or (OUTPUT.exists() and getattr(OUTPUT.lstat(), 'st_file_attributes', 0) & 0x400):
        raise ValueError('Output directory redirect rejected')
    if OUTPUT.resolve() != OUTPUT.absolute():
        raise ValueError('Exact output directory resolution changed')


def guard(started):
    if time.monotonic() - started > 60:
        raise ValueError('Reflection probe elapsed-time bound exceeded')
    verify_directory()
    read_pinned(BASELINE, 36240, BASELINE_SHA)
    read_pinned(SOURCE, 28153, SOURCE_SHA)
    read_pinned(BACKUP, 28153, SOURCE_SHA)


def object_record(obj):
    return {'name': str(obj.get_name()), 'path': str(obj.get_path_name()),
            'class': str(obj.get_class().get_path_name())}


def run(api):
    if os.getpid() != 26084 or api is not sys.modules.get('unreal') or api.__name__ != 'unreal':
        raise ValueError('Exact owned editor and actual imported Unreal module required')
    if len(PROPERTY_HELPER_SHA256) != 64:
        raise ValueError('Property helper has not been pinned; no native work')
    for name in ('find_object', 'find_asset'):
        method = getattr(api, name)
        if hasattr(method, '__code__') or not (inspect.isbuiltin(method) or inspect.ismethoddescriptor(method)):
            raise ValueError('Native lookup binding not established: ' + name)
    started = time.monotonic()
    guard(started)
    verify_directory()
    OUTPUT.mkdir(exist_ok=True)
    guard(started)
    if shutil.disk_usage(OUTPUT).free < 16 * 1024 * 1024:
        raise ValueError('Insufficient bounded evidence disk space')
    claim, result_path = OUTPUT / 'native.consumed.json', OUTPUT / 'native.result.json'
    for path in [claim, result_path] + [OUTPUT / row[2] for row in TARGETS]:
        if path.exists():
            raise ValueError('One-use reflection evidence already exists; no retry')
    property_size = PROPERTY_HELPER.stat().st_size
    if not 0 < property_size <= 32768:
        raise ValueError('Property helper outside read bound')
    property_bytes = read_pinned(PROPERTY_HELPER, property_size, PROPERTY_HELPER_SHA256)
    namespace = {'__file__': str(PROPERTY_HELPER), '__name__': 'pinned_blueprint_property_probe'}
    exec(compile(property_bytes, str(PROPERTY_HELPER), 'exec'), namespace)
    if not callable(namespace.get('read_loaded_blueprint')):
        raise ValueError('Pinned property helper interface missing')
    guard(started)
    with claim.open('x', encoding='utf-8') as stream:
        json.dump({'utc': datetime.now(timezone.utc).isoformat(), 'pid': os.getpid(),
                   'scope': 'two loaded classes, three exact child names, one loaded scratch Blueprint; no function invocation'}, stream)
    record = {'status': 'STARTED', 'pid': os.getpid(), 'roots': [], 'functions': [],
              'counters': {'class_finds': 0, 'function_finds': 0, 'scratch_finds': 0, 'export_attempts': 0, 'function_invocations': 0, 'asset_loads': 0},
              'baseline': {'path': str(BASELINE), 'bytes': 36240, 'sha256': BASELINE_SHA},
              'property_helper_sha256': PROPERTY_HELPER_SHA256,
              'limitations': ['Already-loaded lookup and COPY export only; no target function is called.',
                  'A UFunction export may omit parameters/flags; native Blueprint pin layout remains UNKNOWN until source reviewed.',
                  'Property spellings are bounded read-access observations, not permission to mutate Blueprint fields.',
                  'No world state, component query, clipboard, input, compile, save, package or retail action.']}
    try:
        roots = {}
        for path in PARENTS:
            guard(started)
            record['counters']['class_finds'] += 1
            obj = api.find_object(None, path, follow_redirectors=False)
            guard(started)
            if obj is None:
                record['roots'].append({'requested': path, 'status': 'NOT_ALREADY_LOADED'})
                continue
            info = object_record(obj)
            if info['path'] != path or info['name'] != path.rsplit('.', 1)[-1] or info['class'] != '/Script/CoreUObject.Class':
                raise ValueError('Unexpected loaded parent class identity')
            record['roots'].append({'requested': path, 'status': 'OBSERVED', **info})
            roots[path] = obj
        for parent_path, name, filename in TARGETS:
            item = {'parent': parent_path, 'requested_child_name': name}
            record['functions'].append(item)
            if parent_path not in roots:
                item['status'] = 'PARENT_NOT_ALREADY_LOADED'
                continue
            guard(started)
            record['counters']['function_finds'] += 1
            obj = api.find_object(roots[parent_path], name, follow_redirectors=False)
            guard(started)
            if obj is None:
                item['status'] = 'EXACT_CHILD_NOT_ALREADY_LOADED'
                continue
            item['observed'] = object_record(obj)
            outer = obj.get_outer()
            item['outer_path'] = str(outer.get_path_name()) if outer is not None else None
            if item['observed']['name'] != name or item['outer_path'] != parent_path:
                raise ValueError('Exact child identity or parent mismatch')
            if str(obj.get_class().get_name()) != 'Function':
                item['status'] = 'OBSERVED_NON_FUNCTION_CLASS_NO_EXPORT'
                continue
            exporter = api.ObjectExporterT3D()
            if not bool(exporter.get_editor_property('text')) or 'copy' not in [str(x).lower() for x in exporter.get_editor_property('format_extension')]:
                raise ValueError('COPY export not advertised by known exporter')
            destination = OUTPUT / filename
            if destination.exists():
                raise ValueError('Fixed export destination appeared; no overwrite')
            task = api.AssetExportTask()
            for key, value in {'object': obj, 'exporter': exporter, 'filename': str(destination),
                               'automated': True, 'prompt': False, 'replace_identical': False,
                               'selected': False, 'use_file_archive': False, 'write_empty_files': False}.items():
                task.set_editor_property(key, value)
            guard(started)
            record['counters']['export_attempts'] += 1
            item['returned'] = bool(api.Exporter.run_asset_export_task(task))
            guard(started)
            item['errors'] = [str(x)[:1000] for x in task.get_editor_property('errors')][:10]
            item['status'] = 'EXPORT_UNAVAILABLE_OR_FAILED'
            if destination.is_file():
                size = destination.stat().st_size
                if not 0 < size < 1024 * 1024:
                    raise ValueError('Function COPY exceeds size bound or empty')
                with destination.open('rb') as stream:
                    raw = stream.read(size + 1)
                if len(raw) != size:
                    raise ValueError('Function COPY changed while reading')
                item['export'] = {'path': str(destination), 'bytes': size, 'sha256': hashlib.sha256(raw).hexdigest()}
            if item['returned'] and not item['errors'] and 'export' in item:
                item['status'] = 'EXPORTED_PARAMETER_COVERAGE_REQUIRES_REVIEW'
        guard(started)
        record['counters']['scratch_finds'] += 1
        scratch = api.find_asset(SCRATCH, type=api.Blueprint, follow_redirectors=False)
        guard(started)
        if scratch is None or str(scratch.get_path_name()) != SCRATCH or str(scratch.get_class().get_path_name()) != '/Script/Engine.Blueprint':
            raise ValueError('Exact scratch Blueprint not already loaded')
        record['blueprint_read_access'] = namespace['read_loaded_blueprint'](scratch)
        guard(started)
        record['status'] = 'OBSERVED_READ_ONLY_REFLECTION_REQUIRES_REVIEW'
    except Exception as error:
        record['status'] = 'STOPPED_NO_RETRY_REQUIRES_REVIEW'
        record['error'] = {'type': type(error).__name__, 'message': str(error)[:1500]}
    record['finished_utc'] = datetime.now(timezone.utc).isoformat()
    record['elapsed_seconds'] = time.monotonic() - started
    verify_directory()
    payload = json.dumps(record, ensure_ascii=True, indent=2) + '\n'
    if len(payload.encode('ascii')) > 256 * 1024:
        raise ValueError('Reflection result exceeded bound; claim remains consumed')
    with result_path.open('x', encoding='ascii') as stream:
        stream.write(payload)
    return record
