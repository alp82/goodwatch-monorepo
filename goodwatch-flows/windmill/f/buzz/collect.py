"""Public signal adapters, reusing the #543 collector's identity and API logic."""
import csv
import datetime as dt
from email.utils import parsedate_to_datetime
import io
import gzip
import zlib
import urllib3
import time
from urllib.parse import quote, unquote

import requests

UA = 'GoodWatchBuzz/1.0 (https://goodwatch.app; hello@goodwatch.app) issue-555'
NETFLIX_URL = 'https://www.netflix.com/tudum/top10/data/all-weeks-global.tsv'


def iso_day(value):
    if value is None:
        return None
    if isinstance(value, (float, int)):
        return dt.datetime.fromtimestamp(value / 1000, dt.timezone.utc).date().isoformat()
    return str(value)[:10]


def reason_hints(title, details, netflix, day):
    """Context hints, never causal claims. Exclude events after the scored day."""
    hints = []
    tmdb_url = f"https://www.themoviedb.org/{title['kind']}/{title['tmdb_id']}"

    def add(kind, date, source, **extra):
        if date and 0 <= (day - dt.date.fromisoformat(date)).days < 14:
            hints.append(dict(kind=kind, event_day=date, source_url=source, **extra))

    add('new_release', title.get('release_date'), tmdb_url, evidence='TMDB release/first-air date; context only')
    for season in details.get('seasons', []):
        if season.get('season_number', 0) > 1:
            add('new_season', season.get('air_date'), tmdb_url, season_number=season['season_number'])
    for video in details.get('videos', {}).get('results', []):
        if video.get('type') == 'Trailer' and video.get('official') and video.get('site') == 'YouTube':
            add('trailer', iso_day(video.get('published_at')), f"https://www.youtube.com/watch?v={video['key']}")
    available = [r for r in netflix if r['available_from'] <= day.isoformat()]
    latest = max((r['week'] for r in available), default=None)
    for row in available:
        if row['week'] == latest and row.get('title_key') == title['title_key'] and (day - dt.date.fromisoformat(row['available_from'])).days < 14:
            # The chart's week ends Sunday; Tuesday is the publication boundary.
            hints.append(dict(kind='netflix_top10', event_day=row['available_from'], week=row['week'],
                              rank=int(row['weekly_rank']), season=row.get('season_title'), source_url=NETFLIX_URL,
                              evidence='Provisional exact case-insensitive title/category; unique in catalog; context only'))
    return hints


