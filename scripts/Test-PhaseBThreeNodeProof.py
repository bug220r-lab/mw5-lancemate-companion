"""MOCK_ONLY fixed fragment checks; no OS clipboard, editor, asset or game call."""
import ast
import copy
import importlib.util
import json
from pathlib import Path
import re
import tempfile
import unittest
from unittest.mock import patch

PATH = Path(__file__).with_name("Prepare-PhaseBThreeNodeProof.py")
spec = importlib.util.spec_from_file_location("three_node_proof", PATH)
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


class ThreeNodeProofTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.bundle = m.load_sources()
        cls.audit = json.loads((m.OUT / "payload-audit.json").read_text(encoding="utf-8"))
        cls.ids = cls.audit["nodes"]
        cls.payload = (m.OUT / "three-node.clipboard.txt").read_bytes()

    def test_saved_candidate_exact_and_pinned(self):
        self.assertEqual(m.digest(self.payload), self.audit["payload"]["sha256"])
        self.assertEqual(len(self.payload), self.audit["payload"]["bytes"])
        self.assertEqual(m.digest(PATH.read_bytes()), self.audit["generator"]["sha256"])
        self.assertEqual(self.audit["source_pins"], self.bundle["pins"])
        self.assertEqual(m.validate(self.payload, self.ids, self.bundle)["internal_data_edges"], 2)
        self.assertEqual(self.payload, m.render(self.ids, self.bundle))

    def test_semantic_shape_and_bidirectional_edges(self):
        text = self.payload.decode("utf-8")
        sections = re.findall(r"Begin Object ([\s\S]*?)End Object", text)
        self.assertEqual(len(sections), 3)
        pins = {}
        for section in sections:
            node_name = re.search(r'Name="([^"]+)"', section).group(1)
            for line in section.splitlines():
                if "CustomProperties Pin (" not in line:
                    continue
                pin_id = re.search(r"PinId=([0-9A-F]{32})", line).group(1)
                refs = re.search(r"LinkedTo=\(([^)]*)\)", line)
                pins[(node_name, pin_id)] = re.findall(r"(K2Node_\w+) ([0-9A-F]{32}),", refs.group(1)) if refs else []
        self.assertEqual(len(pins), 7)
        self.assertEqual(sum(map(len, pins.values())), 4)
        for source, targets in pins.items():
            for target in targets:
                self.assertIn(target, pins)
                self.assertIn(source, pins[target])
        for role in ("query", "path"):
            self.assertEqual(pins[(self.ids[role]["name"], self.ids[role]["pins"]["ReturnValue"])], [])
        self.assertNotIn("PrintString", text)
        self.assertNotIn("/LanceObserverProbe/", text)
        self.assertNotIn('PinCategory="exec"', text)
        self.assertIn('PinType.ContainerType=Array', sections[1])
        self.assertIn('PinType.PinCategory="string"', sections[2])

    def test_wrong_functions_types_defaults_and_fields_rejected(self):
        text = self.payload.decode("utf-8")
        wrong = [text.replace('MemberName="GetPathName"', 'MemberName="ExecuteConsoleCommand"'),
                 text.replace("/Script/BlueprintGraph.K2Node_Self", "/Script/BlueprintGraph.K2Node_Event"),
                 text.replace(m.BASE_CLASS, "/Script/Engine.ActorComponent"),
                 text.replace(m.BASE_CLASS, "/LanceObserverProbe/BP_LanceObserverProbeComponent.BP_LanceObserverProbeComponent_C"),
                 text.replace('PinCategory="string"', 'PinCategory="object"'),
                 text.replace("ContainerType=Array", "ContainerType=None"),
                 text.replace("bOrphanedPin=False", "bOrphanedPin=True", 1),
                 text.replace("   NodePosX=800", '   VariableReference=(MemberName="Stale")'),
                 text.replace("End Object", "   UnexpectedProperty=True\r\nEnd Object", 1),
                 text.replace("Default__KismetSystemLibrary", "OtherLibrary")]
        for value in wrong:
            with self.subTest(value=value[:120]), self.assertRaises(ValueError):
                m.validate(value.encode("utf-8"), self.ids, self.bundle)

    def test_external_missing_and_asymmetric_links_rejected(self):
        text = self.payload.decode("utf-8")
        wrong = [text.replace("LinkedTo=(K2Node_CallFunction_701", "LinkedTo=(K2Node_CallFunction_999", 1),
                 re.sub(r"LinkedTo=\([^)]*\),", "", text, count=1),
                 text.replace(self.ids["query"]["pins"]["self"], "F" * 32, 1),
                 text.replace("PersistentGuid=", "LinkedTo=(K2Node_Event_0 " + "E" * 32 + ",),PersistentGuid=", 1)]
        for value in wrong:
            with self.subTest(value=value[:100]), self.assertRaises(ValueError):
                m.validate(value.encode("utf-8"), self.ids, self.bundle)

    def test_identifiers_collisions_and_unknown_pin_rejected(self):
        duplicate = copy.deepcopy(self.ids)
        duplicate["query"]["node_guid"] = duplicate["self"]["node_guid"]
        zero = copy.deepcopy(self.ids); zero["self"]["node_guid"] = "0" * 32
        collision = copy.deepcopy(self.ids)
        collision["self"]["node_guid"] = re.search(r"NodeGuid=([0-9A-F]{32})", self.bundle["baseline"]).group(1)
        unknown = copy.deepcopy(self.ids); unknown["query"]["pins"]["execute"] = "A" * 32
        wrong_name = copy.deepcopy(self.ids); wrong_name["self"]["name"] = "K2Node_Self_0"
        for ids in (duplicate, zero, collision, unknown, wrong_name):
            with self.subTest(ids=ids), self.assertRaises(ValueError):
                m.render(ids, self.bundle)

    def test_byte_bound_and_node_count(self):
        for value in (b"", self.payload * 2, self.payload + b" " * m.MAX_BYTES):
            with self.subTest(size=len(value)), self.assertRaises(ValueError):
                m.validate(value, self.ids, self.bundle)

    def test_source_pin_drift_rejected(self):
        with tempfile.TemporaryDirectory() as name:
            root = Path(name)
            p = root / m.SOURCES["indexer"][0]
            p.parent.mkdir(parents=True)
            p.write_text("changed", encoding="utf-8")
            with patch.object(m, "ROOT", root), self.assertRaisesRegex(ValueError, "Source pin mismatch"):
                m.load_sources()

    def test_existing_payload_not_overwritten(self):
        with patch.object(m, "load_sources", side_effect=AssertionError("must stop before read")):
            with self.assertRaisesRegex(ValueError, "Fresh payload"):
                m.main()
        self.assertEqual((m.OUT / "three-node.clipboard.txt").read_bytes(), self.payload)

    def test_python37_syntax_and_no_native_import(self):
        tree = ast.parse(PATH.read_text(encoding="utf-8"), feature_version=(3, 7))
        imported = {a.name for node in ast.walk(tree) if isinstance(node, (ast.Import, ast.ImportFrom)) for a in node.names}
        self.assertFalse(imported & {"unreal", "ctypes", "subprocess", "win32clipboard", "socket"})


if __name__ == "__main__":
    print("MOCK_ONLY: fixed generated payload and pinned-source validation; native import/query NOT_PERFORMED")
    unittest.main(verbosity=2)
