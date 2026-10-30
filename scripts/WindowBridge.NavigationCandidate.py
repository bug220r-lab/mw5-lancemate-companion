"""One-shot Windows input proof for a scratch fixture or pinned editor navigation.

No game targets, network listener, focus stealing or arbitrary key chords.
Editor text requires an explicitly reviewed active-field rectangle; no key chords,
clipboard paste or asset-authoring API. Slate field focus still needs visual review.
Capture first, visually review its PNG, then explicitly supply that image hash.
Pointer coordinates are relative to that screenshot, not the native client origin.
An explicitly pinned foreground owned window permits one click on its owner;
that session then closes and requires a fresh normal binding.
"""
import argparse
import ctypes as C
from ctypes import wintypes as W
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import sys
import time
import uuid

from PIL import Image, ImageGrab

ROOT = Path(__file__).resolve().parents[1]
EVIDENCE = ROOT / 'research' / 'evidence' / 'window-bridge'
EDITOR = Path('C:/Program Files/Epic Games/MechWarrior5Editor/Engine/Binaries/Win64/UE4Editor.exe')
MAX_OWNER_CHAIN = 8


def now():
    return datetime.now(timezone.utc).isoformat()


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def contained(path):
    path = Path(path).resolve(strict=True)
    base = EVIDENCE.resolve()
    if not base.is_relative_to(ROOT.resolve()) or not path.is_relative_to(base):
        raise RuntimeError('Only project scratch-fixture evidence is allowed')
    return path


class MONITORINFO(C.Structure):
    _fields_ = [('cbSize', W.DWORD), ('monitor', W.RECT),
                ('work', W.RECT), ('flags', W.DWORD)]


class GUITHREADINFO(C.Structure):
    _fields_ = [('cbSize', W.DWORD), ('flags', W.DWORD),
                ('active', W.HWND), ('focus', W.HWND), ('capture', W.HWND),
                ('menuOwner', W.HWND), ('moveSize', W.HWND),
                ('caret', W.HWND), ('caretRect', W.RECT)]


class WINDOWPLACEMENT(C.Structure):
    _fields_ = [('length', W.UINT), ('flags', W.UINT), ('showCmd', W.UINT),
                ('minPosition', W.POINT), ('maxPosition', W.POINT),
                ('normalPosition', W.RECT)]


class MOUSEINPUT(C.Structure):
    _fields_ = [('dx', W.LONG), ('dy', W.LONG), ('mouseData', W.DWORD),
                ('flags', W.DWORD), ('time', W.DWORD), ('extra', C.c_size_t)]


class KEYBDINPUT(C.Structure):
    _fields_ = [('vk', W.WORD), ('scan', W.WORD), ('flags', W.DWORD),
                ('time', W.DWORD), ('extra', C.c_size_t)]


class INPUTUNION(C.Union):
    _fields_ = [('mi', MOUSEINPUT), ('ki', KEYBDINPUT)]


class INPUT(C.Structure):
    _fields_ = [('type', W.DWORD), ('data', INPUTUNION)]


def rect(r):
    return [r.left, r.top, r.right, r.bottom]


def encloses(outer, inner):
    return (outer[0] <= inner[0] < inner[2] <= outer[2]
            and outer[1] <= inner[1] < inner[3] <= outer[3])


