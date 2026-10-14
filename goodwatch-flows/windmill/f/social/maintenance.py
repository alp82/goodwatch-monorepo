"""Bounded daily deletion/opt-out sync and retention. Unknown responses preserve content."""
import ipaddress
import socket
from urllib.parse import urlsplit, urljoin
import requests
from f.social import bluesky
from f.social.common import http_get, now, SOURCES
from f.social.settings import load
from f.social.store import Crate, Store


def public_get(url, *, accept=None):
    # RSS/federated permalinks are untrusted. Reject private endpoints and recheck each redirect.
    for _ in range(5):
        parts = urlsplit(url)
        if parts.scheme not in ('http', 'https') or parts.username or parts.password or parts.port not in (None, 80, 443):
            raise ValueError('Not a public source URL')
        addresses = socket.getaddrinfo(parts.hostname, parts.port or (443 if parts.scheme == 'https' else 80))
        if not addresses or any(not ipaddress.ip_address(a[4][0]).is_global for a in addresses):
            raise ValueError('Not a public source address')
        response = http_get(url, allow_redirects=False, stream=True,
                            headers={'Accept': accept} if accept else {})
        if response.is_redirect:
            url = urljoin(url, response.headers['Location'])
            response.close()
            continue
        # Don't download article bodies, images or video; only existence is required.
        response.close()
        return response
    raise ValueError('Too many redirects')


def source_state(post, settings, *, get=http_get):
    try:
        if post['source'] == 'bluesky':
            body = get(bluesky.BASE + 'app.bsky.feed.getPosts', params=[('uris', post['source_id'])]).json()
            item = next((p for p in body['posts'] if p['uri'] == post['source_id']), None)
            if item is None:
                return 'deleted'
            if bluesky.opted_out(item.get('author', {})):
                return 'author_opt_out'
            if bluesky.opted_out(item):
                return 'opt_out'
            allowed = bluesky.allowed_authors([post['author_id']], get=get)
            # A missing profile is unavailable to unauthenticated readers; remove the cached card.
            return 'alive' if post['author_id'] in allowed else 'author_opt_out'
        if post['source'] == 'youtube':
            if settings.get('YOUTUBE_API_KEY'):
                body = get('https://www.googleapis.com/youtube/v3/videos', params={
                    'part': 'id', 'id': post['source_id'], 'key': settings['YOUTUBE_API_KEY']}).json()
                return 'alive' if body['items'] else 'deleted'
            get('https://www.youtube.com/oembed', params={'url': post['url'], 'format': 'json'})
            return 'alive'
        if post['source'] in ('rss', 'mastodon'):
            if get is http_get:
                public_get(post['url'])
            else:
                get(post['url'])
            return 'alive'
    except requests.HTTPError as exc:
        if exc.response is not None:
            status = exc.response.status_code
            exc.response.close()
            if status in (404, 410):
                return 'deleted'
        return 'unknown'
    except Exception:
        return 'unknown'
    return 'unknown'


def run(settings, *, limit=2000, source='all'):
    if source != 'all' and source not in SOURCES:
        raise ValueError('Unknown source')
    if not 1 <= limit <= 10000:
        raise ValueError('Unbounded deletion check')
    store = Store(Crate(settings))
    store.initialize()
    rows = store.db.select('SELECT * FROM doc.social_post WHERE deleted_at IS NULL AND (source=? OR ?=\'all\') ORDER BY checked_at ASC NULLS FIRST,post_id LIMIT ?', [source, source, limit])
    counts = {'checked': 0, 'removed': 0, 'unknown': 0}
    removed_ids = set()
    for row in rows:
        if row['post_id'] in removed_ids:
            continue
        state = source_state(row, settings)
        counts['checked'] += 1
        if state == 'author_opt_out':
            removed = store.remove_author('bluesky', row['author_id'])
            removed_ids.update(removed)
            counts['removed'] += len(removed)
        elif state in ('deleted', 'opt_out'):
            store.remove(row['post_id'], state)
            removed_ids.add(row['post_id'])
            counts['removed'] += 1
        else:
            store.db.execute('UPDATE doc.social_post SET checked_at=? WHERE post_id=?', [now().isoformat(), row['post_id']])
            counts['unknown'] += state == 'unknown'
    store.retain()
    return counts


def main(limit: int = 2000, source: str = 'all'):
    return run(load(), limit=limit, source=source)
