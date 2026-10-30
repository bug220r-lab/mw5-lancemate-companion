"""Offline source-bound, execution-disconnected PCC type template candidate.

No engine, UI, clipboard or asset writes. Native specialization/compatibility
remains proposed until the separate import, compile and exported-source review.
The frozen scalar assembly core is used for source loading/cloning only.
"""
import argparse
import copy
from datetime import datetime, timezone
import hashlib
import importlib.util
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
CORE = ROOT / 'scripts/PhaseBBlueprintAssembly.py'
CORE_SHA = '385db1e4aec7276a5a8a3ad8262ac5b8e641f2082ff207d13332b4cb552176f0'
PARTIAL = ROOT / 'research/evidence/phase-b0-capture-types-native-01/types.COPY'
PARTIAL_SHA = '9b5a67b82422edc7c3d3f766d0c773a8041ca50c5196516ebf3ff5eae4efd043'
OBSERVER = ROOT / 'research/evidence/editor-source/observer-authored-20260925T052357Z-b89383e2/BP_LanceObserverProbeComponent.COPY'
OBSERVER_SHA = '7ca123068c6a73ee2e4a9ca9bc970f3e3cd88223951be239edff1f2b9c212ce4'
STOCK = ROOT / 'research/evidence/editor-source/ai-research-collection-20260921T030437Z-f7d8e930/003-SquadOrderBase-source.COPY'
STOCK_SHA = 'dee7eb994d93fde96e240988322664ecbeacf1db933a75301e7ac33f0ad00fd0'
FUNCTION = 'ProofB0CaptureTypes_Full'
OLD_SCOPE = 'ProofB0CaptureTypes'
PCC = 'BlueprintGeneratedClass\'"/Game/Objects/_common/Components/PlayerControllerComponents/PlayerControllerComponent.PlayerControllerComponent_C"\''
OBJECT = 'Class\'"/Script/CoreUObject.Object"\''
MEMBER_REF = 'VariableReference=(MemberName="ProofComponents",MemberGuid=015366E249BCC10191C2138BB26AEC08,bSelfContext=True)'
EDGES = [
    ('Array', 'ProofComponents', 'Item', 'Array'),
    ('Item', 'Output', 'SetComponent', 'ProofCurrentComponent'),
    ('GetComponent', 'ProofCurrentComponent', 'GetClass', 'Object'),
    ('GetClass', 'ReturnValue', 'SetClass', 'ProofCurrentClass'),
    ('Array', 'ProofComponents', 'Length', 'TargetArray'),
    ('Array', 'ProofComponents', 'Clear', 'TargetArray'),
    ('GetComponent', 'ProofCurrentComponent', 'ValidObject', 'InputObject'),
    ('GetClassLocal', 'ProofCurrentClass', 'ValidClass', 'Class'),
    ('GetClassLocal', 'ProofCurrentClass', 'ClassPath', 'Object'),
]
EXPECTED_CLASSES = {
    'Entry': 'K2Node_FunctionEntry', 'Array': 'K2Node_VariableGet',
    'Item': 'K2Node_GetArrayItem', 'SetComponent': 'K2Node_VariableSet',
    'GetComponent': 'K2Node_VariableGet', 'GetClass': 'K2Node_CallFunction',
    'SetClass': 'K2Node_VariableSet', 'GetClassLocal': 'K2Node_VariableGet',
    'Length': 'K2Node_CallArrayFunction', 'Clear': 'K2Node_CallArrayFunction',
    'ValidObject': 'K2Node_MacroInstance', 'ValidClass': 'K2Node_CallFunction',
    'ClassPath': 'K2Node_CallFunction',
}
CALLS = {
    'GetClass': ('GameplayStatics', 'GetObjectClass'),
    'Length': ('KismetArrayLibrary', 'Array_Length'),
    'Clear': ('KismetArrayLibrary', 'Array_Clear'),
    'ValidClass': ('KismetSystemLibrary', 'IsValidClass'),
    'ClassPath': ('KismetSystemLibrary', 'GetPathName'),
}
MACRO = 'MacroGraphReference=(MacroGraph=EdGraph\'"/Engine/EditorBlueprintResources/StandardMacros.StandardMacros:IsValid"\',GraphBlueprint=Blueprint\'"/Engine/EditorBlueprintResources/StandardMacros.StandardMacros"\',GraphGuid=64422BCD430703FF5CAEA8B79A32AA65)'


