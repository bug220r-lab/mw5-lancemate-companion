"""Offline three-node repair: exact existing local getter plus observed converters.

No engine, clipboard, UI, asset mutation or function invocation. The duplicate
getter reads the same existing local; no member or local declaration is created.
"""
from pathlib import Path
from datetime import datetime, timezone
from copy import deepcopy
import hashlib
import json
import re
import runpy

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'research/evidence/phase-b0-capture-class-path-local-repair-20260927-01'
PREVIOUS = ROOT / 'scripts/Prepare-PhaseB0ClassPathRepair.py'
PREVIOUS_SHA = '85021c464ddf57f853cee5e40a8858295ca2f125c286ed479cdfea5b6cb2b511'
OLD_AUDIT = ROOT / 'research/evidence/phase-b0-capture-class-path-repair-20260927-01/repair-preparation.json'
OLD_AUDIT_SHA = '3d1af7e4be039efce5bb40db88ed158816f12da43fa70feb41821be7983c6a4c'
LOCAL_GUID = 'E893BF644BEC466AA9649530D075E4AB'
REFERENCE = 'VariableReference=(MemberScope="CaptureB0Snapshot",MemberName="CurrentClass",MemberGuid=' + LOCAL_GUID + ')'
NAMES = ('K2Node_VariableGet_9600', 'K2Node_ConvertAsset_9601', 'K2Node_CallFunction_9602')
POSITIONS = ((400, 3520), (800, 3520), (1200, 3520))


