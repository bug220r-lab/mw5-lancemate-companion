"""MOCK_ONLY execution of the assembled B0 graph; no Unreal or native dispatch.

The existing scalar graph interpreter executes the actual validator/segmenter
graphs. This adapter models only the additional observed array/object operations.
F8 event wiring, publication and EndPlay are outside this function's test scope.
"""
import ast
import copy
import importlib.util
import json
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]


def module(name, filename):
    spec = importlib.util.spec_from_file_location(name, ROOT / 'scripts' / filename)
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


build = module('b0_capture_builder_tests', 'Prepare-PhaseB0Capture.py')
scalar = module('b0_scalar_graph_tests', 'Test-PhaseBTextFunctions.py')


class MockClass:
    def __init__(self, path, valid=True):
        self.path, self.valid = path, valid


class MockSoftClass:
    """MOCK_ONLY value of the native hard-class to soft-class conversion."""
    def __init__(self, cls):
        if not isinstance(cls, MockClass) or not cls.valid:
            raise AssertionError('Invalid hard-class conversion')
        self.path = cls.path


class MockObject:
    def __init__(self, path='/World/Component', cls=None, valid=True):
        self.path, self.cls, self.valid = path, cls, valid


class MockArray:
    """Bounded synthetic data supports large counts without large allocation."""
    def __init__(self, items=(), count=None):
        self.items = list(items)
        self.count = len(self.items) if count is None else count

    def __len__(self):
        return self.count

    def __getitem__(self, index):
        if not 0 <= index < self.count or index >= 32:
            raise AssertionError('Unbounded or out-of-range array access')
        return self.items[index] if index < len(self.items) else component()

    def copy(self):
        return MockArray(self.items, self.count)

    def clear(self):
        self.items, self.count = [], 0


def component(path='/Game/Other.Other_C', valid=True, class_valid=True):
    return MockObject(cls=MockClass(path, class_valid), valid=valid)


