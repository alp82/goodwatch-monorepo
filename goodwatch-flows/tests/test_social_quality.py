"""Publication safety decisions through the public quality gate."""
import sys
import unittest
from pathlib import Path
from datetime import timedelta
sys.path.insert(0, str(Path(__file__).parents[1] / 'windmill'))
from f.social.common import post, now


class QualityTests(unittest.TestCase):
    def item(self, text, source='bluesky', urls=()):
        item = post(source, 'fixture', 'https://bsky.app/profile/alice/post/1', 'alice', 'Alice', now(), text, '', 'test')
        item['quality_evidence'] = {'links_complete': True, 'urls': list(urls), 'profile': {
            'present': True, 'created_at': (now() - timedelta(days=365)).isoformat(), 'posts_count': 100}}
        return item

    def test_promotional_streams_cannot_pass_even_with_good_title_identity(self):
        from f.social.quality import evaluate
        for source in ['bluesky', 'rss', 'mastodon']:
            for text in ['Dune — watch free online now!', 'Dune full movie 1080p', 'Dune HD stream here',
                         'Download Dune now', 'Dune at 123movies', 'Dune Stream Free Online']:
                with self.subTest(source=source, text=text):
                    self.assertIn('stream_promotion', evaluate(self.item(text, source))['reasons'])
        self.assertEqual(evaluate(self.item('Dune has beautiful images and an extraordinary score.'))['status'], 'pass')

    def test_outbound_targets_fail_closed_and_allowlist_cannot_be_spoofed(self):
        from f.social.quality import evaluate
        for url in ['https://123movies.example/watch', 'https://variety.com.evil.test/a',
                    'https://variety.com@evil.test/a', 'https://bit.ly/safe-looking',
                    'https://example.com/movie', 'https://youtube.com/watch?v=piracy']:
            with self.subTest(url=url):
                self.assertEqual(evaluate(self.item('Read my detailed review of Dune here.', urls=[url]))['status'], 'reject')
        self.assertEqual(evaluate(self.item('Read this detailed review of Dune here.', urls=['https://www.variety.com/film/dune']))['status'], 'pass')
        self.assertEqual(evaluate(self.item('Dune is an amazing movie https://tinyurl.com/a', 'rss'))['status'], 'reject')
        missing = self.item('Dune has beautiful images and an extraordinary score.')
        del missing['quality_evidence']
        self.assertEqual(evaluate(missing)['status'], 'reject')

    def test_hashtags_and_a_link_are_not_discussion(self):
        from f.social.quality import evaluate
        for text in ['#Dune #Cinema https://variety.com/dune', '🎬 #Dune www.variety.com/dune',
                     'Dune https://variety.com/dune']:
            self.assertIn('no_substantive_text', evaluate(self.item(text))['reasons'])

    def test_account_signals_reject_new_empty_high_volume_and_declared_bots(self):
        from f.social.quality import evaluate
        cases = [({}, 'missing_profile_evidence'),
                 ({'present': False}, 'no_profile'),
                 ({'created_at': now().isoformat()}, 'new_account'),
                 ({'posts_count': 1000000}, 'high_post_rate'),
                 ({'bot': True}, 'declared_bot')]
        for updates, reason in cases:
            item = self.item('Dune has beautiful images and an extraordinary score.')
            if updates:
                item['quality_evidence']['profile'].update(updates)
            else:
                del item['quality_evidence']['profile']
            with self.subTest(reason=reason):
                self.assertIn(reason, evaluate(item)['reasons'])
        item = self.item('Dune has beautiful images and an extraordinary score.', 'mastodon')
        item['quality_evidence']['profile']['bot'] = True
        self.assertIn('declared_bot', evaluate(item)['reasons'])

    def test_near_identical_cross_title_templates_reject_the_author(self):
        from f.social.quality import evaluate_batch
        items = []
        for i, title in enumerate(['Dune', 'Alien', 'Jaws']):
            item = self.item(f'Today we celebrate {title}, a classic movie from our daily movie archives. Join us every day for another amazing classic movie.')
            item['post_id'] = str(i)
            items.append(item)
        self.assertTrue(all('repetitive_author' in d['reasons'] for d in evaluate_batch(items).values()))
        items[2]['author_id'] = 'different'
        self.assertTrue(all('repetitive_author' not in d['reasons'] for d in evaluate_batch(items).values()))

    def test_bluesky_adapter_preserves_hidden_link_targets_and_profile_signals(self):
        from f.social import bluesky
        class Reply:
            def __init__(self, body): self.body = body
            def json(self): return self.body
        def get(url, **kwargs):
            if url.endswith('getProfiles'):
                return Reply({'profiles': [{'did': 'alice', 'displayName': 'Alice', 'createdAt': '2025-01-01T00:00:00Z', 'postsCount': 42}]})
            return Reply({'posts': [{'uri': 'at://alice/app.bsky.feed.post/1', 'author': {'did': 'alice', 'handle': 'alice.test'},
                'record': {'createdAt': now().isoformat(), 'text': 'Dune has beautiful images and a fine score.',
                           'facets': [{'features': [{'$type': 'app.bsky.richtext.facet#link', 'uri': 'https://evil.test/movie'}]}],
                           'embed': {'external': {'uri': 'https://variety.com/dune', 'title': 'Dune review'}}}}]})
        result = bluesky.collect({}, now() - timedelta(days=1), now() + timedelta(seconds=5), get=get, queries=['movie'])
        item = result['posts'][0]
        from f.social.quality import evaluate
        self.assertEqual(item['quality_evidence']['profile']['posts_count'], 42)
        self.assertIn('https://evil.test/movie', item['quality_evidence']['urls'])
        self.assertIn('unapproved_link_domain', evaluate(item)['reasons'])

    def test_mastodon_hidden_shortlink_and_bot_metadata_reach_gate(self):
        from f.social import mastodon
        from f.social.quality import evaluate
        class Reply:
            def json(self):
                return [{'uri': 'https://mastodon.social/users/alice/statuses/123',
                    'url': 'https://mastodon.social/@alice/123', 'created_at': now().isoformat(),
                    'content': '<p>A thoughtful review of Dune <a href="https://bit.ly/piracy">Read more</a></p>',
                    'account': {'url': 'https://mastodon.social/@alice', 'acct': 'alice', 'bot': True,
                                'display_name': 'Alice', 'created_at': '2025-01-01T00:00:00Z', 'statuses_count': 20}}]
        result = mastodon.collect({}, now()-timedelta(days=1), now()+timedelta(seconds=5), get=lambda *a, **k: Reply(), instances=['https://mastodon.social'])
        reasons = evaluate(result['posts'][0])['reasons']
        self.assertIn('declared_bot', reasons)
        self.assertIn('link_shortener', reasons)

    def test_short_rss_headline_with_editorial_summary_is_substantive(self):
        from f.social.quality import evaluate
        item = self.item('Whalefall', 'rss')
        item['context'] = 'A grieving son is swallowed by a whale during a dive.'
        self.assertEqual(evaluate(item)['status'], 'pass')

    def test_multiline_frame_bot_and_compact_promotional_hashtags_are_rejected(self):
        from f.social.quality import evaluate
        item = self.item('Mobile Suit Gundam (2015)\nEpisode 14 - Vessel of Hope\n22:19.779')
        self.assertIn('automated_frame_post', evaluate(item)['reasons'])
        self.assertIn('stream_promotion', evaluate(self.item('The latest Dune movie is here #WatchFree #FullMovie'))['reasons'])

    def test_missing_account_metrics_and_invisible_promotion_fail_closed(self):
        from f.social.quality import evaluate
        item = self.item('Dune has beautiful images and an extraordinary score.')
        item['quality_evidence']['profile']['created_at'] = None
        self.assertIn('missing_account_metrics', evaluate(item)['reasons'])
        self.assertIn('stream_promotion', evaluate(self.item('Dune w\u200batch free tonight and enjoy it.'))['reasons'])
