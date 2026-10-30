"""MOCK_ONLY font measurement/PNG preview of exported Phase B fixture pages.

Uses installed Roboto plus DroidSansFallback at 24 pixels, greedy per-character
wrapping, and conservative 33-pixel line spacing. Does not import the model,
Unreal, native UI, or edit input fixtures/assets. This is not Slate/DPI proof.
"""
import argparse
from datetime import datetime, timezone
from functools import lru_cache
import hashlib
import json
from pathlib import Path
import re
import struct

from PIL import Image, ImageDraw, ImageFont, __version__ as PILLOW_VERSION

ROOT = Path(__file__).resolve().parents[1]
FONTS = Path("C:/Program Files/Epic Games/MechWarrior5Editor/Engine/Content/Slate/Fonts")
WIDTH, HEIGHT, PIXELS, VISIBLE_LINE_LIMIT = 1100, 600, 24, 16


def pin(path):
    data = Path(path).read_bytes()
    return {"path": str(Path(path).resolve()), "bytes": len(data),
            "sha256": hashlib.sha256(data).hexdigest()}


class FontCoverage:
    """Read-only minimal Unicode cmap lookup (TrueType formats 4 and 12)."""
    def __init__(self, path):
        self.data = Path(path).read_bytes()
        count = self.u16(4)
        self.tables = []
        cmap = None
        for index in range(count):
            start = 12 + index * 16
            if self.data[start:start + 4] == b"cmap":
                cmap = self.u32(start + 8)
                break
        if cmap is None:
            raise ValueError("Font cmap absent")
        for index in range(self.u16(cmap + 2)):
            start = cmap + 4 + index * 8
            platform, encoding = self.u16(start), self.u16(start + 2)
            offset = cmap + self.u32(start + 4)
            if platform == 0 or platform == 3 and encoding in (1, 10):
                form = self.u16(offset)
                if form in (4, 12):
                    self.tables.append((form, offset))
        if not self.tables:
            raise ValueError("No supported Unicode cmap")

    def u16(self, offset):
        return struct.unpack_from(">H", self.data, offset)[0]

    def u32(self, offset):
        return struct.unpack_from(">I", self.data, offset)[0]

    @lru_cache(maxsize=8192)
    def contains(self, code):
        for form, start in self.tables:
            if form == 12:
                low, high = 0, self.u32(start + 12)
                while low < high:
                    middle = (low + high) // 2
                    p = start + 16 + middle * 12
                    first, last, glyph = struct.unpack_from(">III", self.data, p)
                    if code < first:
                        high = middle
                    elif code > last:
                        low = middle + 1
                    else:
                        return glyph + code - first != 0
            elif code <= 0xFFFF:
                count = self.u16(start + 6) // 2
                end_at, begin_at = start + 14, start + 16 + count * 2
                delta_at, range_at = begin_at + count * 2, begin_at + count * 4
                for index in range(count):
                    end = self.u16(end_at + index * 2)
                    if code > end:
                        continue
                    begin = self.u16(begin_at + index * 2)
                    if code < begin:
                        break
                    delta = self.u16(delta_at + index * 2)
                    position = range_at + index * 2
                    relative = self.u16(position)
                    glyph = code if relative == 0 else self.u16(position + relative + 2 * (code - begin))
                    return glyph != 0 and (glyph + delta) % 65536 != 0
        return False


