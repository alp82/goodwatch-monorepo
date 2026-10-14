# Builds review.html: one self-contained page with the screenshots as data URIs and the cost table.
#   python3 build-review.py <costs.json> <shots folder> <review.html>
import base64
import html
import io
import json
import sys
from pathlib import Path

from PIL import Image

costs_path, shots_dir, out_path = sys.argv[1], Path(sys.argv[2]), sys.argv[3]
costs = json.loads(Path(costs_path).read_text())

ROUTE = "http://localhost:3142/prototype/title-section"
BRANCH = sys.argv[4] if len(sys.argv) > 4 else "prototype/talked-about-now-title-section"

RUN = """cd goodwatch-webapp
npm ci && npx patch-package   # once, in a fresh worktree
REC_TASTE_MATCH=on REC_FILTER_BAR=on REC_WATCH_NEXT=on REC_TASTE_PAGE=on REC_EXPLORER=on \\
REC_NAVIGATION=on REC_AGE_FILTER=on REC_TRACKING=on npx remix vite:dev --port 3142"""

VARIANTS = [
    (
        "rail",
        "A · Mixed rail",
        "Tests one row for everything, sources interleaved (video, post, vertical clip, headline). Compact: costs one screen of height and reads as one feed of buzz.",
        "Players change size when loaded (a Bluesky post grows to 650 px, a reel needs 326 px width), so a loaded rail gets ragged; on phones only one card shows at a time and the mix is hidden behind swipes.",
    ),
    (
        "grouped",
        "B · Grouped by platform",
        "Tests a grid with one block per platform and a \"Load all\" per platform: the consent is per vendor and the owner sees which platform carries the weight.",
        "Tallest by far (about 4,000 px loaded on desktop, 5,700 px on a phone); thin platforms (one Facebook reel, one Threads post) leave holes, and it shows the platforms rather than the conversation.",
    ),
    (
        "featured",
        "C · Featured video + feed",
        "Tests one big official video (the title's own trailer, our backdrop as facade) beside a text feed of posts, clips and headlines that opens each player in place.",
        "Most readable and the feed costs nothing until a row is opened; the featured slot is always YouTube, so other sources get less visual weight, and an opened vertical clip stretches the feed.",
    ),
    (
        "lab",
        "D · Every source side by side",
        "Not a layout to ship: one item per source with its facade, its loaded player and its measured cost, for picking the sources.",
        "The \"Load all\" state is what a page with every source loaded looks like; it also shows the two posts left out on purpose (Bluesky opt-out label, Mastodon author not discoverable).",
    ),
]

SOURCES = [
    ("control", "Control: no click", "the idle page over the same time"),
    ("youtube", "YouTube video", "iframe, youtube-nocookie.com"),
    ("short", "YouTube Short (9:16)", "iframe, youtube-nocookie.com"),
    ("tiktok", "TikTok", "Player v1 iframe"),
    ("reel", "Instagram (Reel slot)", "embed.js + iframe"),
    ("threads", "Threads", "embed.js + iframe"),
    ("facebook", "Facebook reel", "SDK + iframe"),
    ("bluesky", "Bluesky", "embed.js + iframe"),
    ("reddit", "Reddit", "widgets.js + iframe"),
    ("mastodon", "Mastodon", "embed.js + iframe"),
    ("news", "News headline", "plain link"),
]


def img(name, width=None):
    path = shots_dir / name
    if not path.exists():
        return f'<div class="missing">missing: {html.escape(name)}</div>'
    im = Image.open(path).convert("RGB")
    if width and im.width > width:
        im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, "WEBP", quality=72, method=5)
    data = base64.b64encode(buf.getvalue()).decode()
    return f'<img loading="lazy" src="data:image/webp;base64,{data}" alt="{html.escape(name)}" width="{im.width}" height="{im.height}">'


