"""Title-specific, deterministic relevance. No IO, inference or source quotas."""
import re
import json
import unicodedata
from difflib import SequenceMatcher
from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode
from collections import defaultdict
from f.social.common import digest, norm, now, stamp
from f.social.deterministic import mentions, reference_only, REFERENCE_BEFORE
from f.social.inventory import CHANNELS
from f.social.quality import host_of
from f.social.rules import foreground
from f.social.relevance_registry import AUTHORS
from f.social.quality import URL
from f.social.youtube_playability import gate_reasons

VERSION = 'relevance-1'
VIDEO_FORMAT = re.compile(r'(?i)\b(?:trailer|teaser|sneak peek|first look|featurette|behind.the.scenes|'
                          r'interview|camera test|music video|lyric video|sound check|my universal story|'
                          r'hinter die kulissen|summarize|official clip|movie clip|scene|sketch|stand.up)\b')
VIDEO_ACTIVATION = re.compile(r'(?i)\b(?:trailer (?:tomorrow|in \d+|countdown)|countdown|fortnite|'
                              r'game activation|brand collaboration|giveaway|gewinnspiel)\b')
TIER_A = frozenset(('variety.com', 'deadline.com', 'hollywoodreporter.com', 'indiewire.com',
                    'theguardian.com', 'bbc.com', 'bbc.co.uk', 'rogerebert.com', 'epd-film.de', 'film-rezensionen.de'))
TIER_B = frozenset(('collider.com', 'screenrant.com', 'slashfilm.com', 'denofgeek.com', 'filmstarts.de', 'moviepilot.de'))
EDITORIAL = re.compile(r'(?i)\b(?:review|rezension|kritik|lohnt|lohnen|interview|exclusive|exklusiv|trailer|teaser|'
                       r'first look|sneak peek|cast|casting|joins|stars|starring|season|staffel|renew\w*|cancel\w*|'
                       r'premiere|release|start\w*|sequel|reboot|revival|finale|box.office|ratings|viewers|record|'
                       r'rekord|director|regisseur|behind|production|dreh\w*|festival|award\w*|oscar\w*|restor\w*|'
                       r'animatronic|effects|vfx|analysis|explains?|explained|confirms?|reactions?|timeline|'
                       r'who plays|characters?|how|why|best[aä]tigt|erkl[aä]rt|produktions\w*|entt[aä]uschung)\b')
ANALYSIS = re.compile(r'(?i)\b(?:review|kritik|rezension|analysis|anatomy|interview|q.?a|explains?|explained|why|how)\b')
RSS_NOISE = re.compile(r'(?i)\b(?:where to watch|how to watch|leaving (?:netflix|prime|hulu|peacock)|'
                       r'leaves (?:netflix|prime|hulu|peacock)|says goodbye|tonight on|heute (?:im|abend|startet)|'
                       r'morgen (?:im|abend)|neu (?:bei|auf)|im tv|free trial|best deals|buy now|gewinn\w*|'
                       r'giveaway|tickets fur|merch\w*|barbie doll|gaming app|toca boca|vip package|'
                       r'red.carpet(?:\s+\w+){0,3}\s+(?:photo\w*|galler\w*)|power list|movies that have made|'
                       r'wann kommt|erschein\w* folge|everything we know|forget .{0,80}(?:show|series)|replacement|'
                       r'ranked|ranking|\d+ (?:best|greatest|worst) (?:movies|films|shows|series|miniseries))\b')
RSS_ROUTINE = re.compile(r'(?i)\b(?:officially leaving|streaming.abo|streaming hit.*leav|recasting|cast if it were|'
                         r'\d+ (?:great|best|worst) films|stage musical|stage adaptation|'
                         r'\d+ mistakes|in einem weiteren|trailblazer)\b')
PERSONAL_NEWS = re.compile(r'(?i)\b(?:signs? with|signs? (?:overall|deal)|signs? .*management|'
                           r'(?:caa|uta|wme) signs|to host .*awards|to preside|jury|rape trial|sexual appetite|'
                           r'insurance|barbie|gala|broadway box.office|launches .{0,40}company|overall .{0,20}deal)\b')
REPUBLISHED = re.compile(r'(?i)\b(?:republish\w*|re.published|republication|originally published|'
                         r'dieser (?:artikel|beitrag) (?:ist|wurde|erschien) (?:bereits|urspr[uü]nglich)|'
                         r'aktualisierte (?:fassung|version) eines|erneut ver[oö]ffentlicht|wiederver[oö]ffentlich\w*)\b')
CRAFT = re.compile(r'(?i)\b(?:book changes|cut scenes|finale|character design|performance|'
                   r'production|adapting|music choices|song choice|goodbye scene)\b')
