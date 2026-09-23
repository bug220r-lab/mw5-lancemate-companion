# Configured callsigns in command previews

Status: implemented project parser, **MOCK_ONLY**. This does not establish speech-recognition quality, native command acceptance, live control or conversational grounding.

## Contract

`parseSpokenCommand` accepts the optional separate project field `callsigns: [{actorId, callsign}]`. Each of at most three rows joins its exact `actorId` to one structurally valid supplied binding. Actor IDs must be unique in this map. The row has exactly those two fields; callsign is null or a primitive string of at most 64 characters without controls. Unknown actor IDs, extra row fields, sparse arrays, accessors and malformed rows reject the map atomically. No alias is read from a profile, fact, binding decoration, history or generated request text.

Omitting the field preserves the existing explicit slot/actor grammar. Supplying null is an invalid map; supplying an empty array means no configured names. Existing binding eligibility, human push-to-talk/final-transcript provenance, selected-target and supplied-location prerequisites remain mandatory. Results remain `PROJECT_INTENT`, `dispatchable: false`, with the exact actor/pawn/generation binding. Global `disarm` retains its independent ability to describe all-control disarm without reading unused alias, binding, target or location metadata.

Accessed envelope/binding fields are copied through own data-property descriptors. Unused envelope and binding additions are ignored. Binding/alias arrays are bounded at three and the existing location lookup is bounded at 128. No supplied getter is invoked to obtain these fields. This is in-memory project input validation, not an authentication or observation-freshness mechanism.

## Normalization and display-only names

The shared `normalizeCallsign(value)` helper trims and collapses whitespace and lowercases ASCII A–Z only. Null or blank is unset. Invalid primitive type, overlength or control characters throw `INVALID_CALLSIGN`. There is no Unicode normalization, Unicode case folding, accent removal, homophone matching or punctuation substitution.

`callsignRoutability(value, {actorIds: []})` returns `{normalized, routable, reason}`. A routable name starts with an ASCII letter and contains ASCII letter/digit words separated by single spaces, apostrophes or hyphens. Reasons are `CALLSIGN_UNSET`, `INVALID_CALLSIGN`, `INVALID_ACTOR_IDS`, `UNSUPPORTED_CALLSIGN_CHARACTERS`, `RESERVED_CALLSIGN`, `ACTOR_ID_CALLSIGN_COLLISION`, or null for a routable name. Known actor-ID collisions compare ASCII case-insensitively.

These words are reserved as whole tokens, including inside names separated by spaces, hyphens or apostrophes: `slot`, `actor`, `callsign`, `regroup`, `focus`, `release`, `human`, `hold`, `disarm`, `reposition`, `to`, `location`, `and`, `all`, `everyone`, `lance`, `squad`. Unsupported names can remain saved display preferences. A selected unsupported name cannot become a routing alias. Duplicate normalized names are separately detected by the parser and clarify as `AMBIGUOUS_CALLSIGN`; they do not disable explicit slot/actor fallback.

## Grammar and ambiguity

Configured names work as exact selectors in the existing front/back verbs: `regroup Rook`, `Rook regroup`, `focus callsign Rook`, and `release human hold Rook`. Reposition retains `reposition Rook to location ridge`. The optional `callsign` prefix explicitly selects the name namespace. Lists may combine exact names and explicit selectors. Mentioning the same actor twice through different selectors clarifies instead of silently deduplicating.

Explicit `slot N` and `actor ID` selectors retain precedence over display names with those spellings. A whole configured compound name is checked before splitting other name selectors, so the display preference `Rook and Spark` cannot silently become two named recipients. Unknown/partial names clarify; no longest-substring or approximate matching is performed. Exact actor-ID alias joins remain valid if two bindings differ only by actor-ID case, but the ambiguous case-insensitive explicit actor selector clarifies.

The existing terminal `.?!` sentence punctuation handling remains. Before stripping it in a front-verb command, the parser checks its bounded suffix truncations against exact configured names, both whole selectors and list members. This prevents a saved display-only `Rook!` from being erased and selecting a different pilot called `Rook`, including `Rook!?`. Punctuation after the action in `Rook regroup!` remains usable. Explicit slot/actor selectors preserve their normal sentence-punctuation behavior. Commas are list separators, not supported vocative punctuation: `Rook, regroup` is not promised to parse. No natural speech-coverage claim follows from this small grammar.

## Validation and limit

Focused authored tests cover binding/order independence, normalization, collisions, same-actor repetition, missing prerequisites, untrusted origins, invalid maps, accessor rejection, unknown names, punctuation collisions, input immutability and ineligible recipients. The new 17 tests plus the existing radio/parser suite pass **63/63**. Independent review passes **32/32** additional adversarial cases and preserves the initially discovered terminal-punctuation failure in `research/CALLSIGN_COMMAND_REVIEW.md`.

All execution here uses synthetic bindings and text. No native speech/model worker, microphone, audio device, editor or game is used. Workbench wiring, asynchronous settings/preview invalidation and browser state comparison are separate changes owned by the parent workstream.
