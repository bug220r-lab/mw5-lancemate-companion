"""Offline two-node native-backed repair fragment; no clipboard/engine action.

The fragment contains only its internal conversion link. The existing failed
GetPathName node remains in place but must be disconnected through native UI.
"""
from pathlib import Path
from datetime import datetime, timezone
import hashlib
import json
import runpy

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'research/evidence/phase-b0-capture-class-path-repair-20260927-01'
CAPTURE = ROOT / 'scripts/Prepare-PhaseB0Capture.py'
CAPTURE_SHA = '43e6b08617a6365c4fe6e16e3ee80da896f5a95888c08c10d240961e7cf68644'
BASELINE = ROOT / 'research/evidence/phase-b0-resume-source-native-01/controller.COPY'
BASELINE_SHA = 'dd31fb6e77953cffe08edec0918d61d849655acc646f07fd112b9a8bdd5e2877'
BASELINE_REVIEW = BASELINE.with_name('native-controller-widget-review.json')
BASELINE_REVIEW_SHA = 'a3513eb88a4938518877f4d6103abbb16c30fefd8fd03a75da2c9eb47388f1e4'


def pinned(path, sha):
    raw = path.read_bytes()
    if len(raw) > 4 * 1024 * 1024 or hashlib.sha256(raw).hexdigest() != sha:
        raise ValueError('EXACT_SOURCE_PIN_REQUIRED: ' + str(path))
    return raw


