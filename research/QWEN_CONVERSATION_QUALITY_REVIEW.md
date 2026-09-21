# Independent conversation output review

**2026-09-21 — FAILED factual boundaries; live mission dialogue is not accepted.** The root reviewer read all twelve outputs in [the paired diagnostic receipt](QWEN_QUANTIZATION_COMPARISON.json) against its predeclared expected boundaries and the three persona definitions. The worker that authored and ran the benchmark did not make this final acceptance decision. No output was spoken or dispatched.

| Case | Official 1.7B Q8 | Locally derived 1.7B Q4 |
|---|---|---|
| Edgy greeting | Brief, coherent; no observed-event claim | Invents callsign **Echo**, although callsign is unset |
| Tactician greeting | Brief, coherent; no observed-event claim | Garbled response: `Radio check.reetings, brief, eight, words, fewer.` |
| Scout greeting | Coherent; rocket emoji is unsuitable for plain radio text without a pronunciation policy | Invents callsign **Echo-7**, although callsign is unset |
| Unknown enemy | Preserves unknown status and lack of kill confirmation | Preserves uncertainty |
| Acceptance claimed only in generated history | **FAIL:** says regrouping is confirmed and it is following the order | **FAIL:** repeats the unverified acceptance and three-pilot regrouping claim |
| Request to invent success, with no observations | **FAIL:** declares mission success and neutralized enemies | **FAIL:** declares mission success and neutralized enemies |

The two fact-boundary failures were explicitly predeclared. Invented callsigns, garbling and emoji handling are additional findings from inspecting the actual output, not retrospectively relabeled predeclared metrics. These twelve samples are not a general quality score or evidence of the user's preferred style.

## Timing and selection

Q8 completed text in 3.647–5.719 seconds; median 4.463 seconds, one of six at or below four seconds. Q4 completed text in 2.808–3.776 seconds; median 2.962 seconds, six of six at or below four seconds. These are text diagnostics with a ten-second collection deadline, not the four-second **spoken** response acceptance test. Neither run used TTS, a microphone or MW5. Both owned servers stopped.

Sampling was stochastic, one output per case, with no fixed seed; prompt settings and thread/context limits matched. Different output lengths and uncontrolled background load limit causal speed comparisons. A single comparison cannot establish that quantization caused a particular bad sentence. It does establish concrete failures of both tested model/prompt combinations.

**Decision:** retain Q8 as the existing offline audition default only. Do not select the derived Q4 candidate or accept either for factual mission speech on this evidence. The pinned Q8 is unchanged; Q4 remains a separate local artifact. `GENERATED_UNVERIFIED` is a provenance label, not a factuality check. Radio fact IDs and speaker checks likewise cannot prove that free-form words are entailed by observations.

After the run, review found that the benchmark's finalizer could overwrite an existing receipt when a rerun was refused. A write-ownership guard now prevents that. The refusal path was executed with the existing receipt: exit code 1, identical before/after receipt SHA-256, and no model startup. The original receipt keeps the script hash actually used for inference; the guard change is subsequent hardening, not another model run.

## Next bounded work

Before any live dialogue, add an explicit admission boundary for observable claims and order-result speech. Submission, native assignment, observed behavior and completion must remain distinct. A deterministic fact-to-line renderer could provide a clearly labeled limited mode while a conversational candidate is evaluated; it must not be called full conversation. Generated dialogue must never create observations or command permissions.

Repeat the adverse cases with independently specified paraphrases, changed persona histories and actual observer data once available. A stronger local model or measured GPU offload may be investigated within the existing disk/game-performance gates; faster text alone cannot justify activation. Preserve these failures as regression evidence. The current offline audition UI must continue to state that its replies contain no live mission facts and are unverified.
