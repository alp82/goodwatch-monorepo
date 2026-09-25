"""Exercise ratings publication with incomplete source metadata, without live services."""
import sys
import unittest
from datetime import datetime, timedelta
from pathlib import Path
from unittest.mock import Mock, patch

import mongomock
from mongoengine import connect, disconnect

sys.path.insert(0, str(Path(__file__).parents[1] / 'windmill'))
from f.sync.copy import all_ratings


class RatingsPublicationTest(unittest.TestCase):
    def setUp(self):
        disconnect()
        self.mongo = connect('ratings_test', mongo_client_class=mongomock.MongoClient,
                             uuidRepresentation='standard').get_database('ratings_test')
        self.addCleanup(disconnect)
        self.connector = Mock()
        self.connector.upsert_many.side_effect = lambda **kwargs: {
            'records_received': len(kwargs['records']), 'rows_upserted': len(kwargs['records'])}

    def test_priority_publication_preserves_rating_without_updated_at(self):
        self.mongo.imdb_movie_rating.insert_one({
            'tmdb_id': 603, 'created_at': datetime(2026, 9, 14),
            'user_score_original': 8.7, 'user_score_normalized_percent': 87,
            'user_score_vote_count': 100,
        })
        result = all_ratings.copy_media(self.connector, {'tmdb_id': {'$in': [603]}},
                                        'movie', recent_only=False)
        published = self.connector.upsert_many.call_args.kwargs['records'][0]
        self.assertEqual(published.imdb_user_score_original, 8.7)
        self.assertEqual(published.imdb_user_score_rating_count, 100)
        self.assertIsNone(published.imdb_ratings_updated_at)
        self.assertEqual(result['movies']['rows_upserted'], 1)

    def test_all_rating_sources_allow_missing_or_null_timestamps_for_movies_and_shows(self):
        for media_type, suffix in [('movie', 'movie'), ('show', 'tv')]:
            for source in ['imdb', 'metacritic', 'rotten_tomatoes']:
                for timestamps in [{}, {'created_at': None, 'updated_at': None},
                                   {'updated_at': datetime(2026, 9, 14)}]:
                    with self.subTest(media_type=media_type, source=source, timestamps=timestamps):
                        collection = self.mongo[f'{source}_{suffix}_rating']
                        collection.delete_many({})
                        collection.insert_one({'tmdb_id': 550, **timestamps})
                        result = all_ratings.copy_media(
                            self.connector, {'tmdb_id': {'$in': [550]}}, media_type, recent_only=False)
                        published = self.connector.upsert_many.call_args.kwargs['records'][0]
                        self.assertIsNone(getattr(published, f'{source}_ratings_created_at'))
                        expected = timestamps.get('updated_at')
                        self.assertEqual(getattr(published, f'{source}_ratings_updated_at'),
                                         expected.timestamp() if expected else None)
                        self.assertEqual(result['movies' if media_type == 'movie' else 'shows']['rows_upserted'], 1)
                        collection.delete_many({})

    def test_rotten_tomatoes_and_metacritic_values_the_crawler_removed_are_cleared(self):
        # The crawler removes a URL and its scores when the page is gone or belongs to
        # another title (#152). NULL must then clear the Crate columns, not keep them.
        self.mongo.rotten_tomatoes_tv_rating.insert_one({'tmdb_id': 1, 'updated_at': datetime.utcnow(),
                                                         'not_found_url': 'https://www.rottentomatoes.com/tv/x'})
        all_ratings.copy_media(self.connector, {'tmdb_id': {'$in': [1]}}, 'show', recent_only=False)
        call = self.connector.upsert_many.call_args.kwargs
        published = call['records'][0]
        self.assertIsNone(published.rotten_tomatoes_url)
        self.assertIsNone(published.rotten_tomatoes_tomato_score_original)
        cleared = set(call['replace_null_columns'])
        self.assertLessEqual({'rotten_tomatoes_url', 'rotten_tomatoes_tomato_score_original',
                              'rotten_tomatoes_audience_score_rating_count', 'metacritic_url',
                              'metacritic_meta_score_original', 'metacritic_user_score_original',
                              'goodwatch_official_score_normalized_percent'}, cleared)
        self.assertNotIn('imdb_user_score_original', cleared)

    def test_every_recently_changed_title_is_published_once_across_batches(self):
        now = datetime.utcnow()
        self.mongo.tmdb_movie_details.insert_many([
            {'tmdb_id': tmdb_id, 'updated_at': now if tmdb_id in (1, 2) else now - timedelta(days=30)}
            for tmdb_id in range(1, 8)])
        self.mongo.imdb_movie_rating.insert_many([
            {'tmdb_id': tmdb_id, 'updated_at': now, 'user_score_vote_count': 10} for tmdb_id in (2, 3, 4, 5, 6)])
        self.mongo.metacritic_movie_rating.insert_one({'tmdb_id': 7, 'updated_at': now})
        with patch.object(all_ratings, 'BATCH_SIZE', 2):
            result = all_ratings.copy_media(self.connector, {}, 'movie')
        published = [record.tmdb_id for call in self.connector.upsert_many.call_args_list
                     for record in call.kwargs['records']]
        self.assertEqual(published, [1, 2, 3, 4, 5, 6, 7])
        self.assertEqual(result['movies']['rows_upserted'], 7)

    def test_a_recent_imdb_change_keeps_the_older_sources_in_the_aggregates(self):
        # The daily IMDb ingest moves only the IMDb document. The scheduled copy must still
        # read the title's TMDB, Metacritic and Rotten Tomatoes values for the aggregates.
        now = datetime.utcnow()
        old = now - timedelta(days=30)
        self.mongo.tmdb_movie_details.insert_one({
            'tmdb_id': 603, 'vote_average': 8.0, 'vote_count': 100, 'updated_at': old})
        self.mongo.imdb_movie_rating.insert_one({
            'tmdb_id': 603, 'created_at': old, 'updated_at': now, 'user_score_original': 9.0,
            'user_score_normalized_percent': 90.0, 'user_score_vote_count': 1000})
        self.mongo.metacritic_movie_rating.insert_one({
            'tmdb_id': 603, 'created_at': old, 'updated_at': old,
            'user_score_normalized_percent': 70.0, 'user_score_vote_count': 10,
            'meta_score_original': 60, 'meta_score_normalized_percent': 60.0, 'meta_score_vote_count': 5})
        self.mongo.rotten_tomatoes_movie_rating.insert_one({
            'tmdb_id': 603, 'created_at': old, 'updated_at': old,
            'audience_score_normalized_percent': 80.0, 'audience_score_vote_count': 20,
            'tomato_score_normalized_percent': 70.0, 'tomato_score_vote_count': 7})

        all_ratings.copy_media(self.connector, {}, 'movie')

        published = self.connector.upsert_many.call_args.kwargs['records'][0]
        self.assertEqual(published.imdb_user_score_rating_count, 1000)
        self.assertEqual(published.metacritic_meta_score_original, 60)
        self.assertEqual(published.goodwatch_user_score_normalized_percent, 80.0)
        self.assertEqual(published.goodwatch_user_score_rating_count, 1130)
        self.assertEqual(published.goodwatch_official_score_normalized_percent, 65.0)
        self.assertEqual(published.goodwatch_overall_score_voting_count, 1142)