def pinned(path, expected):
    raw = path.read_bytes()
    if len(raw) > 8 * 1024 * 1024 or hashlib.sha256(raw).hexdigest() != expected:
        raise ValueError('SOURCE_PIN_DRIFT')
    return raw


core_raw = pinned(CORE, CORE_SHA)
spec = importlib.util.spec_from_file_location('b0_type_clone_core', CORE)
core = importlib.util.module_from_spec(spec)
exec(compile(core_raw, str(CORE), 'exec'), core.__dict__)


def ref(name, guid):
    return 'VariableReference=(MemberScope="' + FUNCTION + '",MemberName="' + name + '",MemberGuid=' + guid + ')'


def build():
    templates = core.Templates()
    g = core.FunctionGraph(templates, FUNCTION)
    sources = {'Entry': 'K2Node_FunctionEntry_0', 'Array': 'K2Node_VariableGet_0',
               'Item': 'K2Node_GetArrayItem_0', 'SetComponent': 'K2Node_VariableSet_2',
               'GetComponent': 'K2Node_VariableGet_1', 'GetClass': 'K2Node_CallFunction_0',
               'SetClass': 'K2Node_VariableSet_3', 'GetClassLocal': 'K2Node_VariableGet_1'}
    for label, relative in sources.items():
        g.add(label, templates.node(PARTIAL, PARTIAL_SHA, 'BP_CodexAuthoringProbe', OLD_SCOPE + '.' + relative))
    for label, relative in [('Length', 'K2Node_CallArrayFunction_0'), ('Clear', 'K2Node_CallArrayFunction_1'),
                            ('ValidObject', 'K2Node_MacroInstance_0'), ('ClassPath', 'K2Node_CallFunction_6')]:
        g.add(label, templates.node(OBSERVER, OBSERVER_SHA, 'BP_LanceObserverProbeComponent', 'EventGraph.' + relative))
    g.add('ValidClass', templates.node(STOCK, STOCK_SHA, 'SquadOrderBase', 'IssueOrder.K2Node_CallFunction_15'))
    entry = g.nodes['Entry']
    old_declarations = [x for x in entry['fields'] if x.startswith('LocalVariables(')]
    if len(old_declarations) != 2:
        raise ValueError('EXACT_TWO_NATIVE_LOCALS_REQUIRED')
    locals_ = {}
    for index, (old, new, kind) in enumerate([('ProofCurrentComponent', 'ProofCurrentComponent', 'object'),
                                             ('NewLocalVar_1', 'ProofCurrentClass', 'class')]):
        declaration = old_declarations[index]
        if 'VarName="' + old + '"' not in declaration or 'VarType=(PinCategory="' + kind + '",PinSubCategoryObject=' + PCC + ')' not in declaration:
            raise ValueError('NATIVE_LOCAL_DECLARATION_TYPE_CHANGED')
        old_guid = re.search(r'VarGuid=([0-9A-F]{32})', declaration).group(1)
        guid = core.uid()
        declaration = declaration.replace('VarName="' + old + '"', 'VarName="' + new + '"', 1).replace('VarGuid=' + old_guid, 'VarGuid=' + guid, 1)
        declaration = re.sub(r'FriendlyName="[^"]*"', 'FriendlyName="' + new + '"', declaration, count=1)
        locals_[new] = {'guid': guid, 'kind': kind, 'declaration': declaration,
                        'source_name': old, 'source_guid': old_guid, 'subcategory_object': PCC}
    entry['fields'] = [x for x in entry['fields'] if not x.startswith(('LocalVariables(', 'FunctionReference='))]
    entry['fields'].append('FunctionReference=(MemberName="' + FUNCTION + '")')
    for label, name in [('SetComponent', 'ProofCurrentComponent'), ('GetComponent', 'ProofCurrentComponent'),
                        ('SetClass', 'ProofCurrentClass'), ('GetClassLocal', 'ProofCurrentClass')]:
        node = g.nodes[label]
        source_name = 'ProofCurrentComponent' if label == 'GetClassLocal' else locals_[name]['source_name']
        node['fields'] = [ref(name, locals_[name]['guid']) if x.startswith('VariableReference=') else x for x in node['fields']]
        value = node['pins'].pop(source_name)
        value['PinName'] = json.dumps(name)
        node['pins'][name] = value
        if label == 'GetClassLocal':
            # Proposed local-get instantiation, using the observed class declaration.
            value['PinType.PinCategory'] = '"class"'
            value['PinType.PinSubCategoryObject'] = PCC
    for label in ['Length', 'Clear']:
        value = g.nodes[label]['pins']['TargetArray']
        if value['PinType.PinCategory'] != '"object"' or value['PinType.ContainerType'] != 'Array' or value['PinType.PinSubCategoryObject'] != 'Class\'"/Script/Engine.ActorComponent"\'':
            raise ValueError('OBJECT_ARRAY_SOURCE_REQUIRED_NOT_CLASS_ARRAY')
        value['PinType.PinSubCategoryObject'] = PCC
    source_ids = sorted(set(re.findall(r'(?:NodeGuid|PinId|VarGuid)=([0-9A-F]{32})',
                            '\n'.join(templates.helper['decode'](pinned(p, sha)) for p, sha in
                                      [(PARTIAL, PARTIAL_SHA), (OBSERVER, OBSERVER_SHA), (STOCK, STOCK_SHA)]))))
    data = {'function': FUNCTION, 'classification': 'PROPOSED_SOURCE_BOUND_NATIVE_NOT_PERFORMED',
            'nodes': g.nodes, 'locals': locals_, 'edges': [list(e) for e in EDGES],
            'source_ids': source_ids, 'clone_audit': g.audit,
            'proposed_transforms': [
                'Fresh function scope, node/pin/local GUIDs; preserve scratch ProofComponents member binding.',
                'PCC class local renamed from NewLocalVar_1 to ProofCurrentClass, exact observed class type retained.',
                'Class local Get uses the native PCC object Get schema with the exact observed class-local type substituted.',
                'Array Length and Clear native ActorComponent OBJECT array pins specialized to observed PCC OBJECT array.',
                'New PCC object-to-generic IsValid and PCC class-to-generic IsValidClass/GetPathName connections require native acceptance.',
            ], 'native_import': 'NOT_PERFORMED', 'native_compile': 'NOT_PERFORMED', 'native_execution': 'NOT_PERFORMED'}
    validate(data)
    return data


