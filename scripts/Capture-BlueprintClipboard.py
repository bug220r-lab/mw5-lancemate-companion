"""Dormant read-only capture of one native-copied disposable Print String node.

No Unreal import, clipboard write, paste, input, compile, asset save or launch.
Native use requires a freshly reviewed normal WindowBridge capture of the exact
BP_CodexAuthoringProbe asset window after an observed native Copy action.
Offline validation is a narrow envelope check, not an engine clipboard parser.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
import types

ROOT = Path(__file__).resolve().parents[1]
BRIDGE = ROOT / "scripts" / "WindowBridge.py"
ASSET_NAME = "BP_CodexAuthoringProbe"
SOURCE = Path("C:/Program Files/Epic Games/MechWarrior5Editor/MW5Mercs/Content/"
              "CodexEditorControlScratch20260925/BP_CodexAuthoringProbe.uasset")
BACKUP = ROOT / "artifacts/editor-authoring-probe-20260925/BP_CodexAuthoringProbe.uasset"
SOURCE_BYTES = 28153
SOURCE_SHA256 = "0b7d06f0004d67d1944cd288b44a4b63d7f95d4e17de22b8ee828f4f96f0b6dc"
MARKER = "AUTHORING PROBE - NOT RUNTIME"
MAX_UTF16_BYTES = 64 * 1024
MAX_RECEIPT_BYTES = 16 * 1024


def sha(data):
    return hashlib.sha256(data).hexdigest()


def bounded_read(path, maximum):
    path = Path(path)
    if path.is_symlink() or not path.is_file():
        raise ValueError("Expected regular file")
    before = path.stat()
    with path.open("rb") as stream:
        data = stream.read(maximum + 1)
    after = path.stat()
    if len(data) > maximum or before.st_size != len(data) or (
            before.st_dev, before.st_ino, before.st_size, before.st_mtime_ns) != (
            after.st_dev, after.st_ino, after.st_size, after.st_mtime_ns):
        raise ValueError("File changed or exceeded bound")
    return data


def validate_payload(text):
    if not isinstance(text, str) or not text or len(text.encode("utf-16-le")) > MAX_UTF16_BYTES:
        raise ValueError("Clipboard text absent or oversized")
    if any(ord(c) < 32 and c not in "\r\n\t" for c in text):
        raise ValueError("Clipboard contains control characters")
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    if len(lines) > 160 or not re.fullmatch(
            r'Begin Object Class=/Script/BlueprintGraph\.K2Node_CallFunction Name="K2Node_CallFunction_\d+"',
            lines[0]):
        raise ValueError("Expected one native Print String node envelope")
    if lines[-1] != "End Object" or sum(line.startswith("Begin Object") for line in lines) != 1 or sum(
            line.startswith("End Object") for line in lines) != 1:
        raise ValueError("Nested, multiple or malformed node envelope")
    references = [line for line in lines if line.startswith("FunctionReference=")]
    if len(references) != 1 or not re.fullmatch(
            r'''FunctionReference=\(MemberParent=Class'"?/Script/Engine\.KismetSystemLibrary"?',MemberName="PrintString"\)''',
            references[0]):
        raise ValueError("Expected exact native PrintString function")
    literal_pins = [line for line in lines if line.startswith("CustomProperties Pin (") and
                    'PinName="InString"' in line]
    if len(literal_pins) != 1 or 'DefaultValue="' + MARKER + '"' not in literal_pins[0]:
        raise ValueError("Expected disposable authoring-probe literal")
    return {"status": "NARROW_ENVELOPE_VALIDATED_NOT_ENGINE_IMPORT_VALIDATED",
            "node_count": 1, "function": "/Script/Engine.KismetSystemLibrary.PrintString",
            "literal": MARKER, "utf16_bytes_without_terminator": len(text.encode("utf-16-le")),
            "line_count": len(lines),
            "linked_to_fields": sum("LinkedTo=(" in line for line in lines),
            "external_links": "REQUIRES_REVIEW_NATIVE_PASTE_MAY_PRUNE_LINKS_TO_UNCOPIED_NODES"}


def decode_unicode_buffer(raw):
    if not isinstance(raw, bytes) or len(raw) < 2 or len(raw) > MAX_UTF16_BYTES + 2 or len(raw) % 2:
        raise ValueError("Clipboard allocation is absent, odd or oversized")
    terminator = next((i for i in range(0, len(raw), 2) if raw[i:i + 2] == b"\0\0"), None)
    if terminator is None:
        raise ValueError("Clipboard Unicode text lacks bounded terminator")
    try:
        text = raw[:terminator].decode("utf-16-le", errors="strict")
    except UnicodeError as exc:
        raise ValueError("Invalid clipboard Unicode") from exc
    validate_payload(text)
    return text


def read_native_clipboard():
    import ctypes as c
    from ctypes import wintypes as w
    u, k = c.WinDLL("user32", use_last_error=True), c.WinDLL("kernel32", use_last_error=True)
    for dll, name, argtypes, restype in [
            (u, "OpenClipboard", [w.HWND], w.BOOL), (u, "CloseClipboard", [], w.BOOL),
            (u, "IsClipboardFormatAvailable", [w.UINT], w.BOOL),
            (u, "GetClipboardData", [w.UINT], w.HANDLE),
            (u, "GetClipboardSequenceNumber", [], w.DWORD),
            (u, "GetClipboardOwner", [], w.HWND),
            (k, "GlobalSize", [w.HANDLE], c.c_size_t),
            (k, "GlobalLock", [w.HANDLE], c.c_void_p),
            (k, "GlobalUnlock", [w.HANDLE], w.BOOL)]:
        fn = getattr(dll, name)
        fn.argtypes, fn.restype = argtypes, restype
    before = int(u.GetClipboardSequenceNumber())
    if not before or not u.OpenClipboard(None):
        raise RuntimeError("Clipboard unavailable; no retry performed")
    try:
        if not u.IsClipboardFormatAvailable(13):
            raise ValueError("CF_UNICODETEXT is absent")
        handle = u.GetClipboardData(13)
        size = int(k.GlobalSize(handle)) if handle else 0
        if not 2 <= size <= MAX_UTF16_BYTES + 2:
            raise ValueError("Clipboard allocation outside bounded capture")
        ptr = k.GlobalLock(handle)
        if not ptr:
            raise RuntimeError("Clipboard memory unavailable")
        try:
            raw = c.string_at(ptr, size)
        finally:
            k.GlobalUnlock(handle)
        owner = int(u.GetClipboardOwner() or 0)
    finally:
        if not u.CloseClipboard():
            raise RuntimeError("Clipboard close failed")
    after = int(u.GetClipboardSequenceNumber())
    if before != after:
        raise ValueError("Clipboard changed during capture")
    return decode_unicode_buffer(raw), {"sequence_number": after, "owner_hwnd": owner,
                                        "allocation_bytes": size,
                                        "origin_limit": "UI_COPY_RECEIPT_REQUIRED_NOT_INFERRED_FROM_CONTENT"}


def source_pins():
    result = []
    for path in (SOURCE, BACKUP):
        data = bounded_read(path, SOURCE_BYTES)
        if len(data) != SOURCE_BYTES or sha(data) != SOURCE_SHA256:
            raise ValueError("Disposable asset or preserved original backup changed")
        result.append({"path": str(path), "bytes": len(data), "sha256": sha(data)})
    return result


def validate_review_region(region, size):
    """Exact optional image-relative rectangle, never a tolerant pixel mask."""
    if (not isinstance(size, (list, tuple)) or len(size) != 2 or
            any(type(value) is not int or value <= 0 for value in size)):
        raise ValueError("Invalid captured image size")
    if region is None:
        return None
    if (not isinstance(region, (list, tuple)) or len(region) != 4 or
            any(type(value) is not int for value in region)):
        raise ValueError("Review region needs four integer coordinates")
    left, top, right, bottom = region
    width, height = size
    if not (0 <= left < right <= width and 0 <= top < bottom <= height):
        raise ValueError("Review region outside captured image")
    if (right - left) * (bottom - top) < 10000:
        raise ValueError("Review region too small")
    return list(region)


def native_clipboard_sequence():
    """Read only the sequence after post-read visual checks; never read new text."""
    import ctypes as c
    from ctypes import wintypes as w
    u = c.WinDLL("user32", use_last_error=True)
    u.GetClipboardSequenceNumber.argtypes = []
    u.GetClipboardSequenceNumber.restype = w.DWORD
    return int(u.GetClipboardSequenceNumber())


def capture(args):
    bridge_bytes = bounded_read(BRIDGE, 128 * 1024)
    if sha(bridge_bytes) != args.bridge_sha256:
        raise ValueError("Reviewed WindowBridge hash mismatch")
    bridge = types.ModuleType("_clipboard_capture_bridge")
    bridge.__file__ = str(BRIDGE)
    exec(compile(bridge_bytes, str(BRIDGE), "exec"), bridge.__dict__)
    rp = bridge.contained(args.receipt)
    receipt_bytes = bounded_read(rp, MAX_RECEIPT_BYTES)
    receipt = json.loads(receipt_bytes.decode("utf-8"))
    sp, session = bridge.read_session(receipt["session"])
    if (rp.parent.parent != sp.parent or session.get("kind") != "editor-navigation" or
            session.get("owner_identity") is not None or session.get("foreground_child_chain") is not None or
            ASSET_NAME not in session.get("title", "")):
        raise ValueError("Fresh normal disposable-asset window binding required")
    if receipt.get("mapping") != "physical_capture_pixels_1_to_1":
        raise ValueError("Uncalibrated capture")
    png = bridge.contained(receipt["image"])
    image_bytes = bounded_read(png, 16 * 1024 * 1024)
    if receipt["sha256"] != args.image_sha256 or sha(image_bytes) != args.image_sha256:
        raise ValueError("Reviewed image hash mismatch")
    with bridge.Image.open(png) as reviewed:
        image_size = list(reviewed.size)
    if receipt.get("size") != image_size:
        raise ValueError("Reviewed image dimensions disagree with receipt")
    review_region = validate_review_region(getattr(args, "review_region", None), image_size)
    protected = source_pins()
    desktop = bridge.Desktop(editor=True)

    def guard():
        bridge.require_fresh_receipt(receipt)
        desktop.guard(receipt["identity"], session, receipt["focus_hwnd"])
        if (bounded_read(rp, MAX_RECEIPT_BYTES) != receipt_bytes or
                sha(bounded_read(png, 16 * 1024 * 1024)) != args.image_sha256):
            raise ValueError("Reviewed receipt or full image changed")
        pixel_check = bridge.wait_reviewed_pixels(
            desktop, receipt["identity"], session, receipt, png, review_region, 0)
        if source_pins() != protected or sha(bounded_read(BRIDGE, 128 * 1024)) != args.bridge_sha256:
            raise ValueError("Protected inputs changed")
        return pixel_check

    before_pixel_check = guard()
    text, clipboard = read_native_clipboard()
    validation = validate_payload(text)
    after_pixel_check = guard()
    final_sequence = native_clipboard_sequence()
    if not final_sequence or final_sequence != clipboard["sequence_number"]:
        raise ValueError("Clipboard changed before capture was committed")
    clipboard["sequence_after_post_read_guard"] = final_sequence
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]{7,79}", args.attempt_id):
        raise ValueError("Invalid capture attempt ID")
    folder = ROOT / "research/evidence/blueprint-clipboard" / args.attempt_id
    for parent in [folder, *folder.parents]:
        if parent.exists() and (parent.is_symlink() or getattr(parent.lstat(), "st_file_attributes", 0) & 0x400):
            raise ValueError("Reparse path rejected")
        if parent == ROOT:
            break
    folder.mkdir(parents=True, exist_ok=False)
    payload = text.encode("utf-8")
    # Only the validated task-specific text is persisted; never print clipboard data.
    with (folder / "native-print-string.clipboard.txt").open("xb") as stream:
        stream.write(payload)
    result = {"status": "COPIED_NODE_CAPTURED_PASTE_NOT_PERFORMED",
              "created_utc": datetime.now(timezone.utc).isoformat(),
              "payload": {"path": str(folder / "native-print-string.clipboard.txt"),
                          "bytes": len(payload), "sha256": sha(payload), "encoding": "UTF-8"},
              "reviewed_capture": {"path": str(rp), "sha256": sha(receipt_bytes),
                                   "image_sha256": args.image_sha256,
                                   "image": {"path": str(png), "bytes": len(image_bytes),
                                             "sha256": args.image_sha256, "size": image_size},
                                   "review_region": review_region,
                                   "pixel_comparison": "EXACT_REGION" if review_region else "EXACT_FULL_IMAGE",
                                   "before_pixel_check": before_pixel_check,
                                   "after_pixel_check": after_pixel_check},
              "bridge_sha256": args.bridge_sha256, "helper_sha256": sha(Path(__file__).read_bytes()),
              "editor_identity": receipt["identity"], "protected_source_and_backup": protected,
              "clipboard_read": clipboard, "validation": validation,
              "actions": {"clipboard_writes": 0, "input": 0, "unreal_api": 0, "asset_writes": 0},
              "limitations": ["No origin authentication independent of observed UI Copy",
                              "No engine parse, paste, compile, save or runtime validation"]}
    with (folder / "capture.json").open("x", encoding="utf-8") as stream:
        json.dump(result, stream, indent=2)
        stream.write("\n")
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--receipt", required=True)
    parser.add_argument("--image-sha256", required=True)
    parser.add_argument("--bridge-sha256", required=True)
    parser.add_argument("--attempt-id", required=True)
    parser.add_argument("--review-region", nargs=4, type=int,
                        help="Explicit exact pixel rectangle for animated editor chrome; minimum10000 pixels")
    print(json.dumps(capture(parser.parse_args())))
