"""Project-authored synthetic process fixture. Never imports Unreal or loads assets."""
import argparse
import datetime
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import time
import uuid


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--control", required=True)
    parser.add_argument("--descendant", action="store_true")
    args = parser.parse_args()
    control_path = Path(args.control).resolve()
    if control_path.stat().st_size > 65536:
        raise ValueError("FIXTURE_CONTROL_TOO_LARGE")
    control = json.loads(control_path.read_text(encoding="utf-8"))
    attempt, parent = Path(control["attempt_dir"]), Path(control["evidence_parent"])
    root = Path(__file__).resolve().parents[2]
    relative = parent.resolve().relative_to(root / "research/evidence/editor-source")
    if (not relative.parts or not relative.parts[0].startswith("observer-supervisor-review-")
            or attempt.resolve().parent != parent.resolve() or control_path != attempt.resolve() / "child-control.json"
            or control.get("classification") != "MOCK_ONLY"):
        raise ValueError("SYNTHETIC_SCOPE_REQUIRED")
    mode = control.get("mode", "success")
    if mode not in ("success", "wait_stop", "ignore_stop", "crash", "flood", "child_hold", "ambiguous", "loading", "partial"):
        raise ValueError("UNKNOWN_FIXTURE_MODE")
    if args.descendant:
        while True:
            if (attempt / "STOP").exists():
                return
            time.sleep(0.02)
    if mode == "crash":
        print("SYNTHETIC_CRASH", flush=True)
        sys.exit(7)
    if mode == "flood":
        for _ in range(2048):
            sys.stdout.write("SYNTHETIC_LOG " * 512 + "\n")
            sys.stdout.flush()
            time.sleep(0.005)
        return
    if mode == "child_hold":
        child = subprocess.Popen([sys.executable, "-B", __file__, "--control", str(control_path), "--descendant"],
                                 creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
        print("SYNTHETIC_DESCENDANT_STARTED", flush=True)
        time.sleep(0.2)
        return
    if mode in ("wait_stop", "ignore_stop"):
        while True:
            if mode == "wait_stop" and (attempt / "STOP").exists():
                return
            time.sleep(0.02)
    stamp = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    output = parent / ("observer-references-" + stamp + "-" + uuid.uuid4().hex[:12])
    output.mkdir()
    status = "STOPPED_REGISTRY_LOADING" if mode == "loading" else "MOCK_ONLY_COMPLETED"
    targets = control["targets"]
    report = dict(status=status, classification="MOCK_ONLY", native_execution="NOT_PERFORMED",
                  gameplay="NOT_PERFORMED", asset_load_export_save_compile_cook="NOT_PERFORMED",
                  output_directory=str(output), source_before=targets, source_after=targets,
                  source_hashes_unchanged=True, script=control["helper_pin"], options=control["options"],
                  registry_loading_before=mode == "loading", queries=[], errors=[], total_retained_entries=0,
                  elapsed_seconds=0.02,
                  limits=dict(queries=3, per_target=512, total_entries=1024, name_characters=512,
                              encoded_name_bytes=768, report_bytes=1048576, cooperative_seconds=60))
    if mode != "loading":
        for target in targets:
            report["queries"].append(dict(package=target["package"], status="MOCK_ONLY", referencers=[],
                                           returned_count=0, retained_count=0, registry_loading_after=False))
    initial = dict(report, status="STARTED", source_after=None, queries=[], total_retained_entries=0)
    initial.pop("registry_loading_before", None)
    initial.pop("source_hashes_unchanged", None)
    (output / "started.json").write_text(json.dumps(initial), encoding="utf-8")
    checkpoints = 1 if mode in ("loading", "partial") else 4
    for index in range(checkpoints):
        checkpoint = dict(stage="GET_EXISTING_REGISTRY" if index == 0 else "QUERY " + targets[index-1]["package"],
                          elapsed_seconds=0.01, completed_query_count=max(0, index-1), native_execution="NOT_PERFORMED")
        (output / ("checkpoint-%02d.json" % index)).write_text(json.dumps(checkpoint), encoding="utf-8")
    if mode != "partial":
        (output / "report.json").write_text(json.dumps(report), encoding="utf-8")
    if mode == "ambiguous":
        (parent / ("observer-references-" + stamp + "-" + uuid.uuid4().hex[:12])).mkdir()
    with (attempt / "editor.log").open("x", encoding="utf-8") as stream:
        stream.write("SYNTHETIC_PARTIAL\n" if mode == "partial" else "Observer reference lookup: " + status + " | " + str(output) + "\n")
    print("SYNTHETIC_DONE", flush=True)


if __name__ == "__main__":
    main()
