// Research-only executable model. Every state and dispatch below is synthetic.
// No game, editor, network, microphone, subprocess or native API is accessed.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixturePath = path.join(root, 'synthetic', 'command-cases.json');
const reportPath = path.join(root, 'research', 'OFFLINE_COMMAND_REPORT.json');
const MAX_AGE_MS = 1000;
const COOLDOWN_MS = 2000;
const QUEUE_LIMIT = 2;
const LEDGER_LIMIT = 8; // Deliberately small to exercise saturation; not runtime tuning.
const commandKeys = ['protocolVersion', 'id', 'session', 'actorHandle',
  'bindingGeneration', 'action', 'observedSequence', 'manualRevision', 'ttlMs'];
const stateKeys = ['session', 'sequence', 'sampleAtMs', 'phase', 'authority',
  'formCapability', 'manualObservable', 'manualRevision', 'actorHandle',
  'bindingGeneration', 'aiOwned', 'alive', 'connected'];
const integer = (v) => Number.isSafeInteger(v) && v >= 0;
const handle = (v) => typeof v === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(v);
const object = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const signature = (c) => JSON.stringify(commandKeys.map((k) => c[k]));

function malformed(c) {
  return !object(c) || JSON.stringify(c).length > 1024 ||
    Object.keys(c).length !== commandKeys.length || Object.keys(c).some((k) => !commandKeys.includes(k)) ||
    c.protocolVersion !== 1 || !handle(c.id) || !handle(c.session) || !handle(c.actorHandle) ||
    !integer(c.bindingGeneration) || c.bindingGeneration === 0 ||
    c.action !== 'FORM_ON_PLAYER' || !integer(c.observedSequence) || !integer(c.manualRevision) ||
    !integer(c.ttlMs) || c.ttlMs < 1 || c.ttlMs > MAX_AGE_MS;
}

