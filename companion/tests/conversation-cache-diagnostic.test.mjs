// MOCK_ONLY preparation checks: imports and plans start no native runtime.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { prepareCacheDiagnostic } from '../../scripts/Exercise-ConversationCache.mjs';
import { validateGroundingCases } from '../../scripts/Exercise-ConversationGrounding.mjs';

const fixture = JSON.parse(await readFile(new URL('../../synthetic/conversation-grounding-cases.json', import.meta.url)));

test('cache calibration cannot acquire test facts/history/identity and all twelve measured contexts stay unchanged', () => {
  const before = structuredClone(fixture), plan = prepareCacheDiagnostic(['--check'], fixture);
  assert.deepEqual(plan.primer, { persona: { id: 'calibration' }, request: { text: 'Say OK.' }, facts: [], history: [] });
  assert.deepEqual(plan.cases, validateGroundingCases(before));
  assert.equal(plan.cases.length, 12);
  assert.deepEqual(fixture, before);
  assert.match(plan.primerMessages[0].content, /Persona: \{\}$/);
  assert.match(plan.primerMessages[1].content, /"callerAssertedCurrentObservations":\[\],"unverifiedUndeliveredHistory":\[\]/);
});

test('only explicit fixed check/run selectors are accepted, with no tuning or output-path arguments', () => {
  assert.equal(prepareCacheDiagnostic(['--run'], fixture).action, '--run');
  for (const args of [[], ['--run', '--retry'], ['--check', '--run'], ['--output', '../receipt.json'], ['--native'], ['--run=1']])
    assert.throws(() => prepareCacheDiagnostic(args, fixture), /INVALID_ARGUMENTS/);
});
