// Read-only audit of the saved, uninstrumented 1.1.398.0e B0 baseline.
// This module imports no editor, UI, network or process-execution facility.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

export const EXPECTED = Object.freeze({
  source: { bytes: 2687917, sha256: '3bb337d0932decc23951acf4bdb31e07601906b1b3121224c2ade9de856616ab' },
  defaults: { bytes: 9173, sha256: '492410616fecec280a675aecaa365f0be3e848a8e880398687a694963eb97e5c' },
  preservationCount: 41,
  // Ordered path/bytes/hash inventory from MW5_NORMAL_EDITOR_VERIFICATION.json.
  preservationManifestSha256: 'a5ff46b8c7a5a2fd2bc1f7e171b06a4e4dbfe42d18090ee8bc8541c1223426b9',
});
export const sha256 = b => createHash('sha256').update(b).digest('hex');
const requireCheck = (errors, value, code) => { if (!value) errors.push(code); };
const validPin = p => p && typeof p.path === 'string' && Number.isSafeInteger(p.bytes) && p.bytes >= 0 && /^[a-f0-9]{64}$/.test(p.sha256);
export function pinManifestDigest(pins) {
  if (!Array.isArray(pins) || !pins.every(validPin)) throw new Error('INVALID_PRESERVATION_PIN');
  return sha256(JSON.stringify(pins.map(p => ({ path: p.path.replaceAll('\\','/').toLowerCase(), bytes: p.bytes, sha256: p.sha256.toLowerCase() }))));
}

export function parseEventGraph(text) {
  const lines = text.split(/\r?\n/);
  const starts = lines.flatMap((s, i) => s === '   Begin Object Name="EventGraph"' ? [i] : []);
  if (starts.length !== 1) throw new Error('EXACT_ONE_PRIMARY_EVENTGRAPH_REQUIRED');
  const start = starts[0], end = lines.findIndex((s, i) => i > start && s === '   End Object');
  if (end < 0) throw new Error('COMPLETE_PRIMARY_EVENTGRAPH_REQUIRED');
  const nodes = new Map(), registered = [];
  let node;
  for (let i = start + 1; i < end; i++) {
    const s = lines[i], begin = /^      Begin Object Name="([^"]+)"$/.exec(s);
    if (begin) {
      if (node || nodes.has(begin[1])) throw new Error('DUPLICATE_OR_NESTED_NODE_DEFINITION');
      node = { name: begin[1], line: i + 1, pins: new Map(), raw: [] };
      nodes.set(node.name, node);
    } else if (s === '      End Object') {
      if (!node) throw new Error('NODE_END_WITHOUT_BEGIN');
      node = undefined;
    } else if (node) {
      node.raw.push(s);
      if (/CustomProperties Pin /.test(s)) {
        const id = /PinId=([A-F0-9]{32}),/.exec(s)?.[1];
        const name = /,PinName="((?:\\.|[^"])*)"/.exec(s)?.[1];
        if (!id || !name || node.pins.has(id)) throw new Error('INVALID_OR_DUPLICATE_PIN');
        const linkText = /,LinkedTo=\(([^)]*)\)/.exec(s)?.[1];
        const links = linkText === undefined ? [] : [...linkText.matchAll(/([A-Za-z0-9_]+) ([A-F0-9]{32}),/g)].map(m => [m[1], m[2]]);
        if (linkText !== undefined && links.map(x => x.join(' ') + ',').join('') !== linkText) throw new Error('UNPARSED_LINK_TEXT');
        node.pins.set(id, { id, name, line: i + 1, raw: s, links,
          output: /,Direction="EGPD_Output",/.test(s),
          category: /,PinType.PinCategory="([^"]+)"/.exec(s)?.[1],
          defaultValue: /,DefaultValue="([^"]*)"/.exec(s)?.[1] });
      }
    } else {
      const reg = /^      Nodes\((\d+)\)=[^']+'"([^"]+)"'$/.exec(s);
      if (reg) registered.push({ index: Number(reg[1]), name: reg[2], line: i + 1 });
    }
  }
  if (node) throw new Error('UNTERMINATED_NODE');
  return { lines, start: start + 1, end: end + 1, nodes, registered };
}

