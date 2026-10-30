"""MOCK_ONLY partial Capture control graph. Pending helpers are test doubles.

These tests do not validate page formatting/native type conversion or pretend
that the missing slots are executable Blueprint nodes. They exercise the real
assembled counters, branches and loop around explicitly mocked missing slots.
"""
import ast
import copy
import importlib.util
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]


def module(name, relative):
    p = ROOT / relative
    s = importlib.util.spec_from_file_location(name, p)
    m = importlib.util.module_from_spec(s)
    s.loader.exec_module(m)
    return m


build = module('capture_builder', 'scripts/Prepare-PhaseBCaptureGraph.py')
tests = module('capture_machine', 'scripts/Test-PhaseBTextFunctions.py')


class PendingCaptureMachine(tests.GraphMachine):
    def __init__(self, draft, components, retain_limit=2, preflight=True, entry_allowed=True):
        self.draft = draft
        graph = copy.copy(draft)
        graph.nodes = copy.deepcopy(draft.nodes)
        graph.edges = list(draft.edges) + list(draft.pending_edges)
        # The following exist only in this mock interpreter. They are NEVER
        # Unreal node templates and cannot be sent to an emitter.
        for name, slot in draft.pending.items():
            pins = {}
            for direction in ('inputs', 'outputs'):
                for pin, kind in slot[direction].items():
                    pins[pin] = {'PinType.PinCategory': json.dumps(kind)}
                    if direction == 'outputs':
                        pins[pin]['Direction'] = '"EGPD_Output"'
            graph.nodes[name] = {'class': 'MOCK_ONLY_PENDING_SLOT', 'pins': pins, 'fields': []}
        for pending in draft.compatibility_evidence_required:
            # Mock assumption only; actual class->object linkage is unresolved.
            graph.edges.append(tuple(pending['edge']))
        super().__init__(graph, {})
        self.components, self.retain_limit = components, retain_limit
        self.preflight, self.entry_allowed = preflight, entry_allowed
        self.stored, self.current, self.current_class = None, None, None
        self.slot_values, self.retained_indices = {}, []
        self.query_calls = self.class_reads = self.object_reads = 0
        self.last_index = None
        self.finalized = None

    def value(self, name, pin):
        if name == 'SoleComponentQuery':
            self.query_calls += 1
            return self.components
        if name == 'OwnedController':
            return 'MOCK_ONLY_OWNED_CONTROLLER'
        if name == 'StoredComponentsLength':
            return len(self.stored)
        if name == 'CurrentComponent':
            return self.current
        if name == 'ReadCurrentClass':
            self.class_reads += 1
            return {'valid': self.current.get('class_valid', True), 'path': self.current['class_path']}
        if name == 'CurrentClass':
            return self.current_class
        if name == 'CurrentClassValid':
            return self.current_class['valid']
        if name == 'ReadClassPath':
            return self.current_class['path']
        if name == 'ReadObjectPath':
            self.object_reads += 1
            return self.current.get('object_path', '/World/Component')
        if name == 'StoredRowBodies':
            return ['MOCK_ONLY_BODY'] * len(self.retained_indices)
        if name in self.draft.pending:
            return self.slot_values[name, pin]
        # Equality is the one additional string primitive used by this draft.
        if name == 'ExactProbeLiteral':
            return self.input(name, 'A') == self.input(name, 'B')
        return super().value(name, pin)

    def execute(self, name, pin):
        if name == 'ComponentValid':
            valid = isinstance(self.current, dict) and self.current.get('valid', True)
            return self.follow(name, 'Is Valid' if valid else 'Is Not Valid')
        if name not in self.draft.pending:
            return super().execute(name, pin)
        if name == 'EntryGuard':
            self.slot_values[name, 'Allowed'] = self.entry_allowed
        elif name == 'PrepareContext':
            self.slot_values[name, 'Ready'] = self.preflight
            for port in ['ObjectBody', 'ClassBody', 'LevelBody']:
                self.slot_values[name, port] = 'MOCK_ONLY_CONTEXT'
        elif name == 'PrequeryRefusal':
            self.finalized = {'Status': 'NOT_COLLECTED'}
        elif name == 'StoreSnapshotComponents':
            self.stored = self.input(name, 'Value')
        elif name == 'StoreCurrentComponent':
            self.last_index = self.input(name, 'Index')
            self.current = self.stored[self.last_index]
        elif name == 'StoreCurrentClass':
            self.current_class = self.input(name, 'Value')
        elif name == 'ValidateClassPath':
            raw = self.input(name, 'Raw')
            # Deliberately narrow pending-helper double, not acceptance of the
            # actual future native caller. Text helper has its separate suite.
            self.slot_values[name, 'Valid'] = 0 < len(tests.code_units(raw)) <= 256 and '\n' not in raw
        elif name == 'BuildDetailBodies':
            raw = self.input(name, 'ObjectPath')
            self.slot_values[name, 'Valid'] = 0 < len(tests.code_units(raw)) <= 256
            self.slot_values[name, 'Reason'] = 'OBJECT_PATH_LIMIT'
            self.slot_values[name, 'ObjectBody'] = 'MOCK_ONLY_OBJECT_BODY'
            self.slot_values[name, 'ClassBody'] = 'MOCK_ONLY_CLASS_BODY'
        elif name in ('RetainPair', 'RetainInvalidEntry', 'RetainInvalidClass'):
            accepted = len(self.retained_indices) < self.retain_limit
            self.slot_values[name, 'Accepted'] = accepted
            self.slot_values[name, 'NewReserved'] = self.input(name, 'Reserved') + (200 if name == 'RetainPair' else 100)
            if accepted:
                self.retained_indices.append(self.last_index)
        elif name == 'FinalizeSnapshot':
            self.finalized = {p: self.input(name, p) for p in self.draft.pending[name]['inputs'] if p != 'execute'}
            self.stored = self.current = self.current_class = None
        else:
            raise AssertionError('Unmodeled pending execution slot: ' + name)
        return self.follow(name, 'then')


