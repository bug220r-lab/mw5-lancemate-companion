"""Offline B0 EventGraph delta; original events stay in place.

Unresolved native bindings are explicit logical slots, never guessed GUIDs.
Native application requires one new-node paste and six reviewed boundary wires.
"""
import argparse
import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
CORE = ROOT / 'scripts/PhaseBBlueprintAssembly.py'
CORE_SHA = '385db1e4aec7276a5a8a3ad8262ac5b8e641f2082ff207d13332b4cb552176f0'
PHASE_A = ROOT / 'research/evidence/editor-source/diagnostic-final-source-20260925T221745Z-530263a1/controller-source.COPY'
PHASE_A_SHA = '1c46d0589b6c79342fcba90857d0ea1970d463325a9eeb00a31e86fbd2afa0db'
TYPE_SOURCE = ROOT / 'research/evidence/phase-b0-capture-type-function-native-02/full.COPY'
TYPE_SHA = '17682425fed807c58ff3a0b745f824bbfd4709f87cfd44cb02f1e1cf5158c37c'
DESTINATION = '/ModOverride/LanceObserverDiagnosticControl/Modes/InstantAction/InstantActionPlayerController.InstantActionPlayerController'
WIDGET = '/LanceObserverDiagnosticControl/WBP_ObserverDiagnosticControl.WBP_ObserverDiagnosticControl_C'
PCC = '/Game/Objects/_common/Components/PlayerControllerComponents/PlayerControllerComponent.PlayerControllerComponent_C'
ORIGINALS = {
    'Input': 'K2Node_InputAction_0', 'DoOnce': 'K2Node_MacroInstance_0', 'Create': 'K2Node_CreateWidget_0',
    'Self': 'K2Node_Self_0', 'StoreReadout': 'K2Node_VariableSet_2', 'CreatedValid': 'K2Node_MacroInstance_1',
    'ShowMarker': 'K2Node_CallFunction_0', 'EndPlay': 'K2Node_Event_0', 'ParentEndPlay': 'K2Node_CallParentFunction_0',
    'EndReadoutValid': 'K2Node_MacroInstance_2', 'Readout': 'K2Node_VariableGet_0', 'RemoveReadout': 'K2Node_CallFunction_1',
    'ClearReadout': 'K2Node_VariableSet_3',
}
REMOVED = [('Input', 'Pressed', 'DoOnce', 'execute'),
           ('EndPlay', 'then', 'EndReadoutValid', 'exec'),
           ('ClearReadout', 'then', 'ParentEndPlay', 'execute')]
BOUNDARIES = [('Input', 'Pressed', 'ControlGuard', 'execute'),
              ('ConsumeControl', 'then', 'DoOnce', 'execute'),
              ('EndPlay', 'then', 'SealControl', 'execute'),
              ('SealSnapshot', 'then', 'EndReadoutValid', 'exec'),
              ('ClearReadout', 'then', 'ClearCapturedArray', 'execute'),
              ('ClearCapturedArray', 'then', 'ParentEndPlay', 'execute')]
INTERNAL = [('ControlFlag','B0ControlAttempted','ControlGuard','Condition'),
            ('ControlGuard','else','ConsumeControl','execute'), ('ControlGuard','then','SnapshotGuard','execute'),
            ('SnapshotFlag','B0SnapshotAttempted','SnapshotGuard','Condition'), ('SnapshotGuard','else','ConsumeSnapshot','execute'),
            ('ConsumeSnapshot','then','Capture','execute'), ('Capture','then','PublishValid','exec'),
            ('PublishReadout','ControlReadout','PublishValid','InputObject'), ('PublishReadout','ControlReadout','SetSnapshot','self'),
            ('Capture','Snapshot','SnapshotText','InString'), ('SnapshotText','ReturnValue','SetSnapshot','InText'),
            ('PublishValid','Is Valid','SetSnapshot','execute'), ('SealControl','then','SealSnapshot','execute'),
            ('CapturedArray','B0CapturedComponents','ClearCapturedArray','TargetArray')]


def pinned(path, sha):
    raw = Path(path).read_bytes()
    if len(raw) > 8 * 1024 * 1024 or hashlib.sha256(raw).hexdigest() != sha:
        raise ValueError('SOURCE_PIN_DRIFT')
    return raw


