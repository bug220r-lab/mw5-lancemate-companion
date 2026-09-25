"""MOCK_ONLY regression checks for critical WindowBridge rejection/cleanup paths.

Never constructs Desktop or calls Windows APIs, captures screens, or sends input.
All files are synthetic evidence in an automatically removed temporary directory.
"""
import contextlib
from datetime import datetime, timedelta, timezone
import importlib.util
import io
import json
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest
from unittest import mock

from PIL import Image


spec = importlib.util.spec_from_file_location('window_bridge_under_test',
                                           Path(__file__).with_name('WindowBridge.py'))
bridge = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bridge)


class FakeClock:
    def __init__(self):
        self.base = datetime.now(timezone.utc)
        self.elapsed = 0.0

    def monotonic(self):
        return self.elapsed

    def sleep(self, seconds):
        self.elapsed += seconds

    def now(self, tz=None):
        return self.base + timedelta(seconds=self.elapsed)


class FakeUser:
    def __init__(self, partial_first=False):
        self.calls = []
        self.partial_first = partial_first

    def SendInput(self, count, events, structure_size):
        parsed = []
        for event in events:
            if event.type == 0:
                parsed.append(('mouse', event.data.mi.flags))
            else:
                parsed.append(('key', event.data.ki.vk, event.data.ki.scan, event.data.ki.flags))
        self.calls.append(parsed)
        if self.partial_first and len(self.calls) == 1:
            return 1
        return count


