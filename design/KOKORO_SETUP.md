# Kokoro CPU setup and component validation

Updated **2026-09-21**. Status: **PASS_LOCAL_CPU_FILE_SYNTHESIS_ONLY**. The subsequently authorized isolated setup is installed and all three candidate voices produced valid WAV files. No microphone, speaker playback, paid service or game/editor execution occurred. Sound quality approval and performance alongside MW5 remain **NOT_PERFORMED**.

**Observed result:** one CPU model served `af_bella`, `am_adam` and `af_heart` sequentially using two Torch threads. The three 4.10–4.85 second samples required **3.47–4.41 seconds** of synthesis each. Initial imports plus model readiness took **50.40 seconds**, and peak process working set was **1.26 GiB**. This is successful local file synthesis; it does not establish acceptable conversational latency or voice casting. The benchmark's actual values and hashes are in [KOKORO_COMPONENT_BENCHMARK.json](../research/KOKORO_COMPONENT_BENCHMARK.json).

## Completed isolated installation

The parent allocated **4 GiB total additional disk** to TTS while reserving **10 GiB free on C:** for the combined stack. The measured first installation estimate was below that cap; a resumed conservative estimate was **4,119,697,860 bytes**, counting retained archives, twice the expanded installation size, model allowance and overhead. After setup and the three WAVs, the observed TTS directory size was **2,174,498,499 bytes (2.03 GiB)**. C: free in the repaired installation receipt was **18,158,592,000 bytes (16.91 GiB)**; that is a timestamped observation, not a continuing guarantee.

The project-owned [Setup-Kokoro.mjs](../scripts/Setup-Kokoro.mjs) creates a venv from the existing bundled Python if needed, resolves only binary wheels, fetches hash-locked official assets, inspects expanded archive sizes, and installs offline with `--require-hashes --no-index --no-deps --no-compile`. Its disk checks include local temporary/cache files and reject an allocation or free-space violation. It does not install system software or change PATH. No upstream repository setup script was run.

Evidence under `companion/local/tts/manifests/`:

- `resolve.json`: exact resolved wheel URLs and publisher/resolver hashes; `requirements.lock.txt`: the resulting 89-package lock including spaCy's English model.
- `assets.json`: every selected wheel/model/voice/license asset, size and SHA-256. The four model/voice payloads match the publisher hashes listed below. The official fixed-version spaCy model and small pinned source/license files have recorded download hashes, distinct from publisher-advertised hashes.
- `budget.json`: the latest measured archive sizes and pre-install/repair budget calculation; `install-receipt.json`: actual installed disk and `pip check` result.
- `installed.json`: actual installed package versions, including pip and the retained `annotated-doc` dependency from the first resolution. Old downloaded wheel archives remain within the component's measured disk total.

The initial offline import test exposed a real dependency mismatch: spaCy 3.8.4 imports Click, whereas the latest allowed Typer no longer supplies it. The repair pins **Typer 0.15.1, typer-slim 0.15.1 and Click 8.1.8**. The failure and original resolution are preserved in `logs/benchmark-001-click-missing.json` and `logs/resolve-before-cli-pins.json`. Both the repaired `pip check` and actual synthesis pass. The wheel-only resolver selected **num2words 0.5.6**; the numeric phrase `3 pilots, 1 channel. 120 meters.` generated phonemes and WAV successfully. Other pronunciation cases remain untested. Dependency deprecation/SyntaxWarnings were emitted; none were treated as a voice-quality pass.

The [Exercise-Kokoro.py](../scripts/Exercise-Kokoro.py) benchmark verifies local model hashes, CPU-only Torch, local spaCy/eSpeak and WAV headers/content, with Python socket APIs blocked. It recorded **zero network attempts**, finite audio and no out-of-range PCM samples. Its original authored lines assert no mission facts. The files are `companion/local/tts/audio/{edge-af_bella,tactician-am_adam,scout-af_heart}-component.wav`; they were not played.

Offline rerun after setup:

```powershell
& '.\companion\local\tts\venv\Scripts\python.exe' -B '.\scripts\Exercise-Kokoro.py'
```

The [Kokoro-Worker.py](../scripts/Kokoro-Worker.py) and [local-speech.mjs](../companion/local-speech.mjs) add an optional persistent CPU process with private NDJSON pipes. `createLocalSpeech()` is inert until `start()`. `synthesize({text,voiceId},{signal})` allows only the three voice IDs above and at most 256 characters; it accepts no paths or commands. One request may run at a time. Abort/timeout kills the owned worker, rejects the request and removes only that interrupted request's known unfinished/unaccepted outputs. An explicit `restart()` is required afterward. Accepted outputs are preserved under `companion/local/speech-output/`; that directory is capped at 64 MiB, with the 10 GiB free reserve checked before synthesis. There is no HTTP listener, microphone, player or game API. These files do not establish factual grounding of supplied text.

