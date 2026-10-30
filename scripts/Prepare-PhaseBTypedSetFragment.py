"""Source-bound offline clipboard remapping; never imports Unreal or touches UI.

The fixed candidate targets only the two EXISTING members of the pinned scratch
Blueprint. It creates no member/function declarations or execution connections.
Reusable helpers copy registered node fields, remap internal links and remove
external graph links. They do not infer APIs, member GUIDs or pin specialization.
"""
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
import uuid

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'research/evidence/phase-b-typed-set-fragment-20260927-01'
DESTINATION = '/Game/CodexEditorControlScratch20260925/BP_CodexAuthoringProbe.BP_CodexAuthoringProbe'
ROOT_NAME = 'BP_CodexAuthoringProbe'
BASE_CLASS = '/Game/Objects/_common/Components/PlayerControllerComponents/PlayerControllerComponent.PlayerControllerComponent_C'
SOURCES = {
    'typed': ('research/evidence/phase-b-typed-variable-proof-20260927-01/typed.COPY', 'faf4d7cce4a304693576c9c2207b61a85b79987104d31e71b116ba6e43ffa829'),
    'typed_review': ('research/evidence/phase-b-typed-variable-proof-20260927-01/typed-review.json', '4c9af7017e67b4d7e212a025f66a62876cdf93c3aec4b755d0041d28be8c8c3d'),
    'indexer': ('scripts/Collect-PhaseBNodeExamples.py', '7e73f39107d864cb363705d1a559ff60b2fd816bc156f7237b4d0de8b734ed50'),
    'registration': ('scripts/Collect-PhaseBNodeExamplesV2.py', '0be2e7b27080c8acfd66cd44d24fe9c9ebedc060edb0fec261184b5e0a216c82'),
    'catalog_v2': ('research/evidence/phase-b-node-examples-20260927-v2-complete.json', '1b5fc129e2d5c09cb8464fe68b862d2642ae6e77d0991779ee6c2680c7118c0b'),
    'catalog_v3': ('research/evidence/phase-b-node-examples-20260927-v3-logic-string.json', '7b297d54d5cd429be21a372116953335e1761103e29b6d3bffd778ab3f4cfb9b'),
    'envelope': ('research/evidence/blueprint-clipboard/phase-b-printstring-20260927-01/native-print-string.clipboard.txt', '22740df09858c38504bfc8bc0ef1327493c453db3a0cf250096e49f4e85d2db9'),
}
SELECTED = ('EventGraph.K2Node_Self_700', 'EventGraph.K2Node_CallFunction_701',
            'EventGraph.K2Node_CallFunction_702', 'EventGraph.K2Node_VariableSet_1',
            'EventGraph.K2Node_VariableSet_0')
NEW_NAMES = ('K2Node_Self_800', 'K2Node_CallFunction_801', 'K2Node_CallFunction_802',
             'K2Node_VariableSet_803', 'K2Node_VariableSet_804')
POSITIONS = ((960, 960), (1280, 800), (1280, 1120), (1680, 800), (1680, 1120))
MAX_BYTES = 32 * 1024


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def decode(raw):
    return raw.decode('utf-16' if raw.startswith((b'\xff\xfe', b'\xfe\xff')) else 'utf-8-sig')


def pinned(path, expected):
    raw = path.read_bytes()
    if len(raw) > 8 * 1024**2 or sha(raw) != expected:
        raise ValueError('SOURCE_PIN_DRIFT: ' + str(path))
    return raw


def module(raw, path):
    namespace = {'__name__': 'pinned_lexical_helper', '__file__': str(path)}
    exec(compile(raw, str(path), 'exec'), namespace)
    return namespace


def record_sha(node):
    return sha(json.dumps(node, sort_keys=True).encode('utf-8'))


