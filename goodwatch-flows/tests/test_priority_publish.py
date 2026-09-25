import ast
import importlib.util
import sys
import unittest
from collections import defaultdict
from contextlib import ExitStack, nullcontext
from datetime import datetime, timedelta
from pathlib import Path
from types import ModuleType, SimpleNamespace
from unittest.mock import MagicMock, Mock, patch
from typing import Any, Dict, List, Optional, Tuple


sys.path.insert(0, str(Path(__file__).parents[1] / "windmill"))
from f.sync.copy import deleted_titles
from qdrant_client import models as qm
from f.sync.copy.qdrant_retry import (
    REQUEST_TIMEOUT_SECONDS, insert_points, update_points, write_with_retry,
)

# The sync functions are executed from their AST; give them the real delete-on-sync helpers.
DELETED_TITLE_HELPERS = {name: getattr(deleted_titles, name) for name in deleted_titles.__dict__ if not name.startswith("_")}

# Real point-operation helpers with a no-op backoff, plus a collection that has no
# fingerprint_v1_raw vector yet.
POINT_WRITE_HELPERS = {
    "insert_points": insert_points, "update_points": update_points,
    "write_with_retry": lambda *args, **kwargs: write_with_retry(*args, **kwargs, sleep=lambda seconds: None),
    "FINGERPRINT_RAW_VECTOR": "fingerprint_v1_raw",
    "_collection_vector_names": lambda client: {"fingerprint_v1"},
    "qm": qm,
}


def completed(*args: Any, **kwargs: Any) -> list:
    """A batch_update_points result where every operation completed."""
    return [SimpleNamespace(status=qm.UpdateStatus.COMPLETED)] * len(kwargs["update_operations"])


def written_points(client: Mock) -> list:
    """Points created by the last batch request's insert_points operation."""
    return client.batch_update_points.call_args.kwargs["update_operations"][0].upsert.points

ROOT = Path(__file__).parents[1] / "windmill" / "f"
SYNC_NAMES = ("tmdb_details", "all_ratings", "tmdb_streaming", "tvtropes", "dna_data")


def load_publisher():
    modules = {name: ModuleType(name) for name in (
        "f", "f.db", "f.db.cratedb", "f.db.mongodb", "f.db.qdrant", "f.sync", "f.sync.copy",
        "f.sync.copy.vector_data",
    )}
    modules["f.db.qdrant"].QdrantConnector = MagicMock()
    retry_module = ModuleType("f.sync.copy.qdrant_retry")
    retry_module.REQUEST_TIMEOUT_SECONDS = REQUEST_TIMEOUT_SECONDS
    modules["f.sync.copy.qdrant_retry"] = retry_module
    modules["f.sync.copy.vector_data"].copy_to_qdrant = MagicMock(return_value={"upserts": 1})
    crate = modules["f.db.cratedb"]
    crate.CrateConnector = MagicMock()
    mongo = modules["f.db.mongodb"]
    mongo.init_mongodb = MagicMock()
    mongo.close_mongodb = MagicMock()
    syncs = {}
    for name in SYNC_NAMES:
        sync = MagicMock()
        sync.copy_media.side_effect = lambda **kw: {
            "movies" if kw["media_type"] == "movie" else "shows": {
                "rows_upserted": len(kw["query_selector"]["tmdb_id"]["$in"])
            }
        }
        modules[f"f.sync.copy.{name}"] = sync
        syncs[name] = sync
    spec = importlib.util.spec_from_file_location("priority_publish", ROOT / "priority" / "publish.py")
    module = importlib.util.module_from_spec(spec)
    with patch.dict(sys.modules, modules):
        spec.loader.exec_module(module)
    return module, crate, mongo, syncs


