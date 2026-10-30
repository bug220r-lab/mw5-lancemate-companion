"""Prepare two source-bound Blueprint text functions; never operate the editor.

Both candidates validate UTF-16 controls and paired surrogates with a fixed
0..255 loop. Segmentation additionally uses a fixed 0..6 loop. This is an
offline candidate, not evidence that a Blueprint import or execution succeeds.
"""
import argparse
import datetime
import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CORE_PATH = ROOT / 'scripts/PhaseBBlueprintAssembly.py'
spec = importlib.util.spec_from_file_location('phase_b_assembly', CORE_PATH)
core = importlib.util.module_from_spec(spec)
spec.loader.exec_module(core)
NATIVE = ROOT / 'research/evidence/phase-b-missing-template-proof-20260927-01/templates.COPY'
NATIVE_SHA = 'f3008173fe7bacc107fe05d8f43f64b9536eccae126706e5989439a294c2ac1e'


class Builder:
    def __init__(self, templates, name, inputs, outputs):
        self.t = templates
        self.g = core.FunctionGraph(templates, name)
        native = lambda rel: templates.node(NATIVE, NATIVE_SHA, 'BP_CodexAuthoringProbe', rel)
        self.character = native('EventGraph.K2Node_CallFunction_902')
        self.g.native_signature(native('ProofHelper.K2Node_FunctionEntry_0'),
                                native('ProofHelper.K2Node_FunctionResult_0'), inputs, outputs)

    def put(self, node, pin, value):
        if isinstance(value, tuple):
            self.g.connect(value[0], value[1], node, pin)
        else:
            self.g.default(node, pin, value)

    def call(self, label, function, **inputs):
        if function == 'GetCharacterAsNumber':
            template = self.character
        elif function == 'Subtract_IntInt':
            template = self.t.stock('008', 'EventGraph.K2Node_CallFunction_18')
        elif function == 'BooleanOR':
            template = self.t.stock('008', 'CanOrderMechs.K2Node_CommutativeAssociativeBinaryOperator_2')
        else:
            template = self.t.catalog('function:' + function)
        self.g.add(label, template)
        for pin, value in inputs.items():
            self.put(label, pin, value)
        return (label, 'ReturnValue')

    def local(self, name, kind):
        self.g.local(name, kind)
        self.g.local_node(name, 'get', 'Get' + name)
        return ('Get' + name, name)

    def set(self, label, name, value, before=None):
        self.g.local_node(name, 'set', label)
        self.put(label, name, value)
        if before:
            self.g.connect(*before, label, 'execute')
        return (label, 'then')

    def branch(self, label, condition, before):
        self.g.add(label, self.t.catalog('node:K2Node_IfThenElse'))
        self.put(label, 'Condition', condition)
        self.g.connect(*before, label, 'execute')
        return (label, 'then'), (label, 'else')

    def loop(self, label, last, before):
        self.g.add(label, self.t.catalog('macro:ForLoopWithBreak'))
        self.g.default(label, 'FirstIndex', 0)
        self.g.default(label, 'LastIndex', last)
        self.g.connect(*before, label, 'Execute')
        return (label, 'LoopBody'), (label, 'Completed'), (label, 'Index')

    def range(self, label, value, low, high):
        lower = self.call(label + 'Low', 'LessEqual_IntInt', A=low, B=value)
        upper = self.call(label + 'High', 'LessEqual_IntInt', A=value, B=high)
        return self.call(label, 'BooleanAND', A=lower, B=upper)

    def validation(self, raw, limit, before):
        """Build the actual fixed-loop graph once, reusable in both functions."""
        units = self.local('VUnits', 'int')
        need_low = self.local('VNeedLow', 'bool')
        invalid = self.local('VInvalid', 'bool')
        code = self.local('VCode', 'int')
        valid = self.local('VValid', 'bool')
        before = self.set('InitNeedLow', 'VNeedLow', False, before)
        before = self.set('InitInvalid', 'VInvalid', False, before)
        before = self.set('InitValid', 'VValid', False, before)
        length = self.call('RawLength', 'Len', S=raw)
        before = self.set('StoreUnits', 'VUnits', length, before)
        valid_limit = self.range('LimitInBounds', limit, 1, 256)
        nonempty = self.call('IsNonempty', 'Less_IntInt', A=0, B=units)
        within_limit = self.call('WithinLimit', 'LessEqual_IntInt', A=units, B=limit)
        bounded = self.call('NonemptyBounded', 'BooleanAND', A=nonempty, B=within_limit)
        bounds = self.call('AllBounds', 'BooleanAND', A=valid_limit, B=bounded)
        start, invalid_bounds = self.branch('BoundsBranch', bounds, before)
        body, completed, index = self.loop('ValidationLoop', 255, start)
        in_string = self.call('IndexInString', 'Less_IntInt', A=index, B=units)
        read_code, finished = self.branch('IndexBranch', in_string, body)
        self.g.connect(*finished, 'ValidationLoop', 'Break')
        char = self.call('ReadCodeUnit', 'GetCharacterAsNumber', SourceString=raw, Index=index)
        after_code = self.set('StoreCodeUnit', 'VCode', char, read_code)
        expecting_low, ordinary = self.branch('NeedLowBranch', need_low, after_code)
        is_low = self.range('IsLowSurrogate', code, 56320, 57343)
        low_ok, bad_pair = self.branch('LowPairBranch', is_low, expecting_low)
        self.set('ClearNeedLow', 'VNeedLow', False, low_ok)
        low_control = self.call('LowControl', 'Less_IntInt', A=code, B=32)
        delete_control = self.call('DeleteControl', 'EqualEqual_IntInt', A=code, B=127)
        control = self.call('Control', 'BooleanOR', A=low_control, B=delete_control)
        forbidden = self.call('ControlOrLoneLow', 'BooleanOR', A=control, B=is_low)
        forbidden_exec, maybe_high = self.branch('ForbiddenBranch', forbidden, ordinary)
        is_high = self.range('IsHighSurrogate', code, 55296, 56319)
        high_exec, ordinary_end = self.branch('HighBranch', is_high, maybe_high)
        self.set('SetNeedLow', 'VNeedLow', True, high_exec)
        # Ordinary non-surrogate ends this iteration without another assignment.
        bad_done = self.set('SetInvalid', 'VInvalid', True, bad_pair)
        self.g.connect(*forbidden_exec, 'SetInvalid', 'execute')
        self.g.connect(*bad_done, 'ValidationLoop', 'Break')
        not_invalid = self.call('NotInvalid', 'Not_PreBool', A=invalid)
        no_pending = self.call('NoPendingLow', 'Not_PreBool', A=need_low)
        paired = self.call('PairedAndClean', 'BooleanAND', A=not_invalid, B=no_pending)
        final_valid = self.call('ValidationResult', 'BooleanAND', A=bounds, B=paired)
        done = self.set('StoreValidationResult', 'VValid', final_valid, completed)
        self.g.connect(*invalid_bounds, 'StoreValidationResult', 'execute')
        return done, valid, units


