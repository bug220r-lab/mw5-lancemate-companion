"""Source-bound Capture orchestration with explicit, non-emittable gaps.

Known nodes are real exported Blueprint templates, with fresh scalar locals
and links. Required native bindings/helpers are *not* represented as invented
Blueprint nodes. Their named ports below are a proposed assembly interface.
No clipboard payload can be emitted while any such gap exists.
"""
import argparse
import datetime
import hashlib
import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SHARED = ROOT / 'scripts/Prepare-PhaseBTextFunctions.py'
if hashlib.sha256(SHARED.read_bytes()).hexdigest() != '155dd012f6a90afb4cf08aee141ee34ddf68408c0741bb970ff702ffd8c5b977':
    raise ValueError('SHARED_BUILDER_PIN_CHANGED')
if hashlib.sha256((ROOT / 'scripts/PhaseBBlueprintAssembly.py').read_bytes()).hexdigest() != '385db1e4aec7276a5a8a3ad8262ac5b8e641f2082ff207d13332b4cb552176f0':
    raise ValueError('ASSEMBLY_CORE_PIN_CHANGED')
spec = importlib.util.spec_from_file_location('capture_shared', SHARED)
shared = importlib.util.module_from_spec(spec)
spec.loader.exec_module(shared)
BASE_CLASS = '/Game/Objects/_common/Components/PlayerControllerComponents/PlayerControllerComponent.PlayerControllerComponent_C'
PROBE_CLASS = '/LanceObserverProbe/BP_LanceObserverProbeComponent.BP_LanceObserverProbeComponent_C'


