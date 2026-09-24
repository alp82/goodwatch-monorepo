"""f/sync/init/qdrant: extend live collections to the schema without changing what exists."""

import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock

from qdrant_client import models as qm

sys.path.insert(0, str(Path(__file__).parents[1] / "windmill"))
sys.path.insert(0, str(Path(__file__).parents[1] / "scripts"))
from f.sync.init.qdrant import apply_collection, plan_collection, reconcile
from f.sync.models.qdrant_schemas import (
    FINGERPRINT_RAW_VECTOR, TERMS_BM25F_VECTOR, TEXT_EN_VECTOR, TEXT_MULTI_VECTOR,
    desired_collections, desired_media_collection, desired_reference_profiles_collection,
)
from backfill_fingerprint_raw import stale_points
from f.dna.models import CoreScores


def live_collection(vectors, sparse=None, indexes=()):
    info = SimpleNamespace(
        config=SimpleNamespace(params=SimpleNamespace(vectors=vectors, sparse_vectors=sparse)),
        payload_schema={field: object() for field in indexes},
    )
    client = Mock()
    client.collection_exists.return_value = True
    client.get_collection.return_value = info
    return client


def todays_media_collection():
    spec = desired_media_collection()
    return live_collection(
        {"fingerprint_v1": qm.VectorParams(size=74, distance=qm.Distance.COSINE)},
        indexes=[idx.field for idx in spec.payload_indexes],
    )


class PlanTests(unittest.TestCase):
    def test_existing_collection_gains_only_missing_vectors(self) -> None:
        plan = plan_collection(todays_media_collection(), desired_media_collection())
        self.assertFalse(plan["create"])
        self.assertEqual(plan["add_vectors"], [FINGERPRINT_RAW_VECTOR, TEXT_EN_VECTOR, TEXT_MULTI_VECTOR])
        self.assertEqual(plan["add_sparse_vectors"], [TERMS_BM25F_VECTOR])
        self.assertEqual(plan["add_payload_indexes"], [])
        self.assertEqual(plan["conflicts"], [])

    def test_applied_collection_has_nothing_to_do(self) -> None:
        spec = desired_media_collection()
        vectors = {
            name: qm.VectorParams(
                size=v.size, distance=qm.Distance(v.distance),
                datatype=None if v.datatype == "float32" else qm.Datatype(v.datatype),
                hnsw_config=qm.HnswConfigDiff(**v.hnsw_config) if v.hnsw_config else None,
            )
            for name, v in spec.vectors.items()
        }
        client = live_collection(vectors, {TERMS_BM25F_VECTOR: qm.SparseVectorParams()},
                                 [idx.field for idx in spec.payload_indexes])
        plan = plan_collection(client, spec)
        for key in ("add_vectors", "add_sparse_vectors", "set_vector_hnsw", "add_payload_indexes", "conflicts"):
            self.assertEqual(plan[key], [], key)

    def test_changed_datatype_is_a_conflict_not_a_change(self) -> None:
        client = live_collection({
            "fingerprint_v1": qm.VectorParams(size=74, distance=qm.Distance.COSINE),
            TEXT_EN_VECTOR: qm.VectorParams(size=768, distance=qm.Distance.COSINE),
        })
        with self.assertRaisesRegex(ValueError, TEXT_EN_VECTOR):
            reconcile(client, [desired_media_collection()], apply=True)
        client.create_vector_name.assert_not_called()

    def test_vectors_outside_the_spec_are_reported_and_kept(self) -> None:
        client = live_collection({
            "fingerprint_v1": qm.VectorParams(size=74, distance=qm.Distance.COSINE),
            "old": qm.VectorParams(size=3, distance=qm.Distance.DOT),
        })
        plan = plan_collection(client, desired_media_collection())
        self.assertEqual(plan["not_in_spec"], ["old"])
        apply_collection(client, desired_media_collection(), plan)
        client.delete_vector_name.assert_not_called()

    def test_dry_run_changes_nothing(self) -> None:
        client = todays_media_collection()
        client.collection_exists.side_effect = lambda name: name == "media_fingerprint_v1"
        reconcile(client, desired_collections(), apply=False)
        client.create_vector_name.assert_not_called()
        client.create_collection.assert_not_called()
        client.update_collection.assert_not_called()


class ApplyTests(unittest.TestCase):
    def test_new_vectors_keep_datatype_and_raw_fingerprint_gets_no_graph(self) -> None:
        client = todays_media_collection()
        spec = desired_media_collection()
        apply_collection(client, spec, plan_collection(client, spec))
        created = {c.kwargs["vector_name"]: c.kwargs["vector_name_config"]
                   for c in client.create_vector_name.call_args_list}
        self.assertEqual(created[TEXT_EN_VECTOR].dense.datatype, qm.VectorStorageDatatype.FLOAT16)
        self.assertEqual(created[TEXT_MULTI_VECTOR].dense.size, 384)
        self.assertEqual(created[FINGERPRINT_RAW_VECTOR].dense.distance, qm.Distance.DOT)
        self.assertIsNone(created[TERMS_BM25F_VECTOR].sparse.modifier)
        [update] = client.update_collection.call_args_list
        self.assertEqual(list(update.kwargs["vectors_config"]), [FINGERPRINT_RAW_VECTOR])
        self.assertEqual(update.kwargs["vectors_config"][FINGERPRINT_RAW_VECTOR].hnsw_config.m, 0)

    def test_missing_collection_is_created_with_matching_vector_names(self) -> None:
        client = Mock()
        client.collection_exists.return_value = False
        spec = desired_reference_profiles_collection()
        apply_collection(client, spec, plan_collection(client, spec))
        created = client.create_collection.call_args.kwargs
        media = desired_media_collection().vectors
        for name, params in created["vectors_config"].items():
            self.assertEqual((params.size, params.distance.value, params.datatype.value),
                             (media[name].size, media[name].distance, media[name].datatype))
        self.assertEqual(client.create_payload_index.call_args.kwargs["field_name"], "kind")


class BackfillTests(unittest.TestCase):
    def test_only_missing_or_different_raw_vectors_are_written(self) -> None:
        scores = {name: 3 for name in CoreScores.model_fields}
        raw = [3.0] * len(CoreScores.model_fields)
        points = [
            SimpleNamespace(id=1, payload={"fingerprint_scores_v1": scores}, vector={}),
            SimpleNamespace(id=2, payload={"fingerprint_scores_v1": scores}, vector={FINGERPRINT_RAW_VECTOR: raw}),
            SimpleNamespace(id=3, payload={"fingerprint_scores_v1": scores},
                            vector={FINGERPRINT_RAW_VECTOR: [4.0] + raw[1:]}),
            SimpleNamespace(id=4, payload={}, vector={}),
        ]
        stale, no_scores = stale_points(points)
        self.assertEqual([p.id for p in stale], [1, 3])
        self.assertEqual(stale[0].vector, {FINGERPRINT_RAW_VECTOR: raw})
        self.assertIsNone(stale[0].payload)
        self.assertEqual(no_scores, 1)


if __name__ == "__main__":
    unittest.main()
