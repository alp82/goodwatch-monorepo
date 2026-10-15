"""Conservative, deterministic publication gate, independent of title identity."""
import re
import math
import unicodedata
from urllib.parse import urlsplit
from html.parser import HTMLParser
from collections import defaultdict
from difflib import SequenceMatcher
from f.social.common import now, stamp
from f.social.inventory import CHANNELS

VERSION = 'content-quality-1'
PROMOTION = re.compile(
    r'\b(?:watch\W+(?:\w+\W+){0,5}free|free\W+(?:\w+\W+){0,3}(?:stream|watch|download)|'
    r'(?:stream|download)\W+(?:\w+\W+){0,3}free|full\W+(?:movie|film)|'
    r'(?:hd|4k|1080p|720p)\W+stream|stream\W+(?:hd|4k|1080p|720p)|'
    r'download\W+(?!the\W+(?:trailer|podcast)\b)|123\W*movies|fmovies|putlocker|'
    r'gomovies|soap2day|sflix|watch\W+online\W+now|kostenlos\W+(?:ansehen|streamen)|'
    r'watchfree|fullmovie|freestream|freedownload|hdstream|streamfree|'
    r'(?:filme|film)\W+completo|assistir\W+(?:\w+\W+){0,3}gr[aá]tis)\b', re.I)

# Deliberately small editorial inventory. General video/social/file hosting is not
# an outlet: allowing youtube.com would also allow unauthorized movie uploads.
BLUESKY_OUTLETS = frozenset((
    'variety.com', 'deadline.com', 'hollywoodreporter.com', 'indiewire.com',
    'collider.com', 'screenrant.com', 'slashfilm.com', 'denofgeek.com',
    'filmstarts.de', 'moviepilot.de', 'film-rezensionen.de', 'epd-film.de',
    'about.netflix.com', 'bbc.com', 'bbc.co.uk', 'theguardian.com', 'rogerebert.com'))
SHORTENERS = frozenset(('bit.ly', 'tinyurl.com', 't.co', 'ow.ly', 'buff.ly', 'goo.gl',
    'is.gd', 'cutt.ly', 'shorturl.at', 'rb.gy', 'tiny.cc', 'rebrand.ly', 'trib.al',
    'lnkd.in', 'ift.tt', 'dlvr.it', 'linktr.ee', 'short.io'))
URL = re.compile(r"(?i)(?:https?://|www\.)[^\s<>]+|(?<![@\w/])[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}(?:/[^\s<>]*)?")


def urls_in(text):
    return [m.group().rstrip('.,;!?)]}\"\'') for m in URL.finditer(text)]


def html_urls(value):
    class Links(HTMLParser):
        def __init__(self):
            super().__init__()
            self.urls = []
        def handle_starttag(self, tag, attrs):
            if tag == 'a':
                self.urls.extend(v for k, v in attrs if k == 'href' and v)
    parser = Links()
    parser.feed(value or '')
    return sorted(set(parser.urls))


def host_of(url):
    try:
        parts = urlsplit(url if '://' in url else 'https://' + url)
        if parts.scheme not in ('https', 'http') or parts.username or parts.password or parts.port not in (None, 80, 443):
            return ''
        return (parts.hostname or '').lower().rstrip('.')
    except ValueError:
        return ''


def within(host, domains):
    return any(host == d or host.endswith('.' + d) for d in domains)


def clean_text(value):
    return ''.join(c for c in unicodedata.normalize('NFKC', value) if unicodedata.category(c) != 'Cf')