def validate(data):
    nodes, locals_ = data['nodes'], data['locals']
    if data['function'] != FUNCTION or set(nodes) != set(EXPECTED_CLASSES) or set(locals_) != {'ProofCurrentComponent', 'ProofCurrentClass'}:
        raise ValueError('FIXED_FUNCTION_NODE_AND_LOCAL_SCOPE')
    if data['edges'] != [list(e) for e in EDGES]:
        raise ValueError('EXACT_DISCONNECTED_DATA_TOPOLOGY_REQUIRED')
    ids = [n['guid'] for n in nodes.values()] + [q['PinId'] for n in nodes.values() for q in n['pins'].values()] + [x['guid'] for x in locals_.values()]
    if any(not re.fullmatch('[0-9A-F]{32}', x) for x in ids) or len(set(ids)) != len(ids) or set(ids) & set(data['source_ids']):
        raise ValueError('IDENTITIES_MUST_BE_UNIQUE_FRESH')
    for label, node in nodes.items():
        if node['class'] != '/Script/BlueprintGraph.' + EXPECTED_CLASSES[label]:
            raise ValueError('UNOBSERVED_NODE_CLASS')
        if any(q.get('LinkedTo') for q in node['pins'].values()):
            raise ValueError('PREEXISTING_OR_EXTERNAL_LINK')
        if any(q.get('bOrphanedPin') != 'False' for q in node['pins'].values()):
            raise ValueError('ORPHANED_PIN')
        refs = [f for f in node['fields'] if f.startswith('VariableReference=')]
        wanted = [MEMBER_REF] if label == 'Array' else []
        if label in ['GetComponent', 'SetComponent', 'GetClassLocal', 'SetClass']:
            name = 'ProofCurrentClass' if label in ['GetClassLocal', 'SetClass'] else 'ProofCurrentComponent'
            wanted = [ref(name, locals_[name]['guid'])]
            q = node['pins'][name]
            if q['PinType.PinCategory'] != json.dumps(locals_[name]['kind']) or q['PinType.PinSubCategoryObject'] != PCC or q['PinType.ContainerType'] != 'None':
                raise ValueError('LOCAL_TYPE_BINDING')
        if refs != wanted:
            raise ValueError('FOREIGN_MEMBER_OR_LOCAL_BINDING')
        function_refs = [f for f in node['fields'] if f.startswith('FunctionReference=')]
        expected = []
        if label == 'Entry':
            expected = ['FunctionReference=(MemberName="' + FUNCTION + '")']
        elif label in CALLS:
            owner, name = CALLS[label]
            expected = ['FunctionReference=(MemberParent=Class\'"/Script/Engine.' + owner + '"\',MemberName="' + name + '")']
        if function_refs != expected:
            raise ValueError('UNOBSERVED_FUNCTION_REFERENCE')
    if MACRO not in nodes['ValidObject']['fields'] or set(nodes['Entry']['pins']) != {'then'}:
        raise ValueError('MACRO_OR_VOID_SIGNATURE_CHANGED')
    for name, local in locals_.items():
        if local['declaration'].count('VarGuid=' + local['guid']) != 1 or ('VarName="' + name + '"') not in local['declaration'] or ('PinCategory="' + local['kind'] + '",PinSubCategoryObject=' + PCC) not in local['declaration']:
            raise ValueError('LOCAL_DECLARATION_MISMATCH')
    for label in ['Array', 'Item', 'Length', 'Clear']:
        name = {'Array': 'ProofComponents', 'Item': 'Array', 'Length': 'TargetArray', 'Clear': 'TargetArray'}[label]
        q = nodes[label]['pins'][name]
        if q['PinType.PinCategory'] != '"object"' or q['PinType.ContainerType'] != 'Array' or q['PinType.PinSubCategoryObject'] != PCC:
            raise ValueError('PCC_OBJECT_ARRAY_REQUIRED')
    type_contracts = [
        ('Item', 'Output', 'object', PCC),
        ('GetClass', 'Object', 'object', OBJECT),
        ('GetClass', 'ReturnValue', 'class', PCC),
        ('SetComponent', 'Output_Get', 'object', PCC),
        ('SetClass', 'Output_Get', 'class', PCC),
        ('ValidObject', 'InputObject', 'object', OBJECT),
        ('ValidClass', 'Class', 'class', OBJECT),
        ('ClassPath', 'Object', 'object', OBJECT),
    ]
    for label, name, kind, subtype in type_contracts:
        q = nodes[label]['pins'][name]
        if q['PinType.PinCategory'] != json.dumps(kind) or q['PinType.PinSubCategoryObject'] != subtype or q['PinType.ContainerType'] != 'None':
            raise ValueError('EXPLICIT_OBSERVED_OR_PROPOSED_EDGE_TYPE')
    if 'bReturnByRefDesired=False' not in nodes['Item']['fields'] or nodes['Item']['pins']['Dimension 1'].get('DefaultValue') != '"0"':
        raise ValueError('FIXED_ARRAY_COPY_INDEX')
    destinations = set()
    for source, outpin, target, inpin in data['edges']:
        a, b = nodes[source]['pins'][outpin], nodes[target]['pins'][inpin]
        if a.get('Direction') != '"EGPD_Output"' or b.get('Direction') == '"EGPD_Output"' or a['PinType.PinCategory'] == '"exec"' or b['PinType.PinCategory'] == '"exec"':
            raise ValueError('DATA_ONLY_DIRECTION')
        if (target, inpin) in destinations:
            raise ValueError('PURE_SOURCE_FANOUT_OR_DUPLICATE_INPUT')
        destinations.add((target, inpin))
    if sum(len(n['pins']) for n in nodes.values()) != 36:
        raise ValueError('EXACT_NATIVE_PIN_COUNTS')
    return {'nodes': 13, 'pins': 36, 'locals': 2, 'reciprocal_data_edges': 9, 'connected_execution_edges': 0}


