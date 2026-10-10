"""The one-off pass that publishes listed titles TMDB lists in no country (#386)."""
import importlib.util
import sys
import unittest
from datetime import datetime
from pathlib import Path
from typing import Any
from unittest.mock import MagicMock, patch

import mongomock
from pydantic import BaseModel

sys.path.insert(0, str(Path(__file__).parents[1] / "windmill"))

from f.sync.copy import tmdb_streaming
from f.tmdb_api.provider_evidence import snapshot_id, utc_ms
from test_streaming_publication import Crate

SCRIPT = Path(__file__).parents[1] / "scripts" / "publish_titles_checked_without_offers.py"
EMPTY = {"results": {}}


class TitleCrate(Crate):
    """Crate with show rows: a streaming upsert keeps the columns it does not set."""

    def disconnect(self) -> None:
        pass

    def select(self, sql: str, params: tuple | None = None) -> list[dict]:
        if "FROM show WHERE" in sql:
            return [dict(row) for tmdb_id, row in self.media.items() if tmdb_id in params[0]]
        return super().select(sql, params)

    def upsert_many(self, table: str, records: list[BaseModel], **kwargs: Any) -> dict[str, int]:
        if table != "show":
            return super().upsert_many(table, records, **kwargs)
        for record in records:
            values = {key: value for key, value in record.model_dump().items() if value is not None}
            self.media.setdefault(values["tmdb_id"], {}).update(values)
        return {"records_received": len(records), "rows_upserted": len(records)}


class PublishCheckedWithoutOffersTests(unittest.TestCase):
    def setUp(self) -> None:
        spec = importlib.util.spec_from_file_location("publish_titles_checked_without_offers", SCRIPT)
        self.script = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.script)
        self.db = mongomock.MongoClient().db
        now = datetime.utcnow()
        checked = {"updated_at": now, "watch_providers": EMPTY, "watch_providers_attempted_at": now,
                   "watch_providers_error": "", "watch_providers_check": {
                       "checked_at": utc_ms(now), "payload_hash": snapshot_id(EMPTY), "countries": []}}
        self.db.tmdb_tv_details.insert_many([
            {"tmdb_id": 1} | checked,
            {"tmdb_id": 2} | checked,
            {"tmdb_id": 3, "updated_at": now, "watch_providers": EMPTY},
            {"tmdb_id": 4, "tmdb_deleted": True} | checked,
            {"tmdb_id": 5} | checked,
        ])
        self.crate = TitleCrate()
        self.crate.media = {tmdb_id: {"tmdb_id": tmdb_id, "streaming_availabilities": None} for tmdb_id in (1, 3, 4)}
        self.crate.media[2] = {"tmdb_id": 2, "streaming_availabilities": []}
        self.copy_to_qdrant = MagicMock(return_value={"upserts": 2, "skipped_unknown_streaming": 0})
        self.qdrant = MagicMock()

    def run_script(self, **arguments: Any) -> dict:
        with patch.object(self.script, "init_mongodb"), patch.object(self.script, "close_mongodb"), \
                patch.object(self.script, "CrateConnector", return_value=self.crate), \
                patch.object(self.script, "QdrantConnector", self.qdrant), \
                patch.object(self.script, "get_db", return_value=self.db), \
                patch.object(tmdb_streaming, "get_db", return_value=self.db), \
                patch.object(self.script, "copy_to_qdrant", self.copy_to_qdrant), \
                patch.object(self.script.time, "sleep"):
            return self.script.main(**{"show_ids": [6, 5, 4, 3, 2, 1]} | arguments)

    def test_a_dry_run_says_what_it_would_publish_and_writes_nothing(self) -> None:
        published = {tmdb_id: dict(row) for tmdb_id, row in self.crate.media.items()}
        result = self.run_script()
        self.assertEqual(result["show"], {
            "listed": 6, "to publish": 1, "aggregate already published": 1, "unknown availability": 1,
            "deleted on TMDB": 1, "no Crate row": 1, "no details in Mongo": 1})
        self.assertTrue(result["dry_run"])
        self.assertEqual(self.crate.media, published)
        self.assertEqual(self.crate.writes, [])
        self.qdrant.assert_not_called()
        self.copy_to_qdrant.assert_not_called()

    def test_it_publishes_the_empty_aggregate_and_then_copies_the_points(self) -> None:
        result = self.run_script(dry_run=False)
        self.assertEqual(self.crate.media[1]["streaming_availabilities"], [])
        # Unknown availability, a deleted title and a title without a Crate row stay as they are.
        self.assertEqual(sorted(self.crate.media), [1, 2, 3, 4])
        for tmdb_id in (3, 4):
            self.assertIsNone(self.crate.media[tmdb_id]["streaming_availabilities"])
        self.copy_to_qdrant.assert_called_once_with(
            self.qdrant.return_value, "show", {"tmdb_id": {"$in": [1, 2]}}, recent_only=False)
        self.assertEqual(result["show"]["aggregates written"], 1)
        self.assertEqual(result["show"]["points written"], 2)
        self.assertEqual(self.db.streaming_publication_leases.count_documents({}), 0)

    def test_carried_adds_the_titles_the_fingerprint_copy_left_out(self) -> None:
        self.db.sync_state.insert_one({"_id": "vector_data:show", "carried_ids": [1, 3]})
        self.db.sync_state.insert_one({"_id": "vector_data:movie", "carried_ids": [9]})
        result = self.run_script(show_ids=[2], carried=True)
        self.assertEqual(result["show"], {
            "listed": 3, "to publish": 1, "aggregate already published": 1, "unknown availability": 1})
        self.assertEqual(result["movie"], {"listed": 1, "no details in Mongo": 1})
        self.assertEqual(self.run_script(show_ids=[2])["show"]["listed"], 1)

    def test_limit_keeps_a_run_to_the_first_ids(self) -> None:
        result = self.run_script(limit=2)
        self.assertEqual(result["show"], {"listed": 2, "to publish": 1, "aggregate already published": 1})


if __name__ == "__main__":
    unittest.main()
