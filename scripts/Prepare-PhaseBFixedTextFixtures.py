"""Prepare six fixed editor-button fixtures offline; never invoke Unreal."""
import argparse
import copy
import datetime
import hashlib
import importlib.util
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
CORE = ROOT / 'scripts/PhaseBBlueprintAssembly.py'
CORE_SHA = '385db1e4aec7276a5a8a3ad8262ac5b8e641f2082ff207d13332b4cb552176f0'
NATIVE = ROOT / 'research/evidence/phase-b-texthelper-callers-native-01/callers.COPY'
NATIVE_SHA = '4e10ce0efec65aaabab0f3e7316997fd00906be7c9c7158665a5e6244539c6c2'
REVIEW = ROOT / 'research/evidence/phase-b-texthelper-callers-native-01/native-callers-review.json'
REVIEW_SHA = 'c55f3c86ba56b6850870111abc55c38f45763c4b1cb3181883ca31072cad2d17'
EXPECTATIONS = ROOT / 'research/evidence/phase-b-call-in-editor-fixture-20260927-01/fixed-fixture-expectations.json'
EXPECTATIONS_SHA = 'e5b97cff7896a0d96a2d35847ce236aaf99b19dc6f638e2c245baf70db9325f3'
FUNCTION = 'RunFixedTextHelperFixtures_Proof'
TEMPLATE = 'RunFixedTextHelperFixtures'
TARGETS = {
    'ValidateBoundedIdentity': ('EventGraph.K2Node_CallFunction_9100', '17E7ADEB426A31CA70171090E4305F4D'),
    'SegmentValidatedPath': ('EventGraph.K2Node_CallFunction_9101', 'CAEFBE884530942ADF30A8838053E25B'),
    'DecorateBoundedPage': ('EventGraph.K2Node_CallFunction_9102', '110735DF4002F8EF25A015A22EAF0312'),
}


def checked(path, expected):
    raw = path.read_bytes()
    if hashlib.sha256(raw).hexdigest() != expected:
        raise ValueError('PIN_CHANGED: ' + path.name)
    return raw


checked(CORE, CORE_SHA)
spec = importlib.util.spec_from_file_location('fixed_text_fixture_core', CORE)
core = importlib.util.module_from_spec(spec)
spec.loader.exec_module(core)


def fixture_data():
    data = json.loads(checked(EXPECTATIONS, EXPECTATIONS_SHA))
    if [x['case_id'] for x in data['fixtures']] != list(range(1, 7)):
        raise ValueError('EXACT_SIX_CASES_REQUIRED')
    return data


def node_fields(node):
    return [x['text'] for x in node['fields']]


