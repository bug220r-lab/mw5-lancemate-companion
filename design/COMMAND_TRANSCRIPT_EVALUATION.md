# Supplied command-transcript replay

This standalone scorer runs the existing `parseSpokenCommand` against supplied JSON requests and independently declared expected labels. It does not recognize speech, authenticate human input, dispatch commands, measure PTT latency, or accept a release. The parser, workbench, benchmark and packaging interfaces are unchanged.

`scoreCommandTranscriptCorpus(jsonText)` is pure. Every report has classification `SUPPLIED_TRANSCRIPT_REPLAY_ONLY`; recognition, dispatch, latency measurement, native acceptance and release acceptance remain `NOT_PERFORMED`. A request's `origin:"human_ptt"` is supplied replay data, never proof of human provenance. No request fields are added, repaired or truncated.

## Input

Start with `synthetic/command-transcript-corpus.template.json`. Its empty `cases` array is intentional: it returns `NO_CASES`, null rates and no acceptance. Do not invent recordings or fill expected labels from parser results. Keep calibration/exposed material distinct from any independently collected evaluation; a declared held-out label alone establishes no independence.

The top-level object has exactly `schemaVersion:1` and `cases`. Every case has exactly these fields, plus optional `exposure`:

| Field | Meaning |
|---|---|
| `id` | Unique case identifier, 1–128 ASCII letters/digits/underscore/dot/colon/hyphen. |
| `sourceKind` | `SYNTHETIC` or `SUPPLIED_TRANSCRIPT`; a caller declaration. |
| `sourceRef` | Nonblank reference, at most512 UTF-16 units. Never opened. |
| `annotationRef` | Nonblank reference to the predeclared expected label, at most512 units. Never opened. |
| `exposure` | Optional `EXPOSED`, `DECLARED_HELD_OUT` or `UNKNOWN`; default `UNKNOWN`. Always unverified. |
| `ambiguous` | Explicit boolean annotation. An ambiguous case cannot declare an expected intent. |
| `request` | A JSON object passed unchanged to the actual parser. Allowed keys: `text`, `origin`, `final`, `session`, `bindings`, `callsigns`, `selectedTargetId`, `locations`. Values may deliberately be invalid parser inputs. |
| `expected` | One of the outcome shapes below. |

Expected command:

```json
{
  "status": "INTENT",
  "action": "REGROUP",
  "recipients": [{"id":"alpha","pawnId":"pawn-1","generation":0}]
}
```

Actions are exactly `REGROUP`, `FOCUS`, `REPOSITION`, `RELEASE_HUMAN_HOLD`, `DISARM`. Recipients are an order-independent set of1–3 exact actor/pawn/generation bindings; generations are nonnegative safe integers, including zero. Duplicate actor or pawn labels are invalid. No actor identity is inferred from array order or a persona.

`FOCUS` additionally requires `targetId`; `REPOSITION` requires `locationId`. Both use the parser's exact returned identifier, including case. Global `DISARM` instead has `recipients:[]` and `scope:"ALL_COMPANION_CONTROL"`. Targeted disarm has recipients and no global scope. Other target/location/scope fields are forbidden.

Expected noncommand:

```json
{"status":"CLARIFICATION","reason":"AMBIGUOUS_CALLSIGN"}
```

or

```json
{"status":"REJECTED","reason":"INELIGIBLE_RECIPIENT"}
```

The reason is an explicit technical expectation,1–96 uppercase ASCII letters/underscores. It is not independent proof of what the speaker meant. The two statuses are distinct: a rejection does not match expected clarification even though both withhold an intent.

Limits:1MiB UTF-8,256 cases,50,000 JSON values, depth16, and8,192 UTF-16 units per string/key. All numbers must be finite and strings well-formed. Invalid syntax, duplicate JSON members (including escaped equal names), duplicate case IDs, missing/extra schema fields or malformed labels reject the entire corpus. No row is dropped from a denominator. Overlong parser text within the corpus bounds is passed unchanged so the parser can reject it; it is never truncated into a command.

## Results

Each result retains the complete supplied request/transcript, expected labels, actual parser result, individual checks and mismatches. References, ambiguity and exposure remain unverified declarations.

Command metrics include only cases whose expected status is `INTENT`. Joint accuracy requires matching status, action, exact recipient ID set, exact pawn/generation bindings, and target/location/global-scope arguments. A safe parser rejection of an expected command is an incorrect command result. Empty denominators yield `null`.

Expected clarifications and rejections have separate status/reason matches and withheld-outcome counts. Withholding is neither correct interpretation nor native safety proof. An ambiguous case producing an intent is counted separately, as is any expected nonintent producing an intent; `dispatchable:false` does not erase that parser diagnostic. There is no100-recording gate,95% acceptance decision, ASR score, benchmark `voiceRecordings` export or `GAME_OBSERVED` promotion.

## CLI

```text
node scripts/Score-CommandTranscripts.mjs --input synthetic/command-transcript-corpus.template.json
```

The CLI reads one explicit bounded regular local UTF-8 JSON file and prints JSON to stdout. It rejects linked input paths and does not open audio, URLs, source/annotation references, models, devices or services. It creates no output file and never executes a provided path. Input bytes are SHA256-bound in the report. A UTF-8 BOM is not accepted JSON input.

`--help` prints usage without reading input. Exit0 means all supplied cases matched, or descriptive `NO_CASES`; exit1 means a valid corpus was scored with mismatches; exit2 means invalid input/usage. None is release acceptance. Keep redirected result files private when transcripts or references are private.
