# Post-install editor inspection worksheet

Updated **2026-09-20**. **OBSERVED: official editor installation completed; post-install metadata and named source assets reviewed. A diagnostic commandlet failed during startup; an existing graphical editor is compiling shaders. Graph inspection, implementation and shipping tests remain NOT_PERFORMED.** Epic recorded success at **22:26:42.848 UTC / 18:26:42.848 -04:00**, with `ProcessSuccess=TRUE`, `FailureType=NoError`, `ErrorCode=OK` and `VerifyTime=9:04 min`. The final manifest is complete and identifies **MechWarrior 5 Editor / HoopoeEditor 1.1.390.0e**. See the [subsequent source session](../research/EDITOR_SOURCE_SESSION_2026-09-20.md) for current startup evidence; the metadata sections below retain their earlier timestamps.

The [post-install metadata](../research/EDITOR_POSTINSTALL.json), [completion receipt](../research/EDITOR_COMPLETION.json) and [post-install review](../research/EDITOR_POSTINSTALL_REVIEW.md) supersede earlier incomplete-install snapshots for current status. Historical progress screenshots and disk-full recovery evidence remain preserved; their estimates are not current status.

The user's subsequent continuation covers the bounded source investigation and its recorded editor diagnostic. The user also started the existing graphical editor. Continue inspection in that instance once ready; do not launch another while it compiles. Further bounded metadata/configuration/source reads need no new approval. Play-In-Editor, mod creation, cooking, runtime deployment and retail-game control remain outside this scope.

Read alongside [installation history](../research/EDITOR_INSTALLATION.md), [bridge findings](../research/BRIDGE_INSPECTION.md), [source register](../research/SOURCES.md), [architecture](ARCHITECTURE.md) and [deterministic proof](PROOF_OF_CONCEPT.md). Source IDs below refer to that register.

