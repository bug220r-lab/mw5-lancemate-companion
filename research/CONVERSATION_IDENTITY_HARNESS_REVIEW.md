# Conversation identity diagnostic: independent harness review

Date: 2026-09-22. **PASS_PREPARATION_REVIEW, conditional on fresh supervisor resource/process checks before one future run. Native model/editor/game execution NOT_PERFORMED by this reviewer.**

This review concerns preparation of one bounded native diagnostic for the independently specified [identity fixture](../synthetic/conversation-identity-cases.json), frozen at SHA-256 `4ffda0d912a22828bd34a3fbc91b616a60d9b1b510b89576b70bf2f1c01385b1`. It does not authorize new model settings, retries, game integration, voice playback or model promotion. The [fixture and adapter review](CONVERSATION_IDENTITY_EVALUATION.md) preserves the semantic expectations and the previous six broader grounding failures.

## Review criteria

1. Import and `--check` are inert: no native worker, listener, audio, download or result receipt. Only fixed explicit `--check`/`--run` selectors are supported; no caller-controlled output path or tuning flags.
2. The exact fixture bytes are pinned before execution. Seven cases capture actual contexts from a fresh `createConversationCoordinator` using the documented synthetic bindings, clock and fact contract. The eighth unbound adapter smoke omits actor fields. Selected profile and callsign come from the prescribed settings. Capture placeholders, previous outputs and semantic expectations never enter measured messages.
3. Both counterfactual pairs preserve the planned unchanged fields. No additional speaker-binding fact can rescue the projection under test. Complete supplied messages and the original fixture are retained for later independent semantic review.
4. At most one independent discarded calibration and eight ordered case generations are attempted. No retry, answer-dependent modification or overlapping model instance is possible. Each measured request starts with its frozen captured context and empty history.
5. The proposed inherited configuration stays fixed: installed pinned CPU Qwen3-4B, four threads, 2,048 context tokens, compact 128/64 batches, no repacking, prefix caching for this diagnostic only, 64 output tokens and 256 characters. Generation and workbench defaults remain unchanged.
6. Before native startup, fresh admission requires five GiB available RAM and ten GiB disk. Every 250 ms a sampled two-GiB RAM floor triggers cancellation and owned-process shutdown. Existing ten-second per-operation, 233-second total work and seven-second cleanup bounds remain. These cooperative samples/timeouts do not constitute a hard memory reservation or real-time guarantee.
7. A unique exclusive receipt is reserved before engine construction/start; earlier receipts remain untouched. The supervisor checks editor/game and other model processes separately before any future run. No unrelated process is stopped.
8. Cancellation reaches startup and active generation; late promises retain handlers. Cleanup records owned-process shutdown independently from generation completion. Failed or cancelled samples do not inherit successful native timings. Cases never invoked remain explicitly `NOT_PERFORMED`, even if a sample was prepared before a resource guard failed.
9. Receipt evidence includes exact source/fixture/model/runtime identity, initial/minimum resources, startup and calibration time, individual outputs/timings, failure/stop details and remaining cases. Text completion is not a semantic pass or spoken latency. No model is enabled and no output is dispatched or played.

## Outcome

**PASS_PREPARATION_REVIEW after one accounting correction.** Initial harness review found `perform` set a sample to `RUNNING` and then awaited its receipt checkpoint before invoking generation, with that checkpoint outside the operation's `try/finally`. A resource/global cancellation or checkpoint rejection in that gap could leave a case `FAILED` or `RUNNING` even though the model was never called, excluding it from `notPerformed`. The corrected version keeps `NOT_PERFORMED` through checkpoint I/O, resamples RAM and checks cancellation afterward, then marks `RUNNING` immediately before invocation with no intervening await. Three new fake-I/O regressions exercise RAM loss, the global deadline and write rejection in exactly that window; all preserve the eight uninvoked cases as `NOT_PERFORMED` and stop the sole owned worker.

The reviewed preparation otherwise reconstructs the seven coordinator contexts and the eighth unbound smoke as specified, keeps expected answers out of messages, retains empty histories, reserves a separate receipt through an exclusively created file handle, preserves the proposed configuration/resource floors, and limits generation to one primer plus the eight cases. The underlying adapter checks installed file pins, confines HTTP to its owned authenticated loopback worker, and supports cancellation/owned-process termination. No acceptance or game-control path was added.

