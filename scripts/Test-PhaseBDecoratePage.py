"""MOCK_ONLY execution of the emitted decorator graph, never Unreal.

The shared graph interpreter supplies typed locals/branches/loops. This file
adds only the two string primitives used by this candidate and records bounded
concatenations. The independent existing model is the output oracle.
"""
import ast
import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import random
import re
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]
EVIDENCE = ROOT / 'research/evidence/phase-b-decorate-page-20260927-01'


def module(name, relative, sha=None):
    path = ROOT / relative
    if sha and hashlib.sha256(path.read_bytes()).hexdigest() != sha:
        raise ValueError('TEST_DEPENDENCY_PIN_CHANGED: ' + relative)
    spec = importlib.util.spec_from_file_location(name, path)
    result = importlib.util.module_from_spec(spec)
    sys.modules[name] = result
    spec.loader.exec_module(result)
    return result


build = module('decorator_builder', 'scripts/Prepare-PhaseBDecoratePage.py')
machine_source = module('decorator_graph_machine', 'scripts/Test-PhaseBTextFunctions.py',
                        '40a3c967ce38de8d71cb9eb4e1dd29f2d6847c8e4c8ff0587b641f0eba0a69ba')
model = module('decorator_reference_model', 'scripts/ObserverPhaseBModel.py',
               'd4091eb4628e191e6a87999b7a4bb4a9abb0e23111cc1bf309866a052b881cd5')
code_units = machine_source.code_units


class DecoratorMachine(machine_source.GraphMachine):
    def __init__(self, graph, inputs):
        super().__init__(graph, inputs)
        self.concatenations = []

    def value(self, name, pin):
        node = self.g.nodes[name]
        if name not in ('Entry', 'Return'):
            references = [f for f in node['fields'] if f.startswith('FunctionReference=')]
            if references:
                function = re.search(r'MemberName="([^"]+)"', references[0]).group(1)
                if function == 'EqualEqual_StrStr':
                    return self.input(name, 'A') == self.input(name, 'B')
                if function == 'Conv_IntToString':
                    return str(self.input(name, 'InInt'))
                if function == 'Concat_StrStr':
                    a, b = self.input(name, 'A'), self.input(name, 'B')
                    count = len(code_units(a)) + len(code_units(b))
                    self.concatenations.append((name, count))
                    if count > 768:
                        raise AssertionError('Unbounded intermediate concatenation')
                    return a + b
        return super().value(name, pin)


def frozen_graph():
    raw = (EVIDENCE / 'DecorateBoundedPage.graph.json').read_bytes()
    if hashlib.sha256(raw).hexdigest() != 'bb0c2594ee41821e14cce2538a8b725487446e20f7ecae550f0074553e0a3712':
        raise ValueError('FROZEN_GRAPH_PIN_CHANGED')
    data = json.loads(raw)
    graph = build.decorate_function(build.shared.core.Templates())
    graph.nodes = {n['label']: n for n in data['nodes']}
    graph.locals, graph.edges = data['locals'], [tuple(e) for e in data['edges']]
    return graph


