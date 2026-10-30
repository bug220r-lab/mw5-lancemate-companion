"""One-use native pure-string observation; invoke only through its pinned entry.

No asset/world access, Blueprint edits, clipboard, input, save, compile or game.
Installed documentation is declaration evidence, never an executable fallback.
"""
from datetime import datetime, timezone
import inspect
import json
import os
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'research/evidence/phase-b-string-semantics-20260927-01'
EDITOR_PID = 26084
API_REFERENCE_SHA256 = 'ac4c46761bc54099302155bc0a908ae3f64b161ca77eb9afd0cc6c1f1b826480'


def units(value):
    raw = value.encode('utf-16-le', errors='surrogatepass')
    return [raw[i] + (raw[i + 1] << 8) for i in range(0, len(raw), 2)]


def describe(value):
    return {'text': value, 'python_codepoints': len(value),
            'python_ordinals': [ord(char) for char in value], 'utf16_units': units(value)}


def fixtures():
    rocket = '\U0001f680'
    return [
        ('empty', '', [], [(0, 0)]),
        ('ascii_boundary40', 'A' * 39 + 'BC', [0, 38, 39, 40], [(0, 40), (40, 1)]),
        ('bmp_accent_cjk', 'A\u00e9\u6f22\u5b57Z', [0, 1, 2, 3, 4], [(1, 3)]),
        ('pair_crosses40', 'A' * 39 + rocket + 'B', [38, 39, 40, 41],
         [(0, 39), (39, 2), (41, 1), (0, 40), (40, 2), (39, 1), (40, 1)]),
        ('pair_ends40', 'A' * 38 + rocket + 'B', [37, 38, 39, 40], [(0, 40), (40, 1), (38, 2)]),
        ('pair_starts40', 'A' * 40 + rocket + 'B', [39, 40, 41, 42], [(0, 40), (40, 2), (42, 1)]),
        ('controls_including_nul', 'A\tB\nC\rD\x00E\x1fF\x7fG', list(range(13)), [(0, 13), (7, 1), (8, 5)]),
        ('ascii_256', 'W' * 256, [0, 254, 255], [(240, 16)]),
        ('ascii_257', 'W' * 257, [0, 255, 256], [(240, 17)]),
        ('pair_256', 'A' * 254 + rocket, [253, 254, 255], [(254, 2)]),
        ('pair_257', 'A' * 255 + rocket, [254, 255, 256], [(255, 2)]),
    ]


def verify_directory():
    if OUTPUT.is_symlink() or (OUTPUT.exists() and getattr(OUTPUT.lstat(), 'st_file_attributes', 0) & 0x400):
        raise RuntimeError('Evidence directory redirect rejected')
    if OUTPUT.resolve() != OUTPUT.absolute():
        raise RuntimeError('Exact evidence directory resolution changed')


def native_methods(api, metadata):
    if api is not sys.modules.get('unreal') or api.__name__ != 'unreal':
        raise RuntimeError('Actual imported unreal module required')
    library = api.StringLibrary
    result = {}
    for name in ('len', 'get_substring', 'get_character_as_number'):
        method = getattr(library, name)
        metadata[name] = {'type': type(method).__name__, 'module': getattr(method, '__module__', None),
                          'qualname': getattr(method, '__qualname__', None),
                          'doc': str(getattr(method, '__doc__', ''))[:4096],
                          'builtin': inspect.isbuiltin(method), 'descriptor': inspect.ismethoddescriptor(method)}
        # Never execute the collected Python declaration stubs or a Python mock.
        if (hasattr(method, '__code__') or inspect.isfunction(method) or
                not (inspect.isbuiltin(method) or inspect.ismethoddescriptor(method))):
            raise RuntimeError('Native built-in binding not established: ' + name)
        result[name] = method
    return result


