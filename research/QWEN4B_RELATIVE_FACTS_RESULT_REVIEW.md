# Relative-fact diagnostic: resource refusal review

September 22, 2026. **Startup was correctly refused; language evaluation is NOT_PERFORMED.** The real admission check found less than the unchanged five-GiB RAM requirement. No native model worker was constructed or started, and neither calibration nor any of the eighteen evaluated requests ran. This is a resource-preflight result, not a failure or success of the candidate's language quality.

The supervising task confirmed terminal process exit 1 before the reviewer opened [the receipt](QWEN4B_RELATIVE_FACTS_DIAGNOSTIC.json). It remains unmodified, with SHA-256 **`a4970f273317987ec2ab807dc4a23c3c362cadc6cea81a10b375094b84902771`**, recorded at **23:35:15.960 UTC** and completed at **23:35:15.966 UTC**. Its status is `INCOMPLETE`, with error `INITIAL_RAM_INSUFFICIENT`. `haltReason: null` is consistent with an admission exception before a running-worker resource halt.

| Check | Recorded outcome |
|---|---|
| Available RAM at admission | 5,360,328,704 bytes, **4.992195 GiB** |
| Required initial RAM | 5,368,709,120 bytes, **5 GiB** |
| Shortfall | 8,380,416 bytes, about **7.992 MiB** |
| Free disk at admission | **25.108 GiB**, above the ten-GiB gate |
| Native startup / primer | **NOT_PERFORMED** |
| Fourteen known regressions | **14 NOT_PERFORMED**, no outputs or timing counters |
| Four new holdouts | **4 NOT_PERFORMED**, no outputs or timing counters |
| Final runtime | `NOT_STARTED`, `ownedPid: null`, `ownedProcessStopped: true` |

The small RAM shortfall is not permission to round upward or lower the gate. An earlier supervisor reading slightly above five GiB cannot override the fresh admission reading. `minimumAvailableRamBytes` is null because the running-worker sampler never started; it is not a measured minimum or evidence about peak model memory. The receipt's approximately **5.785-ms** elapsed value describes the recorded admission/cleanup path, excluding earlier context preparation and source hashing. It is neither native startup nor response latency. Confirmed absence of an owned worker also does not constitute a test of native process shutdown.

The reviewer independently reconstructed the prepared contexts using the frozen [eighteen-case fixture](../synthetic/conversation-relative-facts-cases.json), SHA-256 `ec7106cd5a0518489cd46dcea24ef8f0ab6facfbff5c31f4f8b5716a889f9108`. All eighteen recorded case IDs/order, provenance, capture records, original contexts, classification-only context additions, full projector outputs/audits, transformed messages and character counts match. Ten contexts come from the actual coordinator with an inert injected generator; eight deliberately omit actor ownership. The primer also matches. Historical supplied generated dialogue remains only in its two original regression cases, unverified and possibly undelivered. No placeholder, criterion or actual answer was added to model input.

The embedded fixture matches exactly; all **nineteen** recorded source hashes match the files reviewed. Important pins include harness `5d33c7fb4102207cf21b4539dff13391fed7c38ca7513fde3b5bcb09c48a5bf5`, projector `4b402ff008389075df0cbe53d371de1b4dc9000a774e249682948c3be7725d6d`, adapter `3e53dd4901270cb250af3fdfa363b924da65108ace452b57cc8fb9b05d92fd4d`, and coordinator `19c1fd08a929d7f6c609e951a533f059475075592c8b04fbc2daa0e19d8494d0`. The recorded model/archive selection and extracted-runtime manifest match their lock metadata. **Installed native file verification did not execute**, because the model's startup path was never reached; matching metadata must not be reported as a fresh native artifact-verification pass.

Every sample has `status: NOT_PERFORMED` and `output: null`, with no generation elapsed time or native timing object. The receipt's `notPerformed` list contains exactly those eighteen IDs, and the primer is separately unperformed. There are no texts to score, no observed truncation and no finish-reason evidence. Semantic, latency, spoken-response, game-loaded resource and conversational acceptance remain unmeasured for this candidate. Its planned settings are not evidence that a native runtime actually adopted them.

No downloads, game/editor execution, audio generation, microphone capture, playback, default-model selection, default caching or default projection changes are recorded. The reviewer ran only read-only reconstruction with an inert capture generator and wrote this review; no native inference, retries, tests, new harness, resource-gate changes or edits to the raw receipt occurred.

The [prior identity failure set](QWEN4B_IDENTITY_RESULT_REVIEW.md) and [prior broader failure set](QWEN4B_PROMPT_CACHE_RESULT_REVIEW.md) remain valid for their recorded source versions. This refused attempt neither resolves those failures nor supplies additional model-quality failures. Earlier preparation documents describing the new receipt as absent are historical checkpoints; the exclusive receipt now exists and preserves this attempt. Any future native experiment requires a separately identified attempt and fresh resource admission; this review initiates none.
