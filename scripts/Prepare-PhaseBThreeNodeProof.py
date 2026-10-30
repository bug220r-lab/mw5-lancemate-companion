"""Offline fixed three-pure-node clipboard candidate; no Unreal/OS clipboard/UI.

Uses the native one-node envelope plus pinned registered COPY node bodies.
Only names/GUIDs/positions/internal links change. Not a generic graph generator.
"""
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
import uuid

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "research/evidence/phase-b-three-node-proof-20260927-01"
BASE_CLASS = "/Game/Objects/_common/Components/PlayerControllerComponents/PlayerControllerComponent.PlayerControllerComponent_C"
SOURCES = {
    "indexer": ("scripts/Collect-PhaseBNodeExamples.py", "7e73f39107d864cb363705d1a559ff60b2fd816bc156f7237b4d0de8b734ed50"),
    "catalog": ("research/evidence/phase-b-node-examples-20260927-v2-complete.json", "1b5fc129e2d5c09cb8464fe68b862d2642ae6e77d0991779ee6c2680c7118c0b"),
    "observer": ("research/evidence/editor-source/observer-authored-20260925T052357Z-b89383e2/BP_LanceObserverProbeComponent.COPY", "7ca123068c6a73ee2e4a9ca9bc970f3e3cd88223951be239edff1f2b9c212ce4"),
    "stock": ("research/evidence/editor-source/ai-research-collection-20260921T030437Z-f7d8e930/010-MW5PlayerController-source.COPY", "6faaa7cf5d925123441f8022bda01d7b3475c71849fff94758e7d2c6baa4b530"),
    "native_envelope": ("research/evidence/blueprint-clipboard/phase-b-printstring-20260927-01/native-print-string.clipboard.txt", "22740df09858c38504bfc8bc0ef1327493c453db3a0cf250096e49f4e85d2db9"),
    "restored_baseline": ("research/evidence/phase-b-clipboard-proof-20260927-01/restored.COPY", "e1209b0575a4aec6859fcf8a80412eb000666dd73cf9cfa3ae222a51680b010f"),
}
NAMES = {"self": "K2Node_Self_700", "query": "K2Node_CallFunction_701", "path": "K2Node_CallFunction_702"}
CLASSES = {"self": "/Script/BlueprintGraph.K2Node_Self", "query": "/Script/BlueprintGraph.K2Node_CallFunction", "path": "/Script/BlueprintGraph.K2Node_CallFunction"}
PINS = {"self": ("self",), "query": ("self", "ComponentClass", "ReturnValue"), "path": ("self", "Object", "ReturnValue")}
POSITIONS = {"self": (800, 640), "query": (1120, 480), "path": (1120, 800)}
EDGES = (("self", "self", "query", "self"), ("self", "self", "path", "Object"))
MAX_BYTES = 24 * 1024


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def pinned(key):
    relative, expected = SOURCES[key]
    p = ROOT / relative
    raw = p.read_bytes()
    if len(raw) > 8 * 1024**2 or digest(raw) != expected:
        raise ValueError("Source pin mismatch: " + key)
    return raw, {"path": str(p), "bytes": len(raw), "sha256": expected}


def decode(raw):
    return raw.decode("utf-16" if raw.startswith((b"\xff\xfe", b"\xfe\xff")) else "utf-8-sig")


