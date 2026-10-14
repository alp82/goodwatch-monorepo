"""Bounded first-page search, with post AND author opt-out checks before storage."""
from f.social.common import http_get, post, stamp

BASE = 'https://api.bsky.app/xrpc/'
QUERIES = ('movie', 'film', 'trailer', 'TV show', 'series', 'episode', 'netflix', 'cinema')


def opted_out(item):
    return any(label.get('val') == '!no-unauthenticated' for label in item.get('labels', []))


def allowed_authors(dids, *, get=http_get):
    allowed = set()
    for i in range(0, len(dids), 25):
        profiles = get(BASE + 'app.bsky.actor.getProfiles',
                       params=[('actors', did) for did in dids[i:i + 25]]).json()['profiles']
        allowed.update(p['did'] for p in profiles if not opted_out(p))
    return allowed


def collect(settings, start, end, *, get=http_get, pages=1, queries=QUERIES):
    posts, audit, errors = {}, [], []
    for query in queries:
        try:
            body = get(BASE + 'app.bsky.feed.searchPosts', params={
                'q': query, 'sort': 'latest', 'limit': 100, 'since': start.isoformat(), 'until': end.isoformat()}).json()
            audit.append({'query': query, 'returned': len(body['posts']),
                          'cursor_ignored': bool(body.get('cursor')), 'scope': 'bounded_first_page'})
            for item in body['posts']:
                record, author = item['record'], item['author']
                if opted_out(item) or opted_out(author) or not start <= stamp(record['createdAt']) <= end:
                    continue
                external = (record.get('embed') or {}).get('external') or {}
                uri = item['uri']
                # DID URLs remain stable if the author's handle changes.
                posts[uri] = post('bluesky', uri, 'https://bsky.app/profile/' + author['did'] + '/post/' + uri.rsplit('/', 1)[1],
                                  author['did'], author['handle'], record['createdAt'], record.get('text', ''),
                                  external.get('title', '') + ' ' + external.get('description', ''), 'search:' + query)
        except Exception as exc:
            errors.append({'query': query, 'error': type(exc).__name__})
    # Profile failure fails closed: unverified posts are never persisted.
    allowed = allowed_authors(sorted({p['author_id'] for p in posts.values()}), get=get)
    return {'status': 'partial' if errors else 'ok', 'posts': [p for p in posts.values() if p['author_id'] in allowed],
            'audit': audit, 'errors': errors}


def main():
    return {'library': True}
