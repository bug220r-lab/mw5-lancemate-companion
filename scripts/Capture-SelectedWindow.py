"""Read-only fallback window capture. No clicks, keys, focus changes or server.

Resolves a unique top-level HWND from an exact title and executable name. Uses
the installed Pillow window-capture API rather than Windows.Graphics.Capture.

EnumWindows contract: https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-enumwindows
"""
import argparse
import ctypes
from ctypes import wintypes as W
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import sys

import PIL
from PIL import ImageGrab


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--title', required=True)
    parser.add_argument('--process', required=True)
    parser.add_argument('--method', choices=('window', 'screen'), default='window')
    args = parser.parse_args()
    if not args.title or not args.process or Path(args.process).name != args.process:
        parser.error('A nonempty exact title and executable basename are required')
    if sys.platform != 'win32':
        raise RuntimeError('Windows only')
    u = ctypes.WinDLL('user32', use_last_error=True)
    k = ctypes.WinDLL('kernel32', use_last_error=True)
    # This changes only this short-lived capture process, never Windows settings.
    # Set before geometry/capture calls so mixed-DPI desktops are not virtualized.
    u.SetProcessDpiAwarenessContext.argtypes = [W.HANDLE]
    u.SetProcessDpiAwarenessContext.restype = W.BOOL
    if not u.SetProcessDpiAwarenessContext(W.HANDLE(-4)):
        raise ctypes.WinError(ctypes.get_last_error())
    for name in ('IsWindow', 'IsWindowVisible', 'IsIconic'):
        getattr(u, name).argtypes = [W.HWND]
        getattr(u, name).restype = W.BOOL
    u.GetWindowTextW.argtypes = [W.HWND, W.LPWSTR, ctypes.c_int]
    u.GetWindowTextW.restype = ctypes.c_int
    u.GetWindowThreadProcessId.argtypes = [W.HWND, ctypes.POINTER(W.DWORD)]
    u.GetWindowThreadProcessId.restype = W.DWORD
    u.GetWindowRect.argtypes = [W.HWND, ctypes.POINTER(W.RECT)]
    u.GetWindowRect.restype = W.BOOL
    u.GetForegroundWindow.argtypes = []
    u.GetForegroundWindow.restype = W.HWND
    enum_callback_type = ctypes.WINFUNCTYPE(W.BOOL, W.HWND, W.LPARAM, use_last_error=True)
    u.EnumWindows.argtypes = [enum_callback_type, W.LPARAM]
    u.EnumWindows.restype = W.BOOL
    k.OpenProcess.argtypes = [W.DWORD, W.BOOL, W.DWORD]
    k.OpenProcess.restype = W.HANDLE
    k.QueryFullProcessImageNameW.argtypes = [W.HANDLE, W.DWORD, W.LPWSTR, ctypes.POINTER(W.DWORD)]
    k.QueryFullProcessImageNameW.restype = W.BOOL
    k.CloseHandle.argtypes = [W.HANDLE]
    k.CloseHandle.restype = W.BOOL
    def window_title(hwnd):
        title = ctypes.create_unicode_buffer(32768)
        ctypes.set_last_error(0)
        if not u.GetWindowTextW(hwnd, title, len(title)) and ctypes.get_last_error():
            raise ctypes.WinError(ctypes.get_last_error())
        return title.value

    def identity(hwnd):
        if not u.IsWindow(hwnd):
            raise RuntimeError('Window no longer exists; reobserve')
        title = window_title(hwnd)
        pid = W.DWORD()
        if not u.GetWindowThreadProcessId(hwnd, ctypes.byref(pid)):
            raise ctypes.WinError(ctypes.get_last_error())
        handle = k.OpenProcess(0x1000, False, pid.value)
        if not handle:
            raise ctypes.WinError(ctypes.get_last_error())
        try:
            path = ctypes.create_unicode_buffer(32768)
            size = W.DWORD(len(path))
            if not k.QueryFullProcessImageNameW(handle, 0, path, ctypes.byref(size)):
                raise ctypes.WinError(ctypes.get_last_error())
        finally:
            k.CloseHandle(handle)
        rect = W.RECT()
        if not u.GetWindowRect(hwnd, ctypes.byref(rect)):
            raise ctypes.WinError(ctypes.get_last_error())
        return {'hwnd': int(hwnd), 'pid': pid.value, 'title': title, 'process': path.value,
                'window_rect': [rect.left, rect.top, rect.right, rect.bottom],
                'visible': bool(u.IsWindowVisible(hwnd)), 'minimized': bool(u.IsIconic(hwnd))}

    def resolve_window():
        matches = []
        errors = []

        @enum_callback_type
        def visit(hwnd, unused):
            try:
                # Query process identity only for the requested title. Hidden and
                # minimized matches still count towards ambiguity; never pick one
                # window merely because another matching window is not visible.
                if window_title(hwnd) == args.title:
                    candidate = identity(hwnd)
                    if candidate['title'] != args.title:
                        raise RuntimeError('Window title changed during resolution; reobserve')
                    if Path(candidate['process']).name.casefold() == args.process.casefold():
                        matches.append(candidate)
                return True
            except Exception as exc:
                errors.append(exc)
                ctypes.set_last_error(getattr(exc, 'winerror', None) or 995)
                return False

        ctypes.set_last_error(0)
        enumerated = u.EnumWindows(visit, 0)
        if errors:
            raise RuntimeError('Window resolution failed; reobserve') from errors[0]
        if not enumerated:
            raise ctypes.WinError(ctypes.get_last_error())
        if len(matches) != 1:
            raise RuntimeError(f'Expected one exact title/process match; found {len(matches)}')
        selected = matches[0]
        # Recheck the resolved handle after enumeration, before returning it.
        current = identity(selected['hwnd'])
        if current != selected:
            raise RuntimeError('Window identity changed during resolution; reobserve')
        if not current['visible'] or current['minimized']:
            raise RuntimeError('Window is hidden or minimized; reobserve')
        return current

    before = resolve_window()
    left, top, right, bottom = before['window_rect']
    width, height = right - left, bottom - top
    if width < 2 or height < 2 or width * height > 40_000_000:
        raise RuntimeError('Unexpected window dimensions; refusing capture')
    started = datetime.now(timezone.utc).isoformat()
    if args.method == 'screen':
        if u.GetForegroundWindow() != before['hwnd']:
            raise RuntimeError('Screen capture requires the exact target in foreground')
        frame = ImageGrab.grab(bbox=tuple(before['window_rect']), all_screens=True)
        if u.GetForegroundWindow() != before['hwnd']:
            raise RuntimeError('Foreground changed during capture')
    else:
        frame = ImageGrab.grab(window=before['hwnd'])
    after = resolve_window()
    if before != after:
        raise RuntimeError('Window identity changed during capture')
    if frame.width < 2 or frame.height < 2 or frame.width * frame.height > 40_000_000:
        raise RuntimeError('Unexpected image dimensions')
    root = Path(__file__).resolve().parents[1]
    directory = root / 'research' / 'evidence' / 'desktop-capture' / datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
    directory.mkdir(parents=True, exist_ok=False)
    png = directory / 'window.png'
    frame.save(png)
    receipt = {'status': 'CAPTURE_CREATED_VISUAL_REVIEW_REQUIRED', 'started_utc': started,
               'completed_utc': datetime.now(timezone.utc).isoformat(), 'identity': before,
               'method': args.method, 'pillow_version': PIL.__version__,
               'capture_process_dpi': 'PER_MONITOR_AWARE_V2',
               'image': str(png), 'size': list(frame.size),
               'sha256': hashlib.sha256(png.read_bytes()).hexdigest(),
               'input_actions': 0, 'focus_changes': 0,
               'limitations': 'No coordinate calibration, input-control or Unreal rendering acceptance; inspect pixels'}
    (directory / 'receipt.json').write_text(json.dumps(receipt, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(receipt))


if __name__ == '__main__':
    main()