def fixture_graph(templates=None):
    checked(REVIEW, REVIEW_SHA)
    t = templates or core.Templates()
    records = t.file(NATIVE, NATIVE_SHA, 'BP_CodexAuthoringProbe')
    by_path = {n['relative_path']: n for n in records}
    root_fields = node_fields(by_path[''])
    for name in list(TARGETS) + [TEMPLATE]:
        if not any(re.fullmatch(r'FunctionGraphs\(\d+\)=EdGraph\'"' + name + '"\'', f) for f in root_fields):
            raise ValueError('UNREGISTERED_NATIVE_FUNCTION: ' + name)
    if FUNCTION in by_path:
        raise ValueError('DISTINCT_FIXTURE_NAME_REQUIRED')
    native = lambda relative: t.node(NATIVE, NATIVE_SHA, 'BP_CodexAuthoringProbe', relative)
    entry = native(TEMPLATE + '.K2Node_FunctionEntry_0')
    if set(n['relative_path'] for n in records if n['relative_path'].startswith(TEMPLATE + '.')) != {TEMPLATE + '.K2Node_FunctionEntry_0'}:
        raise ValueError('EMPTY_ENTRY_TEMPLATE_REQUIRED')
    if 'MetaData=(bCallInEditor=True)' not in node_fields(entry) or 'ExtraFlags=201457664' not in node_fields(entry):
        raise ValueError('NATIVE_EDITOR_BUTTON_METADATA_REQUIRED')
    g = core.FunctionGraph(t, FUNCTION)
    g.add('Entry', entry)
    g.nodes['Entry']['fields'] = [
        'FunctionReference=(MemberName="' + FUNCTION + '")' if f.startswith('FunctionReference=') else f
        for f in g.nodes['Entry']['fields']]
    if set(g.nodes['Entry']['pins']) != {'then'} or any(f.startswith('LocalVariables(') for f in g.nodes['Entry']['fields']):
        raise ValueError('ZERO_INPUTS_OUTPUTS_LOCALS_REQUIRED')
    data = fixture_data()
    g.fixture_cases = []
    marker = data['log_marker']
    print_template = native('EventGraph.K2Node_CallFunction_0')
    print_ref = next(f for f in node_fields(print_template) if f.startswith('FunctionReference='))
    if 'MemberName="PrintString"' not in print_ref:
        raise ValueError('REGISTERED_PRINT_TEMPLATE_REQUIRED')

    def print_node(label, suffix):
        message = marker + ' ' + suffix
        if not message.isascii() or len(message) > 128:
            raise ValueError('FIXED_LOG_BOUND')
        g.add(label, print_template)
        g.default(label, 'InString', message)
        g.default(label, 'bPrintToScreen', False)
        g.default(label, 'bPrintToLog', True)
        return label

    def pure(label, function, **inputs):
        g.add(label, t.catalog('function:' + function))
        for pin, value in inputs.items():
            if isinstance(value, tuple):
                g.connect(value[0], value[1], label, pin)
            else:
                g.default(label, pin, value)
        return (label, 'ReturnValue')

    print_node('BeginLog', 'BEGIN')
    print_node('EndPass', 'END PASS')
    print_node('EndFail', 'END FAIL')
    g.connect('Entry', 'then', 'BeginLog', 'execute')
    before = ('BeginLog', 'then')
    for case in data['fixtures']:
        prefix = 'Case%02d' % case['case_id']
        target = case['function']
        relative, guid = TARGETS[target]
        caller = native(relative)
        reference = 'FunctionReference=(MemberName="' + target + '",MemberGuid=' + guid + ',bSelfContext=True)'
        if reference not in node_fields(caller) or 'GraphGuid=' + guid not in node_fields(by_path[target]):
            raise ValueError('EXACT_NATIVE_CALLER_BINDING_REQUIRED')
        call = prefix + 'Call'
        g.add(call, caller)
        pins = g.nodes[call]['pins']
        actual_inputs = {name for name, p in pins.items() if p.get('Direction') != '"EGPD_Output"' and name not in ('execute', 'self')}
        actual_outputs = {name for name, p in pins.items() if p.get('Direction') == '"EGPD_Output"' and name != 'then'}
        if actual_inputs != set(case['inputs']) or actual_outputs != set(case['expected']):
            raise ValueError('EVERY_NATIVE_INPUT_OUTPUT_REQUIRED')
        for name, value in case['inputs'].items():
            g.default(call, name, value)
        g.connect(*before, call, 'execute')
        checks = []
        for name, expected in case['expected'].items():
            output = (call, name)
            kind = json.loads(pins[name]['PinType.PinCategory'])
            if type(expected) is bool and kind == 'bool':
                check = output if expected else pure(prefix + name + 'Not', 'Not_PreBool', A=output)
            elif type(expected) is int and kind == 'int':
                check = pure(prefix + name + 'Equals', 'EqualEqual_IntInt', A=output, B=expected)
            elif type(expected) is str and kind == 'string':
                check = pure(prefix + name + 'Equals', 'EqualEqual_StrStr', A=output, B=expected)
            else:
                raise ValueError('EXPECTED_VALUE_NATIVE_TYPE_MISMATCH')
            checks.append(check)
        condition = checks[0]
        for i, check in enumerate(checks[1:], 1):
            condition = pure(prefix + 'All' + str(i), 'BooleanAND', A=condition, B=check)
        branch = prefix + 'Branch'
        g.add(branch, t.catalog('node:K2Node_IfThenElse'))
        g.connect(call, 'then', branch, 'execute')
        g.connect(*condition, branch, 'Condition')
        good, bad = prefix + 'Pass', prefix + 'Fail'
        print_node(good, 'PASS%02d' % case['case_id'])
        print_node(bad, 'FAIL%02d' % case['case_id'])
        g.connect(branch, 'then', good, 'execute')
        g.connect(branch, 'else', bad, 'execute')
        g.connect(bad, 'then', 'EndFail', 'execute')
        before = (good, 'then')
        g.fixture_cases.append({'case_id': case['case_id'], 'call': call, 'function': target,
                                'inputs': case['inputs'], 'expected': case['expected'], 'checks': checks})
    g.connect(*before, 'EndPass', 'execute')
    g.audit.append({'operation': 'preserve_native_empty_function_boundary_and_editor_metadata',
                    'source': entry['_provenance'], 'new_name': FUNCTION,
                    'declared_locals': 0, 'public_inputs': 0, 'public_outputs': 0,
                    'termination': 'EndPass/EndFail unconnected then pins; no invented FunctionResult'})
    g.validate()
    return g


