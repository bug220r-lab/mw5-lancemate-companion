"""Bounded read-only reflection addition; not an executable native entry point.

Caller must supply the exact already-loaded scratch Blueprint after its own
process/source/expiry/one-use guards. No asset lookup/load, property writes,
function invocation, struct construction, graph traversal or native retry.
Missing generated Python properties remain UNKNOWN until this probe runs.
"""
OBJECT = '/Game/CodexEditorControlScratch20260925/BP_CodexAuthoringProbe.BP_CodexAuthoringProbe'
MAX_PROPERTY_READS = 40
MAX_STRING = 256
TOP_LEVEL = (('NewVariables', 'new_variables', 2), ('FunctionGraphs', 'function_graphs', 1))
MEMBER_FIELDS = (('VarName', 'var_name'), ('VarGuid', 'var_guid'), ('VarType', 'var_type'))
TYPE_FIELDS = (('PinCategory', 'pin_category'), ('PinSubCategoryObject', 'pin_sub_category_object'),
               ('ContainerType', 'container_type'))


def type_name(value):
    kind = type(value)
    return (kind.__module__ + '.' + kind.__name__)[:MAX_STRING]


def bounded_string(value):
    if not isinstance(value, str):
        return {'status': 'UNEXPECTED_VALUE_TYPE', 'type': type_name(value)}
    return {'status': 'OBSERVED' if len(value) <= MAX_STRING else 'TRUNCATED',
            'value': value[:MAX_STRING], 'characters': len(value)}


def describe(value):
    """Never repr unknown native objects/structs or recursively enumerate them."""
    result = {'type': type_name(value)}
    if value is None or type(value) in (bool, int, float):
        result['value'] = value
    elif isinstance(value, str):
        result.update(bounded_string(value))
    elif type(value).__module__ == 'unreal' and type(value).__name__ == 'Name':
        result.update(bounded_string(str(value)))
    else:
        result['value_status'] = 'OPAQUE_TYPE_ONLY'
    return result


def read_loaded_blueprint(obj):
    if obj is None or obj.get_path_name() != OBJECT or obj.get_class().get_path_name() != '/Script/Engine.Blueprint':
        raise ValueError('EXACT_ALREADY_LOADED_SCRATCH_BLUEPRINT_REQUIRED')
    report = {'status': 'READ_ONLY_PROPERTY_PROBE', 'object': OBJECT,
              'property_reads': 0, 'properties': [], 'mutation': 'NOT_PERFORMED',
              'editable_struct_support': 'NOT_TESTED',
              'limitations': ['A readable array/struct does not prove an editable array, a writable member or safe graph construction.',
                  'Both known spellings are independently queried; nested fields are inspected once using the first successful spelling.',
                  'Only the two exported members and one exported FunctionGraphs entry are inspected; unexpected counts stop child inspection.',
                  'Read errors report UNKNOWN access, not lack of native property existence.']}

    def read(owner, name):
        if report['property_reads'] >= MAX_PROPERTY_READS:
            raise ValueError('PROPERTY_READ_BUDGET_EXHAUSTED')
        report['property_reads'] += 1
        try:
            value = owner.get_editor_property(name)
            return {'name': name, 'status': 'OBSERVED_READ', 'result': describe(value)}, value, True
        except Exception as error:
            return {'name': name, 'status': 'UNKNOWN_ACCESS', 'exception_type': type_name(error),
                    'error': str(error)[:MAX_STRING]}, None, False

    def read_pair(owner, names):
        results, chosen, selected_name, found = [], None, None, False
        for name in names:
            row, value, success = read(owner, name)
            results.append(row)
            if success and not found:
                chosen, selected_name, found = value, name, True
        return {'attempts': results, 'inspection_spelling': selected_name}, chosen, found

    def member(value):
        result = {'type': type_name(value), 'fields': []}
        for names in MEMBER_FIELDS:
            row, field, success = read_pair(value, names)
            if success and names[0] == 'VarGuid':
                # Guid.a/b/c/d are explicitly documented in installed generated API.
                row['guid_components'] = [read(field, component)[0] for component in ('a', 'b', 'c', 'd')]
            elif success and names[0] == 'VarType':
                row['pin_type_fields'] = [read_pair(field, field_names)[0] for field_names in TYPE_FIELDS]
            result['fields'].append(row)
        return result

    for exported, python_name, expected_count in TOP_LEVEL:
        row, value, success = read_pair(obj, (exported, python_name))
        row['exported_property'] = exported
        row['expected_exported_count'] = expected_count
        if success:
            try:
                count = len(value)
                row['observed_count'] = count
                if count != expected_count:
                    row['children_status'] = 'COUNT_DRIFT_NO_CHILD_INSPECTION'
                elif exported == 'NewVariables':
                    row['children'] = [member(value[i]) for i in range(expected_count)]
                else:
                    graph = value[0]
                    row['children'] = [{'type': type_name(graph),
                        'path': bounded_string(graph.get_path_name()),
                        'class': bounded_string(graph.get_class().get_path_name())}]
                    row['expected_graph_path'] = OBJECT + ':UserConstructionScript'
                    row['graph_identity_matches_export'] = graph.get_path_name() == row['expected_graph_path']
            except Exception as error:
                row['children_status'] = 'UNKNOWN_ACCESS'
                row['children_error'] = str(error)[:MAX_STRING]
                row['children_exception_type'] = type_name(error)
        report['properties'].append(row)
    return report