class Desktop:
    def __init__(self, editor=False):
        self.editor = editor
        if sys.platform != 'win32':
            raise RuntimeError('Windows only')
        self.u = C.WinDLL('user32', use_last_error=True)
        self.k = C.WinDLL('kernel32', use_last_error=True)
        def bind(dll, name, args, result):
            f = getattr(dll, name)
            f.argtypes, f.restype = args, result
            return f
        u, k = self.u, self.k
        bind(u, 'SetProcessDpiAwarenessContext', [W.HANDLE], W.BOOL)
        if not u.SetProcessDpiAwarenessContext(W.HANDLE(-4)):
            raise C.WinError(C.get_last_error())
        for n in ('IsWindow', 'IsWindowVisible', 'IsIconic', 'IsZoomed'):
            bind(u, n, [W.HWND], W.BOOL)
        bind(u, 'GetWindowTextW', [W.HWND, W.LPWSTR, C.c_int], C.c_int)
        bind(u, 'GetWindowThreadProcessId', [W.HWND, C.POINTER(W.DWORD)], W.DWORD)
        for n in ('GetWindowRect', 'GetClientRect'):
            bind(u, n, [W.HWND, C.POINTER(W.RECT)], W.BOOL)
        bind(u, 'ClientToScreen', [W.HWND, C.POINTER(W.POINT)], W.BOOL)
        bind(u, 'GetForegroundWindow', [], W.HWND)
        bind(u, 'GetGUIThreadInfo', [W.DWORD, C.POINTER(GUITHREADINFO)], W.BOOL)
        bind(u, 'MonitorFromWindow', [W.HWND, W.DWORD], W.HANDLE)
        bind(u, 'GetMonitorInfoW', [W.HANDLE, C.POINTER(MONITORINFO)], W.BOOL)
        bind(u, 'WindowFromPoint', [W.POINT], W.HWND)
        bind(u, 'GetAncestor', [W.HWND, W.UINT], W.HWND)
        bind(u, 'GetWindow', [W.HWND, W.UINT], W.HWND)
        bind(u, 'GetWindowPlacement', [W.HWND, C.POINTER(WINDOWPLACEMENT)], W.BOOL)
        bind(u, 'ShowWindow', [W.HWND, C.c_int], W.BOOL)
        bind(u, 'SetCursorPos', [C.c_int, C.c_int], W.BOOL)
        bind(u, 'GetCursorPos', [C.POINTER(W.POINT)], W.BOOL)
        bind(u, 'GetAsyncKeyState', [C.c_int], C.c_short)
        bind(u, 'SendInput', [W.UINT, C.POINTER(INPUT), C.c_int], W.UINT)
        bind(k, 'OpenProcess', [W.DWORD, W.BOOL, W.DWORD], W.HANDLE)
        bind(k, 'QueryFullProcessImageNameW', [W.HANDLE, W.DWORD, W.LPWSTR, C.POINTER(W.DWORD)], W.BOOL)
        bind(k, 'GetProcessTimes', [W.HANDLE] + [C.POINTER(W.FILETIME)] * 4, W.BOOL)
        bind(k, 'CloseHandle', [W.HANDLE], W.BOOL)
        self.callback_type = C.WINFUNCTYPE(W.BOOL, W.HWND, W.LPARAM)
        bind(u, 'EnumWindows', [self.callback_type, W.LPARAM], W.BOOL)

    def identity(self, hwnd):
        u, k = self.u, self.k
        if not u.IsWindow(hwnd) or not u.IsWindowVisible(hwnd) or u.IsIconic(hwnd):
            raise RuntimeError('Target absent, hidden or minimized')
        title = C.create_unicode_buffer(32768)
        u.GetWindowTextW(hwnd, title, len(title))
        pid = W.DWORD()
        tid = u.GetWindowThreadProcessId(hwnd, C.byref(pid))
        if not tid:
            raise C.WinError(C.get_last_error())
        p = k.OpenProcess(0x1000, False, pid.value)
        if not p:
            raise C.WinError(C.get_last_error())
        try:
            path = C.create_unicode_buffer(32768)
            size = W.DWORD(len(path))
            times = [W.FILETIME() for _ in range(4)]
            if not k.QueryFullProcessImageNameW(p, 0, path, C.byref(size)):
                raise C.WinError(C.get_last_error())
            if not k.GetProcessTimes(p, *(C.byref(t) for t in times)):
                raise C.WinError(C.get_last_error())
        finally:
            k.CloseHandle(p)
        wr, cr = W.RECT(), W.RECT()
        if not u.GetWindowRect(hwnd, C.byref(wr)) or not u.GetClientRect(hwnd, C.byref(cr)):
            raise C.WinError(C.get_last_error())
        p1, p2 = W.POINT(cr.left, cr.top), W.POINT(cr.right, cr.bottom)
        if not u.ClientToScreen(hwnd, C.byref(p1)) or not u.ClientToScreen(hwnd, C.byref(p2)):
            raise C.WinError(C.get_last_error())
        mi = MONITORINFO(cbSize=C.sizeof(MONITORINFO))
        monitor = u.MonitorFromWindow(hwnd, 0)
        if not monitor or not u.GetMonitorInfoW(monitor, C.byref(mi)):
            raise RuntimeError('No valid monitor for target')
        client = [p1.x, p1.y, p2.x, p2.y]
        native_client = list(client)
        maximized = bool(u.IsZoomed(hwnd))
        if self.editor:
            # UE4 draws its own frame and need not set IsZoomed. Record the full
            # native geometry, but capture/input only its intersection with ONE work area.
            work = rect(mi.work)
            client = [max(client[0], work[0]), max(client[1], work[1]),
                      min(client[2], work[2]), min(client[3], work[3])]
        if not encloses(rect(mi.work), client if self.editor else rect(wr)):
            raise RuntimeError('Captured window/client must fit inside one monitor work area')
        return {'hwnd': int(hwnd), 'pid': pid.value, 'tid': tid,
                'process': str(Path(path.value).resolve()), 'title': title.value,
                'process_created': times[0].dwHighDateTime << 32 | times[0].dwLowDateTime,
                'window_rect': rect(wr), 'client_rect': client,
                'native_client_rect': native_client, 'maximized': maximized,
                'monitor': rect(mi.monitor), 'work_area': rect(mi.work)}

    def foreground_owner_chain(self, target, child_hwnd):
        # GW_OWNER, not parent/ancestry or a last-active-popup heuristic. Every
        # visible link must belong to this exact editor process incarnation.
        if not child_hwnd or child_hwnd == target['hwnd']:
            raise RuntimeError('Foreground child must differ from target')
        if self.u.GetForegroundWindow() != child_hwnd:
            raise RuntimeError('Observed foreground child is not foreground')
        chain, seen, hwnd = [], set(), child_hwnd
        for unused in range(MAX_OWNER_CHAIN):
            if not hwnd or hwnd in seen:
                raise RuntimeError('Foreground owner chain is broken or cyclic')
            seen.add(hwnd)
            current = self.identity(hwnd)
            if any(current[field] != target[field]
                   for field in ('pid', 'process', 'process_created')):
                raise RuntimeError('Foreground owner chain crosses process identity')
            chain.append(current)
            if hwnd == target['hwnd']:
                if current != target:
                    raise RuntimeError('Owner target identity or geometry changed')
                return chain
            hwnd = int(self.u.GetWindow(hwnd, 4) or 0)
        raise RuntimeError('Foreground owner chain exceeds bounded depth')

    def placement(self, hwnd):
        placement = WINDOWPLACEMENT(length=C.sizeof(WINDOWPLACEMENT))
        if not self.u.GetWindowPlacement(hwnd, C.byref(placement)):
            raise C.WinError(C.get_last_error())
        return {'flags': placement.flags, 'show_command': placement.showCmd,
                'min_position': [placement.minPosition.x, placement.minPosition.y],
                'max_position': [placement.maxPosition.x, placement.maxPosition.y],
                'normal_position': rect(placement.normalPosition)}

    def resolve(self, session):
        if session.get('kind') == 'editor-navigation':
            # Slate menus can have empty/nonunique titles. Resolve only the
            # explicitly pinned handle, retaining exact identity checks.
            result = self.identity(session['hwnd'])
            fields = ('hwnd', 'pid', 'tid', 'process', 'title', 'process_created')
            if any(result[field] != session[field] for field in fields):
                raise RuntimeError('Editor window identity does not match session')
            owner = session.get('owner_identity')
            chain = session.get('foreground_child_chain')
            if chain is not None:
                if owner is not None or not isinstance(chain, list) or not 2 <= len(chain) <= MAX_OWNER_CHAIN:
                    raise RuntimeError('Invalid foreground child session')
                if self.foreground_owner_chain(result, chain[0]['hwnd']) != chain:
                    raise RuntimeError('Foreground owner chain identity or geometry changed')
                if self.focus(chain[0]) != session['foreground_child_focus_hwnd']:
                    raise RuntimeError('Foreground child focus changed; rebind')
            if owner is not None:
                if (not owner['hwnd'] or owner['hwnd'] == result['hwnd']
                        or any(owner[field] != result[field]
                               for field in ('pid', 'process', 'process_created'))):
                    raise RuntimeError('Invalid pinned editor popup owner')
                if int(self.u.GetWindow(result['hwnd'], 4) or 0) != owner['hwnd']:
                    raise RuntimeError('Editor popup owner relationship changed')
                if self.identity(owner['hwnd']) != owner:
                    raise RuntimeError('Editor popup owner identity or geometry changed')
            return result
        candidates, errors = [], []
        @self.callback_type
        def visit(hwnd, unused):
            try:
                t = C.create_unicode_buffer(32768)
                self.u.GetWindowTextW(hwnd, t, len(t))
                if t.value == session['title']:
                    candidates.append(self.identity(hwnd))
                return True
            except Exception as e:
                errors.append(e)
                return False
        ok = self.u.EnumWindows(visit, 0)
        if errors:
            raise errors[0]
        if not ok or len(candidates) != 1:
            raise RuntimeError('Expected exactly one visible scratch fixture')
        result = candidates[0]
        if (result['pid'] != session['pid'] or result['hwnd'] != session['hwnd']
                or Path(result['process']) != Path(session['process']).resolve()):
            raise RuntimeError('Fixture identity does not match session')
        if result['process_created'] != session['process_created']:
            raise RuntimeError('Process identity is stale')
        return result

    def focus(self, identity):
        g = GUITHREADINFO(cbSize=C.sizeof(GUITHREADINFO))
        if not self.u.GetGUIThreadInfo(identity['tid'], C.byref(g)):
            raise C.WinError(C.get_last_error())
        if g.flags & (2 | 4 | 8 | 16) or g.capture:
            raise RuntimeError('Menu, move/size or mouse capture is active')
        return int(g.focus or 0)

    def guard(self, identity, session, focus=None, dragging=False, mouse_button='left'):
        if self.resolve(session) != identity:
            raise RuntimeError('Window/process/geometry changed; recapture')
        owner = session.get('owner_identity') if session.get('kind') == 'editor-navigation' else None
        chain = session.get('foreground_child_chain') if session.get('kind') == 'editor-navigation' else None
        foreground = chain[0]['hwnd'] if chain is not None else owner['hwnd'] if owner is not None else identity['hwnd']
        if self.u.GetForegroundWindow() != foreground:
            raise RuntimeError('Foreground changed; operation refused')
        if focus is not None and self.focus(identity) != focus:
            raise RuntimeError('Focus changed; recapture')
        if mouse_button not in ('left', 'right'):
            raise RuntimeError('Unsupported held mouse button')
        ignored = {2 if mouse_button == 'right' else 1} if dragging else set()
        if any(self.u.GetAsyncKeyState(vk) & 0x8000 for vk in range(1, 256) if vk not in ignored):
            raise RuntimeError('A key or mouse button is held; stop')

    def point(self, identity, xy):
        l, t, r, b = identity['client_rect']
        x, y = xy
        if not (1 <= x < r-l-1 and 1 <= y < b-t-1):
            raise RuntimeError('Point outside captured image')
        screen = (l+x, t+y)
        actual = self.u.WindowFromPoint(W.POINT(*screen))
        if not actual or self.u.GetAncestor(actual, 2) != identity['hwnd']:
            raise RuntimeError('Point is occluded or belongs to a different window')
        return screen

    def move(self, xy):
        if not self.u.SetCursorPos(*xy):
            raise C.WinError(C.get_last_error())
        p = W.POINT()
        if not self.u.GetCursorPos(C.byref(p)) or (p.x, p.y) != xy:
            raise RuntimeError('Cursor was clipped or moved; stop')

    def send(self, events):
        a = (INPUT * len(events))(*events)
        n = self.u.SendInput(len(events), a, C.sizeof(INPUT))
        if n != len(events):
            raise RuntimeError(f'Input outcome uncertain: inserted {n}/{len(events)}')

    def cursor_guard(self, identity, expected):
        p = W.POINT()
        if not self.u.GetCursorPos(C.byref(p)) or (p.x, p.y) != expected:
            raise RuntimeError('Cursor moved before button input; stop')
        target = self.u.WindowFromPoint(p)
        if not target or self.u.GetAncestor(target, 2) != identity['hwnd']:
            raise RuntimeError('Cursor is over a different window; stop')


