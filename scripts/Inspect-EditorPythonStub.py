"""Read generated Unreal declarations as text; never import or execute the stub."""
import argparse
import ast
import datetime
import hashlib
import io
import json
import os
from pathlib import Path
import re
import tokenize

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_STUB = Path(r"C:\Users\jlewi\AppData\Local\MW5Mercs\Intermediate\PythonStub\unreal.py")
SELECTED = set("""MWSquadMemberId MWSquadCommandOrderInfo MWSquadCommandOrderContext MWPlayerController
MWMech MWAIController MWSquad MWSquadCommandComponent MWSquadCommandOrder
MWSquadMemberDisplayInfo MWWorkerComponent MWJob JobChangedSig VictoryBPFunctionLibrary
LowEntryJsonLibrary LowEntryJsonParseResult LowEntryJsonValueFound Actor Pawn Controller
MWCommandType MWJobRunningState MWJobFinishReason MWJobPosting MWSquadDisplayInfo MWSquadInfo""".split())
BROAD = {"Actor", "Pawn", "Controller"}
BROAD_METHODS = set("""get_actor_location has_authority is_player_controlled
is_locally_controlled get_controller get_pawn k2_get_pawn""".split())
LOWENTRY = re.compile(r"^(json_parse_json_string|(?:object|array|value)_(?:get|is_set|length|"
                      r"to_json_string|(?:get|set)_(?:integer|null|string|boolean|float|json_value)))$")
SOURCE_CAP, CLASS_CAP = 64 * 1024 * 1024, 1024 * 1024
DOC_CAP, BROAD_DOC_CAP, SIGNATURE_CAP = 8192, 2048, 16384
CLASS_PATTERN = re.compile(r"^class\s+([A-Za-z_]\w*)\b")


def identity(stat):
    return {key: getattr(stat, key) for key in
            ("st_dev", "st_ino", "st_size", "st_mtime_ns", "st_ctime_ns")}


def capped(value, cap, label, truncations):
    value = value or ""
    if len(value) > cap:
        truncations.append({"item": label, "reason": "character_cap", "original_chars": len(value), "cap": cap})
    return value[:cap]


def header(lines, node):
    """Take only the definition header, ending at its unnested colon."""
    first = node.lineno - 1
    while not re.match(r"\s*(?:async\s+)?def\s+" + re.escape(node.name) + r"\b", lines[first]):
        first += 1  # Python 3.7 may attribute a decorated method to its first decorator.
    source = "".join(lines[first:])
    depth = 0
    for token in tokenize.generate_tokens(io.StringIO(source).readline):
        if token.type != tokenize.OP:
            continue
        if token.string in "([{":
            depth += 1
        elif token.string in ")]}":
            depth -= 1
        elif token.string == ":" and depth == 0:
            rows = source.splitlines(True)
            result = ("".join(rows[:token.end[0] - 1]) + rows[token.end[0] - 1][:token.end[1]]).strip()
            if len(result) > SIGNATURE_CAP:
                raise ValueError("Definition header exceeds signature cap")
            return result, first + 1
    raise ValueError("Definition header has no terminal colon")


def wanted(owner, name):
    if owner in BROAD:
        return name in BROAD_METHODS
    if owner == "VictoryBPFunctionLibrary":
        return bool(re.search(r"load_string|file_io_save_string", name))
    if owner == "LowEntryJsonLibrary":
        return bool(LOWENTRY.match(name))
    return True


def inspect_class(name, start, lines, byte_count, truncations):
    result = {"line": start, "captured_bytes": byte_count, "methods": [], "properties": [], "enums": []}
    if byte_count > CLASS_CAP:
        result["status"] = "NOT_PARSED_CLASS_SIZE_LIMIT"
        truncations.append({"item": name, "reason": "class_byte_cap", "bytes": byte_count, "cap": CLASS_CAP})
        return result
    tree = ast.parse("".join(lines), filename=name)
    if len(tree.body) != 1 or not isinstance(tree.body[0], ast.ClassDef) or tree.body[0].name != name:
        raise ValueError("Malformed captured class: " + name)
    cls, count = tree.body[0], 0
    enum_base = any(isinstance(b, ast.Name) and b.id in {"EnumBase", "Enum", "IntEnum"} for b in cls.bases)
    cap = BROAD_DOC_CAP if name in BROAD else DOC_CAP
    result.update(status="DECLARATIONS_ONLY", bases=[b.id if isinstance(b, ast.Name) else ast.dump(b) for b in cls.bases],
                  class_doc=capped(ast.get_docstring(cls, clean=False), cap, name + ".class_doc", truncations))
    for node in cls.body:
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and wanted(name, node.name):
            count += 1
            if count > (64 if name == "LowEntryJsonLibrary" else 256):
                continue
            decorators = [lines[d.lineno - 1].strip() for d in node.decorator_list]
            signature, signature_line = header(lines, node)
            entry = {"name": node.name, "line": start + signature_line - 1, "signature": signature,
                     "decorators": decorators, "doc": capped(ast.get_docstring(node, clean=False), cap,
                                                              name + "." + node.name, truncations)}
            is_property = any(d == "@property" or d.endswith((".setter", ".getter", ".deleter")) for d in decorators)
            result["properties" if is_property else "methods"].append(entry)
        elif isinstance(node, ast.Assign):
            call = node.value
            reflected = isinstance(call, ast.Call) and isinstance(call.func, ast.Name) and call.func.id == "_EnumEntry"
            try:
                literal = enum_base and type(ast.literal_eval(call)) is int
            except (ValueError, TypeError, SyntaxError, RecursionError):
                literal = False
            if reflected or literal:
                result["enums"].append({"line": start + node.lineno - 1,
                                        "declaration": capped(lines[node.lineno - 1].strip(), 2048,
                                                              name + ".enum", truncations)})
    retained = len(result["methods"]) + len(result["properties"])
    result["selected_method_count"] = count
    if count > retained:
        truncations.append({"item": name, "reason": "selected_method_cap", "omitted": count - retained})
    return result


