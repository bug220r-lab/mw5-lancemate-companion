"""Read-only, bounded UE4.26/v7 registry inspection; no engine/library execution.

Only this project's recorded empty dependency/package-data variant is supported.
Schema references and interpretation limits are in the accompanying review.
The reviewed CUE4Parse source was read, never imported, built or executed.
"""

import argparse
import hashlib
import json
import struct
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
INPUT = ROOT / "research/evidence/retail-observer/startup-observation-20260925T061051Z/cooked-AssetRegistry.bin"
EXPECTED_SHA256 = "bad69d85cd2a54641c2e41f756708a7b7354c2f9bf490b3d8a10830e9636773a"
GUID = (0x717F9EE7, 0xE9B0493A, 0x88B39132, 0x1B388107)
SOURCE_COMMIT = "149cad578905243d181ab12ace556ed218f6563a"
SOURCE_ROOT = f"https://github.com/FabianFG/CUE4Parse/blob/{SOURCE_COMMIT}/CUE4Parse/UE4/"
SCHEMA_SOURCES = [
    ("AssetRegistry/FAssetRegistryState.cs", 3679, "af2aea451c116fa96d1b1cd2ae33f7eb1ab7702b2ddc41cfe748df8ff8ae5609", "constructor and Load"),
    ("AssetRegistry/Objects/FNameTableArchiveReader.cs", 2724, "e3e4d17293317e9ab0d9cce34bdef24efbf5436facf822074042b7e6c560e08a", "constructor, ReadFName, SerializeTagsAndBundles"),
    ("AssetRegistry/Objects/FAssetData.cs", 2030, "ae1db026752607f0f676bdce4941e97a925d1e7ca5d5764c69b5169575ee8cd2", "constructor field order and version gates"),
    ("Versions/FAssetRegistryVersion.cs", 4273, "3db711eeecca34b8e14c474bcbecbdb9be6df699e44f497375e68225b0ce476f", "enum and GUID/version serialization"),
    ("Objects/UObject/FNameEntrySerialized.cs", 5702, "743a7c38e8ec7be46cfe830a14f133d8272e52eef2f20f259e135cbcaec92c1c", "constructor string and two uint16 hashes"),
    ("AssetRegistry/Objects/FAssetRegistryHeader.cs", 650, "0bab084ecfa71ab11def210a49c12874bf5816414c14ae47e4726acbebd6c699", "constructor header version gate"),
    ("Readers/FArchive.cs", 31575, "0e8c3046d95b2905695441a5cba1f72b39c085f7e0d2b67807a981697e802b47", "ReadFString, lines 522-579; ReadArray"),
    ("Versions/EGame.cs", 17067, "7fda6cee2ec993626476ea5b949b8194be7849ed0c7e3cce3331a6f8aee3e8bd", "GetVersion UE4.26 mapping, lines 349-350"),
    ("Versions/ObjectVersion.cs", 117696, "ac2e5427f5870d7db41494def8f122202212f4b6e90e43af30efe5aee9b35c6e", "chunk array, package flags, name hashes and dependency flags enum entries"),
]


class InvalidRegistry(ValueError):
    """Invalid data or unsupported variant; do not infer partial success."""