The worker's **29 synthetic tests pass**, covering request limits, identity/path validation, lifecycle races, timeout, cancellation, late replies and restart. A separate real local smoke exercise successfully generated three WAVs across model reuse and one explicit restart; it stopped an active synthesis on AbortSignal. Its measured times, package/asset receipt hashes and accepted file hashes are preserved in `companion/local/tts/logs/worker-smoke.json`. `firstAudioMs` means the first tensor became available; the adapter returns only a complete verified file. It is neither an audible-latency measure nor streaming playback. Interrupting a worker requires reloading it; that startup cost remains visible to the calling UI.

**Initial research snapshot follows.** The original inspection was read-only; its proposed 3 GiB allocation and future-tense setup steps below are historical. The completed 4 GiB authorization and measured results above supersede those proposals.

## Observed local environment

| Check | Result |
|---|---|
| Existing runtime | `C:\Users\jlewi\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe` |
| Version/platform | CPython **3.12.14**, 64-bit AMD64, `win-amd64` |
| Package manager | pip **26.2.1**; `venv` module available |
| Relevant installed packages | NumPy **2.3.5**; torch, kokoro, misaki, soundfile, transformers, huggingface-hub, spaCy, phonemizer and espeakng-loader absent from this runtime's distribution metadata |
| PATH lookup | `python`/`python3` resolve to WindowsApps aliases; no `py` command found. Use the verified absolute interpreter path. The aliases were not launched. |
| C: free at inspection | **24,604,332,032 bytes / approximately 22.91 GiB** |
| Budget after 10 GiB reserve | Approximately **12.91 GiB** for the entire new stack, including temporary downloads and caches, before further allocations |
| System eSpeak default path | Neither `C:\Program Files\eSpeak NG\libespeak-ng.dll` nor `espeak-ng.exe` was found. This narrow check is not a whole-machine absence proof. |

OS/RAM queries through `Get-CimInstance` returned access denied, so they were not promoted to fresh hardware measurements. Ordinary shell HTTP requests were blocked by the current sandbox; public sources were read through the web tool. That is a future installer execution constraint, not a Kokoro incompatibility result. No elevation or workaround installation was attempted.

## Versions and direct requirements

