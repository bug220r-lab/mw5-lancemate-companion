"""Read Python API metadata from the existing, ready MW5 editor.

Use File > Execute Python Script. No assets, levels, UObjects or gameplay
functions are created, loaded, saved or called. This is editor inspection only.
The earlier commandlet revision is archived beside its failed run receipt.
"""

import datetime
import hashlib
import inspect
import json
from pathlib import Path
import re
import time
import types

import unreal


OUTPUT = (Path(__file__).resolve().parent.parent / "research" / "evidence"
          / "editor-source" / "native-reflection.json")
NAME_FILTER = re.compile(r"^MW|mech|lance|squad|pilot|order|victory|lowentry|telemetry", re.I)
PRIORITY = re.compile(r"^(MW|Victory|LowEntry)", re.I)
DOC_FILTER = re.compile(r"Module:\s*(?:MechWarrior|VictoryBPLibrary|LowEntryJson)\b")
CAPS = {"types": 500, "members_per_type": 500, "members_total": 4000,
        "doc_characters": 8000, "record_bytes": 4 * 1024 * 1024, "seconds": 10}
BUILTIN_METADATA = (types.FunctionType, types.BuiltinFunctionType,
                    types.MethodDescriptorType, types.WrapperDescriptorType,
                    types.GetSetDescriptorType, types.MemberDescriptorType,
                    type(dict.__dict__["fromkeys"]))


def plain_doc(value):
    """Read documentation, never bind a member on its Unreal owner or call it."""
    if isinstance(value, type):
        raw = type.__getattribute__(value, "__dict__").get("__doc__")
    elif type(value) in BUILTIN_METADATA:
        # Exact builtin types only: access Python metadata, not game state.
        raw = object.__getattribute__(value, "__doc__")
    else:
        raw = inspect.getattr_static(value, "__doc__", None)
    if type(raw) is not str:
        return "", "UNAVAILABLE_STATIC_DOCUMENTATION"
    return raw[:CAPS["doc_characters"]], (
        "TRUNCATED" if len(raw) > CAPS["doc_characters"] else "DIRECT_DOCUMENTATION")


def collect_metadata(module):
    started = time.monotonic()
    report = {
        "schema_version": 2,
        "observed_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "evidence": "OBSERVED_EDITOR_REFLECTION_ONLY",
        "intended_entrypoint": "Existing ready editor: File > Execute Python Script",
        "script_sha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        "scope": "Python type/member documentation; no gameplay or asset calls",
        "types": [], "errors": [], "stop_reasons": [], "caps": dict(CAPS),
        "limits": [
            "Metadata does not establish actor ownership, authority or accepted orders.",
            "No gameplay function, Blueprint graph, level or asset is executed or loaded.",
            "Editor exposure does not establish shipping exposure.",
            "Only direct members are captured; inherited or unexposed members may exist.",
            "Documentation may be missing or truncated; do not infer absent APIs.",
            "Elapsed-time checks are cooperative, not a hard timeout.",
            "Record-byte cap excludes small report metadata; not a process-memory cap.",
        ],
    }
    symbols = vars(module)
    names = sorted((name for name in symbols if not name.startswith("_")),
                   key=lambda name: (not bool(PRIORITY.search(name)), name))
    count_members = 0
    record_bytes = 0
    examined = 0
    for name in names:
        if time.monotonic() - started >= CAPS["seconds"]:
            report["stop_reasons"].append("TIME_CAP")
            break
        examined += 1
        try:
            symbol = symbols[name]  # No module __getattr__ or class member binding.
            if not isinstance(symbol, type):
                continue
            doc, doc_status = plain_doc(symbol)
            if not (NAME_FILTER.search(name) or DOC_FILTER.search(doc)):
                continue
            if len(report["types"]) >= CAPS["types"]:
                report["stop_reasons"].append("TYPE_CAP")
                break
            record = {"name": name, "doc": doc, "doc_status": doc_status,
                      "bases": [type.__getattribute__(base, "__name__") for base in
                                type.__getattribute__(symbol, "__bases__")],
                      "members": [], "members_truncated": False}
            for member_name, member in sorted(type.__getattribute__(symbol, "__dict__").items()):
                if member_name.startswith("_"):
                    continue
                if (len(record["members"]) >= CAPS["members_per_type"] or
                        count_members >= CAPS["members_total"] or
                        time.monotonic() - started >= CAPS["seconds"]):
                    record["members_truncated"] = True
                    break
                member_doc, member_status = plain_doc(member)
                record["members"].append({
                    "name": member_name,
                    "python_descriptor_type": type.__getattribute__(type(member), "__name__"),
                    "doc": member_doc, "doc_status": member_status,
                })
                count_members += 1
            size = len(json.dumps(record, ensure_ascii=False).encode("utf-8"))
            if record_bytes + size > CAPS["record_bytes"]:
                report["stop_reasons"].append("RECORD_BYTE_CAP")
                break
            record_bytes += size
            report["types"].append(record)
            if count_members >= CAPS["members_total"]:
                report["stop_reasons"].append("TOTAL_MEMBER_CAP")
                break
        except Exception as exc:
            report["errors"].append({"symbol": name, "error_type": type(exc).__name__})
            if len(report["errors"]) >= 20:
                report["stop_reasons"].append("ERROR_CAP")
                break
    report["symbols_examined"] = examined
    report["elapsed_seconds"] = round(time.monotonic() - started, 3)
    report["status"] = ("NO_MATCHING_TYPES" if not report["types"] else
                        "PARTIAL_REQUIRES_REVIEW" if report["errors"] or report["stop_reasons"]
                        or any(t["members_truncated"] or t["doc_status"] == "TRUNCATED" or
                               any(m["doc_status"] == "TRUNCATED" for m in t["members"])
                               for t in report["types"]) else "COLLECTED_REQUIRES_REVIEW")
    return report


def main(output=OUTPUT):
    temporary = output.with_suffix(".json.tmp")
    if output.exists() or temporary.exists():
        raise RuntimeError("Existing reflection evidence must be preserved; no scan performed")
    report = collect_metadata(unreal)
    output.parent.mkdir(parents=True, exist_ok=True)
    with temporary.open("x", encoding="utf-8") as stream:
        json.dump(report, stream, ensure_ascii=False)
    temporary.rename(output)  # Windows refuses replacement of an existing destination.
    unreal.log("MW5_RESEARCH_REFLECTION_COMPLETE types={} status={}".format(
        len(report["types"]), report["status"]))
    return report


if __name__ == "__main__":
    main()
