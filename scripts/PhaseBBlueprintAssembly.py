"""Offline assembly of source-bound scalar Blueprint function graphs.

Every node/pin/local/signature template is taken from a hash-pinned export.
This module creates text only. Native import/compilation, local rebinding and
execution are separate acceptance gates; no engine or clipboard APIs are used.
"""
import copy
import hashlib
import json
from pathlib import Path
import re
import uuid

ROOT = Path(__file__).resolve().parents[1]
BLUEPRINT = '/Game/CodexEditorControlScratch20260925/BP_CodexAuthoringProbe.BP_CodexAuthoringProbe'
HELPER = ROOT / 'scripts/Prepare-PhaseBTypedSetFragment.py'
HELPER_SHA = '2a66df621155adfd8b13cec7ad93f3a6ddffa6ea04b6339fe27a5e625483dd4a'
CATALOGS = (('phase-b-node-examples-20260927-v2-complete.json', '1b5fc129e2d5c09cb8464fe68b862d2642ae6e77d0991779ee6c2680c7118c0b'),
            ('phase-b-node-examples-20260927-v3-logic-string.json', '7b297d54d5cd429be21a372116953335e1761103e29b6d3bffd778ab3f4cfb9b'))
STOCK = {
    '001': ('001-Dpad_LanceOrderDispatcher-source.COPY', 'Dpad_LanceOrderDispatcher', '42e9a62ef6549a4d5e7ad439d001ded0a1c2a68b1ef755ffc14685edfd6d0eb2'),
    '008': ('008-LanceStatusWidget-source.COPY', 'LanceStatusWidget', '842f0d858e7a1468a8f27dd41e51a82a47b93143497e9b1c6243c124c170f2af'),
    '232': ('232-MW5_GameplayTagLibrary-source.COPY', 'MW5_GameplayTagLibrary', 'd253b5ebe6ef2a90a2d9f8ef4cbe5c22e639cb03711dc2c1432fe060846088be'),
}
SCALARS = {'bool', 'int', 'string'}


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def uid():
    return uuid.uuid4().hex.upper()


def read_pinned(path, sha):
    raw = path.read_bytes()
    if len(raw) > 8 * 1024**2 or digest(raw) != sha:
        raise ValueError('SOURCE_PIN_DRIFT: ' + str(path))
    return raw


def load_module(path, raw):
    ns = {'__file__': str(path), '__name__': 'pinned_offline_assembly_helper'}
    exec(compile(raw, str(path), 'exec'), ns)
    return ns


