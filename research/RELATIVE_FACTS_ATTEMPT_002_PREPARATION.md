# Independent preparation review: relative-fact attempt 002

Date: 2026-09-22. **PASS_MOCK_ONLY for the fixed attempt selector and evidence-preservation changes.** Nine independent tests passed with zero failures, skips or cancellations (204.7626 ms). Tests used real inert coordinator captures, fake engine objects and in-memory receipt I/O. No native inference, model process, microphone, audio, editor, game or actual attempt-002 receipt was started or created by this reviewer. This document is a preparation checkpoint, not the result of the proposed native run.

## Evidence continuity

The predecessor remains `research/QWEN4B_RELATIVE_FACTS_DIAGNOSTIC.json`, SHA-256 `a4970f273317987ec2ab807dc4a23c3c362cadc6cea81a10b375094b84902771`. Its actual outcome was `INITIAL_RAM_INSUFFICIENT` before any native worker was constructed: the primer and all eighteen cases were `NOT_PERFORMED`, with null outputs and final runtime `NOT_STARTED`. A new attempt does not overwrite or reclassify that refusal.

Independent reconstruction matched the predecessor's embedded fixture and all eighteen case IDs/order, provenance, capture metadata, original contexts, classification-only additions, full projection/audit, transformed messages and message sizes. The primer's original context, marked context, projection, messages and size also match exactly. Ten contexts still use the actual coordinator with an inert placeholder, while eight remain explicitly unbound. The fixture remains fourteen previously diagnosed cases plus four predeclared holdouts. Criteria remain outside prompts. The current coordinator has a later source hash than the predecessor; its captured contents for this fixture are independently proven equal, rather than presumed unchanged from the source hash.

## Reviewed change and limits

`--run-attempt-002` is a single fixed selector for `research/QWEN4B_RELATIVE_FACTS_ATTEMPT_002.json`. It cannot specify another path, attempt number, model, dependency injection, thread count or lowered gate. The original `--run` target and inert `--check` behavior remain intact. The second plan carries exact attempt/predecessor metadata, deep-frozen during preparation; execution re-reads the predecessor and rejects altered or missing metadata before receipt reservation. The predecessor reader requires the exact hash and explicitly checks its admission-refusal accounting.

Both receipt paths use exclusive `wx` creation. Independent fake-filesystem checks preserved the predecessor bytes, wrote only the second fixed path and refused a second open before any write. Execution refusal for an existing receipt constructs no engine. The native CLI uses real memory/disk readings, the standard local model factory and normal receipt I/O. Test substitutions are code-only and always label their reports `MOCK_ONLY`; there is no CLI switch or data field that can inject those substitutions into production execution.

The implementation retains five-GiB initial RAM admission, two-GiB running reserve and ten-GiB free disk. Independent cases reject even one byte below each initial threshold before constructing a fake worker. The unchanged model settings are Qwen 4B, four CPU threads, compact 128/64 batching, caching enabled, no weight repacking, 2,048 context tokens, 64 output tokens and 256 output characters. Limits remain ten seconds per generation, 233 seconds of work, seven seconds for cleanup and 250-ms resource sampling. An injected successful run performs one primer plus eighteen cases, retains all original contexts and invokes one owned stop. Existing halt-first-failure, unperformed-case accounting and shutdown logic were not refactored by this change.

The second receipt's source list now includes this frozen preparation review and the independent tests. Its raw report must still be adjudicated after terminal completion against the frozen criteria, preserving full outputs and possible truncation uncertainty. No reliability, naturalness, latency, first-spoken-response, game-loaded resource or full-conversation acceptance follows from this preparation pass. The earlier identity and broader factual failures remain evidence for their recorded source versions.

## Source pins at review freeze

| File | SHA-256 |
|---|---|
| `scripts/Exercise-ConversationRelativeFacts.mjs` | `60dfd55c6eb942b1ccd49f3cbc3f45939b93b6b1c79837e4a70fd890ae9a394d` |
| `companion/tests/conversation-relative-facts-diagnostic.test.mjs` | `90518aa8a096131d2cfe06fd9368da53e1cea390fe3688e4a0b2665ab7138f59` |
| `companion/tests/relative-facts-attempt-review.test.mjs` | `cf5f003d149d15c45ce92322fe6cb38650443aa8343572a48f4a4a19012c6865` |
| `companion/conversation.mjs` | `c661f2413a5323f59cd84617a566b83979580e1b24d16e9fa5ff8d8ff01e0c85` |
| `companion/local-language-model.mjs` | `3e53dd4901270cb250af3fdfa363b924da65108ace452b57cc8fb9b05d92fd4d` |
| `companion/speaker-observations.mjs` | `4b402ff008389075df0cbe53d371de1b4dc9000a774e249682948c3be7725d6d` |
| `synthetic/conversation-relative-facts-cases.json` | `ec7106cd5a0518489cd46dcea24ef8f0ab6facfbff5c31f4f8b5716a889f9108` |

At review freeze the second receipt was absent. This is a historical preparation observation; a later explicit run may create it exactly once. Fresh admission by that run is still necessary, regardless of any earlier supervisor RAM snapshot.
