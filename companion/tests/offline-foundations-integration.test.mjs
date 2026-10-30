// Actual offline modules together. No HTTP listener, native adapter, model or device.
// Observation envelopes below are explicit project fixtures, not a raw-native conversion.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ControlSession } from '../control.mjs';
import { parseSpokenCommand } from '../radio.mjs';
import { auditRecordingBytes, RECORDING_LIMITS } from '../recording-audit.mjs';
import { auditPassiveCaptureBytes } from '../passive-capture.mjs';
import { replayFrames } from '../observation.mjs';
import { createWorkbench } from '../server.mjs';
import { baseline } from '../../synthetic/tactical-cases.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
function frame(sequence, at, change = () => {}) {
  const snapshot = baseline();
  snapshot.sequence = sequence; snapshot.observedAtMs = snapshot.nowMs = at;
  snapshot.targets[0].observedAtMs = at; snapshot.lancemates[0].id = 'kite';
  change(snapshot, snapshot.lancemates[0]);
  return { schemaVersion: 1, kind: 'observation', provenance: 'MOCK_ONLY',
    adapterId: 'offline-foundations-integration', session: snapshot.session,
    sequence, observedAtMs: at, snapshot };
}
const parserBindings = f => f.snapshot.lancemates.map((a, i) => ({ id: a.id,
  pawnId: a.pawnId, generation: a.generation, slot: i + 1, alive: a.alive, aiOwned: a.aiOwned }));

test('parser preview, uncertain submission, human hold and historical replay preserve their boundaries', () => {
  let clock = 1000;
  const effects = [], frames = [frame(1, clock)];
  const control = new ControlSession({ mode: 'MOCK_ONLY', now: () => clock,
    mockSink: intent => { effects.push(intent); throw new Error('effect then unknown outcome'); } });
  assert.equal(control.ingest(frames[0]).ok, true);
  const before = control.getState();
  const request = text => parseSpokenCommand({ text, origin: 'human_ptt', final: true,
    session: frames[0].session, bindings: parserBindings(frames[0]), selectedTargetId: 'enemy1' });
  const wrongSpelling = request('focus actor \u212Aite');
  assert.ok(['REJECTED', 'CLARIFICATION'].includes(wrongSpelling.status));
  assert.equal(wrongSpelling.recipientIds, undefined);
  const preview = request('FOCUS ACTOR KITE');
  assert.equal(preview.status, 'INTENT'); assert.deepEqual(preview.recipientIds, ['kite']);
  assert.equal(preview.dispatchable, false); assert.deepEqual(control.getState(), before);
  assert.equal(control.queueRecommendations().queued.length, 0);
  assert.equal(effects.length, 0);

  // Explicit fixture arming, not an implemented parser-to-dispatch route.
  assert.equal(control.armSimulation(['kite']).armed, true);
  assert.equal(control.queueRecommendations().queued.length, 1);
  const outcome = control.drainSimulation()[0];
  assert.equal(outcome.status, 'UNCONFIRMED'); assert.equal(outcome.nativeAcceptance, 'NOT_PERFORMED');
  assert.equal(control.getState().armed, false); assert.equal(effects.length, 1);

  clock = 3100; frames.push(frame(2, clock));
  assert.equal(control.ingest(frames[1]).ok, true); control.armSimulation(['kite']);
  assert.equal(control.queueRecommendations().rejected[0].reason, 'UNCONFIRMED_PRIOR_ACTION');
  assert.deepEqual(control.drainSimulation(), []); assert.equal(effects.length, 1);

  clock = 3200; frames.push(frame(3, clock, (_, a) => {
    a.manual = { observable: true, revision: 1, orderId: 'human-hold', status: 'active', persistent: true };
  }));
  assert.equal(control.ingest(frames[2]).ok, true);
  const heldState = control.getState().policyState;
  assert.equal(heldState.actors.kite.heldHumanOrder.id, 'human-hold');
  const entry = control.getState().ledger[0];
  assert.equal(control.observeSimulatedResult({ id: entry.id, session: entry.session,
    actorId: entry.actorId, binding: entry.binding, classification: 'MOCK_ONLY',
    stage: 'COMPLETED', observedAtMs: clock, evidence: 'correlated synthetic completion' }).recorded, true);
  assert.deepEqual(control.getState().policyState, heldState);
  assert.equal(control.queueRecommendations().queued.length, 0); assert.equal(effects.length, 1);
  assert.equal(control.getState().nativeCalls, 0);

  const bytes = Buffer.from(JSON.stringify(frames)), original = Buffer.from(bytes);
  const audit = auditRecordingBytes(bytes, { allowSynthetic: true });
  const replay = replayFrames(frames, { allowSynthetic: true });
  assert.equal(audit.formatStatus, 'VALID_PROJECT_ENVELOPES');
  assert.equal(audit.replay.framesSubmitted, 3); assert.deepEqual(replay.errors, []);
  assert.equal(replay.results.at(-1).decision.state.actors.kite.heldHumanOrder.id, 'human-hold');
  assert.equal(audit.commandsIssued, 0); assert.equal(audit.runtimeAcceptance, 'NOT_PERFORMED');
  assert.equal(audit.sourceSha256, sha(original)); assert.deepEqual(bytes, original);

  const encoded = JSON.stringify(frames[2]);
  const shadowed = Buffer.from(`[${encoded.replace('"manual":',
    '"manual":{"observable":true,"revision":1,"orderId":"human-hold","status":"active","persistent":true},"manual":')}]`);
  const rejected = auditRecordingBytes(shadowed, { allowSynthetic: true });
  assert.equal(rejected.findings[0].code, 'DUPLICATE_JSON_MEMBER'); assert.equal(rejected.replay, null);
  const oversize = Buffer.from(`[${encoded}${' '.repeat(RECORDING_LIMITS.frameBytes - Buffer.byteLength(encoded) + 1)}]`);
  const bounded = auditRecordingBytes(oversize, { allowSynthetic: true });
  assert.equal(bounded.findings[0].code, 'FRAME_TOO_LARGE'); assert.equal(bounded.replay, null);
  assert.equal(effects.length, 1); assert.equal(control.getState().nativeCalls, 0);
});

