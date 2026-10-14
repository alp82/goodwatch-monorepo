"""Social flow contracts; external HTTP/SQL only are substituted."""
import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1] / 'windmill'))
class Response:
    def __init__(self, body):
        self.body = body
    def json(self):
        return self.body
    def close(self):
        pass


class BlueskyTests(unittest.TestCase):
    def test_profile_opt_out_overrides_public_post(self):
        from f.social import bluesky
        def get(url, **kwargs):
            if url.endswith('searchPosts'):
                return Response({'posts': [{'uri': 'at://did:plc:abc/app.bsky.feed.post/1',
                    'author': {'did': 'did:plc:abc', 'handle': 'author.test'},
                    'record': {'createdAt': '2026-10-13T12:00:00Z', 'text': 'Dune movie'}}]})
            return Response({'profiles': [{'did': 'did:plc:abc', 'labels': [{'val': '!no-unauthenticated'}]}]})
        result = bluesky.collect({}, datetime(2026, 10, 12, tzinfo=timezone.utc),
                                 datetime(2026, 10, 14, tzinfo=timezone.utc), get=get, queries=['movie'])
        self.assertEqual(result['posts'], [])

class FeedTests(unittest.TestCase):
    def test_rss_canonicalizes_tracking_links_and_keeps_article_author(self):
        from f.social import rss
        response = Response(None)
        response.content = b'''<rss><channel><item><title>Dune &amp; cinema</title>
          <link>https://variety.com/dune/?utm_source=feed</link>
          <pubDate>Tue, 13 Oct 2026 12:00:00 GMT</pubDate>
          <description>&lt;p&gt;A review&lt;/p&gt;</description>
          <dc:creator xmlns:dc="http://purl.org/dc/elements/1.1/">Reviewer</dc:creator>
          </item></channel></rss>'''
        result = rss.collect({}, datetime(2026, 10, 12, tzinfo=timezone.utc),
                             datetime(2026, 10, 14, tzinfo=timezone.utc),
                             get=lambda *a, **k: response, feeds=['https://variety.com/feed/'])
        self.assertEqual(len(result['posts']), 1)
        self.assertEqual(result['posts'][0]['url'], 'https://variety.com/dune/')
        self.assertEqual(result['posts'][0]['author'], 'Reviewer')

class YoutubeTests(unittest.TestCase):
    def test_uploads_playlist_preserves_official_channel_identity(self):
        from f.social import youtube
        def get(url, **kwargs):
            self.assertEqual(kwargs['params']['playlistId'], 'UUabc')
            return Response({'items': [{'snippet': {'title': 'Dune | Official Trailer',
                'description': 'A new movie', 'channelId': 'UCabc', 'channelTitle': 'Studio',
                'publishedAt': '2026-10-13T12:00:00Z', 'resourceId': {'videoId': 'abcdefghijk'}}}]})
        result = youtube.collect({'YOUTUBE_API_KEY': 'fixture'}, datetime(2026, 10, 12, tzinfo=timezone.utc),
                                 datetime(2026, 10, 14, tzinfo=timezone.utc), get=get, channels={'Studio': 'UCabc'})
        self.assertEqual(result['posts'][0]['author_id'], 'UCabc')
        self.assertEqual(result['posts'][0]['source_id'], 'abcdefghijk')
        self.assertEqual(result['audit'][0]['route'], 'uploads_playlist')

class MastodonTests(unittest.TestCase):
    def test_boosted_trends_keep_origin_status_identity(self):
        from f.social import mastodon
        status = {'id': '99', 'uri': 'https://origin.example/users/alice/statuses/42',
                  'url': 'https://origin.example/@alice/42', 'created_at': '2026-10-13T12:00:00Z',
                  'content': '<p>Dune movie</p>', 'account': {'acct': 'alice@origin.example',
                  'url': 'https://origin.example/@alice'}, 'media_attachments': []}
        result = mastodon.collect({}, datetime(2026, 10, 12, tzinfo=timezone.utc),
                                  datetime(2026, 10, 14, tzinfo=timezone.utc),
                                  get=lambda *a, **k: Response([{'reblog': status}]), instances=['https://relay.example'])
        self.assertEqual(result['posts'][0]['source_id'], 'https://origin.example/users/alice/statuses/42')
        self.assertEqual(result['posts'][0]['url'], 'https://origin.example/@alice/42')

