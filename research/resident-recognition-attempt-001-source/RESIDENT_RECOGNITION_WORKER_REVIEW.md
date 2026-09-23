# Independent resident recognition worker review

Reviewed **2026-09-23 UTC**. **SOURCE_AND_ABI_REVIEW_COMPLETE; NATIVE_NOT_PERFORMED.** No remaining source-level ABI/lifetime blocker was found in the frozen worker below. This is an opt-in private-pipe prototype, not a replacement of the cold recognition default or accepted mission speech.

| Reviewed artifact | SHA256 |
| --- | --- |
| `companion/resident_recognition_worker.py` | `908fa18c7504f405af435f45ad499239ff8b9827b7f107dfac41633e18d6f80c` |
| `scripts/Test-ResidentRecognitionWorker.py` | `e169ab89072387182d01959466d68945ce2d80aeb015837b440a1bfca6e2eca6` |

The reviewer read source and tests, independently derived layouts with separate pure ctypes definitions on Windows x64 Python **3.12.14 / MSC1944**, and recomputed source hashes. The reviewer did not execute the worker/tests or load Whisper/GGML/model libraries. The author reports **20/20 implementation cases PASS_MOCK_ONLY** against these hashes; this review does not relabel that run independent or native. An earlier test-only failure came from replacing the platform environment during mocking; the author retained platform enforcement and fixed the test setup.

## ABI and lifetimes

The reference is whisper.cpp **b5130**, commit `927cfce34f31707e17f2bff35c349632fb9e2c3a`. Local pinned sources are under `tmp/resident-whisper-source-b5130/`.

| Structure | Windows x64 bytes / alignment |
| --- | --- |
| ContextParams | 48 / 8 |
| FullParams | 304 / 8 |
| Ahead; Aheads | 8 / 4; 16 / 8 |
| TokenData; GrammarElement | 56 / 8; 8 / 4 |
| VadParams; Greedy; BeamSearch | 24 / 4; 4 / 4; 8 / 4 |

All fields and offsets agree with the independently transcribed header layout. Important FullParams offsets include `no_context=21`, `initial_prompt=72`, `prompt_tokens=88`, `language=104`, callback block **160–232**, grammar pointer **240**, and VAD structure **280**. The worker checks primitive sizes, alignment and every offset without custom packing. These are expected ABI layouts, not a compiled DLL sizeof observation.

The eleven Whisper prototypes match the C header: context and full parameters are passed **by value**; pointers are pointer-sized; void-returning frees/log setters have explicit void return types. `extern "C"` and the absence of a custom calling-convention macro support the worker's CDLL/C callback declarations; the Windows API uses WinDLL separately. Reference: whisper.h **19–39, 116–129, 487–607**. Logging is `void(int, const char *, void *)`; computation abort is `bool(void *)`, distinct from the fatal-error callback (ggml.h **713, 2858**).

Native default allocations survive their consuming calls. PCM float arrays and language bytes survive decoding; borrowed segment strings are bounded and copied before another decode/context free. Each request obtains fresh defaults and disables past transcription, initial/token prompts, language detection, user callbacks and external VAD. Requests execute sequentially; the header disallows concurrent use of one context.

The first version retained a registered global logger only through an engine instance. The corrected module-global thunk survives constructor failure, close and instance collection. Native library wrappers remain process-owned; cleanup frees the context without manually unloading backend registrations.

## Backend registration and search

This was a necessary correction, not proven by the original eleven exports. The pinned CLI explicitly loads backends at **cli.cpp:971**, before model initialization at **1081**. The corrected worker binds `ggml_backend_load_all_from_path(const char *) -> void` and `ggml_backend_dev_by_type(int) -> pointer`, requiring CPU enum **0** before creating a model context.

Registry source **480–502** confines ordinary discovery to the supplied non-null directory, but **600–603** independently honors `GGML_BACKEND_PATH`. The worker removes that override before loading native libraries; the parent must also omit it from the child environment. All 40 runtime files are verified before loading. CPU selection may briefly load several pinned variants to score them (**523–571**); this is not a single-DLL probe.

The internal loader uses plain `LoadLibraryW` (ggml-backend-dl.cpp:10). The worker therefore fail-closes on child-only `SetDefaultDllDirectories(USER_DIRS | SYSTEM32)`, adds the verified runtime directory, then uses absolute GGML/Whisper paths. The WinAPI signature is correctly DWORD32 to BOOL32. The restriction covers subsequent dependency searches and persists only in that process; registered user directories remain part of that search, so this is not an OS sandbox. [Microsoft contract](https://learn.microsoft.com/en-us/windows/win32/api/libloaderapi/nf-libloaderapi-setdefaultdlldirectories).

Registry **176–181** warns that backend resources/threads may outlive normal unload points; retaining libraries until process exit follows that source constraint.

## Evidence pins and limits

| Exact source | SHA256 |
| --- | --- |
| whisper.h | `a7d19f7feb5be52426628ff07e0602de28a30dc4312d0d0603e1e536753f76dd` |
| ggml.h | `34192eac913444df9dc1d23025a618448cdee1ee7d78597af4979d8edc77b695` |
| ggml-cpu.h | `316279e004cdeb8e6ef78599acb602bf79a8abdf897fed9fd1914808c1518c6e` |
| ggml-backend.h | `46d84cb998105f871240864fd0f55446939a2fe86c5c281afa63a010fb1f65a2` |
| ggml-backend-reg.cpp | `0f63c69ad083e0744872f57d59d049b069283303f5bbc646222907d779afe4d1` |
| ggml-backend-dl.h | `225bd83a197c4e8b5f985717176824d1144e2b74a79f04838f51b84115c14dc5` |
| ggml-backend-dl.cpp | `acd76df8b83bcdef6807bc7b0520f57b379d61b4ff1027c04aa4d140d16ad07f` |
| cli.cpp | `840f331f80a98c41fc21eb4cf109c4c6a5496b8f248e9bbce58dd733dece76b2` |

The fixed runtime inventory pins Whisper DLL `b7bb4ba92bd36b8afe0c00059ca6a0f69c6767193bfb5f0761e9ed27b1087803`; this audit did not load it. Resource/time cancellation remains a parent-owned process boundary, not an interruptible native-call claim.

The worker explicitly uses GREEDY, four threads, English, no context carry and no timestamps. Cold CLI strategy parity is **not established**: CLI **1210–1213** conditionally selects beam search. A future comparison must record that configuration difference rather than attribute every change to residency.

Protocol limits, canonical WAV checks, monotone request IDs, bounded output and fatal fixed-code errors are source-supported and covered by the author's mocked cases. Actual CPU registration, DLL compatibility, model loading, transcription quality/latency, live cancellation and process cleanup require separate recorded native evidence. No microphone, game, editor, listener or paid service was exercised here.
