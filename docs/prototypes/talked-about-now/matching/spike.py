#!/usr/bin/env python3
"""THROWAWAY #544. Explicit read-only HTTP adapters; never import app/cache clients."""
import argparse
import asyncio
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone, timedelta
from email.utils import parsedate_to_datetime
import gzip
import hashlib
import html
import json
import os
from pathlib import Path
import random
import re
import time
import unicodedata
from urllib.parse import urlencode
import xml.etree.ElementTree as ET

import requests
from dotenv import dotenv_values

HERE = Path(__file__).resolve().parent
DATA = HERE / 'data'
ENV = dict(dotenv_values(os.environ.get('MATCHING_ENV_FILE', str(HERE.parents[3] / 'goodwatch-webapp/.env')))) | dict(os.environ)
UA = {'User-Agent': 'GoodWatch-title-matching-research/0.1 (issue 544)'}
CHANNELS = {
    'Universal Pictures': 'UCq0OueAsdxH6b8nyAspwViw',
    'Warner Bros.': 'UCjmJDM5pRKbUlVIzDYYWb6g',
    'Sony Pictures': 'UCz97F7dMxBNOfGYu3rx8aCw',
    'A24': 'UCuPivVjnfNo4mb3Oog_frZg',
    'NEON': 'UCpy5dRhZd-JbZP4NsrnLt1w',
    'Constantin Film': 'UC51KZjUZokzJfb08mzAGS2A',
    'Disney+': 'UCIrgJInjLS2BhlHOMDW7v0g',
}
FEEDS = [
    'https://variety.com/feed/', 'https://variety.com/v/film/feed/',
    'https://deadline.com/feed/', 'https://deadline.com/v/film/feed/',
    'https://www.hollywoodreporter.com/feed/', 'https://www.hollywoodreporter.com/c/movies/feed/',
    'https://www.indiewire.com/feed/', 'https://collider.com/feed/',
    'https://screenrant.com/feed/', 'https://www.slashfilm.com/feed/',
    'https://www.denofgeek.com/feed/', 'https://www.filmstarts.de/rss/nachrichten.xml',
    'https://www.filmstarts.de/rss/filme-nachrichten.xml', 'https://www.filmstarts.de/rss/serien-nachrichten.xml',
    'https://www.moviepilot.de/news.rss', 'https://www.film-rezensionen.de/feed/',
    'https://www.epd-film.de/rss.xml', 'https://about.netflix.com/en/feed.xml',
    'https://about.netflix.com/de/feed.xml',
]
FILMISH = re.compile(r'\b(movie|movies|film|films|cinema|cinematic|trailer|tv|television|series|sitcom|episode|episodes|netflix|hulu|disney|hbo|actor|actress|director|screenplay|box office|filme|kino|serie|serien)\b', re.I)

def dump(name, obj):
    DATA.mkdir(exist_ok=True)
    temporary=DATA / (name+'.local.tmp')
    if name in {'bluesky.json','candidate-catalog.json','evaluation.json','predictions.json'}:
        # One record per line keeps bulk evidence diffs bounded and still readable.
        contents='[\n'+',\n'.join(json.dumps(row,ensure_ascii=False) for row in obj)+'\n]\n'
    else:contents=json.dumps(obj, ensure_ascii=False, indent=2)+'\n'
    temporary.write_text(contents)
    temporary.replace(DATA / name)

def load(name):
    return json.loads((DATA / name).read_text())

def plain(text):
    return html.unescape(re.sub('<[^>]+>', ' ', text or '')).strip()

def feed_date(value):
    try:return parsedate_to_datetime(value)
    except ValueError:
        try:return datetime.fromisoformat(value.replace('Z','+00:00'))
        except ValueError:
            value=re.sub(r'^(\d+)\.',r'\1',value)
            for de,en in {'Januar':'January','Februar':'February','März':'March','Mai':'May','Juni':'June','Juli':'July','Oktober':'October','Dezember':'December'}.items():
                value=value.replace(de,en)
            return datetime.strptime(value,'%d %B %Y').replace(tzinfo=timezone.utc)

def norm(text):
    text = unicodedata.normalize('NFKD', text).encode('ascii', 'ignore').decode().lower()
    return re.sub(r'[^a-z0-9]+', ' ', text).strip()

def crate(sql, args=None):
    # The only SQL entry point rejects mutations. No production imports or Redis.
    if not sql.lstrip().upper().startswith('SELECT '):
        raise ValueError('SELECT only')
    host = ENV['CRATE_HOSTS'].split(',')[0]
    if not host.startswith('http'): host = 'http://' + host
    if ':' not in host.split('//')[1]: host += ':' + ENV.get('CRATE_PORT', '4200')
    response = requests.post(host.rstrip('/') + '/_sql', auth=(ENV['CRATE_USER'], ENV['CRATE_PASS']),
                             json={'stmt': sql, 'args': args or []}, timeout=180)
    response.raise_for_status()
    body = response.json()
    return [dict(zip(body['cols'], row)) for row in body['rows']]

