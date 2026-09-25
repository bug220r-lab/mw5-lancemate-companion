"""Disposable local window for observing real click, text, and drag events.

No synthesized input, listener, editor access, or game access. Evidence writes
are limited to one new session below research/evidence/window-bridge.
"""
import argparse
import ctypes
from ctypes import wintypes as W
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import sys
import time
import uuid


def utc_now():
    return datetime.now(timezone.utc).isoformat()


def prepare_session_directory(raw_path):
    project = Path(__file__).resolve().parents[1]
    base = (project / 'research' / 'evidence' / 'window-bridge').resolve()
    if not base.is_relative_to(project):
        raise RuntimeError('Evidence root resolves outside the project')
    directory = Path(raw_path).expanduser().resolve()
    if directory == base or not directory.is_relative_to(base):
        raise RuntimeError('Session directory must be a child of research/evidence/window-bridge')
    if directory.exists() and (not directory.is_dir() or any(directory.iterdir())):
        raise RuntimeError('Session directory must be new or empty; no existing evidence is overwritten')
    directory.mkdir(parents=True, exist_ok=True)
    if directory.resolve() != directory or not directory.resolve().is_relative_to(base):
        raise RuntimeError('Session directory changed during creation')
    return directory


def windows_api():
    u = ctypes.WinDLL('user32', use_last_error=True)
    u.SetProcessDpiAwarenessContext.argtypes = [W.HANDLE]
    u.SetProcessDpiAwarenessContext.restype = W.BOOL
    if not u.SetProcessDpiAwarenessContext(W.HANDLE(-4)):
        raise ctypes.WinError(ctypes.get_last_error())

    class MonitorInfo(ctypes.Structure):
        _fields_ = [('cbSize', W.DWORD), ('rcMonitor', W.RECT),
                    ('rcWork', W.RECT), ('dwFlags', W.DWORD)]

    u.MonitorFromPoint.argtypes = [W.POINT, W.DWORD]
    u.MonitorFromPoint.restype = W.HANDLE
    u.GetMonitorInfoW.argtypes = [W.HANDLE, ctypes.POINTER(MonitorInfo)]
    u.GetMonitorInfoW.restype = W.BOOL
    u.GetAncestor.argtypes = [W.HWND, W.UINT]
    u.GetAncestor.restype = W.HWND
    u.GetWindowRect.argtypes = [W.HWND, ctypes.POINTER(W.RECT)]
    u.GetWindowRect.restype = W.BOOL
    u.SetWindowPos.argtypes = [W.HWND, W.HWND, ctypes.c_int, ctypes.c_int,
                              ctypes.c_int, ctypes.c_int, W.UINT]
    u.SetWindowPos.restype = W.BOOL
    monitor = u.MonitorFromPoint(W.POINT(0, 0), 1)
    info = MonitorInfo()
    info.cbSize = ctypes.sizeof(info)
    if not monitor or not u.GetMonitorInfoW(monitor, ctypes.byref(info)):
        raise ctypes.WinError(ctypes.get_last_error())
    if not info.dwFlags & 1:
        raise RuntimeError('Expected the primary monitor at screen origin')
    return u, [info.rcWork.left, info.rcWork.top, info.rcWork.right, info.rcWork.bottom]


