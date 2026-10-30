"""MOCK_ONLY structural/type/provenance checks; never native invocation."""
import ast
import copy
import importlib.util
import json
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]
PATH = ROOT / 'scripts/Prepare-PhaseB0CaptureTypeFunction.py'
spec = importlib.util.spec_from_file_location('b0_candidate_test', PATH)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class ProofCandidate(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.good = module.build()

    def data(self):
        return copy.deepcopy(self.good)

    def refused(self, mutate):
        d = self.data()
        mutate(d)
        with self.assertRaises(ValueError):
            module.emit(d)

    def test_fixed_thirteen_nodes_and_two_locals(self):
        self.assertEqual(module.validate(self.good), {'nodes': 13, 'pins': 36, 'locals': 2,
                         'reciprocal_data_edges': 9, 'connected_execution_edges': 0})

    def test_whole_function_envelope_and_reciprocal_internal_links(self):
        raw = module.emit(self.good).decode('utf-8')
        self.assertTrue(raw.startswith('BPGraph(GraphName="ProofB0CaptureTypes_Full",GraphType=GT_Function,'))
        pos = raw.index('NodesString=') + len('NodesString=')
        body, used = json.JSONDecoder().raw_decode(raw[pos:])
        self.assertEqual(raw[pos + used:], ')')
        wrapped = 'Begin Object Class=/Script/Engine.Blueprint Name="BP_CodexAuthoringProbe"\nBegin Object Class=/Script/Engine.EdGraph Name="ProofB0CaptureTypes_Full"\n' + body + 'End Object\nEnd Object\n'
        t = module.core.Templates()
        records = t.index(wrapped, 'BP_CodexAuthoringProbe')
        nodes = [x for x in records if x['class_path'].startswith('/Script/BlueprintGraph.K2Node_')]
        self.assertEqual(len(nodes), 13)
        ports = {(n['relative_path'].rsplit('.', 1)[-1], q['PinId']): q for n in nodes for q in
                 [t.helper['pin_fields'](p['text']) for p in n['pin_lines']]}
        linked = 0
        for key, q in ports.items():
            links = t.helper['links'](q)
            if q['PinType.PinCategory'] == '"exec"':
                self.assertEqual(links, ())
            for endpoint in links:
                self.assertIn(endpoint, ports)
                self.assertIn(key, t.helper['links'](ports[endpoint]))
                linked += 1
        self.assertEqual(linked, 18)

    def test_exact_native_function_and_member_identities(self):
        n = self.good['nodes']
        self.assertIn(module.MEMBER_REF, n['Array']['fields'])
        self.assertIn('FunctionReference=(MemberParent=Class\'"/Script/Engine.GameplayStatics"\',MemberName="GetObjectClass")', n['GetClass']['fields'])
        self.assertIn(module.MACRO, n['ValidObject']['fields'])
        self.assertTrue(all(x['source']['registration'] for x in n.values()))

    def test_object_array_not_class_array(self):
        for name in ('Length', 'Clear'):
            q = self.good['nodes'][name]['pins']['TargetArray']
            self.assertEqual(q['PinType.PinCategory'], '"object"')
            self.assertEqual(q['PinType.PinSubCategoryObject'], module.PCC)
            self.assertEqual(q['PinType.ContainerType'], 'Array')
        self.refused(lambda d: d['nodes']['Clear']['pins']['TargetArray'].__setitem__('PinType.PinCategory', '"class"'))

    def test_no_function_signature_or_hidden_invocation(self):
        self.assertEqual(set(self.good['nodes']['Entry']['pins']), {'then'})
        self.assertNotIn('Return', self.good['nodes'])
        self.assertFalse(any('bCallInEditor=True' in x for n in self.good['nodes'].values() for x in n['fields']))
        self.refused(lambda d: d['edges'].append(['Entry', 'then', 'Clear', 'execute']))

    def test_fresh_identity_collision_and_source_reuse_rejected(self):
        self.refused(lambda d: d['nodes']['Clear'].__setitem__('guid', d['nodes']['Length']['guid']))
        self.refused(lambda d: d['nodes']['Clear'].__setitem__('guid', d['source_ids'][0]))

    def test_foreign_variable_binding_rejected(self):
        self.refused(lambda d: d['nodes']['GetClassLocal']['fields'].__setitem__(0, module.MEMBER_REF))

    def test_unobserved_function_or_macro_rejected(self):
        self.refused(lambda d: d['nodes']['GetClass']['fields'].append('FunctionReference=(MemberName="Unobserved")'))
        self.refused(lambda d: d['nodes']['ValidObject']['fields'].remove(module.MACRO))

    def test_class_to_object_proposal_cannot_silently_retype_target(self):
        self.refused(lambda d: d['nodes']['ClassPath']['pins']['Object'].__setitem__('PinType.PinCategory', '"class"'))
        self.refused(lambda d: d['nodes']['GetClass']['pins']['ReturnValue'].__setitem__('PinType.PinSubCategoryObject', module.OBJECT))

    def test_external_links_and_orphan_pins_rejected(self):
        self.refused(lambda d: d['nodes']['ClassPath']['pins']['Object'].__setitem__('LinkedTo', '(ExternalNode AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA,)'))
        self.refused(lambda d: d['nodes']['ClassPath']['pins']['Object'].__setitem__('bOrphanedPin', 'True'))

    def test_local_declaration_mismatch_rejected(self):
        self.refused(lambda d: d['locals']['ProofCurrentClass'].__setitem__('declaration', d['locals']['ProofCurrentComponent']['declaration']))

    def test_source_pin_drift_refuses(self):
        with self.assertRaises(ValueError):
            module.pinned(module.PARTIAL, '0' * 64)

    def test_engine_python_grammar(self):
        ast.parse(PATH.read_text(encoding='utf-8'), feature_version=(3, 7))


if __name__ == '__main__':
    unittest.main(verbosity=2)