class MatcherTests(unittest.TestCase):
    def test_ungrounded_extraction_cannot_publish_even_with_high_confidence(self):
        from f.social.matcher import Matcher
        from f.social.common import post
        item = post('rss', 'https://news.example/a', 'https://news.example/a', 'news', 'News',
                    '2026-10-13T12:00:00Z', 'Studio announces earnings', '', 'feed:test')
        def sql(*a):
            self.fail('Ungrounded proposals must not query candidates')
        def llm(prompt, items):
            return [{'id': items[0]['id'], 'entities': [{'mention': 'Dune', 'evidence': 'Dune', 'confidence': 1}]}]
        self.assertEqual(Matcher(sql, llm=llm).match([item])[item['post_id']], [])

    def test_collision_requires_explicit_identity_and_candidate_id(self):
        from f.social.matcher import Matcher
        from f.social.rules import EXTRACT_PROMPT
        from f.social.common import post
        item = post('rss', 'https://news.example/dune', 'https://news.example/dune', 'news', 'News',
                    '2026-10-13T12:00:00Z', 'Dune trailer', '', 'feed:test')
        rows = [{'tmdb_id': i, 'title': 'Dune', 'original_title': 'Dune', 'release_year': year, 'popularity': 5}
                for i, year in [(841, 1984), (438631, 2021)]]
        def sql(query, params):
            if 'FROM movie ' in query:
                return rows
            return []
        def llm(prompt, items):
            if prompt == EXTRACT_PROMPT:
                return [{'id': item['post_id'], 'entities': [{'mention': 'Dune', 'evidence': 'Dune', 'confidence': .99}]}]
            return [{'id': item['post_id'], 'links': [
                {'entity_index': 0, 'key': 'movie:438631', 'confidence': .99, 'context_disambiguated': False},
                {'entity_index': 0, 'key': 'movie:999999', 'confidence': 1, 'context_disambiguated': True}]}]
        self.assertEqual(Matcher(sql, llm=llm).match([item])[item['post_id']], [])

class StorageTests(unittest.TestCase):
    def test_sql_client_refuses_writes_outside_social_tables(self):
        from f.social.store import Crate
        client = Crate({})
        for query in ['UPDATE movie SET title=?', 'DELETE FROM doc.user',
                      'INSERT INTO social_post_backup (x) VALUES (?)', 'DROP TABLE doc.social_post',
                      'SELECT 1; DELETE FROM movie']:
            with self.subTest(query=query), self.assertRaises(ValueError):
                client.execute(query, [])

class DeletionTests(unittest.TestCase):
    def test_rate_limit_never_becomes_a_deletion(self):
        from f.social.maintenance import source_state
        import requests
        def limited(*a, **k):
            response = Response(None)
            response.status_code = 429
            raise requests.HTTPError(response=response)
        state = source_state({'source': 'rss', 'url': 'https://variety.com/a'}, {}, get=limited)
        self.assertEqual(state, 'unknown')

    def test_bluesky_missing_post_is_removed_but_profile_failure_is_unknown(self):
        from f.social.maintenance import source_state
        p = {'source': 'bluesky', 'source_id': 'at://did:plc:abc/app.bsky.feed.post/1', 'author_id': 'did:plc:abc'}
        self.assertEqual(source_state(p, {}, get=lambda *a, **k: Response({'posts': []})), 'deleted')
        def unavailable_profile(url, **kwargs):
            if url.endswith('getPosts'):
                return Response({'posts': [{'uri': p['source_id']}]})
            raise TimeoutError('profile timeout')
        self.assertEqual(source_state(p, {}, get=unavailable_profile), 'unknown')

class TrailerTests(unittest.TestCase):
    def test_different_numbered_cuts_and_explicit_languages_stay_separate(self):
        from f.social.store import duplicate_group
        def trailer(text):
            return duplicate_group({'post_id': 'fixture', 'source': 'youtube', 'text': text})
        self.assertNotEqual(trailer('Dune | Official Trailer'), trailer('Dune | Official Trailer 2'))
        self.assertNotEqual(trailer('Dune | Official Trailer | English'), trailer('Dune | Official Trailer | Hindi'))

class FlowTests(unittest.TestCase):
    def test_checked_in_flow_inputs_reach_public_script_entrypoints(self):
        import inspect
        import json
        from f.social import ingest, maintenance
        root = Path(__file__).parents[1] / 'windmill/f/social'
        for name, module in [('discover', ingest), ('deletion_sync', maintenance)]:
            flow = json.loads((root / (name + '.flow/flow.yaml')).read_text())
            step = flow['value']['modules'][0]['value']
            self.assertEqual(set(step['input_transforms']), set(inspect.signature(module.main).parameters))
            for field, value in step['input_transforms'].items():
                self.assertEqual(value['expr'], 'flow_input.' + field)
                self.assertIn('default', flow['schema']['properties'][field])

class IndexedRetrievalTests(unittest.TestCase):
    def test_phrase_neighbor_does_not_become_an_exact_title(self):
        from f.social.matcher import Matcher
        from f.social.rules import EXTRACT_PROMPT
        from f.social.common import post
        item = post('rss', 'https://news.example/dune2', 'https://news.example/dune2', 'news', 'News',
                    '2026-10-13T12:00:00Z', 'Dune official trailer', '', 'test')
        def sql(query, params):
            if 'FROM movie ' in query:
                return [{'tmdb_id': 1, 'title': 'Making Dune', 'original_title': 'Making Dune', 'release_year': 2021}]
            return []
        def llm(prompt, items):
            self.assertEqual(prompt, EXTRACT_PROMPT)
            return [{'id': item['post_id'], 'entities': [{'mention': 'Dune', 'evidence': 'Dune', 'confidence': .99}]}]
        self.assertEqual(Matcher(sql, llm=llm).match([item])[item['post_id']], [])

    def test_missing_display_title_can_use_original_title(self):
        from f.social.matcher import Matcher
        from f.social.rules import EXTRACT_PROMPT
        from f.social.common import post
        item = post('rss', 'https://news.example/null-title', 'https://news.example/null-title', 'news', 'News',
                    '2026-10-13T12:00:00Z', 'Dune trailer', '', 'test')
        def sql(query, params):
            if 'FROM movie ' in query:
                return [{'tmdb_id': 438631, 'title': None, 'original_title': 'Dune', 'release_year': 2021}]
            return []
        def llm(prompt, items):
            if prompt == EXTRACT_PROMPT:
                return [{'id': item['post_id'], 'entities': [{'mention': 'Dune', 'evidence': 'Dune', 'confidence': .99}]}]
            return [{'id': item['post_id'], 'links': [{'entity_index': 0, 'key': 'movie:438631', 'confidence': .99}]}]
        self.assertEqual(Matcher(sql, llm=llm).match([item])[item['post_id']][0]['key'], 'movie:438631')

