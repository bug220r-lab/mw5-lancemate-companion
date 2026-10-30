"""Copy exactly two already-saved sources to a fresh local checkpoint.

This performs no editor/native calls and writes only within the fixed project
artifact directory. Run after root has saved the two reviewed MOD overrides.
"""
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
EVIDENCE = ROOT / 'research/evidence/phase-b0-postrepair-source-native-01'
OUTPUT = ROOT / 'artifacts/phase-b0-repaired-source-checkpoint-20260927-01'
MANIFEST_SHA = '10198aac94b8850e0d16bf96be12d2b21908a671f44d3de53576f4e071e7897e'
PRESERVATION_SHA = 'a81f3ced82764c8ae277c9fc95ee71e4e2f3dd701bd60ba48b5f175e63d0a583'
CONTROLLER_REVIEW_NAME = 'native-controller-repair-review.json'
CONTROLLER_REVIEW_SHA = '5e3688e3c867b3438d39454af66c60448f93e9e91c1a73b11f239bcca8d1c41d'
SCRATCH_REVIEW_SHA = 'c50e35336a25766289dfef2d8d94fa2293ffd9fb4ac3bf9ba7d4222400b82a2d'
MAX_SOURCE_BYTES = 16 * 1024 * 1024
MAX_LOG_BYTES = 4 * 1024 * 1024
MOD = Path('C:/Program Files/Epic Games/MechWarrior5Editor/MW5Mercs/Plugins/LanceObserverDiagnosticControl')
TARGETS = (
    ('controller', MOD / 'ModOverride/Modes/InstantAction/InstantActionPlayerController.uasset',
     'controller/InstantActionPlayerController.uasset',
     '../../../MW5Mercs/Plugins/LanceObserverDiagnosticControl/ModOverride/Modes/InstantAction/InstantActionPlayerController.uasset'),
    ('scratch', MOD / 'ModOverride/CodexEditorControlScratch20260925/BP_CodexAuthoringProbe.uasset',
     'scratch/BP_CodexAuthoringProbe.uasset',
     '../../../MW5Mercs/Plugins/LanceObserverDiagnosticControl/ModOverride/CodexEditorControlScratch20260925/BP_CodexAuthoringProbe.uasset'),
)


def unredirected(path, must_exist=True):
    path = Path(path)
    if path.resolve() != path.absolute():
        raise ValueError('Resolved path changed: ' + str(path))
    for item in (path,) + tuple(path.parents):
        if os.path.lexists(str(item)):
            if item.is_symlink() or getattr(item.lstat(), 'st_file_attributes', 0) & 0x400:
                raise ValueError('Redirected path rejected: ' + str(item))
    if must_exist and not path.is_file():
        raise ValueError('Required file missing: ' + str(path))


def read_bounded(path, limit):
    unredirected(path)
    if not 0 <= path.stat().st_size <= limit:
        raise ValueError('File outside bounded read: ' + str(path))
    with path.open('rb') as stream:
        raw = stream.read(limit + 1)
    if len(raw) > limit:
        raise ValueError('File grew beyond read bound: ' + str(path))
    return raw


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def pin(path, raw):
    return {'path': str(path), 'bytes': len(raw), 'sha256': digest(raw)}


def exact(row):
    path = Path(row['path'])
    raw = read_bounded(path, row['bytes'])
    if len(raw) != row['bytes'] or digest(raw) != row['sha256']:
        raise ValueError('Pinned evidence or protected input changed: ' + str(path))
    return raw


def pinned_json(path, sha, limit=262144):
    raw = read_bounded(path, limit)
    if digest(raw) != sha:
        raise ValueError('Pinned review changed: ' + str(path))
    return json.loads(raw.decode('utf-8-sig')), pin(path, raw)


def observe_saves(preservation):
    anchor = preservation['log']
    path = Path(anchor['path'])
    raw = read_bounded(path, MAX_LOG_BYTES)
    offset = anchor['read_bytes']
    if len(raw) < offset or digest(raw[:offset]) != anchor['read_prefix_sha256']:
        raise ValueError('Owned editor log prefix changed or shrank')
    suffix = raw[offset:].decode('utf-8', errors='strict')
    lines = suffix.splitlines()
    events = []
    for label, _, _, target in TARGETS:
        ending = " to '" + target + "'"
        matches = [line for line in lines if 'LogSavePackage: Moving ' in line and line.endswith(ending)]
        if len(matches) != 1 or not re.match(r'^\[\d{4}\.\d{2}\.\d{2}-\d{2}\.\d{2}\.\d{2}:\d{3}\]', matches[0]):
            raise ValueError('Need exactly one new direct SavePackage event for ' + label)
        events.append({'label': label, 'target': target, 'line': matches[0]})
    return {'path': str(path), 'observed_prefix_bytes': len(raw),
            'observed_prefix_sha256': digest(raw), 'save_events': events,
            'prior_prefix_bytes': offset, 'prior_prefix_sha256': anchor['read_prefix_sha256']}


