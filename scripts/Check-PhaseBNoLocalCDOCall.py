"""Dormant one-call probe of an already-loaded disposable Blueprint CDO.

This attempts ProofNoLocalWrapper once; it is not a read-only export. The
reviewed wrapper forwards one trivial helper result. No load/create/Play fallback.
Invoke only via a separately reviewed, expiring entry in the owned editor.
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
OUTPUT = ROOT / 'research/evidence/phase-b-no-local-wrapper-call-20260927-01'
CLASS_PATH = '/Game/CodexEditorControlScratch20260925/BP_CodexAuthoringProbe.BP_CodexAuthoringProbe_C'
CDO_PATH = '/Game/CodexEditorControlScratch20260925/BP_CodexAuthoringProbe.Default__BP_CodexAuthoringProbe_C'
FUNCTION_NAME = 'ProofNoLocalWrapper'
NATIVE_GRAPH_GUID = '2EFCE88348C7CA0574B8D4B08DD59DDD'
SOURCE = Path('C:/Program Files/Epic Games/MechWarrior5Editor/MW5Mercs/Content/CodexEditorControlScratch20260925/BP_CodexAuthoringProbe.uasset')
BACKUP = ROOT / 'artifacts/editor-authoring-probe-20260925/BP_CodexAuthoringProbe.uasset'
SOURCE_SHA = '0b7d06f0004d67d1944cd288b44a4b63d7f95d4e17de22b8ee828f4f96f0b6dc'
BASELINE = ROOT / 'research/evidence/phase-b-no-local-wrapper-native-01/wrapper.COPY'
BASELINE_SHA = '677e2269f8cc78d9bb84b8ebf91c2fa39d7e95e5d7091fdab7f47369221c4b41'
REVIEW = Path('C:/Users/jlewi/OneDrive/Documents/ChatGPT/MW5 LANCEMATE COMPANION/research/evidence/phase-b-no-local-wrapper-native-01/native-wrapper-review.json')
REVIEW_SHA = 'e51663ecf5fa55afceae92ea33383a91b2fa591bd76739be6ad5bc540ca02d6a'


def exact_file(path, size, expected):
    if not path.is_file() or path.is_symlink() or path.resolve() != path.absolute():
        raise ValueError('Pinned file missing or redirected: ' + path.name)
    if getattr(path.lstat(), 'st_file_attributes', 0) & 0x400 or path.stat().st_size != size:
        raise ValueError('Pinned file size/reparse mismatch: ' + path.name)
    with path.open('rb') as stream:
        raw = stream.read(size + 1)
    if len(raw) != size or hashlib.sha256(raw).hexdigest() != expected:
        raise ValueError('Pinned file hash mismatch: ' + path.name)


def verify_inputs():
    exact_file(SOURCE, 28153, SOURCE_SHA)
    exact_file(BACKUP, 28153, SOURCE_SHA)
    exact_file(BASELINE, 858187, BASELINE_SHA)
    exact_file(REVIEW, 27200, REVIEW_SHA)


def verify_directory():
    if OUTPUT.is_symlink() or (OUTPUT.exists() and getattr(OUTPUT.lstat(), 'st_file_attributes', 0) & 0x400):
        raise ValueError('Evidence directory redirect rejected')
    if OUTPUT.resolve() != (ROOT / 'research/evidence/phase-b-no-local-wrapper-call-20260927-01').absolute():
        raise ValueError('Evidence directory resolution changed')


def binding(method, name):
    value = {'name': name, 'type': type(method).__name__,
             'builtin': inspect.isbuiltin(method), 'descriptor': inspect.ismethoddescriptor(method),
             'doc': str(getattr(method, '__doc__', ''))[:2048]}
    if hasattr(method, '__code__') or inspect.isfunction(method) or not (value['builtin'] or value['descriptor']):
        raise ValueError('Native built-in binding not established: ' + name)
    return value


def describe_result(value):
    # No arbitrary repr/str of UObject results and no additional native calls.
    if type(value) is str:
        if len(value) > 256:
            return {'type': 'str', 'status': 'UNEXPECTED_SIZE', 'python_length': len(value)}
        return {'type': 'str', 'value': value, 'matches_default_empty_string': value == ''}
    if value is None:
        return {'type': 'NoneType', 'matches_default_empty_string': False}
    if type(value) in (bool, int, float):
        return {'type': type(value).__name__, 'value': value, 'matches_default_empty_string': False}
    if type(value) is tuple and len(value) <= 2:
        return {'type': 'tuple', 'items': [describe_result(v) if type(v) in (str, bool, int, float) or v is None else {'type': type(v).__name__} for v in value], 'matches_default_empty_string': False}
    return {'type': type(value).__name__, 'status': 'UNEXPECTED_RETURN_TYPE', 'matches_default_empty_string': False}


def observe(api, record, guard, check_binding=binding):
    """Finite algorithm shared with MOCK_ONLY tests; does not claim native admission."""
    record['metadata'] = {'find_object': check_binding(api.find_object, 'find_object')}
    record['lookup_count'] = 0
    record['blueprint_call_attempts'] = 0
    record['blueprint_calls_returned'] = 0
    record['blueprint_body_execution'] = 'UNKNOWN_UNINSTRUMENTED'
    guard()
    record['lookup_count'] += 1
    generated = api.find_object(None, CLASS_PATH, type=api.Class, follow_redirectors=False)
    if generated is None:
        raise ValueError('Exact generated class is not already loaded')
    if generated.get_path_name() != CLASS_PATH or generated.get_class().get_path_name() != '/Script/Engine.BlueprintGeneratedClass':
        raise ValueError('Generated-class identity mismatch')
    record['generated_class_path'] = generated.get_path_name()
    guard()
    record['lookup_count'] += 1
    cdo = api.find_object(None, CDO_PATH, type=api.Object, follow_redirectors=False)
    if cdo is None:
        raise ValueError('Exact CDO is not already loaded; no creation fallback')
    if cdo.get_path_name() != CDO_PATH or cdo.get_class().get_path_name() != CLASS_PATH:
        raise ValueError('CDO identity or generated class mismatch')
    record['cdo_path'] = cdo.get_path_name()
    record['metadata']['call_method'] = check_binding(cdo.call_method, 'Object.call_method')
    guard()
    record['blueprint_call_attempts'] = 1
    # Exactly one reflection attempt, no public inputs. The compiled body is not instrumented.
    returned = cdo.call_method(FUNCTION_NAME, args=())
    record['blueprint_calls_returned'] = 1
    record['result'] = describe_result(returned)
    guard()
    record['status'] = 'OBSERVED_WRAPPER_REFLECTION_RETURN_REQUIRES_REVIEW'


def run(api):
    if os.getpid() != 26084 or api is not sys.modules.get('unreal') or getattr(api, '__name__', None) != 'unreal':
        raise ValueError('Owned editor process and actual imported unreal module required')
    verify_inputs()
    verify_directory()
    OUTPUT.mkdir(exist_ok=True)
    verify_directory()
    claim, destination = OUTPUT / 'native.consumed.json', OUTPUT / 'native.result.json'
    if os.path.lexists(claim) or os.path.lexists(destination):
        raise ValueError('One-use evidence exists; no lookups or Blueprint call')
    with claim.open('x', encoding='ascii') as stream:
        json.dump({'utc': datetime.now(timezone.utc).isoformat(), 'pid': os.getpid(), 'scope': 'two exact loaded lookups; one zero-input ProofNoLocalWrapper reflection attempt'}, stream)
    started = time.monotonic()
    record = {'status': 'STARTED', 'started_utc': datetime.now(timezone.utc).isoformat(), 'pid': os.getpid(),
              'function': FUNCTION_NAME, 'native_graph_guid': NATIVE_GRAPH_GUID, 'argument_count': 0,
              'lookup_count': 0, 'blueprint_call_attempts': 0, 'blueprint_calls_returned': 0,
              'blueprint_body_execution': 'UNKNOWN_UNINSTRUMENTED',
              'limitations': ['Editor CDO execution only; no gameplay, Play, BeginPlay, actor spawning, world query, load or save.',
                  'Expected empty String is based on the reviewed wrapper forwarding its trivial helper output; wrapper has no public inputs.',
                  'Default-object path is a constrained candidate until found and identity-checked; absence stops without fallback.',
                  'No get_default_object or best-matching-type conversion used; only an already-loaded exact instance is eligible.',
                  'Saved source and exported baseline pins do not independently prove current in-memory graph equality; owned UI sequencing is a prerequisite.',
                  '60-second checks are cooperative around native calls and cannot cancel a synchronous stuck call.',
                  'An attempt counter does not establish Blueprint body entry; a returned value is recorded separately and body execution is not instrumented.',
                  'No guessed arguments, keyword arguments, retries or fallback calls are allowed on an unexpected signature error.',
                  'This does not execute or validate the new text algorithms, destination bindings, HUD or packaged game.']}
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
