# Offline companion workbench

This local workbench exercises synthetic mission observations, recommendations, command parsing and conversation/voice lifecycles. It does not attach to or control MW5. Simulated dispatch requires a synthetic mission and explicit simulation arming; live capabilities are unavailable.

Use Node.js 24 and an independently provisioned runtime. `START_COMPANION.cmd` expects `MW5_COMPANION_RUNTIME_ROOT`; `MW5_COMPANION_NODE` can select its Node executable. Review the launcher and runtime-readiness checks before starting. The repository contains no model, native runtime or speech payloads.

The browser interface supports three persona contexts, editable callsigns and voice preferences, bounded push-to-talk previews, speech/microphone mute, quiet mode and simulation disarm. Model text and recognized speech are untrusted and cannot directly command the game. Engine startup, microphone capture and audio playback require explicit controls; starting the page does not automatically perform them.

Settings are local to `companion/local/`; mission facts remain in memory. Do not commit settings, recordings, generated audio, model caches or bearer tokens.

The implementation includes observation validation, bounded simulated control, interruption and freshness checks, one shared local model/speech lifecycle, and synthetic/VM tests. Model factuality, real microphone/speaker behavior, integrated latency and gameplay remain unaccepted. See [project status](../SOURCE_STATUS.md), [delivery scope](../design/FULL_MOD_DELIVERY.md) and [speech admission](../design/MISSION_SPEECH_ADMISSION.md).
