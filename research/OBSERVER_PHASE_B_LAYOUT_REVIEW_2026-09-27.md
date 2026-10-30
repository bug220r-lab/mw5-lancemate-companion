# Phase B offline layout stress review — 2026-09-27

**MOCK_ONLY_LAYOUT_BLOCKERS_FOUND. Native widget fit: NOT_PERFORMED.** The proposed 1100×600 field at conservative 24-pixel rendering does not fit two maximum-path fixture pages. Both expand from 14 logical lines to 22 visible wrapped lines, exceeding the proposed 16-visible-line limit. Two supplementary-character fixture pages also contain a glyph missing from both specified installed fonts. No model, contract, source asset, UI or native state was changed by this review.

## Inputs and measurement

The [fixture export](evidence/phase-b-model-20260927T054500Z/layout-fixtures.json) contains 13 cases and 69 exact model pages, all MOCK_ONLY. It is 41,238 bytes, SHA256 `8df73c4a0c17332b88a2d01b4500124ecd5241f91d0a68e0cff96779ba3920ec`, pinned to model SHA256 `2a0ced12abbc7f3e7d6b75ded16c42a74618952a774f7eb9d0eb389edb67b510`. Its page strings were measured unchanged, with original newlines retained.

The new read-only renderer [Preview-ObserverPhaseBLayout.py](../scripts/Preview-ObserverPhaseBLayout.py) uses the installed fonts from `C:/Program Files/Epic Games/MechWarrior5Editor/Engine/Content/Slate/Fonts/`:

| Font | Size | SHA256 | Measured metrics at 24 pixels |
|---|---:|---|---|
| `Roboto-Regular.ttf` | 158,604 bytes | `16466ef65064e6f3885a6d2806b8949ac1ac38b524dd0cf8fc96565eb4cc28e8` | Ascent 23 + descent 6 = 29 pixels |
| `DroidSansFallback.ttf` | 3,939,852 bytes | `05d71b179ef97b82cf1bb91cef290c600a510f77f39b4964359e3ef88378c79d` | Ascent 26 + descent 7 = 33 pixels |

The proposed 18-point font was evaluated at **24 pixels** using the conservative 96-DPI conversion 18×96/72. This is an explicit preview assumption, not the observed game DPI. Unicode cmap coverage selects Roboto first and DroidSansFallback when needed. Pillow BASIC text measurement supplies glyph advances/bounds; greedy per-character wrapping uses the full 1100-pixel width with no added padding. The previews use 33-pixel line spacing, the maximum ascent/descent across the two fonts. Measurements also report the smaller 29-pixel spacing when a page uses only Roboto.

This is not Slate rendering. Native DPI scaling, shaping/kerning parity, word-break behavior, fallback font chain, layout padding and clipping rules remain unobserved. The preview uses per-character wrapping as proposed; that actual widget property still requires verification. Model `STATUS: COMPLETE` describes the captured array in its synthetic case, not readable/complete display acceptance.

## Exact results

| Fixture page | Logical → wrapped lines | Longest unwrapped line | Required height at 33-pixel spacing | Margin in 600-pixel field | Wrapped horizontal margin |
|---|---:|---:|---:|---:|---:|
| `component_paths_256_W`, page 4 | 14 → **22** | **1344 px** for 64 W glyphs | **726 px** | **−126 px** | 8 px (1092-pixel widest line) |
| `component_paths_256_CJK`, page 4 | 14 → **22** | **1536 px** for 64 界 glyphs | **726 px** | **−126 px** | 20 px (1080-pixel widest line) |
| `component_paths_256_UTF16_supplementary`, page 4 | 14 → 14 | 768 px | 462 px | +138 px | 332 px; **glyphs missing** |
| `one_exact_match`, page 1 summary | 11 → 11 | Fits within field | 363 px | +237 px | No horizontal clipping |
| `one_exact_match`, page 4 component | 9 → 9 | 819 px | 297 px | +303 px | 281 px |

The all-W page still needs **638 pixels at Roboto's natural 29-pixel line spacing**, so it exceeds the field by **38 pixels** even without the conservative fallback spacing. Both stress pages' measured ink reaches **y=724**, 124 pixels beyond the field. Their last path segments and footer are visibly outside the proposed field. They also violate the 16-visible-line bound independently of height.

Across all 69 pages: **2 pages clip**, **2 exceed 16 visible lines**, and **2 contain missing glyphs**. All remaining pages have at most 14 wrapped lines and at most 462 pixels of conservative line height, leaving at least 138 pixels bottom space under these assumptions. That geometric margin does not cure missing glyphs.

The supplementary fixtures use **U+1F680 (ROCKET)**, absent from both fonts' Unicode cmaps. Their previews visibly render missing-glyph boxes. Another native fallback font could behave differently, but this review supplies no evidence that it does. A fitting rectangle containing replacement boxes does not preserve readable exact paths.

## Visual verification and artifacts

Generated eight PNGs: cropped-field and full-height previews for the W stress page, CJK stress page, supplementary stress page, and ordinary exact-match summary. The red border represents the candidate field; full-height versions preserve the overflow beneath it. The following actual images were opened and visually inspected:

- [W page, candidate field crop](evidence/phase-b-layout-preview-20260927T060500Z/component_paths_256_W-page04-field.png): trailing class segments/footer clipped.
- [CJK page, full overflow shown](evidence/phase-b-layout-preview-20260927T060500Z/component_paths_256_CJK-page04-full.png): complete overflow visible below the red 600-pixel boundary.
- [Supplementary page](evidence/phase-b-layout-preview-20260927T060500Z/component_paths_256_UTF16_supplementary-page04-field.png): fits geometrically but shows missing-glyph boxes.
- [Ordinary summary](evidence/phase-b-layout-preview-20260927T060500Z/one_exact_match-page01-field.png): all lines and footer readable with substantial bottom margin.

[measurements.json](evidence/phase-b-layout-preview-20260927T060500Z/measurements.json) retains every page's exact text hash, logical/wrapped lines, per-line text/width, ink bounds, both height estimates, missing codepoints, input/font/script pins and all PNG hashes. It is **164,568 bytes**, SHA256 `09d60e90eae389d8537c624498b06db9390d33a895ea00b7f8bee7a8d989aefb`. Renderer source is **15,650 bytes**, SHA256 `743f8bd1d709cee87e7b3d2a2b98889c746f509400c086b0ec904822c0b5e25f`. No shader compilation or native widget preview was used as evidence.

## Decision for the coordinator

Do not freeze the present page/layout combination as satisfying the full maximum-path contract. The next revision needs an explicit layout/admission decision, followed by fresh model fixtures and native verification. A possible approach is separate stored object-path and class-path pages, keeping original strings for comparison and recalculating headers, page counts and aggregate text budgets. Reducing segment length alone can increase logical line count, so it is not automatically sufficient. Font size reduction, different field dimensions or stricter admitted path bounds are alternatives requiring their own readability/viewport tradeoff review.

Missing-glyph handling is a separate issue: verify the actual native fallback supports the admitted characters, or design a clearly marked, lossless escaped presentation with revised budgets. Do not silently replace characters, shorten paths or claim a complete readout from replacement boxes. These are proposed options only; this subtask did not change the source contract or model.