def collect(stub):
    before = identity(stub.stat())
    if before["st_size"] > SOURCE_CAP:
        raise ValueError("Source exceeds 64 MiB cap")
    digest, classes, truncations = hashlib.sha256(), {}, []
    current, lines, start, size, total = None, [], 0, 0, 0
    with stub.open("rb") as stream:
        if identity(os.fstat(stream.fileno())) != before:
            raise ValueError("Source changed before reading")
        for number, raw in enumerate(stream, 1):
            total += len(raw)
            if total > SOURCE_CAP:
                raise ValueError("Source exceeded cap during reading")
            digest.update(raw)
            line = raw.decode("utf-8")
            boundary = bool(line.strip()) and not line[0].isspace() and not line.startswith("#")
            if boundary and current:
                classes[current] = inspect_class(current, start, lines, size, truncations)
                current, lines, size = None, [], 0
            match = CLASS_PATTERN.match(line)
            if boundary and match and match.group(1) in SELECTED:
                current, start = match.group(1), number
                if current in classes:
                    raise ValueError("Duplicate selected class: " + current)
            if current:
                size += len(raw)
                if size <= CLASS_CAP:
                    lines.append(line)
        if current:
            classes[current] = inspect_class(current, start, lines, size, truncations)
        after = identity(stub.stat())
        if before != after or before != identity(os.fstat(stream.fileno())) or total != before["st_size"]:
            raise ValueError("Source changed during inspection")
    return {"schema_status": "GENERATED_EDITOR_DECLARATIONS_ONLY", "schema_version": 1,
            "generated_at_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "source": {"path": str(stub), "sha256": digest.hexdigest().upper(), "bytes": total,
                       "stat_before": before, "stat_after": after, "stable_stat": True},
            "limits": {"source_bytes": SOURCE_CAP, "class_bytes": CLASS_CAP, "doc_chars": DOC_CAP,
                       "broad_doc_chars": BROAD_DOC_CAP, "signature_chars": SIGNATURE_CAP,
                       "selected_methods_per_class": 256, "lowentry_selected_methods": 64},
            "selected_classes": sorted(SELECTED), "classes": classes,
            "missing_classes": sorted(SELECTED - set(classes)), "truncations": truncations,
            "limitations": ["Only selected class blocks are parsed; this is not whole-file syntax validation.",
                            "Declarations and documentation only; no native implementation or runtime behavior proven.",
                            "No stub import/execution, Unreal calls, file I/O API calls or shipping validation."]}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--stub", type=Path, default=DEFAULT_STUB)
    parser.add_argument("--output", type=Path, default=ROOT / "research/evidence/editor-source/generated-stub-contracts.json")
    args = parser.parse_args()
    if os.name != "nt":
        raise ValueError("Publication relies on Windows no-replace rename semantics")
    output = args.output.resolve()
    if ROOT not in output.parents:
        raise ValueError("Output must remain inside this project; use a project-local fixture directory")
    temp = output.with_name(output.name + ".tmp")
    if output.exists() or temp.exists():
        raise FileExistsError("Refusing existing output or temporary path")
    report = collect(args.stub.resolve())
    output.parent.mkdir(parents=True, exist_ok=True)
    with temp.open("x", encoding="utf-8", newline="\n") as stream:
        json.dump(report, stream, indent=2, ensure_ascii=True)
        stream.write("\n")
        stream.flush()
        os.fsync(stream.fileno())
    temp.rename(output)
    print(str(output))


if __name__ == "__main__":
    main()
