"""Offline clone foundation for the exact observed native BPGraph envelope.

Preserves the observed string input/output, Boolean local and entry/return link.
Changes only graph/function name, node names, NodeGuid, PinId and local VarGuid.
Does not invent function GUIDs, local get/set references, parameter types or
serialization fields. No native/clipboard actions. Generic T3D escaping is not
claimed: this source fixture contains only escaped quote, CR and LF sequences.
"""
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
import uuid

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'research/evidence/phase-b-function-fragment-20260927-01'
SOURCE = ROOT / 'research/evidence/phase-b-function-copy-proof-20260927-01/native-function.clipboard.txt'
SOURCE_SHA = '9cbf49aab8004e245fdc4e28ea2a7ed6eadee0f4944addc86b0a04ffbdd49258'
FORMAT_REVIEW = ROOT / 'research/evidence/phase-b-function-copy-proof-20260927-01/format-review.json'
FORMAT_REVIEW_SHA = '82fed3835f77eb9bf8f9a284a2fe69ce68afbe2f9ef47c8370c5fa2bd4f562c7'
BLUEPRINT = '/Game/CodexEditorControlScratch20260925/BP_CodexAuthoringProbe.BP_CodexAuthoringProbe'
OLD_FUNCTION = 'ProofHelper'
NEW_FUNCTION = 'ProofHelperGenerated'
NODE_NAMES = {'K2Node_FunctionEntry_0': 'K2Node_FunctionEntry_820',
              'K2Node_FunctionResult_0': 'K2Node_FunctionResult_821'}
MAX_BYTES = 8192


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def split_graph(raw):
    if not isinstance(raw, bytes) or not 0 < len(raw) <= MAX_BYTES:
        raise ValueError('BPGRAPH_BYTE_BOUND')
    text = raw.decode('utf-8')
    match = re.match(r'BPGraph\(GraphName="([A-Za-z][A-Za-z0-9_]*)",GraphType=GT_Function,OriginalBlueprint=Blueprint\'"([^"\r\n]+)"\',NodesString=', text)
    if not match or match.group(2) != BLUEPRINT:
        raise ValueError('EXACT_BPGRAPH_ENVELOPE_REQUIRED')
    encoded = text[match.end():]
    try:
        nodes, end = json.JSONDecoder().raw_decode(encoded)
    except (ValueError, TypeError):
        raise ValueError('NODESTRING_ESCAPING_INVALID')
    if not isinstance(nodes, str) or encoded[end:] != ')' or json.dumps(nodes, ensure_ascii=False) != encoded[:end]:
        raise ValueError('EXACT_OBSERVED_ESCAPE_ROUNDTRIP_REQUIRED')
    if '\n' in nodes.replace('\r\n', '') or '\r' in nodes.replace('\r\n', ''):
        raise ValueError('NATIVE_CRLF_REQUIRED')
    if set(re.findall(r'\\(.)', encoded[:end])) - {'"', 'r', 'n'}:
        raise ValueError('UNOBSERVED_ESCAPE_SEQUENCE')
    return {'function': match.group(1), 'blueprint': match.group(2), 'nodes': nodes}


def encode_graph(function, nodes):
    return ('BPGraph(GraphName="' + function + '",GraphType=GT_Function,OriginalBlueprint=Blueprint\'"'
            + BLUEPRINT + '"\',NodesString=' + json.dumps(nodes, ensure_ascii=False) + ')').encode('utf-8')


def load_source():
    raw = SOURCE.read_bytes()
    if len(raw) != 3647 or digest(raw) != SOURCE_SHA or digest(FORMAT_REVIEW.read_bytes()) != FORMAT_REVIEW_SHA:
        raise ValueError('NATIVE_FUNCTION_SOURCE_DRIFT')
    graph = split_graph(raw)
    if graph['function'] != OLD_FUNCTION or len(graph['nodes'].encode()) != 3367:
        raise ValueError('NATIVE_FUNCTION_SCHEMA_DRIFT')
    roles = {}
    for field, old in re.findall(r'\b(NodeGuid|PinId|VarGuid)=([0-9A-F]{32})', graph['nodes']):
        if old in roles:
            raise ValueError('SOURCE_ID_COLLISION')
        roles[old] = field
    if sorted(roles.values()) != sorted(['NodeGuid'] * 2 + ['PinId'] * 4 + ['VarGuid']):
        raise ValueError('EXACT_OBSERVED_GUID_FIELDS_REQUIRED')
    if graph['nodes'].count('FunctionReference=(MemberName="ProofHelper")') != 2 or 'MemberGuid=' in graph['nodes']:
        raise ValueError('NO_INVENTED_FUNCTION_GUID_BINDING')
    graph.update({'raw': raw, 'guid_roles': roles})
    return graph


def fresh_map(source):
    return {old: uuid.uuid4().hex.upper() for old in source['guid_roles']}


def render(source, function, mapping, existing_functions):
    if source['raw'] != SOURCE.read_bytes() or digest(source['raw']) != SOURCE_SHA:
        raise ValueError('SOURCE_BINDING_CHANGED')
    if source['nodes'] != split_graph(source['raw'])['nodes']:
        raise ValueError('SOURCE_BODY_CHANGED')
    if not re.fullmatch(r'[A-Za-z][A-Za-z0-9_]{0,63}', function) or function in set(existing_functions) | {OLD_FUNCTION}:
        raise ValueError('FRESH_VALID_FUNCTION_NAME_REQUIRED')
    if set(mapping) != set(source['guid_roles']) or len(set(mapping.values())) != 7:
        raise ValueError('EXACT_SEVEN_FRESH_IDENTITIES_REQUIRED')
    if any(not isinstance(x, str) or not re.fullmatch('[0-9A-F]{32}', x) or x == '0' * 32 or x in source['nodes'] for x in mapping.values()):
        raise ValueError('GUID_NOT_FRESH')
    body = source['nodes']
    for old, new in mapping.items():
        body = re.sub(r'\b' + old + r'\b', new, body)
    for old, new in NODE_NAMES.items():
        body = re.sub(r'\b' + old + r'\b', new, body)
    body = body.replace('FunctionReference=(MemberName="' + OLD_FUNCTION + '")',
                        'FunctionReference=(MemberName="' + function + '")')
    return encode_graph(function, body)


