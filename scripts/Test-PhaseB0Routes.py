"""MOCK_ONLY finite event-routing tests over the assembled merged edge graph.

Unresolved native bindings are explicit project interfaces. These tests do not
create native flag/caller schemas, execute Unreal, or establish displayed UI.
"""
import copy
import importlib.util
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]


def load(name, filename):
    spec = importlib.util.spec_from_file_location(name, ROOT / 'scripts' / filename)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


build = load('b0_routes_builder_test', 'Prepare-PhaseB0Routes.py')


def clone(graph):
    result = copy.copy(graph)
    for name in ('nodes', 'edges', 'originals', 'operations', 'pending', 'pin_schemas', 'field_contracts'):
        setattr(result, name, copy.deepcopy(getattr(graph, name)))
    return result


class RouteMachine:
    def __init__(self, graph, creation_valid=True, capture=None):
        self.g = graph
        self.creation_valid = creation_valid
        self.capture_callback = capture
        self.members = {'B0ControlAttempted': False, 'B0SnapshotAttempted': False,
                        'ControlReadout': None, 'B0CapturedComponents': []}
        self.output, self.events = {}, []
        self.once = False
        self.owner = object()
        self.incoming = {(b, bp): (a, ap) for a, ap, b, bp in graph.edges
                         if graph.nodes[a]['pins'][ap]['PinType.PinCategory'] != '"exec"'}
        self.outgoing = {(a, ap): (b, bp) for a, ap, b, bp in graph.edges
                         if graph.nodes[a]['pins'][ap]['PinType.PinCategory'] == '"exec"'}

    def value(self, name, pin):
        node = self.g.nodes[name]
        if (name, pin) in self.incoming:
            return self.value(*self.incoming[name, pin])
        op = self.g.operations.get(name) or {}
        if op.get('operation') == 'member_get':
            return self.members[op['member']]
        if name == 'Readout':
            return self.members['ControlReadout']
        if name == 'Self':
            return self.owner
        if name in ('Create', 'Capture') or (name == 'StoreReadout' and pin == 'Output_Get'):
            return self.output[name]
        if op.get('operation') == 'string_to_text':
            self.events.append('convert_saved_string')
            return self.value(name, 'InString')
        prop = node['pins'][pin]
        if prop['PinType.PinCategory'] == '"bool"':
            return json.loads(prop.get('DefaultValue', '"false"')).lower() == 'true'
        if prop['PinType.PinCategory'] == '"object"':
            return None
        raise AssertionError(('Unmodeled route value', name, pin))

    def follow(self, name, pin):
        target = self.outgoing.get((name, pin))
        if target:
            self.execute(*target)

    def execute(self, name, input_pin):
        if len(self.events) > 1000:
            raise AssertionError('Route execution bound')
        self.events.append(name)
        op = self.g.operations.get(name) or {}
        action = op.get('operation')
        if action == 'member_set':
            self.members[op['member']] = self.value(name, op['member'])
            return self.follow(name, 'then')
        if action == 'branch':
            return self.follow(name, 'then' if self.value(name, 'Condition') else 'else')
        if action == 'capture_call':
            if not self.members['B0SnapshotAttempted']:
                raise AssertionError('Capture before attempt consumption')
            self.output[name] = self.capture_callback(self) if self.capture_callback else 'MOCK_CAPTURE_SNAPSHOT'
            return self.follow(name, 'then')
        if action == 'is_valid' or name in ('CreatedValid', 'EndReadoutValid'):
            obj = self.value(name, 'InputObject')
            return self.follow(name, 'Is Valid' if obj is not None and obj['valid'] else 'Is Not Valid')
        if action == 'publish_snapshot':
            target = self.value(name, 'self')
            if target is None or not target['valid']:
                raise AssertionError('Published to invalid widget')
            target['snapshot'] = self.value(name, 'InText')
            return self.follow(name, 'then')
        if action == 'array_clear':
            self.value(name, 'TargetArray').clear()
            return self.follow(name, 'then')
        if name == 'DoOnce':
            if input_pin == 'Reset':
                raise AssertionError('Retry reset was executed')
            if not self.once:
                self.once = True
                return self.follow(name, 'Completed')
            return
        if name == 'Create':
            if not self.members['B0ControlAttempted']:
                raise AssertionError('Widget creation before control attempt consumed')
            self.output[name] = {'valid': True, 'marker': False, 'snapshot': None} if self.creation_valid else None
            return self.follow(name, 'then')
        if name == 'StoreReadout':
            self.members['ControlReadout'] = self.value(name, 'ControlReadout')
            self.output[name] = self.members['ControlReadout']
            return self.follow(name, 'then')
        if name == 'ShowMarker':
            target = self.value(name, 'self')
            if target is None or not target['valid']:
                raise AssertionError('Marker shown to invalid widget')
            target['marker'] = True
            return self.follow(name, 'then')
        if name == 'RemoveReadout':
            target = self.value(name, 'self')
            target['valid'] = False
            return self.follow(name, 'then')
        if name == 'ClearReadout':
            self.members['ControlReadout'] = self.value(name, 'ControlReadout')
            return self.follow(name, 'then')
        if name == 'ParentEndPlay':
            return self.follow(name, 'then')
        raise AssertionError(('Unmodeled route execution', name, input_pin))

    def press(self):
        self.follow('Input', 'Pressed')

    def release(self):
        self.follow('Input', 'Released')

    def end_play(self):
        self.follow('EndPlay', 'then')


class RouteTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.graph = build.build_routes()

    def test_first_press_consumes_control_before_independent_marker(self):
        m = RouteMachine(self.graph)
        m.press()
        self.assertTrue(m.members['B0ControlAttempted'])
        self.assertFalse(m.members['B0SnapshotAttempted'])
        self.assertTrue(m.members['ControlReadout']['marker'])
        self.assertNotIn('Capture', m.events)
        self.assertNotIn('SetSnapshot', m.events)
        self.assertLess(m.events.index('ConsumeControl'), m.events.index('Create'))

    def test_second_press_consumes_once_then_publishes_stored_return(self):
        m = RouteMachine(self.graph)
        m.press(); m.press()
        self.assertTrue(m.members['B0SnapshotAttempted'])
        self.assertEqual(m.events.count('Create'), 1)
        self.assertEqual(m.events.count('Capture'), 1)
        self.assertEqual(m.events.count('SetSnapshot'), 1)
        self.assertEqual(m.members['ControlReadout']['snapshot'], 'MOCK_CAPTURE_SNAPSHOT')
        self.assertLess(m.events.index('ConsumeSnapshot'), m.events.index('Capture'))
        self.assertLess(m.events.index('Capture'), m.events.index('PublishValid'))

    def test_all_later_presses_only_check_flags_no_retry_or_page_change(self):
        m = RouteMachine(self.graph)
        m.press(); m.press()
        before = len(m.events)
        for _ in range(10): m.press()
        self.assertEqual(m.events[before:], ['ControlGuard', 'SnapshotGuard'] * 10)
        self.assertEqual(m.events.count('Capture'), 1)
        self.assertEqual(m.events.count('Create'), 1)
        self.assertEqual(m.events.count('SetSnapshot'), 1)

    def test_input_release_is_noop(self):
        m = RouteMachine(self.graph)
        m.release()
        self.assertEqual(m.events, [])

    def test_failed_creation_is_not_retried_and_second_attempt_is_consumed(self):
        m = RouteMachine(self.graph, creation_valid=False)
        m.press(); m.press(); m.press()
        self.assertTrue(m.members['B0ControlAttempted'] and m.members['B0SnapshotAttempted'])
        self.assertIsNone(m.members['ControlReadout'])
        self.assertEqual(m.events.count('Create'), 1)
        self.assertEqual(m.events.count('Capture'), 1)
        self.assertNotIn('ShowMarker', m.events)
        self.assertNotIn('SetSnapshot', m.events)

    def test_widget_lost_during_capture_prevents_publication_and_retry(self):
        def capture(m):
            m.members['ControlReadout']['valid'] = False
            return 'CAPTURED_BUT_WIDGET_LOST'
        m = RouteMachine(self.graph, capture=capture)
        m.press(); m.press(); m.press()
        self.assertEqual(m.events.count('Capture'), 1)
        self.assertNotIn('SetSnapshot', m.events)
        self.assertTrue(m.members['B0SnapshotAttempted'])

    def test_endplay_valid_widget_seals_flags_clears_owned_refs_and_parent_once(self):
        m = RouteMachine(self.graph)
        m.press()
        widget = m.members['ControlReadout']
        m.members['B0CapturedComponents'] = [object(), object()]
        start = len(m.events); m.end_play()
        self.assertEqual(m.events[start:], ['SealControl', 'SealSnapshot', 'EndReadoutValid', 'RemoveReadout', 'ClearReadout', 'ClearCapturedArray', 'ParentEndPlay'])
        self.assertFalse(widget['valid'])
        self.assertIsNone(m.members['ControlReadout'])
        self.assertEqual(m.members['B0CapturedComponents'], [])
        self.assertEqual(m.events.count('ParentEndPlay'), 1)
        after = len(m.events); m.press()
        self.assertEqual(m.events[after:], ['ControlGuard', 'SnapshotGuard'])

    def test_endplay_before_first_press_never_creates_or_queries(self):
        m = RouteMachine(self.graph)
        m.end_play(); m.press()
        self.assertEqual(m.events.count('ParentEndPlay'), 1)
        self.assertNotIn('Create', m.events)
        self.assertNotIn('Capture', m.events)
        self.assertNotIn('RemoveReadout', m.events)
        self.assertIsNone(m.members['ControlReadout'])

    def test_endplay_invalid_widget_still_clears_array_and_calls_parent(self):
        m = RouteMachine(self.graph)
        m.press(); m.members['ControlReadout']['valid'] = False
        m.members['B0CapturedComponents'] = [object()]
        m.end_play()
        self.assertEqual(m.members['B0CapturedComponents'], [])
        self.assertIsNone(m.members['ControlReadout'])
        self.assertEqual(m.events.count('ParentEndPlay'), 1)
        self.assertNotIn('RemoveReadout', m.events)

    def test_unresolved_bindings_never_emit_native_fragment(self):
        self.assertEqual(len(self.graph.pending), 9)
        with self.assertRaisesRegex(ValueError, 'ACTUAL_NATIVE_ROUTE_BINDINGS_REQUIRED'):
            self.graph.emit_fragment()

    def test_actual_capture_graph_integration_queries_once_or_refuses_before_query(self):
        capture = load('route_capture_integration', 'Test-PhaseB0Capture.py')
        graph = capture.build.build_capture(capture.build.mock_bindings())
        templates = capture.scalar.build.core.Templates()
        helpers = {'ValidateBoundedIdentity': capture.scalar.build.validate_function(templates),
                   'SegmentValidatedPath': capture.scalar.build.segment_function(templates)}
        for paused, creation_valid in ((False, True), (True, True), (False, False)):
            calls = []
            def run_capture(route):
                self.assertTrue(route.members['B0SnapshotAttempted'])
                machine = capture.CaptureMachine(graph, helpers, [capture.component(capture.build.PROBE_CLASS)],
                                                 paused=paused, widget_valid=creation_valid)
                result = machine.run()['Snapshot']
                calls.append(machine)
                self.assertEqual(len(machine.members[graph.bindings['members']['CapturedComponents']['name']]), 0)
                self.assertIsNone(machine.locals['CurrentComponent'])
                self.assertIsNone(machine.locals['CurrentClass'])
                return result
            route = RouteMachine(self.graph, creation_valid=creation_valid, capture=run_capture)
            route.press()
            self.assertEqual(calls, [])
            route.press(); route.press()
            self.assertEqual(len(calls), 1)
            self.assertEqual(calls[0].calls.count(('query',)), int(not paused and creation_valid))
            if creation_valid:
                page = route.members['ControlReadout']['snapshot']
                self.assertIn('NOT COLLECTED: PAUSED' if paused else 'Probe matches: 1 (captured entries)', page)
            else:
                self.assertNotIn('SetSnapshot', route.events)

    def test_attempt_reset_and_direct_capture_bypass_rejected(self):
        graph = clone(self.graph)
        graph.nodes['ConsumeSnapshot']['pins']['B0SnapshotAttempted']['DefaultValue'] = '"false"'
        with self.assertRaisesRegex(ValueError, 'ATTEMPTS_MUST_BE_CONSUMED'):
            graph.validate()
        graph = clone(self.graph)
        graph.edges.remove(('ConsumeSnapshot', 'then', 'Capture', 'execute'))
        graph.edges.append(('SnapshotGuard', 'else', 'Capture', 'execute'))
        with self.assertRaisesRegex(ValueError, 'EXACT_NEW_ROUTE_WIRING_REQUIRED'):
            graph.validate()

    def test_existing_nodes_and_exact_boundary_changes_are_preserved(self):
        graph = clone(self.graph)
        graph.nodes['Input']['fields'].append('bConsumeInput=True')
        with self.assertRaisesRegex(ValueError, 'SOURCE_ROUTE_SCHEMA_DRIFT'):
            graph.validate()
        graph = clone(self.graph)
        graph.edges.remove(('ClearCapturedArray', 'then', 'ParentEndPlay', 'execute'))
        with self.assertRaisesRegex(ValueError, 'EXACT_SIX_BOUNDARY_WIRES_REQUIRED'):
            graph.validate()


if __name__ == '__main__':
    print('MOCK_ONLY B0 merged event-route tests; unresolved slots are not native nodes. Native import/runtime NOT_PERFORMED.', flush=True)
    unittest.main(verbosity=2)