class PublishTests(unittest.TestCase):
    def test_vector_connector_bounds_transport_timeout(self) -> None:
        tree = ast.parse((ROOT / "db" / "qdrant.py").read_text())
        connector_class = next(node for node in tree.body if isinstance(node, ast.ClassDef) and node.name == "QdrantConnector")
        constructor = next(node for node in connector_class.body if isinstance(node, ast.FunctionDef) and node.name == "__init__")
        namespace = {"wmill": MagicMock(), "QdrantClient": MagicMock(), "GRPC_OPTS": {}}
        exec(compile(ast.Module(body=[constructor], type_ignores=[]), "qdrant.py", "exec"), namespace)
        namespace["__init__"](SimpleNamespace(), timeout=180)
        self.assertEqual(namespace["QdrantClient"].call_args.kwargs["timeout"], 180)

    def test_empty_batch_never_opens_database(self):
        module, crate, mongo, _ = load_publisher()
        self.assertEqual(module.main({"movie_ids": [], "tv_ids": []}), {})
        crate.CrateConnector.assert_not_called()
        mongo.init_mongodb.assert_not_called()

    def test_targets_use_tmdb_ids_and_skip_empty_media_type(self):
        module, _, mongo, syncs = load_publisher()
        result = module.main({"movie_ids": ["42", 42], "tv_ids": []})
        self.assertEqual(set(result), {"movie"})
        for name, sync in syncs.items():
            sync.copy_media.assert_called_once()
            args = sync.copy_media.call_args.kwargs
            self.assertEqual(args["media_type"], "movie")
            self.assertEqual(args["query_selector"]["tmdb_id"], {"$in": [42]})
            self.assertNotIn("_id", args["query_selector"])
            self.assertFalse(args["recent_only"])
        mongo.close_mongodb.assert_called_once()
        module.copy_to_qdrant.assert_called_once_with(
            module.QdrantConnector.return_value, "movie", {"tmdb_id": {"$in": [42]}},
            recent_only=False, strict_writes=True,
        )
        module.QdrantConnector.assert_called_once_with(timeout=REQUEST_TIMEOUT_SECONDS)
        module.QdrantConnector.return_value.close.assert_called_once()

    def test_tv_ids_map_to_show(self):
        module, _, _, syncs = load_publisher()
        module.main({"tv_ids": [17]})
        for sync in syncs.values():
            self.assertEqual(sync.copy_media.call_args.kwargs["media_type"], "show")

    def test_publish_failure_propagates_and_closes_connections(self):
        module, crate, mongo, syncs = load_publisher()
        syncs["all_ratings"].copy_media.side_effect = RuntimeError("bulk write failed")
        with self.assertRaisesRegex(RuntimeError, "bulk write failed"):
            module.main({"movie_ids": [42]})
        syncs["tmdb_streaming"].copy_media.assert_not_called()
        crate.CrateConnector.return_value.disconnect.assert_called_once()
        mongo.close_mongodb.assert_called_once()

    def test_vector_failure_prevents_success(self):
        module, crate, mongo, _ = load_publisher()
        module.copy_to_qdrant.side_effect = RuntimeError("vector write failed")
        with self.assertRaisesRegex(RuntimeError, "vector write failed"):
            module.main({"movie_ids": [42]})
        crate.CrateConnector.return_value.disconnect.assert_called_once()
        module.QdrantConnector.assert_called_once_with(timeout=REQUEST_TIMEOUT_SECONDS)
        module.QdrantConnector.return_value.close.assert_called_once()
        mongo.close_mongodb.assert_called_once()

    def test_missing_details_prevents_success(self):
        module, _, _, syncs = load_publisher()
        syncs["tmdb_details"].copy_media.side_effect = None
        syncs["tmdb_details"].copy_media.return_value = {}
        with self.assertRaisesRegex(RuntimeError, "Published 0 of 1"):
            module.main({"movie_ids": [42]})
        syncs["all_ratings"].copy_media.assert_not_called()

    def test_invalid_id_fails_before_connecting(self):
        for value in (True, -1, 0, "abc", 1.5):
            module, crate, _, _ = load_publisher()
            with self.assertRaises(ValueError):
                module.main({"movie_ids": [value]})
            crate.CrateConnector.assert_not_called()

    def test_partial_streaming_publication_still_requires_vector_write(self) -> None:
        module, _, _, syncs = load_publisher()
        syncs["tmdb_streaming"].copy_media.side_effect = None
        syncs["tmdb_streaming"].copy_media.return_value = {"publication": {
            "status": "partial_success", "titles": {"42": {
                "deferred_countries": ["DE"], "streaming_availability": ["8_DE", "9_US"]}}}}
        result = module.main({"movie_ids": [42]})
        self.assertEqual(result["movie"]["streaming"]["publication"]["status"], "partial_success")
        self.assertTrue(module.copy_to_qdrant.call_args.kwargs["strict_writes"])