class Signals:
    def __init__(self, tmdb_key, *, session=None, sleep=time.sleep):
        self.tmdb_key = tmdb_key
        self.http = session or requests.Session()
        self.http.headers.update({'User-Agent': UA})
        self.sleep = sleep

    def get(self, url, *, params=None, allow_missing=False):
        """Sequential, identifying UA, <=2 req/sec; bounded transient retries.

        Never expose authenticated TMDB URLs in exception/log text.
        """
        for attempt in range(4):
            try:
                response = self.http.get(url, params=params, timeout=(10, 100))
            except requests.RequestException:
                if attempt == 3:
                    raise RuntimeError('Signal transport failed after four attempts') from None
                self.sleep(5 * (attempt + 1))
                continue
            finally:
                self.sleep(0.5)
            if response.status_code == 404 and allow_missing:
                return None
            if response.status_code in (429, 500, 502, 503, 504):
                if attempt == 3:
                    break
                delay = response.headers.get('Retry-After', '')
                try:
                    wait = float(delay)
                except ValueError:
                    wait = max(0, (parsedate_to_datetime(delay) - dt.datetime.now(dt.timezone.utc)).total_seconds()) if delay else 10 * (attempt + 1)
                self.sleep(min(max(wait, 0), 300))
                continue
            if not response.ok:
                raise RuntimeError(f'Signal HTTP {response.status_code}')
            return response
        raise RuntimeError(f'Signal HTTP {response.status_code} after four attempts')

    @staticmethod
    def dump_urls(day):
        # Filenames mark the END of the hour, including next month's/year's 00:00.
        start = dt.datetime.combine(day, dt.time())
        return [f'https://dumps.wikimedia.org/other/pageviews/{hour:%Y/%Y-%m}/pageviews-{hour:%Y%m%d-%H}0000.gz'
                for hour in (start + dt.timedelta(hours=i) for i in range(1, 25))]

    def dump_request(self, url, *, head=False, deadline):
        for attempt in range(4):
            if time.monotonic() >= deadline:
                raise TimeoutError('Wikipedia dump time budget exhausted')
            response = None
            try:
                method = self.http.head if head else self.http.get
                response = method(url, stream=True, timeout=(10, 30))
                if response.status_code == 404:
                    response.close()
                    return None
                if response.status_code not in (429, 500, 502, 503, 504):
                    if not response.ok:
                        raise RuntimeError(f'Dump HTTP {response.status_code}')
                    return response
                delay = response.headers.get('Retry-After', '')
                try:
                    wait = float(delay)
                except ValueError:
                    wait = max(0, (parsedate_to_datetime(delay) - dt.datetime.now(dt.timezone.utc)).total_seconds()) if delay else 10 * (attempt + 1)
            except requests.RequestException:
                wait = 5 * (attempt + 1)
            finally:
                if response is not None and not response.ok:
                    response.close()
                self.sleep(0.5)
            if attempt < 3:
                self.sleep(min(max(wait, 0), 300, max(0, deadline - time.monotonic())))
        raise RuntimeError('Dump request failed after four attempts')

    def dumps_available(self, day):
        deadline = time.monotonic() + 180
        for url in self.dump_urls(day):
            response = self.dump_request(url, head=True, deadline=deadline)
            if response is None:
                return False
            response.close()
        return True

    def dump_pageviews(self, articles, day):
        """Stream complete user-only hourly files; never persist partial-day totals.

        Producer filters agent_type='user'. en/en.m include app traffic too.
        Titles in the dump are already URL-decoded DBkeys; do not unquote twice.
        """
        names = {article: unquote(article.split('/wiki/', 1)[1]).replace(' ', '_').encode('utf-8')
                 for article in articles}
        totals = dict.fromkeys(names.values(), 0)
        deadline = time.monotonic() + 1200
        for url in self.dump_urls(day):
            for attempt in range(3):
                response = self.dump_request(url, deadline=deadline)
                if response is None:
                    return None
                hourly = dict.fromkeys(totals, 0)
                try:
                    with gzip.GzipFile(fileobj=response.raw) as stream:
                        while True:
                            if time.monotonic() >= deadline:
                                raise TimeoutError('Wikipedia dump time budget exhausted')
                            line = stream.readline(65537)
                            if not line:
                                break
                            if len(line) > 65536:
                                raise ValueError('Oversized dump line')
                            fields = line.split()
                            if len(fields) != 4:
                                raise ValueError('Malformed dump line')
                            if fields[0] in (b'en', b'en.m') and fields[1] in hourly:
                                count = int(fields[2])
                                if count < 0:
                                    raise ValueError('Negative dump count')
                                hourly[fields[1]] += count
                    break
                except TimeoutError:
                    raise
                except (OSError, EOFError, zlib.error, requests.RequestException, urllib3.exceptions.HTTPError):
                    if attempt == 2:
                        raise RuntimeError('Incomplete Wikipedia dump after three attempts') from None
                finally:
                    response.close()
            for name, count in hourly.items():
                totals[name] += count
        return {article: totals[name] for article, name in names.items()}

    def trending(self):
        lists = {}
        for kind in ('movie', 'tv'):
            rows, seen = [], set()
            for page in range(1, 6):
                response = self.get(f'https://api.themoviedb.org/3/trending/{kind}/day',
                                    params={'api_key': self.tmdb_key, 'page': page})
                payload = response.json()
                for row in payload['results']:
                    if row['id'] not in seen:
                        seen.add(row['id'])
                        rows.append(row)
                if page >= payload.get('total_pages', 5):
                    break
            lists[kind] = rows
        return lists

    def mappings(self, titles):
        matches = {}
        for kind, prop in (('movie', 'P4947'), ('tv', 'P4983')):
            cohort = [t for t in titles if t['kind'] == kind]
            for offset in range(0, len(cohort), 100):
                batch = cohort[offset:offset + 100]
                ids = ' '.join(f'"{int(t["tmdb_id"])}"' for t in batch)
                query = f'''SELECT ?tmdb ?item ?article WHERE {{ VALUES ?tmdb {{ {ids} }}
                  ?item wdt:{prop} ?tmdb . OPTIONAL {{ ?article schema:about ?item;
                  schema:isPartOf <https://en.wikipedia.org/> . }} }}'''
                started = time.monotonic()
                response = self.get('https://query.wikidata.org/sparql', params={'query': query, 'format': 'json'})
                for row in response.json()['results']['bindings']:
                    key = f"{kind}:{row['tmdb']['value']}"
                    matches.setdefault(key, []).append((row['item']['value'].rsplit('/', 1)[-1],
                                                       row.get('article', {}).get('value')))
                # Stay below the WDQS per-minute processing budget without parallel queries.
                self.sleep(max(1, time.monotonic() - started))
        output = {}
        for title in titles:
            candidates = matches.get(title['title_key'], [])
            urls = {url for _, url in candidates if url}
            article = next(iter(urls)) if len(urls) == 1 else None
            output[title['title_key']] = dict(article=article,
                qid=next((qid for qid, url in candidates if url == article), None) if article else None,
                mapping_status='matched' if article else 'ambiguous' if urls else 'no-enwiki')
        return output

    def pageviews(self, article, start, end):
        name = unquote(article.split('/wiki/', 1)[1])
        url = f'https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia.org/all-access/user/{quote(name, safe="")}/daily/{start:%Y%m%d}00/{end:%Y%m%d}00'
        response = self.get(url, allow_missing=True)
        if response is None:
            return {}
        result = {}
        for row in response.json()['items']:
            day = dt.datetime.strptime(row['timestamp'][:8], '%Y%m%d').date()
            views = row['views']
            if start <= day <= end and isinstance(views, int) and views >= 0:
                result[day.isoformat()] = views
        return result

    def details(self, title):
        response = self.get(f"https://api.themoviedb.org/3/{title['kind']}/{title['tmdb_id']}",
                            params={'api_key': self.tmdb_key, 'append_to_response': 'videos'}, allow_missing=True)
        return response.json() if response is not None else {}

    def netflix(self, catalog_names):
        """Reject remakes/homonyms across the full catalog, not just our small pool."""
        response = self.get(NETFLIX_URL)
        chart = list(csv.DictReader(io.StringIO(response.content.decode('utf-8-sig')), delimiter='\t'))
        names = {kind: sorted({r['show_title'].lower() for r in chart if ('movie' if 'Films' in r['category'] else 'tv') == kind})
                 for kind in ('movie', 'tv')}
        index = {}
        for title in catalog_names(names):
            for name in {title.get('title'), title.get('original_title')} - {None, ''}:
                index.setdefault((title['kind'], name.lower()), set()).add(title['title_key'])
        rows = []
        for row in chart:
            kind = 'movie' if 'Films' in row['category'] else 'tv'
            keys = index.get((kind, row['show_title'].lower()), set())
            rows.append(dict(row, available_from=(dt.date.fromisoformat(row['week']) + dt.timedelta(days=2)).isoformat(),
                             title_key=next(iter(keys)) if len(keys) == 1 else None))
        return rows