def mouse(flag):
    return INPUT(type=0, data=INPUTUNION(mi=MOUSEINPUT(flags=flag)))


def key(scan, up=False):
    return INPUT(type=1, data=INPUTUNION(ki=KEYBDINPUT(scan=scan, flags=4 | (2 if up else 0))))


def escape_key(up=False):
    return INPUT(type=1, data=INPUTUNION(ki=KEYBDINPUT(vk=0x1B, flags=2 if up else 0)))


def wheel(notches):
    return INPUT(type=0, data=INPUTUNION(mi=MOUSEINPUT(mouseData=notches * 120, flags=0x0800)))


def read_session(path):
    path = contained(path)
    session = json.loads(path.read_text(encoding='utf-8'))
    if session.get('kind') == 'editor-navigation':
        if Path(session['process']).resolve() != EDITOR.resolve() or digest(EDITOR) != session['executable_sha256']:
            raise RuntimeError('Pinned editor executable changed')
    else:
        if not session['title'].startswith('MW5 Window Bridge Scratch '):
            raise RuntimeError('Scratch-only allowlist rejected title')
        uuid.UUID(session['title'].removeprefix('MW5 Window Bridge Scratch '))
        if Path(session['process']).resolve() != Path(sys.executable).resolve():
            raise RuntimeError('Scratch-only allowlist rejected executable')
    if path.name != 'session.json' or (path.parent / 'closed.json').exists():
        raise RuntimeError('Invalid or closed scratch session')
    return path, session