export function inspectGraph(text) {
  const errors = [];
  let g;
  try { g = parseEventGraph(text); } catch (e) { return { passed: false, errors: [e.message] }; }
  const names = new Set(g.registered.map(n => n.name));
  requireCheck(errors, g.registered.length === 36 && names.size === 36 && g.registered.every((n, i) => n.index === i), 'EXACT_36_REGISTERED_NODES_REQUIRED');
  requireCheck(errors, g.nodes.size === 38, 'EXACT_38_NODE_DEFINITIONS_REQUIRED');
  const unregistered = [...g.nodes.keys()].filter(n => !names.has(n)).sort();
  requireCheck(errors, JSON.stringify(unregistered) === JSON.stringify(['K2Node_VariableSet_0', 'K2Node_VariableSet_1']), 'EXPECTED_TWO_UNREGISTERED_DEFINITIONS_REQUIRED');
  let directed = 0;
  const edges = new Set();
  for (const [name, n] of g.nodes) for (const p of n.pins.values()) {
    for (const [targetName, targetId] of p.links) {
      directed++;
      const target = g.nodes.get(targetName)?.pins.get(targetId);
      requireCheck(errors, names.has(name) && names.has(targetName), 'LINK_TO_UNREGISTERED_NODE');
      requireCheck(errors, target && target.output !== p.output && target.category === p.category && target.links.filter(x => x[0] === name && x[1] === p.id).length === 1, 'DANGLING_OR_NONRECIPROCAL_LINK');
      const ends = [`${name}.${p.id}`, `${targetName}.${targetId}`].sort();
      edges.add(ends.join(' <-> '));
    }
  }
  requireCheck(errors, directed === 72 && edges.size === 36, 'EXACT_72_DIRECTED_36_RECIPROCAL_LINKS_REQUIRED');
  const pin = (name, pinName) => {
    const found = [...(g.nodes.get(name)?.pins.values() ?? [])].filter(p => p.name === pinName);
    return found.length === 1 ? found[0] : undefined;
  };
  const hasEdge = (a, ap, b, bp) => {
    const p = pin(a, ap), q = pin(b, bp);
    return p && q && p.links.some(x => x[0] === b && x[1] === q.id) && q.links.some(x => x[0] === a && x[1] === p.id);
  };
  const edge = (a, ap, b, bp, code = 'REQUIRED_ROUTE_EDGE_MISSING') => requireCheck(errors, hasEdge(a, ap, b, bp), `${code}:${a}.${ap}->${b}.${bp}`);
  const empty = (n, p, code) => requireCheck(errors, pin(n, p)?.links.length === 0, code);
  const member = (n, kind, value) => requireCheck(errors, g.nodes.get(n)?.raw.some(s => s.includes(`${kind}Reference=`) && s.includes(`MemberName="${value}"`)), `NODE_MEMBER_MISMATCH:${n}`);
  const setTrue = (n, name) => { member(n, 'Variable', name); requireCheck(errors, pin(n, name)?.defaultValue === 'true', `ATTEMPT_NOT_CONSUMED:${n}`); };

  member('K2Node_CallFunction_0', 'Function', 'AddToViewport');
  requireCheck(errors, g.nodes.get('K2Node_CallFunction_0')?.raw.includes('         NodeGuid=6435B7EE48CB6EAB224242946EBC6095'), 'ADD_TO_VIEWPORT_GUID_MISMATCH');
  empty('K2Node_CallFunction_0', 'then', 'ADD_TO_VIEWPORT_CONTINUATION_MUST_BE_UNCONNECTED_BASELINE');
  empty('K2Node_MacroInstance_0', 'Reset', 'DO_ONCE_RESET_MUST_STAY_DISCONNECTED');
  requireCheck(errors, g.nodes.get('K2Node_InputAction_0')?.raw.includes('         bConsumeInput=False'), 'INPUT_CONSUMPTION_CHANGED');
  const first = [
    ['K2Node_InputAction_0','Pressed','K2Node_IfThenElse_2014','execute'],
    ['K2Node_IfThenElse_2014','else','K2Node_VariableSet_2015','execute'],
    ['K2Node_VariableSet_2015','then','K2Node_MacroInstance_0','execute'],
    ['K2Node_MacroInstance_0','Completed','K2Node_CreateWidget_0','execute'],
    ['K2Node_CreateWidget_0','then','K2Node_VariableSet_2','execute'],
    ['K2Node_VariableSet_2','then','K2Node_MacroInstance_1','exec'],
    ['K2Node_MacroInstance_1','Is Valid','K2Node_CallFunction_0','execute'],
  ];
  const second = [
    ['K2Node_IfThenElse_2014','then','K2Node_IfThenElse_2017','execute'],
    ['K2Node_IfThenElse_2017','else','K2Node_VariableSet_2018','execute'],
    ['K2Node_VariableSet_2018','then','K2Node_CallFunction_2019','execute'],
    ['K2Node_CallFunction_2019','then','K2Node_MacroInstance_2021','exec'],
    ['K2Node_MacroInstance_2021','Is Valid','K2Node_CallFunction_2023','execute'],
  ];
  [...first, ...second].forEach(e => edge(...e));
  setTrue('K2Node_VariableSet_2015','B0ControlAttempted');
  setTrue('K2Node_VariableSet_2018','B0SnapshotAttempted');
  member('K2Node_CallFunction_2019','Function','CaptureB0Snapshot');
  member('K2Node_CallFunction_2023','Function','SetSnapshot');
  empty('K2Node_IfThenElse_2017','then','LATER_PRESS_MUST_NOT_RETRY');
  ['K2Node_CallFunction_4','K2Node_CallFunction_5'].forEach(n => empty(n,'execute',`LEGACY_CALL_MUST_STAY_DISCONNECTED:${n}`));

  member('K2Node_Event_0','Event','ReceiveEndPlay');
  member('K2Node_CallParentFunction_0','Function','ReceiveEndPlay');
  const parents = g.registered.filter(n => n.name.startsWith('K2Node_CallParentFunction_') && g.nodes.get(n.name)?.raw.some(s => s.includes('MemberName="ReceiveEndPlay"')));
  requireCheck(errors, parents.length === 1 && parents[0].name === 'K2Node_CallParentFunction_0', 'SOLE_PARENT_ENDPLAY_REQUIRED');
  const end = [
    ['K2Node_Event_0','then','K2Node_VariableSet_2024','execute'],
    ['K2Node_VariableSet_2024','then','K2Node_VariableSet_2025','execute'],
    ['K2Node_VariableSet_2025','then','K2Node_MacroInstance_2','exec'],
    ['K2Node_MacroInstance_2','Is Valid','K2Node_CallFunction_1','execute'],
    ['K2Node_MacroInstance_2','Is Not Valid','K2Node_VariableSet_3','execute'],
    ['K2Node_CallFunction_1','then','K2Node_VariableSet_3','execute'],
    ['K2Node_VariableSet_3','then','K2Node_CallArrayFunction_2027','execute'],
    ['K2Node_CallArrayFunction_2027','then','K2Node_CallParentFunction_0','execute'],
  ];
  end.forEach(e => edge(...e, 'ENDPLAY_CLEANUP_EDGE_REQUIRED'));
  edge('K2Node_Event_0','EndPlayReason','K2Node_CallParentFunction_0','EndPlayReason','ENDPLAY_REASON_DIRECT_EDGE_REQUIRED');
  setTrue('K2Node_VariableSet_2024','B0ControlAttempted');
  setTrue('K2Node_VariableSet_2025','B0SnapshotAttempted');
  member('K2Node_CallFunction_1','Function','RemoveFromParent');
  member('K2Node_VariableSet_3','Variable','ControlReadout');
  member('K2Node_CallArrayFunction_2027','Function','Array_Clear');
  edge('K2Node_VariableGet_2026','B0CapturedComponents','K2Node_CallArrayFunction_2027','TargetArray');
  const traceReference = g.registered.some(n => g.nodes.get(n.name)?.raw.some(s => /ReceiveOnAreaTransition|SaveStringTextToFile|TraceEnabled|TRANSITION_BEGIN|TRANSITION_END|ENDPLAY/.test(s)));
  requireCheck(errors, !traceReference, 'UNEXPECTED_TRANSITION_OR_WRITER_REFERENCE_IN_FROZEN_BASELINE');
  return { passed: errors.length === 0, errors: [...new Set(errors)], graph: { start_line: g.start, end_line: g.end,
    registered_nodes: g.registered.length, node_definitions: g.nodes.size, directed_links: directed, reciprocal_edges: edges.size,
    unregistered_definitions: unregistered, add_to_viewport_then_line: pin('K2Node_CallFunction_0','then')?.line,
    endplay_reason_output_line: pin('K2Node_Event_0','EndPlayReason')?.line,
    parent_reason_input_line: pin('K2Node_CallParentFunction_0','EndPlayReason')?.line },
    transition_instrumentation: traceReference ? 'UNEXPECTED_IN_FROZEN_BASELINE' : 'NOT_IMPLEMENTED_IN_SAVED_EVENTGRAPH' };
}

