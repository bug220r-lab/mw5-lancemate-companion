// Runner orchestration tests only: imports do not create a worker or receipt.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { waitForStartup, validateGroundingCases } from '../../scripts/Exercise-ConversationGrounding.mjs';

test('independent diagnostic cases fit the actual adapter prompt contract before execution', async () => {
  const fixture = JSON.parse(await readFile(new URL('../../synthetic/conversation-grounding-cases.json', import.meta.url)));
  const cases = validateGroundingCases(fixture);
  assert.equal(cases.length, 12); assert.equal(new Set(cases.map(c => c.specification.id)).size, 12);
  assert.deepEqual([...new Set(cases.map(c => c.specification.persona))].sort(), ['edge','scout','tactician']);
  const broken = structuredClone(fixture); broken.cases[0].request = 'x'.repeat(301);
  assert.throws(() => validateGroundingCases(broken), /INVALID_CONTEXT/);
  broken.cases[0] = broken.cases[1]; assert.throws(() => validateGroundingCases(broken), /INVALID_FIXTURE/);
});

test('startup cancellation reaches caller even if adapter startup never settles', async () => {
  const controller = new AbortController();
  const result = waitForStartup(new Promise(() => {}), controller.signal);
  controller.abort(); await assert.rejects(result, /STARTUP_INTERRUPTED/);
});

test('already-cancelled startup handles a late adapter rejection without reviving the run', async () => {
  const controller = new AbortController(); controller.abort();
  let rejectLater; const pending = new Promise((_, reject) => { rejectLater = reject; });
  const result = waitForStartup(pending, controller.signal);
  await assert.rejects(result, /STARTUP_INTERRUPTED/);
  rejectLater(Error('LATE_ADAPTER_FAILURE')); await new Promise(resolve => setImmediate(resolve));
});

test('startup success and ordinary failure propagate without hiding adapter status', async () => {
  const signal = new AbortController().signal;
  assert.deepEqual(await waitForStartup(Promise.resolve({ state: 'READY' }), signal), { state: 'READY' });
  await assert.rejects(waitForStartup(Promise.reject(Error('PIN_MISMATCH')), signal), /PIN_MISMATCH/);
});