def attributes(text):
    """Split only top-level serialized fields; keep quoted/nested values intact."""
    parts, start, depth, quoted, escaped = [], 0, 0, False, False
    for i, char in enumerate(text):
        if escaped:
            escaped = False
            continue
        if char == '\\' and quoted:
            escaped = True
        elif char == '"':
            quoted = not quoted
        elif not quoted:
            if char == '(':
                depth += 1
            elif char == ')':
                depth -= 1
                if depth < 0:
                    raise ValueError('MALFORMED_FIELDS')
            elif char == ',' and depth == 0:
                parts.append(text[start:i])
                start = i + 1
    if quoted or depth:
        raise ValueError('MALFORMED_FIELDS')
    parts.append(text[start:])
    result = {}
    for part in filter(None, parts):
        key, sep, value = part.partition('=')
        if not sep or key in result:
            raise ValueError('DUPLICATE_OR_MALFORMED_FIELD')
        result[key] = value
    return result


def pin_fields(line):
    prefix = 'CustomProperties Pin ('
    if not line.startswith(prefix) or not line.endswith(')'):
        raise ValueError('PIN_SYNTAX')
    return attributes(line[len(prefix):-1])


def links(pin):
    value = pin.get('LinkedTo', '()')
    if not re.fullmatch(r'\((?:K2Node_\w+ [0-9A-F]{32},)*\)', value):
        raise ValueError('LINK_SYNTAX')
    return tuple(re.findall(r'(K2Node_\w+) ([0-9A-F]{32}),', value))


def checked_graph(nodes):
    """Return reciprocal internal links and explicitly dropped external links."""
    by_name = {n['relative_path'].rsplit('.', 1)[-1]: n for n in nodes}
    if len(by_name) != len(nodes):
        raise ValueError('DUPLICATE_NODE_NAME')
    pins, edges, removed = {}, set(), []
    for name, node in by_name.items():
        for row in node['pin_lines']:
            pin = pin_fields(row['text'])
            key = (name, pin['PinId'])
            if key in pins:
                raise ValueError('DUPLICATE_PIN_ID')
            pins[key] = pin
    for key, pin in pins.items():
        if len(set(links(pin))) != len(links(pin)):
            raise ValueError('DUPLICATE_LINK')
        for target in links(pin):
            if target[0] not in by_name:
                removed.append({'from': key, 'to': target})
                continue
            if target not in pins or key not in links(pins[target]):
                raise ValueError('NONRECIPROCAL_OR_DANGLING_INTERNAL_LINK')
            if pin.get('Direction', 'EGPD_Input') == pins[target].get('Direction', 'EGPD_Input'):
                raise ValueError('LINK_DIRECTION')
            if pin['PinType.PinCategory'] != pins[target]['PinType.PinCategory']:
                raise ValueError('LINK_CATEGORY')
            if pin['PinType.ContainerType'] != pins[target]['PinType.ContainerType']:
                raise ValueError('LINK_CONTAINER_TYPE')
            edges.add((key, target))
    return pins, edges, removed


def catalog_template(bundle, key):
    """Return exact source-bound registered example; no speculative specialization."""
    matches = [c['examples'][key] for c in bundle['catalogs'] if key in c['examples']]
    if len(matches) != 1:
        raise ValueError('CATALOG_TEMPLATE_MISSING_OR_AMBIGUOUS')
    example = matches[0]
    source = Path(example['source'])
    try:
        source.resolve().relative_to((ROOT / 'research/evidence/editor-source').resolve())
    except ValueError:
        raise ValueError('CATALOG_SOURCE_OUTSIDE_EVIDENCE')
    raw = pinned(source, example['source_sha256'])
    text = decode(raw)
    root_match = re.match(r'Begin Object Class=/Script/[A-Za-z0-9_.]+ Name="([^"]+)"', text)
    if not root_match:
        raise ValueError('CATALOG_ROOT_DECLARATION_REQUIRED')
    root_name = root_match.group(1)
    records = bundle['index'](text, root_name)
    node = next(r for r in records if r['relative_path'] == example['relative_path'])
    for field in ('class_path', 'begin_lines', 'fields', 'pin_lines'):
        if node[field] != example[field]:
            raise ValueError('CATALOG_SOURCE_DISAGREEMENT')
    if bundle['registration'](records, node) != example['registration']:
        raise ValueError('CATALOG_REGISTRATION_DISAGREEMENT')
    return node