DISCUSSION = re.compile(r'(?i)\b(?:talks|discuss\w*|explains?|reveals?|teases|inspired|points out|spoke with)\b|'
                        r'\b(?:stars?|director|actor|actress)\b.{0,65}\bon\b')
INTERVIEW = re.compile(r'(?i)\b(?:interview|q\s*[&.]\s*a)\b')
TRAILER_REACTION = re.compile(r'(?i)\b(?:fans?|audiences?)\b.{0,90}\b(?:split|react\w*)\b|'
                             r'\btrailer\b.{0,45}\b(?:reactions|divides|divided)\b')
TITLE_PARTICIPANT = re.compile(r'''(?ix)^[’'"”]*-?\s*(?:[’']s\s+|(?:stars?|director|actor|actress|fans?)\b)''')


def trailer_reaction(text):
    return bool(TRAILER_REACTION.search(text) and re.search(r'(?i)\b(?:trailer|teaser)\b', text))


def title_discussion(headline, lead):
    """A named work's cast/fans can be the subject, rather than a mere credit.

    Require a concrete craft discussion or trailer audience response. A cast
    member's unrelated career announcement still supplies no title coverage.
    """
    combined = headline + '\n' + lead[:500]
    return bool((CRAFT.search(headline) and DISCUSSION.search(combined)) or trailer_reaction(headline))


def title_names(title):
    return {norm(n) for n in [title.get('title'), title.get('original_title'), *title.get('aliases', [])] if n} - {''}


def foreground_title(item, title, *, social=False):
    """Use catalog aliases and extracted mentions, rejecting reference-only spans.

    Matching already established identity; this checks the relationship. Body-only
    coverage needs a concrete editorial angle in the same sentence, never credits.
    """
    names = title_names(title)
    if not names:
        return False
    headline = item.get('text') or ''
    body = item.get('context') or ''
    found = mentions(dict(item, source='rss'))
    for where, text in (('headline', headline), ('description', body)):
        if social and where != 'headline':
            continue
        # Match normalized aliases without losing punctuation needed to detect
        # possessives/credits. Never let a non-Latin alias normalize to an empty hit.
        text = unicodedata.normalize('NFKD', text.replace('’', "'").replace('‘', "'").replace('“', '"').replace('”', '"')).encode('ascii', 'ignore').decode()
        for name in sorted(names, key=len, reverse=True):
            pattern = r'(?<!\w)' + r'[\W_]+'.join(map(re.escape, name.split())) + r'(?!\w)'
            for hit in re.finditer(pattern, text, re.I):
                raw = hit.group()
                if reference_only(raw, text) and not (
                        not social and where == 'headline' and TITLE_PARTICIPANT.match(text[hit.end():])
                        and not REFERENCE_BEFORE.search(text[max(0, hit.start() - 40):hit.start()])
                        and title_discussion(text, body)):
                    continue
                # An explicit sequel suffix cannot stand in for the linked original.
                if re.match(r'[’\'"”]*\s+\d+\b', text[hit.end():]) and not re.search(r'\d$', name):
                    continue
                if where == 'headline':
                    return True
                sentence = re.split(r'[.!?]\s|\n', text[:hit.start()])[-1] + text[hit.start():]
                sentence = re.split(r'[.!?]\s|\n', sentence)[0]
                if re.search(r'(?i)\b(?:credits? (?:include|as)|previous(?:ly)?|known for|best known|starring in|'
                             r'behind .{0,70}(?:and|,)|vergleich|vorg[aä]nger|oscar.nominated film|'
                             r'trailer.{0,100}(?:screening|screened)|screening.{0,100}trailer)\b', sentence):
                    continue
                # Body-only mentions need an evidenced subject relationship. A
                # long excerpt's unrelated production vocabulary is insufficient.
                prefix = text[max(0, hit.start() - 45):hit.start()]
                suffix = text[hit.end():hit.end() + 100]
                subject = re.search(r'(?i)\b(?:in|on|about|for|with|new|upcoming|series|film|movie|zum|neuen|neue|mit|serie)\s*[‘\'"“]*$', prefix) or re.match(
                    r'(?i)^[’\'"”]*\s*(?:[,;:]|(?:is|has|will|wins?|won|leads?|gets?|makes?|premier\w*|'
                    r'season|staffel|trailer|review|kritik|war|ist|hat|wird|kehrt|start\w*)\b)', suffix)
                mention = any(m['key'] == name and m['where'] == where and m['rank'] >= 1 for m in found)
                # German compounds ("Narnia-Film") are explicit subjects even
                # though the matcher extracts the entire compound as a mention.
                compound = re.match(r'(?i)^-(?:film|serie)(?!\w)', suffix)
                mention = mention or bool(compound)
                if subject and mention and EDITORIAL.search(sentence):
                    return True
    return False