def entry_focused(session_path, session):
    state = json.loads((session_path.parent / 'focus.json').read_text(encoding='utf-8'))
    if (state['session_id'] != session['session_id'] or state['pid'] != session['pid']
            or state['entry_hwnd'] != session['entry_hwnd'] or state['entry_focused'] is not True):
        raise RuntimeError('Scratch receiver does not confirm Entry focus')


def require_fresh_receipt(receipt):
    age = (datetime.now(timezone.utc)-datetime.fromisoformat(receipt['created_utc'])).total_seconds()
    if not 0 <= age <= 120:
        raise RuntimeError('Capture expired; recapture and inspect')


def wait_reviewed_pixels(d, ident, session, receipt, png, review_region, wait_ms):
    if not 0 <= wait_ms <= 1200:
        raise RuntimeError('Pixel wait must be between 0 and 1200 milliseconds')
    started = time.monotonic()
    samples = 0
    with Image.open(png) as reviewed:
        size = reviewed.size
        if review_region is not None:
            reviewed = reviewed.crop(tuple(review_region))
        expected = reviewed.convert('RGB').tobytes()
        while True:
            require_fresh_receipt(receipt)
            d.guard(ident, session, receipt['focus_hwnd'])
            current = ImageGrab.grab(bbox=tuple(ident['client_rect']), all_screens=True)
            d.guard(ident, session, receipt['focus_hwnd'])
            require_fresh_receipt(receipt)
            if current.size != size:
                raise RuntimeError('Client dimensions changed')
            if review_region is not None:
                current = current.crop(tuple(review_region))
            samples += 1
            elapsed = time.monotonic()-started
            matches = current.convert('RGB').tobytes() == expected
            if matches and (samples == 1 or elapsed <= wait_ms/1000):
                return {'samples': samples, 'elapsed_ms': round(elapsed*1000, 3)}
            remaining = wait_ms/1000-elapsed
            if remaining <= 0:
                raise RuntimeError('Visible client changed since review; recapture')
            time.sleep(min(.05, remaining))