def load_bundle():
    raw = {key: pinned(ROOT / item[0], item[1]) for key, item in SOURCES.items()}
    index = module(raw['indexer'], ROOT / SOURCES['indexer'][0])['source_nodes']
    registration = module(raw['registration'], ROOT / SOURCES['registration'][0])['registration']
    text = decode(raw['typed'])
    records = index(text, ROOT_NAME)
    by_path = {n['relative_path']: n for n in records}
    envelope = decode(raw['envelope']).splitlines()
    if len(envelope) != 17 or not envelope[0].startswith('Begin Object Class=/Script/BlueprintGraph.') or envelope[-1] != 'End Object':
        raise ValueError('NATIVE_ENVELOPE_DRIFT')
    nodes = [by_path[path] for path in SELECTED]
    for node in nodes:
        if not registration(records, node):
            raise ValueError('SOURCE_NODE_NOT_REGISTERED')
    bindings = {}
    for row in by_path['']['fields']:
        if row['text'].startswith('NewVariables('):
            data = attributes(row['text'].split('=', 1)[1][1:-1])
            bindings[data['VarName'].strip('"')] = {'guid': data['VarGuid'], 'type': data['VarType'], 'declaration': row}
    bundle = {'nodes': nodes, 'records': records, 'text': text, 'bindings': bindings,
              'index': index, 'registration': registration,
              'catalogs': [json.loads(raw[key].decode('utf-8-sig')) for key in ('catalog_v2', 'catalog_v3')],
              'fingerprints': {n['relative_path']: record_sha(n) for n in nodes},
              'pins': {k: {'path': str(ROOT / SOURCES[k][0]), 'bytes': len(v), 'sha256': sha(v)} for k, v in raw.items()}}
    check_bindings(bundle)
    for role, function in ((1, 'K2_GetComponentsByClass'), (2, 'GetPathName')):
        template = catalog_template(bundle, 'function:' + function)
        for node in (template, nodes[role]):
            if not any('MemberName="' + function + '"' in row['text'] for row in node['fields']):
                raise ValueError('FUNCTION_REFERENCE_DRIFT')
    checked_graph(nodes)
    return bundle


def check_bindings(bundle):
    expected = {'ProofOwnerPath': ('797594DD4AE67BA292738F9CEA4DDE77', '(PinCategory="string")'),
                'ProofComponents': ('015366E249BCC10191C2138BB26AEC08',
                    '(PinCategory="object",PinSubCategoryObject=BlueprintGeneratedClass\'"' + BASE_CLASS + '"\',ContainerType=Array)')}
    if set(bundle['bindings']) != set(expected):
        raise ValueError('DESTINATION_MEMBERS_CHANGED')
    for name, (guid, kind) in expected.items():
        binding = bundle['bindings'][name]
        if (binding['guid'], binding['type']) != (guid, kind):
            raise ValueError('DESTINATION_MEMBER_BINDING_DRIFT')
        sets = [n for n in bundle['nodes'] if any('VariableReference=(MemberName="' + name + '"' in f['text'] for f in n['fields'])]
        if len(sets) != 1:
            raise ValueError('EXACT_EXISTING_MEMBER_SET_REQUIRED')
        fields = [f['text'] for f in sets[0]['fields']]
        if 'VariableReference=(MemberName="' + name + '",MemberGuid=' + guid + ',bSelfContext=True)' not in fields:
            raise ValueError('SET_MEMBER_REFERENCE_DRIFT')
        pins = {pin_fields(p['text'])['PinName'].strip('"'): pin_fields(p['text']) for p in sets[0]['pin_lines']}
        actual = attributes(kind[1:-1])
        for label in (name, 'Output_Get'):
            for key, value in actual.items():
                if pins[label]['PinType.' + key] != value:
                    raise ValueError('SET_MEMBER_TYPE_DRIFT')
        if DESTINATION + '_C' not in pins['self']['PinType.PinSubCategoryObject']:
            raise ValueError('DESTINATION_SELF_CLASS_DRIFT')
        if links(pins['execute']) or links(pins['then']):
            raise ValueError('EXECUTION_MUST_REMAIN_DISCONNECTED')


