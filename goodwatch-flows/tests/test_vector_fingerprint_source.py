"""The Qdrant copy builds both fingerprint vectors from the title's current scores."""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1] / "windmill"))

from f.dna.models import CoreScores, create_fingerprint
from f.sync.copy import vector_data

SCORES = {name: index % 11 for index, name in enumerate(CoreScores.model_fields)}


def vectors(dna):
    _, built = vector_data._build_payload(
        media_type="movie", tmdb_id=603, details={"title": "The Matrix"}, imdb=None, meta=None, rotten=None,
        providers_from_tmdb=None, providers_all_rows=[], dna=dna, tropes=None)
    return built


class FingerprintSourceTests(unittest.TestCase):
    def test_a_stored_fingerprint_older_than_the_scores_is_not_written(self):
        stale = create_fingerprint({**SCORES, "adrenaline": 10, "tension": 0})

        built = vectors({"dna": {"fingerprint": {"scores": SCORES}}, "vector_fingerprint": stale})

        self.assertEqual(built["fingerprint_v1"], create_fingerprint(SCORES))
        self.assertEqual(built["fingerprint_v1"], built[vector_data.FINGERPRINT_RAW_VECTOR])
        self.assertNotEqual(built["fingerprint_v1"], stale)

    def test_a_stored_fingerprint_that_agrees_with_the_scores_is_written_as_before(self):
        stored = create_fingerprint(SCORES)

        built = vectors({"dna": {"fingerprint": {"scores": SCORES}}, "vector_fingerprint": stored})

        self.assertEqual(built, {"fingerprint_v1": stored, vector_data.FINGERPRINT_RAW_VECTOR: stored})

    def test_no_vector_is_written_without_valid_scores(self):
        stored = create_fingerprint(SCORES)
        incomplete = {name: score for name, score in SCORES.items() if name != "adrenaline"}

        for scores in (None, {}, incomplete):
            with self.subTest(scores=scores):
                built = vectors({"dna": {"fingerprint": {"scores": scores}}, "vector_fingerprint": stored})
                self.assertEqual(built, {"fingerprint_v1": []})

    def test_a_title_without_a_stored_fingerprint_still_has_no_vector(self):
        self.assertEqual(vectors({"dna": {"fingerprint": {"scores": SCORES}}}), {"fingerprint_v1": []})


if __name__ == "__main__":
    unittest.main()