def emit(data):
    validate(data)
    nodes = copy.deepcopy(data['nodes'])
    nodes['Entry']['fields'] += [x['declaration'] for x in data['locals'].values()]
    for a, pa, b, pb in data['edges']:
        for source, sp, target, tp in [(nodes[a], pa, nodes[b], pb), (nodes[b], pb, nodes[a], pa)]:
            q = source['pins'][sp]
            q['LinkedTo'] = q.get('LinkedTo', '()')[:-1] + target['name'] + ' ' + target['pins'][tp]['PinId'] + ',)'
    blocks = []
    for n in nodes.values():
        lines = ['Begin Object Class=' + n['class'] + ' Name="' + n['name'] + '"']
        lines += ['   ' + f for f in n['fields']]
        lines += ['   NodePosX=' + str(n['position'][0]), '   NodePosY=' + str(n['position'][1]), '   NodeGuid=' + n['guid']]
        lines += ['   CustomProperties Pin (' + ','.join(k + '=' + v for k, v in q.items()) + ',)' for q in n['pins'].values()]
        blocks.append('\r\n'.join(lines + ['End Object']))
    body = '\r\n'.join(blocks) + '\r\n'
    text = 'BPGraph(GraphName="' + FUNCTION + '",GraphType=GT_Function,OriginalBlueprint=Blueprint\'"' + core.BLUEPRINT + '"\',NodesString=' + json.dumps(body) + ')'
    raw = text.encode('utf-8')
    if len(raw) > 65536:
        raise ValueError('PAYLOAD_BOUND')
    return raw