def editorial_reasons(item, title, at):
    reasons = []
    text, body = item.get('text') or '', item.get('context') or ''
    host = host_of(item.get('url') or '').removeprefix('www.')
    if RSS_NOISE.search(norm(text)) or RSS_ROUTINE.search(norm(text)) or PERSONAL_NEWS.search(text):
        reasons.append('routine_or_personal_news')
    if title.get('release_year', 0) and title['release_year'] < at.year - 1 and re.search(r'(?i)\b(?:reboot|remake|spinoff|spin-off)\b', text):
        reasons.append('new_version_of_old_title')
    if host not in TIER_A:
        if host in TIER_B:
            if not EDITORIAL.search(text + '\n' + body[:500]):
                reasons.append('no_editorial_angle')
        elif host == 'about.netflix.com':
            if not re.search(r'(?i)\b(?:premier\w*|first look|teaser|trailer|new series|new film|announc\w*|release)\b', text):
                reasons.append('no_concrete_official_announcement')
        else:
            reasons.append('unreviewed_outlet')
    if not foreground_title(item, title):
        reasons.append('peripheral_title')
    return reasons


def social_substance(item, title):
    """Count own words, excluding URLs/hashtags, copied card spans and title tokens."""
    text = re.sub(r'(?<!\w)#[\w]+', '', URL.sub('', item.get('text') or ''))
    words = norm(text).split()
    card = norm((item.get('context') or '') + ' ' + ((item.get('relevance_evidence') or {}).get('card_text') or '')).split()
    copied = set()
    for block in SequenceMatcher(None, words, card, autojunk=False).get_matching_blocks():
        if block.size >= 4:
            copied.update(range(block.a, block.a + block.size))
    names = {w for name in title_names(title) for w in name.split()}
    return sum(i not in copied and w not in names and w.isalpha() for i, w in enumerate(words))


def measured_engagement(metrics):
    values = [metrics.get(k) for k in ('likes', 'reposts', 'quotes')]
    return sum(values) if all(type(v) is int and v >= 0 for v in values) else None


def social_reasons(item, title):
    reasons = []
    metrics = item.get('relevance_evidence') or {}
    engagement = measured_engagement(metrics)
    followers = metrics.get('followers')
    reviewed = (item['source'], item.get('author_id')) in AUTHORS
    reached = engagement is not None and (engagement >= 100 or (
        engagement >= 20 and type(followers) is int and followers >= 500))
    if not reviewed and not reached:
        reasons.append('missing_metrics' if engagement is None else 'insufficient_reach')
    if social_substance(item, title) < 12:
        reasons.append('fewer_than_12_own_words')
    if re.search(r'(?i)where are you watching|scene that lives rent.free', item.get('text') or ''):
        reasons.append('generic_social_prompt')
    if not foreground_title(item, title, social=True):
        reasons.append('peripheral_title')
    return reasons


def authority(item):
    if item['source'] == 'youtube':
        return 5.0
    if item['source'] == 'rss':
        return 4.0 if host_of(item['url']).removeprefix('www.') in TIER_A else 3.0
    return 2.5 if (item['source'], item.get('author_id')) in AUTHORS else 2.0


def editorial_kind(item):
    host = host_of(item.get('url') or '').removeprefix('www.')
    path = urlsplit(item.get('url') or '').path
    text = item.get('text') or ''
    if re.search(r'(?i)\b(?:review|kritik|rezension)\b', text) or re.search(r'/(?:reviews?|criticism|filmkritiken|rezensionen)/', path) or (
            host == 'film-rezensionen.de' and '/news/' not in path):
        return 'review'
    if INTERVIEW.search(text + '\n' + (item.get('context') or '')[:500]) or '/interviews/' in path:
        return 'interview'
    return 'news'


def rank_score(item, kind, age, title):
    substance = {'official_video': 1.3, 'review': 1.25, 'interview': 1.2, 'news': 1.0, 'social': 1.0}[kind]
    if kind == 'social':
        substance = min(1.4, social_substance(item, title) / 24)
    return round(authority(item) * substance * (1 - .5 * age / (14 if kind == 'official_video' else 7)), 8)


