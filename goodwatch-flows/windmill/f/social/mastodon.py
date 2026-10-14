"""Bounded public status trends; federated URI deduplication across instances."""
from f.social.common import http_get, post, stamp
from f.social.inventory import MASTODON_INSTANCES
from f.social.quality import html_urls


def collect(settings, start, end, *, get=http_get, pages=1, instances=MASTODON_INSTANCES):
    posts, audit, errors = {}, [], []
    for instance in instances:
        try:
            body = get(instance + '/api/v1/trends/statuses', params={'limit': 40}).json()
            for item in body:
                item = item.get('reblog') or item
                if item.get('visibility', 'public') != 'public' or not start <= stamp(item['created_at']) <= end:
                    continue
                account = item['account']
                uri = item['uri']
                posts[uri] = post('mastodon', uri, item.get('url') or uri, account['url'], account['acct'],
                                  item['created_at'], item['content'], item.get('spoiler_text', ''),
                                  'trends:' + instance)
                posts[uri]['quality_evidence'] = {
                    'links_complete': True, 'urls': html_urls(item['content']),
                    'profile': {'present': bool(account.get('display_name') or account.get('note') or account.get('avatar_static')),
                                'created_at': account.get('created_at'), 'posts_count': account.get('statuses_count'),
                                'bot': bool(account.get('bot'))},
                }
            audit.append({'instance': instance, 'returned': len(body), 'scope': 'public_status_trends'})
        except Exception as exc:
            errors.append({'instance': instance, 'error': type(exc).__name__})
    return {'status': 'partial' if errors else 'ok', 'posts': list(posts.values()), 'audit': audit, 'errors': errors}


def main():
    return {'library': True}
