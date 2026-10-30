"""MOCK_ONLY checks of the exact three-node wrapper candidate."""
import ast
import copy
import importlib.util
import json
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]
DIRECTORY = ROOT / 'research/evidence/phase-b-no-local-wrapper-20260927-01'


def load(relative, name):
    path = ROOT / relative
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


build = load('scripts/Prepare-PhaseBNoLocalWrapper.py', 'wrapper_builder')


class WrapperTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.graph = build.wrapper_graph()
        data = json.loads((DIRECTORY / 'ProofNoLocalWrapper.graph.json').read_bytes())
        cls.graph.nodes = {n['label']: n for n in data['nodes']}
        cls.graph.edges = [tuple(e) for e in data['edges']]
        cls.graph.locals = data['locals']

    def test_zero_inputs_locals_and_exact_source_guid(self):
        self.assertEqual(set(self.graph.nodes['Entry']['pins']), {'then'})
        self.assertEqual(self.graph.locals, {})
        self.assertFalse(any(f.startswith('LocalVariables(') for n in self.graph.nodes.values() for f in n['fields']))
        self.assertIn('FunctionReference=(MemberName="ProofHelper_0",MemberGuid=C194F2CF48B109EE4A0BDA89FE06F222,bSelfContext=True)', self.graph.nodes['CallHelper']['fields'])
        self.assertEqual(set(self.graph.nodes), {'Entry', 'CallHelper', 'Return'})

    def test_actual_execution_order_returns_callee_output_once(self):
        # Tiny fixed-graph mock follows actual exec edges and consumes the actual
        # return data edge. It does not call Unreal or pretend to validate its VM.
        graph = self.graph
        control = {(a, pa): (b, pb) for a, pa, b, pb in graph.edges if graph.nodes[a]['pins'][pa]['PinType.PinCategory'] == '"exec"'}
        data = {(b, pb): (a, pa) for a, pa, b, pb in graph.edges if graph.nodes[a]['pins'][pa]['PinType.PinCategory'] != '"exec"'}
        for returned in ['', 'MOCK_CALLEE_RETURN_SENTINEL']:
            calls, values = [], {}
            node, port = control[('Entry', 'then')]
            self.assertEqual((node, port), ('CallHelper', 'execute'))
            literal = json.loads(graph.nodes[node]['pins']['NewParam']['DefaultValue'])
            self.assertEqual(literal, build.LITERAL)
            self.assertTrue(literal.isascii())
            calls.append(('ProofHelper_0', literal))
            values[('CallHelper', 'NewParam1')] = returned
            self.assertEqual(control[(node, 'then')], ('Return', 'execute'))
            self.assertEqual(values[data[('Return', 'Result')]], returned)
            self.assertEqual(len(calls), 1)
            self.assertEqual(len(control), 2)
            self.assertEqual(len(data), 1)

    def test_frozen_payload_exact_reemit_and_internal_links(self):
        expected = (DIRECTORY / 'ProofNoLocalWrapper.clipboard.txt').read_bytes()
        self.assertEqual(build.core.digest(expected), 'b5adf6d792c232cdf4bdcb0e2c815451cb310142acc5defd0435634ba11b1e58')
        self.assertEqual(self.graph.emit(), expected)
        quoted = expected.decode().split('NodesString=', 1)[1]
        body, end = json.JSONDecoder().raw_decode(quoted)
        self.assertEqual(quoted[end:], ')')
        nodes = []
        for match in re.finditer(r'Begin Object Class=([^ ]+) Name="([^"]+)"\r\n(.*?)\r\nEnd Object', body, re.S):
            nodes.append({'relative_path': match.group(2), 'pin_lines': [{'text': line.strip()} for line in match.group(3).split('\r\n') if line.strip().startswith('CustomProperties Pin (')]})
        pins, edges, external = self.graph.h['checked_graph'](nodes)
        self.assertEqual((len(nodes), len(pins), len(edges), external), (3, 8, 6, []))

    def test_fresh_identity_and_python37_grammar(self):
        other = build.wrapper_graph()
        self.assertFalse(set(other.validate()['ids']) & set(self.graph.validate()['ids']))
        for path in [Path(build.__file__), Path(__file__)]:
            ast.parse(path.read_text(encoding='utf-8-sig'), filename=str(path), feature_version=(3, 7))


if __name__ == '__main__':
    print('MOCK_ONLY wrapper graph checks; native execution NOT_PERFORMED.', flush=True)
    unittest.main(verbosity=2)