def validate_function(templates):
    b = Builder(templates, 'ValidateBoundedIdentity', [('Raw', 'string'), ('Limit', 'int')],
                [('Valid', 'bool'), ('Units', 'int')])
    done, valid, units = b.validation(('Entry', 'Raw'), ('Entry', 'Limit'), ('Entry', 'then'))
    b.g.connect(*done, 'Return', 'execute')
    b.g.connect(*valid, 'Return', 'Valid')
    b.g.connect(*units, 'Return', 'Units')
    return b.g


def segment_function(templates):
    b = Builder(templates, 'SegmentValidatedPath', [('Raw', 'string')],
                [('Valid', 'bool'), ('Segmented', 'string'), ('Lines', 'int')])
    raw = ('Entry', 'Raw')
    result = b.local('SResult', 'string')
    offset = b.local('SOffset', 'int')
    lines = b.local('SLines', 'int')
    chunk = b.local('SChunk', 'int')
    piece = b.local('SPiece', 'string')
    boundary_code = b.local('SBoundaryCode', 'int')
    before = b.set('InitResult', 'SResult', '', ('Entry', 'then'))
    before = b.set('InitOffset', 'SOffset', 0, before)
    before = b.set('InitLines', 'SLines', 0, before)
    done, valid, units = b.validation(raw, 256, before)
    start, rejected = b.branch('ValidatedBranch', valid, done)
    b.g.connect(*rejected, 'Return', 'execute')
    body, completed, unused_index = b.loop('SegmentLoop', 6, start)
    more = b.call('HasMoreUnits', 'Less_IntInt', A=offset, B=units)
    more_exec, finished = b.branch('MoreBranch', more, body)
    b.g.connect(*finished, 'SegmentLoop', 'Break')
    remaining = b.call('RemainingUnits', 'Subtract_IntInt', A=units, B=offset)
    small = b.call('SmallRemainder', 'Less_IntInt', A=remaining, B=40)
    small_exec, full_exec = b.branch('ChunkSizeBranch', small, more_exec)
    small_done = b.set('SmallChunk', 'SChunk', remaining, small_exec)
    full_done = b.set('FullChunk', 'SChunk', 40, full_exec)
    endpoint = b.call('ChunkEndpoint', 'Add_IntInt', A=offset, B=chunk)
    nonfinal = b.call('NonfinalChunk', 'Less_IntInt', A=endpoint, B=units)
    boundary, last_chunk = b.branch('BoundaryBranch', nonfinal, small_done)
    b.g.connect(*full_done, 'BoundaryBranch', 'execute')
    last_index = b.call('LastChunkIndex', 'Add_IntInt', A=endpoint, B=-1)
    last_code = b.call('BoundaryCodeUnit', 'GetCharacterAsNumber', SourceString=raw, Index=last_index)
    boundary_done = b.set('StoreBoundaryCode', 'SBoundaryCode', last_code, boundary)
    high = b.range('BoundaryHighSurrogate', boundary_code, 55296, 56319)
    shorten, keep = b.branch('SplitPairBranch', high, boundary_done)
    shorter = b.call('ShorterChunk', 'Add_IntInt', A=chunk, B=-1)
    shorter_done = b.set('StoreShorterChunk', 'SChunk', shorter, shorten)
    substring = b.call('ReadChunk', 'GetSubstring', SourceString=raw, StartIndex=offset, Length=chunk)
    piece_done = b.set('StorePiece', 'SPiece', substring, last_chunk)
    b.g.connect(*keep, 'StorePiece', 'execute')
    b.g.connect(*shorter_done, 'StorePiece', 'execute')
    first = b.call('FirstLine', 'EqualEqual_IntInt', A=lines, B=0)
    first_exec, later_exec = b.branch('FirstLineBranch', first, piece_done)
    first_done = b.set('FirstResult', 'SResult', piece, first_exec)
    with_newline = b.call('AppendNewline', 'Concat_StrStr', A=result, B='\n')
    with_piece = b.call('AppendPiece', 'Concat_StrStr', A=with_newline, B=piece)
    later_done = b.set('LaterResult', 'SResult', with_piece, later_exec)
    next_offset = b.call('NextOffset', 'Add_IntInt', A=offset, B=chunk)
    offset_done = b.set('StoreNextOffset', 'SOffset', next_offset, first_done)
    b.g.connect(*later_done, 'StoreNextOffset', 'execute')
    next_lines = b.call('NextLines', 'Add_IntInt', A=lines, B=1)
    b.set('StoreNextLines', 'SLines', next_lines, offset_done)
    complete = b.call('AllUnitsSegmented', 'EqualEqual_IntInt', A=offset, B=units)
    output_valid = b.call('SegmentationValid', 'BooleanAND', A=valid, B=complete)
    b.g.connect(*completed, 'Return', 'execute')
    b.g.connect(*output_valid, 'Return', 'Valid')
    b.g.connect(*result, 'Return', 'Segmented')
    b.g.connect(*lines, 'Return', 'Lines')
    return b.g