class CaptureDraft(shared.core.FunctionGraph):
    def __init__(self, templates):
        super().__init__(templates, 'CaptureExistingComponentSnapshot')
        self.pending = {}
        self.pending_edges = []
        self.compatibility_evidence_required = []

    def slot(self, name, purpose, inputs, outputs, category='NATIVE_TEMPLATE_OR_BINDING_REQUIRED'):
        if name in self.pending or name in self.nodes:
            raise ValueError('DUPLICATE_ASSEMBLY_NAME')
        self.pending[name] = {'name': name, 'status': category, 'purpose': purpose,
                              'inputs': inputs, 'outputs': outputs,
                              'native_node_fields': None, 'native_function_guid': None}
        return name

    def port(self, name, pin, direction):
        if name in self.pending:
            if pin not in self.pending[name][direction]:
                raise ValueError('UNKNOWN_PENDING_PORT: ' + name + '.' + pin)
            return self.pending[name][direction][pin]
        p = self.nodes[name]['pins'][pin]
        actual = 'outputs' if p.get('Direction') == '"EGPD_Output"' else 'inputs'
        if actual != direction:
            raise ValueError('DRAFT_LINK_DIRECTION')
        return json.loads(p['PinType.PinCategory'])

    def connect(self, source, outpin, destination, inpin):
        a = self.port(source, outpin, 'outputs')
        b = self.port(destination, inpin, 'inputs')
        if source not in self.pending and destination not in self.pending:
            return super().connect(source, outpin, destination, inpin)
        if a != b:
            raise ValueError('PENDING_PORT_CATEGORY_MISMATCH')
        edge = (source, outpin, destination, inpin)
        all_edges = self.edges + self.pending_edges
        if edge in all_edges:
            raise ValueError('DUPLICATE_PENDING_EDGE')
        if a == 'exec' and any(e[:2] == edge[:2] for e in all_edges):
            raise ValueError('PENDING_EXEC_OUTPUT_FANOUT')
        if a != 'exec' and any(e[2:] == edge[2:] for e in all_edges):
            raise ValueError('PENDING_DATA_MULTIPLE_PRODUCERS')
        self.pending_edges.append(edge)

    def unproven_compatible_link(self, source, outpin, destination, inpin, why):
        # This is not an accepted type coercion and never enters emitted links.
        self.compatibility_evidence_required.append({'edge': [source, outpin, destination, inpin], 'reason': why})

    def emit(self):
        # This revision intentionally has no binding finalizer. Removing a gap
        # from an in-memory list cannot turn a partial graph into an import.
        raise ValueError('CAPTURE_NATIVE_BINDINGS_AND_HELPERS_REQUIRED_NO_PAYLOAD')

    def assembly_record(self):
        edges = self.edges + self.pending_edges
        queries = [name for name, n in self.nodes.items() if any('MemberName="K2_GetComponentsByClass"' in f for f in n['fields'])]
        if queries != ['SoleComponentQuery']:
            raise ValueError('EXACTLY_ONE_QUERY_NODE_REQUIRED')
        query_pins = self.nodes['SoleComponentQuery']['pins']
        selected_class = query_pins.get('ComponentClass', {})
        if (selected_class.get('DefaultObject') != json.dumps(BASE_CLASS)
                or selected_class.get('PinType.PinCategory') != '"class"'
                or selected_class.get('PinType.PinSubCategoryObject') != 'Class\'"/Script/Engine.ActorComponent"\''
                or selected_class.get('PinType.ContainerType') != 'None'
                or selected_class.get('Direction', '"EGPD_Input"') != '"EGPD_Input"'
                or any(e[2:] == ('SoleComponentQuery', 'ComponentClass') for e in edges)):
            raise ValueError('QUERY_EXACT_STOCK_COMPONENT_CLASS_REQUIRED')
        expected_return = {
            'Direction': '"EGPD_Output"', 'PinType.PinCategory': '"object"',
            'PinType.PinSubCategory': '""',
            'PinType.PinSubCategoryObject': 'BlueprintGeneratedClass\'"' + BASE_CLASS + '"\'',
            'PinType.PinSubCategoryMemberReference': '()', 'PinType.PinValueType': '()',
            'PinType.ContainerType': 'Array', 'PinType.bIsReference': 'False',
            'PinType.bIsConst': 'False', 'PinType.bIsWeakPointer': 'False',
            'PinType.bIsUObjectWrapper': 'False', 'bOrphanedPin': 'False'}
        actual_return = query_pins.get('ReturnValue', {})
        if any(actual_return.get(key) != value for key, value in expected_return.items()):
            raise ValueError('QUERY_EXACT_STOCK_COMPONENT_ARRAY_RETURN_REQUIRED')
        consumers = [e for e in edges if e[:2] == ('SoleComponentQuery', 'ReturnValue')]
        if consumers != [('SoleComponentQuery', 'ReturnValue', 'StoreSnapshotComponents', 'Value')]:
            raise ValueError('QUERY_RESULT_MUST_HAVE_SINGLE_STORED_CONSUMER')
        loop = self.nodes['ComponentLoop']['pins']
        if json.loads(loop['FirstIndex']['DefaultValue']) != '0' or json.loads(loop['LastIndex']['DefaultValue']) != '31':
            raise ValueError('COMPONENT_LOOP_MUST_BE_ZERO_THROUGH_31')
        # Closed storage must skip the object-path helper and all row formatting.
        for branch in ('DetailClosedBranch', 'InvalidDetailClosed', 'ClassInvalidDetailClosed'):
            if any(e[:2] == (branch, 'then') for e in edges):
                raise ValueError('CLOSED_DETAILS_MUST_NOT_READ_OBJECT_PATH_OR_FORMAT')
        for source, pin, target, destination_pin in [('ReadCurrentClass', 'ReturnValue', 'StoreCurrentClass', 'Value'),
                                                    ('ReadClassPath', 'ReturnValue', 'StoreClassPath', 'ClassPath'),
                                                    ('ReadObjectPath', 'ReturnValue', 'StoreObjectPath', 'ObjectPath')]:
            if [e for e in edges if e[:2] == (source, pin)] != [(source, pin, target, destination_pin)]:
                raise ValueError('IDENTITY_GETTER_REQUIRES_SINGLE_STORED_CONSUMER')
        checks = super().validate()
        return {'status': 'BLOCKED_EMISSION_SOURCE_BOUND_PARTIAL_GRAPH',
                'native_import': 'NOT_PERFORMED', 'native_execution': 'NOT_PERFORMED',
                'function': self.function, 'known_node_counts': {k: v for k, v in checks.items() if k != 'ids'},
                'pending_slot_count': len(self.pending), 'pending_edge_count': len(self.pending_edges),
                'nodes': list(self.nodes.values()), 'known_edges': self.edges, 'pending_edges': self.pending_edges,
                'locals': {name: {k: v for k, v in data.items() if k != 'template'} for name, data in self.locals.items()},
                'pending_native_bindings_and_helpers': list(self.pending.values()),
                'pending_ports_are_categories_only_not_accepted_native_pin_types': True,
                'unresolved_array_container_ports': ['StoreSnapshotComponents.Value', 'StoredRowBodies.Value', 'FinalizeSnapshot.RowBodies'],
                'unaccepted_type_compatibility_edges': self.compatibility_evidence_required,
                'source_assembly_operations': self.audit_log,
                'invariants': {'query_nodes': 1, 'query_result_consumers': 1, 'maximum_visited_slots': 32,
                               'query_fixed_component_class': BASE_CLASS, 'query_exact_pcc_array_return': True,
                               'detail_closure_does_not_stop_class_scan': True,
                               'class_path_literal_is_not_class_resolution': True},
                'required_native_declarations': ['Destination SnapshotComponents member with exact query output type and exported MemberGuid.',
                    'CurrentComponent local with PlayerControllerComponent object type and CurrentClass local with CoreUObject.Object class-reference type.',
                    'String-array RowBodies local plus observed Get/Set/Add/Get(copy)/Length/Clear specializations.',
                    'Same-Blueprint helper call templates whose MemberGuid equals actual imported function GraphGuid.'],
                'remaining_algorithm_bodies': ['PrepareSnapshotContext: guarded pause/locality/validity/exact base literal; bounded owner/class/level; three segmented context bodies; 1536 reservation before query.',
                    'BuildDetailBodies: only called when detail storage open after Capture stores the once-read object path; validate<=256, segment40, form both complete bodies<=600/13 lines atomically.',
                    'RetainRowBodies: admit all1or2 proposed bodies together including96 decoration reserve each,1536 context reserve,4096 aggregate and70pages; never retain half a row.',
                    'FinalizeSnapshot: bounded complete/partial summary preserving counts; freezeTotal/Status; DecorateBoundedPage every body; check actual aggregate4096/page768/lines16; publish only if not ending and widgetvalid.',
                    'PrequeryRefusal: NOT_COLLECTED; finalization failure after query: INCOMPLETE with preserved counts and explicit unknowns; clear all captured references.']}


