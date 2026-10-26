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
    return f'<img src="{path}" alt="{f["title"]}: animated clip from the GoodWatch intro" width="{width}">' if path else ""


# A: roaming spotlight banner, one highlight reel under "Why GoodWatch", grid unchanged
a = banner_re.sub(banner("roam", "GoodWatch: find what to watch next. A spotlight moves across a slowly drifting wall of posters."), base)
reel = clip("reel")
if reel:
    a = a.replace(
        "\n<table>\n<tr>",
        f'\n<p align="center"><a href="https://goodwatch.app/how-it-works"><img src="{reel}" alt="A short reel from the GoodWatch intro film" width="100%"></a></p>\n\n<table>\n<tr>',
        1,
    )

# B: stage light banner, every grid cell starts with its clip
b = banner_re.sub(banner("stage", "GoodWatch: find what to watch next. A stage light swings over a slowly drifting wall of posters."), base)
rows = []
for i in range(0, len(features), 2):
    tds = []
    for f in features[i : i + 2]:
        tds.append(f'<td width="50%" valign="top">\n\n{clip_img(f)}<br>\n{f["badge"]}<br>\n**{f["title"]}**<br>\n{f["text"]}\n\n</td>')
    rows.append("<tr>\n" + "\n".join(tds) + "\n</tr>")
b = grid_re.sub(lambda _: "<table>\n" + "\n".join(rows) + "\n</table>", b)

# C: sign-up card banner, features with a clip become alternating rows; the rest stay a compact list
c = banner_re.sub(banner("card", "GoodWatch: Somewhere in here is your next favorite. A spotlight moves across a drifting wall of posters."), base)
with_clip = [f for f in features if clip(FEATURE_CLIP[f["key"]])]
without = [f for f in features if not clip(FEATURE_CLIP[f["key"]])]
rows = []
for i, f in enumerate(with_clip):
    pic = f'<td width="58%" valign="middle">{clip_img(f)}</td>'
    text = f'<td valign="middle">\n\n{f["badge"]}<br>\n<h3>{f["title"]}</h3>\n{f["text"]}\n\n</td>'
    rows.append("<tr>\n" + (pic + "\n" + text if i % 2 == 0 else text + "\n" + pic) + "\n</tr>")
more = ""
if without:
    more = "\n\n" + "\n".join(f'- {f["badge"]} **{f["title"]}.** {f["text"]}' for f in without)
c = grid_re.sub(lambda _: "<table>\n" + "\n".join(rows) + "\n</table>" + more, c)

for name, text, key in (("README.md", a, "A"), ("README-B.md", b, "B"), ("README-C.md", c, "C")):
    text = switcher(key) + text
    open(name, "w").write(text)
    print("wrote", name)