class Reader:
    def __init__(self, data, start=0, end=None):
        self.data = data
        self.pos = start
        self.end = len(data) if end is None else end
        self.fnames = []
        self.strings = []

    def take(self, size):
        if size < 0 or self.pos + size > self.end:
            raise InvalidRegistry(f"Truncated field at {self.pos}, size {size}, section end {self.end}")
        start = self.pos
        self.pos += size
        return self.data[start:self.pos]

    def number(self, fmt):
        return struct.unpack("<" + fmt, self.take(struct.calcsize("<" + fmt)))[0]

    def count(self, label, minimum_size=1):
        value = self.number("i")
        if not 0 <= value <= (self.end - self.pos) // minimum_size:
            raise InvalidRegistry(f"Invalid {label} count {value} at {self.pos - 4}")
        return value

    def string(self):
        start = self.pos
        length = self.number("i")
        if length == 0:
            value = ""
        else:
            width = 2 if length < 0 else 1
            raw = self.take(abs(length) * width)
            if raw[-width:] != bytes(width):
                raise InvalidRegistry(f"Missing string terminator at {start}")
            try:
                # Narrow bytes in this input are ASCII. Reject unknown code-page
                # bytes rather than guessing their encoding.
                value = raw[:-width].decode("utf-16-le" if width == 2 else "ascii")
            except UnicodeDecodeError as exc:
                raise InvalidRegistry(f"Unsupported/invalid string encoding at {start}") from exc
            if "\0" in value:
                raise InvalidRegistry(f"Embedded string terminator at {start}")
        self.strings.append({"offset": start, "end": self.pos, "length_field": length})
        return value

    def fname(self, names):
        start = self.pos
        index = self.number("i")
        number = self.number("i")
        if not 0 <= index < len(names):
            raise InvalidRegistry(f"Invalid FName index {index} at {start}")
        if number != 0:
            raise InvalidRegistry(f"Numbered FName not supported by this bounded decoder at {start}")
        self.fnames.append({"offset": start, "index": index, "number": number})
        return names[index]["name"]


def decode(data):
    if len(data) > 65536:
        raise InvalidRegistry("Input exceeds bounded 64 KiB limit")
    header = Reader(data)
    guid = tuple(header.number("I") for _ in range(4))
    if guid != GUID:
        raise InvalidRegistry("AssetRegistry GUID mismatch")
    version = header.number("i")
    if version != 7:
        raise InvalidRegistry(f"Unsupported AssetRegistry version {version}; expected 7")
    name_offset = header.number("q")
    if not header.pos + 4 <= name_offset <= len(data) - 4:
        raise InvalidRegistry("Invalid name table offset")

    name_reader = Reader(data, name_offset)
    names = []
    name_count = name_reader.count("name", 8)
    for index in range(name_count):
        start = name_reader.pos
        name = name_reader.string()
        hashes = [name_reader.number("H"), name_reader.number("H")]
        names.append({"index": index, "offset": start, "end": name_reader.pos,
                      "name": name, "serialized_hashes_u16": hashes})
    if name_reader.pos != len(data):
        raise InvalidRegistry("Trailing bytes after name table")

    body = Reader(data, header.pos, name_offset)
    asset_count = body.count("asset", 52)
    assets = []
    for index in range(asset_count):
        start = body.pos
        fields = {}
        for label in ("object_path", "package_path", "asset_class", "package_name", "asset_name"):
            fields[label] = body.fname(names)
        tag_count_offset = body.pos
        tag_count = body.count("tag", 12)
        tags = []
        for _ in range(tag_count):
            tag_start = body.pos
            key = body.fname(names)
            value = body.string()
            if any(tag["key"] == key for tag in tags):
                raise InvalidRegistry("Duplicate tag key")
            tags.append({"offset": tag_start, "end": body.pos, "key": key, "value": value})
        chunk_count_offset = body.pos
        chunk_count = body.count("chunk", 4)
        chunks = [body.number("i") for _ in range(chunk_count)]
        flags_offset = body.pos
        flags = body.number("I")
        if fields["object_path"] != fields["package_name"] + "." + fields["asset_name"]:
            raise InvalidRegistry("Object path differs from package and asset name")
        if fields["package_name"].rpartition("/")[0] != fields["package_path"]:
            raise InvalidRegistry("Package path differs from package name directory")
        assets.append({"index": index, "offset": start, "end": body.pos, **fields,
                       "tag_count_offset": tag_count_offset, "tags": tags,
                       "chunk_count_offset": chunk_count_offset, "chunk_ids": chunks,
                       "package_flags_offset": flags_offset, "package_flags_u32": flags,
                       "package_flags_hex": f"0x{flags:08x}"})

    dependency_size_offset = body.pos
    dependency_size = body.number("q")
    if dependency_size != 4:
        raise InvalidRegistry("Only an empty dependency section (size 4) is supported")
    dependency_count_offset = body.pos
    dependency_count = body.number("i")
    if dependency_count != 0:
        raise InvalidRegistry("Nonempty dependency records are unsupported")
    package_count_offset = body.pos
    package_count = body.number("i")
    if package_count != 0:
        raise InvalidRegistry("Nonempty package-data records are unsupported")
    if body.pos != name_offset:
        raise InvalidRegistry("Unparsed body bytes before name table")

    return {
        "registry_guid_words": [f"{word:08x}" for word in guid],
        "registry_version": version, "registry_version_name": "AddedDependencyFlags",
        "engine_serialization_profile": "UE4.26 (object version 522); provided by package context, not encoded in registry",
        "name_table_offset": name_offset, "name_count": name_count, "names": names,
        "asset_count": asset_count, "assets": assets,
        "dependency_section": {"size_offset": dependency_size_offset, "size": dependency_size,
                               "count_offset": dependency_count_offset, "count": dependency_count},
        "package_data": {"count_offset": package_count_offset, "count": package_count},
        "fname_references": body.fnames,
        "strings": body.strings + name_reader.strings,
        "coverage": {"file_bytes": len(data), "parsed_bytes": len(data), "unparsed_bytes": 0,
                     "ranges_half_open": [[0, header.pos], [header.pos, name_offset], [name_offset, len(data)]],
                     "all_name_indices_valid": True, "all_fname_numbers_zero": True,
                     "string_terminators_valid": True, "serialized_name_hashes_recomputed": False}
    }


