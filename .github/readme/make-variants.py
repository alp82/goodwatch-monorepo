# PROTOTYPE: builds README.md (variant A), README-B.md, and README-C.md from the README on main.
# Run from the repo root: python3 .github/readme/make-variants.py
import os
import re
import subprocess

base = subprocess.run(["git", "show", "origin/main:README.md"], capture_output=True, text=True, check=True).stdout
CLIPS = ".github/readme/clips"
FEATURE_CLIP = {
    "Score": "score", "Streaming": "streaming", "For you": "for-you", "Your taste": "taste", "Search": "search",
    "Discover": "discover", "Explorer": "explorer", "Episodes": "episodes", "Tracking": "tracking",
    "Imports": "imports", "AI apps": "ai", "Discord": "discord",
}


def clip(name):
    for ext in ("avif", "webp"):
        if os.path.exists(f"{CLIPS}/{name}.{ext}"):
            return f"{CLIPS}/{name}.{ext}"
    return None


def banner(v, alt):
    return (
        '<a href="https://goodwatch.app"><picture>'
        '<source media="(prefers-reduced-motion: reduce)" srcset=".github/readme/banner.webp">'
        f'<img src=".github/readme/banner-{v}.avif" alt="{alt}" width="100%">'
        "</picture></a>"
    )


def switcher(current):
    links = {"A": "README.md", "B": "README-B.md", "C": "README-C.md"}
    names = {"A": "spotlight banner + reel", "B": "stage light + clips in the grid", "C": "sign-up card + feature rows"}
    parts = [f"**{k}: {names[k]}**" if k == current else f"[{k}: {names[k]}]({links[k]})" for k in links]
    return "> [!NOTE]\n> README animation prototype. Variants: " + " · ".join(parts) + "\n\n"


banner_re = re.compile(r'<a href="https://goodwatch.app"><img src="\.github/readme/banner\.webp"[^>]*></a>')
grid_re = re.compile(r"<table>\n<tr>.*?</table>", re.S)
cell_re = re.compile(r'<td[^>]*>\s*(<img src="[^"]*" alt="([^"]+)">)<br>\s*\*\*(.+?)\*\*<br>\s*(.+?)\s*</td>', re.S)
features = [
    {"badge": m.group(1), "key": m.group(2), "title": m.group(3), "text": m.group(4).strip()}
    for m in cell_re.finditer(grid_re.search(base).group(0))
]
assert len(features) == 12, len(features)


def clip_img(f, width="100%"):
    path = clip(FEATURE_CLIP[f["key"]])
    return f'<img src="{path}" alt="{f["title"]}: a scene from the GoodWatch intro" width="{width}">' if path else ""


# Round 2: banner A (calmer), features as sections instead of a table. Each clip rests on a still and moves once
# per 16 s cycle; neighbors take turns (clips/record.mjs PULSE). The highlight reel is gone: too busy.
WIDTH = {"score": "62%", "explorer": "60%", "ai": "72%"}  # clips with a lot of empty space get less room
GAP = "\n<br>\n\n"


def head(f, align="center"):
    return f'<p align="{align}">{f["badge"]}</p>\n<h3 align="{align}">{f["title"]}</h3>\n<p align="{align}">{f["text"]}</p>'


def stacked(f):
    pic = clip_img(f, WIDTH.get(FEATURE_CLIP[f["key"]], "86%"))
    return head(f) + (f'\n<p align="center">{pic}</p>' if pic else "")


def sided(f, i):
    pic = clip_img(f, "52%")
    if not pic:
        return head(f)
    side = "right" if i % 2 else "left"
    pic = pic.replace("<img ", f'<img align="{side}" hspace="18" ', 1)
    return f'{pic}\n\n<br>\n\n{f["badge"]}\n<h3>{f["title"]}</h3>\n{f["text"]}\n<br clear="{side}">'


banner_a = banner("roam", "GoodWatch: find what to watch next. A soft spotlight moves across a slowly drifting wall of posters.")
a = banner_re.sub(banner_a, base)
a = grid_re.sub(lambda _: GAP.join(stacked(f) for f in features), a)
b = banner_re.sub(banner_a, base)
b = grid_re.sub(lambda _: GAP.join(sided(f, i) for i, f in enumerate(features)), b)


def switcher(current):
    links = {"A": "README.md", "B": "README-B.md"}
    names = {"A": "stacked sections", "B": "alternating sides"}
    parts = [f"**{k}: {names[k]}**" if k == current else f"[{k}: {names[k]}]({links[k]})" for k in links]
    return "> [!NOTE]\n> README animation prototype, round 2. Layouts: " + " · ".join(parts) + "\n\n"


for name, text, key in (("README.md", a, "A"), ("README-B.md", b, "B")):
    open(name, "w").write(switcher(key) + text)
    print("wrote", name)
