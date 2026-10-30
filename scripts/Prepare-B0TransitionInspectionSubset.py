"""Prepare two disconnected, source-bound node portions; never stage/import them.

No Unreal, UI, clipboard, process, network or asset API. Historical/native source
provenance is retained; offline validation cannot prove current native import or
runtime behavior. Output is an inspection subset, not a recorder or full patch.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re

REPO = Path(r'C:\Users\jlewi\OneDrive\Documents\ChatGPT\MW5 LANCEMATE COMPANION')
BASELINE = ('research/evidence/b0-transition-diagnostic-20261006-01/freshnative-baseline398-retry-20261015-01/controller-source.COPY',
            '3bb337d0932decc23951acf4bdb31e07601906b1b3121224c2ade9de856616ab')
SPECS = (
    {'key': 'Len', 'source': BASELINE[0], 'sha256': BASELINE[1], 'root': 'InstantActionPlayerController',
     'path': 'CaptureB0Snapshot.K2Node_CallFunction_2168', 'owner': '/Script/Engine.KismetStringLibrary',
     'member': 'Len', 'pins': [('self','object',False),('S','string',False),('ReturnValue','int',True)],
     'version': 'OBSERVED_SAVED_1.1.398.0e_SOURCE_OCT15_NOT_CURRENT_LOADED_BASELINE'},
    {'key': 'GuidValidity', 'source': 'research/evidence/editor-source/ai-research-collection-20260921T030437Z-f7d8e930/216-DispatchReinforcementsBehaviorComponent-source.COPY',
     'sha256': '1505cfc420d4b6db61fd0b1c1676600c322331161394c3db4e15396cbe9586cc',
     'root': 'DispatchReinforcementsBehaviorComponent', 'path': 'OnReinforcementArrived.K2Node_CallFunction_2',
     'owner': '/Script/Engine.KismetGuidLibrary', 'member': 'IsValid_Guid',
     'pins': [('self','object',False),('InGuid','struct',False),('ReturnValue','bool',True)],
     'version': 'HISTORICAL_SEPT21_NATIVE_SOURCE_CURRENT_BUILD_RECONSTRUCTION_UNVERIFIED'},
)
CLASS = '/Script/BlueprintGraph.K2Node_CallFunction'

def digest(raw):
    return hashlib.sha256(raw).hexdigest()

def require(value, reason):
    if not value:
        raise ValueError(reason)

def read_pinned(path, expected):
    raw = Path(path).read_bytes()
    require(0 < len(raw) <= 8 * 1024 * 1024 and digest(raw) == expected, 'SOURCE_PIN_DRIFT')
    return raw

def index_source(text, root):
    """Index merged native declarations/bodies; no code from the source executes."""
    stack, records = [], {}
    for number, line in enumerate(text.splitlines(), 1):
        value = line.strip()
        if value.startswith('Begin Object '):
            name = re.search(r'\bName="([^"\r\n]+)"', value)
            kind = re.search(r'\bClass=(/[^\s]+)', value)
            require(name is not None and len(stack) < 16, 'SOURCE_DECLARATION_INVALID')
            stack.append(name.group(1))
            require(stack[0] == root, 'SOURCE_ROOT_CHANGED')
            record = records.setdefault(tuple(stack), {'path': '.'.join(stack[1:]), 'class': None, 'begin_lines': [], 'fields': [], 'pins': []})
            record['begin_lines'].append(number)
            if kind:
                require(record['class'] in (None, kind.group(1)), 'CONFLICTING_SOURCE_CLASS')
                record['class'] = kind.group(1)
        elif value == 'End Object':
            require(bool(stack), 'UNBALANCED_SOURCE_END')
            stack.pop()
        elif value:
            require(bool(stack), 'SOURCE_OUTSIDE_OBJECT')
            record = records[tuple(stack)]
            record['pins' if value.startswith('CustomProperties Pin ') else 'fields'].append({'line': number, 'text': value})
    require(not stack, 'UNCLOSED_SOURCE')
    return {x['path']: x for x in records.values()}

def registration(records, record):
    graph, separator, name = record['path'].rpartition('.')
    require(separator and '.' not in graph, 'TOP_LEVEL_AUTHORING_GRAPH_REQUIRED')
    parent, root = records.get(graph), records.get('')
    require(parent is not None and parent['class'] == '/Script/Engine.EdGraph' and root is not None, 'AUTHORING_GRAPH_REQUIRED')
    nodes = [x for x in parent['fields'] if re.match(r'^Nodes\(\d+\)=', x['text']) and re.search(r'"'+re.escape(name)+r'"', x['text'])]
    graphs = [x for x in root['fields'] if re.match(r'^(UbergraphPages|FunctionGraphs|MacroGraphs)\(\d+\)=', x['text']) and re.search(r'"'+re.escape(graph)+r'"', x['text'])]
    require(len(nodes) == len(graphs) == 1, 'SOURCE_NODE_OR_GRAPH_NOT_REGISTERED')
    return {'scope': 'LEXICAL_AUTHORING_REGISTRATION_ONLY', 'graph': graph, 'node': nodes[0], 'root_graph': graphs[0]}

def pin_shape(line):
    name = re.search(r',PinName="([^"]+)"', line)
    category = re.search(r',PinType.PinCategory="([^"]+)"', line)
    require(name is not None and category is not None, 'SOURCE_PIN_SHAPE_MISSING')
    return name.group(1), category.group(1), ',Direction="EGPD_Output",' in line

def without_links(line):
    return re.sub(r',LinkedTo=\([^)]*\)', '', line)

def load_templates(repo=REPO):
    templates, all_ids = [], set()
    for spec in SPECS:
        path = Path(repo) / spec['source']
        raw = read_pinned(path, spec['sha256'])
        text = raw.decode('utf-16' if raw.startswith((b'\xff\xfe', b'\xfe\xff')) else 'utf-8-sig')
        all_ids.update(re.findall(r'\b[A-F0-9]{32}\b', text))
        records = index_source(text, spec['root'])
        record = records.get(spec['path'])
        require(record is not None and record['class'] == CLASS, 'EXACT_NATIVE_CALL_TEMPLATE_REQUIRED')
        registered = registration(records, record)
        fields = [x['text'] for x in record['fields']]
        owner = 'FunctionReference=(MemberParent=Class\'"' + spec['owner'] + '"\',MemberName="' + spec['member'] + '")'
        require(fields.count(owner) == 1 and fields.count('bIsPureFunc=True') == 1, 'SOURCE_OWNER_MEMBER_OR_PURITY_CHANGED')
        require(all(re.match(r'^(bIsPureFunc|FunctionReference|NodePosX|NodePosY|NodeGuid)=', x) for x in fields), 'UNREVIEWED_SOURCE_NODE_FIELD')
        require([pin_shape(x['text']) for x in record['pins']] == spec['pins'], 'SOURCE_PIN_LAYOUT_CHANGED')
        ids = [re.fullmatch(r'CustomProperties Pin \(PinId=([A-F0-9]{32}),.*', x['text']).group(1) for x in record['pins']]
        require(len(set(ids)) == 3 and not any('PinCategory="exec"' in x['text'] for x in record['pins']), 'EXACT_THREE_NONEXEC_PINS_REQUIRED')
        templates.append({'spec': dict(spec), 'source_pin': {'path': str(path), 'bytes': len(raw), 'sha256': spec['sha256']}, 'record': record, 'registration': registered})
    return templates, all_ids

def artifact_id(label):
    # Offline graph identities only. Never a diagnostic runtime writer token.
    return hashlib.sha256(('B0_RECOVERED_INSPECTION_20261017_01/' + label).encode('ascii')).hexdigest()[:32].upper()

def build(repo=REPO):
    templates, source_ids = load_templates(repo)
    blocks, nodes, new_ids = [], [], []
    for template in templates:
        key, record = template['spec']['key'], template['record']
        fields = [x['text'] for x in record['fields']]
        old_guid = next(x.split('=',1)[1] for x in fields if x.startswith('NodeGuid='))
        node_guid, name = artifact_id(key+'/node'), 'K2Node_CallFunction_B0Recovered'+key+'_20261017'
        pin_map, pins, removed = {}, [], []
        for index, pin in enumerate(record['pins']):
            old_id = re.match(r'CustomProperties Pin \(PinId=([A-F0-9]{32}),', pin['text']).group(1)
            new_id = artifact_id(key+'/pin/'+str(index))
            pin_map[old_id] = new_id
            original = pin['text']
            removed += [{'source_pin': old_id, 'text': m.group(0)} for m in re.finditer(r',LinkedTo=\([^)]*\)', original)]
            pins.append(without_links(original).replace('PinId='+old_id+',', 'PinId='+new_id+',', 1))
        fields = [x.replace('NodeGuid='+old_guid, 'NodeGuid='+node_guid) if x.startswith('NodeGuid=') else x for x in fields]
        body = ['Begin Object Class='+CLASS+' Name="'+name+'"'] + ['   '+x for x in fields+pins] + ['End Object']
        blocks.append('\r\n'.join(body))
        new_ids.extend([node_guid]+list(pin_map.values()))
        nodes.append({'key': key, 'name': name, 'node_guid': node_guid, 'source_node_guid': old_guid, 'pin_identity_map': pin_map, 'removed_source_links': removed, 'template': template})
    require(len(new_ids) == len(set(new_ids)) == 8 and not source_ids.intersection(new_ids), 'IDENTITY_COLLISION')
    payload = ('\r\n'.join(blocks)+'\r\n').encode('utf-8')
    report = {'schema': 'MW5_RECOVERED_INSPECTION_SUBSET_V1', 'status': 'OFFLINE_PREPARED_NOT_STAGED_NOT_IMPORTED', 'nodes': nodes,
              'payload': {'bytes': len(payload), 'sha256': digest(payload)},
              'limits': ['Only two disconnected pure nodes; no events, execution pins, variables or recorder.',
                         'GuidValidity is a historical native template; current native reconstruction remains unverified.',
                         'Len source comes from Oct15 saved398 export, not a current full loaded graph baseline.',
                         'No native import, compile, save, execution, supplementary-character length or runtime proof.',
                         'Identity values are offline graph IDs only, never runtime writer tokens.'],
              'native_status': 'NOT_PERFORMED'}
    validate_fragment(payload, report, repo)
    return payload, report

def validate_fragment(payload, report, repo=REPO):
    require(isinstance(payload, bytes) and 0 < len(payload) <= 12*1024, 'PAYLOAD_BOUND')
    require(report.get('schema') == 'MW5_RECOVERED_INSPECTION_SUBSET_V1' and report.get('status') == 'OFFLINE_PREPARED_NOT_STAGED_NOT_IMPORTED' and report.get('native_status') == 'NOT_PERFORMED', 'OFFLINE_STATUS_REQUIRED')
    # A supplied manifest is evidence to verify, never the authority for its own
    # schemas. Re-read the fixed-hash native sources independently of the report.
    trusted, source_ids = load_templates(repo)
    authoritative = {x['spec']['key']: x for x in trusted}
    text = payload.decode('utf-8')
    require(not any(x in text for x in ('LinkedTo=', 'PinCategory="exec"', 'VariableReference=', 'K2Node_Event', 'K2Node_CustomEvent', 'DelegateReference=')), 'NO_CONNECTION_EXECUTION_OR_STATE_ALLOWED')
    wrapped = 'Begin Object Class=/Script/Engine.Blueprint Name="OfflineValidation"\n' + text + 'End Object\n'
    records = index_source(wrapped, 'OfflineValidation')
    require(len(records) == 3 and len(report['nodes']) == 2, 'EXACT_TWO_NODES_REQUIRED')
    require(records['']['fields'] == [] and records['']['pins'] == [], 'NO_FRAGMENT_ROOT_PROPERTIES')
    ids = []
    require([x.get('key') for x in report['nodes']] == ['Len','GuidValidity'], 'EXACT_SOURCE_TEMPLATE_SET_REQUIRED')
    for node in report['nodes']:
        template = authoritative[node['key']]
        require(json.dumps(node['template'],sort_keys=True) == json.dumps(template,sort_keys=True), 'REPORT_NATIVE_PROVENANCE_CHANGED')
        require(node['name'] == 'K2Node_CallFunction_B0Recovered'+node['key']+'_20261017' and node['node_guid'] == artifact_id(node['key']+'/node'), 'OFFLINE_NODE_IDENTITY_CHANGED')
        actual, source = records.get(node['name']), node['template']['record']
        require(actual is not None and actual['class'] == source['class'] == CLASS, 'NODE_CLASS_OR_NAME_CHANGED')
        require(len(actual['begin_lines']) == 1, 'EXACT_ONE_ENVELOPE_PER_FRAGMENT_NODE')
        source_guid = next(x['text'].split('=',1)[1] for x in source['fields'] if x['text'].startswith('NodeGuid='))
        require(node['source_node_guid'] == source_guid, 'REPORT_SOURCE_NODE_IDENTITY_CHANGED')
        expected_fields = [x['text'].replace('NodeGuid='+source_guid, 'NodeGuid='+node['node_guid']) if x['text'].startswith('NodeGuid=') else x['text'] for x in source['fields']]
        require([x['text'] for x in actual['fields']] == expected_fields, 'SOURCE_NODE_FIELDS_CHANGED')
        require(len(actual['pins']) == len(source['pins']) == 3, 'NO_PIN_ADDITION_OR_REMOVAL')
        source_pin_ids = [re.match(r'CustomProperties Pin \(PinId=([A-F0-9]{32}),', p['text']).group(1) for p in source['pins']]
        require(set(node['pin_identity_map']) == set(source_pin_ids), 'REPORT_PIN_IDENTITY_SET_CHANGED')
        removed = [{'source_pin': old, 'text': match.group(0)} for old,p in zip(source_pin_ids,source['pins']) for match in re.finditer(r',LinkedTo=\([^)]*\)', p['text'])]
        require(node['removed_source_links'] == removed, 'REPORT_REMOVED_SOURCE_LINKS_CHANGED')
        for index, (a, s) in enumerate(zip(actual['pins'], source['pins'])):
            old_id = re.match(r'CustomProperties Pin \(PinId=([A-F0-9]{32}),', s['text']).group(1)
            require(node['pin_identity_map'][old_id] == artifact_id(node['key']+'/pin/'+str(index)), 'OFFLINE_PIN_IDENTITY_CHANGED')
            expected = without_links(s['text']).replace('PinId='+old_id+',', 'PinId='+node['pin_identity_map'][old_id]+',',1)
            require(a['text'] == expected, 'SOURCE_PIN_TYPE_DEFAULT_OR_FLAGS_CHANGED')
            ids.append(node['pin_identity_map'][old_id])
        ids.append(node['node_guid'])
    require(len(ids) == len(set(ids)) == 8 and not source_ids.intersection(ids), 'IDENTITY_COLLISION')
    require(len(payload) == report['payload']['bytes'] and digest(payload) == report['payload']['sha256'], 'PAYLOAD_PIN_CHANGED')
    return {'nodes':2, 'pins':6, 'connections':0, 'exec_pins':0, 'variables':0, 'events':0, 'source_semantics_preserved':True}

def save(output, repo=REPO):
    payload, report = build(repo)
    output = Path(output)
    require(not output.exists(), 'OUTPUT_EXISTS_NO_OVERWRITE')
    output.mkdir()
    with (output/'recovered-pure-subset.fragment.txt').open('xb') as stream:
        stream.write(payload)
    report['prepared_utc'] = datetime.now(timezone.utc).isoformat()
    with (output/'SUBSET_MANIFEST.json').open('x',encoding='utf-8') as stream:
        json.dump(report,stream,indent=2)
        stream.write('\n')
    return report

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    result = save(args.output)
    print(json.dumps({'status':result['status'],'payload':result['payload'],'output':str(args.output)}))
