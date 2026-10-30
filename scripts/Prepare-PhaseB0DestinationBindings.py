"""Offline-only destination binding payloads; no Unreal, clipboard or asset writes."""
from datetime import datetime, timezone
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import uuid

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'research/evidence/phase-b0-destination-bindings-20260927-01'
CORE = ROOT / 'scripts/PhaseBBlueprintAssembly.py'
CORE_SHA = '385db1e4aec7276a5a8a3ad8262ac5b8e641f2082ff207d13332b4cb552176f0'
NATIVE = ROOT / 'research/evidence/phase-b-fixed-text-fixtures-native-01/fixtures.COPY'
NATIVE_SHA = '245dcd262b233bddc77116e4393c780501394654f71ab1823e6364106e46b34e'
REVIEW = NATIVE.parent / 'native-fixtures-review.json'
REVIEW_SHA = 'a537c045197c2b10448c733fb3048a831f143c9104f52abad2c05a94a434297b'
NATIVE_TEST = NATIVE.parent / 'native-test-result.json'
NATIVE_TEST_SHA = 'b907f2b0c18b95bb4390792e7d044c0bef739d35b62e72a6f0e9c523b4defc29'
PHASE_A = ROOT / 'research/evidence/editor-source/diagnostic-final-source-20260925T221745Z-530263a1/controller-source.COPY'
PHASE_A_SHA = '1c46d0589b6c79342fcba90857d0ea1970d463325a9eeb00a31e86fbd2afa0db'
DESTINATION = '/ModOverride/LanceObserverDiagnosticControl/Modes/InstantAction/InstantActionPlayerController.InstantActionPlayerController'
FUNCTIONS = ('ValidateBoundedIdentity', 'SegmentValidatedPath')
BASE_CLASS = '/Game/Objects/_common/Components/PlayerControllerComponents/PlayerControllerComponent.PlayerControllerComponent_C'


def pinned(path, sha):
    if path.stat().st_size > 4 * 1024 * 1024:
        raise ValueError('INPUT_TOO_LARGE')
    raw = path.read_bytes()
    if hashlib.sha256(raw).hexdigest() != sha:
        raise ValueError('SOURCE_DRIFT: ' + path.name)
    return raw