def load_sources():
    raw, pins = {}, {}
    for key in SOURCES:
        raw[key], pins[key] = pinned(key)
    envelope = decode(raw["native_envelope"]).splitlines()
    if (len(envelope) != 17 or envelope[0] != 'Begin Object Class=/Script/BlueprintGraph.K2Node_CallFunction Name="K2Node_CallFunction_0"'
            or envelope[-1] != "End Object"):
        raise ValueError("Native clipboard envelope changed")
    namespace = {"__file__": str(ROOT / SOURCES["indexer"][0]), "__name__": "pinned_lexical_indexer"}
    exec(compile(raw["indexer"], namespace["__file__"], "exec"), namespace)
    index = namespace["source_nodes"]
    observer = {r["relative_path"]: r for r in index(decode(raw["observer"]), "BP_LanceObserverProbeComponent")}
    stock = {r["relative_path"]: r for r in index(decode(raw["stock"]), "MW5PlayerController")}
    catalog = json.loads(raw["catalog"].decode("utf-8-sig"))["examples"]
    nodes = {"self": observer["EventGraph.K2Node_Self_0"],
             "query": stock["AddPlayerControllerComponents.K2Node_CallFunction_75"],
             "path": observer["EventGraph.K2Node_CallFunction_6"]}
    for role, key in (("query", "function:K2_GetComponentsByClass"), ("path", "function:GetPathName")):
        for field in ("relative_path", "class_path", "begin_lines", "fields", "pin_lines"):
            if nodes[role][field] != catalog[key][field]:
                raise ValueError("Catalog/source node disagreement")
    graph_fields = [row["text"] for row in observer["EventGraph"]["fields"]]
    if sum(x == 'Nodes(21)=K2Node_Self\'"K2Node_Self_0"\'' for x in graph_fields) != 1:
        raise ValueError("Self node registration missing")
    if 'UbergraphPages(0)=EdGraph\'"EventGraph"\'' not in [r["text"] for r in observer[""]["fields"]]:
        raise ValueError("Self graph registration missing")
    for role, node in nodes.items():
        if node["class_path"] != CLASSES[role]:
            raise ValueError("Unexpected source node class")
        names = [re.search(r'PinName="([^"]+)"', p["text"]).group(1) for p in node["pin_lines"]]
        if tuple(names) != PINS[role]:
            raise ValueError("Unexpected source pins")
    return {"nodes": nodes, "pins": pins, "baseline": decode(raw["restored_baseline"])}


def new_identifiers(bundle):
    return {role: {"name": NAMES[role], "node_guid": uuid.uuid4().hex.upper(),
                   "pins": {name: uuid.uuid4().hex.upper() for name in PINS[role]}}
            for role in NAMES}


def check_identifiers(ids, bundle):
    if set(ids) != set(NAMES):
        raise ValueError("Three exact node roles required")
    all_guids = []
    for role in NAMES:
        item = ids[role]
        if set(item) != {"name", "node_guid", "pins"} or item["name"] != NAMES[role] or set(item["pins"]) != set(PINS[role]):
            raise ValueError("Unexpected generated identifiers")
        all_guids.extend([item["node_guid"], *item["pins"].values()])
        if re.search(r'Name="' + re.escape(item["name"]) + '"', bundle["baseline"]):
            raise ValueError("Generated node name already in restored graph")
    if any(not isinstance(g, str) or not re.fullmatch(r"[0-9A-F]{32}", g) or g == "0" * 32 for g in all_guids):
        raise ValueError("Fresh nonzero GUIDs required")
    if len(set(all_guids)) != len(all_guids) or any(g in bundle["baseline"] for g in all_guids):
        raise ValueError("Duplicate or baseline GUID collision")


def render(ids, bundle):
    check_identifiers(ids, bundle)
    links = {}
    for src, outpin, dst, inpin in EDGES:
        links.setdefault((src, outpin), []).append((dst, inpin))
        links.setdefault((dst, inpin), []).append((src, outpin))
    blocks = []
    for role, node in bundle["nodes"].items():
        lines = ['Begin Object Class={} Name="{}"'.format(CLASSES[role], NAMES[role])]
        for field in node["fields"]:
            line = field["text"]
            if line.startswith("NodePosX="):
                line = "NodePosX=" + str(POSITIONS[role][0])
            elif line.startswith("NodePosY="):
                line = "NodePosY=" + str(POSITIONS[role][1])
            elif line.startswith("NodeGuid="):
                line = "NodeGuid=" + ids[role]["node_guid"]
            lines.append("   " + line)
        for pin in node["pin_lines"]:
            line = pin["text"]
            name = re.search(r'PinName="([^"]+)"', line).group(1)
            line, replacements = re.subn(r"(?<=PinId=)[0-9A-F]{32}", ids[role]["pins"][name], line, count=1)
            if replacements != 1:
                raise ValueError("Missing source pin ID")
            line = re.sub(r"LinkedTo=\([^)]*\),", "", line)
            if links.get((role, name)):
                entries = "".join(NAMES[r] + " " + ids[r]["pins"][p] + "," for r, p in links[(role, name)])
                line = line.replace("PersistentGuid=", "LinkedTo=(" + entries + "),PersistentGuid=", 1)
            lines.append("   " + line)
        lines.append("End Object")
        blocks.append("\r\n".join(lines))
    return ("\r\n".join(blocks) + "\r\n").encode("utf-8")


