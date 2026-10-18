# extra_requirements:
# Pillow==11.3.0
"""Small first-party previews. All untrusted HTTP uses pinned public addresses."""
import base64
import ipaddress
import json
import re
import socket
import time
from datetime import timedelta
from html.parser import HTMLParser
from io import BytesIO
from urllib.parse import urljoin, urlsplit

from f.social.common import UA, now, stamp


class Missing(Exception):
    pass


def fetch(url, *, image=False):
    import urllib3
    deadline = time.monotonic() + 10
    cap = 5 * 1024 * 1024 if image else 1024 * 1024
    for _ in range(4):
        parts = urlsplit(url)
        if parts.scheme not in ('http', 'https') or not parts.hostname or parts.username or parts.password:
            raise ValueError('Invalid image URL')
        port = parts.port or (443 if parts.scheme == 'https' else 80)
        addresses = socket.getaddrinfo(parts.hostname, port, type=socket.SOCK_STREAM)
        if not addresses or any(not ipaddress.ip_address(a[4][0]).is_global for a in addresses):
            raise ValueError('Non-public address')
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise TimeoutError()
        # Connect to the validated IP, retaining TLS hostname verification and SNI.
        cls = urllib3.HTTPSConnectionPool if parts.scheme == 'https' else urllib3.HTTPConnectionPool
        options = {'assert_hostname': parts.hostname, 'server_hostname': parts.hostname} if parts.scheme == 'https' else {}
        pool = cls(addresses[0][4][0], port, timeout=urllib3.Timeout(total=remaining), **options)
        response = None
        try:
            response = pool.urlopen('GET', parts.path + ('?' + parts.query if parts.query else '') or '/',
                headers={'Host': parts.netloc, 'User-Agent': UA, 'Accept-Encoding': 'identity'},
                redirect=False, retries=False, preload_content=False)
            if response.status in (301, 302, 303, 307, 308):
                url = urljoin(url, response.headers['Location'])
                continue
            if response.status == 404:
                raise Missing()
            if response.status != 200:
                raise ValueError('HTTP failure')
            if response.headers.get('Content-Encoding', 'identity').lower() != 'identity':
                raise ValueError('Encoded response not supported')
            kind = response.headers.get('Content-Type', '').split(';')[0].lower()
            if image and not kind.startswith('image/'):
                raise ValueError('Not an image')
            if not image and kind not in ('text/html', 'application/xhtml+xml', 'application/json'):
                raise ValueError('Not HTML/JSON')
            if int(response.headers.get('Content-Length', 0)) > cap:
                raise ValueError('Too large')
            data = bytearray()
            while True:
                if time.monotonic() > deadline:
                    raise TimeoutError()
                chunk = response.read(16384, decode_content=False)
                if not chunk:
                    return bytes(data), url
                data.extend(chunk)
                if len(data) > cap:
                    raise ValueError('Too large')
        finally:
            if response:
                response.close()
            pool.close()
    raise ValueError('Too many redirects')


class Tags(HTMLParser):
    def __init__(self, html):
        super().__init__(convert_charrefs=True)
        self.images, self.meta = [], {}
        self.feed(html)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'img' and attrs.get('src'):
            self.images.append(attrs['src'])
        if tag == 'meta' and attrs.get('content'):
            self.meta[(attrs.get('property') or attrs.get('name') or '').lower()] = attrs['content']


def rss_image(entry, url):
    for name in ('content', 'thumbnail'):
        for node in entry.iter('{http://search.yahoo.com/mrss/}' + name):
            if node.get('url') and (not node.get('type') or node.get('type').startswith('image/')) and node.get('medium', 'image') == 'image':
                return urljoin(url, node.get('url'))
    for node in entry.findall('enclosure'):
        if node.get('type', '').startswith('image/') and node.get('url'):
            return urljoin(url, node.get('url'))
    for name in ('description', '{http://purl.org/rss/1.0/modules/content/}encoded'):
        images = Tags(entry.findtext(name) or '').images
        if images:
            return urljoin(url, images[0])
    return None


def bluesky_image(item):
    embed = item.get('embed') or {}
    if embed.get('$type') == 'app.bsky.embed.recordWithMedia#view':
        embed = embed.get('media') or {}
    if embed.get('$type') == 'app.bsky.embed.external#view':
        return (embed.get('external') or {}).get('thumb')
    if embed.get('$type') == 'app.bsky.embed.images#view':
        return next(iter(embed.get('images') or []), {}).get('thumb')
    return None


def mastodon_image(item):
    return (item.get('card') or {}).get('image') or next(
        (m.get('preview_url') for m in item.get('media_attachments', []) if m.get('type') == 'image'), None)


