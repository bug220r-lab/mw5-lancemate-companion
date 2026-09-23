# SmolLM3 transfer runner independent review

September 23, 2026 UTC / September 22 local. **PASS_MOCK_ONLY for the reviewed supervisor; native loading, template handling and answer quality NOT_PERFORMED in this review.** No blocking finding remains in the reviewed source. This is permission-independent preparation evidence, not acceptance of mission conversation or game control.

Reviewed fixed source:

| Artifact | SHA-256 |
|---|---|
| `scripts/Exercise-ConversationModelTransfer.mjs` | `fd3ae7557d85ee733244c6759a178c2595791283ae4ce55e73e36103592de663` |
| `companion/local-language-model.mjs` | `5cd1f9ec9a872cf3c1d6a45344d6f73de295c94c0a2e0822fb9d28ffe6965902` |
| Independent `companion/tests/model-transfer-review.test.mjs` | `ff6ffbbfa711d7fd05aa651d839472b957e7f51a432d05de89e412dfc6ef3ec5` |
| Implementation `companion/tests/conversation-model-transfer-diagnostic.test.mjs` | `fc9e9581c3ffa17df0b8300c78fe5d0dafa3c306f33a1eefb0f62a7cb6a9f453` |

The final focused run passed **28/28** tests: twelve independently authored cases and sixteen implementation cases, all using injected workers, resource readings and in-memory receipt writes. No process, model inference, microphone, audio playback, game or editor was started. Root separately reported its full 1,121-test run; that report is not substituted for this independently observed focused result.

## Reviewed boundaries

- Preparation rechecks the frozen eight-case fixture, preserved evidence and exact predecessor `b76aee167224bcd9cfd199ece83bd2a07ef02ec71cd60445c2df41a1712ec5ea`. It reconstructs the old eighteen contexts and verifies their original contexts, projections, capture records and provenance against that receipt. The order is eight new direct synthetic contexts, then eighteen exposed regressions. A primer precedes them. Invocation exposes a fresh case; an uninvoked case remains NOT_PERFORMED.
- Each input is built from its context alone. Criteria remain in receipt fixtures, outside messages. The candidate formatter retains the reference briefing and exact original final request, moves the formatter's nonthinking instruction to the system message, and keeps template `enable_thinking:false`. This changes the model family and its required formatting; it is not a pure same-prompt model comparison. The unbound sixth fresh case remains unbound, including when its request names an actor. No actual generated answer becomes later history.
- The final installation gate checks exact model/version/size/hash fields and links the verified setup bytes to the bounded metadata report. Native execution repeats that check before receipt reservation. The adapter independently verifies the actual model/runtime files. These checks do not establish native architecture or template compatibility. The ordinary custom-system template branch's missing explicit end marker, recorded in [the metadata assessment](SMOLLM3_METADATA_ASSESSMENT.md), remains unchanged and untested natively here.
- The CLI accepts only fixed `--check` or `--run`. Real execution reserves the single new receipt with `wx` before constructing an engine, revalidates the complete plan, requires initial 5-GiB RAM and 10-GiB disk admission, then monitors the 2-GiB RAM floor. CPU threads, context/output limits, batching, caching and all three experimental flags are checked against runtime status. No retry or arbitrary path/model option exists.
- Each invocation has a 10-second deadline; the work budget is 233 seconds and owned cleanup waits at most seven seconds. These are reactive cancellation limits, not an OS-enforced total duration: filesystem operations can drain after cancellation. The independent delayed-disk case confirms no later worker starts after the global deadline.
- Confirmed `stop` is required for returned text. A rejected `length` stream can retain its terminal diagnostics, but failed output stays null. Generic failure, missing completion, cancellation and late responses cannot borrow successful metadata. The first failure ends the run; later cases remain unperformed. Completed transport never assigns semantic PASS.
- Teardown uses one shared stop operation. Rejected stop, retained ownership and cleanup deadline cannot become clean completion. Partial receipt writes are completed; zero-progress writes reject. A checkpoint error remains an error while owned teardown and receipt close still occur.

The independent tests also exercise concurrent receipt admission, RAM loss during generation, an abort-ignoring late response, interruption/listener removal, startup failure, aborted truncation and invalid returned text. They establish supervisor outcomes with mocks, not the native model's responsiveness, resource use, correct answers or restoration of game AI. Native results require a separate immutable receipt and full-answer semantic review under the frozen criteria.
