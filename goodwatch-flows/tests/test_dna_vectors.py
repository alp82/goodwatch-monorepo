import importlib.util
import sys
import unittest
from pathlib import Path
from unittest.mock import patch


FLATTEN_RESULTS_PATH = (
    Path(__file__).parents[1]
    / "windmill"
    / "f"
    / "dna"
    / "crawl_all_by_id.flow"
    / "flatten_and_combine_results.inline_script.py"
)


def load_vectors_module():
    sys.path.insert(0, str(Path(__file__).parents[1] / "windmill"))
    from f.dna.generate import vectors
    return vectors


def load_flatten_results_module():
    spec = importlib.util.spec_from_file_location(
        "dna_flatten_results", FLATTEN_RESULTS_PATH
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class GenerateVectorsTest(unittest.TestCase):
    def test_fingerprint_uses_schema_order_without_inference(self):
        import json
        vectors = load_vectors_module()
        from f.dna.models import CoreScores
        dna = json.loads((Path(__file__).parent / "fixtures/dna.json").read_text())
        scores = dna["fingerprint"]["scores"]
        result = vectors.create_fingerprint(dict(reversed(list(scores.items()))))
        self.assertEqual(result, [float(scores[key]) for key in CoreScores.model_fields])
        self.assertEqual(len(result), 74)

    def test_rejects_string_dna_before_database_access(self):
        vectors = load_vectors_module()
        with patch.object(vectors, "init_mongodb") as connect:
            with self.assertRaisesRegex(ValueError, r"results\[0\]\.dna must be an object"):
                vectors.main({"movie_ids": [], "tv_ids": []}, [{"id": "entry-id", "dna": "failed result"}])
        connect.assert_not_called()

    def test_rejects_unselected_title_before_database_access(self):
        vectors = load_vectors_module()
        with patch.object(vectors, "init_mongodb") as connect:
            with self.assertRaisesRegex(ValueError, "id was not selected"):
                vectors.main({"movie_ids": [], "tv_ids": []}, [{"id": "unknown", "dna": {}}])
        connect.assert_not_called()


class FlattenResultsTest(unittest.TestCase):
    def test_combines_successful_batches(self):
        flatten_results = load_flatten_results_module()
        dna = {"essence_text": "test"}

        result = flatten_results.main(
            next_ids={"movie_ids": ["failed-id", "entry-id"], "tv_ids": []},
            results=[[{"id": "entry-id", "dna": dna}]],
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
