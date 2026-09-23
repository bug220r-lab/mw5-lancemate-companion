# SmolLM3 static-prefix preparation review

September 23, 2026 UTC. **PASS_MOCK_ONLY for reviewed preparation and execution safeguards; no blocking finding.** Native inference for this variant is **NOT_PERFORMED at this checkpoint**. This report does not accept semantic quality, speed, speech or game integration.

| Reviewed source | SHA-256 |
|---|---|
| `companion/local-language-model.mjs` | `840e38296555cbda077b9e3290b308dbf7acc055e4c7b2b422e3119b3b2015d3` |
| `scripts/Exercise-ConversationModelTransfer.mjs` | `e4a66ff4881e06450c2fa7a65722f541157cd12f757a422b4c3366fcd25d1320` |
| Independent `companion/tests/smollm-static-prefix-review.test.mjs` | `5a60dbe1a7f586b5fbb6560599be20682bbb0af9b54473c3a6cf841fdf4bade2` |
| Adapter `companion/tests/smollm-static-prefix.test.mjs` | `46135aaa9a99d146c03a074aac42e6d5b37874f119d1be38ccee2a517a4a0a9c` |
| Runner `companion/tests/model-transfer-static-prefix.test.mjs` | `cf664a20dbcb9f45ef8e24f8712e3ebf9b40bf84a8dac0d5aac210312f0dd43a` |

The independently run focused suite passed **19/19** checks: seven review cases, six adapter cases and six runner cases. Model-file verification, process events, HTTP responses and receipt writes used injected test dependencies; frozen fixtures and historical receipts were read directly. No native model, microphone, audio device, editor or game was run.

## Findings

The opt-in formatter constructs the existing system content from known validated components: unchanged base instructions, unchanged request-separation instruction, system `/no_think`, then the unchanged personality JSON segment. It does not search untrusted persona text for delimiters. Across the recorded primer and 26 cases, the result adds exactly one newline; every existing word/value remains, both user messages are byte-identical, and contexts are not mutated. Omitted/false flags preserve all recorded default SmolLM3 messages; historical Qwen messages also remain unchanged. Changing instruction order can still change model interpretation, so structural preservation is not a semantic-success claim.

Adversarial persona strings containing instruction-like delimiters, quotes, slashes and thinking markers remain exact JSON data. Raw unsupported facts and unverified generated history remain in the reference, including their disclaimers. Extra evaluation annotations never enter the messages. Context getters are rejected without execution; the synthetic-only and complete-prompt bounds remain. These checks prove representation boundaries, not that a native model will resist every malicious string.

`experimentalStaticPrefix` is a strict boolean. Enabling it requires SmolLM3 and all three existing experimental prerequisites; Qwen/public generic formatter paths reject activation. Runtime status reports it only when enabled. An independent mocked adapter request matched the runner's prepared message bytes exactly, with unchanged sampling, output bounds, caching and disabled-thinking settings. The runner passes the option explicitly and refuses generation if runtime status does not confirm it.

The runner verifies the exact warmup predecessor `ce3a0cd8238b4081433a4837782587bf35fc671e81f04251fc6d56e8dc392327`, its completed primer/first response, second response failure, remaining 24 unperformed and stopped ownership. Baseline contexts, projections, fixtures and messages are compared before transformation. The prior adapter/runner blobs independently match their recorded hashes at Git commit `682e142854d64661bd93459f99635e9c39d9e1cf`; historical execution is preserved. The new receipt distinguishes two exposed transfer cases, six uninvoked at baseline and eighteen historical regressions, retaining original provenance and frozen grading criteria.

The only new destination is the exclusively opened `research/SMOLLM3_STATIC_PREFIX_DIAGNOSTIC.json`. Existing evidence or a forged plan/path/criterion/exposure refuses execution before construction. Preparation is inert. Model pins, CPU settings, 20-second primer, 10-second evaluated responses, 233-second work budget, seven-second cleanup, 250-ms sampling, five-GiB initial RAM, two-GiB running RAM and ten-GiB disk gates remain unchanged. Response timeout cannot reuse primer completion metadata; failed output stays null and later cases remain unperformed. Completion remains pending independent semantic review.

The [predeclared experiment](../design/SMOLLM3_STATIC_PREFIX_EXPERIMENT.md) tests a cache-layout hypothesis. Character-prefix growth is not proven token reuse or latency gain. Cold costs, failures, process cleanup and full-answer quality must be assessed from the eventual immutable native receipt; the four-second spoken-response target and game-loaded resource requirements remain unproved.
