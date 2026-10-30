"""Offline three-node proof shell; native UI must supply the string converter.

No Capture repair, clipboard write, engine import or native action. The class
parameter's PCC subtype is a proposed specialization of a real class port.
"""
import copy
from datetime import datetime, timezone
import hashlib
import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CORE = ROOT / 'scripts/PhaseBBlueprintAssembly.py'
CORE_SHA = '385db1e4aec7276a5a8a3ad8262ac5b8e641f2082ff207d13332b4cb552176f0'
SOURCES = ROOT / 'research/evidence/editor-source/ai-research-collection-20260921T030437Z-f7d8e930'
STOCK = SOURCES / '010-MW5PlayerController-source.COPY'
STOCK_SHA = '6faaa7cf5d925123441f8022bda01d7b3475c71849fff94758e7d2c6baa4b530'
SIGNATURE = SOURCES / '006-Dpad_FunctionLib-source.COPY'
SIGNATURE_SHA = '25bfc6f62c91779886e012b713639c4cd08d613a82371cd92d5db9893280d967'
NATIVE = ROOT / 'research/evidence/phase-b-missing-template-proof-20260927-01/templates.COPY'
NATIVE_SHA = 'f3008173fe7bacc107fe05d8f43f64b9536eccae126706e5989439a294c2ac1e'
DESTINATION = '/Game/CodexEditorControlScratch20260925/BP_CodexAuthoringProbe.BP_CodexAuthoringProbe'
FUNCTION = 'ProofB0ClassPathConversion'
PCC = 'BlueprintGeneratedClass\'"/Game/Objects/_common/Components/PlayerControllerComponents/PlayerControllerComponent.PlayerControllerComponent_C"\''
OUT = ROOT / 'research/evidence/phase-b0-class-path-scratch-proof-20260927-01'

raw = CORE.read_bytes()
if hashlib.sha256(raw).hexdigest() != CORE_SHA:
    raise ValueError('CORE_PIN_DRIFT')
spec = importlib.util.spec_from_file_location('class_path_proof_core', CORE)
core = importlib.util.module_from_spec(spec)
exec(compile(raw, str(CORE), 'exec'), core.__dict__)


class Templates(core.Templates):
    def scalar_port(self, kind, direction):
        if (kind, direction) != ('pcc_class', 'input'):
            return super().scalar_port(kind, direction)
        n = self.node(SIGNATURE, SIGNATURE_SHA, 'Dpad_FunctionLib',
                      'Create Dpad Action Logic.K2Node_FunctionEntry_0')
        line = next(x['text'] for x in n['pin_lines'] if 'PinName="Class"' in x['text'])
        user = next(x['text'] for x in n['fields'] if x['text'].startswith('CustomProperties UserDefinedPin (PinName="Class"'))
        fields = self.helper['pin_fields'](line)
        if fields['PinType.PinCategory'] != '"class"' or fields['PinType.ContainerType'] != 'None':
            raise ValueError('SOURCE_CLASS_PORT_REQUIRED')
        old = fields['PinType.PinSubCategoryObject']
        if old != 'BlueprintGeneratedClass\'"/Game/UI/Mech/DPad/DpadActionLogic/Dpad_ActionLogic.Dpad_ActionLogic_C"\'':
            raise ValueError('SOURCE_CLASS_SUBTYPE_DRIFT')
        return {'source_name': 'Class', 'pin': line.replace(old, PCC),
                'user_defined_pin': user.replace(old, PCC), 'provenance': n['_provenance']}


def build():
    t = Templates()
    g = core.FunctionGraph(t, FUNCTION)
    g.native_signature(t.node(NATIVE, NATIVE_SHA, 'BP_CodexAuthoringProbe', 'ProofHelper.K2Node_FunctionEntry_0'),
                       t.node(NATIVE, NATIVE_SHA, 'BP_CodexAuthoringProbe', 'ProofHelper.K2Node_FunctionResult_0'),
                       [('Class', 'pcc_class')], [('Path', 'string')])
    g.add('HardToSoft', t.node(STOCK, STOCK_SHA, 'MW5PlayerController',
                             'AddPlayerControllerComponents.K2Node_ConvertAsset_1'))
    g.nodes['Entry']['position'] = (0, 0)
    g.nodes['HardToSoft']['position'] = (350, 150)
    g.nodes['Return']['position'] = (1100, 0)
    g.connect('Entry', 'then', 'Return', 'execute')
    g.connect('Entry', 'Class', 'HardToSoft', 'Input')
    validate(g)
    return g


