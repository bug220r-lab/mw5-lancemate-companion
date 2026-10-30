# Phase B revised offline layout review — September 27, 2026

**MOCK_ONLY_GEOMETRIC_FIT_PASSED_WITH_GLYPH_LIMITATION. Native widget fit: NOT_PERFORMED.** The coordinator-selected40-unit path segments and separate component object/class pages remove the measured overflow in the earlier64-unit/combined-page layout. All111 exact revised fixture pages fit the simulated1100×600 field and remain at or below13 visible lines. Four supplementary-character pages still render U+1F680 ROCKET as missing-glyph boxes with the two inspected installed fonts. This is not full character-readability acceptance.

The [initial failed layout review](OBSERVER_PHASE_B_LAYOUT_REVIEW_2026-09-27.md), original fixtures, measurements and PNGs were left unchanged. No model, contract, source asset, editor, game, package or installed file was changed by this measurement work. The separate authoring-route document was reconciled to the coordinator's current source contract.

## Measured inputs and method

The input is the exact15-case/111-page [revised fixture export](evidence/phase-b-model-layout-correction-20260927T060800Z/layout-fixtures.json). Text was consumed literally from the export, without importing or invoking the model. The unchanged [offline preview helper](../scripts/Preview-ObserverPhaseBLayout.py) used the installed Roboto-Regular.ttf and DroidSansFallback.ttf at24px, a conservative18pt×96/72 assumption, with1100px width and600px height. Font cmap coverage chooses Roboto then Droid; unsupported code points are reported. Pillow BASIC layout measures and renders each font run, greedy character wrapping preserves explicit newlines, and a conservative33px line advance combines maximum ascent26 plus maximum descent7. No extra padding is included.

The [full measurement record](evidence/phase-b-layout-revised-preview-20260927T062500Z/measurements.json) includes every page's exact text hash, logical/wrapped lines, width, height, ink bounds, missing glyphs and preview pins. The default preview selector did not select the revised all-W case name; [additional preview index](evidence/phase-b-layout-revised-preview-20260927T062500Z/additional-previews/index.json) therefore separately pins three exact measured pages rendered through the same unchanged helper. Each added page was remeasured and matched its original record before rendering. The original measurement JSON and its six PNGs were not rewritten.

The output directory suffix `20260927T062500Z` is a chosen evidence label, not the run timestamp. The measurement record's actual `created_utc` is `2026-09-27T06:12:28.970757+00:00`; that original receipt is preserved as written. Later visual inspection and the separately indexed additional renders do not change its recorded time.

## Results

| Fixture / measured scope | Wrapped lines | Width / horizontal spare | Required height / vertical spare |
|---|---:|---:|---:|
| All111 pages | maximum13 | maximum960px / minimum140px | maximum429px / minimum171px |
| 256-unit all-W component object/class pages5–6 |12 |840px /260px |396px /204px |
| 256-unit all-CJK component object/class pages5–6 |12 |960px /140px |396px /204px |
| 256-unit all-W controller object page2 |11 |840px /260px |363px /237px |
| 256-unit all-CJK controller object page2 |11 |960px /140px |363px /237px |
| Widest count and33-entry/subset summary page1 |13 | below960px |429px /171px |
| Ordinary exact-match summary page1 |11 |547px /553px |363px /237px |

Across the exact111 pages: zero clipping under the measured ink bounds, zero pages above16 wrapped visible lines, and zero added auto-wrap lines. The most vertically demanding summaries have their last measured ink pixel at427px, leaving173px of ink clearance within the600px field. These are measurements of this exported fixture set, not an exhaustive proof for every possible Unicode glyph or native viewport.

The actual PNGs were opened and visually inspected:

- [All-W component page](evidence/phase-b-layout-revised-preview-20260927T062500Z/additional-previews/max_w256_both_component_paths-page05-field.png): all seven path segments and footer remain within the field with clear spare space.
- [All-CJK component page](evidence/phase-b-layout-revised-preview-20260927T062500Z/max_cjk256_both_component_paths-page05-field.png): all seven path segments and footer fit; the measured140px horizontal margin is visible.
- [Widest-count summary](evidence/phase-b-layout-revised-preview-20260927T062500Z/additional-previews/widest_count-page01-field.png):13 lines, including the split reason text and final navigation line, fit.
- [Supplementary-character component page](evidence/phase-b-layout-revised-preview-20260927T062500Z/max_supplementary256_units_both_paths-page05-field.png): geometry fits but rocket characters appear as boxes. The same missing code point is recorded on pages5–6 of both `max_supplementary256_units_both_paths` and `supplementary_crosses_segment_boundary`.

`STATUS: COMPLETE` printed by a fixture means the reference model retained the complete captured array under its algorithm. It does not mean all glyphs rendered, the native widget fit, or any retail component collection occurred.

## Pins and limits

| Artifact | Bytes | SHA-256 |
|---|---:|---|
| Revised fixture export |62915 |`0959fb2411cc1935166d80cb413b19089975b4dd9e839f9138211b8cc1a9d49a` |
| Fixture model recorded by export |17360 |`59ccb84ba76070b2759553535e6eda51e8e03421b9fddfd5affa1bc44c8ecf90` |
| Unchanged preview helper |15650 |`743f8bd1d709cee87e7b3d2a2b98889c746f509400c086b0ec904822c0b5e25f` |
| Revised measurements |239587 |`37bb02772f0865638f32bc9ed57a439433722513d059a2af0e9ff24d005f195a` |
| Additional preview index |2043 |`7541d1cdacb0c0fe6e87978ef98a56bb0b854248d92520be3b4f20d757ad6f0d` |
| Installed Roboto-Regular.ttf |158604 |`16466ef65064e6f3885a6d2806b8949ac1ac38b524dd0cf8fc96565eb4cc28e8` |
| Installed DroidSansFallback.ttf |3939852 |`05d71b179ef97b82cf1bb91cef290c600a510f77f39b4964359e3ef88378c79d` |

Both fonts were read from `C:/Program Files/Epic Games/MechWarrior5Editor/Engine/Content/Slate/Fonts/`. Their actual font metrics and cmap coverage were inspected offline; no font was installed or altered.

Slate shaping/kerning, fallback selection, native word-break rules, UMG point-to-pixel conversion, viewport DPI, widget padding and live contrast remain unobserved. Pillow's geometry is not a substitute for these engine behaviors. The new native widget must still demonstrate readable, unclipped capture of every admitted page, particularly Unicode boundary cases. If the actual fallback lacks a required glyph, that display cannot be called complete merely because its stored string and geometry pass. The missing-rocket result is preserved as an explicit remaining native-readability limitation, not silently replaced with ASCII or removed from fixtures.
