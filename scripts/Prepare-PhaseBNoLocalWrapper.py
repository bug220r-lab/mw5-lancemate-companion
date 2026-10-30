"""Offline three-node wrapper candidate for one separately reviewed CDO probe.

Use the actual native caller schema and target function GraphGuid/signature.
No native/clipboard calls, no guessed kwargs, no shared-core changes.
"""
import argparse
import datetime
import hashlib
import importlib.util
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
CORE = ROOT / 'scripts/PhaseBBlueprintAssembly.py'
CORE_SHA = '385db1e4aec7276a5a8a3ad8262ac5b8e641f2082ff207d13332b4cb552176f0'
BASELINE = ROOT / 'research/evidence/phase-b-textfunctions-native-01/both.COPY'
BASELINE_SHA = '4d10b66f99231ad40a9ed885dc88fbb23b42badcb02c23e2959f59c81cf0743a'
FUNCTION = 'ProofNoLocalWrapper'
TARGET = 'ProofHelper_0'
LITERAL = 'PHASE_B_NO_LOCAL_WRAPPER_LITERAL'
if hashlib.sha256(CORE.read_bytes()).hexdigest() != CORE_SHA:
    raise ValueError('CORE_PIN_CHANGED')
spec = importlib.util.spec_from_file_location('no_local_wrapper_core', CORE)
core = importlib.util.module_from_spec(spec)
spec.loader.exec_module(core)


def fields(node):
    return [item['text'] for item in node['fields']]


def source_contract(templates):
    records = templates.file(BASELINE, BASELINE_SHA, 'BP_CodexAuthoringProbe')
    by_name = {node['relative_path']: node for node in records}
    root = by_name['']
    for name in ('ProofHelper', TARGET):
        if not any(re.fullmatch(r'FunctionGraphs\(\d+\)=EdGraph\'"' + name + '"\'', f) for f in fields(root)):
            raise ValueError('SOURCE_FUNCTION_NOT_REGISTERED')
    guid = lambda name: next(f.split('=', 1)[1] for f in fields(by_name[name]) if f.startswith('GraphGuid='))
    caller = templates.node(BASELINE, BASELINE_SHA, 'BP_CodexAuthoringProbe', 'EventGraph.K2Node_CallFunction_5')
    expected_ref = 'FunctionReference=(MemberName="ProofHelper",MemberGuid=' + guid('ProofHelper') + ',bSelfContext=True)'
    if expected_ref not in fields(caller):
        raise ValueError('NATIVE_CALLER_BINDING_CHANGED')
    entry = templates.node(BASELINE, BASELINE_SHA, 'BP_CodexAuthoringProbe', TARGET + '.K2Node_FunctionEntry_0')
    result = templates.node(BASELINE, BASELINE_SHA, 'BP_CodexAuthoringProbe', TARGET + '.K2Node_FunctionResult_0')
    pins = lambda node: {json.loads(templates.helper['pin_fields'](p['text'])['PinName']): templates.helper['pin_fields'](p['text']) for p in node['pin_lines']}
    cp, ep, rp = pins(caller), pins(entry), pins(result)
    if set(cp) != {'execute', 'then', 'self', 'NewParam', 'NewParam1'} or set(ep) != {'then', 'NewParam'} or set(rp) != {'execute', 'NewParam1'}:
        raise ValueError('EXACT_NATIVE_SIGNATURE_REQUIRED')
    if ep['NewParam'].get('Direction') != '"EGPD_Output"' or cp['NewParam'].get('Direction') == '"EGPD_Output"':
        raise ValueError('NATIVE_INPUT_DIRECTION')
    if cp['NewParam1'].get('Direction') != '"EGPD_Output"' or rp['NewParam1'].get('Direction') == '"EGPD_Output"':
        raise ValueError('NATIVE_OUTPUT_DIRECTION')
    for p in [cp['NewParam'], cp['NewParam1'], ep['NewParam'], rp['NewParam1']]:
        if p['PinType.PinCategory'] != '"string"' or p['PinType.ContainerType'] != 'None' or p['PinType.PinSubCategoryObject'] != 'None':
            raise ValueError('EXACT_NATIVE_STRING_REQUIRED')
    if not re.fullmatch('[0-9A-F]{32}', guid(TARGET)):
        raise ValueError('TARGET_GRAPH_GUID')
    # The target's known simple execution path must remain the same; the local
    # declaration remains in the callee, never imported into the wrapper.
    if set(x['relative_path'] for x in records if x['relative_path'].startswith(TARGET + '.')) != {TARGET + '.K2Node_FunctionEntry_0', TARGET + '.K2Node_FunctionResult_0'}:
        raise ValueError('TARGET_HAS_UNREVIEWED_NODES')
    if templates.helper['links'](ep['then']) != (('K2Node_FunctionResult_0', rp['execute']['PinId']),):
        raise ValueError('TARGET_EXECUTION_CHANGED')
    if templates.helper['links'](rp['execute']) != (('K2Node_FunctionEntry_0', ep['then']['PinId']),):
        raise ValueError('TARGET_RECIPROCAL_EXECUTION_CHANGED')
    if templates.helper['links'](rp['NewParam1']) or rp['NewParam1'].get('DefaultValue', '""') != '""':
        raise ValueError('TARGET_DEFAULT_RESULT_CHANGED')
    return {'caller': caller, 'entry': entry, 'result': result, 'old_reference': expected_ref,
            'target_graph_guid': guid(TARGET), 'target_input': 'NewParam', 'target_output': 'NewParam1'}


