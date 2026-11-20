// Synthetic supplied-label scoring only. No recognizer, model, socket or device.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import childProcess from 'node:child_process';
import net from 'node:net';
import { createHash } from 'node:crypto';
import { scoreCommandTranscriptCorpus as score, COMMAND_TRANSCRIPT_LIMITS as limits } from '../command-transcript-evaluation.mjs';
import { readBoundedCommandCorpus, runCommandTranscriptCli } from '../../scripts/Score-CommandTranscripts.mjs';

const bindings = () => ['alpha', 'bravo', 'charlie'].map((id, i) => ({ id, pawnId: `pawn-${i + 1}`,
  generation: i, slot: i + 1, alive: true, aiOwned: true }));
const expectedBinding = index => { const { id, pawnId, generation } = bindings()[index]; return { id, pawnId, generation }; };
function row(change = {}) {
  return { id: 'synthetic-1', sourceKind: 'SYNTHETIC', sourceRef: 'synthetic:fixture', annotationRef: 'synthetic:predeclared',
    ambiguous: false, request: { text: 'regroup slot 1', origin: 'human_ptt', final: true,
      session: 'synthetic-session', bindings: bindings() },
    expected: { status: 'INTENT', action: 'REGROUP', recipients: [expectedBinding(0)] }, ...change };
}
const corpus = rows => JSON.stringify({ schemaVersion: 1, cases: rows });
const run = value => score(corpus([value]));
function noncommand(status, reason, request, extra = {}) {
  return row({ request: { ...row().request, ...request }, expected: { status, reason }, ...extra });
}

test('empty template is NO_CASES with null rates and no vacuous acceptance', () => {
  const report = score(corpus([]));
  assert.equal(report.status, 'NO_CASES'); assert.equal(report.classification, 'SUPPLIED_TRANSCRIPT_REPLAY_ONLY');
  assert.equal(report.summary.commands.jointAccuracy, null); assert.equal(report.summary.clarifications.matchRate, null);
  assert.equal(report.execution.parserReplay, 'NOT_PERFORMED');
  for (const key of ['recognition', 'dispatch', 'latencyMeasurement', 'nativeAcceptance', 'releaseAcceptance'])
    assert.equal(report.execution[key], 'NOT_PERFORMED');
  assert.equal(report.voiceRecordings, undefined); assert.equal(report.accepted, undefined);
});

test('exact generation-zero binding sets ignore recipient order and retain supplied transcript/context', () => {
  const input = row(); input.request.text = 'REGROUP SLOT 2 AND SLOT 1!';
  input.expected.recipients = [expectedBinding(0), expectedBinding(1)];
  const text = corpus([input]), original = text, report = score(text);
  assert.equal(report.summary.commands.jointAccuracy, 1); assert.equal(report.results[0].matched, true);
  assert.deepEqual(report.results[0].request, input.request); assert.equal(text, original);
  assert.equal(report.inputSha256, createHash('sha256').update(text).digest('hex'));
  report.results[0].request.bindings[0].pawnId = 'changed';
  assert.equal(score(text).results[0].request.bindings[0].pawnId, 'pawn-1');
});

test('wrong action, recipient ID, pawn and generation are independent command failures', () => {
  const changes = [
    expected => { expected.action = 'RELEASE_HUMAN_HOLD'; },
    expected => { expected.recipients = [expectedBinding(1)]; },
    expected => { expected.recipients[0].pawnId = 'another-pawn'; },
    expected => { expected.recipients[0].generation = 100; },
  ];
  for (const change of changes) {
    const input = row(); change(input.expected); const report = run(input);
    assert.equal(report.summary.commands.count, 1); assert.equal(report.summary.commands.jointCorrect, 0);
    assert.equal(report.summary.commands.jointAccuracy, 0); assert.equal(report.results[0].matched, false);
  }
});

test('focus target, reposition location and global disarm scope are compared exactly', () => {
  const focus = row(); focus.request.text = 'focus slot 1'; focus.request.selectedTargetId = 'target-A';
  focus.expected.action = 'FOCUS'; focus.expected.targetId = 'target-B';
  assert.equal(run(focus).results[0].checks.arguments, false);
  focus.expected.targetId = 'target-A'; assert.equal(run(focus).results[0].matched, true);
  const move = row(); move.request.text = 'reposition slot 1 to location ridge'; move.request.locations = ['Ridge'];
  move.expected.action = 'REPOSITION'; move.expected.locationId = 'ridge';
  assert.equal(run(move).results[0].checks.arguments, false);
  move.expected.locationId = 'Ridge'; assert.equal(run(move).results[0].matched, true);
  const disarm = row({ request: { text: 'DISARM!', origin: 'human_ptt', final: true, session: 'synthetic' },
    expected: { status: 'INTENT', action: 'DISARM', recipients: [], scope: 'ALL_COMPANION_CONTROL' } });
  assert.equal(run(disarm).results[0].matched, true);
  disarm.request = { ...row().request, text: 'disarm slot 1' };
  const targeted = run(disarm); assert.equal(targeted.results[0].checks.arguments, false);
  assert.equal(targeted.results[0].matched, false);
});

