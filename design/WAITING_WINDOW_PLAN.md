# Three-hour preparation window

Prepared 2026-09-20 for the user's question: what can we plan and accomplish while the official editor finishes installing? **The three hours are an available work budget, not an installation ETA, a claimed elapsed duration or a scheduled background job.** Independent tasks can finish sooner in parallel.

The useful outcome is a tighter first prototype specification plus reusable evaluation cases. The game's native order/telemetry connection remains the critical unknown. This window prepares local documents, synthetic inputs and a bounded executable policy model; it does not build a game adapter or choose a runtime stack.

## Prioritized work budget

| Budget | Work | Concrete output and completion condition |
|---|---|---|
| 30 min | Pilot personality and radio behavior | Editable female mercenary persona following the user's edgy tone preference; grounded acknowledgments, silence and interruption cases; examples the user can react to |
| 60 min | Command contract and adversarial exercise | Explicit receipt/dispatch rules; synthetic cases for override, identity changes, replay, stale context, bounded queues and uncertainty; an honest MOCK_ONLY report |
| 45 min | Campaign memory and reload behavior | Record/provenance/branch specification; 12 synthetic cases preventing remembered events from leaking across older-save branches or different pilots |
| 30 min | Inspection-to-build decision map | Identify exactly which editor findings would unblock each part of the smallest prototype and which failures keep it blocked |
| 15 min | Review and handoff buffer | Check artifacts and unresolved choices; preserve a concise next-editor-task prompt. Do not spend the buffer repeatedly polling the launcher |

These are planning allocations, not time measurements or promises that unknown game integration can be finished within three hours.

## What has been prepared in this window

- [Pilot behavior sheet](PILOT_BEHAVIOR.md): user preference incorporated; callsign open. All [16 static radio candidates](../synthetic/pilot-radio-candidates.json) met their fixture criteria in [separate-agent semantic review](../research/OFFLINE_RADIO_REVIEW.md), with word budgets checked. This evaluates authored text and planned silence/interruption decisions; no audio or runtime behavior was tested.
- [Command contract](COMMAND_CONTRACT.md), [executable offline exercise](../scripts/Exercise-CommandContract.mjs), [synthetic traces](../synthetic/command-cases.json), and [result report](../research/OFFLINE_COMMAND_REPORT.json). The report records its actual case count and hash-bound results. This tests proposed policy only.
- [Campaign memory proposal](CAMPAIGN_MEMORY.md), [12 branch/provenance cases](../synthetic/memory-branch-cases.json), and [executable research replay](../research/OFFLINE_MEMORY_EXERCISE.md): **12/12 scenarios and 92 structured expectations met**, plus **14/14 independent adversarial checks**. Results are MOCK_ONLY. This is a pure in-memory model; real saves, persistent storage, export/deletion and game integration remain NOT_PERFORMED.
- The editor decision map below, plus the existing [post-install worksheet](EDITOR_INSPECTION.md) and [next-task handoff](../NEXT_CODEX_PROMPT.md).

## Inspection-to-build decision map

| Needed editor finding | What it would unblock | If it is missing |
|---|---|---|
| Completed package identity and a justified relationship to the Steam build | Scope source inspection against the correct installed assets | Record the precise version/location mismatch; do not update the Steam game by assumption |
| Actual single-member native Form On Me receiver, signature and instance ownership | A concrete mapping for project action `FORM_ON_PLAYER` | Keep dispatch unimplemented; a named UI asset is not sufficient |
| Current pawn binding, AI possession, authority and lifecycle signals | Replacing corresponding synthetic prerequisites with source-backed reads | Reject affected commands; do not substitute slot, callsign or persistent raw pointer |
| Human-order observation and trustworthy current revision/precedence | Demonstrating human override before and after a queued command | First proof remains unable to permit writes under the stricter contract |
| One trustworthy telemetry field and its safe access context | Minimal state export for the first proof | Keep telemetry unimplemented; no guessed damage/heat/ammo events |
| Native order-state readback and its semantics | An acceptance observation separate from outbound transport | Report acceptance UNKNOWN; no successful-dispatch log can replace it |
| Bounded transport, shipping inclusion, correct thread and shutdown behavior | A source-backed adapter implementation manifest | Retain the transport blocker; do not install a generic plugin or loader speculatively |