def wrapper_graph(templates=None):
    templates = templates or core.Templates()
    observed = source_contract(templates)
    graph = core.FunctionGraph(templates, FUNCTION)
    graph.native_signature(observed['entry'], observed['result'], [], [('Result', 'string')])
    graph.add('CallHelper', observed['caller'])
    ref = 'FunctionReference=(MemberName="' + TARGET + '",MemberGuid=' + observed['target_graph_guid'] + ',bSelfContext=True)'
    graph.nodes['CallHelper']['fields'] = [ref if f == observed['old_reference'] else f for f in graph.nodes['CallHelper']['fields']]
    graph.audit.append({'operation': 'rebind_native_self_caller_to_observed_same_signature_function',
                        'source': str(BASELINE), 'source_sha256': BASELINE_SHA,
                        'old_reference': observed['old_reference'], 'new_reference': ref,
                        'target_graph_guid': observed['target_graph_guid'], 'native_reconstruction': 'NOT_PERFORMED'})
    graph.default('CallHelper', 'NewParam', LITERAL)
    graph.connect('Entry', 'then', 'CallHelper', 'execute')
    graph.connect('CallHelper', 'then', 'Return', 'execute')
    graph.connect('CallHelper', 'NewParam1', 'Return', 'Result')
    if graph.locals or any(f.startswith('LocalVariables(') for n in graph.nodes.values() for f in n['fields']):
        raise ValueError('WRAPPER_MUST_HAVE_ZERO_LOCALS')
    if len(graph.nodes) != 3 or len(graph.edges) != 3:
        raise ValueError('EXACT_THREE_NODE_WRAPPER_REQUIRED')
    return graph


def prepare(output):
    output = output.resolve()
    output.relative_to((ROOT / 'research/evidence').resolve())
    if output.exists():
        raise ValueError('FRESH_OUTPUT_DIRECTORY_REQUIRED')
    graph = wrapper_graph()
    payload = graph.emit()
    data = {'function': FUNCTION, 'status': 'OFFLINE_CANDIDATE_NATIVE_NOT_PERFORMED',
            'bounds': graph.validate(), 'assembly': graph.audit, 'nodes': list(graph.nodes.values()),
            'edges': graph.edges, 'locals': {}}
    output.mkdir()
    (output / (FUNCTION + '.clipboard.txt')).write_bytes(payload)
    (output / (FUNCTION + '.graph.json')).write_text(json.dumps(data, indent=2) + '\n', encoding='utf-8')
    paths = [Path(__file__), CORE, BASELINE, output / (FUNCTION + '.clipboard.txt'), output / (FUNCTION + '.graph.json')]
    pins = [{'path': str(p.relative_to(ROOT)), 'bytes': len(p.read_bytes()), 'sha256': core.digest(p.read_bytes())} for p in paths]
    receipt = {'status': 'PREPARED_OFFLINE_NO_NATIVE_RETRY', 'created_utc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
               'function': FUNCTION, 'inputs': [], 'outputs': {'Result': 'String'}, 'declared_locals': 0,
               'calls': [{'function': TARGET, 'literal': LITERAL, 'expected_return': ''}],
               'artifacts': pins, 'clipboard_stage': 'NOT_PERFORMED', 'native_import': 'NOT_PERFORMED',
               'native_compile': 'NOT_PERFORMED', 'native_export_review': 'NOT_PERFORMED', 'native_invocation': 'NOT_PERFORMED',
               'limitations': ['No-local wrapper is a proposal to test a reflection bridge behavior; no engine C++ implementation was available locally.',
                               'A forum report motivates the experiment but is not primary technical proof of the installed build.',
                               'Compiler-generated temporaries might still affect reflection; an unexpected required argument stops the new attempt.',
                               'A returned empty String alone is not text-algorithm, HUD, gameplay or observer acceptance.',
                               'Only a fresh reviewed post-import export/signature may authorize preparation of the separate one-call entry.']}
    (output / 'preparation.json').write_text(json.dumps(receipt, indent=2) + '\n', encoding='utf-8')
    return receipt


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--output-dir', required=True)
    args = parser.parse_args()
    print(json.dumps(prepare(Path(args.output_dir)), indent=2))