test('withholding an expected command counts incorrect, without being an unexpected intent', () => {
  const input = row(); input.request.bindings[0].aiOwned = false;
  const report = run(input);
  assert.equal(report.results[0].actual.status, 'REJECTED'); assert.equal(report.results[0].withheldOutcome, true);
  assert.equal(report.summary.commands.jointAccuracy, 0); assert.equal(report.summary.unexpectedIntentsProduced, 0);
});

test('expected clarification/rejection and reason mismatch are separate from command accuracy', () => {
  const clarification = noncommand('CLARIFICATION', 'KNOWN_SELECTED_TARGET_REQUIRED', { text: 'focus slot 1' });
  const rejection = noncommand('REJECTED', 'TRUSTED_FINAL_HUMAN_PTT_REQUIRED', { origin: 'model' }, { id: 'synthetic-2' });
  const wrongReason = noncommand('CLARIFICATION', 'AMBIGUOUS_RECIPIENT', { text: 'focus slot 1' }, { id: 'synthetic-3' });
  const wrongStatus = noncommand('CLARIFICATION', 'TRUSTED_FINAL_HUMAN_PTT_REQUIRED', { origin: 'model' }, { id: 'synthetic-4' });
  const report = score(corpus([clarification, rejection, wrongReason, wrongStatus]));
  assert.equal(report.summary.commands.count, 0); assert.equal(report.summary.commands.jointAccuracy, null);
  assert.equal(report.summary.clarifications.count, 3); assert.equal(report.summary.clarifications.matched, 1);
  assert.equal(report.summary.rejections.matched, 1); assert.equal(report.summary.withheldOutcomes, 4);
  assert.deepEqual(report.results[2].differences, ['reason']); assert.equal(report.results[3].checks.status, false);
});

test('ambiguous and other expected nonintents producing an intent are counted despite dispatchable false', () => {
  const ambiguous = noncommand('CLARIFICATION', 'AMBIGUOUS_RECIPIENT', {}, { ambiguous: true });
  const rejected = noncommand('REJECTED', 'INELIGIBLE_RECIPIENT', {}, { id: 'synthetic-2' });
  const report = score(corpus([ambiguous, rejected]));
  assert.equal(report.summary.ambiguousIntentsProduced, 1); assert.equal(report.summary.unexpectedIntentsProduced, 2);
  assert.equal(report.summary.commands.jointAccuracy, null);
  assert.equal(report.results[0].actual.dispatchable, false); assert.equal(report.results[0].matched, false);
});

test('overlong transcript is not repaired; untrusted origin and partial final remain supplied data', () => {
  for (const patch of [{ text: 'regroup slot 1' + ' '.repeat(301) }, { origin: 'generated_audio' }, { final: false }]) {
    const input = row(); Object.assign(input.request, patch); const report = run(input);
    assert.deepEqual(report.results[0].request, input.request); assert.equal(report.results[0].actual.status, 'REJECTED');
    assert.equal(report.summary.commands.jointAccuracy, 0);
  }
});

test('exposure and references stay unverified declarations, and omission defaults UNKNOWN', () => {
  const input = row({ sourceKind: 'SUPPLIED_TRANSCRIPT', sourceRef: 'https://never-open.invalid/audio.wav',
    annotationRef: 'C:/never-open/labels.json', exposure: 'DECLARED_HELD_OUT' });
  const report = run(input);
  assert.equal(report.declarationsVerified, false); assert.equal(report.results[0].declarations.verified, false);
  assert.equal(report.results[0].declarations.exposure, 'DECLARED_HELD_OUT');
  assert.equal(run(row()).results[0].declarations.exposure, 'UNKNOWN');
});

test('duplicate JSON members including escaped equal names cannot overwrite labels', () => {
  for (const text of [corpus([]).replace('"cases":', '"cases":[],"cases":'),
    corpus([row()]).replace('"status":"INTENT"', '"status":"REJECTED","sta\\u0074us":"INTENT"')])
    assert.throws(() => score(text), { code: 'DUPLICATE_JSON_MEMBER' });
});

test('invalid labels and missing rows reject the whole corpus rather than changing denominators', () => {
  for (const change of [rows => rows.push(structuredClone(rows[0])), rows => rows.push(null),
    rows => { delete rows[0].expected; }, rows => { rows[0].expected.recipients.push(expectedBinding(0)); },
    rows => { rows[0].expected.targetId = 'stray'; }, rows => { rows[0].ambiguous = true; },
    rows => { rows[0].expected.action = 'FIRE'; }, rows => { rows[0].expected.recipients = []; },
    rows => { rows[0].exposure = 'VERIFIED_HELD_OUT'; }, rows => { rows[0].request.command = 'execute'; }]) {
    const rows = [row()]; change(rows); assert.throws(() => score(corpus(rows)));
  }
});