def qdrant(path, body=None):
    # POST is used only for the read-only query/retrieve endpoints.
    if path not in ('/points/query', '/points'):
        raise ValueError('Qdrant read endpoint not allowed')
    base = ENV['QDRANT_URL'].rstrip('/').replace(':6334', ':6333')
    r = requests.post(base + '/collections/media_fingerprint_v1' + path,
                      headers={'api-key': ENV.get('QDRANT_API_KEY', '')}, json=body, timeout=60)
    r.raise_for_status()
    return r.json()['result']

def feeds():
    now = datetime.now(timezone.utc)
    audit, items = [], []
    def fetch(pair):
        source, url = pair
        r = requests.get(url, headers=UA, timeout=45)
        info = {'source': source, 'url': url, 'status': r.status_code, 'fetched_at': now.isoformat()}
        rows = []
        try:
            r.raise_for_status(); root = ET.fromstring(r.content)
            if source in CHANNELS:
                ns = {'a': 'http://www.w3.org/2005/Atom', 'yt': 'http://www.youtube.com/xml/schemas/2015', 'm': 'http://search.yahoo.com/mrss/'}
                for e in root.findall('a:entry', ns)[:8]:
                    key = e.findtext('yt:videoId', namespaces=ns)
                    rows.append({'source': 'youtube', 'publisher': source, 'channel_id': CHANNELS[source],
                                 'source_id': key, 'url': 'https://www.youtube.com/watch?v=' + key,
                                 'published_at': e.findtext('a:published', namespaces=ns),
                                 'text': e.findtext('a:title', namespaces=ns),
                                 'context': plain(e.findtext('m:group/m:description', default='', namespaces=ns))[:1800]})
            else:
                for e in root.findall('.//item'):
                    raw_date=e.findtext('pubDate'); date = feed_date(raw_date)
                    if date.tzinfo is None: date = date.replace(tzinfo=timezone.utc)
                    if not now - timedelta(days=1) <= date <= now: continue
                    url_item = e.findtext('link')
                    rows.append({'source': 'rss', 'publisher': source, 'source_id': url_item, 'url': url_item,
                                 'published_at': date.isoformat(), 'text': plain(e.findtext('title')),
                                 'published_at_precision': 'timestamp' if ':' in raw_date else 'day',
                                 'context': plain(e.findtext('description'))[:1800]})
            info['items_in_window'] = len(rows)
        except Exception as exc: info['error'] = type(exc).__name__
        return info, rows
    pairs = [(name, 'https://www.youtube.com/feeds/videos.xml?channel_id=' + channel) for name, channel in CHANNELS.items()]
    pairs += [(url.split('/')[2], url) for url in FEEDS]
    with ThreadPoolExecutor(max_workers=5) as pool:
        for info, rows in pool.map(fetch, pairs):
            audit.append(info); items.extend(rows)
    unique = {x['url']: x for x in items}
    # 7 channels × 7 newest plus one eighth item = 50, where feeds succeed.
    yt = [x for x in unique.values() if x['source'] == 'youtube']
    rss = [x for x in unique.values() if x['source'] == 'rss']
    yt.sort(key=lambda x: x['published_at'], reverse=True)
    dump('feeds.json', yt[:50] + rss)
    dump('feeds-audit.json', {'window_start': (now-timedelta(days=1)).isoformat(), 'window_end': now.isoformat(), 'feeds': audit})
    print('Feeds:', len(yt[:50]), 'YouTube,', len(rss), 'unique RSS', flush=True)