def evaluate(item, *, at=None):
    # This inventory consists exclusively of verified official distributor channels.
    if item['source'] == 'youtube':
        trusted = item.get('author_id') in CHANNELS.values() and host_of(item.get('url') or '') in ('youtube.com', 'www.youtube.com')
        return {'status': 'pass' if trusted else 'reject', 'reasons': [] if trusted else ['unverified_youtube_channel']}
    text = clean_text(item.get('text') or '')
    context = clean_text(item.get('context') or '')
    reasons = []
    if PROMOTION.search(text + '\n' + context):
        reasons.append('stream_promotion')
    evidence = item.get('quality_evidence') or {}
    if item['source'] in ('bluesky', 'mastodon') and not evidence.get('links_complete'):
        reasons.append('missing_link_evidence')
    for flag in ('opted_out', 'source_content_changed', 'incomplete_author_corpus'):
        if evidence.get(flag):
            reasons.append(flag)
    context += '\n' + clean_text(evidence.get('extra_text') or '')
    if PROMOTION.search(context):
        reasons.append('stream_promotion')
    urls = set(evidence.get('urls') or []) | set(urls_in(text + '\n' + context))
    if item['source'] == 'rss':
        urls.add(item['url'])
    for url in sorted(urls):
        host = host_of(url)
        if not host:
            reasons.append('invalid_link')
        elif within(host, SHORTENERS):
            reasons.append('link_shortener')
        elif item['source'] == 'bluesky' and not within(host, BLUESKY_OUTLETS):
            reasons.append('unapproved_link_domain')
        if PROMOTION.search(host + ' ' + url):
            reasons.append('stream_promotion')
    profile = evidence.get('profile')
    if item['source'] == 'bluesky' and not profile:
        reasons.append('missing_profile_evidence')
    if profile:
        if not profile.get('present'):
            reasons.append('no_profile')
        if profile.get('bot'):
            reasons.append('declared_bot')
        try:
            age = ((at or now()) - stamp(profile['created_at'])).total_seconds() / 86400
            if age < 7:
                reasons.append('new_account')
            count = float(profile['posts_count'])
            if not math.isfinite(count) or count < 0:
                raise ValueError('Invalid post count')
            if count / max(age, 1) > 100:
                reasons.append('high_post_rate')
        except (KeyError, ValueError, TypeError, AttributeError, OverflowError):
            if item['source'] == 'bluesky':
                reasons.append('missing_account_metrics')
    if evidence.get('repetitive_author'):
        reasons.append('repetitive_author')
    # Frame/timestamp feeds are automated even if only one sample was discovered.
    if re.search(r'(?i)\bframe\s+\d+\s*/\s*\d+|\bepisode\s+\d+.{0,100}\d{1,2}:\d{2}\.\d{3}', text, re.S):
        reasons.append('automated_frame_post')
    # A publisher's short headline can rely on its editorial summary. Social
    # hashtags and link-card boilerplate cannot supply discussion.
    substance = text + '\n' + context if item['source'] == 'rss' else text
    substance = re.sub(r'(?<!\w)#[\w]+', '', URL.sub('', substance))
    if item['source'] != 'rss':
        substance = re.sub(r'(?im)^\s*(?:movie|film|starring|directed by|read more|click here|link in bio)\s*:?\s*$', '', substance)
    words = re.findall(r"[^\W\d_]+", substance, re.UNICODE)
    if len(words) < 3 or sum(map(len, words)) < 12:
        reasons.append('no_substantive_text')
    return {'status': 'reject' if reasons else 'pass', 'reasons': sorted(set(reasons))}


def evaluate_batch(items, *, at=None):
    """Detect authors recycling near-identical templates, including changed titles.

    A high threshold and three distinct samples avoid treating one repost as a
    bot. Call with the rolling local corpus as well as the newly collected batch.
    """
    authors = defaultdict(dict)
    for item in items:
        if item['source'] in ('bluesky', 'mastodon'):
            text = URL.sub('', unicodedata.normalize('NFKC', item.get('text') or '').lower())
            text = re.sub(r'(?<!\w)#[\w]+|\d+', '', text)
            text = re.sub(r'\s+', ' ', text).strip()
            if len(text) >= 40:
                authors[(item['source'], item.get('author_id'))][item['post_id']] = text
    repetitive = set()
    for author, samples in authors.items():
        texts = list(samples.values())
        for i, text in enumerate(texts):
            # At most 100 samples per account are needed to establish automation.
            similar = [other for other in texts[:100] if SequenceMatcher(None, text, other, autojunk=False).ratio() >= .82]
            if len(similar) >= 3:
                repetitive.add(author)
                break
    decisions = {}
    for item in items:
        if (item['source'], item.get('author_id')) in repetitive:
            item = dict(item, quality_evidence=dict(item.get('quality_evidence') or {}, repetitive_author=True))
        decisions[item['post_id']] = evaluate(item, at=at)
    return decisions


def main():
    return {'version': VERSION}