test('text/byte/case/depth/nonfinite bounds reject before scoring', () => {
  assert.throws(() => score(Buffer.from(corpus([]))), { code: 'INVALID_CORPUS_TEXT' });
  assert.throws(() => score('not JSON'), { code: 'INVALID_CORPUS_JSON' });
  assert.throws(() => score(' '.repeat(limits.bytes + 1)), { code: 'CORPUS_BYTE_LIMIT' });
  assert.throws(() => score(corpus(Array.from({ length: 257 }, (_, i) => row({ id: `case-${i}` })))), { code: 'CORPUS_CASE_LIMIT' });
  assert.throws(() => score(corpus([row()]).replace('"generation":0', '"generation":1e999')), { code: 'NONFINITE_CORPUS_NUMBER' });
  let nested = null; for (let i = 0; i < 18; i++) nested = [nested];
  assert.throws(() => score(corpus([row({ request: { ...row().request, bindings: nested } })])), { code: 'CORPUS_STRUCTURE_LIMIT' });
});

async function cli(args, bytes = Buffer.from(corpus([row()]))) {
  const reads = [], output = [], errors = [];
  const exitCode = await runCommandTranscriptCli(args, { readInput: async file => { reads.push(file); return bytes; },
    stdout: text => output.push(text), stderr: text => errors.push(text) });
  return { exitCode, reads, output: output.join(''), errors: errors.join('') };
}
test('CLI injected entrypoint uses the real scorer, one explicit input and stdout only', async () => {
  const result = await cli(['--input', 'explicit-corpus.json']);
  assert.equal(result.exitCode, 0); assert.deepEqual(result.reads, ['explicit-corpus.json']); assert.equal(result.errors, '');
  assert.equal(JSON.parse(result.output).summary.commands.jointCorrect, 1);
  const mismatch = row(); mismatch.expected.recipients = [expectedBinding(1)];
  assert.equal((await cli(['--input', 'explicit-corpus.json'], Buffer.from(corpus([mismatch])))).exitCode, 1);
  const empty = await cli(['--input', 'empty.json'], Buffer.from(corpus([])));
  assert.equal(empty.exitCode, 0); assert.equal(JSON.parse(empty.output).status, 'NO_CASES');
});

test('CLI help/usage avoid reads and malformed UTF8/oversized bytes have no scored output', async () => {
  const help = await cli(['--help']); assert.equal(help.exitCode, 0); assert.deepEqual(help.reads, []);
  for (const args of [[], ['--output', 'file'], ['--input'], ['--input', 'a', '--input', 'b']]) {
    const result = await cli(args); assert.equal(result.exitCode, 2); assert.deepEqual(result.reads, []);
  }
  for (const bytes of [Uint8Array.from([0xc3, 0x28]), Buffer.alloc(limits.bytes + 1), Buffer.from('\ufeff' + corpus([]))]) {
    const result = await cli(['--input', 'supplied.json'], bytes);
    assert.equal(result.exitCode, 2); assert.equal(result.output, '');
  }
});

test('actual bounded reader preserves a local input and rejects oversized/directory inputs', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'mw5-command-score-'));
  t.after(async () => {
    assert.equal(path.dirname(path.resolve(directory)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(directory).startsWith('mw5-command-score-'));
    await fs.rm(directory, { recursive: true, force: true });
  });
  const file = path.join(directory, 'corpus.json'), bytes = Buffer.from(corpus([row()]));
  await fs.writeFile(file, bytes, { flag: 'wx' });
  assert.deepEqual(await readBoundedCommandCorpus(file), bytes); assert.deepEqual(await fs.readFile(file), bytes);
  await assert.rejects(readBoundedCommandCorpus(directory), { code: 'INPUT_NOT_REGULAR_LOCAL_FILE' });
  const large = path.join(directory, 'too-large.json'); await fs.writeFile(large, Buffer.alloc(limits.bytes + 1), { flag: 'wx' });
  await assert.rejects(readBoundedCommandCorpus(large), { code: 'CORPUS_BYTE_LIMIT' });
  await assert.rejects(readBoundedCommandCorpus('\\\\never-contact\\share\\corpus.json'), { code: 'INVALID_INPUT_PATH' });
});

test('known process/network entrypoints are not invoked by pure replay or CLI with injected input', async t => {
  const attempts = [], deny = name => () => { attempts.push(name); throw Error('FORBIDDEN_TEST_OPERATION'); };
  for (const key of ['spawn', 'exec', 'fork']) t.mock.method(childProcess, key, deny(key));
  t.mock.method(net, 'connect', deny('net.connect')); t.mock.method(net.Server.prototype, 'listen', deny('net.listen'));
  t.mock.method(globalThis, 'fetch', deny('fetch'));
  const result = await cli(['--input', 'only-input.json']);
  assert.equal(result.exitCode, 0); assert.deepEqual(attempts, []);
  // These reviewed entrypoint guards are not an OS-wide activity monitor.
});
