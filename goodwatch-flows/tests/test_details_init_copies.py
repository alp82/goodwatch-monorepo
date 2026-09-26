"""The daily init flows copy TMDB details into the DNA and critic collections in bounded reads."""
import io
import sys
import unittest
from datetime import date, datetime
from pathlib import Path
from unittest.mock import patch

import mongomock
from mongomock.collection import BulkOperationBuilder, Collection
from mongoengine import connect, disconnect, get_db

sys.path.insert(0, str(Path(__file__).parents[1] / 'windmill'))
from f.data_source import details_scan
from f.dna.init import main as dna_init
from f.metacritic_web.metacritic_init_ratings import main as metacritic_init
from f.rotten_web.rotten_tomatoes_init_ratings import main as rotten_init
from f.tvtropes_web.tvtropes_init_tags import main as tvtropes_init


def movie(tmdb_id, **fields):
    return {'tmdb_id': tmdb_id, 'title': f'Movie {tmdb_id}', 'original_title': f'Movie {tmdb_id}',
            'popularity': float(tmdb_id), 'overview': 'An overview.',
            'release_date': datetime(1999, 3, 31)} | fields


def show(tmdb_id, **fields):
    return {'tmdb_id': tmdb_id, 'title': f'Show {tmdb_id}', 'original_title': f'Show {tmdb_id}',
            'popularity': float(tmdb_id), 'overview': 'An overview.',
            'first_air_date': datetime(2008, 1, 20)} | fields


class ScanByIdTest(unittest.TestCase):
    def setUp(self):
        self.collection = mongomock.MongoClient().db.details

    def test_every_document_is_read_once_in_id_order_and_in_bounded_batches(self):
        self.collection.insert_many([{'tmdb_id': tmdb_id} for tmdb_id in (5, 1, 4, 2, 3)])
        batches = list(details_scan.scan_by_id(self.collection, {'tmdb_id': 1}, batch_size=2))
        self.assertEqual([len(batch) for batch in batches], [2, 2, 1])
        ids = [doc['_id'] for batch in batches for doc in batch]
        self.assertEqual(ids, sorted(ids))
        self.assertEqual(sorted(doc['tmdb_id'] for batch in batches for doc in batch), [1, 2, 3, 4, 5])

    def test_reads_filter_only_on_the_id_range(self):
        # Any other predicate could make one read walk the whole collection
        # looking for matches, which is what timed out on the 20 GB details.
        self.collection.insert_many([{'tmdb_id': tmdb_id} for tmdb_id in range(5)])
        filters = []
        find = Collection.find

        def spy(collection, filter=None, *args, **kwargs):
            filters.append(filter)
            return find(collection, filter, *args, **kwargs)

        with patch.object(Collection, 'find', spy):
            list(details_scan.scan_by_id(self.collection, {'tmdb_id': 1}, batch_size=2))
        self.assertEqual(filters[0], {})
        for query in filters[1:]:
            self.assertEqual(list(query), ['_id'])
            self.assertEqual(list(query['_id']), ['$gt'])

    def test_projection_keeps_only_the_requested_fields(self):
        self.collection.insert_one({'tmdb_id': 1, 'credits': {'cast': ['large']}})
        [[doc]] = details_scan.scan_by_id(self.collection, {'tmdb_id': 1})
        self.assertEqual(set(doc), {'_id', 'tmdb_id'})


