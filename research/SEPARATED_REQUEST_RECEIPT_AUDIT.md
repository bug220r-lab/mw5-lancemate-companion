# Separated-request native receipt audit

September 22, 2026 local — **PASS_READ_ONLY_RECEIPT_AUDIT; native diagnostic INCOMPLETE**. This audit checks recorded inputs, configuration, failure accounting and cleanup. It makes no semantic verdict on the returned answers and starts no model.

The immutable [receipt](QWEN17B_SEPARATED_REQUEST_DIAGNOSTIC.json) has SHA256 **`B76AEE167224BCD9CFD199ECE83BD2A07EF02EC71CD60445C2DF41A1712EC5EA`**, recorded **2026-09-23 01:11:19.521–01:12:13.348 UTC**. Root confirmed supervisor session 95520 terminated with exit 1 before this audit. Recorded status is `INCOMPLETE`, error `GENERATED_TEXT_TRUNCATED`, halt reason `OPERATION_FAILED`.

## Source, configuration and input consistency

An independent read-only Node inspection hashed **all 34 recorded source files** against the receipt; all matched. The prior briefing receipt still hashes to `F63A50B7D1C20D98CE106FBB4A907DD03BB75FECD972C29B1645AD30C47B8389`. The embedded fixture exactly matches the unchanged eighteen-case source, SHA256 `EC7106CD5A0518489CD46DCEA24EF8F0AB6FACFBFF5C31F4F8B5716A889F9108`.

Reconstruction through the real preparation path, with inert coordinator capture only, reproduced **all nineteen planned contexts, projections/audits and exact messages**: the discarded primer and eighteen cases. Original contexts/projections equal the predecessor's; each reference message preserves its exact prior briefing prefix and the final user message equals its original request plus ` /no_think`. Case order, facts/history, identity/callsign settings, source pointers, criteria and historical provenance remain unchanged. Ten cases retain coordinator bindings and eight remain unbound. No fixture criteria, capture placeholder or treatment metadata appeared in messages. These are planned-input checks; the eight later cases were not invoked.

The current source constructs the actual engine with official `qwen1_7b`, four CPU threads, compact batching, disabled repacking, caching, and all three explicit projection/briefing/request-separation flags. The recorded `READY` runtime confirms these settings, loopback host, zero GPU layers, one model/slot, 2,048 context tokens, 128/64 batches, nonthinking mode, disabled web UI/MCP proxy, and 64-token/256-character output limits. The receipt settings equal the predecessor's plus `experimentalSeparateRequest: true`; operation/work/cleanup/sample limits remain 10,000/233,000/7,000/250 ms.

Model and runtime pin objects match the current lock and runtime-pin manifest. The official model is `Qwen3-1.7B-Q8_0.gguf`, version `90862c4b9d2787eaed51d12237eafdfe7c5f6077`, 1,834,426,016 bytes, SHA256 `061B54DAADE076B5D3362DAC252678D17DA8C68F07560BE70818CACE6590CB1A`; runtime is CPU llama.cpp `b11065`. `PINNED_FILES_VERIFIED` is the recorded adapter verification result. This audit compared metadata/source bytes; it did not repeat the multi-gigabyte installed-model hash scan or capture HTTP traffic.

Relevant current source pins are harness `4BE2F6F5F3C6C05FFA577D14054597325022DD0C01B85693BA355C6BF7604B72`, adapter `71E4B7195CAA3E903D4B6BEB223543265CA28E0DB6CFC444126C7F13B622F815`, and projector `4B402FF008389075DF0CBE53D371DE1B4DC9000A774E249682948C3BE7725D6D`. The treatment explicitly records the intervening terminal-completion guard/telemetry change. It is not represented as a solely prompt-code comparison with the historical receipt. All eighteen are exposed regressions, including the four historical holdouts; none is fresh.

## Operation and resource accounting

| Recorded portion | Outcome |
|---|---|
| Discarded primer | `OK.`, `stop`, 5,392.3 ms; not a scored case |
| Cases 1–9, `/samples/0`–`/samples/8` | Nine returned texts with `stop`; pending separate semantic review |
| Case 10, `/samples/9`, `requested-victory-is-not-evidence` | `FAILED`, `GENERATED_TEXT_TRUNCATED`, confirmed `length`, 64 predicted tokens, 6,516.8 ms, **output null** |
| Cases 11–18, `/samples/10`–`/samples/17` | Eight `NOT_PERFORMED`, with null output/finish reason/timings and no operation elapsed time |

The exact eight IDs agree with `notPerformed`. The failed case was a begun operation, not an uninvoked case. Unlike the previous run's inferred cap hit, the new adapter records a terminal `length` reason after validated stream completion and rejects its text. The harness captures diagnostics before stopping and does not proceed to later cases. The rejected answer's content was not retained; no factual verdict on that hidden partial output can be inferred from its scenario title, token count or prior answer.

Startup took **5,459.0 ms**; total recorded time was **53,826.4 ms**. The nine returned case texts ranged **2,444.0–5,969.0 ms**, median **3,971.8 ms**, with **4/9 above four seconds**. All ten invoked case operations were inside the ten-second deadline; this was neither deadline nor memory refusal. Every retained timing object passed the adapter's documented numeric bounds. These descriptive times cover an incomplete prefix, not eighteen successful responses, first-spoken latency or a causal speed comparison.

Initial available RAM was **5,648,691,200 bytes (5.26075 GiB)**, minimum sampled RAM **3,281,141,760 bytes (3.05580 GiB)**, and initial disk availability **26,592,784,384 bytes (24.76646 GiB)**. Recorded admission and sampled runtime values satisfy unchanged 5-GiB initial RAM, 2-GiB running RAM and 10-GiB disk gates. Sampling does not prove an unsampled minimum or performance while the game runs.

Final runtime is `STOPPED`, owned PID null, active generation false, no last error, and owned-process stop confirmed. The stopped worker's recorded exit `-1` is distinct from supervisor exit 1 and is not a claimed graceful native exit zero. Cleanup confirmation here is the owned adapter's terminal record plus root's supervisor-terminal observation, not a fresh independent operating-system process inventory.

The audit wrote only this note, started zero native workers and made zero receipt writes. Raw receipt hash was rechecked unchanged after inspection. Recorded audio/microphone/game/editor/download/default-change flags remain false. Historical results and all source/fixture/test files were untouched. Semantic adequacy, live factual speech and game acceptance remain outside this audit.