async def jetstream(hours, resume=False):
    import websockets
    end = datetime.now(timezone.utc); start = end - timedelta(hours=hours)
    cursor = int(start.timestamp() * 1e6)
    uri = 'wss://jetstream.us-west.bsky.network/xrpc/network.bsky.jetstream.subscribeEvents?'
    stats = {'requested_start': start.isoformat(), 'requested_end': end.isoformat(), 'frames': 0, 'bytes': 0, 'creates': 0, 'reconnects': 0}
    rows = {}; first = None; last = None; wall = time.monotonic()
    if resume:
        state=load('jetstream-resume.local.json')
        start=datetime.fromisoformat(state['requested_start']);end=datetime.fromisoformat(state['requested_end'])
        cursor=int(datetime.fromisoformat(state['resume_at']).timestamp()*1e6)
        stats |= state
        rows={x['source_id']:x for x in load('bluesky.partial.local.json')
              if start <= datetime.fromisoformat(x['published_at'].replace('Z','+00:00')) <= end}
    done = False
    old_stamp=None; old_count=0
    while not done:
        try:
            async with websockets.connect(uri + urlencode({'collections': 'app.bsky.feed.post', 'kinds': 'commit', 'cursor': cursor}),
                                          subprotocols=['xrpc.v1.json'], max_size=4*1024*1024, ping_timeout=120) as ws:
                async for frame in ws:
                    stats['frames'] += 1; stats['bytes'] += len(frame)
                    if stats['frames'] == 1: print('Jetstream replay connected', flush=True)
                    p = json.loads(frame).get('payload', {})
                    if not p.get('time'): continue
                    dt = datetime.fromisoformat(p['time'].replace('Z', '+00:00'))
                    first = first or p['time']; last = p['time']; cursor = p.get('cursor') or p.get('seq', cursor)
                    if stats['frames'] % 10000 == 0:
                        print('Jetstream:', last, len(rows), 'retained', flush=True)
                        dump('bluesky.partial.local.json', list(rows.values()))
                    if dt >= end: done = True; break
                    record = p.get('record') or {}; key = 'at://' + p['did'] + '/app.bsky.feed.post/' + p['rkey']
                    if p.get('operation') == 'delete': rows.pop(key, None); continue
                    if p.get('operation') == 'create': stats['creates'] += 1
                    text = record.get('text', '')
                    published=datetime.fromisoformat(record.get('createdAt',p['time']).replace('Z','+00:00'))
                    if not start <= published <= end:
                        old_count=old_count+1 if old_stamp==p['time'] else 1;old_stamp=p['time']
                        if old_count>=5000:
                            cursor=int((dt+timedelta(seconds=1)).timestamp()*1e6)
                            stats.setdefault('bulk_import_gaps',[]).append({'event_time':p['time'],'resume_time':(dt+timedelta(seconds=1)).isoformat(),'observed_old_records':old_count})
                            print('Skipping bulk old-record import at',p['time'],flush=True)
                            old_count=0;break
                        continue
                    old_count=0
                    if dt < start or not FILMISH.search(text): continue
                    langs = record.get('langs', [])
                    if langs and not set(langs) & {'en','de'}: continue
                    labels = record.get('labels') or {}
                    if isinstance(labels, dict) and any(x.get('val') == '!no-unauthenticated' for x in labels.get('values', [])): continue
                    embed = record.get('embed') or {}; external = embed.get('external') or {}
                    rows[key] = {'source': 'bluesky', 'publisher': p['did'], 'source_id': key,
                                 'url': 'https://bsky.app/profile/' + p['did'] + '/post/' + p['rkey'],
                                 'published_at': record.get('createdAt', p['time']), 'event_at': p['time'],
                                 'text': text, 'context': plain(external.get('title', '') + ' ' + external.get('description', ''))[:1800]}
                    if stats['frames'] % 20000 == 0: print('Jetstream:', last, len(rows), 'retained', flush=True)
        except Exception as exc:
            import traceback
            traceback.print_exc()
            stats['reconnects'] += 1
            print('Jetstream reconnect', type(exc).__name__, flush=True)
            if stats['reconnects'] >= 20: raise
    stats |= {'first_event': first, 'last_event': last, 'retained': len(rows), 'wall_seconds': round(time.monotonic()-wall, 2)}
    dump('bluesky.json', list(rows.values())); dump('jetstream-audit.json', stats)
    print(stats, flush=True)

def catalog():
    rows = []
    for table, kind in [('movie','movie'), ('show','tv')]:
        result = crate(f'SELECT tmdb_id, title, original_title, release_year, popularity FROM {table} ORDER BY tmdb_id LIMIT 2000000')
        for x in result:
            x['key'] = f"{kind}:{x['tmdb_id']}"; x['media_type'] = kind
        rows.extend(result); print('Catalog', table, len(result), flush=True)
    with gzip.open(DATA / 'catalog.local.json.gz', 'wt') as f: json.dump(rows, f, ensure_ascii=False)
    dump('catalog-audit.json', {'fetched_at': datetime.now(timezone.utc).isoformat(), 'rows': len(rows), 'tables': ['movie','show'], 'full_table_counts': {t: crate(f'SELECT count(*) AS n FROM {t}')[0]['n'] for t in ['movie','show']}})

def sample():
    # Deterministic per-source random subset, chosen BEFORE matching or labeling.
    feeds_data = load('feeds.json'); bluesky = load('bluesky.json')
    out = []
    for source, pool in [('youtube',[x for x in feeds_data if x['source']=='youtube']),
                         ('rss',[x for x in feeds_data if x['source']=='rss' and x['publisher']!='about.netflix.com']), ('bluesky',bluesky)]:
        rng = random.Random(544)
        chosen = rng.sample(sorted(pool, key=lambda x:x['url']), min(60 if source != 'youtube' else 50,len(pool)))
        for i,x in enumerate(chosen): x['id'] = source[0].upper() + f'{i+1:03}'
        out.extend(chosen)
    dump('sample.json', out)
    print('Sample', {s:sum(x['source']==s for x in out) for s in ['youtube','rss','bluesky']})

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['feeds','jetstream','catalog','sample'])
    parser.add_argument('--hours', type=float, default=3)
    parser.add_argument('--resume', action='store_true')
    opts = parser.parse_args()
    DATA.mkdir(exist_ok=True)
    if opts.command == 'jetstream': asyncio.run(jetstream(opts.hours, opts.resume))
    else: globals()[opts.command]()
