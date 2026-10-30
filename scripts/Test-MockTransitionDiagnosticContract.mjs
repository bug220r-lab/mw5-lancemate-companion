// MOCK_ONLY. Built-in Node modules; fake in-memory adapter/sink only. Prints JSON, writes no files.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as model from './Mock-TransitionDiagnosticContract.mjs';

const reference = value => ({ valid: true, identity: () => value });
function harness(module = model, options = {}) {
  const log = [], writes = [], adds = [], removes = [], cleanups = [], listeners = new Map();
  let self = reference('Self'), widget = reference('Widget');
  const adapter = {
    add(identity, callback) {
      adds.push(identity); log.push(`add:${identity.kind}`);
      listeners.set(identity, callback); // Deliberately permit side effects before a failed bind.
      options.onAdd?.(identity, callback);
      if (options.bindThrow === identity.kind) throw Error('mock partial add');
      if (options.bindFalse === identity.kind) return false;
      return true;
    },
    remove(identity) {
      removes.push(identity); log.push(`remove:${identity.kind}`);
      if (options.removeThrow === identity.kind) throw Error('mock remove failure');
      listeners.delete(identity);
      return options.removeFalse !== identity.kind;
    },
  };
  const trace = new module.MockTransitionDiagnosticContract({
    adapter,
    sink(request) {
      writes.push(request); log.push(`write:${request.record.kind}`);
      options.onSink?.(request);
      if (options.sinkThrow || options.sinkThrowKind === request.record.kind) throw Error('mock write failure');
      return options.sinkFalse ? false : true;
    },
    tokenFactory: options.tokenFactory ?? (() => 'fixture_writer'),
    getSelf: () => { options.onSelf?.(); if (options.selfThrow) throw Error('mock identity provider failure'); return self; },
    getWidget: () => { options.onWidget?.(); if (options.widgetThrow) throw Error('mock identity provider failure'); return widget; },
    originalCleanup(reason) {
      log.push('originalCleanup'); cleanups.push(reason);
      options.onCleanup?.(reason);
      if (options.cleanupThrow) throw Error('mock original cleanup failure');
    },
  });
  return { trace, adapter, log, writes, adds, removes, cleanups, listeners,
    setSelf: value => { self = value; }, setWidget: value => { widget = value; },
    fire: kind => { for (const [identity, callback] of listeners) if (identity.kind === kind) callback(); },
  };
}

function fillToReserve(module, h) {
  // Same two-digit sequence width as the worst-case terminal reserve.
  for (let i = 0; i < 8; i++) h.fire('TRANSITION_END');
  const reserve = h.trace.state().reservedSaturationUnits, full = 'x'.repeat(256);
  const shape = (sequence, self, widget) => ({ label: 'MOCK_ONLY', sequence, token: 'fixture_writer',
    kind: 'TRANSITION_BEGIN', self: { status: 'VALID', value: self },
    widget: { status: 'VALID', value: widget }, reason: { status: 'NOT_APPLICABLE', value: '' } });
  let exact = null;
  for (let rounds = 0; !exact && rounds < 32; rounds++) {
    const s = h.trace.state(), target = 4096 - reserve - s.attemptedUnits;
    for (let a = 1; a <= 256 && !exact; a++) for (let b = 1; b <= 256; b++) {
      if (module.formatMockRecord(shape(s.nextSequence, 'x'.repeat(a), 'x'.repeat(b))).length === target) {
        exact = [a, b]; break;
      }
    }
    if (!exact) {
      const next = module.formatMockRecord(shape(s.nextSequence, full, full)).length;
      assert.ok(s.attemptedUnits + next + reserve < 4096, 'fixture must approach exact cap without crossing');
      h.setSelf(reference(full)); h.setWidget(reference(full)); h.fire('TRANSITION_BEGIN');
    }
  }
  assert.ok(exact, 'fixture must find an exact boundary within bounded search');
  h.setSelf(reference('x'.repeat(exact[0]))); h.setWidget(reference('x'.repeat(exact[1])));
  h.fire('TRANSITION_BEGIN');
  assert.equal(h.trace.state().attemptedUnits + reserve, 4096);
  assert.equal(h.trace.state().enabled, true, 'exact normal + reserve boundary is admitted');
}

