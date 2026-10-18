# extra_requirements:
# beautifulsoup4==4.14.3
"""Pure parsers: source identities survive failed/ambiguous TMDB mapping."""
import json
import math
import re
from bs4 import BeautifulSoup


def tmdb_export(lines, kind, candidates=(), floor=5.0, cap=20000):
    import heapq
    cohort, popular = [], []
    for line in lines:
        if not line.strip():
            continue
        row = json.loads(line)
        value = float(row['popularity'])
        if not math.isfinite(value) or value < 0:
            raise ValueError('Invalid export popularity')
        key = f"{kind}:{int(row['id'])}"
        item = dict(title_key=key, value=value, rank=None, raw=row)
        if key in candidates:
            cohort.append(item)
        elif value >= floor:
            entry = (value, int(row['id']), item)
            if len(popular) < cap:
                heapq.heappush(popular, entry)
            elif entry[:2] > popular[0][:2]:
                heapq.heapreplace(popular, entry)
    return cohort + [x[2] for x in sorted(popular, key=lambda x: (-x[0], x[1]))]


def trakt_page(payload, kind, offset=0):
    if not isinstance(payload, list):
        raise ValueError('Expected Trakt list')
    result = []
    for rank, raw in enumerate(payload, offset + 1):
        ids = raw['movie' if kind == 'movie' else 'show']['ids']
        key = f"{kind}:{int(ids['tmdb'])}" if ids.get('tmdb') else f"unmapped:trakt:{kind}:{ids['trakt']}"
        result.append(dict(title_key=key, rank=rank, value=float(raw['watchers'] if 'watchers' in raw else raw['watcher_count']), raw=raw))
    return result


def walk(value):
    if isinstance(value, dict):
        yield value
        for child in value.values():
            yield from walk(child)
    elif isinstance(value, list):
        for child in value:
            yield from walk(child)


def imdb_chart(html):
    soup = BeautifulSoup(html, 'html.parser')
    rows = {}
    # NEXT_DATA has meterRank/currentRank/rankChange. JSON-LD is a rank-only fallback.
    scripts = sorted(soup.find_all('script'), key=lambda s: s.get('id') != '__NEXT_DATA__')
    for script in scripts:
        if script.get('id') != '__NEXT_DATA__' and script.get('type') != 'application/ld+json':
            continue
        try:
            payload = json.loads(script.string or script.get_text())
        except (ValueError, TypeError):
            continue
        for node in walk(payload):
            imdb_id = node.get('id', '')
            meter = node.get('meterRanking') or {}
            if re.fullmatch(r'tt\d+', str(imdb_id)) and meter.get('currentRank'):
                rows.setdefault(imdb_id, dict(source_id=imdb_id, rank=int(meter['currentRank']),
                    value=None, raw={'imdb_id': imdb_id, 'rank_change': meter.get('rankChange'), 'meterRanking': meter}))
            if node.get('@type') == 'ListItem' and node.get('position'):
                item = node.get('item') or {}
                match = re.search(r'/title/(tt\d+)', item.get('url', '') if isinstance(item, dict) else str(item))
                if match:
                    iid = match[1]
                    rows.setdefault(iid, dict(source_id=iid, rank=int(node['position']), value=None,
                        raw={'imdb_id': iid, 'rank_change': None, 'item': item}))
    if not rows:
        raise ValueError('IMDb chart JSON missing (challenge or changed markup)')
    return sorted(rows.values(), key=lambda r: r['rank'])


def letterboxd_chart(html, offset=0):
    soup = BeautifulSoup(html, 'html.parser')
    rows = []
    seen = set()
    for tag in soup.select('[data-film-slug], [data-item-slug], [data-target-link]'):
        slug = tag.get('data-film-slug') or tag.get('data-item-slug')
        if not slug:
            match = re.fullmatch(r'/film/([^/]+)/?', tag.get('data-target-link', ''))
            slug = match[1] if match else None
        if not slug or slug in seen:
            continue
        seen.add(slug)
        rows.append(dict(source_id=slug, rank=offset+len(rows)+1, value=None, raw={'slug': slug}))
    if not rows:
        raise ValueError('Letterboxd posters missing (challenge or changed markup)')
    return rows


