"""Offline lexical node examples, never graph generation or a paste payload.

Reuses the reviewed first collector, verifies historical export pins, and
requires each example's Nodes registration and its root graph registration.
No Unreal import, application action, native API, clipboard or asset mutation.
"""
import hashlib
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / 'scripts/Collect-PhaseBNodeExamples.py'
BASE_SHA = '7e73f39107d864cb363705d1a559ff60b2fd816bc156f7237b4d0de8b734ed50'
EVIDENCE = ROOT / 'research/evidence'
AI = EVIDENCE / 'editor-source/ai-research-collection-20260921T030437Z-f7d8e930'
OBSERVER = EVIDENCE / 'editor-source/observer-authored-20260925T052357Z-b89383e2'


def read_pinned(path, expected):
    raw = path.read_bytes()
    if len(raw) > 8 * 1024**2 or hashlib.sha256(raw).hexdigest() != expected.lower():
        raise ValueError('Source pin drift: ' + str(path))
    return raw


def decode(raw):
    return raw.decode('utf-16' if raw.startswith((b'\xff\xfe', b'\xfe\xff')) else 'utf-8-sig')


def pin(path):
    raw = path.read_bytes()
    return {'path': str(path), 'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()}


def registration(records, node):
    graph_path, separator, node_name = node['relative_path'].rpartition('.')
    if not separator or '.' in graph_path:
        return None
    indexed = {record['relative_path']: record for record in records}
    graph = indexed.get(graph_path)
    root = indexed.get('')
    if not graph or not root or graph['class_path'] != '/Script/Engine.EdGraph':
        return None
    node_lines = [line for line in graph['fields']
                  if re.match(r'^Nodes\(\d+\)=', line['text']) and
                  re.search(r'"' + re.escape(node_name) + r'"', line['text'])]
    graph_lines = [line for line in root['fields']
                   if re.match(r'^(UbergraphPages|FunctionGraphs|MacroGraphs)\(\d+\)=', line['text']) and
                   re.search(r'"' + re.escape(graph_path) + r'"', line['text'])]
    if len(node_lines) != 1 or len(graph_lines) != 1:
        return None
    return {'classification': 'LEXICAL_REGISTRATION_ONLY', 'graph': graph_path,
            'graph_registration': graph_lines[0], 'node_registration': node_lines[0]}


def collect():
    old_catalog = EVIDENCE / 'phase-b-node-examples-20260927.json'
    before_old = pin(old_catalog)
    namespace = {'__file__': str(BASE), '__name__': 'phase_b_lexical_indexer'}
    exec(compile(read_pinned(BASE, BASE_SHA), str(BASE), 'exec'), namespace)
    sources = list(namespace['SOURCES']) + [
        (OBSERVER / 'BP_LanceObserverProbeComponent.COPY', 'BP_LanceObserverProbeComponent',
         '7ca123068c6a73ee2e4a9ca9bc970f3e3cd88223951be239edff1f2b9c212ce4'),
        (OBSERVER / 'WBP_LanceObserverProbeReadout.COPY', 'WBP_LanceObserverProbeReadout',
         'f1514ddd2484bf545749c640c892e1b7e7ebf1c3d1dd914fe234ccc004b7d2c3'),
        (AI / '007-Dpad_BaseLanceOrder-source.COPY', 'Dpad_BaseLanceOrder',
         'b3eee04327e4c7f850682876b21118ec12642cb49a529ccee6bb2cb5ae7dd81a'),
        (AI / '003-SquadOrderBase-source.COPY', 'SquadOrderBase',
         'dee7eb994d93fde96e240988322664ecbeacf1db933a75301e7ac33f0ad00fd0'),
        (AI / '232-MW5_GameplayTagLibrary-source.COPY', 'MW5_GameplayTagLibrary',
         'd253b5ebe6ef2a90a2d9f8ef4cbe5c22e639cb03711dc2c1432fe060846088be'),
    ]
    functions = namespace['FUNCTIONS'] + ('GetClass', 'SetText')
    examples, source_pins = {}, []
    for path, name, expected in sources:
        text = decode(read_pinned(path, expected))
        source_pins.append(pin(path))
        records = namespace['source_nodes'](text, name)
        for node in records:
            if not (node['class_path'] or '').startswith('/Script/BlueprintGraph.K2Node_'):
                continue
            registered = registration(records, node)
            if registered is None:
                continue
            fields = '\n'.join(line['text'] for line in node['fields'])
            is_entry = node['class_path'].endswith('.K2Node_FunctionEntry')
            keys = [('function-entry:' if is_entry else 'function:') + function for function in functions
                    if 'MemberName="' + function + '"' in fields]
            keys += ['node:' + kind for kind in namespace['NODE_TYPES'] if node['class_path'].endswith('.' + kind)]
            keys += ['macro:' + macro for macro in namespace['MACROS'] if 'MacroGraphReference=' in fields and
                     re.search(r':' + re.escape(macro) + r'[\'"\)]', fields)]
            for key in keys:
                if key not in examples:
                    examples[key] = {'source': str(path), 'source_sha256': expected,
                                     'registration': registered, **node}
    requested = ['function:' + name for name in functions]
    requested += ['node:' + name for name in namespace['NODE_TYPES']]
    requested += ['macro:' + name for name in namespace['MACROS']]
    requested += ['function-entry:SetSnapshot']
    # Inspect existing receipt-pinned stock source only; never synthetic fixtures
    # or live assets. Missing tokens do not establish node/API unavailability.
    report_path = AI / 'report.json'
    report = json.loads(report_path.read_text(encoding='utf-8'))
    scans, hits = [], []
    pattern = re.compile(r'MemberName="(?:GetObjectClass|GetClass|IsGamePaused)"|K2Node_GetClass')
    for asset in report['assets']:
        source = asset.get('source', {})
        if not source.get('file') or not source.get('sha256'):
            continue
        path = Path(source['file'])
        if path.resolve().parent != AI.resolve() or not path.name.endswith('-source.COPY'):
            continue
        raw = read_pinned(path, source['sha256'])
        scans.append(pin(path))
        for number, line in enumerate(decode(raw).splitlines(), 1):
            if pattern.search(line):
                hits.append({'source': str(path), 'source_sha256': source['sha256'], 'line': number, 'text': line.strip()})
    result = {
        'status': 'OFFLINE_REGISTERED_SOURCE_EXAMPLES_NOT_CLIPBOARD_PAYLOAD', 'version': 2,
        'collector': pin(Path(__file__)), 'lexical_indexer': pin(BASE), 'previous_catalog': before_old,
        'sources': source_pins, 'receipt_provenance': [pin(report_path), pin(OBSERVER / 'report.json'),
            pin(EVIDENCE / 'editor-source/diagnostic-final-source-20260925T221745Z-530263a1/report.json')],
        'examples': examples, 'not_found_in_selected_exports': [key for key in requested if key not in examples],
        'get_class_pause_existing_collection_search': {'receipt': pin(report_path), 'scanned_sources': scans, 'hits': hits},
        'limitations': ['All registrations and fields are lexical evidence from the pinned historical exports.',
            'COPY declaration/body records are not native clipboard syntax or an import payload.',
            'Original links, GUIDs, object references and variable names belong to their source graphs.',
            'SetSnapshot is the authored widget function, not a newly discovered engine API.',
            'Function-entry and function-call examples are classified separately.',
            'Missing examples are not proof of unavailable nodes. GetClass is only a search spelling here.',
            'No graph was generated, pasted, imported, compiled, saved or run. Native execution NOT_PERFORMED.'],
    }
    # The first V2 output remains preserved: it lacked a root-registered
    # IsValidClass example. This completed version adds the SquadOrderBase one.
    destination = EVIDENCE / 'phase-b-node-examples-20260927-v2-complete.json'
    with destination.open('x', encoding='utf-8') as stream:
        json.dump(result, stream, indent=2)
        stream.write('\n')
    if pin(old_catalog) != before_old:
        raise ValueError('Historical catalog drift')
    print(json.dumps({'artifact': pin(destination), 'examples': len(examples),
                      'missing': result['not_found_in_selected_exports'], 'class_pause_sources_scanned': len(scans),
                      'class_pause_hits': len(hits), 'historical_catalog_unchanged': True}, indent=2))


if __name__ == '__main__':
    collect()