const checks = [
  ['arm once after display and preserve B0 first/second/later routes', module => {
    const h = harness(module); let displays = 0, snapshots = 0;
    const b0 = module.createMockB0Attempts({ display: () => { displays++; h.log.push('display'); return true; },
      snapshot: () => { snapshots++; }, trace: h.trace });
    assert.equal(h.trace.state().enabled, false);
    assert.equal(b0.press(), 'DISPLAY_ATTEMPT');
    assert.equal(b0.press(), 'SNAPSHOT_ATTEMPT');
    assert.equal(b0.press(), 'NO_RETRY');
    assert.equal(h.trace.afterSuccessfulDisplay(), false);
    assert.equal(h.trace.observe('ARM'), false);
    assert.deepEqual([displays, snapshots, h.adds.length, h.writes.length], [1, 1, 2, 1]);
    assert.ok(h.log.indexOf('display') < h.log.indexOf('add:TRANSITION_BEGIN'));
    assert.deepEqual(h.adds.map(x => x.kind), ['TRANSITION_BEGIN', 'TRANSITION_END']);
  }],
  ['failed display does not arm and later B0 attempts cannot retry display', module => {
    const h = harness(module); let displays = 0, snapshots = 0;
    const b0 = module.createMockB0Attempts({ display: () => { displays++; return false; },
      snapshot: () => { snapshots++; }, trace: h.trace });
    b0.press(); b0.press(); b0.press();
    assert.deepEqual([displays, snapshots, h.adds.length, h.writes.length], [1, 1, 0, 0]);
    assert.equal(h.trace.state().armAttempted, false);
  }],
  ['supplementary Unicode counts UTF16 units; identities remain complete or explicit overlong', module => {
    assert.equal(module.utf16Units('\u{1f680}'), 2);
    const h = harness(module);
    const exact = '\u{1f680}'.repeat(128); h.setSelf(reference(exact));
    h.setWidget(reference('\u{1f680}'.repeat(129))); h.trace.afterSuccessfulDisplay();
    assert.deepEqual(h.writes[0].record.self, { status: 'VALID', value: exact });
    assert.deepEqual(h.writes[0].record.widget, { status: 'OVERLONG', value: '' });
    assert.ok(h.writes[0].text.includes(exact));
    assert.equal(h.trace.state().attemptedUnits, h.writes[0].text.length);
  }],
  ['invalid widget never invokes identity; identity provider throws become explicit invalid', module => {
    let dereferences = 0; const h = harness(module, { selfThrow: true });
    h.setWidget({ valid: false, identity() { dereferences++; throw Error('must not dereference'); } });
    h.trace.afterSuccessfulDisplay();
    assert.equal(dereferences, 0);
    assert.deepEqual(h.writes[0].record.self, { status: 'INVALID', value: '' });
    assert.deepEqual(h.writes[0].record.widget, { status: 'INVALID', value: '' });
  }],
  ['event-time identities are measured afresh and all writes are immutable and exclusive', module => {
    const h = harness(module); h.trace.afterSuccessfulDisplay();
    h.setSelf(reference('Self_2')); h.setWidget(reference('Widget_2')); h.fire('TRANSITION_BEGIN');
    h.setWidget(null); h.fire('TRANSITION_END');
    assert.equal(h.writes[1].record.self.value, 'Self_2');
    assert.equal(h.writes[1].record.widget.value, 'Widget_2');
    assert.equal(h.writes[2].record.widget.status, 'INVALID');
    for (const w of h.writes) {
      assert.equal(w.overwrite, false); assert.equal(w.append, false);
      assert.ok(Object.isFrozen(w) && Object.isFrozen(w.record) && Object.isFrozen(w.record.widget));
      assert.throws(() => { w.record.widget.value = 'changed'; }, TypeError);
      assert.match(w.filename, /^MOCK_ONLY_fixture_writer_\d{2}\.fixture\.txt$/);
    }
    assert.equal(new Set(h.writes.map(w => w.filename)).size, h.writes.length);
  }],
  ['32-attempt record cap reserves exactly one terminal record then never retries', module => {
    const h = harness(module); h.setSelf(null); h.setWidget(null); h.trace.afterSuccessfulDisplay();
    for (let i = 0; i < 100; i++) h.fire('TRANSITION_END');
    const state = h.trace.state();
    assert.equal(state.attemptedRecords, 32);
    assert.equal(state.nextSequence, 33);
    assert.equal(h.writes.filter(w => w.record.kind === 'SATURATED').length, 1);
    assert.equal(h.writes.at(-1).record.kind, 'SATURATED');
    assert.ok(state.attemptedUnits <= 4096); assert.equal(state.enabled, false);
    h.trace.afterSuccessfulDisplay(); h.fire('TRANSITION_BEGIN'); h.trace.endPlay('ActualReason');
    assert.equal(h.writes.length, 32); assert.equal(h.removes.length, 2);
  }],
  ['exact 4096-unit cap includes full saturation reserve; next callback consumes reserve once', module => {
    const h = harness(module); h.trace.afterSuccessfulDisplay();
    fillToReserve(module, h);
    const full = 'x'.repeat(256);
    h.setSelf(reference(full)); h.setWidget(reference(full)); h.fire('TRANSITION_BEGIN');
    assert.equal(h.trace.state().attemptedUnits, 4096);
    assert.equal(h.writes.at(-1).record.kind, 'SATURATED');
    assert.equal(h.trace.state().enabled, false);
    h.fire('TRANSITION_END'); assert.equal(h.trace.state().attemptedUnits, 4096);
  }],
  ['false and throwing sinks consume sequence, disarm, preserve later B0 routes and remove owned pair', module => {
    for (const failure of [{ sinkFalse: true }, { sinkThrow: true }]) {
      const h = harness(module, failure); let snapshots = 0;
      const b0 = module.createMockB0Attempts({ display: () => true,
        snapshot: () => { snapshots++; }, trace: h.trace });
      b0.press(); b0.press(); b0.press(); h.trace.afterSuccessfulDisplay();
      h.fire('TRANSITION_BEGIN'); h.fire('TRANSITION_END');
      assert.equal(h.writes.length, 1); assert.equal(h.trace.state().nextSequence, 2);
      assert.equal(h.trace.state().attemptedUnits, h.writes[0].text.length);
      assert.equal(h.trace.state().enabled, false); assert.equal(snapshots, 1);
      h.trace.endPlay('LevelTransition'); h.trace.endPlay('IgnoredSecondReason');
      assert.deepEqual(h.cleanups, ['LevelTransition']); assert.equal(h.removes.length, 2);
      assert.equal(h.writes.length, 1);
    }
  }],
  ['partial false/throwing binding removes known attempted identities without stock clear', module => {
    for (const failure of [{ bindFalse: 'TRANSITION_BEGIN' }, { bindThrow: 'TRANSITION_END' }]) {
      const h = harness(module, failure); h.trace.afterSuccessfulDisplay(); h.trace.afterSuccessfulDisplay();
      assert.equal(h.writes.length, 0); assert.equal(h.trace.state().enabled, false);
      assert.deepEqual(h.removes, h.adds); assert.equal(h.listeners.size, 0);
      h.trace.endPlay('ActualReason'); assert.equal(h.removes.length, h.adds.length);
      assert.deepEqual(h.cleanups, ['ActualReason']);
    }
  }],
  ['EndPlay writes before removals and original cleanup once with exact actual reason', module => {
    const h = harness(module); h.trace.afterSuccessfulDisplay(); h.trace.endPlay('LevelTransition');
    h.trace.endPlay('Destroyed'); h.fire('TRANSITION_END');
    assert.equal(h.writes.at(-1).record.kind, 'ENDPLAY');
    assert.deepEqual(h.writes.at(-1).record.reason, { status: 'VALID', value: 'LevelTransition' });
    assert.deepEqual(h.cleanups, ['LevelTransition']); assert.deepEqual(h.removes, h.adds);
    assert.ok(h.log.indexOf('write:ENDPLAY') < h.log.indexOf('remove:TRANSITION_BEGIN'));
    assert.ok(h.log.indexOf('remove:TRANSITION_END') < h.log.indexOf('originalCleanup'));
  }],
  ['throwing EndPlay sink/identity/removal cannot skip second removal or original cleanup', module => {
    const h = harness(module, { sinkThrowKind: 'ENDPLAY', selfThrow: true, widgetThrow: true,
      removeThrow: 'TRANSITION_BEGIN' });
    h.trace.afterSuccessfulDisplay(); h.trace.endPlay('ActualOpaqueReason');
    assert.equal(h.writes.at(-1).record.self.status, 'INVALID');
    assert.deepEqual(h.removes, h.adds);
    assert.deepEqual(h.trace.state().removalFailures, ['TRANSITION_BEGIN:THROW']);
    assert.deepEqual(h.cleanups, ['ActualOpaqueReason']);
    assert.equal(h.trace.state().status, 'WRITE_THROW');
    assert.equal(h.trace.state().cleanupStatus, 'CALLED_ONCE');
    assert.equal(h.listeners.size, 1, 'failed removal is uncertain, never claimed removed');
    h.fire('TRANSITION_BEGIN'); assert.equal(h.writes.length, 2);
  }],
  ['disarmed EndPlay with failed removal and throwing original cleanup still calls once', module => {
    const actualReason = Object.freeze({ fixtureOpaqueReason: 'keep same reference' });
    const h = harness(module, { sinkFalse: true, removeThrow: 'TRANSITION_BEGIN', cleanupThrow: true });
    h.trace.afterSuccessfulDisplay(); h.trace.endPlay(actualReason); h.trace.endPlay('ignored');
    assert.equal(h.writes.length, 1); assert.deepEqual(h.removes, h.adds);
    assert.equal(h.cleanups.length, 1); assert.equal(h.cleanups[0], actualReason);
    assert.equal(h.trace.state().cleanupStatus, 'CALLED_ONCE_THROW');
  }],
  ['invalid/throwing token never binds or writes and cannot retry arming', module => {
    for (const tokenFactory of [() => '../unsafe', () => { throw Error('mock token error'); }]) {
      const h = harness(module, { tokenFactory }); h.trace.afterSuccessfulDisplay(); h.trace.afterSuccessfulDisplay();
      assert.equal(h.adds.length, 0); assert.equal(h.writes.length, 0);
      assert.equal(h.trace.state().armAttempted, true); h.trace.endPlay('ActualReason');
      assert.equal(h.cleanups.length, 1);
    }
  }],
  ['reserve blocks a short ordinary event even when it physically fits the remaining total', module => {
    const h = harness(module); h.trace.afterSuccessfulDisplay(); fillToReserve(module, h);
    h.setSelf(reference('S')); h.setWidget(reference('W')); h.fire('TRANSITION_END');
    assert.equal(h.writes.at(-1).record.kind, 'SATURATED');
    assert.equal(h.trace.state().enabled, false);
    assert.ok(h.trace.state().attemptedUnits <= 4096);
  }],
  ['injected original cleanup seals both B0 attempts and later presses cannot capture', module => {
    let b0, displays = 0, snapshots = 0;
    const h = harness(module, { onCleanup: () => b0.seal() });
    b0 = module.createMockB0Attempts({ display: () => { displays++; return true; },
      snapshot: () => { snapshots++; }, trace: h.trace });
    b0.press(); h.trace.endPlay('ActualTransitionReason'); h.trace.endPlay('Ignored');
    assert.equal(b0.press(), 'NO_RETRY');
    assert.deepEqual(b0.state(), { controlAttempted: true, snapshotAttempted: true });
    assert.deepEqual([displays, snapshots], [1, 0]);
    assert.deepEqual(h.cleanups, ['ActualTransitionReason']);
  }],
  ['reentrant EndPlay during token creation cannot bind, write, or re-enable afterward', module => {
    let h;
    h = harness(module, { tokenFactory: () => { h.trace.endPlay('DuringToken'); return 'fixture_writer'; } });
    h.trace.afterSuccessfulDisplay();
    assert.deepEqual(h.cleanups, ['DuringToken']); assert.equal(h.adds.length, 0); assert.equal(h.writes.length, 0);
    assert.equal(h.trace.state().ended, true); assert.equal(h.trace.state().enabled, false);
  }],
  ['reentrant EndPlay during additive binding cannot add a later listener or re-enable', module => {
    let h;
    h = harness(module, { onAdd: () => h.trace.endPlay('DuringBind') });
    h.trace.afterSuccessfulDisplay();
    assert.equal(h.adds.length, 1); assert.deepEqual(h.removes, h.adds); assert.equal(h.listeners.size, 0);
    assert.deepEqual(h.cleanups, ['DuringBind']); assert.equal(h.writes.length, 0);
    assert.equal(h.trace.state().enabled, false); assert.equal(h.trace.state().ownedRemovalAttemptsRemaining, 0);
  }],
  ['reentrant EndPlay from either identity accessor prevents an outer observation after cleanup', module => {
    for (const hook of ['onSelf', 'onWidget']) {
      let h;
      h = harness(module, { [hook]: () => h.trace.endPlay('DuringIdentity') });
      h.trace.afterSuccessfulDisplay();
      assert.deepEqual(h.writes.map(w => w.record.kind), ['ENDPLAY']);
      assert.deepEqual(h.cleanups, ['DuringIdentity']); assert.deepEqual(h.removes, h.adds);
      assert.equal(h.trace.state().enabled, false);
      assert.ok(h.log.findIndex(x => x.startsWith('write:')) < h.log.indexOf('originalCleanup'));
    }
  }],
  ['reentrant EndPlay from sink consumes unique attempts and cannot write after cleanup', module => {
    let h;
    h = harness(module, { onSink: () => h.trace.endPlay('DuringSink') });
    h.trace.afterSuccessfulDisplay();
    assert.deepEqual(h.writes.map(w => w.record.kind), ['ARM', 'ENDPLAY']);
    assert.deepEqual(h.writes.map(w => w.record.sequence), [1, 2]);
    assert.deepEqual(h.cleanups, ['DuringSink']); assert.deepEqual(h.removes, h.adds);
    assert.equal(h.trace.state().enabled, false);
    assert.equal(h.log.at(-1), 'originalCleanup');
  }],
];

