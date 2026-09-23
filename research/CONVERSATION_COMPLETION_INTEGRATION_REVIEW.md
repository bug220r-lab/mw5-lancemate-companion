# Conversation completion: independent integration review

**PASS_MOCK_ONLY — 6/6 independent integration cases passed. Native validation: NOT_PERFORMED.** Reviewed 2026-09-22 local time. This review owns only its new test and this report; production changes belong to the supervising task.

The test uses the actual local language adapter, conversation coordinator inside the workbench, and radio director. Pinned-file verification, process creation, fetch/SSE, recognition and speech are supplied inert doubles. A transparent generator tap records outcomes but does not replace serialization, stream parsing or validation. There is no HTTP listener, actual network, native executable, model load, microphone, playback, editor or game. Audio bytes are a synthetic in-memory WAV fixture; no generated audio file is created.

## Verified propagation

The adapter rejects a terminal `length` stream with `GENERATED_TEXT_TRUNCATED`. A stream with `DONE` but no terminal reason, or `stop` followed by EOF without `DONE`, rejects with `INCOMPLETE_GENERATED_TEXT`. The actual coordinator maps these failures to `REJECTED / GENERATOR_FAILED`. None becomes a generated reply.

For each of these three failures, the suite independently verifies:

- No generated output is returned, no audio job appears, and synthesis/read requests are rejected. The radio has no queued or playing line, and fake synthesis/audio-reading counters remain zero.
- The subsequent request's actual serialized prompt and coordinator context contain empty history, proving that the rejected text was not retained for future generation.
- A subsequent valid `stop` plus `DONE` reply succeeds. It reaches the speech double only after explicit synthesis, and reserves the radio only after explicit audio retrieval. Native control calls remain zero.

A separate successful-completion case verifies that valid text enters history as `GENERATED_UNVERIFIED`, retaining its request/response association. Generation itself does not synthesize, play, parse or dispatch that text. The next real prompt contains exactly the earlier valid history entry.

The two remaining cases exercise asynchronous cancellation:

- An open stream containing partial text remains `GENERATING`; interruption cancels the actual reader and adapter, publishes nothing, and leaves empty history for the next request.
- Even after `stop` plus `DONE` has arrived, holding `reader.cancel()` keeps the generator slot occupied. Interruption during that cleanup prevents another overlapping request, ultimately rejects with `GENERATION_CANCELLED`, clears timing diagnostics and publishes no text. The next request again has empty history.

These outcomes confirm the actual downstream error mapping and speech/history boundary. They do not prove semantic correctness of a fully completed model answer. Native SSE compatibility, native cleanup timing, model quality and the four-second spoken-response target were not evaluated. Earlier native receipts lack this enforcement and remain historical evidence; this change does not retroactively certify or reclassify their outputs.

## Reviewed files

Command: bundled Node runtime with `--test companion/tests/conversation-completion-integration.test.mjs`.

| Artifact | SHA-256 |
|---|---|
| `companion/tests/conversation-completion-integration.test.mjs` | `8a5bcc47eaea4fd694a31d707701dafa9fddeee4912534b3fd40d39385c3f48e` |
| `companion/local-language-model.mjs` | `5dd6712ffdcfc17fc53d4ebba3903e414862ace20aa3bc9fb5542d3f73f5032f` |
| `companion/conversation.mjs` | `c661f2413a5323f59cd84617a566b83979580e1b24d16e9fa5ff8d8ff01e0c85` |
| `companion/server.mjs` | `5b5582726582feba25fa9fc0396360ff1868a8a284d72efc457a62dd977a5024` |
| `companion/radio.mjs` | `def9b360ad28b62f6115cd64b140a1e05eefa9e7ee944c4ad0003e956428e95d` |

No remaining integration defect was found within this bounded scope. Separate direct protocol tests cover malformed SSE details; this suite concentrates on the actual coordinator/workbench history and voice boundaries.