def checks(data, result):
    """Mutate bytes in memory only; malformed input must fail in decode itself."""
    cases = []

    def rejects(label, candidate):
        try:
            decode(candidate)
        except InvalidRegistry:
            cases.append(label)
            return
        raise AssertionError(f"Malformed input accepted: {label}")

    def changed(offset, fmt, value):
        candidate = bytearray(data)
        struct.pack_into("<" + fmt, candidate, offset, value)
        return candidate

    # Every proper byte-prefix, including cuts within fields and the name table.
    for length in range(len(data)):
        rejects(f"truncation:{length}", data[:length])
    for ref in result["fname_references"]:
        rejects(f"negative-name-index:{ref['offset']}", changed(ref["offset"], "i", -1))
        rejects(f"out-of-range-name-index:{ref['offset']}", changed(ref["offset"], "i", result["name_count"]))
    for item in result["strings"]:
        if item["length_field"]:
            candidate = bytearray(data)
            candidate[item["end"] - 1] = 65
            rejects(f"missing-terminator:{item['offset']}", candidate)
    rejects("invalid-guid", changed(0, "I", 0))
    rejects("unsupported-version", changed(16, "i", 8))
    for offset in (-1, 0, 28, len(data), len(data) + 1):
        rejects(f"bad-name-table-offset:{offset}", changed(20, "q", offset))
    rejects("negative-name-count", changed(result["name_table_offset"], "i", -1))
    rejects("excessive-name-count", changed(result["name_table_offset"], "i", 2147483647))
    rejects("negative-asset-count", changed(28, "i", -1))
    rejects("excessive-asset-count", changed(28, "i", 2147483647))
    rejects("excessive-string-length", changed(result["strings"][0]["offset"], "i", 2147483647))
    rejects("unsupported-numbered-fname", changed(result["fname_references"][0]["offset"] + 4, "i", 1))
    rejects("wrong-object-path-valid-index", changed(32, "i", 1))
    rejects("nonempty-dependencies", changed(result["dependency_section"]["count_offset"], "i", 1))
    rejects("bad-dependency-section-size", changed(result["dependency_section"]["size_offset"], "q", 5))
    rejects("nonempty-package-data", changed(result["package_data"]["count_offset"], "i", 1))
    rejects("trailing-byte", data + b"\0")
    for asset in result["assets"]:
        rejects(f"negative-tag-count:{asset['index']}", changed(asset["tag_count_offset"], "i", -1))
        rejects(f"negative-chunk-count:{asset['index']}", changed(asset["chunk_count_offset"], "i", -1))

    expected = {
        "BP_LanceObserverProbeComponent": "Blueprint",
        "DA_LanceObserverProbeRegistration": "PlayerControllerComponentDataAsset_C",
        "WBP_LanceObserverProbeReadout": "WidgetBlueprint",
    }
    assert {asset["asset_name"]: asset["asset_class"] for asset in result["assets"]} == expected
    assert result["asset_count"] == 3
    assert result["coverage"]["unparsed_bytes"] == 0
    return {"classification": "OFFLINE_PARSER_VALIDATION_ONLY", "status": "PASS",
            "expected_asset_identities_checked": 3, "malformed_inputs_rejected": len(cases),
            "all_proper_prefixes_rejected": len(data),
            "invalid_name_index_cases": 2 * len(result["fname_references"]),
            "malformed_case_labels": cases[len(data):],
            "does_not_test": "Engine deserialization, shipping mount/merge, load/cast, factory execution, component creation or UI"}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, default=INPUT)
    parser.add_argument("--output", type=Path, help="Optional project-local JSON receipt")
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    data = args.input.read_bytes()
    digest = hashlib.sha256(data).hexdigest()
    if len(data) != 2447 or digest != EXPECTED_SHA256:
        raise InvalidRegistry("Input is not the exact reviewed 2447-byte registry")
    result = decode(data)
    receipt = {"schema_version": 1, "recorded_utc": datetime.now(timezone.utc).isoformat(),
               "classification": "OBSERVED_OFFLINE_BINARY_METADATA",
               "status": "STRUCTURED_COOKED_REGISTRY_PARSE_PASS_RUNTIME_UNKNOWN",
               "input": {"path": str(args.input.resolve()), "bytes": len(data), "sha256": digest},
               "decoder": {"path": str(Path(__file__).resolve()),
                           "sha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
                           "stdlib_only": True, "maximum_input_bytes": 65536},
               "schema_source": {"project": "FabianFG/CUE4Parse", "commit": SOURCE_COMMIT,
                                 "accessed_date": "2026-09-25", "source_executed": False,
                                 "url_root": SOURCE_ROOT,
                                 "files": [{"path": path, "url": SOURCE_ROOT + path, "bytes": size,
                                            "sha256": source_hash, "section": section}
                                           for path, size, source_hash, section in SCHEMA_SOURCES]},
               "result": result,
               "limitations": ["Third-party serialization source, not a locally executed Unreal deserializer",
                               "Only registry version 7, zero-number FNames and empty dependency/package-data sections are supported",
                               "Name hashes are retained but not recomputed; narrow text must be ASCII",
                               "AssetRegistry tags do not contain or establish data asset bAddAtRuntime or ActorComponent property values",
                               "No shipping mount/merge, registry query, object load/cast, instance creation, factory timing, readout or recording acceptance"]}
    if args.self_test:
        receipt["validation"] = checks(data, result)
    payload = json.dumps(receipt, indent=2, ensure_ascii=False) + "\n"
    if args.output:
        output = args.output.resolve()
        if not output.is_relative_to(ROOT) or output == args.input.resolve() or output.suffix != ".json":
            raise InvalidRegistry("Output must be a separate project-local .json file")
        output.write_text(payload, encoding="utf-8")
        print(json.dumps({"status": receipt["status"], "output": str(output),
                          "asset_count": result["asset_count"],
                          "validation": receipt.get("validation", {}).get("status", "NOT_PERFORMED")}, indent=2))
    else:
        print(payload, end="")


if __name__ == "__main__":
    main()
