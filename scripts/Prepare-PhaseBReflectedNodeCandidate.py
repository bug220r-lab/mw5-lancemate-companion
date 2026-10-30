"""Offline three disconnected call-node candidate; native pin reconstruction unproven.

Function owners/names are observed in the current native reflection result.
No CustomProperties Pin, pin IDs/types/defaults, execution links or members are
invented. bIsPureFunc is a generic imported-node hint whose target metadata must
be independently verified in the editor's reconstructed/exported graph.
"""
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
import uuid

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'research/evidence/phase-b-reflected-node-proof-20260927-01'
PROBE = ROOT / 'research/evidence/phase-b-reflected-functions-20260927-01/native.result.json'
PROBE_SHA = '713eac7306ecb6c639b3752f62d165bec70a90137a5e01f483aa55ac7e378f10'
TYPED = ROOT / 'research/evidence/phase-b-typed-variable-proof-20260927-01/typed.COPY'
TYPED_SHA = 'faf4d7cce4a304693576c9c2207b61a85b79987104d31e71b116ba6e43ffa829'
FUNCTIONS = (('/Script/Engine.GameplayStatics', 'GetObjectClass'),
             ('/Script/Engine.GameplayStatics', 'IsGamePaused'),
             ('/Script/Engine.KismetStringLibrary', 'GetCharacterAsNumber'))


def pin(path):
    raw = path.read_bytes()
    return {'path': str(path), 'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()}


def prepare():
    if pin(PROBE)['sha256'] != PROBE_SHA or pin(TYPED)['sha256'] != TYPED_SHA:
        raise ValueError('OBSERVED_SOURCE_DRIFT')
    report = json.loads(PROBE.read_text(encoding='utf-8'))
    baseline = TYPED.read_text(encoding='utf-8-sig')
    if report['status'] != 'OBSERVED_READ_ONLY_REFLECTION_REQUIRES_REVIEW' or report['pid'] != 26084:
        raise ValueError('NATIVE_REFLECTION_RESULT_REQUIRED')
    if report['counters']['function_invocations'] != 0 or report['counters']['asset_loads'] != 0:
        raise ValueError('READ_ONLY_PROVENANCE_CHANGED')
    if len(report['functions']) != 3:
        raise ValueError('EXACT_THREE_NATIVE_FUNCTIONS_REQUIRED')
    # Envelope and generic pure-node hint both occur in the native typed export.
    if ('Begin Object Class=/Script/BlueprintGraph.K2Node_CallFunction Name="K2Node_CallFunction_702"' not in baseline
            or 'bIsPureFunc=True' not in baseline):
        raise ValueError('NATIVE_GENERIC_CALL_WRAPPER_REQUIRED')
    nodes, blocks, source_pins = [], [], [pin(PROBE), pin(TYPED)]
    for i, ((owner, function), observed) in enumerate(zip(FUNCTIONS, report['functions'])):
        if (observed['parent'], observed['requested_child_name'], observed['outer_path']) != (owner, function, owner):
            raise ValueError('FUNCTION_OWNER_NAME_CHANGED')
        if observed['observed'] != {'name': function, 'path': owner + ':' + function, 'class': '/Script/CoreUObject.Function'}:
            raise ValueError('NATIVE_FUNCTION_IDENTITY_CHANGED')
        exp = observed['export']
        path = Path(exp['path'])
        if path.resolve().parent != PROBE.parent.resolve() or pin(path) != exp:
            raise ValueError('FUNCTION_EXPORT_CHANGED')
        source_pins.append(pin(path))
        name, guid = 'K2Node_CallFunction_' + str(900 + i), uuid.uuid4().hex.upper()
        if name in baseline or guid in baseline:
            raise ValueError('DESTINATION_ID_COLLISION')
        lines = ['Begin Object Class=/Script/BlueprintGraph.K2Node_CallFunction Name="' + name + '"',
                 '   bIsPureFunc=True',
                 '   FunctionReference=(MemberParent=Class\'"' + owner + '"\',MemberName="' + function + '")',
                 '   NodePosX=' + str(1024 + 384 * i), '   NodePosY=1536', '   NodeGuid=' + guid, 'End Object']
        blocks.append('\r\n'.join(lines))
        nodes.append({'name': name, 'guid': guid, 'function_owner': owner, 'function_name': function,
                      'native_pin_schema': 'OMITTED_FOR_RECONSTRUCTION_PROOF_NOT_YET_OBSERVED'})
    payload = ('\r\n'.join(blocks) + '\r\n').encode('utf-8')
    if not 0 < len(payload) <= 4096 or len(set(n['guid'] for n in nodes)) != 3:
        raise ValueError('PAYLOAD_SIZE_OR_GUID_BOUND')
    text = payload.decode('utf-8')
    if text.count('Begin Object ') != 3 or text.count('End Object') != 3:
        raise ValueError('EXACT_NODE_COUNT_REQUIRED')
    if any(token in text for token in ('CustomProperties', 'PinId=', 'LinkedTo=', 'VariableReference=', 'MemberGuid=', 'K2Node_Event')):
        raise ValueError('NO_PIN_LINK_OR_MEMBER_SPECULATION')
    if len(re.findall(r'^   FunctionReference=', text, re.M)) != 3:
        raise ValueError('EXACT_FUNCTION_REFERENCES_REQUIRED')
    return payload, nodes, source_pins


def main():
    payload, nodes, sources = prepare()
    if OUT.resolve() != OUT.absolute():
        raise ValueError('OUTPUT_REDIRECTED')
    for path in (OUT, *OUT.parents):
        if path.exists() and (path.is_symlink() or getattr(path.lstat(), 'st_file_attributes', 0) & 0x400):
            raise ValueError('OUTPUT_REPARSE_REJECTED')
        if path == ROOT:
            break
    OUT.mkdir(exist_ok=True)
    dest = OUT / 'reflected-nodes.clipboard.txt'
    audit = OUT / 'payload-audit.json'
    if dest.exists() or audit.exists():
        raise ValueError('NO_OVERWRITE')
    with dest.open('xb') as stream:
        stream.write(payload)
    record = {'status': 'PROPOSED_PIN_RECONSTRUCTION_CANDIDATE_NATIVE_PASTE_NOT_PERFORMED',
              'created_utc': datetime.now(timezone.utc).isoformat(), 'payload': pin(dest), 'generator': pin(Path(__file__)),
              'nodes': nodes, 'source_pins': sources, 'target': '/Game/CodexEditorControlScratch20260925/BP_CodexAuthoringProbe.BP_CodexAuthoringProbe:EventGraph',
              'checks': {'nodes': 3, 'function_references': 3, 'pin_definitions': 0, 'connections': 0, 'variable_declarations': 0},
              'limitations': ['Observed native function existence/owner does not prove Blueprint-callability or reconstructed pins.',
                  'Generic bIsPureFunc=True import hint is not observed target UFunction purity metadata; native reconstruction must validate it.',
                  'No graph runtime path reaches these three disconnected candidates.',
                  'Native paste, pin allocation, compile, parameter export and runtime are NOT_PERFORMED for this candidate.',
                  'Failure means this import experiment is inconclusive; no guessed pins or automatic retry.']}
    with audit.open('x', encoding='utf-8') as stream:
        json.dump(record, stream, indent=2)
        stream.write('\n')
    print(json.dumps({'payload': record['payload'], 'audit': pin(audit), 'status': record['status']}, indent=2))


if __name__ == '__main__':
    main()
