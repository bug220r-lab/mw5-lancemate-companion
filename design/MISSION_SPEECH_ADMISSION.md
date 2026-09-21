# Authored mission-status admission

2026-09-21. Implemented project interface; native integration and live speech remain NOT_PERFORMED. This is a limited authored mode, not acceptance of full conversation.

The paired Qwen diagnostic produced false order-acceptance and mission-success claims. Its failures remain recorded in `research/QWEN_CONVERSATION_QUALITY_REVIEW.md`. Prompt instructions, a `GENERATED_UNVERIFIED` label and valid fact IDs did not establish that the words were true.

`companion/mission-speech.mjs` therefore accepts a closed query and typed reports, then selects fixed authored text. It accepts no generated prose, history, arbitrary fact JSON, callsign or target name. This provides a checkable wording boundary without claiming that an upstream report is true.

| Supplied stage | Required project source kind | Permitted claim |
|---|---|---|
| SUBMITTED | DISPATCH_RECEIPT | Request submitted; acceptance unconfirmed |
| ASSIGNED | NATIVE_ASSIGNMENT | Order assigned; execution unconfirmed |
| BEHAVIOR_OBSERVED | INDEPENDENT_OBSERVATION | Behavior observed; completion unconfirmed |
| COMPLETED | MATCHED_COMPLETION | A matching completion report exists |
| REJECTED | DISPATCH_REJECTION | Request rejected |

These source kinds are **proposed project interfaces**, not MW5 functions or authenticated evidence. A caller cannot set `GAME_OBSERVED` or `verified:true` to upgrade them. `MOCK_ONLY` lines start with “Simulation:”; `CALLER_ASSERTED_EVIDENCE` lines start with “Unverified report:”. Every output remains `liveEligible:false`, `dispatchable:false`, `audioGenerated:false`.

The current vocabulary covers regroup, focus-target and reposition status. A matching report must carry the exact mission, action ID, actor, pawn and generation. Only one current report per action ID is allowed; lifecycle history belongs in a separate ledger. Conflicting, stale, future, malformed or differently bound evidence is rejected. Missing action evidence produces an uncertainty line. Mission-outcome and target-status queries always produce uncertainty in this version: no validated observation mapping yet supports a kill or victory claim. An action-completion report cannot imply either.

`prepareMissionSpeech(request, context)` returns an authored receipt. `revalidateMissionSpeech(receipt, currentContext)` recomputes its words and compares the complete receipt against the original preparation time. It checks current identity, ownership, life state, phase, evidence and expiry without extending the deadline. Changed wording or supporting evidence invalidates the old receipt. Return values are detached JSON, not immutable capabilities; consumers must revalidate. The caller still owns observation continuity and trustworthy actor bindings. Neither function authenticates an adapter, establishes stage provenance, dispatches commands or plays audio.

The workbench **Action status** button maps only its own in-memory simulated control ledger. HTTP requests can select a pilot/query but cannot submit text, reports, stages or classifications. The ledger retains the submitted intention's action name rather than recovering it from an ID string. The display is a text-only preview, outside the radio queue, generator history and voice synthesis path. No language model is needed. Existing arbitrary conversation remains an explicitly unverified offline audition; this feature does not repair that model's factuality.

There are two expiry checks: supporting evidence uses recorded simulation time; the preview also expires after five real seconds even if the simulation clock stops. Reset, simulation control changes and interruption discard the preview. State reads revalidate, and the page refreshes while a status is displayed. An old diagnostic receipt is historical evidence, not fresh mission state.

Before connecting this path to audio or a real observer, establish the actual adapter's observation/action-result mappings and provenance, then revalidate supporting values after synthesis and again immediately before playback. Add the radio's speech gates, playback cancellation and real clock transport tests. Do not turn this text-only prototype into an implied shipping-game or speech acceptance result.