test('actual in-memory workbench previews never dispatch; settings survive a fresh mission and process object', async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'mw5-foundations-integration-'));
  const settingsPath = path.join(directory, 'settings.json'), instances = [];
  const calls = { starts: 0, transcriptions: 0, generations: 0, syntheses: 0, reads: 0, admissions: 0, watches: 0 };
  const forbidden = name => { calls[name]++; throw new Error(`FORBIDDEN_OFFLINE_INTEGRATION_${name}`); };
  const open = async () => {
    const w = await createWorkbench({ settingsPath, realNow: () => 10000,
      languageModel: { status: () => ({ state: 'STOPPED' }), start: () => forbidden('starts'),
        generate: () => forbidden('generations'), stop: async () => {} },
      speechEngine: { getState: () => ({ state: 'STOPPED' }), start: () => forbidden('starts'),
        synthesize: () => forbidden('syntheses'), stop: async () => {} },
      recognitionEngine: { status: () => ({ state: 'STOPPED', ownsProcess: false }),
        start: () => forbidden('starts'), transcribe: () => forbidden('transcriptions'),
        stop: async () => {}, dispose: async () => {} },
      resourcePolicy: { admit: () => forbidden('admissions'), startWatch: () => forbidden('watches'),
        stopWatch: () => {}, status: () => ({}) }, readAudioFile: () => forbidden('reads') });
    instances.push(w); return w;
  };
  t.after(async () => {
    for (const instance of instances) await instance.dispose();
    assert.ok(Object.values(calls).every(n => n === 0), JSON.stringify(calls));
    const resolved = path.resolve(directory);
    assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith('mw5-foundations-integration-'));
    await rm(resolved, { recursive: true, force: true });
  });
  const w = await open(); assert.equal(w.state().classification, 'DISCONNECTED');
  const first = await w.act({ type: 'demo' }), before = first.control;
  const command = await w.act({ type: 'command', text: 'FOCUS ACTOR ALPHA' });
  assert.equal(command.last.status, 'INTENT'); assert.equal(command.last.dispatchable, false);
  assert.deepEqual(command.control, before);
  assert.equal((await w.act({ type: 'queue' })).control.ledger.length, 0);
  await w.act({ type: 'arm' }); const submitted = await w.act({ type: 'queue' });
  assert.ok(submitted.control.ledger.length > 0);
  assert.ok(submitted.control.ledger.every(e => e.classification === 'MOCK_ONLY' &&
    e.stages.length === 1 && e.stages[0].stage === 'SUBMITTED'));
  const status = await w.act({ type: 'mission_status', actorId: 'alpha' });
  assert.match(status.missionSpeech.text, /submitted\. Acceptance is unconfirmed\.$/);
  assert.equal(status.missionSpeech.audioGenerated, false);
  const hold = await w.act({ type: 'step', actorId: 'alpha', event: 'hold' });
  const held = structuredClone(hold.control);
  const releasePreview = await w.act({ type: 'command', text: 'RELEASE HUMAN HOLD SLOT 1' });
  assert.equal(releasePreview.last.action, 'RELEASE_HUMAN_HOLD');
  assert.deepEqual(releasePreview.control, held);
  assert.ok(releasePreview.control.policyState.actors.alpha.heldHumanOrder);

  const settings = w.state().settings;
  settings.pilots[0].callsign = 'Kite'; settings.quiet = true;
  await w.act({ type: 'settings', settings });
  const reset = await w.act({ type: 'demo' });
  assert.equal(reset.settings.pilots[0].callsign, 'Kite'); assert.equal(reset.settings.quiet, true);
  assert.equal(reset.control.armed, false); assert.deepEqual(reset.control.ledger, []);
  assert.notEqual(reset.control.session, first.control.session);
  assert.equal(reset.control.policyState.actors.alpha.heldHumanOrder, null);
  await w.dispose();
  const reopened = await open(), restored = reopened.state();
  assert.equal(restored.settingsStatus, 'LOADED'); assert.deepEqual(restored.settings, settings);
  assert.equal(restored.classification, 'DISCONNECTED'); assert.deepEqual(restored.control.ledger, []);
  assert.equal(restored.control.session, null); assert.equal(restored.control.nativeCalls, 0);
});