def ordinary(**changes):
    result = {'class_path': '/Game/Components/Other.Other_C', 'object_path': '/World/PC.Component', 'valid': True, 'class_valid': True}
    result.update(changes)
    return result


class CaptureGraph(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.graph = build.capture_graph()

    def run_capture(self, components, **options):
        machine = PendingCaptureMachine(self.graph, components, **options)
        machine.run()
        return machine

    def test_emission_always_blocked_even_if_gap_lists_are_removed(self):
        with self.assertRaisesRegex(ValueError, 'NO_PAYLOAD'):
            self.graph.emit()
        changed = copy.copy(self.graph)
        changed.pending, changed.pending_edges, changed.compatibility_evidence_required = {}, [], []
        with self.assertRaisesRegex(ValueError, 'NO_PAYLOAD'):
            changed.emit()

    def test_single_query_result_has_only_stored_consumer(self):
        record = self.graph.assembly_record()
        self.assertEqual(record['invariants']['query_result_consumers'], 1)
        changed = copy.copy(self.graph)
        changed.pending_edges = list(self.graph.pending_edges) + [('SoleComponentQuery', 'ReturnValue', 'AnotherConsumer', 'Value')]
        with self.assertRaisesRegex(ValueError, 'SINGLE_STORED_CONSUMER'):
            changed.assembly_record()

    def test_query_wrong_selected_class_and_connected_override_are_rejected(self):
        changed = copy.copy(self.graph)
        changed.nodes = copy.deepcopy(self.graph.nodes)
        changed.nodes['SoleComponentQuery']['pins']['ComponentClass']['DefaultObject'] = '"/Game/Wrong/Wrong.Wrong_C"'
        with self.assertRaisesRegex(ValueError, 'QUERY_EXACT_STOCK_COMPONENT_CLASS_REQUIRED'):
            changed.assembly_record()
        changed = copy.copy(self.graph)
        changed.pending_edges = list(self.graph.pending_edges) + [('CurrentClass', 'Value', 'SoleComponentQuery', 'ComponentClass')]
        with self.assertRaisesRegex(ValueError, 'QUERY_EXACT_STOCK_COMPONENT_CLASS_REQUIRED'):
            changed.assembly_record()

    def test_query_return_must_keep_exact_stock_object_array_type(self):
        mutations = {'Direction': '"EGPD_Input"', 'PinType.PinCategory': '"class"',
                     'PinType.PinSubCategoryObject': 'Class\'"/Script/Engine.ActorComponent"\'',
                     'PinType.ContainerType': 'None', 'PinType.bIsReference': 'True',
                     'PinType.bIsWeakPointer': 'True', 'bOrphanedPin': 'True'}
        for key, value in mutations.items():
            with self.subTest(field=key):
                changed = copy.copy(self.graph)
                changed.nodes = copy.deepcopy(self.graph.nodes)
                changed.nodes['SoleComponentQuery']['pins']['ReturnValue'][key] = value
                with self.assertRaisesRegex(ValueError, 'QUERY_EXACT_STOCK_COMPONENT_ARRAY_RETURN_REQUIRED'):
                    changed.assembly_record()
        changed = copy.copy(self.graph)
        changed.nodes = copy.deepcopy(self.graph.nodes)
        del changed.nodes['SoleComponentQuery']['pins']['ReturnValue']['PinType.ContainerType']
        with self.assertRaisesRegex(ValueError, 'QUERY_EXACT_STOCK_COMPONENT_ARRAY_RETURN_REQUIRED'):
            changed.assembly_record()

    def test_closed_storage_route_and_single_identity_reads_are_enforced(self):
        changed = copy.copy(self.graph)
        changed.pending_edges = list(self.graph.pending_edges) + [('DetailClosedBranch', 'then', 'BuildDetailBodies', 'execute')]
        with self.assertRaisesRegex(ValueError, 'CLOSED_DETAILS_MUST_NOT_READ_OBJECT_PATH_OR_FORMAT'):
            changed.assembly_record()
        changed = copy.copy(self.graph)
        changed.pending_edges = list(self.graph.pending_edges) + [('ReadObjectPath', 'ReturnValue', 'AnotherConsumer', 'Raw')]
        with self.assertRaisesRegex(ValueError, 'IDENTITY_GETTER_REQUIRES_SINGLE_STORED_CONSUMER'):
            changed.assembly_record()

    def test_full_array_late_probe_still_found_after_storage_closes(self):
        components = [ordinary() for unused in range(32)]
        components[31]['class_path'] = build.PROBE_CLASS
        m = self.run_capture(components)
        self.assertEqual(m.query_calls, 1)
        self.assertEqual(m.class_reads, 32)
        self.assertEqual(m.object_reads, 3)  # Two accepted plus one admission refusal.
        self.assertEqual(m.finalized['Visited'], 32)
        self.assertEqual(m.finalized['Checked'], 32)
        self.assertEqual(m.finalized['Matches'], 1)
        self.assertTrue(m.finalized['ClassComplete'])
        self.assertFalse(m.finalized['DetailComplete'])
        self.assertEqual(m.finalized['Status'], 'INCOMPLETE')
        self.assertEqual(m.finalized['DetailReason'], 'TEXT_LIMIT')

    def test_probe_outside_first32_never_claims_complete_total(self):
        components = [ordinary() for unused in range(33)]
        components[32]['class_path'] = build.PROBE_CLASS
        m = self.run_capture(components)
        self.assertEqual(m.finalized['Returned'], 33)
        self.assertEqual(m.finalized['Visited'], 32)
        self.assertEqual(m.finalized['Matches'], 0)
        self.assertFalse(m.finalized['ClassComplete'])
        self.assertTrue(m.finalized['CountLimited'])

    def test_invalid_component_and_class_are_still_counted_after_closure(self):
        components = [ordinary() for unused in range(6)]
        components[4] = None
        components[5]['class_valid'] = False
        m = self.run_capture(components, retain_limit=0)
        self.assertEqual(m.object_reads, 1)
        self.assertEqual(m.class_reads, 5)
        self.assertEqual(m.finalized['Visited'], 6)
        self.assertEqual(m.finalized['Checked'], 4)
        self.assertEqual(m.finalized['Invalid'], 2)
        self.assertFalse(m.finalized['ClassComplete'])

    def test_invalid_class_path_does_not_count_as_checked_or_read_object(self):
        m = self.run_capture([ordinary(class_path='C' * 257), ordinary(class_path=build.PROBE_CLASS)], retain_limit=8)
        self.assertEqual(m.class_reads, 2)
        self.assertEqual(m.object_reads, 1)
        self.assertEqual(m.finalized['Checked'], 1)
        self.assertEqual(m.finalized['Matches'], 1)
        self.assertEqual(m.finalized['Invalid'], 1)
        self.assertEqual(m.finalized['Retained'], 2)  # Invalid singleton and valid pair.
        self.assertFalse(m.finalized['ClassComplete'])

    def test_object_path_failure_closes_details_but_continues_class_scan(self):
        m = self.run_capture([ordinary(object_path='X' * 257), ordinary(class_path=build.PROBE_CLASS)], retain_limit=8)
        self.assertEqual(m.object_reads, 1)
        self.assertEqual(m.class_reads, 2)
        self.assertEqual(m.finalized['Checked'], 2)
        self.assertEqual(m.finalized['Matches'], 1)
        self.assertTrue(m.finalized['ClassComplete'])
        self.assertFalse(m.finalized['DetailComplete'])
        self.assertEqual(m.finalized['DetailReason'], 'OBJECT_PATH_LIMIT')

    def test_zero_array_and_small_complete_array(self):
        for components in [[], [ordinary(), ordinary(class_path=build.PROBE_CLASS)]]:
            m = self.run_capture(components, retain_limit=8)
            self.assertEqual(m.query_calls, 1)
            self.assertTrue(m.finalized['ClassComplete'])
            self.assertTrue(m.finalized['DetailComplete'])
            self.assertEqual(m.finalized['Status'], 'COMPLETE')

    def test_prequery_guard_and_context_failure_do_not_query(self):
        m = self.run_capture([ordinary()], preflight=False)
        self.assertEqual(m.query_calls, 0)
        self.assertEqual(m.finalized['Status'], 'NOT_COLLECTED')
        m = self.run_capture([ordinary()], entry_allowed=False)
        self.assertEqual(m.query_calls, 0)
        self.assertIsNone(m.finalized)

    def test_success_finalizer_mock_clears_captured_refs(self):
        m = self.run_capture([ordinary()])
        self.assertIsNone(m.stored)
        self.assertIsNone(m.current)
        self.assertIsNone(m.current_class)

    def test_unresolved_records_never_invent_native_fields_or_guids(self):
        record = self.graph.assembly_record()
        for slot in record['pending_native_bindings_and_helpers']:
            self.assertIsNone(slot['native_node_fields'])
            self.assertIsNone(slot['native_function_guid'])
        self.assertEqual(len(record['unaccepted_type_compatibility_edges']), 1)
        self.assertLessEqual(record['known_node_counts']['node_count'], 192)

    def test_python37_grammar(self):
        for path in [Path(build.__file__), Path(__file__)]:
            ast.parse(path.read_text(encoding='utf-8-sig'), filename=str(path), feature_version=(3, 7))


if __name__ == '__main__':
    print('MOCK_ONLY partial Capture graph;17 pending native slots are explicit test doubles, no native payload exists.', flush=True)
    unittest.main(verbosity=2)
