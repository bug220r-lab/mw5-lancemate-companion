# Local Qwen Q8 to Q4 candidate

**2026-09-21 — PASS_CONVERSION_ONLY_CANDIDATE_NOT_ENABLED. Inference/quality/latency evaluation NOT_PERFORMED.** Initial read-only inspection verified the installed quantizer and ran `--help` plus a metadata-only `--dry-run`. The subsequently authorized conversion completed through [Requantize-QwenCandidate.mjs](../scripts/Requantize-QwenCandidate.mjs). No downloads, source-adapter changes or game execution occurred.

## Actual conversion result

The [conversion receipt](../research/QWEN_REQUANTIZATION_RECEIPT.json) records **78,105.56 ms**, exit code **0**, and confirmed closure of owned process **25888**. The new local candidate is **1,107,408,544 bytes (1.03 GiB)**, SHA-256 **`54c0f1203a724e9f33e76916beab3bdfaffef56cf7b42a93b1bc21319fc0bf97`**, at `companion/local/models/Qwen3-1.7B-from-Q8_0-Q4_K_M.gguf`. The original Q8 hash was verified before and after conversion and is unchanged. No partial file remains.

Observed minimum disk free was **17,193,041,920 bytes (16.01 GiB)**; minimum available RAM was **4,040,585,216 bytes (3.76 GiB)**. Output stayed below its 1.5 GiB bound, and no guard triggered. The receipt contains supervisor/source/runtime hashes, exact arguments and a hashed process log. These are conversion resource observations, not game or inference acceptance. The remaining proposal/evaluation notes below still apply; no adapter pin was added and the candidate is not enabled.

## Feasibility and limits

The installed llama.cpp **b11065 / commit ce8caa6e6** supports `--allow-requantize`, `Q4_K_M`, `--leave-output-tensor`, `--max-buffer-size` and `--dry-run`. Its help cautions that converting already quantized tensors can lose substantially more quality than starting with F16/F32. The official [quantization guide](https://github.com/ggml-org/llama.cpp/blob/master/tools/quantize/README.md) documents the same re-quantization and output-tensor options. The browser could not retrieve the b11065 source pages; the exact installed binary's help is the version-specific evidence. The guide's other-model performance/size table does not predict this Qwen model's results.

Read-only dry run for the command below reported **310 tensors**, 113 F32 and 197 Q8_0 inputs; projected quantized tensor data **1050.43 MiB**, versus **1743.77 MiB** of input tensor data. GGUF metadata adds some space, so the rounded tensor total is not an exact output-file byte count. The standard mixed Q4_K_M policy selected Q6_K for token embeddings and selected tensors. No separate `output.weight` tensor appeared, so `--leave-output-tensor` does not establish a quality benefit for this particular tied-output model. Do not add `--pure`, pruning or importance-matrix training to this experiment.

This is a credible **local-derived candidate**, not an official publisher Q4 artifact. Its speed, instruction following, uncertainty handling and personality quality remain unmeasured. It cannot inherit the Q8 model's acceptance or substitute a relaxed four-second target.

## Bounded command proposal

From the project directory, first recheck the pinned input/runtime hashes and require a fresh unused output path. Then the proposed conversion command is:

```powershell
& '.\companion\local\runtimes\llama-cpu-b11065\llama-quantize.exe' `
  --allow-requantize --leave-output-tensor --max-buffer-size 256 `
  '.\companion\local\models\Qwen3-1.7B-Q8_0.gguf' `
  '.\companion\local\models\Qwen3-1.7B-from-Q8_0-Q4_K_M.gguf' Q4_K_M 2
```

The already-performed dry run used exactly those arguments plus `--dry-run`. Actual conversion would need an owned-process supervisor: retain the original Q8 file, refuse overwrite, cap new output/temporary allocation at **1.5 GiB plus 64 MiB overhead**, preserve **10 GiB free**, and stop if either bound is crossed. Observed free space after dry run was **18,339,971,072 bytes (17.08 GiB)**, enough for that proposed allocation at that moment. The 256 MiB row buffer is not a total process-RAM limit. Run the conversion after active inference/Whisper experiments stop; two threads limit contention but do not prove RAM safety or completion time.

## Provenance and next evaluation

Input: `Qwen3-1.7B-Q8_0.gguf`, **1,834,426,016 bytes**, SHA-256 `061b54daade076b5d3362dac252678d17da8c68f07560be70818cace6590cb1a`.

Verified quantizer files from the tracked [runtime pin manifest](../companion/llama-runtime-pins.json):

- `llama-quantize.exe`: SHA-256 `f8325d5631fb55443d969c544cfb8279c791701877f0f5413c8ce546fc2c3f5e`.
- `llama-quantize-impl.dll`: SHA-256 `9e42dadf8da73b455f2e4d6f244b68c49a2f8e4f10bbef8f52a0c0f2b61d6193`.

After a successful authorized conversion, record exact arguments, source/runtime hashes, exit code, output size/hash and captured diagnostics in a derived-artifact receipt. Add a distinct allowlisted candidate ID only after that receipt is reviewed; do not replace `qwen1_7b`'s existing pin. Compare the same three greetings and grounded unknown/order-history cases against Q8 using identical adapter prompts, threads and caps. Report warm complete-text times separately from first text and combined speech delivery. Reject degraded factual boundaries even if latency improves. Rollback is selecting the original pinned Q8; no current adapter setting has changed.
