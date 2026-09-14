"""Fingerprint-only publication and migration preserve the retained DNA data."""
import importlib.util
from pathlib import Path
import sys
import unittest
import warnings

import mongomock
from qdrant_client import QdrantClient, grpc, models as qm

sys.path.insert(0, str(Path(__file__).parents[1] / "windmill"))
from f.dna.models import CoreScores
from f.sync.models.qdrant_schemas import desired_payload_indexes

spec = importlib.util.spec_from_file_location(
    "remove_text_embeddings", Path(__file__).parents[1] / "scripts/remove_text_embeddings.py")
migration = importlib.util.module_from_spec(spec)
spec.loader.exec_module(migration)


class TextEmbeddingRemovalTest(unittest.TestCase):
    def setUp(self):
        self.client = QdrantClient(":memory:")
        self.addCleanup(self.client.close)
        self.client.create_collection(migration.SOURCE, vectors_config={
            migration.VECTOR: qm.VectorParams(size=74, distance=qm.Distance.COSINE),
            "essence_text_v1": qm.VectorParams(size=768, distance=qm.Distance.COSINE),
        })

    def put(self, point_id, with_fingerprint=True):
        vectors = {"essence_text_v1": [0.1] * 768}
        if with_fingerprint:
            vectors[migration.VECTOR] = [float(i % 11) for i in range(74)]
        self.client.upsert(migration.SOURCE, [qm.PointStruct(
            id=point_id, vector=vectors,
            payload={"tmdb_id": point_id, "fingerprint_scores_v1": {"adrenaline": 9},
                     "streaming_availability": ["8_DE"], "title": "Keep me"})])

    def copy(self):
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", UserWarning)  # Local mode has no payload indexes.
            return migration.copy(self.client)

    def test_copy_preserves_every_id_payload_and_fingerprint_and_can_resume(self):
        self.put(1000000000603)
        self.put(2000000001399)
        self.assertEqual(self.copy()["verified_points"], 2)
        self.assertEqual(self.copy()["verified_points"], 2)
        source, _ = self.client.scroll(migration.SOURCE, with_vectors=True)
        target, _ = self.client.scroll(migration.TARGET, with_vectors=True)
        self.assertEqual(set(target[0].vector), {migration.VECTOR})
        self.assertIn("essence_text_v1", source[0].vector)
        self.assertEqual(target[0].payload, source[0].payload)

    def test_missing_fingerprint_aborts_instead_of_silently_losing_a_title(self):
        self.put(1, with_fingerprint=False)
        with self.assertRaisesRegex(ValueError, "no valid"):
            self.copy()
        self.assertEqual(self.client.count(migration.SOURCE).count, 1)

    def test_verify_rejects_changed_payload_or_extra_point(self):
        self.put(1)
        self.copy()
        self.client.set_payload(migration.TARGET, {"title": "Changed"}, [1])
        with self.assertRaisesRegex(ValueError, "Payload differs"):
            migration.verify(self.client)
        self.copy()
        self.put(2)
        with self.assertRaisesRegex(ValueError, "point IDs differ"):
            migration.verify(self.client)

    def test_mongo_cleanup_keeps_text_tags_fingerprint_and_queue_state(self):
        database = mongomock.MongoClient().get_database("goodwatch")
        retained = {"dna": {"essence_text": "Keep the text", "essence_tags": ["test"]},
                    "vector_fingerprint": [1.0] * 74, "is_selected": False}
        for collection in ("dna_movie", "dna_tv"):
            database[collection].insert_one({**retained, "vector_essence_text": [0.1] * 768})
        self.assertEqual(migration.cleanup_mongo(database), {"dna_movie": 1, "dna_tv": 1})
        for collection in ("dna_movie", "dna_tv"):
            self.assertEqual(database[collection].find_one({}, {"_id": 0}), retained)
        self.assertEqual(migration.cleanup_mongo(database), {"dna_movie": 0, "dna_tv": 0})

    def test_indexes_cover_all_filterable_traits_as_numbers(self):
        indexes = {index.field: index.field_schema for index in desired_payload_indexes()}
        self.assertNotIn("fingerprint_scores_v1", indexes)
        for name in CoreScores.model_fields:
            self.assertEqual(indexes[f"fingerprint_scores_v1.{name}"], "integer")

    def test_native_grpc_preserves_nested_payloads_and_rejects_missing_vectors(self):
        source = grpc.RetrievedPoint(
            id=grpc.PointId(num=1000000000603),
            payload={"dna": grpc.Value(struct_value=grpc.Struct(fields={
                "essence_text": grpc.Value(string_value="Keep the text"),
                "score": grpc.Value(integer_value=9),
            }))},
            vectors=grpc.VectorsOutput(vectors=grpc.NamedVectorsOutput(vectors={
                migration.VECTOR: grpc.VectorOutput(data=[1.0] * 74)})))
        retained = migration.retained_point(source)
        self.assertEqual(retained.id, 1000000000603)
        self.assertEqual(retained.payload, source.payload)
        self.assertEqual(migration.fingerprint(retained), [1.0] * 74)
        source.ClearField("vectors")
        with self.assertRaisesRegex(ValueError, "no valid"):
            migration.fingerprint(migration.retained_point(source))


if __name__ == "__main__":
    unittest.main()