def pin(path):
    raw = path.read_bytes()
    return {'path': str(path), 'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()}


def prepare():
    pinned(CAPTURE, CAPTURE_SHA)
    m = runpy.run_path(str(CAPTURE))
    t = m['core'].Templates()
    h = t.helper
    templates = m['native_conversion_templates'](t)
    baseline = h['decode'](pinned(BASELINE, BASELINE_SHA))
    review = json.loads(pinned(BASELINE_REVIEW, BASELINE_REVIEW_SHA))
    if review['status'] != 'PASS_RESUMED_SOURCE_PRESERVATION_CAPTURE_STILL_FAILED':
        raise ValueError('EXACT_FAILED_BASELINE_REVIEW_REQUIRED')
    records = {n['relative_path']: n for n in t.index(baseline, 'InstantActionPlayerController')}
    capture_nodes = {k.split('.', 1)[1]: v for k, v in records.items() if k.startswith('CaptureB0Snapshot.')}
    if len(capture_nodes) != 195:
        raise ValueError('EXACT_195_NODE_FAILED_CAPTURE_REQUIRED')
    old = capture_nodes['K2Node_CallFunction_2082']
    fields = [x['text'] for x in old['fields']]
    if 'FunctionReference=(MemberParent=Class\'"/Script/Engine.KismetSystemLibrary"\',MemberName="GetPathName")' not in fields:
        raise ValueError('EXACT_OLD_GET_PATH_NAME_REQUIRED')
    oldpins = {json.loads(h['pin_fields'](x['text'])['PinName']): h['pin_fields'](x['text']) for x in old['pin_lines']}
    source = h['links'](oldpins['Object'])
    downstream = h['links'](oldpins['ReturnValue'])
    if len(source) != 1 or len(downstream) != 1 or source[0][0] != 'K2Node_VariableGet_2021':
        raise ValueError('EXACT_FAILED_TWO_EDGES_REQUIRED')
    def endpoint(pair):
        node, pid = pair
        matches = [h['pin_fields'](x['text']) for x in capture_nodes[node]['pin_lines'] if h['pin_fields'](x['text'])['PinId'] == pid]
        if len(matches) != 1:
            raise ValueError('EXACT_EXTERNAL_ENDPOINT_REQUIRED')
        return {'node': node, 'pin_id': pid, 'pin_name': json.loads(matches[0]['PinName'])}
    before_source, after_destination = endpoint(source[0]), endpoint(downstream[0])
    if before_source['pin_name'] != 'CurrentClass' or after_destination['pin_name'] != 'ClassPath':
        raise ValueError('EXACT_CLASS_AND_STORED_STRING_ENDPOINTS_REQUIRED')
    selected = [templates['HardClassToSoftClass'], templates['ReadClassPath']]
    ids = {node['relative_path']: {'name': newname, 'node_guid': m['core'].uid(),
           'pins': {h['pin_fields'](x['text'])['PinId']: m['core'].uid() for x in node['pin_lines']}}
           for node, newname in zip(selected, ('K2Node_ConvertAsset_9500', 'K2Node_CallFunction_9501'))}
    payload, removed = h['remap_nodes'](selected, ids, baseline, ((800, 3520), (1200, 3520)))
    parsed = [n for n in t.index('Begin Object Class=/Script/Engine.Blueprint Name="RepairParserRoot"\n' + payload.decode('utf-8') + 'End Object\n', 'RepairParserRoot') if n['relative_path']]
    actualpins, links, outside = h['checked_graph'](parsed)
    if len(parsed) != 2 or len(actualpins) != 5 or len(links) != 2 or outside:
        raise ValueError('EXACT_TWO_NODE_INTERNAL_EDGE_ONLY')
    if any(p['PinType.PinCategory'] == '"exec"' for p in actualpins.values()):
        raise ValueError('NO_EXECUTION_PINS_ALLOWED')
    # Re-emission with the same fresh identifiers proves deterministic preservation.
    if h['remap_nodes'](selected, ids, baseline, ((800, 3520), (1200, 3520)))[0] != payload:
        raise ValueError('REEMISSION_MISMATCH')
    destination = OUT / 'ClassPathRepair.clipboard.txt'
    audit_path = OUT / 'repair-preparation.json'
    graph_path = OUT / 'CaptureB0Snapshot.repaired-draft.graph.json'
    if any(p.exists() for p in (destination, audit_path, graph_path)):
        raise ValueError('NO_OVERWRITE')
    graph = m['build_capture']()
    OUT.mkdir(exist_ok=True)
    with destination.open('xb') as stream:
        stream.write(payload)
    with graph_path.open('x', encoding='utf-8') as stream:
        json.dump(graph.record(), stream, indent=2); stream.write('\n')
    plan = {'status': 'PREPARED_SOURCE_BOUND_TWO_NODE_REPAIR_NOT_IMPORTED',
        'prepared_utc': datetime.now(timezone.utc).isoformat(), 'generator': pin(Path(__file__)),
        'capture_generator': pin(CAPTURE), 'native_template': pin(m['CONVERSION_SOURCE']),
        'native_template_review': pin(m['CONVERSION_REVIEW']), 'baseline': pin(BASELINE),
        'baseline_review': pin(BASELINE_REVIEW), 'payload': pin(destination), 'draft_graph': pin(graph_path),
        'destination_blueprint': m['DESTINATION'], 'destination_function': 'CaptureB0Snapshot',
        'destination_graph_guid': '4A6C23DA4EFE38754CED1B87414E93A2',
        'new_identifiers': ids, 'removed_source_external_links': removed,
        'payload_bounds': {'nodes': 2, 'pins': 5, 'internal_data_edges': 1, 'execution_pins': 0, 'fresh_guids': 7},
        'native_UI_plan': [
            'Paste these2nodes into the existing CaptureB0Snapshot function only; do not replace the wholefunction.',
            'Disconnect both old K2Node_CallFunction_2082 GetPathName data links: Object and ReturnValue. Retain the old node with all pins unconnected.',
            'Connect the existing CurrentClass output to new K2Node_ConvertAsset_9500.Input.',
            'Connect new K2Node_CallFunction_9501.ReturnValue to the existing StoreClassPath.ClassPath input.',
            'The new hard-to-soft Output→SoftClassReference internal link is already in the payload.',
            'Compile once, export and independently compare. No function invocation, route changes, save, packaging or retail step is included.'],
        'old_node': {'name': 'K2Node_CallFunction_2082', 'object_pin': oldpins['Object']['PinId'], 'return_pin': oldpins['ReturnValue']['PinId']},
        'existing_source': before_source, 'existing_destination': after_destination,
        'expected_native_after': {'existing_nodes_retained': 195, 'total_nodes': 197, 'total_pins': 679, 'total_edges': 260, 'locals': 26,
            'old_node_state': 'All3pins unconnected; no defaultobject added', 'changes': 'Two removed dataedges plus3new dataedges only. No executionedge, variable, signature, default, comparison or formatter change.'},
        'clean_generated_graph': {'nodes': len(graph.nodes), 'pins': graph.validate()['pin_count'], 'edges': len(graph.edges), 'difference_from_UI_repair': 'Clean generation omits the retained inert oldGetPathName node; behavior/links otherwise use the same conversion chain.'},
        'limitations': ['Two source-backed nodes compiled in scratch; targetcontroller repairedcompile and nativeoutput still unperformed.',
            'Clipboard contains no external endpointlinks. Root must make reviewed connections through observed UI and verify resulting source.',
            'Native property node names may be regenerated onPaste; compare types/functions/links and record actualidentities, not guessed success.'],
        'native_actions': 'NOT_PERFORMED'}
    with audit_path.open('x', encoding='utf-8') as stream:
        json.dump(plan, stream, indent=2); stream.write('\n')
    return {'payload': pin(destination), 'audit': pin(audit_path), 'draft_graph': pin(graph_path)}


if __name__ == '__main__':
    print(json.dumps(prepare(), indent=2))
