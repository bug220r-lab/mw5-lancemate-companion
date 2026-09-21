"""Bounded offline checks for the next loaded-only source batch. MOCK_ONLY."""
import datetime
import hashlib
import json
from pathlib import Path
import runpy
import sys
import uuid

PROJECT = Path(__file__).resolve().parent.parent
PROBE = PROJECT / "scripts" / "Export-FollowOrderSources.py"
PACKAGES = (
    "/Game/Modes/MissionDirectorSystem/MissionComponents/SquadOrders/FollowOrder",
    "/Game/Modes/MissionDirectorSystem/MissionComponents/SquadOrders/SquadOrderBase",
    "/Game/AI/Jobs/Ally_FollowJob",
)


def main():
    namespace = runpy.run_path(str(PROBE), run_name="offline_follow_validation")
    fixture = runpy.run_path(str(PROJECT / "scripts" / "Validate-BlueprintExportProbe.py"),
                             run_name="offline_fake_api_only")
    assert namespace["ASSETS"] == PACKAGES
    paths = tuple(p + "." + p.rsplit("/", 1)[1] for p in PACKAGES)
    fake = fixture["strict_api"]
    fake.__globals__["OBJECT_PATHS"] = paths
    stamp = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    output = PROJECT / "research" / "evidence" / "editor-source" / (
        "follow-export-validation-" + stamp + "-" + uuid.uuid4().hex[:8])
    output.mkdir(exist_ok=False)
    tests = []
    cases = (
        ("all-three-loaded", (True, True, True), [{}, {}, {}], 3, 3),
        ("missing-first-continues", (False, True, True), [{}, {}, {}], 3, 2),
        ("missing-middle-continues", (True, False, True), [{}, {}, {}], 3, 2),
        ("none-loaded-no-export", (False, False, False), [{}, {}, {}], 3, 0),
        ("reported-error-stops", (True, True, True),
         [{"errors": ["MOCK reported error"]}, {}, {}], 1, 1),
        ("native-false-stops", (True, True, True), [{"return": False}, {}, {}], 1, 1),
        ("missing-markers-stops", (True, True, True), [{"raw": b"MOCK no graph"}, {}, {}], 1, 1),
    )
    for name, loaded, plans, lookups, exports in cases:
        record = {"id": name, "result": "FAIL"}
        try:
            case_root = output / name
            (case_root / "research" / "evidence" / "editor-source").mkdir(parents=True)
            api, state = fake(case_root, loaded=loaded, formats=("T3D", "COPY"), plans=plans)
            receipt = namespace["run_probe"](api, case_root)
            report = json.loads(receipt.read_text(encoding="utf-8"))
            assert not state["violations"]
            assert state["finds"] == list(paths[:lookups])
            assert len(state["exports"]) == exports
            assert report["gameplay"] == "NOT_PERFORMED"
            assert not report["errors"]
            assert all(Path(x["file"]).suffix == ".COPY" for x in state["exports"])
            for index, present in enumerate(loaded[:lookups]):
                if not present:
                    assert report["assets"][index]["status"] == "NOT_ALREADY_LOADED_SKIPPED"
            if name == "reported-error-stops":
                assert report["assets"][0]["status"] == "EXPORT_REPORTED_ERRORS"
            record.update(result="PASS", receipt=str(receipt))
        except Exception as exc:
            record["error"] = type(exc).__name__ + ": " + str(exc)
        tests.append(record)
    summary = {
        "classification": "MOCK_ONLY", "native_export": "NOT_PERFORMED",
        "probe_sha256": hashlib.sha256(PROBE.read_bytes()).hexdigest(),
        "validator_sha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        "fake_api_sha256": hashlib.sha256((PROJECT / "scripts" / "Validate-BlueprintExportProbe.py").read_bytes()).hexdigest(),
        "scope": "Three exact loaded-only asset lookups and new skip/error boundaries",
        "limits": "No Unreal import, native execution, graph completeness, hard resource bounds or gameplay tested.",
        "tests": tests, "passed": sum(x["result"] == "PASS" for x in tests),
        "test_count": len(tests),
    }
    summary_path = output / "summary.json"
    with summary_path.open("x", encoding="utf-8") as handle:
        json.dump(summary, handle, indent=2)
        handle.write("\n")
    print(json.dumps({"summary": str(summary_path), "passed": summary["passed"],
                      "test_count": summary["test_count"]}))
    return 0 if summary["passed"] == summary["test_count"] else 1


if __name__ == "__main__":
    sys.exit(main())
