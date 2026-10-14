# PROTOTYPE - throwaway (#545). Builds review.html from drive.mjs's screenshots and checks.json, with every image
# embedded as a data URI so the page is one file.
#   python3 build-review.py <folder with the screenshots and checks.json>
import base64
import html
import json
import subprocess
import sys
from pathlib import Path

SHOTS = Path(sys.argv[1])
HERE = Path(__file__).parent
checks = json.loads((SHOTS / "checks.json").read_text())
passed = sum(c["ok"] for c in checks)
BRANCH = subprocess.run(["git", "branch", "--show-current"], capture_output=True, text=True, cwd=HERE).stdout.strip()


def img(name, caption, phone=False):
    data = base64.b64encode((SHOTS / f"{name}.jpg").read_bytes()).decode()
    return (
        f'<figure class="{"phone" if phone else "desk"}"><img alt="{html.escape(caption)}" loading="lazy" '
        f'src="data:image/jpeg;base64,{data}"><figcaption>{html.escape(caption)}</figcaption></figure>'
    )


VARIANTS = [
    {
        "key": "A",
        "name": "Extend CookieConsent",
        "tests": "Does the current banner, extended with a toggle per vendor beside Analytics, plus a facade that asks for "
        "its vendor when clicked, feel like enough?",
        "tradeoffs": "Familiar and cheap (≈4.8 KB gzip own code), and the only way here to also settle analytics consent. "
        "But it brings a banner back to every landing page, and a first-time visitor needs three clicks to the first "
        "video (dismiss, play, allow).",
        "desk": [("A-desktop-1-first-visit", "First visit: the current banner's box, with a Choose step"),
                 ("A-desktop-2-choose", "Choose: Analytics plus one toggle per vendor"),
                 ("A-desktop-3-facade-asks", "After Decline, the facade asks for YouTube itself"),
                 ("A-desktop-4-youtube-live", "Allowed: the real YouTube player, remembered for the next visit")],
        "phone": [("A-phone-1-first-visit", "First visit"), ("A-phone-3-facade-asks", "Facade asks"),
                  ("A-phone-4-youtube-live", "Playing")],
    },
    {
        "key": "B",
        "name": "vanilla-cookieconsent v3 + iframemanager",
        "tests": "Do the two libraries, wired as their own demo wires them and themed dark, beat writing it ourselves?",
        "tradeoffs": "Most complete preferences UI for no design work, but ≈23.6 KB gzip (15.5 KB of it on every page's "
        "first view), facade notices we can only restyle, two clicks to play even after “Load once”, and "
        "“Always allow” mounts every embed of that vendor on the page at once.",
        "desk": [("B-desktop-1-first-visit", "First visit: the library's banner and iframemanager's notices"),
                 ("B-desktop-2-preferences", "Choose: the library's preferences, three categories"),
                 ("B-desktop-3-tiktok-live", "“Always allow” on one TikTok loads both TikToks at once")],
        "phone": [("B-phone-1-first-visit", "First visit"), ("B-phone-3-tiktok-live", "TikTok allowed")],
    },
    {
        "key": "C",
        "name": "Facade only",
        "tests": "Is the click on a facade that says where the video comes from enough consent, with a “Remember for "
        "YouTube” checkbox instead of any banner?",
        "tradeoffs": "One click to the first video, ≈3.9 KB gzip only where embeds are, nothing site-wide. The facade "
        "carries more text (host, IP, privacy link, checkbox), and analytics stay as they are today.",
        "desk": [("C-desktop-1-first-visit", "First visit: no banner; each facade says where it loads from"),
                 ("C-desktop-2-youtube-live", "Play with “Remember for YouTube” ticked: playing, remembered"),
                 ("C-desktop-3-bluesky-live", "Show post: The Verge on Other Mommy, Bluesky's own widget"),
                 ("C-desktop-4-tiktok-live", "TikTok's player brings its own cookie prompt")],
        "phone": [("C-phone-1-first-visit", "First visit"), ("C-phone-2-youtube-live", "Playing"),
                  ("C-phone-3-bluesky-live", "Bluesky post")],
    },
    {
        "key": "D",
        "name": "Ask in the row (added)",
        "tests": "Should consent belong to the “Talked about now” row: one question with a chip per source, no "
        "site banner and no question per card?",
        "tradeoffs": "One decision for the whole row, Bluesky posts then show by themselves and videos play on one "
        "click; a source left off offers itself on its card. ≈4.3 KB gzip only where the row is. Until answered "
        "the row is only GoodWatch's artwork and words; analytics stay as today.",
        "desk": [("D-desktop-1-first-visit", "First visit: the question in the row's header"),
                 ("D-desktop-2-posts-on", "TikTok switched off, Show posts: Bluesky posts appear, TikTok offers itself"),
                 ("D-desktop-3-youtube-live", "A trailer plays on one click")],
        "phone": [("D-phone-1-first-visit", "First visit"), ("D-phone-2-posts-on", "Posts on"),
                  ("D-phone-3-youtube-live", "Playing")],
    },
]

