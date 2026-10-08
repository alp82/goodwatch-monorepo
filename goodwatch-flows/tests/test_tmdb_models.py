import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1] / "windmill"))

# Import the module by its real name. Loading the file a second time under another name
# defines the document classes twice; mongoengine's registry then knows only the copies,
# and `disconnect()` no longer resets the collection of the real classes.
from f.tmdb_api import models as tmdb_models


class RecommendationResultSchemaTest(unittest.TestCase):
    def test_movie_result_accepts_softcore(self):
        result = tmdb_models.MovieResult._from_son({"id": 1, "softcore": True})

        self.assertTrue(result.softcore)

    def test_tv_result_accepts_softcore(self):
        result = tmdb_models.TvResult._from_son({"id": 1, "softcore": True})

        self.assertTrue(result.softcore)


if __name__ == "__main__":
    unittest.main()