class BridgeGuardTests(unittest.TestCase):
    def setUp(self):
        self.stack = contextlib.ExitStack()
        self.addCleanup(self.stack.close)
        self.tmp = Path(self.stack.enter_context(tempfile.TemporaryDirectory(prefix='mw5-bridge-mock-')))
        evidence = self.tmp / 'evidence'
        self.stack.enter_context(mock.patch.object(bridge, 'ROOT', self.tmp))
        self.stack.enter_context(mock.patch.object(bridge, 'EVIDENCE', evidence))
        executable = self.tmp / 'UE4Editor.exe'
        executable.write_bytes(b'OFFLINE TEST DATA - NOT AN EXECUTABLE')
        self.stack.enter_context(mock.patch.object(bridge, 'EDITOR', executable))
        self.stack.enter_context(mock.patch.object(bridge.C, 'WinDLL',
            side_effect=AssertionError('A unit test attempted a native Windows API')))
        self.stack.enter_context(mock.patch.object(bridge.Desktop, '__init__',
            side_effect=AssertionError('A unit test attempted to construct a live Desktop')))

        self.folder = evidence / 'session'
        capture_folder = self.folder / 'capture-test'
        capture_folder.mkdir(parents=True)
        self.ident = {'hwnd': 101, 'pid': 42, 'tid': 7, 'process': str(executable),
                      'process_created': 900, 'title': 'Offline editor fixture',
                      'client_rect': [100, 100, 300, 220], 'window_rect': [90, 80, 310, 230]}
        self.session = {**self.ident, 'kind': 'editor-navigation', 'session_id': 'offline-session',
                        'executable_sha256': bridge.digest(executable)}
        self.session_path = self.folder / 'session.json'
        self.write_session()
        self.expected = Image.new('RGB', (200, 120), '#d0d0d0')
        self.changed = self.expected.copy()
        self.changed.putpixel((70, 40), (0, 0, 0))
        self.png = capture_folder / 'client.png'
        self.expected.save(self.png)
        self.receipt = {'session': str(self.session_path), 'created_utc': bridge.now(),
                        'identity': self.ident, 'focus_hwnd': 101, 'image': str(self.png),
                        'sha256': bridge.digest(self.png), 'size': [200, 120],
                        'mapping': 'physical_capture_pixels_1_to_1'}
        self.receipt_path = capture_folder / 'receipt.json'
        self.receipt_path.write_text(json.dumps(self.receipt), encoding='utf-8')
        self.grab = self.stack.enter_context(mock.patch.object(bridge.ImageGrab, 'grab',
                                                              return_value=self.expected.copy()))
        self.stack.enter_context(mock.patch.object(bridge, 'capture',
                                                   return_value={'status': 'MOCK_AFTER_CAPTURE'}))
        self.d = object.__new__(bridge.Desktop)
        self.d.u = FakeUser()
        self.d.guard = mock.Mock()
        self.d.point = mock.Mock(side_effect=lambda ident, point: (100 + point[0], 100 + point[1]))
        self.d.move = mock.Mock()
        self.d.cursor_guard = mock.Mock()

    def write_session(self):
        self.session_path.write_text(json.dumps(self.session), encoding='utf-8')

    def args(self, **updates):
        values = dict(receipt=str(self.receipt_path), image_sha256=self.receipt['sha256'],
                      wait_pixels_ms=0, mouse_button='left', click=[60, 60], click_count=1,
                      drag=None, text=None, review_region=None, editor_text_field=None)
        values.update(updates)
        return SimpleNamespace(**values)

    def call_act(self, args):
        with contextlib.redirect_stdout(io.StringIO()), mock.patch.object(bridge.time, 'sleep'):
            return bridge.act(args, self.d, {'started': False})

    def assert_rejected_without_input(self, args, message):
        with self.assertRaisesRegex(RuntimeError, message):
            self.call_act(args)
        self.assertEqual(self.d.u.calls, [])
        self.assertFalse((self.receipt_path.parent / 'consumed.json').exists())

    def popup_desktop(self, owner_delta=None, observed_owner=201):
        owner = {**self.ident, 'hwnd': 201, 'title': 'Owner'}
        popup = {**self.ident, 'title': ''}
        session = {**popup, 'kind': 'editor-navigation', 'owner_identity': owner}
        observed = {**owner, **(owner_delta or {})}
        d = object.__new__(bridge.Desktop)
        d.u = SimpleNamespace(GetWindow=mock.Mock(return_value=observed_owner),
                             EnumWindows=mock.Mock(side_effect=AssertionError('Must use pinned HWND')))
        d.identity = mock.Mock(side_effect=lambda hwnd: dict(popup if hwnd == 101 else observed))
        return d, session, popup

    def test_popup_uses_exact_pinned_handle_with_nonunique_title(self):
        d, session, popup = self.popup_desktop()
        self.assertEqual(d.resolve(session), popup)
        d.u.GetWindow.assert_called_once_with(101, 4)
        d.u.EnumWindows.assert_not_called()

    def test_popup_rejects_replaced_owner_relationship(self):
        d, session, unused = self.popup_desktop(observed_owner=999)
        with self.assertRaisesRegex(RuntimeError, 'owner relationship changed'):
            d.resolve(session)

    def test_popup_rejects_changed_owner_identity_or_geometry(self):
        for change in ({'pid': 43}, {'process_created': 901}, {'window_rect': [0, 0, 200, 120]}):
            with self.subTest(change=change):
                d, session, unused = self.popup_desktop(owner_delta=change)
                with self.assertRaisesRegex(RuntimeError, 'owner identity or geometry changed'):
                    d.resolve(session)

    def test_partial_right_click_releases_right_button_and_reports_uncertainty(self):
        self.d.u = FakeUser(partial_first=True)
        with self.assertRaises(SystemExit) as stopped:
            self.call_act(self.args(mouse_button='right'))
        self.assertEqual(stopped.exception.code, 2)
        self.assertEqual(self.d.u.calls, [[('mouse', 8), ('mouse', 16)], [('mouse', 16)]])
        result = json.loads((self.receipt_path.parent / 'action-result.json').read_text())
        self.assertEqual(result['status'], 'FAILED_OR_UNCERTAIN')
        self.assertIsNone(result['cleanup_error'])

    def test_right_double_click_and_right_drag_reject_before_input(self):
        for updates in ({'click_count': 2}, {'click': None, 'drag': [20, 20, 80, 80]}):
            with self.subTest(updates=updates):
                self.assert_rejected_without_input(self.args(mouse_button='right', **updates),
                                                   'Right button permits exactly one click')

    def test_editor_text_requires_explicit_field_and_rejects_popup_text(self):
        self.assert_rejected_without_input(self.args(click=None, text='Probe'), 'explicitly reviewed active field')
        self.session['owner_identity'] = {'hwnd': 201}
        self.write_session()
        self.assert_rejected_without_input(self.args(click=None, text='Probe',
                                                     editor_text_field=[40, 30, 120, 55]),
                                           'popup text input is not enabled')

    def test_editor_text_rejects_controls_non_ascii_and_oversized_literal(self):
        for text in ('Probe\n', 'Probe\t', 'Probe\x1b', 'Probe\x7f', 'Pr\u00f6be', 'A' * 101):
            with self.subTest(text=repr(text)):
                self.assert_rejected_without_input(self.args(click=None, text=text,
                    editor_text_field=[40, 30, 120, 55]), '1-100 printable ASCII')

    def test_editor_field_must_fit_image_and_reviewed_region(self):
        for field, region, message in (([-1, 30, 120, 55], None, 'outside captured image'),
                                       ([40, 30, 190, 55], [0, 0, 180, 120], 'complete editor text field')):
            with self.subTest(field=field):
                self.assert_rejected_without_input(self.args(click=None, text='Probe',
                    editor_text_field=field, review_region=region), message)

    def test_literal_text_sends_only_unicode_pairs_without_modifier_or_extra_up(self):
        self.call_act(self.args(click=None, text='Ab9_-', editor_text_field=[40, 30, 120, 55]))
        self.assertEqual(self.d.u.calls,
                         [[('key', 0, ord(c), 4), ('key', 0, ord(c), 6)] for c in 'Ab9_-'])

    def test_partial_unicode_pair_attempts_matching_key_release(self):
        self.d.u = FakeUser(partial_first=True)
        with self.assertRaises(SystemExit):
            self.call_act(self.args(click=None, text='A', editor_text_field=[40, 30, 120, 55]))
        self.assertEqual(self.d.u.calls,
                         [[('key', 0, 65, 4), ('key', 0, 65, 6)], [('key', 0, 65, 6)]])

    def pixel_wait(self, frames, wait_ms, initial_age=0, guard_effect=None, grab_advance=0):
        clock = FakeClock()
        receipt = {**self.receipt, 'created_utc': (clock.base - timedelta(seconds=initial_age)).isoformat()}
        self.d.guard.side_effect = guard_effect
        iterator = iter(frames)
        last = frames[-1]

        def grab(**unused):
            clock.elapsed += grab_advance
            return next(iterator, last).copy()

        with mock.patch.object(bridge.time, 'monotonic', clock.monotonic), \
             mock.patch.object(bridge.time, 'sleep', clock.sleep), \
             mock.patch.object(bridge, 'datetime', SimpleNamespace(now=clock.now,
                                            fromisoformat=datetime.fromisoformat)), \
             mock.patch.object(bridge.ImageGrab, 'grab', side_effect=grab) as capture:
            result = bridge.wait_reviewed_pixels(self.d, self.ident, self.session,
                                                 receipt, self.png, None, wait_ms)
            return result, capture.call_count, clock.elapsed

    def test_pixel_wait_accepts_only_exact_pixels_after_caret_phase_returns(self):
        result, count, elapsed = self.pixel_wait([self.changed, self.changed, self.expected], 200)
        self.assertEqual(count, 3)
        self.assertEqual(result['samples'], 3)
        self.assertAlmostEqual(elapsed, .1)
        self.assertEqual(self.d.guard.call_count, 6)
        self.assertEqual(self.d.u.calls, [])

    def test_persistent_single_pixel_change_never_passes_wait_budget(self):
        for budget in (0, 200, 1200):
            with self.subTest(budget=budget), self.assertRaisesRegex(RuntimeError, 'Visible client changed'):
                self.pixel_wait([self.changed], budget)
        self.assertEqual(self.d.u.calls, [])

    def test_focus_change_before_next_frame_or_during_exact_capture_rejects(self):
        for effects, frames in (([None, None, RuntimeError('Focus changed')], [self.changed, self.expected]),
                                ([None, RuntimeError('Focus changed')], [self.expected])):
            with self.subTest(effects=len(effects)), self.assertRaisesRegex(RuntimeError, 'Focus changed'):
                self.pixel_wait(frames, 200, guard_effect=effects)
        self.assertEqual(self.d.u.calls, [])

    def test_receipt_expiry_while_waiting_or_capturing_rejects(self):
        for age, advance, frames in ((119.975, 0, [self.changed, self.expected]),
                                    (119.99, .02, [self.expected])):
            with self.subTest(age=age), self.assertRaisesRegex(RuntimeError, 'Capture expired'):
                self.pixel_wait(frames, 200, initial_age=age, grab_advance=advance)
        self.assertEqual(self.d.u.calls, [])

    def test_out_of_range_pixel_wait_rejects_before_capture_or_input(self):
        for value in (-1, 1201):
            with self.subTest(value=value):
                self.grab.reset_mock()
                self.assert_rejected_without_input(self.args(wait_pixels_ms=value), '0 and 1200')
                self.grab.assert_not_called()


if __name__ == '__main__':
    print('MOCK_ONLY: synthetic files and mocked capture/SendInput; no desktop access.', flush=True)
    unittest.main(verbosity=2)
