# Generation completion metadata in diagnostic receipts

September 22, 2026 — **PASS_MOCK_ONLY / native inference NOT_PERFORMED**. This bounded change updates future identity and relative-fact diagnostic receipt handling alongside the separately owned adapter completion fix. It does not rewrite historical results or evaluate model quality.

Both harnesses now initialize every primer/sample with `finishReason: null` and `nativeTimings: null`. A returned operation can record the adapter's `lastGenerationFinishReason: 'stop'`. A rejected `GENERATED_TEXT_TRUNCATED` operation can record `'length'` and its optional terminal timings only when the adapter reports that matching reason and the caller signal is not cancelled. Capture occurs before shutdown can clear diagnostics. The rejected sample remains `FAILED`, retains **no output**, halts the run and leaves later cases `NOT_PERFORMED`.

The harnesses do not infer a finish reason from response length, token count, text appearance or operation status. Missing/unsupported reasons, mismatched truncation metadata, other errors and cancellation leave the sample's reason and timings null. A confirmed stop with missing optional timings keeps its reason and null timings. Timings are copied from the adapter's already bounded five-field snapshot, not reconstructed from logs or elapsed time. Validation of native SSE terminal ordering, stream completion and timing bounds belongs to the adapter workstream; these harness tests do not independently prove that parser.

The limitation text now describes terminal `finish_reason` diagnostics instead of claiming the adapter never exposes them. `stop` remains transport completion, **not** factual correctness or semantic acceptance. Fake engines deliberately allowed to return without finish metadata retain unknown metadata and pending semantic review; the harness does not invent a native reason to improve their status.

## Verification

Focused run: **83/83 tests passed, zero failures or skips**, across `conversation-identity-diagnostic.test.mjs`, `conversation-relative-facts-diagnostic.test.mjs` and the unchanged `briefing-diagnostic.test.mjs`. All engine and receipt operations were inert. Twenty added cases cover primer/first-case truncation, preserving metadata across stop, no later invocation, missing/unsupported reasons, stale or mismatched metadata, optional timing absence and an abort-ignoring fake at the deadline. Existing checks additionally verify success, resource refusal, immutable inputs, fixed exclusive destinations and no output propagation to later contexts. Diff checks passed. The complete project suite is owned separately by the supervisor.

| Frozen changed source | SHA256 |
|---|---|
| `scripts/Exercise-ConversationIdentity.mjs` | `087DBD5AFED5A69A9774F6541482C2E4D0F2EFAADC0CFEDBA397D8551A785AE5` |
| `scripts/Exercise-ConversationRelativeFacts.mjs` | `852C3C1414971A1269E05CA88395E75D23A25223471EC919DD0F779FBF8EC6AD` |
| `companion/tests/conversation-identity-diagnostic.test.mjs` | `C1C3B9386943A6FAF14AC36B9470F3C3C5EE14EEE94EB63CADD1C24FA2954A6E` |
| `companion/tests/conversation-relative-facts-diagnostic.test.mjs` | `07C380A3DFBEA9F174C04AA61E7A553D04E41280097D4448719107E739C92C2F` |

Historical receipt hashes were rechecked unchanged: identity `48DC661B…`, first relative-fact refusal `A4970F27…`, 4B attempt 002 `E227F949…`, 1.7B relative facts `456AE004…`, and 1.7B briefing `F63A50B7…`. Their complete pins remain in their existing reviews; none acquires a retrospective finish reason or new adapter acceptance. The eighteen-case fixture remains `EC7106CD5A0518489CD46DCEA24EF8F0AB6FACFBFF5C31F4F8B5716A889F9108`. No selector, reserved receipt path, criterion, prompt, model option, deadline or resource gate changed. This work performed no native run, wrote no JSON result and created no new run selector.