class SelectionTests(unittest.TestCase):
    def test_actual_sync_selection_bypasses_lookback_only_when_requested(self):
        # Execute each real copy_media against empty recording collections. No DB or
        # model package is needed because this exercises the selection boundary.
        for name in SYNC_NAMES:
            for recent_only in (True, False):
                with self.subTest(sync=name, recent_only=recent_only):
                    tree = ast.parse((ROOT / "sync" / "copy" / f"{name}.py").read_text())
                    function = next(node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name == "copy_media")
                    db = MagicMock()
                    db.provider_identity_unresolved.find_one.return_value = None
                    for collection in ("tmdb_movie_details", "tmdb_movie_providers", "imdb_movie_rating", "metacritic_movie_rating", "rotten_tomatoes_movie_rating", "tv_tropes_movie_tags", "dna_movie"):
                        cursor = getattr(db, collection).find.return_value
                        cursor.sort.return_value.skip.return_value.limit.return_value = []
                        getattr(db, collection).aggregate.return_value = []
                    connector = MagicMock()
                    connector.select.return_value = []
                    namespace = {
                    **DELETED_TITLE_HELPERS,
                        **DELETED_TITLE_HELPERS,
                        "CrateConnector": object, "Movie": object, "Show": object,
                        "get_db": lambda: db, "datetime": datetime, "timedelta": timedelta,
                        "HOURS_TO_FETCH": 48, "SCHEDULED_LEASE_WAIT_SECONDS": 0, "BATCH_SIZE": 100, "defaultdict": defaultdict,
                        "tmdb_details_projection": {}, "Any": Any,
                        "publication_lease": lambda *args: nullcontext(lambda: None),
                    }
                    functions = [function]
                    if name == "tmdb_streaming":
                        from test_streaming_publication import load_copy
                        streaming = load_copy(db).__globals__
                        namespace.update({key: streaming[key] for key in ("publication_snapshot", "build_evidence", "StreamingEvidence", "SCHEMAS", "scoped_provider_id")})
                        namespace["publication_snapshot"].__wrapped__.__globals__["publication_lease"] = lambda *args: nullcontext(lambda: None)
                    exec(compile(ast.Module(body=functions, type_ignores=[]), str(ROOT / name), "exec"), namespace)
                    namespace["copy_media"](connector, {"tmdb_id": {"$in": [42]}}, recent_only=recent_only)
                    selectors = []
                    for method, args, _ in db.mock_calls:
                        if method.endswith("count_documents") or method.endswith("find"):
                            selectors.append(args[0])
                        elif method.endswith("aggregate"):
                            selectors.append(args[0][0]["$match"])
                    self.assertTrue(selectors)
                    def clauses(selector):
                        yield selector
                        for operator in ("$and", "$or"):
                            for child in selector.get(operator, []):
                                yield from clauses(child)
                    for selector in selectors:
                        self.assertTrue(any(part.get("tmdb_id") == {"$in": [42]} for part in clauses(selector)))
                    self.assertEqual(any("updated_at" in part for selector in selectors for part in clauses(selector)), recent_only)