def capture(d, session_path, session):
    before = d.resolve(session)
    d.guard(before, session)
    focus = d.focus(before)
    box = before['client_rect']
    width, height = box[2]-box[0], box[3]-box[1]
    if not 4 <= width * height <= 4_000_000:
        raise RuntimeError('Unexpected scratch dimensions')
    frame = ImageGrab.grab(bbox=tuple(box), all_screens=True)
    d.guard(before, session, focus)
    if frame.size != (width, height):
        raise RuntimeError('Capture size disagrees with physical client rectangle')
    folder = session_path.parent / ('capture-' + uuid.uuid4().hex)
    folder.mkdir()
    png = folder / 'client.png'
    frame.save(png)
    receipt = {'version': 1, 'created_utc': now(), 'session': str(session_path),
               'identity': before, 'focus_hwnd': focus, 'image': str(png),
               'sha256': digest(png), 'size': list(frame.size),
               'mapping': 'physical_capture_pixels_1_to_1', 'capture_origin': box[:2],
               'status': 'VISUAL_REVIEW_REQUIRED', 'input_actions': 0}
    rp = folder / 'receipt.json'
    rp.write_text(json.dumps(receipt, indent=2), encoding='utf-8')
    return {'receipt': str(rp), **receipt}


def maximize(d, session_path, session):
    if (session.get('kind') != 'editor-navigation' or session.get('owner_identity') is not None
            or session.get('foreground_child_chain') is not None):
        raise RuntimeError('Maximize requires a normal editor binding')
    require_fresh_receipt(session)
    before = d.resolve(session)
    if any(before[field] != session[field] for field in before):
        raise RuntimeError('Window identity or geometry changed since binding; rebind')
    d.guard(before, session)
    focus = d.focus(before)
    placement_before = d.placement(before['hwnd'])
    result = {'started_utc': now(), 'status': 'NOT_ATTEMPTED', 'before': before,
              'placement_before': placement_before, 'command': 'SW_MAXIMIZE',
              'next_step': 'FRESH_NORMAL_BIND_AND_CAPTURE_REQUIRED',
              'input_events': 0, 'error': None}
    destination = session_path.parent / 'maximize-result.json'
    # Persist rollback evidence and consume the binding before the one native
    # layout call. SW_MAXIMIZE activates; this exact target must already be
    # foreground. Its BOOL result means prior visibility, never success.
    with destination.open('x', encoding='utf-8') as f:
        json.dump(result, f, indent=2)
    require_fresh_receipt(session)
    d.guard(before, session, focus)
    with (session_path.parent / 'closed.json').open('x', encoding='utf-8') as f:
        json.dump({'closed_utc': now(), 'reason': 'Explicit maximize attempt',
                   'next_step': result['next_step']}, f)
    try:
        d.guard(before, session, focus)
        result['status'] = 'LAYOUT_OUTCOME_UNCERTAIN'
        result['show_window_previously_visible'] = bool(d.u.ShowWindow(before['hwnd'], 3))
        after = d.identity(before['hwnd'])
        result['after'] = after
        result['placement_after'] = d.placement(before['hwnd'])
        if any(after[field] != before[field]
               for field in ('hwnd', 'pid', 'tid', 'process', 'title', 'process_created')):
            raise RuntimeError('Window identity changed during maximize')
        if not after['maximized']:
            raise RuntimeError('Maximized state not observed')
        d.guard(after, session)
        result['status'] = 'MAXIMIZED_REQUIRES_REVIEW'
    except Exception as error:
        result['error'] = str(error)
    result['completed_utc'] = now()
    destination.write_text(json.dumps(result, indent=2), encoding='utf-8')
    print(json.dumps(result))
    if result['status'] != 'MAXIMIZED_REQUIRES_REVIEW':
        raise SystemExit(2)