spec = importlib.util.spec_from_file_location('b0_route_core', CORE)
core = importlib.util.module_from_spec(spec)
exec(compile(pinned(CORE, CORE_SHA), str(CORE), 'exec'), core.__dict__)


def schema(pin):
    return {key: value for key, value in pin.items() if key.startswith('PinType.') or key in ('PinName', 'Direction')}


def source_record(templates, ref):
    return templates.node(Path(ref['path']), ref['sha256'], ref['root_name'], ref['relative_path'])


def ref(path, sha, relative, root='InstantActionPlayerController'):
    return {'path': str(path), 'sha256': sha, 'root_name': root, 'relative_path': relative}


class EventDelta(core.FunctionGraph):
    def __init__(self, templates, bindings=None):
        super().__init__(templates, 'EventGraph')
        self.bindings = copy.deepcopy(bindings)
        self.originals = {}
        self.original_edges = []
        self.pin_schemas = {}
        self.field_contracts = {}
        self.pending = {}
        self.operations = {}
        self.bool_transforms = []

    def remember(self, label):
        node = self.nodes[label]
        self.pin_schemas[label] = {name: schema(pin) for name, pin in node['pins'].items()}
        self.field_contracts[label] = copy.deepcopy(node['fields'])

    def add_native(self, label, node, operation=None, original=False):
        super().add(label, node)
        if original:
            self.nodes[label]['name'] = node['relative_path'].split('.')[-1]
            self.nodes[label]['guid'] = next(f['text'].split('=', 1)[1] for f in node['fields'] if f['text'].startswith('NodeGuid='))
            positions = {f['text'].split('=', 1)[0]: int(f['text'].split('=', 1)[1]) for f in node['fields'] if f['text'].startswith(('NodePosX=', 'NodePosY='))}
            self.nodes[label]['position'] = (positions.get('NodePosX', 0), positions.get('NodePosY', 0))
            for row in node['pin_lines']:
                pin = self.h['pin_fields'](row['text'])
                self.nodes[label]['pins'][json.loads(pin['PinName'])]['PinId'] = pin['PinId']
            self.originals[label] = copy.deepcopy(self.nodes[label])
        self.operations[label] = operation
        self.remember(label)
        return label

    def slot(self, label, role, pins, source):
        # Interfaces are testable project contracts only. These records cannot
        # be serialized as native nodes and contain no guessed binding GUIDs.
        self.nodes[label] = {'label': label, 'name': None, 'guid': None, 'class': 'UNRESOLVED_NATIVE_BINDING',
                             'fields': [], 'pins': {}, 'position': (0, 0), 'source': source}
        for name, category, direction, subtype, container in pins:
            pin = {'PinId': None, 'PinName': json.dumps(name), 'PinType.PinCategory': json.dumps(category),
                   'PinType.PinSubCategory': '""', 'PinType.PinSubCategoryObject': subtype,
                   'PinType.ContainerType': container}
            if direction == 'out':
                pin['Direction'] = '"EGPD_Output"'
            self.nodes[label]['pins'][name] = pin
        self.operations[label] = role
        self.pending[label] = {'role': role, 'status': 'NATIVE_BINDING_PENDING'}
        self.remember(label)

    def connect(self, a, ap, b, bp):
        pa, pb = self.nodes[a]['pins'][ap], self.nodes[b]['pins'][bp]
        if pa.get('Direction') != '"EGPD_Output"' or pb.get('Direction') == '"EGPD_Output"':
            raise ValueError('LINK_DIRECTION')
        keys = ('PinType.PinCategory', 'PinType.PinSubCategoryObject', 'PinType.ContainerType')
        if any(pa[key] != pb[key] for key in keys):
            original_edge = (a, ap, b, bp) in self.original_edges
            widget_to_object = (a == 'PublishReadout' and b == 'PublishValid' and bp == 'InputObject'
                                and pa['PinType.PinSubCategoryObject'] == 'WidgetBlueprintGeneratedClass\'"' + WIDGET + '"\''
                                and pb['PinType.PinSubCategoryObject'] == 'Class\'"/Script/CoreUObject.Object"\'')
            if not (original_edge or widget_to_object):
                raise ValueError('UNPROVEN_ROUTE_TYPE_LINK')
        edge = (a, ap, b, bp)
        if edge in self.edges:
            raise ValueError('DUPLICATE_ROUTE_EDGE')
        if pa['PinType.PinCategory'] == '"exec"' and any(e[:2] == edge[:2] for e in self.edges):
            raise ValueError('EXEC_OUTPUT_FANOUT')
        if pa['PinType.PinCategory'] != '"exec"' and any(e[2:] == edge[2:] for e in self.edges):
            raise ValueError('MULTIPLE_DATA_PRODUCERS')
        self.edges.append(edge)

    def validate(self):
        if set(self.originals) != set(ORIGINALS) or len(self.nodes) != 28:
            raise ValueError('EXACT_ROUTE_NODE_SCOPE')
        for name, node in self.nodes.items():
            if {k: schema(v) for k, v in node['pins'].items()} != self.pin_schemas[name] or node['fields'] != self.field_contracts[name]:
                raise ValueError('SOURCE_ROUTE_SCHEMA_DRIFT')
            if name in self.originals and node != self.originals[name]:
                raise ValueError('ORIGINAL_NODE_BODY_OR_ID_CHANGED')
            if node['class'] == 'UNRESOLVED_NATIVE_BINDING' and name not in self.pending:
                raise ValueError('UNACCOUNTED_PENDING_BINDING')
        ids = [node['guid'] for node in self.nodes.values() if node['guid'] is not None]
        ids += [p['PinId'] for node in self.nodes.values() for p in node['pins'].values() if p['PinId'] is not None]
        if len(ids) != len(set(ids)) or any(not re.fullmatch('[0-9A-F]{32}', x) for x in ids):
            raise ValueError('NODE_PIN_ID_COLLISION')
        input_fields = self.nodes['Input']['fields']
        if 'InputActionName="ObserverDiagnosticSnapshot"' not in input_fields or 'bConsumeInput=False' not in input_fields:
            raise ValueError('ORIGINAL_NONCONSUMING_INPUT_REQUIRED')
        if self.nodes['Create']['pins']['Class'].get('DefaultObject') != json.dumps(WIDGET):
            raise ValueError('ORIGINAL_DIAGNOSTIC_WIDGET_CLASS_REQUIRED')
        if self.nodes['ShowMarker']['pins']['ZOrder'].get('DefaultValue') != '"1000"':
            raise ValueError('ORIGINAL_MARKER_ZORDER_REQUIRED')
        if ('EndPlay', 'EndPlayReason', 'ParentEndPlay', 'EndPlayReason') not in self.edges:
            raise ValueError('ORIGINAL_ENDPLAY_REASON_FORWARDING_REQUIRED')
        expected_old = set(self.original_edges) - set(REMOVED)
        actual_old = {e for e in self.edges if e[0] in self.originals and e[2] in self.originals}
        if actual_old != expected_old:
            raise ValueError('UNREVIEWED_ORIGINAL_EDGE_CHANGE')
        boundary = {e for e in self.edges if (e[0] in self.originals) != (e[2] in self.originals)}
        if boundary != set(BOUNDARIES):
            raise ValueError('EXACT_SIX_BOUNDARY_WIRES_REQUIRED')
        actual_internal = {e for e in self.edges if e[0] not in self.originals and e[2] not in self.originals}
        if actual_internal != set(INTERNAL):
            raise ValueError('EXACT_NEW_ROUTE_WIRING_REQUIRED')
        if any(e[:2] in (('Input', 'Released'), ('ControlGuard', 'then')) and e[2:] == ('DoOnce', 'execute') for e in self.edges):
            raise ValueError('INCORRECT_CONTROL_ROUTE')
        if any(e[:2] == ('SnapshotGuard', 'then') or e[2:] == ('DoOnce', 'Reset') for e in self.edges):
            raise ValueError('NO_RETRY_OR_RESET_ALLOWED')
        if [e for e in self.edges if e[2:] == ('ParentEndPlay', 'execute')] != [('ClearCapturedArray', 'then', 'ParentEndPlay', 'execute')]:
            raise ValueError('ONE_PARENT_ENDPLAY_ROUTE_REQUIRED')
        if [e for e in self.edges if e[2:] == ('Capture', 'execute')] != [('ConsumeSnapshot', 'then', 'Capture', 'execute')]:
            raise ValueError('SNAPSHOT_ATTEMPT_MUST_PRECEDE_CAPTURE')
        if [e for e in self.edges if e[2:] == ('SetSnapshot', 'execute')] != [('PublishValid', 'Is Valid', 'SetSnapshot', 'execute')]:
            raise ValueError('FRESH_WIDGET_GUARD_REQUIRED')
        for label in ('ConsumeControl', 'ConsumeSnapshot', 'SealControl', 'SealSnapshot'):
            member = self.operations[label]['member']
            if self.nodes[label]['pins'][member].get('DefaultValue') != '"true"':
                raise ValueError('ATTEMPTS_MUST_BE_CONSUMED_NEVER_RESET')
        saved = list(self.edges)
        self.edges = []
        for edge in saved:
            self.connect(*edge)
        return {'original_nodes': len(self.originals), 'new_nodes': len(self.nodes) - len(self.originals),
                'pin_count': sum(len(n['pins']) for n in self.nodes.values()), 'edge_count': len(self.edges),
                'removed_edges': len(REMOVED), 'boundary_wires': len(boundary), 'unresolved_native_bindings': len(self.pending)}

    def record(self):
        return {'status': 'SOURCE_BOUND_ROUTE_DELTA_NATIVE_BINDINGS_PENDING' if self.pending else 'PREPARED_ROUTE_FRAGMENT_REQUIRES_NATIVE_REVIEW',
                'bounds': self.validate(), 'nodes': list(self.nodes.values()), 'edges': self.edges,
                'operations': self.operations, 'pending_bindings': self.pending, 'bool_transformations': self.bool_transforms,
                'original_edges': self.original_edges, 'remove_existing_edges': REMOVED, 'add_boundary_wires': BOUNDARIES,
                'bindings': self.bindings, 'audit': self.audit,
                'application': 'Paste new-node fragment only. Preserve original13nodes. Replace exactly3existingexecedges with listed6boundarywires through separately reviewed native UI. Then compile/export/review the merged graph.',
                'limitations': ['No automatic native graph mutation.', 'Flag rebinding is source-backed proposed assembly until native compile/export.',
                                'Capture function is a separately reviewed dependency.', 'No widget creation/display claim from a valid reference.',
                                'Per-instance first/second/no-op routing requires native and retail acceptance.'],
                'native_actions': 'NOT_PERFORMED'}

    def emit_fragment(self):
        self.validate()
        if self.pending or not self.bindings or self.bindings.get('classification') != 'OBSERVED_NATIVE_ROUTE_BINDINGS':
            raise ValueError('ACTUAL_NATIVE_ROUTE_BINDINGS_REQUIRED_NO_PAYLOAD')
        validate_bindings(self.templates, self.bindings)
        nodes = {label: copy.deepcopy(node) for label, node in self.nodes.items() if label not in self.originals}
        for a, ap, b, bp in self.edges:
            if a not in nodes or b not in nodes:
                continue
            for x, xp, y, yp in ((a, ap, b, bp), (b, bp, a, ap)):
                pin = nodes[x]['pins'][xp]
                pin['LinkedTo'] = pin.get('LinkedTo', '()')[:-1] + nodes[y]['name'] + ' ' + nodes[y]['pins'][yp]['PinId'] + ',)'
        blocks = []
        for node in nodes.values():
            lines = ['Begin Object Class=' + node['class'] + ' Name="' + node['name'] + '"']
            fields = node['fields'] + ['NodePosX=' + str(node['position'][0]), 'NodePosY=' + str(node['position'][1]), 'NodeGuid=' + node['guid']]
            lines += ['   ' + f for f in fields]
            lines += ['   CustomProperties Pin (' + ','.join(k + '=' + v for k, v in pin.items()) + ',)' for pin in node['pins'].values()]
            blocks.append('\r\n'.join(lines + ['End Object']))
        raw = ('\r\n'.join(blocks) + '\r\n').encode('utf-8')
        if len(raw) > 256 * 1024:
            raise ValueError('ROUTE_FRAGMENT_BOUND')
        return raw


