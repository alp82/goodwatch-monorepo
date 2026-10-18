"""Opt-in integration checks on the social-owned tables only; fixtures are removed."""
import os
import sys
import unittest
from pathlib import Path
from uuid import uuid4

sys.path.insert(0, str(Path(__file__).parents[1] / 'windmill'))
from datetime import timedelta
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

    def item(self, text='A thoughtful review of this movie', source='rss'):
        identity = 'https://example.com/social-test-' + uuid4().hex
        item = post(source, identity, identity, self.author_id, 'Test fixture', now(), text, '', 'test:556')
        if source == 'youtube':
            from f.social.inventory import CHANNELS
            item.update(author_id=CHANNELS['Universal Pictures'], url='https://www.youtube.com/watch?v=fixture')
        if source == 'bluesky':
            item['quality_evidence'] = {'links_complete': True, 'urls': [], 'profile': {
                'present': True, 'created_at': (now()-timedelta(days=365)).isoformat(), 'posts_count': 50}}
        self.posts.append(item)
        self.store.save_posts([item])
        self.store.publish(item, [self.link])
        self.store.refresh()
        return item

    def tearDown(self):
        for p in self.posts:
            self.db.execute('DELETE FROM doc.social_title_link WHERE post_id=?', [p['post_id']])
            self.db.execute('DELETE FROM doc.social_link_report WHERE post_id=?', [p['post_id']])
            self.db.execute('DELETE FROM doc.social_content_quality WHERE post_id=?', [p['post_id']])
            self.db.execute('DELETE FROM doc.social_image WHERE post_id=?', [p['post_id']])
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

    def test_quality_gate_unpublishes_existing_link_and_blocks_direct_republication(self):
        item = self.item('Dune has beautiful images and an extraordinary score.')
        self.assertTrue(any(p['post_id'] == item['post_id'] for p in self.store.read_title('movie', self.title_id)))
        item['text'] = 'Dune full movie — watch free online now!'
        from f.social.common import digest
        item['content_hash'] = digest(item['text'] + '\n')
        self.store.save_posts([item])
        self.store.publish(item, [self.link])
        self.store.refresh()
        self.assertFalse(any(p['post_id'] == item['post_id'] for p in self.store.read_title('movie', self.title_id)))
        self.assertEqual(self.db.select('SELECT post_id FROM doc.social_title_link WHERE post_id=?', [item['post_id']]), [])

    def test_missing_quality_decision_and_changed_gate_version_are_hidden(self):
        item = self.item('Dune has beautiful images and an extraordinary score.')
        self.db.execute("UPDATE doc.social_content_quality SET version='outdated' WHERE post_id=?", [item['post_id']])
        self.store.refresh('social_content_quality')
        self.assertFalse(any(p['post_id'] == item['post_id'] for p in self.store.read_title('movie', self.title_id)))
        self.store.publish(item, [self.link])
        self.store.refresh()
        self.assertEqual(self.db.select('SELECT post_id FROM doc.social_title_link WHERE post_id=?', [item['post_id']]), [])
        self.db.execute('DELETE FROM doc.social_content_quality WHERE post_id=?', [item['post_id']])
        self.store.refresh('social_content_quality')
        self.assertFalse(any(p['post_id'] == item['post_id'] for p in self.store.read_title('movie', self.title_id)))

    def test_new_account_rejection_can_be_reprocessed_after_account_qualifies(self):
        item = self.item('A thoughtful review of Dune with lovely cinematography.', 'bluesky')
        item['quality_evidence']['profile']['created_at'] = now().isoformat()
        self.store.save_posts([item])
        self.assertFalse(any(p['post_id'] == item['post_id'] for p in self.store.pending('bluesky', 10000)))
        item['quality_evidence']['profile']['created_at'] = (now()-timedelta(days=365)).isoformat()
        self.store.save_posts([item])
        self.assertTrue(any(p['post_id'] == item['post_id'] for p in self.store.pending('bluesky', 10000)))

    def test_new_batch_repetition_revokes_earlier_links_by_same_author(self):
        first = self.item('Today we celebrate Dune, a classic movie from our daily movie archives. Join us every day for another amazing classic movie.', 'bluesky')
        second = self.item('Today we celebrate Alien, a classic movie from our daily movie archives. Join us every day for another amazing classic movie.', 'bluesky')
        third = self.item('Today we celebrate Jaws, a classic movie from our daily movie archives. Join us every day for another amazing classic movie.', 'bluesky')
        self.assertFalse(any(p['post_id'] in {first['post_id'], second['post_id'], third['post_id']} for p in self.store.read_title('movie', self.title_id)))
        self.store.publish(first, [self.link])
        self.store.refresh()
        self.assertFalse(any(p['post_id'] == first['post_id'] for p in self.store.read_title('movie', self.title_id)))

    def test_changed_hidden_link_target_rejects_without_changing_visible_text(self):
        item = self.item('A thoughtful review of Dune with lovely cinematography.', 'bluesky')
        original_hash = item['content_hash']
        item['quality_evidence']['urls'] = ['https://variety.com.evil.test/dune']
        self.store.save_posts([item])
        self.assertEqual(item['content_hash'], original_hash)
        self.store.publish(item, [self.link])
        self.store.refresh()
        self.assertFalse(any(p['post_id'] == item['post_id'] for p in self.store.read_title('movie', self.title_id)))
        self.assertFalse(any(p['post_id'] == item['post_id'] for p in self.store.pending('bluesky', 10000)))

    def test_invalidated_evidence_stays_hidden_if_post_save_fails(self):
        from unittest.mock import patch
        import requests
        item = self.item('A thoughtful review of Dune with lovely cinematography.', 'bluesky')
        item['quality_evidence']['urls'] = ['https://bit.ly/hidden-target']
        real_post = requests.post
        def fail_post_save(url, **kwargs):
            if kwargs.get('json', {}).get('stmt', '').startswith('INSERT INTO doc.social_post '):
                raise requests.ConnectionError('Fixture connection failure')
            return real_post(url, **kwargs)
        with patch('requests.post', side_effect=fail_post_save):
            with self.assertRaisesRegex(RuntimeError, 'unreachable'):
                self.store.save_posts([item])
        self.assertFalse(any(p['post_id'] == item['post_id'] for p in self.store.read_title('movie', self.title_id)))
        self.store.publish(item, [self.link])
        self.store.refresh()
        self.assertFalse(any(p['post_id'] == item['post_id'] for p in self.store.read_title('movie', self.title_id)))
