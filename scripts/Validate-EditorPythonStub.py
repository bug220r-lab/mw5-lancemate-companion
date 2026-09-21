"""MOCK_ONLY tests for text inspection; never load the real Unreal module."""
import argparse
import contextlib
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import sys
import tempfile
from unittest import mock

ROOT = Path(__file__).resolve().parent.parent
EVIDENCE = ROOT / "research/evidence/editor-source"
SOURCE = ROOT / "scripts/Inspect-EditorPythonStub.py"
spec = importlib.util.spec_from_file_location("stub_inspector", str(SOURCE))
inspector = importlib.util.module_from_spec(spec)
spec.loader.exec_module(inspector)
FIXTURE = '''raise RuntimeError("This source must never execute")
class MWCommandType(EnumBase):
    FOLLOW = _EnumEntry("MWCommandType", "FOLLOW", 2)

class MWSquadCommandOrderContext(StructBase):
    """Synthetic context declaration."""
    @property
    def issuer_pawn(self):
        """(Pawn): synthetic property documentation"""
        raise RuntimeError("No execution")

class MWPlayerController(PlayerController):
    """Synthetic owner, not a native game contract."""
    @classmethod
    def post_squad_order_class(cls, class_, squad_command_order_info):
        """Synthetic typed declaration only."""
        raise RuntimeError("No execution")
'''
checks = []


def check(name, condition):
    assert condition, name
    checks.append(name)


def rejected(name, operation, exception):
    try:
        operation()
    except exception:
        checks.append(name)
    else:
        raise AssertionError(name)


def run(stub, output):
    with mock.patch.object(sys, "argv", [str(SOURCE), "--stub", str(stub), "--output", str(output)]):
        with contextlib.redirect_stdout(io.StringIO()):
            inspector.main()


parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--report", type=Path, default=EVIDENCE / "stub-inspector-offline-validation.json")
args = parser.parse_args()
if args.report.exists():
    raise FileExistsError("Preserve the existing validation report; select a new --report")
with tempfile.TemporaryDirectory(prefix="stub-mock-", dir=str(EVIDENCE)) as temp:
    folder = Path(temp).resolve()
    assert os.path.commonpath([str(folder), str(EVIDENCE.resolve())]) == str(EVIDENCE.resolve())
    stub, output = folder / "synthetic.py", folder / "synthetic-report.json"
    stub.write_text(FIXTURE, encoding="utf-8")
    report = inspector.collect(stub)
    check("source_hashed_without_executing_module_or_members", report["source"]["sha256"] == hashlib.sha256(stub.read_bytes()).hexdigest().upper())
    check("specific_order_context_name_present", "MWSquadCommandOrderContext" in report["classes"])
    context = report["classes"]["MWSquadCommandOrderContext"]
    check("property_identified", len(context["properties"]) == 1 and context["properties"][0]["name"] == "issuer_pawn")
    method = report["classes"]["MWPlayerController"]["methods"][0]
    check("decorated_method_typed_header_and_doc", "def post_squad_order_class" in method["signature"] and "@classmethod" in method["decorators"] and "Synthetic typed declaration" in method["doc"])
    source_line = FIXTURE.splitlines()[method["line"] - 1].strip()
    check("line_attribution_points_to_declaration", source_line.startswith(("def post_squad_order_class", "@classmethod")))
    check("enum_text_retained_not_executed", "FOLLOW" in report["classes"]["MWCommandType"]["enums"][0]["declaration"])
    check("missing_classes_explicit", "MWMech" in report["missing_classes"])
    run(stub, output)
    check("publication_provenance_and_stability", json.loads(output.read_text(encoding="utf-8"))["source"]["stable_stat"] is True)
    preserved = output.read_bytes()
    rejected("final_collision_rejected", lambda: run(stub, output), FileExistsError)
    check("collision_preserves_bytes", output.read_bytes() == preserved)
    output.unlink()
    temporary = output.with_name(output.name + ".tmp")
    temporary.write_text("preserve", encoding="utf-8")
    rejected("temporary_collision_rejected", lambda: run(stub, output), FileExistsError)
    temporary.unlink()
    with mock.patch.object(inspector, "CLASS_CAP", 16):
        bounded = inspector.collect(stub)
        check("oversized_class_explicitly_unparsed", bool(bounded["truncations"]) and all(c["status"] == "NOT_PARSED_CLASS_SIZE_LIMIT" for c in bounded["classes"].values()))
    with mock.patch.object(inspector, "SOURCE_CAP", 16):
        rejected("oversized_source_rejected", lambda: inspector.collect(stub), ValueError)
    original_identity = inspector.identity
    identity_calls = [0]
    def changing_identity(stat):
        identity_calls[0] += 1
        result = original_identity(stat)
        if identity_calls[0] >= 3:
            result["st_mtime_ns"] += 1
        return result
    with mock.patch.object(inspector, "identity", changing_identity):
        rejected("concurrent_source_change_rejected", lambda: inspector.collect(stub), ValueError)
    stub.write_text(FIXTURE + "\nclass MWPlayerController(Object):\n    pass\n", encoding="utf-8")
    rejected("duplicate_selected_class_rejected", lambda: inspector.collect(stub), ValueError)
    stub.write_text("class MWPlayerController(Object):\n    def broken(\n", encoding="utf-8")
    rejected("malformed_selected_class_rejected", lambda: inspector.collect(stub), SyntaxError)

receipt = {"status": "PASS", "evidence": "MOCK_ONLY", "python": sys.version,
           "inspector_sha256": hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
           "check_count": len(checks), "checks": checks,
           "limits": "Synthetic text fixtures and filesystem checks only; no Unreal import, native execution, game state or shipping behavior."}
with args.report.open("x", encoding="utf-8") as stream:
    json.dump(receipt, stream, indent=2)
print(json.dumps(receipt))