def run():
    if any(value.startswith('PENDING_') for value in (CONTROLLER_REVIEW_SHA, SCRATCH_REVIEW_SHA)):
        raise ValueError('Required source review is not sealed')
    unredirected(OUTPUT, must_exist=False)
    if os.path.lexists(str(OUTPUT)):
        raise ValueError('Checkpoint directory exists; preserve it and do not retry here')
    manifest, manifest_pin = pinned_json(EVIDENCE / 'protected-inputs.json', MANIFEST_SHA)
    preservation, preservation_pin = pinned_json(EVIDENCE / 'postrepair-evidence-review.json', PRESERVATION_SHA)
    controller, controller_pin = pinned_json(EVIDENCE / CONTROLLER_REVIEW_NAME, CONTROLLER_REVIEW_SHA)
    scratch, scratch_pin = pinned_json(EVIDENCE / 'native-scratch-review.json', SCRATCH_REVIEW_SHA)
    if controller['status'] != 'PASS_NATIVE_CONTROLLER_CLASS_PATH_REPAIR_EDITOR_SOURCE_ONLY' or scratch['status'] != 'PASS_NATIVE_SCRATCH_CONVERSION_COMPLETION_AND_PRIOR_SOURCE_PRESERVATION':
        raise ValueError('Source review did not accept native source')
    if manifest['status'] != 'PREPARED_READ_ONLY_B0_POSTREPAIR_INSPECTION' or len(manifest['protected_files']) != 28 or len(manifest['backup_and_history_files']) != 81:
        raise ValueError('Protected scope changed')
    for row in preservation['exports_verified']:
        exact(row)
    sources = {str(path).casefold() for _, path, _, _ in TARGETS}
    previous = {row['path'].casefold(): row for row in manifest['protected_files'] if row['path'].casefold() in sources}
    if len(previous) != 2:
        raise ValueError('Exact two saved targets not in protected baseline')
    unchanged = [row for row in manifest['protected_files'] if row['path'].casefold() not in sources]
    guarded = unchanged + manifest['backup_and_history_files']
    for row in guarded:
        exact(row)
    before = []
    for label, path, relative, _ in TARGETS:
        raw = read_bounded(path, MAX_SOURCE_BYTES)
        if not raw or digest(raw) == previous[str(path).casefold()]['sha256']:
            raise ValueError('Target has not changed from the pre-save source: ' + label)
        before.append((label, path, relative, raw, pin(path, raw)))
    log_observation = observe_saves(preservation)
    OUTPUT.mkdir()
    try:
        copies = []
        for label, path, relative, raw, after_pin in before:
            destination = OUTPUT / relative
            unredirected(destination, must_exist=False)
            destination.parent.mkdir(exist_ok=False)
            with destination.open('xb') as stream:
                stream.write(raw)
            copied = read_bounded(destination, MAX_SOURCE_BYTES)
            if copied != raw:
                raise ValueError('Checkpoint readback mismatch: ' + label)
            copies.append({'label': label, 'source_before_save': previous[str(path).casefold()],
                           'source_after_save': after_pin, 'checkpoint_copy': pin(destination, copied)})
        for _, path, _, raw, _ in before:
            if read_bounded(path, MAX_SOURCE_BYTES) != raw:
                raise ValueError('Source changed during checkpoint: ' + str(path))
        for row in guarded:
            exact(row)
        for row in preservation['exports_verified'] + [manifest_pin, preservation_pin, controller_pin, scratch_pin]:
            exact(row)
        log_after = observe_saves(preservation)
        if log_after['save_events'] != log_observation['save_events']:
            raise ValueError('Save evidence changed during checkpoint')
        self_raw = read_bounded(Path(__file__), 65536)
        record = {'status': 'SAVED_SOURCE_CHECKPOINT_VERIFIED',
                  'completed_utc': datetime.now(timezone.utc).isoformat(),
                  'script': pin(Path(__file__), self_raw), 'sources': copies,
                  'protected_manifest': manifest_pin, 'preservation_review': preservation_pin,
                  'source_reviews': [controller_pin, scratch_pin],
                  'reviewed_loaded_exports': preservation['exports_verified'],
                  'unchanged_other_protected_files': len(unchanged),
                  'unchanged_history_files': len(manifest['backup_and_history_files']),
                  'stable_sources_before_after_copy': True, 'copy_readback_verified': True,
                  'owned_log': log_after,
                  'limitations': ['File checks are sequential, not an atomic filesystem snapshot.',
                      'The saved bytes and two SavePackage log lines do not establish cold-reload equivalence.',
                      'Scratch shipping exclusion, packaging, retail behavior and Blueprint invocation remain separate work.',
                      'This local script did not invoke native/editor APIs or write outside this checkpoint directory.'],
                  'reload': 'NOT_PERFORMED', 'runtime': 'NOT_PERFORMED'}
        with (OUTPUT / 'CHECKPOINT.json').open('x', encoding='utf-8', newline='\n') as stream:
            json.dump(record, stream, indent=2); stream.write('\n')
        print(json.dumps({'status': record['status'], 'checkpoint': str(OUTPUT / 'CHECKPOINT.json')}))
        return record
    except Exception as error:
        with (OUTPUT / 'FAILED.json').open('x', encoding='utf-8', newline='\n') as stream:
            json.dump({'status': 'INCOMPLETE_CHECKPOINT_PRESERVE_PARTIAL_FILES',
                       'utc': datetime.now(timezone.utc).isoformat(), 'error': str(error)[:1000]}, stream)
            stream.write('\n')
        raise


if __name__ == '__main__':
    run()
