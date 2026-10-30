"""Offline source examples for UI authoring; never an import/paste payload.

Reads previously collected COPY files and reuses their existing lexical indexer.
No Unreal calls, graph generation, asset mutation, application input or network.
"""
import hashlib
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
COLLECTION = ROOT / 'research/evidence/editor-source/ai-research-collection-20260921T030437Z-f7d8e930'
SOURCES = [
    (COLLECTION / '010-MW5PlayerController-source.COPY', 'MW5PlayerController',
     '6faaa7cf5d925123441f8022bda01d7b3475c71849fff94758e7d2c6baa4b530'),
    (COLLECTION / '008-LanceStatusWidget-source.COPY', 'LanceStatusWidget',
     '842f0d858e7a1468a8f27dd41e51a82a47b93143497e9b1c6243c124c170f2af'),
    (COLLECTION / '001-Dpad_LanceOrderDispatcher-source.COPY', 'Dpad_LanceOrderDispatcher',
     '42e9a62ef6549a4d5e7ad439d001ded0a1c2a68b1ef755ffc14685edfd6d0eb2'),
    (ROOT / 'research/evidence/editor-source/diagnostic-final-source-20260925T221745Z-530263a1/controller-source.COPY',
     'InstantActionPlayerController', '1c46d0589b6c79342fcba90857d0ea1970d463325a9eeb00a31e86fbd2afa0db'),
]
FUNCTIONS = (
    'K2_GetComponentsByClass', 'GetPathName', 'GetObjectClass', 'GetCurrentLevelName',
    'IsLocalController', 'IsGamePaused', 'IsValidClass', 'Concat_StrStr', 'Len',
    'EqualEqual_StrStr', 'Add_IntInt', 'Less_IntInt', 'Array_Add', 'Array_Clear',
    'Array_Length', 'Conv_IntToString', 'Conv_StringToText', 'SetSnapshot',
)
NODE_TYPES = ('K2Node_IfThenElse', 'K2Node_VariableGet', 'K2Node_VariableSet',
              'K2Node_GetArrayItem', 'K2Node_ExecutionSequence')
MACROS = ('DoOnce', 'ForLoopWithBreak', 'IsValid')


def source_nodes(text, root_name):
    # Source graph names legitimately contain spaces (e.g. Is Friendly Unit).
    # This catalog does not relax the separate native inspector's admission.
    stack, records = [], {}
    for number, line in enumerate(text.splitlines(), 1):
        value = line.strip()
        if value.startswith('Begin Object '):
            name = re.search(r'\bName="([^"\r\n]+)"', value)
            kind = re.search(r'\bClass=(/[^\s]+)', value)
            if not name or len(stack) >= 16:
                raise ValueError('Unsupported source declaration')
            stack.append(name.group(1))
            if stack[0] != root_name:
                raise ValueError('Unexpected source root')
            record = records.setdefault(tuple(stack), {'relative_path': '.'.join(stack[1:]),
                                                       'class_path': None, 'begin_lines': [],
                                                       'fields': [], 'pin_lines': []})
            record['begin_lines'].append(number)
            if kind:
                if record['class_path'] not in (None, kind.group(1)):
                    raise ValueError('Conflicting class declaration')
                record['class_path'] = kind.group(1)
        elif value == 'End Object':
            if not stack:
                raise ValueError('Unbalanced source')
            stack.pop()
        elif value:
            if not stack:
                raise ValueError('Source outside object')
            records[tuple(stack)]['pin_lines' if value.startswith('CustomProperties Pin ') else 'fields'].append(
                {'line': number, 'text': value})
    if stack:
        raise ValueError('Unclosed source object')
    return list(records.values())


def collect():
    examples, sources = {}, []
    for path, name, expected in SOURCES:
        raw = path.read_bytes()
        if len(raw) > 8 * 1024**2 or hashlib.sha256(raw).hexdigest() != expected:
            raise ValueError('Source pin drift: ' + str(path))
        decoded = raw.decode('utf-16' if raw.startswith((b'\xff\xfe', b'\xfe\xff')) else 'utf-8-sig')
        sources.append({'path': str(path), 'bytes': len(raw), 'sha256': expected})
        for node in source_nodes(decoded, name):
            if not (node['class_path'] or '').startswith('/Script/BlueprintGraph.K2Node_'):
                continue
            fields = '\n'.join(field['text'] for field in node['fields'])
            keys = [f'function:{fn}' for fn in FUNCTIONS if f'MemberName="{fn}"' in fields]
            keys += [f'node:{kind}' for kind in NODE_TYPES if node['class_path'].endswith('.' + kind)]
            keys += [f'macro:{macro}' for macro in MACROS if 'MacroGraphReference=' in fields and
                     re.search(r':'+re.escape(macro)+r'[\'"\)]', fields)]
            for key in keys:
                if key not in examples:
                    examples[key] = {'source': str(path), 'source_sha256': expected, **node}
    requested = [f'function:{x}' for x in FUNCTIONS] + [f'node:{x}' for x in NODE_TYPES] + [f'macro:{x}' for x in MACROS]
    result = {
        'status': 'OFFLINE_SOURCE_EXAMPLES_NOT_CLIPBOARD_PAYLOAD',
        'sources': sources, 'collector_sha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        'examples': examples, 'not_found_in_selected_exports': [key for key in requested if key not in examples],
        'limitations': ['COPY declaration/body records are not native clipboard syntax.',
                        'Example links, GUIDs and self references belong to their source graphs.',
                        'Missing examples are not proof of unavailable nodes; use API/UI evidence.',
                        'No graph was generated, imported, compiled or run.'],
    }
    destination = ROOT / 'research/evidence/phase-b-node-examples-20260927.json'
    with destination.open('x', encoding='utf-8') as stream:
        json.dump(result, stream, indent=2)
        stream.write('\n')
    print(json.dumps({'file': str(destination), 'examples': len(examples),
                      'not_found': result['not_found_in_selected_exports']}))


if __name__ == '__main__':
    collect()