def canonical_article(url):
    """Strip only known tracking parameters, preserving meaningful query identity."""
    try:
        u = urlsplit(url)
        if u.scheme not in ('http', 'https') or not u.hostname or u.username or u.password:
            return None
        if not u.path.strip('/'):
            return None
        query = [(k, v) for k, v in parse_qsl(u.query, keep_blank_values=True)
                 if not k.lower().startswith('utm_') and k.lower() not in ('cmp', 'fbclid', 'gclid', 'ref')]
        return urlunsplit(('https', u.netloc.lower().removeprefix('www.'), u.path.rstrip('/'), urlencode(sorted(query)), ''))
    except ValueError:
        return None


def outgoing(item, title):
    urls = [item['url']] if item['source'] == 'rss' else (item.get('quality_evidence') or {}).get('urls', [])
    # A sufficiently developed independent contribution can stand beside its source.
    if item['source'] in ('bluesky', 'mastodon') and social_substance(item, title) >= 24:
        return set()
    return {u for url in urls if (u := canonical_article(url))}


def event(item):
    t = norm(item['text'])
    independent = item['source'] == 'rss' and (editorial_kind(item) in ('review', 'interview') or (
        title_discussion(item['text'], item.get('context') or '') and not trailer_reaction(item['text'])))
    if ANALYSIS.search(t) or independent:
        return None
    if trailer_reaction(item['text']):
        kind = 'trailer-reactions'
    elif re.search(r'\b(?:first reactions|early reactions|erste reaktionen|first .*reactions)\b', t):
        kind = 'first-reactions'
    elif re.search(r'\b(?:trailer|teaser|first look)\b', t):
        kind = 'teaser' if 'teaser' in t else ('first-look' if 'first look' in t and 'trailer' not in t else 'trailer')
    elif 'critics choice' in t and re.search(r'\bnominat', t):
        kind = 'critics-choice-nominations'
    elif 'idfa' in t and re.search(r'\b(?:lineup|lineups|competition|open)', t):
        kind = 'idfa-lineup'
    elif re.search(r'\b(?:renewed|renewal)\b', t):
        kind = 'renewal'
    elif 'doc stories' in t and re.search(r'\b(?:lineup|open|showcase)', t):
        kind = 'doc-stories-lineup'
    else:
        return None
    cut = re.search(r'\b(?:trailer|teaser)\s*(\d+)\b', t)
    season = re.search(r'\b(?:season|staffel|temporada)\s*(\d+)\b', t)
    variant = re.findall(r'\b(final|red band|extended|international)\s+(?:official\s+)?(?:trailer|teaser)\b', t)
    # Catalog release years in headlines do not distinguish events. Explicit
    # dates do. Missing dates stay separate as well: avoid assuming the event.
    dates = re.findall(r'\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b|'
                       r'\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}\b', item['text'].lower())
    return (kind, cut[1] if cut else '1', season[1] if season else '', tuple(variant), tuple(dates))


def collapse_duplicates(links, decisions, catalog):
    by_title = defaultdict(list)
    for item, verdict in zip(links, decisions):
        if verdict['status'] == 'keep':
            by_title[f"{item['media_type']}:{item['media_tmdb_id']}"].append((item, verdict))
    for key, pairs in by_title.items():
        title = catalog.get(key, {})
        def preference(pair):
            p, v = pair
            localized = p['source'] == 'youtube' and (p.get('author_id') in (CHANNELS['Netflix Brasil'], CHANNELS['Netflix India']) or
                bool(re.search(r'(?i)\b(?:oficial|dublado|legendado|trailer deutsch|hindi|tamil|telugu)\b', p['text'])))
            return (p['source'] == 'youtube', not localized, p['source'] == 'rss', authority(p),
                    v['score'], stamp(p['published_at']), p['post_id'])
        representatives = []
        for item, verdict in sorted(pairs, key=preference, reverse=True):
            urls, ev, tokens = outgoing(item, title), event(item), set(norm(item['text']).split())
            duplicate = None
            for other, other_verdict in representatives:
                exact = bool(urls & outgoing(other, title))
                within = abs((stamp(item['published_at']) - stamp(other['published_at'])).total_seconds()) <= 72 * 3600
                repeated_event = within and ev is not None and ev == event(other)
                near = False
                distinct_angle = any(ANALYSIS.search(p['text']) or title_discussion(p['text'], p.get('context') or '')
                                     for p in (item, other))
                if (within and item['source'] == other['source'] == 'rss'
                        and verdict['kind'] == other_verdict['kind'] == 'news' and not distinct_angle):
                    b = set(norm(other['text']).split())
                    near = len(tokens) >= 6 and len(b) >= 6 and len(tokens & b) / len(tokens | b) >= .8
                if exact or repeated_event or near:
                    duplicate = other_verdict
                    break
            if duplicate:
                verdict.update(status='drop', score=0.0, dup_group=duplicate['dup_group'])
                verdict['reasons'].append('duplicate_of:' + duplicate['post_id'])
            else:
                verdict['dup_group'] = digest(key + ':' + item['post_id'])
                representatives.append((item, verdict))


