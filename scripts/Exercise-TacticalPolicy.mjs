// Offline scenario runner. Writes only project research output.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { decideSquad, POLICY_VERSION } from './tactical-policy.mjs';
import { cases, baseline } from '../synthetic/tactical-cases.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const receipts = [];
for (const test of cases) {
  const traces = []; let previous = null;
  try {
    for (const step of test.steps) {
      const before = JSON.stringify({ s: step.snapshot, previous });
      const output = decideSquad(step.snapshot, previous);
      assert.equal(JSON.stringify({ s: step.snapshot, previous }), before, 'Inputs mutated');
      assert.deepEqual(output, decideSquad(step.snapshot, previous), 'Nondeterminism');
      assert.deepEqual(output.recommendations.map(r => r.action), step.expect.actions);
      if (step.expect.targetIds) assert.deepEqual(output.recommendations.map(r => r.targetId), step.expect.targetIds);
      assert(output.recommendations.every(r => r.dispatchable === false && r.evidence.length > 0));
      assert.equal(output.classification, 'MOCK_ONLY');
      const positions = output.recommendations.filter(r => r.action === 'REPOSITION').map(r => r.positionId);
      assert.equal(new Set(positions).size, positions.length, 'Conflicting position assignments');
      traces.push(output); previous = output.state;
    }
    receipts.push({ id: test.id, purpose: test.purpose, status: 'PASS', traces });
  } catch (error) { receipts.push({ id: test.id, purpose: test.purpose, status: 'FAIL', error: error.message, traces }); }
}
const properties = [];
function property(name, fn) { try { fn(); properties.push({ name, status: 'PASS' }); }
  catch (e) { properties.push({ name, status: 'FAIL', error: e.message }); } }
property('Hidden target facts cannot alter a valid recommendation', () => {
  const s = baseline(), expected = decideSquad(s).recommendations;
  s.targets.push({ id: 'hidden', knownToLance: false, visibleToLance: false,
    allegiance: 'hostile', alive: true, observedAtMs: 1000, threat: 1 });
  s.lancemates[0].engagements.push({ targetId: 'hidden', distanceM: 10, lineOfFireKnownClear: true });
  assert.deepEqual(decideSquad(s).recommendations, expected);
});
property('Input array order does not change coordinated decisions', () => {
  const s = structuredClone(cases.find(x => x.id === 'T15').steps[0].snapshot);
  const expected = decideSquad(s).recommendations; s.lancemates.reverse(); s.targets.reverse();
  assert.deepEqual(decideSquad(s).recommendations, expected);
});
property('Malformed top-level input never dispatches', () => {
  for (const s of [null, {}, [], 1, 'state']) assert(decideSquad(s).recommendations.every(r => r.action === 'DEFER'));
});
const failed = [...receipts, ...properties].filter(r => r.status === 'FAIL');
const hash = relative => createHash('sha256').update(fs.readFileSync(path.join(root, relative))).digest('hex');
const report = { classification: 'MOCK_ONLY', policyVersion: POLICY_VERSION, generatedUtc: new Date().toISOString(),
  status: failed.length ? 'FAIL' : 'EXPECTATIONS_MET', scenarioCount: receipts.length,
  propertyCount: properties.length, failureCount: failed.length, gameplay: 'NOT_PERFORMED', nativeCalls: 0,
  inputs: ['scripts/tactical-policy.mjs', 'synthetic/tactical-cases.mjs', 'scripts/Exercise-TacticalPolicy.mjs']
    .map(file => ({ file, sha256: hash(file) })), scenarios: receipts, properties };
fs.writeFileSync(path.join(root, 'research', 'OFFLINE_TACTICAL_RESULTS.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ status: report.status, scenarios: report.scenarioCount,
  properties: report.propertyCount, failures: failed.map(x => ({ id: x.id ?? x.name, error: x.error })) }, null, 2));
process.exitCode = failed.length ? 1 : 0;
