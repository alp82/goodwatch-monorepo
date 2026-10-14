"""The nineteen verified publisher feeds; bounded WordPress backfill pages."""
from urllib.parse import urlsplit
import xml.etree.ElementTree as ET
from f.social.common import http_get, canonical, post, stamp
from f.social.inventory import FEEDS

PAGED = ('variety.com', 'deadline.com', 'hollywoodreporter.com', 'indiewire.com', 'slashfilm.com')


def collect(settings, start, end, *, get=http_get, pages=1, feeds=FEEDS):
    posts, audit, errors = {}, [], []
    for feed in feeds:
        for page in range(1, (pages if any(d in feed for d in PAGED) else 1) + 1):
            url = feed + (('?' if '?' not in feed else '&') + 'paged=' + str(page) if page > 1 else '')
            try:
                root = ET.fromstring(get(url).content)
                dates = []
                for entry in root.findall('.//item'):
                    try:
                        date = stamp(entry.findtext('pubDate') or '')
                        dates.append(date)
                        if not start <= date <= end:
                            continue
                        link = canonical(entry.findtext('link') or '')
                        author = entry.findtext('{http://purl.org/dc/elements/1.1/}creator') or urlsplit(feed).hostname
                        posts[link] = post('rss', link, link, urlsplit(feed).hostname, author, date,
                                           entry.findtext('title'), entry.findtext('description'), 'feed:' + feed)
                    except (ValueError, TypeError):
                        errors.append({'feed': feed, 'error': 'invalid_entry'})
                audit.append({'feed': feed, 'page': page, 'entries': len(dates),
                              'oldest': min(dates).isoformat() if dates else None})
                if not dates or min(dates) < start:
                    break
            except Exception as exc:
                errors.append({'feed': feed, 'page': page, 'error': type(exc).__name__})
                break
    return {'status': 'partial' if errors else 'ok', 'posts': list(posts.values()), 'audit': audit, 'errors': errors}


def main():
    return {'library': True}