class DecoratePage(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.graph = frozen_graph()

    def run_page(self, body='', index=0, total=1, status='COMPLETE', graph=None):
        machine = DecoratorMachine(graph or self.graph,
                                   {'Body': body, 'Index': index, 'Total': total, 'Status': status})
        result = machine.run()
        self.assertLessEqual(len(machine.char_reads), 640)
        self.assertLessEqual(machine.steps, 10000)
        return result, machine

    def assert_model(self, body='', index=0, total=1, status='COMPLETE'):
        result, machine = self.run_page(body, index, total, status)
        try:
            expected = model.decorate(body, index, total, status)
        except model.BoundError:
            self.assertEqual(result, {'Valid': False, 'Page': '', 'Units': 0})
        else:
            self.assertEqual(result, {'Valid': True, 'Page': expected, 'Units': model.units(expected)})
            self.assertLessEqual(len(result['Page'].split('\n')), 16)
        return result, machine

    def test_all_page_positions_and_statuses_match_model(self):
        maximum = 0
        for total in range(1, 71):
            for index in range(total):
                for status in ('COMPLETE', 'INCOMPLETE', 'NOT_COLLECTED'):
                    result, machine = self.assert_model('', index, total, status)
                    maximum = max(maximum, result['Units'])
                    self.assertEqual(machine.char_reads, [])
        self.assertEqual(maximum, 91)

    def test_summary_and_ordinary_body_unit_edges(self):
        for body, index, valid in [('x' * 640, 0, True), ('x' * 641, 0, False),
                                   ('x' * 600, 1, True), ('x' * 601, 1, False),
                                   ('界' * 640, 0, True), ('🚀' * 320, 0, True),
                                   ('🚀' * 321, 0, False), ('🚀' * 300, 1, True)]:
            result, machine = self.assert_model(body, index, 2)
            self.assertEqual(result['Valid'], valid)
            if not valid:
                self.assertEqual(machine.char_reads, [])
                self.assertEqual(machine.concatenations, [])

    def test_large_body_rejected_before_scan_or_format(self):
        result, machine = self.assert_model('x' * 100000)
        self.assertFalse(result['Valid'])
        self.assertEqual(machine.char_reads, [])
        self.assertEqual(machine.concatenations, [])

    def test_invalid_count_and_status_rejected_before_body_reads(self):
        for index, total, status in [(-1, 1, 'COMPLETE'), (1, 1, 'COMPLETE'), (0, 0, 'COMPLETE'),
                                     (0, 71, 'COMPLETE'), (2147483647, 2147483647, 'COMPLETE'),
                                     (-2147483648, 1, 'COMPLETE'), (0, 1, ''), (0, 1, 'complete'),
                                     (0, 1, 'UNKNOWN'), (0, 1, 'COMPLETE '), (0, 1, 'X' * 100000)]:
            result, machine = self.assert_model('hello', index, total, status)
            self.assertFalse(result['Valid'])
            self.assertEqual(machine.char_reads, [])
            self.assertEqual(machine.concatenations, [])

    def test_empty_body_and_exact_line_limit(self):
        for body, valid in [('', True), ('\n' * 12, True), ('\n' * 13, False),
                             ('line\n' * 12 + 'last', True), ('line\n' * 13, False)]:
            result, machine = self.assert_model(body)
            self.assertEqual(result['Valid'], valid)
            if not valid:
                self.assertEqual(machine.concatenations, [])

    def test_surrogate_invalid_cases_do_not_publish_or_format(self):
        for body in ['\ud800', '\udbff', '\udc00', '\udfff', '\ud800A', '\ud800\ud800',
                     '\udc00\ud800', '\udbff\n', 'x' * 639 + '\ud800']:
            result, machine = self.assert_model(body)
            self.assertFalse(result['Valid'])
            self.assertEqual(machine.concatenations, [])

    def test_paired_surrogate_boundaries_preserve_units(self):
        for body in ['a' * 39 + '🚀' + 'b' * 100, 'a' * 638 + '🚀', '🚀' * 320]:
            self.assertTrue(self.assert_model(body)[0]['Valid'])
        # UTF-16 graph semantics accept a valid explicit high/low sequence.
        # Python's reference model represents the same scalar as one character.
        paired = '\ud800\udc00'
        result, _ = self.run_page(paired)
        expected = model.decorate('\U00010000', 0, 1, 'COMPLETE')
        self.assertTrue(result['Valid'])
        self.assertEqual(code_units(result['Page']), code_units(expected))

    def test_controls_belong_to_upstream_identity_validator(self):
        # These are MOCK_ONLY, especially NUL: Python/native wrapper behavior is
        # known to differ, so this does not establish Blueprint NUL preservation.
        for character in [chr(n) for n in range(32)] + ['\x7f']:
            self.assertTrue(self.assert_model('before' + character + 'after')[0]['Valid'])

    def test_deterministic_mixed_body_fixtures(self):
        rng = random.Random(27092026)
        alphabet = ['a', '/', '界', 'Ж', 'é', '🚀', '\n']
        for unused in range(55):
            body = ''.join(rng.choice(alphabet) for x in range(rng.randint(0, 680)))
            self.assert_model(body, rng.randrange(2), 2, rng.choice(['COMPLETE', 'INCOMPLETE', 'NOT_COLLECTED']))

    def test_late_invalid_unit_stops_scan_and_empty_outputs(self):
        result, machine = self.run_page('a' * 300 + '\udc00' + 'z' * 300)
        self.assertEqual(result, {'Valid': False, 'Page': '', 'Units': 0})
        self.assertEqual(len(machine.char_reads), 301)
        self.assertEqual(machine.concatenations, [])

    def test_exact_fixed_loop_and_no_native_side_effect_calls(self):
        macros = [n for n in self.graph.nodes.values() if n['class'].endswith('K2Node_MacroInstance')]
        self.assertEqual(len(macros), 1)
        self.assertEqual(json.loads(macros[0]['pins']['LastIndex']['DefaultValue']), '639')
        allowed = {'Len', 'GetCharacterAsNumber', 'LessEqual_IntInt', 'Less_IntInt', 'EqualEqual_IntInt',
                   'BooleanAND', 'BooleanOR', 'Not_PreBool', 'Add_IntInt', 'Concat_StrStr',
                   'EqualEqual_StrStr', 'Conv_IntToString'}
        for label, node in self.graph.nodes.items():
            if label in ('Entry', 'Return'):
                continue
            for field in node['fields']:
                if field.startswith('FunctionReference='):
                    self.assertIn(re.search(r'MemberName="([^"]+)"', field).group(1), allowed)

    def test_actual_length_mismatch_keeps_outputs_atomic(self):
        class WrongLength(DecoratorMachine):
            def value(self, name, pin):
                if name == 'ActualLength':
                    return super().value(name, pin) - 1
                return super().value(name, pin)
        result = WrongLength(self.graph, {'Body': 'ok', 'Index': 0, 'Total': 1, 'Status': 'COMPLETE'}).run()
        self.assertEqual(result, {'Valid': False, 'Page': '', 'Units': 0})

    def test_output_caps_remain_real_guards(self):
        # With the fixed vocabulary, natural pages cannot hit 768. Fault-inject
        # stored admission lengths to show independent rejection still exists.
        for target, value in [('DOverhead', 97), ('DRequired', 769), ('DActual', 769)]:
            class InflatedLength(DecoratorMachine):
                def value(self, name, pin):
                    if name == 'Get' + target:
                        return value
                    return super().value(name, pin)
            result = InflatedLength(self.graph, {'Body': 'ok', 'Index': 0, 'Total': 1, 'Status': 'COMPLETE'}).run()
            self.assertEqual(result, {'Valid': False, 'Page': '', 'Units': 0})

    def test_exact_payload_has_reciprocal_internal_typed_links(self):
        payload = (EVIDENCE / 'DecorateBoundedPage.clipboard.txt').read_bytes()
        self.assertEqual(hashlib.sha256(payload).hexdigest(), '47ddca8a08b0ff7998a447c9337c134ea7828d54b003c3ad1df153b7e96ae38d')
        prefix, quoted = payload.decode().split('NodesString=', 1)
        body, end = json.JSONDecoder().raw_decode(quoted)
        self.assertEqual(quoted[end:], ')')
        nodes = []
        for match in re.finditer(r'Begin Object Class=([^ ]+) Name="([^"]+)"\r\n(.*?)\r\nEnd Object', body, re.S):
            fields = [line.strip() for line in match.group(3).split('\r\n')]
            nodes.append({'relative_path': match.group(2), 'pin_lines': [{'text': x} for x in fields if x.startswith('CustomProperties Pin (')]})
        pins, edges, removed = self.graph.h['checked_graph'](nodes)
        self.assertEqual(removed, [])
        self.assertEqual(len(nodes), len(self.graph.nodes))
        self.assertEqual(len(edges), len(self.graph.edges) * 2)
        self.assertEqual(len(pins), self.graph.validate()['pin_count'])

    def test_python37_parse_and_fresh_scoped_ids(self):
        for path in [Path(build.__file__), Path(__file__)]:
            ast.parse(path.read_text(encoding='utf-8-sig'), filename=str(path), feature_version=(3, 7))
        fresh = build.decorate_function(build.shared.core.Templates())
        self.assertFalse(set(fresh.validate()['ids']) & set(self.graph.validate()['ids']))


if __name__ == '__main__':
    print('MOCK_ONLY decorator graph execution; native import/compile/execution NOT_PERFORMED.', flush=True)
    unittest.main(verbosity=2)
