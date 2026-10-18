# extra_requirements:
# beautifulsoup4==4.14.3
# crate==2.3.0
# pydantic==2.13.5
# wmill==1.817.0
"""Collect independent attention history; failures are isolated per source/scope."""
import datetime as dt
import gzip
import os
import time
from urllib.parse import urlparse

import requests

from f.buzz.signal_parsers import (tmdb_export, trakt_page, imdb_chart, letterboxd_chart,
    tmdb_link, flixpatrol_chart, flixpatrol_details)
from f.buzz.signal_store import SignalStore

UA = 'GoodWatchBuzz/1.0 (https://goodwatch.app; hello@goodwatch.app)'
SERVICES = ('netflix', 'amazon-prime', 'disney', 'hbo', 'apple-tv', 'hulu', 'paramount-plus')
SOURCES = ('tmdb_popularity', 'trakt_trending', 'trakt_watched_daily', 'imdb_moviemeter',
           'imdb_tvmeter', 'letterboxd_popular_week', 'flixpatrol_top10')


class SourceError(RuntimeError):
    pass


class Http:
    """Sequential >=1s spacing (<300 GET/5min); stop on 429, no challenge retries."""
    def __init__(self, session=None, sleep=time.sleep):
        self.session = session or requests.Session()
        self.session.headers.update({'User-Agent': UA})
        self.sleep = sleep
        self.blocked_hosts = set()

    def get(self, url, **kwargs):
        host = urlparse(url).netloc
        if host in self.blocked_hosts:
            raise SourceError('Host blocked earlier in this run')
        self.sleep(1)
        try:
            response = self.session.get(url, timeout=(10, 120), **kwargs)
        except requests.RequestException:
            raise SourceError('Transport failure') from None
        if response.status_code != 200:
            code = response.status_code
            if code == 429:
                self.blocked_hosts.add(host)
            response.close()
            raise SourceError(f'HTTP {code}; no retry this run')
        return response