test('raw passive capture uses the same byte admission helpers without becoming tactical authority', async () => {
  const bytes = await readFile(new URL('../../synthetic/passive-capture-example.json', import.meta.url));
  const original = Buffer.from(bytes), report = auditPassiveCaptureBytes(bytes, { allowSynthetic: true });
  assert.equal(report.formatStatus, 'VALID_PROJECT_CAPTURE'); assert.equal(report.classification, 'MOCK_ONLY');
  assert.equal(report.replay, null); assert.equal(report.commandsIssued, 0);
  assert.equal(report.nativeIdentityValidation, 'NOT_PERFORMED');
  assert.equal(report.runtimeAcceptance, 'NOT_PERFORMED');
  assert.equal(report.sourceSha256, sha(original)); assert.deepEqual(bytes, original);
  const source = bytes.toString('utf8').replace('"provenance": "MOCK_ONLY"',
    '"provenance": "GAME_OBSERVED", "provenance": "MOCK_ONLY"');
  assert.notEqual(source, bytes.toString('utf8'));
  const altered = Buffer.from(source), rejected = auditPassiveCaptureBytes(altered, { allowSynthetic: true });
  assert.equal(rejected.formatStatus, 'INVALID');
  assert.equal(rejected.findings[0].code, 'DUPLICATE_JSON_MEMBER');
  assert.equal(rejected.replay, null); assert.equal(rejected.sourceSha256, sha(altered));
});
