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


# Round 4: one short centered sentence per section, no hand-set line breaks (research:
# docs/research/readme-description-formatting.md). At most 65 characters: one line on desktop, two even lines on a
# phone. A no-break space before the last word stops a lone word on a phone.
MAX_CHARS = 65
WHY = [
    "You pay for more services than ever and still keep scrolling.",
    "GoodWatch finds the few titles that fit your taste and evening.",
]
SAY = {
    "Score": "IMDb, Rotten Tomatoes, Metacritic, and TMDB in one number.",
    "Streaming": "325 services in 139 countries, and which of yours has it tonight.",
    "For you": "Rate what you loved, and see how well everything else fits you.",
    "Your taste": "Your ratings draw a taste fingerprint you can tune at any time.",
    "Search": 'Type the evening you want, like "cozy mystery with a twist".',
    "Discover": "Narrow 1.5 million titles down to the few that fit tonight.",
    "Episodes": "A ratings grid shows where a show peaks and where it drops off.",
    "Tracking": "Your Wishlist and shows in one place, with streaming alerts.",
    "Imports": "Import ratings, watch history, and Wishlists from other apps.",
    "AI apps": "Ask ChatGPT, Claude, and other AI apps what to watch tonight.",
    "Discord": "Type /watch for a pick, or /together to vote as a group.",
}
TITLE = {"Imports": "Bring your history"}  # owner: imports are not only ratings
for f in features:
    f["title"] = TITLE.get(f["key"], f["title"])
SKIP = {"Explorer"}  # owner: remove for now
WIDTH = {"score": "70%", "episodes": "64%"}
GAP = "\n<br>\n\n"


def sentence(text):
    assert len(text) <= MAX_CHARS, f"{len(text)} chars: {text}"
    head_, _, last = text.rpartition(" ")
    text = f"{head_}&nbsp;{last}"
    return re.sub(r"(/watch|/together)", r"<code>\1</code>", text)


def section(f):
    pic = clip_img(f, WIDTH.get(FEATURE_CLIP[f["key"]], "86%"))
    out = f'<p align="center">{f["badge"]}</p>\n<h3 align="center">{TITLE.get(f["key"], f["title"])}</h3>\n<p align="center">{sentence(SAY[f["key"]])}</p>'
    return out + (f'\n<p align="center">{pic}</p>' if pic else "")


banner_a = banner("roam", "GoodWatch: find what to watch next. A soft spotlight moves across a slowly drifting wall of posters.")
a = banner_re.sub(banner_a, base)
a = grid_re.sub(lambda _: GAP.join(section(f) for f in features if f["key"] not in SKIP) + GAP, a)
why = re.search(r"## Why GoodWatch\n\n(.+?)\n", a).group(1)
a = a.replace(why, "\n".join(f'<p align="center">{sentence(w)}</p>' for w in WHY) + "\n<br>", 1)
a = a.replace("## Why GoodWatch", '<h2 align="center">Why GoodWatch</h2>', 1)
open("README.md", "w").write("> [!NOTE]\n> README animation prototype, round 5.\n\n" + a)
print("wrote README.md")
