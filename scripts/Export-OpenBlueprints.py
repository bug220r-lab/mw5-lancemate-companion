"""Inspection probe for the existing MW5 editor: File > Execute Python Script.

Exports at most two already-loaded Blueprint objects to a new project-local
folder. Does not load, save, compile or execute any Blueprint, or start a game.
Installed ObjectExporterT3D graph coverage is UNKNOWN until output is reviewed.
Native export is synchronous; byte/time checks do not interrupt a native call.
"""
import datetime
import hashlib
import json
from pathlib import Path
import re
import shutil
import time
import uuid


ASSETS = (
    "/Game/UI/Mech/DPad/DpadActionLogic/LanceCommands/Dpad_FormOnMeLogic",
    "/Game/UI/Mech/DPad/DpadActionLogic/LanceCommands/Dpad_LanceOrderDispatcher",
)
MAX_TEXT_BYTES = 8 * 1024 * 1024


def graph_markers(raw):
    if len(raw) > MAX_TEXT_BYTES:
        return {"status": "TOO_LARGE_FOR_INSPECTION"}
    if raw.startswith((b"\xff\xfe", b"\xfe\xff")):
        content = raw.decode("utf-16")
    else:
        content = raw.decode("utf-8-sig")
    nodes = len(re.findall(r"(?m)^\s*Begin Object\b[^\r\n]*Class=[^\r\n]*(?:K2Node|EdGraphNode)", content))
    linked = len(re.findall(r"\bLinkedTo\s*=", content))
    guids = len(re.findall(r"\bNodeGuid\s*=", content))
    return {
        "status": ("CANDIDATE_GRAPH_TEXT_REQUIRES_REVIEW" if nodes and linked and guids
                   else "NO_GRAPH_CONNECTION_EVIDENCE"),
        "node_declarations": nodes, "link_fields": linked, "node_guid_fields": guids,
    }


def run_probe(api, project_root):
    root = Path(project_root).resolve()
    evidence = (root / "research" / "evidence" / "editor-source").resolve()
    evidence.relative_to(root)  # Refuse a redirected output folder outside the project.
    if not evidence.is_dir():
        raise RuntimeError("Expected project evidence directory is missing")
    if shutil.disk_usage(str(evidence)).free < 1024 ** 3:
        raise RuntimeError("Less than 1 GiB free; export was not started")
    stamp = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    out = evidence / ("graph-export-probe-" + stamp + "-" + uuid.uuid4().hex[:8])
    out.mkdir(exist_ok=False)
    report = {
        "classification": "EDITOR_EXPORT_PROBE_REQUIRES_REVIEW",
        "started_utc": stamp, "output_directory": str(out),
        "script_sha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        "scope": "At most two explicitly named, already-loaded Blueprint assets",
        "limits": ["Native export is synchronous and has no enforced timeout or output-size cap.",
                   "The 8 MiB cap limits subsequent text inspection only.",
                   "Export success does not establish graph completeness or gameplay behavior."],
        "assets": [], "errors": [], "gameplay": "NOT_PERFORMED",
    }
    started = time.monotonic()
    try:
        exporter = api.ObjectExporterT3D()
        formats = [str(x) for x in exporter.get_editor_property("format_extension")]
        report["exporter"] = {"name": "ObjectExporterT3D", "formats": formats,
                              "text": bool(exporter.get_editor_property("text")),
                              "supported_class": str(exporter.get_editor_property("supported_class"))[:500]}
        extension = next((advertised for preferred in ("copy", "t3d")
                          for advertised in formats
                          if advertised.casefold() == preferred), None)
        if not report["exporter"]["text"] or extension is None:
            raise RuntimeError("Installed exporter does not advertise an expected text format")
        for package in ASSETS:
            if time.monotonic() - started > 30:
                report["errors"].append("Cooperative 30-second limit reached before next asset")
                break
            name = package.rsplit("/", 1)[1]
            object_path = package + "." + name
            record = {"object_path": object_path}
            report["assets"].append(record)
            asset = api.find_asset(object_path, type=api.Blueprint, follow_redirectors=False)
            if asset is None:
                record["status"] = "NOT_ALREADY_LOADED_SKIPPED"
                break  # The smaller first asset must qualify before trying the dispatcher.
            destination = out / (name + "." + extension)
            if destination.exists():
                raise RuntimeError("Refusing to overwrite an existing export")
            task = api.AssetExportTask()
            for key, value in {
                "object": asset, "exporter": exporter, "filename": str(destination),
                "automated": True, "prompt": False, "replace_identical": False,
                "selected": False, "use_file_archive": False, "write_empty_files": False,
            }.items():
                task.set_editor_property(key, value)
            record["native_export_return"] = bool(api.Exporter.run_asset_export_task(task))
            record["exporter_errors"] = [str(x)[:2000] for x in task.get_editor_property("errors")][:20]
            record["file"] = str(destination)
            if not destination.is_file():
                record["status"] = "NO_OUTPUT_FILE"
                break
            record["bytes"] = destination.stat().st_size
            if record["bytes"] > MAX_TEXT_BYTES:
                record["status"] = "TOO_LARGE_FOR_INSPECTION"
                break
            raw = destination.read_bytes()
            record["sha256"] = hashlib.sha256(raw).hexdigest()
            record["markers"] = graph_markers(raw)
            record["status"] = record["markers"]["status"]
            if not record["native_export_return"] or record["status"] != "CANDIDATE_GRAPH_TEXT_REQUIRES_REVIEW":
                break  # Preserve unsuccessful evidence; do not repeat on the larger asset.
    except Exception as exc:
        report["errors"].append(type(exc).__name__ + ": " + str(exc)[:3000])
    report["elapsed_seconds"] = round(time.monotonic() - started, 3)
    report_path = out / "report.json"
    with report_path.open("x", encoding="utf-8") as handle:
        json.dump(report, handle, indent=2)
        handle.write("\n")
    return report_path


if __name__ == "__main__":
    import unreal
    result = run_probe(unreal, Path(__file__).resolve().parent.parent)
    unreal.log("MW5_GRAPH_EXPORT_PROBE_REPORT: " + str(result))