function exercise(initial, steps) {
  let state = structuredClone(initial);
  let now = 0;
  let observationFault = !integer(state.sequence) || !integer(state.sampleAtMs) || state.sampleAtMs > now
    ? 'INVALID_SAMPLE' : null;
  let highestSequence = integer(state.sequence) ? state.sequence : null;
  let latestSampleAt = integer(state.sampleAtMs) && state.sampleAtMs <= now ? state.sampleAtMs : null;
  let highestManualRevision = state.manualObservable === true && integer(state.manualRevision)
    ? state.manualRevision : null;
  let armed = false;
  let lastDispatchAt = null;
  let queue = [];
  const ledger = new Map();
  const seenSessions = new Set([state.session]);
  const events = [];
  let dispatchCount = 0;
  const emit = (type, id = null, detail = null) => events.push({ atMs: now, type, id, detail });
  const finish = (entry, reason) => {
    entry.stage = 'rejected'; entry.reason = reason;
    emit('rejected', entry.command.id, reason);
  };
  const revoke = (reason) => {
    armed = false;
    for (const entry of queue) finish(entry, reason);
    queue = [];
    emit('disarmed', null, reason);
  };
  function unsafe() {
    if (observationFault) return observationFault;
    if (!handle(state.session)) return 'UNKNOWN_SESSION';
    if (state.connected !== true) return 'DISCONNECTED';
    if (state.phase !== 'active') return 'INACTIVE_MISSION';
    if (state.authority !== true) return 'UNKNOWN_AUTHORITY';
    if (state.formCapability !== true) return 'CAPABILITY_UNAVAILABLE';
    if (state.manualObservable !== true || !integer(state.manualRevision)) return 'MANUAL_OBSERVATION_UNKNOWN';
    if (!handle(state.actorHandle) || !integer(state.bindingGeneration) || state.bindingGeneration === 0) return 'UNKNOWN_BINDING';
    if (state.aiOwned !== true || state.alive !== true) return 'NOT_LIVE_AI';
    if (!integer(state.sequence) || !integer(state.sampleAtMs) || state.sampleAtMs > now) return 'INVALID_SAMPLE';
    if (now - state.sampleAtMs > MAX_AGE_MS) return 'STALE_SAMPLE';
    return null;
  }
  function observationIssue(candidate) {
    if (!integer(candidate.sequence) || !integer(candidate.sampleAtMs) || candidate.sampleAtMs > now) return 'INVALID_SAMPLE';
    const booleanFields = ['authority', 'formCapability', 'manualObservable', 'aiOwned', 'alive', 'connected'];
    if (booleanFields.some((key) => candidate[key] !== null && typeof candidate[key] !== 'boolean') ||
      typeof candidate.phase !== 'string' || candidate.phase.length > 32 ||
      (candidate.manualRevision !== null && !integer(candidate.manualRevision)) ||
      (candidate.actorHandle !== null && !handle(candidate.actorHandle)) ||
      (candidate.bindingGeneration !== null && (!integer(candidate.bindingGeneration) || candidate.bindingGeneration === 0))) return 'INVALID_OBSERVATION';
    if ((highestSequence !== null && candidate.sequence < highestSequence) ||
      (latestSampleAt !== null && candidate.sampleAtMs < latestSampleAt) ||
      (highestSequence !== null && candidate.sequence === highestSequence &&
        latestSampleAt !== null && candidate.sampleAtMs !== latestSampleAt) ||
      (highestManualRevision !== null && integer(candidate.manualRevision) &&
        candidate.manualRevision < highestManualRevision)) return 'OBSERVATION_REGRESSION';
    if (now - candidate.sampleAtMs > MAX_AGE_MS) return 'STALE_SAMPLE';
    if (observationFault && highestSequence !== null && candidate.sequence <= highestSequence) return 'OBSERVATION_RECOVERY_REQUIRED';
    return null;
  }
  function guard(command) {
    const unsafeReason = unsafe();
    if (unsafeReason) return unsafeReason;
    if (!armed) return 'DISARMED';
    if (command.session !== state.session) return 'WRONG_SESSION';
    if (command.actorHandle !== state.actorHandle || command.bindingGeneration !== state.bindingGeneration) return 'WRONG_BINDING';
    if (command.observedSequence !== state.sequence) return 'SNAPSHOT_CHANGED';
    if (command.manualRevision !== state.manualRevision) return 'MANUAL_REVISION_CHANGED';
    return null;
  }
  for (const step of steps) {
    if (!object(step)) throw new Error('Step must be an object');
    switch (step.op) {
      case 'advance':
        if (!integer(step.ms) || !Number.isSafeInteger(now + step.ms)) throw new Error('INVALID_TIME_ADVANCE');
        now += step.ms;
        break;
      case 'arm': {
        const reason = unsafe();
        if (reason) { armed = false; emit('arm_rejected', null, reason); }
        else { armed = true; emit('armed'); }
        break;
      }
      case 'disarm': revoke('USER_DISARM'); break;
      case 'observe': {
        if (!object(step.patch) || Object.keys(step.patch).some((k) => !stateKeys.includes(k) || k === 'session')) throw new Error('INVALID_OBSERVATION_PATCH');
        const old = state;
        const candidate = { ...state, ...step.patch };
        // Validate chronology even when a simultaneous pause/unknown signal would revoke writes.
        const issue = observationIssue(candidate);
        if (issue) {
          observationFault = 'OBSERVATION_FAULT';
          emit('observation_rejected', null, issue);
          revoke(issue);
          break;
        }
        state = candidate;
        highestSequence = state.sequence;
        latestSampleAt = state.sampleAtMs;
        // Unknown/null observations never erase the last known revision within this epoch.
        if (state.manualObservable === true && integer(state.manualRevision)) highestManualRevision = state.manualRevision;
        observationFault = null;
        const reason = unsafe();
        if (reason) revoke(reason);
        else if (state.manualRevision !== old.manualRevision) revoke('HUMAN_OVERRIDE');
        else if (state.actorHandle !== old.actorHandle || state.bindingGeneration !== old.bindingGeneration) revoke('BINDING_CHANGED');
        break;
      }
      case 'new_session':
        if (!handle(step.session)) throw new Error('INVALID_NEW_SESSION');
        if (seenSessions.has(step.session)) throw new Error('REUSED_SESSION_ID');
        seenSessions.add(step.session);
        revoke('SESSION_CHANGED');
        ledger.clear();
        state = { ...state, session: step.session, sequence: 0, sampleAtMs: null,
          actorHandle: null, bindingGeneration: null, manualRevision: null, manualObservable: false,
          phase: 'unknown', authority: null, formCapability: null,
          aiOwned: null, alive: null, connected: false };
        observationFault = null;
        highestSequence = null;
        latestSampleAt = null;
        highestManualRevision = null;
        // Keep cooldown across session/rearm events; resetting it could bypass limits.
        emit('session_changed', null, step.session);
        break;
      case 'receive': {
        const command = step.command;
        if (malformed(command)) { emit('rejected', typeof command?.id === 'string' ? command.id.slice(0, 64) : null, 'MALFORMED_COMMAND'); break; }
        if (command.session !== state.session) { emit('rejected', command.id, 'WRONG_SESSION'); break; }
        const prior = ledger.get(command.id);
        if (prior) {
          if (prior.signature !== signature(command)) emit('rejected', command.id, 'ID_REUSE_MISMATCH');
          else emit('duplicate_history', command.id, { stage: prior.stage, reason: prior.reason ?? null });
          break;
        }
        if (ledger.size >= LEDGER_LIMIT) { revoke('LEDGER_FULL'); emit('rejected', command.id, 'LEDGER_FULL'); break; }
        const entry = { command: structuredClone(command), signature: signature(command),
          expiresAt: now + command.ttlMs, stage: 'queued' };
        ledger.set(command.id, entry);
        const reason = guard(command);
        if (reason) { finish(entry, reason); break; }
        if (queue.length >= QUEUE_LIMIT) { finish(entry, 'QUEUE_FULL'); break; }
        queue.push(entry);
        emit('queued', command.id);
        break;
      }
      case 'dispatch': {
        const entry = queue.shift();
        if (!entry) { emit('queue_empty'); break; }
        let reason = now >= entry.expiresAt ? 'EXPIRED' : guard(entry.command);
        if (!reason && lastDispatchAt !== null && now - lastDispatchAt < COOLDOWN_MS) reason = 'RATE_LIMITED';
        if (reason) { finish(entry, reason); break; }
        entry.stage = 'mock_dispatch';
        lastDispatchAt = now;
        dispatchCount += 1;
        emit('mock_dispatch', entry.command.id, 'NO_NATIVE_CALL');
        break;
      }
      case 'uncertain': {
        const entry = ledger.get(step.id);
        if (!entry || entry.stage !== 'mock_dispatch') throw new Error('INVALID_UNCERTAIN_REFERENCE');
        entry.stage = 'unconfirmed'; entry.reason = 'OUTCOME_UNKNOWN';
        revoke('OUTCOME_UNKNOWN');
        emit('unconfirmed', step.id, 'NO_RETRY');
        break;
      }
      default: throw new Error(`Unknown fixture operation: ${String(step.op)}`);
    }
  }
  return { dispatchCount, armed, queued: queue.length, ledgerSize: ledger.size, events };
}