ROWS = [
    ("A", "Yes (the current one, extended)", "3 (dismiss, play, allow) · 2 with Accept all", "≈4.8 KB, banner on every page", "Becomes a real opt-in: PostHog, GA and Sentry replay wait for “yes”"),
    ("B", "Yes (the library's)", "3 (dismiss, load, YouTube's play)", "≈23.6 KB, 15.5 KB on every page", "Same as A, the library's cookie is the truth"),
    ("C", "No", "1", "≈3.9 KB, only where embeds are", "Unchanged: loads as today, without asking"),
    ("D", "No", "2 (show posts, play)", "≈4.3 KB, only where the row is", "Unchanged: loads as today, without asking"),
]

sections = []
for v in VARIANTS:
    sections.append(f"""
<section id="v{v['key']}">
  <h2><span class="key">{v['key']}</span> {html.escape(v['name'])}</h2>
  <p><b>Tests:</b> {html.escape(v['tests'])}</p>
  <p><b>Tradeoffs:</b> {html.escape(v['tradeoffs'])}</p>
  <p class="url"><a href="http://localhost:3145/prototype/consent?variant={v['key']}">localhost:3145/prototype/consent?variant={v['key']}</a></p>
  <h3>Desktop, 1280 px</h3>
  <div class="grid desk-grid">{''.join(img(n, c) for n, c in v['desk'])}</div>
  <h3>Phone, 390 px</h3>
  <div class="grid phone-grid">{''.join(img(n, c, True) for n, c in v['phone'])}</div>
</section>""")

table = "".join(
    f"<tr><th>{k}</th><td>{html.escape(b)}</td><td>{html.escape(c)}</td><td>{html.escape(s)}</td><td>{html.escape(a)}</td></tr>"
    for k, b, c, s, a in ROWS
)
check_list = "".join(f'<li class="{"ok" if c["ok"] else "bad"}">{html.escape(c["name"])}</li>' for c in checks)

page = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Embed consent review</title>
<style>
:root {{
  --bg: #fafaf9; --fg: #1c1917; --muted: #57534e; --line: #e7e5e4; --card: #fff; --accent: #b45309; --ok: #15803d; --bad: #b91c1c;
}}
@media (prefers-color-scheme: dark) {{
  :root:not([data-theme="light"]) {{ --bg: #0c0a09; --fg: #f5f5f4; --muted: #a8a29e; --line: #292524; --card: #1c1917; --accent: #fbbf24; --ok: #4ade80; --bad: #f87171; }}
}}
:root[data-theme="dark"] {{ --bg: #0c0a09; --fg: #f5f5f4; --muted: #a8a29e; --line: #292524; --card: #1c1917; --accent: #fbbf24; --ok: #4ade80; --bad: #f87171; }}
* {{ box-sizing: border-box; }}
body {{ margin: 0; background: var(--bg); color: var(--fg); font: 15px/1.55 system-ui, -apple-system, "Segoe UI", sans-serif; }}
main {{ max-width: 1160px; margin: 0 auto; padding: 32px 16px 80px; }}
h1 {{ font-size: 1.8rem; margin: 0 0 4px; }}
h2 {{ font-size: 1.35rem; margin: 48px 0 8px; display: flex; gap: 10px; align-items: center; }}
h3 {{ font-size: .95rem; color: var(--muted); margin: 20px 0 8px; font-weight: 600; }}
.key {{ background: var(--accent); color: var(--bg); border-radius: 6px; padding: 0 9px; font-size: 1rem; }}
.sub {{ color: var(--muted); margin: 0 0 20px; }}
.box {{ background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 14px 16px; margin: 16px 0; }}
.box h2 {{ margin: 0 0 6px; font-size: 1.05rem; }}
code, pre {{ font: 13px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; }}
pre {{ background: var(--card); border: 1px solid var(--line); border-radius: 8px; padding: 10px 12px; overflow-x: auto; white-space: pre-wrap; word-break: break-word; }}
a {{ color: var(--accent); }}
.table-wrap {{ overflow-x: auto; }}
table {{ border-collapse: collapse; width: 100%; min-width: 640px; font-size: 14px; }}
th, td {{ border-bottom: 1px solid var(--line); padding: 8px; text-align: left; vertical-align: top; }}
thead th {{ color: var(--muted); font-weight: 600; }}
.grid {{ display: grid; gap: 12px; }}
.desk-grid {{ grid-template-columns: repeat(auto-fill, minmax(min(100%, 520px), 1fr)); }}
.phone-grid {{ grid-template-columns: repeat(auto-fill, minmax(min(100%, 200px), 1fr)); max-width: 760px; }}
figure {{ margin: 0; background: var(--card); border: 1px solid var(--line); border-radius: 10px; overflow: hidden; }}
figure img {{ display: block; width: 100%; height: auto; cursor: zoom-in; }}
figure img.zoom {{ position: fixed; inset: 0; margin: auto; max-width: 96vw; max-height: 96vh; width: auto; z-index: 10; cursor: zoom-out; box-shadow: 0 0 0 100vmax rgba(0,0,0,.8); }}
figcaption {{ padding: 6px 10px; font-size: 13px; color: var(--muted); }}
ul.checks {{ columns: 2 280px; font-size: 13px; padding-left: 18px; }}
li.ok::marker {{ content: "✓ "; color: var(--ok); }}
li.bad::marker {{ content: "✗ "; color: var(--bad); }}
.url {{ font-size: 14px; }}
</style>
</head>
<body>
<main>
<h1>Per-vendor consent with click-to-load embeds</h1>
<p class="sub">Prototype for <a href="https://github.com/alp82/goodwatch-monorepo/issues/545">#545</a> (map <a href="https://github.com/alp82/goodwatch-monorepo/issues/537">#537</a>). Four ways to ask before a YouTube, TikTok or Bluesky embed loads, on one “Talked about now” row with real titles from this week (Other Mommy, Animals, The Social Reckoning, The Odyssey, East of Eden) and the real players behind the facades. Built 14 October 2026.</p>

<div class="box">
<h2>Recommendation</h2>
<p><b>C as the base, with D's question for the start-page row.</b> Both keep the site free of a banner, cost about 4 KB only where embeds are, and ask at the moment the visitor wants the video, which is the most specific consent of the four. One store (<code>consent_embeds</code>, per vendor) serves both: the row asks once with D's chips, a title page's facade asks itself with C's “Remember for …”. B costs five times the code, puts 15.5 KB on every first view, and its “Always allow” loads every embed of a vendor at once. A only earns its banner if the analytics question (below) is settled in the same step.</p>
</div>

<div class="box">
<h2>Read this first</h2>
<ul>
<li><b>There is no analytics consent today.</b> <code>&lt;CookieConsent /&gt;</code> is commented out in both places in <code>root.tsx</code>, and nothing reads <code>cookie_consent</code>. PostHog (<code>localStorage+cookie</code>), Google Analytics and Sentry load for every visitor without asking. A and B turn the dormant yes/no into a real opt-in, which drops analytics for everyone who declines; C and D leave it exactly as it is.</li>
<li><b>TikTok's player asks for its own cookies</b> inside the iframe (“Allow cookies from TikTok on this browser?”), seen from this German connection. Every variant gets that second prompt after its own; GoodWatch cannot remove it.</li>
<li><b>No embed vendor is contacted before consent</b> in any variant: the facades use GoodWatch's TMDB artwork and inline logos, and each variant's panel lists every vendor host the page has reached (checked at first visit, desktop and phone).</li>
<li>vanilla-cookieconsent hides itself from automated browsers by default (<code>hideFromBots</code>); the prototype turns that off so the screenshots show it.</li>
</ul>
</div>

<div class="table-wrap"><table>
<thead><tr><th></th><th>Site banner</th><th>Clicks to the first video, first visit</th><th>Bundle cost (gzip)</th><th>Analytics consent</th></tr></thead>
<tbody>{table}</tbody>
</table></div>

<div class="box">
<h2>Run it</h2>
<p>Branch <code>{BRANCH}</code>. In <code>goodwatch-webapp</code> of a worktree on that branch, without a <code>.env</code> (the route needs no services):</p>
<pre>npm ci &amp;&amp; npx patch-package
REC_TASTE_MATCH=on REC_FILTER_BAR=on REC_WATCH_NEXT=on REC_TASTE_PAGE=on REC_EXPLORER=on REC_NAVIGATION=on REC_AGE_FILTER=on REC_TRACKING=on npx remix vite:dev --port 3145</pre>
<p>Then open <a href="http://localhost:3145/prototype/consent">http://localhost:3145/prototype/consent</a>; <code>?variant=A|B|C|D</code>, or the arrows on the pill and the ← → keys. Each variant keeps its own stored consent; “Reset &amp; reload” in the purple panel starts it over.</p>
</div>

{''.join(sections)}

<section>
<h2>Checks ({passed}/{len(checks)} passed)</h2>
<p class="sub"><code>drive.mjs</code> in headless Chromium against the dev server. “Plays” means the video element's time advanced inside YouTube's frame; TikTok's player loaded, but this Chromium cannot decode its video, so TikTok playback was not checked.</p>
<ul class="checks">{check_list}</ul>
</section>
</main>
<script>
document.addEventListener("click", (e) => {{ if (e.target.matches("figure img")) e.target.classList.toggle("zoom") }})
</script>
</body>
</html>
"""
(HERE / "review.html").write_text(page)
print(f"review.html: {len(page) / 1e6:.1f} MB, {passed}/{len(checks)} checks")