def validate(payload, source, function, mapping, existing_functions):
    graph = split_graph(payload)
    if graph['function'] != function or payload != render(source, function, mapping, existing_functions):
        raise ValueError('SOURCE_PRESERVATION_MISMATCH')
    body = graph['nodes']
    if body.count('Begin Object ') != 2 or body.count('CustomProperties Pin (') != 4 or body.count('CustomProperties UserDefinedPin (') != 2:
        raise ValueError('NODE_PIN_DECLARATION_COUNTS')
    entry = re.search(r'PinId=([0-9A-F]{32}),PinName="then"[^\r\n]*LinkedTo=\(K2Node_FunctionResult_821 ([0-9A-F]{32}),\)', body)
    result = re.search(r'PinId=([0-9A-F]{32}),PinName="execute"[^\r\n]*LinkedTo=\(K2Node_FunctionEntry_820 ([0-9A-F]{32}),\)', body)
    if not entry or not result or entry.groups() != tuple(reversed(result.groups())) or body.count('LinkedTo=') != 2:
        raise ValueError('ENTRY_RETURN_RECIPROCAL_LINK_REQUIRED')
    locals_found = re.findall(r'LocalVariables\(0\)=\(VarName="NewLocalVar_0",VarGuid=([0-9A-F]{32}),VarType=\(PinCategory="bool"\)', body)
    old_local = next(k for k, v in source['guid_roles'].items() if v == 'VarGuid')
    if locals_found != [mapping[old_local]]:
        raise ValueError('EXACT_LOCAL_DECLARATION_REQUIRED')
    # Reverse the permitted transformations to prove every other source byte kept.
    restored = body.replace('FunctionReference=(MemberName="' + function + '")', 'FunctionReference=(MemberName="ProofHelper")')
    for old, new in NODE_NAMES.items():
        restored = re.sub(r'\b' + new + r'\b', old, restored)
    for old, new in mapping.items():
        restored = re.sub(r'\b' + new + r'\b', old, restored)
    if encode_graph(OLD_FUNCTION, restored) != source['raw']:
        raise ValueError('NATIVE_BYTES_NOT_REVERSIBLY_PRESERVED')
    return {'nodes': 2, 'pins': 4, 'user_defined_string_ports': 2, 'boolean_locals': 1,
            'reciprocal_internal_execution_edges': 1, 'external_links': 0, 'fresh_guids': 7,
            'invented_function_guids': 0, 'local_get_set_nodes': 0}


def main():
    source = load_source()
    mapping = fresh_map(source)
    known_functions = [OLD_FUNCTION]
    payload = render(source, NEW_FUNCTION, mapping, known_functions)
    checks = validate(payload, source, NEW_FUNCTION, mapping, known_functions)
    if OUT.resolve() != OUT.absolute() or any(p.exists() and (p.is_symlink() or getattr(p.lstat(), 'st_file_attributes', 0) & 0x400) for p in (OUT, *OUT.parents)):
        raise ValueError('OUTPUT_REDIRECTED')
    OUT.mkdir(exist_ok=True)
    dest = OUT / 'generated-function.clipboard.txt'
    audit = OUT / 'payload-audit.json'
    if dest.exists() or audit.exists():
        raise ValueError('NO_OVERWRITE')
    with dest.open('xb') as stream:
        stream.write(payload)
    record = {'status': 'PREPARED_OFFLINE_WHOLE_FUNCTION_GENERATION_NOT_NATIVE_VALIDATED',
              'created_utc': datetime.now(timezone.utc).isoformat(), 'payload': {'path': str(dest), 'bytes': len(payload), 'sha256': digest(payload)},
              'generator': {'path': str(Path(__file__)), 'sha256': digest(Path(__file__).read_bytes())},
              'native_source': {'path': str(SOURCE), 'sha256': SOURCE_SHA}, 'native_format_review': {'path': str(FORMAT_REVIEW), 'sha256': FORMAT_REVIEW_SHA},
              'function_name': NEW_FUNCTION, 'node_name_map': NODE_NAMES, 'guid_map': mapping, 'guid_roles': source['guid_roles'], 'checks': checks,
              'native_destination_name_check': 'NOT_PERFORMED_REQUIRED_BEFORE_PASTE',
              'limitations': ['Only the exact observed function skeleton is cloned; this is not a full Phase B body.',
                  'Local declaration GUID is refreshed, but no local getter/setter exists in the observed fixture; local access-node bindings remain unproven.',
                  'Function MemberGuid/GraphGuid are absent in native clipboard and are not invented.',
                  'OriginalBlueprint and all native parameter/local metadata are preserved. Current destination state must be checked separately.',
                  'Native import, compile, callable function behavior and runtime are NOT_PERFORMED. Clipboard remains untouched.']}
    with audit.open('x', encoding='utf-8') as stream:
        json.dump(record, stream, indent=2)
        stream.write('\n')
    print(json.dumps({'payload': record['payload'], 'checks': checks}, indent=2))


if __name__ == '__main__':
    main()
