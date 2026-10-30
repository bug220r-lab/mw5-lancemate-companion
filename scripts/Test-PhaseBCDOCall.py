"""MOCK_ONLY: bounded CDO-call control flow, never editor dispatch."""
import importlib.util
from pathlib import Path
import unittest

path = Path(__file__).with_name('Check-PhaseBCDOCall.py')
spec = importlib.util.spec_from_file_location('cdo_probe_under_test', path)
probe = importlib.util.module_from_spec(spec)
spec.loader.exec_module(probe)


class Obj:
    def __init__(self, path, klass=None):
        self.path, self.klass = path, klass
        self.calls = []
        self.returned = ''
        self.error = None

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
    Class, Object = object(), object()

    def __init__(self):
        self.generated = Obj(probe.CLASS_PATH, Obj('/Script/Engine.BlueprintGeneratedClass'))
        self.cdo = Obj(probe.CDO_PATH, self.generated)
        self.lookups = []

    def find_object(self, outer, name, type, follow_redirectors):
        self.lookups.append((outer, name, type, follow_redirectors))
        return self.generated if name == probe.CLASS_PATH else self.cdo


def observe(api, record=None, guard=lambda: None):
    record = {} if record is None else record
    probe.observe(api, record, guard, check_binding=lambda method, name: {'classification': 'MOCK_ONLY', 'name': name})
    return record


class Tests(unittest.TestCase):
    def test_exact_two_queries_one_fixed_call(self):
        api = API()
        result = observe(api)
        self.assertEqual(api.lookups, [(None, probe.CLASS_PATH, api.Class, False), (None, probe.CDO_PATH, api.Object, False)])
        self.assertEqual(api.cdo.calls, [('ProofHelper_0', ('PHASE_B_CDO_LITERAL_PROBE',))])
        self.assertEqual((result['lookup_count'], result['blueprint_call_count']), (2, 1))
        self.assertTrue(result['result']['matches_default_empty_string'])

    def test_missing_class_stops_no_call(self):
        api = API()
        api.generated = None
        with self.assertRaisesRegex(ValueError, 'already loaded'):
            observe(api)
        self.assertEqual(len(api.lookups), 1)
        self.assertEqual(api.cdo.calls, [])

    def test_wrong_class_stops_no_second_lookup(self):
        api = API()
        api.generated.klass.path = '/Script/CoreUObject.Class'
        with self.assertRaisesRegex(ValueError, 'identity'):
            observe(api)
        self.assertEqual(len(api.lookups), 1)

    def test_missing_cdo_no_fallback(self):
        api = API()
        api.cdo = None
        with self.assertRaisesRegex(ValueError, 'no creation fallback'):
            observe(api)
        self.assertEqual(len(api.lookups), 2)

    def test_wrong_cdo_class_stops_before_call(self):
        api = API()
        api.cdo.klass = Obj('/Script/Engine.Actor')
        with self.assertRaisesRegex(ValueError, 'CDO identity'):
            observe(api)
        self.assertEqual(api.cdo.calls, [])

    def test_guard_failure_immediately_before_call(self):
        api = API()
        checks = []
        def guard():
            checks.append(1)
            if len(checks) == 3:
                raise ValueError('changed source')
        with self.assertRaisesRegex(ValueError, 'changed source'):
            observe(api, guard=guard)
        self.assertEqual(api.cdo.calls, [])

    def test_native_exception_records_attempt_without_retry(self):
        api, record = API(), {}
        api.cdo.error = RuntimeError('fixture refusal')
        with self.assertRaisesRegex(RuntimeError, 'fixture refusal'):
            observe(api, record)
        self.assertEqual(record['blueprint_call_count'], 1)
        self.assertEqual(len(api.cdo.calls), 1)

    def test_unknown_result_not_stringified(self):
        class NeverStringify:
            def __str__(self):
                raise AssertionError('must not stringify')
        result = probe.describe_result(NeverStringify())
        self.assertEqual(result['status'], 'UNEXPECTED_RETURN_TYPE')
        self.assertFalse(result['matches_default_empty_string'])

    def test_tuple_shape_does_not_pass_scalar_contract(self):
        result = probe.describe_result(('',))
        self.assertEqual(result['type'], 'tuple')
        self.assertFalse(result['matches_default_empty_string'])

    def test_python_stub_refused(self):
        with self.assertRaisesRegex(ValueError, 'Native built-in'):
            probe.binding(lambda: None, 'stub')


if __name__ == '__main__':
    unittest.main(verbosity=2)