def validate_bindings(templates, bindings):
    if bindings.get('classification') != 'OBSERVED_NATIVE_ROUTE_BINDINGS' or bindings.get('blueprint_path') != DESTINATION:
        raise ValueError('ACTUAL_NATIVE_ROUTE_BINDINGS_REQUIRED')
    source = bindings['native_source']
    raw = pinned(source['path'], source['sha256'])
    if source['root_name'] != 'InstantActionPlayerController' or len(raw) != source['bytes']:
        raise ValueError('DESTINATION_NATIVE_SOURCE_PIN')
    review_pin = bindings['native_review']
    review_raw = pinned(review_pin['path'], review_pin['sha256'])
    review = json.loads(review_raw)
    if (len(review_raw) != review_pin['bytes'] or review.get('status') != 'PASS_NATIVE_B0_EVENT_BINDINGS'
            or review.get('blueprint_path') != DESTINATION or review.get('native_source') != source):
        raise ValueError('ROUTE_NATIVE_REVIEW_REQUIRED')
    rows = templates.file(Path(source['path']), source['sha256'], source['root_name'])
    root = next(row for row in rows if row['relative_path'] == '')
    root_fields = [f['text'] for f in root['fields']]
    for member in ('B0ControlAttempted', 'B0SnapshotAttempted'):
        guid = bindings['members'][member]['guid']
        found = [f for f in root_fields if f.startswith('NewVariables(') and ('VarName="' + member + '",VarGuid=' + guid + ',VarType=(PinCategory="bool")') in f]
        if len(found) != 1 or 'DefaultValue="True"' in found[0] or 'DefaultValue="true"' in found[0]:
            raise ValueError('ACTUAL_FALSE_BOOLEAN_DECLARATION_REQUIRED')
    required = {'CapturedArrayGet', 'CaptureCall', 'SetSnapshotCall'}
    if set(bindings['references']) != required:
        raise ValueError('EXACT_ROUTE_NATIVE_REFERENCES_REQUIRED')
    for value in bindings['references'].values():
        if (Path(value['path']).resolve() != Path(source['path']).resolve() or value['sha256'] != source['sha256']
                or value['root_name'] != source['root_name']):
            raise ValueError('ROUTE_BINDINGS_SINGLE_NATIVE_EXPORT_REQUIRED')
        source_record(templates, value)
    capture = source_record(templates, bindings['references']['CaptureCall'])
    capture_ref = next((f['text'] for f in capture['fields'] if f['text'].startswith('FunctionReference=')), '')
    capture_guid = re.search(r'MemberName="CaptureB0Snapshot",MemberGuid=([0-9A-F]{32}),bSelfContext=True', capture_ref)
    graphs = [r for r in rows if r['relative_path'] == 'CaptureB0Snapshot' and r['class_path'] == '/Script/Engine.EdGraph']
    if (capture_guid is None or len(graphs) != 1 or 'GraphGuid=' + capture_guid[1] not in [f['text'] for f in graphs[0]['fields']]
            or not any(re.fullmatch(r'FunctionGraphs\(\d+\)=EdGraph\'"CaptureB0Snapshot"\'', f) for f in root_fields)):
        raise ValueError('REGISTERED_CAPTURE_FUNCTION_CALLER_GUID_REQUIRED')
    array = source_record(templates, bindings['references']['CapturedArrayGet'])
    array_ref = next((f['text'] for f in array['fields'] if f['text'].startswith('VariableReference=')), '')
    array_guid = re.search(r'MemberName="B0CapturedComponents",MemberGuid=([0-9A-F]{32}),bSelfContext=True', array_ref)
    array_decls = [f for f in root_fields if f.startswith('NewVariables(') and 'VarName="B0CapturedComponents",' in f]
    if (array_guid is None or len(array_decls) != 1 or 'VarGuid=' + array_guid[1] not in array_decls[0]
            or 'VarType=(PinCategory="object",' not in array_decls[0] or 'ContainerType=Array' not in array_decls[0]
            or ('PinSubCategoryObject=BlueprintGeneratedClass\'"' + PCC + '"\'') not in array_decls[0]):
        raise ValueError('REGISTERED_CAPTURED_ARRAY_MEMBER_REQUIRED')
    return rows