def source_image(post):
    if post.get('image_url'):
        return post['image_url']
    if post['source'] == 'youtube':
        if not re.fullmatch(r'[A-Za-z0-9_-]{11}', post['source_id']):
            raise ValueError('Invalid video ID')
        return 'https://i.ytimg.com/vi/' + post['source_id'] + '/maxresdefault.jpg'
    if post['source'] == 'bluesky' and 'image_url' not in post:
        from urllib.parse import urlencode
        data, _ = fetch('https://api.bsky.app/xrpc/app.bsky.feed.getPosts?' + urlencode({'uris': post['source_id']}))
        from f.social.bluesky import opted_out
        item = next(iter(json.loads(data).get('posts', [])), {})
        if opted_out(item) or opted_out(item.get('author') or {}):
            return None
        return bluesky_image(item)
    if post['source'] == 'mastodon' and 'image_url' not in post:
        parts = urlsplit(post['url'])
        identifier = parts.path.rstrip('/').rsplit('/', 1)[-1]
        if identifier.isdigit():
            data, _ = fetch(f'{parts.scheme}://{parts.netloc}/api/v1/statuses/{identifier}')
            return mastodon_image(json.loads(data))
    if post['source'] == 'rss':
        data, url = fetch(post['url'])
        meta = Tags(data.decode('utf-8', errors='replace')).meta
        image = meta.get('og:image') or meta.get('twitter:image') or meta.get('twitter:image:src')
        return urljoin(url, image) if image else None
    return None


def encode(data):
    from PIL import Image, ImageOps
    import warnings
    with warnings.catch_warnings():
        warnings.simplefilter('error', Image.DecompressionBombWarning)
        with Image.open(BytesIO(data)) as original:
            if original.width * original.height > 20_000_000:
                raise ValueError('Too many pixels')
            image = ImageOps.exif_transpose(original).convert('RGB')
    image.thumbnail((640, 640))
    while True:
        out = BytesIO()
        image.save(out, format='JPEG', quality=78, optimize=True)
        data = out.getvalue()
        if len(data) <= 60 * 1024:
            return data, image.width, image.height
        image.thumbnail((max(1, image.width * 3 // 4), max(1, image.height * 3 // 4)))


def save(db, posts):
    """Best effort, including database errors; retry failures daily, at most three attempts."""
    for post in posts:
        try:
            active = db.select('SELECT post_id FROM doc.social_post WHERE post_id=? AND deleted_at IS NULL', [post['post_id']])
            if not active:
                continue
            rows = db.select('SELECT status,attempts,fetched_at FROM doc.social_image WHERE post_id=?', [post['post_id']])
            old = rows[0] if rows else {}
            if old and (old['status'] == 'ok' or old['attempts'] >= 3 or stamp(old['fetched_at']) > now() - timedelta(days=1)):
                continue
            url, data, width, height, status = None, None, None, None, 'none'
            try:
                url = source_image(post)
                if url:
                    try:
                        raw, _ = fetch(url, image=True)
                    except Missing:
                        if post['source'] != 'youtube':
                            raise
                        url = url.replace('/maxresdefault.jpg', '/hqdefault.jpg')
                        raw, _ = fetch(url, image=True)
                    data, width, height = encode(raw)
                    status = 'ok'
            except Exception:
                status = 'failed'
            cols = ['post_id', 'source_url', 'content_type', 'width', 'height', 'bytes', 'data', 'fetched_at', 'status', 'attempts']
            values = [post['post_id'], url, 'image/jpeg' if data else None, width, height, len(data) if data else 0,
                      base64.b64encode(data).decode() if data else None, now().isoformat(), status, old.get('attempts', 0) + 1]
            db.execute(f"INSERT INTO doc.social_image ({','.join(cols)}) VALUES ({','.join('?' for _ in cols)}) ON CONFLICT (post_id) DO UPDATE SET " + ','.join(f'{c}=excluded.{c}' for c in cols[1:]), values)
            # A deletion during the fetch must not leave a newly stored copy behind.
            db.execute('DELETE FROM doc.social_image WHERE post_id=? AND post_id NOT IN (SELECT post_id FROM doc.social_post WHERE deleted_at IS NULL)', [post['post_id']])
        except Exception as exc:
            print('Social image skipped:', type(exc).__name__)


def backfill(store, limit=100):
    store.initialize()
    posts = store.db.select("""SELECT p.* FROM doc.social_post p LEFT JOIN doc.social_image i ON i.post_id=p.post_id
        WHERE i.post_id IS NULL AND p.deleted_at IS NULL AND p.published_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'
        ORDER BY p.published_at DESC,p.post_id LIMIT ?""", [min(max(limit, 1), 500)])
    save(store.db, posts)
    store.refresh('social_image')
    return {'processed': len(posts)}


def main():
    return {'library': True}