class VectorKeysetTests(unittest.TestCase):
    def test_targeted_publication_avoids_unbounded_date_index_scan(self):
        tree = ast.parse((ROOT / "sync" / "copy" / "vector_data.py").read_text())
        functions = [node for node in tree.body if isinstance(node, ast.FunctionDef)
                     and node.name in ("copy_to_qdrant", "_fetch_tmdb_ids_keyset")]
        for recent_only in (False, True):
            with self.subTest(recent_only=recent_only):
                collection = MagicMock()
                collection.index_information.return_value = {
                    "updated_at_1_tmdb_id_1": {"key": [("updated_at", 1), ("tmdb_id", 1)]},
                    "tmdb_id_1": {"key": [("tmdb_id", 1)]},
                }
                cursor = MagicMock()
                collection.find.return_value = cursor
                cursor.sort.return_value = cursor
                cursor.limit.return_value = cursor
                cursor.batch_size.return_value = cursor
                cursor.hint.return_value = cursor
                cursor.__iter__.return_value = iter([])
                namespace = {
                    **DELETED_TITLE_HELPERS,
                    "QdrantConnector": object, "get_db": MagicMock(),
                    "TmdbMovieDetails": SimpleNamespace(_get_collection=lambda: collection),
                    "TmdbTvDetails": MagicMock(), "datetime": datetime, "timedelta": timedelta,
                    "HOURS_TO_FETCH": 48, "BATCH_SIZE": 100, "UPSERT_BATCH_SIZE": 100,
                    "Optional": Optional, "List": List, "Tuple": Tuple, "Dict": Dict, "Any": Any,
                    "MEDIA_COLLECTION": "media", "QdrantMediaPoint": MagicMock(),
                    **POINT_WRITE_HELPERS,
                }
                exec(compile(ast.Module(body=functions, type_ignores=[]), "vector_data.py", "exec"), namespace)
                result = namespace["copy_to_qdrant"](
                    MagicMock(), "movie", {"tmdb_id": {"$in": [11]}},
                    recent_only=recent_only, strict_writes=True,
                )
                # The first find drives the run; the last one looks up every flagged title.
                selector = collection.find.call_args_list[0].args[0]
                self.assertEqual(selector["tmdb_id"], {"$in": [11]})
                self.assertEqual("updated_at" in selector, recent_only)
                self.assertEqual(collection.find.call_args.args[0],
                                 {"tmdb_id": {"$in": [11]}, "tmdb_deleted": True})
                # Without a date predicate, forcing the date-first index scans its
                # full key range and sorts it even for a single requested title.
                expected = [("updated_at", 1), ("tmdb_id", 1)] if recent_only else [("tmdb_id", 1)]
                cursor.hint.assert_called_once_with(expected)
                self.assertEqual(result["upserts"], 0)


class VectorPublicationTests(unittest.TestCase):
    def test_strict_publication_requires_completed_writes_and_uses_explicit_selector(self):
        for status in ("completed", "acknowledged", "scheduled"):
            with self.subTest(status=status):
                tree = ast.parse((ROOT / "sync" / "copy" / "vector_data.py").read_text())
                function = next(node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name == "copy_to_qdrant")
                db = MagicMock()
                qc = MagicMock()
                crate = MagicMock()
                crate.select.return_value = [{"tmdb_id": 42, "streaming_availabilities": ["DE_8", "US_9"]}]
                qc.client.batch_update_points.side_effect = lambda **kw: [
                    SimpleNamespace(status="completed" if status == "scheduled" else status)
                ] * len(kw["update_operations"])
                fetch_ids = MagicMock(side_effect=[([42], 42), ([], 42)])
                namespace = {
                    **DELETED_TITLE_HELPERS,
                    "QdrantConnector": object, "CrateConnector": lambda: crate, "get_db": lambda: db,
                    "ExitStack": ExitStack,
                    **POINT_WRITE_HELPERS, "publication_lease": lambda *args: nullcontext(lambda: None),
                    "TmdbMovieDetails": MagicMock(), "TmdbTvDetails": MagicMock(),
                    "datetime": datetime, "timedelta": timedelta, "HOURS_TO_FETCH": 48,
                    "BATCH_SIZE": 100, "UPSERT_BATCH_SIZE": 100,
                    "Optional": Optional, "List": List, "Tuple": Tuple, "Dict": Dict, "Any": Any,
                    "_fetch_tmdb_ids_keyset": fetch_ids,
                    "_fetch_map_by_ids": lambda *args: {42: {"tmdb_id": 42}},
                    "_fetch_multimap_by_ids": lambda *args: {},
                    "_build_payload": lambda **kw: ({"tmdb_id": 42, "streaming_availability": ["8_DE"]}, {"fingerprint_v1": [0.2]}),
                    "QdrantMediaPoint": SimpleNamespace(make_point_id=lambda *args: 84),
                    "MEDIA_COLLECTION": "media",
                }
                functions = [function] + [node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name == "_published_streaming"]
                exec(compile(ast.Module(body=functions, type_ignores=[]), "vector_data.py", "exec"), namespace)
                if status in ("completed", "scheduled"):
                    result = namespace["copy_to_qdrant"](qc, "movie", {"tmdb_id": {"$in": [42]}}, recent_only=False, strict_writes=True)
                    self.assertEqual(result["upserts"], 1)
                    self.assertEqual(written_points(qc.client)[0].payload["streaming_availability"], ["8_DE", "9_US"])
                else:
                    with self.assertRaisesRegex(RuntimeError, "incomplete status"):
                        namespace["copy_to_qdrant"](qc, "movie", {"tmdb_id": {"$in": [42]}}, recent_only=False, strict_writes=True)
                if status == "scheduled":
                    crate.select.assert_called_once_with(
                        "SELECT tmdb_id, streaming_availabilities FROM movie WHERE tmdb_id = ANY(?)", ([42],))
                    crate.disconnect.assert_called_once()
                self.assertEqual(fetch_ids.call_args_list[0].kwargs["base_selector"], {"tmdb_id": {"$in": [42]}})
                qc.client.upsert.assert_not_called()
                self.assertTrue(qc.client.batch_update_points.call_args.kwargs["wait"])