def prepare(output):
    output = output.resolve()
    output.relative_to((ROOT / 'research/evidence').resolve())
    if output.exists():
        raise ValueError('FRESH_OUTPUT_DIRECTORY_REQUIRED')
    t = core.Templates()
    graphs = [validate_function(t), segment_function(t)]
    artifacts = []
    rendered = []
    for graph in graphs:
        payload = graph.emit()
        audit = {'function': graph.function, 'bounds': graph.validate(), 'assembly': graph.audit,
                 'nodes': list(graph.nodes.values()), 'edges': graph.edges,
                 'locals': {name: {k: v for k, v in data.items() if k != 'template'} for name, data in graph.locals.items()}}
        rendered.append((graph.function + '.clipboard.txt', payload))
        rendered.append((graph.function + '.graph.json', (json.dumps(audit, ensure_ascii=True, indent=2) + '\n').encode()))
    for path in [CORE_PATH, Path(__file__).resolve()]:
        raw = path.read_bytes()
        artifacts.append({'path': str(path), 'bytes': len(raw), 'sha256': core.digest(raw)})
    output.mkdir()
    for name, payload in rendered:
        (output / name).write_bytes(payload)
        artifacts.append({'path': str(output / name), 'bytes': len(payload), 'sha256': core.digest(payload)})
    receipt = {'status': 'PREPARED_OFFLINE_REQUIRES_NATIVE_IMPORT_AND_EXECUTION',
               'created_utc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
               'native_import': 'NOT_PERFORMED', 'native_compile': 'NOT_PERFORMED',
               'native_execution': 'NOT_PERFORMED', 'clipboard_changed': False,
               'artifacts': artifacts,
               'limits': {'validation_loop_last_index': 255, 'segmentation_loop_last_index': 6,
                          'maximum_path_utf16_units': 256, 'segment_utf16_units': 40},
               'limitations': ['New scalar signatures/local bindings need native import/export review.',
                               'Python StringLibrary observation does not prove Blueprint internal surrogate or NUL behavior.',
                               'No source function GUID or direct generated function call is invented; validation is inlined.']}
    (output / 'preparation.json').write_text(json.dumps(receipt, indent=2) + '\n', encoding='utf-8')
    return receipt


if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('--output-dir', required=True)
    args = p.parse_args()
    print(json.dumps(prepare(Path(args.output_dir)), indent=2))
