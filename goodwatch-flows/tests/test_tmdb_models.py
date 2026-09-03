import importlib.util
import unittest
from pathlib import Path


MODELS_PATH = (
    Path(__file__).parents[1] / "windmill" / "f" / "tmdb_api" / "models.py"
)
SPEC = importlib.util.spec_from_file_location("tmdb_models", MODELS_PATH)
tmdb_models = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(tmdb_models)


class RecommendationResultSchemaTest(unittest.TestCase):
    def test_movie_result_accepts_softcore(self):
        result = tmdb_models.MovieResult._from_son({"id": 1, "softcore": True})

        self.assertTrue(result.softcore)

    def test_tv_result_accepts_softcore(self):
        result = tmdb_models.TvResult._from_son({"id": 1, "softcore": True})

        self.assertTrue(result.softcore)


if __name__ == "__main__":
    unittest.main()
