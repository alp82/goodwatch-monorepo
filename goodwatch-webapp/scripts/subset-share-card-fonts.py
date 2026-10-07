#!/usr/bin/env python3
"""Builds the browser files of the share card fonts: WOFF2 slices of the TTF files in public/fonts/share-card.

The image renderer keeps reading the TTF files. A browser gets each font in up to three slices and downloads a
slice only when a card shows a character of it:

- latin and latin-ext: the character ranges Google Fonts uses for its slices of the same names.
- rest: every other character the TTF file has (Vietnamese, Cyrillic, arrows, symbols), so that a card on a
  page shows the same glyphs as its image.

Gabarito gets only a rest slice, with the characters that the brand font's files lack: every page already
loads those files (app/fonts/gabarito.css), and they have the same glyphs and widths as the TTF files.

Run it after a TTF file or a brand font file changes, and commit the output:

    python3 -m venv /tmp/fonttools && /tmp/fonttools/bin/pip install fonttools==4.66.1 brotli==1.2.0
    /tmp/fonttools/bin/python scripts/subset-share-card-fonts.py

It writes <name>.<slice>.woff2 next to each TTF file and app/ui/share-card/font-slices.ts, which holds the
character ranges that app/ui/share-card/font-faces.ts turns into @font-face rules.
"""
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parent.parent
FONT_DIR = ROOT / "public/fonts/share-card"
SLICES_FILE = ROOT / "app/ui/share-card/font-slices.ts"

# The unicode-range values of Google Fonts' "latin" and "latin-ext" slices.
LATIN = (
    "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, "
    "U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD"
)
LATIN_EXT = (
    "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, "
    "U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF"
)
# Fonts whose Latin characters come from files that every page loads anyway: their rest slice holds what
# those files lack.
BRAND_FILES = {"Gabarito-": ["app/fonts/gabarito-latin.woff2", "app/fonts/gabarito-latin-ext.woff2"]}


def parse(ranges: str) -> set[int]:
    points: set[int] = set()
    for part in ranges.replace("U+", "").split(","):
        first, _, last = part.strip().partition("-")
        points.update(range(int(first, 16), int(last or first, 16) + 1))
    return points


# A rest slice's ranges may bridge this many characters that no slice has, which keeps the rules short.
MAX_GAP = 96


def to_ranges(points: set[int], taken: set[int]) -> str:
    """A unicode-range value for a rest slice.

    A range can name characters the slice lacks, when no other slice has them either: a card with such a
    character loads the slice in vain and then shows the character in a local font. A range never names a
    character of `taken`, the latin and latin-ext ranges: the rest rule could win over the slice that has it.
    """
    parts: list[str] = []
    ordered = sorted(points)
    start = previous = ordered[0]
    for point in [*ordered[1:], None]:
        if point is not None and point - previous <= MAX_GAP and not taken.intersection(range(previous + 1, point)):
            previous = point
            continue
        parts.append(f"U+{start:04X}" if start == previous else f"U+{start:04X}-{previous:04X}")
        if point is not None:
            start = previous = point
    return ",".join(parts)


def write_slice(ttf: Path, name: str, points: set[int]) -> int:
    options = subset.Options()
    options.flavor = "woff2"
    # Kerning and ligatures as in the TTF file. No hinting: cards are drawn scaled, where hints don't apply.
    options.layout_features = ["*"]
    options.hinting = False
    options.desubroutinize = True
    options.notdef_outline = True
    font = subset.load_font(str(ttf), options)
    subsetter = subset.Subsetter(options)
    subsetter.populate(unicodes=sorted(points))
    subsetter.subset(font)
    out = ttf.with_suffix(f".{name}.woff2")
    subset.save_font(font, str(out), options)
    return out.stat().st_size


def main() -> None:
    latin, latin_ext = parse(LATIN), parse(LATIN_EXT)
    lines: list[str] = []
    for stale in FONT_DIR.glob("*.woff2"):
        stale.unlink()
    for ttf in sorted(FONT_DIR.glob("*.ttf")):
        has = set(TTFont(ttf).getBestCmap())
        brand = next((files for prefix, files in BRAND_FILES.items() if ttf.name.startswith(prefix)), None)
        if brand:
            loaded = set().union(*(TTFont(ROOT / file).getBestCmap() for file in brand))
            wanted = {"rest": has - loaded}
        else:
            # A character of both Google ranges goes to latin, whose rule comes last and wins.
            wanted = {
                "rest": has - latin - latin_ext,
                "latin-ext": (has & latin_ext) - latin,
                "latin": has & latin,
            }
        entries: list[str] = []
        for name, points in wanted.items():
            if not points:
                continue
            size = write_slice(ttf, name, points)
            # latin and latin-ext keep Google's values, so the rules read like the brand font's.
            ranges = {"latin": "LATIN", "latin-ext": "LATIN_EXT"}.get(name) or f'"{to_ranges(points, latin | latin_ext)}"'
            entries.append(f'"{name}": {ranges}')
            print(f"{ttf.name:36} {name:10} {len(points):4} characters {size:6} bytes")
        lines.append(f'\t"{ttf.name}": {{ {", ".join(entries)} }},')
    SLICES_FILE.write_text(
        "// Written by scripts/subset-share-card-fonts.py: don't edit. Per TTF file of a card font, the WOFF2 slices a\n"
        "// browser can load (public/fonts/share-card/<name>.<slice>.woff2) and the characters each one holds, in the\n"
        "// order their @font-face rules go: where two slices name a character, the later rule wins.\n"
        'export type FontSlice = "rest" | "latin-ext" | "latin"\n\n'
        f'const LATIN = "{LATIN.replace(" ", "")}"\n'
        f'const LATIN_EXT = "{LATIN_EXT.replace(" ", "")}"\n\n'
        "export const FONT_SLICES: Record<string, Partial<Record<FontSlice, string>>> = {\n" + "\n".join(lines) + "\n}\n"
    )


if __name__ == "__main__":
    main()
