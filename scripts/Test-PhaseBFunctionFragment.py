"""Focused offline BPGraph escaping and identity-preservation checks."""
import ast
import copy
from pathlib import Path
import unittest

PATH = Path(__file__).resolve().with_name('Prepare-PhaseBFunctionFragment.py')
M = {'__name__': 'offline_function_fragment', '__file__': str(PATH)}
exec(compile(PATH.read_bytes(), str(PATH), 'exec'), M)


class FunctionFragmentTests(unittest.TestCase):
    def setUp(self):
        self.source = M['load_source']()
        self.mapping = M['fresh_map'](self.source)
        self.name = M['NEW_FUNCTION']
        self.known = ['ProofHelper', 'ProofHelper_0']
        self.payload = M['render'](self.source, self.name, self.mapping, self.known)

    def validate(self, value):
        return M['validate'](value, self.source, self.name, self.mapping, self.known)

    def test_exact_native_roundtrip_and_generated_reversible_clone(self):
        self.assertEqual(M['encode_graph']('ProofHelper', self.source['nodes']), self.source['raw'])
        result = self.validate(self.payload)
        self.assertEqual((result['nodes'], result['pins'], result['boolean_locals'], result['fresh_guids']), (2, 4, 1, 7))
        self.assertEqual(self.payload.count(b'MemberName=\\"ProofHelperGenerated\\"'), 2)
        self.assertNotIn(b'MemberGuid=', self.payload)

    def test_escape_newline_or_trailing_data_drift_rejected(self):
        for raw in (self.payload + b'\n', self.payload + b'extra', self.payload.replace(b'\\r\\n', b'\\n', 1),
                    self.payload.replace(b'\\r\\n', b'\\t', 1)):
            with self.subTest(raw=raw[-15:]):
                with self.assertRaises(ValueError):
                    M['split_graph'](raw)

    def test_invalid_or_existing_function_name_rejected(self):
        for name in ('ProofHelper', 'ProofHelper_0', 'Bad"Name', 'A\\B', 'A\nB', '9Bad', 'A' * 65):
            with self.subTest(name=name):
                with self.assertRaisesRegex(ValueError, 'FRESH_VALID_FUNCTION_NAME'):
                    M['render'](self.source, name, self.mapping, self.known)

    def test_duplicate_zero_old_or_missing_guid_rejected(self):
        keys = list(self.mapping)
        variants = []
        value = dict(self.mapping);value[keys[1]] = value[keys[0]];variants.append(value)
        value = dict(self.mapping);value[keys[0]] = '0' * 32;variants.append(value)
        value = dict(self.mapping);value[keys[0]] = keys[0];variants.append(value)
        value = dict(self.mapping);del value[keys[0]];variants.append(value)
        for mapping in variants:
            with self.assertRaises(ValueError):
                M['render'](self.source, self.name, mapping, self.known)

    def test_original_blueprint_and_field_order_cannot_be_retargeted(self):
        for raw in (self.payload.replace(M['BLUEPRINT'].encode(), b'/Game/Other.Other'),
                    self.payload.replace(b'GraphType=GT_Function', b'GraphType=GT_Ubergraph')):
            with self.assertRaises(ValueError):
                self.validate(raw)

    def test_local_type_metadata_and_parameter_schema_preserved(self):
        changes = ((b'PinCategory=\\"bool\\"', b'PinCategory=\\"int\\"'),
                   (b'PropertyFlags=5', b'PropertyFlags=0'),
                   (b'ExtraFlags=201457664', b'ExtraFlags=0'),
                   (b'PinName=\\"NewParam1\\"', b'PinName=\\"OtherParam\\"'))
        for before, after in changes:
            changed = self.payload.replace(before, after, 1)
            self.assertNotEqual(changed, self.payload)
            with self.assertRaises(ValueError):
                self.validate(changed)

    def test_local_guid_definition_maps_without_invented_access_nodes(self):
        old = next(k for k, v in self.source['guid_roles'].items() if v == 'VarGuid')
        self.assertNotIn(old.encode(), self.payload)
        self.assertEqual(self.payload.count(('VarGuid=' + self.mapping[old]).encode()), 1)
        self.assertNotIn(b'VariableReference=', self.payload)
        self.assertNotIn(b'K2Node_Variable', self.payload)

    def test_external_or_one_way_link_rejected(self):
        for raw in (self.payload.replace(b'LinkedTo=(K2Node_FunctionResult_821 ', b'LinkedTo=(K2Node_FunctionResult_999 ', 1),
                    self.payload.replace(b'LinkedTo=(K2Node_FunctionEntry_820 ', b'LinkedTo=(K2Node_FunctionEntry_0 ', 1)):
            with self.assertRaises(ValueError):
                self.validate(raw)

    def test_mutated_source_body_rejected(self):
        self.source = copy.deepcopy(self.source)
        self.source['nodes'] = self.source['nodes'].replace('PropertyFlags=5', 'PropertyFlags=0')
        with self.assertRaisesRegex(ValueError, 'SOURCE_BODY_CHANGED'):
            M['render'](self.source, self.name, self.mapping, self.known)

    def test_size_bounds_and_python37(self):
        for raw in (b'', b'x' * (M['MAX_BYTES'] + 1)):
            with self.assertRaisesRegex(ValueError, 'BPGRAPH_BYTE_BOUND'):
                M['split_graph'](raw)
        ast.parse(PATH.read_text(encoding='utf-8'), feature_version=(3, 7))
        ast.parse(Path(__file__).read_text(encoding='utf-8'), feature_version=(3, 7))


if __name__ == '__main__':
    print('MOCK_ONLY offline BPGraph checks; native import/runtime NOT_PERFORMED', flush=True)
    unittest.main(verbosity=2)