def act(args, d, attempt):
    scroll = getattr(args, 'scroll', None)
    escape = getattr(args, 'escape', False)
    escape_popup = getattr(args, 'escape_popup', None)
    if scroll is not None and (len(scroll) != 3 or type(scroll[2]) is not int or scroll[2] not in (-3, -2, -1, 1, 2, 3)):
        raise RuntimeError('Scroll requires X Y and one to three signed integer notches')
    if (scroll is not None or escape) and (args.click_count != 1 or args.mouse_button != 'left'
                                         or args.editor_text_field is not None):
        raise RuntimeError('Scroll/Escape cannot combine with pointer button/count or text field options')
    if escape != (escape_popup is not None):
        raise RuntimeError('Escape requires an explicit reviewed popup rectangle')
    if not 0 <= args.wait_pixels_ms <= 1200:
        raise RuntimeError('Pixel wait must be between 0 and 1200 milliseconds')
    if args.mouse_button == 'right' and (not (args.click or args.drag) or args.click_count != 1):
        raise RuntimeError('Right button permits one single click or one drag only')
    rp = contained(args.receipt)
    receipt = json.loads(rp.read_text(encoding='utf-8'))
    session_path, session = read_session(receipt['session'])
    if (scroll is not None or escape) and (session.get('kind') != 'editor-navigation'
            or session.get('owner_identity') is not None or session.get('foreground_child_chain') is not None):
        raise RuntimeError('Scroll/Escape requires a normal foreground editor binding')
    foreground_child = session.get('foreground_child_chain') is not None
    if foreground_child and (session.get('kind') != 'editor-navigation' or not args.click
                             or args.click_count != 1 or args.drag is not None
                             or args.text is not None or args.editor_text_field is not None):
        raise RuntimeError('Foreground child session permits one single click only')
    if args.drag and args.mouse_button == 'right' and (session.get('kind') != 'editor-navigation'
                                                     or session.get('owner_identity') is not None):
        raise RuntimeError('Right drag requires a normal editor canvas binding')
    if rp.parent.parent != session_path.parent:
        raise RuntimeError('Receipt from different session')
    require_fresh_receipt(receipt)
    if receipt['mapping'] != 'physical_capture_pixels_1_to_1':
        raise RuntimeError('Uncalibrated capture')
    png = contained(receipt['image'])
    if args.image_sha256 != receipt['sha256'] or digest(png) != args.image_sha256:
        raise RuntimeError('Reviewed image hash mismatch')
    ident = receipt['identity']
    d.guard(ident, session, receipt['focus_hwnd'])
    if escape:
        if not receipt['focus_hwnd'] or not encloses([0, 0, *receipt['size']], escape_popup):
            raise RuntimeError('Escape requires focused editor and popup inside reviewed image')
        l, t, r, b = escape_popup
        if r-l < 4 or b-t < 4:
            raise RuntimeError('Reviewed Escape popup is too small')
        escape_point = ((l+r)//2, (t+b)//2)
        d.point(ident, escape_point)
    editor_text_field = args.editor_text_field
    if editor_text_field is not None:
        if session.get('kind') != 'editor-navigation' or args.text is None:
            raise RuntimeError('An editor text field is allowed only with editor text input')
        if session.get('owner_identity') is not None:
            raise RuntimeError('Editor popup text input is not enabled')
        if not receipt['focus_hwnd']:
            raise RuntimeError('Editor text input requires a focused native window')
        if not encloses([0, 0, *receipt['size']], editor_text_field):
            raise RuntimeError('Editor text field outside captured image')
        l, t, r, b = editor_text_field
        if r-l < 4 or b-t < 4:
            raise RuntimeError('Editor text field is too small')
        # This confirms window ownership, not Slate's internal keyboard focus.
        # The reviewed screenshot must show this exact field already active.
        text_point = ((l+r)//2, (t+b)//2)
        d.point(ident, text_point)
    review_region = args.review_region
    if review_region is not None:
        if session.get('kind') != 'editor-navigation':
            raise RuntimeError('Explicit pixel review regions are editor-only')
        if not encloses([0, 0, *receipt['size']], review_region):
            raise RuntimeError('Review region outside captured image')
        l, t, r, b = review_region
        if (r-l)*(b-t) < 10000:
            raise RuntimeError('Review region too small')
        if editor_text_field is not None and not encloses(review_region, editor_text_field):
            raise RuntimeError('Review region must contain the complete editor text field')
        if escape and not encloses(review_region, escape_popup):
            raise RuntimeError('Review region must contain the complete Escape popup')
        targets = ([args.click] if args.click else [args.drag[:2], args.drag[2:]]
                   if args.drag else [scroll[:2]] if scroll is not None else [escape_point] if escape
                   else [text_point] if editor_text_field is not None else [])
        if not targets or any(not (l+16 <= x < r-16 and t+16 <= y < b-16) for x,y in targets):
            raise RuntimeError('Every input point needs a 16px margin inside the reviewed region')
    # Wait only for exact equality, e.g. the reviewed caret phase. No pixels are
    # masked and no tolerance is added; focus, identity and age remain guarded.
    pixel_check = wait_reviewed_pixels(d, ident, session, receipt, png,
                                      review_region, args.wait_pixels_ms)
    d.guard(ident, session, receipt['focus_hwnd'])
    if scroll is not None:
        d.point(ident, tuple(scroll[:2]))
    elif escape:
        d.point(ident, escape_point)
    elif args.text is not None:
        if session.get('kind') == 'editor-navigation' and editor_text_field is None:
            raise RuntimeError('Editor text requires an explicitly reviewed active field')
        if not args.text or len(args.text) > 100 or any(ord(c) < 32 or ord(c) > 126 for c in args.text):
            raise RuntimeError('Text requires 1-100 printable ASCII characters')
        # Tk owns keyboard routing within its native root; corroborate its focus event.
        if editor_text_field is None:
            entry_focused(session_path, session)
        else:
            d.point(ident, text_point)
    else:
        points = [tuple(args.click)] if args.click else [tuple(args.drag[:2]), tuple(args.drag[2:])]
        for point in points:
            d.point(ident, point)
    # Each reviewed capture permits a single attempt, including uncertain failures.
    require_fresh_receipt(receipt)
    with (rp.parent / 'consumed.json').open('x', encoding='utf-8') as f:
        json.dump({'started_utc': now(), 'review_region': review_region,
                   'wait_pixels_ms': args.wait_pixels_ms, 'pixel_check': pixel_check,
                   'click_count': args.click_count if args.click else None,
                   'mouse_button': args.mouse_button if args.click or args.drag else None,
                   'click': args.click, 'drag': args.drag,
                   'scroll': scroll, 'escape_popup': escape_popup,
                   'editor_text_field': editor_text_field,
                   'editor_literal_text': args.text if editor_text_field is not None else None,
                   'action': 'scroll' if scroll is not None else 'escape' if escape
                             else 'text' if args.text is not None else 'click' if args.click else 'drag'}, f)
    if foreground_child:
        # Consume the whole session, even on an uncertain/failed attempt. Other
        # receipts cannot become a route for input after this focus transition.
        with (session_path.parent / 'closed.json').open('x', encoding='utf-8') as f:
            json.dump({'closed_utc': now(), 'reason': 'Foreground child click attempt',
                       'next_step': 'FRESH_NORMAL_BIND_REQUIRED'}, f)
    pending_release = None
    result = {'started_utc': now(), 'status': 'UNKNOWN', 'error': None, 'cleanup_error': None}
    attempt['started'] = True
    try:
        if scroll is not None:
            xy = d.point(ident, tuple(scroll[:2]))
            d.move(xy)
            d.guard(ident, session, receipt['focus_hwnd'])
            d.point(ident, tuple(scroll[:2]))
            d.cursor_guard(ident, xy)
            # One wheel event; no retries or mouse button held.
            d.send([wheel(scroll[2])])
        elif escape:
            d.guard(ident, session, receipt['focus_hwnd'])
            d.point(ident, escape_point)
            try:
                d.send([escape_key(), escape_key(True)])
            except Exception:
                d.send([escape_key(True)])
                raise
        elif args.text is not None:
            for c in args.text:
                d.guard(ident, session, receipt['focus_hwnd'])
                if editor_text_field is None:
                    entry_focused(session_path, session)
                else:
                    d.point(ident, text_point)
                try:
                    d.send([key(ord(c)), key(ord(c), True)])
                except Exception:
                    # Attempt release after uncertain/partial insertion; never duplicate successful UP.
                    d.send([key(ord(c), True)])
                    raise
        elif args.click:
            down_flag, up_flag = (8, 16) if args.mouse_button == 'right' else (2, 4)
            xy = d.point(ident, tuple(args.click))
            d.move(xy)
            d.guard(ident, session, receipt['focus_hwnd'])
            d.point(ident, tuple(args.click))
            d.cursor_guard(ident, xy)
            for click_index in range(args.click_count):
                if click_index:
                    time.sleep(.06)
                    d.guard(ident, session)
                    d.point(ident, tuple(args.click))
                    d.cursor_guard(ident, xy)
                pending_release = up_flag
                d.send([mouse(down_flag), mouse(up_flag)])
                pending_release = None
        else:
            down_flag, up_flag = (8, 16) if args.mouse_button == 'right' else (2, 4)
            start, end = tuple(args.drag[:2]), tuple(args.drag[2:])
            # Check the whole path before holding a button, then check each waypoint again.
            path = [(round(start[0]+(end[0]-start[0])*i/20),
                     round(start[1]+(end[1]-start[1])*i/20)) for i in range(21)]
            for p in path:
                d.point(ident, p)
            d.move(d.point(ident, start))
            d.guard(ident, session, receipt['focus_hwnd'])
            d.cursor_guard(ident, d.point(ident, start))
            pending_release = up_flag
            d.send([mouse(down_flag)])
            previous = d.point(ident, start)
            for p in path[1:]:
                d.guard(ident, session, dragging=True, mouse_button=args.mouse_button)
                d.cursor_guard(ident, previous)
                previous = d.point(ident, p)
                d.move(previous)
                time.sleep(.02)
            d.guard(ident, session, dragging=True, mouse_button=args.mouse_button)
            d.cursor_guard(ident, previous)
            d.send([mouse(up_flag)])
            pending_release = None
        result['status'] = 'INPUT_INSERTED_EFFECT_REQUIRES_REVIEW'
    except Exception as e:
        result['status'], result['error'] = 'FAILED_OR_UNCERTAIN', str(e)
    finally:
        if pending_release is not None:
            try:
                d.send([mouse(pending_release)])
            except Exception as e:
                result['cleanup_error'] = str(e)
        result['completed_utc'] = now()
        (rp.parent / 'action-result.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
    # Allow Slate's short layout/focus animations to settle before the review image.
    # This is only a post-input observation delay, never another input attempt.
    if foreground_child:
        result['next_step'] = 'FRESH_NORMAL_BIND_REQUIRED'
    else:
        time.sleep(1.0)
        try:
            result['after'] = capture(d, session_path, session)
        except Exception as e:
            result['refresh_error'] = str(e)
    (rp.parent / 'action-result.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
    print(json.dumps(result))
    if result['status'] != 'INPUT_INSERTED_EFFECT_REQUIRES_REVIEW':
        raise SystemExit(2)


def main():
    p = argparse.ArgumentParser(description=__doc__)
    sub = p.add_subparsers(dest='command', required=True)
    cap = sub.add_parser('capture')
    cap.add_argument('--session', required=True)
    maxim = sub.add_parser('maximize', help='Maximize an already-foreground editor from a fresh normal binding; then rebind')
    maxim.add_argument('--session', required=True)
    bind = sub.add_parser('bind-editor')
    bind.add_argument('--title', required=True)
    bind.add_argument('--pid', required=True, type=int)
    bind.add_argument('--hwnd', required=True, type=int)
    relationship = bind.add_mutually_exclusive_group()
    relationship.add_argument('--owner-hwnd', type=int,
                      help='Explicit observed owner for a nonactivating editor popup')
    relationship.add_argument('--foreground-child-hwnd', type=int,
                      help='Explicit current foreground owned window; target must be in its owner chain; one click then rebind')
    a = sub.add_parser('act')
    a.add_argument('--receipt', required=True)
    a.add_argument('--image-sha256', required=True)
    a.add_argument('--review-region', nargs=4, type=int,
                   help='Explicit reviewed pixel region for animated editor surfaces; pointer path must stay inside')
    a.add_argument('--click-count', type=int, choices=(1, 2), default=1)
    a.add_argument('--mouse-button', choices=('left', 'right'), default='left',
                   help='Pointer button; right permits one click or a normal editor canvas drag')
    a.add_argument('--editor-text-field', nargs=4, type=int,
                   help='Explicit reviewed active Slate field rectangle for literal text; visual focus confirmation required')
    a.add_argument('--wait-pixels-ms', type=int, default=0,
                   help='Wait 0-1200ms for exact reviewed pixels, preserving focus and freshness guards')
    a.add_argument('--escape-popup', nargs=4, type=int,
                   help='Exact visually reviewed popup rectangle, required only for Escape')
    action = a.add_mutually_exclusive_group(required=True)
    action.add_argument('--click', nargs=2, type=int)
    action.add_argument('--drag', nargs=4, type=int)
    action.add_argument('--text')
    action.add_argument('--scroll', nargs=3, type=int, metavar=('X', 'Y', 'NOTCHES'),
                        help='One wheel event at a reviewed canvas point; signed notches -3..3 excluding zero')
    action.add_argument('--escape', action='store_true', help='One Escape pair to dismiss the explicitly reviewed editor popup')
    args = p.parse_args()
    editor = args.command == 'bind-editor'
    if args.command in ('capture', 'maximize'):
        _, selected = read_session(args.session)
        editor = selected.get('kind') == 'editor-navigation'
    elif args.command == 'act':
        rp = contained(args.receipt)
        _, selected = read_session(json.loads(rp.read_text(encoding='utf-8'))['session'])
        editor = selected.get('kind') == 'editor-navigation'
    d = Desktop(editor=editor)
    if args.command == 'bind-editor':
        # Bind only an explicitly observed current editor, never launch or activate here.
        ident = d.identity(args.hwnd)
        if ident['pid'] != args.pid or ident['title'] != args.title or Path(ident['process']) != EDITOR.resolve():
            raise RuntimeError('Observed editor identity mismatch')
        owner = None
        if args.owner_hwnd is not None:
            if (not args.owner_hwnd or args.owner_hwnd == args.hwnd
                    or int(d.u.GetWindow(args.hwnd, 4) or 0) != args.owner_hwnd):
                raise RuntimeError('Observed editor popup owner relationship mismatch')
            owner = d.identity(args.owner_hwnd)
            if any(owner[field] != ident[field]
                   for field in ('pid', 'process', 'process_created')):
                raise RuntimeError('Editor popup owner belongs to a different process')
        folder = EVIDENCE / ('editor-' + uuid.uuid4().hex)
        if not EVIDENCE.resolve().is_relative_to(ROOT.resolve()):
            raise RuntimeError('Evidence root escapes project')
        folder.mkdir(parents=True)
        session = {**ident, 'session_id': str(uuid.uuid4()), 'kind': 'editor-navigation',
                   'executable_sha256': digest(EDITOR), 'created_utc': now()}
        if owner is not None:
            session['owner_identity'] = owner
        if args.foreground_child_hwnd is not None:
            chain = d.foreground_owner_chain(ident, args.foreground_child_hwnd)
            session['foreground_child_chain'] = chain
            session['foreground_child_focus_hwnd'] = d.focus(chain[0])
        sp = folder / 'session.json'
        sp.write_text(json.dumps(session, indent=2), encoding='utf-8')
        print(json.dumps(capture(d, sp, session)))
        return
    if args.command == 'maximize':
        sp, session = read_session(args.session)
        maximize(d, sp, session)
    elif args.command == 'capture':
        sp, session = read_session(args.session)
        print(json.dumps(capture(d, sp, session)))
    else:
        attempt = {'started': False}
        try:
            act(args, d, attempt)
        except Exception as error:
            # Evidence writes can fail after input; never classify that as zero input.
            rejection = {'status': 'INPUT_OUTCOME_UNCERTAIN' if attempt['started'] else 'REJECTED_BEFORE_INPUT', 'utc': now(),
                         'error': str(error), 'input_events': None if attempt['started'] else 0,
                         'receipt': args.receipt}
            try:
                rp = contained(args.receipt)
                dest = rp.parent / ('rejected-' + uuid.uuid4().hex + '.json')
                dest.write_text(json.dumps(rejection, indent=2), encoding='utf-8')
                rejection['evidence'] = str(dest)
            except Exception:
                pass
            print(json.dumps(rejection))
            raise SystemExit(2)


if __name__ == '__main__':
    main()
