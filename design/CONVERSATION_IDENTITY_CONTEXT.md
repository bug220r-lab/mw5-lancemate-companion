# Speaker identity at the local language-model boundary

2026-09-22. **Project interface; offline verification only.** The conversation coordinator already supplies a bound actor ID and the selected full personality. The earlier compact model adapter discarded the actor binding and removed `callsign: null`. As a result, first-person attribution depended on callers redundantly including identity inside observations, and an explicitly unset callsign was absent from the actual prompt.

`messagesFor` now includes a compact user-data object:

```json
{"speaker":{"actorId":"alpha","profileId":"scout","callsign":null}}
```

`actorId` comes only from the context's `speakerId`. `profileId` comes only from `persona.id`; it identifies a personality, not an actor or assigned spoken name. `callsign` is the configured spoken identity, preserving explicit null. Missing/null actor binding remains null and means unknown. Missing/null callsign means none was supplied; it does not authorize inventing one. The short system explanation distinguishes these meanings. Neither facts, user text nor generated history can populate the speaker object. These are project bindings, not newly discovered MW5 fields or authenticated game identity.

Compact personality style, traits and profanity remain in the existing system profile. Callsign moves to the explicit speaker object rather than being repeated. Current-observation and unverified/possibly-undelivered-history labels remain unchanged. Session, pawn, generation, ownership, expiration and fact freshness continue to be enforced by the coordinator, not by language-model inference. This change grants no control, dispatch, factual validation or playback permission and does not alter engine defaults, caching, output limits or generation deadlines.

The adapter rejects malformed explicit actor IDs and non-string/blank explicit callsigns instead of coercing them into identity. Direct diagnostic contexts may omit an actor binding; the adapter does not reconstruct it from a personality key or a `speakerActorId` field inside a fact. These direct contexts remain insufficient to verify the coordinator's actual binding path.

## Verification and limits

`companion/tests/conversation-identity.test.mjs` captures actual `createConversationCoordinator` contexts and passes them to the real serializer with an injected in-memory generator. It checks deliberately different actor/personality mappings, all three unset callsigns, a configured callsign, misleading draft/fact identities, pawn replacement, mission reset with changed actor/personality mapping, absent direct-context binding, source immutability and malformed identity. Results are **MOCK_ONLY**: passing establishes transport of the supplied identity, not whether a model follows it or whether it matches a game actor.

The focused September 22 run passed **67/67 checks**: nine new identity tests plus the existing conversation, independent conversation-review and local-language-model suites. No native executable or model was launched by those checks. Full-project verification is recorded separately by the supervising task.

## Compactness correction after full regression

The later full regression exposed a missed legacy check: default greeting prompts had grown to **784, 784 and 773 characters** for edge, tactician and scout, exceeding the earlier **less-than-650-character** heuristic. The focused 67-check run above did not include that independent greeting test. The supervising task preserved the [first failed receipt](../research/COMPANION_VALIDATION_IDENTITY_FIRST_RUN_FAILED.json) and [detailed failed receipt](../research/COMPANION_VALIDATION_IDENTITY_DETAILED_FAILED.json) rather than replacing them with a successful claim.

The corrected prompt retains the fictional-lancemate role, one plain radio line, approximately twelve words, untrusted-data rule, current-observation-only facts, unknown handling, generated/unverified/possibly-undelivered history, command/action prohibitions and no tools/code/reasoning. Identity remains explicit prose: `actorId is self; profileId is personality. Neither is a callsign. Null actorId is unknown; null callsign is unset. Never invent.` Redundant 64-token/256-character budget prose was removed from the prompt; the unchanged API token cap and independent output-character limit remain enforced and tested.

With the unchanged greeting request and full profile data, final message lengths including the ` /no_think` suffix are **720, 720 and 709 characters**. They are 64 characters shorter than the initial expanded prompts. Clear identity/null wording still needs more space than the old heuristic. The supervising task explicitly approved changing only that greeting compactness assertion to **less than 750 characters**. This is a reviewed developer heuristic adjustment, not a relaxation of the four-second spoken-response requirement, 64-token/256-character output caps, data limits or capability acceptance. Character counts do not measure token counts or native inference time.

The final focused run passed **75/75 checks**, including the independent greeting-bound suite, identity capture/diagnostic tests, local-language-model tests and existing cache/grounding preparation checks. The supervising task subsequently reports **734/734 full-suite checks passed** in [the final validation receipt](../research/COMPANION_VALIDATION.json). All are **MOCK_ONLY**. The native identity diagnostic remains **NOT_PERFORMED**; changed prompt bytes must be recorded by any future run. The frozen independent eight-case fixture and all prior generated answers remain unchanged.

The factual failures in the preserved Qwen reviews remain failures. Explicit actor/callsign information was missing, but the earlier history, fabrication and quoted-instruction cases already carried their relevant untrusted-data boundaries. This patch does not explain away those failures. In particular, generated drafts still enter history before playback and remain labeled unverified/possibly undelivered; a future delivery-aware history design would be a separate change.

An independently specified new identity evaluation should include counterfactual actor/personality assignments, known/unset callsigns, and teammate facts without redundant speaker-binding observations. Freeze required meaning and forbidden claims before inference; preserve all original outputs and timing. The original twelve grounding cases are now known regression cases, not a new holdout. No model execution or semantic acceptance is claimed by this implementation document.
