"""Dormant one-call probe of an already-loaded disposable Blueprint CDO.

This executes ProofHelper_0 once; it is not a read-only export. The reviewed
function only returns its default empty String. No load/create/Play fallback.
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
OUTPUT = ROOT / 'research/evidence/phase-b-cdo-call-proof-20260927-01'
CLASS_PATH = '/Game/CodexEditorControlScratch20260925/BP_CodexAuthoringProbe.BP_CodexAuthoringProbe_C'
CDO_PATH = '/Game/CodexEditorControlScratch20260925/BP_CodexAuthoringProbe.Default__BP_CodexAuthoringProbe_C'
FUNCTION_NAME = 'ProofHelper_0'
LITERAL = 'PHASE_B_CDO_LITERAL_PROBE'
SOURCE = Path('C:/Program Files/Epic Games/MechWarrior5Editor/MW5Mercs/Content/CodexEditorControlScratch20260925/BP_CodexAuthoringProbe.uasset')
BACKUP = ROOT / 'artifacts/editor-authoring-probe-20260925/BP_CodexAuthoringProbe.uasset'
SOURCE_SHA = '0b7d06f0004d67d1944cd288b44a4b63d7f95d4e17de22b8ee828f4f96f0b6dc'
BASELINE = ROOT / 'research/evidence/phase-b-local-binding-proof-20260927-01/bindings.COPY'
BASELINE_SHA = 'df7db4ca13667e154780d6ace2cba0fea4a0d593d295c789a1bec6fedb05bcd2'


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
    exact_file(BASELINE, 60287, BASELINE_SHA)


def verify_directory():
    if OUTPUT.is_symlink() or (OUTPUT.exists() and getattr(OUTPUT.lstat(), 'st_file_attributes', 0) & 0x400):
        raise ValueError('Evidence directory redirect rejected')
    if OUTPUT.resolve() != (ROOT / 'research/evidence/phase-b-cdo-call-proof-20260927-01').absolute():
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
    record['blueprint_call_count'] = 0
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
    record['blueprint_call_count'] = 1
    # This is the only Blueprint invocation. Input is fixed and unused in source.
    returned = cdo.call_method(FUNCTION_NAME, args=(LITERAL,))
    record['result'] = describe_result(returned)
    guard()
    record['status'] = 'OBSERVED_CDO_SINGLE_CALL_REQUIRES_REVIEW'


def run(api):
    if os.getpid() != 26084 or api is not sys.modules.get('unreal') or getattr(api, '__name__', None) != 'unreal':
        raise ValueError('Owned editor process and actual imported unreal module required')
    verify_inputs()
    verify_directory()
    OUTPUT.mkdir(exist_ok=True)
    verify_directory()
    claim, destination = OUTPUT / 'native.consumed.json', OUTPUT / 'native.result.json'
    if claim.exists() or destination.exists():
        raise ValueError('One-use evidence exists; no lookups or Blueprint call')
    with claim.open('x', encoding='ascii') as stream:
        json.dump({'utc': datetime.now(timezone.utc).isoformat(), 'pid': os.getpid(), 'scope': 'two exact loaded lookups; one ProofHelper_0 call'}, stream)
    started = time.monotonic()
    record = {'status': 'STARTED', 'started_utc': datetime.now(timezone.utc).isoformat(), 'pid': os.getpid(),
              'function': FUNCTION_NAME, 'argument': LITERAL,
              'lookup_count': 0, 'blueprint_call_count': 0,
              'limitations': ['Editor CDO execution only; no gameplay, Play, BeginPlay, actor spawning, world query, load or save.',
                  'Expected empty String is based on reviewed Entry-to-Return source; input is deliberately unused.',
                  'Default-object path is a constrained candidate until found and identity-checked; absence stops without fallback.',
                  'No get_default_object or best-matching-type conversion used; only an already-loaded exact instance is eligible.',
                  'Saved source and exported baseline pins do not independently prove current in-memory graph equality; owned UI sequencing is a prerequisite.',
                  '60-second checks are cooperative around native calls and cannot cancel a synchronous stuck call.',
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