def new_identifiers(bundle):
    return {n['relative_path']: {'name': name, 'node_guid': uuid.uuid4().hex.upper(),
            'pins': {pin_fields(p['text'])['PinId']: uuid.uuid4().hex.upper() for p in n['pin_lines']}}
            for n, name in zip(bundle['nodes'], NEW_NAMES)}


def remap_nodes(nodes, ids, baseline_text, positions):
    """Remap exact copied records, preserving fields/types and dropping outside links."""
    pins, edges, removed = checked_graph(nodes)
    if set(ids) != {n['relative_path'] for n in nodes} or len(positions) != len(nodes):
        raise ValueError('IDENTITY_SCOPE')
    by_old = {n['relative_path'].rsplit('.', 1)[-1]: ids[n['relative_path']] for n in nodes}
    guids, names = [], []
    for node in nodes:
        item = ids[node['relative_path']]
        if set(item) != {'name', 'node_guid', 'pins'} or set(item['pins']) != {pin_fields(p['text'])['PinId'] for p in node['pin_lines']}:
            raise ValueError('IDENTITY_SCHEMA')
        if not re.fullmatch(r'K2Node_\w+', item['name']) or 'Name="' + item['name'] + '"' in baseline_text:
            raise ValueError('DESTINATION_NAME_COLLISION')
        names.append(item['name'])
        guids.extend([item['node_guid']] + list(item['pins'].values()))
    if len(names) != len(set(names)) or len(guids) != len(set(guids)):
        raise ValueError('DUPLICATE_FRESH_ID')
    if any(not isinstance(g, str) or not re.fullmatch('[0-9A-F]{32}', g) or g == '0' * 32 or g in baseline_text for g in guids):
        raise ValueError('FRESH_ID_REQUIRED')
    blocks = []
    for node, (x, y) in zip(nodes, positions):
        item = ids[node['relative_path']]
        lines = ['Begin Object Class={} Name="{}"'.format(node['class_path'], item['name'])]
        for field in node['fields']:
            if field['text'].startswith(('NodePosX=', 'NodePosY=', 'NodeGuid=')):
                continue
            lines.append('   ' + field['text'])
        lines += ['   NodePosX=' + str(x), '   NodePosY=' + str(y), '   NodeGuid=' + item['node_guid']]
        for row in node['pin_lines']:
            line = row['text']
            p = pin_fields(line)
            line = line.replace('PinId=' + p['PinId'] + ',', 'PinId=' + item['pins'][p['PinId']] + ',', 1)
            line = re.sub(r'LinkedTo=\([^)]*\),', '', line)
            internal = [(n, g) for n, g in links(p) if n in by_old]
            if internal:
                value = ''.join(by_old[n]['name'] + ' ' + by_old[n]['pins'][g] + ',' for n, g in internal)
                line = line.replace('PersistentGuid=', 'LinkedTo=(' + value + '),PersistentGuid=', 1)
            lines.append('   ' + line)
        blocks.append('\r\n'.join(lines + ['End Object']))
    payload = ('\r\n'.join(blocks) + '\r\n').encode('utf-8')
    if not 1 <= len(payload) <= MAX_BYTES:
        raise ValueError('PAYLOAD_BOUND')
    return payload, removed


