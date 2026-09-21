"""Synthetic collector validation only. Does not import the real Unreal module."""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import sys
import tempfile
import types

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "scripts" / "Inspect-EditorReflection.py"
EVIDENCE = ROOT / "research" / "evidence" / "editor-source"
fake = types.ModuleType("unreal")
calls = []


def forbidden(*args, **kwargs):
    calls.append("FORBIDDEN")
    raise AssertionError("The collector must not call synthetic gameplay or binding hooks")


class Trap:
    """Static descriptor documentation."""
    __get__ = forbidden


class MWTargetComponent:
    """Synthetic class; not an Unreal declaration."""
    synthetic_descriptor = Trap()
    synthetic_dangerous_call = forbidden
    builtin_method = str.upper
    builtin_class_method = dict.__dict__["fromkeys"]
    synthetic_property = property(forbidden)


fake.MWTargetComponent = MWTargetComponent
fake.__getattr__ = forbidden
fake.__dir__ = forbidden
fake.log = lambda message: calls.append("completion_marker")
sys.modules["unreal"] = fake
spec = importlib.util.spec_from_file_location("collector_under_test", str(SOURCE))
collector = importlib.util.module_from_spec(spec)
spec.loader.exec_module(collector)
checks = []


def check(name, condition):
    assert condition, name
    checks.append(name)


report = collector.collect_metadata(fake)
check("known_MW_type_included_without_Module_doc", len(report["types"]) == 1)
members = {m["name"]: m for m in report["types"][0]["members"]}
check("builtin_method_documentation_retained", bool(members["builtin_method"]["doc"]))
check("builtin_classmethod_documentation_retained", bool(members["builtin_class_method"]["doc"]))
check("no_gameplay_or_descriptor_binding", "FORBIDDEN" not in calls)
check("empty_namespace_not_reported_as_success", collector.collect_metadata(types.ModuleType("empty"))["status"] == "NO_MATCHING_TYPES")
original_caps = dict(collector.CAPS)
for key, value, expected in [("members_per_type", 0, None),
                             ("doc_characters", 10, None),
                             ("record_bytes", 1, "RECORD_BYTE_CAP"),
                             ("seconds", 0, "TIME_CAP")]:
    collector.CAPS.update(original_caps)
    collector.CAPS[key] = value
    bounded = collector.collect_metadata(fake)
    check("explicit_limit_" + key, expected in bounded["stop_reasons"] if expected else bounded["status"] == "PARTIAL_REQUIRES_REVIEW")
collector.CAPS.update(original_caps)
with tempfile.TemporaryDirectory(prefix="collector-mock-", dir=str(EVIDENCE)) as temp:
    # Verify scope before TemporaryDirectory's native Python cleanup.
    check("temporary_evidence_within_project", os.path.commonpath([str(Path(temp).resolve()), str(EVIDENCE.resolve())]) == str(EVIDENCE.resolve()))
    path = Path(temp) / "synthetic-only.json"
    original_collect = collector.collect_metadata
    collector.collect_metadata = forbidden
    for candidate in (path, path.with_suffix(".json.tmp")):
        candidate.write_text("preserve synthetic fixture", encoding="utf-8")
        try:
            collector.main(path)
        except RuntimeError:
            pass
        else:
            raise AssertionError("Existing evidence was not rejected")
        check("preflight_preserves_" + candidate.suffix, candidate.read_text(encoding="utf-8") == "preserve synthetic fixture" and "FORBIDDEN" not in calls)
        candidate.unlink()
    # Exercise publication with explicitly labelled synthetic data only.
    collector.collect_metadata = lambda module: dict(original_collect(module), evidence="MOCK_ONLY")
    collector.main(path)
    check("synthetic_publication_and_marker", json.loads(path.read_text(encoding="utf-8"))["evidence"] == "MOCK_ONLY" and calls == ["completion_marker"])
    collector.collect_metadata = original_collect

result = {"status": "PASS", "evidence": "MOCK_ONLY", "python": sys.version,
          "collector_sha256": hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
          "checks": checks, "check_count": len(checks),
          "limits": "Synthetic Python metadata and filesystem checks only; no real Unreal module, editor execution, assets or native calls. Unreal descriptor coverage remains unverified."}
destination = EVIDENCE / "reflection-collector-offline-validation.json"
with destination.open("x", encoding="utf-8") as output:
    json.dump(result, output, indent=2)
print(json.dumps(result))