**Current source result [I05]:** automatic Python-stub generation supplied [26 selected classes of declarations](../research/evidence/editor-source/generated-stub-contracts.json). Order/recipient/context, worker/job readback candidates, actor-position and installed file/JSON signatures are now observed. The helper reads text and never imports the stub. Use the [ready checklist's graph step](EDITOR_READY_CHECKLIST.md) next; repeat metadata collection only for a concrete missing item. Entries below requiring graph edges, actor instances, manual supersession, implementation threading or shipping behavior remain unresolved.

## 1. Completed-package metadata review

**Current result: installation completion confirmed; metadata comparison completed; compatibility and source contracts remain UNKNOWN.** The checker returned `READY_FOR_VERSION_REVIEW` at **18:30:51 -04:00**; the separate success log and final manifest establish completion. This status does not establish a successful editor launch, independent publisher integrity or shipping-game compatibility.

- [x] Reconciled the user's completion report with Epic's successful install/verification log and a final manifest whose `bIsIncompleteInstall` is false. The product is the official Mercenaries editor, not Clans or a generic Unreal installation.
- [x] Recorded the final manifest, package/catalog identity, version, selected installation root and SHA256. Evidence is in the post-install/completion JSON files.
- [x] Located the editor executable, bundled project descriptor, engine build metadata and named Victory/LowEntry descriptors. The project lists Runtime `MechWarrior` and Editor `MechWarriorEditor` / `MechWarriorFactory` modules; this does not demonstrate their behavior.
- [x] Recorded stable named metadata hashes and the editor executable hash after Epic success. No full payload traversal or independent publisher-hash comparison was performed.
- [x] Refreshed the named Steam game XML, app manifest and shipping receipt. Target remains **1.14.390 / CL456620 / Steam build24241637**, receipt **UE4.26.2**, compatible changelist **14830424**.
- [x] Compared the available engine/project metadata: editor and retail report **4.26.2**, compatible changelist **14830424**, branch `++UE4+Release-4.26`. Editor package `1.1.390.0e` and retail game `1.14.390` are different version labels; neither textual equality nor matching engine metadata proves mod compatibility. Editor/game BuildIds need not be identical.
- [ ] Establish any additional PGI package/release relationship needed to justify source findings for this retail target. No asset/API compatibility or startup result is established by the metadata comparison.
- [x] Recorded available space: **11,246,854,144 bytes, approximately 10.47 GiB**, at **18:32:18 -04:00**. Manifest-declared install size is **256,122,524,996 bytes**; it is not a measured allocated footprint.
- [ ] Resolve applicable startup log/cache paths and a practical working-space allowance before an editor launch. First-open shader/DDC demand, effective cache settings and adequate volume headroom remain **UNKNOWN**. Do not delete/move caches, change settings or create another large project copy as part of this review.

| Identity item | Observed value/path | Evidence | Status |
|---|---|---|---|
| Completion | Epic success 2026-09-20 22:26:42.848 UTC; verification 9:04 min; final manifest complete | [Completion receipt](../research/EDITOR_COMPLETION.json) | OBSERVED |
| Epic package | `HoopoeEditor`, version `1.1.390.0e`; catalog item `8b875a03af264458a79b8bad35a16f52` | [Post-install metadata](../research/EDITOR_POSTINSTALL.json) | OBSERVED |
| Actual root / project | `C:\Program Files\Epic Games\MechWarrior5Editor`; `MW5Mercs/MW5Mercs.uproject` | Post-install project record | OBSERVED |
| Editor executable / SHA256 | `Engine/Binaries/Win64/UE4Editor.exe`; `33092EC0737275E59A2C132675A7938813A98F27F575BF43D8A3CDB53A441BF2` | Completion receipt | OBSERVED |
| Engine / descriptors | UE4.26.2, compatible CL14830424; named metadata hashes retained | Post-install fingerprints | OBSERVED |
| Steam game | 1.14.390 / CL456620 / build24241637; XML/manifest/receipt hashes retained | Completion retail fields | OBSERVED |
| Compatibility | Engine metadata agrees; PGI assets, native API and shipping behavior not tested | [Post-install review](../research/EDITOR_POSTINSTALL_REVIEW.md) | UNKNOWN / NOT_PERFORMED |
| Space / working allowance | 10.47 GiB free at receipt time; required first-open/cache allowance unknown | Completion free bytes; named config inspection | OBSERVED / UNKNOWN |

This finishes the metadata deliverable originally prepared here. It does not pass POC G1 by itself: G1 also needs the actual source definitions. Refresh relevant identity and free space immediately before any later approved launch; do not treat this point-in-time observation as a persistent guarantee.

## 2. Proposed editor source-viewing session

**Exact observed target, not a command executed by this preparation:**

- Executable: `C:\Program Files\Epic Games\MechWarrior5Editor\Engine\Binaries\Win64\UE4Editor.exe`.
- Manifest arguments: `MW5Mercs -Installed`.
- Bundled project: `C:\Program Files\Epic Games\MechWarrior5Editor\MW5Mercs\MW5Mercs.uproject`.
- Proposed working directory: the observed installation root, so the manifest's relative target/project context is preserved. No extra `-DDC` override is proposed.
- Purpose: view existing graphs/source for one AI's Form On Me receiver, identity/authority/lifetime, native readback/manual override, one telemetry field and bundled I/O.
- Proposed evidence destination: project-local notes/screenshots under `research/evidence/editor-source/`; no folder or source export has been created by this worksheet.

**Expected ordinary writes must be included in the launch scope.** Editor startup can create logs, user/project settings and shader/derived-data caches even when the user does not save an asset. The named installed configuration documents a writable installed-build cache graph, but its effective expanded paths and storage need have not been observed:

| Named configuration evidence | What it says | Limit |
|---|---|---|
| `Engine/Config/BaseEngine.ini:1696–1698` | Installed builds default to `InstalledDerivedDataBackendGraph`; `-DDC=...` can select another graph | Configuration documentation, not a launched selection |
| `BaseEngine.ini:1752,1757–1759` | Installed graph: Boot `%ENGINEUSERDIR%DerivedDataCache/Boot.ddc`; Local `%ENGINEVERSIONAGNOSTICUSERDIR%DerivedDataCache`; writable/cache-maintenance settings and a Shared entry | Macros, user settings and overrides have not been resolved into the effective startup paths; 512 Boot MaxCacheSize is not a total cache/storage cap |
| `MW5Mercs/Config/DefaultEngine.ini:98–107` | Separate `DerivedDataBackendGraph` uses project Boot and `../../../Engine/DerivedDataCache` Local | Do not substitute this section for the installed-build graph |
| `DefaultEngine.ini:109–119` | Separate `BambooDDC` graph has its own Boot/Local/Shared settings | Its presence does not establish that it will be selected |

The [post-install review](../research/EDITOR_POSTINSTALL_REVIEW.md) preserves full source paths and hashes. Resolving relevant configuration through further bounded text inspection is already authorized; it does not require launch approval. The approximately 10.47 GiB remaining is not evidence that first-open work will fit. No cache relocation, environment/configuration change or cleanup is authorized by this worksheet.

For a later approved graphical session, include normal startup logs, shader/DDC generation and applicable cache maintenance, plus startup dialogs, in the scope. Preserve original assets. Do not create or save a mod, migrate assets, compile new code, rebuild packages, run repository scripts, add plugins or use Play/Simulate merely to inspect a graph. If conversion, migration, repair, new terms acceptance or a missing dependency interrupts the session, record the prompt and stop at that boundary.

Record real package/object names exactly as displayed. A graph screenshot must identify the asset, graph/function and relevant pins; a cropped node without its owner is insufficient. Keep evidence local and follow the editor's asset terms [F04]. **Source-graph inspection has not occurred.** The commandlet attempt and user-started GUI compilation are recorded separately in the current session.

## 3. Trace one native Form On Me order

The **Lance Status UI** name is an original mod-author inspection lead [F06], not a verified asset/class spelling. Local `DispatchLanceMate1` is a recorded input binding [L04], not an established dispatch API. Start with the real input/UI references and follow their implementation; do not type a guessed callable name into an adapter.

The [gameplay reference](../research/GAMEPLAY_REFERENCE.md) adds a concrete visual example: at 32:53 the whole-lance order menu is visible, followed by an on-screen movement refusal. The selection and action contexts share function keys. Use it to orient the trace and check single-member versus group routing; it supplies no internal symbol or refusal/readback API [G01].

- [ ] Locate the real single-member selection implementation. Record the UI/input binding, full owning asset/class path, selected-member representation and the transition from selection to the order menu. Distinguish a single-member selection from whole-lance selection.
- [ ] Locate the actual Form On Me menu action and follow all relevant call sites to its real receiver. Capture the complete signature: function/event name, parameter types and order, enum/action values, return/out values, defaults and required context. If the action is represented differently, record what the source actually uses.
- [ ] Trace how the receiving instance is obtained. Identify its lifecycle and owner, how it resolves the chosen member, and whether dispatch itself changes selection, target state or every member's order. Record guards and failure branches; an asset name is not a runtime instance retrieval method.
- [ ] Trace selected member -> pilot/roster record if present -> current mech pawn -> AI/human possession. Separate UI slot, persistent pilot identity and mission actor identity. Record where mappings become invalid after mech swap, death/ejection, mission end/load or a replacement occupant. Do not promote an array index or transient object pointer into a durable pilot ID.
- [ ] Record the actual authority checks, network function flags/replication routes if present, controller ownership and calling-context requirements. A single-player assumption does not establish host authority. A native thread requirement or safe dispatch context needs source evidence; generic Unreal documentation alone does not supply it.
- [ ] Inspect the PGI-documented `\Modes\MissionDirectorSystem\MissionComponents\SquadCommandComponent` **only if real references connect it**, or separately for its documented formation role [B02]. Do not draw an order-dispatch edge merely because its name sounds relevant.
- [ ] Record the receiver's state mutation and subsequent native-AI consumption, as far as source inspection permits. Do not replace the discovered path with generic movement, a behavior-tree rewrite or an inferred Blackboard key.

Fill each edge only after inspecting its actual reference:

| Trace edge | Exact caller/owner | Exact receiver/member/signature | Evidence ID | Missing evidence |
|---|---|---|---|---|
| Input -> individual selection | To inspect | To inspect | — | UNKNOWN |
| Selection -> current AI pawn | To inspect | To inspect | — | UNKNOWN |
| Form On Me menu -> native dispatch | To inspect | To inspect | — | UNKNOWN |
| Dispatch -> authoritative receiver | To inspect | To inspect | — | UNKNOWN |
| Receiver -> persistent native order state | To inspect | To inspect | — | UNKNOWN |
| Order state -> native AI consumption | To inspect | To inspect | — | UNKNOWN |
| Lifecycle/possession change -> invalidation | To inspect | To inspect | — | UNKNOWN |

## 4. Separate acceptance, readback and human override

Inspect these paths without issuing an order:

- [ ] Identify what a dispatch return value actually means: validation, queuing, mutation, rejection or nothing. Follow its producers and consumers. Neither a successful reflected call nor a driver's own log proves acceptance.
- [ ] Find an authoritative order-state query/event, if one exists, and trace how the UI/radio feedback is produced. Record the actor association, action value, timing and lifecycle. UI text, voice assets and their filenames alone do not supply a machine-readable contract [B04,F06].
- [ ] Locate the route used by later human orders and how it updates or replaces the designated actor's order. Determine whether source exposes an event or revision usable to detect a human command before and after a queued companion request. If it cannot distinguish command origin or intervening manual changes, write **UNKNOWN** instead of inventing a generation counter that the game never supplies.
- [ ] Record the source of truth for pause/menu/loading and valid mission/actor lifetime, and how each would revoke a proposed binding or pending command. No queued action should be assumed safe across those boundaries.

| Requirement | Actual source signal and semantics | Availability/limitations | Evidence ID |
|---|---|---|---|
| Accepted or rejected for this AI actor | To inspect | UNKNOWN | — |
| Native current-order readback | To inspect | UNKNOWN | — |
| Human order before companion dispatch | To inspect | UNKNOWN | — |
| Human order after companion dispatch | To inspect | UNKNOWN | — |
| Pause/loading/mission/possession invalidation | To inspect | UNKNOWN | — |

The later shipping proof must independently observe behavior as well as native order evidence. This worksheet cannot pass that test; see the non-follow reset and non-designated sentinel requirements in [PROOF_OF_CONCEPT.md](PROOF_OF_CONCEPT.md).

## 5. Identify one bounded telemetry candidate

Inspect a minimal field definition and access path first. Public SpaceMonkey source establishes a **local-player pose export precedent**, with checks that exclude AI-controlled pawns [B07]. It is not an installed or validated telemetry facility here. Prefer designated-AI pose if the actual editor source exposes it reliably; do not expand the initial inspection into every combat/campaign field.

- [ ] Record field/object path, owning actor, value type, coordinate space/units and actual getter/source definition. Record whether the caller receives a copy, a reference or transient state, where the source establishes that.
- [ ] Establish when the value exists, what updates it, the permitted read context and how destruction/loading/possession invalidates the access path. An eventual sample must carry the corresponding actor identity and freshness context; the exact project protocol is still a proposal.
- [ ] Distinguish the local player field from the designated AI binding evidence required to send an order. A player-position read alone cannot validate the target lancemate.
- [ ] Record intended bounded sampling and size as **PROPOSED**, not measured performance. Perform no runtime sampling, timer installation or export during this source session.

Telemetry worksheet: **candidate getter** `Actor.get_actor_location() -> Vector`, documented as RootComponent location in generated reference line117089; **actual current AI actor binding** `UNKNOWN`; **units/space and lifetime validation for this integration** `UNKNOWN`; **evidence ID** `I05`; **live observation** `NOT_PERFORMED`. MWWorkerComponent.get_actor() provides a declared pawn-association lead to investigate, not an observed live binding.

## 6. Inspect bundled I/O rather than substituting upstream plugins

The shipping receipt lists VictoryPlugin/VictoryBPLibrary and LowEntryJson, but descriptor presence is not proof of usable shipping functions [F01]. The upstream Victory functions below are concrete search leads, not promises that the bundled version contains them [F02].

- [ ] Locate actual bundled descriptors, module configuration, available headers/implementation and relevant binaries. Record exact paths, versions/hashes, enabled state, module type, platform/configuration exclusions and dependencies. If only binaries are supplied, record that source limit; do not decompile or install another version to fill it.
- [ ] Inspect whether `LoadStringFromFile` and `FileIO__SaveStringTextToFile` exist in this package, their actual signatures and Blueprint exposure, and their implementation/call context. The inspected upstream code uses synchronous `FFileHelper` operations. A timer or latent-looking UI label alone does not establish worker-thread execution.
- [ ] If an asynchronous facility is found, trace worker scheduling, bounded work/payloads, completion delivery back to a safe game context, error paths, cancellation, lifetime and shutdown. Record the source, not an inference from a node name. Otherwise keep the **nonblocking transport gate unresolved**.
- [ ] Determine source-level cooking/runtime inclusion evidence separately from node visibility in the editor. A Runtime module label helps inspection but is not a packaged-game test. Do not run a cook or deployment under this worksheet.
- [ ] For a potential file exchange, inspect available path/size limits and support for partial-write handling, safe publication, access errors and shutdown. Authentication, sequence/expiry checks, protected directories and duplicate suppression remain project requirements until implemented; do not attribute them to an upstream string-file function.
- [ ] Inspect LowEntryJson only for functions actually supplied. Its name establishes neither sockets nor HTTP. Keep read/export and receive/dispatch evidence separate: one-way export does not prove bidirectional communication.

| Capability | Actual bundled definition/signature | Thread/runtime/source evidence | Status |
|---|---|---|---|
| Read bounded external input | To inspect | To inspect | UNKNOWN |
| Write bounded state/result output | To inspect | To inspect | UNKNOWN |
| Nonblocking execution and safe completion | To inspect | To inspect | UNKNOWN |
| Serialization/schema limits | To inspect | To inspect | UNKNOWN |
| Lifetime/cancel/shutdown/error handling | To inspect | To inspect | UNKNOWN |
| Cooked/shipping availability | To inspect source inclusion | Live proof deferred | NOT_PERFORMED |

Do not install Victory, LowEntry, UE4SS or a VR/native loader, run retained build scripts, open a listener or create a runtime exchange directory here. The previously audited native fallback remains conditional [F05]; this worksheet does not advance to it automatically.

## 7. Capture evidence and decide the next bounded task

Use one record per architecture-critical claim. Proposed evidence IDs such as `EI-001` are local record labels, not game identifiers. Store only narrowly relevant notes/screenshots or permitted source excerpts in a project-local evidence folder selected for the approved inspection; no such folder or source export is created by this worksheet.

```text
Evidence ID:
Captured at (timestamp/timezone):
Stage: completed-file metadata / authorized editor source view
Label: OBSERVED / DOCUMENTED / PROPOSED / UNKNOWN/BLOCKED
Exact claim:
Editor package/build + Steam game build:
Absolute source path or immutable public URL:
Asset/object path and graph/function OR file + line location:
Caller, receiver, complete signature and relevant types:
Actor ownership / authority / thread context:
Relevant lifecycle, success and rejection branches:
Screenshot/notes filename and SHA256 if retained:
What this evidence proves:
What this evidence does not prove:
Missing reference, version limitation or next bounded inspection:
Editor launch performed (if any): record approved executable and scope
Gameplay/test execution: NONE (source inspection only)
```

For an unsuccessful search, record the exact root, terms, scope and access limitations. “Not located in these references” is a valid result; “does not exist” requires stronger evidence. Avoid broad scans of unrelated files and do not publish proprietary assets or account data.

The inspection report should end with this decision table:

| Decision | Required result | Next action |
|---|---|---|
| Package identity ready | Completed package and enough version/storage evidence to scope inspection | Seek editor launch/source-inspection approval if not already explicitly granted |
| Source contracts sufficient to plan implementation | Actor-specific native dispatch, authority, telemetry access, acceptance/readback, human override and plausible nonblocking transport supported by exact source evidence | Produce a concrete implementation/change manifest and revise the POC; do not deploy or run it |
| Contracts incomplete | List precise missing field/function/reference/thread/transport evidence | Continue only the relevant authorized inspection or report UNKNOWN/BLOCKED |
| Version or launch-scope obstacle | Unexplained mismatch, conversion/repair requirement, inadequate working space or action outside approval | Stop the dependent step and present the concrete obstacle |

All **Play-In-Editor, cooking/builds, packaged-game reads/orders, mod compatibility, performance and in-game voice tests remain NOT_PERFORMED**. Do not label this worksheet or a completed source trace as a working companion. Preserve originals and evidence when closing the approved inspection; do not save unintended asset changes or perform cleanup by deleting directories.
