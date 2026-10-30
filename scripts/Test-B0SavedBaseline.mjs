// MOCK_ONLY negative tests. Real saved text is a fixture, never executed or edited.
// Read admitted fixture bytes once; audit reads and all mutations stay in memory.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { auditSavedBaseline, inspectGraph, parseEventGraph, sha256, pinManifestDigest, EXPECTED } from './Audit-B0SavedBaseline.mjs';

const args = process.argv.slice(2), paths = {};
for (let i = 0; i < args.length; i += 2) paths[args[i].replace(/^--/,'')] = args[i + 1];
if (args.length !== 6 || !paths.baseline || !paths.source || !paths.defaults) throw new Error('Explicit --baseline PATH --source PATH --defaults PATH required');
const source = readFileSync(paths.source), defaults = readFileSync(paths.defaults), text = source.toString('utf8');
const graph = parseEventGraph(text);
const rawBaseline = JSON.parse(readFileSync(paths.baseline,'utf8'));
const pins = rawBaseline.preservation?.checks ?? rawBaseline.checks;
assert.equal(pinManifestDigest(pins),EXPECTED.preservationManifestSha256,'Test must start from the admitted frozen inventory');
const contents = new Map(pins.map(p => [p.path,readFileSync(p.path)]));
contents.set('source', source); contents.set('defaults', defaults);
const originalBaseline = { preservation: { checks: pins } };
function run({ baseline = originalBaseline, change = {} } = {}) {
  const map = new Map(contents);
  map.set('baseline', Buffer.from(JSON.stringify(baseline)));
  for (const [name, value] of Object.entries(change)) map.set(name, value);
  return auditSavedBaseline({ baseline: 'baseline', source: 'source', defaults: 'defaults', read: (name, encoding) => {
    const value = map.get(name);
    if (value === undefined) throw Object.assign(new Error('MOCK_ONLY absent'), { code: 'ENOENT' });
    return encoding ? value.toString(encoding) : value;
  } });
}
function editPin(nodeName, pinName, transform, input = text) {
  const parsed = parseEventGraph(input), node = parsed.nodes.get(nodeName);
  const pin = [...node.pins.values()].find(p => p.name === pinName);
  assert.ok(pin, `${nodeName}.${pinName} fixture pin exists`);
  const lines = input.split(/\r?\n/), before = lines[pin.line - 1];
  lines[pin.line - 1] = transform(before);
  assert.notEqual(lines[pin.line - 1], before, 'mutation actually changes fixture');
  return lines.join('\r\n');
}
const removeLink = s => s.replace(/,LinkedTo=\([^)]*\)/, '');
const addLink = s => s.replace(',PersistentGuid=', ',LinkedTo=(MOCK_MISSING_NODE 00000000000000000000000000000001,),PersistentGuid=');
function rejected(input, code) {
  const result = inspectGraph(input);
  assert.equal(result.passed, false);
  assert.ok(result.errors.some(e => e.startsWith(code)), JSON.stringify(result.errors));
}

