"""Priority fingerprint seeding: which DNA titles f/dna/init/update returns and claims."""
import io
import sys
import unittest
from datetime import datetime, timedelta
from pathlib import Path
from unittest.mock import patch

import mongomock
from mongomock.collection import BulkOperationBuilder
from mongoengine import connect, disconnect

sys.path.insert(0, str(Path(__file__).parents[1] / 'windmill'))
from f.dna.init import update
from f.dna.models import DnaMovie, DnaTv
from f.tmdb_api.models import TmdbMovieDetails, TmdbTvDetails


class DnaInitUpdateTest(unittest.TestCase):
    def setUp(self):
        disconnect()
        connect('dna_init_test', mongo_client_class=mongomock.MongoClient, uuidRepresentation='standard')
        self.addCleanup(disconnect)
        for target in ('init_mongodb', 'close_mongodb'):
            patcher = patch.object(update, target)
            patcher.start()
            self.addCleanup(patcher.stop)
        # mongomock 4.3 predates the `sort` argument pymongo passes for bulk updates.
        add_update = BulkOperationBuilder.add_update
        patcher = patch.object(
            BulkOperationBuilder, 'add_update',
            lambda builder, *args, sort=None, **kwargs: add_update(builder, *args, **kwargs))
        patcher.start()
        self.addCleanup(patcher.stop)
        patcher = patch('sys.stdout', new_callable=io.StringIO)
        patcher.start()
        self.addCleanup(patcher.stop)

    def details(self, cls=TmdbMovieDetails, tmdb_id=603, **kwargs):
        return cls(tmdb_id=tmdb_id, original_title='The Matrix', popularity=1.0,
                   overview='A programmer discovers a simulated world.', **kwargs).save()

    def dna(self, cls=DnaMovie, tmdb_id=603, **kwargs):
        return cls(tmdb_id=tmdb_id, original_title='The Matrix', release_year=1999,
                   overview='Old overview.', popularity=1.0, **kwargs).save()

    def run_update(self, movies=(), tv=()):
        return update.main({'movie_ids': [str(entry.id) for entry in movies],
                            'tv_ids': [str(entry.id) for entry in tv]})

    def test_new_documents_are_returned_as_string_ids_and_claimed(self):
        movie = self.details()
        show = self.details(TmdbTvDetails, tmdb_id=1396)
        result = self.run_update([movie], [show])
        dna_movie = DnaMovie.objects.get(tmdb_id=603)
        dna_tv = DnaTv.objects.get(tmdb_id=1396)
        self.assertEqual(result, {'movie_ids': [str(dna_movie.id)], 'tv_ids': [str(dna_tv.id)]})
        for entry in (dna_movie, dna_tv):
            self.assertTrue(entry.is_selected)
            self.assertIsNotNone(entry.selected_at)

    def test_existing_document_without_fingerprint_is_returned_and_claimed(self):
        for index, fingerprint in enumerate((None, [])):
            with self.subTest(fingerprint=fingerprint):
                tmdb_id = 700 + index
                movie = self.details(tmdb_id=tmdb_id)
                existing = self.dna(tmdb_id=tmdb_id)
                if fingerprint is not None:
                    DnaMovie._get_collection().update_one(
                        {'_id': existing.id}, {'$set': {'vector_fingerprint': fingerprint}})
                result = self.run_update([movie])
                self.assertEqual(result, {'movie_ids': [str(existing.id)], 'tv_ids': []})
                existing.reload()
                self.assertTrue(existing.is_selected)
                self.assertGreater(existing.selected_at, datetime.utcnow() - timedelta(minutes=1))

    def test_existing_document_with_fingerprint_is_not_returned_or_claimed(self):
        movie = self.details()
        existing = self.dna(vector_fingerprint=[1.0, 2.0])
        result = self.run_update([movie])
        self.assertEqual(result, {'movie_ids': [], 'tv_ids': []})
        existing.reload()
        self.assertFalse(existing.is_selected)
        self.assertIsNone(existing.selected_at)
        # The copied title fields are still refreshed.
        self.assertEqual(existing.overview, 'A programmer discovers a simulated world.')

    def test_document_freshly_claimed_by_another_run_is_not_returned(self):
        movie = self.details()
        claimed_at = datetime.utcnow().replace(microsecond=0) - timedelta(minutes=5)
        existing = self.dna(is_selected=True, selected_at=claimed_at)
        result = self.run_update([movie])
        self.assertEqual(result, {'movie_ids': [], 'tv_ids': []})
        existing.reload()
        self.assertEqual(existing.selected_at, claimed_at)

    def test_released_document_with_recent_selection_is_returned(self):
        movie = self.details()
        existing = self.dna(is_selected=False, selected_at=datetime.utcnow() - timedelta(minutes=5))
        self.assertEqual(self.run_update([movie])['movie_ids'], [str(existing.id)])

    def test_stale_claim_is_taken_over(self):
        movie = self.details()
        stale_at = datetime.utcnow() - timedelta(minutes=update.BUFFER_SELECTED_AT_MINUTES + 1)
        existing = self.dna(is_selected=True, selected_at=stale_at)
        result = self.run_update([movie])
        self.assertEqual(result, {'movie_ids': [str(existing.id)], 'tv_ids': []})
        existing.reload()
        self.assertTrue(existing.is_selected)
        self.assertGreater(existing.selected_at, stale_at + timedelta(minutes=30))

    def test_recently_failed_generation_is_not_retried(self):
        movie = self.details()
        failed_at = datetime.utcnow().replace(microsecond=0) - timedelta(days=update.FAILED_COOLDOWN_DAYS - 1)
        existing = self.dna(failed_at=failed_at, error_message='Generation failed after 6 requests')
        result = self.run_update([movie])
        self.assertEqual(result, {'movie_ids': [], 'tv_ids': []})
        existing.reload()
        self.assertFalse(existing.is_selected)
        self.assertEqual(existing.failed_at, failed_at)

    def test_failed_generation_is_retried_after_the_cooldown(self):
        movie = self.details()
        failed_at = datetime.utcnow() - timedelta(days=update.FAILED_COOLDOWN_DAYS + 1)
        existing = self.dna(failed_at=failed_at)
        result = self.run_update([movie])
        self.assertEqual(result, {'movie_ids': [str(existing.id)], 'tv_ids': []})
        existing.reload()
        self.assertTrue(existing.is_selected)

    def test_tmdb_deleted_title_seeds_no_work(self):
        movie = self.details(tmdb_deleted=True)
        existing = self.dna()
        show = self.details(TmdbTvDetails, tmdb_id=1396, tmdb_deleted=True)
        result = self.run_update([movie], [show])
        self.assertEqual(result, {'movie_ids': [], 'tv_ids': []})
        existing.reload()
        self.assertFalse(existing.is_selected)
        self.assertEqual(DnaTv.objects.count(), 0)

    def test_buffer_matches_the_scheduled_selector(self):
        from f.dna.generate import next as selector
        self.assertEqual(update.BUFFER_SELECTED_AT_MINUTES, selector.BUFFER_SELECTED_AT_MINUTES)


if __name__ == '__main__':
    unittest.main()
