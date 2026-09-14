"""Exercise ratings publication with incomplete source metadata, without live services."""
import sys
import unittest
from datetime import datetime
from pathlib import Path
from unittest.mock import Mock

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
