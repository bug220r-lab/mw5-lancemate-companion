# SmolLM3 warmup attempt independent review

September 23, 2026 UTC / September 22 local. **PASS_MOCK_ONLY: no blocking source finding.** The second native attempt is **NOT_PERFORMED at this review checkpoint**. This review does not grant semantic, latency, speech or game acceptance.

The bounded rationale in [the experiment design](../design/SMOLLM3_WARMUP_EXPERIMENT.md) is supported by the unchanged first receipt: native READY after 5,723.712 ms, discarded primer failure after 10,005.2172 ms, null output/completion diagnostics, and all 26 measured cases NOT_PERFORMED. Its log records prompt processing at 256 tokens / 77 percent after about 8.59 seconds. This justifies one test of a separately budgeted initialization phase. It does not prove initialization was the only performance problem, that 20 seconds will suffice, or that later answers will be fast or correct. The eight new cases were not invoked in that attempt.

I independently hashed the first receipt as `ffd7341cf63f55d4994c3ddecc06eba5421f1c19e014c2365d0236928f5959ff`. Reading the exact Git blobs at `afb5c7c1cc5f9552622e8f3770363098f39d71cd` reproduced that receipt hash and its executed runner hash `fd3ae7557d85ee733244c6759a178c2595791283ae4ce55e73e36103592de663`. The current source is a new revision; the previous execution is not relabeled.

| Reviewed artifact | SHA-256 |
|---|---|
| Current `scripts/Exercise-ConversationModelTransfer.mjs` | `30adddbdbb62692faeb7dd568ce5b0dd312ecfa76a6aba65235993e25602b72c` |
| Independent `companion/tests/model-transfer-warmup-review.test.mjs` | `7a1da8d64f90738aeb374db3271ea582110919237c0e5bb374e830e8fcdfd8e8` |
| Implementation `companion/tests/model-transfer-warmup.test.mjs` | `e68a562b24119c7a0d3430be112ac68770cb59167ddc5a33cb40155e762e817b` |

**13/13 focused checks passed**, comprising five independent cases and eight implementation cases. Every worker, resource measurement and receipt write in those tests was injected. No native model was started by this review.

The reviewed delta enforces:

- Fixed `--run-warmup-002` and inert `--check-warmup-002` selectors; only the new fixed `research/SMOLLM3_WARMUP_DIAGNOSTIC.json` destination, opened exclusively. An existing receipt prevents another attempt, and arbitrary paths/options are rejected.
- Exact eligible predecessor hash, READY/pin verification, failed discarded primer, all 26 cases uninvoked, prior runner source hash and confirmed stopped ownership. Its source commit is recorded. The complete plan and linked installation evidence are rechecked before native reservation.
- Identical original primer and 26 ordered contexts, messages, projections, provenance and fixtures. Grading criteria remain outside model inputs. No new answer is placed into later context. The same eight fresh-at-first-invocation cases precede the eighteen exposed regressions.
- **20,000 ms only for the discarded primer; 10,000 ms for every evaluated response.** Model, prompt format, sampling, cache settings, output limits and resource gates remain unchanged. The 233-second work budget and seven-second cleanup budget are not enlarged. The original selector retains ten seconds for both phases.
- Each operation records its configured budget and elapsed time. The new attempt distinguishes `PRIMER_DEADLINE` from `RESPONSE_DEADLINE`; a completed primer's later timer cannot cancel a subsequent response. Failed output stays null, successful primer text is not an evaluation pass, and uninvoked cases remain NOT_PERFORMED.
- Existing one-owner teardown, fail-closed resource checks, completion validation and semantic-review-pending status remain. The focused tests verify a longer successful primer followed by a genuinely timed-out measured response, failed warmup with all cases uninvoked, exclusive receipt selection, rejected enlarged response budgets and forged-plan refusal.

Cold startup and primer costs must remain visible in the resulting receipt and review. The unchanged product goal is p95 first spoken response within four seconds; a ten-second diagnostic ceiling or successful initialization does not satisfy it. Resource sampling and cancellation remain reactive, and filesystem operations may drain beyond a deadline. One stochastic attempt cannot establish reliability, causal speedup, game-loaded performance or conversational quality. This review ends at prepared source and mock behavior; any actual result needs separate receipt and full-answer review.