def pin(path):
    raw = path.read_bytes()
    return {'path': str(path), 'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()}


def rows(node):
    return [x['text'] for x in node['fields']] + [x['text'] for x in node['pin_lines']]


def node_text(nodes):
    return ''.join('Begin Object Class=' + n['class_path'] + ' Name="' +
                   n['relative_path'].rsplit('.', 1)[-1] + '"\r\n' +
                   ''.join('   ' + x + '\r\n' for x in rows(n)) + 'End Object\r\n'
                   for n in nodes)


def fresh_map(nodes, occupied, include_locals):
    own = set()
    for n in nodes:
        for row in rows(n):
            own.update(re.findall(r'\b(?:NodeGuid|PinId)=([0-9A-F]{32})', row))
            if include_locals and row.startswith('LocalVariables('):
                match = re.search(r'\bVarGuid=([0-9A-F]{32})', row)
                if not match:
                    raise ValueError('LOCAL_GUID_REQUIRED')
                own.add(match.group(1))
    result = {}
    for old in sorted(own):
        fresh = uuid.uuid4().hex.upper()
        while fresh in occupied:
            fresh = uuid.uuid4().hex.upper()
        occupied.add(fresh)
        result[old] = fresh
    return result


def remap(text, ids):
    return re.sub(r'\b[0-9A-F]{32}\b', lambda m: ids.get(m.group(0), m.group(0)), text)


def parsed_body(templates, body):
    records = templates.index('Begin Object Class=/Script/Engine.Blueprint Name="PayloadRoot"\n' +
                              body + '\nEnd Object', 'PayloadRoot')
    return [n for n in records if n['relative_path']]


def prepare():
    if OUT.exists():
        raise ValueError('FRESH_OUTPUT_DIRECTORY_REQUIRED')
    core_raw = pinned(CORE, CORE_SHA)
    spec = importlib.util.spec_from_file_location('destination_binding_core', CORE)
    core = importlib.util.module_from_spec(spec)
    exec(compile(core_raw, str(CORE), 'exec'), core.__dict__)
    templates = core.Templates()
    h = templates.helper
    native_raw = pinned(NATIVE, NATIVE_SHA)
    native_text = h['decode'](native_raw)
    native = templates.index(native_text, 'BP_CodexAuthoringProbe')
    pinned(REVIEW, REVIEW_SHA)
    if json.loads(pinned(NATIVE_TEST, NATIVE_TEST_SHA).decode('utf-8'))['classification'] != 'PASS_SIX_FIXED_NATIVE_EDITOR_FIXTURES':
        raise ValueError('NATIVE_FIXTURE_ACCEPTANCE_REQUIRED')
    phase_raw = pinned(PHASE_A, PHASE_A_SHA)
    phase_text = h['decode'](phase_raw)
    phase = templates.index(phase_text, 'InstantActionPlayerController')
    if any(n['relative_path'].split('.')[0] in FUNCTIONS for n in phase):
        raise ValueError('DESTINATION_FUNCTION_COLLISION_IN_PINNED_BASELINE')
    occupied = set(re.findall(r'\b[0-9A-F]{32}\b', native_text + phase_text))
    previous_ids = set(occupied)
    artifacts, reports = [], []
    for function in FUNCTIONS:
        nodes = [n for n in native if n['relative_path'].startswith(function + '.')]
        # Preserve graph registration order, including the entry at its native position.
        graph = next(n for n in native if n['relative_path'] == function)
        registered_names = [re.search(r'"([^\"]+)"', x['text']).group(1)
                            for x in graph['fields'] if x['text'].startswith('Nodes(')]
        if set(registered_names) != {n['relative_path'].rsplit('.', 1)[-1] for n in nodes}:
            raise ValueError('SOURCE_REGISTRATION_ORDER_MISMATCH')
        nodes.sort(key=lambda n: registered_names.index(n['relative_path'].rsplit('.', 1)[-1]))
        expected_nodes = {'ValidateBoundedIdentity': 47, 'SegmentValidatedPath': 91,
                          'DecorateBoundedPage': 124}[function]
        if len(nodes) != expected_nodes:
            raise ValueError('SOURCE_NODE_COUNT_CHANGED')
        for n in nodes:
            if not templates.registration(native, n):
                raise ValueError('UNREGISTERED_SOURCE_NODE')
        original = node_text(nodes)
        if 'BP_Codex' in original or 'bCallInEditor=True' in original:
            raise ValueError('SCRATCH_OBJECT_OR_EDITOR_BUTTON_LEAK')
        for row in original.splitlines():
            if 'VariableReference=' in row and ('MemberScope="' + function + '"') not in row:
                raise ValueError('NONLOCAL_VARIABLE_BINDING')
            if 'FunctionReference=' in row and 'MemberGuid=' in row:
                raise ValueError('SOURCE_BLUEPRINT_FUNCTION_BINDING')
        ids = fresh_map(nodes, occupied, True)
        body = remap(original, ids)
        inverse = {v: k for k, v in ids.items()}
        if remap(body, inverse) != original or set(ids.values()) & previous_ids:
            raise ValueError('TRANSFORMATION_NOT_EXACT')
        transformed = parsed_body(templates, body)
        pins, edges, external = h['checked_graph'](transformed)
        if external:
            raise ValueError('EXTERNAL_EDGE')
        old_pins, old_edges, old_external = h['checked_graph'](nodes)
        mapped_edges = {((a[0], ids[a[1]]), (b[0], ids[b[1]])) for a, b in old_edges}
        if old_external or mapped_edges != edges or len(pins) != len(old_pins):
            raise ValueError('EDGE_OR_PIN_DRIFT')
        payload = ('BPGraph(GraphName="' + function + '",GraphType=GT_Function,NodesString=' +
                   json.dumps(body, ensure_ascii=True) + ')').encode('utf-8')
        if len(payload) > 1048576:
            raise ValueError('CLIPBOARD_BOUND')
        artifacts.append((function + '.clipboard.txt', payload))
        reports.append({'function': function, 'nodes': len(nodes), 'pins': len(pins),
                        'reciprocal_edges': len(edges) // 2, 'external_edges': 0,
                        'source_graph_guid': next(x['text'].split('=', 1)[1]
                                                  for n in native if n['relative_path'] == function
                                                  for x in n['fields'] if x['text'].startswith('GraphGuid=')),
                        'destination_graph_guid': 'UNKNOWN_UNTIL_NATIVE_EXPORT',
                        'id_map': ids, 'inverse_transformation': 'EXACT_SOURCE_MATCH',
                        'logic_and_typed_signature_changes': 'NONE',
                        'node_names': [n['relative_path'].rsplit('.', 1)[-1] for n in nodes]})

    # One disconnected pure query supplies the actual selected PCC-array type.
    # Its inherited Actor target uses the source-proven bSelfContext; no scratch Self node is copied.
    query = next(n for n in native if n['relative_path'] == 'EventGraph.K2Node_CallFunction_701')
    if not templates.registration(native, query):
        raise ValueError('QUERY_REGISTRATION')
    original = node_text([query])
    if 'FunctionReference=(MemberName="K2_GetComponentsByClass",bSelfContext=True)' not in original:
        raise ValueError('QUERY_SIGNATURE_CHANGED')
    if ('DefaultObject="' + BASE_CLASS + '"') not in original or 'BP_Codex' in original:
        raise ValueError('QUERY_TYPE_OR_SCRATCH_REFERENCE')
    if 'VariableReference=' in original or 'MemberGuid=' in original:
        raise ValueError('QUERY_MEMBER_BINDING')
    ids = fresh_map([query], occupied, False)
    body = remap(re.sub(r'LinkedTo=\([^)]*\),', '', original), ids)
    qnodes = parsed_body(templates, body)
    qpins, qedges, qexternal = h['checked_graph'](qnodes)
    if len(qnodes) != 1 or len(qpins) != 3 or qedges or qexternal:
        raise ValueError('DISCONNECTED_QUERY_SHAPE')
    if any(p['PinType.PinCategory'] == '"exec"' for p in qpins.values()):
        raise ValueError('QUERY_EXECUTION_PORT')
    artifacts.append(('PCCQueryBindingSeed.clipboard.txt', body.encode('utf-8')))
    reports.append({'function': None, 'purpose': 'Native Promote to Variable B0CapturedComponents',
                    'nodes': 1, 'pins': 3, 'reciprocal_edges': 0, 'external_edges': 0,
                    'id_map': ids, 'changes': 'Fresh node/pin IDs and removal of all source links only.',
                    'implicit_target': 'Source-proven bSelfContext Actor target; native destination acceptance pending.'})
    OUT.mkdir()
    for name, data in artifacts:
        with (OUT / name).open('xb') as stream:
            stream.write(data)
    report = {'status': 'PREPARED_OFFLINE_DESTINATION_NOT_MODIFIED',
              'created_utc': datetime.now(timezone.utc).isoformat(),
              'destination': DESTINATION,
              'source_pins': [pin(p) for p in (Path(__file__), CORE, NATIVE, REVIEW, NATIVE_TEST, PHASE_A)],
              'payloads': [pin(OUT / name) for name, _ in artifacts],
              'transformations': reports,
              'required_native_members': [
                  {'name': 'B0ControlAttempted', 'type': 'Boolean', 'default': False, 'guid': 'UNKNOWN'},
                  {'name': 'B0SnapshotAttempted', 'type': 'Boolean', 'default': False, 'guid': 'UNKNOWN'},
                  {'name': 'B0CapturedComponents', 'type': BASE_CLASS + ' object array',
                   'default': [], 'guid': 'UNKNOWN'}],
              'not_included': ['Member declaration serialization or guessed destination member GUIDs.',
                               'Destination helper caller GUIDs, F8/EndPlay rewiring or CaptureB0.',
                               'Staging, native input, save, Save To Mod, packaging or retail changes.'],
              'limitations': ['Pinned Phase A export is historical and must be refreshed before destination editing.',
                              'Native helper execution passed six fixed scratch cases only; destination acceptance pending.',
                              'Paging decorator is omitted; B0 final formatting remains a separate implementation.',
                              'B0 controller remains NOT_IMPLEMENTED.']}
    with (OUT / 'preparation.json').open('x', encoding='utf-8') as stream:
        json.dump(report, stream, indent=2)
        stream.write('\n')
    return report


if __name__ == '__main__':
    result = prepare()
    print(json.dumps({'status': result['status'], 'payloads': result['payloads']}))