def own_process_created_filetime():
    k = ctypes.WinDLL('kernel32', use_last_error=True)
    k.OpenProcess.argtypes = [W.DWORD, W.BOOL, W.DWORD]
    k.OpenProcess.restype = W.HANDLE
    k.GetProcessTimes.argtypes = [W.HANDLE] + [ctypes.POINTER(W.FILETIME)] * 4
    k.GetProcessTimes.restype = W.BOOL
    k.CloseHandle.argtypes = [W.HANDLE]
    k.CloseHandle.restype = W.BOOL
    handle = k.OpenProcess(0x1000, False, os.getpid())
    if not handle:
        raise ctypes.WinError(ctypes.get_last_error())
    try:
        times = [W.FILETIME() for unused in range(4)]
        if not k.GetProcessTimes(handle, *(ctypes.byref(value) for value in times)):
            raise ctypes.WinError(ctypes.get_last_error())
        return (times[0].dwHighDateTime << 32) | times[0].dwLowDateTime
    finally:
        k.CloseHandle(handle)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--session-dir', required=True)
    args = parser.parse_args()
    if sys.platform != 'win32':
        raise RuntimeError('This fixture requires Windows')
    directory = prepare_session_directory(args.session_dir)
    u, work_area = windows_api()
    process_created = own_process_created_filetime()
    # Set this process's DPI context before importing/creating Tk windows.
    import tkinter as tk

    session_id = str(uuid.uuid4())
    title = 'MW5 Window Bridge Scratch ' + session_id
    started = utc_now()
    started_monotonic = time.monotonic()
    events = (directory / 'events.jsonl').open('x', encoding='utf-8', buffering=1)
    root = None
    closed = False
    event_sequence = 0
    clicks = 0
    entry_value = ''
    drag_count = 0
    accepted_drags = 0
    close_reason = 'mainloop_ended'

    def log(kind, **details):
        nonlocal event_sequence
        event_sequence += 1
        record = {'sequence': event_sequence, 'utc': utc_now(),
                  'elapsed_seconds': round(time.monotonic() - started_monotonic, 6),
                  'kind': kind, **details}
        events.write(json.dumps(record, ensure_ascii=False) + '\n')
        events.flush()

    def event_fields(event):
        return {'tk_event_type': str(event.type), 'tk_event_serial': event.serial,
                'tk_event_time': event.time, 'x': event.x, 'y': event.y,
                'x_root': event.x_root, 'y_root': event.y_root, 'state': event.state,
                'tk_send_event': event.send_event}

    def close(reason):
        nonlocal closed, close_reason
        if not closed:
            closed = True
            close_reason = reason
            log('close_requested', reason=reason)
            root.destroy()

    try:
        root = tk.Tk()
        root.withdraw()
        root.title(title)
        root.geometry('720x450+0+0')
        root.resizable(False, False)
        root.configure(background='#f4f6f8')
        root.protocol('WM_DELETE_WINDOW', lambda: close('window_close'))
        root.bind('<Escape>', lambda event: close('escape'))

        def label(text, x, y, width, height, **options):
            widget = tk.Label(root, text=text, anchor='w', background='#f4f6f8',
                              font=('Segoe UI', 10), **options)
            widget.place(x=x, y=y, width=width, height=height)
            return widget

        label('Scratch input test - local evidence only', 24, 12, 660, 25)
        label('Click, type, then drag the blue square into the green outline.', 24, 37, 670, 22)
        count_label = label('Clicks observed: 0', 190, 64, 370, 40)
        button = tk.Button(root, text='Click test', font=('Segoe UI', 11))
        button.place(x=24, y=64, width=150, height=40)
        button_pressed = {'value': False}

        def button_down(event):
            button_pressed['value'] = True
            log('click_press', **event_fields(event))

        def button_up(event):
            nonlocal clicks
            inside = 0 <= event.x < button.winfo_width() and 0 <= event.y < button.winfo_height()
            accepted = button_pressed['value'] and inside
            button_pressed['value'] = False
            if accepted:
                clicks += 1
                count_label.configure(text=f'Clicks observed: {clicks}')
            log('click_release', accepted=accepted, click_count=clicks, **event_fields(event))

        button.bind('<ButtonPress-1>', button_down)
        button.bind('<ButtonRelease-1>', button_up)
        label('Type a short test marker:', 24, 108, 670, 22)
        text_var = tk.StringVar()
        entry = tk.Entry(root, textvariable=text_var, font=('Consolas', 11),
                         insertontime=0, insertofftime=0)
        entry.place(x=24, y=130, width=672, height=32)
        entry.configure(validate='key', validatecommand=(root.register(lambda value: len(value) <= 256), '%P'))
        echo = label('Echo: (empty)', 24, 168, 672, 37, wraplength=665)

        def publish_focus():
            try:
                focused = root.focus_get() == entry
            except tk.TclError:
                # A destroyed/unqueryable receiver must never authorize typing.
                focused = False
            state = {'session_id': session_id, 'pid': os.getpid(),
                     'entry_focused': focused, 'entry_hwnd': int(entry.winfo_id()), 'utc': utc_now()}
            temporary = directory / 'focus.pending.json'
            temporary.write_text(json.dumps(state, indent=2) + '\n', encoding='utf-8')
            temporary.replace(directory / 'focus.json')

        entry.bind('<FocusIn>', lambda event: root.after_idle(publish_focus))
        entry.bind('<FocusOut>', lambda event: root.after_idle(publish_focus))

        def echo_text(*unused):
            nonlocal entry_value
            entry_value = text_var.get()
            echo.configure(text='Echo: ' + (entry_value if entry_value else '(empty)'))

        text_var.trace_add('write', echo_text)

        def entry_key(event):
            log('entry_key_release', keysym=event.keysym, character=event.char,
                value=text_var.get(), **event_fields(event))

        entry.bind('<KeyRelease>', entry_key)
        label('Drag test: START on the left, GOAL on the right.', 24, 212, 672, 24)
        canvas = tk.Canvas(root, width=672, height=155, background='white',
                           highlightthickness=0, borderwidth=0)
        canvas.place(x=24, y=240, width=672, height=155)
        start_zone = [20, 40, 130, 135]
        goal_zone = [520, 40, 640, 135]
        canvas.create_rectangle(*start_zone, outline='#64748b', width=2)
        canvas.create_text(75, 21, text='START', font=('Segoe UI', 10))
        canvas.create_rectangle(*goal_zone, outline='#15803d', width=3)
        canvas.create_text(580, 21, text='GOAL', font=('Segoe UI', 10))
        square = canvas.create_rectangle(45, 65, 95, 115, fill='#2563eb', outline='#1e40af', width=2)
        drag = {'active': False, 'offset': (0, 0), 'press': None, 'motions': 0}
        drag_status = label('Drag releases observed: 0', 24, 405, 400, 29)

        def drag_down(event):
            bounds = canvas.coords(square)
            if bounds[0] <= event.x <= bounds[2] and bounds[1] <= event.y <= bounds[3]:
                drag.update(active=True, offset=(event.x - bounds[0], event.y - bounds[1]),
                            press=event_fields(event), motions=0)
                log('drag_press', square_bounds=bounds, **event_fields(event))

        def drag_move(event):
            if drag['active']:
                x = max(0, min(canvas.winfo_width() - 50, event.x - drag['offset'][0]))
                y = max(0, min(canvas.winfo_height() - 50, event.y - drag['offset'][1]))
                canvas.coords(square, x, y, x + 50, y + 50)
                drag['motions'] += 1

        def drag_up(event):
            nonlocal drag_count, accepted_drags
            if not drag['active']:
                return
            drag['active'] = False
            drag_count += 1
            bounds = canvas.coords(square)
            inside_goal = (goal_zone[0] <= bounds[0] and goal_zone[1] <= bounds[1]
                           and bounds[2] <= goal_zone[2] and bounds[3] <= goal_zone[3])
            accepted = inside_goal and drag['motions'] > 0
            accepted_drags += int(accepted)
            drag_status.configure(text=f'Drag releases: {drag_count} | In goal: {accepted_drags}')
            log('drag_release', accepted=accepted, square_bounds=bounds,
                press=drag['press'], motion_event_count=drag['motions'],
                drag_release_count=drag_count, accepted_drag_count=accepted_drags,
                **event_fields(event))

        canvas.bind('<ButtonPress-1>', drag_down)
        canvas.bind('<B1-Motion>', drag_move)
        canvas.bind('<ButtonRelease-1>', drag_up)

        def move_own_window():
            before = W.RECT()
            if not u.GetWindowRect(hwnd, ctypes.byref(before)):
                raise ctypes.WinError(ctypes.get_last_error())
            delta = 20 if before.right + 20 <= work_area[2] else -20
            if before.left + delta < work_area[0]:
                log('fixture_window_move_rejected', reason='No room for a 20px horizontal move')
                return
            if not u.SetWindowPos(hwnd, None, before.left + delta, before.top, 0, 0,
                                  0x0001 | 0x0004 | 0x0010):
                raise ctypes.WinError(ctypes.get_last_error())
            root.update_idletasks()
            after = W.RECT()
            if not u.GetWindowRect(hwnd, ctypes.byref(after)):
                raise ctypes.WinError(ctypes.get_last_error())
            log('fixture_window_move', requested_delta_x=delta,
                before=[before.left, before.top, before.right, before.bottom],
                after=[after.left, after.top, after.right, after.bottom])

        move_button = tk.Button(root, text='Move window', command=move_own_window)
        move_button.place(x=432, y=405, width=124, height=29)
        close_button = tk.Button(root, text='Close (Esc)', command=lambda: close('close_button'))
        close_button.place(x=568, y=405, width=128, height=29)
        # Tk can defer child native windows until needed. Realize all controls
        # before asking it for their screen coordinates.
        for widget in (button, entry, canvas, move_button, close_button):
            widget.winfo_id()
        root.update_idletasks()
        root.deiconify()
        root.update()
        hwnd = u.GetAncestor(root.winfo_id(), 2)
        rect = W.RECT()
        if not hwnd or not u.GetWindowRect(hwnd, ctypes.byref(rect)):
            raise ctypes.WinError(ctypes.get_last_error())
        frame_width, frame_height = rect.right - rect.left, rect.bottom - rect.top
        left, top, right, bottom = work_area
        if frame_width > right - left or frame_height > bottom - top:
            raise RuntimeError('Primary monitor work area cannot contain the complete fixture')
        x, y = left + (right - left - frame_width) // 2, top + (bottom - top - frame_height) // 2
        if not u.SetWindowPos(hwnd, None, x, y, 0, 0, 0x0001 | 0x0004 | 0x0010):
            raise ctypes.WinError(ctypes.get_last_error())
        root.update()
        if not u.GetWindowRect(hwnd, ctypes.byref(rect)):
            raise ctypes.WinError(ctypes.get_last_error())
        if not (left <= rect.left and top <= rect.top and rect.right <= right and rect.bottom <= bottom):
            raise RuntimeError('Fixture frame is not entirely inside the primary work area')

        def widget_bounds(widget):
            wx, wy = widget.winfo_rootx(), widget.winfo_rooty()
            client = [wx - root.winfo_rootx(), wy - root.winfo_rooty(),
                      wx - root.winfo_rootx() + widget.winfo_width(),
                      wy - root.winfo_rooty() + widget.winfo_height()]
            if not (0 <= client[0] < client[2] <= root.winfo_width()
                    and 0 <= client[1] < client[3] <= root.winfo_height()):
                raise RuntimeError('Realized widget is outside the fixture client rectangle')
            return {'screen_rect': [wx, wy, wx + widget.winfo_width(), wy + widget.winfo_height()],
                    'root_client_rect': client}

        publish_focus()
        session = {'status': 'SCRATCH_WINDOW_READY_UNTESTED', 'session_id': session_id,
                   'title': title, 'pid': os.getpid(), 'executable': str(Path(sys.executable).resolve()),
                   'process': str(Path(sys.executable).resolve()), 'entry_hwnd': int(entry.winfo_id()),
                   'process_created': process_created,
                   'started_utc': started, 'ready_utc': utc_now(), 'hwnd': int(hwnd),
                   'capture_process_dpi': 'PER_MONITOR_AWARE_V2', 'client_size': [720, 450],
                   'primary_work_area': work_area,
                   'window_rect': [rect.left, rect.top, rect.right, rect.bottom],
                   'client_origin_screen': [root.winfo_rootx(), root.winfo_rooty()],
                   'widgets': {'click_button': widget_bounds(button), 'entry': widget_bounds(entry),
                               'canvas': widget_bounds(canvas), 'move_button': widget_bounds(move_button),
                               'close_button': widget_bounds(close_button)},
                   'canvas_start_square': canvas.coords(square), 'canvas_goal_outline': goal_zone,
                   'expires_after_seconds': 900, 'synthesized_input_actions': 0,
                   'evidence_limit': 'Actual Tk events only; receipts do not identify the external input source'}
        (directory / 'session.json').write_text(json.dumps(session, indent=2) + '\n', encoding='utf-8')
        log('ready', title=title, hwnd=int(hwnd))
        print(json.dumps(session), flush=True)
        root.after(900_000, lambda: close('auto_expired_15_minutes'))
        root.mainloop()
    except Exception as exc:
        close_reason = 'error'
        log('error', error_type=type(exc).__name__, message=str(exc))
        raise
    finally:
        if root is not None and not closed:
            try:
                root.destroy()
            except Exception:
                pass
        receipt = {'session_id': session_id, 'title': title, 'pid': os.getpid(),
                   'started_utc': started, 'closed_utc': utc_now(), 'reason': close_reason,
                   'click_count': clicks, 'entry_value': entry_value,
                   'drag_release_count': drag_count, 'accepted_drag_count': accepted_drags,
                   'event_count': event_sequence, 'synthesized_input_actions': 0}
        (directory / 'closed.json').write_text(json.dumps(receipt, indent=2) + '\n', encoding='utf-8')
        events.close()


if __name__ == '__main__':
    main()
