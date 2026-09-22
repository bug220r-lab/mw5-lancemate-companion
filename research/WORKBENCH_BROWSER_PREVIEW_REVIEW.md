# Visible command preview: independent source review

Date: 2026-09-22. Scope: the supervising task's new visible command-parser result in `companion/public/app.js` and `index.html`, plus `WORKBENCH_BROWSER_VALIDATION_2026-09-22.json`. **SOURCE REVIEW; no browser, native model, audio, editor or game launched by this reviewer.**

## Finding and verified correction

The initial diff sets `parsedTranscript` to the new input before its command request resolves, then each general `render(data)` displays `data.last` when the current field matches that string. This does not tie the displayed interpretation to the response for that particular input.

A possible sequence is: parse A; edit to B (which clears the preview); submit B; receive an overlapping state-poll response still containing A's previous parser result. The field matches `parsedTranscript` B, so `render` can show A's interpretation beside B. The existing HTTP request sequence guard compares client request order, not the provenance of `data.last`; a later poll can be the accepted render. No command execution occurs, but the visible interpretation can be stale.

The finding was sent to the supervising task and corrected. The final client stores `parsedCommand` separately and advances `commandEpoch` on submit, edit, copied text and every non-command action. Only the corresponding command response can fill that result after checking both epoch and exact current input. General state rendering preserves only this admitted preview and never derives it from global `data.last`. This is a display-lifecycle correction, not a new dispatch feature.

The reviewer added one asynchronous regression to the existing `companion/tests/browser-playback.test.mjs`. It resolves command A, holds command B, delivers a newer state poll still containing A, and checks A cannot appear as B's interpretation. B's own response can then display its result. The same case verifies that a later edit or synthetic reset invalidates delayed command responses. It starts no real browser, server, model, audio or game. The full existing file passed **36/36 PASS_MOCK_ONLY**, including the new case, on the final client source.

## Other reviewed properties

- Successful results say **Preview only** and **Nothing was sent**. Clarification failures also retain the no-send statement. The visible panel adds no command-dispatch call; existing server `command` handling only calls `parseSpokenCommand` and labels the result `MOCK_ONLY`, `TYPED_TRANSCRIPT_FIXTURE`, `dispatchable: false`.
- The new output is assigned through `textContent`; recipient and location strings are not inserted as HTML. Existing `node` rendering also uses `textContent`. No new HTML injection sink was found in the reviewed diff.
- Ordinary field edits and copying recognition text explicitly clear the preview. Reset/disarm and all other non-command actions now clear it immediately and advance its epoch, independently of the later server `last` result.
- The status element has `role=status` and polite live announcements. This is appropriate source markup, not a complete accessibility evaluation.
- Existing VM test fixtures dynamically create queried elements and provide `textContent`, `value` and `addEventListener`. The 36-case browser-lifecycle VM run confirms compatibility with the changed app in this fixture; it does not replace the parent's full-project run or real browser acceptance.

## Browser receipt boundary

The supervising task's receipt reports bounded native-browser observations, including parsing, edit clearing, clarification, reset, human hold and disarm, and an owned temporary-server cleanup. Those observations are not repeated independently here. The receipt correctly separates browser UI results on synthetic game state from game integration, recognition, model inference, speaker playback and release acceptance. A successful ordinary edit sequence does not rule out the asynchronous provenance race identified by source review.

## Final disposition

**PASS_SOURCE_AND_MOCK_ONLY for the corrected diff.** No new tests of static text mappings were added; the new regression covers the independently identified asynchronous result-attribution defect. The original browser receipt retains its earlier observed app hash and is not relabeled as a browser run of the correction. A separately recorded browser recheck belongs to the supervising task.

| Reviewed artifact | SHA-256 |
|---|---|
| Corrected `companion/public/app.js` | `4a318c674c15fe0ec6a305c1ca1fe77154b8d73e00c2b357163f1aa2a97df214` |
| `companion/public/index.html` | `025d4b0fe81e43ff41c99f8a9c47457a6f867b30c3558cccb7dd503ff0f87803` |
| `companion/tests/browser-playback.test.mjs` | `3011940d9e3eadd2190b763f79e313a19497a9239d9b8cf8d7ba6b074561a07f` |
| Original `research/WORKBENCH_BROWSER_VALIDATION_2026-09-22.json` | `bf65e945b06d44918868532e815715fe6bad1f59a9cf66cd97803e2edccfdb15` |

The original receipt recorded app hash `b89065d9d3ed550dcca116cab5c462d05926af33e5307c3e603ac3e5b8dbf5ba`; its other source identities and explicitly bounded observations remain historical evidence. The reviewer did not inspect actual screenshots or repeat those browser observations.
