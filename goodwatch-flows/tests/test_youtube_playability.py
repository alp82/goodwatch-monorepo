"""Playability at the actual relevance seam, including the production Narnia failure."""
import json
import sys
import unittest
from pathlib import Path
from datetime import datetime, timezone

sys.path.insert(0, str(Path(__file__).parents[1] / 'windmill'))
from f.social.relevance import judge_links
from f.social.inventory import CHANNELS

AT = datetime(2026, 10, 15, 18, tzinfo=timezone.utc)


def video(identifier='O8hR2dQGv0k'):
    return dict(media_type='movie', media_tmdb_id=1147572, post_id=identifier,
                source='youtube', source_id=identifier, content_hash='hash',
                author_id=CHANNELS['Netflix'], url='https://www.youtube.com/watch?v=' + identifier,
                text='NARNIA: THE MAGICIAN’S NEPHEW | Official Trailer | Netflix',
                context='', published_at='2026-10-13T18:00:00Z')


def judge(items):
    return judge_links(items, {'movie:1147572': {'title': "Narnia: The Magician's Nephew", 'release_year': 2027}}, at=AT)


class GateTests(unittest.TestCase):
    def test_narnia_au_nz_only_video_is_not_kept_in_germany(self):
        item = video() | {'youtube_playability': {
            'video_id': 'O8hR2dQGv0k', 'method': 'watch', 'checked_at': AT.isoformat(),
            'status': 'blocked', 'reason': 'region_blocked', 'countries': {'DE': False, 'US': False, 'GB': False}}}
        self.assertEqual(judge([item])[0]['status'], 'drop')

from unittest.mock import patch
from datetime import timedelta
from f.social import youtube_playability as yt


def player(identifier='gDJ-ini7fF0', **changes):
    return {'videoDetails': {'videoId': identifier},
            'microformat': {'playerMicroformatRenderer': {'externalVideoId': identifier, 'availableCountries': ['DE', 'US', 'GB']}},
            'playabilityStatus': {'status': 'OK', 'playableInEmbed': True}} | changes


def page(body):
    # The JSON parser must handle nested braces and escaped strings.
    return '<html><script>var ytInitialPlayerResponse = ' + json.dumps(body) + ';</script></html>'


def available(identifier='gDJ-ini7fF0'):
    return yt.parse_watch(identifier, page(player(identifier)), AT)


class WatchTests(unittest.TestCase):
    def test_real_narnia_region_metadata(self):
        body = json.loads((Path(__file__).parent / 'fixtures/social/youtube/narnia-au-nz.json').read_text())
        result = yt.parse_watch('O8hR2dQGv0k', page(body), AT)
        self.assertEqual(result['status'], 'blocked')
        self.assertEqual(result['reason'], 'region_blocked')
        self.assertEqual(result['countries'], {'DE': False, 'US': False, 'GB': False})

    def test_explicit_countries_player_and_embed_permission_are_all_required(self):
        self.assertEqual(available()['status'], 'playable')
        bad = [player(playabilityStatus={'status': 'OK', 'playableInEmbed': False}),
               player(playabilityStatus={'status': 'LOGIN_REQUIRED', 'reason': 'Sign in to confirm you are not a bot'}),
               player(microformat={}), player('anotherid01'),
               {'playabilityStatus': {'status': 'ERROR', 'reason': 'This video is private'}},
               {'playabilityStatus': {'status': 'ERROR', 'reason': 'This video has been removed'}}]
        for body in bad:
            with self.subTest(body=body):
                self.assertNotEqual(yt.parse_watch('gDJ-ini7fF0', page(body), AT)['status'], 'playable')
        for content in ('consent page', 'ytInitialPlayerResponse = {bad', page([])):
            self.assertEqual(yt.parse_watch('gDJ-ini7fF0', content, AT)['status'], 'unknown')

    def test_country_allowlist_empty_or_excluding_germany_is_blocked(self):
        for allowed in ([], ['AU', 'NZ'], ['US', 'GB']):
            result = yt.parse_watch('gDJ-ini7fF0', page(player(microformat={
                'playerMicroformatRenderer': {'availableCountries': allowed}})), AT)
            self.assertEqual(result['status'], 'blocked')
            self.assertIs(result['countries']['DE'], False)

    def test_transport_errors_and_oversize_responses_fail_closed_and_close(self):
        class Response:
            closed = False
            def iter_content(self, **kwargs):
                yield b'x' * (yt.MAX_PAGE_BYTES + 1)
            def close(self):
                self.closed = True
        response = Response()
        result = yt.watch('gDJ-ini7fF0', AT, lambda *a, **k: response)
        self.assertEqual(result['reason'], 'page_too_large')
        self.assertTrue(response.closed)
        def fail(*a, **k):
            raise TimeoutError('secret must not leak')
        result = yt.watch('gDJ-ini7fF0', AT, fail)
        self.assertEqual(result['reason'], 'request_failed_TimeoutError')
        self.assertNotIn('secret', json.dumps(result))


