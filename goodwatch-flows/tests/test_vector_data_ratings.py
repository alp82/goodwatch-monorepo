"""Audience aggregates are published from Mongo rating sources without live services."""
import sys
import unittest
from contextlib import ExitStack
from pathlib import Path
from unittest.mock import Mock, patch

import mongomock

sys.path.insert(0, str(Path(__file__).parents[1] / "windmill"))

from f.dna.models import CoreScores
from f.sync.copy import vector_data


class VectorRatingsTest(unittest.TestCase):
    def test_movie_letterboxd_scores_and_counts_reach_the_payload(self):
        for media_type, cleared, score, count in [
            ("movie", False, 82.4, 4570222),
            ("show", False, 80, 100),
            ("movie", True, 80, 100),
        ]:
            for strict in (False, True):
                with self.subTest(media_type=media_type, cleared=cleared, strict=strict), ExitStack() as stack:
                    db = mongomock.MongoClient().db
                    suffix = "movie" if media_type == "movie" else "tv"
                    details = db[f"tmdb_{suffix}_details"]
                    details.insert_one({"tmdb_id": 603, "vote_average": 8, "vote_count": 100})
                    db[f"dna_{suffix}"].insert_one({
                        "tmdb_id": 603, "vector_fingerprint": [0.1],
                        "dna": {"fingerprint": {"scores": {
                            name: index % 11 for index, name in enumerate(CoreScores.model_fields)
                        }}},
                    })
                    db.letterboxd_movie_rating.insert_one({
                        "tmdb_id": 603, "user_score_normalized_percent": None if cleared else 84.8,
                        "user_score_vote_count": None if cleared else 4570122,
                    })
                    model = vector_data.TmdbMovieDetails if suffix == "movie" else vector_data.TmdbTvDetails
                    stack.enter_context(patch.object(model, "_get_collection", return_value=details))
                    for name, value in [
                        ("get_db", db), ("_driver_batches", [[603]]),
                        ("_collection_vector_names", set()), ("flagged_among", set()),
                        ("_published_streaming", {603: []}),
                    ]:
                        stack.enter_context(patch.object(vector_data, name, return_value=value))
                    write = stack.enter_context(patch.object(
                        vector_data, "write_with_retry",
                        return_value={"attempts": 1, "retries": 0, "errors": {}}))
                    result = vector_data.copy_to_qdrant(
                        Mock(), media_type, {}, recent_only=False,
                        strict_writes=strict, delete_flagged=False)
                    self.assertEqual(result["upserts"], 1)
                    point = write.call_args.args[2][0].upsert.points[0]
                    self.assertEqual(point.payload["goodwatch_user_score_normalized_percent"], score)
                    self.assertEqual(point.payload["goodwatch_user_score_rating_count"], count)
                    self.assertIsNone(point.payload["goodwatch_official_score_normalized_percent"])


if __name__ == "__main__":
    unittest.main()
