"""Normalized content and bounded HTTP shared by source adapters. No app/cache imports."""
import hashlib
import html
import re
import unicodedata
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode

UTC = timezone.utc
UA = 'GoodWatch/1.0 (social discovery; github.com/alp82/goodwatch-monorepo/issues/556)'
SOURCES = ('youtube', 'rss', 'bluesky', 'mastodon')
VERSION = 'foreground-context-v2-production-1'


def now():
    return datetime.now(UTC)


def stamp(value):
    if isinstance(value, datetime):
        return value.replace(tzinfo=value.tzinfo or UTC).astimezone(UTC)
    if isinstance(value, (float, int)):
        return datetime.fromtimestamp(value / 1000 if value > 100_000_000_000 else value, UTC)
    try:
        return stamp(datetime.fromisoformat(value.replace('Z', '+00:00')))
    except ValueError:
        try:
            return stamp(parsedate_to_datetime(value))
        except ValueError:
            for de, en in {'Januar': 'January', 'Februar': 'February', 'März': 'March', 'Mai': 'May',
                           'Juni': 'June', 'Juli': 'July', 'Oktober': 'October', 'Dezember': 'December'}.items():
                value = value.replace(de, en)
            return stamp(datetime.strptime(re.sub(r'^(\d+)\.', r'\1', value), '%d %B %Y'))


def plain(value):
    return html.unescape(re.sub('<[^>]+>', ' ', value or '')).strip()


def norm(value):
    value = unicodedata.normalize('NFKD', value or '').encode('ascii', 'ignore').decode().lower()
    return re.sub(r'[^a-z0-9]+', ' ', value).strip()


def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()


def canonical(url):
    parts = urlsplit(url)
    if parts.scheme not in ('http', 'https') or not parts.hostname or parts.username or parts.password:
        raise ValueError('Invalid source URL')
    query = [(k, v) for k, v in parse_qsl(parts.query, keep_blank_values=True)
             if not k.lower().startswith('utm_') and k.lower() not in ('fbclid', 'gclid')]
    return urlunsplit((parts.scheme, parts.netloc.lower(), parts.path, urlencode(query), ''))


def post(source, source_id, url, author_id, author, date, text, context, provenance):
    if source not in SOURCES or not source_id:
        raise ValueError('Invalid social identity')
    url = canonical(url)
    text, context = plain(text)[:1000], plain(context)[:1800]
    return {'post_id': digest(source + ':' + source_id), 'source': source, 'source_id': source_id,
            'url': url, 'author_id': author_id, 'author': author[:200], 'published_at': stamp(date).isoformat(),
            'text': text, 'context': context, 'provenance': provenance,
            'content_hash': digest(text + '\n' + context)}


def http_get(url, **kwargs):
    import requests
    headers = {'User-Agent': UA} | kwargs.pop('headers', {})
    response = requests.get(url, headers=headers, timeout=kwargs.pop('timeout', 35), **kwargs)
    response.raise_for_status()
    return response


def main():
    return {'library': True}