class InitCopiesTest(unittest.TestCase):
    def setUp(self):
        disconnect()
        connect('init_copies_test', mongo_client_class=mongomock.MongoClient)
        self.addCleanup(disconnect)
        self.db = get_db()
        # mongomock 4.3 predates the `sort` argument pymongo passes for bulk updates.
        add_update = BulkOperationBuilder.add_update
        for patcher in (
            patch.object(BulkOperationBuilder, 'add_update',
                         lambda builder, *args, sort=None, **kwargs: add_update(builder, *args, **kwargs)),
            # A full count of the details collections scans every document.
            patch.object(Collection, 'count_documents', side_effect=AssertionError('count_documents')),
            patch.object(details_scan, 'SCAN_BATCH_SIZE', 2),
            patch('sys.stdout', new_callable=io.StringIO),
        ):
            patcher.start()
            self.addCleanup(patcher.stop)
        self.db.tmdb_movie_details.insert_many([
            movie(1), movie(2, title=None), movie(3, tmdb_deleted=True), movie(4, overview=None),
            movie(5, release_date=None), movie(6, tmdb_deleted=False),
        ])
        self.db.tmdb_tv_details.insert_many([show(10), show(11, tmdb_deleted=True), show(12)])

    def tmdb_ids(self, collection):
        return sorted(doc['tmdb_id'] for doc in self.db[collection].find())

    def test_critic_and_trope_collections_get_every_listed_title_with_a_title(self):
        for module, movies, shows in (
            (metacritic_init, 'metacritic_movie_rating', 'metacritic_tv_rating'),
            (rotten_init, 'rotten_tomatoes_movie_rating', 'rotten_tomatoes_tv_rating'),
            (tvtropes_init, 'tv_tropes_movie_tags', 'tv_tropes_tv_tags'),
        ):
            with self.subTest(module=module.__name__):
                result = module.initialize_documents()
                self.assertEqual(self.tmdb_ids(movies), [1, 4, 5, 6])
                self.assertEqual(self.tmdb_ids(shows), [10, 12])
                self.assertEqual(result['count_new_movies'], 4)
                self.assertEqual(result['count_new_tv'], 2)
                doc = self.db[movies].find_one({'tmdb_id': 1})
                self.assertEqual(doc['release_year'], 1999)
                self.assertEqual(doc['popularity'], 1.0)
                self.assertTrue(doc['title_variations'])
                self.assertEqual(self.db[shows].find_one({'tmdb_id': 10})['release_year'], 2008)

    def test_dna_gets_every_listed_title_with_title_date_and_overview(self):
        result = dna_init.initialize_documents()
        # DNA reads the original title; a missing localized title does not matter.
        self.assertEqual(self.tmdb_ids('dna_movie'), [1, 2, 6])
        self.assertEqual(self.tmdb_ids('dna_tv'), [10, 12])
        self.assertEqual((result['count_new_movies'], result['count_new_tv']), (3, 2))
        doc = self.db.dna_movie.find_one({'tmdb_id': 1})
        self.assertEqual((doc['release_year'], doc['overview']), (1999, 'An overview.'))

    def test_rerun_refreshes_popularity_without_duplicates_or_id_lists(self):
        for module, collection in (
            (dna_init, 'dna_movie'), (metacritic_init, 'metacritic_movie_rating'),
            (rotten_init, 'rotten_tomatoes_movie_rating'), (tvtropes_init, 'tv_tropes_movie_tags'),
        ):
            with self.subTest(module=module.__name__):
                module.initialize_documents()
                created_at = self.db[collection].find_one({'tmdb_id': 1})['created_at']
                self.db.tmdb_movie_details.update_one({'tmdb_id': 1}, {'$set': {'popularity': 99.0}})
                result = module.initialize_documents()
                self.assertEqual(result['count_new_movies'], 0)
                docs = list(self.db[collection].find({'tmdb_id': 1}))
                self.assertEqual(len(docs), 1)
                self.assertEqual(docs[0]['popularity'], 99.0)
                self.assertEqual(docs[0]['created_at'], created_at)
                # Flow results hold counts only; a million upserted ids do not fit a job result.
                self.assertFalse(any(isinstance(value, list) for value in result.values()))
                self.db.tmdb_movie_details.update_one({'tmdb_id': 1}, {'$set': {'popularity': 1.0}})


if __name__ == '__main__':
    unittest.main()