The published **Kokoro 0.9.4** wheel requires Python **>=3.10,<3.13**. Its release-era source is commit **`1c7bdd971d2e32981f0f2b92d1fe5b0051e21457`**. Direct dependencies are `huggingface_hub`, `loguru`, `misaki[en]>=0.9.4`, `numpy`, `torch` and `transformers`. The portable Python wheel is about 32.6 kB; that excludes models and dependencies. [Published package](https://pypi.org/project/kokoro/0.9.4/), [pinned requirements](https://github.com/hexgrad/kokoro/blob/1c7bdd971d2e32981f0f2b92d1fe5b0051e21457/pyproject.toml#L17).

Misaki **0.9.4**, release-era commit **`e820629b96334db28227df37f280e4836d46fadb`**, requires `addict` and `regex`; its English extra adds `num2words`, `spacy`, `spacy-curated-transformers`, `phonemizer-fork` and `espeakng-loader`. Its Python range is **>=3.8,<3.13** and published wheel is about 3.6 MB. These bring their own dependencies; this is not a complete installation lock. [Pinned Misaki requirements](https://github.com/hexgrad/misaki/blob/e820629b96334db28227df37f280e4836d46fadb/pyproject.toml#L17), [published package](https://pypi.org/project/misaki/0.9.4/).

Use the existing Python to create a **separate project voice virtual environment** after allocation; do not install into Codex's bundled runtime or share MW5's environment. `soundfile` is additionally useful for a WAV audition, and its publisher supplies a Windows x64 wheel, currently 0.14.0 at about 1 MB. No playback or microphone package is required merely to write a WAV. [SoundFile package files](https://pypi.org/project/soundfile/#files).

PyTorch explicitly supports a Windows CPU installation. Its official CPU index supplies CPython 3.12/Windows x64 wheels. Kokoro's checked-in `uv.lock` lists torch 2.6.0 and transformers 4.48.3, **but identifies Kokoro itself as 0.9.2**, so that file is historical compatibility evidence, not a current 0.9.4 release lock. Do not automatically install an unbounded latest dependency set or claim the old lock is tested here. Resolve and pin the selected complete package set before installation. [PyTorch Windows CPU instructions](https://pytorch.org/get-started/locally/#windows-installation), [official CPU wheel index](https://download.pytorch.org/whl/cpu/torch/), [upstream lock](https://github.com/hexgrad/kokoro/blob/1c7bdd971d2e32981f0f2b92d1fe5b0051e21457/uv.lock).

Prefer prebuilt matching Windows wheels. If resolution requests a compiler/source build or an unexpectedly large CUDA stack, stop and review the selected package set rather than installing a toolchain or CUDA automatically. A separate CUDA toolkit is unnecessary for the selected CPU path.

## eSpeak, language data and first-run downloads

Release-era Misaki loads its eSpeak library and data through `espeakng_loader`. Version 0.2.4 has a **Windows x86-64 wheel, about 9.4 MB**, so a system-wide eSpeak MSI is not the first installation step for this package combination. DLL loading still needs a real local test. [Pinned loader use](https://github.com/hexgrad/misaki/blob/e820629b96334db28227df37f280e4836d46fadb/misaki/espeak.py#L1), [Windows loader wheel](https://pypi.org/project/espeakng-loader/#files).

Misaki's English G2P constructor calls `spacy.cli.download` when its language package is absent. Default `trf=False` selects **`en_core_web_sm`**; enabling transformer G2P selects a different, larger package. Preinstall a version compatible with the resolved spaCy package before offline operation. The publisher's currently displayed small English model wheel is about 12.8 MB, but its exact version must match the chosen spaCy dependency set. [Pinned G2P initialization](https://github.com/hexgrad/misaki/blob/e820629b96334db28227df37f280e4836d46fadb/misaki/en.py#L467), [publisher model file](https://huggingface.co/spacy/en_core_web_sm/blob/main/en_core_web_sm-any-py3-none-any.whl).

**Do not conflate GitHub main with the published 0.9.4 packages.** Later main commits allow Python 3.13. Misaki main also added a transformer fallback that can load another model if no eSpeak fallback is supplied; the inspected April 5 release-era G2P keeps fallback `None` instead. Pin the chosen releases and inspect installed sources before preparing a complete offline manifest. [Python metadata change](https://github.com/hexgrad/kokoro/commit/dfb907a02bba8152ca444717ca5d78747ccb4bec), [later Misaki fallback](https://github.com/hexgrad/misaki/blob/fba1236595f2d2bf21d414ba6e57d25256afada3/misaki/en.py#L469).

## Model and disk accounting

Official model repository: **`hexgrad/Kokoro-82M`**, with `kokoro-v1_0.pth`, `config.json` and individual voice tensors. The repository revision surfaced during this check was **`9871713c6a29032f914cee65b617e2b6b3323770`**; its tree lists about 363 MB for the repository. The entire repository is unnecessary for a bounded three-voice audition. [Official model tree](https://huggingface.co/hexgrad/Kokoro-82M/tree/9871713c6a29032f914cee65b617e2b6b3323770).

The following exact values came from small LFS pointer text, **not downloaded weights**. These three voice files are size examples, not user-approved final casting:

| File | Bytes | SHA-256 |
|---|---:|---|
| `kokoro-v1_0.pth` | 327,212,226 | `496dba118d1a58f5f3db2efc88dbdc216e0483fc89fe6e47ee1f2c53f18ad1e4` |
| `voices/af_heart.pt` | 523,425 | `0ab5709b8ffab19bfd849cd11d98f75b60af7733253ad0d67b12382a102cb4ff` |
| `voices/af_bella.pt` | 523,425 | `8cb64e02fcc8de0327a8e13817e49c76c945ecf0052ceac97d3081480e8e48d6` |
| `voices/am_adam.pt` | 523,420 | `ced7e284aba12472891be1da3ab34db84cc05cc02b5889535796dbf2d8b0cb34` |

Sources: [model pointer](https://huggingface.co/hexgrad/Kokoro-82M/raw/main/kokoro-v1_0.pth), [heart pointer](https://huggingface.co/hexgrad/Kokoro-82M/raw/main/voices/af_heart.pt), [bella pointer](https://huggingface.co/hexgrad/Kokoro-82M/raw/main/voices/af_bella.pt), [adam pointer](https://huggingface.co/hexgrad/Kokoro-82M/raw/main/voices/am_adam.pt). Verify the pinned-revision payload hashes when actually downloaded.

Their sum is **328,782,496 bytes**, plus `config.json` (displayed about 2.35 kB). That is only the model/voice subset. Python wheels, expanded libraries, spaCy model, temporary files and caches remain additional. For scale, the historical upstream lock lists a **204,120,469-byte** Windows/CPython 3.12 torch 2.6.0 PyPI wheel; this is **not** an exact size claim for a newly selected `+cpu` wheel. [Config](https://huggingface.co/hexgrad/Kokoro-82M/blob/main/config.json), [historical wheel size](https://github.com/hexgrad/kokoro/blob/1c7bdd971d2e32981f0f2b92d1fe5b0051e21457/uv.lock#L1514).

**Proposed allocation: 3 GiB peak disk for the isolated voice stack**, including its cache and install staging. This is an allocation to test, not a measured requirement or a guarantee. Root must approve it within the shared 12.91 GiB available budget. Resolve the exact wheel/model manifest and measure expanded sizes; stop before violating either this allocation or the shared 10 GiB free-space reserve. Avoid cloning all samples/languages, duplicating the model for three pilots, or relying on implicit global caches. If the manifest cannot fit, request a revised allocation before the download.

## Offline CPU run shape after setup

The supported local-file path is to construct one `KModel` from local config/weight paths, move it explicitly to CPU, reuse it in the English pipeline, and supply local voice `.pt` paths. Model loading uses `weights_only=True`; do not disable that option to accommodate arbitrary files. One shared model serves the three voices sequentially, matching the radio director's single-speaker rule. [Pinned KModel constructor](https://github.com/hexgrad/kokoro/blob/1c7bdd971d2e32981f0f2b92d1fe5b0051e21457/kokoro/model.py#L27).

`KPipeline(lang_code='a', model=model, trf=False, device='cpu')` is the American-English path; local `.pt` voice filenames avoid lazy voice downloads. Default model construction and symbolic voice names otherwise fetch from Hugging Face. Output is normally saved at 24,000 Hz in the official example. The model and voice must agree with the language. [Pinned pipeline](https://github.com/hexgrad/kokoro/blob/1c7bdd971d2e32981f0f2b92d1fe5b0051e21457/kokoro/pipeline.py#L57), [official usage](https://github.com/hexgrad/kokoro#usage).

Set a dedicated `HF_HOME`/cache path before imports, disable Hub telemetry, and use `HF_HUB_OFFLINE=1` after preparation. Offline Hub mode fails on missing cache instead of downloading, but **does not stop spaCy's own package downloader**; first verify that `en_core_web_sm` is installed, then run the worker with no network. Explicit local model paths avoid redundant cache copies. Windows cache behavior can otherwise duplicate large files when symlinks are unavailable. [Hub environment controls](https://huggingface.co/docs/huggingface_hub/en/package_reference/environment_variables).

This is a local inference path, with no per-line API billing or subscription in the proposed runtime. It still consumes local CPU, RAM, disk and initial bandwidth. The source license and redistribution notices belong in the eventual package manifest; this feasibility note does not certify a release's license bundle.

## Exact next bounded experiment

1. Root allocates the combined disk budget. Resolve all Windows/Python 3.12 wheels plus the compatible spaCy model and selected official model files, recording versions, URLs, hashes, compressed sizes and projected peak staging. No unbounded `main` or latest-only setup.
2. After the manifest fits, create the isolated environment, install only that manifest, prefetch the approved assets and record actual disk growth. Preserve the shared Codex Python installation.
3. Validate imports, loaded eSpeak library, existing spaCy model, CPU device and local assets with network disabled. Failure should return a clear unavailable status, not fetch more dependencies on first speech.
4. Generate a few original short mission lines into local WAV files without microphone capture, playback or game execution. Measure cold-start time, first-audio latency, total synthesis time divided by audio duration, peak memory, CPU use and all three voice outputs. Keep the thread count bounded and record it. A successful file is not a latency/quality pass.
5. Obtain listening feedback and separately test interrupting the worker and clearing queued audio. Only then connect synthesis to a supervised playback host. Real-time performance alongside MW5 remains a later measurement.

The initial read-only feasibility check did not run these steps. The later authorized setup completed the lock, footprint and CPU benchmark above. Remaining release evidence includes MW5 terminology pronunciation, acceptable character voices, actual playback/interrupt behavior, and game-concurrent latency/overhead. The private worker cancellation check is a process/file result, not a playback result.