def validate(g):
    result = g.validate()
    if g.function != FUNCTION or set(g.nodes) != {'Entry', 'Return', 'HardToSoft'} or g.locals:
        raise ValueError('EXACT_THREE_NODE_SHELL_REQUIRED')
    expected = {'Entry': ('K2Node_FunctionEntry', {'then', 'Class'}),
                'Return': ('K2Node_FunctionResult', {'execute', 'Path'}),
                'HardToSoft': ('K2Node_ConvertAsset', {'Input', 'Output'})}
    for name, (kind, pins) in expected.items():
        if g.nodes[name]['class'] != '/Script/BlueprintGraph.' + kind or set(g.nodes[name]['pins']) != pins:
            raise ValueError('EXACT_NATIVE_NODE_AND_PIN_SET_REQUIRED')
    for node, pin, category in [('Entry', 'Class', 'class'), ('HardToSoft', 'Input', 'class'),
                                ('HardToSoft', 'Output', 'softclass')]:
        p = g.nodes[node]['pins'][pin]
        if (p['PinType.PinCategory'], p['PinType.PinSubCategoryObject'], p['PinType.ContainerType']) != ('"' + category + '"', PCC, 'None'):
            raise ValueError('EXACT_PCC_CLASS_AND_SOFTCLASS_REQUIRED')
    if g.nodes['Return']['pins']['Path']['PinType.PinCategory'] != '"string"':
        raise ValueError('STRING_RETURN_REQUIRED')
    if g.edges != [('Entry', 'then', 'Return', 'execute'), ('Entry', 'Class', 'HardToSoft', 'Input')]:
        raise ValueError('ONLY_TWO_PROOF_SHELL_EDGES')
    if any('LinkedTo' in p for n in g.nodes.values() for p in n['pins'].values()):
        raise ValueError('SOURCE_LINKS_MUST_BE_STRIPPED')
    return result


def emit(g):
    validate(g)
    payload = g.emit()
    old = ('OriginalBlueprint=Blueprint\'"' + core.BLUEPRINT + '"\'').encode()
    new = ('OriginalBlueprint=Blueprint\'"' + DESTINATION + '"\'').encode()
    if payload.count(old) != 1:
        raise ValueError('EXACT_ENVELOPE_REQUIRED')
    payload = payload.replace(old, new, 1)
    if len(payload) > 16384 or b'Conv_SoftClassReferenceToString' in payload or b'MemberGuid=' in payload:
        raise ValueError('NO_GUESSED_CONVERTER_OR_FUNCTION_BINDINGS')
    return payload


def main():
    g = build()
    payload = emit(g)
    out = OUT / (FUNCTION + '.clipboard.txt')
    record_path = OUT / 'proof-shell-preparation.json'
    if out.exists() or record_path.exists():
        raise ValueError('NO_OVERWRITE')
    OUT.mkdir(exist_ok=True)
    with out.open('xb') as f:
        f.write(payload)
    record = {'status': 'PROPOSED_TYPED_THREE_NODE_SHELL_NATIVE_CONVERTER_PENDING',
              'utc': datetime.now(timezone.utc).isoformat(),
              'generator': {'path': str(Path(__file__)), 'sha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest()},
              'payload': {'path': str(out), 'bytes': len(payload), 'sha256': hashlib.sha256(payload).hexdigest()},
              'bounds': validate(g), 'nodes': list(g.nodes.values()), 'edges': g.edges,
              'specialization': 'Copy observed class port metadata from Dpad_FunctionLib; substitute only its subtype with the exact observed PCC class. Native signature acceptance remains unproven.',
              'pending_native_UI': ['Add real ToString(SoftClassReference) by dragging HardToSoft.Output and selecting the observed context-menu result.',
                                    'Connect its String output to Return.Path. Only then does Entry-to-Return consume the pure conversion chain.',
                                    'Compile and export; do not invoke, save or alter Capture until the proof is separately reviewed.'],
              'initial_shell_limit': 'HardToSoft output is initially unconsumed. This shell alone cannot establish reachable conversion compatibility or exact-path semantics.',
              'native_import': 'NOT_PERFORMED', 'native_compile': 'NOT_PERFORMED', 'native_execution': 'NOT_PERFORMED',
              'native_clipboard_action': 'NOT_PERFORMED'}
    with record_path.open('x', encoding='utf-8') as f:
        json.dump(record, f, indent=2); f.write('\n')
    print(json.dumps({'payload': record['payload'], 'bounds': record['bounds']}))


if __name__ == '__main__':
    main()