def render(bundle, ids, destination=DESTINATION):
    if destination != DESTINATION:
        raise ValueError('DESTINATION_REBINDING_NOT_PROVEN')
    check_bindings(bundle)
    if any(record_sha(n) != bundle['fingerprints'][n['relative_path']] for n in bundle['nodes']):
        raise ValueError('SOURCE_NODE_MUTATED')
    if tuple(ids[p]['name'] for p in SELECTED) != NEW_NAMES:
        raise ValueError('CANDIDATE_NODE_NAMES')
    return remap_nodes(bundle['nodes'], ids, bundle['text'], POSITIONS)[0]


def validate(payload, bundle, ids):
    if not isinstance(payload, bytes) or not 1 <= len(payload) <= MAX_BYTES:
        raise ValueError('PAYLOAD_BOUND')
    # Independent structural checks precede exact source-preservation comparison.
    text = payload.decode('utf-8')
    wrapped = 'Begin Object Class=/Script/Engine.Blueprint Name="Candidate"\n' + text + 'End Object\n'
    nodes = [n for n in bundle['index'](wrapped, 'Candidate') if n['relative_path']]
    if len(nodes) != 5 or sum(len(n['pin_lines']) for n in nodes) != 17:
        raise ValueError('CANDIDATE_NODE_PIN_COUNT')
    pins, edges, removed = checked_graph(nodes)
    if removed or len(edges) != 8:
        raise ValueError('EXACT_FOUR_INTERNAL_EDGES_REQUIRED')
    if any(links(p) for p in pins.values() if p['PinType.PinCategory'] == '"exec"'):
        raise ValueError('EXECUTION_MUST_REMAIN_DISCONNECTED')
    if payload != render(bundle, ids):
        raise ValueError('SOURCE_PRESERVATION_MISMATCH')
    return {'nodes': 5, 'pins': 17, 'reciprocal_data_edges': 4, 'external_links': 0,
            'connected_execution_pins': 0, 'existing_member_bindings': 2,
            'created_members': 0, 'created_functions': 0}


def main():
    bundle = load_bundle()
    ids = new_identifiers(bundle)
    payload = render(bundle, ids)
    checks = validate(payload, bundle, ids)
    expected = ROOT / 'research/evidence/phase-b-typed-set-fragment-20260927-01'
    if OUT != expected or OUT.resolve() != expected.absolute() or any(p.is_symlink() for p in (OUT, *OUT.parents)):
        raise ValueError('OUTPUT_PATH_DRIFT')
    OUT.mkdir(exist_ok=True)
    candidate = OUT / 'typed-set.clipboard.txt'
    audit_path = OUT / 'payload-audit.json'
    if candidate.exists() or audit_path.exists():
        raise ValueError('NO_OVERWRITE')
    audit = {'status': 'PREPARED_OFFLINE_NATIVE_IMPORT_NOT_PERFORMED', 'created_utc': datetime.now(timezone.utc).isoformat(),
             'generator': {'path': str(Path(__file__)), 'sha256': sha(Path(__file__).read_bytes())},
             'sources': bundle['pins'], 'destination': DESTINATION, 'destination_export_sha256': SOURCES['typed'][1],
             'member_bindings': bundle['bindings'], 'identifiers': ids, 'checks': checks,
             'payload': {'path': str(candidate), 'bytes': len(payload), 'sha256': sha(payload)},
             'limitations': ['Only this exact scratch Blueprint member binding is supported.',
                'No execution trigger: query/property setters do not execute merely from the generated data links.',
                'Native paste, compile, runtime query and full Phase B behavior remain NOT_PERFORMED for this candidate.',
                'Catalog v3 is available for source-bound lookup; no unrelated logic/string nodes are emitted.',
                'The output is a five-node authoring proof, not the full Phase B implementation.']}
    with candidate.open('xb') as stream:
        stream.write(payload)
    with audit_path.open('x', encoding='utf-8') as stream:
        json.dump(audit, stream, indent=2)
        stream.write('\n')
    print(json.dumps({'status': audit['status'], 'payload': audit['payload'], 'checks': checks}, indent=2))


if __name__ == '__main__':
    main()