class Collector:
    def __init__(self, store, *, http=None, trakt_id=None, now=None):
        self.store = store
        self.http = http or Http()
        self.trakt_id = trakt_id
        self.now = now or dt.datetime.now(dt.timezone.utc)
        self.errors = []
        self.detail_budget = {'letterboxd': 5, 'flixpatrol': 5}
        self.blocked_details = set()

    def attempt(self, scope, fn):
        try:
            return fn()
        except Exception as exc:
            # Exception strings from DB/network libraries can contain credentials.
            message = str(exc) if isinstance(exc, SourceError) else type(exc).__name__
            self.errors.append({'scope': scope, 'error': message})
            return []

    def tmdb(self, day):
        candidates = self.store.cohort()
        rows = []
        for kind, dump in [('movie', 'movie_ids'), ('tv', 'tv_series_ids')]:
            def fetch():
                # Same export path/date convention as tmdb_daily's request_url;
                # avoid its Mongo availability tracker and redundant HEAD request.
                url = f'https://files.tmdb.org/p/exports/{dump}_{day:%m_%d_%Y}.json.gz'
                with self.http.get(url, stream=True) as response:
                    with gzip.GzipFile(fileobj=response.raw) as data:
                        return tmdb_export(data, kind, candidates)
            rows.extend(self.attempt(kind, fetch))
        return rows

    def trakt(self, watched=False):
        rows = []
        for kind, plural in [('movie', 'movies'), ('tv', 'shows')]:
            def fetch():
                path = 'watched/daily' if watched else 'trending'
                # Bounded 1,000 entries per media kind, respecting pagination headers.
                for page in range(1, 11):
                    with self.http.get(f'https://api.trakt.tv/{plural}/{path}',
                        params={'page': page, 'limit': 100}, headers={'trakt-api-key': self.trakt_id,
                        'trakt-api-version': '2'}) as response:
                        payload = response.json()
                        rows.extend(trakt_page(payload, kind, (page-1)*100))
                        if not payload or page >= int(response.headers.get('X-Pagination-Page-Count', page)):
                            break
                return []
            self.attempt(kind, fetch)
        unique = {}
        for row in rows:
            unique.setdefault(row['title_key'], row)
        return list(unique.values())

    def imdb(self, kind):
        chart = 'moviemeter' if kind == 'movie' else 'tvmeter'
        with self.http.get(f'https://www.imdb.com/chart/{chart}/') as response:
            rows = imdb_chart(response.text)
        mapping = self.store.imdb([r['source_id'] for r in rows], kind)
        return [dict(r, title_key=mapping.get(r['source_id'], 'unmapped:imdb:'+r['source_id'])) for r in rows]

    def resolve(self, source, slug, kind):
        cached = self.store.mapping(source, slug)
        if cached is not None:
            return cached['title_key']
        if not self.detail_budget[source] or source in self.blocked_details:
            return None
        self.detail_budget[source] -= 1
        url = f'https://letterboxd.com/film/{slug}/' if source == 'letterboxd' else f'https://flixpatrol.com/title/{slug}/'
        try:
            with self.http.get(url) as response:
                html = response.text
            key = tmdb_link(html, 'movie' if source == 'letterboxd' else None)
            detail = {}
            if source == 'flixpatrol' and not key:
                name, year, detail_kind = flixpatrol_details(html)
                detail = dict(title=name, year=year, kind=detail_kind)
                key = self.store.catalog_match(name, year, detail_kind) if detail_kind == kind else None
            # Cache successful fetches including no-match; a film page is fetched once.
            self.store.save_mapping(source, slug, key, detail, self.now)
            return key
        except SourceError:
            self.blocked_details.add(source)
            raise

    def letterboxd(self):
        rows = []
        seen = set()
        for page in range(1, 4):
            def fetch():
                with self.http.get(f'https://letterboxd.com/films/popular/this/week/page/{page}/') as response:
                    return letterboxd_chart(response.text, (page-1)*72)
            parsed = self.attempt('page:'+str(page), fetch)
            if not parsed:
                break
            for row in parsed:
                if row['source_id'] in seen:
                    continue
                seen.add(row['source_id'])
                key = self.attempt('mapping:'+row['source_id'], lambda: self.resolve('letterboxd', row['source_id'], 'movie'))
                rows.append(dict(row, title_key=key or 'unmapped:letterboxd:'+row['source_id']))
        return rows

    def flixpatrol(self, day):
        entries = []
        for service in SERVICES:
            def fetch():
                with self.http.get(f'https://flixpatrol.com/top10/{service}/united-states/{day.isoformat()}/') as response:
                    return flixpatrol_chart(response.text, service)
            entries.extend(self.attempt(service, fetch))
        grouped = {}
        for row in entries:
            key = self.attempt('mapping:'+row['source_id'], lambda: self.resolve('flixpatrol', row['source_id'], row['kind']))
            key = key or 'unmapped:flixpatrol:'+row['source_id']
            item = grouped.setdefault(key, dict(title_key=key, rank=row['rank'], value=0.0, raw={'charts': []}))
            item['rank'] = min(item['rank'], row['rank'])
            item['value'] += 11-row['rank']
            item['raw']['charts'].append(row['raw'])
        return list(grouped.values())

    def collect(self, source, day):
        self.errors = []
        if source.startswith('trakt_') and not self.trakt_id:
            return [], {'status': 'needs_owner', 'message': 'Missing u/Alp/TRAKT_CLIENT_ID'}
        funcs = {'tmdb_popularity': lambda: self.tmdb(day),
            'trakt_trending': lambda: self.trakt(), 'trakt_watched_daily': lambda: self.trakt(True),
            'imdb_moviemeter': lambda: self.imdb('movie'), 'imdb_tvmeter': lambda: self.imdb('tv'),
            'letterboxd_popular_week': self.letterboxd, 'flixpatrol_top10': lambda: self.flixpatrol(day)}
        rows = self.attempt(source, funcs[source])
        mapped = sum(not r['title_key'].startswith('unmapped:') for r in rows)
        return rows, dict(status=('partial' if rows else 'blocked') if self.errors else ('works' if rows else 'empty'),
            rows=len(rows), mapped=mapped, unmapped=len(rows)-mapped, errors=self.errors[:30])


def run(store, *, now=None, sources=SOURCES, http=None, trakt_id=None, day=None):
    now = now or dt.datetime.now(dt.timezone.utc)
    day = day or now.date()
    if day != now.date() and any(s != 'tmdb_popularity' for s in sources):
        raise ValueError('Only TMDB exports support historical collection')
    store.initialize()
    collector = Collector(store, http=http, trakt_id=trakt_id, now=now)
    result = {'day': day.isoformat(), 'sources': {}}
    for source in sources:
        rows, status = collector.collect(source, day)
        try:
            store.save(source, day.isoformat(), rows, now)
            store.status(source, day.isoformat(), status, now)
        except Exception as exc:
            status = dict(status='storage_error', error=type(exc).__name__)
        result['sources'][source] = status
    return result


def main():
    import wmill
    from f.db.cratedb import CrateConnector
    trakt_id = os.environ.get('TRAKT_CLIENT_ID')
    if not trakt_id:
        try:
            trakt_id = wmill.get_variable('u/Alp/TRAKT_CLIENT_ID')
        except Exception:
            pass
    crate = CrateConnector()
    try:
        return run(SignalStore(crate), trakt_id=trakt_id)
    finally:
        crate.disconnect()
