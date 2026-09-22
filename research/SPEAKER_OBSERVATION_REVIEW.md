# Experimental speaker-relative observation review

Status: **PASS_MOCK_ONLY — 28/28 independent cases**: 24 projection/serializer cases and four diagnostic-harness cases. This independent review owns only its test file and this note. It uses plain data, the actual serializer, inert coordinator captures and fake in-memory engine/receipt providers. No native model, subprocess, audio, microphone, browser, editor, game or downloads are executed.

## Preserved finding before correction

On 2026-09-22, the initial seventeen independent cases passed, but an additional mixed-shape case failed against `companion/speaker-observations.mjs` SHA256 `4C84BB3F439360BA53FECF6C3A69B36088BACD805B4331AA253C8D56B52A0985` (adapter SHA256 `3E53DD4901270CB250AF3FDFA363B924DA65108ACE452B57CC8FB9B05D92FD4D`).

Input data contained both `{actorId:'scout',heat:'critical'}` at the root and `pilots:[{actorId:'scout',heat:'low'}]`. The observed projection selected **own heat REPORTED low**, with only `/data/pilots/0/heat` referenced. The contrary root reading survived in raw unprojected data but was absent from the supposedly resolved metric. The independent targeted test failed with `An ambiguous hybrid cannot select a resolved nested value.` This is a projection ambiguity, not an observed model failure. The owner was asked to reject the hybrid, leave it wholly unprojected, or represent both alternatives as unresolved.

The [independent cases](../companion/tests/speaker-observation-review.test.mjs) preserve that regression. The implementation owner subsequently confirmed source freeze; the corrected source hashes were independently rechecked unchanged.

## Corrected implementation review

The current correction passes **24/24 independent pure cases**. It projects both explicitly recognized row forms and preserves both exact references; the historical hybrid now has `CONFLICT` with critical and low alternatives. The full raw mixed object also remains available as unprojected evidence. No winner is chosen by row order or asserted timestamp.

Reviewed frozen hashes:

| Artifact | SHA256 |
|---|---|
| `companion/speaker-observations.mjs` | `4B402FF008389075DF0CBE53D371DE1B4DC9000A774E249682948C3BE7725D6D` |
| `companion/local-language-model.mjs` | `3E53DD4901270CB250AF3FDFA363B924DA65108ACE452B57CC8FB9B05D92FD4D` |
| Independent test file, including the four subsequent harness cases | `DA36969BB9E39D202B6DD62884B61E10DF17B60D9FCFE1CDF481E3A7E763A8B0` |