class Templates:
    def __init__(self):
        self.helper = load_module(HELPER, read_pinned(HELPER, HELPER_SHA))
        sources = self.helper['SOURCES']
        self.index = load_module(ROOT / sources['indexer'][0], read_pinned(ROOT / sources['indexer'][0], sources['indexer'][1]))['source_nodes']
        self.registration = load_module(ROOT / sources['registration'][0], read_pinned(ROOT / sources['registration'][0], sources['registration'][1]))['registration']
        self.catalogs = [json.loads(read_pinned(ROOT / 'research/evidence' / file, sha).decode('utf-8-sig')) for file, sha in CATALOGS]
        self.loaded = {}
        self.provenance = {}

    def file(self, path, sha, root_name):
        key = (str(path), sha, root_name)
        if key not in self.loaded:
            raw = read_pinned(path, sha)
            self.loaded[key] = self.index(self.helper['decode'](raw), root_name)
        return self.loaded[key]

    def node(self, path, sha, root_name, relative):
        records = self.file(path, sha, root_name)
        node = next((n for n in records if n['relative_path'] == relative), None)
        registered = self.registration(records, node) if node else None
        if not registered:
            raise ValueError('REGISTERED_SOURCE_NODE_REQUIRED: ' + relative)
        result = copy.deepcopy(node)
        result['_provenance'] = {'path': str(path), 'sha256': sha, 'relative_path': relative, 'registration': registered}
        return result

    def stock(self, source, relative):
        file, root_name, sha = STOCK[source]
        path = ROOT / 'research/evidence/editor-source/ai-research-collection-20260921T030437Z-f7d8e930' / file
        return self.node(path, sha, root_name, relative)

    def catalog(self, key):
        bundle = {'catalogs': self.catalogs, 'index': self.index, 'registration': self.registration}
        node = self.helper['catalog_template'](bundle, key)
        example = next(c['examples'][key] for c in self.catalogs if key in c['examples'])
        result = copy.deepcopy(node)
        result['_provenance'] = {'path': example['source'], 'sha256': example['source_sha256'],
                                 'relative_path': example['relative_path'], 'registration': example['registration']}
        return result

    def scalar_local(self, kind):
        specs = {
            'int': ('001', 'CreateCommandForSlot', 'L Index', 'K2Node_VariableGet_9', 'K2Node_VariableSet_0'),
            'bool': ('008', 'AnySquadMemberHasECM', 'L_MemberHasECM', 'K2Node_VariableGet_2', 'K2Node_VariableSet_0'),
            'string': ('232', 'DumpTagContainer', 'L_Output', 'K2Node_VariableGet_1', 'K2Node_VariableSet_0'),
        }
        if kind not in specs:
            raise ValueError('UNOBSERVED_LOCAL_TYPE')
        source, function, name, get_name, set_name = specs[kind]
        entry = self.stock(source, function + '.K2Node_FunctionEntry_0')
        get = self.stock(source, function + '.' + get_name)
        setter = self.stock(source, function + '.' + set_name)
        declaration = next(f['text'] for f in entry['fields'] if f['text'].startswith('LocalVariables(') and 'VarName="' + name + '"' in f['text'])
        guid = re.search(r'VarGuid=([0-9A-F]{32})', declaration).group(1)
        expected = 'VariableReference=(MemberScope="' + function + '",MemberName="' + name + '",MemberGuid=' + guid + ')'
        if any(expected not in [f['text'] for f in n['fields']] for n in (get, setter)):
            raise ValueError('LOCAL_REFERENCE_DECLARATION_DISAGREEMENT')
        if 'VarType=(PinCategory="' + kind + '")' not in declaration:
            raise ValueError('LOCAL_SCALAR_TYPE_DISAGREEMENT')
        return {'kind': kind, 'source_name': name, 'source_scope': function, 'source_guid': guid,
                'declaration': declaration, 'get': get, 'set': setter, 'entry': entry}

    def scalar_port(self, kind, direction):
        specs = {
            ('string', 'input'): ('232', 'DumpTagContainer.K2Node_FunctionEntry_0', 'Title'),
            ('int', 'input'): ('008', 'DispatchOrder.K2Node_FunctionEntry_0', 'Index'),
            ('string', 'output'): ('232', 'DumpTagContainer.K2Node_FunctionResult_0', 'AllTags'),
            ('int', 'output'): ('232', 'RateTagMatches.K2Node_FunctionResult_0', 'ExactMatches'),
            ('bool', 'output'): ('008', 'AnySquadMemberHasECM.K2Node_FunctionResult_0', 'AnyMemberHasECM'),
        }
        if (kind, direction) not in specs:
            raise ValueError('UNOBSERVED_SIGNATURE_TYPE')
        source, relative, name = specs[(kind, direction)]
        node = self.stock(source, relative)
        pin = next(r['text'] for r in node['pin_lines'] if 'PinName="' + name + '"' in r['text'])
        user = next(r['text'] for r in node['fields'] if r['text'].startswith('CustomProperties UserDefinedPin (PinName="' + name + '"'))
        return {'source_name': name, 'pin': pin, 'user_defined_pin': user, 'provenance': node['_provenance']}


