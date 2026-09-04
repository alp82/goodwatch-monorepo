import importlib.util
import sys
import unittest
from pathlib import Path
from types import ModuleType, SimpleNamespace
from unittest.mock import patch


VECTORS_PATH = (
    Path(__file__).parents[1] / "windmill" / "f" / "dna" / "generate" / "vectors.py"
)
FLATTEN_RESULTS_PATH = (
    Path(__file__).parents[1]
    / "windmill"
    / "f"
    / "dna"
    / "crawl_all_by_id.flow"
    / "flatten_and_combine_results.inline_script.py"
)


class FakeEmbedContentConfig:
    def __init__(self, **kwargs):
        self.__dict__.update(kwargs)


class FakeModels:
    def embed_content(self, **kwargs):
        self.call = kwargs
        return SimpleNamespace(
            embeddings=[SimpleNamespace(values=[0.1, 0.2])]
        )


class FakeClient:
    instance = None

    def __init__(self, **kwargs):
        self.api_key = kwargs["api_key"]
        self.models = FakeModels()
        FakeClient.instance = self


def load_vectors_module():
    google = ModuleType("google")
    google_genai = ModuleType("google.genai")
    google_genai.Client = FakeClient
    google_genai.types = SimpleNamespace(EmbedContentConfig=FakeEmbedContentConfig)
    google.genai = google_genai

    wmill = ModuleType("wmill")
    wmill.get_variable = lambda _path: "test-api-key"

    mongodb = ModuleType("f.db.mongodb")
    mongodb.init_mongodb = lambda: None
    mongodb.close_mongodb = lambda: None

    dna_models = ModuleType("f.dna.models")
    dna_models.CoreScores = object
    dna_models.DnaMovie = object
    dna_models.DnaTv = object

    modules = {
        "google": google,
        "google.genai": google_genai,
        "wmill": wmill,
        "f": ModuleType("f"),
        "f.db": ModuleType("f.db"),
        "f.db.mongodb": mongodb,
        "f.dna": ModuleType("f.dna"),
        "f.dna.models": dna_models,
    }
    spec = importlib.util.spec_from_file_location("dna_vectors", VECTORS_PATH)
    module = importlib.util.module_from_spec(spec)
    with patch.dict(sys.modules, modules):
        spec.loader.exec_module(module)
    return module


def load_flatten_results_module():
    spec = importlib.util.spec_from_file_location(
        "dna_flatten_results", FLATTEN_RESULTS_PATH
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class GenerateVectorsTest(unittest.TestCase):
    def test_uses_current_model_with_existing_vector_dimensions(self):
        vectors = load_vectors_module()

        result = vectors.generate_vectors([{"dna": {"essence_text": "test"}}])
        call = FakeClient.instance.models.call

        self.assertEqual(result, [[0.1, 0.2]])
        self.assertEqual(call["model"], "gemini-embedding-2")
        self.assertEqual(call["config"].output_dimensionality, 768)
        self.assertEqual(call["config"].task_type, "RETRIEVAL_DOCUMENT")

    def test_rejects_string_dna_with_the_result_index(self):
        vectors = load_vectors_module()

        with self.assertRaisesRegex(
            ValueError,
            r"results\[0\]\.dna must be an object",
        ):
            vectors.generate_vectors([{"id": "entry-id", "dna": "failed result"}])


class FlattenResultsTest(unittest.TestCase):
    def test_combines_successful_batches(self):
        flatten_results = load_flatten_results_module()
        dna = {"essence_text": "test"}

        result = flatten_results.main(
            next_ids={"movie_ids": ["entry-id"], "tv_ids": []},
            results=[[dna]],
        )

        self.assertEqual(result, [{"id": "entry-id", "dna": dna}])

    def test_rejects_failed_loop_iteration_instead_of_using_error_key_as_dna(self):
        flatten_results = load_flatten_results_module()

        with self.assertRaisesRegex(
            ValueError,
            r"results\[0\] must be a list",
        ):
            flatten_results.main(
                next_ids={"movie_ids": ["entry-id"], "tv_ids": []},
                results=[{"error": {"message": "DNA generation failed"}}],
            )


if __name__ == "__main__":
    unittest.main()
