# Phase B native string-binding observations

**OBSERVED_EDITOR_PYTHON_BINDINGS_WITH_WRAPPER_LIMITATIONS.** Root invoked the reviewed one-use entry in the owned editor, PID26084. This reviewer only inspected the resulting files and independently recomputed their expected values; no further native action occurred. The Phase B contract/model remain unchanged.

The [native result](evidence/phase-b-string-semantics-20260927-01/native.result.json) contains81 returned calls over11 fixed synthetic fixtures:11 lengths,46 indexed characters and24 substrings, with no recorded exception. All three methods identify as native `builtin_function_or_method_with_closure` bindings on `StringLibrary`; their recorded module is null. These are editor Python binding observations, not Blueprint execution or shipping-game acceptance.

| Check | Observation | Bounded interpretation |
|---|---|---|
| Length | All10 non-NUL fixtures match UTF-16 code-unit length; five supplementary-character fixtures differ from Python code-point length. | Supports the proposed UTF-16 accounting for these strings through these editor bindings. |
| Character indexing | All33 checks outside the NUL fixture match UTF-16 units, including55357/56960 for the two halves of U+1F680. | Supports code-unit indexing at the tested40-unit and256/257-unit boundaries. |
| Intact substrings |17 of24 slices match their UTF-16 expectations, including intact supplementary pairs. | The tested safe boundaries preserve the expected strings. |
| Deliberately split pair | Four slices isolate a surrogate half; each returned string replaces that half with `?` (U+003F). | Keep the existing requirement to avoid splitting pairs. This test cannot locate the substitution within native FString versus Python return conversion. |
| Embedded NUL | The13-unit input is observed as length7. Whole-string substring returns the prefix before NUL; suffix slices are empty; indices8–12 return0. | The Python/native boundary did not preserve this input as an observable13-unit string. Internal Blueprint FString NUL behavior is not established. |

The NUL fixture's index7 returns0, which cannot distinguish an actual NUL from the documented out-of-range result. TAB/LF/CR before that boundary were observed correctly. U+001F and DEL occur after NUL and were not successfully exercised. A later native control-character validation check should use a NUL-free fixture for those values; this report does not authorize or execute another attempt.

There are13 operation mismatches against the original Python strings: one length, five character reads and seven substrings. Therefore this is **not an all-fixtures-pass result**. Every saved boolean, fixture input, index/slice, expected/returned code-unit array and total was independently checked in the [review receipt](evidence/phase-b-string-semantics-20260927-01/native-independent-review.json). No diagnostic validator, segmentation function, page bound, visible glyph/layout, asset behavior or retail behavior was exercised. Native Blueprint validation must still use the actual native length for range guards, preserve valid pairs and reject disallowed inputs; the Python reference model alone cannot establish that implementation.

The recorded claim is `2026-09-27T08:38:07.199994+00:00` and finish is `2026-09-27T08:38:07.217945+00:00`. Both explicitly use UTC, equivalent to04:38:07 EDT. The original fields are preserved; neither file records a local-offset timestamp under a UTC label.

| Artifact | SHA-256 |
|---|---|
| Native result,91609 bytes | `abc83597fc7ef79c806eea335db1614e41e7e8581dea3d8debfb1347f14688cf` |
| Independent result review,10912 bytes | `882c57dc0e10e8a40c7c01e841e10839e47c4ce6ef8a4b6a700e3989cd661d2a` |
| Reviewed helper | `f6c4df39c86c1509d14c63554e4e86fca3e834860341975872410083e39be1dc` |
| Executed corrected entry | `a42f191553c752452afc3094b8c8ed42eaada5698fc1bb7bfba46bdc72fa5caf` |

The earlier preparation used the C++ name `KismetStringLibrary` as a Python type. Independent review corrected it to the documented `unreal.StringLibrary` before execution; the superseded preparation and helper snapshot remain preserved. API declaration pin `ac4c46761bc54099302155bc0a908ae3f64b161ca77eb9afd0cc6c1f1b826480`, class215085 and methods215360/215457/215472, applies to the collected local editor1.1.390.0e/UE4.26.2 documentation. No asset, world, component query, clipboard, save, compile, package or game operation was part of this string check.
