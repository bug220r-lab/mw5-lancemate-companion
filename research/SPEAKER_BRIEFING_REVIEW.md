# Independent speaker-briefing review

**Result: PASS_MOCK_ONLY for the reviewed representation and opt-in boundaries. Native model evaluation: NOT_PERFORMED by this review.** Reviewed 2026-09-22 local time. No claim of improved generated answers, latency, speech quality or game integration follows from this result.

## Scope and findings

The experimental briefing renders the existing speaker-relative projection as prose. It changes model input, not authored pilot output or the underlying observation classification. It remains disabled by default, requires both experimental flags and a `MOCK_ONLY` context, and does not supply game authority.

Two initial wording issues were reported and corrected by the implementation owner before the final test: the unconditional prohibition on claiming order acceptance is explicit again; a missing own metric is described as a missing reading for that metric, rather than implying that all observations of the actor are absent. The reviewed system also retains the fictional role, concise radio format, unknown/conflict handling, data-versus-instructions boundary, and bans on tools, code, reasoning, invented facts and command execution. History remains generated, unverified and possibly undelivered. No remaining source-level blocker was found within this scope.

The independent pure suite in `companion/tests/speaker-briefing-review.test.mjs` passed **13/13**. It checks:

- Explicit actor binding alone determines own readings despite crossed personality identifiers, reordered rows and counterfactual binding changes. Other listed actors are not promoted to teammates.
- Unknown speaker binding, known speaker with missing readings, and separate unknown-actor rows retain different meanings. Selected-weapon ammunition never becomes whole-mech ammunition or firing capability.
- Mixed root/list conflicts, unsupported-only values, supported-plus-unsupported evidence and repeated reports preserve all relevant alternatives/references without choosing an unsupported winner. Unsupported original raw fact data remains exactly the projector's data.
- Configured versus unset callsigns, hostile quoted values, raw facts, history and requests retain their data boundaries. Original contexts are not mutated. Accessors and prototype traps are rejected without invocation.
- All historical eight identity-case messages plus their primer remain byte-for-byte equal with the briefing flag absent or false. All historical 18 projected-case messages plus their primer likewise remain equal with relative projection enabled and briefing absent or false.
- Invalid flag combinations/provenance and existing request, fact-count, history-count and prompt-size limits reject. Constructing an inert test adapter starts nothing; the context/output limits remain 2,048 tokens, 64 output tokens and 256 output characters.

An initial independent-test expectation incorrectly treated an explicit `undefined` classification property as an omitted property. The existing data copier correctly rejects `undefined`; the test was corrected to check omitted and undefined cases separately. Production validation was not relaxed.

## Cost and limits

Pure reconstruction of the frozen 18 contexts produces **1,468–1,788 content characters** per briefing (primer: **1,340**), including the no-thinking suffix. Earlier projected messages were 985–1,396 characters. This is a readability experiment, not a compactness result. Character counts do not establish token cost or speed. The four-second acceptance target is unchanged; prior latency and semantic failures remain evidence. Prompt wording and escaping alone do not prove that a native model will obey the boundaries.

This review executes no model, game/editor, microphone, audio or native worker. It does not adjudicate newly generated answers. Native tests and their raw evidence, if subsequently produced, need separate review against the unchanged criteria.

## Reviewed source and preserved evidence

SHA-256 values at final review:

| Artifact | SHA-256 |
|---|---|
| `companion/local-language-model.mjs` | `4a40f247c804136ea49b04af33fc1c1b9f638b3a03bea3931ff00017094cb127` |
| `companion/speaker-observations.mjs` | `4b402ff008389075df0cbe53d371de1b4dc9000a774e249682948c3be7725d6d` |
| `companion/tests/speaker-briefing-review.test.mjs` | `a0360473c9e815109c501553f12afdad3d6e6f3f5468e56c9f91ec0ecdbb3970` |
| Frozen `synthetic/conversation-relative-facts-cases.json` | `ec7106cd5a0518489cd46dcea24ef8f0ab6facfbff5c31f4f8b5716a889f9108` |
| Preserved `research/QWEN4B_IDENTITY_DIAGNOSTIC.json` | `48dc661b39d0db57d20bdac4be667b8892f0919273b78d352042b8c85586b827` |
| Preserved `research/QWEN4B_RELATIVE_FACTS_ATTEMPT_002.json` | `e227f94995bab1c44a3296c50202c995e36c9b25d2302f0cd1d05bd6266fb67b` |
| Preserved `research/QWEN17B_RELATIVE_FACTS_DIAGNOSTIC.json` | `456ae004e7497fe9d90a574b218a1da2c47d26b4546c87d21c5133f9d26137a3` |

The projector and frozen fixture are unchanged. Existing native receipts and their reviews were not modified. The test command used the bundled Node runtime with `--test companion/tests/speaker-briefing-review.test.mjs`; all work was project-local and synthetic.