export function auditSavedBaseline({ baseline, source, defaults, read = readFileSync }) {
  const errors = [], preserved = [];
  let pins;
  try { const b = JSON.parse(read(baseline, 'utf8')); pins = b.preservation?.checks ?? b.checks; } catch (e) { errors.push(`BASELINE_READ_FAILED:${e.code ?? e.message}`); }
  if (!Array.isArray(pins) || pins.length !== EXPECTED.preservationCount) errors.push('EXACT_41_PRESERVATION_PINS_REQUIRED');
  let manifestDigest;
  try { manifestDigest = pinManifestDigest(pins); } catch { errors.push('INVALID_PRESERVATION_PIN'); }
  if (manifestDigest !== EXPECTED.preservationManifestSha256) errors.push('FROZEN_PRESERVATION_MANIFEST_MISMATCH');
  const seen = new Set();
  for (const p of Array.isArray(pins) ? pins : []) {
    if (!validPin(p)) { errors.push('INVALID_PRESERVATION_PIN'); continue; }
    const key = p.path.replaceAll('\\','/').toLowerCase();
    if (seen.has(key)) errors.push('DUPLICATE_PRESERVATION_PIN');
    seen.add(key);
    // Do not read file paths from an unrecognized manifest.
    if (manifestDigest !== EXPECTED.preservationManifestSha256) continue;
    try { const b = read(p.path), hash = sha256(b); preserved.push({ path: p.path, bytes: b.length, sha256: hash, match: b.length === p.bytes && hash === p.sha256 }); }
    catch (e) { preserved.push({ path: p.path, match: false, error: e.code ?? e.message }); }
  }
  if (preserved.some(p => !p.match)) errors.push('PRESERVATION_DRIFT_OR_UNREADABLE_FILE');
  const exports = {}, data = {};
  for (const [kind, file] of Object.entries({ source, defaults })) {
    try { const b = read(file), hash = sha256(b); exports[kind] = { path: file, bytes: b.length, sha256: hash, match: b.length === EXPECTED[kind].bytes && hash === EXPECTED[kind].sha256 }; data[kind] = b.toString('utf8'); }
    catch (e) { exports[kind] = { path: file, match: false, error: e.code ?? e.message }; }
    if (!exports[kind].match) errors.push(`FROZEN_${kind.toUpperCase()}_EXPORT_PIN_MISMATCH`);
  }
  const graph = data.source === undefined ? { passed: false, errors: ['SOURCE_UNREADABLE'] } : inspectGraph(data.source);
  errors.push(...graph.errors);
  return { schema: 'B0_SAVED_BASELINE_READ_ONLY_AUDIT_V1', classification: 'OBSERVED_FILE_AND_STATIC_GRAPH_ONLY',
    status: errors.length ? 'FAILED_STATIC_BASELINE_AUDIT' : 'PASS_STATIC_BASELINE_PRESERVATION',
    baseline_path: baseline, preservation: { manifest_sha256: manifestDigest ?? null, expected_manifest_sha256: EXPECTED.preservationManifestSha256,
      checked: preserved.length, matched: preserved.filter(p => p.match).length, checks: preserved },
    exports, ...graph, errors: [...new Set(errors)], passed: errors.length === 0,
    runtime: 'NOT_PERFORMED', loaded_editor_state: 'UNKNOWN',
    limits: ['Frozen saved export only; does not establish current in-memory graph, input delivery, rendered UI, delegate pins, writer execution, mission callbacks or teardown behavior.',
      'This audit intentionally rejects a future patched graph; it is not patch acceptance or a runtime recorder.',
      'No imports of retained launchers, claims, editor scripts or process execution; no writes are performed by this module.'] };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2), options = {};
  try {
    if (args.length !== 6) throw new Error('Usage: node Audit-B0SavedBaseline.mjs --baseline PATH --source PATH --defaults PATH');
    for (let i = 0; i < args.length; i += 2) {
      const key = args[i].replace(/^--/,'');
      if (!['baseline','source','defaults'].includes(key) || options[key] || !args[i + 1]) throw new Error('Invalid or repeated argument');
      options[key] = args[i + 1];
    }
    if (!options.baseline || !options.source || !options.defaults) throw new Error('Three explicit input paths required');
    const result = auditSavedBaseline(options);
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    process.exitCode = result.passed ? 0 : 1;
  } catch (e) { process.stderr.write(e.message + '\n'); process.exitCode = 2; }
}
