"""Offline source/graph tests only. No native clipboard, editor or runtime calls."""
import ast
import copy
import hashlib
from pathlib import Path
import re
import tempfile
import unittest

PATH = Path(__file__).resolve().with_name('Prepare-PhaseBTypedSetFragment.py')
M = {'__file__': str(PATH), '__name__': 'offline_typed_fragment'}
exec(compile(PATH.read_bytes(), str(PATH), 'exec'), M)


class TypedFragmentTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.source = M['load_bundle']()

    def setUp(self):
        self.bundle = dict(self.source)
        self.bundle['nodes'] = copy.deepcopy(self.source['nodes'])
        self.bundle['bindings'] = copy.deepcopy(self.source['bindings'])
        self.ids = M['new_identifiers'](self.bundle)
        self.payload = M['render'](self.bundle, self.ids)

    def rejects_payload(self, changed):
        self.assertNotEqual(self.payload, changed)
        with self.assertRaises(ValueError):
            M['validate'](changed, self.bundle, self.ids)

    def test_fixed_candidate_has_exact_native_members_types_and_four_edges(self):
        checks = M['validate'](self.payload, self.bundle, self.ids)
        self.assertEqual((checks['nodes'], checks['pins'], checks['reciprocal_data_edges']), (5, 17, 4))
        self.assertEqual(checks['connected_execution_pins'], 0)
        text = self.payload.decode()
        self.assertEqual(text.count('MemberGuid=797594DD4AE67BA292738F9CEA4DDE77'), 1)
        self.assertEqual(text.count('MemberGuid=015366E249BCC10191C2138BB26AEC08'), 1)
        # Query return, Set input and Set getter retain the native inferred array.
        arraypins = [p for p in text.splitlines() if 'PinType.ContainerType=Array' in p]
        self.assertEqual(len(arraypins), 3)
        self.assertTrue(all(M['BASE_CLASS'] in p for p in arraypins))
        self.assertNotIn('NewVariables(', text)
        self.assertNotIn('K2Node_Event', text)

    def test_fresh_ids_leave_member_and_persistent_guids_unchanged(self):
        text = self.payload.decode()
        for node in self.bundle['nodes']:
            old_guid = next(r['text'].split('=')[1] for r in node['fields'] if r['text'].startswith('NodeGuid='))
            self.assertNotIn(old_guid, text)
            for row in node['pin_lines']:
                self.assertNotIn(M['pin_fields'](row['text'])['PinId'], text)
        self.assertEqual(text.count('PersistentGuid=' + '0' * 32), 17)

    def test_catalog_v2_and_v3_lookup_is_registered_source_bound(self):
        for key in ('function:K2_GetComponentsByClass', 'function:GetPathName',
                    'function:GetSubstring', 'function:BooleanAND', 'function:Not_PreBool',
                    'function:EqualEqual_IntInt', 'function:LessEqual_IntInt'):
            with self.subTest(key=key):
                node = M['catalog_template'](self.bundle, key)
                self.assertTrue(node['pin_lines'])
                self.assertIn('MemberName="' + key.split(':')[1] + '"', str(node['fields']))
        with self.assertRaisesRegex(ValueError, 'MISSING_OR_AMBIGUOUS'):
            M['catalog_template'](self.bundle, 'function:InventedNativeFunction')

    def test_catalog_field_tamper_rejected_against_unchanged_source(self):
        self.bundle['catalogs'] = copy.deepcopy(self.bundle['catalogs'])
        node = self.bundle['catalogs'][1]['examples']['function:GetSubstring']
        node['fields'][0]['text'] += 'tampered'
        with self.assertRaisesRegex(ValueError, 'CATALOG_SOURCE_DISAGREEMENT'):
            M['catalog_template'](self.bundle, 'function:GetSubstring')

    def test_source_pin_drift_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            source = Path(tmp) / 'source.COPY'
            source.write_bytes(b'unchanged')
            expected = hashlib.sha256(b'unchanged').hexdigest()
            self.assertEqual(M['pinned'](source, expected), b'unchanged')
            source.write_bytes(b'changed')
            with self.assertRaisesRegex(ValueError, 'SOURCE_PIN_DRIFT'):
                M['pinned'](source, expected)

    def test_duplicate_and_baseline_guid_collisions_rejected(self):
        first = M['SELECTED'][0]
        second = M['SELECTED'][1]
        self.ids[second]['node_guid'] = self.ids[first]['node_guid']
        with self.assertRaisesRegex(ValueError, 'DUPLICATE_FRESH_ID'):
            M['render'](self.bundle, self.ids)
        self.ids = M['new_identifiers'](self.bundle)
        self.ids[first]['node_guid'] = '797594DD4AE67BA292738F9CEA4DDE77'
        with self.assertRaisesRegex(ValueError, 'FRESH_ID_REQUIRED'):
            M['render'](self.bundle, self.ids)

    def test_name_collision_and_unproven_destination_rejected(self):
        node = self.bundle['nodes'][0]
        ids = {node['relative_path']: copy.deepcopy(self.ids[node['relative_path']])}
        ids[node['relative_path']]['name'] = 'K2Node_Self_700'
        with self.assertRaisesRegex(ValueError, 'DESTINATION_NAME_COLLISION'):
            M['remap_nodes']([node], ids, self.bundle['text'], [(0, 0)])
        with self.assertRaisesRegex(ValueError, 'DESTINATION_REBINDING_NOT_PROVEN'):
            M['render'](self.bundle, self.ids, '/Game/Other.Other')

    def test_existing_member_guid_and_type_drift_rejected(self):
        self.bundle['bindings']['ProofComponents']['guid'] = 'A' * 32
        with self.assertRaisesRegex(ValueError, 'DESTINATION_MEMBER_BINDING_DRIFT'):
            M['render'](self.bundle, self.ids)
        self.bundle['bindings'] = copy.deepcopy(self.source['bindings'])
        self.bundle['bindings']['ProofComponents']['type'] = '(PinCategory="object")'
        with self.assertRaisesRegex(ValueError, 'DESTINATION_MEMBER_BINDING_DRIFT'):
            M['render'](self.bundle, self.ids)

    def test_unapproved_source_function_change_rejected(self):
        self.bundle['nodes'][1]['fields'][2]['text'] = 'FunctionReference=(MemberName="Invented")'
        with self.assertRaisesRegex(ValueError, 'SOURCE_NODE_MUTATED'):
            M['render'](self.bundle, self.ids)

    def test_one_way_and_dangling_internal_link_rejected(self):
        changed = re.sub(br'LinkedTo=\([^)]*\),', b'', self.payload, count=1)
        self.rejects_payload(changed)
        pin = next(iter(self.ids[M['SELECTED'][1]]['pins'].values()))
        self.rejects_payload(self.payload.replace(('K2Node_CallFunction_801 ' + pin).encode(), b'K2Node_CallFunction_801 ' + b'F' * 32, 1))

    def test_external_link_in_candidate_rejected(self):
        changed = self.payload.replace(b'LinkedTo=(', b'LinkedTo=(K2Node_CallFunction_999 ' + b'F' * 32 + b',', 1)
        self.rejects_payload(changed)

    def test_reusable_remapper_removes_external_links_when_selecting_subset(self):
        node = self.bundle['nodes'][1]
        ids = {node['relative_path']: self.ids[node['relative_path']]}
        payload, removed = M['remap_nodes']([node], ids, self.bundle['text'], [(0, 0)])
        self.assertEqual(len(removed), 2)  # Source Self and Set lie outside subset.
        self.assertNotIn(b'LinkedTo=', payload)
        self.assertIn(b'MemberName="K2_GetComponentsByClass"', payload)
        self.assertIn(M['BASE_CLASS'].encode(), payload)

    def test_member_reference_or_inferred_type_payload_tamper_rejected(self):
        self.rejects_payload(self.payload.replace(b'MemberGuid=015366E249BCC10191C2138BB26AEC08', b'MemberGuid=' + b'F' * 32))
        self.rejects_payload(self.payload.replace(b'PinType.ContainerType=Array', b'PinType.ContainerType=None', 1))
        self.rejects_payload(self.payload.replace(M['BASE_CLASS'].encode(), b'/Script/Engine.ActorComponent', 1))

    def test_adding_reciprocal_execution_edge_rejected(self):
        a, b = self.bundle['nodes'][3:]
        ids_a, ids_b = self.ids[a['relative_path']], self.ids[b['relative_path']]
        out_old = next(M['pin_fields'](p['text'])['PinId'] for p in a['pin_lines'] if 'PinName="then"' in p['text'])
        in_old = next(M['pin_fields'](p['text'])['PinId'] for p in b['pin_lines'] if 'PinName="execute"' in p['text'])
        out_id, in_id = ids_a['pins'][out_old], ids_b['pins'][in_old]
        lines = self.payload.decode().splitlines()
        for i, line in enumerate(lines):
            if 'PinId=' + out_id in line:
                lines[i] = line.replace('PersistentGuid=', 'LinkedTo=(' + ids_b['name'] + ' ' + in_id + ',),PersistentGuid=')
            elif 'PinId=' + in_id in line:
                lines[i] = line.replace('PersistentGuid=', 'LinkedTo=(' + ids_a['name'] + ' ' + out_id + ',),PersistentGuid=')
        self.rejects_payload(('\r\n'.join(lines) + '\r\n').encode())

    def test_pin_defaults_and_flags_preserved_beyond_type(self):
        self.rejects_payload(self.payload.replace(b'bIsConstFunc=True', b'bIsConstFunc=False', 1))
        self.rejects_payload(self.payload.replace(b'bHidden=True', b'bHidden=False', 1))
        self.rejects_payload(self.payload.replace(b'DefaultObject="/Script/Engine.Default__KismetSystemLibrary"', b'DefaultObject=None', 1))

    def test_bounds_and_serialization_errors_fail_closed(self):
        for value in (b'', b'x' * (M['MAX_BYTES'] + 1)):
            with self.assertRaisesRegex(ValueError, 'PAYLOAD_BOUND'):
                M['validate'](value, self.bundle, self.ids)
        for value in ('a=1,a=2', 'a=(x=1', 'a="unfinished'):
            with self.assertRaises(ValueError):
                M['attributes'](value)

    def test_python37_grammar_and_no_native_or_clipboard_calls(self):
        tree = ast.parse(PATH.read_text(encoding='utf-8'), feature_version=(3, 7))
        forbidden = {'unreal', 'pyperclip', 'ctypes', 'subprocess'}
        imports = {n.name.split('.')[0] for x in ast.walk(tree) if isinstance(x, ast.Import) for n in x.names}
        imports |= {x.module.split('.')[0] for x in ast.walk(tree) if isinstance(x, ast.ImportFrom) and x.module}
        self.assertFalse(imports & forbidden)
        ast.parse(Path(__file__).read_text(encoding='utf-8'), feature_version=(3, 7))


if __name__ == '__main__':
    print('MOCK_ONLY offline source/graph validation; native import/runtime NOT_PERFORMED', flush=True)
    unittest.main(verbosity=2)
