"""Opt-in integration checks on the four NEW social tables only; fixtures are removed."""
import os
import sys
import unittest
from pathlib import Path
from uuid import uuid4

sys.path.insert(0, str(Path(__file__).parents[1] / 'windmill'))
from f.social.common import now, post
from f.social.store import Crate, Store


@unittest.skipUnless(os.environ.get('SOCIAL_TEST_ENV_FILE'), 'requires authorized social-table Crate access')
class CrateLifecycleTests(unittest.TestCase):
    def setUp(self):
        from dotenv import dotenv_values
        self.db = Crate(dotenv_values(os.environ['SOCIAL_TEST_ENV_FILE']))
        self.store = Store(self.db)
        self.store.initialize()
        self.posts = []
        self.title_id = 2000000000
        self.author_id = 'social-test-' + uuid4().hex
        self.link = {'key': f'movie:{self.title_id}', 'lane': 'foreground_exact', 'confidence': .99,
                     'confidence_basis': 'llm_self_report_not_calibrated', 'reason': 'Integration fixture'}

    def item(self, text='Integration fixture', source='rss'):
        identity = 'https://example.com/social-test-' + uuid4().hex
        item = post(source, identity, identity, self.author_id, 'Test fixture', now(), text, '', 'test:556')
        self.posts.append(item)
        self.store.save_posts([item])
        self.store.publish(item, [self.link])
        self.store.refresh()
        return item

    def tearDown(self):
        for p in self.posts:
            self.db.execute('DELETE FROM doc.social_title_link WHERE post_id=?', [p['post_id']])
            self.db.execute('DELETE FROM doc.social_link_report WHERE post_id=?', [p['post_id']])
            self.db.execute('DELETE FROM doc.social_post WHERE post_id=?', [p['post_id']])
        self.store.refresh()

    def test_report_hides_immediately_and_survives_rerun(self):
        item = self.item()
        self.assertTrue(any(p['post_id'] == item['post_id'] for p in self.store.read_title('movie', self.title_id)))
        first = self.store.report('movie', self.title_id, item['post_id'], 'Wrong version')
        self.assertTrue(first['hidden'])
        self.store.publish(item, [self.link])
        self.store.refresh()
        self.assertFalse(any(p['post_id'] == item['post_id'] for p in self.store.read_title('movie', self.title_id)))
        self.assertEqual(first, self.store.report('movie', self.title_id, item['post_id']))

    def test_deletion_removes_card_and_prevents_resurrection(self):
        item = self.item()
        self.store.remove(item['post_id'], 'opt_out')
        self.store.save_posts([item])
        self.assertFalse(any(p['post_id'] == item['post_id'] for p in self.store.read_title('movie', self.title_id)))
        stored = self.db.select('SELECT text,author,url,source_id,deleted_at FROM doc.social_post WHERE post_id=?', [item['post_id']])[0]
        self.assertIsNone(stored['text'])
        self.assertIsNone(stored['author'])
        self.assertIsNone(stored['url'])
        self.assertIsNone(stored['source_id'])
        self.assertIsNotNone(stored['deleted_at'])

    def test_disabling_lane_changes_reader_results(self):
        item = self.item()
        self.assertFalse(any(p['post_id'] == item['post_id'] for p in self.store.read_title('movie', self.title_id, disabled_lanes=['foreground_exact'])))

    def test_repeated_official_trailer_collapses_across_channels(self):
        a = self.item('Unique Test Movie | Official Trailer | Studio A', 'youtube')
        b = self.item('Unique Test Movie | Official Trailer | Studio B', 'youtube')
        result = [p for p in self.store.read_title('movie', self.title_id) if p['post_id'] in [a['post_id'], b['post_id']]]
        self.assertEqual(len(result), 1)

    def test_reprocessing_a_rejection_removes_old_match(self):
        item = self.item()
        self.store.publish(item, [])
        self.store.refresh()
        self.assertFalse(any(p['post_id'] == item['post_id'] for p in self.store.read_title('movie', self.title_id)))

    def test_author_opt_out_purges_all_of_their_stored_posts(self):
        first = self.item(source='bluesky')
        second = self.item(source='bluesky')
        removed = self.store.remove_author('bluesky', self.author_id)
        self.assertEqual(set(removed), {first['post_id'], second['post_id']})
        self.assertFalse(any(p['post_id'] in removed for p in self.store.read_title('movie', self.title_id)))
