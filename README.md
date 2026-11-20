# MW5 Lancemate Companion

Source and design for a single-player MechWarrior 5: Mercenaries companion project. The planned releases share this repository: **Tactical Companion** first, then **Direct Pilot**.

Three distinct AI lancemates are intended to understand mission commands, give grounded radio replies, coordinate targets and positions, and yield to human input. Tactical Companion would use individually verified native AI actions. Direct Pilot adds low-level steering, aiming and weapon control only after ownership and restoration are proven.

## Current status

This snapshot contains offline source, synthetic tests, an implementation workbench and product specifications. **It is not an installable or accepted MW5 mod.** The workbench's live/native adapter is unavailable. Native integration, gameplay, voice quality, latency and complete release acceptance remain unfinished.

The latest source increment addresses expired conversation admission, control instance identity, and malformed mission-speech input. Recorded local focused tests passed; these results are offline evidence, not a game test. See [SOURCE_STATUS.md](SOURCE_STATUS.md) for scope and limits.

## Contents

- `companion/`: observation and command validation, local conversation and speech lifecycles, radio arbitration, browser workbench, and tests.
- `scripts/`: authored offline policy, evaluation, packaging and optional runtime setup tools.
- `synthetic/`: supplied-state scenarios and explicitly synthetic fixtures.
- `design/`: product requirements and proposed interfaces. Dates and historical findings remain scoped to their original documents.

Start with [the delivery scope](design/FULL_MOD_DELIVERY.md), [architecture](design/ARCHITECTURE.md), and [workbench guide](companion/README.md).

## Development

Node.js 24 is the intended workbench runtime. Python and separately provisioned, licensed model/runtime inputs are needed for optional speech/model experiments. Merely opening or testing the source does not install them. Native assets, packages, downloaded models, recordings, local settings and private workstation evidence are not included.

The focused admission tests can be run without models or the game:

```powershell
node --test companion/tests/conversation-deadline-admission.test.mjs companion/tests/conversation-priority-admission.test.mjs companion/tests/control-instance-identity.test.mjs companion/tests/mission-speech-array-integrity.test.mjs companion/tests/mission-speech-enum-admission.test.mjs
```

Other historical tests and scripts may require omitted local experiment inputs. No complete clean-checkout regression is claimed for this export. Runtime setup and historical experiment scripts require review of their current prerequisites before execution.

MechWarrior, BattleTech and game/engine assets belong to their respective owners. This source snapshot grants no rights to redistribute game or third-party assets.
