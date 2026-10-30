// MOCK_ONLY: pure reference model. No MW5/Unreal, filesystem, or native API calls.
export const MOCK_LIMITS = Object.freeze({ records: 32, units: 4096, identityUnits: 256 });
const IDENTITY_STATUSES = Object.freeze({ invalid: 'INVALID', overlong: 'OVERLONG', valid: 'VALID' });
const NO_REASON = Object.freeze({ status: 'NOT_APPLICABLE', value: '' });
const freezeIdentity = (status, value = '') => Object.freeze({ status, value });
export const utf16Units = text => text.length;

// Length prefixes preserve complete strings, including delimiters and supplementary Unicode.
// This envelope is ONLY an internal fixture format, not a proposed production receipt.
const pack = text => `${utf16Units(text)}:${text}`;
export function formatMockRecord(record) {
  return 'MOCK_ONLY_FIXTURE_V1|' + [
    String(record.sequence), record.token, record.kind,
    record.self.status, record.self.value, record.widget.status, record.widget.value,
    record.reason.status, record.reason.value,
  ].map(pack).join('');
}

function inspectIdentity(getReference) {
  try {
    const reference = getReference();
    if (!reference || reference.valid !== true) return freezeIdentity(IDENTITY_STATUSES.invalid);
    const value = reference.identity();
    if (typeof value !== 'string' || value.length === 0) return freezeIdentity(IDENTITY_STATUSES.invalid);
    if (utf16Units(value) > MOCK_LIMITS.identityUnits) return freezeIdentity(IDENTITY_STATUSES.overlong);
    return freezeIdentity(IDENTITY_STATUSES.valid, value);
  } catch {
    return freezeIdentity(IDENTITY_STATUSES.invalid);
  }
}

function inspectReason(reason) {
  // Fixture reasons are opaque strings. Unsupported/overlong values have explicit status;
  // the original cleanup still receives the actual supplied value unchanged.
  if (typeof reason !== 'string') return freezeIdentity('INVALID');
  if (utf16Units(reason) > MOCK_LIMITS.identityUnits) return freezeIdentity('OVERLONG');
  return freezeIdentity('VALID', reason);
}

export class MockTransitionDiagnosticContract {
  #adapter; #sink; #tokenFactory; #getSelf; #getWidget; #originalCleanup;
  #token = ''; #armAttempted = false; #enabled = false; #ended = false;
  #nextSequence = 1; #attemptedRecords = 0; #attemptedUnits = 0;
  #status = 'DISARMED'; #saturationAttempted = false; #reserveUnits = 0;
  #ownedAttempts = []; #removalFailures = []; #cleanupStatus = 'NOT_PERFORMED';

  constructor({ adapter, sink, tokenFactory, getSelf, getWidget, originalCleanup }) {
    this.#adapter = adapter; this.#sink = sink; this.#tokenFactory = tokenFactory;
    this.#getSelf = getSelf; this.#getWidget = getWidget; this.#originalCleanup = originalCleanup;
  }

