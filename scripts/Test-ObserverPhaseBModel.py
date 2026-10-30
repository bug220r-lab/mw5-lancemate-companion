"""MOCK_ONLY behavioral tests; no Unreal import, editor, game or file mutation."""
import collections
from collections.abc import Sequence
import importlib.util
from pathlib import Path
import sys
from types import SimpleNamespace
import unittest

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('observer_phase_b_model', Path(__file__).with_name('ObserverPhaseBModel.py'))
model = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = model
spec.loader.exec_module(model)


def component(object_path='/World/Player.Probe', class_path=model.PROBE_CLASS, valid=True, class_valid=True):
    return SimpleNamespace(valid=valid, identity=model.ComponentIdentity(object_path, class_path, class_valid))


class Source:
    def __init__(self, values=None):
        self.values = [] if values is None else values
        self.calls = collections.Counter()
        self.pause = False
        self.is_local = True
        self.base = (True, model.BASE_CLASS)
        self.identity = model.Identity('/World/Player', '/Game/Controller.Controller_C', 'InstantAction')
        self.fail = None

    def call(self, name):
        self.calls[name] += 1
        if self.fail in (name, '*'):
            raise RuntimeError('MOCK_ONLY failure')

    def paused(self):
        self.call('paused')
        return self.pause

    def local(self):
        self.call('local')
        return self.is_local

    def base_class(self):
        self.call('base_class')
        return self.base

    def controller_identity(self):
        self.call('controller_identity')
        return self.identity

    def query_components(self):
        self.call('query')
        return self.values

    def component_valid(self, item):
        self.call('component_valid')
        return item.valid

    def component_class_identity(self, item):
        self.call('component_class_identity')
        return model.ClassIdentity(item.identity.class_path, item.identity.class_valid)

    def component_object_path(self, item):
        self.call('component_object_path')
        return item.identity.object_path


class UI:
    def __init__(self):
        self.calls = collections.Counter()
        self.fail = None
        self.widget_is_valid = True
        self.widget = object()
        self.shown = []
        self.removed = []
        self.parent_reasons = []
        self.reenter = None

    def call(self, name):
        self.calls[name] += 1
        if self.fail == name:
            raise RuntimeError('MOCK_ONLY UI failure')

    def create_widget(self, marker):
        self.call('create')
        if self.reenter:
            self.reenter()
        self.shown.append(marker)
        return self.widget

    def valid(self, widget):
        self.call('valid')
        return widget is self.widget and self.widget_is_valid

    def add(self, widget):
        self.call('add')
        assert widget is self.widget

    def set_text(self, widget, text):
        self.call('set')
        assert widget is self.widget
        self.shown.append(text)

    def remove(self, widget):
        self.call('remove')
        self.removed.append(widget)

    def parent_end_play(self, reason):
        self.call('parent_end_play')
        self.parent_reasons.append(reason)


class VirtualArray(Sequence):
    def __init__(self, size, item):
        self.size, self.item = size, item
        self.visited = []

    def __len__(self):
        return self.size

    def __getitem__(self, index):
        if not 0 <= index < self.size:
            raise IndexError(index)
        self.visited.append(index)
        return self.item


class CountedPath(str):
    visited_characters = 0
    formatted = 0

    def __iter__(self):
        for character in super().__iter__():
            self.visited_characters += 1
            yield character

    def __format__(self, format_spec):
        self.formatted += 1
        raise AssertionError('Unchecked huge path reached formatting')


def sized_text(length):
    """ASCII fixture with <=64-unit lines; newlines count toward length."""
    chunks = []
    while length > 64:
        chunks.append('x' * 64)
        length -= 65
    chunks.append('x' * length)
    return '\n'.join(chunks)


