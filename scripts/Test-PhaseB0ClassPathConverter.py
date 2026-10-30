"""MOCK_ONLY guard checks for the one-use read-only converter observer.

No Unreal imports or native dispatch. Native-shaped results exist only inside
temporary directories. These checks do not establish Blueprint compatibility.
"""
import importlib.util
import json
from pathlib import Path
import tempfile
import types
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    'converter_observer_tested', ROOT / 'scripts/Check-PhaseB0ClassPathConverter.py')
helper = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(helper)


def mock_binding(method, name):
    return {'name': name, 'classification': 'MOCK_ONLY'}


class FakeClass:
    def __init__(self, calls, path):
        self.calls, self.path = calls, path

    def get_path_name(self):
        self.calls.append('path')
        return self.path


def fake_api(path=helper.CLASS_PATH, result=helper.CLASS_PATH, absent=False,
             converter_error=False):
    calls = []
    obj = FakeClass(calls, path)
    api = types.ModuleType('unreal')
    api.Class = FakeClass

    def find_object(outer, name, **kwargs):
        calls.append('lookup')
        assert outer is None and name == helper.CLASS_PATH
        assert kwargs == {'type': FakeClass, 'follow_redirectors': False}
        return None if absent else obj

    def convert(value):
        calls.append('convert')
        assert value is obj
        if converter_error:
            raise TypeError('MOCK_ONLY conversion failure')
        return result

    api.find_object = find_object
    api.SystemLibrary = types.SimpleNamespace(conv_soft_class_reference_to_string=convert)
    return api, calls


