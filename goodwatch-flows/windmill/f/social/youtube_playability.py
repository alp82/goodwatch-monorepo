"""Free, bounded YouTube availability observations. Unknown fails closed in relevance.

Prefer the supported Data API when an owner-provided key exists. Otherwise use
explicit worldwide country metadata and player status from the public watch page;
never infer German availability from an HTTP 200, oEmbed or a gl/hl parameter.
"""
import json
import re
from concurrent.futures import ThreadPoolExecutor
from f.social.common import http_get, now, stamp

COUNTRIES = ('DE', 'US', 'GB')
TTL_SECONDS = 3600
UNKNOWN_TTL_SECONDS = 300
MAX_VIDEOS = 1000
MAX_PAGE_BYTES = 4_000_000
VIDEO_ID = re.compile(r'^[A-Za-z0-9_-]{11}$')
PLAYER = re.compile(r'(?:var\s+)?ytInitialPlayerResponse\s*=\s*')


def observation(video_id, at, method, status='unknown', reason='missing_metadata', countries=None):
    return dict(video_id=video_id, checked_at=stamp(at).isoformat(), method=method,
                status=status, reason=reason, countries=countries or {c: None for c in COUNTRIES})


def fresh(evidence, video_id, at):
    try:
        age = (stamp(at) - stamp(evidence['checked_at'])).total_seconds()
        ttl = UNKNOWN_TTL_SECONDS if evidence.get('status') == 'unknown' else TTL_SECONDS
        return (evidence.get('video_id') == video_id and evidence.get('method') in ('watch', 'api')
                and 0 <= age < ttl)
    except (KeyError, TypeError, ValueError, AttributeError, OverflowError):
        return False


def gate_reasons(item, at):
    evidence = item.get('youtube_playability') or {}
    if not fresh(evidence, item.get('source_id'), at):
        return ['youtube_playability_missing_or_stale']
    if evidence.get('countries', {}).get('DE') is False:
        return ['youtube_region_blocked_DE']
    if evidence.get('status') == 'blocked':
        return ['youtube_unplayable:' + evidence.get('reason', 'unavailable')]
    if evidence.get('status') != 'playable' or evidence.get('countries', {}).get('DE') is not True:
        return ['youtube_playability_unknown:' + evidence.get('reason', 'missing_metadata')]
    return []


def parse_watch(video_id, page, at):
    match = PLAYER.search(page)
    if not match:
        return observation(video_id, at, 'watch', reason='missing_player_response')
    try:
        player = json.JSONDecoder().raw_decode(page[match.end():])[0]
        status = player.get('playabilityStatus', {})
        details = player.get('videoDetails', {})
        meta = player.get('microformat', {}).get('playerMicroformatRenderer', {})
        identity = details.get('videoId') or meta.get('externalVideoId')
        if identity != video_id:
            # Private/deleted responses often have no videoDetails. Their error
            # still blocks publication; never accept OK for an unrelated video.
            if status.get('status') == 'LOGIN_REQUIRED' and not identity:
                return observation(video_id, at, 'watch', reason='bot_or_login_required')
            if status.get('status') in ('ERROR', 'UNPLAYABLE') and not identity:
                return observation(video_id, at, 'watch', 'blocked', 'private_deleted_or_unavailable')
            return observation(video_id, at, 'watch', reason='missing_or_mismatched_video')
        allowed = meta.get('availableCountries')
        valid = isinstance(allowed, list) and all(isinstance(c, str) and re.fullmatch('[A-Z]{2}', c) for c in allowed)
        countries = {c: c in allowed if valid else None for c in COUNTRIES}
        if countries['DE'] is False:
            return observation(video_id, at, 'watch', 'blocked', 'region_blocked', countries)
        state = status.get('status')
        if state != 'OK':
            # Bot challenges, age gates, private/deleted, consent and transient
            # failures all fail closed, without claiming they are region blocks.
            blocked = state in ('UNPLAYABLE', 'ERROR')
            return observation(video_id, at, 'watch', 'blocked' if blocked else 'unknown',
                               'unavailable' if blocked else 'login_or_player_error', countries)
        if status.get('playableInEmbed') is not True:
            return observation(video_id, at, 'watch', 'blocked', 'embedding_not_allowed', countries)
        if not valid:
            return observation(video_id, at, 'watch', reason='missing_country_metadata')
        return observation(video_id, at, 'watch', 'playable', 'available', countries)
    except (ValueError, TypeError, AttributeError):
        return observation(video_id, at, 'watch', reason='malformed_player_response')


