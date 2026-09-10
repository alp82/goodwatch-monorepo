"""Publication boundary tests using Mongo collections and a recording Crate adapter."""
import ast
from collections import defaultdict
from contextlib import contextmanager
from uuid import uuid4
from pymongo.errors import DuplicateKeyError
from copy import deepcopy
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Callable, Iterable, Iterator, Optional
import unittest

import mongomock
from pydantic import BaseModel, ConfigDict

ROOT = Path(__file__).parents[1] / "windmill" / "f"


class Record(BaseModel):
    model_config = ConfigDict(extra="allow")


class Crate:
    def __init__(self, rows: Iterable[dict] = ()) -> None:
        self.rows = list(deepcopy(rows))
        self.media = {}
        self.cur = type("Cursor", (), {"rowcount": 1})()
        self.writes = []

    def select(self, sql: str, params: tuple | None = None) -> list[dict]:
        if "FROM streaming_service" in sql:
            return [{"tmdb_id": 8, "name": "Netflix"}, {"tmdb_id": 9, "name": "Amazon"}]
        assert params is not None
        return deepcopy([r for r in self.rows if r["media_tmdb_id"] in params[0] and r["media_type"] == params[1]])

    def upsert_many(self, table: str, records: list[BaseModel], **kwargs: Any) -> dict[str, int]:
        self.writes.append(table)
        for record in records:
            row = record.model_dump()
            if table == "streaming_availability":
                self.rows = [old for old in self.rows if key(old) != key(row)]
                self.rows.append(row)
            else:
                self.media[row["tmdb_id"]] = row
        return {"records_received": len(records), "rows_upserted": len(records)}

    def run(self, sql: str, params: tuple | None = None) -> None:
        self.writes.append(sql)
        if sql.startswith("DELETE"):
            assert params is not None
            self.rows = [row for row in self.rows if key(row) != tuple(params)]


def key(row: dict) -> tuple:
    return tuple(row[k] for k in ("media_tmdb_id", "media_type", "country_code", "streaming_service_id", "streaming_type"))


def availability(country: str = "US", **fields: Any) -> dict:
    return dict(media_tmdb_id=42, media_type="show", country_code=country,
                streaming_type="flatrate", streaming_service_id=8,
                tmdb_link=None, display_priority=None, stream_url="https://old", price_dollar=2, quality="HD") | fields


def load_copy(db: Any) -> Callable[..., dict]:
    path = ROOT / "sync" / "copy" / "tmdb_streaming.py"
    tree = ast.parse(path.read_text())
    body = [n for n in tree.body if isinstance(n, (ast.FunctionDef, ast.Assign))]
    namespace = dict(defaultdict=defaultdict, datetime=datetime, timedelta=timedelta,
                     Optional=Optional, Any=Any, Callable=Callable, Iterator=Iterator,
                     contextmanager=contextmanager, uuid4=uuid4, DuplicateKeyError=DuplicateKeyError,
                     BaseModel=BaseModel, CrateConnector=Crate,
                     Movie=Record, Show=Record, StreamingAvailability=Record,
                     SCHEMAS={name: {"primary_key": ["tmdb_id"]} for name in ("movie", "show", "streaming_availability")},
                     get_db=lambda: db)
    model_tree = ast.parse((ROOT / "sync" / "models" / "crate_models.py").read_text())
    model = next(node for node in model_tree.body if isinstance(node, ast.ClassDef) and node.name == "StreamingAvailability")
    namespace["MediaType"] = str
    exec(compile(ast.Module(body=[model], type_ignores=[]), "crate_models.py", "exec"), namespace)
    exec(compile(ast.Module(body=body, type_ignores=[]), str(path), "exec"), namespace)
    return namespace["copy_media"]


class StreamingPublicationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.db = mongomock.MongoClient().db
        self.now = datetime(2026, 9, 10)
        self.db.tmdb_tv_details.insert_one({"tmdb_id": 42})
        self.copy = load_copy(self.db)

    def publish(self, crate: Crate) -> dict:
        return self.copy(crate, {"tmdb_id": {"$in": [42]}}, "show", recent_only=False)

    def test_all_pending_retains_existing_availability_without_freshness(self) -> None:
        self.db.tmdb_tv_providers.insert_one({"tmdb_id": 42, "country_code": "US", "created_at": self.now})
        crate = Crate([availability()])
        result = self.publish(crate)
        self.assertEqual(crate.rows, [availability()])
        self.assertEqual(crate.media, {})
        self.assertEqual(result["publication"]["titles"]["42"]["deferred_countries"], ["US"])
        self.assertEqual(result["publication"]["status"], "partial_success")

    def test_pending_without_published_rows_is_unknown_not_confirmed_empty(self) -> None:
        self.db.tmdb_tv_providers.insert_one({"tmdb_id": 42, "country_code": "US"})
        crate = Crate()
        result = self.publish(crate)
        self.assertIsNone(result["publication"]["titles"]["42"]["streaming_availability"])
        self.assertEqual(crate.media, {})

    def test_mixed_success_replaces_only_verified_country_and_rebuilds_aggregate(self) -> None:
        self.db.tmdb_tv_providers.insert_many([
            {"tmdb_id": 42, "country_code": "US", "created_at": self.now, "updated_at": self.now,
             "streaming_links": [{"provider_name": "Amazon", "stream_type": "flatrate", "stream_url": "https://new"}]},
            {"tmdb_id": 42, "country_code": "DE", "created_at": self.now},
        ])
        crate = Crate([availability(), availability("DE")])
        result = self.publish(crate)
        self.assertEqual({(r["country_code"], r["streaming_service_id"]) for r in crate.rows}, {("US", 9), ("DE", 8)})
        self.assertIn(availability("DE"), crate.rows)
        self.assertEqual(set(crate.media[42]["streaming_availabilities"]), {"US_9", "DE_8"})
        self.assertEqual(result["publication"]["titles"]["42"]["deferred_countries"], ["DE"])

    def test_unknown_verified_provider_fails_without_clearing_previous_offers(self) -> None:
        self.db.tmdb_tv_providers.insert_one({
            "tmdb_id": 42, "country_code": "US", "updated_at": self.now,
            "streaming_links": [{"provider_name": "Unmapped Service", "stream_type": "flatrate",
                                 "stream_url": "https://new"}],
        })
        crate = Crate([availability()])
        with self.assertRaisesRegex(RuntimeError, "Unmapped streaming provider"):
            self.publish(crate)
        self.assertEqual(crate.rows, [availability()])
        self.assertEqual(crate.media, {})
        self.assertEqual(self.db.streaming_publication_leases.count_documents({}), 0)

    def test_processed_empty_clears_scraped_fields_but_retains_api_and_other_countries(self) -> None:
        self.db.tmdb_tv_providers.insert_one({"tmdb_id": 42, "country_code": "US", "updated_at": self.now, "streaming_links": []})
        crate = Crate([availability(tmdb_link="https://tmdb", display_priority=1), availability("DE")])
        result = self.publish(crate)
        us = next(r for r in crate.rows if r["country_code"] == "US")
        self.assertEqual(us["tmdb_link"], "https://tmdb")
        self.assertIsNone(us["stream_url"])
        self.assertIsNone(us["price_dollar"])
        self.assertIsNone(us["quality"])
        self.assertEqual(crate.media[42]["streaming_availabilities"], ["DE_8", "US_8"])
        self.assertNotIn("tmdb_providers_created_at", crate.media[42])
        self.assertEqual(result["publication"]["status"], "success")

    def test_processed_empty_removes_obsolete_scrape_offer(self) -> None:
        self.db.tmdb_tv_providers.insert_one({"tmdb_id": 42, "country_code": "US", "updated_at": self.now, "streaming_links": []})
        crate = Crate([availability()])
        self.publish(crate)
        self.assertEqual(crate.rows, [])
        self.assertEqual(crate.media[42]["streaming_country_codes"], [])
        self.assertEqual(crate.media[42]["streaming_service_ids"], [])
        self.assertEqual(crate.media[42]["streaming_availabilities"], [])

    def test_absent_providers_publish_verified_api_without_inventing_scrape_freshness(self) -> None:
        self.db.tmdb_tv_details.update_one({"tmdb_id": 42}, {"$set": {"updated_at": self.now,
            "watch_providers": {"results": {"US": {"link": "https://tmdb", "flatrate": [{"provider_id": 9, "display_priority": 2}]}}}}})
        crate = Crate([availability(), availability("DE")])
        result = self.publish(crate)
        self.assertEqual(result["publication"]["titles"]["42"]["provider_state"], "absent")
        self.assertEqual(set(crate.media[42]["streaming_availabilities"]), {"US_8", "US_9", "DE_8"})
        self.assertNotIn("tmdb_providers_updated_at", crate.media[42])
        self.assertEqual(result["publication"]["status"], "partial_success")

    def test_absent_sources_are_explicit_and_do_not_write(self) -> None:
        crate = Crate([availability()])
        result = self.publish(crate)
        self.assertFalse(any(sql != "REFRESH TABLE streaming_availability" for sql in crate.writes))
        self.assertEqual(result["publication"]["titles"]["42"]["provider_state"], "absent")

    def test_api_empty_clears_only_api_contribution_while_scrape_is_pending(self) -> None:
        self.db.tmdb_tv_details.update_one({"tmdb_id": 42}, {"$set": {"updated_at": self.now,
            "watch_providers": {"results": {"US": {"link": "https://tmdb"}}}}})
        self.db.tmdb_tv_providers.insert_one({"tmdb_id": 42, "country_code": "US"})
        crate = Crate([availability(tmdb_link="https://oldtmdb", display_priority=1)])
        self.publish(crate)
        self.assertEqual(len(crate.rows), 1)
        self.assertIsNone(crate.rows[0]["tmdb_link"])
        self.assertIsNone(crate.rows[0]["display_priority"])
        self.assertEqual(crate.rows[0]["stream_url"], "https://old")

    def test_failed_country_retains_published_data_despite_previous_success(self) -> None:
        self.db.tmdb_tv_providers.insert_one({"tmdb_id": 42, "country_code": "US", "updated_at": self.now,
                                             "consecutive_failures": 1, "streaming_links": []})
        crate = Crate([availability()])
        result = self.publish(crate)
        self.assertEqual(crate.rows, [availability()])
        self.assertEqual(result["publication"]["titles"]["42"]["deferred_countries"], ["US"])

    def test_scheduled_catchup_uses_same_country_retention(self) -> None:
        self.db.tmdb_tv_providers.insert_many([
            {"tmdb_id": 42, "country_code": "US", "updated_at": datetime.utcnow(), "streaming_links": []},
            {"tmdb_id": 42, "country_code": "DE"},
        ])
        crate = Crate([availability(), availability("DE")])
        result = self.copy(crate, {}, "show")
        self.assertEqual(crate.rows, [availability("DE")])
        self.assertEqual(crate.media[42]["streaming_availabilities"], ["DE_8"])
        self.assertEqual(result["publication"]["status"], "partial_success")
        self.assertEqual(result["publication"]["titles"], {})

    def test_concurrent_publication_fails_before_mutating_children_or_aggregate(self) -> None:
        self.db.tmdb_tv_providers.insert_one({"tmdb_id": 42, "country_code": "US", "updated_at": self.now, "streaming_links": []})
        self.db.streaming_publication_leases.insert_one({"_id": "show:42", "token": "other", "expires_at": datetime.utcnow() + timedelta(minutes=15)})
        crate = Crate([availability()])
        with self.assertRaisesRegex(RuntimeError, "publication.*busy"):
            self.publish(crate)
        self.assertEqual(crate.rows, [availability()])
        self.assertEqual(crate.media, {})

    def test_replaced_lease_prevents_writes_and_preserves_new_owner(self) -> None:
        self.db.tmdb_tv_providers.insert_one({"tmdb_id": 42, "country_code": "US", "updated_at": self.now, "streaming_links": []})
        crate = Crate([availability()])
        select = crate.select
        def replace_owner(sql, params=None):
            result = select(sql, params)
            if "FROM streaming_availability" in sql:
                self.db.streaming_publication_leases.update_one({"_id": "show:42"}, {"$set": {"token": "replacement"}})
            return result
        crate.select = replace_owner
        with self.assertRaisesRegex(RuntimeError, "lease lost"):
            self.publish(crate)
        self.assertEqual(crate.rows, [availability()])
        self.assertEqual(crate.media, {})
        self.assertEqual(self.db.streaming_publication_leases.find_one({"_id": "show:42"})["token"], "replacement")

    def test_failed_child_write_does_not_publish_aggregate_and_releases_own_lease(self) -> None:
        self.db.tmdb_tv_providers.insert_one({"tmdb_id": 42, "country_code": "US", "updated_at": self.now,
            "streaming_links": [{"provider_name": "Amazon", "stream_type": "flatrate", "stream_url": "https://new"}]})
        crate = Crate([availability()])
        def fail(**kwargs):
            raise RuntimeError("child write failed")
        crate.upsert_many = fail
        with self.assertRaisesRegex(RuntimeError, "child write failed"):
            self.publish(crate)
        self.assertEqual(crate.rows, [availability()])
        self.assertEqual(crate.media, {})
        self.assertEqual(self.db.streaming_publication_leases.count_documents({}), 0)


if __name__ == "__main__":
    unittest.main()
