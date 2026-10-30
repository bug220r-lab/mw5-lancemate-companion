"""Prepare a bounded page-decorator Blueprint candidate, entirely offline.

The caller freezes Index/Total/Status before decoration. This function permits
empty bodies and LF, checks paired UTF-16 units in a fixed 0..639 scan, and
publishes Valid/Page/Units atomically. Aggregate snapshot limits belong to the
caller. Import, compile, execution, and widget fit are NOT_PERFORMED here.
"""
import argparse
import datetime
import hashlib
import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEPENDENCIES = {
    'scripts/PhaseBBlueprintAssembly.py': '385db1e4aec7276a5a8a3ad8262ac5b8e641f2082ff207d13332b4cb552176f0',
    'scripts/Prepare-PhaseBTextFunctions.py': '155dd012f6a90afb4cf08aee141ee34ddf68408c0741bb970ff702ffd8c5b977',
}


def pinned_builder():
    # Check both buffers before importing the shared builder (which imports core).
    for name, expected in DEPENDENCIES.items():
        if hashlib.sha256((ROOT / name).read_bytes()).hexdigest() != expected:
            raise ValueError('DEPENDENCY_PIN_CHANGED: ' + name)
    spec = importlib.util.spec_from_file_location('phase_b_decorator_shared', ROOT / 'scripts/Prepare-PhaseBTextFunctions.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


shared = pinned_builder()


def decorate_function(templates):
    b = shared.Builder(templates, 'DecorateBoundedPage',
                       [('Body', 'string'), ('Index', 'int'), ('Total', 'int'), ('Status', 'string')],
                       [('Valid', 'bool'), ('Page', 'string'), ('Units', 'int')])
    raw, index, total, status = [('Entry', name) for name in ('Body', 'Index', 'Total', 'Status')]
    out_valid = b.local('DValid', 'bool')
    out_page = b.local('DPage', 'string')
    out_units = b.local('DUnits', 'int')
    body_units = b.local('DBodyUnits', 'int')
    body_limit = b.local('DBodyLimit', 'int')
    lines = b.local('DBodyLines', 'int')
    code = b.local('DCode', 'int')
    need_low = b.local('DNeedLow', 'bool')
    invalid = b.local('DInvalid', 'bool')
    first = b.local('DFirst', 'string')
    second = b.local('DSecond', 'string')
    overhead = b.local('DOverhead', 'int')
    required = b.local('DRequired', 'int')
    candidate = b.local('DCandidate', 'string')
    actual = b.local('DActual', 'int')
    before = ('Entry', 'then')
    for label, name, value in [('InitValid', 'DValid', False), ('InitPage', 'DPage', ''),
                               ('InitUnits', 'DUnits', 0), ('InitLines', 'DBodyLines', 1),
                               ('InitNeedLow', 'DNeedLow', False), ('InitInvalid', 'DInvalid', False)]:
        before = b.set(label, name, value, before)

    def reject(output):
        b.g.connect(*output, 'Return', 'execute')

    total_ok = b.range('TotalBounds', total, 1, 70)
    index_nonnegative = b.call('IndexNonnegative', 'LessEqual_IntInt', A=0, B=index)
    index_below_total = b.call('IndexBelowTotal', 'Less_IntInt', A=index, B=total)
    index_ok = b.call('IndexBounds', 'BooleanAND', A=index_nonnegative, B=index_below_total)
    counts_ok = b.call('CountBounds', 'BooleanAND', A=total_ok, B=index_ok)
    start, rejected = b.branch('CountBranch', counts_ok, before)
    reject(rejected)
    status_length = b.call('StatusLength', 'Len', S=status)
    status_length_ok = b.range('StatusLengthBounds', status_length, 1, 13)
    status_check, rejected = b.branch('StatusLengthBranch', status_length_ok, start)
    reject(rejected)
    complete = b.call('StatusComplete', 'EqualEqual_StrStr', A=status, B='COMPLETE')
    incomplete = b.call('StatusIncomplete', 'EqualEqual_StrStr', A=status, B='INCOMPLETE')
    not_collected = b.call('StatusNotCollected', 'EqualEqual_StrStr', A=status, B='NOT_COLLECTED')
    collected_status = b.call('CollectedStatus', 'BooleanOR', A=complete, B=incomplete)
    status_ok = b.call('StatusVocabulary', 'BooleanOR', A=collected_status, B=not_collected)
    bounded_status, rejected = b.branch('StatusBranch', status_ok, status_check)
    reject(rejected)
    raw_length = b.call('BodyLength', 'Len', S=raw)
    measured = b.set('StoreBodyUnits', 'DBodyUnits', raw_length, bounded_status)
    is_summary = b.call('IsSummary', 'EqualEqual_IntInt', A=index, B=0)
    summary, other = b.branch('SummaryBranch', is_summary, measured)
    summary_done = b.set('SummaryLimit', 'DBodyLimit', 640, summary)
    other_done = b.set('OtherLimit', 'DBodyLimit', 600, other)
    within_limit = b.call('BodyWithinLimit', 'LessEqual_IntInt', A=body_units, B=body_limit)
    nonnegative_len = b.call('BodyNonnegative', 'LessEqual_IntInt', A=0, B=body_units)
    body_ok = b.call('BodyBounds', 'BooleanAND', A=within_limit, B=nonnegative_len)
    scan, rejected = b.branch('BodyBoundsBranch', body_ok, summary_done)
    b.g.connect(*other_done, 'BodyBoundsBranch', 'execute')
    reject(rejected)

    body, scanned, offset = b.loop('BodyScan', 639, scan)
    readable = b.call('OffsetReadable', 'Less_IntInt', A=offset, B=body_units)
    read, finished = b.branch('OffsetBranch', readable, body)
    b.g.connect(*finished, 'BodyScan', 'Break')
    read_code = b.call('ReadBodyUnit', 'GetCharacterAsNumber', SourceString=raw, Index=offset)
    stored_code = b.set('StoreBodyUnit', 'DCode', read_code, read)
    expecting_low, ordinary = b.branch('NeedLowBranch', need_low, stored_code)
    is_low = b.range('LowSurrogate', code, 56320, 57343)
    low_ok, bad_pair = b.branch('LowPairBranch', is_low, expecting_low)
    b.set('ClearNeedLow', 'DNeedLow', False, low_ok)
    lone_low, maybe_high = b.branch('LoneLowBranch', is_low, ordinary)
    is_high = b.range('HighSurrogate', code, 55296, 56319)
    high, maybe_lf = b.branch('HighBranch', is_high, maybe_high)
    b.set('SetNeedLow', 'DNeedLow', True, high)
    is_lf = b.call('IsLineFeed', 'EqualEqual_IntInt', A=code, B=10)
    lf, unused_ordinary_end = b.branch('LineFeedBranch', is_lf, maybe_lf)
    next_line = b.call('NextLineCount', 'Add_IntInt', A=lines, B=1)
    line_stored = b.set('StoreLineCount', 'DBodyLines', next_line, lf)
    lines_ok = b.call('BodyLinesBounded', 'LessEqual_IntInt', A=lines, B=13)
    unused_line_end, too_many_lines = b.branch('LineBoundBranch', lines_ok, line_stored)
    invalid_done = b.set('MarkInvalid', 'DInvalid', True, bad_pair)
    b.g.connect(*lone_low, 'MarkInvalid', 'execute')
    b.g.connect(*too_many_lines, 'MarkInvalid', 'execute')
    b.g.connect(*invalid_done, 'BodyScan', 'Break')
    not_invalid = b.call('NotInvalid', 'Not_PreBool', A=invalid)
    no_pending = b.call('NoPendingLow', 'Not_PreBool', A=need_low)
    scan_clean = b.call('ScanClean', 'BooleanAND', A=not_invalid, B=no_pending)
    formatted, rejected = b.branch('ScanResultBranch', scan_clean, scanned)
    reject(rejected)

    # All string allocations below are bounded. Index+1 is evaluated only after
    # index/total guards; body concatenation is evaluated only after admission.
    number = b.call('HumanPageNumber', 'Add_IntInt', A=index, B=1)
    number_text = b.call('PageNumberText', 'Conv_IntToString', InInt=number)
    total_text = b.call('PageTotalText', 'Conv_IntToString', InInt=total)
    title_number = b.call('TitleNumber', 'Concat_StrStr', A='SNAPSHOT 1 - NOT LIVE | PAGE ', B=number_text)
    title_slash = b.call('TitleSlash', 'Concat_StrStr', A=title_number, B='/')
    title = b.call('TitleTotal', 'Concat_StrStr', A=title_slash, B=total_text)
    first_done = b.set('StoreFirst', 'DFirst', title, formatted)
    status_line = b.call('StatusLine', 'Concat_StrStr', A='STATUS: ', B=status)
    second_done = b.set('StoreSecond', 'DSecond', status_line, first_done)
    footer = 'F8: next saved page; stops at end'
    len_first = b.call('FirstLength', 'Len', S=first)
    len_second = b.call('SecondLength', 'Len', S=second)
    len_footer = b.call('FooterLength', 'Len', S=footer)
    first_second = b.call('HeaderLengths', 'Add_IntInt', A=len_first, B=len_second)
    plus_footer = b.call('DecorationsLength', 'Add_IntInt', A=first_second, B=len_footer)
    plus_separators = b.call('OverheadLength', 'Add_IntInt', A=plus_footer, B=3)
    overhead_done = b.set('StoreOverhead', 'DOverhead', plus_separators, second_done)
    total_required = b.call('RequiredLength', 'Add_IntInt', A=body_units, B=overhead)
    required_done = b.set('StoreRequired', 'DRequired', total_required, overhead_done)
    header_ok = b.range('OverheadBound', overhead, 0, 96)
    page_ok = b.range('RequiredBound', required, 0, 768)
    formatting_ok = b.call('FormattingBounds', 'BooleanAND', A=header_ok, B=page_ok)
    allocation_ok, rejected = b.branch('FormattingBranch', formatting_ok, required_done)
    reject(rejected)
    header_newline = b.call('FirstNewline', 'Concat_StrStr', A=first, B='\n')
    headers = b.call('BothHeaders', 'Concat_StrStr', A=header_newline, B=second)
    body_newline = b.call('BeforeBody', 'Concat_StrStr', A=headers, B='\n')
    with_body = b.call('WithBody', 'Concat_StrStr', A=body_newline, B=raw)
    footer_newline = b.call('BeforeFooter', 'Concat_StrStr', A=with_body, B='\n')
    full_page = b.call('FullPage', 'Concat_StrStr', A=footer_newline, B=footer)
    allocated = b.set('StoreCandidate', 'DCandidate', full_page, allocation_ok)
    actual_len = b.call('ActualLength', 'Len', S=candidate)
    measured_page = b.set('StoreActual', 'DActual', actual_len, allocated)
    actual_ok = b.range('ActualBound', actual, 0, 768)
    exact_len = b.call('ExactPageLength', 'EqualEqual_IntInt', A=actual, B=required)
    final_ok = b.call('FinalPageBounds', 'BooleanAND', A=actual_ok, B=exact_len)
    publish, rejected = b.branch('FinalBranch', final_ok, measured_page)
    reject(rejected)
    published_page = b.set('PublishPage', 'DPage', candidate, publish)
    published_units = b.set('PublishUnits', 'DUnits', actual, published_page)
    published = b.set('PublishValid', 'DValid', True, published_units)
    b.g.connect(*published, 'Return', 'execute')
    for source, pin in [(out_valid, 'Valid'), (out_page, 'Page'), (out_units, 'Units')]:
        b.g.connect(*source, 'Return', pin)
    return b.g


def prepare(output):
    output = output.resolve()
    output.relative_to((ROOT / 'research/evidence').resolve())
    if output.exists():
        raise ValueError('FRESH_OUTPUT_DIRECTORY_REQUIRED')
    graph = decorate_function(shared.core.Templates())
    payload = graph.emit()
    audit = {'function': graph.function, 'bounds': graph.validate(), 'assembly': graph.audit,
             'nodes': list(graph.nodes.values()), 'edges': graph.edges,
             'locals': {name: {k: v for k, v in data.items() if k != 'template'} for name, data in graph.locals.items()}}
    rendered = [('DecorateBoundedPage.clipboard.txt', payload),
                ('DecorateBoundedPage.graph.json', (json.dumps(audit, ensure_ascii=True, indent=2) + '\n').encode())]
    artifacts = []
    for name in list(DEPENDENCIES) + ['scripts/ObserverPhaseBModel.py', 'scripts/Prepare-PhaseBDecoratePage.py']:
        raw = (ROOT / name).read_bytes()
        artifacts.append({'path': name, 'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()})
    output.mkdir()
    for name, raw in rendered:
        (output / name).write_bytes(raw)
        artifacts.append({'path': str(output / name), 'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()})
    receipt = {'status': 'PREPARED_OFFLINE_REQUIRES_NATIVE_IMPORT_AND_EXECUTION',
               'created_utc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
               'native_import': 'NOT_PERFORMED', 'native_compile': 'NOT_PERFORMED',
               'native_execution': 'NOT_PERFORMED', 'clipboard_changed': False,
               'artifacts': artifacts,
               'limits': {'body_scan_last_index': 639, 'summary_body_units': 640, 'other_body_units': 600,
                          'page_units': 768, 'body_lines': 13, 'page_lines': 16, 'decoration_reserve': 96,
                          'maximum_pages': 70},
               'rejection_outputs': {'Valid': False, 'Page': '', 'Units': 0},
               'caller_requirements': ['Freeze Total/Status before decorating the snapshot.',
                                       'Enforce the separate 4096-unit aggregate limit before retaining pages.'],
               'limitations': ['Candidate uses source-proven scalar templates; new graph import/compile remains unperformed.',
                               'Body controls other than LF are not rejected here; identity validation is upstream.',
                               'Native Python NUL/surrogate wrapper observations do not prove Blueprint internal behavior.',
                               'Logical lines and units do not prove glyph coverage or widget pixel fit.']}
    (output / 'preparation.json').write_text(json.dumps(receipt, indent=2) + '\n', encoding='utf-8')
    return receipt


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--output-dir', required=True)
    args = parser.parse_args()
    print(json.dumps(prepare(Path(args.output_dir)), indent=2))