class ApiTests(unittest.TestCase):
    def item(self, **details):
        return {'id': 'gDJ-ini7fF0', 'contentDetails': details,
                'status': {'privacyStatus': 'public', 'uploadStatus': 'processed', 'embeddable': True}}

    def test_region_list_semantics_and_unavailable_videos(self):
        for restriction, expected in (({}, True), ({'allowed': []}, False), ({'blocked': []}, True),
            ({'allowed': ['US', 'GB']}, False), ({'blocked': ['DE']}, False), ({'allowed': ['DE']}, True)):
            with self.subTest(restriction=restriction):
                result = yt.parse_api('gDJ-ini7fF0', self.item(regionRestriction=restriction), AT)
                self.assertEqual(result['status'] == 'playable', expected)
                self.assertIs(result['countries']['DE'], expected)
        self.assertEqual(yt.parse_api('gDJ-ini7fF0', None, AT)['reason'], 'private_deleted_or_missing')
        for item in (self.item() | {'status': {'privacyStatus': 'private'}},
                     self.item() | {'status': {'privacyStatus': 'public', 'uploadStatus': 'processed', 'embeddable': False}},
                     self.item(contentRating={'ytRating': 'ytAgeRestricted'}),
                     self.item(regionRestriction={'allowed': 'DE'}), self.item() | {'id': 'anotherid01'},
                     {'id': 'gDJ-ini7fF0', 'status': self.item()['status']}):
            self.assertNotEqual(yt.parse_api('gDJ-ini7fF0', item, AT)['status'], 'playable')

    def test_batches_and_absence_from_successful_response(self):
        rows = [video(str(i).zfill(11)) for i in range(51)]
        calls = []
        class Response:
            def json(self):
                return {'items': []}
        def get(url, **kwargs):
            calls.append(kwargs['params'])
            return Response()
        yt.hydrate(rows, settings={'YOUTUBE_API_KEY': 'test-only'}, at=AT, get=get)
        self.assertEqual([len(c['id'].split(',')) for c in calls], [50, 1])
        self.assertTrue(all(p['youtube_playability']['reason'] == 'private_deleted_or_missing' for p in rows))

    def test_api_failure_falls_back_and_no_key_never_calls_api(self):
        for settings in ({}, {'YOUTUBE_API_KEY': 'test-only'}):
            calls = []
            class Response:
                def iter_content(self, **kwargs):
                    yield page(player('O8hR2dQGv0k')).encode()
                def close(self):
                    pass
            def get(url, **kwargs):
                calls.append(url)
                if 'googleapis' in url:
                    raise RuntimeError('quota')
                return Response()
            posts = [video()]
            yt.hydrate(posts, settings=settings, at=AT, get=get)
            self.assertEqual(posts[0]['youtube_playability']['status'], 'playable')
            self.assertEqual(len(calls), 2 if settings else 1)