class RawFingerprintTests(unittest.TestCase):
    def test_raw_vector_uses_the_fingerprint_dimension_order(self) -> None:
        from f.dna.generate.vectors import create_fingerprint
        from f.dna.models import CoreScores
        from f.sync.copy.vector_data import _raw_fingerprint
        scores = {name: index % 11 for index, name in enumerate(reversed(list(CoreScores.model_fields)))}
        raw = _raw_fingerprint(scores)
        self.assertEqual(len(raw), 74)
        self.assertEqual(raw, create_fingerprint(scores))
        self.assertIsNone(_raw_fingerprint({"adrenaline": 3}))


class VectorSerializationTests(unittest.TestCase):
    def setUp(self) -> None:
        import mongomock
        from test_streaming_publication import load_copy
        self.db = mongomock.MongoClient().db
        self.crate = MagicMock()
        self.crate.select.return_value = [{"tmdb_id": 42, "streaming_availabilities": ["US_9"]}]
        self.qc = MagicMock()
        self.qc.client.batch_update_points.side_effect = completed
        tree = ast.parse((ROOT / "sync" / "copy" / "vector_data.py").read_text())
        functions = [node for node in tree.body if isinstance(node, ast.FunctionDef)
                     and node.name in ("copy_to_qdrant", "_published_streaming")]
        self.namespace = {
            **DELETED_TITLE_HELPERS,
            "QdrantConnector": object, "CrateConnector": lambda: self.crate,
            "get_db": lambda: self.db, "TmdbMovieDetails": MagicMock(), "TmdbTvDetails": MagicMock(),
            "datetime": datetime, "timedelta": timedelta, "HOURS_TO_FETCH": 48,
            "BATCH_SIZE": 100, "UPSERT_BATCH_SIZE": 100,
            "Optional": Optional, "List": List, "Tuple": Tuple, "Dict": Dict, "Any": Any,
            "ExitStack": ExitStack,
            **POINT_WRITE_HELPERS,
            "publication_lease": load_copy(self.db).__globals__["publication_lease"],
            "_fetch_tmdb_ids_keyset": MagicMock(side_effect=[([42], 42), ([], 42)]),
            "_fetch_map_by_ids": lambda *args: {42: {"tmdb_id": 42}},
            "_fetch_multimap_by_ids": lambda *args: {},
            "_build_payload": lambda **kw: ({"tmdb_id": 42, "streaming_availability": ["8_DE"]}, {"fingerprint_v1": [0.2]}),
            "QdrantMediaPoint": SimpleNamespace(make_point_id=lambda *args: 84),
            "MEDIA_COLLECTION": "media",
        }
        exec(compile(ast.Module(body=functions, type_ignores=[]), "vector_data.py", "exec"), self.namespace)

    def publish(self, *, targeted: bool = True) -> dict:
        return self.namespace["copy_to_qdrant"](
            self.qc, "movie", {"tmdb_id": {"$in": [42]}}, recent_only=False,
            strict_writes=targeted,
        )

    def test_transient_vector_retry_reuses_transforms_and_retains_lease(self) -> None:
        from test_qdrant_publication_retry import RpcFailure
        import grpc
        self.namespace["_build_payload"] = Mock(return_value=(
            {"tmdb_id": 42}, {"fingerprint_v1": [0.2]},
        ))
        self.qc.client.batch_update_points.side_effect = [
            RpcFailure(grpc.StatusCode.UNAVAILABLE), [SimpleNamespace(status="completed")] * 3,
        ]
        result = self.publish()
        self.assertEqual(result["upserts"], 1)
        self.assertEqual(result["publication"]["attempts"], 2)
        self.assertEqual(result["publication"]["retries"], 1)
        self.namespace["_build_payload"].assert_called_once()
        calls = self.qc.client.batch_update_points.call_args_list
        self.assertIs(calls[0].kwargs["update_operations"], calls[1].kwargs["update_operations"])
        self.assertEqual(self.db.streaming_publication_leases.count_documents({}), 0)

    def test_existing_points_keep_vectors_other_writers_own(self) -> None:
        self.namespace["_build_payload"] = lambda **kw: ({"tmdb_id": 42}, {
            "fingerprint_v1": [0.2], "fingerprint_v1_raw": [2.0],
        })
        for names, expected in (
            ({"fingerprint_v1"}, {"fingerprint_v1": [0.2]}),
            ({"fingerprint_v1", "fingerprint_v1_raw", "text_en_v1"},
             {"fingerprint_v1": [0.2], "fingerprint_v1_raw": [2.0]}),
        ):
            with self.subTest(collection_vectors=names):
                self.namespace["_collection_vector_names"] = lambda client: names
                self.namespace["_fetch_tmdb_ids_keyset"] = MagicMock(side_effect=[([42], 42), ([], 42)])
                self.publish()
                insert, vectors, payload = self.qc.client.batch_update_points.call_args.kwargs["update_operations"]
                self.assertEqual(insert.upsert.update_mode, qm.UpdateMode.INSERT_ONLY)
                self.assertEqual(insert.upsert.points[0].vector, expected)
                self.assertEqual(vectors.update_vectors.points[0].vector, expected)
                self.assertEqual(payload.overwrite_payload.points, [84])
                self.assertEqual(payload.overwrite_payload.payload["tmdb_id"], 42)

    def test_targeted_vector_uses_latest_published_snapshot_after_other_writer(self) -> None:
        self.publish()
        point = written_points(self.qc.client)[0]
        self.assertEqual(point.payload["streaming_availability"], ["9_US"])


    def test_unknown_snapshot_preserves_vectors_but_confirmed_empty_can_clear(self) -> None:
        for value, expected in ((None, 0), ([], 1)):
            with self.subTest(snapshot=value):
                self.setUp()
                self.crate.select.return_value = [{"tmdb_id": 42, "streaming_availabilities": value}]
                self.assertEqual(self.publish()["upserts"], expected)
                if expected:
                    point = written_points(self.qc.client)[0]
                    self.assertEqual(point.payload["streaming_availability"], [])
                else:
                    self.qc.client.batch_update_points.assert_not_called()

    def test_scheduled_and_targeted_writes_hold_title_lease_through_completion(self) -> None:
        for targeted in (False, True):
            with self.subTest(targeted=targeted):
                self.setUp()
                def check_competitor_blocked(*args: Any, **kwargs: Any) -> SimpleNamespace:
                    with self.assertRaisesRegex(RuntimeError, "publication busy"):
                        with self.namespace["publication_lease"](self.db, "movie", 42):
                            self.fail("Concurrent publisher entered the active title lease")
                    return completed(*args, **kwargs)
                self.qc.client.batch_update_points.side_effect = check_competitor_blocked
                self.assertEqual(self.publish(targeted=targeted)["upserts"], 1)
                self.assertEqual(self.db.streaming_publication_leases.count_documents({}), 0)

    def test_busy_streaming_writer_prevents_vector_mutation(self) -> None:
        self.db.streaming_publication_leases.insert_one({
            "_id": "movie:42", "token": "other", "expires_at": datetime.utcnow() + timedelta(minutes=15),
        })
        with self.assertRaisesRegex(RuntimeError, "publication busy"):
            self.publish(targeted=False)
        self.qc.client.batch_update_points.assert_not_called()

    def test_lost_lease_during_write_prevents_success_and_preserves_new_owner(self) -> None:
        def replace_owner(**kwargs: Any) -> SimpleNamespace:
            self.db.streaming_publication_leases.update_one(
                {"_id": "movie:42"}, {"$set": {"token": "replacement"}},
            )
            return completed(**kwargs)
        self.qc.client.batch_update_points.side_effect = replace_owner
        with self.assertRaisesRegex(RuntimeError, "lease lost"):
            self.publish()
        self.assertEqual(self.db.streaming_publication_leases.find_one({"_id": "movie:42"})["token"], "replacement")