def watch(video_id, at, get):
    try:
        response = get('https://www.youtube.com/watch', params={'v': video_id, 'hl': 'en'},
                       timeout=(5, 20), stream=True)
        try:
            data = bytearray()
            for chunk in response.iter_content(chunk_size=65536):
                data.extend(chunk)
                if len(data) > MAX_PAGE_BYTES:
                    return observation(video_id, at, 'watch', reason='page_too_large')
            return parse_watch(video_id, data.decode('utf-8', errors='replace'), at)
        finally:
            response.close()
    except Exception as exc:
        # Exception messages/URLs can contain credentials. Persist only the type.
        return observation(video_id, at, 'watch', reason='request_failed_' + type(exc).__name__)


def parse_api(video_id, item, at):
    if item is None:
        return observation(video_id, at, 'api', 'blocked', 'private_deleted_or_missing')
    if item.get('id') != video_id:
        return observation(video_id, at, 'api', reason='mismatched_video')
    details, status = item.get('contentDetails'), item.get('status')
    if not isinstance(details, dict) or not isinstance(status, dict) or not all(
            k in status for k in ('privacyStatus', 'uploadStatus', 'embeddable')):
        return observation(video_id, at, 'api', reason='missing_content_details_or_status')
    restriction = details.get('regionRestriction', {})
    if not isinstance(restriction, dict):
        return observation(video_id, at, 'api', reason='malformed_region_restriction')
    for name, values in restriction.items():
        if name not in ('allowed', 'blocked') or not isinstance(values, list) or not all(
                isinstance(c, str) and re.fullmatch('[A-Z]{2}', c) for c in values):
            return observation(video_id, at, 'api', reason='malformed_region_restriction')
    countries = {c: (c in restriction['allowed'] if 'allowed' in restriction else True)
                   and c not in restriction.get('blocked', []) for c in COUNTRIES}
    if countries['DE'] is False:
        return observation(video_id, at, 'api', 'blocked', 'region_blocked', countries)
    if status.get('privacyStatus') not in ('public', 'unlisted') or status.get('uploadStatus') != 'processed':
        return observation(video_id, at, 'api', 'blocked', 'not_public_or_processed', countries)
    if status.get('embeddable') is not True or details.get('contentRating', {}).get('ytRating') == 'ytAgeRestricted':
        return observation(video_id, at, 'api', 'blocked', 'embedding_or_age_restricted', countries)
    return observation(video_id, at, 'api', 'playable', 'available', countries)


def hydrate(posts, *, settings=None, prior=None, at=None, force=False, get=http_get):
    at, prior, settings = at or now(), prior or {}, settings or {}
    unique = {p['source_id']: p for p in posts if p['source'] == 'youtube'}
    if len(unique) > MAX_VIDEOS:
        raise ValueError('YouTube playability cap exceeded; refusing partial checks')
    found, pending = {}, []
    for video_id, post in unique.items():
        cached = prior.get((post['post_id'], post['content_hash']), {})
        if not isinstance(video_id, str) or not VIDEO_ID.fullmatch(video_id):
            found[video_id] = observation(video_id, at, 'watch', 'blocked', 'invalid_video_id')
        elif not force and fresh(cached, video_id, at):
            found[video_id] = cached
        else:
            pending.append(video_id)
    key = settings.get('YOUTUBE_API_KEY')
    if key:
        for offset in range(0, len(pending), 50):
            batch = pending[offset:offset + 50]
            try:
                body = get('https://www.googleapis.com/youtube/v3/videos', params={
                    'part': 'contentDetails,status', 'id': ','.join(batch), 'key': key}, timeout=(5, 20)).json()
                if not isinstance(body.get('items'), list):
                    continue
                items = {item['id']: item for item in body['items']}
                for video_id in batch:
                    found[video_id] = parse_api(video_id, items.get(video_id), at)
            except Exception:
                # No key/quota/provider failure may bypass checking. The free
                # watch-page fallback is independently fail closed.
                continue
    pending = [v for v in pending if v not in found]
    with ThreadPoolExecutor(max_workers=4) as pool:
        found.update(zip(pending, pool.map(lambda v: watch(v, at, get), pending)))
    for post in posts:
        if post['source'] == 'youtube':
            post['youtube_playability'] = found[post['source_id']]
    return {'checked': len(unique), 'cached': sum(found[v] is prior.get((p['post_id'], p['content_hash']))
                                               for v, p in unique.items()),
            'statuses': {s: sum(e['status'] == s for e in found.values()) for s in ('playable', 'blocked', 'unknown')}}


def main():
    return {'library': True}