class StateChecks(unittest.TestCase):
    def setUp(self):
        self.ui, self.source = UI(), Source([component()])
        self.control = model.ReferenceController(self.ui, self.source)

    def capture(self):
        self.control.press()
        self.control.press()
        return self.control.snapshot

    def assert_consumed(self, queries):
        before = self.source.calls.copy()
        for _ in range(80):
            self.control.press()
        self.assertEqual(self.source.calls, before)
        self.assertEqual(self.source.calls['query'], queries)
        self.assertEqual(self.ui.calls['create'], 1)
        self.assertTrue(self.control.snapshot_attempted)

    def assert_bounded(self):
        self.assertLessEqual(model.validate_storage(self.control.pages), 4096)
        self.assertLessEqual(sum(len(page.encode('utf-8')) for page in self.control.pages), 16384)
        for page in self.control.pages:
            self.assertLessEqual(model.units(page), 768)
            self.assertLessEqual(len(page.splitlines()), 16)

    def test_first_press_independent_marker_zero_metadata_or_component_reads(self):
        self.source.fail = '*'
        self.assertEqual(self.control.press(), model.STATIC_MARKER)
        self.assertEqual(self.source.calls, {})
        self.assertEqual(self.ui.calls['create'], 1)
        self.assertEqual(self.ui.calls['add'], 1)
        self.assertFalse(self.control.snapshot_attempted)

    def test_second_press_one_query_complete_exact_match(self):
        result = self.capture()
        self.assertEqual((result.returned, result.visited, result.valid_class_checks, result.retained_rows, result.exact_matching_entries), (1, 1, 1, 1, 1))
        self.assertEqual(result.status, 'COMPLETE')
        self.assertEqual(self.source.calls['query'], 1)
        self.assertIsNone(self.control.components)
        self.assert_bounded()

    def test_later_pages_use_only_frozen_strings_even_when_sources_mutate(self):
        self.capture()
        stored = self.control.pages
        before = self.source.calls.copy()
        self.source.values[0].identity = model.ComponentIdentity('/Changed', '/ChangedClass')
        self.source.values.clear()
        self.source.fail = '*'
        self.source.pause, self.source.is_local = True, False
        self.assert_consumed(1)
        self.assertEqual(self.source.calls, before)
        self.assertEqual(self.control.pages, stored)
        self.assertIn('/World/Player.Probe', '\n'.join(stored))

    def test_last_page_saturates_without_new_setter_or_query(self):
        self.capture()
        for _ in range(len(self.control.pages) - 1):
            self.control.press()
        index, shown, sets = self.control.page_index, self.control.displayed, self.ui.calls['set']
        for _ in range(20):
            self.control.press()
        self.assertEqual((self.control.page_index, self.control.displayed, self.ui.calls['set']), (index, shown, sets))
        self.assertEqual(index, len(self.control.pages) - 1)

    def test_paused_attempt_consumed_and_never_retried_after_unpause(self):
        self.source.pause = True
        self.capture()
        self.assertIn('PAUSED_OR_UNKNOWN', self.control.displayed)
        self.source.pause = False
        self.assert_consumed(0)

    def test_unknown_pause_fails_closed(self):
        self.source.pause = None
        self.capture()
        self.assertEqual(self.source.calls['local'], 0)
        self.assert_consumed(0)

    def test_nonlocal_or_unknown_locality_fails_closed(self):
        for local in (False, None, 'true'):
            with self.subTest(local=local):
                self.setUp()
                self.source.is_local = local
                self.capture()
                self.assertIn('NONLOCAL_OR_UNKNOWN', self.control.displayed)
                self.assert_consumed(0)

    def test_invalid_or_changed_base_class_no_fallback(self):
        for base in ((False, model.BASE_CLASS), (None, model.BASE_CLASS), (True, '/Script/Engine.ActorComponent')):
            with self.subTest(base=base):
                self.setUp()
                self.source.base = base
                self.capture()
                self.assertEqual(self.source.calls['controller_identity'], 0)
                self.assert_consumed(0)

    def test_invalid_controller_has_no_query(self):
        self.source.identity = model.Identity('/Object', '/Class', 'Level', False)
        self.capture()
        self.assertIn('CONTROLLER_INVALID', self.control.displayed)
        self.assert_consumed(0)

    def test_missing_identity_fields_refuse_before_query(self):
        for args in (('', '/Class', 'Level'), ('/Object', '', 'Level'), ('/Object', '/Class', '')):
            with self.subTest(args=args):
                self.setUp()
                self.source.identity = model.Identity(*args)
                self.capture()
                self.assertIn('IDENTITY_LIMIT_OR_INVALID', self.control.displayed)
                self.assert_consumed(0)

    def test_overlong_controller_identity_refuses_before_query(self):
        self.source.identity = model.Identity('x' * 257, '/Class', 'Level')
        self.capture()
        self.assert_consumed(0)
        self.assertNotIn('x' * 257, self.control.displayed)

    def test_invalid_widget_never_recreated_or_queried(self):
        self.ui.widget_is_valid = False
        self.capture()
        self.assertFalse(self.control.pages_ready)
        self.assert_consumed(0)

    def test_creation_failure_consumes_creation_and_prevents_capture(self):
        self.ui.fail = 'create'
        self.capture()
        self.assertIsNone(self.control.widget)
        self.assert_consumed(0)

    def test_known_viewport_add_failure_prevents_later_capture(self):
        self.ui.fail = 'add'
        self.control.press()
        self.assertTrue(self.control.control_failed)
        self.assertIsNotNone(self.control.widget)
        self.ui.fail = None
        self.control.press()
        self.assert_consumed(0)

    def test_initial_invalid_widget_cannot_be_repaired_into_capture(self):
        self.ui.widget_is_valid = False
        self.control.press()
        self.ui.widget_is_valid = True
        self.control.press()
        self.assert_consumed(0)

    def test_query_exception_consumes_single_capture(self):
        self.source.fail = 'query'
        self.capture()
        self.assertIn('CAPTURE_FAILURE', self.control.displayed)
        self.assertEqual(self.control.snapshot.status, 'INCOMPLETE')
        self.assertIn('Returned: UNKNOWN', self.control.displayed)
        self.assert_consumed(1)

    def test_identity_read_exception_is_inconclusive_and_no_retry(self):
        self.source.fail = 'component_class_identity'
        self.capture()
        self.assertEqual(self.control.snapshot.status, 'INCOMPLETE')
        self.assertEqual(self.control.snapshot.visited, 1)
        self.assertIn('Returned: 1', self.control.displayed)
        self.assertIn('PROBE MATCH TOTAL UNKNOWN', self.control.displayed)
        self.assert_consumed(1)

    def test_invalid_slot_is_counted_explicit_and_not_complete(self):
        self.source.values = [component(valid=False), component()]
        result = self.capture()
        self.assertEqual((result.visited, result.invalid_entries, result.valid_class_checks, result.retained_rows), (2, 1, 1, 2))
        self.assertEqual(result.status, 'INCOMPLETE')
        self.assertIn('Entry 0: INVALID ENTRY', '\n'.join(self.control.pages))
        self.assertIn('PROBE MATCH TOTAL UNKNOWN', self.control.pages[0])

    def test_invalid_component_class_continues_to_later_slot(self):
        self.source.values = [component(class_valid=False), component()]
        result = self.capture()
        self.assertEqual((result.visited, result.valid_class_checks, result.retained_rows), (2, 1, 2))
        self.assertIn('Entry 0: CLASS CHECK INCOMPLETE', '\n'.join(self.control.pages))
        self.assertEqual(result.status, 'INCOMPLETE')
        self.assertEqual(self.source.calls['component_valid'], 2)
        self.assertEqual(self.source.calls['component_object_path'], 1)
        self.assertFalse(result.class_scan_complete)

    def test_empty_component_object_or_class_path_is_incomplete(self):
        for args in (('', model.PROBE_CLASS), ('/Object', '')):
            with self.subTest(args=args):
                self.setUp()
                self.source.values = [component(*args)]
                result = self.capture()
                self.assertEqual(result.status, 'INCOMPLETE')
                self.assertEqual(result.class_scan_complete, bool(args[1]))
                expected = 'Captured array matching entries: 1' if args[1] else 'PROBE MATCH TOTAL UNKNOWN'
                self.assertIn(expected, self.control.pages[0])

    def test_huge_path_is_rejected_after_bounded_scan_without_formatting(self):
        path = CountedPath('x' * 1000000)
        self.source.values = [component(path)]
        result = self.capture()
        self.assertEqual(result.status, 'INCOMPLETE')
        self.assertEqual(path.formatted, 0)
        self.assertEqual(path.visited_characters, 257)
        self.assertFalse(result.rows)
        self.assert_bounded()

    def test_unicode_supplementary_component_path_uses_two_units(self):
        path = '\U0001f680' * 128
        self.source.values = [component(path)]
        result = self.capture()
        self.assertEqual(result.status, 'COMPLETE')
        self.assertEqual(result.rows[0]['object_path'], path)
        self.assert_bounded()

    def test_one_supplementary_character_over_path_limit_is_incomplete(self):
        self.source.values = [component('\U0001f680' * 129)]
        self.assertEqual(self.capture().status, 'INCOMPLETE')
        self.assert_bounded()

    def test_surrogate_or_embedded_control_path_cannot_inject_output(self):
        for path in ('bad\ud800', '/Object\nCOMPLETE', '/Object\x00'):
            with self.subTest(path=repr(path)):
                self.setUp()
                self.source.values = [component(path)]
                self.assertEqual(self.capture().status, 'INCOMPLETE')
                self.assert_bounded()

    def test_empty_array_complete_only_for_returned_array_not_probe_absence(self):
        self.source.values = []
        result = self.capture()
        self.assertEqual((result.returned, result.visited, result.exact_matching_entries, result.status), (0, 0, 0, 'COMPLETE'))
        summary = self.control.pages[0]
        self.assertIn('Probe class resolution: NOT CHECKED', summary)
        self.assertIn('intended factory target: UNKNOWN', summary)
        self.assertNotIn('missing', summary.lower())
        self.assertNotIn('absent', summary.lower())

    def test_match_is_exact_case_sensitive_literal_not_prefix_or_subclass(self):
        self.source.values = [component('/A', model.PROBE_CLASS), component('/B', model.PROBE_CLASS.lower()),
                              component('/C', model.PROBE_CLASS + '_Child'), component('/D', model.PROBE_CLASS[:-2])]
        result = self.capture()
        self.assertEqual(result.status, 'COMPLETE')
        self.assertEqual(result.exact_matching_entries, 1)

    def test_duplicate_exact_entries_are_entries_not_distinct_instances(self):
        item = component()
        self.source.values = [item, item]
        result = self.capture()
        self.assertEqual((result.valid_class_checks, result.exact_matching_entries), (2, 2))
        self.assertIn('Counts are entries, not distinct objects.', self.control.pages[0])

    def test_33_entries_and_unvisited_match_never_imply_zero_total(self):
        self.source.values = [component('/A', '/OtherClass') for _ in range(32)] + [component()]
        result = self.capture()
        self.assertEqual(result.returned, 33)
        self.assertEqual((result.visited, result.valid_class_checks), (32, 32))
        self.assertFalse(result.class_scan_complete)
        self.assertEqual(result.exact_matching_entries, 0)
        self.assertEqual(result.status, 'INCOMPLETE')
        self.assertIn('COUNT_LIMIT', result.reasons)
        self.assertIn('PROBE MATCH TOTAL UNKNOWN', self.control.pages[0])
        self.assert_bounded()

    def test_31_and_32_entries_are_all_class_checked_after_text_storage_closes(self):
        for count in (31, 32):
            with self.subTest(count=count):
                self.setUp()
                values = VirtualArray(count, component('/O', '/C'))
                self.source.values = values
                result = self.capture()
                self.assertEqual(result.returned, count)
                self.assertEqual((result.visited, result.valid_class_checks), (count, count))
                self.assertTrue(result.class_scan_complete)
                self.assertFalse(result.detailed_output_complete)
                self.assertEqual(values.visited, list(range(result.visited)))
                self.assertIn('TEXT_LIMIT', result.reasons)
                self.assertEqual(result.status, 'INCOMPLETE')
                self.assert_bounded()

    def test_late_probe_is_counted_after_detail_storage_closes_without_object_reads(self):
        self.source.values = [component('/Object' + str(i), '/OtherClass') for i in range(31)] + [component('/LateProbe')]
        object_reads = []
        original_getter, original_segments = self.source.component_object_path, model.path_segments
        def guarded_getter(item):
            self.assertFalse(self.control.snapshot.detail_storage_closed)
            object_reads.append(item.identity.object_path)
            return original_getter(item)
        def guarded_segments(path):
            self.assertFalse(self.control.snapshot.detail_storage_closed)
            return original_segments(path)
        self.source.component_object_path = guarded_getter
        model.path_segments = guarded_segments
        try:
            result = self.capture()
        finally:
            model.path_segments = original_segments
        self.assertEqual((result.returned, result.visited, result.valid_class_checks, result.exact_matching_entries), (32, 32, 32, 1))
        self.assertTrue(result.class_scan_complete)
        self.assertFalse(result.detailed_output_complete)
        self.assertTrue(result.detail_storage_closed)
        self.assertEqual(result.status, 'INCOMPLETE')
        self.assertEqual(len(object_reads), result.retained_rows + 1)
        self.assertNotIn('/LateProbe', object_reads)
        self.assertNotIn('/LateProbe', str(result.rows))
        self.assertEqual(self.source.calls['component_class_identity'], 32)
        self.assertIn('Captured array matching entries: 1', self.control.pages[0])
        self.assert_consumed(1)
        self.assert_bounded()

    def test_invalid_late_class_keeps_global_count_unknown_after_storage_closes(self):
        self.source.values = [component('/O', '/C') for _ in range(31)] + [component(class_valid=False)]
        result = self.capture()
        self.assertEqual((result.visited, result.valid_class_checks, result.invalid_entries), (32, 31, 1))
        self.assertTrue(result.detail_storage_closed)
        self.assertFalse(result.class_scan_complete)
        self.assertFalse(result.detailed_output_complete)
        self.assertIn('PROBE MATCH TOTAL UNKNOWN', self.control.pages[0])
        self.assert_bounded()

    def test_bad_object_path_closes_only_details_and_preserves_later_class_matches(self):
        self.source.values = [component('', '/Other'), component('/NeverRead'), component('/AlsoNeverRead')]
        result = self.capture()
        self.assertEqual((result.visited, result.valid_class_checks, result.exact_matching_entries, result.invalid_entries), (3, 3, 2, 0))
        self.assertEqual(self.source.calls['component_object_path'], 1)
        self.assertEqual(result.retained_rows, 0)
        self.assertTrue(result.class_scan_complete)
        self.assertFalse(result.detailed_output_complete)
        self.assertEqual(result.status, 'INCOMPLETE')
        self.assertIn('Captured array matching entries: 2', self.control.pages[0])
        self.assert_bounded()

    def test_overlong_class_path_is_bounded_then_later_valid_class_is_checked(self):
        huge = CountedPath('x' * 1000000)
        self.source.values = [component('/First', huge), component('/Second')]
        result = self.capture()
        self.assertEqual((result.visited, result.valid_class_checks, result.invalid_entries, result.exact_matching_entries), (2, 1, 1, 1))
        self.assertEqual(huge.visited_characters, 257)
        self.assertEqual(huge.formatted, 0)
        self.assertEqual(self.source.calls['component_object_path'], 1)
        self.assertFalse(result.class_scan_complete)
        self.assertIn('PROBE MATCH TOTAL UNKNOWN', self.control.pages[0])
        self.assert_bounded()

    def test_detail_format_bound_closes_storage_and_continues_class_only_scan(self):
        self.source.values = [component('/First'), component('/NeverRead', '/Other'), component('/LateProbe')]
        original = model.path_segments
        def fail_object_format(path):
            if path == '/First':
                raise model.BoundError('MOCK_ONLY explicit detail format bound')
            return original(path)
        model.path_segments = fail_object_format
        try:
            result = self.capture()
        finally:
            model.path_segments = original
        self.assertEqual((result.visited, result.valid_class_checks, result.exact_matching_entries), (3, 3, 2))
        self.assertEqual(self.source.calls['component_object_path'], 1)
        self.assertEqual(result.retained_rows, 0)
        self.assertTrue(result.class_scan_complete)
        self.assertFalse(result.detailed_output_complete)
        self.assertIn('DETAIL_LIMIT', result.reasons)
        self.assertNotIn('CAPTURE_FAILURE', result.reasons)
        self.assert_bounded()

    def test_invalid_slot_after_storage_closes_still_counts_without_class_getter(self):
        self.source.values = [component('/O', '/C') for _ in range(31)] + [component(valid=False)]
        result = self.capture()
        self.assertEqual((result.visited, result.valid_class_checks, result.invalid_entries), (32, 31, 1))
        self.assertEqual(self.source.calls['component_class_identity'], 31)
        self.assertFalse(result.class_scan_complete)
        self.assert_bounded()

    def test_teardown_during_class_only_scan_cannot_publish(self):
        self.source.values = [component('/O', '/C') for _ in range(32)]
        original = self.source.component_class_identity
        def end_after_closed(item):
            value = original(item)
            if self.control.snapshot.detail_storage_closed:
                self.control.end_play('MOCK_CLASS_ONLY_END')
            return value
        self.source.component_class_identity = end_after_closed
        self.capture()
        self.assertTrue(self.control.ended)
        self.assertFalse(self.control.pages)
        self.assertFalse(self.control.snapshot.rows)
        self.assertFalse(self.control.snapshot.class_scan_complete)
        self.assertIsNone(self.control.widget)
        self.assertIsNone(self.control.components)
        self.assertEqual(self.ui.calls['set'], 0)
        self.assertEqual(self.ui.parent_reasons, ['MOCK_CLASS_ONLY_END'])

    def test_worst_count_combined_invalid_and_storage_reasons_fit_summary(self):
        class MixedArray(VirtualArray):
            def __getitem__(self, index):
                value = super().__getitem__(index)
                if index == 0:
                    return component(valid=False)
                if index == 1:
                    return component(class_valid=False)
                if index == 2:
                    return component('/Object', 'x' * 257)
                return value
        self.source.values = MixedArray(model.MAX_ARRAY_COUNT, component('W' * 256, 'C' * 256))
        result = self.capture()
        self.assertEqual((result.returned, result.visited, result.valid_class_checks, result.invalid_entries), (2147483647, 32, 29, 3))
        self.assertEqual(set(result.reasons), {'COUNT_LIMIT', 'INVALID_ENTRY', 'CLASS_LIMIT', 'TEXT_LIMIT', 'UNVISITED_ENTRIES', 'UNRETAINED_ENTRIES'})
        self.assertIsNone(self.control.last_issue)
        self.assertGreater(len(self.control.pages), 1)
        self.assertFalse(result.class_scan_complete)
        self.assertFalse(result.detailed_output_complete)
        self.assertIn('PROBE MATCH TOTAL UNKNOWN', self.control.pages[0])
        self.assert_bounded()

    def test_object_failure_with_invalid_classes_and_worst_count_fits_summary(self):
        class MixedArray(VirtualArray):
            def __getitem__(self, index):
                value = super().__getitem__(index)
                if index == 0:
                    return component('', '/Other')
                if index == 1:
                    return component(valid=False)
                if index == 2:
                    return component(class_valid=False)
                return value
        self.source.values = MixedArray(model.MAX_ARRAY_COUNT, component('/NeverRead', '/C'))
        result = self.capture()
        self.assertEqual((result.visited, result.valid_class_checks, result.invalid_entries), (32, 30, 2))
        self.assertEqual(self.source.calls['component_object_path'], 1)
        self.assertIsNone(self.control.last_issue)
        self.assertIn('OBJECT_PATH_LIMIT', result.reasons)
        self.assertGreater(len(self.control.pages), 1)
        self.assert_bounded()

    def test_widest_supported_count_has_no_count_driven_loop(self):
        values = VirtualArray(model.MAX_ARRAY_COUNT, component('/O', '/C'))
        self.source.values = values
        result = self.capture()
        self.assertEqual(result.returned, 2147483647)
        self.assertLessEqual(len(values.visited), 32)
        self.assertEqual(self.source.calls['query'], 1)
        self.assert_bounded()

    def test_unsupported_huge_array_count_is_not_formatted(self):
        self.source.values = VirtualArray(model.MAX_ARRAY_COUNT + 1, component())
        self.capture()
        self.assertIn('ARRAY_COUNT_INVALID', self.control.displayed)
        self.assertFalse(self.source.values.visited)
        self.assert_consumed(1)

    def test_generator_is_not_consumed_as_unbounded_array(self):
        def forbidden():
            raise AssertionError('Generator must not be entered')
            yield None
        self.source.values = forbidden()
        self.capture()
        self.assertIn('ARRAY_INVALID', self.control.displayed)
        self.assert_consumed(1)

    def test_summary_context_reserve_refuses_before_query_without_zero_claim(self):
        self.source.identity = model.Identity('o' * 256, 'c' * 256, 'l' * 128)
        self.source.values = []
        self.capture()
        self.assertIn('SUMMARY_CONTEXT_LIMIT', self.control.displayed)
        self.assertEqual(self.control.snapshot.status, 'NOT_COLLECTED')
        self.assertFalse(self.control.snapshot.returned_known)
        self.assertEqual(self.source.calls['query'], 0)
        self.assertIn('PROBE MATCH TOTAL UNKNOWN', self.control.displayed)
        self.assert_bounded()

    def test_postquery_summary_failure_retains_incomplete_counts(self):
        def fail_summary(result):
            raise model.BoundError('MOCK_ONLY unexpected summary formatting failure')
        self.control._summary = fail_summary
        result = self.capture()
        self.assertEqual(result.status, 'INCOMPLETE')
        self.assertEqual((result.returned, result.visited, result.retained_rows), (1, 1, 1))
        self.assertIn('Captured array matching entries: 1', self.control.displayed)
        self.assertTrue(result.class_scan_complete)
        self.assertFalse(result.detailed_output_complete)
        self.assert_consumed(1)

    def test_object_class_pair_admitted_atomically_when_only_half_would_fit(self):
        self.source.values = [component('W' * 256, 'W' * 160) for _ in range(4)]
        result = self.capture()
        self.assertEqual((result.visited, result.retained_rows), (4, 3))
        self.assertEqual(result.status, 'INCOMPLETE')
        self.assertIn('TEXT_LIMIT', result.reasons)
        object_pages = [page for page in self.control.pages if '| OBJECT |' in page]
        class_pages = [page for page in self.control.pages if '| CLASS |' in page]
        self.assertEqual((len(object_pages), len(class_pages)), (3, 3))
        self.assertNotIn('Entry 3 |', '\n'.join(self.control.pages))
        def reserved(page):
            return model.units('\n'.join(page.split('\n')[2:-1])) + model.HEADER_RESERVE
        used = sum(reserved(page) for page in object_pages + class_pages)
        remaining = 4096 - 1536 - used
        self.assertLessEqual(reserved(object_pages[0]), remaining)
        self.assertGreater(reserved(object_pages[0]) + reserved(class_pages[0]), remaining)
        self.assert_bounded()

    def test_source_proven_controller_class_with_synthetic_map_and_four_entries_completes(self):
        # The controller class literal is source-proven; runtime map/object
        # identities below are synthetic, not observed retail paths.
        class_path = '/ModOverride/LanceObserverDiagnosticControl/Modes/InstantAction/InstantActionPlayerController.InstantActionPlayerController_C'
        object_path = '/Game/Maps/SyntheticInstantAction.SyntheticInstantAction:PersistentLevel.InstantActionPlayerController_C_0'
        self.source.identity = model.Identity(object_path, class_path, 'SyntheticInstantAction')
        self.source.values = [component(object_path + '.Component_' + str(index), model.BASE_CLASS) for index in range(4)]
        result = self.capture()
        self.assertEqual(result.status, 'COMPLETE')
        self.assertEqual((result.returned, result.visited, result.retained_rows), (4, 4, 4))
        self.assertEqual(self.source.calls['query'], 1)
        self.assertEqual(len(self.control.pages), 12)
        self.assert_bounded()

    def test_partial_read_failure_preserves_counts_as_incomplete(self):
        self.source.values = [component('/First'), component('/Second')]
        original = self.source.component_class_identity
        def fail_second(item):
            if item.identity.object_path == '/Second':
                raise RuntimeError('MOCK_ONLY second-row failure')
            return original(item)
        self.source.component_class_identity = fail_second
        result = self.capture()
        self.assertEqual((result.returned, result.visited, result.valid_class_checks, result.retained_rows), (2, 2, 1, 1))
        self.assertEqual(result.status, 'INCOMPLETE')
        self.assertIn('Stored rows before failure: 1', self.control.displayed)
        self.assert_consumed(1)

    def test_teardown_during_query_cannot_republish_snapshot_or_refs(self):
        original = self.source.query_components
        def end_during_query():
            values = original()
            self.control.end_play('MOCK_QUERY_END')
            return values
        self.source.query_components = end_during_query
        self.capture()
        self.assertTrue(self.control.ended)
        self.assertFalse(self.control.pages_ready)
        self.assertFalse(self.control.pages)
        self.assertIsNone(self.control.components)
        self.assertIsNone(self.control.widget)
        self.assertIsNone(self.control.displayed)
        self.assertEqual(self.ui.calls['set'], 0)
        self.assertEqual(self.ui.parent_reasons, ['MOCK_QUERY_END'])

    def test_teardown_during_setter_cannot_restore_pages_after_end(self):
        original = self.ui.set_text
        def end_during_setter(widget, text):
            original(widget, text)
            self.control.end_play('MOCK_SET_END')
        self.ui.set_text = end_during_setter
        self.capture()
        self.assertTrue(self.control.ended)
        self.assertFalse(self.control.pages_ready)
        self.assertFalse(self.control.pages)
        self.assertIsNone(self.control.displayed)
        self.assertEqual(self.ui.parent_reasons, ['MOCK_SET_END'])

    def test_wide_ascii_and_cjk_paths_are_stored_without_pixel_fit_claim(self):
        for glyph in ('W', '\u4e2d'):
            with self.subTest(glyph=glyph):
                self.setUp()
                self.source.values = [component(glyph * 256, glyph * 256)]
                result = self.capture()
                self.assertEqual(result.status, 'COMPLETE')
                self.assertEqual(result.rows[0]['object_path'], glyph * 256)
                row_pages = [page for page in self.control.pages if 'Entry 0 |' in page]
                self.assertEqual(len(row_pages), 2)
                for page in row_pages:
                    path_lines = [line for line in page.split('\n') if line and set(line) == {glyph}]
                    self.assertEqual(''.join(path_lines), glyph * 256)
                    self.assertTrue(all(model.units(line) <= 40 for line in path_lines))
                    self.assertLessEqual(len(page.split('\n')), 16)
                self.assert_bounded()

    def test_pages_contiguous_each_retained_row_once(self):
        self.source.values = [component('/Object' + str(index)) for index in range(4)]
        result = self.capture()
        self.assertEqual(result.status, 'COMPLETE')
        self.assertEqual(result.returned, result.visited)
        self.assertEqual(result.visited, result.valid_class_checks)
        self.assertEqual(result.visited, result.retained_rows)
        for number, page in enumerate(self.control.pages, 1):
            self.assertIn('PAGE {}/{}'.format(number, len(self.control.pages)), page)
        text = '\n'.join(self.control.pages)
        for row in result.rows:
            self.assertEqual(text.count('Entry {} | OBJECT |'.format(row['index'])), 1)
            self.assertEqual(text.count('Entry {} | CLASS |'.format(row['index'])), 1)
        self.assert_bounded()

    def test_widget_invalidated_after_capture_cannot_advance(self):
        self.capture()
        self.ui.widget_is_valid = False
        before = self.control.page_index
        self.assert_consumed(1)
        self.assertEqual(self.control.page_index, before)

    def test_display_failure_does_not_requery_on_next_press(self):
        self.control.press()
        self.ui.fail = 'set'
        self.control.press()
        self.assertFalse(self.control.pages_ready)
        self.assertTrue(self.control.snapshot.class_scan_complete)
        self.assertFalse(self.control.snapshot.detailed_output_complete)
        self.assertEqual(self.control.snapshot.status, 'INCOMPLETE')
        self.assertIsNone(self.control.components)
        self.ui.fail = None
        self.assert_consumed(1)

    def test_reentrant_input_during_creation_has_no_snapshot_fallthrough(self):
        self.ui.reenter = self.control.press
        self.control.press()
        self.assertEqual(self.source.calls, {})
        self.assertEqual(self.ui.calls['create'], 1)
        self.assertFalse(self.control.snapshot_attempted)

    def test_endplay_cleans_only_owned_widget_and_calls_parent_once(self):
        self.capture()
        owned = self.control.widget
        self.control.end_play('MOCK_LEVEL_TRANSITION')
        self.control.end_play('SECOND_REASON')
        self.control.press()
        self.assertEqual(self.ui.removed, [owned])
        self.assertEqual(self.ui.parent_reasons, ['MOCK_LEVEL_TRANSITION'])
        self.assertTrue(self.control.control_attempted)
        self.assertTrue(self.control.snapshot_attempted)
        self.assertFalse(self.control.pages_ready)
        self.assertIsNone(self.control.widget)
        self.assertIsNone(self.control.components)
        self.assertFalse(self.control.pages)
        self.assertFalse(self.control.snapshot.rows)

    def test_invalid_widget_cleanup_still_preserves_parent(self):
        self.capture()
        self.ui.widget_is_valid = False
        self.control.end_play('MOCK_END')
        self.assertEqual(self.ui.calls['remove'], 0)
        self.assertEqual(self.ui.parent_reasons, ['MOCK_END'])
        self.assertFalse(self.control.pages)

    def test_cleanup_error_still_clears_refs_and_calls_parent(self):
        self.capture()
        self.ui.fail = 'remove'
        self.control.end_play('MOCK_END')
        self.assertIsNone(self.control.widget)
        self.assertFalse(self.control.pages)
        self.assertEqual(self.ui.parent_reasons, ['MOCK_END'])

    def test_endplay_before_first_press_does_not_create_or_query(self):
        self.control.end_play('MOCK_END')
        self.control.press()
        self.assertEqual(self.source.calls, {})
        self.assertEqual(self.ui.calls['create'], 0)


