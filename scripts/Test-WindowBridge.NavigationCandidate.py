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
                                           Path(__file__).with_name('WindowBridge.NavigationCandidate.py'))
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
                parsed.append(('wheel', bridge.C.c_int32(event.data.mi.mouseData).value)
                              if event.data.mi.flags == 0x0800 else ('mouse', event.data.mi.flags))
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

    def child_desktop(self):
        child = {**self.ident, 'hwnd': 301, 'title': 'Explicit foreground child', 'tid': 8}
        middle = {**self.ident, 'hwnd': 201, 'title': 'Intermediate owner'}
        identities = {101: dict(self.ident), 201: middle, 301: child}
        owners = {301: 201, 201: 101, 101: 0}
        d = object.__new__(bridge.Desktop)
        d.u = SimpleNamespace(GetWindow=mock.Mock(side_effect=lambda hwnd, flag: owners[hwnd]),
                             GetForegroundWindow=mock.Mock(return_value=301),
                             GetAsyncKeyState=mock.Mock(return_value=0))
        d.identity = mock.Mock(side_effect=lambda hwnd: dict(identities[hwnd]))
        d.focus = mock.Mock(side_effect=lambda ident: ident['hwnd'])
        session = {**self.session, 'foreground_child_chain': [dict(child), dict(middle), dict(self.ident)],
                   'foreground_child_focus_hwnd': 301}
        return d, session, identities, owners

    def test_child_chain_pins_each_owner_and_accepts_only_exact_foreground(self):
        d, session, identities, owners = self.child_desktop()
        self.assertEqual(d.foreground_owner_chain(self.ident, 301), session['foreground_child_chain'])
        d.guard(self.ident, session, focus=101)
        self.assertTrue(all(call.args[1] == 4 for call in d.u.GetWindow.call_args_list))
        d.u.GetForegroundWindow.return_value = 101
        with self.assertRaisesRegex(RuntimeError, 'not foreground'):
            d.guard(self.ident, session, focus=101)

    def test_default_binding_still_rejects_an_owned_foreground_child(self):
        d, unused, identities, owners = self.child_desktop()
        with self.assertRaisesRegex(RuntimeError, 'Foreground changed'):
            d.guard(self.ident, self.session, focus=101)

    def test_child_chain_rejects_other_process_reused_process_or_changed_geometry(self):
        changes = ({'pid': 43}, {'process_created': 901}, {'process': 'other.exe'},
                   {'window_rect': [0, 0, 200, 120]}, {'title': 'Changed'}, {'tid': 9})
        for change in changes:
            with self.subTest(change=change):
                d, session, identities, owners = self.child_desktop()
                identities[201].update(change)
                with self.assertRaisesRegex(RuntimeError, 'process identity|identity or geometry changed'):
                    d.resolve(session)

    def test_child_chain_rejects_changed_link_cycle_missing_target_and_depth(self):
        for changed_owners in ({301: 101}, {201: 301}, {201: 0}):
            with self.subTest(owners=changed_owners):
                d, session, identities, owners = self.child_desktop()
                owners.update(changed_owners)
                with self.assertRaisesRegex(RuntimeError, 'chain'):
                    d.resolve(session)
        d, session, identities, owners = self.child_desktop()
        d.identity.side_effect = lambda hwnd: {**self.ident, 'hwnd': hwnd}
        d.u.GetWindow.side_effect = lambda hwnd, flag: hwnd + 1
        with self.assertRaisesRegex(RuntimeError, 'bounded depth'):
            d.foreground_owner_chain(self.ident, 301)
        self.assertEqual(d.identity.call_count, bridge.MAX_OWNER_CHAIN)

    def test_child_chain_accepts_exactly_eight_identity_nodes(self):
        d, session, identities, owners = self.child_desktop()
        handles = list(range(301, 301 + bridge.MAX_OWNER_CHAIN - 1)) + [101]
        d.identity.side_effect = lambda hwnd: {**self.ident, 'hwnd': hwnd}
        mapping = dict(zip(handles, handles[1:]))
        d.u.GetWindow.side_effect = lambda hwnd, flag: mapping[hwnd]
        self.assertEqual([item['hwnd'] for item in d.foreground_owner_chain(self.ident, 301)], handles)

    def test_child_chain_rejects_self_hidden_child_mixed_popup_and_focus_changes(self):
        d, session, identities, owners = self.child_desktop()
        with self.assertRaisesRegex(RuntimeError, 'differ from target'):
            d.foreground_owner_chain(self.ident, 101)
        d.identity.side_effect = RuntimeError('Target absent, hidden or minimized')
        with self.assertRaisesRegex(RuntimeError, 'hidden'):
            d.foreground_owner_chain(self.ident, 301)
        d, session, identities, owners = self.child_desktop()
        session['owner_identity'] = identities[201]
        with self.assertRaisesRegex(RuntimeError, 'Invalid foreground child session'):
            d.resolve(session)
        del session['owner_identity']
        d.focus.side_effect = lambda ident: 999 if ident['hwnd'] == 301 else 101
        with self.assertRaisesRegex(RuntimeError, 'child focus changed'):
            d.guard(self.ident, session, focus=101)
        d.focus.side_effect = lambda ident: 301 if ident['hwnd'] == 301 else 999
        with self.assertRaisesRegex(RuntimeError, 'Focus changed'):
            d.guard(self.ident, session, focus=101)

    def test_child_chain_retains_physical_key_and_occlusion_checks(self):
        d, session, identities, owners = self.child_desktop()
        d.u.GetAsyncKeyState.side_effect = lambda vk: 0x8000 if vk == 16 else 0
        with self.assertRaisesRegex(RuntimeError, 'key or mouse button is held'):
            d.guard(self.ident, session, focus=101)
        d.u.WindowFromPoint = mock.Mock(return_value=301)
        d.u.GetAncestor = mock.Mock(return_value=301)
        with self.assertRaisesRegex(RuntimeError, 'occluded'):
            d.point(self.ident, (60, 60))

    def test_child_session_rejects_text_drag_and_double_click_before_input(self):
        unused, self.session, identities, owners = self.child_desktop()
        self.write_session()
        for updates in ({'click': None, 'text': 'Probe', 'editor_text_field': [40, 30, 120, 55]},
                        {'click': None, 'drag': [20, 20, 80, 80]}, {'click_count': 2}):
            with self.subTest(updates=updates):
                self.assert_rejected_without_input(self.args(**updates), 'one single click only')

    def test_child_single_click_closes_session_and_requires_normal_rebind_without_capture(self):
        unused, self.session, identities, owners = self.child_desktop()
        self.write_session()
        original_send = self.d.send
        def checked_send(events):
            self.assertTrue((self.folder / 'closed.json').exists())
            return original_send(events)
        with mock.patch.object(self.d, 'send', side_effect=checked_send):
            self.call_act(self.args())
        self.assertEqual(self.d.u.calls, [[('mouse', 2), ('mouse', 4)]])
        bridge.capture.assert_not_called()
        self.assertTrue((self.folder / 'closed.json').exists())
        result = json.loads((self.receipt_path.parent / 'action-result.json').read_text())
        self.assertEqual(result['next_step'], 'FRESH_NORMAL_BIND_REQUIRED')
        with self.assertRaisesRegex(RuntimeError, 'closed scratch session'):
            bridge.read_session(self.session_path)

    def test_child_uncertain_click_closes_session_and_only_releases_pending_button(self):
        unused, self.session, identities, owners = self.child_desktop()
        self.write_session()
        self.d.u = FakeUser(partial_first=True)
        with self.assertRaises(SystemExit):
            self.call_act(self.args())
        self.assertEqual(self.d.u.calls, [[('mouse', 2), ('mouse', 4)], [('mouse', 4)]])
        self.assertTrue((self.folder / 'closed.json').exists())
        bridge.capture.assert_not_called()

    def test_child_pixel_mismatch_does_not_consume_session_or_send_input(self):
        unused, self.session, identities, owners = self.child_desktop()
        self.write_session()
        self.grab.return_value = self.changed
        self.assert_rejected_without_input(self.args(), 'Visible client changed')
        self.assertFalse((self.folder / 'closed.json').exists())

    def test_bind_child_cli_persists_chain_and_flags_are_mutually_exclusive(self):
        d, session, identities, owners = self.child_desktop()
        command = ['WindowBridge.py', 'bind-editor', '--title', self.ident['title'],
                   '--pid', '42', '--hwnd', '101', '--foreground-child-hwnd', '301']
        with mock.patch.object(bridge.sys, 'argv', command), \
             mock.patch.object(bridge, 'Desktop', return_value=d), contextlib.redirect_stdout(io.StringIO()):
            bridge.main()
        bound = bridge.capture.call_args.args[2]
        self.assertEqual(bound['foreground_child_chain'], session['foreground_child_chain'])
        self.assertEqual(bound['foreground_child_focus_hwnd'], 301)
        with mock.patch.object(bridge.sys, 'argv', command + ['--owner-hwnd', '201']), \
             contextlib.redirect_stderr(io.StringIO()), self.assertRaises(SystemExit) as rejected:
            bridge.main()
        self.assertEqual(rejected.exception.code, 2)

    def prepare_maximize(self, observed_maximized=True):
        self.ident['maximized'] = False
        self.session.update(maximized=False, created_utc=bridge.now())
        self.write_session()
        after = {**self.ident, 'maximized': observed_maximized,
                 'window_rect': [0, 0, 400, 300], 'client_rect': [0, 0, 400, 280]}
        self.d.resolve = mock.Mock(return_value=dict(self.ident))
        self.d.identity = mock.Mock(return_value=after)
        self.d.focus = mock.Mock(return_value=101)
        self.d.placement = mock.Mock(side_effect=[{'normal_position': [90, 80, 310, 230], 'show_command': 1},
                                                {'normal_position': [90, 80, 310, 230], 'show_command': 3}])
        def show(hwnd, command):
            self.assertTrue((self.folder / 'closed.json').exists())
            self.assertTrue((self.folder / 'maximize-result.json').exists())
            self.assertEqual((hwnd, command), (101, 3))
            return 0  # The previous-visibility return is deliberately not success.
        self.d.u.ShowWindow = mock.Mock(side_effect=show)

    def call_maximize(self):
        with contextlib.redirect_stdout(io.StringIO()):
            bridge.maximize(self.d, self.session_path, self.session)

    def test_maximize_records_placement_calls_once_and_requires_new_bind_without_input(self):
        self.prepare_maximize()
        self.call_maximize()
        self.d.u.ShowWindow.assert_called_once_with(101, 3)
        self.assertEqual(self.d.u.calls, [])
        bridge.capture.assert_not_called()
        result = json.loads((self.folder / 'maximize-result.json').read_text())
        self.assertEqual(result['status'], 'MAXIMIZED_REQUIRES_REVIEW')
        self.assertFalse(result['show_window_previously_visible'])
        self.assertEqual(result['placement_before']['normal_position'], [90, 80, 310, 230])
        self.assertEqual(result['next_step'], 'FRESH_NORMAL_BIND_AND_CAPTURE_REQUIRED')
        with self.assertRaisesRegex(RuntimeError, 'closed scratch session'):
            bridge.read_session(self.session_path)

    def test_maximize_rejects_non_normal_sessions_without_layout_call(self):
        self.prepare_maximize()
        for changes in ({'kind': 'scratch'}, {'owner_identity': {'hwnd': 201}},
                        {'foreground_child_chain': [{'hwnd': 301}]}):
            with self.subTest(changes=changes), mock.patch.dict(self.session, changes):
                with self.assertRaisesRegex(RuntimeError, 'normal editor binding'):
                    self.call_maximize()
        self.d.u.ShowWindow.assert_not_called()

    def test_maximize_rejects_expired_or_changed_binding_and_foreground_without_layout_call(self):
        self.prepare_maximize()
        with mock.patch.dict(self.session, {'created_utc': (datetime.now(timezone.utc)-timedelta(seconds=121)).isoformat()}):
            with self.assertRaisesRegex(RuntimeError, 'expired'):
                self.call_maximize()
        self.d.resolve.return_value = {**self.ident, 'title': 'Changed'}
        with self.assertRaisesRegex(RuntimeError, 'geometry changed since binding'):
            self.call_maximize()
        self.d.resolve.return_value = dict(self.ident)
        self.d.guard.side_effect = RuntimeError('Foreground changed')
        with self.assertRaisesRegex(RuntimeError, 'Foreground changed'):
            self.call_maximize()
        self.d.u.ShowWindow.assert_not_called()

    def test_maximize_does_not_treat_showwindow_return_as_success_or_retry(self):
        self.prepare_maximize(observed_maximized=False)
        with self.assertRaises(SystemExit) as rejected:
            self.call_maximize()
        self.assertEqual(rejected.exception.code, 2)
        self.d.u.ShowWindow.assert_called_once_with(101, 3)
        result = json.loads((self.folder / 'maximize-result.json').read_text())
        self.assertEqual(result['status'], 'LAYOUT_OUTCOME_UNCERTAIN')
        self.assertEqual(result['error'], 'Maximized state not observed')
        self.assertTrue((self.folder / 'closed.json').exists())

    def test_maximize_reports_changed_process_after_layout_without_followup_input(self):
        self.prepare_maximize()
        self.d.identity.return_value['process_created'] = 901
        with self.assertRaises(SystemExit):
            self.call_maximize()
        self.d.u.ShowWindow.assert_called_once_with(101, 3)
        self.assertEqual(self.d.u.calls, [])
        result = json.loads((self.folder / 'maximize-result.json').read_text())
        self.assertEqual(result['error'], 'Window identity changed during maximize')

    def test_partial_right_click_releases_right_button_and_reports_uncertainty(self):
        self.d.u = FakeUser(partial_first=True)
        with self.assertRaises(SystemExit) as stopped:
            self.call_act(self.args(mouse_button='right'))
        self.assertEqual(stopped.exception.code, 2)
        self.assertEqual(self.d.u.calls, [[('mouse', 8), ('mouse', 16)], [('mouse', 16)]])
        result = json.loads((self.receipt_path.parent / 'action-result.json').read_text())
        self.assertEqual(result['status'], 'FAILED_OR_UNCERTAIN')
        self.assertIsNone(result['cleanup_error'])

    def test_right_double_click_drag_count_two_and_text_reject_before_input(self):
        for updates in ({'click_count': 2}, {'click': None, 'drag': [20, 20, 80, 80], 'click_count': 2},
                        {'click': None, 'text': 'Probe'}):
            with self.subTest(updates=updates):
                self.assert_rejected_without_input(self.args(mouse_button='right', **updates),
                                                   'Right button permits one single click or one drag')

    def test_right_drag_sends_right_pair_checks_path_and_records_actual_button(self):
        self.call_act(self.args(click=None, drag=[20, 20, 80, 80], mouse_button='right'))
        self.assertEqual(self.d.u.calls, [[('mouse', 8)], [('mouse', 16)]])
        expected_path = [(20 + 3*i, 20 + 3*i) for i in range(21)]
        checked = [call.args[1] for call in self.d.point.call_args_list]
        self.assertEqual(checked[2:23], expected_path)
        held_guards = [call.kwargs for call in self.d.guard.call_args_list if call.kwargs.get('dragging')]
        self.assertEqual(held_guards, [{'dragging': True, 'mouse_button': 'right'}] * 21)
        evidence = json.loads((self.receipt_path.parent / 'consumed.json').read_text())
        self.assertEqual(evidence['mouse_button'], 'right')
        self.assertEqual(evidence['action'], 'drag')

    def test_left_drag_keeps_original_button_and_held_key(self):
        self.call_act(self.args(click=None, drag=[20, 20, 80, 80]))
        self.assertEqual(self.d.u.calls, [[('mouse', 2)], [('mouse', 4)]])
        held_guards = [call.kwargs for call in self.d.guard.call_args_list if call.kwargs.get('dragging')]
        self.assertEqual(held_guards, [{'dragging': True, 'mouse_button': 'left'}] * 21)

    def test_right_drag_ignores_only_right_button_during_held_phase(self):
        d, unused, identities, owners = self.child_desktop()
        d.u.GetForegroundWindow.return_value = 101
        for held in (1, 2, 16):
            d.u.GetAsyncKeyState.side_effect = lambda vk, held=held: 0x8000 if vk == held else 0
            if held == 2:
                d.guard(self.ident, self.session, dragging=True, mouse_button='right')
            else:
                with self.assertRaisesRegex(RuntimeError, 'key or mouse button is held'):
                    d.guard(self.ident, self.session, dragging=True, mouse_button='right')
            with self.assertRaisesRegex(RuntimeError, 'key or mouse button is held'):
                d.guard(self.ident, self.session, mouse_button='right')

    def test_right_drag_refuses_child_popup_and_scratch_modes(self):
        unused, child_session, identities, owners = self.child_desktop()
        for changes, message in (({'foreground_child_chain': child_session['foreground_child_chain']}, 'one single click'),
                                 ({'owner_identity': {'hwnd': 201}}, 'normal editor canvas')):
            with self.subTest(changes=changes), mock.patch.dict(self.session, changes):
                self.write_session()
                self.assert_rejected_without_input(self.args(click=None, drag=[20, 20, 80, 80],
                                                             mouse_button='right'), message)
        with mock.patch.object(bridge, 'read_session', return_value=(self.session_path, {'kind': 'scratch'})):
            self.assert_rejected_without_input(self.args(click=None, drag=[20, 20, 80, 80],
                                                         mouse_button='right'), 'normal editor canvas')

    def test_right_drag_path_occlusion_before_press_sends_no_input(self):
        self.d.point.side_effect = lambda ident, point: (_ for _ in ()).throw(RuntimeError('Point is occluded')) \
            if point == (50, 50) else (100 + point[0], 100 + point[1])
        with self.assertRaises(SystemExit):
            self.call_act(self.args(click=None, drag=[20, 20, 80, 80], mouse_button='right'))
        self.assertEqual(self.d.u.calls, [])

    def test_right_drag_guard_failure_after_down_releases_only_right_button(self):
        def guard(*args, **kwargs):
            if kwargs.get('dragging'):
                raise RuntimeError('Foreground changed during drag')
        self.d.guard.side_effect = guard
        with self.assertRaises(SystemExit):
            self.call_act(self.args(click=None, drag=[20, 20, 80, 80], mouse_button='right'))
        self.assertEqual(self.d.u.calls, [[('mouse', 8)], [('mouse', 16)]])
        result = json.loads((self.receipt_path.parent / 'action-result.json').read_text())
        self.assertEqual(result['status'], 'FAILED_OR_UNCERTAIN')
        self.assertIsNone(result['cleanup_error'])

    def test_uncertain_right_drag_down_attempts_right_release_without_replay(self):
        original = self.d.send
        def uncertain(events):
            original(events)
            if len(self.d.u.calls) == 1:
                raise RuntimeError('Input outcome uncertain')
        with mock.patch.object(self.d, 'send', side_effect=uncertain), self.assertRaises(SystemExit):
            self.call_act(self.args(click=None, drag=[20, 20, 80, 80], mouse_button='right'))
        self.assertEqual(self.d.u.calls, [[('mouse', 8)], [('mouse', 16)]])

    def test_right_drag_pixel_mismatch_rejects_before_input(self):
        self.grab.return_value = self.changed
        self.assert_rejected_without_input(self.args(click=None, drag=[20, 20, 80, 80],
                                                     mouse_button='right'), 'Visible client changed')

    def test_scroll_sends_one_signed_wheel_event_and_records_point_notches(self):
        self.call_act(self.args(click=None, scroll=[60, 60, -3]))
        self.assertEqual(self.d.u.calls, [[('wheel', -360)]])
        self.d.move.assert_called_once_with((160, 160))
        self.d.cursor_guard.assert_called_once_with(self.ident, (160, 160))
        evidence = json.loads((self.receipt_path.parent / 'consumed.json').read_text())
        self.assertEqual(evidence['action'], 'scroll')
        self.assertEqual(evidence['scroll'], [60, 60, -3])
        self.assertEqual(bridge.wheel(2).data.mi.mouseData, 240)

    def test_scroll_rejects_zero_large_fractional_notches_and_combined_count(self):
        for notches in (0, -4, 4, 1.5, True):
            with self.subTest(notches=notches):
                self.assert_rejected_without_input(self.args(click=None, scroll=[60, 60, notches]),
                                                   'signed integer notches')
        self.assert_rejected_without_input(self.args(click=None, scroll=[60, 60, -1], click_count=2),
                                           'cannot combine')

    def test_scroll_and_escape_refuse_non_normal_editor_modes(self):
        for changes in ({'owner_identity': {'hwnd': 201}}, {'foreground_child_chain': [{'hwnd': 301}]}):
            with self.subTest(changes=changes), mock.patch.dict(self.session, changes):
                self.write_session()
                self.assert_rejected_without_input(self.args(click=None, scroll=[60, 60, -1]),
                                                   'normal foreground editor binding')
                self.assert_rejected_without_input(self.args(click=None, escape=True, escape_popup=[40, 30, 120, 80]),
                                                   'normal foreground editor binding')
        with mock.patch.object(bridge, 'read_session', return_value=(self.session_path, {'kind': 'scratch'})):
            self.assert_rejected_without_input(self.args(click=None, scroll=[60, 60, -1]),
                                               'normal foreground editor binding')

    def test_scroll_preserves_pixel_point_and_last_focus_checks(self):
        args = self.args(click=None, scroll=[60, 60, -1])
        self.grab.return_value = self.changed
        self.assert_rejected_without_input(args, 'Visible client changed')
        self.grab.return_value = self.expected
        self.d.point.side_effect = RuntimeError('Point is occluded')
        self.assert_rejected_without_input(args, 'Point is occluded')
        self.d.point.side_effect = lambda ident, point: (100 + point[0], 100 + point[1])
        self.d.move.side_effect = lambda xy: setattr(self.d.guard, 'side_effect', RuntimeError('Focus changed'))
        with self.assertRaises(SystemExit):
            self.call_act(args)
        self.assertEqual(self.d.u.calls, [])

    def test_uncertain_wheel_is_never_retried_or_followed_by_a_button(self):
        original = self.d.send
        def uncertain(events):
            original(events)
            raise RuntimeError('Input outcome uncertain')
        with mock.patch.object(self.d, 'send', side_effect=uncertain), self.assertRaises(SystemExit):
            self.call_act(self.args(click=None, scroll=[60, 60, -1]))
        self.assertEqual(self.d.u.calls, [[('wheel', -120)]])

    def test_escape_requires_reviewed_popup_and_sends_only_vk_escape_pair(self):
        self.assert_rejected_without_input(self.args(click=None, escape=True), 'explicit reviewed popup')
        self.assert_rejected_without_input(self.args(click=None, escape_popup=[40, 30, 120, 80]),
                                           'explicit reviewed popup')
        self.call_act(self.args(click=None, escape=True, escape_popup=[40, 30, 120, 80]))
        self.assertEqual(self.d.u.calls, [[('key', 27, 0, 0), ('key', 27, 0, 2)]])
        self.d.move.assert_not_called()
        evidence = json.loads((self.receipt_path.parent / 'consumed.json').read_text())
        self.assertEqual(evidence['action'], 'escape')
        self.assertEqual(evidence['escape_popup'], [40, 30, 120, 80])

    def test_escape_partial_pair_releases_only_escape_without_replay(self):
        self.d.u = FakeUser(partial_first=True)
        with self.assertRaises(SystemExit):
            self.call_act(self.args(click=None, escape=True, escape_popup=[40, 30, 120, 80]))
        self.assertEqual(self.d.u.calls, [[('key', 27, 0, 0), ('key', 27, 0, 2)], [('key', 27, 0, 2)]])

    def test_escape_rejects_unreviewed_popup_extent_and_pixel_change(self):
        self.assert_rejected_without_input(self.args(click=None, escape=True, escape_popup=[-1, 30, 120, 80]),
                                           'popup inside reviewed image')
        self.assert_rejected_without_input(self.args(click=None, escape=True, escape_popup=[20, 20, 190, 80],
                                                     review_region=[0, 0, 180, 120]), 'complete Escape popup')
        self.grab.return_value = self.changed
        self.assert_rejected_without_input(self.args(click=None, escape=True, escape_popup=[40, 30, 120, 80]),
                                           'Visible client changed')

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
