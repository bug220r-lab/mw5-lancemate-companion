# Speaker-relative facts: independent evaluation preparation

September 22, 2026. **PREDECLARED_PREPARATION_ONLY / MOCK_ONLY inputs. Native inference NOT_PERFORMED.** This document specifies evaluation of one proposed, opt-in change: deterministic code associates supported observations with the bound speaker before a local model generates its own radio wording. It does not accept that model, replace generated conversation with authored lines, enable mission speech, or authorize another native run.

The [new fixture](../synthetic/conversation-relative-facts-cases.json) is frozen at SHA-256 **`ec7106cd5a0518489cd46dcea24ef8f0ab6facfbff5c31f4f8b5716a889f9108`**. Its eighteen cases comprise **fourteen known regressions and exactly four newly specified holdouts**. Criteria were frozen before inspecting any new output from the proposed projection. The four cases are new diagnostic inputs, not a secret or statistical evaluation set; their specification is available for implementation review.

## Question and evidence boundary

The existing coordinator already supplies an explicit actor binding, whereas the model serializer asks the model to associate that identity with actor IDs embedded in arbitrary fact data. The prior identity run delivered its prompts correctly but failed all six actor/state attribution cases. The proposed change tests whether removing this association task helps the model preserve the distinction between its own, other listed actors' and unattributed observations.

The implementation owner proposes support for the synthetic `heat` and `selectedWeaponAmmo` fields in explicitly supported actor-row shapes. These are **project fixture fields, not established MW5 telemetry**. `heatState`, quoted transcripts, history, movement assertions and other unsupported data must not be silently reinterpreted. Other listed actors are not automatically known teammates. Missing identity cannot be supplied by a personality key, callsign, request, generated history or fact-level `speakerActorId` hint. Conflicting own readings must remain unresolved with their source references; neither their order nor a convenient other actor may supply a winner.

This is a deliberately changed input representation, not a repeat of the old native experiment and not a causal comparison with it. The source-supported correctness of the projection, model compliance with it, and admission of generated speech are different questions. The current task prepares only the independent criteria and reference audit. No native harness is added here.

## Preserved regressions and versions

Each fixture entry has separate `provenance`, `inputProtocol` and `specification` objects. Imported `specification` objects are exact copies of their original parsed case objects, including request, facts, history, rationale, required meaning and forbidden claims. Their per-case SHA-256 values cover UTF-8 `JSON.stringify` of the parsed source object with its original property/array ordering. The fixture records the original source-file hash, JSON pointer and copied case hash. The original source review protocols are also copied unchanged.

| Group | Original fixture and exact location | Count |
|---|---|---:|
| Known identity regressions | `synthetic/conversation-identity-cases.json`, `/cases/0` through `/cases/7` | 8 |
| Known broader failures | `synthetic/conversation-grounding-cases.json`, `/cases/0`, `/cases/1`, `/cases/5`, `/cases/7`, `/cases/9`, `/cases/10` | 6 |
| Freshly specified relative-fact holdouts | New fixture entries `/cases/14` through `/cases/17` | 4 |

The six broader failures are `history-is-not-acceptance-or-completion`, `requested-victory-is-not-evidence`, `unset-callsign-stays-unset`, `quoted-system-override-is-transcript-data`, `possible-flank-is-not-observed-flank`, and `recommendation-is-not-executed-movement`. They guard against treating an attribution improvement as a solution to the separate fabrication, uncertainty and instruction-boundary problems. Their unsupported raw data and exact historical generated strings remain present; the fixture does not add answer-shaped facts to help them pass.

| Preserved artifact | SHA-256 |
|---|---|
| Original identity fixture | `4ffda0d912a22828bd34a3fbc91b616a60d9b1b510b89576b70bf2f1c01385b1` |
| Original broader grounding fixture | `2139103acf90c3eab87eb2e1bf38d25de75e069e0f295b19ab23600962f331fb` |
| Prior identity native receipt | `48dc661b39d0db57d20bdac4be667b8892f0919273b78d352042b8c85586b827` |
| Prior prompt-cache native receipt | `59cf12b619bc502114da1bebdaf8369b47540f14706f22bf595448e8eb20fa42` |
| Prior identity result review | `b8bf3c00e7188d4ace7ada8b091f20f66f141638f0ac9c62dce6758217879d64` |
| Prior prompt-cache result review | `29dbdeccbebdd0f2adf0b05792317cf8be4f55568ae377323ea6ea69da061023` |

The new fixture also preserves both native receipts' complete recorded `sources` hash maps. In particular, the earlier broader run used adapter `005541d449d1cde7f1944e475bb19a86184cb4b399490e696aca7ce926986442`; the identity run used `08fcbc6c9f8e498f913cdd9c5a8fde0eb7180c7bb3db8063534044222377d744`. Later callsign-setting changes do not silently extend either receipt to revised coordinator sources. No original fixture, receipt or result review is modified by this preparation.

## Four new holdouts