class CaptureMachine(scalar.GraphMachine):
    def __init__(self, graph, helpers, items=(), count=None, **flags):
        surrogate = copy.copy(graph)
        surrogate.locals = {name: dict(row, kind='string') if row['kind'] in ('object', 'class') else row
                            for name, row in graph.locals.items()}
        super().__init__(surrogate, {})
        self.g = graph
        for name, row in graph.locals.items():
            if row['kind'] in ('object', 'class'):
                self.locals[name] = None
        self.helpers = helpers
        self.source_array = MockArray(items, count)
        self.controller = MockObject(flags.get('self_path', '/World/DiagnosticController_C_0'))
        self.stock = MockClass(build.BASE_CLASS, flags.get('stock_valid', True))
        self.widget = MockObject(valid=flags.get('widget_valid', True))
        self.members = {graph.bindings['members']['CapturedComponents']['name']: MockArray(),
                        graph.bindings['members']['ControlReadout']['name']: self.widget}
        self.flags, self.calls, self.executed, self.outputs = flags, [], [], {}
        self.helper_runs = []

    def input(self, name, pin):
        if (name, pin) in self.incoming:
            return self.value(*self.incoming[name, pin])
        prop = self.g.nodes[name]['pins'][pin]
        if prop['PinType.PinCategory'] in ('"object"', '"class"'):
            if prop.get('DefaultObject') == json.dumps(build.BASE_CLASS):
                return self.stock
            return None
        return super().input(name, pin)

    def value(self, name, pin):
        node = self.g.nodes[name]
        if node['class'].endswith('K2Node_Self'):
            return self.controller
        if node['class'].endswith(('K2Node_VariableGet', 'K2Node_VariableSet')):
            variable = self.variable(name)
            return self.locals[variable] if variable in self.locals else self.members[variable]
        if node['class'].endswith('K2Node_GetArrayItem'):
            array, index = self.input(name, 'Array'), self.input(name, 'Dimension 1')
            self.calls.append(('array_get', index))
            return array[index]
        if node['class'].endswith('K2Node_ConvertAsset'):
            self.calls.append(('class_to_softclass',))
            return MockSoftClass(self.input(name, 'Input'))
        ref = next((f for f in node['fields'] if f.startswith('FunctionReference=')), '')
        function = re.search(r'MemberName="([^"]+)"', ref)
        function = function.group(1) if function else None
        inp = lambda port: self.input(name, port)
        if function in self.helpers:
            if name not in self.outputs:
                raise AssertionError('Impure helper output read before its execution')
            return self.outputs[name][pin]
        if function == 'IsGamePaused':
            self.calls.append(('pause',))
            return self.flags.get('paused', False)
        if function == 'IsLocalController':
            self.calls.append(('local',))
            return self.flags.get('local', True)
        if function == 'IsValidClass':
            cls = inp('Class')
            self.calls.append(('class_valid', 'stock' if cls is self.stock else 'entry'))
            return cls is not None and cls.valid
        if function == 'GetPathName':
            obj = inp('Object')
            if isinstance(obj, MockClass):
                raise AssertionError('Class reference is not a GetPathName Object pin value')
            if obj is not self.controller:
                raise AssertionError('Unexpected component object-path read')
            self.calls.append(('path', 'self'))
            if obj is None or not obj.valid:
                raise AssertionError('Invalid object path read')
            return obj.path
        if function == 'Conv_SoftClassReferenceToString':
            reference = inp('SoftClassReference')
            if not isinstance(reference, MockSoftClass):
                raise AssertionError('String converter requires a soft-class reference')
            self.calls.append(('softclass_to_string',))
            return reference.path
        if function == 'GetObjectClass':
            obj = inp('Object')
            self.calls.append(('get_class',))
            if obj is None or not obj.valid:
                raise AssertionError('Invalid component class read')
            return obj.cls
        if function == 'K2_GetComponentsByClass':
            self.calls.append(('query',))
            if inp('self') is not self.controller or inp('ComponentClass') is not self.stock:
                raise AssertionError('Query used another owner/class')
            return self.source_array.copy()
        if function == 'Array_Length':
            self.calls.append(('array_length',))
            return len(inp('TargetArray'))
        if function == 'Conv_IntToString':
            if self.flags.get('oversize_counter_text'):
                return '9' * 12
            return str(inp('InInt'))
        if function == 'EqualEqual_StrStr':
            return inp('A') == inp('B')
        return super().value(name, pin)

    def execute(self, name, input_pin):
        self.executed.append(name)
        node = self.g.nodes[name]
        ref = next((f for f in node['fields'] if f.startswith('FunctionReference=')), '')
        function = re.search(r'MemberName="([^"]+)"', ref)
        function = function.group(1) if function else None
        if function in self.helpers:
            inputs = {p: self.input(name, p) for p, prop in node['pins'].items()
                      if p not in ('self', 'execute', 'then') and prop.get('Direction') != '"EGPD_Output"'}
            machine = scalar.GraphMachine(self.helpers[function], inputs)
            result = machine.run()
            override = self.flags.get('helper_override')
            self.outputs[name] = override(function, result) if override else result
            self.helper_runs.append((function, inputs, machine))
            return self.follow(name, 'then')
        if node['class'].endswith('K2Node_MacroInstance') and 'InputObject' in node['pins']:
            obj = self.input(name, 'InputObject')
            self.calls.append(('object_valid', 'widget' if obj is self.widget else 'entry'))
            return self.follow(name, 'Is Valid' if obj is not None and obj.valid else 'Is Not Valid')
        if node['class'].endswith('K2Node_VariableSet') and self.variable(name) in self.members:
            variable = self.variable(name)
            self.members[variable] = self.input(name, variable).copy()
            return self.follow(name, 'then')
        if function == 'Array_Clear':
            self.calls.append(('clear',))
            self.input(name, 'TargetArray').clear()
            return self.follow(name, 'then')
        return super().execute(name, input_pin)


class CaptureTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.graph = build.build_capture(build.mock_bindings())
        templates = scalar.build.core.Templates()
        cls.helpers = {'ValidateBoundedIdentity': scalar.build.validate_function(templates),
                       'SegmentValidatedPath': scalar.build.segment_function(templates)}

    def capture(self, items=(), count=None, graph=None, **flags):
        machine = CaptureMachine(graph or self.graph, self.helpers, items, count, **flags)
        result = machine.run()
        text = result['Snapshot']
        self.assertLessEqual(len(scalar.code_units(text)), 768)
        self.assertLessEqual(len(text.split('\n')), 16)
        self.assertEqual(text.split('\n')[0], 'B0, SEQUENTIAL CAPTURE, NOT LIVE')
        scan_lines = [line for line in text.split('\n') if line.startswith('Scan: ')]
        self.assertEqual(len(scan_lines), 1)
        self.assertIn(scan_lines[0], ('Scan: COMPLETE', 'Scan: INCOMPLETE', 'Scan: NOT COLLECTED'))
        if ('query',) not in machine.calls:
            self.assertEqual(scan_lines, ['Scan: NOT COLLECTED'])
        elif 'Probe matches: UNKNOWN' in text:
            self.assertEqual(scan_lines, ['Scan: INCOMPLETE'])
        else:
            self.assertEqual(scan_lines, ['Scan: COMPLETE'])
        self.assertIn('Probe resolution: NOT_CHECKED', text)
        self.assertIn('DETAILS/PAGING DEFERRED', text)
        self.assertNotIn('PAGE ', text)
        self.assertNotIn('next saved page', text)
        self.assertEqual(len(machine.members[self.graph.bindings['members']['CapturedComponents']['name']]), 0)
        self.assertIsNone(machine.locals['CurrentComponent'])
        self.assertIsNone(machine.locals['CurrentClass'])
        self.assertEqual(machine.calls.count(('clear',)), 1)
        return text, machine

    def test_empty_array_is_complete_for_captured_scope(self):
        text, m = self.capture()
        self.assertEqual(text, 'B0, SEQUENTIAL CAPTURE, NOT LIVE\nSelf:\n/World/DiagnosticController_C_0\nReturned: 0 | Visited: 0\nChecked: 0 | Invalid: 0\nScan: COMPLETE\nProbe matches: 0 (captured entries)\nStock class: VALID\nProbe resolution: NOT_CHECKED\nDETAILS/PAGING DEFERRED')
        self.assertEqual(m.calls.count(('query',)), 1)
        self.assertEqual(m.calls.count(('array_length',)), 1)
        self.assertFalse(any(c[0] == 'array_get' for c in m.calls))

    def test_one_exact_match_and_case_sensitive_nonmatch(self):
        for path, expected in [(build.PROBE_CLASS, 1), (build.PROBE_CLASS.lower(), 0),
                               (build.PROBE_CLASS + '_Other', 0)]:
            text, m = self.capture([component(path)])
            self.assertIn('Probe matches: %s (captured entries)' % expected, text)
            self.assertIn('\nScan: COMPLETE\n', text)
            self.assertIn('Returned: 1 | Visited: 1\nChecked: 1 | Invalid: 0', text)
            self.assertEqual(m.calls.count(('get_class',)), 1)
            self.assertEqual(m.calls.count(('class_to_softclass',)), 1)
            self.assertEqual(m.calls.count(('softclass_to_string',)), 1)

    def test_late_probe_at_index31_after_31_nonmatches(self):
        text, m = self.capture([component()] * 31 + [component(build.PROBE_CLASS)])
        self.assertIn('Returned: 32 | Visited: 32\nChecked: 32 | Invalid: 0', text)
        self.assertIn('Probe matches: 1 (captured entries)', text)
        self.assertIn('\nScan: COMPLETE\n', text)
        self.assertEqual([c[1] for c in m.calls if c[0] == 'array_get'], list(range(32)))
        self.assertEqual(m.calls.count(('query',)), 1)
        self.assertEqual(m.calls.count(('array_length',)), 1)
        self.assertEqual(m.calls.count(('class_to_softclass',)), 32)
        self.assertEqual(m.calls.count(('softclass_to_string',)), 32)

    def test_33_and_huge_count_are_unknown_and_never_visit_index32(self):
        for count in (33, 2147483647):
            text, m = self.capture([component()] * 32 + [component(build.PROBE_CLASS)], count=count)
            self.assertIn('Returned: %s | Visited: 32' % count, text)
            self.assertIn('Probe matches: UNKNOWN (observed 0)', text)
            self.assertIn('\nScan: INCOMPLETE\n', text)
            self.assertEqual(sum(c[0] == 'array_get' for c in m.calls), 32)

    def test_positive_partial_count_is_observed_not_total(self):
        text, _ = self.capture([component(build.PROBE_CLASS)] + [component()] * 31, count=33)
        self.assertIn('Probe matches: UNKNOWN (observed 1)', text)
        self.assertIn('\nScan: INCOMPLETE\n', text)

    def test_duplicate_raw_entries_are_counted_without_instance_claim(self):
        same = component(build.PROBE_CLASS)
        text, m = self.capture([same, same])
        self.assertIn('Probe matches: 2 (captured entries)', text)
        self.assertNotIn('instances', text)
        self.assertEqual(m.calls.count(('get_class',)), 2)

    def test_invalid_component_and_class_skip_unsafe_reads_and_continue(self):
        text, m = self.capture([None, component(valid=False), component(class_valid=False),
                                MockObject(cls=None), component(build.PROBE_CLASS)])
        self.assertIn('Returned: 5 | Visited: 5\nChecked: 1 | Invalid: 4', text)
        self.assertIn('\nScan: INCOMPLETE\n', text)
        self.assertIn('Probe matches: UNKNOWN (observed 1)', text)
        self.assertEqual(m.calls.count(('get_class',)), 3)
        self.assertEqual(m.calls.count(('class_to_softclass',)), 1)
        self.assertEqual(m.calls.count(('softclass_to_string',)), 1)

    def test_invalid_class_identity_never_becomes_valid_nonmatch(self):
        for raw in ('', 'x' * 257, 'x' * 100000, 'bad\npath', 'bad\x00path', '\ud800', '\udc00'):
            text, m = self.capture([component(raw), component(build.PROBE_CLASS)])
            self.assertIn('Checked: 1 | Invalid: 1', text)
            self.assertIn('Probe matches: UNKNOWN (observed 1)', text)
            if len(raw) > 256:
                self.assertEqual(m.helper_runs[1][2].char_reads, [])

    def test_valid_unicode_class_paths_and_raw_self_are_lossless(self):
        raw = 'W' * 39 + '\U0001f680' + '\u754c' * 215
        text, m = self.capture([component('\U0001f680' * 128)], self_path=raw)
        self.assertIn('Checked: 1 | Invalid: 0', text)
        self_lines = text.split('Self:\n', 1)[1].split('\nReturned:', 1)[0].split('\n')
        self.assertEqual(''.join(self_lines), raw)
        self.assertTrue(all(len(scalar.code_units(line)) <= 40 for line in self_lines))
        self.assertTrue(all(not 0xD800 <= scalar.code_units(line)[-1] <= 0xDBFF for line in self_lines))
        self.assertEqual(m.calls.count(('path', 'self')), 1)
        self.assertEqual(len(text.split('\n')), 16)
        self.assertIn('\nScan: COMPLETE\n', text)

    def test_maximum_self_and_partial_count_keep_explicit_scan_within_limits(self):
        raw = 'W' * 39 + '\U0001f680' + '\u754c' * 215
        text, m = self.capture([component(build.PROBE_CLASS)] + [component()] * 31,
                               count=2147483647, self_path=raw)
        self.assertEqual(len(text.split('\n')), 16)
        self.assertIn('\nScan: INCOMPLETE\n', text)
        self.assertIn('Returned: 2147483647 | Visited: 32', text)
        self.assertIn('Probe matches: UNKNOWN (observed 1)', text)
        self.assertNotIn('FORMAT LIMIT', text)
        self.assertEqual(m.calls.count(('query',)), 1)

    def test_guard_refusals_do_not_query_and_preserve_class_check_status(self):
        cases = [({'widget_valid': False}, 'WIDGET INVALID', 'NOT_CHECKED'),
                 ({'paused': True}, 'PAUSED', 'NOT_CHECKED'),
                 ({'local': False}, 'NOT LOCAL CONTROLLER', 'NOT_CHECKED'),
                 ({'stock_valid': False}, 'STOCK CLASS INVALID', 'INVALID'),
                 ({'self_path': ''}, 'SELF IDENTITY INVALID', 'VALID'),
                 ({'self_path': 'x' * 257}, 'SELF IDENTITY INVALID', 'VALID'),
                 ({'self_path': 'bad\nself'}, 'SELF IDENTITY INVALID', 'VALID')]
        for flags, reason, status in cases:
            text, m = self.capture([component(build.PROBE_CLASS)], **flags)
            self.assertIn('NOT COLLECTED: ' + reason, text)
            self.assertIn('\nScan: NOT COLLECTED\n', text)
            self.assertIn('Stock class: ' + status, text)
            self.assertNotIn(('query',), m.calls)
            self.assertNotIn(('array_length',), m.calls)
            self.assertFalse(any(c[0] == 'array_get' for c in m.calls))

    def test_guard_values_read_once_and_in_order(self):
        _, m = self.capture([component()])
        prefix = [('object_valid', 'widget'), ('pause',), ('local',), ('class_valid', 'stock'), ('path', 'self'), ('query',), ('array_length',)]
        self.assertEqual(m.calls[:len(prefix)], prefix)
        self.assertEqual(m.calls.count(('pause',)), 1)
        self.assertEqual(m.calls.count(('local',)), 1)
        self.assertEqual(m.calls.count(('class_valid', 'stock')), 1)

    def test_helper_output_bounds_are_rechecked_before_query(self):
        for output in ({'Valid': True, 'Segmented': 'x' * 264, 'Lines': 7},
                       {'Valid': True, 'Segmented': 'ok', 'Lines': 8}):
            text, m = self.capture(helper_override=lambda function, result: output if function == 'SegmentValidatedPath' else result)
            self.assertIn('NOT COLLECTED: SELF SEGMENT LIMIT', text)
            self.assertNotIn(('query',), m.calls)

    def test_final_actual_line_guard_fails_closed_after_capture(self):
        # Fault injection checks the independent final guard, without changing native helpers.
        corrupt = {'Valid': True, 'Segmented': '\n' * 20, 'Lines': 1}
        text, m = self.capture([component(build.PROBE_CLASS)], helper_override=lambda function, result: corrupt if function == 'SegmentValidatedPath' else result)
        self.assertIn('INCOMPLETE: FORMAT LIMIT', text)
        self.assertIn('\nScan: INCOMPLETE\n', text)
        self.assertIn('Probe matches: UNKNOWN', text)
        self.assertNotIn('NOT COLLECTED', text)
        self.assertIn('Returned: 1 | Visited: 1\nChecked: 1 | Invalid: 0', text)
        self.assertIn('UNKNOWN (observed 1)', text)
        self.assertEqual(m.calls.count(('query',)), 1)

    def test_preconcat_and_actual_size_failure_release_all_references(self):
        for label in ('PreConcatWithin768', 'ActualWithin768'):
            graph = scalar.clone_graph(self.graph)
            graph.nodes[label]['pins']['B']['DefaultValue'] = '"0"'
            text, m = self.capture([component(build.PROBE_CLASS)], graph=graph)
            self.assertIn('INCOMPLETE: FORMAT LIMIT', text)
            self.assertIn('Probe matches: UNKNOWN', text)
            self.assertIn('Returned: 1 | Visited: 1\nChecked: 1 | Invalid: 0', text)
            self.assertIn('UNKNOWN (observed 1)', text)
            self.assertEqual(m.calls.count(('query',)), 1)

    def test_counter_text_failure_is_postcapture_incomplete(self):
        text, m = self.capture([component(build.PROBE_CLASS)], oversize_counter_text=True)
        self.assertIn('INCOMPLETE: COUNTER FORMAT', text)
        self.assertIn('\nScan: INCOMPLETE\n', text)
        self.assertIn('Probe matches: UNKNOWN', text)
        self.assertNotIn('NOT COLLECTED', text)
        self.assertEqual(m.calls.count(('query',)), 1)
        self.assertNotIn('9' * 12, text)

    def test_typed_local_unused_set_output_cannot_drift(self):
        for property_name, value in [('PinType.PinCategory', '"string"'),
                                     ('PinType.PinSubCategoryObject', 'None')]:
            graph = scalar.clone_graph(self.graph)
            graph.nodes['ReleaseCurrentClass']['pins']['Output_Get'][property_name] = value
            with self.assertRaises(ValueError):
                graph.validate()

    def test_former_class_to_object_edge_rejected_at_connect_and_validation(self):
        # Native Capture failed on this category crossing. A source graph which
        # merely stores that connection must not pass offline admission again.
        edge = ('GetCurrentClass', 'CurrentClass', 'SelfPath', 'Object')
        graph = scalar.clone_graph(self.graph)
        graph.edges = [e for e in graph.edges if e[2:] != ('SelfPath', 'Object')]
        with self.assertRaisesRegex(ValueError, 'UNPROVEN_TYPED_LINK'):
            graph.connect(*edge)
        self.assertNotIn(edge, graph.edges)
        graph.edges.append(edge)
        with self.assertRaisesRegex(ValueError, 'UNPROVEN_TYPED_LINK'):
            graph.validate()

    def test_mock_cannot_hide_class_to_object_type_error(self):
        # Deliberately skip graph admission to prove the engine adapter itself
        # no longer treats a Class reference as an Object pin value.
        graph = scalar.clone_graph(self.graph)
        graph.edges = [e for e in graph.edges if e[2:] != ('SelfPath', 'Object')]
        graph.edges.append(('GetCurrentClass', 'CurrentClass', 'SelfPath', 'Object'))
        machine = CaptureMachine(graph, self.helpers)
        machine.locals['CurrentClass'] = MockClass(build.PROBE_CLASS)
        with self.assertRaisesRegex(AssertionError, 'Class reference is not a GetPathName Object'):
            machine.value('SelfPath', 'ReturnValue')
        self.assertNotIn(('path', 'self'), machine.calls)

    def test_native_class_conversion_chain_has_no_hard_class_bypass(self):
        required = [
            ('GetCurrentClass', 'CurrentClass', 'HardClassToSoftClass', 'Input'),
            ('HardClassToSoftClass', 'Output', 'ReadClassPath', 'SoftClassReference'),
            ('ReadClassPath', 'ReturnValue', 'StoreClassPath', 'ClassPath'),
        ]
        for edge in required:
            self.assertIn(edge, self.graph.edges)
        self.assertEqual(self.graph.nodes['HardClassToSoftClass']['class'], '/Script/BlueprintGraph.K2Node_ConvertAsset')
        functions = {name: next((f for f in row['fields'] if f.startswith('FunctionReference=')), '')
                     for name, row in self.graph.nodes.items()}
        self.assertIn('MemberName="Conv_SoftClassReferenceToString"', functions['ReadClassPath'])
        self.assertEqual([name for name, ref in functions.items() if 'MemberName="GetPathName"' in ref], ['SelfPath'])
        graph = scalar.clone_graph(self.graph)
        graph.edges.remove(required[1])
        with self.assertRaisesRegex(ValueError, 'UNPROVEN_TYPED_LINK'):
            graph.connect('GetCurrentClass', 'CurrentClass', 'ReadClassPath', 'SoftClassReference')
        graph.edges.append(('GetCurrentClass', 'CurrentClass', 'ReadClassPath', 'SoftClassReference'))
        machine = CaptureMachine(graph, self.helpers)
        machine.locals['CurrentClass'] = MockClass(build.PROBE_CLASS)
        with self.assertRaisesRegex(AssertionError, 'requires a soft-class reference'):
            machine.value('ReadClassPath', 'ReturnValue')

    def test_conversion_schema_and_required_links_reject_drift(self):
        for label, port, key, value in [
            ('HardClassToSoftClass', 'Input', 'PinType.PinCategory', '"object"'),
            ('HardClassToSoftClass', 'Output', 'PinType.PinCategory', '"class"'),
            ('ReadClassPath', 'SoftClassReference', 'PinType.bIsConst', 'False'),
            ('ReadClassPath', 'SoftClassReference', 'PinType.bIsReference', 'False'),
        ]:
            graph = scalar.clone_graph(self.graph)
            graph.nodes[label]['pins'][port][key] = value
            with self.assertRaisesRegex(ValueError, 'SOURCE_PIN_SCHEMA_DRIFT'):
                graph.validate()
        for edge in [
            ('GetCurrentClass', 'CurrentClass', 'HardClassToSoftClass', 'Input'),
            ('HardClassToSoftClass', 'Output', 'ReadClassPath', 'SoftClassReference'),
        ]:
            graph = scalar.clone_graph(self.graph)
            graph.edges.remove(edge)
            with self.assertRaises(ValueError):
                graph.validate()

    def test_unbound_and_mock_graphs_cannot_emit_native_payload(self):
        for graph in (self.graph, build.build_capture()):
            with self.assertRaisesRegex(ValueError, 'DESTINATION_NATIVE_BINDINGS_REQUIRED'):
                graph.emit()

    def test_native_classification_rejects_scratch_bindings(self):
        bindings = build.mock_bindings()
        bindings['classification'] = 'OBSERVED_NATIVE_BINDINGS'
        with self.assertRaisesRegex(ValueError, 'DESTINATION_REGISTERED_BINDING_REQUIRED'):
            build.build_capture(bindings)

    def test_wrong_member_or_helper_guid_rejected(self):
        bindings = build.mock_bindings()
        bindings['members']['CapturedComponents']['guid'] = '0' * 32
        with self.assertRaisesRegex(ValueError, 'ACTUAL_MEMBER_BINDING_MISMATCH'):
            build.build_capture(bindings)
        bindings = build.mock_bindings()
        bindings['helpers']['SegmentValidatedPath'] = '0' * 32
        with self.assertRaisesRegex(ValueError, 'ACTUAL_HELPER_BINDING_MISMATCH'):
            build.build_capture(bindings)

    def test_query_class_return_type_and_extra_consumer_fail_closed(self):
        graph = scalar.clone_graph(self.graph)
        graph.nodes['SoleComponentQuery']['pins']['ComponentClass']['DefaultObject'] = '"/Game/Wrong.Wrong_C"'
        with self.assertRaisesRegex(ValueError, 'EXACT_FIXED_STOCK_CLASS_REQUIRED'):
            graph.validate()
        graph = scalar.clone_graph(self.graph)
        graph.nodes['ReadStockClassValid']['pins']['Class']['DefaultObject'] = '"/Game/Wrong.Wrong_C"'
        with self.assertRaisesRegex(ValueError, 'STOCK_CLASS'):
            graph.validate()
        graph = scalar.clone_graph(self.graph)
        graph.nodes['SoleComponentQuery']['pins']['ReturnValue']['PinType.PinSubCategoryObject'] = build.OBJECT
        with self.assertRaisesRegex(ValueError, 'SOURCE_PIN_SCHEMA_DRIFT: SoleComponentQuery'):
            graph.validate()
        graph = scalar.clone_graph(self.graph)
        graph.edges.append(('SoleComponentQuery', 'ReturnValue', 'CapturedLength', 'TargetArray'))
        with self.assertRaisesRegex(ValueError, 'DATA_INPUT_MULTIPLE_PRODUCERS|QUERY_SINGLE_STORED_CONSUMER'):
            graph.validate()

    def test_fixed_loop_and_read_storage_gates_reject_mutations(self):
        graph = scalar.clone_graph(self.graph)
        graph.nodes['ComponentLoop']['pins']['LastIndex']['DefaultValue'] = '"32"'
        with self.assertRaisesRegex(ValueError, 'FIXED_COMPONENT_LOOP_REQUIRED'):
            graph.validate()
        graph = scalar.clone_graph(self.graph)
        graph.edges.remove(('ReadClassPath', 'ReturnValue', 'StoreClassPath', 'ClassPath'))
        with self.assertRaisesRegex(ValueError, 'ONCE_READ_VALUE_NOT_STORED'):
            graph.validate()

    def test_sources_parse_as_python37_and_graph_scope_excludes_world_mutation(self):
        for p in (Path(build.__file__), Path(__file__)):
            ast.parse(p.read_text(encoding='utf-8-sig'), feature_version=(3, 7))
        forbidden = ('LoadAsset', 'SpawnActor', 'Activate', 'SetSnapshot', 'PrintString', 'CreateWidget', 'SaveAsset')
        for node in self.graph.nodes.values():
            for field in node['fields']:
                if field.startswith('FunctionReference='):
                    self.assertFalse(any('MemberName="' + name + '"' in field for name in forbidden))


if __name__ == '__main__':
    print('MOCK_ONLY B0 assembled capture graph tests. Native execution, F8 wiring, publication and EndPlay are NOT_PERFORMED.', flush=True)
    unittest.main(verbosity=2)