const fixtureText = fs.readFileSync(fixturePath, 'utf8');
if (Buffer.byteLength(fixtureText) > 1024 * 1024) throw new Error('Fixture exceeds 1 MiB');
const fixture = JSON.parse(fixtureText.replace(/^\uFEFF/, ''));
if (fixture.evidenceClass !== 'SYNTHETIC' || !Array.isArray(fixture.cases) || !object(fixture.initialState)) throw new Error('Invalid fixture');
const ids = new Set();
const results = fixture.cases.map((test) => {
  if (!handle(test.id) || ids.has(test.id) || !Array.isArray(test.steps)) throw new Error('Invalid or duplicate case ID');
  ids.add(test.id);
  let actual;
  try { actual = exercise({ ...fixture.initialState, ...test.initialPatch }, test.steps); }
  catch (error) {
    if (!test.expectedError) throw error;
    return { id: test.id, title: test.title, expectationMet: error.message === test.expectedError, expectedError: test.expectedError, actualError: error.message };
  }
  if (test.expectedError) {
    return { id: test.id, title: test.title, expectationMet: false,
      expectedError: test.expectedError, actualError: null, actual };
  }
  const assertions = [];
  assertions.push({ name: 'dispatchCount', met: actual.dispatchCount === test.expected.dispatchCount });
  for (const key of ['armed', 'queued', 'ledgerSize']) {
    if (Object.hasOwn(test.expected, key)) assertions.push({ name: key, met: actual[key] === test.expected[key] });
  }
  for (const event of test.expected.events ?? []) {
    assertions.push({ name: `${event.type}:${event.id ?? '*'}:${event.detail ?? '*'}`,
      met: actual.events.some((e) => e.type === event.type &&
        (!Object.hasOwn(event, 'id') || e.id === event.id) &&
        (!Object.hasOwn(event, 'detail') || JSON.stringify(e.detail) === JSON.stringify(event.detail))) });
  }
  return { id: test.id, title: test.title, expectationMet: assertions.every((a) => a.met), assertions, actual };
});
const sha = (text) => createHash('sha256').update(text).digest('hex');
const report = {
  schemaVersion: 1, evidenceClass: 'MOCK_ONLY', observedAt: new Date().toISOString(),
  question: 'Do these synthetic traces satisfy the proposed command arbitration rules?',
  result: results.every((r) => r.expectationMet) ? 'EXPECTATIONS_MET' : 'EXPECTATIONS_NOT_MET',
  cases: results.length, expectationsMet: results.filter((r) => r.expectationMet).length,
  nativeCallsPerformed: 0, gameIntegration: 'NOT_PERFORMED',
  fixturesSha256: sha(fixtureText), scriptSha256: sha(fs.readFileSync(fileURLToPath(import.meta.url))),
  limits: ['All observations and dispatches are synthetic.',
    'No native field, manual-order hook, transport, game identity or runtime behavior is established.',
    'The model rejects writes when manual-order observation is unknown.',
    'Single actor/action, single model-owned clock, no concurrency or process/network behavior tested.',
    'Ledger/queue sizes and timing values are evaluation settings, not production performance claims.'],
  results,
};
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({ evidenceClass: report.evidenceClass, result: report.result,
  cases: report.cases, expectationsMet: report.expectationsMet, report: reportPath }));
process.exitCode = report.result === 'EXPECTATIONS_MET' ? 0 : 1;
