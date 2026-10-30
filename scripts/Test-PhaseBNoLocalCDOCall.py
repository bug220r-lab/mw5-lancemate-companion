"""MOCK_ONLY one-shot no-local reflection guards. Never imports Unreal.

Native-shaped temporary receipts remain inside a disposable test root and are
removed after each case. They are not native evidence or acceptance receipts.
"""
import ast
from contextlib import ExitStack, contextmanager
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
PATH = ROOT / 'scripts/Check-PhaseBNoLocalCDOCall.py'
ENTRY = ROOT / 'research/evidence/phase-b-no-local-wrapper-call-20260927-01/native-entry.py'
spec = importlib.util.spec_from_file_location('mock_no_local_call_guard', PATH)
probe = importlib.util.module_from_spec(spec)
spec.loader.exec_module(probe)


class Object:
    def __init__(self, path, klass=None):
        self.path, self.klass = path, klass
        self.calls, self.error, self.returned = [], None, ''

    def get_path_name(self):
        return self.path

    def get_class(self):
        return self.klass

    def call_method(self, name, args):
        self.calls.append((name, args))
        if self.error:
            raise self.error
        return self.returned


class API:
    __name__ = 'unreal'
    Class, Object = object(), object()

    def __init__(self):
        self.generated = Object(probe.CLASS_PATH, Object('/Script/Engine.BlueprintGeneratedClass'))
        self.cdo = Object(probe.CDO_PATH, self.generated)
        self.lookups = []

    def find_object(self, outer, name, type, follow_redirectors):
        self.lookups.append((outer, name, type, follow_redirectors))
        if name == probe.CLASS_PATH:
            return self.generated
        if name == probe.CDO_PATH:
            return self.cdo
        raise AssertionError('Unbounded fallback lookup')


def mocked_binding(method, name):
    return {'classification': 'MOCK_ONLY', 'name': name}


def observe(api, record=None, guard=lambda: None):
    record = {} if record is None else record
    probe.observe(api, record, guard, check_binding=mocked_binding)
    return record


@contextmanager
def isolated_run(api, verifier=lambda: None, clock=lambda: 10.0):
    with tempfile.TemporaryDirectory(prefix='mock-no-local-call-', dir=str(ROOT / 'research/evidence')) as temporary:
        root = Path(temporary).resolve()
        output = root / 'research/evidence/phase-b-no-local-wrapper-call-20260927-01'
        output.mkdir(parents=True)
        actual_observe = probe.observe
        def mock_observe(api, record, guard):
            return actual_observe(api, record, guard, check_binding=mocked_binding)
        with ExitStack() as stack:
            stack.enter_context(patch.object(probe, 'ROOT', root))
            stack.enter_context(patch.object(probe, 'OUTPUT', output))
            stack.enter_context(patch.object(probe.os, 'getpid', return_value=26084))
            stack.enter_context(patch.dict(probe.sys.modules, {'unreal': api}))
            stack.enter_context(patch.object(probe, 'verify_inputs', side_effect=verifier))
            stack.enter_context(patch.object(probe.time, 'monotonic', side_effect=clock))
            stack.enter_context(patch.object(probe, 'observe', side_effect=mock_observe))
            yield output