  state() {
    return Object.freeze({
      label: 'MOCK_ONLY', armAttempted: this.#armAttempted, enabled: this.#enabled,
      ended: this.#ended, nextSequence: this.#nextSequence,
      attemptedRecords: this.#attemptedRecords, attemptedUnits: this.#attemptedUnits,
      reservedSaturationUnits: this.#reserveUnits, saturationAttempted: this.#saturationAttempted,
      status: this.#status, ownedRemovalAttemptsRemaining: this.#ownedAttempts.length,
      removalFailures: Object.freeze([...this.#removalFailures]), cleanupStatus: this.#cleanupStatus,
    });
  }

  // Caller may reach this only after its successful display continuation.
  afterSuccessfulDisplay() {
    if (this.#armAttempted || this.#ended) return false;
    this.#armAttempted = true;
    try { this.#token = this.#tokenFactory(); } catch { return this.#disable('TOKEN_THROW'); }
    if (this.#ended) return this.#disable('ENDPLAY_DURING_ARM');
    if (typeof this.#token !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(this.#token)) {
      return this.#disable('TOKEN_INVALID');
    }
    const longest = freezeIdentity('VALID', 'x'.repeat(MOCK_LIMITS.identityUnits));
    this.#reserveUnits = utf16Units(this.#makeRecord('SATURATED', longest, longest, NO_REASON, MOCK_LIMITS.records).text);
    if (this.#reserveUnits > MOCK_LIMITS.units) return this.#disable('RESERVE_UNAVAILABLE');
    for (const kind of ['TRANSITION_BEGIN', 'TRANSITION_END']) {
      // The adapter contract uses this exact known identity even if add throws after binding.
      // No stock subscriber identities or clear-all operations exist in this mock API.
      const identity = Object.freeze({ owner: this, kind });
      this.#ownedAttempts.push(identity);
      try {
        if (this.#adapter.add(identity, () => this.observe(kind)) !== true) {
          this.#disable('BIND_FALSE'); this.#removeOwned(); return false;
        }
        if (this.#ended) return this.#disable('ENDPLAY_DURING_ARM');
      } catch {
        this.#disable('BIND_THROW'); this.#removeOwned(); return false;
      }
    }
    this.#enabled = true;
    this.#status = 'ARMED';
    this.#record('ARM', NO_REASON);
    return this.#enabled;
  }

  observe(kind) {
    if (!this.#enabled || this.#ended) return false;
    if (!['TRANSITION_BEGIN', 'TRANSITION_END'].includes(kind)) return false;
    return this.#record(kind, NO_REASON);
  }

  endPlay(actualReason) {
    if (this.#ended) return false;
    // Seal before callbacks, including the sink and the original cleanup callback.
    this.#ended = true;
    try {
      if (this.#enabled) this.#record('ENDPLAY', inspectReason(actualReason), true);
    } finally {
      this.#enabled = false;
      this.#removeOwned();
      try { this.#originalCleanup(actualReason); this.#cleanupStatus = 'CALLED_ONCE'; }
      catch { this.#cleanupStatus = 'CALLED_ONCE_THROW'; }
    }
    return true;
  }

  #disable(status) { this.#enabled = false; this.#status = status; return false; }

  #removeOwned() {
    // Consume each ownership attempt before removal. A throwing removal must not skip the next.
    const attempts = this.#ownedAttempts;
    this.#ownedAttempts = [];
    for (const identity of attempts) {
      try {
        if (this.#adapter.remove(identity) !== true) this.#removalFailures.push(`${identity.kind}:FALSE`);
      } catch { this.#removalFailures.push(`${identity.kind}:THROW`); }
    }
  }

  #makeRecord(kind, self, widget, reason, sequence = this.#nextSequence) {
    const record = Object.freeze({ label: 'MOCK_ONLY', sequence, token: this.#token, kind, self, widget, reason });
    return { record, text: formatMockRecord(record) };
  }

  #record(kind, reason, terminating = false) {
    const mayContinue = () => this.#enabled && (!this.#ended || terminating);
    if (!mayContinue()) return false;
    const self = inspectIdentity(this.#getSelf);
    if (!mayContinue()) return false;
    const widget = inspectIdentity(this.#getWidget);
    if (!mayContinue()) return false;
    const candidate = this.#makeRecord(kind, self, widget, reason);
    if (this.#attemptedRecords + 1 + 1 > MOCK_LIMITS.records ||
        this.#attemptedUnits + utf16Units(candidate.text) + this.#reserveUnits > MOCK_LIMITS.units) {
      if (this.#saturationAttempted) return this.#disable('SATURATED');
      this.#saturationAttempted = true;
      const terminal = this.#makeRecord('SATURATED', self, widget, NO_REASON);
      if (this.#attemptedRecords + 1 > MOCK_LIMITS.records ||
          this.#attemptedUnits + utf16Units(terminal.text) > MOCK_LIMITS.units) {
        return this.#disable('RESERVE_BREACH');
      }
      this.#write(terminal);
      if (this.#enabled) this.#disable('SATURATED');
      return false;
    }
    return this.#write(candidate);
  }

  #write({ record, text }) {
    // Count attempts and consume sequence BEFORE a false/throwing/colliding write.
    this.#attemptedRecords += 1;
    this.#attemptedUnits += utf16Units(text);
    this.#nextSequence += 1;
    const request = Object.freeze({
      label: 'MOCK_ONLY', filename: `MOCK_ONLY_${this.#token}_${String(record.sequence).padStart(2, '0')}.fixture.txt`,
      overwrite: false, append: false, text, record,
    });
    try {
      if (this.#sink(request) !== true) return this.#disable('WRITE_FALSE');
    } catch { return this.#disable('WRITE_THROW'); }
    return this.#enabled && (record.kind === 'ENDPLAY' || !this.#ended);
  }
}

// MOCK_ONLY comparison harness for the already-established first/second/later attempt contract.
// It does not implement or validate native input, widget validity, capture, or B0 graph wiring.
export function createMockB0Attempts({ display, snapshot, trace }) {
  let controlAttempted = false;
  let snapshotAttempted = false;
  return Object.freeze({
    press() {
      if (!controlAttempted) {
        controlAttempted = true;
        if (display() === true) trace.afterSuccessfulDisplay();
        return 'DISPLAY_ATTEMPT';
      }
      if (!snapshotAttempted) { snapshotAttempted = true; snapshot(); return 'SNAPSHOT_ATTEMPT'; }
      return 'NO_RETRY';
    },
    // Inject into the modeled original cleanup, mirroring the existing flag-sealing contract.
    seal() { controlAttempted = true; snapshotAttempted = true; },
    state() { return Object.freeze({ controlAttempted, snapshotAttempted }); },
  });
}
