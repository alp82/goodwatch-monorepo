import gzip, re, subprocess, json, sys
W = '/tmp/claude-1000/-home-alper-projects-goodwatch-monorepo/7f9e2bb2-bb2a-433e-a8b1-384429bfb7a7/scratchpad/splinks-work'
HUBS = ["/discover", "/movies", "/shows", "/explorer", "/taste", "/how-it-works", "/movies/moods", "/shows/moods", "/movies/genres", "/shows/genres", "/movies/streaming", "/shows/streaming"]
def fetch(q):
    # No cookies, three fetches: the smallest gzip size (the HTML carries per-request ids).
    best = None
    for _ in range(3):
        html = subprocess.run(['curl', '-s', f'http://localhost:5391/{q}'], capture_output=True).stdout
        size = len(gzip.compress(html, 6))
        if best is None or size < best[1]: best = (html, size)
    return best
base, base_gz = fetch('?bar=0')
rows = []
for v in [None, 'strip', 'scroll', 'scroll2', 'tv']:
    html, gz = (base, base_gz) if v is None else fetch(f'?links={v}&bar=0')
    text = html.decode()
    hrefs = re.findall(r'<a\b[^>]*\bhref="([^"]+)"', text)
    titles = [h for h in hrefs if re.match(r'^/(movie|show)/\d', h)]
    hubs = [h for h in hrefs if h in HUBS]
    # Hub links that are not in the visually hidden nav (today's sr-only block) or the header/footer: counted by variant markup below.
    rows.append({
        'variant': v or 'today',
        'raw_bytes': len(html), 'gzip_bytes': gz, 'added_gzip': gz - base_gz, 'added_raw': len(html) - len(base),
        'title_links_unique': len(set(titles)), 'title_link_tags': len(titles),
        'hub_links_unique': len(set(hubs)), 'hub_link_tags': len(hubs),
        'hubs_missing': [h for h in HUBS if h not in hubs],
        'img_tags': len(re.findall(r'<img\b', text)),
        'tmdb_img_tags': len(re.findall(r'<img\b[^>]*image\.tmdb\.org', text)),
    })
    open(f'{W}/{v or "today"}.html', 'wb').write(html)
print(json.dumps(rows, indent=1))