class NoLocalCall(unittest.TestCase):
    def test_exact_two_loaded_lookups_one_zero_argument_attempt(self):
        api = API()
        result = observe(api)
        self.assertEqual(api.lookups, [(None, probe.CLASS_PATH, api.Class, False), (None, probe.CDO_PATH, api.Object, False)])
        self.assertEqual(api.cdo.calls, [('ProofNoLocalWrapper', ())])
        self.assertEqual((result['blueprint_call_attempts'], result['blueprint_calls_returned']), (1, 1))
        self.assertEqual(result['blueprint_body_execution'], 'UNKNOWN_UNINSTRUMENTED')
        self.assertTrue(result['result']['matches_default_empty_string'])

    def test_absent_and_wrong_identities_never_fall_back(self):
        for case in ('missing_class', 'wrong_class_path', 'wrong_metaclass', 'missing_cdo', 'wrong_cdo_path', 'wrong_cdo_class'):
            with self.subTest(case=case):
                api = API(); cdo = api.cdo
                if case == 'missing_class': api.generated = None
                elif case == 'wrong_class_path': api.generated.path = '/Wrong/Class'
                elif case == 'wrong_metaclass': api.generated.klass.path = '/Script/CoreUObject.Class'
                elif case == 'missing_cdo': api.cdo = None
                elif case == 'wrong_cdo_path': api.cdo.path = '/Wrong/CDO'
                else: api.cdo.klass = Object('/Wrong/Class')
                with self.assertRaises(ValueError): observe(api)
                self.assertLessEqual(len(api.lookups), 2)
                self.assertEqual(cdo.calls, [])

    def test_each_pre_call_guard_stops_before_next_lookup_or_attempt(self):
        for fail_at in (1, 2, 3):
            api, calls = API(), []
            def guard():
                calls.append(1)
                if len(calls) == fail_at: raise ValueError('fixture input drift')
            with self.assertRaisesRegex(ValueError, 'input drift'): observe(api, guard=guard)
            self.assertEqual(len(api.lookups), fail_at - 1)
            self.assertEqual(api.cdo.calls, [])

    def test_signature_error_attempts_once_without_claiming_return_or_body(self):
        api, record = API(), {}
        api.cdo.error = TypeError('fixture compiler temporary required')
        with self.assertRaises(TypeError): observe(api, record)
        self.assertEqual(len(api.cdo.calls), 1)
        self.assertEqual(record['blueprint_call_attempts'], 1)
        self.assertEqual(record['blueprint_calls_returned'], 0)
        self.assertEqual(record['blueprint_body_execution'], 'UNKNOWN_UNINSTRUMENTED')
        self.assertNotIn('result', record)

    def test_post_return_guard_failure_preserves_attempt_and_return_counts(self):
        api, record, checks = API(), {}, []
        def guard():
            checks.append(1)
            if len(checks) == 4: raise ValueError('after-call input drift')
        with self.assertRaisesRegex(ValueError, 'after-call'): observe(api, record, guard)
        self.assertEqual((record['blueprint_call_attempts'], record['blueprint_calls_returned']), (1, 1))
        self.assertEqual(len(api.cdo.calls), 1)

    def test_result_is_bounded_and_unknown_objects_not_stringified(self):
        class UnsafeRepresentation:
            def __str__(self): raise AssertionError('untrusted result stringified')
            def __repr__(self): raise AssertionError('untrusted result represented')
        self.assertEqual(probe.describe_result(UnsafeRepresentation())['status'], 'UNEXPECTED_RETURN_TYPE')
        self.assertEqual(probe.describe_result('x' * 257), {'type': 'str', 'status': 'UNEXPECTED_SIZE', 'python_length': 257})
        self.assertFalse(probe.describe_result(('',))['matches_default_empty_string'])

    def test_python_stubs_are_not_native_bindings(self):
        with self.assertRaisesRegex(ValueError, 'Native built-in'): probe.binding(lambda: None, 'stub')

    def test_run_rejects_wrong_process_or_unimported_api_before_claim(self):
        api = API()
        with isolated_run(api) as output:
            with patch.object(probe.os, 'getpid', return_value=1):
                with self.assertRaisesRegex(ValueError, 'Owned editor'): probe.run(api)
            with self.assertRaisesRegex(ValueError, 'Owned editor'): probe.run(API())
            self.assertEqual(list(output.iterdir()), [])
            self.assertEqual(api.lookups, [])

    def test_input_drift_before_claim_performs_no_lookups(self):
        api = API()
        def fail(): raise ValueError('fixture source hash mismatch')
        with isolated_run(api, verifier=fail) as output:
            with self.assertRaisesRegex(ValueError, 'hash mismatch'): probe.run(api)
            self.assertEqual(list(output.iterdir()), [])
            self.assertEqual(api.lookups, [])

    def test_existing_claim_or_result_preserved_with_no_lookup(self):
        for name in ('native.consumed.json', 'native.result.json'):
            api = API()
            with isolated_run(api) as output:
                old = output / name; old.write_bytes(b'MOCK_ONLY preexisting evidence')
                with self.assertRaisesRegex(ValueError, 'One-use evidence'): probe.run(api)
                self.assertEqual(old.read_bytes(), b'MOCK_ONLY preexisting evidence')
                self.assertEqual(api.lookups, [])

    def test_dangling_result_path_is_rejected_before_claim_or_lookup(self):
        api = API()
        with isolated_run(api) as output:
            destination = output / 'native.result.json'
            actual_lexists = probe.os.path.lexists
            # Windows symlink creation may require privileges. Model precisely
            # the broken-link distinction: exists=False but lexists=True.
            def lexists(path): return Path(path) == destination or actual_lexists(path)
            with patch.object(probe.os.path, 'lexists', side_effect=lexists):
                with self.assertRaisesRegex(ValueError, 'One-use evidence'): probe.run(api)
            self.assertEqual(list(output.iterdir()), [])
            self.assertEqual(api.lookups, [])

    def test_run_writes_separate_return_record_and_rejects_replay(self):
        api = API()
        with isolated_run(api) as output:
            result = probe.run(api)
            claim = output / 'native.consumed.json'; receipt = output / 'native.result.json'
            self.assertTrue(claim.is_file())
            original = receipt.read_bytes()
            self.assertLessEqual(len(original), 32768)
            self.assertEqual(json.loads(original), result)
            self.assertEqual(result['blueprint_calls_returned'], 1)
            with self.assertRaisesRegex(ValueError, 'One-use evidence'): probe.run(api)
            self.assertEqual(receipt.read_bytes(), original)
            self.assertEqual(len(api.lookups), 2)
            self.assertEqual(len(api.cdo.calls), 1)

    def test_run_exception_consumes_attempt_without_retry(self):
        api = API(); api.cdo.error = TypeError('fixture temporary parameter')
        with isolated_run(api) as output:
            result = probe.run(api)
            self.assertEqual(result['status'], 'STOPPED_NO_RETRY')
            self.assertEqual((result['blueprint_call_attempts'], result['blueprint_calls_returned']), (1, 0))
            self.assertEqual(result['error']['type'], 'TypeError')
            with self.assertRaisesRegex(ValueError, 'One-use evidence'): probe.run(api)
            self.assertEqual(len(api.cdo.calls), 1)

    def test_elapsed_budget_refuses_before_first_lookup(self):
        api = API(); ticks = iter((10.0, 71.0, 72.0))
        with isolated_run(api, clock=lambda: next(ticks)):
            result = probe.run(api)
            self.assertEqual(result['status'], 'STOPPED_NO_RETRY')
            self.assertIn('budget exceeded', result['error']['message'])
            self.assertEqual(api.lookups, [])
            self.assertEqual(result['blueprint_call_attempts'], 0)

    def test_directory_drift_is_rejected_before_claim(self):
        api = API()
        with isolated_run(api) as output:
            with patch.object(probe, 'OUTPUT', output.parent / 'wrong-unit'):
                with self.assertRaisesRegex(ValueError, 'resolution changed'): probe.run(api)
            self.assertEqual(list(output.iterdir()), [])

    def test_exact_file_rejects_missing_size_and_same_size_hash_drift(self):
        api = API()
        with isolated_run(api) as output:
            path = output / 'fixture.bin'; path.write_bytes(b'good')
            sha = hashlib.sha256(b'good').hexdigest()
            probe.exact_file(path, 4, sha)
            path.write_bytes(b'evil')
            with self.assertRaisesRegex(ValueError, 'hash mismatch'): probe.exact_file(path, 4, sha)
            with self.assertRaisesRegex(ValueError, 'size/reparse'): probe.exact_file(path, 5, sha)
            with self.assertRaisesRegex(ValueError, 'missing'): probe.exact_file(output / 'absent', 4, sha)

    def test_python37_grammar_and_single_static_invocation_site(self):
        for path in (PATH, ENTRY, Path(__file__)):
            tree = ast.parse(path.read_text(encoding='utf-8-sig'), feature_version=(3, 7))
            if path == PATH:
                calls = [n for n in ast.walk(tree) if isinstance(n, ast.Call) and isinstance(n.func, ast.Attribute) and n.func.attr == 'call_method']
                self.assertEqual(len(calls), 1)
                self.assertEqual(len(calls[0].keywords), 1)
                self.assertEqual(calls[0].keywords[0].arg, 'args')
                self.assertIsInstance(calls[0].keywords[0].value, ast.Tuple)
                self.assertEqual(calls[0].keywords[0].value.elts, [])


if __name__ == '__main__':
    print('MOCK_ONLY guard tests; no native API, entry dispatch or editor action.', flush=True)
    unittest.main(verbosity=2)