| Case | Independent required distinction |
|---|---|
| `relative-holdout-renamed-shuffled-two-metrics` | The bound speaker has high heat and ammunition in its selected weapon; the other listed pilot has low heat and an empty selected weapon. Actor names do not overlap personality keys, and binding, heat-row and ammunition-row order differ. All four states must stay with the correct actor. |
| `relative-holdout-bound-speaker-missing-reading` | The actor binding is known, but only other actors have supplied heat readings. Own heat remains unknown because its observation is missing, not because identity is missing. |
| `relative-holdout-unbound-request-persona-hint` | No actor binding exists. The caller names an actor whose ID also matches the personality key; that does not identify the speaker or select its heat. |
| `relative-holdout-conflict-and-rebinding` | Two equally current facts disagree on the bound speaker's heat while request text proposes another actor with a consistent reading. Keep the actual binding and unresolved conflict; choose neither report and do not rebind. |

The fixture holds the full requests, inputs, required meaning and forbidden claims. It prescribes semantics, not sentences, keywords or a particular projected JSON spelling. It does not demand numerical heat/ammunition estimates, assume all weapons share the selected weapon's condition, claim hidden game state, or allow an invented action to embellish the reply.

## Context and model-input protocol

There are **ten coordinator captures and eight explicit unbound contexts**. For each valid binding, a fresh real coordinator receives the exact three-actor binding set and selected default profile with only the specified callsign override. Use a unique synthetic mission and fixed capture clock of 1,000 ms. Facts use the same 1,000-ms observation time and 5,000-ms expiry, and request expiry is 5,000 ms. An inert generator captures the actual frozen context; its placeholder must not enter measured history. The coordinator's input `verified: true` is only the existing caller-assertion gate, and the captured facts must preserve their data and source IDs with `CALLER_ASSERTED_OBSERVATION` and no `verified` flag.

The original identity smoke, the six broader cases and one new holdout remain unbound. Build their ordinary adapter context with the selected profile, exact request, facts and history, omitting `speakerId`, `pawnId` and `generation`. The broader cases were originally unbound; manufacturing actor ownership for them would change the evidence being tested. A historical `speakerActorId` string inside their fact data cannot supply that ownership. Preserve the two broader cases' supplied generated histories exactly, still unverified and possibly undelivered. All other cases start with empty history. No actual answer from this evaluation is appended to another case.

Apply the separately reviewed experimental projector to that actual captured or deliberately unbound context, preserving the original context and exact transformed model messages for later review. No extra identity explanation may be inserted as an observation. Code-derived own/other/unattributed grouping must remain traceable to the original source, without new observations or stronger authority. Contradiction is data: if the projector safely rejects a case instead of generating a reply, record that outcome distinctly rather than substituting a repaired input.

Only the actual user-facing `specification.request` text belongs in the model's `request.text`. **Do not send** `provenance`, fixture `inputProtocol`, case expectations, forbidden claims, rationale, historical verdicts, source receipts or review instructions as part of the model context. Binding settings are inputs to the coordinator, not a pasted evaluation narrative. Administrative IDs and source references are correlation data, not spoken names. Continue to label all observations as synthetic caller assertions.

## Review and completion rules

Apply each imported source protocol and case criterion unchanged, and the same shared boundaries to the new holdouts. Every answer must be a brief natural radio response in its selected persona, within the existing 64-token/256-character limits. Naturalness remains part of the supplied-callsign requirement; three repetitions of a correct name must not be silently relabeled a full pass to improve the score. Conversely, awkward vocative wording is not automatically a claim that the speaker has that assigned identity.

Any forbidden claim or missing required meaning fails. A correct fragment or later disclaimer cannot rescue the complete answer. Empty output, truncation, timeout, rejection and an uninvoked generation are not semantic passes. A safe input rejection may separately demonstrate conservative projector behavior, but it is not completed conversation. Preserve unknowns and conflicts even if this reduces the number of generated answers.

Report all eighteen ordered cases and preserve every complete output, failure and unperformed case. Tally the fourteen known regressions separately from the four fresh holdouts, with factual attribution and presentation failures explained. Freeze the fixture before any new native inference, never retry a failed answer or tune criteria after seeing it, and save any future attempt under a new receipt rather than editing earlier results. Preserve source/model pins, timing, startup/primer cost, native finish reason where available, resource admission/minimums, and owned-process cleanup. Defaults and previous native results remain unchanged.

These eighteen single stochastic responses cannot estimate reliability, establish a causal improvement, accept full conversation, validate personal style or prove four-second first-spoken latency. Even universal success would be a narrow diagnostic result, with shipping-game observation, factual admission, combined speech performance and the full mod still unproven. Preparation creates no native worker and does not satisfy a future native run's fresh resource, ownership or supervision prerequisites.

## Preparation audit

An independent in-memory audit passed after freezing the fixture: eighteen unique cases, fourteen exact imported case copies with matching per-case/source hashes, four fresh holdouts, copied review protocols unchanged, and both prior native receipts/reviews/source maps matching their recorded hashes. Ten real coordinator captures with an inert injected generator preserved the intended speaker/profile/callsign, exact fact data and IDs, caller-assertion labels and empty measured histories. Eight cases correctly remain explicitly unbound. The audit started **zero native workers**, wrote no result receipt or harness, and does not evaluate the candidate projector or model. Only this evaluation note and the new fixture were authored by this workstream.
