# MW5 Companion — offline workbench

This personal preview lets you explore three fictional pilots, tactical recommendations, radio scheduling and command interpretation using synthetic mission state. Game observation, game control and direct piloting are unfinished.

## Start

1. Keep the complete package together in its own writable folder.
2. Use an existing **Node.js 24** installation. The package does not include or install Node. The launcher checks the existing local runtime, then the system path; an explicit `MW5_COMPANION_NODE` setting can select a full Node executable path.
3. Open **START_COMPANION.cmd**. It starts the local workbench and opens its browser page. Opening the page does not start speech engines, request microphone access or play audio.
4. Click **Start synthetic mission**. Explore the pilots, **Arm simulation**, and **Simulate recommendations**. **Disarm simulation** stops simulated dispatch. Typed commands only show how the text would be interpreted.

The Node version used for a restore check is recorded in its accompanying validation receipt. Other machines and an Explorer double-click need their own validation.

## Included features and optional components

The package contains the workbench's authored source, web interface, synthetic scenario, configuration pins and file manifest. It contains no saved preferences, game files, campaign data or research exports.

Language models, speech models, native engine runtimes and generated audio are excluded. The voice and microphone panels require separately installed and verified local components; those features are unavailable from this package alone. The package performs no automatic downloads. Full conversational quality and game performance remain unaccepted.

## Preferences and removal

**Save preferences** writes only to this copy's `companion/local/settings.json`. Synthetic mission facts reset when starting a new mission. Preferences in another checkout are not imported automatically.

To stop, close the workbench's terminal or press **Ctrl+C** there. Keep `companion/local/settings.json` separately if you want to retain your preferences. After stopping, removal consists of deleting this package's own folder; there is no installed service or game modification to undo.

## Verification scope

`WORKBENCH_MANIFEST.json` lists the packaged files, byte counts and hashes. A pristine-package check can detect missing, changed or extra files before use. Saving preferences intentionally adds local state afterward.

An offline restore receipt covers only its listed checks. It does not establish browser appearance, microphone operation, listening quality, native engine restoration, game integration or completion of the mod.