The design correctly records an inherited evidence limitation: the adapter accepts both `stop` and `length` terminal reasons but does not expose that reason to the receipt. `TEXT_COMPLETE_DIAGNOSTIC_ONLY` therefore means the adapter returned text, not that token truncation is ruled out. Preserve native `predicted_n` and judge any response at the token cap conservatively. This diagnostic does not justify broadening the adapter.

The reviewer independently ran `companion/tests/conversation-identity-diagnostic.test.mjs`: **18/18 PASS_MOCK_ONLY**. All native engine and receipt I/O in those lifecycle tests are replaced; real coordinator/serializer preparation remains exercised. The reviewer also ran the real harness's `--check`: **8 cases / 7 coordinator captures / 0 native workers / PREPARED_NOT_EXECUTED**. The exclusive native result receipt was absent afterward. These checks do not assess current RAM/disk readiness or native engine execution.

The source diff was inspected together with the imported startup-wait helper and the existing adapter lifecycle. Native `--run` reads the pinned fixture before preparing its plan, constructs one fixed engine only after receipt reservation and resource admission, and never overwrites the prior cache or grounding experiments. In-process test substitutions and shortened deadlines are code-only and mark resulting evidence `MOCK_ONLY`; they are not CLI tuning arguments. The successful fake run invokes exactly nine generations, while failed/cancelled runs stop without starting later cases.

The owned receipt handle is used for complete offset writes, truncation and synchronization at each checkpoint, so a failed attempt cannot quietly reserve a second path or overwrite an earlier experiment. It is closed in final cleanup. Filesystem reads/writes, resource sampling and termination attempts remain cooperative; the stated work/cleanup deadlines are not hard OS-level completion guarantees. The supervisor still owns a fresh process inventory and must not run this alongside the editor, game or other native model workers.

| Final reviewed artifact | SHA-256 |
|---|---|
| `scripts/Exercise-ConversationIdentity.mjs` | `de22abd67fd5bafe3055de6a9a341ee7472c5e3a9b71b730d5679941ae08e0d8` |
| `companion/tests/conversation-identity-diagnostic.test.mjs` | `6a0cb2927627a4cd59f06f2c7fda07c6d8d45ab94904c2a1e342b07eec21ad94` |
| `design/CONVERSATION_IDENTITY_DIAGNOSTIC.md` | `269d8b505372c378f9bdd09134ede8b4991958f9db04921de5cd84d33916e6e7` |
| Imported `scripts/Exercise-ConversationGrounding.mjs` | `50da99c88081092b27c5cfa4f800e3c462cf4aae53d1854fe349ab89232cc106` |
| `companion/local-language-model.mjs` | `08fcbc6c9f8e498f913cdd9c5a8fde0eb7180c7bb3db8063534044222377d744` |
| Frozen identity fixture | `4ffda0d912a22828bd34a3fbc91b616a60d9b1b510b89576b70bf2f1c01385b1` |

No observed browser behavior, model response, semantic pass, gameplay result, new deployment permission or complete-mod acceptance follows from this preparation verdict.

## Final serializer addendum

After the first harness review, full regression found the expanded identity prompt exceeded an older greeting-size heuristic. The [independent identity review](CONVERSATION_IDENTITY_EVALUATION.md) records the preserved failures, clearer final prose, final sizes and explicitly approved less-than-650 to less-than-750 heuristic adjustment. It preserves the actual four-second spoken target, hard 64-token/256-character output caps, trust/command restrictions and all identity data. The table above now pins the final adapter and documentation bytes; the earlier adapter was `d422f1ee85f38013289191c4e7e2114ad4991567c66c02d5e9cdb6ed786860e2` and earlier design note was `16b3e1848093cea2a0b88c7afd77ce593ec40863a04c0ff9335e7d4315b49de8`.

Harness code, lifecycle tests and the frozen fixture did not change. The reviewer reran in-memory preparation and checked all eight projected identities and messages with the final serializer, without a model. Native execution remains **NOT_PERFORMED** and the eventual receipt must record these changed prompt/source bytes. The source-supported preparation verdict remains conditional on the supervisor's fresh resource/process checks; it is not conversational or performance acceptance.