def validate(payload, ids, bundle):
    if not isinstance(payload, bytes) or not 1 <= len(payload) <= MAX_BYTES:
        raise ValueError("Payload outside fixed byte bound")
    text = payload.decode("utf-8", errors="strict")
    if any(term in text for term in ("/LanceObserverProbe/", "MemberGuid=", "PinCategory=\"exec\"", "ExportPath=", "VariableReference=", "K2Node_Event", "K2Node_CustomEvent")):
        raise ValueError("Forbidden cross-asset/member/execution content")
    if (text.count("Begin Object ") != 3 or text.count("End Object") != 3 or text.count("CustomProperties Pin (") != 7
            or text.count("LinkedTo=(") != 3 or text.count(BASE_CLASS) != 2):
        raise ValueError("Unexpected envelope/pin/link/class count")
    # Exact reconstruction rejects any unapproved property, function, pin/type,
    # GUID, external link, omitted reciprocal edge or default-object alteration.
    if payload != render(ids, bundle):
        raise ValueError("Payload differs from exact pinned-source transformation")
    return {"classification": "MOCK_ONLY_STATIC_CANDIDATE_VALIDATION", "nodes": 3,
            "pins": 7, "internal_data_edges": 2, "external_links": 0,
            "execution_pins": 0, "variables": 0, "events": 0, "outputs_used": 0,
            "native_paste_compile": "NOT_PERFORMED", "runtime_query": "NOT_PERFORMED"}


def main():
    for p in [OUT, *OUT.parents]:
        if p.exists() and (p.is_symlink() or getattr(p.lstat(), "st_file_attributes", 0) & 0x400):
            raise ValueError("Output reparse path rejected")
        if p == ROOT:
            break
    if (OUT / "three-node.clipboard.txt").exists() or (OUT / "payload-audit.json").exists():
        raise ValueError("Fresh payload and audit files required")
    bundle = load_sources()
    ids = new_identifiers(bundle)
    payload = render(ids, bundle)
    validation = validate(payload, ids, bundle)
    OUT.mkdir(parents=True, exist_ok=True)
    destination = OUT / "three-node.clipboard.txt"
    with destination.open("xb") as stream:
        stream.write(payload)
    report = {"status": "PREPARED_OFFLINE_NOT_NATIVE_VALIDATED", "created_utc": datetime.now(timezone.utc).isoformat(),
              "payload": {"path": str(destination), "bytes": len(payload), "sha256": digest(payload), "encoding": "UTF-8", "line_endings": "CRLF"},
              "generator": {"path": str(Path(__file__).resolve()), "sha256": digest(Path(__file__).read_bytes())},
              "source_pins": bundle["pins"], "nodes": ids, "positions": POSITIONS,
              "edges": [dict(source_role=a, source_pin=b, target_role=c, target_pin=d) for a,b,c,d in EDGES],
              "validation": validation, "target": "/Game/CodexEditorControlScratch20260925/BP_CodexAuthoringProbe.BP_CodexAuthoringProbe:EventGraph",
              "admission": "Independent restored-graph review, payload review and separately reviewed bounded clipboard staging required before native Paste",
              "limitations": ["Generated multi-node native import and Self adaptation are unproven.", "Unused pure nodes may be compiled out; registered authoring-graph comparison is required.", "No variable/function GUID binding, native query, save, runtime, diagnostic, package or retail evidence."]}
    with (OUT / "payload-audit.json").open("x", encoding="utf-8") as stream:
        stream.write(json.dumps(report, indent=2) + "\n")
    print(json.dumps({"output": str(OUT), "payload": report["payload"], "validation": validation}))


if __name__ == "__main__":
    main()
