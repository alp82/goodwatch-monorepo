"""Bounded first-page search, with post AND author opt-out checks before storage."""
from f.social import images
from f.social.common import http_get, now, post, stamp

BASE = 'https://api.bsky.app/xrpc/'
QUERIES = ('movie', 'film', 'trailer', 'TV show', 'series', 'episode', 'netflix', 'cinema')


def opted_out(item):
    return any(label.get('val') == '!no-unauthenticated' for label in item.get('labels', []))


def allowed_authors(dids, *, get=http_get):
    return set(profiles_for(dids, get=get))


def profiles_for(dids, *, get=http_get):
    allowed = {}
    for i in range(0, len(dids), 25):
        profiles = get(BASE + 'app.bsky.actor.getProfiles',
                       params=[('actors', did) for did in dids[i:i + 25]]).json()['profiles']
        allowed.update({p['did']: p for p in profiles if not opted_out(p)})
    return allowed


def collect(settings, start, end, *, get=http_get, pages=1, queries=QUERIES):
    posts, records, audit, errors = {}, {}, [], []
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
                records[uri] = item
                # DID URLs remain stable if the author's handle changes.
                posts[uri] = post('bluesky', uri, 'https://bsky.app/profile/' + author['did'] + '/post/' + uri.rsplit('/', 1)[1],
                                  author['did'], author['handle'], record['createdAt'], record.get('text', ''),
                                  external.get('title', '') + ' ' + external.get('description', ''), 'search:' + query)
                posts[uri]['image_url'] = images.bluesky_image(item)
        except Exception as exc:
            errors.append({'query': query, 'error': type(exc).__name__})
    # Profile failure fails closed: unverified posts are never persisted.
    allowed = profiles_for(sorted({p['author_id'] for p in posts.values()}), get=get)
    for uri, p in posts.items():
        p['quality_evidence'] = evidence_for(records[uri], allowed.get(p['author_id']))
        p['relevance_evidence'] = relevance_evidence(records[uri], allowed.get(p['author_id']))
    return {'status': 'partial' if errors else 'ok', 'posts': [p for p in posts.values() if p['author_id'] in allowed],
            'audit': audit, 'errors': errors}


def evidence_for(item, profile):
    """Retain actual facet/embed targets, including nested quoted record targets."""
    urls, extra = set(), []
    def visit(value):
        if isinstance(value, dict):
            for key, child in value.items():
                if key == 'uri' and isinstance(child, str) and child.startswith(('http:', 'https:')):
                    urls.add(child)
                if key in ('text', 'alt', 'title', 'description') and isinstance(child, str):
                    extra.append(child)
                if isinstance(child, (dict, list)):
                    visit(child)
        elif isinstance(value, list):
            for child in value:
                visit(child)
    visit(item.get('record') or {})
    visit(item.get('embed') or {})
    evidence = {'links_complete': bool(item.get('record')), 'urls': sorted(urls),
                'extra_text': ' '.join(extra)[:2800]}
    if profile:
        labels = profile.get('labels') or []
        evidence['profile'] = {
            'present': bool(profile.get('displayName') or profile.get('description') or profile.get('avatar')),
            'created_at': profile.get('createdAt'), 'posts_count': profile.get('postsCount'),
            'bot': any(l.get('val') in ('bot', 'automated') for l in labels),
        }
    if opted_out(item) or opted_out(item.get('author') or {}) or (profile and opted_out(profile)):
        evidence['opted_out'] = True
    return evidence


def relevance_evidence(item, profile):
    """Metrics are ephemeral here; only social_relevance persists these values."""
    profile = profile or {}
    card = (item.get('embed') or {}).get('external') or ((item.get('record') or {}).get('embed') or {}).get('external') or {}
    return {'likes': item.get('likeCount'), 'reposts': item.get('repostCount'),
            'quotes': item.get('quoteCount'), 'replies': item.get('replyCount'),
            'followers': profile.get('followersCount'), 'observed_at': now().isoformat(),
            'card_text': (card.get('title', '') + ' ' + card.get('description', ''))[:1800]}


def hydrate_quality(posts, *, get=http_get):
    """Revalidate existing rows with current public records and profiles, fail closed.

    Only fixed AppView endpoints are contacted, never a post's outbound URL.
    Individual failed batches remain unknown and cannot publish.
    """
    from concurrent.futures import ThreadPoolExecutor
    from f.social.common import plain
    records, profiles, errors = {}, {}, []
    requests = []
    uris = sorted({p['source_id'] for p in posts})
    dids = sorted({p['author_id'] for p in posts})
    requests += [('app.bsky.feed.getPosts', [('uris', u) for u in uris[i:i+25]], 'posts', 'uri') for i in range(0, len(uris), 25)]
    requests += [('app.bsky.actor.getProfiles', [('actors', d) for d in dids[i:i+25]], 'profiles', 'did') for i in range(0, len(dids), 25)]
    def fetch(request):
        endpoint, params, field, key = request
        try:
            body = get(BASE + endpoint, params=params).json()
            return field, {v[key]: v for v in body[field]}, None
        except Exception as exc:
            return field, {}, type(exc).__name__
    with ThreadPoolExecutor(max_workers=4) as pool:
        for field, values, error in pool.map(fetch, requests):
            (records if field == 'posts' else profiles).update(values)
            if error:
                errors.append({'batch': field, 'error': error})
    for p in posts:
        item = records.get(p['source_id']) or {}
        p['quality_evidence'] = evidence_for(item, profiles.get(p['author_id']))
        p['relevance_evidence'] = relevance_evidence(item, profiles.get(p['author_id']))
        if item and plain(item.get('record', {}).get('text'))[:1000] != p['text']:
            p['quality_evidence']['source_content_changed'] = True
    return errors


def main():
    return {'library': True}