class TextBoundChecks(unittest.TestCase):
    def test_every_page_position_and_status_fits_96_unit_decoration_reserve(self):
        worst = 0
        for total in range(1, 71):
            for index in range(total):
                for status in ('COMPLETE', 'INCOMPLETE', 'NOT_COLLECTED'):
                    page = model.decorate('x', index, total, status)
                    # Independent UTF-16 encoding count includes every newline.
                    decoration = len(page.encode('utf-16-le')) // 2 - 1
                    self.assertLessEqual(decoration, 96)
                    worst = max(worst, decoration)
                    self.assertEqual(len(page.split('\n')), 4)
        self.assertEqual(worst, 91)
        self.assertEqual(model.HEADER_RESERVE, 96)

    def test_utf16_counts_ascii_bmp_and_supplementary(self):
        self.assertEqual(model.units('a\u03bb\u4e2d\U0001f680'), 5)

    def test_segment_width_never_splits_supplementary_character(self):
        raw = ('x' * 63 + '\U0001f680') * 3 + 'y' * 61
        self.assertEqual(model.units(raw), 256)
        segments = model.path_segments(raw)
        self.assertEqual(''.join(segments), raw)
        self.assertLessEqual(len(segments), 7)
        self.assertTrue(all(model.units(segment) <= 40 for segment in segments))
        for segment in segments:
            segment.encode('utf-16-le', errors='strict')

    def test_raw_path_256_units_accepted_257_rejected(self):
        self.assertEqual(''.join(model.path_segments('x' * 256)), 'x' * 256)
        with self.assertRaises(model.BoundError):
            model.path_segments('x' * 257)

    def test_4096_all_saved_units_accepted_and_4097_rejected(self):
        pages = [sized_text(768)] * 5 + [sized_text(256)]
        self.assertEqual(model.validate_storage(pages), 4096)
        with self.assertRaisesRegex(model.BoundError, 'TOTAL_LIMIT'):
            model.validate_storage(pages[:-1] + [sized_text(257)])

    def test_page_768_accepted_769_rejected(self):
        self.assertEqual(model.validate_storage([sized_text(768)]), 768)
        with self.assertRaises(model.BoundError):
            model.validate_storage([sized_text(769)])

    def test_16_lines_accepted_17_rejected(self):
        model.validate_storage(['\n'.join(['x'] * 16)])
        with self.assertRaisesRegex(model.BoundError, 'LINE_LIMIT'):
            model.validate_storage(['\n'.join(['x'] * 17)])

    def test_body_600_and_summary_640_boundaries(self):
        self.assertEqual(model.units(model.body(sized_text(600).split('\n'))), 600)
        with self.assertRaisesRegex(model.BoundError, 'BODY_LIMIT'):
            model.body(sized_text(601).split('\n'))
        self.assertEqual(model.units(model.body(sized_text(640).split('\n'), 640)), 640)
        with self.assertRaisesRegex(model.BoundError, 'BODY_LIMIT'):
            model.body(sized_text(641).split('\n'), 640)

    def test_all_decorations_count_toward_page_and_aggregate(self):
        text = model.body(['x' * 64] * 8)
        page = model.decorate(text, 0, 1, 'INCOMPLETE')
        self.assertGreater(model.units(page), model.units(text))
        self.assertLessEqual(model.units(page) - model.units(text), 128)
        self.assertEqual(model.validate_storage([page]), len(page.encode('utf-16-le')) // 2)

    def test_unicode_total_bound_implies_conservative_utf8_payload_bound(self):
        for value in ('\u4e2d', '\U0001f680'):
            page = '\n'.join([value * (64 // model.units(value))] * 8)
            pages = [page] * 7
            total = model.validate_storage(pages)
            self.assertLessEqual(total, 4096)
            self.assertLessEqual(sum(len(item.encode('utf-8')) for item in pages), 16384)

    def test_no_ellipsis_inserted_into_path_segments(self):
        path = '/' + 'abcdef' * 40
        lines = model.path_segments(path)
        self.assertEqual(''.join(lines), path)
        self.assertNotIn('...', ''.join(lines))
        self.assertNotIn('\u2026', ''.join(lines))


if __name__ == '__main__':
    print('Classification: MOCK_ONLY reference algorithm. Native/editor/game execution: NOT_PERFORMED.')
    unittest.main(verbosity=2)