def prepare(output):
    output = output.resolve()
    output.relative_to((ROOT / 'research/evidence').resolve())
    if output.exists():
        raise ValueError('FRESH_OUTPUT_DIRECTORY_REQUIRED')
    data = build()
    raw = emit(data)
    output.mkdir()
    (output / (FUNCTION + '.clipboard.txt')).write_bytes(raw)
    (output / (FUNCTION + '.graph.json')).write_text(json.dumps(data, indent=2) + '\n', encoding='utf-8')
    files = [Path(__file__), CORE, PARTIAL, OBSERVER, STOCK, output / (FUNCTION + '.clipboard.txt'), output / (FUNCTION + '.graph.json')]
    pins = [{'path': str(p), 'bytes': p.stat().st_size, 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()} for p in files]
    receipt = {'status': 'PROPOSED_OFFLINE_CANDIDATE_NATIVE_NOT_PERFORMED', 'created_utc': datetime.now(timezone.utc).isoformat(),
               'bounds': validate(data), 'artifacts': pins, 'proposed_transforms': data['proposed_transforms'],
               'native_import': 'NOT_PERFORMED', 'native_compile': 'NOT_PERFORMED', 'native_execution': 'NOT_PERFORMED',
               'scope': 'New separate uncalled void function only; preserve existing seven-node ProofB0CaptureTypes and every prior function/member.',
               'limitations': ['No runtime array access, storage-order, class compatibility or B0 capture acceptance established.',
                               'New class-local getter, PCC array specialization and class-to-object edges remain implementation proposals until native compile/export review.',
                               'Scratch member binding is destination-specific; this payload must not be pasted into diagnostic controller assets.']}
    (output / 'preparation.json').write_text(json.dumps(receipt, indent=2) + '\n', encoding='utf-8')
    return receipt


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--output-dir', required=True)
    args = parser.parse_args()
    print(json.dumps(prepare(Path(args.output_dir)), indent=2))
