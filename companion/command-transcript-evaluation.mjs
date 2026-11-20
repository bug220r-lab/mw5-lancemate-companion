// Pure supplied-transcript replay. No recognition, device, model or dispatch API.
import { createHash } from 'node:crypto';
import { parseSpokenCommand } from './radio.mjs';
import { duplicateJsonMemberStatus } from './json-member-names.mjs';

export const COMMAND_TRANSCRIPT_LIMITS = Object.freeze({ bytes: 1024 * 1024, cases: 256,
  depth: 16, nodes: 50000, stringUnits: 8192 });
export const COMMAND_TRANSCRIPT_CLASSIFICATION = 'SUPPLIED_TRANSCRIPT_REPLAY_ONLY';
const actions = new Set(['REGROUP', 'FOCUS', 'REPOSITION', 'RELEASE_HUMAN_HOLD', 'DISARM']);
const outcomes = new Set(['INTENT', 'CLARIFICATION', 'REJECTED']);
const requestKeys = new Set(['text', 'origin', 'final', 'session', 'bindings', 'callsigns', 'selectedTargetId', 'locations']);
const fault = code => Object.assign(new Error(code), { code });
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const id = value => typeof value === 'string' && /^[A-Za-z0-9_.:-]{1,128}$/.test(value);
const reference = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 512;
const need = (condition, code = 'INVALID_CORPUS_SCHEMA') => { if (!condition) throw fault(code); };
function keys(value, required, optional = []) {
  return record(value) && required.every(key => Object.hasOwn(value, key)) &&
    Object.keys(value).every(key => required.includes(key) || optional.includes(key));
}
function finiteStructure(value) {
  const stack = [[value, 0]]; let nodes = 0;
  while (stack.length) {
    const [item, depth] = stack.pop();
    need(++nodes <= COMMAND_TRANSCRIPT_LIMITS.nodes && depth <= COMMAND_TRANSCRIPT_LIMITS.depth, 'CORPUS_STRUCTURE_LIMIT');
    if (typeof item === 'number') need(Number.isFinite(item), 'NONFINITE_CORPUS_NUMBER');
    else if (typeof item === 'string') need(item.length <= COMMAND_TRANSCRIPT_LIMITS.stringUnits && item.isWellFormed(), 'CORPUS_STRING_LIMIT');
    else if (item !== null && typeof item === 'object') {
      for (const [key, child] of Object.entries(item)) {
        need(key.length <= COMMAND_TRANSCRIPT_LIMITS.stringUnits && key.isWellFormed(), 'CORPUS_STRING_LIMIT');
        stack.push([child, depth + 1]);
      }
    }
  }
}
function validateExpected(expected) {
  need(record(expected) && outcomes.has(expected.status));
  if (expected.status !== 'INTENT') {
    need(keys(expected, ['status', 'reason']) && typeof expected.reason === 'string' && /^[A-Z_]{1,96}$/.test(expected.reason));
    return;
  }
  need(keys(expected, ['status', 'action', 'recipients'], ['targetId', 'locationId', 'scope']) && actions.has(expected.action));
  need(Array.isArray(expected.recipients) && expected.recipients.length <= 3);
  for (const binding of expected.recipients) need(keys(binding, ['id', 'pawnId', 'generation']) &&
    id(binding.id) && id(binding.pawnId) && Number.isSafeInteger(binding.generation) && binding.generation >= 0);
  need(new Set(expected.recipients.map(binding => binding.id)).size === expected.recipients.length &&
    new Set(expected.recipients.map(binding => binding.pawnId)).size === expected.recipients.length, 'DUPLICATE_EXPECTED_RECIPIENT');
  const globalDisarm = expected.action === 'DISARM' && expected.recipients.length === 0;
  need(globalDisarm || expected.recipients.length >= 1);
  need(globalDisarm ? expected.scope === 'ALL_COMPANION_CONTROL' : !Object.hasOwn(expected, 'scope'));
  need(expected.action === 'FOCUS' ? id(expected.targetId) : !Object.hasOwn(expected, 'targetId'));
  need(expected.action === 'REPOSITION' ? id(expected.locationId) : !Object.hasOwn(expected, 'locationId'));
}
function validateCorpus(corpus) {
  need(keys(corpus, ['schemaVersion', 'cases']) && corpus.schemaVersion === 1 && Array.isArray(corpus.cases));
  need(corpus.cases.length <= COMMAND_TRANSCRIPT_LIMITS.cases, 'CORPUS_CASE_LIMIT');
  const ids = new Set();
  for (const row of corpus.cases) {
    need(keys(row, ['id', 'sourceKind', 'sourceRef', 'annotationRef', 'ambiguous', 'request', 'expected'], ['exposure']));
    need(id(row.id) && !ids.has(row.id), 'INVALID_OR_DUPLICATE_CASE_ID'); ids.add(row.id);
    need(['SYNTHETIC', 'SUPPLIED_TRANSCRIPT'].includes(row.sourceKind) && reference(row.sourceRef) && reference(row.annotationRef));
    need(typeof row.ambiguous === 'boolean' && (!Object.hasOwn(row, 'exposure') || ['EXPOSED', 'DECLARED_HELD_OUT', 'UNKNOWN'].includes(row.exposure)));
    need(record(row.request) && Object.keys(row.request).every(key => requestKeys.has(key)));
    // Values remain supplied parser inputs, including deliberately invalid fields.
    // Never repair a transcript, add trust labels, or derive expected labels here.
    validateExpected(row.expected);
    need(!(row.ambiguous && row.expected.status === 'INTENT'), 'AMBIGUOUS_EXPECTED_INTENT');
  }
}
const equalSet = (left, right) => left.length === right.length &&
  new Set(left).size === left.length && new Set(right).size === right.length &&
  left.every(item => right.includes(item));
