# Different local conversation model candidate

Researched September 23, 2026 UTC / September 22 locally. **DOCUMENTED CANDIDATE; download, local metadata verification, native inference and quality acceptance NOT_PERFORMED.** Only public primary-source pages/metadata were read. No weights or repository scripts were downloaded or executed; no runtime or default was changed.

## Recommendation

Select **SmolLM3-3B, Q4_K_M**, for preparation of one bounded local diagnostic. It is a different instruction-trained model family, not another Qwen3 prompt treatment. Its small published artifact, author-endorsed GGUF distribution and architecture support in the already pinned runtime make it plausible for this machine. None establishes acceptable conversation or a speed advantage.

The model author is **HuggingFaceTB**. The selected GGUF publisher is **ggml-org**, the llama.cpp organization; these are distinct accounts. The author's [official SmolLM3 collection](https://huggingface.co/collections/HuggingFaceTB/smollm3) explicitly includes `ggml-org/SmolLM3-3B-GGUF`, and the [GGUF model card](https://huggingface.co/ggml-org/SmolLM3-3B-GGUF/raw/4965cb60b150737b68a0408c36aeefb65078f894/README.md) identifies `HuggingFaceTB/SmolLM3-3B` as its source. This is the selected official ecosystem distribution, not an unrelated community quantization. No second model was needed for this bounded search.

## Exact proposed artifact

The following fields were read without authentication from the official [revision metadata endpoint](https://huggingface.co/api/models/ggml-org/SmolLM3-3B-GGUF/revision/4965cb60b150737b68a0408c36aeefb65078f894?blobs=true). The initial sandbox request was network-blocked; the approved read-only retry returned metadata successfully. No token, login or paid service was used.

| Field | Value |
|---|---|
| Repository | `ggml-org/SmolLM3-3B-GGUF` |
| Immutable revision | `4965cb60b150737b68a0408c36aeefb65078f894` |
| Filename | `SmolLM3-Q4_K_M.gguf` |
| Exact size | **1,915,305,312 bytes**, approximately **1.784 GiB** |
| SHA-256 | `8334b850b7bd46238c16b0c550df2138f0889bf433809008cc17a8b05761863e` |
| LFS pointer blob ID | `b2767aa0a163fee52c40f6e763d3ec55c71d17df` |
| Repository access | `private: false`, `gated: false`, `disabled: false` |
| Declared license | `apache-2.0` |

The [published file page](https://huggingface.co/ggml-org/SmolLM3-3B-GGUF/blob/4965cb60b150737b68a0408c36aeefb65078f894/SmolLM3-Q4_K_M.gguf) and [commit diff](https://huggingface.co/ggml-org/SmolLM3-3B-GGUF/commit/4965cb60b150737b68a0408c36aeefb65078f894) independently expose the same hash; the diff supplies the exact byte count. That commit fixes the chat template. Use this revision rather than the older hash in its parent. These are publisher metadata, not a hash of a locally installed candidate.

The pinned future download location is [the revision-specific GGUF](https://huggingface.co/ggml-org/SmolLM3-3B-GGUF/resolve/4965cb60b150737b68a0408c36aeefb65078f894/SmolLM3-Q4_K_M.gguf). This research did not request its binary body. The repository metadata establishes ungated publication; a future transfer still needs ordinary network success and local byte/hash verification.

## License and model limitations

Both the author and GGUF cards declare Apache 2.0. Its [copyright grant and redistribution conditions](https://www.apache.org/licenses/LICENSE-2.0) permit this personal local use without royalties; retain the license and applicable notices with any distributed package. No subscription is required for downloaded-weight inference.

The [author's card](https://huggingface.co/HuggingFaceTB/SmolLM3-3B#model-summary) describes a 3B decoder using grouped-query attention and mixed positional treatment, trained and post-trained separately from Qwen3. Its instruction model supports custom system instructions. Extended thinking is on by default; the [documented control](https://huggingface.co/HuggingFaceTB/SmolLM3-3B#enabling-and-disabling-extended-thinking-mode) accepts `enable_thinking=False`, with system `/think` or `/no_think` taking precedence. Do not assume the current user-text suffix alone disables thinking for this family. The [limitations](https://huggingface.co/HuggingFaceTB/SmolLM3-3B#limitations) explicitly allow factual errors, inconsistency and training-data bias. Published benchmark scores are not evidence of MW5 grounding, human-order correctness, persona quality or performance of this quantization on this laptop.

## Existing runtime and resource fit

The exact installed runtime's source pin, llama.cpp **b11065**, commit `ce8caa6e60a03093351d6016a818720e0d46f0fb`, explicitly maps `LLM_ARCH_SMOLLM3` to its model implementation in [src/llama-model.cpp, lines 291–292](https://github.com/ggml-org/llama.cpp/blob/ce8caa6e60a03093351d6016a818720e0d46f0fb/src/llama-model.cpp#L291). The project's [official feature matrix](https://github.com/ggml-org/llama.cpp/wiki/Feature-matrix) lists K-quants for CPU AVX/AVX2. This is source-supported family/format compatibility, not a successful load of this exact file on Windows 10. No runtime upgrade is proposed.

The supervisor supplied approximately **5.2 GiB available RAM and 24.7 GiB free disk**; these were not freshly remeasured by this researcher. One artifact is 1.784 GiB. Conservatively allowing both a temporary and final copy plus the unchanged 10-GiB working reserve requires approximately **13.568 GiB**, leaving about 11.132 GiB beyond that allocation at the supplied snapshot. This excludes any additional downloader cache; a future installer must count or avoid those copies and recheck free space.

RAM cannot be inferred from file size. Weights, KV cache, compute buffers, runtime caches and other processes must fit while retaining the two-GiB running floor. The current free-memory figure makes a gated, single-model attempt plausible, not proven. Keep the initial **2,048-token context, 64-token output, one slot and CPU-only** workload. Do not load this alongside Qwen or infer enough spare resources for MW5, recognition and synthesis together. Latency, total RAM, tokenizer input size and game-loaded overhead are UNKNOWN.

## Exact next preparation and blocker

The current adapter allowlists only the two Qwen artifacts, so this candidate cannot simply be selected. Before any attempt, add a separately reviewed fixed candidate pin/selector, preserve existing default behavior and receipts, and prepare exclusive evidence accounting. After a separately prepared, storage-gated transfer within the user's existing local-model authorization, verify the full file and inspect its embedded chat template/nonthinking handling before generation. The normal stream-completion rejection, stop conditions and owned-process cleanup must remain intact.

Then freeze a small independent conversation evaluation before outputs, using supplied-fact attribution, absent/conflicting evidence, false history and ordinary conversation. Keep all prior failed cases as exposed regressions, not fresh holdouts. Do not treat one successful line or model-card instruction score as acceptance. The remaining decisive blockers are measured grounding and latency under the actual project constraints; this research resolves candidate provenance and preparation feasibility only.