const results = [];
for (const [name, check] of checks) {
  try { check(model); results.push({ name, status: 'PASSED_MOCK_ONLY' }); }
  catch (error) { results.push({ name, status: 'FAILED', error: error.message }); }
}

// Mutation checks prove that selected edge assertions reject specific contract regressions.
// Only this newly written mock source is read. Mutant modules are in-memory data URLs.
const source = await readFile(new URL('./Mock-TransitionDiagnosticContract.mjs', import.meta.url), 'utf8');
const mutations = [
  ['count Unicode code points instead of UTF16 units', 'text => text.length;', 'text => [...text].length;', 2],
  ['omit reserved saturation units from admission', '+ this.#reserveUnits > MOCK_LIMITS.units', '> MOCK_LIMITS.units', 13],
  ['permit an ordinary 32nd record before saturation', '+ 1 + 1 > MOCK_LIMITS.records', '+ 1 > MOCK_LIMITS.records', 5],
  ['ignore false sink return and remain armed', 'this.#sink(request) !== true', '(this.#sink(request), false)', 7],
  ['ignore throwing sink and remain armed', "catch { return this.#disable('WRITE_THROW'); }", 'catch { return true; }', 7],
  ['dereference invalid widget identity', 'reference.valid !== true', 'false', 3],
  ['stop removals after the first throwing removal',
    'catch { this.#removalFailures.push(`${identity.kind}:THROW`); }', 'catch { return; }', 10],
  ['replace actual EndPlay reason with a hardcoded default',
    'this.#originalCleanup(actualReason);', "this.#originalCleanup('Destroyed');", 9],
];
const mutationResults = [];
for (const [name, before, after, checkIndex] of mutations) {
  try {
    assert.equal(source.split(before).length - 1, 1, 'mutation target must occur once');
    const mutated = source.replace(before, after);
    const mutant = await import(`data:text/javascript;base64,${Buffer.from(mutated).toString('base64')}#${encodeURIComponent(name)}`);
    let rejected = false;
    try { checks[checkIndex][1](mutant); } catch (error) { if (error instanceof assert.AssertionError) rejected = true; else throw error; }
    assert.equal(rejected, true, 'target assertion must reject mutant');
    mutationResults.push({ name, status: 'REJECTED_MOCK_MUTATION' });
  } catch (error) { mutationResults.push({ name, status: 'FAILED', error: error.message }); }
}

const failed = [...results, ...mutationResults].filter(x => x.status === 'FAILED');
console.log(JSON.stringify({
  label: 'MOCK_ONLY', status: failed.length ? 'FAILED' : 'PASSED_MOCK_ONLY',
  testsPassed: results.length - results.filter(x => x.status === 'FAILED').length,
  testsTotal: results.length, mutationsRejected: mutationResults.length - mutationResults.filter(x => x.status === 'FAILED').length,
  mutationsTotal: mutationResults.length, results, mutationResults,
  nativeBlueprintImplementation: 'NOT_PERFORMED', editorRuntimeProof: 'NOT_PERFORMED',
  shippingGameProof: 'NOT_PERFORMED', productionReceiptFormat: 'NOT_DEFINED_BY_THIS_MODEL',
}, null, 2));
if (failed.length) process.exitCode = 1;