The [projector](../companion/speaker-observations.mjs#L38) accepts only an explicitly `MOCK_ONLY` source packet and joins exact, case-sensitive actor IDs through a `Map`. Only `speakerId` binds first person; personality, callsign, request and history are not projector inputs. Missing speaker identity yields unattributed reports, absent own readings stay absent, and unidentified rows remain separate. Duplicate fact IDs reject the packet. Agreeing reports retain every source; conflicting values remain alternatives. A recognized field containing unsupported data prevents that actor/metric from being marked resolved. `heatState`, numeric heat, arbitrary mission outcomes and additional fields are not silently translated into supported readings. The only projected metrics are literal `heat` categories and literal `selectedWeaponAmmo` categories; no units, numeric heat, ammo count, weapon identity, friendliness, combat capability, action completion or hidden game state is inferred.

Each compact source reference resolves to one audit entry identifying fact ID, fact index and exact pointer. Supplied timestamps are copied only when present; they are not refreshed or tested for current-game freshness. The audit retains all source facts. Unsupported input remains raw and untrusted. Readings with caller-asserted evidence labels are not promoted to authenticated telemetry.

The [serializer option](../companion/local-language-model.mjs#L73) and [factory option](../companion/local-language-model.mjs#L107) default to false. The experimental path additionally requires context classification `MOCK_ONLY`. An option-shaped field inside request/context data does not activate it. The actual generation call passes the fixed factory option to the serializer; output and prompt-size limits remain unchanged. The experimental prompt removes the internal personality key from the speaker object while retaining selected personality style. Hostile identity claims in request/history/fact text remain user-message data and do not change the deterministic binding. This does **not** prove a language model will ignore such claims.

## Preserved default and historical evidence

The default serialized messages for all eight original identity cases remain byte-identical: SHA256 `561f32c62726484598b46c4ff952c9f46ea3c3ba241512a758dd2a8ffef9f65d`. Independent tests also verify the original identity fixture (`4ffda0d912a22828bd34a3fbc91b616a60d9b1b510b89576b70bf2f1c01385b1`), its observed receipt (`48dc661b39d0db57d20bdac4be667b8892f0919273b78d352042b8c85586b827`) and the editor-closed broad receipt (`da4bcaa158ef443be9b1ff4809760adc1b7ace4d28c2a5c1c43830f1d7a0109f`) are unchanged.

One intermediate expanded-test failure was an over-specific test expectation: an explicitly present `classification: undefined` correctly failed the existing plain-data validator before reaching the experiment gate. The test was corrected to use an actually absent classification for that gate check; no implementation change was requested for the correct early rejection.

This is preparation for an opt-in experiment. The prior broad grounding failures and eight-case identity findings remain evidence of unmet model behavior. No live factual speech, control acceptance, quality improvement, native latency or full-mod completion follows from these tests.

## Prepared diagnostic harness review

The final [harness](../scripts/Exercise-ConversationRelativeFacts.mjs) was statically reviewed at SHA256 `5D33C7FB4102207CF21B4539DFF13391FED7C38CA7513FDE3B5BCB09C48A5BF5`. Its separately owned [harness tests](../companion/tests/conversation-relative-facts-diagnostic.test.mjs) are `D5C276B808A3F0B7161A76AE86785081DEA4E7B09754A154F262FA6428761246`. The final source-list addition was reviewed after freeze. No further source blocker was found.

Preparation rechecks the frozen 18-case fixture, the exact imported regression cases/review protocols, and prior native receipts/reviews. Ten contexts are captured through the real coordinator with an inert generator; eight remain explicitly unbound. The only diagnostic-added context field is `classification: MOCK_ONLY`. Original contexts, the complete projection/audit, exact model messages and case metadata are retained separately. Expectations, provenance narratives and review criteria do not enter generation context. The fixture accurately labels fourteen known regressions and four new predeclared holdouts.

The actual run path records source hashes including the projector, adapter, coordinator, fixtures, model lock, extracted-runtime manifest and this review. It requires runtime pin verification and the fixed CPU/model/projection settings. Receipt creation uses an exclusive `wx` handle for the distinct `research/QWEN4B_RELATIVE_FACTS_DIAGNOSTIC.json` path before any engine construction; `--check` returns before that step. Historical receipts cannot be overwritten by this runner.

Four additional independent fake-only cases establish classification-only context capture with no evaluation-field leakage; one completed case followed by a failed case and all sixteen remaining cases preserved as unperformed without retry; initial RAM refusal with zero engine construction; and exclusive existing-receipt refusal before any worker construction. Completed texts remain `TEXT_COMPLETE_DIAGNOSTIC_ONLY`, semantic review stays `NOT_PERFORMED`, and no sample becomes dispatched or played. This exercises bookkeeping, not model quality or actual process cleanup.

The fixed gates remain 5 GiB admission RAM, 10 GiB disk reserve and a sampled 2 GiB running RAM floor, with 10-second generation operations, a 233-second work guard and seven-second cleanup bound. The source retains failed/unperformed outcomes and unconfirmed cleanup. These guards do not establish OS-level termination, continuously available resources or live-game performance; this review does not test native stalls. The coordinating task separately reported a complete **830/830** project regression pass at 23:29:24 UTC, encompassing the author's 28 harness tests, with 74 source hashes checked. That full-suite report is attributed to the coordinating task rather than a second full-suite run here.

The distinct new native receipt is still absent at final review. **Native execution is NOT_PERFORMED**. The supervising task reported available RAM below the unchanged 5 GiB gate; no exception or lowered threshold is recommended. A future run requires fresh successful resource admission and confirmed prior-worker shutdown. Even a fully completed future collection must receive separate semantic review and cannot grant live factual speech or control authority.