class ConverterGuardTests(unittest.TestCase):
    def observe(self, **kwargs):
        api, calls = fake_api(**kwargs)
        record, guards = {}, []
        helper.observe(api, record, lambda: guards.append('guard'), mock_binding)
        return record, calls, guards

    def test_exact_identity_and_single_call(self):
        record, calls, guards = self.observe()
        self.assertEqual(calls, ['lookup', 'path', 'convert'])
        self.assertEqual(len(guards), 4)
        self.assertEqual(record['lookup_attempts'], 1)
        self.assertEqual(record['converter_attempts'], 1)
        self.assertEqual(record['converter_calls_returned'], 1)
        self.assertTrue(record['result']['matches_exact_class_path'])

    def test_absent_wrong_or_nonstring_identity_prevents_converter(self):
        for options, expected_calls in [({'absent': True}, ['lookup']),
                                        ({'path': '/Wrong'}, ['lookup', 'path']),
                                        ({'path': 5}, ['lookup', 'path'])]:
            with self.subTest(options=options):
                api, calls = fake_api(**options)
                record = {}
                with self.assertRaises(ValueError):
                    helper.observe(api, record, lambda: None, mock_binding)
                self.assertEqual(calls, expected_calls)
                self.assertEqual(record['converter_attempts'], 0)

    def test_python_binding_is_rejected_before_native_shaped_lookup(self):
        api, calls = fake_api()
        with self.assertRaisesRegex(ValueError, 'Native built-in binding not established'):
            helper.observe(api, {}, lambda: None)
        self.assertEqual(calls, [])

    def test_converter_failure_records_attempt_without_return(self):
        api, calls = fake_api(converter_error=True)
        record = {}
        with self.assertRaisesRegex(TypeError, 'MOCK_ONLY'):
            helper.observe(api, record, lambda: None, mock_binding)
        self.assertEqual(calls, ['lookup', 'path', 'convert'])
        self.assertEqual((record['converter_attempts'], record['converter_calls_returned']), (1, 0))

    def test_invalid_return_type_and_oversize_reject_after_one_return(self):
        for value, status in [(None, 'UNEXPECTED_RETURN_TYPE'),
                              ('x' * 513, 'OUTSIDE_RESULT_BOUND')]:
            with self.subTest(status=status):
                api, calls = fake_api(result=value)
                record = {}
                with self.assertRaises(ValueError):
                    helper.observe(api, record, lambda: None, mock_binding)
                self.assertEqual(record['result']['status'], status)
                self.assertNotIn('value', record['result'])
                self.assertEqual((record['converter_attempts'], record['converter_calls_returned']), (1, 1))
                self.assertEqual(calls.count('convert'), 1)

    def test_mismatch_and_exact_512_boundary_never_claim_match(self):
        for value in ['', '/Wrong_C', 'x' * 512]:
            with self.subTest(length=len(value)):
                record, calls, guards = self.observe(result=value)
                self.assertFalse(record['result']['matches_exact_class_path'])
                self.assertEqual(record['status'], 'OBSERVED_NATIVE_CONVERTER_PATH_MISMATCH')
                self.assertEqual(calls.count('convert'), 1)

    def test_guard_stops_each_boundary_without_further_calls(self):
        for fail_at, expected in [(1, []), (2, ['lookup']),
                                  (3, ['lookup', 'path']),
                                  (4, ['lookup', 'path', 'convert'])]:
            with self.subTest(fail_at=fail_at):
                api, calls = fake_api()
                checks = []

                def guard():
                    checks.append(1)
                    if len(checks) == fail_at:
                        raise ValueError('MOCK_ONLY guard stop')

                record = {}
                with self.assertRaisesRegex(ValueError, 'guard stop'):
                    helper.observe(api, record, guard, mock_binding)
                self.assertEqual(calls, expected)
                self.assertNotIn('status', record)

    def test_dormant_manifest_prevents_any_admission(self):
        with patch.object(helper, 'MANIFEST_SHA', 'PENDING_MOCK_ONLY'):
            with self.assertRaisesRegex(ValueError, 'DORMANT'):
                helper.verify_inputs()

    def temporary_run(self, failure=False, preexisting_result=False, refuse_inputs=False):
        api, calls = fake_api(converter_error=failure)
        observe = helper.observe
        with tempfile.TemporaryDirectory(prefix='MW5_MOCK_ONLY_converter_') as temp:
            output = Path(temp)

            def inputs():
                if refuse_inputs:
                    raise ValueError('MOCK_ONLY input drift')

            def invoke(api_value, record, guard):
                self.assertTrue((output / 'native.consumed.json').exists())
                return observe(api_value, record, guard, mock_binding)

            with patch.object(helper, 'OUTPUT', output), \
                    patch.object(helper, 'verify_directory', lambda: None), \
                    patch.object(helper, 'verify_inputs', inputs), \
                    patch.object(helper, 'observe', invoke), \
                    patch.object(helper.os, 'getpid', return_value=26084), \
                    patch.dict(helper.sys.modules, {'unreal': api}):
                if preexisting_result:
                    (output / 'native.result.json').write_text('MOCK_ONLY sentinel')
                    with self.assertRaisesRegex(ValueError, 'One-use evidence exists'):
                        helper.run(api)
                    self.assertFalse((output / 'native.consumed.json').exists())
                    self.assertEqual((output / 'native.result.json').read_text(), 'MOCK_ONLY sentinel')
                elif refuse_inputs:
                    with self.assertRaisesRegex(ValueError, 'input drift'):
                        helper.run(api)
                    self.assertEqual(list(output.iterdir()), [])
                else:
                    record = helper.run(api)
                    self.assertEqual(record['status'], 'STOPPED_NO_RETRY' if failure else 'OBSERVED_NATIVE_CONVERTER_EXACT_PATH')
                    before = {q.name: q.read_bytes() for q in output.iterdir()}
                    self.assertEqual(set(before), {'native.consumed.json', 'native.result.json'})
                    persisted = json.loads(before['native.result.json'])
                    self.assertEqual((persisted['converter_attempts'], persisted['converter_calls_returned']), (1, 0 if failure else 1))
                    with self.assertRaisesRegex(ValueError, 'One-use evidence exists'):
                        helper.run(api)
                    self.assertEqual(before, {q.name: q.read_bytes() for q in output.iterdir()})
                    self.assertEqual(calls, ['lookup', 'path', 'convert'])
                if preexisting_result or refuse_inputs:
                    self.assertEqual(calls, [])

    def test_consumed_success_and_failed_attempt_both_refuse_replay(self):
        for failure in [False, True]:
            with self.subTest(failure=failure):
                self.temporary_run(failure=failure)

    def test_preexisting_output_and_input_drift_stop_before_claim(self):
        self.temporary_run(preexisting_result=True)
        self.temporary_run(refuse_inputs=True)


if __name__ == '__main__':
    unittest.main(verbosity=2)
