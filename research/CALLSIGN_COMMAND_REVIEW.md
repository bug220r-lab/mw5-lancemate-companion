# Configured callsign command review

Scope: independent, offline parser and saved-settings review. All exercised identities, commands and observations are **MOCK_ONLY**. A parsed project intent is not a human-order receipt, native assignment or game action.

## Cases specified before implementation results

The review will exercise exact configured names without fuzzy matching; normalized duplicate names; overlapping multiword names; aliases containing recipient separators, explicit slot/actor syntax or action words; Unicode, punctuation and substring differences; conflicting mixed selectors; unavailable or stale binding authority; and malformed, accessor-bearing or oversized alias inputs. It will check that persona names, model output, history and fact data do not provide aliases or authority.

The parser must preserve explicit slot/actor fallback and copy its binding evidence from the current bindings, not from alias metadata. Successful intents must remain non-dispatchable. Ambiguous inputs must not resolve to an arbitrary recipient.

The separately coordinated saved-settings review will assess persisted names, name changes during pending work and old transcript/preview behavior. The workbench currently has an immediate parser preview, not a confirmation or native dispatch stage; the review will not invent one.

## Settled bounded grammar

The implementation owner specified an optional `callsigns` array of at most three plain `{actorId, callsign}` records. Actor IDs join the current binding exactly. The names are settings data, not bindings or evidence that the actor is alive, AI-owned or controllable. Case-insensitive explicit actor lookup must still clarify when distinct binding IDs differ only by case.

Supported names use ASCII letters, digits, spaces, apostrophes and hyphens, begin with an ASCII letter, and match a complete selector after ASCII case/space normalization. There is no Unicode normalization, accent removal, fuzzy matching or phonetic matching. Other display names remain usable in the UI but cannot route commands. Reserved grammar tokens, collective names and names equal to known actor IDs are unavailable as callsign selectors; explicit slot/actor fallback remains available.

Duplicate normalized names are ambiguous only when selected. Whole configured names are considered before recipient-list splitting, so a saved name containing `and` cannot silently select two pilots. Optional `callsign Name` syntax makes the selector explicit. Unsupported punctuation is not discarded. The existing terminal sentence punctuation handling does not establish acceptance of common vocative commas such as `Rook, regroup`.

## Observed defect before correction

The first source passed the initial 31 independent cases. Subsequent source review identified an untested collision caused by the existing terminal-punctuation stripping. A new executable regression then **failed 0/1** on:

- `companion/callsigns.mjs` SHA256 `10A4CB0E2389263FB47538793D5039D73E1AA16DCD5A07558437682E9876132D`.
- `companion/radio.mjs` SHA256 `DF897A527197929E1EFE30EDC104EB7F999A871B8021C572AA28E71884904650`.

Input: actor `alpha` has the display-only callsign `Rook!`; actor `bravo` has the routable callsign `Rook`. Text `regroup callsign Rook!` returned a `REGROUP` intent for **bravo**, after stripping punctuation erased the exact configured alpha spelling. The new test requires clarification/rejection rather than arbitrary selection, and covers `!`, `?`, `.` and `...`, additional sentence punctuation, mixed named/explicit recipients, comma-separated lists and both action positions. Unambiguous action-final `Rook regroup!` remains usable for bravo. This was an independently observed parser error, not an executed game command.

The correction examines the bounded terminal `.?!` truncations before selecting a recipient, comparing whole configured selectors and then individual list parts. Unsupported saved spellings and duplicate matches produce clarification; explicit slot/actor fallback keeps its precedence. Re-reading the corrected branch and running the expanded regression found no remaining instance of this defect.

## Result

**32/32 PASS_MOCK_ONLY**, zero failures, skips or cancellations, on 2026-09-22. The initial 31 passes did not supersede the subsequently observed failing collision case; the corrected 32-case run includes it. No native inference, server listener, browser, microphone, audio device, editor or game was executed by this review.

Reviewed implementation:

| File | SHA256 |
|---|---|
| `companion/callsigns.mjs` | `10A4CB0E2389263FB47538793D5039D73E1AA16DCD5A07558437682E9876132D` |
| `companion/radio.mjs` | `DEF9B360AD28B62F6115CD64B140A1E05EEFA9E7EE944C4AD0003E956428E95D` |
| `companion/tests/callsign-command-review.test.mjs` | `FC083361D76A227E64AA8521D6FA492B72F0FF47F1C994B882FEDF7BC38ECD4D` |

The review covers exact names, both action positions, optional `callsign` prefix, multiword overlaps, ASCII apostrophes/hyphens, duplicate names, reserved selectors/actions, hostile punctuation, Unicode lookalikes, unset names, malformed/oversized maps, ordinary accessor and coercion payloads, prototype-like names, immutable inputs, six alias/binding array permutations, case-colliding actor IDs, current possession/death/invalidation, copied binding evidence and independent target/location prerequisites. Every successful test intent remains `PROJECT_INTENT` with `dispatchable: false`.

Reproduction command: the existing bundled Node runtime with `--test companion/tests/callsign-command-review.test.mjs`. Implementation-owner and full-suite results are separate from this independently executed 32-case result.

## Saved-settings boundary and limits

Static inspection of the root-owned server wiring found that `commandNames()` reads saved settings and passes `{actorId, callsign}` separately from current synthetic bindings. The HTTP command body cannot install an alias map through this path. The returned command preview remains `MOCK_ONLY`, uses `TYPED_TRANSCRIPT_FIXTURE` provenance and is non-dispatchable. Its context token is a project comparison value, not authentication or a game observation.

The separate async reviewer reported 13/13 inert server/UI checks covering rename cancellation before persistence, pending-save gates, failed persistence retaining old names while leaving old captures cancelled, same-trimmed-name preservation and delayed-preview suppression. Those checks were not run by this reviewer. The pure parser itself intentionally uses the current supplied map; retained typed text can only be explicitly reparsed against current saved names. There is no confirmation or dispatch stage here.

Passing these cases does not authenticate `human_ptt`, prove microphone accuracy, establish freshness of external data, authorize a native action or establish gameplay quality. Unicode display names and unsupported punctuation still require explicit slot/actor fallback. Supported-accessor rejection is exercised on ordinary JavaScript data records, not arbitrary user-authored executable Proxy traps. Live voice recognition, live recipient identification and game execution remain **NOT_PERFORMED**.
