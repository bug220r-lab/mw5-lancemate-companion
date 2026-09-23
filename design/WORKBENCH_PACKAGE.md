# Reproducible offline workbench package

This closes the delivery goal's local-workbench packaging gap. It is **OFFLINE_WORKBENCH_ONLY**, not the Tactical Companion or Direct Pilot release. Existing source backups remain separate: a backed-up checkout alone does not prove that the workbench can be restored with all its dependencies.

## Package boundary

Use an explicit, sorted inventory of 29 authored payload files: the launcher; 14 companion modules; five small JSON configuration/pin files; five public web assets; the tactical policy and synthetic scenario imported from outside `companion`; the authored Kokoro worker source; and the standalone package README. The README source is `design/WORKBENCH_PACKAGE_README.md` and its package destination is `README.md`.

Exclude all installed native components, model binaries, personal settings, generated media, research exports, tests, Git administration and other project contents. Optional engine configuration pins are included, but native previews cannot work from this package alone. An existing Node.js 24 runtime remains an external requirement. No software or game adapter is installed.

`WORKBENCH_MANIFEST.json` records fixed format/classification, the Node major-version requirement, total payload bytes and each relative path's byte count and SHA-256. The manifest contains no source-machine paths or timestamps. Equal input bytes must produce equal payload and manifest bytes in separately created directories. Directory timestamps are not part of reproducibility.

## Build and integrity checks

The builder reads only the fixed source inventory, with per-file/total size limits and stable-file checks. It creates a new output directory, never overwrites a destination and never deletes a failed attempt. Write the manifest last so incomplete output cannot present itself as a complete package. Source drift aborts the build.

Reject symlinks/junctions and unexpected file types using the supported filesystem checks, validate path components and canonical containment, and reject duplicate or case-colliding names. Do not claim detection of every Windows reparse tag; ordinary OneDrive cloud metadata is not by itself proof of a path escape. Building never executes the copied payload.

A pristine-package verifier checks the exact inventory, metadata, byte counts and hashes, including absence of extra files. Manifest hashes are integrity records, not signatures. The restore receipt separately binds the source and package identities used for its test. Preferences created by actually using the copy are intentionally outside the pristine payload and must be accounted for separately.

## Bounded restore proof

The restore verifier uses a uniquely named directory under this project's `tmp` tree and an exclusive receipt. Before an actual run, its check mode reports readiness without importing the copied application. An actual run builds two isolated packages, verifies both and compares their manifest and payload bytes.

Import the copied server module and invoke its actual `createWorkbench`; do not start its HTTP server. Exercise disconnected defaults, all three synthetic recipients, simulation arming/recommendations, human hold/release, possession, pause/resume and preference persistence across disposal/recreation. Only the copy's local settings path may change. Recheck payload hashes and preserve the untouched second package.

Temporarily deny and count the reviewed application's known process/network entrypoints during the copied-app exercise, restoring them in `finally`. These checks are instrumentation of known paths, not an operating-system sandbox or a comprehensive traffic monitor. Do not request browser/microphone access, start native engines, query the editor, control the game or use an external service.

The resulting status may be **PASS_OFFLINE_WORKBENCH_RESTORE_ONLY** only after the listed checks pass. Record actual runtime/version, source and package hashes, check outcomes, added local-state paths, cleanup/disposal results and any failures. Keep failed receipts; an unchanged rerun cannot erase them. Model restoration, browser appearance, native audio, gameplay and other-machine acceptance remain separate and unperformed.