class AcknowledgmentTests(unittest.TestCase):
    def test_partial_publication_acknowledges_claim_but_retains_new_impressions(self) -> None:
        from test_priority_queue import MemoryCrate, queue
        db = MemoryCrate()
        db.disconnect = MagicMock()
        lease = queue.claim(db, "show", 42)
        db.impression()
        tree = ast.parse((ROOT / "priority" / "reset.py").read_text())
        function = next(node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name == "main")
        namespace = {"CrateConnector": lambda: db, "acknowledge": queue.acknowledge}
        exec(compile(ast.Module(body=[function], type_ignores=[]), "reset.py", "exec"), namespace)
        publication = {"show": {"streaming": {"publication": {"status": "partial_success", "titles": {"42": {"deferred_countries": ["DE"]}}}}}}
        result = namespace["main"]([lease], publication)
        self.assertEqual(result["acknowledged"], 1)
        self.assertEqual(result["status"], "partial_success")
        self.assertEqual(result["publication"], publication)
        self.assertEqual(db.row["demand"] - db.row["acknowledged_demand"], 1)
        self.assertIsNone(db.row["lease_token"])
        db.disconnect.assert_called_once()

    def test_flow_acknowledges_only_after_required_publication_and_preserves_summary(self) -> None:
        import yaml
        flow = yaml.safe_load((ROOT / "priority" / "crawl_all.flow" / "flow.yaml").read_text())
        modules = flow["value"]["modules"]
        publish = next(index for index, module in enumerate(modules) if module["value"].get("path") == "f/priority/publish")
        reset = next(index for index, module in enumerate(modules) if module["value"].get("path") == "f/priority/reset")
        self.assertLess(publish, reset)
        self.assertFalse(modules[publish]["continue_on_error"])
        self.assertEqual(modules[reset]["value"]["input_transforms"]["publication_result"]["expr"], "results.o")

    def test_flow_skips_imdb_unless_enabled(self) -> None:
        # imdb.com blocks the crawler; IMDb ratings come from the daily dataset files.
        import yaml
        flow = yaml.safe_load((ROOT / "priority" / "crawl_all.flow" / "flow.yaml").read_text())
        self.assertIs(flow["schema"]["properties"]["crawl_imdb"]["default"], False)
        branches = next(module for module in flow["value"]["modules"] if module["value"]["type"] == "branchall")["value"]["branches"]
        for branch in branches:
            for module in branch["modules"]:
                is_imdb = module["value"]["path"].startswith("f/imdb_web/")
                self.assertEqual(module.get("skip_if"), {"expr": "!flow_input.crawl_imdb"} if is_imdb else None, module["id"])


if __name__ == "__main__":
    unittest.main()
