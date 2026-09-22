# Direct-pilot movement: declaration and connected-write delta

Reviewed 2026-09-22. **OBSERVED source structure / DOCUMENTED declarations; native execution NOT_PERFORMED.** This supplements the historical [movement analysis](AI_MOVEMENT_ANALYSIS.md), not a completed M6 ownership proof. No editor, game, adapter or control was run for this review.

The useful new distinction is that the collected dropship function writes a **whole movement-input structure**, with an incoming throttle plus explicit zero/false values for the other fields. Its name is not evidence that it changes only throttle. The exposed interface makes a narrowly scoped movement investigation plausible; it does not establish exclusive control or safe restoration.

## Evidence identity and scope

All source locations below are one-based lines in `research/evidence/editor-source/ai-research-collection-20260921T030437Z-f7d8e930/`:

| Key | Local evidence | SHA-256 |
|---|---|---|
| API | `unreal-api-reference.txt` | `ac4c46761bc54099302155bc0a908ae3f64b161ca77eb9afd0cc6c1f1b826480` |
| EXIT | `031-Ally_ExitDropshipJob-source.COPY` | `76aefdef2c4f9ea1cf5dea1ed6acc5411fdb242869f5cacb9824f35f8ae91738` |

These are preserved editor exports for editor `1.1.390.0e`, UE `4.26.2`, compatible changelist `14830424`. Their applicability to recorded retail Steam build `1.14.390` / changelist `456620` is unverified. Raw exports stay local and are excluded from the private source-only backup. API bodies containing `pass` or placeholder returns are generated declarations, not native implementations or observations of current values.

An exact serialized-name search for `MemberName="MoveInput"` or `MemberName="SetMoveInput"` in the 244 collected `*-source.COPY` files matched only EXIT. This bounds the collected Blueprint evidence; it neither inventories native writers nor establishes that no other asset or indirect writer exists.

## What the interface actually declares

API 96432–96505 declares `MechMovementInput`, with native header `MWMechMovementComponent.h`:

| Field | Declared type/access | Documented meaning and unresolved contract |
|---|---|---|
| `throttle` | float, read/write | Named throttle; accepted range, scaling, clamping, direction and consumption cadence unspecified. Do not assume `[-1, 1]` from convention. |
| `turn` | float, read/write | Named turn; not documented as degrees, degrees per second or normalized steering. |
| `strafe_vector` | Vector, read/write | Coordinate space, units and applicability unspecified. |
| `wants_jump_jets` | bool, read/write | Named jump-jet request; eligibility, hold/release and consumption unspecified. |
| `use_absolute_jump_jet_direction` | bool, read/write | Selects a named absolute-direction mode; exact behavior unspecified. |
| `absolute_jump_jet_direction` | Vector, read/write | Documentation describes an absolute world direction; normalization, magnitude and valid inputs unspecified. |

API 347199–347201 identifies `MWMechMovementComponent` as a `CharacterMovementComponent` responsible for mech movement state. API 347497–347505 exposes `move_input` as a read/write `MechMovementInput` and describes it as control input driving movement. This is a captured editor declaration, not a proven shipping Python interface, game-thread access mechanism or arbitration contract.

Keep this distinct from movement tuning: `move_stats` is described as movement statistics (347491–347495); `set_move_stats` is described as a client-side change to how the mech moves (347591–347599). `speed_limit_kph` and `target_slow_speed_cms` have their own named units (347521–347537). None establishes throttle/turn units, and none is a substitute for exclusive input ownership. The generated constructor's zeros and false values are defaults in the declaration, not measured neutral-input behavior.

## Registered graph: the actual write

EXIT registers `UpdateMechThrottle` in `FunctionGraphs(0)` at 2703. Its instanced graph is 2184–2293, GUID `07B285A34417CFB2E01FF790C7FC83AF`; `Nodes(0..6)` at 2286–2292 identifies the participating nodes.

1. The function entry's execution pin reaches the `MWMech` cast (2274–2283, 2262–2272). Its `Worker` argument feeds `MWWorkerComponent.GetActor`, whose returned actor supplies that cast (2205–2214).
2. On the successful mech cast, execution reaches the `MWMechMovementComponent` cast. Data flows from that mech to `Pawn.GetMovementComponent`, then to the movement cast (2241–2272).
3. Only the successful movement cast reaches `K2Node_VariableSet_1`, targeting that movement component's **MoveInput property** (2223–2239). Both cast-failure execution pins are unconnected in this graph; there is no recorded success/failure acknowledgment after the write.
4. The setter's parent struct pin is split into six children (2231). The throttle child receives the function-scoped `Throttle` getter (2216–2221, 2233). The other children have no incoming links: strafe `(0,0,0)` (2232), turn `0` (2234), wants-jump-jets `False` (2235), absolute-mode `False` (2236), absolute direction `(0,0,0)` (2237).

**Source-supported conclusion:** this connected setter supplies a complete structure using the parameter and listed defaults. It does not read the previous structure or preserve its other fields. This establishes the Blueprint assignment shape; actual runtime consumption, later overwrites and physical response remain unobserved.

**Disconnected-node distinction:** a serialized `K2Node_MakeStruct_0` appears at 2185–2204. Its pins have no links in this instanced graph, and it is absent from the graph's `Nodes` array. It is not the connected producer of the write. Earlier serialized node material must not override the registered graph's split-pin wiring.

The enclosing scripted job's throttle-one/reset loop and zero-on-removal path were already covered in [the movement report](AI_MOVEMENT_ANALYSIS.md). Those special dropship paths are not new evidence of general piloting, nor of restoring previous navigation or control intent. See the separate [restoration delta](DIRECT_PILOT_RESTORATION_DELTA.md) for receiver-specific stop/restart limitations.

## Consequence for the proposed direct controller

**PROPOSED design constraint:** any future adapter must deliberately define every written input field and revalidate ownership before writing. Do not lift this function as a throttle-only helper, treat setting zero as proven braking, or restore an old input snapshot after ownership may have changed. Retain native movement/physics simulation unless a separate contract establishes otherwise. Stopping an AI brain is not yet evidence that all input writers stopped.

**UNKNOWN/BLOCKED:** complete writer inventory, write/consume order and frequency, field units and saturation, normal neutral/stop behavior, pause/possession/mission-transition semantics, and safe native resumption. None can be resolved by another offline mock of a hypothetical writer.

The smallest next movement-specific evidence step is **passive observation after M0/M1 access exists**: bind one designated AI to its actual controller/pawn/movement component; timestamp all six inputs alongside independent pose/velocity observations during a short native follow, stop and turn sequence, including a human possession transition. Record missing observations as unknown. That correlates inputs with behavior; it still cannot prove every writer or authorize replacement.

A subsequent bounded write experiment needs a separate concrete artifact/manifest, a verified way to suppress competing decision writers while keeping simulation running, proven rollback and a disposable stock Instant Action scenario. Stop on stale identity, human possession/order, missing samples, unexpected motion or restoration failure. Current stage: **preparation only; no enabled direct-control capability**.