def cost_rows():
    rows = []
    for key, label, how in SOURCES:
        c = costs["sources"].get(key)
        if key == "news":
            rows.append(f"<tr><th>{label}<small>{how}</small></th><td class=ok>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>–</td><td class=hosts>none (the click opens the publisher)</td></tr>")
            continue
        if not c:
            rows.append(f"<tr><th>{label}<small>{how}</small></th><td colspan=10>not measured</td></tr>")
            continue
        a = c["after"]
        ready = "–" if a["readyMs"] is None else f'{a["readyMs"] / 1000:.1f} s'
        before = c["before"]["thirdPartyRequests"]
        rows.append(
            f"<tr{' class=control' if key == 'control' else ''}><th>{label}<small>{how}</small></th>"
            f"<td class={'ok' if before == 0 else 'bad'}>{before}</td>"
            f'<td>{a["requests"]}</td><td>{a["hosts"]}</td><td>{a["kb"]:,}</td><td>{a["jsKb"]:,}</td>'
            f'<td>{a.get("setCookies", "?")}</td><td><b>{a.get("vendorMs", "?"):,}</b></td><td>{a["tbtMs"]:,}</td><td>{ready}</td>'
            f'<td class=hosts>{", ".join(a["hostList"]) or "none"}</td></tr>'
        )
    return "\n".join(rows)


PHONE_NOTE = {
    "grouped": ". The Bluesky and Mastodon players had loaded (their frames have their height) but headless Chromium left them unpainted in this 5,700 px tall capture; the lab's phone shot shows both at this width.",
}

variant_html = []
for key, name, tests, tradeoffs in VARIANTS:
    variant_html.append(
        f"""
<section class="variant" id="{key}">
  <h3>{name} <code>?variant={key}</code></h3>
  <p><b>Tests:</b> {tests}</p>
  <p><b>Tradeoffs:</b> {tradeoffs}</p>
  <div class="pair">
    <figure><figcaption>Desktop, before any click</figcaption>{img(f"{key}-desktop-facade.png", 1200)}</figure>
    <figure><figcaption>Desktop, players loaded</figcaption>{img(f"{key}-desktop-loaded.png", 1200)}</figure>
  </div>
  <div class="pair phones">
    <figure><figcaption>Phone, before</figcaption>{img(f"{key}-phone-facade.png", 390)}</figure>
    <figure><figcaption>Phone, loaded{PHONE_NOTE.get(key, "")}</figcaption>{img(f"{key}-phone-loaded.png", 390)}</figure>
  </div>
</section>"""
    )

page = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Talked about now: title section</title>
<style>
:root {{ --bg:#0f1115; --panel:#171a21; --line:#2a2f3a; --text:#e8e8ea; --muted:#9aa0ab; --accent:#f5b544; --ok:#4ade80; --bad:#f87171; }}
@media (prefers-color-scheme: light) {{ :root:not([data-theme="dark"]) {{ --bg:#f7f7f8; --panel:#fff; --line:#dedfe3; --text:#16181d; --muted:#5d6370; --accent:#b7791f; --ok:#15803d; --bad:#b91c1c; }} }}
* {{ box-sizing:border-box }}
body {{ margin:0; background:var(--bg); color:var(--text); font:15px/1.55 system-ui,-apple-system,Segoe UI,Roboto,sans-serif; }}
main {{ max-width:1240px; margin:0 auto; padding:32px 16px 80px; }}
h1 {{ font-size:28px; margin:0 0 4px }} h2 {{ margin:48px 0 12px; font-size:22px }} h3 {{ margin:0 0 8px; font-size:18px }}
p {{ margin:6px 0 }} small {{ display:block; color:var(--muted); font-weight:400; font-size:12px }}
code, pre {{ font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:13px }}
pre {{ background:var(--panel); border:1px solid var(--line); border-radius:10px; padding:12px; overflow-x:auto }}
.muted {{ color:var(--muted) }}
a {{ color:var(--accent) }}
.card {{ background:var(--panel); border:1px solid var(--line); border-radius:14px; padding:16px 18px; margin:12px 0 }}
.rec {{ border-color:var(--accent) }}
.variant {{ background:var(--panel); border:1px solid var(--line); border-radius:14px; padding:18px; margin:18px 0 }}
.pair {{ display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-top:12px; align-items:start }}
.pair.phones {{ grid-template-columns:repeat(2, minmax(0, 390px)); }}
figure {{ margin:0 }} figcaption {{ font-size:12px; color:var(--muted); margin-bottom:4px }}
figure img {{ width:100%; height:auto; border-radius:8px; border:1px solid var(--line); display:block }}
.table-wrap {{ overflow-x:auto; border:1px solid var(--line); border-radius:12px }}
table {{ border-collapse:collapse; width:100%; min-width:980px; font-size:13px; background:var(--panel) }}
th, td {{ padding:8px 10px; border-bottom:1px solid var(--line); text-align:right; vertical-align:top }}
thead th {{ position:sticky; top:0; background:var(--panel); font-size:12px; color:var(--muted); font-weight:600 }}
tbody th {{ text-align:left; white-space:nowrap }}
td.hosts {{ text-align:left; color:var(--muted); font-size:12px; min-width:260px }}
td.ok {{ color:var(--ok); font-weight:700 }} td.bad {{ color:var(--bad); font-weight:700 }}
tr.control {{ color:var(--muted) }}
ul {{ padding-left:20px }} li {{ margin:4px 0 }}
.missing {{ padding:24px; border:1px dashed var(--line); border-radius:8px; color:var(--muted) }}
@media (max-width: 760px) {{ .pair, .pair.phones {{ grid-template-columns:1fr }} }}
</style>
</head>
<body>
<main>
<h1>"Talked about now" on a title page</h1>
<p class="muted">Prototype for ticket <a href="https://github.com/alp82/goodwatch-monorepo/issues/542">#542</a> (map #537). Title: <b>Resident Evil (2026)</b>, No. 1 at the global box office on 14 Oct 2026, on the real title page. Branch <code>{html.escape(BRANCH)}</code>.</p>

<div class="card">
<p><b>Run it</b> (no <code>.env</code> needed; run it without one so nothing reaches production):</p>
<pre>{html.escape(RUN)}</pre>
<p>Then open <a href="{ROUTE}"><code>{ROUTE}</code></a> and switch with <code>?variant=rail|grouped|featured|lab</code> or the arrow keys. The pink "Embed hosts" pill lists every third-party host the embeds contacted: it stays at 0 until a facade is clicked. Its source toggles write <code>?sources=</code>.</p>
</div>

<div class="card rec">
<p><b>Recommendation</b></p>
<ul>
<li><b>Layout: C, a featured video plus a feed.</b> Use the rail (A) instead where the section must stay one row tall. C is the only layout that is cheap and readable before any click: one official video behind our own artwork, and a text feed that costs nothing until a row is opened. A gets ragged and B very tall once players load (B: about 4,000 px on desktop, 5,700 px on a phone), because each vendor sets its embed's height.</li>
<li><b>Ship first: YouTube (videos and Shorts), Bluesky, Mastodon and news headlines.</b> The content is real and about the title, and nobody has to curate it. YouTube's keys come from our own TMDB data, Bluesky and Mastodon posts bring their own text into the facade, and headlines are plain links. Bluesky is the cheapest player measured: 8 requests, 102 KB, about 0.1 s of vendor script, no cookies. YouTube from <code>youtube-nocookie.com</code> sets no cookie header, but it fetches about 900 KB of script and starts streaming the video. Mastodon talks to a single server, yet it loads the server's whole web app: 139 requests and 2.2 MB.</li>
<li><b>Keep the hand-picked sources optional, and decide them by cost.</b> TikTok is the heaviest by far: 83 requests to 9 hosts (ByteDance telemetry included), 4.8 MB, about 8 s of vendor script, 8 cookies, and its own cookie banner inside the player. Facebook comes next, at about 7 s of vendor script; in 2 of 3 runs the player had not finished loading after 25 s. Instagram sits in the middle: 1.4 MB and about 1.8 s. Reddit is light (347 KB), but it contacts LiveRamp (<code>id.rlcdn.com</code>) and its responses carry 21 Set-Cookie headers, and it blocks headless browsers. <b>Threads did not render at all on 14 Oct:</b> <code>threads.com/embed.js</code> answered HTTP 500, also to <code>curl</code>, so only its "View on Threads" link showed.</li>
<li>The facade works as promised: <b>0 third-party requests before the click for every source</b>, and the page's own hosts (TMDB artwork) are the only ones.</li>
</ul>
</div>

<h2>Cost of each embed, before and after the click</h2>
<p class="muted">{html.escape(costs.get("note", ""))}</p>
<div class="table-wrap">
<table>
<thead><tr><th style="text-align:left">Source</th><th>Before: third-party requests</th><th>After: requests</th><th>Hosts</th><th>Transfer KB</th><th>Script KB</th><th>Set-Cookie headers</th><th>Vendor script ms</th><th>Blocking time ms</th><th>Player shown</th><th style="text-align:left">Hosts contacted after the click</th></tr></thead>
<tbody>
{cost_rows()}
</tbody>
</table>
</div>
<p class="muted">Method: Playwright with headless Chromium {html.escape(costs.get("chromium", ""))}, on the prototype's lab variant with only that source (<code>?variant=lab&amp;only=&lt;source&gt;</code>), median of {costs.get("runsPerSource", 3)} runs, each in a fresh browser context (cold cache, no cookies), unthrottled network. "Before" counts requests to any host other than the dev server and TMDB's artwork while the page loads and settles. "After" counts everything the click brings, in every frame, until the network is quiet for 3 s (25 s at most). <b>Vendor script ms</b> is the main-thread script work (evaluation, compilation, function calls) in a Chromium trace over the click, attributed to scripts not served by GoodWatch, the way Lighthouse's third-party summary attributes it: the column to compare CPU cost by. Blocking time is the sum of the long tasks' time beyond 50 ms after the click (Lighthouse's TBT rule), with site isolation off so the players' frames count; it also holds this dev page's own re-render after the click (the Threads row, where nothing loaded, shows that part). Set-Cookie headers counts the cookies the vendors' responses try to set (this Chromium blocks third-party cookies, so what is stored is not a useful number). Transfer includes video that starts streaming, because the player autoplays after the click. Measured {html.escape(costs.get("measuredAt", ""))} on a machine shared with other sessions (load average {html.escape(str(costs.get("load", "?")))}): requests, bytes, hosts and cookies are reliable; the millisecond columns are not and should only be compared with each other and with the control row.</p>

<h2>Layouts</h2>
{"".join(variant_html)}

<h2>Where the section sits</h2>
<p class="muted">Between the fingerprint and About, so a title that is hot shows its buzz high up. The page around it is the real title page.</p>
<div class="pair">
<figure><figcaption>Desktop</figcaption>{img("page-desktop.png", 1200)}</figure>
<figure><figcaption>Phone</figcaption>{img("page-phone.png", 390)}</figure>
</div>

<h2>Notes</h2>
<ul>
<li>Every facade is text plus the title's own TMDB artwork; no <code>i.ytimg.com</code> thumbnail and no vendor script loads before the click. The click is the consent for that one item and the button names the company and the cookies.</li>
<li>YouTube loads from <code>youtube-nocookie.com</code> with <code>strict-origin-when-cross-origin</code>; Shorts get a 9:16 frame instead of oEmbed's 113×200; TikTok uses Player v1.</li>
<li>Left out on purpose: a Bluesky author with <code>!no-unauthenticated</code> (made-up entry, real rule) and a real Mastodon post whose author is not discoverable.</li>
<li>Items tagged <b>sample</b> (TikTok, Instagram, Threads, Facebook, Reddit) show the vendors' documented public sample posts after the click, because hand-picking is not built; the facade line is what an editor would write. Everything else is real content about the title.</li>
<li>Nothing was written anywhere: the title page is goodwatch.app's own loader data for this title, saved in the prototype.</li>
</ul>
</main>
</body>
</html>
"""
Path(out_path).write_text(page)
print("wrote", out_path, round(len(page) / 1024), "KB")
