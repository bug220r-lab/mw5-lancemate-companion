"""Read-only editor-world cleanup for the six fixed text-helper fixtures.

Use a separately reviewed, process/hash/expiry-pinned native entry. Never load,
select, spawn, call Blueprint functions, save, switch level or change assets.
"""
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'research/evidence/phase-b-fixture-world-cleanup-20260927-01'
SOURCE = Path('C:/Program Files/Epic Games/MechWarrior5Editor/MW5Mercs/Content/'
              'CodexEditorControlScratch20260925/BP_CodexAuthoringProbe.uasset')
BACKUP = ROOT / 'artifacts/editor-authoring-probe-20260925/BP_CodexAuthoringProbe.uasset'
SOURCE_SHA = '0b7d06f0004d67d1944cd288b44a4b63d7f95d4e17de22b8ee828f4f96f0b6dc'


def exact_directory():
    if not OUTPUT.is_dir() or OUTPUT.resolve() != OUTPUT.absolute():
        raise ValueError('Exact prepared evidence directory required')
    for path in (OUTPUT,) + tuple(OUTPUT.parents):
        if path.is_symlink() or getattr(path.lstat(), 'st_file_attributes', 0) & 0x400:
            raise ValueError('Redirected evidence directory rejected')


def check_source():
    for path in (SOURCE, BACKUP):
        if (not path.is_file() or path.is_symlink() or
                getattr(path.lstat(), 'st_file_attributes', 0) & 0x400 or
                path.stat().st_size != 28153 or
                hashlib.sha256(path.read_bytes()).hexdigest() != SOURCE_SHA):
            raise ValueError('Source or backup changed')


def path_text(obj):
    if obj is None:
        raise ValueError('Unexpected absent object in editor observation')
    value = obj.get_path_name()
    if not isinstance(value, str) or not value or len(value) > 2048:
        raise ValueError('Object path outside observation bound')
    return value


def bounded_objects(values, maximum):
    count = len(values)
    if count > maximum:
        raise ValueError('Editor object count outside observation bound: ' + str(count))
    rows = [{'path': path_text(obj), 'class': path_text(obj.get_class())} for obj in values]
    paths = [row['path'] for row in rows]
    if len(paths) != len(set(paths)):
        raise ValueError('Duplicate editor object identity')
    return sorted(rows, key=lambda row: row['path'])


def run(api):
    if api.__name__ != 'unreal' or os.getpid() != 26084:
        raise ValueError('Owned native editor required')
    exact_directory()
    check_source()
    claim = OUTPUT / 'cleanup.consumed.json'
    destination = OUTPUT / 'cleanup.result.json'
    if any(os.path.lexists(str(path)) for path in (claim, destination)):
        raise ValueError('Cleanup observation already consumed; no observation performed')
    with claim.open('x', encoding='utf-8') as stream:
        json.dump({'utc': datetime.now(timezone.utc).isoformat(), 'pid': os.getpid()}, stream)
    record = {'status': 'STARTED', 'pid': os.getpid(),
              'action': 'Editor world, actors, selected actors and dirty-package observation only',
              'calls_completed': [], 'runtime': 'NOT_PERFORMED',
              'sequential_observation': True}
    try:
        world = api.EditorLevelLibrary.get_editor_world()
        record['world'] = {'path': path_text(world), 'class': path_text(world.get_class())}
        record['calls_completed'].append('get_editor_world')
        record['actors'] = bounded_objects(api.EditorLevelLibrary.get_all_level_actors(), 64)
        record['calls_completed'].append('get_all_level_actors')
        record['selected_actors'] = bounded_objects(api.EditorLevelLibrary.get_selected_level_actors(), 64)
        record['calls_completed'].append('get_selected_level_actors')
        record['dirty_maps'] = bounded_objects(api.EditorLoadingAndSavingUtils.get_dirty_map_packages(), 64)
        record['calls_completed'].append('get_dirty_map_packages')
        record['dirty_content'] = bounded_objects(api.EditorLoadingAndSavingUtils.get_dirty_content_packages(), 256)
        record['calls_completed'].append('get_dirty_content_packages')
        check_source()
        record['status'] = 'OBSERVED_REQUIRES_REVIEW'
    except Exception as error:
        record['status'] = 'STOPPED_NO_RETRY'
        record['error'] = str(error)[:2000]
    record['finished_utc'] = datetime.now(timezone.utc).isoformat()
    exact_directory()
    encoded = json.dumps(record, indent=2, ensure_ascii=True)
    if len(encoded.encode('utf-8')) > 1024 * 1024:
        raise ValueError('Observation output exceeds bound; claim remains consumed')
    with destination.open('x', encoding='utf-8') as stream:
        stream.write(encoded + '\n')
    api.log('MW5_TEXT_FIXTURE_WORLD_CLEANUP: ' + record['status'])
    return record