def observe(methods):
    observations, call_count = [], 0
    def call(name, args, expected_type):
        nonlocal call_count
        call_count += 1
        if call_count > 100:
            raise RuntimeError('Fixed pure-string call ceiling exceeded')
        try:
            value = methods[name](*args)
            if type(value) is not expected_type:
                return {'status': 'UNEXPECTED_RETURN_TYPE', 'type': type(value).__name__}
            if expected_type is str:
                if len(value) > 1024:
                    return {'status': 'UNEXPECTED_RETURN_SIZE', 'python_length': len(value)}
                return {'status': 'RETURNED', 'value': describe(value)}
            return {'status': 'RETURNED', 'value': value}
        except Exception as error:
            return {'status': 'PYTHON_BINDING_EXCEPTION', 'exception_type': type(error).__name__,
                    'message': str(error)[:400]}
    for name, source, indices, slices in fixtures():
        expected_units = units(source)
        row = {'fixture': name, 'input': describe(source), 'len': call('len', (source,), int),
               'characters': [], 'substrings': []}
        if row['len']['status'] == 'RETURNED':
            row['len']['matches_utf16_units'] = row['len']['value'] == len(expected_units)
            row['len']['matches_python_codepoints'] = row['len']['value'] == len(source)
        for index in indices:
            assert 0 <= index < len(expected_units)
            item = {'index': index, 'expected_utf16_unit': expected_units[index],
                    'expected_python_ordinal_or_absent': ord(source[index]) if index < len(source) else None,
                    'observed': call('get_character_as_number', (source, index), int)}
            if item['observed']['status'] == 'RETURNED':
                item['matches_utf16_unit'] = item['observed']['value'] == expected_units[index]
            row['characters'].append(item)
        for start, length in slices:
            assert 0 <= start <= len(expected_units) and 0 <= length <= len(expected_units) - start
            selected = expected_units[start:start + length]
            raw = b''.join(value.to_bytes(2, 'little') for value in selected)
            expected = raw.decode('utf-16-le', errors='surrogatepass')
            isolated_half = any(0xd800 <= ord(char) <= 0xdfff for char in expected)
            item = {'start_index': start, 'length': length, 'expected_utf16_slice': describe(expected),
                    'expected_python_slice': source[start:start + length], 'isolated_surrogate_expected': isolated_half,
                    'observed': call('get_substring', (source, start, length), str)}
            if item['observed']['status'] == 'RETURNED':
                item['matches_utf16_slice'] = item['observed']['value']['utf16_units'] == selected
            row['substrings'].append(item)
        observations.append(row)
    return observations, call_count


def run(api):
    if os.getpid() != EDITOR_PID:
        raise RuntimeError('Exact editor process required')
    verify_directory()
    OUTPUT.mkdir(exist_ok=True)
    verify_directory()
    claim, result_path = OUTPUT / 'native.consumed.json', OUTPUT / 'native.result.json'
    if claim.exists() or result_path.exists():
        raise RuntimeError('One-use stage already exists; no native string calls')
    with claim.open('x', encoding='utf-8') as stream:
        json.dump({'utc': datetime.now(timezone.utc).isoformat(), 'pid': os.getpid(),
                   'scope': 'fixed synthetic strings only'}, stream)
    record = {'status': 'STARTED', 'pid': os.getpid(), 'api_reference_sha256': API_REFERENCE_SHA256,
              'api_reference_lines': {'python_class_StringLibrary': 215085, 'len': 215360,
                                      'get_substring': 215457, 'get_character_as_number': 215472},
              'limitations': ['Editor Python-to-native bindings only, not Blueprint or shipping execution.',
                  'Substring surrogate differences or exceptions may be Python wrapper conversion; do not infer native FString loss.',
                  'This fixture does not establish diagnostic validation, segmentation or visible glyph/layout correctness.',
                  'No assets, world, components, game state, input, clipboard, compile, save or package accessed.']}
    try:
        record['native_method_metadata'] = {}
        methods = native_methods(api, record['native_method_metadata'])
        record['observations'], record['pure_string_call_count'] = observe(methods)
        record['status'] = 'OBSERVED_NATIVE_PYTHON_BINDINGS_REQUIRES_REVIEW'
    except Exception as error:
        record['status'] = 'BLOCKED_OR_INCOMPLETE_REQUIRES_REVIEW'
        record['error'] = {'type': type(error).__name__, 'message': str(error)[:600]}
    record['finished_utc'] = datetime.now(timezone.utc).isoformat()
    verify_directory()
    payload = json.dumps(record, ensure_ascii=True, indent=2) + '\n'
    if len(payload.encode('utf-8')) > 256 * 1024:
        raise RuntimeError('Bounded result exceeded; attempt remains consumed')
    with result_path.open('x', encoding='ascii', newline='\n') as stream:
        stream.write(payload)