def emit_entry_only(g):
    """Core reciprocal serialization with the observed entry-only void boundary.

    The frozen shared emitter requires a FunctionResult label. The native empty
    fixture has none; keep that source-backed shape instead of fabricating one.
    """
    if 'Entry' not in g.nodes or 'Return' in g.nodes or g.locals:
        raise ValueError('OBSERVED_ENTRY_ONLY_BOUNDARY_REQUIRED')
    g.validate()
    nodes = copy.deepcopy(g.nodes)
    for a, pa, b, pb in g.edges:
        left, right = nodes[a], nodes[b]
        for source, sp, target, tp in ((left, pa, right, pb), (right, pb, left, pa)):
            p = source['pins'][sp]
            p['LinkedTo'] = p.get('LinkedTo', '()')[:-1] + target['name'] + ' ' + target['pins'][tp]['PinId'] + ',)'
    blocks = []
    for node in nodes.values():
        lines = ['Begin Object Class=' + node['class'] + ' Name="' + node['name'] + '"']
        fields = node['fields'] + ['NodePosX=' + str(node['position'][0]), 'NodePosY=' + str(node['position'][1]), 'NodeGuid=' + node['guid']]
        lines += ['   ' + field for field in fields]
        lines += ['   CustomProperties Pin (' + ','.join(k + '=' + v for k, v in p.items()) + ',)' for p in node['pins'].values()]
        blocks.append('\r\n'.join(lines + ['End Object']))
    body = '\r\n'.join(blocks) + '\r\n'
    text = 'BPGraph(GraphName="' + FUNCTION + '",GraphType=GT_Function,OriginalBlueprint=Blueprint\'"' + core.BLUEPRINT + '"\',NodesString=' + json.dumps(body, ensure_ascii=False) + ')'
    result = text.encode('utf-8')
    if len(result) > 1024 * 1024:
        raise ValueError('PAYLOAD_BOUND')
    return result


def prepare(directory):
    directory = directory.resolve()
    directory.relative_to((ROOT / 'research/evidence').resolve())
    if directory.exists():
        raise ValueError('FRESH_OUTPUT_REQUIRED')
    g = fixture_graph()
    payload = emit_entry_only(g)
    directory.mkdir()
    (directory / (FUNCTION + '.clipboard.txt')).write_bytes(payload)
    graph = {'classification': 'MOCK_ONLY_CANDIDATE_NOT_NATIVE_EXECUTION', 'function': FUNCTION,
             'nodes': list(g.nodes.values()), 'edges': g.edges, 'locals': g.locals,
             'assembly': g.audit, 'fixtures': g.fixture_cases, 'bounds': g.validate()}
    (directory / (FUNCTION + '.graph.json')).write_text(json.dumps(graph, indent=2) + '\n', encoding='utf-8')
    paths = [Path(__file__), CORE, NATIVE, REVIEW, EXPECTATIONS, directory / (FUNCTION + '.clipboard.txt'), directory / (FUNCTION + '.graph.json')]
    pins = [{'path': str(p.relative_to(ROOT)), 'bytes': len(p.read_bytes()), 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()} for p in paths]
    receipt = {'status': 'PREPARED_OFFLINE_FIXED_FIXTURES', 'created_utc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
               'function': FUNCTION, 'pins': pins, 'bounds': g.validate(), 'helper_call_bound': 6,
               'print_message_bound_per_run': 8, 'message_characters_bound_per_run': 1024,
               'native_import': 'NOT_PERFORMED', 'native_invocation': 'NOT_PERFORMED',
               'prerequisites': ['Independent graph review and native import/compile/export review',
                   'Exact supplementary literal roundtrip in native export',
                   'Owned disposable Actor instance and observed driver Details button',
                   'One click only; no CDO/reflection fallback; preserve first failure'],
               'limitations': ['Six fixed fixtures only; no observer or retail acceptance',
                   'Empty metadata template and all existing functions remain unchanged']}
    (directory / 'preparation.json').write_text(json.dumps(receipt, indent=2) + '\n', encoding='utf-8')
    return receipt


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--output-dir', required=True)
    args = parser.parse_args()
    print(json.dumps(prepare(Path(args.output_dir)), indent=2))
