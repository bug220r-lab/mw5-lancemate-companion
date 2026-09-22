// Runner orchestration tests only: imports do not create a worker or receipt.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { waitForStartup, validateGroundingCases, parseGroundingArgs } from '../../scripts/Exercise-ConversationGrounding.mjs';

test('editor-closed context requires the unchanged compact/no-repack configuration and a separate fixed receipt', () => {
  for (const action of ['--check','--run']) {
    const baseline = parseGroundingArgs([action, '--compact-no-repack']);
    const changed = parseGroundingArgs([action, '--compact-no-repack', '--editor-closed']);
    assert.equal(changed.action, action);
    assert.equal(changed.compact, baseline.compact); assert.equal(changed.weightRepacking, baseline.weightRepacking);
    assert.equal(changed.compact, true); assert.equal(changed.weightRepacking, false);
    assert.equal(changed.receiptFileName, 'QWEN4B_GROUNDING_EDITOR_CLOSED_DIAGNOSTIC.json');
    assert.notEqual(changed.receiptFileName, baseline.receiptFileName);
    assert.deepEqual(changed.environmentContext, { editorCondition: 'SUPERVISOR_REPORTED_EDITOR_CLOSED',
      evidenceRef: 'research/EDITOR_CLOSE_RESOURCE_2026-09-22.json', editorStateCheckedByScript: false });
    assert.equal(baseline.receiptFileName, 'QWEN4B_GROUNDING_NOREPACK_DIAGNOSTIC.json');
    assert.equal(parseGroundingArgs([action, '--compact-batch']).receiptFileName, 'QWEN4B_GROUNDING_COMPACT_DIAGNOSTIC.json');
    assert.equal(parseGroundingArgs([action]).receiptFileName, 'QWEN4B_GROUNDING_DIAGNOSTIC.json');
  }
});

test('unsupported editor-closed combinations cannot select a runnable diagnostic or arbitrary receipt', () => {
  for (const args of [[], null, ['--editor-closed'], ['--run','--editor-closed'], ['--check','--editor-closed'],
    ['--run','--compact-batch','--editor-closed'], ['--check','--compact-batch','--editor-closed'],
    ['--run','--editor-closed','--compact-no-repack'], ['--run','--compact-no-repack','--unknown'],
    ['--run','--compact-no-repack','../../outside.json'], ['--run','--compact-no-repack','--editor-closed','--editor-closed']]) {
    assert.equal(parseGroundingArgs(args), null);
  }
});

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
