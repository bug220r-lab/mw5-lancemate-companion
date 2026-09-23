# Independent SmolLM3 setup review

Reviewed September 22, 2026 locally. **PASS for bounded data-transfer preparation; download, local model verification and native inference NOT_PERFORMED by this reviewer.** This is a source review and eight offline tests, not a completed installation or conversation acceptance.

## Scope and evidence

Reviewed `scripts/Install-SmollmCandidate.mjs` and the added `smollm3_3b` entry in `companion/models.lock.json`. Published provenance and Apache-2.0 declarations come from the separately collected primary-source evidence in `research/LOCAL_CONVERSATION_MODEL_CANDIDATE.md`; this reviewer did not repeat those network requests or inspect downloaded weights.

| Reviewed artifact | SHA-256 |
|---|---|
| Installer | `4e70824a09de481b81be1d5020d2788d1f23a24dc80aa3a9c60ba6d29cfd9b12` |
| Model lock | `747c32233ab73ebdb144617781de9483a0c419e0be60d697edf9c8a39c5edc29` |
| Independent tests, `companion/tests/smollm-setup.test.mjs` | `3a4342d3ff7724f77cdc069dd24ae9ef0ca2322d5f90b13c050ae1121e83bc72` |

The eight tests passed using built-in Node modules and tiny in-memory byte streams. They cover inert import/invalid arguments, exact immutable artifact and license metadata, preservation of existing Qwen/runtime pins against earlier native receipts, exact storage admission boundaries, unchanged streaming content, oversized chunks, short/corrupt content and upstream failure. They do not run the full installer with a fake filesystem, reserve a receipt, download data or start any model. Full transfer orchestration, containment and publication were reviewed statically.

## Findings and resolution

Two concrete issues were reported and corrected before this review was frozen:

1. License transfer could occur while the receipt still said `downloads: false`. The installer now records `DOWNLOADING_LICENSE`, `downloads: true` and `licenseDownloadAttempted: true` before the first network request; a separate `modelDownloadAttempted` marks the later request. These are attempted-transfer flags, not claims of verified success.
2. A failed final receipt write could skip closing its handle. Final saving now has a nested `finally` that always attempts `receipt.close()`.

No remaining blocker was found for this fixed candidate transfer.

## Concrete safeguards and limits

Only `--check` and `--download` are accepted. Import and check do not transfer data. Model URL, revision, filename, size and hash are fixed in source and checked against the lock; caller-selected URLs or destinations are unavailable. License bytes also have fixed size and hash. Requests omit credentials and have time limits. HTTPS redirects may be followed by the standard downloader; final bytes must still match the pinned content before publication. No scripts, executable packages, native engine or game/editor are launched.

The destination and research directory components must be real directories, not symlinks, and their resolved locations must remain under the project. Target, partial file, license and new receipt must be absent. Exclusive file creation and the fixed new receipt prevent overwriting existing artifacts. The only published model path is linked after full partial-file verification, then verified again. Earlier receipts are only read by the independent tests; the installer does not update them or change a default model.

The initial gate reserves two full model copies, 1 MiB cache allowance and **10 GiB working space**: **14,569,077,440 bytes** required. The gate is rechecked after license transfer, free space is sampled during model transfer, and the final reserve is checked. The budget is conservative because the final hard link shares the staging data. Sampling cannot prevent unrelated processes from consuming space between checks; a loss results in failure rather than a success claim.

Hard-link publication is acceptable here: both names are fixed on the same volume, `link()` fails if the final name already exists, and no existing file is replaced or removed. The retained `.candidate-partial` name is a second link to the same verified data, **not an independent backup**. Editing through either name would change the shared file, so later runtime integrity verification remains necessary. If linking is unsupported, the operation fails; there is no overwrite fallback. Failed transfers deliberately retain their new files/receipt for inspection and cannot be silently rerun over them.

A source-level preparation pass does not establish remote availability, successful NTFS publication, installed artifact integrity, runtime compatibility, model quality or performance. Those require their separate recorded outcomes. The fresh held-out conversation fixture and all prior failed native receipts remain unchanged.