def video_reasons(item, title, at):
    reasons = []
    if item.get('author_id') not in CHANNELS.values() or host_of(item.get('url', '')) not in ('youtube.com', 'www.youtube.com'):
        reasons.append('unverified_official_channel')
    fg = foreground(item)
    text, lead = fg['headline'], fg['description'][:500]
    if VIDEO_ACTIVATION.search(text):
        reasons.append('countdown_or_activation')
    if not (VIDEO_FORMAT.search(text) or re.search(r'(?i)\b(?:in this scene|behind the scenes|hinter die kulissen|'
                                                  r'stunt performer|comedy sketch|stand.up routine)\b', lead)):
        reasons.append('no_substantive_video_format')
    year = title.get('release_year')
    combined = text + ' ' + lead
    hook = re.search(r'(?i)\b(?:restor\w*|anniversary|wiederauff\w*|re.?release|' + str(at.year) + r')\b', combined)
    season = re.search(r'(?i)\b(?:(?:season|staffel|temporada)\s*\d+|s\d{1,2}|new season)\b', combined)
    dated = re.search(r'(?i)\b(?:today|tomorrow|this week|next week|heute|morgen|' + str(at.year) + r')\b', combined)
    hook = hook or (season and dated)
    if year is not None and year < at.year - 1 and not hook:
        reasons.append('archive_without_current_hook')
    return reasons


def judge_links(links, catalog, *, at=None):
    at = at or now()
    # An alias that is another linked work's canonical title cannot establish
    # foreground by itself (e.g. an original and its differently named sequel).
    canonical_names = defaultdict(set)
    for key, title in catalog.items():
        for name in (title.get('title'), title.get('original_title')):
            if norm(name):
                canonical_names[norm(name)].add(key)
    catalog = {key: title | {'aliases': [a for a in title.get('aliases', [])
                if not (canonical_names.get(norm(a), set()) - {key})]} for key, title in catalog.items()}
    decisions = []
    for item in links:
        reasons = []
        if item.get('revalidation_failed'):
            reasons.append('social_revalidation_failed')
        title = catalog.get(f"{item['media_type']}:{item['media_tmdb_id']}", {})
        if not title.get('title'):
            reasons.append('missing_title_metadata')
        kind = 'official_video' if item['source'] == 'youtube' else 'news'
        try:
            age = (at - stamp(item['published_at'])).total_seconds() / 86400
            if not 0 <= age <= (14 if item['source'] == 'youtube' else 7):
                reasons.append('outside_publication_window')
        except (ValueError, TypeError, AttributeError, OverflowError, KeyError):
            reasons.append('missing_publication_time')
        if item['source'] == 'youtube':
            reasons += video_reasons(item, title, at)
            reasons += gate_reasons(item, at)
        elif item['source'] == 'rss':
            reasons += editorial_reasons(item, title, at)
            kind = editorial_kind(item)
        elif item['source'] in ('bluesky', 'mastodon'):
            reasons += social_reasons(item, title)
            kind = 'social'
        else:
            reasons.append('unknown_source')
        if REPUBLISHED.search((item.get('text') or '') + '\n' + (item.get('context') or '')):
            reasons.append('republication_notice')
        status = 'drop' if reasons else 'keep'
        if item['source'] in ('bluesky', 'mastodon'):
            # The shared contract has no metrics column. Persist explicit nulls
            # as a structured reason, exclusively in the new owned table.
            metrics = {k: (item.get('relevance_evidence') or {}).get(k)
                       for k in ('likes', 'reposts', 'quotes', 'replies', 'followers', 'observed_at', 'card_text')}
            reasons.append('metrics:' + json.dumps(metrics, sort_keys=True, separators=(',', ':')))
        if item['source'] == 'youtube' and item.get('youtube_playability'):
            reasons.append('playability:' + json.dumps(item['youtube_playability'], sort_keys=True, separators=(',', ':')))
        decisions.append({k: item[k] for k in ('media_type', 'media_tmdb_id', 'post_id', 'content_hash')} |
                         dict(version=VERSION, status=status, kind=kind,
                              score=0.0 if status == 'drop' else rank_score(item, kind, age, title), dup_group=digest(f"{item['media_type']}:{item['media_tmdb_id']}:{item['post_id']}"),
                              reasons=reasons, judged_at=at.isoformat()))
    collapse_duplicates(links, decisions, catalog)
    return decisions


def main():
    return {'version': VERSION}
