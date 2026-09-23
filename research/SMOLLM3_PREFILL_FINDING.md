# SmolLM3 prompt-processing finding

September 23, 2026 UTC. **OBSERVED receipt/source; one PROPOSED layout experiment, not implemented or executed.** No default, model, fixture or prompt source was changed for this analysis.

The [warmup receipt](SMOLLM3_WARMUP_DIAGNOSTIC.json), independently hashed as `ce3a0cd8238b4081433a4837782587bf35fc671e81f04251fc6d56e8dc392327`, records:

| Operation | Total elapsed | Native prompt processing | Native generation |
|---|---:|---:|---:|
| Discarded primer | 11,269.821 ms | 333 tokens / 11,093.997 ms; cache 0 | 3 tokens / 164.423 ms |
| Configured introduction | 8,499.8256 ms | 225 tokens / 7,733.423 ms; cache 155 | 10 tokens / 751.154 ms |

Prompt processing accounts for approximately 98.44% and 90.98% of the corresponding elapsed times. The next case exceeded its ten-second response deadline; it has no terminal token/timing metadata and must not be assigned an invented breakdown. This evidence identifies prompt processing as the dominant recorded cost in the two completed operations, not the sole cause of every timeout.

In `companion/local-language-model.mjs` (SHA-256 `5cd1f9ec9a872cf3c1d6a45344d6f73de295c94c0a2e0822fb9d28ffe6965902`), `briefingMessages` lines 108–112 places variable personality JSON before the static request-separation instruction. `smollmMessagesFor` lines 161–166 then appends the static system `/no_think` directive. The actual recorded messages confirm this order for the primer, edgy introduction and tactician question. The runtime log reports selection by longest-common-prefix similarity; reuse exists, but the variable personality can interrupt the shared prefix before those later constants.

**One narrowly justified next experiment:** move only the existing static request-separation instruction and system nonthinking directive ahead of the existing `Personality data: ...` segment, within the same system message. Preserve every word/value, using only necessary line separators. Keep both user messages byte-identical. Do not move persona data across roles, shorten instructions, reorganize observations, remove raw unsupported facts or history, insert answer examples, or change the actual request. This isolates a layout hypothesis without another wording search.

A read-only character comparison of that proposed ordering increases the system-content common prefix from 637 to 868 characters between primer/introduction, and 646 to 877 between introduction/tactician. It adds one separating newline. These are **character counts**, not tokenization results, cache-token guarantees or predicted milliseconds. Template rendering, token boundaries, cache policy, native scheduling and changed instruction order can affect both performance and meaning. The same-user reference still contains changing identity/readings; this proposal does not make the entire prompt static. Cold initialization remains visible and cannot be credited as a fast response through later cache reuse.

If pursued later, freeze one opt-in variant and exclusive receipt; retain the same primer, 26 ordered contexts, projection, criteria, model/runtime, sampling, 20-second primer/10-second response limits, resource gates and cleanup. Test transformation fidelity before one native run. Record actual cache/prompt/generation timings, failures and total cold costs, then independently review whole answers under unchanged criteria. Account for the two invoked new cases as now exposed; do not relabel the suite a fresh 26-case holdout. Do not retry or retune based on that output. No automatic semantic pass, causal speedup claim, four-second speech acceptance or game-readiness claim follows from this hypothesis.
