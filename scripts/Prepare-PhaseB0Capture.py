"""Source-bound B0 single-snapshot Blueprint implementation, offline only.

The graph is complete, but a native payload requires separately observed
destination member and helper bindings. No engine, clipboard or asset writes.
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
SHARED = ROOT / 'scripts/Prepare-PhaseBTextFunctions.py'
CORE = ROOT / 'scripts/PhaseBBlueprintAssembly.py'
SOURCE = ROOT / 'research/evidence/phase-b0-capture-type-function-native-02/full.COPY'
SOURCE_SHA = '17682425fed807c58ff3a0b745f824bbfd4709f87cfd44cb02f1e1cf5158c37c'
MANIFEST = ROOT / 'research/evidence/phase-b0-capture-type-function-native-02/native-type-template-manifest.json'
MANIFEST_SHA = 'd2eb2afea92c6909a36f85ab97641028839097bb365af50ba8a3fc8333ebc63f'
CONVERSION_SOURCE = ROOT / 'research/evidence/phase-b0-class-path-scratch-compiled-20260927-01/ProofB0ClassPathConversion.native.clipboard.txt'
CONVERSION_SHA = 'fa96d5f904d990399354252125d4620a125df4ce1e05c806cac26fc0b94a5054'
CONVERSION_REVIEW = CONVERSION_SOURCE.with_name('native-chain-review.json')
CONVERSION_REVIEW_SHA = 'da1403abbfed1908a5483d4d294de8db6aea3bed5f19f3ec2c56b73bdd519022'
DESTINATION = '/ModOverride/LanceObserverDiagnosticControl/Modes/InstantAction/InstantActionPlayerController.InstantActionPlayerController'
BASE_CLASS = '/Game/Objects/_common/Components/PlayerControllerComponents/PlayerControllerComponent.PlayerControllerComponent_C'
PROBE_CLASS = '/LanceObserverProbe/BP_LanceObserverProbeComponent.BP_LanceObserverProbeComponent_C'
PCC = 'BlueprintGeneratedClass\'"' + BASE_CLASS + '"\''
OBJECT = 'Class\'"/Script/CoreUObject.Object"\''
HEADER = 'B0, SEQUENTIAL CAPTURE, NOT LIVE\nSelf:\n'
FOOTER = '\nStock class: VALID\nProbe resolution: NOT_CHECKED\nDETAILS/PAGING DEFERRED'
FUNCTION = 'CaptureB0Snapshot'


def pinned(path, sha):
    raw = path.read_bytes()
    if len(raw) > 8 * 1024 * 1024 or hashlib.sha256(raw).hexdigest() != sha:
        raise ValueError('SOURCE_PIN_DRIFT: ' + str(path))
    return raw


pinned(CORE, '385db1e4aec7276a5a8a3ad8262ac5b8e641f2082ff207d13332b4cb552176f0')
shared_raw = pinned(SHARED, '155dd012f6a90afb4cf08aee141ee34ddf68408c0741bb970ff702ffd8c5b977')
spec = importlib.util.spec_from_file_location('b0_capture_shared', SHARED)
shared = importlib.util.module_from_spec(spec)
exec(compile(shared_raw, str(SHARED), 'exec'), shared.__dict__)
core = shared.core


def source_ref(path, sha, root, relative):
    return {'path': str(path), 'sha256': sha, 'root_name': root, 'relative_path': relative}


def native_conversion_templates(templates):
    """Two exact selected-node clipboard records from the compiled native proof.

    The synthetic root is only a lexical parser container, not a claim that
    clipboard records are independently registered whole-asset export records.
    """
    raw = pinned(CONVERSION_SOURCE, CONVERSION_SHA)
    review = json.loads(pinned(CONVERSION_REVIEW, CONVERSION_REVIEW_SHA))
    if (review.get('status') != 'PASS_NATIVE_REACHABLE_CLASS_PATH_CHAIN_SOURCE_AND_COMPILE'
            or review.get('native_clipboard', {}).get('sha256') != CONVERSION_SHA
            or review.get('native_clipboard', {}).get('bytes') != len(raw)):
        raise ValueError('NATIVE_CONVERSION_SOURCE_REVIEW_REQUIRED')
    text = 'Begin Object Class=/Script/Engine.Blueprint Name="ClipboardParserRoot"\n' + raw.decode('utf-8') + 'End Object\n'
    nodes = {n['relative_path']: n for n in templates.index(text, 'ClipboardParserRoot') if n['relative_path']}
    expected = {'K2Node_FunctionEntry_2000', 'K2Node_FunctionResult_2001', 'K2Node_ConvertAsset_2002', 'K2Node_CallFunction_0'}
    if set(nodes) != expected:
        raise ValueError('EXACT_COMPILED_FOUR_NODE_SOURCE_REQUIRED')
    selected = {'HardClassToSoftClass': 'K2Node_ConvertAsset_2002', 'ReadClassPath': 'K2Node_CallFunction_0'}
    result = {}
    for label, key in selected.items():
        node = copy.deepcopy(nodes[key])
        node['_provenance'] = {'path': str(CONVERSION_SOURCE), 'sha256': CONVERSION_SHA,
            'relative_path': key, 'source_kind': 'OBSERVED_NATIVE_SELECTED_NODE_CLIPBOARD',
            'review': {'path': str(CONVERSION_REVIEW), 'sha256': CONVERSION_REVIEW_SHA},
            'graph_guid_from_before_export': '56ADF3CC49105DE321355BA4109F67E7'}
        result[label] = node
    if result['HardClassToSoftClass']['class_path'] != '/Script/BlueprintGraph.K2Node_ConvertAsset':
        raise ValueError('NATIVE_HARD_TO_SOFT_CLASS_NODE_REQUIRED')
    expected_ref = 'FunctionReference=(MemberParent=Class\'"/Script/Engine.KismetSystemLibrary"\',MemberName="Conv_SoftClassReferenceToString")'
    if expected_ref not in [f['text'] for f in result['ReadClassPath']['fields']]:
        raise ValueError('NATIVE_SOFT_CLASS_STRING_FUNCTION_REQUIRED')
    return result


def mock_bindings():
    """Actual scratch/historical rows only; deliberately ineligible for native emission."""
    t = core.Templates()
    rows = t.file(SOURCE, SOURCE_SHA, 'BP_CodexAuthoringProbe')
    setter = [r for r in rows if r['class_path'] == '/Script/BlueprintGraph.K2Node_VariableSet'
              and any(f['text'].startswith('VariableReference=(MemberName="ProofComponents",') for f in r['fields'])]
    assert len(setter) == 1
    diagnostic = ROOT / 'research/evidence/editor-source/diagnostic-final-source-20260925T221745Z-530263a1/controller-source.COPY'
    diagnostic_sha = '1c46d0589b6c79342fcba90857d0ea1970d463325a9eeb00a31e86fbd2afa0db'
    diag = t.file(diagnostic, diagnostic_sha, 'InstantActionPlayerController')
    readout = [r for r in diag if r['class_path'] == '/Script/BlueprintGraph.K2Node_VariableGet'
               and any(f['text'].startswith('VariableReference=(MemberName="ControlReadout",') for f in r['fields'])]
    assert readout
    ref = lambda relative: source_ref(SOURCE, SOURCE_SHA, 'BP_CodexAuthoringProbe', relative)
    return {'classification': 'MOCK_ONLY', 'blueprint_path': DESTINATION,
            'references': {
                'Self': source_ref(diagnostic, diagnostic_sha, 'InstantActionPlayerController', 'EventGraph.K2Node_Self_0'),
                'ControlReadoutGet': source_ref(diagnostic, diagnostic_sha, 'InstantActionPlayerController', readout[0]['relative_path']),
                'CapturedComponentsGet': ref('ProofB0CaptureTypes_Full.K2Node_VariableGet_2001'),
                'CapturedComponentsSet': ref(setter[0]['relative_path']),
                'ValidateCall': ref('EventGraph.K2Node_CallFunction_9100'),
                'SegmentCall': ref('EventGraph.K2Node_CallFunction_9101')},
            'members': {'CapturedComponents': {'name': 'ProofComponents', 'guid': '015366E249BCC10191C2138BB26AEC08'},
                        'ControlReadout': {'name': 'ControlReadout', 'guid': '66B32CB44A97BF8DB59604A96F7FA74F'}},
            'helpers': {'ValidateBoundedIdentity': '17E7ADEB426A31CA70171090E4305F4D',
                        'SegmentValidatedPath': 'CAEFBE884530942ADF30A8838053E25B'}}


def validate_native_bindings(templates, bindings):
    """Admit only one reviewed destination export, never a classification label alone."""
    refs = bindings.get('references', {})
    required = {'Self', 'ControlReadoutGet', 'CapturedComponentsGet', 'CapturedComponentsSet', 'ValidateCall', 'SegmentCall'}
    if set(refs) != required or any(row.get('root_name') != 'InstantActionPlayerController' for row in refs.values()):
        raise ValueError('DESTINATION_REGISTERED_BINDING_REQUIRED')
    source, review_pin = bindings.get('native_source'), bindings.get('native_review')
    if not isinstance(source, dict) or not isinstance(review_pin, dict):
        raise ValueError('DESTINATION_NATIVE_SOURCE_AND_REVIEW_REQUIRED')
    source_path = Path(source['path']).resolve()
    source_path.relative_to((ROOT / 'research/evidence').resolve())
    raw = pinned(source_path, source['sha256'])
    if source.get('bytes') != len(raw) or source.get('root_name') != 'InstantActionPlayerController':
        raise ValueError('DESTINATION_NATIVE_SOURCE_PIN')
    for ref in refs.values():
        if Path(ref['path']).resolve() != source_path or ref['sha256'] != source['sha256']:
            raise ValueError('DESTINATION_BINDINGS_REQUIRE_SINGLE_REVIEWED_EXPORT')
    review_path = Path(review_pin['path']).resolve()
    review_path.relative_to((ROOT / 'research/evidence').resolve())
    review_raw = pinned(review_path, review_pin['sha256'])
    if review_pin.get('bytes') != len(review_raw):
        raise ValueError('DESTINATION_REVIEW_PIN')
    review = json.loads(review_raw)
    reviewed_source = review.get('native_source', {})
    if (review.get('status') != 'PASS_NATIVE_DESTINATION_BINDINGS'
            or review.get('blueprint_path') != DESTINATION
            or Path(reviewed_source.get('path', '')).resolve() != source_path
            or reviewed_source.get('sha256') != source['sha256'] or reviewed_source.get('bytes') != len(raw)):
        raise ValueError('DESTINATION_REVIEW_DOES_NOT_ACCEPT_EXACT_EXPORT')
    records = templates.file(source_path, source['sha256'], 'InstantActionPlayerController')
    if any(row['relative_path'] == FUNCTION for row in records):
        raise ValueError('DESTINATION_FUNCTION_NAME_ALREADY_EXISTS')
    roots = [row for row in records if row['relative_path'] == '' and row['class_path'] == '/Script/Engine.Blueprint']
    if len(roots) != 1:
        raise ValueError('DESTINATION_BLUEPRINT_ROOT_REQUIRED')
    fields = [field['text'] for field in roots[0]['fields']]
    names = {'CapturedComponents': 'B0CapturedComponents', 'ControlReadout': 'ControlReadout'}
    for key, name in names.items():
        member = bindings['members'][key]
        if member['name'] != name or not re.fullmatch('[0-9A-F]{32}', member['guid']):
            raise ValueError('DESTINATION_MEMBER_NAME_OR_GUID')
        declarations = [f for f in fields if f.startswith('NewVariables(') and ('VarName="' + name + '",VarGuid=' + member['guid'] + ',') in f]
        subtype = PCC if key == 'CapturedComponents' else 'WidgetBlueprintGeneratedClass\'"/LanceObserverDiagnosticControl/WBP_ObserverDiagnosticControl.WBP_ObserverDiagnosticControl_C"\''
        if len(declarations) != 1 or 'VarType=(PinCategory="object",' not in declarations[0] or ('PinSubCategoryObject=' + subtype) not in declarations[0]:
            raise ValueError('DESTINATION_REGISTERED_MEMBER_TYPE')
        if ('ContainerType=Array' in declarations[0]) != (key == 'CapturedComponents'):
            raise ValueError('DESTINATION_REGISTERED_MEMBER_CONTAINER')
    for name, guid in bindings['helpers'].items():
        if name not in ('ValidateBoundedIdentity', 'SegmentValidatedPath') or not re.fullmatch('[0-9A-F]{32}', guid):
            raise ValueError('DESTINATION_HELPER_NAME_OR_GUID')
        graph = [r for r in records if r['relative_path'] == name and r['class_path'] == '/Script/Engine.EdGraph']
        if len(graph) != 1 or 'GraphGuid=' + guid not in [f['text'] for f in graph[0]['fields']] or not any(re.fullmatch(r'FunctionGraphs\(\d+\)=EdGraph\'"' + re.escape(name) + r'"\'', f) for f in fields):
            raise ValueError('DESTINATION_REGISTERED_HELPER_GUID')
    return {'classification': 'REVIEWED_NATIVE_DESTINATION_SOURCE', 'native_source': source, 'native_review': review_pin}


class CaptureGraph(core.FunctionGraph):
    def __init__(self, templates, bindings):
        super().__init__(templates, FUNCTION)
        self.bindings = copy.deepcopy(bindings)
        self.binding_status = bindings['classification']
        self.external_member_refs = set()
        self.type_links = []
        self.source_pin_schemas = {}
        self.source_function_refs = {}

    @staticmethod
    def pin_schema(pin):
        return {key: value for key, value in pin.items() if key.startswith('PinType.') or key in ('Direction', 'PinName')}

    def add(self, label, template):
        # Same source-clone operation as frozen scalar core; larger explicit
        # finite bound accommodates guards, one scan and single-page checks.
        if label in self.nodes or not re.fullmatch(r'[A-Za-z][A-Za-z0-9_]*', label) or len(self.nodes) >= 384:
            raise ValueError('CAPTURE_NODE_LABEL_OR_BOUND')
        if '_provenance' not in template:
            raise ValueError('SOURCE_TEMPLATE_PROVENANCE_REQUIRED')
        fields = [f['text'] for f in template['fields'] if not f['text'].startswith(('NodeGuid=', 'NodePosX=', 'NodePosY='))]
        pins, dropped = {}, []
        for row in template['pin_lines']:
            prop = self.h['pin_fields'](row['text'])
            name = json.loads(prop['PinName'])
            if name in pins:
                raise ValueError('DUPLICATE_SOURCE_PIN_NAME')
            dropped.extend(self.h['links'](prop))
            prop.pop('LinkedTo', None)
            prop['PinId'] = core.uid()
            pins[name] = prop
        index = len(self.nodes)
        self.nodes[label] = {'label': label, 'class': template['class_path'],
                             'name': template['class_path'].rsplit('.', 1)[-1] + '_' + str(2000 + index),
                             'guid': core.uid(), 'fields': fields, 'pins': pins,
                             'position': (index % 8 * 400, index // 8 * 320), 'source': template['_provenance']}
        self.audit.append({'operation': 'clone_source_node', 'node': label, 'source': template['_provenance'], 'external_original_links_removed': dropped})
        self.source_pin_schemas[label] = {name: self.pin_schema(pin) for name, pin in pins.items()}
        self.source_function_refs[label] = [f for f in fields if f.startswith(('FunctionReference=', 'MacroGraphReference='))]
        return label

    def local_node(self, name, access, label):
        result = super().local_node(name, access, label)
        old = self.locals[name]['template']['source_name']
        schema = self.source_pin_schemas[label]
        schema[name] = schema.pop(old)
        schema[name]['PinName'] = json.dumps(name)
        return result

    def connect(self, source, outpin, destination, inpin):
        a, b = self.nodes[source]['pins'][outpin], self.nodes[destination]['pins'][inpin]
        if a.get('Direction') != '"EGPD_Output"' or b.get('Direction') == '"EGPD_Output"':
            raise ValueError('LINK_DIRECTION')
        keys = ('PinType.PinCategory', 'PinType.PinSubCategory', 'PinType.PinSubCategoryObject', 'PinType.ContainerType')
        if any(a[k] != b[k] for k in keys):
            generic_object = b['PinType.PinCategory'] == '"object"' and b['PinType.PinSubCategoryObject'] == OBJECT
            pcc_object = a['PinType.PinCategory'] == '"object"' and a['PinType.PinSubCategoryObject'] == PCC
            pcc_class = a['PinType.PinCategory'] == '"class"' and a['PinType.PinSubCategoryObject'] == PCC
            class_valid = pcc_class and b['PinType.PinCategory'] == '"class"' and b['PinType.PinSubCategoryObject'] == OBJECT
            soft_class_conversion = ((source, outpin, destination, inpin) ==
                ('HardClassToSoftClass', 'Output', 'ReadClassPath', 'SoftClassReference')
                and a['PinType.PinCategory'] == b['PinType.PinCategory'] == '"softclass"'
                and a['PinType.PinSubCategoryObject'] == PCC and b['PinType.PinSubCategoryObject'] == OBJECT
                and b['PinType.bIsReference'] == b['PinType.bIsConst'] == 'True')
            widget_type = 'WidgetBlueprintGeneratedClass\'"/LanceObserverDiagnosticControl/WBP_ObserverDiagnosticControl.WBP_ObserverDiagnosticControl_C"\''
            widget = (source == 'Readout' and destination == 'ReadoutValid' and inpin == 'InputObject'
                      and a['PinType.PinCategory'] == '"object"' and a['PinType.PinSubCategoryObject'] == widget_type and generic_object)
            self_targets = {('SelfPath', 'Object'): OBJECT, ('ReadPaused', 'WorldContextObject'): OBJECT,
                            ('SoleComponentQuery', 'self'): 'Class\'"/Script/Engine.Actor"\'',
                            ('ReadLocal', 'self'): 'Class\'"/Script/Engine.Controller"\''}
            controller_self = (source == 'ControllerSelf' and outpin == 'self'
                               and a['PinType.PinCategory'] == '"object"' and a['PinType.PinSubCategory'] == '"self"'
                               and a['PinType.PinSubCategoryObject'] == 'None' and b['PinType.PinCategory'] == '"object"'
                               and self_targets.get((destination, inpin)) == b['PinType.PinSubCategoryObject'])
            if not (a['PinType.ContainerType'] == b['PinType.ContainerType'] == 'None'
                    and ((generic_object and pcc_object) or class_valid or soft_class_conversion or widget or controller_self)):
                raise ValueError('UNPROVEN_TYPED_LINK: ' + str((source, outpin, destination, inpin)))
            self.type_links.append((source, outpin, destination, inpin))
        edge = (source, outpin, destination, inpin)
        if edge in self.edges:
            raise ValueError('DUPLICATE_EDGE')
        if a['PinType.PinCategory'] == '"exec"' and any(e[:2] == edge[:2] for e in self.edges):
            raise ValueError('EXEC_OUTPUT_FANOUT')
        if a['PinType.PinCategory'] != '"exec"' and any(e[2:] == edge[2:] for e in self.edges):
            raise ValueError('DATA_INPUT_MULTIPLE_PRODUCERS')
        self.edges.append(edge)

    def validate(self):
        ids = [n['guid'] for n in self.nodes.values()] + [p['PinId'] for n in self.nodes.values() for p in n['pins'].values()] + [l['guid'] for l in self.locals.values()]
        if len(ids) != len(set(ids)) or any(not re.fullmatch('[0-9A-F]{32}', value) for value in ids):
            raise ValueError('GENERATED_ID_COLLISION_OR_SYNTAX')
        if set(self.nodes) != set(self.source_pin_schemas):
            raise ValueError('SOURCE_PIN_SCHEMA_COVERAGE')
        for label, node in self.nodes.items():
            if {name: self.pin_schema(pin) for name, pin in node['pins'].items()} != self.source_pin_schemas[label]:
                raise ValueError('SOURCE_PIN_SCHEMA_DRIFT: ' + label)
            if [f for f in node['fields'] if f.startswith(('FunctionReference=', 'MacroGraphReference='))] != self.source_function_refs[label]:
                raise ValueError('SOURCE_FUNCTION_REFERENCE_DRIFT: ' + label)
            for field in node['fields']:
                if field.startswith('VariableReference=') and field not in self.external_member_refs:
                    matches = [name for name, local in self.locals.items() if field == 'VariableReference=(MemberScope="' + self.function + '",MemberName="' + name + '",MemberGuid=' + local['guid'] + ')']
                    if len(matches) != 1 or matches[0] not in node['pins']:
                        raise ValueError('FOREIGN_OR_UNDECLARED_LOCAL_REFERENCE')
                    local = self.locals[matches[0]]
                    value = node['pins'][matches[0]]
                    if value['PinType.PinCategory'] != json.dumps(local['kind']):
                        raise ValueError('LOCAL_PIN_DECLARATION_TYPE')
                    declaration = local['declaration']
                    if ('VarName="' + matches[0] + '",VarGuid=' + local['guid'] + ',VarType=(PinCategory="' + local['kind'] + '"') not in declaration:
                        raise ValueError('LOCAL_DECLARATION_IDENTITY_OR_TYPE')
                    if local['kind'] in ('object', 'class') and (value['PinType.PinSubCategoryObject'] != PCC
                            or value['PinType.ContainerType'] != 'None' or ('PinSubCategoryObject=' + PCC) not in declaration):
                        raise ValueError('TYPED_LOCAL_NATIVE_PCC_SCHEMA_REQUIRED')
        old_edges = list(self.edges)
        self.edges, self.type_links = [], []
        try:
            for edge in old_edges:
                self.connect(*edge)
        except Exception:
            self.edges = old_edges
            raise
        query = self.nodes['SoleComponentQuery']
        if (query['pins']['ComponentClass'].get('DefaultObject') != json.dumps(BASE_CLASS)
                or self.nodes['ReadStockClassValid']['pins']['Class'].get('DefaultObject') != json.dumps(BASE_CLASS)):
            raise ValueError('EXACT_FIXED_STOCK_CLASS_REQUIRED')
        if [e for e in self.edges if e[:2] == ('SoleComponentQuery', 'ReturnValue')] != [('SoleComponentQuery', 'ReturnValue', 'StoreCapturedArray', self.bindings['members']['CapturedComponents']['name'])]:
            raise ValueError('QUERY_SINGLE_STORED_CONSUMER')
        queries = [n for n, node in self.nodes.items() if any('MemberName="K2_GetComponentsByClass"' in f for f in node['fields'])]
        if queries != ['SoleComponentQuery']:
            raise ValueError('EXACTLY_ONE_QUERY_REQUIRED')
        if json.loads(self.nodes['ComponentLoop']['pins']['FirstIndex']['DefaultValue']) != '0' or json.loads(self.nodes['ComponentLoop']['pins']['LastIndex']['DefaultValue']) != '31':
            raise ValueError('FIXED_COMPONENT_LOOP_REQUIRED')
        for source, pin, target, value in [('CapturedLength', 'ReturnValue', 'FreezeReturned', 'Returned'),
                                          ('ReadClass', 'ReturnValue', 'StoreCurrentClass', 'CurrentClass'),
                                          ('ReadClassPath', 'ReturnValue', 'StoreClassPath', 'ClassPath'),
                                          ('SelfPath', 'ReturnValue', 'StoreSelfPath', 'SelfRaw')]:
            if [e for e in self.edges if e[:2] == (source, pin)] != [(source, pin, target, value)]:
                raise ValueError('ONCE_READ_VALUE_NOT_STORED')
        if any('MemberName="GetPathName"' in f for name, node in self.nodes.items() if name != 'SelfPath' for f in node['fields']):
            raise ValueError('UNEXPECTED_OBJECT_PATH_READ')
        chain = [('GetCurrentClass', 'CurrentClass', 'HardClassToSoftClass', 'Input'),
                 ('HardClassToSoftClass', 'Output', 'ReadClassPath', 'SoftClassReference')]
        if (any(edge not in self.edges for edge in chain)
                or self.nodes['HardClassToSoftClass']['class'] != '/Script/BlueprintGraph.K2Node_ConvertAsset'
                or 'FunctionReference=(MemberParent=Class\'"/Script/Engine.KismetSystemLibrary"\',MemberName="Conv_SoftClassReferenceToString")' not in self.nodes['ReadClassPath']['fields']):
            raise ValueError('NATIVE_CLASS_PATH_CHAIN_REQUIRED')
        if ('ArrayIndexValid', 'then', 'StoreCurrentComponent', 'execute') not in self.edges:
            raise ValueError('ARRAY_GET_COUNT_GUARD_REQUIRED')
        return {'node_count': len(self.nodes), 'pin_count': sum(len(n['pins']) for n in self.nodes.values()),
                'local_count': len(self.locals), 'edge_count': len(self.edges), 'ids': ids,
                'binding_status': self.binding_status}

    def emit(self):
        if self.binding_status != 'OBSERVED_NATIVE_BINDINGS':
            raise ValueError('DESTINATION_NATIVE_BINDINGS_REQUIRED_NO_PAYLOAD')
        validate_native_bindings(self.templates, self.bindings)
        raw = super().emit()
        old = 'OriginalBlueprint=Blueprint\'"' + core.BLUEPRINT + '"\''
        new = 'OriginalBlueprint=Blueprint\'"' + self.bindings['blueprint_path'] + '"\''
        text = raw.decode('utf-8')
        if text.count(old) != 1:
            raise ValueError('EXACT_FUNCTION_ENVELOPE_REQUIRED')
        return text.replace(old, new, 1).encode('utf-8')

    def record(self):
        bounds = self.validate()
        return {'status': 'SOURCE_BOUND_IMPLEMENTATION_NATIVE_BINDINGS_PENDING' if self.binding_status != 'OBSERVED_NATIVE_BINDINGS' else 'PREPARED_NATIVE_BOUND_SOURCE_REQUIRES_REVIEW',
                'function': self.function, 'bounds': bounds, 'bindings': self.bindings,
                'nodes': list(self.nodes.values()), 'edges': self.edges,
                'locals': {name: {k: v for k, v in value.items() if k != 'template'} for name, value in self.locals.items()},
                'audit': self.audit, 'compatible_type_edges': self.type_links,
                'caller_contract': 'Second F8 must consume B0SnapshotAttempted before this call; all later F8 routes do nothing. Publish Snapshot only after fresh retained-widget validity check. First F8 and EndPlay remain separate reviewed event wiring.',
                'native_import': 'NOT_PERFORMED', 'native_execution': 'NOT_PERFORMED'}


def build_capture(bindings=None):
    t = core.Templates()
    manifest = json.loads(pinned(MANIFEST, MANIFEST_SHA))
    actual_bindings = mock_bindings() if bindings is None else copy.deepcopy(bindings)
    if bindings is None:
        actual_bindings['classification'] = 'UNBOUND_DRAFT'
    if actual_bindings['classification'] not in ('UNBOUND_DRAFT', 'MOCK_ONLY', 'OBSERVED_NATIVE_BINDINGS'):
        raise ValueError('BINDING_CLASSIFICATION')
    if actual_bindings['blueprint_path'] != DESTINATION:
        raise ValueError('EXACT_DIAGNOSTIC_DESTINATION_REQUIRED')
    if actual_bindings['classification'] == 'OBSERVED_NATIVE_BINDINGS':
        validate_native_bindings(t, actual_bindings)
    b = shared.Builder(t, FUNCTION, [], [('Snapshot', 'string')])
    g = CaptureGraph(t, actual_bindings)
    g.nodes, g.audit = b.g.nodes, b.g.audit
    for label, node in g.nodes.items():
        g.source_pin_schemas[label] = {name: g.pin_schema(pin) for name, pin in node['pins'].items()}
        g.source_function_refs[label] = [f for f in node['fields'] if f.startswith(('FunctionReference=', 'MacroGraphReference='))]
    b.g = g
    native = lambda label: t.node(SOURCE, SOURCE_SHA, 'BP_CodexAuthoringProbe', manifest['templates'][label]['relative_path'])
    class_conversion = native_conversion_templates(t)

    def binding(key):
        ref = actual_bindings['references'][key]
        if actual_bindings['classification'] == 'OBSERVED_NATIVE_BINDINGS' and ref['root_name'] != 'InstantActionPlayerController':
            raise ValueError('DESTINATION_REGISTERED_BINDING_REQUIRED')
        return t.node(Path(ref['path']), ref['sha256'], ref['root_name'], ref['relative_path'])

    def member(label, key, member_key):
        g.add(label, binding(key))
        expected = actual_bindings['members'][member_key]
        ref = 'VariableReference=(MemberName="' + expected['name'] + '",MemberGuid=' + expected['guid'] + ',bSelfContext=True)'
        if ref not in g.nodes[label]['fields'] or expected['name'] not in g.nodes[label]['pins']:
            raise ValueError('ACTUAL_MEMBER_BINDING_MISMATCH')
        g.external_member_refs.add(ref)
        return label, expected['name']

    def helper(label, key, name, before, **values):
        g.add(label, binding(key))
        ref = 'FunctionReference=(MemberName="' + name + '",MemberGuid=' + actual_bindings['helpers'][name] + ',bSelfContext=True)'
        if ref not in g.nodes[label]['fields']:
            raise ValueError('ACTUAL_HELPER_BINDING_MISMATCH')
        g.connect(*before, label, 'execute')
        for port, value in values.items():
            b.put(label, port, value)
        return label, 'then'

    def typed_local(name, source_name, getter, setter, kind):
        entry = native('Entry')
        declaration = next(f['text'] for f in entry['fields'] if f['text'].startswith('LocalVariables(') and 'VarName="' + source_name + '"' in f['text'])
        old_id = re.search(r'VarGuid=([A-F0-9]{32})', declaration)[1]
        guid = core.uid()
        declaration = re.sub(r'^LocalVariables\(\d+\)', 'LocalVariables(' + str(len(g.locals)) + ')', declaration)
        declaration = declaration.replace('VarName="' + source_name + '"', 'VarName="' + name + '"', 1).replace('VarGuid=' + old_id, 'VarGuid=' + guid, 1)
        declaration = re.sub(r'FriendlyName="[^"]*"', 'FriendlyName="' + name + '"', declaration, count=1)
        g.locals[name] = {'guid': guid, 'kind': kind, 'declaration': declaration,
                          'template': {'get': native(getter), 'set': native(setter), 'source_name': source_name}}
        g.local_node(name, 'get', 'Get' + name)
        return 'Get' + name, name

    def typed_set(label, name, value, before):
        g.local_node(name, 'set', label)
        if value is not None:
            g.connect(*value, label, name)
        else:
            for key in ('DefaultObject', 'DefaultValue', 'AutogeneratedDefaultValue'):
                g.nodes[label]['pins'][name].pop(key, None)
        g.connect(*before, label, 'execute')
        return label, 'then'

    values = {name: b.local(name, kind) for name, kind in [('Returned','int'),('Visited','int'),('Checked','int'),('Invalid','int'),('Matches','int'),
        ('Paused','bool'),('Local','bool'),('StockValid','bool'),('ClassValid','bool'),('ScanComplete','bool'),
        ('SelfRaw','string'),('SelfSegmented','string'),('SelfLines','int'),('ClassPath','string'),('SnapshotValue','string'),
        ('FormatUnits','int'),('FinalUnits','int'),('FinalLines','int')]}
    current = typed_local('CurrentComponent','ProofCurrentComponent','GetComponent','SetComponent','object')
    current_class = typed_local('CurrentClass','ProofCurrentClass','GetClassLocal','SetClass','class')
    captured = member('CapturedArray','CapturedComponentsGet','CapturedComponents')
    member('StoreCapturedArray','CapturedComponentsSet','CapturedComponents')
    g.add('ControllerSelf', binding('Self'))
    g.add('ClearCapturedArray',native('Clear'))
    g.connect(*captured,'ClearCapturedArray','TargetArray')
    cleanup = typed_set('ReleaseCurrentComponent','CurrentComponent',None,('ClearCapturedArray','then'))
    cleanup = typed_set('ReleaseCurrentClass','CurrentClass',None,cleanup)
    g.connect(*cleanup,'Return','execute')
    g.connect(*values['SnapshotValue'],'Return','Snapshot')

    def finish(before):
        g.connect(*before,'ClearCapturedArray','execute')

    def refusal(label, reason, stock, before):
        text='B0, SEQUENTIAL CAPTURE, NOT LIVE\nScan: NOT COLLECTED\nNOT COLLECTED: '+reason+'\nStock class: '+stock+'\nProbe matches: UNKNOWN\nProbe resolution: NOT_CHECKED\nDETAILS/PAGING DEFERRED'
        finish(b.set(label,'SnapshotValue',text,before))

    before=('Entry','then')
    for name in ('Returned','Visited','Checked','Invalid','Matches'):
        before=b.set('Init'+name,name,0,before)
    before=b.set('InitSnapshot','SnapshotValue','',before)
    readout=member('Readout','ControlReadoutGet','ControlReadout')
    g.add('ReadoutValid',native('ValidObject'));g.connect(*readout,'ReadoutValid','InputObject');g.connect(*before,'ReadoutValid','exec')
    refusal('RefuseReadout','WIDGET INVALID','NOT_CHECKED',('ReadoutValid','Is Not Valid'))
    paused_template=t.node(shared.NATIVE,shared.NATIVE_SHA,'BP_CodexAuthoringProbe','EventGraph.K2Node_CallFunction_901')
    g.add('ReadPaused',paused_template);g.connect('ControllerSelf','self','ReadPaused','WorldContextObject')
    before=b.set('StorePaused','Paused',('ReadPaused','ReturnValue'),('ReadoutValid','Is Valid'))
    paused,unpaused=b.branch('PausedGuard',values['Paused'],before)
    refusal('RefusePaused','PAUSED','NOT_CHECKED',paused)
    g.add('ReadLocal',t.catalog('function:IsLocalController'));g.connect('ControllerSelf','self','ReadLocal','self')
    before=b.set('StoreLocal','Local',('ReadLocal','ReturnValue'),unpaused)
    local,not_local=b.branch('LocalGuard',values['Local'],before)
    refusal('RefuseLocal','NOT LOCAL CONTROLLER','NOT_CHECKED',not_local)
    g.add('ReadStockClassValid',native('ValidClass'))
    g.nodes['ReadStockClassValid']['pins']['Class']['DefaultObject']=json.dumps(BASE_CLASS)
    before=b.set('StoreStockValidity','StockValid',('ReadStockClassValid','ReturnValue'),local)
    stock_valid,stock_invalid=b.branch('StockClassGuard',values['StockValid'],before)
    refusal('RefuseStockClass','STOCK CLASS INVALID','INVALID',stock_invalid)
    g.add('SelfPath',native('ClassPath'));g.connect('ControllerSelf','self','SelfPath','Object')
    before=b.set('StoreSelfPath','SelfRaw',('SelfPath','ReturnValue'),stock_valid)
    before=helper('SegmentSelf','SegmentCall','SegmentValidatedPath',before,Raw=values['SelfRaw'])
    self_ok,self_bad=b.branch('SelfIdentityGuard',('SegmentSelf','Valid'),before)
    refusal('RefuseSelfIdentity','SELF IDENTITY INVALID','VALID',self_bad)
    before=b.set('StoreSelfSegments','SelfSegmented',('SegmentSelf','Segmented'),self_ok)
    before=b.set('StoreSelfLines','SelfLines',('SegmentSelf','Lines'),before)
    segment_len=b.call('SelfSegmentLength','Len',S=values['SelfSegmented'])
    segment_bound=b.call('SelfSegmentBound','LessEqual_IntInt',A=segment_len,B=263)
    line_bound=b.range('SelfLineRange',values['SelfLines'],1,7)
    context_ok=b.call('SelfContextBound','BooleanAND',A=segment_bound,B=line_bound)
    context_ready,context_bad=b.branch('SelfContextGuard',context_ok,before)
    refusal('RefuseSelfContext','SELF SEGMENT LIMIT','VALID',context_bad)

    g.add('SoleComponentQuery',t.catalog('function:K2_GetComponentsByClass'))
    g.connect('ControllerSelf','self','SoleComponentQuery','self')
    g.connect('SoleComponentQuery','ReturnValue','StoreCapturedArray',actual_bindings['members']['CapturedComponents']['name'])
    g.connect(*context_ready,'StoreCapturedArray','execute')
    g.add('CapturedLength',native('Length'));g.connect(*captured,'CapturedLength','TargetArray')
    before=b.set('FreezeReturned','Returned',('CapturedLength','ReturnValue'),('StoreCapturedArray','then'))
    body,completed,index=b.loop('ComponentLoop',31,before)
    in_bounds=b.call('IndexWithinCapturedCount','Less_IntInt',A=index,B=values['Returned'])
    inspect,done=b.branch('ArrayIndexValid',in_bounds,body);g.connect(*done,'ComponentLoop','Break')
    g.add('ReadArrayItem',native('Item'));g.connect(*captured,'ReadArrayItem','Array');g.connect(*index,'ReadArrayItem','Dimension 1')
    before=typed_set('StoreCurrentComponent','CurrentComponent',('ReadArrayItem','Output'),inspect)
    inc=b.call('NextVisited','Add_IntInt',A=values['Visited'],B=1)
    before=b.set('IncrementVisited','Visited',inc,before)
    g.add('CurrentComponentValid',native('ValidObject'));g.connect(*current,'CurrentComponentValid','InputObject');g.connect(*before,'CurrentComponentValid','exec')
    next_invalid=b.call('NextInvalid','Add_IntInt',A=values['Invalid'],B=1)
    b.set('IncrementInvalid','Invalid',next_invalid,('CurrentComponentValid','Is Not Valid'))
    g.add('ReadClass',native('GetClass'));g.connect(*current,'ReadClass','Object')
    before=typed_set('StoreCurrentClass','CurrentClass',('ReadClass','ReturnValue'),('CurrentComponentValid','Is Valid'))
    g.add('ReadClassValid',native('ValidClass'));g.connect(*current_class,'ReadClassValid','Class')
    before=b.set('StoreClassValidity','ClassValid',('ReadClassValid','ReturnValue'),before)
    class_ok,class_bad=b.branch('ClassValidityGuard',values['ClassValid'],before);g.connect(*class_bad,'IncrementInvalid','execute')
    g.add('HardClassToSoftClass',class_conversion['HardClassToSoftClass'])
    g.connect(*current_class,'HardClassToSoftClass','Input')
    g.add('ReadClassPath',class_conversion['ReadClassPath'])
    g.connect('HardClassToSoftClass','Output','ReadClassPath','SoftClassReference')
    before=b.set('StoreClassPath','ClassPath',('ReadClassPath','ReturnValue'),class_ok)
    before=helper('ValidateClassPath','ValidateCall','ValidateBoundedIdentity',before,Raw=values['ClassPath'],Limit=256)
    path_ok,path_bad=b.branch('ClassPathGuard',('ValidateClassPath','Valid'),before);g.connect(*path_bad,'IncrementInvalid','execute')
    checked=b.call('NextChecked','Add_IntInt',A=values['Checked'],B=1);before=b.set('IncrementChecked','Checked',checked,path_ok)
    match=b.call('ExactProbeClassMatch','EqualEqual_StrStr',A=values['ClassPath'],B=PROBE_CLASS)
    matched,nonmatch=b.branch('ProbeMatchGuard',match,before)
    matches=b.call('NextMatches','Add_IntInt',A=values['Matches'],B=1);b.set('IncrementMatches','Matches',matches,matched)

    # Complete means every raw captured entry passed every class/path check.
    count_bound=b.call('CountWithinScanLimit','LessEqual_IntInt',A=values['Returned'],B=32)
    visited_all=b.call('VisitedAll','EqualEqual_IntInt',A=values['Visited'],B=values['Returned'])
    checked_all=b.call('CheckedAll','EqualEqual_IntInt',A=values['Checked'],B=values['Returned'])
    no_invalid=b.call('NoInvalid','EqualEqual_IntInt',A=values['Invalid'],B=0)
    complete_a=b.call('CompleteCountAndVisit','BooleanAND',A=count_bound,B=visited_all)
    complete_b=b.call('CompleteCheckAndInvalid','BooleanAND',A=checked_all,B=no_invalid)
    complete=b.call('CompleteCapturedScan','BooleanAND',A=complete_a,B=complete_b)
    before=b.set('FreezeCompleteness','ScanComplete',complete,completed)
    strings={}
    for name in ('Returned','Visited','Checked','Invalid','Matches'):
        strings[name]=b.local(name+'Text','string')
        number=b.call('Format'+name,'Conv_IntToString',InInt=values[name])
        before=b.set('Freeze'+name+'Text',name+'Text',number,before)
    # Every rendered counter is a stored int32. Bound each conversion before
    # constructing even the short match labels or the format-failure page.
    count_texts_fit = True
    for name in strings:
        text_units = b.call('CountUnits'+name,'Len',S=strings[name])
        text_fits = b.call('CountFits'+name,'LessEqual_IntInt',A=text_units,B=11)
        count_texts_fit = b.call('CountBounds'+name,'BooleanAND',A=count_texts_fit,B=text_fits)
    safe_counts,bad_counts=b.branch('CountTextBoundsGuard',count_texts_fit,before)
    counter_failure='B0, SEQUENTIAL CAPTURE, NOT LIVE\nScan: INCOMPLETE\nINCOMPLETE: COUNTER FORMAT\nProbe matches: UNKNOWN\nStock class: VALID\nProbe resolution: NOT_CHECKED\nDETAILS/PAGING DEFERRED'
    finish(b.set('RefuseCounterFormat','SnapshotValue',counter_failure,bad_counts))
    complete_exec,incomplete_exec=b.branch('CompleteResultGuard',values['ScanComplete'],safe_counts)
    match_text=b.local('MatchText','string')
    exact=b.call('ExactMatchLabel','Concat_StrStr',A=strings['Matches'],B=' (captured entries)')
    exact=b.call('CompleteScanPrefix','Concat_StrStr',A='COMPLETE\nProbe matches: ',B=exact)
    exact_done=b.set('StoreExactMatchText','MatchText',exact,complete_exec)
    observed=b.call('ObservedMatchPrefix','Concat_StrStr',A='INCOMPLETE\nProbe matches: UNKNOWN (observed ',B=strings['Matches'])
    observed=b.call('ObservedMatchSuffix','Concat_StrStr',A=observed,B=')')
    partial_done=b.set('StorePartialMatchText','MatchText',observed,incomplete_exec)
    parts=[HEADER,values['SelfSegmented'],'\nReturned: ',strings['Returned'],' | Visited: ',strings['Visited'],
           '\nChecked: ',strings['Checked'],' | Invalid: ',strings['Invalid'],'\nScan: ',match_text,FOOTER]
    fixed=sum(len(p) for p in parts if isinstance(p,str))
    total=fixed
    for i,part in enumerate(p for p in parts if isinstance(p,tuple)):
        units=b.call('PartUnits'+str(i),'Len',S=part)
        total=b.call('TotalUnits'+str(i),'Add_IntInt',A=total,B=units)
    before=b.set('StoreFormatUnits','FormatUnits',total,exact_done);g.connect(*partial_done,'StoreFormatUnits','execute')
    fits=b.call('PreConcatWithin768','LessEqual_IntInt',A=values['FormatUnits'],B=768)
    construct,overflow=b.branch('PreConcatGuard',fits,before)
    def concat(prefix, pieces):
        text=pieces[0]
        for i,part in enumerate(pieces[1:]):
            text=b.call(prefix+str(i),'Concat_StrStr',A=text,B=part)
        return text
    before=b.set('FreezeSnapshot','SnapshotValue',concat('SnapshotPart',parts),construct)
    actual_units=b.call('ActualSnapshotUnits','Len',S=values['SnapshotValue'])
    before=b.set('StoreActualUnits','FinalUnits',actual_units,before)
    bounded=b.call('ActualWithin768','LessEqual_IntInt',A=values['FinalUnits'],B=768)
    bounded_exec,bad_actual=b.branch('ActualSizeGuard',bounded,before)
    before=b.set('InitFinalLines','FinalLines',1,bounded_exec)
    line_body,line_done,char_index=b.loop('FinalLineLoop',767,before)
    char_exists=b.call('FinalCharacterExists','Less_IntInt',A=char_index,B=values['FinalUnits'])
    char_read,char_end=b.branch('FinalCharacterGuard',char_exists,line_body);g.connect(*char_end,'FinalLineLoop','Break')
    code=b.call('FinalCodeUnit','GetCharacterAsNumber',SourceString=values['SnapshotValue'],Index=char_index)
    is_newline=b.call('FinalCodeIsNewline','EqualEqual_IntInt',A=code,B=10)
    newline,no_newline=b.branch('FinalNewlineGuard',is_newline,char_read)
    next_line=b.call('NextFinalLine','Add_IntInt',A=values['FinalLines'],B=1);b.set('IncrementFinalLines','FinalLines',next_line,newline)
    lines_ok=b.call('ActualLinesWithin16','LessEqual_IntInt',A=values['FinalLines'],B=16)
    accept,bad_lines=b.branch('ActualLineGuard',lines_ok,line_done);finish(accept)
    fallback_parts=['B0, SEQUENTIAL CAPTURE, NOT LIVE\nScan: INCOMPLETE\nINCOMPLETE: FORMAT LIMIT\nReturned: ',strings['Returned'],
                    ' | Visited: ',strings['Visited'],'\nChecked: ',strings['Checked'],' | Invalid: ',strings['Invalid'],
                    '\nProbe matches: UNKNOWN (observed ',strings['Matches'],')',FOOTER]
    # Five <=11-unit counter strings, fixed ASCII only; this bound is checked
    # offline and the runtime CountTextBoundsGuard dominates every path here.
    assert sum(len(p) if isinstance(p,str) else 11 for p in fallback_parts) <= 768
    assert sum(p.count('\n') for p in fallback_parts if isinstance(p,str)) + 1 <= 16
    fallback_done=b.set('FormatFailure','SnapshotValue',concat('FallbackPart',fallback_parts),overflow)
    g.connect(*bad_actual,'FormatFailure','execute');g.connect(*bad_lines,'FormatFailure','execute');finish(fallback_done)
    g.validate()
    return g


def prepare(output, bindings=None):
    output=output.resolve();output.relative_to((ROOT/'research/evidence').resolve())
    if output.exists():
        raise ValueError('FRESH_OUTPUT_DIRECTORY_REQUIRED')
    graph=build_capture(bindings)
    record=graph.record()
    output.mkdir()
    with (output/'CaptureB0Snapshot.graph.json').open('x',encoding='utf-8') as stream:
        json.dump(record,stream,indent=2,ensure_ascii=True);stream.write('\n')
    if graph.binding_status=='OBSERVED_NATIVE_BINDINGS':
        with (output/'CaptureB0Snapshot.clipboard.txt').open('xb') as stream:stream.write(graph.emit())
    return {'status':record['status'],'output':str(output),'nodes':len(graph.nodes),'native_actions':'NOT_PERFORMED'}


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--output-dir',required=True);parser.add_argument('--bindings')
    args=parser.parse_args();binding_data=json.loads(Path(args.bindings).read_text()) if args.bindings else None
    print(json.dumps(prepare(Path(args.output_dir),binding_data)))
