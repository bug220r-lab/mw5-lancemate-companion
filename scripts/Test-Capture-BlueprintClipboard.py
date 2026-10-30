"""MOCK_ONLY envelope/Unicode tests. No clipboard, editor or Unreal access."""
import ast
from datetime import datetime, timezone
import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import types
import unittest
from unittest.mock import Mock, patch

from PIL import Image

path = Path(__file__).with_name("Capture-BlueprintClipboard.py")
spec = importlib.util.spec_from_file_location("clipboard_capture_under_test", path)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
bridge_spec = importlib.util.spec_from_file_location("clipboard_pixel_bridge", path.with_name("WindowBridge.py"))
bridge = importlib.util.module_from_spec(bridge_spec)
bridge_spec.loader.exec_module(bridge)

FIXTURE = '''Begin Object Class=/Script/BlueprintGraph.K2Node_CallFunction Name="K2Node_CallFunction_1"
   FunctionReference=(MemberParent=Class'/Script/Engine.KismetSystemLibrary',MemberName="PrintString")
   NodePosX=0
   NodePosY=0
   CustomProperties Pin (PinId=00000000000000000000000000000001,PinName="InString",DefaultValue="AUTHORING PROBE - NOT RUNTIME",LinkedTo=())
End Object
'''


class CaptureTests(unittest.TestCase):
    def test_synthetic_envelope(self):
        result = module.validate_payload(FIXTURE)
        self.assertEqual(result["node_count"], 1)
        self.assertIn("NOT_ENGINE_IMPORT", result["status"])

    def test_native_export_quoted_class_variant(self):
        self.assertEqual(module.validate_payload(FIXTURE.replace(
            "Class'/Script/Engine.KismetSystemLibrary'", 'Class\'"/Script/Engine.KismetSystemLibrary"\''))["node_count"], 1)

    def test_crlf_and_indentation(self):
        self.assertEqual(module.validate_payload("\r\n" + FIXTURE.replace("\n", "\r\n") + " \r\n")["node_count"], 1)

    def test_envelope_rejects(self):
        cases = ["", "unrelated private clipboard", FIXTURE * 2,
                 FIXTURE.replace("K2Node_CallFunction Name", "K2Node_CustomEvent Name"),
                 FIXTURE.replace("PrintString", "ExecuteConsoleCommand"),
                 FIXTURE.replace("/Script/Engine.KismetSystemLibrary", "/Script/Other.Class"),
                 FIXTURE.replace("AUTHORING PROBE - NOT RUNTIME", "other text"),
                 FIXTURE.replace("PinName=\"InString\"", "PinName=\"Other\""),
                 FIXTURE.replace("End Object", ""),
                 FIXTURE + "print('must not execute')", "\0" + FIXTURE,
                 FIXTURE.replace("NodePosX=0", "Begin Object Class=Other Name=\"Inner\"\nEnd Object"),
                 FIXTURE.replace("NodePosX=0", "FunctionReference=(MemberName=\"Other\")"),
                 FIXTURE + " " * 65536]
        for value in cases:
            with self.subTest(value=value[:70]):
                with self.assertRaises(ValueError):
                    module.validate_payload(value)

    def test_unicode_clipboard(self):
        self.assertEqual(module.decode_unicode_buffer(FIXTURE.encode("utf-16-le") + b"\0\0"), FIXTURE)

    def test_unicode_allocation_padding(self):
        self.assertEqual(module.decode_unicode_buffer(FIXTURE.encode("utf-16-le") + b"\0\0\0\0"), FIXTURE)

    def test_unicode_failures(self):
        for raw in [b"", b"a", b"a\0", b"\0\xd8\0\0", b"\0\0", b"a" * 65540]:
            with self.subTest(raw=raw[:10]):
                with self.assertRaises(ValueError):
                    module.decode_unicode_buffer(raw)

    def test_native_calls_are_read_only(self):
        tree = ast.parse(path.read_text(encoding="utf-8"))
        native = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == "read_native_clipboard")
        calls = {n.func.attr for n in ast.walk(native) if isinstance(n, ast.Call) and isinstance(n.func, ast.Attribute)}
        self.assertFalse(calls & {"SetClipboardData", "EmptyClipboard", "SendInput", "keybd_event", "mouse_event"})
        self.assertFalse(any(isinstance(n, (ast.Import, ast.ImportFrom)) and (
            getattr(n, "module", None) == "unreal" or any(a.name == "unreal" for a in getattr(n, "names", [])))
            for n in ast.walk(tree)))

    def test_optional_region_and_minimum_boundary(self):
        self.assertIsNone(module.validate_review_region(None, [1258, 686]))
        self.assertEqual(module.validate_review_region([195, 135, 940, 680], [1258, 686]), [195, 135, 940, 680])
        self.assertEqual(module.validate_review_region([0, 0, 100, 100], [100, 100]), [0, 0, 100, 100])

    def test_invalid_regions_rejected(self):
        for region in ([0, 0, 99, 100], [-1, 0, 200, 200], [0, 0, 1259, 686],
                       [195, 135, 940, 687], [940, 135, 195, 680], [0, 0, 0, 600],
                       [0, 0, 1258], [0, 0, 100.0, 100], [False, 0, 100, 100], "0 0 100 100"):
            with self.subTest(region=region), self.assertRaises(ValueError):
                module.validate_review_region(region, [1258, 686])

    def run_capture_fixture(self, *, region=None, change_inside=False, post_change_inside=False,
                            final_sequence=7, source_changed=False, dimensions_changed=False,
                            stale=False, identity_failed=False, image_pin_bad=False, receipt_size_bad=False,
                            expected_failed_reads=None):
        """Run capture with synthetic images and fake host services; no native calls."""
        with tempfile.TemporaryDirectory() as name:
            root = Path(name)
            session_dir = root / "session"
            folder = session_dir / "capture"
            folder.mkdir(parents=True)
            sp, rp, png = session_dir / "session.json", folder / "receipt.json", folder / "client.png"
            expected = Image.new("RGB", (1258, 686), "#182636")
            expected.save(png)
            current = expected.copy()
            current.putpixel((1200, 20), (0, 255, 0))  # animated chrome outside reviewed graph
            if change_inside:
                current.putpixel((400, 300), (255, 0, 0))
            after = current.copy()
            if post_change_inside:
                after.putpixel((400, 300), (255, 0, 0))
            if dimensions_changed:
                current = current.resize((1257, 686))
            receipt = {"session": str(sp), "mapping": "physical_capture_pixels_1_to_1",
                       "image": str(png), "sha256": module.sha(png.read_bytes()), "size": [1258, 686],
                       "identity": {"client_rect": [100, 100, 1358, 786]}, "focus_hwnd": 42,
                       "created_utc": "2000-01-01T00:00:00+00:00" if stale else datetime.now(timezone.utc).isoformat()}
            if receipt_size_bad:
                receipt["size"] = [1259, 686]
            rp.write_text(json.dumps(receipt), encoding="utf-8")
            session = {"kind": "editor-navigation", "title": "BP_CodexAuthoringProbe"}
            desktop = Mock()
            if identity_failed:
                desktop.guard.side_effect = RuntimeError("identity/focus changed")
            fake = types.ModuleType("_clipboard_test_bridge_services")
            fake.Image = Image
            fake.contained = lambda p: Path(p)
            fake.read_session = lambda p: (sp, session)
            fake.Desktop = lambda **kwargs: desktop
            fake.require_fresh_receipt = bridge.require_fresh_receipt
            fake.wait_reviewed_pixels = Mock(wraps=bridge.wait_reviewed_pixels)
            bp = root / "bridge.py"
            bp.write_text("from _clipboard_test_bridge_services import *\n", encoding="utf-8")
            args = types.SimpleNamespace(receipt=str(rp), image_sha256="0" * 64 if image_pin_bad else receipt["sha256"],
                        bridge_sha256=module.sha(bp.read_bytes()), attempt_id="synthetic-region-proof", review_region=region)
            pins = [{"source": "fixed"}]
            native_read = Mock(return_value=(FIXTURE, {"sequence_number": 7}))
            reads = [pins, pins, [{"source": "changed"}]] if source_changed else [pins, pins, pins]
            with patch.dict(sys.modules, {fake.__name__: fake}), patch.object(module, "ROOT", root), \
                    patch.object(module, "BRIDGE", bp), patch.object(module, "source_pins", side_effect=reads), \
                    patch.object(module, "read_native_clipboard", native_read), \
                    patch.object(module, "native_clipboard_sequence", return_value=final_sequence), \
                    patch.object(bridge.ImageGrab, "grab", side_effect=[current, after]):
                try:
                    result = module.capture(args)
                except (ValueError, RuntimeError):
                    self.assertFalse((root / "research/evidence/blueprint-clipboard").exists())
                    if expected_failed_reads is not None:
                        self.assertEqual(native_read.call_count, expected_failed_reads)
                    raise
            self.assertEqual(native_read.call_count, 1)
            self.assertEqual(fake.wait_reviewed_pixels.call_count, 2)
            for call in fake.wait_reviewed_pixels.call_args_list:
                self.assertEqual(call.args[-2:], (region, 0))
            self.assertGreaterEqual(desktop.guard.call_count, 6)
            self.assertEqual(result["reviewed_capture"]["image"]["sha256"], receipt["sha256"])
            self.assertEqual(result["clipboard_read"]["sequence_after_post_read_guard"], 7)
            self.assertEqual((root / "research/evidence/blueprint-clipboard/synthetic-region-proof/native-print-string.clipboard.txt").read_bytes(), FIXTURE.encode("utf-8"))
            return result

    def test_region_exact_allows_only_outside_chrome_change(self):
        result = self.run_capture_fixture(region=[195, 135, 940, 680])
        reviewed = result["reviewed_capture"]
        self.assertEqual(reviewed["review_region"], [195, 135, 940, 680])
        self.assertEqual(reviewed["pixel_comparison"], "EXACT_REGION")
        self.assertEqual(reviewed["before_pixel_check"]["samples"], 1)
        self.assertEqual(reviewed["after_pixel_check"]["samples"], 1)

    def test_default_whole_image_rejects_chrome_change(self):
        with self.assertRaisesRegex(RuntimeError, "Visible client changed"):
            self.run_capture_fixture()

    def test_invalid_region_stops_before_clipboard_read(self):
        with self.assertRaisesRegex(ValueError, "Review region too small"):
            self.run_capture_fixture(region=[0, 0, 99, 100], expected_failed_reads=0)

    def test_one_changed_pixel_inside_region_rejected_before_and_after(self):
        for flag in ("change_inside", "post_change_inside"):
            with self.subTest(flag=flag), self.assertRaisesRegex(RuntimeError, "Visible client changed"):
                self.run_capture_fixture(region=[195, 135, 940, 680], **{flag: True})

    def test_region_cannot_bypass_other_guards(self):
        for kwargs in ({"final_sequence": 8}, {"final_sequence": 0}, {"source_changed": True},
                       {"dimensions_changed": True}, {"stale": True}, {"identity_failed": True},
                       {"image_pin_bad": True}, {"receipt_size_bad": True}):
            with self.subTest(kwargs=kwargs), self.assertRaises((ValueError, RuntimeError)):
                self.run_capture_fixture(region=[195, 135, 940, 680], **kwargs)


if __name__ == "__main__":
    print("MOCK_ONLY: envelope, Unicode and exact-region guard tests with synthetic images/fake host; native capture NOT_PERFORMED")
    unittest.main(verbosity=2)