def pin(path):
    raw = path.read_bytes()
    return {'path': str(path), 'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()}


def pinned(path, expected):
    raw = path.read_bytes()
    if len(raw) > 4 * 1024**2 or hashlib.sha256(raw).hexdigest() != expected:
        raise ValueError('SOURCE_PIN_DRIFT: ' + str(path))
    return raw


def build(ids=None):
    pinned(PREVIOUS, PREVIOUS_SHA)
    prior = runpy.run_path(str(PREVIOUS))
    old_audit = json.loads(pinned(OLD_AUDIT, OLD_AUDIT_SHA))
    pinned(prior['CAPTURE'], prior['CAPTURE_SHA'])
    capture = runpy.run_path(str(prior['CAPTURE']))
    templates = capture['core'].Templates()
    h = templates.helper
    baseline = h['decode'](pinned(prior['BASELINE'], prior['BASELINE_SHA']))
    pinned(prior['BASELINE_REVIEW'], prior['BASELINE_REVIEW_SHA'])
    records = {n['relative_path']: n for n in templates.index(baseline, 'InstantActionPlayerController')}
    getter = records['CaptureB0Snapshot.K2Node_VariableGet_2021']
    entry = records['CaptureB0Snapshot.K2Node_FunctionEntry_2000']
    decls = [f['text'] for f in entry['fields'] if f['text'].startswith('LocalVariables(') and 'VarName="CurrentClass"' in f['text']]
    if len(decls) != 1 or ('VarGuid=' + LOCAL_GUID + ',') not in decls[0]:
        raise ValueError('EXACT_EXISTING_LOCAL_DECLARATION_REQUIRED')
    declaration = h['attributes'](decls[0].split('=', 1)[1][1:-1])
    expected_type = '(PinCategory="class",PinSubCategoryObject=BlueprintGeneratedClass\'"' + capture['BASE_CLASS'] + '"\')'
    if declaration['VarType'] != expected_type:
        raise ValueError('EXACT_PCC_CLASS_LOCAL_TYPE_REQUIRED')
    refs = [f['text'] for f in getter['fields'] if f['text'].startswith('VariableReference=')]
    if getter['class_path'] != '/Script/BlueprintGraph.K2Node_VariableGet' or refs != [REFERENCE] or len(getter['pin_lines']) != 1:
        raise ValueError('EXACT_EXISTING_LOCAL_GETTER_REQUIRED')
    gp = h['pin_fields'](getter['pin_lines'][0]['text'])
    if gp['PinName'] != '"CurrentClass"' or gp.get('Direction') != '"EGPD_Output"':
        raise ValueError('EXACT_LOCAL_OUTPUT_REQUIRED')
    converters = capture['native_conversion_templates'](templates)
    nodes = deepcopy([getter, converters['HardClassToSoftClass'], converters['ReadClassPath']])
    input_pin = h['pin_fields'](nodes[1]['pin_lines'][0]['text'])
    if input_pin['PinName'] != '"Input"' or {k:v for k,v in gp.items() if k.startswith('PinType.')} != {k:v for k,v in input_pin.items() if k.startswith('PinType.')}:
        raise ValueError('EXACT_HARD_CLASS_LINK_SCHEMA_REQUIRED')
    removed_fields = [f for f in nodes[0]['fields'] if f['text'].startswith(('bHasCompilerMessage=', 'ErrorType=', 'ErrorMsg='))]
    if len(removed_fields) != 3:
        raise ValueError('EXACT_STALE_COMPILER_ANNOTATIONS_REQUIRED')
    nodes[0]['fields'] = [f for f in nodes[0]['fields'] if f not in removed_fields]
    getter_name = nodes[0]['relative_path'].rsplit('.', 1)[-1]
    hard_name = nodes[1]['relative_path'].rsplit('.', 1)[-1]
    old_links = [{'node': getter_name, 'pin': gp['PinId'], 'links': h['links'](gp)},
                 {'node': hard_name, 'pin': input_pin['PinId'], 'links': h['links'](input_pin)}]
    for node, pin_name, target in ((nodes[0], 'CurrentClass', (hard_name, input_pin['PinId'])),
                                   (nodes[1], 'Input', (getter_name, gp['PinId']))):
        row = next(p for p in node['pin_lines'] if h['pin_fields'](p['text'])['PinName'] == json.dumps(pin_name))
        text = re.sub(r'LinkedTo=\([^)]*\),', '', row['text'])
        row['text'] = text.replace('PersistentGuid=', 'LinkedTo=(' + target[0] + ' ' + target[1] + ',),PersistentGuid=', 1)
    if ids is None:
        ids = {n['relative_path']: {'name': name, 'node_guid': capture['core'].uid(),
               'pins': {h['pin_fields'](p['text'])['PinId']: capture['core'].uid() for p in n['pin_lines']}}
               for n, name in zip(nodes, NAMES)}
    if tuple(ids[n['relative_path']]['name'] for n in nodes) != NAMES:
        raise ValueError('FIXED_NODE_NAMES_REQUIRED')
    payload, removed_links = h['remap_nodes'](nodes, ids, baseline, POSITIONS)
    parsed = [n for n in templates.index('Begin Object Class=/Script/Engine.Blueprint Name="RepairParserRoot"\n' + payload.decode('utf-8') + 'End Object\n', 'RepairParserRoot') if n['relative_path']]
    pins, edges, external = h['checked_graph'](parsed)
    if len(parsed) != 3 or len(pins) != 6 or len(edges) != 4 or external or any(p['PinType.PinCategory'] == '"exec"' for p in pins.values()):
        raise ValueError('EXACT_THREE_NODE_TWO_DATA_EDGES_REQUIRED')
    if h['remap_nodes'](nodes, ids, baseline, POSITIONS)[0] != payload:
        raise ValueError('REEMISSION_MISMATCH')
    return payload, {'new_identifiers': ids, 'native_local_reference': REFERENCE,
        'native_local_declaration': decls[0], 'removed_stale_compiler_annotations': removed_fields,
        'replaced_source_links': old_links, 'remaining_external_links_removed': removed_links,
        'baseline': old_audit['baseline'], 'baseline_review': old_audit['baseline_review'],
        'native_template': old_audit['native_template'], 'native_template_review': old_audit['native_template_review'],
        'destination_blueprint': old_audit['destination_blueprint'],
        'destination_function': old_audit['destination_function'], 'destination_graph_guid': old_audit['destination_graph_guid'],
        'existing_destination': old_audit['existing_destination']}


def prepare():
    payload, detail = build()
    destination = OUT / 'ClassPathLocalRepair.clipboard.txt'
    audit = OUT / 'repair-preparation.json'
    if destination.exists() or audit.exists():
        raise ValueError('NO_OVERWRITE')
    OUT.mkdir(exist_ok=True)
    with destination.open('xb') as stream:
        stream.write(payload)
    record = {'status': 'PREPARED_NATIVE_BOUND_LOCAL_AND_CONVERSION_REPAIR_NOT_IMPORTED',
        'prepared_utc': datetime.now(timezone.utc).isoformat(), 'generator': pin(Path(__file__)),
        'source_generator': pin(PREVIOUS), 'source_preparation': pin(OLD_AUDIT), 'payload': pin(destination),
        **detail, 'payload_bounds': {'nodes': 3, 'pins': 6, 'internal_data_edges': 2, 'fresh_guids': 9, 'execution_pins': 0},
        'native_UI_plan': ['Root reports the old GetPathName two data links were disconnected at20:42:13UTC; this is not a new exported source assertion.',
            'Paste these three nodes once inside the existing CaptureB0Snapshot function. Preserve all195 old nodes.',
            'Only connect new K2Node_CallFunction_9602.ReturnValue to existing K2Node_VariableSet_2083.ClassPath.',
            'The duplicate existing local getter to ConvertAsset and ConvertAsset to String converter edges are already internal.',
            'Compile once, export, and independently compare. No invocation, route change, save, package or retail action.'],
        'expected_native_after': {'nodes': 198, 'pins': 680, 'data_and_execution_edges': 260, 'locals': 26,
            'changes': 'Preserve195nodes. Remove2old dataedges; add3pure nodes and3dataedges. Old GetPathName remains fully disconnected. Duplicate getter reads the exact existing local, with no local/member declaration or execution change.'},
        'limitations': ['Baseline export predates the two root-observed disconnections; new native export remains required.',
            'Copied stale compiler annotations are omitted only on the new local getter; original source is unchanged.',
            'Native identities may be regenerated atPaste. This offline payload does not establish target compile/runtime success.'],
        'native_actions': 'NOT_PERFORMED'}
    with audit.open('x', encoding='utf-8') as stream:
        json.dump(record, stream, indent=2); stream.write('\n')
    return {'payload': pin(destination), 'audit': pin(audit), 'generator': pin(Path(__file__))}


if __name__ == '__main__':
    print(json.dumps(prepare(), indent=2))