def tmdb_link(html, default_kind=None):
    soup = BeautifulSoup(html, 'html.parser')
    matches = set()
    for tag in soup.select('[data-tmdb-id]'):
        value = tag.get('data-tmdb-id', '')
        kind = tag.get('data-tmdb-type', default_kind)
        if value.isdigit() and kind in ('movie', 'tv'):
            matches.add(f'{kind}:{int(value)}')
    for anchor in soup.select('a[href]'):
        match = re.match(r'https?://(?:www\.)?themoviedb\.org/(movie|tv)/(\d+)(?:\D|$)', anchor['href'])
        if match:
            matches.add(f'{match[1]}:{int(match[2])}')
    return next(iter(matches)) if len(matches) == 1 else None


def flixpatrol_chart(html, service):
    soup = BeautifulSoup(html, 'html.parser')
    rows = []
    # Charts are separate movie/tv sections; never infer kind from a title's name.
    for table in soup.find_all('table'):
        section = table.find_parent(id=re.compile(r'(movie|tv|show)', re.I))
        heading = table.find_previous(['h2', 'h3'])
        context = ((section.get('id', '') if section else '') + ' ' + (heading.get_text(' ', strip=True) if heading else '')).lower()
        kind = 'movie' if 'movie' in context else 'tv' if ('tv' in context or 'show' in context) else None
        if not kind:
            continue
        for tr in table.select('tr'):
            anchor = tr.select_one('a[href^="/title/"]')
            if not anchor:
                continue
            cells = tr.select('td')
            match = re.search(r'\b(\d{1,2})\b', cells[0].get_text() if cells else '')
            if not match or not 1 <= int(match[1]) <= 10:
                continue
            slug = anchor['href'].strip('/').split('/')[1]
            rows.append(dict(source_id=slug, kind=kind, rank=int(match[1]),
                raw={'slug': slug, 'service': service, 'region': 'united-states', 'kind': kind,
                     'rank': int(match[1]), 'title': anchor.get_text(' ', strip=True)}))
    if not rows:
        raise ValueError('FlixPatrol chart tables missing (challenge or changed markup)')
    return rows


def flixpatrol_details(html):
    soup = BeautifulSoup(html, 'html.parser')
    for script in soup.select('script[type="application/ld+json"]'):
        try:
            payload = json.loads(script.string or script.get_text())
        except (ValueError, TypeError):
            continue
        for node in walk(payload):
            if node.get('@type') in ('Movie', 'TVSeries'):
                year = str(node.get('datePublished', ''))[:4]
                return node.get('name'), int(year) if year.isdigit() else None, 'movie' if node['@type'] == 'Movie' else 'tv'
    return None, None, None


def justwatch_chart(payload):
    """US streaming ranks, preserving chart metadata and native identities."""
    rows = []
    for edge in payload['data']['popularTitles']['edges']:
        node = edge['node']
        kind = {'MOVIE': 'movie', 'SHOW': 'tv'}.get(node.get('objectType'))
        content = node.get('content') or {}
        tmdb = (content.get('externalIds') or {}).get('tmdbId')
        # The live API sends the id as text ("213562").
        if isinstance(tmdb, str) and tmdb.isdigit():
            tmdb = int(tmdb)
        if not kind or not isinstance(tmdb, int) or isinstance(tmdb, bool) or tmdb <= 0:
            continue
        charts = (node.get('streamingCharts') or {}).get('edges', [])
        # Do not guess which chart is daily when the server returns several.
        if len(charts) != 1:
            continue
        info = charts[0].get('streamingChartInfo') or {}
        rank = info.get('rank')
        if not isinstance(rank, int) or isinstance(rank, bool) or rank <= 0:
            continue
        rows.append(dict(title_key=f'{kind}:{tmdb}', rank=rank, value=1/rank,
                         raw=dict(info, country='US', id=node.get('id'), title=content.get('title'))))
    return rows
