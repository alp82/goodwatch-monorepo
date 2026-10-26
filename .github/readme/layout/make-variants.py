# PROTOTYPE: README layout variants. Run: python3 .github/readme/layout/make-variants.py
import re, pathlib
root = pathlib.Path(__file__).resolve().parents[3]
readme = (root / ".github/readme/layout/README.shipped.md").read_text()
head = readme.split('<h2 align="center">Why GoodWatch</h2>')[0]
tail = "## Built with" + readme.split("## Built with", 1)[1]

B = "https://shieldcn.dev/badge/{}-fbbf24.svg?logo={}&size=xs"
F = [  # key, badge, logo, title, short, long, link label, url
 ("score","Score","lu:Star","One score you can trust","IMDb, Rotten Tomatoes, Metacritic, and TMDB in one number.","IMDb, Rotten Tomatoes, Metacritic, and TMDB in one number. Critics count half, audiences the other half.","How the score works","https://goodwatch.app/how-it-works#score"),
 ("streaming","Streaming","lu:Tv","Where it streams","325 services in 139 countries, and which of yours has it tonight.","325 services in 139 countries. See which of your services has it tonight.","New on streaming","https://goodwatch.app/new"),
 ("for-you","For%20you","lu:Sparkles","Picked for your taste","Rate what you loved, and see how well everything else fits you.","Rate titles you loved. Your match shows how well everything else fits, and 90% means your top 1%.","Open For you","https://goodwatch.app/for-you"),
 ("taste","Your%20taste","lu:Fingerprint","Your taste fingerprint","Your ratings draw a taste fingerprint you can tune at any time.","Every title is analyzed across 74 attributes. Your ratings draw your fingerprint, and you can tune it at any time.","Draw your fingerprint","https://goodwatch.app/taste"),
 ("search","Search","lu:Search","Search by mood","Type the evening you want, like \"cozy mystery with a twist\".","Type the evening you want, like \"cozy mystery with a twist\", and get the titles that fit it.","Try this search","https://goodwatch.app/discover?q=cozy+mystery+with+a+twist"),
 ("discover","Discover","lu:ListFilter","From everything to tonight","Narrow 1.5 million titles down to the few that fit tonight.","Narrow 1.5 million titles down to a few: on your services, not seen yet, the right mood, and a high score.","Open Discover","https://goodwatch.app/discover"),
 ("episodes","Episodes","lu:LayoutGrid","Every episode at a glance","A ratings grid shows where a show peaks and where it drops off.","A ratings grid for every season shows where a show peaks and where it drops off.","See the Game of Thrones grid","https://goodwatch.app/show/1399-game-of-thrones#episodes"),
 ("tracking","Tracking","lu:ListChecks","It keeps track for you","Your Wishlist and shows in one place, with streaming alerts.","Your Wishlist and your shows in one place, with a heads-up when a title lands on one of your services.","Track your shows","https://goodwatch.app/my-shows"),
 ("imports","Imports","lu:Download","Bring your history","Import ratings, watch history, and Wishlists from other apps.","Import ratings, watch history, and Wishlists from other apps, so your taste is ready on day one.","Import your history","https://goodwatch.app/settings/imports"),
 ("ai","AI%20apps","lu:Bot","Use with AI","Ask ChatGPT, Claude, and other AI apps what to watch tonight.","Ask ChatGPT, Claude, and other AI apps what to start tonight, compare scores, or log the episode you just watched.","Set up Use with AI","https://goodwatch.app/use-with-ai"),
 ("discord","Discord","discord","Discord bot","Type <code>/watch</code> for a pick, or <code>/together</code> to vote as a group.","Type <code>/watch</code> for a pick, its score, and where it streams. Type <code>/together</code> to let everyone vote.","Add the Discord bot","https://goodwatch.app/discord"),
]
def badge(f): return f'<img src="{B.format(f[1], f[2])}" alt="{f[1].replace("%20"," ")}">'
def img(f, w="100%"): return f'<a href="{f[7]}"><img src=".github/readme/features/{f[0]}.avif" alt="{f[3]}: a scene from the GoodWatch intro" width="{w}"></a>'
def anchor(f): return re.sub(r"[^a-z0-9 -]", "", f[3].lower()).replace(" ", "-")

WHY = """## Why GoodWatch

You pay for more services than ever and still keep scrolling. GoodWatch finds the few titles that fit your taste and your evening.

"""
def summary(link_to):
    cells = []
    for f in F:
        t = f"[{f[3]}](#{link_to(f)})" if link_to else f[3]
        cells.append(f'{badge(f)}<br>\n**{t}**<br>\n{f[4]}')
    cells.append('&nbsp;<br>\n**[See how it works →](https://goodwatch.app/how-it-works)**<br>\nThe score, the match, and the taste analysis, explained.')
    rows = []
    for i in range(0, len(cells), 2):
        a, b = cells[i], cells[i+1]
        w = ' width="50%"' if i == 0 else ""
        rows.append(f'<tr>\n<td{w} valign="top">\n\n{a}\n\n</td>\n<td{w} valign="top">\n\n{b}\n\n</td>\n</tr>')
    return "<table>\n" + "\n".join(rows) + "\n</table>\n\n"

# A: summary, then one row per feature: picture left, big title + longer text right
def variant_a():
    s = WHY + summary(anchor) + "## A closer look\n\n<table>\n"
    for f in F:
        s += f'<tr>\n<td width="55%">{img(f)}</td>\n<td width="45%">\n\n### {f[3]}\n\n{f[5]}\n\n[{f[6]} →]({f[7]})\n\n</td>\n</tr>\n'
    return s + "</table>\n\n"

# B: summary holds all the words, then a two-column picture gallery with captions
def variant_b():
    s = WHY + summary(lambda f: "see-" + f[0]) + "## See it in action\n\n<table>\n"
    for i in range(0, len(F), 2):
        s += "<tr>\n"
        for f in F[i:i+2]:
            s += f'<td width="50%" align="center" valign="top"><a id="see-{f[0]}"></a>{img(f)}<br><b><a href="{f[7]}">{f[3]} →</a></b></td>\n'
        if len(F[i:i+2]) == 1:
            s += '<td width="50%" align="center" valign="middle"><b><a href="https://goodwatch.app/how-it-works">See how it works →</a></b></td>\n'
        s += "</tr>\n"
    return s + "</table>\n\n"

# C: one list; each feature opens to show its picture
def variant_c():
    s = WHY + "## What you get\n\n"
    for f in F:
        s += f'<details>\n<summary>&nbsp;<b>{f[3]}</b> · {f[4]}</summary>\n<br>\n<p align="center">{img(f, "80%")}</p>\n<p align="center">{f[5]} <a href="{f[7]}">{f[6]}&nbsp;→</a></p>\n</details>\n\n'
    return s + '<p><a href="https://goodwatch.app/how-it-works"><b>See how it works →</b></a></p>\n\n'

def nav(cur):
    names = [("A", "README.md", "summary + side by side"), ("B", "README-B.md", "summary + gallery"), ("C", "README-C.md", "summary that opens")]
    links = " · ".join(f"**{n}: {d}**" if n == cur else f"[{n}: {d}]({p})" for n, p, d in names)
    return f"> [!NOTE]\n> Prototype layouts: {links}\n\n"

for name, fn, cur in [("README.md", variant_a, "A"), ("README-B.md", variant_b, "B"), ("README-C.md", variant_c, "C")]:
    (root / name).write_text(nav(cur) + head + fn() + tail)
print("ok")
