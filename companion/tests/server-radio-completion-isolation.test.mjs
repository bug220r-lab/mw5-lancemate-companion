import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createWorkbench } from '../server.mjs';

async function fixture(t) {
  const activity = [];
  const forbidden = name => () => { activity.push(name); throw new Error(`Unexpected ${name}`); };
  const stopped = () => ({ state: 'STOPPED', busy: false, ownsProcess: false, processStopConfirmed: true });
  const engine = {
    status: stopped, getState: stopped, stop: async () => {}, dispose: async () => {},
    start: forbidden('engine start'), generate: forbidden('generation'),
    transcribe: forbidden('transcription'), synthesize: forbidden('synthesis'),
  };
  const resources = { status: () => ({}), admit: forbidden('resource admission'),
    startWatch: forbidden('resource watcher'), stopWatch: () => {} };
  t.after(() => assert.deepEqual(activity, []));
  return createWorkbench({
    // A file cannot be a parent directory. Never consult installed user settings.
    settingsPath: path.join(fileURLToPath(import.meta.url), 'unavailable-settings.json'),
    realNow: () => 10000, languageModel: engine, speechEngine: engine, recognitionEngine: engine,
    resourcePolicy: resources, readAudioFile: forbidden('audio read'),
  });
}

const demo = workbench => workbench.act({ type: 'demo' });
const radio = (workbench, actorId) => workbench.act({ type: 'radio', actorId });
const complete = (workbench, lineId) => workbench.act({ type: 'radio_complete', lineId });

test('a delayed authored completion after a demo reset cannot clear the new speaker', async t => {
  const workbench = await fixture(t);
  await demo(workbench);
  const old = (await radio(workbench, 'alpha')).radio.playing;
  await demo(workbench);
  const current = (await radio(workbench, 'bravo')).radio.playing;
  assert.notEqual(old.session, current.session);

  const stale = await complete(workbench, old.lineId);
  assert.deepEqual(stale.last, { status: 'REJECTED', reason: 'NOT_PLAYING' });
  assert.equal(stale.radio.playing.lineId, current.lineId);
  assert.equal(stale.radio.playing.speakerId, 'bravo');
  const finished = await complete(workbench, current.lineId);
  assert.equal(finished.last.status, 'COMPLETED');
  assert.equal(finished.radio.playing, null);
});

test('a completion from another workbench cannot clear the current line even when demo clocks and session labels match', async t => {
  const first = await fixture(t), second = await fixture(t);
  await demo(first);
  await demo(second);
  const foreign = (await radio(first, 'alpha')).radio.playing;
  const current = (await radio(second, 'bravo')).radio.playing;
  assert.equal(foreign.session, current.session);

  const stale = await complete(second, foreign.lineId);
  assert.deepEqual(stale.last, { status: 'REJECTED', reason: 'NOT_PLAYING' });
  assert.equal(stale.radio.playing.lineId, current.lineId);
  assert.equal(first.state().radio.playing.lineId, foreign.lineId);
  assert.equal((await complete(first, foreign.lineId)).last.status, 'COMPLETED');
  assert.equal((await complete(second, current.lineId)).last.status, 'COMPLETED');
});

test('a current completion advances once and a repeated completion cannot clear its successor', async t => {
  const workbench = await fixture(t);
  await demo(workbench);
  const old = (await radio(workbench, 'alpha')).radio.playing;
  const queued = await radio(workbench, 'bravo');
  assert.equal(queued.radio.playing.lineId, old.lineId);
  const successor = queued.radio.queue[0];
  assert.equal(successor.speakerId, 'bravo');

  const first = await complete(workbench, old.lineId);
  assert.equal(first.last.status, 'COMPLETED');
  assert.equal(first.radio.playing.lineId, successor.lineId);
  const duplicate = await complete(workbench, old.lineId);
  assert.deepEqual(duplicate.last, { status: 'REJECTED', reason: 'NOT_PLAYING' });
  assert.equal(duplicate.radio.playing.lineId, successor.lineId);
  assert.equal((await complete(workbench, successor.lineId)).radio.playing, null);
});