def capture_graph(templates=None):
    t = templates or shared.core.Templates()
    b = shared.Builder(t, 'CaptureExistingComponentSnapshot', [], [])
    draft = CaptureDraft(t)
    # Transfer the native Entry/Return without re-authoring their serialization.
    draft.nodes, draft.audit_log = b.g.nodes, b.g.audit
    draft.audit = draft.audit_log  # Builder.add appends to FunctionGraph.audit.
    b.g = draft
    slot = draft.slot
    wire = draft.connect
    scalar = {}
    for name, kind in [('Returned', 'int'), ('Visited', 'int'), ('Checked', 'int'), ('Matches', 'int'),
                       ('Invalid', 'int'), ('Retained', 'int'), ('ReservedRows', 'int'),
                       ('DetailClosed', 'bool'), ('ClassComplete', 'bool'), ('DetailComplete', 'bool'),
                       ('CountLimited', 'bool'), ('InvalidObserved', 'bool'), ('ClassLimitObserved', 'bool'),
                       ('ClassPath', 'string'), ('ObjectPath', 'string'), ('Status', 'string'), ('DetailReason', 'string'),
                       ('ContextObject', 'string'), ('ContextClass', 'string'), ('ContextLevel', 'string')]:
        scalar[name] = b.local(name, kind)
    slot('EntryGuard', 'Require consumed second press, valid owned readout, no ending/busy conflict; clear old publication before capture.',
         {'execute': 'exec'}, {'then': 'exec', 'Allowed': 'bool'}, 'DESTINATION_ROUTING_BINDING_REQUIRED')
    wire('Entry', 'then', 'EntryGuard', 'execute')
    begin, refuse_entry = b.branch('EntryAllowed', ('EntryGuard', 'Allowed'), ('EntryGuard', 'then'))
    wire(*refuse_entry, 'Return', 'execute')
    for name in ['Returned', 'Visited', 'Checked', 'Matches', 'Invalid', 'Retained', 'ReservedRows']:
        begin = b.set('Init' + name, name, 0, begin)
    for name in ['DetailClosed', 'ClassComplete', 'DetailComplete', 'CountLimited', 'InvalidObserved', 'ClassLimitObserved']:
        begin = b.set('Init' + name, name, False, begin)
    begin = b.set('InitDetailReason', 'DetailReason', '', begin)
    slot('PrepareContext', 'Required full prequery context helper, including native pause/locality, exact valid selected base class and owner/class/level text limits. Produces three context bodies within1536 reservation.',
         {'execute': 'exec'}, {'then': 'exec', 'Ready': 'bool', 'ObjectBody': 'string', 'ClassBody': 'string', 'LevelBody': 'string'}, 'HELPER_BODY_AND_NATIVE_CALL_BINDING_REQUIRED')
    wire(*begin, 'PrepareContext', 'execute')
    query_start, prequery_refusal = b.branch('ContextReady', ('PrepareContext', 'Ready'), ('PrepareContext', 'then'))
    for local, port in [('ContextObject', 'ObjectBody'), ('ContextClass', 'ClassBody'), ('ContextLevel', 'LevelBody')]:
        query_start = b.set('Store' + local, local, ('PrepareContext', port), query_start)
    slot('PrequeryRefusal', 'Store bounded NOT_COLLECTED explanation with no query; preserve consumed attempt and cleanup.',
         {'execute': 'exec'}, {'then': 'exec'}, 'HELPER_BODY_AND_NATIVE_CALL_BINDING_REQUIRED')
    wire(*prequery_refusal, 'PrequeryRefusal', 'execute')
    wire('PrequeryRefusal', 'then', 'Return', 'execute')
    slot('OwnedController', 'Exact destination self/controller identity, reviewed native type links required.', {}, {'Value': 'object'}, 'DESTINATION_SELF_TEMPLATE_REQUIRED')
    b.g.add('SoleComponentQuery', t.catalog('function:K2_GetComponentsByClass'))
    wire('OwnedController', 'Value', 'SoleComponentQuery', 'self')
    slot('StoreSnapshotComponents', 'Exact destination member Set; only consumer of the pure component query.',
         {'execute': 'exec', 'Value': 'object'}, {'then': 'exec'}, 'DESTINATION_MEMBER_BINDING_REQUIRED')
    wire(*query_start, 'StoreSnapshotComponents', 'execute')
    wire('SoleComponentQuery', 'ReturnValue', 'StoreSnapshotComponents', 'Value')
    slot('StoredComponentsLength', 'Exact typed PCC-array Length over stored SnapshotComponents; no query resampling.', {}, {'Count': 'int'}, 'PCC_ARRAY_LENGTH_TEMPLATE_REQUIRED')
    count_done = b.set('StoreReturned', 'Returned', ('StoredComponentsLength', 'Count'), ('StoreSnapshotComponents', 'then'))
    over32 = b.call('BeyondScanLimit', 'Less_IntInt', A=32, B=scalar['Returned'])
    count_done = b.set('StoreCountLimited', 'CountLimited', over32, count_done)
    body, complete_loop, index = b.loop('ComponentLoop', 31, count_done)
    within_array = b.call('WithinCapturedArray', 'Less_IntInt', A=index, B=scalar['Returned'])
    inspect_slot, finished = b.branch('ArrayBounds', within_array, body)
    wire(*finished, 'ComponentLoop', 'Break')
    slot('StoreCurrentComponent', 'Read one stored PCC-array item atIndex and store the exact typed current-component local.',
         {'execute': 'exec', 'Index': 'int'}, {'then': 'exec'}, 'PCC_ARRAY_GET_AND_LOCAL_TEMPLATE_REQUIRED')
    wire(*index, 'StoreCurrentComponent', 'Index')
    wire(*inspect_slot, 'StoreCurrentComponent', 'execute')
    slot('CurrentComponent', 'Getter for exact CurrentComponent local; no array reread.', {}, {'Value': 'object'}, 'PCC_OBJECT_LOCAL_TEMPLATE_REQUIRED')
    next_visited = b.call('NextVisited', 'Add_IntInt', A=scalar['Visited'], B=1)
    visited_done = b.set('StoreVisited', 'Visited', next_visited, ('StoreCurrentComponent', 'then'))
    b.g.add('ComponentValid', t.catalog('macro:IsValid'))
    wire(*visited_done, 'ComponentValid', 'exec')
    wire('CurrentComponent', 'Value', 'ComponentValid', 'InputObject')
    native_class = t.node(shared.NATIVE, shared.NATIVE_SHA, 'BP_CodexAuthoringProbe', 'EventGraph.K2Node_CallFunction_900')
    b.g.add('ReadCurrentClass', native_class)
    wire('CurrentComponent', 'Value', 'ReadCurrentClass', 'Object')
    slot('StoreCurrentClass', 'Store the once-read class reference before IsValidClass and path access.',
         {'execute': 'exec', 'Value': 'class'}, {'then': 'exec'}, 'CLASS_REFERENCE_LOCAL_TEMPLATE_REQUIRED')
    wire('ReadCurrentClass', 'ReturnValue', 'StoreCurrentClass', 'Value')
    wire('ComponentValid', 'Is Valid', 'StoreCurrentClass', 'execute')
    slot('CurrentClass', 'Getter for exact CurrentClass local; no additional GetObjectClass call.', {}, {'Value': 'class'}, 'CLASS_REFERENCE_LOCAL_TEMPLATE_REQUIRED')
    class_valid = b.call('CurrentClassValid', 'IsValidClass', Class=('CurrentClass', 'Value'))
    class_read, class_invalid = b.branch('ClassValidBranch', class_valid, ('StoreCurrentClass', 'then'))
    b.g.add('ReadClassPath', t.catalog('function:GetPathName'))
    draft.unproven_compatible_link('CurrentClass', 'Value', 'ReadClassPath', 'Object',
                                  'Class-reference to UObject GetPathName input requires actual observed native connected-pin evidence.')
    stored_path = b.set('StoreClassPath', 'ClassPath', ('ReadClassPath', 'ReturnValue'), class_read)
    slot('ValidateClassPath', 'Actual imported ValidateBoundedIdentity caller using exported GraphGuid; Raw=stored class path, Limit=256.',
         {'execute': 'exec', 'Raw': 'string'}, {'then': 'exec', 'Valid': 'bool'}, 'IMPORTED_TEXT_HELPER_CALL_BINDING_REQUIRED')
    wire(*stored_path, 'ValidateClassPath', 'execute')
    wire(*scalar['ClassPath'], 'ValidateClassPath', 'Raw')
    valid_class_path, invalid_class_path = b.branch('ClassPathValidBranch', ('ValidateClassPath', 'Valid'), ('ValidateClassPath', 'then'))
    checked = b.call('NextChecked', 'Add_IntInt', A=scalar['Checked'], B=1)
    checked_done = b.set('StoreChecked', 'Checked', checked, valid_class_path)
    exact = b.call('ExactProbeLiteral', 'EqualEqual_StrStr', A=scalar['ClassPath'], B=PROBE_CLASS)
    match, nonmatch = b.branch('ExactMatchBranch', exact, checked_done)
    matches = b.call('NextMatches', 'Add_IntInt', A=scalar['Matches'], B=1)
    matched = b.set('StoreMatches', 'Matches', matches, match)
    closed, detail = b.branch('DetailClosedBranch', scalar['DetailClosed'], matched)
    wire(*nonmatch, 'DetailClosedBranch', 'execute')
    # The closed execution output is deliberately terminal for this iteration.
    b.g.add('ReadObjectPath', t.catalog('function:GetPathName'))
    wire('CurrentComponent', 'Value', 'ReadObjectPath', 'Object')
    detail = b.set('StoreObjectPath', 'ObjectPath', ('ReadObjectPath', 'ReturnValue'), detail)
    slot('BuildDetailBodies', 'Validate/segment the stored raw object path and validated class path; form complete object/class pair or explicit failure, no object calls.',
         {'execute': 'exec', 'ObjectPath': 'string', 'ClassPath': 'string', 'Index': 'int', 'ExactMatch': 'bool'},
         {'then': 'exec', 'Valid': 'bool', 'Reason': 'string', 'ObjectBody': 'string', 'ClassBody': 'string'}, 'ROW_BODY_HELPER_AND_NATIVE_CALL_REQUIRED')
    wire(*detail, 'BuildDetailBodies', 'execute')
    wire(*scalar['ObjectPath'], 'BuildDetailBodies', 'ObjectPath')
    wire(*scalar['ClassPath'], 'BuildDetailBodies', 'ClassPath')
    wire(*index, 'BuildDetailBodies', 'Index')
    wire(*exact, 'BuildDetailBodies', 'ExactMatch')
    retain_pair, bad_detail = b.branch('DetailBodiesValid', ('BuildDetailBodies', 'Valid'), ('BuildDetailBodies', 'then'))
    bad_detail = b.set('StoreDetailReason', 'DetailReason', ('BuildDetailBodies', 'Reason'), bad_detail)
    b.set('CloseOnDetailFailure', 'DetailClosed', True, bad_detail)
    slot('RetainPair', 'Atomically admit both prepared row bodies or neither;1536+reserved+pairCost<=4096 andpagecount<=70; string-array local mutation only after checks.',
         {'execute': 'exec', 'Reserved': 'int', 'ObjectBody': 'string', 'ClassBody': 'string'}, {'then': 'exec', 'Accepted': 'bool', 'NewReserved': 'int'},
         'STRING_ARRAY_ATOMIC_ADMISSION_HELPER_REQUIRED')
    wire(*retain_pair, 'RetainPair', 'execute')
    wire(*scalar['ReservedRows'], 'RetainPair', 'Reserved')
    wire('BuildDetailBodies', 'ObjectBody', 'RetainPair', 'ObjectBody')
    wire('BuildDetailBodies', 'ClassBody', 'RetainPair', 'ClassBody')

    def admission(label):
        accepted, full = b.branch(label + 'Accepted', (label, 'Accepted'), (label, 'then'))
        reason = b.set(label + 'TextLimit', 'DetailReason', 'TEXT_LIMIT', full)
        b.set(label + 'CloseDetails', 'DetailClosed', True, reason)
        stored = b.set(label + 'StoreReserve', 'ReservedRows', (label, 'NewReserved'), accepted)
        value = b.call(label + 'NextRetained', 'Add_IntInt', A=scalar['Retained'], B=1)
        b.set(label + 'StoreRetained', 'Retained', value, stored)

    admission('RetainPair')
    next_invalid = b.call('NextInvalid', 'Add_IntInt', A=scalar['Invalid'], B=1)
    invalid_component = b.set('StoreInvalidComponent', 'Invalid', next_invalid, ('ComponentValid', 'Is Not Valid'))
    invalid_component = b.set('MarkInvalidObserved', 'InvalidObserved', True, invalid_component)
    closed_invalid, open_invalid = b.branch('InvalidDetailClosed', scalar['DetailClosed'], invalid_component)
    invalid_class = b.set('StoreInvalidClass', 'Invalid', next_invalid, class_invalid)
    wire(*invalid_class_path, 'StoreInvalidClass', 'execute')
    invalid_class = b.set('MarkClassLimit', 'ClassLimitObserved', True, invalid_class)
    closed_class, open_class = b.branch('ClassInvalidDetailClosed', scalar['DetailClosed'], invalid_class)
    for name, reason, before in [('RetainInvalidEntry', 'INVALID ENTRY', open_invalid),
                                  ('RetainInvalidClass', 'CLASS CHECK INCOMPLETE', open_class)]:
        slot(name, 'Build and atomically admit one index-tagged ' + reason + ' body if budget permits; no object/class path reads.',
             {'execute': 'exec', 'Index': 'int', 'Reserved': 'int'},
             {'then': 'exec', 'Accepted': 'bool', 'NewReserved': 'int'}, 'STRING_ARRAY_SINGLETON_ADMISSION_HELPER_REQUIRED')
        wire(*before, name, 'execute')
        wire(*index, name, 'Index')
        wire(*scalar['ReservedRows'], name, 'Reserved')
        admission(name)
    # Class completeness is independent of retained text. Each comparison is
    # over the captured array prefix; >32 never claims a global zero/absence.
    scope_complete = b.call('WithinCompleteScope', 'LessEqual_IntInt', A=scalar['Returned'], B=32)
    all_visited = b.call('AllVisited', 'EqualEqual_IntInt', A=scalar['Visited'], B=scalar['Returned'])
    all_checked = b.call('AllChecked', 'EqualEqual_IntInt', A=scalar['Checked'], B=scalar['Returned'])
    checked_visited = b.call('CheckedAndVisited', 'BooleanAND', A=all_visited, B=all_checked)
    class_complete = b.call('ClassCompleteResult', 'BooleanAND', A=scope_complete, B=checked_visited)
    class_done = b.set('StoreClassComplete', 'ClassComplete', class_complete, complete_loop)
    all_retained = b.call('AllRetained', 'EqualEqual_IntInt', A=scalar['Retained'], B=scalar['Returned'])
    details_open = b.call('NoDetailClosure', 'Not_PreBool', A=scalar['DetailClosed'])
    detail_rows = b.call('AllDetailedRows', 'BooleanAND', A=all_retained, B=details_open)
    detail_complete = b.call('DetailCompleteResult', 'BooleanAND', A=scalar['ClassComplete'], B=detail_rows)
    detail_done = b.set('StoreDetailComplete', 'DetailComplete', detail_complete, class_done)
    full, partial = b.branch('CompletionBranch', scalar['DetailComplete'], detail_done)
    full_done = b.set('StatusComplete', 'Status', 'COMPLETE', full)
    partial_done = b.set('StatusIncomplete', 'Status', 'INCOMPLETE', partial)
    final_inputs = {'execute': 'exec'}
    for name in ['Returned', 'Visited', 'Checked', 'Matches', 'Invalid', 'Retained', 'Status', 'DetailReason', 'ContextObject', 'ContextClass', 'ContextLevel',
                 'ClassComplete', 'DetailComplete', 'CountLimited', 'InvalidObserved', 'ClassLimitObserved', 'DetailClosed']:
        final_inputs[name] = 'string' if name in ('Status', 'DetailReason', 'ContextObject', 'ContextClass', 'ContextLevel') else ('bool' if name in ['ClassComplete', 'DetailComplete', 'CountLimited', 'InvalidObserved', 'ClassLimitObserved', 'DetailClosed'] else 'int')
    final_inputs['RowBodies'] = 'string'
    slot('StoredRowBodies', 'Getter for temporary String-array RowBodies; exact Array container metadata is unresolved, never treated as a scalar native pin.', {}, {'Value': 'string'}, 'STRING_ARRAY_LOCAL_TEMPLATE_REQUIRED')
    slot('FinalizeSnapshot', 'Construct bounded summary/context/rows using final counts; freeze total/status; decorate every body and verifyactual4096/page768/16lines; publish with lifecycle/widgetguard; failuresINCOMPLETE preserve counts; alwaysclearcapturedrefs.',
         final_inputs, {'then': 'exec'}, 'FINALIZATION_HELPER_BODY_AND_NATIVE_CALL_REQUIRED')
    wire(*full_done, 'FinalizeSnapshot', 'execute')
    wire(*partial_done, 'FinalizeSnapshot', 'execute')
    for name in final_inputs:
        if name not in ('execute', 'RowBodies'):
            wire(*scalar[name], 'FinalizeSnapshot', name)
    wire('StoredRowBodies', 'Value', 'FinalizeSnapshot', 'RowBodies')
    wire('FinalizeSnapshot', 'then', 'Return', 'execute')
    return draft


def prepare(output):
    output = output.resolve()
    output.relative_to((ROOT / 'research/evidence').resolve())
    if output.exists():
        raise ValueError('FRESH_DIRECTORY_REQUIRED')
    graph = capture_graph()
    data = graph.assembly_record()
    data['created_utc'] = datetime.datetime.now(datetime.timezone.utc).isoformat()
    data['generator_sha256'] = hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
    output.mkdir()
    path = output / 'CaptureExistingComponentSnapshot.assembly.json'
    path.write_text(json.dumps(data, indent=2) + '\n', encoding='utf-8')
    return {'status': data['status'], 'path': str(path), 'bytes': path.stat().st_size,
            'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
            'known_node_counts': data['known_node_counts'], 'pending_slots': len(graph.pending),
            'clipboard_payload_created': False}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--output-dir', required=True)
    args = parser.parse_args()
    print(json.dumps(prepare(Path(args.output_dir)), indent=2))