If those source contracts are sufficient, the next deliverable is a concrete implementation/change manifest for one state read and one native order. Deployment and the isolated shipping test use the separate [POC](PROOF_OF_CONCEPT.md). Pilot memory, audio, attack orders and autonomy remain later additions.

## Decisions the user can review without waiting

- **Personality:** sharp/dry versus openly abrasive, humor during downtime, preferred address and eventual callsign. The profile keeps these editable and does not invent a campaign biography.
- **Communication:** which events deserve a call and which should remain silent; the prepared radio cases make that choice concrete. Push-to-talk, separate speech mute and command disarm are the proposed baseline, with actual device/binding setup deferred.
- **Memory:** whether a provisional branch label is acceptable when a loaded save cannot be identified; no real save file needs to be read to decide the behavior.
- **First proof:** evaluate the existing criterion of one AI changing from a verified non-follow baseline to Form On Me while a different lance member's order stays unchanged.

No new paid service, download, model choice, API key, microphone capture, loader, Unreal plugin, native compiler install, dashboard or memory database is needed to complete this preparation. The work should narrow the later build, not make an unverified connection look complete.

## Next waiting window: experience and user preference

The user reports another two hours of download time. This is a proposed work budget, not a verified installation ETA or a scheduled job. The command/memory exercises and first radio review are complete; additional broad mock suites have less value than seeing how the proposed companion feels across a connected scene.

| Budget | Next task | Reviewable output |
|---|---|---|
| 40 min | Connected mission rehearsal | An explicitly fictional, timestamped text scene: approach, native briefing, command receipt, refused movement with unknown cause, verified damage, human interruption, withdrawal/regroup and repair discussion. Include deliberate silence; keep native radio, player and companion lines clearly separated. All game evidence is stipulated and no real orders occur. |
| 30 min | Personality audition | Six identical situations, each with three original versions: restrained/dry, sharply sarcastic and more confrontational. Preserve the same facts and human authority across versions. The user can compare manner and humor; no style, callsign or biography is adopted automatically. |
| 30 min | Focused scene revision | Review refusal, competing radio, withdrawal and conflicting-information moments from the connected scene. Add only the concrete supplemental cases exposed by the rehearsal; preserve the original sixteen-case fixture and its report. |
| 20 min | User feedback and handoff | Apply any supplied preferences, retain unresolved choices explicitly, and keep the completed editor inspection worksheet ready. If feedback is unavailable, retain alternatives rather than treating silence as approval. |

These outputs are text previews and scoped research cases. They do not establish speech timing, native-radio detection, a working dialogue runtime or player acceptance. Original voice direction, callsign and fictional backstory are useful optional creative decisions; actual audio, game integration and campaign persistence remain separate work. The native order/telemetry investigation still depends on the completed editor package. Avoid repeating the passing exercises or broad source searches just to occupy the available time.

### Prepared after the user's approval

- [Mission rehearsal](MISSION_REHEARSAL.md): 39 timed story beats, 26 original spoken lines, six minutes of fictional mission time plus a repair conversation through 07:30. Technical evidence and review criteria remain in the [structured scene](../synthetic/mission-rehearsal.json).
- [Personality audition](PERSONALITY_AUDITION.md): six identical situations with three alternatives each. The inline comparison uses those exact 18 lines; selecting a situation does not select a personality. Its [local preview check](../research/EXPERIENCE_PREVIEW_CHECK.json) records interaction and layout checks, not companion behavior.
- [Character options](CHARACTER_OPTIONS.md): six callsigns, three alternate starting biographies, three original text voice directions and one common reading script. All remain unselected.
- [Experience review](../research/EXPERIENCE_REVIEW.md) and [four supplemental cases](../synthetic/pilot-radio-supplemental-cases.json): refusal, native-radio contention, withdrawal/override and conflicting pilot reports. Existing fixtures and reports are preserved.

No user preference has been inferred from the approval to prepare these options. The next useful decision is the user's reaction to the scene and audition; no repeated offline test run or new setup dependency is needed to provide that feedback.