def build_routes(bindings=None):
    t = core.Templates()
    g = EventDelta(t, bindings)
    if bindings is None:
        source = {'path': str(PHASE_A), 'sha256': PHASE_A_SHA, 'root_name': 'InstantActionPlayerController'}
    else:
        validate_bindings(t, bindings)
        source = bindings['native_source']
    rows = t.file(Path(source['path']), source['sha256'], source['root_name'])
    by_name = {value: key for key, value in ORIGINALS.items()}
    originals = {}
    for label, name in ORIGINALS.items():
        node = t.node(Path(source['path']), source['sha256'], source['root_name'], 'EventGraph.' + name)
        originals[label] = node
        g.add_native(label, node, original=True)
    endpoints = {pin['PinId']: (label, name) for label, node in g.nodes.items() for name, pin in node['pins'].items()}
    for label, row in originals.items():
        for item in row['pin_lines']:
            pin = g.h['pin_fields'](item['text'])
            if pin.get('Direction') != '"EGPD_Output"':
                continue
            for destination, pin_id in g.h['links'](pin):
                if destination not in by_name or pin_id not in endpoints:
                    raise ValueError('ORIGINAL_ROUTE_EXTERNAL_LINK_UNREVIEWED')
                other, other_pin = endpoints[pin_id]
                if other != by_name[destination]:
                    raise ValueError('ORIGINAL_ROUTE_LINK_IDENTITY')
                g.original_edges.append((label, json.loads(pin['PinName']), other, other_pin))
    for edge in REMOVED:
        if edge not in g.original_edges:
            raise ValueError('EXPECTED_PHASE_A_EXEC_EDGE_MISSING')
    for edge in g.original_edges:
        if edge not in REMOVED:
            g.connect(*edge)
    # Future booleans use real declared destination GUIDs, with type and self
    # schemas sourced from registered native member templates.
    bool_get = t.stock('008', 'CanOrderMechs.K2Node_VariableGet_5')
    bool_set = t.stock('008', 'EventGraph.K2Node_VariableSet_2')
    scalar = lambda name, kind, direction: (name, kind, direction, 'None', 'None')
    exec_in, exec_out = scalar('execute', 'exec', 'in'), scalar('then', 'exec', 'out')
    def boolean(label, member, access):
        template = bool_get if access == 'get' else bool_set
        role = {'operation': 'member_get' if access == 'get' else 'member_set', 'member': member}
        if bindings is None:
            ports = [scalar(member, 'bool', 'out')] if access == 'get' else [exec_in, exec_out, scalar(member, 'bool', 'in')]
            g.slot(label, role, ports, {'interface_template': template['_provenance'], 'binding': 'ACTUAL_DESTINATION_DECLARATION_PENDING'})
        else:
            g.add_native(label, template, role)
            node = g.nodes[label]
            old = 'bMissionComplete'
            reference = 'VariableReference=(MemberName="' + member + '",MemberGuid=' + bindings['members'][member]['guid'] + ',bSelfContext=True)'
            node['fields'] = [reference if f.startswith('VariableReference=') else f for f in node['fields']]
            node['pins'][member] = node['pins'].pop(old)
            node['pins'][member]['PinName'] = json.dumps(member)
            native_self = g.nodes['Readout' if access == 'get' else 'StoreReadout']['pins']['self']
            node['pins']['self'] = dict(copy.deepcopy(native_self), PinId=core.uid())
            g.bool_transforms.append({'node': label, 'status': 'PROPOSED_TYPED_REBIND_REQUIRES_NATIVE_COMPILE', 'source': template['_provenance'],
                                      'changes': 'Actual declared destination member name/GUID, value pin name, destination self-pin schema, fresh IDs, source links removed.'})
        if access == 'set':
            g.nodes[label]['pins'][member]['DefaultValue'] = '"true"'
        g.remember(label)
    boolean('ControlFlag', 'B0ControlAttempted', 'get')
    g.add_native('ControlGuard', t.node(Path(source['path']), source['sha256'], source['root_name'], 'CheckAndShowPostMissionScreen.K2Node_IfThenElse_0'), {'operation': 'branch'})
    boolean('ConsumeControl', 'B0ControlAttempted', 'set')
    boolean('SnapshotFlag', 'B0SnapshotAttempted', 'get')
    g.add_native('SnapshotGuard', t.node(Path(source['path']), source['sha256'], source['root_name'], 'CheckAndShowPostMissionScreen.K2Node_IfThenElse_0'), {'operation': 'branch'})
    boolean('ConsumeSnapshot', 'B0SnapshotAttempted', 'set')
    if bindings is None:
        g.slot('Capture', {'operation': 'capture_call', 'function': 'CaptureB0Snapshot'},
               [exec_in, exec_out, scalar('Snapshot', 'string', 'out')], {'interface': 'Reviewed project CaptureB0Snapshot() -> Snapshot:String', 'native_caller': 'PENDING'})
    else:
        g.add_native('Capture', source_record(t, bindings['references']['CaptureCall']), {'operation': 'capture_call', 'function': 'CaptureB0Snapshot'})
        if not any(re.fullmatch(r'FunctionReference=\(MemberName="CaptureB0Snapshot",MemberGuid=[0-9A-F]{32},bSelfContext=True\)', f) for f in g.nodes['Capture']['fields']):
            raise ValueError('ACTUAL_CAPTURE_CALLER_REQUIRED')
        if set(g.nodes['Capture']['pins']) != {'execute', 'then', 'self', 'Snapshot'}:
            raise ValueError('ACTUAL_CAPTURE_SIGNATURE_REQUIRED')
    g.add_native('PublishReadout', originals['Readout'], {'operation': 'member_get', 'member': 'ControlReadout'})
    g.add_native('PublishValid', originals['EndReadoutValid'], {'operation': 'is_valid'})
    g.add_native('SnapshotText', t.catalog('function:Conv_StringToText'), {'operation': 'string_to_text'})
    widget_type = 'WidgetBlueprintGeneratedClass\'"' + WIDGET + '"\''
    if bindings is None:
        g.slot('SetSnapshot', {'operation': 'publish_snapshot'}, [exec_in, exec_out,
               ('self', 'object', 'in', widget_type, 'None'), scalar('InText', 'text', 'in')],
               {'interface': 'Historical diagnostic widget SetSnapshot(InText:Text)', 'native_caller': 'PENDING'})
    else:
        g.add_native('SetSnapshot', source_record(t, bindings['references']['SetSnapshotCall']), {'operation': 'publish_snapshot'})
        reference_prefix = 'FunctionReference=(MemberParent=' + widget_type + ',MemberName="SetSnapshot",MemberGuid='
        if not any(f.startswith(reference_prefix) and re.search(r'MemberGuid=[0-9A-F]{32}\)$', f) for f in g.nodes['SetSnapshot']['fields']):
            raise ValueError('ACTUAL_DIAGNOSTIC_WIDGET_SETTER_CALLER_REQUIRED')
        if set(g.nodes['SetSnapshot']['pins']) != {'execute', 'then', 'self', 'InText'}:
            raise ValueError('ACTUAL_WIDGET_SETTER_SIGNATURE_REQUIRED')
    boolean('SealControl', 'B0ControlAttempted', 'set')
    boolean('SealSnapshot', 'B0SnapshotAttempted', 'set')
    if bindings is None:
        g.slot('CapturedArray', {'operation': 'member_get', 'member': 'B0CapturedComponents'},
               [('B0CapturedComponents', 'object', 'out', 'BlueprintGeneratedClass\'"' + PCC + '"\'', 'Array')],
               {'interface': 'Observed native PCC object-array pin schema', 'native_destination_member': 'PENDING'})
    else:
        g.add_native('CapturedArray', source_record(t, bindings['references']['CapturedArrayGet']), {'operation': 'member_get', 'member': 'B0CapturedComponents'})
        if not any(re.fullmatch(r'VariableReference=\(MemberName="B0CapturedComponents",MemberGuid=[0-9A-F]{32},bSelfContext=True\)', f) for f in g.nodes['CapturedArray']['fields']):
            raise ValueError('ACTUAL_CAPTURED_ARRAY_MEMBER_REQUIRED')
    g.add_native('ClearCapturedArray', t.node(TYPE_SOURCE, TYPE_SHA, 'BP_CodexAuthoringProbe', 'ProofB0CaptureTypes_Full.K2Node_CallArrayFunction_2009'), {'operation': 'array_clear'})
    for edge in INTERNAL + BOUNDARIES:
        g.connect(*edge)
    g.validate()
    return g


def prepare(output, bindings=None):
    output = Path(output).resolve()
    output.relative_to((ROOT / 'research/evidence').resolve())
    if output.exists():
        raise ValueError('FRESH_OUTPUT_DIRECTORY_REQUIRED')
    graph = build_routes(bindings)
    record = graph.record()
    output.mkdir()
    with (output / 'B0Routes.graph.json').open('x', encoding='utf-8') as stream:
        json.dump(record, stream, indent=2); stream.write('\n')
    if not graph.pending:
        with (output / 'B0Routes.fragment.clipboard.txt').open('xb') as stream:
            stream.write(graph.emit_fragment())
    return record['status']


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--output-dir', required=True)
    parser.add_argument('--bindings')
    args = parser.parse_args()
    bindings = json.loads(Path(args.bindings).read_text()) if args.bindings else None
    print(prepare(args.output_dir, bindings))