const bindingKeys = bindings => bindings.map(binding => JSON.stringify([binding.id, binding.pawnId, binding.generation]));
function argumentsFor(value) {
  return JSON.stringify(['targetId', 'locationId', 'scope'].map(key => [Object.hasOwn(value, key), value[key] ?? null]));
}
function compare(row) {
  let actual;
  try { actual = parseSpokenCommand(row.request); } catch { throw fault('PARSER_REPLAY_FAILED'); }
  need(record(actual) && outcomes.has(actual.status), 'PARSER_REPLAY_FAILED');
  const expected = row.expected, command = expected.status === 'INTENT', actualIntent = actual.status === 'INTENT';
  const checks = { status: actual.status === expected.status,
    action: command ? actualIntent && actual.action === expected.action : null,
    recipientIds: command ? actualIntent && equalSet(expected.recipients.map(binding => binding.id), actual.recipientIds) : null,
    recipientBindings: command ? actualIntent && equalSet(bindingKeys(expected.recipients), bindingKeys(actual.bindings)) : null,
    arguments: command ? actualIntent && argumentsFor(actual) === argumentsFor(expected) : null,
    reason: command ? null : actual.status === expected.status && actual.reason === expected.reason };
  const matched = Object.values(checks).every(value => value === null || value === true);
  return { id: row.id,
    declarations: { sourceKind: row.sourceKind, sourceRef: row.sourceRef, annotationRef: row.annotationRef,
      exposure: row.exposure ?? 'UNKNOWN', ambiguous: row.ambiguous, verified: false },
    request: row.request, expected, actual, checks, matched,
    differences: Object.entries(checks).filter(([, value]) => value === false).map(([key]) => key),
    withheldOutcome: actual.status === 'CLARIFICATION' || actual.status === 'REJECTED',
    unexpectedIntentProduced: expected.status !== 'INTENT' && actualIntent,
    ambiguousIntentProduced: row.ambiguous && actualIntent };
}
const rate = (correct, count) => count ? correct / count : null;
function summarize(results) {
  const commands = results.filter(row => row.expected.status === 'INTENT');
  const group = status => {
    const rows = results.filter(row => row.expected.status === status);
    return { count: rows.length, statusMatched: rows.filter(row => row.checks.status).length,
      reasonMatched: rows.filter(row => row.checks.reason).length, matched: rows.filter(row => row.matched).length,
      withheldOutcomes: rows.filter(row => row.withheldOutcome).length,
      matchRate: rate(rows.filter(row => row.matched).length, rows.length) };
  };
  return { cases: results.length, matched: results.filter(row => row.matched).length,
    mismatched: results.filter(row => !row.matched).length,
    commands: { count: commands.length, actionCorrect: commands.filter(row => row.checks.action).length,
      recipientIdsCorrect: commands.filter(row => row.checks.recipientIds).length,
      recipientBindingsCorrect: commands.filter(row => row.checks.recipientBindings).length,
      argumentsCorrect: commands.filter(row => row.checks.arguments).length,
      jointCorrect: commands.filter(row => row.matched).length,
      jointAccuracy: rate(commands.filter(row => row.matched).length, commands.length) },
    clarifications: group('CLARIFICATION'), rejections: group('REJECTED'),
    withheldOutcomes: results.filter(row => row.withheldOutcome).length,
    ambiguousCases: results.filter(row => row.declarations.ambiguous).length,
    ambiguousIntentsProduced: results.filter(row => row.ambiguousIntentProduced).length,
    unexpectedIntentsProduced: results.filter(row => row.unexpectedIntentProduced).length };
}

/** JSON text is the only input seam; labels/contexts never authenticate evidence. */
export function scoreCommandTranscriptCorpus(source) {
  need(typeof source === 'string' && source.isWellFormed(), 'INVALID_CORPUS_TEXT');
  need(Buffer.byteLength(source, 'utf8') <= COMMAND_TRANSCRIPT_LIMITS.bytes, 'CORPUS_BYTE_LIMIT');
  let corpus;
  try { corpus = JSON.parse(source); } catch { throw fault('INVALID_CORPUS_JSON'); }
  const duplicate = duplicateJsonMemberStatus(source);
  need(duplicate === null, duplicate ?? 'INVALID_CORPUS_JSON');
  finiteStructure(corpus); validateCorpus(corpus);
  const results = corpus.cases.map(compare);
  return { schemaVersion: 1, classification: COMMAND_TRANSCRIPT_CLASSIFICATION,
    status: results.length ? 'SCORED' : 'NO_CASES',
    inputSha256: createHash('sha256').update(source, 'utf8').digest('hex'),
    declarationsVerified: false,
    execution: { parserReplay: results.length ? 'PERFORMED' : 'NOT_PERFORMED', recognition: 'NOT_PERFORMED',
      dispatch: 'NOT_PERFORMED', latencyMeasurement: 'NOT_PERFORMED', nativeAcceptance: 'NOT_PERFORMED', releaseAcceptance: 'NOT_PERFORMED' },
    summary: summarize(results), results,
    limitations: ['Supplied requests, annotations, references and exposure labels are unverified declarations.',
      'Withheld parser outcomes are distinct from correct interpretation and do not prove native command safety.',
      'No audio, ASR accuracy, human provenance, latency, native dispatch or release acceptance is established.'] };
}
