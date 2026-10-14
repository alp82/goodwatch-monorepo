# PROTOTYPE - throwaway (#541). Builds review.html from the screenshots of shots.mjs, each embedded as a data URI.
#   python3 build-review.py <shots dir>
import base64
import html
import pathlib
import sys

SHOTS = pathlib.Path(sys.argv[1])
OUT = pathlib.Path(__file__).with_name("review.html")
URL = "http://alp-laptop.tail3b99f1.ts.net:3151/prototype/start-row?variant=E#browse"
RUN = (
    "cd goodwatch-webapp   # a worktree without .env\n"
    "npm ci && npx patch-package\n"
    "__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS=alp-laptop.tail3b99f1.ts.net \\\n"
    "REC_TASTE_MATCH=on REC_FILTER_BAR=on REC_WATCH_NEXT=on REC_TASTE_PAGE=on REC_EXPLORER=on \\\n"
    "REC_NAVIGATION=on REC_AGE_FILTER=on REC_TRACKING=on \\\n"
    "npx remix vite:dev --port 3151 --strictPort --host 100.71.215.115"
)


def uri(name):
    data = base64.b64encode((SHOTS / name).read_bytes()).decode()
    return f"data:image/jpeg;base64,{data}"


VARIANTS = [
    {
        "key": "A",
        "name": "Ranked",
        "tests": "Is a chart of titles enough? Ten posters with big outlined rank numbers, a reason chip (Trailer drop, Netflix Top 10, News spike, New series, Out Friday), one line of fact and the move since yesterday.",
        "trade": "Needs only the buzz score and a reason per title, no third-party content and no consent; the cheapest to ship and it degrades well. It says why in two words but shows none of the talk itself; the rank numbers take width, so a phone sees two cards at a time.",
        "shots": [("A-desktop.jpg", "Desktop, 1440 px"), ("A-phone.jpg", "Phone, 390 px")],
    },
    {
        "key": "B",
        "name": "Mixed",
        "tests": "Should the row carry the talk itself? Each hot title is followed by its trailer (click-to-load facade with our own TMDB picture), a post (Bluesky, Mastodon) and a headline, grouped under a rule with the rank.",
        "trade": "The richest and the most alive, but every group needs good content every day, which is the hard half per the research; a title without any leaves a hole. It brings the consent facade, report links and the lawyer's questions (server-rendered post text) onto the start page. Long rail: about 25 cards for 7 titles.",
        "shots": [
            ("B-desktop.jpg", "Desktop, 1440 px"),
            ("B-phone.jpg", "Phone, 390 px"),
            ("B-desktop-played.jpg", "Desktop, after pressing the trailer (stand-in for the player)"),
        ],
    },
    {
        "key": "C",
        "name": "Ticker",
        "tests": "Is a light touch enough? One crawling line (it stops under the pointer or focus; reduced motion makes it a strip to swipe), Expand opens the ten as a list. The room's lip says “Talked about now: East of Eden, Below, Avengers…”, so the first screen names them.",
        "trade": "Smallest footprint and the only variant visible from the room's first screen (through the lip). A crawl is hard to read and to press, motion is a cost, and it looks like news, not like GoodWatch. The lip line works with any variant.",
        "shots": [
            ("C-desktop.jpg", "Desktop, 1440 px"),
            ("C-phone.jpg", "Phone, 390 px"),
            ("C-desktop-expanded.jpg", "Desktop, expanded"),
            ("C-phone-expanded.jpg", "Phone, expanded"),
            ("C-phone-room.jpg", "Phone, the room's first screen with the lip line"),
            ("C-desktop-room.jpg", "Desktop, the room's first screen with the lip line"),
        ],
    },
    {
        "key": "D",
        "name": "Pulse (own idea)",
        "tests": "Should GoodWatch show why a title is hot as data, as it does for scores and fingerprints? Each title has its 14-day buzz curve with the day of the reason marked and “×2.4 its usual”. One title is the lead (backdrop, full curve with a hover readout, its best piece of content); pressing a row makes it the lead. On a phone the lead opens in the board under its row.",
        "trade": "The most distinctive and honest about the ranking, and the curve is free data (Wikipedia pageviews). It is dense, and “×2.1” next to rank 1 while rank 2 shows ×5.9 needs explaining (rank is volume, × is change). Needs daily history stored, and the lead makes the phone version long.",
        "shots": [
            ("D-desktop.jpg", "Desktop, 1440 px"),
            ("D-phone.jpg", "Phone, 390 px, first row open"),
            ("D-desktop-lead3.jpg", "Desktop, after pressing rank 3"),
        ],
    },
    {
        "key": "E",
        "name": "Pulse + native (after the owner's pick of D)",
        "tests": "D with B's native displays in it. The lead keeps D's curve and “×N its usual” and adds its two or three best pieces as they are on their platforms: the trailer behind the click-to-load facade, then a headline and a Bluesky or Mastodon post side by side (a strip to swipe on a phone). Each row of the board gets one line of preview: the platforms' marks and a post's first words (or a headline), so the board says what is being said before it is pressed.",
        "trade": "Keeps D's honesty about the ranking and gets B's life without B's long rail: only the lead carries full content, so one good title a day is enough and a title with less shows less (rank 6 has no video, so its backdrop heads the lead). It still brings the consent facade and the lawyer's question (post text on our server) onto the start page, the rows grow a line, and the lead is now taller than the board on desktop.",
        "shots": [
            ("E-desktop.jpg", "Desktop, 1440 px, rank 1 as the lead"),
            ("E-phone.jpg", "Phone, 390 px, first row open"),
            ("E-desktop-lead3.jpg", "Desktop, after pressing rank 3 (trailer, headline, post)"),
            ("E-desktop-lead6.jpg", "Desktop, after pressing rank 6 (no video: the backdrop heads the lead)"),
        ],
    },
]