test('MOCK_ONLY known saved EventGraph passes bounded structural checks', () => {
  const r = inspectGraph(text);
  assert.equal(r.passed, true);
  assert.deepEqual([r.graph.registered_nodes,r.graph.node_definitions,r.graph.directed_links,r.graph.reciprocal_edges], [36,38,72,36]);
  assert.equal(r.transition_instrumentation, 'NOT_IMPLEMENTED_IN_SAVED_EVENTGRAPH');
});
test('MOCK_ONLY full audit passes with all 41 matching virtual pins and exact saved bytes', () => {
  const r = run();
  assert.equal(r.passed, true); assert.equal(r.preservation.matched,41);
  assert.equal(r.runtime, 'NOT_PERFORMED'); assert.equal(r.loaded_editor_state, 'UNKNOWN');
});
test('MOCK_ONLY top-level checks baseline form also passes', () => assert.equal(run({baseline:{checks:pins}}).passed,true));
test('MOCK_ONLY 40 pins are insufficient', () => assert.ok(run({baseline:{checks:pins.slice(1)}}).errors.includes('EXACT_41_PRESERVATION_PINS_REQUIRED')));
test('MOCK_ONLY duplicate pin paths are rejected even if each file matches', () => {
  const copy = structuredClone(pins); copy[1] = copy[0];
  assert.ok(run({baseline:{checks:copy}}).errors.includes('DUPLICATE_PRESERVATION_PIN'));
});
test('MOCK_ONLY stale match=true cannot conceal preservation drift', () => {
  const copy = pins.map(p => ({...p,match:true}));
  const r = run({baseline:{checks:copy},change:{[pins[0].path]:Buffer.from('modified')}});
  assert.ok(r.errors.includes('PRESERVATION_DRIFT_OR_UNREADABLE_FILE'));
});
test('MOCK_ONLY missing file fails closed', () => assert.ok(run({change:{[pins[0].path]:undefined}}).errors.includes('PRESERVATION_DRIFT_OR_UNREADABLE_FILE')));
test('MOCK_ONLY self-consistent substituted bytes plus forged manifest hash cannot pass frozen inventory', () => {
  const copy = structuredClone(pins), substitute = Buffer.from('MOCK_ONLY substituted controller');
  copy[0].bytes = substitute.length; copy[0].sha256 = sha256(substitute);
  const r = run({baseline:{checks:copy},change:{[pins[0].path]:substitute}});
  assert.ok(r.errors.includes('FROZEN_PRESERVATION_MANIFEST_MISMATCH'));
  assert.equal(r.preservation.checked,0,'Do not read paths from an unrecognized manifest');
});
test('MOCK_ONLY altered source bytes fail their independent frozen hash', () => assert.ok(run({change:{source:Buffer.concat([source,Buffer.from('\n')])}}).errors.includes('FROZEN_SOURCE_EXPORT_PIN_MISMATCH')));
test('MOCK_ONLY altered defaults bytes fail even when graph passes', () => assert.ok(run({change:{defaults:Buffer.from('changed')}}).errors.includes('FROZEN_DEFAULTS_EXPORT_PIN_MISMATCH')));
test('MOCK_ONLY appending arming to first viewport continuation changes frozen baseline', () => rejected(editPin('K2Node_CallFunction_0','then',addLink),'ADD_TO_VIEWPORT_CONTINUATION_MUST_BE_UNCONNECTED_BASELINE'));
test('MOCK_ONLY removing both actual reason links cannot count displayed Destroyed default as forwarding', () => {
  let changed = editPin('K2Node_Event_0','EndPlayReason',removeLink);
  changed = editPin('K2Node_CallParentFunction_0','EndPlayReason',removeLink,changed);
  rejected(changed,'ENDPLAY_REASON_DIRECT_EDGE_REQUIRED');
});
test('MOCK_ONLY invalid-widget cleanup branch must still reach clear', () => rejected(editPin('K2Node_MacroInstance_2','Is Not Valid',removeLink),'ENDPLAY_CLEANUP_EDGE_REQUIRED'));
test('MOCK_ONLY parent cleanup edge cannot be omitted', () => rejected(editPin('K2Node_CallArrayFunction_2027','then',removeLink),'ENDPLAY_CLEANUP_EDGE_REQUIRED'));
test('MOCK_ONLY first attempt must be consumed before create', () => rejected(editPin('K2Node_VariableSet_2015','B0ControlAttempted',s=>s.replace(',DefaultValue="true"',',DefaultValue="false"')),'ATTEMPT_NOT_CONSUMED'));
test('MOCK_ONLY EndPlay must seal snapshot attempt', () => rejected(editPin('K2Node_VariableSet_2025','B0SnapshotAttempted',s=>s.replace(',DefaultValue="true"',',DefaultValue="false"')),'ATTEMPT_NOT_CONSUMED'));
test('MOCK_ONLY later press no-retry branch must remain disconnected', () => rejected(editPin('K2Node_IfThenElse_2017','then',addLink),'LATER_PRESS_MUST_NOT_RETRY'));
test('MOCK_ONLY DoOnce Reset cannot be connected', () => rejected(editPin('K2Node_MacroInstance_0','Reset',addLink),'DO_ONCE_RESET_MUST_STAY_DISCONNECTED'));
test('MOCK_ONLY one-sided link damage is rejected', () => rejected(editPin('K2Node_Event_0','then',removeLink),'DANGLING_OR_NONRECIPROCAL_LINK'));
test('MOCK_ONLY retained input-consumption setting cannot change', () => {
  const lines = text.split(/\r?\n/), n = graph.nodes.get('K2Node_InputAction_0');
  const i = lines.findIndex((s,i)=>i >= n.line && s === '         bConsumeInput=False');
  assert.ok(i>0); lines[i] = '         bConsumeInput=True'; rejected(lines.join('\r\n'),'INPUT_CONSUMPTION_CHANGED');
});
test('MOCK_ONLY duplicate registered node is rejected', () => {
  const line = graph.lines[graph.registered[0].line-1];
  rejected(text.replace(line,line+'\r\n'+line),'EXACT_36_REGISTERED_NODES_REQUIRED');
});
test('MOCK_ONLY truncated primary graph is rejected', () => rejected(text.split(/\r?\n/).slice(0,graph.end-1).join('\r\n'),'COMPLETE_PRIMARY_EVENTGRAPH_REQUIRED'));
