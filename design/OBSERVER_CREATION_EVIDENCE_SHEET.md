# LanceObserverProbe creation-only Instant Action evidence sheet

Prepared 2026-09-25 UTC. **TEMPLATE; ALL RUNTIME ROWS NOT_PERFORMED.** Use only after the exact [package preflight](../research/OBSERVER_PACKAGE_PREFLIGHT_2026-09-25.md), cooked hashes, retail additions/removal manifest and isolated test configuration are reviewable. The [creation-only contract](OBSERVER_CREATION_ONLY_PROBE.md) supplies the acceptance semantics. The current authored widget is a **one-time BeginPlay snapshot**, not a live recorder or a complete lifecycle monitor.

## Attempt identity and independent measurement

| Field | Record before the test |
|---|---|
| Attempt ID, UTC start/end, operator | NOT_PERFORMED |
| Editor/game build, game executable identity, DLC and enabled mods | NOT_PERFORMED |
| Source, `mod.json`, cooked package and retail file SHA-256 | NOT_PERFORMED |
| Exact disposable stock Instant Action scenario and lance/loadout | NOT_PERFORMED |
| Expected player controller and controller-owned component lifetime rule | NOT_PERFORMED |
| Stock configuration backup and complete additions/removal manifest | NOT_PERFORMED |
| Independent live enumeration/owner/liveness method and its limits | NOT_PERFORMED |
| Screenshot/video clock alignment, evidence filenames and hashes | NOT_PERFORMED |

Before deployment, predeclare the supported measurement method, observation window and limits for each boundary below. Use `UNAVAILABLE` when no supported method exists; a missing method cannot be filled in after a silent run to manufacture a negative or teardown finding.

| Boundary | Method, scope, evidence reference and what it can establish |
|---|---|
| Cooked registration asset included in the package | NOT_PERFORMED / method UNAVAILABLE |
| Registration visible to the relevant runtime registry | NOT_PERFORMED / method UNAVAILABLE |
| Registration and component class load/cast successfully | NOT_PERFORMED / method UNAVAILABLE |
| Intended live controller selected; complete probe-instance enumeration and owner/liveness verified | NOT_PERFORMED / method UNAVAILABLE |
| Independent controller/world replacement and teardown measurement | NOT_PERFORMED / method UNAVAILABLE |

The overlay's owner path and stored component count can support an attributable **positive** creation observation if the cooked source identity and displayed owner are verified. Its saved BeginPlay count cannot prove a stable count over time. No overlay is **INCONCLUSIVE** unless an independent live readout, registry visibility/load/cast, intended controller selection and reliable enumeration establish a bounded negative result. A disappeared overlay or missing EndPlay notice does not prove component destruction.

## Stock baseline and observation points

Record stock, mod-off behavior first: active-mod configuration and hashes, scenario, independently visible player and AI identities, normal HUD/order behavior, available controller/pawn/world identity evidence, frame-time/resource measure, and time-aligned screenshot/video references. Any unavailable identity is `UNKNOWN`, not a guessed zero. Do not access the main campaign or modify a save for this proof.

At each declared point below, record the same fields: UTC/video time; world/session ID and its source; controller ID and independently established liveness; pawn ID; all **live** probe component instance IDs, owners and count from a complete enumeration if available; widget/readout identity, text and liveness; registry inclusion/load/cast evidence if available; observation method and evidence reference; known gaps and result. Keep controller and pawn identities separate.

| Point | Mod-off / probe-on | World and controller | Pawn | Complete live component enumeration and owners | Widget/readout | Independent evidence and finding |
|---|---|---|---|---|---|---|
| Stock baseline, before installation | NOT_PERFORMED | NOT_PERFORMED | NOT_PERFORMED | NOT PERFORMED | NOT_PERFORMED | NOT_PERFORMED |
| Initial mission/controller established | NOT_PERFORMED | NOT_PERFORMED | NOT_PERFORMED | NOT_PERFORMED | NOT_PERFORMED | NOT_PERFORMED |
| Before one ordinary possession change | NOT_PERFORMED | NOT_PERFORMED | NOT_PERFORMED | NOT_PERFORMED | NOT_PERFORMED | NOT_PERFORMED |
| After that possession change | NOT_PERFORMED | NOT_PERFORMED | NOT_PERFORMED | NOT_PERFORMED | NOT_PERFORMED | NOT_PERFORMED |
| Before mission exit | NOT_PERFORMED | NOT_PERFORMED | NOT_PERFORMED | NOT_PERFORMED | NOT_PERFORMED | NOT_PERFORMED |
| After a new world/controller is established | NOT_PERFORMED | NOT_PERFORMED | NOT_PERFORMED | NOT_PERFORMED | NOT_PERFORMED | NOT_PERFORMED |

## Three separate findings

| Finding | Evidence required | Record |
|---|---|---|
| At least one creation | Fresh, uniquely attributable observation of a real probe component; note owner/count/lifetime fields that remain unknown | NOT_PERFORMED |
| Exactly one on the intended controller | Complete live class enumeration on the independently verified intended controller, with actual instance IDs and owner identity; overlapping widgets or a one-time saved count are insufficient | NOT_PERFORMED |
| Correct controller/world lifetime | Repeat independent liveness and enumeration across possession and mission exit/re-entry. The same live controller may retain its component when only its pawn changes; judge teardown only after controller/world replacement is independently established | NOT_PERFORMED |

Wrong or unknown owner, more than one real instance, stale binding, changed native behavior, crash, abnormal resource use, unexpected save/campaign access, or an unreviewed edit/prompt stops the run. If the display or independent measurement is missing, record `INCONCLUSIVE` or `UNKNOWN` for the affected finding and stop this attempt; do not repeat it unchanged to force a pass. Preserve raw evidence.

## Normal exit and rollback record

| Check | Evidence/status |
|---|---|
| Game exited normally and exact test files/configuration are identified | NOT_PERFORMED |
| Only manifest-listed additions removed; only specifically backed-up changed configuration restored | NOT_PERFORMED |
| Retail file/config hashes and enabled-mod state compared with stock baseline | NOT_PERFORMED |
| Stock Instant Action behavior and any resource/frame-time measure rechecked | NOT_PERFORMED |
| Partial output, uncertainty, stop reason and reviewer conclusion retained | NOT_PERFORMED |

Creation/lifetime acceptance for one recorded configuration does not establish a mission recorder, tactical telemetry, native order acceptance, AI improvement or broad compatibility. Recording requires separate sampling, local export and independently checked real-mission data under the [recording workflow](PASSIVE_RECORDING_WORKFLOW.md).