class Metrics:
    def __init__(self):
        self.paths = [FONTS / "Roboto-Regular.ttf", FONTS / "DroidSansFallback.ttf"]
        self.fonts = [ImageFont.truetype(str(path), PIXELS) for path in self.paths]
        self.coverage = [FontCoverage(path) for path in self.paths]
        self.ascent = max(font.getmetrics()[0] for font in self.fonts)
        self.descent = max(font.getmetrics()[1] for font in self.fonts)
        self.advance = self.ascent + self.descent

    @lru_cache(maxsize=8192)
    def font_for(self, char):
        for index, coverage in enumerate(self.coverage):
            if coverage.contains(ord(char)):
                return index
        return 1

    def runs(self, text):
        runs = []
        for char in text:
            index = self.font_for(char)
            if runs and runs[-1][0] == index:
                runs[-1] = (index, runs[-1][1] + char)
            else:
                runs.append((index, char))
        return runs

    @lru_cache(maxsize=32768)
    def width(self, text):
        return sum(self.fonts[index].getlength(run) for index, run in self.runs(text))

    def wrap(self, text):
        result = []
        for logical_index, line in enumerate(text.split("\n")):
            current = ""
            for char in line:
                if current and self.width(current + char) > WIDTH:
                    result.append((logical_index, current))
                    current = ""
                if self.width(char) > WIDTH:
                    raise ValueError("One glyph exceeds field width")
                current += char
            result.append((logical_index, current))
        return result

    def inspect(self, case_id, page):
        text = page["text"]
        wrapped = self.wrap(text)
        selected_fonts = {self.font_for(char) for char in text if char != "\n"}
        page_ascent = max((self.fonts[i].getmetrics()[0] for i in selected_fonts), default=0)
        page_descent = max((self.fonts[i].getmetrics()[1] for i in selected_fonts), default=0)
        natural_advance = page_ascent + page_descent
        missing = sorted({ord(char) for char in text if char != "\n" and not any(
            coverage.contains(ord(char)) for coverage in self.coverage)})
        boxes = []
        for line_index, (_, line) in enumerate(wrapped):
            x, baseline = 0, line_index * self.advance + self.ascent
            for font_index, run in self.runs(line):
                box = self.fonts[font_index].getbbox(run, anchor="ls")
                if box[2] > box[0] and box[3] > box[1]:
                    boxes.append([x + box[0], baseline + box[1], x + box[2], baseline + box[3]])
                x += self.fonts[font_index].getlength(run)
        ink = ([min(b[0] for b in boxes), min(b[1] for b in boxes),
                max(b[2] for b in boxes), max(b[3] for b in boxes)] if boxes else [0, 0, 0, 0])
        height = len(wrapped) * self.advance
        return {"case": case_id, "page": page["number"],
                "text_sha256": hashlib.sha256(text.encode("utf-8")).hexdigest(),
                "logical_lines": len(text.split("\n")), "wrapped_visible_lines": len(wrapped),
                "additional_auto_wrap_lines": len(wrapped) - len(text.split("\n")),
                "maximum_unwrapped_line_width_px": max(map(self.width, text.split("\n"))),
                "maximum_wrapped_line_width_px": max(self.width(line) for _, line in wrapped),
                "conservative_line_advance_px": self.advance,
                "conservative_required_height_px": height,
                "conservative_bottom_margin_px": HEIGHT - height,
                "page_font_metric_line_advance_px": natural_advance,
                "page_font_metric_required_height_px": natural_advance * len(wrapped),
                "page_font_metric_bottom_margin_px": HEIGHT - natural_advance * len(wrapped),
                "conservative_ink_bbox_px": ink,
                "ink_bottom_margin_px": HEIGHT - ink[3],
                "horizontal_ink_margin_px": WIDTH - ink[2],
                "exceeds_16_visible_lines": len(wrapped) > VISIBLE_LINE_LIMIT,
                "clips_at_600_height": ink[3] > HEIGHT or ink[0] < 0 or ink[2] > WIDTH,
                "missing_codepoints_in_both_fonts": ["U+{:04X}".format(cp) for cp in missing],
                "wrapped_lines": [{"source_logical_line": logical + 1, "text": line,
                                   "width_px": self.width(line)} for logical, line in wrapped]}

    def render(self, text, result, destination, full):
        wrapped = self.wrap(text)
        content_height = max(HEIGHT, len(wrapped) * self.advance)
        shown_height = content_height if full else HEIGHT
        canvas = Image.new("RGB", (WIDTH + 80, shown_height + 170), "#e9edf1")
        d = ImageDraw.Draw(canvas)
        title = ImageFont.truetype(str(self.paths[0]), 22)
        small = ImageFont.truetype(str(self.paths[0]), 18)
        d.text((40, 16), "MOCK ONLY | {} | PAGE {} | {}".format(result["case"], result["page"],
               "unclipped measurement" if full else "candidate 1100 x 600 crop"), fill="#17212d", font=title)
        d.text((40, 48), "24 px font; Roboto + DroidSansFallback; 33 px line spacing; native fit NOT PERFORMED",
               fill="#394c63", font=small)
        layer = Image.new("RGB", (WIDTH, content_height), "#142536")
        ld = ImageDraw.Draw(layer)
        for index, (_, line) in enumerate(wrapped):
            x, baseline = 0, index * self.advance + self.ascent
            for font_index, run in self.runs(line):
                ld.text((x, baseline), run, fill="#f4f6fa", font=self.fonts[font_index], anchor="ls")
                x += self.fonts[font_index].getlength(run)
        canvas.paste(layer.crop((0, 0, WIDTH, shown_height)), (40, 82))
        d.rectangle((39, 81, 40 + WIDTH, 82 + HEIGHT), outline="#d33245", width=2)
        if full and content_height > HEIGHT:
            d.line((40, 82 + HEIGHT, 40 + WIDTH, 82 + HEIGHT), fill="#ff6b78", width=3)
        d.text((40, shown_height + 100), "{} logical / {} wrapped lines; required height {} px; bottom margin {:+d} px".format(
            result["logical_lines"], result["wrapped_visible_lines"], result["conservative_required_height_px"],
            result["conservative_bottom_margin_px"]), fill="#8b1528" if result["clips_at_600_height"] else "#163c28", font=small)
        d.text((40, shown_height + 126), "Red border is proposed field. Greedy character-wrap simulation; no Slate, DPI or runtime acceptance.",
               fill="#394c63", font=small)
        canvas.save(destination)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--fixtures", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    source, output = Path(args.fixtures).resolve(), Path(args.output).resolve()
    if not source.is_relative_to(ROOT) or not output.is_relative_to(ROOT / "research/evidence"):
        raise ValueError("Project fixture/evidence paths required")
    if output.exists() or source.stat().st_size > 2 * 1024 * 1024:
        raise ValueError("Fresh output and bounded fixture required")
    for p in [output, *output.parents]:
        if p.exists() and (p.is_symlink() or getattr(p.lstat(), "st_file_attributes", 0) & 0x400):
            raise ValueError("Output reparse path rejected")
        if p == ROOT:
            break
    fixture_pin = pin(source)
    fixture = json.loads(source.read_text(encoding="utf-8"))
    if fixture.get("classification") != "MOCK_ONLY" or not 1 <= len(fixture["cases"]) <= 64:
        raise ValueError("Expected bounded MOCK_ONLY fixture export")
    metrics, measured, pages_by_key = Metrics(), [], {}
    for case in fixture["cases"]:
        if not re.fullmatch(r"[A-Za-z0-9_-]{1,80}", case["id"]) or not 1 <= len(case["pages"]) <= 35:
            raise ValueError("Invalid fixture case")
        for page in case["pages"]:
            if not isinstance(page["text"], str) or len(page["text"]) > 4096:
                raise ValueError("Page outside fixture bound")
            if not isinstance(page["number"], int) or not 1 <= page["number"] <= 35:
                raise ValueError("Invalid page number")
            key = (case["id"], page["number"])
            if key in pages_by_key:
                raise ValueError("Duplicate fixture page")
            pages_by_key[key] = page["text"]
            measured.append(metrics.inspect(case["id"], page))
    if pin(source) != fixture_pin:
        raise ValueError("Fixture changed while measuring")
    output.mkdir(parents=True)
    selected = []
    # Preserve representative worst page in W/CJK/supplementary cases plus a short control.
    for needle in ("_w", "cjk", "supplement", "exact"):
        candidates = [row for row in measured if (row["case"].lower().endswith(needle)
                      if needle == "_w" else needle in row["case"].lower())]
        if candidates:
            row = max(candidates, key=lambda r: (r["wrapped_visible_lines"], r["maximum_unwrapped_line_width_px"]))
            if row not in selected:
                selected.append(row)
    if not selected:
        selected = [max(measured, key=lambda r: r["conservative_required_height_px"])]
    images = []
    for row in selected[:4]:
        for full in (False, True):
            name = "{}-page{:02d}-{}.png".format(row["case"], row["page"], "full" if full else "field")
            metrics.render(pages_by_key[(row["case"], row["page"])], row, output / name, full)
            images.append(pin(output / name))
    report = {"classification": "MOCK_ONLY_FONT_MEASUREMENT_AND_LAYOUT_PREVIEW",
              "native_fit": "NOT_PERFORMED", "created_utc": datetime.now(timezone.utc).isoformat(),
              "fixture": fixture_pin, "fixture_model": fixture.get("model"),
              "script": pin(__file__), "fonts": [pin(p) for p in metrics.paths],
              "pillow_version": PILLOW_VERSION, "field": {"width_px": WIDTH, "height_px": HEIGHT},
              "font_pixels": PIXELS, "proposed_font_points": 18,
              "point_conversion": "Conservative 96-DPI assumption:18*96/72=24px; native DPI not observed",
              "method": "Primary Unicode cmap coverage, fallback cmap, Pillow BASIC layout; greedy per-character wrap; no extra padding",
              "line_advance_px": metrics.advance, "line_advance_basis": "max font ascents + max font descents =26+7=33px",
              "probe_widths": {"W64_Roboto_px": metrics.fonts[0].getlength("W" * 64),
                               "CJK64_Droid_px": metrics.fonts[1].getlength("界" * 64)},
              "summary": {"pages_measured": len(measured),
                          "pages_clipped": sum(row["clips_at_600_height"] for row in measured),
                          "pages_exceeding_16_visible_lines": sum(row["exceeds_16_visible_lines"] for row in measured),
                          "pages_with_missing_glyphs": sum(bool(row["missing_codepoints_in_both_fonts"]) for row in measured)},
              "pages": measured, "previews": images,
              "limitations": ["No Unreal/Slate renderer, viewport DPI, kerning parity, native fallback chain or clipping behavior observed",
                              "Greedy character wrapping differs from native word-break rules; native per-character wrapping must be verified",
                              "Conservative33px spacing may exceed natural29px Roboto spacing; both height estimates are recorded",
                              "Missing glyphs remain unrenderable with these two fonts and are explicitly identified",
                              "This script does not change model, contract, source assets or input fixture text"]}
    (output / "measurements.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"classification": report["classification"], "output": str(output), **report["summary"]}))


if __name__ == "__main__":
    main()