class IntegrationTests(unittest.TestCase):
    def test_gate_never_promotes_missing_stale_future_wrong_video_or_unknown(self):
        evidence = available('O8hR2dQGv0k')
        for value in (None, {}, evidence | {'checked_at': (AT - timedelta(hours=1)).isoformat()},
                      evidence | {'checked_at': (AT + timedelta(seconds=1)).isoformat()},
                      available(), evidence | {'status': 'unknown'}, evidence | {'countries': {'DE': None}}):
            with self.subTest(evidence=value):
                self.assertEqual(judge([video() | {'youtube_playability': value}])[0]['status'], 'drop')

    def test_blocked_representative_cannot_suppress_playable_alternative_or_article(self):
        blocked = video() | {'youtube_playability': available('O8hR2dQGv0k') | {
            'status': 'blocked', 'reason': 'region_blocked', 'countries': {'DE': False}}}
        replacement = video('gDJ-ini7fF0') | {'youtube_playability': available()}
        results = judge([blocked, replacement])
        self.assertEqual([r['status'] for r in results], ['drop', 'keep'])
        article = video('article') | {'source': 'rss', 'url': 'https://variety.com/2026/narnia-trailer',
                                     'text': 'Narnia: The Magician’s Nephew | Official Trailer revealed'}
        self.assertEqual([r['status'] for r in judge([blocked, article])], ['drop', 'keep'])
        self.assertTrue(any(r.startswith('playability:') for r in results[0]['reasons']))

    def test_cache_expires_rechecks_private_video_and_force_bypasses_cache(self):
        v = video()
        prior = {(v['post_id'], v['content_hash']): available('O8hR2dQGv0k')}
        def fail(*a, **k):
            raise TimeoutError()
        result = yt.hydrate([v], prior=prior, at=AT, get=fail)
        self.assertEqual(result['cached'], 1)
        self.assertEqual(v['youtube_playability']['status'], 'playable')
        for options in ({'at': AT + timedelta(hours=1)}, {'at': AT, 'force': True}):
            result = yt.hydrate([v], prior=prior, get=fail, **options)
            self.assertEqual(result['cached'], 0)
            self.assertEqual(v['youtube_playability']['status'], 'unknown')
        # The content hash is part of the cache key, even when the source ID is unchanged.
        changed = v | {'content_hash': 'changed'}
        yt.hydrate([changed], prior=prior, at=AT, get=fail)
        self.assertEqual(changed['youtube_playability']['status'], 'unknown')
        class PrivateResponse:
            def iter_content(self, **kwargs):
                yield page({'playabilityStatus': {'status': 'ERROR', 'reason': 'This video is private'}}).encode()
            def close(self):
                pass
        yt.hydrate([v], prior=prior, at=AT + timedelta(hours=1), get=lambda *a, **k: PrivateResponse())
        self.assertEqual(v['youtube_playability']['status'], 'blocked')
        self.assertEqual(v['youtube_playability']['reason'], 'private_deleted_or_unavailable')

    def test_ingestion_hydrate_false_still_checks_and_persists_playability_only_in_relevance(self):
        from f.social.rejudge import run
        v = video()
        class Database:
            settings = {}
            def __init__(self):
                self.writes = []
            def select(self, sql, args=None):
                if 'FROM doc.social_title_link' in sql:
                    return [v | {'evidence': '{}'}]
                if 'FROM movie ' in sql:
                    return [{'tmdb_id': 1147572, 'title': "Narnia: The Magician's Nephew", 'release_year': 2027}]
                return []
            def execute(self, sql, args=None):
                self.writes.append((sql, args))
        def observe(posts, **kwargs):
            for p in posts:
                p['youtube_playability'] = available(p['source_id']) | {
                    'status': 'blocked', 'reason': 'region_blocked', 'countries': {'DE': False}}
            return {'statuses': {'blocked': 1}}
        db = Database()
        with patch('f.social.rejudge.youtube_playability.hydrate', side_effect=observe) as check:
            result = run(db, apply=True, hydrate=False, at=AT)
        check.assert_called_once()
        self.assertEqual(result['counts']['youtube']['keep'], 0)
        self.assertTrue(all('doc.social_relevance' in sql for sql, _ in db.writes))
        self.assertIn('youtube_region_blocked_DE', result['decisions'][0]['reasons'])


if __name__ == '__main__':
    unittest.main()