class TrailerTitleTests(unittest.TestCase):
    def test_title_word_trailer_does_not_collapse_different_clips(self):
        from f.social.store import duplicate_group
        a = duplicate_group({'post_id': 'clip-a', 'source': 'youtube', 'text': 'Trailer Park Boys | Behind the scenes'})
        b = duplicate_group({'post_id': 'clip-b', 'source': 'youtube', 'text': 'Trailer Park Boys | Cast interview'})
        self.assertNotEqual(a, b)

class QuotaTests(unittest.TestCase):
    def test_rate_limited_batch_does_not_fan_out_into_singleton_requests(self):
        from unittest.mock import patch
        from f.social.matcher import OpenRouter
        from f.social.rules import EXTRACT_PROMPT
        response = Response(None)
        response.status_code = 429
        def limited(url, **kwargs):
            self.assertEqual(len(kwargs['json']['messages']), 2)
            import json
            self.assertEqual(len(json.loads(kwargs['json']['messages'][1]['content'])['items']), 8)
            return response
        with patch('requests.post', side_effect=limited), patch('time.sleep'):
            with self.assertRaisesRegex(RuntimeError, 'transient'):
                OpenRouter('fixture')(EXTRACT_PROMPT, [{'id': str(i)} for i in range(8)])

class ContextTests(unittest.TestCase):
    def test_gate_receives_bounded_deduplicated_creator_context(self):
        from f.social.matcher import Matcher
        from f.social.rules import EXTRACT_PROMPT
        from f.social.common import post
        item = post('rss', 'https://news.example/context', 'https://news.example/context', 'news', 'News',
                    '2026-10-13T12:00:00Z', 'Dune trailer', '', 'test')
        def sql(query, params):
            if 'FROM movie ' in query:
                return [{'tmdb_id': 438631, 'title': 'Dune', 'original_title': 'Dune', 'release_year': 2021}]
            if 'FROM person_worked_on ' in query:
                return [{'media_tmdb_id': 438631, 'person_tmdb_id': i, 'job': 'Director'} for i in range(20)] * 2
            if 'FROM person WHERE' in query:
                return [{'tmdb_id': i, 'name': 'Director ' + str(i)} for i in range(20)]
            return []
        def llm(prompt, items):
            if prompt == EXTRACT_PROMPT:
                return [{'id': item['post_id'], 'entities': [{'mention': 'Dune', 'evidence': 'Dune', 'confidence': .99}]}]
            people = items[0]['entities'][0]['candidates'][0]['directors']
            self.assertEqual(len(people), 12)
            self.assertEqual(len(people), len(set(people)))
            return [{'id': item['post_id'], 'links': []}]
        Matcher(sql, llm=llm).match([item])

class SettingsTests(unittest.TestCase):
    def test_windmill_reuses_existing_qdrant_host_and_port_variables(self):
        from unittest.mock import patch
        from types import SimpleNamespace
        from f.social.settings import load
        variables = {'CRATE_HOSTS': 'http://crate.example:4200', 'CRATE_USER': 'fixture',
                     'CRATE_PASS': 'fixture-password', 'QDRANT_HOST': 'qdrant.example', 'QDRANT_PORT': '6333'}
        def variable(path):
            return variables[path.rsplit('/', 1)[1]]
        with patch.dict('os.environ', {'WM_JOB_ID': 'fixture'}, clear=True), patch.dict(sys.modules, {'wmill': SimpleNamespace(get_variable=variable)}):
            self.assertEqual(load()['QDRANT_URL'], 'http://qdrant.example:6333')

class AuthorOptOutTests(unittest.TestCase):
    def test_author_label_is_distinct_from_a_single_post_label(self):
        from f.social.maintenance import source_state
        p = {'source': 'bluesky', 'source_id': 'at://did:plc:abc/app.bsky.feed.post/1', 'author_id': 'did:plc:abc'}
        result = source_state(p, {}, get=lambda *a, **k: Response({'posts': [
            {'uri': p['source_id'], 'author': {'labels': [{'val': '!no-unauthenticated'}]}}]}))
        self.assertEqual(result, 'author_opt_out')
