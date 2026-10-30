"""One-use native converter observation, through a separately reviewed entry only.

One exact already-loaded stock Class lookup and one static converter call.
No load/create fallback, CDO lookup, Blueprint reflection invocation, asset
export/edit/save/compile, UI, gameplay, or retry. Declaration stubs are never run.
"""
from datetime import datetime, timezone
import hashlib
import inspect
import json
import os
from pathlib import Path
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'research/evidence/phase-b0-native-class-path-converter-20260927-01'
MANIFEST = OUTPUT / 'input-pins.json'
MANIFEST_SHA = '98b8874e78dee785849af4c1fb7a232727e5e5b0badb39b8e66f1e5f1f843780'
CLASS_PATH = '/Game/Objects/_common/Components/PlayerControllerComponents/PlayerControllerComponent.PlayerControllerComponent_C'


def exact_file(path, size, expected):
    if not path.is_file() or path.is_symlink() or path.resolve() != path.absolute():
        raise ValueError('Pinned input missing or redirected: ' + path.name)
    if getattr(path.lstat(), 'st_file_attributes', 0) & 0x400 or path.stat().st_size != size:
        raise ValueError('Pinned input size or reparse mismatch: ' + path.name)
    with path.open('rb') as stream:
        raw = stream.read(size + 1)
    if len(raw) != size or hashlib.sha256(raw).hexdigest() != expected:
        raise ValueError('Pinned input changed: ' + path.name)
    return raw


def verify_inputs():
    if MANIFEST_SHA.startswith('PENDING_'):
        raise ValueError('DORMANT: failed-Capture baseline not pinned')
    if MANIFEST.stat().st_size > 65536:
        raise ValueError('Input manifest exceeds review bound')
    manifest = json.loads(exact_file(MANIFEST, MANIFEST.stat().st_size, MANIFEST_SHA).decode('utf-8'))
    if manifest['status'] != 'PREPARED_SINGLE_NATIVE_CLASS_PATH_CONVERTER' or len(manifest['protected_files']) != 27:
        raise ValueError('Exact converter scope changed')
    for row in manifest['protected_files'] + manifest['evidence_inputs']:
        exact_file(Path(row['path']), row['bytes'], row['sha256'])


def verify_directory():
    if OUTPUT.is_symlink() or (OUTPUT.exists() and getattr(OUTPUT.lstat(), 'st_file_attributes', 0) & 0x400):
        raise ValueError('Evidence directory redirect rejected')
    if OUTPUT.resolve() != (ROOT / 'research/evidence/phase-b0-native-class-path-converter-20260927-01').absolute():
        raise ValueError('Exact evidence directory resolution changed')


def binding(method, name):
    value = {'name': name, 'type': type(method).__name__,
             'builtin': inspect.isbuiltin(method), 'descriptor': inspect.ismethoddescriptor(method),
             'doc': str(getattr(method, '__doc__', ''))[:2048]}
    if hasattr(method, '__code__') or inspect.isfunction(method) or not (value['builtin'] or value['descriptor']):
        raise ValueError('Native built-in binding not established: ' + name)
    return value


def observe(api, record, guard, check_binding=binding):
    """Finite algorithm; MOCK_ONLY tests cannot establish native admission."""
    converter = api.SystemLibrary.conv_soft_class_reference_to_string
    record['metadata'] = {
        'find_object': check_binding(api.find_object, 'find_object'),
        'converter': check_binding(converter, 'SystemLibrary.conv_soft_class_reference_to_string'),
    }
    record['lookup_attempts'] = 0
    record['converter_attempts'] = 0
    record['converter_calls_returned'] = 0
    guard()
    record['lookup_attempts'] = 1
    generated = api.find_object(None, CLASS_PATH, type=api.Class, follow_redirectors=False)
    if generated is None:
        raise ValueError('Exact stock PCC class is not already loaded; no loading fallback')
    record['metadata']['get_path_name'] = check_binding(generated.get_path_name, 'ObjectBase.get_path_name')
    guard()
    observed_path = generated.get_path_name()
    if type(observed_path) is not str or observed_path != CLASS_PATH:
        raise ValueError('Loaded class identity mismatch')
    record['class_path'] = observed_path
    guard()
    record['converter_attempts'] = 1
    returned = converter(generated)
    record['converter_calls_returned'] = 1
    if type(returned) is not str:
        record['result'] = {'type': type(returned).__name__, 'status': 'UNEXPECTED_RETURN_TYPE'}
        raise ValueError('Converter did not return a String')
    if len(returned) > 512:
        record['result'] = {'type': 'str', 'status': 'OUTSIDE_RESULT_BOUND', 'python_length': len(returned)}
        raise ValueError('Converter String exceeds fixed review bound')
    record['result'] = {'type': 'str', 'value': returned, 'python_length': len(returned),
                        'matches_exact_class_path': returned == CLASS_PATH}
    guard()
    record['status'] = ('OBSERVED_NATIVE_CONVERTER_EXACT_PATH' if returned == CLASS_PATH
                        else 'OBSERVED_NATIVE_CONVERTER_PATH_MISMATCH')


def run(api):
    if os.getpid() != 26084 or api is not sys.modules.get('unreal') or getattr(api, '__name__', None) != 'unreal':
        raise ValueError('Owned editor process and actual imported unreal module required')
    verify_inputs()
    verify_directory()
    OUTPUT.mkdir(exist_ok=True)
    verify_directory()
    claim, destination = OUTPUT / 'native.consumed.json', OUTPUT / 'native.result.json'
    if os.path.lexists(claim) or os.path.lexists(destination):
        raise ValueError('One-use evidence exists; no native lookup or converter call')
    with claim.open('x', encoding='ascii') as stream:
        json.dump({'utc': datetime.now(timezone.utc).isoformat(), 'pid': os.getpid(),
                   'scope': 'one exact loaded stock class lookup; one static converter call'}, stream)
    started = time.monotonic()
    record = {'status': 'STARTED', 'started_utc': datetime.now(timezone.utc).isoformat(), 'pid': os.getpid(),
              'expected_class_path': CLASS_PATH, 'lookup_attempts': 0,
              'converter_attempts': 0, 'converter_calls_returned': 0,
              'blueprint_invocations': 'NOT_PERFORMED',
              'limitations': ['Native Python converter result only; no proof of Blueprint hard-class to soft-class wiring or compilation.',
                  'The existing compile failure remains a failure; no graph repair or asset mutation is performed.',
                  'Saved-source and export pins do not prove every current in-memory object is unchanged.',
                  'The 60-second cooperative checks cannot cancel a synchronous native call.',
                  'No CDO access, class creation, asset loading, world query, Blueprint call_method, gameplay or retry.']}

    def guard():
        if time.monotonic() - started > 60:
            raise ValueError('Cooperative observation budget exceeded; no further calls')
        verify_inputs()
        verify_directory()

    try:
        observe(api, record, guard)
    except Exception as error:
        record['status'] = 'STOPPED_NO_RETRY'
        record['error'] = {'type': type(error).__name__, 'message': str(error)[:600]}
    record['finished_utc'] = datetime.now(timezone.utc).isoformat()
    record['elapsed_seconds'] = time.monotonic() - started
    verify_directory()
    payload = json.dumps(record, ensure_ascii=True, indent=2) + '\n'
    if len(payload.encode('ascii')) > 32768:
        raise ValueError('Result bound exceeded; attempt remains consumed')
    with destination.open('x', encoding='ascii', newline='\n') as stream:
        stream.write(payload)
    return record