class FunctionGraph:
    """Explicit scalar links/defaults; never wildcard inference or foreign member refs."""
    def __init__(self, templates, function):
        if not re.fullmatch(r'[A-Za-z][A-Za-z0-9_]{0,63}', function):
            raise ValueError('FUNCTION_NAME')
        self.templates = templates
        self.h = templates.helper
        self.function = function
        self.nodes, self.locals, self.edges, self.audit = {}, {}, [], []

    def add(self, label, template):
        if label in self.nodes or not re.fullmatch(r'[A-Za-z][A-Za-z0-9_]*', label) or len(self.nodes) >= 192:
            raise ValueError('NODE_LABEL_OR_BOUND')
        if '_provenance' not in template:
            raise ValueError('SOURCE_TEMPLATE_PROVENANCE_REQUIRED')
        class_name = template['class_path'].rsplit('.', 1)[-1]
        fields = [f['text'] for f in template['fields'] if not f['text'].startswith(('NodeGuid=', 'NodePosX=', 'NodePosY='))]
        pins = {}
        dropped = []
        for row in template['pin_lines']:
            p = self.h['pin_fields'](row['text'])
            name = json.loads(p['PinName'])
            if name in pins:
                raise ValueError('DUPLICATE_SOURCE_PIN_NAME')
            dropped.extend(self.h['links'](p))
            p.pop('LinkedTo', None)
            p['PinId'] = uid()
            pins[name] = p
        index = len(self.nodes)
        self.nodes[label] = {'label': label, 'class': template['class_path'], 'name': class_name + '_' + str(2000 + index),
                             'guid': uid(), 'fields': fields, 'pins': pins, 'position': (index % 8 * 400, index // 8 * 320),
                             'source': template['_provenance']}
        self.audit.append({'operation': 'clone_source_node', 'node': label, 'source': template['_provenance'],
                           'external_original_links_removed': dropped})
        return label

    def native_signature(self, entry_template, result_template, inputs, outputs):
        for label, template, direction, ports in (('Entry', entry_template, 'input', inputs), ('Return', result_template, 'output', outputs)):
            self.add(label, template)
            node = self.nodes[label]
            node['fields'] = [x for x in node['fields'] if not x.startswith(('CustomProperties UserDefinedPin', 'LocalVariables(', 'FunctionReference='))]
            node['fields'].append('FunctionReference=(MemberName="' + self.function + '")')
            node['pins'] = {n: p for n, p in node['pins'].items() if p['PinType.PinCategory'] == '"exec"'}
            for name, kind in ports:
                if not re.fullmatch('[A-Za-z][A-Za-z0-9_]*', name) or name in node['pins']:
                    raise ValueError('SIGNATURE_PIN_NAME')
                port = self.templates.scalar_port(kind, direction)
                p = self.h['pin_fields'](port['pin'])
                p['PinName'], p['PinId'] = json.dumps(name), uid()
                p.pop('LinkedTo', None)
                node['pins'][name] = p
                user = port['user_defined_pin'].replace('PinName="' + port['source_name'] + '"', 'PinName="' + name + '"', 1)
                node['fields'].append(user)
                self.audit.append({'operation': 'copy_typed_signature_port', 'node': label, 'name': name, 'kind': kind, 'source': port['provenance']})

    def local(self, name, kind):
        if name in self.locals or not re.fullmatch('[A-Za-z][A-Za-z0-9_]*', name):
            raise ValueError('LOCAL_NAME')
        template = self.templates.scalar_local(kind)
        guid = uid()
        line = re.sub(r'^LocalVariables\(\d+\)', 'LocalVariables(' + str(len(self.locals)) + ')', template['declaration'])
        line = line.replace('VarName="' + template['source_name'] + '"', 'VarName="' + name + '"', 1)
        line = line.replace('VarGuid=' + template['source_guid'], 'VarGuid=' + guid, 1)
        line = re.sub(r'FriendlyName="[^"]*"', 'FriendlyName="' + name + '"', line, count=1)
        self.locals[name] = {'guid': guid, 'kind': kind, 'declaration': line, 'template': template}
        return name

    def local_node(self, name, access, label):
        if access not in ('get', 'set') or name not in self.locals:
            raise ValueError('DECLARED_LOCAL_REQUIRED')
        local = self.locals[name]
        template = local['template']
        self.add(label, template[access])
        node = self.nodes[label]
        ref = 'VariableReference=(MemberScope="' + self.function + '",MemberName="' + name + '",MemberGuid=' + local['guid'] + ')'
        node['fields'] = [ref if f.startswith('VariableReference=') else f for f in node['fields']]
        old = template['source_name']
        node['pins'][name] = node['pins'].pop(old)
        node['pins'][name]['PinName'] = json.dumps(name)
        self.audit.append({'operation': 'rebind_existing_local_schema', 'node': label, 'scope': self.function, 'name': name, 'guid': local['guid'], 'kind': local['kind']})
        return label

    def connect(self, source, outpin, destination, inpin):
        a, b = self.nodes[source]['pins'][outpin], self.nodes[destination]['pins'][inpin]
        if a.get('Direction') != '"EGPD_Output"' or b.get('Direction') == '"EGPD_Output"':
            raise ValueError('LINK_DIRECTION')
        for key in ('PinType.PinCategory', 'PinType.PinSubCategory', 'PinType.PinSubCategoryObject', 'PinType.ContainerType'):
            if a[key] != b[key]:
                raise ValueError('LINK_TYPE_REQUIRES_NATIVE_SPECIALIZATION: ' + key)
        edge = (source, outpin, destination, inpin)
        if edge in self.edges:
            raise ValueError('DUPLICATE_EDGE')
        category = a['PinType.PinCategory']
        if category == '"exec"' and any(x[:2] == edge[:2] for x in self.edges):
            raise ValueError('EXEC_OUTPUT_FANOUT')
        if category != '"exec"' and any(x[2:] == edge[2:] for x in self.edges):
            raise ValueError('DATA_INPUT_MULTIPLE_PRODUCERS')
        self.edges.append(edge)

    def default(self, node, pin, value):
        p = self.nodes[node]['pins'][pin]
        kind = json.loads(p['PinType.PinCategory'])
        if p.get('Direction') == '"EGPD_Output"' or any(x[2:] == (node, pin) for x in self.edges):
            raise ValueError('DEFAULT_ONLY_UNLINKED_INPUT')
        if kind == 'int' and (type(value) is not int or not -2147483648 <= value <= 2147483647):
            raise ValueError('INT_DEFAULT_BOUND')
        if kind == 'bool' and type(value) is not bool:
            raise ValueError('BOOL_DEFAULT')
        if kind == 'string' and (not isinstance(value, str) or len(value) > 256):
            raise ValueError('STRING_DEFAULT_BOUND')
        if kind not in SCALARS:
            raise ValueError('SCALAR_DEFAULT_REQUIRED')
        text = str(value).lower() if kind == 'bool' else str(value)
        p['DefaultValue'] = json.dumps(text, ensure_ascii=False)
        self.audit.append({'operation': 'bounded_scalar_input_default', 'node': node, 'pin': pin, 'kind': kind, 'value': value})

    def emit(self):
        if 'Entry' not in self.nodes or 'Return' not in self.nodes:
            raise ValueError('FUNCTION_BOUNDARIES_REQUIRED')
        self.validate()
        nodes = copy.deepcopy(self.nodes)
        nodes['Entry']['fields'] += [local['declaration'] for local in self.locals.values()]
        for a, pa, b, pb in self.edges:
            na, nb = nodes[a], nodes[b]
            for source, sp, target, tp in ((na, pa, nb, pb), (nb, pb, na, pa)):
                p = source['pins'][sp]
                links = p.get('LinkedTo', '()')[:-1]
                p['LinkedTo'] = links + target['name'] + ' ' + target['pins'][tp]['PinId'] + ',)'
        blocks = []
        for node in nodes.values():
            lines = ['Begin Object Class=' + node['class'] + ' Name="' + node['name'] + '"']
            fields = node['fields'] + ['NodePosX=' + str(node['position'][0]), 'NodePosY=' + str(node['position'][1]), 'NodeGuid=' + node['guid']]
            lines += ['   ' + f for f in fields]
            for p in node['pins'].values():
                lines.append('   CustomProperties Pin (' + ','.join(k + '=' + v for k, v in p.items()) + ',)')
            blocks.append('\r\n'.join(lines + ['End Object']))
        body = '\r\n'.join(blocks) + '\r\n'
        text = 'BPGraph(GraphName="' + self.function + '",GraphType=GT_Function,OriginalBlueprint=Blueprint\'"' + BLUEPRINT + '"\',NodesString=' + json.dumps(body, ensure_ascii=False) + ')'
        payload = text.encode('utf-8')
        if len(payload) > 1024 * 1024:
            raise ValueError('FUNCTION_PAYLOAD_BOUND')
        return payload

    def validate(self):
        """Fail closed on corrupted identities, links or scoped local bindings."""
        ids = [n['guid'] for n in self.nodes.values()]
        ids += [p['PinId'] for n in self.nodes.values() for p in n['pins'].values()]
        ids += [x['guid'] for x in self.locals.values()]
        if any(not re.fullmatch('[0-9A-F]{32}', x) for x in ids) or len(ids) != len(set(ids)):
            raise ValueError('GENERATED_ID_COLLISION_OR_SYNTAX')
        for node in self.nodes.values():
            for field in node['fields']:
                if field.startswith('VariableReference='):
                    matches = [name for name, local in self.locals.items() if field ==
                               'VariableReference=(MemberScope="' + self.function + '",MemberName="' + name + '",MemberGuid=' + local['guid'] + ')']
                    if len(matches) != 1:
                        raise ValueError('FOREIGN_OR_UNDECLARED_LOCAL_REFERENCE')
                    value = node['pins'].get(matches[0])
                    if value is None or json.loads(value['PinType.PinCategory']) != self.locals[matches[0]]['kind']:
                        raise ValueError('LOCAL_PIN_DECLARATION_TYPE')
        saved = list(self.edges)
        self.edges = []
        try:
            for edge in saved:
                self.connect(*edge)
        except Exception:
            self.edges = saved
            raise
        return {'node_count': len(self.nodes), 'pin_count': sum(len(n['pins']) for n in self.nodes.values()),
                'local_count': len(self.locals), 'edge_count': len(self.edges), 'ids': ids}