RECOMMENDATION = """
<p><b>Update, after the owner's pick:</b> D was chosen, with more of B's native content in it; that is E. Build E,
with two guards: the lead shows only the pieces it has (no empty slots), and rows without any content keep D's two
lines. C's lip line still works on top of it, so the room's first screen names the top three.</p>
<p style="color:var(--muted)"><b>The first recommendation, before the pick:</b> ship A, with C's lip line, and keep the talk itself for the title page.</b> A works on the buzz score and a reason
alone, so it can launch before the content flows are good, it needs no consent on the start page, and it stays
cacheable and light. The lip line (C) is the only thing that reaches the room's first screen and costs one line of
text. B is the right shape for a title page's section, where one title's content is enough to fill it; on the start
page it needs good content for seven titles every day. From D, take the “×N its usual” figure into A's
fact line if the score flow stores daily history; the full board is a later experiment.</p>
"""


def figure(name, caption):
    return (
        f'<figure><img src="{uri(name)}" alt="{html.escape(caption)}" loading="lazy">'
        f"<figcaption>{html.escape(caption)}</figcaption></figure>"
    )


sections = []
for v in VARIANTS:
    figs = "".join(figure(n, c) for n, c in v["shots"])
    sections.append(
        f"""<section id="v{v['key']}">
  <h2><span class="key">{v['key']}</span>{html.escape(v['name'])}</h2>
  <p class="link"><code>/prototype/start-row?variant={v['key']}#browse</code></p>
  <dl><dt>Tests</dt><dd>{html.escape(v['tests'])}</dd><dt>Tradeoffs</dt><dd>{html.escape(v['trade'])}</dd></dl>
  <div class="shots">{figs}</div>
</section>"""
    )

nav = "".join(f'<a href="#v{v["key"]}">{v["key"]} · {html.escape(v["name"])}</a>' for v in VARIANTS)

page = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Talked about now row</title>
<style>
:root {{
  --bg: #f6f5f2; --surface: #ffffff; --ink: #16181d; --muted: #5d6270; --line: #e2e0da; --accent: #a86b00; --code: #efede7;
}}
@media (prefers-color-scheme: dark) {{
  :root:not([data-theme="light"]) {{
    --bg: #0d1017; --surface: #151a24; --ink: #eceae4; --muted: #9aa0ad; --line: #262c39; --accent: #fcd34d; --code: #1d2330;
  }}
}}
:root[data-theme="dark"] {{
  --bg: #0d1017; --surface: #151a24; --ink: #eceae4; --muted: #9aa0ad; --line: #262c39; --accent: #fcd34d; --code: #1d2330;
}}
* {{ box-sizing: border-box; }}
body {{ margin: 0; background: var(--bg); color: var(--ink); font: 16px/1.55 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; }}
main {{ max-width: 1180px; margin: 0 auto; padding: 40px 16px 80px; }}
h1 {{ font-size: clamp(1.8rem, 4vw, 2.6rem); line-height: 1.1; margin: 0 0 8px; letter-spacing: -0.01em; }}
.eyebrow {{ color: var(--accent); font-weight: 700; letter-spacing: .16em; text-transform: uppercase; font-size: 12px; margin: 0 0 8px; }}
.lede {{ color: var(--muted); max-width: 70ch; margin: 0; }}
.box {{ background: var(--surface); border: 1px solid var(--line); border-radius: 14px; padding: 18px 20px; margin-top: 24px; }}
.box h3 {{ margin: 0 0 8px; font-size: 15px; }}
pre {{ background: var(--code); border-radius: 8px; padding: 12px 14px; overflow-x: auto; font-size: 13px; margin: 8px 0; }}
code {{ font: 13px ui-monospace, SFMono-Regular, Menlo, monospace; }}
p code, .link code {{ background: var(--code); padding: 1px 6px; border-radius: 5px; }}
nav {{ display: flex; flex-wrap: wrap; gap: 8px; margin-top: 24px; }}
nav a {{ color: var(--ink); text-decoration: none; border: 1px solid var(--line); background: var(--surface); padding: 6px 12px; border-radius: 999px; font-size: 14px; font-weight: 600; }}
nav a:hover {{ border-color: var(--accent); }}
section {{ margin-top: 56px; padding-top: 24px; border-top: 1px solid var(--line); }}
h2 {{ display: flex; align-items: center; gap: 12px; margin: 0; font-size: 1.6rem; }}
.key {{ display: inline-grid; place-items: center; width: 36px; height: 36px; border-radius: 10px; background: var(--accent); color: #111; font-size: 18px; }}
.link {{ margin: 6px 0 0; color: var(--muted); }}
dl {{ display: grid; grid-template-columns: 7rem minmax(0, 1fr); gap: 6px 16px; margin: 16px 0 0; max-width: 80ch; }}
dt {{ font-weight: 700; color: var(--muted); font-size: 14px; padding-top: 2px; }}
dd {{ margin: 0; }}
.shots {{ display: grid; grid-template-columns: minmax(0, 2.2fr) minmax(0, 1fr); gap: 16px; align-items: start; margin-top: 20px; }}
figure {{ margin: 0; background: var(--surface); border: 1px solid var(--line); border-radius: 12px; padding: 8px; }}
figure img {{ display: block; width: 100%; height: auto; border-radius: 6px; }}
figcaption {{ font-size: 13px; color: var(--muted); padding: 8px 4px 2px; }}
@media (max-width: 720px) {{
  .shots {{ grid-template-columns: minmax(0, 1fr); }}
  dl {{ grid-template-columns: minmax(0, 1fr); }}
  dt {{ padding-top: 8px; }}
}}
</style>
</head>
<body>
<main>
  <p class="eyebrow">Prototype · #541 · for the owner's review</p>
  <h1>Talked about now: the start page row</h1>
  <p class="lede">Five variants of the row (E added after the owner picked D), at the top of the real section below the living room, on the real room
  as a guest sees it. Real titles in the news in the week of 14 October 2026 with their TMDB posters; the reasons
  follow the week's news, the numbers, curves, posts and headlines are made up. Nothing is fetched from a third party.</p>

  <div class="box">
    <h3>Run it</h3>
    <pre><code>{html.escape(RUN)}</code></pre>
    <p style="margin:6px 0 0">Then open <code>{html.escape(URL)}</code> and switch with the floating bar or ← → (A to E).
    The <code>#browse</code> opens the page below the room, as “More below” does.</p>
  </div>

  <div class="box">
    <h3>Recommendation</h3>
    {RECOMMENDATION}
  </div>

  <nav>{nav}</nav>
  {''.join(sections)}
</main>
</body>
</html>
"""
OUT.write_text(page)
print(OUT, f"{len(page) / 1e6:.1f} MB")
